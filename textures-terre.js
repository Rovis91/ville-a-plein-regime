// Textures propres à « terre » (Spéciale des Ocres) : complète le catalogue de textures.js, mêmes conventions. Voir METHODE-DECOR.md.
(() => {
  const texte = (g, txt, x, y, px, col) => { g.fillStyle = col; g.font = 'bold ' + px + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, x, y); };
  Object.assign(TEXTURES, {
    // sol de la garrigue : terre d'ocre, cailloux clairs, plaques plus rouges, touffes d'herbe sèche et de thym
    terreOcre: () => [64, 64, (g, o) => {
      const { R, alea, voile } = o; R(g, '#b0703c', 0, 0, 64, 64);
      voile(g, 0.35, () => { for (let i = 0; i < 9; i++) R(g, alea() < 0.5 ? '#c8562a' : '#d09a50', alea() * 56 | 0, alea() * 56 | 0, 6 + (alea() * 12 | 0), 5 + (alea() * 10 | 0)); });
      for (let i = 0; i < 380; i++) R(g, alea() < 0.5 ? '#9a5c30' : '#c08248', alea() * 64 | 0, alea() * 64 | 0, 1 + (alea() * 2 | 0), 1);
      for (let i = 0; i < 40; i++) R(g, '#e0c090', alea() * 64 | 0, alea() * 64 | 0, 1, 1);
      for (let i = 0; i < 46; i++) { const x = alea() * 62 | 0, y = alea() * 62 | 0; R(g, alea() < 0.6 ? '#8a8440' : '#5e7038', x, y, 2, 2); R(g, '#a89a50', x + 1, y - 1, 1, 1); }
    }],
    // falaise d'ocre : strates horizontales du rouge sang au jaune, ravines verticales, éboulis au pied ; le haut de la texture est le haut de la butte, coiffé de garrigue
    falaiseOcre: () => [64, 64, (g, o) => {
      const { R, alea, voile } = o, B = [['#6a7038', 4], ['#e8c070', 6], ['#e09848', 9], ['#d8702c', 8], ['#c84a20', 10], ['#e08a3c', 7], ['#b83c1c', 9], ['#c8683a', 11]]; let y = 0;
      for (const [c, hh] of B) { R(g, c, 0, y, 64, hh); for (let x = 0; x < 64; x += 2) if (alea() < 0.5) R(g, c, x, y - 1 - (alea() * 2 | 0), 2, 3); y += hh; }
      voile(g, 0.22, () => { for (let i = 0; i < 26; i++) R(g, alea() < 0.7 ? '#000' : '#fff', alea() * 64 | 0, 4 + (alea() * 30 | 0), 1 + (alea() * 2 | 0), 10 + (alea() * 30 | 0)); });
      for (let i = 0; i < 150; i++) R(g, alea() < 0.5 ? '#a04a24' : '#e0a060', alea() * 64 | 0, 4 + alea() * 60 | 0, 2, 1);
    }],
    // botte de paille : brins dorés, deux ficelles
    paille: () => [32, 32, (g, o) => {
      const { R, alea } = o; R(g, '#d8b050', 0, 0, 32, 32);
      for (let i = 0; i < 200; i++) R(g, alea() < 0.5 ? '#c09838' : '#ecd078', alea() * 32 | 0, alea() * 32 | 0, 1, 2 + (alea() * 4 | 0));
      for (const x of [9, 22]) R(g, '#7a5a28', x, 0, 1, 32);
    }],
    // toit de tuiles canal : rangs de 50 cm, tuiles de teintes inégales, mousse par endroits
    tuilesCanal: () => [64, 64, (g, o) => {
      const { R, alea, voile } = o; R(g, '#c8643a', 0, 0, 64, 64);
      for (let y = 0; y < 64; y += 4) for (let x = 0; x < 64; x += 4) { R(g, ['#c8643a', '#b85530', '#d87a48', '#a84a2a', '#d08a58'][alea() * 5 | 0], x, y, 3, 4); R(g, '#7a3418', x + 3, y, 1, 4); }
      voile(g, 0.3, () => { for (let y = 3; y < 64; y += 4) R(g, '#000', 0, y, 64, 1); for (let i = 0; i < 8; i++) R(g, '#4a5a2a', alea() * 60 | 0, alea() * 60 | 0, 3 + (alea() * 4 | 0), 2); });
    }, 4],
    // banderoles de la spéciale : deux annonceurs inventés par texture, k = le premier
    banderoleRallye: k => [192, 20, (g, o) => {
      const l = [['RALLYE DES OCRES', '#e8482a', '#f4f0e0'], ['HUILES MISTRAL', '#f4c020', '#1c2a5a'], ['PNEUS CIGALE', '#1c2a5a', '#f4f0e0'], ['RADIO CAILLOU 88.8', '#f4f0e0', '#e8482a'], ['GARRIGUE SPORT', '#2a62c8', '#f4c020'], ['SIROPS DU VALLON', '#3a7a3a', '#f4f0e0']];
      for (let j = 0; j < 2; j++) { const [t, f, c] = l[(k + j) % l.length], x = j * 96; o.R(g, f, x, 0, 96, 20); o.R(g, '#08080c', x, 0, 1, 20); texte(g, t, x + 48, 10.5, 10, c); }
    }],
  });
})();
