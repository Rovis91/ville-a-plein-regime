// Multijoueur en ligne : WebRTC pair-à-pair par PeerJS (peerjs.min.js, signalisation par le serveur public gratuit de PeerJS ; aucun serveur à nous).
// Un hôte fait tourner stepRace pour tout le monde ; chaque invité lui envoie son entrée et reçoit l'état des voitures, qu'il affiche avec 100 ms de retard en interpolant.
// API pour game.js (aucun rendu ici) :
//   NET.heberger(ev) -> code du salon (4 lettres) ; NET.rejoindre(code, ev). ev(m) reçoit les messages : { t: 'salon', n } (nombre de joueurs, hôte compris),
//     { t: 'moi', i } (invité : sa place, 1..3 ; l'hôte est 0), { t: 'go', carte, n } (l'hôte lance), { t: 'erreur', msg }, { t: 'parti', i } (un joueur a quitté).
//   NET.go(carte)          hôte : lance la course chez tous (puis chacun : newRace(T, 3, lvls, el, { humains: n }), la même pour tous).
//   NET.entree(inp)        invité : à chaque image, son entrée de conduite. Côté hôte, NET.ins[i] = dernière entrée de l'invité i (nulle tant que rien n'est arrivé : le pilote automatique le conduit).
//   NET.diffuse(R)         hôte : l'état de la course (appelé à chaque image, envoyé 20 fois par seconde).
//   NET.applique(R)        invité : à chaque image, à la place de stepRace ; pose sur R l'état interpolé.
//   NET.fermer()           quitte le salon.
// Le lien ?salon=ABCD ouvre directement le salon (voir game.js).
(function (G) {
  const PRE = 'vpr-salon-', MAXJ = 4, DT_ENVOI = 0.05, RETARD = 0.1;
  const NET = { role: null, code: '', n: 1, moi: 0, ins: [], peer: null, cx: [], ev: null, snaps: [], tEnv: 0 };
  const lettres = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.random() * 24 | 0]).join(''); // sans I ni O : on les confond avec 1 et 0
  const dit = m => NET.ev && NET.ev(m);
  const tous = m => NET.cx.forEach(c => c && c.open && c.send(m));
  const salon = () => { NET.n = 1 + NET.cx.filter(Boolean).length; tous({ t: 'salon', n: NET.n }); dit({ t: 'salon', n: NET.n }); };

  // entrée reçue d'un invité : validée champ par champ (on ne pose jamais sur la course ce qui vient du réseau sans le borner)
  const num = (v, a, b) => typeof v === 'number' && isFinite(v) ? Math.min(b, Math.max(a, v)) : 0;
  const propre = m => m && typeof m === 'object' ? { steer: num(m.steer, -1, 1), gas: num(m.gas, 0, 1), brake: num(m.brake, 0, 1), hand: !!m.hand, nitro: !!m.nitro } : null;

  function heberger(ev, essai = 0) {
    fermer(); NET.ev = ev; NET.role = 'hote'; NET.moi = 0; NET.code = lettres();
    const p = NET.peer = new Peer(PRE + NET.code);
    p.on('error', e => e.type === 'unavailable-id' && essai < 5 ? heberger(ev, essai + 1) : dit({ t: 'erreur', msg: String(e.type || e) })); // code déjà pris : un autre
    p.on('connection', c => {
      const i = [1, 2, 3].find(k => !NET.cx[k]);
      c.on('open', () => {
        if (!i || NET.enCourse) { c.send({ t: 'erreur', msg: i ? 'COURSE EN COURS' : 'SALON PLEIN' }); setTimeout(() => c.close(), 500); return; }
        NET.cx[i] = c; c.send({ t: 'moi', i }); salon();
      });
      c.on('data', m => { if (i && NET.cx[i] === c && m && m.t === 'in') NET.ins[i] = propre(m.i); });
      c.on('close', () => { if (NET.cx[i] === c) { NET.cx[i] = null; NET.ins[i] = null; salon(); dit({ t: 'parti', i }); } });
    });
    return NET.code;
  }

  function rejoindre(code, ev) {
    fermer(); NET.ev = ev; NET.role = 'invite'; NET.code = String(code).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
    const p = NET.peer = new Peer();
    p.on('error', e => dit({ t: 'erreur', msg: e.type === 'peer-unavailable' ? 'SALON INTROUVABLE' : String(e.type || e) }));
    p.on('open', () => {
      const c = NET.cx[0] = p.connect(PRE + NET.code, { reliable: true }); // fiable : le « go » ne doit pas se perdre (shortcut: les états aussi sont renvoyés, passer à un second canal non fiable si ça saccade)
      c.on('data', m => {
        if (!m || typeof m !== 'object') return;
        if (m.t === 'etat') { NET.snaps.push(m); if (NET.snaps.length > 30) NET.snaps.shift(); return; }
        if (m.t === 'moi') NET.moi = m.i; if (m.t === 'salon') NET.n = m.n; if (m.t === 'go') NET.snaps.length = 0;
        dit(m);
      });
      c.on('close', () => { if (NET.role === 'invite') dit({ t: 'erreur', msg: 'HOTE PARTI' }); });
    });
  }

  function fermer() { NET.role = null; NET.cx.forEach(c => c && c.close()); NET.cx = []; NET.ins = []; NET.snaps = []; NET.n = 1; NET.enCourse = false; if (NET.peer) NET.peer.destroy(); NET.peer = null; }
  function go(carte) { NET.enCourse = true; NET.ins = []; tous({ t: 'go', carte, n: NET.n }); }
  let tIn = 0;
  function entree(inp) { const c = NET.cx[0], t = performance.now(); if (c && c.open && t - tIn > 15) { tIn = t; c.send({ t: 'in', i: inp }); } } // ~60 par seconde au plus

  // ---------- état des voitures : fonctions pures, testées par node test.js ----------
  // tout champ nombre ou booléen de la voiture part, sauf ceux que game.js pose lui-même sur chaque poste (livrée, tours affichés, boîte manuelle)
  const LOCAL = new Set(['k', 'rl', 'rlT', 'bl', 'manual']);
  const emballe = R => ({ t: 'etat', rt: R.t, done: R.done, cars: R.cars.map(c => { const o = {}; for (const k in c) if (!LOCAL.has(k) && (typeof c[k] === 'number' || typeof c[k] === 'boolean')) o[k] = c[k]; return o; }) });
  const ang = (a, b, u) => a + (((b - a) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI) * u; // par le plus court chemin
  // pose sur R l'état au temps t de la course, interpolé entre les deux états qui l'encadrent (au-delà du dernier : le dernier, sans extrapoler)
  function pose(R, snaps, t) {
    if (!snaps.length) return;
    let b = snaps.findIndex(s => s.rt >= t); if (b < 0) b = snaps.length - 1;
    const B = snaps[b], A = snaps[Math.max(0, b - 1)], u = B.rt > A.rt ? Math.min(1, Math.max(0, (t - A.rt) / (B.rt - A.rt))) : 1;
    R.t = A.rt + (B.rt - A.rt) * u; R.done = B.done;
    B.cars.forEach((s, i) => { const c = R.cars[i], a = A.cars[i] || s; if (!c) return; Object.assign(c, s);
      for (const k of ['x', 'y', 'z', 'vx', 'vz', 'dist']) c[k] = a[k] + (s[k] - a[k]) * u; c.th = ang(a.th, s.th, u); });
  }

  function diffuse(R) { const t = performance.now() / 1000; if (t - NET.tEnv < DT_ENVOI) return; NET.tEnv = t; tous(emballe(R)); }
  // l'horloge de l'invité suit le dernier état reçu, RETARD derrière : il a presque toujours deux états pour interpoler
  function applique(R) { const s = NET.snaps; if (s.length) pose(R, s, s[s.length - 1].rt - RETARD); }

  Object.assign(NET, { heberger, rejoindre, fermer, go, entree, diffuse, applique, emballe, pose, propre, MAXJ });
  G.NET = NET;
})(typeof window !== 'undefined' ? window : globalThis);
