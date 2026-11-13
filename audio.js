// Ville à plein régime — audio : tout est synthétisé (bande-son originale et adaptative). Stations de chaque carte : RADIO dans cartes.js.
// Interface (window.SON) : init() au premier geste · frame(dt, e) à chaque image · quitter() / reprendre(m) autour d'un changement de carte au menu · setStation(i), toggleMusic(), carte(M), volume(famille, v) ·
// beep(f), crash(), stinger(rec), tonnerre() · éditeur de musique : ecoute, recale(), note(partie, n), fond, pas, timbres, kits · lus par le jeu : station, nom, fq, genre, musicOn, beat, pulse, ana · banc d'écoute et mesure :
// init(contexte hors ligne), pump(), pret, live, vol, stations, evenement(), moniteur(gain), vu, et les bruitages ponctuels clac(), levier(), choc(v),
// boost(), petarade() · prises de test : ac, out, smp.
// Chaîne : timbres (PATCH) → tranche de la partie → (batterie (KIT) | bus pompé → filtre balayé → saturation de bus) → coupure de station →
// couleur de la station (3 bandes) → musique oui/non → filtre de vitesse et de tunnel → famille « mus » → master → compresseur. Familles réglables : mus, mot (moteur, boîte), pneu, vent, amb (lieu), pluie, choc (chocs, frottement, boost), ui (bips, jingle, radio).
(() => {
  const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let TR = 0; // transposition du dernier tour, en demi-tons
  const hz = m => 440 * 2 ** ((m + TR - 69) / 12), R = -99, OUT = 0.56, CLAC = 0.6, LEV = 1; // R : silence dans un thème (voir mel() dans cartes.js)
  let M = CARTE, ST = M.radio, TH = M.th;
  // prises de l'éditeur de musique (editeur.html) : muet / solo par partie, section jouée en boucle, témoins (jusqu'à quand chaque partie sonne), section en cours
  const EC = { mute: {}, solo: null, boucle: null, joue: {}, sec: '' }, jo = (p, t, d = 0.12) => { EC.joue[p] = t + d; };
  const pv = (st, p) => (EC.solo ? EC.solo === p : !EC.mute[p]) ? (st.mx && st.mx[p] != null ? st.mx[p] : 1) : 0; // niveau d'une partie : st.mx, réglé dans l'éditeur
  let AC, live = true, timer, pret = Promise.resolve(), ana, master, musicG, tuneG, drumG, musF, duckG, swF, busDry, busDrv, acid, fuzz, kdrv, bsat, dly, dlyFb, eqL, eqM, eqH, mrevG, drumRv, revIn, echoIn, choIn, mbuf, secG, drumF, gritDry, gritWet, hpF, rev, musSend, motSend, nbuf, outG, vu;
  let t0 = 0, nextT = 0, stp = 0, musicOn = true, lastHit = 0, lastMus = -9, lastN = 0, lastB = 0, menu = true;
  const vol = { mus: 1, mot: 1, pneu: 1, vent: 1, amb: 1, choc: 1, ui: 1, pluie: 1 }, V = {}; // volume par famille (banc d'écoute) et leurs nœuds
  // état musical piloté par la course : mix = secteur chaud, inten = vitesse, driftL = glisse, drums = batterie, fin = dernier secteur
  const MX = { b: 1, d: 1.6, c: 2, g: 2, a: 2, l: 1.6 }; // niveau de chaque tranche : le médium et l'aigu ne doivent pas disparaître sous la basse
  let tens = 0, glisse = false, acquis = false, acqDit = false, boostPend = false, boostL = false; // glisse : tension (0..1), en cours, boost acquis, palier déjà joué, relâchement à jouer, boost en cours
  let lastRoll = -9; // dernière mesure de montée : le drop la suit
  let bigS = false, lastFill = -9, sortie = -1, grit = 0, curRoot = 33, lap = 1, lapN = -1; const was = {}; // lap : 0 premier tour (sobre), 1 normal, 2 dernier tour (le plus intense) ; // refrain en cours ; dernière relance ; parties qui jouaient à la mesure précédente
  let W = {}; const strip = {}; // ondes sur mesure ; tranches de mixage par partie (b basse, d nappe, c g accords, a arpège, l thème)
  let mix = 0, inten = 0, driftL = 0, drums = 0, fin = false, wasIn = false, wasNear = false, wasBoost = false;
  let rubT = 0, satT = 0, platine = 0; // frottement bref entre voitures ; saturation de la musique après un choc ; ralenti de platine (1 → 0)
  const VX = [], UN = [], PANJ = 0.35; // voix moteur + boîte + pneus : VX[0] celle du solo (au centre, branchée comme toujours), VX[1] et VX[2] celles de l'écran partagé (joueur 1 à gauche, joueur 2 à droite) ; UN : liste d'un seul joueur, réutilisée quand le jeu n'en passe pas
  let scrapeG, windG, pluie, ambBed, ambT = 2, inZone = false, uiF;
  const RK = () => 'vpr.radio' + (M.id === 'ville' ? '' : '.' + M.id); // dernière station écoutée, par carte
  let station = 0, S16 = 60 / ST[0].bpm / 4;

  // musique de menu : un seul morceau calme pour toutes les cartes — même tempo, mêmes accords (Dm7 BbM7 C7 A), même mélodie de cloches, même basse.
  // Chaque carte n'en change que la couleur : timbre de la nappe (pad) et de la mélodie (arp), octave de la mélodie (oct), passe-bas (lp), niveau (v, réglé par mesure).
  // Changer de carte au menu ne recharge plus la page : carte() garde la position du morceau et ouvre la nouvelle couleur en fondu (quitter() / reprendre() servent encore au rechargement).
  const MENU = { bpm: 80, mel: '0...2...1...3...', CH: [[50, 57, 60, 65], [46, 53, 57, 62], [48, 55, 58, 64], [45, 52, 57, 61]],
    ville: { v: 1.55, pad: 'choir', arp: 'bell', oct: 0, lp: 3500 },      // chœur sombre, cloches
    touge: { v: 1.84, pad: 'epFM', arp: 'pluck', oct: 0, lp: 6000 },      // piano électrique, cordes pincées
    wangan: { v: 1.46, pad: 'warm', arp: 'pulseArp', oct: 12, lp: 1800 }, // nappe ronde et étouffée, impulsions à l'octave
    paris: { v: 1.37, pad: 'strings', arp: 'bell', oct: 12, lp: 8000 },   // cordes claires, cloches à l'octave
    canal: { v: 1.35, pad: 'warm', arp: 'epFM', oct: 0, lp: 2600 },       // nappe ronde, piano électrique
  };
  let reprise = false; // le morceau vient d'être repris en cours de mesure : la nappe et la basse entrent tout de suite, sans attendre la mesure suivante
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
  function nz(t, dur, vol, dest, type, f, q = 1, buf = nbuf, a = 0.005) { // buf : bruit blanc, ou mbuf (métal des cymbales)
    if (vol < 0.002) return;
    const s = AC.createBufferSource(), fl = filt(type, f, q, env(dest, t, dur, vol, a)); s.buffer = buf; s.loop = true; s.connect(fl); s.start(t, Math.random()); s.stop(t + dur + 0.05); return fl;
  }
  // ---------- timbres ----------
  // ondes sur mesure (au-delà de sinus, scie, carré, triangle) : amplitudes des harmoniques
  function waves() {
    const mk = h => { const re = new Float32Array(h.length + 1), im = new Float32Array(h.length + 1); h.forEach((a, i) => { im[i + 1] = a; }); return AC.createPeriodicWave(re, im); };
    const H = (n, f) => Array.from({ length: n }, (_, i) => f(i + 1));
    W = { pulse: mk(H(40, n => Math.sin(n * Math.PI * 0.12) / n * 2)), // impulsion étroite : clavinet, basse séquencée, guitare étouffée
      organ: mk([1, 0.8, 0.5, 0.35, 0, 0.25, 0, 0.2]), // tirettes d'orgue
      vox: mk(H(32, n => [7, 11, 13, 14].includes(n) ? 0 : Math.exp(-((n - 4) ** 2) / 6) + 0.6 * Math.exp(-((n - 9) ** 2) / 8) + 0.3 / n)), // voyelle : chœur, voix hachée (sans les partiels 7, 11, 13, 14, qui sonnent faux contre la gamme)
      reed: mk(H(24, n => (n % 2 ? 1 : 0.35) / n ** 0.8)), // anche : saxophone, contrôleur à vent
      glass: mk([1, 0, 0.3, 0.5, 0, 0.25, 0, 0.3, 0, 0, 0, 0.12]) }; // verre : octaves et quintes seulement
  }
  // Un timbre : o oscillateurs [onde, demi-tons, cents, niveau] · uni / sp unisson désaccordé · fm [rapport, indice, durée, reste] modulation de
  // fréquence · a d s r enveloppe · flt [type, départ, fin, durée, Q, suit la note] · form formants de talkbox · nz bruit [type, f, Q, niveau, durée] ·
  // vib [Hz, cents, retard] · gl glissé (s) · bus (sat, fuzz) · len tenue en pas · lv niveau · pan, rv réverbération, ec écho, ch chorus
  const PATCH = {
    // basses
    bDark: { o: [['sawtooth', 0, -9], ['sawtooth', 0, 9], ['square', -12, 0, 0.7]], flt: ['lowpass', 2600, 300, 0.18, 6], d: 0.25, s: 0.5, bus: 'sat' }, // darksynth : scies saturées
    bDist: { o: [['sawtooth'], ['square', 0, 9]], flt: ['lowpass', 900, 200, 0.2, 4], d: 0.2, s: 0.4, bus: 'fuzz', lv: 0.8 }, // écrêtée
    bAcid: { o: [['sawtooth']], flt: ['lowpass', 3200, 250, 0.14, 16], d: 0.2, s: 0.3, gl: 0.05, bus: 'sat' }, // résonante façon TB-303
    bFM: { o: [['sine'], ['sine', -12, 0, 0.6]], fm: [1, 3.5, 0.12, 0.2], d: 0.25, s: 0.3, lv: 1.3 }, // basse FM des années 80
    bSlap: { o: [['pulse'], ['sawtooth', 0, 6, 0.5]], flt: ['lowpass', 5000, 500, 0.07, 6], nz: ['bandpass', 2500, 2, 0.25, 0.012], d: 0.2, s: 0.25, lv: 1.2 }, // claquée
    bPick: { o: [['triangle'], ['pulse', 0, 0, 0.4]], flt: ['lowpass', 2200, 400, 0.1, 2], nz: ['bandpass', 1800, 2, 0.15, 0.01], d: 0.22, s: 0.35, lv: 1.4 }, // basse électrique au médiator
    bMoog: { o: [['sawtooth'], ['triangle', 0, 5], ['sine', -12, 0, 0.5]], flt: ['lowpass', 700, 350, 0.2, 3], s: 0.8, gl: 0.07, len: 1, lv: 1.3 }, // ronde, à portamento
    bReese: { o: [['sawtooth', 0, -14], ['sawtooth', 0, 14], ['sine', 0, 0, 0.9]], flt: ['lowpass', 600, 380, 1, 2], s: 1, r: 0.08, len: 1, lv: 1.2 }, // scies qui battent
    bOff: { o: [['sawtooth', 0, -6], ['square', 0, 6]], flt: ['lowpass', 1800, 250, 0.1, 5], d: 0.12, s: 0.1, lv: 1.2 }, // pincée, à contretemps
    bSeq: { o: [['pulse'], ['sine', 0, 0, 0.8]], flt: ['lowpass', 1500, 300, 0.08, 3], d: 0.1, s: 0.2, lv: 1.3 }, // impulsion séquencée
    bFuzz: { o: [['sawtooth'], ['sawtooth', 7, 6, 0.7], ['square', 12, -5, 0.5]], s: 0.9, len: 1, bus: 'fuzz' }, // riff de guitare saturée
    // claviers, nappes, accords
    epFM: { o: [['sine'], ['triangle', 12, 0, 0.15]], fm: [1, 1.6, 0.35, 0.1], d: 0.9, s: 0.15, ch: 0.5, rv: 0.15, lv: 1.6 }, // piano électrique
    dxEp: { o: [['sine'], ['sine', 12, 3, 0.3]], fm: [3, 1.2, 0.2, 0.1], d: 0.7, s: 0.1, ch: 0.4, rv: 0.2, pan: -0.25, lv: 1.5 }, // piano électrique FM brillant
    organ: { o: [['organ']], a: 0.005, s: 1, r: 0.04, vib: [6, 6, 0], lv: 0.9 },
    clav: { o: [['pulse']], flt: ['highpass', 500, 500, 1, 0.7], d: 0.15, s: 0.1, pan: 0.3, lv: 1.1 },
    brass: { o: [['sawtooth', 0, -7], ['sawtooth', 0, 7], ['reed', 0, 0, 0.5]], a: 0.025, flt: ['lowpass', 600, 4500, 0.06, 2], d: 0.2, s: 0.7, rv: 0.15, lv: 1.1 }, // cuivres de synthé
    strings: { o: [['sawtooth']], uni: 4, sp: 14, a: 0.12, s: 1, r: 0.25, flt: ['highpass', 300, 300, 1, 0.7], ch: 0.6, rv: 0.3 }, // ensemble de cordes
    super: { o: [['sawtooth']], uni: 5, sp: 22, a: 0.01, d: 0.3, s: 0.8, r: 0.12, rv: 0.3 }, // mur de scies désaccordées
    choir: { o: [['vox']], uni: 3, sp: 10, a: 0.25, s: 1, r: 0.4, rv: 0.5, lv: 1.4 },
    glass: { o: [['glass']], fm: [2, 0.8, 1.5, 0.3], a: 0.15, s: 0.8, r: 0.5, rv: 0.5, ch: 0.4, lv: 1.3 },
    warm: { o: [['triangle'], ['sawtooth', 0, 7, 0.3]], flt: ['lowpass', 1200, 1200, 1, 0.7], a: 0.3, s: 1, r: 0.4, rv: 0.2, lv: 1.3 },
    stabM7: { o: [['sawtooth', 0, -8], ['square', 0, 8, 0.6]], flt: ['lowpass', 3500, 500, 0.2, 4], d: 0.25, ec: 0.45, rv: 0.2, lv: 1.3 }, // accord plaqué de Detroit
    gtrMute: { o: [['pulse']], flt: ['bandpass', 1800, 1200, 0.05, 3], nz: ['bandpass', 3000, 2, 0.2, 0.008], d: 0.07, pan: 0.35, lv: 2 }, // cocotte de guitare funk
    pwr: { o: [['sawtooth', 0, -4], ['sawtooth', 0, 4]], s: 0.9, bus: 'fuzz' }, // accords de puissance
    pluck: { o: [['sawtooth', 0, -7], ['sawtooth', 0, 7]], flt: ['lowpass', 6000, 500, 0.12, 3], d: 0.15, ec: 0.4, rv: 0.15 },
    pulseArp: { o: [['pulse']], d: 0.12, ec: 0.35, pan: -0.2 },
    seqArp: { o: [['sawtooth']], flt: ['lowpass', 3000, 600, 0.1, 8], d: 0.12, ec: 0.3, pan: 0.2 },
    bell: { o: [['sine']], fm: [3, 1.2, 0.3, 0.05], d: 0.9, ec: 0.4, rv: 0.3, lv: 1.2 },
    fmMetal: { o: [['sine']], fm: [1.41, 4, 0.2, 0.3], d: 0.25, rv: 0.3, lv: 1.2 }, // métal inharmonique
    // thèmes
    ldSaw: { o: [['sawtooth', 0, -10], ['sawtooth', 0, 10]], flt: ['lowpass', 5000, 5000, 1, 0.7], s: 0.8, vib: [5.5, 8, 0.2], ec: 0.3, rv: 0.2, lv: 0.08 },
    ldSync: { o: [['sawtooth'], ['square', 0, 5, 0.5]], flt: ['bandpass', 600, 3500, 0.25, 5], s: 0.8, vib: [6, 10, 0.15], ec: 0.25, rv: 0.15, lv: 0.2 }, // formant balayé, façon synchronisation
    ldEwi: { o: [['reed']], a: 0.03, flt: ['lowpass', 1500, 3200, 0.1, 3], s: 0.9, vib: [5.5, 12, 0.15], gl: 0.04, rv: 0.25, ch: 0.3, lv: 0.14 }, // contrôleur à vent
    ldSax: { o: [['reed'], ['sawtooth', 0, 4, 0.3]], flt: ['bandpass', 1300, 1500, 0.1, 1.5], nz: ['bandpass', 3000, 1, 0.08, 0.1], a: 0.04, s: 0.85, vib: [5, 14, 0.25], rv: 0.3, lv: 0.2 },
    ldWhistle: { o: [['sine']], nz: ['bandpass', 4000, 3, 0.03, 0.2], a: 0.03, s: 0.9, gl: 0.09, vib: [5.5, 7, 0.2], ec: 0.35, rv: 0.3, lv: 0.12 }, // sifflement à portamento
    ldTalk: { o: [['sawtooth']], form: 1, s: 0.9, gl: 0.05, lv: 0.3 }, // talkbox
    ldGtr: { o: [['sawtooth', 0, -5], ['sawtooth', 0, 5]], s: 0.9, vib: [5.5, 16, 0.15], gl: 0.05, bus: 'fuzz', lv: 0.2 }, // guitare saturée
    ldSiren: { o: [['triangle'], ['square', 0, 0, 0.3]], flt: ['lowpass', 3000, 3000, 1, 0.7], s: 1, gl: 0.15, ec: 0.3, lv: 0.1 },
    ldVox: { o: [['vox']], uni: 2, sp: 8, a: 0.02, d: 0.2, s: 0.5, rv: 0.3, ec: 0.3, lv: 0.16 }, // voix hachée
    ldTri: { o: [['triangle']], a: 0.02, s: 0.8, vib: [5, 8, 0.2], rv: 0.35, ec: 0.3, lv: 0.14 },
    ldStr: { o: [['sawtooth']], uni: 3, sp: 12, a: 0.08, s: 1, r: 0.15, flt: ['highpass', 500, 500, 1, 0.7], ch: 0.5, rv: 0.3, lv: 0.07 },
  };
  function tone(pn, f, t, dur, vel, dest, from) { // from : fréquence de la note précédente, pour le glissé
    const P = PATCH[pn]; if (!P || vel < 0.002) return [];
    const a = P.a || 0.004, s = P.s || 0, r = P.r || 0.06, end = t + dur, fin = end + r * 2 + 0.05, g = AC.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + a); g.gain.setTargetAtTime(vel * s, t + a, (P.d || dur) / 3); g.gain.setTargetAtTime(0, end, r / 3);
    dest = P.bus === 'fuzz' ? fuzz : P.bus === 'sat' ? bsat : dest; g.connect(dest);
    let d = g;
    if (P.flt) { const [type, f0, f1, ft, q, kt] = P.flt, k = kt ? f : 1; d = filt(type, Math.min(18000, f0 * k), q, g); d.frequency.setValueAtTime(Math.min(18000, f0 * k), t); d.frequency.exponentialRampToValueAtTime(Math.min(18000, f1 * k), t + Math.min(ft, dur)); }
    if (P.form) { const x = filt('bandpass', 600, 6, g), y = filt('bandpass', 1900, 8, g); d = AC.createGain(); d.gain.value = 3; d.connect(x); d.connect(y);
      x.frequency.setValueAtTime(600, t); x.frequency.linearRampToValueAtTime(1000, t + dur * 0.5); y.frequency.setValueAtTime(1900, t); y.frequency.linearRampToValueAtTime(2600, t + dur * 0.5); }
    let mod;
    if (P.fm) { const m = AC.createOscillator(), dev = P.fm[1] * f * P.fm[0]; mod = AC.createGain(); m.frequency.setValueAtTime(f * P.fm[0], t);
      mod.gain.setValueAtTime(dev, t); mod.gain.setTargetAtTime(dev * P.fm[3], t, P.fm[2] / 3); m.connect(mod); m.start(t); m.stop(fin); }
    const os = [], U = P.uni || 1, lv = 1 / Math.sqrt(P.o.length * U);
    for (const [w, semi = 0, cents = 0, olv = 1] of P.o) for (let u = 0; u < U; u++) {
      const o = AC.createOscillator(), fo = f * 2 ** (semi / 12); if (W[w]) o.setPeriodicWave(W[w]); else o.type = w;
      o.frequency.setValueAtTime(fo, t); o.detune.value = cents + (U > 1 ? (u / (U - 1) - 0.5) * 2 * P.sp : 0);
      if (from && P.gl) { o.frequency.setValueAtTime(fo * from / f, t); o.frequency.exponentialRampToValueAtTime(fo, t + P.gl); }
      if (mod) mod.connect(o.frequency);
      o.connect(gain(olv * lv, d)); o.start(t); o.stop(fin); os.push(o);
    }
    if (P.vib) { const l = AC.createOscillator(), lg = AC.createGain(); l.frequency.value = P.vib[0]; lg.gain.setValueAtTime(0, t + P.vib[2]); lg.gain.linearRampToValueAtTime(P.vib[1], t + P.vib[2] + 0.12); l.connect(lg); for (const o of os) lg.connect(o.detune); l.start(t); l.stop(fin); }
    if (P.nz) nz(t, P.nz[4], vel * P.nz[3], dest, P.nz[0], P.nz[1], P.nz[2]);
    return os;
  }

  // ---------- batteries ----------
  // Un kit : smp sons de TR-808 enregistrés · grosse caisse kf→ke en ks s, tenue kd, clic kc (filtré à kcf), kdr saturée · caisse claire : tons sT
  // (tenue sTd), bruit sN [type, f, Q] (tenue sNd), gate réverbération coupée net · charlestons : hM métalliques ou de bruit, hF passe-haut,
  // hD / hO tenue fermé / ouvert · rate hauteur · crunch tout passe par la saturation · hum jeu humain (s) · fill relance · tom, tomD · room réverbération
  const KIT = {
    k808: { smp: 1, fill: 'roll', room: 0.03 },
    k909: { kf: 210, ke: 46, ks: 0.055, kd: 0.34, kc: 0.5, sT: [185, 330], sTd: 0.08, sN: ['highpass', 2000, 0.7], sNd: 0.17, hM: 1, hF: 8500, hD: 0.04, hO: 0.24, fill: 'roll', room: 0.08 },
    dur: { kf: 190, ke: 44, ks: 0.07, kd: 0.28, kc: 0.3, kdr: 1, sT: [200], sTd: 0.05, sN: ['bandpass', 1800, 0.7], sNd: 0.2, gate: 1, hM: 1, hF: 7000, hD: 0.03, hO: 0.18, fill: 'toms', tom: [150, 110, 80], tomD: 0.3, room: 0.15 }, // boîte à rythmes des années 80, caisse claire coupée net
    lin: { kf: 160, ke: 52, ks: 0.04, kd: 0.2, kc: 0.45, sT: [210, 300], sTd: 0.06, sN: ['bandpass', 2400, 0.6], sNd: 0.18, gate: 1, hM: 0, hF: 8000, hD: 0.03, hO: 0.2, fill: 'toms', tom: [200, 150, 105], tomD: 0.28, room: 0.2 },
    ind: { kf: 260, ke: 75, ks: 0.05, kd: 0.2, kc: 0.2, kdr: 1, sT: [], sTd: 0.05, sN: ['highpass', 1200, 0.5], sNd: 0.14, crunch: 1, hM: 1, hF: 4000, hD: 0.025, hO: 0.1, room: 0.2 },
    acou: { kf: 130, ke: 58, ks: 0.025, kd: 0.16, kc: 0.4, kcf: 3000, sT: [200, 285], sTd: 0.07, sN: ['bandpass', 4200, 0.6], sNd: 0.2, hM: 0, hF: 7500, hD: 0.035, hO: 0.3, hum: 0.008, fill: 'toms', tom: [230, 170, 120], tomD: 0.2, room: 0.2 },
    rock: { kf: 110, ke: 48, ks: 0.035, kd: 0.26, kc: 0.5, kcf: 2500, sT: [180, 250], sTd: 0.1, sN: ['bandpass', 3200, 0.5], sNd: 0.28, hM: 0, hF: 6000, hD: 0.06, hO: 0.4, hum: 0.008, fill: 'toms', tom: [190, 140, 95], tomD: 0.3, room: 0.45 },
    brk: { kf: 150, ke: 60, ks: 0.03, kd: 0.14, kc: 0.5, sT: [220, 320], sTd: 0.06, sN: ['bandpass', 3600, 0.6], sNd: 0.13, crunch: 1, hM: 0, hF: 6500, hD: 0.03, hO: 0.2, fill: 'brk', room: 0.12 }, // breakbeat découpé et sali
    dnb: { kf: 165, ke: 62, ks: 0.025, kd: 0.11, kc: 0.5, sT: [220, 320], sTd: 0.05, sN: ['bandpass', 3600, 0.6], sNd: 0.1, rate: 1.35, crunch: 1, hM: 0, hF: 8000, hD: 0.025, hO: 0.16, fill: 'brk', room: 0.15 },
    disco: { kf: 120, ke: 55, ks: 0.02, kd: 0.12, kc: 0.45, kcf: 3500, sT: [210, 300], sTd: 0.05, sN: ['bandpass', 4800, 0.6], sNd: 0.14, hM: 1, hF: 9000, hD: 0.04, hO: 0.32, hum: 0.005, fill: 'toms', tom: [260, 200, 150], tomD: 0.15, room: 0.15 },
  };
  const smp = {};
  function hitS(name, t, vol, dur = 0, rate = 1) { // dur : coupe le son en fondu (la grosse caisse de 808 résonne 1,5 s) ; rate : hauteur de lecture
    const b = smp[name]; if (!b || vol < 0.002) return !!b;
    vol *= 0.6; // les enregistrements sont plus forts que les sons synthétisés
    const s = AC.createBufferSource(), gn = gain(vol, drumG); s.buffer = b; s.playbackRate.value = rate; s.connect(gn); s.start(t);
    if (dur) { gn.gain.setValueAtTime(vol, t + dur * 0.6); gn.gain.linearRampToValueAtTime(0, t + dur); s.stop(t + dur + 0.02); }
    return true;
  }
  const dd = K => K.crunch ? kdrv : drumG;
  function dKick(t, v, K) {
    if (K.smp && hitS(v > 0.75 ? 'bdL' : 'bd', t, v, v > 0.75 ? 0.42 : 0.3)) return;
    if (K.smp) K = KIT.k909;
    const o = osc('sine', K.kf, t, K.kd, v, K.kdr || K.crunch ? kdrv : drumG); o && o.frequency.exponentialRampToValueAtTime(K.ke, t + K.ks);
    nz(t, 0.012, v * K.kc, drumG, 'lowpass', K.kcf || 5000);
  }
  function dClap(t, v) { for (let i = 0; i < 3; i++) nz(t + i * 0.011, 0.02, v * 0.6, drumG, 'bandpass', 1300, 1.5); nz(t + 0.033, 0.16, v * 0.7, drumG, 'bandpass', 1300, 1.2); }
  function dSnare(t, v, K, c = 'x') { // x caisse claire · g note fantôme · c clap · r coup sur le cercle
    if (c === 'g') v *= 0.3;
    if (c === 'r') { osc('triangle', 1750, t, 0.03, v * 0.5, drumG); nz(t, 0.015, v * 0.4, drumG, 'bandpass', 3500, 2); return; }
    if (K.smp && hitS(c === 'c' ? 'cp' : 'sd', t, v * 0.9)) return;
    if (c === 'c') return dClap(t, v);
    if (K.smp) K = KIT.k909;
    const rt = K.rate || 1;
    for (const f of K.sT) { const o = osc('triangle', f * rt, t, K.sTd, v * 0.5, dd(K)); o && o.frequency.exponentialRampToValueAtTime(f * rt * 0.7, t + K.sTd); }
    nz(t, K.sNd, v * 0.8, dd(K), K.sN[0], K.sN[1] * rt, K.sN[2]);
    if (K.gate) { const s = AC.createBufferSource(), g = AC.createGain(); s.buffer = nbuf; s.loop = true; s.connect(filt('bandpass', 1500, 0.6, g)); g.connect(drumG);
      g.gain.setValueAtTime(v * 0.4, t); g.gain.setValueAtTime(v * 0.4, t + 0.17); g.gain.linearRampToValueAtTime(0, t + 0.2); s.start(t, Math.random()); s.stop(t + 0.22); }
  }
  function dHat(t, v, K, c) { // x fermé · X accentué · o ouvert · r cymbale ride · b cloche de la ride
    const ride = c === 'r' || c === 'b', lv = v * (c === 'X' ? 0.36 : c === 'o' ? 0.4 : c === 'x' ? 0.21 : 0.2);
    if (K.smp && !ride && hitS(c === 'o' ? 'oh' : 'ch', t, lv * 1.1)) return;
    if (K.smp) K = KIT.k909;
    const dec = c === 'o' ? K.hO : c === 'r' ? 0.45 : c === 'b' ? 0.3 : K.hD, metal = K.hM || ride;
    nz(t, dec, lv * (metal ? 0.7 : 1.3), ride ? drumG : dd(K), 'highpass', ride ? (c === 'b' ? 3500 : 5200) : K.hF, 0.8, metal ? mbuf : nbuf);
    if (c === 'b') osc('triangle', 3900, t, 0.25, lv * 0.25, drumG);
  }
  function dTom(t, v, f, d) { const o = osc('sine', f * 1.5, t, d, v, drumG); o && o.frequency.exponentialRampToValueAtTime(f, t + d * 0.4); nz(t, 0.02, v * 0.3, drumG, 'bandpass', 1200, 1); }
  function dPerc(t, v, K, c) { // c cloche · v clave · h l congas · m shaker · t tambourin · 1 2 3 toms · k métal
    if (c === 'c') { if (K.smp && hitS('cb', t, v * 0.18)) return; const b = filt('bandpass', 900, 1.5, env(drumG, t, 0.16, v * 0.14)); for (const f of [540, 800]) { const o = AC.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(b); o.start(t); o.stop(t + 0.2); } }
    else if (c === 'v') osc('sine', 2500, t, 0.03, v * 0.2, drumG);
    else if (c === 'h' || c === 'l') { const f = c === 'h' ? 340 : 230, o = osc('sine', f, t, c === 'h' ? 0.12 : 0.18, v * 0.3, drumG); o && o.frequency.exponentialRampToValueAtTime(f * 0.85, t + 0.08); nz(t, 0.01, v * 0.15, drumG, 'bandpass', 2000, 1); }
    else if (c === 'm') nz(t, 0.06, v * 0.1, drumG, 'highpass', 6500, 0.7, nbuf, 0.02);
    else if (c === 't') { nz(t, 0.09, v * 0.1, drumG, 'highpass', 9000, 0.7, mbuf); nz(t, 0.05, v * 0.06, drumG, 'highpass', 7000); }
    else if (c === 'k') tone('fmMetal', 180, t, 0.3, v * 0.3, kdrv);
    else if (+c) dTom(t, v * 0.4, (K.tom || [200, 150, 105])[+c - 1], K.tomD || 0.25);
  }
  function dFill(t, i, n, K) { // relance de fin de section : i = pas dans la relance (0..n-1)
    const k = (i + 1) / n;
    if (K.fill === 'toms') { if (n === 4 || i % 2 === 0 || i >= n - 3) dTom(t, 0.3 + 0.25 * k, K.tom[Math.min(2, Math.floor(i * 3 / n))], K.tomD); if (i === 0) dSnare(t, 0.4, K); }
    else if (K.fill === 'brk') { if ('x.xx.x.x'[i % 8] === 'x') dSnare(t, 0.3 + 0.25 * k, K); if (i % 4 === 2) dKick(t, 0.7, K); }
    else dSnare(t, 0.2 + 0.35 * k, K);
  }
  function riser(t, dur, v = 0.22) { // montée de bruit : avant le secteur chaud, et pendant les sections de montée
    const s = AC.createBufferSource(), g = AC.createGain(), f = filt('bandpass', 400, 2, g);
    s.buffer = nbuf; s.loop = true; s.connect(f); g.connect(drumG);
    f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(7000, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.05);
    s.start(t); s.stop(t + dur + 0.1);
  }
  function crash(t = AC.currentTime, v = 1) { // impact : départ, entrée et sortie du secteur chaud, début de refrain
    nz(t, 1.4, 0.28 * v, drumG, 'highpass', 4500);
    const o = osc('sine', 70, t, 0.7, 0.8 * v, drumG); o && o.frequency.exponentialRampToValueAtTime(30, t + 0.5);
  }
  // arrivée de course : un coup de cymbale, un accord tenu, puis une phrase selon la place (fanfare qui monte pour le premier, montée courte pour le podium, chute pour le dernier)
  const arrivee = pos => { if (!AC) return; const t = AC.currentTime; crash(t, 0.7); for (const n of [57, 64, 69, 73]) osc('triangle', hz(n), t, 1.8, 0.1, uiF);
    (pos === 1 ? [69, 73, 76, 81, 85, 88, 93] : pos < 4 ? [69, 73, 76, 81] : [69, 64, 60, 57]).forEach((n, i, a) => osc('square', hz(n), t + 0.15 + i * 0.1, i === a.length - 1 ? 0.9 : 0.4, 0.12, uiF)); };
  const stinger = up => AC && (up ? [69, 73, 76, 81, 85] : [69, 64, 60, 57]).forEach((n, i) => osc('square', hz(n), AC.currentTime + i * 0.09, 0.5, 0.12, uiF));

  // ---------- séquenceur ----------
  function schedMenu(s, t) {
    const mn = MENU[M.id] || MENU.ville, bar = s >> 4, q = s % 16, ch = MENU.CH[bar % MENU.CH.length], a = MENU.mel[q];
    if (q === 0 || reprise) { const n = 16.5 - q; reprise = false; for (const x of ch) tone(mn.pad, hz(x), t, S16 * n, 0.05 * (PATCH[mn.pad].lv || 1), strip.d.in); osc('sine', hz(ch[0] - 24), t, S16 * Math.max(1, n - 2.5), 0.2, duckG); }
    if (a !== '.') tone(mn.arp, hz(ch[+a] + 12 + mn.oct + (bar & 1 ? 12 : 0)), t, 0.9, 0.05 * (PATCH[mn.arp].lv || 1), strip.a.in);
  }
  // Un pas de double-croche. La station donne une forme (suite de sections de 4 mesures : introduction, couplets, refrain, break, montée…) ; chaque
  // section dit quelles parties jouent et avec quelle variante de motif (format : voir RADIO dans cartes.js). La course s'y ajoute : rien que le
  // tic-tac au décompte ; dans le secteur chaud et sur le dernier secteur (big), les parties marquées « ! » entrent et toutes les sections deviennent
  // le refrain (hot), sauf la variation (e) ; relance de batterie à chaque fin de section.
  // Rien de brusque hors événement de course : les parties entrent en fondu, la batterie se retire avant un break et revient en fondu, le refrain
  // n'arrive qu'en début de mesure et ne repart qu'en fin de section, les filtres s'ouvrent lentement.
  function sched(s, t) {
    if (menu) return schedMenu(s, t);
    const st = ST[station], K = KIT[st.kit] || KIT.k909; t += (s & 1) * (st.sw || 0) * S16; // swing : les doubles-croches impaires traînent
    const bar = s >> 4, q = s % 16, d = drums, fi = (bar >> 2) % st.form.length, nxt = st.form[(fi + 1) % st.form.length];
    if ((q === 0 && ((bar & 3) === 0 || mix > 0.5 || fin || boostL)) || (boostL && !bigS && q % 4 === 0)) { const b = mix > 0.5 || fin || boostL; if (bigS && !b) sortie = bar >> 2; bigS = b; } // la nitro est une action : elle ouvre le refrain dès le temps suivant // le refrain du secteur chaud entre à la mesure suivante et ne repart qu'en fin de section : jamais au milieu d'une mesure
    const big = bigS;
    let key = st.form[fi]; if (big && key !== 'e') key = st.hot;
    else if (sortie === bar >> 2 && !st.sec[key].k) key = st.form[1]; // en sortant du secteur chaud on retombe sur un couplet, jamais sur un break : pas de trou // secteur chaud : le refrain, et sa variation quand la forme y arrive
    if (EC.boucle && st.sec[EC.boucle]) key = EC.boucle; EC.sec = key;
    const mxv = p => pv(st, p);
    const sec = st.sec[key], pr = st.prog[sec.P || 0], ch = pr.CH[bar % pr.CH.length], root = pr.ROOT[bar % pr.ROOT.length], pos = ((bar & 3) * 16 + q) / 64; // pos : avancement dans la section
    curRoot = root;
    // premier tour du mode course : ni thème ni percussions hors du secteur chaud
    const on = p => { const x = st[p] && sec[p]; return x && (!x.big || big) && !(lap === 0 && !big && (p === 'l' || p === 'p')) ? x : null; }, pat = (v, x) => { const b = v[x.v % v.length]; return b[bar % b.length]; };
    const hum = () => K.hum ? t + Math.random() * K.hum : t; // jeu humain : les batteries acoustiques ne tombent pas pile
    const suite = st.sec[big && nxt !== 'e' ? st.hot : nxt], dur = S16 * 16; // la section qui vient ; durée d'une mesure
    const fillN = (bar & 3) === 3 && K.fill && sec.k && suite.k ? (nxt !== st.form[fi] ? 8 : 4) : 0, fill = d && fillN && q >= 16 - fillN;
    if (q === 0) { // début de mesure : rien n'entre ni ne sort d'un coup
      for (const p in strip) { const now = !!(st[p] && sec[p] && (!sec[p].big || big)), g = strip[p].in.gain; // une partie qui entre monte en fondu sur la mesure
        if (now && !was[p]) { g.cancelScheduledValues(t); g.setValueAtTime(MX[p] * 0.15, t); g.linearRampToValueAtTime(MX[p], t + dur * (p === 'b' ? 0.3 : 0.8)); } was[p] = now; }
      const kNow = !!(d && st.k && sec.k), g = drumF.gain;
      if (kNow && !was.k) { g.cancelScheduledValues(t); g.setValueAtTime(0.3, t); g.linearRampToValueAtTime(1, t + dur * 0.8); } // la batterie revient en fondu
      else if (kNow && (bar & 3) === 3 && !suite.k) { g.cancelScheduledValues(t); g.setValueAtTime(1, t); g.linearRampToValueAtTime(0.25, t + dur); } // elle se retire sur la dernière mesure avant un break
      else if (!kNow && was.k) { g.cancelScheduledValues(t); g.setValueAtTime(0.25, t); g.linearRampToValueAtTime(1, t + dur * 2); }
      was.k = kNow;
      secG.gain.setTargetAtTime(key === st.hot || key === 'e' ? 1 : (st.cv || 1) * (sec.k ? 1 : 1.6), t, dur / 3); // les couplets sont remontés vers le niveau du refrain (cv, réglé par mesure) ; les sections sans batterie (introduction, break) un peu plus, pour que le creux reste doux
    }
    let x, c;
    if (d && (x = on('k')) && !fill && (c = pat(st.k, x)[q]) !== '.') {
      jo('k', t); dKick(t, mxv('k') * lerp(0.5, 0.8, mix) * (c === 'g' ? 0.5 : 1), K);
      const p = st.pump == null ? 0.35 : st.pump; // pompe : tout plonge sous la grosse caisse, plus ou moins selon le style
      if (p < 1) { duckG.gain.cancelScheduledValues(t); duckG.gain.setValueAtTime(p, t); duckG.gain.linearRampToValueAtTime(1, t + Math.min(st.pumpT || 0.24, S16 * 1.9)); }
    }
    if (d && (x = on('s')) && !fill && (c = pat(st.s, x)[q]) !== '.') jo('s', t), dSnare(hum(), mxv('s') * (big ? 0.5 : st.sMin || 0.34), K, c);
    if (fill && mxv('s') > 0) dFill(t, q - 16 + fillN, fillN, K);
    if (d && sec.roll && !((bar & 3) === 3 && q >= 14) && q % ((bar & 3) < 2 ? 4 : (bar & 3) < 3 ? 2 : 1) === 0) dSnare(t, mxv('s') * (0.12 + 0.4 * pos), K); // montée : roulement qui se resserre
    if (d && sec.roll && (bar & 3) === 0 && q === 0) riser(t, S16 * 64, 0.18);
    if (d && sec.roll) lastRoll = bar;
    else if (d && (bar & 3) === 0 && q === 0 && lastRoll === bar - 1) { crash(t, 0.7); const o = osc('sine', hz(root + 24), t, 0.7, 0.6, drumG); o && o.frequency.exponentialRampToValueAtTime(hz(root), t + 0.5); } // le drop : au bout d'une montée, cymbale et chute de sub
    if (d && (bar & 3) === 0 && q === 0 && key === st.hot && lastFill === bar - 1) crash(t, 0.35); // cymbale d'entrée de refrain, seulement au bout d'une relance de batterie
    if (fill) lastFill = bar;
    if (!d) { if (q % 4 === 2) dHat(t, 0.5, K, 'x'); } // seul tic-tac pendant le décompte
    else if ((x = on('h')) && (c = pat(st.h, x)[q]) !== '.') jo('h', t), dHat(hum(), mxv('h') * (big || lap === 2 ? 1 : 0.8), K, c);
    if (d && (x = on('p')) && (c = pat(st.p, x)[q]) !== '.') jo('p', t), dPerc(hum(), mxv('p'), K, c);
    if (d && (x = on('b'))) { const rif = pat(st.b.v, x), rf = rif[q];
      if (rf != null && rf !== R) { let n = 1; while (q + n < 16 && rif[q + n] == null) n++; // tenue jusqu'à la note suivante
        const P = PATCH[st.b.p], f = hz(st.bPar ? root + rf : juste(root + rf, pr.OK[bar % pr.OK.length])); jo('b', t, S16 * n); tone(st.b.p, f, t, S16 * n * (P.len || 0.9), mxv('b') * lerp(0.27, 0.38, mix) * (P.lv || 1), strip.b.in, lastB); lastB = f; } }
    else if (!d && q % 8 === 0) tone(st.b.p, hz(root + 12), t, S16 * 6, 0.25, strip.b.in);
    if (st.d && (!d || on('d'))) { const P = PATCH[st.d[0]];
      if (q === 0) { jo('d', t, S16 * 16); for (const n of ch) tone(st.d[0], hz(n + (st.d[1] || 0)), t, S16 * 16.5, mxv('d') * 0.05 * (P.lv || 1), strip.d.in); }
      strip.d.gate.gain.setValueAtTime(d && sec.gate && st.gate[q] === '.' ? 0.06 : 1, t); } // nappe hachée (gate de trance)
    for (const p of ['c', 'g']) if (d && (x = on(p)) && (c = pat(st[p].v, x)[q]) !== '.') { const P = PATCH[st[p].p];
      jo(p, t); for (const n of ch) tone(st[p].p, hz(n + 12 + (st[p + 'O'] || 0)), t, S16 * (P.s ? 1.6 : 3), mxv(p) * (c === 'X' ? 0.065 : 0.045) * (P.lv || 1), strip[p].in); }
    if ((x = on('a')) && (c = pat(st.a.v, x)[q]) !== '.' && (d || q % 2 === 0)) jo('a', t), tone(st.a.p, hz(ch[c % 4 % ch.length] + 12 + (c >= 4 ? 12 : 0)), t, 0.2, mxv('a') * (q % 4 === 0 ? 0.05 : 0.038) * (PATCH[st.a.p].lv || 1), strip.a.in); // 0-3 : notes de l'accord ; 4-7 : à l'octave
    if (d && (x = on('l'))) { const L = pat(st.l.v, x), N = L[q];
      if (N != null && N !== R) { let n = 1; while (q + n < 16 && L[q + n] == null) n++;
        const No = N + (st.lO || 0); jo('l', t, S16 * n); tone(st.l.p, hz(No), t, S16 * n * 1.05, mxv('l') * (PATCH[st.l.p].lv || 0.15) * (st.lV == null ? 1 : st.lV), strip.l.in, lastN && hz(lastN)); lastN = No;
        if (fin || lap === 2) osc('triangle', hz(N + 12), t, S16 * n, 0.04 * mxv('l'), strip.l.in); } } // dernier secteur, dernier tour : thème doublé à l'octave
    if (driftL > 0.3) osc('sawtooth', hz(ch[(q * 2) % 3] + 24), t, 0.1, 0.07 * driftL, acid); // ligne acide tant qu'on glisse
    if (d && glisse) { // la glisse tend la musique avec sa durée : roulement qui se resserre et souffle qui monte, calés sur le tempo (le grave s'amincit dans audioFrame)
      if (q % (acquis ? 1 : 2) === 0) dSnare(t, 0.06 + 0.22 * tens, K);
      nz(t, S16 * 0.9, 0.025 + 0.05 * tens, drumG, 'bandpass', 800 * 8 ** tens, 2);
      if (acquis && !acqDit) { acqDit = true; dHat(t, 1, K, 'o'); tone('bell', hz(ch[0] + 24), t, 0.3, 0.09, strip.a.in); tone('bell', hz(ch[0] + 31), t + S16, 0.4, 0.09, strip.a.in); } // palier : la glisse remplit la jauge de nitro à plein débit
    }
    if (boostPend && q % 4 === 0) { boostPend = false; if (d) crash(t, 0.8); } // la cymbale tombe sur le temps qui suit le départ de la nitro
    if (st.sweep) swF.frequency.setTargetAtTime(big ? 16000 : 350 * 2 ** (3.6 * (0.5 - 0.5 * Math.cos(Math.PI * (s % 128) / 64))), t, big ? 0.6 : 0.15); // filtre balayé sur 8 mesures, grand ouvert dans le secteur chaud
    else swF.frequency.setTargetAtTime(sec.lo && !big ? 400 * 30 ** pos : 20000, t, 0.25); // section filtrée : le passe-bas s'ouvre au fil de la section
  }
  const juste = (n, ok) => ok.has(((n % 12) + 12) % 12) ? n : ok.has(((n - 1) % 12 + 12) % 12) ? n - 1 : n + 1; // note recalée sur la gamme et l'accord de la mesure : jamais de fausse note de basse
  const lvl = () => menu ? (MENU[M.id] || MENU.ville).v : ST[station].vol == null ? 1 : ST[station].vol; // niveau de la station : réglé par mesure pour que toutes sortent au même volume
  function retune(t, garde) { // garde : l'éditeur change un réglage en cours d'écoute, le séquenceur ne repart pas du début // (re)cale le séquenceur, le bus et les tranches de mixage sur la station ou sur la boucle de menu
    const st = ST[station], mn = MENU[M.id] || MENU.ville; S16 = 60 / (menu ? MENU.bpm : st.bpm) / 4; if (!garde) { t0 = nextT = t; stp = !menu && drums ? 64 : 0; lastN = lastB = 0; } // en course, une station prise en route commence au premier couplet, pas à l'introduction
    if (!AC) return;
    const e = menu ? [3, 0.5] : st.echo || [3, 0.4], q = menu ? [0, 1000, 0, 0] : st.eq || [0, 1000, 0, 0];
    dly.delayTime.value = Math.min(0.95, S16 * e[0]); dlyFb.gain.value = e[1];
    const dv = menu ? 0 : st.drive || 0; busDry.gain.value = 1 - 0.7 * dv; busDrv.gain.value = 0.45 * dv; // saturation de tout le bus (électro saturée, techno industrielle)
    if (!garde) { swF.frequency.cancelScheduledValues(t); swF.frequency.setValueAtTime(menu ? mn.lp : st.sweep ? 500 : 20000, t); } swF.Q.value = !menu && st.sweep ? 5 : 0.7;
    eqL.gain.value = q[0]; eqM.frequency.value = q[1]; eqM.gain.value = q[2]; eqH.gain.value = q[3]; // couleur de la station : grave, médium, aigu
    mrevG.gain.value = menu ? 0.6 : st.rev == null ? 0.2 : st.rev; drumRv.gain.value = menu ? 0 : (KIT[st.kit] || KIT.k909).room;
    const parts = menu ? { d: mn.pad, a: mn.arp } : { b: st.b && st.b.p, d: st.d && st.d[0], c: st.c && st.c.p, g: st.g && st.g.p, a: st.a && st.a.p, l: st.l && st.l.p };
    for (const k in strip) { const P = PATCH[parts[k]] || {}, s = strip[k]; s.pan.pan.value = P.pan || 0; s.rv.gain.value = P.rv || 0; s.ec.gain.value = P.ec || 0; s.ch.gain.value = P.ch || 0; if (!garde) { s.gate.gain.cancelScheduledValues(t); s.gate.gain.setValueAtTime(1, t); } }
  }
  function quitter() { // on change de carte au menu : la musique s'efface vite ; renvoie où en est le morceau, pour reprendre()
    if (!AC || !menu) return null; const t = AC.currentTime; tuneG.gain.cancelScheduledValues(t); tuneG.gain.setTargetAtTime(0, t, 0.03);
    return { pas: stp - (nextT - t) / S16, t: Date.now() };
  }
  function reprendre(m) { // après le rechargement : même endroit du morceau, compte tenu du temps passé ; la couleur de la nouvelle carte s'ouvre en 2 s
    if (!AC || !menu || !m || !(Date.now() - m.t < 8000)) return; const t = AC.currentTime + 0.05, lp = (MENU[M.id] || MENU.ville).lp;
    stp = Math.max(0, Math.ceil(m.pas + (Date.now() - m.t) / 1000 / S16)); nextT = t; t0 = t - stp * S16; reprise = true;
    tuneG.gain.cancelScheduledValues(t); tuneG.gain.setValueAtTime(0, t); tuneG.gain.linearRampToValueAtTime(lvl(), t + 0.5);
    swF.frequency.cancelScheduledValues(t); swF.frequency.setValueAtTime(Math.min(lp, 300), t); swF.frequency.exponentialRampToValueAtTime(lp, t + 2);
  }
  function setStation(i) {
    station = (((i | 0) % ST.length) + ST.length) % ST.length;
    try { localStorage.setItem(RK(), station); } catch (e) { }
    if (!AC) { S16 = 60 / ST[station].bpm / 4; return; }
    const t = AC.currentTime; // touche mécanique d'autoradio (enfoncement puis relâchement : clic sec, résonance de boîtier), bref grésillement, puis la station
    touche(t); // le claquement en deux temps, d'abord essayé pour la boîte, que l'utilisateur a gardé pour ce bouton
    tuneG.gain.cancelScheduledValues(t); tuneG.gain.setValueAtTime(0, t); tuneG.gain.setValueAtTime(0, t + 0.36); tuneG.gain.linearRampToValueAtTime(lvl(), t + 0.46); // shortcut: les nappes de l'ancienne station finissent de sonner après la friture (1 s au plus), à couper par un bus par station si ça s'entend
    const f = nz(t + 0.14, 0.22, 0.2, V.ui, 'bandpass', 900, 2); if (f) { f.frequency.setValueAtTime(900, t + 0.14); f.frequency.exponentialRampToValueAtTime(3200, t + 0.24); f.frequency.exponentialRampToValueAtTime(1300, t + 0.36); }
    for (let k = 0; k < 3; k++) nz(t + 0.14 + Math.random() * 0.2, 0.012, 0.25, V.ui, 'highpass', 2000);
    if (!menu) retune(t + 0.38);
  }
  function carte(m) { // change de carte (banc d'écoute) : stations, ambiance et couleur du menu
    M = m; ST = M.radio; TH = M.th; station = 0;
    try { station = clamp(+localStorage.getItem(RK()) || 0, 0, ST.length - 1); } catch (e) { }
    S16 = 60 / ST[station].bpm / 4;
    if (AC) { retune(AC.currentTime + 0.05, menu); if (menu) swF.frequency.setTargetAtTime((MENU[M.id] || MENU.ville).lp, AC.currentTime, 0.5); buildAmb(); } // au menu, le morceau commun continue : seule sa couleur change
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
    if (id === 'touge') { const f = Math.random() < 0.7 ? 4300 : 5100; for (let i = 0; i < 6; i++) osc('sine', f, t + i * 0.03, 0.014, 0.05, ambBed); return rnd(0.6, 1.4); } // grillons
    if (id === 'paris') { for (let i = 0, n = 2 + Math.random() * 4 | 0, f = rnd(2600, 3800); i < n; i++) { const o = osc('sine', f, t + i * 0.11, 0.08, 0.04, ambBed); o && o.frequency.exponentialRampToValueAtTime(f * rnd(0.8, 1.4), t + i * 0.11 + 0.07); } return rnd(1.5, 5); } // oiseaux
    if (id === 'wangan') { for (const [type, f] of [['sawtooth', 98], ['square', 147]]) { const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.value = f; o.connect(filt('lowpass', 420, 0.7, g)); g.connect(ambBed);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.4); g.gain.setValueAtTime(0.05, t + 2.2); g.gain.linearRampToValueAtTime(0, t + 3); o.start(t); o.stop(t + 3.1); } return rnd(25, 45); } // corne de navire
    if (id === 'canal') { for (let i = 0; i < 110; i++) nz(t + i * 0.075, 0.06, 0.2 * Math.sin(Math.PI * i / 110), ambBed, 'lowpass', 260); return rnd(30, 50); } // hélicoptère qui passe au loin
    if (id === 'ville') { const o = AC.createOscillator(), g = AC.createGain(); o.frequency.setValueAtTime(620, t); for (let i = 0; i < 4; i++) { o.frequency.linearRampToValueAtTime(840, t + i + 0.5); o.frequency.linearRampToValueAtTime(620, t + i + 1); }
      o.connect(filt('lowpass', 1200, 0.7, g)); g.connect(ambBed); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.03, t + 1.5); g.gain.linearRampToValueAtTime(0, t + 4); o.start(t); o.stop(t + 4.1); return rnd(25, 50); } // sirène lointaine
    return 10;
  }
  function pump() { // avance le séquenceur jusqu'à 0,12 s devant l'horloge audio
    while (nextT < AC.currentTime - 0.2) { nextT += S16; stp++; } // onglet en veille : on saute au lieu de rattraper
    while (nextT < AC.currentTime + 0.12) { sched(stp++, nextT); nextT += S16 / (1 - 0.1 * platine); }
  }
  // Une voix = ce qu'un joueur entend de sa voiture. Moteur : 3 oscillateurs (ordre 1, 1/2, 3/2) → saturation → filtre de charge → formant d'échappement → battement.
  // Pneus : la glisse se tient longtemps, donc un feulement grave et large plutôt qu'un sifflement ; + grondement de ripage.
  // ns : la source de bruit ; mot, pneu : où sortent le moteur (et la boîte) et les pneus ; src : ce qu'il faudra arrêter pour retirer la voix
  function voix(ns, mot, pneu, src = []) {
    const out = gain(0, mot), am = gain(1, out), pk = filt('peaking', 140, 1.5, am); pk.gain.value = 6; // résonance d'échappement, dans le grave
    const lp = filt('lowpass', 800, 0.7, pk), drive = gain(0.6, shaper(3, lp));
    const mk = (type, g) => { const o = AC.createOscillator(); o.type = type; o.connect(gain(g, drive)); o.start(); src.push(o); return o; };
    const lfo = AC.createOscillator(), lfoG = gain(0.2, am.gain);
    lfo.connect(lfoG); lfo.start(); src.push(lfo);
    const g = gain(0, pneu), sqL = filt('lowpass', 1500, 0.7, g), b1 = filt('bandpass', 420, 5, sqL), b2 = filt('bandpass', 640, 4, gain(0.5, sqL));
    ns.connect(b1); ns.connect(b2);
    const scrub = gain(0, pneu); ns.connect(filt('lowpass', 160, 0.7, scrub));
    return { a: mk('sawtooth', 0.5), b: mk('square', 0.45), c: mk('sawtooth', 0.08), lfo, lfoG, lp, drive, out, g, b1, b2, scrub, mot, src, gas: 0 }; // gas : l'accélérateur à l'image précédente (pétarade au lever de pied)
  }
  // voix d'un joueur de l'écran partagé : la même, derrière un panoramique, avec son propre bruit (arrêter ses sources suffit alors à tout libérer).
  // Le panoramique à puissance constante ôte 3 dB à chaque voix : deux moteurs ensemble pèsent ce que pèse celui du solo, la marge du compresseur ne bouge pas.
  function voixPan(p) {
    const pm = AC.createStereoPanner(), pp = AC.createStereoPanner(), ns = AC.createBufferSource(); pm.pan.value = pp.pan.value = p; pm.connect(V.mot); pp.connect(V.pneu);
    ns.buffer = nbuf; ns.loop = true; ns.start(0, Math.random() * 2); return voix(ns, pm, pp, [ns]);
  }
  const tait = (v, t) => { v.out.gain.setTargetAtTime(0, t, 0.05); v.g.gain.setTargetAtTime(0, t, 0.05); v.scrub.gain.setTargetAtTime(0, t, 0.05); };
  function initAudio(ctx) { // ctx : contexte hors ligne pour la mesure des niveaux (banc d'écoute) ; sans argument, le contexte audio du navigateur
    if (AC && live && !ctx) return AC.resume();
    if (AC && live) AC.close();
    AC = ctx || new (window.AudioContext || window.webkitAudioContext)(); live = !ctx;
    const comp = AC.createDynamicsCompressor(); outG = gain(OUT, AC.destination); comp.connect(outG); // marge après le compresseur : mesuré, aucune crête au-dessus de -3 dB
    vu = AC.createAnalyser(); vu.fftSize = 2048; outG.connect(vu); // ce qui sort vraiment, pour le vumètre du banc d'écoute
    lastHit = 0; lastMus = -9; ambT = 2; rubT = satT = platine = 0; bigS = false; lastFill = lastRoll = -9; sortie = -1; grit = tens = 0; glisse = acquis = acqDit = boostPend = boostL = false; for (const p in was) was[p] = false; drums = 0; mix = inten = driftL = 0; fin = inZone = false; // un contexte neuf repart de l'arrêt
    master = gain(0.9, comp); ana = AC.createAnalyser(); ana.fftSize = 64; master.connect(ana);
    for (const k in vol) V[k] = gain(vol[k], master);
    nbuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
    const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // réverbération de tunnel : bruit qui s'éteint en 1,6 s ; la musique et le moteur y sont envoyés selon e.tun
    rev = AC.createConvolver(); const ir = AC.createBuffer(2, AC.sampleRate * 1.6, AC.sampleRate);
    for (let c = 0; c < 2; c++) { const x = ir.getChannelData(c); for (let i = 0; i < x.length; i++) x[i] = (Math.random() * 2 - 1) * Math.exp(-i / AC.sampleRate / 0.35); }
    rev.buffer = ir; rev.connect(gain(0.5, master)); musSend = gain(0, rev); motSend = gain(0, rev); V.mus.connect(musSend); V.mot.connect(motSend);
    musF = filt('lowpass', 18000, 0.7, V.mus); musicG = gain(musicOn ? 1 : 0, musF);
    eqH = filt('highshelf', 5000, 0.7, musicG); eqM = filt('peaking', 1000, 0.9, eqH); eqL = filt('lowshelf', 130, 0.7, eqM); hpF = filt('highpass', 20, 0.9, eqL); secG = gain(1, hpF); gritDry = gain(1, secG); tuneG = gain(1, gritDry); gritWet = gain(0, secG); tuneG.connect(gain(2.5, shaper(6, gritWet))); // couleur de la station ; niveau de la section ; voie saturée, dosée par la proximité du mur
    drumF = gain(1, tuneG); drumG = gain(1, drumF); kdrv = shaper(3, gain(0.8, drumG)); // drumF : fondus de la batterie aux entrées et sorties
    swF = filt('lowpass', 20000, 0.7, tuneG); busDry = gain(1, swF); busDrv = gain(0, swF);
    duckG = gain(1, busDry); duckG.connect(gain(2.5, shaper(4, busDrv))); // tout sauf la batterie passe par ce bus pompé
    bsat = shaper(5, gain(0.5, duckG));
    const fz = filt('peaking', 1000, 1, filt('lowpass', 2600, 0.7, gain(0.3, duckG))); fz.gain.value = 5; fuzz = gain(6, shaper(8, fz)); // guitare : écrêtage, puis baffle
    acid = filt('lowpass', 1900, 12, duckG);
    // réverbération de la musique (pièce de 1,3 s), écho rythmique filtré, chorus (deux retards modulés, un par côté, ± 8 cents : assez pour élargir, pas pour désaccorder)
    const mr = AC.createConvolver(), mi = AC.createBuffer(2, AC.sampleRate * 1.3, AC.sampleRate);
    for (let c = 0; c < 2; c++) { const x = mi.getChannelData(c); for (let i = 0; i < x.length; i++) x[i] = (Math.random() * 2 - 1) * Math.exp(-i / AC.sampleRate / 0.28); }
    mr.buffer = mi; mrevG = gain(0.2, tuneG); mr.connect(mrevG); revIn = gain(1, mr); drumRv = gain(0.05, revIn); drumG.connect(drumRv);
    dly = AC.createDelay(1); dlyFb = gain(0.42, dly); dly.connect(filt('lowpass', 3500, 0.5, dlyFb)); dly.connect(duckG); echoIn = gain(1, dly);
    choIn = AC.createGain();
    for (const sg of [-1, 1]) { const dl = AC.createDelay(0.1), p = AC.createStereoPanner(), l = AC.createOscillator(); dl.delayTime.value = 0.022 + 0.004 * sg; p.pan.value = 0.8 * sg; l.frequency.value = 0.6 + 0.15 * sg; l.connect(gain(0.0012, dl.delayTime)); l.start(); choIn.connect(dl); dl.connect(p); p.connect(duckG); }
    // une tranche par partie : hachage, panoramique, envois vers réverbération, écho et chorus (réglés par le timbre de la station)
    for (const k of ['b', 'd', 'c', 'g', 'a', 'l']) { const pan = AC.createStereoPanner(), rv = gain(0, revIn), ec = gain(0, echoIn), ch = gain(0, choIn), gate = gain(1, pan); pan.connect(duckG); pan.connect(rv); pan.connect(ec); pan.connect(ch); strip[k] = { in: gain(MX[k], gate), gate, pan, rv, ec, ch }; }
    waves();
    mbuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate); // métal des cymbales : six carrés inharmoniques
    { const x = mbuf.getChannelData(0); for (let i = 0; i < x.length; i++) { let v = 0; for (const f of [410.6, 608.8, 739.2, 1045.4, 1080, 1600]) v += Math.sin(2 * Math.PI * f * i / AC.sampleRate) > 0 ? 1 : -1; x[i] = v / 6; } }
    pret = Promise.all(Object.keys(window.SMP || {}).map(k => new Promise(ok => { // décodage des sons de TR-808 ; en cas d'échec la batterie reste synthétisée
      const bin = atob(window.SMP[k]), u8 = Uint8Array.from(bin, ch => ch.charCodeAt(0));
      AC.decodeAudioData(u8.buffer, b => { smp[k] = b; ok(); }, ok);
    })));
    const ns = AC.createBufferSource(); ns.buffer = nbuf; ns.loop = true; ns.start();
    VX.length = 0; VX[0] = voix(ns, V.mot, V.pneu); // un contexte neuf repart avec la seule voix du solo
    // frottement : tôle (bande médium et grondement) mêlée à une meule (bande aiguë étroite hachée à 72 Hz, étincelles)
    scrapeG = gain(0, V.choc); ns.connect(filt('bandpass', 1700, 1.2, scrapeG)); ns.connect(filt('lowpass', 260, 0.7, gain(1.5, scrapeG)));
    { const g = gain(0.55, scrapeG), l = AC.createOscillator(); l.type = 'square'; l.frequency.value = 72; l.connect(gain(0.45, g.gain)); l.start(); ns.connect(filt('bandpass', 2800, 6, gain(2.2, g))); ns.connect(filt('highpass', 7000, 0.7, gain(0.1, scrapeG))); }
    uiF = filt('lowpass', 3000, 0.5, V.ui);
    windG = gain(0, V.vent); ns.connect(filt('lowpass', 400, 0.5, windG));
    // pluie, entendue de l'habitacle (famille « pluie ») : rideau étouffé par la carrosserie (passe-bas + grondement, houle lente) ; gerbe d'aquaplaning sous la caisse
    const rid = gain(0, V.pluie), houle = gain(1, rid), rl = filt('lowpass', 600, 0.7, houle); ns.connect(rl); ns.connect(filt('bandpass', 220, 0.8, gain(0.6, houle)));
    const hl = AC.createOscillator(); hl.frequency.value = 0.13; hl.connect(gain(0.3, houle.gain)); hl.start();
    const aq = gain(0, V.pluie); ns.connect(filt('lowpass', 450, 0.6, aq));
    pluie = { rid, rl, aq };
    buildAmb(); retune(AC.currentTime + 0.1); tuneG.gain.value = lvl();
    if (live) { AC.resume(); timer = timer || setInterval(() => live && pump(), 30); }
  }
  const beep = f => AC && osc('square', f, AC.currentTime, 0.25, 0.2, V.ui);
  // bruitages ponctuels : appelés par audioFrame, et un par un par le banc d'écoute
  function touche(t) { // bouton de radio : deux claquements secs dans le médium
    nz(t, 0.018, CLAC, V.ui, 'bandpass', 1900, 2.5); osc('triangle', 150, t, 0.05, CLAC * 0.25, V.ui);
    nz(t + 0.07, 0.03, CLAC * 1.4, V.ui, 'bandpass', 2850, 2); nz(t + 0.07, 0.012, CLAC * 0.6, V.ui, 'highpass', 4000); osc('square', 320, t + 0.07, 0.03, CLAC * 0.15, V.ui);
  }
  function clac(down, t = AC.currentTime, d = V.mot) { // d : la sortie de la voix du joueur · // passage de rapport : coup sourd de transmission, puis soupape de décharge en montée, coup de gaz en rétrogradant ; la coupure de poussée vient de la physique
    const o = osc('sine', 110, t, 0.1, 0.45, d); o && o.frequency.exponentialRampToValueAtTime(55, t + 0.08);
    nz(t, 0.03, 0.25, d, 'lowpass', 700);
    if (down) { const b = osc('sawtooth', 130, t + 0.03, 0.14, 0.22, filt('lowpass', 1100, 0.7, d)); b && b.frequency.exponentialRampToValueAtTime(230, t + 0.12); }
    else { const h = nz(t + 0.03, 0.22, 0.2, d, 'bandpass', 2600, 1.2); h && h.frequency.exponentialRampToValueAtTime(900, t + 0.24); }
  }
  function levier(down, t = AC.currentTime, d = V.mot) { // boîte manuelle : c'est le pilote qui passe le rapport — le cran qui lâche, la course du levier dans la grille, puis le verrouillage métallique, franc
    nz(t, 0.012, LEV * 0.6, d, 'bandpass', 3800, 6); nz(t + 0.045, 0.02, LEV * 0.4, d, 'bandpass', 900, 1.2);
    const tt = t + 0.085, f = down ? 1150 : 1500;
    nz(tt, 0.02, LEV, d, 'bandpass', 4600, 5); osc('sine', 150, tt, 0.07, LEV * 0.4, d);
    for (const [k, v] of [[1, 0.1], [2.76, 0.06], [5.4, 0.03]]) osc('sine', f * k, tt, 0.09, LEV * v, d); // tintement : partiels d'une barre de métal, plus grave au rétrogradage
  }
  function coupMusique(v, t = AC.currentTime) { // un choc s'entend aussi dans la musique : grosse caisse et coup de basse sur la fondamentale de la mesure, et tout plonge un instant
    if (menu) return; const st = ST[station], P = PATCH[st.b.p];
    const k = 0.5 * clamp(0.5 + v * 0.04, 0.6, 1), o = osc('sine', hz(curRoot + 12), t, 0.55, 0.7 * k, drumG); o && o.frequency.exponentialRampToValueAtTime(hz(curRoot - 12), t + 0.4); // chute de sub de deux octaves
    dKick(t, k, KIT[st.kit] || KIT.k909); tone(st.b.p, hz(curRoot), t, 0.4, 0.25 * (P.lv || 1), strip.b.in);
    duckG.gain.cancelScheduledValues(t); duckG.gain.setValueAtTime(0.85, t); // effet de choc adouci : demi-gain, plongée légère duckG.gain.linearRampToValueAtTime(1, t + 0.3);
  }
  function choc(hit, t = AC.currentTime) { // choc saturé : il écrête, glisse vers le grave, et des débris retombent
    const v = Math.min(0.6, hit * 0.04), sat = shaper(10, gain(0.5 * clamp(v / 0.6, 0.3, 1), V.choc)), f = nz(t, 0.3, v * 1.2, sat, 'bandpass', 1200, 0.7); f && f.frequency.exponentialRampToValueAtTime(200, t + 0.25); // la saturation nivelle tout : c'est le gain de sortie qui distingue un petit choc d'un gros
    const o = osc('sawtooth', 90, t, 0.25, v * 0.7, sat); o && o.frequency.exponentialRampToValueAtTime(40, t + 0.2);
    for (let i = 0; i < 9; i++) nz(t + 0.15 + Math.random() * 0.65, 0.012, v * (0.1 + Math.random() * 0.2), V.choc, 'highpass', 3000);
  }
  function boostFx(t = AC.currentTime) { const o = osc('sawtooth', 220, t, 0.5, 0.1, filt('lowpass', 3000, 0.5, V.choc)); o.frequency.exponentialRampToValueAtTime(880, t + 0.4); const w = nz(t, 0.6, 0.08, V.choc, 'bandpass', 500, 1.5); w.frequency.exponentialRampToValueAtTime(4000, t + 0.5); } // départ de la nitro : sifflement + souffle
  function petarade(spool = 1, t = AC.currentTime, d = V.mot) { nz(t, 0.25, 0.04 * spool, d, 'bandpass', 1400, 1.5); for (let i = 0; i < 3; i++) nz(t + 0.08 + Math.random() * 0.4, 0.035, 0.12, d, 'lowpass', 900); } // lever de pied à haut régime
  // e : état de la course pour cette image — { state, car, T, hot (0..1 dans le secteur chaud), tour / tours (tour en cours à partir de 0, nombre de tours ; 0 hors mode course), tun (0..1 dans le tunnel), amb (0..1 dans une zone d'ambiance), r (vitesse 0..1), sp, gas, hit, bump (choc entre voitures, m/s), up / down (rapport monté / descendu), rpm, load, spool, stun }
  // Écran partagé : e.cars = les voitures humaines, une par joueur — [{ car, r, sp, gas, hit, bump, up, down, rpm, load, spool }] ; le reste de e (state, car, T, hot, tour, tun, amb, r, sp, hit, bump, fini) est alors celui de l'humain le mieux placé encore en course, qui pilote la musique, le tunnel, la pluie et l'ambiance. Sans e.cars, e est le seul joueur (banc d'écoute).
  // Pluie : rideau étouffé à travers la carrosserie, plus fort et plus clair avec la vitesse. pl = force 0..3 (T.pluie), déjà coupée en tunnel ; r = vitesse 0..1 ; aq = aquaplaning (sim.js)
  function pluieFrame(pl, r, aq, k) {
    k(pluie.rid.gain, 0.045 * Math.min(pl, 3) / 3 * (0.6 + 0.4 * r), 0.4); k(pluie.rl.frequency, 400 + 700 * r, 0.3);
    k(pluie.aq.gain, 0.25 * aq, 0.1);
  }
  function audioFrame(dt, e) {
    if (!AC) return;
    const { state, car, T, r, sp } = e, N = T.n, tun = e.tun || 0, CARD = M.car, t = AC.currentTime, racing = state === 'race', k = (p, v, tc = 0.04) => p.setTargetAtTime(v, t, tc);
    if (state === 'pause') { for (const v of VX) tait(v, t); k(scrapeG.gain, 0, 0.05); k(windG.gain, 0, 0.05); k(pluie.rid.gain, 0, 0.05); k(pluie.aq.gain, 0, 0.05); return; } // en pause : la radio continue, les voitures se taisent
    if ((state === 'title') !== menu) { menu = !menu; retune(t + 0.05); tuneG.gain.cancelScheduledValues(t); tuneG.gain.setValueAtTime(0, t); tuneG.gain.linearRampToValueAtTime(lvl(), t + 0.3); } // menu ↔ course : la boucle de menu laisse la place à la station
    // une voix par joueur : seul, celle du centre, inchangée ; à deux, une de chaque côté, créées à l'arrivée du deuxième joueur et retirées à son départ (fondu, puis arrêt des sources)
    const L = e.cars || (UN[0] = e, UN), duo = L.length > 1; let hit = 0, bump = 0, rub = false; // chocs et frottement : ceux de n'importe quel joueur s'entendent (la musique, elle, n'encaisse que ceux du mieux placé)
    if (duo !== VX.length > 1) { if (duo) { VX[1] = voixPan(-PANJ); VX[2] = voixPan(PANJ); } else { for (let i = 1; i < 3; i++) { tait(VX[i], t); for (const s of VX[i].src) s.stop(t + 0.3); } VX.length = 1; } }
    if (duo) tait(VX[0], t);
    for (let i = 0, n = duo ? 2 : 1; i < n; i++) { const j = L[i], v = VX[duo ? i + 1 : 0], c = j.car, { rpm, load } = j;
      if (j.muet) { tait(v, t); continue; } // pas la voiture de ce joueur, ou déjà entendue de l'autre côté : sa voix se tait mais reste en place (ni coupure ni recréation)
      // moteur (discret sous la musique) : coupure au passage de rapport, timbre selon la charge, turbo, pétarades au lever de pied
      if (j.up || j.down) (c.manual ? levier : clac)(j.down, t, v.mot); // boîte manuelle : le levier ; automatique : la transmission
      const f = rpm * CARD.red / 40 * CARD.son; // la moitié de la fréquence d'allumage d'un 6 cylindres (3 explosions par tour) : même montée en régime, une octave plus grave
      k(v.a.frequency, f); k(v.b.frequency, f / 2); k(v.c.frequency, f * 2); k(v.lfo.frequency, f / 3);
      k(v.lp.frequency, 180 + rpm * 320 + load * 380); k(v.drive.gain, 0.35 + 0.5 * load); k(v.lfoG.gain, 0.1 + 0.15 * load); // filtre bas : le grave domine
      k(v.out.gain, state === 'title' ? 0.004 : 0.014 + 0.024 * load + 0.008 * rpm); // sous la musique, mais présent (+6 dB par rapport au réglage précédent, timbre inchangé)
      if (v.gas && !j.gas && racing && rpm > 0.55 && j.spool > 0.5) petarade(j.spool, t, v.mot);
      v.gas = j.gas;
      // pneus : rien en appui normal ; le feulement monte lentement avec l'angle de glisse, en volume plus qu'en hauteur
      const slip = Math.abs(c.vl), a = j.sp > 8 ? clamp((slip - 4) / 14, 0, 1) : 0, fq = 380 + 150 * a + 10 * Math.sin(t * 21);
      k(v.b1.frequency, fq, 0.05); k(v.b2.frequency, fq * 1.52, 0.05); k(v.g.gain, 0.22 * a, 0.2);
      k(v.scrub.gain, 0.5 * clamp(slip / 12, 0, 1) * j.r, 0.08);
      hit = Math.max(hit, j.hit || 0); bump = Math.max(bump, j.bump || 0); rub = rub || !!c.rub;
    }
    k(windG.gain, 0.045 * clamp((r - 0.5) * 2, 0, 1) ** 2 * (1 - tun), 0.2); // vent : un souffle à haute vitesse seulement, loin sous le moteur, coupé en tunnel
    pluieFrame(state === 'title' ? 0 : (e.pluie != null ? e.pluie : T.pluie ? T.pluie[car.idx] : 0) * (1 - tun), r, car.aq || 0, k);
    rubT -= dt; if (bump > 0.3) rubT = 0.35; // deux voitures qui se touchent : un petit choc, puis elles frottent un instant
    k(scrapeG.gain, rub || rubT > 0 ? 0.1 + 0.2 * r : 0, 0.05);
    if ((hit > 3 || bump > 0.3) && t - lastHit > 0.15) { lastHit = t; choc(Math.max(hit, bump > 0.3 ? 5 + bump * 2 : 0), t);
      if (racing && t - lastMus > 4 && e.hit > 6) { lastMus = t; coupMusique(e.hit, t); satT = 0.2; if (e.hit > 14) platine = 1; } } // adouci : seul un vrai choc de mur touche la musique (le contact entre voitures plus du tout), au plus toutes les 4 s, ralenti de platine réservé aux gros chocs // au plus une fois toutes les 2 s : en rebondissant de mur en mur (pluie), la musique restait plongée, ralentie et saturée en continu // la musique encaisse : coup de basse, demi-seconde de saturation, et sur un gros choc elle ralentit comme une platine qu'on freine
    // glisse (car.dd, car.driftT) : la tension monte en 1,5 s, palier à 0,6 s (la jauge de nitro se remplit alors à plein débit) ; nitro déclenchée (car.boost) : tout s'ouvre d'un coup et le refrain joue tant qu'elle pousse
    const gl = racing && car.dd ? car.driftT || 0 : 0, vise = car.boost > 0 ? 0 : clamp(gl / 1.5, 0, 1);
    glisse = gl > 0.15; acquis = gl > 0.6; if (!glisse) acqDit = false; boostL = racing && car.boost > 0;
    if (car.boost > 0 && !wasBoost) { boostFx(t); boostPend = true; tens = 0; }
    tens += (vise - tens) * Math.min(1, dt * (vise > tens ? 8 : 3)); k(hpF.frequency, 20 * 20 ** tens, 0.08); // passe-haut : de 20 à 400 Hz, le grave s'amincit sans disparaître
    wasBoost = car.boost > 0;
    // ambiance du lieu : seulement dans ses zones (e.amb, fondu fait par le jeu), jamais au menu ni en tunnel ; événements espacés au hasard, dans la zone
    const amb = state === 'title' ? 0 : (e.amb || 0) * (1 - tun);
    k(ambBed.gain, 0.6 * amb, 0.4); if (amb > 0.5) { if (!inZone) ambT = Math.min(ambT, 1.2); if ((ambT -= dt) < 0) ambT = ambEvent(t + 0.05); } inZone = amb > 0.5;
    // musique : sections et filtres suivent la course
    const a0 = (car.idx - T.h0 + N) % N, inside = a0 < T.h1 - T.h0, near = racing && !inside && N - a0 < 60;
    if (near && !wasNear) riser(t, clamp((N - a0) * 2 / Math.max(sp, 20), 0.5, 3));
    if (TH.alarme && inside && !wasIn && racing) for (let i = 0; i < 6; i++) osc('square', i % 2 ? 660 : 880, t + 0.25 + i * 0.18, 0.16, 0.07, strip.a.in); // sirène d'alarme à l'entrée
    wasNear = near; wasIn = inside;
    if (racing && !drums && !menu) { stp = 64; nextT = Math.max(nextT, t); for (const p of 'kbdcgal') was[p] = true; bigS = false; } // le départ est un événement de course : tout entre franchement // départ : on saute l'introduction, la course s'ouvre sur le premier couplet (l'introduction revient quand la forme boucle)
    // au fil des tours du mode course (e.tour, e.tours) : premier tour sobre, puis l'arrangement complet, et le dernier tour un demi-ton plus haut ; le passage de ligne est un événement de course, la cymbale le marque
    const nl = !e.tours ? 1 : e.tour <= 0 ? 0 : e.tour >= e.tours - 1 ? 2 : 1;
    if (racing && e.tours && e.tour !== lapN) { if (lapN >= 0 && e.tour > lapN) crash(t, 0.5); lapN = e.tour; } if (!racing) lapN = -1;
    lap = racing ? nl : 1; platine = Math.max(0, platine - dt); TR = (lap === 2 ? 1 : 0) - platine; // ralenti de platine : un demi-ton et 10 % de tempo en moins, rattrapés en 1 s
    drums = racing ? 1 : 0; fin = racing && !inside && car.idx >= T.h1 && car.dist > 0;
    mix += ((racing ? e.hot : 0) - mix) * Math.min(1, dt * 3);
    inten += (r - inten) * Math.min(1, dt * 2); driftL += ((car.drift ? 1 : 0) - driftL) * Math.min(1, dt * 6);
    // seul un vrai choc de mur salit un peu la musique, un cinquième de seconde (la saturation près des murs et en frottant a été retirée : sur une route étroite elle ne s'arrêtait jamais)
    satT -= dt; if (satT > 0) grit = 1;
    grit -= grit * Math.min(1, dt * 3); k(gritWet.gain, 0.05 * grit, 0.03); k(gritDry.gain, 1 - 0.25 * grit, 0.03); // dosé par mesure : le timbre change, le niveau presque pas
    // la musique s'ouvre avec la vitesse ; un gros choc l'étouffe ; dans un tunnel elle est étouffée et réverbérée, et le moteur résonne
    // (la musique n'est plus étouffée par un choc, et à peine quand on ralentit : passe-bas de 5 à 18 kHz selon la vitesse ; elle s'efface derrière le tableau d'arrivée)
    k(musF.frequency, e.fini ? 900 : Math.min(state === 'title' ? 7000 : 5000 * 3.6 ** Math.min(1, inten * 1.4 + mix), lerp(18000, 2500, tun)), 0.08);
    k(musSend.gain, 0.7 * tun, 0.2); k(motSend.gain, 2.5 * tun, 0.2);
  }

  document.addEventListener('visibilitychange', () => { if (AC && live) document.hidden ? AC.suspend() : AC.resume(); }); // pas de musique hachée ni de moteur figé en arrière-plan
  window.SON = {
    init: initAudio, frame: audioFrame, setStation, carte, pump, beep, stinger, arrivee, quitter, reprendre,
    crash: () => AC && crash(),
    tonnerre: () => { if (!AC) return; const t = AC.currentTime + 0.4; nz(t, 2.4, 0.5, V.amb, 'lowpass', 140); nz(t, 1.2, 0.12, V.amb, 'bandpass', 600, 0.6); }, // grondement + craquement dans le médium
    toggleMusic() { musicOn = !musicOn; if (AC) musicG.gain.value = musicOn ? 1 : 0; },
    volume(fam, v) { vol[fam] = v; if (V[fam]) V[fam].gain.value = v; },
    evenement: () => { ambT = 0; }, get live() { return live; },
    clac: down => AC && clac(down), levier: down => AC && levier(down), choc: v => AC && choc(v), boost: () => AC && boostFx(), petarade: () => AC && petarade(),
    moniteur(v) { if (outG) outG.gain.value = OUT * v; }, get vu() { return vu; }, // gain d'écoute du banc : sans effet sur le jeu
    get vol() { return vol; }, get pret() { return pret; }, get stations() { return ST; },
    get station() { return station; }, get nom() { return ST[station].name; }, get fq() { return ST[station].fq; }, get genre() { return ST[station].genre; }, get musicOn() { return musicOn; },
    get beat() { return AC ? Math.max(0, (AC.currentTime - t0) / (4 * S16)) : 0; }, // temps écoulés depuis le début de la station, calés sur le kick
    get pulse() { return AC ? Math.exp(-(this.beat % 1) * 5) : 0; },
    get ana() { return ana; }, // analyseur de spectre, pour l'égaliseur du HUD
    ecoute: EC, recale() { if (AC) { retune(AC.currentTime, 1); tuneG.gain.setTargetAtTime(lvl(), AC.currentTime, 0.05); } }, // éditeur de musique : applique un réglage de station sans relancer le morceau
    note(p, n) { const st = ST[station]; if (!AC || menu || !st[p]) return; const P = PATCH[st[p].p] || {}; // fait entendre une note de la basse ou du thème (piano-roll de l'éditeur)
      tone(st[p].p, hz(n), AC.currentTime, 0.25, p === 'l' ? (P.lv || 0.15) * (st.lV == null ? 1 : st.lV) : 0.3 * (P.lv || 1), strip[p].in); },
    get fond() { return curRoot; }, // fondamentale de la mesure en cours
    get pas() { return stp; }, get timbres() { return Object.keys(PATCH); }, get kits() { return Object.keys(KIT); },
    get ac() { return AC; }, get out() { return master; }, get smp() { return Object.keys(smp); }, // prises de test
  };
})();
