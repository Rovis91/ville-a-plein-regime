// Déroulé d'une partie, sans rendu ni son ni entrée : départ, fin de course, points, records, médailles, choix du fantôme, manches de Tournée. Chargé par le jeu après sim.js, et par `node test-session.js`.
// game.js dessine, joue le son et lit les périphériques ; il appelle la session et réagit à ce qu'elle rend.
//   ses = nouvelleSession({ T, carte, cartes, store, prefs, auto, defi, ref, med })
//     store : records de la carte, { get(k), set(k, v) } en JSON (le jeu : localStorage sous le préfixe de la carte) ; prefs : clés communes à toutes les cartes, { get(k, d), set(k, v) } en texte
//     ref = tourRef(T) (temps et trace du tour de référence des médailles) ; med = [bronze, argent, or] en multiples de ref.t ; defi = le tour reçu par lien (defiLit), sinon null ; auto : le pilote automatique joue, rien n'est enregistré
//   ses.start({ mode, diff, nj, ia, duel }) crée la course (rendue, null en contre-la-montre et en Glisse seul). ia : mode contre les IA ; duel : Glisse à deux ; nj : nombre d'humains.
//   ses.pas(car, dt) après chaque pas de physique en course, tant que !ses.raceEnd : rend les évènements du pas (objet réutilisé) :
//     arrives = humains arrivés à ce pas (indices), tour = résultat du tour bouclé en contre-la-montre, fantome = le fantôme vient de passer à la médaille suivante, glisse = les deux tours de Glisse bouclés, fin = la course est finie pour le jeu
//   ses.enregistre(car, y) en contre-la-montre à chaque image : trace du fantôme et secteurs ; rend le secteur franchi, sinon null.
//   ses.clos() ferme la manche de Tournée (une seule fois) ; ses.toMenu() ferme la manche et remet tout à zéro.
//   À lire : race, raceEnd, tRace (chrono du tour, ou temps final en course), lapN, best, bestG, glFin, tnFin, fant, dernier ; medal(t), traceF(), choixF(f), tn(diff), tnOu(diff), trophee(diff), GLT.
(function (G) {
  if (!G.newRace) require('./sim.js');
  const H = 1 / 120; // sim.js est rejoué à chaque changement de carte : ses fonctions sont relues dans G à chaque appel
  function nouvelleSession({ T, carte: M, cartes: CARTES, store, prefs, auto: AUTO = false, defi: DEFI = null, ref, med: MED }) {
    const N = T.n, REF = ref.t, GLT = 2 * REF * MED[0] * 1.3; // Glisse : le score ne compte que si les deux tours sont bouclés en moins de GLT (deux tours au temps de bronze, plus 30 %)
    const lis = (k, d) => { try { return JSON.parse(prefs.get(k, null)) || d; } catch (e) { return d; } }, TNK = 'vpr7.tournee' + (AUTO ? '.auto' : '');
    const TNS = [].concat(lis(TNK, [])), TROPHEE = [].concat(lis('vpr7.trophee', []));
    const medal = t => t ? MED.filter(k => t <= REF * k).length : 0; // 0 aucune, 1 bronze, 2 argent, 3 or
    let bestSpl = store.get('splits'), ghost = store.get('ghost'), si = 0, cur = [], recG = [], fini = []; const medF = [];
    const S = { race: null, raceEnd: false, tRace: 0, lapN: 1, best: store.get('best') || 0, bestG: store.get('glisse') || 0, glFin: null, tnFin: null, dernier: null, mode: 'solo', diff: 0, GLT, medal };
    const NF = DEFI ? 6 : 5; // fantômes : 0 aucun, 1 record, 2..4 médailles, 5 défi
    S.fant = DEFI ? 5 : (f => Number.isInteger(f) && f >= 0 && f < NF ? f : medal(S.best) < 3 ? medal(S.best) + 2 : 1)(store.get('fantome'));
    S.choixF = f => { S.fant = f; if (!AUTO) store.set('fantome', f); };
    // Bronze et argent : la trace du tour de référence ralentie au ratio de la médaille. Or : la trace de la carte dans traces-or.js, ramenée au temps du seuil or.
    S.traceF = () => { const f = S.fant, i = f - 2; if (f < 2) return f ? ghost : null; if (f === 5) return DEFI.trace; if (medF[i]) return medF[i];
      const or = i === 2 ? G.defiLit((G.TRACES_OR || {})[M.id]) : { err: 1 }; return medF[i] = or.err ? G.etire(ref.trace, MED[i]) : G.etire(or.trace, REF * MED[2] / or.t); };
    // Tournée : une en cours par difficulté (vpr7.tournee, { manche, pts }), trophée par difficulté (vpr7.trophee, meilleure place finale de 1 à 3)
    S.trophee = d => TROPHEE[d] >= 1 && TROPHEE[d] <= 3 ? TROPHEE[d] : 0;
    S.tn = d => { const t = TNS[d]; return t && CARTES[t.manche] && Array.isArray(t.pts) && t.pts.length === 4 && t.pts.every(Number.isFinite) ? t : null; }; // une sauvegarde abîmée, ou d'une liste de cartes plus longue, est ignorée
    S.tnOu = d => S.tn(d) || { manche: 0, pts: [0, 0, 0, 0] };
    S.clos = () => { // fin de manche, dès que le joueur quitte le tableau d'arrivée : les voitures encore en piste finissent d'un coup (leur ordre pouvait encore changer), puis points, classement général et sauvegarde
      const R = S.race, d = S.diff; if (S.tnFin || S.mode !== 'tournee' || !S.raceEnd || !R) return;
      while (!R.done && R.t < 3600) G.stepRace(R, null, H);
      const t = S.tnOu(d), r = G.tournee(t.pts, G.raceOrder(R).map(c => R.cars.indexOf(c))), fin = !CARTES[t.manche + 1], rang = r.classement.indexOf(0) + 1;
      S.tnFin = { ...r, avant: t.pts, manche: t.manche, fini: fin, rang };
      TNS[d] = fin ? null : { manche: t.manche + 1, pts: r.pts }; prefs.set(TNK, JSON.stringify(TNS));
      if (fin && rang <= 3 && !AUTO && !(S.trophee(d) && S.trophee(d) <= rang)) { TROPHEE[d] = rang; prefs.set('vpr7.trophee', JSON.stringify(TROPHEE)); } // le pilote automatique ne gagne pas de trophée
    };
    S.start = ({ mode, diff, nj = 1, ia = false, duel = false }) => {
      S.mode = mode; S.diff = diff; S.tnFin = null;
      S.race = duel ? G.newRace(T, 2, [], 0, { humains: 2, delai: GLT }) // Glisse en duel : les deux joueurs seuls en piste, le délai du solo pour chacun
        : ia ? G.newRace(T, 3, G.AI_LVL.slice(0, 4 - nj).map(l => l * G.DIFF[diff].k), G.DIFF[diff].el, { elim: mode === 'elim', grille: mode === 'tournee' && G.tournee(S.tnOu(diff).pts).grille, humains: nj }) : null; // à deux : toujours quatre voitures
      S.raceEnd = false; S.glFin = null; fini = []; si = 0; cur = []; recG = []; S.tRace = 0; S.lapN = 1;
      return S.race;
    };
    S.toMenu = () => { S.clos(); S.tnFin = null; S.race = null; S.raceEnd = false; S.glFin = null; S.tRace = 0; S.lapN = 1; };
    S.enregistre = (car, y) => { // contre-la-montre : la trace du tour à 20 Hz (le fantôme du record) et les deux secteurs
      while (recG.length / 4 <= S.tRace * 20) recG.push(+car.x.toFixed(2), +y.toFixed(2), +car.z.toFixed(2), +car.th.toFixed(3));
      if (si < 2 && car.dist >= T.sp[si]) { const i = si++; cur[i] = S.tRace; return { i, t: S.tRace, d: bestSpl ? S.tRace - bestSpl[i] : null }; }
      return null;
    };
    const ev = { arrives: [], tour: null, fantome: false, glisse: false, fin: false };
    S.pas = (car, dt) => {
      ev.arrives.length = 0; ev.tour = null; ev.fantome = ev.glisse = ev.fin = false;
      S.tRace += dt; const R = S.race;
      if (R) { let tous = true; // chaque humain a sa fin (élimination : sortir, c'est avoir fini) ; la course n'est finie pour le jeu que quand tous le sont
        for (let i = 0; i < R.h; i++) { const c = R.cars[i]; if (!fini[i] && (c.fin || c.out || R.delai && R.t > R.delai)) { fini[i] = true; if (!c.fin) c.pts = 0; c.manual = false; ev.arrives.push(i); } tous = tous && fini[i]; } // Glisse en duel : le délai passé, un joueur encore en piste a fini, score nul (sinon une voiture à l'arrêt retiendrait l'autre joueur sans fin)
        if (tous) { S.raceEnd = ev.fin = true; S.tRace = R.cars[0].fin || R.cars[0].out; } }
      else if (S.mode === 'glisse') { if (car.dist >= 2 * N) finGlisse(car); }
      else if (car.dist >= N) ev.tour = finTour(car);
      return ev;
    };
    function finGlisse(car) {
      const score = Math.round(car.score), valide = S.tRace <= GLT, rec = valide && score > S.bestG; S.glFin = { score, valide, rec }; S.raceEnd = ev.glisse = ev.fin = true; car.manual = false;
      if (rec && !AUTO) { S.bestG = score; store.set('glisse', score); }
    }
    function finTour(car) { // tour bouclé : on l'enregistre, et le chrono repart aussitôt pour un tour lancé
      const t = S.tRace, b = S.best, rec = !b || t < b, res = { rec, first: !b, diff: b ? t - b : 0, t, n: S.lapN, defi: DEFI && t - DEFI.t }; S.dernier = { t, trace: recG };
      if (rec && AUTO) S.best = t; else if (rec) { // le pilote automatique (?auto) n'enregistre rien
        S.best = t; bestSpl = cur; ghost = recG; store.set('best', t); store.set('splits', cur); store.set('ghost', ghost); }
      const f = S.fant; if (f > 1 && f < 5 && t <= REF * MED[f - 2]) { S.choixF(f < 4 ? f + 1 : 1); ev.fantome = true; } // médaille visée battue : au fantôme de la suivante
      S.lapN++; car.dist -= N; S.tRace = 0; si = 0; cur = []; recG = [];
      return res;
    }
    return S;
  }
  G.nouvelleSession = nouvelleSession;
})(typeof window !== 'undefined' ? window : globalThis);
