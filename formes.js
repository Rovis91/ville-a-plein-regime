// Catalogue des formes : la géométrie de chaque objet du décor, et rien d'autre (ni texture, ni emplacement). Mètres, origine au pied de l'objet.
// Deux sortes d'entrées, toutes des fonctions de leurs réglages :
//   forme simple — renvoie une géométrie three, posée telle quelle ou en nombre (inst)
//   assemblage   — renvoie une liste de boîtes [zone, largeur, hauteur, profondeur, x, y, z, rotation [rx, ry, rz], porte une ombre] ;
//                  la zone nomme la partie, pour que le placement lui donne sa texture : pose('station', { acier: …, lampe: … }, parent, [x, y, z])
// Les textures sont dans textures.js. La piste elle-même (chaussée, murs, tunnel) est un ruban généré le long du tracé dans game.js, et la voiture y reste aussi.
(function () {
  // dim = dimensions réelles en mètres, pour que le placement règle la densité des textures ; H = hauteur typique d'une boîte étirée en hauteur par instance
  const B = (w, h, d, H = h) => { const g = new THREE.BoxGeometry(w, h, d); g.userData.dim = [w, H, d]; return g; };
  const paire = f => [-1, 1].map(f); // une pièce de chaque côté
  const roues = (xs, z, d = 1, w = 0.5) => xs.flatMap(x => paire(sd => [0, 0.785].map(a => [a ? 'pneu' : 'roue', d, d, w, x, d / 2, sd * z, [0, 0, a]])).flat()); // roue = deux boîtes croisées, la jante et le pneu : un octogone de profil
  // commun à toutes les remorques : essieux tandem, béquilles, feux arrière, barre anti-encastrement
  const remorque = [...roues([-4.4, -5.6], 0.95), ...paire(sd => ['chassis', 0.2, 0.9, 0.2, 1.4, 0.6, sd * 0.8]), ...paire(sd => ['feu', 0.1, 0.25, 0.5, -6.45, 1.2, sd * 0.85]), ['chassis', 0.15, 0.15, 2.2, -6.3, 0.8, 0]];
  window.FORMES = {
    // ---------- formes simples ----------
    boite: (w, h, d) => B(w, h, d),                                   // pièce unique aux dimensions libres : dalle d'eau, tour lointaine, pile de pont
    bloc: () => B(1, 1, 1),                     // cube unité, mis à l'échelle par instance : immeubles, tours, entrepôts
    immeuble: (w, H, d) => {                    // tour de la ville : la texture de fenêtres se répète tous les 28 m
      const g = B(w, H, d), uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(w / 28)), uv.getY(i) * Math.max(1, Math.round(H / 28)));
      return g;
    },
    // piste
    luminaireTunnel: () => B(1.8, 0.25, 3.2), boitierSecours: () => B(0.12, 0.7, 1.4),
    chevron: () => new THREE.PlaneGeometry(5, 2.5), pileViaduc: () => B(5, 1, 5, 24), tubeNeon: () => B(0.35, 7, 0.35), refletTube: () => new THREE.PlaneGeometry(7, 1.6),
    faisceau: () => { const g = new THREE.PlaneGeometry(26, 900); g.translate(0, 450, 0); return g; }, hologramme: () => new THREE.PlaneGeometry(90, 45),
    // mobilier de route
    matLampadaire: () => B(0.3, 10, 0.3), teteLampadaire: (l = 3.2) => B(l, 0.25, 0.7), reverbere: () => B(0.25, 7, 0.25), lanterne: () => B(0.7, 0.8, 0.7),
    catadioptre: () => B(0.18, 0.3, 0.18), cone: () => B(0.4, 0.7, 0.4), balise: () => B(0.5, 6.2, 0.5), murFresque: () => new THREE.PlaneGeometry(15.8, 5),
    // végétation
    cedre: () => new THREE.ConeGeometry(3.6, 15, 5), tronc: () => B(0.5, 5.2, 0.5), houppier: () => new THREE.IcosahedronGeometry(3.4, 0),
    troncPalmier: () => B(0.55, 1, 0.55, 14), palme: () => new THREE.IcosahedronGeometry(4, 0),
    // véhicules et fret
    auto: () => B(4.1, 1.3, 1.75), conteneur: () => B(12, 2.6, 2.5), wagon: () => B(17, 4.2, 3.2), cheminee: () => B(0.8, 2, 2.2), clim: () => B(3, 2, 3.4), reservoir: () => new THREE.CylinderGeometry(2.2, 2.2, 4.4, 8),
    remorque: () => B(8, 3.1, 2.5), cabine: () => B(2.2, 2.6, 2.4), feuxCamion: () => B(0.15, 0.5, 2.3),
    // grands repères
    pyloneHT: () => B(1.6, 48, 1.6), brasHT: () => B(1, 1, 16), dome: (r, seg, ann) => new THREE.SphereGeometry(r, seg, ann, 0, 6.283, 0, 1.6),

    // ---------- assemblages ----------
    // piste (W = demi-largeur de chaussée)
    portailTunnel: W => [['portail', 2 * W + 6, 4, 3, 0, 10, 0], ...paire(sd => ['portail', 3, 12, 3, sd * (W + 1.5), 6, 0])],
    // portique de départ, X en travers : deux pieds en treillis sur embases de béton hors des glissières, jambes de force, poutre treillis de 1,5 m (damier dessous),
    // rampe de cinq feux sur chaque face, deux projecteurs par face inclinés vers la ligne, bandeau lumineux au nom de la carte ; damier au sol
    depart: W => {
      const xp = W + 2.2, L = 2 * xp + 1.5, dx = 2.8, dy = 2.7, jl = Math.hypot(dx, dy), ja = Math.atan2(dx, dy), th = 0.55;
      return [['sol', 2 * W, 0.06, 4, 0, 0, 0],
        ...paire(sd => [['beton', 2.4, 0.7, 2.4, sd * xp, 0.35, 0], ['acier', 1.7, 0.12, 1.7, sd * xp, 0.76, 0], ['treillis', 1.5, 7.6, 1.5, sd * xp, 4.6, 0], ['acier', 1.7, 0.15, 1.7, sd * xp, 8.45, 0],
          ...paire(a => paire(b => ['acier', 0.2, 7.6, 0.2, sd * xp + a * 0.75, 4.6, b * 0.75])).flat(),
          ['acier', 0.22, jl, 0.22, sd * (xp - 0.75 - dx / 2), 4.5 + dy / 2, 0, [0, 0, sd * ja]]]).flat(),
        ['treillis', L, 1.5, 1.5, 0, 7.6, 0, null, 1], ...paire(a => paire(b => ['acier', L, 0.2, 0.2, 0, 7.6 + a * 0.75, b * 0.75])).flat(), ['damier', L - 1.5, 0.45, 1.6, 0, 6.95, 0],
        ['acier', 2 * W + 1.4, 1.9, 0.3, 0, 9.4, 0], ['nom', 2 * W + 1, 1.5, 0.4, 0, 9.4, 0],
        ...paire(sz => [['boitier', 6.8, 1, 0.25, 0, 7.6, sz * 0.85], ...[-2, -1, 0, 1, 2].map(i => ['feu', 0.75, 0.75, 0.1, i * 1.3, 7.6, sz * 1.0]),
          ...paire(sx => { const x = sx * (W - 1.2), r = [sz * th, 0, 0]; return [['boitier', 1, 0.5, 0.7, x, 7.9, sz * 1.15, r], ['lampe', 0.85, 0.06, 0.55, x, 7.9 - 0.28 * Math.cos(th), sz * (1.15 - 0.28 * Math.sin(th)), r]]; }).flat()]).flat()];
    },
    portiquePub: W => [['ecran', 2 * W + 3, 4, 0.5, 0, 11.5, 0], ...paire(sd => ['beton', 0.8, 13.5, 0.8, sd * (W + 1.3), 6.75, 0])],
    portiqueAutoroute: W => [['structure', 2 * W + 3, 0.5, 0.5, 0, 10.2, 0], ...paire(sd => ['structure', 0.6, 10.5, 0.6, sd * (W + 1.2), 5.2, 0]), ['panneauGauche', 6.4, 2.6, 0.3, -3.6, 8.4, 0], ['panneauDroit', 6.4, 2.6, 0.3, 3.6, 8.4, 0]],
    pylonePont: W => [...paire(sd => ['beton', 3, 96, 3, sd * (W + 3.5), 2, 0]), ['beton', 2 * W + 10, 3, 3, 0, 46, 0]], // pylône en H d'un pont à haubans
    // touge : le carrefour du sommet. cote = 1 ou -1 : de quel côté de la route il est, la supérette présente ses distributeurs vers la route
    esplanade: () => [['bitume', 40, 0.5, 52, 0, -0.1, 0]], traverse: () => [['bitume', 60, 0.5, 9, 0, -0.1, 0]],
    // supérette : murs de crépi, vitrine sur toute la façade côté route, bandeau d'enseigne, porte, acrotère, groupes froids sur le toit, distributeurs devant
    superette: cote => [['mur', 11, 4.4, 22, 0, 2.2, 0], ['vitrine', 0.2, 3.2, 20, cote * -5.55, 1.75, 0], ['porte', 0.25, 2.4, 2.2, cote * -5.6, 1.2, 4], ['enseigne', 0.3, 1.3, 22.6, cote * -5.75, 5.05, 0], ['toit', 11.4, 0.5, 22.4, 0, 4.65, 0],
      ...[-6, 0, 6].map(z => ['clim', 1.6, 1, 1.4, cote * 2.5, 5.4, z]), ...[13.5, 15.2].map(z => ['distributeur', 1, 2.2, 1.3, cote * -5.8, 1.2, z])],
    station: () => [['acier', 13, 0.7, 18, 0, 5.6, 0], ['lampe', 12.4, 0.12, 17.4, 0, 5.2, 0], ...paire(sd => ['enseigne', 0.2, 0.9, 18.2, sd * 6.6, 6.3, 0]), ...paire(sd => ['enseigne', 13.2, 0.9, 0.2, 0, 6.3, sd * 9.1]), ['acier', 13, 0.2, 18, 0, 6.6, 0], ['ilot', 1.6, 0.25, 10, 0, 0.12, 0],
      ...[[-5, -7], [5, -7], [-5, 7], [5, 7]].map(([x, z]) => ['acier', 0.5, 5.4, 0.5, x, 2.7, z]), ...[-3.5, 3.5].map(z => ['pompe', 1, 1.7, 0.7, 0, 0.95, z])],
    totem: () => [['acier', 0.4, 8, 0.4, 0, 4, 0], ['prix', 0.5, 3.4, 3, 0, 6.6, 0]],
    // voiture garée, origine au sol : caisse, pavillon sur un bandeau vitré, bas de caisse, quatre roues, feux
    voitureGaree: () => [['caisse', 4.3, 0.6, 1.8, 0, 0.66, 0], ['caisse', 2, 0.1, 1.46, -0.35, 1.42, 0], ['vitre', 2.3, 0.46, 1.56, -0.3, 1.15, 0], ['chassis', 4.4, 0.2, 1.7, 0, 0.32, 0], ['feuRouge', 0.08, 0.16, 1.6, -2.17, 0.78, 0], ...[-0.6, 0.6].map(z => ['feuBlanc', 0.08, 0.16, 0.4, 2.17, 0.68, z]), ...roues([1.35, -1.35], 0.8, 0.64, 0.22)],
    barriere: () => [['rayures', 0.25, 0.9, 2.6, 0, 1, 0], ['clignotant', 0.3, 0.3, 0.3, 0, 1.7, 0]],
    // Wan-9 : portique de quai, pieds sur le quai (z > 0), flèche en treillis au-dessus de l'eau, chevalet et tirants, salle des machines, chariot et cabine
    grue: () => [...[-12, 12].flatMap(x => [...[22, 48].map(z => ['structure', 2, 44, 2, x, 22, z]), ['treillis', 1.2, 34, 1.2, x, 22, 35, [0.72, 0, 0]], ['structure', 1.6, 1.4, 30, x, 1.2, 35], ...[24, 46].map(z => ['roue', 1.2, 1.2, 0.6, x, 0.6, z])]),
      ...[22, 48].map(z => ['structure', 26, 2.5, 2.5, 0, 42.5, z]), ...[-3, 3].map(x => ['treillis', 1.6, 3.2, 112, x, 46, 6]), ['structure', 8, 0.6, 112, 0, 44.6, 6],
      ...[-3, 3].flatMap(x => [['structure', 1.2, 22, 1.2, x, 57, 44, [-0.25, 0, 0]], ['tirant', 0.4, 0.4, 66, x, 55, 12, [-0.3, 0, 0]]]), ['machinerie', 10, 5, 14, 0, 50.5, 56],
      ['structure', 7, 1.6, 6, 0, 43.5, -12], ['cabine', 3.2, 3, 3.6, 0, 41, -9], ['vitre', 3.3, 1.4, 3.7, 0, 41.4, -9], ['structure', 2.6, 0.5, 12.2, 0, 30, -12, [0, 1.5708, 0]]],
    // camions de Wan-9 (X vers l'avant, origine au sol au centre de l'attelage) : un tracteur à cabine avancée et une remorque, de 12,6 m en tout comme la boîte de choc de sim.js
    tracteur: () => [['chassis', 5, 0.5, 1.9, 3.7, 1, 0], ['cabine', 2.3, 2.5, 2.45, 5, 2.65, 0], ['cabine', 1.7, 0.7, 2.3, 4.7, 4.15, 0, [0, 0, 0.3]], ['vitre', 0.1, 1.05, 2.2, 6.17, 3.2, 0], ['vitre', 1.1, 0.8, 2.5, 5.45, 3.25, 0],
      ['calandre', 0.1, 0.8, 1.7, 6.17, 2, 0], ['chassis', 0.3, 0.45, 2.45, 6.1, 1.15, 0], ['chassis', 0.6, 0.15, 2.3, 2.2, 1.35, 0], ...paire(sd => ['phare', 0.1, 0.3, 0.45, 6.2, 1.5, sd * 0.85]), ['feuOrange', 0.12, 0.12, 1.5, 6.16, 3.97, 0],
      ...paire(sd => ['chassis', 1.4, 0.6, 0.35, 3.2, 1, sd * 1.05]), ...roues([5.3, 2.2, 1], 1)],
    remorqueConteneur: () => [['chassis', 10, 0.35, 1.9, -1.4, 1.25, 0], ['caisse', 9.8, 2.6, 2.45, -1.4, 2.75, 0], ...remorque],
    remorqueCiterne: () => [['chassis', 10, 0.35, 1.9, -1.4, 1.25, 0], ...[0, 0.785].map(a => ['cuve', 9, 2.3, 2.3, -1.6, 2.7, 0, [a, 0, 0]]), ['chassis', 7, 0.12, 0.7, -1.6, 4.1, 0], ['chassis', 0.12, 2.3, 0.5, -6.15, 2.6, 0], ...remorque],
    remorquePlateau: () => [['plateau', 10, 0.35, 2.45, -1.4, 1.45, 0], ['chassis', 0.2, 1.6, 2.4, 3.45, 2.4, 0], ...[-4.6, -1.8, 1].flatMap(x => [['bobine', 1.7, 1.7, 1.5, x, 2.5, 0], ['bobine', 1.7, 1.7, 1.5, x, 2.5, 0, [0, 0, 0.785]], ['sangle', 0.15, 2.4, 2.5, x, 2.55, 0]]), ...remorque],
    // navires : origine à la ligne de flottaison, au milieu, proue vers +X. type 'conteneurs' ou 'vrac' (vraquier : pont de cales, grues de bord)
    navire: (L, type, baies = []) => [['carene', L, 4, 26, 0, -1.5, 0], ['coque', L, 10, 26, 0, 5.5, 0], ['carene', 18.4, 4, 18.4, L / 2, -1.5, 0, [0, 0.785, 0]], ['coque', 18.4, 10, 18.4, L / 2, 5.5, 0, [0, 0.785, 0]],
      ['blanc', 14, 22, 24, -L / 2 + 14, 21.5, 0], ['hublots', 14.4, 15, 24.4, -L / 2 + 14, 24, 0], ['blanc', 5, 1.4, 36, -L / 2 + 19, 32, 0], ['cheminee', 7, 9, 6, -L / 2 + 5, 36, 0], ['blanc', 1, 12, 1, L / 2 - 6, 16.5, 0],
      ...(type === 'ferry' ? [['blanc', L - 50, 14, 24, -5, 17.5, 0], ['hublots', L - 52, 3, 24.4, -5, 13, 0], ['hublots', L - 60, 3, 24.4, -8, 18.5, 0], ['hublots', L - 70, 3, 24.4, -12, 23, 0]]
        : type === 'vrac' ? Array.from({ length: Math.floor((L - 50) / 24) }, (_, k) => [['cale', 16, 2, 18, -L / 2 + 36 + k * 24, 11.5, 0], ...(k % 2 ? [] : [['grueBord', 1.5, 16, 1.5, -L / 2 + 47 + k * 24, 18.5, 0], ['grueBord', 1, 1, 22, -L / 2 + 47 + k * 24, 22, 4, [-0.5, 0, 0]]])]).flat()
        : baies.map((n, k) => ['cargaison', 22, 2.6 * n, 24, -L / 2 + 34 + k * 24, 10.5 + 1.3 * n, 0]))],
    remorqueur: () => [['carene', 28, 3, 10, 0, -1, 0], ['coque', 28, 3.5, 10, 0, 2.2, 0], ['coque', 7, 3.5, 7, 14, 2.2, 0, [0, 0.785, 0]], ['defense', 30, 1, 10.6, 0, 1.2, 0], ['blanc', 10, 3.5, 7, 2, 5.7, 0], ['blanc', 5, 2.4, 6.4, 3.5, 8.6, 0], ['vitre', 5.2, 1, 6.6, 3.5, 8.9, 0], ['blanc', 0.6, 6, 0.6, 1, 12, 0], ['cheminee', 1.6, 3, 1.4, -2, 8.5, 0]],
    // engins de parc : cavalier (enjambe une file de conteneurs, X le long des conteneurs) et portique sur pneus (enjambe une travée, Z en travers des files)
    cavalier: () => [...paire(sd => [...paire(sx => ['structure', 0.8, 13, 0.8, sx * 6, 7.1, sd * 2.4]), ['structure', 14, 1.2, 0.8, 0, 13.8, sd * 2.4], ['structure', 14, 0.9, 0.7, 0, 1.4, sd * 2.4], ...[-6, -2, 2, 6].map(x => ['roue', 1.2, 1.2, 0.5, x, 0.6, sd * 2.4])]).flat(),
      ...paire(sx => ['structure', 0.8, 1.2, 5.6, sx * 6, 13.8, 0]), ['structure', 3, 1.6, 1.2, -2, 15.2, 0], ['cabine', 1.8, 2, 1.8, 6.4, 12.4, 2.5], ['vitre', 1.9, 1, 1.9, 6.4, 12.7, 2.5]],
    grueParc: s => [...paire(sx => [...paire(sz => ['structure', 1.4, 21, 1.4, sx * s / 2, 11.5, sz * 7]), ['structure', 1.4, 1.2, 16, sx * s / 2, 1.2, 0], ['structure', 1.6, 2, 15.6, sx * s / 2, 22.5, 0], ...paire(sz => ['roue', 1.2, 1.2, 0.6, sx * s / 2, 0.6, sz * 7])]).flat(),
      ...paire(sz => ['structure', s + 3, 2, 1.4, 0, 22.5, sz * 7]), ['structure', 4.5, 2.2, 16, 4, 24.6, 0], ['cabine', 2.2, 2.2, 2, 4, 20.6, 6], ['vitre', 2.3, 1, 2.1, 4, 20.9, 6], ['structure', 2.6, 0.5, 12.2, 4, 15, 0], ['machinerie', 3, 3, 5, -s / 2 - 2.6, 4, 0]],
    // mât d'éclairage de 35 m à couronne de projecteurs
    matEclairage: () => [['acier', 0.9, 35, 0.9, 0, 17.5, 0], ['acier', 5, 0.4, 5, 0, 35, 0], ...paire(sx => paire(sz => ['lampe', 1.3, 0.5, 1.3, sx * 1.8, 34.6, sz * 1.8])).flat()],
    // tunnel immergé de Wan-9, posé dans le repère de la route au portail (X en travers, Z vers l'arrière : le conducteur arrive par +Z) ; s'emboîte derrière le portail lumineux de game.js
    teteTunnel: W => [...paire(sd => ['beton', 16, 17, 5, sd * (W + 9.5), 8.5, -4]), ['beton', 2 * W + 4, 8.5, 5, 0, 12.75, -4], ['corniche', 2 * W + 38, 1, 6.5, 0, 17.5, -4], ['nom', 2 * W - 1, 2.6, 0.3, 0, 15, -1.4],
      ['feux', 2 * W - 3, 1.2, 0.3, 0, 12.7, -1.4],
      ['limite', 2 * W + 2, 0.7, 0.4, 0, 6.1, 26], ...paire(sd => ['structure', 0.4, 6.5, 0.4, sd * (W + 1), 3.25, 26]), ['panneau', 3, 3, 0.2, 0, 8.3, 26]],
    // tour de ventilation du tunnel : fût à persiennes, salle des ventilateurs, deux cheminées
    tourVentilation: (h = 30) => [['persiennes', 14, h, 11, 0, h / 2, 0], ['beton', 15, 1.2, 12, 0, h + 0.6, 0], ['persiennes', 10, 8, 8, 0, h + 5.2, 0], ...[-2.5, 2.5].map(x => ['beton', 2.4, 6, 2.4, x, h + 12, 0]), ['beton', 20, 6, 15, 4, 3, 2]],
    ileVentilation: () => [['quai', 64, 6, 40, 0, -3, 0], ['quai', 40, 6, 40, 0, -3, 0, [0, 0.785, 0]], ['defense', 66, 1, 42, 0, -0.2, 0]],
    // grande roue : rotor (jante double, rayons, moyeu), à faire tourner autour de Z ; support en A posé au sol, moyeu à H mètres
    roueRotor: R => [...Array.from({ length: 48 }, (_, k) => { const a = (k + 0.5) / 48 * 6.2832; return paire(z => ['jante', 1.1, 2 * R * Math.sin(Math.PI / 48) + 0.4, 1.1, Math.cos(a) * R, Math.sin(a) * R, z * 3.5, [0, 0, a]]); }).flat(),
      ...Array.from({ length: 16 }, (_, k) => { const a = k / 16 * 6.2832; return [...paire(z => ['rayon', 0.35, R, 0.35, Math.cos(a) * R / 2, Math.sin(a) * R / 2, z * 3.5, [0, 0, a - Math.PI / 2]]), ['jante', 0.6, 0.6, 7, Math.cos(a) * R, Math.sin(a) * R, 0]]; }).flat(),
      ['moyeu', 5, 5, 10, 0, 0, 0]],
    roueSupport: H => { const a = Math.atan(H * 0.4 / H), l = Math.hypot(H, H * 0.4); return [...paire(sd => paire(z => ['acier', 1.6, l, 1.6, sd * H * 0.2, -H / 2, z * 10, [0, 0, sd * a]])).flat(), ...paire(z => ['acier', H * 0.45, 1, 1, 0, -H * 0.55, z * 10]), ['acier', 1.6, 1.6, 22, 0, 0, 0], ['socle', 50, 5, 30, 0, -H + 2.5, 0]]; },
    nacelle: () => B(2.4, 2.6, 2.4), berme: () => B(30, 1, 8.4, 4), bouee: () => B(1.4, 2.6, 1.4),
    // Paris
    arche: () => [...[-14, 14].map(x => ['pierre', 12, 36, 16, x, 18, 0]), ['pierre', 40, 14, 16, 0, 43, 0]],
    basilique: () => [['craie', 40, 24, 30, 0, 12, 0], ['craie', 9, 46, 9, 0, 23, -22]], // nef et campanile ; les dômes sont des formes simples posées dessus
    // canal
    panneauPub: angle => [['mat', 1, 24, 1, 0, 12, 0], ['affiche', 1, 8, 16, 0, 22, 0, [0, angle, 0]]],
    pontCanal: () => [['beton', 16, 3, 640, 0, 17.5, 0, null, 1], ...[-8.5, 8.5].map(x => ['beton', 1, 2, 640, x, 20, 0]), // tablier, garde-corps, puis arcs en V au-dessus
      ...[-170, 0, 170].flatMap(z => [-0.42, 0.42].map(a => ['beton', 2, 3, 96, 0, 30, z + (a > 0 ? 42 : -42), [a, 0, 0]]))],
    // wagon couvert, origine au rail : caisse, châssis, deux bogies à deux essieux, tampons, attelages
    wagonCouvert: () => [['caisse', 17, 3.6, 3.1, 0, 3, 0], ['toit', 17.2, 0.25, 3.3, 0, 4.9, 0], ['chassis', 17.6, 0.5, 2.6, 0, 1.05, 0], ...[-6, 6].flatMap(x => [['chassis', 3, 0.5, 2.2, x, 0.6, 0], ...roues([x - 1, x + 1], 0.8, 0.9, 0.2)]), ...paire(sx => paire(z => ['chassis', 0.4, 0.35, 0.35, sx * 9, 1.05, z * 0.8])).flat()],
    // palmier : une couronne de huit palmes qui retombent, origine en haut du tronc
    palmes: () => Array.from({ length: 8 }, (_, k) => { const a = k / 8 * 6.2832; return ['palme', 5.5, 0.15, 1, Math.cos(a) * 2.4, -0.6, Math.sin(a) * 2.4, [0, -a, -0.45 - (k % 2) * 0.2]]; }),
    pompeSocle: () => [['fer', 7, 0.8, 2.4, 0, 0.4, 0], ...[-0.3, 0.3].map(a => ['fer', 0.5, 7.4, 0.5, a * 4, 4, 0, [0, 0, a]])],
    pompeBalancier: () => [['minium', 9, 0.7, 0.7, 0.6, 0, 0], ['minium', 1.4, 2.4, 1, 5.2, -0.6, 0], ['fer', 1.6, 1.6, 1.6, -4, -0.4, 0]], // tourne autour de son origine
    chateauEau: () => [...[[-4, -4], [4, -4], [-4, 4], [4, 4]].map(([x, z]) => ['fer', 0.8, 26, 0.8, x, 13, z]), ['cuve', 13, 9, 13, 0, 30, 0], ['fer', 14, 1, 14, 0, 35, 0]],
  };
})();
