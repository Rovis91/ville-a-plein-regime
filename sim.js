// Piste + physique pures (sans rendu) : partagées par le jeu et par `node test.js`.
(function (G) {
  if (!G.CARTES) require('./cartes.js'); // node : le navigateur charge cartes.js avant ce fichier
  // Tout ce qui dépend de la carte active (tracé, largeur, adhérence, voiture) vient de cartes.js ; voir ses commentaires pour le détail des champs.
  const M = G.CARTE, W = M.W, TOP = 55; // demi-largeur de route (m) ; vitesse de référence (m/s) pour les effets visuels
  const CARD = M.car; // mécanique : fiche technique de la voiture de la carte
  const WALL_RUB = 0.35, WALL_SOFT = 0.2, WALL_LOSS = 7, WALL_HARD = 0.45, WALL_MU = 10; // murs : frein du frottement (1/s) ; sinus de l'angle d'arrivée sous lequel ça gratte sans perte ; pente de la perte au-delà (choc franc) ; sinus au-dessus duquel le moteur coupe ; frottement du mur extérieur d'un virage (frein en 1/s par rad/s de rotation que le mur impose à la voiture)
  const torque = rpm => { const x = Math.max(0, Math.min(8, rpm / 1000)), i = Math.min(7, x | 0); return CARD.tq[i] + (CARD.tq[i + 1] - CARD.tq[i]) * (x - i); };
  // Points de contrôle (x,z) en mètres, sens horaire = virages à droite. Départ en [0]. HGT = altitude de chaque point.
  const SC = M.sc, HGT = M.pts.map(p => p[2]), PTS = M.pts.map(p => [p[0] * SC, p[1] * SC]);
  // Conduite « kart » : le volant commande directement une vitesse de rotation (pas une force bridée par l'adhérence), donc le rayon de virage croît comme la vitesse et non comme son carré.
  //   w0, w1 = lacet volant à fond (rad/s) à l'arrêt et à vref (m/s, 250 km/h) : rayon = v / lacet. Calés sur la carte par buildTrack : à vref, le rayon vaut `large` fois (rayon du virage le plus serré + demi-largeur),
  //            donc à fond on ne passe pas ce virage en adhérence ; pied levé on s'en approche, en glisse volant dedans on le passe avec de la marge
  //   lift   = surcroît de lacet pied levé ou au frein : lâcher les gaz resserre
  //   din, dn, dout = lacet en glisse, en multiple du lacet d'adhérence : volant vers l'intérieur, au neutre, vers l'extérieur. Le volant ouvre ou ferme le rayon, jamais il n'inverse la glisse
  //   ang    = angle de dérive affiché en glisse (rad) ; tv = vitesse perdue en tournant (m/s² par rad/s de lacet) : presque rien, la glisse ne freine pas
  const KT = { w0: 2.2, w1: 1.5, vref: 70, large: 2.2, lift: 1.25, din: 2.1, dn: 0.75, dout: 0.2, ang: 0.35, tv: 1 };
  const omega = v => KT.w0 - (KT.w0 - KT.w1) * Math.min(1, v / KT.vref); // lacet volant à fond à la vitesse v, sur les gaz, sans glisse
  const vturn = (a, k) => { const c = a / k; return KT.w1 * c >= KT.vref ? KT.w1 * c : KT.w0 * c / (1 + (KT.w0 - KT.w1) * c / KT.vref); }; // vitesse à laquelle la part a du braquage suffit pour une courbure k
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

  function buildTrack(THREE) {
    const curve = new THREE.CatmullRomCurve3(PTS.map((p, i) => new THREE.Vector3(p[0], HGT[i], p[1])), true, 'centripetal');
    curve.arcLengthDivisions = 4000;
    const len = curve.getLength(), n = Math.round(len / 2), P = curve.getSpacedPoints(n), S = [];
    for (let i = 0; i < n; i++) {
      const p = P[i], q = P[i + 1], dx = q.x - p.x, dz = q.z - p.z, l = Math.hypot(dx, dz);
      S.push({ x: p.x, y: p.y, z: p.z, tx: dx / l, tz: dz / l, k: 0, sl: (q.y - p.y) / l, dl: 0, kl: 0 }); // sl = pente ; dl, kl = écart au centre et courbure de la trajectoire du pilote automatique
    }
    // courbure signée (>0 = virage à droite), lissée sur ±3 échantillons
    S.forEach((s, i) => { const a = S[(i - 3 + n) % n], b = S[(i + 3) % n]; s.k = s.kl = (a.tx * b.tz - a.tz * b.tx) / (6 * len / n); });
    KT.w1 = KT.vref / (KT.large * (1 / Math.max(...S.map(s => Math.abs(s.k))) + W)); KT.w0 = 1.6 * KT.w1;
    // la trajectoire du pilote automatique est la ligne de moindre courbure qui tient dans la route, à 2,1 m des murs (extérieur, corde, extérieur).
    // Un point tous les 8 m, chacun ramené là où ses 4 voisins le voudraient pour que la ligne tourne le moins possible ; puis sa courbure, par le cercle passant par 3 points.
    {
      const m = 4, N = Math.floor(n / m), D = new Float64Array(N), lim = W - 3.2, pt = (i, d) => { const s = S[(i + n) % n]; return [s.x - s.tz * d, s.z + s.tx * d]; }, pj = j => pt((j + N) % N * m, D[(j + N) % N]);
      for (let it = 0; it < 6000; it++) for (let j = 0; j < N; j++) {
        const s = S[j * m], a = pj(j - 1), b = pj(j + 1), a2 = pj(j - 2), b2 = pj(j + 2);
        D[j] = clamp(-((4 * (a[0] + b[0]) - a2[0] - b2[0]) / 6 - s.x) * s.tz + ((4 * (a[1] + b[1]) - a2[1] - b2[1]) / 6 - s.z) * s.tx, -lim, lim);
      }
      S.forEach((s, i) => { const j = Math.floor(i / m) % N, f = i / m - Math.floor(i / m); s.dl = D[j] + (D[(j + 1) % N] - D[j]) * f; });
      S.forEach((s, i) => { const a = pt(i - m, S[(i - m + n) % n].dl), b = pt(i, s.dl), c = pt(i + m, S[(i + m) % n].dl), ux = b[0] - a[0], uz = b[1] - a[1], vx = c[0] - b[0], vz = c[1] - b[1];
        s.kl = 2 * (ux * vz - uz * vx) / (Math.hypot(ux, uz) * Math.hypot(vx, vz) * Math.hypot(c[0] - a[0], c[1] - a[1])); });
    }
    const near = p => { let b = 0, bd = 1e9; S.forEach((s, i) => { const d = (s.x - p[0]) ** 2 + (s.z - p[1]) ** 2; if (d < bd) { bd = d; b = i; } }); return b; };
    const at = i => near(PTS[i]), TUN = M.tun || [0, 0];
    // tun : la carte a un tunnel, de t0 à t1 ; h0-h1 : secteur « chaud » pour la musique ; sp : les deux temps intermédiaires (indices d'échantillons)
    return { S, n, W, len, tun: !!M.tun, t0: at(TUN[0]), t1: at(TUN[1]), h0: at(M.chaud[0]), h1: at(M.chaud[1]), sp: M.sect.map(at) };
  }

  function newCar(T) {
    const i = T.n - 8, s = T.S[i]; // 16 m avant la ligne
    return { x: s.x, z: s.z, th: Math.atan2(s.tz, s.tx), vx: 0, vz: 0, steer: 0, yaw: 0, idx: i, dist: -8, d: 0, hit: 0, vf: 0, vl: 0,
      drift: false, slide: 0, driftT: 0, dd: 0, sa: 0, boost: 0, stun: 0, nDrift: 0, nBoost: 0, nWall: 0, combo: 0, comboMax: 0, // n… : bilan de glisse (glisses, boosts, chocs mur, boosts enchaînés sans choc)
      manual: false, gear: 0, lastGear: 0, shiftT: 0, rpm: CARD.idle };
  }

  // inp: {steer:-1..1 (droite>0), gas:0..1, brake:0..1, hand:bool}
  function step(c, inp, T, dt) {
    const S = T.S, n = T.n;
    c.steer += clamp(inp.steer - c.steer, -12 * dt, 12 * dt);
    let fx = Math.cos(c.th), fz = Math.sin(c.th);
    let vf = c.vx * fx + c.vz * fz, vl = c.vz * fx - c.vx * fz;
    const sp = Math.abs(vf);
    // Glisse (frein à main tenu + volant, au-dessus de 45 km/h) : elle verrouille son sens (c.dd) tant que le frein à main est tenu ; le volant ne fait plus qu'ouvrir ou fermer le rayon.
    // La voiture se met en travers de c.sa (angle de dérive) mais sa trajectoire tourne au lacet commandé : on serre plus qu'en adhérence, sans perdre de vitesse.
    if (!c.dd && inp.hand && sp > 12 && Math.abs(inp.steer) > 0.3) { c.dd = Math.sign(inp.steer); c.nDrift++; }
    if (c.dd && (!inp.hand || sp < 10)) { if (c.driftT > 0.6 && sp >= 10) { c.boost = Math.min(1.5, c.driftT * 0.8); c.nBoost++; c.comboMax = Math.max(c.comboMax, ++c.combo); } c.dd = 0; c.driftT = 0; } // glisse tenue plus de 0,6 s : boost à la sortie
    const om = omega(sp) * Math.min(1, sp / 10), sd = c.steer * (c.dd || 0);
    const w = c.dd ? c.dd * om * lerp(KT.dn, sd > 0 ? KT.din : KT.dout, Math.abs(sd)) : c.steer * om * (inp.gas && !inp.brake ? 1 : KT.lift);
    c.yaw += (w - c.yaw) * Math.min(1, dt * 18); // un rien d'inertie : la réponse est quasi immédiate
    const dsa = ((c.dd || 0) * KT.ang * (1 + 0.2 * sd) - c.sa) * Math.min(1, dt * 6); c.sa += dsa;
    c.th += c.yaw * (Math.sign(vf) || 1) * dt + (c.dd ? dsa : 0); // à la sortie de glisse le nez ne revient pas : c'est la trajectoire qui rejoint le nez, la voiture repart là où elle pointe
    fx = Math.cos(c.th); fz = Math.sin(c.th);
    vf = c.vx * fx + c.vz * fz; vl = c.vz * fx - c.vx * fz;
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
    if (c.boost > 0) { c.boost -= dt; if (inp.gas) acc += 6; }
    if (c.stun > 0) { c.stun -= dt; if (acc > 0) acc *= 0.2; }
    vf += acc * dt;
    const s0 = S[c.idx]; if (Math.abs(vf) > 1) vf -= 9.81 * s0.sl * (fx * s0.tx + fz * s0.tz) * dt; // la pente pousse ou retient
    if (inp.brake) vf -= (vf > 0.5 ? 18 : 12) * inp.brake * dt;
    if (vf < -12) vf = -12;
    // traînée aérodynamique (½·ρ·Cd·A·v²), résistance au roulement, et un peu de vitesse perdue en tournant
    vf -= (0.6 * CARD.cd * CARD.area * vf * Math.abs(vf) / CARD.mass + ((Math.abs(vf) > 0.3 ? 0.15 : 0) + KT.tv * Math.abs(c.yaw) * Math.min(1, sp / 10)) * Math.sign(vf)) * dt;
    // pas de pneus qui décrochent : la vitesse suit le nez de la voiture (décalé de l'angle de dérive en glisse), sans rien perdre ; un choc de côté est rattrapé en un dixième de seconde
    const v0 = Math.hypot(vf, vl);
    vl += (-Math.sin(c.sa) * v0 - vl) * Math.min(1, 25 * dt);
    if (v0 > 1) { const k = v0 / Math.max(Math.hypot(vf, vl), 1e-3); vf *= k; vl *= k; }
    c.slide = Math.min(1, Math.abs(c.sa) / KT.ang); c.drift = !!c.dd;
    if (c.dd) c.driftT += dt;
    c.vx = fx * vf - fz * vl; c.vz = fz * vf + fx * vl;
    c.x += c.vx * dt; c.z += c.vz * dt;
    // position sur la piste + murs (impossible de couper : un tour bouclé est toujours valide)
    let b = c.idx, bd = 1e9;
    for (let j = -6; j <= 14; j++) { const i = (c.idx + j + n) % n, s = S[i], d = (s.x - c.x) ** 2 + (s.z - c.z) ** 2; if (d < bd) { bd = d; b = i; } }
    c.dist += ((b - c.idx + n + n / 2) % n) - n / 2;
    c.idx = b;
    const s = S[b], nx = -s.tz, nz = s.tx, L = W - 1.1;
    c.d = (c.x - s.x) * nx + (c.z - s.z) * nz; c.hit = 0; c.rub = 0; c.wallT = (c.wallT || 0) - dt;
    const o = Math.abs(c.d) - L;
    if (o > 0) {
      const sg = Math.sign(c.d), vn = (c.vx * nx + c.vz * nz) * sg;
      c.x -= nx * sg * o; c.z -= nz * sg * o; c.d = sg * L; c.rub = 1;
      // frotter le mur freine en continu ; et le mur extérieur d'un virage ne remplace pas les pneus : s'y appuyer pour tourner se paie en vitesse, en proportion de ce qu'il fait tourner (rien le long d'un mur droit)
      const v = Math.hypot(c.vx, c.vz), sc = Math.exp(-(WALL_RUB + WALL_MU * Math.max(0, -s.k * sg * v - 0.1)) * dt); c.vx *= sc; c.vz *= sc;
      const rel = wrap(c.th - Math.atan2(s.tz, s.tx)), into = rel * sg > 0 && Math.abs(rel) < 1.5; // nez tourné vers le mur
      c.th -= rel * Math.min(1, (into ? 25 : 4) * dt); // le mur redresse la voiture : volant braqué vers lui, elle glisse le long au lieu de s'y planter
      if (vn > 0) {
        // la perte sèche ne tombe qu'à l'arrivée sur le mur : rester appuyé dessus, volant braqué, ne fait que frotter
        const fresh = !(c.wallT > 0), sa = vn / Math.max(Math.hypot(c.vx, c.vz), 1), k = fresh ? 1 - clamp((sa - WALL_SOFT) * WALL_LOSS, 0, 0.7) : 1;
        c.vx = (c.vx - nx * sg * vn) * k; c.vz = (c.vz - nz * sg * vn) * k; c.hit = fresh ? vn : 0; if (fresh && vn > 2) { c.nWall++; c.combo = 0; } // pas de rebond : on glisse le long du mur
        c.th += wrap(Math.atan2(s.tz, s.tx) - c.th) * Math.min(0.5, vn * 0.03);
        if (fresh && sa > WALL_HARD && vn > 5) { c.dd = 0; c.driftT = 0; c.boost = 0; c.stun = 0.8; } // un vrai choc annule le boost et coupe le moteur 0,8 s
      }
      c.wallT = 0.4;
    }
    c.vf = vf; c.vl = vl;
  }

  // Pilote automatique : sert au test node, au mode ?auto, à ramener la voiture après l'arrivée, et aux adversaires en course.
  // lvl = niveau du pilote (1 = tour propre de référence ; plus bas = moins de gaz et virages plus lents).
  // others = voitures à éviter : il se décale pour doubler une voiture plus lente, ne se rabat pas tant qu'elle est à sa hauteur, et freine s'il est bloqué derrière.
  function autopilot(c, T, lvl = 1, others = []) {
    const S = T.S, n = T.n, sp = Math.hypot(c.vx, c.vz), look = 3 + Math.floor(sp * 0.1);
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
    const e = wrap(Math.atan2(la.z + la.tx * (off || la.dl) - c.z, la.x - la.tz * (off || la.dl) - c.x) - c.th);
    let va = 1e9;
    // vitesse permise = celle de chaque virage de la trajectoire à venir, plus ce qu'on peut perdre en freinant d'ici là (10 m/s², 2 m par échantillon)
    for (let j = 0; j < 200; j++) va = Math.min(va, Math.sqrt(vturn(1.3, Math.abs(S[(c.idx + j) % n].kl) + 1e-4) ** 2 + 40 * j));
    const vt = Math.min(vcap, va * lvl * (off ? 0.9 : 1)); // hors trajectoire, on passe moins vite
    const st = clamp(e * 3, -1, 1);
    return { steer: st, gas: sp < vt ? lvl : 0, brake: sp > vt + 3 ? 1 : 0, hand: false };
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
  // DIFF : les trois difficultés du menu. k multiplie le niveau des adversaires ; el = élastique : jusqu'à ±el de rythme selon l'écart au joueur (plein effet à 300 m),
  // l'IA de tête lève un peu le pied quand le joueur est loin derrière et pousse quand il mène. Niveau plafonné à LVL_MAX : au-delà le pilote automatique touche les murs.
  const DIFF = [{ nom: 'DETENTE', k: 0.93, el: 0.05 }, { nom: 'NORMAL', k: 1, el: 0.03 }, { nom: 'CHAUD', k: 1.04, el: 0.015 }], LVL_MAX = 1.04;
  const AI_LVL = [0.99, 0.97, 0.95]; // niveau de chaque adversaire : le seul réglage de rythme (1 = tour propre du pilote automatique)
  const CR = 1.1, CO = 1.2; // une voiture = 2 cercles de rayon CR, à ±CO m le long de son axe (4,6 m × 2,2 m)

  function newRace(T, laps = 3, lvls = AI_LVL, el = 0) {
    const cars = [1, ...lvls].map((lvl, i) => {
      const c = newCar(T), k = i ? i - 1 : lvls.length, j = T.n - 8 - 4 * k, s = T.S[j], d = k % 2 ? 3 : -3; // grille en quinconce, 8 m entre deux places
      return Object.assign(c, { x: s.x - s.tz * d, z: s.z + s.tx * d, th: Math.atan2(s.tz, s.tx), idx: j, dist: -8 - 4 * k, d, lvl, pos: k + 1, lap: 1, fin: 0, bump: 0 });
    });
    return { T, cars, laps, el, t: 0, done: false };
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
    const p = cars[0], rub = c => Math.min(LVL_MAX, c.lvl * (1 - R.el * clamp((c.dist - p.dist) / 150, -1, 1)));
    // une voiture arrivée lève le pied : elle finit son tour au ralenti au lieu de repartir à fond
    const ins = cars.map((c, i) => i || !inp ? autopilot(c, T, c.fin ? 0.6 : i ? rub(c) : c.lvl, cars) : inp);
    for (const c of cars) c.bump = 0; ins.forEach((p, i) => { const c = cars[i]; if (c.fin && (i || !inp) && Math.hypot(c.vx, c.vz) > 28) { p.gas = 0; p.brake = Math.max(p.brake, 0.3); } }); // tour d'honneur à 100 km/h
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

  Object.assign(G, { buildTrack, newCar, step, autopilot, newRace, stepRace, raceOrder, trafic, hitTrafic, AI_LVL, DIFF, TOP, CARD, vturn, omega });
})(typeof window !== 'undefined' ? window : globalThis);
