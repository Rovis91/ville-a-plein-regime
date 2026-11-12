// node test-cartes.js — chaque carte de cartes.js passe dans la vraie physique : tracé valide, tour bouclé au pilote automatique, voiture plausible.
// La ville a ses propres tests, plus complets, dans test.js (ses chiffres ne doivent pas bouger : records vpr5.*).
const assert = require('assert'), THREE = require('./three.min.js');
require('./cartes.js');
const H = 1 / 120;
for (const M of CARTES) {
  globalThis.CARTE = M; delete require.cache[require.resolve('./sim.js')]; require('./sim.js'); // sim.js lit la carte active à son chargement
  const T = buildTrack(THREE), { S, n, W } = T;
  const rmin = 1 / Math.max(...S.map(s => Math.abs(s.k)));
  assert(rmin > 15, `${M.id} : rayon mini trop serré (${rmin})`);
  let cross = 1e9;
  for (let i = 0; i < n; i += 2) for (let j = i + 40; j < n; j += 2) { if (n - j + i < 40) continue; cross = Math.min(cross, Math.hypot(S[i].x - S[j].x, S[i].z - S[j].z)); }
  assert(cross > 2 * W + 8, `${M.id} : la piste se recoupe (${cross})`);
  assert(T.sp[0] < T.sp[1] && T.h0 < T.h1 && (!T.tun || T.t0 < T.t1), `${M.id} : secteurs dans le désordre`);
  // deux tours au pilote automatique : le second, lancé, donne les chiffres
  let c = newCar(T), t = 0, t1 = 0, hits = 0, vmax = 0, vmin = 1e9, slid = 0;
  while (c.dist < 2 * n && t < 900) {
    step(c, autopilot(c, T), T, H); t += H; assert(Math.abs(c.d) <= W && Number.isFinite(c.x));
    if (c.dist >= n) { if (!t1) t1 = t; const v = Math.hypot(c.vx, c.vz); vmax = Math.max(vmax, v); vmin = Math.min(vmin, v); if (c.hit > 3) hits++; if (c.drift) slid += H; }
  }
  assert(c.dist >= 2 * n, `${M.id} : le pilote automatique ne boucle pas le tour`);
  if (process.env.DBG) console.log(M.id, hits); else assert(hits <= 2, `${M.id} : le pilote automatique tape les murs (${hits})`);
  // départ arrêté, gaz à fond : 0 à 100 km/h plausible, et la boîte auto monte tous les rapports utiles sans rester au rupteur
  c = newCar(T); let t100 = 0;
  for (let i = 0; i < 8 / H && !t100; i++) { step(c, { steer: 0, gas: 1, brake: 0, hand: false }, T, H); if (c.vf >= 100 / 3.6) t100 = (i + 1) * H; assert(c.rpm <= CARD.red + 200); }
  assert(t100 > 2.5 && t100 < 6.5, `${M.id} : 0 à 100 km/h en ${t100} s`);
  // frein à main + braquage : la voiture doit partir en glisse sur toutes les cartes
  c = newCar(T); for (let i = 0; i < 5 / H; i++) step(c, autopilot(c, T), T, H);
  for (let i = 0; i < 0.5 / H; i++) step(c, { steer: 1, gas: 0, brake: 0, hand: true }, T, H);
  assert(c.drift || c.hit, `${M.id} : pas de glisse au frein à main`);
  // trafic : positions finies, sur la route ; une voiture arrêtée sur une file se fait pousser sans être traversée
  if (M.trafic) {
    for (const tt of [0, 37.3, 400]) for (const k of trafic(T, tt)) assert(Number.isFinite(k.x) && Math.abs(k.d) < W - 1.4, `${M.id} : camion hors route`);
    const k0 = trafic(T, 0)[0], s = S[(k0.idx + 20) % n]; c = newCar(T); Object.assign(c, { x: s.x - s.tz * k0.lane, z: s.z + s.tx * k0.lane, idx: (k0.idx + 20) % n, th: Math.atan2(s.tz, s.tx) });
    let hit = 0; for (let i = 0; i < 4 / H; i++) { step(c, { steer: 0, gas: 0, brake: 0, hand: false }, T, H); hitTrafic(c, T, i * H); hit = Math.max(hit, c.hit); }
    assert(hit > 5 && Math.hypot(c.vx, c.vz) > 5, `${M.id} : le camion ne pousse pas la voiture (${hit})`);
  }
  const lap = t - t1, k = v => Math.round(v * 3.6);
  console.log(`OK  ${M.id.padEnd(7)} ${Math.round(T.len)} m, rayon mini ${rmin | 0} m, tour lancé ${lap.toFixed(1)} s, moyenne ${k(T.len / lap)} km/h, de ${k(vmin)} à ${k(vmax)} km/h, ${hits} chocs, ${slid.toFixed(1)} s de glisse, 0-100 en ${t100.toFixed(1)} s`);
}
