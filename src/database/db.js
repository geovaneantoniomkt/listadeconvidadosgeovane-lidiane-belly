// ================================================
// CONFIGURAÇÃO DO BANCO DE DADOS — PostgreSQL (Neon)
// ================================================
const { Pool, types } = require('pg');
const { aplicarCargaUnica } = require('./carga-unica');

// Retorna bigint (INT8) como número JS
types.setTypeParser(20, val => parseInt(val, 10));
// Retorna numeric/decimal como float JS
types.setTypeParser(1700, val => parseFloat(val));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Converte placeholders SQLite (?) para PostgreSQL ($1, $2, ...)
function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

const db = {
  // Retorna primeira linha ou null
  async get(sql, params = []) {
    const { rows } = await pool.query(toPg(sql), params);
    return rows[0] || null;
  },

  // Retorna todas as linhas
  async all(sql, params = []) {
    const { rows } = await pool.query(toPg(sql), params);
    return rows;
  },

  // Executa sem retornar linhas
  async run(sql, params = []) {
    await pool.query(toPg(sql), params);
  },

  // Transação — recebe função assíncrona com cliente tx
  async transaction(fn) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const tx = {
        async get(sql, params = []) {
          const { rows } = await client.query(toPg(sql), params);
          return rows[0] || null;
        },
        async run(sql, params = []) {
          await client.query(toPg(sql), params);
        }
      };
      await fn(tx);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
};

// ================================================
// CRIAÇÃO DAS TABELAS
// ================================================
async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id        SERIAL PRIMARY KEY,
      name      TEXT NOT NULL UNIQUE,
      slug      TEXT NOT NULL UNIQUE,
      icon      TEXT DEFAULT '🎁',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id           SERIAL PRIMARY KEY,
      name         TEXT NOT NULL,
      description  TEXT,
      creative_text TEXT,
      price        DECIMAL NOT NULL,
      category_id  INTEGER REFERENCES categories(id),
      status       TEXT DEFAULT 'disponivel'
                   CHECK(status IN ('disponivel','reservado','aguardando_validacao','comprado')),
      priority     INTEGER DEFAULT 0,
      badge        TEXT,
      image_url    TEXT,
      specs        TEXT,
      suppliers    TEXT,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS contributions (
      id              SERIAL PRIMARY KEY,
      name            TEXT NOT NULL,
      phone           TEXT,
      email           TEXT,
      amount          DECIMAL NOT NULL,
      product_id      INTEGER REFERENCES products(id),
      payment_method  TEXT,
      payment_status  TEXT DEFAULT 'pendente'
                      CHECK(payment_status IN ('pendente','confirmado','cancelado')),
      mercadopago_id  TEXT,
      message         TEXT,
      confirmed_at    TIMESTAMP,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS receipts (
      id          SERIAL PRIMARY KEY,
      product_id  INTEGER NOT NULL REFERENCES products(id),
      name        TEXT NOT NULL,
      phone       TEXT NOT NULL,
      email       TEXT,
      file_path   TEXT NOT NULL,
      notes       TEXT,
      status      TEXT DEFAULT 'aguardando'
                  CHECK(status IN ('aguardando','aprovado','rejeitado')),
      admin_notes TEXT,
      reviewed_at TIMESTAMP,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS raffle_numbers (
      id             SERIAL PRIMARY KEY,
      number         INTEGER NOT NULL UNIQUE,
      name           TEXT NOT NULL,
      phone          TEXT NOT NULL,
      email          TEXT,
      status         TEXT DEFAULT 'reservado'
                     CHECK(status IN ('reservado','pago','cancelado')),
      amount         DECIMAL NOT NULL,
      payment_status TEXT DEFAULT 'pendente'
                     CHECK(payment_status IN ('pendente','confirmado','cancelado')),
      mercadopago_id TEXT,
      reserved_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      paid_at        TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS construction_stages (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      percentage DECIMAL DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Índices
  for (const sql of [
    `CREATE INDEX IF NOT EXISTS idx_products_status      ON products(status)`,
    `CREATE INDEX IF NOT EXISTS idx_products_category    ON products(category_id)`,
    `CREATE INDEX IF NOT EXISTS idx_receipts_product     ON receipts(product_id)`,
    `CREATE INDEX IF NOT EXISTS idx_receipts_status      ON receipts(status)`,
    `CREATE INDEX IF NOT EXISTS idx_raffle_status        ON raffle_numbers(status)`,
    `CREATE INDEX IF NOT EXISTS idx_contributions_status ON contributions(payment_status)`,
  ]) {
    await pool.query(sql);
  }

  // Configurações padrão (só insere se não existir)
  for (const [key, value] of [
    ['meta_total',               '20000'],
    ['raffle_price_per_number',  '10'],
    ['mercadopago_link',         '#'],
    ['whatsapp_number',          '5519999833068'],
    ['site_title',               'Casa Nova Geovane & Lidiane'],
    ['site_description',         'Nossa lista de presentes de casa nova. Cada presente é um pedacinho do nosso lar.'],
    ['familia_historia',         'Éramos só um casal apaixonado e um sonho grande. Hoje, somos três — e esse lar que estamos construindo tem o cheirinho da Belly e o tempero do nosso amor...'],
    ['popup_enabled',            '1'],
    ['goal_calculation',         'total'],
    ['delivery_date',            '2027-01-28'],
    ['construction_overall',     '77.32'],
    ['construction_last_update', 'Abril/2026'],
  ]) {
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
      [key, value]
    );
  }

  // Etapas da obra (só insere se a tabela estiver vazia)
  const { rows: [{ count }] } = await pool.query(`SELECT COUNT(*) as count FROM construction_stages`);
  if (parseInt(count) === 0) {
    for (const [name, pct, order] of [
      ['Serviços Preliminares',    100,   1],
      ['Fundação',                  97.31, 2],
      ['Estrutura',                 96.88, 3],
      ['Instalações',               61.61, 4],
      ['Revestimentos Internos',    62.61, 5],
      ['Revestimentos Externos',    54.31, 6],
      ['Pintura',                   25.42, 7],
    ]) {
      await pool.query(
        `INSERT INTO construction_stages (name, percentage, sort_order) VALUES ($1, $2, $3)`,
        [name, pct, order]
      );
    }
  }

  await aplicarCargaUnica(pool);

  console.log('✅ Banco de dados PostgreSQL inicializado com sucesso.');
}

// Expõe promise para o app.js aguardar antes de ouvir
db.ready = initializeDatabase().catch(err => {
  console.error('❌ Erro ao inicializar banco de dados:', err.message);
  process.exit(1);
});

module.exports = db;
