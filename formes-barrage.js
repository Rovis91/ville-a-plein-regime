// Formes propres à « barrage » (Roche-Sourde) : complète le catalogue de formes.js (forme simple = géométrie, assemblage = liste de boîtes à zones). Voir METHODE-DECOR.md.
(function () {
  Object.assign(FORMES, {
    // sommet lointain : pyramide à quatre pans, de 1 m de base et de haut, à mettre à l'échelle ; origine à la base
    pic: () => { const g = new THREE.ConeGeometry(0.7, 1, 4); g.translate(0, 0.5, 0); return g; },
    // portique qui annonce un tremplin, en travers de la route de demi-largeur W : deux mâts, une banderole à chevrons
    portiqueSaut: (W = 8) => [...[-1, 1].map(sd => ['acier', 0.5, 8, 0.5, sd * (W + 0.8), 4, 0, null, 1]), ['banderole', 2 * W + 2.1, 1.8, 0.2, 0, 7.1, 0, null, 1]],
    // pylône de ligne à haute tension : quatre montants, trois consoles
    pyloneHT: () => [...[-1, 1].flatMap(a => [-1, 1].map(b => ['acier', 0.35, 34, 0.35, a * 1.6, 17, b * 1.6, null, 1])),
      ...[14, 24, 32].flatMap(y => [['acier', 4, 0.3, 4, 0, y, 0], ['acier', 0.4, 0.4, 16 - (y - 14) * 0.25, 0, y + 1.2, 0]])],
    // tour de prise d'eau : fût de béton, passerelle, cabine vitrée
    tourPrise: () => [['beton', 9, 30, 9, 0, 15, 0, null, 1], ['beton', 12, 1, 12, 0, 30.5, 0], ['vitre', 10, 4, 10, 0, 33, 0], ['beton', 12, 1, 12, 0, 35.5, 0]],
  });
})();
