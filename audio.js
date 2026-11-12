// Ville à plein régime — audio : tout est synthétisé (bande-son originale et adaptative). Stations de chaque carte : RADIO dans cartes.js.
// Interface (window.SON) : init() au premier geste · frame(dt, e) à chaque image · setStation(i), toggleMusic(), carte(M), volume(famille, v) ·
// beep(f), crash(), stinger(rec), tonnerre() · lus par le jeu : station, nom, fq, genre, musicOn, beat, pulse, ana · banc d'écoute et mesure :
// init(contexte hors ligne), pump(), pret, live, vol, stations, evenement(), moniteur(gain), vu, et les bruitages ponctuels clac(), choc(v),
// boost(), petarade() · prises de test : ac, out, smp.
// Chaîne : voix → (batterie | bus pompé → filtre balayé → saturation de bus) → coupure de station → musique oui/non → filtre de vitesse et de
// tunnel → famille « mus » → master → compresseur. Familles réglables : mus, mot (moteur, boîte), pneu, vent, amb (lieu), choc (chocs, frottement, boost), ui (bips, jingle, radio).
(() => {
  const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hz = m => 440 * 2 ** ((m - 69) / 12), R = -99; // R : silence dans un thème (voir mel() dans cartes.js)
  let M = CARTE, ST = M.radio, TH = M.th;
  let AC, live = true, timer, pret = Promise.resolve(), ana, master, musicG, tuneG, drumG, musF, padF, padG, duckG, swF, busDry, busDrv, arpIn, leadIn, acid, fuzz, kdrv, bsat, bclean, dly, dlyFb, rev, musSend, motSend, nbuf, outG, vu;
  let t0 = 0, nextT = 0, stp = 0, musicOn = true, lastHit = 0, lastN = 0, lastB = 0, menu = true;
  const vol = { mus: 1, mot: 1, pneu: 1, vent: 1, amb: 1, choc: 1, ui: 1 }, V = {}; // volume par famille (banc d'écoute) et leurs nœuds
  // état musical piloté par la course : mix = secteur chaud, inten = vitesse, driftL = glisse, drums/lead = sections
  let mix = 0, inten = 0, driftL = 0, drums = 0, lead = false, wasIn = false, wasNear = false, wasBoost = false, lastGas = 0;
  let eng, sq, scrubG, scrapeG, windG, ambBed, ambT = 2, uiF;
  const RK = () => 'vpr.radio' + (M.id === 'ville' ? '' : '.' + M.id); // dernière station écoutée, par carte
  let station = 0, S16 = 60 / ST[0].bpm / 4;

  // musique de menu : une boucle calme par carte (accords de 4 mesures, nappe, arpège de cloches) ; aucune batterie
  const MENU = {
    ville: { bpm: 72, v: 1.55, pad: 'saw', arp: '0...2...1...3...', CH: [[50, 57, 60, 65], [46, 53, 57, 62], [48, 55, 58, 63], [45, 52, 57, 61]] },
    touge: { bpm: 80, v: 1.05, pad: 'ep', arp: '0.2...3...1.2...', CH: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]] },
    wangan: { bpm: 84, v: 1.84, pad: 'super', arp: '0.1.2.3.2.1.3.2.', CH: [[52, 59, 62, 66], [48, 55, 59, 64], [45, 52, 55, 59], [47, 54, 57, 62]] },
    paris: { bpm: 90, v: 1.6, pad: 'str', arp: '..0..2..3..1..2.', CH: [[54, 57, 61, 64], [47, 51, 54, 57], [52, 56, 59, 63], [49, 52, 56, 59]] },
    canal: { bpm: 76, v: 1.05, pad: 'ep', arp: '0.....2...3.....', CH: [[55, 58, 62, 65], [55, 58, 62, 65], [48, 51, 55, 58], [48, 51, 55, 58]] },
  };
  // ambiance du lieu : lits de bruit filtré [type, fréquence, Q, niveau, vitesse et profondeur de la houle]
  const AMB = {
    ville: [['highpass', 6000, 0.5, 0.012], ['bandpass', 1400, 0.6, 0.03, 0.13, 0.3], ['lowpass', 110, 0.7, 0.2, 0.07, 0.4]], // pluie, rumeur de ville
    touge: [['bandpass', 700, 0.5, 0.03, 0.1, 0.6], ['lowpass', 180, 0.7, 0.05, 0.05, 0.5]], // feuillage, air de la nuit (+ grillons)
    wangan: [['bandpass', 350, 0.8, 0.07, 0.08, 0.7], ['lowpass', 90, 0.7, 0.2]], // vent de la baie, ronflement du port (+ corne de navire)
    paris: [['lowpass', 140, 0.7, 0.15, 0.05, 0.3], ['highpass', 7000, 0.5, 0.004]], // ville qui s'éveille (+ oiseaux)
    canal: [['lowpass', 500, 0.5, 0.06, 0.06, 0.7], ['bandpass', 220, 0.7, 0.06]], // vent sec, autoroute lointaine (+ hélicoptère)
  };

  const gain = (v, dest) => { const g = AC.createGain(); g.gain.value = v; g.connect(dest); return g; };
  const filt = (type, f, q, dest) => { const b = AC.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.connect(dest); return b; };
  const shaper = (k, dest) => { const s = AC.createWaveShaper(); s.curve = Float32Array.from({ length: 257 }, (_, i) => Math.tanh((i / 128 - 1) * k)); s.connect(dest); return s; };
  const env = (dest, t, dur, vol, a = 0.005) => { const g = AC.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); g.connect(dest); return g; };
  function osc(type, f, t, dur, vol, dest, det = 0) {
    if (vol < 0.002) return;
    const o = AC.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = det; o.connect(env(dest, t, dur, vol)); o.start(t); o.stop(t + dur + 0.05); return o;
  }
  function nz(t, dur, vol, dest, type, f, q = 1) {
    if (vol < 0.002) return;
    const s = AC.createBufferSource(), fl = filt(type, f, q, env(dest, t, dur, vol)); s.buffer = nbuf; s.loop = true; s.connect(fl); s.start(t, Math.random()); s.stop(t + dur + 0.05); return fl;
  }
  // voix d'accord, d'arpège et de thème : formes d'onde, désaccords (cents), attaque (s), filtre [départ, fin, Q], bus fuzz, formants, cloche
  const CV = {
    saw: { o: ['sawtooth'], d: [-8, 8], lv: 0.055 }, sqr: { o: ['square'], d: [0] }, tri: { o: ['triangle'], d: [0], lv: 0.14 }, sine: { o: ['sine'], d: [0], lv: 0.12 },
    super: { o: ['sawtooth'], d: [-17, -6, 6, 17], a: 0.02 }, // mur de dents de scie désaccordées (trance, house filtrée)
    str: { o: ['sawtooth'], d: [-6, 6], a: 0.1, f: [900, 3500, 0.5], lv: 0.07 }, // cordes
    ep: { o: ['sine', 'triangle'], d: [0], a: 0.004, bell: 2 }, bell: { o: ['sine'], d: [0], a: 0.002, bell: 3.01 }, // piano électrique, cloche
    brass: { o: ['sawtooth'], d: [-5, 5], a: 0.03, f: [500, 4000, 2], lv: 0.07 }, org: { o: ['square'], d: [0, 1200], f: [1800, 1800, 0.7] },
    gtr: { o: ['square'], d: [0], a: 0.002, f: [2600, 900, 4] }, pluck: { o: ['sawtooth'], d: [-7, 7], a: 0.002, f: [5000, 500, 3] }, // cocotte funk, pincé
    pwr: { o: ['sawtooth'], d: [-4, 4], bus: 1 }, gtrl: { o: ['sawtooth'], d: [-5, 5], bus: 1, lv: 0.2 }, // guitare saturée : accords et solo
    sq: { o: ['square', 'sawtooth'], d: [-6, 6], f: [4500, 2500, 1], lv: 0.05 }, ewi: { o: ['sawtooth'], d: [0], a: 0.02, f: [1200, 2800, 3], lv: 0.11 },
    talk: { o: ['sawtooth'], d: [0], form: 1, lv: 0.3 }, // talkbox : deux formants qui glissent
  };
  function voice(w, f, t, dur, vol, dest, sus = 0) { // sus : attaque lente et tenue (nappe) au lieu d'une décroissance
    const P = CV[w] || CV.saw, n = P.o.length * P.d.length; vol *= Math.min(1, 2 / n); if (vol < 0.002) return;
    let g; dest = P.bus ? fuzz : dest;
    if (sus) { g = AC.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + sus); g.gain.setValueAtTime(vol, t + dur * 0.82); g.gain.linearRampToValueAtTime(0, t + dur); g.connect(dest); }
    else g = env(dest, t, dur, vol, P.a);
    let d = g;
    if (P.f) { d = filt('lowpass', P.f[0], P.f[2], g); d.frequency.setValueAtTime(P.f[0], t); d.frequency.exponentialRampToValueAtTime(P.f[1], t + (sus ? 0.3 : dur * 0.6)); }
    if (P.form) { const a = filt('bandpass', 600, 6, g), b = filt('bandpass', 1900, 8, g); d = AC.createGain(); d.gain.value = 3; d.connect(a); d.connect(b);
      a.frequency.setValueAtTime(600, t); a.frequency.linearRampToValueAtTime(1000, t + dur * 0.5); b.frequency.setValueAtTime(1900, t); b.frequency.linearRampToValueAtTime(2600, t + dur * 0.5); }
    const os = [];
    for (const type of P.o) for (const det of P.d) { const o = AC.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = det; o.connect(d); o.start(t); o.stop(t + dur + 0.05); os.push(o); }
    if (P.bell) osc('sine', f * P.bell, t, dur * 0.3, vol * 0.4, dest);
    return os;
  }
  // basses : oscillateurs [forme, désaccord, intervalle], Q, k = ouverture du filtre, tenue du filtre, sub, bus
  const BT = {
    saw: { o: [['sawtooth', 0], ['square', 12]], q: 7, sub: 0.8 }, // scie + carré désaccordé + sub (darksynth, eurobeat, trance)
    moog: { o: [['sawtooth', 0], ['triangle', 5]], q: 3, k: 0.5, hold: 1, sub: 0.6 }, // ronde et tenue, à glisser (g-funk)
    reese: { o: [['sawtooth', -22], ['sawtooth', 22]], q: 2, k: 0.45, hold: 1, sub: 0.9 }, // scies désaccordées qui battent (drum and bass)
    slap: { o: [['square', 0], ['sawtooth', 7]], q: 9, k: 2.2, fast: 1, sub: 0.3 }, // claquée (fusion, city pop, house filtrée)
    acid: { o: [['sawtooth', 0]], q: 15, k: 1.3, sub: 0 }, // résonante façon TB-303 (big beat)
    fuzz: { o: [['sawtooth', 0], ['sawtooth', 6, 7], ['square', -5, 12]], q: 1, k: 1.6, hold: 1, sub: 0.7, bus: 1 }, // riff de guitare saturée
    dist: { o: [['sawtooth', 0], ['square', 9]], q: 4, k: 1.2, sub: 0.5, bus: 1 }, // scie écrêtée (électro saturée, techno industrielle)
    sq: { o: [['square', 0]], q: 2, k: 0.6, sub: 0.6 }, // carré court séquencé (Detroit, électro-funk, disco)
  };
  function bass(st, f, t, dur, vol, cut) {
    if (vol < 0.002) return;
    const P = BT[st.bT] || BT.saw, c = cut * (P.k || 1), fl = filt('lowpass', c, P.q, env(P.bus ? fuzz : st.sat ? bsat : bclean, t, dur, vol));
    fl.frequency.setValueAtTime(c, t); fl.frequency.exponentialRampToValueAtTime(P.hold ? c * 0.7 : 140, t + (P.fast ? 0.09 : dur));
    const os = P.o.map(([type, det, iv = 0]) => { const o = AC.createOscillator(); o.type = type; o.frequency.setValueAtTime(f * 2 ** (iv / 12), t); o.detune.value = det; o.connect(fl); o.start(t); o.stop(t + dur + 0.05); return o; });
    const sub = osc('sine', f, t, dur, vol * P.sub, duckG); sub && os.push(sub);
    if (st.bGl && lastB) for (const o of os) { const k = o.frequency.value / f; o.frequency.setValueAtTime(lastB * k, t); o.frequency.exponentialRampToValueAtTime(f * k, t + st.bGl); } // glissé depuis la note précédente
    lastB = f;
  }
  const smp = {};
  function hitS(name, t, vol, dur = 0, rate = 1) { // dur : coupe le son en fondu (la grosse caisse de 808 résonne 1,5 s) ; rate : hauteur de lecture
    const b = smp[name]; if (!b || vol < 0.002) return !!b;
    vol *= 0.6; // les enregistrements sont plus forts que les sons synthétisés qu'ils remplacent
    const s = AC.createBufferSource(), gn = gain(vol, drumG); s.buffer = b; s.playbackRate.value = rate; s.connect(gn); s.start(t);
    if (dur) { gn.gain.setValueAtTime(vol, t + dur * 0.6); gn.gain.linearRampToValueAtTime(0, t + dur); s.stop(t + dur + 0.02); }
    return true;
  }
  function kick(t, v, st) {
    if (st.kT === 'dur') { const o = osc('sine', 190, t, 0.26, v, kdrv); o && o.frequency.exponentialRampToValueAtTime(44, t + 0.07); nz(t, 0.012, v * 0.3, drumG, 'highpass', 2500); return; } // synthétique et saturée
    if (st.kT === 'rock' && hitS('bd', t, v * 1.1, 0.22, 1.25)) { nz(t, 0.02, v * 0.2, drumG, 'bandpass', 3000, 1); return; }
    if (hitS(v > 0.75 ? 'bdL' : 'bd', t, v, v > 0.75 ? 0.42 : 0.3)) return;
    const o = osc('sine', 165, t, 0.3, v, drumG); o && o.frequency.exponentialRampToValueAtTime(40, t + 0.11); nz(t, 0.015, v * 0.25, drumG, 'highpass', 3000);
  }
  function snare(t, v, st, roll) { // sT : cp clap · sd caisse claire · sdh la même, aiguë et sèche · gate réverbération coupée net · bruit · rim · rock
    const T = roll ? 'sd' : st.sT || 'cp'; if (v < 0.002) return;
    if (T === 'bruit') return nz(t, 0.14, v * 0.8, kdrv, 'highpass', 1200);
    if (T === 'rim') { osc('triangle', 1750, t, 0.035, v * 0.5, drumG); nz(t, 0.02, v * 0.4, drumG, 'bandpass', 3500, 2); return; }
    if (T === 'gate') { const s = AC.createBufferSource(), g = AC.createGain(); s.buffer = nbuf; s.loop = true; s.connect(filt('bandpass', 1800, 0.7, g)); g.connect(drumG);
      g.gain.setValueAtTime(v * 0.35, t); g.gain.setValueAtTime(v * 0.35, t + 0.16); g.gain.linearRampToValueAtTime(0, t + 0.19); s.start(t, Math.random()); s.stop(t + 0.2); }
    if (T === 'rock') nz(t, 0.12, v * 0.3, drumG, 'highpass', 3000);
    if (hitS(T === 'cp' ? 'cp' : 'sd', t, v * 0.9, 0, { sdh: 1.4, gate: 0.85, rock: 0.9 }[T] || 1)) return;
    for (let i = 0; i < 3; i++) nz(t + i * 0.012, 0.03, v * 0.6, drumG, 'bandpass', 1500, 1.2); nz(t + 0.03, 0.2, v, drumG, 'bandpass', 1500, 1.2); osc('triangle', 190, t, 0.08, v / 2, drumG);
  }
  function hat(t, c, k) { // x fermé · X accentué · o ouvert · r cymbale ride
    if (c === 'o') hitS('oh', t, 0.3 * k) || nz(t, 0.12, 0.2 * k, drumG, 'highpass', 6500);
    else if (c === 'r') hitS('oh', t, 0.16 * k, 0.14, 1.7) || nz(t, 0.08, 0.1 * k, drumG, 'highpass', 8000);
    else if (c === 'x' || c === 'X') hitS('ch', t, (c === 'X' ? 0.24 : 0.14) * k) || nz(t, 0.03, 0.1 * k, drumG, 'highpass', 9000);
  }
  function riser(t, dur) { // montée de bruit avant l'entrée du secteur chaud
    const s = AC.createBufferSource(), g = AC.createGain(), f = filt('bandpass', 400, 2, g);
    s.buffer = nbuf; s.loop = true; s.connect(f); g.connect(drumG);
    f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(7000, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.05);
    s.start(t); s.stop(t + dur + 0.1);
  }
  function crash(t = AC.currentTime) { // impact : départ, entrée et sortie du secteur chaud
    nz(t, 1.4, 0.28, drumG, 'highpass', 4500);
    const o = osc('sine', 70, t, 0.7, 0.8, drumG); o && o.frequency.exponentialRampToValueAtTime(30, t + 0.5);
  }
  const stinger = up => AC && (up ? [69, 73, 76, 81, 85] : [69, 64, 60, 57]).forEach((n, i) => osc('square', hz(n), AC.currentTime + i * 0.09, 0.5, 0.12, uiF));

  function schedMenu(s, t) {
    const mn = MENU[M.id] || MENU.ville, bar = s >> 4, q = s % 16, ch = mn.CH[bar % mn.CH.length], a = mn.arp[q];
    if (q === 0) { for (const n of ch) voice(mn.pad, hz(n), t, S16 * 17, 0.05, padF, 0.6); osc('sine', hz(ch[0] - 24), t, S16 * 14, 0.2, duckG); }
    if (a !== '.') voice('bell', hz(ch[+a] + 12 + (bar & 1 ? 12 : 0)), t, 0.9, 0.05, arpIn);
  }
  // un pas de double-croche, joué avec les motifs de la station (format : voir RADIO dans cartes.js). Arrangement : léger hors du secteur
  // chaud (basse filtrée, batterie réduite), plein dans le secteur chaud et sur le dernier secteur (charlestons, percussions, accords,
  // thème) ; sections A/B de 8 mesures, roulement en fin de phrase.
  const F4 = 'x...x...x...x...', SN = '....x.......x...', HH = 'x.o.x.o.x.o.x.o.';
  function sched(s, t) {
    if (menu) return schedMenu(s, t);
    const st = ST[station]; t += (s & 1) * (st.sw || 0) * S16; // swing : les doubles-croches impaires traînent
    const bar = s >> 4, b = bar % 8, q = s % 16, ch = st.CH[b % st.CH.length], root = st.ROOT[b % st.ROOT.length];
    const m = mix, d = drums, big = m > 0.5 || lead, B = (bar >> 3) & 1, fill = d && b === 7 && q >= 12;
    const kc = (big && B && st.kB || st.k || F4)[q];
    if (d && !fill && kc !== '.') {
      kick(t, lerp(0.55, 0.95, m) * (kc === 'g' ? 0.55 : 1), st);
      const p = st.pump == null ? 0.35 : st.pump; // pompe : tout plonge sous la grosse caisse, plus ou moins selon le style
      if (p < 1) { duckG.gain.cancelScheduledValues(t); duckG.gain.setValueAtTime(p, t); duckG.gain.linearRampToValueAtTime(1, t + Math.min(st.pumpT || 0.24, S16 * 1.9)); }
    }
    const sc = (st.s || SN)[q];
    if (d && !fill && sc !== '.') snare(t, (big ? 0.5 : inten > 0.5 ? Math.max(0.25, st.sMin) : st.sMin) * (sc === 'g' ? 0.3 : 1), st); // g : note fantôme
    if (fill) snare(t, 0.22 + 0.09 * (q - 12), st, 1);
    if (d && q === 0 && b === 0) nz(t, 1, 0.15, drumG, 'highpass', 5000);
    if (!d) { if (q % 4 === 2) hat(t, 'x', 0.5); } // seul tic-tac pendant le décompte
    else if (big || inten > 0.75) hat(t, (st.h || HH)[q], big ? 1 : 0.6);
    else if (q % 4 === 2) hat(t, 'x', 1);
    if (d && big && st.p && st.p[q] !== '.') hitS(st.pT || 'cb', t, 0.1, 0, st.pR || 1); // percussion (cloche de 808, plus ou moins grave)
    const rif = b % 4 === 3 && st.rifB || st.rifA, rf = rif[q];
    if (d && rf != null) { let n = 1; while (q + n < 16 && rif[q + n] == null) n++; // tenue jusqu'à la note suivante, bornée par bLen
      bass(st, hz(root + rf), t, S16 * Math.min(n, st.bLen || 1.9) * 0.95, lerp(0.32, 0.5, m), lerp(450 + 1200 * inten, 2800, big ? 1 : m)); }
    else if (!d && q % 8 === 0) bass(st, hz(root + 12), t, S16 * 6, 0.3, 500);
    if (q === 0 && st.pad !== 0) { const lv = 0.06 * (st.padV || 1);
      if (st.gate && d) { for (let i = 0; i < 16; i++) if (st.gate[i] !== '.') for (const n of ch) voice(st.pad, hz(n), t + i * S16, S16 * 0.9, lv * 1.4, padF); } // nappe hachée (gate de trance)
      else for (const n of ch) voice(st.pad, hz(n), t, S16 * 17, lv, padF, 0.4); }
    const ac = st.arp && st.arp[q];
    if (ac && ac !== '.' && (d || q % 2 === 0)) voice(st.arpW || 'sqr', hz(ch[ac % 4 % ch.length] + 12 + (ac >= 4 ? 12 : 0)), t, st.arpL || 0.16, (q % 4 === 0 ? 1.3 : 1) * lerp(0.045, 0.03, m) * (st.arpV || 1), arpIn); // 0-3 : notes de l'accord ; 4-7 : à l'octave
    if (d && st.stab && st.stab[q] !== '.' && (st.stabAlways || (big && B))) for (const n of ch) voice(st.stabW || 'saw', hz(n + 12 + (st.stabO || 0)), t, st.stabL || 0.14, (big ? 0.05 : 0.035) * (st.stabV || 1), arpIn);
    if (d && big && st.lead) { const L = st.lead[bar % st.lead.length], N = L[q];
      if (N != null && N !== R) { let n = 1; while (q + n < 16 && L[q + n] == null) n++;
        const w = st.leadW || 'saw', os = voice(w, hz(N), t, S16 * n * 1.15, (CV[w].lv || 0.08) * (st.leadV || 1), leadIn) || [];
        if (st.gl && lastN) for (const o of os) { o.frequency.setValueAtTime(hz(lastN), t); o.frequency.exponentialRampToValueAtTime(hz(N), t + st.gl); } // portamento
        if (st.vib && os.length) { const l = AC.createOscillator(), lg = AC.createGain(); l.frequency.value = 5.5; lg.gain.value = st.vib; l.connect(lg); for (const o of os) lg.connect(o.detune); l.start(t); l.stop(t + S16 * n * 1.2); }
        lastN = N;
        if (lead) osc('triangle', hz(N + 12), t, S16 * n, 0.04, leadIn); } }
    if (driftL > 0.3) osc('sawtooth', hz(ch[(q * 2) % 3] + 24), t, 0.1, 0.07 * driftL, acid); // ligne acide tant qu'on glisse
    if (st.sweep) swF.frequency.setTargetAtTime(big ? 16000 : 350 * 2 ** (3.6 * (0.5 - 0.5 * Math.cos(Math.PI * (s % 128) / 64))), t, 0.08); // filtre balayé sur 8 mesures, grand ouvert dans le secteur chaud
  }
  const lvl = () => menu ? (MENU[M.id] || MENU.ville).v : ST[station].vol || 1; // niveau de la station : réglé par mesure pour que toutes sortent au même volume
  function retune(t) { // (re)cale le séquenceur et le bus sur la station ou sur la boucle de menu
    const st = ST[station]; S16 = 60 / (menu ? (MENU[M.id] || MENU.ville).bpm : st.bpm) / 4; t0 = nextT = t; stp = 0; lastN = lastB = 0;
    if (!AC) return;
    dly.delayTime.value = S16 * 3; dlyFb.gain.value = menu ? 0.5 : 0.42;
    busDry.gain.value = !menu && st.drive ? 0.3 : 1; busDrv.gain.value = !menu && st.drive ? 0.45 : 0; // saturation de tout le bus (électro saturée, techno industrielle)
    swF.frequency.cancelScheduledValues(t); swF.frequency.setValueAtTime(!menu && st.sweep ? 500 : 20000, t); swF.Q.value = !menu && st.sweep ? 5 : 0.7;
  }
  function setStation(i) {
    station = (((i | 0) % ST.length) + ST.length) % ST.length;
    try { localStorage.setItem(RK(), station); } catch (e) { }
    if (!AC) { S16 = 60 / ST[station].bpm / 4; return; }
    const t = AC.currentTime; // grésillement entre deux stations : la musique se coupe, friture qui balaie la bande, craquements
    tuneG.gain.cancelScheduledValues(t); tuneG.gain.setValueAtTime(0, t); tuneG.gain.setValueAtTime(0, t + 0.32); tuneG.gain.linearRampToValueAtTime(lvl(), t + 0.42); // shortcut: les nappes de l'ancienne station finissent de sonner après la friture (1 s au plus), à couper par un bus par station si ça s'entend
    const f = nz(t, 0.36, 0.2, V.ui, 'bandpass', 900, 2); if (f) { f.frequency.exponentialRampToValueAtTime(3200, t + 0.16); f.frequency.exponentialRampToValueAtTime(1300, t + 0.34); }
    for (let k = 0; k < 5; k++) nz(t + Math.random() * 0.3, 0.012, 0.25, V.ui, 'highpass', 2000);
    if (!menu) retune(t + 0.34);
  }
  function carte(m) { // change de carte (banc d'écoute) : stations, ambiance et couleur du menu
    M = m; ST = M.radio; TH = M.th; station = 0;
    try { station = clamp(+localStorage.getItem(RK()) || 0, 0, ST.length - 1); } catch (e) { }
    S16 = 60 / ST[station].bpm / 4;
    if (AC) { retune(AC.currentTime + 0.05); buildAmb(); }
  }
  carte(M);
  function buildAmb() {
    if (ambBed) ambBed.disconnect();
    ambBed = gain(1, V.amb);
    for (const [type, f, q, lv, rate, depth] of AMB[M.id] || []) {
      const s = AC.createBufferSource(), g = gain(lv, ambBed); s.buffer = nbuf; s.loop = true; s.connect(filt(type, f, q, g)); s.start(0, Math.random() * 2);
      if (rate) { const l = AC.createOscillator(); l.frequency.value = rate; l.connect(gain(lv * depth, g.gain)); l.start(); }
    }
  }
  function ambEvent(t) { // événements du lieu, espacés au hasard ; renvoie le délai avant le suivant
    const id = M.id, rnd = (a, b) => a + Math.random() * (b - a);
    if (id === 'touge') { const f = Math.random() < 0.7 ? 4300 : 5100; for (let i = 0; i < 6; i++) osc('sine', f, t + i * 0.03, 0.014, 0.02, ambBed); return rnd(0.6, 1.4); } // grillons
    if (id === 'paris') { for (let i = 0, n = 2 + Math.random() * 4 | 0, f = rnd(2600, 3800); i < n; i++) { const o = osc('sine', f, t + i * 0.11, 0.08, 0.016, ambBed); o && o.frequency.exponentialRampToValueAtTime(f * rnd(0.8, 1.4), t + i * 0.11 + 0.07); } return rnd(1.5, 5); } // oiseaux
    if (id === 'wangan') { for (const [type, f] of [['sawtooth', 98], ['square', 147]]) { const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.value = f; o.connect(filt('lowpass', 420, 0.7, g)); g.connect(ambBed);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.03, t + 0.4); g.gain.setValueAtTime(0.03, t + 2.2); g.gain.linearRampToValueAtTime(0, t + 3); o.start(t); o.stop(t + 3.1); } return rnd(25, 45); } // corne de navire
    if (id === 'canal') { for (let i = 0; i < 110; i++) nz(t + i * 0.075, 0.06, 0.09 * Math.sin(Math.PI * i / 110), ambBed, 'lowpass', 170); return rnd(30, 50); } // hélicoptère qui passe au loin
    if (id === 'ville') { const o = AC.createOscillator(), g = AC.createGain(); o.frequency.setValueAtTime(620, t); for (let i = 0; i < 4; i++) { o.frequency.linearRampToValueAtTime(840, t + i + 0.5); o.frequency.linearRampToValueAtTime(620, t + i + 1); }
      o.connect(filt('lowpass', 1200, 0.7, g)); g.connect(ambBed); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.012, t + 1.5); g.gain.linearRampToValueAtTime(0, t + 4); o.start(t); o.stop(t + 4.1); return rnd(25, 50); } // sirène lointaine
    return 10;
  }
  function pump() { // avance le séquenceur jusqu'à 0,12 s devant l'horloge audio
    while (nextT < AC.currentTime - 0.2) { nextT += S16; stp++; } // onglet en veille : on saute au lieu de rattraper
    while (nextT < AC.currentTime + 0.12) { sched(stp++, nextT); nextT += S16; }
  }
  function initAudio(ctx) { // ctx : contexte hors ligne pour la mesure des niveaux (banc d'écoute) ; sans argument, le contexte audio du navigateur
    if (AC && live && !ctx) return AC.resume();
    if (AC && live) AC.close();
    AC = ctx || new (window.AudioContext || window.webkitAudioContext)(); live = !ctx;
    const comp = AC.createDynamicsCompressor(); outG = gain(0.67, AC.destination); comp.connect(outG); // marge après le compresseur : mesuré, aucune crête au-dessus de -3 dB
    vu = AC.createAnalyser(); vu.fftSize = 2048; outG.connect(vu); // ce qui sort vraiment, pour le vumètre du banc d'écoute
    lastHit = 0; ambT = 2;
    master = gain(0.9, comp); ana = AC.createAnalyser(); ana.fftSize = 64; master.connect(ana);
    for (const k in vol) V[k] = gain(vol[k], master);
    nbuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
    const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // réverbération de tunnel : bruit qui s'éteint en 1,6 s ; la musique et le moteur y sont envoyés selon e.tun
    rev = AC.createConvolver(); const ir = AC.createBuffer(2, AC.sampleRate * 1.6, AC.sampleRate);
    for (let c = 0; c < 2; c++) { const x = ir.getChannelData(c); for (let i = 0; i < x.length; i++) x[i] = (Math.random() * 2 - 1) * Math.exp(-i / AC.sampleRate / 0.35); }
    rev.buffer = ir; rev.connect(gain(0.5, master)); musSend = gain(0, rev); motSend = gain(0, rev); V.mus.connect(musSend); V.mot.connect(motSend);
    musF = filt('lowpass', 18000, 0.7, V.mus); musicG = gain(musicOn ? 1 : 0, musF); tuneG = gain(1, musicG);
    drumG = gain(1, tuneG); kdrv = shaper(3, gain(0.8, drumG));
    swF = filt('lowpass', 20000, 0.7, tuneG); busDry = gain(1, swF); busDrv = gain(0, swF);
    duckG = gain(1, busDry); duckG.connect(gain(2.5, shaper(4, busDrv))); // tout sauf la batterie passe par ce bus pompé
    bsat = shaper(5, gain(0.5, duckG)); bclean = gain(0.7, duckG);
    const fz = filt('peaking', 1000, 1, filt('lowpass', 2600, 0.7, gain(0.3, duckG))); fz.gain.value = 5; fuzz = gain(6, shaper(8, fz)); // guitare : écrêtage, puis baffle
    padG = gain(1, duckG); padF = filt('lowpass', 800, 0.5, padG);
    arpIn = filt('lowpass', 3000, 0.5, duckG); acid = filt('lowpass', 1900, 12, arpIn); leadIn = filt('lowpass', 4500, 1, duckG);
    dly = AC.createDelay(1); dlyFb = gain(0.42, dly); arpIn.connect(dly); leadIn.connect(dly); dly.connect(dlyFb); dly.connect(duckG);
    pret = Promise.all(Object.keys(window.SMP || {}).map(k => new Promise(ok => { // décodage des sons de TR-808 ; en cas d'échec la batterie reste synthétisée
      const bin = atob(window.SMP[k]), u8 = Uint8Array.from(bin, ch => ch.charCodeAt(0));
      AC.decodeAudioData(u8.buffer, b => { smp[k] = b; ok(); }, ok);
    })));
    // moteur : 3 oscillateurs (ordre 1, 1/2, 3/2) → saturation → filtre de charge → formant d'échappement → battement
    const out = gain(0, V.mot), am = gain(1, out), pk = filt('peaking', 140, 1.5, am); pk.gain.value = 6; // résonance d'échappement, dans le grave
    const lp = filt('lowpass', 800, 0.7, pk), drive = gain(0.6, shaper(3, lp));
    const mk = (type, g) => { const o = AC.createOscillator(); o.type = type; o.connect(gain(g, drive)); o.start(); return o; };
    const lfo = AC.createOscillator(), lfoG = gain(0.2, am.gain);
    lfo.connect(lfoG); lfo.start();
    eng = { a: mk('sawtooth', 0.5), b: mk('square', 0.45), c: mk('sawtooth', 0.08), lfo, lfoG, lp, drive, out };
    // pneus : la glisse se tient longtemps, donc un feulement grave et large plutôt qu'un sifflement ; + grondement de ripage
    const ns = AC.createBufferSource(); ns.buffer = nbuf; ns.loop = true; ns.start();
    const sqG = gain(0, V.pneu), sqL = filt('lowpass', 1500, 0.7, sqG), b1 = filt('bandpass', 420, 5, sqL), b2 = filt('bandpass', 640, 4, gain(0.5, sqL));
    ns.connect(b1); ns.connect(b2); sq = { g: sqG, b1, b2 };
    scrubG = gain(0, V.pneu); ns.connect(filt('lowpass', 160, 0.7, scrubG));
    scrapeG = gain(0, V.choc); ns.connect(filt('bandpass', 1700, 1.2, scrapeG)); ns.connect(filt('lowpass', 260, 0.7, gain(1.5, scrapeG))); // frottement contre le mur : tôle + grondement
    uiF = filt('lowpass', 3000, 0.5, V.ui);
    windG = gain(0, V.vent); ns.connect(filt('lowpass', 400, 0.5, windG));
    buildAmb(); retune(AC.currentTime + 0.1); tuneG.gain.value = lvl();
    if (live) { AC.resume(); timer = timer || setInterval(() => live && pump(), 30); }
  }
  const beep = f => AC && osc('square', f, AC.currentTime, 0.25, 0.2, V.ui);
  // bruitages ponctuels : appelés par audioFrame, et un par un par le banc d'écoute
  function clac(t = AC.currentTime) { osc('triangle', 80, t, 0.06, 0.07, V.mot); } // clac de boîte ; la coupure de poussée vient de la physique
  function choc(hit, t = AC.currentTime) { nz(t, 0.25, Math.min(0.6, hit * 0.04), V.choc, 'lowpass', 400); }
  function boostFx(t = AC.currentTime) { const o = osc('sawtooth', 220, t, 0.5, 0.1, filt('lowpass', 3000, 0.5, V.choc)); o.frequency.exponentialRampToValueAtTime(880, t + 0.4); const w = nz(t, 0.6, 0.08, V.choc, 'bandpass', 500, 1.5); w.frequency.exponentialRampToValueAtTime(4000, t + 0.5); } // boost de sortie de glisse : sifflement + souffle
  function petarade(spool = 1, t = AC.currentTime) { nz(t, 0.25, 0.04 * spool, V.mot, 'bandpass', 1400, 1.5); for (let i = 0; i < 3; i++) nz(t + 0.08 + Math.random() * 0.4, 0.035, 0.12, V.mot, 'lowpass', 900); } // lever de pied à haut régime
  // e : état de la course pour cette image — { state, car, T, hot (0..1 dans le secteur chaud), tun (0..1 dans le tunnel), r (vitesse 0..1), sp, gas, hit, up (rapport monté), rpm, load, spool, stun }
  function audioFrame(dt, e) {
    if (!AC) return;
    const { state, car, T, r, sp, gas, hit, up, rpm, load, spool, stun } = e, N = T.n, tun = e.tun || 0, CARD = M.car;
    if (state === 'pause') { for (const p of [eng.out.gain, sq.g.gain, scrubG.gain, scrapeG.gain, windG.gain]) p.setTargetAtTime(0, AC.currentTime, 0.05); return; } // en pause : la radio continue, la voiture se tait
    const t = AC.currentTime, racing = state === 'race', k = (p, v, tc = 0.04) => p.setTargetAtTime(v, t, tc);
    if ((state === 'title') !== menu) { menu = !menu; retune(t + 0.05); tuneG.gain.cancelScheduledValues(t); tuneG.gain.setValueAtTime(0, t); tuneG.gain.linearRampToValueAtTime(lvl(), t + 0.3); } // menu ↔ course : la boucle de menu laisse la place à la station
    // moteur (discret sous la musique) : coupure au passage de rapport, timbre selon la charge, turbo, pétarades au lever de pied
    if (up) clac(t);
    const f = rpm * CARD.red / 40 * CARD.son; // la moitié de la fréquence d'allumage d'un 6 cylindres (3 explosions par tour) : même montée en régime, une octave plus grave
    k(eng.a.frequency, f); k(eng.b.frequency, f / 2); k(eng.c.frequency, f * 2); k(eng.lfo.frequency, f / 3);
    k(eng.lp.frequency, 180 + rpm * 320 + load * 380); k(eng.drive.gain, 0.35 + 0.5 * load); k(eng.lfoG.gain, 0.1 + 0.15 * load); // filtre bas : le grave domine
    k(eng.out.gain, state === 'title' ? 0.004 : 0.007 + 0.012 * load + 0.004 * rpm); // volontairement sous la musique
    if (lastGas && !gas && racing && rpm > 0.55 && spool > 0.5) petarade(spool, t);
    lastGas = gas;
    // pneus : rien en appui normal ; le feulement monte lentement avec l'angle de glisse, en volume plus qu'en hauteur
    const slip = Math.abs(car.vl), a = sp > 8 ? clamp((slip - 4) / 14, 0, 1) : 0, fq = 380 + 150 * a + 10 * Math.sin(t * 21);
    k(sq.b1.frequency, fq, 0.05); k(sq.b2.frequency, fq * 1.52, 0.05); k(sq.g.gain, 0.22 * a, 0.2);
    k(scrubG.gain, 0.5 * clamp(slip / 12, 0, 1) * r, 0.08); k(windG.gain, 0.22 * r * r, 0.1);
    k(scrapeG.gain, car.rub ? 0.05 + 0.1 * r : 0, 0.05);
    if (hit > 3 && t - lastHit > 0.15) { lastHit = t; choc(hit, t); }
    if (car.boost > 0 && !wasBoost) boostFx(t);
    wasBoost = car.boost > 0;
    // ambiance du lieu : s'efface dans le tunnel ; événements espacés au hasard
    k(ambBed.gain, 1 - 0.85 * tun, 0.3); if ((ambT -= dt) < 0) ambT = ambEvent(t + 0.05);
    // musique : sections et filtres suivent la course
    const a0 = (car.idx - T.h0 + N) % N, inside = a0 < T.h1 - T.h0, near = racing && !inside && N - a0 < 60;
    if (near && !wasNear) riser(t, clamp((N - a0) * 2 / Math.max(sp, 20), 0.5, 3));
    if (inside !== wasIn && racing) crash(t);
    if (TH.alarme && inside && !wasIn && racing) for (let i = 0; i < 6; i++) osc('square', i % 2 ? 660 : 880, t + 0.25 + i * 0.18, 0.16, 0.07, arpIn); // sirène d'alarme à l'entrée
    wasNear = near; wasIn = inside;
    drums = racing ? 1 : 0; lead = racing && !inside && car.idx >= T.h1 && car.dist > 0;
    mix += ((racing ? e.hot : 0) - mix) * Math.min(1, dt * 3);
    inten += (r - inten) * Math.min(1, dt * 2); driftL += ((car.drift ? 1 : 0) - driftL) * Math.min(1, dt * 6);
    // la musique s'ouvre avec la vitesse ; un gros choc l'étouffe ; dans un tunnel elle est étouffée et réverbérée, et le moteur résonne
    k(musF.frequency, stun > 0 ? 350 : Math.min(state === 'title' ? 5000 : 900 * 20 ** Math.min(1, inten * 1.4 + mix), lerp(18000, 2500, tun)), 0.08);
    k(musSend.gain, 0.7 * tun, 0.2); k(motSend.gain, 2.5 * tun, 0.2);
    k(padG.gain, lerp(1, 0.6, mix), 0.1); k(padF.frequency, lerp(800, 2000, mix), 0.1);
  }

  document.addEventListener('visibilitychange', () => { if (AC && live) document.hidden ? AC.suspend() : AC.resume(); }); // pas de musique hachée ni de moteur figé en arrière-plan
  window.SON = {
    init: initAudio, frame: audioFrame, setStation, carte, pump, beep, stinger,
    crash: () => AC && crash(),
    tonnerre: () => AC && nz(AC.currentTime + 0.4, 2.4, 0.35, V.amb, 'lowpass', 140),
    toggleMusic() { musicOn = !musicOn; if (AC) musicG.gain.value = musicOn ? 1 : 0; },
    volume(fam, v) { vol[fam] = v; if (V[fam]) V[fam].gain.value = v; },
    evenement: () => { ambT = 0; }, get live() { return live; },
    clac: () => AC && clac(), choc: v => AC && choc(v), boost: () => AC && boostFx(), petarade: () => AC && petarade(),
    moniteur(v) { if (outG) outG.gain.value = 0.67 * v; }, get vu() { return vu; }, // gain d'écoute du banc : sans effet sur le jeu
    get vol() { return vol; }, get pret() { return pret; }, get stations() { return ST; },
    get station() { return station; }, get nom() { return ST[station].name; }, get fq() { return ST[station].fq; }, get genre() { return ST[station].genre; }, get musicOn() { return musicOn; },
    get beat() { return AC ? Math.max(0, (AC.currentTime - t0) / (4 * S16)) : 0; }, // temps écoulés depuis le début de la station, calés sur le kick
    get pulse() { return AC ? Math.exp(-(this.beat % 1) * 5) : 0; },
    get ana() { return ana; }, // analyseur de spectre, pour l'égaliseur du HUD
    get ac() { return AC; }, get out() { return master; }, get smp() { return Object.keys(smp); }, // prises de test
  };
})();
