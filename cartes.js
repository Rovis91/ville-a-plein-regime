// Les cartes du jeu : une carte = un tracé + une voiture + une radio + un thème (décor, lumière, interface). Aucun rendu ici.
// Chargé avant sim.js (navigateur) ou par lui (node). La carte active est choisie une fois, au chargement : ?carte=<id>, sinon la dernière jouée.
// Changer de carte recharge la page : le décor n'est construit qu'une fois, comme avant.
//
// Champs d'une carte :
//   W demi-largeur de route (m) · grip adhérence latérale maxi (m/s²) · sc échelle du tracé · pts [x, z, altitude], sens horaire, départ en [0]
//   camH hauteur de la caméra (m, 3,2 par défaut : à relever quand la voiture masque la route) · tun [a, b] tunnel entre deux points (ou null) · chaud [a, b] secteur où la musique se déchaîne · amb [[a, b], …] zones où l'on entend l'ambiance du lieu · sect [a, b] les deux temps intermédiaires
//   anticipe : le pilote automatique calcule sa distance de freinage (indispensable dès qu'il y a une épingle)
//   rivaux : prénoms des trois adversaires du mode course (sinon ceux de la ville) · trafic : nombre de camions à doubler · car : la voiture (format CARD de sim.js) · radio : stations (voir RADIO plus bas) · th : thème
(function (G) {
  const _ = null;
  // voiture : up / down = régimes de passage de la boîte auto ; trac = accélération maxi que les pneus passent au sol (m/s²) ;
  // rwd = propulsion : accélérer fort prend sur l'adhérence latérale des roues arrière ; son = hauteur du moteur ; look = silhouette
  const car = (o) => Object.assign({ up: o.red * 0.94, down: o.red * 0.775, eff: 0.88, trac: 8.5, rwd: 1, son: 1 }, o);

  // ---------- radio : trois stations par carte, chacune avec son instrumentarium et sa forme (compositions originales, jouées par audio.js) ----------
  // Une station : name, fq, vol (niveau, réglé par mesure dans ecoute.html), genre, bpm, sw (swing, en fraction de double-croche), key (tonique des thèmes) ·
  //   kit batterie (KIT dans audio.js) · eq [grave dB, médium Hz, médium dB, aigu dB] · rev réverbération · echo [pas, réinjection] · pump profondeur de la
  //   pompe sous la grosse caisse (1 = aucune) · sweep filtre balayé sur 8 mesures · drive saturation de tout le bus ·
  //   prog : progressions d'accords (la section choisit avec P1) ·
  //   parties, chacune avec ses variantes de motif (16 pas par mesure, « | » sépare les mesures) :
  //     k grosse caisse · s caisse claire (g fantôme, c clap, r cercle) · h charlestons (x X o, r ride, b cloche) · p percussions (c cloche, v clave, h l congas,
  //     m shaker, t tambourin, 1 2 3 toms, k métal) · b [timbre, lignes de basse en demi-tons depuis la fondamentale] · d [timbre de nappe, transposition] ·
  //     c et g [timbre, rythmes d'accords plaqués] · a [timbre, arpèges : 0-3 notes de l'accord, 4-7 à l'octave] · l [timbre, thèmes en demi-tons depuis key]
  //     (dans une ligne ou un thème : « - » tenue, « . » silence) · gate : motif de la nappe hachée
  //   sec : les sections, « k0 s1 b0 d l0! » = parties jouées et variante ; « ! » seulement dans le secteur chaud ; P1 autre progression ; roll montée
  //     (roulement et souffle) ; lo passe-bas qui s'ouvre au fil de la section ; gate nappe hachée ·
  //   cv niveau des couplets par rapport au refrain (réglé par mesure, pour que l'écart reste sous 3 dB) ·
  //   gamme (mineur, majeur) · emprunts : accords qui sortent de la gamme, voulus · hors : notes hors gamme permises (demi-tons depuis key) ·
  //   bPar : la ligne de basse suit l'accord en parallèle, dans ces intervalles (riff de rock sur accords de puissance) ·
  //   form : la suite des sections (4 mesures chacune) · hot : le refrain (c par défaut), joué à la place de toutes les sections dans le secteur chaud, sauf la variation e.
  const R = -99; // silence dans une ligne
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }, QUAL = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], M7: [0, 4, 7, 11], m9: [0, 3, 10, 14], 9: [0, 4, 10, 14], 5: [0, 7, 12] };
  // « Am7 D7 … » → accords autour du do central et fondamentales de basse
  const prog = s => { const CH = [], ROOT = []; for (const c of s.split(' ')) { const [, n, acc, q] = c.match(/^([A-G])([b#]?)(.*)$/), pc = (NOTE[n] + (acc === '#' ? 1 : acc === 'b' ? -1 : 0) + 12) % 12;
    CH.push(QUAL[q].map(i => (pc < 5 ? 60 : 48) + pc + i)); ROOT.push((pc < 4 ? 36 : 24) + pc); } return { CH, ROOT }; };
  const bars = (s, n) => s.split('|').map(b => { b = b.trim(); if ((n ? b.split(/\s+/) : b).length !== 16) throw new Error('mesure de ' + (n ? b.split(/\s+/) : b).length + ' pas : ' + b); return b; });
  const seq = (s, key = 0) => bars(s, 1).map(b => b.split(/\s+/).map(x => x === '-' ? _ : x === '.' ? R : key + +x));
  // justesse : gamme de la station (demi-tons depuis key) ; par mesure, les notes permises = la gamme et l'accord. Un accord emprunté (déclaré dans
  // emprunts) remplace la note de la gamme qu'il altère. La basse est recalée dessus par audio.js ; les thèmes doivent y être écrits (test-cartes.js).
  const GAMME = { mineur: [0, 2, 3, 5, 7, 8, 10], majeur: [0, 2, 4, 5, 7, 9, 11] };
  const st = o => {
    o.accords = o.prog.map(p => p.split(' ')); o.prog = o.prog.map(prog); o.hot = o.hot || 'c';
    const sc = GAMME[o.gamme].map(i => (o.key + i) % 12);
    for (const pr of o.prog) pr.OK = pr.CH.map((ch, i) => { const c = [...ch, pr.ROOT[i]].map(n => n % 12), ok = new Set(sc);
      for (const x of c) if (!sc.includes(x)) for (const v of [(x + 1) % 12, (x + 11) % 12]) if (!c.includes(v) && v !== o.key % 12) ok.delete(v);
      for (const x of [...c, ...(o.hors || []).map(h => (o.key + h) % 12)]) ok.add(x); return ok; });
    for (const k of 'kshp') if (o[k]) o[k] = o[k].map(v => bars(v));
    for (const k of 'cga') if (o[k]) o[k] = { p: o[k][0], v: o[k].slice(1).map(v => bars(v)) };
    if (o.b) o.b = { p: o.b[0], v: o.b.slice(1).map(v => seq(v)) };
    if (o.l) o.l = { p: o.l[0], v: o.l.slice(1).map(v => seq(v, o.key)) };
    for (const k in o.sec) { const s = {}; for (const tk of o.sec[k].split(' ')) { const m = tk.match(/^([kshpbdcgal])(\d?)(!?)$/); if (m) s[m[1]] = { v: +m[2] || 0, big: !!m[3] }; else if (/^P\d$/.test(tk)) s.P = +tk[1]; else s[tk] = 1; } o.sec[k] = s; }
    for (const k of o.form) if (!o.sec[k]) throw new Error(o.name + ' : section inconnue ' + k);
    return o; };
  const F4 = 'x...x...x...x...', OFF = '..o...o...o...o.', SN = '....x.......x...', CP = '....c.......c...';
  const RADIO = {
    ville: [
      st({ name: 'NIGHT CITY FM', fq: '98.7', vol: 0.41, genre: 'DARKSYNTH', bpm: 128, gamme: 'mineur', emprunts: 'Bb E', key: 57, kit: 'dur', eq: [4, 2500, -6, -1], rev: 0.25, pump: 0.3, // façon Carpenter Brut / Perturbator : boîte des années 80, basse saturée, chœur sombre, thème hurlant
        prog: ['Am Am F G Am Am Bb E', 'F G Dm E'], k: [F4, 'x...x...x.x.x...'], s: [SN], h: ['..x...x...x...x.', 'xxXxxxXxxxXxxxXx'],
        b: ['bDark', '0 - 0 0 - - 12 0 - - 0 3 0 - -2 1 | 0 - 0 0 - - 12 0 - 0 7 - 6 - 5 3', '0 0 0 0 0 0 0 0 0 0 0 0 0 0 12 0'], d: ['choir', 0], c: ['brass', 'x..x..x....x....'], a: ['pulseArp', '0121201245656456', '0.2.4.2.0.2.4.6.'],
        l: ['ldSync', '19 - - 19 - . 17 - 19 - - - 22 - - - | 19 - - - - - . - 15 - 17 - 15 - - - | 20 - - 20 - . 19 - 20 - - - 24 - - - | 22 - - - - - . - 17 - 19 - 17 - - - | 19 - - 19 - . 17 - 19 - - - 22 - - - | 19 - - - - - . - 15 - 17 - 15 - - - | 20 - - 20 - . 17 - 20 - - - 25 - - - | 23 - - - - - - - 26 - - - - - - -',
          '20 - - - 24 - - - 27 - 24 - 20 - - - | 22 - - - 26 - - - 29 - 26 - 22 - - - | 29 - - 27 - - 24 - 20 - - - 24 - - - | 23 - - - 26 - - - 31 - - - - - - -'],
        sec: { i: 'h0 d a1 lo', a: 'k0 s0 h1 b0 d a1', b: 'k0 s0 h1 b0 d a0', c: 'k1 s0 h1 b0 d a0 c0 l0', x: 'd a1 l1 P1', u: 'k0 h1 b1 d roll P1', e: 'k1 s0 h1 b1 c0 l1 P1' }, form: 'iabcxuceabcc' }),
      st({ name: 'USINE 130', fq: '130.0', vol: 0.65, genre: 'TECHNO INDUSTRIELLE', bpm: 130, gamme: 'mineur', hors: [1], sw: 0.1, key: 57, kit: 'ind', eq: [-16, 1300, 10, -4], rev: 0.3, pump: 0.5, drive: 1, // ni accords ni mélodie : grosse caisse saturée, bruit, métal frappé, tom grave écrêté
        prog: ['Am'], k: [F4, 'x...x...x...x.x.', 'x..x..x.x..x..x.'], s: [SN, '....x..x....x.xx'], h: ['..X...X...X...X.', 'x.X.x.X.x.X.xxXx'], p: ['k..k..k...k..k..', '..........k.....'],
        b: ['bDist', '. . 0 - . . 0 - . . 0 - . . 0 1', '0 - . 0 - . 0 - . 0 - . 0 - 1 0'], a: ['fmMetal', '0..0..0.0..0.0..', '0.0.0.0.0.0.0.0.'],
        sec: { i: 'k0 h0', a: 'k0 s0 h0 b0', b: 'k1 s0 h1 b0 a0', c: 'k1 s1 h1 b1 a0 p0', x: 'h0 a1 p1 lo', u: 'k0 h1 a1 roll', e: 'k2 s1 h1 b1 a1 p0' }, form: 'iabcbxuceacc' }),
      st({ name: 'KAIZO BREAKS', fq: '87.5', vol: 1, genre: 'BIG BEAT', bpm: 132, gamme: 'mineur', key: 64, kit: 'brk', eq: [-4, 3500, 4, 8], rev: 0.15, echo: [2, 0.3], pump: 0.7, // façon Prodigy / Chemical Brothers : breakbeat sali, basse acide, orgue plaqué, sirène
        prog: ['Em Em Em G Em Em Am Bm', 'Em G Am Bm'], k: ['x..x......x.....', 'x..x...x..x..x..', 'x.....x...x..x..'], s: ['....x..g.g..x..g', '....x.......x.gg'], h: ['x.x.x.x.x.x.x.o.', 'x.xxx.x.x.xxx.o.'], p: ['t.t.t.t.t.t.t.t.'],
        b: ['bAcid', '0 - 0 12 - 0 - 3 0 - 12 0 - 7 - 10', '0 0 - 12 0 - 15 - 12 - 10 - 7 - 3 -'], c: ['organ', 'x.....x.........', 'x..x..x...x.x...'], a: ['clav', '0.0.2.0.3.0.2.0.'],
        l: ['ldSiren', '12 - - - - - - - 7 - - - - - - - | 12 - - - - - - - 15 - - - 14 - - -', '24 - - - 19 - - - 24 - - - 27 - 26 - | 22 - - - - - - - 19 - - - - - - -'],
        sec: { i: 'h0 b0 lo', a: 'k0 s0 h0 b0', b: 'k0 s0 h1 b0 c0', c: 'k1 s0 h1 b1 c1 l0 p0', x: 'b0 l1 lo', u: 'k2 h1 b0 roll', e: 'k2 s1 h1 b1 a0 c0' }, form: 'iabcaxucebcc' }),
    ],
    touge: [
      st({ name: 'AKINA SPEED', fq: '155', vol: 1.4, genre: 'EUROBEAT', bpm: 155, gamme: 'mineur', emprunts: 'A', key: 62, kit: 'k909', eq: [-8, 3000, 5, 10], rev: 0.2, echo: [3, 0.35], pump: 0.3, // façon Super Eurobeat : basse FM en octaves, cuivres plaqués, riff de synthé très chargé
        prog: ['Dm Bb F C Dm Bb C A', 'Bb C Dm Dm'], k: [F4], s: [CP, '....c.......c.cc'], h: [OFF, 'x.o.x.o.x.o.x.o.'],
        b: ['bFM', '0 0 12 0 0 12 0 12 0 0 12 0 0 12 0 12', '0 12 0 12 0 12 0 12 0 12 0 12 0 12 0 12'], d: ['super', 0], c: ['brass', 'x..x..x.x..x..x.', 'x.......x.......'], a: ['pluck', '0124210201242102'],
        l: ['ldSync', '12 - 12 14 - 15 - 14 12 - 10 - 12 - 15 - | 17 - - 15 - 14 - 15 - - 14 - 10 - - - | 12 - 12 14 - 15 - 17 19 - 17 - 15 - 17 - | 19 - - 17 - 14 - 17 - - 14 - 10 - - - | 24 - 22 - 20 - 19 - 17 - 19 - 20 - 19 - | 22 - - 20 - 17 - 20 - - 17 - 15 - 14 - | 22 - 19 - 22 - 24 - 26 - 24 - 22 - 19 - | 23 - - - 19 - 14 - 11 - - - - - - -',
          '20 - 24 - 27 - 24 - 20 - 24 - 27 - 29 - | 22 - 26 - 29 - 26 - 22 - 26 - 29 - 31 - | 31 - - 29 - - 27 - 24 - - - 27 - 29 - | 31 - - - - - - - . - - - 29 - 27 -'],
        sec: { i: 'h0 a0 d lo', a: 'k0 s0 h0 b0 d', b: 'k0 s0 h1 b0 d c1 a0', c: 'k0 s1 h1 b0 d c0 l0', x: 'd a0 l1 P1', u: 'k0 h1 b1 d roll P1', e: 'k0 s1 h1 b1 c0 l1 P1' }, form: 'iabccxuceacc' }),
      st({ name: 'GRAND PRIX FM', fq: '86.2', vol: 0.9, genre: 'FUSION JAZZ-ROCK', bpm: 136, cv: 1.2, gamme: 'majeur', emprunts: 'B7', key: 62, kit: 'acou', eq: [-8, 1100, 9, -3], rev: 0.25, pump: 1, // façon T-Square / Casiopea : batterie jouée avec ride et toms, basse claquée, piano électrique, solo à vent
        prog: ['Em9 A9 DM7 GM7 Em9 A9 F#m7 B7', 'GM7 F#m7 Em9 A9'], k: ['x..x..x...x..x..', 'x..x..x..xx..x.x', 'x.....x..x....x.'], s: ['....x..g.g..x..g', '....x..g....x.g.'], h: ['r.r.r.rrr.r.r.rr', 'x.x.x.x.x.x.x.o.', 'b.r.r.b.r.r.b.r.'],
        b: ['bSlap', '0 - 12 - 0 0 - 9 - 12 - 0 - 7 9 12 | 0 - 12 0 - 7 - 9 12 - 9 - 7 - 5 7', '0 - - 0 - - 7 - 0 - - 12 - 9 7 -'], d: ['warm', 0], c: ['epFM', '..x..x....x..x..', 'x.....x...x.....'],
        l: ['ldEwi', '14 - 17 19 - 21 - 19 17 - 16 - 14 - 12 14 | 16 - - 19 - 21 23 - 21 - 19 - 16 - - - | 21 - 19 - 16 - 14 16 - 19 - 23 - 21 - - | 23 - - 21 - 19 - 16 - - 14 - 16 19 - - | 26 - 24 23 - 21 - 19 21 - 23 - 24 - 26 - | 28 - - 26 - 23 - 21 - 19 - 21 23 - - - | 21 - 23 24 - 26 - 28 - 26 - 24 - 23 21 - | 25 - - - 23 - 21 - 25 - 28 - . - - -',
          '17 - 21 - 24 - 28 - 26 - 24 - 21 - 19 - | 16 - 19 - 23 - 26 - 28 - 26 - 23 - 19 - | 14 - 17 - 21 - 24 - 26 - - - 24 - 21 - | 19 - 23 - 26 - 29 - 28 - - - . - - -'],
        sec: { i: 'h2 d c1', a: 'k0 s1 h0 b1 c0', b: 'k0 s0 h0 b0 c0 d', c: 'k1 s0 h1 b0 c0 d l0', x: 'h2 c1 d l1 P1', e: 'k2 s1 h2 b1 c1 l1 P1' }, form: 'iabccxecabcc' }),
      st({ name: 'PLASTIC NIGHT', fq: '80.0', vol: 1, genre: 'CITY POP', bpm: 112, gamme: 'majeur', emprunts: 'A7', sw: 0.08, key: 60, kit: 'lin', eq: [6, 600, -6, 0], rev: 0.3, pump: 0.85, // façon Tatsuro Yamashita : majeur, piano électrique FM, cocotte de guitare, cordes, saxophone ; l'autoradio de la descente
        prog: ['FM7 G7 Em7 Am7 FM7 G7 Em7 A7', 'Dm7 G7 CM7 Am7'], k: ['x......x..x.....', 'x..x...x..x...x.'], s: [SN], h: ['x.xxx.xxx.xxx.ox', 'x.x.x.x.x.x.x.o.'], p: ['m.m.m.m.m.m.m.m.', '..c.......c..c..'],
        b: ['bFM', '0 - - 0 - 12 - - 0 - 12 - - 7 - 12 | 0 - - 0 - 12 - - 7 - 12 - 7 - 12 7', '0 - - - 12 - - - 0 - - 7 - - 12 -'], d: ['strings', 0], c: ['dxEp', '..x...x..x....x.', 'x.........x.....'], g: ['gtrMute', '.xx..xx..xx..xx.', '..x.x...x.x...x.'], a: ['bell', '..4...5...6...5.'],
        l: ['ldSax', '16 - - - 19 - 21 - - - 19 - 16 - - - | 14 - - - 17 - 19 - - - 17 - 14 - - - | 19 - - 16 - - 14 - 16 - - - . - - - | 12 - - 14 - - 16 - 21 - - - 19 - - - | 24 - - - 21 - 19 - - - 21 - 24 - - - | 23 - - - 19 - 17 - - - 19 - 23 - - - | 26 - - 23 - - 19 - 21 - - - . - - - | 25 - - - - - 21 - 19 - - - 16 - - -',
          '14 - - 17 - - 21 - 24 - - - 21 - - - | 23 - - 19 - - 17 - 14 - - - 17 - - - | 16 - - 19 - - 23 - 24 - - - - - 23 - | 21 - - - 19 - 16 - 12 - - - . - - -'],
        sec: { i: 'h1 d a0 c1', a: 'k0 s0 h1 b1 d c0', b: 'k0 s0 h0 b0 d c0 g0', c: 'k1 s0 h0 b0 d c0 g0 l0 p0', x: 'd c1 a0 l1 P1 p0', e: 'k1 s0 h0 b0 g1 c1 l1 P1 p1' }, form: 'iabccxecabcc' }),
    ],
    wangan: [
      st({ name: 'BAY 138', fq: '138', vol: 1.65, genre: 'TRANCE', bpm: 138, gamme: 'mineur', emprunts: 'B', key: 64, kit: 'k909', eq: [-9, 3000, 4, 9], rev: 0.4, echo: [3, 0.45], pump: 0.25, gate: 'x.xx.xx.x.xx.xx.', // façon Wangan Midnight Maximum Tune : basse à contretemps, nappe hachée, arpège à écho, hymne en dents de scie
        prog: ['Em C G D Em C Am B', 'C D Em Em'], k: [F4], s: [CP], h: [OFF, 'x.o.x.o.x.o.x.o.'],
        b: ['bOff', '. . 0 - . . 0 - . . 0 - . . 0 -', '. . 0 - . . 0 - . . 0 - . 0 12 -', '. 0 0 0 . 0 0 0 . 0 0 0 . 0 0 0'], d: ['super', 0], a: ['pluck', '0124210201242102', '0.2.4.2.1.2.4.2.'],
        l: ['ldSaw', '19 - - - - - 22 - 24 - - - 22 - 19 - | 20 - - - - - 24 - 27 - - - 24 - 20 - | 22 - - - - - 26 - 27 - - - 26 - 22 - | 26 - - - - - 29 - 26 - - - 22 - - - | 19 - - - - - 22 - 24 - - - 22 - 19 - | 20 - - - - - 24 - 27 - - - 24 - 20 - | 24 - - - - - 27 - 29 - - - 27 - 24 - | 23 - - - - - 26 - 31 - - - - - - -',
          '20 - - - 24 - - - 27 - - - 24 - - - | 22 - - - 26 - - - 29 - - - 26 - - - | 24 - - - 27 - - - 31 - - - 27 - - - | 36 - - - - - - - 34 - - - 31 - - -'],
        sec: { i: 'd a1 lo', a: 'k0 h0 b0 d gate', b: 'k0 s0 h1 b0 d gate a0', c: 'k0 s0 h1 b2 d gate a0 l0', x: 'd a1 l1 P1', u: 'k0 h1 d gate a0 roll P1', e: 'k0 s0 h1 b1 d a0 l1 P1' }, form: 'iabcxucceabc' }),
      st({ name: 'LIQUID 174', fq: '174', vol: 0.56, genre: 'DRUM AND BASS', bpm: 174, cv: 1.2, gamme: 'mineur', emprunts: 'A7', key: 62, kit: 'dnb', eq: [7, 700, -6, -7], rev: 0.35, pump: 0.85, // liquid teinté acid jazz : breakbeat sec, basse « Reese » tenue, nappe de verre, piano électrique
        prog: ['Dm9 Dm9 BbM7 BbM7 Gm7 Gm7 A7 A7', 'BbM7 BbM7 Am7 Am7'], k: ['x.........x.....', 'x.........x..x..', 'x......x..x.....'], s: [SN, '....x..g....x.g.', '....x..g.g..x..g'], h: ['x.x.x.x.x.x.x.x.', 'x.xXx.x.x.xXx.x.', 'r.r.r.r.r.r.r.r.'], p: ['m.mmm.mmm.mmm.mm'],
        b: ['bReese', '0 - - - - - - - - - 0 - - - 7 - | 0 - - - - - - - 12 - - - 10 - 7 -', '0 - - - - - - 0 - - 0 - - - - -'], d: ['glass', 0], c: ['epFM', '...x.....x......', 'x.....x.........'], a: ['ldVox', '....0.......2...'],
        l: ['ldTri', '19 - - - - - - - 17 - - - 15 - - - | 14 - - - - - - - . - - - 12 - 14 - | 17 - - - - - - - 15 - - - 14 - - - | 10 - - - - - - - . - - - - - - - | 22 - - - - - - - 19 - - - 17 - - - | 15 - - - - - - - . - - - 14 - 15 - | 19 - - - - - - - 14 - - - 11 - - - | 7 - - - - - - - . - - - - - - -',
          '17 - - - - - - - 22 - - - 20 - - - | 17 - - - - - - - . - - - - - - - | 19 - - - - - - - 24 - - - 22 - - - | 19 - - - - - - - . - - - 14 - - -'],
        sec: { i: 'h2 d c1 lo', a: 'k0 s0 h0 b1 d', b: 'k0 s1 h1 b0 d c0', c: 'k1 s2 h1 b0 d c0 l0 p0', x: 'd c1 l1 a0 P1', u: 'h2 b1 d roll P1', e: 'k2 s2 h1 b0 c1 a0 l1 P1' }, form: 'iabcxucceabc' }),
      st({ name: 'MOTOR BAY', fq: '127.3', vol: 1.25, genre: 'TECHNO DE DETROIT', bpm: 127, cv: 1.3, gamme: 'mineur', emprunts: 'Ebm7 Abm7 Bbm7', sw: 0.06, key: 60, kit: 'k909', eq: [-9, 900, 9, -5], rev: 0.25, echo: [3, 0.5], pump: 0.5, // façon Derrick May / Juan Atkins : accords mineurs parallèles plaqués à écho, cordes de synthé, clave et congas ; pas de thème
        prog: ['Cm7 Cm7 Ebm7 Ebm7 Cm7 Cm7 Fm7 Bbm7', 'Abm7 Abm7 Bbm7 Bbm7'], k: [F4, 'x...x...x...x..x'], s: [CP, '....r..r....r...'], h: [OFF, 'x.oxx.oxx.oxx.ox'], p: ['...v..v...v..v.v', '..h...l...h..l..'],
        b: ['bSeq', '0 - - 0 - - 0 - - 0 - - 12 - 0 -', '0 - - 0 - - 0 - - 0 - 12 - 10 - 7'], d: ['strings', 12], c: ['stabM7', 'x..x...x..x.....', '..x...x...x...x.'], a: ['bell', '....4.....4...5.', '0...2...4...2...'],
        sec: { i: 'k0 h0 c1 lo', a: 'k0 s1 h0 b0 c0', b: 'k0 s0 h1 b0 c0 d', c: 'k1 s0 h1 b1 c0 d a0 p0', x: 'd a1 c1 P1', u: 'k0 h1 b0 c1 roll P1', e: 'k1 s0 h1 b1 c1 d a1 p1 P1' }, form: 'iabcbxucecbc' }),
    ],
    paris: [
      st({ name: 'FILTRE FM', fq: '89.0', vol: 0.83, genre: 'HOUSE FILTREE', bpm: 123, cv: 1.3, gamme: 'majeur', sw: 0.12, key: 64, kit: 'k909', eq: [6, 500, 3, -6], rev: 0.15, sweep: 1, pump: 0.12, pumpT: 0.3, // French touch façon Daft Punk / Stardust : une boucle disco qui ne change pas, le filtre et la pompe font tout
        prog: ['F#m7 B7 EM7 C#m7', 'AM7 B7 G#m7 C#m7'], k: [F4], s: [CP], h: [OFF, 'x.o.x.oxx.o.x.ox'], p: ['...c......c.....', 't.t.t.t.t.t.t.t.'],
        b: ['bPick', '0 - - 0 - 12 - 0 - - 7 - 12 - 0 - | 0 - - 0 - 12 - 0 - 12 - 7 - 12 - 7', '0 - - - - - 0 - - - 12 - - - 7 -'], d: ['strings', 0], c: ['super', 'x..x..x.x..x.x..', 'x..x..x.x..x.x.x'], g: ['epFM', '..x...x...x...x.'],
        l: ['ldVox', '14 - 14 . 17 - 14 . 21 - - - 17 - - - | 19 - 19 . 23 - 19 . 26 - - - 23 - - - | 16 - 16 . 19 - 16 . 24 - - - 23 - - - | 21 - 21 . 24 - 21 . 28 - - - 24 - - -'],
        sec: { i: 'k0 c0 d', a: 'k0 h0 c0 b1', b: 'k0 s0 h1 c0 b0 p1', c: 'k0 s0 h1 c1 b0 g0 l0 p0', x: 'c0 l0 d', u: 'k0 h1 c0 roll', e: 'k0 s0 h1 c1 b0 g0 d p0 P1' }, form: 'iabbcxucecbc' }),
      st({ name: 'SATURATION', fq: '107.7', vol: 0.39, genre: 'ELECTRO SATUREE', bpm: 128, cv: 1.4, gamme: 'mineur', sw: 0.08, key: 64, kit: 'dur', eq: [-14, 2200, 10, 4], rev: 0.1, pump: 0.2, drive: 1, // façon Justice / Ed Banger : tout le bus écrêté, basse hachée, cordes coupées net, riff de guitare saturée
        prog: ['Em Em G Am Em Em C Bm', 'C C D Bm'], k: [F4, 'x...x...x..xx...', 'x.x...x.x...x.x.'], s: [SN, '....x..x....x.xx'], h: ['x.X.x.X.x.X.x.Xx', '..X...X...X...X.'],
        b: ['bDist', '0 0 - 0 - - 12 - 0 0 - 3 - 5 - - | 0 0 - 0 - - 12 - 10 - 7 - 5 - 3 -', '0 - 0 - 0 - 0 - 0 - 0 - 12 - 0 -'], c: ['strings', 'x.x...x..x......', 'x...x...x...x.x.'],
        l: ['ldGtr', '12 - 12 . 15 - 12 . 10 - 12 - . - - - | 12 - 12 . 15 - 17 . 19 - 17 - 15 - - - | 19 - 19 . 22 - 19 . 17 - 19 - . - - - | 17 - 17 . 22 - 17 . 19 - 22 - 24 - - -',
          '24 - 22 . 19 - 22 . 24 - 27 - 26 - - - | 24 - 22 . 19 - 15 . 12 - - - . - - - | 26 - 24 . 22 - 24 . 26 - 29 - 27 - - - | 22 - - - 26 - - - 31 - - - - - - -'],
        sec: { i: 'k0 h1 c1', a: 'k0 s0 h1 b0', b: 'k0 s0 h0 b0 c0', c: 'k1 s1 h0 b0 c0 l0', x: 'c1 l1 P1 lo', u: 'k2 h0 b1 roll P1', e: 'k1 s1 h0 b1 c1 l1 P1' }, form: 'iabcbxuccebc' }),
      st({ name: 'COSMOS', fq: '102.3', vol: 1.85, genre: 'DISCO SPATIAL', bpm: 118, cv: 1.35, gamme: 'majeur', key: 55, kit: 'disco', eq: [-6, 1500, 0, 9], rev: 0.3, pump: 1, // façon Cerrone / Space : batterie de disco, tambourin et congas, basse à l'octave, cocotte, cordes, arpégiateur ; ni pompe ni saturation
        prog: ['Am7 D7 GM7 CM7 Am7 D7 Em7 Em7', 'CM7 D7 Bm7 Em7'], k: [F4], s: [SN, CP], h: [OFF, 'xxoxxxoxxxoxxxox'], p: ['t.t.t.t.t.t.t.t.', '..h..l.h..h.l.l.'],
        b: ['bPick', '0 - 12 - 0 - 12 - 0 - 12 - 0 - 12 - | 0 - 12 - 0 - 12 - 0 - 12 - 7 - 12 14', '0 - - 12 - - 0 - 7 - - 12 - 7 - -'], d: ['strings', 12], c: ['gtrMute', '.xx..xx..xx..xx.', '..x.x.x...x.x.x.'], g: ['clav', 'x..x....x..x....'], a: ['seqArp', '0213021302130213', '0.2.1.3.0.2.1.3.'],
        l: ['ldStr', '14 - - - 12 - 14 - 17 - - - 14 - - - | 19 - - - 17 - 19 - 23 - - - 19 - - - | 23 - - - 21 - 19 - 16 - - - 19 - - - | 21 - - - 19 - 17 - 16 - - - . - - - | 26 - - - 24 - 26 - 29 - - - 26 - - - | 31 - - - 29 - 26 - 23 - - - 26 - - - | 28 - - - 26 - 24 - 23 - - - 21 - - - | 19 - - - - - - - . - - - - - - -',
          '24 - - - 21 - 19 - 17 - - - 19 - - - | 26 - - - 23 - 21 - 19 - - - 21 - - - | 28 - - - 26 - 23 - 19 - - - 23 - - - | 21 - - - 19 - 16 - 12 - - - . - - -'],
        sec: { i: 'h0 a1 d lo', a: 'k0 s0 h0 b1 c0', b: 'k0 s0 h1 b0 c0 d p0', c: 'k0 s1 h1 b0 c0 d a0 l0 p0', x: 'd a1 l1 p1 P1', u: 'k0 h1 b1 a0 roll P1', e: 'k0 s1 h1 b0 c1 g0 d l1 p1 P1' }, form: 'iabccxuceabc' }),
    ],
    canal: [
      st({ name: 'K-LOW', fq: '94.0', vol: 0.46, genre: 'G-FUNK', bpm: 94, cv: 1.25, gamme: 'mineur', emprunts: 'D7', sw: 0.1, key: 55, kit: 'k808', sMin: 0.45, eq: [7, 450, -4, 3], rev: 0.2, echo: [3, 0.35], pump: 0.9, // façon Dr. Dre / Warren G : lent, TR-808, caisse claire en avant, basse ronde qui glisse, sifflement de synthé à portamento
        prog: ['Gm7 Gm7 Cm7 Cm7 Gm7 Gm7 EbM7 D7', 'EbM7 D7 Gm7 Gm7'], k: ['x......x..x.....', 'x..x...x..x...x.'], s: [SN], h: ['x.x.x.x.x.x.x.x.', 'x.x.x.xxx.x.x.o.'], p: ['m.m.m.m.m.m.m.m.'],
        b: ['bMoog', '0 - - - - - 0 - - - 7 - 10 - 12 - | 0 - - - - - 0 - 12 - 10 - 7 - 5 3', '0 - - - - - - - 0 - - - - - 7 -'], d: ['warm', 0], c: ['epFM', '..x.......x..x..', 'x.......x.......'],
        l: ['ldWhistle', '31 - - - - - 34 - 36 - - - 34 - 31 - | 29 - - - - - 27 - 31 - - - - - - - | 32 - - - - - 34 - 36 - - - 39 - 36 - | 34 - - - - - 32 - 29 - - - - - - - | 38 - - - - - 36 - 34 - - - 31 - 34 - | 36 - - - - - - - 31 - - - - - - - | 39 - - - - - 36 - 34 - - - 32 - 34 - | 35 - - - - - 38 - 41 - - - - - - -',
          '32 - - - 36 - - - 39 - - - 36 - - - | 31 - - - 35 - - - 38 - - - 41 - - - | 43 - - - - - 41 - 38 - - - 36 - - - | 34 - - - - - - - 31 - - - - - - -'],
        sec: { i: 'h0 d c1 p0', a: 'k0 s0 h0 b1 c0', b: 'k0 s0 h1 b0 c0 d', c: 'k1 s0 h1 b0 c0 d l0 p0', x: 'd c1 l1 P1', e: 'k1 s0 h1 b0 c1 d l1 P1 p0' }, form: 'iabccxecabcc' }),
      st({ name: '808 BOULEVARD', fq: '102.9', vol: 1.3, genre: 'ELECTRO-FUNK', bpm: 122, cv: 1.9, gamme: 'mineur', key: 62, kit: 'k808', eq: [-4, 2800, 4, 9], rev: 0.08, echo: [2, 0.3], pump: 1, // façon Egyptian Lover / Zapp : TR-808 sèche et syncopée, cloche, basse séquencée, voix de vocodeur, talkbox
        prog: ['Dm Dm Dm Dm Dm Dm C C', 'Bb Bb C C'], k: ['x..x..x...x.x...', 'x..x..x..xx.x..x', 'x.....x...x.....'], s: [CP, '....c..c....c.c.'], h: ['xxXxxxXxxxXxxxox', 'x.x.x.x.x.x.x.o.'], p: ['c..c..c..c..c.c.', '..1...2...3.....'],
        b: ['bSeq', '0 - 0 - 12 - 0 - 0 - 0 12 - 0 10 -', '0 - 0 - 12 - 0 - 10 - 12 - 15 - 12 10'], c: ['ldVox', 'x.......x.x.....'], a: ['seqArp', '0.2.1.2.0.2.1.3.', '0120012001200120'],
        l: ['ldTalk', '12 - 12 - 15 - 12 - 10 - 12 - . - - - | 12 - 12 - 15 - 17 - 19 - - - 17 - 15 - | 12 - 12 - 15 - 12 - 10 - 7 - . - - - | 10 - 12 - . - 10 - 12 - - - - - - -',
          '24 - 22 - 20 - 22 - 24 - - - 27 - - - | 24 - 22 - 20 - 17 - 15 - - - . - - - | 22 - 22 - 26 - 22 - 29 - - - 26 - - - | 22 - 24 - 26 - - - 24 - - - - - - -'],
        sec: { i: 'k2 h1 a0', a: 'k0 s0 h1 b0 a0', b: 'k0 s0 h0 b0 a0 p0', c: 'k1 s1 h0 b1 a1 c0 l0 p0', x: 'h1 a1 c0 l1 P1 p1', u: 'k0 h0 b0 a1 roll P1', e: 'k1 s1 h0 b1 a0 c0 l1 P1 p0' }, form: 'iabcbxucecbc' }),
      st({ name: 'HIGH DESERT', fq: '66.6', vol: 0.34, genre: 'ROCK DU DESERT', bpm: 112, cv: 1.1, gamme: 'mineur', bPar: [0, 3, 5, 6, 7, 10, -2], key: 48, kit: 'rock', eq: [-6, 900, 9, -5], rev: 0.3, pump: 1, // façon Kyuss / Queens of the Stone Age : accordé en do, riff de guitare saturée, batterie rock dans sa pièce ; aucun synthé, aucune 808
        prog: ['C5 C5 C5 C5 Eb5 Eb5 F5 Bb5', 'Ab5 Ab5 Bb5 Bb5'], k: ['x.....x.x.....x.', 'x..x..x.x..x..x.', 'x.......x.......'], s: [SN, '....x.......x.x.'], h: ['X.X.X.X.X.X.X.o.', 'o.o.o.o.o.o.o.o.', 'r.r.r.r.r.r.r.r.'],
        b: ['bFuzz', '0 - - 0 - 3 - 0 - - 5 - 3 - 0 - | 0 - - 0 - 3 - 5 - 6 - 5 - 3 - -2', '0 - 0 - 0 - 0 - 0 - 0 - 3 - 5 -'], c: ['pwr', 'x.....x.....x...', 'x...............'], cO: -12,
        l: ['ldGtr', '24 - - 27 - - 29 - - 27 - - 24 - 22 - | 24 - - - - - - - 31 - - - 29 27 - - | 34 - - 31 - - 29 - - 27 - - 29 - 31 - | 36 - - - - - - - . - - - - - - -',
          '36 - - 34 - - 31 - 29 - - 31 - - 34 - | 36 - - - - - - - 39 - 36 - 34 - - - | 31 - - 34 - - 36 - 39 - - 36 - - 34 - | 31 - - - - - - - . - - - - - - -'],
        sec: { i: 'b0', a: 'k0 s0 h0 b0', b: 'k0 s0 h1 b0 c0', c: 'k1 s1 h1 b0 c0 l0', x: 'h2 b1 l1 P1', e: 'k1 s1 h1 b1 c1 l1 P1', q: 'k2 s0 h2 b1' }, form: 'iabcqxecabcc' }),
    ],
  };

  G.CARTES = [
    { id: 'ville', nom: 'VILLE A PLEIN REGIME', camH: 3.8, W: 9, grip: 44, sc: 0.85, tun: [6, 12], chaud: [6, 12], sect: [6, 12], amb: [[2, 5], [13, 15]], // pluie et rumeur : la grande courbe d'avant le tunnel, et la sortie
      pts: [[0, 0, 0], [220, 0, 0], [420, 10, 4], [560, 90, 10], [600, 240, 12], [520, 370, 6], [360, 400, -2], [230, 340, -10], [110, 400, -14], [0, 520, -14], [-150, 560, -10], [-300, 500, -4], [-360, 360, 2], [-300, 240, 8], [-380, 120, 6], [-330, 10, 2], [-180, 0, 0]],
      // Nismo Skyline GT-R Z-tune (R34, 6 cylindres en ligne biturbo « Z2 » de 2,8 L, boîte Getrag 6 rapports) : données constructeur
      car: { nom: 'NISMO GT-R Z-TUNE', ratios: [3.827, 2.360, 1.685, 1.312, 1.000, 0.793], final: 3.545, // démultiplications
        wheel: 0.326, mass: 1675, eff: 0.85, // rayon de roue (m) ; 1600 kg + pilote ; ~15 % de pertes de transmission (4 roues motrices)
        idle: 950, red: 8000, cd: 0.34, area: 2.1, // ralenti, zone rouge (tr/min) ; aérodynamique
        tq: [0, 200, 330, 450, 520, 540, 535, 505, 420], // couple (N·m) tous les 1000 tr/min : 540 N·m à 5200, 500 ch à 6800 (forme de la courbe estimée)
        up: 7500, down: 6200, trac: 11, rwd: 0, son: 1, // 4 roues motrices : ~1,1 g de motricité, pas de survirage à l'accélérateur
        look: { col: 0xff2030, l: 1, w: 1, h: 1, nez: 0.62, cab: [-0.5, 2.1, 0.5], aileron: 1, neon: 0x00f0ff } },
      radio: RADIO.ville,
      th: { decor: 'ville', fog: 0x1f0a36, fogD: [60, 800], sky: [[0, '#03020a'], [0.36, '#120a2e'], [0.47, '#5a1058'], [0.5, '#1f0a36'], [1, '#1f0a36']], stars: 140,
        astre: { dir: [0.45, 0.8, 0.4], col: '#d8e8ff', ombre: '#a8b8e0', taille: 170 }, hemi: [0x5a6cff, 0xff2a6a, 0.55], sun: [0x8fb0ff, 0.35], phares: 2.6, bloom: 0.13, scan: 0.12,
        pluie: 1, orage: 1, alarme: 1, chev: 1, piles: -61, tubes: 1, reflets: '#00a8b8', pubs: 1, murH: 1.4,
        route: ['#2c2c3a', '#383848', '#fcee0a', '#d8d8e0', '#fcee0a', '#08080c', true], mur: ['#12121a', '#00f0ff', '#fcee0a', '#0a0a10'], depart: [0xfcee0a, 0x00f0ff, '#fcee0a'],
        tun: { sol: ['#1a0606', '#260a0a', '#ff003c', '#fcee0a', '#ff003c', '#220000'], murs: ['#ff003c', '#fcee0a'], paroi: ['#140406', '#3a0a10', '#5a1018', '#080203'], plafond: ['#0c0304', '#ff5a6a', '#ffd84a', '#3a0a10'],
          fog: 0x2a0308, portail: 0xfcee0a, neons: [0xfcee0a, 0xff003c], reflets: ['#c0002c', '#b8a808'], coque: 80 },
        hud: { y: '#fcee0a', c: '#00f0ff', r: '#ff003c', fond: 'rgba(8,8,12,.82)', style: 'cyber', split: 1, jp: ['ラップ', 'スピード'], sur: ['夜間タイムアタック', 'CONTRE-LA-MONTRE NOCTURNE'], titre: ['VILLE À', 'PLEIN REGIME'] } } },

    // Touge : départ en descente, montée à 13 %, plateau du carrefour (supérette et station-service), puis quatre épingles empilées à 10 %. Adhérence de vraie route (2 g avec des pneus de course), route étroite.
    { id: 'touge', nom: 'KARASU-TOGE', W: 6, grip: 21, sc: 1, tun: null, chaud: [14, 40], sect: [10, 40], amb: [[10, 13], [41, 45]], anticipe: 1, // forêt : le plateau du carrefour au sommet, et le bas des épingles
      pts: [[0, 0, 20], [150, 0, 14], [300, -40, 10], [430, -10, 22], [560, -70, 38], [700, -40, 56], [820, 40, 74], [860, 170, 92], [800, 290, 108], [840, 400, 122], [790, 500, 132], [720, 580, 135], [640, 610, 135], [570, 580, 133], [542, 520, 130], [540, 430, 121], [540, 345, 112], [534, 331, 111], [520, 325, 110], [506, 331, 109], [500, 345, 108], [500, 430, 99], [500, 515, 90], [494, 529, 89], [480, 535, 88], [466, 529, 87], [460, 515, 86], [460, 430, 77], [460, 345, 68], [454, 331, 67], [440, 325, 66], [426, 331, 65], [420, 345, 64], [420, 430, 55], [420, 515, 46], [414, 529, 45], [400, 535, 44], [386, 529, 43], [380, 515, 42], [380, 430, 33], [372, 350, 26], [335, 285, 22], [250, 250, 18], [150, 275, 16], [50, 300, 22], [-60, 260, 19], [-150, 180, 18], [-200, 80, 18], [-140, 5, 19]],
      // Mazda RX-7 Spirit R Type A (FD3S, 2002) : birotor biturbo 13B-REW, 280 ch à 6500 tr/min, 314 N·m à 5000, 1270 kg, propulsion (rapports à vérifier sur fiche)
      car: car({ nom: 'MAZDA RX-7 SPIRIT R', ratios: [3.483, 2.015, 1.391, 1.000, 0.719], final: 4.1, wheel: 0.318, mass: 1345, idle: 900, red: 8000, cd: 0.31, area: 1.8,
        tq: [0, 150, 220, 270, 300, 314, 308, 290, 240], son: 1.5, look: { col: 0xf4f0e0, l: 0.95, w: 0.96, h: 0.9, nez: 0.72, cab: [-0.35, 1.9, 0.48], aileron: 1 } }),
      radio: RADIO.touge,
      th: { decor: 'touge', fog: 0x0b1614, fogD: [45, 560], sky: [[0, '#02040a'], [0.4, '#0a1420'], [0.49, '#1a2a30'], [0.5, '#0b1614'], [1, '#0b1614']], stars: 240,
        astre: { dir: [-0.3, 0.75, 0.5], col: '#f4f8ff', ombre: '#c8d0e0', taille: 230 }, hemi: [0x7a96c0, 0x16302a, 0.55], sun: [0xbfd0ff, 0.5], phares: 3.2, bloom: 0.1, scan: 0.1,
        chev: 1, murH: 1.1, route: ['#26282c', '#34363c', '#e8e6da', '#ff8c1a', '#26282c', '#26282c', false], mur: ['#34363a', '#e8e6da', '#a8a69c', '#101214'], depart: [0xff8c1a, 0xe8e6da, '#e8e6da'],
        hud: { y: '#f4f0e0', c: '#ff8c1a', r: '#ff2a3a', fond: 'rgba(6,12,10,.84)', style: 'trait', split: 0, jp: ['ラップ', 'スピード'], sur: ['烏峠ダウンヒル', 'DESCENTE DE NUIT'], titre: ['KARASU', 'TOGE'] } } },

    // Wangan : voie rapide du front de mer à fond, pont à haubans vers l'île du port, enfilade entre les conteneurs, tunnel immergé sous le chenal, retour en ville. Du trafic à doubler.
    { id: 'wangan', nom: 'WAN-9', W: 8, grip: 24, sc: 1, tun: [23, 28], chaud: [12, 22], sect: [8, 22], amb: [[8, 13]], anticipe: 1, trafic: 9, // port et corne de navire : du bout du pont aux premiers conteneurs
      pts: [[0, 0, 18], [400, 0, 18], [800, 0, 18], [1100, 10, 18], [1300, 60, 19], [1400, 180, 23], [1410, 310, 33], [1400, 440, 26], [1390, 550, 19], [1340, 660, 12], [1220, 730, 6], [1080, 740, 3], [940, 700, 2], [800, 760, 2], [660, 700, 2], [520, 770, 2], [380, 710, 2], [240, 780, 2], [100, 720, 2], [-60, 790, 2], [-220, 760, 2], [-400, 800, 2], [-540, 760, 0], [-610, 660, -5], [-620, 540, -13], [-620, 400, -15], [-610, 250, -15], [-620, 110, -14], [-620, -20, -9], [-600, -130, 0], [-520, -230, 9], [-380, -250, 15], [-240, -180, 18], [-150, -60, 18]],
      // Toyota Supra RZ (JZA80, 1997) : 6 en ligne biturbo 2JZ-GTE, fiche export 320 ch, 427 N·m à 4000 tr/min, 1510 kg, Getrag V160 (rapports à vérifier sur fiche)
      car: car({ nom: 'TOYOTA SUPRA RZ', ratios: [3.827, 2.360, 1.685, 1.312, 1.000, 0.793], final: 3.266, wheel: 0.318, mass: 1585, idle: 800, red: 6800, cd: 0.32, area: 1.95,
        tq: [0, 180, 300, 400, 427, 420, 400, 340, 260], son: 0.95, look: { col: 0x4a4e5c, l: 1.02, w: 1, h: 0.96, nez: 0.66, cab: [-0.45, 2.1, 0.5], aileron: 2 } }),
      radio: RADIO.wangan,
      th: { decor: 'wangan', fog: 0x0c1424, fogD: [90, 1300], sky: [[0, '#02030a'], [0.38, '#0a1024'], [0.47, '#4a2c18'], [0.5, '#0c1424'], [1, '#0c1424']], stars: 40,
        astre: { dir: [0.5, 0.7, -0.4], col: '#e8e0d0', ombre: '#b8b0a0', taille: 120 }, hemi: [0x4a5a8a, 0xff9a2e, 0.55], sun: [0x8fa0d0, 0.25], phares: 2.4, bloom: 0.1, scan: 0.1,
        chev: 1, piles: -14, murH: 1.4, route: ['#24262e', '#30323c', '#f4f1e0', '#f4f1e0', '#24262e', '#24262e', false], mur: ['#3a3e46', '#c9ced6', '#ff9a2e', '#16181e'], depart: [0x1f8f5a, 0xc9ced6, '#f4f1e0'],
        tun: { sol: ['#2a2218', '#3a2e20', '#f4f1e0', '#f4f1e0', '#2a2218', '#2a2218'], murs: ['#ffb85a', '#ffb85a'], paroi: ['#3a2c18', '#6a5028', '#8a6a38', '#120e08'], plafond: ['#1a140c', '#ffb85a', '#ffb85a', '#3a2e20'],
          fog: 0x2a1a08, portail: 0x1f8f5a, neons: [0xff9a2e, 0xff9a2e], coque: 80 },
        hud: { y: '#ffffff', c: '#ffb85a', r: '#ff2a3a', fond: 'rgba(10,84,52,.92)', style: 'panneau', split: 0, jp: ['周回', '速度'], sur: ['湾岸九号線', 'LIGNE DE BAIE'], titre: ['WAN-9', 'BAYSHORE'] } } },

    // Paris à l'aube : circuit de rues, relances entre des angles, pavés.
    { id: 'paris', nom: 'PREMIER METRO', rivaux: ['LUCIE', 'MARC', 'INES'], W: 7, grip: 19, sc: 1, tun: [27, 30], chaud: [13, 22], amb: [[3, 7], [23, 26]], sect: [12, 25], anticipe: 1,
      pts: [[0, 0, 0], [200, 0, 0], [330, 15, 0], [424, 70, 0], [476, 70, 0], [515, 37, 0], [524, -13, 0], [498, -57, 0], [430, -160, 0], [420, -300, 2], [450, -390, 4], [540, -420, 6], [700, -420, 8], [810, -435, 12], [880, -480, 19], [860, -545, 26], [800, -590, 31], [830, -660, 37], [930, -670, 42], [1020, -630, 44], [1070, -540, 38], [1040, -410, 26], [1085, -280, 14], [1060, -150, 4], [1100, 0, 0], [1090, 140, -2], [1010, 225, -4], [800, 240, -6], [600, 250, -12], [400, 250, -12], [200, 240, -6], [0, 240, -3], [-150, 225, 0], [-235, 150, 0], [-235, 60, 0], [-150, 0, 0]],
      // Renault 5 Maxi Turbo (1985, Groupe B) : 4 cylindres turbo 1,5 L, 350 ch, 905 kg, moteur central arrière, propulsion (rapports estimés)
      car: car({ nom: 'RENAULT 5 MAXI TURBO', ratios: [3.36, 2.06, 1.38, 1.06, 0.82], final: 3.89, wheel: 0.29, mass: 980, idle: 1000, red: 7500, cd: 0.40, area: 1.9,
        tq: [0, 120, 220, 330, 400, 420, 400, 370, 300], son: 1.25, look: { col: 0xf2c400, l: 0.8, w: 0.98, h: 1.12, nez: 0.3, cab: [-0.25, 2.3, 0.62], aileron: 0 } }),
      radio: RADIO.paris,
      th: { decor: 'paris', fog: 0xf0b89a, fogD: [140, 1500], sky: [[0, '#2b3a67'], [0.26, '#2b3a67'], [0.27, '#5a6a9a'], [0.38, '#5a6a9a'], [0.39, '#c08a9a'], [0.45, '#c08a9a'], [0.46, '#f0b89a'], [1, '#f0b89a']], stars: 0,
        astre: { dir: [0.8, 0.14, 0.3], col: '#fff0c0', ombre: '#fff0c0', taille: 260 }, hemi: [0xa8b8e8, 0xd9c9a8, 0.95], sun: [0xffc890, 0.75], phares: 0.5, bloom: 0.03, scan: 0.05,
        rues: [[0, 'boulevard'], [3, 'place'], [8, 'avenue'], [11, 'rue'], [13, 'ruelle'], [19, 'rue'], [24, 'avenue'], [26, 'quai'], [31, 'avenue'], [33, 'boulevard']],
        murH: 0.5, route: ['#4a4a52', '#56565e', '#e8e4d8', '#e8e4d8', '#8a8478', '#8a8478', false], mur: ['#8a8478', '#b0a898', '#8a8478', '#6a665e'], depart: [0x1d2f6f, 0x2a7a4a, '#f4f0e0'],
        tun: { sol: ['#3a3a40', '#46464c', '#e8e4d8', '#e8e4d8', '#3a3a40', '#3a3a40'], murs: ['#dfeeff', '#dfeeff'], paroi: ['#b8b4a8', '#d8d4c8', '#8a867a', '#5a564e'], plafond: ['#3a3830', '#ffe9a0', '#ffe9a0', '#5a564e'], carreaux: 1,
          fog: 0x40382a, portail: 0x5d6b82, neons: [0xdfeeff, 0xdfeeff], coque: 14 }, // néon blanc froid, parois carrelées
        hud: { y: '#ffffff', c: '#ffd05a', r: '#ff6a5a', fond: 'rgba(24,44,110,.92)', style: 'plaque', split: 0, jp: null, sur: [null, 'PARIS · 5 H 30'], titre: ['PREMIER', 'METRO'] } } },

    // Canal de Los Angeles à l'heure dorée : béton mouillé, large, la carte de la glisse. Fresques fléchées et balises à l'extérieur des courbes.
    { id: 'canal', nom: 'CANAL 6', rivaux: ['DRE', 'ROSA', 'CAL'], W: 14, grip: 15, sc: 1, tun: null, chaud: [1, 8], amb: [[12, 17]], sect: [7, 19], anticipe: 1,
      pts: [[0, 0, -8], [250, -80, -8], [500, 90, -8], [750, -80, -8], [1000, 90, -8], [1250, -80, -8], [1500, 60, -8], [1720, 40, -8], [1825, 123, -5], [1828, 168, -3], [1803, 206, -1], [1760, 220, 2], [1500, 230, 4], [1300, 290, 4], [1100, 220, 4], [900, 290, 4], [700, 220, 4], [500, 290, 4], [300, 220, 4], [50, 240, 4], [-170, 230, 2], [-256, 156, -1], [-270, 110, -3], [-256, 64, -5], [-170, -10, -8]],
      // Dodge Viper GTS (1996) : V10 de 8,0 L, 450 ch à 5200 tr/min, 664 N·m à 3700, 1535 kg, propulsion, boîte T56 (rapports à vérifier sur fiche)
      car: car({ nom: 'DODGE VIPER GTS', ratios: [2.66, 1.78, 1.30, 1.00, 0.74, 0.50], final: 3.07, wheel: 0.333, mass: 1610, idle: 800, red: 6000, cd: 0.35, area: 1.9,
        tq: [0, 420, 560, 640, 664, 625, 540, 400, 0], son: 0.8, look: { col: 0x1848c8, l: 1.03, w: 1.05, h: 0.88, nez: 0.7, cab: [-0.95, 1.7, 0.46], aileron: 0, bandes: 0xf4f0e0 } }),
      radio: RADIO.canal,
      th: { decor: 'canal', fog: 0xe89060, fogD: [160, 1700], sky: [[0, '#3d2a5c'], [0.24, '#3d2a5c'], [0.25, '#7a4078'], [0.36, '#7a4078'], [0.37, '#d85a50'], [0.44, '#d85a50'], [0.45, '#ff9a4a'], [0.49, '#ff9a4a'], [0.5, '#e89060'], [1, '#e89060']], stars: 0,
        astre: { dir: [-0.85, 0.11, 0.35], col: '#fff4c0', ombre: '#fff4c0', taille: 340 }, hemi: [0xb898c8, 0xb8ad9a, 0.85], sun: [0xffa860, 0.9], phares: 0.4, bloom: 0.03, scan: 0.05,
        murH: 1.3, route: ['#7a7066', '#867c70', '#f4f0e0', '#2aa39a', '#e83f8c', '#f4f0e0', 2], mur: ['#2a2030', '#f4f0e0', '#e83f8c', '#1a1420'], depart: [0xff7a3d, 0x3d2a5c, '#f4f0e0'],
        hud: { y: '#ffc04a', c: '#ff7a3d', r: '#e83f8c', fond: 'rgba(40,24,56,.9)', style: 'bloc', split: 0, jp: null, sur: [null, 'LOS ANGELES · HEURE DOREE'], titre: ['CANAL', 'SIX'] } } },
  ];
  let id = 'ville';
  if (typeof location !== 'undefined') try { id = new URLSearchParams(location.search).get('carte') || localStorage.getItem('vpr.carte') || id; } catch (e) { }
  G.CARTE = G.CARTE || G.CARTES.find(m => m.id === id) || G.CARTES[0];
})(typeof window !== 'undefined' ? window : globalThis);
