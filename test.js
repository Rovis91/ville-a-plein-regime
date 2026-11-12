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
