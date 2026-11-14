// node test-peripheriques.js — peripheriques.js avec un faux clavier, de fausses manettes (API Gamepad) et un faux Joy-Con (WebHID) : commandes de menu, inscription, deuxième manette, déconnexion, conduite.
const assert = require('assert'), Peripheriques = require('./peripheriques.js');
const bouton = () => ({ pressed: false, value: 0 });
const manette = index => ({ index, connected: true, axes: [0, 0], buttons: Array.from({ length: 17 }, bouton) });
const appuie = (p, i, v = 1) => { p.buttons[i].pressed = !!v; p.buttons[i].value = v; };
const fenetre = () => { const ec = {}; return { ec, addEventListener: (ev, f) => (ec[ev] = ec[ev] || []).push(f), emet: (ev, e) => (ec[ev] || []).forEach(f => f(e)) }; };
const monte = (o = {}) => { const pads = [], win = fenetre(), dits = []; const P = Peripheriques({ nav: { getGamepads: () => pads, hid: o.hid }, win, places: ['', ''], dit: s => dits.push(s) }); return { P, pads, win, dits }; };
const codes = l => l.map(c => (c.code || c.key) + '@' + c.periph);
const MENU = { menu: true, accueil: false, deux: false };

(async () => {
  // solo : la manette qui appuie devient la retenue, ses boutons et son stick (dans les menus) valent des touches, une seule fois par appui
  { const { P, pads, dits } = monte(), a = manette(0); pads.push(a);
    assert.deepStrictEqual(P.poll(MENU), []);
    appuie(a, 0); assert.deepStrictEqual(codes(P.poll(MENU)), ['Enter@manette0']); assert.deepStrictEqual(dits, ['MANETTE CONNECTÉE']);
    assert.deepStrictEqual(P.poll(MENU), [], 'un bouton tenu ne se répète pas');
    appuie(a, 0, 0); a.axes[1] = -1; assert.deepStrictEqual(codes(P.poll(MENU)), ['ArrowUp@manette0'], 'stick = flèches dans les menus');
    a.axes[1] = 0; appuie(a, 10); assert.deepStrictEqual(codes(P.poll(MENU)), ['c@manette0'], 'radio');
    appuie(a, 10, 0); a.axes[0] = -1; assert.deepStrictEqual(P.poll({ menu: false, deux: false }), [], 'en course, le stick ne vaut pas des flèches');
    assert.strictEqual(P.entree('').steer, -1, 'stick = volant');
    a.axes[0] = 0; appuie(a, 3); assert.deepStrictEqual(codes(P.poll({ menu: false, accueil: true })), ['Enter@manette0'], "à l'accueil, n'importe quel bouton vaut Entrée");
  }
  // clavier : conduite du solo (flèches + ZQSD), du clavier gauche et du droit, chacun ses touches ; la manette du solo s'y ajoute
  { const { P, pads, win } = monte(), a = manette(0); pads.push(a);
    const tape = code => P.clavier({ code }), lache = code => win.emet('keyup', { code });
    tape('KeyW'); tape('ArrowRight'); P.poll(MENU);
    assert.deepStrictEqual(P.entree(''), { steer: 1, gas: 1, brake: 0, hand: false, nitro: false });
    assert.deepStrictEqual(P.entree('clavierG'), { steer: 0, gas: 1, brake: 0, hand: false, nitro: false });
    assert.deepStrictEqual(P.entree('clavierD'), { steer: 1, gas: 0, brake: 0, hand: false, nitro: false });
    lache('KeyW'); tape('Slash'); tape('ShiftRight'); assert.deepStrictEqual(P.entree('clavierD'), { steer: 1, gas: 0, brake: 0, hand: true, nitro: true });
    win.emet('blur'); assert.deepStrictEqual(P.entree(''), { steer: 0, gas: 0, brake: 0, hand: false, nitro: false }, 'tout est relâché en quittant la fenêtre');
    appuie(a, 14); appuie(a, 12); P.poll({ menu: false }); assert.deepStrictEqual([P.entree('').steer, P.entree('').gas], [-1, 1], 'croix de la manette en solo');
    assert.strictEqual(P.entree('clavierG').gas, 0, "la manette ne conduit pas le clavier gauche");
  }
  // inscription : chacun prend la première place libre, + libère sa place, B part une fois les deux prises ; + sans place referme l'écran
  { const { P, pads } = monte(), a = manette(0), b = manette(1); pads.push(a, b);
    P.clavier({ code: 'KeyA' }); P.poll(MENU); assert.strictEqual(P.inscrire(), ''); assert.deepStrictEqual(P.places, ['clavierG', '']);
    P.clavier({ code: 'KeyA', repeat: true }); P.poll(MENU); P.inscrire(); assert.deepStrictEqual(P.places, ['clavierG', ''], 'une touche répétée ne compte pas');
    appuie(b, 2); P.poll(MENU); P.inscrire(); assert.deepStrictEqual(P.places, ['clavierG', 'manette1']);
    appuie(a, 2); P.poll(MENU); P.inscrire(); assert.deepStrictEqual(P.places, ['clavierG', 'manette1'], 'plus de place libre');
    appuie(a, 2, 0); appuie(a, 9); P.poll(MENU); assert.strictEqual(P.inscrire(), 'ferme', '+ sans place referme');
    appuie(a, 9, 0); appuie(b, 9); P.poll(MENU); P.inscrire(); assert.deepStrictEqual(P.places, ['clavierG', ''], '+ libère sa place');
    appuie(b, 9, 0); appuie(b, 2, 0); appuie(b, 1); P.poll(MENU); P.inscrire(); assert.deepStrictEqual(P.places, ['clavierG', 'manette1']);
    appuie(b, 1, 0); appuie(b, 0); P.poll(MENU); assert.strictEqual(P.inscrire(), 'part', 'B part, les deux places prises');
    appuie(b, 0, 0); P.clavier({ code: 'ArrowUp' }); P.oublie(); P.poll(MENU); P.inscrire(); assert.deepStrictEqual(P.places, ['clavierG', 'manette1'], 'oublie : les appuis déjà faits ne prennent pas de place');
  }
  // deuxième manette, à deux : ses boutons valent une commande à son nom (pas seulement ceux de la retenue), sa conduite ne lit qu'elle ; puis elle part
  { const { P, pads, win, dits } = monte(), a = manette(0), b = manette(1); pads.push(a, b); P.places[0] = 'manette0'; P.places[1] = 'manette1';
    const DEUX = { menu: false, deux: true };
    appuie(a, 7, 1); P.poll(DEUX); // la manette 0 devient la retenue
    appuie(b, 5); appuie(b, 0); a.axes[0] = 0.8;
    const l = codes(P.poll(DEUX)); // la retenue est toujours la 0 (elle a encore une entrée) : la 1 passe par les appuis
    assert.deepStrictEqual(l.sort(), ['Enter@manette1', 'KeyE@manette1']);
    assert.deepStrictEqual(P.entree('manette0'), { steer: 0.8, gas: 1, brake: 0, hand: false, nitro: false });
    assert.deepStrictEqual(P.entree('manette1'), { steer: 0, gas: 1, brake: 0, hand: false, nitro: false });
    assert.deepStrictEqual(dits, [], "à deux, pas d'annonce de manette retenue");
    const c = manette(2); pads.push(c); appuie(c, 5); assert.deepStrictEqual(codes(P.poll(DEUX)), [], "une manette sans place n'envoie rien");
    pads.splice(pads.indexOf(b), 1); win.emet('gamepaddisconnected', { gamepad: b }); P.poll(DEUX);
    assert(!P.branche('manette1') && P.branche('manette0') && P.branche('clavierD'), 'la manette 1 est partie');
    assert.deepStrictEqual(P.entree('manette1'), { steer: 0, gas: 0, brake: 0, hand: false, nitro: false });
    P.inscrire(); assert.deepStrictEqual(P.places, ['manette0', ''], 'une manette partie rend sa place');
    pads.splice(pads.indexOf(a), 1); win.emet('gamepaddisconnected', { gamepad: a }); assert.deepStrictEqual(dits, ['MANETTE DÉCONNECTÉE'], 'la retenue qui part est annoncée');
  }
  // Joy-Con (WebHID) : rapport 0x3f, gaz, radio sur Home / Capture, stick en 8 directions, puis débranché
  { let rapport; const ec = {}, dev = { productId: 0x2007, opened: false, open: async () => { dev.opened = true; }, set oninputreport(f) { rapport = f; } };
    const hid = { getDevices: async () => [dev], requestDevice: async () => [dev], addEventListener: (ev, f) => { ec[ev] = f; } };
    const { P } = monte({ hid }); await P.cherche();
    const envoie = (b0, b1, h) => rapport({ reportId: 0x3f, data: new DataView(new Uint8Array([b0, b1, h]).buffer) });
    envoie(8, 0, 8); assert.deepStrictEqual(codes(P.poll(MENU)), ['Enter@joycon0'], 'gaz et valider');
    assert.strictEqual(P.entree('joycon0').gas, 1);
    envoie(0, 16, 8); assert.deepStrictEqual(codes(P.poll(MENU)), ['c@joycon0'], 'Home = radio');
    envoie(0, 32, 8); P.poll(MENU); envoie(0, 0, 8); P.poll(MENU); envoie(0, 32, 8); assert.deepStrictEqual(codes(P.poll(MENU)), ['c@joycon0'], 'Capture = radio');
    envoie(0, 0, 2); P.poll({ menu: false }); assert.strictEqual(P.entree('joycon0').steer, 1, 'stick à droite');
    ec.disconnect({ device: dev }); P.poll(MENU); assert(!P.branche('joycon0'), 'Joy-Con débranché');
  }
  // vibrations : intensités (sans matériel), puis envoi à la seule manette du joueur, coupé par null
  { const V = Peripheriques.vibration, s = () => ({ fort: 0, faible: 0, t: 0 }), RIEN = { hit: 0, land: 0, up: 0, rub: 0, air: false, roul: 0, r: 0, palier: false };
    const v = (e, st = s(), dt = 1 / 60) => V({ ...RIEN, ...e }, st, dt);
    assert.deepStrictEqual(v({}), [0, 0], 'à l\'arrêt sur le sec : rien');
    assert(v({ hit: 4 })[0] < v({ hit: 10 })[0] && v({ hit: 30 })[0] === 1, 'le choc mur vibre selon sa force');
    assert(v({ land: 6 })[0] > 0 && v({ land: 1 })[0] === 0, 'réception dure seulement');
    const st = s(); v({ hit: 13 }, st); const apres = v({}, st, 0.3); assert(apres[0] < 0.1, 'un coup décroît en quelques dixièmes');
    assert(v({ roul: 0.5, r: 1 })[1] > v({ roul: 0.5, r: 0.3 })[1] && v({ roul: 0.5, r: 1 })[1] > v({ roul: 0.2, r: 1 })[1], 'grain : monte avec la vitesse, plus fort sur la terre que sur la neige');
    assert.deepStrictEqual(v({ roul: 0.5, r: 1, air: true }), [0, 0], 'en l\'air, pas de grain');
    assert(v({ up: 1 })[1] >= 0.5, 'coup sec au passage de rapport');
    assert(v({ rub: 1, r: 0.5 })[1] > 0, 'frottement du bord');
    const p = s(); const on = v({ palier: true }, p, 0.05)[1], off = v({ palier: true }, p, 0.1)[1]; assert(on > 0 && off === 0, 'glisse au palier : battements');
    const { P, pads } = monte(), a = manette(0), b = manette(1), recu = []; pads.push(a, b);
    a.vibrationActuator = { playEffect: (t, o) => (recu.push(['a', t, o.strongMagnitude]), Promise.resolve()), reset: () => (recu.push(['a', 'reset']), Promise.resolve()) };
    b.hapticActuators = [{ pulse: (x, ms) => (recu.push(['b', x, ms]), Promise.resolve()) }];
    P.poll(MENU); P.vibre('manette0', { ...RIEN, hit: 13 }, 1 / 60); P.vibre('clavierG', { ...RIEN, hit: 13 }, 1 / 60);
    assert.deepStrictEqual(recu, [['a', 'dual-rumble', 1]], 'seule la manette du joueur vibre, le clavier rien');
    P.vibre('manette0', null, 1 / 60); assert.deepStrictEqual(recu[1], ['a', 'reset'], 'pause : arrêt'); P.vibre('manette0', null, 1 / 60); assert.strictEqual(recu.length, 2, 'un seul arrêt');
    P.vibre('manette1', { ...RIEN, land: 10 }, 1 / 60); assert.deepStrictEqual(recu[2], ['b', 1, 100], 'repli hapticActuators');
    a.vibrationActuator.playEffect = () => { throw new Error('non pris en charge'); }; P.vibre('manette0', { ...RIEN, hit: 13 }, 1 / 60); // ne doit pas lever
  }
  console.log('périphériques : OK');
})().catch(e => { console.error(e); process.exit(1); });
