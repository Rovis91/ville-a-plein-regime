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
    // temple du sommet (X = en s'éloignant de la route, origine au bord de la route, au niveau de la chaussée). De la route vers le fond : torii myōjin, allée de dalles
    // bordée de tōrō, cour de gravier ratissé fermée d'une clôture basse, pavillon d'ablutions et petit bassin, escalier entre deux murets vers une terrasse de 3 m,
    // pavillon sur plancher surélevé : piliers vermillon apparents, poutres, shōji éclairés, galerie à garde-corps ; toit de tuiles incurvé (huit pans de pente décroissante),
    // rives relevées aux angles, faîtage, oni, chigi et katsuogi ; shimenawa et shide, lanternes rouges sous l'avant-toit
    temple: () => { const r = [], P = (...b) => r.push(b), y0 = 3, yp = y0 + 0.9; // y0 : dessus de la terrasse ; yp : plancher du pavillon
      const tooro = (x, z) => { P('pierre', 1.1, 0.36, 1.1, x, 0.18, z); P('pierre', 0.46, 1.3, 0.46, x, 1.01, z); P('pierre', 0.8, 0.26, 0.8, x, 1.79, z); P('feu', 0.55, 0.52, 0.55, x, 2.18, z);
        for (const [u, v] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) P('pierre', 0.1, 0.52, 0.1, x + u * 0.29, 2.18, z + v * 0.29); P('pierre', 1.3, 0.22, 1.3, x, 2.55, z); P('pierre', 0.85, 0.18, 0.85, x, 2.75, z); P('pierre', 0.5, 0.14, 0.5, x, 2.89, z); P('pierre', 0.26, 0.3, 0.26, x, 3.1, z); };
      // la cour : gravier (2 m d'épaisseur, le sol descend un peu côté route), allée de dalles jointes, tōrō par paires
      P('gravier', 50, 2, 30, 25, -1, 0); for (let x = 5.5; x < 23.6; x += 1.2) P('pierre', 1.05, 0.14, 2.6, x, 0.07, 0); for (const x of [8, 12.5, 17, 21.5]) for (const z of [-2.9, 2.9]) tooro(x, z);
      // torii myōjin : socles noirs et bagues, piliers vermillon, nuki qui dépasse, gakuzuka, shimaki, kasagi droit au centre et relevé aux bouts ; shimenawa sous le nuki
      for (const sd of [-1, 1]) { P('noir', 0.95, 0.5, 0.95, 4, 0.25, sd * 3.2); P('vermillon', 0.62, 7.2, 0.62, 4, 3.6, sd * 3.2); P('noir', 0.72, 0.25, 0.72, 4, 0.62, sd * 3.2); }
      P('vermillon', 0.32, 0.42, 9.2, 4, 5.9, 0); P('vermillon', 0.3, 0.95, 0.42, 4, 6.6, 0); P('vermillon', 0.55, 0.38, 8.6, 4, 7.28, 0); P('noir', 0.72, 0.42, 4.2, 4, 7.66, 0);
      for (const sd of [-1, 1]) { let z = 2.1, y = 7.66; for (const [l, a] of [[1.4, 0.05], [1.3, 0.12], [1.1, 0.24]]) { const dz = l * Math.cos(a), dy = l * Math.sin(a); P('noir', 0.72, 0.42, l + 0.05, 4, y + dy / 2, sd * (z + dz / 2), [-sd * a, 0, 0]); z += dz; y += dy; } }
      P('corde', 0.5, 0.5, 6.4, 4, 5.45, 0); for (let z = -2.4; z <= 2.4; z += 1.2) P('shoji', 0.04, 0.8, 0.3, 3.72, 4.85, z);
      // clôture basse (tamagaki) le long des deux côtés de la cour : poteaux et deux lisses
      for (const sd of [-1, 1]) { for (let x = 3; x <= 29; x += 2) P('bois', 0.12, 1, 0.12, x, 0.5, sd * 14.5); P('bois', 26, 0.1, 0.08, 16, 0.35, sd * 14.5); P('bois', 26, 0.1, 0.08, 16, 0.85, sd * 14.5); }
      // pavillon d'ablutions (temizuya) : vasque de pierre et son eau, quatre poteaux, petit toit ; et un bassin bordé de pierres de l'autre côté
      P('pierre', 1.8, 0.6, 0.9, 14, 0.3, 8); P('eau', 1.6, 0.05, 0.7, 14, 0.62, 8); for (const [u, v] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) P('vermillon', 0.2, 2.6, 0.2, 14 + u * 1.3, 1.3, 8 + v * 1);
      for (const sd of [-1, 1]) P('toit', 3.6, 0.15, 1.7, 14, 2.85, 8 + sd * 0.7, [sd * 0.45, 0, 0]);
      P('eau', 5, 0.05, 3, 14, 0.04, -9); for (const [w, d, x, z] of [[5.6, 0.4, 14, -10.7], [5.6, 0.4, 14, -7.3], [0.4, 3, 11.3, -9], [0.4, 3, 16.7, -9]]) P('pierre', w, 0.3, d, x, 0.15, z);
      // escalier entre deux murets, komainu au pied, terrasse de pierre, tronc à offrandes
      for (let k = 0; k < 10; k++) P('pierre', 0.65, 0.3 * (k + 1) + 1, 7, 24.3 + k * 0.6, (0.3 * (k + 1) + 1) / 2 - 1, 0);
      for (const sd of [-1, 1]) { P('pierre', 6.8, 0.55, 0.45, 27, 1.75, sd * 3.75, [0, 0, 0.46]); P('pierre', 0.9, 0.6, 0.9, 23.2, 0.3, sd * 3.6); P('pierre', 0.6, 0.8, 0.45, 23.2, 1, sd * 3.6); P('pierre', 0.45, 0.4, 0.4, 22.95, 1.55, sd * 3.6); }
      P('pierre', 20, 4, 24, 40, 1, 0); P('bois', 1.6, 0.8, 1, 31.8, y0 + 0.4, 0);
      // pavillon : soubassement, plancher et galerie, marches, corps, shōji, petit mur blanc, piliers et poutres apparents, consoles, garde-corps
      P('pierre', 13, 0.6, 16.6, 40, y0 + 0.3, 0); P('bois', 13.6, 0.3, 17, 40, y0 + 0.75, 0); for (let k = 0; k < 3; k++) P('bois', 0.45, 0.3 * (k + 1), 3, 32.75 + k * 0.45, y0 + 0.15 * (k + 1), 0);
      P('bois', 10.2, 4.6, 13.8, 40.2, yp + 2.3, 0); P('shoji', 0.1, 3, 13.4, 35.05, yp + 1.5, 0); P('crepi', 0.1, 1.2, 13.4, 35.05, yp + 3.6, 0);
      for (const x of [34.3, 45.7]) for (const z of [-7.2, -3.6, 0, 3.6, 7.2]) { P('vermillon', 0.42, 4.6, 0.42, x, yp + 2.3, z); P('bois', 0.75, 0.4, 0.75, x, yp + 4.8, z); }
      for (const z of [-7.2, 7.2]) { P('vermillon', 0.42, 4.6, 0.42, 40, yp + 2.3, z); P('bois', 0.75, 0.4, 0.75, 40, yp + 4.8, z); }
      for (const y of [yp + 0.4, yp + 3.2, yp + 4.4]) { for (const x of [34.3, 45.7]) P('vermillon', 0.3, 0.28, 15, x, y, 0); for (const z of [-7.2, 7.2]) P('vermillon', 11.8, 0.28, 0.3, 40, y, z); }
      for (const z of [-5, 5]) P('vermillon', 0.1, 0.1, 6.6, 33.3, yp + 0.75, z); for (const z of [-8.4, 8.4]) P('vermillon', 13.4, 0.1, 0.1, 40, yp + 0.75, z); P('vermillon', 0.1, 0.1, 16.8, 46.7, yp + 0.75, 0);
      // shimenawa et shide sur la façade, lanternes rouges sous l'avant-toit
      P('corde', 0.7, 0.7, 11.5, 33.9, yp + 3.9, 0); for (let z = -4.8; z <= 4.8; z += 1.2) P('shoji', 0.04, 0.9, 0.32, 33.5, yp + 3.15, z); for (const z of [-5.4, 5.4]) P('chochin', 0.6, 0.9, 0.6, 33.6, yp + 3, z);
      // toit : faîtage le long de Z ; de chaque côté huit pans de pente décroissante (la courbe du toit), rive de bois au bord, planches de rive relevées aux pignons et aux angles
      const yr = yp + 8.7; for (const sg of [-1, 1]) { let x = 40, y = yr; for (const [l, a] of [[1.25, 0.76], [1.2, 0.66], [1.15, 0.56], [1.15, 0.46], [1.1, 0.37], [1.1, 0.28], [1.1, 0.19], [1.1, 0.1]]) { const dx = sg * l * Math.cos(a), dy = -l * Math.sin(a);
          P('toit', l + 0.12, 0.35, 20, x + dx / 2, y + dy / 2, 0, [0, 0, -sg * a], 1); for (const sd of [-1, 1]) P('rive', l + 0.12, 0.5, 0.22, x + dx / 2, y + dy / 2 + 0.12, sd * 10.1, [0, 0, -sg * a]); x += dx; y += dy; }
        P('rive', 0.25, 0.45, 20.4, x, y - 0.05, 0); for (const sd of [-1, 1]) P('rive', 1.7, 0.45, 0.24, x + sg * 0.35, y + 0.3, sd * 10.1, [0, 0, sg * 0.4]); }
      const PANS = [[1.25, 0.76], [1.2, 0.66], [1.15, 0.56], [1.15, 0.46], [1.1, 0.37], [1.1, 0.28], [1.1, 0.19], [1.1, 0.1]], demi = c => { let hx = 0; for (const [l, a] of PANS) { const dy = l * Math.sin(a); if (c <= dy) return hx + c / Math.tan(a); c -= dy; hx += l * Math.cos(a); } return hx; }; // demi-largeur du toit à c m sous le faîte
      for (let y = yp + 5.3; y < yr - 0.3; y += 0.8) for (const sd of [-1, 1]) P('bois', 2 * demi(yr - y - 0.4) - 0.3, 0.8, 0.2, 40, y, sd * 9.9); // pignons fermés, au plus près sous la courbe du toit
      P('noir', 1, 0.9, 20.6, 40, yr + 0.35, 0); P('crepi', 1.06, 0.22, 20.7, 40, yr - 0.05, 0); for (const sd of [-1, 1]) { P('noir', 1.2, 1.5, 0.5, 40, yr + 0.8, sd * 10.4); for (const u of [-1, 1]) P('rive', 0.18, 2.6, 0.3, 40 + u * 0.55, yr + 1.4, sd * 10, [0, 0, u * 0.55]); }
      for (const z of [-6, -3, 0, 3, 6]) P('noir', 1.4, 0.38, 0.38, 40, yr + 0.98, z); // katsuogi
      return r; },
    // poste électrique (Z = vers la ligne, origine au pied du portique) : plateforme de gravier sur la pente (5 m d'épaisseur : le sol plonge derrière), muret d'enceinte, portique d'arrivée à trois traverses et isolateurs,
    // deux transformateurs, jeu de barres, local de commande, lampadaire
    poste: () => { const r = [], P = (...b) => r.push(b); P('dalle', 18, 5, 22, 0, -2.3, -9); P('beton', 18, 1.4, 0.3, 0, 0.7, 2); P('beton', 18, 1.4, 0.3, 0, 0.7, -20); for (const sd of [-1, 1]) P('beton', 0.3, 1.4, 22, sd * 9, 0.7, -9);
      for (const sd of [-1, 1]) P('acier', 0.7, 22, 0.7, sd * 7.8, 11, 0); for (const y of [16, 18.5, 21]) P('acier', 16.3, 0.4, 0.5, 0, y + 0.3, 0);
      for (const [x, y] of [[-6.3, 16], [6.3, 16], [-6.3, 18.5], [6.3, 18.5], [-4.3, 21], [4.3, 21]]) P('isolant', 0.25, 1.1, 0.25, x, y - 0.25, 0.4);
      for (const x of [-4, 4]) { P('acier', 3, 2.6, 2.4, x, 1.3, -8); P('acier', 3.2, 0.3, 0.3, x, 2.75, -8); for (const d of [-1, 0, 1]) P('isolant', 0.2, 1, 0.2, x + d * 0.9, 3.3, -8); }
      P('acier', 12, 0.25, 0.25, 0, 6, -4); for (const x of [-5, 0, 5]) P('acier', 0.3, 6, 0.3, x, 3, -4); P('beton', 5, 3, 4, 4.5, 1.5, -16.5); for (const [x, z] of [[-6, -16], [6, -2]]) { P('acier', 0.15, 6, 0.15, x, 3, z); P('lampe', 0.8, 0.25, 0.8, x, 6.1, z); } P('lampe', 0.05, 0.8, 2.4, 1.97, 1.8, -16.5); return r; },
  });
})();
