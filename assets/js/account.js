/*
 * THE THING — cuentas de jugador en todas las páginas:
 * registro e inicio de sesión (con el minijuego anti-robots), campana de
 * avisos, ajustes de la cuenta, descarga de datos y borrado de cuenta.
 */
(function () {
  'use strict';

  const { api, escapeHtml: esc, formatDate, beep, createModal, toast } = window.TT;
  const $ = (sel, root = document) => root.querySelector(sel);
  const site = window.TT.site;

  const authModal = createModal('modal--small');
  const drawer = createModal('modal--drawer');
  const accountModal = createModal('modal--small');
  let me = null;
  let online = true;
  let content = [];
  let pendingAction = null;
  let lastUnread = 0;
  let captcha = null;
  const listeners = [];
  const closeBtn = `<button class="icon-btn modal__close" type="button" data-close title="Cerrar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>
      <span class="sr-only">Cerrar</span></button>`;

  /** Si la sesión caducó, pide entrar de nuevo. */
  function handleError(err) {
    if (err.status === 401) {
      setMember(null);
      openAuth('login', 'Tu sesión terminó. Vuelve a entrar.');
      return true;
    }
    toast(err.message, 'error');
    return true;
  }

  function setMember(member, unread = 0) {
    me = member;
    const btn = $('#acctBtn');
    const bell = $('#bellBtn');
    btn.classList.toggle('is-staff', !!(me && me.staff));
    if (me) {
      btn.innerHTML = `<span class="initial" aria-hidden="true">${me.staff ? '★' : esc(me.name.charAt(0).toUpperCase())}</span><span class="acct-label">${esc(me.name)}</span>`;
      btn.title = me.staff ? 'Cuenta del staff' : 'Mi cuenta';
      bell.hidden = false;
    } else {
      btn.innerHTML = `${site.icons.user}<span class="acct-label">Entrar</span>`;
      btn.title = 'Entrar o registrarse';
      bell.hidden = true;
      stopPolling();
    }
    setUnread(unread);
    listeners.forEach((fn) => fn(me));
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

  /* ------------------------------------------------------------------ */
  /* Registro e inicio de sesión                                         */
  /* ------------------------------------------------------------------ */

  function openAuth(mode = 'login', reason = '', after = null) {
    if (!online) return toast('Las cuentas necesitan el servidor PHP (súbelo a Hostinger)', 'error');
    pendingAction = after;
    authModal.open(`${closeBtn}<div class="auth" id="authBox"></div>`, () => { if (captcha) captcha.destroy(); });
    renderAuth(mode, reason);
  }

  function renderAuth(mode, reason) {
    const box = $('#authBox');
    const isReg = mode === 'register';
    if (captcha) captcha.destroy();
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
          <label class="tt-check"><input type="checkbox" name="accept" required> <span>He leído y acepto los <a href="terminos.html" target="_blank">Términos y condiciones</a> y la <a href="privacidad.html" target="_blank">Política de privacidad</a>. Tengo al menos <span data-site="minAge">13</span> años (si soy menor de edad, cuento con permiso de mi madre, padre o tutor).</span></label>
          <label class="tt-check"><input type="checkbox" name="emailNotify"> <span>Quiero recibir por correo los avisos de juegos nuevos y noticias (opcional; puedes darte de baja cuando quieras).</span></label>
          <div class="hp" aria-hidden="true"><label>Web <input name="website" tabindex="-1" autocomplete="off"></label></div>` : ''}
        <div class="tt-captcha" id="authCaptcha"></div>
        <p class="tt-error" role="alert"></p>
        <button class="btn btn--solid" type="submit" style="justify-content:center">▶ ${isReg ? 'Crear cuenta' : 'Entrar'}</button>
        ${isReg ? '' : '<p class="auth__sub" style="margin:0">¿Olvidaste tu contraseña? <a href="soporte.html?tipo=cuenta#contacto">Pide ayuda a soporte</a></p>'}
      </form>`;
    site.ready.then((d) => box.querySelectorAll('[data-site="minAge"]').forEach((el) => { el.textContent = d.settings.minAge || '13'; }));
    box.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { beep('blip'); renderAuth(b.dataset.mode, reason); }));
    const form = $('#authForm');
    captcha = window.TT.captcha.mount($('#authCaptcha'), { onSolved: () => { form.querySelector('.tt-error').textContent = ''; } });
    setTimeout(() => { const f = form.querySelector('[data-autofocus]'); if (f) f.focus(); }, 60);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = form.querySelector('.tt-error');
      err.textContent = '';
      const btn = form.querySelector('[type=submit]');
      const data = { email: form.email.value.trim(), password: form.password.value };
      if (isReg) {
        data.name = form.elements.name.value.trim();
        data.emailNotify = form.emailNotify.checked;
        data.accept = form.accept.checked;
        data.website = form.website.value;
        if (data.name.length < 3) { err.textContent = '✖ El nombre debe tener al menos 3 caracteres'; return beep('error'); }
        if (data.password.length < 8) { err.textContent = '✖ La contraseña necesita 8 caracteres o más'; return beep('error'); }
        if (!data.accept) { err.textContent = '✖ Tienes que aceptar los términos y la privacidad'; return beep('error'); }
      }
      if (!data.email) { err.textContent = '✖ Escribe tu correo'; return beep('error'); }
      data.captcha = captcha.token();
      if (!data.captcha) {
        err.textContent = '✖ Primero supera el minijuego anti-robots';
        $('#authCaptcha').classList.remove('nudge');
        void $('#authCaptcha').offsetWidth;
        $('#authCaptcha').classList.add('nudge');
        return beep('error');
      }
      btn.disabled = true;
      try {
        const res = await api(`api/members.php?action=${isReg ? 'register' : 'login'}`, { json: data });
        if (res.staffLogin) return staffLogin(data, btn, err);
        setMember(res.member, res.unread);
        authModal.close();
        beep('coin');
        toast(isReg ? `¡BIENVENIDO, ${res.member.name.toUpperCase()}!` : `¡HOLA DE NUEVO, ${res.member.name.toUpperCase()}!`);
        startPolling();
        if (isReg) setTimeout(offerBrowserNotifications, 900);
        const action = pendingAction;
        pendingAction = null;
        if (action) action();
      } catch (ex) {
        err.textContent = `✖ ${ex.message}`;
        beep('error');
        btn.disabled = false;
        captcha.reset();                       // la ficha ya se gastó
        authModal.panel.animate([{ transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'none' }], { duration: 260 });
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Acceso del staff desde la web: contraseña del panel + PIN           */
  /* ------------------------------------------------------------------ */

  async function staffLogin(data, btn, err) {
    try {
      const res = await api('api/auth.php?action=login', { json: { email: data.email, password: data.password } });
      if (res.user) return finishStaff();
      renderPinStep(res);
    } catch (ex) {
      err.textContent = `✖ ${ex.message === 'Credenciales incorrectas' ? 'Correo o contraseña incorrectos' : ex.message}`;
      beep('error');
      btn.disabled = false;
      captcha.reset();
    }
  }

  function renderPinStep(info) {
    const box = $('#authBox');
    if (captcha) captcha.destroy();
    box.innerHTML = `
      <img class="auth__logo" src="assets/img/logo-small.webp" alt="" width="90" height="98">
      <h2>ACCESO STAFF</h2>
      <p class="auth__sub">${info.mailSent === false ? 'No pudimos enviar el correo: el PIN está en <b>data/ultimo-pin.php</b> del servidor.' : `Te enviamos un PIN de 6 dígitos a <b>${esc(info.sentTo || 'tu correo')}</b>. Caduca en ${info.minutes || 10} minutos.`}
        ${info.demoPin ? `<br><span style="color:var(--acc)">MODO DEMO · PIN: ${esc(info.demoPin)}</span>` : ''}</p>
      <form class="tt-form" id="pinStep" novalidate>
        <label class="tt-field"><span>PIN</span><input name="pin" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" required data-autofocus class="pin-input" placeholder="••••••"></label>
        <p class="tt-error" role="alert"></p>
        <button class="btn btn--solid" type="submit" style="justify-content:center">▶ Verificar</button>
        <p class="auth__sub" style="margin:0"><button type="button" class="linkish" id="pinResend">Reenviar PIN</button></p>
      </form>`;
    const form = $('#pinStep');
    setTimeout(() => form.pin.focus(), 60);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = form.querySelector('.tt-error');
      const pin = form.pin.value.replace(/\D/g, '');
      if (pin.length !== 6) { err.textContent = '✖ El PIN tiene 6 números'; return beep('error'); }
      try {
        await api('api/auth.php?action=verify', { json: { pin } });
        finishStaff();
      } catch (ex) {
        err.textContent = `✖ ${ex.message}`;
        beep('error');
        if (ex.status === 401) setTimeout(() => renderAuth('login', 'Vuelve a entrar con tu contraseña.'), 1400);
      }
    });
    $('#pinResend').addEventListener('click', async () => {
      try {
        const r = await api('api/auth.php?action=resend', { method: 'POST' });
        toast('PIN REENVIADO');
        if (r.demoPin) renderPinStep(r);
      } catch (ex) { toast(ex.message, 'error'); }
    });
  }

  async function finishStaff() {
    const r = await api('api/members.php?action=me');
    setMember(r.member, r.unread);
    authModal.close();
    beep('coin');
    toast('¡HOLA, STAFF! YA ESTÁS DENTRO DE LA WEB Y DEL PANEL');
    startPolling();
    const action = pendingAction;
    pendingAction = null;
    if (action) action();
  }

  /* ------------------------------------------------------------------ */
  /* Avisos                                                              */
  /* ------------------------------------------------------------------ */

  const browserNotifySupported = () => 'Notification' in window && window.isSecureContext;
  function offerBrowserNotifications() {
    if (!browserNotifySupported() || Notification.permission !== 'default') return;
    toast('Activa los avisos del navegador desde tu cuenta para no perderte nada');
  }

  /** Abre un elemento: en la página actual si se puede, si no, va a su página. */
  function goToItem(id) {
    const item = content.find((c) => c.id === id);
    if (!item) return;
    if (window.TT.openItem && window.TT.openItem(id) !== false) return;
    window.location.href = site.itemUrl(item);
  }

  async function openDrawer() {
    drawer.open(`${closeBtn}<div class="drawer"><h2>AVISOS</h2><p class="drawer__sub">Novedades, noticias y juegos nuevos.</p><div class="notif-list" id="notifList"><p class="term" style="color:var(--muted)">CARGANDO…</p></div></div>`);
    try {
      const res = await api('api/members.php?action=notifications');
      const list = $('#notifList');
      if (!list) return;
      list.innerHTML = res.items.map((n, i) => {
        const unread = n.createdAt > (res.lastSeen || '');
        const kind = { news: 'Noticia', app: 'Juego', image: 'Galería', data: 'Dato', video: 'Vídeo', product: 'Tienda', aviso: 'Aviso' }[n.kind] || 'Aviso';
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
        setTimeout(() => goToItem(b.dataset.notifItem), 320);
      }));
      if (res.unread) {
        await api('api/members.php?action=seen', { method: 'POST' });
        setUnread(0);
        rememberNotified(res.items[0] && res.items[0].createdAt);
      }
    } catch (err) {
      drawer.close();
      handleError(err);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Mi cuenta: preferencias, mis datos y borrar cuenta                   */
  /* ------------------------------------------------------------------ */

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
        ${me.staff ? '<p class="staff-tag staff-tag--big">★ CUENTA DEL STAFF</p>' : ''}
        <p class="auth__sub">${esc(me.email)} · ${me.staff ? 'tus reseñas y comentarios salen con la insignia STAFF' : `jugador desde ${formatDate(me.createdAt)}`}</p>
        <div class="tt-form">
          <label class="tt-check"><input type="checkbox" id="prefEmail"${me.emailNotify ? ' checked' : ''}> <span>Recibir avisos de novedades por correo</span></label>
          ${notifState}
          ${me.staff ? '<a class="btn btn--solid" href="admin.html" style="justify-content:center">▶ Abrir panel del staff</a>' : ''}
          <button class="btn" type="button" id="openNotifs" style="justify-content:center">Ver mis avisos</button>
          <button class="btn btn--danger" type="button" id="logoutMember" style="justify-content:center">Cerrar sesión</button>
          <details class="acct-data"${me.staff ? ' hidden' : ''}>
            <summary>PRIVACIDAD Y MIS DATOS</summary>
            <p>Puedes descargar una copia de todo lo que guardamos sobre ti o borrar tu cuenta para siempre (también se borran tus reseñas, comentarios y votos). <a href="privacidad.html">Política de privacidad</a></p>
            <button class="btn btn--sm" type="button" id="exportData">⬇ Descargar mis datos</button>
            <form class="tt-form acct-delete" id="deleteForm" novalidate>
              <label class="tt-field"><span>PARA BORRAR TU CUENTA ESCRIBE TU CONTRASEÑA</span><input name="password" type="password" autocomplete="current-password" required></label>
              <p class="tt-error" role="alert"></p>
              <button class="btn btn--sm btn--danger" type="submit">✖ Borrar mi cuenta</button>
            </form>
          </details>
        </div>
      </div>`);
    $('#prefEmail').addEventListener('change', async (e) => {
      try {
        const res = await api('api/members.php?action=prefs', { json: { emailNotify: e.target.checked } });
        me = res.member;
        toast(me.emailNotify ? 'Recibirás los avisos por correo' : 'Ya no recibirás correos');
      } catch (err) { e.target.checked = !e.target.checked; handleError(err); }
    });
    const enable = $('#enableNotif');
    if (enable) enable.addEventListener('click', async () => {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        new Notification('THE THING', { body: '¡Avisos activados! Te avisaremos de las novedades.', icon: 'assets/img/apple-touch-icon.png' });
        toast('Avisos del navegador activados');
      }
      accountModal.close();
    });
    $('#openNotifs').addEventListener('click', () => { accountModal.close(); setTimeout(openDrawer, 320); });
    $('#logoutMember').addEventListener('click', async () => {
      const wasStaff = !!me.staff;
      try { await api('api/members.php?action=logout', { method: 'POST' }); } catch { /* ignore */ }
      accountModal.close();
      setMember(null);
      toast(wasStaff ? 'SESIÓN DEL STAFF CERRADA (WEB Y PANEL)' : 'SESIÓN CERRADA. ¡HASTA PRONTO!');
    });
    $('#exportData').addEventListener('click', async () => {
      try {
        const data = await api('api/members.php?action=export');
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'mis-datos-thething.json';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        toast('DATOS DESCARGADOS');
      } catch (err) { handleError(err); }
    });
    $('#deleteForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const err = form.querySelector('.tt-error');
      if (!form.password.value) { err.textContent = '✖ Escribe tu contraseña'; return beep('error'); }
      if (!window.confirm('¿Seguro? Tu cuenta, reseñas, comentarios y votos se borrarán para siempre.')) return;
      try {
        await api('api/members.php?action=delete', { json: { password: form.password.value } });
        accountModal.close();
        setMember(null);
        toast('CUENTA BORRADA. GAME OVER… ¡GRACIAS POR JUGAR!');
      } catch (ex) {
        if (ex.status === 401) return handleError(ex);
        err.textContent = `✖ ${ex.message}`;
        beep('error');
      }
    });
  }

  const rememberNotified = (createdAt) => { if (createdAt) window.TT.store.set('tt-notified', createdAt); };

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
    if (!me || (document.hidden && !(browserNotifySupported() && Notification.permission === 'granted'))) return;
    try {
      const res = await api('api/members.php?action=me');
      if (!res.member) { setMember(null); return; }
      const before = lastUnread;
      setUnread(res.unread);
      if (res.unread > before && browserNotifySupported() && Notification.permission === 'granted') {
        const list = await api('api/members.php?action=notifications');
        const already = window.TT.store.get('tt-notified', '');
        list.items.filter((n) => n.createdAt > already && n.createdAt > (list.lastSeen || '')).slice(0, 3).forEach((n) => {
          const note = new Notification(n.title, { body: n.text || 'Novedad en THE THING', icon: 'assets/img/apple-touch-icon.png', tag: n.id });
          note.onclick = () => { window.focus(); if (n.item) goToItem(n.item); note.close(); };
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
    if (auth) openAuth(auth.dataset.auth);
  });

  site.ready.then((data) => {
    online = data.online;
    content = data.content;
    if (data.session && data.session.member) {
      setMember(data.session.member, data.session.unread);
      startPolling();
      checkUnread();
    }
  });

  window.TT.account = {
    me: () => me,
    openAuth,
    onChange: (fn) => listeners.push(fn),
    handleError,
  };
})();
