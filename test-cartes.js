// node test-cartes.js — chaque carte de cartes.js passe dans la vraie physique : tracé valide, tour bouclé au pilote automatique, voiture plausible.
// La ville a ses propres tests, plus complets, dans test.js (ses chiffres ne doivent pas bouger : records de la ville).
const assert = require('assert'), THREE = require('./three.min.js');
require('./cartes.js'); require('./traces-or.js'); require('./sim.js');
// inventaire : une carte se monte de son entrée de cartes.js, de son décor (decors.js), de sa trace or (traces-or.js) et de son titre anglais (TITRE_EN de langue.js, sinon le titre du HUD)
globalThis.window = globalThis; require('./decors.js'); require('./langue.js');
{ const EN = TITRE_EN;
  for (const M of CARTES) {
    assert(typeof DECORS[M.th.decor] === 'function', M.id + ' : pas de décor ' + M.th.decor + ' dans decors.js');
    assert(typeof TRACES_OR[M.id] === 'string' && TRACES_OR[M.id].startsWith(DEFI_V + '.' + M.id + '.'), M.id + ' : pas de trace or dans traces-or.js');
    const t = EN[M.id] || M.th.hud.titre; assert(t && t.length === 2 && t.every(l => l), M.id + ' : titre anglais absent');
  }
  for (const id in EN) assert(CARTES.some(M => M.id === id), 'TITRE_EN : carte inconnue ' + id);
  assert.deepStrictEqual(SOIREE.map(M => M.id).sort(), CARTES.map(M => M.id).sort(), 'NUIT : chaque carte une fois dans la Tournée');
  assert(SOIREE.every((M, i) => /^\d\d:\d\d$/.test(M.heure) && (!i || (M.heure < '12' ? '24' + M.heure : M.heure) > (SOIREE[i - 1].heure < '12' ? '24' + SOIREE[i - 1].heure : SOIREE[i - 1].heure))), 'NUIT : les heures avancent, du soir au matin');
  console.log('OK  inventaire : décor, trace or et titre de ' + CARTES.length + ' cartes'); }
const H = 1 / 120, deg = r => r * 180 / Math.PI; let surfTxt = '', surfCarte = '', lienMax = [0], orTxt = [];
for (const M of CARTES) {
  surfCarte = '';
  const T = buildTrack(THREE, M), { S, n, W } = T, CARD = T.car;
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
    const av = c.air; step(c, autopilot(c, T), T, H); t += H; assert((Math.abs(c.d) <= S[c.idx].w || dansPlace(T, c.x, c.z)) && Number.isFinite(c.x));
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
  const O = { x: 0, y: 0, z: 0, tx: 1, tz: 0, k: 0, sl: 0 }, TO = { S: [O], n: 1, carte: T.carte, car: T.car, kt: T.kt }, I = (steer, gas, brake = 0, hand = false) => ({ steer, gas, brake, hand });
  const go = (c, inp, sec) => { for (let i = 0; i < sec / H; i++) { O.x = c.x; O.z = c.z; const v = Math.hypot(c.vx, c.vz) || 1; O.tx = c.vx / v; O.tz = c.vz / v; step(c, inp, TO, H); } return c; };
  // lance : au loin (à Paris, les piles de l'arc sont près de l'origine)
  const lance = v => { const c = Object.assign(newCar(T), { idx: 0, x: 1e5, z: 1e5 }); let i = 0; while (Math.hypot(c.vx, c.vz) < v && i++ < 60 / H) go(c, I(0, 1), H); return c; };
  const cap = c => Math.atan2(c.vz, c.vx), der = c => deg(Math.atan2(Math.abs(c.vl), Math.abs(c.vf))), wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  // rayon de la trajectoire (signé : positif si elle tourne du côté du premier coup de volant), mesuré entre 0,7 et 1,2 s après le début de la commande
  const rayon = (c, inp) => { go(c, inp, 0.7); let d = 0, tw = 0, p = cap(c); for (let i = 0; i < 60; i++) { go(c, inp, H); d += Math.hypot(c.vx, c.vz) * H; tw += wrap(cap(c) - p); p = cap(c); } return d / tw; };
  const vtop = Math.hypot(lance(999).vx, lance(999).vz), ext = rmin + W, v120 = 120 / 3.6, v200 = 200 / 3.6, glisse = v => go(lance(v), I(1, 0, 0, true), 0.3);
  const r120 = rayon(lance(v120), I(1, 1)), r120l = rayon(lance(v120), I(1, 0)), rtop = rayon(lance(vtop - 0.5), I(1, 1)), r240 = rayon(lance(240 / 3.6), I(1, 1));
  const gin120 = rayon(go(lance(v120), I(1, 1, 0, true), 0.3), I(1, 1, 0, true)), gin = rayon(glisse(v200), I(1, 1, 0, true)), gn = rayon(glisse(v200), I(0, 1, 0, true)), gout = rayon(glisse(v200), I(-1, 1, 0, true)), g200 = rayon(lance(v200), I(1, 1));
  // le volant commande une rotation, la même pour toutes les voitures : à 120 km/h pied levé, volant à fond, on passe le virage le plus serré de la carte élargi de la demi-route ; lever le pied resserre
  assert(r120l < ext && r120l < 0.9 * r120, `${M.id} : à 120 km/h, rayon ${r120} m sur les gaz, ${r120l} m pied levé (virage de ${rmin} m, ${ext} m avec la demi-largeur)`);
  // le rayon dépend peu de la vitesse : doubler la vitesse ne fait pas plus que le tripler (une limite d'adhérence le quadruplerait)
  assert(r240 < 3 * r120, `${M.id} : rayon ${r120} m à 120 km/h, ${r240} m à 240`);
  // mais à la vitesse de pointe, sans glisse, le virage le plus serré ne passe pas : il faut lever le pied, freiner ou glisser
  assert(rtop > ext, `${M.id} : à ${vtop * 3.6} km/h le rayon (${rtop} m) passe le virage le plus serré sans rien faire`);
  // glisse (bouton tenu) : à 200 km/h volant vers l'intérieur elle serre bien plus qu'en adhérence ; au neutre puis vers l'extérieur elle ouvre, sans jamais changer de sens ; à 120 km/h elle passe le virage le plus serré
  assert(gin120 < ext && gin < 0.8 * g200 && gin < gn && gn < gout && gout > 0, `${M.id} : glisse à 200 km/h, rayons ${gin} / ${gn} / ${gout} m (adhérence ${g200} m)`);
  // réponse au volant : à 120 km/h, 0,2 s après le coup de volant la voiture tourne déjà à 85 % de son régime
  const y02 = go(lance(v120), I(1, 1), 0.2).yaw, y06 = go(lance(v120), I(1, 1), 0.6).yaw;
  assert(y02 > 0.85 * y06, `${M.id} : volant trop lent (${deg(y02)} °/s à 0,2 s, ${deg(y06)} à 0,6 s)`);
  // glisse tenue 1 s : en travers de 10 à 40°, presque sans perdre de vitesse, et la jauge de nitro a monté ; frein à main relâché : rien ne pousse tout seul, et la voiture est de nouveau droite en moins de 0,5 s. Une glisse de 0,3 s ne remplit presque rien
  c = go(glisse(v200), I(1, 1, 0, true), 0.7); const dtenue = der(c), vgl = Math.hypot(c.vx, c.vz);
  assert(c.drift && dtenue > 10 && dtenue < 40 && vgl > 0.9 * v200, `${M.id} : glisse non tenue (${dtenue}°, ${vgl * 3.6} km/h)`);
  assert(c.nitro > 0.12 && c.nitro < 0.4, `${M.id} : 1 s de glisse à 200 km/h doit remplir la jauge d'un bon cran (${c.nitro})`);
  go(c, I(0, 1), H); assert(!c.drift && !c.boost, M.id + ' : la sortie de glisse pousse encore toute seule');
  let rat = H; while (der(c) > 3 && rat < 3) { go(c, I(0, 1), H); rat += H; }
  assert(rat < 0.5, `${M.id} : voiture pas redressée après la glisse (${rat} s)`);
  c = go(glisse(v200), I(0, 1), H); assert(!c.drift && c.nitro < 0.04, `${M.id} : une glisse trop courte remplit la jauge (${c.nitro})`);
  // ordre des façons de boucler un tour lancé : en glisse en dépensant la nitro gagnée (le plus rapide), propre au pilote automatique, à fond sans freiner dans les murs (le plus lent).
  // Et le pilote automatique à qui l'on donne une jauge pleine au début du tour lancé la dépense en ligne droite : plus rapide que le tour propre, sans taper davantage ni rater une réception (c'est la référence des médailles).
  // Pilote en glisse (piloteGlisse de sim.js) : il glisse dès que la trajectoire demande plus de 90 % du lacet d'adhérence, la tient tant qu'elle en demande plus de 30 %, et s'autorise 20 % de vitesse de plus que le pilote propre.
  const lap = t - t1, tour = (drive, jauge = 0) => { const c = newCar(T); let t = 0, t1 = 0, b = 0, pb = 0, h = 0, d = 0; while (c.dist < 2 * n && t < 900) { step(c, drive(c), T, H); t += H; if (!t1 && c.dist >= n) { t1 = t; c.nitro = jauge; } if (t1 && c.boost > 0 && pb <= 0) b++; if (t1 && c.hit > 3) h++; if (t1 && c.land > 9) d++; pb = c.boost; } return [t - t1, b, h, d, c.nitro]; };
  const [tni, bni, hni, dni, reste] = tour(c => autopilot(c, T), 1);
  assert(bni && reste <= 0.3 && tni < lap - 0.3 && hni <= hits && !dni, `${M.id} : tour du pilote automatique avec une jauge de nitro ${tni} s (${bni} coups, reste ${reste}, ${hni} chocs, ${dni} réceptions dures) contre ${lap} s sans`);
  const [tfond, , hfond] = tour(c => ({ ...autopilot(c, T), gas: 1, brake: 0 })), [tgl, boosts, hgl] = tour(piloteGlisse(T, 1, 1.2, 0.9, 0.3));
  assert(boosts > 1 && tgl < lap * (M.surf && M.surf.fond === 'neige' ? 1.02 : 1), // sur la neige, la glisse (douce) ne paie plus forcément : à 2 % près
     `${M.id} : tour en glisse (${tgl} s, ${boosts} coups de nitro, ${hgl} chocs) pas plus rapide que le tour propre (${lap} s)`);
  assert(hfond && tfond > lap * 1.005, `${M.id} : à fond dans les murs (${tfond} s, ${hfond} chocs) pas plus lent que le tour propre (${lap} s)`);
  // trafic : positions finies, sur la route ; une voiture arrêtée sur une file se fait pousser sans être traversée
  if (M.trafic) {
    for (const tt of [0, 37.3, 400]) for (const k of trafic(T, tt)) assert(Number.isFinite(k.x) && Math.abs(k.d) < W - 1.4, `${M.id} : camion hors route`);
    const k0 = trafic(T, 0)[0], s = S[(k0.idx + 20) % n]; c = newCar(T); Object.assign(c, { x: s.x - s.tz * k0.lane, z: s.z + s.tx * k0.lane, idx: (k0.idx + 20) % n, th: Math.atan2(s.tz, s.tx) });
    let hit = 0; for (let i = 0; i < 4 / H; i++) { step(c, { steer: 0, gas: 0, brake: 0, hand: false }, T, H); hitTrafic(c, T, i * H); hit = Math.max(hit, c.hit); }
    assert(hit > 5 && Math.hypot(c.vx, c.vz) > 5, `${M.id} : le camion ne pousse pas la voiture (${hit})`);
    // doubler un camion au ras, sans le toucher, remplit la jauge ; le doubler au large, non ; le percuter la vide
    const double = lat => { const k = trafic(T, 0)[0], i = (k.idx - 8 + n) % n, s = S[i], d = k.lane + (k.lane > 0 ? -lat : lat), v = k.v + 30, c = newCar(T); let h = 0;
      Object.assign(c, { x: s.x - s.tz * d, z: s.z + s.tx * d, idx: i, th: Math.atan2(s.tz, s.tx), vx: s.tx * v, vz: s.tz * v, nitro: lat ? 0 : 1 });
      for (let j = 0; j < 1 / H; j++) { step(c, { steer: 0, gas: 1, brake: 0, hand: false }, T, H); hitTrafic(c, T, j * H, H); h = Math.max(h, c.hit); } return [c.nitro, h]; };
    const ras = double(3.4), lrg = double(5.5), dedans = double(0);
    assert(ras[0] > 0.05 && !ras[1] && lrg[0] === 0 && !lrg[1] && dedans[1] > 5 && dedans[0] === 0, `${M.id} : camion doublé au ras (jauge ${ras[0]}, choc ${ras[1]}), au large (${lrg}), percuté (jauge ${dedans[0]}, choc ${dedans[1]})`);
  }
  // pluie : la bruine (force 1, le bitume luisant de la ville) glisse un peu ; une averse ralentit le pilote automatique jusqu'à 16 % sans l'envoyer dans les murs, et allonge le freinage
  // sans surface déclarée, la route est sèche partout (T.surf[i] === SURF.sec), sauf sous une averse
  assert(T.surf.length === n); assert(M.surf || T.surf.every(q => q === SURF.sec) === !M.th.pluie, M.id + ' : route mouillée là où il ne pleut pas');
  if (T.surf.some(q => q !== SURF.sec)) {
    const E = T.surf; T.surf = null; const [sec, , hsec] = tour(c => autopilot(c, T)); T.surf = E;
    if (!M.surf) assert(lap > 1.002 * sec && lap < 1.16 * sec, `${M.id} : tour sous la pluie ${lap} s, au sec ${sec} s`);
    // surface déclarée (neige, glace, terre) : la carte se conduit autrement qu'au sec, sans tourner à la patinoire. Le tour perd de 8 à 35 % (sur fond de terre : de -5 à 35 %, car la carte est étroite et réglée pour la terre ; au sec le pilote automatique y arrive trop vite, tape et perd plus qu'il ne gagne : le nombre de chocs au sec est affiché), et la glace vive, s'il y en a, reste par plaques : moins du quart du tour
    else { const gl = T.surf.filter(q => q.vir > 0.45).length / n; surfCarte = `, ${((lap / sec - 1) * 100).toFixed(0)} % plus lent qu'au sec (${sec.toFixed(1)} s${hsec ? ', où le pilote automatique tape ' + hsec + ' fois' : ''}), glace vive sur ${(gl * 100).toFixed(0)} % du tour`;
      assert((M.surf.fond ? lap > (M.surf.fond === 'terre' ? 0.95 : 1.08) * sec : lap >= sec - 0.05) && lap < 1.35 * sec && gl < 0.25, `${M.id} : tour ${lap} s${surfCarte}`); }
  }
  // surfaces (table SURF) : lancée au sec puis posée sur chaque surface, en plan ouvert. Distance de freinage depuis 200 km/h, rayon volant à fond à 120 km/h, vitesse perdue en 2 s pied levé depuis 100 km/h
  { const sur = (q, v, f) => { const c = lance(v); c.x = c.z = 1e5; TO.surf = [q]; // (au loin : à Paris, les piles de l'arc sont sur le chemin)
      const r = f(c); TO.surf = null; return r; };
    const frein = q => sur(q, v200, c => { let d = 0; while (c.vf > 1) { go(c, I(0, 0, 1), H); d += c.vf * H; } return d; }), ray = q => sur(q, v120, c => rayon(c, I(1, 1))), roue = q => sur(q, 100 / 3.6, c => 100 / 3.6 - go(c, I(0, 0), 2).vf);
    const f = {}, r = {}; for (const k in SURF) { f[k] = frein(SURF[k]); r[k] = ray(SURF[k]); }
    const txt = Object.keys(SURF).map(k => `${k} ${f[k].toFixed(0)} m / ${r[k].toFixed(0)} m`).join(', ');
    assert(f.mouille > 1.2 * f.sec, M.id + ' : le freinage sous la pluie doit être plus long (' + txt + ')');
    assert(f.glace > 2.5 * f.sec && r.glace > 2 * r.sec, `${M.id} : sur la glace, freinage et rayon doivent être nettement plus grands qu'au sec (${txt})`);
    assert(f.neige > 1.3 * f.sec && f.neige < 0.8 * f.glace && r.neige > 1.2 * r.sec && r.neige < 0.8 * r.glace, `${M.id} : la neige tassée doit se tenir entre le sec et la glace (${txt})`);
    // terre : on freine un peu moins bien, on tourne presque aussi serré, la voiture se freine toute seule, et la glisse part plus tôt (à 36 km/h, frein à main et volant : rien au sec)
    const part = q => sur(q, 36 / 3.6, c => go(c, I(1, 1, 0, true), 0.15).drift);
    assert(f.terre > 1.1 * f.sec && f.terre < f.neige && r.terre < 1.15 * r.sec && roue(SURF.terre) > roue(SURF.sec) + 0.5 && part(SURF.terre) && !part(SURF.sec), `${M.id} : terre (${txt}, roue libre ${roue(SURF.terre)} contre ${roue(SURF.sec)} m/s, glisse à 36 km/h ${part(SURF.terre)})`);
    surfTxt = txt; }
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
        const v = Math.hypot(c.vx, c.vz); step(c, { steer: Math.max(-1, Math.min(1, a * 3)), gas: v < 17 ? 0.35 : 0, brake: v > 20 ? 0.5 : 0, hand: false }, T, H); if (c.hit > 3) hh++; } // à 60 km/h : sur les pavés, plus vite, il faut freiner pour viser l'arche
      assert(k === 2 && c.idx >= x - 10 && c.dist >= x - 10 && !hh, `${M.id} : traversée de la place par l'arche (étape ${k}, échantillon ${c.idx} sur ${x}, ${hh} chocs)`); }
    const [px, pz] = P.piles[0], wx = P.c[0] + px * Math.cos(P.a) + pz * Math.sin(P.a), wz = P.c[1] - px * Math.sin(P.a) + pz * Math.cos(P.a), ax = wx - 30;
    c = lance(ax, wz, 0); let hit = 0, dedans = 0;
    for (let i = 0; i < 2 / H; i++) { step(c, { steer: 0, gas: 1, brake: 0, hand: false }, T, H); hit = Math.max(hit, c.hit);
      const qx = c.x - P.c[0], qz = c.z - P.c[1], lx = qx * Math.cos(P.a) - qz * Math.sin(P.a), lz = qx * Math.sin(P.a) + qz * Math.cos(P.a);
      if (P.piles.some(([x, z, a, b]) => Math.abs(lx - x) < a - 0.3 && Math.abs(lz - z) < b - 0.3)) dedans++; }
    assert(hit > 3 && !dedans, `${M.id} : la pile de l'arc ne bloque pas (choc ${hit}, ${dedans} pas dedans)`);
    // terre-plein : la piste le contourne au large ; lancé sur la couronne de bornes hors de l'axe de l'arche, du dehors comme du dedans, on la heurte sans la franchir
    if (P.ile) { const [ri] = P.ile, cs = Math.cos(P.a), sn = Math.sin(P.a), ray = q => Math.hypot(q.x - P.c[0], q.z - P.c[1]);
      assert(S.every(s => ray(s) > ri + 20), `${M.id} : la piste passe trop près du terre-plein`);
      for (const [r0, sens] of [[ri + 25, -1], [ri - 25, 1]]) { c = lance(P.c[0] + cs * r0, P.c[1] - sn * r0, Math.atan2(-sn * sens, cs * sens)); let choc = 0, franchi = 0;
        for (let i = 0; i < 2 / H; i++) { step(c, { steer: 0, gas: 1, brake: 0, hand: false }, T, H); choc = Math.max(choc, c.hit); if ((ray(c) - ri) * sens > 0) franchi++; }
        assert(choc > 3 && !franchi, `${M.id} : la couronne de bornes ne bloque pas ${sens < 0 ? 'du dehors' : 'du dedans'} (choc ${choc}, ${franchi} pas de l'autre côté)`); } }
  }
  // course : 3 tours à 4 pilotes automatiques sur le tracé de la carte ; tout le monde arrive, personne ne sort ni ne reste bloqué
  const R = newRace(T); let wall = 0, bump = 0;
  while (!R.done && R.t < 900) { stepRace(R, null, H); for (const x of R.cars) { assert(Number.isFinite(x.x) && (Math.abs(x.d) <= S[x.idx].w || dansPlace(T, x.x, x.z)), M.id + ' : course, voiture hors piste'); if (x.hit > 3) wall++; if (x.bump > 3) bump++; } }
  assert(R.done, M.id + ' : la course ne se termine pas');
  // fantômes des médailles : le tour de référence est celui des médailles (tni) ; la trace or de la carte (traces-or.js) se relit, reste sur la route d'un bout à l'autre, part de la ligne, dure son temps, et ce temps est sous le seuil or
  // lien de défi le plus long plausible : un tour au temps de bronze
  { const ref = tourRef(T), med = M.med || [1.1, 1.03, 0.97], or = defiLit(TRACES_OR[M.id]), seuil = ref.t * med[2];
    assert(ref.t === tni, `${M.id} : tourRef (${ref.t} s) n'est pas le tour de référence des médailles (${tni} s)`);
    assert(!or.err && or.carte === M.id, `${M.id} : trace or illisible (${or.err}) : relancer node outils/traces-or.js`);
    let hors = 0; for (let i = 0; i < or.trace.length; i += 4) { const x = or.trace[i], z = or.trace[i + 2]; let b = 0, bd = 1e9; for (let j = 0; j < n; j++) { const d = Math.hypot(S[j].x - x, S[j].z - z); if (d < bd) { bd = d; b = j; } } if (bd > S[b].w + 0.5 && !dansPlace(T, x, z)) hors++; }
    assert(!hors && Math.hypot(or.trace[0] - S[0].x, or.trace[2] - S[0].z) < S[0].w + 3 && Math.abs((or.trace.length / 4 - 1) / 20 - or.t) < 0.25, `${M.id} : trace or hors de la route (${hors} points), loin de la ligne ou de mauvaise durée : relancer node outils/traces-or.js`);
    assert(or.t <= seuil, `${M.id} : la trace or (${or.t} s) n'est pas sous le seuil or (${seuil} s)`);
    const lien = defiCode(M.id, ref.t * med[0], etire(ref.trace, med[0])).length; if (lien > lienMax[0]) lienMax = [lien, M.id, ref.t * med[0]];
    orTxt.push(`${M.id} ${or.t.toFixed(1)} s (seuil ${seuil.toFixed(1)})`); }
  const k = v => Math.round(v * 3.6);
  console.log(`OK  ${M.id.padEnd(7)} ${Math.round(T.len)} m, rayon mini ${rmin | 0} m, tour lancé ${lap.toFixed(1)} s, moyenne ${k(T.len / lap)} km/h, de ${k(vmin)} à ${k(vmax)} km/h, ${hits} chocs${T.vert ? ', ' + vols + ' vols' : ''}, 0-100 en ${t100.toFixed(1)} s ; en glisse ${tgl.toFixed(1)} s (${((tgl / lap - 1) * 100).toFixed(1)} %, ${boosts} coups de nitro, ${hgl} chocs), pilote auto avec une jauge ${tni.toFixed(1)} s, à fond ${tfond.toFixed(1)} s (+${((tfond / lap - 1) * 100).toFixed(1)} %, ${hfond} chocs) ; rayon à 120 km/h ${r120.toFixed(0)} m (levé ${r120l.toFixed(0)}), à ${k(vtop)} km/h ${rtop.toFixed(0)} m, en glisse à 200 km/h ${gin.toFixed(0)} / ${gn.toFixed(0)} / ${gout.toFixed(0)} m (dedans / neutre / dehors), dérive ${dtenue.toFixed(0)}° ; course : ${raceOrder(R).map(x => x.fin.toFixed(0)).join(' / ')} s, ${wall} chocs mur, ${bump} chocs voiture${surfCarte}`);
}
console.log(`OK  fantômes or : ${orTxt.join(' · ')} ; lien de défi le plus long : ${lienMax[0]} caractères (${lienMax[1]}, tour de ${lienMax[2].toFixed(1)} s au temps de bronze)`);
// surfaces déclarées par une carte (champ surf : { fond, zones }) : cartes d'essai, le touge recouvert de chaque surface, puis avec une seule plaque de glace.
// Le pilote automatique lit la même table : il boucle son tour lancé sans taper, plus lentement qu'au sec ; et la plaque n'existe que là où elle est déclarée, fondue sur ses bords.
{
  const touge = CARTES.find(m => m.id === 'touge'), charge = surf => buildTrack(THREE, { ...touge, id: 'essai', surf });
  const tour = T => { const c = newCar(T), n = T.n; let t = 0, t1 = 0, h = 0; while (c.dist < 2 * n && t < 900) { step(c, autopilot(c, T), T, H); t += H; if (!t1 && c.dist >= n) t1 = t; if (t1 && c.hit > 0) h++; } assert(c.dist >= 2 * n, 'surface : tour non bouclé'); return [t - t1, h]; };
  const res = {}; for (const k in SURF) { const T = charge(k === 'sec' ? undefined : { fond: k }); assert(T.surf.every(q => q === SURF[k]), k + ' : le fond ne couvre pas toute la carte'); res[k] = tour(T); }
  const txt = Object.keys(res).map(k => `${k} ${res[k][0].toFixed(1)} s`).join(', ');
  for (const k in res) assert(!res[k][1], `le pilote automatique touche un mur sur ${k} (${res[k][1]} contacts ; ${txt})`);
  assert(res.glace[0] > 1.3 * res.sec[0] && res.neige[0] > 1.08 * res.sec[0] && res.neige[0] < res.glace[0] && res.terre[0] > 1.02 * res.sec[0] && res.terre[0] < res.neige[0] && res.mouille[0] > 1.02 * res.sec[0], 'tours du touge selon la surface : ' + txt);
  const T = charge({ zones: [[24, 28, 'glace']] }), near = p => T.S.reduce((b, s, i) => Math.hypot(s.x - p[0], s.z - p[1]) < Math.hypot(T.S[b].x - p[0], T.S[b].z - p[1]) ? i : b, 0), [a, m, b] = [24, 26, 28].map(i => near(touge.pts[i]));
  assert(T.surf[m] === SURF.glace && T.surf[(a + T.n - 40) % T.n] === SURF.sec && T.surf[(b + 40) % T.n] === SURF.sec, 'plaque de glace : pas là où elle est déclarée');
  const bord = T.surf[(a + T.n - 3) % T.n]; assert(bord.vir > 0 && bord.vir < SURF.glace.vir && bord.frein > 0 && bord.frein < SURF.glace.frein, 'plaque de glace : bord non fondu');
  const [tp, hp] = tour(T); assert(!hp && tp > res.sec[0] + 0.3 && tp < res.glace[0], `plaque de glace : tour ${tp} s (${hp} contacts), au sec ${res.sec[0]} s`);
  console.log(`OK  surfaces (touge) : ${txt}, une plaque de glace ${tp.toFixed(1)} s ; freinage de 200 km/h / rayon à 120 km/h : ${surfTxt}`);
}
// radio : trois stations par carte (quatre au plus) ; une forme d'au moins 32 mesures faite de sections différentes ; timbres et batteries connus d'audio.js
// (la variété à l'oreille se mesure dans le navigateur : bouton « Variété des stations » de ecoute.html, il n'y a pas de Web Audio sous node)
const SRC = require('fs').readFileSync(__dirname + '/audio.js', 'utf8'), seen = new Set();
new Function(SRC); // audio.js se lit sans erreur de syntaxe (sinon le jeu reste muet : SON n'existe pas)
const GAMME = { mineur: [0, 2, 3, 5, 7, 8, 10], majeur: [0, 2, 4, 5, 7, 9, 11] }, NOMS = ['do', 'do#', 'ré', 'mib', 'mi', 'fa', 'fa#', 'sol', 'lab', 'la', 'sib', 'si'];
for (const M of CARTES) {
  assert(M.radio.length === 3 || M.radio.length === 4, M.id + ' : il faut trois stations (quatre au plus)');
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
      // une note de thème tenue (2 pas ou plus) ne frotte pas contre l'accord : ni un demi-ton au-dessus d'une de ses notes, ni le triton de sa fondamentale (sauf frottement voulu : hors)
      if (sec.l && !s.hors) { const L = s.l.v[sec.l.v][b % s.l.v[sec.l.v].length], ch = pr.CH[b % pr.CH.length].map(pc);
        L.forEach((n, q) => { if (n == null || n === -99 || ch.includes(pc(n)) || !(q + 1 < 16 && L[q + 1] == null)) return;
          assert(!ch.some(c => pc(n - c) === 1) && pc(n - root) !== 6, w + 'thème, ' + nom(n) + ' tenu frotte contre l\'accord, pas ' + (q + 1) + ou); }); }
      if (sec.b) for (const n of s.b.v[sec.b.v][b % s.b.v[sec.b.v].length]) { if (n == null || n === -99) continue;
        if (s.bPar) assert(s.bPar.includes(n) || s.bPar.includes(n - 12), w + 'basse parallèle, intervalle non prévu ' + n + ou);
        else { const j = ok.has(pc(root + n)) ? root + n : ok.has(pc(root + n - 1)) ? root + n - 1 : root + n + 1; assert(ok.has(pc(j)), w + 'basse impossible à recaler ' + nom(root + n) + ou); } }
    }
  }
}
assert(/const juste = \(n, ok\) => ok\.has/.test(SRC), 'audio.js ne recale plus la basse');
console.log('OK  radio   justesse vérifiée (thèmes, basses, accords) · ' + CARTES.map(M => M.radio.map(s => s.genre.toLowerCase()).join(' / ')).join(' · '));

// niveau des rivaux : un niveau 0,95 perd au moins 2,5 % au tour sur chaque carte, même là où la voiture tape le rupteur (Paris, l'arène : sans plafond de pointe, 1,5 %)
{ const pertes = [];
  for (const id of ['paris', 'stade']) { const T = buildTrack(THREE, CARTES.find(M => M.id === id));
    const tour = lvl => { const c = newCar(T); let t = 0; while (c.dist < T.n && t < 300) { step(c, autopilot(c, T, lvl), T, H); t += H; } return t; };
    const p = tour(0.95) / tour(1) - 1; assert(p > 0.025, `${id} : un rival de niveau 0,95 ne perd que ${(p * 100).toFixed(1)} % au tour`); pertes.push(id + ' ' + (p * 100).toFixed(1) + ' %'); }
  console.log('OK  niveau des rivaux à 0,95 : ' + pertes.join(', ')); }
