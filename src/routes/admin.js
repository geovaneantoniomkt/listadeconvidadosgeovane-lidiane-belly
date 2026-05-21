// ================================================
// ROTAS DO PAINEL ADMINISTRATIVO
// ================================================
const express = require('express');
const router  = express.Router();
const db      = require('../database/db');
const { requireAuth, redirectIfAuth } = require('../middleware/auth');
const { uploadProductImage }          = require('../middleware/upload');

async function getSetting(key) {
  const row = await db.get('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? row.value : null;
}
async function getAllSettings() {
  const rows = await db.all('SELECT key, value FROM settings');
  const s = {};
  rows.forEach(r => { s[r.key] = r.value; });
  return s;
}

// ────────────────────────────────────────────────
// LOGIN
// ────────────────────────────────────────────────
router.get('/login', redirectIfAuth, (req, res) => {
  res.render('admin/login', { flash: req.flash(), page: 'admin-login' });
});

router.post('/login', redirectIfAuth, (req, res) => {
  const { username, password } = req.body;
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'casa2024';

  if (username === adminUser && password === adminPass) {
    req.session.admin = true;
    req.flash('success', 'Bem-vindo ao painel! 🏠');
    return res.redirect('/admin/dashboard');
  }
  req.flash('error', 'Usuário ou senha incorretos.');
  res.redirect('/admin/login');
});

router.post('/logout', requireAuth, (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// ────────────────────────────────────────────────
// DASHBOARD
// ────────────────────────────────────────────────
router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const settings = await getAllSettings();

    const [totalProducts, available, purchased, pendingReceipts,
           totalContrib, totalRaffle, raffleSold, raffleRegistered] = await Promise.all([
      db.get("SELECT COUNT(*) as n FROM products"),
      db.get("SELECT COUNT(*) as n FROM products WHERE status = 'disponivel'"),
      db.get("SELECT COUNT(*) as n FROM products WHERE status = 'comprado'"),
      db.get("SELECT COUNT(*) as n FROM receipts WHERE status = 'aguardando'"),
      db.get("SELECT COALESCE(SUM(amount),0) as total FROM contributions WHERE payment_status='confirmado'"),
      db.get("SELECT COALESCE(SUM(amount),0) as total FROM raffle_numbers WHERE payment_status='confirmado' AND status != 'cancelado'"),
      db.get("SELECT COUNT(*) as n FROM raffle_numbers WHERE status='pago'"),
      db.get("SELECT COUNT(*) as n FROM raffle_numbers WHERE status != 'cancelado'"),
    ]);

    const stats = {
      totalProducts:       totalProducts.n,
      available:           available.n,
      purchased:           purchased.n,
      pending_receipts:    pendingReceipts.n,
      total_contributions: totalContrib.total,
      total_raffle:        totalRaffle.total,
      raffle_sold:         raffleSold.n,
      raffle_registered:   raffleRegistered.n,
    };

    const [recentReceipts, recentContributions] = await Promise.all([
      db.all(`
        SELECT r.*, p.name as product_name
        FROM receipts r JOIN products p ON r.product_id = p.id
        ORDER BY r.created_at DESC LIMIT 5
      `),
      db.all(`SELECT * FROM contributions ORDER BY created_at DESC LIMIT 5`),
    ]);

    res.render('admin/dashboard', { settings, stats, recentReceipts, recentContributions, flash: req.flash(), page: 'admin-dashboard' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro interno');
  }
});

// ────────────────────────────────────────────────
// PRODUTOS
// ────────────────────────────────────────────────
router.get('/produtos', requireAuth, async (req, res) => {
  try {
    const settings = await getAllSettings();
    const [products, categories] = await Promise.all([
      db.all(`
        SELECT p.*, c.name as category_name
        FROM products p LEFT JOIN categories c ON p.category_id = c.id
        ORDER BY p.priority DESC, p.created_at DESC
      `),
      db.all('SELECT * FROM categories ORDER BY name'),
    ]);
    res.render('admin/products', { settings, products, categories, flash: req.flash(), page: 'admin-products' });
  } catch (err) { console.error(err); res.status(500).send('Erro interno'); }
});

router.get('/produtos/novo', requireAuth, async (req, res) => {
  try {
    const settings    = await getAllSettings();
    const categories  = await db.all('SELECT * FROM categories ORDER BY name');
    res.render('admin/product-form', { settings, categories, product: null, flash: req.flash(), page: 'admin-products' });
  } catch (err) { console.error(err); res.status(500).send('Erro interno'); }
});

router.get('/produtos/:id/editar', requireAuth, async (req, res) => {
  try {
    const settings   = await getAllSettings();
    const product    = await db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!product) { req.flash('error', 'Produto não encontrado.'); return res.redirect('/admin/produtos'); }
    const categories = await db.all('SELECT * FROM categories ORDER BY name');
    res.render('admin/product-form', { settings, categories, product, flash: req.flash(), page: 'admin-products' });
  } catch (err) { console.error(err); res.status(500).send('Erro interno'); }
});

function buildSuppliersJson(body) {
  const names  = [].concat(body.supplier_name || []);
  const urls   = [].concat(body.supplier_url  || []);
  const result = [];
  names.forEach((name, i) => {
    const n = (name || '').trim();
    const u = (urls[i] || '').trim();
    if (n || u) result.push({ name: n, url: u });
  });
  return JSON.stringify(result);
}

router.post('/produtos', requireAuth, uploadProductImage.single('image'), async (req, res) => {
  try {
    const { name, description, creative_text, price, category_id, status, priority, badge, specs } = req.body;
    const image_url = req.file ? `/uploads/products/${req.file.filename}` : '/images/placeholder-product.jpg';
    const suppliers = buildSuppliersJson(req.body);

    await db.run(
      `INSERT INTO products (name, description, creative_text, price, category_id, status, priority, badge, image_url, specs, suppliers)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, description, creative_text, parseFloat(price), category_id || null,
       status || 'disponivel', priority ? 1 : 0, badge || null, image_url, specs || '{}', suppliers]
    );
    req.flash('success', 'Produto criado com sucesso!');
    res.redirect('/admin/produtos');
  } catch (err) { console.error(err); res.status(500).send('Erro interno'); }
});

router.post('/produtos/:id', requireAuth, uploadProductImage.single('image'), async (req, res) => {
  try {
    const { name, description, creative_text, price, category_id, status, priority, badge, specs } = req.body;
    const product = await db.get('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!product) { req.flash('error', 'Produto não encontrado.'); return res.redirect('/admin/produtos'); }

    const image_url = req.file ? `/uploads/products/${req.file.filename}` : product.image_url;
    const suppliers = buildSuppliersJson(req.body);

    await db.run(
      `UPDATE products
       SET name=?, description=?, creative_text=?, price=?, category_id=?, status=?,
           priority=?, badge=?, image_url=?, specs=?, suppliers=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`,
      [name, description, creative_text, parseFloat(price), category_id || null,
       status, priority ? 1 : 0, badge || null, image_url, specs || '{}', suppliers, req.params.id]
    );
    req.flash('success', 'Produto atualizado!');
    res.redirect('/admin/produtos');
  } catch (err) { console.error(err); res.status(500).send('Erro interno'); }
});

router.post('/produtos/:id/status', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['disponivel', 'reservado', 'comprado'].includes(status)) return res.redirect('/admin/produtos');
    await db.run('UPDATE products SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [status, req.params.id]);
    res.redirect('/admin/produtos');
  } catch (err) { console.error(err); res.status(500).send('Erro interno'); }
});

router.post('/produtos/:id/excluir', requireAuth, async (req, res) => {
  try {
    await db.run('DELETE FROM products WHERE id = ?', [req.params.id]);
    req.flash('success', 'Produto excluído.');
    res.redirect('/admin/produtos');
  } catch (err) { console.error(err); res.status(500).send('Erro interno'); }
});

// ────────────────────────────────────────────────
// COMPROVANTES
// ────────────────────────────────────────────────
router.get('/comprovantes', requireAuth, async (req, res) => {
  try {
    const settings  = await getAllSettings();
    const receipts  = await db.all(`
      SELECT r.*, p.name as product_name, p.price as product_price
      FROM receipts r JOIN products p ON r.product_id = p.id
      ORDER BY CASE r.status WHEN 'aguardando' THEN 0 WHEN 'aprovado' THEN 1 ELSE 2 END, r.created_at DESC
    `);
    res.render('admin/receipts', { settings, receipts, flash: req.flash(), page: 'admin-receipts' });
  } catch (err) { console.error(err); res.status(500).send('Erro interno'); }
});

router.post('/comprovantes/:id/aprovar', requireAuth, async (req, res) => {
  try {
    const receipt = await db.get('SELECT * FROM receipts WHERE id = ?', [req.params.id]);
    if (!receipt) { req.flash('error', 'Comprovante não encontrado.'); return res.redirect('/admin/comprovantes'); }

    await db.run(`UPDATE receipts SET status='aprovado', reviewed_at=CURRENT_TIMESTAMP WHERE id=?`, [req.params.id]);
    await db.run(`UPDATE products  SET status='comprado', updated_at=CURRENT_TIMESTAMP WHERE id=?`,  [receipt.product_id]);

    req.flash('success', 'Comprovante aprovado! Produto marcado como comprado.');
    res.redirect('/admin/comprovantes');
  } catch (err) { console.error(err); res.status(500).send('Erro interno'); }
});

router.post('/comprovantes/:id/rejeitar', requireAuth, async (req, res) => {
  try {
    const receipt = await db.get('SELECT * FROM receipts WHERE id = ?', [req.params.id]);
    if (!receipt) { req.flash('error', 'Comprovante não encontrado.'); return res.redirect('/admin/comprovantes'); }

    const { admin_notes } = req.body;
    await db.run(`UPDATE receipts SET status='rejeitado', admin_notes=?, reviewed_at=CURRENT_TIMESTAMP WHERE id=?`, [admin_notes || null, req.params.id]);
    await db.run(`UPDATE products  SET status='disponivel', updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='aguardando_validacao'`, [receipt.product_id]);

    req.flash('success', 'Comprovante rejeitado. Produto disponível novamente.');
    res.redirect('/admin/comprovantes');
  } catch (err) { console.error(err); res.status(500).send('Erro interno'); }
});

// ────────────────────────────────────────────────
// CONTRIBUIÇÕES
// ────────────────────────────────────────────────
router.get('/contribuicoes', requireAuth, async (req, res) => {
  try {
    const settings      = await getAllSettings();
    const [contributions, totals] = await Promise.all([
      db.all(`
        SELECT c.*, p.name as product_name
        FROM contributions c LEFT JOIN products p ON c.product_id = p.id
        ORDER BY c.created_at DESC
      `),
      db.get(`
        SELECT
          COALESCE(SUM(CASE WHEN payment_status='confirmado' THEN amount ELSE 0 END),0) as confirmado,
          COALESCE(SUM(CASE WHEN payment_status='pendente'   THEN amount ELSE 0 END),0) as pendente,
          COALESCE(SUM(CASE WHEN payment_status='cancelado'  THEN amount ELSE 0 END),0) as cancelado,
          COUNT(CASE WHEN payment_status='cancelado' THEN 1 END)                        as cancelado_count
        FROM contributions
      `),
    ]);
    res.render('admin/contributions', { settings, contributions, totals, flash: req.flash(), page: 'admin-contributions' });
  } catch (err) { console.error(err); res.status(500).send('Erro interno'); }
});

router.post('/contribuicoes/:id/confirmar', requireAuth, async (req, res) => {
  try {
    await db.run(`UPDATE contributions SET payment_status='confirmado', confirmed_at=CURRENT_TIMESTAMP WHERE id=?`, [req.params.id]);
    req.flash('success', 'Contribuição confirmada!');
    res.redirect('/admin/contribuicoes');
  } catch (err) { console.error(err); res.status(500).send('Erro interno'); }
});

router.post('/contribuicoes/:id/cancelar', requireAuth, async (req, res) => {
  try {
    await db.run(`UPDATE contributions SET payment_status='cancelado' WHERE id=?`, [req.params.id]);
    req.flash('success', 'Contribuição marcada como cancelada.');
    res.redirect('/admin/contribuicoes');
  } catch (err) { console.error(err); res.status(500).send('Erro interno'); }
});

router.post('/contribuicoes/:id/excluir', requireAuth, async (req, res) => {
  try {
    await db.run('DELETE FROM contributions WHERE id=?', [req.params.id]);
    req.flash('success', 'Contribuição excluída.');
    res.redirect('/admin/contribuicoes');
  } catch (err) { console.error(err); res.status(500).send('Erro interno'); }
});

router.post('/contribuicoes', requireAuth, async (req, res) => {
  try {
    const { name, phone, email, amount, message } = req.body;
    await db.run(
      `INSERT INTO contributions (name, phone, email, amount, payment_status, message, confirmed_at)
       VALUES (?, ?, ?, ?, 'confirmado', ?, CURRENT_TIMESTAMP)`,
      [name, phone, email || null, parseFloat(amount), message || null]
    );
    req.flash('success', 'Contribuição registrada com sucesso!');
    res.redirect('/admin/contribuicoes');
  } catch (err) { console.error(err); res.status(500).send('Erro interno'); }
});

// ────────────────────────────────────────────────
// SORTEIO ADMIN
// ────────────────────────────────────────────────
router.get('/sorteio', requireAuth, async (req, res) => {
  try {
    const settings = await getAllSettings();
    const [numbers, totals] = await Promise.all([
      db.all('SELECT * FROM raffle_numbers ORDER BY number ASC'),
      db.get(`
        SELECT
          COUNT(*) as total,
          COALESCE(SUM(CASE WHEN status='pago' THEN amount ELSE 0 END),0) as arrecadado,
          COUNT(CASE WHEN status='pago' THEN 1 END)                        as pagos
        FROM raffle_numbers WHERE status != 'cancelado'
      `),
    ]);
    res.render('admin/raffle', { settings, numbers, totals, flash: req.flash(), page: 'admin-raffle' });
  } catch (err) { console.error(err); res.status(500).send('Erro interno'); }
});

router.post('/sorteio/:id/confirmar', requireAuth, async (req, res) => {
  try {
    await db.run(`UPDATE raffle_numbers SET status='pago', payment_status='confirmado', paid_at=CURRENT_TIMESTAMP WHERE id=?`, [req.params.id]);
    req.flash('success', 'Pagamento do sorteio confirmado!');
    res.redirect('/admin/sorteio');
  } catch (err) { console.error(err); res.status(500).send('Erro interno'); }
});

router.post('/sorteio/:id/cancelar', requireAuth, async (req, res) => {
  try {
    await db.run(`UPDATE raffle_numbers SET status='cancelado', payment_status='cancelado' WHERE id=?`, [req.params.id]);
    req.flash('success', 'Número cancelado e liberado.');
    res.redirect('/admin/sorteio');
  } catch (err) { console.error(err); res.status(500).send('Erro interno'); }
});

// ────────────────────────────────────────────────
// CONFIGURAÇÕES
// ────────────────────────────────────────────────
router.get('/configuracoes', requireAuth, async (req, res) => {
  try {
    const settings = await getAllSettings();
    res.render('admin/settings', { settings, flash: req.flash(), page: 'admin-settings' });
  } catch (err) { console.error(err); res.status(500).send('Erro interno'); }
});

router.post('/configuracoes', requireAuth, async (req, res) => {
  try {
    const { meta_total, mercadopago_link, whatsapp_number, raffle_price_per_number, popup_enabled, goal_calculation } = req.body;
    const updates = {
      meta_total, mercadopago_link, whatsapp_number,
      raffle_price_per_number,
      popup_enabled:    popup_enabled ? '1' : '0',
      goal_calculation
    };

    await db.transaction(async (tx) => {
      for (const [key, val] of Object.entries(updates)) {
        if (val !== undefined) {
          await tx.run(
            `INSERT INTO settings (key, value) VALUES (?, ?)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
            [key, String(val)]
          );
        }
      }
    });

    req.flash('success', 'Configurações salvas!');
    res.redirect('/admin/configuracoes');
  } catch (err) { console.error(err); res.status(500).send('Erro interno'); }
});

// ────────────────────────────────────────────────
// CATEGORIAS
// ────────────────────────────────────────────────
router.get('/categorias', requireAuth, async (req, res) => {
  try {
    const settings   = await getAllSettings();
    const categories = await db.all('SELECT * FROM categories ORDER BY name');
    res.render('admin/categories', { settings, categories, flash: req.flash(), page: 'admin-categories' });
  } catch (err) { console.error(err); res.status(500).send('Erro interno'); }
});

router.post('/categorias', requireAuth, async (req, res) => {
  try {
    const { name, slug, icon } = req.body;
    await db.run('INSERT INTO categories (name, slug, icon) VALUES (?, ?, ?)', [name, slug, icon || '🎁']);
    req.flash('success', 'Categoria criada!');
  } catch (e) {
    req.flash('error', 'Já existe uma categoria com esse nome ou slug.');
  }
  res.redirect('/admin/categorias');
});

router.post('/categorias/:id/excluir', requireAuth, async (req, res) => {
  try {
    await db.run('DELETE FROM categories WHERE id = ?', [req.params.id]);
    req.flash('success', 'Categoria excluída.');
    res.redirect('/admin/categorias');
  } catch (err) { console.error(err); res.status(500).send('Erro interno'); }
});

// ────────────────────────────────────────────────
// OBRA / CONSTRUÇÃO
// ────────────────────────────────────────────────
router.get('/obra', requireAuth, async (req, res) => {
  try {
    const settings = await getAllSettings();
    const stages   = await db.all('SELECT * FROM construction_stages ORDER BY sort_order ASC');
    res.render('admin/construction', { settings, stages, flash: req.flash(), page: 'admin-construction' });
  } catch (err) { console.error(err); res.status(500).send('Erro interno'); }
});

router.post('/obra', requireAuth, async (req, res) => {
  try {
    const { overall, delivery_date, last_update, stage_id, stage_percentage } = req.body;

    const settingsToUpdate = {};
    if (overall !== undefined) settingsToUpdate.construction_overall     = String(parseFloat(overall) || 0);
    if (delivery_date)         settingsToUpdate.delivery_date            = delivery_date;
    if (last_update)           settingsToUpdate.construction_last_update = last_update;

    await db.transaction(async (tx) => {
      for (const [key, val] of Object.entries(settingsToUpdate)) {
        await tx.run(
          `INSERT INTO settings (key, value) VALUES (?, ?)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
          [key, val]
        );
      }

      const ids  = [].concat(stage_id          || []);
      const pcts = [].concat(stage_percentage  || []);
      for (let i = 0; i < ids.length; i++) {
        const pct = parseFloat(pcts[i]);
        if (!isNaN(pct)) {
          await tx.run(
            'UPDATE construction_stages SET percentage=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
            [Math.min(100, Math.max(0, pct)), ids[i]]
          );
        }
      }
    });

    req.flash('success', 'Andamento da obra atualizado!');
    res.redirect('/admin/obra');
  } catch (err) { console.error(err); res.status(500).send('Erro interno'); }
});

module.exports = router;
