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
    // renne (X = vers l'avant) : corps, pattes, cou tendu, tête, museau, les bois en fourche ; b = taille des bois (le cerf les porte plus grands)
    renne: (b = 1) => [['poil', 1.6, 0.8, 0.7, 0, 1.2, 0, null, 1], ...[-1, 1].flatMap(a => [-1, 1].map(c => ['patte', 0.15, 0.9, 0.15, a * 0.6, 0.45, c * 0.22])),
      ['poil', 0.35, 0.7, 0.3, 0.85, 1.6, 0, [0, 0, -0.6]], ['poil', 0.6, 0.3, 0.3, 1.15, 1.95, 0], ['nez', 0.1, 0.13, 0.13, 1.48, 1.95, 0], ['ventre', 0.3, 0.25, 0.72, -0.85, 1.35, 0],
      ...[-1, 1].flatMap(sd => [['bois', 0.08, 0.8 * b, 0.08, 1.0, 2.05 + 0.4 * b, sd * 0.25, [sd * 0.4, 0, 0.3]], ['bois', 0.5 * b, 0.06, 0.06, 1.1, 2.1 + 0.55 * b, sd * (0.2 + 0.2 * b), [0, 0, 0.5]],
        ['bois', 0.06, 0.4 * b, 0.06, 0.8, 2.1 + 0.6 * b, sd * (0.25 + 0.2 * b), [sd * 0.6, 0, -0.2]]])],
    // traîneau du Père Noël (X = vers l'avant) : patins dorés relevés devant, caisse rouge et dossier, la hotte, et lui, assis, rênes en main
    traineau: () => [...[-1, 1].flatMap(sd => [['patin', 2.8, 0.1, 0.1, 0, 0.1, sd * 0.6], ['patin', 0.1, 0.6, 0.1, 1.45, 0.35, sd * 0.6, [0, 0, 0.3]], ['patin', 0.08, 0.5, 0.08, 0, 0.35, sd * 0.6]]),
      ['caisse', 2.2, 0.7, 1.4, 0, 0.75, 0, null, 1], ['caisse', 0.3, 1.0, 1.4, -1.0, 1.4, 0], ['caisse', 0.25, 0.6, 1.4, 1.0, 1.25, 0, [0, 0, -0.4]], ['patin', 2.24, 0.08, 1.44, 0, 1.12, 0],
      ['sac', 0.8, 0.9, 1.0, -0.5, 1.55, 0], ['costume', 0.6, 0.8, 0.7, 0.2, 1.5, 0], ['ceinture', 0.62, 0.12, 0.72, 0.2, 1.4, 0], ['peau', 0.35, 0.35, 0.35, 0.25, 2.08, 0],
      ['barbe', 0.2, 0.42, 0.4, 0.42, 1.95, 0], ['costume', 0.38, 0.3, 0.38, 0.22, 2.38, 0, [0, 0, 0.3]], ['barbe', 0.42, 0.08, 0.42, 0.25, 2.25, 0], ['barbe', 0.13, 0.13, 0.13, 0.05, 2.5, 0],
      ...[-1, 1].map(sd => ['costume', 0.6, 0.18, 0.18, 0.55, 1.65, sd * 0.38])],
    // kota, la tente lapone en cône de toile et de perches
    kota: () => { const g = new THREE.ConeGeometry(2.6, 5.5, 9); g.translate(0, 2.75, 0); return g; },
    // chasse-neige de la DDE garé (X = vers l'avant) : châssis, cabine vitrée, benne à sel, lame biaise à rayures devant, six roues (jante et pneu croisés, comme roues de formes.js).
    // Le gyrophare n'en fait pas partie : il clignote, il est posé à part (hors fusion du décor fixe)
    chasseNeige: () => [['chassis', 7, 0.5, 2.3, 0, 0.95, 0], ['caisse', 2.2, 2, 2.4, 2, 2.2, 0, null, 1], ['vitre', 0.1, 0.9, 2.1, 3.12, 2.65, 0], ['vitre', 1.5, 0.8, 2.44, 2.1, 2.65, 0],
      ['caisse', 4.2, 1.7, 2.4, -1.5, 2.05, 0, null, 1], ['neige', 4.3, 0.3, 2.5, -1.5, 3.05, 0], ['neige', 2.3, 0.2, 2.5, 2, 3.3, 0], ['chassis', 1, 0.3, 1, 3.6, 0.9, 0],
      ['lame', 0.3, 1.2, 3.4, 4.25, 0.75, 0, [0, 0.35, 0]], ['neige', 1.2, 0.6, 3.6, 4.9, 0.3, 0, [0, 0.35, 0]],
      ...[2.2, -1, -2.4].flatMap(x => [-1, 1].flatMap(sd => [0, 0.785].map(a => [a ? 'pneu' : 'roue', 1.1, 1.1, 0.4, x, 0.55, sd * 1.05, [0, 0, a]])))],
    // pylône de télésiège (origine au pied, la ligne suit Z, la traverse X) : fût, traverse et ses deux trains de galets, chargés de neige
    pyloneTelesiege: () => [['acier', 0.7, 9, 0.7, 0, 4.5, 0, null, 1], ['acier', 4.4, 0.3, 0.3, 0, 9, 0], ...[-1, 1].map(sd => ['acier', 0.25, 0.25, 0.9, sd * 2.1, 8.7, 0]), ['neige', 4.5, 0.2, 0.45, 0, 9.25, 0]],
    // siège du télésiège, figé (origine au câble, X = dans le sens de la ligne) : suspente, assise et dossier, la neige tombée dessus
    siege: () => [['acier', 0.08, 1.6, 0.08, 0, -0.8, 0], ['acier', 0.08, 0.08, 1.4, 0, -0.05, 0], ['siege', 0.6, 0.12, 1.3, 0, -1.65, 0], ['siege', 0.1, 0.6, 1.3, -0.3, -1.35, 0], ['neige', 0.6, 0.1, 1.3, 0, -1.55, 0]],
    // chouette harfang perchée (origine aux serres, X = vers où elle regarde) : corps, tête ronde, aigrettes, yeux d'ambre qui renvoient les phares
    chouette: () => [['plume', 0.26, 0.34, 0.24, 0, 0.17, 0], ['plume', 0.24, 0.2, 0.24, 0, 0.44, 0], ['tache', 0.27, 0.06, 0.25, 0, 0.12, 0], ['tache', 0.27, 0.04, 0.25, 0, 0.25, 0],
      ...[-1, 1].flatMap(sd => [['oeil', 0.03, 0.06, 0.06, 0.12, 0.46, sd * 0.055], ['plume', 0.05, 0.08, 0.05, 0, 0.58, sd * 0.08], ['tache', 0.2, 0.25, 0.04, -0.02, 0.2, sd * 0.13]]), ['bec', 0.05, 0.05, 0.04, 0.13, 0.41, 0]],
    // panneau « verglas » à 150 m de chaque plaque (plaque face à X), un feu bleu au sommet, comme les balises des cols
    panneauVerglas: () => [['poteau', 0.14, 3.6, 0.14, 0, 1.8, 0], ['plaque', 0.08, 1.1, 2.9, 0.08, 2.9, 0], ['feu', 0.45, 0.45, 0.45, 0, 3.8, 0]],
  });
})();
