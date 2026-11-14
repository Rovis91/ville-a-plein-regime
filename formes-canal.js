// Formes propres à « canal » : complète le catalogue de formes.js (mêmes conventions : forme simple = géométrie, assemblage = liste de boîtes à zones). Voir METHODE-DECOR.md.
// Repère des pièces du circuit : origine au sol au milieu de la façade, X le long de la piste, Z en s'éloignant de la piste (vers le fond).
(function () {
  const A1 = Math.atan2(14, 24), A2 = Math.atan2(16, 22); // pentes des gradins bas et haut
  const B = (w, h, d, H = h) => { const g = new THREE.BoxGeometry(w, h, d); g.userData.dim = [w, H, d]; return g; };
  Object.assign(FORMES, {
    // module de tribune de L m, posé côte à côte le long de la piste : podium à banderole, gradins bas (foule), escalier au bord, loges vitrées,
    // gradins hauts (foule2), mur du fond, toit en porte-à-faux sur ferme d'acier, rampe de projecteurs ; mat = 1 : drapeau à damier et mât de projecteurs de 64 m
    tribune: (mat, L = 14) => [['beton', L, 3, 2, 0, 1.5, 1], ['banderole', L, 1.6, 0.2, 0, 1.7, -0.05],
      ['foule', L, 0.6, 27.8, 0, 10, 14, [-A1, 0, 0], 1], ['escalier', 1.4, 0.8, 27.8, 0.7 - L / 2, 10, 14, [-A1, 0, 0]],
      ['loge', L, 4, 3, 0, 19, 27.5], ['beton', L, 1, 6, 0, 21.5, 28], ['banderole2', L, 1.2, 0.2, 0, 22.6, 24.9],
      ['foule2', L, 0.6, 27.2, 0, 30, 39, [-A2, 0, 0], 1], ['escalier', 1.4, 0.8, 27.2, 0.7 - L / 2, 30, 39, [-A2, 0, 0]],
      ['beton', L, 40, 2, 0, 20, 51, null, 1], ['acier', 1, 6, 1, 0.5 - L / 2, 43, 51], ['acier', 0.8, 3, 34, 0.5 - L / 2, 48.2, 36],
      ['toit', L + 0.6, 0.8, 34, 0, 46.4, 36, null, 1], ['lampe', L - 1, 0.6, 0.8, 0, 45.6, 19.6],
      ...(mat ? [['acier', 0.25, 9, 0.25, 2 - L / 2, 51.3, 51.5], ['drapeau', 3, 2, 0.1, 3.6 - L / 2, 54.6, 51.5], ['acier', 1.4, 64, 1.4, L / 2, 32, 54, null, 1], ['acier', 10, 0.6, 2, L / 2, 61.7, 54], ['lampe', 9, 4, 0.8, L / 2, 64, 53.4]] : [])],
    // poteau du grillage de protection
    poteauGrillage: () => B(0.25, 5, 0.25),
    // garage des stands : box, rideau levé, enseigne d'équipe, toit
    garage: () => [['beton', 12, 7, 12, 0, 3.5, 6, null, 1], ['porte', 10, 5, 0.2, 0, 2.5, -0.05], ['enseigne', 12, 1.3, 0.3, 0, 6.2, -0.2], ['toit', 12.4, 0.4, 12.4, 0, 7.2, 6]],
    // tour de chronométrage : fût, cabine vitrée, nom sur le toit
    tourChrono: () => [['beton', 7, 40, 7, 0, 20, 0, null, 1], ['beton', 15, 1, 15, 0, 39.5, 0], ['loge', 14, 6, 14, 0, 43, 0], ['beton', 15, 1, 15, 0, 46.5, 0], ['nom', 0.6, 3.4, 14, 0, 48.7, 0]],
    // pylône des positions, face vers ±X
    pyloneScore: () => [['acier', 1.6, 8, 1.6, 0, 4, 0], ['ecran', 1.2, 30, 4.5, 0, 23, 0], ['acier', 1.6, 1, 5, 0, 38.5, 0]],
    // écran géant du classement sur deux pieds, face vers ±X (vu des deux lignes droites)
    ecranGeant: () => [...[-12, 12].map(z => ['acier', 1.4, 16, 1.4, 0, 8, z]), ['ecran', 1, 20, 34, 0, 26, 0], ...[15.5, 36.5].map(y => ['acier', 1.6, 1, 35, 0, y, 0]), ['beton', 4, 1, 30, 0, 0.5, 0]],
    // camping-car (X vers l'avant) : cellule, capucine au-dessus de la cabine, liseré à la couleur de l'instance, roues
    campingCar: () => [['caisse', 7.2, 2.6, 2.4, 0, 1.9, 0], ['caisse', 1.6, 0.8, 2.3, 3.2, 2.9, 0], ['bande', 7.24, 0.25, 2.44, 0, 1.3, 0], ['vitre', 0.1, 0.9, 2.1, 3.62, 2.2, 0],
      ...[2.4, -2.2].flatMap(x => [-1, 1].map(sd => ['pneu', 0.9, 0.9, 0.3, x, 0.45, sd * 1.05]))],
    // dirigeable : enveloppe en fuseau (forme simple), puis nacelle, empennage et écrans latéraux autour de l'origine (centre de l'enveloppe)
    enveloppe: () => { const g = new THREE.SphereGeometry(1, 24, 12); g.scale(36, 9, 9); return g; },
    // le défilé de l'aller (pts 1-6), devant la tribune nord. Figurant debout, pieds à l'origine, face vers +X ; m = 1 : majorette (jupette, bâton levé), 0 : musicien de la fanfare (shako haut, cuivre doré)
    figurant: m => [['blanc', 0.2, 0.42, 0.34, 0, 0.21, 0], ['peau', 0.18, 0.44, 0.3, 0, 0.64, 0], ['tenue', 0.3, 0.62, 0.46, 0, 1.17, 0], ['peau', 0.22, 0.24, 0.22, 0, 1.6, 0],
      ...(m ? [['tenue', 0.4, 0.22, 0.6, 0, 0.92, 0], ['blanc', 0.24, 0.2, 0.24, 0, 1.82, 0], ['tenue', 0.1, 0.55, 0.1, 0, 1.75, 0.3], ['blanc', 0.04, 1, 0.04, 0, 2.25, 0.3]]
        : [['blanc', 0.26, 0.5, 0.26, 0, 1.97, 0], ['or', 0.5, 0.3, 0.22, 0.32, 1.3, 0], ['or', 0.3, 0.3, 0.3, 0.6, 1.36, 0]])],
    // char du meeting (X vers l'avant) : tracteur, plateau à jupe, gâteau de trois étages à la couleur de l'instance (zone deco), un damier dressé en proue
    charMeeting: () => [['caisse', 2.6, 2.6, 2.6, 6.4, 1.6, 0], ['vitre', 0.1, 1, 2.3, 7.72, 2.2, 0], ['blanc', 11.2, 0.9, 3.5, 0, 0.75, 0], ['caisse', 11, 0.4, 3.4, 0, 1.4, 0],
      ['deco', 8, 1.4, 3, -0.5, 2.3, 0], ['deco', 5.4, 1.4, 2.3, -0.8, 3.7, 0], ['blanc', 2.6, 1.8, 1.6, -1, 5.3, 0], ['drapeau', 0.1, 2.4, 3.4, 3.8, 3.8, 0],
      ...[5.6, 1.5, -3.6].flatMap(x => [-1, 1].map(sd => ['pneu', 1, 1, 0.4, x, 0.5, sd * 1.5]))],
    // mât de drapeau à damier du retour (pts 13-18) : 14 m, l'étoffe vers +X
    matDamier: () => [['acier', 0.2, 14, 0.2, 0, 7, 0], ['drapeau', 4, 2.6, 0.08, 2.1, 12.6, 0]],
    // montgolfière : enveloppe en goutte (rayon 1, à l'échelle de l'instance), pointe en bas ; la nacelle est une boîte posée à part
    ballon: () => { const g = new THREE.SphereGeometry(1, 20, 14), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), k = y < 0 ? 1 + y * 0.75 : 1; p.setXYZ(i, p.getX(i) * k, y * 1.15, p.getZ(i) * k); } g.computeVertexNormals(); return g; },
    // écluse (repère de la route : X en travers, Z vers l'arrière, origine au bout de la rampe) : bajoyers de béton de chaque côté, portes busquées ouvertes contre eux,
    // passerelle de manœuvre au-dessus de la piste avec ses deux cabestans ; W = demi-largeur de la route
    ecluse: (W = 14) => [...[-1, 1].flatMap(sd => [['beton', 2.4, 6, 46, sd * (W + 2), 3, 14, null, 1], ['bois', 0.5, 5, 9, sd * (W + 0.55), 2.5, 4.6], ['bois', 0.5, 5, 9, sd * (W + 0.55), 2.5, 32],
      ['acier', 0.6, 9, 0.6, sd * (W + 1.6), 7.5, 0, null, 1], ['acier', 0.9, 1.1, 0.9, sd * (W + 2.3), 6.55, 9], ['acier', 1.8, 0.2, 0.2, sd * (W + 2.3), 7.2, 9]]),
      ['acier', 2 * W + 4, 0.7, 2.2, 0, 12.35, 0, null, 1], ['rouge', 2 * W + 4, 1, 0.1, 0, 13.2, -1.1], ['rouge', 2 * W + 4, 1, 0.1, 0, 13.2, 1.1]],
    dirigeable: () => [['nacelle', 8, 2.4, 3, 2, -9.6, 0], ['aileron', 7, 0.3, 16, -31, 0, 0], ['aileron', 7, 14, 0.3, -31, 0, 0], ['ecran', 30, 6, 0.2, 2, 0, 9.05], ['ecran', 30, 6, 0.2, 2, 0, -9.05]],
  });
})();
