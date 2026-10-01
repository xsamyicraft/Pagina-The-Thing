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
      featured: false, appKey: '', downloads: '', ...f, createdAt: daysAgo(days), updatedAt: daysAgo(days),
    });
    return {
      admin: { email: 'admin@thethinggame.com', password: '' },
      session: { admin: false, member: null },
      members: [],
      comments: [],
      votes: {},
      notifications: [],
      levelplay: { configured: false, fetchedAt: null },
      content: [
        item(2, { type: 'app', title: 'PROYECTO: THE THING', platform: 'PC', status: 'En desarrollo', featured: true, appKey: 'demo1a2b3', downloads: '15300',
          summary: 'Nuestro primer título. Un survival de terror retro donde nada es lo que parece… ni siquiera el gato.',
          body: 'Estamos trabajando en nuestro primer juego. Muy pronto compartiremos más detalles, capturas y una demo jugable.\n\nSíguenos para no perderte nada.' }),
        item(1, { type: 'news', title: 'Bienvenidos a THE THING', featured: true,
          summary: 'Nace un nuevo estudio independiente de videojuegos. Esto es lo que viene.',
          body: 'Hoy encendemos la máquina por primera vez.\n\n**THE THING** es un estudio nuevo con una idea clara: hacer juegos raros, memorables y con alma de cartucho viejo.' }),
        item(0, { type: 'news', title: 'Diario de desarrollo #0', summary: 'Primeros bocetos, primeras ideas y demasiadas tazas de café.',
          body: 'Esta es una noticia de ejemplo. Puedes editarla o borrarla desde el panel de administración.' }),
        item(3, { type: 'data', title: 'Proyectos en marcha', value: '1', summary: 'Y contando.' }),
        item(3, { type: 'data', title: 'Tazas de café', value: '9999', summary: 'Estimación conservadora.' }),
        item(3, { type: 'data', title: 'Bugs aplastados', value: '404', summary: 'Los que encontramos.' }),
        item(3, { type: 'data', title: 'Año de fundación', value: String(new Date().getFullYear()), summary: 'Insert coin.' }),
        item(4, { type: 'image', title: 'El logo', summary: 'La cosa nos observa.', image: 'assets/img/logo.webp' }),
      ],
    };
  }

  function load() {
    try {
      const db = JSON.parse(localStorage.getItem(KEY));
      if (db && db.content) return db;
    } catch { /* datos dañados: se reinician */ }
    return seed();
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
  const member = () => db.members.find((m) => m.id === db.session.member) || null;
  const pubMember = (m) => ({ id: m.id, name: m.name, email: m.email, emailNotify: !!m.emailNotify, createdAt: m.createdAt });
  const pubItem = (i) => {
    if (db.session.admin) return { ...i };
    const { appKey, downloads, ...rest } = i;
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

  /* Datos simulados de LevelPlay: deterministas para cada app */
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
        const b = byApp[a.appKey] || (byApp[a.appKey] = { appKey: a.appKey, appName: a.appName, platform: a.platform, revenue: 0, impressions: 0, activeUsers: 0, days: 0 });
        b.revenue += rev; b.impressions += imp; b.activeUsers += au; b.days++;
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
  /* Rutas: mismas que la API de PHP                                     */
  /* ------------------------------------------------------------------ */

  const routes = {
    'auth.php': {
      status: () => ({ user: db.session.admin ? db.admin.email : null, needsSetup: !db.admin.password, email: db.admin.email }),
      setup: (b) => {
        if (db.admin.password) throw httpError(409, 'La contraseña ya fue configurada');
        if (String(b.password || '').length < 8) throw httpError(400, 'La contraseña debe tener al menos 8 caracteres');
        db.admin.password = b.password;
        db.session.admin = true;
        return { user: db.admin.email };
      },
      login: (b) => {
        if (String(b.email || '').toLowerCase() !== db.admin.email || b.password !== db.admin.password || !db.admin.password) throw httpError(401, 'Credenciales incorrectas');
        db.session.admin = true;
        return { user: db.admin.email };
      },
      logout: () => { db.session.admin = false; return { ok: true }; },
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
          downloads: String(b.downloads || '').replace(/\D/g, ''), createdAt: t, updatedAt: t };
        db.content.push(it);
        let emailed = 0;
        if (b.notify) emailed = notify(`${{ app: 'Nuevo juego', news: 'Nueva noticia', data: 'Nuevo dato', image: 'Nueva imagen en la galería' }[it.type]}: ${it.title}`, it.summary, it.type === 'data' ? '' : it.id, it.type);
        return { ...it, _emailed: emailed };
      },
      update: (b, q) => {
        needAdmin();
        const it = db.content.find((i) => i.id === q.get('id'));
        if (!it) throw httpError(404, 'No encontrado');
        if (!b.title) throw httpError(400, 'El título es obligatorio');
        ['title', 'summary', 'body', 'image', 'link', 'platform', 'status', 'value', 'appKey'].forEach((k) => { it[k] = b[k] || ''; });
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
        if (db.members.some((m) => m.name.toLowerCase() === name.toLowerCase())) throw httpError(409, 'Ese nombre de jugador ya está ocupado');
        const m = { id: id(), name, email, password: b.password, emailNotify: !!b.emailNotify, createdAt: now(), lastSeen: '' };
        db.members.push(m);
        db.session.member = m.id;
        return { member: pubMember(m), unread: 1 };
      },
      login: (b) => {
        const m = db.members.find((x) => x.email === String(b.email || '').trim().toLowerCase() && x.password === b.password);
        if (!m) throw httpError(401, 'Correo o contraseña incorrectos');
        db.session.member = m.id;
        return { member: pubMember(m), unread: memberNotifications(m).unread };
      },
      logout: () => { db.session.member = null; return { ok: true }; },
      prefs: (b) => {
        const m = needMember();
        if ('emailNotify' in b) m.emailNotify = !!b.emailNotify;
        return { member: pubMember(m) };
      },
      notifications: () => memberNotifications(needMember()),
      seen: () => { needMember().lastSeen = now(); return { ok: true }; },
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
            return { id: c.id, name: author ? author.name : 'JUGADOR BORRADO', rating: c.rating, text: c.text, createdAt: c.createdAt, updatedAt: c.updatedAt, mine, canDelete: mine || db.session.admin };
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
        const games = db.content.filter((i) => i.type === 'app').map((g) => ({
          id: g.id, title: g.title, image: g.image, platform: g.platform,
          downloads: g.downloads === '' ? null : Number(g.downloads), appKey: g.appKey,
          rating: s.ratings[g.id] ? s.ratings[g.id].avg : null, reviews: s.ratings[g.id] ? s.ratings[g.id].count : 0,
          comments: s.comments[g.id] || 0, votesBest: s.votes.best[g.id] || 0, votesPlayed: s.votes.played[g.id] || 0,
          levelplay: lp && g.appKey ? lp.apps[g.appKey] || null : null,
        }));
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
          },
        };
      },
      levelplay_save: (b) => {
        needAdmin();
        if (!b.secretKey || !b.refreshToken) throw httpError(400, 'Faltan la Secret Key o el Refresh Token');
        db.levelplay = { configured: true, fetchedAt: now() };
        return { ok: true };
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
          return { id: c.id, item: c.item, itemTitle: it ? it.title : '—', itemType: it ? it.type : '', name: m ? m.name : 'JUGADOR BORRADO', rating: c.rating, text: c.text, createdAt: c.createdAt };
        });
      },
      notifications: () => { needAdmin(); return db.notifications.slice(0, 50); },
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
    const result = handler(options.json || {}, url.searchParams);
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
