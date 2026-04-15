// ================================================
// CONFIGURAÇÃO DO BANCO DE DADOS SQLite
// ================================================
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/casa-nova.db');

// Garante que o diretório data existe
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Habilita WAL mode para melhor performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ================================================
// CRIAÇÃO DAS TABELAS
// ================================================
function initializeDatabase() {
  db.exec(`
    -- Categorias de produtos
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      icon TEXT DEFAULT '🎁',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Produtos da lista de presentes
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      creative_text TEXT,
      price REAL NOT NULL,
      category_id INTEGER REFERENCES categories(id),
      status TEXT DEFAULT 'disponivel' CHECK(status IN ('disponivel','reservado','aguardando_validacao','comprado')),
      priority INTEGER DEFAULT 0,
      badge TEXT,
      image_url TEXT,
      specs TEXT,
      suppliers TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Contribuições via Mercado Pago
    CREATE TABLE IF NOT EXISTS contributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      amount REAL NOT NULL,
      product_id INTEGER REFERENCES products(id),
      payment_method TEXT,
      payment_status TEXT DEFAULT 'pendente' CHECK(payment_status IN ('pendente','confirmado','cancelado')),
      mercadopago_id TEXT,
      message TEXT,
      confirmed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Comprovantes enviados pelos convidados
    CREATE TABLE IF NOT EXISTS receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id),
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      file_path TEXT NOT NULL,
      notes TEXT,
      status TEXT DEFAULT 'aguardando' CHECK(status IN ('aguardando','aprovado','rejeitado')),
      admin_notes TEXT,
      reviewed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Números do sorteio
    CREATE TABLE IF NOT EXISTS raffle_numbers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      status TEXT DEFAULT 'reservado' CHECK(status IN ('reservado','pago','cancelado')),
      amount REAL NOT NULL,
      payment_status TEXT DEFAULT 'pendente' CHECK(payment_status IN ('pendente','confirmado','cancelado')),
      mercadopago_id TEXT,
      reserved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      paid_at DATETIME
    );

    -- Configurações do site
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Índices para performance
    CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_receipts_product ON receipts(product_id);
    CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status);
    CREATE INDEX IF NOT EXISTS idx_raffle_status ON raffle_numbers(status);
    CREATE INDEX IF NOT EXISTS idx_contributions_status ON contributions(payment_status);
  `);

  // Configurações padrão (INSERT OR IGNORE — não sobrescreve valores já salvos)
  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
  `);
  const updateSetting = db.prepare(`
    UPDATE settings SET value = ? WHERE key = ?
  `);

  insertSetting.run('meta_total', process.env.META_TOTAL || '15000');
  insertSetting.run('raffle_price_per_number', '10');
  insertSetting.run('mercadopago_link', process.env.MERCADOPAGO_LINK_CONTRIBUICAO || '#');
  insertSetting.run('whatsapp_number', process.env.WHATSAPP_NUMBER || '5519999833068');
  insertSetting.run('site_title', 'Casa Nova Geovane & Lidiane');
  insertSetting.run('site_description', 'Nossa lista de presentes de casa nova. Cada presente é um pedacinho do nosso lar.');
  insertSetting.run('familia_historia', 'Éramos só um casal apaixonado e um sonho grande. Hoje, somos três — e esse lar que estamos construindo tem o cheirinho da Belly e o tempero do nosso amor...');
  insertSetting.run('popup_enabled', '1');
  insertSetting.run('goal_calculation', 'total');

  // Sempre sincroniza ENV vars críticas com o banco (garante que Railway ENV tenha prioridade)
  if (process.env.MERCADOPAGO_LINK_CONTRIBUICAO) {
    updateSetting.run(process.env.MERCADOPAGO_LINK_CONTRIBUICAO, 'mercadopago_link');
  }
  if (process.env.META_TOTAL) {
    updateSetting.run(process.env.META_TOTAL, 'meta_total');
  }
  if (process.env.WHATSAPP_NUMBER) {
    updateSetting.run(process.env.WHATSAPP_NUMBER, 'whatsapp_number');
  } else {
    updateSetting.run('5519999833068', 'whatsapp_number');
  }

  console.log('✅ Banco de dados inicializado com sucesso.');
}

initializeDatabase();

module.exports = db;
