// Formes propres à « terre » (Spéciale des Ocres) : complète le catalogue de formes.js (forme simple = géométrie, assemblage = liste de boîtes à zones). Voir METHODE-DECOR.md.
(function () {
  const A = 0.9; // pente du talus du public
  Object.assign(FORMES, {
    // butte d'ocre : tronc de cône à sept pans et sommet plat, de 1 m de rayon à la base et de haut, à mettre à l'échelle ; origine à la base
    butte: () => { const g = new THREE.CylinderGeometry(0.62, 1, 1, 7); g.translate(0, 0.5, 0); return g; },
    // houppier de pin parasol : boule aplatie de 1 m de rayon, à mettre à l'échelle (sert aussi, toute petite, de buisson de garrigue)
    pinParasol: () => { const g = new THREE.IcosahedronGeometry(1, 0); g.scale(1, 0.42, 1); return g; },
    // botte de paille ronde couchée, axe en travers (X) ; origine au sol
    botte: () => { const g = new THREE.CylinderGeometry(0.75, 0.75, 1.3, 8); g.rotateZ(Math.PI / 2); g.translate(0, 0.75, 0); return g; },
    // talus du public, de L m le long de X : une butte de terre, une banderole sur chaque flanc, et le public en deux pans adossés (chacun fait face à son côté)
    talusPublic: (L = 14) => [['talus', L, 1.6, 4.4, 0, 0.8, 0, null, 1], ...[-1, 1].map(sd => ['ruban', L, 1.1, 0.1, 0, 0.95, sd * 2.25]),
      ['foule', L, 0.3, 2.6, 0, 2.6, -0.85, [-A, 0, 0], 1], ['foule', L, 0.3, 2.6, 0, 2.6, 0.85, [A, Math.PI, 0], 1]],
    // mas du hameau, faîtage le long de Z (la route) : murs de pierre, toit de tuiles à deux pans, volets et porte sur les deux façades ; origine au sol, à enterrer d'un demi-mètre
    mas: () => [['mur', 7, 5.5, 11, 0, 2.75, 0, null, 1], ['mur', 3.4, 1.2, 11, 0, 6, 0], ...[-1, 1].flatMap(sd => [['toit', 4.7, 0.35, 11.8, sd * 1.85, 6.2, 0, [0, 0, -sd * 0.38], 1],
      ...[-3.4, 0, 3.4].map(z => ['volet', 0.15, 1.5, 1, sd * 3.5, 3.9, z]), ['volet', 0.15, 2.2, 1.2, sd * 3.5, 1.6, 1.7]])],
    // barnum d'assistance de 6 m de côté : quatre poteaux, toit de toile à deux étages, une bâche au fond (-Z) ; origine au sol
    barnum: () => [...[-1, 1].flatMap(a => [-1, 1].map(b => ['poteau', 0.12, 2.8, 0.12, a * 2.9, 1.4, b * 2.9])), ['toile', 6.2, 0.5, 6.2, 0, 3.05, 0, null, 1], ['toile', 3.6, 0.5, 3.6, 0, 3.5, 0], ['toile', 6, 2.6, 0.08, 0, 1.5, -2.95]],
    // fourgon d'assistance, l'avant vers +X : caisse haute, pare-brise et vitres de cabine, galerie de toit
    fourgon: () => [['caisse', 5.4, 2.1, 2.1, 0, 1.55, 0, null, 1], ['vitre', 0.1, 0.8, 1.9, 2.72, 2, 0], ['vitre', 1.1, 0.7, 2.14, 1.9, 2.05, 0], ['chassis', 5.3, 0.3, 2, 0, 0.45, 0], ['chassis', 3, 0.1, 1.6, -0.8, 2.7, 0],
      ...[-1.7, 1.7].flatMap(x => [-1, 1].map(sd => ['pneu', 0.75, 0.75, 0.3, x, 0.38, sd * 0.95]))],
    // chapelle : nef le long de Z, toit de tuiles à deux pans, clocher carré au chevet (-Z) coiffé de tuiles, porte au pignon (+Z) ; origine au sol
    chapelle: () => [['mur', 6, 5, 11, 0, 2.5, 0, null, 1], ['mur', 2.6, 1.2, 11, 0, 5.4, 0], ...[-1, 1].map(sd => ['toit', 4.2, 0.35, 11.6, sd * 1.6, 5.7, 0, [0, 0, -sd * 0.5], 1]),
      ['mur', 3.2, 12, 3.2, 0, 6, -6.5, null, 1], ['toit', 3.8, 0.5, 3.8, 0, 12.2, -6.5], ['toit', 2.2, 1.2, 2.2, 0, 13, -6.5], ['volet', 1.2, 2.4, 0.15, 0, 1.2, 5.5], ...[-1, 1].map(sd => ['volet', 0.15, 1.4, 0.8, sd * 1.6, 10, -6.5])],
    // hélicoptère de la télévision, le nez vers +X : cabine vitrée, fuselage, poutre de queue, dérive et rotor anticouple, patins, boule de caméra sous le nez ; le rotor principal est à part (rotorHelico) pour tourner. Origine au centre de la cabine
    helico: () => [['caisse', 3.6, 1.8, 1.9, 0, 0, 0, null, 1], ['vitre', 1.4, 1.3, 1.7, 1.9, 0.2, 0, [0, 0, -0.35]], ['vitre', 1.6, 0.8, 1.95, 0.4, 0.35, 0], ['caisse', 2, 0.7, 1.2, -0.4, 1.1, 0],
      ['caisse', 5.6, 0.45, 0.45, -4.4, 0.35, 0, [0, 0, 0.06], 1], ['caisse', 1.3, 1.6, 0.12, -7, 1.05, 0, [0, 0, -0.35]], ['caisse', 1.6, 0.1, 0.6, -6.6, 0.45, 0], ['chassis', 0.5, 0.5, 0.5, 2.2, -0.95, 0],
      ...[-1, 1].flatMap(sd => [['chassis', 3.4, 0.12, 0.12, 0.2, -1.6, sd * 1], ['chassis', 0.1, 0.7, 0.1, 1, -1.25, sd * 0.9], ['chassis', 0.1, 0.7, 0.1, -0.7, -1.25, sd * 0.9]])],
    // rotor principal : deux pales croisées de 10 m et le moyeu ; origine au moyeu
    rotorHelico: () => [['pale', 10, 0.06, 0.3, 0, 0, 0], ['pale', 0.3, 0.06, 10, 0, 0, 0], ['chassis', 0.3, 0.4, 0.3, 0, -0.2, 0]],
    // moulin à vent en ruine : tour de pierre ronde, un peu conique, découronnée (le toit est tombé) ; origine au sol
    tourMoulin: () => { const g = new THREE.CylinderGeometry(3.1, 3.8, 9, 10, 1, true); g.translate(0, 4.5, 0); return g; },
    // ce qui reste du mécanisme, sur la tour de 9 m, ailes côté +X : l'arbre, une aile entière et une cassée (cadres de bois sans toile), deux poutres du toit effondré, l'encadrement de porte, des pierres tombées
    moulinRuine: () => [['bois', 1.6, 0.35, 0.35, 3.5, 8.2, 0, [0, 0, -0.15]], ['bois', 0.35, 0.35, 15, 4.3, 8.1, 0, [0.5, 0, 0]], ['bois', 0.3, 0.06, 2, 4.4, 9.8, -1.1, [0.5, 0, 0]], ['bois', 0.3, 0.06, 2, 4.4, 6.5, 2.9, [0.5, 0, 0]],
      ['bois', 0.35, 0.35, 5, 4.3, 6.2, -1.2, [-1.05, 0, 0]], ['bois', 7, 0.3, 0.3, 0, 8.6, 1, [0, 0.4, 0.25]], ['bois', 6.6, 0.3, 0.3, -0.4, 8.3, -1.4, [0, -0.3, -0.12]],
      ['pierre', 0.5, 2.4, 1.8, 3.6, 1.2, 0], ['pierre', 1.4, 0.8, 1.2, 4.6, 0.4, 2.2, [0, 0.6, 0]], ['pierre', 1, 0.6, 0.9, -4.4, 0.3, -1.5, [0, 0.3, 0]]],
    // mouton, le museau vers +X : toison, tête sombre, pattes ; origine au sol
    mouton: () => [['laine', 1.15, 0.7, 0.65, 0, 0.75, 0, null, 1], ['tete', 0.35, 0.36, 0.3, 0.68, 0.9, 0], ['tete', 0.1, 0.12, 0.3, 0.58, 1.05, 0], ...[-1, 1].flatMap(a => [-1, 1].map(b => ['tete', 0.1, 0.45, 0.1, a * 0.38, 0.22, b * 0.2]))],
    // berger tourné vers +X : vêtements, tête, chapeau, bâton ; le bras qui salue est à part (brasBerger, pour s'agiter). Origine au sol
    berger: () => [['habit', 0.35, 0.95, 0.5, 0, 1.1, 0, null, 1], ['habit', 0.18, 0.8, 0.18, 0, 0.4, -0.12], ['habit', 0.18, 0.8, 0.18, 0, 0.4, 0.12], ['peau', 0.22, 0.26, 0.24, 0, 1.75, 0],
      ['chapeau', 0.55, 0.05, 0.55, 0, 1.9, 0], ['chapeau', 0.28, 0.16, 0.28, 0, 1.98, 0], ['habit', 0.13, 0.7, 0.13, 0.05, 1.15, 0.32], ['bois', 0.05, 1.7, 0.05, 0.12, 0.95, 0.4]],
    // bras levé du berger : origine à l'épaule, la main en haut
    brasBerger: () => [['habit', 0.13, 0.62, 0.13, 0, 0.31, 0], ['peau', 0.12, 0.14, 0.12, 0, 0.68, 0]],
    // clôture de pâture, de L m le long de X : un piquet tous les 2,5 m environ, deux lisses
    cloture: (L = 10) => { const nb = Math.round(L / 2.5); return [...Array.from({ length: nb + 1 }, (_, k) => ['bois', 0.12, 1.1, 0.12, -L / 2 + k * L / nb, 0.55, 0]), ['bois', L, 0.08, 0.05, 0, 0.95, 0], ['bois', L, 0.08, 0.05, 0, 0.55, 0]]; },
  });
})();
