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
      fields: ['title', 'summary', 'body', 'image', 'platform', 'status', 'link', 'featured'],
    },
    news: {
      label: 'Noticias', one: 'noticia', nuevo: 'Nueva noticia', icon: '✉',
      desc: 'Anuncios, diarios de desarrollo y novedades del estudio.',
      fields: ['title', 'summary', 'body', 'image', 'link', 'featured'],
    },
    data: {
      label: 'Datos', one: 'dato', nuevo: 'Nuevo dato', icon: '#',
      desc: 'Cifras para el marcador "High scores" de la portada. Los números se animan solos.',
      fields: ['title', 'value', 'summary'],
    },
    image: {
      label: 'Galería', one: 'imagen', nuevo: 'Nueva imagen', icon: '▣',
      desc: 'Capturas, arte conceptual y fotos. Se muestran como polaroids en la portada.',
      fields: ['image', 'title', 'summary'],
    },
  };

  const FIELD_LABELS = {
    app: { title: 'Nombre del juego / app *', summary: 'Descripción corta', body: 'Descripción completa', link: 'Enlace de descarga o tienda' },
    news: { title: 'Titular *', summary: 'Entradilla (resumen)', body: 'Cuerpo de la noticia', link: 'Enlace relacionado' },
    data: { title: 'Etiqueta * (ej. "Jugadores")', summary: 'Nota pequeña' },
    image: { title: 'Título *', summary: 'Descripción' },
  };

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
        <p class="form__hint">No se pudo contactar con <code>api/auth.php</code>. Este panel necesita un servidor con PHP (por ejemplo, tu hosting de Hostinger).</p>
        <p class="form__error">${esc(err.message)}</p><a class="btn" href="index.html">◀ Volver</a></div>`;
      return;
    }
    $('#loading').hidden = true;
    if (status.user) return showDash(status.user);
    showLogin(status);
  }

  function showLogin(status) {
    $('#dashScreen').hidden = true;
    $('#loginScreen').hidden = false;
    const card = $('#loginCard');
    card.classList.remove('granted');
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
      granted(res.user);
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
      granted(res.user);
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
    setTab(TYPES[fromHash] || fromHash === 'account' ? fromHash : 'overview');
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
    else if (tab === 'account') panel.innerHTML = renderAccount();
    else panel.innerHTML = renderList(tab);
    if (tab === 'account') bindAccount();
    if (TYPES[tab]) bindSearch();
  }

  function thumb(item) {
    if (item.type === 'data') return `<div class="row__thumb">${esc(String(item.value || '?').slice(0, 5))}</div>`;
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
      case 'status':
        return `<label class="field"><span>Estado</span><select name="status">
          ${['', ...STATUS].map((s) => `<option value="${esc(s)}"${s === (item.status || '') ? ' selected' : ''}>${s || '— Sin estado —'}</option>`).join('')}
          ${item.status && !STATUS.includes(item.status) ? `<option selected>${v('status')}</option>` : ''}
        </select></label>`;
      case 'featured':
        return `<label class="check"><input type="checkbox" name="featured"${item.featured ? ' checked' : ''}> Destacar en portada</label>`;
      case 'image':
        return `<div class="field"><span>Imagen${type === 'image' ? ' *' : ''}</span>
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
      .replace(/(<label class="field"><span>Plataforma[\s\S]*?<\/label>)(<label class="field"><span>Estado[\s\S]*?<\/select><\/label>)/, '<div class="form__row">$1$2</div>');
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

  function bindEditor(item) {
    const form = $('#editorForm');
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
      };
      if (!payload.title) return showErr('El título es obligatorio');
      if (item.type === 'data' && !payload.value) return showErr('El valor es obligatorio');
      if (item.type === 'image' && !payload.image) return showErr('Sube o enlaza una imagen');

      const btn = form.querySelector('[type=submit]');
      btn.disabled = true;
      try {
        const saved = item.id
          ? await api(`api/content.php?action=update&id=${encodeURIComponent(item.id)}`, { json: payload })
          : await api('api/content.php?action=create', { json: payload });
        const idx = content.findIndex((i) => i.id === saved.id);
        if (idx > -1) content[idx] = saved;
        else content.unshift(saved);
        editor.close();
        toast(item.id ? 'Cambios guardados' : '¡Publicado!');
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

  boot();
})();
