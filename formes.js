// Catalogue des formes : la géométrie de chaque objet du décor, et rien d'autre (ni texture, ni emplacement). Mètres, origine au pied de l'objet.
// Deux sortes d'entrées, toutes des fonctions de leurs réglages :
//   forme simple — renvoie une géométrie three, posée telle quelle ou en nombre (inst)
//   assemblage   — renvoie une liste de boîtes [zone, largeur, hauteur, profondeur, x, y, z, rotation [rx, ry, rz], porte une ombre] ;
//                  la zone nomme la partie, pour que le placement lui donne sa texture : pose('station', { acier: …, lampe: … }, parent, [x, y, z])
// Les textures sont dans textures.js. La piste elle-même (chaussée, murs, tunnel) est un ruban généré le long du tracé dans game.js, et la voiture y reste aussi.
(function () {
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const paire = f => [-1, 1].map(f); // une pièce de chaque côté
  window.FORMES = {
    // ---------- formes simples ----------
    boite: B,                                   // pièce unique aux dimensions libres : dalle d'eau, tour lointaine, pile de pont
    bloc: () => B(1, 1, 1),                     // cube unité, mis à l'échelle par instance : immeubles, tours, entrepôts
    immeuble: (w, H, d) => {                    // tour de la ville : la texture de fenêtres se répète tous les 28 m
      const g = B(w, H, d), uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(w / 28)), uv.getY(i) * Math.max(1, Math.round(H / 28)));
      return g;
    },
    // piste
    luminaireTunnel: () => B(1.8, 0.25, 3.2), boitierSecours: () => B(0.12, 0.7, 1.4),
    chevron: () => new THREE.PlaneGeometry(5, 2.5), pileViaduc: () => B(5, 1, 5), tubeNeon: () => B(0.35, 7, 0.35), refletTube: () => new THREE.PlaneGeometry(7, 1.6),
    faisceau: () => { const g = new THREE.PlaneGeometry(26, 900); g.translate(0, 450, 0); return g; }, hologramme: () => new THREE.PlaneGeometry(90, 45),
    // mobilier de route
    matLampadaire: () => B(0.3, 10, 0.3), teteLampadaire: (l = 3.2) => B(l, 0.25, 0.7), reverbere: () => B(0.25, 7, 0.25), lanterne: () => B(0.7, 0.8, 0.7),
    catadioptre: () => B(0.18, 0.3, 0.18), cone: () => B(0.4, 0.7, 0.4), balise: () => B(0.5, 6.2, 0.5), murFresque: () => new THREE.PlaneGeometry(15.8, 5),
    // végétation
    cedre: () => new THREE.ConeGeometry(3.6, 15, 5), tronc: () => B(0.5, 5.2, 0.5), houppier: () => new THREE.IcosahedronGeometry(3.4, 0),
    troncPalmier: () => B(0.55, 1, 0.55), palme: () => new THREE.IcosahedronGeometry(4, 0),
    // véhicules et fret
    auto: () => B(4.1, 1.3, 1.75), conteneur: () => B(12, 2.6, 2.5), wagon: () => B(17, 4.2, 3.2),
    remorque: () => B(8, 3.1, 2.5), cabine: () => B(2.2, 2.6, 2.4), feuxCamion: () => B(0.15, 0.5, 2.3),
    // grands repères
    pyloneHT: () => B(1.6, 48, 1.6), brasHT: () => B(1, 1, 16), dome: (r, seg, ann) => new THREE.SphereGeometry(r, seg, ann, 0, 6.283, 0, 1.6),

    // ---------- assemblages ----------
    // piste (W = demi-largeur de chaussée)
    portailTunnel: W => [['portail', 2 * W + 6, 4, 3, 0, 10, 0], ...paire(sd => ['portail', 3, 12, 3, sd * (W + 1.5), 6, 0])],
    depart: W => [['damier', 2 * W, 0.06, 4, 0, 0, 0], ['traverse', 2 * W + 3, 1.6, 1, 0, 8, 0], ...paire(sd => ['poteau', 1, 8, 1, sd * (W + 1), 4, 0])],
    portiquePub: W => [['ecran', 2 * W + 3, 4, 0.5, 0, 11.5, 0], ...paire(sd => ['beton', 0.8, 13.5, 0.8, sd * (W + 1.3), 6.75, 0])],
    portiqueAutoroute: W => [['structure', 2 * W + 3, 0.5, 0.5, 0, 10.2, 0], ...paire(sd => ['structure', 0.6, 10.5, 0.6, sd * (W + 1.2), 5.2, 0]), ['panneauGauche', 6.4, 2.6, 0.3, -3.6, 8.4, 0], ['panneauDroit', 6.4, 2.6, 0.3, 3.6, 8.4, 0]],
    pylonePont: W => [...paire(sd => ['beton', 3, 96, 3, sd * (W + 3.5), 2, 0]), ['beton', 2 * W + 10, 3, 3, 0, 46, 0]], // pylône en H d'un pont à haubans
    // touge : le carrefour du sommet. cote = 1 ou -1 : de quel côté de la route il est, la supérette présente ses distributeurs vers la route
    esplanade: () => [['bitume', 40, 0.5, 52, 0, -0.1, 0]], traverse: () => [['bitume', 60, 0.5, 9, 0, -0.1, 0]],
    superette: cote => [['vitrine', 11, 4.4, 22, 0, 2.3, 0], ['enseigne', 11.6, 1.3, 22.6, 0, 5.1, 0], ...[13.5, 15.2].map(z => ['distributeur', 1, 2.2, 1.3, cote * -5.8, 1.2, z])],
    station: () => [['acier', 13, 0.7, 18, 0, 5.6, 0], ['lampe', 12.4, 0.12, 17.4, 0, 5.2, 0], ['enseigne', 13.2, 0.9, 18.2, 0, 6.3, 0],
      ...[[-5, -7], [5, -7], [-5, 7], [5, 7]].map(([x, z]) => ['acier', 0.5, 5.4, 0.5, x, 2.7, z]), ...[-3.5, 3.5].map(z => ['pompe', 1, 1.7, 0.7, 0, 0.95, z])],
    totem: () => [['acier', 0.4, 8, 0.4, 0, 4, 0], ['prix', 0.5, 3.4, 3, 0, 6.6, 0]],
    voitureGaree: () => [['caisse', 4.3, 0.62, 1.8, 0, 0.5, 0], ['vitre', 2, 0.48, 1.5, -0.3, 1.05, 0], ['feuRouge', 0.08, 0.16, 1.6, -2.17, 0.62, 0], ...[-0.6, 0.6].map(z => ['feuBlanc', 0.08, 0.16, 0.4, 2.17, 0.5, z])],
    barriere: () => [['rayures', 0.25, 0.9, 2.6, 0, 1, 0], ['clignotant', 0.3, 0.3, 0.3, 0, 1.7, 0]],
    // Wan-9 : portique de quai, pieds sur le quai (z > 0), flèche au-dessus de l'eau
    grue: () => [...[-12, 12].flatMap(x => [0, 26].map(z => ['structure', 2, 46, 2, x, 22, 22 + z])), ['structure', 4, 4, 96, 0, 46, 12], ['cabine', 8, 6, 8, 0, 51, 34]],
    // Paris
    arche: () => [...[-14, 14].map(x => ['pierre', 12, 36, 16, x, 18, 0]), ['pierre', 40, 14, 16, 0, 43, 0]],
    basilique: () => [['craie', 40, 24, 30, 0, 12, 0], ['craie', 9, 46, 9, 0, 23, -22]], // nef et campanile ; les dômes sont des formes simples posées dessus
    // canal
    panneauPub: angle => [['mat', 1, 24, 1, 0, 12, 0], ['affiche', 1, 8, 16, 0, 22, 0, [0, angle, 0]]],
    pontCanal: () => [['beton', 16, 3, 640, 0, 17.5, 0, null, 1], ...[-8.5, 8.5].map(x => ['beton', 1, 2, 640, x, 20, 0]), // tablier, garde-corps, puis arcs en V au-dessus
      ...[-170, 0, 170].flatMap(z => [-0.42, 0.42].map(a => ['beton', 2, 3, 96, 0, 30, z + (a > 0 ? 42 : -42), [a, 0, 0]]))],
    pompeSocle: () => [['fer', 7, 0.8, 2.4, 0, 0.4, 0], ...[-0.3, 0.3].map(a => ['fer', 0.5, 7.4, 0.5, a * 4, 4, 0, [0, 0, a]])],
    pompeBalancier: () => [['minium', 9, 0.7, 0.7, 0.6, 0, 0], ['minium', 1.4, 2.4, 1, 5.2, -0.6, 0], ['fer', 1.6, 1.6, 1.6, -4, -0.4, 0]], // tourne autour de son origine
    chateauEau: () => [...[[-4, -4], [4, -4], [-4, 4], [4, 4]].map(([x, z]) => ['fer', 0.8, 26, 0.8, x, 13, z]), ['cuve', 13, 9, 13, 0, 30, 0], ['fer', 14, 1, 14, 0, 35, 0]],
  };
})();
