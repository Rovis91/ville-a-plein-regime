// Formes propres à « paris » : complète le catalogue de formes.js (mêmes conventions : forme simple = géométrie, assemblage = liste de boîtes à zones). Voir METHODE-DECOR.md.
(function () {
  const paire = f => [-1, 1].map(f);
  Object.assign(FORMES, {
    // bord d'un îlot rond : cylindre ouvert de rayon r et de hauteur hh, la texture répétée tous les 8 m (la tuile de la pierre)
    cylindreOuvert: (r, hh, n) => { const g = new THREE.CylinderGeometry(r, r, hh, n, 1, true), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6.2832 * r / 8, uv.getY(i) * hh / 8); return g; },
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
