// Les cartes du jeu : une carte = un tracé + une voiture + une radio + un thème (décor, lumière, interface). Aucun rendu ici.
// Chargé avant sim.js (navigateur) ou par lui (node). La carte active est choisie une fois, au chargement : ?carte=<id>, sinon la dernière jouée.
// Changer de carte recharge la page : le décor n'est construit qu'une fois, comme avant.
//
// Champs d'une carte :
//   W demi-largeur de route (m) · kmh facteur du compteur de vitesse (la vitesse vraie × kmh : les routes larges font paraître plus lent, le compteur suit l'impression du décor) · large [[a, b, w], …] demi-largeur w entre les points a et b (place) · place { c: [x, z], r, a, piles, ile } cercle où l'on roule partout, avec les piles d'un monument (boîtes [x, z, demi-largeurs] dans son repère tourné de a) et son terre-plein (ile [rayon de la couronne de bornes, demi-ouverture dans l'axe de la grande arche]) · grip adhérence latérale maxi (m/s²) · sc échelle du tracé · pts [x, z, altitude], sens horaire, départ en [0]
//   camH hauteur de la caméra (m, 3,2 par défaut : à relever quand la voiture masque la route) · vit [début, plein] plage des effets de vitesse en km/h affichés (tremblement, vignette, flou, grand-angle ; défaut 130, 200), à régler sur les vitesses vraies de la carte · tun [a, b] tunnel entre deux points (ou null) · chaud [a, b] secteur où la musique se déchaîne · amb [[a, b], …] zones où l'on entend l'ambiance du lieu · sect [a, b] les deux temps intermédiaires
//   sauts [[point, longueur, hauteur, fosse, profondeur], …] tremplin qui finit net au point, suivi ou non d'une fosse (m) · cuv [[a, b, largeur, rayon], …] murs roulables : un quart de tube de chaque côté du plat entre les points a et b. L'un ou l'autre active le relief (hauteur, gravité, vol : voir sim.js) ; th.paroi = texture des murs roulables
//   surf : surface (SURF de sim.js) { fond, zones: [[a, b, type, force]], large } : large = hors de la bande de bitume (parties larges, place) ; à accorder avec ce que le décor y pose
//   anticipe : le pilote automatique calcule sa distance de freinage (indispensable dès qu'il y a une épingle)
//   rivaux : prénoms des trois adversaires du mode course (sinon ceux de la ville) · med : médailles [bronze, argent, or] en multiples du tour lancé du pilote automatique (défaut 1,1 / 1,03 / 0,97 ; plus bas là où la glisse rapporte beaucoup) · trafic : nombre de camions à doubler · car : la voiture (format CARD de sim.js) · radio : stations (voir RADIO plus bas) · th : thème
//   th.hud : l'interface de la carte · y c r couleurs (texte, accent, alerte), fond des panneaux · style des panneaux (cyber, trait, panneau, plaque, bloc, tableau, rallye, givre) · jauge du compte-tours (égaliseur par défaut, aiguille, led) · mph : compteur en miles · jp : étiquettes japonaises · sur, titre : sous-titre et titre du menu
(function (G) {
  const _ = null;
  // voiture : up / down = régimes de passage de la boîte auto ; trac = accélération maxi que les pneus passent au sol (m/s²) ;
  // rwd = propulsion : accélérer fort prend sur l'adhérence latérale des roues arrière ; son = hauteur du moteur ; moteur = architecture (l4 l5 l6 v8 v10 rot, timbre : MOT dans audio.js), turbo = sifflement et soupape ; look = silhouette (type : le modèle de formes-voitures.js, gtr fd a80 r5 gts) ;
  // grip = adhérence de la voiture (défaut 1, voir KT0 dans sim.js) : multiplie ce qu'elle passe en virage et la vitesse à laquelle elle se remet dans l'axe
  const car = (o) => Object.assign({ up: o.red * 0.94, down: o.red * 0.775, eff: 0.88, trac: 8.5, rwd: 1, son: 1 }, o);

  // Arrangements épurés (choix de l'utilisateur) : batterie sans percussions d'appoint, basse, et une seule mélodie à la fois — le thème (avec la nappe dessous) s'il joue,
  // sinon les accords, sinon la nappe, sinon l'arpège. Les commentaires de chaque station disent son inspiration ; tous ses instruments n'y jouent plus.
  // ---------- radio : trois stations par carte (quatre au touge), chacune avec son instrumentarium et sa forme (compositions originales, jouées par audio.js) ----------
  // Une station : name, fq, vol (niveau, réglé par mesure dans ecoute.html), genre, bpm, sw (swing, en fraction de double-croche), key (tonique des thèmes) ·
  //   kit batterie (KIT dans audio.js) · eq [grave dB, médium Hz, médium dB, aigu dB] · rev réverbération · echo [pas, réinjection] · pump profondeur de la
  //   pompe sous la grosse caisse (1 = aucune) · sweep filtre balayé sur 8 mesures · drive saturation de tout le bus ·
  //   prog : progressions d'accords (la section choisit avec P1) ·
  //   parties, chacune avec ses variantes de motif (16 pas par mesure, « | » sépare les mesures) :
  //     k grosse caisse · s caisse claire (g fantôme, c clap, r cercle) · h charlestons (x X o, r ride, b cloche) · p percussions (c cloche, v clave, h l congas,
  //     m shaker, t tambourin, 1 2 3 toms, k métal, y « hé ! » de la foule) · b [timbre, lignes de basse en demi-tons depuis la fondamentale] · d [timbre de nappe, transposition] ·
  //     c et g [timbre, rythmes d'accords plaqués] · a [timbre, arpèges : 0-3 notes de l'accord, 4-7 à l'octave] · l [timbre, thèmes en demi-tons depuis key]
  //     (dans une ligne ou un thème : « - » tenue, « . » silence) · gate : motif de la nappe hachée
  //   sec : les sections, « k0 s1 b0 d l0! » = parties jouées et variante ; « ! » seulement dans le secteur chaud ; P1 autre progression ; roll montée
  //     (roulement et souffle) ; lo passe-bas qui s'ouvre au fil de la section ; gate nappe hachée ·
  //   cv niveau des couplets par rapport au refrain (réglé par mesure, pour que l'écart reste sous 3 dB) ·
  //   lO transposition du thème, lV son niveau · cO gO aO octave des accords et de l'arpège · fz attaque des guitares saturées · mx niveau par partie · drive de 0 à 1 ·
  //   gamme (mineur, majeur) · emprunts : accords qui sortent de la gamme, voulus · hors : notes hors gamme permises (demi-tons depuis key) ·
  //   bPar : la ligne de basse suit l'accord en parallèle, dans ces intervalles (riff de rock sur accords de puissance) ·
  //   form : la suite des sections (4 mesures chacune) · hot : le refrain (c par défaut), joué à la place de toutes les sections dans le secteur chaud, sauf la variation e.
  const R = -99; // silence dans une ligne
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }, QUAL = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], M7: [0, 4, 7, 11], m9: [0, 3, 10, 14], 9: [0, 4, 10, 14], 5: [0, 7, 12] };
  // conduite des voix : chaque accord (nappe, accords plaqués) prend le renversement le plus proche du précédent, sans quitter le registre écrit ;
  // les accords de puissance (fondamentale, quinte, octave) restent tels quels. Les arpèges gardent l'accord à l'état fondamental (CH).
  const voix = CH => { let prev = null; return CH.map(ch => { if (ch.length === 3 && ch[2] - ch[0] === 12) return prev = ch;
    const c0 = ch.reduce((a, b) => a + b) / ch.length; let best = ch, cout = 1e9;
    for (let i = 0; i < ch.length; i++) for (const o of [-12, 0, 12]) { const v = [...ch.slice(i), ...ch.slice(0, i).map(n => n + 12)].map(n => n + o), m = v.reduce((a, b) => a + b) / v.length;
      const c = (prev ? v.reduce((a, n) => a + Math.min(...prev.map(p => Math.abs(n - p))), 0) : 0) + 0.6 * Math.abs(m - c0); if (c < cout) { cout = c; best = v; } }
    return prev = best.sort((a, b) => a - b); }); };
  // « Am7 D7 … » → accords autour du do central et fondamentales de basse
  const prog = s => { const CH = [], ROOT = []; for (const c of s.split(' ')) { const [, n, acc, q] = c.match(/^([A-G])([b#]?)(.*)$/), pc = (NOTE[n] + (acc === '#' ? 1 : acc === 'b' ? -1 : 0) + 12) % 12;
    CH.push(QUAL[q].map(i => (pc < 5 ? 60 : 48) + pc + i)); ROOT.push((pc < 4 ? 36 : 24) + pc); } return { CH, ROOT, V: voix(CH) }; };
  const bars = (s, n) => s.split('|').map(b => { b = b.trim(); if ((n ? b.split(/\s+/) : b).length !== 16) throw new Error('mesure de ' + (n ? b.split(/\s+/) : b).length + ' pas : ' + b); return b; });
  const seq = (s, key = 0) => bars(s, 1).map(b => b.split(/\s+/).map(x => x === '-' ? _ : x === '.' ? R : key + +x));
  // justesse : gamme de la station (demi-tons depuis key) ; par mesure, les notes permises = la gamme et l'accord. Un accord emprunté (déclaré dans
  // emprunts) remplace la note de la gamme qu'il altère. La basse est recalée dessus par audio.js ; les thèmes doivent y être écrits (test-cartes.js).
  const GAMME = { mineur: [0, 2, 3, 5, 7, 8, 10], majeur: [0, 2, 4, 5, 7, 9, 11] };
  const accorder = o => { // (re)calcule accords, fondamentales et notes permises depuis o.accords (noms d'accords, par progression) ; rappelé par l'éditeur de musique
    o.prog = o.accords.map(a => prog(a.join(' ')));
    const sc = GAMME[o.gamme].map(i => (o.key + i) % 12);
    for (const pr of o.prog) pr.OK = pr.CH.map((ch, i) => { const c = [...ch, pr.ROOT[i]].map(n => n % 12), ok = new Set(sc);
      for (const x of c) if (!sc.includes(x)) for (const v of [(x + 1) % 12, (x + 11) % 12]) if (!c.includes(v) && v !== o.key % 12) ok.delete(v);
      for (const x of [...c, ...(o.hors || []).map(h => (o.key + h) % 12)]) ok.add(x); return ok; }); };
  const st = o => {
    o.accords = o.prog.map(p => p.split(' ')); accorder(o); o.hot = o.hot || 'c';
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
      st({ name: 'NEON CITY FM', fq: '98.7', vol: 0.41, genre: 'DARKSYNTH', bpm: 128, gamme: 'mineur', emprunts: 'Bb E', key: 57, kit: 'dur', eq: [2, 2500, 0, 10], rev: 0.15, echo: [3, 0.24], pump: 0.3, // façon Carpenter Brut / Perturbator : boîte des années 80, basse saturée, chœur sombre, thème hurlant
        prog: ['Am Am F G Am Am Bb E', 'F G Dm E'], k: [F4, 'x...x...x.x.x...'], s: [SN], h: ['..x...x...x...x.', 'xxXxxxXxxxXxxxXx'],
        b: ['bDark', '0 - 0 0 - - 12 0 - - 0 3 0 - -2 1 | 0 - 0 0 - - 12 0 - 0 7 - 6 - 5 3', '0 0 0 0 0 0 0 0 0 0 0 0 0 0 12 0'], d: ['choir', 0], 
        l: ['ldSync', '19 - - 19 - . 17 - 19 - - - 22 - - - | 19 - - - - - . - 15 - 17 - 15 - - - | 20 - - 20 - . 19 - 20 - - - 24 - - - | 22 - - - - - . - 17 - 19 - 17 - - - | 19 - - 19 - . 17 - 19 - - - 22 - - - | 19 - - - - - . - 15 - 17 - 15 - - - | 20 - - 20 - . 17 - 20 - - - 25 - - - | 23 - - - - - - - 26 - - - - - - -',
          '20 - - - 24 - - - 27 - 24 - 20 - - - | 22 - - - 26 - - - 29 - 26 - 22 - - - | 29 - - 27 - - 24 - 20 - - - 24 - - - | 23 - - - 26 - - - 31 - - - - - - -'],
        sec: { i: 'h0 d lo', a: 'k0 s0 h1 b0 d', b: 'k0 s0 h1 b0 d', c: 'k1 s0 h1 b0 l0 d', x: 'l1 d P1', u: 'k0 h1 b1 d roll P1', e: 'k1 s0 h1 b1 l1 P1' }, form: 'iabcxuceabcc' }),
      st({ name: 'USINE 130', fq: '130.0', vol: 1.12, genre: 'TECHNO INDUSTRIELLE', bpm: 130, gamme: 'mineur', hors: [1], sw: 0.1, key: 57, kit: 'ind', eq: [-16, 1300, 10, -4], rev: 0.18, echo: [3, 0.24], pump: 0.5, drive: 1, // ni accords ni mélodie : grosse caisse saturée, bruit, toms, séquence sur une note ; montées sans grosse caisse, puis le drop
        prog: ['Am'], k: [F4, 'x...x...x...x.x.', 'x..x..x.x..x..x.'], s: [SN, '....x..x....x.xx'], h: ['..X...X...X...X.', 'x.X.x.X.x.X.xxXx'], 
        b: ['bDist', '. . 0 - . . 0 - . . 0 - . . 0 1', '0 - . 0 - . 0 - . 0 - . 0 - 1 0'], a: ['seqInd', '..0..0.4..0...2.', '.0..0.0..0..4.0.'], aO: -12, // stab sourd en contretemps, une octave plus bas (l'ancienne séquence criait sur une seule note)
        sec: { i: 'k0 h0', a: 'k0 s0 h0 b0', b: 'k1 s0 h1 b0 a0', c: 'k1 s1 h1 b1 a0', x: 'h0 a1 lo', u: 'h1 a1 roll lo', e: 'k2 s1 h1 b1 a1' }, form: 'iabucbxuceuc' }),
      st({ name: 'KAIZO BREAKS', fq: '87.5', vol: 0.8, genre: 'BIG BEAT', bpm: 132, gamme: 'mineur', key: 64, kit: 'brk', eq: [-6, 1800, 4, 8], rev: 0.13, echo: [2, 0.18], pump: 0.5, // façon Prodigy / Chemical Brothers : breakbeat sali, guitare saturée plaquée, sirène ; basse tenue et sale, presque sans saut d'octave (l'acide rebondissait)
        prog: ['Em Em Em G Em Em Am Bm', 'Em G Am Bm'], k: ['x..x......x.....', 'x..x...x..x..x..', 'x.....x...x..x..'], s: ['....x..g.g..x..g', '....x.......x.gg'], h: ['x.x.x.x.x.x.x.o.', 'x.xxx.x.x.xxx.o.'], 
        b: ['bGrit', '0 - - - - - 0 - - - 0 - 3 - 5 - | 0 - - - - - 0 - - - 10 - 7 - 5 3', '0 - - 0 - - 0 - - - 0 - - 3 - -'], c: ['pwr', 'x.....x.........', 'x..x..x...x.x...'], cO: -12, 
        l: ['ldSiren', '12 - - - - - - - 7 - - - - - - - | 12 - - - - - - - 14 - - - 14 - - -',
          '24 - - - 19 - - - 24 - - - 27 - 26 - | 22 - - - - - - - 19 - - - - - - -'],
        sec: { i: 'h0 b0 lo', a: 'k0 s0 h0 b0', b: 'k0 s0 h1 b0 c0', c: 'k1 s0 h1 b1 l0', x: 'b0 l1 lo', u: 'k2 h1 b0 roll', e: 'k2 s1 h1 b1 c0' }, form: 'iabcaxucebcc' }),
    ],
    touge: [
      st({ name: 'KARASU SPEED', fq: '155', vol: 1.4, genre: 'EUROBEAT', bpm: 155, gamme: 'mineur', emprunts: 'A', key: 62, kit: 'k909', eq: [-6, 3000, 2, 4], rev: 0.12, echo: [3, 0.21], pump: 0.3, // façon Super Eurobeat : basse FM en octaves, cuivres plaqués ; thème à une note par temps, basse en croches : peu de notes, mais longues ; dans le médium (ré 4 à fa 5)
        prog: ['Dm Bb F C Dm Bb C A', 'Bb C Dm Dm'], k: [F4], s: [CP, '....c.......c.cc'], h: [OFF, 'x.o.x.o.x.o.x.o.'],
        b: ['bFM', '0 - 12 - 0 - 12 - 0 - 12 - 0 - 12 -', '0 - 12 - 0 - 12 - 0 - 12 - 7 - 12 -'], d: ['super', 0], c: ['brass', 'x..x..x.x..x..x.', 'x.......x.......'], 
        l: ['ldEuro', '7 - - - 12 - - - 10 - - - 7 - - - | 5 - - - 3 - - - 5 - - - - - - - | 7 - - - 12 - - - 10 - - - 7 - - - | 10 - - - 7 - - - 5 - - - 7 - - - | 7 - - - 12 - - - 10 - - - 7 - - - | 5 - - - 3 - - - 8 - - - 10 - - - | 12 - - - 10 - - - 7 - - - 5 - - - | 2 - - - - - - - . - - - - - - -',
          '8 - - - 12 - - - 15 - - - 12 - - - | 10 - - - 14 - - - 17 - - - 14 - - - | 15 - - - 12 - - - 10 - - - 12 - - - | 12 - - - - - - - . - - - - - - -'],
        sec: { i: 'h0 d lo', a: 'k0 s0 h0 b0 d', b: 'k0 s0 h1 b0 c1', c: 'k0 s1 h1 b0 l0 d', x: 'l1 d P1', u: 'k0 h1 b1 d roll P1', e: 'k0 s1 h1 b1 l1 P1' }, form: 'iabccxuceacc' }),
      st({ name: 'GRAND PRIX FM', fq: '86.2', lO: -12, lV: 0.7, vol: 1.28, genre: 'FUSION JAZZ-ROCK', bpm: 136, cv: 1.2, gamme: 'majeur', emprunts: 'B7', key: 62, kit: 'acou', eq: [-8, 1100, 9, -3], rev: 0.15, echo: [3, 0.24], pump: 1, // façon T-Square / Casiopea : batterie jouée avec ride et toms, basse claquée, piano électrique, thème au contrôleur à vent en notes longues, chantable
        prog: ['Em9 A9 DM7 GM7 Em9 A9 F#m7 B7', 'GM7 F#m7 Em9 A9'], k: ['x..x..x...x..x..', 'x..x..x..xx..x.x', 'x.....x..x....x.'], s: ['....x..g.g..x..g', '....x..g....x.g.'], h: ['r.r.r.rrr.r.r.rr', 'x.x.x.x.x.x.x.o.', 'b.r.r.b.r.r.b.r.'],
        b: ['bSlap', '0 - 12 - 0 0 - 9 - 12 - 0 - 7 9 12 | 0 - 12 0 - 7 - 9 12 - 9 - 7 - 5 7', '0 - - 0 - - 7 - 0 - - 12 - 9 7 -'], d: ['warm', 0], c: ['epFM', '..x..x....x..x..', 'x.....x...x.....'], cO: -12, mx: { c: 0.55 }, // accords gardés, une octave plus bas et en retrait
        l: ['ldEwi', '21 - - - 19 - - - 16 - - - 14 - - - | 16 - - - - - - - . - - - 14 - 16 - | 21 - - - - - 19 - 16 - - - - - - - | 14 - - - - - - - . - - - 16 - 19 - | 21 - - - 23 - - - 24 - - - 23 - 21 - | 19 - - - - - - - . - - - 16 - 19 - | 21 - - - 19 - - - 16 - - - 14 - - - | 16 - - - - - - - . - - - - - - -',
          '19 - - - - - 21 - 19 - - - 16 - - - | 16 - - - - - - - 14 - - - 16 - - - | 19 - - - 21 - - - 23 - - - 21 - 19 - | 16 - - - - - - - . - - - - - - -'],
        sec: { i: 'h2 c1', a: 'k0 s1 h0 b1 c0', b: 'k0 s0 h0 b0 c0', c: 'k1 s0 h1 b0 l0 d', x: 'h2 l1 d P1', e: 'k2 s1 h2 b1 l1 P1' }, form: 'iabccxecabcc' }),
      st({ name: 'PLASTIC NIGHT', fq: '80.0', vol: 0.96, genre: 'CITY POP', bpm: 112, gamme: 'majeur', emprunts: 'A7', sw: 0.08, key: 60, kit: 'lin', eq: [3, 800, -2, 1], rev: 0.18, echo: [3, 0.24], pump: 0.85, lO: -12, lV: 1.25, cO: -12, mx: { c: 0.7 }, // remixé : saxophone une octave plus bas et devant, piano et cocotte en retrait sous lui, moins de creux dans le médium // façon Tatsuro Yamashita : majeur, piano électrique FM, cocotte de guitare, cordes, saxophone ; l'autoradio de la descente
        prog: ['FM7 G7 Em7 Am7 FM7 G7 Em7 A7', 'Dm7 G7 CM7 Am7'], k: ['x......x..x.....', 'x..x...x..x...x.'], s: [SN], h: ['x.xxx.xxx.xxx.ox', 'x.x.x.x.x.x.x.o.'], 
        b: ['bFM', '0 - - 0 - 12 - - 0 - 12 - - 7 - 12 | 0 - - 0 - 12 - - 7 - 12 - 7 - 12 7', '0 - - - 12 - - - 0 - - 7 - - 12 -'], d: ['strings', 0], c: ['dxEp', '..x...x..x....x.', 'x.........x.....'], 
        l: ['ldSax', '16 - - - 19 - 21 - - - 19 - 16 - - - | 14 - - - 17 - 19 - - - 17 - 14 - - - | 19 - - 16 - - 14 - 16 - - - . - - - | 12 - - 14 - - 16 - 21 - - - 19 - - - | 24 - - - 21 - 19 - - - 21 - 24 - - - | 23 - - - 19 - 17 - - - 19 - 23 - - - | 26 - - 23 - - 19 - 21 - - - . - - - | 25 - - - - - 21 - 19 - - - 16 - - -',
          '14 - - 17 - - 21 - 24 - - - 21 - - - | 23 - - 19 - - 17 - 14 - - - 17 - - - | 16 - - 19 - - 23 - 24 - - - - - 23 - | 21 - - - 19 - 16 - 12 - - - . - - -'],
        sec: { i: 'h1 c1', a: 'k0 s0 h1 b1 c0', b: 'k0 s0 h0 b0 c0', c: 'k1 s0 h0 b0 l0 d', x: 'l1 d P1', e: 'k1 s0 h0 b0 l1 P1' }, form: 'iabccxecabcc' }),
      st({ name: 'HANABI 175', fq: '175', vol: 0.3, genre: 'NIGHTCORE', bpm: 175, gamme: 'majeur', key: 62, kit: 'k808', eq: [7, 2500, 0, 2], rev: 0.18, echo: [3, 0.18], pump: 0.22, pumpT: 0.18, drive: 0.2, cO: -12, mx: {  }, // version « bass boosted » : grosse caisse de 808 qui gronde, sub saturé, grave poussé, tout le bus un peu sali ; le thème aux scies, sans voix ; nightcore d'un tube hands-up des années 2000 (composition originale, inspirée du mix de l'époque) : introduction au piano et au thème, puis le drop ; accords de scies plaqués en contretemps, pompe profonde sous la grosse caisse, basse à contretemps, thème aux scies, refrain en notes longues qui montent par bonds (vi IV I V)
        prog: ['Bm G D A Bm G D A', 'G A Bm Bm'], k: [F4], s: [CP, '....c.......c.cc'], h: [OFF, 'xxoxxxoxxxoxxxox'],
        b: ['bBoost', '. . 0 - . . 0 - . . 0 - . . 0 -', '0 - - 0 - - 0 - 0 - - 0 - - 12 -'], d: ['strings', 0], c: ['super', '..x...x...x...x.', 'x.......x.......'], 
        l: ['ldSaw', '14 - 12 - 11 - 9 - - - - - 7 - 9 - | 12 - - - 9 - 7 - - - - - . - 7 9 | 12 - - - 14 - 16 - - - - - 14 - 12 - | 11 - - - - - - - . - - - 9 - 11 - | 14 - 12 - 11 - 9 - - - - - 7 - 9 - | 12 - - - 12 - 14 - - - - - 16 - 17 - | 19 - - - 16 - 14 - - - - - 12 - 14 - | 16 - - - - - - - . - - - - - - -',
          '14 - - 12 - - 12 - 12 - - - 14 - 16 - | 16 - - 14 - - 11 - 9 - - - 11 - 11 - | 14 - - 16 - - 16 - 16 - - - 14 - 12 - | 16 - - - - - - - . - - - - - - -'],
        sec: { i: 'l0 d lo', a: 'k0 h0 b0 d', b: 'k0 s0 h1 b0 d', c: 'k0 s1 h1 b1 l0 d', x: 'l1 d P1', u: 'k0 h1 b0 c1 roll P1', e: 'k0 s1 h1 b1 l1 P1' }, form: 'iabcxucceabc' }),
    ],
    wangan: [
      st({ name: 'BAY 138', fq: '138', vol: 1.9, genre: 'TRANCE', bpm: 138, gamme: 'mineur', emprunts: 'B', key: 64, kit: 'k909', eq: [-7, 3000, 1, 3], rev: 0.24, echo: [3, 0.27], pump: 0.25, gate: 'x.xx.xx.x.xx.xx.', lO: -12, // thème et arpège une octave plus bas (le thème montait au mi 7), aigus moins poussés ; façon Wangan Midnight Maximum Tune : basse à contretemps, nappe hachée, arpège à écho, hymne en dents de scie
        prog: ['Em C G D Em C Am B', 'C D Em Em'], k: [F4], s: [CP], h: [OFF, 'x.o.x.o.x.o.x.o.'],
        b: ['bOff', '. . 0 - . . 0 - . . 0 - . . 0 -', '. . 0 - . . 0 - . . 0 - . 0 12 -', '. 0 0 0 . 0 0 0 . 0 0 0 . 0 0 0'], d: ['super', 0], 
        l: ['ldSaw', '19 - - - - - 22 - 24 - - - 22 - 19 - | 20 - - - - - 24 - 27 - - - 24 - 20 - | 22 - - - - - 26 - 27 - - - 26 - 22 - | 26 - - - - - 29 - 26 - - - 22 - - - | 19 - - - - - 22 - 24 - - - 22 - 19 - | 20 - - - - - 24 - 27 - - - 24 - 20 - | 24 - - - - - 27 - 29 - - - 27 - 24 - | 23 - - - - - 26 - 31 - - - - - - -',
          '20 - - - 24 - - - 27 - - - 24 - - - | 22 - - - 26 - - - 29 - - - 26 - - - | 24 - - - 27 - - - 31 - - - 27 - - - | 36 - - - - - - - 34 - - - 31 - - -'],
        sec: { i: 'd lo', a: 'k0 h0 b0 d gate', b: 'k0 s0 h1 b0 d gate', c: 'k0 s0 h1 b2 l0 d gate', x: 'l1 d P1', u: 'k0 h1 d gate roll P1', e: 'k0 s0 h1 b1 l1 d P1' }, form: 'iabcxucceabc' }),
      st({ name: 'LIQUID 174', fq: '174', vol: 0.34, genre: 'DRUM AND BASS', bpm: 174, cv: 1.2, gamme: 'mineur', emprunts: 'A7', key: 62, kit: 'dnb', eq: [7, 700, -6, -7], rev: 0.21, echo: [3, 0.24], pump: 0.85, // liquid teinté acid jazz : breakbeat sec, basse « Reese » tenue, nappe de verre, piano électrique
        prog: ['Dm9 Dm9 BbM7 BbM7 Gm7 Gm7 A7 A7', 'BbM7 BbM7 Am7 Am7'], k: ['x.........x.....', 'x.........x..x..', 'x......x..x.....'], s: [SN, '....x..g....x.g.', '....x..g.g..x..g'], h: ['x.x.x.x.x.x.x.x.', 'x.xXx.x.x.xXx.x.', 'r.r.r.r.r.r.r.r.'], 
        b: ['bReese', '0 - - - - - - - - - 0 - - - 7 - | 0 - - - - - - - 12 - - - 10 - 7 -', '0 - - - - - - 0 - - 0 - - - - -'], d: ['glass', 0], c: ['epFM', 'x.........x.....', 'x...............'], 
        l: ['ldTri', '19 - - - - - - - 17 - - - 15 - - - | 14 - - - - - - - . - - - 12 - 14 - | 17 - - - - - - - 15 - - - 15 - - - | 10 - - - - - - - . - - - - - - - | 22 - - - - - - - 19 - - - 17 - - - | 15 - - - - - - - . - - - 14 - 15 - | 19 - - - - - - - 14 - - - 11 - - - | 7 - - - - - - - . - - - - - - -',
          '17 - - - - - - - 22 - - - 20 - - - | 17 - - - - - - - . - - - - - - - | 19 - - - - - - - 24 - - - 22 - - - | 19 - - - - - - - . - - - 14 - - -'],
        sec: { i: 'h2 c1 lo', a: 'k0 s0 h0 b1 d', b: 'k0 s1 h1 b0 c0', c: 'k1 s2 h1 b0 l0 d', x: 'l1 d P1', u: 'h2 b1 d roll P1', e: 'k2 s2 h1 b0 l1 P1' }, form: 'iabcxucceabc' }),
      st({ name: 'MOTOR BAY', fq: '127.3', vol: 2.12, genre: 'TECHNO DE DETROIT', bpm: 127, cv: 1.3, gamme: 'mineur', emprunts: 'Ebm7 Abm7 Bbm7', sw: 0.06, key: 60, kit: 'k909', eq: [-9, 900, 9, -5], rev: 0.15, echo: [3, 0.3], pump: 0.5, // façon Derrick May / Juan Atkins : accords mineurs parallèles plaqués à écho, cordes de synthé, clave et congas ; pas de thème
        prog: ['Cm7 Cm7 Ebm7 Ebm7 Cm7 Cm7 Fm7 Bbm7', 'Abm7 Abm7 Bbm7 Bbm7'], k: [F4, 'x...x...x...x..x'], s: [CP, '....r..r....r...'], h: [OFF, 'x.oxx.oxx.oxx.ox'], 
        b: ['bSeq', '0 - - 0 - - 0 - - 0 - - 12 - 0 -', '0 - - 0 - - 0 - - 0 - 12 - 10 - 7'], c: ['stabM7', 'x..x...x..x.....', '..x...x...x...x.'], 
        sec: { i: 'k0 h0 c1 lo', a: 'k0 s1 h0 b0 c0', b: 'k0 s0 h1 b0 c0', c: 'k1 s0 h1 b1 c0', x: 'c1 P1', u: 'k0 h1 b0 c1 roll P1', e: 'k1 s0 h1 b1 c1 P1' }, form: 'iabcbxucecbc' }),
    ],
    paris: [
      st({ name: 'FILTRE FM', fq: '89.0', vol: 0.83, genre: 'HOUSE FILTREE', bpm: 123, cv: 1.3, gamme: 'majeur', sw: 0.12, key: 64, kit: 'k909', eq: [6, 500, 3, -6], rev: 0.09, echo: [3, 0.24], sweep: 1, pump: 0.12, pumpT: 0.3, // French touch façon Daft Punk / Stardust : une boucle disco qui ne change pas, le filtre et la pompe font tout
        prog: ['F#m7 B7 EM7 C#m7', 'AM7 B7 G#m7 C#m7'], k: [F4], s: [CP], h: [OFF, 'x.o.x.oxx.o.x.ox'], 
        b: ['bPick', '0 - - 0 - 12 - 0 - - 7 - 12 - 0 - | 0 - - 0 - 12 - 0 - 12 - 7 - 12 - 7', '0 - - - - - 0 - - - 12 - - - 7 -'], d: ['strings', 0], c: ['super', 'x..x..x.x..x.x..', 'x..x..x.x..x.x.x'], 
        l: ['ldVox', '14 - 14 . 17 - 14 . 21 - - - 17 - - - | 19 - 19 . 23 - 19 . 26 - - - 23 - - - | 16 - 16 . 19 - 16 . 24 - - - 23 - - - | 21 - 21 . 24 - 21 . 28 - - - 24 - - -'],
        sec: { i: 'k0 c0', a: 'k0 h0 b1 c0', b: 'k0 s0 h1 b0 c0', c: 'k0 s0 h1 b0 l0', x: 'l0 d', u: 'k0 h1 c0 roll', e: 'k0 s0 h1 b0 c1 P1' }, form: 'iabbcxucecbc' }),
      st({ name: 'EURO 95', fq: '95.0', vol: 1.69, genre: 'EURODANCE', bpm: 136, gamme: 'mineur', key: 57, kit: 'k909', eq: [-7, 2500, 3, 6], rev: 0.15, echo: [3, 0.18], pump: 0.4, cO: -12, mx: { c: 0.8 }, // la voix chante les accords en chœur (« oh ») : en solo sur le thème, elle sonnait faux ; façon Corona / Culture Beat : grosse caisse à tous les temps, basse à l'octave, piano de house plaqué en syncope, nappe de scies, gimmick dans le médium
        prog: ['Am F C G Am F C G', 'Dm F G Am'], k: [F4], s: [CP, '....c.......c..c'], h: [OFF, 'xxoxxxoxxxoxxxox'], 
        b: ['bOff', '0 - . 0 . . 12 . 0 - . 0 . . 12 .', '. . 0 - . . 0 - . . 0 - . . 0 -'], d: ['choeur', 0], c: ['pno', 'x..x..x...x..x..', 'x.x..x..x.x..x..'], 
        l: ['ldEuro', '12 - - 12 - - 10 - 12 - - - 15 - 12 - | 8 - - 8 - - 7 - 8 - - - 12 - 10 - | 7 - - 7 - - 3 - 7 - - - 10 - 7 - | 10 - - - 7 - - - 5 - - - . - - - | 12 - - 12 - - 10 - 12 - - - 15 - 17 - | 15 - - - 12 - - - 8 - - - 12 - - - | 10 - - 10 - - 7 - 10 - - - 12 - 10 - | 7 - - - - - - - . - - - - - - -',
          '5 - - 8 - - 12 - 10 - - - 8 - 5 - | 8 - - 12 - - 15 - 12 - - - 10 - 8 - | 10 - - 14 - - 17 - 14 - - - 14 - 10 - | 12 - - - - - - - . - - - - - - -'],
        sec: { i: 'h0 d lo', a: 'k0 s0 h0 b1 d', b: 'k0 s0 h1 b1 c0', c: 'k0 s1 h1 b0 l0 d', x: 'l1 d P1', u: 'k0 h1 b1 d roll P1', e: 'k0 s1 h1 b0 l1 d P1' }, form: 'iabcxucceabc' }),
      st({ name: 'COSMOS', fq: '102.3', vol: 0.94, genre: 'DISCO SPATIAL', bpm: 116, cv: 1.35, gamme: 'majeur', sw: 0.06, key: 55, kit: 'disco', eq: [-5, 1800, 1, 5], rev: 0.18, echo: [3, 0.24], pump: 0.6, pumpT: 0.26, lO: -12, cO: -12, mx: { b: 0.8 }, // French touch spatiale façon Space / Air / Daft Punk : batterie de disco qui respire sous la pompe, basse ronde qui glisse, piano électrique, cocotte discrète, cloches à écho, thème au synthé à portamento dans le médium
        prog: ['Am7 D7 GM7 CM7 Am7 D7 Em7 Em7', 'CM7 D7 Bm7 Em7'], k: [F4], s: [SN, '....x..g....x...'], h: [OFF, 'xxoxxxoxxxoxxxox'], 
        b: ['bMoog', '0 - - 0 . 7 . 0 - - 0 . 10 . 7 . | 0 - - 0 . 7 . 0 - - 12 . 10 . 7 5', '0 - - - - - - - 7 - - - - - - -'], d: ['choeur', 0], c: ['epFM', '..x...x...x..x..', 'x.....x.........'], 
        l: ['ldMoog', '14 - - - 12 - 14 - 17 - - - 14 - - - | 19 - - - 17 - 19 - 23 - - - 19 - - - | 23 - - - 21 - 19 - 16 - - - 19 - - - | 21 - - - 19 - 17 - 16 - - - . - - - | 26 - - - 24 - 26 - 29 - - - 26 - - - | 31 - - - 29 - 26 - 23 - - - 26 - - - | 28 - - - 26 - 24 - 23 - - - 21 - - - | 19 - - - - - - - . - - - - - - -',
          '24 - - - 21 - 19 - 17 - - - 19 - - - | 26 - - - 23 - 21 - 19 - - - 21 - - - | 28 - - - 26 - 23 - 19 - - - 23 - - - | 21 - - - 19 - 16 - 12 - - - . - - -'],
        sec: { i: 'h0 d lo', a: 'k0 s0 h0 b1 d', b: 'k0 s0 h1 b0 c0', c: 'k0 s0 h1 b0 l0 d', x: 'l1 d P1', u: 'k0 h1 b1 d roll P1', e: 'k0 s1 h1 b0 l1 d P1' }, form: 'iabccxuceabc' }),
    ],
    canal: [
      st({ name: 'K-LOW', fq: '94.0', vol: 0.46, genre: 'G-FUNK', bpm: 104, cv: 1.25, gamme: 'mineur', emprunts: 'D7', sw: 0.1, key: 55, kit: 'k808', sMin: 0.45, eq: [7, 450, -4, 3], rev: 0.12, echo: [3, 0.21], pump: 0.9, // façon Dr. Dre / Warren G : posé, TR-808, caisse claire en avant, basse ronde qui glisse, sifflement de synthé à portamento
        prog: ['Gm7 Gm7 Cm7 Cm7 Gm7 Gm7 EbM7 D7', 'EbM7 D7 Gm7 Gm7'], k: ['x......x..x.....', 'x..x...x..x...x.'], s: [SN], h: ['x.x.x.x.x.x.x.x.', 'x.x.x.xxx.x.x.o.'], 
        b: ['bMoog', '0 - - - - - 0 - - - 7 - 10 - 12 - | 0 - - - - - 0 - 12 - 10 - 7 - 5 3', '0 - - - - - - - 0 - - - - - 7 -'], d: ['warm', 0], c: ['epFM', '..x.......x..x..', 'x.......x.......'],
        l: ['ldWhistle', '31 - - - - - 34 - 36 - - - 34 - 31 - | 29 - - - - - 27 - 31 - - - - - - - | 32 - - - - - 34 - 36 - - - 39 - 36 - | 34 - - - - - 32 - 29 - - - - - - - | 38 - - - - - 36 - 34 - - - 31 - 34 - | 36 - - - - - - - 31 - - - - - - - | 39 - - - - - 36 - 34 - - - 32 - 34 - | 35 - - - - - 38 - 41 - - - - - - -',
          '32 - - - 36 - - - 39 - - - 36 - - - | 31 - - - 35 - - - 38 - - - 41 - - - | 43 - - - - - 41 - 38 - - - 36 - - - | 34 - - - - - - - 31 - - - - - - -'],
        sec: { i: 'h0 c1', a: 'k0 s0 h0 b1 c0', b: 'k0 s0 h1 b0 c0', c: 'k1 s0 h1 b0 l0 d', x: 'l1 d P1', e: 'k1 s0 h1 b0 l1 d P1' }, form: 'iabccxecabcc' }),
      st({ name: '808 BOULEVARD', fq: '102.9', vol: 0.55, genre: 'ELECTRO-FUNK', bpm: 122, cv: 1.9, gamme: 'mineur', key: 62, kit: 'k808', eq: [-2, 2800, 0, 4], rev: 0.05, lO: -12, lV: 2.2, echo: [2, 0.18], pump: 1, sw: 0.06, mx: { h: 0.4, k: 1.25 }, // au refrain, la basse reste sur sa ligne de couplet, au timbre rond (sa ligne mélodique en impulsions sonnait comme un second thème criard) ; thème au carré d'électro, simple et net (ni le talkbox ni le synthé à glissé n'allaient), dans le médium (do 4 à la 4 ; plus haut, il était trop aigu), en appels et réponses ; charlestons à −8 dB, grosse caisse de 808 qui gronde, cloche de 808 et swing pour le groove ; façon Egyptian Lover / Zapp : TR-808 sèche et syncopée, cloche, basse séquencée, voix de vocodeur, talkbox
        prog: ['Dm Dm Dm Dm Dm Dm C C', 'Bb Bb C C'], k: ['x..x..x...x.x...', 'x..x..x..xx.x..x', 'x.....x...x.....', 'x..x......x..x..'], s: [CP, '....c..c....c.c.'], h: ['xxXxxxXxxxXxxxox', 'x.x.x.x.x.x.x.o.'], p: ['..c...c...c..c..', 'c..c..c..c..c.c.'], 
        b: ['bMoog', '0 - 0 - 12 - 0 - 0 - 0 12 - 0 10 -'], aO: -12, a: ['arpRond', '0.2.1.2.0.2.1.3.', '0120012001200120'],
        l: ['ldElectro', '12 - - 12 - - 15 - - - 12 - - - . - | 10 - - - 12 - - - . - - - . - - - | 12 - - 12 - - 15 - - - 17 - - - . - | 19 - - - 17 - - - 15 - - - . - - - | 12 - - 12 - - 15 - - - 12 - - - . - | 10 - - - 12 - - - 15 - - - 17 - - - | 19 - - - - - 17 - 14 - - - - - - - | 12 - - - 10 - - - . - - - - - - -',
          '15 - - - 17 - - - 15 - - - 12 - - - | 10 - - - - - - - . - - - 8 - 10 - | 12 - - - 14 - - - 17 - - - 14 - - - | 12 - - - - - - - . - - - - - - -'],
        sec: { i: 'k2 h1 a0', a: 'k0 s0 h1 b0 a0', b: 'k3 s0 h0 b0 a0 p0', c: 'k1 s1 h0 b0 l0 p0', x: 'h1 l1 P1', u: 'k0 h0 b0 a1 roll P1', e: 'k1 s1 h0 b0 l1 P1 p1' }, form: 'iabcbxucecbc' }),
      st({ name: 'HIGH DESERT', fq: '66.6', vol: 1.79, genre: 'ROCK DU DESERT', bpm: 104, sw: 0.1, cv: 1.1, gamme: 'mineur', emprunts: 'G', key: 48, kit: 'rock', eq: [-4, 1500, 3, 1], rev: 0.21, echo: [3, 0.21], pump: 1, fz: 0.2, mx: {  }, // rock du désert, entre western et blues touareg : batterie ronde un peu chaloupée, basse au médiator, guitare claire grattée, thème à la guitare twang dans l'écho, accord de do mineur à dominante majeure (sol) ; la guitare saturée seulement au refrain, à peine poussée
        prog: ['Cm Cm Ab G Cm Cm Bb G', 'Fm Ab Bb G'], k: ['x.....x.x.....x.', 'x..x..x...x..x..'], s: ['....x..g....x..g', '....x..g....x.gx'], h: ['x.x.x.x.x.x.x.o.', 'r.r.r.r.r.r.r.r.'], 
        b: ['bCorde', '0 - - 0 - - 7 - 0 - - 0 - 3 - 5 | 0 - - 0 - - 7 - 10 - - 7 - 5 - 3', '0 - - - - - 0 - 7 - - - 0 - - -'], c: ['gtrClean', 'x..x..x...x.x...', 'x.....x.x.......'], cO: -12, 
        l: ['ldTwang', '19 - - - 17 - 15 - 14 - 15 - . - - - | 12 - - - - - - - . - 15 - 17 - 19 - | 20 - - - 19 - 17 - 15 - - - 12 - - - | 14 - - - 11 - - - 7 - - - . - - - | 19 - - - 22 - 24 - 22 - 19 - . - - - | 15 - - - - - 14 - 12 - - - . - - - | 17 - - - 14 - 14 - 14 - 17 - 22 - - - | 23 - - - - - - - 19 - - - - - - -',
          '24 - - - 20 - - - 17 - - - 20 - - - | 27 - - - 24 - - - 20 - - - 24 - - - | 26 - - - 22 - - - 17 - - - 22 - 26 - | 23 - - - - - - - 26 - - - . - - -'],
        sec: { i: 'b1 c1 lo', a: 'k0 s0 h0 b0 c0', b: 'k0 s0 h0 b0 c0', c: 'k1 s1 h1 b0 l0', x: 'h1 b1 l1 P1', e: 'k1 s1 h1 b0 l1 P1', q: 'k0 s0 h1 b0 c0' }, form: 'iabcqxecabcc' }),
    ],
    stade: [
      st({ name: 'ARENA ROCK FM', fq: '105.5', vol: 0.74, genre: 'HARD ROCK', bpm: 140, gamme: 'mineur', bPar: [0, 3, 5, 7, 10, -2], key: 52, kit: 'rock', eq: [3, 500, 3, -5], lO: -12, lV: 1.6, rev: 0.21, echo: [3, 0.24], pump: 1, // rock de stade : accords de puissance, batterie dans sa salle, thème aux cuivres de synthé façon années 80 (la guitare saturée ne collait pas), accords en retrait. Registre grave : thème une octave plus bas, médium-aigu rentré (elle criait)
        prog: ['E5 E5 G5 A5 E5 E5 C5 D5', 'C5 D5 E5 E5'], k: ['x.....x.x.....x.', 'x..x..x.x..x..x.', 'x...x...x...x...'], s: [SN, '....x.......x.xx'], h: ['X.x.X.x.X.x.X.x.', 'o.o.o.o.o.o.o.o.', 'r.r.r.r.r.r.r.r.'], 
        b: ['bPick', '0 - 0 - 0 - 0 - 0 - 0 - 0 - 3 5', '0 0 0 0 0 0 0 0 0 0 0 0 7 7 10 10'], c: ['pwr', 'x..x..x...x.x...', 'x.......x.......'], cO: -12, fz: 0.15, mx: { c: 0.4, h: 0.5 }, g: ['gtrMute', 'x.x.x.x.x.x.x.x.'],
        l: ['ldBrass', '24 - - - 27 - 24 - 22 - 24 - - - . - | 24 - - - 27 - 29 - 31 - - - 27 - - - | 22 - - - 26 - 22 - 19 - 22 - - - . - | 22 - - - 24 - 29 - 34 - - - 31 - - - | 24 - - - 22 - 19 - 22 - 24 - - - . - | 24 - - - 27 - 24 - 22 - - - 19 - - - | 19 - - - 24 - 19 - 15 - 19 - - - . - | 22 - - - 19 - - - 14 - - - - - - -',
          '19 - 15 - 12 - 15 - 19 - 24 - 19 - - - | 22 - 17 - 14 - 17 - 22 - 26 - 22 - - - | 24 - - 19 - - 15 - 19 - - - 24 - - - | 24 - - - - - - - . - - - - - - -'],
        sec: { i: 'h0 g0', a: 'k0 s0 h0 b0 g0', b: 'k0 s0 h1 b0 c0', c: 'k1 s1 h1 b0 l0', x: 'h2 b1 l1 P1', e: 'k1 s1 h1 b1 l1 P1', q: 'k2 s0 h2 b1 c1' }, form: 'iabcqxecabcc' }),
      st({ name: 'TRIBUNE NORD', fq: '91.9', vol: 1.37, genre: 'FANFARE FUNK', bpm: 108, gamme: 'mineur', emprunts: 'D', sw: 0.12, key: 55, kit: 'acou', eq: [3, 900, 2, -2], rev: 0.18, echo: [3, 0.24], pump: 1, lO: -12, lV: 0.22, mx: {  }, // thème et cuivres une octave plus bas ; le thème est joué par l'orgue de la nappe, dont le niveau (0,9) est celui d'un accompagnement : lV le ramène à celui d'un thème // l'orgue de la patinoire et la fanfare des supporters : orgue, cuivres plaqués, clavinet, cloche et tambourin
        prog: ['Gm Gm Cm D Gm Gm Eb D', 'Cm D Gm Gm'], k: ['x..x..x...x..x..', 'x.....x..xx.....'], s: ['....x..g.g..x..g', '....x..g....x.xx'], h: ['x.x.x.x.x.x.x.o.', 'b.x.x.b.x.x.b.x.'], 
        b: ['bSlap', '0 - - 0 - 12 - 0 - - 7 - 12 - 0 - | 0 - - 0 - 12 - 0 - 12 - 7 - 12 - 7', '0 - - - - - 0 - - - 12 - - - 7 -'], d: ['organ', 0], g: ['clav', '..x..x.x..x..x.x'],
        l: ['organ', '19 - - 22 - - 19 - 17 - 19 - - - . - | 19 - - 22 - - 24 - 26 - - - 22 - - - | 24 - - 27 - - 24 - 22 - 24 - - - . - | 26 - - 23 - - 19 - 14 - - - 19 - - - | 31 - - 34 - - 31 - 29 - 31 - - - . - | 31 - - 29 - - 26 - 22 - - - 26 - - - | 27 - - 31 - - 27 - 27 - 27 - - - . - | 31 - - 26 - - 23 - 19 - - - - - - -',
          '24 - 27 - 31 - 27 - 24 - 27 - 31 - - - | 26 - 31 - 35 - 31 - 26 - 31 - 35 - - - | 31 - - 26 - - 22 - 26 - - - 31 - - - | 34 - - - - - - - . - - - - - - -'],
        sec: { i: 'h1 d', a: 'k0 s0 h0 b1 g0', b: 'k0 s0 h0 b0 d', c: 'k1 s1 h1 b0 l0 d', x: 'l1 d P1', e: 'k1 s1 h1 b0 l1 P1' }, form: 'iabccxecabcc' }),
      st({ name: 'KOP 170', fq: '170', vol: 1.47, genre: 'HAPPY HARDCORE', bpm: 170, gamme: 'majeur', key: 60, kit: 'k909', eq: [-6, 3200, 2, 5], rev: 0.15, echo: [3, 0.21], pump: 0.3, lO: -24, // thème aux scies deux octaves plus bas qu'écrit (mi 4 à mi 5 : il montait au mi 7), la voix chante les accords en chœur (en solo elle sonnait faux), aigus moins poussés ; grosse caisse à tous les temps, basse à contretemps, piano plaqué, thème majeur que tout le virage reprend
        prog: ['C G Am F C G F G', 'F G Am Am'], k: [F4], s: [CP, '....c.......c.cc'], h: [OFF, 'x.o.x.o.x.o.x.o.'],
        b: ['bOff', '. . 0 - . . 0 - . . 0 - . . 0 -', '. 0 0 0 . 0 0 0 . 0 0 0 . 0 0 0'], d: ['choeur', 0], 
        l: ['ldSaw', '28 - - - 31 - 28 - 24 - - - 28 - - - | 26 - - - 31 - 26 - 23 - - - 26 - - - | 24 - - - 28 - 24 - 21 - - - 24 - - - | 24 - - - 29 - 24 - 21 - - - . - - - | 28 - - - 31 - 36 - 31 - - - 28 - - - | 26 - - - 31 - 35 - 31 - - - 26 - - - | 29 - - - 33 - 29 - 24 - - - 29 - - - | 31 - - - 35 - - - 38 - - - - - - -',
          '29 - - - - - - - 28 - - - - - - - | 31 - - - - - - - 29 - - - - - - - | 33 - - - - - - - 31 - - - - - - - | 33 - - - - - - - . - - - - - - -'],
        sec: { i: 'd lo', a: 'k0 h0 b0 d', b: 'k0 s0 h1 b0 d', c: 'k0 s1 h1 b1 l0 d', x: 'l1 d P1', u: 'k0 h1 b0 d roll P1', e: 'k0 s1 h1 b1 l1 P1' }, form: 'iabcxucceabc' }),
    ],
    givre: [
      st({ name: 'RADIO VERGLAS', fq: '88.1', vol: 1.33, genre: 'COLD WAVE', bpm: 132, gamme: 'mineur', key: 57, kit: 'lin', eq: [-4, 2200, 3, 6], rev: 0.24, echo: [3, 0.21], pump: 0.9, // thème lié (il sonnait sec) ; boîte à rythmes sèche, basse au médiator qui porte le morceau, guitare claire arpégée, chœur froid : la montée du col, phares allumés
        prog: ['Am F C Em Am F Dm Em', 'F G Am Am'], k: ['x.....x.x.....x.', 'x...x...x...x...'], s: [SN, '....x.......x.xx'], h: ['x.x.x.x.x.x.x.x.', 'xxXxxxXxxxXxxxXx'],
        b: ['bPick', '0 - 0 - 0 - 0 - 0 - 0 - 7 - 0 -', '0 0 0 0 0 0 0 0 0 0 0 0 7 7 12 12'], d: ['choir', 0], a: ['pluck', '0.2.4.2.1.2.4.2.', '0124210201242102'],
        l: ['ldFroid', '12 - - - 15 - - - 19 - - - 15 - - - | 17 - - - 20 - - - 24 - - - 20 - - - | 19 - - - 15 - - - 12 - - - 15 - - - | 19 - - - - - - - 22 - - - 19 - - - | 24 - - - 22 - - - 19 - - - 15 - - - | 20 - - - 17 - - - 24 - - - 20 - - - | 22 - - - 20 - - - 17 - - - 14 - - - | 19 - - - - - - - . - - - - - - -',
          '24 - 27 - 31 - 27 - 24 - 27 - 31 - - - | 20 - 24 - 29 - 24 - 20 - 24 - 29 - - - | 27 - - - 24 - - - 22 - - - 19 - - - | 24 - - - - - - - . - - - - - - -'],
        sec: { i: 'b0 a0 lo', a: 'k0 s0 h0 b0 a0', b: 'k0 s0 h0 b0 d', c: 'k1 s0 h1 b1 l0 d', x: 'l1 d P1', u: 'k1 h1 b1 d roll P1', e: 'k1 s1 h1 b1 l1 P1' }, form: 'iabcxuceabcc' }),
      st({ name: 'POLAIRE 118', fq: '118', vol: 1.2, genre: 'DUB TECHNO', bpm: 118, gamme: 'mineur', sw: 0.06, key: 62, kit: 'k909', eq: [5, 700, -3, -4], rev: 0.27, echo: [3, 0.36], pump: 0.5, // un accord mineur plaqué que l'écho répète jusqu'à s'éteindre, basse ronde, shaker : pas de thème, la route déserte avant le jour
        prog: ['Dm7 Dm7 Gm7 Gm7 Dm7 Dm7 BbM7 Am7', 'Gm7 Am7 Dm7 Dm7'], k: [F4, 'x...x...x...x..x'], s: ['....r.......r...', CP], h: [OFF, 'x.oxx.oxx.oxx.ox'], 
        b: ['bSeq', '0 - - - - - 0 - - - 0 - - - 7 -', '0 - - 0 - - 0 - - 0 - - 12 - 7 -'], c: ['stabM7', 'x.....x.........', '..x...x...x...x.'], 
        sec: { i: 'k0 c0 lo', a: 'k0 h0 b0 c0', b: 'k0 s0 h0 b0 c0', c: 'k1 s0 h1 b1 c1', x: 'c0 P1', u: 'k0 h1 b0 c1 roll P1', e: 'k1 s1 h1 b1 c1 P1' }, form: 'iabcbxucecbc' }),
      st({ name: 'REFUGE FM', fq: '94.4', vol: 0.7, genre: 'SYNTH-POP', bpm: 120, gamme: 'majeur', key: 60, kit: 'lin', eq: [2, 1800, 2, 6], rev: 0.18, echo: [3, 0.18], pump: 0.7, // majeur et chaud : basse ronde, piano électrique, cordes, refrain en dents de scie ; le poêle du refuge, en haut du col
        prog: ['C G Am F C G F G', 'F G Em Am'], k: [F4, 'x...x...x..xx...'], s: [SN, CP], h: [OFF, 'x.x.x.x.x.x.x.o.'], 
        b: ['bMoog', '0 - 0 - 12 - 0 - 0 - 0 - 12 - 7 -', '0 0 12 0 0 12 0 12 0 0 12 0 7 12 0 12'], d: ['strings', 0], c: ['epFM', '..x...x..x....x.', 'x.......x.......'], cO: -12, mx: { c: 0.7 }, 
        l: ['ldSaw', '16 - - - 19 - - - 24 - - - 19 - - - | 14 - - - 19 - - - 23 - - - 19 - - - | 12 - - - 16 - - - 21 - - - 16 - - - | 17 - - - 21 - - - 24 - - - - - - - | 28 - - - 24 - - - 19 - - - 16 - - - | 26 - - - 23 - - - 19 - - - 14 - - - | 21 - - - 24 - - - 29 - - - 24 - - - | 26 - - - - - - - 31 - - - - - - -',
          '24 - 28 - 31 - 28 - 24 - 28 - 31 - - - | 26 - 31 - 35 - 31 - 26 - 31 - 35 - - - | 28 - - - 23 - - - 19 - - - 23 - - - | 24 - - - - - - - . - - - - - - -'],
        sec: { i: 'h0 d lo', a: 'k0 s0 h0 b0 c0', b: 'k0 s0 h1 b0 c0', c: 'k1 s1 h1 b1 l0 d', x: 'l1 d P1', u: 'k0 h1 b0 d roll P1', e: 'k1 s1 h1 b1 l1 P1' }, form: 'iabcxuceabcc' }),
    ],
    terre: [
      st({ name: 'RADIO CAILLOU', fq: '88.8', vol: 0.77, genre: 'PUNK ROCK', bpm: 176, gamme: 'majeur', key: 57, kit: 'rock', eq: [-2, 1500, 2, 0], rev: 0.12, echo: [3, 0.24], pump: 1, lO: -24, mx: { c: 0.5, g: 0.3 }, // thème deux octaves plus bas qu'écrit, à la guitare légèrement saturée et sombre (la guitare fuzz sifflait), accords en retrait // trois accords de puissance en majeur, tout droit, batterie à fond : la radio de l'assistance
        prog: ['A5 A5 D5 E5 A5 F#5 D5 E5', 'D5 E5 F#5 E5'], k: ['x.....x.x.....x.', 'x..x..x.x..x..x.', 'x.x.x.x.x.x.x.x.'], s: [SN, '....x.......x.xx'], h: ['X.X.X.X.X.X.X.o.', 'r.r.r.r.r.r.r.r.'],
        b: ['bPick', '0 0 0 0 0 0 0 0 0 0 0 0 0 0 7 7', '0 - 0 - 0 - 0 - 0 - 0 - 7 - 12 -'], c: ['pwr', 'x.x.x.x.x.x.x.x.', 'x.....x.....x...'], cO: -12, g: ['gtrMute', 'x.xxx.xxx.xxx.xx'],
        l: ['ldCrunch', '28 - 28 - 26 - 24 - 26 - 28 - 31 - - - | 28 - 28 - 28 - 26 - 28 - - - 24 - - - | 28 - 28 - 26 - 24 - 26 - 28 - 33 - - - | 31 - - - 28 - - - 26 - - - . - - -',
          '36 - 36 - 33 - 31 - 33 - - - 31 - - - | 33 - 31 - 29 - 28 - 29 - - - 28 - - - | 31 - 33 - 35 - 36 - 38 - - - 36 - - - | 40 - - - - - - - . - - - - - - -'],
        sec: { i: 'h0 g0', a: 'k0 s0 h0 b0 g0', b: 'k1 s0 h0 b0 c1', c: 'k2 s1 h0 b0 l0', x: 'h1 b1 l1 P1', e: 'k2 s1 h0 b1 l1 P1', q: 'k1 s0 h1 b1 c1' }, form: 'iabcqxecabcc' }),
      st({ name: 'SKA DES PINS', fq: '93.3', vol: 1.7, genre: 'SKA', bpm: 150, gamme: 'mineur', key: 62, kit: 'acou', lO: -12, lV: 0.85, mx: { h: 0.5 }, eq: [2, 1000, 5, 1], rev: 0.15, echo: [3, 0.24], pump: 1, // saxophone une octave plus bas (il criait) ; guitare à contretemps, orgue, riff de cuivres et saxophone : le bal du village un soir de rallye
        prog: ['Dm Gm C F Dm Gm Bb C', 'Bb C Dm Dm'], k: ['x.......x.......', 'x.....x.x.....x.'], s: [SN, '....x..g....x.xx'], h: [OFF, 'x.x.x.x.x.x.x.o.'], 
        b: ['bSlap', '0 - - 0 - - 7 - 0 - - 0 - 7 12 -', '0 - 0 - 7 - 7 - 12 - 12 - 7 - 7 -'], d: ['organ', 0], c: ['gtrMute', '..x...x...x...x.', '..xx..xx..xx..xx'], 
        l: ['ldSax', '24 - . 24 - . 27 - 26 - 24 - 22 - - - | 22 - . 22 - . 26 - 24 - 22 - 19 - - - | 19 - . 22 - . 24 - 26 - - - 24 - - - | 24 - - - 19 - - - 17 - - - . - - - | 24 - . 24 - . 27 - 29 - 27 - 26 - - - | 26 - . 26 - . 29 - 31 - 29 - 26 - - - | 29 - . 27 - . 27 - 24 - - - 22 - - - | 24 - - - 26 - - - 24 - - - - - - -',
          '29 - - 27 - - 24 - 27 - - - 29 - - - | 31 - - 29 - - 26 - 29 - - - 31 - - - | 34 - - 31 - - 29 - 26 - - - 29 - - - | 26 - - - - - - - . - - - - - - -'],
        sec: { i: 'h0 c0', a: 'k0 s0 h0 b0 c0', b: 'k0 s0 h0 b1 c0', c: 'k1 s1 h1 b0 l0', x: 'l1 d P1', e: 'k1 s1 h1 b1 l1 P1' }, form: 'iabccxecabcc' }),
      st({ name: 'GARRIGUE FM', fq: '101.5', vol: 1.95, genre: 'RUMBA GITANE', bpm: 112, sw: 0.04, gamme: 'mineur', emprunts: 'E', key: 57, kit: 'acou', eq: [0, 2000, 1, 0], rev: 0.18, echo: [3, 0.15], pump: 1, cO: -12, // rumba gitane, le soir dans la garrigue : guitare à cordes de nylon grattée, palmas, basse ronde, thème à la guitare sur la cadence andalouse (la mineur, sol, fa, mi majeur)
        prog: ['Am G F E Am G F E', 'Dm Am F E'], k: ['x.....x...x.....', 'x.....x.x.....x.'], s: ['....c.......c...', '....c..c....c..c'], h: ['x.x.x.x.x.x.x.x.'],
        b: ['bCorde', '0 - - 0 - - 7 - 0 - - 0 - - 7 -', '0 - - - 7 - - - 0 - - - 7 - 5 -'], c: ['gtrNylon', 'x..x..x.x..x..x.', 'x.......x.......'],
        l: ['ldNylon', '12 - - - 15 - 14 - 12 - - - 10 - 12 - | 14 - - - 12 - 10 - - - - - . - - - | 12 - - - 10 - 8 - - - 7 - 8 - 10 - | 11 - - - - - 14 - 11 - - - 7 - - - | 12 - - - 15 - 17 - 19 - - - 17 - 15 - | 14 - - - 17 - 14 - 10 - - - . - - - | 15 - - - 12 - 10 - 8 - - - 7 - 8 - | 11 - - - 7 - - - - - - - . - - -',
          '17 - - - 15 - 14 - 17 - - - . - - - | 15 - - - 14 - 12 - 15 - - - . - - - | 12 - - - 10 - 8 - 12 - - - 10 - 8 - | 7 - - - - - - - . - - - - - - -'],
        sec: { i: 'c1 lo', a: 'k0 s0 h0 b0 c0', b: 'k0 s1 h0 b1 c0', c: 'k1 s0 h0 b0 c1 l0', x: 'c1 l1 P1', u: 'k0 h0 b1 c0 roll P1', e: 'k1 s1 h0 b0 c1 l1 P1' }, form: 'iabcxucceabc' }),

    ],
  };

  // Éditeur de musique (editeur.html) : ses réglages, par nom de station, sont enregistrés dans localStorage « vpr.musique » et appliqués par-dessus
  // les valeurs écrites ici (champs MUS.cles, dans leur forme déjà lue : motifs découpés en mesures, accords par leur nom). Sans effet sous node.
  G.MUS = { accorder, GAMME, QUAL, R, RADIO, cles: ['vol', 'bpm', 'sw', 'pump', 'rev', 'echo', 'eq', 'drive', 'cv', 'lV', 'lO', 'kit', 'mx', 'accords', 'k', 's', 'h', 'p', 'b', 'd', 'c', 'g', 'a', 'l', 'sec', 'form'] };
  G.MUS.origine = {}; for (const id in RADIO) for (const o of RADIO[id]) G.MUS.origine[o.name] = JSON.stringify(G.MUS.cles.map(k => o[k])); // valeurs du dépôt, pour comparer avant / après dans l'éditeur
  try { const s = JSON.parse(localStorage.getItem('vpr.musique')) || {}; for (const id in RADIO) for (const o of RADIO[id]) if (s[o.name]) { Object.assign(o, s[o.name]); accorder(o); } } catch (e) { }

  G.CARTES = [
    { id: 'ville', nom: 'VILLE A PLEIN REGIME', camH: 3.8, W: 9, kmh: 0.71, vit: [168, 193], grip: 44, sc: 0.85, tun: [6, 12], chaud: [6, 12], sect: [6, 12], amb: [[2, 5], [13, 15]], // pluie et rumeur : la grande courbe d'avant le tunnel, et la sortie
      pts: [[0, 0, 0], [220, 0, 0], [420, 10, 4], [560, 90, 10], [600, 240, 12], [520, 370, 6], [360, 400, -2], [230, 340, -10], [110, 400, -14], [0, 520, -14], [-150, 560, -10], [-300, 500, -4], [-360, 360, 2], [-300, 240, 8], [-380, 120, 6], [-330, 10, 2], [-180, 0, 0]],
      // Nismo Skyline GT-R Z-tune (R34, 6 cylindres en ligne biturbo « Z2 » de 2,8 L, boîte Getrag 6 rapports) : données constructeur
      car: { nom: 'RAIJIN GT-Z', ratios: [3.827, 2.360, 1.685, 1.312, 1.000, 0.793], final: 3.545, // démultiplications
        wheel: 0.326, mass: 1675, eff: 0.85, // rayon de roue (m) ; 1600 kg + pilote ; ~15 % de pertes de transmission (4 roues motrices)
        idle: 950, red: 8000, cd: 0.34, area: 2.1, // ralenti, zone rouge (tr/min) ; aérodynamique
        tq: [0, 200, 330, 450, 520, 540, 535, 505, 420], // couple (N·m) tous les 1000 tr/min : 540 N·m à 5200, 500 ch à 6800 (forme de la courbe estimée)
        up: 7500, down: 6200, trac: 11, rwd: 0, son: 1, moteur: 'l6', turbo: 1, // 4 roues motrices : ~1,1 g de motricité, pas de survirage à l'accélérateur
        look: { type: 'gtr', col: 0xff2030, l: 1, w: 1, h: 1, nez: 0.62, cab: [-0.5, 2.1, 0.5], aileron: 1, neon: 0x00f0ff } },
      radio: RADIO.ville,
      th: { decor: 'ville', fog: 0x1f0a36, fogD: [60, 800], sky: [[0, '#03020a'], [0.36, '#120a2e'], [0.47, '#5a1058'], [0.5, '#1f0a36'], [1, '#1f0a36']], stars: 140,
        astre: { dir: [0.45, 0.8, 0.4], col: '#d8e8ff', ombre: '#a8b8e0', taille: 170 }, hemi: [0x5a6cff, 0xff2a6a, 0.55], sun: [0x8fb0ff, 0.35], phares: 2.6, bloom: 0.13, scan: 0.12,
        pluie: 1, orage: 1, alarme: 1, chev: 1, piles: -61, tubes: 1, reflets: '#004a54', pubs: 1, murH: 1.4,
        route: ['#2c2c3a', '#383848', '#fcee0a', '#d8d8e0', '#fcee0a', '#08080c', true], mur: ['#12121a', '#00f0ff', '#fcee0a', '#0a0a10'], depart: [0xfcee0a, 0x00f0ff, '#fcee0a'],
        tun: { sol: ['#101018', '#1a1a24', '#00f0ff', '#fcee0a', '#00f0ff', '#08080c'], murs: ['#ff003c', '#fcee0a'], paroi: ['#140406', '#3a0a10', '#5a1018', '#080203'], plafond: ['#0c0304', '#ff5a6a', '#ffd84a', '#3a0a10'],
          fog: 0x2a0308, portail: 0xfcee0a, neons: [0xfcee0a, 0xff003c], reflets: ['#5a0016', '#4a4404'], coque: 80 }, // chaussée sombre et neutre, rives cyan, reflets éteints : la route se détache des parois rouges (elle se confondait avec elles)
        hud: { y: '#fcee0a', c: '#00f0ff', r: '#ff003c', fond: 'rgba(8,8,12,.82)', style: 'cyber', split: 1, jp: ['ラップ', 'スピード'], sur: ['夜間タイムアタック', 'CONTRE-LA-MONTRE NOCTURNE'], titre: ['VILLE À', 'PLEIN REGIME'] } } },

    // Touge : départ en descente, montée à 13 %, plateau du carrefour (supérette et station-service), puis quatre épingles empilées à 10 %. Adhérence de vraie route (2 g avec des pneus de course), route étroite.
    { id: 'touge', nom: 'KARASU-TOGE', W: 6, kmh: 0.73, vit: [172, 190], grip: 21, sc: 1, tun: null, chaud: [14, 40], sect: [10, 40], amb: [[10, 13], [41, 45]], anticipe: 1, // forêt : le plateau du carrefour au sommet, et le bas des épingles
      pts: [[0, 0, 20], [150, 0, 14], [300, -40, 10], [430, -10, 22], [560, -70, 38], [700, -40, 56], [820, 40, 74], [860, 170, 92], [800, 290, 108], [840, 400, 122], [790, 500, 132], [720, 580, 135], [640, 610, 135], [570, 580, 133], [542, 520, 130], [540, 430, 121], [540, 345, 112], [534, 331, 111], [520, 325, 110], [506, 331, 109], [500, 345, 108], [500, 430, 99], [500, 515, 90], [494, 529, 89], [480, 535, 88], [466, 529, 87], [460, 515, 86], [460, 430, 77], [460, 345, 68], [454, 331, 67], [440, 325, 66], [426, 331, 65], [420, 345, 64], [420, 430, 55], [420, 515, 46], [414, 529, 45], [400, 535, 44], [386, 529, 43], [380, 515, 42], [380, 430, 33], [372, 350, 26], [335, 285, 22], [250, 250, 18], [150, 275, 16], [50, 300, 22], [-60, 260, 19], [-150, 180, 18], [-200, 80, 18], [-140, 5, 19]],
      // Mazda RX-7 Spirit R Type A (FD3S, 2002) : birotor biturbo 13B-REW, 280 ch à 6500 tr/min, 314 N·m à 5000, 1270 kg, propulsion (rapports à vérifier sur fiche)
      car: car({ nom: 'TENGU R7 SPIRIT', ratios: [3.483, 2.015, 1.391, 1.000, 0.719], final: 4.1, wheel: 0.318, mass: 1345, idle: 900, red: 8000, cd: 0.31, area: 1.8,
        tq: [0, 150, 220, 270, 300, 314, 308, 290, 240], son: 1.5, moteur: 'rot', turbo: 1, look: { type: 'fd', col: 0xf4f0e0, l: 0.95, w: 0.96, h: 0.9, nez: 0.72, cab: [-0.35, 1.9, 0.48], aileron: 1 } }),
      radio: RADIO.touge,
      th: { decor: 'touge', fog: 0x0b1614, fogD: [45, 560], sky: [[0, '#02040a'], [0.4, '#0a1420'], [0.49, '#1a2a30'], [0.5, '#0b1614'], [1, '#0b1614']], stars: 240,
        astre: { dir: [-0.3, 0.75, 0.5], col: '#f4f8ff', ombre: '#c8d0e0', taille: 230 }, hemi: [0x7a96c0, 0x16302a, 0.55], sun: [0xbfd0ff, 0.5], phares: 3.2, bloom: 0.1, scan: 0.1,
        chev: 1, murH: 1.1, route: ['#26282c', '#34363c', '#e8e6da', '#ff8c1a', '#26282c', '#26282c', false], mur: ['#34363a', '#e8e6da', '#a8a69c', '#101214'], depart: [0xff8c1a, 0xe8e6da, '#e8e6da'],
        hud: { y: '#f4f0e0', c: '#ff8c1a', r: '#ff2a3a', fond: 'rgba(6,12,10,.84)', style: 'trait', jauge: 'aiguille', split: 0, jp: ['ラップ', 'スピード'], sur: ['烏峠ダウンヒル', 'DESCENTE DE NUIT'], titre: ['KARASU', 'TOGE'] } } },

    // Wangan : voie rapide du front de mer à fond, pont à haubans vers l'île du port, enfilade entre les conteneurs, tunnel immergé sous le chenal, retour en ville. Du trafic à doubler.
    { id: 'wangan', nom: 'WAN-9', W: 8, kmh: 0.92, vit: [210, 255], grip: 24, sc: 1, tun: [23, 28], chaud: [12, 22], sect: [8, 22], amb: [[8, 13]], anticipe: 1, trafic: 9, // port et corne de navire : du bout du pont aux premiers conteneurs
      pts: [[0, 0, 18], [400, 0, 18], [800, 0, 18], [1100, 10, 18], [1300, 60, 19], [1400, 180, 23], [1410, 310, 33], [1400, 440, 26], [1390, 550, 19], [1340, 660, 12], [1220, 730, 6], [1080, 740, 3], [940, 700, 2], [800, 760, 2], [660, 700, 2], [520, 770, 2], [380, 710, 2], [240, 780, 2], [100, 720, 2], [-60, 790, 2], [-220, 760, 2], [-400, 800, 2], [-540, 760, 0], [-610, 660, -5], [-620, 540, -13], [-620, 400, -15], [-610, 250, -15], [-620, 110, -14], [-620, -20, -9], [-600, -130, 0], [-520, -230, 9], [-380, -250, 15], [-240, -180, 18], [-150, -60, 18]],
      // Toyota Supra RZ (JZA80, 1997) : 6 en ligne biturbo 2JZ-GTE, fiche export 320 ch, 427 N·m à 4000 tr/min, 1510 kg, Getrag V160 (rapports à vérifier sur fiche)
      car: car({ nom: 'KAIRYU RZ', ratios: [3.827, 2.360, 1.685, 1.312, 1.000, 0.793], final: 3.266, wheel: 0.318, mass: 1585, idle: 800, red: 6800, cd: 0.32, area: 1.95,
        tq: [0, 180, 300, 400, 427, 420, 400, 340, 260], son: 0.95, moteur: 'l6', turbo: 1, look: { type: 'a80', col: 0x4a4e5c, l: 1.02, w: 1, h: 0.96, nez: 0.66, cab: [-0.45, 2.1, 0.5], aileron: 2 } }),
      radio: RADIO.wangan,
      th: { decor: 'wangan', pluie: [[9, 24, 3]], fog: 0x0c1424, fogD: [90, 1300], sky: [[0, '#02030a'], [0.38, '#0a1024'], [0.47, '#4a2c18'], [0.5, '#0c1424'], [1, '#0c1424']], stars: 40,
        astre: { dir: [0.5, 0.7, -0.4], col: '#e8e0d0', ombre: '#b8b0a0', taille: 120 }, hemi: [0x4a5a8a, 0xff9a2e, 0.55], sun: [0x8fa0d0, 0.25], phares: 2.4, bloom: 0.1, scan: 0.1,
        chev: 1, piles: -14, murH: 1.4, route: ['#24262e', '#30323c', '#f4f1e0', '#f4f1e0', '#24262e', '#24262e', false], mur: ['#3a3e46', '#c9ced6', '#ff9a2e', '#16181e'], depart: [0x1f8f5a, 0xc9ced6, '#f4f1e0'],
        tun: { sol: ['#2a2218', '#3a2e20', '#f4f1e0', '#f4f1e0', '#2a2218', '#2a2218'], murs: ['#ffb85a', '#ffb85a'], paroi: ['#3a2c18', '#6a5028', '#8a6a38', '#120e08'], plafond: ['#1a140c', '#ffb85a', '#ffb85a', '#3a2e20'],
          fog: 0x2a1a08, portail: 0x1f8f5a, neons: [0xff9a2e, 0xff9a2e], coque: 80 },
        hud: { y: '#ffffff', c: '#ffb85a', r: '#ff2a3a', fond: 'rgba(10,84,52,.92)', style: 'panneau', split: 0, jp: ['周回', '速度'], sur: ['湾岸九号線', 'LIGNE DE BAIE'], titre: ['WAN-9', 'BAYSHORE'] } } },

    // Paris à l'aube : circuit de rues, relances entre des angles, pavés.
    { id: 'paris', nom: 'PREMIER METRO', rivaux: ['LUCIE', 'MARC', 'INES'], W: 7, kmh: 0.62, vit: [156, 175], large: [[3, 7, 36], [7, 8, 11]], surf: { zones: [[3, 8, 'paves']], large: 'paves' }, place: { c: [450, 0], r: 121, a: 2.39, piles: [[-14.9, -7.6, 8, 3.8], [14.9, -7.6, 8, 3.8], [-14.9, 7.6, 8, 3.8], [14.9, 7.6, 8, 3.8]], ile: [48, 14] }, grip: 19, sc: 1, tun: [27, 30], chaud: [13, 22], amb: [[3, 7], [23, 26]], sect: [12, 25], anticipe: 1,
      pts: [[0, 0, 0], [200, 0, 0], [330, 15, 0], [420, 80, 0], [480, 80, 0], [524, 42, 0], [534, -15, 0], [505, -65, 0], [430, -160, 0], [420, -300, 2], [450, -390, 4], [540, -420, 6], [700, -420, 8], [810, -435, 12], [880, -480, 19], [860, -545, 26], [800, -590, 31], [830, -660, 37], [930, -670, 42], [1020, -630, 44], [1070, -540, 38], [1040, -410, 26], [1085, -280, 14], [1060, -150, 4], [1100, 0, 0], [1090, 140, -2], [1010, 225, -4], [800, 240, -6], [600, 250, -12], [400, 250, -12], [200, 240, -6], [0, 240, -3], [-150, 225, 0], [-235, 150, 0], [-235, 60, 0], [-150, 0, 0]],
      // Renault 5 Maxi Turbo (1985, Groupe B) : 4 cylindres turbo 1,5 L, 350 ch, 905 kg, moteur central arrière, propulsion (rapports estimés)
      car: car({ nom: 'LUTECE 5 TURBO MAXI', ratios: [3.36, 2.06, 1.38, 1.06, 0.82], final: 3.89, wheel: 0.29, mass: 980, idle: 1000, red: 7500, cd: 0.40, area: 1.9,
        tq: [0, 120, 220, 330, 400, 420, 400, 370, 300], son: 1.25, moteur: 'l4', turbo: 1, look: { type: 'r5', col: 0xf2c400, l: 0.8, w: 0.98, h: 1.12, nez: 0.3, cab: [-0.25, 2.3, 0.62], aileron: 0 } }),
      radio: RADIO.paris,
      th: { decor: 'paris', fog: 0xf0b89a, fogD: [140, 1500], sky: [[0, '#2b3a67'], [0.26, '#2b3a67'], [0.27, '#5a6a9a'], [0.38, '#5a6a9a'], [0.39, '#c08a9a'], [0.45, '#c08a9a'], [0.46, '#f0b89a'], [1, '#f0b89a']], stars: 0,
        astre: { dir: [0.8, 0.14, 0.3], col: '#fff0c0', ombre: '#fff0c0', taille: 260 }, hemi: [0xa8b8e8, 0xd9c9a8, 0.95], sun: [0xffc890, 0.75], phares: 0.5, bloom: 0.03, scan: 0.05,
        rues: [[0, 'boulevard'], [3, 'place'], [8, 'avenue'], [11, 'rue'], [13, 'ruelle'], [19, 'rue'], [24, 'avenue'], [26, 'berge'], [32, 'quai'], [33, 'boulevard']],
        murH: 0, route: ['#4a4a52', '#56565e', '#e8e4d8', '#e8e4d8', '#8a8478', '#8a8478', false], mur: ['#8a8478', '#b0a898', '#8a8478', '#6a665e'], depart: [0x1d2f6f, 0x2a7a4a, '#f4f0e0'],
        tun: { sol: ['#3a3a40', '#46464c', '#e8e4d8', '#e8e4d8', '#3a3a40', '#3a3a40'], murs: ['#dfeeff', '#dfeeff'], paroi: ['#b8b4a8', '#d8d4c8', '#8a867a', '#5a564e'], plafond: ['#3a3830', '#ffe9a0', '#ffe9a0', '#5a564e'], carreaux: 1,
          fog: 0x40382a, portail: 0x5d6b82, neons: [0xdfeeff, 0xdfeeff], coque: 14 }, // néon blanc froid, parois carrelées
        hud: { y: '#ffffff', c: '#ffd05a', r: '#ff6a5a', fond: 'rgba(24,44,110,.92)', style: 'plaque', jauge: 'aiguille', split: 0, jp: null, sur: [null, 'PARIS · 5 H 30'], titre: ['PREMIER', 'METRO'] } } },

    // Canal 6 : grand ovale à l'américaine au couchant, la piste serpente dans le lit du canal entre deux anneaux de tribunes pleines. Large, la carte de la glisse.
    { id: 'canal', nom: 'CANAL 6', rivaux: ['DRE', 'ROSA', 'CAL'], med: [1.06, 0.98, 0.9], W: 14, kmh: 0.68, vit: [230, 250], grip: 15, sc: 1, tun: null, chaud: [1, 8], amb: [[12, 17]], sect: [7, 19], anticipe: 1,
      pts: [[0, 0, -8], [250, -80, -8], [500, 90, -8], [750, -80, -8], [1000, 90, -8], [1250, -80, -8], [1500, 60, -8], [1720, 40, -8], [1825, 123, -5], [1828, 168, -3], [1803, 206, -1], [1760, 220, 2], [1500, 230, 4], [1300, 290, 4], [1100, 220, 4], [900, 290, 4], [700, 220, 4], [500, 290, 4], [300, 220, 4], [50, 240, 4], [-170, 230, 2], [-256, 156, -1], [-270, 110, -3], [-256, 64, -5], [-170, -10, -8]],
      // Dodge Viper GTS (1996) : V10 de 8,0 L, 450 ch à 5200 tr/min, 664 N·m à 3700, 1535 kg, propulsion, boîte T56 (rapports à vérifier sur fiche)
      car: car({ nom: 'SIDEWINDER GTS', ratios: [2.66, 1.78, 1.30, 1.00, 0.74, 0.50], final: 3.07, wheel: 0.333, mass: 1610, idle: 800, red: 6000, cd: 0.35, area: 1.9,
        tq: [0, 420, 560, 640, 664, 625, 540, 400, 0], son: 0.8, moteur: 'v10', look: { type: 'gts', col: 0x1848c8, l: 1.03, w: 1.05, h: 0.88, nez: 0.7, cab: [-0.95, 1.7, 0.46], aileron: 0, bandes: 0xf4f0e0 } }),
      radio: RADIO.canal,
      th: { decor: 'canal', fog: 0xe89060, fogD: [160, 1700], sky: [[0, '#3d2a5c'], [0.24, '#3d2a5c'], [0.25, '#7a4078'], [0.36, '#7a4078'], [0.37, '#d85a50'], [0.44, '#d85a50'], [0.45, '#ff9a4a'], [0.49, '#ff9a4a'], [0.5, '#e89060'], [1, '#e89060']], stars: 0,
        astre: { dir: [-0.85, 0.11, 0.35], col: '#fff4c0', ombre: '#fff4c0', taille: 340 }, hemi: [0xb898c8, 0xb8ad9a, 0.85], sun: [0xffa860, 0.9], phares: 0.4, bloom: 0.03, scan: 0.05, chaleur: 0.7, // chaleur : mirage au loin sur la route (game.js, AIR)
        murH: 1.3, route: ['#4c4a50', '#58565c', '#f4f0e0', '#2aa39a', '#e83f8c', '#f4f0e0', false], mur: ['#f4f0e0', '#e83f8c', '#1848c8', '#e4ddd0'], depart: [0xff7a3d, 0x3d2a5c, '#f4f0e0'],
        hud: { y: '#ffc04a', c: '#ff7a3d', r: '#e83f8c', fond: 'rgba(40,24,56,.9)', style: 'bloc', jauge: 'led', mph: 1, split: 0, jp: null, sur: [null, 'SPEEDWAY · HEURE DOREE'], titre: ['CANAL', 'SIX'] } } },

    // Grand Vacarme : une arène couverte, pleine à craquer. Trois lignes droites en épi sous la charpente, chacune avec son tremplin : la table de la ligne de départ,
    // le saut par-dessus la fosse (trop lent, on tombe dedans et on en ressort par sa rampe), la grande bosse du fond. Deux demi-tours relevés côté est, une épingle à plat au milieu,
    // et le grand virage relevé de la tribune ouest qui ramène à la ligne (le mur y est plus rapide que la corde).
    { id: 'stade', nom: 'GRAND VACARME', rivaux: ['NOUR', 'ENZO', 'JADE'], med: [1.08, 1, 0.94], W: 9, kmh: 0.75, vit: [148, 165], grip: 20, sc: 1, tun: null, chaud: [23, 29], amb: [[0, 4], [23, 29]], sect: [9, 23], anticipe: 1,
      // lignes droites du départ et du fond élargies ; au centre, l'aire ouverte : on y roule partout, on coupe l'épingle par l'arche de feu (et l'on saute alors la butte de sortie)
      large: [[0, 3, 18], [22, 24, 16]], surf: { large: 'terre' }, place: { c: [150, 160], r: 59, a: 0, piles: [[34.5, 0, 24.5, 3], [-35.5, 0, 12.5, 1]] },
      // cinq tremplins (le quatrième par-dessus la fosse), trois hauteurs de mur roulable : 5, 7 et 10 m
      sauts: [[2, 40, 1.5], [9, 30, 1.7], [16, 24, 1.4], [22, 60, 2, 40, 5], [24, 30, 1.5]], cuv: [[4, 8, 6, 6], [17, 21, 10, 9], [25, 29, 13, 12]],
      pts: [[0, 0, 0], [80, 0, 0], [150, 0, 0], [230, 0, 0], [300, 0, 0], [339, 16, 0], [355, 55, 0], [339, 94, 0], [300, 110, 0], [255, 110, 0], [150, 110, 0], [80, 110, 0], [45, 125, 0], [30, 160, 0], [45, 195, 0], [80, 210, 0], [126, 210, 0], [300, 210, 0], [339, 226, 0], [355, 265, 0], [339, 304, 0], [300, 320, 0], [190, 320, 0], [100, 320, 0], [0, 320, 0], [-60, 320, 0], [-173, 273, 0], [-220, 160, 0], [-173, 47, 0], [-60, 0, 0]],
      // voiture inventée : un pick-up de stade à châssis tubulaire, V8 atmosphérique de 6 L, 600 ch, 1300 kg, propulsion, grands débattements
      car: car({ nom: 'MASTIFF V8 ARENA', ratios: [2.9, 1.95, 1.45, 1.15, 0.95], final: 3.7, wheel: 0.36, mass: 1375, idle: 900, red: 7200, cd: 0.45, area: 2.3,
        tq: [0, 380, 500, 580, 640, 660, 640, 590, 480], son: 0.85, moteur: 'v8', look: { col: 0xffc21a, l: 0.9, w: 1.04, h: 1.2, nez: 0.45, cab: [-0.1, 1.9, 0.62], aileron: 2, bandes: 0x16161c } }),
      radio: RADIO.stade,
      th: { decor: 'stade', fog: 0x0e0c18, fogD: [120, 900], sky: [[0, '#05050a'], [1, '#05050a']], stars: 0,
        astre: { dir: [0.2, 0.95, 0.25], col: '#05050a', ombre: '#05050a', taille: 1 }, hemi: [0xe6ecff, 0x3c3c48, 0.85], sun: [0xffffff, 0.5], phares: 0.3, bloom: 0.1, scan: 0.08, ciel: 'SOUS LE TOIT',
        murH: 0, paroi: 'paroiArene', route: ['#3e3a40', '#4c464c', '#f4f0e0', '#ff8a1a', '#e8362a', '#f4f0e0', false], mur: ['#f4f0e0', '#e8362a', '#1c3fa8', '#c8c4b8'], depart: [0xe8362a, 0x20242c, '#f4f0e0'],
        hud: { y: '#ffffff', c: '#ffc21a', r: '#e8362a', fond: 'rgba(16,14,28,.9)', style: 'tableau', jauge: 'led', split: 0, jp: null, sur: [null, 'ARENE COUVERTE · COMPLET'], titre: ['GRAND', 'VACARME'] } } },
    // Nuit Blanche : la route d'un col fermé pour l'hiver, à l'aube. Neige tassée partout, glace vive là où le soleil ne vient jamais (elle luit, sombre, sur la route claire) :
    // le pied de la falaise après le départ, le replat entre les deux lacets, la crête du col balayée par le vent, le pont sur la gorge, le bois de mélèzes du retour.
    // Pas de relief actif : tout se joue au freinage, qu'il faut avoir fini avant la plaque, et à la remise des gaz, qu'il faut attendre.
    // La route respire : à la sortie du bois elle traverse le lac gelé du fond de vallée, 36 m de glace entre les congères où l'on prend le virage en glisse (points 28 à 30, presque à plat) ;
    // large au hameau et sur la ligne de départ, sur le champ de neige ouvert avant les lacets et au col (le replat du refuge, où tourne le chasse-neige) ;
    // étroite au pied de la falaise, dans les lacets, sur le pont et dans le bois de mélèzes.
    { id: 'givre', nom: 'NUIT BLANCHE', rivaux: ['SOLVEIG', 'ANSELME', 'MIKKO'], W: 7, large: [[28, 30, 18], [30, 1, 11], [4, 7, 10.5], [19, 21, 11]], kmh: 0.67, vit: [155, 175], grip: 20, sc: 1, tun: null, chaud: [16, 22], amb: [[15, 19]], sect: [10, 20], anticipe: 1,
      surf: { fond: 'neige', zones: [[2, 3, 'glace'], [13, 14, 'glace'], [18, 19, 'glace'], [22, 23, 'glace'], [25, 26, 'glace'], [28, 30, 'glace', 0.45]] },
      pts: [[0, 0, 0], [180, 0, 1], [340, -30, 6], [480, 10, 14], [600, -30, 24], [720, 20, 36], [790, 120, 50], [770, 230, 62], [680, 270, 72], [590, 260, 80], [558, 273, 83], [545, 305, 86], [558, 337, 89], [590, 350, 92], [700, 350, 102], [735, 365, 106], [750, 400, 110], [735, 435, 114], [700, 450, 117], [560, 470, 122], [420, 440, 118], [280, 490, 104], [150, 470, 90], [0, 470, 72], [-140, 470, 54], [-250, 400, 40], [-290, 290, 28], [-250, 180, 18], [-300, 90, 5], [-230, 10, 3], [-120, 0, 2]],
      // Audi Sport quattro S1 E2 (1985, Groupe B) : 5 cylindres turbo de 2,1 L, environ 480 ch, 590 N·m, 1090 kg, transmission intégrale (rapports et courbe de couple estimés)
      car: car({ nom: 'BOREALE S1 E2', ratios: [3.5, 2.27, 1.63, 1.27, 1.04, 0.85], final: 4.3, wheel: 0.31, mass: 1165, idle: 1000, red: 8000, cd: 0.45, area: 2.0,
        tq: [0, 180, 300, 430, 540, 590, 580, 520, 400], trac: 11, rwd: 0, son: 1.1, moteur: 'l5', turbo: 1, look: { type: 'gtr', col: 0xf4f0e0, l: 0.9, w: 1.03, h: 1.06, nez: 0.5, cab: [-0.2, 2.1, 0.58], aileron: 2, bandes: 0xf4c020 } }),
      radio: RADIO.givre,
      th: { decor: 'givre', neige: 1.6, fog: 0x8a9cc0, fogD: [70, 1100], sky: [[0, '#070c24'], [0.3, '#16224a'], [0.4, '#3a4a80'], [0.46, '#b07a98'], [0.49, '#f0b890'], [0.5, '#8a9cc0'], [1, '#8a9cc0']], stars: 90,
        astre: { dir: [-0.55, 0.3, 0.5], col: '#f4f8ff', ombre: '#aab8d8', taille: 150 }, hemi: [0x8aa4e0, 0xc8d4f0, 0.8], sun: [0xc0d0ff, 0.45], phares: 0.35, bloom: 0.08, scan: 0.06, // phares faibles (comme les autres cartes à l'aube) et neige tassée grise : sur une route blanche, un faisceau plein noie la piste et les plaques de glace
        chev: 0, murH: 1.4, route: ['#7e8ca6', '#93a1b9', '#f4f8ff', '#7e8ca6', '#f4f8ff', '#dfe8f6', false], mur: ['#dfe8f6', '#f8fbff', '#c4d0e4', '#b4c2da'], depart: [0xe8482a, 0x1c2a4a, '#f4f8ff'],
        hud: { y: '#ffffff', c: '#8fd0ff', r: '#ff5a4a', fond: 'rgba(14,24,52,.9)', style: 'givre', jauge: 'aiguille', split: 0, jp: null, sur: [null, 'COL FERME · -14 °C · AUBE'], titre: ['NUIT', 'BLANCHE'] } } },
    // Spéciale des Ocres : une spéciale de rallye sur terre battue, en fin de journée, entre les pins et les falaises d'ocre. Route large (18 m) et bosselée, tout en courbes à prendre en travers :
    // la crête de la ligne de départ, l'enfilade du vallon, le gué au creux du parcours, l'épingle du belvédère, la grande crête du plateau, puis la traversée du hameau sur son bout de bitume et la descente vers la ligne.
    { id: 'terre', nom: 'SPECIALE DES OCRES', rivaux: ['LOLA', 'SACHA', 'YANN'], med: [1.08, 1, 0.94], W: 9, kmh: 0.82, vit: [152, 168], grip: 18, sc: 1, tun: null, chaud: [33, 54], sect: [31, 51], anticipe: 1,
      surf: { fond: 'terre', zones: [[31, 33, 'mouille'], [64, 67, 'sec']] }, sauts: [[5, 60, 0.7], [30, 36, 0.45], [51, 60, 0.8]],
      pts: [[0, 0, 29.5], [43, 0, 29.7], [85, 0, 29.8], [128, 0, 30.1], [170, 0, 32.2], [220, 0, 33.1], [255, 0, 31.2], [298, 0, 30.1], [340, 0, 30.9], [361, 5, 31.1], [378, 18, 30.8], [407, 52, 29.6], [429, 67, 29.7], [455, 67, 30.4], [476, 52, 31.2], [505, 18, 30.8], [528, 3, 30.1], [555, 4, 30], [576, 21, 30.8], [585, 47, 31.7], [585, 94, 31.8], [585, 141, 31.1], [593, 167, 31.8], [614, 183, 33], [652, 197, 33.9], [666, 207, 33.8], [673, 224, 33.6], [670, 241, 33.4], [658, 254, 33.6], [641, 259, 34.2], [591, 259, 36.1], [536, 259, 35], [513, 259, 34.5], [481, 259, 35.7], [471, 259, 36.4], [448, 265, 38.2], [432, 281, 39.5], [426, 304, 39.9], [426, 344, 39.5], [426, 384, 40.1], [420, 406, 41.1], [403, 423, 41.9], [369, 443, 41.9], [350, 461, 41.3], [344, 486, 41.1], [344, 526, 42], [338, 547, 42.6], [323, 563, 42.7], [302, 568, 42.2], [258, 568, 41.2], [214, 568, 42.4], [152, 568, 43.1], [126, 568, 41.3], [82, 568, 38.6], [57, 568, 38.3], [30, 559, 38.3], [14, 535, 37.8], [3, 496, 35.8], [-8, 476, 34.8], [-28, 464, 34.5], [-67, 454, 34.7], [-90, 439, 34.4], [-98, 413, 33.3], [-98, 367, 31.4], [-98, 313, 31.6], [-98, 273, 31.4], [-98, 227, 29.6], [-98, 193, 29.1], [-98, 133, 30.2], [-109, 105, 29.7], [-134, 74, 28.6], [-145, 51, 28.5], [-141, 26, 29], [-124, 7, 29.5], [-100, 0, 29.6], [-50, 0, 29.2]],
      // voiture inventée : une berlinette de rallye à moteur central arrière, 4 cylindres atmosphérique de 2 L, 260 ch, 780 kg, propulsion (le poids sur les roues motrices : elle passe sa puissance même sur la terre)
      car: car({ nom: 'GARRIGUE 2000 GR.4', ratios: [3, 2.05, 1.5, 1.18, 0.98], final: 4.6, wheel: 0.3, mass: 855, idle: 1000, red: 7800, cd: 0.36, area: 1.7,
        tq: [0, 140, 200, 240, 262, 270, 268, 250, 215], trac: 10.5, son: 1.3, moteur: 'l4', look: { col: 0x2a62c8, l: 0.84, w: 0.98, h: 0.98, nez: 0.5, cab: [-0.3, 2, 0.55], aileron: 0, bandes: 0xf4c020 } }),
      radio: RADIO.terre,
      th: { decor: 'terre', fog: 0xe8c898, fogD: [150, 1500], sky: [[0, '#3f6fb0'], [0.3, '#3f6fb0'], [0.31, '#7fa8cc'], [0.42, '#7fa8cc'], [0.43, '#e8d0a0'], [0.49, '#e8d0a0'], [0.5, '#e8c898'], [1, '#e8c898']], stars: 0,
        astre: { dir: [-0.6, 0.35, 0.5], col: '#fff2c0', ombre: '#fff2c0', taille: 220 }, hemi: [0xc8d8f0, 0xb07848, 0.9], sun: [0xffd8a0, 0.9], phares: 0.15, bloom: 0.03, scan: 0.05,
        murH: 0.9, poussiere: [0.82, 0.62, 0.42], route: ['#a86a3a', '#8a5228', '#96602f', '#b87a48', '#7a6a3a', '#8a7444', false, 'terre'], mur: ['#8a5a30', '#6a7a3a', '#7a4c28', '#6e4424'], depart: [0xe8482a, 0x3a2a1c, '#f4f0e0'],
        hud: { y: '#ffffff', c: '#ffb03a', r: '#e8482a', fond: 'rgba(70,36,16,.9)', style: 'rallye', jauge: 'aiguille', split: 0, jp: null, sur: [null, 'SPECIALE 7 · FIN DE JOURNEE'], titre: ['SPECIALE', 'DES OCRES'] } } },
  ];
  // La Tournée court une nuit, du crépuscule à l'aube : ses manches dans l'ordre de l'heure, pas dans celui du menu. heure : ce que l'horloge affiche à la manche (le mode démo suit le même ordre)
  G.SOIREE = [['terre', '18:40'], ['canal', '19:50'], ['stade', '22:00'], ['ville', '00:00'], ['touge', '02:00'], ['wangan', '03:30'], ['givre', '05:00'], ['paris', '05:30']]
    .map(([id, heure]) => Object.assign(G.CARTES.find(m => m.id === id), { heure }));
  let id = 'ville';
  if (typeof location !== 'undefined') try { id = (/^#defi=\d+\.([a-z0-9]+)\./.exec(location.hash) || [])[1] || new URLSearchParams(location.search).get('carte') || localStorage.getItem('vpr.carte') || id; } catch (e) { } // un lien de défi (#defi=version.carte.données, voir defiCode dans sim.js) ouvre sa carte
  G.CARTE = G.CARTE || G.CARTES.find(m => m.id === id) || G.CARTES[0];
  // Piste d'essai de la conduite (hors des CARTES : ni menu, ni tests, ni records partagés) : ?carte=essai&grip=1&sol=sec|mouille|neige|terre|glace&voiture=<id d'une carte>
  // Plate, 9 m de demi-largeur : ligne droite, grande courbe rapide, droite à 90°, épingle serrée comme celles du col, droite, chicane, longue courbe, enfilade de S, grande droite et retour.
  // Décor, radio et voiture (par défaut) du col.
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
  if (q && id === 'essai') {
    const T = G.CARTES.find(m => m.id === 'touge'), V = G.CARTES.find(m => m.id === q.get('voiture')) || T, gr = +q.get('grip') || 1, sol = q.get('sol') || 'sec';
    G.CARTE = { ...T, id: 'essai', nom: "PISTE D'ESSAI", W: 9, sauts: undefined, chaud: [3, 8], amb: [], sect: [10, 25], med: undefined,
      surf: sol === 'sec' ? undefined : { fond: sol, zones: [] }, car: { ...V.car, grip: gr },
      pts: [[0, 0, 0], [200, 0, 0], [400, 0, 0], [480, 15, 0], [540, 60, 0], [575, 130, 0], [580, 220, 0], [580, 320, 0], [570, 355, 0], [540, 370, 0], [490, 372, 0], [400, 372, 0],
        [360, 372, 0], [340, 380, 0], [333, 395, 0], [340, 410, 0], [360, 418, 0], [420, 418, 0], [470, 418, 0], [495, 430, 0], [505, 455, 0], [505, 500, 0], [505, 520, 0], [490, 545, 0], [490, 575, 0], [505, 600, 0],
        [505, 680, 0], [490, 740, 0], [440, 775, 0], [370, 785, 0], [300, 780, 0], [250, 805, 0], [200, 805, 0], [150, 780, 0], [100, 780, 0], [50, 805, 0], [-50, 805, 0], [-110, 790, 0], [-140, 740, 0], [-140, 600, 0],
        [-140, 400, 0], [-140, 150, 0], [-130, 60, 0], [-90, 15, 0], [-40, 0, 0]],
      th: { ...T.th, hud: { ...T.th.hud, sur: [null, 'ESSAI · GRIP ' + gr + ' · ' + sol.toUpperCase()], titre: ['PISTE', "D'ESSAI"] } } };
  }
})(typeof window !== 'undefined' ? window : globalThis);
