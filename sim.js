// Piste + physique pures (sans rendu) : partagées par le jeu et par `node test.js`.
(function (G) {
  if (!G.CARTES) require('./cartes.js'); // node : le navigateur charge cartes.js avant ce fichier
  // Tout ce qui dépend de la carte active (tracé, largeur, adhérence, voiture) vient de cartes.js ; voir ses commentaires pour le détail des champs.
  const M = G.CARTE, W = M.W, TOP = 55; // demi-largeur de route (m) ; vitesse de référence (m/s) pour le braquage et les effets visuels
  const GRIP = M.grip; // adhérence latérale maxi (m/s²) : 44 sur la ville (arcade : à fond on passe tout ce qui fait plus de 70 m de rayon), 15 à 24 ailleurs
  const CARD = M.car; // mécanique : fiche technique de la voiture de la carte
  const torque = rpm => { const x = Math.max(0, Math.min(8, rpm / 1000)), i = Math.min(7, x | 0); return CARD.tq[i] + (CARD.tq[i + 1] - CARD.tq[i]) * (x - i); };
  // Points de contrôle (x,z) en mètres, sens horaire = virages à droite. Départ en [0]. HGT = altitude de chaque point.
  const SC = M.sc, HGT = M.pts.map(p => p[2]), PTS = M.pts.map(p => [p[0] * SC, p[1] * SC]);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

  function buildTrack(THREE) {
    const curve = new THREE.CatmullRomCurve3(PTS.map((p, i) => new THREE.Vector3(p[0], HGT[i], p[1])), true, 'centripetal');
    curve.arcLengthDivisions = 4000;
    const len = curve.getLength(), n = Math.round(len / 2), P = curve.getSpacedPoints(n), S = [];
    for (let i = 0; i < n; i++) {
      const p = P[i], q = P[i + 1], dx = q.x - p.x, dz = q.z - p.z, l = Math.hypot(dx, dz);
      S.push({ x: p.x, y: p.y, z: p.z, tx: dx / l, tz: dz / l, k: 0, sl: (q.y - p.y) / l }); // sl = pente
    }
    // courbure signée (>0 = virage à droite), lissée sur ±3 échantillons
    S.forEach((s, i) => { const a = S[(i - 3 + n) % n], b = S[(i + 3) % n]; s.k = (a.tx * b.tz - a.tz * b.tx) / (6 * len / n); });
    const near = p => { let b = 0, bd = 1e9; S.forEach((s, i) => { const d = (s.x - p[0]) ** 2 + (s.z - p[1]) ** 2; if (d < bd) { bd = d; b = i; } }); return b; };
    const at = i => near(PTS[i]), TUN = M.tun || [0, 0];
    // tun : la carte a un tunnel, de t0 à t1 ; h0-h1 : secteur « chaud » pour la musique ; sp : les deux temps intermédiaires (indices d'échantillons)
    return { S, n, W, len, tun: !!M.tun, t0: at(TUN[0]), t1: at(TUN[1]), h0: at(M.chaud[0]), h1: at(M.chaud[1]), sp: M.sect.map(at) };
  }

  function newCar(T) {
    const i = T.n - 8, s = T.S[i]; // 16 m avant la ligne
    return { x: s.x, z: s.z, th: Math.atan2(s.tz, s.tx), vx: 0, vz: 0, steer: 0, yaw: 0, idx: i, dist: -8, d: 0, hit: 0, vf: 0, vl: 0,
      drift: false, slide: 0, driftT: 0, boost: 0, stun: 0, manual: false, gear: 0, lastGear: 0, shiftT: 0, rpm: CARD.idle };
  }

  // inp: {steer:-1..1 (droite>0), gas:0..1, brake:0..1, hand:bool}
  function step(c, inp, T, dt) {
    const S = T.S, n = T.n;
    c.steer += clamp(inp.steer - c.steer, -8 * dt, 8 * dt);
    let fx = Math.cos(c.th), fz = Math.sin(c.th);
    let vf = c.vx * fx + c.vz * fz, vl = c.vz * fx - c.vx * fz;
    const sp = Math.abs(vf), hand = inp.hand && sp > 12;
    // Glisse continue : sl = part de glisse (0 = accroche, 1 = pleine dérive), beta = angle de dérive.
    // Le braquage donne plus de rotation en glisse ; un couple de rappel ramène le nez vers la trajectoire,
    // donc l'angle de dérive se règle au volant et la voiture se redresse seule quand on lâche.
    const sl = clamp((Math.abs(vl) - 3) / 8, 0, 1), beta = Math.atan2(vl, Math.max(sp, 1));
    // le braquage maxi est bridé juste sous la limite d'adhérence : volant à fond = virage le plus serré possible, sans décrocher
    let w = c.steer * Math.min(1, sp / 10) * Math.min(2.3 - 1.3 * Math.min(1, sp / TOP), 0.95 * GRIP / Math.max(sp, 1)) * (1 + 0.6 * sl) + beta * 1.5 * sl;
    if (hand) w += c.steer * 0.9; // le frein à main fait pivoter
    c.yaw += (w - c.yaw) * Math.min(1, dt * lerp(14, 6, sl)); // inertie de lacet, plus marquée en glisse
    c.th += c.yaw * (Math.sign(vf) || 1) * dt;
    fx = Math.cos(c.th); fz = Math.sin(c.th);
    vf = c.vx * fx + c.vz * fz; vl = c.vz * fx - c.vx * fz;
    // moteur ; en boîte manuelle, la poussée dépend du rapport : sous-régime mou, plage utile +8 %, rupteur et frein moteur au-delà
    // Moteur et boîte : le régime est celui que les roues imposent à travers le rapport engagé, le couple est lu sur la courbe du moteur,
    // et chaque changement de rapport coupe la poussée 0,25 s (le temps de débrayer). Boîte auto : monte à 7500 tr/min, rétrograde sous ~4000.
    const K = CARD.final * 30 / (Math.PI * CARD.wheel), av = Math.abs(vf); // tr/min par m/s, pour un rapport de 1
    if (!c.manual && av < 3) c.gear = c.lastGear = 0; // quasi à l'arrêt : la boîte auto revient directement en 1re
    if (!c.manual && c.shiftT <= 0) {
      if (av * K * CARD.ratios[c.gear] > CARD.up && c.gear < CARD.ratios.length - 1) c.gear++;
      else if (c.gear > 0 && av * K * CARD.ratios[c.gear - 1] < CARD.down) c.gear--;
    }
    if (c.gear !== c.lastGear) { c.shiftT = 0.25; c.lastGear = c.gear; }
    const ratio = CARD.ratios[c.gear], wr = av * K * ratio, er = Math.max(wr, c.gear === 0 && inp.gas ? 3500 : CARD.idle); // en 1re, l'embrayage patine vers 3500 tr/min au démarrage
    c.rpm += (Math.min(er, CARD.red + 150) - c.rpm) * Math.min(1, dt * 18);
    let acc = 0;
    if (c.shiftT > 0) c.shiftT -= dt;
    else if (wr > CARD.red) acc = -6 * Math.sign(vf); // surrégime : rupteur et gros frein moteur
    else {
      const tqe = inp.gas * torque(er) - (1 - inp.gas) * (20 + 0.01 * er) * Math.sign(vf); // couple moteur, ou frein moteur pied levé
      acc = Math.min(CARD.trac, tqe * ratio * CARD.final * CARD.eff / CARD.wheel / CARD.mass); // plafonné par la motricité (~1,1 g en 4 roues motrices, moins en propulsion)
    }
    // propulsion : ce que les roues arrière donnent en motricité, elles ne l'ont plus en latéral (cercle d'adhérence) : gaz à fond en bas rapport = survirage
    const tc = CARD.rwd && acc > 0 ? Math.sqrt(Math.max(0.2, 1 - (acc / CARD.trac) ** 2)) : 1;
    if (c.boost > 0) { c.boost -= dt; if (inp.gas) acc += 6; }
    if (c.stun > 0) { c.stun -= dt; if (acc > 0) acc *= 0.2; }
    vf += acc * dt;
    const s0 = S[c.idx]; if (Math.abs(vf) > 1) vf -= 9.81 * s0.sl * (fx * s0.tx + fz * s0.tz) * dt; // la pente pousse ou retient
    if (inp.brake) vf -= (vf > 0.5 ? 18 : 12) * inp.brake * dt;
    if (vf < -12) vf = -12;
    if (hand) vf -= Math.sign(vf) * 4 * dt;
    // traînée aérodynamique (½·ρ·Cd·A·v²), résistance au roulement, et un peu de vitesse perdue en glisse
    vf -= (0.6 * CARD.cd * CARD.area * vf * Math.abs(vf) / CARD.mass + (Math.abs(vf) > 0.3 ? 0.15 : 0) * Math.sign(vf) + 0.1 * Math.abs(vl) * Math.sign(vf)) * dt;
    // adhérence latérale plafonnée (m/s²) : au-delà les pneus décrochent ; elle chute en glisse, au frein à main et au freinage appuyé
    const A = lerp(GRIP, GRIP * 0.95, sl) * (hand ? 0.35 : 1) * (inp.brake && sp > 25 ? 0.4 : 1) * tc;
    vl += clamp(-vl * 25, -A, A) * dt;
    // une glisse tenue plus de 0,6 s donne un boost à la reprise d'adhérence
    c.slide = sl; c.drift = sl > 0.35;
    if (sl > 0.5) c.driftT += dt;
    else if (sl < 0.15) { if (c.driftT > 0.6 && !hand) c.boost = Math.min(1.5, c.driftT * 0.8); c.driftT = 0; }
    c.vx = fx * vf - fz * vl; c.vz = fz * vf + fx * vl;
    c.x += c.vx * dt; c.z += c.vz * dt;
    // position sur la piste + murs (impossible de couper : un tour bouclé est toujours valide)
    let b = c.idx, bd = 1e9;
    for (let j = -6; j <= 14; j++) { const i = (c.idx + j + n) % n, s = S[i], d = (s.x - c.x) ** 2 + (s.z - c.z) ** 2; if (d < bd) { bd = d; b = i; } }
    c.dist += ((b - c.idx + n + n / 2) % n) - n / 2;
    c.idx = b;
    const s = S[b], nx = -s.tz, nz = s.tx, L = W - 1.1;
    c.d = (c.x - s.x) * nx + (c.z - s.z) * nz; c.hit = 0;
    const o = Math.abs(c.d) - L;
    if (o > 0) {
      const sg = Math.sign(c.d), vn = (c.vx * nx + c.vz * nz) * sg;
      c.x -= nx * sg * o; c.z -= nz * sg * o; c.d = sg * L;
      const sc = Math.exp(-1.2 * dt); c.vx *= sc; c.vz *= sc; // frotter le mur freine en continu
      c.th += wrap(Math.atan2(s.tz, s.tx) - c.th) * Math.min(1, 4 * dt); // ... et remet le nez dans l'axe, pour ne pas rester collé
      if (vn > 0) {
        const k = 1 - clamp(vn * 0.05, 0.2, 0.7); // tout contact coûte au moins 20 % de la vitesse
        c.vx = (c.vx - nx * sg * vn * 1.3) * k; c.vz = (c.vz - nz * sg * vn * 1.3) * k; c.hit = vn;
        c.th += wrap(Math.atan2(s.tz, s.tx) - c.th) * Math.min(0.5, vn * 0.03);
        if (vn > 3) { c.driftT = 0; c.boost = 0; c.stun = 0.8; } // un vrai choc annule le boost et coupe le moteur 0,8 s
      }
    }
    c.vf = vf; c.vl = vl;
  }

  // Pilote automatique : sert au test node, au mode ?auto, à ramener la voiture après l'arrivée, et aux adversaires en course.
  // lvl = niveau du pilote (1 = tour propre de référence ; plus bas = moins de gaz et virages plus lents).
  // others = voitures à éviter : il se décale pour doubler une voiture plus lente, ne se rabat pas tant qu'elle est à sa hauteur, et freine s'il est bloqué derrière.
  function autopilot(c, T, lvl = 1, others = []) {
    const S = T.S, n = T.n, sp = Math.hypot(c.vx, c.vz), look = M.anticipe ? 4 + Math.floor(sp * 0.2) : 6 + Math.floor(sp * 0.35);
    let off = 0, vcap = 1e9, best = 1e9;
    for (const o of others) {
      if (o === c) continue;
      const g = ((o.idx - c.idx + n + n / 2) % n) - n / 2, so = Math.hypot(o.vx, o.vz); // écart le long de la piste, en échantillons de 2 m
      if (g < -3 || g > 8 + sp * 0.7 || g >= best || (g > 3 && so >= sp)) continue;
      best = g;
      let side = Math.abs(c.d - o.d) > 1 ? Math.sign(c.d - o.d) : o.d > 0 ? -1 : 1; // déjà d'un côté : y rester ; sinon passer là où il y a de la place
      if (g > 3 && Math.abs(o.d + side * 3.4) > 5.5) side = -side; // pas la place de ce côté et encore derrière : passer de l'autre
      const want = o.d + side * 3.4; // rester sur la trajectoire, sauf à moins de 3,4 m d'elle : alors s'en écarter d'autant
      off = clamp(side > 0 ? Math.max(0, want) : Math.min(0, want), -5.5, 5.5);
      // serré contre le mur à sa hauteur : céder ; bloqué derrière elle : freiner à temps et régler sa vitesse sur la sienne
      vcap = g > 0 && Math.abs(want) > 5.5 ? so * 0.9 : g > 0 && Math.abs(c.d - o.d) < 2.4 && g * 2 - 7 < (sp * sp - so * so) / 28 ? so : 1e9;
    }
    const la = S[(c.idx + look) % n];
    const e = wrap(Math.atan2(la.z + la.tx * off - c.z, la.x - la.tz * off - c.x) - c.th);
    let km = 0, va = 1e9;
    for (let j = 0; j < 8 + sp * 0.7; j++) km = Math.max(km, Math.abs(S[(c.idx + j) % n].k));
    // cartes à épingles : vitesse permise = celle de chaque virage à venir, plus ce qu'on peut perdre en freinant d'ici là (10 m/s², 2 m par échantillon)
    if (M.anticipe) for (let j = 0; j < 200; j++) va = Math.min(va, Math.sqrt(0.85 * GRIP / (Math.abs(S[(c.idx + j) % n].k) + 1e-4) + 40 * j));
    const vt = Math.min(vcap, (M.anticipe ? va : Math.sqrt(1.5 * GRIP / (km + 1e-4))) * lvl * (off ? 0.9 : 1)); // hors trajectoire, on passe moins vite
    const st = clamp(e * 3, -1, 1);
    // en propulsion le pilote dose : moins de gaz tant que le volant est braqué, sinon l'arrière décroche en sortie d'épingle
    return { steer: st, gas: sp < vt ? lvl * (CARD.rwd ? 1 - 0.75 * Math.min(1, Math.abs(st) * 1.5) : 1) : 0, brake: sp > vt + 3 ? 1 : 0, hand: false };
  }

  // ---------- Course contre des adversaires IA ----------
  // API pour game.js (aucun rendu ici) :
  //   R = newRace(T, laps = 3, lvls = AI_LVL)  crée la course. R.cars[0] = joueur (dernier sur la grille), R.cars[1..] = adversaires, le plus rapide en tête.
  //   stepRace(R, inp, dt)                     avance toutes les voitures d'un pas (dt = 1/120). inp = commandes du joueur, comme step() ;
  //                                            inp = null : le joueur est conduit par l'IA (mode ?auto, ou après son arrivée). Ne pas appeler pendant le décompte.
  //   R.t = temps de course (s) ; R.done = true quand tout le monde est arrivé ; R.laps = nombre de tours.
  //   Par voiture, en plus des champs de newCar() (x, z, th, vf, rpm, drift, hit...) :
  //     c.pos  = place en direct (1 = premier)     c.lap = tour en cours (1..laps)
  //     c.fin  = temps final (s), 0 tant qu'elle n'est pas arrivée ; après l'arrivée la voiture continue de rouler
  //     c.bump = vitesse d'impact (m/s) d'un choc contre une autre voiture pendant ce pas, sinon 0 (c.hit reste le choc contre un mur)
  //     c.dist = progression en échantillons de 2 m depuis la ligne (tours cumulés) ; c.lvl = niveau du pilote
  //   raceOrder(R) = les voitures triées par place.
  const AI_LVL = [0.99, 0.97, 0.95]; // niveau de chaque adversaire : le seul réglage de rythme (1 = tour propre du pilote automatique)
  const CR = 1.1, CO = 1.2; // une voiture = 2 cercles de rayon CR, à ±CO m le long de son axe (4,6 m × 2,2 m)

  function newRace(T, laps = 3, lvls = AI_LVL) {
    const cars = [1, ...lvls].map((lvl, i) => {
      const c = newCar(T), k = i ? i - 1 : lvls.length, j = T.n - 8 - 4 * k, s = T.S[j], d = k % 2 ? 3 : -3; // grille en quinconce, 8 m entre deux places
      return Object.assign(c, { x: s.x - s.tz * d, z: s.z + s.tx * d, th: Math.atan2(s.tz, s.tx), idx: j, dist: -8 - 4 * k, d, lvl, pos: k + 1, lap: 1, fin: 0, bump: 0 });
    });
    return { T, cars, laps, t: 0, done: false };
  }

  const raceOrder = R => [...R.cars].sort((a, b) => (a.fin || 1e9) - (b.fin || 1e9) || b.dist - a.dist);

  // Choc entre deux voitures de même masse : on les écarte de moitié chacune et on échange la vitesse le long de la normale (rebond de 20 %).
  // La vitesse tangentielle est conservée : un contact latéral pousse sans freiner.
  function collide(a, b) {
    for (const i of [-CO, CO]) for (const j of [-CO, CO]) {
      const dx = b.x + Math.cos(b.th) * j - a.x - Math.cos(a.th) * i, dz = b.z + Math.sin(b.th) * j - a.z - Math.sin(a.th) * i, d = Math.hypot(dx, dz);
      if (d >= 2 * CR) continue;
      const nx = d > 1e-6 ? dx / d : 1, nz = d > 1e-6 ? dz / d : 0, o = CR - d / 2, vn = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
      a.x -= nx * o; a.z -= nz * o; b.x += nx * o; b.z += nz * o;
      if (vn > 0) { a.vx -= nx * vn * 0.6; a.vz -= nz * vn * 0.6; b.vx += nx * vn * 0.6; b.vz += nz * vn * 0.6; a.bump = b.bump = Math.max(a.bump, vn); }
    }
  }

  function stepRace(R, inp, dt) {
    const { T, cars } = R;
    R.t += dt;
    const ins = cars.map((c, i) => i || !inp ? autopilot(c, T, c.lvl, cars) : inp);
    for (const c of cars) c.bump = 0;
    // les chocs entre voitures d'abord, puis step() : les murs ont le dernier mot, aucune voiture ne peut être poussée hors piste
    for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) collide(cars[i], cars[j]);
    cars.forEach((c, i) => {
      step(c, ins[i], T, dt);
      c.lap = clamp(Math.floor(c.dist / T.n) + 1, 1, R.laps);
      if (!c.fin && c.dist >= R.laps * T.n) c.fin = R.t;
    });
    raceOrder(R).forEach((c, i) => c.pos = i + 1);
    R.done = cars.every(c => c.fin);
  }

  // ---------- Trafic (cartes qui en ont : champ trafic de cartes.js) ----------
  // Des camions à vitesse constante sur trois files. Leur position ne dépend que du temps écoulé depuis le départ : même trafic à chaque essai.
  // trafic(T, t) renvoie la liste (objets réutilisés : x, y, z, th, idx, d, vx, vz), utilisable aussi comme `others` du pilote automatique.
  // hitTrafic(c, T, t) : choc voiture contre camion. Le camion ne bouge pas ; la voiture est repoussée et le choc est signalé dans c.hit, comme un mur.
  const TRUCKS = Array.from({ length: M.trafic || 0 }, (_, i) => ({ lane: [-4.6, 0, 4.6][(i * 2) % 3], v: 25 + (i * 7 % 5) * 1.5, x: 0, y: 0, z: 0, th: 0, idx: 0, d: 0, vx: 0, vz: 0 }));
  function trafic(T, t) {
    const S = T.S, n = T.n;
    TRUCKS.forEach((k, i) => {
      const p = (i / TRUCKS.length * n + 40 + k.v * t / 2) % n, j = p | 0, f = p - j, a = S[j], b = S[(j + 1) % n];
      k.idx = j; k.d = k.lane; k.th = Math.atan2(a.tz, a.tx); k.vx = a.tx * k.v; k.vz = a.tz * k.v;
      k.x = lerp(a.x, b.x, f) - a.tz * k.lane; k.z = lerp(a.z, b.z, f) + a.tx * k.lane; k.y = lerp(a.y, b.y, f);
    });
    return TRUCKS;
  }
  function hitTrafic(c, T, t) {
    for (const k of trafic(T, t)) {
      if (Math.abs(((k.idx - c.idx + T.n + T.n / 2) % T.n) - T.n / 2) > 12) continue;
      const kx = Math.cos(k.th), kz = Math.sin(k.th), cx = Math.cos(c.th), cz = Math.sin(c.th);
      for (const i of [-4, 0, 4]) for (const j of [-1.2, 1.2]) { // camion = 3 cercles de 1,4 m, voiture = 2 cercles de 1,1 m
        const dx = c.x + cx * j - k.x - kx * i, dz = c.z + cz * j - k.z - kz * i, d = Math.hypot(dx, dz);
        if (d >= 2.5 || d < 1e-6) continue;
        const nx = dx / d, nz = dz / d, vn = -((c.vx - k.vx) * nx + (c.vz - k.vz) * nz);
        c.x += nx * (2.5 - d); c.z += nz * (2.5 - d);
        if (vn > 0) { c.vx += nx * vn * 1.2; c.vz += nz * vn * 1.2; c.hit = Math.max(c.hit, vn); if (vn > 3) { c.driftT = 0; c.boost = 0; c.stun = 0.8; } }
      }
    }
  }

  Object.assign(G, { buildTrack, newCar, step, autopilot, newRace, stepRace, raceOrder, trafic, hitTrafic, AI_LVL, TOP, CARD });
})(typeof window !== 'undefined' ? window : globalThis);
