// ================================================
// MIDDLEWARE DE AUTENTICAÇÃO DO ADMIN
// ================================================

function requireAuth(req, res, next) {
  if (req.session && req.session.admin) {
    return next();
  }
  req.flash('error', 'Você precisa fazer login para acessar o painel.');
  res.redirect('/admin/login');
}

function redirectIfAuth(req, res, next) {
  if (req.session && req.session.admin) {
    return res.redirect('/admin/dashboard');
  }
  next();
}

module.exports = { requireAuth, redirectIfAuth };
