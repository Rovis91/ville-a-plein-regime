// Placement des décors des cartes autres que la ville (qui reste dans game.js). Chaque décor est une fonction DECORS[id](h) appelée une fois au chargement.
// Ce fichier ne dit que OÙ poser QUOI avec QUELLE texture : les formes sont dans formes.js, les textures dans textures.js.
// h = outils de game.js : THREE, scene, T/S/N/W (piste), M (carte), ribbon, rnd, across, zone, temps (horloge du trafic),
//   geo('forme', ...réglages)                  = géométrie d'une forme simple, pour inst()
//   mat('texture', options, ...réglages)       = matière ; options : lum (lumineuse par elle-même), c (teinte), retro, gloss, rep (répétition), et celles de three
//   pose('forme', peau, parent, [x, y, z], ...réglages) = pose une forme ; peau = une matière, ou { zone: matière } pour un assemblage
//   lum(i, x, y, z, couleur, portée, force)    = déclare un luminaire à l'échantillon de piste i
// Elle construit le décor autour du tracé et peut renvoyer une fonction tick(dt, now) pour ce qui bouge.
(function () {
  // Pose une liste d'objets identiques en une seule passe de dessin. Élément : [x, y, z, rotationY, échelleX, échelleY, échelleZ].
  function inst(h, geo, mat, list) {
    const m = new h.THREE.InstancedMesh(geo, mat, Math.max(1, list.length)), d = new h.THREE.Object3D();
    list.forEach((p, i) => { d.position.set(p[0], p[1], p[2]); d.rotation.set(0, p[3] || 0, 0); d.scale.set(p[4] || 1, p[5] || p[4] || 1, p[6] || p[4] || 1); d.updateMatrix(); m.setMatrixAt(i, d.matrix); });
    m.count = list.length; m.frustumCulled = false; m.castShadow = m.receiveShadow = h.TH.sun[1] > 0.6; h.scene.add(m); return m; // soleil rasant (Paris, canal) : tout le décor porte une ombre ; de nuit ce serait du temps de rendu pour rien
  }
  const near = (h, x, z) => { let b = 0, bd = 1e18; h.S.forEach((s, i) => { const d = (s.x - x) ** 2 + (s.z - z) ** 2; if (d < bd) { bd = d; b = i; } }); return b; };
  const pt = (h, i) => near(h, h.M.pts[i][0] * h.M.sc, h.M.pts[i][1] * h.M.sc); // échantillon de piste le plus proche du point de contrôle i
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
      inst(h, h.geo('cedre'), h.mat('cedre'), arbres);
      // catadioptres orange sur les glissières : le seul balisage, comme sur une vraie route de col
      const cata = [];
      for (let i = 0; i < N; i += 6) for (const side of [-1, 1]) { const [x, z] = bord(S[i], side, W + 0.15); cata.push([x, S[i].y + 0.85, z]); }
      inst(h, h.geo('catadioptre'), h.mat('catadioptre', { lum: 1, retro: 2.5 }), cata); // éteints, ils s'allument dans le faisceau des phares

      // --- le carrefour : tout est posé dans le repère de la route, X vers l'extérieur ---
      const gr = repere(h, sc), X = v => sd * (W + v), bitume = h.mat('bitume'), acier = h.mat('acier');
      h.pose('esplanade', { bitume }, gr, [X(21), 0, 0]); h.pose('traverse', { bitume }, gr, [X(70), 0, -12]); // la route de traverse s'enfonce dans la forêt
      // supérette : vitrine éclairée, bandeau à enseigne originale (bleu et jaune), distributeurs devant la vitrine
      h.pose('superette', { vitrine: h.mat('vitrine', LUM), enseigne: h.mat('ecrit', LUM, 128, 12, '#1d4ac8', '#ffd84a', 'カラスマート  KARASU MART  24H', 9), distributeur: h.mat('distributeur', LUM) }, gr, [X(34), 0, -8], sd);
      // station-service : auvent éclairé par-dessous, deux pompes, totem de prix (marque inventée)
      h.pose('station', { acier, lampe: h.mat('lampe', LUM), enseigne: h.mat('ecrit', LUM, 96, 8, '#c8102e', '#ffffff', 'TOGE OIL  峠石油', 7), pompe: h.mat('pompeEssence', LUM) }, gr, [X(15), 0, 15]);
      h.pose('totem', { acier, prix: h.mat('ecrit', LUM, 32, 32, '#101418', '#ffd84a', '168', 14) }, gr, [X(4.5), 0, 25]);
      // voitures garées : silhouettes de sportives génériques, feux allumés, certaines tournées vers la route
      const vitre = h.mat('vitreSombre'), feuRouge = h.mat('feuRouge', LUM), feuBlanc = h.mat('lampe', LUM);
      [[7, -19, 0.3, 0xf4f0e0], [7.5, -13, -0.2, 0xc8102e], [8, -7, 0.15, 0x2a5ac8], [22, -21, 1.57, 0x14161c], [22, 2, 1.4, 0xffc04a], [10, 6, -0.4, 0x9aa0a8], [16, 26, 1.57, 0x1f8f5a]].forEach(([vx, vz, a, col]) => {
        const v = new THREE.Group(); v.position.set(X(vx), 0.15, vz); v.rotation.y = a; gr.add(v);
        h.pose('voitureGaree', { caisse: h.mat('peinture', { c: col }), vitre, feuRouge, feuBlanc }, v);
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
      const g = terrain(h, { pas: 16, marge: 330, sol: s => Math.min(s.y, 0), creux: (x, z) => mer(x, z) ? 13 : 0, mat: h.mat('bruit', {}, '#1a1c22', ['#22252c', '#14161a', '#2a2622']) });
      const eau = h.mat('bruit', { lum: 1, rep: [300, 300] }, '#071824', ['#0f3b4a', '#0a2836', '#3a2c18']);
      // quatre plans d'eau : le chenal, et la mer à l'ouest, à l'est et au sud de l'île. Aucun au-dessus des tranchées du tunnel.
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
      // panneaux d'autoroute verts, rétroréfléchissants : chacun annonce ce qui vient (pont, port, tunnel, centre)
      const gris = h.mat('portiqueGris'), pan = t => h.mat('panneauRoute', { lum: 1, retro: 0.7 }, t);
      for (const [ip, a, b] of [[1, '湾岸線 ↑', '橋 BRIDGE 1km'], [3, '橋 BRIDGE', '港 PORT →'], [9, '港 PORT', '出口 EXIT'], [21, 'トンネル TUNNEL', '都心 CENTER →'], [32, '湾岸線 WAN-9', '都心 CENTER']])
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
      // l'île du port : conteneurs empilés de part et d'autre de la route des quais, grues le long du chenal
      const cols = [0xb8442c, 0x2c6ab8, 0xc9a02c, 0x3a8a5a], piles = cols.map(() => []);
      for (let gx = ILE[0] + 40; gx < ILE[1] - 30; gx += 30) for (let gz = CH1 + 50; gz < ILE[2] - 40; gz += 8) {
        if (rnd() < 0.5 || g.dAt(gx, gz) < W + 9 || g.hAt(gx, gz) < -1.5) continue;
        for (let k = (rnd() * 4 | 0); k >= 0; k--) piles[rnd() * 4 | 0].push([gx + rnd() * 2, g.hAt(gx, gz) + 1.5 + k * 2.6, gz, 0]);
      }
      piles.forEach((l, i) => inst(h, h.geo('conteneur'), h.mat('peinture', { c: cols[i] }), l));
      for (const cx of [-200, 150, 500, 850]) { h.pose('grue', { structure: h.mat('minium'), cabine: blanc }, h.scene, [cx, 0, CH1]); balises.push(cx, 50, CH1 - 36); } // portiques : pieds sur le quai, flèche au-dessus de l'eau
      // la ville, au nord : tours à fenêtres allumées qui bordent la voie rapide, de plus en plus hautes vers l'intérieur
      const tour = cols2 => h.mat('tourFenetres', LUM, cols2);
      const tm = [tour(['#ffb85a', '#ffd27a']), tour(['#f4f1e0', '#9fd0ff']), tour(['#ffb85a', '#f4f1e0', '#ff7a5a'])], tl = tm.map(() => []);
      for (let gx = g.box[0] + 30; gx < g.box[2] - 30; gx += 58) for (let gz = g.box[1] + 30; gz < CH0 - 60; gz += 58) {
        const x = gx + rnd() * 16, z = gz + rnd() * 16, d = g.dAt(x, z);
        if (d < W + 26 || g.hAt(x, z) < -1.5) continue;
        const hh = 26 + rnd() * 40 + Math.min(120, d * 0.35) * rnd(), w = 26 + rnd() * 16; tl[rnd() * 3 | 0].push([x, hh / 2 - 1, z, 0, w, hh, w]);
      }
      tl.forEach((l, i) => inst(h, h.geo('bloc'), tm[i], l));
      const loin = h.mat('tourLoin', { lum: 1, fog: false }, '#0a1020', ['#ffb85a', '#f4f1e0', '#ffd27a'], 90);
      for (let i = 0; i < 60; i++) { const a = 3.3 + rnd() * 2.8, r = 1900 + rnd() * 900, hh = 120 + rnd() * rnd() * 420, w = 60 + rnd() * 110; boite(h, loin, w, hh, w, 500 + Math.cos(a) * r * 1.4, hh / 2 - 1, -100 + Math.sin(a) * r); }
      const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(balises, 3));
      const bp = new THREE.Points(bg, new THREE.PointsMaterial({ color: 0xff2030, size: 2, sizeAttenuation: false, fog: false })); bp.frustumCulled = false; h.scene.add(bp);
      // grande roue sur le front de mer : un anneau de points de couleur, qui tourne lentement
      const rp = [], rc = [];
      for (let i = 0; i < 48; i++) { const a = i / 48 * 6.283; rp.push(Math.cos(a) * 70, Math.sin(a) * 70, 0); rc.push(...[[1, 0.3, 0.6], [0.3, 0.9, 1], [1, 0.9, 0.3]][i % 3]); if (i % 6 === 0) for (let r = 10; r < 70; r += 12) { rp.push(Math.cos(a) * r, Math.sin(a) * r, 0); rc.push(1, 1, 1); } }
      const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3)); rg.setAttribute('color', new THREE.Float32BufferAttribute(rc, 3));
      const roue = new THREE.Points(rg, new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true, fog: false })); roue.position.set(620, 78, 40); roue.rotation.y = 0.5; roue.frustumCulled = false; h.scene.add(roue);
      // camions : la remorque, la cabine et les feux arrière suivent le trafic de sim.js
      const nt = h.M.trafic, d = new THREE.Object3D();
      const rem = new THREE.InstancedMesh(h.geo('remorque'), h.mat('peinture', { c: 0xb8bcc4 }), nt), cab = new THREE.InstancedMesh(h.geo('cabine'), h.mat('peinture', { c: 0x2c6ab8 }), nt), feux = new THREE.InstancedMesh(h.geo('feuxCamion'), h.mat('feuRouge', LUM), nt);
      for (const m of [rem, cab, feux]) { m.frustumCulled = false; h.scene.add(m); }
      return (dt, now) => {
        roue.rotation.z = now * 0.00012; bp.visible = (now / 700 & 1) === 1;
        const vis = h.temps() >= 0; rem.visible = cab.visible = feux.visible = vis; if (!vis) return; // pas de camions en mode course
        trafic(T, h.temps()).forEach((k, i) => {
          const fx = Math.cos(k.th), fz = Math.sin(k.th);
          d.rotation.set(0, -k.th, 0);
          d.position.set(k.x - fx * 1.2, k.y + 2.15, k.z - fz * 1.2); d.updateMatrix(); rem.setMatrixAt(i, d.matrix);
          d.position.set(k.x + fx * 4.1, k.y + 1.9, k.z + fz * 4.1); d.updateMatrix(); cab.setMatrixAt(i, d.matrix);
          d.position.set(k.x - fx * 5.25, k.y + 1.2, k.z - fz * 5.25); d.updateMatrix(); feux.setMatrixAt(i, d.matrix);
        });
        rem.instanceMatrix.needsUpdate = cab.instanceMatrix.needsUpdate = feux.instanceMatrix.needsUpdate = true;
      };
    },

    // ---------- Premier métro : la largeur de chaussée est la même partout (sim.js), mais la rue change de taille : grand boulevard à contre-allées
    // et double rangée d'arbres, avenue, rue, ruelle de la butte aux maisons basses collées au trottoir, quai ouvert sur la Seine, place. ----------
    paris(h) {
      const { THREE, S, N, W, rnd, M } = h, quai = (x, z) => z > 262 && x > -170 && x < 1060; // côté fleuve des quais
      const g = terrain(h, { pas: 16, marge: 320, mat: h.mat('bruit', {}, '#6e6a66', ['#7a7672', '#625e5a']), creux: (x, z) => quai(x, z) ? Math.min(9, (z - 262) * 0.5) : 0 });
      boite(h, h.mat('bruit', { lum: 1, rep: [40, 20] }, '#1e3a3a', ['#2a4a48', '#c08a7a', '#16302e']), 1500, 1, 700, 450, -11, 640); // la Seine, qui prend le rose du ciel
      // types de rue : recul = distance du trottoir à la façade, H = hauteur des immeubles, arbres = rangées (distance au bord), gare = stationnement
      const TYPES = { boulevard: { recul: 21, H: [26, 30], arbres: [5.5, 15], gare: 2 }, avenue: { recul: 11, H: [22, 26], arbres: [6], gare: 1 }, rue: { recul: 3.2, H: [18, 22], arbres: [], gare: 0 },
        ruelle: { recul: 1, H: [9, 15], arbres: [], gare: 0 }, quai: { recul: 6.5, H: [20, 24], arbres: [], gare: 1 }, place: { recul: 30, H: [26, 28], arbres: [], gare: 0 } };
      const type = new Array(N).fill('rue'), rues = M.th.rues.map(([p, t]) => [pt(h, p), t]).sort((a, b) => a[0] - b[0]);
      rues.forEach(([i0, t], k) => { const i1 = k + 1 < rues.length ? rues[k + 1][0] : N; for (let i = i0; i < i1; i++) type[i] = t; });
      for (let i = 0; i < rues[0][0]; i++) type[i] = rues[rues.length - 1][1];
      // trottoirs et contre-allées : un ruban clair de la chaussée à la façade, par tronçon de même type ; la bande de stationnement reste sombre
      const dalle = h.mat('trottoir', { side: THREE.DoubleSide });
      for (let i = 0; i < N;) { let j = i; while (j < N && type[j] === type[i]) j++; const t = TYPES[type[i]]; for (const sd of [-1, 1]) h.ribbon(i, j - i, sd * (W + (t.gare ? 3.2 : 0.1)), 0.22, sd * (W + t.recul + 0.5), 0.22, dalle); i = j; }
      const fm = ['#d9c9a8', '#cfc0a0', '#e0d4b8'].map(p => h.mat('facadeParis', {}, p)), lots = fm.map(() => []);
      const fb = ['#e8dcc0', '#d8c8b0'].map(p => h.mat('facadeParis', {}, p, 1)), bas = fb.map(() => []); // maisons basses de la butte
      const troncs = [], houp = [], mats = [], lant = [], autos = [[], [], [], []];
      for (let i = 0; i < N; i += 2) {
        const s = S[i], t = TYPES[type[i]], ry = h.across(s), tun = h.zone(i, 14) > 0;
        for (const sd of [-1, 1]) {
          const [qx, qz] = bord(s, sd, W + 12), fleuve = quai(qx, qz) || quai(qx, qz + 14);
          if (i % 8 === 0 && !tun && !fleuve) { // un immeuble tous les 16 m, au recul de la rue ; pas sur la trémie, ni côté fleuve, ni là où une autre rue passe
            const [x, z] = bord(s, sd, W + t.recul + 7.5), ruelle = type[i] === 'ruelle';
            if (g.dAt(x, z) > W + t.recul + 6.5 && (type[i] !== 'place' || (x - 450) ** 2 + z * z > 118 * 118)) { const H = t.H[0] + rnd() * (t.H[1] - t.H[0]); (ruelle ? bas[rnd() * 2 | 0] : lots[rnd() * 3 | 0]).push([x, g.hAt(x, z) + H / 2 - 3, z, ry, 17, H + 6, 14]); }
          }
          if (i % 10 === 0 && !tun) for (const off of fleuve ? [2.4] : t.arbres) { const [x, z] = bord(s, sd, W + off); if (g.dAt(x, z) > W + off - 1.5) { troncs.push([x, s.y + 2.6, z]); houp.push([x, s.y + 7.6, z, rnd() * 6, 1, 0.9, 1]); } } // platanes : en rangées sur les grands axes, le long du fleuve sur le quai
          if (t.gare && !tun && !fleuve && i % 4 === 0 && rnd() < (t.gare > 1 ? 0.8 : 0.55)) { const [x, z] = bord(s, sd, W + 1.7); autos[rnd() * 4 | 0].push([x, s.y + 0.75, z, ry + 1.5708]); } // voitures en stationnement
        }
        if (i % 10 === 0 && h.zone(i, 6) === 0) { const sd = (i / 10) & 1 ? 1 : -1, [x, z] = bord(s, sd, W + (t.gare ? 3.6 : 0.6)); mats.push([x, s.y + 3.4, z]); lant.push([x, s.y + 7, z]); h.lum(i, x, s.y + 6.5, z, 0xffd05a, 15, 1.6); } // réverbères, allumés jusqu'au lever du jour
      }
      for (let k = 0; k < 420; k++) { // et la ville derrière : des toits à perte de vue
        const x = g.box[0] + rnd() * (g.box[2] - g.box[0]), z = g.box[1] + rnd() * (g.box[3] - g.box[1]), d = g.dAt(x, z);
        if (d > 52 && !quai(x, z - 30) && (x - 450) ** 2 + z * z > 118 * 118) { const H = 18 + rnd() * 8; lots[k % 3].push([x, g.hAt(x, z) + H / 2 - 3, z, (rnd() * 4 | 0) * 1.5708 + rnd() * 0.3, 16 + rnd() * 14, H + 6, 14 + rnd() * 10]); }
      }
      const cube = h.geo('bloc');
      lots.forEach((l, i) => inst(h, cube, fm[i], l)); bas.forEach((l, i) => inst(h, cube, fb[i], l));
      inst(h, h.geo('reverbere'), h.mat('fonte'), mats); inst(h, h.geo('lanterne'), h.mat('lanterne', LUM), lant);
      inst(h, h.geo('tronc'), h.mat('tronc'), troncs); inst(h, h.geo('houppier'), h.mat('feuillage'), houp);
      [0x2a3a5a, 0x8a8a90, 0x5a1a1a, 0xd8d4c8].forEach((c, i) => inst(h, h.geo('auto'), h.mat('peinture', { c }), autos[i]));
      // l'arche au centre de la place ; le dôme blanc en haut de la butte
      h.pose('arche', { pierre: h.mat('pierre') }, h.scene, [450, g.hAt(450, 0), 0]);
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
        const y = g.hAt(x, z), ht = 12 + rnd() * 5; troncs.push([x, y + ht / 2, z, 0, 1, ht, 1]); palmes.push([x, y + ht, z, rnd() * 6, 1, 0.45, 1]);
        if (i % 21 === 0) { const [lx, lz] = bord(s, sd, W + 1.2), [hx, hz] = bord(s, sd, W - 0.4), ry = h.across(s); lamp.push([lx, s.y + 5, lz, ry]); tete.push([hx, s.y + 10, hz, ry]); h.lum(i, hx, s.y + 9.6, hz, 0xffc04a, 26, 1.5); } // lampadaires de la route de berge
        if (sd > 0 && i % 21 === 0) { const [wx, wz] = bord(s, 1, W + 24); if (g.dAt(wx, wz) > W + 20) wagons[rnd() * 3 | 0].push([wx, g.hAt(wx, wz) + 2.4, wz, h.across(s) + 1.5708]); }
      }
      inst(h, h.geo('troncPalmier'), h.mat('troncPalmier'), troncs); inst(h, h.geo('palme'), h.mat('palme'), palmes);
      inst(h, h.geo('matLampadaire'), fer, lamp); inst(h, h.geo('teteLampadaire', 3), h.mat('lampeCanal', LUM), tete);
      [0x8a3a2a, 0x5a4a3a, 0x3a4a5a].forEach((c, i) => inst(h, h.geo('wagon'), h.mat('peinture', { c }), wagons[i]));
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
      inst(h, h.geo('bloc'), h.mat('entrepot'), hl);
      const tours = h.mat('tourLoin', { lum: 1, fog: false }, '#2a1c3a', ['#ffc04a'], 40);
      for (let i = 0; i < 34; i++) { const hh = 120 + rnd() * rnd() * 380, w = 50 + rnd() * 70; boite(h, tours, w, hh, w, -2300 + rnd() * 900, hh / 2, -500 + rnd() * 1300); }
      return (dt, now) => { for (const [b, ph] of pompes) b.rotation.z = Math.sin(now * 0.0012 + ph) * 0.32; };
    },
  };
})();
