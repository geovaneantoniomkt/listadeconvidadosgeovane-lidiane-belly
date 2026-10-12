// ================================================
// CARGA ÚNICA — produtos da planilha + ajustes de configuração (out/2026)
//
// Roda uma única vez por banco: ao concluir, grava uma marca em `settings`.
// Depois disso tudo é editado pelo painel admin e nunca mais é sobrescrito
// (apagar um produto ou trocar o link no admin não é desfeito no próximo deploy).
// ================================================
const { categorias, produtos } = require('./carga-unica.json');

const MARCA = 'carga_unica_2026_10';

const CONFIGURACOES = {
  mercadopago_link: 'https://link.mercadopago.com.br/listadepresentegeo',
  delivery_date:    '2027-01-28',
};

async function aplicarCargaUnica(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // A marca entra primeiro: se já existe, a carga foi aplicada antes
    const { rowCount } = await client.query(
      `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
      [MARCA, new Date().toISOString()]
    );
    if (rowCount === 0) {
      await client.query('ROLLBACK');
      return;
    }

    for (const [key, value] of Object.entries(CONFIGURACOES)) {
      await client.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
        [key, value]
      );
    }

    const categoryIds = {};
    for (const c of categorias) {
      await client.query(
        `INSERT INTO categories (name, slug, icon) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [c.name, c.slug, c.icon]
      );
      const { rows } = await client.query(
        `SELECT id FROM categories WHERE slug = $1::text OR name = $2::text ORDER BY (slug = $1::text) DESC LIMIT 1`,
        [c.slug, c.name]
      );
      categoryIds[c.slug] = rows[0].id;
    }

    // created_at decrescente mantém a ordem do arquivo na listagem (ORDER BY created_at DESC)
    let inseridos = 0;
    for (const [i, p] of produtos.entries()) {
      const res = await client.query(
        `INSERT INTO products (name, price, category_id, status, specs, suppliers, created_at, updated_at)
         SELECT $1::text, $2::numeric, $3::int, $4::text, '{}', $5::text,
                CURRENT_TIMESTAMP - ($6::int * INTERVAL '1 second'),
                CURRENT_TIMESTAMP - ($6::int * INTERVAL '1 second')
         WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = $1::text)`,
        [p.name, p.price, categoryIds[p.category], p.status, JSON.stringify(p.suppliers), i]
      );
      inseridos += res.rowCount;
    }

    await client.query('COMMIT');
    console.log(`✅ Carga única aplicada: ${inseridos} produtos inseridos, link do Mercado Pago e prazo atualizados.`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    // Não derruba o site: a carga é desfeita por inteiro e tenta de novo no próximo início
    console.error('⚠️ Carga única não aplicada:', err.message);
  } finally {
    client.release();
  }
}

module.exports = { aplicarCargaUnica };
