// node outils/traces-or.js [carte…] — régénère traces-or.js : la trace de référence du fantôme or de chaque carte (sans argument : toutes ; sinon celles nommées, les autres sont gardées).
// À relancer si la physique ou un tracé change (test-cartes.js le dira : la trace sort de la route ou n'est plus sous le seuil or).
// Faute de tour conduit à la main, la trace vient de la simulation : le pilote en glisse de test-cartes.js (frein à main dans les virages serrés, nitro dès qu'il accélère),
// dont on balaie les réglages. On garde, parmi les tours lancés sans réception dure : sous le seuil or, celui qui touche le moins les murs, puis le plus rapide ; à défaut, le plus rapide sans choc.
// Pour la remplacer par un vrai tour : coller dans traces-or.js ce qui suit « #defi= » dans un lien de défi (même format).
const fs = require('fs'), THREE = require('../three.min.js'), F = __dirname + '/../traces-or.js';
require('../cartes.js');
const H = 1 / 120, wrap = a => Math.atan2(Math.sin(a), Math.cos(a)), qui = process.argv.slice(2);
try { require(F); } catch (e) { globalThis.TRACES_OR = {}; }
for (const M of CARTES) {
  if (qui.length && !qui.includes(M.id)) continue;
  globalThis.CARTE = M; delete require.cache[require.resolve('../sim.js')]; require('../sim.js');
  const T = buildTrack(THREE), { S, n } = T, or = tourRef(T).t * (M.med || [1.1, 1.03, 0.97])[2];
  // lv : niveau du pilote hors glisse (1 = tour propre), lg : en glisse, ent : part du braquage demandée qui déclenche la glisse (Infinity : jamais), ten : part en dessous de laquelle il la lâche
  const pilote = (lv, lg, ent, ten) => c => {
    const a = autopilot(c, T, c.dd ? lg : lv), sp = Math.hypot(c.vx, c.vz), la = S[(c.idx + 3 + Math.floor(sp * 0.1)) % n], dem = s => s.kl * sp / omega(sp) / (M.surf ? 1 - T.surf[c.idx].vir : 1);
    const m = wrap(Math.atan2(la.z + la.tx * la.dl - c.z, la.x - la.tz * la.dl - c.x) - (c.dd ? Math.atan2(c.vz, c.vx) : c.th)) * 3;
    if (c.dd ? m * c.dd > 0 && Math.max(dem(S[c.idx]) * c.dd, dem(la) * c.dd) > ten : Math.abs(dem(la)) > ent && dem(la) * m > 0 && sp > 15) { const d = c.dd || Math.sign(m), f = Math.max(m * d, 0.35); return { steer: d * Math.max(-1, Math.min(1, f < 1.1 ? (f - 1.1) / 0.75 : f - 1.1)), gas: a.gas ? 1 : 0, brake: a.brake, hand: true }; }
    return { ...a, gas: a.gas ? 1 : 0, nitro: !!a.gas };
  };
  const tour = drive => { const c = newCar(T), trace = []; let t = 0, t1 = 0, i = 0, sale = 0; // même découpe que tourRef : le second tour, à 20 Hz depuis la ligne
    while (c.dist < 2 * n && t < 900) { step(c, drive(c), T, H); t += H; if (!t1 && c.dist >= n) t1 = t; if (t1) { if (i++ % 6 === 0) trace.push(c.x, c.y, c.z, c.th); if (c.hit > 3) sale++; if (c.land > 9) sale = 1e9; } }
    return c.dist >= 2 * n && sale < 1e9 ? { t: t - t1, trace, sale } : null; };
  let b = null;
  const note = r => r.t <= or ? r.sale * 1000 + r.t : r.sale ? 1e9 : 1e6 + r.t;
  for (const lv of [1, 1.02, 1.04, 1.06, 1.1]) for (const lg of [1.1, 1.2, 1.3, 1.4]) for (const ent of [0.6, 0.7, 0.8, 0.9, Infinity]) for (const ten of [0.2, 0.3, 0.4]) {
    if (ent === Infinity && (lg > 1.1 || ten > 0.2)) continue;
    const r = tour(pilote(lv, lg, ent, ten)); if (r && note(r) < 1e9 && (!b || note(r) < note(b))) b = { ...r, regl: [lv, lg, ent, ten] }; }
  if (!b) { console.log(`${M.id} : aucun tour retenu, trace gardée`); continue; }
  TRACES_OR[M.id] = defiCode(M.id, b.t, b.trace);
  console.log(`${M.id.padEnd(7)} ${b.t.toFixed(2)} s, seuil or ${or.toFixed(2)} s : ${b.t <= or ? 'sous le seuil' : 'AU-DESSUS de ' + (b.t - or).toFixed(2) + ' s'}, ${b.sale} pas au contact d'un mur (réglages ${b.regl.join(' / ')})`);
}
fs.writeFileSync(F, `// Traces de référence des fantômes or, une par carte, au format d'un lien de défi (voir defiCode dans sim.js). Fichier produit par outils/traces-or.js : ne pas le modifier à la main,
// sauf pour y coller un vrai tour (ce qui suit « #defi= » dans un lien de défi).
(typeof window !== 'undefined' ? window : globalThis).TRACES_OR = {
${CARTES.filter(M => TRACES_OR[M.id]).map(M => `  ${M.id}: '${TRACES_OR[M.id]}',`).join('\n')}
};
`);
