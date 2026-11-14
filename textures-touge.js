// Textures propres à « touge » (Karasu-tōge) : complète le catalogue de textures.js, mêmes conventions. Voir METHODE-DECOR.md.
(() => {
  Object.assign(TEXTURES, {
    // nappe de brume : une tache douce, blanche, transparente sur les bords (teintée et dosée au placement)
    brume: () => [64, 64, g => { const r = g.createRadialGradient(32, 32, 2, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,.85)'); r.addColorStop(0.6, 'rgba(255,255,255,.3)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }],
    // panneau d'avertissement en losange : jaune, liseré noir, texte noir ; hors du losange transparent (matière en alphaTest)
    losange: txt => [32, 32, g => {
      const l = (c, m) => { g.fillStyle = c; g.beginPath(); g.moveTo(16, m); g.lineTo(32 - m, 16); g.lineTo(16, 32 - m); g.lineTo(m, 16); g.fill(); }; l('#101010', 0); l('#ffd400', 2);
      g.fillStyle = '#101010'; g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 16, 17, 22);
    }],
    // mur de soutènement en blocs de béton posés en losange (kenchi-ishi), mousse dans les joints et en haut, coulures noires (16 px par mètre)
    murMousse: () => [64, 64, (g, o) => {
      const { R, alea, voile } = o; R(g, '#8a8e84', 0, 0, 64, 64);
      for (let i = 0; i < 260; i++) R(g, alea() < 0.5 ? '#7a7e74' : '#9a9e94', alea() * 64 | 0, alea() * 64 | 0, 1 + (alea() * 2 | 0), 1);
      voile(g, 0.5, () => { for (let k = -64; k < 64; k += 8) for (let t = 0; t < 64; t++) { R(g, '#2a2c28', k + t, t, 1, 1); R(g, '#2a2c28', k + 64 - t, t, 1, 1); } }); // joints en losange
      voile(g, 0.55, () => { for (let i = 0; i < 90; i++) { const y = Math.min(alea(), alea()) * 64 | 0; R(g, alea() < 0.5 ? '#5a8a36' : '#74a040', alea() * 64 | 0, y, 2 + (alea() * 5 | 0), 1 + (alea() * 3 | 0)); } }); // la mousse descend du haut
      voile(g, 0.25, () => { for (let i = 0; i < 10; i++) R(g, '#101210', alea() * 64 | 0, 0, 1 + (alea() * 2 | 0), 10 + alea() * 40 | 0); });
    }, 4],
    // filet pare-pierres : mailles en losange de fil galvanisé, fond transparent (matière en alphaTest)
    filet: () => [32, 32, (g, o) => { const { R } = o; for (let k = -32; k < 32; k += 6) for (let t = 0; t < 32; t++) { R(g, '#9aa098', k + t, t, 1, 1); R(g, '#9aa098', k + 32 - t, t, 1, 1); } R(g, '#b8beb4', 0, 0, 32, 1); }, 2],
    // bois laqué vermillon du torii : fibres, laque passée et écaillée par endroits
    vermillon: () => [64, 64, (g, o) => {
      const { R, alea, voile } = o; R(g, '#c8321c', 0, 0, 64, 64);
      voile(g, 0.25, () => { for (let i = 0; i < 80; i++) R(g, alea() < 0.6 ? '#000' : '#fff', alea() * 64 | 0, alea() * 64 | 0, 1, 4 + alea() * 16 | 0); });
      voile(g, 0.5, () => { for (let i = 0; i < 12; i++) R(g, '#3a2418', alea() * 64 | 0, alea() * 64 | 0, 1 + (alea() * 3 | 0), 1 + (alea() * 2 | 0)); });
    }, 4],
    // pierre moussue des marches et des lanternes : assises grises, mousse en dessus
    pierreMousse: () => [64, 64, (g, o) => {
      const { R, alea, voile } = o; R(g, '#7a7c72', 0, 0, 64, 64);
      for (let i = 0; i < 220; i++) R(g, alea() < 0.5 ? '#6a6c64' : '#8a8c82', alea() * 64 | 0, alea() * 64 | 0, 1 + (alea() * 3 | 0), 1);
      voile(g, 0.35, () => { for (let y = 0; y < 64; y += 16) { R(g, '#2a2c26', 0, y, 64, 1); for (let x = (y & 16); x < 64; x += 32) R(g, '#2a2c26', x, y, 1, 16); } });
      voile(g, 0.5, () => { for (let i = 0; i < 50; i++) R(g, '#3e6228', alea() * 64 | 0, alea() * 64 | 0, 2 + (alea() * 6 | 0), 1 + (alea() * 2 | 0)); });
    }, 4],
    // pelage d'hiver du cerf sika : brun gris, raie dorsale sombre, quelques taches pâles
    pelage: () => [32, 32, (g, o) => {
      const { R, alea, voile } = o; R(g, '#6a4c34', 0, 0, 32, 32); R(g, '#3a281c', 0, 0, 32, 4);
      voile(g, 0.3, () => { for (let i = 0; i < 90; i++) R(g, alea() < 0.5 ? '#000' : '#a88a6a', alea() * 32 | 0, alea() * 32 | 0, 1, 2); });
      voile(g, 0.4, () => { for (let i = 0; i < 14; i++) R(g, '#d8c8a8', alea() * 32 | 0, 5 + alea() * 12 | 0, 1, 1); });
    }],
  });
})();
