/* THE THING — panel de administración */
(function () {
  'use strict';

  const { api, escapeHtml: esc, formatDate, beep, toast, createModal, reduceMotion } = window.TT;
  const $ = (sel, root = document) => root.querySelector(sel);

  window.TT.initCommon();

  const TYPES = {
    app: {
      label: 'Juegos / apps', one: 'juego o aplicación', nuevo: 'Nuevo juego / app', icon: '▶',
      desc: 'Tus juegos y aplicaciones. El destacado aparece grande en la portada.',
      fields: ['title', 'summary', 'body', 'image', 'platform', 'status', 'link', 'playPackage', 'appKey', 'downloads', 'featured', 'notify'],
    },
    news: {
      label: 'Noticias', one: 'noticia', nuevo: 'Nueva noticia', icon: '✉',
      desc: 'Anuncios, diarios de desarrollo y novedades del estudio.',
      fields: ['title', 'game', 'summary', 'body', 'image', 'link', 'featured', 'notify'],
    },
    data: {
      label: 'Datos', one: 'dato', nuevo: 'Nuevo dato', icon: '#',
      desc: 'Cifras para el marcador "High scores" de la portada. Los números se animan solos.',
      fields: ['title', 'value', 'summary'],
    },
    image: {
      label: 'Galería', one: 'imagen', nuevo: 'Nueva imagen', icon: '▣',
      desc: 'Capturas, arte conceptual y fotos. Se muestran como polaroids en la portada.',
      fields: ['image', 'title', 'summary', 'notify'],
    },
    video: {
      label: 'Vídeos', one: 'vídeo', nuevo: 'Nuevo vídeo', icon: '▷',
      desc: 'Cada vídeo es un cassette VHS que los visitantes meten en la tele vieja de la portada.',
      fields: ['title', 'videoUrl', 'image', 'summary', 'notify'],
    },
    product: {
      label: 'Tienda', one: 'producto', nuevo: 'Nuevo producto', icon: '$',
      desc: 'Merch de la tienda. Si no pones enlace de compra, el botón abre un correo de pedido.',
      fields: ['title', 'price', 'currency', 'summary', 'body', 'image', 'sizes', 'status', 'link', 'notify'],
    },
  };

  const FIELD_LABELS = {
    app: { title: 'Nombre del juego / app *', summary: 'Descripción corta', body: 'Descripción completa', link: 'Enlace de descarga o tienda' },
    news: { title: 'Titular *', summary: 'Entradilla (resumen)', body: 'Cuerpo de la noticia', link: 'Enlace relacionado' },
    data: { title: 'Etiqueta * (ej. "Jugadores")', summary: 'Nota pequeña' },
    image: { title: 'Título *', summary: 'Descripción' },
    video: { title: 'Título del cassette *', summary: 'Descripción corta' },
    product: { title: 'Nombre del producto *', summary: 'Descripción corta', body: 'Detalles (materiales, envío…)', link: 'Enlace de compra (Mercado Pago, PayPal, Shopify…)' },
  };
  const PRODUCT_STATUS = ['Disponible', 'Pocas unidades', 'Próximamente', 'Agotado'];
  const CURRENCIES = ['USD', 'MXN', 'EUR', 'ARS', 'COP', 'CLP', 'PEN'];

  const STATUS = ['En desarrollo', 'Próximamente', 'Acceso anticipado', 'Disponible', 'Beta', 'Cancelado'];

  let content = [];
  let tab = 'overview';
  const editor = createModal();
  const confirmModal = createModal('modal--small');

  /* ------------------------------------------------------------------ */
  /* Sesión                                                              */
  /* ------------------------------------------------------------------ */

  async function boot() {
    let status;
    try {
      status = await api('api/auth.php?action=status');
    } catch (err) {
      $('#loading').innerHTML = `<div class="login-card" style="text-align:center"><h1 class="login-card__title pixel">ERROR DE CONEXIÓN</h1>
        <p class="form__hint">No se pudo contactar con <code>api/auth.php</code>.</p>
        <p class="form__hint" style="text-align:left">${connectionHint(err)}</p>
        <p class="form__error">${esc(err.message)}</p><a class="btn" href="index.html">◀ Volver</a></div>`;
      return;
    }
    $('#loading').hidden = true;
    if (status.user) return showDash(status.user);
    showLogin(status);
    if (status.pendingPin) showPin({ sentTo: status.sentTo, mailSent: true, resumed: true });
  }

  /** Explica la causa más probable de que la API no responda. */
  function connectionHint(err) {
    if (location.protocol === 'file:') {
      return 'Abriste el archivo directamente desde tu computadora (file://). El panel solo funciona cuando la web está subida a un servidor con PHP: súbela a <b>public_html</b> en Hostinger y entra en <b>https://tudominio.com/admin.html</b>.';
    }
    if (err.status === 404) {
      return 'La carpeta <b>api</b> no está en el servidor. Sube TODO el contenido del .zip a <b>public_html</b> (incluidas las carpetas api, assets, data y uploads).';
    }
    if (err.status >= 500) {
      return 'PHP dio un error. Abre <b>api/check.php</b> en el navegador para ver qué falla (versión de PHP o permisos de las carpetas data y uploads, que deben ser 755).';
    }
    return 'El servidor respondió algo que no es la API (¿PHP desactivado o la web en otra carpeta?). Abre <b>api/check.php</b>: si ves texto con "php_version", PHP funciona; si ves el código fuente o un error, revisa la configuración de PHP en hPanel.';
  }

  function showLogin(status) {
    $('#dashScreen').hidden = true;
    $('#loginScreen').hidden = false;
    const card = $('#loginCard');
    card.classList.remove('granted');
    $('#pinForm').hidden = true;
    if (status.needsSetup) {
      $('#loginForm').hidden = true;
      $('#setupForm').hidden = false;
      $('#loginTitle').textContent = 'CONFIGURACIÓN';
      $('#loginEyebrow').textContent = 'Nuevo jugador';
      $('#setupEmail').textContent = status.email;
      $('#setupForm [name=password]').focus();
    } else {
      $('#loginForm').hidden = false;
      $('#setupForm').hidden = true;
      $('#loginTitle').textContent = 'ACCESO STAFF';
      $('#loginEyebrow').textContent = 'Área restringida';
      $('#loginEmail').value = status.email || '';
      ($('#loginEmail').value ? $('#loginForm [name=password]') : $('#loginEmail')).focus();
    }
  }

  function denied(card, errEl, message) {
    errEl.textContent = `✖ ${message}`;
    card.classList.remove('shake');
    void card.offsetWidth;
    card.classList.add('shake');
    beep('error');
  }

  /* --- Paso 2: PIN enviado por correo --- */
  const pinInputs = [...document.querySelectorAll('#pinBoxes input')];

  function showPin(info) {
    $('#loginForm').hidden = true;
    $('#setupForm').hidden = true;
    $('#pinForm').hidden = false;
    $('#loginTitle').textContent = 'VERIFICA TU PIN';
    $('#loginEyebrow').textContent = 'Paso 2 de 2';
    $('#pinError').textContent = '';
    let hint = `Te enviamos un PIN de 6 dígitos a <b>${esc(info.sentTo || '')}</b>. Caduca en ${info.minutes || 10} minutos.`;
    if (info.resumed) hint = `Escribe el PIN que enviamos a <b>${esc(info.sentTo || '')}</b>.`;
    if (info.mailSent === false && !window.TT.demo) {
      hint = 'No se pudo enviar el correo desde este servidor. Abre <b>data/ultimo-pin.php</b> con el Administrador de archivos de Hostinger para ver tu PIN (y revisa MAIL_FROM en api/config.php).';
    }
    $('#pinHint').innerHTML = hint;
    pinInputs.forEach((i) => { i.value = ''; });
    setTimeout(() => pinInputs[0].focus(), 80);
    beep('select');
    if (info.demoMail) showDemoMail(info.demoMail);
  }

  /** En la demo no hay correo: se muestra aquí el email que llegaría. */
  const mailModal = createModal();
  function showDemoMail(html) {
    mailModal.open(`
      <button class="icon-btn modal__close" type="button" data-close title="Cerrar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>
        <span class="sr-only">Cerrar</span>
      </button>
      <div style="padding:14px 18px 8px;font-family:var(--term);font-size:20px;color:var(--muted)">📧 CORREO SIMULADO (modo demo) · así llega a tu bandeja</div>
      <iframe class="mail-preview" title="Vista previa del correo"></iframe>`);
    mailModal.panel.querySelector('iframe').srcdoc = html;
  }

  pinInputs.forEach((input, i) => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(-1);
      if (input.value && pinInputs[i + 1]) pinInputs[i + 1].focus();
      if (pinInputs.every((x) => x.value)) $('#pinForm').requestSubmit();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && pinInputs[i - 1]) pinInputs[i - 1].focus();
    });
    input.addEventListener('paste', (e) => {
      const digits = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
      if (!digits) return;
      e.preventDefault();
      digits.split('').forEach((d, k) => { if (pinInputs[k]) pinInputs[k].value = d; });
      (pinInputs[digits.length] || pinInputs[5]).focus();
      if (digits.length === 6) $('#pinForm').requestSubmit();
    });
  });

  $('#pinForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pin = pinInputs.map((x) => x.value).join('');
    const err = $('#pinError');
    if (pin.length !== 6) return denied($('#loginCard'), err, 'Escribe los 6 dígitos');
    const btn = e.currentTarget.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      const res = await api('api/auth.php?action=verify', { json: { pin } });
      granted(res.user);
    } catch (ex) {
      denied($('#loginCard'), err, ex.message);
      pinInputs.forEach((x) => { x.value = ''; });
      pinInputs[0].focus();
      if (ex.status === 401) setTimeout(() => showLogin({ email: $('#loginEmail').value }), 1600);
    } finally {
      btn.disabled = false;
    }
  });
  $('#pinResend').addEventListener('click', async () => {
    try {
      const res = await api('api/auth.php?action=resend', { method: 'POST' });
      toast('PIN reenviado');
      showPin(res);
    } catch (ex) {
      denied($('#loginCard'), $('#pinError'), ex.message);
    }
  });
  $('#pinBack').addEventListener('click', () => {
    api('api/auth.php?action=logout', { method: 'POST' }).catch(() => {});
    showLogin({ email: $('#loginEmail').value });
  });

  function granted(user) {
    const card = $('#loginCard');
    $('#loginTitle').textContent = 'ACCESO CONCEDIDO';
    beep('coin');
    card.classList.add('granted');
    setTimeout(() => showDash(user), reduceMotion ? 0 : 850);
  }

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const btn = form.querySelector('button');
    const err = $('#loginError');
    err.textContent = '';
    btn.disabled = true;
    try {
      const res = await api('api/auth.php?action=login', { json: { email: form.email.value, password: form.password.value } });
      form.password.value = '';
      if (res.step === 'pin') showPin(res);
      else granted(res.user);
    } catch (ex) {
      denied($('#loginCard'), err, ex.message);
    } finally {
      btn.disabled = false;
    }
  });

  $('#setupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const err = $('#setupError');
    err.textContent = '';
    if (form.password.value.length < 8) return denied($('#loginCard'), err, 'Mínimo 8 caracteres');
    if (form.password.value !== form.confirm.value) return denied($('#loginCard'), err, 'Las contraseñas no coinciden');
    try {
      const res = await api('api/auth.php?action=setup', { json: { password: form.password.value } });
      form.reset();
      if (res.step === 'pin') showPin(res);
      else granted(res.user);
    } catch (ex) {
      denied($('#loginCard'), err, ex.message);
    }
  });

  $('#logoutBtn').addEventListener('click', async () => {
    try { await api('api/auth.php?action=logout', { method: 'POST' }); } catch { /* ignore */ }
    beep('back');
    showLogin({ email: $('#userEmail').textContent });
  });

  async function showDash(user) {
    $('#loginScreen').hidden = true;
    $('#dashScreen').hidden = false;
    $('#userEmail').textContent = user;
    await loadContent();
    const fromHash = location.hash.slice(1);
    setTab(TYPES[fromHash] || ['account', 'stats', 'community', 'support', 'settings', 'social'].includes(fromHash) ? fromHash : 'overview');
    refreshBadges();
  }

  /** Si la sesión caducó, vuelve al login. */
  function handleAuthError(err) {
    if (err.status === 401) {
      toast('La sesión expiró. Vuelve a entrar.', 'error');
      editor.close();
      showLogin({ email: $('#userEmail').textContent });
      return true;
    }
    return false;
  }

  async function loadContent() {
    try {
      content = await api('api/content.php');
    } catch (err) {
      toast(`No se pudo cargar el contenido: ${err.message}`, 'error');
    }
  }

  /* ------------------------------------------------------------------ */
  /* Pestañas                                                            */
  /* ------------------------------------------------------------------ */

  document.querySelectorAll('.admin-nav [data-tab]').forEach((b) => {
    b.addEventListener('click', () => { setTab(b.dataset.tab); beep('select'); });
  });

  function setTab(name) {
    tab = name;
    document.querySelectorAll('.admin-nav [data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    history.replaceState(null, '', name === 'overview' ? location.pathname : `#${name}`);
    render();
  }

  function render() {
    const panel = $('#panel');
    if (tab === 'overview') panel.innerHTML = renderOverview();
    else if (tab === 'stats') return renderStats(panel);
    else if (tab === 'community') return renderCommunity(panel);
    else if (tab === 'support') return renderSupport(panel);
    else if (tab === 'settings') return renderSettings(panel);
    else if (tab === 'social') return renderSocial(panel);
    else if (tab === 'account') panel.innerHTML = renderAccount();
    else panel.innerHTML = renderList(tab);
    if (tab === 'account') bindAccount();
    if (TYPES[tab]) bindSearch();
  }

  function thumb(item) {
    if (item.type === 'data') return `<div class="row__thumb">${esc(String(item.value || '?').slice(0, 5))}</div>`;
    if (item.type === 'video') return '<div class="row__thumb">▷</div>';
    return `<div class="row__thumb">${item.image ? `<img src="${esc(item.image)}" alt="" loading="lazy">` : TYPES[item.type].icon}</div>`;
  }

  function row(item, i) {
    return `
      <div class="row" style="--d:${Math.min(i, 12) * 0.03}s" data-id="${esc(item.id)}">
        ${thumb(item)}
        <div style="min-width:0">
          <p class="row__title">${esc(item.title)}</p>
          <div class="row__meta">
            <span>${formatDate(item.createdAt)}</span>
            ${item.featured ? '<span class="tag tag--hot">Destacado</span>' : ''}
            ${item.status ? `<span class="tag tag--status">${esc(item.status)}</span>` : ''}
            ${tab === 'overview' ? `<span class="tag">${esc(TYPES[item.type].label)}</span>` : ''}
          </div>
        </div>
        <div class="row__actions">
          <button class="btn btn--sm" type="button" data-edit="${esc(item.id)}">Editar</button>
          <button class="btn btn--sm btn--danger" type="button" data-delete="${esc(item.id)}">Borrar</button>
        </div>
      </div>`;
  }

  function renderOverview() {
    const counts = Object.keys(TYPES).map((t) => `
      <button type="button" class="card-stat" data-goto="${t}">
        <span>${TYPES[t].icon} ${esc(TYPES[t].label)}</span>
        <b>${content.filter((i) => i.type === t).length}</b>
        <span style="font-size:16px">+ Gestionar</span>
      </button>`).join('');
    const recent = [...content].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);
    return `
      <div class="panel-head">
        <div><h1>HOLA, JUGADOR 1</h1><p>Esto es lo que hay publicado ahora mismo en el sitio.</p></div>
        <div class="toolbar" style="margin:0">
          <button class="btn btn--solid btn--sm" type="button" data-new="news">+ Noticia</button>
          <button class="btn btn--sm" type="button" data-new="app">+ Juego / app</button>
          <button class="btn btn--sm" type="button" data-new="image">+ Imagen</button>
        </div>
      </div>
      <div class="cards">${counts}</div>
      <div class="panel-head"><div><h1 style="font-size:14px">ÚLTIMOS CAMBIOS</h1></div></div>
      <div class="list">${recent.map(row).join('') || '<div class="empty">NADA PUBLICADO TODAVÍA</div>'}</div>`;
  }

  function renderList(type) {
    const t = TYPES[type];
    return `
      <div class="panel-head">
        <div><h1>${t.icon} ${esc(t.label.toUpperCase())}</h1><p>${esc(t.desc)}</p></div>
        <button class="btn btn--solid" type="button" data-new="${type}">+ Nuevo</button>
      </div>
      <div class="toolbar">
        <label class="field"><span class="sr-only">Buscar</span><input type="search" id="search" placeholder="Buscar…"></label>
      </div>
      <div class="list" id="list">${listRows(type, '')}</div>`;
  }

  function listRows(type, query) {
    const q = query.trim().toLowerCase();
    const items = content.filter((i) => i.type === type && (!q || `${i.title} ${i.summary}`.toLowerCase().includes(q)));
    if (!items.length) return `<div class="empty">${q ? 'SIN RESULTADOS' : 'AQUÍ NO HAY NADA TODAVÍA. ¡PULSA «+ NUEVO»!'}</div>`;
    return items.map(row).join('');
  }

  function bindSearch() {
    const input = $('#search');
    input.addEventListener('input', () => { $('#list').innerHTML = listRows(tab, input.value); });
  }

  $('#panel').addEventListener('click', (e) => {
    const goto = e.target.closest('[data-goto]');
    if (goto) return setTab(goto.dataset.goto);
    const nw = e.target.closest('[data-new]');
    if (nw) return openEditor(nw.dataset.new);
    const ed = e.target.closest('[data-edit]');
    if (ed) return openEditor(null, content.find((i) => i.id === ed.dataset.edit));
    const del = e.target.closest('[data-delete]');
    if (del) return confirmDelete(content.find((i) => i.id === del.dataset.delete));
  });

  /* ------------------------------------------------------------------ */
  /* Editor                                                              */
  /* ------------------------------------------------------------------ */

  function fieldHtml(type, name, item) {
    const labels = FIELD_LABELS[type];
    const v = (k) => esc(item[k] || '');
    switch (name) {
      case 'title':
        return `<label class="field"><span>${esc(labels.title)}</span><input name="title" maxlength="140" required value="${v('title')}" data-autofocus></label>`;
      case 'game': {
        const games = content.filter((i) => i.type === 'app');
        return `<label class="field"><span>Juego relacionado (pestañas de Noticias)</span><select name="game">
          <option value="">— General (sin juego) —</option>
          ${games.map((g) => `<option value="${esc(g.id)}"${g.id === item.game ? ' selected' : ''}>${esc(g.title)}</option>`).join('')}
        </select><small>La noticia aparecerá en la pestaña de ese juego en la página de Noticias.</small></label>`;
      }
      case 'summary':
        return `<label class="field"><span>${esc(labels.summary)}</span><input name="summary" maxlength="400" value="${v('summary')}"></label>`;
      case 'body':
        return `<label class="field"><span>${esc(labels.body)}</span><textarea name="body" maxlength="20000">${v('body')}</textarea>
          <small>Separa párrafos con una línea en blanco. Formato: **negrita**, *cursiva*, [texto](https://enlace.com)</small></label>`;
      case 'value':
        return `<label class="field"><span>Valor * (ej. 10000, 4.8, "Sí")</span><input name="value" maxlength="40" required value="${v('value')}"></label>`;
      case 'link':
        return `<label class="field"><span>${esc(labels.link)}</span><input name="link" type="url" maxlength="500" placeholder="https://" value="${v('link')}"></label>`;
      case 'platform':
        return `<label class="field"><span>Plataforma(s)</span><input name="platform" maxlength="80" placeholder="PC, Android, Switch…" value="${v('platform')}"></label>`;
      case 'status': {
        const opts = type === 'product' ? PRODUCT_STATUS : STATUS;
        return `<label class="field"><span>Estado</span><select name="status">
          ${['', ...opts].map((s) => `<option value="${esc(s)}"${s === (item.status || '') ? ' selected' : ''}>${s || '— Sin estado —'}</option>`).join('')}
          ${item.status && !opts.includes(item.status) ? `<option selected>${v('status')}</option>` : ''}
        </select></label>`;
      }
      case 'downloads':
        return `<label class="field"><span>Descargas en otras tiendas (opcional)</span><input name="downloads" inputmode="numeric" maxlength="12" placeholder="Ej. App Store, itch.io…" value="${v('downloads')}">
          <small>Las de Google Play se cuentan solas. Aquí solo lo que venga de otras tiendas.</small></label>`;
      case 'playPackage':
        return `<div class="field"><span>Paquete de Google Play (descargas automáticas)</span>
          <div style="display:flex;gap:8px"><input name="playPackage" maxlength="150" placeholder="com.thething.juego" value="${v('playPackage')}" spellcheck="false" style="flex:1">
          <button class="btn btn--sm" type="button" id="playCheck">Obtener</button></div>
          <small id="playResult">El identificador de la app en Google Play (está en la URL: play.google.com/store/apps/details?id=<b>com.ejemplo.app</b>).</small></div>`;
      case 'videoUrl':
        return `<div class="field"><span>Vídeo * (enlace de YouTube / Vimeo o archivo MP4)</span>
          <div style="display:flex;gap:8px"><input name="videoUrl" maxlength="500" placeholder="https://www.youtube.com/watch?v=…" value="${v('videoUrl')}" style="flex:1">
          <label class="btn btn--sm" style="cursor:pointer">Subir MP4<input type="file" accept="video/mp4,video/webm" id="videoFile" hidden></label></div>
          <div class="dropzone__bar" id="videoBar" hidden><span></span></div>
          <small>Recomendado: YouTube (no gasta espacio del hosting). Archivos hasta 100 MB.</small></div>`;
      case 'price':
        return `<label class="field"><span>Precio</span><input name="price" inputmode="decimal" maxlength="12" placeholder="24.99" value="${v('price')}"></label>`;
      case 'currency':
        return `<label class="field"><span>Moneda</span><select name="currency">${CURRENCIES.map((c) => `<option${(item.currency || 'USD') === c ? ' selected' : ''}>${c}</option>`).join('')}</select></label>`;
      case 'sizes':
        return `<label class="field"><span>Tallas / variantes (separadas por comas)</span><input name="sizes" maxlength="120" placeholder="S, M, L, XL" value="${v('sizes')}"></label>`;
      case 'appKey':
        return `<label class="field"><span>App Key de LevelPlay (privado)</span><input name="appKey" maxlength="64" placeholder="Ej. 1a2b3c4d5" value="${v('appKey')}" spellcheck="false">
          <small>Enlaza el juego con sus ganancias de anuncios. Está en LevelPlay → Apps (o en la pestaña Estadísticas).</small></label>`;
      case 'notify':
        return `<label class="check"><input type="checkbox" name="notify"${item.id ? '' : ' checked'}> ${item.id ? 'Avisar a los jugadores de este cambio' : 'Avisar a los jugadores registrados (campana y correo)'}</label>`;
      case 'featured':
        return `<label class="check"><input type="checkbox" name="featured"${item.featured ? ' checked' : ''}> Destacar en portada</label>`;
      case 'image':
        return `<div class="field"><span>${type === 'video' ? 'Portada del cassette (opcional · si no, se usa la miniatura de YouTube)' : `Imagen${type === 'image' ? ' *' : ''}`}</span>
          <div class="dropzone" id="dropzone">${dropzoneInner(item.image)}</div>
          <input name="image" type="hidden" value="${v('image')}">
          <label class="field"><small>…o pega la URL de una imagen</small><input name="imageUrl" type="url" placeholder="https://" value="${item.image && /^https?:/.test(item.image) ? v('image') : ''}"></label>
        </div>`;
      default:
        return '';
    }
  }

  function dropzoneInner(url) {
    if (url) {
      return `<img src="${esc(url)}" alt="Vista previa">
        <button class="btn btn--sm btn--danger dropzone__remove" type="button" data-remove-image>Quitar imagen</button>`;
    }
    return `<input type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/avif" aria-label="Subir imagen">
      <div>▣<br>ARRASTRA UNA IMAGEN AQUÍ<br><small style="font-size:16px">o haz clic para elegir · PNG, JPG, GIF, WEBP · máx. 8 MB</small></div>`;
  }

  function openEditor(type, item) {
    item = item || { type };
    type = item.type;
    const t = TYPES[type];
    const fields = t.fields.map((f) => fieldHtml(type, f, item));
    // Agrupa algunos campos en dos columnas
    const html = fields.join('')
      .replace(/(<label class="field"><span>Plataforma[\s\S]*?<\/label>)(<label class="field"><span>Estado[\s\S]*?<\/select><\/label>)/, '<div class="form__row">$1$2</div>')
      .replace(/(<label class="field"><span>Precio[\s\S]*?<\/label>)(<label class="field"><span>Moneda[\s\S]*?<\/select><\/label>)/, '<div class="form__row">$1$2</div>');
    editor.open(`
      <button class="icon-btn modal__close" type="button" data-close title="Cerrar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>
        <span class="sr-only">Cerrar</span>
      </button>
      <form class="editor form" id="editorForm" novalidate>
        <h2>${esc(item.id ? `EDITAR ${t.one.toUpperCase()}` : t.nuevo.toUpperCase())}</h2>
        ${html}
        <p class="form__error" id="editorError" role="alert"></p>
        <div class="form__actions">
          <button class="btn" type="button" data-close>Cancelar</button>
          <button class="btn btn--solid" type="submit">${item.id ? '▶ Guardar cambios' : '▶ Publicar'}</button>
        </div>
      </form>`);
    bindEditor(item);
  }

  function bindEditorExtras(form) {
    const check = form.querySelector('#playCheck');
    if (check) check.addEventListener('click', async () => {
      const pkg = form.elements.playPackage.value.trim();
      const out = form.querySelector('#playResult');
      if (!pkg) { out.textContent = '✖ Escribe primero el paquete'; return; }
      check.disabled = true;
      out.textContent = 'CONSULTANDO GOOGLE PLAY…';
      try {
        const r = await api(`api/stats.php?action=play_downloads&force=1&package=${encodeURIComponent(pkg)}`);
        out.innerHTML = `<span style="color:var(--acc)">✓ ${Number(r.total).toLocaleString('es')} descargas totales · +${Number(r.last30).toLocaleString('es')} en 30 días</span>`;
        beep('coin');
      } catch (ex) {
        out.innerHTML = `<span style="color:var(--red)">✖ ${esc(ex.message)}</span>`;
      }
      check.disabled = false;
    });
    const vf = form.querySelector('#videoFile');
    if (vf) vf.addEventListener('change', () => {
      const file = vf.files[0];
      if (!file) return;
      if (window.TT.demo) { toast('En la demo usa un enlace de YouTube (los vídeos no caben en el navegador)', 'error'); return; }
      const bar = form.querySelector('#videoBar');
      bar.hidden = false;
      const data = new FormData();
      data.append('file', file);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', 'api/upload.php');
      xhr.setRequestHeader('X-Requested-With', 'TheThing');
      xhr.upload.addEventListener('progress', (e) => { if (e.lengthComputable) bar.firstElementChild.style.width = `${(e.loaded / e.total) * 100}%`; });
      xhr.addEventListener('load', () => {
        let res = {};
        try { res = JSON.parse(xhr.responseText); } catch { /* ignore */ }
        bar.hidden = true;
        if (xhr.status < 300 && res.url) { form.elements.videoUrl.value = res.url; toast('Vídeo subido'); }
        else toast(res.error || `Error al subir (${xhr.status})`, 'error');
      });
      xhr.addEventListener('error', () => { bar.hidden = true; toast('Error de red al subir', 'error'); });
      xhr.send(data);
    });
  }

  function bindEditor(item) {
    const form = $('#editorForm');
    bindEditorExtras(form);
    const zone = $('#dropzone', form);

    function setImage(url) {
      form.image.value = url;
      if (zone) zone.innerHTML = dropzoneInner(url);
    }

    if (zone) {
      zone.addEventListener('change', (e) => {
        if (e.target.type === 'file' && e.target.files[0]) upload(e.target.files[0]);
      });
      zone.addEventListener('click', (e) => {
        if (e.target.closest('[data-remove-image]')) {
          setImage('');
          if (form.imageUrl) form.imageUrl.value = '';
        }
      });
      ['dragenter', 'dragover'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('drag'); }));
      ['dragleave', 'drop'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove('drag'); }));
      zone.addEventListener('drop', (e) => {
        const file = e.dataTransfer.files[0];
        if (file) upload(file);
      });
      form.imageUrl.addEventListener('change', () => {
        const url = form.imageUrl.value.trim();
        if (/^https?:\/\//i.test(url)) setImage(url);
      });
    }

    function upload(file) {
      if (!/^image\/(png|jpeg|gif|webp|avif)$/.test(file.type)) return toast('Formato no permitido', 'error');
      if (file.size > 8 * 1024 * 1024) return toast('La imagen supera 8 MB', 'error');
      zone.innerHTML = '<div>SUBIENDO…</div><div class="dropzone__bar"><span></span></div>';
      if (window.TT.demo) {     // modo demo: la imagen se guarda en el navegador
        window.TT.demo.imageToDataUrl(file).then((url) => { setImage(url); toast('Imagen cargada (demo)'); })
          .catch((ex) => { setImage(form.image.value); toast(ex.message, 'error'); });
        return;
      }
      const bar = zone.querySelector('.dropzone__bar span');
      const data = new FormData();
      data.append('file', file);
      // XMLHttpRequest para poder mostrar el progreso de subida
      const xhr = new XMLHttpRequest();
      xhr.open('POST', 'api/upload.php');
      xhr.setRequestHeader('X-Requested-With', 'TheThing');
      xhr.upload.addEventListener('progress', (e) => { if (e.lengthComputable) bar.style.width = `${(e.loaded / e.total) * 100}%`; });
      xhr.addEventListener('load', () => {
        let res = {};
        try { res = JSON.parse(xhr.responseText); } catch { /* ignore */ }
        if (xhr.status >= 200 && xhr.status < 300 && res.url) {
          setImage(res.url);
          toast('Imagen subida');
        } else {
          setImage(form.image.value);
          if (xhr.status === 401) handleAuthError({ status: 401 });
          else toast(res.error || `Error al subir (${xhr.status})`, 'error');
        }
      });
      xhr.addEventListener('error', () => { setImage(form.image.value); toast('Error de red al subir', 'error'); });
      xhr.send(data);
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('#editorError');
      err.textContent = '';
      const get = (n) => (form.elements[n] ? form.elements[n].value.trim() : '');
      const payload = {
        type: item.type,
        title: get('title'),
        summary: get('summary'),
        body: get('body'),
        image: get('image'),
        link: get('link'),
        platform: get('platform'),
        status: get('status'),
        value: get('value'),
        featured: Boolean(form.elements.featured && form.elements.featured.checked),
        downloads: get('downloads'),
        appKey: get('appKey'),
        playPackage: get('playPackage'),
        videoUrl: get('videoUrl'),
        price: get('price'),
        currency: get('currency'),
        sizes: get('sizes'),
        game: get('game'),
        notify: Boolean(form.elements.notify && form.elements.notify.checked),
      };
      if (!payload.title) return showErr('El título es obligatorio');
      if (item.type === 'data' && !payload.value) return showErr('El valor es obligatorio');
      if (item.type === 'image' && !payload.image) return showErr('Sube o enlaza una imagen');
      if (item.type === 'video' && !payload.videoUrl) return showErr('Pega un enlace de YouTube/Vimeo o sube un MP4');

      const btn = form.querySelector('[type=submit]');
      btn.disabled = true;
      try {
        const saved = item.id
          ? await api(`api/content.php?action=update&id=${encodeURIComponent(item.id)}`, { json: payload })
          : await api('api/content.php?action=create', { json: payload });
        const emailed = saved._emailed || 0;
        delete saved._emailed;
        const idx = content.findIndex((i) => i.id === saved.id);
        if (idx > -1) content[idx] = saved;
        else content.unshift(saved);
        editor.close();
        toast((item.id ? 'Cambios guardados' : '¡Publicado!') + (payload.notify ? ` · aviso enviado${emailed ? ` (+${emailed} correo${emailed === 1 ? '' : 's'})` : ''}` : ''));
        render();
      } catch (ex) {
        if (!handleAuthError(ex)) showErr(ex.message);
      } finally {
        btn.disabled = false;
      }

      function showErr(msg) {
        err.textContent = `✖ ${msg}`;
        beep('error');
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Borrar                                                              */
  /* ------------------------------------------------------------------ */

  function confirmDelete(item) {
    if (!item) return;
    confirmModal.open(`
      <div class="confirm">
        <h2>¿BORRAR?</h2>
        <p>"${esc(item.title)}" desaparecerá del sitio. Esta acción no se puede deshacer.</p>
        <div class="form__actions">
          <button class="btn" type="button" data-close data-autofocus>No</button>
          <button class="btn btn--solid" type="button" id="confirmYes">Sí, borrar</button>
        </div>
      </div>`);
    $('#confirmYes').addEventListener('click', async (e) => {
      e.currentTarget.disabled = true;
      try {
        await api(`api/content.php?action=delete&id=${encodeURIComponent(item.id)}`, { method: 'POST' });
        confirmModal.close();
        const rowEl = document.querySelector(`.row[data-id="${CSS.escape(item.id)}"]`);
        content = content.filter((i) => i.id !== item.id);
        toast('Eliminado');
        if (rowEl && !reduceMotion) {
          rowEl.classList.add('removing');
          setTimeout(render, 380);
        } else {
          render();
        }
      } catch (ex) {
        confirmModal.close();
        if (!handleAuthError(ex)) toast(ex.message, 'error');
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Cuenta                                                              */
  /* ------------------------------------------------------------------ */

  function renderAccount() {
    return `
      <div class="panel-head"><div><h1>☺ CUENTA</h1><p>Sesión iniciada como ${esc($('#userEmail').textContent)}</p></div></div>
      <div class="account">
        <form class="box form" id="pwForm" novalidate>
          <h2>CAMBIAR CONTRASEÑA</h2>
          <label class="field"><span>CONTRASEÑA ACTUAL</span><input type="password" name="current" autocomplete="current-password" required></label>
          <label class="field"><span>NUEVA CONTRASEÑA (mín. 8)</span><input type="password" name="next" autocomplete="new-password" minlength="8" required></label>
          <label class="field"><span>REPETIR NUEVA CONTRASEÑA</span><input type="password" name="confirm" autocomplete="new-password" minlength="8" required></label>
          <p class="form__error" id="pwError" role="alert"></p>
          <div class="form__actions"><button class="btn btn--solid" type="submit">▶ Actualizar</button></div>
        </form>
      </div>`;
  }

  function bindAccount() {
    $('#pwForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const err = $('#pwError');
      err.textContent = '';
      if (form.next.value.length < 8) { err.textContent = '✖ Mínimo 8 caracteres'; return beep('error'); }
      if (form.next.value !== form.confirm.value) { err.textContent = '✖ Las contraseñas no coinciden'; return beep('error'); }
      try {
        await api('api/auth.php?action=password', { json: { current: form.current.value, next: form.next.value } });
        form.reset();
        toast('Contraseña actualizada');
      } catch (ex) {
        if (!handleAuthError(ex)) { err.textContent = `✖ ${ex.message}`; beep('error'); }
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Estadísticas: descargas, ganancias (LevelPlay) y comunidad          */
  /* ------------------------------------------------------------------ */

  let statsDays = 30;
  const fmtInt = (n) => (n == null ? '—' : Number(n).toLocaleString('es'));
  const fmtUsd = (n) => (n == null ? '—' : `$${Number(n).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  const panelLoading = (panel, title) => {
    panel.innerHTML = `<div class="panel-head"><div><h1>${title}</h1><p class="blink">CARGANDO…</p></div></div>`;
  };

  let statsData = null;
  let statsForce = false;
  let statsView = 'all';      // 'all' (general), 'g:<idJuego>' o 'a:<appKey>'

  async function renderStats(panel) {
    panelLoading(panel, '% ESTADÍSTICAS');
    try {
      statsData = await api(`api/stats.php?action=overview&days=${statsDays}${statsForce ? '&force=1' : ''}`);
      statsForce = false;
    } catch (err) {
      if (!handleAuthError(err)) panel.innerHTML = `<div class="empty">✖ ${esc(err.message)}</div>`;
      return;
    }
    if (tab !== 'stats') return;
    drawStats(panel);
  }

  function drawStats(panel) {
    const d = statsData;
    const lp = d.levelplay;
    const gp = d.googleplay || { configured: false };
    const c = d.community;
    const kpi = (label, value, note = '') => `<div class="kpi"><span>${label}</span><b>${value}</b>${note ? `<small>${note}</small>` : ''}</div>`;

    // Vistas disponibles: general, cada juego y las apps de LevelPlay sin enlazar
    const views = [{ key: 'all', label: 'GENERAL' }]
      .concat(d.games.map((g) => ({ key: `g:${g.id}`, label: g.title })))
      .concat((lp.unlinkedApps || []).map((a) => ({ key: `a:${a.appKey}`, label: `${a.appName}${a.platform ? ` (${a.platform})` : ''}` })));
    if (!views.some((v) => v.key === statsView)) statsView = 'all';
    const game = statsView.startsWith('g:') ? d.games.find((g) => g.id === statsView.slice(2)) : null;
    const loneApp = statsView.startsWith('a:') ? (lp.unlinkedApps || []).find((a) => a.appKey === statsView.slice(2)) : null;
    const app = game ? game.levelplay : loneApp;
    const isAll = statsView === 'all';
    const t = isAll ? lp.totals : app;
    const daily = isAll ? lp.daily : (app && app.daily) || [];
    const title = isAll ? 'GENERAL · TODAS LAS APPS' : (game ? game.title : loneApp.appName).toUpperCase();

    let lpStatus;
    if (!lp.configured) lpStatus = '<div class="banner">LevelPlay no está conectado. Rellena tus claves abajo para ver las ganancias de los anuncios de Unity.</div>';
    else if (lp.error) lpStatus = `<div class="banner banner--error">✖ ${esc(lp.error)}${lp.fetchedAt ? ` · Mostrando datos guardados del ${esc(formatDate(lp.fetchedAt))}` : ''}</div>`;
    else if (lp.demoNote) lpStatus = `<div class="banner">⚠ ${esc(lp.demoNote)}</div>`;
    else lpStatus = `<div class="banner banner--ok">✓ LevelPlay conectado · ${esc(lp.range ? `${lp.range.start} → ${lp.range.end}` : '')} · actualizado ${esc(new Date(lp.fetchedAt).toLocaleString('es'))}</div>`;
    if (gp.error) lpStatus += `<div class="banner banner--error">✖ Google Play: ${esc(gp.error)}</div>`;

    let kpis;
    if (isAll) {
      kpis = [
        kpi('Ganancias', t ? fmtUsd(t.revenue) : '—', t ? `USD · ${d.days} días` : 'Conecta LevelPlay'),
        kpi('Impresiones', t ? fmtInt(t.impressions) : '—', t ? `eCPM ${fmtUsd(t.ecpm)}` : ''),
        kpi('Usuarios activos', t && t.avgDau ? fmtInt(t.avgDau) : '—', 'Promedio diario (DAU)'),
        kpi('Descargas', fmtInt(d.totalDownloads), gp.configured ? 'Google Play + otras' : 'Conecta Google Play'),
        kpi('Jugadores web', fmtInt(c.members), `+${c.newMembers7d} esta semana`),
        kpi('Valoración', c.avgRating ? `${c.avgRating.toFixed(1)} ★` : '—', `${c.reviews} reseña${c.reviews === 1 ? '' : 's'}`),
      ];
    } else {
      kpis = [
        kpi('Ganancias', app ? fmtUsd(app.revenue) : '—', app ? `USD · ${d.days} días` : 'Sin App Key de LevelPlay'),
        kpi('Impresiones', app ? fmtInt(app.impressions) : '—', app ? `eCPM ${fmtUsd(app.ecpm)}` : ''),
        kpi('Usuarios activos', app && app.avgDau ? fmtInt(app.avgDau) : '—', 'Promedio diario (DAU)'),
      ];
      if (game) {
        kpis.push(
          kpi('Descargas', fmtInt(game.downloads), game.downloadsPlay != null ? `Play: ${fmtInt(game.downloadsPlay)}${game.downloadsOther ? ` + otras: ${fmtInt(game.downloadsOther)}` : ''}` : (game.playError ? esc(game.playError).slice(0, 80) : 'Añade su paquete de Google Play')),
          kpi('Nuevas (30 días)', game.installs30 != null ? `+${fmtInt(game.installs30)}` : '—', 'Instalaciones Google Play'),
          kpi('Valoración', game.rating ? `${game.rating.toFixed(1)} ★` : '—', `${game.reviews} reseña${game.reviews === 1 ? '' : 's'} · ${game.votesBest} votos «mejor»`),
        );
      }
    }

    const totalRow = d.games.length > 1 ? `<tr class="total-row"><td>TOTAL</td><td>${fmtInt(d.totalDownloads)}</td>
      <td>${lp.totals ? fmtUsd(lp.totals.revenue) : '—'}</td><td>${lp.totals ? fmtInt(lp.totals.impressions) : '—'}</td>
      <td>${lp.totals ? fmtInt(lp.totals.avgDau) : '—'}</td><td>${c.avgRating ? `${c.avgRating.toFixed(1)} ★` : '—'}</td>
      <td>${d.games.reduce((n, g) => n + g.votesBest, 0)}</td><td>${d.games.reduce((n, g) => n + g.votesPlayed, 0)}</td></tr>` : '';

    panel.innerHTML = `
      <div class="panel-head">
        <div><h1>% ESTADÍSTICAS</h1><p>Descargas (Google Play), ganancias por anuncios (Unity LevelPlay) y comunidad.</p></div>
        <div class="toolbar" style="margin:0">
          <div class="seg" role="group" aria-label="Periodo">
            ${[7, 30, 90].map((n) => `<button type="button" data-days="${n}" aria-pressed="${n === statsDays}">${n} días</button>`).join('')}
          </div>
          <button class="btn btn--sm" type="button" id="statsRefresh">↻ Actualizar</button>
        </div>
      </div>
      ${lpStatus}
      <div class="app-tabs" role="tablist" aria-label="Aplicación">
        ${views.map((v) => `<button type="button" role="tab" data-view="${esc(v.key)}" aria-selected="${v.key === statsView}">${esc(v.label)}</button>`).join('')}
      </div>
      <p class="view-title">${esc(title)}</p>
      <div class="kpis">${kpis.join('')}</div>

      <div class="box chart-box">
        <h2>GANANCIAS POR DÍA (USD) · ${esc(title)}</h2>
        ${revenueChart(daily)}
        ${daily.length ? `<details class="chart-table"><summary>Ver como tabla</summary>
          <div class="table-wrap"><table class="data"><thead><tr><th>Fecha</th><th>Ganancias</th><th>Impresiones</th><th>Usuarios activos</th></tr></thead>
          <tbody>${daily.map((r) => `<tr><td>${esc(r.date)}</td><td>${fmtUsd(r.revenue)}</td><td>${fmtInt(r.impressions)}</td><td>${fmtInt(r.activeUsers)}</td></tr>`).join('')}</tbody></table></div>
        </details>` : ''}
      </div>

      <div class="box">
        <h2>TODAS LAS APLICACIONES</h2>
        ${d.games.length ? `<div class="table-wrap"><table class="data">
          <thead><tr><th>Juego</th><th>Descargas</th><th>Ganancias</th><th>Impresiones</th><th>DAU</th><th>Valoración</th><th>Votos mejor</th><th>Votos más jugado</th></tr></thead>
          <tbody>${d.games.map((g) => `<tr class="${statsView === `g:${g.id}` ? 'is-selected' : ''}">
            <td><button class="linkish" type="button" data-view="g:${esc(g.id)}">${esc(g.title)}</button>
              ${g.appKey ? '' : '<br><small class="muted">Sin App Key de LevelPlay</small>'}
              ${g.playPackage ? (g.playError ? `<br><small style="color:var(--red)">Play: ${esc(g.playError).slice(0, 90)}</small>` : '') : '<br><small class="muted">Sin paquete de Google Play</small>'}</td>
            <td>${fmtInt(g.downloads)}${g.installs30 != null ? `<br><small class="muted">+${fmtInt(g.installs30)} / 30 d</small>` : ''}</td>
            <td>${g.levelplay ? fmtUsd(g.levelplay.revenue) : '—'}</td>
            <td>${g.levelplay ? fmtInt(g.levelplay.impressions) : '—'}</td>
            <td>${g.levelplay ? fmtInt(g.levelplay.avgDau) : '—'}</td>
            <td>${g.rating ? `${g.rating.toFixed(1)} ★ (${g.reviews})` : '—'}</td>
            <td>${g.votesBest}</td><td>${g.votesPlayed}</td>
          </tr>`).join('')}${totalRow}</tbody></table></div>` : '<div class="empty">AÚN NO HAY JUEGOS PUBLICADOS</div>'}
        ${(lp.unlinkedApps || []).length ? `<p class="form__hint" style="margin-top:16px">Apps de LevelPlay sin enlazar (copia su App Key en el juego correspondiente):</p>
          <ul class="keys">${lp.unlinkedApps.map((a) => `<li><span>${esc(a.appName)} ${a.platform ? `(${esc(a.platform)})` : ''} · ${fmtUsd(a.revenue)}</span><code>${esc(a.appKey)}</code></li>`).join('')}</ul>` : ''}
      </div>

      <form class="box form" id="lpForm" novalidate>
        <h2>CONEXIÓN CON UNITY LEVELPLAY (GANANCIAS)</h2>
        <p class="form__hint">En <b>LevelPlay → (tu perfil) → My Account → API</b> copia la <b>Secret Key</b> y el <b>Refresh Token</b>. Se guardan en el servidor y nunca se muestran en la web.</p>
        <div class="form__row">
          <label class="field"><span>SECRET KEY</span><input name="secretKey" type="password" autocomplete="off" spellcheck="false" placeholder="${lp.configured ? '•••••••• (guardada)' : ''}"></label>
          <label class="field"><span>REFRESH TOKEN</span><input name="refreshToken" type="password" autocomplete="off" spellcheck="false" placeholder="${lp.configured ? '•••••••• (guardado)' : ''}"></label>
        </div>
        <p class="form__error" id="lpError" role="alert"></p>
        <div class="form__actions">
          ${lp.configured ? '<button class="btn btn--sm" type="button" id="lpDebug">Ver respuesta de LevelPlay</button><button class="btn btn--danger btn--sm" type="button" id="lpClear">Desconectar</button>' : ''}
          <button class="btn btn--solid" type="submit">▶ Guardar y probar</button>
        </div>
        <pre class="raw" id="lpRaw" hidden></pre>
      </form>

      <form class="box form" id="gpForm" novalidate>
        <h2>CONEXIÓN CON GOOGLE PLAY (DESCARGAS)</h2>
        <p class="form__hint">${gp.configured ? '<span style="color:var(--acc)">✓ Conectado.</span> ' : ''}Las descargas se leen de los informes oficiales de Play Console. Pasos (una sola vez):</p>
        <ol class="steps">
          <li>En <b>Google Cloud Console</b> crea un proyecto → <b>IAM → Cuentas de servicio</b> → crea una y en <b>Claves</b> descarga una clave <b>JSON</b>.</li>
          <li>En <b>Play Console → Usuarios y permisos</b> invita el correo de esa cuenta de servicio con el permiso <b>«Ver información de la app y descargar informes masivos»</b> (tarda hasta 24 h).</li>
          <li>En <b>Play Console → Descargar informes → Estadísticas</b> pulsa <b>«Copiar URI de Cloud Storage»</b> (empieza por <code>gs://pubsite_prod_rev_…</code>).</li>
          <li>Pega aquí ambos datos y, en cada juego, su <b>paquete de Google Play</b>.</li>
        </ol>
        <label class="field"><span>JSON DE LA CUENTA DE SERVICIO</span><textarea name="serviceAccount" spellcheck="false" style="min-height:110px;font-size:12px" placeholder="${gp.configured ? '•••• guardado (pega uno nuevo para reemplazarlo)' : '{ &quot;type&quot;: &quot;service_account&quot;, … }'}"></textarea></label>
        <label class="field"><span>URI DE CLOUD STORAGE (BUCKET)</span><input name="bucket" spellcheck="false" placeholder="${gp.configured ? '•••• guardado' : 'gs://pubsite_prod_rev_0123456789'}"></label>
        <p class="form__error" id="gpError" role="alert"></p>
        <div class="form__actions">
          ${gp.configured ? '<button class="btn btn--danger btn--sm" type="button" id="gpClear">Desconectar</button>' : ''}
          <button class="btn btn--solid" type="submit">▶ Guardar y probar</button>
        </div>
      </form>`;
    bindStats(panel);
  }

  /** Gráfica de barras (una serie): ganancias por día, con tooltip al pasar el ratón. */
  function revenueChart(daily) {
    if (!daily.length) return '<div class="empty">SIN DATOS DE LEVELPLAY PARA ESTE PERIODO</div>';
    const W = 820;
    const H = 260;
    const m = { t: 16, r: 8, b: 30, l: 56 };
    const pw = W - m.l - m.r;
    const ph = H - m.t - m.b;
    const max = Math.max(...daily.map((r) => r.revenue), 0.01);
    const step = niceStep(max / 4);
    const top = Math.ceil(max / step) * step;
    const y = (v) => m.t + ph - (v / top) * ph;
    const band = pw / daily.length;
    const bw = Math.max(2, Math.min(24, band - 2));
    const grid = [];
    for (let v = 0; v <= top + 1e-9; v += step) {
      grid.push(`<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" class="grid${v === 0 ? ' base' : ''}"/>
        <text x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end" class="axis">$${v.toLocaleString('es', { maximumFractionDigits: 2 })}</text>`);
    }
    const every = Math.ceil(daily.length / 8);
    const bars = daily.map((r, i) => {
      const x = m.l + i * band + (band - bw) / 2;
      const h = Math.max(0, y(0) - y(r.revenue));
      const rad = Math.min(4, bw / 2, h);
      const path = h > 0
        ? `M${x},${y(0)} V${y(0) - h + rad} Q${x},${y(0) - h} ${x + rad},${y(0) - h} H${x + bw - rad} Q${x + bw},${y(0) - h} ${x + bw},${y(0) - h + rad} V${y(0)} Z`
        : '';
      const label = i % every === 0 ? `<text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle" class="axis">${r.date.slice(8, 10)}/${r.date.slice(5, 7)}</text>` : '';
      return `<g class="bar" data-i="${i}" tabindex="0">
        <rect class="hit" x="${m.l + i * band}" y="${m.t}" width="${band}" height="${ph}"/>
        ${path ? `<path d="${path}"/>` : ''}${label}</g>`;
    }).join('');
    return `<div class="chart" data-daily='${esc(JSON.stringify(daily))}'>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Ganancias diarias en dólares, ${daily.length} días">${grid.join('')}${bars}</svg>
      <div class="chart__tip" hidden></div></div>`;
  }

  function niceStep(raw) {
    const pow = 10 ** Math.floor(Math.log10(raw));
    const n = raw / pow;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
  }

  function bindStats(panel) {
    panel.querySelectorAll('[data-days]').forEach((b) => b.addEventListener('click', () => {
      statsDays = Number(b.dataset.days);
      beep('select');
      renderStats(panel);
    }));
    panel.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
      statsView = b.dataset.view;
      beep('blip');
      drawStats(panel);
      const tabEl = panel.querySelector(`.app-tabs [data-view="${CSS.escape(statsView)}"]`);
      if (tabEl) tabEl.scrollIntoView({ block: 'nearest', inline: 'center' });
    }));

    const gpForm = $('#gpForm');
    gpForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('#gpError');
      err.textContent = '';
      const btn = gpForm.querySelector('[type=submit]');
      btn.disabled = true;
      btn.textContent = 'PROBANDO…';
      try {
        await api('api/stats.php?action=googleplay_save', { json: { serviceAccount: gpForm.serviceAccount.value.trim(), bucket: gpForm.bucket.value.trim() } });
        toast('¡Google Play conectado!');
        statsForce = true;
        renderStats(panel);
      } catch (ex) {
        if (!handleAuthError(ex)) { err.textContent = `✖ ${ex.message}`; beep('error'); }
        btn.disabled = false;
        btn.textContent = '▶ Guardar y probar';
      }
    });
    const gpClear = $('#gpClear');
    if (gpClear) gpClear.addEventListener('click', async () => {
      if (!window.confirm('¿Desconectar Google Play y borrar la cuenta de servicio guardada?')) return;
      try {
        await api('api/stats.php?action=googleplay_clear', { method: 'POST' });
        toast('Google Play desconectado');
        renderStats(panel);
      } catch (ex) { if (!handleAuthError(ex)) toast(ex.message, 'error'); }
    });
    const lpDebug = $('#lpDebug');
    if (lpDebug) lpDebug.addEventListener('click', async () => {
      const pre = $('#lpRaw');
      pre.hidden = false;
      pre.textContent = 'CONSULTANDO LEVELPLAY…';
      try {
        const r = await api('api/stats.php?action=levelplay_debug');
        pre.textContent = `Filas recibidas (últimos 3 días): ${r.rows}\n\n${JSON.stringify(r.sample, null, 2)}`;
      } catch (ex) {
        pre.textContent = `✖ ${ex.message}`;
      }
    });

    // Tooltip de la gráfica
    const chart = panel.querySelector('.chart');
    if (chart) {
      const daily = JSON.parse(chart.dataset.daily);
      const tip = chart.querySelector('.chart__tip');
      chart.querySelectorAll('.bar').forEach((g) => {
        const show = () => {
          const r = daily[Number(g.dataset.i)];
          chart.querySelectorAll('.bar.on').forEach((o) => o.classList.remove('on'));
          g.classList.add('on');
          tip.innerHTML = `<b>${esc(formatDate(`${r.date}T12:00:00Z`))}</b><span>${fmtUsd(r.revenue)}</span><small>${fmtInt(r.impressions)} impresiones</small>`;
          tip.hidden = false;
          const box = chart.getBoundingClientRect();
          const hit = g.querySelector('.hit').getBoundingClientRect();
          const left = Math.min(Math.max(hit.left - box.left + hit.width / 2, 70), box.width - 70);
          const bar = g.querySelector('path');
          const barTop = bar ? bar.getBoundingClientRect().top : hit.bottom;
          tip.style.left = `${left}px`;
          tip.style.top = `${Math.max(barTop - box.top, 0)}px`;
        };
        g.addEventListener('pointerenter', show);
        g.addEventListener('focus', show);
      });
      chart.addEventListener('pointerleave', () => {
        tip.hidden = true;
        chart.querySelectorAll('.bar.on').forEach((o) => o.classList.remove('on'));
      });
    }

    const refresh = $('#statsRefresh');
    refresh.addEventListener('click', async () => {
      refresh.disabled = true;
      if (statsData.levelplay.configured) {
        try {
          await api(`api/stats.php?action=levelplay_refresh&days=${statsDays}`, { method: 'POST' });
        } catch (err) {
          if (handleAuthError(err)) return;
          toast(err.message, 'error');
        }
      }
      statsForce = true;
      toast('Datos actualizados');
      renderStats(panel);
    });

    const form = $('#lpForm');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('#lpError');
      err.textContent = '';
      const btn = form.querySelector('[type=submit]');
      btn.disabled = true;
      btn.textContent = 'PROBANDO…';
      try {
        await api('api/stats.php?action=levelplay_save', { json: { secretKey: form.secretKey.value.trim(), refreshToken: form.refreshToken.value.trim() } });
        toast('¡LevelPlay conectado!');
        renderStats(panel);
      } catch (ex) {
        if (!handleAuthError(ex)) { err.textContent = `✖ ${ex.message}`; beep('error'); }
        btn.disabled = false;
        btn.textContent = '▶ Guardar y probar';
      }
    });
    const clear = $('#lpClear');
    if (clear) clear.addEventListener('click', async () => {
      if (!window.confirm('¿Desconectar LevelPlay y borrar las claves guardadas?')) return;
      try {
        await api('api/stats.php?action=levelplay_clear', { method: 'POST' });
        toast('LevelPlay desconectado');
        renderStats(panel);
      } catch (ex) { if (!handleAuthError(ex)) toast(ex.message, 'error'); }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Comunidad: jugadores, reseñas y avisos                              */
  /* ------------------------------------------------------------------ */

  async function renderCommunity(panel) {
    panelLoading(panel, '@ COMUNIDAD');
    let members;
    let comments;
    let notes;
    try {
      [members, comments, notes] = await Promise.all([
        api('api/stats.php?action=members'),
        api('api/stats.php?action=comments'),
        api('api/stats.php?action=notifications'),
      ]);
    } catch (err) {
      if (!handleAuthError(err)) panel.innerHTML = `<div class="empty">✖ ${esc(err.message)}</div>`;
      return;
    }
    if (tab !== 'community') return;
    const subscribed = members.filter((m) => m.emailNotify).length;
    const linkable = content.filter((i) => ['app', 'news', 'image'].includes(i.type));
    const starsTxt = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
    const reported = comments.filter((c) => c.reports && c.reports.length);

    panel.innerHTML = `
      <div class="panel-head"><div><h1>@ COMUNIDAD</h1><p>Jugadores registrados, sus reseñas y los avisos que les envías.</p></div></div>
      <div class="kpis">
        <div class="kpi"><span>Jugadores</span><b>${members.length}</b></div>
        <div class="kpi"><span>Avisos por correo</span><b>${subscribed}</b><small>suscritos</small></div>
        <div class="kpi"><span>Reseñas</span><b>${comments.filter((c) => c.rating).length}</b></div>
        <div class="kpi"><span>Comentarios</span><b>${comments.filter((c) => !c.rating).length}</b></div>
      </div>

      <form class="box form" id="notifyForm" novalidate>
        <h2>ENVIAR AVISO A LOS JUGADORES</h2>
        <p class="form__hint">Aparece en la campana de todos los jugadores y llega por correo a los ${subscribed} suscritos.</p>
        <label class="field"><span>TÍTULO *</span><input name="title" maxlength="140" required placeholder="¡Nueva actualización disponible!"></label>
        <label class="field"><span>MENSAJE</span><input name="text" maxlength="400" placeholder="Detalles del aviso"></label>
        <label class="field"><span>ENLAZAR CON (opcional)</span><select name="item"><option value="">— Nada —</option>
          ${linkable.map((i) => `<option value="${esc(i.id)}">${esc(TYPES[i.type].label)}: ${esc(i.title)}</option>`).join('')}</select></label>
        <p class="form__error" id="notifyError" role="alert"></p>
        <div class="form__actions"><button class="btn btn--solid" type="submit">▶ Enviar aviso</button></div>
      </form>

      ${reported.length ? `<div class="box notice">
        <h2>⚑ DENUNCIADOS (${reported.length})</h2>
        <p class="form__hint">Comentarios que los jugadores marcaron. Borra los que incumplan las normas o descarta la denuncia si están bien.</p>
        <div class="list">${reported.map((c) => `
          <div class="row row--text row--alert">
            <div style="min-width:0">
              <p class="row__title">${esc(c.name)} ${c.rating ? `<span class="stars-txt">${starsTxt(c.rating)}</span>` : ''}</p>
              <div class="row__meta"><span class="tag tag--status">${c.reports.length} denuncia${c.reports.length === 1 ? '' : 's'}</span><span>${esc([...new Set(c.reports)].join(', '))}</span><span class="tag">${esc(c.itemTitle)}</span></div>
              <p class="row__text">${esc(c.text)}</p>
            </div>
            <div class="row__actions"><button class="btn btn--sm" type="button" data-dismiss="${esc(c.id)}">Descartar</button><button class="btn btn--sm btn--danger" type="button" data-del-comment="${esc(c.id)}">Borrar</button></div>
          </div>`).join('')}</div>
      </div>` : ''}

      <div class="box">
        <h2>RESEÑAS Y COMENTARIOS</h2>
        <div class="list">${comments.map((c, i) => `
          <div class="row row--text" style="--d:${Math.min(i, 12) * 0.03}s" data-comment="${esc(c.id)}">
            <div style="min-width:0">
              <p class="row__title">${esc(c.name)} ${c.rating ? `<span class="stars-txt">${starsTxt(c.rating)}</span>` : ''}</p>
              <div class="row__meta"><span>${esc(formatDate(c.createdAt))}</span><span class="tag">${esc(c.itemTitle)}</span></div>
              <p class="row__text">${esc(c.text)}</p>
            </div>
            <div class="row__actions"><button class="btn btn--sm btn--danger" type="button" data-del-comment="${esc(c.id)}">Borrar</button></div>
          </div>`).join('') || '<div class="empty">TODAVÍA NO HAY RESEÑAS</div>'}</div>
      </div>

      <div class="box">
        <h2>JUGADORES REGISTRADOS</h2>
        ${members.length ? `<div class="table-wrap"><table class="data">
          <thead><tr><th>Jugador</th><th>Correo</th><th>Desde</th><th>Avisos por correo</th><th>Mensajes</th><th></th></tr></thead>
          <tbody>${members.map((m) => `<tr>
            <td>${esc(m.name)}</td><td>${esc(m.email)}</td><td>${esc(formatDate(m.createdAt))}</td>
            <td>${m.emailNotify ? '✓ Sí' : 'No'}</td><td>${m.comments}</td>
            <td><button class="btn btn--sm btn--danger" type="button" data-del-member="${esc(m.id)}" data-name="${esc(m.name)}">Borrar</button></td>
          </tr>`).join('')}</tbody></table></div>` : '<div class="empty">AÚN NO SE HA REGISTRADO NADIE</div>'}
      </div>

      <div class="box">
        <h2>AVISOS ENVIADOS</h2>
        <div class="list">${notes.slice(0, 15).map((n) => `
          <div class="row row--text"><div style="min-width:0"><p class="row__title">${esc(n.title)}</p>
          <div class="row__meta"><span>${esc(new Date(n.createdAt).toLocaleString('es'))}</span></div>${n.text ? `<p class="row__text">${esc(n.text)}</p>` : ''}</div></div>`).join('') || '<div class="empty">NINGÚN AVISO ENVIADO</div>'}</div>
      </div>`;

    $('#notifyForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const err = $('#notifyError');
      err.textContent = '';
      if (!form.elements.title.value.trim()) { err.textContent = '✖ Escribe un título'; return beep('error'); }
      try {
        const res = await api('api/stats.php?action=notify', { json: { title: form.elements.title.value, text: form.elements.text.value, item: form.elements.item.value } });
        toast(`Aviso enviado${res.emailed ? ` (+${res.emailed} correos)` : ''}`);
        renderCommunity(panel);
      } catch (ex) { if (!handleAuthError(ex)) { err.textContent = `✖ ${ex.message}`; beep('error'); } }
    });
    panel.querySelectorAll('[data-del-comment]').forEach((b) => b.addEventListener('click', async () => {
      if (!window.confirm('¿Borrar este mensaje?')) return;
      try {
        await api('api/community.php?action=delete_comment', { json: { id: b.dataset.delComment } });
        toast('Mensaje borrado');
        renderCommunity(panel);
      } catch (ex) { if (!handleAuthError(ex)) toast(ex.message, 'error'); }
    }));
    panel.querySelectorAll('[data-dismiss]').forEach((b) => b.addEventListener('click', async () => {
      try {
        await api('api/stats.php?action=dismiss_reports', { json: { id: b.dataset.dismiss } });
        toast('Denuncia descartada');
        renderCommunity(panel);
        refreshBadges();
      } catch (ex) { if (!handleAuthError(ex)) toast(ex.message, 'error'); }
    }));
    panel.querySelectorAll('[data-del-member]').forEach((b) => b.addEventListener('click', async () => {
      if (!window.confirm(`¿Borrar la cuenta de ${b.dataset.name}? También se borran sus reseñas y votos.`)) return;
      try {
        await api('api/stats.php?action=delete_member', { json: { id: b.dataset.delMember } });
        toast('Jugador eliminado');
        renderCommunity(panel);
      } catch (ex) { if (!handleAuthError(ex)) toast(ex.message, 'error'); }
    }));
  }

  /* ------------------------------------------------------------------ */
  /* Avisos pendientes en el menú (consultas abiertas y denuncias)       */
  /* ------------------------------------------------------------------ */

  async function refreshBadges() {
    try {
      const [sup, comments] = await Promise.all([
        api('api/support.php?action=list'),
        api('api/stats.php?action=comments'),
      ]);
      const open = sup.tickets.filter((t) => t.status === 'open').length;
      const reported = comments.filter((c) => c.reports && c.reports.length).length;
      const set = (el, n) => { el.hidden = !n; el.textContent = n > 9 ? '9+' : String(n); };
      set($('#supportBadge'), open);
      set($('#reportBadge'), reported);
    } catch { /* sin conexión */ }
  }

  /* ------------------------------------------------------------------ */
  /* Soporte                                                             */
  /* ------------------------------------------------------------------ */

  const ticketModal = createModal();
  const TICKET_STATUS = { open: ['ABIERTA', 'tag--status'], answered: ['RESPONDIDA', 'tag--live'], closed: ['CERRADA', ''] };
  let supportFilter = 'open';
  let tickets = [];

  async function renderSupport(panel) {
    panelLoading(panel, '? SOPORTE');
    try {
      tickets = (await api('api/support.php?action=list')).tickets;
    } catch (err) {
      if (!handleAuthError(err)) panel.innerHTML = `<div class="empty">✖ ${esc(err.message)}</div>`;
      return;
    }
    if (tab !== 'support') return;
    const count = (s) => tickets.filter((t) => t.status === s).length;
    const regrets = tickets.filter((t) => t.category === 'arrepentimiento' && t.status === 'open').length;
    const list = tickets.filter((t) => supportFilter === 'all' || t.status === supportFilter);
    panel.innerHTML = `
      <div class="panel-head"><div><h1>? SOPORTE</h1><p>Consultas que llegan desde la página de Soporte. Tu respuesta le llega por correo a la persona, con su código de seguimiento.</p></div></div>
      <div class="kpis">
        <div class="kpi"><span>Abiertas</span><b>${count('open')}</b><small>esperan respuesta</small></div>
        <div class="kpi"><span>Respondidas</span><b>${count('answered')}</b></div>
        <div class="kpi"><span>Cerradas</span><b>${count('closed')}</b></div>
        <div class="kpi"><span>Arrepentimientos</span><b>${regrets}</b><small>abiertos · responder cuanto antes</small></div>
      </div>
      <div class="app-tabs" role="tablist" aria-label="Filtrar consultas">
        ${[['open', 'Abiertas'], ['answered', 'Respondidas'], ['closed', 'Cerradas'], ['all', 'Todas']].map(([k, l]) => `<button type="button" role="tab" data-sf="${k}" aria-selected="${k === supportFilter}">${l}</button>`).join('')}
      </div>
      <div class="box">
        <div class="list">${list.map((t, i) => {
          const [label, cls] = TICKET_STATUS[t.status] || TICKET_STATUS.open;
          return `
          <div class="row row--text${t.category === 'arrepentimiento' ? ' row--alert' : ''}" style="--d:${Math.min(i, 12) * 0.03}s">
            <div style="min-width:0">
              <p class="row__title">${esc(t.subject)}</p>
              <div class="row__meta"><span class="tag ${cls}">${label}</span><span>${esc(t.code)}</span><span class="tag">${esc(t.categoryLabel)}</span>
                <span>${esc(t.name)} · ${esc(t.email)}</span><span>${esc(new Date(t.updatedAt).toLocaleString('es'))}</span></div>
              <p class="row__text">${esc(t.messages[t.messages.length - 1].text.slice(0, 220))}</p>
            </div>
            <div class="row__actions"><button class="btn btn--sm${t.status === 'open' ? ' btn--solid' : ''}" type="button" data-ticket="${esc(t.id)}">Abrir</button></div>
          </div>`;
        }).join('') || '<div class="empty">NO HAY CONSULTAS AQUÍ</div>'}</div>
      </div>`;
    panel.querySelectorAll('[data-sf]').forEach((b) => b.addEventListener('click', () => { supportFilter = b.dataset.sf; beep('blip'); renderSupport(panel); }));
    panel.querySelectorAll('[data-ticket]').forEach((b) => b.addEventListener('click', () => openTicket(tickets.find((t) => t.id === b.dataset.ticket))));
    refreshBadges();
  }

  function openTicket(t) {
    if (!t) return;
    const [label, cls] = TICKET_STATUS[t.status] || TICKET_STATUS.open;
    ticketModal.open(`
      <button class="icon-btn modal__close" type="button" data-close title="Cerrar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg><span class="sr-only">Cerrar</span>
      </button>
      <div class="editor form">
        <h2>${esc(t.code)} · ${esc(t.subject)}</h2>
        <div class="row__meta"><span class="tag ${cls}">${label}</span><span class="tag">${esc(t.categoryLabel)}</span><span>${esc(t.name)} · <a href="mailto:${esc(t.email)}">${esc(t.email)}</a></span></div>
        ${t.category === 'arrepentimiento' ? '<p class="form__hint" style="color:var(--amber)">Solicitud de arrepentimiento de compra: responde con los pasos de devolución y el reembolso dentro del plazo legal.</p>' : ''}
        <div class="thread">${t.messages.map((m) => `
          <div class="msg msg--${m.from}"><p class="msg__who">${m.from === 'staff' ? '■ EQUIPO' : '&gt; ' + esc(t.name.toUpperCase())} · ${esc(new Date(m.at).toLocaleString('es'))}</p><p class="msg__text">${esc(m.text)}</p></div>`).join('')}</div>
        <form id="answerForm" novalidate>
          <label class="field"><span>TU RESPUESTA (se envía por correo)</span><textarea name="message" maxlength="6000" required data-autofocus></textarea></label>
          <label class="check"><input type="checkbox" name="close"> Marcar como resuelta (cerrar consulta)</label>
          <p class="form__error" id="answerError" role="alert"></p>
          <div class="form__actions">
            <button class="btn btn--sm btn--danger" type="button" id="ticketDelete">Borrar</button>
            <button class="btn btn--sm" type="button" id="ticketToggle">${t.status === 'closed' ? 'Reabrir' : 'Cerrar sin responder'}</button>
            <button class="btn btn--solid" type="submit">▶ Enviar respuesta</button>
          </div>
        </form>
      </div>`);
    const panel = $('#panel');
    $('#answerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const msg = form.message.value.trim();
      if (msg.length < 2) { $('#answerError').textContent = '✖ Escribe la respuesta'; return beep('error'); }
      try {
        const res = await api('api/support.php?action=answer', { json: { id: t.id, message: msg, close: form.close.checked } });
        ticketModal.close();
        toast(res.mailed ? 'Respuesta enviada por correo' : 'Respuesta guardada (el correo no salió: revisa el remitente en config.php)');
        renderSupport(panel);
      } catch (ex) { if (!handleAuthError(ex)) { $('#answerError').textContent = `✖ ${ex.message}`; beep('error'); } }
    });
    $('#ticketToggle').addEventListener('click', async () => {
      try {
        await api('api/support.php?action=status', { json: { id: t.id, status: t.status === 'closed' ? 'open' : 'closed' } });
        ticketModal.close();
        toast(t.status === 'closed' ? 'Consulta reabierta' : 'Consulta cerrada');
        renderSupport(panel);
      } catch (ex) { if (!handleAuthError(ex)) toast(ex.message, 'error'); }
    });
    $('#ticketDelete').addEventListener('click', async () => {
      if (!window.confirm(`¿Borrar la consulta ${t.code}? No se puede deshacer.`)) return;
      try {
        await api('api/support.php?action=delete', { json: { id: t.id } });
        ticketModal.close();
        toast('Consulta borrada');
        renderSupport(panel);
      } catch (ex) { if (!handleAuthError(ex)) toast(ex.message, 'error'); }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Empresa y legal: datos que aparecen en las páginas legales y el pie */
  /* ------------------------------------------------------------------ */

  const COUNTRY_OPTIONS = [['', '— Elige —'], ['AR', 'Argentina'], ['MX', 'México'], ['ES', 'España'], ['CO', 'Colombia'], ['CL', 'Chile'], ['PE', 'Perú'], ['UY', 'Uruguay'], ['US', 'Estados Unidos'], ['OTRO', 'Otro']];

  async function renderSettings(panel) {
    panelLoading(panel, '§ EMPRESA Y LEGAL');
    let s;
    try { s = await api('api/settings.php'); } catch (err) {
      if (!handleAuthError(err)) panel.innerHTML = `<div class="empty">✖ ${esc(err.message)}</div>`;
      return;
    }
    if (tab !== 'settings') return;
    const v = (k) => esc(s[k] || '');
    const input = (k, label, ph = '', type = 'text') => `<label class="field"><span>${label}</span><input name="${k}" type="${type}" value="${v(k)}" placeholder="${esc(ph)}"></label>`;
    const missing = ['legalName', 'taxId', 'address', 'country', 'jurisdiction'].filter((k) => !s[k]);
    panel.innerHTML = `
      <div class="panel-head"><div><h1>§ EMPRESA Y LEGAL</h1><p>Estos datos rellenan solos los Términos, la Privacidad, el Aviso legal y el pie de página.</p></div></div>
      ${missing.length ? `<div class="box notice"><h2>⚠ FALTAN DATOS OBLIGATORIOS</h2><p>Mientras no los completes, las páginas legales muestran avisos en naranja como <span class="todo">[RAZÓN SOCIAL]</span>. Los textos legales son una plantilla: conviene que un abogado de tu país los revise.</p></div>` : ''}
      <form class="box form" id="settingsForm" novalidate>
        <h2>DATOS DEL TITULAR</h2>
        <p class="form__hint">Persona o empresa responsable de la web (la que figura ante Hacienda / AFIP / SAT).</p>
        <div class="form__row">${input('legalName', 'RAZÓN SOCIAL O NOMBRE COMPLETO *', 'THE THING Games S.A.S.')}${input('tradeName', 'NOMBRE COMERCIAL', 'THE THING')}</div>
        <div class="form__row">${input('taxId', 'IDENTIFICACIÓN FISCAL (CUIT / NIF / RFC…) *', '30-12345678-9')}
          <label class="field"><span>PAÍS *</span><select name="country">${COUNTRY_OPTIONS.map(([k, l]) => `<option value="${k}"${(s.country || '') === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label></div>
        ${input('address', 'DOMICILIO *', 'Calle 123, Ciudad, Provincia, CP')}
        <div class="form__row">${input('jurisdiction', 'TRIBUNALES COMPETENTES *', 'Ciudad Autónoma de Buenos Aires, Argentina')}
          <label class="field"><span>EDAD MÍNIMA PARA CREAR CUENTA</span><select name="minAge">${['13', '14', '16', '18'].map((a) => `<option${(s.minAge || '13') === a ? ' selected' : ''}>${a}</option>`).join('')}</select></label></div>
        ${input('registry', 'DATOS REGISTRALES (opcional)', 'Inscripción en el Registro Mercantil / IGJ…')}
        <h2 style="margin-top:24px">CORREOS PÚBLICOS</h2>
        <div class="form__row">${input('email', 'CONTACTO GENERAL', 'contacto@thethinggame.com', 'email')}${input('supportEmail', 'SOPORTE', 'soporte@thethinggame.com', 'email')}</div>
        ${input('privacyEmail', 'PRIVACIDAD (si es distinto)', 'privacidad@thethinggame.com', 'email')}
        <p class="form__hint" style="margin-top:18px">Las redes sociales se configuran en la pestaña <button type="button" class="linkish" data-goto="social">◎ Redes sociales</button>.</p>
        <p class="form__error" id="settingsError" role="alert"></p>
        <div class="form__actions"><a class="btn" href="aviso-legal.html" target="_blank" rel="noopener">Ver aviso legal ↗</a><button class="btn btn--solid" type="submit">▶ Guardar</button></div>
      </form>`;
    panel.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.goto)));
    $('#settingsForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const data = Object.fromEntries([...form.elements].filter((el) => el.name).map((el) => [el.name, el.value.trim()]));
      try {
        await api('api/settings.php?action=save', { json: data });
        toast('Datos guardados · ya aparecen en las páginas legales');
        renderSettings(panel);
      } catch (ex) { if (!handleAuthError(ex)) { $('#settingsError').textContent = `✖ ${ex.message}`; beep('error'); } }
    });
  }


  /* ------------------------------------------------------------------ */
  /* Redes sociales: botones del pie, la portada y "Únete"              */
  /* ------------------------------------------------------------------ */

  const SOCIAL_PATTERNS = { youtube: 'https://www.youtube.com/@%s', tiktok: 'https://www.tiktok.com/@%s', instagram: 'https://www.instagram.com/%s', x: 'https://x.com/%s',
    discord: 'https://discord.gg/%s', facebook: 'https://www.facebook.com/%s', twitch: 'https://www.twitch.tv/%s', googleplay: 'https://play.google.com/store/apps/developer?id=%s',
    steam: 'https://store.steampowered.com/developer/%s', itchio: 'https://%s.itch.io' };
  /** Igual que social_url() del servidor: acepta @usuario, usuario o el enlace. */
  function socialUrl(k, v) {
    v = String(v || '').trim();
    if (!v) return '';
    if (/^https?:\/\//i.test(v) || (v.includes('/') && v[0] !== '@')) return /^https?:\/\//i.test(v) ? v.replace(/^http:/i, 'https:') : `https://${v}`;
    const h = v.replace(/^@/, '').replace(/[^\w.-]/g, '');
    return h ? SOCIAL_PATTERNS[k].replace('%s', encodeURIComponent(h)) : '';
  }

  async function renderSocial(panel) {
    panelLoading(panel, '◎ REDES SOCIALES');
    let s;
    try { s = await api('api/settings.php'); } catch (err) {
      if (!handleAuthError(err)) panel.innerHTML = `<div class="empty">✖ ${esc(err.message)}</div>`;
      return;
    }
    if (tab !== 'social') return;
    const nets = window.TT.SOCIALS;
    panel.innerHTML = `
      <div class="panel-head"><div><h1>◎ REDES SOCIALES</h1><p>Los botones aparecen en la portada, en el bloque «Únete» y en el pie de todas las páginas. Deja vacía la que no uses.</p></div></div>
      <div class="box social-preview"><h2>VISTA PREVIA</h2><div class="socials" id="socialPreview"></div></div>
      <form class="box form" id="socialForm" novalidate>
        <p class="form__hint">Puedes pegar el enlace completo (https://…) o escribir solo tu <b>@usuario</b>: el enlace se arma solo.</p>
        <div class="social-list">
          ${nets.map((n) => `
            <label class="social-row" style="--brand:${n.color}">
              <span class="social-row__icon">${n.icon}</span>
              <span class="social-row__main">
                <span class="social-row__name">${esc(n.name)}</span>
                <input name="${n.key}" value="${esc(s[n.key] || '')}" placeholder="${esc(n.hint)}" autocomplete="off" spellcheck="false">
                <small class="social-row__out" data-out="${n.key}"></small>
              </span>
            </label>`).join('')}
        </div>
        <p class="form__error" id="socialError" role="alert"></p>
        <div class="form__actions"><a class="btn" href="index.html" target="_blank" rel="noopener">Ver la web ↗</a><button class="btn btn--solid" type="submit">▶ Guardar redes</button></div>
      </form>`;
    const form = $('#socialForm');
    const update = () => {
      const live = [];
      nets.forEach((n) => {
        const url = socialUrl(n.key, form.elements[n.key].value);
        const out = form.querySelector(`[data-out="${n.key}"]`);
        out.innerHTML = url ? `→ <a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)} ↗</a>` : (form.elements[n.key].value.trim() ? '✖ No se entiende este enlace' : 'Sin configurar (no se muestra)');
        if (url) live.push(`<a class="social" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="${esc(n.name)}" style="--brand:${n.color}">${n.icon}</a>`);
      });
      $('#socialPreview').innerHTML = live.join('') || '<span class="form__hint">Todavía no hay ninguna red: escribe al menos una abajo.</span>';
    };
    form.addEventListener('input', update);
    update();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(nets.map((n) => [n.key, form.elements[n.key].value.trim()]));
      try {
        await api('api/settings.php?action=save', { json: data });
        toast('Redes guardadas · ya funcionan en la web');
        beep('coin');
        renderSocial(panel);
      } catch (ex) { if (!handleAuthError(ex)) { $('#socialError').textContent = `✖ ${ex.message}`; beep('error'); } }
    });
  }

  boot();
})();
