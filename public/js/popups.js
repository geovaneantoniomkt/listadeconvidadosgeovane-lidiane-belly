// ================================================
// POPUPS.JS — Popup de boas-vindas e intenção de saída
// ================================================

(function () {
  'use strict';

  const WELCOME_DELAY   = 4000;                    // 4s após entrar na página
  const WELCOME_LS_KEY  = 'casa_welcome_seen';     // localStorage: mostra 1x por usuário
  const EXIT_SS_KEY     = 'casa_exit_seen';        // sessionStorage: mostra 1x por sessão

  // ─── Helpers ──────────────────────────────────
  window.openPopup = function (id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  };

  window.closePopup = function (id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('active');
      document.body.style.overflow = '';
    }
    if (id === 'welcomePopup') localStorage.setItem(WELCOME_LS_KEY, '1');
    if (id === 'exitPopup')    sessionStorage.setItem(EXIT_SS_KEY, '1');
  };

  // ─── POPUP DE BOAS-VINDAS ─────────────────────
  // Aparece em QUALQUER página, mas apenas 1x por usuário (localStorage)
  function initWelcomePopup() {
    const popup = document.getElementById('welcomePopup');
    if (!popup) return;
    if (localStorage.getItem(WELCOME_LS_KEY) === '1') return;

    setTimeout(() => {
      // Só abre se o exit popup não estiver ativo
      if (!document.getElementById('exitPopup')?.classList.contains('active')) {
        openPopup('welcomePopup');
      }
    }, WELCOME_DELAY);

    popup.addEventListener('click', (e) => {
      if (e.target === popup) closePopup('welcomePopup');
    });
  }

  // ─── POPUP DE SAÍDA ───────────────────────────
  // Aparece APENAS em /presentes e /sorteio, 1x por sessão
  function initExitPopup() {
    const popup = document.getElementById('exitPopup');
    if (!popup) return;
    if (sessionStorage.getItem(EXIT_SS_KEY) === '1') return;

    let triggered = false;

    function dispararExitPopup() {
      if (triggered) return;
      // Não mostra se o welcome popup ainda estiver aberto
      if (document.getElementById('welcomePopup')?.classList.contains('active')) return;
      triggered = true;
      openPopup('exitPopup');
    }

    // Desktop: mouse saindo pelo topo da janela
    document.addEventListener('mouseleave', (e) => {
      if (e.clientY <= 0 || e.relatedTarget === null) {
        dispararExitPopup();
      }
    });

    // Mobile: usuário minimiza o app / troca de aba
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) dispararExitPopup();
    });

    popup.addEventListener('click', (e) => {
      if (e.target === popup) closePopup('exitPopup');
    });
  }

  // ─── Init ─────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    initWelcomePopup();
    initExitPopup();
  });

})();
