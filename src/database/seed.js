// ================================================
// DADOS MOCKADOS — SEED DO BANCO DE DADOS
// Execute: node src/database/seed.js
// ================================================
require('dotenv').config();
const db = require('./db');

console.log('🌱 Inserindo dados iniciais...');

// ────────────────────────────────────────────────
// CATEGORIAS
// ────────────────────────────────────────────────
const insertCategory = db.prepare(`
  INSERT OR IGNORE INTO categories (name, slug, icon) VALUES (?, ?, ?)
`);

const categories = [
  { name: 'Móveis', slug: 'moveis', icon: '🛋️' },
  { name: 'Eletrodomésticos', slug: 'eletrodomesticos', icon: '⚡' },
  { name: 'Utensílios', slug: 'utensilios', icon: '🍳' },
  { name: 'Decoração', slug: 'decoracao', icon: '🌿' },
  { name: 'Eletrônicos', slug: 'eletronicos', icon: '📱' },
  { name: 'Organização', slug: 'organizacao', icon: '📦' },
  { name: 'Cama, Mesa e Banho', slug: 'cama-mesa-banho', icon: '🛁' },
  { name: 'Infantil', slug: 'infantil', icon: '👶' },
  { name: 'Outros', slug: 'outros', icon: '🎁' },
];

categories.forEach(cat => insertCategory.run(cat.name, cat.slug, cat.icon));
console.log(`✅ ${categories.length} categorias inseridas.`);

// Busca IDs das categorias
const getCatId = (slug) => db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug)?.id;

// ────────────────────────────────────────────────
// PRODUTOS
// ────────────────────────────────────────────────
const insertProduct = db.prepare(`
  INSERT OR IGNORE INTO products
    (name, description, creative_text, price, category_id, status, priority, badge, image_url, specs, suppliers)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const products = [
  {
    name: 'Sofá 3 Lugares Retrátil e Reclinável',
    description: 'Sofá sala com chaise, tecido suede, retrátil e reclinável. Perfeito para os finais de semana em família.',
    creative_text: 'Olha, vamos ser honestos: sem um sofá decente, qualquer família que se reúna vai brigar por espaço. Esse sofá resolve isso com estilo, conforto e ainda tem um lado que deita. O Geovane já chamou de "o melhor amigo das tarde de domingo".',
    price: 2499.90,
    category_id: getCatId('moveis'),
    status: 'disponivel',
    priority: 1,
    badge: 'prioridade',
    image_url: '/images/placeholder-sofa.jpg',
    specs: JSON.stringify({
      'Dimensões': '220cm x 170cm x 100cm',
      'Material': 'Suede cinza chumbo',
      'Capacidade': '3 lugares + chaise',
      'Função': 'Retrátil e reclinável',
      'Modelo exato': 'Sofá Retrátil Helo 3 Lugares - Fendi'
    }),
    suppliers: JSON.stringify([
      { name: 'Tok&Stok', url: '#', price: 2499.90 },
      { name: 'Mobly', url: '#', price: 2399.00 },
    ])
  },
  {
    name: 'Geladeira Frost Free 375L Duplex',
    description: 'Geladeira frost free, duplex, 375 litros. A grande sonhada da Lidiane desde sempre.',
    creative_text: 'A Lidiane SONHA com essa geladeira há dois anos. Ela manda fotos dela no grupo da família. No aniversário dela, alguém deu um ímã de geladeira e ela agradeceu com lágrimas nos olhos. Vamos encerrar esse drama?',
    price: 3299.00,
    category_id: getCatId('eletrodomesticos'),
    status: 'disponivel',
    priority: 1,
    badge: 'mais-desejado',
    image_url: '/images/placeholder-geladeira.jpg',
    specs: JSON.stringify({
      'Capacidade': '375 litros',
      'Tipo': 'Frost Free Duplex',
      'Cor': 'Inox',
      'Voltagem': '127V',
      'Modelo': 'Geladeira/Refrigerador Brastemp Frost Free Duplex 375L BRM44HK'
    }),
    suppliers: JSON.stringify([
      { name: 'Magazine Luiza', url: '#', price: 3299.00 },
      { name: 'Americanas', url: '#', price: 3199.00 },
      { name: 'Casas Bahia', url: '#', price: 3250.00 },
    ])
  },
  {
    name: 'Jogo de Panelas 7 Peças Tramontina',
    description: 'Jogo de panelas antiaderente, cabos de silicone, 7 peças. Para a Lidiane cozinhar com amor.',
    creative_text: 'O Geovane diz que cozinha bem. A Lidiane ri sempre que ele diz isso. As panelas boas são para a Lidiane — que cozinha de verdade. Com essas panelas, as refeições vão ficar ainda mais gostosas. A Belly já aprovou o cheiro do que sai daquela cozinha.',
    price: 699.90,
    category_id: getCatId('utensilios'),
    status: 'comprado',
    priority: 0,
    badge: null,
    image_url: '/images/placeholder-panelas.jpg',
    specs: JSON.stringify({
      'Peças': '7 (4 panelas, 2 frigideiras, 1 leiteira)',
      'Material': 'Alumínio antiaderente',
      'Cabo': 'Silicone preto',
      'Marca': 'Tramontina',
      'Linha': 'Solar Antiaderente',
      'Modelo exato': 'Jogo de Panelas Tramontina Solar 7 Peças Antiaderente - Preto'
    }),
    suppliers: JSON.stringify([
      { name: 'Tramontina', url: '#', price: 699.90 },
      { name: 'Amazon', url: '#', price: 649.00 },
    ])
  },
  {
    name: 'Máquina de Lavar 11kg Automática',
    description: 'Lavadora automática 11kg, 12 programas de lavagem, eficiência energética A.',
    creative_text: 'Lavar roupa na mão não é romantismo, é sofrimento. A máquina de lavar é o símbolo maior de que a vida adulta tem seus privilégios. Com a Belly gerando roupa sujinha em velocidade industrial, essa máquina não é luxo — é sobrevivência.',
    price: 2199.00,
    category_id: getCatId('eletrodomesticos'),
    status: 'aguardando_validacao',
    priority: 1,
    badge: 'prioridade',
    image_url: '/images/placeholder-lavadora.jpg',
    specs: JSON.stringify({
      'Capacidade': '11 kg',
      'Programas': '12 programas',
      'Eficiência': 'Classe A',
      'Voltagem': '127V',
      'Modelo': 'Máquina de Lavar Consul 11kg CWH11ABBNA'
    }),
    suppliers: JSON.stringify([
      { name: 'Consul Loja Oficial', url: '#', price: 2199.00 },
      { name: 'Magazine Luiza', url: '#', price: 2099.00 },
    ])
  },
  {
    name: 'Colchão Queen Size Viscoelástico',
    description: 'Colchão viscoelástico com molas pocket, tamanho Queen (158x198cm). Um sono de qualidade para o casal.',
    creative_text: 'Dormindo bem, o Geovane fica menos mal-humorado de manhã. A Lidiane confirmou esse dado. O investimento num bom colchão é literalmente o investimento na paz do lar. Não é presente pra eles — é presente pra família inteira.',
    price: 3899.00,
    category_id: getCatId('cama-mesa-banho'),
    status: 'disponivel',
    priority: 1,
    badge: 'prioridade',
    image_url: '/images/placeholder-colchao.jpg',
    specs: JSON.stringify({
      'Tamanho': 'Queen Size (158 x 198 cm)',
      'Tecnologia': 'Viscoelástico + Molas Pocket',
      'Altura': '30 cm',
      'Dureza': 'Médio',
      'Marca': 'Ortobom',
      'Modelo': 'Colchão Ortobom Queen Physical D45'
    }),
    suppliers: JSON.stringify([
      { name: 'Ortobom Store', url: '#', price: 3899.00 },
      { name: 'Casas Bahia', url: '#', price: 3799.00 },
    ])
  },
  {
    name: 'Mesa de Jantar 6 Lugares com Cadeiras',
    description: 'Mesa de jantar retangular MDF, 6 lugares, com cadeiras estofadas. O ponto de encontro da família.',
    creative_text: 'Toda família precisa de uma mesa boa. É ali que o almoço de domingo acontece, que a Belly vai aprender a contar enquanto janta, e que os amigos vão tomar café e ficar até tarde. Uma mesa boa não tem preço — mas nós colocamos um porque alguém precisa comprar.',
    price: 1899.00,
    category_id: getCatId('moveis'),
    status: 'disponivel',
    priority: 1,
    badge: 'mais-desejado',
    image_url: '/images/placeholder-mesa.jpg',
    specs: JSON.stringify({
      'Tamanho': '160cm x 90cm',
      'Material': 'MDF com tampo de vidro',
      'Cadeiras': '6 cadeiras estofadas',
      'Cor': 'Capuccino / Off-White',
      'Modelo exato': 'Mesa de Jantar Retangular Isabela 6 Cadeiras'
    }),
    suppliers: JSON.stringify([
      { name: 'Tok&Stok', url: '#', price: 1899.00 },
      { name: 'Mobly', url: '#', price: 1799.00 },
    ])
  },
  {
    name: 'Smart TV 55" 4K',
    description: 'Smart TV LED 55 polegadas, 4K Ultra HD, HDR, Wi-Fi integrado. Sessão de cinema em casa.',
    creative_text: 'O Geovane e a Lidiane ficaram dois anos sem TV decente. Dois anos. Assistiam série no notebook abraçados. Romântico? Talvez. Mas uma TV 55 polegadas seria ainda mais romântico. E a Belly merece ver o Mundo Bita em tamanho real.',
    price: 2799.00,
    category_id: getCatId('eletronicos'),
    status: 'disponivel',
    priority: 0,
    badge: null,
    image_url: '/images/placeholder-tv.jpg',
    specs: JSON.stringify({
      'Tamanho': '55 polegadas',
      'Resolução': '4K Ultra HD',
      'Tecnologia': 'LED + HDR',
      'Conectividade': 'Wi-Fi, Bluetooth, HDMI x3, USB x2',
      'Sistema': 'Android TV / Smart TV',
      'Modelo': 'Samsung 55" Crystal 4K UHD'
    }),
    suppliers: JSON.stringify([
      { name: 'Samsung Store', url: '#', price: 2799.00 },
      { name: 'Magazine Luiza', url: '#', price: 2699.00 },
      { name: 'Americanas', url: '#', price: 2749.00 },
    ])
  },
  {
    name: 'Kit Cama Queen - Jogo de Lençóis + Edredom',
    description: 'Jogo de cama queen completo: lençol, fronhas e edredom. 100% algodão egípcio. 400 fios.',
    creative_text: 'Nada melhor do que deitar numa cama com lençóis fresquinhos, perfumados e macios. A Lidiane já disse que o dia que ela tiver um jogo de cama 400 fios vai ser o dia mais feliz da vida dela (além do nascimento da Belly, claro). Você pode fazer isso acontecer.',
    price: 449.90,
    category_id: getCatId('cama-mesa-banho'),
    status: 'disponivel',
    priority: 0,
    badge: 'quase-resolvido',
    image_url: '/images/placeholder-cama.jpg',
    specs: JSON.stringify({
      'Tamanho': 'Queen (158 x 198 cm)',
      'Material': 'Algodão Egípcio 400 fios',
      'Itens': 'Lençol com elástico, lençol avulso, 2 fronhas, edredom',
      'Cor': 'Branco / Cru',
      'Marca': 'Karsten ou Trussardi'
    }),
    suppliers: JSON.stringify([
      { name: 'Lojas Americanas', url: '#', price: 449.90 },
      { name: 'Carrefour', url: '#', price: 429.00 },
    ])
  },
  {
    name: 'Ar-Condicionado Split 12.000 BTUs',
    description: 'Ar-condicionado split inverter 12.000 BTUs, quente e frio. Economia de energia classe A.',
    creative_text: 'O Brasil é quente. A Lidiane fica de mau humor quando está com calor. O Geovane também. A Belly piora tudo com choro. Um ar-condicionado não é apenas um aparelho — é literalmente o termômetro do humor doméstico. Invista na paz da família.',
    price: 2199.00,
    category_id: getCatId('eletrodomesticos'),
    status: 'disponivel',
    priority: 1,
    badge: 'prioridade',
    image_url: '/images/placeholder-ar.jpg',
    specs: JSON.stringify({
      'Capacidade': '12.000 BTUs',
      'Tecnologia': 'Inverter',
      'Função': 'Quente e Frio',
      'Eficiência': 'Classe A',
      'Voltagem': '220V',
      'Modelo': 'LG Dual Inverter 12.000 BTUs S4-W12JA3WA'
    }),
    suppliers: JSON.stringify([
      { name: 'LG Store', url: '#', price: 2199.00 },
      { name: 'Magazine Luiza', url: '#', price: 2099.00 },
    ])
  },
  {
    name: 'Berço Multifuncional + Colchão',
    description: 'Berço multifuncional que vira mini cama, com gaveta e colchão D18. Para a Belly crescer com conforto.',
    creative_text: 'A Belly está crescendo depressa demais. Parece que foi ontem que ela chegou e já está derrubando tudo que pode. Ela merece um cantinho cheiroso, seguro e bonito para descansar depois de tanto trabalho. Afinal, desconstruir o mundo dá muito sono.',
    price: 1299.00,
    category_id: getCatId('infantil'),
    status: 'reservado',
    priority: 1,
    badge: 'mais-desejado',
    image_url: '/images/placeholder-berco.jpg',
    specs: JSON.stringify({
      'Material': 'MDF resistente',
      'Funções': 'Berço + Mini cama + Cômoda',
      'Colchão': 'D18 incluso (130x70cm)',
      'Cor': 'Branco neve',
      'Modelo': 'Berço Multifuncional Doce Sonho - Branco'
    }),
    suppliers: JSON.stringify([
      { name: 'Baby Store', url: '#', price: 1299.00 },
      { name: 'Americanas', url: '#', price: 1249.00 },
    ])
  },
  {
    name: 'Micro-ondas 30L com Grill',
    description: 'Micro-ondas 30 litros com função grill, 10 menus automáticos. Praticidade no dia a dia.',
    creative_text: 'Sem micro-ondas a Lidiane aquece comida no fogão. Ela usa três panelas para isso. Três. Um micro-ondas resolve isso em 2 minutos e ainda grelha aquele frango que o Geovane finge que sabe fazer. Praticidade tem nome e se chama 30 litros com grill.',
    price: 599.90,
    category_id: getCatId('eletrodomesticos'),
    status: 'disponivel',
    priority: 0,
    badge: null,
    image_url: '/images/placeholder-microondas.jpg',
    specs: JSON.stringify({
      'Capacidade': '30 litros',
      'Funções': 'Micro-ondas + Grill',
      'Menus': '10 menus automáticos',
      'Voltagem': '220V',
      'Modelo': 'Panasonic NN-GT67HSRUK 30L'
    }),
    suppliers: JSON.stringify([
      { name: 'Panasonic Store', url: '#', price: 599.90 },
      { name: 'Magazine Luiza', url: '#', price: 579.00 },
    ])
  },
  {
    name: 'Conjunto de Toalhas de Banho (6 peças)',
    description: 'Kit com 6 toalhas de banho 100% algodão, felpudo, secagem rápida. Cor: branco ou creme.',
    creative_text: 'Toalha grudenta, rasgada ou felpuda de verdade? A segunda. As toalhas da família hoje são... vamos chamar de "históricas". Elas já viram muita coisa. Está na hora de aposentá-las com dignidade e dar lugar a toalhas que abracem de verdade depois do banho.',
    price: 289.90,
    category_id: getCatId('cama-mesa-banho'),
    status: 'disponivel',
    priority: 0,
    badge: null,
    image_url: '/images/placeholder-toalhas.jpg',
    specs: JSON.stringify({
      'Peças': '6 toalhas de banho',
      'Material': '100% algodão',
      'Gramatura': '500g/m²',
      'Cor': 'Branco ou Creme',
      'Marca': 'Buddemeyer ou Döhler'
    }),
    suppliers: JSON.stringify([
      { name: 'Tok&Stok', url: '#', price: 289.90 },
      { name: 'Renner Casa', url: '#', price: 269.00 },
    ])
  },
];

const insertMany = db.transaction((items) => {
  for (const p of items) {
    insertProduct.run(
      p.name, p.description, p.creative_text, p.price,
      p.category_id, p.status, p.priority, p.badge,
      p.image_url, p.specs, p.suppliers
    );
  }
});

insertMany(products);
console.log(`✅ ${products.length} produtos inseridos.`);

// ────────────────────────────────────────────────
// CONTRIBUIÇÕES MOCKADAS
// ────────────────────────────────────────────────
const insertContrib = db.prepare(`
  INSERT OR IGNORE INTO contributions (name, phone, email, amount, payment_status, message, confirmed_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const contributions = [
  { name: 'Tia Rosana', phone: '11999990001', email: 'rosana@email.com', amount: 150, status: 'confirmado', message: 'Com muito amor pra vocês três! 🏠', date: '2024-03-10 14:30:00' },
  { name: 'Madrinha Cláudia', phone: '11999990002', email: null, amount: 200, status: 'confirmado', message: 'Vida nova, lar abençoado!', date: '2024-03-12 10:00:00' },
  { name: 'Amigo Paulão', phone: '11999990003', email: 'paulo@email.com', amount: 100, status: 'confirmado', message: 'Vai lá família! Casa nova vem aí', date: '2024-03-15 18:00:00' },
  { name: 'Vovó Neuza', phone: '11999990004', email: null, amount: 300, status: 'confirmado', message: 'Deus abençoe vocês sempre meus amores', date: '2024-03-18 09:00:00' },
  { name: 'Prima Ana Laura', phone: '11999990005', email: 'analaura@email.com', amount: 80, status: 'pendente', message: null, date: null },
];

contributions.forEach(c => insertContrib.run(c.name, c.phone, c.email, c.amount, c.status, c.message, c.date));
console.log(`✅ ${contributions.length} contribuições inseridas.`);

// ────────────────────────────────────────────────
// NÚMEROS DO SORTEIO MOCKADOS
// ────────────────────────────────────────────────
const insertRaffle = db.prepare(`
  INSERT OR IGNORE INTO raffle_numbers (number, name, phone, status, amount, payment_status, paid_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const raffleNumbers = [
  { number: 7, name: 'João Carlos', phone: '11999990010', status: 'pago', amount: 10, payment: 'confirmado', date: '2024-03-10 12:00:00' },
  { number: 13, name: 'Maria Fernanda', phone: '11999990011', status: 'pago', amount: 10, payment: 'confirmado', date: '2024-03-11 09:00:00' },
  { number: 42, name: 'Bruno Santos', phone: '11999990012', status: 'pago', amount: 10, payment: 'confirmado', date: '2024-03-12 15:00:00' },
  { number: 77, name: 'Patrícia Lima', phone: '11999990013', status: 'pago', amount: 10, payment: 'confirmado', date: '2024-03-13 10:00:00' },
  { number: 100, name: 'Carlos Eduardo', phone: '11999990014', status: 'pago', amount: 10, payment: 'confirmado', date: '2024-03-14 14:00:00' },
  { number: 333, name: 'Luciana Ferreira', phone: '11999990015', status: 'reservado', amount: 10, payment: 'pendente', date: null },
  { number: 500, name: 'Ricardo Alves', phone: '11999990016', status: 'reservado', amount: 10, payment: 'pendente', date: null },
  { number: 777, name: 'Sandra Costa', phone: '11999990017', status: 'pago', amount: 10, payment: 'confirmado', date: '2024-03-16 11:00:00' },
  { number: 999, name: 'Marcos Vinícius', phone: '11999990018', status: 'pago', amount: 10, payment: 'confirmado', date: '2024-03-17 16:00:00' },
];

raffleNumbers.forEach(r => insertRaffle.run(r.number, r.name, r.phone, r.status, r.amount, r.payment, r.date));
console.log(`✅ ${raffleNumbers.length} números do sorteio inseridos.`);

// ────────────────────────────────────────────────
// COMPROVANTE MOCKADO
// ────────────────────────────────────────────────
const lavadora = db.prepare("SELECT id FROM products WHERE name LIKE '%Lavar%'").get();
if (lavadora) {
  db.prepare(`
    INSERT OR IGNORE INTO receipts (product_id, name, phone, email, file_path, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    lavadora.id,
    'Família Oliveira',
    '11999990020',
    'familia@oliveira.com',
    'uploads/receipts/mock-comprovante.pdf',
    'Comprei na Casas Bahia, foi o modelo exato!',
    'aguardando'
  );
  console.log('✅ Comprovante mockado inserido.');
}

console.log('\n🎉 Seed concluído! O banco está pronto.');
console.log('👉 Execute: npm start ou npm run dev');
