// Formes propres à « paris » : complète le catalogue de formes.js (mêmes conventions : forme simple = géométrie, assemblage = liste de boîtes à zones). Voir METHODE-DECOR.md.
(function () {
  const paire = f => [-1, 1].map(f);
  Object.assign(FORMES, {
    // bord d'un îlot rond : cylindre ouvert de rayon r et de hauteur hh, la texture répétée tous les 8 m (la tuile de la pierre)
    cylindreOuvert: (r, hh, n) => { const g = new THREE.CylinderGeometry(r, r, hh, n, 1, true), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6.2832 * r / 8, uv.getY(i) * hh / 8); return g; },
    // rez-de-chaussée : origine au trottoir au pied de la façade, X le long de la façade, Z vers la rue
    devanture: () => { const g = new THREE.BoxGeometry(13, 4.4, 0.5); g.translate(0, 2.2, 0.25); return g; },
    store: () => [['toile', 11.5, 0.08, 2.6, 0, 3.9, 1.2, [0.42, 0, 0]], ['toile', 11.5, 0.4, 0.06, 0, 3.15, 2.42], ...paire(sx => ['fer', 0.06, 0.06, 2.6, sx * 5.6, 3.6, 1.2, [0.42, 0, 0]])],
    // terrasse de café : trois guéridons de marbre sur pied de fonte, deux chaises cannées chacun, sur 1,4 m de trottoir
    terrasse: () => [-1, 0, 1].flatMap(k => [['plateau', 0.65, 0.04, 0.65, k * 3.6, 0.75, 1.0], ['fer', 0.08, 0.73, 0.08, k * 3.6, 0.37, 1.0], ['fer', 0.45, 0.04, 0.45, k * 3.6, 0.02, 1.0],
      ...paire(sx => [['canne', 0.45, 0.05, 0.42, k * 3.6 + sx * 0.75, 0.46, 1.0], ['canne', 0.06, 0.48, 0.42, k * 3.6 + sx * 0.97, 0.72, 1.0], ...paire(z => ['fer', 0.04, 0.46, 0.04, k * 3.6 + sx * 0.75, 0.23, 1.0 + z * 0.18])]).flat()]),
    // croix de pharmacie en drapeau : potence, croix lumineuse perpendiculaire à la façade (lisible le long de la rue)
    croixPharmacie: () => [['fer', 0.08, 0.08, 0.7, 0, 5.2, 0.35], ['croix', 0.22, 1.3, 0.42, 0, 5.2, 1.25], ['croix', 0.22, 0.42, 1.3, 0, 5.2, 1.25]],
    // kiosque à journaux : corps à panneaux, comptoir, toit en dôme à pans et lanternon
    kiosque: () => [['corps', 3, 2.6, 2.2, 0, 1.3, 0, null, 1], ['toit', 3.6, 0.25, 2.8, 0, 2.72, 0], ['toit', 3.1, 0.35, 2.3, 0, 3.0, 0], ['toit', 2.3, 0.35, 1.6, 0, 3.3, 0], ['toit', 1.3, 0.3, 0.9, 0, 3.58, 0],
      ['toit', 0.25, 0.7, 0.25, 0, 4.0, 0], ['comptoir', 2.4, 0.08, 0.5, 0, 1.1, 1.3], ['toit', 3.4, 0.08, 1.1, 0, 2.45, 1.55, [-0.3, 0, 0]]],
    // arc de triomphe : 45 m de large (X), 22 de profondeur (Z), 50 de haut. Grande arche de 14,6 m sous 29 m dans l'axe Z, arches latérales de 8,4 m sous 18,7 m dans l'axe X ;
    // quatre piles à socle et groupes sculptés, voûtes en gradins, corniche, frise, attique à écussons. Zones : pierre, relief (parties sculptées)
    arc: () => {
      const L = [];
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.push(['pierre', 15.2, 22, 6.8, sx * 14.9, 11, sz * 7.6, null, 1], ['pierre', 16, 1.4, 7.6, sx * 14.9, 0.7, sz * 7.6],
        ['relief', 8, 11, 0.6, sx * 14.9, 9.5, sz * 11.1], ['pierre', 15.8, 0.7, 7.4, sx * 14.9, 22.2, sz * 7.6]);
      for (const sx of [-1, 1]) L.push(['pierre', 15.2, 7.2, 22, sx * 14.9, 25.6, 0, null, 1], ['pierre', 15.2, 3.3, 8.4, sx * 14.9, 20.35, 0], ...paire(sz => ['pierre', 15.2, 2.6, 1.3, sx * 14.9, 17.4, sz * 3.55]));
      // voûte de la grande arche : bandes dont le bord suit le demi-cercle de 7,3 m
      for (const a of [0.35, 0.7, 1.05, 1.35]) { const y = 22 + 7.3 * Math.sin(a), e = 7.3 * (1 - Math.cos(a)); L.push(...paire(sx => ['pierre', e, 29.2 - y + 0.01, 22, sx * (7.3 - e / 2), (y + 29.2) / 2, 0])); }
      L.push(['pierre', 45, 19.8, 22, 0, 39.1, 0, null, 1], ['relief', 45.4, 2.6, 22.4, 0, 34.6, 0], ['pierre', 46.6, 1.2, 23.6, 0, 37.5, 0], ['pierre', 46, 1, 23, 0, 49.5, 0], ['pierre', 45.6, 0.6, 22.6, 0, 29.6, 0]);
      for (const x of [-18, -9, 0, 9, 18]) L.push(...paire(sz => ['relief', 3, 3, 0.4, x, 43.5, sz * 11.2]));
      return L;
    },
  });
})();
