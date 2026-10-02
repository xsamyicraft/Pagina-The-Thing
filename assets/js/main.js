/* THE THING — contenido de las páginas públicas (inicio, juegos, vídeos, noticias, galería) */
(function () {
  'use strict';

  const { api, escapeHtml: esc, formatText, formatDate, beep, createModal, reduceMotion, toast } = window.TT;
  const $ = (sel, root = document) => root.querySelector(sel);
  const site = window.TT.site;
  const account = window.TT.account;

  /* ------------------------------------------------------------------ */
  /* Pantalla de arranque (solo en la portada)                           */
  /* ------------------------------------------------------------------ */

  function runBoot() {
    const boot = $('#boot');
    if (!boot) return Promise.resolve();
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
  /* Portada: texto que se escribe, reloj, gato y cuenta atrás           */
  /* ------------------------------------------------------------------ */

  function initHero() {
    const el = $('#typed');
    if (!el) return;
    const phrases = [
      'Hacemos videojuegos raros, memorables y con alma de cartucho viejo.',
      'Terror, misterio y píxeles desde el primer frame.',
      'No apagues la consola. Algo te está mirando.',
    ];
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
    if (clock) setInterval(() => {
      const d = new Date();
      clock.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }, 1000);
  }

  /* Gato del logo: patitas que se mueven y pupilas que siguen al ratón */
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

    (function bug() {
      cat.style.setProperty('--bx', `${rand(-9, 9).toFixed(0)}px`);
      cat.style.setProperty('--by', `${rand(-5, 5).toFixed(0)}px`);
      cat.classList.add('bug');
      setTimeout(() => cat.classList.remove('bug'), rand(70, 220));
      setTimeout(bug, rand(1200, 4200));
    })();

    (function pawGlitch() {
      const paw = paws[Math.floor(Math.random() * paws.length)];
      paw.classList.add('glitch-x');
      setTimeout(() => paw.classList.remove('glitch-x'), rand(80, 200));
      setTimeout(pawGlitch, rand(1500, 5000));
    })();

    $('#inicio').addEventListener('pointerdown', (e) => {
      if (e.target.closest('a, button')) return;
      cat.classList.add('tap');
      beep('blip');
      clearTimeout(cat._tap);
      cat._tap = setTimeout(() => cat.classList.remove('tap'), 1000);
    });
  }

  function initCountdown() {
    const el = $('#countdown');
    if (!el) return;
    let n = 9;
    let timer = null;
    new IntersectionObserver(([en]) => {
      if (en.isIntersecting && !timer && !reduceMotion) {
        timer = setInterval(() => {
          n = n <= 0 ? 9 : n - 1;
          el.textContent = n;
          el.classList.remove('tick');
          void el.offsetWidth;
          el.classList.add('tick');
        }, 1000);
      } else if (!en.isIntersecting && timer) {
        clearInterval(timer);
        timer = null;
      }
    }).observe(el);
  }

  /* ------------------------------------------------------------------ */
  /* Aparición al hacer scroll + contadores + inclinación                */
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

  const observeReveals = (root = document) => root.querySelectorAll('.reveal:not(.in)').forEach((el) => revealObserver.observe(el));

  function countUp(el) {
    const target = Number(el.dataset.count);
    if (!Number.isFinite(target) || reduceMotion) return;
    const dur = 1400;
    const start = performance.now();
    const fmt = (n) => (Number.isInteger(target) ? Math.round(n) : n.toFixed(1));
    (function frame(now) {
      const t = Math.min(1, (now - start) / dur);
      el.textContent = fmt(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(frame);
      else el.textContent = el.dataset.final;
    })(start);
  }

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
  /* Estado y utilidades                                                 */
  /* ------------------------------------------------------------------ */

  let content = [];
  let community = { ratings: {}, votes: { best: {}, played: {} }, comments: {}, mine: {} };
  let online = true;
  const byType = (t) => content.filter((i) => i.type === t);
  const me = () => account.me();

  function starsHtml(value) {
    const n = Math.round(Number(value) || 0);
    return `<span class="stars" aria-hidden="true">${'★'.repeat(n)}<span class="off">${'★'.repeat(5 - n)}</span></span>`;
  }
  const ratingOf = (id) => community.ratings[id] || null;
  const media = (item, cls = '') => (item.image
    ? `<img src="${esc(item.image)}" alt="" loading="lazy" class="${cls}">`
    : '<div class="placeholder" aria-hidden="true"><img src="assets/img/logo-small.webp" alt=""></div>');

  const isLive = (status) => /disponible|lanzado|ya|live|jugar/i.test(status || '');
  const statusClass = (status) => (isLive(status) ? 'tag--live' : 'tag--status');
  const gameOf = (n) => (n.game ? content.find((g) => g.id === n.game && g.type === 'app') : null);
  const ratingLine = (g) => {
    const r = ratingOf(g.id);
    return r ? `<span class="cart__stars">${starsHtml(r.avg)} ${r.avg.toFixed(1)} · ${r.count} reseña${r.count === 1 ? '' : 's'}<span class="sr-only"> (valoración ${r.avg} de 5)</span></span>` : '';
  };

  /* ------------------------------------------------------------------ */
  /* Juegos                                                              */
  /* ------------------------------------------------------------------ */

  let gameFilter = 'all';
  function renderGames() {
    const wrap = $('#games');
    if (!wrap) return;
    const all = byType('app').sort((a, b) => Number(b.featured) - Number(a.featured));
    const games = all.filter((g) => (gameFilter === 'all' ? true : gameFilter === 'live' ? isLive(g.status) : !isLive(g.status)));
    if (!games.length) {
      wrap.innerHTML = `<div class="empty" style="grid-column:1/-1">${all.length ? 'NINGÚN CARTUCHO CON ESE FILTRO' : 'NO HAY CARTUCHOS INSERTADOS… TODAVÍA'}</div>`;
      return;
    }
    wrap.innerHTML = games.map((g, i) => `
      <button type="button" class="cart reveal${g.featured && i === 0 && gameFilter === 'all' ? ' cart--featured' : ''}" style="--d:${Math.min(i, 5) * 0.08}s" data-open="${esc(g.id)}">
        <div class="cart__media">${media(g)}</div>
        <div class="cart__body">
          <div class="cart__meta">
            ${g.featured ? '<span class="tag tag--hot">Destacado</span>' : ''}
            ${g.status ? `<span class="tag ${statusClass(g.status)}">${esc(g.status)}</span>` : ''}
            ${g.platform ? `<span class="tag">${esc(g.platform)}</span>` : ''}
          </div>
          <h3 class="cart__title">${esc(g.title)}</h3>
          ${g.summary ? `<p class="cart__summary">${esc(g.summary)}</p>` : ''}
          ${ratingLine(g)}
          <span class="cart__cta">Ver más</span>
        </div>
      </button>`).join('');
    wrap.querySelectorAll('.cart').forEach(addTilt);
  }

  /* Destacado de la portada */
  function renderFeatured() {
    const wrap = $('#featured');
    if (!wrap) return;
    const games = byType('app');
    const g = games.find((x) => x.featured) || games[0];
    if (!g) { wrap.closest('section').hidden = true; return; }
    wrap.innerHTML = `
      <div class="feature reveal">
        <div class="feature__media">${media(g)}<span class="feature__badge">★ DESTACADO</span></div>
        <div class="feature__body">
          <div class="cart__meta">
            ${g.status ? `<span class="tag ${statusClass(g.status)}">${esc(g.status)}</span>` : ''}
            ${g.platform ? `<span class="tag">${esc(g.platform)}</span>` : ''}
          </div>
          <h3 class="feature__title">${esc(g.title)}</h3>
          ${g.summary ? `<p class="feature__summary">${esc(g.summary)}</p>` : ''}
          ${ratingLine(g)}
          <div class="feature__cta">
            <button class="btn btn--solid" type="button" data-open="${esc(g.id)}">▶ Ver ficha</button>
            ${g.link ? `<a class="btn" href="${esc(g.link)}" target="_blank" rel="noopener noreferrer">Jugar / descargar ↗</a>` : ''}
            <a class="btn" href="juegos.html" data-transition>Todos los juegos</a>
          </div>
        </div>
      </div>`;
  }

  /* Accesos a cada página en la portada */
  function renderExplore() {
    document.querySelectorAll('[data-count-type]').forEach((el) => {
      const n = byType(el.dataset.countType).length;
      el.textContent = n ? `${n} ${n === 1 ? el.dataset.one : el.dataset.many}` : el.dataset.none || '';
    });
  }

  /* ------------------------------------------------------------------ */
  /* Noticias: tarjetas con pestañas por juego                           */
  /* ------------------------------------------------------------------ */

  const NEWS_PAGE = 9;
  let newsShown = NEWS_PAGE;
  let newsFilter = 'all';

  function newsCard(n, i, wide = false) {
    const game = gameOf(n);
    return `
      <a class="ncard reveal${wide ? ' ncard--wide' : ''}" style="--d:${(i % 6) * 0.07}s" href="noticias.html#ver-${esc(n.id)}" data-open="${esc(n.id)}">
        <span class="ncard__media">${media(n)}<span class="ncard__tag">${esc(game ? game.title : 'THE THING')}</span></span>
        <span class="ncard__body">
          <time class="ncard__date" datetime="${esc(n.createdAt)}">${esc(formatDate(n.createdAt).toUpperCase())}</time>
          <span class="ncard__title">${esc(n.title)}</span>
          ${wide && n.summary ? `<span class="ncard__summary">${esc(n.summary)}</span>` : ''}
          <span class="ncard__more">LEER MÁS <i aria-hidden="true">▶</i></span>
        </span>
      </a>`;
  }

  function newsTabs(news) {
    const games = byType('app').filter((g) => news.some((n) => n.game === g.id));
    const general = news.some((n) => !gameOf(n));
    const tabs = [['all', 'TODAS LAS NOTICIAS'], ...games.map((g) => [g.id, g.title])];
    if (games.length && general) tabs.push(['general', 'GENERAL']);
    if (!tabs.some(([k]) => k === newsFilter)) newsFilter = 'all';
    return tabs.map(([k, label]) => `<button type="button" class="ntab" role="tab" aria-selected="${k === newsFilter}" data-news-tab="${esc(k)}"><span>${esc(label)}</span></button>`).join('');
  }

  const filteredNews = (news) => news.filter((n) => (newsFilter === 'all' ? true : newsFilter === 'general' ? !gameOf(n) : n.game === newsFilter));

  function renderNews() {
    const wrap = $('#news');
    if (!wrap) return;
    const news = byType('news');
    const tabs = $('#newsTabs');
    const isHome = wrap.dataset.limit !== undefined;
    if (tabs) {
      tabs.innerHTML = news.length > 1 ? newsTabs(news) : '';
      tabs.hidden = !tabs.innerHTML;
    }
    const list = filteredNews(news);
    const more = $('#moreNews');
    if (!list.length) {
      wrap.innerHTML = '<div class="empty" style="grid-column:1/-1">SIN SEÑAL. NO HAY TRANSMISIONES.</div>';
      if (more) more.hidden = true;
      return;
    }
    const limit = isHome ? Number(wrap.dataset.limit) : newsShown;
    const wideFirst = !isHome && newsFilter === 'all' && list.length > 2;
    wrap.innerHTML = list.slice(0, limit).map((n, i) => newsCard(n, i, wideFirst && i === 0)).join('');
    if (more) more.hidden = isHome || list.length <= newsShown;
    observeReveals(wrap);
  }

  /* ------------------------------------------------------------------ */
  /* Datos, galería y ticker                                             */
  /* ------------------------------------------------------------------ */

  function renderScores() {
    const wrap = $('#scores');
    if (!wrap) return;
    const data = byType('data').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (!data.length) {
      wrap.closest('section').hidden = true;
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
    if (wrap.classList.contains('in')) wrap.querySelectorAll('[data-count]').forEach(countUp);
  }

  function renderGallery() {
    const wrap = $('#gallery');
    if (!wrap) return;
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

  /**
   * Cinta de titulares. Dos copias idénticas una detrás de otra: al
   * desplazarse exactamente el ancho de una, el bucle no da saltos.
   * La velocidad es fija (px por segundo) aunque cambie el texto.
   */
  function renderTicker() {
    const track = $('#ticker');
    if (!track) return;
    const items = [...byType('news').slice(0, 5), ...byType('app').slice(0, 4)];
    const parts = items.map((i) => `<a href="${site.itemUrl(i)}" data-open="${esc(i.id)}">${esc(i.title)}</a>`);
    parts.unshift('BIENVENIDOS A THE THING');
    parts.push('INSERT COIN', 'PRESS START');
    const group = parts.map((p) => `<span>${p}</span>`).join('');
    track.innerHTML = `<div class="ticker__group">${group}</div><div class="ticker__group" aria-hidden="true">${group.replace(/<a /g, '<a tabindex="-1" ')}</div>`;
    const fit = () => {
      const w = track.firstElementChild.getBoundingClientRect().width;
      track.style.setProperty('--ticker-dur', `${Math.max(18, w / 75).toFixed(1)}s`);
      track.classList.add('run');
    };
    fit();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  }

  /* ------------------------------------------------------------------ */
  /* Votaciones                                                          */
  /* ------------------------------------------------------------------ */

  const VOTE_CATS = [
    { key: 'best', icon: '♛', title: 'Mejor juego', text: 'El que pondrías en tu salón de la fama.' },
    { key: 'played', icon: '▶', title: 'Más jugado', text: 'Al que más horas le has dedicado.' },
  ];
  function renderVotes() {
    const wrap = $('#votes');
    if (!wrap) return;
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
    if (!me()) return account.openAuth('register', 'Regístrate para votar', () => vote(category, item));
    try {
      community = { ...community, ...(await api('api/community.php?action=vote', { json: { category, item } })) };
      beep('coin');
      toast('¡VOTO REGISTRADO!');
      renderVotes();
    } catch (err) {
      account.handleError(err);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Vídeos: estante de cassettes → vídeo VHS → televisor CRT             */
  /* ------------------------------------------------------------------ */

  const LABEL_COLORS = ['#efe8d6', '#f4d35e', '#ff8a5b', '#8fe3cf', '#f2f2f2', '#c3b1e1', '#ffb3c1'];
  const labelColor = (i) => LABEL_COLORS[i % LABEL_COLORS.length];
  let playingTape = null;
  let busy = false;
  let vcrTimer = null;

  function renderTapes() {
    const shelf = $('#tapes');
    if (!shelf) return;
    const vids = byType('video');
    $('#shelfTip').textContent = vids.length ? 'Pasa el ratón por un cassette' : '';
    if (!vids.length) {
      shelf.innerHTML = '<p class="empty-msg">EL ESTANTE ESTÁ VACÍO… DE MOMENTO</p>';
      return;
    }
    shelf.innerHTML = vids.map((v, i) => {
      const tilt = i % 5 === 3 ? '-4deg' : i % 7 === 5 ? '3deg' : '0deg';
      return `
        <button type="button" class="spine${playingTape === v.id ? ' empty' : ''}" data-tape="${esc(v.id)}" data-i="${i}"
          style="--lc:${labelColor(i)}; --tilt:${tilt}; --d:${Math.min(i, 12) * 0.05}s" aria-label="Reproducir ${esc(v.title)}">
          <span class="spine__brand" aria-hidden="true">THE THING</span>
          <span class="spine__label"><span class="spine__title">${esc(v.title)}</span></span>
          <span class="spine__vhs" aria-hidden="true">VHS</span>
        </button>`;
    }).join('');
  }

  const ytId = (url) => {
    const m = String(url).match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/|v\/)|youtu\.be\/)([\w-]{11})/);
    return m ? m[1] : null;
  };
  const vimeoId = (url) => {
    const m = String(url).match(/vimeo\.com\/(?:video\/)?(\d+)/);
    return m ? m[1] : null;
  };
  function externalLink(url) {
    const yt = ytId(url);
    if (yt) return `https://www.youtube.com/watch?v=${yt}`;
    const vm = vimeoId(url);
    if (vm) return `https://vimeo.com/${vm}`;
    return url;
  }

  /**
   * Reproductor según el tipo de enlace.
   * - YouTube y Vimeo son de terceros: solo se cargan si el visitante lo
   *   permitió en el aviso de cookies (si no, se devuelve 'consent').
   * - YouTube exige saber desde qué web se reproduce: abierto como archivo
   *   (file://) no funciona y se devuelve 'file'.
   */
  function playerHtml(url) {
    const yt = ytId(url);
    const vm = vimeoId(url);
    if ((yt || vm) && !site.consent.media()) return 'consent';
    if (yt) {
      if (location.protocol === 'file:') return 'file';
      const origin = encodeURIComponent(location.origin);
      return `<iframe src="https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0&playsinline=1&modestbranding=1&origin=${origin}" title="Vídeo de YouTube"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
    }
    if (vm) {
      return `<iframe src="https://player.vimeo.com/video/${vm}?autoplay=1&dnt=1" title="Vídeo de Vimeo" allow="autoplay; fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
    }
    return `<video src="${esc(url)}" controls autoplay playsinline></video>`;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, reduceMotion ? 0 : ms));
  const pad2 = (n) => String(n).padStart(2, '0');
  const setVcr = (mode, clock) => {
    $('#vcrMode').textContent = mode;
    if (clock !== undefined) $('#vcrClock').textContent = clock;
  };

  /** Destello y chispas en el sitio del cassette (dentro del mueble, así no le afecta el scroll). */
  function spark(spine) {
    const host = spine.closest('.bookcase');
    const hr = host.getBoundingClientRect();
    const r = spine.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'spark';
    el.style.left = `${r.left - hr.left + r.width / 2}px`;
    el.style.top = `${r.top - hr.top + r.height / 2}px`;
    el.innerHTML = `<i class="spark__flash"></i><i class="spark__ring"></i>${Array.from({ length: 12 }, (_, i) => `<b style="--a:${i * 30 + Math.round(Math.random() * 14)}deg; --l:${36 + Math.round(Math.random() * 46)}px"></b>`).join('')}`;
    host.appendChild(el);
    setTimeout(() => el.remove(), 800);
  }

  function startPlayback(v) {
    const tv = $('#tv');
    const screen = $('#tvGlass');
    screen.querySelectorAll('iframe, video').forEach((el) => el.remove());
    tv.classList.remove('playing', 'message', 'power-off', 'switching');
    $('#tvCh').textContent = '03';
    setVcr('PLAY ▶', '0:00');
    $('#nowPlaying').innerHTML = `AHORA: <b>${esc(v.title)}</b>${v.summary ? ` — ${esc(v.summary)}` : ''}
      <a href="${esc(externalLink(v.videoUrl))}" target="_blank" rel="noopener noreferrer">Ver en ${ytId(v.videoUrl) ? 'YouTube' : vimeoId(v.videoUrl) ? 'Vimeo' : 'otra pestaña'} ↗</a>`;
    const html = playerHtml(v.videoUrl);
    const service = ytId(v.videoUrl) ? 'YouTube' : 'Vimeo';
    if (html === 'consent') {
      tv.classList.add('playing', 'message', 'power-on');
      $('#tvOsd').innerHTML = `<b>CONTENIDO DE ${service.toUpperCase()}</b>
        <small style="animation:none">Este vídeo está alojado en ${service}, que puede usar cookies propias.<br>Para verlo aquí necesitamos tu permiso.</small>
        <span class="crt__osd-btns"><button type="button" class="btn btn--sm" data-allow-media>▶ Permitir y reproducir</button>
        <a href="${esc(externalLink(v.videoUrl))}" target="_blank" rel="noopener noreferrer">Ver en ${service} ↗</a></span>`;
    } else if (html === 'file') {
      tv.classList.add('playing', 'message', 'power-on');
      $('#tvOsd').innerHTML = `<b>NO SE PUEDE REPRODUCIR AQUÍ</b>
        <small style="animation:none">YouTube no funciona al abrir la web como archivo (file://).<br>En tu servidor (Hostinger o probar-con-php) sí funciona.</small>
        <a href="${esc(externalLink(v.videoUrl))}" target="_blank" rel="noopener noreferrer">▶ Ver en YouTube ↗</a>`;
    } else {
      screen.insertAdjacentHTML('afterbegin', html);
      tv.classList.add('playing', 'power-on', 'osd');
    }
    setTimeout(() => tv.classList.remove('power-on'), 750);
    setTimeout(() => tv.classList.remove('osd'), 3300);
    const start = Date.now();
    clearInterval(vcrTimer);
    vcrTimer = setInterval(() => {
      const t = Math.floor((Date.now() - start) / 1000);
      $('#vcrClock').textContent = `${Math.floor(t / 60)}:${pad2(t % 60)}`;
      $('#vhsTime').textContent = `SP 0:${pad2(Math.floor(t / 60))}:${pad2(t % 60)}`;
    }, 1000);
  }

  /** Clic en un cassette: sale del estante hacia ti, chispazo y a reproducir. */
  async function playTape(id) {
    const v = content.find((i) => i.id === id && i.type === 'video');
    if (!v || busy || playingTape === id) return;
    busy = true;
    const tv = $('#tv');
    const vcr = $('#vcr');
    try {
      if (playingTape) await ejectTape(true);
      const spine = document.querySelector(`.spine[data-tape="${CSS.escape(id)}"]`);
      beep('select');
      setVcr('LOAD', '--:--');
      if (spine && !reduceMotion) {
        spine.classList.add('pull');
        await sleep(360);
        spark(spine);
        beep('coin');
        await sleep(90);
      }
      if (spine) {
        spine.classList.remove('pull');
        spine.classList.add('empty');
      }
      vcr.classList.remove('zap');
      void vcr.offsetWidth;
      vcr.classList.add('has-tape', 'zap');
      playingTape = id;
      startPlayback(v);
      // Si la pantalla no se ve entera (móvil, estante abajo), se desplaza hasta ella
      const r = $('#tvGlass').getBoundingClientRect();
      if (r.top < 70 || r.bottom > window.innerHeight) $('#tvGlass').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    } finally {
      busy = false;
    }
  }

  /** Expulsa el cassette: el tubo se apaga y la cinta vuelve a su hueco. */
  async function ejectTape(silent = false) {
    if (!playingTape) return;
    const id = playingTape;
    const tv = $('#tv');
    const vcr = $('#vcr');
    clearInterval(vcrTimer);
    if (!silent) beep('back');
    setVcr('EJECT', '--:--');
    tv.classList.remove('osd');
    tv.classList.add('power-off');
    await sleep(silent ? 260 : 420);
    $('#tvGlass').querySelectorAll('iframe, video').forEach((el) => el.remove());
    tv.classList.remove('playing', 'message', 'power-off');
    $('#tvOsd').innerHTML = '<b>SIN SEÑAL</b><small>SACA UN CASSETTE DEL ESTANTE</small>';
    $('#tvCh').textContent = '--';
    $('#nowPlaying').textContent = '';
    playingTape = null;
    vcr.classList.remove('has-tape', 'zap');
    const spine = document.querySelector(`.spine[data-tape="${CSS.escape(id)}"]`);
    if (spine) {
      spine.classList.remove('empty');
      spine.classList.add('back');
      setTimeout(() => spine.classList.remove('back'), 520);
    }
    setVcr('STOP', '--:--');
  }

  function initVideoClub() {
    const tapesEl = $('#tapes');
    if (!tapesEl) return;
    tapesEl.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tape]');
      if (t) playTape(t.dataset.tape);
    });
    tapesEl.addEventListener('pointerover', (e) => {
      const t = e.target.closest('[data-tape]');
      if (!t) return;
      const v = content.find((i) => i.id === t.dataset.tape);
      if (v) $('#shelfTip').innerHTML = `<b>${esc(v.title)}</b>${v.summary ? `<br>${esc(v.summary)}` : ''}`;
    });
    tapesEl.addEventListener('pointerleave', () => { if (byType('video').length) $('#shelfTip').textContent = 'Pasa el ratón por un cassette'; });
    $('#vcrEject').addEventListener('click', () => { if (!busy) ejectTape(); });
    $('#vcrStop').addEventListener('click', () => { if (!busy) ejectTape(); });
    $('#tv').addEventListener('click', (e) => {
      if (!e.target.closest('[data-allow-media]')) return;
      site.consent.allowMedia();
      beep('coin');
      const v = content.find((i) => i.id === playingTape);
      if (v) startPlayback(v);
    });
  }

  function renderAll() {
    renderFeatured();
    renderExplore();
    renderGames();
    renderTapes();
    renderVotes();
    renderNews();
    renderScores();
    renderGallery();
    renderTicker();
    observeReveals();
  }

  /* ------------------------------------------------------------------ */
  /* Ficha de juego / noticia                                            */
  /* ------------------------------------------------------------------ */

  const detail = createModal();
  const lightbox = createModal('lightbox');

  /** Abre un elemento en esta página. Devuelve false si hay que ir a otra. */
  function openItem(id, pushHash = true) {
    const item = content.find((i) => i.id === id);
    if (!item) return false;
    if (item.type === 'image') { openShot(byType('image').indexOf(item)); return true; }
    if (item.type === 'video') {
      if (!$('#tapes')) return false;
      $('#videos').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
      setTimeout(() => playTape(item.id), reduceMotion ? 0 : 500);
      return true;
    }
    if (item.type !== 'app' && item.type !== 'news') return false;
    const isApp = item.type === 'app';
    const game = isApp ? null : gameOf(item);
    const tags = [
      isApp && item.status ? `<span class="tag ${statusClass(item.status)}">${esc(item.status)}</span>` : '',
      isApp && item.platform ? `<span class="tag">${esc(item.platform)}</span>` : '',
      game ? `<span class="tag tag--live">${esc(game.title)}</span>` : '',
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
          ${game ? `<button class="btn" type="button" data-open="${esc(game.id)}">▶ Ver ${esc(game.title)}</button>` : ''}
          ${isApp ? `<a class="btn" href="soporte.html?tipo=juegos&juego=${encodeURIComponent(item.id)}#contacto">? Soporte del juego</a>` : ''}
          <button class="btn" type="button" data-close>◀ Volver</button>
        </div>
      </article>
      <section class="reviews" id="reviews" aria-live="polite"><p class="term" style="color:var(--muted)">CARGANDO TRANSMISIONES…</p></section>`, () => {
      if (location.hash.startsWith('#ver-')) history.replaceState(null, '', location.pathname + location.search);
    });
    if (pushHash) history.replaceState(null, '', `#ver-${id}`);
    loadReviews(item);
    return true;
  }
  window.TT.openItem = (id) => openItem(id);

  /* ------------------------------------------------------------------ */
  /* Reseñas (juegos) y comentarios (noticias) en formato "código retro" */
  /* ------------------------------------------------------------------ */

  const PLAYER_COLORS = ['#38e8ff', '#ffb547', '#ff7ad9', '#b18cff', '#ff5f6d', '#7ad7ff', '#ffd84d'];
  const playerColor = (name) => PLAYER_COLORS[[...String(name)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % PLAYER_COLORS.length];
  const reviewCode = (id) => (String(id).toUpperCase().replace(/[^0-9A-F]/g, '') + '000000000000').slice(0, 12).match(/.{4}/g).join('-');
  const REPORT_REASONS = [['spam', 'Spam o publicidad'], ['ofensivo', 'Insultos u odio'], ['acoso', 'Acoso'], ['spoiler', 'Spoiler'], ['ilegal', 'Contenido ilegal'], ['otro', 'Otro motivo']];
  let reviewsToken = 0;
  let currentItem = null;

  async function loadReviews(item) {
    currentItem = item;
    const token = ++reviewsToken;
    let list = [];
    if (online) {
      try { list = await api(`api/community.php?action=comments&item=${encodeURIComponent(item.id)}`); } catch { list = null; }
    }
    if (token !== reviewsToken) return;
    const box = document.getElementById('reviews');
    if (box) renderReviews(box, item, list);
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
    if (!me()) {
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
          <p class="review-form__rules">Sé respetuoso: sin insultos, spam ni datos personales. <a href="normas.html" target="_blank">Normas de la comunidad</a></p>
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
        <p class="code-card__who">&gt; PLAYER: <span class="player" style="--pc:${playerColor(c.name)}">${esc(c.name.toUpperCase())}</span> · ${formatDate(c.createdAt, 'vhs')}${c.updatedAt !== c.createdAt ? ' · EDITADO' : ''}</p>
        <p class="code-card__text">${esc(c.text)}</p>
        <div class="code-card__actions">
          ${c.canDelete ? `<button class="code-card__del" type="button" data-del-comment="${esc(c.id)}">[ BORRAR ]</button>` : ''}
          ${!c.mine ? `<button class="code-card__del" type="button" data-report="${esc(c.id)}">[ DENUNCIAR ]</button>` : ''}
        </div>
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
        toast('MENSAJE BORRADO');
        await refreshCommunity();
        loadReviews(item);
      } catch (err) { account.handleError(err); }
    }));
    box.querySelectorAll('[data-report]').forEach((b) => b.addEventListener('click', () => {
      if (!me()) return account.openAuth('login', 'Inicia sesión para denunciar un comentario');
      const card = b.closest('.code-card');
      if (card.querySelector('.report-box')) return;
      card.insertAdjacentHTML('beforeend', `
        <div class="report-box">
          <label class="tt-field"><span>¿POR QUÉ LO DENUNCIAS?</span>
            <select>${REPORT_REASONS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
          <button class="btn btn--sm btn--danger" type="button">Enviar denuncia</button>
        </div>`);
      const rb = card.querySelector('.report-box');
      rb.querySelector('button').addEventListener('click', async () => {
        try {
          await api('api/community.php?action=report', { json: { id: b.dataset.report, reason: rb.querySelector('select').value } });
          rb.innerHTML = '<p class="term" style="color:var(--acc);margin:0">✓ GRACIAS. EL EQUIPO LO REVISARÁ.</p>';
          beep('coin');
        } catch (err) { account.handleError(err); }
      });
    }));
    if (!form) return;
    const stars = [...form.querySelectorAll('[data-star]')];
    stars.forEach((b) => b.addEventListener('click', () => {
      const n = Number(b.dataset.star);
      form.rating.value = n;
      stars.forEach((s) => {
        s.classList.toggle('on', Number(s.dataset.star) <= n);
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
        toast(item.type === 'app' ? '¡RESEÑA GUARDADA!' : '¡COMENTARIO PUBLICADO!');
        await refreshCommunity();
        loadReviews(item);
      } catch (ex) {
        if (ex.status === 401) account.handleError(ex);
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
      renderFeatured();
      renderVotes();
      observeReveals();
    } catch { /* sin conexión */ }
  }

  account.onChange(() => {
    refreshCommunity();
    if (detail.isOpen() && currentItem) loadReviews(currentItem);
  });

  /* Galería: visor */
  let shotIndex = 0;
  function openShot(index) {
    const imgs = byType('image');
    if (!imgs.length || index < 0) return;
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

  /* ------------------------------------------------------------------ */
  /* Clics                                                               */
  /* ------------------------------------------------------------------ */

  document.addEventListener('click', (e) => {
    const open = e.target.closest('[data-open]');
    if (open) {
      if (openItem(open.dataset.open) !== false) e.preventDefault();
      return;
    }
    const shot = e.target.closest('[data-shot]');
    if (shot) return openShot(Number(shot.dataset.shot));
    const v = e.target.closest('[data-vote]');
    if (v) return vote(v.dataset.vote, v.dataset.item);
    const tab = e.target.closest('[data-news-tab]');
    if (tab) {
      newsFilter = tab.dataset.newsTab;
      newsShown = NEWS_PAGE;
      beep('blip');
      renderNews();
      return;
    }
    const gf = e.target.closest('[data-game-filter]');
    if (gf) {
      gameFilter = gf.dataset.gameFilter;
      document.querySelectorAll('[data-game-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b === gf)));
      beep('blip');
      renderGames();
      observeReveals();
    }
  });

  const moreNews = $('#moreNews');
  if (moreNews) moreNews.addEventListener('click', () => {
    newsShown += NEWS_PAGE;
    renderNews();
  });

  window.addEventListener('hashchange', () => {
    if (location.hash.startsWith('#ver-')) openItem(decodeURIComponent(location.hash.slice(5)), false);
  });

  /* ------------------------------------------------------------------ */
  /* Arranque                                                            */
  /* ------------------------------------------------------------------ */

  initHero();
  initCat();
  initCountdown();
  initVideoClub();
  observeReveals();

  const loaded = site.ready.then((data) => {
    content = data.content;
    online = data.online;
    if (data.community) community = data.community;
    renderAll();
  });

  Promise.all([runBoot(), loaded]).then(() => {
    if (site.page === 'home') site.showCookieBar();
    if (location.hash.startsWith('#ver-')) openItem(decodeURIComponent(location.hash.slice(5)), false);
  });
})();
