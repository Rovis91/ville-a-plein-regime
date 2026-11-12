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
  });
})();
