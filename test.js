// node test.js — géométrie du circuit, tour complet au pilote auto, mécanique réaliste, murs, glisse (déclenchement, verrouillage, boost), boîte manuelle, course.
const assert = require('assert');
const THREE = require('./three.min.js');
require('./sim.js');
const T = buildTrack(THREE), { S, n, W } = T, H = 1 / 120;
const run = (c, inp, sec) => { for (let i = 0; i < sec / H; i++) step(c, typeof inp === 'function' ? inp(c) : inp, T, H); };
const I = (steer, gas, brake = 0, hand = false) => ({ steer, gas, brake, hand });

const rmin = 1 / Math.max(...S.map(s => Math.abs(s.k)));
assert(T.surf.every(q => q === SURF.sec), "la bruine de la ville ne doit pas mouiller la route (records)");
assert(rmin > 25, 'rayon mini trop serré: ' + rmin);
for (let i = 0; i < n; i++) for (let j = i + 40; j < n; j++) {
  if (n - j + i < 40) continue;
  assert(Math.hypot(S[i].x - S[j].x, S[i].z - S[j].z) > 2 * W + 8, `la piste se recoupe (${i},${j})`);
}

// tour complet au pilote auto, sans glisser ni toucher
let c = newCar(T), t = 0, hits = 0, vmax = 0, slid = 0;
assert(!T.vert, 'la ville ne déclare ni saut ni mur roulable : le relief ne doit pas y jouer');
while (c.dist < n && t < 180) { step(c, autopilot(c, T), T, H); t += H; assert(!c.air && c.y === sol(T, c), 'ville : la voiture quitte le sol'); if (c.hit > 3) hits++; if (c.drift) slid += H; vmax = Math.max(vmax, Math.hypot(c.vx, c.vz)); assert(Math.abs(c.d) <= W); }
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

assert(tf > t + 3, 'rouler à fond dans les murs doit rester plus lent que freiner: ' + tf);
// frôler le mur en biais gratte (étincelles) mais ne casse pas la vitesse ni ne coupe le moteur
for (const [deg, keep, steer] of [[6, 0.82, 0], [12, 0.72, 0], [6, 0.7, 1]]) { // dernier cas : volant tenu à fond vers le mur
  const c = newCar(T), v = () => Math.hypot(c.vx, c.vz); run(c, I(0, 1), 6);
  const s = S[c.idx], a = deg * Math.PI / 180, th = Math.atan2(s.tz, s.tx) + a, v0 = v(), o = W - 1.3 - c.d; // posée au ras du mur, le nez tourné de `deg` vers lui
  c.x += -s.tz * o; c.z += s.tx * o; c.th = th; c.vx = Math.cos(th) * v0; c.vz = Math.sin(th) * v0;
  let stun = 0, rub = 0; for (let i = 0; i < 120; i++) { step(c, I(steer, 1), T, H); stun = Math.max(stun, c.stun || 0); rub += c.rub; }
  assert(rub > 0, 'frôlement : mur non atteint');
  assert(c.nitro > 0.02, 'frôler le mur doit remplir la jauge de nitro: ' + c.nitro);
  assert(v() > v0 * keep && stun <= 0, `frôlement à ${deg}° trop pénalisé: ${v0.toFixed(1)} -> ${v().toFixed(1)} m/s, coupure ${stun}`);
}

// transfert de charge : à pleine vitesse, volant à fond, la voiture pivote plus vite au frein que sur les gaz, et au moins autant pied levé
const lacet = (gas, brake) => { const c = newCar(T); run(c, I(0, 1), 8); run(c, I(1, gas, brake), 0.3); return c.yaw; };
assert(lacet(0, 1) > 1.15 * lacet(1, 0) && lacet(0, 0) >= lacet(1, 0), `freiner ou lever le pied n'aide pas à tourner: ${lacet(1, 0)} / ${lacet(0, 0)} / ${lacet(0, 1)}`);
// glisse : braquer sans frein à main à vitesse moyenne ne décroche pas
c = newCar(T); run(c, I(0, 1), 4); run(c, I(0.5, 1), 0.4);
assert(!c.drift, 'décrochage sans raison');
// frein à main tenu + volant -> glisse nette, verrouillée dans son sens ; frein à main relâché -> la glisse s'arrête tout de suite, avec un boost si elle a duré (tours en glisse : test-cartes.js)
c = newCar(T); run(c, I(0, 1), 4); run(c, I(1, 1, 0, true), 0.1); run(c, I(-1, 1, 0, true), 0.6); // volant vers l'extérieur : elle ouvre mais continue de tourner du même côté
const beta = Math.atan2(Math.abs(c.vl), Math.abs(c.vf)) * 180 / Math.PI;
assert(c.drift && beta > 8 && beta < 60, 'angle de dérive hors plage: ' + beta);
assert(c.yaw > 0, 'le volant ne doit pas inverser la glisse');
assert(c.nitro > 0.02 && c.nitro < 0.5, 'la glisse tenue doit remplir la jauge de nitro, peu à peu: ' + c.nitro);
{ const j = c.nitro, v = c.vf; run(c, I(0, 1), H); assert(!c.drift && !c.boost && c.nitro === j && c.vf < v + 0.2, 'la sortie de glisse ne doit plus pousser toute seule'); }

// ---------- nitro : une jauge (c.nitro, 0 à 1) que le joueur dépense avec la commande nitro ----------
{
  const droit = (nitro, jauge, sec = 5) => { const c = newCar(T); c.nitro = jauge; run(c, { ...I(0, 1), nitro }, sec); return c; }, ecart = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const sans = droit(false, 1), avec = droit(true, 1), vide = droit(true, 0), temoin = droit(false, 0), mi = droit(true, 1, 1);
  assert(sans.nitro === 1 && ecart(sans, temoin) === 0, "une jauge pleine ne fait rien tant qu'on ne la déclenche pas");
  assert(ecart(vide, temoin) === 0 && !vide.boost, 'nitro sans jauge : aucun effet');
  assert(mi.boost && mi.nitro > 0.3 && mi.nitro < 0.9, 'la jauge doit se vider peu à peu pendant la poussée: ' + mi.nitro);
  assert(avec.nitro === 0 && !avec.boost && avec.dist > sans.dist + 15 && avec.vf > sans.vf + 5, `la nitro doit faire gagner du terrain en ligne droite: ${avec.dist * 2} m contre ${sans.dist * 2} m, ${avec.vf} contre ${sans.vf} m/s`);
  // un choc franc contre le mur vide la jauge
  const c = newCar(T); c.nitro = 1; run(c, I(0, 1), 4);
  const s = S[c.idx], th = Math.atan2(s.tz, s.tx) + 0.9, v0 = c.vf, o = W - 1.3 - c.d; c.x += -s.tz * o; c.z += s.tx * o; c.th = th; c.vx = Math.cos(th) * v0; c.vz = Math.sin(th) * v0;
  let stun = 0; for (let i = 0; i < 60; i++) { step(c, I(0, 1), T, H); stun = Math.max(stun, c.stun); }
  assert(stun > 0 && c.nitro < 0.2, 'un choc franc doit vider la jauge: ' + c.nitro);
}

// ---------- mode Glisse : le score (c.score), les points de la glisse en cours (c.cours) et le multiplicateur d'enchaînement (c.mult), calculés à part de la physique ----------
let glisseTxt;
{
  // en plan ouvert, comme test-cartes.js (sans murs : un seul échantillon de piste, recollé sous la voiture à chaque pas)
  const O = { x: 0, y: 0, z: 0, tx: 1, tz: 0, k: 0, sl: 0 }, TO = { S: [O], n: 1 };
  const go = (c, inp, sec) => { for (let i = 0; i < sec / H; i++) { O.x = c.x; O.z = c.z; const v = Math.hypot(c.vx, c.vz) || 1; O.tx = c.vx / v; O.tz = c.vz / v; step(c, inp, TO, H); } return c; };
  const neuve = () => Object.assign(newCar(T), { idx: 0 });
  // une glisse : lancée `elan` secondes, frein à main tenu `tenue` secondes, puis relâché
  const glisse = (elan, tenue, c = neuve()) => { go(c, I(0, 1), elan); const v = c.vf; go(c, I(1, 1, 0, true), tenue); assert(c.drift, 'glisse de test ratée'); c.v0 = v; c.enCours = c.cours; go(c, I(0, 1), 0.1); return c; };
  const vite = glisse(5, 1.2), lente = glisse(1.6, 1.2);
  assert(neuve().score === 0 && neuve().mult === 1, 'départ : score nul, multiplicateur à 1');
  assert(vite.enCours > 0 && vite.cours === 0 && vite.score >= vite.enCours && vite.score < 1.02 * vite.enCours, `la glisse en cours doit être versée au score quand elle se termine: ${vite.enCours} puis ${vite.score}`);
  assert(lente.score > 0 && vite.score > 1.5 * lente.score, `une glisse rapide (${vite.v0 * 3.6 | 0} km/h : ${vite.score}) doit rapporter bien plus qu'une lente (${lente.v0 * 3.6 | 0} km/h : ${lente.score})`);
  assert(glisse(5, 2).score > 1.5 * vite.score, 'une glisse plus longue doit rapporter plus');
  // enchaînement : chaque glisse validée monte le multiplicateur d'un cran, la suivante rapporte d'autant plus ; quelques secondes sans glisser et il retombe à 1, le score reste
  const deux = glisse(0.5, 1.2, glisse(5, 1.2)), gain2 = deux.score - vite.score;
  assert(vite.mult === 2 && deux.mult === 3 && gain2 > 1.7 * vite.score, `l'enchaînement doit multiplier : x${vite.mult} puis x${deux.mult}, ${vite.score} puis ${gain2} points`);
  const acquis = deux.score; go(deux, I(0, 1), 3.2); assert(deux.mult === 1 && deux.score === acquis, `3 s sans glisser : le multiplicateur doit retomber (x${deux.mult})`);
  // des zigzags à basse vitesse (glisses de 0,4 s, d'un côté puis de l'autre) ne rapportent presque rien
  const zig = neuve(); go(zig, I(0, 1), 1.6); for (let i = 0; i < 16; i++) { go(zig, I(i % 2 ? 1 : -1, 0.5, 0, true), 0.4); go(zig, I(0, 0.5), 0.1); }
  assert(zig.nDrift >= 8 && zig.score < 0.05 * vite.score && zig.mult === 1, `zigzags lents : ${zig.nDrift} glisses, ${zig.score} points, x${zig.mult}`);
  // sur la piste : une glisse validée (x2, partie du bord gauche : elle emmène à droite), puis une glisse qui finit dans le mur : ses points sont perdus et le multiplicateur retombe à 1
  const m = newCar(T); run(m, I(0, 1), 3); { const s = S[m.idx], o = -6 - m.d; m.x += -s.tz * o; m.z += s.tx * o; } run(m, I(1, 1, 0, true), 0.1); run(m, I(-1, 1, 0, true), 0.8); run(m, I(0, 1), 0.1);
  assert(m.mult === 2 && m.score > 0 && !m.nWall, `glisse sur la piste non validée (x${m.mult}, ${m.score} points, ${m.nWall} chocs)`);
  const avant = m.score; let perdu = 0, t = 0; while (!m.nWall && t < 3) { perdu = m.cours; step(m, I(1, 1, 0, true), T, H); t += H; } step(m, I(1, 1, 0, true), T, H);
  assert(m.nWall && perdu > 100 && m.cours < 5 && m.mult === 1 && m.score === avant, `un choc contre le mur doit casser l'enchaînement : x${m.mult}, ${perdu} points en cours avant, ${m.cours} après`);
  glisseTxt = `x2 puis x3 (${gain2 | 0} points la seconde), zigzags lents ${zig.score | 0}, choc : ${perdu | 0} points perdus ; ${vite.score | 0} points pour 1,2 s à ${vite.v0 * 3.6 | 0} km/h, ${lente.score | 0} à ${lente.v0 * 3.6 | 0} km/h`;
}

// boîte manuelle : en 1re la vitesse plafonne au rupteur (8000 tr/min = 72 km/h), et un rétrogradage abusif met en surrégime sans dépasser la zone rouge affichée
c = newCar(T); c.manual = true; run(c, I(0, 1), 6);
assert(c.gear === 0 && c.vf * 3.6 > 62 && c.vf * 3.6 < 76, 'rupteur de 1re mal placé: ' + c.vf * 3.6);

console.log(`OK  longueur ${T.len | 0} m, rayon mini ${rmin | 0} m, tour auto ${t.toFixed(2)} s (à fond sans freiner : ${tf.toFixed(2)} s, ${fh} chocs), vmax ${(vmax * 3.6) | 0} km/h, 0-100 en ${t100.toFixed(1)} s, passages à ${shifts.join(' / ')} km/h, dérive en glisse ${beta | 0}°`);

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
  assert(fin(a) && fin(b) && sep(a, b) > 1.6, 'choc frontal : voitures traversées');
  assert(Math.abs(a.d) <= W && Math.abs(b.d) <= W, 'choc frontal : voiture hors piste');
}
assert(bump > 50, 'choc frontal non signalé: ' + bump);
// contact latéral : deux voitures côte à côte, l'une serre l'autre ; elle la pousse sans l'arrêter
R = newRace(T); [a, b] = R.cars; R.cars.length = 2;
at(a, 60, -1.3, 40); at(b, 60, 1.3, 40); a.vx -= S[60].tz * 3; a.vz += S[60].tx * 3; bump = 0;
for (let i = 0; i < 1 / H; i++) { stepRace(R, I(0.15, 1), H); bump = Math.max(bump, b.bump); assert(sep(a, b) > 1.6, 'contact latéral : voitures imbriquées'); }
assert(bump > 0.5 && b.d > 2.5, 'le contact latéral doit pousser: ' + b.d);
assert(a.vf > 36 && Math.hypot(b.vx, b.vz) > 36, 'le contact latéral ne doit pas arrêter: ' + a.vf);

// aspiration : à vitesse égale, la voiture qui roule dans le sillage d'une autre va plus vite que seule, la rattrape et remplit sa jauge ; à côté, rien ne change. Elle vaut aussi pour les IA
{
  const duo = (lat, avant, inp = I(0, 1)) => { const R = newRace(T, 3, [1]), [a, b] = R.cars; at(a, 40, lat, 60); at(b, 40 + avant, 0, 60); let jmax = 0; for (let i = 0; i < 1.5 / H; i++) { stepRace(R, inp, H); jmax = Math.max(jmax, a.nitro); } a.jmax = jmax; return [a, b]; }; // b roule sur la trajectoire, a à `lat` mètres d'elle
  const [seul] = duo(0, 400), [der, devant] = duo(0, 6), [seulC] = duo(6, 400), [cote] = duo(6, 6), [ia] = duo(0, 6, null);
  assert(der.vf > seul.vf + 0.3 && sep(der, devant) < 11.8 && der.nitro > 0.02, `l'aspiration doit faire rattraper: ${der.vf} m/s contre ${seul.vf} seule, écart ${sep(der, devant)} m, jauge ${der.nitro}`);
  assert(cote.vf === seulC.vf && cote.nitro === 0, `pas d'aspiration à côté: ${cote.vf} m/s contre ${seulC.vf}, jauge ${cote.nitro}`);
  assert(ia.jmax > 0.01, "l'aspiration doit valoir aussi pour une IA");
}

// le tour d'une voiture seule ne doit pas bouger quand on touche à la course (records comparables)
assert(Math.abs(t - 42.58) < 0.01, `le tour solo a changé: ${t} / ${tf}`);
// les 3 niveaux d'IA, seuls : du plus rapide au plus lent, tous derrière le tour propre, à moins de 2 s
const laps = AI_LVL.map(lvl => { const c = newCar(T); let t = 0; while (c.dist < n && t < 180) { step(c, autopilot(c, T, lvl), T, H); t += H; assert(c.hit < 3, 'IA seule dans le mur'); } return t; });
assert(laps.every((l, i) => l > t && l < t + 2 && (!i || l > laps[i - 1] + 0.2)), 'rythme des IA hors plage: ' + laps);

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

// ---------- Tournée : barème 10 / 6 / 3 / 1 par manche, grille dans l'ordre inverse du classement général (voitures désignées par leur indice : 0 = joueur, 1 à 3 = rivaux de la carte) ----------
{
  // avant la première manche : tout le monde à 0, la grille est celle d'une course ordinaire (joueur dernier)
  assert.deepStrictEqual(tournee([0, 0, 0, 0]), { pts: [0, 0, 0, 0], classement: [0, 3, 2, 1], grille: [3, 0, 1, 2] });
  // manche 1 : arrivée rival 2, joueur, rival 3, rival 1
  const m1 = tournee([0, 0, 0, 0], [2, 0, 3, 1]);
  assert.deepStrictEqual(m1, { pts: [6, 1, 10, 3], classement: [2, 0, 3, 1], grille: [2, 0, 3, 1] }); // le meneur (rival 2) part dernier, le dernier (rival 1) en pole
  // manche 2 : le joueur gagne, les points s'ajoutent ; à égalité (16 partout en tête), le joueur est classé devant
  const m2 = tournee(m1.pts, [0, 2, 1, 3]);
  assert.deepStrictEqual(m2, { pts: [16, 4, 16, 4], classement: [0, 2, 3, 1], grille: [3, 0, 2, 1] });
  assert.deepStrictEqual(m1.pts, [6, 1, 10, 3], 'tournee ne doit pas modifier les points reçus');
  // une voiture qui n'est pas à l'arrivée ne marque rien
  assert.deepStrictEqual(tournee([0, 0, 0, 0], [1, 2]).pts, [0, 10, 6, 0]);
  // la course part sur la grille demandée : 8 m entre deux places, en quinconce ; sans grille, rien ne change (joueur dernier)
  const g = newRace(T, 3, AI_LVL, 0, { grille: m2.grille }).cars, d = newRace(T).cars;
  assert.deepStrictEqual(g.map(c => c.dist), [-20, -8, -16, -12], 'grille de la tournée');
  assert.deepStrictEqual(g.map(c => c.pos), [4, 1, 3, 2]);
  assert.deepStrictEqual(d.map(c => c.dist), [-20, -8, -12, -16], 'grille par défaut');
  console.log(`OK  tournée : barème ${BAREME.join(' / ')}, après deux manches ${m2.pts.join(' / ')} points, grille ${m2.grille.join(' ')}`);
}

// ---------- course à élimination : autant de tours que de voitures ; à chaque passage de ligne du meneur à partir de la fin du tour 2, la dernière sort ----------
let elimTxt;
{
  const nom = (R, c) => R.cars.indexOf(c) ? 'IA' + R.cars.indexOf(c) : 'joueur', vivantes = R => R.cars.filter(c => !c.out);
  const E = newRace(T, 3, AI_LVL, 0, { elim: true }), sorties = []; let tetes = 0, pt = 0;
  assert(E.laps === 4 && E.cars.every(c => !c.out), 'élimination : autant de tours que de voitures, toutes en piste au départ');
  while (!E.done && E.t < 400) {
    stepRace(E, null, H);
    const tete = Math.floor(Math.max(...E.cars.map(c => c.dist)) / n); if (tete > pt) { pt = tete; tetes++; }
    for (const c of E.cars) if (c.out && !sorties.includes(c)) {
      sorties.push(c);
      assert(pt >= 2, `élimination : ${nom(E, c)} sort au premier tour (${E.t} s)`);
      assert(c.pos === E.cars.length - sorties.length + 1 && c.dist === Math.min(...[c, ...vivantes(E)].map(x => x.dist)), `élimination : ${nom(E, c)} sort sans être dernière`);
      assert(sorties.length === pt - 1, `élimination : ${sorties.length} sorties après ${pt} passages du meneur`);
    }
    for (const c of E.cars) assert(fin(c) && Math.abs(c.d) <= W, 'élimination : NaN ou voiture hors piste');
  }
  const [gagnant] = vivantes(E);
  assert(E.done && sorties.length === 3 && vivantes(E).length === 1 && gagnant.fin && gagnant.dist >= 4 * n, `élimination non terminée (${sorties.length} sorties, ${E.t} s)`);
  assert.deepStrictEqual(raceOrder(E), [gagnant, ...sorties.reverse()], "élimination : le classement final doit être l'ordre inverse des sorties");
  raceOrder(E).forEach((c, i) => assert(c.pos === i + 1));
  // la voiture sortie se range : elle ralentit, ne touche plus personne, et le pilote automatique des autres ne s'en occupe plus
  const der = sorties[2], ts = der.out; while (E.t < ts + 6) { stepRace(E, null, H); assert(!der.bump && Math.abs(der.d) <= W); }
  assert(Math.hypot(der.vx, der.vz) < 3 && Math.abs(der.d) > 3, `élimination : la voiture sortie doit se ranger sur le côté (${Math.hypot(der.vx, der.vz)} m/s, à ${der.d} m de l'axe)`);
  const R2 = newRace(T, 3, [1], 0, { elim: true }), [p, q] = R2.cars; at(p, 60, 0, 40); at(q, 62, 0, 0); q.out = 1; for (let i = 0; i < 1 / H; i++) { stepRace(R2, I(0, 1), H); assert(!p.bump, 'une voiture sortie ne doit plus gêner'); }
  // un joueur qui ne touche à rien : épargné au premier passage du meneur, sorti au deuxième ; la course se finit sans lui
  const F = newRace(T, 3, AI_LVL, 0, { elim: true }); let passages = 0, pp = 0, vu = 0;
  while (!F.done && F.t < 400) { stepRace(F, I(0, 0), H); const k = Math.floor(Math.max(...F.cars.map(c => c.dist)) / n); if (k > pp) { pp = k; passages++; } if (F.cars[0].out && !vu) vu = passages; }
  assert(vu === 2 && F.done && F.cars[0].pos === 4 && !F.cars[0].fin, `élimination : joueur immobile sorti au passage ${vu} du meneur`);
  elimTxt = `${E.laps} tours, sorties à ${sorties.reverse().map(c => nom(E, c) + ' ' + c.out.toFixed(2)).join(', ')} s, vainqueur ${nom(E, gagnant)} en ${gagnant.fin.toFixed(2)} s`;
}

// --- fantôme des médailles : la trace du tour de référence (pilote automatique, jauge pleine), ralentie au ratio de la médaille ---
// une trace = [x, y, z, cap, …] à 20 Hz. Ralentie de 10 %, elle passe aux mêmes endroits 10 % plus tard, et finit au même point
// ---------- relief : sauts, réceptions, murs roulables (sur la carte du barrage, qui les déclare) ----------
{
  const ref = tourRef(T), tr = ref.trace, pts = tr.length / 4, d = (a, i, b, j) => Math.hypot(a[i * 4] - b[j * 4], a[i * 4 + 2] - b[j * 4 + 2]);
  assert(ref.t > 30 && ref.t < 40 && Math.abs((pts - 1) / 20 - ref.t) < 0.06, `tour de référence : ${ref.t} s pour ${pts} points à 20 Hz`);
  assert(Math.hypot(tr[0] - S[0].x, tr[2] - S[0].z) < 5 && d(tr, 0, tr, pts - 1) < 5, 'la trace de référence ne part pas de la ligne ou n\'y revient pas');
  const br = etire(tr, 1.1), nb = br.length / 4;
  assert(Math.abs((nb - 1) / 20 - 1.1 * ref.t) < 0.11, `fantôme bronze : ${(nb - 1) / 20} s au lieu de ${1.1 * ref.t}`);
  assert(d(br, 110, tr, 100) < 1e-6 && d(br, 220, tr, 200) < 1e-6 && d(br, nb - 1, tr, pts - 1) < 5 && d(br, 55, tr, 50) < 1e-6, 'fantôme bronze : pas aux mêmes endroits 10 % plus tard');
  const vite = etire(tr, 0.5); assert(d(vite, 50, tr, 100) < 1e-6 && Math.abs(vite.length / 4 - pts / 2) <= 1, 'trace accélérée : deux fois plus courte');
  // le cap tourne par le plus court : entre 3,1 et -3,1 rad on passe par pi, pas par zéro
  const cap = etire([0, 0, 0, 3.1, 1, 0, 0, -3.1], 2)[7]; assert(Math.abs(Math.abs(cap) - Math.PI) < 0.05, 'cap interpolé par le mauvais côté : ' + cap);
  var fantTxt = `référence ${ref.t.toFixed(2)} s (${pts} points), bronze ${((nb - 1) / 20).toFixed(2)} s`;
  // --- défi par lien : le fragment porte version, carte, temps et positions à 5 Hz ; aller-retour à la précision de quantification (10 cm, 1,5°) ---
  {
    const lien = defiCode('ville', ref.t, tr), lu = defiLit(lien), w = a => Math.atan2(Math.sin(a), Math.cos(a));
    assert(/^\d+\.ville\.[A-Za-z0-9_-]+$/.test(lien), 'lien de défi : caractères hors URL : ' + lien.slice(0, 40));
    assert(!lu.err && lu.carte === 'ville' && Math.abs(lu.t - ref.t) < 0.001, 'lien de défi relu : ' + JSON.stringify(lu).slice(0, 80));
    // un point sur quatre de la trace (5 Hz) est rendu à la quantification près ; entre deux, la trace relue suit l'originale à moins d'un mètre
    let e5 = 0, ea = 0, e20 = 0; const nl = lu.trace.length / 4;
    assert(nl > pts - 4 && nl <= pts, `trace relue : ${nl} points pour ${pts}`);
    for (let i = 0; i < nl; i++) { const e = Math.max(Math.abs(lu.trace[i * 4] - tr[i * 4]), Math.abs(lu.trace[i * 4 + 1] - tr[i * 4 + 1]), Math.abs(lu.trace[i * 4 + 2] - tr[i * 4 + 2])); e20 = Math.max(e20, e);
      if (i % 4 === 0) { e5 = Math.max(e5, e); ea = Math.max(ea, Math.abs(w(lu.trace[i * 4 + 3] - tr[i * 4 + 3]))); } }
    assert(e5 <= 0.05 + 1e-9 && ea <= Math.PI / 256 + 1e-9 && e20 < 1, `aller-retour : ${e5} m et ${ea} rad aux points transmis, ${e20} m entre deux`);
    fantTxt += ` ; lien de défi ${lien.length} caractères pour ${ref.t.toFixed(1)} s, écart ${(e5 * 100).toFixed(0)} cm aux points transmis, ${(e20 * 100).toFixed(0)} cm entre deux`;
  }
}

{
  globalThis.CARTE = CARTES.find(m => m.id === 'barrage'); delete require.cache[require.resolve('./sim.js')]; require('./sim.js');
  const T = buildTrack(THREE), { S, n } = T, G = 9.81, v = c => Math.hypot(c.vx, c.vz), near = p => S.reduce((b, s, i) => Math.hypot(s.x - p[0], s.z - p[1]) < Math.hypot(S[b].x - p[0], S[b].z - p[1]) ? i : b, 0);
  const pose = (i, d, sp) => { const c = newCar(T), s = S[i]; Object.assign(c, { x: s.x - s.tz * d, z: s.z + s.tx * d, idx: i, dist: i, d, th: Math.atan2(s.tz, s.tx), vx: s.tx * sp, vz: s.tz * sp }); c.y = sol(T, c); return c; };
  assert(T.vert, 'le barrage doit activer le relief');
  // un saut : lancée sur le tremplin, la voiture décolle au bout, suit une parabole (chute libre), ne répond ni au volant ni aux gaz, et se repose sans jamais passer sous le sol
  const [p1, , , ] = CARTE.sauts[0], lip = near(CARTE.pts[p1]);
  const saut = sp => { const c = pose(lip - 40, 0, sp); let t = 0, dec = null, vol = null, hmax = 0;
    while (t < 6 && !(vol && !c.air && c.idx > lip + 5)) { const th = c.th, sp0 = v(c), av = c.air; step(c, I(dec ? 1 : 0, dec ? 1 : 0.6), T, H); t += H;
      assert(c.y >= sol(T, c) - 1e-9, 'la voiture passe sous le sol');
      if (c.air && !dec) dec = { t, x: c.x, z: c.z, y: c.y, vy: c.vy, v: v(c), i: c.idx };
      if (c.air) { hmax = Math.max(hmax, c.y - sol(T, c)); assert(!av || (c.th === th && v(c) <= sp0), 'en l\'air, le volant ou les gaz agissent encore');
        assert(Math.abs(c.y - (dec.y + dec.vy * (t - dec.t) - G * (t - dec.t) ** 2 / 2)) < 0.1, 'le vol n\'est pas une chute libre'); }
      if (dec && !vol && c.land) vol = { t: t - dec.t, d: Math.hypot(c.x - dec.x, c.z - dec.z), land: c.land, v0: sp0, v1: v(c) }; }
    assert(dec && vol && Math.abs(dec.i - lip) <= 2, `pas de décollage au bout du tremplin à ${sp} m/s`);
    assert(Math.abs(vol.d / (dec.v * vol.t) - 1) < 0.03, `portée ${vol.d} m incohérente avec ${dec.v} m/s pendant ${vol.t} s`);
    assert(vol.land > 0 && (vol.land > 6 ? vol.v1 < vol.v0 : vol.v1 > 0.99 * vol.v0) && vol.v1 > 0.5 * vol.v0, `réception : impact ${vol.land} m/s, ${vol.v0} -> ${vol.v1} m/s`);
    return { ...vol, hmax }; };
  const s30 = saut(30), s45 = saut(45), s60 = saut(60);
  assert(s30.d > 8 && s45.d > 1.3 * s30.d && s60.d > 1.2 * s45.d && s60.d < 140, `la portée doit croître avec la vitesse: ${s30.d} / ${s45.d} / ${s60.d} m`);
  // pas de nitro en l'air : déclenchée en vol, elle ne pousse pas et la jauge ne bouge pas ; elle repart une fois les roues au sol
  { const c = pose(lip - 40, 0, 45); c.nitro = 1; let t = 0, enVol = 0;
    while (t < 6 && !(enVol && !c.air)) { const sp0 = v(c), j = c.nitro, av = c.air; step(c, { ...I(0, 1), nitro: av }, T, H); t += H; if (av) { enVol++; assert(c.nitro === j && v(c) <= sp0 && !c.boost, "la nitro agit en l'air"); } }
    assert(enVol > 30 && c.nitro === 1, "vol trop court pour juger la nitro en l'air");
    const j = c.nitro; for (let i = 0; i < 30; i++) step(c, { ...I(0, 1), nitro: true }, T, H); assert(c.nitro < j, 'au sol, la nitro doit repartir'); }
  // le tremplin du déversoir : lancée, la voiture passe la fosse ; trop lente, elle tombe dedans, perd du temps, mais en ressort seule par la rampe
  const [p2, , , F] = CARTE.sauts[1], lip2 = near(CARTE.pts[p2]), bout = lip2 + F / 2, fosse = sp => { const c = pose(lip2 - 30, 0, sp); let t = 0, fond = 0, hit = 0, i1 = 0;
    while (c.idx < bout + 60 && t < 30) { step(c, I(0, 1), T, H); t += H; hit = Math.max(hit, c.hit); if (c.land) { i1 = i1 || c.idx; if (c.idx < bout) fond++; } }
    return { t, fond, hit, i1, tref: (bout + 60 - lip2 + 30) * 2 / sp }; };
  const ok = fosse(55), rate = fosse(22);
  assert(!ok.fond && ok.i1 >= bout, `à 200 km/h la fosse doit être franchie (réception à l'échantillon ${ok.i1}, fosse jusqu'à ${bout})`);
  assert(rate.fond && rate.t < 30 && !rate.hit, `à 80 km/h on doit tomber dans la fosse et en ressortir sans mur (${rate.fond} réceptions au fond, ${rate.t} s)`);
  assert(rate.t > ok.t + 1.5, `le saut raté doit coûter du temps: ${rate.t} s contre ${ok.t} s`);
  // mur roulable : sans toucher au volant dans le grand virage, la voiture monte sur la paroi à haute vitesse et y reste plaquée (pas de vol) ; posée dessus à basse vitesse, elle redescend sur le plat
  const iC = S.reduce((b, s, i) => s.rc && Math.abs(s.k) > Math.abs(S[b].k) ? i : b, 0), sC = S[iC], ext = -Math.sign(sC.k);
  assert(sC.rc && sC.w > sC.pl + 6, 'pas de mur roulable dans le virage le plus serré');
  c = pose(iC - 25, 0, 55); let haut = 0, vola = 0; for (let i = 0; i < 1.2 / H; i++) { step(c, I(0, 1), T, H); haut = Math.max(haut, c.y - S[c.idx].y); if (c.air) vola++; }
  assert(haut > 2 && c.d * ext > sC.pl + 3 && !vola, `à 200 km/h la voiture doit monter sur la paroi (hauteur ${haut} m, écart ${c.d} m, ${vola} pas en l'air)`);
  c = pose(iC - 10, ext * (sC.pl + 6), 6); const h0 = c.y - S[c.idx].y; for (let i = 0; i < 4 / H; i++) step(c, I(0, 0), T, H);
  assert(h0 > 2 && Math.abs(c.d) < S[c.idx].pl + 1 && c.y - S[c.idx].y < 0.2, `à 20 km/h la voiture doit redescendre de la paroi (de ${h0} m à ${c.y - S[c.idx].y} m, écart ${c.d} m)`);
  // le mur est plus rapide que la corde : un pilote qui vise les deux tiers de la paroi, gaz à fond, bat le tour propre du pilote automatique (qui reste sur le plat), sans choc
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a)), murP = c => { const a = autopilot(c, T), sp = v(c), la = S[(c.idx + 3 + Math.floor(sp * 0.1)) % n]; if (!la.rc || la.w < la.pl + 4) return a;
    const off = -(la.pl + (la.w - 1.1 - la.pl) * 0.7) * Math.sign(la.k || 1), e = wrap(Math.atan2(la.z + la.tx * off - c.z, la.x - la.tz * off - c.x) - c.th); return I(Math.max(-1, Math.min(1, e * 3)), 1); };
  const tour = drive => { const c = newCar(T); let t = 0, t1 = 0, h = 0, vmin = 1e9, ymax = 0, vols = 0; while (c.dist < 2 * n && t < 300) { const a = c.air; step(c, drive(c), T, H); t += H; if (!t1 && c.dist >= n) t1 = t;
    if (t1) { if (c.hit > 3) h++; if (c.air && !a) vols++; if (S[c.idx].rc && !c.air) { vmin = Math.min(vmin, v(c)); ymax = Math.max(ymax, c.y - S[c.idx].y); } } } return { t: t - t1, h, vmin, ymax, vols }; };
  const propre = tour(c => autopilot(c, T)), parMur = tour(murP);
  assert(propre.vols === CARTE.sauts.length + 1 && !propre.h && propre.ymax < 0.5, `tour propre : ${propre.vols} vols (2 tremplins et la bosse), ${propre.h} chocs, ${propre.ymax} m sur la paroi`);
  assert(!parMur.h && parMur.ymax > 3 && parMur.t < propre.t - 0.5 && parMur.vmin > 1.2 * propre.vmin, `le mur doit être plus rapide que la corde: ${parMur.t} s contre ${propre.t} s`);
  // pas de choc entre deux voitures à des hauteurs différentes : l'une survole l'autre
  const croise = dy => { const R = newRace(T), [a, b] = R.cars; R.cars.length = 2; for (const [c, i, sp] of [[a, 300, 40], [b, 303, 0]]) Object.assign(c, pose(i, 0, sp), { lvl: 1, pos: 1, lap: 1, fin: 0, bump: 0 });
    a.y += dy; a.air = dy > 0; a.airT = dy > 0 ? H : 0; let bump = 0; for (let i = 0; i < 0.25 / H; i++) { stepRace(R, I(0, 0), H); bump = Math.max(bump, a.bump); } return bump; };
  assert(croise(0) > 10 && croise(3) === 0, `choc entre voitures : ${croise(0)} à la même hauteur, ${croise(3)} avec 3 m d'écart`);
  console.log(`OK  relief (barrage) : sauts à 108 / 162 / 216 km/h = ${s30.d.toFixed(0)} / ${s45.d.toFixed(0)} / ${s60.d.toFixed(0)} m (${s60.t.toFixed(2)} s, ${s60.hmax.toFixed(1)} m de haut, impact ${s60.land.toFixed(1)} m/s), fosse franchie en ${ok.t.toFixed(1)} s, ratée en ${rate.t.toFixed(1)} s ; virage relevé : propre ${propre.t.toFixed(2)} s (mini ${(propre.vmin * 3.6) | 0} km/h), par le mur ${parMur.t.toFixed(2)} s (mini ${(parMur.vmin * 3.6) | 0} km/h, ${parMur.ymax.toFixed(1)} m de haut)`);
}
console.log(`OK  course : IA seules ${laps.map(l => l.toFixed(2)).join(' / ')} s au tour (niveaux ${AI_LVL.join(' / ')}), dépassement en ${tpass.toFixed(1)} s, 3 tours à 4 IA : ${arr.map(c => R0(c) + ' ' + c.fin.toFixed(2)).join(', ')} (${walls} chocs mur, ${bumps} chocs voiture)`);
console.log(`OK  élimination : ${elimTxt}`);
console.log(`OK  glisse : ${glisseTxt}`);
console.log(`OK  fantôme des médailles : ${fantTxt}`);
