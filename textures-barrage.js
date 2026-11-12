// Textures propres à « barrage » (Roche-Sourde) : complète le catalogue de textures.js, mêmes conventions. Voir METHODE-DECOR.md.
(() => {
  Object.assign(TEXTURES, {
    // parement de la voûte et parois roulables : béton banché, une levée tous les 2 m, joints verticaux décalés, coulures sombres sous les joints
    parement: () => [64, 64, (g, o) => {
      const { R, alea } = o; R(g, '#aaa598', 0, 0, 64, 64);
      for (let i = 0; i < 300; i++) R(g, alea() < 0.5 ? '#9e998c' : '#b6b1a4', alea() * 64 | 0, alea() * 64 | 0, 1 + (alea() * 3 | 0), 1);
      for (let r = 0; r < 4; r++) { R(g, '#868174', 0, r * 16, 64, 1); R(g, '#bcb7aa', 0, r * 16 + 1, 64, 1); R(g, '#868174', (r % 2 ? 16 : 48), r * 16, 1, 16); }
      for (let i = 0; i < 9; i++) { const x = alea() * 64 | 0, y = (alea() * 4 | 0) * 16 + 1; R(g, '#8c8778', x, y, 1 + (alea() * 2 | 0), 4 + (alea() * 10 | 0)); }
    }, 8],
    // eau du déversoir et du lac : turquoise des lacs de glacier, rides claires
    eauVive: () => [64, 64, (g, o) => {
      const { R, alea } = o; R(g, '#1f8f9a', 0, 0, 64, 64);
      for (let i = 0; i < 120; i++) R(g, alea() < 0.5 ? '#2aa7ae' : '#177a88', alea() * 64 | 0, alea() * 64 | 0, 3 + (alea() * 6 | 0), 1);
      for (let i = 0; i < 26; i++) R(g, '#bfeee8', alea() * 64 | 0, alea() * 64 | 0, 2 + (alea() * 4 | 0), 1);
    }, 12],
    // sommets : roche grise striée en bas, neige au-dessus d'une limite déchiquetée (le haut de la texture est le haut du pic)
    rocNeige: () => [64, 64, (g, o) => {
      const { R, alea } = o; R(g, '#6f7480', 0, 0, 64, 64);
      for (let i = 0; i < 200; i++) R(g, alea() < 0.5 ? '#5c606c' : '#868b96', alea() * 64 | 0, alea() * 64 | 0, 1, 2 + (alea() * 6 | 0));
      for (let x = 0; x < 64; x += 2) { const h = 22 + (alea() * 14 | 0); R(g, '#f4f6fa', x, 0, 2, h); if (alea() < 0.4) R(g, '#c8d4e8', x, h - 4, 2, 3); }
    }],
    // banderole des tremplins : chevrons rouges sur fond jaune, pointés vers le haut
    banderoleSaut: () => [64, 16, (g, o) => {
      const { R } = o; R(g, '#f4c020', 0, 0, 64, 16);
      for (let x = 0; x < 64; x += 16) for (let k = 0; k < 6; k++) { R(g, '#e8482a', x + 2 + k, 11 - k * 2, 2, 3); R(g, '#e8482a', x + 12 - k, 11 - k * 2, 2, 3); }
    }],
  });
})();
