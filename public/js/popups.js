// ================================================
// POPUPS.JS — Popup de boas-vindas e intenção de saída
// ================================================

(function () {
  'use strict';

  const WELCOME_DELAY = 4000;       // 4 segundos após entrar
  const SESSION_KEY = 'popup_shown'; // Key do sessionStorage

  // Evita mostrar o popup mais de uma vez por sessão
  function hasSeenPopup(key) {
    return sessionStorage.getItem(key) === '1';
  }

  function markPopupSeen(key) {
    sessionStorage.setItem(key, '1');
  }

  // Abre popup
  window.openPopup = function (id) {
    const overlay = document.getElementById(id);
    if (overlay) {
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  };

  // Fecha popup
  window.closePopup = function (id) {
    const overlay = document.getElementById(id);
    if (overlay) {
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }
    markPopupSeen(id);
  };

  // ─── POPUP DE BOAS-VINDAS ─────────────────────
  function initWelcomePopup() {
    const popup = document.getElementById('welcomePopup');
    if (!popup) return;
    if (hasSeenPopup('welcomePopup')) return;

    setTimeout(() => {
      openPopup('welcomePopup');
    }, WELCOME_DELAY);

    // Fechar clicando fora
    popup.addEventListener('click', (e) => {
      if (e.target === popup) closePopup('welcomePopup');
    });
  }

  // ─── POPUP DE INTENÇÃO DE SAÍDA ───────────────
  function initExitPopup() {
    const popup = document.getElementById('exitPopup');
    if (!popup) return;
    if (hasSeenPopup('exitPopup')) return;

    let triggered = false;

    const onMouseLeave = (e) => {
      if (triggered) return;
      if (e.clientY <= 0 || e.relatedTarget === null) {
        triggered = true;
        openPopup('exitPopup');
      }
    };

    // Desktop: detecta quando o mouse sai pelo topo
    document.addEventListener('mouseleave', onMouseLeave);

    // Mobile: detecta visibilidade da página (app switch / home button)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && !triggered && !hasSeenPopup('exitPopup')) {
        triggered = true;
        openPopup('exitPopup');
      }
    });

    // Fechar clicando fora
    popup.addEventListener('click', (e) => {
      if (e.target === popup) closePopup('exitPopup');
    });
  }

  // Inicia após carregamento
  document.addEventListener('DOMContentLoaded', () => {
    initWelcomePopup();
    initExitPopup();
  });

})();
