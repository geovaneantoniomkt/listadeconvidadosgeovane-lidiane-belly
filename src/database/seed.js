// ================================================
// DADOS DE EXEMPLO — SEED DO BANCO DE DADOS
// Execute: node src/database/seed.js
// ================================================
require('dotenv').config();
const db = require('./db');

async function main() {
  // Aguarda inicialização do banco
  await db.ready;

  console.log('🌱 Inserindo dados iniciais...');

  // ────────────────────────────────────────────────
  // CATEGORIAS
  // ────────────────────────────────────────────────
  const categories = [
    { name: 'Móveis',             slug: 'moveis',            icon: '🛋️' },
    { name: 'Eletrodomésticos',   slug: 'eletrodomesticos',  icon: '⚡' },
    { name: 'Utensílios',         slug: 'utensilios',        icon: '🍳' },
    { name: 'Decoração',          slug: 'decoracao',         icon: '🌿' },
    { name: 'Eletrônicos',        slug: 'eletronicos',       icon: '📱' },
    { name: 'Organização',        slug: 'organizacao',       icon: '📦' },
    { name: 'Cama, Mesa e Banho', slug: 'cama-mesa-banho',   icon: '🛁' },
    { name: 'Infantil',           slug: 'infantil',          icon: '👶' },
    { name: 'Outros',             slug: 'outros',            icon: '🎁' },
  ];

  for (const cat of categories) {
    await db.run(
      `INSERT INTO categories (name, slug, icon) VALUES (?, ?, ?) ON CONFLICT DO NOTHING`,
      [cat.name, cat.slug, cat.icon]
    );
  }
  console.log(`✅ ${categories.length} categorias inseridas.`);

  // Helper para buscar id da categoria
  async function getCatId(slug) {
    const row = await db.get('SELECT id FROM categories WHERE slug = ?', [slug]);
    return row?.id;
  }

  // ────────────────────────────────────────────────
  // PRODUTOS
  // ────────────────────────────────────────────────
  const products = [
    {
      name: 'Sofá 3 Lugares Retrátil e Reclinável',
      description: 'Sofá sala com chaise, tecido suede, retrátil e reclinável.',
      creative_text: 'Sem um sofá decente, qualquer família que se reúna vai brigar por espaço.',
      price: 2499.90, category: 'moveis', status: 'disponivel', priority: 1, badge: 'prioridade',
      image_url: '/images/placeholder-sofa.jpg',
      specs: JSON.stringify({ 'Dimensões': '220x170x100cm', 'Material': 'Suede cinza' }),
      suppliers: JSON.stringify([{ name: 'Tok&Stok', url: '#', price: 2499.90 }])
    },
    {
      name: 'Geladeira Frost Free 375L Duplex',
      description: 'Geladeira frost free, duplex, 375 litros.',
      creative_text: 'A Lidiane SONHA com essa geladeira há dois anos.',
      price: 3299.00, category: 'eletrodomesticos', status: 'disponivel', priority: 1, badge: 'mais-desejado',
      image_url: '/images/placeholder-geladeira.jpg',
      specs: JSON.stringify({ 'Capacidade': '375 litros', 'Tipo': 'Frost Free' }),
      suppliers: JSON.stringify([{ name: 'Magazine Luiza', url: '#', price: 3299.00 }])
    },
    {
      name: 'Jogo de Panelas 7 Peças Tramontina',
      description: 'Jogo de panelas antiaderente, 7 peças.',
      creative_text: 'Com essas panelas, as refeições vão ficar ainda mais gostosas.',
      price: 699.90, category: 'utensilios', status: 'comprado', priority: 0, badge: null,
      image_url: '/images/placeholder-panelas.jpg',
      specs: JSON.stringify({ 'Peças': '7', 'Material': 'Alumínio antiaderente' }),
      suppliers: JSON.stringify([{ name: 'Tramontina', url: '#', price: 699.90 }])
    },
    {
      name: 'Smart TV 55" 4K',
      description: 'Smart TV LED 55 polegadas, 4K Ultra HD.',
      creative_text: 'A Belly merece ver o Mundo Bita em tamanho real.',
      price: 2799.00, category: 'eletronicos', status: 'disponivel', priority: 0, badge: null,
      image_url: '/images/placeholder-tv.jpg',
      specs: JSON.stringify({ 'Tamanho': '55"', 'Resolução': '4K' }),
      suppliers: JSON.stringify([{ name: 'Samsung Store', url: '#', price: 2799.00 }])
    },
    {
      name: 'Ar-Condicionado Split 12.000 BTUs',
      description: 'Ar-condicionado split inverter 12.000 BTUs.',
      creative_text: 'Um ar-condicionado é o termômetro do humor doméstico.',
      price: 2199.00, category: 'eletrodomesticos', status: 'disponivel', priority: 1, badge: 'prioridade',
      image_url: '/images/placeholder-ar.jpg',
      specs: JSON.stringify({ 'Capacidade': '12.000 BTUs', 'Tecnologia': 'Inverter' }),
      suppliers: JSON.stringify([{ name: 'LG Store', url: '#', price: 2199.00 }])
    },
  ];

  for (const p of products) {
    const catId = await getCatId(p.category);
    await db.run(
      `INSERT INTO products (name, description, creative_text, price, category_id, status, priority, badge, image_url, specs, suppliers)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
      [p.name, p.description, p.creative_text, p.price, catId, p.status, p.priority, p.badge, p.image_url, p.specs, p.suppliers]
    );
  }
  console.log(`✅ ${products.length} produtos inseridos.`);

  // ────────────────────────────────────────────────
  // CONTRIBUIÇÕES MOCKADAS
  // ────────────────────────────────────────────────
  const contributions = [
    { name: 'Tia Rosana',        phone: '11999990001', email: 'rosana@email.com', amount: 150, status: 'confirmado', message: 'Com muito amor! 🏠',          date: '2024-03-10 14:30:00' },
    { name: 'Madrinha Cláudia',  phone: '11999990002', email: null,               amount: 200, status: 'confirmado', message: 'Vida nova, lar abençoado!',   date: '2024-03-12 10:00:00' },
    { name: 'Vovó Neuza',        phone: '11999990004', email: null,               amount: 300, status: 'confirmado', message: 'Deus abençoe vocês sempre!', date: '2024-03-18 09:00:00' },
    { name: 'Amigo Paulão',      phone: '11999990003', email: 'paulo@email.com',  amount: 100, status: 'confirmado', message: 'Vai lá família!',             date: '2024-03-15 18:00:00' },
    { name: 'Prima Ana Laura',   phone: '11999990005', email: null,               amount: 80,  status: 'pendente',   message: null,                         date: null },
  ];

  for (const c of contributions) {
    await db.run(
      `INSERT INTO contributions (name, phone, email, amount, payment_status, message, confirmed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
      [c.name, c.phone, c.email, c.amount, c.status, c.message, c.date]
    );
  }
  console.log(`✅ ${contributions.length} contribuições inseridas.`);

  console.log('\n🎉 Seed concluído! O banco está pronto.');
  console.log('👉 Execute: npm start ou npm run dev');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Erro no seed:', err.message);
  process.exit(1);
});
