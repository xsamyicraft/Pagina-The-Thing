/* THE THING — página de soporte: preguntas frecuentes, formulario y seguimiento de consultas */
(function () {
  'use strict';

  const { api, escapeHtml: esc, formatDate, beep, toast, reduceMotion } = window.TT;
  const $ = (sel, root = document) => root.querySelector(sel);
  const site = window.TT.site;
  const params = new URLSearchParams(location.search);

  /* ------------------------------------------------------------------ */
  /* Preguntas frecuentes: temas + buscador                               */
  /* ------------------------------------------------------------------ */

  let topic = '';
  const faqs = [...document.querySelectorAll('.faq')];
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  function filterFaq() {
    const q = norm($('#faqSearch').value.trim());
    let shown = 0;
    faqs.forEach((f) => {
      const ok = (!topic || f.dataset.topic === topic) && (!q || norm(f.textContent).includes(q));
      f.hidden = !ok;
      if (ok) shown++;
      if (q && ok) f.open = true;
    });
    $('#faqEmpty').hidden = shown > 0;
  }
  $('#faqSearch').addEventListener('input', filterFaq);
  document.querySelectorAll('.topic').forEach((b) => b.addEventListener('click', () => {
    topic = topic === b.dataset.topic ? '' : b.dataset.topic;
    document.querySelectorAll('.topic').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.topic === topic)));
    beep('blip');
    filterFaq();
  }));

  /* Aparición al hacer scroll */
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  }), { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

  /* ------------------------------------------------------------------ */
  /* Formulario de contacto                                              */
  /* ------------------------------------------------------------------ */

  const form = $('#supportForm');
  const captcha = window.TT.captcha.mount($('#supportCaptcha'));

  function syncCategory() {
    const c = form.category.value;
    $('#gameField').hidden = c !== 'juegos';
    $('#orderField').hidden = !['tienda', 'arrepentimiento'].includes(c);
    $('#regretNote').hidden = c !== 'arrepentimiento';
    $('#privacyNote').hidden = c !== 'privacidad';
    if (c === 'arrepentimiento' && !form.subject.value) form.subject.value = 'Quiero arrepentirme de mi compra';
  }
  form.category.addEventListener('change', syncCategory);

  const tipo = params.get('tipo');
  if (tipo && form.category.querySelector(`option[value="${CSS.escape(tipo)}"]`)) form.category.value = tipo;

  site.ready.then((data) => {
    const games = data.content.filter((i) => i.type === 'app');
    form.game.insertAdjacentHTML('beforeend', games.map((g) => `<option value="${esc(g.id)}">${esc(g.title)}</option>`).join(''));
    const juego = params.get('juego');
    if (juego && games.some((g) => g.id === juego)) {
      form.category.value = 'juegos';
      form.game.value = juego;
    }
    syncCategory();
    const me = window.TT.account.me();
    if (me) {
      if (!form.elements.name.value) form.elements.name.value = me.name;
      if (!form.email.value) form.email.value = me.email;
    }
  });
  window.TT.account.onChange((me) => {
    if (me && !form.email.value) { form.elements.name.value = me.name; form.email.value = me.email; }
  });
  syncCategory();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = form.querySelector('.tt-error');
    err.textContent = '';
    const data = {
      name: form.elements.name.value.trim(), email: form.email.value.trim(), category: form.category.value,
      game: $('#gameField').hidden ? '' : form.game.value, order: $('#orderField').hidden ? '' : form.order.value.trim(),
      subject: form.subject.value.trim(), message: form.message.value.trim(), accept: form.accept.checked,
      website: form.website.value, captcha: captcha.token(),
    };
    const problem = data.name.length < 2 ? 'Escribe tu nombre'
      : !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email) ? 'Revisa tu correo'
        : !data.category ? 'Elige el tipo de consulta'
          : data.subject.length < 3 ? 'Escribe un asunto'
            : data.message.length < 10 ? 'Cuéntanos un poco más (mínimo 10 caracteres)'
              : !data.accept ? 'Acepta la política de privacidad para que podamos responderte'
                : !data.captcha ? 'Supera el minijuego anti-robots' : '';
    if (problem) {
      err.textContent = `✖ ${problem}`;
      if (!data.captcha && problem.includes('minijuego')) {
        const box = $('#supportCaptcha');
        box.classList.remove('nudge');
        void box.offsetWidth;
        box.classList.add('nudge');
      }
      return beep('error');
    }
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      const res = await api('api/support.php?action=create', { json: data });
      beep('coin');
      showSent(res.code, data.email, res.mailed);
    } catch (ex) {
      err.textContent = `✖ ${ex.message}`;
      beep('error');
      captcha.reset();
      btn.disabled = false;
    }
  });

  function showSent(code, email, mailed) {
    form.innerHTML = `
      <div class="ticket-sent">
        <p class="eyebrow">Consulta recibida</p>
        <p class="ticket-sent__label">TU CÓDIGO</p>
        <p class="ticket-sent__code">${esc(code)}</p>
        <p>Guárdalo: con él y tu correo puedes ver las respuestas aquí abajo, en «Seguir mi consulta».${mailed ? ` También te lo enviamos a <b>${esc(email)}</b>.` : ''}</p>
        <div class="ticket-sent__btns">
          <button class="btn btn--sm" type="button" id="copyCode">⧉ Copiar código</button>
          <a class="btn btn--sm" href="#seguimiento" id="goTrack">▶ Ver mi consulta</a>
        </div>
      </div>`;
    $('#copyCode').addEventListener('click', () => {
      (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(() => toast('CÓDIGO COPIADO')).catch(() => toast(code));
    });
    $('#goTrack').addEventListener('click', () => {
      const lf = $('#lookupForm');
      lf.code.value = code;
      lf.email.value = email;
      lookup();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Seguimiento                                                         */
  /* ------------------------------------------------------------------ */

  const STATUS = { open: ['ABIERTA', 'tag--status'], answered: ['RESPONDIDA', 'tag--live'], closed: ['CERRADA', ''] };
  const lookupForm = $('#lookupForm');

  async function lookup(extra) {
    const err = lookupForm.querySelector('.tt-error');
    err.textContent = '';
    const code = lookupForm.code.value.trim().toUpperCase();
    const email = lookupForm.email.value.trim();
    if (!code || !email) { err.textContent = '✖ Escribe el código y el correo'; return beep('error'); }
    try {
      const t = await api(`api/support.php?action=${extra ? 'reply' : 'lookup'}`, { json: { code, email, ...(extra || {}) } });
      renderTicket(t);
      if (extra) { toast('RESPUESTA ENVIADA'); beep('coin'); }
    } catch (ex) {
      err.textContent = `✖ ${ex.message}`;
      $('#ticketView').innerHTML = '';
      beep('error');
    }
  }

  function renderTicket(t) {
    const [label, cls] = STATUS[t.status] || STATUS.open;
    $('#ticketView').innerHTML = `
      <div class="ticket">
        <div class="ticket__head">
          <div><p class="ticket__code">${esc(t.code)}</p><h3>${esc(t.subject)}</h3>
          <p class="ticket__meta">${esc(t.categoryLabel)} · abierta el ${esc(formatDate(t.createdAt))}</p></div>
          <span class="tag ${cls}">${label}</span>
        </div>
        <div class="thread">
          ${t.messages.map((m, i) => `
            <div class="msg msg--${m.from}" style="--d:${Math.min(i, 8) * 0.06}s">
              <p class="msg__who">${m.from === 'staff' ? '■ EQUIPO THE THING' : '&gt; TÚ'} · ${esc(new Date(m.at).toLocaleString('es'))}</p>
              <p class="msg__text">${esc(m.text)}</p>
            </div>`).join('')}
        </div>
        <form class="tt-form" id="replyForm" novalidate>
          <label class="tt-field"><span>${t.status === 'closed' ? 'ESCRIBE PARA REABRIR LA CONSULTA' : 'AÑADIR UN MENSAJE'}</span><textarea name="message" maxlength="4000" required></textarea></label>
          <div><button class="btn btn--sm btn--solid" type="submit">▶ Enviar</button></div>
        </form>
      </div>`;
    $('#replyForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const msg = e.currentTarget.message.value.trim();
      if (msg.length < 2) return beep('error');
      lookup({ message: msg });
    });
    $('#ticketView').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }

  lookupForm.addEventListener('submit', (e) => { e.preventDefault(); lookup(); });
  const codeParam = params.get('codigo');
  if (codeParam) lookupForm.code.value = codeParam;
})();
