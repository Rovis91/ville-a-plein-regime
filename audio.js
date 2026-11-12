// Ville à plein régime — audio : tout est synthétisé (bande-son originale et adaptative). Stations de la carte : champ radio de cartes.js.
// Interface (window.SON) : init() au premier geste · frame(dt, e) à chaque image · setStation(i), toggleMusic() · beep(f), crash(), stinger(rec),
// tonnerre() · lus par le jeu : station, nom, fq, musicOn, beat, pulse, ana · prises de test : ac, out, smp.
(() => {
  const M = CARTE, TH = M.th;
  const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let AC, ana, bsat, master, musicG, musF, padF, padG, duckG, arpIn, leadIn, acid, nbuf, t0 = 0, nextT = 0, stp = 0, musicOn = true, lastHit = 0;
  // état musical piloté par la course : mix = échangeur, inten = vitesse, driftL = glisse, drums/lead = sections, stun = choc
  let mix = 0, inten = 0, driftL = 0, drums = 0, lead = false, wasIn = false, wasNear = false;
  let eng, sq, scrubG, windG, lastGas = 0;
  const hz = m => 440 * 2 ** ((m - 69) / 12);
  const ST = M.radio, RK = 'vpr.radio' + (M.id === 'ville' ? '' : '.' + M.id); // stations de la carte (motifs dans cartes.js) ; dernière station écoutée, par carte
  let lastN = 0;
  let station = 0, S16 = 60 / ST[0].bpm / 4, dly, bclean, wasBoost = false;
  function setStation(i) {
    station = (((i | 0) % ST.length) + ST.length) % ST.length; S16 = 60 / ST[station].bpm / 4;
    try { localStorage.setItem(RK, station); } catch (e) { }
    if (!AC) return;
    const t = AC.currentTime; nz(t, 0.25, 0.25, master, 'bandpass', 2400, 0.6); // friture entre deux stations
    t0 = nextT = t + 0.3; stp = 0; dly.delayTime.value = S16 * 3;
  }
  try { setStation(+localStorage.getItem(RK) || 0); } catch (e) { }
  const gain = (v, dest) => { const g = AC.createGain(); g.gain.value = v; g.connect(dest); return g; };
  const filt = (type, f, q, dest) => { const b = AC.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.connect(dest); return b; };
  const env = (dest, t, dur, vol, a = 0.005) => { const g = AC.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); g.connect(dest); return g; };
  function osc(type, f, t, dur, vol, dest, det = 0) {
    if (vol < 0.002) return;
    const o = AC.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = det; o.connect(env(dest, t, dur, vol)); o.start(t); o.stop(t + dur + 0.05); return o;
  }
  function nz(t, dur, vol, dest, type, f, q = 1) {
    if (vol < 0.002) return;
    const s = AC.createBufferSource(); s.buffer = nbuf; s.loop = true; s.connect(filt(type, f, q, env(dest, t, dur, vol))); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  function bass(f, t, dur, vol, cut, sat) { // scie + carré désaccordé + sub ; saturée ou propre selon la station
    if (vol < 0.002) return;
    const fl = filt('lowpass', cut, 7, env(sat ? bsat : bclean, t, dur, vol));
    fl.frequency.setValueAtTime(cut, t); fl.frequency.exponentialRampToValueAtTime(140, t + dur);
    for (const [type, det] of [['sawtooth', 0], ['square', 12]]) { const o = AC.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det; o.connect(fl); o.start(t); o.stop(t + dur + 0.05); }
    osc('sine', f, t, dur, vol * 0.8, duckG);
  }
  const smp = {};
  function hitS(name, t, vol, dur = 0) { // dur : coupe le son en fondu (la grosse caisse de 808 résonne 1,5 s, trop long à ce tempo)
    const b = smp[name]; if (!b || vol < 0.002) return !!b;
    vol *= 0.6; // les enregistrements sont plus forts que les sons synthétisés qu'ils remplacent
    const s = AC.createBufferSource(), gn = gain(vol, musicG); s.buffer = b; s.connect(gn); s.start(t);
    if (dur) { gn.gain.setValueAtTime(vol, t + dur * 0.6); gn.gain.linearRampToValueAtTime(0, t + dur); s.stop(t + dur + 0.02); }
    return true;
  }
  function kick(t, v) { if (hitS(v > 0.75 ? 'bdL' : 'bd', t, v, v > 0.75 ? 0.42 : 0.3)) return;
    const o = osc('sine', 165, t, 0.3, v, musicG); o && o.frequency.exponentialRampToValueAtTime(40, t + 0.11); nz(t, 0.015, v * 0.25, musicG, 'highpass', 3000); }
  function clap(t, v) { if (hitS(ST[station].sn ? 'sd' : 'cp', t, v * 0.9)) return; // caisse claire sur les stations breakbeat et g-funk, clap ailleurs
    for (let i = 0; i < 3; i++) nz(t + i * 0.012, 0.03, v * 0.6, musicG, 'bandpass', 1500, 1.2); nz(t + 0.03, 0.2, v, musicG, 'bandpass', 1500, 1.2); osc('triangle', 190, t, 0.08, v / 2, musicG); }
  function riser(t, dur) { // montée de bruit avant l'entrée de l'échangeur
    const s = AC.createBufferSource(), g = AC.createGain(), f = filt('bandpass', 400, 2, g);
    s.buffer = nbuf; s.loop = true; s.connect(f); g.connect(musicG);
    f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(7000, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.05);
    s.start(t); s.stop(t + dur + 0.1);
  }
  function crash(t = AC.currentTime) { // impact : départ, entrée et sortie de l'échangeur
    nz(t, 1.4, 0.28, musicG, 'highpass', 4500);
    const o = osc('sine', 70, t, 0.7, 0.8, musicG); o && o.frequency.exponentialRampToValueAtTime(30, t + 0.5);
  }
  const stinger = up => AC && (up ? [69, 73, 76, 81, 85] : [69, 64, 60, 57]).forEach((n, i) => osc('square', hz(n), AC.currentTime + i * 0.09, 0.5, 0.12, arpIn));
  // un pas de double-croche, joué avec les motifs de la station. Arrangement : léger sur le viaduc (riff filtré + arpège), plein dans
  // l'échangeur et sur le dernier secteur (riff ouvert, clap, charlestons, thème) ; sections A/B de 8 mesures, roulement en fin de phrase.
  function sched(s, t) {
    t += (s & 1) * (ST[station].sw || 0) * S16; // swing : les doubles-croches impaires traînent
    const st = ST[station], bar = s >> 4, b = bar % 8, q = s % 16, ch = st.CH[b], m = mix, d = drums, big = m > 0.5 || lead, B = (bar >> 3) & 1, fill = d && b === 7 && q >= 12;
    if (d && !fill && (big && B ? st.kickB : st.kick)[q] === '1') {
      kick(t, lerp(0.55, 0.95, m));
      duckG.gain.cancelScheduledValues(t); duckG.gain.setValueAtTime(0.35, t); duckG.gain.linearRampToValueAtTime(1, t + Math.min(0.24, S16 * 1.9)); // pompe : tout plonge sous le kick
    }
    if (d && q % 8 === 4) clap(t, big ? 0.5 : inten > 0.5 ? Math.max(0.25, st.clapMin) : st.clapMin);
    if (fill) hitS('sd', t, 0.25 + 0.1 * (q - 12)) || nz(t, 0.08, 0.2 + 0.08 * (q - 12), musicG, 'bandpass', 1800, 0.8);
    if (d && big && B && (q === 7 || q === 15)) nz(t, 0.05, 0.13, musicG, 'bandpass', 2200, 0.8); // notes fantômes
    if (d && q === 0 && b === 0) nz(t, 1, 0.15, musicG, 'highpass', 5000);
    if (q % 4 === 2) hitS(big ? 'oh' : 'ch', t, (d ? (big ? 0.2 : 0.1) : 0.05) * 1.6) || nz(t, big ? 0.12 : 0.05, d ? (big ? 0.2 : 0.1) : 0.05, musicG, 'highpass', 6500); // charleston ouvert ; seul tic-tac pendant le décompte
    else if (d && (big || inten > 0.75)) hitS('ch', t, (q % 2 ? 0.07 : 0.11) * 1.4) || nz(t, 0.03, q % 2 ? 0.07 : 0.11, musicG, 'highpass', 9000);
    if (d && big && st.cb && (q === 3 || q === 11)) hitS('cb', t, 0.1); // cloche de 808 sur la station house
    const rif = b % 4 === 3 ? st.rifB : st.rifA, rf = rif[q];
    if (d && rf != null) bass(hz(st.ROOT[b] + rf), t, S16 * (rif[(q + 1) % 16] == null ? 1.8 : 0.95), lerp(0.32, 0.5, m), lerp(450 + 1200 * inten, 2800, big ? 1 : m), st.sat);
    else if (!d && q % 8 === 0) bass(hz(st.ROOT[b] + 12), t, S16 * 6, 0.3, 500, st.sat);
    if (q === 0) {
      const g = AC.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + 0.4);
      g.gain.setValueAtTime(0.06, t + S16 * 14); g.gain.linearRampToValueAtTime(0, t + S16 * 17); g.connect(padF);
      for (const n of ch) for (const dt of [-8, 8]) { const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(n); o.detune.value = dt; o.connect(g); o.start(t); o.stop(t + S16 * 17.5); }
    }
    if (st.arp && (d || q % 2 === 0)) osc('square', hz(ch[[0, 1, 2, 1, 2, 0, 1, 2][q % 8]] + 12 + (q >= 8 ? 12 : 0)), t, 0.16, (q % 4 === 0 ? 1.3 : 1) * lerp(0.045, 0.03, m), arpIn);
    if (d && st.stab.includes(q) && (st.stabAlways || (big && B))) for (const n of ch) osc('sawtooth', hz(n + 12), t, 0.14, big ? 0.05 : 0.035, arpIn);
    if (d && big && st.lead) for (const [p, n, len] of st.lead[b]) if (q === p) {
      const du = S16 * len * 1.2; // timbre du thème selon la station : scies désaccordées, triangle à vibrato, ou sinus qui glisse depuis la note précédente
      if (st.leadW === 'tri') { const o = osc('triangle', hz(n), t, du, 0.14, leadIn); if (o) { const l = AC.createOscillator(); l.frequency.value = 5.5; l.connect(gain(14, o.detune)); l.start(t); l.stop(t + du); } }
      else if (st.leadW === 'sine') { const o = osc('sine', hz(lastN || n), t, du, 0.12, leadIn); o && o.frequency.exponentialRampToValueAtTime(hz(n), t + 0.07); lastN = n; }
      else for (const dt of [-10, 10]) osc('sawtooth', hz(n), t, du, 0.055, leadIn, dt);
      if (lead) osc('triangle', hz(n + 12), t, S16 * len, 0.04, leadIn); }
    if (driftL > 0.3) osc('sawtooth', hz(ch[(q * 2) % 3] + 24), t, 0.1, 0.07 * driftL, acid); // ligne acide tant qu'on glisse
  }
  function initAudio() {
    if (AC) return AC.resume();
    AC = new (window.AudioContext || window.webkitAudioContext)();
    const comp = AC.createDynamicsCompressor(); comp.connect(AC.destination);
    master = gain(0.9, comp); ana = AC.createAnalyser(); ana.fftSize = 64; master.connect(ana);
    musF = filt('lowpass', 18000, 0.7, master); musicG = gain(1, musF);
    duckG = gain(1, musicG); // tout sauf la batterie passe par ce bus pompé
    bsat = AC.createWaveShaper(); bsat.curve = Float32Array.from({ length: 257 }, (_, i) => Math.tanh((i / 128 - 1) * 5)); bsat.connect(gain(0.5, duckG)); bclean = gain(0.7, duckG);
    padG = gain(1, duckG); padF = filt('lowpass', 800, 0.5, padG);
    arpIn = filt('lowpass', 3000, 0.5, duckG); acid = filt('lowpass', 1900, 12, arpIn); leadIn = filt('lowpass', 3800, 1, duckG);
    const dl = dly = AC.createDelay(1); dl.delayTime.value = S16 * 3; const fb = gain(0.42, dl); arpIn.connect(dl); leadIn.connect(dl); dl.connect(fb); dl.connect(duckG);
    for (const k in window.SMP || {}) { // décodage des sons de TR-808 ; en cas d'échec la batterie reste synthétisée
      const bin = atob(window.SMP[k]), u8 = Uint8Array.from(bin, ch => ch.charCodeAt(0));
      AC.decodeAudioData(u8.buffer, b => { smp[k] = b; }, () => { });
    }
    nbuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
    const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // moteur : 3 oscillateurs (ordre 1, 1/2, 3/2) → saturation → filtre de charge → formant d'échappement → battement
    const out = gain(0, master), am = gain(1, out), pk = filt('peaking', 140, 1.5, am); pk.gain.value = 6; // résonance d'échappement, dans le grave
    const lp = filt('lowpass', 800, 0.7, pk), sh = AC.createWaveShaper(), drive = gain(0.6, sh);
    sh.curve = Float32Array.from({ length: 257 }, (_, i) => Math.tanh((i / 128 - 1) * 3)); sh.connect(lp);
    const mk = (type, g) => { const o = AC.createOscillator(); o.type = type; o.connect(gain(g, drive)); o.start(); return o; };
    const lfo = AC.createOscillator(), lfoG = gain(0.2, am.gain);
    lfo.connect(lfoG); lfo.start();
    eng = { a: mk('sawtooth', 0.5), b: mk('square', 0.45), c: mk('sawtooth', 0.08), lfo, lfoG, lp, drive, out };
    // pneus : crissement = bruit en bande très étroite (tonal), + grondement grave de ripage
    const ns = AC.createBufferSource(); ns.buffer = nbuf; ns.loop = true; ns.start();
    const sqG = gain(0, master), b1 = filt('bandpass', 900, 28, sqG), b2 = filt('bandpass', 1350, 22, gain(0.6, sqG));
    ns.connect(b1); ns.connect(b2); sq = { g: sqG, b1, b2 };
    scrubG = gain(0, master); ns.connect(filt('lowpass', 160, 0.7, scrubG));
    windG = gain(0, master); ns.connect(filt('lowpass', 400, 0.5, windG));
    t0 = nextT = AC.currentTime + 0.1; AC.resume();
    setInterval(() => {
      while (nextT < AC.currentTime - 0.2) { nextT += S16; stp++; } // onglet en veille : on saute au lieu de rattraper
      while (nextT < AC.currentTime + 0.12) { sched(stp++, nextT); nextT += S16; }
    }, 30);
  }
  const beep = f => AC && osc('square', f, AC.currentTime, 0.25, 0.2, master);
  // e : état de la course pour cette image — { state, car, T, hot (0..1 dans le secteur chaud), r (vitesse 0..1), sp, gas, hit, up (rapport monté), rpm, load, spool, stun }
  function audioFrame(dt, e) {
    if (!AC) return;
    const { state, car, T, r, sp, gas, hit, up, rpm, load, spool, stun } = e, N = T.n;
    if (state === 'pause') { for (const p of [eng.out.gain, sq.g.gain, scrubG.gain, windG.gain]) p.setTargetAtTime(0, AC.currentTime, 0.05); return; } // en pause : la radio continue, la voiture se tait
    const t = AC.currentTime, racing = state === 'race', k = (p, v, tc = 0.04) => p.setTargetAtTime(v, t, tc);
    // moteur (discret sous la musique) : coupure au passage de rapport, timbre selon la charge, turbo, pétarades au lever de pied
    if (up) osc('triangle', 80, t, 0.06, 0.07, master); // clac de boîte ; la coupure de poussée vient de la physique
    const f = rpm * CARD.red / 40 * CARD.son; // la moitié de la fréquence d'allumage d'un 6 cylindres (3 explosions par tour) : même montée en régime, une octave plus grave
    k(eng.a.frequency, f); k(eng.b.frequency, f / 2); k(eng.c.frequency, f * 2); k(eng.lfo.frequency, f / 3);
    k(eng.lp.frequency, 180 + rpm * 320 + load * 380); k(eng.drive.gain, 0.35 + 0.5 * load); k(eng.lfoG.gain, 0.1 + 0.15 * load); // filtre bas : le grave domine
    k(eng.out.gain, 0.007 + 0.012 * load + 0.004 * rpm); // volontairement sous la musique
    if (lastGas && !gas && racing && rpm > 0.55 && spool > 0.5) { nz(t, 0.25, 0.04 * spool, master, 'bandpass', 1400, 1.5); for (let i = 0; i < 3; i++) nz(t + 0.08 + Math.random() * 0.4, 0.035, 0.12, master, 'lowpass', 900); }
    lastGas = gas;
    // pneus : rien en appui normal, crissement qui monte en hauteur avec la glisse
    const slip = Math.abs(car.vl), a = sp > 8 ? clamp((slip - 4) / 8, 0, 1) : 0, fq = 820 + 380 * a + 25 * Math.sin(t * 33);
    k(sq.b1.frequency, fq, 0.02); k(sq.b2.frequency, fq * 1.48, 0.02); k(sq.g.gain, 4 * a * Math.sqrt(a), 0.06);
    k(scrubG.gain, 0.5 * clamp(slip / 12, 0, 1) * r, 0.08); k(windG.gain, 0.22 * r * r, 0.1);
    if (hit > 3 && t - lastHit > 0.15) { lastHit = t; nz(t, 0.25, Math.min(0.6, hit * 0.04), master, 'lowpass', 400); }
    if (car.boost > 0 && !wasBoost) { const o = osc('sawtooth', 220, t, 0.5, 0.12, arpIn); o.frequency.exponentialRampToValueAtTime(880, t + 0.4); } // boost de sortie de glisse
    wasBoost = car.boost > 0;
    // musique : sections et filtres suivent la course
    const a0 = (car.idx - T.h0 + N) % N, inside = a0 < T.h1 - T.h0, near = racing && !inside && N - a0 < 60;
    if (near && !wasNear) riser(t, clamp((N - a0) * 2 / Math.max(sp, 20), 0.5, 3));
    if (inside !== wasIn && racing) crash(t);
    if (TH.alarme && inside && !wasIn && racing) for (let i = 0; i < 6; i++) osc('square', i % 2 ? 660 : 880, t + 0.25 + i * 0.18, 0.16, 0.07, arpIn); // sirène d'alarme à l'entrée
    wasNear = near; wasIn = inside;
    drums = racing ? 1 : 0; lead = racing && !inside && car.idx >= T.h1 && car.dist > 0;
    mix += ((racing ? e.hot : 0) - mix) * Math.min(1, dt * 3);
    inten += (r - inten) * Math.min(1, dt * 2); driftL += ((car.drift ? 1 : 0) - driftL) * Math.min(1, dt * 6);
    k(musF.frequency, stun > 0 ? 350 : 900 * 20 ** Math.min(1, inten * 1.4 + mix), 0.08); // la musique s'ouvre avec la vitesse ; un gros choc l'étouffe
    k(padG.gain, lerp(1, 0.6, mix), 0.1); k(padF.frequency, lerp(800, 2000, mix), 0.1);
  }
  document.addEventListener('visibilitychange', () => { if (AC) document.hidden ? AC.suspend() : AC.resume(); }); // pas de musique hachée ni de moteur figé en arrière-plan
  window.SON = {
    init: initAudio, frame: audioFrame, setStation, beep, stinger,
    crash: () => AC && crash(),
    tonnerre: () => AC && nz(AC.currentTime + 0.4, 2.4, 0.35, master, 'lowpass', 140),
    toggleMusic() { musicOn = !musicOn; if (AC) musicG.gain.value = musicOn ? 1 : 0; },
    get station() { return station; }, get nom() { return ST[station].name; }, get fq() { return ST[station].fq; }, get musicOn() { return musicOn; },
    get beat() { return AC ? Math.max(0, (AC.currentTime - t0) / (4 * S16)) : 0; }, // temps écoulés depuis le début de la station, calés sur le kick
    get pulse() { return AC ? Math.exp(-(this.beat % 1) * 5) : 0; },
    get ana() { return ana; }, // analyseur de spectre, pour l'égaliseur du HUD
    get ac() { return AC; }, get out() { return master; }, get smp() { return Object.keys(smp); }, // prises de test
  };
})();
