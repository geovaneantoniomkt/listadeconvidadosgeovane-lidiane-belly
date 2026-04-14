// ================================================
// MAIN.JS — JavaScript principal do site
// ================================================

(function () {
  'use strict';

  // ─── HEADER SCROLL ───────────────────────────
  const header = document.getElementById('siteHeader');
  if (header) {
    const onScroll = () => {
      header.classList.toggle('scrolled', window.scrollY > 20);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ─── MENU MOBILE ─────────────────────────────
  const menuToggle = document.getElementById('menuToggle');
  const mobileNav = document.getElementById('mobileNav');

  if (menuToggle && mobileNav) {
    menuToggle.addEventListener('click', () => {
      const isOpen = mobileNav.classList.contains('active');
      mobileNav.classList.toggle('active', !isOpen);
      mobileNav.style.display = isOpen ? 'none' : 'flex';
      menuToggle.classList.toggle('open', !isOpen);
      document.body.style.overflow = isOpen ? '' : 'hidden';
    });

    // Fecha ao clicar nos links
    mobileNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileNav.classList.remove('active');
        mobileNav.style.display = 'none';
        menuToggle.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }

  // ─── INTERSECTION OBSERVER (Animações ao scroll) ──
  const observerOptions = {
    root: null,
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, observerOptions);

  document.querySelectorAll(
    '.fade-in, .slide-in-left, .slide-in-right, .scale-in, .stagger-children'
  ).forEach(el => observer.observe(el));

  // ─── PROGRESS BAR ANIMAÇÃO ───────────────────
  const progressBars = document.querySelectorAll('[data-target]');
  const progressObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const bar = entry.target;
        const target = parseFloat(bar.dataset.target) || 0;
        setTimeout(() => {
          bar.style.width = Math.min(100, target) + '%';
        }, 300);
        progressObserver.unobserve(bar);
      }
    });
  }, { threshold: 0.3 });

  progressBars.forEach(bar => progressObserver.observe(bar));

  // ─── TOASTS ──────────────────────────────────
  window.showToast = function (msg, type = 'info', duration = 4000) {
    const icons = { success: '✅', error: '⚠️', info: 'ℹ️', warning: '⚠️' };
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
      <div class="toast-content">
        <div class="toast-msg">${msg}</div>
      </div>
      <button onclick="this.parentElement.remove()" style="background:none;border:none;cursor:pointer;margin-left:auto;color:var(--color-text-muted);font-size:1rem;">✕</button>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
  };

  // ─── FLASH MESSAGES → TOASTS ─────────────────
  // Converte alerts existentes em toasts automaticamente
  document.querySelectorAll('.alert').forEach(alert => {
    const type = alert.classList.contains('alert-success') ? 'success'
               : alert.classList.contains('alert-error') ? 'error'
               : alert.classList.contains('alert-warning') ? 'warning'
               : 'info';
    // Não converte — apenas adiciona auto-hide
    setTimeout(() => {
      alert.style.transition = 'opacity 0.5s ease';
      alert.style.opacity = '0';
      setTimeout(() => alert.remove(), 500);
    }, 6000);
  });

  // ─── MODAIS ───────────────────────────────────
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

  // Fechar modal clicando fora
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay.id);
      }
    });
  });

  // ─── BOTÕES RIPPLE ───────────────────────────
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', function (e) {
      this.classList.add('rippling');
      setTimeout(() => this.classList.remove('rippling'), 400);
    });
  });

  // ─── SMOOTH SCROLL para âncoras ──────────────
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ─── CONFETE ─────────────────────────────────
  window.launchConfetti = function () {
    const colors = ['#3D5A4A', '#B5705A', '#C4963A', '#527A65', '#C9897A', '#ffffff'];
    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);

    for (let i = 0; i < 80; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      const color = colors[Math.floor(Math.random() * colors.length)];
      piece.style.cssText = `
        left: ${Math.random() * 100}%;
        background: ${color};
        --duration: ${2 + Math.random() * 2}s;
        --delay: ${Math.random() * 1.5}s;
        --drift: ${(Math.random() - 0.5) * 200}px;
        width: ${6 + Math.random() * 8}px;
        height: ${6 + Math.random() * 8}px;
        border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      `;
      container.appendChild(piece);
    }

    setTimeout(() => container.remove(), 5000);
  };

  // ─── FORMAT CURRENCY (utilitário) ────────────
  window.formatCurrency = function (value) {
    return parseFloat(value).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  // ─── UPLOAD PREVIEW ──────────────────────────
  window.updateUploadArea = function (input) {
    if (!input.files || !input.files[0]) return;
    const area = input.closest('.upload-area');
    if (!area) return;
    area.querySelector('.upload-text').textContent = `📎 ${input.files[0].name}`;
    area.style.borderColor = 'var(--color-success)';
    area.style.background = 'var(--color-success-soft)';
    const preview = document.getElementById('filePreview');
    const fileName = document.getElementById('fileName');
    if (preview) preview.style.display = 'block';
    if (fileName) fileName.textContent = input.files[0].name;
  };

  // ─── DRAG AND DROP NO UPLOAD ─────────────────
  document.querySelectorAll('.upload-area').forEach(area => {
    area.addEventListener('dragover', (e) => {
      e.preventDefault();
      area.classList.add('drag-over');
    });
    area.addEventListener('dragleave', () => area.classList.remove('drag-over'));
    area.addEventListener('drop', (e) => {
      e.preventDefault();
      area.classList.remove('drag-over');
      const input = area.querySelector('input[type="file"]');
      if (input && e.dataTransfer.files.length > 0) {
        input.files = e.dataTransfer.files;
        window.updateUploadArea(input);
      }
    });
  });

  console.log('🏠 Casa Nova Geovane & Lidiane — carregado com amor!');
})();
