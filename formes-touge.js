// Formes propres à « touge » (Karasu-tōge) : complète le catalogue de formes.js (forme simple = géométrie, assemblage = liste de boîtes à zones). Voir METHODE-DECOR.md.
// Sauf mention, X = en s'éloignant de la route, Z = le long de la route, origine au pied de l'objet.
(function () {
  const paire = f => [-1, 1].map(f);
  Object.assign(FORMES, {
    // pont de pierre sur le torrent, dans le repère de la route (X en travers) : parapets au-dessus des glissières, bandeaux sous la chaussée, culées dans les berges
    pontPierre: W => [...paire(sd => ['pierre', 0.7, 1.9, 15, sd * (W + 0.9), 0.65, 0]), ...paire(sd => ['pierre', 0.9, 0.2, 15.4, sd * (W + 0.9), 1.7, 0]),
      ...paire(sd => ['pierre', 0.6, 2.6, 15, sd * (W + 0.3), -1.4, 0]), ['pierre', 2 * W + 1, 0.8, 15, 0, -1.0, 0], ...paire(sd => ['pierre', 2 * W + 3, 9, 3, 0, -5, sd * 9])],
    // panneau de pente japonais : losange jaune (dessiné sur une plaque carrée en alphaTest, le texte reste droit), plaque blanche dessous (face vers Z, la voiture qui arrive)
    panneauPente: () => [['poteau', 0.09, 2.9, 0.09, 0, 1.45, 0], ['plaque', 1.2, 1.2, 0.05, 0, 2.6, 0.06], ['sous', 1.0, 0.42, 0.05, 0, 1.8, 0.06]],
    // panneau touristique brun, deux poteaux (face vers Z)
    panneauVue: () => [...paire(sd => ['poteau', 0.1, 2.6, 0.1, sd * 1.1, 1.3, 0]), ['plaque', 2.6, 1.0, 0.06, 0, 2.2, 0.06]],
    // sanctuaire de montagne : torii vermillon au bord, escalier de pierre qui monte dans la pente, tōrō de part et d'autre, petit oratoire en haut
    sanctuaire: () => [...paire(sd => ['vermillon', 0.42, 4.6, 0.42, 0, 2.3, sd * 1.9]), ...paire(sd => ['noir', 0.6, 2.4, 0.6, 0, -0.8, sd * 1.9]),
      ['vermillon', 0.3, 0.3, 5.2, 0, 3.5, 0], ['vermillon', 0.25, 0.6, 0.3, 0, 4.05, 0], ['vermillon', 0.5, 0.32, 5.8, 0, 4.5, 0], ['noir', 0.62, 0.32, 6.2, 0, 4.82, 0],
      ...paire(sd => ['noir', 0.62, 0.3, 0.9, 0, 4.92, sd * 3.2, [sd * 0.3, 0, 0]]),
      ...Array.from({ length: 14 }, (_, k) => ['marche', 0.46, 2 + k * 0.22, 2.6, 1.6 + k * 0.45, (2 + k * 0.22) / 2 - 2 + 0.22, 0]),
      ...[2.5, 6.5].flatMap(x => paire(sd => [['marche', 0.6, 0.3, 0.6, x, 0.15 + (x - 1.6) * 0.49, sd * 2], ['marche', 0.22, 0.8, 0.22, x, 0.7 + (x - 1.6) * 0.49, sd * 2],
        ['marche', 0.5, 0.15, 0.5, x, 1.17 + (x - 1.6) * 0.49, sd * 2], ['feu', 0.36, 0.34, 0.36, x, 1.42 + (x - 1.6) * 0.49, sd * 2], ['marche', 0.72, 0.18, 0.72, x, 1.68 + (x - 1.6) * 0.49, sd * 2]]).flat()),
      ['marche', 5, 0.4, 5, 9.6, 3.1, 0], ['bois', 3.2, 2.2, 3.6, 10, 4.4, 0], ['feu', 0.06, 1.2, 1.6, 8.38, 4.2, 0], ...paire(sd => ['toit', 4.4, 0.25, 2.6, 10, 5.85, sd * 1.15, [sd * 0.5, 0, 0]])],
    // cerf sika (X = vers l'avant) : corps, pattes fines, cou, tête, oreilles, petits bois, miroir blanc de la croupe ; les yeux renvoient les phares
    cerf: () => [['poil', 1.25, 0.55, 0.45, 0, 1.0, 0, null, 1], ...paire(a => paire(c => ['poil', 0.09, 0.78, 0.09, a * 0.48, 0.39, c * 0.15])).flat(),
      ['poil', 0.26, 0.6, 0.24, 0.62, 1.35, 0, [0, 0, -0.55]], ['poil', 0.46, 0.22, 0.22, 0.86, 1.63, 0], ['croupe', 0.08, 0.38, 0.36, -0.64, 1.02, 0],
      ...paire(sd => ['poil', 0.06, 0.2, 0.08, 0.72, 1.82, sd * 0.13, [sd * 0.5, 0, 0]]), ...paire(sd => ['bois', 0.05, 0.42, 0.05, 0.74, 1.95, sd * 0.07, [sd * 0.25, 0, 0.2]]),
      ...paire(sd => ['yeux', 0.07, 0.08, 0.06, 0.98, 1.68, sd * 0.09])],
    // enseigne haute de la supérette, sur mât : panneau face à Z (la voiture qui arrive)
    enseigneHaute: () => [['acier', 0.6, 8, 0.6, 0, 4, 0], ['enseigne', 5.4, 3.4, 0.5, 0, 9.4, 0]],
    // distributeur de boissons isolé, face vers -X (la route) : caisse blanche, façade éclairée, auvent, bac à canettes, socle de béton
    distribIsole: () => [['socle', 1.6, 2, 2.6, 0, -0.9, 0], ['caisse', 0.85, 1.85, 1.05, 0, 1.0, 0], ['face', 0.04, 1.45, 0.88, -0.45, 1.1, 0], ['caisse', 1.0, 0.08, 1.2, -0.05, 1.96, 0],
      ['bac', 0.42, 0.75, 0.42, -0.1, 0.48, 0.85]],
    // silhouette debout ; h = taille
    passant: (h = 1) => [['ombre', 0.26, 0.82 * h, 0.34, 0, 0.41 * h, 0], ['ombre', 0.3, 0.62 * h, 0.46, 0, 1.13 * h, 0], ['ombre', 0.22, 0.24 * h, 0.2, 0, 1.58 * h, 0]],
    // pylône à haute tension (consoles le long de X) et son feu d'obstacle au sommet
    pyloneHT: () => [...paire(a => paire(b => ['acier', 0.45, 40, 0.45, a * 2.2, 19, b * 2.2, [b * 0.06, 0, -a * 0.06]])).flat(),
      ...[10, 20, 30].flatMap(y => [['acier', 5.2 - y * 0.08, 0.25, 0.25, 0, y, 2.2 - y * 0.04], ['acier', 5.2 - y * 0.08, 0.25, 0.25, 0, y, -2.2 + y * 0.04]]),
      ...[27, 32, 37].map(y => ['acier', y === 37 ? 9 : 13, 0.5, 0.6, 0, y, 0]), ['acier', 0.4, 3, 0.4, 0, 40.5, 0], ['feu', 0.6, 0.6, 0.6, 0, 42.2, 0]],
    // jizō de bord de route : trois statues de pierre à bavoir rouge sous un auvent de bois, une bougie ; face vers -X
    jizos: () => [['socle', 2.4, 2, 1.4, 0, -0.9, 0], ...[-0.65, 0, 0.65].flatMap(z => [['pierre', 0.32, 0.6, 0.28, 0, 0.42, z], ['pierre', 0.24, 0.24, 0.22, 0, 0.86, z], ['bavoir', 0.3, 0.22, 0.34, -0.03, 0.62, z]]),
      ...paire(sd => ['bois', 0.1, 1.5, 0.1, -0.5, 0.85, sd * 1.05]), ...paire(sd => ['bois', 0.1, 1.5, 0.1, 0.5, 0.85, sd * 1.05]), ['toit', 1.4, 0.12, 2.6, 0, 1.65, 0, [0, 0, 0.25]], ['feu', 0.06, 0.12, 0.06, -0.45, 0.2, 0.32]],
    // cabine téléphonique éclairée de l'intérieur (verre teinté vert), face vers -X
    cabine: () => [['socle', 1.6, 2, 1.6, 0, -0.9, 0], ['verre', 0.95, 2.1, 0.95, 0, 1.15, 0], ['cadre', 1.05, 0.2, 1.05, 0, 2.3, 0], ['cadre', 1.05, 0.12, 1.05, 0, 0.16, 0]],
  });
})();
