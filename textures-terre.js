// Textures propres à « terre » (Spéciale des Ocres) : complète le catalogue de textures.js, mêmes conventions. Voir METHODE-DECOR.md.
(() => {
  const texte = (g, txt, x, y, px, col, larg = Infinity) => { g.fillStyle = col; g.font = 'bold ' + px + 'px sans-serif'; const w = g.measureText(txt).width; if (w > larg) g.font = 'bold ' + (px * larg / w).toFixed(1) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, x, y); }; // larg : le texte rétrécit pour tenir dans cette largeur (la police varie d'un système à l'autre)
  Object.assign(TEXTURES, {
    // sol de la garrigue : terre d'ocre, cailloux clairs, plaques plus rouges, touffes d'herbe sèche et de thym
    terreOcre: () => [64, 64, (g, o) => {
      const { R, alea, voile } = o; R(g, '#b0703c', 0, 0, 64, 64);
      voile(g, 0.35, () => { for (let i = 0; i < 9; i++) R(g, alea() < 0.5 ? '#c8562a' : '#d09a50', alea() * 56 | 0, alea() * 56 | 0, 6 + (alea() * 12 | 0), 5 + (alea() * 10 | 0)); });
      for (let i = 0; i < 380; i++) R(g, alea() < 0.5 ? '#9a5c30' : '#c08248', alea() * 64 | 0, alea() * 64 | 0, 1 + (alea() * 2 | 0), 1);
      for (let i = 0; i < 40; i++) R(g, '#e0c090', alea() * 64 | 0, alea() * 64 | 0, 1, 1);
      for (let i = 0; i < 46; i++) { const x = alea() * 62 | 0, y = alea() * 62 | 0; R(g, alea() < 0.6 ? '#8a8440' : '#5e7038', x, y, 2, 2); R(g, '#a89a50', x + 1, y - 1, 1, 1); }
    }],
    // falaise d'ocre : strates horizontales du rouge sang au jaune, ravines verticales, éboulis au pied ; le haut de la texture est le haut de la butte, coiffé de garrigue
    falaiseOcre: () => [64, 64, (g, o) => {
      const { R, alea, voile } = o, B = [['#6a7038', 4], ['#e8c070', 6], ['#e09848', 9], ['#d8702c', 8], ['#c84a20', 10], ['#e08a3c', 7], ['#b83c1c', 9], ['#c8683a', 11]]; let y = 0;
      for (const [c, hh] of B) { R(g, c, 0, y, 64, hh); for (let x = 0; x < 64; x += 2) if (alea() < 0.5) R(g, c, x, y - 1 - (alea() * 2 | 0), 2, 3); y += hh; }
      voile(g, 0.22, () => { for (let i = 0; i < 26; i++) R(g, alea() < 0.7 ? '#000' : '#fff', alea() * 64 | 0, 4 + (alea() * 30 | 0), 1 + (alea() * 2 | 0), 10 + (alea() * 30 | 0)); });
      for (let i = 0; i < 150; i++) R(g, alea() < 0.5 ? '#a04a24' : '#e0a060', alea() * 64 | 0, 4 + alea() * 60 | 0, 2, 1);
    }],
    // botte de paille : brins dorés, deux ficelles
    paille: () => [32, 32, (g, o) => {
      const { R, alea } = o; R(g, '#d8b050', 0, 0, 32, 32);
      for (let i = 0; i < 200; i++) R(g, alea() < 0.5 ? '#c09838' : '#ecd078', alea() * 32 | 0, alea() * 32 | 0, 1, 2 + (alea() * 4 | 0));
      for (const x of [9, 22]) R(g, '#7a5a28', x, 0, 1, 32);
    }],
    // toit de tuiles canal : rangs de 50 cm, tuiles de teintes inégales, mousse par endroits
    tuilesCanal: () => [64, 64, (g, o) => {
      const { R, alea, voile } = o; R(g, '#c8643a', 0, 0, 64, 64);
      for (let y = 0; y < 64; y += 4) for (let x = 0; x < 64; x += 4) { R(g, ['#c8643a', '#b85530', '#d87a48', '#a84a2a', '#d08a58'][alea() * 5 | 0], x, y, 3, 4); R(g, '#7a3418', x + 3, y, 1, 4); }
      voile(g, 0.3, () => { for (let y = 3; y < 64; y += 4) R(g, '#000', 0, y, 64, 1); for (let i = 0; i < 8; i++) R(g, '#4a5a2a', alea() * 60 | 0, alea() * 60 | 0, 3 + (alea() * 4 | 0), 2); });
    }, 4],
    // eau du gué : un ruisseau peu profond sur la terre, brun vert, assez sombre pour se lire sur la piste ocre ; rides claires en travers du courant, reflets du ciel, quelques galets qui affleurent
    eauGue: () => [64, 64, (g, o) => {
      const { R, alea, voile } = o; R(g, '#5e5a3c', 0, 0, 64, 64);
      voile(g, 0.5, () => { for (let i = 0; i < 70; i++) R(g, alea() < 0.5 ? '#76683e' : '#46482e', alea() * 64 | 0, alea() * 64 | 0, 6 + (alea() * 14 | 0), 2 + (alea() * 3 | 0)); });
      for (let i = 0; i < 90; i++) R(g, alea() < 0.6 ? '#7e8a74' : '#a8b4a0', alea() * 64 | 0, alea() * 64 | 0, 3 + (alea() * 8 | 0), 1); // rides
      for (let i = 0; i < 22; i++) R(g, '#dce4e8', alea() * 64 | 0, alea() * 64 | 0, 2 + (alea() * 5 | 0), 1); // reflets du ciel sur la crête des rides
      for (let i = 0; i < 6; i++) { const x = alea() * 60 | 0, y = alea() * 60 | 0; R(g, '#8a7a5a', x, y, 3, 2); R(g, '#c8d0cc', x, y - 1, 3, 1); } // galets, et l'eau qui se brise dessus
    }, 6],
    // écume de la ligne d'eau : liserés blancs déchirés sur fond transparent, plus denses au milieu de la texture (là où l'eau touche la terre)
    ecume: () => [64, 16, (g, o) => {
      const { R, alea } = o;
      for (let i = 0; i < 160; i++) { const y = 8 + (alea() + alea() + alea() - 1.5) * 6 | 0; R(g, alea() < 0.7 ? 'rgba(240,244,240,0.85)' : 'rgba(200,190,160,0.7)', alea() * 64 | 0, y, 2 + (alea() * 6 | 0), 1); }
    }, 4],
    // terre mouillée aux abords du gué : boue sombre, flaques et ornières pleines d'eau ; transparente aux deux bouts (haut et bas de la texture) pour se fondre dans la piste sèche
    boueGue: () => [64, 64, (g, o) => {
      const { R, alea } = o;
      for (let y = 0; y < 64; y++) { const a = Math.min(1, Math.min(y, 63 - y) / 14); R(g, `rgba(74,52,32,${(0.75 * a).toFixed(2)})`, 0, y, 64, 1);
        for (let i = 0; i < 5; i++) if (alea() < a) R(g, alea() < 0.5 ? `rgba(60,58,44,${a.toFixed(2)})` : `rgba(110,82,52,${(0.8 * a).toFixed(2)})`, alea() * 64 | 0, y, 2 + (alea() * 6 | 0), 1); }
      for (const x of [17, 26, 36, 45]) for (let y = 10; y < 54; y += 2) if (alea() < 0.7) R(g, 'rgba(70,84,72,0.85)', x - 1 + (alea() * 3 | 0), y, 3, 2); // les ornières, pleines d'eau
    }],
    // terre de la piste hors de la bande centrale (parties larges) : même terre battue que la chaussée, damée et sans ornières ; le bord intérieur (gauche de la texture) est transparent, pour se fondre sur la bordure de la chaussée
    terrePiste: () => [64, 32, (g, o) => {
      const { R, alea } = o;
      for (let x = 0; x < 64; x++) { const a = Math.min(1, x / 16); R(g, `rgba(168,106,58,${a.toFixed(2)})`, x, 0, 1, 32); for (let i = 0; i < 6; i++) if (alea() < a) R(g, ['#8a5228', '#b87a48', '#96602f', '#c89058'][alea() * 4 | 0], x, alea() * 32 | 0, 1, 1); }
    }],
    // talus de terre qui borde la piste : terre plus sombre et tassée côté route (bas de la texture), herbe sèche, cailloux et thym vers le haut ; les pneus l'ont rayé par endroits
    talusPiste: () => [64, 32, (g, o) => {
      const { R, alea, voile } = o; R(g, '#8e5a30', 0, 0, 64, 32);
      for (let i = 0; i < 260; i++) R(g, alea() < 0.5 ? '#7a4c26' : '#a8703e', alea() * 64 | 0, alea() * 32 | 0, 1 + (alea() * 2 | 0), 1);
      for (let i = 0; i < 70; i++) { const y = alea() * alea() * 16 | 0; R(g, alea() < 0.6 ? '#8a8440' : '#5e7038', alea() * 62 | 0, y, 2, 2); } // l'herbe sèche, en haut
      for (let i = 0; i < 30; i++) R(g, '#d8c09a', alea() * 64 | 0, 8 + alea() * 24 | 0, 1, 1); // cailloux
      voile(g, 0.25, () => { for (let i = 0; i < 6; i++) R(g, '#000', alea() * 56 | 0, 18 + alea() * 12 | 0, 8 + (alea() * 10 | 0), 1); }); // raies des pneus
    }],
    // rang de lavande : touffes violettes serrées, quelques tiges vertes, la terre entre les pieds
    lavande: () => [16, 16, (g, o) => {
      const { R, alea } = o; R(g, '#7a58b8', 0, 0, 16, 16);
      for (let i = 0; i < 60; i++) R(g, ['#9a78d8', '#6a48a0', '#b090e0', '#5a7a48'][alea() * 4 | 0], alea() * 16 | 0, alea() * 16 | 0, 1, 1 + (alea() * 2 | 0));
      for (let x = 0; x < 16; x += 4) R(g, '#8a5a34', x, 14, 1, 2);
    }],
    // banderoles de la spéciale : deux annonceurs inventés par texture, k = le premier
    banderoleRallye: k => [192, 20, (g, o) => {
      const l = [['RALLYE DES OCRES', '#e8482a', '#f4f0e0'], ['HUILES MISTRAL', '#f4c020', '#1c2a5a'], ['PNEUS CIGALE', '#1c2a5a', '#f4f0e0'], ['RADIO CAILLOU 88.8', '#f4f0e0', '#e8482a'], ['GARRIGUE SPORT', '#2a62c8', '#f4c020'], ['SIROPS DU VALLON', '#3a7a3a', '#f4f0e0']];
      for (let j = 0; j < 2; j++) { const [t, f, c] = l[(k + j) % l.length], x = j * 96; o.R(g, f, x, 0, 96, 20); o.R(g, '#08080c', x, 0, 1, 20); texte(g, t, x + 48, 10.5, 10, c, 88); } // 4 px de marge de chaque côté : un nom long (RADIO CAILLOU 88.8) ne déborde plus sur l'annonceur voisin
    }],
  });
  // la piste en terre : th.route[7] = 'terre' repeint la chaussée commune en terre battue (ni rapiéçages, ni joints, ni bordures en damier).
  // Le dessin commun passe d'abord : il tire rnd autant de fois qu'avant, le décor ne bouge pas ; la terre est peinte avec alea, par-dessus
  const chaussee = TEXTURES.chaussee;
  TEXTURES.chaussee = (...a) => {
    const t = chaussee(...a); if (a[7] !== 'terre') return t;
    const [asph, spk, edge, dash, k1, k2] = a, d = t[2];
    t[2] = (g, o) => {
      d(g, o); const { R, alea, voile } = o, px = n => alea() * n | 0;
      R(g, asph, 0, 0, 64, 256);
      for (let i = 0; i < 1400; i++) R(g, spk, px(64), px(256), 1, 1);
      voile(g, 0.25, () => { for (let i = 0; i < 700; i++) R(g, alea() < 0.6 ? '#000' : '#fff', px(64), px(256), 1, 1); });
      voile(g, 0.16, () => { for (const x of [17, 26, 36, 45]) for (let y = 0; y < 256; y += 2) R(g, '#000', x - 2 + px(3), y, 4, 2); }); // ornières
      for (let i = 0; i < 600; i++) R(g, [edge, k1, k2][px(3)], alea() < 0.5 ? px(9) : 55 + px(9), px(256), 1 + px(2), 1 + px(3)); // bas-côtés fondus dans la terre
      for (let i = 0; i < 220; i++) R(g, dash, 27 + px(10), px(256), 1, 1); // gravier chassé sur le bombé
    };
    return t;
  };
})();
