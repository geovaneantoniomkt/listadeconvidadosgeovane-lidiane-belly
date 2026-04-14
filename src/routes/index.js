// ================================================
// ROTAS PÚBLICAS DO SITE
// ================================================
const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { uploadReceipt } = require('../middleware/upload');

// Helper para buscar configurações
function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  return settings;
}

// Helper para calcular progresso da meta
function getGoalProgress(settings) {
  const metaTotal = parseFloat(settings.meta_total || 15000);

  // Contribuições confirmadas em dinheiro
  const contrib = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM contributions
    WHERE payment_status = 'confirmado'
  `).get();

  // Valor de itens comprados
  const purchased = db.prepare(`
    SELECT COALESCE(SUM(price), 0) as total
    FROM products
    WHERE status = 'comprado'
  `).get();

  // Sorteio arrecadado
  const raffle = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM raffle_numbers
    WHERE payment_status = 'confirmado'
  `).get();

  const totalMoney = contrib.total + raffle.total;
  const totalImpact = totalMoney + purchased.total;
  const percentMoney = Math.min(100, Math.round((totalMoney / metaTotal) * 100));
  const percentTotal = Math.min(100, Math.round((totalImpact / metaTotal) * 100));

  return {
    metaTotal,
    totalMoney,
    totalImpact,
    percentMoney,
    percentTotal,
    faltaMoney: Math.max(0, metaTotal - totalMoney),
    faltaTotal: Math.max(0, metaTotal - totalImpact),
  };
}

// ────────────────────────────────────────────────
// HOME
// ────────────────────────────────────────────────
router.get('/', (req, res) => {
  const settings = getAllSettings();
  const goal = getGoalProgress(settings);

  const featured = db.prepare(`
    SELECT p.*, c.name as category_name, c.icon as category_icon
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.priority = 1 AND p.status != 'comprado'
    ORDER BY p.created_at DESC
    LIMIT 6
  `).all();

  const stats = {
    total: db.prepare("SELECT COUNT(*) as n FROM products").get().n,
    purchased: db.prepare("SELECT COUNT(*) as n FROM products WHERE status = 'comprado'").get().n,
    contributors: db.prepare("SELECT COUNT(*) as n FROM contributions WHERE payment_status = 'confirmado'").get().n,
    raffleNumbers: db.prepare("SELECT COUNT(*) as n FROM raffle_numbers WHERE payment_status = 'confirmado'").get().n,
  };

  res.render('pages/home', { settings, goal, featured, stats, page: 'home' });
});

// ────────────────────────────────────────────────
// NOSSA HISTÓRIA
// ────────────────────────────────────────────────
router.get('/nossa-historia', (req, res) => {
  const settings = getAllSettings();
  res.render('pages/history', { settings, page: 'history' });
});

// ────────────────────────────────────────────────
// LISTA DE PRESENTES
// ────────────────────────────────────────────────
router.get('/presentes', (req, res) => {
  const settings = getAllSettings();
  const { categoria, busca, ordem, status: filterStatus } = req.query;

  let query = `
    SELECT p.*, c.name as category_name, c.icon as category_icon
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (categoria) {
    query += ' AND c.slug = ?';
    params.push(categoria);
  }
  if (busca) {
    query += ' AND (p.name LIKE ? OR p.description LIKE ?)';
    params.push(`%${busca}%`, `%${busca}%`);
  }
  if (filterStatus) {
    query += ' AND p.status = ?';
    params.push(filterStatus);
  }

  const ordemMap = {
    'prioridade': 'p.priority DESC, p.price DESC',
    'menor-preco': 'p.price ASC',
    'maior-preco': 'p.price DESC',
    'nome': 'p.name ASC',
  };
  query += ` ORDER BY ${ordemMap[ordem] || 'p.priority DESC, p.created_at DESC'}`;

  const products = db.prepare(query).all(...params);
  const categories = db.prepare('SELECT * FROM categories ORDER BY name').all();

  const statusCounts = {
    disponivel: db.prepare("SELECT COUNT(*) as n FROM products WHERE status = 'disponivel'").get().n,
    reservado: db.prepare("SELECT COUNT(*) as n FROM products WHERE status = 'reservado'").get().n,
    comprado: db.prepare("SELECT COUNT(*) as n FROM products WHERE status = 'comprado'").get().n,
  };

  res.render('pages/gifts', {
    settings, products, categories, statusCounts,
    filters: { categoria, busca, ordem, status: filterStatus },
    page: 'gifts'
  });
});

// ────────────────────────────────────────────────
// PRODUTO INDIVIDUAL
// ────────────────────────────────────────────────
router.get('/presentes/:id', (req, res) => {
  const settings = getAllSettings();
  const product = db.prepare(`
    SELECT p.*, c.name as category_name, c.icon as category_icon
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.id = ?
  `).get(req.params.id);

  if (!product) {
    return res.status(404).render('pages/404', { settings, page: '404' });
  }

  // Parse JSON fields
  try { product.specs = JSON.parse(product.specs || '{}'); } catch { product.specs = {}; }
  try { product.suppliers = JSON.parse(product.suppliers || '[]'); } catch { product.suppliers = []; }

  const related = db.prepare(`
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.category_id = ? AND p.id != ? AND p.status != 'comprado'
    LIMIT 3
  `).all(product.category_id, product.id);

  res.render('pages/product', {
    settings, product, related, page: 'gifts',
    flash: req.flash()
  });
});

// ────────────────────────────────────────────────
// ENVIO DE COMPROVANTE
// ────────────────────────────────────────────────
router.post('/presentes/:id/comprovante', uploadReceipt.single('comprovante'), (req, res) => {
  const productId = req.params.id;
  const { name, phone, email, notes } = req.body;

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  if (!product) {
    return res.status(404).json({ error: 'Produto não encontrado.' });
  }

  if (!req.file) {
    req.flash('error', 'Arquivo de comprovante não enviado.');
    return res.redirect(`/presentes/${productId}`);
  }

  if (!name || !phone) {
    req.flash('error', 'Nome e telefone são obrigatórios.');
    return res.redirect(`/presentes/${productId}`);
  }

  // Insere o comprovante
  db.prepare(`
    INSERT INTO receipts (product_id, name, phone, email, file_path, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, 'aguardando')
  `).run(productId, name.trim(), phone.trim(), email?.trim() || null, req.file.path, notes?.trim() || null);

  // Atualiza status do produto para aguardando validação
  db.prepare(`
    UPDATE products SET status = 'aguardando_validacao', updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'disponivel'
  `).run(productId);

  res.redirect(`/obrigado?tipo=comprovante&nome=${encodeURIComponent(name)}`);
});

// ────────────────────────────────────────────────
// META DA FAMÍLIA
// ────────────────────────────────────────────────
router.get('/meta', (req, res) => {
  const settings = getAllSettings();
  const goal = getGoalProgress(settings);

  const contributors = db.prepare(`
    SELECT name, amount, message, confirmed_at
    FROM contributions
    WHERE payment_status = 'confirmado'
    ORDER BY confirmed_at DESC
    LIMIT 20
  `).all();

  res.render('pages/goal', { settings, goal, contributors, page: 'goal' });
});

// ────────────────────────────────────────────────
// SORTEIO
// ────────────────────────────────────────────────
router.get('/sorteio', (req, res) => {
  const settings = getAllSettings();
  const takenNumbers = db.prepare(`
    SELECT number, status FROM raffle_numbers
    WHERE status IN ('reservado', 'pago')
  `).all();

  const takenMap = {};
  takenNumbers.forEach(n => { takenMap[n.number] = n.status; });

  const stats = {
    total: db.prepare('SELECT COUNT(*) as n FROM raffle_numbers').get().n,
    sold: db.prepare("SELECT COUNT(*) as n FROM raffle_numbers WHERE status = 'pago'").get().n,
    available: 1001 - db.prepare('SELECT COUNT(*) as n FROM raffle_numbers').get().n,
  };

  res.render('pages/raffle', {
    settings,
    takenNumbers: takenMap,
    pricePerNumber: parseFloat(getSetting('raffle_price_per_number') || 10),
    stats,
    page: 'raffle',
    flash: req.flash()
  });
});

// POST — Reservar números do sorteio
router.post('/sorteio/reservar', (req, res) => {
  const { name, phone, email, numbers } = req.body;

  if (!name || !phone || !numbers) {
    req.flash('error', 'Preencha todos os campos obrigatórios.');
    return res.redirect('/sorteio');
  }

  const selectedNumbers = Array.isArray(numbers) ? numbers.map(Number) : [Number(numbers)];
  const pricePerNumber = parseFloat(getSetting('raffle_price_per_number') || 10);
  const totalAmount = selectedNumbers.length * pricePerNumber;

  // Verificar se algum número já foi pego
  const conflicts = selectedNumbers.filter(n => {
    const existing = db.prepare('SELECT id FROM raffle_numbers WHERE number = ?').get(n);
    return !!existing;
  });

  if (conflicts.length > 0) {
    req.flash('error', `Os números ${conflicts.join(', ')} já foram escolhidos. Por favor, selecione outros.`);
    return res.redirect('/sorteio');
  }

  // Reserva temporária dos números
  const insertRaffle = db.prepare(`
    INSERT INTO raffle_numbers (number, name, phone, email, status, amount, payment_status)
    VALUES (?, ?, ?, ?, 'reservado', ?, 'pendente')
  `);

  const insertMany = db.transaction((nums) => {
    for (const n of nums) {
      insertRaffle.run(n, name.trim(), phone.trim(), email?.trim() || null, pricePerNumber);
    }
  });

  try {
    insertMany(selectedNumbers);
  } catch (err) {
    req.flash('error', 'Alguns números já foram reservados simultaneamente. Por favor, tente novamente.');
    return res.redirect('/sorteio');
  }

  // Redireciona para pagamento (Mercado Pago)
  const mpLink = getSetting('mercadopago_link') || '#';
  const redirectUrl = mpLink !== '#'
    ? `${mpLink}?amount=${totalAmount}`
    : `/obrigado?tipo=sorteio&nome=${encodeURIComponent(name)}&qtd=${selectedNumbers.length}&total=${totalAmount}`;

  res.redirect(redirectUrl);
});

// ────────────────────────────────────────────────
// PÁGINA DE AGRADECIMENTO
// ────────────────────────────────────────────────
router.get('/obrigado', (req, res) => {
  const settings = getAllSettings();
  const { tipo, nome, qtd, total } = req.query;
  res.render('pages/thanks', { settings, tipo, nome, qtd, total, page: 'thanks' });
});

// ────────────────────────────────────────────────
// API — dados de progresso em tempo real
// ────────────────────────────────────────────────
router.get('/api/goal', (req, res) => {
  const settings = getAllSettings();
  const goal = getGoalProgress(settings);
  res.json(goal);
});

router.get('/api/raffle-numbers', (req, res) => {
  const taken = db.prepare(`
    SELECT number, status FROM raffle_numbers WHERE status IN ('reservado','pago')
  `).all();
  const map = {};
  taken.forEach(n => { map[n.number] = n.status; });
  res.json(map);
});

// 404 personalizado
router.use((req, res) => {
  const settings = getAllSettings();
  res.status(404).render('pages/404', { settings, page: '404' });
});

module.exports = router;
