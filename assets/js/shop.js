/* THE THING — página de la tienda de merch */
(function () {
  'use strict';

  const { api, escapeHtml: esc, formatText, beep, createModal, reduceMotion } = window.TT;
  const $ = (sel, root = document) => root.querySelector(sel);


  const CONTACT = 'contacto@thethinggame.com';
  const CURRENCIES = { USD: 'en-US', MXN: 'es-MX', EUR: 'es-ES', ARS: 'es-AR', COP: 'es-CO', CLP: 'es-CL', PEN: 'es-PE' };
  let products = [];
  let filter = 'all';
  const detail = createModal();

  function priceText(p) {
    if (p.price === '' || p.price == null) return 'CONSULTAR';
    const cur = CURRENCIES[p.currency] ? p.currency : 'USD';
    try {
      return new Intl.NumberFormat(CURRENCIES[cur], { style: 'currency', currency: cur }).format(Number(p.price));
    } catch {
      return `$${p.price}`;
    }
  }
  const soldOut = (p) => /agotad|sold/i.test(p.status || '');
  const soon = (p) => /pr[oó]ximamente|soon/i.test(p.status || '');
  const sizesOf = (p) => String(p.sizes || '').split(',').map((x) => x.trim()).filter(Boolean);
  const statusClass = (p) => (soldOut(p) ? '' : soon(p) ? 'tag--status' : 'tag--live');
  const media = (p) => (p.image
    ? `<img src="${esc(p.image)}" alt="" loading="lazy">`
    : '<div class="placeholder" aria-hidden="true"><img src="assets/img/logo-lineal.webp" alt=""></div>');

  function render() {
    const wrap = $('#shop');
    const list = products.filter((p) => (filter === 'all' ? true : filter === 'soon' ? soon(p) : !soldOut(p) && !soon(p)));
    if (!list.length) {
      wrap.innerHTML = `<div class="empty" style="grid-column:1/-1">${products.length ? 'NADA POR AQUÍ CON ESE FILTRO' : 'LA TIENDA ABRE PRONTO. INSERT COIN.'}</div>`;
      return;
    }
    wrap.innerHTML = list.map((p, i) => `
      <button type="button" class="product${soldOut(p) ? ' soldout' : ''}" style="animation:panel-in .5s var(--ease-out) both; animation-delay:${Math.min(i, 8) * 0.06}s" data-open="${esc(p.id)}">
        <div class="product__media">${media(p)}<span class="price-tag">${esc(priceText(p))}</span></div>
        <div class="product__body">
          ${p.status ? `<div><span class="tag ${statusClass(p)}">${esc(p.status)}</span></div>` : ''}
          <h2 class="product__title">${esc(p.title)}</h2>
          ${p.summary ? `<p class="product__summary">${esc(p.summary)}</p>` : ''}
          ${sizesOf(p).length ? `<div class="sizes">${sizesOf(p).map((z) => `<span>${esc(z)}</span>`).join('')}</div>` : ''}
          <span class="product__cta">${soldOut(p) ? 'Agotado' : 'Ver producto ▶'}</span>
        </div>
      </button>`).join('');
  }

  function openProduct(p) {
    const sizes = sizesOf(p);
    const out = soldOut(p);
    detail.open(`
      <button class="icon-btn modal__close" type="button" data-close data-autofocus title="Cerrar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>
        <span class="sr-only">Cerrar</span>
      </button>
      ${p.image ? `<div class="modal__media" style="aspect-ratio:16/9"><img src="${esc(p.image)}" alt="" style="object-fit:contain;background:#0d0d0f"></div>` : ''}
      <article class="modal__content">
        <p class="eyebrow">Tienda oficial</p>
        ${p.status ? `<span class="tag ${statusClass(p)}">${esc(p.status)}</span>` : ''}
        <h2>${esc(p.title)}</h2>
        <p class="modal__lead" style="font-family:var(--pixel);font-size:18px;color:var(--acc)">${esc(priceText(p))}</p>
        ${p.summary ? `<p class="modal__lead">${esc(p.summary)}</p>` : ''}
        <div class="prose">${formatText(p.body)}</div>
        ${sizes.length ? `<p class="term" style="margin:16px 0 0;color:var(--muted);font-size:20px">TALLA / VARIANTE:</p>
          <div class="size-pick" role="group" aria-label="Talla">${sizes.map((z, i) => `<button type="button" data-size="${esc(z)}" aria-pressed="${i === 0}">${esc(z)}</button>`).join('')}</div>` : ''}
        <div class="modal__actions">
          ${out || soon(p) ? `<span class="btn" aria-disabled="true">${out ? 'Agotado' : 'Próximamente'}</span>`
            : `<a class="btn btn--solid" id="buyBtn" href="#" target="_blank" rel="noopener noreferrer">🛒 ${p.link ? 'Comprar' : 'Pedir por correo'}</a>`}
          <button class="btn" type="button" data-close>◀ Seguir mirando</button>
        </div>
        <p class="buy-note">Precios con impuestos incluidos salvo que se indique lo contrario. Gastos de envío aparte, te los confirmamos antes del pago.
          Puedes arrepentirte de tu compra dentro del plazo legal desde el <a href="soporte.html?tipo=arrepentimiento#contacto">botón de arrepentimiento</a>.
          <a href="terminos.html#compras">Condiciones de compra</a></p>
      </article>`, () => history.replaceState(null, '', location.pathname + location.search));
    history.replaceState(null, '', `#ver-${p.id}`);
    const buy = document.getElementById('buyBtn');
    if (!buy) return;
    const update = () => {
      const sel = detail.panel.querySelector('[data-size][aria-pressed="true"]');
      const size = sel ? sel.dataset.size : '';
      if (p.link) {
        buy.href = p.link;
        return;
      }
      const subject = `Pedido: ${p.title}${size ? ` (${size})` : ''}`;
      const body = `Hola THE THING,\n\nQuiero pedir: ${p.title}${size ? `\nTalla / variante: ${size}` : ''}\nPrecio: ${priceText(p)}\n\nMi nombre:\nMi dirección de envío:\n`;
      buy.href = `mailto:${CONTACT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      buy.removeAttribute('target');
    };
    detail.panel.querySelectorAll('[data-size]').forEach((b) => b.addEventListener('click', () => {
      detail.panel.querySelectorAll('[data-size]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      beep('blip');
      update();
    }));
    update();
    buy.addEventListener('click', () => beep('coin'));
  }

  document.addEventListener('click', (e) => {
    const card = e.target.closest('[data-open]');
    if (card) {
      const p = products.find((x) => x.id === card.dataset.open);
      if (p) openProduct(p);
    }
    const f = e.target.closest('[data-filter]');
    if (f) {
      filter = f.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b === f)));
      beep('blip');
      render();
    }
  });

  window.TT.openItem = (id) => {
    const p = products.find((x) => x.id === id);
    if (!p) return false;
    openProduct(p);
    return true;
  };

  api('api/content.php?type=product')
    .then((items) => { products = items; })
    .catch(() => {
      products = [];
      $('#shop').innerHTML = '<div class="empty" style="grid-column:1/-1">LA TIENDA NECESITA EL SERVIDOR (O ABRIR LA WEB EN MODO DEMO)</div>';
    })
    .then(() => {
      if (!$('#shop').innerHTML) render();
      else if (products.length) render();
      const m = location.hash.match(/^#ver-(.+)$/);
      if (m) {
        const p = products.find((x) => x.id === decodeURIComponent(m[1]));
        if (p) setTimeout(() => openProduct(p), reduceMotion ? 0 : 300);
      }
    });
})();
