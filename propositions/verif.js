// node propositions/verif.js — passe chaque tracé de cartes.html dans la vraie physique et affiche les mesures reprises dans la page.
// sim.js est lu puis patché en mémoire (tracé, voiture, valeurs câblées pour la Z-tune) : aucun fichier du jeu n'est modifié.
const fs = require('fs'), path = require('path'), dir = path.join(__dirname, '..');
const THREE = require(path.join(dir, 'three.min.js')), src = fs.readFileSync(path.join(dir, 'sim.js'), 'utf8');
const MAPS = new Function(/<script id="donnees">([^]*?)<\/script>/.exec(fs.readFileSync(path.join(__dirname, 'cartes.html'), 'utf8'))[1] + '; return MAPS;')();
const rep = (s, re, to) => { if (!re.test(s)) throw new Error('motif absent de sim.js : ' + re); return s.replace(re, to); };
for (const m of MAPS) {
  let s = src;
  s = rep(s, /const W = 9,/, `const W = ${m.W},`);
  s = rep(s, /const GRIP = 44;/, `const GRIP = ${m.grip};`);
  if (m.car) s = rep(s, /const CARD = \{[^]*?\n  \};/, 'const CARD = ' + JSON.stringify(m.car) + ';');
  s = rep(s, /const HGT = .*;/, 'const HGT = ' + JSON.stringify(m.pts.map(p => p[2])) + ';');
  s = rep(s, /const SC = 0.85;/, `const SC = ${m.sc};`);
  s = rep(s, /const PTS = \[[^]*?\* SC\]\);/, 'const PTS = ' + JSON.stringify(m.pts.map(p => [p[0] * m.sc, p[1] * m.sc])) + ';');
  s = rep(s, /const TUN = \[6, 12\];/, `const TUN = ${JSON.stringify(m.tun)};`);
  // valeurs câblées pour la Z-tune, à passer en données dans le prérequis
  s = rep(s, /c\.gear < 5/, 'c.gear < CARD.ratios.length - 1');
  s = rep(s, /> 7500/, '> CARD.red * 0.94'); s = rep(s, /< 6200/, '< CARD.red * 0.775');
  s = rep(s, /Math\.min\(11,/, 'Math.min(CARD.trac || 11,');
  if (m.id !== 'ville') { // le pilote auto du jeu ne regarde pas assez loin pour freiner avant une épingle : ici il anticipe la distance de freinage
    s = rep(s, /let km = 0;[^]*?const vt = .*;/, 'let vt = 1e9; for (let j = 0; j < 160; j++) vt = Math.min(vt, Math.sqrt(0.85 * GRIP / (Math.abs(S[(c.idx + j) % n].k) + 1e-4) + 2 * 10 * j * 2));');
    s = rep(s, /c\.idx \+ 6 \+ Math\.floor\(sp \* 0\.35\)/, 'c.idx + 4 + Math.floor(sp * 0.2)');
  }
  const G = {}; new Function('globalThis', 'window', s.replace("typeof window !== 'undefined' ? window : globalThis", 'globalThis'))(G, undefined);
  const T = G.buildTrack(THREE), { S, n, W } = T, H = 1 / 120;
  const ks = S.map(x => Math.abs(x.k)), rmin = 1 / Math.max(...ks);
  let hp = 0, run = 0, ang = 0; // épingle = plus de 140° d'un seul tenant sous 45 m de rayon
  for (let i = 0; i < n; i++) { if (ks[i] > 1 / 45) { ang += ks[i] * 2; run = 1; } else { if (run && ang > 2.4) hp++; run = 0; ang = 0; } }
  let cross = 1e9;
  for (let i = 0; i < n; i += 2) for (let j = i + 40; j < n; j += 2) { if (n - j + i < 40) continue; cross = Math.min(cross, Math.hypot(S[i].x - S[j].x, S[i].z - S[j].z)); }
  const ys = S.map(x => x.y), sl = Math.max(...S.map(x => Math.abs(x.sl)));
  const c = G.newCar(T); let t = 0, t1 = 0, hits = 0, vmax = 0, vmin = 1e9, slid = 0; // deuxième tour = tour lancé
  while (c.dist < 2 * n && t < 900) { G.step(c, G.autopilot(c, T), T, H); t += H; if (c.dist >= n) { if (!t1) t1 = t; const v = Math.hypot(c.vx, c.vz); vmax = Math.max(vmax, v); vmin = Math.min(vmin, v); if (c.hit > 3) hits++; if (c.drift) slid += H; } }
  const lap = t - t1, k = v => Math.round(v * 3.6), a = m.auto;
  console.log(m.id.padEnd(7), `${Math.round(T.len)} m | dénivelé ${Math.round(Math.max(...ys) - Math.min(...ys))} m | pente max ${(sl * 100).toFixed(0)} % | rayon mini ${rmin.toFixed(0)} m | épingles ${hp} | écart mini entre voies ${cross.toFixed(0)} m (requis ${2 * W + 8}) | tour ${lap.toFixed(1)} s | moy ${k(T.len / lap)} | max ${k(vmax)} | min ${k(vmin)} km/h | chocs ${hits} | glisse ${slid.toFixed(1)} s`);
  if (c.dist < 2 * n) throw new Error(m.id + ' : tour non bouclé');
  if (cross < 2 * W + 8) throw new Error(m.id + ' : la piste se recoupe');
  if (Math.abs(lap - a.t) > 0.05 || k(T.len / lap) !== a.moy || k(vmax) !== a.max || k(vmin) !== a.min || hp !== a.ep) throw new Error(m.id + ' : les mesures affichées dans cartes.html ne sont plus à jour');
}
console.log('OK : les mesures de cartes.html correspondent.');
