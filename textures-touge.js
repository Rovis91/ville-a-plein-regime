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
    // tuiles de temple (kawara) : rangs de tuiles rondes gris bleuté, joints sombres, reflets de lune sur les arrondis
    tuileTemple: () => [64, 64, (g, o) => { const { R, alea, voile } = o; R(g, '#3a4048', 0, 0, 64, 64);
      for (let x = 0; x < 64; x += 6) { R(g, '#4c545e', x, 0, 4, 64); R(g, '#6a7480', x + 1, 0, 1, 64); R(g, '#1c2026', x + 5, 0, 1, 64); } for (let y = 0; y < 64; y += 8) R(g, '#1c2026', 0, y, 64, 1);
      voile(g, 0.2, () => { for (let i = 0; i < 60; i++) R(g, alea() < 0.5 ? '#000' : '#8a949e', alea() * 64 | 0, alea() * 64 | 0, 2, 1); }); }, 4],
    // shōji éclairés de l'intérieur : papier chaud, croisillons de bois sombre
    shoji: () => [64, 32, (g, o) => { const { R } = o; R(g, '#ffd9a0', 0, 0, 64, 32); for (let x = 0; x < 64; x += 8) R(g, '#4a2c1a', x, 0, 1, 32); for (let y = 0; y < 32; y += 6) R(g, '#4a2c1a', 0, y, 64, 1); R(g, '#2a1a10', 0, 0, 64, 2); }, 4],
    // bois sombre des pavillons : planches verticales, veines
    boisTemple: () => [64, 64, (g, o) => { const { R, alea, voile } = o; R(g, '#3a2418', 0, 0, 64, 64); for (let x = 0; x < 64; x += 8) R(g, '#22140c', x, 0, 1, 64);
      voile(g, 0.25, () => { for (let i = 0; i < 90; i++) R(g, alea() < 0.6 ? '#000' : '#6a4a32', alea() * 64 | 0, alea() * 64 | 0, 1, 4 + alea() * 12 | 0); }); }, 4],
    // gravier ratissé de la cour : gris pâle, sillons du râteau (crête claire, creux sombre) qui ondulent un peu
    gravier: () => [64, 64, (g, o) => { const { R, alea } = o; R(g, '#4a4c48', 0, 0, 64, 64); for (let i = 0; i < 300; i++) R(g, alea() < 0.5 ? '#444642' : '#52544e', alea() * 64 | 0, alea() * 64 | 0, 2, 2); for (let y = 0; y < 64; y += 8) for (let x = 0; x < 64; x++) { const d = Math.round(Math.sin(x / 10.2) * 1.5); R(g, '#5c5e58', x, (y + d + 64) % 64, 1, 2); R(g, '#3a3c38', x, (y + d + 3 + 64) % 64, 1, 2); } }, 4], // sillons tous les 0,5 m, peu contrastés : pas de moiré vu de loin
  });
})();
