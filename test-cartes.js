// node test-cartes.js — chaque carte de cartes.js passe dans la vraie physique : tracé valide, tour bouclé au pilote automatique, voiture plausible.
// La ville a ses propres tests, plus complets, dans test.js (ses chiffres ne doivent pas bouger : records vpr5.*).
const assert = require('assert'), THREE = require('./three.min.js');
require('./cartes.js');
const H = 1 / 120, deg = r => r * 180 / Math.PI;
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
  assert(hits <= 2, `${M.id} : le pilote automatique tape les murs (${hits})`);
  // départ arrêté, gaz à fond : 0 à 100 km/h plausible, et la boîte auto monte tous les rapports utiles sans rester au rupteur
  c = newCar(T); let t100 = 0;
  for (let i = 0; i < 8 / H && !t100; i++) { step(c, { steer: 0, gas: 1, brake: 0, hand: false }, T, H); if (c.vf >= 100 / 3.6) t100 = (i + 1) * H; assert(c.rpm <= CARD.red + 200); }
  assert(t100 > 2.5 && t100 < 6.5, `${M.id} : 0 à 100 km/h en ${t100} s`);
  // frein à main + braquage : la voiture doit partir en glisse sur toutes les cartes
  c = newCar(T); for (let i = 0; i < 5 / H; i++) step(c, autopilot(c, T), T, H);
  for (let i = 0; i < 0.5 / H; i++) step(c, { steer: 1, gas: 0, brake: 0, hand: true }, T, H);
  assert(c.drift || c.hit, `${M.id} : pas de glisse au frein à main`);
  // --- tenue de route, en plan ouvert (sans murs : un seul échantillon de piste, recollé sous la voiture à chaque pas) ---
  const O = { x: 0, y: 0, z: 0, tx: 1, tz: 0, k: 0, sl: 0 }, TO = { S: [O], n: 1 }, I = (steer, gas, brake = 0, hand = false) => ({ steer, gas, brake, hand });
  const go = (c, inp, sec) => { for (let i = 0; i < sec / H; i++) { O.x = c.x; O.z = c.z; const v = Math.hypot(c.vx, c.vz) || 1; O.tx = c.vx / v; O.tz = c.vz / v; step(c, inp, TO, H); } return c; };
  const lance = kmh => { const c = Object.assign(newCar(T), { idx: 0 }); while (Math.hypot(c.vx, c.vz) < kmh / 3.6) go(c, I(0, 1), H); return c; };
  const cap = c => Math.atan2(c.vz, c.vx), der = c => deg(Math.atan2(Math.abs(c.vl), Math.abs(c.vf)));
  // rayon de la trajectoire, volant à fond : mesuré entre 1 et 1,5 s
  const rayon = (kmh, gas, brake) => { const c = go(lance(kmh), I(1, gas, brake), 1), a = cap(c); let d = 0; for (let i = 0; i < 60; i++) { go(c, I(1, gas, brake), H); d += Math.hypot(c.vx, c.vz) * H; } return d / Math.abs(Math.atan2(Math.sin(cap(c) - a), Math.cos(cap(c) - a))); };
  const ext = rmin + W - 1.1, r60 = rayon(60, 1), r60l = rayon(60, 0), r180 = rayon(180, 1), r180l = rayon(180, 0);
  // à 60 km/h on tourne plus serré que le virage le plus serré de la carte, même gaz à fond ; à 180 km/h gaz à fond on ne le passe pas, et lever le pied resserre
  assert(r60l < rmin && r60 < ext, `${M.id} : braquage trop large à 60 km/h (${r60} m sur les gaz, ${r60l} m pied levé, virage de ${rmin} m)`);
  assert(r180 > ext && r180l < 0.9 * r180, `${M.id} : à 180 km/h, rayon ${r180} m sur les gaz, ${r180l} m pied levé (virage de ${rmin} m)`);
  // réponse au volant : à 120 km/h, 0,2 s après le coup de volant la voiture tourne déjà à 85 % de son régime
  const y02 = go(lance(120), I(1, 1), 0.2).yaw, y06 = go(lance(120), I(1, 1), 0.6).yaw;
  assert(y02 > 0.85 * y06, `${M.id} : volant trop lent (${deg(y02)} °/s à 0,2 s, ${deg(y06)} à 0,6 s)`);
  // glisse à 150 km/h : frein à main 0,35 s -> elle part ; volant tenu + gaz 1 s -> elle tient entre 15 et 45° ;
  // volant lâché -> rattrapée en moins de 1,2 s ; contre-braquage 0,6 s -> redressée sans repartir de l'autre côté
  const tenue = () => go(go(lance(150), I(1, 0, 0, true), 0.35), I(1, 1), 1);
  c = tenue(); const dtenue = der(c);
  assert(c.drift && dtenue > 15 && dtenue < 45, `${M.id} : glisse non tenue (${dtenue}°)`);
  let rat = 0; while ((c.slide > 0.15 || der(c) > 3) && rat < 3) { go(c, I(0, 1), H); rat += H; }
  assert(rat < 1.2, `${M.id} : glisse non rattrapée volant lâché (${rat} s)`);
  c = go(tenue(), I(-1, 1), 0.6);
  assert(!c.drift && der(c) < 10, `${M.id} : le contre-braquage ne redresse pas proprement (${der(c)}°)`);
  // tour lancé en glisse (là où le pilote lèverait le pied en virage : coup de frein à main, puis volant tenu et gaz tant que ça glisse) : au moins aussi rapide que le tour propre.
  // La ville est vérifiée dans test.js. À fond sans freiner : affiché seulement — sur les cartes à épingles, frotter les murs reste plus rapide que le pilote automatique (murs adoucis).
  const tour = drive => { const c = newCar(T), st = {}; let t = 0, t1 = 0; while (c.dist < 2 * n && t < 900) { step(c, drive(c, t, st), T, H); t += H; if (!t1 && c.dist >= n) t1 = t; } return t - t1; };
  const tfond = tour(c => ({ ...autopilot(c, T), gas: 1, brake: 0 })), tgl = tour((c, t, st) => {
    let inp = autopilot(c, T);
    if (!st.until && !inp.gas && Math.abs(inp.steer) > 0.2 && Math.hypot(c.vx, c.vz) > 30 && t > (st.cool || 0)) { st.until = t + 0.15; st.dir = Math.sign(inp.steer); st.hold = t + 0.8; st.cool = t + 2; }
    if (st.until) { if (t < st.until) inp = I(st.dir, 1, 0, true); else if (t < st.hold && c.slide > 0.3) inp = I(st.dir, 1); else st.until = 0; }
    return inp; });
  assert(M.id === 'ville' || tgl <= t - t1, `${M.id} : tour en glisse (${tgl} s) plus lent que le tour propre (${t - t1} s)`);
  // trafic : positions finies, sur la route ; une voiture arrêtée sur une file se fait pousser sans être traversée
  if (M.trafic) {
    for (const tt of [0, 37.3, 400]) for (const k of trafic(T, tt)) assert(Number.isFinite(k.x) && Math.abs(k.d) < W - 1.4, `${M.id} : camion hors route`);
    const k0 = trafic(T, 0)[0], s = S[(k0.idx + 20) % n]; c = newCar(T); Object.assign(c, { x: s.x - s.tz * k0.lane, z: s.z + s.tx * k0.lane, idx: (k0.idx + 20) % n, th: Math.atan2(s.tz, s.tx) });
    let hit = 0; for (let i = 0; i < 4 / H; i++) { step(c, { steer: 0, gas: 0, brake: 0, hand: false }, T, H); hitTrafic(c, T, i * H); hit = Math.max(hit, c.hit); }
    assert(hit > 5 && Math.hypot(c.vx, c.vz) > 5, `${M.id} : le camion ne pousse pas la voiture (${hit})`);
  }
  // course : 3 tours à 4 pilotes automatiques sur le tracé de la carte ; tout le monde arrive, personne ne sort ni ne reste bloqué
  const R = newRace(T); let wall = 0, bump = 0;
  while (!R.done && R.t < 900) { stepRace(R, null, H); for (const x of R.cars) { assert(Number.isFinite(x.x) && Math.abs(x.d) <= W, M.id + ' : course, voiture hors piste'); if (x.hit > 3) wall++; if (x.bump > 3) bump++; } }
  assert(R.done, M.id + ' : la course ne se termine pas');
  const lap = t - t1, k = v => Math.round(v * 3.6);
  console.log(`OK  ${M.id.padEnd(7)} ${Math.round(T.len)} m, rayon mini ${rmin | 0} m, tour lancé ${lap.toFixed(1)} s, moyenne ${k(T.len / lap)} km/h, de ${k(vmin)} à ${k(vmax)} km/h, ${hits} chocs, ${slid.toFixed(1)} s de glisse, 0-100 en ${t100.toFixed(1)} s ; en glisse ${tgl.toFixed(1)} s, à fond ${tfond.toFixed(1)} s ; rayon à 60 km/h ${r60.toFixed(0)} m (levé ${r60l.toFixed(0)}), à 180 km/h ${r180.toFixed(0)} m (levé ${r180l.toFixed(0)}), glisse tenue ${dtenue.toFixed(0)}°, rattrapée en ${rat.toFixed(2)} s ; course : ${raceOrder(R).map(x => x.fin.toFixed(0)).join(' / ')} s, ${wall} chocs mur, ${bump} chocs voiture`);
}
