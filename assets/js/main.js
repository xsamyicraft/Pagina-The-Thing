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

  }

  /* ------------------------------------------------------------------ */
  /* Gato del logo: patitas que se mueven y pupilas que siguen al ratón  */
  /* ------------------------------------------------------------------ */

  function initCat() {
    const cat = $('#cat');
    if (!cat) return;
    const eyes = [...cat.querySelectorAll('.cat__eye')];
    const pupils = eyes.map((e) => e.querySelector('.cat__pupil'));
    const paws = [...cat.querySelectorAll('.cat__paw')];
    const rand = (a, b) => a + Math.random() * (b - a);
    let pointer = null;
    let lastMove = 0;
    let frame = 0;

    function aim(x, y) {
      eyes.forEach((eye, i) => {
        const r = eye.getBoundingClientRect();
        const dx = x - (r.left + r.width / 2);
        const dy = y - (r.top + r.height / 2);
        const dist = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, dist / 160);           // cerca del ojo, la pupila se centra
        pupils[i].style.setProperty('--px', `${((dx / dist) * r.width * 0.27 * k).toFixed(1)}px`);
        pupils[i].style.setProperty('--py', `${((dy / dist) * r.height * 0.25 * k).toFixed(1)}px`);
      });
    }
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (pointer) aim(pointer.x, pointer.y);
      });
    };
    window.addEventListener('pointermove', (e) => {
      pointer = { x: e.clientX, y: e.clientY };
      lastMove = performance.now();
      schedule();
    }, { passive: true });
    window.addEventListener('scroll', schedule, { passive: true });

    // Sin ratón (móvil o quieto): la mirada vaga por la pantalla
    setInterval(() => {
      if (performance.now() - lastMove < 2500) return;
      const r = cat.getBoundingClientRect();
      pointer = { x: r.left + r.width * rand(-0.4, 1.4), y: r.top + r.height * rand(-0.2, 1.1) };
      schedule();
    }, 1600);

    if (reduceMotion) return;

    // "Bugs" aleatorios en las pupilas
    (function bug() {
      cat.style.setProperty('--bx', `${rand(-9, 9).toFixed(0)}px`);
      cat.style.setProperty('--by', `${rand(-5, 5).toFixed(0)}px`);
      cat.classList.add('bug');
      setTimeout(() => cat.classList.remove('bug'), rand(70, 220));
      setTimeout(bug, rand(1200, 4200));
    })();

    // Interferencia de color en las patitas de vez en cuando
    (function pawGlitch() {
      const paw = paws[Math.floor(Math.random() * paws.length)];
      paw.classList.add('glitch-x');
      setTimeout(() => paw.classList.remove('glitch-x'), rand(80, 200));
      setTimeout(pawGlitch, rand(1500, 5000));
    })();

    // Al hacer clic, el gato "aporrea" con las patitas
    $('#inicio').addEventListener('pointerdown', (e) => {
      if (e.target.closest('a, button')) return;
      cat.classList.add('tap');
      beep('blip');
      clearTimeout(cat._tap);
      cat._tap = setTimeout(() => cat.classList.remove('tap'), 1000);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Aparición al hacer scroll + contadores                              */
  /* ------------------------------------------------------------------ */

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('in');
      en.target.querySelectorAll('[data-count]').forEach(countUp);
      if (en.target.id === 'votes') en.target.classList.add('bars-on');
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
  let community = { ratings: {}, votes: { best: {}, played: {} }, comments: {}, mine: {} };
  let me = null;          // jugador conectado
  let online = true;      // false si no hay servidor PHP (vista previa local)
  const byType = (t) => content.filter((i) => i.type === t);

  function starsHtml(value) {
    const n = Math.round(Number(value) || 0);
    return `<span class="stars" aria-hidden="true">${'★'.repeat(n)}<span class="off">${'★'.repeat(5 - n)}</span></span>`;
  }
  const ratingOf = (id) => community.ratings[id] || null;
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
          ${ratingOf(g.id) ? `<span class="cart__stars">${starsHtml(ratingOf(g.id).avg)} ${ratingOf(g.id).avg.toFixed(1)} · ${ratingOf(g.id).count} reseña${ratingOf(g.id).count === 1 ? '' : 's'}<span class="sr-only"> (valoración ${ratingOf(g.id).avg} de 5)</span></span>` : ''}
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

  /* Votaciones: mejor juego y más jugado */
  const VOTE_CATS = [
    { key: 'best', icon: '♛', title: 'Mejor juego', text: 'El que pondrías en tu salón de la fama.' },
    { key: 'played', icon: '▶', title: 'Más jugado', text: 'Al que más horas le has dedicado.' },
  ];
  function renderVotes() {
    const wrap = $('#votes');
    const games = byType('app');
    if (!games.length) {
      wrap.innerHTML = '<div class="empty" style="grid-column:1/-1">CUANDO HAYA JUEGOS PODRÁS VOTAR AQUÍ</div>';
      return;
    }
    wrap.innerHTML = VOTE_CATS.map((cat) => {
      const counts = community.votes[cat.key] || {};
      const total = games.reduce((n, g) => n + (counts[g.id] || 0), 0);
      const rows = [...games].sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0) || a.title.localeCompare(b.title));
      const top = counts[rows[0].id] || 0;
      return `
        <div class="vote-panel">
          <h3><i aria-hidden="true">${cat.icon}</i> ${esc(cat.title.toUpperCase())}</h3>
          <p>${esc(cat.text)} ${total} voto${total === 1 ? '' : 's'} en total.</p>
          <div class="vote-list">
            ${rows.map((g, i) => {
              const n = counts[g.id] || 0;
              const pct = total ? Math.round((n / total) * 100) : 0;
              const mine = community.mine && community.mine[cat.key] === g.id;
              return `
                <div class="vote-row${n && n === top ? ' lead' : ''}">
                  <span class="vote-row__rank">${String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <div class="vote-row__name"><span>${esc(g.title)}</span><span>${n} · ${pct}%</span></div>
                    <div class="vote-bar" role="img" aria-label="${n} votos, ${pct}%"><span style="--w:${pct}%"></span></div>
                  </div>
                  <button type="button" class="btn btn--sm vote-btn${mine ? ' voted' : ''}" data-vote="${cat.key}" data-item="${esc(g.id)}" aria-pressed="${mine}">${mine ? '✓ Tu voto' : 'Votar'}</button>
                </div>`;
            }).join('')}
          </div>
        </div>`;
    }).join('');
    if (wrap.classList.contains('in')) {
      wrap.classList.remove('bars-on');
      void wrap.offsetWidth;
      wrap.classList.add('bars-on');
    }
  }

  async function vote(category, item) {
    if (!me) return openAuth('register', 'Regístrate para votar', () => vote(category, item));
    try {
      community = { ...community, ...(await api('api/community.php?action=vote', { json: { category, item } })) };
      beep('coin');
      window.TT.toast('¡VOTO REGISTRADO!');
      renderVotes();
    } catch (err) {
      handleMemberError(err);
    }
  }

  function renderAll() {
    renderGames();
    renderVotes();
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
      </article>
      <section class="reviews" id="reviews" aria-live="polite"><p class="term" style="color:var(--muted)">CARGANDO TRANSMISIONES…</p></section>`, () => {
      if (location.hash.startsWith('#ver-')) history.replaceState(null, '', location.pathname + location.search);
    });
    if (pushHash) history.replaceState(null, '', `#ver-${id}`);
    loadReviews(item);
  }

  /* ------------------------------------------------------------------ */
  /* Reseñas (juegos) y comentarios (noticias) en formato "código retro" */
  /* ------------------------------------------------------------------ */

  const reviewCode = (id) => (String(id).toUpperCase().replace(/[^0-9A-F]/g, '') + '000000000000').slice(0, 12).match(/.{4}/g).join('-');
  let reviewsToken = 0;

  async function loadReviews(item) {
    const token = ++reviewsToken;
    let list = [];
    if (online) {
      try { list = await api(`api/community.php?action=comments&item=${encodeURIComponent(item.id)}`); } catch { list = null; }
    }
    if (token !== reviewsToken) return;     // se abrió otro elemento mientras cargaba
    const box = document.getElementById('reviews');
    if (!box) return;
    renderReviews(box, item, list);
  }

  function renderReviews(box, item, list) {
    const isApp = item.type === 'app';
    if (!online || list === null) {
      box.innerHTML = '<p class="term" style="color:var(--muted)">LAS RESEÑAS NECESITAN EL SERVIDOR (PHP) PARA FUNCIONAR.</p>';
      return;
    }
    const mine = list.find((c) => c.mine);
    const rating = isApp && list.length ? list.reduce((n, c) => n + c.rating, 0) / list.length : 0;
    const head = isApp
      ? `<h3>RESEÑAS DE JUGADORES</h3>
         <div class="rating-big">${list.length ? `<b>${rating.toFixed(1)}</b> ${starsHtml(rating)} <span>${list.length} reseña${list.length === 1 ? '' : 's'}</span>` : '<span>SIN RESEÑAS. ¡SÉ EL PRIMERO!</span>'}</div>`
      : `<h3>COMENTARIOS (${list.length})</h3>`;

    let form;
    if (!me) {
      form = `<div class="login-cta"><span>&gt; INICIA SESIÓN PARA ${isApp ? 'DEJAR TU RESEÑA' : 'COMENTAR'}</span>
        <button class="btn btn--sm" type="button" data-auth="register">Nuevo jugador</button></div>`;
    } else {
      const current = isApp && mine ? mine.rating : 0;
      form = `
        <form class="review-form tt-form" id="reviewForm" novalidate>
          <p class="review-form__title">&gt; ${isApp ? (mine ? 'EDITAR MI RESEÑA' : 'INTRODUCE TU CÓDIGO (RESEÑA)') : 'ESCRIBE UN COMENTARIO'}</p>
          ${isApp ? `
            <div class="star-pick" role="radiogroup" aria-label="Estrellas">
              ${[1, 2, 3, 4, 5].map((n) => `<button type="button" role="radio" aria-checked="${n === current}" aria-label="${n} estrella${n > 1 ? 's' : ''}" data-star="${n}" class="${n <= current ? 'on' : ''}">★</button>`).join('')}
            </div>
            <input type="hidden" name="rating" value="${current}">` : ''}
          <label class="tt-field"><span class="sr-only">Mensaje</span>
            <textarea name="text" maxlength="1000" required placeholder="${isApp ? '¿Qué te pareció el juego?' : 'Escribe aquí…'}">${isApp && mine ? esc(mine.text) : ''}</textarea>
          </label>
          <p class="tt-error" role="alert"></p>
          <div><button class="btn btn--solid btn--sm" type="submit">▶ ${isApp ? 'Enviar reseña' : 'Publicar'}</button></div>
        </form>`;
    }

    const cards = list.map((c, i) => `
      <article class="code-card${c.mine ? ' mine' : ''}" style="--d:${Math.min(i, 8) * 0.06}s">
        <div class="code-card__top">
          <span class="code-card__code">CÓDIGO ${reviewCode(c.id)}</span>
          ${isApp ? `${starsHtml(c.rating)}<span class="sr-only">${c.rating} de 5 estrellas</span>` : ''}
        </div>
        <p class="code-card__who">&gt; PLAYER: ${esc(c.name.toUpperCase())} <span>· ${formatDate(c.createdAt, 'vhs')}${c.updatedAt !== c.createdAt ? ' · EDITADO' : ''}</span></p>
        <p class="code-card__text">${esc(c.text)}</p>
        ${c.canDelete ? `<button class="code-card__del" type="button" data-del-comment="${esc(c.id)}">[ BORRAR ]</button>` : ''}
      </article>`).join('');

    box.innerHTML = `<div class="reviews__head">${head}</div>${form}<div class="code-list">${cards}</div>`;
    bindReviewForm(box, item);
  }

  function bindReviewForm(box, item) {
    const form = box.querySelector('#reviewForm');
    box.querySelectorAll('[data-del-comment]').forEach((b) => b.addEventListener('click', async () => {
      if (!window.confirm('¿Borrar este mensaje?')) return;
      try {
        await api('api/community.php?action=delete_comment', { json: { id: b.dataset.delComment } });
        window.TT.toast('MENSAJE BORRADO');
        await refreshCommunity();
        loadReviews(item);
      } catch (err) { handleMemberError(err); }
    }));
    if (!form) return;
    const stars = [...form.querySelectorAll('[data-star]')];
    stars.forEach((b) => b.addEventListener('click', () => {
      const n = Number(b.dataset.star);
      form.rating.value = n;
      stars.forEach((s) => {
        const on = Number(s.dataset.star) <= n;
        s.classList.toggle('on', on);
        s.setAttribute('aria-checked', String(Number(s.dataset.star) === n));
      });
      b.classList.remove('pop');
      void b.offsetWidth;
      b.classList.add('pop');
      beep('blip');
    }));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = form.querySelector('.tt-error');
      const payload = { item: item.id, text: form.text.value.trim(), rating: form.rating ? Number(form.rating.value) : 0 };
      if (item.type === 'app' && !payload.rating) { err.textContent = '✖ Elige de 1 a 5 estrellas'; return beep('error'); }
      if (payload.text.length < 2) { err.textContent = '✖ Escribe tu mensaje'; return beep('error'); }
      const btn = form.querySelector('[type=submit]');
      btn.disabled = true;
      try {
        await api('api/community.php?action=comment', { json: payload });
        beep('coin');
        window.TT.toast(item.type === 'app' ? '¡RESEÑA GUARDADA!' : '¡COMENTARIO PUBLICADO!');
        await refreshCommunity();
        loadReviews(item);
      } catch (ex) {
        if (ex.status === 401) handleMemberError(ex);
        else { err.textContent = `✖ ${ex.message}`; beep('error'); }
        btn.disabled = false;
      }
    });
  }

  async function refreshCommunity() {
    if (!online) return;
    try {
      community = await api('api/community.php?action=summary');
      renderGames();
      renderVotes();
      observeReveals();
    } catch { /* sin conexión */ }
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
  /* Jugadores: registro, inicio de sesión, avisos                       */
  /* ------------------------------------------------------------------ */

  const authModal = createModal('modal--small');
  const drawer = createModal('modal--drawer');
  const accountModal = createModal('modal--small');
  let pendingAction = null;
  let lastUnread = 0;
  const USER_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>';
  const closeBtn = `<button class="icon-btn modal__close" type="button" data-close title="Cerrar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>
      <span class="sr-only">Cerrar</span></button>`;

  /** Si la sesión caducó, pide entrar de nuevo. Devuelve true si gestionó el error. */
  function handleMemberError(err) {
    if (err.status === 401) {
      setMember(null);
      openAuth('login', 'Tu sesión terminó. Vuelve a entrar.');
      return true;
    }
    window.TT.toast(err.message, 'error');
    return true;
  }

  function setMember(member, unread = 0) {
    me = member;
    const btn = $('#acctBtn');
    const bell = $('#bellBtn');
    if (me) {
      btn.innerHTML = `<span class="initial" aria-hidden="true">${esc(me.name.charAt(0).toUpperCase())}</span><span class="acct-label">${esc(me.name)}</span>`;
      btn.title = 'Mi cuenta';
      bell.hidden = false;
    } else {
      btn.innerHTML = `${USER_ICON}<span class="acct-label">Entrar</span>`;
      btn.title = 'Entrar o registrarse';
      bell.hidden = true;
    }
    setUnread(unread);
  }

  function setUnread(n) {
    const badge = $('#bellBadge');
    badge.hidden = !n;
    badge.textContent = n > 9 ? '9+' : String(n);
    if (n > lastUnread) {
      const bell = $('#bellBtn');
      bell.classList.remove('ring');
      void bell.offsetWidth;
      bell.classList.add('ring');
    }
    lastUnread = n;
  }

  function openAuth(mode = 'login', reason = '', after = null) {
    if (!online) return window.TT.toast('Las cuentas necesitan el servidor PHP (súbelo a Hostinger)', 'error');
    pendingAction = after;
    authModal.open(`${closeBtn}<div class="auth" id="authBox"></div>`);
    renderAuth(mode, reason);
  }

  function renderAuth(mode, reason) {
    const box = $('#authBox');
    const isReg = mode === 'register';
    box.innerHTML = `
      <img class="auth__logo" src="assets/img/logo-small.webp" alt="" width="90" height="98">
      <h2>${isReg ? 'NUEVO JUGADOR' : 'CONTINUAR PARTIDA'}</h2>
      <p class="auth__sub">${esc(reason || (isReg ? 'Crea tu cuenta para votar, dejar reseñas y recibir avisos.' : 'Entra con tu correo y contraseña.'))}</p>
      <div class="tabs" role="tablist">
        <button type="button" role="tab" aria-selected="${!isReg}" data-mode="login">Continuar</button>
        <button type="button" role="tab" aria-selected="${isReg}" data-mode="register">Nuevo jugador</button>
      </div>
      <form class="tt-form" id="authForm" novalidate>
        ${isReg ? '<label class="tt-field"><span>NOMBRE DE JUGADOR</span><input name="name" maxlength="24" autocomplete="nickname" required data-autofocus placeholder="3 a 24 letras o números"></label>' : ''}
        <label class="tt-field"><span>CORREO</span><input name="email" type="email" autocomplete="email" required ${isReg ? '' : 'data-autofocus'}></label>
        <label class="tt-field"><span>CONTRASEÑA${isReg ? ' (mín. 8)' : ''}</span><input name="password" type="password" autocomplete="${isReg ? 'new-password' : 'current-password'}" required minlength="8"></label>
        ${isReg ? `
          <label class="tt-check"><input type="checkbox" name="emailNotify"> Quiero recibir por correo los avisos de juegos nuevos y noticias (puedes darte de baja cuando quieras).</label>
          <div class="hp" aria-hidden="true"><label>Web <input name="website" tabindex="-1" autocomplete="off"></label></div>` : ''}
        <p class="tt-error" role="alert"></p>
        <button class="btn btn--solid" type="submit" style="justify-content:center">▶ ${isReg ? 'Crear cuenta' : 'Entrar'}</button>
      </form>`;
    box.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { beep('blip'); renderAuth(b.dataset.mode, reason); }));
    const form = $('#authForm');
    setTimeout(() => { const f = form.querySelector('[data-autofocus]'); if (f) f.focus(); }, 60);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = form.querySelector('.tt-error');
      err.textContent = '';
      const btn = form.querySelector('[type=submit]');
      const data = {
        email: form.email.value.trim(),
        password: form.password.value,
      };
      if (isReg) {
        data.name = form.elements.name.value.trim();
        data.emailNotify = form.emailNotify.checked;
        data.website = form.website.value;
        if (data.name.length < 3) { err.textContent = '✖ El nombre debe tener al menos 3 caracteres'; return beep('error'); }
        if (data.password.length < 8) { err.textContent = '✖ La contraseña necesita 8 caracteres o más'; return beep('error'); }
      }
      btn.disabled = true;
      try {
        const res = await api(`api/members.php?action=${isReg ? 'register' : 'login'}`, { json: data });
        setMember(res.member, res.unread);
        authModal.close();
        beep('coin');
        window.TT.toast(isReg ? `¡BIENVENIDO, ${res.member.name.toUpperCase()}!` : `¡HOLA DE NUEVO, ${res.member.name.toUpperCase()}!`);
        await refreshCommunity();
        startPolling();
        if (isReg) setTimeout(offerBrowserNotifications, 900);
        const action = pendingAction;
        pendingAction = null;
        if (action) action();
        else if (detail.isOpen()) {
          const id = location.hash.startsWith('#ver-') ? location.hash.slice(5) : '';
          const item = content.find((i) => i.id === id);
          if (item) loadReviews(item);
        }
      } catch (ex) {
        err.textContent = `✖ ${ex.message}`;
        beep('error');
        btn.disabled = false;
        const card = authModal.panel;
        card.animate([{ transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'none' }], { duration: 260 });
      }
    });
  }

  /* Avisos del navegador (Notification API): funcionan con la web abierta */
  function browserNotifySupported() {
    return 'Notification' in window && window.isSecureContext;
  }
  function offerBrowserNotifications() {
    if (!browserNotifySupported() || Notification.permission !== 'default') return;
    window.TT.toast('Activa los avisos del navegador desde tu cuenta para no perderte nada');
  }

  async function openDrawer() {
    drawer.open(`${closeBtn}<div class="drawer"><h2>AVISOS</h2><p class="drawer__sub">Novedades, noticias y juegos nuevos.</p><div class="notif-list" id="notifList"><p class="term" style="color:var(--muted)">CARGANDO…</p></div></div>`);
    try {
      const res = await api('api/members.php?action=notifications');
      const list = $('#notifList');
      if (!list) return;
      list.innerHTML = res.items.map((n, i) => {
        const unread = n.createdAt > (res.lastSeen || '');
        const kind = { news: 'Noticia', app: 'Juego', image: 'Galería', data: 'Dato', aviso: 'Aviso' }[n.kind] || 'Aviso';
        const inner = `
          <span class="notif__meta"><span class="kind">${unread ? '● ' : ''}${kind}</span><span>${formatDate(n.createdAt, 'vhs')}</span></span>
          <span class="notif__title">${esc(n.title)}</span>
          ${n.text ? `<span class="notif__text">${esc(n.text)}</span>` : ''}`;
        return n.item && content.some((c) => c.id === n.item)
          ? `<button type="button" class="notif${unread ? ' unread' : ''}" style="--d:${Math.min(i, 10) * 0.04}s" data-notif-item="${esc(n.item)}">${inner}</button>`
          : `<div class="notif${unread ? ' unread' : ''}" style="--d:${Math.min(i, 10) * 0.04}s">${inner}</div>`;
      }).join('') || '<p class="term" style="color:var(--muted)">SIN AVISOS TODAVÍA</p>';
      list.querySelectorAll('[data-notif-item]').forEach((b) => b.addEventListener('click', () => {
        drawer.close();
        setTimeout(() => openItem(b.dataset.notifItem), 320);
      }));
      if (res.unread) {
        await api('api/members.php?action=seen', { method: 'POST' });
        setUnread(0);
        rememberNotified(res.items[0] && res.items[0].createdAt);
      }
    } catch (err) {
      drawer.close();
      handleMemberError(err);
    }
  }

  function openAccount() {
    const notifState = !browserNotifySupported()
      ? '<p class="drawer__sub">Tu navegador no admite avisos (o la web no usa HTTPS).</p>'
      : Notification.permission === 'granted'
        ? '<p class="drawer__sub" style="color:var(--acc)">✓ Avisos del navegador activados.</p>'
        : Notification.permission === 'denied'
          ? '<p class="drawer__sub">Bloqueaste los avisos: actívalos en la configuración del navegador.</p>'
          : '<button class="btn btn--sm" type="button" id="enableNotif">🔔 Activar avisos del navegador</button>';
    accountModal.open(`${closeBtn}
      <div class="auth">
        <h2>${esc(me.name.toUpperCase())}</h2>
        <p class="auth__sub">${esc(me.email)} · jugador desde ${formatDate(me.createdAt)}</p>
        <div class="tt-form">
          <label class="tt-check"><input type="checkbox" id="prefEmail"${me.emailNotify ? ' checked' : ''}> Recibir avisos de novedades por correo</label>
          ${notifState}
          <button class="btn" type="button" id="openNotifs" style="justify-content:center">Ver mis avisos</button>
          <button class="btn btn--danger" type="button" id="logoutMember" style="justify-content:center">Cerrar sesión</button>
        </div>
      </div>`);
    $('#prefEmail').addEventListener('change', async (e) => {
      try {
        const res = await api('api/members.php?action=prefs', { json: { emailNotify: e.target.checked } });
        me = res.member;
        window.TT.toast(me.emailNotify ? 'Recibirás los avisos por correo' : 'Ya no recibirás correos');
      } catch (err) { e.target.checked = !e.target.checked; handleMemberError(err); }
    });
    const enable = $('#enableNotif');
    if (enable) enable.addEventListener('click', async () => {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        new Notification('THE THING', { body: '¡Avisos activados! Te avisaremos de las novedades.', icon: 'assets/img/apple-touch-icon.png' });
        window.TT.toast('Avisos del navegador activados');
      }
      accountModal.close();
    });
    $('#openNotifs').addEventListener('click', () => { accountModal.close(); setTimeout(openDrawer, 320); });
    $('#logoutMember').addEventListener('click', async () => {
      try { await api('api/members.php?action=logout', { method: 'POST' }); } catch { /* ignore */ }
      accountModal.close();
      setMember(null);
      stopPolling();
      window.TT.toast('SESIÓN CERRADA. ¡HASTA PRONTO!');
      refreshCommunity();
    });
  }

  function rememberNotified(createdAt) {
    if (createdAt) window.TT.store.set('tt-notified', createdAt);
  }

  /* Comprueba avisos nuevos cada minuto */
  let pollTimer = null;
  function startPolling() {
    stopPolling();
    pollTimer = setInterval(checkUnread, 60000);
  }
  function stopPolling() {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  async function checkUnread() {
    if (!me || document.hidden && !(browserNotifySupported() && Notification.permission === 'granted')) return;
    try {
      const res = await api('api/members.php?action=me');
      if (!res.member) { setMember(null); stopPolling(); return; }
      const before = lastUnread;
      setUnread(res.unread);
      if (res.unread > before && browserNotifySupported() && Notification.permission === 'granted') {
        const list = await api('api/members.php?action=notifications');
        const already = window.TT.store.get('tt-notified', '');
        list.items.filter((n) => n.createdAt > already && n.createdAt > (list.lastSeen || '')).slice(0, 3).forEach((n) => {
          const note = new Notification(n.title, { body: n.text || 'Novedad en THE THING', icon: 'assets/img/apple-touch-icon.png', tag: n.id });
          note.onclick = () => { window.focus(); if (n.item) openItem(n.item); note.close(); };
        });
        rememberNotified(list.items[0] && list.items[0].createdAt);
      }
    } catch { /* sin conexión: se reintenta en el próximo ciclo */ }
  }

  $('#acctBtn').addEventListener('click', () => (me ? openAccount() : openAuth('login')));
  $('#bellBtn').addEventListener('click', openDrawer);
  document.addEventListener('click', (e) => {
    const join = e.target.closest('[data-join]');
    if (join) return me ? openAccount() : openAuth('register');
    const auth = e.target.closest('[data-auth]');
    if (auth) return openAuth(auth.dataset.auth);
    const v = e.target.closest('[data-vote]');
    if (v) vote(v.dataset.vote, v.dataset.item);
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
  initCat();
  initCountdown();
  initKonami();
  observeReveals();

  const loaded = Promise.all([
    api('api/content.php'),
    api('api/community.php?action=summary').catch(() => null),
    api('api/members.php?action=me').catch(() => null),
  ])
    .then(([items, summary, session]) => {
      content = items;
      if (summary) community = summary;
      if (session && session.member) {
        setMember(session.member, session.unread);
        startPolling();
        checkUnread();
      }
    })
    .catch(() => {
      content = DEMO;
      online = false;
    })
    .then(renderAll);

  Promise.all([runBoot(), loaded]).then(() => {
    if (location.hash.startsWith('#ver-')) openItem(location.hash.slice(5), false);
  });
})();
