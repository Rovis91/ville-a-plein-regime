// Textures propres à « givre » (Nuit Blanche) : complète le catalogue de textures.js, mêmes conventions. Voir METHODE-DECOR.md.
(() => {
  Object.assign(TEXTURES, {
    // neige vierge des pentes : rides du vent claires et sombres, ombres bleues des congères, quelques cristaux qui accrochent la lumière
    neigeVierge: () => [64, 64, (g, o) => {
      const { R, alea, voile } = o; R(g, '#d2dcf0', 0, 0, 64, 64);
      for (let i = 0; i < 260; i++) R(g, alea() < 0.5 ? '#c4d0e8' : '#e2eaf8', alea() * 64 | 0, alea() * 64 | 0, 2 + (alea() * 6 | 0), 1);
      voile(g, 0.22, () => { for (let i = 0; i < 7; i++) { const x = alea() * 50 | 0, y = alea() * 60 | 0, w = 10 + (alea() * 14 | 0); R(g, '#4a5c90', x, y, w, 2); R(g, '#fff', x + 1, y - 1, w - 2, 1); } });
      for (let i = 0; i < 36; i++) R(g, '#ffffff', alea() * 64 | 0, alea() * 64 | 0, 1, 1);
    }, 10],
    // glace vive sur la chaussée (14 m de large, 8 pixels par mètre) : sombre et lisse sur la neige claire, veines et fissures pâles, bords déchiquetés.
    // L'alpha sert deux fois : 0 = pas de glace (pixel écarté par alphaTest), 0,8 = glace, un peu luisante sous la lumière dynamique (plus brillante, elle renvoie le ciel et se confond de loin avec la neige).
    // bout = 1 : les 10 derniers mètres d'une plaque, en langues qui s'effilent vers le bas de la texture
    glaceVive: bout => [64, bout ? 80 : 256, (g, o) => {
      const { R, alea, voile } = o, H = bout ? 80 : 256; R(g, '#3a74ac', 0, 0, 64, H);
      for (let i = 0; i < H * 2; i++) R(g, alea() < 0.5 ? '#2c6094' : '#5094cc', alea() * 64 | 0, alea() * H | 0, 1 + (alea() * 2 | 0), 3 + (alea() * 12 | 0)); // la glace est tirée dans le sens de la route : bleu glacier, pas gris bitume
      voile(g, 0.6, () => { for (let i = 0; i < H / 5; i++) R(g, alea() < 0.4 ? '#cfeaff' : '#8cc4f0', alea() * 64 | 0, alea() * H | 0, 1, 10 + (alea() * 30 | 0)); }); // reflets polis, longs et fins
      voile(g, 0.8, () => { for (let i = 0; i < H / 12; i++) { let x = 6 + alea() * 52 | 0, y = alea() * H | 0; for (let k = 0; k < 26; k++) { R(g, '#eef8ff', x, y, 1, 1); if (alea() < 0.5) x += alea() < 0.5 ? -1 : 1; y = (y + 1) % H; } } }); // fissures
      voile(g, 0.5, () => { for (let i = 0; i < H / 4; i++) R(g, '#f2f8ff', alea() * 62 | 0, alea() * H | 0, 2, 1); }); // givre accroché
      g.globalCompositeOperation = 'destination-out';
      g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, 0, 64, H);
      g.fillStyle = '#000';
      for (let y = 0; y < H; y += 4) { g.fillRect(0, y, 1 + (alea() * 5 | 0), 4); const w = 1 + (alea() * 5 | 0); g.fillRect(64 - w, y, w, 4); }
      if (bout) for (let x = 0; x < 64; x += 4) { const t = 14 + (alea() * 58 | 0); g.fillRect(x, t, 4, H - t); if (alea() < 0.5) g.fillRect(x + (alea() < 0.5 ? -2 : 4), t - 8, 2, 8); }
      g.globalCompositeOperation = 'source-over';
    }],
    // sapin chargé de neige : rameaux sombres en nappes, un paquet de neige sur chaque étage
    sapinNeige: () => [64, 64, (g, o) => {
      const { R, alea, voile } = o; R(g, '#16302c', 0, 0, 64, 64);
      voile(g, 0.2, () => { for (let i = 0; i < 150; i++) R(g, alea() < 0.6 ? '#000' : '#6a9a8a', alea() * 64 | 0, alea() * 64 | 0, 2 + (alea() * 3 | 0), 1 + (alea() * 2 | 0)); });
      for (let y = 3; y < 64; y += 9) for (let x = 0; x < 64; x += 3) if (alea() < 0.72) { const d = alea() * 3 | 0; R(g, '#e6eefa', x, y + d, 3, 3 + (alea() * 2 | 0)); R(g, '#a8b8d8', x, y + d + 3, 3, 1); R(g, '#0c1c1a', x, y + d + 4, 3, 1); }
    }],
    // falaise à l'ombre (posée en ruban : la gauche de la texture est le pied, la droite le sommet) : roche sombre litée, coulées de glace qui pendent du sommet, neige en corniche
    rocGivre: () => [64, 64, (g, o) => {
      const { R, alea, voile } = o; R(g, '#39414f', 0, 0, 64, 64);
      for (let i = 0; i < 240; i++) R(g, alea() < 0.5 ? '#2c333f' : '#4a5364', alea() * 64 | 0, alea() * 64 | 0, 3 + (alea() * 9 | 0), 1 + (alea() * 2 | 0));
      voile(g, 0.4, () => { for (let i = 0; i < 9; i++) R(g, '#10141c', alea() * 50 | 0, alea() * 64 | 0, 6 + (alea() * 18 | 0), 1); }); // failles
      for (let i = 0; i < 18; i++) { const l = 8 + (alea() * 30 | 0), y = alea() * 64 | 0; R(g, '#9fbce0', 58 - l, y, l, 1); R(g, '#d8e8fa', 58 - (l >> 1), y, l >> 1, 2); } // glace
      for (let y = 0; y < 64; y += 2) R(g, '#e6eefa', 57 - (alea() * 4 | 0), y, 12, 2);
    }],
  });
})();
