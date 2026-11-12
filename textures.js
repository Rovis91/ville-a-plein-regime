// Catalogue des textures : l'aspect de chaque surface du jeu, et rien d'autre (ni forme, ni emplacement).
// Deux sortes d'entrées :
//   aplat  — nom: 0xrrggbb          une teinte unie, réservée à ce qui émet de la lumière (lampes, feux, néons, peinture de signalisation)
//   dessin — nom: (...réglages) => [largeur, hauteur, (g, o) => { ... }, tuile]   peint sur un canvas 2D
//            o = { R, rnd, alea, voile, speckle } : outils de game.js. rnd est le hasard partagé avec le placement (ne pas en ajouter d'appels,
//            le décor bougerait) ; alea est un hasard propre à la texture, à utiliser pour tout nouveau dessin.
//            tuile (facultatif) : le dessin se répète tous les `tuile` mètres sur les boîtes, au lieu de s'étirer sur chaque face.
// Étalon de détail : la chaussée. 8 pixels par mètre, un grain, des joints ou des nervures, de l'usure (coulures, rouille, éclats) ; pas de surface unie.
// Les formes sont dans formes.js ; qui porte quelle texture, et où, se décide au placement (game.js pour la piste et la ville, decors.js pour les autres cartes),
// par mat('nom', options, ...réglages). L'option c teinte un dessin clair (carrosserie, conteneur, wagon).
// Les couleurs propres à une carte (chaussée, parois, glissières) restent dans son thème, cartes.js, et arrivent ici en réglages.
(() => {
  const M = 8; // tuile des matériaux : 64 pixels pour 8 m, la densité de la chaussée
  const semis = (g, { R, alea }, n, c, w = 1, h = 1) => { for (let i = 0; i < n; i++) R(g, c, alea() * 64 | 0, alea() * 64 | 0, w, h); };
  const patine = (g, o, n = 260) => o.voile(g, 0.2, () => { semis(g, o, n, '#000'); semis(g, o, n / 3, '#fff'); semis(g, o, n / 20, '#000', 3, 2); }); // le grain commun à toutes les surfaces
  const coulures = (g, o, n, c = '#000', a = 0.2) => o.voile(g, a, () => { for (let i = 0; i < n; i++) o.R(g, c, o.alea() * 64 | 0, o.alea() * 30 | 0, 1 + (o.alea() * 2 | 0), 6 + o.alea() * 26 | 0); });
  // béton coffré : joints de banche tous les 4 m, trous de coffrage, coulures, reprises plus claires
  const beton = c => () => [64, 64, (g, o) => {
    const { R, alea, voile } = o; R(g, c, 0, 0, 64, 64); patine(g, o);
    voile(g, 0.12, () => { for (let i = 0; i < 5; i++) R(g, i & 1 ? '#fff' : '#000', alea() * 50 | 0, alea() * 50 | 0, 8 + alea() * 14 | 0, 6 + alea() * 12 | 0); });
    voile(g, 0.3, () => { for (const k of [0, 32]) { R(g, '#000', 0, k, 64, 1); R(g, '#000', k, 0, 1, 64); } for (let x = 8; x < 64; x += 16) for (let y = 8; y < 64; y += 16) R(g, '#000', x, y, 1, 1); });
    coulures(g, o, 7);
  }, M];
  // pierre de taille : assises de 1 m, joints décalés, pierres inégales
  const pierre = c => () => [64, 64, (g, o) => {
    const { R, alea, voile } = o; R(g, c, 0, 0, 64, 64);
    voile(g, 0.1, () => { for (let y = 0; y < 64; y += 8) for (let x = (y & 8) - 8; x < 64; x += 16) if (alea() < 0.5) R(g, alea() < 0.5 ? '#000' : '#fff', x, y, 16, 8); });
    patine(g, o, 160);
    voile(g, 0.28, () => { for (let y = 0; y < 64; y += 8) { R(g, '#000', 0, y, 64, 1); for (let x = (y & 8); x < 64; x += 16) R(g, '#000', x, y, 1, 8); } });
    coulures(g, o, 4, '#000', 0.14);
  }, M];
  // métal peint : tôles de 4 m boulonnées, éraflures, rouille qui coule des joints
  const metal = c => () => [64, 64, (g, o) => {
    const { R, alea, voile } = o; R(g, c, 0, 0, 64, 64); patine(g, o, 140);
    voile(g, 0.35, () => { for (const k of [0, 32]) { R(g, '#000', 0, k, 64, 1); R(g, '#000', k, 0, 1, 64); } });
    voile(g, 0.3, () => { for (const k of [2, 34]) for (let i = 3; i < 64; i += 8) { R(g, '#fff', i, k, 1, 1); R(g, '#fff', k, i, 1, 1); } for (let i = 0; i < 8; i++) R(g, '#fff', alea() * 56 | 0, alea() * 64 | 0, 3 + alea() * 6 | 0, 1); });
    coulures(g, o, 5, '#5a2a10', 0.3);
  }, M];
  // revêtement : grain serré, rapiéçages, fissure
  const sol = c => () => [64, 64, (g, o) => {
    const { R, alea, voile } = o; R(g, c, 0, 0, 64, 64); patine(g, o, 420);
    voile(g, 0.18, () => { for (let i = 0; i < 3; i++) { const x = alea() * 44 | 0, y = alea() * 44 | 0, w = 8 + alea() * 12 | 0, h = 8 + alea() * 12 | 0; R(g, i & 1 ? '#fff' : '#000', x, y, w, h); R(g, '#000', x, y, w, 1); R(g, '#000', x, y, 1, h); }
      for (let y = 0, x = 40; y < 64; y++) { if (alea() < 0.3) x += alea() < 0.5 ? -1 : 1; if (y % 23 < 15) R(g, '#000', x, y, 1, 1); } });
  }, M];
  // écorce : fibres verticales, nœuds ; annelée pour le palmier
  const ecorce = (c, anneaux) => () => [64, 64, (g, o) => {
    const { R, alea, voile } = o; R(g, c, 0, 0, 64, 64);
    voile(g, 0.3, () => { for (let i = 0; i < 90; i++) R(g, alea() < 0.6 ? '#000' : '#fff', alea() * 64 | 0, alea() * 64 | 0, 1, 4 + alea() * 14 | 0); if (anneaux) for (let y = 0; y < 64; y += 4) R(g, '#000', 0, y + (alea() * 2 | 0), 64, 1); else for (let i = 0; i < 4; i++) R(g, '#000', alea() * 60 | 0, alea() * 60 | 0, 3, 2); });
  }, M / 2];
  // feuillage : masses claires et sombres ; etages = rameaux en nappes (cèdre), palmes = longues folioles
  const feuilles = (c, etages, palmes) => () => [64, 64, (g, o) => {
    const { R, alea, voile } = o; R(g, c, 0, 0, 64, 64);
    voile(g, 0.15, () => { for (let i = 0; i < 150; i++) R(g, alea() < 0.55 ? '#000' : '#fff', alea() * 64 | 0, alea() * 64 | 0, palmes ? 5 + alea() * 6 | 0 : 2 + alea() * 3 | 0, palmes ? 1 : 1 + alea() * 2 | 0); });
    if (etages) voile(g, 0.18, () => { for (let y = 5; y < 64; y += 8) for (let x = 0; x < 64; x += 2) { const d = alea() * 3 | 0; R(g, '#000', x, y + d, 2, 2); R(g, '#fff', x, y + d - 2, 2, 1); } });
  }];
  window.TEXTURES = {
  // ---------- aplats : ce qui émet de la lumière ----------
  peinture: 0xffffff,      // signalisation et luminaires, à teinter par l'option c
  neonJaune: 0xfcee0a, neonCyan: 0x00f0ff, neonMagenta: 0xff2bd6,
  lampe: 0xfff2d0, feuRouge: 0xff2030, catadioptre: 0xff8c1a, clignotant: 0xff8c1a, cone: 0xff5a1a, sodium: 0xffb85a, lanterne: 0xffd05a, lampeCanal: 0xffc04a,

  // ---------- matériaux, au détail de la chaussée ----------
  betonSombre: beton('#1c1c26'), beton: beton('#a89e90'), betonGris: beton('#5e5a54'), blancPont: beton('#c9ced6'), craie: pierre('#f4f0e8'), pierre: pierre('#d9c9a8'),
  acier: metal('#d8dce0'), matGris: metal('#4a4e56'), portiqueGris: metal('#5a5e66'), minium: metal('#c8442c'), fonte: metal('#1e3a2a'), fer: metal('#2a2030'), pylone: metal('#3a2c3a'),
  bitume: sol('#1e2024'), plaine: sol('#14161a'),
  tronc: ecorce('#4a3a2a'), troncPalmier: ecorce('#2a1c20', 1),
  cedre: feuilles('#12281f', 1), feuillage: feuilles('#4a6a3a'), palme: feuilles('#1a2418', 0, 1),
  // vitrage sombre : montants, reflets en biais
  vitreSombre: () => [32, 16, (g, o) => { const { R, voile } = o; R(g, '#14161c', 0, 0, 32, 16); voile(g, 0.14, () => { for (let k = 0; k < 16; k++) { R(g, '#fff', 4 + k, 15 - k, 4, 1); R(g, '#fff', 19 + k / 2 | 0, 15 - k, 2, 1); } }); R(g, '#08090c', 0, 0, 32, 1); R(g, '#08090c', 15, 0, 1, 16); }],
  // tôle ondulée claire, à teinter : conteneur ou remorque. Nervures, cadre, portes, marquage, rouille
  tole: () => [64, 32, (g, o) => {
    const { R, alea, voile } = o; R(g, '#e6e6e6', 0, 0, 64, 32);
    voile(g, 0.22, () => { for (let x = 0; x < 64; x += 3) { R(g, '#000', x, 0, 1, 32); R(g, '#fff', x + 1, 0, 1, 32); } });
    voile(g, 0.45, () => { R(g, '#000', 0, 0, 64, 2); R(g, '#000', 0, 30, 64, 2); R(g, '#000', 0, 0, 1, 32); R(g, '#000', 63, 0, 1, 32); R(g, '#000', 49, 2, 1, 28); });
    R(g, '#f8f8f8', 8, 8, 18, 6); voile(g, 0.5, () => { for (let x = 10; x < 24; x += 4) R(g, '#000', x, 10, 2, 2); R(g, '#000', 53, 12, 1, 8); R(g, '#000', 58, 12, 1, 8); });
    voile(g, 0.3, () => { for (let i = 0; i < 7; i++) R(g, '#5a2a10', alea() * 64 | 0, 2 + alea() * 12 | 0, 1 + (alea() * 2 | 0), 4 + alea() * 14 | 0); semis(g, o, 60, '#000'); });
  }],
  // wagon de marchandises clair, à teinter : planches, montants, porte coulissante, châssis
  wagon: () => [64, 32, (g, o) => {
    const { R, voile } = o; R(g, '#e2e2e2', 0, 0, 64, 32);
    voile(g, 0.2, () => { for (let y = 3; y < 26; y += 3) R(g, '#000', 0, y, 64, 1); semis(g, o, 90, '#000'); });
    voile(g, 0.4, () => { for (let x = 0; x < 64; x += 9) R(g, '#000', x, 0, 1, 26); R(g, '#000', 0, 0, 64, 2); R(g, '#000', 26, 3, 12, 22); });
    voile(g, 0.2, () => R(g, '#fff', 27, 4, 10, 20)); R(g, '#16161a', 0, 26, 64, 6); for (const x of [6, 14, 46, 54]) R(g, '#2c2c34', x, 27, 5, 5);
  }],
  // carrosserie claire, à teinter, vue de côté sur une seule boîte : bandeau vitré à montants, portes, bas de caisse et roues
  carrosserie: () => [64, 32, (g, o) => {
    const { R, voile } = o; R(g, '#ececec', 0, 0, 64, 32);
    R(g, '#141820', 10, 3, 42, 10); for (const x of [10, 24, 38, 51]) R(g, '#ececec', x, 3, 2, 10); voile(g, 0.2, () => { R(g, '#fff', 13, 4, 9, 2); R(g, '#fff', 27, 4, 9, 2); });
    voile(g, 0.3, () => { R(g, '#000', 0, 14, 64, 1); R(g, '#000', 25, 14, 1, 12); R(g, '#000', 39, 14, 1, 12); R(g, '#000', 0, 24, 64, 1); R(g, '#fff', 0, 15, 64, 1); semis(g, o, 40, '#000'); });
    R(g, '#101014', 0, 28, 64, 4); for (const x of [8, 46]) { R(g, '#101014', x, 22, 11, 10); R(g, '#3a3a44', x + 3, 25, 5, 5); }
  }],
  // laque claire, à teinter : le bas de caisse d'une voiture garée. Joints de portes, passages de roue, filet
  laque: () => [64, 16, (g, o) => {
    const { R, voile } = o; R(g, '#ececec', 0, 0, 64, 16);
    voile(g, 0.3, () => { R(g, '#fff', 0, 2, 64, 1); R(g, '#000', 0, 9, 64, 1); for (const x of [21, 36]) R(g, '#000', x, 0, 1, 12); semis(g, o, 30, '#000'); });
    R(g, '#101014', 0, 13, 64, 3); for (const x of [7, 46]) { R(g, '#101014', x, 6, 11, 10); R(g, '#3a3a44', x + 3, 9, 5, 5); }
  }],
  // entrepôt : bardage nervuré, portes de quai, bandeau de vitres hautes, salissures
  entrepot: () => [64, 32, (g, o) => {
    const { R, alea, voile } = o; R(g, '#8a7a6a', 0, 0, 64, 32);
    voile(g, 0.16, () => { for (let x = 0; x < 64; x += 2) R(g, '#000', x, 0, 1, 32); semis(g, o, 120, '#000'); });
    R(g, '#6a5c50', 0, 0, 64, 3); for (let x = 3; x < 64; x += 8) R(g, alea() < 0.3 ? '#c8b070' : '#3a3a40', x, 5, 5, 3);
    for (let x = 6; x < 64; x += 20) { R(g, '#5a5048', x, 16, 11, 16); voile(g, 0.3, () => { for (let y = 18; y < 32; y += 3) R(g, '#000', x, y, 11, 1); }); }
    coulures(g, o, 6, '#000', 0.18);
  }],

  // ---------- véhicules, navires, machines de port ----------
  metalClair: metal('#e2e2e2'), // tôle peinte claire, à teinter : cabine de camion, coque de navire, engin de port
  // pneu vu de profil : gomme, flanc, jante et ses écrous
  roue: () => [16, 16, (g, o) => {
    const { R, voile } = o; R(g, '#121214', 0, 0, 16, 16); R(g, '#1c1c20', 2, 2, 12, 12); R(g, '#6a6c72', 4, 4, 8, 8); R(g, '#3a3c42', 6, 6, 4, 4);
    for (const [x, y] of [[5, 5], [10, 5], [5, 10], [10, 10]]) R(g, '#a8aab0', x, y, 1, 1); voile(g, 0.3, () => semis(g, o, 20, '#000'));
  }],
  // bande de roulement : gomme noire, rainures
  pneu: () => [16, 16, (g, { R }) => { R(g, '#141416', 0, 0, 16, 16); for (let y = 1; y < 16; y += 3) R(g, '#08080a', 0, y, 16, 1); }],
  // calandre de camion : barreaux chromés sur fond noir, sigle rond inventé
  calandre: () => [32, 16, (g, o) => { const { R } = o; R(g, '#0c0c10', 0, 0, 32, 16); for (let y = 2; y < 15; y += 3) R(g, '#9a9ca4', 1, y, 30, 1); R(g, '#c8cad0', 0, 0, 32, 1); R(g, '#c8cad0', 0, 15, 32, 1); R(g, '#d8dae0', 14, 6, 4, 4); R(g, '#0c0c10', 15, 7, 2, 2); }],
  // citerne en inox : reflets en long, viroles soudées tous les 2 m, coulures
  inox: () => [64, 32, (g, o) => {
    const { R, alea, voile } = o; R(g, '#b4b8be', 0, 0, 64, 32);
    voile(g, 0.25, () => { for (let y = 0; y < 32; y++) R(g, alea() < 0.5 ? '#fff' : '#000', 0, y, 64, 1); });
    voile(g, 0.4, () => { for (const x of [0, 16, 32, 48]) R(g, '#000', x, 0, 1, 32); });
    R(g, '#e8eaee', 0, 10, 64, 2); coulures(g, o, 6, '#3a2a1a', 0.2);
  }, 8],
  // plateau en planches : lattes de 30 cm, clous, taches d'huile
  planches: () => [64, 64, (g, o) => {
    const { R, alea, voile } = o; R(g, '#6a4a2c', 0, 0, 64, 64);
    for (let y = 0; y < 64; y += 3) { R(g, alea() < 0.5 ? '#5a3c22' : '#7a5634', 0, y, 64, 2); R(g, '#2a1a10', 0, y + 2, 64, 1); }
    voile(g, 0.4, () => { for (let x = 4; x < 64; x += 16) for (let y = 1; y < 64; y += 3) R(g, '#c8c0b0', x, y, 1, 1); semis(g, o, 160, '#000'); for (let i = 0; i < 4; i++) R(g, '#000', alea() * 56 | 0, alea() * 56 | 0, 5 + alea() * 6 | 0, 3 + alea() * 4 | 0); });
  }, 4],
  // bobine d'acier vue de face : spires, cerclage
  bobine: () => [16, 16, (g, o) => { const { R, voile } = o; R(g, '#5a5c62', 0, 0, 16, 16); g.strokeStyle = '#8a8c92'; for (let r = 2; r < 8; r += 1.5) { g.beginPath(); g.arc(8, 8, r, 0, 7); g.stroke(); } R(g, '#18181c', 6, 6, 4, 4); voile(g, 0.5, () => R(g, '#c8102e', 0, 7, 16, 2)); }],
  // sangle orange tressée
  sangle: () => [8, 8, (g, { R }) => { R(g, '#d86a1a', 0, 0, 8, 8); for (let y = 0; y < 8; y += 2) R(g, '#b04a10', 0, y, 8, 1); }, 1],
  // pont d'un porte-conteneurs vu de côté : quatre étages de conteneurs de 20 et 40 pieds, couleurs mêlées, joints et portes
  cargaison: () => [64, 64, (g, o) => {
    const { R, alea, voile } = o, C = ['#b8442c', '#2c6ab8', '#c9a02c', '#3a8a5a', '#d8d4cc', '#7a3a6a', '#1a4a5a', '#c86a2a', '#5a5e66'];
    for (let y = 0; y < 64; y += 16) for (let x = -(alea() * 30 | 0); x < 64;) { const w = alea() < 0.5 ? 37 : 74; R(g, C[alea() * C.length | 0], x, y, w, 16); voile(g, 0.25, () => { for (let k = x + 1; k < x + w; k += 2) R(g, '#000', k, y + 1, 1, 14); }); R(g, '#16161a', x, y, 1, 16); x += w; }
    for (let y = 0; y < 64; y += 16) R(g, '#16161a', 0, y + 15, 64, 1);
    voile(g, 0.3, () => semis(g, o, 120, '#000'));
  }, 10.4],
  // treillis de charpente métallique : membrures, diagonales, fond transparent (matière en alphaTest)
  treillis: c => [32, 32, (g, o) => {
    const { R, voile } = o; g.clearRect(0, 0, 32, 32); R(g, c, 0, 0, 32, 3); R(g, c, 0, 29, 32, 3); R(g, c, 0, 0, 3, 32); R(g, c, 29, 0, 3, 32);
    for (let k = 0; k < 32; k++) { R(g, c, k, k, 2, 2); R(g, c, 31 - k, k, 2, 2); }
    voile(g, 0.35, () => { R(g, '#000', 0, 2, 32, 1); R(g, '#000', 0, 31, 32, 1); });
  }, 4],
  // façade de tour de ventilation : béton, bandes de persiennes inclinées, coulures sous chaque bande
  persiennes: () => [64, 64, (g, o) => {
    const { R, voile } = o; R(g, '#8e8a84', 0, 0, 64, 64); patine(g, o);
    for (let y = 6; y < 64; y += 16) { R(g, '#2a2c30', 2, y, 60, 8); voile(g, 0.6, () => { for (let k = y; k < y + 8; k += 2) R(g, '#9a9ca2', 2, k, 60, 1); }); voile(g, 0.25, () => { for (let x = 2; x < 62; x += 3) R(g, '#000', x, y + 8, 1, 2 + (o.alea() * 5 | 0)); }); }
    voile(g, 0.3, () => { R(g, '#000', 0, 0, 1, 64); R(g, '#000', 32, 0, 1, 64); });
  }, 8],
  // nacelle de grande roue, éclairée de l'intérieur : vitres, montants, bas de caisse coloré
  nacelle: c => [16, 16, (g, { R }) => { R(g, c, 0, 0, 16, 16); R(g, '#fff2d0', 2, 2, 12, 7); R(g, c, 7, 2, 2, 7); R(g, '#202028', 0, 10, 16, 1); R(g, '#ffffff', 0, 0, 16, 1); }],
  // signaux d'affectation de voie à l'entrée d'un tunnel : flèches vertes, croix rouge sur la voie fermée
  feuxVoie: n => [16 * n, 16, (g, { R }) => {
    R(g, '#08080c', 0, 0, 16 * n, 16);
    for (let i = 0; i < n; i++) { const x = i * 16; R(g, '#2a2a30', x, 0, 1, 16); if (i === n - 1) for (let k = 0; k < 9; k++) { R(g, '#ff2030', x + 4 + k, 4 + k, 1, 1); R(g, '#ff2030', x + 12 - k, 4 + k, 1, 1); } else { R(g, '#30ff70', x + 7, 3, 2, 7); for (let k = 0; k < 4; k++) R(g, '#30ff70', x + 4 + k, 9 + k, 8 - 2 * k, 1); } }
  }],
  // défense de remorqueur : vieux pneus noirs bout à bout
  defense: () => [16, 8, (g, { R }) => { R(g, '#0a0a0c', 0, 0, 16, 8); for (let x = 0; x < 16; x += 4) { R(g, '#1c1c20', x + 1, 1, 2, 6); R(g, '#000', x, 0, 1, 8); } }, 1.5],
  // terre-plein du port : enrobé, marquage jaune des emplacements tous les 3 m, taches
  parc: () => [64, 64, (g, o) => {
    const { R, alea, voile } = o; R(g, '#202226', 0, 0, 64, 64); patine(g, o, 380);
    voile(g, 0.55, () => { for (let x = 0; x < 64; x += 21) R(g, '#c8a02c', x, 0, 1, 64); R(g, '#c8a02c', 0, 0, 64, 1); R(g, '#c8a02c', 0, 32, 64, 1); });
    voile(g, 0.2, () => { for (let i = 0; i < 6; i++) R(g, '#000', alea() * 56 | 0, alea() * 56 | 0, 4 + alea() * 8 | 0, 3 + alea() * 6 | 0); });
  }, 24],

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
})();
