/*
 * THE THING — partes comunes de todas las páginas públicas:
 * cabecera con menús desplegables, pie de página, aviso de cookies,
 * botón "volver arriba" y la carga de datos que comparten las páginas.
 */
(function () {
  'use strict';

  const { api, escapeHtml: esc, beep, store, reduceMotion, createModal, toast } = window.TT;
  const $ = (sel, root = document) => root.querySelector(sel);
  const page = document.body.dataset.page || '';

  /* ------------------------------------------------------------------ */
  /* Datos compartidos                                                   */
  /* ------------------------------------------------------------------ */

  const DEFAULT_SETTINGS = {
    legalName: '', tradeName: 'THE THING', taxId: '', address: '', country: '', jurisdiction: '', registry: '',
    email: 'contacto@thethinggame.com', supportEmail: 'soporte@thethinggame.com', privacyEmail: '', minAge: '13',
    youtube: '', tiktok: '', instagram: '', x: '', discord: '', facebook: '', twitch: '', updatedAt: '',
  };

  /* Contenido de ejemplo por si se abre la web en un servidor sin PHP */
  const FALLBACK_CONTENT = [
    { id: 'demo-app', type: 'app', title: 'PROYECTO: THE THING', platform: 'PC', status: 'En desarrollo', featured: true, summary: 'Nuestro primer título. Un survival de terror retro donde nada es lo que parece… ni siquiera el gato.', body: 'Estamos trabajando en nuestro primer juego. Muy pronto compartiremos más detalles.', image: '', link: '', createdAt: '2026-01-02T00:00:00Z' },
    { id: 'demo-news', type: 'news', game: 'demo-app', title: 'Bienvenidos a THE THING', summary: 'Nace un nuevo estudio independiente de videojuegos.', body: 'Hoy encendemos la máquina por primera vez.', image: '', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'demo-d1', type: 'data', title: 'Proyectos en marcha', value: '1', summary: 'Y contando.', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'demo-d2', type: 'data', title: 'Tazas de café', value: '9999', summary: 'Estimación conservadora.', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'demo-img', type: 'image', title: 'El logo', summary: 'La cosa nos observa.', image: 'assets/img/logo.webp', createdAt: '2026-01-01T00:00:00Z' },
  ];

  const ITEM_PAGES = { app: 'juegos.html', news: 'noticias.html', video: 'videos.html', image: 'galeria.html', product: 'tienda.html', data: 'index.html' };
  const itemUrl = (item) => `${ITEM_PAGES[item.type] || 'index.html'}#ver-${encodeURIComponent(item.id)}`;

  const ready = Promise.all([
    api('api/content.php'),
    api('api/community.php?action=summary').catch(() => null),
    api('api/members.php?action=me').catch(() => null),
    api('api/settings.php').catch(() => null),
  ])
    .then(([content, community, session, settings]) => ({
      content, community, session, settings: { ...DEFAULT_SETTINGS, ...(settings || {}) }, online: true,
    }))
    .catch(() => ({ content: FALLBACK_CONTENT, community: null, session: null, settings: { ...DEFAULT_SETTINGS }, online: false }));

  /* ------------------------------------------------------------------ */
  /* Iconos                                                              */
  /* ------------------------------------------------------------------ */

  const svg = (inner, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${inner}</svg>`;
  const ICONS = {
    crt: svg('<rect x="2" y="4" width="20" height="14"/><path d="M8 22h8M12 18v4"/>'),
    sound: svg('<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/>'),
    bell: svg('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'),
    cart: svg('<path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6.2"/><circle cx="9.5" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/>', ' stroke-width="2.5"'),
    user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>', ' stroke-width="2.5"'),
    menu: svg('<path d="M3 6h18M3 12h18M3 18h18"/>'),
    youtube: svg('<rect x="2" y="5" width="20" height="14" rx="4"/><path d="M10 9l5 3-5 3z" fill="currentColor"/>'),
    tiktok: svg('<path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.6 2.6 2.6 4.4 5.5 4.6"/>'),
    instagram: svg('<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/>'),
    x: svg('<path d="M4 4l16 16M20 4L4 20"/>'),
    discord: svg('<path d="M7 7.5c3.3-1.6 6.7-1.6 10 0l2 8.5c-1.7 1.4-3.7 2.2-3.7 2.2l-1.1-1.8c-1.4.4-3 .4-4.4 0l-1.1 1.8S6.7 17.4 5 16z"/><circle cx="9.5" cy="12.5" r=".8" fill="currentColor"/><circle cx="14.5" cy="12.5" r=".8" fill="currentColor"/>'),
    facebook: svg('<path d="M14 8.5h3V5h-3a4 4 0 0 0-4 4v2.5H7.5V15H10v6h3.5v-6H16l.7-3.5h-3.2V9a.5.5 0 0 1 .5-.5z"/>'),
    twitch: svg('<path d="M4 3h16v11l-4 4h-4l-3 3v-3H4z"/><path d="M11 8v4M15 8v4"/>'),
    up: svg('<path d="M12 19V5M5 12l7-7 7 7"/>', ' stroke-width="3"'),
  };
  const SOCIALS = [['youtube', 'YouTube'], ['tiktok', 'TikTok'], ['instagram', 'Instagram'], ['x', 'X'], ['discord', 'Discord'], ['facebook', 'Facebook'], ['twitch', 'Twitch']];
  const COUNTRIES = { AR: 'Argentina', MX: 'México', ES: 'España', CO: 'Colombia', CL: 'Chile', PE: 'Perú', UY: 'Uruguay', US: 'Estados Unidos', OTRO: '' };

  /* ------------------------------------------------------------------ */
  /* Cabecera                                                            */
  /* ------------------------------------------------------------------ */

  const link = (href, label, key) => `<a href="${href}" data-transition${page === key ? ' class="active" aria-current="page"' : ''}>${label}</a>`;

  function headerHtml() {
    return `
    <nav class="nav container" aria-label="Principal">
      <a class="brand" href="index.html" data-transition aria-label="THE THING, ir al inicio">
        <img src="assets/img/logo-small.webp" alt="" width="40" height="44">
        <span>THE THING<small>GAME STUDIO</small></span>
      </a>
      <ul class="menu" id="menu">
        <li class="has-drop${page === 'juegos' ? ' is-current' : ''}">
          ${link('juegos.html', 'JUEGOS', 'juegos')}
          <button class="drop-toggle" type="button" aria-expanded="false" aria-label="Más opciones de juegos">▾</button>
          <div class="drop">
            <div class="drop__col">
              <p class="drop__title">EXPLORAR</p>
              <a href="juegos.html" data-transition>Todos los juegos</a>
              <a href="juegos.html#votos" data-transition>Votaciones</a>
              <a href="videos.html" data-transition>Tráilers y vídeos</a>
              <a href="tienda.html" data-transition>Merch oficial</a>
            </div>
            <div class="drop__col" id="dropGames"><p class="drop__title">DESTACADOS</p><span class="drop__empty">CARGANDO…</span></div>
          </div>
        </li>
        <li>${link('noticias.html', 'NOTICIAS', 'noticias')}</li>
        <li>${link('videos.html', 'VÍDEOS', 'videos')}</li>
        <li>${link('galeria.html', 'GALERÍA', 'galeria')}</li>
        <li class="has-drop${page === 'soporte' ? ' is-current' : ''}">
          ${link('soporte.html', 'SOPORTE', 'soporte')}
          <button class="drop-toggle" type="button" aria-expanded="false" aria-label="Más opciones de soporte">▾</button>
          <div class="drop">
            <div class="drop__col">
              <p class="drop__title">AYUDA</p>
              <a href="soporte.html" data-transition>Centro de ayuda</a>
              <a href="soporte.html#contacto" data-transition>Contactar con soporte</a>
              <a href="soporte.html#seguimiento" data-transition>Seguir mi consulta</a>
            </div>
            <div class="drop__col">
              <p class="drop__title">COMUNIDAD</p>
              <a href="normas.html" data-transition>Normas y seguridad</a>
              <a href="privacidad.html" data-transition>Privacidad</a>
              <button type="button" data-cookie-settings>Configurar cookies</button>
            </div>
          </div>
        </li>
        <li class="menu__extras">
          <button class="icon-btn" type="button" data-fx-toggle aria-pressed="true" title="Efecto CRT">${ICONS.crt}<span class="sr-only">Efecto CRT</span></button>
          <button class="icon-btn" type="button" data-sound-toggle aria-pressed="false" title="Sonido">${ICONS.sound}<span class="sr-only">Sonido</span></button>
        </li>
      </ul>
      <div class="nav__tools">
        <button class="icon-btn fx-tool" type="button" data-fx-toggle aria-pressed="true" title="Efecto CRT">${ICONS.crt}<span class="sr-only">Activar o desactivar efecto CRT</span></button>
        <button class="icon-btn fx-tool" type="button" data-sound-toggle aria-pressed="false" title="Sonido">${ICONS.sound}<span class="sr-only">Activar o desactivar sonido</span></button>
        <button class="icon-btn bell" type="button" id="bellBtn" title="Avisos" hidden>${ICONS.bell}<span class="sr-only">Avisos</span><span class="bell__badge" id="bellBadge" hidden>0</span></button>
        <a class="btn btn--sm store-btn${page === 'tienda' ? ' is-here' : ''}" href="tienda.html" data-transition title="Tienda online (no necesitas cuenta)">${ICONS.cart}<span class="store-label">Tienda</span></a>
        <button class="btn btn--sm acct-btn" type="button" id="acctBtn">${ICONS.user}<span class="acct-label">Entrar</span></button>
        <button class="icon-btn nav__toggle" type="button" id="menuToggle" aria-controls="menu" aria-expanded="false" title="Menú">${ICONS.menu}<span class="sr-only">Abrir menú</span></button>
      </div>
    </nav>`;
  }

  function initHeader() {
    const header = $('#header');
    header.classList.add('site-header');
    header.innerHTML = headerHtml();
    if (document.body.classList.contains('solid-header')) header.classList.add('scrolled');

    let lastY = window.scrollY;
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      header.classList.toggle('scrolled', y > 20 || document.body.classList.contains('solid-header'));
      header.classList.toggle('hidden', y > lastY && y > 400 && !document.body.classList.contains('menu-open') && !header.matches(':focus-within'));
      lastY = y;
    }, { passive: true });

    const toggle = $('#menuToggle');
    const setMenu = (open) => {
      document.body.classList.toggle('menu-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      if (!open) closeDrops();
    };
    toggle.addEventListener('click', () => { setMenu(!document.body.classList.contains('menu-open')); beep('select'); });
    $('#menu').addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });

    // Desplegables: se abren al pasar el ratón (CSS) o con el botón ▾ (teclado y móvil)
    const drops = [...header.querySelectorAll('.has-drop')];
    function closeDrops(except) {
      drops.forEach((d) => {
        if (d === except) return;
        d.classList.remove('open');
        d.querySelector('.drop-toggle').setAttribute('aria-expanded', 'false');
      });
    }
    drops.forEach((d) => {
      const btn = d.querySelector('.drop-toggle');
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = !d.classList.contains('open');
        closeDrops(d);
        d.classList.toggle('open', open);
        btn.setAttribute('aria-expanded', String(open));
        beep('blip');
      });
      d.addEventListener('mouseleave', () => { if (window.matchMedia('(hover: hover) and (min-width: 1181px)').matches) closeDrops(); });
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('.has-drop')) closeDrops(); });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      setMenu(false);
      closeDrops();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Pie de página                                                       */
  /* ------------------------------------------------------------------ */

  function footerHtml() {
    const y = new Date().getFullYear();
    return `
    <div class="footer-top container">
      <div class="footer-brand">
        <a href="index.html" data-transition class="footer-logo" aria-label="THE THING, ir al inicio"><img src="assets/img/logo-small.webp" alt="" width="64" height="70"><span>THE THING<small>GAME STUDIO</small></span></a>
        <p class="footer-follow">SÍGUENOS</p>
        <div class="socials" id="footSocials"></div>
      </div>
      <nav class="footer-cols" aria-label="Pie de página">
        <div>
          <h2>JUEGOS POPULARES</h2>
          <ul id="footGames"><li><a href="juegos.html" data-transition>Todos los juegos</a></li></ul>
        </div>
        <div>
          <h2>COMPAÑÍA</h2>
          <ul>
            <li><a href="noticias.html" data-transition>Noticias</a></li>
            <li><a href="videos.html" data-transition>Vídeos</a></li>
            <li><a href="galeria.html" data-transition>Galería</a></li>
            <li><a href="tienda.html" data-transition>Tienda</a></li>
            <li><a href="soporte.html?tipo=prensa#contacto" data-transition>Prensa y colaboraciones</a></li>
            <li><a href="admin.html" data-transition>Acceso staff</a></li>
          </ul>
        </div>
        <div>
          <h2>SOPORTE</h2>
          <ul>
            <li><a href="soporte.html" data-transition>Centro de ayuda</a></li>
            <li><a href="soporte.html#contacto" data-transition>Contactar</a></li>
            <li><a href="soporte.html#seguimiento" data-transition>Seguir mi consulta</a></li>
            <li><a href="normas.html" data-transition>Normas y seguridad online</a></li>
            <li><a href="soporte.html?tipo=arrepentimiento#contacto" data-transition class="regret">Botón de arrepentimiento</a></li>
          </ul>
        </div>
        <div>
          <h2>LEGAL</h2>
          <ul>
            <li><a href="terminos.html" data-transition>Términos y condiciones</a></li>
            <li><a href="privacidad.html" data-transition>Política de privacidad</a></li>
            <li><a href="cookies.html" data-transition>Política de cookies</a></li>
            <li><button type="button" data-cookie-settings>Configurar cookies</button></li>
            <li><a href="aviso-legal.html" data-transition>Aviso legal</a></li>
          </ul>
        </div>
      </nav>
    </div>
    <div class="footer-bottom">
      <div class="container">
        <button class="to-top-inline" type="button" data-to-top>${ICONS.up} VOLVER ARRIBA</button>
        <p class="footer-copy">© ${y} <span data-site="legalName" data-fallback="THE THING">THE THING</span>. Todos los derechos reservados. THE THING y su logotipo son marcas de sus titulares; el resto de marcas pertenecen a sus respectivos dueños.</p>
        <p class="footer-consumer" data-country-only="AR" hidden>Defensa de las y los consumidores. Para reclamos <a href="https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario" target="_blank" rel="noopener noreferrer">ingrese aquí</a>.</p>
      </div>
    </div>`;
  }

  function initFooter() {
    const foot = $('#footer');
    foot.classList.add('site-footer');
    foot.innerHTML = footerHtml();
    const top = document.createElement('button');
    top.type = 'button';
    top.className = 'to-top';
    top.dataset.toTop = '';
    top.title = 'Volver arriba';
    top.innerHTML = `${ICONS.up}<span class="sr-only">Volver arriba</span>`;
    document.body.appendChild(top);
    window.addEventListener('scroll', () => top.classList.toggle('show', window.scrollY > 700), { passive: true });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('[data-to-top]')) return;
      beep('coin');
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      const target = document.querySelector('main');
      if (target) { target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
    });
  }

  /** Rellena los datos de la empresa ([data-site]) y los bloques por país. */
  function applySettings(s) {
    document.querySelectorAll('[data-site]').forEach((el) => {
      const key = el.dataset.site;
      let v = s[key] || '';
      if (key === 'country') v = COUNTRIES[s.country] || s.country || '';
      if (v) {
        el.textContent = v;
        el.classList.remove('todo');
      } else if (el.dataset.fallback) {
        el.textContent = el.dataset.fallback;
      } else {
        el.textContent = `[${el.dataset.label || 'COMPLETAR'}]`;
        el.classList.add('todo');
      }
    });
    document.querySelectorAll('[data-site-mail]').forEach((a) => {
      const v = s[a.dataset.siteMail] || s.email;
      a.href = `mailto:${v}`;
      if (!a.dataset.keepText) a.textContent = v;
    });
    const code = COUNTRIES[s.country] !== undefined ? s.country : '';
    document.querySelectorAll('[data-country-only]').forEach((el) => {
      const list = el.dataset.countryOnly.split(',');
      el.hidden = !(list.includes(code) || (list.includes('*') && !['AR', 'MX', 'ES'].includes(code)));
    });
    const box = $('#footSocials');
    if (box) {
      const set = SOCIALS.filter(([k]) => s[k]);
      box.innerHTML = set.length
        ? set.map(([k, name]) => `<a class="social" href="${esc(s[k])}" target="_blank" rel="noopener noreferrer" title="${name}">${ICONS[k]}<span class="sr-only">${name}</span></a>`).join('')
        : SOCIALS.slice(0, 5).map(([k, name]) => `<span class="social is-off" title="${name}: muy pronto">${ICONS[k]}<span class="sr-only">${name} (muy pronto)</span></span>`).join('');
    }
  }

  function applyContent(data) {
    const games = data.content.filter((i) => i.type === 'app');
    const votes = (data.community && data.community.votes) || { best: {}, played: {} };
    const score = (g) => (votes.best[g.id] || 0) + (votes.played[g.id] || 0) + (g.featured ? 0.5 : 0);
    const top = [...games].sort((a, b) => score(b) - score(a)).slice(0, 5);
    const foot = $('#footGames');
    if (foot && top.length) {
      foot.innerHTML = top.map((g) => `<li><a href="${itemUrl(g)}" data-transition>${esc(g.title)}</a></li>`).join('')
        + '<li><a href="juegos.html" data-transition>Ver todos ▶</a></li>';
    }
    const drop = $('#dropGames');
    if (drop) {
      drop.innerHTML = '<p class="drop__title">DESTACADOS</p>' + (top.slice(0, 4).map((g) => `
        <a href="${itemUrl(g)}" data-transition class="drop__game">
          <span class="drop__thumb">${g.image ? `<img src="${esc(g.image)}" alt="" loading="lazy">` : '<img src="assets/img/logo-small.webp" alt="">'}</span>
          <span>${esc(g.title)}${g.status ? `<small>${esc(g.status)}</small>` : ''}</span>
        </a>`).join('') || '<span class="drop__empty">PRÓXIMAMENTE</span>');
    }
  }

  /* ------------------------------------------------------------------ */
  /* Cookies: solo técnicas por defecto; vídeos de terceros con permiso  */
  /* ------------------------------------------------------------------ */

  const CONSENT_KEY = 'tt-consent';
  const CONSENT_VERSION = 1;
  const consentListeners = [];
  const getConsent = () => {
    const c = store.get(CONSENT_KEY, null);
    // La elección se vuelve a pedir a los 12 meses
    return c && c.v === CONSENT_VERSION && Date.now() - new Date(c.at).getTime() < 365 * 86400000 ? c : null;
  };
  let bar = null;
  const settingsModal = createModal('modal--small');

  function setConsent(media) {
    const c = { v: CONSENT_VERSION, media: !!media, at: new Date().toISOString() };
    store.set(CONSENT_KEY, c);
    if (bar) {
      bar.classList.add('out');
      const b = bar;
      setTimeout(() => b.remove(), 400);
      bar = null;
    }
    consentListeners.forEach((fn) => fn(c));
  }

  function showBar() {
    if (bar || getConsent()) return;
    bar = document.createElement('section');
    bar.className = 'cookie-bar';
    bar.setAttribute('aria-label', 'Aviso de cookies');
    bar.innerHTML = `
      <div class="cookie-bar__text">
        <p class="cookie-bar__title">▣ COOKIES</p>
        <p>Usamos cookies técnicas, imprescindibles para que la web funcione (tu sesión y la verificación anti-robots). No usamos cookies de publicidad ni de analítica.
        Si nos das permiso, también cargaremos vídeos de YouTube y Vimeo, que pueden instalar sus propias cookies. <a href="cookies.html">Más información</a></p>
      </div>
      <div class="cookie-bar__btns">
        <button class="btn btn--sm" type="button" data-consent="reject">Solo necesarias</button>
        <button class="btn btn--sm" type="button" data-consent="accept">Aceptar todas</button>
        <button class="linkish" type="button" data-consent="settings">Configurar</button>
      </div>`;
    document.body.appendChild(bar);
    fixAccents(bar);
  }

  function openCookieSettings() {
    const c = getConsent();
    settingsModal.open(`
      <button class="icon-btn modal__close" type="button" data-close title="Cerrar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg><span class="sr-only">Cerrar</span>
      </button>
      <div class="auth cookie-settings">
        <h2>CONFIGURAR COOKIES</h2>
        <p class="auth__sub">Elige qué permites. Puedes cambiarlo cuando quieras desde el pie de página.</p>
        <div class="cookie-cat">
          <div><b>NECESARIAS</b><p>Sesión de tu cuenta, seguridad (anti-robots, límites de intentos) y tus preferencias de la web (sonido, efecto CRT, esta elección). Sin ellas la web no funciona.</p></div>
          <span class="cookie-cat__fixed">SIEMPRE ACTIVAS</span>
        </div>
        <label class="cookie-cat">
          <div><b>VÍDEOS DE TERCEROS</b><p>Reproductores de YouTube (modo de privacidad mejorada) y Vimeo en el videoclub. Estos servicios pueden guardar cookies y conocer tu IP.</p></div>
          <span class="switch"><input type="checkbox" id="consentMedia"${c && c.media ? ' checked' : ''}><i aria-hidden="true"></i><span class="sr-only">Permitir vídeos de terceros</span></span>
        </label>
        <div class="cookie-settings__btns">
          <button class="btn btn--sm" type="button" id="consentReject">Rechazar opcionales</button>
          <button class="btn btn--sm btn--solid" type="button" id="consentSave">Guardar elección</button>
        </div>
        <p class="auth__sub" style="margin-top:16px"><a href="cookies.html">Política de cookies</a></p>
      </div>`);
    fixAccents(settingsModal.panel);
    $('#consentSave').addEventListener('click', () => { setConsent($('#consentMedia').checked); settingsModal.close(); toast('PREFERENCIAS DE COOKIES GUARDADAS'); });
    $('#consentReject').addEventListener('click', () => { setConsent(false); settingsModal.close(); toast('SOLO COOKIES NECESARIAS'); });
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-consent]');
    if (b) {
      if (b.dataset.consent === 'settings') return openCookieSettings();
      setConsent(b.dataset.consent === 'accept');
      beep(b.dataset.consent === 'accept' ? 'coin' : 'blip');
      return;
    }
    if (e.target.closest('[data-cookie-settings]')) openCookieSettings();
  });

  /* ------------------------------------------------------------------ */
  /* Tildes en títulos pixelados: la fuente Press Start 2P dibuja las     */
  /* mayúsculas acentuadas como minúsculas, así que se pinta la letra     */
  /* base en mayúscula y la tilde encima con CSS.                         */
  /* ------------------------------------------------------------------ */

  const ACCENTS = { á: ['A', 'acute'], é: ['E', 'acute'], í: ['I', 'acute'], ó: ['O', 'acute'], ú: ['U', 'acute'], ñ: ['N', 'tilde'], ü: ['U', 'dier'] };
  function fixAccents(root = document) {
    root.querySelectorAll('.page-title, .section-title, .hero__title, .footer-cols h2, .footer-follow, .footer-logo span, .drop__title, .tile__name, .legal__sec h2, .legal__toc-title, .topic__name, .cookie-bar__title, .support-note__title, .store-hero__sign, .bookcase__sign, .auth h2, .cookie-cat b').forEach((el) => {
      if (el.dataset.acc) return;
      el.dataset.acc = '1';
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach((node) => {
        if (!/[áéíóúñüÁÉÍÓÚÑÜ]/.test(node.nodeValue)) return;
        const frag = document.createDocumentFragment();
        node.nodeValue.split(/([áéíóúñüÁÉÍÓÚÑÜ])/).forEach((part) => {
          const a = ACCENTS[part.toLowerCase()];
          if (!a || part.length !== 1) { if (part) frag.appendChild(document.createTextNode(part)); return; }
          const span = document.createElement('span');
          span.className = `acc acc--${a[1]}`;
          span.textContent = a[0];
          frag.appendChild(span);
        });
        node.parentNode.replaceChild(frag, node);
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Código Konami: ↑ ↑ ↓ ↓ ← → ← → B A                                  */
  /* ------------------------------------------------------------------ */

  function initKonami() {
    const code = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let pos = 0;
    document.addEventListener('keydown', (e) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      pos = key === code[pos] ? pos + 1 : (key === code[0] ? 1 : 0);
      if (pos === code.length) {
        pos = 0;
        document.body.classList.add('chaos');
        toast('MODO CAOS ACTIVADO. LA COSA DESPERTÓ.');
        beep('select');
        setTimeout(() => document.body.classList.remove('chaos'), 4000);
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Arranque                                                            */
  /* ------------------------------------------------------------------ */

  initHeader();
  initFooter();
  window.TT.initCommon();
  initKonami();
  fixAccents();
  applySettings(DEFAULT_SETTINGS);
  ready.then((data) => {
    applySettings(data.settings);
    applyContent(data);
  });
  if (page !== 'home') showBar();      // en la portada aparece después de la pantalla de arranque

  window.TT.site = {
    ready, page, itemUrl, icons: ICONS, countries: COUNTRIES, fixAccents,
    showCookieBar: showBar,
    consent: {
      media: () => !!(getConsent() || {}).media,
      decided: () => !!getConsent(),
      allowMedia: () => setConsent(true),
      open: openCookieSettings,
      onChange: (fn) => consentListeners.push(fn),
    },
  };
})();
