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
    // bateaux de plaisance, origine à la ligne de flottaison au milieu, X vers l'avant, longueur 1 (mis à l'échelle par instance : [x, y, z, ry, L, L, L]) ;
    // voilier : coque, pont de teck, rouf aux hublots éclairés, mât et bôme ; vedette : coque, pont, cabine haute vitrée, fly à pare-brise
    voilier: () => [['coque', 1, 0.12, 0.32, 0, 0.02, 0], ['coque', 0.18, 0.1, 0.22, 0.56, 0.03, 0], ['pont', 0.92, 0.012, 0.28, 0.02, 0.085, 0], ['hublots', 0.32, 0.06, 0.18, -0.04, 0.12, 0],
      ['mat', 0.012, 1.25, 0.012, 0.1, 0.71, 0], ['mat', 0.42, 0.012, 0.012, -0.12, 0.24, 0]],
    vedette: () => [['coque', 1, 0.16, 0.34, 0, 0.04, 0], ['coque', 0.16, 0.14, 0.24, 0.57, 0.05, 0], ['pont', 0.94, 0.012, 0.3, 0, 0.125, 0], ['hublots', 0.44, 0.12, 0.26, -0.06, 0.19, 0],
      ['coque', 0.36, 0.02, 0.28, -0.08, 0.26, 0], ['hublots', 0.1, 0.06, 0.24, 0.06, 0.3, 0]],
    // yacht de 42 m, origine à la ligne de flottaison au milieu, X vers l'avant : coque, trois ponts en retrait vitrés, fly avec bar, mât radar ; la fête est sur le pont arrière et le fly
    yacht: () => [['coque', 42, 3.2, 8.4, 0, 0.6, 0], ['coque', 6, 2.8, 6, 23, 0.8, 0], ['pont', 40, 0.15, 8, -0.5, 2.3, 0],
      ['blanc', 24, 2.6, 7.2, 2, 3.6, 0], ['hublots', 24.2, 1.2, 7.3, 2, 3.7, 0], ['blanc', 18, 2.4, 6.4, 0, 6.1, 0], ['hublots', 18.2, 1.1, 6.5, 0, 6.2, 0],
      ['pont', 22, 0.15, 7, -3, 7.4, 0], ['blanc', 7, 1.2, 1.2, 4, 8.1, 0], ['blanc', 0.4, 4, 0.4, 2, 9.4, 0], ['blanc', 2.6, 0.3, 0.3, 2, 10.6, 0],
      ...paire(sz => ['blanc', 14, 0.9, 0.12, -11, 2.85, sz * 3.9]), ...paire(sz => ['blanc', 10, 0.9, 0.12, -7, 7.9, sz * 3.4])],
    // fêtard : une silhouette sombre debout (corps, tête), 1,75 m
    fetard: () => [['corps', 0.5, 1.4, 0.32, 0, 0.7, 0], ['corps', 0.24, 0.26, 0.24, 0, 1.57, 0]],
    // borne lumineuse de quai, 1,1 m : fût et tête éclairée
    borneQuai: () => [['fut', 0.22, 0.9, 0.22, 0, 0.45, 0], ['lampe', 0.28, 0.22, 0.28, 0, 1, 0]],
    // ponton : platelage sur flotteurs, l m de long (le long de X), 2,4 m de large
    ponton: l => [['planches', l, 0.25, 2.4, 0, 0.45, 0], ...[-1, 1].map(sz => ['flotteur', l, 0.5, 0.4, 0, 0.1, sz * 0.95])],
    // palettes de bois empilées (n) ; caisse filmée posée dessus ou non
    palettes: (n, charge) => [...Array.from({ length: n }, (_, k) => ['bois', 1.2, 0.14, 1, 0, 0.07 + k * 0.15, 0]), ...(charge ? [['film', 1.1, 1, 0.95, 0, n * 0.15 + 0.5, 0]] : [])],
    // chariot élévateur : caisse, contrepoids, mât et fourches (vers +X), toit de protection sur quatre montants, roues
    chariot: () => [['caisse', 2.2, 1, 1.2, 0, 0.75, 0], ['contrepoids', 0.6, 1, 1.15, -1.2, 0.8, 0], ['acier', 0.12, 3.2, 0.9, 1.25, 1.6, 0], ...paire(sz => ['acier', 1.1, 0.06, 0.14, 1.85, 0.12, sz * 0.32]),
      ...paire(sx => paire(sz => ['acier', 0.07, 1.1, 0.07, sx * 0.75 + 0.1, 1.8, sz * 0.52])).flat(), ['caisse', 1.8, 0.07, 1.2, 0.1, 2.35, 0],
      ...[-0.7, 0.7].flatMap(x => paire(sz => ['roue', 0.6, 0.6, 0.25, x, 0.3, sz * 0.55]))],
    enseigneHotel: () => [['acier', 0.8, 16, 0.8, 0, 8, 0], ['enseigne', 10, 4, 0.6, 0, 17, 0], ['coeur', 3.2, 3.2, 0.6, 0, 21.6, 0, [0, 0, 0.785]], ['vacant', 6, 1.2, 0.5, 0, 14.2, 0]],
  });
})();
