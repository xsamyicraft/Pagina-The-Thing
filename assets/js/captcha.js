/*
 * THE THING — captcha en forma de minijuego arcade.
 * TT.captcha.mount(caja) dibuja el minijuego dentro de "caja" y devuelve
 * { token(), reset() }. La ficha (token) la pide el servidor para crear
 * cuentas, iniciar sesión y enviar consultas de soporte.
 */
(function () {
  'use strict';

  const { api, escapeHtml: esc, beep, reduceMotion } = window.TT;

  function mount(box, opts = {}) {
    let token = null;
    let lives = 3;
    let stage = 1;
    let score = 0;
    let challenge = null;
    let picked = new Set();
    let timer = null;
    let left = 0;
    let busy = false;

    box.classList.add('captcha');
    idle();

    function stop() {
      clearInterval(timer);
      timer = null;
    }

    function idle() {
      stop();
      box.classList.remove('is-done');
      box.innerHTML = `
        <div class="captcha__idle">
          <span class="captcha__icon" aria-hidden="true"><i></i></span>
          <span class="captcha__txt"><b>¿ERES HUMANO?</b><span>Supera un minijuego rápido para demostrar que no eres un robot.</span></span>
          <button type="button" class="btn btn--sm" data-cap-play>▶ Jugar</button>
        </div>`;
    }

    async function play() {
      if (busy) return;
      busy = true;
      stop();
      picked = new Set();
      box.innerHTML = `<div class="captcha__game is-loading"><p class="captcha__prompt">CARGANDO NIVEL…</p></div>`;
      try {
        challenge = await api('api/captcha.php?action=new');
      } catch (err) {
        busy = false;
        box.innerHTML = `<div class="captcha__idle"><span class="captcha__txt"><b>✖ ${esc(err.message)}</b><span>Comprueba tu conexión.</span></span><button type="button" class="btn btn--sm" data-cap-play>↻ Reintentar</button></div>`;
        return;
      }
      busy = false;
      const cells = challenge.cols * challenge.rows;
      box.innerHTML = `
        <div class="captcha__game">
          <div class="captcha__hud">
            <span>STAGE ${String(stage).padStart(2, '0')}</span>
            <span class="captcha__lives" aria-label="${lives} vidas">${'♥'.repeat(lives)}<i>${'♥'.repeat(3 - lives)}</i></span>
            <span class="captcha__time" aria-hidden="true">TIME <b>${challenge.seconds}</b></span>
          </div>
          <p class="captcha__prompt" aria-live="polite">${esc(challenge.prompt)}</p>
          <div class="captcha__board" style="--cols:${challenge.cols};--rows:${challenge.rows}">
            <img src="${challenge.image}" alt="Cuadrícula de ${cells} casillas con dibujos pixelados" draggable="false">
            ${Array.from({ length: cells }, (_, i) => `<button type="button" class="captcha__cell" data-cell="${i}" aria-pressed="false" aria-label="Casilla ${i + 1}"></button>`).join('')}
          </div>
          <div class="captcha__foot">
            <span class="captcha__score">SCORE <b>${String(score).padStart(6, '0')}</b></span>
            <span class="captcha__btns">
              <button type="button" class="linkish" data-cap-new title="Otro nivel">↻ Otro</button>
              <button type="button" class="btn btn--sm btn--solid" data-cap-done>▶ Listo</button>
            </span>
          </div>
          <p class="captcha__help">¿Problemas para jugar? Escríbenos a <a href="mailto:soporte@thethinggame.com">soporte@thethinggame.com</a></p>
        </div>`;
      left = challenge.seconds;
      timer = setInterval(() => {
        left--;
        const t = box.querySelector('.captcha__time b');
        if (t) t.textContent = left;
        if (left <= 10 && t) t.parentElement.classList.add('hurry');
        if (left <= 0) fail('¡TIEMPO!');
      }, 1000);
    }

    function setScore() {
      const s = box.querySelector('.captcha__score b');
      if (s) s.textContent = String(Math.max(0, score)).padStart(6, '0');
    }

    function toggle(cell) {
      const i = Number(cell.dataset.cell);
      const on = !picked.has(i);
      if (on) picked.add(i); else picked.delete(i);
      cell.classList.toggle('on', on);
      cell.setAttribute('aria-pressed', String(on));
      score += on ? 100 : -100;
      setScore();
      beep(on ? 'coin' : 'back');
      if (on && !reduceMotion) {
        const pop = document.createElement('span');
        pop.className = 'captcha__pop';
        pop.textContent = '+100';
        cell.appendChild(pop);
        pop.addEventListener('animationend', () => pop.remove());
      }
    }

    async function done() {
      if (busy || !challenge) return;
      if (!picked.size) {
        const p = box.querySelector('.captcha__prompt');
        p.classList.remove('nudge');
        void p.offsetWidth;
        p.classList.add('nudge');
        return beep('error');
      }
      busy = true;
      stop();
      try {
        const res = await api('api/captcha.php?action=verify', { json: { id: challenge.id, cells: [...picked] } });
        token = res.token;
        win();
      } catch (err) {
        busy = false;
        fail(err.status === 429 ? 'ESPERA UN POCO' : '¡FALLASTE!');
        return;
      }
      busy = false;
    }

    function fail(msg) {
      stop();
      lives--;
      beep('error');
      const game = box.querySelector('.captcha__game');
      if (game) {
        game.classList.add('shake');
        game.insertAdjacentHTML('beforeend', `<div class="captcha__flash">${esc(msg)}</div>`);
      }
      if (lives <= 0) {
        setTimeout(() => {
          box.innerHTML = `
            <div class="captcha__over">
              <b>GAME OVER</b>
              <span>Se acabaron las vidas.</span>
              <button type="button" class="btn btn--sm" data-cap-coin>▶ Insertar moneda</button>
            </div>`;
        }, reduceMotion ? 0 : 700);
        return;
      }
      stage++;
      setTimeout(play, reduceMotion ? 0 : 800);
    }

    function win() {
      score += 1000;
      beep('select');
      box.classList.add('is-done');
      box.innerHTML = `
        <div class="captcha__win" role="status">
          <span class="captcha__check" aria-hidden="true">✓</span>
          <span class="captcha__txt"><b>LEVEL CLEAR · HUMANO VERIFICADO</b><span>SCORE ${String(score).padStart(6, '0')}</span></span>
          <i class="captcha__confetti" aria-hidden="true">${'<b></b>'.repeat(14)}</i>
        </div>`;
      if (opts.onSolved) opts.onSolved(token);
    }

    box.addEventListener('click', (e) => {
      const cell = e.target.closest('.captcha__cell');
      if (cell) return toggle(cell);
      if (e.target.closest('[data-cap-play]')) return play();
      if (e.target.closest('[data-cap-new]')) { stage++; return play(); }
      if (e.target.closest('[data-cap-done]')) return done();
      if (e.target.closest('[data-cap-coin]')) { lives = 3; stage = 1; score = 0; beep('coin'); return play(); }
    });

    return {
      token: () => token,
      /** La ficha solo vale una vez: tras enviar el formulario hay que volver a jugar. */
      reset() {
        token = null;
        lives = 3;
        stage = 1;
        idle();
      },
      destroy: stop,
    };
  }

  window.TT.captcha = { mount };
})();
