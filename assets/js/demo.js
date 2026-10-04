/*
 * THE THING — MODO DEMO (sin servidor)
 * ------------------------------------------------------------------
 * Imita la API de PHP dentro del navegador para poder probar la web
 * abriendo index.html con doble clic (file://) o añadiendo ?demo=1.
 * Todo se guarda en el localStorage de ESTE navegador: nada se publica
 * y nadie más lo ve. En el servidor real (Hostinger) no se activa.
 */
(function () {
  'use strict';

  let flag = false;
  try {
    if (/[?&]demo=1/.test(location.search)) sessionStorage.setItem('tt-demo', '1');
    if (/[?&]demo=0/.test(location.search)) sessionStorage.removeItem('tt-demo');
    flag = sessionStorage.getItem('tt-demo') === '1';
  } catch { /* sin almacenamiento */ }
  if (location.protocol !== 'file:' && !flag) return;

  const KEY = 'tt-demo-db';
  const now = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const id = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
  const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString().replace(/\.\d+Z$/, 'Z');

  function seed() {
    const item = (days, f) => ({
      id: id(), type: '', title: '', summary: '', body: '', image: '', link: '', platform: '', status: '', value: '',
      featured: false, appKey: '', downloads: '', playPackage: '', videoUrl: '', price: '', currency: 'USD', sizes: '', ...f, createdAt: daysAgo(days), updatedAt: daysAgo(days),
    });
    return {
      admin: { email: 'admin@thethinggame.com', password: '' },
      session: { admin: false, member: null },
      members: [],
      comments: [],
      votes: {},
      notifications: [],
      levelplay: { configured: false, fetchedAt: null },
      googleplay: { configured: false },
      pin: null,
      pendingPin: false,
      tickets: [],
      reports: [],
      settings: {},
      captcha: null,
      captchaTokens: [],
      content: [
        item(2, { type: 'app', title: 'PROYECTO: THE THING', platform: 'PC', status: 'En desarrollo', featured: true, appKey: 'demo1a2b3', downloads: '15300',
          summary: 'Nuestro primer título. Un survival de terror retro donde nada es lo que parece… ni siquiera el gato.',
          body: 'Estamos trabajando en nuestro primer juego. Muy pronto compartiremos más detalles, capturas y una demo jugable.\n\nSíguenos para no perderte nada.' }),
        item(1, { type: 'news', title: 'Bienvenidos a THE THING', featured: true,
          summary: 'Nace un nuevo estudio independiente de videojuegos. Esto es lo que viene.',
          body: 'Hoy encendemos la máquina por primera vez.\n\n**THE THING** es un estudio nuevo con una idea clara: hacer juegos raros, memorables y con alma de cartucho viejo.' }),
        item(0, { type: 'news', title: 'Diario de desarrollo #0', game: '__app__', summary: 'Primeros bocetos, primeras ideas y demasiadas tazas de café.',
          body: 'Esta es una noticia de ejemplo. Puedes editarla o borrarla desde el panel de administración.' }),
        item(5, { type: 'product', title: 'Camiseta "The Thing"', price: '24.99', sizes: 'S, M, L, XL', status: 'Disponible',
          summary: 'Camiseta negra 100% algodón con el gato glitch.', image: 'assets/img/logo-small.webp' }),
        item(5, { type: 'product', title: 'Taza "Insert Coin"', price: '12.50', status: 'Próximamente', summary: 'Para el café de las sesiones nocturnas.' }),
        item(3, { type: 'data', title: 'Proyectos en marcha', value: '1', summary: 'Y contando.' }),
        item(3, { type: 'data', title: 'Tazas de café', value: '9999', summary: 'Estimación conservadora.' }),
        item(3, { type: 'data', title: 'Bugs aplastados', value: '404', summary: 'Los que encontramos.' }),
        item(3, { type: 'data', title: 'Año de fundación', value: String(new Date().getFullYear()), summary: 'Insert coin.' }),
        item(4, { type: 'image', title: 'El logo', summary: 'La cosa nos observa.', image: 'assets/img/logo.webp' }),
      ],
    };
  }

  function fresh() {
    const db = seed();
    const app = db.content.find((i) => i.type === 'app');
    db.content.forEach((i) => { if (i.game === '__app__') i.game = app.id; });
    return db;
  }

  function load() {
    try {
      const db = JSON.parse(localStorage.getItem(KEY));
      if (db && db.content) {
        if (!db.googleplay) db.googleplay = { configured: false };
        ['tickets', 'reports', 'captchaTokens'].forEach((k) => { if (!Array.isArray(db[k])) db[k] = []; });
        if (!db.settings) db.settings = {};
        return db;
      }
    } catch { /* datos dañados: se reinician */ }
    return fresh();
  }
  let db = load();
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {
      throw httpError(507, 'El almacenamiento del navegador está lleno (usa imágenes más pequeñas o reinicia la demo)');
    }
  }

  function httpError(status, message) {
    const e = new Error(message);
    e.status = status;
    return e;
  }
  /* El administrador también es jugador en la web (cuenta del staff) */
  function staffMember() {
    let m = db.members.find((x) => x.staff);
    if (!m) {
      m = { id: id(), name: 'THE THING', email: db.admin.email, password: '', emailNotify: false, createdAt: now(), lastSeen: '', staff: true };
      db.members.push(m);
    }
    return m;
  }
  const member = () => {
    if (!db.session.member && db.session.admin) { db.session.member = staffMember().id; db.session.staff = true; }
    return db.members.find((m) => m.id === db.session.member) || null;
  };
  const pubMember = (m) => ({ id: m.id, name: m.name, email: m.email, emailNotify: !!m.emailNotify, createdAt: m.createdAt, staff: !!m.staff });
  const RESERVED = ['thething', 'admin', 'administrador', 'administrator', 'staff', 'soporte', 'support', 'moderador', 'mod', 'oficial'];
  const reserved = (name) => RESERVED.includes(name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''));
  const SOCIAL_PATTERNS = { youtube: 'https://www.youtube.com/@%s', tiktok: 'https://www.tiktok.com/@%s', instagram: 'https://www.instagram.com/%s', x: 'https://x.com/%s',
    discord: 'https://discord.gg/%s', facebook: 'https://www.facebook.com/%s', twitch: 'https://www.twitch.tv/%s', googleplay: 'https://play.google.com/store/apps/developer?id=%s',
    steam: 'https://store.steampowered.com/developer/%s', itchio: 'https://%s.itch.io' };
  function socialUrl(k, v) {
    v = String(v || '').trim();
    if (!v) return '';
    if (/^https?:\/\//i.test(v) || (v.includes('/') && v[0] !== '@')) return /^https?:\/\//i.test(v) ? v.replace(/^http:/i, 'https:') : `https://${v}`;
    const h = v.replace(/^@/, '').replace(/[^\w.-]/g, '');
    return h ? SOCIAL_PATTERNS[k].replace('%s', encodeURIComponent(h)) : '';
  }
  const pubItem = (i) => {
    if (db.session.admin) return { ...i };
    const { appKey, downloads, playPackage, ...rest } = i;
    return rest;
  };
  const needAdmin = () => { if (!db.session.admin) throw httpError(401, 'No autorizado'); };
  const needMember = () => { const m = member(); if (!m) throw httpError(401, 'Regístrate o inicia sesión para participar'); return m; };

  function summary() {
    const ratings = {};
    const comments = {};
    db.comments.forEach((c) => {
      comments[c.item] = (comments[c.item] || 0) + 1;
      if (!c.rating) return;
      ratings[c.item] = ratings[c.item] || { sum: 0, count: 0 };
      ratings[c.item].sum += c.rating;
      ratings[c.item].count++;
    });
    Object.keys(ratings).forEach((k) => {
      ratings[k] = { avg: Math.round((ratings[k].sum / ratings[k].count) * 100) / 100, count: ratings[k].count };
    });
    const votes = { best: {}, played: {} };
    Object.values(db.votes).forEach((v) => ['best', 'played'].forEach((c) => {
      if (v[c]) votes[c][v[c]] = (votes[c][v[c]] || 0) + 1;
    }));
    const m = member();
    return { ratings, votes, comments, mine: m ? db.votes[m.id] || {} : {} };
  }

  function notify(title, text, item, kind) {
    const n = { id: id(), kind: kind || 'aviso', title, text: text || '', item: item || '', createdAt: now() };
    db.notifications.unshift(n);
    db.notifications = db.notifications.slice(0, 200);
    return db.members.filter((m) => m.emailNotify).length;
  }

  function memberNotifications(m) {
    const since = new Date(new Date(m.createdAt).getTime() - 14 * 86400000).toISOString();
    const items = db.notifications.filter((n) => n.createdAt >= since);
    items.push({ id: 'welcome', kind: 'aviso', title: `¡Bienvenido a THE THING, ${m.name}!`, text: 'Aquí te avisaremos de juegos nuevos, noticias y novedades del estudio.', item: '', createdAt: m.createdAt });
    const lastSeen = m.lastSeen || '';
    return { items: items.slice(0, 50), unread: items.filter((n) => n.createdAt > lastSeen).length, lastSeen };
  }

  /* Correo con la plantilla de la web (igual que api/_mail.php) */
  function mailHtml(preheader, inner) {
    const f = "'Courier New', Courier, monospace";
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><base href="${location.href}"></head><body style="margin:0;background:#050506">
      <div style="display:none">${preheader}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050506"><tr><td align="center" style="padding:28px 12px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border:6px double #ff3355;background:#111113;background-image:repeating-linear-gradient(to bottom,transparent 0,transparent 2px,rgba(0,0,0,.25) 3px,transparent 4px)">
      <tr><td style="padding:22px 28px 6px;font-family:${f};font-size:12px;color:#ff3355;letter-spacing:2px">● REC<span style="float:right;color:#8f8b80">CH-01 · ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}</span></td></tr>
      <tr><td align="center" style="padding:10px 28px 0"><img src="assets/img/logo-email.png" width="120" alt="THE THING" style="display:block;width:120px"></td></tr>
      <tr><td align="center" style="padding:8px 28px 18px;font-family:${f};font-size:22px;font-weight:bold;letter-spacing:6px;color:#ebe6d8">THE THING<div style="font-size:11px;letter-spacing:4px;color:#8f8b80;font-weight:normal;margin-top:4px">GAME STUDIO</div></td></tr>
      <tr><td style="padding:0 28px"><div style="border-top:2px solid #ff3355;border-bottom:2px solid #ff3355;height:2px"></div></td></tr>
      <tr><td style="padding:26px 28px 30px;font-family:${f};font-size:15px;line-height:1.6;color:#ebe6d8">${inner}</td></tr>
      <tr><td style="padding:16px 28px 22px;border-top:1px dashed #2b2b31;font-family:${f};font-size:11px;color:#8f8b80;text-align:center">INSERT COIN TO CONTINUE<br>© ${d.getFullYear()} THE THING</td></tr>
      </table></td></tr></table></body></html>`;
  }
  function pinMail(pin) {
    const cells = pin.split('').map((x) => `<td style="padding:0 3px"><div style="border:4px double #ff3355;background:#000;color:#6bff7f;font-family:'Courier New',monospace;font-size:30px;font-weight:bold;width:40px;line-height:54px;text-align:center">${x}</div></td>`).join('');
    return mailHtml(`Tu PIN de acceso: ${pin}`, `<div style="font-size:13px;letter-spacing:3px;color:#6bff7f;margin:0 0 8px">■ ACCESO STAFF</div>
      <h1 style="margin:0 0 16px;font-size:24px;color:#ebe6d8">Tu PIN de acceso</h1>
      <p style="margin:0 0 6px;color:#8f8b80">Alguien (esperamos que tú) ha introducido la contraseña correcta del panel de THE THING. Para terminar de entrar escribe este código:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px auto"><tr>${cells}</tr></table>
      <p style="margin:0;text-align:center;color:#6bff7f">&gt; Caduca en 10 minutos_</p>
      <p style="margin:22px 0 0;padding:12px 14px;border:1px dashed #2b2b31;font-size:12px;color:#8f8b80">IP: 127.0.0.1 (demo)<br><span style="color:#ff3355">¿No fuiste tú?</span> Alguien conoce tu contraseña: cámbiala cuanto antes. Sin este PIN no puede entrar.</p>`);
  }
  function newPin() {
    const pin = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
    db.pin = { pin, expires: Date.now() + 10 * 60000, tries: 0 };
    db.pendingPin = true;
    db.session.admin = false;
    return { step: 'pin', sentTo: 'ad•••@thethinggame.com', mailSent: true, minutes: 10, demoMail: pinMail(pin), demoPin: pin };
  }

  /* Datos de EJEMPLO de LevelPlay (la demo no puede leer los reales) */
  function levelplayDemo(days) {
    const games = db.content.filter((i) => i.type === 'app');
    const apps = games.filter((g) => g.appKey).map((g, i) => ({ appKey: g.appKey, appName: g.title, platform: g.platform || 'Android', f: 1 / (i + 1) }));
    apps.push({ appKey: 'demo-sinenlazar', appName: 'App sin enlazar', platform: 'iOS', f: 0.3 });
    const daily = [];
    const totals = { revenue: 0, impressions: 0, activeUsers: 0 };
    const byApp = {};
    for (let d = days - 1; d >= 0; d--) {
      const date = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
      const row = { date, revenue: 0, impressions: 0, activeUsers: 0 };
      const t = days - d;
      apps.forEach((a) => {
        const imp = Math.round((800 + 300 * Math.sin(t / 3) + t * 15) * a.f);
        const rev = Math.round(imp * 0.0065 * 100) / 100;
        const au = Math.round(imp / 4);
        row.revenue += rev; row.impressions += imp; row.activeUsers += au;
        const b = byApp[a.appKey] || (byApp[a.appKey] = { appKey: a.appKey, appName: a.appName, platform: a.platform, revenue: 0, impressions: 0, activeUsers: 0, days: 0, daily: [] });
        b.revenue += rev; b.impressions += imp; b.activeUsers += au; b.days++;
        b.daily.push({ date, revenue: rev, impressions: imp, activeUsers: au });
      });
      row.revenue = Math.round(row.revenue * 100) / 100;
      totals.revenue += row.revenue; totals.impressions += row.impressions; totals.activeUsers += row.activeUsers;
      daily.push(row);
    }
    Object.values(byApp).forEach((a) => {
      a.revenue = Math.round(a.revenue * 100) / 100;
      a.avgDau = Math.round(a.activeUsers / a.days);
      a.ecpm = Math.round((a.revenue / a.impressions) * 100000) / 100;
    });
    totals.revenue = Math.round(totals.revenue * 100) / 100;
    totals.ecpm = Math.round((totals.revenue / totals.impressions) * 100000) / 100;
    totals.avgDau = Math.round(totals.activeUsers / days);
    return { daily, apps: byApp, totals, range: { start: daily[0].date, end: daily[daily.length - 1].date } };
  }

  /* ------------------------------------------------------------------ */
  /* Minijuego anti-robots (igual que api/captcha.php, dibujado en canvas) */
  /* ------------------------------------------------------------------ */

  const SPRITES = {
    coin: { label: 'TODAS LAS MONEDAS', pal: { a: '#ffb547', b: '#7a4a00', c: '#fff6d8' }, px: ['....bbbb....', '..bbaaaabb..', '.baaaaaaaab.', '.baccaaaaab.', 'baacaaabaaab', 'baacaaabaaab', 'baaaaaabaaab', 'baaaaaabaaab', '.baaaaaaaab.', '.baaaaaaaab.', '..bbaaaabb..', '....bbbb....'] },
    heart: { label: 'TODOS LOS CORAZONES', pal: { a: '#ff3355', b: '#5c0012', c: '#ffffff' }, px: ['............', '.bbb....bbb.', 'baaab..baaab', 'bacaabbaaaab', 'bacaaaaaaaab', 'baaaaaaaaaab', '.baaaaaaaab.', '..baaaaaab..', '...baaaab...', '....baab....', '.....bb.....', '............'] },
    ghost: { label: 'TODOS LOS FANTASMAS', pal: { a: '#dff6ff', b: '#24425c', c: '#ffffff', d: '#1a3cff' }, px: ['....bbbb....', '..bbaaaabb..', '.baaaaaaaab.', '.baccaaccab.', '.bacdaacdab.', 'baaaaaaaaaab', 'baaaaaaaaaab', 'baaaaaaaaaab', 'baaaaaaaaaab', 'baaaaaaaaaab', 'baabaabbaabb', 'bb.bb..bb.b.'] },
    cat: { label: 'TODOS LOS GATOS', pal: { a: '#a9a9a9', b: '#141414', c: '#ffffff', d: '#000000' }, px: ['b..........b', 'bb........bb', 'bab......bab', 'baabbbbbbaab', 'baaaaaaaaaab', 'bacccaacccab', 'bacdcaacdcab', 'baaaaaaaaaab', 'baaaabbaaaab', '.baaaaaaaab.', '..bbaaaabb..', '....bbbb....'] },
    star: { label: 'TODAS LAS ESTRELLAS', pal: { a: '#fff07a', b: '#7a5c00' }, px: ['.....bb.....', '....baab....', '....baab....', '...baaaab...', 'bbbbaaaabbbb', 'baaaaaaaaaab', '.baaaaaaaab.', '..baaaaaab..', '..baaaaaab..', '.baaabbaaab.', '.baab..baab.', '.bb......bb.'] },
    tape: { label: 'TODOS LOS CASSETTES', pal: { a: '#34343a', b: '#08080a', c: '#efe8d6', d: '#e8e8e8', e: '#ff3355' }, px: ['............', 'bbbbbbbbbbbb', 'baaaaaaaaaab', 'bacccccccccb', 'baeeeeeeeeab', 'baaaaaaaaaab', 'baddabbaddab', 'baddabbaddab', 'baaaaaaaaaab', 'bab.bbbb.bab', 'bbb......bbb', '............'] },
  };
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  function captchaImage(grid) {
    const cell = 110;
    const c = document.createElement('canvas');
    c.width = cell * 3;
    c.height = cell * 3;
    const g = c.getContext('2d');
    g.fillStyle = '#08080a';
    g.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 700; i++) {
      const v = rnd(14, 40);
      g.fillStyle = `rgb(${v},${v},${v + 6})`;
      g.fillRect(rnd(0, c.width), rnd(0, c.height), rnd(1, 3), rnd(1, 3));
    }
    grid.forEach((type, i) => {
      const sp = SPRITES[type];
      const scale = rnd(6, 8);
      const ox = (i % 3) * cell + rnd(4, cell - 12 * scale - 4);
      const oy = Math.floor(i / 3) * cell + rnd(4, cell - 12 * scale - 4);
      const flip = Math.random() < 0.5;
      sp.px.forEach((line, y) => {
        for (let x = 0; x < 12; x++) {
          const ch = line[flip ? 11 - x : x];
          if (ch === '.') continue;
          g.fillStyle = sp.pal[ch];
          g.fillRect(ox + x * scale, oy + y * scale, scale, scale);
        }
      });
    });
    g.fillStyle = 'rgba(0,0,0,.35)';
    for (let y = 0; y < c.height; y += 3) g.fillRect(0, y, c.width, 1);
    g.fillStyle = '#ff3355';
    [1, 2].forEach((k) => { g.fillRect(k * cell - 1, 0, 2, c.height); g.fillRect(0, k * cell - 1, c.width, 2); });
    return c.toDataURL('image/png');
  }
  function needCaptcha(token) {
    const now = Date.now();
    db.captchaTokens = db.captchaTokens.filter((t) => t.exp > now);
    const i = db.captchaTokens.findIndex((t) => t.token === token);
    if (!token || i < 0) throw httpError(400, 'Completa el minijuego anti-robots para continuar');
    db.captchaTokens.splice(i, 1);
  }

  const SUPPORT_CATEGORIES = { cuenta: 'Cuenta y acceso', juegos: 'Juegos y errores (bugs)', tienda: 'Tienda y pedidos', arrepentimiento: 'Arrepentimiento de compra', privacidad: 'Privacidad y mis datos', denuncia: 'Denunciar contenido o conducta', prensa: 'Prensa y colaboraciones', otro: 'Otro' };
  const pubTicket = (t) => ({ code: t.code, subject: t.subject, category: t.category, categoryLabel: t.categoryLabel, status: t.status, createdAt: t.createdAt, updatedAt: t.updatedAt, messages: t.messages });
  const findTicket = (b) => db.tickets.find((t) => t.code === String(b.code || '').trim().toUpperCase() && t.email === String(b.email || '').trim().toLowerCase());
  const DEFAULT_SETTINGS = { tradeName: 'THE THING', email: 'contacto@thethinggame.com', supportEmail: 'soporte@thethinggame.com', minAge: '13' };

  /* ------------------------------------------------------------------ */
  /* Rutas: mismas que la API de PHP                                     */
  /* ------------------------------------------------------------------ */

  const routes = {
    'auth.php': {
      status: () => ({ user: db.session.admin ? db.admin.email : null, needsSetup: !db.admin.password, email: db.admin.email, pendingPin: !!db.pendingPin, sentTo: 'ad•••@thethinggame.com' }),
      setup: (b) => {
        if (db.admin.password) throw httpError(409, 'La contraseña ya fue configurada');
        if (String(b.password || '').length < 8) throw httpError(400, 'La contraseña debe tener al menos 8 caracteres');
        db.admin.password = b.password;
        return newPin();
      },
      login: (b) => {
        if (String(b.email || '').toLowerCase() !== db.admin.email || b.password !== db.admin.password || !db.admin.password) throw httpError(401, 'Credenciales incorrectas');
        return newPin();
      },
      resend: () => {
        if (!db.pendingPin) throw httpError(401, 'Vuelve a escribir tu contraseña');
        return newPin();
      },
      verify: (b) => {
        if (!db.pendingPin || !db.pin || db.pin.expires < Date.now() || db.pin.tries >= 5) {
          db.pendingPin = false;
          throw httpError(401, 'El PIN caducó o se usó demasiadas veces. Vuelve a entrar.');
        }
        if (String(b.pin) !== db.pin.pin) { db.pin.tries++; throw httpError(400, 'PIN incorrecto'); }
        db.pin = null;
        db.pendingPin = false;
        db.session.admin = true;
        db.session.member = staffMember().id;
        db.session.staff = true;
        return { user: db.admin.email };
      },
      logout: () => {
        db.session.admin = false;
        db.pendingPin = false;
        if (db.session.staff) { db.session.member = null; db.session.staff = false; }
        return { ok: true };
      },
      password: (b) => {
        needAdmin();
        if (b.current !== db.admin.password) throw httpError(400, 'La contraseña actual no es correcta');
        if (String(b.next || '').length < 8) throw httpError(400, 'La nueva contraseña debe tener al menos 8 caracteres');
        db.admin.password = b.next;
        return { ok: true };
      },
    },

    'content.php': {
      '': (b, q) => {
        if (q.get('id')) {
          const it = db.content.find((i) => i.id === q.get('id'));
          if (!it) throw httpError(404, 'No encontrado');
          return pubItem(it);
        }
        return db.content.filter((i) => !q.get('type') || i.type === q.get('type'))
          .sort((a, b2) => b2.createdAt.localeCompare(a.createdAt)).map(pubItem);
      },
      create: (b) => {
        needAdmin();
        if (!b.title) throw httpError(400, 'El título es obligatorio');
        const t = now();
        const it = { id: id(), type: b.type, title: b.title, summary: b.summary || '', body: b.body || '', image: b.image || '', link: b.link || '',
          platform: b.platform || '', status: b.status || '', value: b.value || '', featured: !!b.featured, appKey: b.appKey || '',
          downloads: String(b.downloads || '').replace(/\D/g, ''), playPackage: b.playPackage || '', videoUrl: b.videoUrl || '',
          price: String(b.price || '').replace(',', '.').replace(/[^\d.]/g, ''), currency: b.currency || 'USD', sizes: b.sizes || '', game: b.type === 'news' ? (b.game || '') : '', createdAt: t, updatedAt: t };
        if (it.type === 'video' && !it.videoUrl) throw httpError(400, 'Falta el vídeo (enlace de YouTube/Vimeo)');
        db.content.push(it);
        let emailed = 0;
        if (b.notify) emailed = notify(`${{ app: 'Nuevo juego', news: 'Nueva noticia', data: 'Nuevo dato', image: 'Nueva imagen en la galería', video: 'Nuevo vídeo', product: 'Nuevo en la tienda' }[it.type]}: ${it.title}`, it.summary, it.type === 'data' ? '' : it.id, it.type);
        return { ...it, _emailed: emailed };
      },
      update: (b, q) => {
        needAdmin();
        const it = db.content.find((i) => i.id === q.get('id'));
        if (!it) throw httpError(404, 'No encontrado');
        if (!b.title) throw httpError(400, 'El título es obligatorio');
        ['title', 'summary', 'body', 'image', 'link', 'platform', 'status', 'value', 'appKey', 'playPackage', 'videoUrl', 'sizes', 'game'].forEach((k) => { it[k] = b[k] || ''; });
        it.price = String(b.price || '').replace(',', '.').replace(/[^\d.]/g, '');
        it.currency = b.currency || 'USD';
        it.downloads = String(b.downloads || '').replace(/\D/g, '');
        it.featured = !!b.featured;
        it.updatedAt = now();
        let emailed = 0;
        if (b.notify) emailed = notify(`Actualizado: ${it.title}`, it.summary, it.type === 'data' ? '' : it.id, it.type);
        return { ...it, _emailed: emailed };
      },
      delete: (b, q) => {
        needAdmin();
        const iid = q.get('id');
        db.content = db.content.filter((i) => i.id !== iid);
        db.comments = db.comments.filter((c) => c.item !== iid);
        Object.values(db.votes).forEach((v) => ['best', 'played'].forEach((c) => { if (v[c] === iid) delete v[c]; }));
        return { ok: true };
      },
    },

    'members.php': {
      me: () => {
        const m = member();
        return m ? { member: pubMember(m), unread: memberNotifications(m).unread } : { member: null, unread: 0 };
      },
      register: (b) => {
        const name = String(b.name || '').trim();
        const email = String(b.email || '').trim().toLowerCase();
        if (!/^[\p{L}\p{N} _.-]{3,24}$/u.test(name)) throw httpError(400, 'El nombre de jugador debe tener de 3 a 24 letras o números');
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw httpError(400, 'El correo no es válido');
        if (String(b.password || '').length < 8) throw httpError(400, 'La contraseña debe tener al menos 8 caracteres');
        if (db.members.some((m) => m.email === email)) throw httpError(409, 'Ya existe una cuenta con ese correo');
        if (email === db.admin.email) throw httpError(400, 'Ese correo está reservado');
        if (reserved(name)) throw httpError(400, 'Ese nombre de jugador está reservado');
        if (db.members.some((m) => m.name.toLowerCase() === name.toLowerCase())) throw httpError(409, 'Ese nombre de jugador ya está ocupado');
        if (!b.accept) throw httpError(400, 'Debes aceptar los Términos y la Política de privacidad');
        needCaptcha(b.captcha);
        const m = { id: id(), name, email, password: b.password, emailNotify: !!b.emailNotify, createdAt: now(), lastSeen: '', consent: { terms: '2026-10', at: now() } };
        db.members.push(m);
        db.session.member = m.id;
        return { member: pubMember(m), unread: 1 };
      },
      login: (b) => {
        needCaptcha(b.captcha);
        if (String(b.email || '').trim().toLowerCase() === db.admin.email) return { staffLogin: true };
        const m = db.members.find((x) => !x.staff && x.email === String(b.email || '').trim().toLowerCase() && x.password === b.password);
        if (!m) throw httpError(401, 'Correo o contraseña incorrectos');
        db.session.member = m.id;
        return { member: pubMember(m), unread: memberNotifications(m).unread };
      },
      logout: () => {
        if (db.session.staff) { db.session.admin = false; db.session.staff = false; }
        db.session.member = null;
        return { ok: true };
      },
      prefs: (b) => {
        const m = needMember();
        if ('emailNotify' in b) m.emailNotify = !!b.emailNotify;
        return { member: pubMember(m) };
      },
      notifications: () => memberNotifications(needMember()),
      seen: () => { needMember().lastSeen = now(); return { ok: true }; },
      export: () => {
        const m = needMember();
        const title = (iid) => (db.content.find((i) => i.id === iid) || {}).title || iid;
        return {
          exportado: now(), web: location.href,
          cuenta: { nombre: m.name, correo: m.email, creada: m.createdAt, avisosPorCorreo: !!m.emailNotify, consentimiento: m.consent || null },
          'reseñasYComentarios': db.comments.filter((c) => c.member === m.id).map((c) => ({ sobre: title(c.item), estrellas: c.rating, texto: c.text, creado: c.createdAt })),
          votos: Object.fromEntries(Object.entries(db.votes[m.id] || {}).map(([k, v]) => [k, title(v)])),
          consultasDeSoporte: db.tickets.filter((t) => t.email === m.email).map((t) => ({ codigo: t.code, asunto: t.subject, estado: t.status, mensajes: t.messages })),
        };
      },
      delete: (b) => {
        const m = needMember();
        if (m.staff) throw httpError(400, 'La cuenta del staff no se puede borrar');
        if (b.password !== m.password) throw httpError(400, 'La contraseña no es correcta');
        const mine = db.comments.filter((c) => c.member === m.id).map((c) => c.id);
        db.members = db.members.filter((x) => x.id !== m.id);
        db.comments = db.comments.filter((c) => c.member !== m.id);
        db.reports = db.reports.filter((r) => r.member !== m.id && !mine.includes(r.comment));
        delete db.votes[m.id];
        db.session.member = null;
        return { ok: true };
      },
    },

    'captcha.php': {
      new: () => {
        const types = Object.keys(SPRITES);
        const target = types[rnd(0, types.length - 1)];
        const others = types.filter((t) => t !== target);
        const cells = [...Array(9).keys()].sort(() => Math.random() - 0.5);
        const answer = cells.slice(0, rnd(2, 4)).sort((a, b) => a - b);
        const grid = [...Array(9).keys()].map((i) => (answer.includes(i) ? target : others[rnd(0, others.length - 1)]));
        const cid = id();
        db.captcha = { id: cid, answer, exp: Date.now() + 50000, at: Date.now() };
        return { id: cid, prompt: `TOCA ${SPRITES[target].label}`, image: captchaImage(grid), cols: 3, rows: 3, seconds: 45 };
      },
      verify: (b) => {
        const ch = db.captcha;
        db.captcha = null;
        if (!ch || ch.id !== b.id) throw httpError(400, 'La partida terminó. Juega otra.');
        if (ch.exp < Date.now()) throw httpError(400, '¡Se acabó el tiempo! Juega otra.');
        const cells = [...new Set((b.cells || []).map(Number))].sort((x, y) => x - y);
        if (Date.now() - ch.at < 1000 || cells.join() !== ch.answer.join()) throw httpError(400, 'Fallaste. ¡Inténtalo otra vez!');
        const token = id() + id();
        db.captchaTokens.push({ token, exp: Date.now() + 600000 });
        return { token };
      },
    },

    'settings.php': {
      '': () => ({ ...DEFAULT_SETTINGS, ...Object.fromEntries(Object.entries(db.settings).filter(([, v]) => v !== '')) }),
      save: (b) => {
        needAdmin();
        const keys = ['legalName', 'tradeName', 'taxId', 'address', 'country', 'jurisdiction', 'registry', 'email', 'supportEmail', 'privacyEmail', 'minAge', ...Object.keys(SOCIAL_PATTERNS)];
        keys.filter((k) => k in b).forEach((k) => {
          let v = String(b[k] || '').trim();
          if (SOCIAL_PATTERNS[k] && v) {
            v = socialUrl(k, v);
            if (!v) throw httpError(400, `No entendimos el enlace de ${k}. Pega la dirección completa (https://…) o tu @usuario.`);
          }
          db.settings[k] = v;
        });
        db.settings.updatedAt = now();
        return { ...DEFAULT_SETTINGS, ...db.settings };
      },
    },

    'support.php': {
      create: (b) => {
        if (b.website) throw httpError(400, 'Envío no permitido');
        const email = String(b.email || '').trim().toLowerCase();
        if (String(b.name || '').trim().length < 2) throw httpError(400, 'Escribe tu nombre');
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw httpError(400, 'El correo no es válido');
        if (!SUPPORT_CATEGORIES[b.category]) throw httpError(400, 'Elige el tipo de consulta');
        if (String(b.subject || '').trim().length < 3) throw httpError(400, 'Escribe un asunto');
        if (String(b.message || '').trim().length < 10) throw httpError(400, 'Cuéntanos un poco más (mínimo 10 caracteres)');
        if (!b.accept) throw httpError(400, 'Debes aceptar la política de privacidad');
        needCaptcha(b.captcha);
        const hex = () => id().slice(0, 4).toUpperCase();
        const game = db.content.find((i) => i.id === b.game && i.type === 'app');
        let text = String(b.message).trim();
        if (b.order) text = `Pedido / referencia: ${b.order}\n\n${text}`;
        if (game) text = `Juego: ${game.title}\n${text}`;
        const t = now();
        const ticket = { id: id(), code: `TT-${hex()}-${hex()}`, name: String(b.name).trim(), email, category: b.category, categoryLabel: SUPPORT_CATEGORIES[b.category],
          subject: String(b.subject).trim(), status: 'open', createdAt: t, updatedAt: t, messages: [{ from: 'user', text, at: t }] };
        db.tickets.unshift(ticket);
        return { code: ticket.code, mailed: false, demo: true };
      },
      lookup: (b) => {
        const tk = findTicket(b);
        if (!tk) throw httpError(404, 'No encontramos una consulta con ese código y correo');
        return pubTicket(tk);
      },
      reply: (b) => {
        const tk = findTicket(b);
        if (!tk) throw httpError(404, 'No encontramos una consulta con ese código y correo');
        if (String(b.message || '').trim().length < 2) throw httpError(400, 'Escribe tu mensaje');
        tk.messages.push({ from: 'user', text: String(b.message).trim(), at: now() });
        tk.status = 'open';
        tk.updatedAt = now();
        return pubTicket(tk);
      },
      list: () => { needAdmin(); return { tickets: db.tickets, categories: SUPPORT_CATEGORIES }; },
      answer: (b) => {
        needAdmin();
        const tk = db.tickets.find((t) => t.id === b.id);
        if (!tk) throw httpError(404, 'No encontrado');
        if (String(b.message || '').trim().length < 2) throw httpError(400, 'Escribe la respuesta');
        tk.messages.push({ from: 'staff', text: String(b.message).trim(), at: now() });
        tk.status = b.close ? 'closed' : 'answered';
        tk.updatedAt = now();
        return { ticket: tk, mailed: false };
      },
      status: (b) => {
        needAdmin();
        const tk = db.tickets.find((t) => t.id === b.id);
        if (!tk) throw httpError(404, 'No encontrado');
        tk.status = b.status;
        tk.updatedAt = now();
        return { ticket: tk };
      },
      delete: (b) => { needAdmin(); db.tickets = db.tickets.filter((t) => t.id !== b.id); return { ok: true }; },
    },

    'community.php': {
      summary: () => summary(),
      comments: (b, q) => {
        const m = member();
        return db.comments.filter((c) => c.item === q.get('item'))
          .sort((a, b2) => b2.createdAt.localeCompare(a.createdAt))
          .map((c) => {
            const author = db.members.find((x) => x.id === c.member);
            const mine = !!m && c.member === m.id;
            return { id: c.id, name: author ? author.name : 'JUGADOR BORRADO', staff: !!(author && author.staff), rating: c.rating, text: c.text, createdAt: c.createdAt, updatedAt: c.updatedAt, mine, canDelete: mine || db.session.admin };
          });
      },
      comment: (b) => {
        const m = needMember();
        const it = db.content.find((i) => i.id === b.item);
        if (!it || !['app', 'news'].includes(it.type)) throw httpError(404, 'Ese juego o noticia ya no existe');
        const text = String(b.text || '').trim().slice(0, 1000);
        if (text.length < 2) throw httpError(400, 'Escribe algo en tu mensaje');
        const isGame = it.type === 'app';
        const rating = Number(b.rating) || 0;
        if (isGame && (rating < 1 || rating > 5)) throw httpError(400, 'Elige de 1 a 5 estrellas');
        const t = now();
        const existing = isGame && db.comments.find((c) => c.item === it.id && c.member === m.id);
        if (existing) {
          Object.assign(existing, { text, rating, updatedAt: t });
          return { id: existing.id, updated: true };
        }
        const c = { id: id(), item: it.id, member: m.id, rating: isGame ? rating : 0, text, createdAt: t, updatedAt: t };
        db.comments.push(c);
        return { id: c.id, updated: false };
      },
      delete_comment: (b) => {
        const m = member();
        const c = db.comments.find((x) => x.id === b.id);
        if (!c) throw httpError(404, 'No encontrado');
        if (!db.session.admin && (!m || c.member !== m.id)) throw httpError(403, 'No puedes borrar este comentario');
        db.comments = db.comments.filter((x) => x !== c);
        db.reports = db.reports.filter((r) => r.comment !== c.id);
        return { ok: true };
      },
      report: (b) => {
        const m = needMember();
        const reasons = { spam: 'Spam o publicidad', ofensivo: 'Insultos u odio', acoso: 'Acoso', spoiler: 'Spoiler', ilegal: 'Contenido ilegal', otro: 'Otro motivo' };
        if (!reasons[b.reason]) throw httpError(400, 'Elige un motivo');
        if (!db.comments.some((c) => c.id === b.id)) throw httpError(404, 'Ese comentario ya no existe');
        if (!db.reports.some((r) => r.comment === b.id && r.member === m.id)) db.reports.push({ id: id(), comment: b.id, member: m.id, reason: reasons[b.reason], createdAt: now() });
        return { ok: true };
      },
      vote: (b) => {
        const m = needMember();
        const it = db.content.find((i) => i.id === b.item && i.type === 'app');
        if (!it) throw httpError(404, 'Ese juego ya no existe');
        if (!['best', 'played'].includes(b.category)) throw httpError(400, 'Categoría inválida');
        db.votes[m.id] = { ...(db.votes[m.id] || {}), [b.category]: it.id };
        return summary();
      },
    },

    'stats.php': {
      overview: (b, q) => {
        needAdmin();
        const days = [7, 30, 90].includes(Number(q.get('days'))) ? Number(q.get('days')) : 30;
        const s = summary();
        const lp = db.levelplay.configured ? levelplayDemo(days) : null;
        const exampleDl = (pkg) => (pkg ? 1000 + ([...pkg].reduce((h, ch) => h + ch.charCodeAt(0), 0) * 37) % 20000 : null);
        const games = db.content.filter((i) => i.type === 'app').map((g) => {
          const play = db.googleplay.configured ? exampleDl(g.playPackage) : null;
          const other = g.downloads === '' ? null : Number(g.downloads);
          return {
          id: g.id, title: g.title, image: g.image, platform: g.platform, playPackage: g.playPackage || '',
          downloads: play == null && other == null ? null : (play || 0) + (other || 0), downloadsPlay: play, downloadsOther: other,
          installs30: play == null ? null : Math.round(play / 12), playError: null, appKey: g.appKey,
          rating: s.ratings[g.id] ? s.ratings[g.id].avg : null, reviews: s.ratings[g.id] ? s.ratings[g.id].count : 0,
          comments: s.comments[g.id] || 0, votesBest: s.votes.best[g.id] || 0, votesPlayed: s.votes.played[g.id] || 0,
          levelplay: lp && g.appKey ? lp.apps[g.appKey] || null : null,
        };
        });
        const ratings = db.comments.filter((c) => c.rating).map((c) => c.rating);
        const linked = games.map((g) => g.appKey).filter(Boolean);
        return {
          days,
          community: {
            members: db.members.length, newMembers7d: db.members.filter((m) => m.createdAt >= daysAgo(7)).length,
            subscribed: db.members.filter((m) => m.emailNotify).length, comments: db.comments.length, reviews: ratings.length,
            avgRating: ratings.length ? Math.round((ratings.reduce((a, c) => a + c, 0) / ratings.length) * 100) / 100 : null,
            votes: Object.keys(db.votes).length,
          },
          games,
          totalDownloads: games.reduce((n, g) => n + (g.downloads || 0), 0),
          levelplay: {
            configured: db.levelplay.configured, error: null, fetchedAt: db.levelplay.fetchedAt,
            totals: lp && lp.totals, daily: lp ? lp.daily : [], range: lp && lp.range,
            unlinkedApps: lp ? Object.values(lp.apps).filter((a) => !linked.includes(a.appKey)) : [],
            apps: lp ? Object.values(lp.apps) : [],
            demoNote: db.levelplay.configured ? (db.levelplay.realCheck || 'MODO DEMO: estos números son de EJEMPLO, no son tus datos. Para ver tus datos reales de LevelPlay la web tiene que estar en un servidor con PHP (Hostinger o «probar-con-php» en tu computadora).') : null,
          },
          googleplay: { configured: db.googleplay.configured, error: null },
        };
      },
      levelplay_save: async (b) => {
        needAdmin();
        if (!b.secretKey || !b.refreshToken) throw httpError(400, 'Faltan la Secret Key o el Refresh Token');
        // Intento real desde el navegador: LevelPlay no lo permite sin servidor (CORS)
        let realCheck = null;
        try {
          const ctl = new AbortController();
          setTimeout(() => ctl.abort(), 6000);
          const r = await fetch('https://platform.ironsrc.com/partners/publisher/auth', { headers: { secretkey: b.secretKey, refreshToken: b.refreshToken }, signal: ctl.signal });
          realCheck = r.ok
            ? 'MODO DEMO: tus claves de LevelPlay son correctas, pero la demo solo muestra números de EJEMPLO. Súbela a un servidor con PHP para ver los reales.'
            : `MODO DEMO: LevelPlay rechazó las claves (HTTP ${r.status}). Los números son de EJEMPLO.`;
        } catch { /* bloqueado por el navegador: se usa el aviso general */ }
        db = load();
        db.levelplay = { configured: true, fetchedAt: now(), realCheck };
        return { ok: true };
      },
      levelplay_debug: () => { throw httpError(400, 'En el modo demo no hay conexión real con LevelPlay: el navegador bloquea su API. Usa Hostinger o «probar-con-php».'); },
      googleplay_save: (b) => {
        needAdmin();
        if (!b.serviceAccount || !b.bucket) throw httpError(400, 'Faltan el JSON de la cuenta de servicio o el bucket');
        try { JSON.parse(b.serviceAccount); } catch { throw httpError(400, 'El JSON de la cuenta de servicio no es válido'); }
        db.googleplay = { configured: true };
        return { ok: true };
      },
      googleplay_clear: () => { needAdmin(); db.googleplay = { configured: false }; return { ok: true }; },
      play_downloads: (b, q) => {
        needAdmin();
        if (!db.googleplay.configured) throw httpError(400, 'Google Play no está conectado (pestaña Estadísticas)');
        const pkg = q.get('package') || '';
        const total = 1000 + ([...pkg].reduce((h, ch) => h + ch.charCodeAt(0), 0) * 37) % 20000;
        return { total, last30: Math.round(total / 12), demo: true };
      },
      levelplay_refresh: () => { needAdmin(); db.levelplay.fetchedAt = now(); return { ok: true }; },
      levelplay_clear: () => { needAdmin(); db.levelplay = { configured: false, fetchedAt: null }; return { ok: true }; },
      members: () => {
        needAdmin();
        return db.members.map((m) => ({ id: m.id, name: m.name, email: m.email, emailNotify: !!m.emailNotify, createdAt: m.createdAt,
          comments: db.comments.filter((c) => c.member === m.id).length, voted: !!db.votes[m.id] })).reverse();
      },
      delete_member: (b) => {
        needAdmin();
        db.members = db.members.filter((m) => m.id !== b.id);
        db.comments = db.comments.filter((c) => c.member !== b.id);
        delete db.votes[b.id];
        if (db.session.member === b.id) db.session.member = null;
        return { ok: true };
      },
      comments: () => {
        needAdmin();
        return db.comments.slice().sort((a, b2) => b2.createdAt.localeCompare(a.createdAt)).map((c) => {
          const it = db.content.find((i) => i.id === c.item);
          const m = db.members.find((x) => x.id === c.member);
          return { id: c.id, item: c.item, itemTitle: it ? it.title : '—', itemType: it ? it.type : '', name: m ? m.name : 'JUGADOR BORRADO', rating: c.rating, text: c.text, createdAt: c.createdAt,
            reports: db.reports.filter((r) => r.comment === c.id).map((r) => r.reason) };
        });
      },
      notifications: () => { needAdmin(); return db.notifications.slice(0, 50); },
      dismiss_reports: (b) => { needAdmin(); db.reports = db.reports.filter((r) => r.comment !== b.id); return { ok: true }; },
      notify: (b) => {
        needAdmin();
        if (!String(b.title || '').trim()) throw httpError(400, 'Escribe un título para el aviso');
        return { ok: true, emailed: notify(b.title, b.text, b.item, 'aviso') };
      },
    },
  };

  async function demoApi(path, options = {}) {
    const url = new URL(path, 'http://demo.local/');
    const file = url.pathname.split('/').pop();
    const action = url.searchParams.get('action') || '';
    const handler = routes[file] && routes[file][action];
    await new Promise((r) => setTimeout(r, 120));          // pequeña espera, como un servidor real
    if (!handler) throw httpError(404, 'Ruta no encontrada (demo)');
    db = load();
    const result = await handler(options.json || {}, url.searchParams);
    save();
    return JSON.parse(JSON.stringify(result));
  }

  /* Imágenes en la demo: se reducen y se guardan como texto dentro del navegador */
  function imageToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 1000 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        resolve(c.toDataURL('image/webp', 0.8));
      };
      img.onerror = () => reject(new Error('No se pudo leer la imagen'));
      img.src = URL.createObjectURL(file);
    });
  }

  window.TT.api = demoApi;
  window.TT.demo = { imageToDataUrl, reset() { localStorage.removeItem(KEY); location.reload(); } };

  // Aviso visible para que no se confunda con la web real
  function banner() {
    const el = document.createElement('div');
    el.className = 'demo-banner';
    el.innerHTML = '<b>MODO DEMO</b><span>Sin servidor: los datos solo se guardan en este navegador.</span><button type="button">Reiniciar demo</button>';
    el.querySelector('button').addEventListener('click', () => {
      if (window.confirm('¿Borrar todos los datos de la demo (jugadores, reseñas, publicaciones)?')) window.TT.demo.reset();
    });
    document.body.appendChild(el);
  }
  if (document.body) banner();
  else document.addEventListener('DOMContentLoaded', banner);
})();
