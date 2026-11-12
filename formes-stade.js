// Formes propres à « stade » (Grand Vacarme) : complète le catalogue de formes.js (forme simple = géométrie, assemblage = liste de boîtes à zones). Voir METHODE-DECOR.md.
// Repère du gradin : origine au sol au milieu de la façade, X le long du pourtour, Z vers le fond (en s'éloignant de la piste).
(function () {
  const A1 = Math.atan2(15, 26), A2 = Math.atan2(18, 22); // pentes de l'anneau bas et de l'anneau haut
  Object.assign(FORMES, {
    // module de gradin d'arène de L m, posé côte à côte sur tout le pourtour : podium à banderole, anneau bas (foule), escalier, loges vitrées,
    // anneau haut (foule2), mur du fond jusqu'au toit, passerelle technique et sa rampe de projecteurs
    gradinArene: (L = 14) => [['beton', L, 4, 2, 0, 2, 1], ['banderole', L, 1.6, 0.2, 0, 2.6, -0.05],
      ['foule', L, 0.6, 30, 0, 11.5, 15, [-A1, 0, 0], 1], ['escalier', 1.4, 0.8, 30, 0.7 - L / 2, 11.5, 15, [-A1, 0, 0]],
      ['loge', L, 4, 3, 0, 21, 29.5], ['beton', L, 1, 6, 0, 23.5, 30], ['banderole2', L, 1.2, 0.2, 0, 24.6, 26.9],
      ['foule2', L, 0.6, 28.4, 0, 33, 41, [-A2, 0, 0], 1], ['escalier', 1.4, 0.8, 28.4, 0.7 - L / 2, 33, 41, [-A2, 0, 0]],
      ['beton', L, 64, 2, 0, 32, 53, null, 1], ['acier', L, 0.5, 3, 0, 53, 44], ['lampe', L - 2, 0.6, 0.8, 0, 52.5, 42.8]],
    // ferme de la charpente, de L m de portée le long de Z, origine en son milieu : deux membrures, une âme en treillis, une rampe de projecteurs tous les 50 m
    fermeToit: L => [['acier', 1.4, 0.8, L, 0, 3.5, 0], ['acier', 1.4, 0.8, L, 0, -3.5, 0], ['treillis', 0.4, 6.2, L, 0, 0, 0],
      ...Array.from({ length: Math.floor((L - 60) / 50) + 1 }, (_, k) => 30 - L / 2 + k * 50).flatMap(z => [['acier', 12, 0.8, 3, 0, -4.2, z], ['lampe', 11, 0.5, 2.2, 0, -4.8, z]])],
    // cube d'affichage suspendu au centre de l'arène, origine en son centre : quatre écrans, deux ceintures, quatre suspentes
    cubeScore: () => [['ecran', 24, 13, 0.6, 0, 0, 12], ['ecran', 24, 13, 0.6, 0, 0, -12], ['ecran', 0.6, 13, 24, 12, 0, 0], ['ecran', 0.6, 13, 24, -12, 0, 0],
      ['acier', 25.4, 1.2, 25.4, 0, 7.1, 0], ['bande', 25.4, 1.2, 25.4, 0, -7.1, 0], ...[-1, 1].flatMap(a => [-1, 1].map(b => ['acier', 0.5, 22, 0.5, a * 9, 18.7, b * 9]))],
  });
})();
