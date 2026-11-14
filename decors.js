// Placement des décors des cartes. Chaque décor est une fonction DECORS[id](h) appelée une fois au chargement.
// Ce fichier ne dit que OÙ poser QUOI avec QUELLE texture : les formes sont dans formes.js, les textures dans textures.js.
// h = outils de game.js : THREE, scene, T/S/N/W (piste), M (carte), ribbon, rnd, across, zone, temps (horloge du trafic), et pour la ville tx, addMat, box, concrete, beams (faisceaux que game.js tourne vers la caméra),
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
  //       sol(s) = altitude du sol sous l'échantillon s quand la route n'est pas posée dessus (viaduc, pont),
  //       sous = pente (touge seul) : plafonne chaque sommet sous toute la route proche, puis remonte de `sous` m par mètre ; les triangles ne passent plus sur une chaussée en contrebas (lacets) }
  // Renvoie hAt(x, z) = altitude du sol et dAt(x, z) = distance à la route, pour y poser le décor.
  function terrain(h, o) {
    const { THREE, S, W } = h, pas = o.pas, sol = o.sol || (s => s.y);
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const s of S) { x0 = Math.min(x0, s.x); x1 = Math.max(x1, s.x); z0 = Math.min(z0, s.z); z1 = Math.max(z1, s.z); }
    x0 -= o.marge; z0 -= o.marge; x1 += o.marge; z1 += o.marge;
    const nx = Math.ceil((x1 - x0) / pas) + 1, nz = Math.ceil((z1 - z0) / pas) + 1, Y = new Float32Array(nx * nz), D = new Float32Array(nx * nz), sub = S.filter((s, i) => i % 3 === 0).map(s => ({ x: s.x, z: s.z, w: s.w || W, g: sol(s), pose: sol(s) > s.y - 0.5 }));
    const R = pas * 1.42 + W + 1, RC = R + 48, cases = new Map(); // R : distance max entre un sommet d'un triangle qui touche la chaussée et l'échantillon de route de ce point
    if (o.sous) for (const s of S) { const c = Math.floor(s.x / RC) * 1e4 + Math.floor(s.z / RC); if (!cases.has(c)) cases.set(c, []); cases.get(c).push(s); } // la route rangée par cases de RC mètres
    const pos = new Float32Array(nx * nz * 3), uv = new Float32Array(nx * nz * 2), idx = [];
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
      const x = x0 + ix * pas, z = z0 + iz * pas, k = iz * nx + ix; let sw = 0, sy = 0, dm = 1e18, pm = null;
      for (const s of sub) { const d2 = (s.x - x) ** 2 + (s.z - z) ** 2, w = 1 / ((d2 + 100) * (d2 + 100)); sw += w; sy += w * s.g; if (d2 < dm) { dm = d2; pm = s; } }
      const d = Math.sqrt(dm); let y = sy / sw - 0.5;
      if (d < pm.w + 1 && pm.pose) y -= 1.5; // sous la chaussée : on creuse, la route et ses murets cachent le raccord
      if (o.loin && d > o.loin) y -= (d - o.loin) * o.chute;
      if (o.sous && d < R) y = Math.max(y, pm.g - 1.7); // assez haut pour que le pied des murets ne flotte pas
      if (o.sous && d < RC) for (let cz = -1; cz <= 1; cz++) for (let cx = -1; cx <= 1; cx++) for (const s of cases.get((Math.floor(x / RC) + cx) * 1e4 + Math.floor(z / RC) + cz) || []) {
        const e = Math.hypot(s.x - x, s.z - z); if (e < RC) y = Math.min(y, s.y - 0.3 + Math.max(0, e - R) * o.sous); // au-delà de RC la remontée dépasse tout dénivelé de la carte
      }
      if (o.creux) y -= o.creux(x, z); // après le plafond des lacets : un ravin (touge) peut passer sous la chaussée
      Y[k] = y; D[k] = d; pos.set([x, y, z], k * 3); uv.set(o.sous ? [(x + y) / 10, (z + y) / 10] : [x / 10, z / 10], k * 2); // touge : la texture suit aussi la hauteur, sans s'étirer sur les parois raides
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

  // La mégapole de nuit tout autour du massif du touge, de 800 à 2 350 m du milieu des lacets, 110 à 240 m sous eux, hors brouillard. Le ciel est une sphère de 2 500 m
  // autour de la caméra : rien n'est posé au-delà de 2 350 m des lacets et de la supérette, sinon il disparaîtrait derrière.
  // Une ville japonaise, pas un damier : des quartiers serrés chacun avec sa trame (îlots de 25 à 55 m, rues qui ondulent), un tapis continu de petits
  // immeubles éclairés en blanc froid et chaud, des autoroutes urbaines surélevées qui serpentent, des voies ferrées et leurs gares, des grappes de tours
  // et partout des feux rouges d'obstacle qui clignotent ensemble ; une tour de télévision, une tour en treillis rouge, la baie et son pont suspendu.
  // Tout en points de taille fixe à l'écran (nets à toute distance), une passe de dessin par taille. Renvoie la matière des feux rouges.
  function ville(h, g) { // g = terrain du massif, pour poser les hameaux
    const { THREE } = h, C = [460, 430], VU = [[460, 430], [720, 580]], A = [], B = [], F = [], R = []; // A : rues ; B : axes, gares, monuments ; F : fenêtres ; R : feux rouges
    let sd = 91; const al = () => (sd = sd * 1664525 + 1013904223 >>> 0) / 4294967296; // hasard propre à la ville : ne décale pas rnd
    const pol = (deg, r) => [C[0] + Math.cos(deg / 57.3) * r, C[1] + Math.sin(deg / 57.3) * r], rC = (x, z) => Math.hypot(x - C[0], z - C[1]);
    const alt = r => -150 + (r - 800) * 0.07 + Math.max(0, r - 1800) * 0.06, y0 = (x, z) => alt(rC(x, z)); // le sol remonte vers l'horizon : le tapis va jusqu'à lui
    const baie = pol(212, 1750), BX = 560, BZ = 360, eau = (x, z) => ((x - baie[0]) / BX) ** 2 + ((z - baie[1]) / BZ) ** 2 < 1;
    const parcs = Array.from({ length: 22 }, () => [...pol(al() * 360, 1150 + al() * 1100), 40 + al() * 80]);
    const sol = (x, z) => { const r = rC(x, z); return r > 800 && VU.every(([vx, vz]) => (x - vx) ** 2 + (z - vz) ** 2 < 2350 * 2350) && !eau(x, z) && parcs.every(([px, pz, pr]) => (x - px) ** 2 + (z - pz) ** 2 > pr * pr); };
    const centres = [[178, 1300, 1], [150, 1700, 1], [200, 2050, 0.9], [128, 1450, 0.8], [240, 1350, 0.8], [105, 2000, 0.7], [255, 2000, 0.7], [60, 1500, 0.5], [300, 1500, 0.5]].map(([a, r, f]) => [...pol(a, r), f]);
    const dens = (x, z) => Math.min(1, 0.45 + centres.reduce((a, [cx, cz, f]) => a + f * 0.8 * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / 1.6e5), 0));
    const met = (L, x, y, z, c, k = 0.7 + al() * 0.3) => L.push(x, y, z, (c >> 16 & 255) / 255 * k, (c >> 8 & 255) / 255 * k, (c & 255) / 255 * k);
    const blanc = (chaud) => { const u = al(); return chaud > u ? 0xffe0b0 : u < 0.6 ? 0xe8f0ff : u < 0.88 ? 0xfff4e0 : u < 0.94 ? 0xffb060 : [0xff60c0, 0x60f0ff, 0x80ff90, 0xffe040][al() * 4 | 0]; };
    // quartiers : chacun sa trame, son orientation, la taille de ses îlots ; une table de 25 m dit à quel quartier appartient chaque point
    const Q = Array.from({ length: 90 }, () => { const [x, z] = pol(al() * 360, 750 + Math.sqrt(al()) * 1650); return { x, z, a: al() * 3.1416, s: 25 + al() * 30, o: al() * 6.283 }; });
    const T0 = [C[0] - 2400, C[1] - 2400], NT = 192, tab = new Uint8Array(NT * NT);
    for (let i = 0; i < NT; i++) for (let j = 0; j < NT; j++) { const x = T0[0] + i * 25, z = T0[1] + j * 25; let b = 0, bd = 1e18; Q.forEach((q, k) => { const d = (q.x - x) ** 2 + (q.z - z) ** 2; if (d < bd) { bd = d; b = k; } }); tab[i * NT + j] = b; }
    const quartier = (x, z) => { const i = (x - T0[0]) / 25 | 0, j = (z - T0[1]) / 25 | 0; return i < 0 || j < 0 || i >= NT || j >= NT ? -1 : tab[i * NT + j]; };
    Q.forEach((q, k) => {
      const ca = Math.cos(q.a), sa = Math.sin(q.a);
      for (const sens of [0, 1]) for (let u = -480, n = 0; u < 480; u += q.s * (0.7 + al() * 0.6), n++) {
        const grande = n % 5 === 2; // une rue sur cinq est une avenue, plus claire
        for (let v = -480; v < 480; v += grande ? 4 : 6) {
          const w = u + Math.sin(v / 70 + q.o) * 4, [a, b] = sens ? [w, v] : [v, w], x = q.x + a * ca - b * sa, z = q.z + a * sa + b * ca; // les rues ondulent un peu
          if (quartier(x, z) === k && sol(x, z) && al() < dens(x, z)) met(grande ? B : A, x, y0(x, z) + 1, z, grande ? 0xfff0d0 : blanc(0.15));
        }
      }
    });
    // le tapis des petits immeubles : fenêtres à toutes les hauteurs, plus hautes et plus serrées vers les centres
    for (let k = 0; k < 160000; k++) { const [x, z] = pol(al() * 360, Math.sqrt(800 ** 2 + al() * (2350 ** 2 - 800 ** 2))); const d = dens(x, z); if (sol(x, z) && al() < d) met(F, x, y0(x, z) + 3 + al() * al() * (10 + 70 * d * d), z, blanc(0.3), 0.45 + al() * 0.55); }
    // autoroutes urbaines surélevées : elles serpentent, lampadaires orangés des deux côtés, phares blancs et feux rouges
    for (let k = 0; k < 9; k++) {
      let [x, z] = pol(al() * 360, 1100 + al() * 1100), cap = al() * 6.283, vir = 0;
      for (let p = 0; p < 1600; p++) {
        vir = vir * 0.98 + (al() - 0.5) * 0.004; cap += vir; x += Math.cos(cap) * 3; z += Math.sin(cap) * 3;
        if (!sol(x, z)) { if (rC(x, z) < 800) cap += 0.05; continue; }
        const y = y0(x, z) + 16, nx = -Math.sin(cap), nz = Math.cos(cap);
        if (p % 4 === 0) for (const s of [-1, 1]) met(B, x + nx * 7 * s, y + 4, z + nz * 7 * s, 0xffa040, 0.9);
        if (al() < 0.45) met(B, x + nx * 2, y, z + nz * 2, 0xfff4e8); if (al() < 0.45) met(B, x - nx * 2, y, z - nz * 2, 0xff2a18);
      }
    }
    // voies ferrées : de longs traits presque droits, lumière verdâtre, et des gares très éclairées
    for (let k = 0; k < 7; k++) {
      let [x, z] = pol(al() * 360, 1100 + al() * 300), cap = Math.atan2(z - C[1], x - C[0]) + (al() - 0.5) * 1.2;
      for (let p = 0; p < 500; p++) {
        cap += (al() - 0.5) * 0.02; x += Math.cos(cap) * 4; z += Math.sin(cap) * 4;
        if (!sol(x, z)) continue;
        if (p % 3 === 0) met(B, x, y0(x, z) + 6, z, 0xc8ffe0, 0.6);
        if (p % 160 === 80) for (let i = 0; i < 60; i++) { const t = (al() - 0.5) * 120, e = (al() - 0.5) * 24; met(B, x + Math.cos(cap) * t - Math.sin(cap) * e, y0(x, z) + 4 + al() * 8, z + Math.sin(cap) * t + Math.cos(cap) * e, al() < 0.7 ? 0xffffff : 0xffe070); }
      }
    }
    // la baie : un quai éclairé, des bateaux, et un pont suspendu (deux pylônes, câbles en chaînette)
    for (let t = 0; t < 6.283; t += 0.003) { const x = baie[0] + Math.cos(t) * (BX + 6), z = baie[1] + Math.sin(t) * (BZ + 6); if (rC(x, z) > 800 && VU.every(([vx, vz]) => Math.hypot(x - vx, z - vz) < 2350)) met(B, x, y0(x, z) + 2, z, al() < 0.6 ? 0xffb860 : 0xffffff); }
    for (let k = 0; k < 18; k++) { const t = al() * 6.283, q = al() * 0.85; met(B, baie[0] + Math.cos(t) * BX * q, y0(...baie) + 1, baie[1] + Math.sin(t) * BZ * q, [0xffffff, 0xff4030, 0x40ff80][k % 3]); }
    { const P0 = [baie[0] + Math.cos(0.75) * BX, baie[1] + Math.sin(0.75) * BZ], P1 = [baie[0] + Math.cos(2.4) * BX, baie[1] + Math.sin(2.4) * BZ], yb = y0(...baie) + 25;
      const at = t => [P0[0] + (P1[0] - P0[0]) * t, P0[1] + (P1[1] - P0[1]) * t];
      for (let t = 0; t <= 1; t += 0.0025) { const [x, z] = at(t), c = t < 0.25 ? (0.25 - t) / 0.25 : t > 0.75 ? (t - 0.75) / 0.25 : Math.abs(t - 0.5) / 0.25;
        met(B, x, yb, z, 0xfff0d0, 0.9); if (t % 0.01 < 0.0025) met(B, x, yb + 4 + 80 * c * c, z, 0xe0f0ff, 0.9); } // tablier et câbles
      for (const t of [0.25, 0.75]) { const [x, z] = at(t); for (let e = 0; e < 90; e += 3) met(B, x, yb + e, z, 0xffffff, 0.8); R.push(x, yb + 92, z, 1, 1, 1); }
    }
    // tours : grappes serrées autour des centres, et quelques-unes partout ; silhouettes sombres (elles cachent la ville derrière), fenêtres, feu rouge
    const tours = [];
    const tour = (x, z, w, p, ht) => {
      const b = y0(x, z); tours.push([x, b + ht / 2, z, w, ht, p]);
      for (let e = 4; e < ht - 2; e += 6) for (const [fx, fz, lx, lz, L] of [[1, 0, 0, 1, p], [-1, 0, 0, 1, p], [0, 1, 1, 0, w], [0, -1, 1, 0, w]]) for (let c = -L / 2 + 3; c < L / 2 - 1; c += 5)
        if (al() < 0.2) met(F, x + fx * (w / 2 + 0.4) + lx * c, b + e, z + fz * (p / 2 + 0.4) + lz * c, blanc(0.25), 0.6 + al() * 0.4);
      if (ht > 90) R.push(x, b + ht + 1, z, 1, 1, 1);
    };
    for (const [cx, cz, f] of centres) for (let k = 0; k < 60 * f; k++) {
      const a = al() * 6.283, d = Math.sqrt(-2 * Math.log(1 - al() * 0.99)) * 110, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (sol(x, z)) tour(x, z, 20 + al() * 22, 20 + al() * 22, 40 + f * 220 * Math.exp(-d * d / 3e4) * (0.4 + al() * 0.6));
    }
    for (let k = 0; k < 320; k++) { const [x, z] = pol(al() * 360, 900 + al() * 1450); if (sol(x, z)) tour(x, z, 14 + al() * 16, 14 + al() * 16, 30 + al() * al() * 90); }
    for (let k = 0; k < 350; k++) { const [x, z] = pol(al() * 360, 900 + al() * 1450); if (sol(x, z) && al() < dens(x, z)) R.push(x, y0(x, z) + 25 + al() * 40, z, 1, 1, 1); } // les toits des immeubles moyens
    // la tour de télévision : un fût fin aux anneaux éclairés, deux observatoires ; la tour en treillis rouge, illuminée en orange
    { const [x, z] = pol(195, 1500), b = y0(x, z);
      for (let e = 0; e < 380; e += 3) { const r = 13 - e * 0.022; for (let i = 0; i < 10; i++) if (e % 24 === 0 || i % 5 === 0) met(B, x + Math.cos(i * 0.628) * r, b + e, z + Math.sin(i * 0.628) * r, 0xc8dcff, 0.8); }
      for (const [e, r] of [[225, 16], [290, 11]]) for (let i = 0; i < 36; i++) for (const de of [0, 3, 6]) met(B, x + Math.cos(i * 0.1745) * r, b + e + de, z + Math.sin(i * 0.1745) * r, 0xffffff, 1);
      R.push(x, b + 384, z, 1, 1, 1); }
    { const [x, z] = pol(165, 1420), b = y0(x, z), dm = e => 16 * (1 - e / 230) ** 1.6 + 1;
      for (let e = 0; e < 220; e += 2) for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) met(B, x + sx * dm(e), b + e, z + sz * dm(e), 0xff7020, 1);
      for (const e of [0, 55, 100, 150]) for (let t = -1; t <= 1; t += 0.08) for (const [sx, sz, ox, oz] of [[1, 0, 0, 1], [-1, 0, 0, 1], [0, 1, 1, 0], [0, -1, 1, 0]]) met(B, x + (sx + ox * t) * dm(e), b + e, z + (sz + oz * t) * dm(e), e === 100 ? 0xffffff : 0xff7020, 1);
      R.push(x, b + 223, z, 1, 1, 1); }
    const sil = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x04060a, fog: false }), Math.max(1, tours.length)), o = new THREE.Object3D();
    tours.forEach((t, i) => { o.position.set(t[0], t[1], t[2]); o.scale.set(t[3], t[4], t[5]); o.updateMatrix(); sil.setMatrixAt(i, o.matrix); }); sil.count = tours.length; sil.frustumCulled = false; h.scene.add(sil);
    const nuage = (L, size) => { // une passe de dessin : des points de taille fixe à l'écran, donc nets à toute distance. Élément : x, y, z, r, v, b
      const g = new THREE.BufferGeometry(), n = L.length / 6, P = new Float32Array(n * 3), K = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { P.set(L.slice(i * 6, i * 6 + 3), i * 3); K.set(L.slice(i * 6 + 3, i * 6 + 6), i * 3); }
      g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('color', new THREE.BufferAttribute(K, 3));
      const m = new THREE.PointsMaterial({ size, sizeAttenuation: false, fog: false, vertexColors: true }), pts = new THREE.Points(g, m); pts.frustumCulled = false; h.scene.add(pts); return m;
    };
    // la lueur du ciel au-dessus de la ville : un anneau de 2 300 m, du dégradé en lumière ajoutée, qui monte de l'horizon et s'éteint vers le haut
    // plus forte face aux quartiers denses : chaque sommet de l'anneau prend la densité de la ville dans sa direction
    const hg = new THREE.CylinderGeometry(2300, 2300, 420, 96, 1, true), hp = hg.attributes.position, hc = new Float32Array(hp.count * 3);
    for (let i = 0; i < hp.count; i++) { const a = Math.atan2(hp.getZ(i), hp.getX(i)); let d = 0; for (const r of [1300, 1700, 2100]) d += dens(C[0] + Math.cos(a) * r, C[1] + Math.sin(a) * r) / 3; const k = Math.max(0.15, (d - 0.45) * 1.8); hc.set([k, k, k], i * 3); }
    hg.setAttribute('color', new THREE.BufferAttribute(hc, 3));
    const halo = new THREE.Mesh(hg, h.mat('degrade', { lum: 1, fog: false, transparent: true, opacity: 0.6, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide }, '#b4643c', true));
    halo.position.set(C[0], 170, C[1]); halo.frustumCulled = false; h.scene.add(halo);
    // des hameaux dans les vallons du massif, entre la route et la plaine : quelques maisons éclairées, un lampadaire
    if (g) for (let k = 0; k < 24; k++) { const x0 = g.box[0] + al() * (g.box[2] - g.box[0]), z0 = g.box[1] + al() * (g.box[3] - g.box[1]); if (g.dAt(x0, z0) < 90) continue;
      for (let i = 0; i < 30; i++) { const x = x0 + (al() - 0.5) * 120, z = z0 + (al() - 0.5) * 120; if (g.dAt(x, z) > 70) met(A, x, g.hAt(x, z) + 1.5 + al() * 4, z, al() < 0.7 ? 0xffd090 : 0xe8f0ff, 0.5 + al() * 0.4); } }
    nuage(A, 1.5); nuage(B, 2); nuage(F, 1);
    return nuage(R, 2.5); // la couleur de la matière multiplie celle des points : le tick fait clignoter tous les feux rouges ensemble
  }

  window.DECORS = {
    // ---------- Ville à plein régime (carte d'origine) : tours éclairées sur la grille des rues, enseignes, mégatours, projecteurs, hologrammes, trafic volant ----------
    ville(h) {
      const { THREE, scene, S, W, rnd, geo, mat, tx, addMat, habille, box, concrete, lum, ribbon } = h, LUMI = { lum: 1 }, beacons = [];
      let signMats, beams, holos, MV, mvP, mvV, mvC, mvGeo, movers, beaconPts;
    { // sol : grille de rues éclairées vue d'en haut
      box(5000, 1, 5000, mat('rues', { lum: 1, rep: [70, 70] }), 0, -60.5, 200);
    }
    {
      const emi = (cols, p) => mat('fenetres', { emissive: 0xffffff, emissiveMap: tx('fenetresAllumees', cols, p) });
      const mats = [emi(['#ffd27a', '#ffe9b0'], 0.45), emi(['#7af0ff', '#d0f8ff'], 0.4), emi(['#ff5ad0', '#ffd27a', '#7af0ff'], 0.5), emi(['#ffd27a'], 0.12)];
      const signs = signMats = ['ネオン', 'スピード', '危険', 'ホテル', '電脳', 'BAR', 'NOODLE', '24H'].map((txt, i) => {
        const c = ['#ff003c', '#00f0ff', '#fcee0a', '#ff4fc8'][i % 4];
        return mat('enseigne', LUMI, c, txt);
      });
      const toits = [], machines = [], cuves = [], D = new THREE.Object3D(); // toits : dalle et acrotère, groupes froids, réservoirs d'eau (sans tirage de rnd : la ville ne bouge pas)
      const surLeToit = (m, w, d, y, k) => { const c = Math.cos(m.rotation.y), s = Math.sin(m.rotation.y), at = (ox, oz) => [m.position.x + c * ox + s * oz, m.position.z - s * ox + c * oz];
        toits.push([...at(0, 0), y + 0.6, m.rotation.y, w + 0.6, 1.2, d + 0.6]);
        if (k >= 0) { machines.push([...at(-0.4 * w, -0.38 * d), y + 1.6, m.rotation.y]); machines.push([...at(-0.4 * w, -0.38 * d + 4), y + 1.6, m.rotation.y]); if (k % 2) cuves.push([...at(0.4 * w, -0.4 * d), y + 3.4, 0]); } };
      for (let gx = -620; gx <= 820; gx += 64) for (let gz = -260; gz <= 780; gz += 64) {
        const x = gx + rnd() * 24 - 12, z = gz + rnd() * 24 - 12, w = 28 + rnd() * 22, d = 28 + rnd() * 22, top = 24 + rnd() * rnd() * 150;
        const lim = (W + 4 + 0.71 * Math.max(w, d)) ** 2;
        if (S.some((s, i) => i % 3 === 0 && (s.x - x) ** 2 + (s.z - z) ** 2 < lim)) continue;
        const ombre = S.some((s, i) => i % 3 === 0 && (s.x - x) ** 2 + (s.z - z) ** 2 < (Math.sqrt(lim) + 60) ** 2); // seules les tours à moins de 60 m de la route portent une ombre : toutes, elles coûtaient 1,4 ms par image à la passe d'ombre (banc ?perf)
        const H = top + 60, m = new THREE.Mesh(geo('immeuble', w, H, d), mats[rnd() * mats.length | 0]);
        m.position.set(x, top - H / 2, z); m.rotation.y = (rnd() - 0.5) * 0.6; m.castShadow = ombre; m.receiveShadow = true; scene.add(m);
        surLeToit(m, w, d, top, toits.length);
        if (rnd() < 0.55) { const h2 = 8 + rnd() * 45, tw = w * (0.4 + rnd() * 0.3), td = d * (0.4 + rnd() * 0.3), tm = box(tw, h2, td, m.material, 0, H / 2 + h2 / 2, 0, m); tm.castShadow = ombre; surLeToit(m, tw, td, top + h2, -1); } // étage en retrait
        if (rnd() < 0.45) { const ah = 10 + rnd() * 35; box(0.8, ah, 0.8, concrete, w * 0.35, H / 2 + ah / 2, d * 0.35, m); beacons.push(x + w * 0.35, top + ah + 1, z + d * 0.35); } // antenne et balise rouge
        for (let k = rnd() * 4 | 0; k > 0; k--) { // 0 à 3 enseignes de tailles variées, horizontales ou en drapeau vertical
          const sm = signs[rnd() * signs.length | 0], sd = rnd() < 0.5 ? -1 : 1, y = Math.max(6, Math.min(top - 5, 6 + rnd() * 45)) - m.position.y;
          const tall = rnd() < 0.35, sw = tall ? 5 : 10 + rnd() * 14, sh = tall ? 14 + rnd() * 10 : sw / 2, o = (rnd() - 0.5) * 0.5;
          if (rnd() < 0.5) box(0.5, sh, sw, sm, sd * (w / 2 + 0.3), y, o * d, m); else box(sw, sh, 0.5, sm, o * w, y, sd * (d / 2 + 0.3), m);
        }
      }
      for (const [l, g, mt] of [[toits, geo('bloc'), concrete], [machines, geo('clim'), mat('matGris')], [cuves, geo('reservoir'), mat('acier')]]) {
        const im = new THREE.InstancedMesh(habille(g, mt), mt, l.length);
        l.forEach(([x, z, y, ry, sx = 1, sy = 1, sz = 1], i) => { D.position.set(x, y, z); D.rotation.set(0, ry, 0); D.scale.set(sx, sy, sz); D.updateMatrix(); im.setMatrixAt(i, D.matrix); }); scene.add(im);
      }
    }
    // ---------- horizon et vie de la ville ----------
    { // mégatours lointaines, hors brouillard : silhouettes piquées de fenêtres sur le halo de l'horizon
      const far = mat('tourLoin', { lum: 1, fog: false }, '#0d0820', ['#ffd27a', '#7af0ff', '#ff5ad0'], 70);
      const im = new THREE.InstancedMesh(geo('bloc'), far, 44), D = new THREE.Object3D(); // une seule passe de dessin pour les 44
      for (let i = 0; i < 44; i++) { const a = i / 44 * 6.283 + rnd() * 0.1, rad = 1150 + rnd() * 500, h = 200 + rnd() * rnd() * 600, w = 60 + rnd() * 90; D.position.set(100 + Math.cos(a) * rad, h / 2 - 60, 250 + Math.sin(a) * rad); D.scale.set(w, h, w); D.updateMatrix(); im.setMatrixAt(i, D.matrix); }
      scene.add(im);
    }
    // faisceaux de projecteurs qui balaient le ciel
    const beamGeo = geo('faisceau');
    beams = [[320, 120], [-120, 330], [520, -120], [80, 660], [-420, 60], [700, 420]].map(([x, z], i) => { const b = new THREE.Mesh(beamGeo, addMat(tx('degrade', ['#5a7cff', '#ff2bd6', '#00f0ff'][i % 3], true), { opacity: 0.5 })); b.position.set(x, -60, z); scene.add(b); return b; });
    // hologrammes géants : les enseignes en lumière pure, qui tournent et grésillent
    holos = [[250, 150, 210], [-160, 165, 300], [450, 140, -90], [0, 185, 640], [640, 170, 520]].map(([x, y, z], i) => { const h = new THREE.Mesh(geo('hologramme'), addMat(signMats[i].map, { opacity: 0.6 })); h.position.set(x, y, z); scene.add(h); return h; });
    // trafic : véhicules volants entre les tours et phares dans les rues en contrebas (un point lumineux chacun)
    MV = 110; mvP = new Float32Array(MV * 3); mvV = new Float32Array(MV * 2); mvC = new Float32Array(MV * 3); mvGeo = new THREE.BufferGeometry();
    for (let i = 0; i < MV; i++) {
      const air = i < 45, ax = rnd() < 0.5, v = (air ? 35 + rnd() * 60 : 14 + rnd() * 22) * (rnd() < 0.5 ? -1 : 1), cell = 5000 / 70, snap = (p, o) => o + Math.round((p - o) / cell) * cell;
      let x = -700 + rnd() * 1600, z = -350 + rnd() * 1200;
      if (!air) { if (ax) z = snap(z, -2300); else x = snap(x, -2500); } // au sol : calé sur la grille des rues
      mvP.set([x, air ? 25 + rnd() * 150 : -59.5, z], i * 3); mvV.set(ax ? [v, 0] : [0, v], i * 2);
      mvC.set(air ? [[1, 1, 1], [1, 0.1, 0.2], [0.2, 0.9, 1]][i % 3] : [[1, 0.7, 0.3], [1, 1, 0.9]][i % 2], i * 3);
    }
    mvGeo.setAttribute('position', new THREE.BufferAttribute(mvP, 3)); mvGeo.setAttribute('color', new THREE.BufferAttribute(mvC, 3));
    movers = new THREE.Points(mvGeo, new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true, fog: false })); movers.frustumCulled = false; scene.add(movers);
    const beaconGeo = new THREE.BufferGeometry(); beaconGeo.setAttribute('position', new THREE.Float32BufferAttribute(beacons, 3));
    beaconPts = new THREE.Points(beaconGeo, new THREE.PointsMaterial({ color: 0xff2030, size: 2, sizeAttenuation: false, fog: false })); scene.add(beaconPts);
      // bouches d'égout au bord de la chaussée : une plaque sombre, d'où game.js fait monter un panache de vapeur teinté par le néon le plus proche (h.vapeur)
      const plaque = mat('peinture', { c: 0x0e0e12 });
      for (let i = 40; i < h.N; i += 140) { if (h.zone(i, 30) > 0) continue; const s = S[i], sd = (i / 140 | 0) & 1 ? 1 : -1, x = s.x - s.tz * sd * (W - 1.6), z = s.z + s.tx * sd * (W - 1.6); box(1.1, 0.05, 1.1, plaque, x, s.y + 0.03, z); h.vapeur(x, s.y + 0.1, z); }
      // ---------- repères du tour (sans tirage de rnd : le reste de la ville ne bouge pas) ----------
      const dyn = [], acier = mat('acier'), DS = THREE.DoubleSide;
      { // le marché de nuit (points 13 à 16) : une dalle de chaque côté de la voie rapide, des étals qui fument, la foule sous des parapluies transparents, des lanternes rouges en travers de la rue
        const i0 = pt(h, 13), i1 = pt(h, 16) - 10, n = i1 - i0, D0 = W + 1.6, D1 = W + 15;
        const dalle = mat('peinture', { c: 0x2a2630, side: DS });
        for (const sd of [-1, 1]) { ribbon(i0, n, sd * D0, -0.15, sd * D1, -0.15, dalle, 8); ribbon(i0, n, sd * D1, -0.15, sd * D1, 1.1, concrete); ribbon(i0, n, sd * D0, -0.15, sd * D0, -2.2, concrete); ribbon(i0, n, sd * D1, -0.15, sd * D1, -2.2, concrete); }
        let a = 77; const al = () => (a = a * 1664525 + 1013904223 >>> 0) / 4294967296; // hasard propre au marché
        const etals = [], gens = [], parap = [], lant = [], fils = [], mats = [], cols = [0xd02030, 0xf4f0e0, 0x109a8a, 0xffb020];
        for (let i = i0 + 3, k = 0; i < i1 - 2; i += 3, k++) for (const sd of [-1, 1]) { const s = S[i];
          if ((k + (sd > 0 ? 1 : 0)) % 4 === 3) continue; // des trous entre les étals
          const [x, z] = bord(s, sd, W + 10.5); etals.push([x, s.y - 0.15, z, Math.atan2(-sd * s.tz, sd * s.tx), 1, 1, 1, cols[(k * 3 + (sd > 0 ? 1 : 0)) % 4]]);
          if (k % 5 === 1) h.vapeur(x, s.y + 1.4, z); // la vapeur des réchauds, quelques-uns
        }
        for (let k = 0; k < 70; k++) { const s = S[i0 + 2 + (al() * (n - 4) | 0)], sd = al() < 0.5 ? -1 : 1, [x, z] = bord(s, sd, W + 3.5 + al() * 4.5), ht = 1.55 + al() * 0.3;
          gens.push([x, s.y - 0.15 + ht / 2, z, al() * 6, 1, ht / 1.7, 1]); if (al() < 0.55) parap.push([x, s.y + ht + 0.2, z, 0, 0.9 + al() * 0.3]); }
        inst(h, geo('boite', 0.5, 1.7, 0.35), mat('peinture', { c: 0x3a3448 }), gens);
        insts(h, 'etal', { comptoir: mat('planches', { c: 0x8a6a4a }), rechaud: mat('peinture', { lum: 1, c: 0xff7a20 }), perche: acier, toile: mat('peinture', { side: DS }), ampoules: mat('lanterne', LUMI) }, etals, { teinte: 'toile' });
        const gp = new THREE.ConeGeometry(0.9, 0.45, 10, 1, true); gp.translate(0, -0.22, 0); // parapluie : un cône ouvert, la pointe en haut
        inst(h, gp, new THREE.MeshBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.28, side: DS, depthWrite: false }), parap);
        inst(h, geo('boite', 0.04, 0.9, 0.04), acier, parap.map(p => [p[0], p[1] - 0.6, p[2]]));
        // les lanternes : un fil tous les 7 échantillons entre deux mâts, sept lanternes qui pendent avec la flèche du fil ; une ligne sur trois éclaire la rue
        for (let i = i0 + 2, k = 0; i < i1; i += 7, k++) { const s = S[i];
          for (const sd of [-1, 1]) { const [x, z] = bord(s, sd, W + 1.9); fils.push([x, s.y + 3.9 - 0.15, z, 0, 1, 1, 1]); }
          fils.push([s.x, s.y + 7.6, s.z, h.across(s), 2 * W + 3.8, 0.04, 0.04]);
          for (let j = 0; j < 7; j++) { const o = (j - 3) / 3 * (W - 1), [x, z] = bord(s, 1, o); lant.push([x, s.y + 7.6 - 0.9 * (1 - (o / W) ** 2) - 0.5, z, h.across(s)]); }
          if (k % 3 === 1) lum(i, s.x, s.y + 6.5, s.z, 0xff2a30, 18, 0.7); }
        inst(h, geo('boite', 0.2, 7.8, 0.2), acier, fils.filter(f => f[4] === 1));
        inst(h, geo('boite', 1, 1, 1), mat('matGris'), fils.filter(f => f[4] !== 1));
        inst(h, geo('lanterne'), mat('peinture', { lum: 1, c: 0xff2a30 }), lant);
        inst(h, geo('boite', 0.3, 0.12, 0.3), mat('peinture', { lum: 1, c: 0xffd05a }), lant.map(p => [p[0], p[1] - 0.46, p[2], p[3]])); // le gland doré sous chaque lanterne
        box(18, 3.2, 0.4, mat('ecrit', LUMI, 224, 40, '#2a0408', '#ffd05a', '夜市 MARCHE DE NUIT', 26), ...(s => [s.x, s.y + 9.2, s.z])(S[i0 + 2])).rotation.y = h.across(S[i0 + 2]); // l'enseigne d'entrée, posée sur le premier fil
      }
      { // le départ (points 0 à 2) : un portique à écran géant qui fait le compte à rebours, 50 m après la ligne, et une grappe de drones lumineux au-dessus de la ligne droite
        const iE = 22, sE = S[iE], gE = repere(h, sE);
        for (const sd of [-1, 1]) { box(1.2, 11, 1.2, acier, sd * (W + 1.6), 5.5, 0, gE); box(1.6, 0.4, 1.6, mat('neonJaune', LUMI), sd * (W + 1.6), 0.2, 0, gE); }
        box(2 * W + 4.4, 1.4, 1.4, acier, 0, 10.6, 0, gE); box(2 * W + 4.4, 0.2, 1.5, mat('neonCyan', LUMI), 0, 9.85, 0, gE);
        box(12.4, 5.4, 0.5, mat('matGris'), 0, 7.4, -0.1, gE); // dos de l'écran (Z local vers l'arrière : la face +Z regarde la grille)
        const ecrans = [['3', '#ff003c'], ['2', '#ff003c'], ['1', '#fcee0a'], ['GO', '#00f0ff'], ['00:00', '#00f0ff']].map(([t, c]) => mat('ecrit', LUMI, 64, 28, '#06060a', c, t, 24));
        const ecran = box(12, 5, 0.2, ecrans[0], 0, 7.4, 0.2, gE); ecran.userData.dyn = 1;
        lum(iE, sE.x, sE.y + 6, sE.z, 0xfcee0a, 22, 0.6);
        dyn.push(now => { const k = Math.floor(now / 1000) % 8; ecran.material = ecrans[Math.min(k, 4)]; }); // 3, 2, 1, GO, puis l'heure de la soirée (minuit) quatre secondes
        // les drones : 48 petites boîtes lumineuses en couronne qui tourne et ondule, une seule passe de dessin
        const sD = S[45], ND = 48, dr = new THREE.InstancedMesh(geo('boite', 1.6, 0.4, 1.6), mat('peinture', { lum: 1 }), ND), o3 = new THREE.Object3D(), dc = [0x00f0ff, 0xff2bd6, 0xfcee0a];
        for (let k = 0; k < ND; k++) dr.setColorAt(k, new THREE.Color(dc[k % 3])); dr.frustumCulled = false; scene.add(dr);
        dyn.push(now => { for (let k = 0; k < ND; k++) { const a = k / ND * 6.283 + now * 0.0003, r = 9 + 1.5 * Math.sin(now * 0.0009 + k * 0.7);
          o3.position.set(sD.x + Math.cos(a) * r, sD.y + 15 + 1.5 * Math.sin(a * 3 + now * 0.0012), sD.z + Math.sin(a) * r); o3.updateMatrix(); dr.setMatrixAt(k, o3.matrix); } dr.instanceMatrix.needsUpdate = true; });
      }
      h.beams.push(...beams); // game.js les tourne vers la caméra de chaque vue
      return (dt, now) => { // enseignes qui clignotent, grésillent ou défilent ; hologrammes, trafic, balises
        signMats.forEach((m, i) => { m.color.setScalar(i % 3 === 0 ? ((now / 400 + i) & 1 ? 1 : 0.25) : i % 3 === 1 && Math.random() < 0.04 ? 0.3 : 1); if (i % 2) m.map.offset.x += dt * 0.12; });
        holos.forEach((h, i) => { h.rotation.y += dt * 0.25; h.material.opacity = 0.45 + 0.2 * Math.sin(now * 0.004 + i) - (Math.random() < 0.05 ? 0.3 : 0); });
        for (let i = 0; i < MV; i++) {
          let x = mvP[i * 3] + mvV[i * 2] * dt, z = mvP[i * 3 + 2] + mvV[i * 2 + 1] * dt;
          mvP[i * 3] = x < -700 ? x + 1600 : x > 900 ? x - 1600 : x; mvP[i * 3 + 2] = z < -350 ? z + 1200 : z > 850 ? z - 1200 : z;
        }
        mvGeo.attributes.position.needsUpdate = true; beaconPts.visible = (now / 700 & 1) === 1; dyn.forEach(f => f(now)); // écran du départ, drones
      };
    },
    // ---------- Grand Vacarme : une arène couverte, comble. Sol de terre battue, gradins sur tout le pourtour, charpente et rampes de projecteurs, cube d'affichage au centre.
    // Au milieu, l'aire ouverte (M.place) : on y roule partout, entre la scène et la butte de sortie d'épingle on coupe sous l'arche de feu. Le jeu ne dessine ici aucun mur (th.murH = 0) :
    // c'est ce décor qui pose le sol des parties larges et les murs, là où la simulation en met (bord de chaussée hors de l'aire, bord de l'aire hors de la chaussée) ----------
    stade(h) {
      const { THREE, S, N, W, M } = h, net = m => { m.map.anisotropy = 8; return m; }, PL = M.place, [CX, CZ] = PL.c;
      const AD = { lum: 1, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide }; // lumière ajoutée : flammes, lasers, faisceaux
      const dansAire = (x, z, e = 0) => Math.hypot(x - CX, z - CZ) < PL.r + e, ouvert = s => s.w > W + 0.05 && !s.rc, au = (s, d, y = 0) => [s.x - s.tz * d, s.y + y, s.z + s.tx * d];
      const haut = s => s.rc ? s.rc - Math.sqrt(s.rc * s.rc - Math.min(s.w - s.pl, 0.98 * s.rc) ** 2) : 0; // hauteur du mur roulable à son sommet (sim.js : paroi)
      // le terrain suit la piste (tremplins = buttes, fosse = cratère) ; sous les parties larges et l'aire il s'efface : leur sol est posé plus bas
      const g = terrain(h, { pas: 8, marge: 150, mat: h.mat('terreBattue'), creux: (x, z) => { const s = S[near(h, x, z)]; return (ouvert(s) && Math.hypot(s.x - x, s.z - z) < s.w + 3) || dansAire(x, z, 3) ? 1.5 - Math.min(0, s.y) : 0; } });
      // une nappe de quadrilatères en une seule passe de dessin. tuile : texture plaquée en plan tous les `tuile` m ; sinon u en travers, v le long
      const nappe = (mat, tuile) => { const pos = [], uv = [], idx = []; return {
        quad(a, b, c, d, v0 = 0, v1 = 1) { const k = pos.length / 3; [a, b, c, d].forEach((p, j) => { pos.push(p[0], p[1], p[2]); if (tuile) uv.push(p[0] / tuile, p[2] / tuile); else uv.push(j & 1, j < 2 ? v0 : v1); }); idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); },
        fin() { const q = new THREE.BufferGeometry(); q.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); q.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); q.setIndex(idx); q.computeVertexNormals(); const m = new THREE.Mesh(q, mat); h.scene.add(m); return m; } }; };
      // le sol : de part et d'autre de la chaussée dans les parties larges, le disque de l'aire, et la butte de sortie d'épingle qui s'étend de la piste au mur de la scène
      const sol = nappe(h.mat('terreBattue', { side: THREE.DoubleSide }), 10), iB = pt(h, 16);
      for (let i = 0; i < N; i++) { const a = S[i], b = S[(i + 1) % N];
        if (ouvert(a) || ouvert(b)) for (const sd of [-1, 1]) sol.quad(au(a, sd * W), au(a, sd * a.w), au(b, sd * W), au(b, sd * b.w));
        if (i > iB - 16 && i <= iB) sol.quad(au(a, -W), au(a, CZ - a.z), au(b, -W), au(b, CZ - b.z)); }
      for (let k = 0; k < 48; k++) { const f = j => [CX + Math.cos(j * Math.PI / 24) * PL.r, -0.03, CZ + Math.sin(j * Math.PI / 24) * PL.r], c = [CX, -0.03, CZ]; sol.quad(c, f(k), c, f(k + 1)); }
      sol.fin();
      // les murs : la glissière du thème, au bord de la chaussée (au sommet des murs roulables) sauf dans l'aire et dans le vomitoire (ses parois sont celles du tunnel), et autour de l'aire là où elle déborde de la chaussée
      const mur = nappe(h.mat('glissiere', { side: THREE.DoubleSide }, h.TH.mur)), pan = (p, q, v) => mur.quad([p[0], p[1] + 1.2, p[2]], [p[0], p[1] - 0.6, p[2]], [q[0], q[1] + 1.2, q[2]], [q[0], q[1] - 0.6, q[2]], v, v + 0.25);
      for (let i = 0; i < N; i++) for (const sd of [-1, 1]) { if (h.zone(i, 0) === 1) continue; const a = S[i], b = S[(i + 1) % N], p = au(a, sd * a.w, haut(a)), q = au(b, sd * b.w, haut(b)); if (!dansAire(p[0], p[2], -0.4) || !dansAire(q[0], q[2], -0.4)) pan(p, q, i / 4); }
      for (let k = 0; k < 96; k++) { const f = j => [CX + Math.cos(j * Math.PI / 48) * PL.r, 0, CZ + Math.sin(j * Math.PI / 48) * PL.r], p = f(k), q = f(k + 1), x = (p[0] + q[0]) / 2, z = (p[2] + q[2]) / 2, s = S[near(h, x, z)];
        if (Math.hypot(s.x - x, s.z - z) > s.w - 0.4) pan(p, q, k / 4); }
      mur.fin();
      // le pourtour : deux longs côtés, deux angles arrondis à l'est, un demi-cercle à l'ouest qui épouse le grand virage relevé. Pièces [longueur, rayon, u => x, z, normale sortante]
      const X0 = -68, X1 = 308, Z0 = -34, Z1 = 354, RE = 90, RW = (Z1 - Z0) / 2, arc = (cx, cz, R, a0) => u => { const a = a0 + u / R; return [cx + Math.cos(a) * R, cz + Math.sin(a) * R, Math.cos(a), Math.sin(a)]; };
      const tour = [[X1 - X0, 0, u => [X0 + u, Z0, 0, -1]], [RE * Math.PI / 2, RE, arc(X1, Z0 + RE, RE, -Math.PI / 2)], [Z1 - Z0 - 2 * RE, 0, u => [X1 + RE, Z0 + RE + u, 1, 0]],
        [RE * Math.PI / 2, RE, arc(X1, Z1 - RE, RE, 0)], [X1 - X0, 0, u => [X1 - u, Z1, 0, 1]], [RW * Math.PI, RW, arc(X0, (Z0 + Z1) / 2, RW, Math.PI / 2)]];
      // un module de gradin tous les 14 m ; dans les arcs il s'élargit pour refermer l'éventail jusqu'au mur du fond
      const grad = [];
      for (const [len, R, f] of tour) { const n = Math.round(len / 14), pas = len / n;
        for (let k = 0; k < n; k++) { const [x, z, nx, nz] = f((k + 0.5) * pas); grad.push([x, Math.min(g.hAt(x, z), 0) - 0.6, z, Math.atan2(nx, nz), pas / 14 * (R ? (R + 54) / R : 1) + 0.02, 1, 1]); } }
      const acier = h.mat('acier'), beton = h.mat('beton'), lampe = h.mat('lampe', LUM);
      const foule = net(h.mat('foule', {}, '#3a3448', '#e8362a')), foule2 = net(h.mat('foule', {}, '#2e2a3c', '#ffc21a'));
      insts(h, 'gradinArene', { beton, banderole: h.mat('banderoleStade', LUM, 0), banderole2: h.mat('banderoleStade', LUM, 2), foule, foule2, escalier: h.mat('marches'), loge: h.mat('loges', LUM), acier, lampe }, grad);
      // le toit : une sous-face semée de lampes, et une ferme tous les 70 m d'un long côté à l'autre, avec ses rampes de projecteurs
      const HT = 63, cx = (X0 - RW + X1 + RE) / 2, cz = (Z0 + Z1) / 2;
      const toit = h.mat('toitArene', LUM); boite(h, toit, X1 + RE - X0 + RW + 120, 1, Z1 - Z0 + 120, cx, HT + 0.5, cz);
      const peauF = { acier, lampe, treillis: h.mat('treillisPortique', { alphaTest: 0.5, side: THREE.DoubleSide, rep: [(Z1 - Z0) / 6.2, 1] }, '#3a3e4a') };
      for (let x = -230; x <= 380; x += 70) h.pose('fermeToit', peauF, h.scene, [x, HT - 4.5, cz], Z1 - Z0 + 100);
      // le cube d'affichage au-dessus de l'aire, et un écran géant à chaque bout de la salle (deux images qui alternent)
      h.pose('cubeScore', { ecran: h.mat('tableauStade', LUM), acier, bande: h.mat('peinture', { lum: 1, c: 0xffc21a }) }, h.scene, [CX, HT - 30, CZ]);
      const ecranG = h.mat('ecranGeant', LUM); ecranG.map.repeat.set(1, 0.5);
      for (const x of [X1 + RE + 34, X0 - RW - 34]) boite(h, ecranG, 1, 18, 84, x, 50, cz);
      // la scène (elle ferme l'est de l'aire), le mur de la butte et l'arche de feu entre les deux : ce sont les piles de M.place
      const chev = h.mat('banderoleSaut', { lum: 1, rep: [4, 1] });
      h.pose('sceneArene', { beton, ecran: h.mat('banderoleStade', LUM, 4), bande: h.mat('peinture', { lum: 1, c: 0xffc21a }), chevrons: h.mat('banderoleSaut', { lum: 1, rep: [6, 1] }), acier,
        enseigne: h.mat('ecrit', LUM, 192, 16, '#16161c', '#ff8a1a', 'ARCHE DE FEU', 12) }, h.scene, [CX, 0, CZ]);
      // portiques des tremplins, 30 m avant le bout, et les 8 derniers mètres peints de chevrons (même signal sur toutes les cartes à relief)
      const peau = { acier, banderole: h.mat('banderoleSaut', { lum: 1, side: THREE.DoubleSide }) };
      for (const [p] of M.sauts) { const i = pt(h, p), sp = S[(i - 15 + N) % N]; h.pose('portiqueSaut', peau, repere(h, sp), [0, 0, 0], sp.w); h.ribbon((i - 4 + N) % N, 4, -W + 0.6, 0.05, W - 0.6, 0.05, chev, 3.5); }
      // les flammes : deux lance-flammes au bout de chaque tremplin (leur lueur éclaire la butte), une rangée sur l'arche et une sur la scène. [x, y, z, rotation, largeur, hauteur]
      const feux = [];
      for (const [p] of M.sauts) { const i = pt(h, p), s = S[i]; h.lum(i, s.x, s.y + 4, s.z, 0xff7a20, 30, 0.45); for (const sd of [-1, 1]) feux.push([...au(s, sd * (s.w - 0.8)), h.across(s), 2.4, 6]); }
      for (let k = 0; k < 6; k++) feux.push([CX - 20 + k * 5.4, 12, CZ, 0, 2, 4.5]);
      for (let k = 0; k < 5; k++) feux.push([CX + 14 + k * 10, 4.5, CZ, 0, 2.4, 5]);
      const gf = new THREE.PlaneGeometry(1, 1); gf.translate(0, 0.5, 0);
      const mf = new THREE.InstancedMesh(gf, h.mat('flamme', AD), feux.length), o3 = new THREE.Object3D(); mf.frustumCulled = false; h.scene.add(mf);
      // deux éventails de lasers sous le cube, quatre faisceaux de poursuite qui balaient la piste, et les flashs des appareils photo dans les gradins
      const lasers = [0x30ff70, 0xff30c0].map(c => h.pose('eventailLaser', { rayon: h.mat('peinture', { ...AD, c }) }, h.scene, [CX, HT - 38, CZ])[0]);
      const gc = new THREE.ConeGeometry(9, 56, 10, 1, true); gc.translate(0, -28, 0); const mc = h.mat('faisceau', AD);
      const cones = [[-60, 60], [80, 250], [220, 70], [330, 240]].map(([x, z]) => { const m = new THREE.Mesh(gc, mc); m.position.set(x, HT - 6, z); h.scene.add(m); return m; });
      const fl = []; for (let k = 0; k < 900; k++) { const p = grad[(h.rnd() * grad.length) | 0], t = h.rnd(), lx = (h.rnd() - 0.5) * 13 * p[4], lz = 2 + 26 * t, c = Math.cos(p[3]), s = Math.sin(p[3]); fl.push(p[0] + lx * c + lz * s, p[1] + 5.5 + 15 * t, p[2] - lx * s + lz * c); }
      const gfl = new THREE.BufferGeometry(); gfl.setAttribute('position', new THREE.Float32BufferAttribute(fl, 3));
      const flashs = new THREE.Points(gfl, new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); flashs.frustumCulled = false; h.scene.add(flashs);
      // panneaux des annonceurs derrière les murs, et les projecteurs qui éclairent la piste : blancs, pour que la terre garde sa couleur
      const pubs = [['VOLT COLA', '#e8362a', '#f4f0e0'], ['KOP 170', '#16161c', '#ffc21a'], ['TONNERRE', '#f4f0e0', '#1c3fa8'], ['BRASERO', '#ffc21a', '#16161c']].map(([t, a, b]) => h.mat('ecrit', LUM, 64, 32, a, b, t, 11));
      [[9, -1], [13, 1], [16, 1], [22, 1], [24, -1], [1, 1]].forEach(([p, sd], k) => { const s = S[pt(h, p)]; h.pose('panneauPub', { mat: h.mat('fer'), affiche: pubs[k % pubs.length] }, repere(h, s), [sd * (s.w + 7), 0, 0], sd * 0.5); });
      for (let i = 0; i < N; i += 45) h.lum(i, S[i].x, S[i].y + 20, S[i].z, 0xeef2ff, 55, 0.22);
      const rnd = h.rnd, ext = s => s.k > 0 ? -1 : 1, wrap = a => Math.atan2(Math.sin(a), Math.cos(a)); // ext : côté extérieur d'un virage (sim.js : k > 0 = à droite)
      // le vomitoire (M.tun) : la tribune ouest enjambe le tunnel, un module tous les 14 m posé sur sa coque, façade au-dessus du bord intérieur, le dos vers le pourtour
      { const T = h.T, vom = [];
        for (let i = T.t0 + 3; i < T.t1 - 3; i += 7) { const s = S[i % N], sd = (s.x - cx) * -s.tz + (s.z - cz) * s.tx > 0 ? 1 : -1, [x, z] = bord(s, -sd, W + 1.5);
          vom.push([x, s.y + 10, z, Math.atan2(-s.tz * sd, s.tx * sd)]); }
        insts(h, 'tribuneVomitoire', { beton, banderole: h.mat('banderoleStade', LUM, 3), foule }, vom); }
      const peauV = { caisse: h.mat('peinture', { c: 0xffffff }), vitre: h.mat('vitreSombre'), feuRouge: h.mat('feuRouge'), feuBlanc: h.mat('matGris'), chassis: h.mat('matGris'), roue: h.mat('roue'), pneu: h.mat('pneu') };
      const rouilles = [0x8a4a2a, 0x5a6a7a, 0xa89a50, 0x6a2a2a, 0x3a5a3a, 0x9a9a9a];
      // premier demi-tour (points 4 à 8) : en haut de la paroi extérieure, une banquette de béton chargée d'un mur de pneus qui dépasse la glissière de 1,6 m, et sur les pneus, les carcasses écrasées des soirées précédentes
      { const i0 = pt(h, 4), n = (pt(h, 8) - i0 + N) % N, sd = ext(S[pt(h, 6)]), pn = [], carc = [];
        h.ribbon(i0, n, s => sd * s.w, haut, s => sd * (s.w + 2.6), haut, beton, 8); h.ribbon(i0, n, s => sd * (s.w + 2.6), haut, s => sd * (s.w + 2.6), -2, beton, 8);
        for (let k = 0; k < n; k++) { const s = S[(i0 + k) % N], y = s.y + haut(s);
          for (const r of [0.6, 1.6]) for (const l of [-0.5, 0.5]) { const [x, z] = bord(s, sd, s.w + r), nb = r > 1 && k % 5 === 2 ? 6 : 9; for (let e = 0; e < nb; e++) pn.push([x + s.tx * l, y + 0.15 + e * 0.31, z + s.tz * l, rnd() * 3]); }
          if (k % 14 === 7) { const [x, z] = bord(s, sd, s.w + 1.1); carc.push([x, y + 3, z, h.across(s) + Math.PI / 2 + (rnd() - 0.5) * 0.4, 1, 0.38, 1, rouilles[carc.length % rouilles.length]]); } }
        inst(h, new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10), h.mat('pneu'), pn); insts(h, 'voitureGaree', peauV, carc, { teinte: 'caisse' }); }
      // second demi-tour (points 17 à 21) : les banderoles des supporters pendent du toit au-dessus de l'extérieur du virage, chacune à son câble, et se balancent
      const bans = []; { const i0 = pt(h, 17), n = (pt(h, 21) - i0 + N) % N, sd = ext(S[pt(h, 19)]);
        for (let k = 0; k < 6; k++) { const s = S[(i0 + Math.round((k + 0.5) * n / 6)) % N], [x, z] = bord(s, sd, s.w + 6 + (k % 2) * 6), y = 30 + (k % 3) * 3;
          const m = boite(h, h.mat('banderoleSupporter', { lum: 1, c: 0xd0d0d0 }, k), 0.12, 16, 6, x, y, z); m.rotation.y = h.across(s); bans.push(m);
          boite(h, acier, 0.1, HT - y - 8, 0.1, x, (HT + y + 8) / 2, z); } }
      // la fosse (le tremplin qui a une fosse) : boue au fond et sur ses bords, voitures broyées derrière ses glissières, monster truck garé au bord du côté de l'aire
      { const [p, , , F] = M.sauts.find(s => s[3]), i0 = pt(h, p), nf = Math.round(F / 2), boue = h.mat('boue', { gloss: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), br = [];
        h.ribbon((i0 + 1) % N, nf - 1, s => -s.w - 4, 0.04, s => s.w + 4, 0.04, boue, 6);
        for (let k = 0; k < 8; k++) { const s = S[(i0 + 2 + Math.round(k * (nf - 6) / 7)) % N], sd = k & 1 ? 1 : -1, [x, z] = bord(s, sd, s.w + 1.6 + (k % 3) * 0.6); br.push([x, s.y + 0.05 + (k % 4 === 0 ? 0.5 : 0), z, h.across(s) + Math.PI / 2 + (rnd() - 0.5) * 0.8, 1, 0.32, 1.05, rouilles[k % rouilles.length]]); }
        insts(h, 'voitureGaree', peauV, br, { teinte: 'caisse' });
        const s = S[i0], sd = Math.hypot(...bord(s, 1, 1).map((v, j) => v - [CX, CZ][j])) < Math.hypot(...bord(s, -1, 1).map((v, j) => v - [CX, CZ][j])) ? 1 : -1, [x, z] = bord(s, sd, s.w + 9);
        const mt = new THREE.Group(); mt.position.set(x, g.hAt(x, z), z); mt.rotation.y = h.across(s) + Math.PI / 2 + 0.5; h.scene.add(mt);
        h.pose('monsterTruck', { caisse: h.mat('peinture', { c: 0x2ab84a }), flammes: h.mat('peinture', { c: 0xff8a1a }), vitre: h.mat('vitreSombre'), chassis: h.mat('matGris'), acier, pneu: h.mat('pneu'), lampe }, mt); }
      // étincelles : à chaque décollage, une gerbe tombe de la charpente au-dessus de la voiture suivie (une seule gerbe à la fois)
      const NE = 160, pe = new Float32Array(NE * 3), ve = new Float32Array(NE * 3), ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.BufferAttribute(pe, 3));
      const me = new THREE.PointsMaterial({ color: 0xffb040, size: 0.7, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }), etin = new THREE.Points(ge, me); etin.frustumCulled = false; etin.visible = false; h.scene.add(etin);
      // la ola : une copie bras levés de la foule de l'anneau bas, levée sur les gradins proches de la voiture suivie et cachée sous le sol ailleurs ; elle court avec elle autour de la salle
      // shortcut: elle suit la voiture que le décor reçoit (celle du joueur), pas la tête de course ; il faudrait que game.js passe la voiture de tête au décor
      const A1 = Math.atan2(15, 26), go = h.geo('boite', 14, 0.6, 30); go.rotateX(-A1); go.translate(0, 12.7, 15);
      const fo = net(h.mat('foule', {}, '#4a4458', '#f4f0e0')); fo.map.offset.y = 0.5;
      const ola = inst(h, go, fo, grad), ag = grad.map(p => Math.atan2(p[2] - cz, p[0] - cx)), o4 = new THREE.Object3D(), BAS = new THREE.Vector3(0, -1, 0), vise = new THREE.Vector3();
      // confettis de l'arrivée : ils tombent en tournoyant au-dessus de la ligne, repartent du toit tant que le tableau d'arrivée est là
      const NC = 700, pc = new Float32Array(NC * 3), cc = new Float32Array(NC * 3), gc2 = new THREE.BufferGeometry(), teintes = [[1, 0.76, 0.1], [0.91, 0.21, 0.16], [0.11, 0.25, 0.66], [0.96, 0.94, 0.88]];
      for (let k = 0; k < NC; k++) { const c = teintes[k % 4]; cc.set(c, k * 3); pc[k * 3 + 1] = -99; }
      gc2.setAttribute('position', new THREE.BufferAttribute(pc, 3)); gc2.setAttribute('color', new THREE.BufferAttribute(cc, 3));
      const conf = new THREE.Points(gc2, new THREE.PointsMaterial({ size: 0.45, vertexColors: true, fog: false })); conf.frustumCulled = false; conf.visible = false; h.scene.add(conf);
      const cone0 = cones.map(m => m.position.clone());
      let tE = 9, parti = false, vol = 0, rejoue = 0, eteint = 0, fete = false;
      return (dt, now, car) => {
        if (car) {
          // décollage franc (pas une bosse) : la gerbe part ; réception d'un vrai saut : l'écran le rejoue
          if (car.air && car.airT > 0.2 && !parti) { parti = true; tE = 0;
            for (let k = 0; k < NE; k++) { pe[k * 3] = car.x + car.vx * 0.8 + (Math.random() - 0.5) * 14; pe[k * 3 + 1] = HT - 8 - Math.random() * 3; pe[k * 3 + 2] = car.z + car.vz * 0.8 + (Math.random() - 0.5) * 14;
              ve[k * 3] = (Math.random() - 0.5) * 3; ve[k * 3 + 1] = -Math.random() * 4; ve[k * 3 + 2] = (Math.random() - 0.5) * 3; } }
          if (car.air) vol = Math.max(vol, car.airT); else { if (vol > 0.6) rejoue = now + 4000; vol = 0; parti = false; }
          const ac = Math.atan2(car.z - cz, car.x - cx);
          grad.forEach((p, k) => { const e = Math.max(0, 1 - Math.abs(wrap(ag[k] - ac + 0.12)) / 0.22); o4.position.set(p[0], p[1] + (e ? e * 1.6 - 1 : -60), p[2]); o4.rotation.set(0, p[3], 0); o4.scale.set(p[4], 1, 1); o4.updateMatrix(); ola.setMatrixAt(k, o4.matrix); });
          ola.instanceMatrix.needsUpdate = true;
        }
        if (tE < 4) { tE += dt; for (let k = 0; k < NE * 3; k++) { if (k % 3 === 1) ve[k] -= 9.81 * dt; pe[k] += ve[k] * dt; } ge.attributes.position.needsUpdate = true; me.opacity = Math.max(0, 1 - tE / 4); }
        etin.visible = tE < 4;
        // dernier tour : la salle s'éteint, les quatre poursuites viennent se braquer sur la voiture ; arrivée : confettis
        // shortcut: dernier tour = car.lap === 3 (session.js : toute course contre l'IA fait 3 tours) ; à revoir si le nombre de tours devient réglable
        const der = !!(car && car.lap === 3), arrive = der && car.dist >= 3 * N;
        eteint += ((der && !arrive ? 1 : 0) - eteint) * Math.min(1, dt * 1.5);
        toit.color.setScalar(1 - 0.8 * eteint); lampe.color.setScalar(1 - 0.85 * eteint); mc.color.setScalar(1 + 2 * eteint);
        // la foule bouge : chaque anneau passe par moments à sa variante bras levés
        foule.map.offset.y = Math.sin(now * 0.0023) + Math.sin(now * 0.0061) > 0.6 ? 0.5 : 0;
        foule2.map.offset.y = Math.sin(now * 0.0019 + 2) + Math.sin(now * 0.0047) > 0.5 ? 0.5 : 0;
        ecranG.map.offset.y = now < rejoue ? Math.floor(now / 200) % 2 * 0.5 : Math.floor(now / 2500) % 2 * 0.5; // après un saut, « QUEL SAUT ! » clignote
        // les flammes tremblent, et chaque lance-flammes crache un grand coup toutes les 3 s, à son tour
        feux.forEach(([x, y, z, r, w, ht], k) => { const coup = (now * 0.001 + k * 0.37) % 3.2 < 0.45 ? 1.9 : 1, f = 0.75 + 0.25 * Math.sin(now * 0.021 + k * 1.7) * Math.sin(now * 0.013 + k);
          o3.position.set(x, y, z); o3.rotation.set(0, r, 0); o3.scale.set(w * (0.85 + 0.15 * f), ht * f * coup, 1); o3.updateMatrix(); mf.setMatrixAt(k, o3.matrix); });
        mf.instanceMatrix.needsUpdate = true;
        lasers.forEach((m, k) => m.rotation.set(Math.sin(now * 0.0007 + k * 2) * 0.5, now * 0.0004 * (k ? -1 : 1) + k * 1.57, 0));
        cones.forEach((m, k) => { if (eteint > 0.5 && car) { const a = k * 1.571 + now * 0.0002; m.position.set(car.x + Math.cos(a) * 30, HT - 6, car.z + Math.sin(a) * 30); m.scale.set(0.5, 1.25, 0.5);
            m.quaternion.setFromUnitVectors(BAS, vise.set(car.x - m.position.x, car.y - m.position.y, car.z - m.position.z).normalize()); }
          else { m.position.copy(cone0[k]); m.scale.set(1, 1, 1); m.rotation.set(Math.sin(now * 0.0006 + k) * 0.45, 0, Math.cos(now * 0.0008 + k * 2) * 0.45); } });
        if (arrive && !fete) { const s = S[0]; for (let k = 0; k < NC; k++) { pc[k * 3] = s.x + (Math.random() - 0.5) * 70; pc[k * 3 + 1] = 15 + Math.random() * (HT - 20); pc[k * 3 + 2] = s.z + (Math.random() - 0.5) * 40; } }
        fete = arrive; conf.visible = fete;
        if (fete) { for (let k = 0; k < NC; k++) { const j = k * 3; pc[j] += Math.sin(now * 0.003 + k) * 1.5 * dt; pc[j + 1] -= (2 + k % 3) * dt; pc[j + 2] += Math.cos(now * 0.0027 + k * 1.3) * 1.5 * dt; if (pc[j + 1] < 0) pc[j + 1] = HT - 8; } gc2.attributes.position.needsUpdate = true; }
        gfl.setDrawRange(Math.floor(now / 70) * 7919 % 860, 40);
      };
    },
    // ---------- Nuit Blanche : un col fermé pour l'hiver, à l'aube. Pentes de neige, sapins chargés, falaise givrée, pont sur la gorge, refuge éclairé au col ; la glace vive se voit sur la route ----------
    givre(h) {
      const { THREE, S, N, W, T, rnd } = h, neige = h.mat('neigeVierge'), beton = h.mat('beton');
      const ecart = (x, z, d) => d - S[near(h, x, z)].w + W; // distance à l'axe ramenée à une route de demi-largeur W (la route s'élargit au hameau, sur le champ de neige et au col : M.large)
      // la gorge : une entaille que la route franchit par un pont, entre les points 22 et 23 ; elle s'ouvre vers l'aval
      const xG = (S[pt(h, 22)].x + S[pt(h, 23)].x) / 2, gorge = (x, z) => 30 * Math.max(0, 1 - ((x - xG) / 50) ** 2) * Math.min(1, Math.max(0, (z - 330) / 70));
      const g = terrain(h, { pas: 8, marge: 420, loin: 80, chute: -0.25, creux: gorge, mat: neige });
      const iG = S.findIndex(s => gorge(s.x, s.z) > 1), nG = S.filter(s => gorge(s.x, s.z) > 1).length;
      h.ribbon(iG, nG, s => -s.w, -2, s => s.w, -2, beton, 8); // le tablier (ses flancs sont les murets de la route), sur deux piles
      inst(h, h.geo('pileViaduc'), beton, [1, 2].map(k => { const s = S[iG + Math.round(nG * k / 3)], y0 = g.hAt(s.x, s.z) - 2; return [s.x, (s.y - 2 + y0) / 2, s.z, h.across(s), 1, s.y - 2 - y0, 0.5]; }));
      // la glace : partout où la route en est (T.surf, la table de la physique), une plaque sombre et luisante posée sur la neige tassée, les deux bouts en langues.
      // Seuil 0,33 (la neige est à 0,3) : le lac gelé, moins glissant que la glace vive pour que la glisse y paie (force 0,2 dans cartes.js), se voit aussi
      const opt = { alphaTest: 0.1, gloss: 0.25, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, vive = i => T.surf[(i + N) % N].vir > 0.33, plaques = [];
      const grp = (x, y, z, ry, k = 1) => { const o = new THREE.Group(); o.position.set(x, y, z); o.rotation.y = ry; o.scale.setScalar(k); h.scene.add(o); return o; }; // un objet posé et tourné (X local = rotation ry)
      const plaque = h.mat('glaceVive', opt, 0), debut = h.mat('glaceVive', opt, 1), fin = h.mat('glaceVive', { ...opt, rep: [1, -1] }, 1), B = 5; // B échantillons (10 m) par bout
      for (let i = 0; i < N; i++) if (vive(i) && !vive(i - 1)) { let n = 1; while (vive(i + n)) n++;
        const pose = (i0, cnt, m, v) => h.ribbon((i0 + N) % N, cnt, s => -s.w + 0.3, 0.03, s => s.w - 0.3, 0.03, m, v);
        pose(i, B, debut, 2 * B); pose(i + B, n - 2 * B, plaque, 32); pose(i + n - B, B, fin, 2 * B); plaques.push(i); }
      // chaque plaque s'annonce à 150 m (75 échantillons) puis à 40 m (20, rappel à la sortie des lacets, où le premier est caché par le virage) : un panneau VERGLAS de chaque côté, feu bleu allumé ; une lueur froide au-dessus de son entrée fait luire la glace de loin
      // (les plaques à la sortie des lacets, 13-14 et 18-19, ne se voyaient qu'une fois dessus) ; sur la plaque, les bagues des jalons passent au bleu (plus bas)
      const peauV = { poteau: h.mat('acier'), plaque: h.mat('ecrit', { lum: 1 }, 128, 48, '#f4f8ff', '#c81e1e', '▲ VERGLAS', 24), feu: h.mat('peinture', { lum: 1, c: 0x40a0ff }) };
      insts(h, 'panneauVerglas', peauV, plaques.flatMap(i => [75, 20].map(d => S[(i - d + N) % N])).flatMap(s => [-1, 1].map(sd => { const [x, z] = bord(s, sd, s.w + 1.8); return [x, s.y, z, Math.atan2(s.tz, -s.tx)]; })));
      for (const i of plaques) { const e = S[(i + 8) % N]; h.lum((i + 8) % N, e.x, e.y + 7, e.z, 0x9fd0ff, 32, 0.9); }
      const iN = (pt(h, 23) + 20) % N; // le dégagement du chasse-neige, dans la descente nue
      // congères : la neige repoussée par le chasse-neige fait un mur clair de chaque côté, plus haut que la glissière (le bord de la route se lit de loin) ; rien sur le pont
      h.ribbon((iG + nG) % N, N - nG, s => -(s.w + 3.5), 2.4, s => -(s.w + 0.1), 1.2, neige, 10); { const a0 = (iG + nG) % N, l1 = (iN - 12 - a0 + N) % N; for (const [i0, l] of [[a0, l1], [iN + 12, N - nG - l1 - 24]]) h.ribbon(i0 % N, l, s => s.w + 0.1, 1.2, s => s.w + 3.5, 2.4, neige, 10); } // à droite, ouverte devant le chasse-neige garé
      // la falaise du départ, côté montagne : elle garde la route à l'ombre du point 2 au point 3 ; une marche de roche givrée, la neige reprend au-dessus
      { const i0 = pt(h, 2), n = (pt(h, 3) - i0 + N) % N, m = S[(i0 + (n >> 1)) % N], ht = s => 3 + 17 * Math.max(0, 1 - (Math.hypot(s.x - m.x, s.z - m.z) / (n + 30)) ** 2);
        h.ribbon((i0 - 20 + N) % N, n + 40, s => s.w + 3, -1, s => s.w + 8, ht, h.mat('rocGivre', { side: THREE.DoubleSide }), 16); h.ribbon((i0 - 20 + N) % N, n + 40, s => s.w + 8, ht, s => s.w + 60, s => ht(s) + 10, neige, 10);
        // la coulée de poudreuse : une langue de neige descendue de la corniche, plaquée sur la roche (t = part de la pente du pied au sommet, 0,25 m devant elle), plus haute au milieu,
        // et son cône d'avalanche au pied, des tas de neige qui débordent sur la congère sans mordre la route
        const c0 = (i0 + (n >> 1) - 14 + N) % N, face = (s, t) => s.w + 3 + 5 * t - 0.25, fy = (s, t) => -1 + (ht(s) + 1) * t + 0.1, cloche = s => { const k = ((S.indexOf(s) - c0 + N) % N - 14) / 14; return 0.2 + 0.78 * Math.max(0, 1 - k * k); };
        h.ribbon(c0, 28, s => face(s, 0.2), s => fy(s, 0.2), s => face(s, cloche(s)), s => fy(s, cloche(s)), h.mat('neigeVierge', { side: THREE.DoubleSide, c: 0xffffff }), 12);
        inst(h, h.geo('pic'), neige, Array.from({ length: 8 }, (_, k) => { const s = S[(c0 + 2 + k * 3) % N], l = 4 + rnd() * 3, [x, z] = bord(s, 1, s.w + 0.4 + 0.7 * l); return [x, s.y - 0.3, z, rnd() * 1.5, l, 3.5 + rnd() * 2, l * 1.3]; })); }
      // sapins : le bois du retour (à l'ouest) serre la route et la tient à l'ombre ; ailleurs des bouquets épars, plus rien au-dessus de 100 m ni dans la gorge
      const arbres = [], bois = x => x < -90, iB = pt(h, 24), nB = (pt(h, 28) - iB + N) % N;
      for (let k = 0; k < nB; k += 3) for (const sd of [-1, 1]) { const s = S[(iB + k) % N], [x, z] = bord(s, sd, s.w + 5 + rnd() * 8); if (bois(x) && ecart(x, z, g.dAt(x, z)) > W + 4) arbres.push([x, g.hAt(x, z) + 6, z, rnd() * 6, 0.8 + rnd() * 0.7]); }
      for (let k = 0; k < 2200; k++) { const x = g.box[0] + rnd() * (g.box[2] - g.box[0]), z = g.box[1] + rnd() * (g.box[3] - g.box[1]), d = g.dAt(x, z), y = g.hAt(x, z);
        if (d > 12 && d < 260 && y - 0.25 * Math.max(0, d - 80) < 100 && !gorge(x, z) && (bois(x) ? rnd() < 0.9 : Math.sin(x * 0.02) + Math.cos(z * 0.027) + rnd() > 0.85) && ecart(x, z, d) > 12) arbres.push([x, y + 6, z, rnd() * 6, 0.7 + rnd() * 0.8]); }
      const futs = arbres.map(p => { const y0 = p[1] - 6; p[1] = y0 + 10 * p[4]; return [p[0], y0 + 2.4 * p[4], p[2], 0, p[4]]; });
      inst(h, h.geo('cedre'), h.mat('sapinNeige'), arbres); inst(h, h.geo('tronc'), h.mat('tronc'), futs);
      // jalons à neige au ras des congères, tous les 24 m, tous les 12 m en virage : le seul balisage du col, leur bague s'allume dans les phares
      // sur la glace, tous les 12 m et la bague bleue : la plaque se lit de loin comme un couloir de feux bleus
      const jalons = [], jalonsG = []; for (let i = 0; i < N; i += vive(i) || Math.abs(S[i].k) > 0.008 ? 6 : 12) for (const sd of [-1, 1]) { const [x, z] = bord(S[i], sd, S[i].w + 0.5); (vive(i) ? jalonsG : jalons).push([x, S[i].y, z]); }
      // la chouette harfang, perchée sur un jalon de la descente nue (point 25), tournée vers la route et un peu vers qui arrive
      const sC = S[(pt(h, 25) + 3) % N], [ox, oz] = bord(sC, -1, sC.w + 0.5); jalons.push([ox, sC.y, oz]);
      h.pose('chouette', { plume: h.mat('peinture', { c: 0xf0f2f8 }), tache: h.mat('peinture', { c: 0x4a4a52 }), oeil: h.mat('peinture', { lum: 1, c: 0xffb020 }), bec: h.mat('peinture', { c: 0x202024 }) },
        grp(ox, sC.y + 2.8, oz, Math.atan2(-sC.tx, -sC.tz) - 0.6, 2.2)); // agrandie : à sa taille vraie, elle ne se voit pas à 150 km/h
      insts(h, 'jalon', { piquet: h.mat('cone'), bague: h.mat('catadioptre', { lum: 1, retro: 2.5 }) }, jalons);
      insts(h, 'jalon', { piquet: h.mat('cone'), bague: h.mat('peinture', { lum: 1, c: 0x50b0ff }) }, jalonsG);
      // la descente nue (points 23 à 26) : le chasse-neige garé sur un dégagement, gyrophare allumé ; la remontée mécanique arrêtée pour l'hiver grimpe la pente au nord, sièges figés
      const peauCN = { chassis: h.mat('matGris'), caisse: h.mat('peinture', { c: 0xf08a1a }), vitre: h.mat('vitreSombre'), neige, lame: h.mat('rayures'), roue: h.mat('roue'), pneu: h.mat('pneu') };
      const sN = S[iN], [nx, nz] = bord(sN, 1, sN.w + 4.2), gN = grp(nx, Math.max(sN.y - 0.15, g.hAt(nx, nz)), nz, -Math.atan2(sN.tz, sN.tx) + 0.15);
      h.pose('chasseNeige', peauCN, gN); h.lum(iN, nx, sN.y + 5, nz, 0xff8a1a, 26, 1.1);
      const gyro = new THREE.Group(); gyro.userData.dyn = 1; gyro.position.copy(gN.position); gyro.rotation.y = gN.rotation.y; h.scene.add(gyro); // il clignote : hors fusion du décor fixe
      const feuxG = [-1, 1].map(sd => h.pose('boite', h.mat('clignotant', LUM), gyro, [2, 3.55, sd * 0.7], 0.32, 0.28, 0.32));
      { const s = S[(pt(h, 23) + 35) % N], ry = -Math.atan2(s.tz, s.tx), tops = []; // la ligne part perpendiculaire à la route, vers le dehors de la boucle
        for (let k = 0; k < 6; k++) { const [x, z] = bord(s, -1, s.w + 24 + 46 * k), y = g.hAt(x, z); h.pose('pyloneTelesiege', { acier: h.mat('acier'), neige }, grp(x, y, z, ry)); tops.push([x, y + 8.75, z]); }
        const sieges = []; for (let k = 0; k < 5; k++) for (const sd of [-1, 1]) { const [a, b] = [tops[k], tops[k + 1]], ox = s.tx * sd * 2.1, oz = s.tz * sd * 2.1, L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
          const c = grp((a[0] + b[0]) / 2 + ox, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2 + oz, 0); c.lookAt(b[0] + ox, b[1], b[2] + oz); h.pose('boite', h.mat('matGris'), c, [0, 0, 0], 0.14, 0.14, L); // le câble, d'un pylône à l'autre
          for (const f of [0.3, 0.7]) sieges.push([a[0] + (b[0] - a[0]) * (sd > 0 ? f : 1 - f) + ox, a[1] + (b[1] - a[1]) * (sd > 0 ? f : 1 - f) - 0.25, a[2] + (b[2] - a[2]) * (sd > 0 ? f : 1 - f) + oz, ry + Math.PI / 2 * (sd > 0 ? 1 : -1)]); }
        insts(h, 'siege', { acier: h.mat('acier'), siege: h.mat('peinture', { c: 0x2a62c8 }), neige }, sieges); }
      // balises de virage à l'extérieur des courbes, fixées devant les jalons : 1,2 × 0,6 m (les chevrons communs, 5 × 2,5 m, écrasent la route du col) ; sans retro, qui les assombrit à l'aube
      const chev = [[], []]; for (let i = 0; i < N; i += 6) { const s = S[i]; if (Math.abs(s.k) <= 0.006) continue; const f = s.k > 0 ? 0 : 1, [x, z] = bord(s, f ? 1 : -1, s.w + 0.35); chev[f].push([x, s.y + 1.9, z, Math.atan2(s.x - x, s.z - z), 0.24]); }
      chev.forEach((l, f) => inst(h, h.geo('chevron'), h.mat('chevron', { lum: 1, side: THREE.DoubleSide }, f), l));
      // le refuge du col, côté aval, fenêtres allumées, et le panneau du col
      const iR = pt(h, 19), gR = repere(h, S[iR]), WR = S[iR].w, [lx, lz] = bord(S[iR], -1, WR + 9);
      const peauR = { pierre: h.mat('pierre', { c: 0x8a92a4 }), mur: h.mat('planches', { c: 0x9a7a5a }), toit: neige, fenetre: h.mat('vitrine', { lum: 1, c: 0xffc070 }), porte: h.mat('planches', { c: 0x4a3626 }) };
      h.pose('refuge', peauR, gR, [-(WR + 17), 0, 0]);
      // deux voitures ensevelies devant le refuge : il ne dépasse que les vitres et les roues
      const auto = { caisse: neige, vitre: h.mat('vitreSombre'), feuRouge: h.mat('feuRouge'), feuBlanc: h.mat('lampe'), chassis: h.mat('matGris'), roue: h.mat('roue'), pneu: h.mat('pneu') };
      for (const [dz, a] of [[11, 1.4], [16, 1.75]]) { const v = new THREE.Group(); v.position.set(-(WR + 8), -0.15, dz); v.rotation.y = a; gR.add(v); h.pose('voitureGaree', auto, v); }
      // le hameau du fond de vallée, dans la boucle du départ : six chalets aux fenêtres allumées, pignon vers la route
      insts(h, 'refuge', peauR, [[28, -1, 30], [29, 1, 26], [29, -1, 48], [30, -1, 28], [0, -1, 34], [1, 1, 30]].map(([p, sd, o]) => { const s = S[pt(h, p)], [x, z] = bord(s, sd, s.w + o); return [x, g.hAt(x, z) - 0.8, z, h.across(s) + (sd > 0 ? Math.PI : 0)]; }));
      // le col est fermé : les barrières ont été poussées sur le bas-côté après le départ, leur feu orange allumé
      for (const dz of [0, 4]) h.pose('barriere', { rayures: h.mat('rayures', LUM), clignotant: h.mat('clignotant', LUM) }, repere(h, S[14]), [S[14].w + 5, 0.6, dz]);
      // la ligne à haute tension traverse la vallée d'est en ouest, entre le départ et les lacets
      for (let x = -160; x <= 640; x += 160) if (g.dAt(x, 140) > 20) h.pose('pyloneCol', { acier: h.mat('acier') }, h.scene, [x, g.hAt(x, 140), 140]);
      // rochers qui percent la neige : les mêmes pyramides que les sommets, petites, plus nombreuses là-haut où il n'y a plus d'arbres
      const rocs = []; for (let k = 0; k < 900 && rocs.length < 70; k++) { const x = g.box[0] + rnd() * (g.box[2] - g.box[0]), z = g.box[1] + rnd() * (g.box[3] - g.box[1]), d = g.dAt(x, z), y = g.hAt(x, z), l = 5 + rnd() * 14;
        if (d > l + 14 && d < 220 && !gorge(x, z) && rnd() < (y > 80 ? 0.9 : 0.25) && ecart(x, z, d) > l + 14) rocs.push([x, y - 1, z, rnd() * 1.5, l, l * (0.6 + rnd() * 0.9), l * (0.7 + rnd() * 0.6)]); }
      inst(h, h.geo('pic'), h.mat('rocNeige'), rocs);
      h.lum(iR, lx, S[iR].y + 3, lz, 0xffb060, 45, 1.3);
      h.pose('panneauCol', { poteau: h.mat('acier'), plaque: h.mat('ecrit', { retro: 1.5 }, 128, 42, '#1c3fa8', '#f4f8ff', 'COL DE L\'ECHINE · 1922 m', 10) }, gR, [-(WR + 4), 0, -16]);
      // les sommets, en couronne à plus d'un kilomètre, bleus dans le petit jour
      const pics = []; for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283 + rnd() * 0.2, r = 1150 + rnd() * 500, l = 520 + rnd() * 420; pics.push([250 + Math.cos(a) * r, 40, 250 + Math.sin(a) * r, rnd() * 1.5, l, 420 + rnd() * 330, l]); }
      inst(h, h.geo('pic'), h.mat('rocNeige', { fog: false, c: 0xa8b8e8 }), pics);
      // ---------- Laponie, en secret : rennes, cerfs, kotas, sapin de Noël, aurores boréales, et le Père Noël ----------
      const P = c => h.mat('peinture', { c }), bete = c => ({ poil: P(c), patte: P(0x3a2a20), nez: P(0x1a1410), ventre: P(0xe8e0d0), bois: P(0xd8c8a8) });
      const prets = (n, p, sd, o0, o1) => Array.from({ length: n }, () => { const s = S[(pt(h, p) + (rnd() * 30 | 0)) % N], [x, z] = bord(s, sd, s.w + o0 + rnd() * (o1 - o0)); return [x, g.hAt(x, z), z, rnd() * 6.3, 0.9 + rnd() * 0.25]; });
      insts(h, 'renne', bete(0x8a7660), [...prets(9, 29, 1, 25, 60), ...prets(5, 0, 1, 20, 45)]); // le troupeau du hameau
      insts(h, 'renne', bete(0x6a4428), prets(5, 25, 1, 14, 30), { a: [1.8] }); // les cerfs, à l'orée du bois
      const kotas = prets(4, 29, -1, 60, 80).map(p => [p[0], p[1] - 0.3, p[2], p[3]]); inst(h, h.geo('kota'), h.mat('planches', { c: 0xb09070 }), kotas);
      kotas.forEach(p => h.lum(pt(h, 29), p[0], p[1] + 1, p[2], 0xff9040, 14, 1.2));
      // le sapin de Noël du hameau, ses boules allumées
      { const s = S[pt(h, 29)], [x, z] = bord(s, -1, s.w + 40), y = g.hAt(x, z), cols = [0xff3030, 0xffd040, 0x40a0ff, 0xff60e0];
        inst(h, h.geo('cedre'), h.mat('sapinNeige'), [[x, y + 18, z, 0, 1.8]]); inst(h, h.geo('tronc'), h.mat('tronc'), [[x, y + 4.3, z, 0, 1.8]]);
        cols.forEach((c, k) => inst(h, h.geo('boite', 0.5, 0.5, 0.5), h.mat('peinture', { lum: 1, c }), Array.from({ length: 14 }, (_, j) => { const t = (j * 4 + k) / 56, a = t * 40, r = 4.6 * (1 - t) + 0.3; return [x + Math.cos(a) * r, y + 5 + t * 15, z + Math.sin(a) * r]; })));
        h.pose('boite', h.mat('peinture', { lum: 1, c: 0xffe070 }), h.scene, [x, y + 21, z], 1, 1, 1); }
      // le Père Noël : son traîneau et deux rennes garés près du refuge…
      const peauN = { patin: P(0xd8a838), caisse: P(0xb01020), sac: P(0x6a4a2a), costume: P(0xc8102e), ceinture: P(0x1a1a1a), peau: P(0xf0c0a0), barbe: P(0xf8f8f8) };
      const attelage = (parent, n) => { const t = new THREE.Group(); parent.add(t); h.pose('traineau', peauN, t);
        for (let k = 0; k < n; k++) for (const sd of [-1, 1]) h.pose('renne', k === n - 1 && sd < 0 ? { ...bete(0x8a7660), nez: h.mat('feuRouge', LUM) } : bete(0x8a7660), t, [3.4 + k * 2.6, 0, sd * 0.6]);
        for (const sd of [-1, 1]) h.pose('boite', peauN.ceinture, t, [1.6 + n * 1.3, 1.55, sd * 0.45], n * 2.6 + 0.6, 0.04, 0.04); return t; };
      { const t = attelage(gR, 1); t.position.set(-(WR + 10), 0, -4); t.rotation.y = Math.PI / 2; }
      // … et le même, en vol, quatre paires de rennes, qui tourne au-dessus du col
      let cx = 0, cz = 0, rx = 0, ym = -1e9; for (const s of S) { cx += s.x / N; cz += s.z / N; ym = Math.max(ym, s.y); } for (const s of S) rx = Math.max(rx, Math.hypot(s.x - cx, s.z - cz));
      const vol = new THREE.Group(); vol.userData.dyn = 1; h.scene.add(vol); attelage(vol, 4).position.x = -6;
      // aurores boréales : deux rideaux de lumière qui ondulent haut dans le ciel, au nord, derrière les sommets
      const rideaux = [['#40ffa0', 1350, 2.2, 3.9, 560, 520], ['#b060ff', 1550, 2.7, 4.4, 640, 380]].map(([c, r0, a0, a1, y0, ht]) => {
        const n = 90, pos = new Float32Array((n + 1) * 6), uv = [], idx = [];
        for (let k = 0; k <= n; k++) { uv.push(k / 6, 0, k / 6, 1); if (k < n) idx.push(2 * k, 2 * k + 2, 2 * k + 1, 2 * k + 1, 2 * k + 2, 2 * k + 3); }
        const ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.BufferAttribute(pos, 3)); ge.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); ge.setIndex(idx);
        const m = new THREE.Mesh(ge, h.mat('degrade', { lum: 1, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }, c, true));
        m.userData.dyn = 1; m.frustumCulled = false; h.scene.add(m); return { m, pos, n, r0, a0, a1, y0, ht };
      });
      return (dt, now) => {
        feuxG.forEach((m, k) => { m.visible = ((now / 260 | 0) + k) % 2 === 0; }); // le gyrophare : ses deux feux alternent
        const a = now * 0.00012, R = rx * 0.75, [x, z] = [cx + Math.cos(a) * R, cz + Math.sin(a) * R];
        vol.position.set(x, ym + 45 + Math.sin(now * 0.002) * 3, z); vol.rotation.y = -a - Math.PI / 2; // X local sur la tangente du cercle, sens de la marche
        for (const q of rideaux) { for (let k = 0; k <= q.n; k++) { const t = q.a0 + (q.a1 - q.a0) * k / q.n, r = q.r0 + 90 * Math.sin(k * 0.21 + now * 0.0005) + 40 * Math.sin(k * 0.07 - now * 0.0003), px = cx + Math.cos(t) * r, pz = cz + Math.sin(t) * r;
          q.pos.set([px, q.y0, pz, px, q.y0 + q.ht * (0.8 + 0.2 * Math.sin(k * 0.3 + now * 0.001)), pz], k * 6); }
          q.m.geometry.attributes.position.needsUpdate = true; q.m.material.opacity = 0.55 + 0.2 * Math.sin(now * 0.0007 + q.r0); }
      };
    },
    // ---------- Spéciale des Ocres : une spéciale de rallye en fin de journée. Garrigue, pins parasols, oliviers et cyprès, talus des bas-côtés, vignes et lavandes, buttes d'ocre ;
    // parc d'assistance au départ, public sur des talus tout le long, banderoles, voitures garées, le gué, le hameau et son bout de bitume, des mas isolés, un village perché et sa chapelle ----------
    terre(h) {
      const { THREE, S, N, W, rnd } = h, [[g0, g1], [b0, b1]] = h.M.surf.zones, entre = (i, a, n) => (i - a + 2 * N) % N <= n, m = i => S[(i + 2 * N) % N];
      const iG = (pt(h, g0) + pt(h, g1)) >> 1, iB = pt(h, b0), nB = (pt(h, b1) - iB + N) % N;
      // plat(i) : là où le sol reste au niveau de la route (gué, hameau avec son moulin et sa pâture, parc d'assistance du départ) ; ailleurs les bas-côtés montent en talus
      const plat = i => entre(i, iG - 30, 60) || entre(i, iB - 60, nB + 80) || entre(i, -50, 130), parc = i => entre(i, -50, 130);
      const sub = S.filter((_, i) => i % 4 === 0), pres = (x, z) => { let b = 0, bd = 1e18; for (let k = 0; k < sub.length; k++) { const d = (sub[k].x - x) ** 2 + (sub[k].z - z) ** 2; if (d < bd) { bd = d; b = k; } } return [Math.sqrt(bd), b * 4]; };
      const ss = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
      // le village perché : sur une butte à sommet plat, au point de l'emprise le plus loin de la route
      let vx = 0, vz = 0, vd = 0, bx = [1e9, 1e9, -1e9, -1e9]; for (const s of S) bx = [Math.min(bx[0], s.x), Math.min(bx[1], s.z), Math.max(bx[2], s.x), Math.max(bx[3], s.z)];
      for (let x = bx[0]; x <= bx[2]; x += 20) for (let z = bx[1]; z <= bx[3]; z += 20) { const d = pres(x, z)[0]; if (d > vd) { vd = d; vx = x; vz = z; } }
      // relief des bas-côtés : des talus de terre au bord de la route (jusqu'à 3,5 m, par endroits seulement), des collines au-delà, la butte du village
      const relief = (x, z) => { const [d, i] = pres(x, z); if (d < W + 3) return 0;
        const n1 = Math.max(0, Math.sin(x * 0.031 + 1) * Math.cos(z * 0.027) + 0.5 * Math.sin(x * 0.07 + z * 0.05)), n2 = 0.5 + 0.5 * Math.sin(x * 0.011 + 2) * Math.cos(z * 0.009 + 1);
        return (plat(i) ? 0 : 3.5 * n1 * ss(W + 3, W + 16, d)) + 16 * n2 * ss(50, 220, d) + 18 * (1 - ss(38, 110, Math.hypot(x - vx, z - vz))) * ss(30, 70, d); };
      const g = terrain(h, { pas: 8, marge: 420, loin: 45, chute: -0.1, mat: h.mat('terreOcre'), creux: (x, z) => -relief(x, z) });
      const occ = [], vide = (x, z, r) => occ.every(o => (o[0] - x) ** 2 + (o[1] - z) ** 2 > (o[2] + r) ** 2), prend = (x, z, r) => vide(x, z, r) && (occ.push([x, z, r]), true); // ce qui est déjà posé : rien ne se chevauche
      const sol = (x, z, dy = 0) => g.hAt(x, z) + dy, hasard = () => [g.box[0] + rnd() * (g.box[2] - g.box[0]), g.box[1] + rnd() * (g.box[3] - g.box[1])];
      // le gué : le ruisseau traverse la route au creux du parcours, 16 m d'eau trouble sur la chaussée
      const eau = h.mat('eauGue', { rep: [3, 3] }), eauR = h.mat('eauGue', { rep: [12, 2] });
      h.ribbon((iG - 4 + N) % N, 8, -W + 0.2, 0.05, W - 0.2, 0.05, eau, 8);
      h.pose('boite', eauR, repere(h, S[iG]), [0, -0.15, 0], 90, 0.3, 8);
      // le hameau : la terre laisse place à un bout de bitume entre des mas de pierre
      const peauM = { mur: h.mat('pierre'), toit: h.mat('tuilesCanal'), volet: h.mat('peinture', { c: 0x6a8ab8 }) }, mas = [], cypres = [], pins = [], futs = [], oliviers = [], buissons = [];
      const cyp = (x, z) => { const e = 0.6 + rnd() * 0.5; cypres.push([x, sol(x, z, 7.3 * e), z, rnd() * 6, 0.38 * e, e, 0.38 * e]); };
      h.ribbon(iB, nB, -W + 0.2, 0.05, W - 0.2, 0.05, h.mat('chaussee', {}, '#4c4c52', '#58585e', '#e8e4d8', '#4c4c52', '#4c4c52', '#4c4c52', false), 32);
      for (let k = 0; k < 9; k++) { const s = m(iB + 4 + Math.round(k * (nB - 8) / 8)), sd = k & 1 ? 1 : -1, [x, z] = bord(s, sd, W + 7 + (k % 3) * 2); mas.push([x, s.y - 0.5, z, h.across(s)]); occ.push([x, z, 9]);
        if (k % 3 === 0) cyp(...bord(s, sd, W + 17)); }
      for (let i = iB - 40; i < iB + nB + 60; i += 14) { const [x, z] = bord(m(i), -1, W + 2.2); futs.push([x, sol(x, z, 3.6), z, 0, 0.5, 1.4, 0.5]); } // poteaux du téléphone le long du hameau
      // le parc d'assistance, à droite de la ligne droite du départ : deux rangs de barnums, un fourgon derrière chacun, une voiture de course sous un sur deux
      const COUL = [0xe8482a, 0xf4f0e0, 0x2a62c8, 0xf4c020, 0x3a7a3a, 0xf08a2a], barnums = [], fourgons = [], autos = [], auto = (x, z, a, c) => autos.push([x, sol(x, z), z, a, 1, 1, 1, c]);
      for (let k = 0; k < 14; k++) { const rang = k & 1, s = m(-44 + (k >> 1) * 16 + rang * 8), a = h.across(s), [x, z] = bord(s, 1, W + 8 + rang * 17), [fx, fz] = bord(s, 1, W + 15 + rang * 17);
        barnums.push([x, s.y - 0.45, z, a - Math.PI / 2, 1, 1, 1, COUL[k % 6]]); fourgons.push([fx, s.y - 0.5, fz, a + Math.PI / 2 + (rnd() - 0.5) * 0.5, 1, 1, 1, COUL[(k + 1) % 6]]); occ.push([x, z, 6], [fx, fz, 4]);
        if (k % 2 === 0) autos.push([x, s.y - 0.45, z, a + Math.PI / 2, 1, 1, 1, COUL[(k + 2) % 6]]); }
      // le public : un talus à l'extérieur de chaque virage, un autre de loin en loin dans les lignes droites, en face du parc et à la réception des crêtes ; bottes de paille au pied, voitures garées derrière
      const talus = [], bottes = [], pan = [], crete = h.M.sauts.map(([p]) => pt(h, p));
      const groupe = (i, sd, nb) => { for (let k = 0; k < nb; k++) { const t = m(i + Math.round((k - (nb - 1) / 2) * 8)), [x, z] = bord(t, sd, W + 6.5); talus.push([x, Math.max(t.y, sol(x, z)) - 0.4, z, h.across(t) + Math.PI / 2, 1, 1, 1, i]); occ.push([x, z, 8]); }
        for (let dk = -nb * 4 - 1; dk <= nb * 4 + 1; dk += 2) { const t = m(i + dk), [x, z] = bord(t, sd, W + 1.3); bottes.push([x, t.y - 0.1, z, h.across(t)]); }
        for (let dk = -nb * 4; dk <= nb * 4; dk += 4) { const t = m(i + dk), [x, z] = bord(t, -sd, W + 0.45); pan.push([x, t.y + 1.45, z, h.across(t) + Math.PI / 2]); } // banderoles en face, au-dessus du muret
        for (let k = 0; k < nb + 1; k++) { const t = m(i - nb * 4 + k * 7), [x, z] = bord(t, sd, W + 15 + rnd() * 5); if (prend(x, z, 3.5)) auto(x, z, h.across(t) + (rnd() - 0.5), COUL[(i + k) % 6]); } };
      const pris = i => talus.some(t => entre(i, t[7] - 34, 68)), libre = i => !entre(i, iG - 22, 44) && !entre(i, iB - 14, nB + 64) && !parc(i); // ni au gué, ni au hameau et à sa pâture, ni au parc
      for (const i of [-30, 0, 30, 60]) groupe(i, -1, 3); // la tribune de terre face au parc
      for (const i of crete) for (const sd of [-1, 1]) groupe(i + 22, sd, 2);
      for (let i = 0; i < N; i++) { const s = S[i], k = Math.abs(s.k); if (k >= 0.012 && k >= Math.abs(m(i + 1).k) && k >= Math.abs(m(i - 1).k) && libre(i) && !pris(i)) groupe(i, s.k > 0 ? -1 : 1, k > 0.022 ? 3 : 2); } // l'extérieur : à gauche d'un virage à droite
      for (let i = 0, sd = 1; i < N; i += 20) if (libre(i) && !pris(i)) groupe(i, sd = -sd, 1);
      for (let i = -48; i < 80; i += 4) for (const sd of [-1, 1]) { const t = m(i), [x, z] = bord(t, sd, W + 0.45); pan.push([x, t.y + 1.45, z, h.across(t) + Math.PI / 2]); }
      for (const i of crete) for (let dk = -44; dk < -4; dk += 4) for (const sd of [-1, 1]) { const t = m(i + dk), [x, z] = bord(t, sd, W + 0.45); pan.push([x, t.y + 1.45, z, h.across(t) + Math.PI / 2]); }
      const foule = h.mat('foule', {}, '#8a5a34', '#e8482a'); foule.map.anisotropy = 8;
      insts(h, 'talusPublic', { talus: h.mat('terreOcre'), ruban: h.mat('banderoleRallye', {}, 0), foule }, talus);
      const pan1 = pan.filter((p, k) => !pan.slice(0, k).some(q => (p[0] - q[0]) ** 2 + (p[2] - q[2]) ** 2 < 7.5 * 7.5)); // les groupes et les rangées posent parfois une banderole au même endroit : une seule par place, sinon deux textures se battent
      inst(h, h.geo('boite', 7.6, 0.9, 0.1), h.mat('banderoleRallye', { side: THREE.DoubleSide }, 2), pan1).castShadow = false; // 7,6 m tous les 8 m : un jour entre deux, pas de chevauchement en virage
      // portiques des crêtes, 30 m avant le bout, aux couleurs de la spéciale : la crête se lit au relief, au portique et au public, sans marquage au sol
      insts(h, 'portiqueSaut', { acier: h.mat('acier'), banderole: h.mat('banderoleRallye', { side: THREE.DoubleSide, rep: [2, 1] }, 4) }, crete.map(i => { const s = m(i - 15); return [s.x, s.y, s.z, h.across(s)]; }), { a: [W] });
      // pts 18-22 : l'hélicoptère de la télévision, en vol stationnaire à 26 m au-dessus du bord droit de la piste, le nez vers elle ; il se balance, le rotor tourne (animé plus bas)
      const sH = m(pt(h, 20)), [hx, hz] = bord(sH, 1, 5), heli = new THREE.Group(), rotor = new THREE.Group(), hy = sH.y + 26; heli.userData.dyn = 1; h.scene.add(heli); // dyn : il bouge, hors fusion du décor fixe (game.js)
      heli.position.set(hx, hy, hz); heli.rotation.y = h.across(sH) + Math.PI; rotor.position.y = 1.65; heli.add(rotor);
      const peauH = { caisse: h.mat('peinture', { c: 0xe8482a }), vitre: h.mat('vitreSombre'), chassis: h.mat('matGris'), pale: h.mat('matGris') };
      h.pose('helico', peauH, heli); h.pose('rotorHelico', peauH, rotor);
      // pts 62-68 : à l'entrée du hameau, un moulin à vent en ruine sur le côté le plus dégagé ; à la sortie, un troupeau de moutons dans sa pâture et le berger, devant la clôture, qui fait signe aux voitures
      const cote = s => g.dAt(...bord(s, 1, 40)) > g.dAt(...bord(s, -1, 40)) ? 1 : -1, face = (s, sd) => h.across(s) + (sd > 0 ? Math.PI : 0); // face : l'axe +X d'une forme tourné vers la route
      const sM = m(pt(h, 62) + 4), dM = cote(sM), [mx, mz] = bord(sM, dM, W + 26), bois = h.mat('planches'), pierre = h.mat('pierre'); occ.push([mx, mz, 9]);
      inst(h, h.geo('tourMoulin'), h.mat('pierre', { side: THREE.DoubleSide, c: 0xb89a78 }), [[mx, sol(mx, mz, -0.4), mz, 0, 1.4]]); // pierre plus sombre que celle des mas : il se détache du ciel
      insts(h, 'moulinRuine', { bois, pierre }, [[mx, sol(mx, mz, -0.4), mz, face(sM, dM), 1.4]]); // à l'échelle 1,4 : une tour de 12,6 m
      const sP = m(pt(h, 68) + 8), dP = cote(sP), along = (s, sd, off, a) => { const [x, z] = bord(s, sd, off); return [x + s.tx * a, z + s.tz * a]; }, P0 = W + 6, PL = 21, PA = 28; // la pâture : de P0 à P0 + PL en travers, PA le long de la route
      const clot = [], moutons = [], seg = 7, aTr = h.across(sP), aLg = aTr + Math.PI / 2;
      for (let a = -PA / 2 + seg / 2; a < PA / 2; a += seg) for (const off of [P0, P0 + PL]) { const [x, z] = along(sP, dP, off, a); clot.push([x, sol(x, z), z, aLg]); }
      for (let o = seg / 2; o < PL; o += seg) for (const a of [-PA / 2, PA / 2]) { const [x, z] = along(sP, dP, P0 + o, a); clot.push([x, sol(x, z), z, aTr]); }
      for (let k = 0; k < 18; k++) { const [x, z] = along(sP, dP, P0 + 2 + rnd() * (PL - 4), (rnd() - 0.5) * (PA - 4)); moutons.push([x, sol(x, z), z, rnd() * 6, 0.9 + rnd() * 0.25]); }
      { const [x, z] = along(sP, dP, P0 + PL / 2, 0); occ.push([x, z, 18]); }
      insts(h, 'cloture', { bois }, clot, { a: [seg] }); insts(h, 'mouton', { laine: h.mat('peinture', { c: 0xe4dccb }), tete: h.mat('peinture', { c: 0x2e2620 }) }, moutons);
      const [qx, qz] = along(sP, dP, P0 - 1.4, -6), berger = new THREE.Group(), bras = new THREE.Group(); berger.userData.dyn = 1; h.scene.add(berger);
      berger.position.set(qx, sol(qx, qz), qz); berger.rotation.y = face(sP, dP); berger.scale.setScalar(1.15); bras.position.set(0, 1.5, -0.3); berger.add(bras);
      const peauB = { habit: h.mat('peinture', { c: 0x3a6ab0 }), peau: h.mat('peinture', { c: 0xc89870 }), chapeau: h.mat('peinture', { c: 0x2e2a24 }), bois };
      h.pose('berger', peauB, berger); h.pose('brasBerger', peauB, bras);
      // dans la campagne : des mas isolés avec leurs cyprès, une chapelle au bord de la route, le village sur sa butte autour de la sienne
      const chap = [];
      for (let k = 0, nb = 0; k < 900 && nb < 9; k++) { const [x, z] = hasard(), d = g.dAt(x, z); if (d < 26 || d > 70 || plat(pres(x, z)[1]) || !prend(x, z, 13)) continue;
        const a = rnd() * 6; if (nb++ === 0) chap.push([x, sol(x, z, -0.8), z, a]); else mas.push([x, sol(x, z, -1), z, a]); for (const da of [0.6, 1.1, 3.6]) cyp(x + Math.cos(a + da) * 9, z + Math.sin(a + da) * 9); }
      occ.push([vx, vz, 46]); chap.push([vx, sol(vx, vz, -0.3), vz, 0.4, 1.4]);
      for (let k = 0; k < 22; k++) { const a = k * 2.4, r = 13 + k * 1.15, x = vx + Math.cos(a) * r, z = vz + Math.sin(a) * r; mas.push([x, sol(x, z, -1.2), z, a + (k & 1) * 1.57, 0.9 + rnd() * 0.3]); if (k % 4 === 0) cyp(x + 6, z + 5); }
      insts(h, 'mas', peauM, mas); insts(h, 'chapelle', peauM, chap);
      // vignes et lavandes : des parcelles en rangs sur les pentes
      const champs = [[], []];
      for (let k = 0, nb = 0; k < 1500 && nb < 22; k++) { const [x, z] = hasard(), d = g.dAt(x, z); if (d < 36 || d > 170 || !prend(x, z, 24)) continue;
        const a = rnd() * 3.14, t = nb++ & 1, ca = Math.cos(a), sa = Math.sin(a);
        for (let r = -4; r <= 4; r++) for (let q = -2; q <= 2; q++) { const px = x + ca * q * 7 - sa * r * 3.4, pz = z + sa * q * 7 + ca * r * 3.4; champs[t].push([px, sol(px, pz, 0.25), pz, -a]); } }
      inst(h, h.geo('boite', 7.1, 1.1, 1.1), h.mat('feuillage', { c: 0xc8e070 }), champs[0]).castShadow = false; inst(h, h.geo('boite', 7.1, 0.8, 1.5), h.mat('lavande'), champs[1]).castShadow = false;
      // voitures du public et de l'assistance : une passe de dessin par pièce, la caisse teintée par exemplaire
      const peauV = { caisse: h.mat('laque'), vitre: h.mat('vitreSombre'), feuRouge: h.mat('feuRouge', LUM), feuBlanc: h.mat('lampe', LUM), chassis: h.mat('matGris'), roue: h.mat('roue'), pneu: h.mat('pneu') };
      insts(h, 'voitureGaree', peauV, autos, { teinte: 'caisse' }); insts(h, 'fourgon', peauV, fourgons, { teinte: 'caisse' });
      insts(h, 'barnum', { poteau: h.mat('acier'), toile: h.mat('peinture') }, barnums, { teinte: 'toile' });
      inst(h, h.geo('botte'), h.mat('paille'), bottes.concat(Array.from({ length: 70 }, () => { const [x, z] = hasard(), d = g.dAt(x, z); return d > 14 && d < 110 && vide(x, z, 2) ? [x, sol(x, z, -0.1), z, rnd() * 6] : null; }).filter(Boolean)));
      // pins parasols au bord de la route et en bosquets sur les pentes, oliviers plus bas, buissons de garrigue partout (le même houppier, tout petit, au ras du sol)
      const pin = (x, z) => { const e = 0.8 + rnd() * 0.7, r = 2.8 + rnd() * 2.2, y = sol(x, z); futs.push([x, y + 2.6 * e, z, 0, e]); pins.push([x, y + 5.2 * e + 0.25 * r, z, rnd() * 6, r]); };
      const olivier = (x, z) => { const e = 0.35 + rnd() * 0.2, r = 1.8 + rnd() * 1.4, y = sol(x, z); futs.push([x, y + 2.6 * e, z, rnd(), e * 1.6, e, e * 1.6]); oliviers.push([x, y + 5.2 * e + 0.5 * r, z, rnd() * 6, r, r * 1.7, r]); };
      for (let i = 0; i < N; i += 4) for (const sd of [-1, 1]) { const [x, z] = bord(S[i], sd, W + 8 + rnd() * 18), q = rnd(); if (q < 0.62 && !plat(i) && vide(x, z, 3) && g.dAt(x, z) > W + 6) (q < 0.4 ? pin : q < 0.52 ? olivier : cyp)(x, z); }
      for (let k = 0; k < 6500; k++) { const [x, z] = hasard(), d = g.dAt(x, z), b = Math.sin(x * 0.021) + Math.cos(z * 0.026) + rnd();
        if (d > 26 && b > 0.9 && vide(x, z, 4)) (rnd() < 0.8 ? pin : olivier)(x, z);
        else if (d > W + 3 && d < 190 && vide(x, z, 1)) { const r = 0.7 + rnd() * 1.3; buissons.push([x, sol(x, z, 0.2), z, rnd() * 6, r]); } }
      inst(h, h.geo('pinParasol'), h.mat('feuillage'), pins); inst(h, h.geo('pinParasol'), h.mat('feuillage'), buissons).castShadow = false; inst(h, h.geo('pinParasol'), h.mat('feuillage', { c: 0xa8c0a0 }), oliviers); // buissons, rangs et banderoles ne portent pas d'ombre : du temps de rendu pour rien
      inst(h, h.geo('tronc'), h.mat('tronc'), futs); inst(h, h.geo('cedre'), h.mat('cedre', { c: 0x9ad08a }), cypres);
      // les ocres : des blocs éboulés au bord de la route, des buttes proches, et une couronne de falaises à l'horizon, dans la brume de poussière
      const buttes = [], cx = (g.box[0] + g.box[2]) / 2, cz = (g.box[1] + g.box[3]) / 2;
      for (let k = 0; k < 2000 && buttes.length < 110; k++) { const [x, z] = hasard(), d = g.dAt(x, z), l = 1.2 + rnd() * 2.6; if (d > W + 4 && d < 60 && vide(x, z, l)) buttes.push([x, sol(x, z, -0.4), z, rnd() * 6, l, l * (0.6 + rnd() * 0.5), l * (0.7 + rnd() * 0.6)]); } // des blocs, pas des galettes
      for (let k = 0, nb = 0; k < 600 && nb < 20; k++) { const [x, z] = hasard(), d = g.dAt(x, z), l = 30 + rnd() * 40; if (d > l + 40 && d < 280 && prend(x, z, l + 40)) { nb++; buttes.push([x, sol(x, z, -6), z, rnd() * 6, l, 22 + rnd() * 26, l * (0.7 + rnd() * 0.6)]); } }
      for (let k = 0; k < 18; k++) { const a = k / 18 * 6.283 + rnd() * 0.2, r = 1000 + rnd() * 450, l = 170 + rnd() * 190; buttes.push([cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r, rnd() * 6, l, 110 + rnd() * 110, l * (0.7 + rnd() * 0.6)]); }
      inst(h, h.geo('butte'), h.mat('falaiseOcre'), buttes);
      // le ruisseau coule, le public lève les bras par moments, l'hélicoptère se balance sous son rotor, le berger agite le bras
      return (dt, now) => { rotor.rotation.y = now * 0.025; heli.position.y = hy + Math.sin(now * 0.0011) * 0.6; heli.rotation.z = Math.sin(now * 0.0007) * 0.05; bras.rotation.x = -2.6 + Math.sin(now * 0.008) * 0.45; eau.map.offset.y -= dt * 0.25; eauR.map.offset.x += dt * 0.08; foule.map.offset.y = Math.sin(now * 0.0023) + Math.sin(now * 0.0061) > 0.6 ? 0.5 : 0; };
    },
    // ---------- Karasu-tōge : forêt de cèdres, glissières à catadioptres, et au sommet un carrefour : supérette de nuit, station-service, voitures garées ----------
    touge(h) {
      const { THREE, S, N, W, rnd } = h;
      // le torrent du bas de la montée (pt 2) : un ravin de 7 m qui serpente en travers de la route, sous un pont de pierre
      const sp = S[pt(h, 2)], ravin = (x, z) => { const dx = x - sp.x, dz = z - sp.z, v = dz * sp.tx - dx * sp.tz, u = dx * sp.tx + dz * sp.tz - 6 * Math.sin(v / 25);
        return Math.abs(v) > 90 || Math.abs(u) > 9 ? 0 : 7 * (1 - (u / 9) ** 2) * Math.min(1, (90 - Math.abs(v)) / 20); };
      const g = terrain(h, { pas: 7, sous: 6, marge: 320, loin: 60, chute: 1.1, creux: ravin, mat: h.mat('bruit', {}, '#0c1a14', ['#12261e', '#081410', '#16302a']) });
      // le carrefour : sur le plateau du sommet, côté extérieur. Une route de traverse y part, barrée.
      const ic = pt(h, 11), sc = S[ic], sd = g.dAt(...bord(sc, 1, 60)) > g.dAt(...bord(sc, -1, 60)) ? 1 : -1, [cx, cz] = bord(sc, sd, W + 22);
      // cèdres : une rangée serrée le long de la route (le tunnel d'arbres), puis la forêt ; rien sur le carrefour.
      // Dans les lacets, rien côté vallée (ouest) et des cèdres plus petits côté amont, dont la cime reste sous le regard du lacet du dessus ; de jeunes plants sur la pente en contrebas : on voit la ville par-dessus
      const arbres = [], lacets = (x, z) => x > 372 && x < 552 && z > 300 && z < 576, plants = (x, z) => x > 100 && x < 552 && z > 260 && z < 640, libre0 = (x, z) => (x - cx) ** 2 + (z - cz) ** 2 > 46 * 46 && ravin(x, z) < 1;
      // la trouée côté vallée (droite) entre les pts 7 et 9 : aucun arbre là où cette portion est la route la plus proche, la ville et la lune apparaissent
      const i7 = pt(h, 7), i9 = pt(h, 9), trouee = (x, z) => { let b = null, bd = 1e18; for (let i = i7; i <= i9; i += 3) { const d = (S[i].x - x) ** 2 + (S[i].z - z) ** 2; if (d < bd) { bd = d; b = S[i]; } }
        return bd < 160 * 160 && Math.sqrt(bd) < g.dAt(x, z) + 4 && (z - b.z) * b.tx - (x - b.x) * b.tz > 0; }, libre = (x, z) => libre0(x, z) && !trouee(x, z);
      for (let i = 0; i < N; i += 3) for (const side of [-1, 1]) {
        const [x, z] = bord(S[i], side, W + 4.5 + rnd() * 7);
        if (g.dAt(x, z) > W + 3.5 && libre(x, z) && !(lacets(x, z) && x < S[i].x - 3)) arbres.push([x, g.hAt(x, z) + 6, z, rnd() * 6, (0.8 + rnd() * 0.7) * (plants(x, z) && x < 545 ? (lacets(x, z) ? 0.75 : 0.4) : 1)]);
      }
      for (let k = 0; k < 2600; k++) {
        const x = g.box[0] + rnd() * (g.box[2] - g.box[0]), z = g.box[1] + rnd() * (g.box[3] - g.box[1]), d = g.dAt(x, z);
        if (d > W + 6 && d < 230 && libre(x, z) && (!lacets(x, z) || (d < 17 && g.dAt(x - 2, z) < d))) arbres.push([x, g.hAt(x, z) + 6, z, rnd() * 6, (0.9 + rnd() * 0.9) * (lacets(x, z) ? 0.75 : plants(x, z) || (x > -100 && x < 552 && z > 200 && z < 700) ? 0.4 : 1)]);
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

      // ---------- la montée (pts 1 à 12) : un repère par portion, pour qu'elle ne soit plus seulement de grandes courbes dans les cèdres ----------
      const ext = i => g.dAt(...bord(S[i], 1, 30)) > g.dAt(...bord(S[i], -1, 30)) ? 1 : -1; // le côté qui s'éloigne des autres routes
      // un groupe posé au sol à côté de la route, X local = en s'éloignant d'elle ; jamais plus de `bas` m sous la chaussée (les socles descendent dans la pente)
      const site = (i, cote, off, bas = 9) => { const s = S[i], [x, z] = bord(s, cote, off), p = new THREE.Group(); p.position.set(x, Math.max(g.hAt(x, z), s.y - bas), z); p.rotation.y = h.across(s) + (cote > 0 ? 0 : Math.PI); h.scene.add(p); return p; };
      const at = (i0, i1, f) => Math.round(i0 + (i1 - i0) * f), allume = (p, i, lx, ly, col, d, f) => { p.updateMatrixWorld(); const q = p.localToWorld(new THREE.Vector3(lx, ly, 0)); h.lum(i, q.x, q.y, q.z, col, d, f); };
      const pierre = h.mat('pierreMousse'), feuDoux = h.mat('lanterne', LUM), beton = h.mat('beton'), bois = h.mat('tronc'), [i1, i3, i4, i5, i10] = [1, 3, 4, 5, 10].map(k => pt(h, k));
      // pts 1-3 : pont de pierre sur le torrent, brume basse qui monte du ravin et traîne sur la route, panneau « 13 % »
      h.pose('pontPierre', { pierre }, repere(h, sp), [0, 0, 0], W);
      const eau = h.mat('eauVive', { lum: 1, c: 0x2a5058 }), flots = [], nappes = [], brumeG = new THREE.PlaneGeometry(1, 1); brumeG.rotateX(-Math.PI / 2);
      const lit = v => { const u = 6 * Math.sin(v / 25); return [sp.x - sp.tz * v + sp.tx * u, sp.z + sp.tx * v + sp.tz * u]; }; // le fond du ravin, comme ravin()
      for (let v = -86; v <= 86; v += 8) { const [x, z] = lit(v); flots.push([x, g.hAt(x, z) + 0.6, z, h.across(sp)]); } // le torrent descend en marches : des cascades
      inst(h, h.geo('boite', 8.6, 0.3, 3.5), eau, flots);
      for (let k = 0; k < 14; k++) { const [x, z] = lit((rnd() - 0.5) * 150); nappes.push([x, g.hAt(x, z) + 2 + rnd() * 3, z, rnd() * 6, 26 + rnd() * 20, 1, 18 + rnd() * 10]); }
      for (let i = i1; i < i3; i += 12) for (const c of [-1, 0, 1]) { const [x, z] = c ? bord(S[i], c, W + 8 + rnd() * 14) : [S[i].x, S[i].z]; nappes.push([x, S[i].y + (c ? -0.8 + rnd() : 0.5), z, rnd() * 6, 24 + rnd() * 20, 1, 24 + rnd() * 20]); }
      const brume = inst(h, brumeG, h.mat('brume', { lum: 1, c: 0x6a8088, transparent: true, opacity: 0.45, depthWrite: false }), nappes); brume.castShadow = brume.receiveShadow = false;
      const retro = { lum: 1, retro: 1.2 }; // les panneaux s'allument dans les phares, comme les catadioptres
      h.pose('panneauPente', { poteau: acier, plaque: h.mat('losange', { ...retro, alphaTest: 0.5 }, '13%'), sous: h.mat('ecrit', retro, 48, 20, '#f4f4f0', '#101010', '上り急勾配', 10) }, repere(h, S[i1 + 12]), [W + 1.5, 0, 0]);
      // pts 3-5 : sanctuaire dans la pente (torii vermillon, escalier de pierre, tōrō allumés, oratoire), et des cerfs sika au bord de la route
      { const i = at(i3, i4, 0.8), p = site(i, -ext(i), W + 4.5);
        h.pose('sanctuaire', { vermillon: h.mat('vermillon'), noir: h.mat('vitreSombre'), marche: pierre, feu: feuDoux, bois, toit: h.mat('matGris') }, p);
        allume(p, i, 2.5, 1.9, 0xffb050, 14, 1.6); allume(p, i, 9, 4.6, 0xffb050, 10, 1.2); }
      const peauCerf = { poil: h.mat('pelage'), patte: h.mat('pelage'), croupe: h.mat('craie'), bois, yeux: h.mat('peinture', { lum: 1, retro: 4, c: 0xc8ffb0 }) }; // les yeux : même technique que les catadioptres
      for (const [f, c, off, t] of [[0.15, 1, 3.4, 1], [0.2, 1, 6.5, 0.8], [0.62, -1, 3.2, 1.05], [0.7, -1, 7, 0.85], [0.74, -1, 5, 0.9]]) {
        const p = site(at(i3, i5, f), c, W + off); p.rotation.y += -c * 2.36 + (rnd() - 0.5) * 0.6; p.scale.setScalar(t); h.pose('cerf', peauCerf, p); } // tournés vers la route et la voiture qui arrive
      // pts 5-7 : mur de soutènement moussu à l'intérieur de l'épingle, filet pare-pierres au-dessus ; dehors, un distributeur de boissons allumé, seul
      const murs = [], filets = [], poteaux = [];
      for (let i = i5 + 8; i < i7; i += 2) { const s = S[i], [x, z] = bord(s, 1, W + 1.7), ry = h.across(s); murs.push([x, s.y + 1.75, z, ry]); filets.push([x, s.y + 5.7, z, ry]); if (i % 4 === 0) poteaux.push([x, s.y + 5.9, z, ry]); }
      inst(h, h.geo('murSout'), h.mat('murMousse'), murs); inst(h, h.geo('filetPierres'), h.mat('filet', { alphaTest: 0.5, side: THREE.DoubleSide }), filets); inst(h, h.geo('poteauFilet'), acier, poteaux);
      { const i = at(i5, i7, 0.55), p = site(i, -1, W + 3.2, 0.4); p.rotation.y += (rnd() - 0.5) * 0.3;
        h.pose('distribIsole', { socle: beton, caisse: h.mat('laque', { c: 0xe8ecf0 }), face: h.mat('distributeur', LUM), bac: h.mat('laque', { c: 0x2a5ac8 }) }, p); allume(p, i, -1.2, 1.6, 0xe8f4ff, 11, 2.2); }
      // pts 7-9 : la trouée côté vallée (les arbres y sont retirés plus haut), annoncée par un panneau de point de vue
      h.pose('panneauVue', { poteau: acier, plaque: h.mat('ecrit', retro, 64, 24, '#5a3420', '#f4f0e0', '展望  VIEW', 14) }, repere(h, S[i7 + 6]), [W + 1.6, 0, 0]);
      // pts 9-10 : trois voitures garées face à la vue, feux allumés, et leurs pilotes debout devant
      { const i = at(i9, i10, 0.35), q = repere(h, S[i]), peau = col => ({ caisse: h.mat('laque', { c: col }), vitre, feuRouge, feuBlanc, chassis: h.mat('matGris'), roue: h.mat('roue'), pneu: h.mat('pneu') });
        h.pose('boite', bitume, q, [W + 6, -0.35, 0], 10, 0.6, 34);
        [[-11, 0.25, 0xd8d8d0], [-2, -0.1, 0x14161c], [8, 0.2, 0xc8102e]].forEach(([vz, a, col]) => { const v = new THREE.Group(); v.position.set(W + 5, 0, vz); v.rotation.y = a; q.add(v); h.pose('voitureGaree', peau(col), v); });
        [[W + 8.6, -7, 1], [W + 8.9, -6.2, 0.92], [W + 9, 3, 1.04], [W + 3, 4.5, 0.98]].forEach(([px, pz, t]) => h.pose('passant', { ombre: vitre }, q, [px, 0, pz], t));
        allume(q, i, W + 11, 1, 0xfff0d0, 16, 2); }
      // pts 10-12 : une ligne à haute tension franchit la crête, feux rouges clignotants ; la lueur de la supérette se devine entre les troncs
      const feuPylone = h.mat('feuRouge', LUM), fils = [];
      { const i = at(i10, ic, 0.4), s = S[i], pyl = (sd > 0 ? [-260, -70, 75] : [-75, 70, 260]).map(o => { const p = site(i, Math.sign(o), Math.abs(o), 60); p.rotation.y = h.across(s) + Math.PI / 2; h.pose('pyloneHT', { acier: h.mat('matGris'), feu: feuPylone }, p); p.updateMatrixWorld(); return p; });
        const bouts = pyl.map(p => [[-6.3, 26.7], [6.3, 26.7], [-6.3, 31.7], [6.3, 31.7], [-4.3, 36.7], [4.3, 36.7]].map(([lx, ly]) => p.localToWorld(new THREE.Vector3(lx, ly, 0))));
        for (let k = 0; k + 1 < pyl.length; k++) for (let c = 0; c < 6; c++) { const A = bouts[k][c], Bq = bouts[k + 1][c], f = u => [A.x + (Bq.x - A.x) * u, A.y + (Bq.y - A.y) * u - 36 * u * (1 - u), A.z + (Bq.z - A.z) * u]; // 9 m de flèche
          for (let t = 0; t < 1; t += 1 / 16) fils.push(...f(t), ...f(t + 1 / 16)); }
        const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fils, 3)); h.scene.add(new THREE.LineSegments(fg, new THREE.LineBasicMaterial({ color: 0x4a5058 }))); }
      { const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: h.mat('brume').map, color: 0xbfdcff, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
        halo.position.set(cx, g.hAt(cx, cz) + 8, cz); halo.scale.set(70, 34, 1); h.scene.add(halo); }
      // le retour (pts 41-48) : des jizō à bavoir rouge et leur bougie, puis une cabine téléphonique allumée
      { const i = pt(h, 43), p = site(i, ext(i), W + 2.6, 0.4); h.pose('jizos', { socle: beton, pierre, bavoir: h.mat('laque', { c: 0xc8102e }), bois, toit: h.mat('matGris'), feu: feuDoux }, p); allume(p, i, -0.6, 0.4, 0xffa040, 6, 1.2); }
      { const i = pt(h, 46), p = site(i, ext(i), W + 2.8, 0.4); h.pose('cabine', { socle: beton, verre: h.mat('vitrine', { lum: 1, c: 0xd8ffe0 }), cadre: h.mat('laque', { c: 0x1f8f5a }) }, p); allume(p, i, 0, 2, 0xe0ffe8, 12, 2); }

      const rouge = ville(h, g); // la mégapole en contrebas, à l'ouest des lacets
      return (dt, now) => { cligno.color.setHex((now / 450 & 1) ? 0xff8c1a : 0x3a2008); const r = now % 1500 < 700 ? 0xff2018 : 0x300404; rouge.color.setHex(r); feuPylone.color.setHex(r); eau.map.offset.x += dt * 0.3; };
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
      { // un sol en grille de 16 m ne peut pas épouser le tube (fond du chenal, rampes) : on retire les triangles qui entrent dans le tube ou passent au-dessus de la chaussée des tranchées ; de dehors, on voit la coque
        const ge = h.scene.children[h.scene.children.length - 1].geometry, P = ge.attributes.position.array, I = ge.index.array, zs = [];
        for (let i = T.t0 - 120; i < T.t1 + 120; i++) { const k = (i + N) % N; if (tun(k) || S[k].y < -0.3) zs.push([S[k], tun(k)]); }
        const dedans = (x, y, z, m) => { let b = zs[0], bd = 1e18; for (const e of zs) { const d = (e[0].x - x) ** 2 + (e[0].z - z) ** 2; if (d < bd) { bd = d; b = e; } }
          const [s, t] = b, l = Math.abs((s.x - x) * s.tz - (s.z - z) * s.tx) /* écart en travers */, dy = y - s.y; return bd < (W + 30) ** 2 && l < W + 1.6 + m && (y === null || dy > -0.3 && (!t || dy < 8.5)); };
        for (let k = 0; k < I.length; k += 3) {
          const a = I[k] * 3, b = I[k + 1] * 3, c = I[k + 2] * 3;
          if (!dedans((P[a] + P[b] + P[c]) / 3, null, (P[a + 2] + P[b + 2] + P[c + 2]) / 3, 30)) continue; // loin des tranchées et du tube : rien à tester
          let hors = true;
          for (let u = 0; u <= 6 && hors; u++) for (let v = 0; u + v <= 6; v++) { const w = 6 - u - v, f = j => (P[a + j] * u + P[b + j] * v + P[c + j] * w) / 6; if (dedans(f(0), f(1), f(2), 0)) { hors = false; break; } }
          if (!hors) I[k] = I[k + 1] = I[k + 2] = 0;
        }
        ge.index.needsUpdate = true;
      }
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
          for (let k = Math.max(0, Math.min(vu, n - 1)); k < n; k++) { const haut = k === n - 1, col = rnd() < 0.55 ? dom : rnd() * cols.length | 0; piles[col].push([x + (haut ? (rnd() - 0.5) * 0.5 : 0), g.hAt(x, z) + 1.3 + k * 2.6, z, haut ? (rnd() - 0.5) * 0.05 : 0, rnd() < 0.15 ? 0.5 : 1, 1, 1]); }
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
      // ---------- l'enfilade du port (points 10 à 21) : le port vient jusqu'à la route. Vu de la chaussée, les parcs étaient à 40 m et plus, derrière le muret et le brouillard :
      // un mur de conteneurs de chaque côté, juste derrière le muret, de 2 à 5 de haut avec des brèches sur les parcs ; des projecteurs blancs bas (le blanc dur des quais contre l'orange du sodium) ;
      // et deux portiques de parc qui enjambent la route
      { const i0 = pt(h, 10), n = (pt(h, 21) - i0 + N) % N, grues = []; let gr = 7; const al = () => (gr = gr * 16807 % 2147483647) / 2147483647; // hasard propre : ne décale pas rnd, donc rien du reste du décor
        for (const sd of [-1, 1]) { let br = 0; // br : colonnes qui restent à sauter (une brèche)
          for (let j = 0; j < n; j += 7) { const i = (i0 + j) % N, s = S[i], [x, z] = bord(s, sd, W + 6.5);
            if (j % 140 < 14 || mer(x, z) || g.hAt(x, z) < -1.5 || z < CH1 + 4) continue; // de la place sous les deux portiques (j = 0, 140, 280…), pas dans l'eau
            if (br > 0) { br--; continue; } if (al() < 0.08) { br = 2 + (al() * 3 | 0); continue; }
            const hh = 2 + (al() * 4 | 0), dom = al() * cols.length | 0;
            for (let k = 0; k < hh; k++) piles[al() < 0.6 ? dom : al() * cols.length | 0].push([x, g.hAt(x, z) + 1.3 + k * 2.6, z, h.across(s) + Math.PI / 2 + (al() - 0.5) * 0.04]); }
        }
        for (let j = 420; j < n - 40; j += 280) { const i = (i0 + j) % N, s = S[i]; grues.push([s.x, s.y, s.z, h.across(s)]); } // les portiques, à la place laissée dans le mur ; celui de j = 140 roule (portique mobile, plus bas)
        insts(h, 'grueParc', { structure: h.mat('metalClair', { c: 0xe0b020 }), cabine: h.mat('metalClair', { c: 0xe8e8e4 }), vitre: h.mat('vitreSombre'), roue: h.mat('roue'), machinerie: h.mat('metalClair', { c: 0x8a8e96 }) }, grues, { a: [32] });
        for (let j = 18; j < n; j += 36) { const i = (i0 + j) % N, s = S[i], sd = (j / 36) & 1 ? 1 : -1, [x, z] = bord(s, sd, W + 3.5); // un projecteur tous les 72 m, d'un côté puis de l'autre
          mats35.push([x, g.hAt(x, z), z]); h.lum(i, x - s.tz * sd * -4, s.y + 20, z + s.tx * sd * -4, 0xe8f0ff, 48, 2.2); } }
      piles.forEach((l, i) => inst(h, h.geo('conteneur'), h.mat('tole', { c: cols[i] }), l));
      insts(h, 'matEclairage', { acier: h.mat('acier'), lampe }, mats35);

      // ---------- navires : deux porte-conteneurs à quai, des remorqueurs, des navires au mouillage au large, et deux qui passent dans le chenal au-dessus du tunnel ----------
      const nav = (L, type, coque, cheminee, baies) => ({ carene: minium, coque: h.mat('metalClair', { c: coque }), blanc: cabine, hublots: h.mat('tourFenetres', { lum: 1, fog: false }, ['#ffe2a0', '#f4f1e0']), cheminee: h.mat('metalClair', { c: cheminee }),
        cargaison: h.mat('cargaison'), cale: h.mat('metalClair', { c: 0x8a3a2a }), grueBord: structure, defense: h.mat('defense'), vitre });
      const baies = (L, f) => Array.from({ length: Math.floor((L - 50) / 24) }, () => Math.max(1, Math.min(6, Math.round(f + (rnd() - 0.5) * 3))));
      const feuxNav = [], navire = (L, type, coque, chem, x, z, ry, f = 4) => { const p = new THREE.Group(); p.userData.dyn = 1; p.position.set(x, -3, z); p.rotation.y = ry; h.scene.add(p); h.pose('navire', nav(L, type, coque, chem), p, [0, 0, 0], L, type, type === 'vrac' ? [] : baies(L, f)); return p; };
      for (const [L, x, coque, chem, f] of [[250, -40, 0x1a2a4a, 0xc8442c, 4.5], [200, 690, 0x2a3a2a, 0xe8e4dc, 3]]) { navire(L, 'conteneurs', coque, chem, x, CH1 - 16, 0, f); feuxNav.push(x + L / 2 - 6, 19, CH1 - 16, x - L / 2 + 14, 36, CH1 - 16); }
      const remorqueur = (x, z, ry) => { const p = new THREE.Group(); p.userData.dyn = 1; p.position.set(x, -3, z); p.rotation.y = ry; h.scene.add(p); h.pose('remorqueur', nav(30, '', 0xc8302c, 0x1a1a20), p); return p; };
      remorqueur(830, CH1 - 22, 0.3); remorqueur(860, CH1 - 40, -0.2);
      for (let k = 0; k < 7; k++) { // au mouillage, au sud de l'île : l'avant face au courant, feux de mouillage
        const L = 160 + rnd() * 110, x = -900 + k * 420 + rnd() * 150, z = ILE[2] + 260 + rnd() * 900, ry = 0.6 + (rnd() - 0.5) * 0.3;
        navire(L, k % 3 ? 'vrac' : 'conteneurs', [0x2a1a1a, 0x1a2a4a, 0x3a3a40][k % 3], [0xe8e4dc, 0xc8442c, 0x2c6ab8][k % 3], x, z, ry, 2.5);
        feuxNav.push(x + Math.cos(ry) * L / 2, 12, z - Math.sin(ry) * L / 2, x, 30, z);
      }
      // dans le chenal, sur une boucle : cap à l'est au nord, demi-tour, cap à l'ouest au sud ; le remorqueur suit le premier
      const passants = [[navire(170, 'conteneurs', 0x3a1a2a, 0xf4f0e0, 0, 0, 0, 3.5), 0], [navire(150, 'vrac', 0x1a3a3a, 0xc8442c, 0, 0, 0), 0.25], [navire(190, 'conteneurs', 0x1a2a4a, 0xe8b02c, 0, 0, 0, 4), 0.5], [navire(140, 'ferry', 0xe8e8e4, 0x2c6ab8, 0, 0, 0), 0.75], [remorqueur(0, 0, 0), 0.04]];
      // en face de l'entrée, à quai sur la rive de la ville : un ferry de nuit, tout éclairé, à côté du tube (sa carène descendrait dans le tunnel)
      navire(180, 'ferry', 0xe8e8e4, 0xc8302c, axe + 110, CH0 + 15, Math.PI);
      const BX0 = -1500, BX1 = 1000, BR = 110, BZ = 310, LB = 2 * (BX1 - BX0) + 2 * Math.PI * BR;
      const boucle = (u, p) => { // u de 0 à 1 le long de la boucle
        let d = (u % 1) * LB; const dr = BX1 - BX0, dc = Math.PI * BR;
        if (d < dr) { p.position.set(BX0 + d, -3, BZ + BR); p.rotation.y = 0; return; } d -= dr;
        if (d < dc) { const a = d / BR; p.position.set(BX1 + Math.sin(a) * BR, -3, BZ + Math.cos(a) * BR); p.rotation.y = a; return; } d -= dc;
        if (d < dr) { p.position.set(BX1 - d, -3, BZ - BR); p.rotation.y = Math.PI; return; } d -= dr;
        const a = d / BR; p.position.set(BX0 - Math.sin(a) * BR, -3, BZ - Math.cos(a) * BR); p.rotation.y = Math.PI + a;
      };
      const nf = new THREE.BufferGeometry(); nf.setAttribute('position', new THREE.Float32BufferAttribute(feuxNav, 3));
      const pnav = new THREE.Points(nf, new THREE.PointsMaterial({ color: 0xfff2d0, size: 2, sizeAttenuation: false, fog: false })); pnav.frustumCulled = false; h.scene.add(pnav);

      // ---------- la ville, au nord : tours à fenêtres allumées qui bordent la voie rapide, de plus en plus hautes vers l'intérieur ----------
      const tour = cols2 => h.mat('tourFenetres', LUM, cols2);
      const tm = [tour(['#ffb85a', '#ffd27a']), tour(['#f4f1e0', '#9fd0ff']), tour(['#ffb85a', '#f4f1e0', '#ff7a5a'])], tl = tm.map(() => []);
      for (let gx = g.box[0] + 30; gx < g.box[2] - 30; gx += 58) for (let gz = g.box[1] + 30; gz < CH0 - 60; gz += 58) {
        const x = gx + rnd() * 16, z = gz + rnd() * 16, d = g.dAt(x, z);
        if (d < W + 26 || g.hAt(x, z) < -1.5 || Math.hypot(x - 860, z + 70) < 70) continue; // la place du chantier de la grue (plus bas)
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
      const HR = 78, RR = 70, roueG = new THREE.Group(); roueG.userData.dyn = 1; roueG.position.set(620, g.hAt(620, 40) + HR, 40); roueG.rotation.y = 0.5; h.scene.add(roueG);
      const acierR = h.mat('metalClair', { c: 0xe8ecf4 });
      h.pose('roueSupport', { acier: acierR, socle: h.mat('entrepot') }, roueG, [0, 0, 0], HR);
      const rotor = new THREE.Group(); roueG.add(rotor); h.pose('roueRotor', { jante: acierR, rayon: acierR, moyeu: h.mat('matGris') }, rotor, [0, 0, 0], RR);
      const rp = [], rc = [];
      for (const z of [-4.2, 4.2]) for (let i = 0; i < 48; i++) { const a = i / 48 * 6.283; rp.push(Math.cos(a) * RR, Math.sin(a) * RR, z); rc.push(...[[1, 0.3, 0.6], [0.3, 0.9, 1], [1, 0.9, 0.3]][i % 3]); if (i % 6 === 0) for (let r = 10; r < RR; r += 12) { rp.push(Math.cos(a) * r, Math.sin(a) * r, z); rc.push(1, 1, 1); } }
      const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3)); rg.setAttribute('color', new THREE.Float32BufferAttribute(rc, 3));
      const roue2 = new THREE.Points(rg, new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true, fog: false })); roue2.frustumCulled = false; rotor.add(roue2);
      const NN = 24, nacelles = new THREE.InstancedMesh(h.geo('nacelle'), h.mat('nacelle', LUM, '#e8e8e8'), NN), dn = new THREE.Object3D(); nacelles.frustumCulled = false; roueG.add(nacelles);
      for (let k = 0; k < NN; k++) nacelles.setColorAt(k, new THREE.Color([0xff4a8a, 0x4ac8ff, 0xffd84a, 0x6aff8a][k % 4]));

      // ---------- la longue droite du front de mer (points 0 à 3) : un phare rouge et blanc au bout d'une digue côté chenal, au faisceau qui tourne ; en face, côté ville, une grue de chantier illuminée ----------
      const blancP = h.mat('metalClair', { c: 0xf2f0ea }), rougeP = h.mat('metalClair', { c: 0xc8202a }), PH = [330, 150]; // pied du phare : 150 m au large de la route
      boite(h, beton, 9, 3, PH[1] - 14, PH[0], -1, (PH[1] + 14) / 2); boite(h, beton, 16, 3, 16, PH[0], -1, PH[1]); // la digue et son musoir
      h.pose('phare', { beton, rouge: rougeP, blanc: blancP, acier: gris, lampe: h.mat('lampe', LUM) }, h.scene, [PH[0], 0.5, PH[1]]);
      const feuPhare = new THREE.Group(); feuPhare.userData.dyn = 1; feuPhare.position.set(PH[0], 28.3, PH[1]); h.scene.add(feuPhare);
      const mFais = h.addMat(h.tx('degrade', '#fff2c0', true), { opacity: 0.32 });
      for (const rx of [0, Math.PI / 2]) for (const sd of [-1, 1]) { const b = new THREE.Mesh(h.geo('faisceau'), mFais); b.rotation.set(rx, 0, sd * Math.PI / 2, 'XZY'); b.scale.set(0.35, 0.5, 1); feuPhare.add(b); } // deux pinceaux opposés, chacun en croix pour avoir du volume
      const CG = [880, -60], grueC = new THREE.Group(); grueC.userData.dyn = 1; grueC.position.set(CG[0], g.hAt(CG[0], CG[1]), CG[1]); h.scene.add(grueC);
      const jaune = h.mat('metalClair', { c: 0xe8b020 });
      h.pose('grueTour', { beton, treillis: h.mat('treillis', { alphaTest: 0.5, side: THREE.DoubleSide }, '#e8b020'), acier: jaune, cabine, vitre }, grueC);
      boite(h, beton, 30, 34, 30, CG[0] - 34, g.hAt(CG[0], CG[1]) + 17, CG[1] - 10); // la tour en chantier : un noyau de béton, pas encore de façade
      { const lp = [], lc = []; // guirlande de lampes le long du mât et de la flèche (blanc), lampes rouges en pointe et en bout de flèche
        for (let y = 3; y < 60; y += 2.5) lp.push(1, y, 1), lc.push(1, 0.95, 0.85);
        for (let x = -16; x <= 50; x += 2) lp.push(x, 62, 0), lc.push(1, 0.95, 0.85);
        for (const p of [[0, 69, 0], [50, 62.5, 0], [-17, 62.5, 0]]) lp.push(...p), lc.push(1, 0.1, 0.15);
        const lg2 = new THREE.BufferGeometry(); lg2.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); lg2.setAttribute('color', new THREE.Float32BufferAttribute(lc, 3));
        const pg = new THREE.Points(lg2, new THREE.PointsMaterial({ size: 3, sizeAttenuation: false, vertexColors: true, fog: false })); pg.frustumCulled = false; grueC.add(pg); }

      // ---------- le portique mobile de l'enfilade : un des portiques de parc roule au-dessus de la route, d'avant en arrière (voir l'enfilade, plus haut) ----------
      const iPm = (pt(h, 10) + 142) % N, portM = new THREE.Group(); portM.userData.dyn = 1; h.scene.add(portM);
      h.pose('grueParc', { structure: h.mat('metalClair', { c: 0xe0b020 }), cabine, vitre, roue, machinerie }, portM, [0, 0, 0], 36);
      { const s = S[iPm], [x, z] = bord(s, 1, 18); h.lum(iPm, x, s.y + 22, z, 0xffc040, 40, 1.4); } // gyrophare et éclairage du portique

      // ---------- le péage abandonné (points 30 à 31) : gare sur dalle de part et d'autre du viaduc, guérites éteintes mais vitres au sodium, auvent sur toute la largeur ----------
      { const s = S[near(h, -450, -245)], r = repere(h, s), dalle = h.mat('bitume'), L = 2 * W + 44;
        h.pose('auventPeage', { toit: h.mat('betonGris'), lampe: h.mat('sodium', LUM), acier: gris, enseigne: h.mat('ecrit', LUM, 128, 16, '#3a2a10', '#ffb040', '料金所  TOLL  閉鎖 CLOSED', 11) }, r, [0, 0, 0], L);
        for (const sd of [-1, 1]) { h.pose('boite', dalle, r, [sd * (W + 11.5), -0.6, 0], 21, 1, 36); // la dalle des voies fermées, au niveau de la chaussée
          for (const sz of [-12, 12]) h.pose('boite', beton, r, [sd * (W + 11.5), -s.y / 2 - 1, sz], 3, s.y, 3); // ses piles
          for (const e of [5, 11, 17]) h.pose('guerite', { beton, nez: h.mat('rayures', LUM), cabine: blancP, vitre: h.mat('sodium', LUM) }, r, [sd * (W + e), 0, 0]); }
        h.lum(near(h, -450, -245), s.x, s.y + 7, s.z, 0xffa040, 36, 2.6); }

      // ---------- l'enseigne de love hotel (point 32) : la première lumière rose de la ville, sur un mât au bord du viaduc, devant l'hôtel ----------
      { const i = near(h, -175, -95), s = S[i], [x, z] = bord(s, -1, W + 9), r = repere(h, s); r.position.set(x, s.y - 2, z);
        h.pose('enseigneHotel', { acier: gris, enseigne: h.mat('ecrit', LUM, 128, 52, '#2a0418', '#ff4ab0', 'HOTEL ♥ LOVE', 30), coeur: h.mat('lampe', { lum: 1, c: 0xff3a8a }), vacant: h.mat('ecrit', LUM, 64, 14, '#08200e', '#5aff8a', '空室 VACANT', 10) }, r);
        const [hx, hz] = bord(s, -1, W + 40); boite(h, tour(['#ff4ab0', '#ffb0d8', '#b05aff']), 26, 30, 22, hx, g.hAt(hx, hz) + 14, hz);
        h.lum(i, x, s.y + 14, z, 0xff4ab0, 30, 1.8); }

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
        feuPhare.rotation.y = now * 0.0009; grueC.rotation.y = Math.sin(now * 0.00007) * 0.8; // un tour de phare toutes les 7 s ; la grue pivote lentement
        { const u = iPm + N + Math.sin(now * 0.00025) * 10, j = Math.floor(u), f = u - j, a = S[j % N], b = S[(j + 1) % N]; // ±20 m le long de la route, un aller-retour en 25 s
          portM.position.set(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, a.z + (b.z - a.z) * f); portM.rotation.y = h.across(a); }
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
      const PL = M.place, C = PL.c, RT = PL.r + 6, horsPlace = (x, z) => (x - C[0]) ** 2 + (z - C[1]) ** 2 > (PL.r + 1) ** 2; // la place : centre, pied des façades
      const IY = 1.5, WY = -8, rive = x => x > 180 && x < 820 ? 262 : 248; // niveau de la Seine ; sa rive : au ras des voies sur berge, en retrait du tunnel qui passe dessous
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
        ruelle: { recul: 1, H: [9, 15], arbres: [], gare: 0 }, quai: { recul: 6.5, H: [20, 24], arbres: [], gare: 1 }, berge: { recul: 16, H: [26, 30], arbres: [], gare: 0 }, place: { recul: 6, H: [26, 28], arbres: [], gare: 0 } };
      const type = new Array(N).fill('rue'), rues = M.th.rues.map(([p, t]) => [pt(h, p), t]).sort((a, b) => a[0] - b[0]);
      rues.forEach(([i0, t], k) => { const i1 = k + 1 < rues.length ? rues[k + 1][0] : N; for (let i = i0; i < i1; i++) type[i] = t; });
      for (let i = 0; i < rues[0][0]; i++) type[i] = rues[rues.length - 1][1];
      const troncs = [], houp = [], mats = [], lant = [], autos = [[], [], [], []], boutiques = [], anneaux = [];
      // la descente de la butte (points 19 à 23) : façades d'autres teintes, l'escalier de la butte à droite au point 20 (un immeuble en moins), la boulangerie à gauche au point 21
      const iD0 = pt(h, 19), iD1 = pt(h, 23), iE = pt(h, 20) >> 3 << 3, iB = pt(h, 21) >> 3 << 3, sdE = 1, sdB = -1;
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
        } else if (!tun && type[i] !== 'place') for (const sd of [-1, 1]) {
          const dans = s => !horsPlace(...bord(s, sd, s.w + gb)); // dans le cercle de la place : pas de trottoir, on y roule
          ruban(i, j - i, s => sd * (s.w + gb), 0.22, s => dans(s) ? sd * (s.w + gb) : sd * (s.w + t.recul + 0.5), 0.22, dalle); ruban(i, j - i, s => sd * (s.w + gb), 0.22, s => sd * (s.w + gb), s => dans(s) ? 0.22 : -0.6, bordure);
          if (gb) ruban(i, j - i, s => sd * s.w, 0.01, s => sd * (s.w + gb), 0.01, bitume);
        }
        i = j;
      }
      // ---- la place : un grand cercle pavé où l'on roule partout, l'arc de triomphe au milieu : on le contourne en glisse ou on passe dessous
      const large = S.map((s, i) => i).filter(i => S[i].w > W + 0.05), paves = h.mat('paves', { side: THREE.DoubleSide });
      ruban(large[0], large[large.length - 1] - large[0], s => -s.w, 0.02, s => s.w, 0.02, paves);
      // le choix de la place : la chaussée du tour (bitume, sim.js : sec) en fait le grand tour ; couper par l'arche, entre les piles, c'est plus court mais sur les pavés (surf.large).
      // La bande de bitume et ses lignes de rive blanches se lisent par-dessus les pavés
      { const ofs = { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }, i0 = large[0] - 20, l = large[large.length - 1] - large[0] + 40;
        ruban(i0, l, () => -W, 0.02, () => W, 0.02, h.mat('bruit', ofs, '#4a4a52', ['#56565e', '#424248']));
        for (const sd of [-1, 1]) ruban(i0, l, () => sd * (W - 0.15), 0.02, () => sd * (W - 0.45), 0.02, h.mat('bruit', ofs, '#e8e4d8', ['#f4f0e4', '#d8d4c8'])); }
      // le sol de la place en cases de 2 m : pavés partout dans le cercle où l'on roule, trottoir étroit au pied des façades, sauf où partent les avenues
      { const pres = S.filter(s => (s.x - C[0]) ** 2 + (s.z - C[1]) ** 2 < 260 ** 2), loin = (x, z) => { let m = 1e9; for (const s of pres) m = Math.min(m, Math.hypot(s.x - x, s.z - z) - s.w); return m; }; // distance au bord de la chaussée
        const roule = [[], [], []], pied = [[], [], []];
        for (let r = PL.ile[0]; r < RT + 6; r += 2) { // (le terre-plein, au milieu, a son propre dallage)
          const n = Math.max(6, Math.ceil(6.2832 * r / 2)); for (let k = 0; k < n; k++) {
          const a0 = k / n * 6.2832, a1 = (k + 1) / n * 6.2832, P = [[r, a0], [r + 2, a0], [r + 2, a1], [r, a1]].map(([rr, a]) => [C[0] + Math.cos(a) * rr, C[1] + Math.sin(a) * rr]), e = r < PL.r - 2 ? 0 : Math.min(...P.map(q => loin(...q)));
          const L = r < PL.r || e < 0.3 ? roule : pied; P.forEach(([x, z]) => { L[0].push(x, 0, z); L[1].push(x / 4, z / 4); }); const v = L[0].length / 3 - 4; L[2].push(v, v + 2, v + 1, v, v + 3, v + 2); } }
        roule[0].forEach((v, i) => { if (i % 3 === 1) roule[0][i] = 0.02; }); pied[0].forEach((v, i) => { if (i % 3 === 1) pied[0][i] = 0.22; });
        nappe(...roule, paves); nappe(...pied, dalle); }
      // ---- la sortie de la place vers l'avenue (point 7 vers 8) : on la voyait mal et l'on tapait le coin du trottoir à gauche. Des chevrons blancs peints sur les pavés le long de la trajectoire,
      // puis deux lignes de rive qui dessinent l'entonnoir jusque dans l'avenue (M.large l'élargit aussi : 22 m au lieu de 14 au débouché)
      { const peinture = h.mat('bruit', { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, '#f2eee2', ['#ffffff', '#dcd8cc']);
        const iS = pt(h, 7), rang = new Map(S.map((s, i) => [s, i])), K = 4, L = 4.5, e = 1.8; // un chevron : deux bras qui partent à 4,5 m de la trajectoire et se rejoignent 8 m plus loin, la pointe vers la sortie
        for (let c = -7; c <= 0; c++) { const i0 = (iS + c * 10 + N) % N, dl = S[(i0 + K) % N].dl, f = s => 1 - ((rang.get(s) - i0 + N) % N) / K;
          ruban(i0, K, s => dl + L * f(s), 0.05, s => dl + L * f(s) - e, 0.05, peinture); ruban(i0, K, s => dl - L * f(s) + e, 0.05, s => dl - L * f(s), 0.05, peinture); }
        for (const sd of [-1, 1]) ruban(iS, 70, s => sd * (s.w - 0.4), 0.05, s => sd * (s.w - 1.2), 0.05, peinture); }
      // l'arc au milieu, grande arche dans l'axe de la traversée ; ses piles sont des obstacles (sim.js). Sa pierre est mise en lumière, dorée, comme à l'aube : on le voit du bout des avenues,
      // c'est le repère de la place (gris comme les façades, il s'y perdait)
      const dore = m => { m.emissive.setHex(0xffb860); m.emissiveMap = m.map; m.emissiveIntensity = 0.5; return m; };
      h.pose('arc', { pierre: dore(h.mat('pierre')), relief: dore(h.mat('basRelief')) }, h.scene, [C[0], 0.02, C[1]]).forEach(m => m.rotation.y = PL.a);
      // ---- le terre-plein de l'arc (sim.js : place.ile) : dallage de granit clair, étoile à douze branches en pavés roses, cent bornes de granit reliées par des chaînes,
      // ouvertes dans l'axe de la grande arche ; sous l'arche, la dalle et la flamme ; dix candélabres. L'anneau de chaussée autour reste nu : c'est là qu'on glisse.
      { const [RI, OUV] = PL.ile, A0 = Math.PI / 2 - PL.a, cs = Math.cos(PL.a), sn = Math.sin(PL.a), P2 = (r, a) => [C[0] + Math.cos(a) * r, C[1] + Math.sin(a) * r];
        const ferme = a => Math.abs(RI * (Math.cos(a) * cs - Math.sin(a) * sn)) > OUV; // hors de l'ouverture (même calcul que sim.js)
        couronne(C[0], C[1], 0, RI, 0.02, 72, h.mat('granit', { side: THREE.DoubleSide }));
        const et = [[], [], []]; for (let k = 0; k < 12; k++) { const a = A0 + k * Math.PI / 6; for (const [r, b] of [[28, a - Math.PI / 12], [28, a + Math.PI / 12], [46, a]]) { const [x, z] = P2(r, b); et[0].push(x, 0.04, z); et[1].push(x / 4, z / 4); } et[2].push(3 * k, 3 * k + 1, 3 * k + 2); }
        nappe(...et, h.mat('paves', { c: 0xf0b0a0, side: THREE.DoubleSide }));
        const bornes = [], chaines = [], n = 100, pas = 6.2832 / n;
        for (let k = 0; k < n; k++) { const a = A0 + (k + 0.5) * pas; if (!ferme(a)) continue; const [x, z] = P2(RI, a); bornes.push([x, 0.02, z, -a]);
          if (ferme(a + pas)) { const [mx, mz] = P2(RI * Math.cos(pas / 2), a + pas / 2); chaines.push([mx, 0.62, mz, Math.PI / 2 - a - pas / 2, 2 * RI * Math.sin(pas / 2), 0.07, 0.07]); } }
        insts(h, 'borne', { pierre: h.mat('pierre') }, bornes); inst(h, h.geo('bloc'), h.mat('fonte'), chaines);
        h.pose('flamme', { bronze: h.mat('peinture', { c: 0x4a3c22 }), feu: h.mat('peinture', { lum: 1, c: 0xffa030 }) }, h.scene, [C[0], 0.02, C[1]]).forEach(m => m.rotation.y = PL.a);
        const iP = large[large.length >> 1]; h.lum(iP, C[0], 2.5, C[1], 0xff8a30, 34, 2); // la flamme éclaire le dessous de la voûte
        for (const sd of [-1, 1]) for (let k = 1; k <= 5; k++) { const [x, z] = P2(RI - 2.5, A0 + sd * k * Math.PI / 6); mats.push([x, 3.5, z]); lant.push([x, 7.1, z]); if (k % 2 === 0) h.lum(iP, x, 6.6, z, 0xffd05a, 15, 1.6); } }
      // ---- le trottoir de la place, entre le mur et les façades : platanes, bancs, colonnes Morris, bouches de métro, un kiosque ; rien là où partent les avenues
      const kqPlace = [], bancs = [], morris = [], metros = [];
      { let n = 0; const pas = 9 / (PL.r + 2.2);
        for (let a = pas / 2; a < 6.2832; a += pas) { const x = C[0] + Math.cos(a) * (PL.r + 2.2), z = C[1] + Math.sin(a) * (PL.r + 2.2), [d, s] = proche(x, z); if (d < s.w + 1.5) continue; // (sur la chaussée d'une avenue)
          const P2 = (r, b = a) => [C[0] + Math.cos(b) * r, 0.22, C[1] + Math.sin(b) * r, -b - Math.PI / 2], k = n++; // posé sur le trottoir, face à l'arc
          if (k % 27 === 13) metros.push(P2(PL.r + 3)); else if (k % 20 === 8) morris.push(P2(PL.r + 2.2)); else if (k === 45) kqPlace.push(P2(PL.r + 3.6)); else { troncs.push([x, 2.82, z]); houp.push([x, 7.82, z, k * 1.7, 1, 0.9, 1]); }
          if (k % 5 === 2) bancs.push(P2(PL.r + 4.8, a + pas / 2)); } }
      const fm = ['#d9c9a8', '#cfc0a0', '#e0d4b8', '#e8cfa0', '#c8b4a8', '#d8c8a0'].map(p => h.mat('facadeParis', {}, p)), lots = fm.map(() => []); // les trois dernières : la descente de la butte
      const fb = ['#e8dcc0', '#d8c8b0'].map(p => h.mat('facadeParis', {}, p, 1)), bas = fb.map(() => []); // maisons basses de la butte
      for (let i = 0; i < N; i += 2) {
        const s = S[i], t = TYPES[type[i]], ry = h.across(s), tun = h.zone(i, 14) > 0;
        for (const sd of [-1, 1]) {
          const [qx, qz] = bord(s, sd, W + 12), fleuve = quai(qx, qz) || quai(qx, qz + 14);
          if (i % 8 === 0 && !tun && !fleuve) { // un immeuble tous les 16 m, au recul de la rue ; pas sur la trémie, ni côté fleuve, ni là où une autre rue passe
            const [x, z] = bord(s, sd, s.w + t.recul + 7.5), ruelle = type[i] === 'ruelle';
            if (g.dAt(x, z) > s.w + t.recul + 6.5 && (x - C[0]) ** 2 + (z - C[1]) ** 2 > (RT + 14) ** 2) { const H = t.H[0] + rnd() * (t.H[1] - t.H[0]), k3 = rnd() * 3 | 0, desc = i >= iD0 && i <= iD1;
              (i === iE && sd === sdE ? [] : ruelle ? bas[k3 % 2] : lots[k3 + (desc ? 3 : 0)]).push([x, g.hAt(x, z) + H / 2 - 3, z, ry, 17, H + (desc ? k3 * 4 : 6), 14]); // (même tirage qu'avant : le reste du décor ne bouge pas ; dans la descente, des hauteurs qui varient)
              if (type[i] !== 'berge' && al() < (i < h.T.sp[0] ? 0.3 : i < h.T.sp[1] ? 0.6 : 0.25) && !(i === iB && sd === sdB) && !(i === iE && sd === sdE)) { const [fx, fz] = bord(s, sd, s.w + t.recul - 1.05); boutiques.push([fx, s.y + 0.22, fz, ry - sd * 1.5708, t.recul]); } } // un commerce en rez-de-chaussée : quelques-uns partout, plus au secteur 2
          }
          if (i % 10 === 0 && !tun && type[i] !== 'berge') for (const off of fleuve ? [2.4] : t.arbres) { const [x, z] = bord(s, sd, s.w + off); if (g.dAt(x, z) > s.w + off - 1.5 && (x - C[0]) ** 2 + (z - C[1]) ** 2 > (RT + 4) ** 2) { troncs.push([x, s.y + 2.6, z]); houp.push([x, s.y + 7.6, z, rnd() * 6, 1, 0.9, 1]); } } // platanes : en rangées sur les grands axes, le long du fleuve sur le quai
          if (t.gare && !tun && !fleuve && s.w < W + 0.3 && i > 30 && i < N - 34 && i % 4 === 0 && rnd() < (t.gare > 1 ? 0.8 : 0.55)) { const [x, z] = bord(s, sd, s.w + 1.7); if (horsPlace(x, z)) autos[rnd() * 4 | 0].push([x, s.y, z, ry + 1.5708]); } // voitures en stationnement
        }
        if (i % 10 === 0 && h.zone(i, 6) === 0) { const sd = (i / 10) & 1 ? 1 : -1, [x, z] = bord(s, sd, s.w + (t.gare ? 3.6 : 0.6)); if (horsPlace(x, z)) { mats.push([x, s.y + 3.4, z]); lant.push([x, s.y + 7, z]); h.lum(i, x, s.y + 6.5, z, 0xffd05a, 15, 1.6); } } // réverbères, allumés jusqu'au lever du jour
      }
      // la couronne d'immeubles qui ferme la place, façades tournées vers l'arc ; une avenue part là où passe la piste
      for (let a = 0; a < 6.2832; a += 17.5 / RT) { const x = C[0] + Math.cos(a) * (RT + 7), z = C[1] + Math.sin(a) * (RT + 7), [d, s] = proche(x, z);
        if (d > s.w + 10) { const H = 26 + al() * 3; lots[al() * 3 | 0].push([x, g.hAt(x, z) + H / 2 - 3, z, Math.atan2(-Math.sin(a), Math.cos(a)), 14, H + 6, 17.4]); } }
      for (let k = 0; k < 420; k++) { // et la ville derrière : des toits à perte de vue
        const x = g.box[0] + rnd() * (g.box[2] - g.box[0]), z = g.box[1] + rnd() * (g.box[3] - g.box[1]), d = g.dAt(x, z);
        if (d > 52 && !quai(x, z - 30) && (x - C[0]) ** 2 + (z - C[1]) ** 2 > (RT + 22) ** 2) { const H = 18 + rnd() * 8; lots[k % 3].push([x, g.hAt(x, z) + H / 2 - 3, z, (rnd() * 4 | 0) * 1.5708 + rnd() * 0.3, 16 + rnd() * 14, H + 6, 14 + rnd() * 10]); }
      }
      // l'île de la Cité, à gauche à la sortie du tunnel : quais de pierre, la cathédrale (chevet tourné vers l'arrivée, flanc sud et sa rose face à la route, tours au bout),
      // un square planté derrière le chevet, des immeubles à la pointe ouest
      const IX = 30, IZ = 318;
      h.pose('ile', { quai: h.mat('pierre'), sol: dalle }, h.scene, [IX, 0, IZ], 380, 96, WY - 1, IY);
      h.pose('cathedrale', { mur: h.mat('murGothique'), pierre: h.mat('pierre', {}, '#e0d4bc'), plomb: h.mat('plomb'), rose: h.mat('rose'), sombre: h.mat('matGris') }, h.scene, [IX + 10, IY, IZ]);
      for (let x = 120; x <= 200; x += 16) for (let z = IZ - 30; z <= IZ + 30; z += 15) { troncs.push([x, IY + 2.6, z]); houp.push([x, IY + 7.6, z, al() * 6, 1, 0.9, 1]); }
      for (let x = -150; x <= 110; x += 18) for (const z of [IZ - 43, IZ + 43]) { troncs.push([x, IY + 2.6, z]); houp.push([x, IY + 7.6, z, al() * 6, 1, 0.9, 1]); }
      for (const x of [-140, -112]) for (const z of [IZ - 26, IZ + 26]) { const H = 20 + al() * 4; lots[al() * 3 | 0].push([x, IY + H / 2 - 3, z, 0, 26, H + 6, 22]); }
      // la rive d'en face : quai de pierre, platanes, trois rangs d'immeubles face au fleuve
      for (const [x0, x1, z0] of [[300, 1450, 400], [-260, 300, 425]]) {
        h.pose('rive', { quai: h.mat('pierre'), sol: dalle }, h.scene, [(x0 + x1) / 2, 0, (z0 + 990) / 2], x1 - x0, 990 - z0, WY - 1, IY);
        for (let x = x0 + 10; x < x1 - 8; x += 17.5) { for (let r = 0; r < 3; r++) if (!r || al() < 0.8) { const H = 20 + al() * 6; lots[al() * 3 | 0].push([x + (r ? al() * 4 - 2 : 0), IY + H / 2 - 3, z0 + 16 + r * 24, 0, 17, H + 6, 14]); }
          if ((x - x0) % 35 < 17.5) { troncs.push([x, IY + 2.6, z0 + 5]); houp.push([x, IY + 7.6, z0 + 5, al() * 6, 1, 0.9, 1]); } }
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
      // les commerces : devanture à enseigne (noms inventés) ; store rayé sur les cafés, boulangeries, fromageries, fleuristes ; terrasse devant les cafés
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
      const kq = [...kqPlace]; for (const [i, sd] of [[h.T.sp[1] - 60, -1], [h.T.sp[1] - 24, 1]]) { const s = S[i], [x, z] = bord(s, sd, s.w + 4.6); kq.push([x, s.y + 0.22, z, h.across(s) - sd * 1.5708]); } // entre les voitures garées et la rangée d'arbres
      insts(h, 'banc', { vert: h.mat('peinture', { c: 0x1e4a36 }), fer: h.mat('fonte') }, bancs);
      insts(h, 'colonneMorris', { corps: h.mat('affiches'), toit: h.mat('peinture', { c: 0x1e4a36 }), fer: h.mat('fonte') }, morris);
      insts(h, 'boucheMetro', { fer: h.mat('peinture', { c: 0x1e4a36 }), trou: h.mat('peinture', { c: 0x121216 }), panneau: h.mat('ecrit', LUM, 64, 22, '#a01818', '#f4e8c0', 'METRO', 14), lampe: h.mat('lanterne', LUM) }, metros);
      insts(h, 'kiosque', { corps: h.mat('kiosque'), toit: h.mat('peinture', { c: 0x1e4a36 }), comptoir: h.mat('fonte') }, kq);
      // voies sur berge : anneaux d'amarrage, péniches le long du quai ; le pont de pierre qui passe sur l'entrée du tunnel et traverse la Seine
      insts(h, 'anneau', { fer: h.mat('fonte') }, anneaux);
      const pen = [1432, 1480, 1848, 1898].map(i => { const s = S[i], [x, z] = bord(s, -1, s.w + 3.5); return [x, WY, z, h.across(s) + 1.5708, 1, 1, 1, [0x2a2a30, 0x2a4a6a, 0x5a2020, 0x2a4a32][i % 4]]; }); // à couple contre le mur de quai
      insts(h, 'peniche', { coque: h.mat('acier'), liston: h.mat('peinture', { c: 0xe8e0d0 }), pont: h.mat('bruit', {}, '#7a5a3a', ['#6a4a2a', '#8a6a4a']), roof: h.mat('roof'), toit: h.mat('matGris'),
        plantes: h.mat('feuillage') }, pen, { teinte: 'coque' });
      { const s = S[h.T.t0], gp = repere(h, s); h.pose('pont', { pierre: h.mat('pierre'), tablier: h.mat('paves'), fer: h.mat('fonte'), lampe: h.mat('lanterne', LUM) }, gp, [0, 0, 0], 170, WY - s.y);
        // la tête du tunnel sous le pont : mur de pierre percé, arc de décharge à claveaux, plaque du souterrain (comme les trémies des voies sur berge)
        h.pose('teteTunnelParis', { pierre: h.mat('pierre'), claveau: h.mat('pierre', {}, '#a89878'), plaque: h.mat('ecrit', {}, 128, 16, '#1d2f6f', '#f4f0e0', 'SOUTERRAIN DES QUAIS', 13) }, gp, [0, 0, 0], WY - s.y); }
      // le dôme blanc en haut de la butte
      const craie = h.mat('craie'), yb = g.hAt(935, -598);
      h.pose('basilique', { craie }, h.scene, [935, yb, -598]);
      h.pose('dome', craie, h.scene, [935, yb + 24, -596], 13, 8, 5).scale.y = 1.5;
      for (const sx of [-15, 15]) h.pose('dome', craie, h.scene, [935 + sx, yb + 24, -588], 5, 6, 4).scale.y = 1.5;
      // ---- repères de la butte. Feux tricolores en haut (point 19), des deux côtés, l'un en potence au-dessus de la voie : là où l'on freine avant la descente
      const allume = c => h.mat('peinture', { lum: 1, c }), feu = { vert: allume(0x30ff70), orange: allume(0xffa020), rouge: allume(0xff2a1a) }, FEUX = [[0x30ff70, 0x063a14], [0xffa020, 0x3a2406], [0xff2a1a, 0x3a0806]];
      { const s = S[iD0 - 6], gf = repere(h, s); for (const sd of [-1, 1]) h.pose('feuTricolore', { fer: h.mat('fonte'), boitier: h.mat('peinture', { c: 0x1e2a22 }), ...feu }, gf, [sd * (s.w + 0.8), 0.22, 0], -sd * 4.5); }
      // l'escalier de la butte qui monte entre deux immeubles, un réverbère en bas et un en haut
      { const s = S[iE], ox = -s.tz * sdE, oz = s.tx * sdE, [x, z] = bord(s, sdE, s.w + 3.7), rv = [], ln = [];
        h.pose('escalierButte', { marche: h.mat('pierre', {}, '#b8b0a0'), muret: h.mat('pierre'), fer: h.mat('fonte') }, h.scene, [x, s.y + 0.22, z]).forEach(m => m.rotation.y = Math.atan2(-ox, -oz));
        for (const [k, dy] of [[-0.6, 0], [8.4, 3.74]]) { const px = x + ox * k + s.tx * 2.3, pz = z + oz * k + s.tz * 2.3; rv.push([px, s.y + 0.22 + dy + 3.2, pz]); ln.push([px, s.y + 0.22 + dy + 6.8, pz]); h.lum(iE, px, s.y + dy + 6.5, pz, 0xffd05a, 15, 1.6); }
        inst(h, h.geo('reverbere'), h.mat('fonte'), rv); inst(h, h.geo('lanterne'), h.mat('lanterne', LUM), ln); }
      // la boulangerie qui lève son rideau de fer quand on arrive : devanture, store, la lumière du fournil
      const rideau = (() => { const s = S[iB], [fx, fz] = bord(s, sdB, s.w + TYPES.rue.recul - 1.05), ry = h.across(s) - sdB * 1.5708, P = [fx, s.y + 0.22, fz, ry], sn = Math.sin(ry), cs = Math.cos(ry);
        inst(h, h.geo('devanture'), h.mat('devanture', {}, ...GENRES[1]), [P]); insts(h, 'store', { toile: h.mat('toileRayee', { side: THREE.DoubleSide }), fer: h.mat('fonte') }, [[...P, 1, 1, 1, 0x2a5a8a]], { teinte: 'toile' });
        const tole = h.mat('tole'), r = new THREE.Mesh(h.habille(h.geo('rideau'), tole), tole); r.position.set(fx + sn * 0.55, s.y + 0.22 + 3.5, fz + cs * 0.55); r.rotation.y = ry; h.scene.add(r);
        h.lum(iB, fx + sn * 1.5, s.y + 2.5, fz + cs * 1.5, 0xffc070, 10, 1.4); return r; })();
      // le livreur de journaux à vélo qui descend la butte sur le trottoir de droite
      const velo = new THREE.Group(); h.scene.add(velo); let uV = iD0;
      h.pose('livreur', { pneu: h.mat('pneu'), cadre: h.mat('peinture', { c: 0x1a4a8a }), tenue: h.mat('peinture', { c: 0x3a3a44 }), peau: h.mat('peinture', { c: 0xd8a888 }), journaux: h.mat('peinture', { c: 0xe8e0c8 }) }, velo, [0, 0, 0]);
      // ---- le quai : des pigeons posés sur la chaussée qui s'envolent quand on arrive, avant le souterrain (points 26-27) et à sa sortie (30-31)
      const vols = [pt(h, 26) + 30, pt(h, 26) + 80, h.T.t1 + 30, h.T.t1 + 75].map(i0 => ({ i0, en: 0, t: 0, p: Array.from({ length: 12 }, () => { const s = S[i0 + (al() * 8 | 0)], d = al() * 10 - 5;
        return { x: s.x - s.tz * d, y: s.y, z: s.z + s.tx * d, r: al() * 6.28, vx: al() * 6 - 3, vy: 3 + al() * 3, vz: al() * 6 - 3 }; }) }));
      const pig = insts(h, 'pigeon', { plume: h.mat('peinture', { c: 0x7a7c84 }), tete: h.mat('peinture', { c: 0x4a5058 }) }, vols.flatMap(v => v.p.map(q => [q.x, q.y, q.z, q.r])));
      const dp = new THREE.Object3D(), posePig = (k, x, y, z, r, e) => { dp.position.set(x, y, z); dp.rotation.set(0, r, 0); dp.scale.setScalar(e); dp.updateMatrix(); for (const m of pig) m.setMatrixAt(k, dp.matrix); };
      // ---- le camion de livraison garé en double file à la sortie du souterrain (obstacle de sim.js : T.cam), d'un côté aux tours impairs, de l'autre aux tours pairs ; feux de détresse
      const cam = h.T.cam, sCam = S[cam.i], gc = new THREE.Group(), detresse = h.mat('peinture', { lum: 1, c: 0xffa020 }); h.scene.add(gc); gc.position.y = sCam.y; gc.rotation.y = Math.atan2(-sCam.tz, sCam.tx);
      h.pose('camionLivraison', { caisse: h.mat('ecrit', {}, 128, 64, '#e8ecf0', '#1d2f6f', 'LES HALLES', 20), chassis: h.mat('matGris'), cabine: h.mat('laque', { c: 0xe8e4dc }), vitre: h.mat('vitreSombre'), pneu: h.mat('pneu'),
        orange: detresse, rouge: h.mat('feuRouge', LUM) }, gc, [0, 0, 0]);
      return (dt, now, car) => {
        if (!car) return;
        const [cx, cz] = bord(sCam, Math.floor(car.dist / N) & 1 ? 1 : -1, cam.d); gc.position.x = cx; gc.position.z = cz; // même règle que camion() de sim.js, pour la voiture suivie
        detresse.color.setHex(now % 800 < 400 ? 0xffa020 : 0x3a2008);
        const ph = now / 1000 % 12, on = [ph < 7, ph >= 7 && ph < 9, ph >= 9]; ['vert', 'orange', 'rouge'].forEach((f, k) => feu[f].color.setHex(FEUX[k][on[k] ? 0 : 1])); // vert 7 s, orange 2 s, rouge 3 s
        const a = (iB - car.idx + N) % N; rideau.scale.y = a < 80 ? Math.max(0.06, a / 80) : a > N - 200 ? 0.06 : 1; // il remonte à l'approche, reste levé après le passage
        uV += dt * 3; if (uV > iD1) uV = iD0; const s = S[uV | 0], [vx, vz] = bord(s, 1, s.w + 1.6); velo.position.set(vx, s.y + 0.22, vz); velo.rotation.y = Math.atan2(-s.tz, s.tx);
        let k = 0, bouge = 0; for (const v of vols) { const e = (v.i0 - car.idx + N) % N;
          if (!v.en && e < 22 && e > 0) { v.en = 1; v.t = 0; } else if (v.en && e > 300 && e < N - 300) { v.en = 0; v.p.forEach((q, j) => posePig(k + j, q.x, q.y, q.z, q.r, 1)); bouge = 1; } // reposés pour le tour suivant
          if (v.en && v.t < 5) { v.t += dt; const t = v.t; v.p.forEach((q, j) => posePig(k + j, q.x + q.vx * t, q.y + q.vy * t + 0.3 * t * t, q.z + q.vz * t, Math.atan2(-q.vz, q.vx), t < 4.5 ? 1 : 0)); bouge = 1; }
          k += v.p.length; }
        if (bouge) for (const m of pig) m.instanceMatrix.needsUpdate = true;
      };
    },

    // ---------- Canal 6 : le lit bétonné est devenu un grand ovale à l'américaine. Anneau de tribunes géantes pleines de monde, grillages, stands au départ,
    // tour de chronométrage, écrans du classement, parkings pleins et camping-cars dehors, dirigeable ; projecteurs sur la piste au couchant ----------
    canal(h) {
      const { THREE, S, N, W, rnd, T } = h;
      const net = m => { m.map.anisotropy = 8; return m; }; // textures vues en rasant (gazon, gradins, grillage) : filtrage anisotrope, sinon elles bavent
      const g = terrain(h, { pas: 16, marge: 340, mat: net(h.mat('gazon')) });
      // fresques fléchées : sur un mur de 5 m à l'extérieur des courbes, des chevrons peints dans le sens du virage
      const fresque = flip => h.mat('fresque', { lum: 1, side: THREE.DoubleSide }, flip);
      const dummy = new THREE.Object3D(), murs = [0, 1].map(f => new THREE.InstancedMesh(h.geo('murFresque'), fresque(f), 400)), cnt = [0, 0], balA = [], balB = [], apex = [];
      for (let i = 0; i < N; i++) {
        const s = S[i], k = s.k; if (Math.abs(k) < 0.0045) continue;
        const f = k > 0 ? 0 : 1, sd = k > 0 ? -1 : 1; // l'extérieur est à gauche d'un virage à droite
        if (i % 8 === 0 && cnt[f] < 400) { const [x, z] = bord(s, sd, s.w + 1.6); dummy.position.set(x, s.y + 2.5, z); dummy.lookAt(s.x, s.y + 2.5, s.z); dummy.updateMatrix(); murs[f].setMatrixAt(cnt[f]++, dummy.matrix); }
        if (i % 4 === 0) { const [x, z] = bord(s, sd, s.w + 0.5); (i % 8 ? balA : balB).push([x, s.y + 4.4, z]); } // balises hautes, une sur deux blanche, l'autre rose
        if (Math.abs(k) > Math.abs(S[(i + N - 1) % N].k) && Math.abs(k) >= Math.abs(S[(i + 1) % N].k) && Math.abs(k) > 0.008) apex.push([i, sd]);
      }
      murs.forEach((m, f) => { m.count = cnt[f]; m.frustumCulled = false; h.scene.add(m); });
      inst(h, h.geo('balise'), h.mat('peinture', { lum: 1, c: 0xf4f0e0 }), balA); inst(h, h.geo('balise'), h.mat('peinture', { lum: 1, c: 0xe83f8c }), balB);
      // panneaux des sponsors du meeting (inventés) : un mât de 24 m au point de corde extérieur de chaque courbe
      const pubs = [['SOLAR COLA', '#c8102e', '#f4f0e0'], ['DUSK RADIO', '#3d2a5c', '#ffc04a'], ['PALM TIRES', '#1848c8', '#f4f0e0'], ['RANCHO', '#f4f0e0', '#1a1420'], ['NITRO TACO', '#2aa39a', '#f4f0e0'], ['CANAL 6', '#1a1420', '#ff7a3d']].map(([t, a, b]) => h.mat('ecrit', LUM, 64, 32, a, b, t, 11));
      const fer = h.mat('fer'), acier = h.mat('acier'), beton = h.mat('beton'), lampe = h.mat('lampe', LUM);
      apex.forEach(([i, sd], k) => h.pose('panneauPub', { mat: fer, affiche: pubs[k % pubs.length] }, repere(h, S[i]), [sd * (S[i].w + 9), 0, 0], sd * 0.5));
      // grillage de protection au-dessus des murets, des deux côtés, sur tout le tour ; poteaux tous les 6 échantillons
      const cO = N - (T.t1 - T.t0), grille = net(h.mat('grillage', { alphaTest: 0.5, side: THREE.DoubleSide }));
      for (const sd of [-1, 1]) h.ribbon(T.t1, cO, s => sd * (s.w + 0.1), h.TH.murH + 4.2, s => sd * (s.w + 0.1), h.TH.murH - 0.1, grille, 4);
      const pot = []; for (let i = 0; i < N; i += 6) for (const sd of [-1, 1]) { const [x, z] = bord(S[i], sd, S[i].w + 0.2); pot.push([x, S[i].y + h.TH.murH + 2.1, z, 0, 1, 0.86, 1]); }
      inst(h, h.geo('poteauGrillage'), acier, pot);

      // --- les tribunes suivent la piste par l'extérieur, sans trou : un module de 14 m tous les 7 échantillons. Il s'élargit à l'extérieur des courbes
      // pour refermer l'éventail, et perd de la profondeur (75 %, 50 %) là où une autre portion de piste passe derrière ; un sur quatre porte un mât ---
      const trib = [[], []], PAS = 7, PROF = 53;
      const pied = i => { const s = S[i % N]; return [...bord(s, -1, s.w + 12), s.tz, -s.tx]; }; // façade et direction du fond (côté gauche = extérieur de l'ovale)
      for (let i = 0, k = 0; i < N; i += PAS, k++) {
        const [x, z, ox, oz] = pied(i), sc = [1, 0.75, 0.5].find(c => [0, 0.35, 0.7, 1].every(f => g.dAt(x + f * PROF * c * ox, z + f * PROF * c * oz) > W + 9));
        if (!sc || ![-7, 7].every(u => g.dAt(x + u * oz, z - u * ox) > W + 9)) continue;
        const [x2, z2, ox2, oz2] = pied(i + PAS), large = Math.max(1, Math.hypot(x2 + 40 * sc * ox2 - x - 40 * sc * ox, z2 + 40 * sc * oz2 - z - 40 * sc * oz) / 14 + 0.05);
        const y = Math.min(g.hAt(x, z), g.hAt(x + 20 * sc * ox, z + 20 * sc * oz)) - 0.6, mat = k % 4 === 0 ? 1 : 0;
        trib[mat].push([x, y, z, Math.atan2(ox, oz), large, sc, sc]);
        if (mat) { const s = S[i], [lx, lz] = bord(s, -1, W + 2); h.lum(i, lx, s.y + 20, lz, 0xfff0d8, 50, 0.5); } // le mât éclaire la piste ; au couchant, un appoint
      }
      const foule = net(h.mat('foule', {}, '#4a4250', '#e83f8c')), foule2 = net(h.mat('foule', {}, '#3e3848', '#2aa39a'));
      const peauT = { beton, banderole: h.mat('banderole', {}, 0), banderole2: h.mat('banderole', {}, 2), foule, foule2, escalier: h.mat('marches'), loge: h.mat('loges', LUM), acier, toit: h.mat('toleToit'), lampe, drapeau: h.mat('damier', { lum: 1, net: 1, side: THREE.DoubleSide }, '#f4f0e0') };
      trib.forEach((l, m) => insts(h, 'tribune', peauT, l, { a: [m] }));
      const ecrans = [[240, 70], [1250, 110], [1600, 140]];

      // --- le parking derrière les tribunes : des milliers de voitures, des camping-cars au bout des virages ---
      const autos = [], cc = [], COUL = [0xf4f0e0, 0x1a1a1e, 0xc8102e, 0x9aa0a8, 0x1848c8, 0x5a5e66, 0xd8d0c0, 0x2a5a3a, 0xffc04a];
      const lots = [[-260, 1780, -240, -178], [-260, 1780, 398, 460], [1960, 2100, -200, 420], [-580, -440, -200, 420]], dalles = [];
      lots.forEach(([x0, x1, z0, z1], n) => {
        dalles.push([(x0 + x1) / 2, g.hAt((x0 + x1) / 2, (z0 + z1) / 2) - 0.3, (z0 + z1) / 2, 0, x1 - x0, 1, z1 - z0]);
        for (let z = z0 + 6; z < z1 - 4; z += 8.5) for (let x = x0 + 2; x < x1 - 2; x += 2.5) {
          const r = rnd(); if (r > 0.86) continue;
          if (n > 1 && r < 0.05) { cc.push([x + 3, g.hAt(x, z), z, (z | 0) % 2 ? 0 : Math.PI, 1, 1, 1, COUL[(r * 977 | 0) % COUL.length]]); x += 6; continue; }
          autos.push([x, g.hAt(x, z) + 0.65, z + ((z | 0) % 2 ? 2.4 : -2.4), 1.5708, 1, 1, 1, COUL[(r * 977 | 0) % COUL.length]]);
        }
      });
      // et dans l'herbe du milieu, le public qui campe : deux rangées de camping-cars le long du grillage intérieur, par groupes, puis des grappes plus loin
      const poly = S.filter((s, i) => i % 8 === 0), dedans = (x, z) => { let c = false; for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) { const p = poly[a], q = poly[b]; if ((p.z > z) !== (q.z > z) && x < (q.x - p.x) * (z - p.z) / (q.z - p.z) + p.x) c = !c; } return c; };
      const libre = (x, z) => [[20, 60, 140], ...ecrans.map(([a, b]) => [a, b, 30])].every(([cx, cz, r]) => Math.hypot(x - cx, z - cz) > r);
      for (let i = 100; i < N - 130; i += 4) for (const off of [W + 19, W + 28]) {
        const s = S[i], [x, z] = bord(s, 1, off); if ((i >> 2) % 8 === 0) continue; // un passage tous les 8 camping-cars
        if (dedans(x, z) && g.dAt(x, z) > off - 1.5 && libre(x, z)) cc.push([x, g.hAt(x, z), z, Math.atan2(-s.tz, s.tx), 1, 1, 1, COUL[(i * 7 + off | 0) % COUL.length]]);
      }
      for (let n = 0; n < 70; n++) {
        const x0 = -150 + rnd() * 1900, z0 = -60 + rnd() * 340, a = rnd() * 3.14;
        for (let m = 0; m < 6; m++) { const x = x0 + Math.cos(a) * m * 4, z = z0 - Math.sin(a) * m * 4; if (dedans(x, z) && g.dAt(x, z) > W + 45 && libre(x, z)) cc.push([x, g.hAt(x, z), z, a + 1.5708, 1, 1, 1, COUL[(n + m) % COUL.length]]); }
      }
      const ma = inst(h, h.geo('auto'), h.mat('laque'), autos); autos.forEach((p, i) => ma.setColorAt(i, new THREE.Color(p[7]))); ma.instanceColor.needsUpdate = true;
      [inst(h, h.geo('bloc'), h.mat('parking'), dalles), ma, ...insts(h, 'campingCar', { caisse: h.mat('campingCar'), bande: h.mat('peinture', { c: 0xffffff }), vitre: h.mat('vitreSombre'), pneu: h.mat('pneu') }, cc, { teinte: 'bande' })]
        .forEach(m => { m.castShadow = false; }); // loin derrière les tribunes : leur ombre ne se verrait pas

      // --- les stands, côté intérieur du départ : voie des stands, garages des équipes ---
      const gar = [], E = [0xe83f8c, 0x1848c8, 0xffc04a, 0x2aa39a, 0xc8102e, 0xf4f0e0, 0xff7a3d, 0x3d2a5c];
      h.ribbon(N - 110, 200, W + 0.3, 0.04, W + 19, 0.04, h.mat('bitume', { side: THREE.DoubleSide }), 8);
      for (let j = 0, i = N - 106; j < 32; j++, i = (i + 6) % N) {
        const s = S[i], [x, z] = bord(s, 1, W + 21); gar.push([x, s.y, z, Math.atan2(-s.tz, s.tx), 1, 1, 1, E[j % E.length]]); // Z local vers l'intérieur de l'ovale
      }
      insts(h, 'garage', { beton: h.mat('crepi'), porte: h.mat('garageOuvert', LUM), enseigne: h.mat('peinture', { lum: 1, c: 0xffffff }), toit: h.mat('matGris') }, gar, { teinte: 'enseigne' });
      for (let i = N - 100; i < N + 90; i += 40) { const s = S[i % N], [x, z] = bord(s, 1, W + 10); h.lum(i % N, x, s.y + 14, z, 0xfff4e0, 32, 0.45); } // la voie des stands est éclairée, sans plus : la chaussée mouillée renvoie chaque lampe
      // tour de chronométrage et pylône des positions, derrière les garages
      const nom = h.mat('ecrit', LUM, 128, 32, '#1a1420', '#ff7a3d', 'CANAL 6', 26), score = h.mat('pyloneChrono', LUM);
      h.pose('tourChrono', { beton, loge: h.mat('loges', LUM), nom }, h.scene, [-30, g.hAt(-30, 90), 90]);
      h.pose('pyloneScore', { acier, ecran: score }, h.scene, [60, g.hAt(60, 75), 75]);
      // écrans géants du classement dans l'herbe du milieu, tournés vers les deux lignes droites
      const ecran = h.mat('classement', LUM);
      for (const [x, z] of [[240, 70], [1250, 110], [1600, 140]]) if (g.dAt(x, z) > W + 22) h.pose('ecranGeant', { acier, beton, ecran }, h.scene, [x, g.hAt(x, z), z]);
      // portiques de sponsors au-dessus de la piste
      for (const [i, t] of [[520, 'SOLAR COLA 500'], [1560, 'PALM TIRES · DUSK RADIO']]) h.pose('portiquePub', { ecran: h.mat('ecranPub', LUM, '#ffc04a', t), beton: acier }, repere(h, S[i]), [0, 0, 0], W);
      // mâts de projecteurs du côté intérieur : ils éclairent la chaussée
      const mats = [];
      for (let i = 30; i < N; i += 55) { const s = S[i], [x, z] = bord(s, 1, s.w + 9); if (g.dAt(x, z) < s.w + 7) continue; mats.push([x, g.hAt(x, z), z, 0]); const [lx, lz] = bord(s, 1, W - 2); h.lum(i, lx, s.y + 16, lz, 0xfff0d8, 45, 0.6); }
      insts(h, 'matEclairage', { acier, lampe }, mats);
      // quelques palmiers entre la piste et les tribunes
      const troncs = [], palmes = [];
      for (let i = 10; i < N; i += 37) { const s = S[i], [x, z] = bord(s, -1, s.w + 8); if (g.dAt(x, z) < s.w + 6) continue; const y = g.hAt(x, z), ht = 13 + rnd() * 5; troncs.push([x, y + ht / 2, z, 0, 1, ht, 1]); palmes.push([x, y + ht, z, rnd() * 6]); }
      inst(h, h.geo('troncPalmier'), h.mat('troncPalmier'), troncs); insts(h, 'palmes', { palme: h.mat('palme', { side: THREE.DoubleSide }) }, palmes);

      // --- la boue du canal (pts 3-4) : là où la route s'élargit (M.large), tout ce qui dépasse le bitume est de la boue (M.surf.large : la physique la roule comme de la terre) ---
      const b0 = pt(h, 3) - 40, b1 = pt(h, 4) + 40, boue = h.mat('bruit', { side: THREE.DoubleSide, gloss: 0.3 }, '#4a3b2a', ['#3a2c1e', '#5e4a32', '#2a2016', '#6a5a44']);
      for (const sd of [-1, 1]) h.ribbon((b0 + N) % N, b1 - b0, s => sd * (W - 0.05), 0.02, s => sd * s.w, 0.02, boue, 6);
      // --- l'écluse du retour (pt 16) : la rampe de M.sauts monte entre deux bajoyers, finit net sous la passerelle de manœuvre ; les 8 derniers mètres en chevrons (signal des cartes à relief) ---
      { const i = pt(h, h.M.sauts[0][0]), s = S[i];
        h.pose('ecluse', { beton, bois: h.mat('planches'), acier, rouge: h.mat('peinture', { c: 0xc8102e }) }, repere(h, s), [0, 0, 0], s.w);
        h.ribbon((i - 4 + N) % N, 4, -W + 0.6, 0.05, W - 0.6, 0.05, h.mat('banderoleSaut', { lum: 1, rep: [4, 1] }), 3.5); h.lum(i, s.x, s.y + 11, s.z, 0xffd8a0, 36, 0.5); }

      // --- l'aller (pts 1-6), devant la tribune nord : le défilé du meeting entre le grillage et les gradins. Un char tous les 120 m, et entre deux,
      // la fanfare en rangs de quatre (tenues rouges) précédée d'une ligne de majorettes (bleu et rose) ; tout le monde marche dans le sens de la course ---
      const chars = [], fanfare = [], majo = [], fil = (i, off) => { const s = S[(Math.round(i) + N) % N], [x, z] = bord(s, -1, s.w + off); return [x, s.y + h.TH.murH, z, Math.atan2(-s.tz, s.tx)]; }; // sur l'allée, au niveau du haut du muret : au sol, le muret les cachait
      { const a0 = pt(h, 1) - 20, cnt = pt(h, 6) - a0, dalle = h.mat('beton', { side: THREE.DoubleSide }); // l'allée du défilé : une terrasse de béton du muret à la façade des gradins
        h.ribbon(a0, cnt, s => -(s.w + 0.3), h.TH.murH, s => -(s.w + 11.6), h.TH.murH, dalle, 8); h.ribbon(a0, cnt, s => -(s.w + 11.6), h.TH.murH, s => -(s.w + 11.6), -3, dalle, 8); }
      const COULC = [0xe83f8c, 0xffc04a, 0x2aa39a, 0x1848c8, 0xff7a3d];
      for (let i = pt(h, 1), k = 0; i < pt(h, 6) - 40; i += 60, k++) {
        chars.push([...fil(i, 5.2), 1, 1, 1, COULC[k % COULC.length]]);
        for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) fanfare.push([...fil(i + 9 + r * 0.7, 3.4 + c * 1.1), 1, 1, 1, 0xc8102e]);
        for (let c = 0; c < 6; c++) majo.push([...fil(i + 13, 3 + c * 0.9), 1, 1, 1, c % 2 ? 0xe83f8c : 0x1848c8]);
      }
      const blanc = h.mat('peinture', { c: 0xf4f0e0 }), damier = h.mat('damier', { lum: 1, net: 1, side: THREE.DoubleSide }, '#f4f0e0');
      const peauF = { blanc, peau: h.mat('peinture', { c: 0xc8926a }), tenue: h.mat('peinture', { c: 0xffffff }), or: h.mat('peinture', { c: 0xe0b040 }) };
      insts(h, 'figurant', peauF, fanfare, { a: [0], teinte: 'tenue' }); insts(h, 'figurant', peauF, majo, { a: [1], teinte: 'tenue' });
      insts(h, 'charMeeting', { caisse: h.mat('laque', { c: 0xf4f0e0 }), vitre: h.mat('vitreSombre'), blanc, deco: h.mat('peinture', { c: 0xffffff }), drapeau: damier, pneu: h.mat('pneu') }, chars, { teinte: 'deco' });

      // --- le retour (pts 13-18), devant la tribune sud : une haie de drapeaux à damier des deux côtés, et loin à l'ouest, dans le couchant qu'on a en face,
      // les montgolfières du meeting (hors brouillard : des silhouettes de couleur sur le ciel orange) ---
      const mats2 = []; for (let i = pt(h, 13), k = 0; i < pt(h, 18); i += 14, k++) { const s = S[i], sd = k % 2 ? 1 : -1, [x, z] = bord(s, sd, s.w + 3); mats2.push([x, g.hAt(x, z), z, Math.atan2(-s.tz, s.tx) + Math.PI]); }
      insts(h, 'matDamier', { acier, drapeau: damier }, mats2);
      const ballons = [], nacelles = [], COULB = [0xe83f8c, 0xffc04a, 0x2aa39a, 0x1848c8, 0xc8102e, 0xf4f0e0, 0x3d2a5c];
      for (let k = 0; k < 16; k++) { const x = -330 - rnd() * 380, z = 280 + rnd() * 420, y = 60 + rnd() * 140, r = 18 + rnd() * 8; // à moins de 2 350 m de la piste : au-delà, derrière le ciel
        ballons.push([x, y, z, rnd() * 6, r, r, r, COULB[k % COULB.length]]); nacelles.push([x, y - r * 1.15 - 3, z, 0, 1.8, 1.4, 1.8]); }
      const mb = inst(h, h.geo('ballon'), h.mat('peinture', { c: 0xffffff, fog: false }), ballons); ballons.forEach((p, i) => mb.setColorAt(i, new THREE.Color(p[7]))); mb.instanceColor.needsUpdate = true;
      inst(h, h.geo('boite', 1, 1, 1), h.mat('planches', { fog: false }), nacelles);
      // dirigeable du meeting, qui tourne lentement au-dessus de l'ovale
      const dg = new THREE.Group(); dg.userData.dyn = 1; h.scene.add(dg); // dyn : il vole, hors fusion du décor fixe (game.js)
      h.pose('enveloppe', h.mat('laque', { c: 0xe8e4dc }), dg);
      h.pose('dirigeable', { nacelle: h.mat('matGris'), aileron: h.mat('peinture', { c: 0xe83f8c }), ecran: h.mat('ecrit', LUM, 128, 26, '#1a1420', '#ffc04a', 'SOLAR COLA', 20) }, dg);
      // les tours du centre-ville à l'ouest, à contre-jour devant le soleil
      const tours = h.mat('tourLoin', { lum: 1, fog: false }, '#2a1c3a', ['#ffc04a'], 40);
      for (let i = 0; i < 34; i++) { const hh = 120 + rnd() * rnd() * 380, w = 50 + rnd() * 70; boite(h, tours, w, hh, w, -2300 + rnd() * 900, hh / 2, -500 + rnd() * 1300); }
      // la foule bouge : chaque étage de gradins passe par moments à sa variante bras levés ; le dirigeable fait le tour en une vingtaine de minutes
      return (dt, now) => {
        foule.map.offset.y = Math.sin(now * 0.0021) + Math.sin(now * 0.0057) > 0.7 ? 0.5 : 0;
        foule2.map.offset.y = Math.sin(now * 0.0017 + 2) + Math.sin(now * 0.0049) > 0.5 ? 0.5 : 0;
        const t = now * 0.00006; dg.position.set(760 + Math.cos(t) * 520, 125, 110 + Math.sin(t) * 260); dg.rotation.y = -t - Math.PI / 2;
      };
    },
  };
})();
