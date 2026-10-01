/* THE THING — sitio público */
(function () {
  'use strict';

  const { api, escapeHtml: esc, formatText, formatDate, beep, createModal, reduceMotion } = window.TT;
  const $ = (sel, root = document) => root.querySelector(sel);

  window.TT.initCommon();
  $('#year').textContent = new Date().getFullYear();

  /* Contenido de ejemplo por si se abre el HTML sin el servidor PHP */
  const DEMO = [
    { id: 'demo-app', type: 'app', title: 'PROYECTO: THE THING', platform: 'PC', status: 'En desarrollo', featured: true, summary: 'Nuestro primer título. Un survival de terror retro donde nada es lo que parece… ni siquiera el gato.', body: 'Estamos trabajando en nuestro primer juego. Muy pronto compartiremos más detalles.', image: '', link: '', createdAt: '2026-01-02T00:00:00Z' },
    { id: 'demo-news', type: 'news', title: 'Bienvenidos a THE THING', summary: 'Nace un nuevo estudio independiente de videojuegos.', body: 'Hoy encendemos la máquina por primera vez.', image: '', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'demo-d1', type: 'data', title: 'Proyectos en marcha', value: '1', summary: 'Y contando.', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'demo-d2', type: 'data', title: 'Tazas de café', value: '9999', summary: 'Estimación conservadora.', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'demo-img', type: 'image', title: 'El logo', summary: 'La cosa nos observa.', image: 'assets/img/logo.webp', createdAt: '2026-01-01T00:00:00Z' },
  ];

  /* ------------------------------------------------------------------ */
  /* Pantalla de arranque                                                */
  /* ------------------------------------------------------------------ */

  function runBoot() {
    const boot = $('#boot');
    let seen = false;
    try { seen = sessionStorage.getItem('tt-booted') === '1'; } catch { /* ignore */ }
    if (seen || reduceMotion) {
      boot.remove();
      return Promise.resolve();
    }
    document.documentElement.style.overflow = 'hidden';

    return new Promise((resolve) => {
      const bios = $('#bootBios');
      const bar = $('#bootBar');
      const fill = bar.querySelector('span');
      const timers = [];
      let finished = false;
      const lines = [
        'THE THING BIOS v1.0  (C) ' + new Date().getFullYear() + ' THE THING GAME STUDIO',
        '',
        'CPU: PIXEL-PROCESSOR 8-BIT @ 4.77 MHz ...... <span class="ok">OK</span>',
        'MEMORIA: 640K .............................. <span class="ok">OK</span>',
        'DETECTANDO CARTUCHO ........................ <span class="ok">OK</span>',
        'CARGANDO "THE_THING.ROM" ...',
      ];
      const at = (ms, fn) => timers.push(setTimeout(fn, ms));

      lines.forEach((l, i) => at(120 + i * 170, () => { bios.innerHTML += l + '\n'; beep('blip'); }));
      const t0 = 120 + lines.length * 170;
      at(t0, () => bar.classList.add('on'));
      for (let i = 1; i <= 10; i++) at(t0 + i * 90, () => { fill.style.width = `${i * 10}%`; });
      at(t0 + 1000, () => { $('#bootLogo').classList.add('on'); beep('select'); });
      at(t0 + 1700, () => $('#bootPress').classList.add('on'));
      at(t0 + 2900, finish);

      function finish() {
        if (finished) return;
        finished = true;
        timers.forEach(clearTimeout);
        try { sessionStorage.setItem('tt-booted', '1'); } catch { /* ignore */ }
        beep('coin');
        boot.classList.add('off');
        setTimeout(() => {
          boot.remove();
          document.documentElement.style.overflow = '';
          resolve();
        }, 560);
      }
      $('#bootSkip').addEventListener('click', finish);
      boot.addEventListener('click', finish);
      document.addEventListener('keydown', finish, { once: true });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Cabecera, menú y navegación                                         */
  /* ------------------------------------------------------------------ */

  function initHeader() {
    const header = $('#header');
    let lastY = window.scrollY;
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      header.classList.toggle('scrolled', y > 20);
      header.classList.toggle('hidden', y > lastY && y > 400 && !document.body.classList.contains('menu-open'));
      lastY = y;
    }, { passive: true });

    const toggle = $('#menuToggle');
    const setMenu = (open) => {
      document.body.classList.toggle('menu-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    };
    toggle.addEventListener('click', () => { setMenu(!document.body.classList.contains('menu-open')); beep('select'); });
    $('#menu').addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

    // Resalta la sección visible en el menú
    const links = [...document.querySelectorAll('.menu a')];
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#${en.target.id}`));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('main section[id]').forEach((s) => spy.observe(s));
  }

  /* ------------------------------------------------------------------ */
  /* Hero: texto que se escribe, reloj, parallax                         */
  /* ------------------------------------------------------------------ */

  function initHero() {
    const phrases = [
      'Hacemos videojuegos raros, memorables y con alma de cartucho viejo.',
      'Terror, misterio y píxeles desde el primer frame.',
      'No apagues la consola. Algo te está mirando.',
    ];
    const el = $('#typed');
    if (reduceMotion) {
      el.textContent = phrases[0];
    } else {
      let p = 0;
      let i = 0;
      let deleting = false;
      (function tick() {
        const text = phrases[p];
        i += deleting ? -1 : 1;
        el.textContent = text.slice(0, i);
        let delay = deleting ? 22 : 45 + Math.random() * 50;
        if (!deleting && i === text.length) { deleting = true; delay = 2600; }
        else if (deleting && i === 0) { deleting = false; p = (p + 1) % phrases.length; delay = 400; }
        setTimeout(tick, delay);
      })();
    }

    const clock = $('#hudClock');
    const pad = (n) => String(n).padStart(2, '0');
    setInterval(() => {
      const d = new Date();
      clock.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }, 1000);

    const art = $('#heroArt');
    if (!reduceMotion && window.matchMedia('(pointer: fine)').matches) {
      window.addEventListener('pointermove', (e) => {
        const x = (e.clientX / window.innerWidth - 0.5) * 2;
        const y = (e.clientY / window.innerHeight - 0.5) * 2;
        art.style.transform = `perspective(900px) rotateY(${x * 8}deg) rotateX(${-y * 6}deg) translate(${x * 10}px, ${y * 8}px)`;
      }, { passive: true });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Aparición al hacer scroll + contadores                              */
  /* ------------------------------------------------------------------ */

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('in');
      en.target.querySelectorAll('[data-count]').forEach(countUp);
      revealObserver.unobserve(en.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  function observeReveals(root = document) {
    root.querySelectorAll('.reveal:not(.in)').forEach((el) => revealObserver.observe(el));
  }

  function countUp(el) {
    const target = Number(el.dataset.count);
    if (!Number.isFinite(target) || reduceMotion) return;
    const dur = 1400;
    const start = performance.now();
    const fmt = (n) => (Number.isInteger(target) ? Math.round(n) : n.toFixed(1));
    (function frame(now) {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = fmt(target * eased);
      if (t < 1) requestAnimationFrame(frame);
      else el.textContent = el.dataset.final;
    })(start);
  }

  /* Inclinación 3D de las tarjetas */
  function addTilt(el) {
    if (reduceMotion || !window.matchMedia('(pointer: fine)').matches) return;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(900px) rotateY(${x * 7}deg) rotateX(${-y * 7}deg) translateY(-4px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  }

  /* ------------------------------------------------------------------ */
  /* Render del contenido                                                */
  /* ------------------------------------------------------------------ */

  let content = [];
  const byType = (t) => content.filter((i) => i.type === t);
  const media = (item, cls = '') => (item.image
    ? `<img src="${esc(item.image)}" alt="" loading="lazy" class="${cls}">`
    : '<div class="placeholder" aria-hidden="true"><img src="assets/img/logo-small.webp" alt=""></div>');

  function statusClass(status) {
    const s = (status || '').toLowerCase();
    if (/disponible|lanzado|ya|live|jugar/.test(s)) return 'tag--live';
    return 'tag--status';
  }

  function renderGames() {
    const wrap = $('#games');
    const games = byType('app').sort((a, b) => Number(b.featured) - Number(a.featured));
    if (!games.length) {
      wrap.innerHTML = '<div class="empty">NO HAY CARTUCHOS INSERTADOS… TODAVÍA</div>';
      return;
    }
    wrap.innerHTML = games.map((g, i) => `
      <button type="button" class="cart reveal${g.featured && i === 0 ? ' cart--featured' : ''}" style="--d:${Math.min(i, 5) * 0.08}s" data-open="${esc(g.id)}">
        <div class="cart__media">${media(g)}</div>
        <div class="cart__body">
          <div class="cart__meta">
            ${g.featured ? '<span class="tag tag--hot">Destacado</span>' : ''}
            ${g.status ? `<span class="tag ${statusClass(g.status)}">${esc(g.status)}</span>` : ''}
            ${g.platform ? `<span class="tag">${esc(g.platform)}</span>` : ''}
          </div>
          <h3 class="cart__title">${esc(g.title)}</h3>
          ${g.summary ? `<p class="cart__summary">${esc(g.summary)}</p>` : ''}
          <span class="cart__cta">Ver más</span>
        </div>
      </button>`).join('');
    wrap.querySelectorAll('.cart').forEach(addTilt);
  }

  const NEWS_PAGE = 6;
  let newsShown = NEWS_PAGE;
  function renderNews() {
    const wrap = $('#news');
    const news = byType('news');
    const more = $('#moreNews');
    if (!news.length) {
      wrap.innerHTML = '<div class="empty">SIN SEÑAL. NO HAY TRANSMISIONES.</div>';
      more.hidden = true;
      return;
    }
    wrap.innerHTML = news.slice(0, newsShown).map((n, i) => `
      <button type="button" class="tape reveal" style="--d:${(i % NEWS_PAGE) * 0.07}s" data-open="${esc(n.id)}">
        <div class="tape__media">
          <div class="tape__osd"><span class="rec">● REC</span><span>${formatDate(n.createdAt, 'vhs')}</span></div>
          ${media(n)}
        </div>
        <div class="tape__body">
          <h3 class="tape__title">${esc(n.title)}</h3>
          ${n.summary ? `<p class="tape__summary">${esc(n.summary)}</p>` : ''}
          <div class="tape__label"><span>CINTA #${String(news.length - i).padStart(3, '0')}</span><span>REPRODUCIR ▶</span></div>
        </div>
      </button>`).join('');
    more.hidden = news.length <= newsShown;
  }

  function renderScores() {
    const wrap = $('#scores');
    const data = byType('data').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (!data.length) {
      wrap.innerHTML = '<div class="empty" style="background:var(--bg)">SIN PUNTUACIONES REGISTRADAS</div>';
      return;
    }
    wrap.innerHTML = data.map((d, i) => {
      const num = Number(String(d.value).replace(/,/g, ''));
      const isNum = d.value !== '' && Number.isFinite(num);
      return `
        <div class="score">
          <div class="score__rank">${String(i + 1).padStart(2, '0')}${['ST', 'ND', 'RD'][i] || 'TH'}</div>
          <div class="score__value" ${isNum ? `data-count="${num}" data-final="${esc(d.value)}"` : ''}>${isNum && !reduceMotion ? '0' : esc(d.value || '—')}</div>
          <div class="score__label">${esc(d.title)}</div>
          ${d.summary ? `<div class="score__note">${esc(d.summary)}</div>` : ''}
        </div>`;
    }).join('');
    // Si el marcador ya apareció en pantalla antes de cargar los datos
    if (wrap.classList.contains('in')) wrap.querySelectorAll('[data-count]').forEach(countUp);
  }

  function renderGallery() {
    const wrap = $('#gallery');
    const imgs = byType('image');
    if (!imgs.length) {
      wrap.style.columns = 'auto';
      wrap.innerHTML = '<div class="empty">EL ÁLBUM ESTÁ VACÍO</div>';
      return;
    }
    wrap.innerHTML = imgs.map((g, i) => `
      <button type="button" class="shot reveal" style="--r:${((i * 37) % 7) - 3}deg; --d:${(i % 6) * 0.06}s" data-shot="${i}">
        <img src="${esc(g.image)}" alt="${esc(g.title)}" loading="lazy">
        <figcaption>${esc(g.title)}</figcaption>
      </button>`).join('');
  }

  function renderTicker() {
    const items = [...byType('news'), ...byType('app')].slice(0, 8);
    const base = items.length
      ? items.map((i) => `<span><a href="#ver-${esc(i.id)}">${esc(i.title)}</a></span>`)
      : ['<span>BIENVENIDO A THE THING</span>', '<span>INSERT COIN</span>'];
    const filler = ['<span>INSERT COIN</span>', '<span>PRESS START</span>'];
    const row = [...base, ...filler].join('');
    $('#ticker').innerHTML = row + row; // duplicado para el bucle infinito
  }

  function renderAll() {
    renderGames();
    renderNews();
    renderScores();
    renderGallery();
    renderTicker();
    observeReveals();
  }

  /* ------------------------------------------------------------------ */
  /* Modales                                                             */
  /* ------------------------------------------------------------------ */

  const detail = createModal();
  const lightbox = createModal('lightbox');

  function openItem(id, pushHash = true) {
    const item = content.find((i) => i.id === id);
    if (!item) return;
    if (item.type === 'image') return openShot(byType('image').indexOf(item));
    const isApp = item.type === 'app';
    const tags = [
      isApp && item.status ? `<span class="tag ${statusClass(item.status)}">${esc(item.status)}</span>` : '',
      isApp && item.platform ? `<span class="tag">${esc(item.platform)}</span>` : '',
      `<span class="tag">${formatDate(item.createdAt)}</span>`,
    ].join(' ');
    detail.open(`
      <button class="icon-btn modal__close" type="button" data-close data-autofocus title="Cerrar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>
        <span class="sr-only">Cerrar</span>
      </button>
      ${item.image ? `<div class="modal__media"><img src="${esc(item.image)}" alt=""></div>` : ''}
      <article class="modal__content">
        <p class="eyebrow">${isApp ? 'Juego / aplicación' : 'Noticia'}</p>
        <div>${tags}</div>
        <h2>${esc(item.title)}</h2>
        ${item.summary ? `<p class="modal__lead">${esc(item.summary)}</p>` : ''}
        <div class="prose">${formatText(item.body)}</div>
        <div class="modal__actions">
          ${item.link ? `<a class="btn btn--solid" href="${esc(item.link)}" target="_blank" rel="noopener noreferrer">${isApp ? '▶ Jugar / descargar' : 'Ver enlace'}</a>` : ''}
          <button class="btn" type="button" data-close>◀ Volver</button>
        </div>
      </article>`, () => {
      if (location.hash.startsWith('#ver-')) history.replaceState(null, '', location.pathname + location.search);
    });
    if (pushHash) history.replaceState(null, '', `#ver-${id}`);
  }

  let shotIndex = 0;
  function openShot(index) {
    const imgs = byType('image');
    if (!imgs.length) return;
    shotIndex = (index + imgs.length) % imgs.length;
    const g = imgs[shotIndex];
    const html = `
      <button class="icon-btn modal__close" type="button" data-close data-autofocus title="Cerrar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>
        <span class="sr-only">Cerrar</span>
      </button>
      ${imgs.length > 1 ? `
        <button class="icon-btn lightbox__nav lightbox__nav--prev" type="button" data-step="-1" title="Anterior">◀</button>
        <button class="icon-btn lightbox__nav lightbox__nav--next" type="button" data-step="1" title="Siguiente">▶</button>` : ''}
      <figure>
        <img src="${esc(g.image)}" alt="${esc(g.title)}">
        <figcaption><span>${esc(g.title)}${g.summary ? ` — <span style="color:var(--muted)">${esc(g.summary)}</span>` : ''}</span><span>${shotIndex + 1}/${imgs.length}</span></figcaption>
      </figure>`;
    if (lightbox.isOpen()) {
      lightbox.panel.innerHTML = html;
      beep('blip');
    } else {
      lightbox.open(html);
    }
  }
  lightbox.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-step]');
    if (b) openShot(shotIndex + Number(b.dataset.step));
  });
  document.addEventListener('keydown', (e) => {
    if (!lightbox.isOpen()) return;
    if (e.key === 'ArrowLeft') openShot(shotIndex - 1);
    if (e.key === 'ArrowRight') openShot(shotIndex + 1);
  });

  document.addEventListener('click', (e) => {
    const open = e.target.closest('[data-open]');
    if (open) return openItem(open.dataset.open);
    const shot = e.target.closest('[data-shot]');
    if (shot) return openShot(Number(shot.dataset.shot));
    const tick = e.target.closest('.ticker a[href^="#ver-"]');
    if (tick) {
      e.preventDefault();
      openItem(tick.getAttribute('href').slice(5));
    }
  });

  $('#moreNews').addEventListener('click', () => {
    newsShown += NEWS_PAGE;
    renderNews();
    observeReveals($('#news'));
  });

  window.addEventListener('hashchange', () => {
    if (location.hash.startsWith('#ver-')) openItem(location.hash.slice(5), false);
  });

  /* ------------------------------------------------------------------ */
  /* ¿Continuar? (cuenta regresiva arcade)                               */
  /* ------------------------------------------------------------------ */

  function initCountdown() {
    const el = $('#countdown');
    let n = 9;
    let timer = null;
    const io = new IntersectionObserver(([en]) => {
      if (en.isIntersecting && !timer && !reduceMotion) {
        timer = setInterval(() => {
          n = n <= 0 ? 9 : n - 1;
          el.textContent = n;
          el.classList.remove('tick');
          void el.offsetWidth; // reinicia la animación
          el.classList.add('tick');
        }, 1000);
      } else if (!en.isIntersecting && timer) {
        clearInterval(timer);
        timer = null;
      }
    });
    io.observe(el);
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
        window.TT.toast('MODO CAOS ACTIVADO. LA COSA DESPERTÓ.');
        beep('select');
        setTimeout(() => document.body.classList.remove('chaos'), 4000);
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Arranque                                                            */
  /* ------------------------------------------------------------------ */

  initHeader();
  initHero();
  initCountdown();
  initKonami();
  observeReveals();

  const loaded = api('api/content.php')
    .then((items) => { content = items; })
    .catch(() => { content = DEMO; })
    .then(renderAll);

  Promise.all([runBoot(), loaded]).then(() => {
    if (location.hash.startsWith('#ver-')) openItem(location.hash.slice(5), false);
  });
})();
