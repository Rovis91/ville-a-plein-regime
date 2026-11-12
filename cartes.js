// Les cartes du jeu : une carte = un tracé + une voiture + une radio + un thème (décor, lumière, interface). Aucun rendu ici.
// Chargé avant sim.js (navigateur) ou par lui (node). La carte active est choisie une fois, au chargement : ?carte=<id>, sinon la dernière jouée.
// Changer de carte recharge la page : le décor n'est construit qu'une fois, comme avant.
//
// Champs d'une carte :
//   W demi-largeur de route (m) · grip adhérence latérale maxi (m/s²) · sc échelle du tracé · pts [x, z, altitude], sens horaire, départ en [0]
//   camH hauteur de la caméra (m, 2,2 par défaut : à relever quand la voiture masque la route) · tun [a, b] tunnel entre deux points (ou null) · chaud [a, b] secteur où la musique se déchaîne · sect [a, b] les deux temps intermédiaires
//   anticipe : le pilote automatique calcule sa distance de freinage (indispensable dès qu'il y a une épingle)
//   rivaux : prénoms des trois adversaires du mode course (sinon ceux de la ville) · trafic : nombre de camions à doubler · car : la voiture (format CARD de sim.js) · radio : stations (format ST de game.js) · th : thème
(function (G) {
  const _ = null;
  // voiture : up / down = régimes de passage de la boîte auto ; trac = accélération maxi que les pneus passent au sol (m/s²) ;
  // rwd = propulsion : accélérer fort prend sur l'adhérence latérale des roues arrière ; son = hauteur du moteur ; look = silhouette
  const car = (o) => Object.assign({ up: o.red * 0.94, down: o.red * 0.775, eff: 0.88, trac: 8.5, rwd: 1, son: 1 }, o);

  // thème d'une station : accords sur 8 mesures, fondamentales, motifs de 16 pas
  const DARK = [[57, 60, 64], [57, 60, 64], [53, 57, 60], [55, 59, 62], [57, 60, 64], [57, 60, 64], [58, 62, 65], [56, 59, 64]]; // Am Am F G | Am Am Bb E
  const JAZZ = [[62, 65, 69, 72], [59, 62, 65, 67], [60, 64, 67, 71], [57, 60, 64, 67]]; // Dm7 G7 Cmaj7 Am7
  const LEAD = [[[0, 76, 3], [3, 76, 2], [6, 74, 2], [8, 76, 4], [12, 79, 4]], [[0, 76, 6], [8, 72, 2], [10, 74, 2], [12, 72, 4]],
    [[0, 77, 3], [3, 77, 2], [6, 76, 2], [8, 77, 4], [12, 81, 4]], [[0, 79, 6], [8, 74, 2], [10, 76, 2], [12, 74, 4]],
    [[0, 76, 3], [3, 76, 2], [6, 74, 2], [8, 76, 4], [12, 79, 4]], [[0, 76, 6], [8, 72, 2], [10, 74, 2], [12, 72, 4]],
    [[0, 77, 3], [3, 77, 2], [6, 74, 2], [8, 77, 4], [12, 82, 4]], [[0, 80, 8], [8, 83, 8]]];
  const E1 = [[0, 77, 2], [2, 74, 1], [3, 77, 2], [6, 79, 2], [8, 77, 2], [10, 74, 2], [12, 72, 2], [14, 74, 2]], E2 = [[0, 76, 2], [2, 72, 1], [3, 76, 2], [6, 79, 2], [8, 76, 2], [10, 72, 2], [12, 76, 2], [14, 79, 2]];
  const T1 = [[0, 83, 6], [6, 79, 2], [8, 76, 8]], T2 = [[0, 84, 6], [6, 79, 2], [8, 76, 4], [12, 79, 4]];
  const P1 = [[0, 79, 4], [4, 75, 2], [6, 77, 2], [8, 79, 6], [14, 82, 2]], P2 = [[0, 84, 6], [6, 82, 2], [8, 80, 8]];
  const L1 = [[0, 86, 6], [6, 84, 2], [8, 82, 4], [12, 79, 4]], L2 = [[0, 82, 2], [2, 84, 2], [4, 86, 8], [12, 89, 4]];

  G.CARTES = [
    { id: 'ville', nom: 'VILLE A PLEIN REGIME', camH: 3.8, W: 9, grip: 44, sc: 0.85, tun: [6, 12], chaud: [6, 12], sect: [6, 12],
      pts: [[0, 0, 0], [220, 0, 0], [420, 10, 4], [560, 90, 10], [600, 240, 12], [520, 370, 6], [360, 400, -2], [230, 340, -10], [110, 400, -14], [0, 520, -14], [-150, 560, -10], [-300, 500, -4], [-360, 360, 2], [-300, 240, 8], [-380, 120, 6], [-330, 10, 2], [-180, 0, 0]],
      // Nismo Skyline GT-R Z-tune (R34, 6 cylindres en ligne biturbo « Z2 » de 2,8 L, boîte Getrag 6 rapports) : données constructeur
      car: { nom: 'NISMO GT-R Z-TUNE', ratios: [3.827, 2.360, 1.685, 1.312, 1.000, 0.793], final: 3.545, // démultiplications
        wheel: 0.326, mass: 1675, eff: 0.85, // rayon de roue (m) ; 1600 kg + pilote ; ~15 % de pertes de transmission (4 roues motrices)
        idle: 950, red: 8000, cd: 0.34, area: 2.1, // ralenti, zone rouge (tr/min) ; aérodynamique
        tq: [0, 200, 330, 450, 520, 540, 535, 505, 420], // couple (N·m) tous les 1000 tr/min : 540 N·m à 5200, 500 ch à 6800 (forme de la courbe estimée)
        up: 7500, down: 6200, trac: 11, rwd: 0, son: 1, // 4 roues motrices : ~1,1 g de motricité, pas de survirage à l'accélérateur
        look: { col: 0xff2030, l: 1, w: 1, h: 1, nez: 0.62, cab: [-0.5, 2.1, 0.5], aileron: 1, neon: 0x00f0ff } },
      radio: [
        { name: 'NIGHT CITY FM', fq: '98.7', bpm: 126, CH: DARK, ROOT: [33, 33, 29, 31, 33, 33, 34, 28], kick: '1000100010001000', kickB: '1000100010101000', clapMin: 0,
          rifA: [0, _, 0, 0, _, _, 12, 0, _, _, 0, 3, 0, _, -2, 1], rifB: [0, _, 0, 0, _, _, 12, 0, _, 0, 7, _, 6, _, 5, 3], sat: 1, arp: 1, stab: [0, 3, 6, 11], stabAlways: 0, lead: LEAD }, // darksynth
        { name: 'PULSE 104', fq: '104.2', bpm: 122, CH: [...JAZZ, ...JAZZ], ROOT: [38, 31, 36, 33, 38, 31, 36, 33], kick: '1000100010001000', kickB: '1000100010001000', clapMin: 0.3,
          rifA: [0, _, _, 0, _, _, 12, _, 0, _, _, 12, _, 7, _, 10], rifB: [0, _, _, 0, _, _, 12, _, 0, _, 12, _, 10, _, 7, _], sat: 0, arp: 1, stab: [2, 6, 10, 14], stabAlways: 1, lead: null, cb: 1 }, // house filtrée
        { name: 'KAIZO BREAKS', fq: '87.5', bpm: 168, CH: DARK, ROOT: [33, 33, 29, 31, 33, 33, 34, 28], kick: '1000000000100000', kickB: '1000000100100000', clapMin: 0.4,
          rifA: [0, _, _, _, _, _, _, _, _, _, 0, _, 3, _, _, _], rifB: [0, _, _, _, _, _, 7, _, _, _, 6, _, 5, _, 3, _], sat: 1, arp: 0, stab: [], stabAlways: 0, lead: LEAD, sn: 1 }, // breakbeat
      ],
      th: { decor: 'ville', fog: 0x1f0a36, fogD: [60, 800], sky: [[0, '#03020a'], [0.36, '#120a2e'], [0.47, '#5a1058'], [0.5, '#1f0a36'], [1, '#1f0a36']], stars: 140,
        astre: { dir: [0.45, 0.8, 0.4], col: '#d8e8ff', ombre: '#a8b8e0', taille: 170 }, hemi: [0x5a6cff, 0xff2a6a, 0.55], sun: [0x8fb0ff, 0.35], phares: 2.6, bloom: 0.13, scan: 0.12,
        pluie: 1, orage: 1, alarme: 1, chev: 1, piles: -61, tubes: 1, reflets: '#00a8b8', pubs: 1, murH: 1.4,
        route: ['#2c2c3a', '#383848', '#fcee0a', '#d8d8e0', '#fcee0a', '#08080c', true], mur: ['#12121a', '#00f0ff', '#fcee0a', '#0a0a10'], depart: [0xfcee0a, 0x00f0ff, '#fcee0a'],
        tun: { sol: ['#1a0606', '#260a0a', '#ff003c', '#fcee0a', '#ff003c', '#220000'], murs: ['#ff003c', '#fcee0a'], paroi: ['#140406', '#3a0a10', '#5a1018', '#080203'], plafond: ['#0c0304', '#ff5a6a', '#ffd84a', '#3a0a10'],
          fog: 0x2a0308, portail: 0xfcee0a, neons: [0xfcee0a, 0xff003c], reflets: ['#c0002c', '#b8a808'], coque: 80 },
        hud: { y: '#fcee0a', c: '#00f0ff', r: '#ff003c', fond: 'rgba(8,8,12,.82)', style: 'cyber', split: 1, jp: ['ラップ', 'スピード'], sur: ['夜間タイムアタック', 'CONTRE-LA-MONTRE NOCTURNE'], titre: ['VILLE À', 'PLEIN REGIME'] } } },

    // Touge : départ en descente, montée à 13 %, plateau du carrefour (supérette et station-service), puis quatre épingles empilées à 10 %. Adhérence de vraie route (2 g avec des pneus de course), route étroite.
    { id: 'touge', nom: 'KARASU-TOGE', W: 6, grip: 21, sc: 1, tun: null, chaud: [14, 40], sect: [10, 40], anticipe: 1,
      pts: [[0, 0, 20], [150, 0, 14], [300, -40, 10], [430, -10, 22], [560, -70, 38], [700, -40, 56], [820, 40, 74], [860, 170, 92], [800, 290, 108], [840, 400, 122], [790, 500, 132], [720, 580, 135], [640, 610, 135], [570, 580, 133], [542, 520, 130], [540, 430, 121], [540, 345, 112], [534, 331, 111], [520, 325, 110], [506, 331, 109], [500, 345, 108], [500, 430, 99], [500, 515, 90], [494, 529, 89], [480, 535, 88], [466, 529, 87], [460, 515, 86], [460, 430, 77], [460, 345, 68], [454, 331, 67], [440, 325, 66], [426, 331, 65], [420, 345, 64], [420, 430, 55], [420, 515, 46], [414, 529, 45], [400, 535, 44], [386, 529, 43], [380, 515, 42], [380, 430, 33], [372, 350, 26], [335, 285, 22], [250, 250, 18], [150, 275, 16], [50, 300, 22], [-60, 260, 19], [-150, 180, 18], [-200, 80, 18], [-140, 5, 19]],
      // Mazda RX-7 Spirit R Type A (FD3S, 2002) : birotor biturbo 13B-REW, 280 ch à 6500 tr/min, 314 N·m à 5000, 1270 kg, propulsion (rapports à vérifier sur fiche)
      car: car({ nom: 'MAZDA RX-7 SPIRIT R', ratios: [3.483, 2.015, 1.391, 1.000, 0.719], final: 4.1, wheel: 0.318, mass: 1345, idle: 900, red: 8000, cd: 0.31, area: 1.8,
        tq: [0, 150, 220, 270, 300, 314, 308, 290, 240], son: 1.5, look: { col: 0xf4f0e0, l: 0.95, w: 0.96, h: 0.9, nez: 0.72, cab: [-0.35, 1.9, 0.48], aileron: 1 } }),
      radio: [{ name: 'USUI FM', fq: '156', bpm: 156, CH: [[58, 62, 65], [60, 64, 67], [62, 65, 69], [62, 65, 69], [58, 62, 65], [60, 64, 67], [57, 61, 64], [57, 61, 64]], ROOT: [34, 36, 38, 38, 34, 36, 33, 33],
        kick: '1000100010001000', kickB: '1000100010001010', clapMin: 0.35, rifA: [0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 0, 0, 12, 0, 12], rifB: [0, 0, 12, 0, 0, 0, 12, 0, 0, 12, 0, 12, 7, 12, 10, 12], sat: 0, arp: 0, stab: [2, 6, 10, 14], stabAlways: 1,
        lead: [E1, E2, [[0, 81, 3], [3, 79, 3], [6, 77, 2], [8, 76, 2], [10, 77, 2], [12, 74, 4]], [[0, 74, 2], [2, 77, 2], [4, 81, 2], [6, 82, 2], [8, 81, 4], [12, 77, 2], [14, 76, 2]],
          E1, E2, [[0, 76, 3], [3, 73, 3], [6, 76, 2], [8, 81, 3], [11, 79, 3], [14, 76, 2]], [[0, 73, 2], [2, 76, 2], [4, 79, 2], [6, 81, 2], [8, 85, 8]]] }], // eurobeat
      th: { decor: 'touge', fog: 0x0b1614, fogD: [45, 560], sky: [[0, '#02040a'], [0.4, '#0a1420'], [0.49, '#1a2a30'], [0.5, '#0b1614'], [1, '#0b1614']], stars: 240,
        astre: { dir: [-0.3, 0.75, 0.5], col: '#f4f8ff', ombre: '#c8d0e0', taille: 230 }, hemi: [0x7a96c0, 0x16302a, 0.55], sun: [0xbfd0ff, 0.5], phares: 3.2, bloom: 0.1, scan: 0.1,
        chev: 1, murH: 1.1, route: ['#26282c', '#34363c', '#e8e6da', '#ff8c1a', '#26282c', '#26282c', false], mur: ['#34363a', '#e8e6da', '#a8a69c', '#101214'], depart: [0xff8c1a, 0xe8e6da, '#e8e6da'],
        hud: { y: '#f4f0e0', c: '#ff8c1a', r: '#ff2a3a', fond: 'rgba(6,12,10,.84)', style: 'trait', split: 0, jp: ['ラップ', 'スピード'], sur: ['烏峠ダウンヒル', 'DESCENTE DE NUIT'], titre: ['KARASU', 'TOGE'] } } },

    // Wangan : voie rapide du front de mer à fond, pont à haubans vers l'île du port, enfilade entre les conteneurs, tunnel immergé sous le chenal, retour en ville. Du trafic à doubler.
    { id: 'wangan', nom: 'WAN-9', W: 8, grip: 24, sc: 1, tun: [23, 28], chaud: [12, 22], sect: [8, 22], anticipe: 1, trafic: 9,
      pts: [[0, 0, 18], [400, 0, 18], [800, 0, 18], [1100, 10, 18], [1300, 60, 19], [1400, 180, 23], [1410, 310, 33], [1400, 440, 26], [1390, 550, 19], [1340, 660, 12], [1220, 730, 6], [1080, 740, 3], [940, 700, 2], [800, 760, 2], [660, 700, 2], [520, 770, 2], [380, 710, 2], [240, 780, 2], [100, 720, 2], [-60, 790, 2], [-220, 760, 2], [-400, 800, 2], [-540, 760, 0], [-610, 660, -5], [-620, 540, -13], [-620, 400, -15], [-610, 250, -15], [-620, 110, -14], [-620, -20, -9], [-600, -130, 0], [-520, -230, 9], [-380, -250, 15], [-240, -180, 18], [-150, -60, 18]],
      // Toyota Supra RZ (JZA80, 1997) : 6 en ligne biturbo 2JZ-GTE, fiche export 320 ch, 427 N·m à 4000 tr/min, 1510 kg, Getrag V160 (rapports à vérifier sur fiche)
      car: car({ nom: 'TOYOTA SUPRA RZ', ratios: [3.827, 2.360, 1.685, 1.312, 1.000, 0.793], final: 3.266, wheel: 0.318, mass: 1585, idle: 800, red: 6800, cd: 0.32, area: 1.95,
        tq: [0, 180, 300, 400, 427, 420, 400, 340, 260], son: 0.95, look: { col: 0x4a4e5c, l: 1.02, w: 1, h: 0.96, nez: 0.66, cab: [-0.45, 2.1, 0.5], aileron: 2 } }),
      radio: [{ name: 'BAY 138', fq: '138', bpm: 138, CH: [[64, 67, 71], [60, 64, 67], [59, 62, 67], [62, 66, 69], [64, 67, 71], [60, 64, 67], [59, 62, 67], [62, 66, 69]], ROOT: [28, 36, 31, 38, 28, 36, 31, 38],
        kick: '1000100010001000', kickB: '1000100010001000', clapMin: 0.2, rifA: [_, _, 0, 0, _, _, 0, 0, _, _, 0, 0, _, _, 0, 12], rifB: [_, _, 0, 0, _, _, 0, 0, _, _, 0, 12, _, _, 7, 12], sat: 0, arp: 1, stab: [], stabAlways: 0,
        lead: [T1, T2, [[0, 86, 6], [6, 83, 2], [8, 79, 8]], [[0, 81, 4], [4, 78, 4], [8, 81, 4], [12, 78, 2], [14, 81, 2]], T1, T2, [[0, 86, 6], [6, 83, 2], [8, 91, 8]], [[0, 90, 8], [8, 86, 8]]] }], // trance
      th: { decor: 'wangan', fog: 0x0c1424, fogD: [90, 1300], sky: [[0, '#02030a'], [0.38, '#0a1024'], [0.47, '#4a2c18'], [0.5, '#0c1424'], [1, '#0c1424']], stars: 40,
        astre: { dir: [0.5, 0.7, -0.4], col: '#e8e0d0', ombre: '#b8b0a0', taille: 120 }, hemi: [0x4a5a8a, 0xff9a2e, 0.55], sun: [0x8fa0d0, 0.25], phares: 2.4, bloom: 0.1, scan: 0.1,
        chev: 1, piles: -14, murH: 1.4, route: ['#24262e', '#30323c', '#f4f1e0', '#f4f1e0', '#24262e', '#24262e', false], mur: ['#3a3e46', '#c9ced6', '#ff9a2e', '#16181e'], depart: [0x1f8f5a, 0xc9ced6, '#f4f1e0'],
        tun: { sol: ['#2a2218', '#3a2e20', '#f4f1e0', '#f4f1e0', '#2a2218', '#2a2218'], murs: ['#ffb85a', '#ffb85a'], paroi: ['#3a2c18', '#6a5028', '#8a6a38', '#120e08'], plafond: ['#1a140c', '#ffb85a', '#ffb85a', '#3a2e20'],
          fog: 0x2a1a08, portail: 0x1f8f5a, neons: [0xff9a2e, 0xff9a2e], coque: 80 },
        hud: { y: '#ffffff', c: '#ffb85a', r: '#ff2a3a', fond: 'rgba(10,84,52,.92)', style: 'panneau', split: 0, jp: ['周回', '速度'], sur: ['湾岸九号線', 'LIGNE DE BAIE'], titre: ['WAN-9', 'BAYSHORE'] } } },

    // Paris à l'aube : circuit de rues, relances entre des angles, pavés.
    { id: 'paris', nom: 'PREMIER METRO', rivaux: ['LUCIE', 'MARC', 'INES'], W: 7, grip: 19, sc: 1, tun: [27, 30], chaud: [13, 22], sect: [12, 25], anticipe: 1,
      pts: [[0, 0, 0], [200, 0, 0], [330, 15, 0], [424, 70, 0], [476, 70, 0], [515, 37, 0], [524, -13, 0], [498, -57, 0], [430, -160, 0], [420, -300, 2], [450, -390, 4], [540, -420, 6], [700, -420, 8], [810, -435, 12], [880, -480, 19], [860, -545, 26], [800, -590, 31], [830, -660, 37], [930, -670, 42], [1020, -630, 44], [1070, -540, 38], [1040, -410, 26], [1085, -280, 14], [1060, -150, 4], [1100, 0, 0], [1090, 140, -2], [1010, 225, -4], [800, 240, -6], [600, 250, -12], [400, 250, -12], [200, 240, -6], [0, 240, -3], [-150, 225, 0], [-235, 150, 0], [-235, 60, 0], [-150, 0, 0]],
      // Renault 5 Maxi Turbo (1985, Groupe B) : 4 cylindres turbo 1,5 L, 350 ch, 905 kg, moteur central arrière, propulsion (rapports estimés)
      car: car({ nom: 'RENAULT 5 MAXI TURBO', ratios: [3.36, 2.06, 1.38, 1.06, 0.82], final: 3.89, wheel: 0.29, mass: 980, idle: 1000, red: 7500, cd: 0.40, area: 1.9,
        tq: [0, 120, 220, 330, 400, 420, 400, 370, 300], son: 1.25, look: { col: 0xf2c400, l: 0.8, w: 0.98, h: 1.12, nez: 0.3, cab: [-0.25, 2.3, 0.62], aileron: 0 } }),
      radio: [{ name: 'RADIO 5H30', fq: '89.0', bpm: 120, CH: [[60, 63, 67], [56, 60, 63], [53, 56, 60], [55, 59, 62], [60, 63, 67], [56, 60, 63], [53, 56, 60], [55, 59, 62]], ROOT: [36, 32, 29, 31, 36, 32, 29, 31],
        kick: '1000100010001000', kickB: '1000100010001000', clapMin: 0.3, rifA: [0, _, 12, _, 0, _, 12, _, 0, _, 12, _, 0, _, 12, 12], rifB: [0, _, 12, _, 0, _, 12, _, 0, 12, 7, 12, 0, 12, 10, 12], sat: 0, arp: 1, stab: [], stabAlways: 0, leadW: 'tri',
        lead: [P1, P2, [[0, 77, 4], [4, 80, 2], [6, 84, 2], [8, 82, 4], [12, 80, 4]], [[0, 79, 4], [4, 83, 4], [8, 86, 8]], P1, P2, [[0, 77, 4], [4, 80, 2], [6, 84, 2], [8, 87, 4], [12, 84, 4]], [[0, 83, 8], [8, 79, 8]]] }], // disco spatiale
      th: { decor: 'paris', fog: 0xf0b89a, fogD: [140, 1500], sky: [[0, '#2b3a67'], [0.26, '#2b3a67'], [0.27, '#5a6a9a'], [0.38, '#5a6a9a'], [0.39, '#c08a9a'], [0.45, '#c08a9a'], [0.46, '#f0b89a'], [1, '#f0b89a']], stars: 0,
        astre: { dir: [0.8, 0.14, 0.3], col: '#fff0c0', ombre: '#fff0c0', taille: 260 }, hemi: [0xa8b8e8, 0xd9c9a8, 0.95], sun: [0xffc890, 0.75], phares: 0.5, bloom: 0.03, scan: 0.05,
        rues: [[0, 'boulevard'], [3, 'place'], [8, 'avenue'], [11, 'rue'], [13, 'ruelle'], [19, 'rue'], [24, 'avenue'], [26, 'quai'], [31, 'avenue'], [33, 'boulevard']],
        murH: 0.5, route: ['#4a4a52', '#56565e', '#e8e4d8', '#e8e4d8', '#8a8478', '#8a8478', false], mur: ['#8a8478', '#b0a898', '#8a8478', '#6a665e'], depart: [0x1d2f6f, 0x2a7a4a, '#f4f0e0'],
        tun: { sol: ['#3a3a40', '#46464c', '#e8e4d8', '#e8e4d8', '#3a3a40', '#3a3a40'], murs: ['#ffd05a', '#ffd05a'], paroi: ['#b8b4a8', '#d8d4c8', '#8a867a', '#5a564e'], plafond: ['#3a3830', '#ffe9a0', '#ffe9a0', '#5a564e'],
          fog: 0x40382a, portail: 0x5d6b82, neons: [0xffd05a, 0xffd05a], coque: 14 },
        hud: { y: '#ffffff', c: '#ffd05a', r: '#ff6a5a', fond: 'rgba(24,44,110,.92)', style: 'plaque', split: 0, jp: null, sur: [null, 'PARIS · 5 H 30'], titre: ['PREMIER', 'METRO'] } } },

    // Canal de Los Angeles à l'heure dorée : béton mouillé, large, la carte de la glisse. Fresques fléchées et balises à l'extérieur des courbes.
    { id: 'canal', nom: 'CANAL 6', rivaux: ['DRE', 'ROSA', 'CAL'], W: 14, grip: 15, sc: 1, tun: null, chaud: [1, 8], sect: [7, 19], anticipe: 1,
      pts: [[0, 0, -8], [250, -80, -8], [500, 90, -8], [750, -80, -8], [1000, 90, -8], [1250, -80, -8], [1500, 60, -8], [1720, 40, -8], [1825, 123, -5], [1828, 168, -3], [1803, 206, -1], [1760, 220, 2], [1500, 230, 4], [1300, 290, 4], [1100, 220, 4], [900, 290, 4], [700, 220, 4], [500, 290, 4], [300, 220, 4], [50, 240, 4], [-170, 230, 2], [-256, 156, -1], [-270, 110, -3], [-256, 64, -5], [-170, -10, -8]],
      // Dodge Viper GTS (1996) : V10 de 8,0 L, 450 ch à 5200 tr/min, 664 N·m à 3700, 1535 kg, propulsion, boîte T56 (rapports à vérifier sur fiche)
      car: car({ nom: 'DODGE VIPER GTS', ratios: [2.66, 1.78, 1.30, 1.00, 0.74, 0.50], final: 3.07, wheel: 0.333, mass: 1610, idle: 800, red: 6000, cd: 0.35, area: 1.9,
        tq: [0, 420, 560, 640, 664, 625, 540, 400, 0], son: 0.8, look: { col: 0x1848c8, l: 1.03, w: 1.05, h: 0.88, nez: 0.7, cab: [-0.95, 1.7, 0.46], aileron: 0, bandes: 0xf4f0e0 } }),
      radio: [{ name: 'KDAY 94', fq: '94.0', bpm: 94, CH: [[58, 62, 65, 67], [58, 62, 65, 67], [58, 62, 63, 67], [58, 62, 63, 67], [58, 62, 65, 67], [58, 62, 65, 67], [58, 60, 63, 67], [57, 60, 62, 66]], ROOT: [31, 31, 27, 27, 31, 31, 36, 38],
        kick: '1000000010100000', kickB: '1000000010100100', clapMin: 0.45, rifA: [0, _, _, 0, _, _, 7, _, _, _, 10, _, 12, _, _, _], rifB: [0, _, _, 0, _, _, 7, _, _, 10, _, 12, _, 10, 7, _], sat: 0, arp: 0, stab: [], stabAlways: 0, leadW: 'sine', sw: 0.3, sn: 1,
        lead: [L1, L2, [[0, 87, 6], [6, 86, 2], [8, 82, 4], [12, 79, 4]], [[0, 77, 4], [4, 79, 12]], L1, L2, [[0, 87, 6], [6, 84, 2], [8, 82, 4], [12, 84, 4]], [[0, 86, 4], [4, 81, 4], [8, 78, 8]]] }], // g-funk
      th: { decor: 'canal', fog: 0xe89060, fogD: [160, 1700], sky: [[0, '#3d2a5c'], [0.24, '#3d2a5c'], [0.25, '#7a4078'], [0.36, '#7a4078'], [0.37, '#d85a50'], [0.44, '#d85a50'], [0.45, '#ff9a4a'], [0.49, '#ff9a4a'], [0.5, '#e89060'], [1, '#e89060']], stars: 0,
        astre: { dir: [-0.85, 0.11, 0.35], col: '#fff4c0', ombre: '#fff4c0', taille: 340 }, hemi: [0xb898c8, 0xb8ad9a, 0.85], sun: [0xffa860, 0.9], phares: 0.4, bloom: 0.03, scan: 0.05,
        murH: 1.3, route: ['#7a7066', '#867c70', '#f4f0e0', '#2aa39a', '#e83f8c', '#f4f0e0', true], mur: ['#2a2030', '#f4f0e0', '#e83f8c', '#1a1420'], depart: [0xff7a3d, 0x3d2a5c, '#f4f0e0'],
        hud: { y: '#ffc04a', c: '#ff7a3d', r: '#e83f8c', fond: 'rgba(40,24,56,.9)', style: 'bloc', split: 0, jp: null, sur: [null, 'LOS ANGELES · HEURE DOREE'], titre: ['CANAL', 'SIX'] } } },
  ];
  let id = 'ville';
  if (typeof location !== 'undefined') try { id = new URLSearchParams(location.search).get('carte') || localStorage.getItem('vpr.carte') || id; } catch (e) { }
  G.CARTE = G.CARTE || G.CARTES.find(m => m.id === id) || G.CARTES[0];
})(typeof window !== 'undefined' ? window : globalThis);
