// Ville à plein régime — rendu, effets, HUD, commandes et boucle de jeu. La piste et la physique sont dans sim.js.
// Plan du fichier (chercher « // ---------- ») : rendu et passe finale · textures · piste · ville · horizon · voiture et effets ·
// état de jeu et commandes · HUD · boucle. Voir README.md pour savoir où régler quoi.
(() => {
  const T = buildTrack(THREE), S = T.S, N = T.n, W = T.W, V3 = THREE.Vector3, M = CARTE, TH = M.th; // carte active et son thème : voir cartes.js
  const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const AUTO = location.search.includes('auto'); // debug : le pilote auto conduit
  // 0 hors du secteur, 1 dedans, rampes linéaires de `ramp` échantillons (2 m) avant l'entrée / après la sortie
  const span = (a0, a1, on) => (i, ramp) => { if (!on) return 0; const a = (i - a0 + N) % N, L = a1 - a0; return a < L ? 1 : Math.max(0, 1 - (a - L) / ramp, 1 - (N - a) / ramp); };
  const zone = span(T.t0, T.t1, T.tun), hot = span(T.h0, T.h1, true); // zone = tunnel (lumière, décor) ; hot = secteur chaud (musique)
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

  // ---------- rendu basse définition : scène → cible 270p → passe finale (flou de vitesse, HUD, scanlines) ----------
  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.BasicShadowMap;
  document.body.prepend(renderer.domElement);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(70, 1, 0.5, 3000);
  const FOG_OUT = new THREE.Color(TH.fog), FOG_IN = new THREE.Color(TH.tun ? TH.tun.fog : TH.fog), WHITE = new THREE.Color(0xffffff);
  scene.fog = new THREE.Fog(TH.fog, TH.fogD[0], TH.fogD[1]);
  const rt = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
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
  let HW = 480; const HH = 270;
  const resize = () => { HW = clamp(Math.round(HH * innerWidth / (innerHeight || 1)), 360, 960); renderer.setSize(HW, HH, false); rt.setSize(HW, HH); hudC.width = HW; hudC.height = HH; post.uniforms.px.value.set(1 / HW, 1 / HH); cam.aspect = HW / HH; cam.updateProjectionMatrix(); };
  addEventListener('resize', resize); resize();

  const tex = (w, h, draw) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'));
    const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapNearestFilter; // jamais de filtrage linéaire
    t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  };
  const bas = (map, color = 0xffffff) => new THREE.MeshBasicMaterial({ map, color, side: THREE.DoubleSide });
  const R = (g, c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };

  // ciel en bandes (nuit, aube ou couchant selon la carte), étoiles, lune ou soleil
  const skyMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, map: tex(512, 128, g => {
    const gr = g.createLinearGradient(0, 0, 0, 128);
    for (const [p, c] of TH.sky) gr.addColorStop(p, c);
    R(g, gr, 0, 0, 512, 128);
    for (let i = 0; i < TH.stars; i++) R(g, i % 5 ? '#8a8ac0' : '#ffffff', rnd() * 512 | 0, rnd() * 44 | 0, 1, 1);
  }) });
  skyMat.map.minFilter = THREE.NearestFilter;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2500, 16, 12), skyMat); scene.add(sky);
  const SD = new V3(...TH.astre.dir).normalize();
  const sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ fog: false, map: tex(16, 16, g => { g.fillStyle = TH.astre.col; g.beginPath(); g.arc(8, 8, 7, 0, 7); g.fill(); R(g, TH.astre.ombre, 9, 5, 2, 2); R(g, TH.astre.ombre, 5, 9, 3, 2); }) }));
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
    if (uRes.x > 0.) gl_Position.xy = floor(gl_Position.xy / gl_Position.w * uRes + .5) / uRes * gl_Position.w; }
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
      sh.vertexShader = 'varying vec3 vLw; uniform vec2 uRes;\n' + sh.vertexShader.replace('#include <fog_vertex>', LU_V + '#include <fog_vertex>');
      if (lit) sh.fragmentShader = LU_H + sh.fragmentShader.replace('#include <fog_fragment>', LU_F + '#include <fog_fragment>');
    };
    m.customProgramCacheKey = () => 'lu' + lit;
  };
  const gloss = (m, g) => { m.userData.gloss = g; return m; }, retro = (m, r = 1.5) => { m.userData.retro = r; return m; };

  // ---------- textures ----------
  const speckle = (g, n, c, h = 1, H = 64) => { for (let i = 0; i < n; i++) R(g, c, rnd() * 64 | 0, rnd() * H | 0, 1, h); };
  const voile = (g, a, f) => { g.globalAlpha = a; f(); g.globalAlpha = 1; }; // dessine en transparence : salissures et usure par-dessus n'importe quelle teinte
  // chaussée : une dalle de 2W × 32 m. Grain, rapiéçages, joints, fissure, gomme sur les passages de roues, peinture usée.
  // L'alpha de la texture code les flaques (lu par la lumière dynamique : moins c'est opaque, plus ça reflète) ; wet = 2 : la rigole centrale du canal
  const roadTex = (asph, spk, edge, dash, k1, k2, wet) => tex(64, 256, g => {
    R(g, asph, 0, 0, 64, 256); speckle(g, 900, spk, 1, 256);
    voile(g, 0.25, () => { speckle(g, 500, '#000', 1, 256); speckle(g, 160, '#fff', 1, 256); });
    voile(g, 0.2, () => {
      for (let i = 0; i < 4; i++) { const x = 8 + rnd() * 34 | 0, y = rnd() * 220 | 0, w = 8 + rnd() * 12 | 0, h = 14 + rnd() * 30 | 0; R(g, i & 1 ? '#fff' : '#000', x, y, w, h); R(g, '#000', x, y, w, 1); R(g, '#000', x, y, 1, h); } // rapiéçages
      R(g, '#000', 7, 0, 50, 1); R(g, '#000', 7, 128, 50, 1); // joints de dalle
      for (let y = 0, x = 44; y < 256; y++) { if (rnd() < 0.3) x += rnd() < 0.5 ? -1 : 1; if (y % 97 < 60) R(g, '#000', x, y, 1, 1); } // fissure
    });
    voile(g, 0.15, () => { for (const x of [17, 26, 36, 45]) for (let y = 0; y < 256; y += 4) if (rnd() < 0.8) R(g, '#000', x + (rnd() * 2 | 0), y, 2, 4); }); // gomme
    R(g, edge, 5, 0, 2, 256); R(g, edge, 57, 0, 2, 256);
    for (let y = 0; y < 256; y += 64) { R(g, dash, 31, y, 2, 32); for (const x of [0, 60]) { R(g, k1, x, y, 4, 32); R(g, k2, x, y + 32, 4, 32); } }
    for (let i = 0; i < 260; i++) R(g, asph, [5, 6, 31, 32, 57, 58][rnd() * 6 | 0], rnd() * 256 | 0, 1, 1 + rnd() * 3 | 0); // peinture usée
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,.5)'; // flaques : pâtés de pixels
    for (let i = wet ? 7 : 2; i > 0; i--) { const x = 8 + rnd() * 44, y = rnd() * 256, r = 3 + rnd() * 5; for (let k = 0; k < 9; k++) { const w = r * (0.5 + rnd()) | 0; g.fillRect(x + (rnd() - 0.5) * r * 2 | 0, y + (rnd() - 0.5) * r * 5 | 0, w, w * 2); } }
    if (wet === 2) { g.fillRect(27, 0, 3, 256); for (let y = 0; y < 256; y += 8) g.fillRect(25 + (rnd() * 3 | 0), y, 2 + (rnd() * 4 | 0), 8); }
    g.globalCompositeOperation = 'source-over';
  });
  const wallTex = (neonC, p, carreaux) => tex(32, 32, g => { // x : 0 = haut du mur, y : le long de la piste ; p = [fond, joint, filet, pied]
    R(g, p[0], 0, 0, 32, 32);
    voile(g, 0.16, () => {
      if (carreaux) { for (let x = 13; x < 29; x += 3) R(g, '#000', x, 0, 1, 32); for (let y = 0; y < 32; y += 4) R(g, '#000', 13, y, 16, 1); } // carrelage du bas de paroi
      for (let i = 0; i < 9; i++) R(g, '#000', 12 + rnd() * 6 | 0, rnd() * 32 | 0, 12 + rnd() * 8 | 0, 1 + (rnd() * 2 | 0)); // coulures
    });
    R(g, p[1], 0, 0, 32, 2); R(g, neonC, 9, 0, 3, 32); R(g, p[2], 25, 0, 1, 32); R(g, p[3], 29, 0, 3, 32);
  });
  const cells = (bg, draw) => tex(64, 64, g => { R(g, bg, 0, 0, 64, 64); for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) draw(g, x * 16 + 3, y * 16 + 4); });
  const facade = cells('#262633', (g, x, y) => R(g, '#0a0a14', x, y, 10, 9));
  const lit = (cols, p) => cells('#000', (g, x, y) => { if (rnd() < p) { R(g, cols[rnd() * cols.length | 0], x, y, 10, 9); R(g, '#000', x + 4, y, 1, 9); } }); // fenêtres allumées (carte émissive)
  const chevTex = flip => tex(32, 16, g => {
    if (flip) { g.translate(32, 0); g.scale(-1, 1); }
    R(g, '#fcee0a', 0, 0, 32, 16); g.fillStyle = '#08080c';
    for (const x of [3, 17]) { g.beginPath(); g.moveTo(x, 1); g.lineTo(x + 6, 1); g.lineTo(x + 12, 8); g.lineTo(x + 6, 15); g.lineTo(x, 15); g.lineTo(x + 6, 8); g.fill(); }
  });

  const addMat = (map, o = {}) => new THREE.MeshBasicMaterial(Object.assign({ map, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, o));
  const gradTex = (c, vert) => tex(vert ? 8 : 16, vert ? 64 : 2, g => { const gr = vert ? g.createLinearGradient(0, 0, 0, 64) : g.createLinearGradient(0, 0, 16, 0); gr.addColorStop(vert ? 1 : 0, c); gr.addColorStop(vert ? 0 : 1, '#000'); R(g, gr, 0, 0, 16, 64); });
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
  const box = (w, h, d, mat, x, y, z, parent = scene) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; };

  const cT = T.t1 - T.t0, cO = N - cT; // sans tunnel : cT = 0, la route à ciel ouvert fait tout le tour
  // route : mouillée, elle renvoie en reflets étirés les phares, les néons, la lune ou le soleil (lumière dynamique)
  ribbon(T.t1, cO, -W, 0, W, 0, gloss(new THREE.MeshLambertMaterial({ map: roadTex(...TH.route), side: THREE.DoubleSide }), TH.route[6] ? 0.55 : 0.08), 32);
  const barT = tex(32, 32, g => { // x : 0 = haut ; lisse, rainure, poteaux tous les 4 m, coulures
    const p = TH.mur; R(g, p[0], 0, 0, 32, 32); R(g, p[1], 0, 0, 3, 32); R(g, p[2], 6, 0, 1, 32); R(g, p[3], 13, 0, 19, 32); R(g, p[3], 3, 0, 10, 1);
    voile(g, 0.3, () => { R(g, '#fff', 3, 0, 1, 32); R(g, '#000', 9, 0, 2, 32); R(g, '#000', 12, 0, 1, 32); R(g, '#000', 3, 16, 10, 1); for (let i = 0; i < 10; i++) R(g, '#000', 4 + rnd() * 3 | 0, rnd() * 32 | 0, 3 + rnd() * 6 | 0, 1); });
  });
  const barrier = TH.tubes ? bas(barT) : new THREE.MeshLambertMaterial({ map: barT, side: THREE.DoubleSide }); // ville : liseré néon, lumineux par lui-même ; ailleurs la glissière prend la lumière
  ribbon(T.t1, cO, -W, TH.murH, -W, -2, barrier); ribbon(T.t1, cO, W, TH.murH, W, -2, barrier);
  const concrete = new THREE.MeshLambertMaterial({ color: 0x1c1c26, side: THREE.DoubleSide }), glowY = new THREE.MeshBasicMaterial({ color: 0xfcee0a }), glowC = new THREE.MeshBasicMaterial({ color: 0x00f0ff }), glowM = new THREE.MeshBasicMaterial({ color: 0xff2bd6 });
  // tunnel : intérieur sombre, éclairé par ses luminaires (sur la ville : échangeur en alarme rouge qui bat avec la musique), coque sombre
  const tunMats = [];
  if (T.tun) {
    const u = TH.tun;
    tunMats.push(gloss(bas(roadTex(...u.sol)), 0.3), bas(wallTex(u.murs[0], u.paroi, u.carreaux)), bas(wallTex(u.murs[1], u.paroi, u.carreaux)),
      bas(tex(32, 32, g => { const p = u.plafond; R(g, p[0], 0, 0, 32, 32); R(g, p[3], 0, 15, 32, 1); R(g, p[3], 14, 0, 4, 32); voile(g, 0.2, () => speckle(g, 40, '#000', 3, 32)); }))); // plafond : joints, chemin de câbles
    tunMats.forEach((m, i) => m.color.setScalar(m.userData.amb = TH.alarme && (i === 1 || i === 2) ? 0.85 : TUN_AMB)); // ville : les parois gardent leurs bandes néon vives
    { // luminaires en quinconce, un à gauche, un à droite : la lumière et l'ombre de la voiture changent de côté à chaque luminaire franchi
      const d = new THREE.Object3D(), fx = u.neons.map(c => new THREE.InstancedMesh(new THREE.BoxGeometry(1.8, 0.25, 3.2), new THREE.MeshBasicMaterial({ color: c, fog: false }), Math.ceil(cT / LUM_PAS))), nf = [0, 0];
      for (let i = T.t0 + 2, k = 0; i < T.t1 - 1; i += LUM_PAS, k++) {
        const s = S[i % N], sd = k & 1 ? 1 : -1, x = s.x - s.tz * sd * (W - 1.7), z = s.z + s.tx * sd * (W - 1.7);
        lum(i % N, x, s.y + 7.2, z, u.neons[k & 1], 21, 3, 1);
        d.position.set(x, s.y + 7.85, z); d.rotation.set(0, across(s), 0); d.updateMatrix(); fx[k & 1].setMatrixAt(nf[k & 1]++, d.matrix);
        if (k % 6 === 3) { const b = box(0.12, 0.7, 1.4, new THREE.MeshBasicMaterial({ color: u.portail }), s.x - s.tz * (W - 0.1), s.y + 2.6, s.z + s.tx * (W - 0.1)); b.rotation.y = across(s); } // boîtier de secours lumineux sur la paroi de droite
      }
      fx.forEach((m, c) => { m.count = nf[c]; scene.add(m); });
    }
    ribbon(T.t0, cT, -W, 0, W, 0, tunMats[0], 32);
    ribbon(T.t0, cT, -W, 8, -W, 0, tunMats[1]); ribbon(T.t0, cT, W, 8, W, 0, tunMats[2]); ribbon(T.t0, cT, -W, 8, W, 8, tunMats[3]);
    for (const [oa, ya, ob, yb] of [[-W - 1.5, 10, -W - 1.5, -u.coque], [W + 1.5, 10, W + 1.5, -u.coque], [-W - 1.5, 10, W + 1.5, 10]]) ribbon(T.t0, cT, oa, ya, ob, yb, concrete).castShadow = true;
    const pm = new THREE.MeshBasicMaterial({ color: u.portail });
    for (const i of [T.t0, T.t1]) { // portails lumineux
      const s = S[i], g = new THREE.Group(); g.position.set(s.x, s.y, s.z); g.rotation.y = across(s); scene.add(g);
      box(2 * W + 6, 4, 3, pm, 0, 10, 0, g);
      for (const sd of [-1, 1]) box(3, 12, 3, pm, sd * (W + 1.5), 6, 0, g);
    }
  }
  { // ligne et portique de départ
    const s = S[0], g = new THREE.Group(); g.position.set(s.x, s.y, s.z); g.rotation.y = across(s); scene.add(g);
    const ck = tex(16, 4, c => { R(c, TH.depart[2], 0, 0, 16, 4); for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) if ((x + y) & 1) R(c, '#08080c', x, y, 1, 1); });
    ck.minFilter = THREE.NearestFilter;
    box(2 * W, 0.06, 4, new THREE.MeshBasicMaterial({ map: ck }), 0, 0, 0, g);
    box(2 * W + 3, 1.6, 1, new THREE.MeshBasicMaterial({ color: TH.depart[0] }), 0, 8, 0, g);
    for (const sd of [-1, 1]) box(1, 8, 1, new THREE.MeshBasicMaterial({ color: TH.depart[1] }), sd * (W + 1), 4, 0, g);
  }
  { // chevrons à l'extérieur des virages, piles du viaduc, tubes néon en bord de route (repères de vitesse)
    const dummy = new THREE.Object3D(), geo = new THREE.PlaneGeometry(5, 2.5);
    const sg = [0, 1].map(f => new THREE.InstancedMesh(geo, retro(bas(chevTex(f))), 600)), cnt = [0, 0]; // rétroréfléchissants : ils s'allument dans les phares
    const piles = new THREE.InstancedMesh(new THREE.BoxGeometry(5, 1, 5), concrete, 60); let np = 0;
    const tubes = [glowM, glowC].map(m => new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, 7, 0.35), m, 200)), nt = [0, 0];
    const streaks = ['#ff2bd6', '#00f0ff'].map(c => new THREE.InstancedMesh(new THREE.PlaneGeometry(7, 1.6), addMat(gradTex(c)), 200));
    for (let i = 0; i < N; i++) {
      const s = S[i], nx = -s.tz, nz = s.tx, inT = zone(i, 0) === 1;
      dummy.scale.set(1, 1, 1); dummy.rotation.set(0, across(s), 0);
      if (TH.tubes && i % 10 === 0 && !inT) { const k = i / 10, sd = (k >> 1) & 1 ? 1 : -1; lum(i, s.x + nx * sd * (W - 0.5), s.y + 3, s.z + nz * sd * (W - 0.5), [0xff2bd6, 0x00f0ff][(k & 1) ^ (sd > 0 ? 1 : 0)], 17, 1.8); } // un tube sur deux éclaire vraiment : magenta, cyan, d'un côté puis de l'autre
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
    if (TH.reflets) ribbon(T.t1, cO, sd * W, 0.04, sd * (W - 4), 0.04, addMat(gradTex(TH.reflets)));
    if (T.tun && TH.tun.reflets) { const m = addMat(gradTex(TH.tun.reflets[sd < 0 ? 0 : 1])); ribbon(T.t0, cT, sd * W, 0.04, sd * (W - 5), 0.04, m); tunMats.push(m); }
  }
  if (TH.pubs) { // portiques au-dessus de la route, avec écran publicitaire qui défile
    for (const [i, txt] of ['ネオン // SPEED // 危険 // ', '電脳 CITY ★ 24H ★ ', '>>> NOODLE BAR >>> ホテル '].entries()) {
      const c = ['#ff2bd6', '#00f0ff', '#fcee0a'][i];
      adMats.push(new THREE.MeshBasicMaterial({ map: tex(128, 16, g => { R(g, '#08080c', 0, 0, 128, 16); R(g, c, 0, 0, 128, 1); R(g, c, 0, 15, 128, 1); g.fillStyle = c; g.font = 'bold 11px sans-serif'; g.textBaseline = 'middle'; g.fillText(txt, 2, 8, 124); }) }));
    }
    for (let i = 70, k = 0; i < N; i += 90) {
      if (zone(i, 40) > 0) continue;
      const s = S[i], gr = new THREE.Group(); gr.position.set(s.x, s.y, s.z); gr.rotation.y = across(s); scene.add(gr);
      lum(i, s.x, s.y + 9, s.z, [0xff2bd6, 0x00f0ff, 0xfcee0a][k % 3], 24, 2.6); // l'écran éclaire la route sous lui
      box(2 * W + 3, 4, 0.5, adMats[k++ % 3], 0, 11.5, 0, gr);
      for (const sd of [-1, 1]) box(0.8, 13.5, 0.8, concrete, sd * (W + 1.3), 6.75, 0, gr);
    }
  }

  // ---------- ville (carte d'origine) ; les décors des autres cartes sont dans decors.js ----------
  let beams = [], holos = [], MV = 0, mvP, mvV, mvC, mvGeo, movers, beaconPts, decorTick = null;
  if (TH.decor === 'ville') {
  { // sol : grille de rues éclairées vue d'en haut
    const gt = tex(64, 64, g => { R(g, '#07060e', 0, 0, 64, 64); R(g, '#3a2408', 0, 0, 64, 2); R(g, '#3a2408', 0, 0, 2, 64); for (let i = 0; i < 64; i += 6) { R(g, '#ffb040', i, 0, 2, 1); R(g, '#40e0ff', 0, i + 3, 1, 2); } });
    gt.repeat.set(70, 70); box(5000, 1, 5000, new THREE.MeshBasicMaterial({ map: gt }), 0, -60.5, 200);
  }
  {
    const emi = (cols, p) => new THREE.MeshLambertMaterial({ map: facade, emissive: 0xffffff, emissiveMap: lit(cols, p) });
    const mats = [emi(['#ffd27a', '#ffe9b0'], 0.45), emi(['#7af0ff', '#d0f8ff'], 0.4), emi(['#ff5ad0', '#ffd27a', '#7af0ff'], 0.5), emi(['#ffd27a'], 0.12)];
    const signs = signMats = ['ネオン', 'スピード', '危険', 'ホテル', '電脳', 'BAR', 'NOODLE', '24H'].map((txt, i) => {
      const c = ['#ff003c', '#00f0ff', '#fcee0a', '#ff4fc8'][i % 4];
      return new THREE.MeshBasicMaterial({ map: tex(64, 32, g => { R(g, '#08080c', 0, 0, 64, 32); g.strokeStyle = c; g.lineWidth = 2; g.strokeRect(2, 2, 60, 28); g.fillStyle = c; g.font = 'bold 18px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 32, 17, 54); }) });
    });
    for (let gx = -620; gx <= 820; gx += 64) for (let gz = -260; gz <= 780; gz += 64) {
      const x = gx + rnd() * 24 - 12, z = gz + rnd() * 24 - 12, w = 28 + rnd() * 22, d = 28 + rnd() * 22, top = 24 + rnd() * rnd() * 150;
      const lim = (W + 4 + 0.71 * Math.max(w, d)) ** 2;
      if (S.some((s, i) => i % 3 === 0 && (s.x - x) ** 2 + (s.z - z) ** 2 < lim)) continue;
      const H = top + 60, g = new THREE.BoxGeometry(w, H, d), uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(1, Math.round(w / 28)), uv.getY(i) * Math.max(1, Math.round(H / 28)));
      const m = new THREE.Mesh(g, mats[rnd() * mats.length | 0]);
      m.position.set(x, top - H / 2, z); m.rotation.y = (rnd() - 0.5) * 0.6; m.castShadow = m.receiveShadow = true; scene.add(m);
      if (rnd() < 0.55) { const h2 = 8 + rnd() * 45, tm = box(w * (0.4 + rnd() * 0.3), h2, d * (0.4 + rnd() * 0.3), m.material, 0, H / 2 + h2 / 2, 0, m); tm.castShadow = true; } // étage en retrait
      if (rnd() < 0.45) { const ah = 10 + rnd() * 35; box(0.8, ah, 0.8, concrete, w * 0.35, H / 2 + ah / 2, d * 0.35, m); beacons.push(x + w * 0.35, top + ah + 1, z + d * 0.35); } // antenne et balise rouge
      for (let k = rnd() * 4 | 0; k > 0; k--) { // 0 à 3 enseignes de tailles variées, horizontales ou en drapeau vertical
        const sm = signs[rnd() * signs.length | 0], sd = rnd() < 0.5 ? -1 : 1, y = Math.max(6, Math.min(top - 5, 6 + rnd() * 45)) - m.position.y;
        const tall = rnd() < 0.35, sw = tall ? 5 : 10 + rnd() * 14, sh = tall ? 14 + rnd() * 10 : sw / 2, o = (rnd() - 0.5) * 0.5;
        if (rnd() < 0.5) box(0.5, sh, sw, sm, sd * (w / 2 + 0.3), y, o * d, m); else box(sw, sh, 0.5, sm, o * w, y, sd * (d / 2 + 0.3), m);
      }
    }
  }
  // ---------- horizon et vie de la ville ----------
  { // mégatours lointaines, hors brouillard : silhouettes piquées de fenêtres sur le halo de l'horizon
    const far = new THREE.MeshBasicMaterial({ fog: false, map: tex(32, 64, g => { R(g, '#0d0820', 0, 0, 32, 64); for (let i = 0; i < 70; i++) R(g, ['#ffd27a', '#7af0ff', '#ff5ad0'][i % 3], rnd() * 32 | 0, rnd() * 64 | 0, 1, 1); }) });
    for (let i = 0; i < 44; i++) { const a = i / 44 * 6.283 + rnd() * 0.1, rad = 1150 + rnd() * 500, h = 200 + rnd() * rnd() * 600, w = 60 + rnd() * 90; box(w, h, w, far, 100 + Math.cos(a) * rad, h / 2 - 60, 250 + Math.sin(a) * rad); }
  }
  // faisceaux de projecteurs qui balaient le ciel
  const beamGeo = new THREE.PlaneGeometry(26, 900); beamGeo.translate(0, 450, 0);
  beams = [[320, 120], [-120, 330], [520, -120], [80, 660], [-420, 60], [700, 420]].map(([x, z], i) => { const b = new THREE.Mesh(beamGeo, addMat(gradTex(['#5a7cff', '#ff2bd6', '#00f0ff'][i % 3], true), { opacity: 0.5 })); b.position.set(x, -60, z); scene.add(b); return b; });
  // hologrammes géants : les enseignes en lumière pure, qui tournent et grésillent
  holos = [[250, 150, 210], [-160, 165, 300], [450, 140, -90], [0, 185, 640], [640, 170, 520]].map(([x, y, z], i) => { const h = new THREE.Mesh(new THREE.PlaneGeometry(90, 45), addMat(signMats[i].map, { opacity: 0.6 })); h.position.set(x, y, z); scene.add(h); return h; });
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
  } else decorTick = window.DECORS[TH.decor]({ THREE, scene, T, S, N, W, M, TH, tex, R, box, ribbon, rnd, addMat, gradTex, bas, across, zone, lum, retro, gloss, temps: () => race ? -1 : tTraf }); // pas de trafic en course : les adversaires ne savent pas l'éviter

  // pluie : traînées qui s'allongent et foncent vers la caméra avec la vitesse
  const RN = 400, rainP = new Float32Array(RN * 3), rainGeo = new THREE.BufferGeometry(), rainV = new Float32Array(RN * 6);
  for (let i = 0; i < RN; i++) rainP.set([rnd() * 80 - 40, rnd() * 30, rnd() * 80 - 40], i * 3);
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainV, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0x9fc8ff, transparent: true, opacity: 0.55, fog: false }));
  rain.frustumCulled = false; scene.add(rain);

  // ---------- voiture : coque en coin, roues qui tournent et braquent, feux stop ----------
  const carG = new THREE.Group(), body = new THREE.Group(); carG.add(body); scene.add(carG);
  const L = CARD.look, carMat = gloss(new THREE.MeshLambertMaterial({ color: L.col }), 0.9), dark = gloss(new THREE.MeshLambertMaterial({ color: 0x14141e }), 1.3), rim = new THREE.MeshLambertMaterial({ color: 0x9a9ab0 });
  const wedge = (w, h, d, nose) => { // boîte dont l'arête avant-haut est abaissée
    const ge = new THREE.BoxGeometry(w, h, d), p = ge.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getX(i) > 0 && p.getY(i) > 0) p.setY(i, p.getY(i) - h * nose);
    ge.computeVertexNormals(); return ge;
  };
  const part = (ge, mat, x, y, z, parent = body) => { const m = new THREE.Mesh(ge, mat); m.position.set(x, y, z); parent.add(m); return m; };
  // silhouettes dédiées (boîtes, coins et trapèzes, en mètres, sans échelle) ; la GT-R garde le coin d'origine
  const K = { MAZDA: 'fd', TOYOTA: 'a80', RENAULT: 'r5', DODGE: 'gts' }[CARD.nom.split(' ')[0]]; // shortcut: déduit du nom, à remplacer par un champ look.type si cartes.js en gagne un
  const trap = (l, h, w, a, b, tz) => { // boîte dont le dessus est raccourci (a devant, b derrière) et resserré : habitacle à pare-brise et lunette inclinés
    const ge = new THREE.BoxGeometry(l, h, w), p = ge.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) { p.setX(i, p.getX(i) + (p.getX(i) > 0 ? -a : b)); p.setZ(i, p.getZ(i) * tz); }
    ge.computeVertexNormals(); return ge;
  };
  const B = (l, h, w, mat, x, y, z) => box(l, h, w, mat, x, y, z, body), B2 = (l, h, w, mat, x, y, z) => { B(l, h, w, mat, x, y, z); B(l, h, w, mat, x, y, -z); };
  const brakeMat = new THREE.MeshBasicMaterial({ color: 0x8a1020 }), lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2d0 });
  const rond = (r, mat, x, y, z) => { const ge = new THREE.CylinderGeometry(r, r, 0.06, 8); ge.rotateZ(Math.PI / 2); part(ge, mat, x, y, z); part(ge, mat, x, y, -z); }; // feu rond, par paire
  let WH = [-1.4 * L.l, 1.45 * L.l, 0.95 * L.w, 0.95 * L.w, 1]; // roues : x arrière, x avant, z arrière, z avant, échelle
  const roues = (xr, xf, cr, cf, k) => { WH = [xr, xf, cr + 0.04 - 0.18 * k, cf + 0.04 - 0.18 * k, k]; }; // roues logées dans la caisse, flanc du pneu à fleur de l'aile (cr, cf)
  if (K === 'fd') { // Mazda RX-7 FD3S Spirit R : nez bas, bulle courte, grande lunette, bandeau noir à quatre feux ronds, aileron bas
    B(2.3, 0.56, 1.86, carMat, -0.95, 0.52, 0); part(wedge(1.9, 0.56, 1.86, 0.3), carMat, 1.15, 0.52, 0);
    part(trap(2.1, 0.4, 1.56, 0.7, 0.8, 0.78), dark, -0.55, 1, 0); B(0.7, 0.04, 1.2, carMat, -0.5, 1.21, 0);
    B(0.3, 0.05, 1.6, carMat, -1.9, 1.02, 0); B2(0.12, 0.2, 0.08, carMat, -1.9, 0.9, 0.6);
    B(0.04, 0.22, 1.6, dark, -2.11, 0.62, 0); rond(0.09, brakeMat, -2.13, 0.62, 0.36); rond(0.09, brakeMat, -2.13, 0.62, 0.62);
    B(0.3, 0.14, 1.6, dark, -2, 0.3, 0); B2(0.05, 0.08, 0.4, lampMat, 2.1, 0.42, 0.6);
    roues(-1.3, 1.3, 0.93, 0.93, 0.82);
  } else if (K === 'a80') { // Toyota Supra A80 RZ : caisse haute et ronde, aileron en arceau, trois feux ronds par côté
    B(2.6, 0.64, 1.95, carMat, -0.95, 0.56, 0); part(wedge(1.9, 0.64, 1.95, 0.3), carMat, 1.3, 0.56, 0);
    part(trap(2.3, 0.4, 1.6, 0.75, 0.95, 0.8), dark, -0.6, 1.08, 0); B(0.7, 0.04, 1.3, carMat, -0.7, 1.29, 0);
    B(0.4, 0.07, 1.95, carMat, -2, 1.36, 0); B2(0.4, 0.48, 0.1, carMat, -2, 1.12, 0.92);
    B2(0.04, 0.24, 0.74, dark, -2.26, 0.7, 0.56); for (const z of [0.32, 0.56, 0.8]) rond(0.1, brakeMat, -2.28, 0.7, z);
    B(0.3, 0.16, 1.7, dark, -2.15, 0.32, 0); B2(0.05, 0.14, 0.5, lampMat, 2.25, 0.5, 0.65);
    roues(-1.35, 1.35, 0.975, 0.975, 0.84);
  } else if (K === 'r5') { // Renault 5 Maxi Turbo : caisse étroite et courte, hayon, ailes arrière en caisson avec prise d'air, becquet de toit, rampe de quatre phares
    B(2.5, 0.66, 1.5, carMat, -0.55, 0.57, 0); part(wedge(1.1, 0.66, 1.5, 0.2), carMat, 1.25, 0.57, 0);
    part(trap(2.45, 0.5, 1.44, 0.6, 0.25, 0.84), carMat, -0.55, 1.15, 0);
    part(trap(1.5, 0.46, 1.48, 0.55, 0, 0.84), dark, -0.055, 1.13, 0); part(trap(0.5, 0.4, 1.15, 0, 0.2, 0.84), dark, -1.545, 1.15, 0); // pare-brise et vitres ; lunette entre deux montants
    B(0.1, 0.06, 1, dark, -1.55, 1.43, 0); B(0.32, 0.05, 1.3, carMat, -1.64, 1.48, 0);
    B2(1.3, 0.6, 0.28, carMat, -1.05, 0.56, 0.87); B2(0.04, 0.3, 0.2, dark, -0.39, 0.62, 0.88); B2(1, 0.5, 0.2, carMat, 1.1, 0.5, 0.84);
    B(0.08, 0.16, 1.9, dark, -1.8, 0.36, 0); B2(0.05, 0.3, 0.2, brakeMat, -1.81, 0.72, 0.6);
    B(0.1, 0.2, 1.8, dark, 1.8, 0.36, 0); B2(0.05, 0.14, 0.24, lampMat, 1.81, 0.64, 0.6); rond(0.11, lampMat, 1.83, 0.64, 0.13); rond(0.11, lampMat, 1.83, 0.64, 0.38);
    roues(-1.05, 1.1, 1.01, 0.94, 0.8);
  } else if (K === 'gts') { // Dodge Viper GTS : capot moitié de la voiture, habitacle reculé, toit à double bulle, queue relevée, deux bandes d'un bout à l'autre
    const S = new THREE.MeshLambertMaterial({ color: L.bandes });
    B(2.2, 0.56, 2, carMat, -1.2, 0.52, 0); part(wedge(2.4, 0.56, 2, 0.25), carMat, 1.1, 0.52, 0); B(1.3, 0.08, 2, carMat, -1.65, 0.84, 0);
    part(trap(2, 0.36, 1.56, 0.55, 0.8, 0.78), dark, -1, 0.98, 0); B2(0.7, 0.07, 0.5, carMat, -0.87, 1.18, 0.3); B(0.25, 0.08, 2, carMat, -2.2, 0.94, 0);
    for (const z of [-0.2, 0.2]) { part(wedge(2.42, 0.56, 0.2, 0.25), S, 1.1, 0.53, z); B(2.22, 0.56, 0.2, S, -1.2, 0.53, z); B(1.32, 0.02, 0.2, S, -1.65, 0.885, z); B(0.27, 0.09, 0.2, S, -2.2, 0.94, z); B(0.72, 0.02, 0.2, S, -0.87, 1.225, z); }
    B2(0.05, 0.14, 0.5, brakeMat, -2.31, 0.64, 0.65); B(0.3, 0.16, 1.6, dark, -2.2, 0.3, 0); B2(0.05, 0.12, 0.4, lampMat, 2.3, 0.5, 0.7); B2(0.3, 0.14, 0.02, dark, 0.6, 0.56, 1);
    roues(-1.4, 1.45, 1, 1, 0.82);
  } else {
    part(wedge(4.5, 0.62, 1.95, L.nez), carMat, 0, 0.62, 0); part(wedge(L.cab[1], L.cab[2], 1.6, 0.75), dark, L.cab[0], 0.91 + L.cab[2] / 2, 0); // coque, habitacle
    if (L.aileron) { const ah = 0.25 * (L.aileron - 1); box(0.4, 0.08, 2.15, carMat, -2.05, 1.5 + ah, 0, body); for (const z of [-0.85, 0.85]) box(0.1, 0.5 + ah, 0.1, dark, -2.05, 1.2 + ah / 2, z, body); }
    if (L.bandes) for (const z of [-0.2, 0.2]) box(L.cab[1] * 0.8, 0.02, 0.2, new THREE.MeshLambertMaterial({ color: L.bandes }), L.cab[0] - 0.15, 0.92 + L.cab[2], z, body);
    box(0.5, 0.25, 1.7, dark, -2.1, 0.42, 0, body); // diffuseur
    body.scale.set(L.l, L.h, L.w); // silhouette propre à chaque voiture
  }
  const wheelGeo = new THREE.CylinderGeometry(0.43, 0.43, 0.36, 8); wheelGeo.rotateX(Math.PI / 2);
  const wheels = [];
  for (const i of [0, 1]) for (const sg of [-1, 1]) {
    const st = new THREE.Group(); st.position.set(WH[i], 0.43 * WH[4], sg * WH[2 + i]); st.scale.setScalar(WH[4]); carG.add(st);
    const sp = part(wheelGeo, dark, 0, 0, 0, st); box(0.72, 0.14, 0.38, rim, 0, 0, 0, sp); // jante visible pour lire la rotation
    wheels.push({ sp, st: i ? st : null });
  }
  carG.traverse(o => { o.castShadow = true; });
  if (!K) {
    box(0.06, 0.2, 1.8, brakeMat, -2.27, 0.72, 0, body); // feux arrière, plus vifs au freinage
    for (const z of [-0.65, 0.65]) box(0.06, 0.16, 0.45, lampMat, 2.27, 0.42, z, body); // phares
  }
  if (L.neon) for (const z of [-1, 1]) box(3, 0.07, 0.05, new THREE.MeshBasicMaterial({ color: L.neon }), 0, 0.34, z, body); // liserés néon de bas de caisse

  // traînées lumineuses des feux arrière : deux rubans tirés sur les dernières positions
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
    for (const w of wheels) { w.sp.rotation.z -= car.vf * dt / 0.43; if (w.st) w.st.rotation.y = -car.steer * 0.45; }
    brakeMat.color.setHex(inp.brake ? 0xff7080 : 0x8a1020);
    // traînées
    hist.unshift([car.x - fx * 2.3, carY + 0.72, car.z - fz * 2.3, rx, rz]); if (hist.length > TN) hist.length = TN;
    const glow = Math.min(1, sp / 15) * (inp.brake ? 1 : 0.4);
    for (let l = 0; l < 2; l++) for (let k = 0; k < TN; k++) {
      const h = hist[Math.min(k, hist.length - 1)], sd = l ? 0.78 : -0.78, a = (l * TN + k) * 6, f = (1 - k / TN) ** 2 * glow;
      trailP.set([h[0] + h[3] * sd, h[1] + 0.1, h[2] + h[4] * sd, h[0] + h[3] * sd, h[1] - 0.1, h[2] + h[4] * sd], a);
      trailC.set([f, f * 0.08, f * 0.16, f, f * 0.08, f * 0.16], a);
    }
    trailGeo.attributes.position.needsUpdate = trailGeo.attributes.color.needsUpdate = true;
    // émissions
    if (car.slide > 0.3 && sp > 10) for (const sd of [-0.9, 0.9]) emit(car.x - fx * 1.4 + rx * sd, carY + 0.2, car.z - fz * 1.4 + rz * sd, car.vx * 0.25 + jit(4), 1 + Math.random() * 2.5, car.vz * 0.25 + jit(4), 0.9, lerp(0.16, 0.28, lm), lerp(0.18, 0.06, lm), lerp(0.28, 0.06, lm), -1);
    if (hit > 3) { const s = S[car.idx], sg = Math.sign(car.d); for (let i = 0; i < 16; i++) emit(car.x - s.tz * sg, carY + 0.5, car.z + s.tx * sg, car.vx * 0.5 + jit(14), 2 + Math.random() * 7, car.vz * 0.5 + jit(14), 0.5, 1, 0.75, 0.25, 22); }
    else if (car.rub && sp > 8) { const s = S[car.idx], sg = Math.sign(car.d); for (let i = 0; i < 3; i++) emit(car.x - s.tz * sg, carY + 0.4, car.z + s.tx * sg, car.vx * 0.6 + jit(5), 1 + Math.random() * 4, car.vz * 0.6 + jit(5), 0.35, 1, 0.75, 0.25, 22); } // frottement continu : gerbe plus fine que le choc
    if (car.boost > 0) for (const sd of [-0.5, 0.5]) emit(car.x - fx * 2.4 + rx * sd, carY + 0.45, car.z - fz * 2.4 + rz * sd, car.vx * 0.7 - fx * 5 + jit(1), jit(1), car.vz * 0.7 - fz * 5 + jit(1), 0.2, 0.3, 0.8, 1, 0);
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

  const ghostM = box(4.4, 0.9, 1.9, addMat(null, { color: 0x00f0ff, opacity: 0.4, polygonOffset: false }), 0, 0, 0); ghostM.visible = false; // fantôme : simple silhouette lumineuse
  // adversaires du mode course : copies de la voiture du joueur, une couleur chacune (roues fixes) ; [nom, couleur]
  const OPP = [['KENJI', '#00c8ff'], ['REI', '#ff8a00'], ['JUN', '#40ff80']].map(([n, c], i) => [M.rivaux ? M.rivaux[i] : n, c]);
  const opps = OPP.map(([, col]) => {
    const g = carG.clone(), m = gloss(new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 0.45 }), 0.9), b = brakeMat.clone(); // un peu lumineuse : lisible de nuit et de loin
    g.traverse(o => { if (o.material === carMat) o.material = m; else if (o.material === brakeMat) o.material = b; });
    g.visible = false; g.userData.y = 0; scene.add(g); return g;
  });
  scene.traverse(o => { if (o.isInstancedMesh) o.frustumCulled = false; if (o.material) eclaire(o.material); }); // r128 calcule le culling sur la géométrie de base, pas sur les instances

  // ---------- audio : voir audio.js (window.SON) ; ici seulement ce que le jeu et le HUD lisent ----------
  let stun = 0, gear = 0, rpm = 0.3, load = 0, spool = 0, radioT = 0;
  const zap = () => { SON.setStation(SON.station + 1); radioT = 2.5; };
  // boîte et régime : calculés même sans audio, la jauge du HUD s'en sert
  function drivetrain(dt, r, gas) { // rapport et régime viennent de la physique (sim.js) ; ici on les lisse pour le son et la jauge
    const up = car.gear > gear; gear = car.gear;
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
  let msel = 3; // ligne du menu principal
  try { if (sessionStorage.getItem('vpr.menu')) { msel = 0; sessionStorage.removeItem('vpr.menu'); } } catch (e) { } // on vient de changer de carte : on reste sur cette ligne
  const fmt = t => `${t / 60 | 0}'${String(t % 60 | 0).padStart(2, '0')}"${String(t * 100 % 100 | 0).padStart(2, '0')}`;
  let car = newCar(T), state = 'title', tRace = 0, best = store.get('best') || 0, count = 0, shown = 0, goT = 0, acc = 0, last = 0, cth = car.th, lm = 0, carY = S[car.idx].y, pitch = 0, result = null, manual = pref('vpr.boite', 'a') === 'm';
  // secteurs (entrée et sortie de l'échangeur) et fantôme du record : [x, y, z, cap] à 20 Hz
  // mode : 'solo' (contre-la-montre à tours enchaînés) ou 'course' (3 tours contre les IA de sim.js) ; race = la course en cours, sinon null
  let mode = pref('vpr6.mode', '') === '"course"' ? 'course' : 'solo', race = null, raceEnd = false; // le mode est mémorisé une fois pour toutes les cartes
  let si = 0, cur = [], bestSpl = store.get('splits'), ghost = store.get('ghost'), recG = [], splitMsg = null, lapN = 1, prev = 'race', psel = 0, ghostOn = !!store.get('ghostOn');
  const keys = {}, H = 1 / 120;

  function start() {
    SON.init();
    race = mode === 'course' ? newRace(T) : null; raceEnd = false;
    car = race ? race.cars[0] : newCar(T); car.manual = manual; gear = 0; hist.length = 0; si = 0; cur = []; recG = []; splitMsg = null; cth = car.th; carY = S[car.idx].y; state = 'count'; count = 3; shown = 0; tRace = 0; tTraf = 0; acc = 0; lapN = 1; result = null;
  }
  function finish() { // tour bouclé : on l'enregistre, on affiche son temps 4 s, et le chrono repart aussitôt pour un tour lancé
    const rec = !best || tRace < best; result = { rec, diff: best ? tRace - best : 0, t: tRace, n: lapN, T: 4 };
    if (rec) { best = tRace; bestSpl = cur; ghost = recG; store.set('best', best); store.set('splits', cur); store.set('ghost', ghost); }
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
      setPref('vpr.carte', id); try { sessionStorage.setItem('vpr.menu', 1); } catch (e) { }
      location.href = location.pathname + '?carte=' + id;
    } else if (msel === 1) { mode = mode === 'solo' ? 'course' : 'solo'; setPref('vpr6.mode', JSON.stringify(mode)); }
    else if (msel === 2) { manual = !manual; car.manual = manual; setPref('vpr.boite', manual ? 'm' : 'a'); }
    else start();
  }
  addEventListener('keydown', e => {
    keys[e.code] = 1;
    if (/^Arrow|Space/.test(e.code)) e.preventDefault();
    if (e.repeat) return;
    const key = (e.key || '').toLowerCase(); // lettre réellement tapée, pour les commandes nommées par une lettre (le pilotage, lui, reste en positions physiques)
    if (state === 'pause') {
      if (e.code === 'Escape' || key === 'p') state = prev;
      else if (e.code === 'ArrowUp' || e.code === 'KeyW') psel = (psel + 6) % 7;
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') psel = (psel + 1) % 7;
      else if (e.code === 'Enter' || e.code === 'Space') pauseAct();
      return;
    }
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
  });
  addEventListener('keyup', e => { keys[e.code] = 0; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = 0; }); // sinon une touche reste enfoncée après Alt-Tab
  // e.code = position physique : KeyW/KeyA sont Z/Q sur un clavier AZERTY
  const input = () => ({
    steer: (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0),
    gas: keys.ArrowUp || keys.KeyW ? 1 : 0, brake: keys.ArrowDown || keys.KeyS ? 1 : 0, hand: !!keys.Space,
  });

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
    c.width = w; c.height = h;
    const px = x => Math.round((w - (x1 - x0) * k) / 2 + (x - x0) * k), pz = z => Math.round((h - (z1 - z0) * k) / 2 + (z - z0) * k);
    for (const s of S) R(g, '#e8e8e4', px(s.x), pz(s.z), 1, 1);
    R(g, RD, px(S[0].x) - 2, pz(S[0].z) - 2, 5, 5); // ligne de départ
    return { c, px, pz };
  })();
  function drawHUD(dt, sp, r, warn) {
    hg.clearRect(0, 0, HW, HH);
    const cx = HW / 2, blink = (performance.now() / 160 | 0) % 3 > 0;
    if (state === 'title') { // menu principal : la carte tourne derrière, on choisit carte, mode et boîte
      R(hg, 'rgba(8,8,12,.45)', 0, 0, HW, HH);
      if (HU.sur[0]) txt(HU.sur[0], cx, 8, 16, C, 'center', 0, JP); txt(HU.sur[1], cx, 30, 8, C, 'center');
      txt(HU.titre[0], cx, 44, 24, Y, 'center', 2); txt(HU.titre[1], cx, 70, 24, Y, 'center', 2);
      panel(cx - 160, 100, 320, 130);
      [['CARTE', M.nom + '  ' + (CARTES.indexOf(M) + 1) + '/' + CARTES.length], ['MODE', mode === 'course' ? 'COURSE CONTRE 3 IA' : 'CONTRE-LA-MONTRE'], ['BOITE', manual ? 'MANUELLE' : 'AUTO']].forEach(([l, v], i) => {
        const on = msel === i, y = 108 + i * 15;
        txt((on ? '> ' : '  ') + l, cx - 152, y, 8, on ? Y : '#e8e8e4'); txt(on ? '< ' + v + ' >' : v, cx + 152, y, 8, on ? Y : C, 'right');
      });
      if (msel === 3) { if (blink) tag('> DEMARRER <', cx, 152, Y); } else txt('DEMARRER', cx, 155, 8, '#e8e8e4', 'center');
      hg.drawImage(MM.c, cx - 152, 170); // le tracé, puis la fiche de la carte
      [CARD.nom, (T.len / 1000).toFixed(1).replace('.', ',') + ' KM   ' + (M.trafic ? 'TRAFIC' : T.tun ? 'TUNNEL' : 'CIEL OUVERT'), mode === 'course' ? '3 TOURS, DEPART EN GRILLE' : 'RECORD ' + (best ? fmt(best) : '--'), SON.nom + ' ' + SON.fq].forEach((l, i) => txt(l, cx - 58, 174 + i * 13, 8, i ? '#e8e8e4' : C));
      txt('HAUT/BAS : CHOISIR  GAUCHE/DROITE : CHANGER', cx, 238, 8, '#e8e8e4', 'center'); txt('FLECHES / ZQSD : PILOTER   ESPACE : GLISSE', cx, 251, 8, '#e8e8e4', 'center');
      hudT.needsUpdate = true; return;
    }
    // chrono
    panel(6, 6, 132, 50); txt(race ? 'TOUR ' + car.lap + '/' + race.laps : 'TOUR ' + lapN, 12, 11, 8, C); if (HU.jp) txt(HU.jp[0], 132, 6, 16, C, 'right', 0, JP);
    txt(fmt(tRace), 12, 24, 16, Y, 'left', 1); txt(race ? 'PLACE ' + car.pos + '/' + race.cars.length : best ? 'REC ' + fmt(best) : 'REC --', 12, 44, 8, RD);
    if (race && !raceEnd) txt(car.pos + '/' + race.cars.length, cx, 8, 16, Y, 'center', 1);
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
      dot(car.x, car.z, Y);
    }
    if (race && !raceEnd && state !== 'title') { // repère au-dessus de chaque adversaire : à 270 lignes, une voiture lointaine ne fait que quelques pixels
      cam.updateMatrixWorld();
      race.cars.forEach((c, i) => {
        const dx = c.x - cam.position.x, dz = c.z - cam.position.z, f = dx * Math.cos(cth) + dz * Math.sin(cth);
        if (!i || f < 3 || f > 400) return; // derrière la caméra ou trop loin
        tmp.set(c.x, opps[i - 1].userData.y + 2.4, c.z).project(cam);
        const [name, col] = OPP[i - 1], x = Math.round((tmp.x + 1) / 2 * HW), y = Math.round((1 - tmp.y) / 2 * HH), w = name.length * 8 + 4;
        R(hg, 'rgba(8,8,12,.75)', x - w / 2, y - 14, w, 11); txt(name, x, y - 12, 8, col, 'center'); R(hg, col, x - 2, y - 2, 5, 3); R(hg, col, x - 1, y + 1, 3, 2);
      });
    }
    if (car.boost > 0) tag('BOOST', cx, 82, C);
    if (splitMsg && (splitMsg.T -= dt) > 0) tag('S' + (splitMsg.i + 1) + ' ' + (splitMsg.d == null ? fmt(splitMsg.t) : (splitMsg.d <= 0 ? '-' : '+') + Math.abs(splitMsg.d).toFixed(2)), cx, 102, splitMsg.d == null ? Y : splitMsg.d <= 0 ? C : RD); // écart au record à chaque secteur
    if (warn && blink) tag(warn > 0 ? '! VIRAGE DROITE >>' : '<< VIRAGE GAUCHE !', cx, 62, Y);
    // écrans
    if (state === 'count' && shown) txt(String(shown), cx, 90, 64, Y, 'center', 3);
    else if (goT > 0) txt('GO', cx, 90, 64, Y, 'center', 3);
    if (result && state !== 'title' && (result.T -= dt) > 0) { // résultat du tour qu'on vient de boucler, sans arrêter la course
      tag('TOUR ' + result.n + '  ' + fmt(result.t), cx, 122, Y); tag(result.rec ? 'NOUVEAU RECORD' : '+' + result.diff.toFixed(2) + ' S', cx, 138, result.rec ? C : RD);
    }
    if (raceEnd && state === 'race') { // arrivée : classement, complété à mesure que les autres passent la ligne
      panel(cx - 134, 60, 268, 132); txt('ARRIVEE : ' + car.pos + (car.pos === 1 ? 'ER' : 'E'), cx, 68, 16, Y, 'center', 1);
      raceOrder(race).forEach((c, i) => { const j = race.cars.indexOf(c); txt((i + 1) + '. ' + (j ? OPP[j - 1][0] : 'VOUS'), cx - 96, 96 + i * 16, 8, j ? OPP[j - 1][1] : Y); txt(c.fin ? fmt(c.fin) : '--', cx + 96, 96 + i * 16, 8, j ? '#e8e8e4' : Y, 'right'); });
      txt('ENTREE : REJOUER   ECHAP : PAUSE', cx, 172, 8, C, 'center');
    }
    if (state === 'pause') {
      R(hg, 'rgba(8,8,12,.86)', 0, 0, HW, HH); txt('PAUSE', cx, 36, 32, Y, 'center', 2);
      pauseItems().forEach((s, i) => i === psel ? tag('> ' + s + ' <', cx, 92 + i * 20, Y) : txt(s, cx, 95 + i * 20, 8, '#e8e8e4', 'center'));
      txt('HAUT / BAS : CHOISIR   ENTREE : VALIDER', cx, 228, 8, C, 'center');
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

  const ROUGE = new THREE.Color(0xff1828), PHARE = new THREE.Color(0xfff2d0), NEONC = new THREE.Color(L.neon || 0), BOITE = new THREE.Matrix4().makeScale(2.35, 0.64, 1.02).setPosition(0, 0.8, 0); // BOITE : englobe toute la caisse, pour l'ombre (un point dedans ou dessus n'est pas ombré)
  let lumIdx = -1;
  function frame(now) {
    const dt = state === 'pause' ? 0 : clamp((now - last) / 1000 || 0, 0, 0.1); last = Math.max(last, now); // en pause le temps s'arrête, l'image reste
    if (state === 'count') {
      count -= dt; const k = Math.ceil(count); // une seconde par chiffre
      if (count <= 0) { state = 'race'; goT = 0.8; SON.beep(880); SON.crash(); }
      else if (k !== shown) { shown = k; SON.beep(440); }
    }
    if (goT > 0) goT -= dt;
    const keyIn = input();
    const inp = state === 'race' ? (AUTO || raceEnd ? autopilot(car, T, 1, M.trafic && !race ? trafic(T, tTraf) : []) : keyIn) : { steer: 0, gas: 0, brake: 0, hand: false };
    let hit = 0;
    for (acc += dt; acc >= H; acc -= H) {
      // en course, sim.js fait avancer tout le monde ; inp = null : l'IA conduit la voiture du joueur (?auto, ou une fois arrivé)
      if (race && state === 'race') stepRace(race, AUTO || raceEnd ? null : inp, H); else { step(car, inp, T, H); if (M.trafic && state === 'race') hitTrafic(car, T, tTraf); }
      hit = Math.max(hit, car.hit, car.bump || 0); // shortcut: un choc entre voitures réutilise les effets du choc mur (étincelles côté mur), à séparer si ça se voit
      if (state === 'race' && !raceEnd) {
        tRace += H; tTraf += H;
        if (race) { if (car.fin) { raceEnd = true; tRace = car.fin; car.manual = false; SON.stinger(car.pos === 1); } }
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
    const cx = Math.cos(cth), cz = Math.sin(cth), back = 6.4 - 1 * r; // caméra basse et proche : le sol défile en proportion inverse de sa hauteur, c'est ce qui donne la sensation de vitesse
    let px = car.x - cx * back, pz = car.z - cz * back;
    const s = S[(car.idx - 4 + N) % N], nx = -s.tz, nz = s.tx, d = (px - s.x) * nx + (pz - s.z) * nz, o = Math.abs(d) - (W - 0.8);
    if (o > 0) { px -= nx * Math.sign(d) * o; pz -= nz * Math.sign(d) * o; } // la caméra reste entre les murs
    const shake = 0.04 * r * r + (stun > 0 ? stun * 0.5 : 0);
    cam.position.set(px + (Math.random() - 0.5) * shake, yAt(car, -3) + (M.camH || 2.2) - 0.5 * r + (Math.random() - 0.5) * shake, pz);
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
    LUX.uSunC.value.copy(SUNC).multiplyScalar(1 - lm); LUX.uSky.value.copy(scene.fog.color); LUX.uRes.value.set(TREMBLE ? HW / 2 / TREMBLE : 0, HH / 2 / TREMBLE);
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
    rain.visible = !!TH.pluie && lm < 0.5; rain.position.set(car.x, carY, car.z);
    for (let i = 0; i < RN; i++) {
      let x = rainP[i * 3] - car.vx * dt, y = rainP[i * 3 + 1] - 55 * dt, z = rainP[i * 3 + 2] - car.vz * dt;
      x = ((x + 40) % 80 + 80) % 80 - 40; z = ((z + 40) % 80 + 80) % 80 - 40; if (y < 0) y += 30;
      rainP[i * 3] = x; rainP[i * 3 + 1] = y; rainP[i * 3 + 2] = z;
      rainV.set([x, y, z, x + car.vx * 0.035, y + 1.9, z + car.vz * 0.035], i * 6);
    }
    rainGeo.attributes.position.needsUpdate = true;

    if (state === 'race' && !race) {
      while (recG.length / 4 <= tRace * 20) recG.push(+car.x.toFixed(2), +carY.toFixed(2), +car.z.toFixed(2), +car.th.toFixed(3));
      if (si < 2 && car.dist >= T.sp[si]) { cur[si] = tRace; splitMsg = { i: si, t: tRace, d: bestSpl ? tRace - bestSpl[si] : null, T: 2.5 }; si++; }
    }
    const gi = tRace * 20, g0 = Math.floor(gi) * 4, gf = gi % 1;
    ghostM.visible = ghostOn && state === 'race' && !race && !!ghost && g0 + 7 < ghost.length;
    if (ghostM.visible) { ghostM.position.set(lerp(ghost[g0], ghost[g0 + 4], gf), lerp(ghost[g0 + 1], ghost[g0 + 5], gf) + 0.6, lerp(ghost[g0 + 2], ghost[g0 + 6], gf)); ghostM.rotation.y = -(ghost[g0 + 3] + wrap(ghost[g0 + 7] - ghost[g0 + 3]) * gf); }
    fxFrame(dt, now, sp, inp, hit, fx, fz);
    SON.frame(dt, { state, car, T, hot: hot(car.idx, 50), r, sp, gas, hit, up, rpm, load, spool, stun });

    // alerte de virage serré, lue sur la courbure à venir
    let wk = 0;
    for (let j = 15; j < 35 + sp * 0.6; j++) { const k = S[(car.idx + j) % N].k; if (Math.abs(k) > Math.abs(wk)) wk = k; }
    drawHUD(dt, sp, r, state === 'race' && sp > 30 && Math.abs(wk) > 0.011 ? Math.sign(wk) : 0);
    // flou de vitesse : rien sous 55 % de la vitesse de pointe, léger au-delà, franc seulement pendant le boost
    post.uniforms.amt.value = 0.35 * Math.max(0, (r - 0.55) / 0.45) ** 2 + (car.boost > 0 ? 0.3 : 0); post.uniforms.ab.value = 0.002 + 0.004 * r + (stun > 0 ? stun * 0.06 : 0);
    renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(null); renderer.render(postScene, postCam);
  }
  const loop = now => { requestAnimationFrame(loop); frame(now); };
  requestAnimationFrame(loop);
  window.__g = { frame, start, M, scene, renderer, LUX, get race() { return race; }, get mode() { return mode; }, keys, get car() { return car; }, get state() { return state; }, get t() { return tRace; }, get ac() { return SON.ac; }, get out() { return SON.out; }, get smp() { return SON.smp; } }; // prise de test
})();
