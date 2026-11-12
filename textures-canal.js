// Textures propres à « canal » : complète le catalogue de textures.js (mêmes conventions : aplat pour ce qui émet de la lumière, dessin sinon, hasard par o.alea). Voir METHODE-DECOR.md.
// Le canal est devenu un grand ovale à l'américaine : gradins pleins de monde, loges, grillages, stands, panneaux de classement. Sponsors inventés.
(() => {
  const PEAU = ['#f0c8a0', '#d8a070', '#a86a40', '#6a4028', '#f4d8b8'], MAILLOT = ['#e83f8c', '#ffc04a', '#2aa39a', '#f4f0e0', '#1848c8', '#c8102e', '#ff7a3d', '#1a1420', '#8ad040', '#7a4078'];
  const pick = (a, alea) => a[alea() * a.length | 0];
  const texte = (g, txt, x, y, px, col, align = 'left') => { g.fillStyle = col; g.font = 'bold ' + px + 'px sans-serif'; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(txt, x, y); };
  Object.assign(TEXTURES, {
    // public sur les gradins : un rang tous les 0,75 m de pente (gens un peu plus grands que nature, pour qu'on les lise de la piste) ; un tiers porte la couleur de la tribune. La moitié haute et la moitié basse montrent les mêmes gens,
    // la basse avec des bras levés et des pancartes : décaler la texture d'une demi-hauteur fait bouger la foule sans rien redessiner.
    // Dessinée tête en bas : sur la face du dessus d'une pente, le haut de la texture est au bas des gradins.
    foule: (fond, section) => [128, 128, (g, o) => {
      const { R, alea } = o; g.translate(0, 128); g.scale(1, -1);
      for (const y0 of [0, 64]) { R(g, fond, 0, y0, 128, 64); for (let r = 0; r < 4; r++) { R(g, '#2a2430', 0, y0 + r * 16 + 13, 128, 3); R(g, '#8a8090', 0, y0 + r * 16 + 12, 128, 1); } }
      for (let r = 0; r < 4; r++) for (let x = alea() * 4 | 0; x < 124; x += 8 + (alea() * 3 | 0)) {
        const vide = alea() < 0.1, peau = pick(PEAU, alea), mail = alea() < 0.35 ? section : pick(MAILLOT, alea), cheveux = alea() < 0.5 ? '#1a1410' : pick(['#6a4020', '#e8c060', '#3a2a20', '#f4f0e0'], alea), geste = alea(), sign = pick(MAILLOT, alea);
        for (const y0 of [0, 64]) {
          const y = y0 + r * 16; if (vide) { R(g, '#e83f8c', x + 1, y + 8, 6, 4); continue; } // siège libre
          R(g, mail, x, y + 6, 7, 7); R(g, peau, x + 2, y + 2, 3, 4); R(g, cheveux, x + 2, y + 1, 3, 2);
          if (y0 && geste < 0.4) { R(g, peau, x - 1, y - 1, 1, 6); R(g, peau, x + 7, y - 1, 1, 6); } // bras levés
          else if (y0 && geste < 0.5) R(g, sign, x - 1, y - 3, 9, 5); // pancarte, drapeau
          else if (!y0 && geste > 0.92) R(g, sign, x + 1, y + 7, 5, 2); // écharpe
        }
      }
    }, 6],
    // loges vitrées éclairées : baies de 2 m, montants sombres, silhouettes
    loges: () => [64, 64, (g, o) => {
      const { R, alea } = o; R(g, '#2a2030', 0, 0, 64, 64);
      for (let y = 0; y < 64; y += 32) for (let x = 0; x < 64; x += 16) {
        R(g, alea() < 0.3 ? '#f0b070' : '#ffd890', x + 1, y + 4, 14, 22); R(g, '#fff0c8', x + 1, y + 4, 14, 3);
        for (let k = 0; k < 2; k++) if (alea() < 0.6) { const px = x + 2 + (alea() * 10 | 0); R(g, '#3a2a30', px, y + 14, 3, 12); R(g, '#3a2a30', px, y + 11, 3, 3); }
      }
    }, 8],
    // marches d'escalier : béton clair, nez de marche tous les 0,5 m, bande jaune au bord
    marches: () => [64, 64, (g, o) => {
      const { R, voile } = o; R(g, '#c8c0b4', 0, 0, 64, 64); for (let y = 0; y < 64; y += 4) R(g, '#6a6258', 0, y, 64, 1);
      R(g, '#ffc04a', 0, 0, 2, 64); R(g, '#ffc04a', 62, 0, 2, 64); voile(g, 0.2, () => { for (let i = 0; i < 200; i++) R(g, '#000', o.alea() * 64 | 0, o.alea() * 64 | 0, 1, 1); });
    }, 8],
    // banderole de sponsors (inventés) sur le parapet d'une tribune de 42 m : étirée sur la face, pas de répétition
    banderole: () => [512, 20, (g, o) => {
      const l = [['SOLAR COLA', '#c8102e', '#f4f0e0'], ['DUSK RADIO 94', '#1a1420', '#ffc04a'], ['PALM TIRES', '#f4f0e0', '#1848c8'], ['RANCHO PARTS', '#ffc04a', '#1a1420'], ['CANAL 6', '#e83f8c', '#f4f0e0'], ['NITRO TACO', '#2aa39a', '#f4f0e0']];
      let x = 0; for (const [t, f, c] of l) { const w = 512 / l.length; o.R(g, f, x, 0, w, 20); o.R(g, '#08080c', x, 0, 1, 20); texte(g, t, x + w / 2, 10.5, 13, c, 'center'); x += w; }
    }],
    // grillage de protection : mailles en losange de 0,5 m, câbles et lisses ; fond transparent (matière en alphaTest)
    grillage: () => [32, 32, (g, o) => {
      for (let i = 0; i < 32; i++) for (let k = 0; k < 32; k += 4) { o.R(g, '#c8ccd4', (i + k) % 32, i, 1, 1); o.R(g, '#a8acb4', (k - i + 64) % 32, i, 1, 1); }
      o.R(g, '#e0e4ea', 0, 0, 2, 32); o.R(g, '#9a9ea8', 30, 0, 2, 32); o.R(g, '#9a9ea8', 15, 0, 1, 32);
    }],
    // gazon tondu en bandes de 5 m (le terrain répète sa texture tous les 10 m)
    gazon: () => [64, 64, (g, o) => {
      const { R, alea } = o; R(g, '#55702e', 0, 0, 64, 32); R(g, '#4a6428', 0, 32, 64, 32); // bandes le long des lignes droites (u suit x)
      for (let i = 0; i < 420; i++) R(g, pick(['#62803a', '#3e5622', '#6a8640', '#46602a'], alea), alea() * 64 | 0, alea() * 64 | 0, 1, 1 + (alea() * 2 | 0));
    }],
    // parking : bitume, places de 2,5 m tracées en blanc, allée au milieu
    parking: () => [64, 64, (g, o) => {
      const { R, alea } = o; R(g, '#2a2a2e', 0, 0, 64, 64); for (let i = 0; i < 300; i++) R(g, alea() < 0.5 ? '#343438' : '#222226', alea() * 64 | 0, alea() * 64 | 0, 1, 1);
      for (let x = 0; x < 64; x += 20) { R(g, '#d8d4c8', x, 0, 1, 22); R(g, '#d8d4c8', x, 42, 1, 22); } R(g, '#d8d4c8', 0, 22, 64, 1); R(g, '#d8d4c8', 0, 41, 64, 1);
    }, 8],
    // garage des stands, rideau levé : atelier éclairé, servantes rouges, pneus empilés, voiture bâchée
    garageOuvert: () => [64, 32, (g, o) => {
      const { R } = o; R(g, '#e8ecf0', 0, 0, 64, 32); R(g, '#b8bcc4', 0, 24, 64, 8); R(g, '#3a3a40', 0, 0, 64, 3);
      for (const x of [2, 54]) { R(g, '#c8102e', x, 12, 8, 12); R(g, '#801018', x, 16, 8, 1); R(g, '#801018', x, 20, 8, 1); }
      for (const y of [14, 18, 22]) R(g, '#1a1a1e', 13, y, 6, 3); R(g, '#1848c8', 22, 17, 24, 7); R(g, '#102a80', 26, 14, 14, 4); R(g, '#1a1a1e', 24, 22, 4, 3); R(g, '#1a1a1e', 40, 22, 4, 3);
    }],
    // écran géant du classement, lisible des deux lignes droites
    classement: () => [256, 160, (g, o) => {
      const { R } = o; R(g, '#08080c', 0, 0, 256, 160); R(g, '#e83f8c', 0, 0, 256, 26); texte(g, 'CANAL 6 SPEEDWAY', 128, 14, 18, '#f4f0e0', 'center');
      [['1', 'DRE', '—', '#ffc04a'], ['2', 'ROSA', '+0.41', '#f4f0e0'], ['3', 'VOUS', '+1.07', '#2aa39a'], ['4', 'CAL', '+2.88', '#f4f0e0']].forEach(([p, n, e, c], k) => {
        const y = 46 + k * 30; R(g, k & 1 ? '#14121a' : '#1c1a24', 4, y - 13, 248, 27); texte(g, p, 14, y, 22, '#ff7a3d'); texte(g, n, 46, y, 22, c); texte(g, e, 246, y, 18, '#c8c0b4', 'right');
      });
    }],
    // pylône des positions : numéros des voitures empilés, du premier en haut
    pyloneChrono: () => [32, 256, (g, o) => {
      const { R } = o; R(g, '#08080c', 0, 0, 32, 256); R(g, '#ffc04a', 0, 0, 32, 20); texte(g, 'P', 16, 11, 16, '#08080c', 'center');
      ['7', '23', '6', '41', '12', '88', '3', '19', '55', '9'].forEach((n, k) => { const y = 34 + k * 22; R(g, MAILLOT[k % MAILLOT.length], 2, y - 9, 4, 18); texte(g, n, 19, y, 16, '#f4f0e0', 'center'); });
    }],
    // camping-car : caisse blanche, baies teintées, porte, liseré
    campingCar: () => [64, 32, (g, o) => {
      const { R } = o; R(g, '#ece8e0', 0, 0, 64, 32); R(g, '#2a2830', 8, 8, 18, 8); R(g, '#2a2830', 34, 8, 10, 8); R(g, '#c8c0b4', 48, 8, 7, 18); R(g, '#8a8478', 0, 28, 64, 4);
      o.voile(g, 0.25, () => { for (let i = 0; i < 80; i++) R(g, '#000', o.alea() * 64 | 0, o.alea() * 32 | 0, 1, 1); });
    }],
  });
})();
