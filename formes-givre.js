// Formes propres à « givre » (Nuit Blanche) : complète le catalogue de formes.js (forme simple = géométrie, assemblage = liste de boîtes à zones). Voir METHODE-DECOR.md.
(function () {
  const A = 0.62; // pente du toit du refuge (rad)
  Object.assign(FORMES, {
    // pylône de la ligne à haute tension de la vallée (treillis : quatre montants, trois consoles)
    pyloneCol: () => [...[-1, 1].flatMap(a => [-1, 1].map(b => ['acier', 0.35, 34, 0.35, a * 1.6, 17, b * 1.6, null, 1])),
      ...[14, 24, 32].flatMap(y => [['acier', 4, 0.3, 4, 0, y, 0], ['acier', 0.4, 0.4, 16 - (y - 14) * 0.25, 0, y + 1.2, 0]])],
    // jalon à neige : le piquet qui dépasse des congères au bord des routes de col, coiffé d'une bague rétroréfléchissante
    jalon: () => [['piquet', 0.14, 2.8, 0.14, 0, 1.4, 0], ['bague', 0.2, 0.35, 0.2, 0, 2.45, 0]],
    // refuge du col, pignon vers la route (X = vers la route) : murs de planches sur un soubassement de pierre, toit à deux pans chargé de neige, deux fenêtres éclairées et la porte au pignon, cheminée
    refuge: () => [['pierre', 9.4, 1.2, 7.4, 0, 0.1, 0], ['mur', 9, 3.4, 7, 0, 2.2, 0, null, 1], ['mur', 9, 1.6, 3.4, 0, 4.4, 0],
      ...[-1, 1].map(sd => ['toit', 9.8, 0.5, 5.4, 0, 4.9, sd * 2, [sd * A, 0, 0], 1]), ['pierre', 0.9, 2.4, 0.9, -2.5, 6, 1.2],
      ...[-1, 1].map(sd => ['fenetre', 0.15, 1.1, 1.3, 4.55, 2.5, sd * 2.1]), ['porte', 0.15, 2.1, 1, 4.55, 1.75, 0], ['fenetre', 1.4, 1, 0.15, -1, 2.5, 3.55]],
    // panneau du col : deux poteaux, une plaque
    panneauCol: () => [...[-1, 1].map(sd => ['poteau', 0.14, 3, 0.14, 0, 1.5, sd * 1.7]), ['plaque', 0.1, 1.3, 4, 0, 2.9, 0]],
  });
})();
