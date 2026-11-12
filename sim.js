// Piste + physique pures (sans rendu) : partagées par le jeu et par `node test.js`.
(function (G) {
  const W = 9, TOP = 55; // demi-largeur de route (m) ; vitesse de référence (m/s) pour le braquage et les effets visuels
  const GRIP = 44; // adhérence latérale maxi (m/s²) : à fond on ne passe que les courbes de plus de 70 m de rayon, le reste se freine
  // Mécanique : données constructeur de la Nismo Skyline GT-R Z-tune (R34, 6 cylindres en ligne biturbo « Z2 » de 2,8 L, boîte Getrag 6 rapports).
  const CARD = {
    ratios: [3.827, 2.360, 1.685, 1.312, 1.000, 0.793], final: 3.545, // démultiplications
    wheel: 0.326, mass: 1675, eff: 0.85, // rayon de roue (m) ; 1600 kg + pilote ; ~15 % de pertes de transmission (4 roues motrices)
    idle: 950, red: 8000, cd: 0.34, area: 2.1, // ralenti, zone rouge (tr/min) ; aérodynamique
    tq: [0, 200, 330, 450, 520, 540, 535, 505, 420], // couple (N·m) tous les 1000 tr/min : 540 N·m à 5200, 500 ch à 6800 (forme de la courbe estimée)
  };
  const torque = rpm => { const x = Math.max(0, Math.min(8, rpm / 1000)), i = Math.min(7, x | 0); return CARD.tq[i] + (CARD.tq[i + 1] - CARD.tq[i]) * (x - i); };
  // Points de contrôle (x,z) en mètres, sens horaire = virages à droite. Départ en [0].
  // HGT = altitude de chaque point : bosse sur la grande courbe, plongée dans l'échangeur, remontée vers la ligne.
  const HGT = [0, 0, 4, 10, 12, 6, -2, -10, -14, -14, -10, -4, 2, 8, 6, 2, 0];
  const SC = 0.85; // échelle du tracé : plus petit = virages plus serrés pour une même voiture
  const PTS = [[0, 0], [220, 0], [420, 10], [560, 90], [600, 240], [520, 370], [360, 400], [230, 340], [110, 400],
    [0, 520], [-150, 560], [-300, 500], [-360, 360], [-300, 240], [-380, 120], [-330, 10], [-180, 0]].map(p => [p[0] * SC, p[1] * SC]);
  const TUN = [6, 12]; // l'échangeur couvert va de PTS[6] à PTS[12]
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
    return { S, n, W, len, t0: near(PTS[TUN[0]]), t1: near(PTS[TUN[1]]) };
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
      if (av * K * CARD.ratios[c.gear] > 7500 && c.gear < 5) c.gear++;
      else if (c.gear > 0 && av * K * CARD.ratios[c.gear - 1] < 6200) c.gear--;
    }
    if (c.gear !== c.lastGear) { c.shiftT = 0.25; c.lastGear = c.gear; }
    const ratio = CARD.ratios[c.gear], wr = av * K * ratio, er = Math.max(wr, c.gear === 0 && inp.gas ? 3500 : CARD.idle); // en 1re, l'embrayage patine vers 3500 tr/min au démarrage
    c.rpm += (Math.min(er, CARD.red + 150) - c.rpm) * Math.min(1, dt * 18);
    let acc = 0;
    if (c.shiftT > 0) c.shiftT -= dt;
    else if (wr > CARD.red) acc = -6 * Math.sign(vf); // surrégime : rupteur et gros frein moteur
    else {
      const tqe = inp.gas * torque(er) - (1 - inp.gas) * (20 + 0.01 * er) * Math.sign(vf); // couple moteur, ou frein moteur pied levé
      acc = Math.min(11, tqe * ratio * CARD.final * CARD.eff / CARD.wheel / CARD.mass); // plafonné par la motricité (~1,1 g en 4 roues motrices)
    }
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
    const A = lerp(GRIP, GRIP * 0.95, sl) * (hand ? 0.35 : 1) * (inp.brake && sp > 25 ? 0.4 : 1);
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

  // Pilote automatique : sert au test node, au mode ?auto et à ramener la voiture après l'arrivée.
  function autopilot(c, T) {
    const S = T.S, n = T.n, sp = Math.hypot(c.vx, c.vz);
    const la = S[(c.idx + 6 + Math.floor(sp * 0.35)) % n];
    const e = wrap(Math.atan2(la.z - c.z, la.x - c.x) - c.th);
    let km = 0;
    for (let j = 0; j < 8 + sp * 0.7; j++) km = Math.max(km, Math.abs(S[(c.idx + j) % n].k));
    const vt = Math.sqrt(1.5 * GRIP / (km + 1e-4));
    return { steer: clamp(e * 3, -1, 1), gas: sp < vt ? 1 : 0, brake: sp > vt + 3 ? 1 : 0, hand: false };
  }

  Object.assign(G, { buildTrack, newCar, step, autopilot, TOP, CARD });
})(typeof window !== 'undefined' ? window : globalThis);
