// Placement des décors des cartes autres que la ville (qui reste dans game.js). Chaque décor est une fonction DECORS[id](h) appelée une fois au chargement.
// Ce fichier ne dit que OÙ poser QUOI avec QUELLE texture : les formes sont dans formes.js, les textures dans textures.js.
// h = outils de game.js : THREE, scene, T/S/N/W (piste), M (carte), ribbon, rnd, across, zone, temps (horloge du trafic),
//   geo('forme', ...réglages)                  = géométrie d'une forme simple, pour inst()
//   mat('texture', options, ...réglages)       = matière ; options : lum (lumineuse par elle-même), c (teinte), retro, gloss, rep (répétition), et celles de three
//   pose('forme', peau, parent, [x, y, z], ...réglages) = pose une forme ; peau = une matière, ou { zone: matière } pour un assemblage
//   habille(géométrie, matière)                = règle la densité de la texture sur une boîte (fait par pose et inst)
//   lum(i, x, y, z, couleur, portée, force)    = déclare un luminaire à l'échantillon de piste i
// Elle construit le décor autour du tracé et peut renvoyer une fonction tick(dt, now) pour ce qui bouge.
(function () {
  // Pose une liste d'objets identiques en une seule passe de dessin. Élément : [x, y, z, rotationY, échelleX, échelleY, échelleZ].
  function inst(h, geo, mat, list) {
    const m = new h.THREE.InstancedMesh(h.habille(geo, mat), mat, Math.max(1, list.length)), d = new h.THREE.Object3D();
    list.forEach((p, i) => { d.position.set(p[0], p[1], p[2]); d.rotation.set(0, p[3] || 0, 0); d.scale.set(p[4] || 1, p[5] || p[4] || 1, p[6] || p[4] || 1); d.updateMatrix(); m.setMatrixAt(i, d.matrix); });
    m.count = list.length; m.frustumCulled = false; m.castShadow = m.receiveShadow = h.TH.sun[1] > 0.6; h.scene.add(m); return m; // soleil rasant (Paris, canal) : tout le décor porte une ombre ; de nuit ce serait du temps de rendu pour rien
  }
  const near = (h, x, z) => { let b = 0, bd = 1e18; h.S.forEach((s, i) => { const d = (s.x - x) ** 2 + (s.z - z) ** 2; if (d < bd) { bd = d; b = i; } }); return b; };
  const pt = (h, i) => near(h, h.M.pts[i][0] * h.M.sc, h.M.pts[i][1] * h.M.sc); // échantillon de piste le plus proche du point de contrôle i
  // pose un assemblage en nombre : une passe de dessin par zone, quel que soit le nombre d'exemplaires. Élément comme pour inst
  // o.a = réglages de la forme ; o.teinte = la zone qui prend la couleur de chaque élément (8e valeur : 0xrrggbb)
  const insts = (h, nom, peau, list, o = {}) => Object.entries(h.zones(nom, peau, ...(o.a || []))).map(([zn, g]) => {
    const m = inst(h, g, peau[zn], list); if (zn === o.teinte && list.length) { list.forEach((p, i) => m.setColorAt(i, new h.THREE.Color(p[7]))); m.instanceColor.needsUpdate = true; } return m;
  });
  const LUM = { lum: 1 }; // matière lumineuse par elle-même : vitrine, enseigne, feu
  const boite = (h, m, w, ht, d, x, y, z) => h.pose('boite', m, h.scene, [x, y, z], w, ht, d); // pièce unique aux dimensions libres
  // un point au bord de la route : échantillon s, côté sd (-1 gauche, 1 droite), à `off` mètres de l'axe
  const bord = (s, sd, off) => [s.x - s.tz * sd * off, s.z + s.tx * sd * off];
  // un groupe posé sur la route à l'échantillon s : X local = en travers (positif à droite), Z local = vers l'arrière
  const repere = (h, s) => { const g = new h.THREE.Group(); g.position.set(s.x, s.y, s.z); g.rotation.y = h.across(s); h.scene.add(g); return g; };

  // Terrain : un champ de hauteur qui passe par la route. Chaque sommet prend l'altitude des portions de route voisines (moyenne pondérée par
  // la distance) : la route se retrouve posée sur une pente, les lacets empilés deviennent des terrasses, un canal se creuse entre deux voies.
  // o = { pas, marge, mat, loin, chute (au-delà de `loin` mètres de la route, le sol descend de `chute` m par mètre), creux(x, z),
  //       sol(s) = altitude du sol sous l'échantillon s quand la route n'est pas posée dessus (viaduc, pont) }
  // Renvoie hAt(x, z) = altitude du sol et dAt(x, z) = distance à la route, pour y poser le décor.
  function terrain(h, o) {
    const { THREE, S, W } = h, pas = o.pas, sol = o.sol || (s => s.y);
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const s of S) { x0 = Math.min(x0, s.x); x1 = Math.max(x1, s.x); z0 = Math.min(z0, s.z); z1 = Math.max(z1, s.z); }
    x0 -= o.marge; z0 -= o.marge; x1 += o.marge; z1 += o.marge;
    const nx = Math.ceil((x1 - x0) / pas) + 1, nz = Math.ceil((z1 - z0) / pas) + 1, Y = new Float32Array(nx * nz), D = new Float32Array(nx * nz), sub = S.filter((s, i) => i % 3 === 0).map(s => ({ x: s.x, z: s.z, g: sol(s), pose: sol(s) > s.y - 0.5 }));
    const pos = new Float32Array(nx * nz * 3), uv = new Float32Array(nx * nz * 2), idx = [];
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
      const x = x0 + ix * pas, z = z0 + iz * pas, k = iz * nx + ix; let sw = 0, sy = 0, dm = 1e18, pm = null;
      for (const s of sub) { const d2 = (s.x - x) ** 2 + (s.z - z) ** 2, w = 1 / ((d2 + 100) * (d2 + 100)); sw += w; sy += w * s.g; if (d2 < dm) { dm = d2; pm = s; } }
      const d = Math.sqrt(dm); let y = sy / sw - 0.5;
      if (d < W + 1 && pm.pose) y -= 1.5; // sous la chaussée : on creuse, la route et ses murets cachent le raccord
      if (o.loin && d > o.loin) y -= (d - o.loin) * o.chute;
      if (o.creux) y -= o.creux(x, z);
      Y[k] = y; D[k] = d; pos.set([x, y, z], k * 3); uv.set([x / 10, z / 10], k * 2);
      if (ix < nx - 1 && iz < nz - 1) idx.push(k, k + nx, k + 1, k + 1, k + nx, k + nx + 1);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, o.mat); mesh.receiveShadow = true; h.scene.add(mesh);
    const lire = A => (x, z) => { // interpolation bilinéaire dans la grille
      const fx = Math.max(0, Math.min(nx - 1.001, (x - x0) / pas)), fz = Math.max(0, Math.min(nz - 1.001, (z - z0) / pas)), ix = fx | 0, iz = fz | 0, a = fx - ix, b = fz - iz, k = iz * nx + ix;
      return (A[k] * (1 - a) + A[k + 1] * a) * (1 - b) + (A[k + nx] * (1 - a) + A[k + nx + 1] * a) * b;
    };
    return { hAt: lire(Y), dAt: lire(D), box: [x0, z0, x1, z1] };
  }

  window.DECORS = {
    // ---------- Karasu-tōge : forêt de cèdres, glissières à catadioptres, et au sommet un carrefour : supérette de nuit, station-service, voitures garées ----------
    touge(h) {
      const { THREE, S, N, W, rnd } = h;
      const g = terrain(h, { pas: 14, marge: 320, loin: 150, chute: 0.45, mat: h.mat('bruit', {}, '#0c1a14', ['#12261e', '#081410', '#16302a']) });
      // le carrefour : sur le plateau du sommet, côté extérieur. Une route de traverse y part, barrée.
      const ic = pt(h, 11), sc = S[ic], sd = g.dAt(...bord(sc, 1, 60)) > g.dAt(...bord(sc, -1, 60)) ? 1 : -1, [cx, cz] = bord(sc, sd, W + 22);
      // cèdres : une rangée serrée le long de la route (le tunnel d'arbres), puis la forêt ; rien sur le carrefour
      const arbres = [], libre = (x, z) => (x - cx) ** 2 + (z - cz) ** 2 > 46 * 46;
      for (let i = 0; i < N; i += 3) for (const side of [-1, 1]) {
        const [x, z] = bord(S[i], side, W + 4.5 + rnd() * 7);
        if (g.dAt(x, z) > W + 3.5 && libre(x, z)) arbres.push([x, g.hAt(x, z) + 6, z, rnd() * 6, 0.8 + rnd() * 0.7]);
      }
      for (let k = 0; k < 2600; k++) {
        const x = g.box[0] + rnd() * (g.box[2] - g.box[0]), z = g.box[1] + rnd() * (g.box[3] - g.box[1]), d = g.dAt(x, z);
        if (d > W + 6 && d < 230 && libre(x, z)) arbres.push([x, g.hAt(x, z) + 6, z, rnd() * 6, 0.9 + rnd() * 0.9]);
      }
      const fûts = arbres.map(p => { const y0 = p[1] - 6; p[1] = y0 + 11 * p[4]; return [p[0], y0 + 2.6 * p[4], p[2], 0, p[4]]; }); // le houppier monte sur un fût nu, comme un vrai cèdre du Japon
      inst(h, h.geo('cedre'), h.mat('cedre'), arbres); inst(h, h.geo('tronc'), h.mat('tronc'), fûts);
      // catadioptres orange sur les glissières : le seul balisage, comme sur une vraie route de col
      const cata = [];
      for (let i = 0; i < N; i += 6) for (const side of [-1, 1]) { const [x, z] = bord(S[i], side, W + 0.15); cata.push([x, S[i].y + 0.85, z]); }
      inst(h, h.geo('catadioptre'), h.mat('catadioptre', { lum: 1, retro: 2.5 }), cata); // éteints, ils s'allument dans le faisceau des phares

      // --- le carrefour : tout est posé dans le repère de la route, X vers l'extérieur ---
      const gr = repere(h, sc), X = v => sd * (W + v), bitume = h.mat('bitume'), acier = h.mat('acier');
      h.pose('esplanade', { bitume }, gr, [X(21), 0, 0]); h.pose('traverse', { bitume }, gr, [X(70), 0, -12]); // la route de traverse s'enfonce dans la forêt
      // supérette : vitrine éclairée, bandeau à enseigne originale (bleu et jaune), distributeurs devant la vitrine
      h.pose('superette', { mur: h.mat('crepi'), porte: h.mat('vitreSombre'), toit: h.mat('matGris'), clim: acier, vitrine: h.mat('vitrine', LUM), enseigne: h.mat('ecrit', LUM, 128, 12, '#1d4ac8', '#ffd84a', 'カラスマート  KARASU MART  24H', 9), distributeur: h.mat('distributeur', LUM) }, gr, [X(34), 0, -8], sd);
      // station-service : auvent éclairé par-dessous, deux pompes, totem de prix (marque inventée)
      h.pose('station', { acier, ilot: h.mat('beton'), lampe: h.mat('lampe', LUM), enseigne: h.mat('ecrit', LUM, 96, 8, '#c8102e', '#ffffff', 'TOGE OIL  峠石油', 7), pompe: h.mat('pompeEssence', LUM) }, gr, [X(15), 0, 15]);
      h.pose('totem', { acier, prix: h.mat('ecrit', LUM, 32, 32, '#101418', '#ffd84a', '168', 14) }, gr, [X(4.5), 0, 25]);
      // voitures garées : silhouettes de sportives génériques, feux allumés, certaines tournées vers la route
      const vitre = h.mat('vitreSombre'), feuRouge = h.mat('feuRouge', LUM), feuBlanc = h.mat('lampe', LUM);
      [[7, -19, 0.3, 0xf4f0e0], [7.5, -13, -0.2, 0xc8102e], [8, -7, 0.15, 0x2a5ac8], [22, -21, 1.57, 0x14161c], [22, 2, 1.4, 0xffc04a], [10, 6, -0.4, 0x9aa0a8], [16, 26, 1.57, 0x1f8f5a]].forEach(([vx, vz, a, col]) => {
        const v = new THREE.Group(); v.position.set(X(vx), 0, vz); v.rotation.y = a; gr.add(v);
        h.pose('voitureGaree', { caisse: h.mat('laque', { c: col }), vitre, feuRouge, feuBlanc, chassis: h.mat('matGris'), roue: h.mat('roue'), pneu: h.mat('pneu') }, v);
      });
      // la route de traverse est barrée : barrières rayées, cônes, feux orange qui clignotent
      const rayures = h.mat('rayures', LUM), cligno = h.mat('clignotant', LUM), cone = h.mat('cone', LUM);
      for (const dz of [-15, -12, -9]) h.pose('barriere', { rayures, clignotant: cligno }, gr, [X(43), 0, dz]);
      for (const dz of [-16.5, -13.5, -10.5, -7.5]) h.pose('cone', cone, gr, [X(41.5), 0.5, dz]);
      gr.updateMatrixWorld(); // la vitrine et l'auvent éclairent l'esplanade, la route et les voitures qui passent
      for (const [lx, lz, col, d] of [[27, -8, 0xdfefff, 46], [15, 15, 0xffe0a0, 34], [3, 0, 0xdfefff, 22]]) { const p = gr.localToWorld(new THREE.Vector3(X(lx), 4.5, lz)); h.lum(ic, p.x, p.y, p.z, col, d, 3); }
      // la ville, tout en bas : un semis de points chauds hors brouillard
      const P = [];
      for (let i = 0; i < 900; i++) { const a = rnd() * 6.283, r = 500 + rnd() * rnd() * 1500; P.push(-500 + Math.cos(a) * r * 1.3, -190 - rnd() * 30, 200 + Math.sin(a) * r); }
      const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      const pts = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xffc070, size: 1.5, sizeAttenuation: false, fog: false })); pts.frustumCulled = false; h.scene.add(pts);
      return (dt, now) => { cligno.color.setHex((now / 450 & 1) ? 0xff8c1a : 0x3a2008); };
    },

    // ---------- Wan-9 : la ville au nord, le chenal, l'île du port au sud. Voie rapide du front de mer, pont à haubans, quais à conteneurs,
    // tranchée et tunnel immergé sous le chenal, retour en ville. L'eau n'existe que là où la route passe au-dessus (pont) ou dessous (tunnel). ----------
    wangan(h) {
      const { THREE, S, N, W, rnd, T } = h;
      const CH0 = 62, CH1 = 520, ILE = [-880, 1650, 1045]; // chenal entre z = CH0 et CH1 ; l'île va de x = ILE[0] à ILE[1], jusqu'à z = ILE[2]
      const mer = (x, z) => (z > CH0 && z < CH1) || (z >= CH1 && (x < ILE[0] || x > ILE[1] || z > ILE[2]));
      const tun = i => h.zone(i, 0) === 1;
      // au-dessus du tunnel, le sol reste au niveau du quai : le tube passe dessous ; dans les tranchées d'accès, il suit la route qui descend
      const g = terrain(h, { pas: 16, marge: 330, sol: s => tun(S.indexOf(s)) ? 0 : Math.min(s.y, 0), creux: (x, z) => mer(x, z) ? 13 : 0, mat: h.mat('bruit', {}, '#1a1c22', ['#22252c', '#14161a', '#2a2622']) });
      const eau = h.mat('bruit', { lum: 1, rep: [300, 300] }, '#071824', ['#0f3b4a', '#0a2836', '#3a2c18']);
      // quatre plans d'eau : le chenal, et la mer à l'ouest, à l'est et au sud de l'île
      boite(h, eau, 16000, 1, CH1 - CH0, 0, -3.5, (CH0 + CH1) / 2); boite(h, eau, 16000, 1, 8000, 0, -3.5, ILE[2] + 4000);
      boite(h, eau, 8000, 1, ILE[2] - CH1, ILE[0] - 4000, -3.5, (CH1 + ILE[2]) / 2); boite(h, eau, 8000, 1, ILE[2] - CH1, ILE[1] + 4000, -3.5, (CH1 + ILE[2]) / 2);
      // la terre continue au nord, au-delà du terrain modelé
      const plaine = h.mat('plaine');
      boite(h, plaine, 16000, 1, 8000, 0, -1, g.box[1] - 4000); boite(h, plaine, 8000, 1, CH0 - g.box[1], g.box[0] - 4000, -1, (CH0 + g.box[1]) / 2); boite(h, plaine, 8000, 1, CH0 - g.box[1], g.box[2] + 4000, -1, (CH0 + g.box[1]) / 2);
      // lampadaires : un tous les 40 m, des deux côtés ; leur défilement régulier donne la vitesse sans aucun flou
      const mats = [], tetes = [];
      for (let i = 0; i < N; i += 20) {
        if (h.zone(i, 0) === 1) continue;
        const s = S[i], ry = h.across(s);
        for (const sd of [-1, 1]) { const [x, z] = bord(s, sd, W + 0.8), [tx, tz] = bord(s, sd, W - 0.7); mats.push([x, s.y + 5, z, ry]); tetes.push([tx, s.y + 10, tz, ry]); }
        { const [lx, lz] = bord(s, (i / 20) & 1 ? 1 : -1, W - 0.7); h.lum(i, lx, s.y + 9.6, lz, 0xffa040, 31, 3.2); } // sodium : une plage orange par lampadaire, d'un côté puis de l'autre
      }
      inst(h, h.geo('matLampadaire'), h.mat('matGris'), mats);
      inst(h, h.geo('teteLampadaire'), h.mat('sodium', LUM), tetes);
      // panneaux d'autoroute verts, rétroréfléchissants : chacun annonce ce qui vient (pont, port, tunnel sous le chenal, centre)
      const gris = h.mat('portiqueGris'), pan = t => h.mat('panneauRoute', { lum: 1, retro: 0.7 }, t);
      for (const [ip, a, b] of [[1, '湾岸線 ↑', '橋 BRIDGE 1km'], [3, '橋 BRIDGE', '港 PORT →'], [9, '港 PORT', '出口 EXIT'], [20, '海底トンネル', 'UNDERSEA 1.4km'], [22, '水深 -25m', '危険物 ✕ HAZMAT'], [32, '湾岸線 WAN-9', '都心 CENTER']])
        h.pose('portiqueAutoroute', { structure: gris, panneauGauche: pan(a), panneauDroit: pan(b) }, repere(h, S[pt(h, ip)]), [0, 0, 0], W);
      // pont à haubans sur le chenal : deux pylônes en H, câbles tirés jusqu'au tablier
      const blanc = h.mat('blancPont'), fils = [], balises = [];
      for (const [px, pz] of [[1407, 215], [1402, 430]]) {
        const i0 = near(h, px, pz), s = S[i0];
        h.pose('pylonePont', { beton: blanc }, repere(h, s), [0, 0, 0], W);
        for (const sd of [-1, 1]) {
          const [ax, az] = bord(s, sd, W + 3.5); balises.push(ax, s.y + 51, az);
          for (let j = 8; j <= 48; j += 8) for (const dir of [-1, 1]) { const q = S[(i0 + dir * j + N) % N], [bx, bz] = bord(q, sd, W + 1); fils.push(ax, s.y + 48 - j * 0.25, az, bx, q.y + 1.4, bz); }
        }
      }
      const fgm = new THREE.BufferGeometry(); fgm.setAttribute('position', new THREE.Float32BufferAttribute(fils, 3)); h.scene.add(new THREE.LineSegments(fgm, new THREE.LineBasicMaterial({ color: 0xc9ced6 })));

      // ---------- le tunnel immergé : tranchées d'accès, têtes de tunnel, tours de ventilation, bouées qui balisent le tube à travers le chenal ----------
      const beton = h.mat('beton'), berme = [];
      for (let i = 0; i < N; i += 4) { // murs de soutènement des tranchées : du pied de la route au niveau du quai, couronnés d'un terre-plein de 30 m
        const s = S[i]; if (tun(i) || s.y > -0.3 || s.y < -20) continue;
        for (const sd of [-1, 1]) { const [x, z] = bord(s, sd, W + 15.6), ht = 1.4 - s.y; berme.push([x, s.y - 1 + ht / 2, z, h.across(s), 1, ht, 1]); }
      }
      inst(h, h.geo('berme'), h.mat('betonGris'), berme);
      const tete = { beton, corniche: gris, structure: gris, nom: h.mat('ecrit', LUM, 128, 22, '#0e5a38', '#f4f1e0', '湾岸海底トンネル  WAN-9 UNDERSEA TUNNEL', 9), feux: h.mat('feuxVoie', LUM, 4),
        limite: h.mat('rayures', LUM), panneau: h.mat('ecrit', LUM, 16, 16, '#f4f0e0', '#c8102e', '4.3m', 7) };
      for (const [i, rv] of [[T.t0, 0], [T.t1, Math.PI]]) { const r = repere(h, S[i]); r.rotation.y += rv; h.pose('teteTunnel', tete, r, [0, 0, 0], W); }
      const persiennes = h.mat('persiennes'), quai = h.mat('bitume'), feuxRouges = [];
      { const s = S[T.t0], [x, z] = bord(s, 1, W + 46), r = repere(h, s); r.position.set(x, g.hAt(x, z), z); h.pose('tourVentilation', { persiennes, beton }, r, [0, 0, 18], 24); feuxRouges.push(x, 46, z); }
      { const s = S[T.t1], [x, z] = bord(s, -1, W + 40), r = repere(h, s); r.position.set(x, g.hAt(x, z), z); h.pose('tourVentilation', { persiennes, beton }, r, [0, 0, -18], 20); feuxRouges.push(x, 42, z); }
      // au milieu du chenal, sur l'axe du tube : l'île de la tour de ventilation, et deux rangées de bouées jaunes qui interdisent le mouillage au-dessus du tunnel
      const iv = S[near(h, -615, 300)], ile = new THREE.Group(); ile.position.set(iv.x, 0, iv.z); ile.rotation.y = h.across(iv) + Math.PI / 2; h.scene.add(ile);
      h.pose('ileVentilation', { quai, defense: h.mat('defense') }, ile); h.pose('tourVentilation', { persiennes, beton }, ile, [0, 0, 0], 34); feuxRouges.push(iv.x, 50, iv.z);
      const bouees = [], feuxBouees = [];
      for (let i = T.t0; i < T.t1; i += 10) { const s = S[i]; if (!mer(s.x, s.z)) continue; for (const sd of [-1, 1]) { const [x, z] = bord(s, sd, 60); bouees.push([x, -3.2, z]); feuxBouees.push(x, -0.6, z); } }
      inst(h, h.geo('bouee'), h.mat('metalClair', { c: 0xffc81a }), bouees);
      const fb = new THREE.BufferGeometry(); fb.setAttribute('position', new THREE.Float32BufferAttribute(feuxBouees, 3));
      const ptsBouees = new THREE.Points(fb, new THREE.PointsMaterial({ color: 0xffc81a, size: 3, sizeAttenuation: false })); ptsBouees.frustumCulled = false; h.scene.add(ptsBouees);

      // ---------- l'île du port : quai, parcs à conteneurs en blocs inégaux, engins, mâts d'éclairage ----------
      const axe = S[near(h, -615, 560)].x, libre = (x, z, m = 14) => g.dAt(x, z) > W + m && (z > 700 || Math.abs(x - axe) > 90) && // rien dans l'axe du tunnel : de la tranchée, on voit le chenal
         g.hAt(x, z) > -1.5 && z > CH1 + 4 && z < ILE[2] - 12 && x > ILE[0] + 10 && x < ILE[1] - 10;
      boite(h, h.mat('parc'), ILE[1] - ILE[0] - 40, 0.3, 74, (ILE[0] + ILE[1]) / 2, -0.2, CH1 + 37); // terre-plein du quai, marqué
      const cols = [0xb8442c, 0x2c6ab8, 0xc9a02c, 0x3a8a5a, 0xd8d4cc, 0x7a3a6a, 0x1a4a5a], piles = cols.map(() => []), cavaliers = [], portiques = [];
      // un bloc = des travées de conteneurs (le long de X) sur plusieurs files (Z) ; chaque bloc a sa compagnie dominante, son remplissage, ses trous
      const bloc = (x0, z0, C, R, fill) => {
        const dom = rnd() * cols.length | 0;
        const H = [], hAt = (c, r) => (H[c] && H[c][r]) || 0;
        for (let c = 0; c < C; c++) { H[c] = []; for (let r = 0; r < R; r++) { const bordure = Math.min(c, C - 1 - c, r, R - 1 - r) === 0 ? 1 : 0; H[c][r] = libre(x0 + c * 12.8 + 6, z0 + r * 2.9 + 1.25) ? Math.max(0, Math.min(5, Math.round(fill - bordure + (rnd() - 0.5) * 2.6))) : 0; } }
        for (let c = 0; c < C; c++) for (let r = 0; r < R; r++) {
          const x = x0 + c * 12.8 + 6, z = z0 + r * 2.9 + 1.25, n = H[c][r], vu = Math.min(hAt(c - 1, r), hAt(c + 1, r), hAt(c, r - 1), hAt(c, r + 1)); // sous ce niveau, le conteneur est enfoui entre ses voisins : on ne le dessine pas
          for (let k = Math.min(vu, n - 1); k < n; k++) { const haut = k === n - 1, col = rnd() < 0.55 ? dom : rnd() * cols.length | 0; piles[col].push([x + (haut ? (rnd() - 0.5) * 0.5 : 0), g.hAt(x, z) + 1.3 + k * 2.6, z, haut ? (rnd() - 0.5) * 0.05 : 0, rnd() < 0.15 ? 0.5 : 1, 1, 1]); }
        }
        if (rnd() < 0.5 && R <= 7 && libre(x0 + C * 6.4, z0 + R * 1.45, 6)) portiques.push([x0 + (0.2 + rnd() * 0.6) * C * 12.8, g.hAt(x0, z0), z0 + R * 1.45, Math.PI / 2]);
      };
      for (const z0 of [606, 638, 826, 858, 892, 950, 984]) for (let x0 = ILE[0] + 20 + rnd() * 30; x0 < ILE[1] - 60;) {
        const C = 5 + (rnd() * 6 | 0), R = 4 + (rnd() * 4 | 0), t = rnd(), L = C * 12.8;
        if (t < 0.2) { // zone vide : quelques conteneurs posés de travers, un cavalier qui attend
          for (let k = rnd() * 4 | 0; k > 0; k--) { const x = x0 + rnd() * L, z = z0 + rnd() * 20; if (libre(x, z)) piles[rnd() * cols.length | 0].push([x, g.hAt(x, z) + 1.3, z, rnd() * 3.14]); }
          const x = x0 + rnd() * L, z = z0 + 10; if (libre(x, z, 18)) cavaliers.push([x, g.hAt(x, z), z, rnd() < 0.5 ? 0 : 0.2]);
        } else bloc(x0, z0, C, R, t < 0.4 ? 1.5 : t < 0.85 ? 3 : 4.2);
        const allee = 14 + rnd() * 22, x = x0 + L + allee / 2, z = z0 + 9; // l'allée qui suit : un cavalier y passe parfois
        if (rnd() < 0.45 && libre(x, z, 18)) cavaliers.push([x, g.hAt(x, z), z, Math.PI / 2 + (rnd() - 0.5) * 0.2]);
        x0 += L + allee;
      }
      piles.forEach((l, i) => inst(h, h.geo('conteneur'), h.mat('tole', { c: cols[i] }), l));
      const structure = h.mat('metalClair', { c: 0xe0b020 }), cabine = h.mat('metalClair', { c: 0xe8e8e4 }), vitre = h.mat('vitreSombre'), roue = h.mat('roue'), pneu = h.mat('pneu'), machinerie = h.mat('metalClair', { c: 0x8a8e96 });
      insts(h, 'cavalier', { structure, cabine, vitre, roue }, cavaliers);
      insts(h, 'grueParc', { structure: h.mat('metalClair', { c: 0x2c6ab8 }), cabine, vitre, roue, machinerie }, portiques, { a: [24] });
      // le quai : portiques au-dessus des navires amarrés, tracteurs de quai qui attendent sous les portiques
      const minium = h.mat('minium'), treillis = h.mat('treillis', { alphaTest: 0.5, side: THREE.DoubleSide }, '#c8442c');
      for (const cx of [-150, -40, 70, 620, 740, 930]) { h.pose('grue', { structure: minium, treillis, tirant: gris, machinerie: cabine, cabine, vitre, roue }, h.scene, [cx, 0, CH1]); balises.push(cx, 69, CH1 + 41); }
      const tracteurs = [];
      for (let k = 0; k < 16; k++) { const x = -260 + rnd() * 1250, z = CH1 + 8 + rnd() * 14; if (Math.abs(x - 280) > 180) tracteurs.push([x, 0, z, (rnd() < 0.5 ? 0 : Math.PI) + (rnd() - 0.5) * 0.3]); }
      const chassis = h.mat('matGris'), lampe = h.mat('lampe', LUM), feuRouge = h.mat('feuRouge', LUM), clign = h.mat('clignotant', LUM);
      insts(h, 'tracteur', { chassis, pneu, cabine: h.mat('metalClair', { c: 0xe0b020 }), vitre, calandre: h.mat('calandre'), phare: lampe, feuOrange: clign, roue }, tracteurs);
      insts(h, 'remorqueConteneur', { chassis, caisse: h.mat('tole', { c: 0x5a5e66 }), roue, pneu, feu: feuRouge }, tracteurs.filter((p, k) => k % 3));
      // mâts d'éclairage : lumière blanche sur les parcs ; ceux qui bordent la route l'éclairent
      const mats35 = [];
      for (let x = ILE[0] + 60; x < ILE[1] - 40; x += 130) for (const z of [CH1 + 30, 700, 818, 1000]) {
        const xx = x + (z % 3) * 20; if (!libre(xx, z, 6)) continue; mats35.push([xx, g.hAt(xx, z), z]);
        if (g.dAt(xx, z) < 60) h.lum(near(h, xx, z), xx, 33, z, 0xe8f0ff, 70, 1.6);
      }
      insts(h, 'matEclairage', { acier: h.mat('acier'), lampe }, mats35);

      // ---------- navires : deux porte-conteneurs à quai, des remorqueurs, des navires au mouillage au large, et deux qui passent dans le chenal au-dessus du tunnel ----------
      const nav = (L, type, coque, cheminee, baies) => ({ carene: minium, coque: h.mat('metalClair', { c: coque }), blanc: cabine, hublots: h.mat('tourFenetres', { lum: 1, fog: false }, ['#ffe2a0', '#f4f1e0']), cheminee: h.mat('metalClair', { c: cheminee }),
        cargaison: h.mat('cargaison'), cale: h.mat('metalClair', { c: 0x8a3a2a }), grueBord: structure, defense: h.mat('defense'), vitre });
      const baies = (L, f) => Array.from({ length: Math.floor((L - 50) / 24) }, () => Math.max(1, Math.min(6, Math.round(f + (rnd() - 0.5) * 3))));
      const feuxNav = [], navire = (L, type, coque, chem, x, z, ry, f = 4) => { const p = new THREE.Group(); p.position.set(x, -3.5, z); p.rotation.y = ry; h.scene.add(p); h.pose('navire', nav(L, type, coque, chem), p, [0, 0, 0], L, type, type === 'vrac' ? [] : baies(L, f)); return p; };
      for (const [L, x, coque, chem, f] of [[250, -40, 0x1a2a4a, 0xc8442c, 4.5], [200, 690, 0x2a3a2a, 0xe8e4dc, 3]]) { navire(L, 'conteneurs', coque, chem, x, CH1 - 16, 0, f); feuxNav.push(x + L / 2 - 6, 19, CH1 - 16, x - L / 2 + 14, 36, CH1 - 16); }
      const remorqueur = (x, z, ry) => { const p = new THREE.Group(); p.position.set(x, -3.5, z); p.rotation.y = ry; h.scene.add(p); h.pose('remorqueur', nav(30, '', 0xc8302c, 0x1a1a20), p); return p; };
      remorqueur(830, CH1 - 22, 0.3); remorqueur(860, CH1 - 40, -0.2);
      for (let k = 0; k < 7; k++) { // au mouillage, au sud de l'île : l'avant face au courant, feux de mouillage
        const L = 160 + rnd() * 110, x = -900 + k * 420 + rnd() * 150, z = ILE[2] + 260 + rnd() * 900, ry = 0.6 + (rnd() - 0.5) * 0.3;
        navire(L, k % 3 ? 'vrac' : 'conteneurs', [0x2a1a1a, 0x1a2a4a, 0x3a3a40][k % 3], [0xe8e4dc, 0xc8442c, 0x2c6ab8][k % 3], x, z, ry, 2.5);
        feuxNav.push(x + Math.cos(ry) * L / 2, 12, z - Math.sin(ry) * L / 2, x, 30, z);
      }
      // dans le chenal, sur une boucle : cap à l'est au nord, demi-tour, cap à l'ouest au sud ; le remorqueur suit le premier
      const passants = [[navire(170, 'conteneurs', 0x3a1a2a, 0xf4f0e0, 0, 0, 0, 3.5), 0], [navire(150, 'vrac', 0x1a3a3a, 0xc8442c, 0, 0, 0), 0.25], [navire(190, 'conteneurs', 0x1a2a4a, 0xe8b02c, 0, 0, 0, 4), 0.5], [navire(140, 'ferry', 0xe8e8e4, 0x2c6ab8, 0, 0, 0), 0.75], [remorqueur(0, 0, 0), 0.04]];
      // en face de l'entrée, à quai sur la rive de la ville : un ferry de nuit, tout éclairé, juste au-dessus du tube
      navire(180, 'ferry', 0xe8e8e4, 0xc8302c, axe + 20, CH0 + 15, Math.PI);
      const BX0 = -1500, BX1 = 1000, BR = 110, BZ = 310, LB = 2 * (BX1 - BX0) + 2 * Math.PI * BR;
      const boucle = (u, p) => { // u de 0 à 1 le long de la boucle
        let d = (u % 1) * LB; const dr = BX1 - BX0, dc = Math.PI * BR;
        if (d < dr) { p.position.set(BX0 + d, -3.5, BZ + BR); p.rotation.y = 0; return; } d -= dr;
        if (d < dc) { const a = d / BR; p.position.set(BX1 + Math.sin(a) * BR, -3.5, BZ + Math.cos(a) * BR); p.rotation.y = a; return; } d -= dc;
        if (d < dr) { p.position.set(BX1 - d, -3.5, BZ - BR); p.rotation.y = Math.PI; return; } d -= dr;
        const a = d / BR; p.position.set(BX0 - Math.sin(a) * BR, -3.5, BZ - Math.cos(a) * BR); p.rotation.y = Math.PI + a;
      };
      const nf = new THREE.BufferGeometry(); nf.setAttribute('position', new THREE.Float32BufferAttribute(feuxNav, 3));
      const pnav = new THREE.Points(nf, new THREE.PointsMaterial({ color: 0xfff2d0, size: 2, sizeAttenuation: false, fog: false })); pnav.frustumCulled = false; h.scene.add(pnav);

      // ---------- la ville, au nord : tours à fenêtres allumées qui bordent la voie rapide, de plus en plus hautes vers l'intérieur ----------
      const tour = cols2 => h.mat('tourFenetres', LUM, cols2);
      const tm = [tour(['#ffb85a', '#ffd27a']), tour(['#f4f1e0', '#9fd0ff']), tour(['#ffb85a', '#f4f1e0', '#ff7a5a'])], tl = tm.map(() => []);
      for (let gx = g.box[0] + 30; gx < g.box[2] - 30; gx += 58) for (let gz = g.box[1] + 30; gz < CH0 - 60; gz += 58) {
        const x = gx + rnd() * 16, z = gz + rnd() * 16, d = g.dAt(x, z);
        if (d < W + 26 || g.hAt(x, z) < -1.5) continue;
        const hh = 26 + rnd() * 40 + Math.min(120, d * 0.35) * rnd(), w = 26 + rnd() * 16; tl[rnd() * 3 | 0].push([x, hh / 2 - 1, z, 0, w, hh, w]);
      }
      tl.forEach((l, i) => inst(h, h.geo('bloc'), tm[i], l));
      // au loin, hors brouillard : la ville derrière, une côte en face de l'autre côté de la baie, la zone industrielle à l'est, un grand pont suspendu à l'ouest
      const loins = [['#0a1020', ['#ffb85a', '#f4f1e0', '#ffd27a'], 90], ['#0c0e18', ['#9fd0ff', '#f4f1e0'], 60], ['#140c10', ['#ff9a5a', '#ffd27a'], 40]].map(([f, c, n]) => h.mat('tourLoin', { lum: 1, fog: false }, f, c, n)), ll = loins.map(() => []);
      const amas = (cx, cz, n, rx, rz, hmin, hmax, wmin) => { for (let i = 0; i < n; i++) { const hh = hmin + rnd() * rnd() * (hmax - hmin), w = wmin + rnd() * wmin; ll[i % 3].push([cx + (rnd() - 0.5) * rx, hh / 2 - 4, cz + (rnd() - 0.5) * rz, 0, w, hh, w]); } };
      for (let i = 0; i < 60; i++) { const a = 3.3 + rnd() * 2.8, r = 1900 + rnd() * 900, hh = 120 + rnd() * rnd() * 420, w = 60 + rnd() * 110; ll[0].push([500 + Math.cos(a) * r * 1.4, hh / 2 - 1, -100 + Math.sin(a) * r, 0, w, hh, w]); }
      amas(600, 3600, 70, 4200, 500, 30, 180, 40); amas(-1600, 3000, 30, 1200, 600, 20, 90, 40); amas(3900, 800, 40, 500, 2600, 20, 120, 50); amas(-3300, -300, 40, 600, 2200, 30, 200, 50);
      ll.forEach((l, i) => inst(h, h.geo('bloc'), loins[i], l));
      const lointains = [], cLoin = [], feu = (x, y, z, c) => { lointains.push(x, y, z); cLoin.push(...c); };
      for (let i = 0; i < 700; i++) { const x = -1600 + rnd() * 5000, z = 3300 + rnd() * rnd() * 900; feu(x, -2, z, rnd() < 0.7 ? [1, 0.72, 0.4] : [0.9, 0.95, 1]); } // la côte d'en face : un ruban de lumières
      for (let i = 0; i < 18; i++) { const x = 3600 + rnd() * 600, z = -1000 + rnd() * 2600, hh = 40 + rnd() * 80; feu(x, hh, z, [1, 0.1, 0.15]); ll[1].push([x, hh / 2, z, 0, 6, hh, 6]); } // cheminées d'usine à feu rouge
      for (let i = 0; i < 4; i++) feu(3500 + i * 60, 60 + i * 5, 300 + i * 220, [1, 0.6, 0.1]); // torchères
      for (let k = 0; k <= 80; k++) { const t = k / 80, x = -2600 + t * 1500, z = 1700 + t * 1900, cat = Math.abs(t - 0.5) < 0.25 ? 1 - ((t - 0.5) / 0.25) ** 2 : ((Math.abs(t - 0.5) - 0.25) / 0.25) ** 2 * 0.6; feu(x, 40, z, [1, 0.85, 0.5]); if (k % 2 === 0) feu(x, 40 + 130 * (1 - cat), z, [0.9, 0.95, 1]); } // pont suspendu : tablier et câble porteur
      for (const t of [0.25, 0.75]) ll[1].push([-2600 + t * 1500, 85, 1700 + t * 1900, 0.67, 8, 180, 8]);
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lointains, 3)); lg.setAttribute('color', new THREE.Float32BufferAttribute(cLoin, 3));
      const ploin = new THREE.Points(lg, new THREE.PointsMaterial({ size: 1.5, sizeAttenuation: false, vertexColors: true, fog: false })); ploin.frustumCulled = false; h.scene.add(ploin);
      const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(balises.concat(feuxRouges), 3));
      const bp = new THREE.Points(bg, new THREE.PointsMaterial({ color: 0xff2030, size: 2, sizeAttenuation: false, fog: false })); bp.frustumCulled = false; h.scene.add(bp);

      // ---------- grande roue sur le front de mer : support en A, rotor (jante double, rayons, moyeu) qui porte les lumières, nacelles qui restent d'aplomb ----------
      const HR = 78, RR = 70, roueG = new THREE.Group(); roueG.position.set(620, g.hAt(620, 40) + HR, 40); roueG.rotation.y = 0.5; h.scene.add(roueG);
      const acierR = h.mat('metalClair', { c: 0xe8ecf4 });
      h.pose('roueSupport', { acier: acierR, socle: h.mat('entrepot') }, roueG, [0, 0, 0], HR);
      const rotor = new THREE.Group(); roueG.add(rotor); h.pose('roueRotor', { jante: acierR, rayon: acierR, moyeu: h.mat('matGris') }, rotor, [0, 0, 0], RR);
      const rp = [], rc = [];
      for (const z of [-4.2, 4.2]) for (let i = 0; i < 48; i++) { const a = i / 48 * 6.283; rp.push(Math.cos(a) * RR, Math.sin(a) * RR, z); rc.push(...[[1, 0.3, 0.6], [0.3, 0.9, 1], [1, 0.9, 0.3]][i % 3]); if (i % 6 === 0) for (let r = 10; r < RR; r += 12) { rp.push(Math.cos(a) * r, Math.sin(a) * r, z); rc.push(1, 1, 1); } }
      const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3)); rg.setAttribute('color', new THREE.Float32BufferAttribute(rc, 3));
      const roue2 = new THREE.Points(rg, new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true, fog: false })); roue2.frustumCulled = false; rotor.add(roue2);
      const NN = 24, nacelles = new THREE.InstancedMesh(h.geo('nacelle'), h.mat('nacelle', LUM, '#e8e8e8'), NN), dn = new THREE.Object3D(); nacelles.frustumCulled = false; roueG.add(nacelles);
      for (let k = 0; k < NN; k++) nacelles.setColorAt(k, new THREE.Color([0xff4a8a, 0x4ac8ff, 0xffd84a, 0x6aff8a][k % 4]));

      // ---------- camions : un tracteur à cabine avancée et une remorque (conteneur, citerne ou plateau à bobines), qui suivent le trafic de sim.js ----------
      const nt = h.M.trafic, dc = new THREE.Object3D(), types = ['remorqueConteneur', 'remorqueCiterne', 'remorquePlateau'];
      const flotte = (nom, peau, n) => Object.entries(h.zones(nom, peau)).map(([zn, geo]) => { const m = new THREE.InstancedMesh(geo, peau[zn], Math.max(1, n)); m.count = n; m.frustumCulled = false; h.scene.add(m); return m; });
      const cabineC = h.mat('metalClair'), caisseC = h.mat('tole');
      const tracteursC = flotte('tracteur', { chassis, pneu, cabine: cabineC, vitre, calandre: h.mat('calandre'), phare: lampe, feuOrange: clign, roue }, nt);
      const remorques = types.map((nom, t) => flotte(nom, { chassis, roue, pneu, feu: feuRouge, caisse: caisseC, cuve: h.mat('inox'), plateau: h.mat('planches'), bobine: h.mat('bobine'), sangle: h.mat('sangle') }, Math.ceil((nt - t) / 3)));
      const teintesCab = [0x2c6ab8, 0xe8e4dc, 0xc8302c, 0x1f8f5a, 0xd8a02c, 0x5a5e66, 0xe86a1a, 0x2a2a34, 0x7a9ac8].map(c => new THREE.Color(c));
      for (let i = 0; i < nt; i++) {
        for (const m of tracteursC) if (m.material === cabineC) m.setColorAt(i, teintesCab[i % teintesCab.length]);
        if (i % 3 === 0) for (const m of remorques[0]) if (m.material === caisseC) m.setColorAt(i / 3, new THREE.Color(cols[(i * 5) % cols.length]));
      }
      const vus = [...tracteursC, ...remorques.flat()];
      for (const m of vus) if (m.instanceColor) m.instanceColor.needsUpdate = true;
      return (dt, now) => {
        rotor.rotation.z = now * 0.00012; bp.visible = (now / 700 & 1) === 1; ptsBouees.visible = (now / 1100 & 3) === 0;
        for (let k = 0; k < NN; k++) { const a = k / NN * 6.2832 + rotor.rotation.z; dn.position.set(Math.cos(a) * RR, Math.sin(a) * RR - 2.2, 0); dn.updateMatrix(); nacelles.setMatrixAt(k, dn.matrix); } // la nacelle pend sous la jante, toujours d'aplomb
        nacelles.instanceMatrix.needsUpdate = true;
        for (const [p, ph] of passants) boucle(now * 0.007 / LB + ph, p); // 7 m/s
        const vis = h.temps() >= 0; for (const m of vus) m.visible = vis; if (!vis) return; // pas de camions en mode course
        trafic(T, h.temps()).forEach((k, i) => {
          dc.position.set(k.x, k.y, k.z); dc.rotation.set(0, -k.th, 0); dc.updateMatrix();
          for (const m of tracteursC) m.setMatrixAt(i, dc.matrix);
          for (const m of remorques[i % 3]) m.setMatrixAt(i / 3 | 0, dc.matrix);
        });
        for (const m of vus) m.instanceMatrix.needsUpdate = true;
      };
    },

    // ---------- Premier métro : la largeur de chaussée est la même partout (sim.js), mais la rue change de taille : grand boulevard à contre-allées
    // et double rangée d'arbres, avenue, rue, ruelle de la butte aux maisons basses collées au trottoir, quai ouvert sur la Seine, place. ----------
    paris(h) {
      const { THREE, S, N, W, rnd, M } = h, quai = (x, z) => z > 250 && x > -170 && x < 1060; // côté fleuve des quais
      const WY = -8, rive = x => x > 180 && x < 820 ? 262 : 248; // niveau de la Seine ; sa rive : au ras des voies sur berge, en retrait du tunnel qui passe dessous
      const g = terrain(h, { pas: 16, marge: 320, mat: h.mat('bruit', {}, '#6e6a66', ['#7a7672', '#625e5a']), creux: (x, z) => quai(x, z) ? Math.max(0, Math.min(9, (z - rive(x)) * 0.6)) : 0 });
      const eau = h.mat('bruit', { lum: 1, rep: [40, 20] }, '#1e3a3a', ['#2a4a48', '#c08a7a', '#16302e']); // la Seine, qui prend le rose du ciel
      boite(h, eau, 1710, 1, 728, 595, WY - 0.5, 626); for (const [x0, x1] of [[-260, 180], [820, 1060]]) boite(h, eau, x1 - x0, 1, 18, (x0 + x1) / 2, WY - 0.5, 255);
      let graine = 1; const al = () => (graine = graine * 16807 % 2147483647) / 2147483647; // hasard propre aux nouveaux placements : ne décale pas rnd
      // ruban le long de la piste dont les bords suivent la largeur locale : fa(s), fb(s) = écarts à l'axe ; à plat, la texture est plaquée en plan (une tuile tous les `tuile` m)
      // ya, yb = hauteurs, nombres ou fonctions (s, k) de l'échantillon et du rang dans le ruban
      const ruban = (i0, cnt, fa, ya, fb, yb, m) => {
        const t = m.userData.tuile || 4, pos = [], uv = [], idx = [], Y = (v, s, k) => typeof v === 'function' ? v(s, k) : v;
        for (let k = 0; k <= cnt; k++) {
          const s = S[(i0 + k) % N], a = fa(s), b = fb(s), y1 = Y(ya, s, k), y2 = Y(yb, s, k), A = [s.x - s.tz * a, s.y + y1, s.z + s.tx * a], B = [s.x - s.tz * b, s.y + y2, s.z + s.tx * b];
          pos.push(...A, ...B); uv.push(...(ya === yb ? [A[0] / t, A[2] / t, B[0] / t, B[2] / t] : [k * 2 / t, y1 / t, k * 2 / t, y2 / t]));
          if (k < cnt) idx.push(2 * k, 2 * k + 1, 2 * k + 2, 2 * k + 1, 2 * k + 3, 2 * k + 2);
        }
        return nappe(pos, uv, idx, m);
      };
      const nappe = (pos, uv, idx, m) => { const ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); ge.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); ge.setIndex(idx); ge.computeVertexNormals();
        const me = new THREE.Mesh(ge, m); me.receiveShadow = true; h.scene.add(me); return me; };
      // couronne horizontale de centre (cx, cz), du rayon r0 à r1, à l'altitude y, en n secteurs ; garde(x, z) = faux pour sauter un secteur
      const couronne = (cx, cz, r0, r1, y, n, m, garde = () => true) => {
        const t = m.userData.tuile || 4, pos = [], uv = [], idx = [];
        for (let k = 0; k < n; k++) { const a0 = k / n * 6.2832, a1 = (k + 1) / n * 6.2832, am = (a0 + a1) / 2, rm = (r0 + r1) / 2;
          if (!garde(cx + Math.cos(am) * rm, cz + Math.sin(am) * rm, a0, a1)) continue;
          const v = pos.length / 3; for (const [r, a] of [[r0, a0], [r1, a0], [r1, a1], [r0, a1]]) { const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; pos.push(x, y, z); uv.push(x / t, z / t); }
          idx.push(v, v + 2, v + 1, v, v + 3, v + 2); }
        return nappe(pos, uv, idx, m);
      };
      const proche = (x, z) => { let b = S[0], bd = 1e18; for (const s of S) { const d = (s.x - x) ** 2 + (s.z - z) ** 2; if (d < bd) { bd = d; b = s; } } return [Math.sqrt(bd), b]; }; // échantillon le plus proche et sa distance
      // types de rue : recul = distance du trottoir à la façade, H = hauteur des immeubles, arbres = rangées (distance au bord), gare = stationnement
      const TYPES = { boulevard: { recul: 21, H: [26, 30], arbres: [5.5, 15], gare: 2 }, avenue: { recul: 11, H: [22, 26], arbres: [6], gare: 1 }, rue: { recul: 3.2, H: [18, 22], arbres: [], gare: 0 },
        ruelle: { recul: 1, H: [9, 15], arbres: [], gare: 0 }, quai: { recul: 6.5, H: [20, 24], arbres: [], gare: 1 }, berge: { recul: 16, H: [26, 30], arbres: [], gare: 0 }, place: { recul: 19, H: [26, 28], arbres: [], gare: 0 } };
      const type = new Array(N).fill('rue'), rues = M.th.rues.map(([p, t]) => [pt(h, p), t]).sort((a, b) => a[0] - b[0]);
      rues.forEach(([i0, t], k) => { const i1 = k + 1 < rues.length ? rues[k + 1][0] : N; for (let i = i0; i < i1; i++) type[i] = t; });
      for (let i = 0; i < rues[0][0]; i++) type[i] = rues[rues.length - 1][1];
      const troncs = [], houp = [], mats = [], lant = [], autos = [[], [], [], []], boutiques = [], anneaux = [];
      // trottoirs à bordure de granit, et bande de stationnement en asphalte, par tronçon de même type hors tunnel ; ils suivent la largeur de la chaussée (la place s'élargit)
      const dalle = h.mat('dalles', { side: THREE.DoubleSide }), bordure = h.mat('pierre', { side: THREE.DoubleSide }), bitume = h.mat('bruit', { side: THREE.DoubleSide }, '#45454c', ['#4f4f56', '#3c3c42']);
      for (let i = 0; i < N;) {
        let j = i; const tun = h.zone(i, 1) > 0.5; while (j < N && type[j] === type[i] && (h.zone(j, 1) > 0.5) === tun) j++;
        const t = TYPES[type[i]], gb = t.gare ? 3.2 : 0;
        if (!tun && type[i] === 'berge') { // voie sur berge (la Seine toujours à gauche ici) : à gauche un liseré de pierre et le mur qui plonge dans l'eau ;
          // à droite un trottoir étroit, le mur du quai haut (rue à 1,5 m), son parapet ; le mur monte sur 50 m quand on descend de la rue, il est entier à la sortie du tunnel
          const plein = h.zone(i - 1, 1) > 0.5, hq = (s, k) => 0.22 + Math.max(0, 1.28 - s.y) * (plein ? 1 : Math.min(1, k / 25)), hp = (s, k) => hq(s, k) + 1;
          ruban(i, j - i, s => s.w, 0.22, s => s.w + 1.2, 0.22, dalle); ruban(i, j - i, s => s.w, 0.22, s => s.w, -0.6, bordure);
          ruban(i, j - i, s => s.w + 1.2, 0.22, s => s.w + 1.2, hq, bordure); ruban(i, j - i, s => s.w + 1.2, hq, s => s.w + 18, hq, dalle); ruban(i, j - i, s => s.w + 1.4, hq, s => s.w + 1.4, hp, bordure);
          ruban(i, j - i, s => -s.w, 0.22, s => -s.w - 0.8, 0.22, bordure); ruban(i, j - i, s => -s.w, 0.22, s => -s.w, -0.6, bordure); ruban(i, j - i, s => -s.w - 0.8, 0.22, s => -s.w - 0.8, s => WY - s.y - 0.6, bordure);
          for (let k = i; k < j; k++) { const s = S[k]; if (k % 6 === 0) { const [x, z] = bord(s, -1, s.w + 0.8); anneaux.push([x, s.y - 1.1, z, h.across(s) + Math.PI]); }
            if (k % 10 === 5) { const [x, z] = bord(s, 1, s.w + 9), y0 = s.y + hq(s, k - i); troncs.push([x, y0 + 2.6, z]); houp.push([x, y0 + 7.6, z, al() * 6, 1, 0.9, 1]); } }
        } else if (!tun) for (const sd of [-1, 1]) {
          ruban(i, j - i, s => sd * (s.w + gb), 0.22, s => sd * (s.w + t.recul + 0.5), 0.22, dalle); ruban(i, j - i, s => sd * (s.w + gb), 0.22, s => sd * (s.w + gb), -0.6, bordure);
          if (gb) ruban(i, j - i, s => sd * s.w, 0.01, s => sd * (s.w + gb), 0.01, bitume);
        }
        i = j;
      }
      // ---- la place : chaussée pavée tout autour d'un îlot central, l'arc de triomphe au milieu ; on la contourne en glisse (la traverser par l'arche ferait sortir de la piste)
      const C = [450, 0], RI = 47, RT = 121; // centre, bord de l'îlot, façades
      const large = S.map((s, i) => i).filter(i => S[i].w > W + 0.05), paves = h.mat('paves', { side: THREE.DoubleSide });
      ruban(large[0], large[large.length - 1] - large[0], s => -s.w, 0.02, s => s.w, 0.02, paves);
      couronne(C[0], C[1], RI, RT, 0.02, 120, paves);
      couronne(C[0], C[1], 0, RI, 0.25, 96, dalle); // l'îlot, dallé clair comme un trottoir, plus haut
      h.pose('cylindreOuvert', bordure, h.scene, [C[0], 0.1, C[1]], RI, 0.7, 96);
      // le trottoir du pourtour, hors de la chaussée là où une avenue en part
      couronne(C[0], C[1], RT - 20, RT + 6, 0.22, 160, dalle, (x, z) => { const [d, s] = proche(x, z); return d > s.w + 11; });
      const arc = h.pose('arc', { pierre: h.mat('pierre'), relief: h.mat('basRelief') }, h.scene, [C[0], 0.25, C[1]]); arc.forEach(m => m.rotation.y = 1.5708); // grande arche face à l'arrivée
      // réverbères à couronne autour de l'îlot
      const couronneLum = [];
      for (let k = 0; k < 16; k++) { const a = k / 16 * 6.2832; couronneLum.push([C[0] + Math.cos(a) * (RI - 2), C[1] + Math.sin(a) * (RI - 2)]); }
      const fm = ['#d9c9a8', '#cfc0a0', '#e0d4b8'].map(p => h.mat('facadeParis', {}, p)), lots = fm.map(() => []);
      const fb = ['#e8dcc0', '#d8c8b0'].map(p => h.mat('facadeParis', {}, p, 1)), bas = fb.map(() => []); // maisons basses de la butte
      for (let i = 0; i < N; i += 2) {
        const s = S[i], t = TYPES[type[i]], ry = h.across(s), tun = h.zone(i, 14) > 0;
        for (const sd of [-1, 1]) {
          const [qx, qz] = bord(s, sd, W + 12), fleuve = quai(qx, qz) || quai(qx, qz + 14);
          if (i % 8 === 0 && !tun && !fleuve) { // un immeuble tous les 16 m, au recul de la rue ; pas sur la trémie, ni côté fleuve, ni là où une autre rue passe
            const [x, z] = bord(s, sd, s.w + t.recul + 7.5), ruelle = type[i] === 'ruelle';
            if (g.dAt(x, z) > s.w + t.recul + 6.5 && (x - C[0]) ** 2 + (z - C[1]) ** 2 > (RT + 14) ** 2) { const H = t.H[0] + rnd() * (t.H[1] - t.H[0]); (ruelle ? bas[rnd() * 2 | 0] : lots[rnd() * 3 | 0]).push([x, g.hAt(x, z) + H / 2 - 3, z, ry, 17, H + 6, 14]);
              if (i >= h.T.sp[0] && i < h.T.sp[1]) { const [fx, fz] = bord(s, sd, s.w + t.recul - 1.05); boutiques.push([fx, s.y + 0.22, fz, ry - sd * 1.5708, t.recul]); } } // secteur 2 : un commerce en rez-de-chaussée
          }
          if (i % 10 === 0 && !tun && type[i] !== 'berge') for (const off of fleuve ? [2.4] : t.arbres) { const [x, z] = bord(s, sd, s.w + off); if (g.dAt(x, z) > s.w + off - 1.5) { troncs.push([x, s.y + 2.6, z]); houp.push([x, s.y + 7.6, z, rnd() * 6, 1, 0.9, 1]); } } // platanes : en rangées sur les grands axes, le long du fleuve sur le quai
          if (t.gare && !tun && !fleuve && s.w < W + 0.3 && i % 4 === 0 && rnd() < (t.gare > 1 ? 0.8 : 0.55)) { const [x, z] = bord(s, sd, s.w + 1.7); autos[rnd() * 4 | 0].push([x, s.y, z, ry + 1.5708]); } // voitures en stationnement
        }
        if (i % 10 === 0 && h.zone(i, 6) === 0) { const sd = (i / 10) & 1 ? 1 : -1, [x, z] = bord(s, sd, s.w + (t.gare ? 3.6 : 0.6)); mats.push([x, s.y + 3.4, z]); lant.push([x, s.y + 7, z]); h.lum(i, x, s.y + 6.5, z, 0xffd05a, 15, 1.6); } // réverbères, allumés jusqu'au lever du jour
      }
      for (const [x, z] of couronneLum) { mats.push([x, 3.65, z]); lant.push([x, 7.25, z]); h.lum(near(h, x, z), x, 6.75, z, 0xffd05a, 15, 1.6); }
      // la couronne d'immeubles qui ferme la place, façades tournées vers l'arc ; une avenue part là où passe la piste
      for (let a = 0; a < 6.2832; a += 17.5 / RT) { const x = C[0] + Math.cos(a) * (RT + 7), z = C[1] + Math.sin(a) * (RT + 7), [d, s] = proche(x, z);
        if (d > s.w + 18) { const H = 26 + al() * 3; lots[al() * 3 | 0].push([x, g.hAt(x, z) + H / 2 - 3, z, Math.atan2(-Math.sin(a), Math.cos(a)), 14, H + 6, 17.4]); } }
      for (let k = 0; k < 420; k++) { // et la ville derrière : des toits à perte de vue
        const x = g.box[0] + rnd() * (g.box[2] - g.box[0]), z = g.box[1] + rnd() * (g.box[3] - g.box[1]), d = g.dAt(x, z);
        if (d > 52 && !quai(x, z - 30) && (x - C[0]) ** 2 + (z - C[1]) ** 2 > (RT + 22) ** 2) { const H = 18 + rnd() * 8; lots[k % 3].push([x, g.hAt(x, z) + H / 2 - 3, z, (rnd() * 4 | 0) * 1.5708 + rnd() * 0.3, 16 + rnd() * 14, H + 6, 14 + rnd() * 10]); }
      }
      const cube = h.geo('bloc');
      lots.forEach((l, i) => inst(h, cube, fm[i], l)); bas.forEach((l, i) => inst(h, cube, fb[i], l));
      // les combles : corniche de pierre, brisis de zinc à lucarnes, souches de cheminée en brique (le haut des façades ne montre plus de fenêtres)
      const corniche = [], comble = [], souches = [];
      for (const [x, y, z, ry, sx, sy, sz] of [...lots.flat(), ...bas.flat()]) {
        const top = y + sy / 2, c = Math.cos(ry), sn = Math.sin(ry); corniche.push([x, top + 0.15, z, ry, sx + 0.5, 0.3, sz + 0.5]); comble.push([x, top + 1.6, z, ry, sx - 1.6, 3.2, sz - 1.6]);
        for (const [ox, oz] of [[sx * 0.3, sz * 0.2], [-sx * 0.3, -sz * 0.2]]) souches.push([x + c * ox + sn * oz, top + 4.1, z - sn * ox + c * oz, ry]);
      }
      // une géométrie chacun : la pierre règle la densité de sa texture sur la boîte
      inst(h, h.geo('bloc'), h.mat('pierre'), corniche); inst(h, h.geo('bloc'), h.mat('zinc'), comble); inst(h, h.geo('cheminee'), h.mat('brique'), souches);
      inst(h, h.geo('bloc'), h.mat('matGris'), comble.map(([x, y, z, ry, sx, sy, sz]) => [x, y + sy / 2 + 0.05, z, ry, sx - 1.4, 0.1, sz - 1.4])); // le terrasson, plat, au-dessus du brisis
      inst(h, h.geo('reverbere'), h.mat('fonte'), mats); inst(h, h.geo('lanterne'), h.mat('lanterne', LUM), lant);
      inst(h, h.geo('tronc'), h.mat('tronc'), troncs); inst(h, h.geo('houppier'), h.mat('feuillage'), houp);
      const garees = autos.flatMap((l, i) => l.map(p => [...p, 1, 1, 1, [0x2a3a5a, 0x8a8a90, 0x5a1a1a, 0xd8d4c8][i]]));
      insts(h, 'voitureGaree', { caisse: h.mat('laque'), vitre: h.mat('vitreSombre'), chassis: h.mat('matGris'), roue: h.mat('roue'), pneu: h.mat('pneu'), feuRouge: h.mat('feuRouge', LUM), feuBlanc: h.mat('lampe', LUM) }, garees, { teinte: 'caisse' });
      // les commerces du secteur 2 : devanture à enseigne (noms inventés) ; store rayé sur les cafés, boulangeries, fromageries, fleuristes ; terrasse devant les cafés
      // quand le trottoir le permet ; croix verte en drapeau sur la pharmacie ; deux kiosques à journaux sur l'avenue
      const GENRES = [['cafe', 'CAFE DE LA BUTTE', '#1e3a2a', '#e8c860'], ['boulangerie', 'AU FOURNIL DORE', '#5a2a1a', '#f0d890'], ['librairie', 'LIBRAIRIE LA PAGE BLANCHE', '#1a2a4a', '#e8e0c8'],
        ['cafe', 'LE CHAT QUI GUETTE', '#6a1a1a', '#f0d070'], ['pharmacie', 'PHARMACIE DES LILAS', '#e8ece8', '#1a7a4a'], ['fleuriste', 'LES JARDINS DE ROSE', '#2a4a3a', '#f4f0e0'],
        ['fromagerie', 'CREMERIE FROMAGERIE', '#e0d4a8', '#4a3a1a'], ['mode', 'MAISON VERLAINE', '#1a1a1e', '#d8d0c0'], ['boucherie', 'BOUCHERIE DU MARCHE', '#7a1a1a', '#f4f0e0'],
        ['cafe', 'BAR DES AMANDIERS', '#2a2a4a', '#f0c860'], ['librairie', 'LE TEMPS RETROUVE', '#5a1a2a', '#f0d890'], ['mode', 'ATELIER CORALIE', '#4a5a5a', '#f4f0e0']];
      const parGenre = GENRES.map(() => []), stores = [], terrasses = [], croix = [], STORE = { cafe: 0xb02a2a, boulangerie: 0x2a5a8a, fromagerie: 0x3a6a3a, fleuriste: 0x2a6a4a };
      boutiques.forEach(([x, y, z, ry, recul], k) => { const gi = (k * 7 + (al() * 2 | 0)) % GENRES.length, [genre] = GENRES[gi]; parGenre[gi].push([x, y, z, ry]);
        if (STORE[genre]) stores.push([x, y, z, ry, 1, 1, 1, STORE[genre]]); if (genre === 'cafe' && recul >= 3) terrasses.push([x, y, z, ry]); if (genre === 'pharmacie') croix.push([x, y, z, ry]); });
      const geoDev = h.geo('devanture'); parGenre.forEach((l, gi) => l.length && inst(h, geoDev, h.mat('devanture', {}, ...GENRES[gi]), l));
      insts(h, 'store', { toile: h.mat('toileRayee', { side: THREE.DoubleSide }), fer: h.mat('fonte') }, stores, { teinte: 'toile' });
      insts(h, 'terrasse', { plateau: h.mat('craie'), fer: h.mat('fonte'), canne: h.mat('bruit', {}, '#b8925a', ['#8a6a3a', '#d0b080']) }, terrasses);
      insts(h, 'croixPharmacie', { fer: h.mat('fonte'), croix: h.mat('peinture', { lum: 1, c: 0x2aff7a }) }, croix);
      const kq = []; for (const [i, sd] of [[h.T.sp[1] - 60, -1], [h.T.sp[1] - 24, 1]]) { const s = S[i], [x, z] = bord(s, sd, s.w + 4.6); kq.push([x, s.y + 0.22, z, h.across(s) - sd * 1.5708]); } // entre les voitures garées et la rangée d'arbres
      insts(h, 'kiosque', { corps: h.mat('kiosque'), toit: h.mat('peinture', { c: 0x1e4a36 }), comptoir: h.mat('fonte') }, kq);
      // voies sur berge : anneaux d'amarrage, péniches le long du quai ; le pont de pierre qui passe sur l'entrée du tunnel et traverse la Seine
      insts(h, 'anneau', { fer: h.mat('fonte') }, anneaux);
      const pen = [1432, 1480, 1848, 1898].map(i => { const s = S[i], [x, z] = bord(s, -1, s.w + 3.5); return [x, WY, z, h.across(s) + 1.5708, 1, 1, 1, [0x2a2a30, 0x2a4a6a, 0x5a2020, 0x2a4a32][i % 4]]; }); // à couple contre le mur de quai
      insts(h, 'peniche', { coque: h.mat('acier'), liston: h.mat('peinture', { c: 0xe8e0d0 }), pont: h.mat('bruit', {}, '#7a5a3a', ['#6a4a2a', '#8a6a4a']), roof: h.mat('roof'), toit: h.mat('matGris'),
        plantes: h.mat('feuillage') }, pen, { teinte: 'coque' });
      { const s = S[h.T.t0]; h.pose('pont', { pierre: h.mat('pierre'), tablier: h.mat('paves'), fer: h.mat('fonte'), lampe: h.mat('lanterne', LUM) }, repere(h, s), [0, 0, 0], 760, WY - s.y); }
      // le dôme blanc en haut de la butte
      const craie = h.mat('craie'), yb = g.hAt(935, -598);
      h.pose('basilique', { craie }, h.scene, [935, yb, -598]);
      h.pose('dome', craie, h.scene, [935, yb + 24, -596], 13, 8, 5).scale.y = 1.5;
      for (const sx of [-15, 15]) h.pose('dome', craie, h.scene, [935 + sx, yb + 24, -588], 5, 6, 4).scale.y = 1.5;
      return null;
    },

    // ---------- Canal 6 : le lit bétonné d'une rivière de Los Angeles. Pour lire la piste de loin : à l'extérieur de chaque courbe, une fresque
    // fléchée sur le mur anti-crue, une file de balises rayées et un panneau publicitaire sur mât. Pour le lieu : pompes à pétrole qui hochent,
    // château d'eau, ponts, ligne à haute tension, wagons, palmiers, entrepôts, et le centre-ville à contre-jour. ----------
    canal(h) {
      const { THREE, S, N, W, rnd } = h;
      const g = terrain(h, { pas: 16, marge: 340, mat: h.mat('dalleBeton') });
      // fresques fléchées : sur un mur de 5 m à l'extérieur des courbes, des chevrons peints dans le sens du virage
      const fresque = flip => h.mat('fresque', { lum: 1, side: THREE.DoubleSide }, flip);
      const dummy = new THREE.Object3D(), murs = [0, 1].map(f => new THREE.InstancedMesh(h.geo('murFresque'), fresque(f), 400)), cnt = [0, 0], balA = [], balB = [], apex = [];
      for (let i = 0; i < N; i++) {
        const s = S[i], k = s.k; if (Math.abs(k) < 0.0045) continue;
        const f = k > 0 ? 0 : 1, sd = k > 0 ? -1 : 1; // l'extérieur est à gauche d'un virage à droite
        if (i % 8 === 0 && cnt[f] < 400) { const [x, z] = bord(s, sd, W + 1.6); dummy.position.set(x, s.y + 2.5, z); dummy.lookAt(s.x, s.y + 2.5, s.z); dummy.updateMatrix(); murs[f].setMatrixAt(cnt[f]++, dummy.matrix); }
        if (i % 4 === 0) { const [x, z] = bord(s, sd, W + 0.5); (i % 8 ? balA : balB).push([x, s.y + 4.4, z]); } // balises hautes, une sur deux blanche, l'autre rose
        if (Math.abs(k) > Math.abs(S[(i + N - 1) % N].k) && Math.abs(k) >= Math.abs(S[(i + 1) % N].k) && Math.abs(k) > 0.008) apex.push([i, sd]);
      }
      murs.forEach((m, f) => { m.count = cnt[f]; m.frustumCulled = false; h.scene.add(m); });
      inst(h, h.geo('balise'), h.mat('peinture', { lum: 1, c: 0xf4f0e0 }), balA); inst(h, h.geo('balise'), h.mat('peinture', { lum: 1, c: 0xe83f8c }), balB);
      // panneaux publicitaires (enseignes inventées) : un mât de 24 m au point de corde extérieur de chaque courbe, visible de très loin
      const pubs = [['TACOS 24H', '#c8102e', '#ffd84a'], ['KDAY 94 FM', '#3d2a5c', '#ffc04a'], ['MOTEL PALMS', '#1f8f8a', '#f4f0e0'], ['AUTO PARTS', '#f4f0e0', '#1a1420'], ['DONUTS', '#e83f8c', '#f4f0e0'], ['CANAL 6', '#1a1420', '#ff7a3d']].map(([t, a, b]) => h.mat('ecrit', LUM, 64, 32, a, b, t, 12));
      const fer = h.mat('fer');
      apex.forEach(([i, sd], k) => h.pose('panneauPub', { mat: fer, affiche: pubs[k % pubs.length] }, repere(h, S[i]), [sd * (W + 9), 0, 0], sd * 0.5));
      // ponts : un tablier droit du nord au sud, par-dessus le canal et la berge ; piles posées là où il n'y a pas de route
      const beton = h.mat('beton');
      for (const bx of [500, 1000, 1500]) {
        h.pose('pontCanal', { beton }, h.scene, [bx, 0, 110]);
        for (let z = -200; z <= 420; z += 34) if (g.dAt(bx, z) > W + 7) { const y = g.hAt(bx, z); boite(h, beton, 6, 17 - y, 6, bx, (16 + y) / 2, z); }
      }
      // ligne à haute tension sur la rive nord ; palmiers en file le long de la berge ; wagons sur la voie ferrée du sud
      const pyl = [], bras = [], fils = [], troncs = [], palmes = [], wagons = [[], [], []], lamp = [], tete = [];
      for (let x = -400; x <= 2100; x += 190) { const z = -230, y = g.hAt(x, z); pyl.push([x, y + 24, z]); bras.push([x, y + 44, z]); if (x > -400) for (const o of [-7, 7]) fils.push(x - 190, g.hAt(x - 190, z) + 44, z + o, x, y + 44, z + o); }
      inst(h, h.geo('pyloneHT'), h.mat('pylone'), pyl); inst(h, h.geo('brasHT'), h.mat('pylone'), bras);
      const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fils, 3)); h.scene.add(new THREE.LineSegments(fg, new THREE.LineBasicMaterial({ color: 0x2a1c2a })));
      for (let i = 0; i < N; i += 7) for (const sd of [-1, 1]) {
        const s = S[i], [x, z] = bord(s, sd, W + 6.5);
        if (g.dAt(x, z) < W + 5.5 || s.y < 0) continue; // seulement sur la berge, pas dans le lit
        const y = g.hAt(x, z), ht = 12 + rnd() * 5; troncs.push([x, y + ht / 2, z, 0, 1, ht, 1]); palmes.push([x, y + ht, z, rnd() * 6]);
        if (i % 21 === 0) { const [lx, lz] = bord(s, sd, W + 1.2), [hx, hz] = bord(s, sd, W - 0.4), ry = h.across(s); lamp.push([lx, s.y + 5, lz, ry]); tete.push([hx, s.y + 10, hz, ry]); h.lum(i, hx, s.y + 9.6, hz, 0xffc04a, 26, 1.5); } // lampadaires de la route de berge
        if (sd > 0 && i % 21 === 0) { const [wx, wz] = bord(s, 1, W + 24); if (g.dAt(wx, wz) > W + 20) wagons[rnd() * 3 | 0].push([wx, g.hAt(wx, wz), wz, h.across(s) + 1.5708]); }
      }
      inst(h, h.geo('troncPalmier'), h.mat('troncPalmier'), troncs); insts(h, 'palmes', { palme: h.mat('palme', { side: THREE.DoubleSide }) }, palmes);
      inst(h, h.geo('matLampadaire'), fer, lamp); inst(h, h.geo('teteLampadaire', 3), h.mat('lampeCanal', LUM), tete);
      insts(h, 'wagonCouvert', { caisse: h.mat('wagon'), toit: h.mat('matGris'), chassis: h.mat('fer'), roue: h.mat('roue'), pneu: h.mat('fer') }, wagons.flatMap((l, i) => l.map(p => [...p, 1, 1, 1, [0x8a3a2a, 0x5a4a3a, 0x3a4a5a][i]])), { teinte: 'caisse' });
      // pompes à pétrole : le balancier hoche lentement, comme dans les champs pétrolifères de la ville
      const pompes = [], minium = h.mat('minium');
      for (let k = 0, n = 0; k < 400 && n < 9; k++) {
        const x = g.box[0] + 200 + rnd() * (g.box[2] - g.box[0] - 400), z = g.box[1] + 150 + rnd() * (g.box[3] - g.box[1] - 300), d = g.dAt(x, z);
        if (d < W + 28 || d > 110 || g.hAt(x, z) < 1) continue;
        const p = new THREE.Group(); p.position.set(x, g.hAt(x, z), z); p.rotation.y = rnd() * 6.283; h.scene.add(p); n++;
        h.pose('pompeSocle', { fer }, p);
        const bal = new THREE.Group(); bal.position.set(0, 7.6, 0); p.add(bal); h.pose('pompeBalancier', { minium, fer }, bal);
        pompes.push([bal, rnd() * 6.283]);
      }
      // château d'eau au nom du lieu, près de la ligne de départ : le repère qu'on voit de partout
      { const s = S[0], sd = g.dAt(...bord(s, 1, 50)) > g.dAt(...bord(s, -1, 50)) ? 1 : -1, [x, z] = bord(s, sd, W + 38), y = g.hAt(x, z);
        h.pose('chateauEau', { fer, cuve: h.mat('ecrit', LUM, 64, 32, '#f4f0e0', '#e83f8c', 'CANAL 6', 14) }, h.scene, [x, y, z]); }
      // entrepôts bas autour, puis les tours du centre-ville à l'ouest, à contre-jour devant le soleil
      const hl = [];
      for (let k = 0; k < 260; k++) { const x = g.box[0] + rnd() * (g.box[2] - g.box[0]), z = g.box[1] + rnd() * (g.box[3] - g.box[1]); if (g.dAt(x, z) > 80) hl.push([x, g.hAt(x, z) + 3, z, (rnd() * 2 | 0) * 1.5708, 30 + rnd() * 40, 9 + rnd() * 6, 22 + rnd() * 20]); }
      inst(h, h.geo('bloc'), h.mat('entrepot'), hl); // toits de bac acier à lanterneaux, débordants, et quelques groupes de ventilation dessus
      inst(h, h.geo('bloc'), h.mat('toleToit'), hl.map(([x, y, z, ry, sx, sy, sz]) => [x, y + sy / 2 + 0.3, z, ry, sx + 0.8, 0.6, sz + 0.8]));
      inst(h, h.geo('bloc'), h.mat('acier'), hl.filter((p, k) => k % 3 === 0).map(([x, y, z, ry, sx, sy]) => [x, y + sy / 2 + 1.6, z, ry, 4, 2, 3]));
      const tours = h.mat('tourLoin', { lum: 1, fog: false }, '#2a1c3a', ['#ffc04a'], 40);
      for (let i = 0; i < 34; i++) { const hh = 120 + rnd() * rnd() * 380, w = 50 + rnd() * 70; boite(h, tours, w, hh, w, -2300 + rnd() * 900, hh / 2, -500 + rnd() * 1300); }
      return (dt, now) => { for (const [b, ph] of pompes) b.rotation.z = Math.sin(now * 0.0012 + ph) * 0.32; };
    },
  };
})();
