// node test-session.js — le déroulé d'une partie (session.js) sans navigateur : tour bouclé et record, Glisse, deux humains à l'arrivée, manche de Tournée.
// Les records et préférences passent par des objets ordinaires à la place de localStorage.
const assert = require('assert'), THREE = require('./three.min.js');
require('./sim.js'); require('./session.js');
const M = CARTE, T = buildTrack(THREE, M), N = T.n, H = 1 / 120, REFT = tourRef(T, H), MED = M.med || [1.1, 1.03, 0.97];
const memoire = () => { const o = {}; return { o, get: k => k in o ? JSON.parse(o[k]) : null, set: (k, v) => { o[k] = JSON.stringify(v); } }; };
const reglages = () => { const o = {}; return { o, get: (k, d) => k in o ? o[k] : d, set: (k, v) => { o[k] = String(v); } }; };
const session = (store = memoire(), prefs = reglages(), auto = false) => nouvelleSession({ T, carte: M, cartes: CARTES, store, prefs, auto, defi: null, ref: REFT, med: MED });

// ---------- contre-la-montre : tour bouclé, record, secteurs, fantôme des médailles ----------
{
  const store = memoire(), S = session(store);
  assert(S.start({ mode: 'solo', diff: 1 }) === null && S.best === 0 && S.fant === 2, 'contre-la-montre : pas de course, pas de record, fantôme bronze au départ');
  const car = newCar(T);
  let ev = S.pas(car, H); assert(!ev.tour && !S.raceEnd && S.tRace === H);
  car.dist = T.sp[0]; let sp = S.enregistre(car, 0); assert(sp && sp.i === 0 && sp.d === null, 'premier secteur, sans record à comparer');
  assert(S.enregistre(car, 0) === null, 'un secteur ne se franchit qu’une fois');
  car.dist = N; ev = S.pas(car, REFT.t * 1.05 - H); // tour à 105 % de la référence : bronze, pas argent
  assert(ev.tour && ev.tour.rec && ev.tour.first && ev.tour.n === 1 && Math.abs(ev.tour.t - REFT.t * 1.05) < 1e-9, 'premier tour : record');
  assert(ev.fantome && S.fant === 3 && store.get('fantome') === 3, 'bronze battu : le fantôme passe à l’argent');
  assert(store.get('best') === S.best && store.get('splits')[0] === H && store.get('ghost').length > 0, 'record, secteurs et fantôme enregistrés');
  assert(S.lapN === 2 && S.tRace === 0 && car.dist === 0 && S.dernier.t === S.best, 'le chrono repart pour un tour lancé');
  car.dist = T.sp[0]; sp = S.enregistre(car, 0); assert(Math.abs(sp.d + H) < 1e-9, 'secteur comparé au record'); // ici au temps 0, le record y passait à H
  car.dist = N; ev = S.pas(car, REFT.t * 1.2);
  assert(!ev.tour.rec && Math.abs(ev.tour.diff - REFT.t * 0.15) < 1e-9 && !ev.fantome && S.fant === 3 && S.lapN === 3, 'tour plus lent : ni record ni changement de fantôme');
  const R = session(store); assert(R.best === S.best && R.fant === 3 && R.traceF().length > 0, 'la carte suivante relit record et fantôme');
  R.choixF(1); assert.deepStrictEqual(R.traceF(), store.get('ghost'), 'fantôme du record');
  const A = session(memoire(), reglages(), true); A.start({ mode: 'solo', diff: 1 }); const ca = newCar(T); ca.dist = N; A.pas(ca, 40);
  assert(A.best === 40 && A.fant === 2, 'pilote automatique : record en mémoire, rien d’enregistré ni de fantôme changé');
}

// ---------- Glisse seul : deux tours, score compté dans le délai ----------
{
  const store = memoire(), S = session(store), car = newCar(T);
  S.start({ mode: 'glisse', diff: 1 }); car.score = 1234.4; car.manual = true; car.dist = 2 * N;
  let ev = S.pas(car, S.GLT - 1); assert(ev.glisse && ev.fin && S.raceEnd && S.glFin.valide && S.glFin.rec && S.glFin.score === 1234 && store.get('glisse') === 1234 && !car.manual, 'Glisse : record dans le délai');
  S.start({ mode: 'glisse', diff: 1 }); car.score = 5000; ev = S.pas(car, S.GLT + 1);
  assert(ev.glisse && !S.glFin.valide && !S.glFin.rec && S.bestG === 1234, 'Glisse : hors délai, le score ne compte pas');
}

// ---------- deux humains : chacun sa fin, la course finie quand les deux le sont ----------
{
  const S = session(), R = S.start({ mode: 'course', diff: 1, nj: 2, ia: true });
  assert(R && R.h === 2 && R.cars.length === 4, 'à deux : deux humains et deux rivaux');
  for (const c of R.cars) c.manual = true;
  R.cars[1].fin = 50; R.cars[1].pos = 1; let ev = S.pas(R.cars[0], H);
  assert.deepStrictEqual(ev.arrives, [1]); assert(!ev.fin && !S.raceEnd && !R.cars[1].manual && R.cars[0].manual, 'le joueur 2 arrive, le joueur 1 roule encore');
  ev = S.pas(R.cars[0], H); assert(!ev.arrives.length, 'une arrivée ne compte qu’une fois');
  R.cars[0].fin = 61; ev = S.pas(R.cars[0], H);
  assert(ev.arrives[0] === 0 && ev.fin && S.raceEnd && S.tRace === 61, 'les deux arrivés : course finie, au temps du joueur 1');
  // Glisse en duel : le délai passé, un joueur encore en piste a fini, score nul
  const D = S.start({ mode: 'glisse', diff: 1, nj: 2, duel: true }); assert(D.delai === S.GLT && D.cars.length === 2 && !S.raceEnd, 'duel : délai du solo, nouvelle course');
  D.cars[0].fin = 30; D.cars[0].pts = 900; D.cars[1].pts = 700; D.cars[1].score = 700; D.t = S.GLT + 1; ev = S.pas(D.cars[0], H);
  assert(ev.fin && D.cars[0].pts === 900 && D.cars[1].pts === 0, 'duel : hors délai, score nul');
}

// ---------- Tournée : une manche close, la suivante sur la grille des points, le trophée à la dernière ----------
{
  const prefs = reglages(), S = session(memoire(), prefs);
  assert(S.tn(1) === null && S.tnOu(1).manche === 0 && S.trophee(1) === 0, 'pas de Tournée en cours');
  const R = S.start({ mode: 'tournee', diff: 1, ia: true }); assert(R.cars.length === 4 && R.cars[0].pos === 4, 'première manche : le joueur en fond de grille');
  R.cars[0].fin = 1; S.pas(R.cars[0], H); assert(S.raceEnd && !S.tnFin);
  S.clos(); const f = S.tnFin;
  assert(R.done && f && f.manche === 0 && f.rang === 1 && f.pts[0] === 10 && !f.fini, 'manche close : les autres finissent, le joueur premier marque 10');
  assert.deepStrictEqual(JSON.parse(prefs.o['vpr7.tournee'])[1], { manche: 1, pts: f.pts }, 'Tournée sauvegardée par difficulté');
  S.clos(); assert(S.tnFin === f, 'une manche ne se compte qu’une fois');
  const S2 = session(memoire(), prefs); assert(S2.tn(1).manche === 1 && S2.tn(0) === null, 'la carte suivante relit la Tournée');
  assert.deepStrictEqual(S2.start({ mode: 'tournee', diff: 1, ia: true }).cars.map(c => c.pos), tournee(f.pts).grille.map(k => k + 1), 'manche suivante : grille inversée des points (le meneur dernier)');
  prefs.o['vpr7.tournee'] = JSON.stringify([null, { manche: CARTES.length - 1, pts: [20, 0, 0, 0] }]);
  const S3 = session(memoire(), prefs), R3 = S3.start({ mode: 'tournee', diff: 1, ia: true }); R3.cars[0].fin = 1; S3.pas(R3.cars[0], H); S3.toMenu();
  assert(S3.tnFin === null && S3.race === null && !S3.raceEnd, 'retour au menu : manche close puis tout à zéro');
  assert(S3.trophee(1) === 1 && JSON.parse(prefs.o['vpr7.trophee'])[1] === 1 && JSON.parse(prefs.o['vpr7.tournee'])[1] === null, 'dernière manche : trophée d’or, Tournée finie');
  const SA = session(memoire(), reglages(), true), RA = SA.start({ mode: 'tournee', diff: 1, ia: true }); RA.cars[0].fin = 1; SA.pas(RA.cars[0], H); SA.clos();
  assert(SA.tnFin && SA.trophee(1) === 0, 'pilote automatique : sa propre Tournée, pas de trophée');
}
console.log(`OK  session : contre-la-montre (record, secteurs, fantôme des médailles), Glisse, deux humains, Tournée (${CARTES.length} manches)`);
