// Textures propres à « voitures » : complète le catalogue de textures.js (mêmes conventions : aplat pour ce qui émet de la lumière, dessin sinon, hasard par o.alea). Voir METHODE-DECOR.md.
// La livrée est peinte en plan, sur les vues que formes-voitures.js projette sur la caisse (plan.cote, plan.dessus, plan.av, plan.ar : mètres → pixels).
// Teinte franche dans le dessin (la matière n'est pas teintée, pour que le vitrage, les plastiques et la plaque gardent leur couleur) ; la brillance vient de l'option gloss.
(() => {
  const css = c => '#' + (c >>> 0).toString(16).padStart(6, '0');
  const VITRE = '#121a26', CADRE = '#0a0b0e', SOMBRE = '#0c0c10';
  // rectangle et polygone en mètres dans une vue
  const rv = (g, v, a0, b0, a1, b1, c) => { const [x0, y0] = v(a0, b0), [x1, y1] = v(a1, b1); g.fillStyle = c; g.fillRect(Math.round(Math.min(x0, x1)), Math.round(Math.min(y0, y1)), Math.max(1, Math.round(Math.abs(x1 - x0))), Math.max(1, Math.round(Math.abs(y1 - y0)))); };
  const trace = (g, v, pts) => { g.beginPath(); pts.forEach(([a, b], i) => { const [x, y] = v(a, b); g[i ? 'lineTo' : 'moveTo'](Math.round(x), Math.round(y)); }); g.closePath(); };
  const poly = (g, v, pts, c) => { trace(g, v, pts); g.fillStyle = c; g.fill(); };
  // polygone convexe (sens direct) rétréci de d mètres : chaque côté recule vers l'intérieur, sommets aux nouvelles intersections
  const retreci = (p, d) => {
    const L = p.map((a, i) => { const b = p[(i + 1) % p.length], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); return [a[0] - dy / l * d, a[1] + dx / l * d, dx, dy]; });
    return L.map((e, i) => { const f = L[(i + L.length - 1) % L.length], t = ((e[0] - f[0]) * e[3] - (e[1] - f[1]) * e[2]) / (f[2] * e[3] - f[3] * e[2]); return [f[0] + f[2] * t, f[1] + f[3] * t]; });
  };
  // vitrage : fond sombre, deux reflets en biais, découpé à la forme
  const vitre = (g, o, v, pts) => {
    g.save(); trace(g, v, pts); g.clip(); poly(g, v, pts, VITRE);
    o.voile(g, 0.22, () => { const y0 = v(pts[0][0], pts[0][1])[1]; for (let k = -40; k < 140; k += 23) { g.beginPath(); g.moveTo(k, y0 + 30); g.lineTo(k + 30, y0 - 30); g.lineTo(k + 34, y0 - 30); g.lineTo(k + 4, y0 + 30); g.fillStyle = '#fff'; g.fill(); } });
    g.restore();
  };
  const plaque = (g, o, v, y, l = 0.52) => { rv(g, v, -l / 2, y - 0.06, l / 2, y + 0.06, '#e8e6dc'); for (const z of [-0.18, -0.08, 0.06, 0.16]) rv(g, v, z - 0.03, y - 0.03, z + 0.03, y + 0.03, '#22242a'); o.voile(g, 0.5, () => rv(g, v, -l / 2, y + 0.05, l / 2, y + 0.06, '#000')); };
  const grille = (g, o, v, z, y0, y1, pas = 2) => { rv(g, v, -z, y0, z, y1, SOMBRE); o.voile(g, 0.35, () => { const [, a] = v(0, y1), [, b] = v(0, y0); for (let y = Math.round(a) + 1; y < b; y += pas) rv(g, (x, yy) => [v(x, 0)[0], yy], -z + 0.03, y, z - 0.03, y + 1, '#8a8c94'); }); };

  Object.assign(TEXTURES, {
    // livrée d'une voiture du jeu : p = le plan de FORMES.voiture, col = teinte de la caisse, bande = teinte des bandes (Viper)
    livree: (p, col, bande) => [128, 128, (g, o) => {
      const l = ((col >> 16 & 255) * 0.3 + (col >> 8 & 255) * 0.59 + (col & 255) * 0.11) / 255, k = l < 0.5 ? (0.5 - l) * 1.2 : 0; // teinte sombre éclaircie vers l'argent, pour qu'elle se lise de nuit
      col = [16, 8, 0].reduce((s, d) => s | Math.round((col >> d & 255) * (1 - k) + 230 * k) << d, 0);
      const { R, voile, alea } = o, C = css(col), [xr, xf] = p.xs, ra = p.ra, belt = p.cab[0][1], beltR = p.cab[3][1], hw = p.wc / 2 - 0.11, W = p.w / 2;
      const nez = Math.max(...p.dessusCaisse.map(q => q[0])), cul = Math.min(...p.dessusCaisse.map(q => q[0]));
      R(g, C, 0, 0, 128, 128);
      // modelé : épaule claire, bas de caisse plus sombre, reflet le long du capot et du toit
      voile(g, 0.14, () => { rv(g, p.cote, -2.7, 0.45, 2.7, p.bas, '#000'); rv(g, p.av, -1.05, 0.34, 1.05, 0, '#000'); rv(g, p.ar, -1.05, 0.34, 1.05, 0, '#000'); });
      voile(g, 0.3, () => { rv(g, p.cote, cul, belt - 0.05, nez, belt - 0.03, '#fff'); rv(g, p.dessus, cul + 0.2, 0.28, nez - 0.2, 0.34, '#fff'); });
      if (bande) { const B = css(bande); for (const s of [-1, 1]) { rv(g, p.dessus, -2.7, s * 0.08, 2.7, s * 0.3, B); rv(g, p.av, s * 0.08, 0, s * 0.3, 1.5, B); rv(g, p.ar, s * 0.08, 0, s * 0.3, 1.5, B); } }
      // joints : portes, capot, malle ; bas de caisse ; lèvres des passages de roue
      voile(g, 0.5, () => {
        for (const x of p.portes) rv(g, p.cote, x, p.bas + 0.06, x - 0.04, belt, '#000');
        rv(g, p.cote, p.portes[1] + 0.1, belt - 0.12, p.portes[1] + 0.22, belt - 0.08, '#000'); // poignée
        rv(g, p.cote, xr + ra + 0.12, belt - 0.16, xr + ra + 0.24, belt - 0.06, '#000'); rv(g, p.cote, xr + ra + 0.16, belt - 0.12, xr + ra + 0.2, belt - 0.1, C); // trappe à carburant
        for (const s of [-1, 1]) { rv(g, p.dessus, nez - 0.12, s * (W - 0.14), p.cab[0][0] + 0.06, s * (W - 0.18), '#000'); rv(g, p.dessus, p.cab[3][0] - 0.04, s * (W - 0.16), cul + 0.1, s * (W - 0.2), '#000'); }
        rv(g, p.dessus, p.cab[0][0] + 0.04, -W + 0.14, p.cab[0][0] + 0.08, W - 0.14, '#000'); rv(g, p.dessus, p.cab[3][0] - 0.02, -W + 0.16, p.cab[3][0] - 0.06, W - 0.16, '#000');
        rv(g, p.av, -W + 0.1, 0.44, W - 0.1, 0.46, '#000'); rv(g, p.ar, -W + 0.12, 0.7, W - 0.12, 0.72, '#000'); rv(g, p.ar, -W + 0.1, 0.36, W - 0.1, 0.38, '#000');
      });
      rv(g, p.cote, -2.7, p.bas, 2.7, p.bas + 0.06, '#16171c');
      g.strokeStyle = '#000'; g.lineWidth = 1; for (const x of p.xs) { const [cx, cy] = p.cote(x, p.r); g.beginPath(); g.arc(cx, cy, (ra + 0.06) * p.PX, Math.PI, 2 * Math.PI); g.stroke(); }
      R(g, '#ff8c1a', Math.round(p.cote(xf + ra + 0.12, 0)[0]), Math.round(p.cote(0, 0.52)[1]), 2, 1); // répétiteur de clignotant
      // vitrage : vitres latérales cerclées de noir, montant central ; pare-brise et lunette vus de dessus, de face et de l'arrière
      poly(g, p.cote, retreci(p.cab, 0.06), CADRE); vitre(g, o, p.cote, retreci(p.cab, 0.14));
      if (p.portes[1] > p.cab[3][0] && p.portes[1] < p.cab[0][0]) rv(g, p.cote, p.portes[1] - 0.02, belt, p.portes[1] - 0.1, 1.5, CADRE);
      const [[x0], [x1], [x2], [x3]] = p.cab;
      rv(g, p.dessus, x1 + 0.02, -hw, x0, hw, CADRE); vitre(g, o, p.dessus, [[x0, -hw + 0.05], [x0, hw - 0.05], [x1 + 0.06, hw - 0.08], [x1 + 0.06, -hw + 0.08]]);
      rv(g, p.dessus, x3, -hw, x2 - 0.02, hw, CADRE); vitre(g, o, p.dessus, [[x2 - 0.06, -hw + 0.08], [x2 - 0.06, hw - 0.08], [x3 + 0.04, hw - 0.05], [x3 + 0.04, -hw + 0.05]]);
      voile(g, 0.6, () => { for (const z of [-0.3, 0.25]) rv(g, p.dessus, x0 - 0.03, z, x0 - 0.08, z + 0.42, '#000'); }); // essuie-glaces
      rv(g, p.av, -hw, belt + 0.02, hw, 1.5, CADRE); vitre(g, o, p.av, [[-hw + 0.05, belt + 0.06], [hw - 0.05, belt + 0.06], [hw - 0.05, 1.5], [-hw + 0.05, 1.5]]);
      rv(g, p.ar, -hw, beltR + 0.02, hw, 1.5, CADRE); vitre(g, o, p.ar, [[-hw + 0.05, beltR + 0.06], [hw - 0.05, beltR + 0.06], [hw - 0.05, 1.5], [-hw + 0.05, 1.5]]);
      // face et arrière propres au modèle : prises d'air, boîtiers de phares, plaque
      const ph = (z0, z1, y0, y1) => { for (const s of [-1, 1]) rv(g, p.av, s * z0, y0, s * z1, y1, '#2a2c34'); };
      const K = p.K;
      if (K === 'gtr') { grille(g, o, p.av, 0.55, 0.24, 0.4); grille(g, o, p.av, 0.3, 0.5, 0.6, 3); ph(0.38, 0.78, 0.55, 0.68); voile(g, 0.6, () => { rv(g, p.dessus, 1.5, -0.25, 1.85, 0.25, SOMBRE); for (let x = 1.53; x < 1.85; x += 0.08) rv(g, p.dessus, x, -0.23, x + 0.03, 0.23, '#3a3c44'); });
        for (let k = 0; k < 3; k++) rv(g, p.cote, xf - ra - 0.14 - k * 0.07, 0.56, xf - ra - 0.17 - k * 0.07, 0.7, SOMBRE); }
      if (K === 'fd') { grille(g, o, p.av, 0.42, 0.26, 0.4); for (const s of [-1, 1]) rv(g, p.av, s * 0.55, 0.26, s * 0.72, 0.34, SOMBRE); voile(g, 0.5, () => rv(g, p.dessus, 1.0, -0.12, 1.2, 0.12, SOMBRE)); }
      if (K === 'a80') { grille(g, o, p.av, 0.38, 0.26, 0.42); for (const s of [-1, 1]) rv(g, p.av, s * 0.55, 0.26, s * 0.75, 0.36, SOMBRE); ph(0.42, 0.8, 0.46, 0.58); }
      if (K === 'r5') { grille(g, o, p.av, 0.38, 0.52, 0.66); ph(0.36, 0.68, 0.5, 0.68); plaque(g, o, p.av, 0.44); }
      if (K === 'gts') { grille(g, o, p.av, 0.5, 0.24, 0.4, 3); voile(g, 0.7, () => { for (const s of [-1, 1]) rv(g, p.dessus, 0.45, s * 0.42, 0.8, s * 0.58, SOMBRE); });
        for (let k = 0; k < 3; k++) rv(g, p.cote, xf - ra - 0.12 - k * 0.1, 0.42, xf - ra - 0.17 - k * 0.1, 0.62, SOMBRE); }
      voile(g, 0.5, () => { for (const s of [-1, 1]) rv(g, p.ar, s * 0.62, 0.24, s * 0.76, 0.3, SOMBRE); }); // sorties d'échappement
      plaque(g, o, p.ar, p.plaque);
      // usure légère : projections au bas de caisse et derrière les roues
      voile(g, 0.25, () => { for (let i = 0; i < 70; i++) { const x = cul + alea() * (nez - cul), [px, py] = p.cote(x, p.bas + 0.06 + alea() * alea() * 0.4); R(g, '#2a241c', px | 0, py | 0, 1, 1); } });
      R(g, C, 120, 92, 8, 8); R(g, '#0c0c10', 120, 104, 8, 8); // aplats de teinte et sombre (pièces unies, dessous)
    }],
    // roue de voiture : flanc, jante (style selon le modèle), étrier, écrous ; bande de roulement sur la dernière rangée
    roueVoiture: K => [64, 64, (g, o) => {
      const { R, voile } = o, cx = 32, cy = 29.5, rj = 19;
      R(g, '#141416', 0, 0, 64, 64); for (let x = 0; x < 64; x += 4) R(g, '#08080a', x, 58, 2, 6); // gomme et rainures : la rotation se lit
      const disque = (r, c) => { g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fillStyle = c; g.fill(); };
      disque(26, '#1a1a1e'); voile(g, 0.4, () => { g.strokeStyle = '#3a3a40'; g.beginPath(); g.arc(cx, cy, 23, 0, 7); g.stroke(); });
      disque(rj + 1, '#9a9ca4'); disque(rj - 1, '#26262c'); R(g, '#6a2024', 41, 20, 3, 5); // fond de jante, disque et étrier
      const c = K === 'r5' ? '#d8d8dc' : K === 'gts' ? '#c8cad0' : K === 'fd' ? '#b8bac2' : K === 'a80' ? '#a8aab2' : '#7a7c84';
      const n = { gtr: 12, fd: 5, a80: 5, gts: 5 }[K] || 0;
      if (n) { g.strokeStyle = c; g.lineWidth = n > 6 ? 2 : K === 'a80' ? 5 : 3.5; for (let i = 0; i < n; i++) { const a = i * 2 * Math.PI / n; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * rj, cy + Math.sin(a) * rj); g.stroke(); } }
      else { disque(rj - 1, c); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.6; R(g, '#26262c', Math.round(cx + Math.cos(a) * 11) - 2, Math.round(cy + Math.sin(a) * 11) - 2, 4, 4); } }
      disque(5, c); disque(2.5, '#2a2a30'); for (let i = 0; i < 5; i++) { const a = i * 1.2566; R(g, '#e0e0e6', Math.round(cx + Math.cos(a) * 4), Math.round(cy + Math.sin(a) * 4), 1, 1); }
    }],
    // plastiques noirs grainés : boucliers, diffuseur, montants d'aileron, fond des passages de roue
    garniture: () => [16, 16, (g, o) => { const { R, alea, voile } = o; R(g, '#1a1b20', 0, 0, 16, 16); voile(g, 0.5, () => { for (let y = 0; y < 16; y += 4) for (let x = (y & 4) / 2; x < 16; x += 4) R(g, '#101114', x, y, 2, 2); }); voile(g, 0.1, () => { for (let i = 0; i < 6; i++) R(g, '#fff', alea() * 16 | 0, alea() * 16 | 0, 1, 1); }); }]
  });
})();
