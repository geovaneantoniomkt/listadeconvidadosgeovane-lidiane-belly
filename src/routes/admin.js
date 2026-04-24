// ================================================
// ROTAS DO PAINEL ADMINISTRATIVO
// ================================================
const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { requireAuth, redirectIfAuth } = require('../middleware/auth');
const { uploadProductImage } = require('../middleware/upload');

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}
function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
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

  // Log diagnóstico (não expõe senha, só tamanho e se bate)
  console.log(`[LOGIN] user: "${username}" (esperado: "${adminUser}", bate: ${username === adminUser})`);
  console.log(`[LOGIN] pass length digitada: ${password?.length}, esperada: ${adminPass.length}, bate: ${password === adminPass}`);

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
router.get('/dashboard', requireAuth, (req, res) => {
  const settings = getAllSettings();

  const stats = {
    totalProducts: db.prepare('SELECT COUNT(*) as n FROM products').get().n,
    available: db.prepare("SELECT COUNT(*) as n FROM products WHERE status = 'disponivel'").get().n,
    purchased: db.prepare("SELECT COUNT(*) as n FROM products WHERE status = 'comprado'").get().n,
    pending_receipts: db.prepare("SELECT COUNT(*) as n FROM receipts WHERE status = 'aguardando'").get().n,
    total_contributions: db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM contributions WHERE payment_status='confirmado'").get().total,
    total_raffle: db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM raffle_numbers WHERE payment_status='confirmado' AND status != 'cancelado'").get().total,
    raffle_sold: db.prepare("SELECT COUNT(*) as n FROM raffle_numbers WHERE status='pago'").get().n,
    raffle_registered: db.prepare("SELECT COUNT(*) as n FROM raffle_numbers WHERE status != 'cancelado'").get().n,
  };

  const recentReceipts = db.prepare(`
    SELECT r.*, p.name as product_name
    FROM receipts r
    JOIN products p ON r.product_id = p.id
    ORDER BY r.created_at DESC
    LIMIT 5
  `).all();

  const recentContributions = db.prepare(`
    SELECT * FROM contributions ORDER BY created_at DESC LIMIT 5
  `).all();

  res.render('admin/dashboard', {
    settings, stats, recentReceipts, recentContributions,
    flash: req.flash(), page: 'admin-dashboard'
  });
});

// ────────────────────────────────────────────────
// PRODUTOS
// ────────────────────────────────────────────────
router.get('/produtos', requireAuth, (req, res) => {
  const settings = getAllSettings();
  const products = db.prepare(`
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    ORDER BY p.priority DESC, p.created_at DESC
  `).all();
  const categories = db.prepare('SELECT * FROM categories ORDER BY name').all();
  res.render('admin/products', { settings, products, categories, flash: req.flash(), page: 'admin-products' });
});

router.get('/produtos/novo', requireAuth, (req, res) => {
  const settings = getAllSettings();
  const categories = db.prepare('SELECT * FROM categories ORDER BY name').all();
  res.render('admin/product-form', { settings, categories, product: null, flash: req.flash(), page: 'admin-products' });
});

router.get('/produtos/:id/editar', requireAuth, (req, res) => {
  const settings = getAllSettings();
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) {
    req.flash('error', 'Produto não encontrado.');
    return res.redirect('/admin/produtos');
  }
  const categories = db.prepare('SELECT * FROM categories ORDER BY name').all();
  res.render('admin/product-form', { settings, categories, product, flash: req.flash(), page: 'admin-products' });
});

function buildSuppliersJson(body) {
  const names = [].concat(body.supplier_name || []);
  const urls  = [].concat(body.supplier_url  || []);
  const result = [];
  names.forEach((name, i) => {
    const n = (name || '').trim();
    const u = (urls[i] || '').trim();
    if (n || u) result.push({ name: n, url: u });
  });
  return JSON.stringify(result);
}

router.post('/produtos', requireAuth, uploadProductImage.single('image'), (req, res) => {
  const { name, description, creative_text, price, category_id, status, priority, badge, specs } = req.body;
  const image_url = req.file ? `/uploads/products/${req.file.filename}` : '/images/placeholder-product.jpg';
  const suppliers = buildSuppliersJson(req.body);

  db.prepare(`
    INSERT INTO products (name, description, creative_text, price, category_id, status, priority, badge, image_url, specs, suppliers)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, description, creative_text, parseFloat(price), category_id || null, status || 'disponivel',
    priority ? 1 : 0, badge || null, image_url, specs || '{}', suppliers);

  req.flash('success', 'Produto criado com sucesso!');
  res.redirect('/admin/produtos');
});

router.post('/produtos/:id', requireAuth, uploadProductImage.single('image'), (req, res) => {
  const { name, description, creative_text, price, category_id, status, priority, badge, specs } = req.body;
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) {
    req.flash('error', 'Produto não encontrado.');
    return res.redirect('/admin/produtos');
  }

  const image_url = req.file ? `/uploads/products/${req.file.filename}` : product.image_url;
  const suppliers = buildSuppliersJson(req.body);

  db.prepare(`
    UPDATE products
    SET name=?, description=?, creative_text=?, price=?, category_id=?, status=?,
        priority=?, badge=?, image_url=?, specs=?, suppliers=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(name, description, creative_text, parseFloat(price), category_id || null,
    status, priority ? 1 : 0, badge || null, image_url, specs || '{}', suppliers, req.params.id);

  req.flash('success', 'Produto atualizado!');
  res.redirect('/admin/produtos');
});

router.post('/produtos/:id/status', requireAuth, (req, res) => {
  const { status } = req.body;
  const allowed = ['disponivel', 'reservado', 'comprado'];
  if (!allowed.includes(status)) return res.redirect('/admin/produtos');
  db.prepare('UPDATE products SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status, req.params.id);
  res.redirect('/admin/produtos');
});

router.post('/produtos/:id/excluir', requireAuth, (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  req.flash('success', 'Produto excluído.');
  res.redirect('/admin/produtos');
});

// ────────────────────────────────────────────────
// COMPROVANTES
// ────────────────────────────────────────────────
router.get('/comprovantes', requireAuth, (req, res) => {
  const settings = getAllSettings();
  const receipts = db.prepare(`
    SELECT r.*, p.name as product_name, p.price as product_price
    FROM receipts r
    JOIN products p ON r.product_id = p.id
    ORDER BY CASE r.status WHEN 'aguardando' THEN 0 WHEN 'aprovado' THEN 1 ELSE 2 END, r.created_at DESC
  `).all();
  res.render('admin/receipts', { settings, receipts, flash: req.flash(), page: 'admin-receipts' });
});

router.post('/comprovantes/:id/aprovar', requireAuth, (req, res) => {
  const receipt = db.prepare('SELECT * FROM receipts WHERE id = ?').get(req.params.id);
  if (!receipt) {
    req.flash('error', 'Comprovante não encontrado.');
    return res.redirect('/admin/comprovantes');
  }

  db.prepare(`
    UPDATE receipts SET status='aprovado', reviewed_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(req.params.id);

  db.prepare(`
    UPDATE products SET status='comprado', updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(receipt.product_id);

  req.flash('success', 'Comprovante aprovado! Produto marcado como comprado.');
  res.redirect('/admin/comprovantes');
});

router.post('/comprovantes/:id/rejeitar', requireAuth, (req, res) => {
  const receipt = db.prepare('SELECT * FROM receipts WHERE id = ?').get(req.params.id);
  if (!receipt) {
    req.flash('error', 'Comprovante não encontrado.');
    return res.redirect('/admin/comprovantes');
  }

  const { admin_notes } = req.body;

  db.prepare(`
    UPDATE receipts SET status='rejeitado', admin_notes=?, reviewed_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(admin_notes || null, req.params.id);

  db.prepare(`
    UPDATE products SET status='disponivel', updated_at=CURRENT_TIMESTAMP
    WHERE id=? AND status='aguardando_validacao'
  `).run(receipt.product_id);

  req.flash('success', 'Comprovante rejeitado. Produto disponível novamente.');
  res.redirect('/admin/comprovantes');
});

// ────────────────────────────────────────────────
// CONTRIBUIÇÕES
// ────────────────────────────────────────────────
router.get('/contribuicoes', requireAuth, (req, res) => {
  const settings = getAllSettings();
  const contributions = db.prepare(`
    SELECT c.*, p.name as product_name
    FROM contributions c
    LEFT JOIN products p ON c.product_id = p.id
    ORDER BY c.created_at DESC
  `).all();

  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN payment_status='confirmado' THEN amount ELSE 0 END),0) as confirmado,
      COALESCE(SUM(CASE WHEN payment_status='pendente' THEN amount ELSE 0 END),0) as pendente,
      COALESCE(SUM(CASE WHEN payment_status='cancelado' THEN amount ELSE 0 END),0) as cancelado,
      COUNT(CASE WHEN payment_status='cancelado' THEN 1 END) as cancelado_count
    FROM contributions
  `).get();

  res.render('admin/contributions', { settings, contributions, totals, flash: req.flash(), page: 'admin-contributions' });
});

router.post('/contribuicoes/:id/confirmar', requireAuth, (req, res) => {
  db.prepare(`
    UPDATE contributions
    SET payment_status='confirmado', confirmed_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(req.params.id);
  req.flash('success', 'Contribuição confirmada!');
  res.redirect('/admin/contribuicoes');
});

router.post('/contribuicoes/:id/cancelar', requireAuth, (req, res) => {
  db.prepare(`
    UPDATE contributions
    SET payment_status='cancelado'
    WHERE id=?
  `).run(req.params.id);
  req.flash('success', 'Contribuição marcada como cancelada.');
  res.redirect('/admin/contribuicoes');
});

router.post('/contribuicoes/:id/excluir', requireAuth, (req, res) => {
  db.prepare('DELETE FROM contributions WHERE id=?').run(req.params.id);
  req.flash('success', 'Contribuição excluída.');
  res.redirect('/admin/contribuicoes');
});

// Adicionar contribuição manual
router.post('/contribuicoes', requireAuth, (req, res) => {
  const { name, phone, email, amount, message } = req.body;
  db.prepare(`
    INSERT INTO contributions (name, phone, email, amount, payment_status, message, confirmed_at)
    VALUES (?, ?, ?, ?, 'confirmado', ?, CURRENT_TIMESTAMP)
  `).run(name, phone, email || null, parseFloat(amount), message || null);
  req.flash('success', 'Contribuição registrada com sucesso!');
  res.redirect('/admin/contribuicoes');
});

// ────────────────────────────────────────────────
// SORTEIO ADMIN
// ────────────────────────────────────────────────
router.get('/sorteio', requireAuth, (req, res) => {
  const settings = getAllSettings();
  const numbers = db.prepare('SELECT * FROM raffle_numbers ORDER BY number ASC').all();
  const totals = db.prepare(`
    SELECT
      COUNT(*) as total,
      COALESCE(SUM(CASE WHEN status='pago' THEN amount ELSE 0 END),0) as arrecadado,
      COUNT(CASE WHEN status='pago' THEN 1 END) as pagos
    FROM raffle_numbers
    WHERE status != 'cancelado'
  `).get();
  res.render('admin/raffle', { settings, numbers, totals, flash: req.flash(), page: 'admin-raffle' });
});

router.post('/sorteio/:id/confirmar', requireAuth, (req, res) => {
  db.prepare(`
    UPDATE raffle_numbers
    SET status='pago', payment_status='confirmado', paid_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(req.params.id);
  req.flash('success', 'Pagamento do sorteio confirmado!');
  res.redirect('/admin/sorteio');
});

router.post('/sorteio/:id/cancelar', requireAuth, (req, res) => {
  db.prepare(`
    UPDATE raffle_numbers SET status='cancelado', payment_status='cancelado' WHERE id=?
  `).run(req.params.id);
  req.flash('success', 'Número cancelado e liberado.');
  res.redirect('/admin/sorteio');
});

// ────────────────────────────────────────────────
// CONFIGURAÇÕES
// ────────────────────────────────────────────────
router.get('/configuracoes', requireAuth, (req, res) => {
  const settings = getAllSettings();
  res.render('admin/settings', { settings, flash: req.flash(), page: 'admin-settings' });
});

router.post('/configuracoes', requireAuth, (req, res) => {
  const { meta_total, mercadopago_link, whatsapp_number, raffle_price_per_number, popup_enabled, goal_calculation } = req.body;

  const updates = {
    meta_total, mercadopago_link, whatsapp_number,
    raffle_price_per_number, popup_enabled: popup_enabled ? '1' : '0', goal_calculation
  };

  const upsert = db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP
  `);

  const updateMany = db.transaction((obj) => {
    for (const [key, val] of Object.entries(obj)) {
      if (val !== undefined) upsert.run(key, String(val));
    }
  });

  updateMany(updates);
  req.flash('success', 'Configurações salvas!');
  res.redirect('/admin/configuracoes');
});

// Categorias
router.get('/categorias', requireAuth, (req, res) => {
  const settings = getAllSettings();
  const categories = db.prepare('SELECT * FROM categories ORDER BY name').all();
  res.render('admin/categories', { settings, categories, flash: req.flash(), page: 'admin-categories' });
});

router.post('/categorias', requireAuth, (req, res) => {
  const { name, slug, icon } = req.body;
  try {
    db.prepare('INSERT INTO categories (name, slug, icon) VALUES (?, ?, ?)').run(name, slug, icon || '🎁');
    req.flash('success', 'Categoria criada!');
  } catch (e) {
    req.flash('error', 'Já existe uma categoria com esse nome ou slug.');
  }
  res.redirect('/admin/categorias');
});

router.post('/categorias/:id/excluir', requireAuth, (req, res) => {
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  req.flash('success', 'Categoria excluída.');
  res.redirect('/admin/categorias');
});

// ────────────────────────────────────────────────
// OBRA / CONSTRUÇÃO
// ────────────────────────────────────────────────
router.get('/obra', requireAuth, (req, res) => {
  const settings = getAllSettings();
  const stages = db.prepare('SELECT * FROM construction_stages ORDER BY sort_order ASC').all();
  res.render('admin/construction', { settings, stages, flash: req.flash(), page: 'admin-construction' });
});

router.post('/obra', requireAuth, (req, res) => {
  const { overall, delivery_date, last_update, stage_id, stage_percentage } = req.body;
  const upsert = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`);
  if (overall !== undefined) upsert.run('construction_overall', String(parseFloat(overall) || 0));
  if (delivery_date) upsert.run('delivery_date', delivery_date);
  if (last_update) upsert.run('construction_last_update', last_update);

  const ids = [].concat(stage_id || []);
  const pcts = [].concat(stage_percentage || []);
  const updateStage = db.prepare('UPDATE construction_stages SET percentage=?, updated_at=CURRENT_TIMESTAMP WHERE id=?');
  ids.forEach((id, i) => {
    const pct = parseFloat(pcts[i]);
    if (!isNaN(pct)) updateStage.run(Math.min(100, Math.max(0, pct)), id);
  });

  req.flash('success', 'Andamento da obra atualizado!');
  res.redirect('/admin/obra');
});

module.exports = router;
