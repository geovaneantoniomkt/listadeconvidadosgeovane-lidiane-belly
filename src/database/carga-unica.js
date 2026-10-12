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

// Liga uma foto (arquivo em public/images/produtos) ao card de um produto.
// Só preenche quem está sem foto: imagem enviada pelo admin não é trocada.
async function fotoDoCard(client, name, image) {
  const res = await client.query(
    `UPDATE products SET image_url = $2::text, updated_at = CURRENT_TIMESTAMP
     WHERE name = $1::text AND (image_url IS NULL OR image_url = '' OR image_url LIKE '%placeholder%')`,
    [name, image]
  );
  return res.rowCount;
}

// Out/2026 — fotos dos produtos
async function cargaFotos(client) {
  let comFoto = 0;
  for (const f of fotos) {
    comFoto += await fotoDoCard(client, f.name, f.image);

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

// Out/2026 — produtos equivalentes passam a dividir um card só: o produto
// `juntar` vira opção dentro de "Comprar direto no fornecedor" do `principal`.
const GRUPOS = [
  { principal: 'Kit 6 Pçs Jogo Americano Redondo Sousplat - Lugar Americano',
    juntar: ['Kit Jogo Americano Pistache Com Cru 6 Lug. Mesa Posta'] },
  { principal: 'Aparelho de Jantar Verde Escuro 36 Peças',
    juntar: ['Aparelho de Jantar Porto Brasil Orgânico Arauco 30 Peças'] },
  { principal: 'Conjunto Mesa Jantar 1,20m Off-white 4 Cadeiras Linho Bege',
    juntar: ['Sala de Jantar 130x90 Mavie Vidro Off 4 Cadeiras Bom Pastor Off-white Naturale Linho Off'] },
  { principal: 'Kit Churrasco Conjunto de 08 Peças Facas',
    juntar: ['Jogo De Talheres Tramontina Churrasco Jumbo 12 Peças'] },
  { principal: 'Kit De Pizza Tramontina 14 Peças - Aço Inox',
    juntar: ['Kit Para Pizza 14 Peças Pizza Laminas De Aço Inox'],
    // o link do Mercado Livre vende a versão vermelha do kit
    miniaturas: [{ url: 'https://meli.la/2Auddxz', image: '/images/produtos/kit-pizza-tramontina-14-pecas-vermelho.webp' }] },
  { principal: 'Kit Conjunto de 5 Potes de Vidro Redondo, Tampa Plástica- Conjunto de Tigelas Redondas',
    juntar: [],
    opcoes: [{ name: 'Mercado Livre', url: 'https://meli.la/2vabRpe', item: 'Conjunto 5 Potes De Vidro Com Tampa Redondo Tipo Bowl Promo' }] },
];

const FOTOS_NOVAS = [
  { name: 'Sofá 4 Lugares Retrátil e Reclinável', image: '/images/produtos/sofa-retratil-reclinavel-zurique.webp' },
  { name: 'Aspirador Pó Philco Vertical Power Clean 2000W PAS4000V 127V', image: '/images/produtos/aspirador-de-po-philco-pas4000v.webp' },
];

const ORDEM_STATUS = ['disponivel', 'reservado', 'aguardando_validacao', 'comprado'];

async function cargaAgrupamento(client) {
  for (const f of FOTOS_NOVAS) await fotoDoCard(client, f.name, f.image);

  const buscar = async (name) => {
    const { rows } = await client.query(
      `SELECT id, name, status, image_url, suppliers FROM products WHERE name = $1::text ORDER BY id LIMIT 1`,
      [name]
    );
    return rows[0];
  };

  // As lojas de um produto viram opções: cada uma diz qual produto é e leva a foto dele
  const comoOpcoes = (p) => {
    let lojas = [];
    try { lojas = JSON.parse(p.suppliers || '[]'); } catch { /* fica sem lojas */ }
    return lojas.map((s) => Object.assign({}, s, { item: s.item || p.name }, !s.image && p.image_url ? { image: p.image_url } : {}));
  };

  let juntados = 0;
  for (const g of GRUPOS) {
    const principal = await buscar(g.principal);
    if (!principal) continue; // renomeado ou apagado no admin: não mexe

    let opcoes = comoOpcoes(principal);
    let status = principal.status;

    for (const nome of g.juntar) {
      const outro = await buscar(nome);
      if (!outro) continue;
      opcoes = opcoes.concat(comoOpcoes(outro));
      if (ORDEM_STATUS.indexOf(outro.status) > ORDEM_STATUS.indexOf(status)) status = outro.status;

      // Comprovantes e contribuições do produto que some passam para o card que fica
      await client.query(`UPDATE receipts SET product_id = $1::int WHERE product_id = $2::int`, [principal.id, outro.id]);
      await client.query(`UPDATE contributions SET product_id = $1::int WHERE product_id = $2::int`, [principal.id, outro.id]);
      await client.query(`DELETE FROM products WHERE id = $1::int`, [outro.id]);
      juntados++;
    }

    for (const extra of g.opcoes || []) {
      if (!opcoes.some((o) => o.url === extra.url)) opcoes.push(extra);
    }
    for (const m of g.miniaturas || []) {
      const opcao = opcoes.find((o) => o.url === m.url);
      if (opcao) opcao.image = m.image;
    }

    await client.query(
      `UPDATE products SET suppliers = $2::text, status = $3::text, updated_at = CURRENT_TIMESTAMP WHERE id = $1::int`,
      [principal.id, JSON.stringify(opcoes), status]
    );
  }

  return `${juntados} produtos passaram a ser opção dentro de outro card.`;
}

// Out/2026 — fotos que chegaram depois do agrupamento
const POTES_DE_VIDRO = 'Kit Conjunto de 5 Potes de Vidro Redondo, Tampa Plástica- Conjunto de Tigelas Redondas';

const FOTOS_DE_CARDS = [
  { name: POTES_DE_VIDRO, image: '/images/produtos/kit-5-potes-de-vidro.webp' },
];

// Miniatura de uma opção dentro de um card: `item` é o produto da opção
const FOTOS_DE_OPCOES = [
  { produto: POTES_DE_VIDRO, item: POTES_DE_VIDRO, image: '/images/produtos/kit-5-potes-de-vidro.webp' },
  { produto: 'Kit 6 Pçs Jogo Americano Redondo Sousplat - Lugar Americano',
    item: 'Kit Jogo Americano Pistache Com Cru 6 Lug. Mesa Posta',
    image: '/images/produtos/jogo-americano-pistache.webp' },
];

async function cargaFotosExtras(client) {
  let ligadas = 0;

  for (const f of FOTOS_DE_CARDS) ligadas += await fotoDoCard(client, f.name, f.image);

  for (const f of FOTOS_DE_OPCOES) {
    const { rows } = await client.query(
      `SELECT id, suppliers FROM products WHERE name = $1::text ORDER BY id LIMIT 1`,
      [f.produto]
    );
    if (!rows[0]) continue;

    let lojas;
    try { lojas = JSON.parse(rows[0].suppliers || '[]'); } catch { continue; }

    // Só preenche opção sem miniatura: o que foi mexido no admin fica
    const semFoto = lojas.filter((s) => s.item === f.item && !s.image);
    if (semFoto.length === 0) continue;
    semFoto.forEach((s) => { s.image = f.image; });
    ligadas += semFoto.length;

    await client.query(
      `UPDATE products SET suppliers = $2::text, updated_at = CURRENT_TIMESTAMP WHERE id = $1::int`,
      [rows[0].id, JSON.stringify(lojas)]
    );
  }

  return `${ligadas} fotos ligadas a cards e opções.`;
}

// Out/2026 — andamento da obra conforme o portal da construtora (Agosto/2026)
const OBRA = {
  geral: '89.17',
  atualizacao: 'Agosto/2026',
  etapas: {
    'Serviços Preliminares':  100,
    'Fundação':               100,
    'Estrutura':              99.01,
    'Instalações':            76.49,
    'Revestimentos Internos': 90.01,
    'Revestimentos Externos': 76.31,
    'Pintura':                63.96,
  },
};

async function cargaObra(client) {
  for (const [key, value] of [['construction_overall', OBRA.geral], ['construction_last_update', OBRA.atualizacao]]) {
    await client.query(
      `INSERT INTO settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
      [key, value]
    );
  }

  let etapas = 0;
  for (const [name, percentage] of Object.entries(OBRA.etapas)) {
    const res = await client.query(
      `UPDATE construction_stages SET percentage = $2::numeric, updated_at = CURRENT_TIMESTAMP WHERE name = $1::text`,
      [name, percentage]
    );
    etapas += res.rowCount;
  }

  return `andamento da obra em ${OBRA.geral}% (${OBRA.atualizacao}), ${etapas} etapas atualizadas.`;
}

// Em ordem: cada carga parte do que a anterior deixou. Se uma falhar, as
// seguintes esperam o próximo início.
const CARGAS = [
  ['carga_unica_2026_10',        cargaProdutos],
  ['carga_fotos_2026_10',        cargaFotos],
  ['retirada_comprados_2026_10', cargaRetirada],
  ['agrupamento_2026_10',        cargaAgrupamento],
  ['fotos_extras_2026_10',       cargaFotosExtras],
  ['obra_2026_08',               cargaObra],
];

async function aplicarCargaUnica(pool) {
  for (const [marca, aplicar] of CARGAS) {
    if (!(await executarUmaVez(pool, marca, aplicar))) return;
  }
}

module.exports = { aplicarCargaUnica };
