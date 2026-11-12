// Catalogue des textures : l'aspect de chaque surface du jeu, et rien d'autre (ni forme, ni emplacement).
// Deux sortes d'entrées :
//   aplat  — nom: 0xrrggbb                                   une teinte unie
//   dessin — nom: (...réglages) => [largeur, hauteur, (g, o) => { ... }]   peint sur un canvas 2D ; o = { R, rnd, voile, speckle } (outils de game.js)
// Les formes sont dans formes.js ; qui porte quelle texture, et où, se décide au placement (game.js pour la piste et la ville, decors.js pour les autres cartes),
// par mat('nom', options, ...réglages). L'option c reteint une entrée (peinture d'une carrosserie, d'un conteneur).
// Les couleurs propres à une carte (chaussée, parois, glissières) restent dans son thème, cartes.js, et arrivent ici en réglages.
window.TEXTURES = {
  // ---------- aplats ----------
  peinture: 0xffffff,      // à reteindre par l'option c
  betonSombre: 0x1c1c26, neonJaune: 0xfcee0a, neonCyan: 0x00f0ff, neonMagenta: 0xff2bd6,
  lampe: 0xfff2d0, feuRouge: 0xff2030, vitreSombre: 0x14161c,
  cedre: 0x12281f, catadioptre: 0xff8c1a, bitume: 0x1e2024, acier: 0xd8dce0, clignotant: 0xff8c1a, cone: 0xff5a1a,
  plaine: 0x14161a, matGris: 0x4a4e56, sodium: 0xffb85a, portiqueGris: 0x5a5e66, blancPont: 0xc9ced6, minium: 0xc8442c,
  fonte: 0x1e3a2a, lanterne: 0xffd05a, tronc: 0x4a3a2a, feuillage: 0x4a6a3a, pierre: 0xd9c9a8, craie: 0xf4f0e8,
  fer: 0x2a2030, beton: 0xa89e90, pylone: 0x3a2c3a, troncPalmier: 0x2a1c20, palme: 0x1a2418, lampeCanal: 0xffc04a, entrepot: 0x8a7a6a,

  // ---------- ciel ----------
  ciel: (bandes, etoiles) => [512, 128, (g, { R, rnd }) => {
    const gr = g.createLinearGradient(0, 0, 0, 128);
    for (const [p, c] of bandes) gr.addColorStop(p, c);
    R(g, gr, 0, 0, 512, 128);
    for (let i = 0; i < etoiles; i++) R(g, i % 5 ? '#8a8ac0' : '#ffffff', rnd() * 512 | 0, rnd() * 44 | 0, 1, 1);
  }],
  astre: (col, ombre) => [16, 16, (g, { R }) => { g.fillStyle = col; g.beginPath(); g.arc(8, 8, 7, 0, 7); g.fill(); R(g, ombre, 9, 5, 2, 2); R(g, ombre, 5, 9, 3, 2); }],

  // ---------- piste ----------
  // chaussée : une dalle de 2W × 32 m. Grain, rapiéçages, joints, fissure, gomme sur les passages de roues, peinture usée.
  // L'alpha de la texture code les flaques (lu par la lumière dynamique : moins c'est opaque, plus ça reflète) ; wet = 2 : la rigole centrale du canal
  chaussee: (asph, spk, edge, dash, k1, k2, wet) => [64, 256, (g, { R, rnd, voile, speckle }) => {
    R(g, asph, 0, 0, 64, 256); speckle(g, 900, spk, 1, 256);
    voile(g, 0.25, () => { speckle(g, 500, '#000', 1, 256); speckle(g, 160, '#fff', 1, 256); });
    voile(g, 0.2, () => {
      for (let i = 0; i < 4; i++) { const x = 8 + rnd() * 34 | 0, y = rnd() * 220 | 0, w = 8 + rnd() * 12 | 0, h = 14 + rnd() * 30 | 0; R(g, i & 1 ? '#fff' : '#000', x, y, w, h); R(g, '#000', x, y, w, 1); R(g, '#000', x, y, 1, h); } // rapiéçages
      R(g, '#000', 7, 0, 50, 1); R(g, '#000', 7, 128, 50, 1); // joints de dalle
      for (let y = 0, x = 44; y < 256; y++) { if (rnd() < 0.3) x += rnd() < 0.5 ? -1 : 1; if (y % 97 < 60) R(g, '#000', x, y, 1, 1); } // fissure
    });
    voile(g, 0.15, () => { for (const x of [17, 26, 36, 45]) for (let y = 0; y < 256; y += 4) if (rnd() < 0.8) R(g, '#000', x + (rnd() * 2 | 0), y, 2, 4); }); // gomme
    R(g, edge, 5, 0, 2, 256); R(g, edge, 57, 0, 2, 256);
    for (let y = 0; y < 256; y += 64) { R(g, dash, 31, y, 2, 32); for (const x of [0, 60]) { R(g, k1, x, y, 4, 32); R(g, k2, x, y + 32, 4, 32); } }
    for (let i = 0; i < 260; i++) R(g, asph, [5, 6, 31, 32, 57, 58][rnd() * 6 | 0], rnd() * 256 | 0, 1, 1 + rnd() * 3 | 0); // peinture usée
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,.5)'; // flaques : pâtés de pixels
    for (let i = wet ? 7 : 2; i > 0; i--) { const x = 8 + rnd() * 44, y = rnd() * 256, r = 3 + rnd() * 5; for (let k = 0; k < 9; k++) { const w = r * (0.5 + rnd()) | 0; g.fillRect(x + (rnd() - 0.5) * r * 2 | 0, y + (rnd() - 0.5) * r * 5 | 0, w, w * 2); } }
    if (wet === 2) { g.fillRect(27, 0, 3, 256); for (let y = 0; y < 256; y += 8) g.fillRect(25 + (rnd() * 3 | 0), y, 2 + (rnd() * 4 | 0), 8); }
    g.globalCompositeOperation = 'source-over';
  }],
  // paroi de tunnel — x : 0 = haut du mur, y : le long de la piste ; p = [fond, joint, filet, pied]
  paroi: (neonC, p, carreaux) => [32, 32, (g, { R, rnd, voile }) => {
    R(g, p[0], 0, 0, 32, 32);
    voile(g, 0.16, () => {
      if (carreaux) { for (let x = 13; x < 29; x += 3) R(g, '#000', x, 0, 1, 32); for (let y = 0; y < 32; y += 4) R(g, '#000', 13, y, 16, 1); } // carrelage du bas de paroi
      for (let i = 0; i < 9; i++) R(g, '#000', 12 + rnd() * 6 | 0, rnd() * 32 | 0, 12 + rnd() * 8 | 0, 1 + (rnd() * 2 | 0)); // coulures
    });
    R(g, p[1], 0, 0, 32, 2); R(g, neonC, 9, 0, 3, 32); R(g, p[2], 25, 0, 1, 32); R(g, p[3], 29, 0, 3, 32);
  }],
  plafond: p => [32, 32, (g, { R, voile, speckle }) => { R(g, p[0], 0, 0, 32, 32); R(g, p[3], 0, 15, 32, 1); R(g, p[3], 14, 0, 4, 32); voile(g, 0.2, () => speckle(g, 40, '#000', 3, 32)); }], // joints, chemin de câbles
  // glissière — x : 0 = haut ; lisse, rainure, poteaux tous les 4 m, coulures
  glissiere: p => [32, 32, (g, { R, rnd, voile }) => {
    R(g, p[0], 0, 0, 32, 32); R(g, p[1], 0, 0, 3, 32); R(g, p[2], 6, 0, 1, 32); R(g, p[3], 13, 0, 19, 32); R(g, p[3], 3, 0, 10, 1);
    voile(g, 0.3, () => { R(g, '#fff', 3, 0, 1, 32); R(g, '#000', 9, 0, 2, 32); R(g, '#000', 12, 0, 1, 32); R(g, '#000', 3, 16, 10, 1); for (let i = 0; i < 10; i++) R(g, '#000', 4 + rnd() * 3 | 0, rnd() * 32 | 0, 3 + rnd() * 6 | 0, 1); });
  }],
  damier: fond => [16, 4, (c, { R }) => { R(c, fond, 0, 0, 16, 4); for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) if ((x + y) & 1) R(c, '#08080c', x, y, 1, 1); }],
  chevron: flip => [32, 16, (g, { R }) => {
    if (flip) { g.translate(32, 0); g.scale(-1, 1); }
    R(g, '#fcee0a', 0, 0, 32, 16); g.fillStyle = '#08080c';
    for (const x of [3, 17]) { g.beginPath(); g.moveTo(x, 1); g.lineTo(x + 6, 1); g.lineTo(x + 12, 8); g.lineTo(x + 6, 15); g.lineTo(x, 15); g.lineTo(x + 6, 8); g.fill(); }
  }],
  degrade: (c, vert) => [vert ? 8 : 16, vert ? 64 : 2, (g, { R }) => { const gr = vert ? g.createLinearGradient(0, 0, 0, 64) : g.createLinearGradient(0, 0, 16, 0); gr.addColorStop(vert ? 1 : 0, c); gr.addColorStop(vert ? 0 : 1, '#000'); R(g, gr, 0, 0, 16, 64); }],
  ecranPub: (c, txt) => [128, 16, (g, { R }) => { R(g, '#08080c', 0, 0, 128, 16); R(g, c, 0, 0, 128, 1); R(g, c, 0, 15, 128, 1); g.fillStyle = c; g.font = 'bold 11px sans-serif'; g.textBaseline = 'middle'; g.fillText(txt, 2, 8, 124); }],

  // ---------- ville ----------
  rues: () => [64, 64, (g, { R }) => { R(g, '#07060e', 0, 0, 64, 64); R(g, '#3a2408', 0, 0, 64, 2); R(g, '#3a2408', 0, 0, 2, 64); for (let i = 0; i < 64; i += 6) { R(g, '#ffb040', i, 0, 2, 1); R(g, '#40e0ff', 0, i + 3, 1, 2); } }], // grille de rues éclairées vue d'en haut
  fenetres: () => [64, 64, (g, { R }) => { R(g, '#262633', 0, 0, 64, 64); for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) R(g, '#0a0a14', x * 16 + 3, y * 16 + 4, 10, 9); }],
  fenetresAllumees: (cols, p) => [64, 64, (g, { R, rnd }) => { R(g, '#000', 0, 0, 64, 64); for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) if (rnd() < p) { R(g, cols[rnd() * cols.length | 0], x * 16 + 3, y * 16 + 4, 10, 9); R(g, '#000', x * 16 + 3 + 4, y * 16 + 4, 1, 9); } }], // carte émissive
  enseigne: (c, txt) => [64, 32, (g, { R }) => { R(g, '#08080c', 0, 0, 64, 32); g.strokeStyle = c; g.lineWidth = 2; g.strokeRect(2, 2, 60, 28); g.fillStyle = c; g.font = 'bold 18px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 32, 17, 54); }],
  // tour lointaine : silhouette piquée de n fenêtres
  tourLoin: (fond, cols, n) => [32, 64, (g, { R, rnd }) => { R(g, fond, 0, 0, 32, 64); for (let i = 0; i < n; i++) R(g, cols[i % cols.length], rnd() * 32 | 0, rnd() * 64 | 0, 1, 1); }],

  // ---------- décors des autres cartes ----------
  bruit: (fond, grains) => [64, 64, (g, { R, rnd }) => { R(g, fond, 0, 0, 64, 64); for (const c of grains) for (let i = 0; i < 160; i++) R(g, c, rnd() * 64 | 0, rnd() * 64 | 0, 1 + (rnd() * 2 | 0), 1); }], // sol, eau
  ecrit: (w, hh, fond, col, txt, px) => [w, hh, (g, { R }) => { R(g, fond, 0, 0, w, hh); g.fillStyle = col; g.font = 'bold ' + px + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, hh / 2 + 1, w - 4); }], // enseigne à texte
  vitrine: () => [64, 16, (c, { R }) => { R(c, '#eaf6ff', 0, 0, 64, 16); for (let y = 2; y < 12; y += 4) for (let x = 2; x < 62; x += 3) R(c, ['#ff5a4a', '#ffc04a', '#3a8aff', '#3ad06a', '#f4f0e0'][(x * 7 + y) % 5], x, y, 2, 3); R(c, '#8aa0b0', 0, 13, 64, 3); for (let x = 15; x < 64; x += 16) R(c, '#5a6a78', x, 0, 1, 16); }],
  distributeur: () => [16, 32, (c, { R }) => { R(c, '#e8f8ff', 0, 0, 16, 32); for (let y = 3; y < 20; y += 5) for (let x = 2; x < 14; x += 3) R(c, ['#ff2a3a', '#ff8c1a', '#2a7aff', '#1f8f5a'][(x + y) % 4], x, y, 2, 3); R(c, '#101418', 2, 24, 12, 5); }],
  pompeEssence: () => [8, 16, (c, { R }) => { R(c, '#f4f0e0', 0, 0, 8, 16); R(c, '#c8102e', 0, 0, 8, 4); R(c, '#101418', 2, 6, 4, 3); }],
  rayures: () => [16, 4, (c, { R }) => { for (let x = 0; x < 16; x += 4) R(c, x % 8 ? '#f4f0e0' : '#c8102e', x, 0, 4, 4); }],
  panneauRoute: t => [64, 24, (c, { R }) => { R(c, '#0e5a38', 0, 0, 64, 24); c.strokeStyle = '#f4f1e0'; c.strokeRect(1.5, 1.5, 61, 21); c.fillStyle = '#f4f1e0'; c.font = 'bold 11px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, 32, 13, 56); }],
  tourFenetres: cols => [32, 64, (c, { R, rnd }) => { R(c, '#0c1220', 0, 0, 32, 64); for (let y = 2; y < 64; y += 4) for (let x = 2; x < 32; x += 4) if (rnd() < 0.42) R(c, cols[rnd() * cols.length | 0], x, y, 2, 2); }],
  trottoir: () => [16, 16, (c, { R }) => { R(c, '#b8b0a2', 0, 0, 16, 16); R(c, '#a09888', 0, 0, 16, 1); R(c, '#a09888', 0, 0, 1, 16); }],
  // façade : rez-de-chaussée à stores rouges, cinq étages de fenêtres, balcons filants aux 2e et 5e, toit de zinc ; bas = maison basse de la butte
  facadeParis: (p, bas) => [64, 64, (c, { R, rnd }) => {
    R(c, p, 0, 0, 64, 64); R(c, '#5d6b82', 0, 0, 64, 9); for (let x = 5; x < 64; x += 16) R(c, '#3a4658', x, 3, 5, 5);
    for (let f = 0; f < (bas ? 2 : 5); f++) for (let x = 4; x < 64; x += 8) R(c, rnd() < 0.12 ? '#ffd05a' : '#3a4048', x, 12 + f * (bas ? 18 : 8), 4, bas ? 12 : 6);
    if (!bas) { R(c, '#2a2a30', 0, 19, 64, 1); R(c, '#2a2a30', 0, 43, 64, 1); }
    R(c, '#2a2622', 0, 53, 64, 11); for (let x = 2; x < 64; x += 16) R(c, x % 32 ? '#c8102e' : '#1d4a3a', x, 52, 12, 3);
  }],
  dalleBeton: () => [64, 64, (c, { R, rnd }) => { R(c, '#b0a592', 0, 0, 64, 64); for (let i = 0; i < 200; i++) R(c, i % 2 ? '#b8ad9a' : '#a69b88', rnd() * 64 | 0, rnd() * 64 | 0, 2, 1); R(c, '#8a8074', 0, 0, 64, 1); R(c, '#8a8074', 0, 0, 1, 64); }],
  // fresque fléchée du mur anti-crue : chevrons peints dans le sens du virage
  fresque: flip => [32, 16, (c, { R }) => {
    if (flip) { c.translate(32, 0); c.scale(-1, 1); }
    R(c, '#f4f0e0', 0, 0, 32, 16); R(c, '#2aa39a', 0, 0, 32, 2); R(c, '#2aa39a', 0, 14, 32, 2); c.fillStyle = '#e83f8c';
    for (const x of [3, 17]) { c.beginPath(); c.moveTo(x, 3); c.lineTo(x + 6, 3); c.lineTo(x + 12, 8); c.lineTo(x + 6, 13); c.lineTo(x, 13); c.lineTo(x + 6, 8); c.fill(); }
  }],
};
