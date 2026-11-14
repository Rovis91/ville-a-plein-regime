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
    // la scène, le mur de la butte et l'arche de feu de l'aire centrale, origine au centre de l'aire (M.place.c) : mêmes emprises que ses piles dans cartes.js.
    // Scène de 49 × 6 m à l'est, bandeau lumineux sur ses deux faces ; mur à chevrons de 25 m à l'ouest ; entre les deux, un portique de 37 m de portée, enseigne suspendue, 8 m de passage dessous
    sceneArene: () => [['beton', 49, 4, 6, 34.5, 2, 0], ['ecran', 46, 3, 0.3, 34.5, 2.2, 3.1], ['ecran', 46, 3, 0.3, 34.5, 2.2, -3.1], ['bande', 49.4, 0.5, 6.4, 34.5, 4.25, 0],
      ['chevrons', 25, 2.6, 2, -35.5, 1.3, 0], ['acier', 1.6, 11, 1.6, -24, 5.5, 0], ['acier', 1.6, 7, 1.6, 11, 7.5, 0], ['acier', 37, 1.4, 1.8, -6.5, 11.3, 0], ['enseigne', 26, 2.2, 0.4, -6.5, 9.4, 0]],
    // module de la tribune qui enjambe le vomitoire, de L m, origine sur la coque du tunnel au-dessus de son bord intérieur (mêmes axes que gradinArene) :
    // façade à banderole au-dessus du portail, un anneau de foule qui monte sur 30 m vers le pourtour, le mur du fond
    tribuneVomitoire: (L = 14) => [['beton', L, 3, 1.4, 0, 1.5, 0.7], ['banderole', L, 1.3, 0.2, 0, 1.6, -0.08],
      ['foule', L, 0.6, 30, 0, 10.5, 14, [-A1, 0, 0], 1], ['beton', L, 22, 1.5, 0, 11, 27.5, null, 1]],
    // monster truck garé, origine au sol sous son milieu, X = l'avant : quatre roues de 2,2 m (deux boîtes croisées chacune), châssis tubulaire haut perché,
    // caisse de pick-up à flammes peintes, cabine vitrée, rampe de phares sur le toit
    monsterTruck: () => [...[-1.9, 1.9].flatMap(x => [-1.55, 1.55].flatMap(z => [['pneu', 2.2, 2.2, 1.1, x, 1.1, z], ['pneu', 2.2, 2.2, 1.1, x, 1.1, z, [0, 0, 0.785]], ['acier', 0.25, 1.6, 0.25, x, 2, z * 0.6, [z > 0 ? 0.5 : -0.5, 0, 0]]])),
      ['chassis', 4.6, 0.35, 1.5, 0, 2.6, 0, null, 1], ['caisse', 5.2, 1.1, 2.5, 0, 3.3, 0, null, 1], ['flammes', 2.4, 0.5, 2.54, 1.3, 3.2, 0], ['caisse', 2.1, 1.05, 2.3, -0.2, 4.4, 0],
      ['vitre', 0.1, 0.75, 2, 0.88, 4.45, 0], ['vitre', 1.7, 0.6, 2.34, -0.25, 4.5, 0], ['acier', 0.3, 0.3, 2.1, -0.2, 5.05, 0], ['lampe', 0.25, 0.3, 1.8, 0, 5.05, 0]],
    // éventail de n rayons laser de L m partant de l'origine vers le bas, écartés de e rad
    eventailLaser: (n = 5, L = 130, e = 0.3) => Array.from({ length: n }, (_, k) => { const a = (k - (n - 1) / 2) * e; return ['rayon', 0.3, L, 0.3, Math.sin(a) * L / 2, -Math.cos(a) * L / 2, 0, [0, 0, a]]; }),
  });
})();
