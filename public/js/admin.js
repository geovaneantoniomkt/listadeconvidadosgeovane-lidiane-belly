// ================================================
// ADMIN.JS — JavaScript do painel administrativo
// ================================================

(function () {
  'use strict';

  // ─── SIDEBAR MOBILE TOGGLE ───────────────────
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('adminSidebar');

  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });

    // Overlay para fechar sidebar em mobile
    document.addEventListener('click', (e) => {
      if (sidebar.classList.contains('open') &&
          !sidebar.contains(e.target) &&
          e.target !== sidebarToggle) {
        sidebar.classList.remove('open');
      }
    });
  }

  // ─── SLUG AUTO-GENERATE ──────────────────────
  const nameInput = document.querySelector('[data-slug-source]');
  const slugInput = document.querySelector('[name="slug"]');

  if (nameInput && slugInput) {
    nameInput.addEventListener('input', () => {
      const slug = nameInput.value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9 -]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
      if (!slugInput.dataset.manual) {
        slugInput.value = slug;
      }
    });

    slugInput.addEventListener('input', () => {
      slugInput.dataset.manual = 'true';
    });
  }

  // ─── JSON VALIDATION (campos de specs/suppliers) ─
  document.querySelectorAll('textarea[placeholder*="JSON"], textarea[placeholder*="{"]').forEach(textarea => {
    textarea.addEventListener('blur', () => {
      try {
        if (textarea.value.trim()) {
          JSON.parse(textarea.value);
          textarea.style.borderColor = 'var(--color-success)';
        }
      } catch (e) {
        textarea.style.borderColor = 'var(--color-error)';
        window.showToast && window.showToast('JSON inválido no campo: ' + (textarea.getAttribute('name') || ''), 'error');
      }
    });
  });

  // ─── CONFIRM ANTES DE EXCLUIR ────────────────
  document.querySelectorAll('[data-confirm]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (!confirm(btn.dataset.confirm)) {
        e.preventDefault();
      }
    });
  });

  // ─── MODAIS ──────────────────────────────────
  window.openModal = function (id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  };

  window.closeModal = function (id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('active');
      document.body.style.overflow = '';
    }
  };

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });

  // ─── KEYPRESS ESC para fechar modais ─────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(m => closeModal(m.id));
    }
  });

})();
