// Ville à plein régime — rendu, effets, HUD, commandes et boucle de jeu. La piste et la physique sont dans sim.js.
// Plan du fichier (chercher « // ---------- ») : rendu et passe finale · les trois entités du décor (textures.js, formes.js, placement) · piste · ville · horizon · voiture et effets ·
// état de jeu et commandes · HUD · boucle. Voir README.md pour savoir où régler quoi.
(() => {
  const T = buildTrack(THREE), S = T.S, N = T.n, W = T.W, V3 = THREE.Vector3, M = CARTE, TH = M.th; // carte active et son thème : voir cartes.js
  const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const AUTO = location.search.includes('auto'); // debug : le pilote auto conduit
  // 0 hors du secteur, 1 dedans, rampes linéaires de `ramp` échantillons (2 m) avant l'entrée / après la sortie
  const span = (a0, a1, on) => (i, ramp) => { if (!on) return 0; const a = (i - a0 + N) % N, L = a1 - a0; return a < L ? 1 : Math.max(0, 1 - (a - L) / ramp, 1 - (N - a) / ramp); };
  const zone = span(T.t0, T.t1, T.tun), hot = span(T.h0, T.h1, true); // zone = tunnel (lumière, décor) ; hot = secteur chaud (musique)
  // zones d'ambiance sonore (champ amb de la carte, entre deux points du tracé) : 0 dehors, 1 dedans, fondu de 120 m à l'entrée et à la sortie
  const nearS = p => { let b = 0, bd = 1e18; for (let i = 0; i < N; i++) { const d = (S[i].x - p[0] * M.sc) ** 2 + (S[i].z - p[1] * M.sc) ** 2; if (d < bd) { bd = d; b = i; } } return b; };
  const ambZ = (M.amb || []).map(([a, b]) => span(nearS(M.pts[a]), nearS(M.pts[b]), true)), ambAt = i => Math.max(0, ...ambZ.map(z => z(i, 60)));
  // pluie (thème) : force par échantillon calculée dans sim.js (T.pluie : zones [point a, point b, force], fondu de 120 m) ; coupée en tunnel au dessin
  const pluieAt = i => T.pluie[i];
  let tTraf = 0; // temps écoulé depuis le départ : horloge du trafic
  let seed = 7;
  const rnd = () => { seed = seed * 1664525 + 1013904223 >>> 0; return seed / 4294967296; };

  // ---------- réglages de la lumière et du rendu rétro (tout se règle ici) ----------
  const NL = 16;        // luminaires calculés en même temps autour de la voiture (coût par pixel)
  const LUM_GAIN = 1;   // force de tous les luminaires, phares compris
  const LUM_PAS = 5;    // tunnels : un luminaire tous les LUM_PAS échantillons (2 m), en quinconce gauche / droite
  const QUANT = 32;     // passe finale : niveaux par canal (une console 15 bits en a 32) ; 0 = pas de quantification
  const TRAME = 0.8;     // force du tramage ordonné de Bayer, 0 à 1
  const TUN_AMB = 0.55; // tunnels : part de lumière ambiante sur sol, parois et plafond ; le reste vient des luminaires
  const TREMBLE = 0;    // tremblement des sommets façon première console 3D : pas de la grille en pixels, 0 = aucun

  // ---------- styles visuels à comparer : ?style=<nom> (sans paramètre : rendu actuel, inchangé) ; planche des captures dans styles.html ----------
  // h : lignes de la cible interne (0 = celles de l'écran) ; z : la passe lit la profondeur (contours) ; tremble / affine : sommets et textures façon console 32 bits
  // pre / fx / fin : GLSL de la passe finale — avant lecture (u = coordonnée), sur la couleur c de la scène, puis après le HUD. Aucun flou, aucun halo.
  const STYLES = {
    fin: { h: 540, fx: 'c = floor(c * 64. + bayer(v / px) * .35 + .5) / 64.;' },
    net: { h: 0, brut: 1 }, // la scène et le HUD, rien d'autre : pas même la vignette
    encre: { h: 0, z: 1, fx: 'c = aplat(pow(c, vec3(.72)), 6.) + .03; c *= 1. - .95 * smoothstep(.007, .018, arete(u, px * 1.5));' },
    demiteinte: { h: 540, fx: `float l = sqrt(lum(c)) * 3.2, i = min(floor(l), 2.); vec2 g = mat2(.707, -.707, .707, .707) * v * ecr / (ecr.y / 200.);
      float pt = smoothstep(-.08, .08, l - i - length(fract(g) - .5) * 1.414);
      vec3 enc = mix(i < .5 ? pal[0] : i < 1.5 ? pal[1] : pal[2], i < .5 ? pal[1] : i < 1.5 ? pal[2] : pal[3], pt);
      c = c.r - max(c.g, c.b) > .22 ? pal[4] * (.55 + .45 * pt) : enc;` },
    cathodique: { h: 360, pre: 'u = u * 2. - 1.; u *= 1. + .028 * u.yx * u.yx; u = u * .5 + .5;',
      fin: `c *= 1.45 * (1. - .55 * smoothstep(.22, .5, abs(fract(u.y / px.y) - .5)));
      c *= mix(vec3(.72), vec3(1.2), vec3(equal(vec3(mod(floor(v.x * ecr.x), 3.)), vec3(0., 1., 2.))));
      if (u != clamp(u, 0., 1.)) c = vec3(0.);` },
    console32: { h: 360, tremble: 1, affine: .3, fx: 'c = floor(c * 32. + bayer(v / px) * .5 + .5) / 32.;' },
    lisere: { h: 0, z: 1, fx: `float e = smoothstep(.007, .018, arete(u, px * 1.5)); c = aplat(c, 9.);
      c = mix(c, min(c * 2.6 + vec3(.1, .2, .26), 1.), e * (.4 + .6 * smoothstep(0., .012, W(u))));` },
  };
  // ingrédients à doser un par un, seuls ou par-dessus un style : ?lignes=540 (0 = écran) &aa=2 (suréchantillonnage, pas un flou) &lisse=1 (textures filtrées)
  // &niveaux=32&trame=.5 &contour=.9 (encre) &lisere=.8 &ombres=.5 (0 à 1, relève les sombres) &contraste=1.2 &affine=.3 &tremble=1 &flou=1&halo=1 (ceux du rendu actuel)
  const Q = new URLSearchParams(location.search), P = k => +Q.get(k) || 0, G = k => P(k).toFixed(3);
  const ING = ['lignes', 'aa', 'lisse', 'niveaux', 'trame', 'contour', 'lisere', 'ombres', 'contraste', 'affine', 'tremble', 'flou', 'halo'];
  const ST = STYLES[Q.get('style')] || ING.some(k => Q.has(k)) ? Object.assign({ h: 0 }, STYLES[Q.get('style')]) : null;
  if (ST) {
    for (const [k, c] of [['lignes', 'h'], ['affine', 'affine'], ['tremble', 'tremble']]) if (Q.has(k)) ST[c] = P(k);
    ST.aa = ST.h ? 1 : Math.max(1, Math.min(3, P('aa'))); // en pleine résolution seulement : agrandie, une cible lissée serait floue
    ST.z = ST.z || P('contour') || P('lisere'); const nv = P('niveaux') || (P('trame') ? 32 : 0);
    ST.fx = (P('flou') || P('halo') ? `{ vec2 c0 = vec2(.5, .42), dd = u - c0; float ll = length(dd); vec3 a = vec3(0.);
        for (int i = 0; i < 8; i++) a += texture2D(t, c0 + dd * (1. - amt * ${G('flou')} * ll * float(i) * .026)).rgb; c = a / 8.;
        for (int i = 0; i < 12; i++) { float an = float(i) * .5236, rr = 2. + 2.5 * mod(float(i), 3.); c += max(texture2D(t, u + vec2(cos(an), sin(an)) * rr * px).rgb - .5, 0.) * ${(P('halo') * TH.bloom).toFixed(3)}; } }` : '')
      + (ST.fx || '')
      + (P('ombres') ? `c = pow(c, vec3(${(1 - 0.5 * P('ombres')).toFixed(3)}));` : '')
      + (P('contraste') ? `c = clamp((c - .5) * ${G('contraste')} + .5, 0., 1.);` : '')
      + (nv ? `c = floor(c * ${nv.toFixed(1)} + bayer(v / px) * ${G('trame')} + .5) / ${nv.toFixed(1)};` : '')
      + (P('contour') ? `c *= 1. - ${G('contour')} * smoothstep(.007, .018, arete(u, px * 1.5));` : '')
      + (P('lisere') ? `c = mix(c, min(c * 2.6 + vec3(.1, .2, .26), 1.), ${G('lisere')} * smoothstep(.007, .018, arete(u, px * 1.5)));` : '');
  }
  // demi-teinte : quatre encres de la plus sombre à la plus claire, et une encre de signal (feux, néons rouges), par carte
  const PAL = { ville: [0x0a0614, 0x3a1a6a, 0xff3a8a, 0xfff0c8, 0xff2a3a], touge: [0x06100c, 0x1c4a3a, 0x7ab890, 0xfff2c8, 0xff5030], wangan: [0x060a16, 0x1a3a6a, 0xf0a040, 0xfff4d8, 0xff3030],
    paris: [0x100c14, 0x4a3a5a, 0xd89a70, 0xfff0d8, 0xe83a30], canal: [0x0c0a12, 0x5a2a4a, 0xf08a50, 0xfff0c0, 0xff3a40] }[M.id];

  // ---------- rendu basse définition : scène → cible 270p → passe finale (flou de vitesse, HUD, scanlines) ----------
  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.BasicShadowMap;
  document.body.prepend(renderer.domElement);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(70, 1, 0.5, 3000);
  const FOG_OUT = new THREE.Color(TH.fog), FOG_IN = new THREE.Color(TH.tun ? TH.tun.fog : TH.fog), WHITE = new THREE.Color(0xffffff);
  scene.fog = new THREE.Fog(TH.fog, TH.fogD[0], TH.fogD[1]);
  const rt = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  if (ST && ST.aa > 1) rt.texture.minFilter = rt.texture.magFilter = THREE.LinearFilter; // suréchantillonnage : la cible est aa fois plus fine, la passe finale en fait la moyenne
  // le HUD est dessiné sur un canvas 2D à la même résolution que le jeu, puis composé dans la passe finale : une seule grille de pixels
  const hudC = document.createElement('canvas'), hg = hudC.getContext('2d'), hudT = new THREE.CanvasTexture(hudC);
  hudT.minFilter = hudT.magFilter = THREE.NearestFilter;
  const post = new THREE.ShaderMaterial({
    uniforms: { t: { value: rt.texture }, h: { value: hudT }, amt: { value: 0 }, ab: { value: 0 }, res: { value: 270 }, bloom: { value: TH.bloom }, scan: { value: TH.scan }, px: { value: new THREE.Vector2(1 / 480, 1 / 270) } },
    vertexShader: 'varying vec2 v; void main(){ v = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: `uniform sampler2D t, h; uniform float amt, ab, res, bloom, scan; uniform vec2 px; varying vec2 v;
      float b2(vec2 a){ a = floor(a); return fract(a.x / 2. + a.y * a.y * .75); } // matrice de Bayer 4×4, par récurrence
      void main(){
        vec2 c0 = vec2(.5, .42), d = v - c0; float l = length(d); vec3 c = vec3(0.);
        for (int i = 0; i < 8; i++) { // flou radial : nul au centre, fort sur les bords, proportionnel à la vitesse
          vec2 u = c0 + d * (1. - amt * l * float(i) * .026);
          c += vec3(texture2D(t, u + d * ab).r, texture2D(t, u).g, texture2D(t, u - d * ab).b); // + aberration chromatique
        }
        c /= 8.;
        vec3 bl = vec3(0.); // halo : on ajoute ce qui dépasse un seuil de luminosité, prélevé en couronne
        for (int i = 0; i < 12; i++) { float a = float(i) * .5236, rr = 2. + 2.5 * mod(float(i), 3.); bl += max(texture2D(t, v + vec2(cos(a), sin(a)) * rr * px).rgb - .5, 0.); }
        c += bl * bloom;
        ${QUANT ? `vec2 q = v / px; c = floor(c * ${QUANT}. + (b2(.5 * q) * .25 + b2(q) - .5) * ${TRAME.toFixed(2)} + .5) / ${QUANT}.; // couleurs réduites et tramées, sur la grille de pixels du jeu` : ''}
        vec4 hd = texture2D(h, v); c = mix(c, hd.rgb, hd.a);
        c *= 1. - scan * mod(floor(v.y * res), 2.); // scanlines calées sur la grille
        c *= 1. - .9 * l * l;                       // vignette
        gl_FragColor = vec4(c, 1.);
      }`,
  });
  const postScene = new THREE.Scene(), postCam = new THREE.Camera(), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post);
  quad.frustumCulled = false; postScene.add(quad);
  if (ST) { // passe finale des styles : la scène telle quelle, l'effet du style, le HUD (toujours sur sa grille de 270 lignes), une vignette légère
    if (ST.z) { rt.depthTexture = new THREE.DepthTexture(1, 1); rt.depthTexture.type = THREE.UnsignedIntType; }
    Object.assign(post.uniforms, { dz: { value: rt.depthTexture }, ecr: { value: new THREE.Vector2(1, 1) }, pal: { value: PAL.map(c => new THREE.Color(c)) } });
    post.fragmentShader = `uniform sampler2D t, h, dz; uniform float amt; uniform vec2 px, ecr; uniform vec3 pal[5]; varying vec2 v;
      float b2(vec2 a){ a = floor(a); return fract(a.x / 2. + a.y * a.y * .75); }
      float bayer(vec2 q){ return b2(.5 * q) * .25 + b2(q) - .5; }
      float lum(vec3 c){ return dot(c, vec3(.3, .59, .11)); }
      vec3 aplat(vec3 c, float n){ float g = sqrt(max(lum(c), 1e-4)), a = (floor(g * n) + .5) / n; return c * (a * a / (g * g)); } // paliers de clarté, teinte gardée
      float W(vec2 u){ return 1. - texture2D(dz, u).x; } // proportionnel à 1 / distance : affine à l'écran sur une facette plane
      float arete(vec2 u, vec2 e){ float w = W(u); // courbure de W : nulle sur une facette, forte à une silhouette ou à un pli
        return (abs(W(u + vec2(e.x, 0.)) + W(u - vec2(e.x, 0.)) - 2. * w) + abs(W(u + vec2(0., e.y)) + W(u - vec2(0., e.y)) - 2. * w)) / max(w, 1e-6); }
      void main(){
        vec2 u = v; ${ST.pre || ''}
        vec3 c = texture2D(t, u).rgb; ${ST.fx || ''}
        vec4 hd = texture2D(h, u); c = mix(c, hd.rgb, hd.a); ${ST.fin || ''}
        ${ST.brut ? '' : 'vec2 d = v - vec2(.5, .42); c *= 1. - .35 * dot(d, d);'}
        gl_FragColor = vec4(c, 1.);
      }`;
  }
  let HW = 480, RW = 480, RH = 270; const HH = 270; // HW × HH : grille du HUD ; RW × RH : cible de la scène (la même sans style)
  const resize = () => {
    HW = clamp(Math.round(HH * innerWidth / (innerHeight || 1)), 360, 960);
    const OW = Math.round(innerWidth * devicePixelRatio), OH = Math.round(innerHeight * devicePixelRatio), aa = ST ? ST.aa : 1, k = ST ? (ST.h || OH) / HH * aa : 1; RW = Math.round(HW * k); RH = Math.round(HH * k);
    if (ST) { renderer.setSize(OW, OH, false); post.uniforms.ecr.value.set(OW, OH); } else renderer.setSize(HW, HH, false);
    rt.setSize(RW, RH); hudC.width = HW; hudC.height = HH; post.uniforms.px.value.set(aa / RW, aa / RH); cam.aspect = HW / HH; cam.updateProjectionMatrix();
  };
  addEventListener('resize', resize); resize();

  const tex = (w, h, draw) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'));
    const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapNearestFilter; // jamais de filtrage linéaire, sauf ?lisse=1
    if (P('lisse')) { t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; }
    t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  };
  const R = (g, c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };

  // ---------- les trois entités du décor : textures.js (l'aspect), formes.js (la géométrie), et le placement — ici pour la piste et la ville, decors.js pour les autres cartes ----------
  const speckle = (g, n, c, h = 1, H = 64) => { for (let i = 0; i < n; i++) R(g, c, rnd() * 64 | 0, rnd() * H | 0, 1, h); };
  const voile = (g, a, f) => { g.globalAlpha = a; f(); g.globalAlpha = 1; }; // dessine en transparence : salissures et usure par-dessus n'importe quelle teinte
  const tx = (nom, ...a) => { // un dessin du catalogue, tiré à neuf à chaque appel ; alea = hasard propre à la texture, semé par son nom : il ne décale pas rnd, donc pas le décor
    const [w, h, d, tuile] = TEXTURES[nom](...a); let s = 7; for (const ch of nom + a) s = Math.imul(s ^ ch.charCodeAt(0), 16777619) >>> 0;
    const t = tex(w, h, g => d(g, { R, rnd, voile, speckle, alea: () => (s = s * 1664525 + 1013904223 >>> 0) / 4294967296 })); t.tuile = tuile; return t;
  };
  // une matière : une texture du catalogue (aplat ou dessin) et la façon de la rendre. Options : lum = lumineuse par elle-même, c = teinte,
  // retro / gloss = rétroréfléchissante / brillante (lumière dynamique), rep = répétition, net = sans mipmaps, et toutes celles des matériaux three
  const mat = (nom, o = {}, ...a) => {
    const { lum: lu, c, retro: re, gloss: gl, rep, net, ...three } = o, e = TEXTURES[nom], p = typeof e === 'number' ? { color: c === undefined ? e : c } : { map: tx(nom, ...a) };
    if (p.map && c !== undefined) p.color = c; if (rep) p.map.repeat.set(...rep); if (net) p.map.minFilter = THREE.NearestFilter;
    const m = new THREE[lu ? 'MeshBasicMaterial' : 'MeshLambertMaterial'](Object.assign(p, three));
    if (p.map) m.userData.tuile = p.map.tuile; if (re) retro(m, re); if (gl) gloss(m, gl); return m;
  };
  // densité : sur une boîte, une texture à tuile se répète tous les `tuile` mètres au lieu de s'étirer sur chaque face (faces de BoxGeometry : ±x, ±y, ±z)
  const habille = (g, m) => {
    const t = m && m.userData.tuile, dm = g.userData.dim;
    if (t && dm && !g.userData.hab) { g.userData.hab = 1; const uv = g.attributes.uv, [w, h, d] = dm; for (let i = 0; i < uv.count; i++) { const f = i >> 3; uv.setXY(i, uv.getX(i) * (f ? w : d) / t, uv.getY(i) * (f === 1 ? d : h) / t); } }
    return g;
  };
  const geo = (nom, ...a) => FORMES[nom](...a); // la géométrie d'une forme simple
  // pose une forme en (x, y, z) dans parent. peau = une matière (forme simple, renvoie le Mesh) ou { zone: matière } (assemblage, renvoie ses Mesh)
  const pose = (nom, peau, parent = scene, [x, y, z] = [0, 0, 0], ...a) => {
    const f = FORMES[nom](...a);
    if (f.isBufferGeometry) { const m = new THREE.Mesh(habille(f, peau), peau); m.position.set(x, y, z); parent.add(m); return m; }
    return Object.entries(zones(f, peau)).map(([zn, g]) => { const m = new THREE.Mesh(g, peau[zn]); m.position.set(x, y, z); m.castShadow = !!g.userData.ombre; parent.add(m); return m; });
  };
  // un assemblage fondu en une géométrie par zone (une seule passe de dessin par zone) ; f = nom de forme + réglages, ou la liste de boîtes déjà calculée
  const EUL = new THREE.Euler(), QUA = new THREE.Quaternion(), M4 = new THREE.Matrix4(), UN = new V3(1, 1, 1);
  const zones = (f, peau, ...a) => {
    const par = {};
    for (const [zn, w, h, d, px, py, pz, r, ombre] of typeof f === 'string' ? FORMES[f](...a) : f) {
      const g = habille(geo('boite', w, h, d), peau[zn]).toNonIndexed(); M4.compose(new V3(px, py, pz), QUA.setFromEuler(EUL.set(...(r || [0, 0, 0]))), UN); g.applyMatrix4(M4);
      (par[zn] = par[zn] || { l: [], ombre: 0 }).l.push(g); if (ombre) par[zn].ombre = 1;
    }
    const out = {};
    for (const zn in par) {
      const l = par[zn].l, n = l.reduce((s, g) => s + g.attributes.position.count, 0), g = new THREE.BufferGeometry();
      for (const [k, sz] of [['position', 3], ['normal', 3], ['uv', 2]]) { const A = new Float32Array(n * sz); let o = 0; for (const p of l) { A.set(p.attributes[k].array, o); o += p.attributes[k].array.length; } g.setAttribute(k, new THREE.BufferAttribute(A, sz)); }
      g.userData.ombre = par[zn].ombre; out[zn] = g;
    }
    return out;
  };
  const LUMI = { lum: 1 }, LUMI2 = { lum: 1, side: THREE.DoubleSide }; // lumineuse par elle-même ; idem, visible des deux côtés

  // ciel en bandes (nuit, aube ou couchant selon la carte), étoiles, lune ou soleil
  const skyMat = mat('ciel', { lum: 1, side: THREE.BackSide, fog: false, net: 1 }, TH.sky, TH.stars);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2500, 16, 12), skyMat); scene.add(sky);
  const SD = new V3(...TH.astre.dir).normalize();
  const sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ fog: false, map: tx('astre', TH.astre.col, TH.astre.ombre) }));
  sunDisc.scale.set(TH.astre.taille, TH.astre.taille, 1); scene.add(sunDisc);

  const hemi = new THREE.HemisphereLight(...TH.hemi); scene.add(hemi); // bleu d'en haut, rebond magenta de la ville
  const sun = new THREE.DirectionalLight(...TH.sun); sun.castShadow = true; // clair de lune
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0015; sun.shadow.normalBias = 0.5;
  Object.assign(sun.shadow.camera, { left: -180, right: 180, top: 180, bottom: -180, near: 10, far: 800 });
  scene.add(sun, sun.target);

  // ---------- lumière dynamique : un seul calcul, ajouté dans le shader de tous les matériaux de la scène (onBeforeCompile) ----------
  // Ciel et lune / soleil restent ceux de three (avec leur ombre). Tout le reste est calculé ici, par pixel, avec la normale de la facette :
  // NL luminaires ponctuels (les plus proches le long de la piste + feux des voitures), le faisceau des phares à coupure nette,
  // l'ombre de la voiture par lancer de rayon sur sa boîte (elle balaie route et murs à chaque luminaire franchi),
  // et sur les surfaces brillantes (route mouillée, flaques = alpha de la texture, carrosserie) le reflet étiré de chaque source.
  const LUMS = [], lum = (i, x, y, z, col, r, k = 1, tun = 0) => LUMS.push({ i, x, y, z, c: new THREE.Color(col).multiplyScalar(k), r, tun, d: 0 });
  const NUIT = TH.phares / 2.6; // force des feux de voiture : pleine de nuit, faible à l'aube et au couchant
  const SUNC = new THREE.Color(TH.sun[0]).multiplyScalar(TH.sun[1]);
  const LUX = { uLP: { value: Array.from({ length: NL }, () => new THREE.Vector4(0, 0, 0, 1)) }, uLC: { value: Array.from({ length: NL }, () => new THREE.Color(0)) },
    uHP: { value: new V3() }, uHD: { value: new V3(1, 0, 0) }, uHC: { value: new THREE.Color(0xfff2d0).multiplyScalar(TH.phares * 1.25 * LUM_GAIN) }, uBox: { value: new THREE.Matrix4() },
    uSunD: { value: SD }, uSunC: { value: new THREE.Color() }, uSky: { value: new THREE.Color() }, uN: { value: 0 }, uRes: { value: new THREE.Vector2() } };
  const LU_V = `{ vec4 lw = vec4(transformed, 1.);
    #ifdef USE_INSTANCING
      lw = instanceMatrix * lw;
    #endif
    vLw = (modelMatrix * lw).xyz;
    if (uRes.x > 0.) gl_Position.xy = floor(gl_Position.xy / gl_Position.w * uRes + .5) / uRes * gl_Position.w;
    #ifdef USE_UV
      vAf = vec3(vUv, 1.) * gl_Position.w;
    #endif
    }
    `;
  const LU_H = `#define NL ${NL}
    uniform vec4 uLP[NL]; uniform vec3 uLC[NL]; uniform vec3 uHP, uHD, uHC, uSunD, uSunC, uSky; uniform mat4 uBox; uniform float uGloss, uRetro; uniform int uN; varying vec3 vLw;
    float luOmbre(vec3 p, vec3 d) { // 0 si la boîte de la voiture coupe le segment p → p + d ; un point dans la boîte ou à sa surface n'est pas ombré
      vec3 o = (uBox * vec4(p, 1.)).xyz, iv = 1. / (mat3(uBox) * d + 1e-5), t0 = (-1. - o) * iv, t1 = (1. - o) * iv, mn = min(t0, t1), mx = max(t0, t1);
      float a = max(max(mn.x, mn.y), mn.z), b = min(min(mx.x, mx.y), mx.z);
      return a < b && a > .005 && a < 1. ? 0. : 1.;
    }
    `;
  const LU_F = `{
      vec3 n = normalize(cross(dFdx(vLw), dFdy(vLw))), v = normalize(cameraPosition - vLw);
      if (dot(n, v) < 0.) n = -n;
      float g = uGloss + (1. - diffuseColor.a) * 2., plat = step(.8, n.y);
      vec3 dif = vec3(0.), spe = vec3(0.); vec2 rh = normalize(reflect(-v, n).xz + 1e-4);
      for (int i = 0; i < NL; i++) {
        if (i >= uN) break; // seulement les luminaires allumés
        vec3 d = uLP[i].xyz - vLw; float a = 1. - dot(d, d) / (uLP[i].w * uLP[i].w);
        if (a <= 0.) continue;
        a *= luOmbre(vLw, d); vec3 l = normalize(d);
        dif += uLC[i] * (a * a * max(dot(n, l), 0.));
        if (g > 0.) spe += uLC[i] * (a * mix(pow(max(dot(n, normalize(l + v)), 0.), 24.), pow(max(dot(rh, normalize(l.xz + 1e-4)), 0.), 40.), plat));
      }
      if (g > 0.) spe += plat * (uSunC * pow(max(dot(rh, normalize(uSunD.xz)), 0.), 50.) * 3.5 + uSky * .18);
      vec3 hv = vLw - uHP; float f = dot(hv, uHD);
      if (f > .5) { // phares : faisceau large, coupure horizontale nette (feu de croisement)
        vec3 hr = normalize(vec3(-uHD.z, 0., uHD.x));
        float m = smoothstep(1.3, .6, abs(dot(hv, hr)) / f) / (1. + f * f * .0006), lo = m * step(dot(hv, cross(hr, uHD)) / f, .075);
        dif += uHC * (lo * (.45 + .55 * max(dot(n, -normalize(hv)), 0.)));
        if (uRetro > 0.) dif += uHC * (m * uRetro); // catadioptres et panneaux : renvoient le faisceau, même au-dessus de la coupure
      }
      if (uRetro > 0.) gl_FragColor.rgb *= .3;
      gl_FragColor.rgb *= .55 + .45 * diffuseColor.a; // l'eau fonce le sol
      gl_FragColor.rgb += 1. - exp(-1.3 * (diffuseColor.rgb + .07) * dif) + spe * (g * (.12 + pow(1. - max(dot(n, v), 0.), 3.))); // même l'asphalte sombre répond ; les teintes claires saturent en douceur
    }
    `;
  const eclaire = m => { // branche un matériau sur la lumière dynamique ; userData.gloss = brillance, userData.retro = rétroréfléchissant
    if (m.userData.lu || !(m.isMeshBasicMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial)) return;
    m.userData.lu = 1;
    const lit = m.fog !== false && m.blending === THREE.NormalBlending; // le ciel et les plans additifs ne reçoivent rien, mais tremblent avec le reste
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, LUX, { uGloss: { value: m.userData.gloss || 0 }, uRetro: { value: m.userData.retro || 0 } });
      sh.vertexShader = 'varying vec3 vLw, vAf; uniform vec2 uRes;\n' + sh.vertexShader.replace('#include <fog_vertex>', LU_V + '#include <fog_vertex>');
      if (lit) sh.fragmentShader = LU_H + sh.fragmentShader.replace('#include <fog_fragment>', LU_F + '#include <fog_fragment>');
      // textures sans correction de perspective : vAf = uv × w, interpolé puis divisé par w interpolé, redonne l'interpolation affine à l'écran
      if (ST && ST.affine) sh.fragmentShader = 'varying vec3 vAf;\n' + sh.fragmentShader.replace('#include <map_fragment>', THREE.ShaderChunk.map_fragment.replace('vUv', `mix(vUv, vAf.xy / vAf.z, ${ST.affine.toFixed(3)})`));
    };
    m.customProgramCacheKey = () => 'lu' + lit;
  };
  const gloss = (m, g) => { m.userData.gloss = g; return m; }, retro = (m, r = 1.5) => { m.userData.retro = r; return m; };

  // ---------- matières additives (reflets, faisceaux, hologrammes) ----------
  const addMat = (map, o = {}) => new THREE.MeshBasicMaterial(Object.assign({ map, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, o));
  let signMats = []; const beacons = [], adMats = [];

  // ---------- géométrie de la piste (hauteurs relatives à l'altitude de la route) ----------
  function ribbon(i0, cnt, oa, ya, ob, yb, mat, vLen = 8) {
    const pos = [], uv = [], idx = [];
    for (let k = 0; k <= cnt; k++) {
      const s = S[(i0 + k) % N], nx = -s.tz, nz = s.tx;
      pos.push(s.x + nx * oa, s.y + ya, s.z + nz * oa, s.x + nx * ob, s.y + yb, s.z + nz * ob); uv.push(0, k * 2 / vLen, 1, k * 2 / vLen);
      if (k < cnt) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; scene.add(m); return m;
  }
  const across = s => Math.atan2(-s.tx, -s.tz); // rotation Y qui met l'axe X local en travers de la route
  const box = (w, h, d, mat, x, y, z, parent = scene) => { const m = new THREE.Mesh(habille(geo('boite', w, h, d), mat), mat); m.position.set(x, y, z); parent.add(m); return m; };

  const cT = T.t1 - T.t0, cO = N - cT; // sans tunnel : cT = 0, la route à ciel ouvert fait tout le tour
  // route : mouillée, elle renvoie en reflets étirés les phares, les néons, la lune ou le soleil (lumière dynamique)
  ribbon(T.t1, cO, -W, 0, W, 0, mat('chaussee', { side: THREE.DoubleSide, gloss: TH.route[6] ? 0.2 : 0.08 }, ...TH.route), 32);
  const barrier = mat('glissiere', { lum: TH.tubes, side: THREE.DoubleSide }, TH.mur); // ville : liseré néon, lumineux par lui-même ; ailleurs la glissière prend la lumière
  ribbon(T.t1, cO, -W, TH.murH, -W, -2, barrier); ribbon(T.t1, cO, W, TH.murH, W, -2, barrier);
  const concrete = mat('betonSombre', { side: THREE.DoubleSide }), glowY = mat('neonJaune', LUMI), glowC = mat('neonCyan', LUMI), glowM = mat('neonMagenta', LUMI);
  // tunnel : intérieur sombre, éclairé par ses luminaires (sur la ville : échangeur en alarme rouge qui bat avec la musique), coque sombre
  const tunMats = [];
  if (T.tun) {
    const u = TH.tun;
    tunMats.push(mat('chaussee', { lum: 1, side: THREE.DoubleSide, gloss: 0.3 }, ...u.sol), mat('paroi', LUMI2, u.murs[0], u.paroi, u.carreaux), mat('paroi', LUMI2, u.murs[1], u.paroi, u.carreaux), mat('plafond', LUMI2, u.plafond));
    tunMats.forEach((m, i) => m.color.setScalar(m.userData.amb = TH.alarme && (i === 1 || i === 2) ? 0.85 : TUN_AMB)); // ville : les parois gardent leurs bandes néon vives
    { // luminaires en quinconce, un à gauche, un à droite : la lumière et l'ombre de la voiture changent de côté à chaque luminaire franchi
      const d = new THREE.Object3D(), fx = u.neons.map(c => new THREE.InstancedMesh(geo('luminaireTunnel'), mat('peinture', { lum: 1, c, fog: false }), Math.ceil(cT / LUM_PAS))), nf = [0, 0];
      for (let i = T.t0 + 2, k = 0; i < T.t1 - 1; i += LUM_PAS, k++) {
        const s = S[i % N], sd = k & 1 ? 1 : -1, x = s.x - s.tz * sd * (W - 1.7), z = s.z + s.tx * sd * (W - 1.7);
        lum(i % N, x, s.y + 7.2, z, u.neons[k & 1], 21, 3, 1);
        d.position.set(x, s.y + 7.85, z); d.rotation.set(0, across(s), 0); d.updateMatrix(); fx[k & 1].setMatrixAt(nf[k & 1]++, d.matrix);
        if (k % 6 === 3) pose('boitierSecours', mat('peinture', { lum: 1, c: u.portail }), scene, [s.x - s.tz * (W - 0.1), s.y + 2.6, s.z + s.tx * (W - 0.1)]).rotation.y = across(s); // boîtier de secours lumineux sur la paroi de droite
      }
      fx.forEach((m, c) => { m.count = nf[c]; scene.add(m); });
    }
    ribbon(T.t0, cT, -W, 0, W, 0, tunMats[0], 32);
    ribbon(T.t0, cT, -W, 8, -W, 0, tunMats[1]); ribbon(T.t0, cT, W, 8, W, 0, tunMats[2]); ribbon(T.t0, cT, -W, 8, W, 8, tunMats[3]);
    for (const [oa, ya, ob, yb] of [[-W - 1.5, 10, -W - 1.5, -u.coque], [W + 1.5, 10, W + 1.5, -u.coque], [-W - 1.5, 10, W + 1.5, 10]]) ribbon(T.t0, cT, oa, ya, ob, yb, concrete).castShadow = true;
    const pm = mat('peinture', { lum: 1, c: u.portail });
    for (const i of [T.t0, T.t1]) { // portails lumineux
      const s = S[i], g = new THREE.Group(); g.position.set(s.x, s.y, s.z); g.rotation.y = across(s); scene.add(g);
      pose('portailTunnel', { portail: pm }, g, [0, 0, 0], W);
    }
  }
  const FEUX = []; // les trois feux du portique, un par chiffre du décompte
  { // ligne et portique de départ
    const s = S[0], g = new THREE.Group(); g.position.set(s.x, s.y, s.z); g.rotation.y = across(s); scene.add(g);
    const css = n => '#' + n.toString(16).padStart(6, '0'), acc = css(TH.depart[0]), ossature = css(TH.depart[1]);
    pose('depart', {
      sol: mat('damierBande', { lum: 1, net: 1 }, TH.depart[2], 1), damier: mat('damierBande', { lum: 1, net: 1 }, TH.depart[2], 0.45),
      beton: mat('beton'), acier: mat('acier', { c: TH.depart[1] }), treillis: mat('treillisPortique', { alphaTest: 0.5, side: THREE.DoubleSide }, ossature),
      nom: mat('bandeauNom', { lum: 1, net: 1 }, acc, M.nom, TH.depart[2]), boitier: mat('matGris'), feu0: FEUX[0] = mat('peinture', { lum: 1 }), feu1: FEUX[1] = mat('peinture', { lum: 1 }), feu2: FEUX[2] = mat('peinture', { lum: 1 }), lampe: mat('lampe', { lum: 1 }),
    }, g, [0, 0, 0], W);
    lum(0, s.x, s.y + 8, s.z, 0xfff2d0, 24, 1.3);
  }
  { // chevrons à l'extérieur des virages, piles du viaduc, tubes néon en bord de route (repères de vitesse)
    const dummy = new THREE.Object3D();
    const sg = [0, 1].map(f => new THREE.InstancedMesh(geo('chevron'), mat('chevron', { lum: 1, side: THREE.DoubleSide, retro: 1.5 }, f), 600)), cnt = [0, 0]; // rétroréfléchissants : ils s'allument dans les phares
    const piles = new THREE.InstancedMesh(habille(geo('pileViaduc'), concrete), concrete, 60); let np = 0;
    const tubes = [glowM, glowC].map(m => new THREE.InstancedMesh(geo('tubeNeon'), m, 200)), nt = [0, 0];
    const streaks = ['#ff2bd6', '#00f0ff'].map(c => new THREE.InstancedMesh(geo('refletTube'), addMat(tx('degrade', c)), 200));
    for (let i = 0; i < N; i++) {
      const s = S[i], nx = -s.tz, nz = s.tx, inT = zone(i, 0) === 1;
      dummy.scale.set(1, 1, 1); dummy.rotation.set(0, across(s), 0);
      if (TH.tubes && i % 10 === 0 && !inT) { const k = i / 10, sd = (k >> 1) & 1 ? 1 : -1; lum(i, s.x + nx * sd * (W - 0.5), s.y + 3, s.z + nz * sd * (W - 0.5), [0xff2bd6, 0x00f0ff][(k & 1) ^ (sd > 0 ? 1 : 0)], 17, 0.8); } // un tube sur deux éclaire vraiment : magenta, cyan, d'un côté puis de l'autre
      if (TH.tubes && i % 10 === 0 && !inT) for (const sd of [-1, 1]) {
        const c = (i / 10 & 1) ^ (sd > 0 ? 1 : 0);
        dummy.position.set(s.x + nx * sd * (W + 0.9), s.y + 3.5, s.z + nz * sd * (W + 0.9)); dummy.updateMatrix(); tubes[c].setMatrixAt(nt[c], dummy.matrix);
        dummy.rotation.order = 'YXZ'; dummy.rotation.set(-Math.PI / 2, across(s), 0); dummy.scale.set(sd > 0 ? -1 : 1, 1, 1); // à plat, côté lumineux vers le tube
        dummy.position.set(s.x + nx * sd * (W - 3.2), s.y + 0.05, s.z + nz * sd * (W - 3.2)); dummy.updateMatrix(); streaks[c].setMatrixAt(nt[c]++, dummy.matrix);
        dummy.rotation.order = 'XYZ'; dummy.rotation.set(0, across(s), 0); dummy.scale.set(1, 1, 1);
      }
      if (TH.piles != null && i % 30 === 0 && !inT) { const b = TH.piles + 1; dummy.position.set(s.x, (s.y - 1 + b) / 2, s.z); dummy.scale.set(1, Math.max(0.1, s.y - 1 - b), 1); dummy.updateMatrix(); piles.setMatrixAt(np++, dummy.matrix); dummy.scale.set(1, 1, 1); }
      if (TH.chev && i % 6 === 0 && Math.abs(s.k) > 0.006 && cnt[s.k > 0 ? 0 : 1] < 600) {
        const f = s.k > 0 ? 0 : 1, side = s.k > 0 ? -1 : 1, off = inT ? W - 0.2 : W + 0.6;
        dummy.position.set(s.x + nx * side * off, s.y + 3, s.z + nz * side * off); dummy.lookAt(s.x, s.y + 3, s.z); dummy.updateMatrix();
        sg[f].setMatrixAt(cnt[f]++, dummy.matrix);
      }
    }
    sg.forEach((m, f) => { m.count = cnt[f]; scene.add(m); }); piles.count = np; scene.add(piles);
    tubes.forEach((m, c) => { m.count = nt[c]; scene.add(m); streaks[c].count = nt[c]; scene.add(streaks[c]); });
  }

  // reflets sur la route mouillée : liseré des glissières dehors, néons des murs dans l'échangeur (ceux-là battent avec la musique)
  for (const sd of [-1, 1]) {
    if (TH.reflets) ribbon(T.t1, cO, sd * W, 0.04, sd * (W - 4), 0.04, addMat(tx('degrade', TH.reflets)));
    if (T.tun && TH.tun.reflets) { const m = addMat(tx('degrade', TH.tun.reflets[sd < 0 ? 0 : 1])); ribbon(T.t0, cT, sd * W, 0.04, sd * (W - 5), 0.04, m); tunMats.push(m); }
  }
  if (TH.pubs) { // portiques au-dessus de la route, avec écran publicitaire qui défile
    for (const [i, txt] of ['ネオン // SPEED // 危険 // ', '電脳 CITY ★ 24H ★ ', '>>> NOODLE BAR >>> ホテル '].entries()) {
      const c = ['#ff2bd6', '#00f0ff', '#fcee0a'][i];
      adMats.push(mat('ecranPub', LUMI, c, txt));
    }
    for (let i = 70, k = 0; i < N; i += 90) {
      if (zone(i, 40) > 0) continue;
      const s = S[i], gr = new THREE.Group(); gr.position.set(s.x, s.y, s.z); gr.rotation.y = across(s); scene.add(gr);
      lum(i, s.x, s.y + 9, s.z, [0xff2bd6, 0x00f0ff, 0xfcee0a][k % 3], 24, 1.2); // l'écran éclaire la route sous lui
      pose('portiquePub', { ecran: adMats[k++ % 3], beton: concrete }, gr, [0, 0, 0], W);
    }
  }

  // ---------- ville (carte d'origine) ; les décors des autres cartes sont dans decors.js ----------
  let beams = [], holos = [], MV = 0, mvP, mvV, mvC, mvGeo, movers, beaconPts, decorTick = null;
  if (TH.decor === 'ville') {
  { // sol : grille de rues éclairées vue d'en haut
    box(5000, 1, 5000, mat('rues', { lum: 1, rep: [70, 70] }), 0, -60.5, 200);
  }
  {
    const emi = (cols, p) => mat('fenetres', { emissive: 0xffffff, emissiveMap: tx('fenetresAllumees', cols, p) });
    const mats = [emi(['#ffd27a', '#ffe9b0'], 0.45), emi(['#7af0ff', '#d0f8ff'], 0.4), emi(['#ff5ad0', '#ffd27a', '#7af0ff'], 0.5), emi(['#ffd27a'], 0.12)];
    const signs = signMats = ['ネオン', 'スピード', '危険', 'ホテル', '電脳', 'BAR', 'NOODLE', '24H'].map((txt, i) => {
      const c = ['#ff003c', '#00f0ff', '#fcee0a', '#ff4fc8'][i % 4];
      return mat('enseigne', LUMI, c, txt);
    });
    const toits = [], machines = [], cuves = [], D = new THREE.Object3D(); // toits : dalle et acrotère, groupes froids, réservoirs d'eau (sans tirage de rnd : la ville ne bouge pas)
    const surLeToit = (m, w, d, y, k) => { const c = Math.cos(m.rotation.y), s = Math.sin(m.rotation.y), at = (ox, oz) => [m.position.x + c * ox + s * oz, m.position.z - s * ox + c * oz];
      toits.push([...at(0, 0), y + 0.6, m.rotation.y, w + 0.6, 1.2, d + 0.6]);
      if (k >= 0) { machines.push([...at(-0.4 * w, -0.38 * d), y + 1.6, m.rotation.y]); machines.push([...at(-0.4 * w, -0.38 * d + 4), y + 1.6, m.rotation.y]); if (k % 2) cuves.push([...at(0.4 * w, -0.4 * d), y + 3.4, 0]); } };
    for (let gx = -620; gx <= 820; gx += 64) for (let gz = -260; gz <= 780; gz += 64) {
      const x = gx + rnd() * 24 - 12, z = gz + rnd() * 24 - 12, w = 28 + rnd() * 22, d = 28 + rnd() * 22, top = 24 + rnd() * rnd() * 150;
      const lim = (W + 4 + 0.71 * Math.max(w, d)) ** 2;
      if (S.some((s, i) => i % 3 === 0 && (s.x - x) ** 2 + (s.z - z) ** 2 < lim)) continue;
      const H = top + 60, m = new THREE.Mesh(geo('immeuble', w, H, d), mats[rnd() * mats.length | 0]);
      m.position.set(x, top - H / 2, z); m.rotation.y = (rnd() - 0.5) * 0.6; m.castShadow = m.receiveShadow = true; scene.add(m);
      surLeToit(m, w, d, top, toits.length);
      if (rnd() < 0.55) { const h2 = 8 + rnd() * 45, tw = w * (0.4 + rnd() * 0.3), td = d * (0.4 + rnd() * 0.3), tm = box(tw, h2, td, m.material, 0, H / 2 + h2 / 2, 0, m); tm.castShadow = true; surLeToit(m, tw, td, top + h2, -1); } // étage en retrait
      if (rnd() < 0.45) { const ah = 10 + rnd() * 35; box(0.8, ah, 0.8, concrete, w * 0.35, H / 2 + ah / 2, d * 0.35, m); beacons.push(x + w * 0.35, top + ah + 1, z + d * 0.35); } // antenne et balise rouge
      for (let k = rnd() * 4 | 0; k > 0; k--) { // 0 à 3 enseignes de tailles variées, horizontales ou en drapeau vertical
        const sm = signs[rnd() * signs.length | 0], sd = rnd() < 0.5 ? -1 : 1, y = Math.max(6, Math.min(top - 5, 6 + rnd() * 45)) - m.position.y;
        const tall = rnd() < 0.35, sw = tall ? 5 : 10 + rnd() * 14, sh = tall ? 14 + rnd() * 10 : sw / 2, o = (rnd() - 0.5) * 0.5;
        if (rnd() < 0.5) box(0.5, sh, sw, sm, sd * (w / 2 + 0.3), y, o * d, m); else box(sw, sh, 0.5, sm, o * w, y, sd * (d / 2 + 0.3), m);
      }
    }
    for (const [l, g, mt] of [[toits, geo('bloc'), concrete], [machines, geo('clim'), mat('matGris')], [cuves, geo('reservoir'), mat('acier')]]) {
      const im = new THREE.InstancedMesh(habille(g, mt), mt, l.length);
      l.forEach(([x, z, y, ry, sx = 1, sy = 1, sz = 1], i) => { D.position.set(x, y, z); D.rotation.set(0, ry, 0); D.scale.set(sx, sy, sz); D.updateMatrix(); im.setMatrixAt(i, D.matrix); }); scene.add(im);
    }
  }
  // ---------- horizon et vie de la ville ----------
  { // mégatours lointaines, hors brouillard : silhouettes piquées de fenêtres sur le halo de l'horizon
    const far = mat('tourLoin', { lum: 1, fog: false }, '#0d0820', ['#ffd27a', '#7af0ff', '#ff5ad0'], 70);
    const im = new THREE.InstancedMesh(geo('bloc'), far, 44), D = new THREE.Object3D(); // une seule passe de dessin pour les 44
    for (let i = 0; i < 44; i++) { const a = i / 44 * 6.283 + rnd() * 0.1, rad = 1150 + rnd() * 500, h = 200 + rnd() * rnd() * 600, w = 60 + rnd() * 90; D.position.set(100 + Math.cos(a) * rad, h / 2 - 60, 250 + Math.sin(a) * rad); D.scale.set(w, h, w); D.updateMatrix(); im.setMatrixAt(i, D.matrix); }
    scene.add(im);
  }
  // faisceaux de projecteurs qui balaient le ciel
  const beamGeo = geo('faisceau');
  beams = [[320, 120], [-120, 330], [520, -120], [80, 660], [-420, 60], [700, 420]].map(([x, z], i) => { const b = new THREE.Mesh(beamGeo, addMat(tx('degrade', ['#5a7cff', '#ff2bd6', '#00f0ff'][i % 3], true), { opacity: 0.5 })); b.position.set(x, -60, z); scene.add(b); return b; });
  // hologrammes géants : les enseignes en lumière pure, qui tournent et grésillent
  holos = [[250, 150, 210], [-160, 165, 300], [450, 140, -90], [0, 185, 640], [640, 170, 520]].map(([x, y, z], i) => { const h = new THREE.Mesh(geo('hologramme'), addMat(signMats[i].map, { opacity: 0.6 })); h.position.set(x, y, z); scene.add(h); return h; });
  // trafic : véhicules volants entre les tours et phares dans les rues en contrebas (un point lumineux chacun)
  MV = 110; mvP = new Float32Array(MV * 3); mvV = new Float32Array(MV * 2); mvC = new Float32Array(MV * 3); mvGeo = new THREE.BufferGeometry();
  for (let i = 0; i < MV; i++) {
    const air = i < 45, ax = rnd() < 0.5, v = (air ? 35 + rnd() * 60 : 14 + rnd() * 22) * (rnd() < 0.5 ? -1 : 1), cell = 5000 / 70, snap = (p, o) => o + Math.round((p - o) / cell) * cell;
    let x = -700 + rnd() * 1600, z = -350 + rnd() * 1200;
    if (!air) { if (ax) z = snap(z, -2300); else x = snap(x, -2500); } // au sol : calé sur la grille des rues
    mvP.set([x, air ? 25 + rnd() * 150 : -59.5, z], i * 3); mvV.set(ax ? [v, 0] : [0, v], i * 2);
    mvC.set(air ? [[1, 1, 1], [1, 0.1, 0.2], [0.2, 0.9, 1]][i % 3] : [[1, 0.7, 0.3], [1, 1, 0.9]][i % 2], i * 3);
  }
  mvGeo.setAttribute('position', new THREE.BufferAttribute(mvP, 3)); mvGeo.setAttribute('color', new THREE.BufferAttribute(mvC, 3));
  movers = new THREE.Points(mvGeo, new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true, fog: false })); movers.frustumCulled = false; scene.add(movers);
  const beaconGeo = new THREE.BufferGeometry(); beaconGeo.setAttribute('position', new THREE.Float32BufferAttribute(beacons, 3));
  beaconPts = new THREE.Points(beaconGeo, new THREE.PointsMaterial({ color: 0xff2030, size: 2, sizeAttenuation: false, fog: false })); scene.add(beaconPts);
  } else decorTick = window.DECORS[TH.decor]({ THREE, scene, T, S, N, W, M, TH, ribbon, rnd, across, zone, lum, geo, mat, pose, zones, habille, temps: () => race ? -1 : tTraf }); // pas de trafic en course : les adversaires ne savent pas l'éviter

  // pluie : traînées nettes qui s'allongent et foncent vers la caméra avec la vitesse, penchées par le vent ; tête claire, queue qui s'éteint (mélange additif, aucun flou)
  // force 1 = 400 gouttes ; au-delà (averse, zones de pluie > 1), plus de gouttes, plus longues ; et des impacts qui rejaillissent sur la chaussée devant la voiture
  const RN = 2400, rainP = new Float32Array(RN * 3), rainGeo = new THREE.BufferGeometry(), rainV = new Float32Array(RN * 6), rainC = new Float32Array(RN * 6);
  const alea = (k => () => (k = k * 16807 % 2147483647) / 2147483647)(11); // hasard à part : la suite de rnd ne bouge pas (seules les 400 premières gouttes la tirent, comme avant)
  for (let i = 0; i < RN; i++) { const r = i < 400 ? rnd : alea; rainP.set([r() * 80 - 40, r() * 30, r() * 80 - 40], i * 3); }
  for (let i = 0; i < RN; i++) { const b = 0.45 + 0.55 * alea(); rainC.set([0.62 * b, 0.8 * b, b, 0.08 * b, 0.12 * b, 0.2 * b], i * 6); } // proches et lointaines : des gouttes plus ou moins claires
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainV, 3)); rainGeo.setAttribute('color', new THREE.BufferAttribute(rainC, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }));
  rain.frustumCulled = false; scene.add(rain);
  const SN = 300, splP = new Float32Array(SN * 3), splC = new Float32Array(SN * 3), splA = new Float32Array(SN).map(() => alea() * 0.14), splD = new Float32Array(SN), splGeo = new THREE.BufferGeometry(); // impacts : vie de 0,14 s
  splGeo.setAttribute('position', new THREE.BufferAttribute(splP, 3)); splGeo.setAttribute('color', new THREE.BufferAttribute(splC, 3));
  const splash = new THREE.Points(splGeo, new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }));
  splash.frustumCulled = false; scene.add(splash);

  // ---------- voiture : géométrie dans formes-voitures.js, livrée dans textures-voitures.js ; ici le placement, les roues qui tournent et braquent, les feux stop, le roulis ----------
  const carG = new THREE.Group(), body = new THREE.Group(); carG.add(body); scene.add(carG);
  const L = CARD.look, K = { MAZDA: 'fd', TOYOTA: 'a80', RENAULT: 'r5', DODGE: 'gts' }[CARD.nom.split(' ')[0]] || 'gtr'; // shortcut: déduit du nom, à remplacer par un champ look.type si cartes.js en gagne un
  const VO = FORMES.voiture(K), livree = col => mat('livree', { gloss: 0.9 }, VO.plan, col, L.bandes || 0); // une livrée par teinte : celle du joueur, une par adversaire
  const carMat = livree(L.col), brakeMat = new THREE.MeshBasicMaterial({ color: 0x8a1020 }), lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2d0 });
  const part = (ge, mat, x, y, z, parent = body) => { const m = new THREE.Mesh(ge, mat); m.position.set(x, y, z); parent.add(m); return m; };
  const peau = { caisse: carMat, noir: gloss(mat('garniture'), 0.4), phare: lampMat, feu: brakeMat };
  for (const zn in VO.zones) part(VO.zones[zn], peau[zn], 0, 0, 0);
  const [xr, xf, zr, zf, rr, tw] = VO.roues, wheelGeo = FORMES.roueVoiture(rr, tw), roueMat = mat('roueVoiture', {}, K), wheels = [];
  for (const i of [0, 1]) for (const sg of [-1, 1]) {
    const st = new THREE.Group(); st.position.set(i ? xf : xr, rr, sg * (i ? zf : zr)); carG.add(st);
    wheels.push({ sp: part(wheelGeo, roueMat, 0, 0, 0, st), st: i ? st : null, r: rr });
  }
  carG.traverse(o => { o.castShadow = true; });
  // encombrement de la voiture : la boîte d'ombre de la lumière dynamique (BOITE) et le fantôme en prennent les dimensions
  const ENC = new THREE.Box3().setFromObject(carG), ENCt = ENC.getSize(new V3()), ENCc = ENC.getCenter(new V3());
  if (L.neon) for (const z of [-1, 1]) box(3, 0.07, 0.05, new THREE.MeshBasicMaterial({ color: L.neon }), 0, VO.plan.bas - 0.02, z * (VO.plan.w / 2 - 0.05), body); // liserés néon sous le bas de caisse

  // traînées lumineuses des feux arrière : deux rubans tirés sur les dernières positions
  const flames = [-0.5, 0.5].map(z => { const g = new THREE.ConeGeometry(0.17, 1.6, 5); g.translate(0, 0.8, 0); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x60d0ff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false })); m.rotation.z = Math.PI / 2; m.position.set(ENC.min.x, 0.42, z); m.visible = false; carG.add(m); return m; }); // pointe vers l'arrière
  const TN = 18, hist = [], trailP = new Float32Array(TN * 12), trailC = new Float32Array(TN * 12), trailGeo = new THREE.BufferGeometry(), trailI = [];
  for (let l = 0; l < 2; l++) for (let k = 0; k < TN - 1; k++) { const a = (l * TN + k) * 2; trailI.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailP, 3)); trailGeo.setAttribute('color', new THREE.BufferAttribute(trailC, 3)); trailGeo.setIndex(trailI);
  const trail = new THREE.Mesh(trailGeo, addMat(null, { vertexColors: true, polygonOffset: false })); trail.frustumCulled = false; scene.add(trail);

  // particules additives : fumée de pneus, étincelles contre les murs, flammes d'échappement
  const PN = 320, pP = new Float32Array(PN * 3), pC = new Float32Array(PN * 3), pV = new Float32Array(PN * 3), pB = new Float32Array(PN * 3), pL = new Float32Array(PN), pM = new Float32Array(PN), pGv = new Float32Array(PN), pGeo = new THREE.BufferGeometry();
  let pi = 0;
  pGeo.setAttribute('position', new THREE.BufferAttribute(pP, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pC, 3));
  const parts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 1.1, vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false })); parts.frustumCulled = false; scene.add(parts);
  function emit(x, y, z, vx, vy, vz, life, r, gg, b, grav) { const i = pi++ % PN; pP.set([x, y, z], i * 3); pV.set([vx, vy, vz], i * 3); pB.set([r, gg, b], i * 3); pL[i] = pM[i] = life; pGv[i] = grav; }

  let flashT = 0, nextFlash = 6;
  const FLASH = new THREE.Color(0x8fa0ff), jit = a => (Math.random() - 0.5) * a;
  // effets visuels par image
  function fxFrame(dt, now, sp, inp, hit, fx, fz) {
    const rx = -fz, rz = fx;
    for (const w of wheels) { w.sp.rotation.z -= car.vf * dt / w.r; if (w.st) w.st.rotation.y = -car.steer * 0.45; }
    brakeMat.color.setHex(inp.brake ? 0xff7080 : 0x8a1020);
    // traînées
    hist.unshift([car.x + fx * ENC.min.x, carY + 0.72, car.z + fz * ENC.min.x, rx, rz]); if (hist.length > TN) hist.length = TN;
    const bst = car.boost > 0, glow = Math.min(1, sp / 15) * (inp.brake || bst ? 1 : 0.4);
    for (let l = 0; l < 2; l++) for (let k = 0; k < TN; k++) {
      const h = hist[Math.min(k, hist.length - 1)], sd = l ? 0.78 : -0.78, a = (l * TN + k) * 6, f = (1 - k / TN) ** 2 * glow;
      trailP.set([h[0] + h[3] * sd, h[1] + 0.1, h[2] + h[4] * sd, h[0] + h[3] * sd, h[1] - 0.1, h[2] + h[4] * sd], a);
      trailC.set(bst ? [f * 0.2, f * 0.8, f, f * 0.2, f * 0.8, f] : [f, f * 0.08, f * 0.16, f, f * 0.08, f * 0.16], a);
    }
    trailGeo.attributes.position.needsUpdate = trailGeo.attributes.color.needsUpdate = true;
    // émissions
    if (car.slide > 0.3 && sp > 10) for (const sd of [-0.9, 0.9]) emit(car.x - fx * 1.4 + rx * sd, carY + 0.2, car.z - fz * 1.4 + rz * sd, car.vx * 0.25 + jit(4), 1 + Math.random() * 2.5, car.vz * 0.25 + jit(4), 0.9, lerp(0.16, 0.28, lm), lerp(0.18, 0.06, lm), lerp(0.28, 0.06, lm), -1);
    if (hit > 3) { const s = S[car.idx], sg = Math.sign(car.d); for (let i = 0; i < 16; i++) emit(car.x - s.tz * sg, carY + 0.5, car.z + s.tx * sg, car.vx * 0.5 + jit(14), 2 + Math.random() * 7, car.vz * 0.5 + jit(14), 0.5, 1, 0.75, 0.25, 22); }
    else if (car.rub && sp > 8) { const s = S[car.idx], sg = Math.sign(car.d); for (let i = 0; i < 3; i++) emit(car.x - s.tz * sg, carY + 0.4, car.z + s.tx * sg, car.vx * 0.6 + jit(5), 1 + Math.random() * 4, car.vz * 0.6 + jit(5), 0.35, 1, 0.75, 0.25, 22); } // frottement continu : gerbe plus fine que le choc
    for (const fl of flames) { fl.visible = car.boost > 0; fl.scale.y = (0.5 + Math.random() * 0.7) * Math.min(1, car.boost * 2); } // boost : deux flammes d'échappement qui vacillent, les traînées virent au bleu
    if (car.dd && sp > 10) { const ok = car.driftT > 0.6; for (const sd of [-0.9, 0.9]) emit(car.x - fx * 1.4 + rx * sd, carY + 0.15, car.z - fz * 1.4 + rz * sd, car.vx * 0.5 + rx * sd * 3 + jit(3), 1 + Math.random() * 3, car.vz * 0.5 + rz * sd * 3 + jit(3), 0.3, ok ? 1 : 0.3, ok ? 0.55 : 0.6, ok ? 0.1 : 1, 14); } // glisse : étincelles aux roues arrière, bleues puis orange quand le boost est acquis
    for (let i = 0; i < PN; i++) {
      if (pL[i] <= 0) continue;
      pL[i] -= dt; const j = i * 3, f = Math.max(0, pL[i] / pM[i]);
      pV[j + 1] -= pGv[i] * dt; pP[j] += pV[j] * dt; pP[j + 1] += pV[j + 1] * dt; pP[j + 2] += pV[j + 2] * dt;
      pC[j] = pB[j] * f; pC[j + 1] = pB[j + 1] * f; pC[j + 2] = pB[j + 2] * f;
    }
    pGeo.attributes.position.needsUpdate = pGeo.attributes.color.needsUpdate = true;
    // éclairs : flash double sur le ciel, la brume et l'éclairage, puis le tonnerre
    if (TH.orage && (nextFlash -= dt) < 0) { nextFlash = 7 + Math.random() * 14; flashT = 0.36; if (lm < 0.5) SON.tonnerre(); }
    flashT -= dt; const fl = flashT > 0 && lm < 0.5 ? ((flashT * 14 | 0) & 1 ? 1 : 0.3) : 0;
    hemi.intensity = TH.hemi[2] * (1 - 0.75 * lm) + 3 * fl; sun.intensity = TH.sun[1] * (1 - lm); // en tunnel, ciel et astre s'effacent : il ne reste que les luminaires skyMat.color.multiplyScalar(1 + 2.5 * fl); scene.fog.color.lerp(FLASH, 0.45 * fl);
    // ville : enseignes qui clignotent, grésillent ou défilent ; écrans, hologrammes, projecteurs, trafic, balises
    signMats.forEach((m, i) => { m.color.setScalar(i % 3 === 0 ? ((now / 400 + i) & 1 ? 1 : 0.25) : i % 3 === 1 && Math.random() < 0.04 ? 0.3 : 1); if (i % 2) m.map.offset.x += dt * 0.12; });
    adMats.forEach((m, i) => { m.map.offset.x += dt * (0.2 + 0.1 * i); });
    holos.forEach((h, i) => { h.rotation.y += dt * 0.25; h.material.opacity = 0.45 + 0.2 * Math.sin(now * 0.004 + i) - (Math.random() < 0.05 ? 0.3 : 0); });
    beams.forEach((b, i) => b.rotation.set(0, Math.atan2(cam.position.x - b.position.x, cam.position.z - b.position.z), Math.sin(now * 0.0004 * (i % 3 + 1) + i) * 0.5));
    for (let i = 0; i < MV; i++) {
      let x = mvP[i * 3] + mvV[i * 2] * dt, z = mvP[i * 3 + 2] + mvV[i * 2 + 1] * dt;
      mvP[i * 3] = x < -700 ? x + 1600 : x > 900 ? x - 1600 : x; mvP[i * 3 + 2] = z < -350 ? z + 1200 : z > 850 ? z - 1200 : z;
    }
    if (mvGeo) { mvGeo.attributes.position.needsUpdate = true; beaconPts.visible = (now / 700 & 1) === 1; }
    if (decorTick) decorTick(dt, now, car);
  }

  const ghostM = box(ENCt.x, ENCt.y, ENCt.z, addMat(null, { color: 0x00f0ff, opacity: 0.4, polygonOffset: false }), 0, 0, 0); ghostM.visible = false; // fantôme : simple silhouette lumineuse
  // adversaires du mode course : copies de la voiture du joueur, une couleur chacune (roues fixes) ; [nom, couleur]
  const OPP = [['KENJI', '#00c8ff'], ['REI', '#ff8a00'], ['JUN', '#40ff80']].map(([n, c], i) => [M.rivaux ? M.rivaux[i] : n, c]);
  const opps = OPP.map(([, col]) => {
    const g = carG.clone(), m = livree(new THREE.Color(col).getHex()), b = brakeMat.clone(); m.emissive.setRGB(1, 1, 1); m.emissiveMap = m.map; m.emissiveIntensity = 0.3; // un peu lumineuse : lisible de nuit et de loin
    g.traverse(o => { if (o.material === carMat) o.material = m; else if (o.material === brakeMat) o.material = b; });
    g.visible = false; g.userData.y = 0; scene.add(g); return g;
  });
  scene.traverse(o => { if (o.isInstancedMesh) o.frustumCulled = false; if (o.material) eclaire(o.material); }); // r128 calcule le culling sur la géométrie de base, pas sur les instances

  // ---------- audio : voir audio.js (window.SON) ; ici seulement ce que le jeu et le HUD lisent ----------
  let stun = 0, gear = 0, rpm = 0.3, load = 0, spool = 0, radioT = 0;
  const zap = () => { SON.setStation(SON.station + 1); radioT = 2.5; };
  // boîte et régime : calculés même sans audio, la jauge du HUD s'en sert
  function drivetrain(dt, r, gas) { // rapport et régime viennent de la physique (sim.js) ; ici on les lisse pour le son et la jauge
    const up = Math.sign(car.gear - gear); gear = car.gear; // +1 rapport monté, -1 descendu
    let tgt = car.rpm / CARD.red;
    if (state === 'count' && gas) tgt = 0.8 + 0.05 * Math.sin(performance.now() / 22); // rupteur sur la grille
    rpm += (tgt - rpm) * Math.min(1, dt * 14); load += ((car.shiftT > 0 ? 0 : gas) - load) * Math.min(1, dt * 12); spool += ((gas ? rpm : 0) - spool) * Math.min(1, dt * 2.5);
    return up;
  }

  // ---------- état de jeu ----------
  // clés « vpr6. » : la conduite a changé de principe (braquage direct, glisse au frein à main tenu), les anciens records ne sont plus comparables
  // une série de records par carte ; la ville garde ses clés d'origine
  const PRE = 'vpr6.' + (M.id === 'ville' ? '' : M.id + '.');
  const store = { get: k => { try { return JSON.parse(localStorage.getItem(PRE + k)); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(PRE + k, JSON.stringify(v)); } catch (e) { } } };
  const pref = (k, d) => { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }, setPref = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
  let msel = 3, partir = false; // ligne du menu principal ; changement de carte en cours
  // écran d'accueil : le navigateur n'autorise le son qu'après un geste ; on le demande d'abord, pour que la musique soit là quand le menu s'affiche
  let accueil = true;
  const entrer = () => { SON.init(); accueil = false; };
  try { const m = sessionStorage.getItem('vpr.menu'); if (m) { msel = 0; sessionStorage.removeItem('vpr.menu'); entrer(); SON.reprendre(JSON.parse(m)); } } catch (e) { } // la musique de menu reprend où elle en était // on vient de changer de carte : on reste sur cette ligne, sans repasser par l'accueil (le navigateur garde en général le droit au son d'une page à l'autre ; sinon il revient à la touche suivante)
  for (const ev of ['mousedown', 'pointerup', 'touchend']) addEventListener(ev, () => { if (accueil) entrer(); else SON.init(); }); // un clic ou un appui valent une touche
  const fmt = t => `${t / 60 | 0}'${String(t % 60 | 0).padStart(2, '0')}"${String(t * 100 % 100 | 0).padStart(2, '0')}`;
  let lookA = 0, lookP = 0, lookT = 0; // caméra libre à la souris : angle autour de la voiture, hauteur en plus, délai avant retour
  addEventListener('mousemove', e => { if (state !== 'race' && state !== 'count') return; lookA = clamp(lookA + e.movementX * 0.006, -Math.PI, Math.PI); lookP = clamp(lookP + e.movementY * 0.03, -1, 5); lookT = 2.5; });
  let car = newCar(T), state = 'title', tRace = 0, best = store.get('best') || 0, count = 0, shown = 0, goT = 0, acc = 0, last = 0, cth = car.th, lm = 0, carY = S[car.idx].y, pitch = 0, result = null, manual = pref('vpr.boite', 'a') === 'm';
  // secteurs (entrée et sortie de l'échangeur) et fantôme du record : [x, y, z, cap] à 20 Hz
  // mode : 'solo' (contre-la-montre à tours enchaînés) ou 'course' (3 tours contre les IA de sim.js) ; race = la course en cours, sinon null
  let mode = pref('vpr6.mode', '') === '"course"' ? 'course' : 'solo', race = null, raceEnd = false; // le mode est mémorisé une fois pour toutes les cartes
  let si = 0, cur = [], bestSpl = store.get('splits'), ghost = store.get('ghost'), recG = [], splitMsg = null, lapN = 1, rLap = 0, rLapT = 0, prev = 'race', psel = 0, ghostOn = !!store.get('ghostOn');
  const keys = {}, H = 1 / 120;
  let diff = clamp(+pref('vpr6.diff', 1) | 0, 0, DIFF.length - 1); // difficulté du mode course (DIFF de sim.js)
  // médailles du contre-la-montre : le tour lancé du pilote automatique sert de référence ; M.med = [bronze, argent, or] en multiples de ce temps
  const REF = (() => { const c = newCar(T); let t = 0, t1 = 0; while (c.dist < 2 * N && t < 900) { step(c, autopilot(c, T), T, H); t += H; if (!t1 && c.dist >= N) t1 = t; } return t - t1; })();
  const MED = M.med || [1.1, 1.03, 0.97], MEDN = ['BRONZE', 'ARGENT', 'OR'], MEDC = ['#c87a3a', '#c8ccd4', '#ffd23a'];
  const medal = t => t ? MED.filter(k => t <= REF * k).length : 0; // 0 aucune, 1 bronze, 2 argent, 3 or
  let lap0 = [0, 0, 0], bestLap = 0; // compteurs de glisse au début du tour (glisses, boosts, murs) ; meilleur tour du joueur en course
  const bilan = () => { const b = [car.nDrift - lap0[0], car.nBoost - lap0[1], car.nWall - lap0[2], car.comboMax]; lap0 = [car.nDrift, car.nBoost, car.nWall]; car.comboMax = car.combo; return b; };

  function start() {
    SON.init(); accueil = false;
    race = mode === 'course' ? newRace(T, 3, AI_LVL.map(l => l * DIFF[diff].k), DIFF[diff].el) : null; raceEnd = false; lap0 = [0, 0, 0]; bestLap = 0;
    car = race ? race.cars[0] : newCar(T); car.manual = manual; gear = 0; hist.length = 0; si = 0; cur = []; recG = []; splitMsg = null; cth = car.th; carY = S[car.idx].y; state = 'count'; count = 3; shown = 0; tRace = 0; tTraf = 0; acc = 0; lapN = 1; rLap = 0; rLapT = 0; result = null;
  }
  function finish() { // tour bouclé : on l'enregistre, on affiche son temps 4 s, et le chrono repart aussitôt pour un tour lancé
    const rec = !best || tRace < best; result = { rec, first: !best, diff: best ? tRace - best : 0, t: tRace, n: lapN, T: 5, b: bilan() };
    if (rec && AUTO) best = tRace; else if (rec) { // le pilote automatique (?auto) n'enregistre rien
      best = tRace; bestSpl = cur; ghost = recG; store.set('best', best); store.set('splits', cur); store.set('ghost', ghost); }
    SON.stinger(rec);
    lapN++; car.dist -= N; tRace = 0; si = 0; cur = []; recG = [];
  }
  const pauseItems = () => ['REPRENDRE', 'RECOMMENCER', 'BOITE : ' + (manual ? 'MANUELLE' : 'AUTO'), 'RADIO : ' + SON.nom, 'MUSIQUE : ' + (SON.musicOn ? 'OUI' : 'NON'), 'FANTOME : ' + (ghostOn ? 'OUI' : 'NON'), 'QUITTER'];
  function pauseAct() {
    if (psel === 0) state = prev;
    else if (psel === 1) start();
    else if (psel === 2) { manual = !manual; car.manual = manual; }
    else if (psel === 3) zap();
    else if (psel === 4) SON.toggleMusic();
    else if (psel === 5) { ghostOn = !ghostOn; store.set('ghostOn', ghostOn); }
    else toMenu();
  }
  function toMenu() { state = 'title'; race = null; raceEnd = false; car = newCar(T); cth = car.th; carY = S[car.idx].y; tRace = 0; lapN = 1; result = null; hist.length = 0; msel = 3; }
  // menu principal : 0 carte, 1 mode, 2 boîte, 3 démarrer ; d = -1 / +1 (gauche / droite ; Entrée vaut +1)
  function menuAct(d) {
    if (msel === 0) { // changer de carte : on mémorise et on recharge, le décor n'est construit qu'au chargement
      const id = CARTES[(CARTES.indexOf(M) + d + CARTES.length) % CARTES.length].id;
      if (partir) return; partir = true; // un seul départ, même si la touche est répétée pendant le fondu
      setPref('vpr.carte', id); try { sessionStorage.setItem('vpr.menu', JSON.stringify(SON.quitter() || 1)); } catch (e) { }
      setTimeout(() => { location.href = location.pathname + '?carte=' + id; }, 100); // le temps que la musique s'efface, sans clac
    } else if (msel === 1) { // contre-la-montre, puis la course à chaque difficulté
      const k = ((mode === 'solo' ? 0 : diff + 1) + d + DIFF.length + 1) % (DIFF.length + 1);
      mode = k ? 'course' : 'solo'; if (k) diff = k - 1; setPref('vpr6.mode', JSON.stringify(mode)); setPref('vpr6.diff', diff); }
    else if (msel === 2) { manual = !manual; car.manual = manual; setPref('vpr.boite', manual ? 'm' : 'a'); }
    else start();
  }
  const onKey = e => {
    keys[e.code] = 1; SON.init(); // le contexte audio ne peut démarrer qu'après un geste
    if (/^Arrow|Space/.test(e.code)) e.preventDefault();
    if (e.repeat) return;
    if (e.isTrusted && e.code === 'KeyJ') hidDemande(); // avant tout le reste : marche aussi depuis l'accueil
    if (accueil) { entrer(); return; } // la première touche ne fait qu'ouvrir le menu
    const key = (e.key || '').toLowerCase(); // lettre réellement tapée, pour les commandes nommées par une lettre (le pilotage, lui, reste en positions physiques)
    if (state === 'pause') {
      if (e.code === 'Escape' || key === 'p') state = prev;
      else if (e.code === 'ArrowUp' || e.code === 'KeyW') psel = (psel + 6) % 7;
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') psel = (psel + 1) % 7;
      else if (e.code === 'Enter' || e.code === 'Space') pauseAct();
      return;
    }
    if (e.code === 'Escape' && raceEnd) { toMenu(); return; } // course finie : retour direct au menu
    if ((e.code === 'Escape' || key === 'p') && (state === 'race' || state === 'count')) { prev = state; state = 'pause'; psel = 0; return; }
    if (state === 'title') {
      const dx = (e.code === 'ArrowRight' || e.code === 'KeyD' ? 1 : 0) - (e.code === 'ArrowLeft' || e.code === 'KeyA' ? 1 : 0);
      if (e.code === 'ArrowUp' || e.code === 'KeyW') msel = (msel + 3) % 4;
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') msel = (msel + 1) % 4;
      else if (e.code === 'Enter' || e.code === 'Space') menuAct(1);
      else if (dx && msel < 3) menuAct(dx);
      return;
    }
    if ((e.code === 'Enter' && raceEnd) || key === 'r') start();
    if (key === 'g') { manual = !manual; car.manual = manual; car.gear = gear; setPref('vpr.boite', manual ? 'm' : 'a'); }
    if (manual && (e.code === 'KeyE' || e.code === 'KeyQ')) car.gear = clamp(car.gear + (e.code === 'KeyE' ? 1 : -1), 0, CARD.ratios.length - 1); // physiquement A / E autour du Z en AZERTY
    if (key === 'c') zap();
    if (key === 'm') SON.toggleMusic();
  };
  addEventListener('keydown', onKey);
  addEventListener('keyup', e => { keys[e.code] = 0; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = 0; }); // sinon une touche reste enfoncée après Alt-Tab
  // e.code = position physique : KeyW/KeyA sont Z/Q sur un clavier AZERTY
  // manette (disposition « standard » du navigateur, noms des boutons d'une manette de Switch) : stick ou croix = volant et menus, ZR ou B = gaz, ZL ou Y = frein,
  // A = glisse, X = radio, L / R = rapports, + = pause, B = valider. Les boutons rejouent les touches du clavier, pour ne pas dédoubler les menus.
  const PADK = { 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight', 0: 'Enter', 9: 'Escape', 8: 'g', 3: 'c', 4: 'KeyQ', 5: 'KeyE' }, padWas = {}; let pad = null;
  let padIdx = -1; const padRepos = {}; // manette retenue = la dernière qui a eu une entrée : la première de la liste peut être un autre périphérique (volant, casque, second Joy-Con)
  const padNote = document.body.appendChild(document.createElement('div')); padNote.setAttribute('role', 'status');
  padNote.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);padding:8px 12px;background:#0c0c10;color:#ffd23a;font:12px "Press Start 2P",monospace;border:2px solid #ffd23a;pointer-events:none;display:none;z-index:9';
  let padNoteT = 0; const padDit = s => { padNote.textContent = s; padNote.style.display = ''; clearTimeout(padNoteT); padNoteT = setTimeout(() => { padNote.style.display = 'none'; }, 3000); };
  addEventListener('gamepaddisconnected', e => { delete padRepos[e.gamepad.index]; if (e.gamepad.index === padIdx) { padIdx = -1; padDit('MANETTE DÉCONNECTÉE'); } });
  // Joy-Con lu en direct (WebHID) : sous Windows, Chrome reçoit ses rapports mais ne le montre pas à l'API Gamepad (constaté sur Chrome 156, Joy-Con (R) en Bluetooth).
  // Rapport 0x3f, Joy-Con seul tenu à l'horizontale : octet 0 = boutons (1 gauche, 2 haut, 4 bas, 8 droite, 16 SL, 32 SR), octet 1 = − ou + (1, 2), octet 2 = stick en 8 directions (0 = haut, sens horaire, 8 et plus = repos).
  // Présenté comme une manette « standard », pour que padFrame le traite comme les autres. shortcut: stick en tout-ou-rien, passer au rapport 0x30 (stick 12 bits + étalonnage) pour un volant progressif.
  let hidPad = null;
  const hidLire = e => {
    if (e.reportId !== 0x3f || !hidPad) return; const d = new Uint8Array(e.data.buffer, e.data.byteOffset), h = d[2], set = (i, v) => { hidPad.buttons[i].pressed = !!v; hidPad.buttons[i].value = v ? 1 : 0; };
    [8, 5, 4, 0, 3, 1].forEach((b, i) => set(b, d[0] & 1 << i)); set(9, d[1] & 3); // Joy-Con (R) couché, SL / SR vers le haut : bits gauche et haut (constatés par l'auteur), bas et droite (déduits), SL, SR -> boîte manuelle / automatique, rapport +, rapport -, gaz et valider, radio, glisse (choix de l'auteur, qui ne freine pas à la manette)
    hidPad.axes = [h > 0 && h < 4 ? 1 : h > 4 && h < 8 ? -1 : 0, h === 7 || h < 2 ? -1 : h > 2 && h < 6 ? 1 : 0];
  };
  const hidOuvre = async d => {
    if (!d || hidPad || (d.productId !== 0x2006 && d.productId !== 0x2007)) return; // Joy-Con gauche / droit
    try { if (!d.opened) await d.open(); } catch (e) { return; }
    hidPad = { index: 'hid', dev: d, connected: true, axes: [0, 0], buttons: Array.from({ length: 10 }, () => ({ pressed: false, value: 0 })) }; d.oninputreport = hidLire;
  };
  const hidDemande = () => navigator.hid && navigator.hid.requestDevice({ filters: [{ vendorId: 0x057e }] }).then(l => l.forEach(hidOuvre)).catch(() => { }); // touche J : fenêtre du navigateur pour autoriser le Joy-Con (une fois)
  if (navigator.hid) {
    const cherche = () => navigator.hid.getDevices().then(l => l.forEach(hidOuvre)).catch(() => { }); // déjà autorisé : pas de fenêtre
    cherche(); navigator.hid.addEventListener('connect', cherche);
    navigator.hid.addEventListener('disconnect', e => { if (hidPad && e.device === hidPad.dev) { hidPad = null; padIdx = -1; padDit('MANETTE DÉCONNECTÉE'); } });
  }
  function padFrame() {
    const pads = [...(navigator.getGamepads ? navigator.getGamepads() : [])].filter(p => p && p.connected); if (hidPad) pads.push(hidPad);
    // « entrée » = un bouton enfoncé ou un axe écarté de sa position de repos (une gâchette ou une croix vue comme axe ne repose pas à 0)
    const actif = p => { const r = padRepos[p.index] = padRepos[p.index] || [...p.axes]; return p.buttons.some(b => b.pressed) || p.axes.some((x, i) => Math.abs(x - r[i]) > 0.5); };
    pad = pads.find(p => p.index === padIdx) || null;
    if (!pad || !actif(pad)) { const n = pads.find(actif); if (n && n !== pad) { pad = n; padIdx = n.index; padDit('MANETTE CONNECTÉE'); } }
    const on = {}, ax = pad ? pad.axes : [0, 0]; // sans manette on passe quand même dans la boucle, pour relâcher les touches d'une manette qui vient de partir
    if (pad) pad.buttons.forEach((b, i) => { if (b.pressed && PADK[i]) on[PADK[i]] = 1; });
    if (accueil && pad && pad.buttons.some(b => b.pressed)) on.Enter = 1; // à l'accueil, n'importe quel bouton vaut une touche
    if (accueil || state === 'title' || state === 'pause') { if (ax[1] < -0.6) on.ArrowUp = 1; if (ax[1] > 0.6) on.ArrowDown = 1; if (ax[0] < -0.6) on.ArrowLeft = 1; if (ax[0] > 0.6) on.ArrowRight = 1; } // en course le stick est lu en analogique, pas en flèches
    for (const k of new Set([...Object.keys(on), ...Object.keys(padWas)])) {
      if (on[k] && !padWas[k]) onKey({ code: k.length > 1 ? k : '', key: k.length > 1 ? '' : k, preventDefault() { } });
      else if (!on[k] && padWas[k]) keys[k] = 0;
      if (on[k]) padWas[k] = 1; else delete padWas[k];
    }
  }
  const input = () => {
    const b = i => pad && pad.buttons[i] ? pad.buttons[i].value : 0, sx = pad && Math.abs(pad.axes[0]) > 0.15 ? pad.axes[0] : 0;
    return {
      steer: clamp((keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0) + sx, -1, 1),
      gas: keys.ArrowUp || keys.KeyW || b(7) > 0.1 || b(0) ? 1 : 0, brake: keys.ArrowDown || keys.KeyS || b(6) > 0.1 || b(2) ? 1 : 0, hand: !!(keys.Space || b(1)),
    };
  };

  // ---------- HUD pixel (canvas 2D à la résolution du jeu) ----------
  const PS = '"Press Start 2P", monospace', JP = 'DotGothic16, sans-serif', HU = TH.hud, Y = HU.y, C = HU.c, RD = HU.r; // couleurs et style d'interface de la carte
  document.fonts.load('8px ' + PS); document.fonts.load('16px ' + JP, 'スピード');
  // texte pixel ; split = décalage rouge/cyan façon glitch
  function txt(s, x, y, size, col, align = 'left', split = 0, font = PS) {
    hg.font = size + 'px ' + font; hg.textAlign = align; hg.textBaseline = 'top'; x = Math.round(x);
    if (split && HU.split) { hg.fillStyle = RD; hg.fillText(s, x - split, y); hg.fillStyle = C; hg.fillText(s, x + split, y); }
    hg.fillStyle = col; hg.fillText(s, x, y);
  }
  const cadre = (c, x, y, w, h) => { R(hg, c, x, y, w, 1); R(hg, c, x, y + h - 1, w, 1); R(hg, c, x, y, 1, h); R(hg, c, x + w - 1, y, 1, h); };
  const panel = (x, y, w, h) => { // un style de panneau par carte
    R(hg, HU.fond, x, y, w, h);
    if (HU.style === 'cyber') { R(hg, Y, x, y, 2, h); R(hg, Y, x, y, w, 1); R(hg, C, x + w - 8, y + h - 1, 8, 1); } // barres jaunes, coin cyan
    else if (HU.style === 'panneau') cadre('#ffffff', x + 1, y + 1, w - 2, h - 2); // panneau d'autoroute : vert, filet blanc
    else if (HU.style === 'plaque') { cadre('#2a7a4a', x, y, w, h); cadre('#2a7a4a', x + 1, y + 1, w - 2, h - 2); } // plaque de rue émaillée : bleu, cadre vert
    else if (HU.style === 'bloc') R(hg, C, x, y + h - 2, w, 2); // bloc souligné
    else { R(hg, C, x, y, w, 1); R(hg, C, x, y + h - 1, w, 1); } // deux traits
  };
  const tag = (s, cx, y, bg) => { hg.font = '8px ' + PS; const w = hg.measureText(s).width + 12; R(hg, bg, Math.round(cx - w / 2), y, w, 14); txt(s, cx, y + 3, 8, '#08080c', 'center'); };
  const EQN = 20, EQR = 10, peak = new Float32Array(EQN), fft = new Uint8Array(32);
  // minicarte : tracé dessiné une seule fois dans un canvas hors écran (x monde vers la droite, z vers le bas = vue de dessus non inversée)
  const MM = (() => {
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const s of S) { x0 = Math.min(x0, s.x); x1 = Math.max(x1, s.x); z0 = Math.min(z0, s.z); z1 = Math.max(z1, s.z); }
    const w = 84, h = 56, k = Math.min((w - 4) / (x1 - x0), (h - 4) / (z1 - z0)), c = document.createElement('canvas'), g = c.getContext('2d');
    const kx = Math.min((w - 4) / (x1 - x0), k * 2.5), kz = Math.min((h - 4) / (z1 - z0), k * 2.5); // un tracé très allongé (canal) est étiré jusqu'à 2,5 fois sur son petit axe, sinon il tient en quelques pixels
    c.width = w; c.height = h;
    const px = x => Math.round((w - (x1 - x0) * kx) / 2 + (x - x0) * kx), pz = z => Math.round((h - (z1 - z0) * kz) / 2 + (z - z0) * kz);
    for (const s of S) R(g, '#e8e8e4', px(s.x), pz(s.z), 1, 1);
    R(g, RD, px(S[0].x) - 2, pz(S[0].z) - 2, 5, 5); // ligne de départ
    return { c, px, pz };
  })();
  function drawHUD(dt, sp, r, warn) {
    hg.clearRect(0, 0, HW, HH);
    const cx = HW / 2, blink = (performance.now() / 160 | 0) % 3 > 0;
    if (state === 'title' && accueil) { // écran d'accueil : la carte tourne derrière, on attend un geste
      R(hg, 'rgba(8,8,12,.55)', 0, 0, HW, HH);
      if (HU.sur[0]) txt(HU.sur[0], cx, HH / 2 - 76, 16, C, 'center', 0, JP);
      txt(HU.titre[0], cx, HH / 2 - 50, 24, Y, 'center', 2); txt(HU.titre[1], cx, HH / 2 - 24, 24, Y, 'center', 2);
      if (blink) tag('APPUIE SUR UNE TOUCHE', cx, HH / 2 + 22, Y);
      txt('OU CLIQUE', cx, HH / 2 + 44, 8, '#e8e8e4', 'center');
      hudT.needsUpdate = true; return;
    }
    if (state === 'title') { // menu principal : la carte tourne derrière, on choisit carte, mode et boîte
      R(hg, 'rgba(8,8,12,.45)', 0, 0, HW, HH);
      if (HU.sur[0]) txt(HU.sur[0], cx, 6, 16, C, 'center', 0, JP); txt(mode === 'course' ? 'COURSE · 3 TOURS' : HU.sur[1], cx, 27, 8, C, 'center');
      txt(HU.titre[0], cx, 44, 24, Y, 'center', 2); txt(HU.titre[1], cx, 70, 24, Y, 'center', 2);
      panel(cx - 160, 100, 320, 140);
      [['CARTE', M.nom + '  ' + (CARTES.indexOf(M) + 1) + '/' + CARTES.length], ['MODE', mode === 'course' ? 'COURSE : ' + DIFF[diff].nom : 'CONTRE-LA-MONTRE'], ['BOITE', manual ? 'MANUELLE' : 'AUTO']].forEach(([l, v], i) => {
        const on = msel === i, y = 108 + i * 15;
        txt((on ? '> ' : '  ') + l, cx - 152, y, 8, on ? Y : '#e8e8e4'); txt(on ? '< ' + v + ' >' : v, cx + 152, y, 8, on ? Y : C, 'right');
      });
      if (msel === 3) { if (blink) tag('> DEMARRER <', cx, 152, Y); } else txt('DEMARRER', cx, 155, 8, '#e8e8e4', 'center');
      hg.drawImage(MM.c, cx - 152, 170); // le tracé, puis la fiche de la carte
      [CARD.nom, (T.len / 1000).toFixed(1).replace('.', ',') + ' KM   ' + (M.trafic ? 'TRAFIC' : T.tun ? 'TUNNEL' : 'CIEL OUVERT'), mode === 'course' ? '3 TOURS CONTRE 3 IA' : 'RECORD ' + (best ? fmt(best) : '--'), SON.nom.includes(parseInt(SON.fq)) ? SON.nom : SON.nom + ' ' + SON.fq].forEach((l, i) => txt(l, cx - 58, 174 + i * 13, 8, i ? '#e8e8e4' : C));
      if (mode !== 'course') { const m = medal(best); if (m) txt(MEDN[m - 1], cx + 152, 200, 8, MEDC[m - 1], 'right'); if (m < 3) txt('VISE ' + MEDN[m] + ' ' + fmt(REF * MED[m]), cx - 58, 226, 8, MEDC[m]); } // médaille acquise, et la prochaine à aller chercher
      txt('HAUT/BAS : CHOISIR  GAUCHE/DROITE : CHANGER', cx, 245, 8, '#e8e8e4', 'center'); txt('FLECHES / ZQSD : PILOTER   ESPACE : GLISSE', cx, 257, 8, '#e8e8e4', 'center');
      hudT.needsUpdate = true; return;
    }
    // chrono
    panel(6, 6, 132, 50); txt(race ? 'TOUR ' + car.lap + '/' + race.laps : 'TOUR ' + lapN, 12, 11, 8, C); if (HU.jp) txt(HU.jp[0], 132, 6, 16, C, 'right', 0, JP);
    txt(fmt(tRace), 12, 24, 16, Y, 'left', 1); txt(race ? 'PLACE ' + car.pos + '/' + race.cars.length : best ? 'REC ' + fmt(best) : 'REC --', 12, 44, 8, RD);
    // vitesse
    panel(HW - 126, HH - 64, 120, 58); txt('KM/H', HW - 120, HH - 59, 8, C); if (HU.jp) txt(HU.jp[1], HW - 12, HH - 64, 16, C, 'right', 0, JP);
    txt(String(sp * 3.6 | 0), HW - 10, HH - 42, 32, Y, 'right', 1);
    // jauge de puissance façon égaliseur : les colonnes s'allument avec le régime, dansent avec le son, crêtes qui retombent
    panel(6, HH - 78, 138, 72); txt(String(Math.round(rpm * CARD.red / 100) * 100), 12, HH - 73, 8, C); if (manual && rpm > 0.92 && blink) txt('SHIFT', 54, HH - 73, 8, RD); else txt(manual ? 'MANU' : 'AUTO', 54, HH - 73, 8, manual ? Y : C); // régime en tr/min txt('G' + (gear + 1), 136, HH - 73, 16, Y, 'right', 1);
    if (SON.ana) SON.ana.getByteFrequencyData(fft);
    for (let i = 0; i < EQN; i++) {
      const fr = (i + 0.5) / EQN, on = fr <= rpm, a = SON.ana ? fft[1 + i] / 255 : 0.5;
      const L = clamp(on ? (0.3 + 0.7 * fr) * (0.65 + 0.35 * a) + 0.1 * load : 0.22 * a, 0, 1), rows = Math.round(L * EQR);
      peak[i] = Math.max(peak[i] - dt * 0.9, L);
      for (let j = 0; j < EQR; j++) R(hg, j >= rows ? '#1c1c2c' : !on ? '#2a4a5a' : j > 7 || fr > 0.88 ? RD : j > 4 ? Y : C, 12 + i * 6, HH - 14 - j * 4, 5, 3);
      R(hg, '#ffffff', 12 + i * 6, HH - 14 - Math.min(EQR - 1, Math.round(peak[i] * EQR)) * 4, 5, 1);
    }
    radioT -= dt; panel(HW - 126, 6, 120, 30); txt('RADIO ' + SON.fq, HW - 120, 11, 8, radioT > 0 && blink ? '#ffffff' : C); txt(SON.nom, HW - 120, 23, 8, Y);
    if (state === 'race' || state === 'count') { // minicarte, sous la radio ; un point par voiture : dot(x, z, couleur)
      const mx = HW - 96, my = 46, dot = (x, z, c) => R(hg, c, mx + MM.px(x) - 1, my + MM.pz(z) - 1, 3, 3);
      panel(HW - 102, 40, 96, 68); hg.drawImage(MM.c, mx, my); // 96 de large : ne touche pas les bandeaux centraux même en 4:3 (HW = 360)
      if (ghostM.visible) dot(ghostM.position.x, ghostM.position.z, C);
      if (race) race.cars.forEach((c, i) => i && dot(c.x, c.z, OPP[i - 1][1]));
      R(hg, '#08080c', mx + MM.px(car.x) - 3, my + MM.pz(car.z) - 3, 7, 7); R(hg, blink ? Y : '#ffffff', mx + MM.px(car.x) - 2, my + MM.pz(car.z) - 2, 5, 5); // le joueur : plus gros, cerné de noir, clignotant
    }
    if (race && !raceEnd && state === 'race') { const pris = []; // repère au-dessus de chaque adversaire : à 270 lignes, une voiture lointaine ne fait que quelques pixels
      cam.updateMatrixWorld();
      race.cars.forEach((c, i) => {
        const dx = c.x - cam.position.x, dz = c.z - cam.position.z, f = dx * Math.cos(cth) + dz * Math.sin(cth);
        if (!i || f < 3 || f > 400) return; // derrière la caméra ou trop loin
        tmp.set(c.x, opps[i - 1].userData.y + 2.4, c.z).project(cam);
        const [name, col] = OPP[i - 1], x = Math.round((tmp.x + 1) / 2 * HW), y = Math.round((1 - tmp.y) / 2 * HH), w = name.length * 8 + 4;
        let ly = y - 14; while (pris.some(p => Math.abs(p[0] - x) < (p[2] + w) / 2 + 2 && Math.abs(p[1] - ly) < 12)) ly -= 12; pris.push([x, ly, w]); // deux étiquettes au même endroit : la seconde monte d'un cran
        R(hg, 'rgba(8,8,12,.75)', x - w / 2, ly, w, 11); txt(name, x, ly + 2, 8, col, 'center'); R(hg, col, x - 2, y - 2, 5, 3); R(hg, col, x - 1, y + 1, 3, 2);
      });
    }
    if (car.boost > 0) tag('BOOST' + (car.combo > 1 ? ' x' + car.combo : ''), cx, 82, C);
    if (car.dd || car.boost > 0) { // jauge de boost : elle se charge en glisse (rien avant le repère : 0,6 s), puis se vide pendant le boost
      const bx = HW - 126, by = HH - 74, f = car.dd ? Math.min(1, car.driftT / 1.875) : car.boost / 1.5;
      R(hg, HU.fond, bx, by, 120, 8); R(hg, car.dd && car.driftT < 0.6 ? '#6a6a78' : car.dd ? C : Y, bx + 2, by + 2, Math.round(116 * f), 4); R(hg, '#ffffff', bx + 2 + Math.round(116 * 0.32), by + 1, 1, 6);
    }
    if (splitMsg && (splitMsg.T -= dt) > 0) tag('S' + (splitMsg.i + 1) + ' ' + (splitMsg.d == null ? fmt(splitMsg.t) : (splitMsg.d <= 0 ? '-' : '+') + Math.abs(splitMsg.d).toFixed(2)), cx, 102, splitMsg.d == null ? Y : splitMsg.d <= 0 ? C : RD); // écart au record à chaque secteur
    if (warn && blink) tag(warn > 0 ? '! VIRAGE DROITE >>' : '<< VIRAGE GAUCHE !', cx, 62, Y);
    // écrans
    if (state === 'count' && shown || goT > 0) { const s = goT > 0 ? 'GO' : String(shown); R(hg, HU.fond, cx - 20 - s.length * 30, 6, 40 + s.length * 60, 78); txt(s, cx + 4, 14, 64, Y, 'center', 3); } // sur un fond, en haut : ni le portique ni les voitures ne passent derrière
    if (result && state !== 'title' && (result.T -= dt) > 0) { // résultat du tour qu'on vient de boucler, sans arrêter la course
      tag('TOUR ' + result.n + '  ' + fmt(result.t), cx, 28, Y); if (result.pos) tag('PLACE ' + result.pos + '/' + result.of, cx, 44, C); else tag(result.first ? 'PREMIER TEMPS' : result.rec ? 'NOUVEAU RECORD' : '+' + result.diff.toFixed(2) + ' S', cx, 44, result.rec ? C : RD);
      const b = result.b, m = medal(result.t), L = [];
      if (!race) L.push(m < 3 ? [MEDN[m] + ' A -' + (result.t - REF * MED[m]).toFixed(2), MEDC[m]] : ['TOUR EN OR', MEDC[2]]); // ce qui manquait à ce tour pour la médaille suivante
      if (b) L.push(['GLISSES ' + b[0], '#e8e8e4'], ['BOOSTS ' + b[1] + (b[3] > 1 ? '  SERIE ' + b[3] : ''), C], ['MURS ' + b[2], b[2] ? RD : '#e8e8e4']);
      panel(6, 60, 132, 8 + L.length * 11); L.forEach(([s, c], i) => txt(s, 12, 65 + i * 11, 8, c));
    }
    if (raceEnd && state === 'race') { // arrivée : classement, complété à mesure que les autres passent la ligne
      panel(cx - 150, 52, 300, 166); txt('ARRIVEE : ' + car.pos + (car.pos === 1 ? 'ER' : 'E'), cx, 60, 16, Y, 'center', 1); const t1 = raceOrder(race)[0].fin;
      raceOrder(race).forEach((c, i) => { const j = race.cars.indexOf(c); txt((i + 1) + '. ' + (j ? OPP[j - 1][0] : 'VOUS'), cx - 138, 86 + i * 15, 8, j ? OPP[j - 1][1] : Y); txt(c.fin ? fmt(c.fin) : 'EN PISTE', cx + 50, 86 + i * 15, 8, j ? '#e8e8e4' : Y, 'right'); if (i && c.fin) txt('+' + (c.fin - t1).toFixed(2), cx + 138, 86 + i * 15, 8, j ? '#e8e8e4' : Y, 'right'); });
      txt('MEILLEUR TOUR ' + fmt(bestLap), cx, 152, 8, C, 'center'); txt('GLISSES ' + car.nDrift + '  BOOSTS ' + car.nBoost + '  MURS ' + car.nWall, cx, 166, 8, '#e8e8e4', 'center'); txt('NIVEAU ' + DIFF[diff].nom, cx, 180, 8, '#e8e8e4', 'center');
      txt('ENTREE : REJOUER   ECHAP : MENU', cx, 200, 8, C, 'center');
    }
    if (state === 'pause') {
      R(hg, 'rgba(8,8,12,.95)', 0, 0, HW, HH); txt('PAUSE', cx, 36, 32, Y, 'center', 2);
      pauseItems().forEach((s, i) => i === psel ? tag('> ' + s + ' <', cx, 92 + i * 20, Y) : txt(s, cx, 95 + i * 20, 8, '#e8e8e4', 'center'));
      txt('HAUT / BAS : CHOISIR   ENTREE : VALIDER', cx, 246, 8, C, 'center');
    }
    hudT.needsUpdate = true;
  }

  // la lune suit la voiture, calée sur la grille de texels de l'ombre pour qu'elle ne fourmille pas
  const LR = new V3().crossVectors(new V3(0, 1, 0), SD).normalize(), LU = new V3().crossVectors(SD, LR), TX = 360 / 2048, tmp = new V3();
  function sunFollow() {
    tmp.set(car.x, 0, car.z);
    const a = Math.round(tmp.dot(LR) / TX) * TX, b = Math.round(tmp.dot(LU) / TX) * TX, c = tmp.dot(SD);
    sun.target.position.set(0, 0, 0).addScaledVector(LR, a).addScaledVector(LU, b).addScaledVector(SD, c);
    sun.position.copy(sun.target.position).addScaledVector(SD, 400);
  }

  const ROUGE = new THREE.Color(0xff1828), PHARE = new THREE.Color(0xfff2d0), NEONC = new THREE.Color(L.neon || 0), BOITE = new THREE.Matrix4().makeScale(ENCt.x / 2, ENCt.y / 2, ENCt.z / 2).setPosition(ENCc); // BOITE : englobe toute la caisse, pour l'ombre (un point dedans ou dessus n'est pas ombré)
  let lumIdx = -1; const TRB = ST && ST.tremble * ST.aa || TREMBLE;
  function frame(now) {
    const dt = state === 'pause' ? 0 : clamp((now - last) / 1000 || 0, 0, 0.1); last = Math.max(last, now); // en pause le temps s'arrête, l'image reste
    if (state === 'count') {
      count -= dt; const k = Math.ceil(count); // une seconde par chiffre
      if (count <= 0) { state = 'race'; goT = 0.8; SON.beep(880); SON.crash(); }
      else if (k !== shown) { shown = k; SON.beep(440); }
    }
    if (goT > 0) goT -= dt;
    FEUX.forEach((m, i) => m.color.setHex(goT > 0 ? 0x30ff60 : state === 'count' && shown && shown <= 3 - i ? 0xff2030 : 0x3a0810)); // décompte 3, 2, 1 : un feu de plus à chaque chiffre ; vert au GO
    padFrame(); const keyIn = input();
    const inp = state === 'race' ? (AUTO || raceEnd ? autopilot(car, T, 1, M.trafic && !race ? trafic(T, tTraf) : []) : keyIn) : { steer: 0, gas: 0, brake: 0, hand: false };
    let hit = 0, bump = 0;
    for (acc += dt; acc >= H; acc -= H) {
      // en course, sim.js fait avancer tout le monde ; inp = null : l'IA conduit la voiture du joueur (?auto, ou une fois arrivé)
      if (race && state === 'race') stepRace(race, AUTO || raceEnd ? null : inp, H); else { step(car, inp, T, H); if (M.trafic && state === 'race') hitTrafic(car, T, tTraf); }
      bump = Math.max(bump, car.bump || 0); hit = Math.max(hit, car.hit, bump); // shortcut: un choc entre voitures réutilise les effets du choc mur (étincelles côté mur), à séparer si ça se voit
      if (state === 'race' && !raceEnd) {
        tRace += H; tTraf += H;
        if (race) { if (car.fin) { raceEnd = true; tRace = car.fin; car.manual = false; SON.arrivee(car.pos); } }
        else if (car.dist >= N) finish();
      }
    }
    const sp = Math.hypot(car.vx, car.vz), r = Math.min(1, sp / TOP), gas = state === 'count' ? keyIn.gas : inp.gas;
    const beat = SON.beat, pulse = SON.pulse; // battement calé sur le kick
    if (hit > 8) stun = 0.7; stun -= dt;
    const up = drivetrain(dt, r, gas);

    // voiture (suit le relief) + caméra derrière : plus basse, plus proche et plus grand-angle avec la vitesse
    const sc = S[car.idx], fx = Math.cos(car.th), fz = Math.sin(car.th);
    // altitude continue le long de la piste : lue échantillon par échantillon, elle faisait sauter la voiture et la caméra à chaque pas, d'autant plus visible qu'on roule lentement
    const yAt = (c, k = 0) => { let i = c.idx, a = S[i], b = S[(i + 1) % N], u = ((c.x - a.x) * (b.x - a.x) + (c.z - a.z) * (b.z - a.z)) / ((b.x - a.x) ** 2 + (b.z - a.z) ** 2 || 1);
      if (u < 0) { i = (i - 1 + N) % N; u = Math.max(0, u + 1); } u = Math.min(1, u); a = S[(i + k + N) % N]; b = S[(i + k + 1 + N) % N]; return a.y + (b.y - a.y) * u; };
    carY += (yAt(car) - carY) * Math.min(1, dt * 18); pitch += (Math.atan(sc.sl) - pitch) * Math.min(1, dt * 10);
    carG.position.set(car.x, carY, car.z); carG.rotation.set(0, -car.th, pitch); body.rotation.x = car.steer * r * 0.07;
    opps.forEach((g, i) => {
      const c = race && race.cars[i + 1]; g.visible = !!c; if (!c) return;
      const so = S[c.idx]; g.userData.y += (yAt(c) - g.userData.y) * Math.min(1, dt * 18);
      g.position.set(c.x, g.userData.y, c.z); g.rotation.set(0, -c.th, Math.atan(so.sl));
    });
    if (state === 'title') cth += dt * 0.22; else cth += wrap(car.th - cth) * Math.min(1, dt * 6); // au menu, la caméra tourne autour de la voiture pour montrer la carte
    if ((lookT -= dt) < 0) { const k = Math.exp(-dt * 5); lookA *= k; lookP *= k; } // souris immobile depuis 2,5 s : la caméra revient derrière la voiture
    const cx = Math.cos(cth + lookA), cz = Math.sin(cth + lookA), back = 6.4 - 1 * r; // caméra basse et proche : le sol défile en proportion inverse de sa hauteur, c'est ce qui donne la sensation de vitesse
    let px = car.x - cx * back, pz = car.z - cz * back;
    const s = S[(car.idx - 4 + N) % N], nx = -s.tz, nz = s.tx, d = (px - s.x) * nx + (pz - s.z) * nz, o = Math.abs(d) - (s.w - 0.8);
    if (o > 0 && !dansPlace(px, pz)) { px -= nx * Math.sign(d) * o; pz -= nz * Math.sign(d) * o; } // la caméra reste entre les murs (sur une place où l'on roule partout, elle suit)
    const shake = 0.04 * r * r + (stun > 0 ? stun * 0.5 : 0);
    cam.position.set(px + (Math.random() - 0.5) * shake, yAt(car, -3) + (M.camH || 3.2) + lookP - 0.5 * r + (Math.random() - 0.5) * shake, pz);
    cam.lookAt(car.x + cx * 10, yAt(car, 5) + 1.1, car.z + cz * 10);
    cam.fov = 62 + 26 * r + 3 * car.slide + (car.boost > 0 ? 6 : 0);
    const vue = window.__g.vue; // shortcut: debug console seulement, __g.vue = [angle° autour de la voiture, distance, hauteur] pour inspecter le modèle ; à remplacer par un vrai mode photo si on en veut un
    if (vue) { const a = car.th + vue[0] * Math.PI / 180; cam.position.set(car.x + Math.cos(a) * vue[1], carY + vue[2], car.z + Math.sin(a) * vue[1]); cam.lookAt(car.x, carY + 0.7, car.z); cam.fov = 45; }
    cam.updateProjectionMatrix();
    sky.position.copy(cam.position); sunDisc.position.copy(cam.position).addScaledVector(SD, 2000); sunFollow();

    // lumière : nuit néon ↔ échangeur en alarme rouge qui bat avec la musique
    lm += (zone(car.idx, 10) - lm) * Math.min(1, dt * 8);
    scene.fog.color.copy(FOG_OUT).lerp(FOG_IN, lm); scene.fog.near = lerp(TH.fogD[0], 15, lm); scene.fog.far = lerp(TH.fogD[1], 320, lm);
    skyMat.color.copy(WHITE).lerp(FOG_IN, lm);
    if (TH.alarme) { carMat.emissive.setRGB(0.3 * lm, 0.01 * lm, 0.03 * lm); for (const m of tunMats) m.color.setScalar((m.userData.amb || 1) * (0.75 + 0.5 * pulse)); }
    // lumière dynamique : phares, boîte d'ombre de la voiture, reflets, puis la liste des luminaires
    const cp = Math.cos(pitch);
    LUX.uHP.value.set(car.x + fx * 1.9, carY + 0.62, car.z + fz * 1.9); LUX.uHD.value.set(fx * cp, Math.sin(pitch), fz * cp);
    carG.updateMatrixWorld(); LUX.uBox.value.copy(carG.matrixWorld).multiply(BOITE).invert();
    LUX.uSunC.value.copy(SUNC).multiplyScalar(1 - lm); LUX.uSky.value.copy(scene.fog.color); LUX.uRes.value.set(TRB ? RW / 2 / TRB : 0, RH / 2 / TRB);
    let nl = 0;
    const put = (x, y, z, c, r, k) => { if (nl < NL) { LUX.uLP.value[nl].set(x, y, z, r); LUX.uLC.value[nl++].copy(c).multiplyScalar(k * LUM_GAIN); } };
    put(car.x - fx * 4.4, carY + 0.35, car.z - fz * 4.4, ROUGE, 9, NUIT * (inp.brake ? 2.4 : 0.45)); // feux arrière : ils teintent ce qui suit, davantage au freinage
    if (L.neon) put(car.x, carY + 0.3, car.z, NEONC, 5.5, NUIT * (0.8 + 0.4 * pulse)); // néon de bas de caisse
    // les deux véhicules les plus proches (adversaires, ou camions du trafic) : phares devant, feux rouges derrière
    const d2 = c => (c.x - car.x) ** 2 + (c.z - car.z) ** 2;
    for (const c of (race ? race.cars.slice(1) : M.trafic && state === 'race' ? trafic(T, tTraf).slice() : []).sort((a, b) => d2(a) - d2(b)).slice(0, 2)) {
      const ax = Math.cos(c.th), az = Math.sin(c.th), y = S[c.idx].y, av = c.lane === undefined ? 6.5 : 10, ar = c.lane === undefined ? 3.4 : 7; // un camion est plus long
      put(c.x + ax * av, y + 0.8, c.z + az * av, PHARE, 14, 3 * NUIT); put(c.x - ax * ar, y + 0.7, c.z - az * ar, ROUGE, 9, 1.4 * NUIT);
    }
    // luminaires fixes : les plus proches le long de la piste (ceux de devant comptent double), fondus en bout de liste pour qu'aucun ne s'allume d'un coup
    if (car.idx !== lumIdx) { lumIdx = car.idx; for (const l of LUMS) { let d = (l.i - car.idx + N) % N; if (d > N / 2) d -= N; l.d = d > 0 ? d * 0.5 : -d; } LUMS.sort((a, b) => a.d - b.d); } // le tri ne change que d'un échantillon de piste au suivant
    const ns = NL - nl, dm = LUMS.length > ns ? LUMS[ns].d : 1e9;
    for (let k = 0; k < ns && k < LUMS.length; k++) { const l = LUMS[k]; put(l.x, l.y, l.z, l.c, l.r, Math.min(1, (dm - l.d) / (dm * 0.3 + 0.01)) * (l.tun && TH.alarme ? 0.5 + pulse : 1)); }
    LUX.uN.value = nl;
    // pluie : chaque goutte recule de la vitesse de la voiture, sa traînée s'étire d'autant
    const pl = pluieAt(car.idx) * (1 - lm), gl = 1.9 * Math.max(1, 0.4 + 0.6 * pl), nr = Math.min(RN, Math.round(400 * pl ** 1.5)); rain.visible = splash.visible = pl > 0.02;
    rainGeo.setDrawRange(0, 2 * nr); rain.position.set(car.x, carY, car.z); rain.material.opacity = Math.min(1, 0.6 + 0.15 * pl);
    for (let i = 0; i < nr; i++) {
      let x = rainP[i * 3] - car.vx * dt, y = rainP[i * 3 + 1] - 55 * dt, z = rainP[i * 3 + 2] - car.vz * dt;
      x = ((x + 40) % 80 + 80) % 80 - 40; z = ((z + 40) % 80 + 80) % 80 - 40; if (y < 0) y += 30;
      rainP[i * 3] = x; rainP[i * 3 + 1] = y; rainP[i * 3 + 2] = z;
      rainV.set([x, y, z, x + car.vx * 0.035 + gl * 0.12, y + gl, z + car.vz * 0.035 + gl * 0.05], i * 6); // vent constant : la traînée penche un peu
    }
    rainGeo.attributes.position.needsUpdate = true;
    const ns2 = Math.min(SN, Math.round(SN * pl / 3)); splGeo.setDrawRange(0, ns2);
    for (let i = 0; i < ns2; i++) { // un impact vit 0,14 s sur la chaussée, de 4 à 40 m devant, puis renaît ailleurs ; il éclate clair et s'éteint
      if ((splA[i] += dt) > 0.14) { splA[i] -= 0.14; const j = 2 + Math.floor(alea() * 18), s = S[(car.idx + j) % N], l = (alea() * 2 - 1) * W; splP.set([s.x - s.tz * l, s.y + 0.06, s.z + s.tx * l], i * 3); splD[i] = 1 - j / 24; } // au loin, l'impact est plus pâle
      const f = (1 - splA[i] / 0.14) ** 2 * splD[i]; splC.set([0.45 * f, 0.6 * f, 0.75 * f], i * 3);
    }
    splGeo.attributes.position.needsUpdate = splGeo.attributes.color.needsUpdate = true;

    if (state === 'race' && race) { // course : même bandeau « tour + temps » qu'en contre-la-montre, avec la place (le dernier tour est couvert par le classement d'arrivée)
      const ln = Math.floor(car.dist / N);
      if (ln > rLap && ln <= race.laps) { const lt = (car.fin || race.t) - rLapT; bestLap = bestLap ? Math.min(bestLap, lt) : lt; if (ln < race.laps) result = { n: ln, t: lt, pos: car.pos, of: race.cars.length, T: 5, b: bilan() }; rLap = ln; rLapT = race.t; }
    }
    if (state === 'race' && !race) {
      while (recG.length / 4 <= tRace * 20) recG.push(+car.x.toFixed(2), +carY.toFixed(2), +car.z.toFixed(2), +car.th.toFixed(3));
      if (si < 2 && car.dist >= T.sp[si]) { cur[si] = tRace; splitMsg = { i: si, t: tRace, d: bestSpl ? tRace - bestSpl[si] : null, T: 2.5 }; si++; }
    }
    const gi = tRace * 20, g0 = Math.floor(gi) * 4, gf = gi % 1;
    ghostM.visible = ghostOn && state === 'race' && !race && !!ghost && g0 + 7 < ghost.length;
    if (ghostM.visible) { ghostM.position.set(lerp(ghost[g0], ghost[g0 + 4], gf), lerp(ghost[g0 + 1], ghost[g0 + 5], gf) + ENCc.y, lerp(ghost[g0 + 2], ghost[g0 + 6], gf)); ghostM.rotation.y = -(ghost[g0 + 3] + wrap(ghost[g0 + 7] - ghost[g0 + 3]) * gf); }
    fxFrame(dt, now, sp, inp, hit, fx, fz);
    SON.frame(dt, { state, car, T, tour: race ? Math.min(race.laps - 1, Math.max(0, Math.floor(car.dist / N))) : 0, tours: race ? race.laps : 0, hot: hot(car.idx, 50), tun: lm, amb: ambAt(car.idx), r, sp, gas, hit, bump, up: up > 0, down: up < 0, rpm, load, spool, stun, fini: raceEnd }); // fini : la radio s'efface derrière le tableau d'arrivée

    // alerte de virage serré, lue sur la courbure à venir
    let wk = 0;
    for (let j = 15; j < 35 + sp * 0.6; j++) { const k = S[(car.idx + j) % N].k; if (Math.abs(k) > Math.abs(wk)) wk = k; }
    drawHUD(dt, sp, r, state === 'race' && sp > 30 && Math.abs(wk) > 0.011 ? Math.sign(wk) : 0);
    // flou de vitesse : rien sous 55 % de la vitesse de pointe, léger au-delà, franc seulement pendant le boost
    post.uniforms.amt.value = 0.35 * Math.max(0, (r - 0.55) / 0.45) ** 2; post.uniforms.ab.value = 0.002 + 0.004 * r + (stun > 0 ? stun * 0.06 : 0);
    renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(null); renderer.render(postScene, postCam);
  }
  const loop = now => { requestAnimationFrame(loop); frame(now); };
  requestAnimationFrame(loop);
  window.__g = { frame, start, M, T, scene, cam, renderer, LUX, get race() { return race; }, get mode() { return mode; }, keys, ambAt, nearS, get accueil() { return accueil; }, get car() { return car; }, get state() { return state; }, get t() { return tRace; }, get ac() { return SON.ac; }, get out() { return SON.out; }, get smp() { return SON.smp; } }; // prise de test
})();
