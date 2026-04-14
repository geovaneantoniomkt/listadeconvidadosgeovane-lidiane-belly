# 🏠 Lista de Presentes — Casa Nova Geovane & Lidiane

> Site completo de lista de presentes de casa nova para a família Geovane, Lidiane e Belly.
> Um mini e-commerce premium com contribuições, sorteio, painel admin e muito carinho.

---

## 🚀 Instalação Rápida

```bash
# 1. Clone o repositório e acesse a pasta
cd listadeconvidadosgeovane-lidiane-belly

# 2. Instale as dependências
npm install

# 3. Configure o ambiente
cp .env.example .env
# Edite o .env conforme necessário

# 4. Popule o banco com dados iniciais
npm run seed

# 5. Inicie o servidor
npm start
# ou em modo desenvolvimento (com reload automático):
npm run dev
```

Acesse: **http://localhost:3000**

---

## 📋 Páginas disponíveis

| Página | URL |
|--------|-----|
| Home | `/` |
| Nossa História | `/nossa-historia` |
| Lista de Presentes | `/presentes` |
| Produto individual | `/presentes/:id` |
| Meta da Família | `/meta` |
| Sorteio | `/sorteio` |
| Agradecimento | `/obrigado` |
| Admin Login | `/admin/login` |
| Admin Dashboard | `/admin/dashboard` |

---

## 🔐 Acesso ao Admin

**URL:** `http://localhost:3000/admin/login`

Configurado no `.env`:
```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=casa2024
```

**⚠️ Troque a senha antes de publicar!**

---

## 💳 Configurar Mercado Pago

1. Acesse [mercadopago.com.br/developers/panel](https://www.mercadopago.com.br/developers/panel)
2. Crie um link de pagamento em **Ferramentas → Link de pagamento**
3. Copie o link e coloque no `.env`:

```env
MERCADOPAGO_LINK_CONTRIBUICAO=https://mpago.la/SEU_LINK_AQUI
```

4. Ou configure diretamente no painel admin em **Configurações → Mercado Pago**

---

## 🖼️ Onde trocar fotos e textos

### Textos da família
- Edite diretamente nos arquivos EJS:
  - `views/pages/home.ejs` — cards da família e hero
  - `views/pages/history.ejs` — história completa

### Fotos
- Coloque as fotos em `public/images/`
- Referencie nos templates como `/images/nome-da-foto.jpg`
- Para produtos: faça upload pelo painel admin ou coloque em `uploads/products/`

### Produtos
- Adicione/edite pelo **Painel Admin → Produtos**
- Ou edite diretamente o arquivo `src/database/seed.js` e rode `npm run seed`

### Meta de arrecadação
- Configure no **Admin → Configurações → Meta**
- Ou no `.env`: `META_TOTAL=15000`

---

## 📁 Estrutura de Pastas

```
├── app.js                  # Servidor Express principal
├── .env.example            # Exemplo de variáveis de ambiente
├── src/
│   ├── database/
│   │   ├── db.js           # Conexão SQLite + criação de tabelas
│   │   └── seed.js         # Dados de exemplo
│   ├── routes/
│   │   ├── index.js        # Rotas públicas
│   │   └── admin.js        # Rotas do admin
│   └── middleware/
│       ├── auth.js         # Autenticação admin
│       └── upload.js       # Upload de arquivos (Multer)
├── views/
│   ├── pages/              # Páginas públicas (EJS)
│   ├── admin/              # Páginas do admin (EJS)
│   └── partials/           # Componentes reutilizáveis
├── public/
│   ├── css/                # Estilos (design system completo)
│   └── js/                 # JavaScript do cliente
├── uploads/
│   ├── receipts/           # Comprovantes dos convidados
│   └── products/           # Imagens dos produtos
└── data/
    └── casa-nova.db        # Banco SQLite (gerado automaticamente)
```

---

## 🛠️ Stack Técnica

- **Backend:** Node.js + Express
- **Templates:** EJS (server-side rendering)
- **Banco:** SQLite (better-sqlite3)
- **Upload:** Multer
- **Sessões:** express-session + connect-flash
- **Frontend:** HTML + CSS vanilla + JavaScript vanilla
- **Fontes:** Playfair Display + Inter (Google Fonts)

---

## 🗺️ Sugestões de Evolução Futura

1. **Integração real Mercado Pago** — webhooks para confirmação automática de pagamentos
2. **E-mails automáticos** — agradecimento ao contribuinte, confirmação ao admin
3. **Galeria de fotos** — carousel nas páginas de produto
4. **Autenticação de contribuinte** — área para ver histórico de contribuições
5. **PWA** — app instalável para convidados
6. **Deploy** — Railway, Render, ou VPS próprio
7. **Backup automático** do banco SQLite
8. **Analytics** — Google Analytics ou Plausible

---

## 💚 Com amor da família

Geovane, Lidiane e Belly agradecem cada ajuda, grande ou pequena.
Cada presente faz parte dessa história. 🏠✨
