// Piste + physique pures (sans rendu) : partagées par le jeu et par `node test.js`.
(function (G) {
  if (!G.CARTES) require('./cartes.js'); // node : le navigateur charge cartes.js avant ce fichier
  // Tout ce qui dépend de la carte (tracé, largeur, adhérence, voiture) vient de cartes.js, passé à buildTrack et porté par la piste : T.carte, T.car (fiche technique de la voiture), T.kt (braquage calé sur le tracé), T.trucks.
  // Ce fichier ne lit aucune carte globale : plusieurs pistes peuvent vivre côte à côte (tests, changement de carte).
  const TOP = 55; // vitesse de référence (m/s) pour les effets visuels
  const WALL_RUB = 0.35, WALL_SOFT = 0.2, WALL_LOSS = 7, WALL_HARD = 0.45, WALL_MU = 10; // murs : frein du frottement (1/s) ; sinus de l'angle d'arrivée sous lequel ça gratte sans perte ; pente de la perte au-delà (choc franc) ; sinus au-dessus duquel le moteur coupe ; frottement du mur extérieur d'un virage (frein en 1/s par rad/s de rotation que le mur impose à la voiture)
  const torque = (CARD, rpm) => { const x = Math.max(0, Math.min(8, rpm / 1000)), i = Math.min(7, x | 0); return CARD.tq[i] + (CARD.tq[i + 1] - CARD.tq[i]) * (x - i); };
  // Conduite « kart » : le volant commande directement une vitesse de rotation (pas une force bridée par l'adhérence), donc le rayon de virage croît comme la vitesse et non comme son carré.
  //   w0, w1 = lacet volant à fond (rad/s) à l'arrêt et à vref (m/s, 250 km/h) : rayon = v / lacet. Calés sur la carte par buildTrack (T.kt, copie de KT0) : à vref, le rayon vaut `large` fois (rayon du virage le plus serré + demi-largeur),
  //            donc à fond on ne passe pas ce virage en adhérence ; pied levé on s'en approche, en glisse volant dedans on le passe avec de la marge
  //   lift   = surcroît de lacet pied levé ou au frein : lâcher les gaz resserre
  //   din, dn, dout = lacet en glisse, en multiple du lacet d'adhérence : volant vers l'intérieur, au neutre, vers l'extérieur. Le volant ouvre ou ferme le rayon, jamais il n'inverse la glisse
  //   ang    = angle de dérive affiché en glisse (rad) ; tv = vitesse perdue en tournant (m/s² par rad/s de lacet) : presque rien, la glisse ne freine pas
  const KT0 = { w0: 2.2, w1: 1.5, vref: 70, large: 2.2, lift: 1.25, din: 2.1, dn: 0.75, dout: 0.2, ang: 0.35, tv: 1 };
  const omega = (v, KT) => KT.w0 - (KT.w0 - KT.w1) * Math.min(1, v / KT.vref); // lacet volant à fond à la vitesse v, sur les gaz, sans glisse
  const vturn = (a, k, KT) => { const c = a / k; return KT.w1 * c >= KT.vref ? KT.w1 * c : KT.w0 * c / (1 + (KT.w0 - KT.w1) * c / KT.vref); }; // vitesse à laquelle la part a du braquage suffit pour une courbure k
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  // Surfaces : la route de chaque échantillon a un jeu de coefficients (T.surf[i]), pris dans SURF ou fondu entre deux de ses entrées. Un seul mécanisme pour la pluie, la glace, la neige et la terre.
  //   vir = lacet perdu en courbe ; frein, trac = freinage et motricité perdus ; colle = rattrapage de la vitesse par le nez perdu (la voiture chasse)
  //   aquaplaning : au-dessus de vaq (m/s), sur 4 m/s : jusqu'à aq de lacet en moins, et le rattrapage perd encore aqc
  //   roul = frein de roulement en plus (m/s²) ; gl = la glisse part plus tôt : seuils de vitesse et de volant abaissés d'autant
  // Une carte déclare surf : { fond: 'neige', zones: [[point a, point b, 'glace', force = 1], …] } (fond partout, zones fondues sur 20 m à leurs bords). Sans rien : sec.
  // La pluie (th.pluie) passe par la même table : force 3 = SURF.mouille, force 1 (la bruine de la ville) ou tunnel = sec.
  const SURF = {
    sec: { vir: 0, frein: 0, trac: 0, colle: 0, vaq: 230 / 3.6, aq: 0, aqc: 0, roul: 0, gl: 0 },
    mouille: { vir: 0.15, frein: 0.3, trac: 0.25, colle: 0.35, vaq: 190 / 3.6, aq: 0.1, aqc: 0.2, roul: 0, gl: 0 },
    glace: { vir: 0.6, frein: 0.7, trac: 0.7, colle: 0.8, vaq: 230 / 3.6, aq: 0, aqc: 0, roul: 0, gl: 0 }, // très peu de lacet et de freinage, nez très en retard
    neige: { vir: 0.3, frein: 0.4, trac: 0.4, colle: 0.7, vaq: 230 / 3.6, aq: 0, aqc: 0, roul: 0.2, gl: 0.2 }, // tassée : entre le sec et la glace
    terre: { vir: 0.05, frein: 0.2, trac: 0.3, colle: 0.6, vaq: 230 / 3.6, aq: 0, aqc: 0, roul: 0.5, gl: 0.5 }, // motricité réduite, glisse facile, la voiture tourne encore bien
  };
  const mele = (a, b, f) => f <= 0 ? a : f >= 1 ? b : Object.fromEntries(Object.keys(a).map(k => [k, lerp(a[k], b[k], f)]));
  const surf = (T, i) => T.surf ? T.surf[i] : SURF.sec;
  // Nitro : une jauge par voiture (c.nitro, 0 à 1) que la commande inp.nitro dépense, gaz ouverts et roues au sol. c.boost = 1 pendant qu'elle pousse.
  //   dur = secondes de poussée d'une jauge pleine ; acc = poussée (m/s²) à TOP et au-delà, jusqu'à (1 + rep) fois plus à l'arrêt : elle sert aussi à repartir après une erreur
  //   remplissage, en jauge par seconde : gl = glisse tenue (à TOP, plein débit après 0,6 s de glisse) ; mur = frotter un mur sans le taper ; cam = doubler un camion au ras ; asp = dans l'aspiration d'un rival
  //   un choc franc (mur ou camion) la vide
  // Aspiration (course) : derrière une voiture, de 3 à ad m, dans un cône qui s'ouvre de ac par mètre : jusqu'à acx de traînée en moins, tout près
  const NI = { dur: 3, acc: 6, rep: 1, gl: 0.3, mur: 0.5, cam: 0.6, asp: 0.12, ad: 30, ac: 0.08, acx: 0.5 };
  const gagne = (c, x) => { c.nitro = Math.min(1, c.nitro + x); };
  // Mode Glisse : le score, calculé à part de la physique (points() ne fait que lire la voiture : aucun temps au tour n'en dépend). Tenu pour toute voiture, lu par le mode Glisse.
  //   c.cours = points de la glisse en cours ; c.score = points acquis ; c.mult = multiplicateur d'enchaînement
  //   k = points par seconde, par m/s de vitesse, glisse en plein travers (c.slide = angle de dérive rapporté à son plafond) et multiplicateur à 1
  //   min = durée (s) d'une glisse validée : à sa sortie ses points sont versés au score et le multiplicateur monte d'un cran, jusqu'à max ; plus courte, elle ne rapporte rien (pas de zigzags)
  //   pause = secondes sans glisser après lesquelles le multiplicateur retombe à 1 ; un choc contre un mur ou un camion (c.hit > 2 m/s) l'y ramène aussi, et perd la glisse en cours
  const GL = { k: 20, min: 0.8, pause: 3, max: 5 };
  function points(c, dt) {
    if (c.hit > 2) { c.cours = 0; c.glD = 0; c.mult = 1; }
    if (c.drift && !c.air) { c.glD += dt; c.glT = 0; c.cours += GL.k * Math.hypot(c.vx, c.vz) * c.slide * c.mult * dt; return; }
    if (c.glD >= GL.min) { c.score += c.cours; c.mult = Math.min(GL.max, c.mult + 1); }
    c.cours = 0; c.glD = 0; if ((c.glT += dt) > GL.pause) c.mult = 1;
  }
  // Relief (cartes qui déclarent des sauts ou des murs roulables, sinon rien de tout cela ne joue) : la voiture a une hauteur c.y et une vitesse verticale c.vy.
  //   Elle tombe à GRAV ; le sol la rattrape et lui donne sa propre vitesse verticale. À plus de DROOP du sol (débattement des suspensions) elle vole : ni volant, ni moteur, ni frein.
  //   Réception : au-delà de LAND0 m/s d'impact contre le sol, LANDK de vitesse perdue par m/s, jusqu'à LANDX (se recevoir dans une descente ne coûte rien)
  const GRAV = 9.81, DROOP = 0.1, LAND0 = 6, LANDK = 0.025, LANDX = 0.45;
  // Mur roulable : hors du plat (s.pl), la route remonte en quart de tube de rayon s.rc. paroi = hauteur, pente = dy/dd signée (vers la droite), plafonnée à 78° en haut du tube
  const tube = (s, d) => Math.min(Math.abs(d) - s.pl, 0.98 * s.rc);
  const paroi = (s, d) => { const x = s.rc ? tube(s, d) : 0; return x > 0 ? s.rc - Math.sqrt(s.rc * s.rc - x * x) : 0; };
  const pente = (s, d) => { const x = s.rc ? tube(s, d) : 0; return x > 0 ? Math.sign(d) * x / Math.sqrt(s.rc * s.rc - x * x) : 0; };
  // Sol sous la voiture : altitude du ruban, continue d'un échantillon au suivant (k = décalage en échantillons, pour la caméra), plus la paroi
  function sol(T, c, k = 0) {
    const S = T.S, N = T.n; let i = c.idx, a = S[i], b = S[(i + 1) % N], u = ((c.x - a.x) * (b.x - a.x) + (c.z - a.z) * (b.z - a.z)) / ((b.x - a.x) ** 2 + (b.z - a.z) ** 2 || 1);
    if (u < 0) { i = (i - 1 + N) % N; u = Math.max(0, u + 1); } u = Math.min(1, u); a = S[(i + k + N) % N]; b = S[(i + k + 1 + N) % N];
    return a.y + (b.y - a.y) * u + paroi(S[c.idx], c.d);
  }

  // M = la carte (une entrée de CARTES). Points de contrôle (x,z) en mètres, sens horaire = virages à droite. Départ en [0]. HGT = altitude de chaque point.
  function buildTrack(THREE, M) {
    const W = M.W, CARD = M.car, SC = M.sc, HGT = M.pts.map(p => p[2]), PTS = M.pts.map(p => [p[0] * SC, p[1] * SC]), KT = { ...KT0 };
    const curve = new THREE.CatmullRomCurve3(PTS.map((p, i) => new THREE.Vector3(p[0], HGT[i], p[1])), true, 'centripetal');
    curve.arcLengthDivisions = 4000;
    const len = curve.getLength(), n = Math.round(len / 2), P = curve.getSpacedPoints(n), S = [];
    for (let i = 0; i < n; i++) {
      const p = P[i], q = P[i + 1], dx = q.x - p.x, dz = q.z - p.z, l = Math.hypot(dx, dz);
      S.push({ x: p.x, y: p.y, z: p.z, tx: dx / l, tz: dz / l, k: 0, sl: (q.y - p.y) / l, dl: 0, kl: 0 }); // sl = pente ; dl, kl = écart au centre et courbure de la trajectoire du pilote automatique
    }
    // courbure signée (>0 = virage à droite), lissée sur ±3 échantillons
    S.forEach((s, i) => { const a = S[(i - 3 + n) % n], b = S[(i + 3) % n]; s.k = s.kl = (a.tx * b.tz - a.tz * b.tx) / (6 * len / n); });
    KT.w1 = KT.vref / (KT.large * (1 / Math.max(...S.map(s => Math.abs(s.k))) + W)); KT.w1 *= CARD.braq || 1; KT.w0 = 1.6 * KT.w1; // braq : une voiture peut tourner moins que ce que le tracé demande
    const near = p => { let b = 0, bd = 1e9; S.forEach((s, i) => { const d = (s.x - p[0]) ** 2 + (s.z - p[1]) ** 2; if (d < bd) { bd = d; b = i; } }); return b; };
    const at = i => near(PTS[i]), TUN = M.tun || [0, 0];
    // largeur variable : M.large = [[a, b, w], …] demi-largeur w entre les points a et b, raccordée sur 60 m de part et d'autre ; ailleurs W (s.w = demi-largeur à l'échantillon)
    S.forEach(s => s.w = W);
    for (const [a, b, w] of M.large || []) { const i0 = at(a), l = (at(b) - i0 + n) % n; for (let k = -30; k <= l + 30; k++) { const f = Math.min(1, (k + 30) / 30, (l + 30 - k) / 30), s = S[(i0 + k + n) % n]; s.w = Math.max(s.w, W + (w - W) * f * f * (3 - 2 * f)); } }
    // murs roulables : M.cuv = [[a, b, largeur, rayon], …] ajoute de chaque côté du plat, entre les points a et b, un quart de tube qui s'ouvre sur 40 m (s.pl = demi-largeur du plat, s.rc = rayon du tube)
    S.forEach(s => { s.pl = s.w; s.rc = 0; });
    for (const [a, b, B, R] of M.cuv || []) { const i0 = at(a), l = (at(b) - i0 + n) % n; for (let k = 0; k <= l; k++) { const f = Math.min(1, k / 20, (l - k) / 20), s = S[(i0 + k) % n]; s.rc = R; s.w = W + B * f * f * (3 - 2 * f); } }
    // sauts : M.sauts = [[point, longueur, hauteur, fosse, profondeur], …] : un tremplin qui monte en parabole et finit net au point ; derrière, une fosse (facultative) dont on ressort par 16 m de rampe : saut raté = temps perdu, jamais bloqué
    for (const [p, L, h, F = 0, P = 0] of M.sauts || []) { const i0 = at(p), nl = Math.round(L / 2), nf = Math.round(F / 2);
      for (let k = 1; k <= nl; k++) S[(i0 - nl + k + n) % n].y += h * (k / nl) ** 2;
      for (let k = 1; k <= nf; k++) S[(i0 + k) % n].y -= P * Math.min(1, (nf - k) / 8); }
    const vert = !!(M.sauts || M.cuv);
    if (vert) S.forEach((s, i) => { const b = S[(i + 1) % n]; s.sl = (b.y - s.y) / Math.hypot(b.x - s.x, b.z - s.z); });
    // la trajectoire du pilote automatique est la ligne de moindre courbure qui tient dans la route, à 2,1 m des murs (ou du pied des parois : elle reste sur le plat), quelle que soit la largeur (extérieur, corde, extérieur).
    // Un point tous les 8 m, chacun ramené là où ses 4 voisins le voudraient pour que la ligne tourne le moins possible ; puis sa courbure, par le cercle passant par 3 points.
    {
      const m = 4, N = Math.floor(n / m), D = new Float64Array(N), pt = (i, d) => { const s = S[(i + n) % n]; return [s.x - s.tz * d, s.z + s.tx * d]; };
      // 6000 passes sur tous les points : boucle sans aucune allocation (tableaux à plat), c'était l'essentiel du temps de chargement d'une carte. Mêmes opérations dans le même ordre : résultat identique au bit près.
      const X = new Float64Array(N), Z = new Float64Array(N), TX = new Float64Array(N), TZ = new Float64Array(N), LIM = new Float64Array(N);
      for (let j = 0; j < N; j++) { const s = S[j * m]; X[j] = s.x; Z[j] = s.z; TX[j] = s.tx; TZ[j] = s.tz; LIM[j] = s.pl - 3.2; }
      for (let it = 0; it < 6000; it++) for (let j = 0; j < N; j++) {
        const a = (j - 1 + N) % N, b = (j + 1) % N, a2 = (j - 2 + N) % N, b2 = (j + 2) % N;
        const ax = X[a] - TZ[a] * D[a], az = Z[a] + TX[a] * D[a], bx = X[b] - TZ[b] * D[b], bz = Z[b] + TX[b] * D[b];
        const a2x = X[a2] - TZ[a2] * D[a2], a2z = Z[a2] + TX[a2] * D[a2], b2x = X[b2] - TZ[b2] * D[b2], b2z = Z[b2] + TX[b2] * D[b2];
        D[j] = clamp(-((4 * (ax + bx) - a2x - b2x) / 6 - X[j]) * TZ[j] + ((4 * (az + bz) - a2z - b2z) / 6 - Z[j]) * TX[j], -LIM[j], LIM[j]);
      }
      S.forEach((s, i) => { const j = Math.floor(i / m) % N, f = i / m - Math.floor(i / m); s.dl = D[j] + (D[(j + 1) % N] - D[j]) * f; });
      S.forEach((s, i) => { const a = pt(i - m, S[(i - m + n) % n].dl), b = pt(i, s.dl), c = pt(i + m, S[(i + m) % n].dl), ux = b[0] - a[0], uz = b[1] - a[1], vx = c[0] - b[0], vz = c[1] - b[1];
        s.kl = 2 * (ux * vz - uz * vx) / (Math.hypot(ux, uz) * Math.hypot(vx, vz) * Math.hypot(c[0] - a[0], c[1] - a[1])); });
    }
    const t0 = at(TUN[0]), t1 = at(TUN[1]);
    // pluie (th.pluie) : 1 = partout, ou des zones [point a, point b, force] fondues sur 60 échantillons (120 m). T.pluie = force par échantillon (l'image) ; T.surf = la route (voir SURF)
    const span = (a0, a1, r) => i => { const a = (i - a0 + n) % n, L = (a1 - a0 + n) % n; return a < L ? 1 : Math.max(0, 1 - (a - L) / r, 1 - (n - a) / r); };
    const pz = Array.isArray(M.th.pluie) ? M.th.pluie.map(([a, b, f]) => [span(at(a), at(b), 60), f]) : null, tz = span(t0, t1, 20);
    const pluie = Float32Array.from(S, (_, i) => pz ? Math.max(0, ...pz.map(([z, f]) => z(i) * f)) : M.th.pluie ? 1 : 0);
    const sf = M.surf || {}, sz = (sf.zones || []).map(([a, b, t, f = 1]) => [span(at(a), at(b), 10), SURF[t], f]);
    const surf = S.map((_, i) => { let q = mele(SURF[sf.fond || 'sec'], SURF.mouille, clamp((pluie[i] - 1) / 2, 0, 1) * (M.tun ? 1 - tz(i) : 1)); for (const [z, t, f] of sz) q = mele(q, t, z(i) * f); return q; });
    // tun : la carte a un tunnel, de t0 à t1 ; h0-h1 : secteur « chaud » pour la musique ; sp : les deux temps intermédiaires (indices d'échantillons)
    return { S, n, W, len, tun: !!M.tun, t0, t1, h0: at(M.chaud[0]), h1: at(M.chaud[1]), sp: M.sect.map(at), pluie, surf, vert, carte: M, car: CARD, kt: KT,
      trucks: Array.from({ length: M.trafic || 0 }, (_, i) => ({ lane: [-4.6, 0, 4.6][(i * 2) % 3], v: 25 + (i * 7 % 5) * 1.5, x: 0, y: 0, z: 0, th: 0, idx: 0, d: 0, vx: 0, vz: 0 })) }; // camions : voir trafic()
  }

  function newCar(T) {
    const i = T.n - 8, s = T.S[i]; // 16 m avant la ligne
    return { x: s.x, z: s.z, th: Math.atan2(s.tz, s.tx), vx: 0, vz: 0, steer: 0, yaw: 0, idx: i, dist: -8, d: 0, hit: 0, vf: 0, vl: 0,
      score: 0, cours: 0, mult: 1, glD: 0, glT: 0, // mode Glisse (voir GL) ; glD, glT : durée de la glisse en cours, temps depuis la dernière
      drift: false, slide: 0, driftT: 0, dd: 0, sa: 0, nitro: 0, boost: 0, asp: 0, stun: 0, nDrift: 0, nBoost: 0, nWall: 0, // nitro : la jauge ; boost : elle pousse ; asp : aspiration reçue (0 à 1, course) ; n… : bilan (glisses, coups de nitro, chocs mur)
      manual: false, gear: 0, lastGear: 0, shiftT: 0, rpm: T.car.idle,
      y: s.y, vy: 0, air: false, airT: 0, land: 0 }; // relief : hauteur, vitesse verticale, en l'air, durée du vol en cours, vitesse d'impact à la réception (un seul pas)
  }

  // Contact avec un mur : N = normale unitaire vers le mur, o = enfoncement, T = sens du mur dans le sens de la marche, sgT = côté du mur par rapport à T
  // (+1 = à droite), kw = courbure du mur dans le sens où il fait tourner la voiture (mur extérieur d'un virage > 0)
  function mur(c, Nx, Nz, o, Tx, Tz, sgT, kw, dt) {
    const vn = c.vx * Nx + c.vz * Nz;
    c.x -= Nx * o; c.z -= Nz * o; c.rub = 1;
    if (Math.hypot(c.vx, c.vz) > 15) gagne(c, NI.mur * dt); // frôler le mur remplit la jauge (un choc franc, plus bas, la vide)
    // frotter le mur freine en continu ; et le mur extérieur d'un virage ne remplace pas les pneus : s'y appuyer pour tourner se paie en vitesse, en proportion de ce qu'il fait tourner (rien le long d'un mur droit)
    const v = Math.hypot(c.vx, c.vz), sc = Math.exp(-(WALL_RUB + WALL_MU * Math.max(0, kw * v - 0.1)) * dt); c.vx *= sc; c.vz *= sc;
    const rel = wrap(c.th - Math.atan2(Tz, Tx)), into = rel * sgT > 0 && Math.abs(rel) < 1.5; // nez tourné vers le mur
    c.th -= rel * Math.min(1, (into ? 25 : 4) * dt); // le mur redresse la voiture : volant braqué vers lui, elle glisse le long au lieu de s'y planter
    if (vn > 0) {
      // la perte sèche ne tombe qu'à l'arrivée sur le mur : rester appuyé dessus, volant braqué, ne fait que frotter
      const fresh = !(c.wallT > 0), sa = vn / Math.max(Math.hypot(c.vx, c.vz), 1), k = fresh ? 1 - clamp((sa - WALL_SOFT) * WALL_LOSS, 0, 0.7) : 1;
      c.vx = (c.vx - Nx * vn) * k; c.vz = (c.vz - Nz * vn) * k; c.hit = fresh ? vn : 0; if (fresh && vn > 2) c.nWall++; // pas de rebond : on glisse le long du mur
      c.th += wrap(Math.atan2(Tz, Tx) - c.th) * Math.min(0.5, vn * 0.03);
      if (fresh && sa > WALL_HARD && vn > 5) { c.dd = 0; c.driftT = 0; c.nitro = 0; c.stun = 0.8; } // un vrai choc vide la jauge et coupe le moteur 0,8 s
    }
    c.wallT = 0.4;
  }
  const dansPlace = (T, x, z) => { const P = T.carte.place; return !!P && Math.hypot(x - P.c[0], z - P.c[1]) < P.r; }; // sur la place, on roule partout

  // inp: {steer:-1..1 (droite>0), gas:0..1, brake:0..1, hand:bool}
  // un pas de conduite, roues au sol
  function roule(c, inp, T, dt) {
    const S = T.S, KT = T.kt, CARD = T.car;
    c.steer += clamp(inp.steer - c.steer, -12 * dt, 12 * dt);
    let fx = Math.cos(c.th), fz = Math.sin(c.th);
    let vf = c.vx * fx + c.vz * fz, vl = c.vz * fx - c.vx * fz;
    const sp = Math.abs(vf);
    // Glisse (frein à main tenu + volant, au-dessus de 45 km/h) : elle verrouille son sens (c.dd) tant que le frein à main est tenu ; le volant ne fait plus qu'ouvrir ou fermer le rayon.
    // La voiture se met en travers de c.sa (angle de dérive) mais sa trajectoire tourne au lacet commandé : on serre plus qu'en adhérence, sans perdre de vitesse.
    const Q = surf(T, c.idx);
    if (!c.dd && inp.hand && sp > 12 * (1 - Q.gl) && Math.abs(inp.steer) > 0.3 * (1 - Q.gl)) { c.dd = Math.sign(inp.steer); c.nDrift++; }
    if (c.dd && (!inp.hand || sp < 10 * (1 - Q.gl))) { c.dd = 0; c.driftT = 0; }
    if (c.dd) gagne(c, NI.gl * Math.min(1, c.driftT / 0.6) * Math.min(1, sp / TOP) * dt); // la glisse tenue remplit la jauge, d'autant plus qu'elle dure et qu'elle va vite
    c.aq = Q.aq ? clamp((sp - Q.vaq) / 4, 0, 1) : 0; // route glissante : moins de lacet, encore moins en aquaplaning
    const om = omega(sp, KT) * Math.min(1, sp / 10) * (1 - Q.vir) * (1 - Q.aq * c.aq), sd = c.steer * (c.dd || 0);
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
    const pousse = inp.nitro && inp.gas && c.nitro > 0 ? 1 : 0; if (pousse && !c.boost) c.nBoost++;
    let acc = 0, rup = false;
    if (c.shiftT > 0) c.shiftT -= dt;
    else if (wr > CARD.red && !(pousse && c.gear === CARD.ratios.length - 1)) { acc = -6 * Math.sign(vf); rup = true; } // surrégime : rupteur et gros frein moteur
    else {
      const tqe = inp.gas * torque(CARD, er) - (1 - inp.gas) * (20 + 0.01 * er) * Math.sign(vf); // couple moteur, ou frein moteur pied levé
      acc = Math.min(CARD.trac * (1 - Q.trac), tqe * ratio * CARD.final * CARD.eff / CARD.wheel / CARD.mass); // plafonné par la motricité (~1,1 g en 4 roues motrices, moins en propulsion)
    }
    c.boost = pousse; // (sur le dernier rapport la nitro passe le rupteur : elle pousse aussi une voiture en bout de course ; sur les autres le rupteur tient, sinon une 1re tenue en boîte manuelle garderait tout son couple au-delà du régime maxi)
    if (pousse) { c.nitro = Math.max(0, c.nitro - dt / NI.dur); acc += NI.acc * (rup ? 1 : 1 + NI.rep * Math.max(0, 1 - av / TOP)); } // au rupteur, la poussée de base seulement : il tient toujours
    if (c.stun > 0) { c.stun -= dt; if (acc > 0) acc *= 0.2; }
    vf += acc * dt;
    const s0 = S[c.idx]; if (Math.abs(vf) > 1) vf -= 9.81 * s0.sl * (fx * s0.tx + fz * s0.tz) * dt; // la pente pousse ou retient
    if (inp.brake) vf -= (vf > 0.5 ? 18 : 12) * (1 - Q.frein) * inp.brake * dt;
    if (vf < -12) vf = -12;
    // traînée aérodynamique (½·ρ·Cd·A·v²), résistance au roulement, et un peu de vitesse perdue en tournant
    if (c.asp) gagne(c, NI.asp * c.asp * dt); // dans l'aspiration : moins de traînée, et la jauge monte
    vf -= (0.6 * CARD.cd * CARD.area * (1 - NI.acx * c.asp) * vf * Math.abs(vf) / CARD.mass +((Math.abs(vf) > 0.3 ? 0.15 + Q.roul : 0) + KT.tv * Math.abs(c.yaw) * Math.min(1, sp / 10)) * Math.sign(vf)) * dt;
    // pas de pneus qui décrochent : la vitesse suit le nez de la voiture (décalé de l'angle de dérive en glisse), sans rien perdre ; un choc de côté est rattrapé en un dixième de seconde
    const v0 = Math.hypot(vf, vl);
    vl += (-Math.sin(c.sa) * v0 - vl) * Math.min(1, 25 * (1 - Q.colle) * (1 - Q.aqc * c.aq) * dt); // sur une route glissante, la vitesse suit le nez avec retard : la voiture chasse
    if (v0 > 1) { const k = v0 / Math.max(Math.hypot(vf, vl), 1e-3); vf *= k; vl *= k; }
    c.slide = Math.min(1, Math.abs(c.sa) / KT.ang); c.drift = !!c.dd;
    if (c.dd) c.driftT += dt;
    c.vx = fx * vf - fz * vl; c.vz = fz * vf + fx * vl;
    c.x += c.vx * dt; c.z += c.vz * dt; c.vf = vf; c.vl = vl;
  }
  // un pas en l'air : la voiture garde son cap et sa vitesse, moins la traînée ; gaz tenus, le moteur prend ses tours à vide
  function vole(c, inp, CARD, dt) {
    const k = 1 - 0.6 * CARD.cd * CARD.area * Math.hypot(c.vx, c.vz) / CARD.mass * dt;
    c.vx *= k; c.vz *= k; c.x += c.vx * dt; c.z += c.vz * dt; c.yaw = 0; c.airT += dt; c.boost = 0; // pas de nitro en l'air
    if (inp.gas) c.rpm += (CARD.red - c.rpm) * Math.min(1, dt * 6);
  }

  function step(c, inp, T, dt) {
    const S = T.S, n = T.n;
    points(c, dt); // (avant le pas : c.hit porte encore le choc du pas précédent, camions compris)
    if (c.air) vole(c, inp, T.car, dt); else roule(c, inp, T, dt);
    // position sur la piste + murs (impossible de couper : un tour bouclé est toujours valide)
    let b = c.idx, bd = 1e9;
    // sur la place on coupe où l'on veut : on cherche l'échantillon le plus proche bien plus loin devant
    for (let j = -6, jm = dansPlace(T, c.x, c.z) ? 250 : 14; j <= jm; j++) { const i = (c.idx + j + n) % n, s = S[i], d = (s.x - c.x) ** 2 + (s.z - c.z) ** 2; if (d < bd) { bd = d; b = i; } }
    c.dist += ((b - c.idx + n + n / 2) % n) - n / 2;
    c.idx = b;
    const s = S[b], nx = -s.tz, nz = s.tx, L = s.w - 1.1;
    c.d = (c.x - s.x) * nx + (c.z - s.z) * nz; c.hit = 0; c.rub = 0; c.wallT = (c.wallT || 0) - dt;
    const o = Math.abs(c.d) - L, P = T.carte.place, pr = P ? Math.hypot(c.x - P.c[0], c.z - P.c[1]) - (P.r - 1.1) : Infinity; // pr > 0 : hors du cercle de la place
    if (o > 0 && pr > 0) { // hors de la chaussée et hors de la place : le mur le plus proche
      if (pr < o) { const dx = (c.x - P.c[0]) / (pr + P.r - 1.1), dz = (c.z - P.c[1]) / (pr + P.r - 1.1), t = c.vx * -dz + c.vz * dx > 0 ? 1 : -1; mur(c, dx, dz, pr, -dz * t, dx * t, -t, 1 / P.r, dt); }
      else { const sg = Math.sign(c.d); c.d = sg * L; mur(c, nx * sg, nz * sg, o, s.tx, s.tz, sg, -s.k * sg, dt); }
    }
    // les piles d'un monument posé sur la place (arc de triomphe) : boîtes dans le repère du monument, deux cercles par voiture comme pour les chocs entre voitures
    if (P && P.piles) { const cs = Math.cos(P.a), sn = Math.sin(P.a);
      for (const j of [-CO, CO]) for (const [px, pz, hx, hz] of P.piles) {
        const qx = c.x + Math.cos(c.th) * j - P.c[0], qz = c.z + Math.sin(c.th) * j - P.c[1], lx = qx * cs - qz * sn, lz = qx * sn + qz * cs;
        const ex = lx - clamp(lx, px - hx, px + hx), ez = lz - clamp(lz, pz - hz, pz + hz), d = Math.hypot(ex, ez);
        if (d >= CR || d < 1e-6) continue;
        const ax = -ex / d, az = -ez / d, Nx = ax * cs + az * sn, Nz = -ax * sn + az * cs, t = c.vx * -Nz + c.vz * Nx > 0 ? 1 : -1; // normale vers la pile, en repère du monde
        mur(c, Nx, Nz, CR - d, -Nz * t, Nx * t, -t, 0, dt);
      }
    }
    // le terre-plein du monument : couronne de bornes à chaînes de rayon ile[0], ouverte sur ile[1] m de part et d'autre de l'axe de la grande arche ; un mur mince, qu'on frotte des deux côtés
    if (P && P.ile) { const qx = c.x - P.c[0], qz = c.z - P.c[1], r = Math.hypot(qx, qz), e = r - P.ile[0];
      if (Math.abs(e) < CR && Math.abs(qx * Math.cos(P.a) - qz * Math.sin(P.a)) > P.ile[1]) { const sg = e < 0 ? 1 : -1, Nx = sg * qx / r, Nz = sg * qz / r, t = c.vx * -Nz + c.vz * Nx > 0 ? 1 : -1;
        mur(c, Nx, Nz, CR - Math.abs(e), -Nz * t, Nx * t, -t, sg / P.ile[0], dt); } }
    // relief : chute libre, sauf si le sol est là
    const g = sol(T, c);
    if (!T.vert) { c.y = g; return; }
    const vy = c.vy - GRAV * dt, y = c.y + vy * dt, sg = (c.x - s.x) * s.tx + (c.z - s.z) * s.tz < 0 ? S[(b - 1 + n) % n] : s, vg = sg.sl * (c.vx * sg.tx + c.vz * sg.tz); c.land = 0; // sg : le tronçon de ruban sous la voiture ; vg : la vitesse verticale que sa pente donne à la voiture (la paroi n'y compte pas : y monter ne lance pas en l'air)
    const p = pente(s, c.d);
    if (y > g && (c.airT || !p)) { c.y = y; c.vy = vy; c.air = y - g > DROOP; return; } // (sur une paroi on ne décolle pas : la vitesse y plaque la voiture, elle suit la surface)
    if (c.airT) { c.land = vg - vy; const k = 1 - clamp((c.land - LAND0) * LANDK, 0, LANDX); c.vx *= k; c.vz *= k; c.airT = 0; }
    c.y = g; c.vy = vg; c.air = false;
    // sur une paroi, la gravité tire vers le bas de la pente : en travers de la voiture elle la fait tourner (c'est le virage relevé qui porte), dans son axe elle la freine en montée et la relance en descente
    // et les pneus, écrasés contre le béton, tournent d'autant plus fort : le lacet du volant y gagne le facteur de charge 1 / cos(pente)
    if (p) { const a = -GRAV * p; c.vx += nx * a * dt; c.vz += nz * a * dt; c.th += ((nz * Math.cos(c.th) - nx * Math.sin(c.th)) * a / Math.max(4, Math.hypot(c.vx, c.vz)) + c.yaw * (Math.sqrt(1 + p * p) - 1)) * dt; }
  }

  // Pilote automatique : sert au test node, au mode ?auto, à ramener la voiture après l'arrivée, et aux adversaires en course.
  // lvl = niveau du pilote (1 = tour propre de référence ; plus bas = moins de gaz et virages plus lents).
  // others = voitures à éviter : il se décale pour doubler une voiture plus lente, ne se rabat pas tant qu'elle est à sa hauteur, et freine s'il est bloqué derrière.
  // vitesse permise à l'échantillon idx = celle de chaque virage de la trajectoire à venir, plus ce qu'on peut perdre en freinant d'ici là (10 m/s², 2 m par échantillon)
  // sur une surface glissante (SURF) : virages au lacet qu'elle laisse (avec une marge là où le nez tarde plus que sous la pluie : la voiture élargit), sans dépasser le seuil d'aquaplaning là où il ne passerait plus, et freinage plus long
  // Elle ne dépend que de l'échantillon : calculée une fois par échantillon et gardée dans T.va (200 virages regardés, 8 fois par image en course sinon). Sert au pilote automatique et à l'alerte de virage du HUD.
  function vAdmise(T, idx) {
    const S = T.S, n = T.n;
    if (T.vaSurf !== T.surf) { T.va = new Float64Array(n).fill(-1); T.vaSurf = T.surf; } // (elle dépend aussi de la surface : si T.surf change, on repart de zéro)
    const VA = T.va;
    let va = VA[idx];
    if (va < 0) {
      va = 1e9; let fr = 0; // fr : ce que le freinage peut reprendre d'ici là, surface par surface (une plaque de glace devant se freine avant)
      for (let j = 0; j < 200; j++) {
        const i = (idx + j) % n, Q = surf(T, i), k = Math.abs(S[i].kl) + 1e-4, g = 1.3 * (1 - Q.vir) * (1 - 0.8 * Math.max(0, Q.colle - 0.5)), vq = Q.vaq;
        let v = vturn(g, k, T.kt); if (Q.aq && v > vq) v = Math.max(vq, vturn(g * (1 - Q.aq) * 0.7, k, T.kt)); // au-delà du seuil d'aquaplaning, avec de la marge : la voiture y chasse
        va = Math.min(va, Math.sqrt(v ** 2 + fr)); fr += 40 * (1 - Q.frein);
      }
      VA[idx] = va;
    }
    return va;
  }
  // alerte de virage du HUD, à la vitesse sp (m/s) depuis l'échantillon idx : seulement un virage qui, entre 1,2 s et 3,6 s devant, oblige à perdre plus d'un tiers de cette vitesse (surface comprise).
  // Rend +1 (droite), -1 (gauche) ou 0. (L'ancienne règle, toute courbe de moins de 90 m de rayon au-dessus de 108 km/h, sonnait jusqu'à dix fois par tour.)
  function alerteVirage(T, idx, sp, f = 0.65) {
    if (sp < 15) return 0;
    const S = T.S, n = T.n, D = Math.round(sp * 0.6); let vmin = 1e9, sg = 0;
    for (let j = D; j < 3 * D; j++) { const i = (idx + j) % n, Q = surf(T, i), g = 1.3 * (1 - Q.vir) * (1 - 0.8 * Math.max(0, Q.colle - 0.5)), v = vturn(g, Math.abs(S[i].kl) + 1e-4, T.kt); if (v < vmin) { vmin = v; sg = Math.sign(S[i].k); } }
    return vmin < sp * f ? sg : 0;
  }
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
    // sous le niveau 1, la pointe baisse aussi : sur une carte où la voiture tape le rupteur (Paris, l'arène), le niveau ne jouait que dans les virages et les rivaux se tenaient en procession
    const C = T.car, vg = T.vg || (T.vg = C.red / 60 * 2 * Math.PI * C.wheel / (C.ratios[C.ratios.length - 1] * C.final)); // vg : la pointe au rupteur, sur le dernier rapport
    const va = vAdmise(T, c.idx), vt = Math.min(vcap, va * lvl * (off ? 0.9 : 1), lvl < 1 ? vg * lvl : 1e9); // hors trajectoire, on passe moins vite
    const st = clamp(e * 3, -1, 1);
    return { steer: st, gas: sp < vt ? lvl : 0, brake: sp > vt + 3 ? 1 : 0, hand: false, nitro: sp < vt - 8 && Math.abs(st) < 0.25 && (c.boost > 0 || c.nitro > 0.3) }; // la nitro : en ligne droite, loin du prochain freinage, par coups francs (il attend d'avoir un tiers de jauge)
  }

  // ---------- Course contre des adversaires IA ----------
  // API pour game.js (aucun rendu ici) :
  //   R = newRace(T, laps = 3, lvls = AI_LVL, el = 0, opt = {})  crée la course. R.cars[0] = joueur (dernier sur la grille), R.cars[1..] = adversaires, le plus rapide en tête ; opt.grille[i] = place de départ de la voiture i (0 = pole), pour une autre grille.
  //   stepRace(R, inp, dt)                     avance toutes les voitures d'un pas (dt = 1/120). inp = commandes du joueur, comme step() ;
  //                                            inp = null : le joueur est conduit par l'IA (mode ?auto, ou après son arrivée). Ne pas appeler pendant le décompte.
  //   Plusieurs humains (écran partagé) : newRace(T, laps, lvls, el, { humains: 2 }). Les humains sont les premières voitures (R.cars[0] = joueur 1, R.cars[1] = joueur 2, puis les IA de lvls),
  //     sur les dernières places de la grille (joueur 1 dernier). stepRace(R, [inp1, inp2], dt) : une entrée par humain ; entrée absente ou nulle = le pilote automatique conduit cet humain.
  //     L'élastique des IA se règle sur la moyenne des humains encore en course. R.h = nombre d'humains.
  //   Glisse en duel : newRace(T, 2, [], 0, { humains: 2, delai }), delai en secondes pour chaque voiture. c.score, c.cours, c.mult comme en solo ; un choc entre voitures (c.bump > 2) casse l'enchaînement ;
  //     c.pts = score de la manche, figé à l'arrivée de la voiture, nul si elle arrive hors délai.
  //   R.t = temps de course (s) ; R.done = true quand tout le monde est arrivé ; R.laps = nombre de tours.
  //   Par voiture, en plus des champs de newCar() (x, z, th, vf, rpm, drift, hit...) :
  //     c.pos  = place en direct (1 = premier)     c.lap = tour en cours (1..laps)
  //     c.fin  = temps final (s), 0 tant qu'elle n'est pas arrivée ; après l'arrivée la voiture continue de rouler
  //     c.bump = vitesse d'impact (m/s) d'un choc contre une autre voiture pendant ce pas, sinon 0 (c.hit reste le choc contre un mur)
  //     c.dist = progression en échantillons de 2 m depuis la ligne (tours cumulés) ; c.lvl = niveau du pilote
  //   raceOrder(R) = les voitures triées par place : c'est aussi le classement final, une fois R.done.
  //   Variante à élimination : newRace(T, laps, lvls, el, { elim: true }). Autant de tours que de voitures (laps est ignoré) ; à chaque passage de ligne du meneur à partir de la fin du tour 2,
  //     la dernière voiture en piste sort : c.out = temps de sa sortie (0 sinon), elle n'a pas de c.fin. Le premier tour est protégé, le dernier se joue à deux. Classement = ordre inverse des sorties.
  //     Une voiture sortie se range sur le côté et s'arrête ; elle ne touche plus personne, n'aspire personne, et le pilote automatique des autres l'ignore. R.done : le vainqueur a passé la ligne.
  // DIFF : les trois difficultés du menu. k multiplie le niveau des adversaires ; el = élastique : jusqu'à ±el de rythme selon l'écart au joueur (plein effet à 300 m),
  // l'IA de tête lève un peu le pied quand le joueur est loin derrière et pousse quand il mène. Niveau plafonné à LVL_MAX : au-delà le pilote automatique touche les murs.
  const DIFF = [{ nom: 'DETENTE', k: 0.93, el: 0.05 }, { nom: 'NORMAL', k: 1, el: 0.03 }, { nom: 'CHAUD', k: 1.04, el: 0.015 }], LVL_MAX = 1.04;
  const AI_LVL = [0.99, 0.97, 0.95]; // niveau de chaque adversaire : le seul réglage de rythme (1 = tour propre du pilote automatique)
  const CR = 1.1, CO = 1.2; // une voiture = 2 cercles de rayon CR, à ±CO m le long de son axe (4,6 m × 2,2 m)

  function newRace(T, laps = 3, lvls = AI_LVL, el = 0, opt = {}) {
    const h = opt.humains || 1, N = h + lvls.length; // les humains d'abord (0 = joueur 1, 1 = joueur 2), en fond de grille : le joueur 1 dernier, comme en solo
    const cars = [...Array(h).fill(1), ...lvls].map((lvl, i) => {
      const c = newCar(T), k = opt.grille ? opt.grille[i] : i < h ? N - 1 - i : i - h, j = T.n - 8 - 4 * k, s = T.S[j], d = k % 2 ? 3 : -3; // grille en quinconce, 8 m entre deux places
      return Object.assign(c, { x: s.x - s.tz * d, z: s.z + s.tx * d, y: s.y, th: Math.atan2(s.tz, s.tx), idx: j, dist: -8 - 4 * k, d, lvl, pos: k + 1, lap: 1, fin: 0, out: 0, bump: 0 });
    });
    return { T, cars, laps: opt.elim ? cars.length : laps, el, elim: !!opt.elim, h, delai: opt.delai || 0, tete: 0, t: 0, done: false };
  }

  // Tournée : toutes les cartes à la suite, des points à chaque manche. Les voitures sont désignées par leur indice dans R.cars (0 = joueur, 1.. = rivaux de la carte : les points suivent la place sur la liste, pas le nom).
  // tournee(pts, arrivee) : pts = points de chaque voiture avant la manche, arrivee = indices des voitures dans l'ordre d'arrivée (vide : rien n'est encore couru). Fonction pure, rend
  //   pts (points après la manche), classement (indices, du meneur au dernier ; à égalité le joueur devant, puis le rival le plus lent) et grille (grille[i] = place de départ de la voiture i, 0 = pole :
  //   l'ordre inverse du classement, à donner à newRace par opt.grille). À zéro partout, c'est la grille d'une course ordinaire.
  const BAREME = [10, 6, 3, 1];
  function tournee(pts, arrivee = []) {
    pts = pts.map((p, i) => p + (BAREME[arrivee.indexOf(i)] || 0));
    const n = pts.length, classement = pts.map((_, i) => i).sort((a, b) => pts[b] - pts[a] || (b || n) - (a || n));
    return { pts, classement, grille: pts.map((_, i) => n - 1 - classement.indexOf(i)) };
  }

  const raceOrder = R => [...R.cars].sort((a, b) => (a.fin || 1e9) - (b.fin || 1e9) || (b.out || 1e9) - (a.out || 1e9) || b.dist - a.dist); // arrivées, puis en piste, puis sorties (la dernière sortie devant)
  // une voiture sortie (élimination) : elle vise le bord de la route et freine jusqu'à l'arrêt
  function range(c, T) {
    const la = T.S[(c.idx + 6) % T.n], off = (c.d < 0 ? -1 : 1) * (la.pl - 2.6);
    return { steer: clamp(wrap(Math.atan2(la.z + la.tx * off - c.z, la.x - la.tz * off - c.x) - c.th) * 3, -1, 1), gas: 0, brake: c.vf > 1 ? 0.8 : 0, hand: false }; // (frein tenu à l'arrêt = marche arrière)
  }

  // Choc entre deux voitures de même masse : on les écarte de moitié chacune et on échange la vitesse le long de la normale (rebond de 20 %).
  // La vitesse tangentielle est conservée : un contact latéral pousse sans freiner.
  function collide(a, b) {
    if (Math.abs(a.y - b.y) > 1.5) return; // l'une passe au-dessus de l'autre
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
    // inp : une entrée par humain (ou une seule, hors tableau, pour le joueur seul) ; entrée absente = le pilote automatique conduit cet humain
    const inps = Array.isArray(inp) ? inp : [inp], ia = cars.map((c, i) => i >= R.h || !inps[i]);
    // élastique : l'écart à la moyenne des humains encore en course (tous arrivés ou sortis : à leur moyenne à tous), pour ne favoriser aucun des deux ; à un humain, c'est l'écart à la voiture 0
    const hum = cars.slice(0, R.h), enc = hum.filter(c => !c.fin && !c.out), ref = enc.length ? enc : hum, pd = ref.reduce((s, c) => s + c.dist, 0) / ref.length;
    const rub = c => Math.min(LVL_MAX, c.lvl * (1 - R.el * clamp((c.dist - pd) / 150, -1, 1)));
    // une voiture arrivée lève le pied : elle finit son tour au ralenti au lieu de repartir à fond
    const piste = R.elim ? cars.filter(c => !c.out) : cars; // les voitures encore en course : les seules qui se touchent, s'aspirent et s'évitent
    const ins = cars.map((c, i) => c.out ? range(c, T) : ia[i] ? autopilot(c, T, c.fin ? 0.6 : i < R.h ? c.lvl : rub(c), piste) : inps[i]);
    for (const c of cars) c.bump = 0; ins.forEach((p, i) => { const c = cars[i]; if (c.fin && ia[i] && Math.hypot(c.vx, c.vz) > 28) { p.gas = 0; p.brake = Math.max(p.brake, 0.3); } }); // tour d'honneur à 100 km/h
    // les chocs entre voitures d'abord, puis step() : les murs ont le dernier mot, aucune voiture ne peut être poussée hors piste
    for (let i = 0; i < piste.length; i++) for (let j = i + 1; j < piste.length; j++) collide(piste[i], piste[j]);
    for (const c of piste) if (c.bump > 2) { c.cours = 0; c.glD = 0; c.mult = 1; } // Glisse : un choc entre voitures casse l'enchaînement, comme un mur (voir points() ; le score ne touche pas à la physique)
    // aspiration : c.asp = 1 collé derrière une voiture lancée, 0 à NI.ad mètres ou hors du cône (la plus forte l'emporte)
    for (const c of cars) { c.asp = 0; const fx = Math.cos(c.th), fz = Math.sin(c.th);
      for (const o of piste) { const dx = o.x - c.x, dz = o.z - c.z, lon = dx * fx + dz * fz;
        if (o !== c && lon > 3 && lon < NI.ad && Math.abs(dz * fx - dx * fz) < 1 + NI.ac * lon && o.vx * fx + o.vz * fz > 20 && Math.abs(o.y - c.y) < 1.5) c.asp = Math.max(c.asp, 1 - lon / NI.ad); } }
    cars.forEach((c, i) => {
      step(c, ins[i], T, dt);
      c.lap = clamp(Math.floor(c.dist / T.n) + 1, 1, R.laps);
      if (!c.fin && !c.out && c.dist >= R.laps * T.n) { c.fin = R.t; c.pts = R.delai && R.t > R.delai ? 0 : c.score; } // c.pts : le score de Glisse figé à l'arrivée, nul hors délai
    });
    if (R.elim) { const o = raceOrder(R).filter(c => !c.out), tete = Math.floor(o[0].dist / T.n); // le meneur passe la ligne : dès la fin du tour 2, la dernière en piste sort
      if (tete > R.tete) { R.tete = tete; if (tete >= 2 && o.length > 1) o[o.length - 1].out = R.t; } }
    raceOrder(R).forEach((c, i) => c.pos = i + 1);
    R.done = cars.every(c => c.fin || c.out);
  }

  // ---------- Trafic (cartes qui en ont : champ trafic de cartes.js) ----------
  // Des camions à vitesse constante sur trois files. Leur position ne dépend que du temps écoulé depuis le départ : même trafic à chaque essai.
  // trafic(T, t) renvoie la liste (objets réutilisés : x, y, z, th, idx, d, vx, vz), utilisable aussi comme `others` du pilote automatique.
  // hitTrafic(c, T, t) : choc voiture contre camion. Le camion ne bouge pas ; la voiture est repoussée et le choc est signalé dans c.hit, comme un mur.
  function trafic(T, t) {
    const S = T.S, n = T.n, TRUCKS = T.trucks;
    TRUCKS.forEach((k, i) => {
      const p = (i / TRUCKS.length * n + 40 + k.v * t / 2) % n, j = p | 0, f = p - j, a = S[j], b = S[(j + 1) % n];
      k.idx = j; k.d = k.lane; k.th = Math.atan2(a.tz, a.tx); k.vx = a.tx * k.v; k.vz = a.tz * k.v;
      k.x = lerp(a.x, b.x, f) - a.tz * k.lane; k.z = lerp(a.z, b.z, f) + a.tx * k.lane; k.y = lerp(a.y, b.y, f);
    });
    return TRUCKS;
  }
  function hitTrafic(c, T, t, dt = 1 / 120) {
    for (const k of trafic(T, t)) {
      if (Math.abs(((k.idx - c.idx + T.n + T.n / 2) % T.n) - T.n / 2) > 12) continue;
      const kx = Math.cos(k.th), kz = Math.sin(k.th), cx = Math.cos(c.th), cz = Math.sin(c.th); let touche = 0;
      for (const i of [-4, 0, 4]) for (const j of [-1.2, 1.2]) { // camion = 3 cercles de 1,4 m, voiture = 2 cercles de 1,1 m
        const dx = c.x + cx * j - k.x - kx * i, dz = c.z + cz * j - k.z - kz * i, d = Math.hypot(dx, dz);
        if (d >= 2.5 || d < 1e-6) continue; touche = 1;
        const nx = dx / d, nz = dz / d, vn = -((c.vx - k.vx) * nx + (c.vz - k.vz) * nz);
        c.x += nx * (2.5 - d); c.z += nz * (2.5 - d);
        if (vn > 0) { c.vx += nx * vn * 1.2; c.vz += nz * vn * 1.2; c.hit = Math.max(c.hit, vn); if (vn > 3) { c.driftT = 0; c.nitro = 0; c.stun = 0.8; } }
      }
      // doublé au ras (moins de 1,2 m entre les flancs), sans contact, avec au moins 8 m/s de mieux que lui : la jauge monte
      const dx = c.x - k.x, dz = c.z - k.z; if (!touche && Math.abs(dx * kx + dz * kz) < 7 && Math.abs(dz * kx - dx * kz) < 3.7 && c.vx * kx + c.vz * kz > k.v + 8) gagne(c, NI.cam * dt);
    }
  }

  // --- fantômes ---
  // Une trace = [x, y, z, cap, …] à cadence fixe (20 Hz dans le jeu). etire(trace, k) : la même, k fois plus lente (k < 1 : plus rapide), à la même cadence ; le cap tourne par le plus court.
  function etire(tr, k) {
    const n = tr.length / 4, o = []; if (n < 2) return tr.slice();
    for (let j = 0; j / k <= n - 1 + 1e-9; j++) { const p = Math.min(n - 1, j / k), i = Math.min(n - 2, Math.floor(p)) * 4, f = p - i / 4;
      for (let q = 0; q < 3; q++) o.push(tr[i + q] + (tr[i + 4 + q] - tr[i + q]) * f); o.push(tr[i + 3] + wrap(tr[i + 7] - tr[i + 3]) * f); }
    return o;
  }
  // Tour de référence des médailles : le tour lancé du pilote automatique, parti avec une jauge de nitro pleine qu'il dépense en ligne droite (ce qu'un bon tour en gagne). Rend son temps et sa trace à 20 Hz.
  function tourRef(T, dt = 1 / 120) {
    const c = newCar(T), trace = []; let t = 0, t1 = 0, i = 0;
    while (c.dist < 2 * T.n && t < 900) { step(c, autopilot(c, T), T, dt); t += dt; if (!t1 && c.dist >= T.n) { t1 = t; c.nitro = 1; } if (t1 && i++ % 6 === 0) trace.push(c.x, c.y, c.z, c.th); }
    return { t: t - t1, trace };
  }
  // --- défi par lien ---
  // Un défi = « version.carte.données » : la version de la physique (celle des clés de records, vpr7), l'identifiant de la carte, puis en base64 pour URL : le temps du tour (ms, 3 octets),
  // les positions à 5 Hz (un point sur quatre de la trace à 20 Hz) quantifiées à 10 cm et le cap à 1/256 de tour, et 2 octets de contrôle.
  // Compression : x et z en différences secondes (l'écart à la vitesse du point d'avant : presque toujours un octet), y et le cap en différences. On transporte des positions, jamais des commandes :
  // la simulation ne donne pas exactement le même résultat d'un navigateur à l'autre. Les traces or des cartes (traces-or.js) sont dans le même format.
  const DEFI_V = 7, DEFI_ERR = ['LIEN DE DEFI ILLISIBLE', "LIEN D'UNE AUTRE VERSION DU JEU", 'LIEN DE DEFI ABIME OU TRONQUE'];
  const controle = (tete, B, n) => { let s = 7; for (let i = 0; i < tete.length; i++) s = (s * 31 + tete.charCodeAt(i)) & 65535; for (let i = 0; i < n; i++) s = (s * 31 + B[i]) & 65535; return s; };
  function defiCode(carte, t, tr) {
    const ms = Math.round(t * 1000), B = [ms & 255, ms >> 8 & 255, ms >> 16 & 255], p = [0, 0, 0, 0], d = [0, 0];
    const vi = v => { v = v < 0 ? -2 * v - 1 : 2 * v; while (v > 127) { B.push(v % 128 + 128); v = Math.floor(v / 128); } B.push(v); }; // entier signé, 7 bits par octet
    for (let i = 0; i + 3 < tr.length; i += 16) {
      const q = [Math.round(tr[i] * 10), Math.round(tr[i + 2] * 10), Math.round(tr[i + 1] * 10), Math.round(tr[i + 3] * 128 / Math.PI) & 255];
      for (let k = 0; k < 2; k++) { vi(q[k] - p[k] - d[k]); d[k] = q[k] - p[k]; } vi(q[2] - p[2]); B.push((q[3] - p[3]) & 255);
      for (let k = 0; k < 4; k++) p[k] = q[k];
    }
    const tete = DEFI_V + '.' + carte + '.', s = controle(tete, B, B.length); B.push(s & 255, s >> 8);
    return tete + btoa(String.fromCharCode(...B)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  // Rend { carte, t, trace à 20 Hz }, ou { err: message } pour un lien illisible, d'une autre version ou abîmé : jamais d'exception.
  function defiLit(lien) {
    const m = /^(\d+)\.([a-z0-9]+)\.([A-Za-z0-9_-]+)$/.exec(typeof lien === 'string' ? lien : ''); if (!m) return { err: DEFI_ERR[0] };
    if (+m[1] !== DEFI_V) return { err: DEFI_ERR[1] };
    let B; try { B = Array.from(atob(m[3].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)); } catch (e) { return { err: DEFI_ERR[2] }; }
    const fin = B.length - 2; if (fin < 3 || controle(m[1] + '.' + m[2] + '.', B, fin) !== B[fin] + B[fin + 1] * 256) return { err: DEFI_ERR[2] };
    let i = 3, ok = true; const tr = [], p = [0, 0, 0, 0], d = [0, 0];
    const vi = () => { let v = 0, k = 1, b; do { if (i >= fin) { ok = false; return 0; } b = B[i++]; v += (b & 127) * k; k *= 128; } while (b > 127); return v % 2 ? -(v + 1) / 2 : v / 2; };
    while (i < fin && ok) { for (let k = 0; k < 2; k++) { d[k] += vi(); p[k] += d[k]; } p[2] += vi(); if (i >= fin) { ok = false; break; } p[3] = (p[3] + B[i++]) & 255; tr.push(p[0] / 10, p[2] / 10, p[1] / 10, p[3] * Math.PI / 128); }
    const t = (B[0] + B[1] * 256 + B[2] * 65536) / 1000;
    return ok && tr.length >= 8 && t > 0 && Math.abs((tr.length / 4 - 1) / 5 - t) < 1.5 ? { carte: m[2], t, trace: etire(tr, 4) } : { err: DEFI_ERR[2] };
  }

  Object.assign(G, { DEFI_V, DEFI_ERR, defiCode, defiLit, etire, tourRef, vAdmise, alerteVirage, sol, paroi, pente, dansPlace, buildTrack, newCar, step, autopilot, newRace, stepRace, raceOrder, tournee, BAREME, trafic, hitTrafic, AI_LVL, DIFF, TOP, vturn, omega, SURF, GL });
})(typeof window !== 'undefined' ? window : globalThis);
