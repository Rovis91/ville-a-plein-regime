// Formes propres à « canal » : complète le catalogue de formes.js (mêmes conventions : forme simple = géométrie, assemblage = liste de boîtes à zones). Voir METHODE-DECOR.md.
// Repère des pièces du circuit : origine au sol au milieu de la façade, X le long de la piste, Z en s'éloignant de la piste (vers le fond).
(function () {
  const A1 = Math.atan2(14, 24), A2 = Math.atan2(16, 22); // pentes des gradins bas et haut
  const B = (w, h, d, H = h) => { const g = new THREE.BoxGeometry(w, h, d); g.userData.dim = [w, H, d]; return g; };
  Object.assign(FORMES, {
    // tribune de 42 m : podium à banderole, gradins bas (foule), escaliers, loges vitrées, gradins hauts (foule2), mur du fond, toit en porte-à-faux
    // sur fermes d'acier, rampe de projecteurs sous le bord du toit, drapeau à damier ; mat = 1 ajoute un mât de projecteurs de 64 m au bout
    tribune: mat => [['beton', 42, 3, 2, 0, 1.5, 1], ['banderole', 42, 1.6, 0.2, 0, 1.7, -0.05],
      ['foule', 42, 0.6, 27.8, 0, 10, 14, [-A1, 0, 0], 1], ...[-14, 0, 14].map(x => ['escalier', 1.4, 0.8, 27.8, x, 10, 14, [-A1, 0, 0]]),
      ['loge', 42, 4, 3, 0, 19, 27.5], ['beton', 42, 1, 6, 0, 21.5, 28], ['banderole', 42, 1.2, 0.2, 0, 22.6, 24.9],
      ['foule2', 42, 0.6, 27.2, 0, 30, 39, [-A2, 0, 0], 1], ...[-7, 7].map(x => ['escalier', 1.4, 0.8, 27.2, x, 30, 39, [-A2, 0, 0]]),
      ['beton', 42, 40, 2, 0, 20, 51, null, 1], ...[-20.5, 20.5].flatMap(x => [['acier', 1, 6, 1, x, 43, 51], ['acier', 0.8, 3, 34, x, 48.2, 36]]),
      ['toit', 44, 0.8, 34, 0, 46.4, 36, null, 1], ['lampe', 40, 0.6, 0.8, 0, 45.6, 19.6],
      ['acier', 0.25, 9, 0.25, -18, 51.3, 51.5], ['drapeau', 3, 2, 0.1, -16.4, 54.6, 51.5],
      ...(mat ? [['acier', 1.4, 64, 1.4, 21, 32, 54, null, 1], ['acier', 10, 0.6, 2, 21, 61.7, 54], ['lampe', 9, 4, 0.8, 21, 64, 53.4]] : [])],
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
    dirigeable: () => [['nacelle', 8, 2.4, 3, 2, -9.6, 0], ['aileron', 7, 0.3, 16, -31, 0, 0], ['aileron', 7, 14, 0.3, -31, 0, 0], ['ecran', 30, 6, 0.2, 2, 0, 9.05], ['ecran', 30, 6, 0.2, 2, 0, -9.05]],
  });
})();
