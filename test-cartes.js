// node test-cartes.js — chaque carte de cartes.js passe dans la vraie physique : tracé valide, tour bouclé au pilote automatique, voiture plausible.
// La ville a ses propres tests, plus complets, dans test.js (ses chiffres ne doivent pas bouger : records de la ville).
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
  // relief : sans saut ni mur roulable déclarés, la voiture ne quitte jamais le sol ; avec, elle ne passe jamais dessous, et le tour lancé compte au moins un vol par tremplin, sans réception qui casse la vitesse
  let c = newCar(T), t = 0, t1 = 0, hits = 0, vmax = 0, vmin = 1e9, vols = 0, dur = 0;
  assert(T.vert === !!(M.sauts || M.cuv), M.id + ' : relief actif à tort');
  while (c.dist < 2 * n && t < 900) {
    const av = c.air; step(c, autopilot(c, T), T, H); t += H; assert((Math.abs(c.d) <= S[c.idx].w || dansPlace(c.x, c.z)) && Number.isFinite(c.x));
    assert(T.vert ? c.y >= sol(T, c) - 1e-9 : !c.air && c.y === sol(T, c), M.id + ' : la voiture quitte le sol ou passe dessous');
    if (c.dist >= n) { if (c.air && !av) vols++; if (c.land > 9) dur++; }
    if (c.dist >= n) { if (!t1) t1 = t; const v = Math.hypot(c.vx, c.vz); vmax = Math.max(vmax, v); vmin = Math.min(vmin, v); if (c.hit > 3) hits++; }
  }
  assert(c.dist >= 2 * n, `${M.id} : le pilote automatique ne boucle pas le tour`);
  assert(hits <= 2, `${M.id} : le pilote automatique tape les murs (${hits})`);
  assert(vols >= (M.sauts || []).length && !dur, `${M.id} : ${vols} vols au tour lancé pour ${(M.sauts || []).length} tremplins, ${dur} réceptions dures`);
  // départ arrêté, gaz à fond : 0 à 100 km/h plausible, et la boîte auto monte tous les rapports utiles sans rester au rupteur
  c = newCar(T); let t100 = 0;
  for (let i = 0; i < 8 / H && !t100; i++) { step(c, { steer: 0, gas: 1, brake: 0, hand: false }, T, H); if (c.vf >= 100 / 3.6) t100 = (i + 1) * H; assert(c.rpm <= CARD.red + 200); }
  assert(t100 > 2.5 && t100 < 6.5, `${M.id} : 0 à 100 km/h en ${t100} s`);
  // --- conduite, en plan ouvert (sans murs : un seul échantillon de piste, recollé sous la voiture à chaque pas) ---
  const O = { x: 0, y: 0, z: 0, tx: 1, tz: 0, k: 0, sl: 0 }, TO = { S: [O], n: 1 }, I = (steer, gas, brake = 0, hand = false) => ({ steer, gas, brake, hand });
  const go = (c, inp, sec) => { for (let i = 0; i < sec / H; i++) { O.x = c.x; O.z = c.z; const v = Math.hypot(c.vx, c.vz) || 1; O.tx = c.vx / v; O.tz = c.vz / v; step(c, inp, TO, H); } return c; };
  const lance = v => { const c = Object.assign(newCar(T), { idx: 0 }); let i = 0; while (Math.hypot(c.vx, c.vz) < v && i++ < 60 / H) go(c, I(0, 1), H); return c; };
  const cap = c => Math.atan2(c.vz, c.vx), der = c => deg(Math.atan2(Math.abs(c.vl), Math.abs(c.vf))), wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  // rayon de la trajectoire (signé : positif si elle tourne du côté du premier coup de volant), mesuré entre 0,7 et 1,2 s après le début de la commande
  const rayon = (c, inp) => { go(c, inp, 0.7); let d = 0, tw = 0, p = cap(c); for (let i = 0; i < 60; i++) { go(c, inp, H); d += Math.hypot(c.vx, c.vz) * H; tw += wrap(cap(c) - p); p = cap(c); } return d / tw; };
  const vtop = Math.hypot(lance(999).vx, lance(999).vz), ext = rmin + W, v120 = 120 / 3.6, v200 = 200 / 3.6, glisse = v => go(lance(v), I(1, 0, 0, true), 0.3);
  const r120 = rayon(lance(v120), I(1, 1)), r120l = rayon(lance(v120), I(1, 0)), rtop = rayon(lance(vtop - 0.5), I(1, 1)), r240 = rayon(lance(240 / 3.6), I(1, 1));
  const gin = rayon(glisse(v200), I(1, 1, 0, true)), gn = rayon(glisse(v200), I(0, 1, 0, true)), gout = rayon(glisse(v200), I(-1, 1, 0, true)), g200 = rayon(lance(v200), I(1, 1));
  // le volant commande une rotation : à 120 km/h, volant à fond, on tourne plus serré que le virage le plus serré de la carte élargi de la demi-route, et lever le pied resserre encore
  assert(r120 < ext && r120l < 0.9 * r120, `${M.id} : à 120 km/h, rayon ${r120} m sur les gaz, ${r120l} m pied levé (virage de ${rmin} m, ${ext} m avec la demi-largeur)`);
  // le rayon dépend peu de la vitesse : doubler la vitesse ne fait pas plus que le tripler (une limite d'adhérence le quadruplerait)
  assert(r240 < 3 * r120, `${M.id} : rayon ${r120} m à 120 km/h, ${r240} m à 240`);
  // mais à la vitesse de pointe, sans glisse, le virage le plus serré ne passe pas : il faut lever le pied, freiner ou glisser
  assert(rtop > ext, `${M.id} : à ${vtop * 3.6} km/h le rayon (${rtop} m) passe le virage le plus serré sans rien faire`);
  // glisse à 200 km/h (frein à main tenu) : volant vers l'intérieur elle serre plus que le virage le plus serré et bien plus qu'en adhérence ; au neutre puis vers l'extérieur elle ouvre, sans jamais changer de sens
  assert(gin < ext && gin < 0.6 * g200 && gin < gn && gn < gout && gout > 0, `${M.id} : glisse à 200 km/h, rayons ${gin} / ${gn} / ${gout} m (adhérence ${g200} m)`);
  // réponse au volant : à 120 km/h, 0,2 s après le coup de volant la voiture tourne déjà à 85 % de son régime
  const y02 = go(lance(v120), I(1, 1), 0.2).yaw, y06 = go(lance(v120), I(1, 1), 0.6).yaw;
  assert(y02 > 0.85 * y06, `${M.id} : volant trop lent (${deg(y02)} °/s à 0,2 s, ${deg(y06)} à 0,6 s)`);
  // glisse tenue 1 s : en travers de 10 à 40°, presque sans perdre de vitesse ; frein à main relâché : boost, et la voiture est de nouveau droite en moins de 0,5 s. Une glisse de 0,3 s ne donne pas de boost
  c = go(glisse(v200), I(1, 1, 0, true), 0.7); const dtenue = der(c), vgl = Math.hypot(c.vx, c.vz);
  assert(c.drift && dtenue > 10 && dtenue < 40 && vgl > 0.9 * v200, `${M.id} : glisse non tenue (${dtenue}°, ${vgl * 3.6} km/h)`);
  go(c, I(0, 1), H); assert(!c.drift && c.boost > 0.5, M.id + ' : pas de boost en sortie de glisse');
  let rat = H; while (der(c) > 3 && rat < 3) { go(c, I(0, 1), H); rat += H; }
  assert(rat < 0.5, `${M.id} : voiture pas redressée après la glisse (${rat} s)`);
  c = go(glisse(v200), I(0, 1), H); assert(!c.drift && !(c.boost > 0), M.id + ' : boost après une glisse trop courte');
  // ordre des trois façons de boucler un tour lancé : en glisse avec boosts (le plus rapide), propre au pilote automatique, à fond sans freiner dans les murs (le plus lent).
  // Pilote en glisse : frein à main dès que la trajectoire demande plus de 90 % du braquage, tenu tant qu'elle en demande plus de 30 % du même côté, volant dosé pour la suivre ; en glisse il s'autorise 20 % de vitesse de plus que le pilote propre.
  const tour = drive => { const c = newCar(T); let t = 0, t1 = 0, b = 0, pb = 0, h = 0; while (c.dist < 2 * n && t < 900) { step(c, drive(c), T, H); t += H; if (!t1 && c.dist >= n) t1 = t; if (t1 && c.boost > 0 && pb <= 0) b++; if (t1 && c.hit > 3) h++; pb = c.boost; } return [t - t1, b, h]; };
  const lap = t - t1, [tfond, , hfond] = tour(c => ({ ...autopilot(c, T), gas: 1, brake: 0 })), [tgl, boosts, hgl] = tour(c => {
    const a = autopilot(c, T, c.dd ? 1.2 : 1), sp = Math.hypot(c.vx, c.vz), la = S[(c.idx + 3 + Math.floor(sp * 0.1)) % n], dem = s => s.kl * sp / omega(sp); // dem = part du braquage que demande la trajectoire
    const m = wrap(Math.atan2(la.z + la.tx * la.dl - c.z, la.x - la.tz * la.dl - c.x) - (c.dd ? cap(c) : c.th)) * 3; // en glisse le nez est en travers : on vise avec la direction de la vitesse
    if (c.dd ? m * c.dd > 0 && Math.max(dem(S[c.idx]) * c.dd, dem(la) * c.dd) > 0.3 : Math.abs(dem(la)) > 0.9 && dem(la) * m > 0 && sp > 15) { const d = c.dd || Math.sign(m), f = Math.max(m * d, 0.35); return I(d * Math.max(-1, Math.min(1, f < 1.1 ? (f - 1.1) / 0.75 : f - 1.1)), a.gas ? 1 : 0, a.brake, true); }
    return { ...a, gas: a.gas ? 1 : 0 }; });
  assert(boosts > 1 && tgl < lap, `${M.id} : tour en glisse (${tgl} s, ${boosts} boosts, ${hgl} chocs) pas plus rapide que le tour propre (${lap} s)`);
  assert(hfond && tfond > lap * 1.01, `${M.id} : à fond dans les murs (${tfond} s, ${hfond} chocs) pas plus lent que le tour propre (${lap} s)`);
  // trafic : positions finies, sur la route ; une voiture arrêtée sur une file se fait pousser sans être traversée
  if (M.trafic) {
    for (const tt of [0, 37.3, 400]) for (const k of trafic(T, tt)) assert(Number.isFinite(k.x) && Math.abs(k.d) < W - 1.4, `${M.id} : camion hors route`);
    const k0 = trafic(T, 0)[0], s = S[(k0.idx + 20) % n]; c = newCar(T); Object.assign(c, { x: s.x - s.tz * k0.lane, z: s.z + s.tx * k0.lane, idx: (k0.idx + 20) % n, th: Math.atan2(s.tz, s.tx) });
    let hit = 0; for (let i = 0; i < 4 / H; i++) { step(c, { steer: 0, gas: 0, brake: 0, hand: false }, T, H); hitTrafic(c, T, i * H); hit = Math.max(hit, c.hit); }
    assert(hit > 5 && Math.hypot(c.vx, c.vz) > 5, `${M.id} : le camion ne pousse pas la voiture (${hit})`);
  }
  // pluie : la bruine (force 1) ne change rien ; une averse ralentit le pilote automatique de 2 à 12 % sans l'envoyer dans les murs, et allonge le freinage
  assert(!T.eau.some(Boolean) === !(Array.isArray(M.th.pluie) && M.th.pluie.some(z => z[2] > 1)), M.id + ' : route mouillée là où il ne pleut pas fort');
  if (T.eau.some(Boolean)) {
    const E = T.eau; T.eau = null; const [sec] = tour(c => autopilot(c, T)); T.eau = E;
    assert(lap > 1.02 * sec && lap < 1.12 * sec, `${M.id} : tour sous la pluie ${lap} s, au sec ${sec} s`);
    const frein = e => { TO.eau = [e]; const c = lance(v200); let d = 0; while (c.vf > 1) { go(c, I(0, 0, 1), H); d += c.vf * H; } TO.eau = null; return d; };
    assert(frein(1) > 1.2 * frein(0), M.id + ' : le freinage sous la pluie doit être plus long');
  }
  // place où l'on roule partout : on traverse l'arche par son axe sans toucher ; lancé sur une pile, on la heurte sans entrer dedans ; on reprend la piste en sortant
  if (M.place) {
    const P = M.place, ux = Math.sin(P.a), uz = Math.cos(P.a), lance = (ox, oz, th) => { const c = newCar(T), s0 = S.reduce((b, s, k) => Math.hypot(s.x - ox, s.z - oz) < Math.hypot(S[b].x - ox, S[b].z - oz) ? k : b, 0);
      return Object.assign(c, { x: ox, z: oz, th, vx: Math.cos(th) * 25, vz: Math.sin(th) * 25, idx: s0, dist: s0 }); };
    let c = lance(P.c[0] - ux * 40, P.c[1] - uz * 40, Math.atan2(uz, ux)), h = 0;
    for (let i = 0; i < 2.5 / H; i++) { step(c, { steer: 0, gas: 0.3, brake: 0, hand: false }, T, H); if (c.hit > 0) h++; }
    const fait = (c.x - P.c[0]) * ux + (c.z - P.c[1]) * uz;
    assert(h === 0 && fait > 20, `${M.id} : on ne traverse pas l'arche (${h} chocs, ${fait | 0} m après le centre)`);
    // de l'avenue d'arrivée, par l'arche, jusqu'à l'avenue de départ : la progression le long de la piste suit, on repart sur la piste
    { const e = S.findIndex(s => Math.hypot(s.x - P.c[0], s.z - P.c[1]) < P.r) - 10, x = S.findIndex((s, k) => k > e + 20 && Math.hypot(s.x - P.c[0], s.z - P.c[1]) > P.r) + 40, Wp = [[P.c[0] - ux * 40, P.c[1] - uz * 40], [P.c[0] + ux * 40, P.c[1] + uz * 40], [S[x].x, S[x].z]];
      c = Object.assign(newCar(T), { x: S[e].x, z: S[e].z, idx: e, dist: e, th: Math.atan2(S[e].tz, S[e].tx), vx: S[e].tx * 25, vz: S[e].tz * 25 }); let k = 0, hh = 0;
      for (let i = 0; i < 20 / H && !(k === 2 && c.idx >= x - 10); i++) { if (k < 2 && Math.hypot(Wp[k][0] - c.x, Wp[k][1] - c.z) < 8) k++; const a = wrap(Math.atan2(Wp[k][1] - c.z, Wp[k][0] - c.x) - c.th);
        step(c, { steer: Math.max(-1, Math.min(1, a * 3)), gas: 0.35, brake: 0, hand: false }, T, H); if (c.hit > 3) hh++; }
      assert(k === 2 && c.idx >= x - 10 && c.dist >= x - 10 && !hh, `${M.id} : traversée de la place par l'arche (étape ${k}, échantillon ${c.idx} sur ${x}, ${hh} chocs)`); }
    const [px, pz] = P.piles[0], wx = P.c[0] + px * Math.cos(P.a) + pz * Math.sin(P.a), wz = P.c[1] - px * Math.sin(P.a) + pz * Math.cos(P.a), ax = wx - 30;
    c = lance(ax, wz, 0); let hit = 0, dedans = 0;
    for (let i = 0; i < 2 / H; i++) { step(c, { steer: 0, gas: 1, brake: 0, hand: false }, T, H); hit = Math.max(hit, c.hit);
      const qx = c.x - P.c[0], qz = c.z - P.c[1], lx = qx * Math.cos(P.a) - qz * Math.sin(P.a), lz = qx * Math.sin(P.a) + qz * Math.cos(P.a);
      if (P.piles.some(([x, z, a, b]) => Math.abs(lx - x) < a - 0.3 && Math.abs(lz - z) < b - 0.3)) dedans++; }
    assert(hit > 3 && !dedans, `${M.id} : la pile de l'arc ne bloque pas (choc ${hit}, ${dedans} pas dedans)`);
  }
  // course : 3 tours à 4 pilotes automatiques sur le tracé de la carte ; tout le monde arrive, personne ne sort ni ne reste bloqué
  const R = newRace(T); let wall = 0, bump = 0;
  while (!R.done && R.t < 900) { stepRace(R, null, H); for (const x of R.cars) { assert(Number.isFinite(x.x) && (Math.abs(x.d) <= S[x.idx].w || dansPlace(x.x, x.z)), M.id + ' : course, voiture hors piste'); if (x.hit > 3) wall++; if (x.bump > 3) bump++; } }
  assert(R.done, M.id + ' : la course ne se termine pas');
  const k = v => Math.round(v * 3.6);
  console.log(`OK  ${M.id.padEnd(7)} ${Math.round(T.len)} m, rayon mini ${rmin | 0} m, tour lancé ${lap.toFixed(1)} s, moyenne ${k(T.len / lap)} km/h, de ${k(vmin)} à ${k(vmax)} km/h, ${hits} chocs${T.vert ? ', ' + vols + ' vols' : ''}, 0-100 en ${t100.toFixed(1)} s ; en glisse ${tgl.toFixed(1)} s (${((tgl / lap - 1) * 100).toFixed(1)} %, ${boosts} boosts, ${hgl} chocs), à fond ${tfond.toFixed(1)} s (+${((tfond / lap - 1) * 100).toFixed(1)} %, ${hfond} chocs) ; rayon à 120 km/h ${r120.toFixed(0)} m (levé ${r120l.toFixed(0)}), à ${k(vtop)} km/h ${rtop.toFixed(0)} m, en glisse à 200 km/h ${gin.toFixed(0)} / ${gn.toFixed(0)} / ${gout.toFixed(0)} m (dedans / neutre / dehors), dérive ${dtenue.toFixed(0)}° ; course : ${raceOrder(R).map(x => x.fin.toFixed(0)).join(' / ')} s, ${wall} chocs mur, ${bump} chocs voiture`);
}
// radio : trois stations par carte ; une forme d'au moins 32 mesures faite de sections différentes ; timbres et batteries connus d'audio.js
// (la variété à l'oreille se mesure dans le navigateur : bouton « Variété des stations » de ecoute.html, il n'y a pas de Web Audio sous node)
const SRC = require('fs').readFileSync(__dirname + '/audio.js', 'utf8'), seen = new Set();
const GAMME = { mineur: [0, 2, 3, 5, 7, 8, 10], majeur: [0, 2, 4, 5, 7, 9, 11] }, NOMS = ['do', 'do#', 'ré', 'mib', 'mi', 'fa', 'fa#', 'sol', 'lab', 'la', 'sib', 'si'];
for (const M of CARTES) {
  assert(M.radio.length === 3, M.id + ' : il faut trois stations');
  for (const s of M.radio) {
    const w = s.name + ' : ';
    assert(!seen.has(s.name) && !seen.has(s.genre), w + 'nom ou genre en double'); seen.add(s.name); seen.add(s.genre);
    assert(s.bpm >= 80 && s.bpm <= 180 && s.name.length <= 13, w + 'tempo ou nom trop long pour le HUD');
    assert(s.form.length * 4 >= 32 && new Set(s.form).size >= 5, w + 'forme trop courte ou trop peu de sections');
    assert(s.sec[s.hot] && s.sec.e, w + 'refrain ou variation absents');
    assert(SRC.includes(' ' + s.kit + ': {'), w + 'kit inconnu ' + s.kit);
    for (const p of ['b', 'c', 'g', 'a', 'l']) assert(!s[p] || SRC.includes(' ' + s[p].p + ': { o: [['), w + 'timbre inconnu ' + (s[p] && s[p].p));
    assert(!s.d || SRC.includes(' ' + s.d[0] + ': { o: [['), w + 'nappe inconnue');
    for (const k in s.sec) for (const p in s.sec[k]) if ('kshpbdcgal'.includes(p)) { assert(s[p], w + 'section ' + k + ' : partie absente ' + p); const v = s[p].v || (p === 'd' ? [0] : s[p]); assert(s.sec[k][p].v < v.length, w + 'section ' + k + ' : variante inconnue ' + p + s.sec[k][p].v); }
    for (const v of (s.l || { v: [] }).v) for (const b of v) for (const n of b) assert(n == null || n === -99 || (n >= 55 && n <= 105), w + 'note de thème ' + n);
    // justesse : les accords hors gamme sont déclarés (emprunts) ; chaque note de thème, et chaque note de basse telle qu'audio.js la recale, appartient
    // à la gamme ou à l'accord de sa mesure, dans toutes les sections et à toutes leurs places dans la forme
    const sc = GAMME[s.gamme].map(i => (s.key + i) % 12), pc = n => ((n % 12) + 12) % 12, nom = n => NOMS[pc(n)];
    s.prog.forEach((pr, p) => pr.CH.forEach((ch, i) => assert(ch.every(n => sc.includes(pc(n))) || (s.emprunts || '').split(' ').includes(s.accords[p][i]), w + 'accord hors gamme non déclaré : ' + s.accords[p][i])));
    for (const k in s.sec) for (let fi = 0; fi < s.form.length; fi++) if (s.form[fi] === k || (k === s.hot && s.form[fi] !== 'e')) for (let b = fi * 4; b < fi * 4 + 4; b++) {
      const sec = s.sec[k], pr = s.prog[sec.P || 0], ok = pr.OK[b % pr.OK.length], root = pr.ROOT[b % pr.ROOT.length], ou = ' (section ' + k + ', mesure ' + (b + 1) + ', accord ' + s.accords[sec.P || 0][b % pr.CH.length] + ')';
      if (sec.l) for (const n of s.l.v[sec.l.v][b % s.l.v[sec.l.v].length]) assert(n == null || n === -99 || ok.has(pc(n)), w + 'thème, fausse note ' + nom(n) + ou);
      if (sec.b) for (const n of s.b.v[sec.b.v][b % s.b.v[sec.b.v].length]) { if (n == null || n === -99) continue;
        if (s.bPar) assert(s.bPar.includes(n) || s.bPar.includes(n - 12), w + 'basse parallèle, intervalle non prévu ' + n + ou);
        else { const j = ok.has(pc(root + n)) ? root + n : ok.has(pc(root + n - 1)) ? root + n - 1 : root + n + 1; assert(ok.has(pc(j)), w + 'basse impossible à recaler ' + nom(root + n) + ou); } }
    }
  }
}
assert(/const juste = \(n, ok\) => ok\.has/.test(SRC), 'audio.js ne recale plus la basse');
console.log('OK  radio   justesse vérifiée (thèmes, basses, accords) · ' + CARTES.map(M => M.radio.map(s => s.genre.toLowerCase()).join(' / ')).join(' · '));
