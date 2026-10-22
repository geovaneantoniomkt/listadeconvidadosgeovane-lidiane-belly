// ================================================
// ROTAS PÚBLICAS DO SITE
// ================================================
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const db = require('../database/db');
const { uploadReceipt } = require('../middleware/upload');

// Fotos e vídeos da obra para o carrossel da home: arquivos AAAA-MM em
// public/images/obra, do mais recente para o mais antigo. Para incluir um mês,
// basta adicionar o arquivo. Vídeo (.mp4) usa AAAA-MM-capa.* como capa.
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function listConstructionMedia() {
  try {
    const files = fs.readdirSync(path.join(__dirname, '../../public/images/obra'));
    return files
      .map(file => file.match(/^(\d{4})-(0[1-9]|1[0-2])\.(webp|jpe?g|png|mp4)$/i))
      .filter(Boolean)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(m => {
        const label = `${MESES[parseInt(m[2], 10) - 1]}/${m[1]}`;
        if (m[3].toLowerCase() !== 'mp4') return { type: 'foto', src: `/images/obra/${m[0]}`, label };
        const capa = files.find(file => file.startsWith(`${m[1]}-${m[2]}-capa.`));
        return { type: 'video', src: `/images/obra/${m[0]}`, poster: capa ? `/images/obra/${capa}` : null, label };
      });
  } catch {
    return [];
  }
}

// Os arquivos só mudam a cada deploy: lê uma vez ao iniciar
const constructionMedia = listConstructionMedia();

// Helper: busca uma configuração
async function getSetting(key) {
  const row = await db.get('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? row.value : null;
}

// Helper: busca todas as configurações como objeto
async function getAllSettings() {
  const rows = await db.all('SELECT key, value FROM settings');
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  return settings;
}

// Helper: calcula progresso da meta
async function getGoalProgress(settings) {
  const metaTotal = parseFloat(settings.meta_total || 15000);

  const contrib   = await db.get(`SELECT COALESCE(SUM(amount),0) as total FROM contributions   WHERE payment_status = 'confirmado'`);
  const purchased = await db.get(`SELECT COALESCE(SUM(price),0)  as total FROM products         WHERE status = 'comprado'`);
  const raffle    = await db.get(`SELECT COALESCE(SUM(amount),0) as total FROM raffle_numbers   WHERE payment_status = 'confirmado'`);

  const totalMoney  = (contrib.total   || 0) + (raffle.total || 0);
  const totalImpact = totalMoney + (purchased.total || 0);

  return {
    metaTotal,
    totalMoney,
    totalImpact,
    percentMoney:  Math.min(100, Math.round((totalMoney  / metaTotal) * 100)),
    percentTotal:  Math.min(100, Math.round((totalImpact / metaTotal) * 100)),
    faltaMoney:    Math.max(0, metaTotal - totalMoney),
    faltaTotal:    Math.max(0, metaTotal - totalImpact),
  };
}

// Helper: libera reservas expiradas do sorteio (>30 min sem pagamento)
async function liberarReservasExpiradas() {
  await db.run(`
    DELETE FROM raffle_numbers
    WHERE status = 'reservado'
    AND payment_status = 'pendente'
    AND reserved_at < NOW() - INTERVAL '30 minutes'
  `);
}

// ────────────────────────────────────────────────
// HOME
// ────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const settings = await getAllSettings();
    const goal     = await getGoalProgress(settings);

    const featured = await db.all(`
      SELECT p.*, c.name as category_name, c.icon as category_icon
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.priority = 1 AND p.status != 'comprado'
      ORDER BY p.created_at DESC
      LIMIT 6
    `);

    const [total, purchased, contributors, raffleNumbers] = await Promise.all([
      db.get("SELECT COUNT(*) as n FROM products"),
      db.get("SELECT COUNT(*) as n FROM products WHERE status = 'comprado'"),
      db.get("SELECT COUNT(*) as n FROM contributions WHERE payment_status = 'confirmado'"),
      db.get("SELECT COUNT(*) as n FROM raffle_numbers WHERE payment_status = 'confirmado'"),
    ]);

    const stats = {
      total:         total.n,
      purchased:     purchased.n,
      contributors:  contributors.n,
      raffleNumbers: raffleNumbers.n,
    };

    const constructionStages = await db.all('SELECT * FROM construction_stages ORDER BY sort_order ASC');

    res.render('pages/home', { settings, goal, featured, stats, constructionStages, constructionMedia, page: 'home' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro interno');
  }
});

// ────────────────────────────────────────────────
// NOSSA HISTÓRIA
// ────────────────────────────────────────────────
router.get('/nossa-historia', async (req, res) => {
  try {
    const settings = await getAllSettings();
    res.render('pages/history', { settings, page: 'history' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro interno');
  }
});

// ────────────────────────────────────────────────
// LISTA DE PRESENTES
// ────────────────────────────────────────────────
router.get('/presentes', async (req, res) => {
  try {
    const settings = await getAllSettings();
    const { categoria, busca, ordem, status: filterStatus } = req.query;

    let query  = `
      SELECT p.*, c.name as category_name, c.icon as category_icon
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (categoria) { query += ' AND c.slug = ?';                                params.push(categoria); }
    if (busca)     { query += ' AND (p.name ILIKE ? OR p.description ILIKE ?)'; params.push(`%${busca}%`, `%${busca}%`); }
    if (filterStatus) { query += ' AND p.status = ?';                           params.push(filterStatus); }

    const ordemMap = {
      'prioridade':  'p.priority DESC, p.price DESC',
      'menor-preco': 'p.price ASC',
      'maior-preco': 'p.price DESC',
      'nome':        'p.name ASC',
    };
    query += ` ORDER BY ${ordemMap[ordem] || 'p.priority DESC, p.created_at DESC'}`;

    const [products, categories] = await Promise.all([
      db.all(query, params),
      db.all('SELECT * FROM categories ORDER BY name'),
    ]);

    const [disponivel, reservado, comprado] = await Promise.all([
      db.get("SELECT COUNT(*) as n FROM products WHERE status = 'disponivel'"),
      db.get("SELECT COUNT(*) as n FROM products WHERE status = 'reservado'"),
      db.get("SELECT COUNT(*) as n FROM products WHERE status = 'comprado'"),
    ]);

    const statusCounts = {
      disponivel: disponivel.n,
      reservado:  reservado.n,
      comprado:   comprado.n,
    };

    res.render('pages/gifts', {
      settings, products, categories, statusCounts,
      filters: { categoria, busca, ordem, status: filterStatus },
      page: 'gifts'
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro interno');
  }
});

// ────────────────────────────────────────────────
// PRODUTO INDIVIDUAL
// ────────────────────────────────────────────────
router.get('/presentes/:id', async (req, res) => {
  try {
    const settings = await getAllSettings();
    const product  = await db.get(`
      SELECT p.*, c.name as category_name, c.icon as category_icon
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `, [req.params.id]);

    if (!product) return res.status(404).render('pages/404', { settings, page: '404' });

    try { product.specs     = JSON.parse(product.specs     || '{}'); } catch { product.specs = {}; }
    try { product.suppliers = JSON.parse(product.suppliers || '[]'); } catch { product.suppliers = []; }

    const related = await db.all(`
      SELECT p.*, c.name as category_name, c.icon as category_icon
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.category_id = ? AND p.id != ? AND p.status != 'comprado'
      LIMIT 3
    `, [product.category_id, product.id]);

    res.render('pages/product', { settings, product, related, page: 'gifts', flash: req.flash() });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro interno');
  }
});

// ────────────────────────────────────────────────
// ENVIO DE COMPROVANTE
// ────────────────────────────────────────────────
router.post('/presentes/:id/comprovante', uploadReceipt.single('comprovante'), async (req, res) => {
  try {
    const productId = req.params.id;
    const { name, phone, email, notes } = req.body;

    const product = await db.get('SELECT * FROM products WHERE id = ?', [productId]);
    if (!product) return res.status(404).json({ error: 'Produto não encontrado.' });

    if (!req.file) {
      req.flash('error', 'Arquivo de comprovante não enviado.');
      return res.redirect(`/presentes/${productId}`);
    }
    if (!name || !phone) {
      req.flash('error', 'Nome e telefone são obrigatórios.');
      return res.redirect(`/presentes/${productId}`);
    }

    await db.run(
      `INSERT INTO receipts (product_id, name, phone, email, file_path, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, 'aguardando')`,
      [productId, name.trim(), phone.trim(), email?.trim() || null, req.file.path, notes?.trim() || null]
    );

    await db.run(
      `UPDATE products SET status = 'aguardando_validacao', updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'disponivel'`,
      [productId]
    );

    res.redirect(`/obrigado?tipo=comprovante&nome=${encodeURIComponent(name)}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro interno');
  }
});

// ────────────────────────────────────────────────
// META DA FAMÍLIA
// ────────────────────────────────────────────────
router.get('/meta', async (req, res) => {
  try {
    const settings     = await getAllSettings();
    const goal         = await getGoalProgress(settings);
    const contributors = await db.all(`
      SELECT name, amount, message, confirmed_at
      FROM contributions
      WHERE payment_status = 'confirmado'
      ORDER BY confirmed_at DESC
      LIMIT 20
    `);
    res.render('pages/goal', { settings, goal, contributors, page: 'goal' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro interno');
  }
});

// ────────────────────────────────────────────────
// SORTEIO
// ────────────────────────────────────────────────
router.get('/sorteio', async (req, res) => {
  try {
    await liberarReservasExpiradas();
    const settings     = await getAllSettings();
    const takenNumbers = await db.all(`
      SELECT number, status FROM raffle_numbers WHERE status IN ('reservado', 'pago')
    `);
    const takenMap = {};
    takenNumbers.forEach(n => { takenMap[n.number] = n.status; });

    const [sold, reserved, taken] = await Promise.all([
      db.get("SELECT COUNT(*) as n FROM raffle_numbers WHERE status = 'pago'"),
      db.get("SELECT COUNT(*) as n FROM raffle_numbers WHERE status = 'reservado'"),
      db.get("SELECT COUNT(*) as n FROM raffle_numbers WHERE status != 'cancelado'"),
    ]);

    const stats = {
      sold:      sold.n,
      reserved:  reserved.n,
      available: 1001 - taken.n,
    };

    res.render('pages/raffle', {
      settings,
      takenNumbers: takenMap,
      pricePerNumber: parseFloat(await getSetting('raffle_price_per_number') || 10),
      stats,
      page: 'raffle',
      flash: req.flash()
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro interno');
  }
});

// POST — Reservar números do sorteio
router.post('/sorteio/reservar', async (req, res) => {
  try {
    await liberarReservasExpiradas();
    const { name, phone, email, numbers } = req.body;

    if (!name || !phone || !numbers) {
      req.flash('error', 'Preencha todos os campos obrigatórios.');
      return res.redirect('/sorteio');
    }

    const selectedNumbers  = Array.isArray(numbers) ? numbers.map(Number) : [Number(numbers)];
    const pricePerNumber   = parseFloat(await getSetting('raffle_price_per_number') || 10);
    const totalAmount      = selectedNumbers.length * pricePerNumber;

    // Verifica conflitos
    const checks  = await Promise.all(selectedNumbers.map(n => db.get('SELECT id FROM raffle_numbers WHERE number = ?', [n])));
    const conflicts = selectedNumbers.filter((n, i) => !!checks[i]);

    if (conflicts.length > 0) {
      req.flash('error', `Os números ${conflicts.join(', ')} já foram escolhidos. Por favor, selecione outros.`);
      return res.redirect('/sorteio');
    }

    // Insere em transação
    await db.transaction(async (tx) => {
      for (const n of selectedNumbers) {
        await tx.run(
          `INSERT INTO raffle_numbers (number, name, phone, email, status, amount, payment_status, reserved_at)
           VALUES (?, ?, ?, ?, 'reservado', ?, 'pendente', CURRENT_TIMESTAMP)`,
          [n, name.trim(), phone.trim(), email?.trim() || null, pricePerNumber]
        );
      }
    });

    res.redirect(
      `/sorteio/pagar?nome=${encodeURIComponent(name.trim())}&phone=${encodeURIComponent(phone.trim())}&qtd=${selectedNumbers.length}&total=${totalAmount}&numeros=${selectedNumbers.join(',')}`
    );
  } catch (err) {
    console.error(err);
    req.flash('error', 'Alguns números já foram reservados simultaneamente. Por favor, tente novamente.');
    res.redirect('/sorteio');
  }
});

// GET — Página de pagamento do sorteio
router.get('/sorteio/pagar', async (req, res) => {
  try {
    const { nome, phone, qtd, total, numeros } = req.query;
    const settings = await getAllSettings();
    res.render('pages/raffle-pay', {
      settings, nome, phone,
      qtd:     parseInt(qtd) || 1,
      total:   parseFloat(total) || 0,
      numeros: numeros ? numeros.split(',') : [],
      // Link sempre vem das configurações — nunca da URL
      mpLink:  settings.mercadopago_link || '#',
      page: 'raffle'
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro interno');
  }
});

// ────────────────────────────────────────────────
// CONTRIBUIÇÃO LIVRE
// ────────────────────────────────────────────────
router.get('/contribuir', async (req, res) => {
  try {
    const settings = await getAllSettings();
    res.render('pages/contribute', { settings, page: 'contribute', flash: req.flash() });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro interno');
  }
});

router.post('/contribuir', async (req, res) => {
  try {
    const { name, phone, email, amount, message } = req.body;

    if (!name || !phone || !amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      req.flash('error', 'Preencha nome, telefone e um valor válido.');
      return res.redirect('/contribuir');
    }

    const valor = parseFloat(parseFloat(amount).toFixed(2));

    await db.run(
      `INSERT INTO contributions (name, phone, email, amount, message, payment_method, payment_status)
       VALUES (?, ?, ?, ?, ?, 'pix', 'pendente')`,
      [name.trim(), phone.trim(), email?.trim() || null, valor, message?.trim() || null]
    );

    res.redirect(`/contribuir/pagar?nome=${encodeURIComponent(name.trim())}&valor=${valor}`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro interno');
  }
});

router.get('/contribuir/pagar', async (req, res) => {
  try {
    const { nome, valor } = req.query;
    const settings = await getAllSettings();
    res.render('pages/contribute-pay', {
      settings, nome,
      valor:  parseFloat(valor) || 0,
      mpLink: settings.mercadopago_link || '#',
      page: 'contribute'
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro interno');
  }
});

// ────────────────────────────────────────────────
// AGRADECIMENTO
// ────────────────────────────────────────────────
router.get('/obrigado', async (req, res) => {
  try {
    const settings = await getAllSettings();
    const { tipo, nome, qtd, total } = req.query;
    res.render('pages/thanks', { settings, tipo, nome, qtd, total, page: 'thanks' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro interno');
  }
});

// ────────────────────────────────────────────────
// API
// ────────────────────────────────────────────────
router.get('/api/goal', async (req, res) => {
  try {
    const settings = await getAllSettings();
    const goal     = await getGoalProgress(settings);
    res.json(goal);
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.get('/api/raffle-numbers', async (req, res) => {
  try {
    const taken = await db.all(`SELECT number, status FROM raffle_numbers WHERE status IN ('reservado','pago')`);
    const map = {};
    taken.forEach(n => { map[n.number] = n.status; });
    res.json(map);
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// 404 personalizado
router.use(async (req, res) => {
  try {
    const settings = await getAllSettings();
    res.status(404).render('pages/404', { settings, page: '404' });
  } catch (err) {
    res.status(404).send('Página não encontrada');
  }
});

module.exports = router;
