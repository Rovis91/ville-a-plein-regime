// Formes propres à « voitures » : la géométrie des voitures du jeu (joueur et adversaires), complète le catalogue de formes.js. Voir METHODE-DECOR.md.
// Une voiture = un profil latéral extrudé en largeur (passages de roue découpés, arêtes chanfreinées), un habitacle plus étroit posé dessus, et des pièces
// (boucliers, aileron, rétroviseurs, phares, feux), fondus en une géométrie par zone : caisse (livrée), noir (plastiques), phare et feu (lumineux).
// Mètres, x vers l'avant, y en haut, origine au sol au milieu de la voiture. Les roues sont à part (elles tournent et braquent) : roueVoiture.
// La livrée (textures-voitures.js) est peinte en plan, comme un dessin coté : vue de côté, de dessus, de face et de l'arrière, sur une seule image 128 × 128.
// Chaque face prend la vue de son axe dominant ; les dessous prennent un aplat sombre, les pièces « unies » un aplat de teinte.
(() => {
  const V2 = THREE.Vector2, PX = 24; // 24 pixels par mètre sur la livrée
  // où tombe un point dans la livrée, en pixels : vue de côté (x, y), de dessus (x, z), de face et de l'arrière (z, y) ; aplats de teinte et sombre
  const plan = {
    cote: (x, y) => [(x + 2.6667) * PX, (1.5 - y) * PX], dessus: (x, z) => [(x + 2.6667) * PX, 38 + (1.05 - z) * PX],
    av: (z, y) => [(1.05 - z) * PX, 90 + (1.5 - y) * PX], ar: (z, y) => [64 + (1.05 + z) * PX, 90 + (1.5 - y) * PX], teinte: [124, 96], sombre: [124, 108], PX
  };
  const UV = ([px, py]) => [px / 128, 1 - py / 128];
  // profil : contour du dessus de l'avant-bas à l'arrière-bas, puis le bas de caisse à la hauteur bas, découpé en arche autour de chaque roue (centre xs, hauteur r, rayon ra)
  const profil = (dessus, bas, xs, r, ra) => {
    const p = dessus.slice();
    for (const x of xs.slice().sort((a, b) => a - b)) {
      p.push([x - ra, bas], [x - ra, r]);
      for (let k = 1; k < 6; k++) { const a = Math.PI * (1 - k / 6); p.push([x + ra * Math.cos(a), r + ra * Math.sin(a)]); }
      p.push([x + ra, r], [x + ra, bas]);
    }
    return p;
  };
  // extrusion d'un profil sur la largeur w, centrée en z, arêtes chanfreinées de ch
  const extru = (pts, w, ch) => {
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new V2(x, y))), { depth: w - 2 * ch, bevelEnabled: true, bevelThickness: ch, bevelSize: ch, bevelOffset: -ch, bevelSegments: 1, curveSegments: 1 });
    g.translate(0, 0, -w / 2 + ch); return g;
  };
  const boite = (l, h, w) => new THREE.BoxGeometry(l, h, w);
  const rond = (r, e = 0.05) => { const g = new THREE.CylinderGeometry(r, r, e, 10); g.rotateZ(Math.PI / 2); return g; }; // feu rond tourné vers l'avant ou l'arrière
  // fond les pièces [zone, géométrie, x, y, z, uni] : une géométrie par zone, normales à facettes ; uv sur la livrée (caisse) ou au mètre (le reste)
  const fondre = pieces => {
    const par = {}, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
    for (const [zn, g0, x, y, z, uni] of pieces) {
      const g = (g0.index ? g0.toNonIndexed() : g0).translate(x, y, z), P = g.attributes.position.array, uv = new Float32Array(P.length / 3 * 2), N = new Float32Array(P.length);
      for (let i = 0; i < P.length; i += 9) {
        a.fromArray(P, i); b.fromArray(P, i + 3); c.fromArray(P, i + 6); n.subVectors(c, b).cross(a.clone().sub(b)).normalize();
        const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
        for (let k = 0; k < 3; k++) {
          const j = i + k * 3, X = P[j], Y = P[j + 1], Z = P[j + 2]; N.set([n.x, n.y, n.z], j);
          let q;
          if (zn !== 'caisse') q = [(ax > ay && ax > az ? Z : X) * 2, (ay > ax && ay > az ? Z : Y) * 2]; // 2 répétitions par mètre, projection sur l'axe dominant
          else q = UV(uni ? plan.teinte : n.y < -0.5 ? plan.sombre : ay >= ax && ay >= az ? plan.dessus(X, Z) : az >= ax ? plan.cote(X, Y) : n.x > 0 ? plan.av(Z, Y) : plan.ar(Z, Y));
          uv.set(q, i / 3 * 2 + k * 2);
        }
      }
      (par[zn] = par[zn] || []).push([P, N, uv]);
    }
    const out = {};
    for (const zn in par) {
      const l = par[zn], g = new THREE.BufferGeometry();
      [['position', 0, 3], ['normal', 1, 3], ['uv', 2, 2]].forEach(([k, i, sz]) => { const A = new Float32Array(l.reduce((s, p) => s + p[i].length, 0)); let o = 0; for (const p of l) { A.set(p[i], o); o += p[i].length; } g.setAttribute(k, new THREE.BufferAttribute(A, sz)); });
      out[zn] = g;
    }
    return out;
  };

  // les modèles : dessus du profil, bas de caisse, largeur, habitacle (bas du pare-brise, haut du pare-brise, haut de la lunette, bas de la lunette ; largeur),
  // roues (x arrière, x avant, rayon, largeur du pneu, voie arrière en plus), joints de portes, et les pièces propres au modèle
  const MODELES = {
    // Nissan Skyline GT-R R34 préparée : berline deux portes à malle haute, grand aileron sur montants, quatre feux ronds, prise d'air de capot
    gtr: {
      dessus: [[2.3, 0.2], [2.34, 0.5], [2.26, 0.7], [1.6, 0.84], [0.68, 0.87], [-1.6, 0.88], [-2.22, 0.9], [-2.32, 0.74], [-2.3, 0.2]], bas: 0.2, w: 1.8,
      cab: [[0.7, 0.84], [-0.1, 1.34], [-1.0, 1.35], [-1.64, 0.86]], wc: 1.46, roues: [-1.33, 1.33, 0.34, 0.27], portes: [0.6, -0.6], plaque: 0.42,
      pieces: (B, B2, R2, E2) => [B('noir', 0.3, 0.08, 1.72, 2.2, 0.19, 0), B('noir', 0.3, 0.16, 1.6, -2.2, 0.27, 0),
        B('caisse', 0.32, 0.05, 1.74, -2.06, 1.17, 0, 1), B2('noir', 0.1, 0.27, 0.06, -2.06, 1.02, 0.62), B2('caisse', 0.06, 0.16, 0.04, -2.06, 1.1, 0.87, 1), // aileron sur montants, dérives
        B2('caisse', 0.14, 0.1, 0.14, 0.52, 0.99, 0.82, 1), B2('phare', 0.06, 0.1, 0.17, 2.28, 0.62, 0.68), B2('phare', 0.06, 0.08, 0.13, 2.28, 0.61, 0.46),
        R2('feu', 0.085, -2.31, 0.66, 0.4), R2('feu', 0.085, -2.31, 0.66, 0.66)]
    },
    // Mazda RX-7 FD : nez bas aux phares escamotables levés (on roule de nuit), ailes avant galbées, longue lunette bombée, bandeau noir à quatre feux ronds, aileron bas
    fd: {
      dessus: [[2.12, 0.22], [2.16, 0.44], [2.0, 0.6], [1.5, 0.78], [0.6, 0.8], [-1.2, 0.84], [-2.02, 0.82], [-2.14, 0.7], [-2.1, 0.22]], bas: 0.22, w: 1.76,
      cab: [[0.62, 0.72], [-0.18, 1.2], [-0.7, 1.22], [-1.92, 0.8]], wc: 1.36, roues: [-1.2, 1.22, 0.32, 0.25], portes: [0.55, -0.55], plaque: 0.36,
      pieces: (B, B2, R2, E2) => [B2('caisse', 1.0, 0.08, 0.36, 1.18, 0.81, 0.66), B2('caisse', 0.34, 0.16, 0.34, 1.62, 0.76, 0.5, 1), B2('phare', 0.03, 0.11, 0.28, 1.8, 0.78, 0.5),
        B2('phare', 0.04, 0.05, 0.22, 2.15, 0.34, 0.6), B('noir', 0.3, 0.14, 1.6, -2.0, 0.28, 0), B('noir', 0.04, 0.2, 1.62, -2.13, 0.58, 0),
        B('caisse', 0.3, 0.04, 1.5, -1.95, 0.97, 0, 1), B2('noir', 0.08, 0.16, 0.05, -1.95, 0.88, 0.55),
        B2('caisse', 0.14, 0.09, 0.14, 0.45, 0.86, 0.82, 1), R2('feu', 0.085, -2.16, 0.58, 0.36), R2('feu', 0.085, -2.16, 0.58, 0.62)]
    },
    // Toyota Supra A80 : caisse ronde et longue, phares étirés sur les ailes, aileron en arceau, trois feux ronds de chaque côté sur un panneau sombre
    a80: {
      dessus: [[2.22, 0.22], [2.26, 0.46], [2.12, 0.64], [1.5, 0.82], [0.62, 0.84], [-1.4, 0.87], [-2.18, 0.88], [-2.27, 0.72], [-2.24, 0.22]], bas: 0.22, w: 1.81,
      cab: [[0.64, 0.78], [-0.2, 1.27], [-0.9, 1.28], [-1.6, 0.86]], wc: 1.44, roues: [-1.25, 1.3, 0.33, 0.27], portes: [0.58, -0.62], plaque: 0.4,
      pieces: (B, B2, R2, E2) => [B('caisse', 0.34, 0.05, 1.81, -2.0, 1.2, 0, 1), E2([[-1.74, 0.86], [-1.9, 1.14], [-2.0, 1.22], [-2.14, 1.22], [-2.24, 1.1], [-2.26, 0.86], [-2.2, 0.86], [-2.18, 1.08], [-2.1, 1.16], [-2.02, 1.16], [-1.93, 1.1], [-1.82, 0.86]], 0.06, 0.875), // arceau : les flancs de l'aileron montent de la malle
        B2('phare', 0.36, 0.04, 0.3, 1.9, 0.72, 0.6), B2('phare', 0.04, 0.08, 0.34, 2.24, 0.52, 0.6), B2('noir', 0.04, 0.22, 0.64, -2.26, 0.62, 0.56),
        ...[0.32, 0.56, 0.8].map(z => R2('feu', 0.085, -2.29, 0.62, z)), B('noir', 0.3, 0.14, 1.66, -2.12, 0.28, 0), B('noir', 0.24, 0.07, 1.7, 2.14, 0.22, 0),
        B2('caisse', 0.14, 0.1, 0.14, 0.5, 0.92, 0.84, 1)]
    },
    // Renault 5 Turbo : bicorps court à hayon, énormes ailes arrière en caisson (moteur central) percées d'une prise d'air, becquet de toit, rampe de quatre phares
    r5: {
      dessus: [[1.82, 0.22], [1.86, 0.6], [1.72, 0.76], [0.78, 0.8], [-1.82, 0.82], [-1.86, 0.66], [-1.84, 0.22]], bas: 0.22, w: 1.52,
      cab: [[0.8, 0.76], [0.1, 1.3], [-1.48, 1.32], [-1.74, 0.8]], wc: 1.38, roues: [-1.22, 1.2, 0.3, 0.24, 0.12], portes: [0.72, -0.4], plaque: 0.42,
      pieces: (B, B2, R2, E2) => [E2(profil([[-0.32, 0.24], [-0.5, 0.84], [-1.74, 0.86], [-1.84, 0.76], [-1.84, 0.24]], 0.24, [-1.22], 0.3, 0.33), 0.28, 0.76, 0.06),
        E2(profil([[1.74, 0.24], [1.76, 0.76], [0.62, 0.82], [0.56, 0.24]], 0.24, [1.2], 0.3, 0.33), 0.14, 0.73, 0.05),
        B2('noir', 0.04, 0.34, 0.2, -0.43, 0.6, 0.79), B('caisse', 0.3, 0.05, 1.3, -1.56, 1.35, 0, 1),
        B2('phare', 0.04, 0.13, 0.28, 1.86, 0.58, 0.52), R2('phare', 0.09, 1.87, 0.6, 0.17), B('noir', 0.08, 0.16, 1.6, 1.84, 0.3, 0),
        B2('feu', 0.04, 0.26, 0.2, -1.87, 0.64, 0.58), B('noir', 0.1, 0.16, 1.64, -1.84, 0.3, 0), B2('caisse', 0.12, 0.09, 0.12, 0.6, 0.92, 0.76, 1)]
    },
    // Dodge Viper GTS : capot interminable, habitacle reculé, toit à double bulle, becquet en bec de canard, sorties d'échappement latérales, deux bandes d'un bout à l'autre
    gts: {
      dessus: [[2.2, 0.2], [2.24, 0.42], [2.06, 0.62], [1.5, 0.84], [0.9, 0.82], [-0.1, 0.8], [-1.5, 0.9], [-2.16, 0.92], [-2.25, 0.78], [-2.22, 0.2]], bas: 0.2, w: 1.94,
      cab: [[-0.08, 0.78], [-0.78, 1.18], [-1.15, 1.19], [-1.98, 0.9]], wc: 1.38, roues: [-1.2, 1.25, 0.34, 0.29], portes: [-0.05, -1.1], plaque: 0.4,
      pieces: (B, B2, R2, E2) => [B('caisse', 0.22, 0.06, 1.7, -2.14, 0.95, 0, 1), B2('phare', 0.3, 0.04, 0.34, 1.9, 0.7, 0.62), B2('phare', 0.04, 0.06, 0.3, 2.22, 0.5, 0.62),
        B2('noir', 1.0, 0.08, 0.06, -0.1, 0.24, 0.97), B2('feu', 0.04, 0.1, 0.46, -2.26, 0.7, 0.6), B('noir', 0.3, 0.16, 1.7, -2.12, 0.28, 0),
        B2('caisse', 0.14, 0.09, 0.14, -0.3, 0.9, 0.9, 1)]
    }
  };

  Object.assign(FORMES, {
    // une voiture : { zones: { caisse, noir, phare, feu } géométries fondues, roues: [x arrière, x avant, z arrière, z avant, rayon, largeur], plan: ce que la livrée doit dessiner }
    voiture: K => {
      const m = MODELES[K], [xr, xf, r, tw, plus = 0] = m.roues, ra = r + 0.03, w = m.w;
      const B = (zn, l, h, ww, x, y, z, uni) => [zn, boite(l, h, ww), x, y, z, uni], B2 = (zn, l, h, ww, x, y, z, uni) => [B(zn, l, h, ww, x, y, z, uni), B(zn, l, h, ww, x, y, -z, uni)];
      const R2 = (zn, rr, x, y, z) => [[zn, rond(rr), x, y, z], [zn, rond(rr), x, y, -z]], E2 = (p, ww, z, ch = 0.03) => [['caisse', extru(p, ww, ch), 0, 0, z], ['caisse', extru(p, ww, ch), 0, 0, -z]];
      const pieces = [['caisse', extru(profil(m.dessus, m.bas, [xr, xf], r, ra), w, 0.04), 0, 0, 0], ['caisse', extru(m.cab, m.wc, 0.11), 0, 0, 0],
        ...[xr, xf].map(x => B('noir', 2 * ra, ra + 0.08, w - 2 * tw - 0.12, x, r + (ra - 0.12) / 2, 0)), // passages de roue : le fond, pour ne pas voir à travers
        ...m.pieces(B, B2, R2, E2).flatMap(p => Array.isArray(p[0]) ? p : [p])]; // B2, R2, E2 donnent une paire de pièces
      const zf = w / 2 - tw / 2 - 0.05; // flanc du pneu en retrait de l'aile
      return { zones: fondre(pieces), roues: [xr, xf, zf + plus, zf, r, tw], plan: Object.assign({ K, cab: m.cab, wc: m.wc, w, xs: [xr, xf], r, ra, portes: m.portes, plaque: m.plaque, bas: m.bas, dessusCaisse: m.dessus }, plan) };
    },
    // roue : pneu et jante d'une pièce, axe en z. La livrée de la roue (textures-voitures.js) : le flanc et la jante en disque au centre, la bande de roulement en bas
    roueVoiture: (r, w) => {
      const g = new THREE.CylinderGeometry(r, r, w, 14), uv = g.attributes.uv, n = g.attributes.normal;
      for (let i = 0; i < uv.count; i++) if (Math.abs(n.getY(i)) > 0.5) uv.setXY(i, 0.5 + (uv.getX(i) - 0.5) * 0.84, 0.54 + (uv.getY(i) - 0.5) * 0.84); else uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * 0.09);
      g.rotateX(Math.PI / 2); return g;
    }
  });
})();
