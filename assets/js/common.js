/* THE THING — utilidades compartidas (sitio público y panel) */
(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v === null ? fallback : JSON.parse(v);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sin almacenamiento */ }
    },
  };

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  /* Formato de texto mínimo y seguro: párrafos, saltos, **negrita**, *cursiva*, [texto](url) */
  function formatText(text) {
    const inline = (s) => escapeHtml(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\n/g, '<br>');
    return String(text || '').trim().split(/\n{2,}/).filter(Boolean).map((p) => `<p>${inline(p)}</p>`).join('');
  }

  function formatDate(iso, style) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    if (style === 'vhs') return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
    if (style === 'time') return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return d.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  /* --- API (PHP en /api) --- */
  async function api(path, options = {}) {
    const opts = { credentials: 'same-origin', ...options, headers: { 'X-Requested-With': 'TheThing', ...(options.headers || {}) } };
    if (opts.json !== undefined) {
      opts.method = opts.method || 'POST';
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.json);
      delete opts.json;
    }
    const res = await fetch(path, opts);
    let data = null;
    try { data = await res.json(); } catch { /* respuesta vacía o no JSON */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Error ${res.status}`);
      err.status = res.status;
      throw err;
    }
    if (data === null) throw new Error('Respuesta inválida del servidor');
    return data;
  }

  /* --- Sonidos 8 bits (WebAudio), desactivados por defecto --- */
  let audioCtx = null;
  let soundOn = store.get('tt-sound', false);
  function beep(kind = 'blip') {
    if (!soundOn) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const t = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'square';
      const presets = {
        blip: [[880, 0], [1320, 0.03]],
        select: [[523, 0], [784, 0.06], [1046, 0.12]],
        back: [[600, 0], [300, 0.08]],
        error: [[200, 0], [140, 0.1]],
        coin: [[988, 0], [1319, 0.08]],
      };
      const steps = presets[kind] || presets.blip;
      steps.forEach(([f, at]) => osc.frequency.setValueAtTime(f, t + at));
      const dur = steps[steps.length - 1][1] + 0.09;
      gain.gain.setValueAtTime(0.05, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + dur);
    } catch { /* sin audio */ }
  }
  function setSound(on) {
    soundOn = on;
    store.set('tt-sound', on);
    document.querySelectorAll('[data-sound-toggle]').forEach((b) => b.setAttribute('aria-pressed', String(on)));
    if (on) beep('coin');
  }

  /* --- Efectos CRT activables --- */
  function setFx(on) {
    document.body.classList.toggle('fx-on', on);
    document.body.classList.toggle('fx-off', !on);
    store.set('tt-fx', on);
    document.querySelectorAll('[data-fx-toggle]').forEach((b) => b.setAttribute('aria-pressed', String(on)));
  }

  /* --- Toasts --- */
  function toast(message, type = 'ok') {
    let wrap = document.querySelector('.toasts');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toasts';
      wrap.setAttribute('role', 'status');
      wrap.setAttribute('aria-live', 'polite');
      document.body.appendChild(wrap);
    }
    const el = document.createElement('div');
    el.className = `toast${type === 'error' ? ' toast--error' : ''}`;
    el.textContent = `> ${message}`;
    wrap.appendChild(el);
    beep(type === 'error' ? 'error' : 'blip');
    setTimeout(() => {
      el.classList.add('out');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }, 3200);
  }

  /* --- Transición entre páginas (TV que se apaga/enciende) --- */
  function initPageTransitions() {
    const shutter = document.createElement('div');
    shutter.className = 'page-shutter';
    document.body.appendChild(shutter);

    if (!reduceMotion && sessionStorage.getItem('tt-transition') === '1') {
      sessionStorage.removeItem('tt-transition');
      shutter.classList.add('opening');
      shutter.addEventListener('animationend', () => shutter.classList.remove('opening'), { once: true });
    }

    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-transition]');
      if (!a || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
      if (reduceMotion) return;
      if (a.pathname === location.pathname && a.search === location.search && a.hash) return;   // misma página: solo desplaza
      e.preventDefault();
      beep('select');
      try { sessionStorage.setItem('tt-transition', '1'); } catch { /* ignore */ }
      shutter.classList.add('closing');
      setTimeout(() => { window.location.href = a.href; }, 430);
    });
    // Al volver con el botón "atrás" desde la caché del navegador
    window.addEventListener('pageshow', (e) => { if (e.persisted) shutter.classList.remove('closing'); });
  }

  /* --- Modal genérico con animación CRT --- */
  function createModal(extraClass = '') {
    const modal = document.createElement('div');
    modal.className = `modal ${extraClass}`.trim();
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = '<div class="modal__backdrop" data-close></div><div class="modal__panel" tabindex="-1"></div>';
    document.body.appendChild(modal);
    const panel = modal.querySelector('.modal__panel');
    let lastFocus = null;
    let onClose = null;

    function open(html, closeCb) {
      lastFocus = document.activeElement;
      onClose = closeCb || null;
      panel.innerHTML = html;
      panel.scrollTop = 0;
      modal.classList.remove('closing');
      modal.classList.add('open');
      document.documentElement.style.overflow = 'hidden';
      beep('select');
      setTimeout(() => (panel.querySelector('[data-autofocus]') || panel).focus({ preventScroll: true }), 50);
    }
    function close() {
      if (!modal.classList.contains('open')) return;
      modal.classList.remove('open');
      modal.classList.add('closing');
      beep('back');
      const done = () => {
        modal.classList.remove('closing');
        if (!document.querySelector('.modal.open')) document.documentElement.style.overflow = '';
      };
      if (reduceMotion) done();
      else setTimeout(done, 400);
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
      if (onClose) onClose();
    }
    modal.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', (e) => {
      if (!modal.classList.contains('open')) return;
      const opened = document.querySelectorAll('.modal.open');
      if (opened[opened.length - 1] !== modal) return;   // solo actúa la ventana de arriba
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') {     // mantiene el foco dentro del modal
        const f = panel.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    return { open, close, el: modal, panel, isOpen: () => modal.classList.contains('open') };
  }

  /* --- Inicialización común --- */
  let commonDone = false;
  function initCommon() {
    if (commonDone) return;
    commonDone = true;
    setFx(reduceMotion ? false : store.get('tt-fx', true));
    document.querySelectorAll('[data-sound-toggle]').forEach((b) => {
      b.setAttribute('aria-pressed', String(soundOn));
      b.addEventListener('click', () => setSound(!soundOn));
    });
    document.querySelectorAll('[data-fx-toggle]').forEach((b) => {
      b.addEventListener('click', () => { setFx(!document.body.classList.contains('fx-on')); beep('blip'); });
    });
    document.addEventListener('pointerenter', (e) => {
      if (e.target instanceof Element && e.target.matches('.btn, .menu a, .cart, .tape, .shot, .icon-btn, .admin-nav button')) beep('blip');
    }, true);
    initPageTransitions();
  }

  /* --- Redes sociales (iconos compartidos por la web y el panel) --- */
  const icon = (inner) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  const SOCIALS = [
    { key: 'youtube', name: 'YouTube', color: '#ff3355', hint: '@tucanal', icon: icon('<rect x="2" y="5" width="20" height="14" rx="4"/><path d="M10 9l5 3-5 3z" fill="currentColor"/>') },
    { key: 'tiktok', name: 'TikTok', color: '#38e8ff', hint: '@tuusuario', icon: icon('<path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.6 2.6 2.6 4.4 5.5 4.6"/>') },
    { key: 'instagram', name: 'Instagram', color: '#ff7ad9', hint: '@tuusuario', icon: icon('<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/>') },
    { key: 'x', name: 'X', color: '#ebe6d8', hint: '@tuusuario', icon: icon('<path d="M4 4l16 16M20 4L4 20"/>') },
    { key: 'discord', name: 'Discord', color: '#b18cff', hint: 'código de invitación o enlace', icon: icon('<path d="M7 7.5c3.3-1.6 6.7-1.6 10 0l2 8.5c-1.7 1.4-3.7 2.2-3.7 2.2l-1.1-1.8c-1.4.4-3 .4-4.4 0l-1.1 1.8S6.7 17.4 5 16z"/><circle cx="9.5" cy="12.5" r=".8" fill="currentColor"/><circle cx="14.5" cy="12.5" r=".8" fill="currentColor"/>') },
    { key: 'facebook', name: 'Facebook', color: '#7ad7ff', hint: 'tupagina', icon: icon('<path d="M14 8.5h3V5h-3a4 4 0 0 0-4 4v2.5H7.5V15H10v6h3.5v-6H16l.7-3.5h-3.2V9a.5.5 0 0 1 .5-.5z"/>') },
    { key: 'twitch', name: 'Twitch', color: '#b18cff', hint: 'tucanal', icon: icon('<path d="M4 3h16v11l-4 4h-4l-3 3v-3H4z"/><path d="M11 8v4M15 8v4"/>') },
    { key: 'googleplay', name: 'Google Play', color: '#6bff7f', hint: 'nombre de desarrollador o enlace', icon: icon('<path d="M5 3l14 9-14 9z"/><path d="M5 3l9.5 9L5 21"/>') },
    { key: 'steam', name: 'Steam', color: '#7ad7ff', hint: 'enlace de tu página de Steam', icon: icon('<circle cx="15.5" cy="8.5" r="3.5"/><circle cx="8.5" cy="16" r="2.5"/><path d="M10.8 14.6l2.6-3.2M2 13.5l4.3 1.7"/>') },
    { key: 'itchio', name: 'itch.io', color: '#ff5f6d', hint: 'tuusuario (de tuusuario.itch.io)', icon: icon('<path d="M3 9l2-5h14l2 5"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M4 11v9h16v-9"/><path d="M10 20v-4h4v4"/>') },
  ];

  window.TT = { api, escapeHtml, formatText, formatDate, beep, toast, createModal, store, reduceMotion, initCommon, SOCIALS };
})();
