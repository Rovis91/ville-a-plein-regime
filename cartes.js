// Les cartes du jeu : une carte = un tracé + une voiture + une radio + un thème (décor, lumière, interface). Aucun rendu ici.
// Chargé avant sim.js (navigateur) ou par lui (node). La carte active est choisie une fois, au chargement : ?carte=<id>, sinon la dernière jouée.
// Changer de carte recharge la page : le décor n'est construit qu'une fois, comme avant.
//
// Champs d'une carte :
//   W demi-largeur de route (m) · large [[a, b, w], …] demi-largeur w entre les points a et b (place) · place { c: [x, z], r, a, piles } cercle où l'on roule partout, avec les piles d'un monument (boîtes [x, z, demi-largeurs] dans son repère tourné de a) · grip adhérence latérale maxi (m/s²) · sc échelle du tracé · pts [x, z, altitude], sens horaire, départ en [0]
//   camH hauteur de la caméra (m, 3,2 par défaut : à relever quand la voiture masque la route) · tun [a, b] tunnel entre deux points (ou null) · chaud [a, b] secteur où la musique se déchaîne · amb [[a, b], …] zones où l'on entend l'ambiance du lieu · sect [a, b] les deux temps intermédiaires
//   sauts [[point, longueur, hauteur, fosse, profondeur], …] tremplin qui finit net au point, suivi ou non d'une fosse (m) · cuv [[a, b, largeur, rayon], …] murs roulables : un quart de tube de chaque côté du plat entre les points a et b. L'un ou l'autre active le relief (hauteur, gravité, vol : voir sim.js) ; th.paroi = texture des murs roulables
//   anticipe : le pilote automatique calcule sa distance de freinage (indispensable dès qu'il y a une épingle)
//   rivaux : prénoms des trois adversaires du mode course (sinon ceux de la ville) · med : médailles [bronze, argent, or] en multiples du tour lancé du pilote automatique (défaut 1,1 / 1,03 / 0,97 ; plus bas là où la glisse rapporte beaucoup) · trafic : nombre de camions à doubler · car : la voiture (format CARD de sim.js) · radio : stations (voir RADIO plus bas) · th : thème
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
  //   lO transposition du thème, lV son niveau · drive de 0 à 1 ·
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
      st({ name: 'NIGHT CITY FM', fq: '98.7', vol: 0.41, genre: 'DARKSYNTH', bpm: 128, gamme: 'mineur', emprunts: 'Bb E', key: 57, kit: 'dur', eq: [2, 2500, 0, 10], rev: 0.25, pump: 0.3, // façon Carpenter Brut / Perturbator : boîte des années 80, basse saturée, chœur sombre, thème hurlant
        prog: ['Am Am F G Am Am Bb E', 'F G Dm E'], k: [F4, 'x...x...x.x.x...'], s: [SN], h: ['..x...x...x...x.', 'xxXxxxXxxxXxxxXx'],
        b: ['bDark', '0 - 0 0 - - 12 0 - - 0 3 0 - -2 1 | 0 - 0 0 - - 12 0 - 0 7 - 6 - 5 3', '0 0 0 0 0 0 0 0 0 0 0 0 0 0 12 0'], d: ['choir', 0], c: ['brass', 'x..x..x....x....'], a: ['pulseArp', '0121201245656456', '0.2.4.2.0.2.4.6.'],
        l: ['ldSync', '19 - - 19 - . 17 - 19 - - - 22 - - - | 19 - - - - - . - 15 - 17 - 15 - - - | 20 - - 20 - . 19 - 20 - - - 24 - - - | 22 - - - - - . - 17 - 19 - 17 - - - | 19 - - 19 - . 17 - 19 - - - 22 - - - | 19 - - - - - . - 15 - 17 - 15 - - - | 20 - - 20 - . 17 - 20 - - - 25 - - - | 23 - - - - - - - 26 - - - - - - -',
          '20 - - - 24 - - - 27 - 24 - 20 - - - | 22 - - - 26 - - - 29 - 26 - 22 - - - | 29 - - 27 - - 24 - 20 - - - 24 - - - | 23 - - - 26 - - - 31 - - - - - - -'],
        sec: { i: 'h0 d a1 lo', a: 'k0 s0 h1 b0 d a1', b: 'k0 s0 h1 b0 d a0', c: 'k1 s0 h1 b0 d a0 c0 l0', x: 'd a1 l1 P1', u: 'k0 h1 b1 d roll P1', e: 'k1 s0 h1 b1 c0 l1 P1' }, form: 'iabcxuceabcc' }),
      st({ name: 'USINE 130', fq: '130.0', vol: 0.85, genre: 'TECHNO INDUSTRIELLE', bpm: 130, gamme: 'mineur', hors: [1], sw: 0.1, key: 57, kit: 'ind', eq: [-16, 1300, 10, -4], rev: 0.3, pump: 0.5, drive: 1, // ni accords ni mélodie : grosse caisse saturée, bruit, toms, séquence sur une note ; montées sans grosse caisse, puis le drop
        prog: ['Am'], k: [F4, 'x...x...x...x.x.', 'x..x..x.x..x..x.'], s: [SN, '....x..x....x.xx'], h: ['..X...X...X...X.', 'x.X.x.X.x.X.xxXx'], p: ['3..1..3...1..3..'],
        b: ['bDist', '. . 0 - . . 0 - . . 0 - . . 0 1', '0 - . 0 - . 0 - . 0 - . 0 - 1 0'], a: ['seqArp', '0..0..0.0..0.0..', '0.0.0.0.0.0.0.0.'],
        sec: { i: 'k0 h0', a: 'k0 s0 h0 b0', b: 'k1 s0 h1 b0 a0', c: 'k1 s1 h1 b1 a0 p0', x: 'h0 a1 lo', u: 'h1 a1 roll lo', e: 'k2 s1 h1 b1 a1 p0' }, form: 'iabucbxuceuc' }),
      st({ name: 'KAIZO BREAKS', fq: '87.5', vol: 1, genre: 'BIG BEAT', bpm: 132, gamme: 'mineur', key: 64, kit: 'brk', eq: [-6, 1800, 4, 8], rev: 0.22, echo: [2, 0.3], pump: 0.5, // façon Prodigy / Chemical Brothers : breakbeat sali, basse acide, guitare saturée plaquée, sirène
        prog: ['Em Em Em G Em Em Am Bm', 'Em G Am Bm'], k: ['x..x......x.....', 'x..x...x..x..x..', 'x.....x...x..x..'], s: ['....x..g.g..x..g', '....x.......x.gg'], h: ['x.x.x.x.x.x.x.o.', 'x.xxx.x.x.xxx.o.'], p: ['t.t.t.t.t.t.t.t.'],
        b: ['bAcid', '0 - 0 12 - 0 - 3 0 - 12 0 - 7 - 10', '0 0 - 12 0 - 15 - 12 - 10 - 7 - 3 -'], c: ['pwr', 'x.....x.........', 'x..x..x...x.x...'], cO: -12, a: ['seqArp', '0.0.2.0.3.0.2.0.'],
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
      st({ name: 'GRAND PRIX FM', fq: '86.2', lO: -12, lV: 0.7, vol: 1.1, genre: 'FUSION JAZZ-ROCK', bpm: 136, cv: 1.2, gamme: 'majeur', emprunts: 'B7', key: 62, kit: 'acou', eq: [-8, 1100, 9, -3], rev: 0.25, pump: 1, // façon T-Square / Casiopea : batterie jouée avec ride et toms, basse claquée, piano électrique, solo à vent
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
      st({ name: 'SATURATION', fq: '107.7', vol: 0.46, genre: 'ELECTRO SATUREE', bpm: 128, cv: 1.4, gamme: 'mineur', sw: 0.08, key: 64, kit: 'dur', eq: [-14, 2200, 10, 4], rev: 0.1, pump: 0.2, drive: 0.5, // façon Justice / Ed Banger : tout le bus écrêté, basse hachée, cordes coupées net, riff de guitare saturée
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
      st({ name: 'K-LOW', fq: '94.0', vol: 0.46, genre: 'G-FUNK', bpm: 104, cv: 1.25, gamme: 'mineur', emprunts: 'D7', sw: 0.1, key: 55, kit: 'k808', sMin: 0.45, eq: [7, 450, -4, 3], rev: 0.2, echo: [3, 0.35], pump: 0.9, // façon Dr. Dre / Warren G : posé, TR-808, caisse claire en avant, basse ronde qui glisse, sifflement de synthé à portamento
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
    barrage: [
      st({ name: 'RADIO SOMMET', fq: '101.5', vol: 1, genre: 'ITALO DISCO', bpm: 122, gamme: 'mineur', key: 57, kit: 'lin', eq: [-6, 2500, 3, 8], rev: 0.3, echo: [3, 0.4], pump: 0.4, // boîte à rythmes sèche, basse à l'octave, arpège, thème en dents de scie : la descente en télécabine
        prog: ['Am F C G Am F Dm Em', 'F G Am Am'], k: [F4], s: [CP], h: [OFF, 'x.o.x.o.x.o.x.o.'],
        b: ['bSeq', '0 - 12 - 0 - 12 - 0 - 12 - 0 - 12 -', '0 0 12 0 0 12 0 12 0 0 12 0 7 12 0 12'], d: ['strings', 0], c: ['super', 'x..x..x.x..x..x.'], a: ['pulseArp', '0121201245656456', '0.2.4.2.0.2.4.6.'],
        l: ['ldSaw', '12 - - 15 - - 19 - 17 - 15 - 12 - - - | 20 - - 17 - - 15 - 17 - - - . - - - | 15 - - 19 - - 22 - 19 - 15 - 19 - - - | 14 - - 17 - - 22 - 19 - - - . - - - | 24 - - 27 - - 31 - 29 - 27 - 24 - - - | 32 - - 29 - - 27 - 29 - - - . - - - | 29 - - 26 - - 29 - 32 - 29 - 26 - - - | 31 - - - 26 - - - 22 - - - 19 - - -',
          '20 - - - 24 - - - 27 - - - 24 - - - | 22 - - - 26 - - - 29 - - - 26 - - - | 24 - - 27 - - 31 - 29 - 27 - 24 - - - | 24 - - - - - - - . - - - - - - -'],
        sec: { i: 'h0 a0 d lo', a: 'k0 s0 h0 b0 d', b: 'k0 s0 h1 b0 d a0', c: 'k0 s0 h1 b1 d a0 c0 l0', x: 'd a1 l1 P1', u: 'k0 h1 b0 d roll P1', e: 'k0 s0 h1 b1 c0 l1 P1' }, form: 'iabcxuceabcc' }),
      st({ name: 'RADIO TORRENT', fq: '96.6', vol: 0.5, genre: 'SURF ROCK', bpm: 164, gamme: 'mineur', key: 52, kit: 'rock', eq: [-4, 1400, 6, 2], rev: 0.4, pump: 1, // guitare à trémolo noyée de réverbération, cocotte en doubles-croches, batterie rock : aucun synthé
        prog: ['Em D C D Em D Am Bm', 'C D Em Em'], k: ['x.....x.x.....x.', 'x..x..x.x..x..x.'], s: [SN, '....x.......x.xx'], h: ['r.r.r.r.r.r.r.r.', 'X.X.X.X.X.X.X.o.'], p: ['t.t.t.t.t.t.t.t.'],
        b: ['bPick', '0 - 0 - 7 - 0 - 0 - 0 - 7 - 10 -', '0 0 0 0 0 0 0 0 0 0 0 0 7 7 10 10'], g: ['gtrMute', 'xxxxxxxxxxxxxxxx', 'x.xxx.xxx.xxx.xx'], c: ['pwr', 'x.....x.....x...'], cO: -12,
        l: ['ldGtr', '12 - 12 - 15 - 14 - 12 - 10 - 12 - - - | 14 - 14 - 17 - 15 - 14 - 10 - 14 - - - | 15 - 15 - 19 - 17 - 15 - 12 - 15 - - - | 14 - - - 17 - - - 22 - - - 19 - - - | 24 - 24 - 27 - 26 - 24 - 22 - 24 - - - | 26 - 26 - 29 - 27 - 26 - 22 - 26 - - - | 24 - 27 - 29 - 27 - 24 - 20 - 24 - - - | 26 - - - 22 - - - 19 - - - 14 - - -',
          '27 - - 24 - - 20 - 24 - - - 27 - - - | 29 - - 26 - - 22 - 26 - - - 29 - - - | 31 - - 27 - - 24 - 27 - 31 - 34 - - - | 36 - - - - - - - . - - - - - - -'],
        sec: { i: 'g0 h0', a: 'k0 s0 h0 b0 g0', b: 'k0 s0 h1 b0 g0 c0', c: 'k1 s1 h1 b0 g1 c0 l0', x: 'h0 b1 g0 l1 P1', e: 'k1 s1 h1 b1 c0 l1 P1 p0', q: 'k0 s0 h0 b1 g1 p0' }, form: 'iabcqxecabcc' }),
      st({ name: 'ALTITUDE 303', fq: '303', vol: 0.9, genre: 'ACID HOUSE', bpm: 124, gamme: 'mineur', sw: 0.08, key: 60, kit: 'k909', eq: [4, 900, 4, 2], rev: 0.2, echo: [3, 0.45], pump: 0.4, sweep: 1, // une ligne de basse acide qui tourne sur elle-même, le filtre fait le reste ; cloche et accords plaqués à écho
        prog: ['Cm7 Cm7 Fm7 Fm7 Cm7 Cm7 AbM7 Gm7', 'AbM7 Bb Cm7 Cm7'], k: [F4, 'x...x...x...x.x.'], s: [CP, '....c.......c.cc'], h: [OFF, 'x.o.x.oxx.o.x.ox'], p: ['c..c..c..c..c.c.'],
        b: ['bAcid', '0 - 0 12 - 0 3 - 0 - 12 0 - 10 - 7', '0 0 12 0 0 12 0 3 0 0 12 0 10 12 7 0'], d: ['warm', 0], c: ['stabM7', 'x..x...x..x.....', '..x...x...x...x.'], a: ['seqArp', '0.0.2.0.3.0.2.0.', '0120012001200120'],
        l: ['ldTri', '24 - - - - - 22 - 19 - - - - - - - | 24 - - - - - 27 - 26 - - - 22 - - - | 20 - - - - - 24 - 27 - - - - - - - | 26 - - - 22 - - - 19 - - - 17 - - -',
          '27 - - - 24 - - - 31 - - - 27 - - - | 29 - - - 26 - - - 34 - - - 29 - - - | 31 - - - - - 27 - 24 - - - - - - - | 24 - - - - - - - . - - - - - - -'],
        sec: { i: 'k0 h0 b0 lo', a: 'k0 s0 h0 b0 a0', b: 'k0 s0 h1 b0 a0 c0', c: 'k1 s1 h1 b1 a1 c0 d l0 p0', x: 'd a0 c1 l1 P1', u: 'k0 h1 b1 a1 roll P1', e: 'k1 s1 h1 b1 c1 d l1 P1 p0' }, form: 'iabcbxucecbc' }),
    ],
    stade: [
      st({ name: 'ARENA ROCK FM', fq: '105.5', vol: 0.4, genre: 'HARD ROCK', bpm: 140, gamme: 'mineur', bPar: [0, 3, 5, 7, 10, -2], key: 52, kit: 'rock', eq: [-4, 1200, 7, 3], rev: 0.35, pump: 1, // rock de stade : accords de puissance, batterie dans sa salle, solo de guitare qui monte ; aucun synthé
        prog: ['E5 E5 G5 A5 E5 E5 C5 D5', 'C5 D5 E5 E5'], k: ['x.....x.x.....x.', 'x..x..x.x..x..x.', 'x...x...x...x...'], s: [SN, '....x.......x.xx'], h: ['X.x.X.x.X.x.X.x.', 'o.o.o.o.o.o.o.o.', 'r.r.r.r.r.r.r.r.'],
        b: ['bPick', '0 - 0 - 0 - 0 - 0 - 0 - 0 - 3 5', '0 0 0 0 0 0 0 0 0 0 0 0 7 7 10 10'], c: ['pwr', 'x..x..x...x.x...', 'x.......x.......'], cO: -12, g: ['gtrMute', 'xxxxxxxxxxxxxxxx'],
        l: ['ldGtr', '24 - - - 27 - 24 - 22 - 24 - - - . - | 24 - - - 27 - 29 - 31 - - - 27 - - - | 22 - - - 26 - 22 - 19 - 22 - - - . - | 22 - - - 24 - 29 - 34 - - - 31 - - - | 36 - - - 34 - 31 - 34 - 36 - - - . - | 36 - - - 39 - 36 - 34 - - - 31 - - - | 31 - - - 36 - 31 - 27 - 31 - - - . - | 34 - - - 31 - - - 26 - - - - - - -',
          '31 - 27 - 24 - 27 - 31 - 36 - 31 - - - | 34 - 29 - 26 - 29 - 34 - 38 - 34 - - - | 36 - - 31 - - 27 - 31 - - - 36 - - - | 36 - - - - - - - . - - - - - - -'],
        sec: { i: 'g0 h0', a: 'k0 s0 h0 b0 g0', b: 'k0 s0 h1 b0 c0', c: 'k1 s1 h1 b0 c0 l0', x: 'h2 b1 g0 l1 P1', e: 'k1 s1 h1 b1 c0 l1 P1', q: 'k2 s0 h2 b1 c1' }, form: 'iabcqxecabcc' }),
      st({ name: 'TRIBUNE NORD', fq: '91.9', vol: 0.9, genre: 'FANFARE FUNK', bpm: 108, gamme: 'mineur', emprunts: 'D', sw: 0.12, key: 55, kit: 'acou', eq: [3, 900, 5, 0], rev: 0.3, pump: 1, // l'orgue de la patinoire et la fanfare des supporters : orgue, cuivres plaqués, clavinet, cloche et tambourin
        prog: ['Gm Gm Cm D Gm Gm Eb D', 'Cm D Gm Gm'], k: ['x..x..x...x..x..', 'x.....x..xx.....'], s: ['....x..g.g..x..g', '....x..g....x.xx'], h: ['x.x.x.x.x.x.x.o.', 'b.x.x.b.x.x.b.x.'], p: ['t.t.t.t.t.t.t.t.', 'c..c..c..c..c.c.'],
        b: ['bSlap', '0 - - 0 - 12 - 0 - - 7 - 12 - 0 - | 0 - - 0 - 12 - 0 - 12 - 7 - 12 - 7', '0 - - - - - 0 - - - 12 - - - 7 -'], d: ['organ', 0], c: ['brass', 'x..x....x.x.....', 'x.......x..x..x.'], g: ['clav', '..x..x.x..x..x.x'],
        l: ['organ', '19 - - 22 - - 19 - 17 - 19 - - - . - | 19 - - 22 - - 24 - 26 - - - 22 - - - | 24 - - 27 - - 24 - 22 - 24 - - - . - | 26 - - 23 - - 19 - 14 - - - 19 - - - | 31 - - 34 - - 31 - 29 - 31 - - - . - | 31 - - 29 - - 26 - 22 - - - 26 - - - | 27 - - 31 - - 27 - 26 - 27 - - - . - | 31 - - 26 - - 23 - 19 - - - - - - -',
          '24 - 27 - 31 - 27 - 24 - 27 - 31 - - - | 26 - 31 - 35 - 31 - 26 - 31 - 35 - - - | 31 - - 26 - - 22 - 26 - - - 31 - - - | 34 - - - - - - - . - - - - - - -'],
        sec: { i: 'h1 d p0', a: 'k0 s0 h0 b1 g0', b: 'k0 s0 h0 b0 g0 d', c: 'k1 s1 h1 b0 c0 d l0 p0', x: 'd c1 l1 P1 p1', e: 'k1 s1 h1 b0 c1 g0 l1 P1 p0' }, form: 'iabccxecabcc' }),
      st({ name: 'KOP 170', fq: '170', vol: 1.2, genre: 'HAPPY HARDCORE', bpm: 170, gamme: 'majeur', key: 60, kit: 'k909', eq: [-8, 3200, 5, 10], rev: 0.25, echo: [3, 0.35], pump: 0.3, // grosse caisse à tous les temps, basse à contretemps, piano plaqué, thème majeur que tout le virage reprend
        prog: ['C G Am F C G F G', 'F G Am Am'], k: [F4], s: [CP, '....c.......c.cc'], h: [OFF, 'x.o.x.o.x.o.x.o.'],
        b: ['bOff', '. . 0 - . . 0 - . . 0 - . . 0 -', '. 0 0 0 . 0 0 0 . 0 0 0 . 0 0 0'], d: ['super', 0], c: ['dxEp', 'x..x..x.x..x..x.', 'x.......x.......'], a: ['pluck', '0124210201242102', '0.2.4.2.1.2.4.2.'],
        l: ['ldVox', '28 - - - 31 - 28 - 24 - - - 28 - - - | 26 - - - 31 - 26 - 23 - - - 26 - - - | 24 - - - 28 - 24 - 21 - - - 24 - - - | 24 - - - 29 - 24 - 21 - - - . - - - | 28 - - - 31 - 36 - 31 - - - 28 - - - | 26 - - - 31 - 35 - 31 - - - 26 - - - | 29 - - - 33 - 29 - 24 - - - 29 - - - | 31 - - - 35 - - - 38 - - - - - - -',
          '29 - - - 33 - - - 36 - - - 33 - - - | 31 - - - 35 - - - 38 - - - 35 - - - | 33 - - 36 - - 40 - 36 - 33 - 36 - - - | 33 - - - - - - - . - - - - - - -'],
        sec: { i: 'd a1 lo', a: 'k0 h0 b0 d', b: 'k0 s0 h1 b0 d a0', c: 'k0 s1 h1 b1 d c0 l0', x: 'd a1 l1 P1', u: 'k0 h1 b0 d roll P1', e: 'k0 s1 h1 b1 c1 l1 P1' }, form: 'iabcxucceabc' }),
    ],
    givre: [
      st({ name: 'RADIO VERGLAS', fq: '88.1', vol: 0.9, genre: 'COLD WAVE', bpm: 132, gamme: 'mineur', key: 57, kit: 'lin', eq: [-4, 2200, 3, 6], rev: 0.4, echo: [3, 0.35], pump: 0.9, // boîte à rythmes sèche, basse au médiator qui porte le morceau, guitare claire arpégée, chœur froid : la montée du col, phares allumés
        prog: ['Am F C Em Am F Dm Em', 'F G Am Am'], k: ['x.....x.x.....x.', 'x...x...x...x...'], s: [SN, '....x.......x.xx'], h: ['x.x.x.x.x.x.x.x.', 'xxXxxxXxxxXxxxXx'],
        b: ['bPick', '0 - 0 - 0 - 0 - 0 - 0 - 7 - 0 -', '0 0 0 0 0 0 0 0 0 0 0 0 7 7 12 12'], d: ['choir', 0], a: ['pluck', '0.2.4.2.1.2.4.2.', '0124210201242102'],
        l: ['ldTri', '12 - - - 15 - - - 19 - - - 15 - - - | 17 - - - 20 - - - 24 - - - 20 - - - | 19 - - - 15 - - - 12 - - - 15 - - - | 19 - - - - - - - 22 - - - 19 - - - | 24 - - - 22 - - - 19 - - - 15 - - - | 20 - - - 17 - - - 24 - - - 20 - - - | 22 - - - 20 - - - 17 - - - 14 - - - | 19 - - - - - - - . - - - - - - -',
          '24 - 27 - 31 - 27 - 24 - 27 - 31 - - - | 20 - 24 - 29 - 24 - 20 - 24 - 29 - - - | 27 - - - 24 - - - 22 - - - 19 - - - | 24 - - - - - - - . - - - - - - -'],
        sec: { i: 'b0 a0 lo', a: 'k0 s0 h0 b0 a0', b: 'k0 s0 h0 b0 a0 d', c: 'k1 s0 h1 b1 a1 d l0', x: 'd a0 l1 P1', u: 'k1 h1 b1 d roll P1', e: 'k1 s1 h1 b1 a1 l1 P1' }, form: 'iabcxuceabcc' }),
      st({ name: 'POLAIRE 118', fq: '118', vol: 1.2, genre: 'DUB TECHNO', bpm: 118, gamme: 'mineur', sw: 0.06, key: 62, kit: 'k909', eq: [5, 700, -3, -4], rev: 0.45, echo: [3, 0.6], pump: 0.5, // un accord mineur plaqué que l'écho répète jusqu'à s'éteindre, basse ronde, shaker : pas de thème, la route déserte avant le jour
        prog: ['Dm7 Dm7 Gm7 Gm7 Dm7 Dm7 BbM7 Am7', 'Gm7 Am7 Dm7 Dm7'], k: [F4, 'x...x...x...x..x'], s: ['....r.......r...', CP], h: [OFF, 'x.oxx.oxx.oxx.ox'], p: ['m.m.m.m.m.m.m.m.', '...v..v...v..v..'],
        b: ['bSeq', '0 - - - - - 0 - - - 0 - - - 7 -', '0 - - 0 - - 0 - - 0 - - 12 - 7 -'], d: ['warm', 0], c: ['stabM7', 'x.....x.........', '..x...x...x...x.'], a: ['bell', '....4.......5...', '0...2...4...2...'],
        sec: { i: 'k0 c0 lo', a: 'k0 h0 b0 c0', b: 'k0 s0 h0 b0 c0 d', c: 'k1 s0 h1 b1 c1 d a0 p0', x: 'd c0 a1 P1', u: 'k0 h1 b0 c1 roll P1', e: 'k1 s1 h1 b1 c1 d a1 p1 P1' }, form: 'iabcbxucecbc' }),
      st({ name: 'REFUGE FM', fq: '94.4', vol: 1, genre: 'SYNTH-POP', bpm: 120, gamme: 'majeur', key: 60, kit: 'lin', eq: [2, 1800, 2, 6], rev: 0.3, echo: [3, 0.3], pump: 0.7, // majeur et chaud : basse ronde, piano électrique, cordes, refrain en dents de scie ; le poêle du refuge, en haut du col
        prog: ['C G Am F C G F G', 'F G Em Am'], k: [F4, 'x...x...x..xx...'], s: [SN, CP], h: [OFF, 'x.x.x.x.x.x.x.o.'], p: ['t.t.t.t.t.t.t.t.'],
        b: ['bMoog', '0 - 0 - 12 - 0 - 0 - 0 - 12 - 7 -', '0 0 12 0 0 12 0 12 0 0 12 0 7 12 0 12'], d: ['strings', 0], c: ['dxEp', '..x...x..x....x.', 'x.......x.......'], a: ['pulseArp', '0.2.4.2.0.2.4.6.', '0121201245656456'],
        l: ['ldSaw', '16 - - - 19 - - - 24 - - - 19 - - - | 14 - - - 19 - - - 23 - - - 19 - - - | 12 - - - 16 - - - 21 - - - 16 - - - | 17 - - - 21 - - - 24 - - - - - - - | 28 - - - 24 - - - 19 - - - 16 - - - | 26 - - - 23 - - - 19 - - - 14 - - - | 21 - - - 24 - - - 29 - - - 24 - - - | 26 - - - - - - - 31 - - - - - - -',
          '24 - 28 - 31 - 28 - 24 - 28 - 31 - - - | 26 - 31 - 35 - 31 - 26 - 31 - 35 - - - | 28 - - - 24 - - - 19 - - - 24 - - - | 24 - - - - - - - . - - - - - - -'],
        sec: { i: 'h0 d a0 lo', a: 'k0 s0 h0 b0 c0', b: 'k0 s0 h1 b0 c0 d', c: 'k1 s1 h1 b1 c0 d a1 l0 p0', x: 'd c1 a0 l1 P1', u: 'k0 h1 b0 d roll P1', e: 'k1 s1 h1 b1 c1 l1 P1 p0' }, form: 'iabcxuceabcc' }),
    ],
    terre: [
      st({ name: 'RADIO CAILLOU', fq: '88.8', vol: 0.45, genre: 'PUNK ROCK', bpm: 176, gamme: 'majeur', key: 57, kit: 'rock', eq: [-4, 1500, 6, 3], rev: 0.2, pump: 1, // trois accords de puissance en majeur, tout droit, batterie à fond : la radio de l'assistance
        prog: ['A5 A5 D5 E5 A5 F#5 D5 E5', 'D5 E5 F#5 E5'], k: ['x.....x.x.....x.', 'x..x..x.x..x..x.', 'x.x.x.x.x.x.x.x.'], s: [SN, '....x.......x.xx'], h: ['X.X.X.X.X.X.X.o.', 'r.r.r.r.r.r.r.r.'],
        b: ['bPick', '0 0 0 0 0 0 0 0 0 0 0 0 0 0 7 7', '0 - 0 - 0 - 0 - 0 - 0 - 7 - 12 -'], c: ['pwr', 'x.x.x.x.x.x.x.x.', 'x.....x.....x...'], cO: -12, g: ['gtrMute', 'x.xxx.xxx.xxx.xx'],
        l: ['ldGtr', '28 - 28 - 26 - 24 - 26 - 28 - 31 - - - | 29 - 29 - 28 - 26 - 28 - - - 24 - - - | 28 - 28 - 26 - 24 - 26 - 28 - 33 - - - | 31 - - - 28 - - - 26 - - - . - - -',
          '36 - 35 - 33 - 31 - 33 - - - 31 - - - | 33 - 31 - 29 - 28 - 29 - - - 28 - - - | 31 - 33 - 35 - 36 - 38 - - - 36 - - - | 40 - - - - - - - . - - - - - - -'],
        sec: { i: 'g0 h0', a: 'k0 s0 h0 b0 g0', b: 'k1 s0 h0 b0 c1', c: 'k2 s1 h0 b0 c0 l0', x: 'h1 b1 g0 l1 P1', e: 'k2 s1 h0 b1 c0 l1 P1', q: 'k1 s0 h1 b1 c1' }, form: 'iabcqxecabcc' }),
      st({ name: 'SKA DES PINS', fq: '93.3', vol: 0.9, genre: 'SKA', bpm: 150, gamme: 'mineur', key: 62, kit: 'acou', eq: [2, 1000, 5, 1], rev: 0.25, pump: 1, // guitare à contretemps, orgue, riff de cuivres et saxophone : le bal du village un soir de rallye
        prog: ['Dm Gm C F Dm Gm Bb C', 'Bb C Dm Dm'], k: ['x.......x.......', 'x.....x.x.....x.'], s: [SN, '....x..g....x.xx'], h: [OFF, 'x.x.x.x.x.x.x.o.'], p: ['t.t.t.t.t.t.t.t.', '..h..l.h..h.l.l.'],
        b: ['bSlap', '0 - - 0 - - 7 - 0 - - 0 - 7 12 -', '0 - 0 - 7 - 7 - 12 - 12 - 7 - 7 -'], d: ['organ', 0], c: ['gtrMute', '..x...x...x...x.', '..xx..xx..xx..xx'], g: ['brass', 'x.......x..x....', 'x..x....x.x.....'],
        l: ['ldSax', '24 - . 24 - . 27 - 26 - 24 - 22 - - - | 22 - . 22 - . 26 - 24 - 22 - 19 - - - | 19 - . 22 - . 24 - 26 - - - 24 - - - | 24 - - - 20 - - - 17 - - - . - - - | 24 - . 24 - . 27 - 29 - 27 - 26 - - - | 26 - . 26 - . 29 - 31 - 29 - 26 - - - | 29 - . 27 - . 26 - 24 - - - 22 - - - | 24 - - - 26 - - - 24 - - - - - - -',
          '29 - - 27 - - 24 - 27 - - - 29 - - - | 31 - - 29 - - 26 - 29 - - - 31 - - - | 34 - - 31 - - 29 - 26 - - - 29 - - - | 26 - - - - - - - . - - - - - - -'],
        sec: { i: 'h0 c0 d', a: 'k0 s0 h0 b0 c0', b: 'k0 s0 h0 b1 c0 d p0', c: 'k1 s1 h1 b0 c1 g0 l0 p0', x: 'd c0 l1 P1 p1', e: 'k1 s1 h1 b1 c1 g1 l1 P1 p0' }, form: 'iabccxecabcc' }),
      st({ name: 'DUNE 145', fq: '145', vol: 1.2, genre: 'PSYTRANCE', bpm: 145, gamme: 'mineur', hors: [1], key: 64, kit: 'k909', eq: [-6, 2600, 4, 8], rev: 0.3, echo: [3, 0.4], pump: 0.3, // grosse caisse à tous les temps, basse au galop sur une note, séquence qui frotte la seconde mineure : la fête dans la carrière
        prog: ['Em Em Em Em Em Em C D', 'C D Em Em'], k: [F4, 'x...x...x...x.x.'], s: [CP, '....c.......c.cc'], h: [OFF, 'xxoxxxoxxxoxxxox'], p: ['..1...2...3.....'],
        b: ['bOff', '. 0 0 0 . 0 0 0 . 0 0 0 . 0 0 0', '. 0 0 12 . 0 0 12 . 0 0 12 . 0 12 0'], d: ['choir', 0], a: ['seqArp', '0.0.2.0.3.0.2.0.', '0120012001200120'],
        l: ['ldSync', '12 - 13 - 12 - 15 - 12 - 13 - 12 - 10 - | 12 - 13 - 12 - 15 - 17 - 15 - 13 - 12 - | 19 - 20 - 19 - 22 - 19 - 20 - 19 - 17 - | 15 - 17 - 19 - 22 - 24 - - - . - - -',
          '24 - - - 25 - - - 24 - - - 22 - - - | 24 - - - 27 - - - 25 - - - 24 - - - | 31 - - - 29 - - - 27 - - - 25 - - - | 24 - - - - - - - . - - - - - - -'],
        sec: { i: 'k0 b0 lo', a: 'k0 h0 b0 a0', b: 'k0 s0 h1 b0 a0', c: 'k1 s0 h1 b1 a1 l0', x: 'd a0 l1 P1 lo', u: 'k0 h1 b0 a1 roll P1', e: 'k1 s1 h1 b1 a0 l1 P1 p0' }, form: 'iabcxucceabc' }),
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
        pluie: 1, orage: 1, alarme: 1, chev: 1, piles: -61, tubes: 1, reflets: '#004a54', pubs: 1, murH: 1.4,
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
      th: { decor: 'wangan', pluie: [[9, 24, 3]], fog: 0x0c1424, fogD: [90, 1300], sky: [[0, '#02030a'], [0.38, '#0a1024'], [0.47, '#4a2c18'], [0.5, '#0c1424'], [1, '#0c1424']], stars: 40,
        astre: { dir: [0.5, 0.7, -0.4], col: '#e8e0d0', ombre: '#b8b0a0', taille: 120 }, hemi: [0x4a5a8a, 0xff9a2e, 0.55], sun: [0x8fa0d0, 0.25], phares: 2.4, bloom: 0.1, scan: 0.1,
        chev: 1, piles: -14, murH: 1.4, route: ['#24262e', '#30323c', '#f4f1e0', '#f4f1e0', '#24262e', '#24262e', false], mur: ['#3a3e46', '#c9ced6', '#ff9a2e', '#16181e'], depart: [0x1f8f5a, 0xc9ced6, '#f4f1e0'],
        tun: { sol: ['#2a2218', '#3a2e20', '#f4f1e0', '#f4f1e0', '#2a2218', '#2a2218'], murs: ['#ffb85a', '#ffb85a'], paroi: ['#3a2c18', '#6a5028', '#8a6a38', '#120e08'], plafond: ['#1a140c', '#ffb85a', '#ffb85a', '#3a2e20'],
          fog: 0x2a1a08, portail: 0x1f8f5a, neons: [0xff9a2e, 0xff9a2e], coque: 80 },
        hud: { y: '#ffffff', c: '#ffb85a', r: '#ff2a3a', fond: 'rgba(10,84,52,.92)', style: 'panneau', split: 0, jp: ['周回', '速度'], sur: ['湾岸九号線', 'LIGNE DE BAIE'], titre: ['WAN-9', 'BAYSHORE'] } } },

    // Paris à l'aube : circuit de rues, relances entre des angles, pavés.
    { id: 'paris', nom: 'PREMIER METRO', rivaux: ['LUCIE', 'MARC', 'INES'], W: 7, large: [[3, 7, 36]], place: { c: [450, 0], r: 121, a: 2.39, piles: [[-14.9, -7.6, 8, 3.8], [14.9, -7.6, 8, 3.8], [-14.9, 7.6, 8, 3.8], [14.9, 7.6, 8, 3.8]] }, grip: 19, sc: 1, tun: [27, 30], chaud: [13, 22], amb: [[3, 7], [23, 26]], sect: [12, 25], anticipe: 1,
      pts: [[0, 0, 0], [200, 0, 0], [330, 15, 0], [420, 80, 0], [480, 80, 0], [524, 42, 0], [534, -15, 0], [505, -65, 0], [430, -160, 0], [420, -300, 2], [450, -390, 4], [540, -420, 6], [700, -420, 8], [810, -435, 12], [880, -480, 19], [860, -545, 26], [800, -590, 31], [830, -660, 37], [930, -670, 42], [1020, -630, 44], [1070, -540, 38], [1040, -410, 26], [1085, -280, 14], [1060, -150, 4], [1100, 0, 0], [1090, 140, -2], [1010, 225, -4], [800, 240, -6], [600, 250, -12], [400, 250, -12], [200, 240, -6], [0, 240, -3], [-150, 225, 0], [-235, 150, 0], [-235, 60, 0], [-150, 0, 0]],
      // Renault 5 Maxi Turbo (1985, Groupe B) : 4 cylindres turbo 1,5 L, 350 ch, 905 kg, moteur central arrière, propulsion (rapports estimés)
      car: car({ nom: 'RENAULT 5 MAXI TURBO', ratios: [3.36, 2.06, 1.38, 1.06, 0.82], final: 3.89, wheel: 0.29, mass: 980, idle: 1000, red: 7500, cd: 0.40, area: 1.9,
        tq: [0, 120, 220, 330, 400, 420, 400, 370, 300], son: 1.25, look: { col: 0xf2c400, l: 0.8, w: 0.98, h: 1.12, nez: 0.3, cab: [-0.25, 2.3, 0.62], aileron: 0 } }),
      radio: RADIO.paris,
      th: { decor: 'paris', fog: 0xf0b89a, fogD: [140, 1500], sky: [[0, '#2b3a67'], [0.26, '#2b3a67'], [0.27, '#5a6a9a'], [0.38, '#5a6a9a'], [0.39, '#c08a9a'], [0.45, '#c08a9a'], [0.46, '#f0b89a'], [1, '#f0b89a']], stars: 0,
        astre: { dir: [0.8, 0.14, 0.3], col: '#fff0c0', ombre: '#fff0c0', taille: 260 }, hemi: [0xa8b8e8, 0xd9c9a8, 0.95], sun: [0xffc890, 0.75], phares: 0.5, bloom: 0.03, scan: 0.05,
        rues: [[0, 'boulevard'], [3, 'place'], [8, 'avenue'], [11, 'rue'], [13, 'ruelle'], [19, 'rue'], [24, 'avenue'], [26, 'berge'], [32, 'quai'], [33, 'boulevard']],
        murH: 0, route: ['#4a4a52', '#56565e', '#e8e4d8', '#e8e4d8', '#8a8478', '#8a8478', false], mur: ['#8a8478', '#b0a898', '#8a8478', '#6a665e'], depart: [0x1d2f6f, 0x2a7a4a, '#f4f0e0'],
        tun: { sol: ['#3a3a40', '#46464c', '#e8e4d8', '#e8e4d8', '#3a3a40', '#3a3a40'], murs: ['#dfeeff', '#dfeeff'], paroi: ['#b8b4a8', '#d8d4c8', '#8a867a', '#5a564e'], plafond: ['#3a3830', '#ffe9a0', '#ffe9a0', '#5a564e'], carreaux: 1,
          fog: 0x40382a, portail: 0x5d6b82, neons: [0xdfeeff, 0xdfeeff], coque: 14 }, // néon blanc froid, parois carrelées
        hud: { y: '#ffffff', c: '#ffd05a', r: '#ff6a5a', fond: 'rgba(24,44,110,.92)', style: 'plaque', split: 0, jp: null, sur: [null, 'PARIS · 5 H 30'], titre: ['PREMIER', 'METRO'] } } },

    // Canal 6 : grand ovale à l'américaine au couchant, la piste serpente dans le lit du canal entre deux anneaux de tribunes pleines. Large, la carte de la glisse.
    { id: 'canal', nom: 'CANAL 6', rivaux: ['DRE', 'ROSA', 'CAL'], med: [1.06, 0.98, 0.9], W: 14, grip: 15, sc: 1, tun: null, chaud: [1, 8], amb: [[12, 17]], sect: [7, 19], anticipe: 1,
      pts: [[0, 0, -8], [250, -80, -8], [500, 90, -8], [750, -80, -8], [1000, 90, -8], [1250, -80, -8], [1500, 60, -8], [1720, 40, -8], [1825, 123, -5], [1828, 168, -3], [1803, 206, -1], [1760, 220, 2], [1500, 230, 4], [1300, 290, 4], [1100, 220, 4], [900, 290, 4], [700, 220, 4], [500, 290, 4], [300, 220, 4], [50, 240, 4], [-170, 230, 2], [-256, 156, -1], [-270, 110, -3], [-256, 64, -5], [-170, -10, -8]],
      // Dodge Viper GTS (1996) : V10 de 8,0 L, 450 ch à 5200 tr/min, 664 N·m à 3700, 1535 kg, propulsion, boîte T56 (rapports à vérifier sur fiche)
      car: car({ nom: 'DODGE VIPER GTS', ratios: [2.66, 1.78, 1.30, 1.00, 0.74, 0.50], final: 3.07, wheel: 0.333, mass: 1610, idle: 800, red: 6000, cd: 0.35, area: 1.9,
        tq: [0, 420, 560, 640, 664, 625, 540, 400, 0], son: 0.8, look: { col: 0x1848c8, l: 1.03, w: 1.05, h: 0.88, nez: 0.7, cab: [-0.95, 1.7, 0.46], aileron: 0, bandes: 0xf4f0e0 } }),
      radio: RADIO.canal,
      th: { decor: 'canal', fog: 0xe89060, fogD: [160, 1700], sky: [[0, '#3d2a5c'], [0.24, '#3d2a5c'], [0.25, '#7a4078'], [0.36, '#7a4078'], [0.37, '#d85a50'], [0.44, '#d85a50'], [0.45, '#ff9a4a'], [0.49, '#ff9a4a'], [0.5, '#e89060'], [1, '#e89060']], stars: 0,
        astre: { dir: [-0.85, 0.11, 0.35], col: '#fff4c0', ombre: '#fff4c0', taille: 340 }, hemi: [0xb898c8, 0xb8ad9a, 0.85], sun: [0xffa860, 0.9], phares: 0.4, bloom: 0.03, scan: 0.05,
        murH: 1.3, route: ['#4c4a50', '#58565c', '#f4f0e0', '#2aa39a', '#e83f8c', '#f4f0e0', false], mur: ['#f4f0e0', '#e83f8c', '#1848c8', '#e4ddd0'], depart: [0xff7a3d, 0x3d2a5c, '#f4f0e0'],
        hud: { y: '#ffc04a', c: '#ff7a3d', r: '#e83f8c', fond: 'rgba(40,24,56,.9)', style: 'bloc', split: 0, jp: null, sur: [null, 'SPEEDWAY · HEURE DOREE'], titre: ['CANAL', 'SIX'] } } },

    // Roche-Sourde : la route de service d'un barrage-voûte, en plein midi. Carte du relief : tremplin de la ligne droite (réception en descente), bosse de la montée,
    // grand virage relevé sur le parement de la voûte (le mur est plus rapide que la corde), tremplin par-dessus le déversoir (trop lent, on tombe dedans et on en ressort par sa rampe), épingle et chicane du retour.
    { id: 'barrage', nom: 'ROCHE-SOURDE', rivaux: ['MAEL', 'ZOE', 'TIAGO'], med: [1.08, 1, 0.94], W: 8, grip: 20, sc: 1, tun: null, chaud: [11, 21], amb: [[10, 16]], sect: [11, 23], anticipe: 1,
      sauts: [[2, 40, 0.8], [20, 30, 1, 36, 6]], cuv: [[10, 16, 10, 9]],
      pts: [[0, 0, 10], [120, 0, 10], [220, 0, 10], [300, 0, 3], [400, 0, -4], [500, 15, -4], [585, 75, 0], [620, 170, 11], [620, 262, 19.6], [620, 285, 20.8], [620, 308, 19.8], [620, 430, 17], [609.5, 455.5, 17], [584, 466, 17], [558.5, 455.5, 17], [548, 430, 17], [548, 385, 17], [533, 345, 17], [498, 330, 17], [400, 330, 16.5], [300, 330, 16], [200, 330, 15.5], [100, 330, 15], [-80, 330, 14.5], [-115, 320, 14.5], [-130, 290, 14], [-130, 200, 12.5], [-150, 130, 11.5], [-130, 60, 11], [-115, 15, 10.2], [-80, 0, 10]],
      // voiture inventée : une petite quatre roues motrices de rallye, 4 cylindres turbo de 2 L, 340 ch, 1150 kg
      car: car({ nom: 'CORBIER R4 TURBO', ratios: [3.31, 2.13, 1.52, 1.16, 0.92], final: 4.1, wheel: 0.31, mass: 1225, idle: 1000, red: 7800, cd: 0.38, area: 2.0,
        tq: [0, 160, 260, 360, 410, 420, 400, 360, 280], trac: 10.5, rwd: 0, son: 1.2, look: { col: 0xe8482a, l: 0.86, w: 1, h: 1.08, nez: 0.4, cab: [-0.2, 2.2, 0.6], aileron: 1, bandes: 0xf4f0e0 } }),
      radio: RADIO.barrage,
      th: { decor: 'barrage', fog: 0xbfd8e8, fogD: [200, 1900], sky: [[0, '#1c4f9c'], [0.3, '#1c4f9c'], [0.31, '#3f7fc4'], [0.42, '#3f7fc4'], [0.43, '#8fbfe0'], [0.49, '#8fbfe0'], [0.5, '#bfd8e8'], [1, '#bfd8e8']], stars: 0,
        astre: { dir: [0.35, 0.8, -0.45], col: '#fffbe8', ombre: '#fffbe8', taille: 150 }, hemi: [0xbcd8ff, 0x9aa89a, 0.95], sun: [0xfff4d8, 1], phares: 0.3, bloom: 0.03, scan: 0.05,
        murH: 1.1, paroi: 'parement', route: ['#54565a', '#606266', '#f4f0e0', '#f4c020', '#e8482a', '#f4f0e0', false], mur: ['#d8d4c8', '#e8482a', '#f4c020', '#b8b4a8'], depart: [0xe8482a, 0x2a3a4a, '#f4f0e0'],
        hud: { y: '#ffffff', c: '#f4c020', r: '#e8482a', fond: 'rgba(20,40,64,.9)', style: 'trait', split: 0, jp: null, sur: [null, 'BARRAGE · PLEIN MIDI'], titre: ['ROCHE', 'SOURDE'] } } },

    // Grand Vacarme : une arène couverte, pleine à craquer. Trois lignes droites en épi sous la charpente, chacune avec son tremplin : la table de la ligne de départ,
    // le saut par-dessus la fosse (trop lent, on tombe dedans et on en ressort par sa rampe), la grande bosse du fond. Deux demi-tours relevés côté est, une épingle à plat au milieu,
    // et le grand virage relevé de la tribune ouest qui ramène à la ligne (le mur y est plus rapide que la corde).
    { id: 'stade', nom: 'GRAND VACARME', rivaux: ['NOUR', 'ENZO', 'JADE'], med: [1.08, 1, 0.94], W: 9, grip: 20, sc: 1, tun: null, chaud: [23, 29], amb: [[0, 4], [23, 29]], sect: [9, 23], anticipe: 1,
      sauts: [[2, 40, 1.5], [9, 36, 1.5, 40, 5], [16, 30, 1.2], [22, 60, 2]], cuv: [[4, 8, 10, 9], [17, 21, 10, 9], [25, 29, 10, 9]],
      pts: [[0, 0, 0], [80, 0, 0], [150, 0, 0], [230, 0, 0], [300, 0, 0], [339, 16, 0], [355, 55, 0], [339, 94, 0], [300, 110, 0], [220, 110, 0], [150, 110, 0], [80, 110, 0], [45, 125, 0], [30, 160, 0], [45, 195, 0], [80, 210, 0], [190, 210, 0], [300, 210, 0], [339, 226, 0], [355, 265, 0], [339, 304, 0], [300, 320, 0], [190, 320, 0], [100, 320, 0], [0, 320, 0], [-60, 320, 0], [-173, 273, 0], [-220, 160, 0], [-173, 47, 0], [-60, 0, 0]],
      // voiture inventée : un pick-up de stade à châssis tubulaire, V8 atmosphérique de 6 L, 600 ch, 1300 kg, propulsion, grands débattements
      car: car({ nom: 'MASTIFF V8 ARENA', ratios: [2.9, 1.95, 1.45, 1.15, 0.95], final: 5.2, wheel: 0.36, mass: 1375, idle: 900, red: 7200, cd: 0.45, area: 2.3,
        tq: [0, 380, 500, 580, 640, 660, 640, 590, 480], son: 0.85, look: { col: 0xffc21a, l: 0.9, w: 1.04, h: 1.2, nez: 0.45, cab: [-0.1, 1.9, 0.62], aileron: 2, bandes: 0x16161c } }),
      radio: RADIO.stade,
      th: { decor: 'stade', fog: 0x0e0c18, fogD: [120, 900], sky: [[0, '#05050a'], [1, '#05050a']], stars: 0,
        astre: { dir: [0.2, 0.95, 0.25], col: '#05050a', ombre: '#05050a', taille: 1 }, hemi: [0xdfe6ff, 0x6a5038, 0.9], sun: [0xfff6e0, 0.55], phares: 1.2, bloom: 0.1, scan: 0.08,
        murH: 1.2, paroi: 'paroiArene', route: ['#7a5a3c', '#86643f', '#f4f0e0', '#ffc21a', '#e8362a', '#f4f0e0', false], mur: ['#f4f0e0', '#e8362a', '#1c3fa8', '#c8c4b8'], depart: [0xe8362a, 0x20242c, '#f4f0e0'],
        hud: { y: '#ffffff', c: '#ffc21a', r: '#e8362a', fond: 'rgba(16,14,28,.9)', style: 'bloc', split: 0, jp: null, sur: [null, 'ARENE COUVERTE · COMPLET'], titre: ['GRAND', 'VACARME'] } } },
    // Nuit Blanche : la route d'un col fermé pour l'hiver, à l'aube. Neige tassée partout, glace vive là où le soleil ne vient jamais (elle luit, sombre, sur la route claire) :
    // le pied de la falaise après le départ, le replat entre les deux lacets, la crête du col balayée par le vent, le pont sur la gorge, le bois de mélèzes du retour.
    // Pas de relief actif : tout se joue au freinage, qu'il faut avoir fini avant la plaque, et à la remise des gaz, qu'il faut attendre.
    { id: 'givre', nom: 'NUIT BLANCHE', rivaux: ['SOLVEIG', 'ANSELME', 'MIKKO'], W: 7, grip: 20, sc: 1, tun: null, chaud: [16, 22], amb: [[15, 19]], sect: [10, 20], anticipe: 1,
      surf: { fond: 'neige', zones: [[2, 3, 'glace'], [13, 14, 'glace'], [18, 19, 'glace'], [22, 23, 'glace'], [25, 26, 'glace']] },
      pts: [[0, 0, 0], [180, 0, 1], [340, -30, 6], [480, 10, 14], [600, -30, 24], [720, 20, 36], [790, 120, 50], [770, 230, 62], [680, 270, 72], [590, 260, 80], [558, 273, 83], [545, 305, 86], [558, 337, 89], [590, 350, 92], [700, 350, 102], [735, 365, 106], [750, 400, 110], [735, 435, 114], [700, 450, 117], [560, 470, 122], [420, 440, 118], [280, 490, 104], [150, 470, 90], [0, 470, 72], [-140, 470, 54], [-250, 400, 40], [-290, 290, 28], [-250, 180, 18], [-300, 90, 10], [-230, 10, 3], [-120, 0, 0]],
      // Audi Sport quattro S1 E2 (1985, Groupe B) : 5 cylindres turbo de 2,1 L, environ 480 ch, 590 N·m, 1090 kg, transmission intégrale (rapports et courbe de couple estimés)
      car: car({ nom: 'AUDI QUATTRO S1 E2', ratios: [3.5, 2.27, 1.63, 1.27, 1.04, 0.85], final: 4.3, wheel: 0.31, mass: 1165, idle: 1000, red: 8000, cd: 0.45, area: 2.0,
        tq: [0, 180, 300, 430, 540, 590, 580, 520, 400], trac: 11, rwd: 0, son: 1.1, look: { col: 0xf4f0e0, l: 0.9, w: 1.03, h: 1.06, nez: 0.5, cab: [-0.2, 2.1, 0.58], aileron: 2, bandes: 0xf4c020 } }),
      radio: RADIO.givre,
      th: { decor: 'givre', neige: 1.6, fog: 0x8a9cc0, fogD: [70, 1100], sky: [[0, '#070c24'], [0.3, '#16224a'], [0.4, '#3a4a80'], [0.46, '#b07a98'], [0.49, '#f0b890'], [0.5, '#8a9cc0'], [1, '#8a9cc0']], stars: 90,
        astre: { dir: [-0.55, 0.3, 0.5], col: '#f4f8ff', ombre: '#aab8d8', taille: 150 }, hemi: [0x8aa4e0, 0xc8d4f0, 0.8], sun: [0xc0d0ff, 0.45], phares: 2.4, bloom: 0.08, scan: 0.06,
        chev: 1, murH: 1.4, route: ['#c4d0e2', '#dce6f4', '#aab8d0', '#c4d0e2', '#e8eef8', '#d4deec', false], mur: ['#dfe8f6', '#f8fbff', '#c4d0e4', '#b4c2da'], depart: [0xe8482a, 0x1c2a4a, '#f4f8ff'],
        hud: { y: '#ffffff', c: '#8fd0ff', r: '#ff5a4a', fond: 'rgba(14,24,52,.9)', style: 'trait', split: 0, jp: null, sur: [null, 'COL FERME · -14 °C · AUBE'], titre: ['NUIT', 'BLANCHE'] } } },
    // Spéciale des Ocres : une spéciale de rallye sur terre battue, en fin de journée, entre les pins et les falaises d'ocre. Route étroite et bosselée, tout en courbes à prendre en travers :
    // la crête de la ligne de départ, l'enfilade du vallon, le gué au creux du parcours, l'épingle du belvédère, la grande crête du plateau, puis la traversée du hameau sur son bout de bitume et la descente vers la ligne.
    { id: 'terre', nom: 'SPECIALE DES OCRES', rivaux: ['LOLA', 'SACHA', 'YANN'], med: [1.08, 1, 0.94], W: 6, grip: 18, sc: 1, tun: null, chaud: [33, 54], sect: [31, 51], anticipe: 1,
      surf: { fond: 'terre', zones: [[31, 33, 'mouille'], [64, 67, 'sec']] }, sauts: [[5, 60, 0.7], [30, 36, 0.45], [51, 60, 0.8]],
      pts: [[0, 0, 29.5], [43, 0, 29.7], [85, 0, 29.8], [128, 0, 30.1], [170, 0, 32.2], [220, 0, 33.1], [255, 0, 31.2], [298, 0, 30.1], [340, 0, 30.9], [361, 5, 31.1], [378, 18, 30.8], [407, 52, 29.6], [429, 67, 29.7], [455, 67, 30.4], [476, 52, 31.2], [505, 18, 30.8], [528, 3, 30.1], [555, 4, 30], [576, 21, 30.8], [585, 47, 31.7], [585, 94, 31.8], [585, 141, 31.1], [593, 167, 31.8], [614, 183, 33], [652, 197, 33.9], [666, 207, 33.8], [673, 224, 33.6], [670, 241, 33.4], [658, 254, 33.6], [641, 259, 34.2], [591, 259, 36.1], [536, 259, 35], [513, 259, 34.5], [481, 259, 35.7], [471, 259, 36.4], [448, 265, 38.2], [432, 281, 39.5], [426, 304, 39.9], [426, 344, 39.5], [426, 384, 40.1], [420, 406, 41.1], [403, 423, 41.9], [369, 443, 41.9], [350, 461, 41.3], [344, 486, 41.1], [344, 526, 42], [338, 547, 42.6], [323, 563, 42.7], [302, 568, 42.2], [258, 568, 41.2], [214, 568, 42.4], [152, 568, 43.1], [126, 568, 41.3], [82, 568, 38.6], [57, 568, 38.3], [30, 559, 38.3], [14, 535, 37.8], [3, 496, 35.8], [-8, 476, 34.8], [-28, 464, 34.5], [-67, 454, 34.7], [-90, 439, 34.4], [-98, 413, 33.3], [-98, 367, 31.4], [-98, 313, 31.6], [-98, 273, 31.4], [-98, 227, 29.6], [-98, 193, 29.1], [-98, 133, 30.2], [-109, 105, 29.7], [-134, 74, 28.6], [-145, 51, 28.5], [-141, 26, 29], [-124, 7, 29.5], [-100, 0, 29.6], [-50, 0, 29.2]],
      // voiture inventée : une berlinette de rallye à moteur central arrière, 4 cylindres atmosphérique de 2 L, 260 ch, 780 kg, propulsion (le poids sur les roues motrices : elle passe sa puissance même sur la terre)
      car: car({ nom: 'GARRIGUE 2000 GR.4', ratios: [3, 2.05, 1.5, 1.18, 0.98], final: 4.6, wheel: 0.3, mass: 855, idle: 1000, red: 7800, cd: 0.36, area: 1.7,
        tq: [0, 140, 200, 240, 262, 270, 268, 250, 215], trac: 10.5, son: 1.3, look: { col: 0x2a62c8, l: 0.84, w: 0.98, h: 0.98, nez: 0.5, cab: [-0.3, 2, 0.55], aileron: 0, bandes: 0xf4c020 } }),
      radio: RADIO.terre,
      th: { decor: 'terre', fog: 0xe8c898, fogD: [150, 1500], sky: [[0, '#3f6fb0'], [0.3, '#3f6fb0'], [0.31, '#7fa8cc'], [0.42, '#7fa8cc'], [0.43, '#e8d0a0'], [0.49, '#e8d0a0'], [0.5, '#e8c898'], [1, '#e8c898']], stars: 0,
        astre: { dir: [-0.6, 0.35, 0.5], col: '#fff2c0', ombre: '#fff2c0', taille: 220 }, hemi: [0xc8d8f0, 0xb07848, 0.9], sun: [0xffd8a0, 0.9], phares: 0.3, bloom: 0.03, scan: 0.05,
        murH: 0.9, poussiere: [0.3, 0.2, 0.11], route: ['#a86a3a', '#8a5228', '#96602f', '#b87a48', '#7a6a3a', '#8a7444', false], mur: ['#8a5a30', '#6a7a3a', '#7a4c28', '#6e4424'], depart: [0xe8482a, 0x3a2a1c, '#f4f0e0'],
        hud: { y: '#ffffff', c: '#ffb03a', r: '#e8482a', fond: 'rgba(70,36,16,.9)', style: 'trait', split: 0, jp: null, sur: [null, 'SPECIALE 7 · FIN DE JOURNEE'], titre: ['SPECIALE', 'DES OCRES'] } } },
  ];
  let id = 'ville';
  if (typeof location !== 'undefined') try { id = (/^#defi=\d+\.([a-z0-9]+)\./.exec(location.hash) || [])[1] || new URLSearchParams(location.search).get('carte') || localStorage.getItem('vpr.carte') || id; } catch (e) { } // un lien de défi (#defi=version.carte.données, voir defiCode dans sim.js) ouvre sa carte
  G.CARTE = G.CARTE || G.CARTES.find(m => m.id === id) || G.CARTES[0];
})(typeof window !== 'undefined' ? window : globalThis);
