// Formes propres à « wangan » : complète le catalogue de formes.js (mêmes conventions : assemblage = liste de boîtes à zones). Voir METHODE-DECOR.md.
// Repère : origine au pied de l'objet ; pour ce qui se pose sur la route (péage), X en travers (positif à droite), Z vers l'arrière.
(function () {
  const paire = f => [-1, 1].map(f);
  Object.assign(FORMES, {
    // phare de digue rouge et blanc : socle, fût en six bandes qui s'affinent, galerie, lanterne (lumineuse), coupole ; la lanterne est à 27,8 m
    phare: () => [['beton', 8, 2, 8, 0, 1, 0], ...[0, 1, 2, 3, 4, 5].map(k => [k % 2 ? 'blanc' : 'rouge', 4.2 - k * 0.3, 4, 4.2 - k * 0.3, 0, 4 + k * 4, 0]),
      ['acier', 5.4, 0.5, 5.4, 0, 26.25, 0], ...paire(sx => ['acier', 0.12, 1.1, 5.4, sx * 2.65, 27, 0]), ['lampe', 2.2, 2.6, 2.2, 0, 27.8, 0], ['rouge', 2.8, 1, 2.8, 0, 29.6, 0], ['acier', 0.2, 2, 0.2, 0, 31, 0]],
    // grue à tour de chantier : mât en treillis de 60 m, flèche de 50 m vers +X, contre-flèche et lest vers -X, cabine sous la flèche, pointe en A
    grueTour: () => [['beton', 7, 1.2, 7, 0, 0.6, 0], ['treillis', 2, 60, 2, 0, 30, 0], ['treillis', 52, 1.6, 1.6, 25, 61, 0], ['acier', 18, 1, 2.4, -9, 61, 0], ['beton', 4, 3, 2.8, -15, 59.8, 0],
      ['cabine', 2.6, 2.4, 2.4, 1.6, 59, 1.8], ['vitre', 2.7, 1, 2.5, 1.6, 59.3, 1.8], ['treillis', 1.2, 7, 1.2, 0, 65.3, 0], ['acier', 0.2, 0.2, 40, 18, 64, 0, [0, 1.5708, -0.13]], ['acier', 0.2, 0.2, 16, -8, 64.5, 0, [0, 1.5708, 0.4]],
      ['acier', 0.15, 22, 0.15, 30, 49, 0], ['acier', 1.6, 1, 1.2, 30, 60, 0], ['acier', 1.2, 1, 1.2, 30, 37.6, 0]], // chariot, câble et moufle
    // guérite de péage : îlot de béton à nez jaune, cabine aux vitres éclairées, auvent plat
    guerite: () => [['beton', 2.4, 0.4, 7, 0, 0.2, 0], ['nez', 2.4, 0.9, 0.6, 0, 0.45, -3.6], ['cabine', 1.8, 2.6, 2.6, 0, 1.7, 0], ['vitre', 1.9, 1.1, 2.7, 0, 2.15, 0], ['cabine', 2.2, 0.2, 3, 0, 3.1, 0]],
    // auvent de la gare de péage, L m en travers : dalle, sous-face éclairée au sodium, bandeau d'enseigne côté arrivée, poteaux hors chaussée (à ±L/2)
    auventPeage: L => [['toit', L, 1.2, 14, 0, 8.2, 0], ['lampe', L - 2, 0.1, 12, 0, 7.55, 0], ['enseigne', L * 0.5, 1.6, 0.2, 0, 8.4, 7.1],
      ...paire(sx => paire(sz => ['acier', 0.8, 7.6, 0.8, sx * L / 2, 3.8, sz * 5])).flat()],
    // enseigne de love hotel sur mât : caisson lumineux, cœur penché au-dessus, bandeau « vacant » dessous
    enseigneHotel: () => [['acier', 0.8, 16, 0.8, 0, 8, 0], ['enseigne', 10, 4, 0.6, 0, 17, 0], ['coeur', 3.2, 3.2, 0.6, 0, 21.6, 0, [0, 0, 0.785]], ['vacant', 6, 1.2, 0.5, 0, 14.2, 0]],
  });
})();
