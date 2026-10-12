// ================================================
// CARGAS ÚNICAS — dados que entram no banco pelo código
//
// Cada carga roda uma única vez por banco: ao concluir, grava sua marca em
// `settings`. Depois disso tudo é editado pelo painel admin e nunca mais é
// sobrescrito (apagar um produto ou trocar o link no admin não é desfeito no
// próximo deploy).
// ================================================
const { categorias, produtos } = require('./carga-unica.json');
const fotos = require('./carga-fotos.json');

const CONFIGURACOES = {
  mercadopago_link: 'https://link.mercadopago.com.br/listadepresentegeo',
  delivery_date:    '2027-01-28',
};

// Aplica `aplicar` dentro de uma transação, uma única vez por `marca`.
// Devolve false só quando a carga falhou (e foi desfeita por inteiro).
async function executarUmaVez(pool, marca, aplicar) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // A marca entra primeiro: se já existe, a carga foi aplicada antes
    const { rowCount } = await client.query(
      `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
      [marca, new Date().toISOString()]
    );
    if (rowCount === 0) {
      await client.query('ROLLBACK');
      return true;
    }

    const resumo = await aplicar(client);
    await client.query('COMMIT');
    console.log(`✅ Carga única aplicada: ${resumo}`);
    return true;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    // Não derruba o site: a carga é desfeita e tenta de novo no próximo início
    console.error(`⚠️ Carga única "${marca}" não aplicada:`, err.message);
    return false;
  } finally {
    client.release();
  }
}

// Out/2026 — produtos da planilha, link do Mercado Pago e prazo de entrega
async function cargaProdutos(client) {
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

  return `${inseridos} produtos inseridos, link do Mercado Pago e prazo atualizados.`;
}

// Out/2026 — fotos dos produtos (arquivos em public/images/produtos)
async function cargaFotos(client) {
  let comFoto = 0;
  for (const f of fotos) {
    // Só preenche quem está sem foto: imagem enviada pelo admin não é trocada
    const res = await client.query(
      `UPDATE products SET image_url = $2::text, updated_at = CURRENT_TIMESTAMP
       WHERE name = $1::text AND (image_url IS NULL OR image_url = '' OR image_url LIKE '%placeholder%')`,
      [f.name, f.image]
    );
    comFoto += res.rowCount;

    // Nome da planilha que não batia com o produto do link
    if (f.rename) {
      await client.query(
        `UPDATE products SET name = $2::text, updated_at = CURRENT_TIMESTAMP
         WHERE name = $1::text AND NOT EXISTS (SELECT 1 FROM products WHERE name = $2::text)`,
        [f.name, f.rename]
      );
    }
  }

  return `${comFoto} produtos receberam foto.`;
}

// Out/2026 — retirada dos itens que a família já tinha comprado por conta própria
const RETIRAR = [
  'Cama de Casal',
  'TV 42 Polegadas',
  'TV 32 Polegadas',
  'Jogo de Panelas',
  'Fogão de Indução',
  'Mixer Britânia BMX400P',
  'Multiprocessador Turbo Chef 5 Em 1',
];

async function cargaRetirada(client) {
  let retirados = 0;
  for (const name of RETIRAR) {
    // Produto com comprovante ou contribuição ligada fica: apagar perderia esse registro
    const res = await client.query(
      `DELETE FROM products p
       WHERE p.name = $1::text
         AND NOT EXISTS (SELECT 1 FROM receipts r WHERE r.product_id = p.id)
         AND NOT EXISTS (SELECT 1 FROM contributions c WHERE c.product_id = p.id)`,
      [name]
    );
    retirados += res.rowCount;
  }

  // "Quarto" só tinha a cama: sem produtos, sai do filtro de categorias
  await client.query(
    `DELETE FROM categories c
     WHERE c.slug = 'quarto' AND NOT EXISTS (SELECT 1 FROM products p WHERE p.category_id = c.id)`
  );

  return `${retirados} produtos retirados da lista.`;
}

async function aplicarCargaUnica(pool) {
  // As demais dependem dos produtos: se a primeira carga falhar, elas esperam
  const ok = await executarUmaVez(pool, 'carga_unica_2026_10', cargaProdutos);
  if (!ok) return;
  await executarUmaVez(pool, 'carga_fotos_2026_10', cargaFotos);
  await executarUmaVez(pool, 'retirada_comprados_2026_10', cargaRetirada);
}

module.exports = { aplicarCargaUnica };
