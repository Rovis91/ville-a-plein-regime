// Périphériques : clavier, manettes (API Gamepad) et Joy-Con (WebHID) derrière une seule interface. game.js en crée une à chaque chargement (Peripheriques({ ... })) ; node la charge par require pour test-peripheriques.js.
// Chaque périphérique a un nom : 'clavier' (entier, solo seulement), 'clavierG', 'clavierD', 'manette' + n (API Gamepad), 'joycon' + n (WebHID, n = 0 ou 1).
// Par image : poll() rend les commandes de menu des manettes, sous forme { code, key, periph } (les mêmes noms que les touches du clavier, pour ne pas dédoubler les menus) ;
// inscrire() distribue les places de l'écran partagé ; entree(id) lit la conduite d'un périphérique, et de lui seul.
(function () {
  // Touches de chaque clavier en positions physiques (e.code : KeyW/KeyA sont Z/Q en AZERTY), dans l'ordre gauche, droite, gaz, frein, frein à main, nitro. Clavier droit : Maj droite = frein à main,
  // touche à gauche de Maj droite (Slash : « ! » en AZERTY, « / » en QWERTY) ou Entrée du pavé = nitro. Pas Ctrl droite (Ctrl + flèches change de bureau sous macOS) ni Entrée (une commande de menu des manettes).
  const CLAV = {
    clavier: [['ArrowLeft', 'KeyA'], ['ArrowRight', 'KeyD'], ['ArrowUp', 'KeyW'], ['ArrowDown', 'KeyS'], ['Space'], ['KeyX', 'KeyN']],
    clavierG: [['KeyA'], ['KeyD'], ['KeyW'], ['KeyS'], ['Space'], ['KeyX'], ['KeyQ', 'KeyE']], // en plus : les rapports, pour qu'ils comptent comme un appui de ce clavier
    clavierD: [['ArrowLeft'], ['ArrowRight'], ['ArrowUp'], ['ArrowDown'], ['ShiftRight'], ['Slash', 'NumpadEnter']],
  };
  // manette (disposition « standard » du navigateur, noms des boutons d'une manette de Switch) : stick ou croix = volant et menus, ZR ou B = gaz, ZL ou Y = frein,
  // A = glisse, X = nitro, clic du stick = radio, L / R = rapports, + = pause, B = valider. Chaque bouton vaut la commande d'une touche du clavier.
  const PADK = { 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight', 0: 'Enter', 9: 'Escape', 8: 'g', 10: 'c', 11: 'c', 4: 'KeyQ', 5: 'KeyE' };
  const cmd = (k, periph) => ({ code: k.length > 1 ? k : '', key: k.length > 1 ? '' : k, periph });
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const JOYCON = d => d.productId === 0x2006 || d.productId === 0x2007; // Joy-Con gauche / droit

  // o : { nav (navigator), win (pour les écouteurs), signal (AbortSignal qui les retire), places (['', ''], gardé par l'appelant), dit (message court à l'écran) }
  function Peripheriques(o) {
    const nav = o.nav || {}, win = o.win, signal = o.signal, dit = o.dit || (() => { }), on = (cible, ev, f) => cible && cible.addEventListener(ev, f, { signal });
    const keys = {}, vus = [], appuis = [], padWas = {}, padRepos = {}, padAvant = {}, PLACES = o.places || ['', '']; // touches enfoncées · appuis du clavier depuis la dernière image · appuis de l'image, tous périphériques
    let pads = [], pad = null, retenu = ''; // en solo, manette retenue = la dernière qui a eu une entrée : la première de la liste peut être un autre périphérique (volant, casque, second Joy-Con)
    const padId = p => p.hid || 'manette' + p.index, branche = id => id in CLAV || pads.some(p => padId(p) === id); // branche : à interroger après poll, pour savoir qu'un périphérique inscrit est parti

    // ---- clavier : game.js lui passe ses keydown (il garde la main sur les commandes, qui doivent rester dans le geste de l'utilisateur pour le son et WebHID)
    const clavier = e => { keys[e.code] = 1; const id = ['clavierG', 'clavierD'].find(c => CLAV[c].flat().includes(e.code)); if (id && !e.repeat) vus.push({ id, t: e.code }); };
    on(win, 'keyup', e => { keys[e.code] = 0; });
    on(win, 'blur', () => { for (const k in keys) keys[k] = 0; }); // sinon une touche reste enfoncée après Alt-Tab

    const parti = id => { delete padRepos[id]; delete padAvant[id]; if (id === retenu) { retenu = ''; dit('MANETTE DÉCONNECTÉE'); } };
    on(win, 'gamepaddisconnected', e => parti(padId(e.gamepad)));

    // ---- Joy-Con lus en direct (WebHID), deux au plus : sous Windows, Chrome reçoit leurs rapports mais ne les montre pas à l'API Gamepad (constaté sur Chrome 156, Joy-Con (R) en Bluetooth).
    // Rapport 0x3f, Joy-Con seul tenu à l'horizontale : octet 0 = boutons (1 gauche, 2 haut, 4 bas, 8 droite, 16 SL, 32 SR), octet 1 = − ou + (1, 2), octet 2 = stick en 8 directions (0 = haut, sens horaire, 8 et plus = repos).
    // Joy-Con (L) : même table. Déduit, pas essayé : ce rapport décrit le Joy-Con couché (le stick du (R) y arrive déjà tourné), donc un même bit devrait valoir une même position sous le pouce ; si le (L) arrive inversé, lui donner sa table dans hidLire selon dev.productId.
    // Présentés comme des manettes « standard », pour que poll les traite comme les autres. shortcut: stick en tout-ou-rien, passer au rapport 0x30 (stick 12 bits + étalonnage) pour un volant progressif.
    const hids = [null, null];
    const hidLire = (e, p) => {
      if (e.reportId !== 0x3f) return; const d = new Uint8Array(e.data.buffer, e.data.byteOffset), h = d[2], set = (i, v) => { p.buttons[i].pressed = !!v; p.buttons[i].value = v ? 1 : 0; };
      [8, 5, 4, 0, 3, 1].forEach((b, i) => set(b, d[0] & 1 << i)); set(9, d[1] & 3); set(10, d[1] & 48); // (radio = Home ou Capture : bits 16 et 32, d'après le format du rapport, non essayé ; pas le clic du stick, que le pouce enfonce en serrant SL pour la nitro) · Joy-Con (R) couché, SL / SR vers le haut : bits gauche et haut (constatés par l'auteur), bas et droite (déduits), SL, SR -> boîte manuelle / automatique, rapport +, rapport -, gaz et valider, nitro, glisse (choix de l'auteur, qui ne freine pas à la manette)
      p.axes = [h > 0 && h < 4 ? 1 : h > 4 && h < 8 ? -1 : 0, h === 7 || h < 2 ? -1 : h > 2 && h < 6 ? 1 : 0];
    };
    const hidOuvre = async d => {
      const pris = () => hids.some(p => p && p.dev === d);
      if (!d || pris() || !JOYCON(d)) return;
      try { if (!d.opened) await d.open(); } catch (e) { return; }
      const n = hids.indexOf(null); if (n < 0 || pris()) return; // revérifié après l'attente : deux recherches peuvent ouvrir le même Joy-Con en même temps
      const p = hids[n] = { hid: 'joycon' + n, dev: d, connected: true, axes: [0, 0], buttons: Array.from({ length: 11 }, () => ({ pressed: false, value: 0 })) }; d.oninputreport = e => hidLire(e, p);
    };
    const hidDemande = () => nav.hid && nav.hid.requestDevice({ filters: [{ vendorId: 0x057e }] }).then(l => l.forEach(hidOuvre)).catch(() => { }); // touche J : fenêtre du navigateur pour autoriser le Joy-Con (une fois)
    // Joy-Con par défaut : au premier geste (l'accueil), la fenêtre d'autorisation s'ouvre d'elle-même si aucun Joy-Con n'est encore autorisé ; ensuite Chrome s'en souvient et cherche() les ouvre sans fenêtre
    const hidAuto = () => nav.hid && nav.hid.getDevices().then(l => { if (!l.some(JOYCON)) hidDemande(); }).catch(() => { });
    const cherche = () => nav.hid ? nav.hid.getDevices().then(l => Promise.all(l.map(hidOuvre))).catch(() => { }) : Promise.resolve(); // déjà autorisé : pas de fenêtre
    if (nav.hid) {
      cherche(); on(nav.hid, 'connect', cherche);
      on(nav.hid, 'disconnect', e => { const n = hids.findIndex(p => p && p.dev === e.device); if (n >= 0) { const id = hids[n].hid; hids[n] = null; parti(id); } });
    }

    // ---- l'image : c = { menu (le stick vaut des flèches), accueil (n'importe quel bouton vaut Entrée), deux (écran partagé) }
    function poll(c) {
      pads = [...(nav.getGamepads ? nav.getGamepads() : [])].filter(p => p && p.connected).concat(hids.filter(p => p));
      // appuis de l'image, tous périphériques : { id, t }, t = code de touche ou numéro de bouton. C'est « qui vient d'appuyer » pour l'inscription, et les commandes d'une manette inscrite qui n'est pas la retenue.
      appuis.length = 0; for (const a of vus) appuis.push(a); vus.length = 0; // les mêmes tableaux d'une image à l'autre, comme l'état des boutons : rien d'alloué sans appui
      for (const p of pads) { const id = padId(p), w = padAvant[id] || (padAvant[id] = []); p.buttons.forEach((b, i) => { if (b.pressed && !w[i]) appuis.push({ id, t: i }); w[i] = b.pressed; }); }
      // « entrée » = un bouton enfoncé ou un axe écarté de sa position de repos (une gâchette ou une croix vue comme axe ne repose pas à 0)
      const actif = p => { const r = padRepos[padId(p)] = padRepos[padId(p)] || [...p.axes]; return p.buttons.some(b => b.pressed) || p.axes.some((x, i) => Math.abs(x - r[i]) > 0.5); };
      pad = pads.find(p => padId(p) === retenu) || null;
      if (!pad || !actif(pad)) { const n = pads.find(actif); if (n && n !== pad) { pad = n; retenu = padId(n); if (!c.deux) dit('MANETTE CONNECTÉE'); } } // (à deux, la manette retenue change dès que l'autre joueur appuie : pas d'annonce)
      // commandes de la manette retenue : une par touche qui passe à enfoncée, croix, boutons et (dans les menus) stick confondus
      const out = [], tenu = {}, ax = pad ? pad.axes : [0, 0];
      if (pad) pad.buttons.forEach((b, i) => { if (b.pressed && PADK[i]) tenu[PADK[i]] = 1; });
      if (c.accueil && pad && pad.buttons.some(b => b.pressed)) tenu.Enter = 1;
      if (c.menu) { if (ax[1] < -0.6) tenu.ArrowUp = 1; if (ax[1] > 0.6) tenu.ArrowDown = 1; if (ax[0] < -0.6) tenu.ArrowLeft = 1; if (ax[0] > 0.6) tenu.ArrowRight = 1; } // en course le stick est lu en analogique, pas en flèches
      for (const k in tenu) if (!padWas[k]) out.push(cmd(k, retenu));
      for (const k in padWas) if (!tenu[k]) delete padWas[k]; Object.assign(padWas, tenu);
      // À deux : les boutons d'une manette inscrite qui n'est pas la retenue valent aussi une commande chacun, à son nom : l'un ou l'autre met en pause et navigue
      if (c.deux) for (const { id, t } of appuis) if (id !== retenu && PADK[t] && PLACES.includes(id)) out.push(cmd(PADK[t], id));
      return out;
    }
    // Écran partagé : chaque périphérique qui appuie prend la première place libre ; + sur une manette libère sa place (sans place : 'ferme', l'écran se referme) ; les deux places prises, B fait partir ('part').
    // Une manette partie rend sa place. Le clavier (Échap, Entrée) est lu par game.js, sur ses touches.
    function inscrire() {
      for (const { id, t } of appuis) { const n = PLACES.indexOf(id), bouton = !(id in CLAV), l = PLACES.indexOf('');
        if (bouton && t === 9) { if (n < 0) return 'ferme'; PLACES[n] = ''; }
        else if (n < 0) { if (l >= 0) PLACES[l] = id; }
        else if (bouton && t === 0 && l < 0) return 'part'; }
      PLACES.forEach((p, i) => { if (p && !branche(p)) PLACES[i] = ''; });
      return '';
    }
    const oublie = () => { vus.length = appuis.length = 0; }; // les appuis de l'image qui ouvre l'inscription ne prennent pas de place
    // Entrée de conduite d'un périphérique, et de lui seul. Sans nom : le solo, tout le clavier et la manette retenue.
    // Un clavier nommé ne lit que ses touches et une manette nommée qu'elle-même : la manette de l'un ne doit pas conduire le clavier de l'autre.
    const entree = id => {
      const p = id ? pads.find(p => padId(p) === id) : pad, K = CLAV[id || 'clavier'];
      const k = i => K && K[i].some(c => keys[c]) ? 1 : 0, b = i => p && p.buttons[i] ? p.buttons[i].value : 0, sx = p && Math.abs(p.axes[0]) > 0.15 ? p.axes[0] : 0;
      return {
        steer: clamp(k(1) - k(0) + b(15) - b(14) + sx, -1, 1),
        gas: k(2) || b(7) > 0.1 || b(0) || b(12) ? 1 : 0, brake: k(3) || b(6) > 0.1 || b(2) || b(13) ? 1 : 0, hand: !!(k(4) || b(1)), nitro: !!(k(5) || b(3)),
      };
    };
    return { keys, places: PLACES, clavier, poll, inscrire, oublie, entree, branche, hidDemande, hidAuto, cherche, CLAV };
  }
  if (typeof module === 'object' && module.exports) module.exports = Peripheriques; else window.Peripheriques = Peripheriques;
})();
