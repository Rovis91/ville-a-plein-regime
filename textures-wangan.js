// Textures propres à « wangan » : complète le catalogue de textures.js, mêmes conventions. Voir METHODE-DECOR.md.
(() => {
  Object.assign(TEXTURES, {
    // sol du port, une tuile de 32 m : dalles de béton de 4 m aux teintes inégales et joints sombres, taches d'huile, flaques sombres et lisses,
    // une paire de rails noyés (portiques sur rails), une ligne jaune de voie de circulation et des cases blanches de stockage
    solPort: () => [128, 128, (g, { R, alea }) => {
      R(g, '#3a3c40', 0, 0, 128, 128);
      for (let x = 0; x < 128; x += 16) for (let y = 0; y < 128; y += 16) { const v = 52 + alea() * 16 | 0; R(g, `rgb(${v},${v + 1},${v + 4})`, x + 1, y + 1, 15, 15); }
      for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(10,10,12,${0.15 + alea() * 0.25})`; g.beginPath(); g.ellipse(alea() * 128, alea() * 128, 2 + alea() * 6, 1 + alea() * 4, alea() * 3, 0, 6.3); g.fill(); } // huile
      for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(14,20,28,.85)'; g.beginPath(); g.ellipse(alea() * 128, alea() * 128, 5 + alea() * 9, 3 + alea() * 5, alea() * 3, 0, 6.3); g.fill(); } // flaques
      for (const x of [40, 46]) { R(g, '#1c1c1e', x, 0, 2, 128); R(g, '#8a8c90', x + 0.5, 0, 1, 128); } // rails noyés, champignon brillant
      R(g, '#d8a820', 88, 0, 2, 128); // voie de circulation
      for (let y = 4; y < 128; y += 32) { R(g, '#c8c8c0', 100, y, 26, 1); R(g, '#c8c8c0', 100, y + 12, 26, 1); R(g, '#c8c8c0', 100, y, 1, 12); } // cases de stockage
    }, 32],
  });
})();
