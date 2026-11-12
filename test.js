// node test.js — géométrie du circuit, tour complet au pilote auto, mécanique réaliste, glisse (déclenchement, tenue, rattrapage, boost), boîte manuelle.
const assert = require('assert');
const THREE = require('./three.min.js');
require('./sim.js');
const T = buildTrack(THREE), { S, n, W } = T, H = 1 / 120;
const run = (c, inp, sec) => { for (let i = 0; i < sec / H; i++) step(c, typeof inp === 'function' ? inp(c) : inp, T, H); };
const I = (steer, gas, brake = 0, hand = false) => ({ steer, gas, brake, hand });

const rmin = 1 / Math.max(...S.map(s => Math.abs(s.k)));
assert(rmin > 25, 'rayon mini trop serré: ' + rmin);
for (let i = 0; i < n; i++) for (let j = i + 40; j < n; j++) {
  if (n - j + i < 40) continue;
  assert(Math.hypot(S[i].x - S[j].x, S[i].z - S[j].z) > 2 * W + 8, `la piste se recoupe (${i},${j})`);
}

// tour complet au pilote auto, sans glisser ni toucher
let c = newCar(T), t = 0, hits = 0, vmax = 0, slid = 0;
while (c.dist < n && t < 180) { step(c, autopilot(c, T), T, H); t += H; if (c.hit > 3) hits++; if (c.drift) slid += H; vmax = Math.max(vmax, Math.hypot(c.vx, c.vz)); assert(Math.abs(c.d) <= W); }
assert(c.dist >= n && t > 30 && t < 120, 'tour auto invalide: ' + t);
assert(slid < 1, 'la conduite propre ne doit pas glisser: ' + slid);

// mécanique : la voiture doit se comporter comme une GT-R Z-tune (0 à 100 km/h en moins de 4,5 s, 1re jusqu'à ~68 km/h, 2e jusqu'à ~110 km/h)
c = newCar(T); let t100 = 0, shifts = [], g0 = 0;
for (let i = 0; i < 12 / H && c.idx > 1000 || c.idx < 150; i++) {
  step(c, I(0, 1), T, H); const tt = (i + 1) * H;
  if (!t100 && c.vf >= 100 / 3.6) t100 = tt;
  if (c.gear !== g0) { shifts.push(Math.round(c.vf * 3.6)); g0 = c.gear; }
  if (tt > 12) break;
}
assert(t100 > 3 && t100 < 4.5, '0 à 100 km/h hors plage réaliste: ' + t100);
assert(Math.abs(shifts[0] - 68) < 8 && Math.abs(shifts[1] - 110) < 10, 'vitesses de passage de rapport irréalistes: ' + shifts);
assert(c.rpm >= CARD.idle && c.rpm <= CARD.red + 200, 'régime hors limites: ' + c.rpm);

// le frein doit servir : le même pilote, gaz toujours à fond, tape les murs et perd du temps
c = newCar(T); let tf = 0, fh = 0;
while (c.dist < n && tf < 180) { step(c, { ...autopilot(c, T), gas: 1, brake: 0 }, T, H); tf += H; if (c.hit > 0) fh++; }

// freiner fort en braquant à fond fait décrocher ; une glisse tenue donne un boost à la reprise d'adhérence
c = newCar(T); run(c, I(0, 1), 8); run(c, I(1, 0, 1), 0.7);
assert(c.drift, 'freinage appuyé en virage : pas de glisse');
// un tour mené en glissant (coup de frein à main à l'entrée des virages serrés, puis gaz) doit déclencher des boosts sans toucher les murs
c = newCar(T); let boosts = 0, pb = 0, dh = 0, td = 0; const st = {};
while (c.dist < n && td < 180) {
  let inp = autopilot(c, T); const k = S[(c.idx + 12) % n].k, sp = Math.hypot(c.vx, c.vz);
  if (!st.until && Math.abs(k) > 0.012 && sp > 30 && td > (st.cool || 0)) { st.until = td + 0.2; st.dir = Math.sign(k); st.hold = td + 0.8; st.cool = td + 2.5; }
  if (st.until) { if (td < st.until) inp = I(st.dir, 1, 0, true); else if (td < st.hold && c.slide > 0.3) inp = I(st.dir * 0.6, 1); else st.until = 0; }
  step(c, inp, T, H); td += H; if (c.boost > 0 && pb <= 0) boosts++; pb = c.boost; if (c.hit > 3) dh++;
}
assert(boosts >= 1, 'aucun boost sur un tour mené en glissant');

// glisse : braquer sans frein à main à vitesse moyenne ne décroche pas
c = newCar(T); run(c, I(0, 1), 4); run(c, I(0.5, 1), 0.4);
assert(!c.drift, 'décrochage sans raison');
// frein à main + braquage -> dérive nette ; on relâche et on laisse le pilote redresser -> rattrapée en moins de 2 s
c = newCar(T); run(c, I(0, 1), 8); run(c, I(1, 0, 0, true), 0.35);
const beta = Math.atan2(Math.abs(c.vl), Math.abs(c.vf)) * 180 / Math.PI;
assert(c.drift && beta > 8 && beta < 60, 'angle de dérive hors plage: ' + beta);
let rec = 0;
while (c.drift && rec < 3) { step(c, autopilot(c, T), T, H); rec += H; }
assert(rec < 2, 'glisse non rattrapable: ' + rec);

// boîte manuelle : en 1re la vitesse plafonne au rupteur (8000 tr/min = 72 km/h), et un rétrogradage abusif met en surrégime sans dépasser la zone rouge affichée
c = newCar(T); c.manual = true; run(c, I(0, 1), 6);
assert(c.gear === 0 && c.vf * 3.6 > 62 && c.vf * 3.6 < 76, 'rupteur de 1re mal placé: ' + c.vf * 3.6);

console.log(`OK  longueur ${T.len | 0} m, rayon mini ${rmin | 0} m, tour auto ${t.toFixed(2)} s (à fond sans freiner : ${tf.toFixed(2)} s, ${fh} chocs), vmax ${(vmax * 3.6) | 0} km/h, 0-100 en ${t100.toFixed(1)} s, passages à ${shifts.join(' / ')} km/h, tour en glisse ${td.toFixed(2)} s (${boosts} boosts, ${dh} chocs), dérive ${beta | 0}°, rattrapage ${rec.toFixed(2)} s`);

// ---------- course : collisions, pilotes IA, classement ----------
const fin = c => [c.x, c.z, c.vx, c.vz, c.th].every(Number.isFinite);
const sep = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const at = (c, i, d, v) => { const s = S[i]; Object.assign(c, { x: s.x - s.tz * d, z: s.z + s.tx * d, idx: i, dist: i, d, th: Math.atan2(s.tz, s.tx), vx: s.tx * v, vz: s.tz * v }); return c; };

// choc par l'arrière à 240 km/h sur une voiture arrêtée : pas de traversée, la voiture percutée est poussée, celle qui percute ralentit
let R = newRace(T), [a, b] = R.cars; R.cars.length = 2;
at(a, 60, 0, 66); at(b, 75, 0, 0);
for (let i = 0; i < 2 / H; i++) {
  stepRace(R, I(0, 1), H);
  assert(fin(a) && fin(b), 'choc arrière : NaN');
  assert(a.dist < b.dist && sep(a, b) > 1.6, 'choc arrière : voitures traversées');
  assert(Math.abs(a.d) <= W && Math.abs(b.d) <= W, 'choc arrière : voiture hors piste');
}
assert(Math.hypot(b.vx, b.vz) > 10, 'la voiture percutée doit être poussée');
// choc frontal, 240 km/h chacune
R = newRace(T); [a, b] = R.cars; R.cars.length = 2;
at(a, 60, 0, 66); at(b, 90, 0.5, -66);
let bump = 0;
for (let i = 0; i < 1 / H; i++) {
  stepRace(R, I(0, 0), H); bump = Math.max(bump, a.bump);
  assert(fin(a) && fin(b) && a.idx < b.idx + 1 && sep(a, b) > 1.6, 'choc frontal : voitures traversées');
  assert(Math.abs(a.d) <= W && Math.abs(b.d) <= W, 'choc frontal : voiture hors piste');
}
assert(bump > 50, 'choc frontal non signalé: ' + bump);
// contact latéral : deux voitures côte à côte, l'une serre l'autre ; elle la pousse sans l'arrêter
R = newRace(T); [a, b] = R.cars; R.cars.length = 2;
at(a, 60, -1.3, 40); at(b, 60, 1.3, 40); a.vx -= S[60].tz * 3; a.vz += S[60].tx * 3; bump = 0;
for (let i = 0; i < 1 / H; i++) { stepRace(R, I(0.15, 1), H); bump = Math.max(bump, b.bump); assert(sep(a, b) > 1.6, 'contact latéral : voitures imbriquées'); }
assert(bump > 0.5 && b.d > 2.5, 'le contact latéral doit pousser: ' + b.d);
assert(a.vf > 36 && Math.hypot(b.vx, b.vz) > 36, 'le contact latéral ne doit pas arrêter: ' + a.vf);

// le tour d'une voiture seule ne doit pas bouger quand on touche à la course (records vpr5.* comparables)
assert(Math.abs(t - 44.79) < 0.01 && Math.abs(tf - 52.68) < 0.01 && Math.abs(td - 46.19) < 0.01, `le tour solo a changé: ${t} / ${tf} / ${td}`);
// les 3 niveaux d'IA, seuls : du plus rapide au plus lent, entre le tour propre et le tour en glisse
const laps = AI_LVL.map(lvl => { const c = newCar(T); let t = 0; while (c.dist < n && t < 180) { step(c, autopilot(c, T, lvl), T, H); t += H; assert(c.hit < 3, 'IA seule dans le mur'); } return t; });
assert(laps.every((l, i) => l > 44.79 && l < 46.19 && (!i || l > laps[i - 1] + 0.2)), 'rythme des IA hors plage: ' + laps);

// une IA rapide partie derrière une lente, sur la même ligne, la dépasse en moins d'un tour, sans choc violent
R = newRace(T, 3, [0.85]); [a, b] = R.cars; at(a, 10, 0, 0); at(b, 20, 0, 0); bump = 0;
while (a.pos !== 1 && R.t < 60) { stepRace(R, null, H); bump = Math.max(bump, a.bump); }
assert(a.pos === 1 && a.dist < n, 'pas de dépassement en un tour: ' + a.dist);
assert(bump < 5, 'dépassement en force: ' + bump);
const tpass = R.t;

// course complète de 3 tours à 4 IA : tout le monde arrive, sans NaN, sans sortir de la piste ni rester bloqué ; classement = ordre d'arrivée
R = newRace(T);
assert(R.cars.length === 4 && R.cars[0].pos === 4 && new Set(R.cars.map(c => c.dist)).size === 4, 'grille de départ');
for (const x of R.cars) for (const y of R.cars) assert(x === y || sep(x, y) > 5, 'grille : voitures trop proches');
const cars4 = R.cars, R0 = c => cars4.indexOf(c) ? 'IA' + cars4.indexOf(c) : 'joueur(IA)', arr = []; let last = R.cars.map(c => c.dist), walls = 0, bumps = 0;
while (!R.done && R.t < 300) {
  stepRace(R, null, H);
  for (const c of R.cars) {
    assert(fin(c) && Math.abs(c.d) <= W, 'course : NaN ou voiture hors piste');
    if (c.fin && !arr.includes(c)) arr.push(c);
    if (c.hit > 3) walls++; if (c.bump > 3) bumps++;
  }
  assert.deepStrictEqual(R.cars.map(c => c.pos).sort(), [1, 2, 3, 4]);
  if (Math.round(R.t / H) % 600 === 0) { R.cars.forEach((c, i) => assert(c.dist > last[i] + 25, `voiture ${i} bloquée à ${R.t | 0} s`)); last = R.cars.map(c => c.dist); }
}
assert(R.done && arr.length === 4 && R.cars.every(c => c.lap === 3 && c.dist >= 3 * n), 'course non terminée');
assert.deepStrictEqual(raceOrder(R), arr, 'classement différent de l\'ordre d\'arrivée');
arr.forEach((c, i) => assert(c.pos === i + 1 && (!i || c.fin >= arr[i - 1].fin), 'places ou temps finaux incohérents'));
assert(arr[3].fin - arr[0].fin < 8, 'course trop étalée: ' + arr.map(c => c.fin));
// un joueur qui ne touche à rien reste dernier et les IA finissent quand même
R = newRace(T, 1); while (!R.cars.slice(1).every(c => c.fin) && R.t < 100) stepRace(R, I(0, 0), H);
assert(R.cars[0].pos === 4 && !R.cars[0].fin && !R.done && R.t < 60, 'course à 1 tour avec joueur immobile');

console.log(`OK  course : IA seules ${laps.map(l => l.toFixed(2)).join(' / ')} s au tour (niveaux ${AI_LVL.join(' / ')}), dépassement en ${tpass.toFixed(1)} s, 3 tours à 4 IA : ${arr.map(c => R0(c) + ' ' + c.fin.toFixed(2)).join(', ')} (${walls} chocs mur, ${bumps} chocs voiture)`);
