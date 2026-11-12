// Textures propres à « paris » : complète le catalogue de textures.js (mêmes conventions : aplat pour ce qui émet de la lumière, dessin sinon, hasard par o.alea). Voir METHODE-DECOR.md.
Object.assign(TEXTURES, {
  // pavés de granit : 4 m par tuile, rangées de pavés de 12 × 9 cm à joints décalés, teintes inégales, joints sombres, quelques pavés usés plus clairs
  paves: () => [128, 128, (g, { R, alea }) => {
    R(g, '#3e3c3a', 0, 0, 128, 128);
    for (let y = 0; y < 128; y += 3) for (let x = -(y % 6 ? 2 : 0); x < 128; x += 4) { const v = 98 + alea() * 34 | 0, u = alea() < 0.04 ? 30 : 0; R(g, `rgb(${v + u},${v - 3 + u},${v - 8 + u})`, x, y, 3, 2); }
  }, 4],
  // trottoir : dalles de 1 m × 50 cm à joints décalés, teinte d'asphalte clair, taches et chewing-gums
  dalles: () => [64, 64, (g, { R, alea }) => {
    R(g, '#b4ac9e', 0, 0, 64, 64);
    for (let i = 0; i < 300; i++) R(g, alea() < 0.5 ? '#bdb5a7' : '#a8a092', alea() * 64 | 0, alea() * 64 | 0, 1, 1);
    for (let i = 0; i < 12; i++) R(g, '#8e8678', alea() * 64 | 0, alea() * 64 | 0, 1, 1);
    for (let y = 0; y < 64; y += 8) { R(g, '#958d80', 0, y, 64, 1); for (let x = (y & 8); x < 64; x += 16) R(g, '#958d80', x, y, 1, 8); }
  }, 4],
  // pierre sculptée : figures en haut-relief, éclairées par-dessus (haut clair, bas ombré), sur fond de pierre de taille
  basRelief: () => [64, 64, (g, { R, alea, voile }) => {
    R(g, '#a89676', 0, 0, 64, 64);
    for (let i = 0; i < 22; i++) { const x = alea() * 58 | 0, y = alea() * 54 | 0, w = 3 + alea() * 6 | 0, h = 6 + alea() * 10 | 0; R(g, '#5e5038', x + 1, y + 2, w, h); R(g, '#e8dcc0', x, y, w, h - 2); R(g, '#d4c4a2', x, y + 2, w, h - 4); }
    voile(g, 0.3, () => { R(g, '#000', 0, 0, 64, 1); R(g, '#000', 0, 63, 64, 1); });
  }, 8],
});
