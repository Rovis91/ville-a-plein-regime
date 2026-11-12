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
  //       sol(s) = altitude du sol sous l'échantillon s quand la route n'est pas posée dessus (viaduc, pont),
  //       sous = pente (touge seul) : plafonne chaque sommet sous toute la route proche, puis remonte de `sous` m par mètre ; les triangles ne passent plus sur une chaussée en contrebas (lacets) }
  // Renvoie hAt(x, z) = altitude du sol et dAt(x, z) = distance à la route, pour y poser le décor.
  function terrain(h, o) {
    const { THREE, S, W } = h, pas = o.pas, sol = o.sol || (s => s.y);
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const s of S) { x0 = Math.min(x0, s.x); x1 = Math.max(x1, s.x); z0 = Math.min(z0, s.z); z1 = Math.max(z1, s.z); }
    x0 -= o.marge; z0 -= o.marge; x1 += o.marge; z1 += o.marge;
    const nx = Math.ceil((x1 - x0) / pas) + 1, nz = Math.ceil((z1 - z0) / pas) + 1, Y = new Float32Array(nx * nz), D = new Float32Array(nx * nz), sub = S.filter((s, i) => i % 3 === 0).map(s => ({ x: s.x, z: s.z, g: sol(s), pose: sol(s) > s.y - 0.5 }));
    const R = pas * 1.42 + W + 1, RC = R + 48, cases = new Map(); // R : distance max entre un sommet d'un triangle qui touche la chaussée et l'échantillon de route de ce point
    if (o.sous) for (const s of S) { const c = Math.floor(s.x / RC) * 1e4 + Math.floor(s.z / RC); if (!cases.has(c)) cases.set(c, []); cases.get(c).push(s); } // la route rangée par cases de RC mètres
    const pos = new Float32Array(nx * nz * 3), uv = new Float32Array(nx * nz * 2), idx = [];
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
      const x = x0 + ix * pas, z = z0 + iz * pas, k = iz * nx + ix; let sw = 0, sy = 0, dm = 1e18, pm = null;
      for (const s of sub) { const d2 = (s.x - x) ** 2 + (s.z - z) ** 2, w = 1 / ((d2 + 100) * (d2 + 100)); sw += w; sy += w * s.g; if (d2 < dm) { dm = d2; pm = s; } }
      const d = Math.sqrt(dm); let y = sy / sw - 0.5;
      if (d < W + 1 && pm.pose) y -= 1.5; // sous la chaussée : on creuse, la route et ses murets cachent le raccord
      if (o.loin && d > o.loin) y -= (d - o.loin) * o.chute;
      if (o.creux) y -= o.creux(x, z);
      if (o.sous && d < R) y = Math.max(y, pm.g - 1.7); // assez haut pour que le pied des murets ne flotte pas
      if (o.sous && d < RC) for (let cz = -1; cz <= 1; cz++) for (let cx = -1; cx <= 1; cx++) for (const s of cases.get((Math.floor(x / RC) + cx) * 1e4 + Math.floor(z / RC) + cz) || []) {
        const e = Math.hypot(s.x - x, s.z - z); if (e < RC) y = Math.min(y, s.y - 0.3 + Math.max(0, e - R) * o.sous); // au-delà de RC la remontée dépasse tout dénivelé de la carte
      }
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
    // ---------- Roche-Sourde : un barrage-voûte en plein midi. Alpage et sapins, sommets enneigés, le parement de la voûte au-dessus du virage relevé, le déversoir sous le second tremplin ----------
    barrage(h) {
      const { THREE, S, N, W, rnd } = h, mur = s => paroi(s, s.w);
      const iD = pt(h, 20), sD = S[iD], xD = sD.x - 19; // le déversoir : un chenal du lac vers la vallée, que la piste franchit par sa fosse
      const chenal = (x, z) => Math.abs(x - xD) < 21 && z > sD.z - 150 ? 6.5 : 0, lac = (x, z) => z > 520 ? Math.min(30, (z - 520) * 0.5) : 0;
      const g = terrain(h, { pas: 8, marge: 460, loin: 70, chute: -0.3, creux: (x, z) => Math.max(chenal(x, z), lac(x, z)), mat: h.mat('bruit', {}, '#6c8c4c', ['#5c7c42', '#7c9c5a', '#8c8c82', '#586c44']) });
      const eau = h.mat('eauVive', { rep: [12, 60] }), eauLac = h.mat('eauVive', { rep: [90, 60] });
      boite(h, eau, 40, 0.3, 700, xD, sD.y - 7.05, sD.z + 200); boite(h, eauLac, 1500, 0.3, 900, 500, 14, 990);
      // la voûte : le mur roulable extérieur du grand virage se prolonge en parement, jusqu'à 42 m, couronné d'un chemin de ronde
      const beton = h.mat('parement', { side: THREE.DoubleSide }), i0 = S.findIndex(s => s.rc), nC = S.filter(s => s.rc).length, f = s => (s.w - W) / 10, ht = s => mur(s) + 1 + 41 * f(s) * f(s);
      h.ribbon(i0, nC, s => -s.w - 0.3, s => mur(s) - 2, s => -s.w - 0.3, ht, beton, 16).castShadow = true;
      h.ribbon(i0, nC, s => -s.w - 0.3, ht, s => -s.w - 7, ht, beton, 16); h.ribbon(i0, nC, s => -s.w - 7, ht, s => -s.w - 7, () => -10, beton, 16);
      h.pose('tourPrise', { beton: h.mat('beton'), vitre: h.mat('peinture', { c: 0x2a4a5a }) }, h.scene, [584, 14, 540]);
      // portiques des tremplins, 30 m avant le bout
      const peau = { acier: h.mat('acier'), banderole: h.mat('banderoleSaut', { lum: 1, side: THREE.DoubleSide }) };
      for (const [p] of h.M.sauts) { const i = pt(h, p); h.pose('portiqueSaut', peau, repere(h, S[(i - 15 + N) % N]), [0, 0, 0], W);
        h.ribbon((i - 7 + N) % N, 7, -W + 0.6, 0.05, W - 0.6, 0.05, h.mat('banderoleSaut', { lum: 1, rep: [4, 1] }), 3.5); } // et les 14 derniers mètres du tremplin peints de chevrons
      // ligne à haute tension qui descend de la centrale, le long de la ligne droite
      for (let x = -200; x <= 760; x += 160) h.pose('pyloneHT', { acier: h.mat('acier') }, h.scene, [x, g.hAt(x, -60), -60]);
      // sapins : par bouquets sur l'alpage, jamais sur la route ni dans le chenal
      const arbres = [];
      for (let k = 0; k < 1500; k++) { const x = g.box[0] + rnd() * (g.box[2] - g.box[0]), z = g.box[1] + rnd() * (g.box[3] - g.box[1]), d = g.dAt(x, z);
        if (d > 26 && !chenal(x, z) && !lac(x, z) && Math.sin(x * 0.02) + Math.cos(z * 0.027) + rnd() > 0.9) arbres.push([x, g.hAt(x, z) + 6, z, rnd() * 6, 0.7 + rnd() * 0.8]); }
      const futs = arbres.map(p => { const y0 = p[1] - 6; p[1] = y0 + 10 * p[4]; return [p[0], y0 + 2.4 * p[4], p[2], 0, p[4]]; });
      inst(h, h.geo('cedre'), h.mat('cedre'), arbres); inst(h, h.geo('tronc'), h.mat('tronc'), futs);
      // les sommets, en couronne à plus d'un kilomètre
      const pics = []; for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283 + rnd() * 0.2, r = 1150 + rnd() * 500, l = 520 + rnd() * 420; pics.push([300 + Math.cos(a) * r, 40, 200 + Math.sin(a) * r, rnd() * 1.5, l, 380 + rnd() * 330, l]); }
      inst(h, h.geo('pic'), h.mat('rocNeige', { fog: false }), pics);
      return dt => { eau.map.offset.y -= dt * 0.9; eauLac.map.offset.x += dt * 0.01; }; // le déversoir coule
    },
    // ---------- Grand Vacarme : une arène couverte, comble. Sol de terre battue, gradins sur tout le pourtour, charpente et rampes de projecteurs, cube d'affichage au centre ----------
    stade(h) {
      const { THREE, S, N, W } = h, net = m => { m.map.anisotropy = 8; return m; };
      const g = terrain(h, { pas: 8, marge: 150, mat: h.mat('terreBattue') }); // le sol suit la piste : les tremplins sont des buttes, la fosse un cratère
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
      boite(h, h.mat('toitArene', LUM), X1 + RE - X0 + RW + 120, 1, Z1 - Z0 + 120, cx, HT + 0.5, cz);
      const peauF = { acier, lampe, treillis: h.mat('treillisPortique', { alphaTest: 0.5, side: THREE.DoubleSide, rep: [(Z1 - Z0) / 6.2, 1] }, '#3a3e4a') };
      for (let x = -230; x <= 380; x += 70) h.pose('fermeToit', peauF, h.scene, [x, HT - 4.5, cz], Z1 - Z0 + 100);
      // le cube d'affichage, suspendu au-dessus de l'épingle
      h.pose('cubeScore', { ecran: h.mat('tableauStade', LUM), acier, bande: h.mat('peinture', { lum: 1, c: 0xffc21a }) }, h.scene, [150, HT - 30, 160]);
      // portiques des tremplins, 30 m avant le bout, et les 14 derniers mètres peints de chevrons (formes et banderole de Roche-Sourde : même signal sur toutes les cartes à relief)
      const peau = { acier, banderole: h.mat('banderoleSaut', { lum: 1, side: THREE.DoubleSide }) }, chev = h.mat('banderoleSaut', { lum: 1, rep: [4, 1] });
      for (const [p] of h.M.sauts) { const i = pt(h, p); h.pose('portiqueSaut', peau, repere(h, S[(i - 15 + N) % N]), [0, 0, 0], W); h.ribbon((i - 7 + N) % N, 7, -W + 0.6, 0.05, W - 0.6, 0.05, chev, 3.5); }
      // panneaux des annonceurs à la corde extérieure des virages à plat, et les projecteurs qui éclairent la piste
      const pubs = [['VOLT COLA', '#e8362a', '#f4f0e0'], ['KOP 170', '#16161c', '#ffc21a'], ['TONNERRE', '#f4f0e0', '#1c3fa8'], ['BRASERO', '#ffc21a', '#16161c']].map(([t, a, b]) => h.mat('ecrit', LUM, 64, 32, a, b, t, 11));
      [[9, -1], [13, 1], [16, -1], [22, 1], [24, -1], [1, 1]].forEach(([p, sd], k) => h.pose('panneauPub', { mat: h.mat('fer'), affiche: pubs[k % pubs.length] }, repere(h, S[pt(h, p)]), [sd * (W + 14), 0, 0], sd * 0.5));
      for (let i = 0; i < N; i += 45) h.lum(i, S[i].x, S[i].y + 20, S[i].z, 0xfff4e0, 55, 0.5);
      // la foule bouge : chaque anneau passe par moments à sa variante bras levés
      return (dt, now) => {
        foule.map.offset.y = Math.sin(now * 0.0023) + Math.sin(now * 0.0061) > 0.6 ? 0.5 : 0;
        foule2.map.offset.y = Math.sin(now * 0.0019 + 2) + Math.sin(now * 0.0047) > 0.5 ? 0.5 : 0;
      };
    },
    // ---------- Nuit Blanche : un col fermé pour l'hiver, à l'aube. Pentes de neige, sapins chargés, falaise givrée, pont sur la gorge, refuge éclairé au col ; la glace vive se voit sur la route ----------
    givre(h) {
      const { THREE, S, N, W, T, rnd } = h, neige = h.mat('neigeVierge'), beton = h.mat('beton');
      // la gorge : une entaille que la route franchit par un pont, entre les points 22 et 23 ; elle s'ouvre vers l'aval
      const xG = (S[pt(h, 22)].x + S[pt(h, 23)].x) / 2, gorge = (x, z) => 30 * Math.max(0, 1 - ((x - xG) / 50) ** 2) * Math.min(1, Math.max(0, (z - 330) / 70));
      const g = terrain(h, { pas: 8, marge: 420, loin: 80, chute: -0.25, creux: gorge, mat: neige });
      const iG = S.findIndex(s => gorge(s.x, s.z) > 1), nG = S.filter(s => gorge(s.x, s.z) > 1).length;
      h.ribbon(iG, nG, -W, -2, W, -2, beton, 8); // le tablier (ses flancs sont les murets de la route), sur deux piles
      inst(h, h.geo('pileViaduc'), beton, [1, 2].map(k => { const s = S[iG + Math.round(nG * k / 3)], y0 = g.hAt(s.x, s.z) - 2; return [s.x, (s.y - 2 + y0) / 2, s.z, h.across(s), 1, s.y - 2 - y0, 0.5]; }));
      // la glace vive : partout où la route en est (T.surf, la table de la physique), une plaque sombre et luisante posée sur la neige tassée, les deux bouts en langues
      const opt = { alphaTest: 0.1, gloss: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, vive = i => T.surf[(i + N) % N].vir > 0.4;
      const plaque = h.mat('glaceVive', opt, 0), debut = h.mat('glaceVive', opt, 1), fin = h.mat('glaceVive', { ...opt, rep: [1, -1] }, 1), B = 5; // B échantillons (10 m) par bout
      for (let i = 0; i < N; i++) if (vive(i) && !vive(i - 1)) { let n = 1; while (vive(i + n)) n++;
        const pose = (i0, cnt, m, v) => h.ribbon((i0 + N) % N, cnt, -W + 0.3, 0.03, W - 0.3, 0.03, m, v);
        pose(i, B, debut, 2 * B); pose(i + B, n - 2 * B, plaque, 32); pose(i + n - B, B, fin, 2 * B); }
      // la falaise du départ, côté montagne : elle garde la route à l'ombre du point 2 au point 3 ; une marche de roche givrée, la neige reprend au-dessus
      { const i0 = pt(h, 2), n = (pt(h, 3) - i0 + N) % N, m = S[(i0 + (n >> 1)) % N], ht = s => 3 + 17 * Math.max(0, 1 - (Math.hypot(s.x - m.x, s.z - m.z) / (n + 30)) ** 2);
        h.ribbon((i0 - 20 + N) % N, n + 40, W + 3, -1, W + 8, ht, h.mat('rocGivre', { side: THREE.DoubleSide }), 16); h.ribbon((i0 - 20 + N) % N, n + 40, W + 8, ht, W + 60, s => ht(s) + 10, neige, 10); }
      // sapins : le bois du retour (à l'ouest) serre la route et la tient à l'ombre ; ailleurs des bouquets épars, plus rien au-dessus de 100 m ni dans la gorge
      const arbres = [], bois = x => x < -90, iB = pt(h, 24), nB = (pt(h, 28) - iB + N) % N;
      for (let k = 0; k < nB; k += 3) for (const sd of [-1, 1]) { const [x, z] = bord(S[(iB + k) % N], sd, W + 5 + rnd() * 8); if (bois(x) && g.dAt(x, z) > W + 4) arbres.push([x, g.hAt(x, z) + 6, z, rnd() * 6, 0.8 + rnd() * 0.7]); }
      for (let k = 0; k < 2200; k++) { const x = g.box[0] + rnd() * (g.box[2] - g.box[0]), z = g.box[1] + rnd() * (g.box[3] - g.box[1]), d = g.dAt(x, z), y = g.hAt(x, z);
        if (d > 15 && d < 260 && y - 0.25 * Math.max(0, d - 80) < 100 && !gorge(x, z) && (bois(x) ? rnd() < 0.9 : Math.sin(x * 0.02) + Math.cos(z * 0.027) + rnd() > 1.15)) arbres.push([x, y + 6, z, rnd() * 6, 0.7 + rnd() * 0.8]); }
      const futs = arbres.map(p => { const y0 = p[1] - 6; p[1] = y0 + 10 * p[4]; return [p[0], y0 + 2.4 * p[4], p[2], 0, p[4]]; });
      inst(h, h.geo('cedre'), h.mat('sapinNeige'), arbres); inst(h, h.geo('tronc'), h.mat('tronc'), futs);
      // jalons à neige au ras des congères, tous les 24 m : le seul balisage du col, leur bague s'allume dans les phares
      const jalons = []; for (let i = 0; i < N; i += 12) for (const sd of [-1, 1]) { const [x, z] = bord(S[i], sd, W + 0.5); jalons.push([x, S[i].y, z]); }
      insts(h, 'jalon', { piquet: h.mat('cone'), bague: h.mat('catadioptre', { lum: 1, retro: 2.5 }) }, jalons);
      // le refuge du col, côté aval, fenêtres allumées, et le panneau du col
      const iR = pt(h, 19), gR = repere(h, S[iR]), [lx, lz] = bord(S[iR], -1, W + 9);
      h.pose('refuge', { pierre: h.mat('pierre', { c: 0x8a92a4 }), mur: h.mat('planches', { c: 0x9a7a5a }), toit: neige, fenetre: h.mat('vitrine', { lum: 1, c: 0xffc070 }), porte: h.mat('planches', { c: 0x4a3626 }) }, gR, [-(W + 17), 0, 0]);
      h.lum(iR, lx, S[iR].y + 3, lz, 0xffb060, 45, 1.3);
      h.pose('panneauCol', { poteau: h.mat('acier'), plaque: h.mat('ecrit', { retro: 1.5 }, 128, 42, '#1c3fa8', '#f4f8ff', 'COL DE L\'ECHINE · 1922 m', 10) }, gR, [-(W + 4), 0, -16]);
      // les sommets, en couronne à plus d'un kilomètre, bleus dans le petit jour
      const pics = []; for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283 + rnd() * 0.2, r = 1150 + rnd() * 500, l = 520 + rnd() * 420; pics.push([250 + Math.cos(a) * r, 40, 250 + Math.sin(a) * r, rnd() * 1.5, l, 420 + rnd() * 330, l]); }
      inst(h, h.geo('pic'), h.mat('rocNeige', { fog: false, c: 0xa8b8e8 }), pics);
    },
    // ---------- Spéciale des Ocres : une spéciale de rallye en fin de journée. Garrigue, pins parasols, oliviers et cyprès, talus des bas-côtés, vignes et lavandes, buttes d'ocre ;
    // parc d'assistance au départ, public sur des talus tout le long, banderoles, voitures garées, le gué, le hameau et son bout de bitume, des mas isolés, un village perché et sa chapelle ----------
    terre(h) {
      const { THREE, S, N, W, rnd } = h, [[g0, g1], [b0, b1]] = h.M.surf.zones, entre = (i, a, n) => (i - a + 2 * N) % N <= n, m = i => S[(i + 2 * N) % N];
      const iG = (pt(h, g0) + pt(h, g1)) >> 1, iB = pt(h, b0), nB = (pt(h, b1) - iB + N) % N;
      // plat(i) : là où le sol reste au niveau de la route (gué, hameau, parc d'assistance du départ) ; ailleurs les bas-côtés montent en talus
      const plat = i => entre(i, iG - 30, 60) || entre(i, iB - 10, nB + 20) || entre(i, -50, 130), parc = i => entre(i, -50, 130);
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
      const pris = i => talus.some(t => entre(i, t[7] - 34, 68)), libre = i => !entre(i, iG - 22, 44) && !entre(i, iB - 14, nB + 28) && !parc(i);
      for (const i of [-30, 0, 30, 60]) groupe(i, -1, 3); // la tribune de terre face au parc
      for (const i of crete) for (const sd of [-1, 1]) groupe(i + 22, sd, 2);
      for (let i = 0; i < N; i++) { const s = S[i], k = Math.abs(s.k); if (k >= 0.012 && k >= Math.abs(m(i + 1).k) && k >= Math.abs(m(i - 1).k) && libre(i) && !pris(i)) groupe(i, s.k > 0 ? -1 : 1, k > 0.022 ? 3 : 2); } // l'extérieur : à gauche d'un virage à droite
      for (let i = 0, sd = 1; i < N; i += 20) if (libre(i) && !pris(i)) groupe(i, sd = -sd, 1);
      for (let i = -48; i < 80; i += 4) for (const sd of [-1, 1]) { const t = m(i), [x, z] = bord(t, sd, W + 0.45); pan.push([x, t.y + 1.45, z, h.across(t) + Math.PI / 2]); }
      for (const i of crete) for (let dk = -44; dk < -4; dk += 4) for (const sd of [-1, 1]) { const t = m(i + dk), [x, z] = bord(t, sd, W + 0.45); pan.push([x, t.y + 1.45, z, h.across(t) + Math.PI / 2]); }
      const foule = h.mat('foule', {}, '#8a5a34', '#e8482a'); foule.map.anisotropy = 8;
      insts(h, 'talusPublic', { talus: h.mat('terreOcre'), ruban: h.mat('banderoleRallye', {}, 0), foule }, talus);
      inst(h, h.geo('boite', 8, 0.9, 0.1), h.mat('banderoleRallye', { side: THREE.DoubleSide }, 2), pan).castShadow = false;
      // portiques des crêtes, 30 m avant le bout, aux couleurs de la spéciale : la crête se lit au relief, au portique et au public, sans marquage au sol
      insts(h, 'portiqueSaut', { acier: h.mat('acier'), banderole: h.mat('banderoleRallye', { side: THREE.DoubleSide, rep: [2, 1] }, 4) }, crete.map(i => { const s = m(i - 15); return [s.x, s.y, s.z, h.across(s)]; }), { a: [W] });
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
      const pin = (x, z) => { const e = 0.8 + rnd() * 0.7, r = 3.2 + rnd() * 2.6, y = sol(x, z); futs.push([x, y + 2.6 * e, z, 0, e]); pins.push([x, y + 5.2 * e + 0.25 * r, z, rnd() * 6, r]); };
      const olivier = (x, z) => { const e = 0.35 + rnd() * 0.2, r = 1.8 + rnd() * 1.4, y = sol(x, z); futs.push([x, y + 2.6 * e, z, rnd(), e * 1.6, e, e * 1.6]); oliviers.push([x, y + 5.2 * e + 0.5 * r, z, rnd() * 6, r, r * 1.7, r]); };
      for (let i = 0; i < N; i += 4) for (const sd of [-1, 1]) { const [x, z] = bord(S[i], sd, W + 8 + rnd() * 18), q = rnd(); if (q < 0.62 && !plat(i) && vide(x, z, 3) && g.dAt(x, z) > W + 6) (q < 0.4 ? pin : q < 0.52 ? olivier : cyp)(x, z); }
      for (let k = 0; k < 6500; k++) { const [x, z] = hasard(), d = g.dAt(x, z), b = Math.sin(x * 0.021) + Math.cos(z * 0.026) + rnd();
        if (d > 26 && b > 0.9 && vide(x, z, 4)) (rnd() < 0.8 ? pin : olivier)(x, z);
        else if (d > W + 3 && d < 190 && vide(x, z, 1)) { const r = 0.7 + rnd() * 1.3; buissons.push([x, sol(x, z, 0.2), z, rnd() * 6, r]); } }
      inst(h, h.geo('pinParasol'), h.mat('feuillage'), pins); inst(h, h.geo('pinParasol'), h.mat('feuillage'), buissons).castShadow = false; inst(h, h.geo('pinParasol'), h.mat('feuillage', { c: 0xa8c0a0 }), oliviers); // buissons, rangs et banderoles ne portent pas d'ombre : du temps de rendu pour rien inst(h, h.geo('tronc'), h.mat('tronc'), futs); inst(h, h.geo('cedre'), h.mat('cedre', { c: 0x9ad08a }), cypres);
      // les ocres : des blocs éboulés au bord de la route, des buttes proches, et une couronne de falaises à l'horizon, dans la brume de poussière
      const buttes = [], cx = (g.box[0] + g.box[2]) / 2, cz = (g.box[1] + g.box[3]) / 2;
      for (let k = 0; k < 2000 && buttes.length < 110; k++) { const [x, z] = hasard(), d = g.dAt(x, z), l = 1.2 + rnd() * 2.6; if (d > W + 4 && d < 60 && vide(x, z, l)) buttes.push([x, sol(x, z, -0.4), z, rnd() * 6, l, 0.8 + rnd() * 2, l * (0.7 + rnd() * 0.6)]); }
      for (let k = 0, nb = 0; k < 600 && nb < 20; k++) { const [x, z] = hasard(), d = g.dAt(x, z), l = 30 + rnd() * 40; if (d > l + 40 && d < 280 && prend(x, z, l + 40)) { nb++; buttes.push([x, sol(x, z, -6), z, rnd() * 6, l, 22 + rnd() * 26, l * (0.7 + rnd() * 0.6)]); } }
      for (let k = 0; k < 18; k++) { const a = k / 18 * 6.283 + rnd() * 0.2, r = 1000 + rnd() * 450, l = 170 + rnd() * 190; buttes.push([cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r, rnd() * 6, l, 110 + rnd() * 110, l * (0.7 + rnd() * 0.6)]); }
      inst(h, h.geo('butte'), h.mat('falaiseOcre'), buttes);
      // le ruisseau coule, le public lève les bras par moments
      return (dt, now) => { eau.map.offset.y -= dt * 0.25; eauR.map.offset.x += dt * 0.08; foule.map.offset.y = Math.sin(now * 0.0023) + Math.sin(now * 0.0061) > 0.6 ? 0.5 : 0; };
    },
    // ---------- Karasu-tōge : forêt de cèdres, glissières à catadioptres, et au sommet un carrefour : supérette de nuit, station-service, voitures garées ----------
    touge(h) {
      const { THREE, S, N, W, rnd } = h;
      const g = terrain(h, { pas: 7, sous: 6, marge: 320, loin: 60, chute: 1.1, mat: h.mat('bruit', {}, '#0c1a14', ['#12261e', '#081410', '#16302a']) });
      // le carrefour : sur le plateau du sommet, côté extérieur. Une route de traverse y part, barrée.
      const ic = pt(h, 11), sc = S[ic], sd = g.dAt(...bord(sc, 1, 60)) > g.dAt(...bord(sc, -1, 60)) ? 1 : -1, [cx, cz] = bord(sc, sd, W + 22);
      // cèdres : une rangée serrée le long de la route (le tunnel d'arbres), puis la forêt ; rien sur le carrefour.
      // Dans les lacets, rien côté vallée (ouest) et des cèdres plus petits côté amont, dont la cime reste sous le regard du lacet du dessus ; de jeunes plants sur la pente en contrebas : on voit la ville par-dessus
      const arbres = [], lacets = (x, z) => x > 372 && x < 552 && z > 300 && z < 560, plants = (x, z) => x > 100 && x < 552 && z > 260 && z < 640, libre = (x, z) => (x - cx) ** 2 + (z - cz) ** 2 > 46 * 46;
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
      const rouge = ville(h, g); // la mégapole en contrebas, à l'ouest des lacets
      return (dt, now) => { cligno.color.setHex((now / 450 & 1) ? 0xff8c1a : 0x3a2008); rouge.color.setHex(now % 1500 < 700 ? 0xff2018 : 0x300404); };
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
      // le sol de la place en cases de 2 m : pavés partout dans le cercle où l'on roule, trottoir étroit au pied des façades, sauf où partent les avenues
      { const pres = S.filter(s => (s.x - C[0]) ** 2 + (s.z - C[1]) ** 2 < 260 ** 2), loin = (x, z) => { let m = 1e9; for (const s of pres) m = Math.min(m, Math.hypot(s.x - x, s.z - z) - s.w); return m; }; // distance au bord de la chaussée
        const roule = [[], [], []], pied = [[], [], []];
        for (let r = 0; r < RT + 6; r += 2) { const n = Math.max(6, Math.ceil(6.2832 * r / 2)); for (let k = 0; k < n; k++) {
          const a0 = k / n * 6.2832, a1 = (k + 1) / n * 6.2832, P = [[r, a0], [r + 2, a0], [r + 2, a1], [r, a1]].map(([rr, a]) => [C[0] + Math.cos(a) * rr, C[1] + Math.sin(a) * rr]), e = r < PL.r - 2 ? 0 : Math.min(...P.map(q => loin(...q)));
          const L = r < PL.r || e < 0.3 ? roule : pied; P.forEach(([x, z]) => { L[0].push(x, 0, z); L[1].push(x / 4, z / 4); }); const v = L[0].length / 3 - 4; L[2].push(v, v + 2, v + 1, v, v + 3, v + 2); } }
        roule[0].forEach((v, i) => { if (i % 3 === 1) roule[0][i] = 0.02; }); pied[0].forEach((v, i) => { if (i % 3 === 1) pied[0][i] = 0.22; });
        nappe(...roule, paves); nappe(...pied, dalle); }
      h.pose('arc', { pierre: h.mat('pierre'), relief: h.mat('basRelief') }, h.scene, [C[0], 0.02, C[1]]).forEach(m => m.rotation.y = PL.a); // l'arc au milieu, grande arche dans l'axe de la traversée ; ses piles sont des obstacles (sim.js)
      const fm = ['#d9c9a8', '#cfc0a0', '#e0d4b8'].map(p => h.mat('facadeParis', {}, p)), lots = fm.map(() => []);
      const fb = ['#e8dcc0', '#d8c8b0'].map(p => h.mat('facadeParis', {}, p, 1)), bas = fb.map(() => []); // maisons basses de la butte
      for (let i = 0; i < N; i += 2) {
        const s = S[i], t = TYPES[type[i]], ry = h.across(s), tun = h.zone(i, 14) > 0;
        for (const sd of [-1, 1]) {
          const [qx, qz] = bord(s, sd, W + 12), fleuve = quai(qx, qz) || quai(qx, qz + 14);
          if (i % 8 === 0 && !tun && !fleuve) { // un immeuble tous les 16 m, au recul de la rue ; pas sur la trémie, ni côté fleuve, ni là où une autre rue passe
            const [x, z] = bord(s, sd, s.w + t.recul + 7.5), ruelle = type[i] === 'ruelle';
            if (g.dAt(x, z) > s.w + t.recul + 6.5 && (x - C[0]) ** 2 + (z - C[1]) ** 2 > (RT + 14) ** 2) { const H = t.H[0] + rnd() * (t.H[1] - t.H[0]); (ruelle ? bas[rnd() * 2 | 0] : lots[rnd() * 3 | 0]).push([x, g.hAt(x, z) + H / 2 - 3, z, ry, 17, H + 6, 14]);
              if (type[i] !== 'berge' && al() < (i < h.T.sp[0] ? 0.3 : i < h.T.sp[1] ? 0.6 : 0.25)) { const [fx, fz] = bord(s, sd, s.w + t.recul - 1.05); boutiques.push([fx, s.y + 0.22, fz, ry - sd * 1.5708, t.recul]); } } // un commerce en rez-de-chaussée : quelques-uns partout, plus au secteur 2
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
      const kq = []; for (const [i, sd] of [[h.T.sp[1] - 60, -1], [h.T.sp[1] - 24, 1]]) { const s = S[i], [x, z] = bord(s, sd, s.w + 4.6); kq.push([x, s.y + 0.22, z, h.across(s) - sd * 1.5708]); } // entre les voitures garées et la rangée d'arbres
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
      return null;
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
        if (i % 8 === 0 && cnt[f] < 400) { const [x, z] = bord(s, sd, W + 1.6); dummy.position.set(x, s.y + 2.5, z); dummy.lookAt(s.x, s.y + 2.5, s.z); dummy.updateMatrix(); murs[f].setMatrixAt(cnt[f]++, dummy.matrix); }
        if (i % 4 === 0) { const [x, z] = bord(s, sd, W + 0.5); (i % 8 ? balA : balB).push([x, s.y + 4.4, z]); } // balises hautes, une sur deux blanche, l'autre rose
        if (Math.abs(k) > Math.abs(S[(i + N - 1) % N].k) && Math.abs(k) >= Math.abs(S[(i + 1) % N].k) && Math.abs(k) > 0.008) apex.push([i, sd]);
      }
      murs.forEach((m, f) => { m.count = cnt[f]; m.frustumCulled = false; h.scene.add(m); });
      inst(h, h.geo('balise'), h.mat('peinture', { lum: 1, c: 0xf4f0e0 }), balA); inst(h, h.geo('balise'), h.mat('peinture', { lum: 1, c: 0xe83f8c }), balB);
      // panneaux des sponsors du meeting (inventés) : un mât de 24 m au point de corde extérieur de chaque courbe
      const pubs = [['SOLAR COLA', '#c8102e', '#f4f0e0'], ['DUSK RADIO', '#3d2a5c', '#ffc04a'], ['PALM TIRES', '#1848c8', '#f4f0e0'], ['RANCHO', '#f4f0e0', '#1a1420'], ['NITRO TACO', '#2aa39a', '#f4f0e0'], ['CANAL 6', '#1a1420', '#ff7a3d']].map(([t, a, b]) => h.mat('ecrit', LUM, 64, 32, a, b, t, 11));
      const fer = h.mat('fer'), acier = h.mat('acier'), beton = h.mat('beton'), lampe = h.mat('lampe', LUM);
      apex.forEach(([i, sd], k) => h.pose('panneauPub', { mat: fer, affiche: pubs[k % pubs.length] }, repere(h, S[i]), [sd * (W + 9), 0, 0], sd * 0.5));
      // grillage de protection au-dessus des murets, des deux côtés, sur tout le tour ; poteaux tous les 6 échantillons
      const cO = N - (T.t1 - T.t0), grille = net(h.mat('grillage', { alphaTest: 0.5, side: THREE.DoubleSide }));
      for (const sd of [-1, 1]) h.ribbon(T.t1, cO, sd * (W + 0.1), h.TH.murH + 4.2, sd * (W + 0.1), h.TH.murH - 0.1, grille, 4);
      const pot = []; for (let i = 0; i < N; i += 6) for (const sd of [-1, 1]) { const [x, z] = bord(S[i], sd, W + 0.2); pot.push([x, S[i].y + h.TH.murH + 2.1, z, 0, 1, 0.86, 1]); }
      inst(h, h.geo('poteauGrillage'), acier, pot);

      // --- les tribunes suivent la piste par l'extérieur, sans trou : un module de 14 m tous les 7 échantillons. Il s'élargit à l'extérieur des courbes
      // pour refermer l'éventail, et perd de la profondeur (75 %, 50 %) là où une autre portion de piste passe derrière ; un sur quatre porte un mât ---
      const trib = [[], []], PAS = 7, PROF = 53;
      const pied = i => { const s = S[i % N]; return [...bord(s, -1, W + 12), s.tz, -s.tx]; }; // façade et direction du fond (côté gauche = extérieur de l'ovale)
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
      for (let i = 30; i < N; i += 55) { const s = S[i], [x, z] = bord(s, 1, W + 9); if (g.dAt(x, z) < W + 7) continue; mats.push([x, g.hAt(x, z), z, 0]); const [lx, lz] = bord(s, 1, W - 2); h.lum(i, lx, s.y + 16, lz, 0xfff0d8, 45, 0.6); }
      insts(h, 'matEclairage', { acier, lampe }, mats);
      // quelques palmiers entre la piste et les tribunes
      const troncs = [], palmes = [];
      for (let i = 10; i < N; i += 37) { const s = S[i], [x, z] = bord(s, -1, W + 8); if (g.dAt(x, z) < W + 6) continue; const y = g.hAt(x, z), ht = 13 + rnd() * 5; troncs.push([x, y + ht / 2, z, 0, 1, ht, 1]); palmes.push([x, y + ht, z, rnd() * 6]); }
      inst(h, h.geo('troncPalmier'), h.mat('troncPalmier'), troncs); insts(h, 'palmes', { palme: h.mat('palme', { side: THREE.DoubleSide }) }, palmes);
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
