// ================================================
// LISTA DE PRESENTES — CASA NOVA GEOVANE & LIDIANE
// ================================================
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ────────────────────────────────────────────────
// VIEW ENGINE
// ────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ────────────────────────────────────────────────
// MIDDLEWARES
// ────────────────────────────────────────────────
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(methodOverride('_method'));

app.use(session({
  secret: process.env.SESSION_SECRET || 'casa-nova-segredo-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24h
}));

app.use(flash());

// Variáveis globais para as views
app.use((req, res, next) => {
  res.locals.flash = req.flash();
  res.locals.isAdmin = req.session?.admin || false;
  res.locals.siteUrl = process.env.SITE_URL || `http://localhost:${PORT}`;
  next();
});

// Arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ────────────────────────────────────────────────
// ROTAS
// ────────────────────────────────────────────────
const publicRoutes = require('./src/routes/index');
const adminRoutes = require('./src/routes/admin');

app.use('/admin', adminRoutes);
app.use('/', publicRoutes);

// ────────────────────────────────────────────────
// START
// ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('🏠 ================================');
  console.log('🏠  LISTA DE PRESENTES — CASA NOVA');
  console.log(`🏠  http://localhost:${PORT}`);
  console.log('🏠 ================================');
  console.log('');
  console.log(`📋  Lista de presentes: http://localhost:${PORT}/presentes`);
  console.log(`🎰  Sorteio:            http://localhost:${PORT}/sorteio`);
  console.log(`🎯  Meta:               http://localhost:${PORT}/meta`);
  console.log(`🔐  Admin:              http://localhost:${PORT}/admin/login`);
  console.log('');
  console.log('💡  Para inserir dados de exemplo: npm run seed');
  console.log('');
});

module.exports = app;
