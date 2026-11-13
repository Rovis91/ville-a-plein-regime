// Textures propres à « stade » (Grand Vacarme) : complète le catalogue de textures.js, mêmes conventions. Voir METHODE-DECOR.md.
(() => {
  const texte = (g, txt, x, y, px, col, align = 'left') => { g.fillStyle = col; g.font = 'bold ' + px + 'px sans-serif'; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(txt, x, y); };
  Object.assign(TEXTURES, {
    // sol de l'arène : terre battue rapportée, mottes claires et sombres, traces de pneus qui se croisent
    terreBattue: () => [64, 64, (g, o) => {
      const { R, alea, voile } = o; R(g, '#5a3d2e', 0, 0, 64, 64);
      for (let i = 0; i < 420; i++) R(g, alea() < 0.5 ? '#4c3226' : '#684838', alea() * 64 | 0, alea() * 64 | 0, 1 + (alea() * 3 | 0), 1);
      voile(g, 0.22, () => { for (let i = 0; i < 7; i++) { const x = alea() * 60 | 0; R(g, '#000', x, 0, 2, 64); R(g, '#000', x + 5, 0, 2, 64); } for (let i = 0; i < 4; i++) R(g, '#000', 0, alea() * 60 | 0, 64, 2); });
      for (let i = 0; i < 24; i++) R(g, '#7a5846', alea() * 64 | 0, alea() * 64 | 0, 2, 2);
    }, 8],
    // murs roulables : planches peintes en gris-bleu sombre (plus clair, la paroi tournée vers le toit saturait), joints, et les traces noires des pneus qui y sont montés.
    // game.js plaque une tuile sur une facette d'environ 1,5 m de large et 16 m de long (x en travers, y le long) : le grain est dessiné large et court pour ne pas s'étirer en traînées
    // game.js la plaque en u sur une facette (~2 m de large) et en v sur 16 m de long : 16 x 128 px garde des pixels à peu près carrés (~0,13 m) au lieu de rayures étirées
    paroiArene: () => [16, 128, (g, o) => {
      const { R, alea, voile } = o; R(g, '#3c404c', 0, 0, 16, 128);
      for (let i = 0; i < 140; i++) R(g, alea() < 0.5 ? '#343844' : '#444956', alea() * 16 | 0, alea() * 128 | 0, 1 + (alea() * 2 | 0), 1 + (alea() * 2 | 0));
      R(g, '#2a2e38', 0, 0, 1, 128); for (let y = 0; y < 128; y += 32) R(g, '#2a2e38', 0, y, 16, 1); // joint entre facettes, joint de dalle tous les 4 m
      voile(g, 0.5, () => { for (let i = 0; i < 5; i++) R(g, '#101014', alea() * 15 | 0, alea() * 128 | 0, 1, 16 + (alea() * 48 | 0)); }); // traces de gomme dans le sens de la course
    }, 8],
    // banderoles des gradins : deux annonceurs inventés par texture, k = le premier
    banderoleStade: k => [192, 20, (g, o) => {
      const l = [['VOLT COLA', '#e8362a', '#f4f0e0'], ['RADIO KOP 170', '#16161c', '#ffc21a'], ['PNEUS TONNERRE', '#f4f0e0', '#1c3fa8'], ['BRASERO GRILL', '#ffc21a', '#16161c'], ['GRAND VACARME', '#1c3fa8', '#f4f0e0'], ['MASTIFF MOTORS', '#16161c', '#e8362a']];
      for (let j = 0; j < 2; j++) { const [t, f, c] = l[(k + j) % l.length], x = j * 96; o.R(g, f, x, 0, 96, 20); o.R(g, '#08080c', x, 0, 1, 20); texte(g, t, x + 48, 10.5, 12, c, 'center'); }
    }],
    // sous-face du toit, lumineuse par elle-même : bacs sombres, pannes, et un semis de lampes tous les 4 m
    toitArene: () => [64, 64, (g, o) => {
      const { R } = o; R(g, '#0a0a12', 0, 0, 64, 64);
      for (const k of [0, 32]) { R(g, '#1c1c2a', 0, k, 64, 2); R(g, '#16161f', k, 0, 1, 64); }
      for (let x = 7; x < 64; x += 16) for (let y = 15; y < 64; y += 16) { R(g, '#fff4d8', x, y, 2, 2); R(g, '#6a6048', x - 1, y, 1, 2); R(g, '#6a6048', x + 2, y, 1, 2); }
    }, 16],
    // écran du cube : le classement de la course
    tableauStade: () => [256, 160, (g, o) => {
      const { R } = o; R(g, '#08080c', 0, 0, 256, 160); R(g, '#e8362a', 0, 0, 256, 26); texte(g, 'GRAND VACARME', 128, 14, 18, '#f4f0e0', 'center');
      [['1', 'NOUR', '—', '#ffc21a'], ['2', 'VOUS', '+0.33', '#5ad0ff'], ['3', 'ENZO', '+0.92', '#f4f0e0'], ['4', 'JADE', '+2.10', '#f4f0e0']].forEach(([p, n, e, c], k) => {
        const y = 46 + k * 30; R(g, k & 1 ? '#14121a' : '#1c1a24', 4, y - 13, 248, 27); texte(g, p, 14, y, 22, '#e8362a'); texte(g, n, 46, y, 22, c); texte(g, e, 246, y, 18, '#c8c0b4', 'right');
      });
    }],
    // flamme d'un lance-flammes, en lumière ajoutée (le noir ne se voit pas) : langue large en bas, effilée en haut, du blanc-jaune au rouge
    flamme: () => [32, 64, (g, o) => {
      o.R(g, '#000', 0, 0, 32, 64);
      for (let y = 0; y < 64; y++) { const t = y / 63, l = 3 + 13 * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.85)) * (0.35 + 0.65 * t), c = (dl, col) => { if (l - dl > 0) o.R(g, col, Math.round(16 - l + dl), y, Math.round(2 * (l - dl)), 1); };
        c(0, t < 0.35 ? '#a01808' : '#e8401a'); c(3, t < 0.3 ? '#e8401a' : '#ff8a1a'); c(6, t < 0.45 ? '#ff8a1a' : '#ffd24a'); if (t > 0.6) c(9, '#fff4c8'); }
    }],
    // faisceau d'un projecteur de poursuite, en lumière ajoutée : vif sous la lampe (haut du cône), éteint en arrivant au sol
    faisceau: () => [4, 32, (g, o) => { for (let y = 0; y < 32; y++) { const v = Math.round(40 * (1 - y / 31) ** 2); o.R(g, `rgb(${v * 0.8 | 0},${v * 0.85 | 0},${v})`, 0, y, 4, 1); } }],
    // écran géant : deux images l'une sur l'autre, le décor en montre une puis l'autre
    ecranGeant: () => [256, 128, (g, o) => {
      const { R } = o; R(g, '#08080c', 0, 0, 256, 128);
      R(g, '#e8362a', 0, 0, 256, 64); texte(g, 'GRAND VACARME', 128, 24, 26, '#f4f0e0', 'center'); texte(g, 'CE SOIR · COMPLET', 128, 49, 14, '#16161c', 'center');
      for (let x = -32; x < 256; x += 32) { g.fillStyle = '#ffc21a'; g.beginPath(); g.moveTo(x, 64); g.lineTo(x + 16, 64); g.lineTo(x + 48, 128); g.lineTo(x + 32, 128); g.fill(); }
      R(g, '#08080c', 40, 76, 176, 40); texte(g, 'QUEL SAUT !', 128, 97, 26, '#ffc21a', 'center');
    }],
  });
})();
