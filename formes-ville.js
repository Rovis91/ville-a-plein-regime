// Formes propres à « ville » : complète le catalogue de formes.js (mêmes conventions : forme simple = géométrie, assemblage = liste de boîtes à zones). Voir METHODE-DECOR.md.
(function () {
  Object.assign(FORMES, {
    // étal du marché de nuit : X le long du comptoir, façade vers -Z (la rue) ; comptoir, réchaud fumant, quatre perches, bâche inclinée vers la rue (zone toile, teintée par élément), guirlande d'ampoules
    etal: () => [['comptoir', 3.4, 1, 1.6, 0, 0.5, 0], ['rechaud', 1, 0.3, 0.8, -0.8, 1.15, 0], ['comptoir', 3.4, 1.6, 0.2, 0, 0.8, 1.6],
      ...[-1.65, 1.65].flatMap(x => [['perche', 0.1, 2.7, 0.1, x, 1.35, -0.75], ['perche', 0.1, 2.9, 0.1, x, 1.45, 1.6]]),
      ['toile', 3.9, 0.08, 3, 0, 2.75, 0.35, [-0.16, 0, 0]], ['ampoules', 3.6, 0.12, 0.12, 0, 2.35, -0.8]],
  });
})();
