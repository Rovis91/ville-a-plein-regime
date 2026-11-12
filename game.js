// Ville à plein régime — rendu, effets, audio, HUD, commandes et boucle de jeu. La piste et la physique sont dans sim.js.
// Plan du fichier (chercher « // ---------- ») : rendu et passe finale · textures · piste · ville · horizon · voiture et effets ·
// audio (stations, séquenceur, moteur, pneus) · état de jeu et commandes · HUD · boucle. Voir README.md pour savoir où régler quoi.
(() => {
  const T = buildTrack(THREE), S = T.S, N = T.n, W = T.W, V3 = THREE.Vector3;
  const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const AUTO = location.search.includes('auto'); // debug : le pilote auto conduit
  // 0 à ciel ouvert, 1 dans l'échangeur, rampes linéaires de `ramp` échantillons (2 m) avant l'entrée / après la sortie
  const zone = (i, ramp) => {
    const a = (i - T.t0 + N) % N, L = T.t1 - T.t0;
    return a < L ? 1 : Math.max(0, 1 - (a - L) / ramp, 1 - (N - a) / ramp);
  };
  let seed = 7;
  const rnd = () => { seed = seed * 1664525 + 1013904223 >>> 0; return seed / 4294967296; };

  // ---------- rendu basse définition : scène → cible 270p → passe finale (flou de vitesse, HUD, scanlines) ----------
  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.BasicShadowMap;
  document.body.prepend(renderer.domElement);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(70, 1, 0.5, 3000);
  const FOG_OUT = new THREE.Color(0x1f0a36), FOG_IN = new THREE.Color(0x2a0308), WHITE = new THREE.Color(0xffffff);
  scene.fog = new THREE.Fog(0x1f0a36, 60, 800);
  const rt = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  // le HUD est dessiné sur un canvas 2D à la même résolution que le jeu, puis composé dans la passe finale : une seule grille de pixels
  const hudC = document.createElement('canvas'), hg = hudC.getContext('2d'), hudT = new THREE.CanvasTexture(hudC);
  hudT.minFilter = hudT.magFilter = THREE.NearestFilter;
  const post = new THREE.ShaderMaterial({
    uniforms: { t: { value: rt.texture }, h: { value: hudT }, amt: { value: 0 }, ab: { value: 0 }, res: { value: 270 }, px: { value: new THREE.Vector2(1 / 480, 1 / 270) } },
    vertexShader: 'varying vec2 v; void main(){ v = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: `uniform sampler2D t, h; uniform float amt, ab, res; uniform vec2 px; varying vec2 v;
      void main(){
        vec2 c0 = vec2(.5, .42), d = v - c0; float l = length(d); vec3 c = vec3(0.);
        for (int i = 0; i < 8; i++) { // flou radial : nul au centre, fort sur les bords, proportionnel à la vitesse
          vec2 u = c0 + d * (1. - amt * l * float(i) * .026);
          c += vec3(texture2D(t, u + d * ab).r, texture2D(t, u).g, texture2D(t, u - d * ab).b); // + aberration chromatique
        }
        c /= 8.;
        vec3 bl = vec3(0.); // halo : on ajoute ce qui dépasse un seuil de luminosité, prélevé en couronne
        for (int i = 0; i < 12; i++) { float a = float(i) * .5236, rr = 2. + 2.5 * mod(float(i), 3.); bl += max(texture2D(t, v + vec2(cos(a), sin(a)) * rr * px).rgb - .5, 0.); }
        c += bl * .13;
        vec4 hd = texture2D(h, v); c = mix(c, hd.rgb, hd.a);
        c *= 1. - .12 * mod(floor(v.y * res), 2.); // scanlines calées sur la grille
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
    const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapLinearFilter;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  };
  const bas = (map, color = 0xffffff) => new THREE.MeshBasicMaterial({ map, color, side: THREE.DoubleSide });
  const R = (g, c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };

  // ciel de nuit en bandes, halo de pollution lumineuse à l'horizon, étoiles, lune
  const skyMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, map: tex(512, 128, g => {
    const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, '#03020a'); gr.addColorStop(0.36, '#120a2e'); gr.addColorStop(0.47, '#5a1058'); gr.addColorStop(0.5, '#1f0a36'); gr.addColorStop(1, '#1f0a36');
    R(g, gr, 0, 0, 512, 128);
    for (let i = 0; i < 140; i++) R(g, i % 5 ? '#8a8ac0' : '#ffffff', rnd() * 512 | 0, rnd() * 44 | 0, 1, 1);
  }) });
  skyMat.map.minFilter = THREE.NearestFilter;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2500, 16, 12), skyMat); scene.add(sky);
  const SD = new V3(0.45, 0.8, 0.4).normalize();
  const sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ fog: false, map: tex(16, 16, g => { g.fillStyle = '#d8e8ff'; g.beginPath(); g.arc(8, 8, 7, 0, 7); g.fill(); R(g, '#a8b8e0', 9, 5, 2, 2); R(g, '#a8b8e0', 5, 9, 3, 2); }) }));
  sunDisc.scale.set(170, 170, 1); scene.add(sunDisc);

  const hemi = new THREE.HemisphereLight(0x5a6cff, 0xff2a6a, 0.55); scene.add(hemi); // bleu d'en haut, rebond magenta de la ville
  const sun = new THREE.DirectionalLight(0x8fb0ff, 0.35); sun.castShadow = true; // clair de lune
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0015; sun.shadow.normalBias = 0.5;
  Object.assign(sun.shadow.camera, { left: -180, right: 180, top: 180, bottom: -180, near: 10, far: 800 });
  scene.add(sun, sun.target);
  const neon = new THREE.PointLight(0x00f0ff, 1.2, 14); scene.add(neon); // néon sous la caisse dehors, alarme dans l'échangeur
  const head = new THREE.SpotLight(0xfff2d0, 2.6, 110, 0.5, 0.6); scene.add(head, head.target); // phares

  // ---------- textures ----------
  const speckle = (g, n, c, h = 1) => { for (let i = 0; i < n; i++) R(g, c, rnd() * 64 | 0, rnd() * 64 | 0, 1, h); };
  const roadTex = (asph, spk, edge, dash, k1, k2, wet) => tex(64, 64, g => {
    R(g, asph, 0, 0, 64, 64); speckle(g, 200, spk);
    if (wet) { speckle(g, 14, '#16303c', 7); speckle(g, 14, '#34163a', 7); } // traînées de reflets
    R(g, edge, 5, 0, 2, 64); R(g, edge, 57, 0, 2, 64); R(g, dash, 31, 0, 2, 32);
    for (const x of [0, 60]) { R(g, k1, x, 0, 4, 32); R(g, k2, x, 32, 4, 32); }
  });
  const wallTex = neonC => tex(32, 32, g => { // u : 0 = haut du mur
    R(g, '#140406', 0, 0, 32, 32); R(g, '#3a0a10', 0, 0, 32, 2); R(g, neonC, 9, 0, 3, 32); R(g, '#5a1018', 25, 0, 1, 32); R(g, '#080203', 29, 0, 3, 32);
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
  let signMats; const beacons = [], adMats = [];

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

  const cT = T.t1 - T.t0, cO = N - cT;
  // route mouillée : Phong (éclairage par pixel) pour que phares, néon et lune y laissent des reflets
  ribbon(T.t1, cO, -W, 0, W, 0, new THREE.MeshPhongMaterial({ map: roadTex('#2c2c3a', '#383848', '#fcee0a', '#d8d8e0', '#fcee0a', '#08080c', true), shininess: 60, specular: 0x666688, side: THREE.DoubleSide }));
  const barrier = bas(tex(32, 32, g => { R(g, '#12121a', 0, 0, 32, 32); R(g, '#00f0ff', 0, 0, 3, 32); R(g, '#fcee0a', 6, 0, 1, 32); R(g, '#0a0a10', 13, 0, 19, 32); R(g, '#0a0a10', 3, 0, 10, 1); }));
  ribbon(T.t1, cO, -W, 1.4, -W, -2, barrier); ribbon(T.t1, cO, W, 1.4, W, -2, barrier);
  // échangeur en alarme rouge : intérieur non éclairé qui bat avec la musique, coque sombre
  const tunMats = [bas(roadTex('#1a0606', '#260a0a', '#ff003c', '#fcee0a', '#ff003c', '#220000')), bas(wallTex('#ff003c')), bas(wallTex('#fcee0a')),
    bas(tex(32, 32, g => { R(g, '#0c0304', 0, 0, 32, 32); R(g, '#ff5a6a', 12, 2, 8, 8); R(g, '#ffd84a', 12, 18, 8, 8); R(g, '#3a0a10', 0, 15, 32, 1); }))];
  ribbon(T.t0, cT, -W, 0, W, 0, tunMats[0]);
  ribbon(T.t0, cT, -W, 8, -W, 0, tunMats[1]); ribbon(T.t0, cT, W, 8, W, 0, tunMats[2]); ribbon(T.t0, cT, -W, 8, W, 8, tunMats[3]);
  const concrete = new THREE.MeshLambertMaterial({ color: 0x1c1c26, side: THREE.DoubleSide }), glowY = new THREE.MeshBasicMaterial({ color: 0xfcee0a }), glowC = new THREE.MeshBasicMaterial({ color: 0x00f0ff }), glowM = new THREE.MeshBasicMaterial({ color: 0xff2bd6 });
  for (const [oa, ya, ob, yb] of [[-W - 1.5, 10, -W - 1.5, -80], [W + 1.5, 10, W + 1.5, -80], [-W - 1.5, 10, W + 1.5, 10]]) ribbon(T.t0, cT, oa, ya, ob, yb, concrete).castShadow = true;
  for (const i of [T.t0, T.t1]) { // portails jaunes lumineux
    const s = S[i], g = new THREE.Group(); g.position.set(s.x, s.y, s.z); g.rotation.y = across(s); scene.add(g);
    box(2 * W + 6, 4, 3, glowY, 0, 10, 0, g);
    for (const sd of [-1, 1]) box(3, 12, 3, glowY, sd * (W + 1.5), 6, 0, g);
  }
  { // ligne et portique de départ
    const s = S[0], g = new THREE.Group(); g.position.set(s.x, s.y, s.z); g.rotation.y = across(s); scene.add(g);
    const ck = tex(16, 4, c => { R(c, '#fcee0a', 0, 0, 16, 4); for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) if ((x + y) & 1) R(c, '#08080c', x, y, 1, 1); });
    ck.minFilter = THREE.NearestFilter;
    box(2 * W, 0.06, 4, new THREE.MeshBasicMaterial({ map: ck }), 0, 0, 0, g);
    box(2 * W + 3, 1.6, 1, glowY, 0, 8, 0, g);
    for (const sd of [-1, 1]) box(1, 8, 1, glowC, sd * (W + 1), 4, 0, g);
  }
  { // chevrons à l'extérieur des virages, piles du viaduc, tubes néon en bord de route (repères de vitesse)
    const dummy = new THREE.Object3D(), geo = new THREE.PlaneGeometry(5, 2.5);
    const sg = [0, 1].map(f => new THREE.InstancedMesh(geo, bas(chevTex(f)), 300)), cnt = [0, 0];
    const piles = new THREE.InstancedMesh(new THREE.BoxGeometry(5, 1, 5), concrete, 60); let np = 0;
    const tubes = [glowM, glowC].map(m => new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, 7, 0.35), m, 200)), nt = [0, 0];
    const streaks = ['#ff2bd6', '#00f0ff'].map(c => new THREE.InstancedMesh(new THREE.PlaneGeometry(7, 1.6), addMat(gradTex(c)), 200));
    for (let i = 0; i < N; i++) {
      const s = S[i], nx = -s.tz, nz = s.tx, inT = zone(i, 0) === 1;
      dummy.scale.set(1, 1, 1); dummy.rotation.set(0, across(s), 0);
      if (i % 10 === 0 && !inT) for (const sd of [-1, 1]) {
        const c = (i / 10 & 1) ^ (sd > 0 ? 1 : 0);
        dummy.position.set(s.x + nx * sd * (W + 0.9), s.y + 3.5, s.z + nz * sd * (W + 0.9)); dummy.updateMatrix(); tubes[c].setMatrixAt(nt[c], dummy.matrix);
        dummy.rotation.order = 'YXZ'; dummy.rotation.set(-Math.PI / 2, across(s), 0); dummy.scale.set(sd > 0 ? -1 : 1, 1, 1); // à plat, côté lumineux vers le tube
        dummy.position.set(s.x + nx * sd * (W - 3.2), s.y + 0.05, s.z + nz * sd * (W - 3.2)); dummy.updateMatrix(); streaks[c].setMatrixAt(nt[c]++, dummy.matrix);
        dummy.rotation.order = 'XYZ'; dummy.rotation.set(0, across(s), 0); dummy.scale.set(1, 1, 1);
      }
      if (i % 30 === 0 && !inT) { dummy.position.set(s.x, (s.y - 61) / 2, s.z); dummy.scale.set(1, s.y + 59, 1); dummy.updateMatrix(); piles.setMatrixAt(np++, dummy.matrix); dummy.scale.set(1, 1, 1); }
      if (i % 6 === 0 && Math.abs(s.k) > 0.006) {
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
    ribbon(T.t1, cO, sd * W, 0.04, sd * (W - 4), 0.04, addMat(gradTex('#00a8b8')));
    const m = addMat(gradTex(sd < 0 ? '#c0002c' : '#b8a808')); ribbon(T.t0, cT, sd * W, 0.04, sd * (W - 5), 0.04, m); tunMats.push(m);
  }
  { // portiques au-dessus de la route, avec écran publicitaire qui défile
    for (const [i, txt] of ['ネオン // SPEED // 危険 // ', '電脳 CITY ★ 24H ★ ', '>>> NOODLE BAR >>> ホテル '].entries()) {
      const c = ['#ff2bd6', '#00f0ff', '#fcee0a'][i];
      adMats.push(new THREE.MeshBasicMaterial({ map: tex(128, 16, g => { R(g, '#08080c', 0, 0, 128, 16); R(g, c, 0, 0, 128, 1); R(g, c, 0, 15, 128, 1); g.fillStyle = c; g.font = 'bold 11px sans-serif'; g.textBaseline = 'middle'; g.fillText(txt, 2, 8, 124); }) }));
    }
    for (let i = 70, k = 0; i < N; i += 90) {
      if (zone(i, 40) > 0) continue;
      const s = S[i], gr = new THREE.Group(); gr.position.set(s.x, s.y, s.z); gr.rotation.y = across(s); scene.add(gr);
      box(2 * W + 3, 4, 0.5, adMats[k++ % 3], 0, 11.5, 0, gr);
      for (const sd of [-1, 1]) box(0.8, 13.5, 0.8, concrete, sd * (W + 1.3), 6.75, 0, gr);
    }
  }

  // ---------- ville ----------
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
  const beams = [[320, 120], [-120, 330], [520, -120], [80, 660], [-420, 60], [700, 420]].map(([x, z], i) => { const b = new THREE.Mesh(beamGeo, addMat(gradTex(['#5a7cff', '#ff2bd6', '#00f0ff'][i % 3], true), { opacity: 0.5 })); b.position.set(x, -60, z); scene.add(b); return b; });
  // hologrammes géants : les enseignes en lumière pure, qui tournent et grésillent
  const holos = [[250, 150, 210], [-160, 165, 300], [450, 140, -90], [0, 185, 640], [640, 170, 520]].map(([x, y, z], i) => { const h = new THREE.Mesh(new THREE.PlaneGeometry(90, 45), addMat(signMats[i].map, { opacity: 0.6 })); h.position.set(x, y, z); scene.add(h); return h; });
  // trafic : véhicules volants entre les tours et phares dans les rues en contrebas (un point lumineux chacun)
  const MV = 110, mvP = new Float32Array(MV * 3), mvV = new Float32Array(MV * 2), mvC = new Float32Array(MV * 3), mvGeo = new THREE.BufferGeometry();
  for (let i = 0; i < MV; i++) {
    const air = i < 45, ax = rnd() < 0.5, v = (air ? 35 + rnd() * 60 : 14 + rnd() * 22) * (rnd() < 0.5 ? -1 : 1), cell = 5000 / 70, snap = (p, o) => o + Math.round((p - o) / cell) * cell;
    let x = -700 + rnd() * 1600, z = -350 + rnd() * 1200;
    if (!air) { if (ax) z = snap(z, -2300); else x = snap(x, -2500); } // au sol : calé sur la grille des rues
    mvP.set([x, air ? 25 + rnd() * 150 : -59.5, z], i * 3); mvV.set(ax ? [v, 0] : [0, v], i * 2);
    mvC.set(air ? [[1, 1, 1], [1, 0.1, 0.2], [0.2, 0.9, 1]][i % 3] : [[1, 0.7, 0.3], [1, 1, 0.9]][i % 2], i * 3);
  }
  mvGeo.setAttribute('position', new THREE.BufferAttribute(mvP, 3)); mvGeo.setAttribute('color', new THREE.BufferAttribute(mvC, 3));
  const movers = new THREE.Points(mvGeo, new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true, fog: false })); movers.frustumCulled = false; scene.add(movers);
  const beaconGeo = new THREE.BufferGeometry(); beaconGeo.setAttribute('position', new THREE.Float32BufferAttribute(beacons, 3));
  const beaconPts = new THREE.Points(beaconGeo, new THREE.PointsMaterial({ color: 0xff2030, size: 2, sizeAttenuation: false, fog: false })); scene.add(beaconPts);

  // pluie : traînées qui s'allongent et foncent vers la caméra avec la vitesse
  const RN = 400, rainP = new Float32Array(RN * 3), rainGeo = new THREE.BufferGeometry(), rainV = new Float32Array(RN * 6);
  for (let i = 0; i < RN; i++) rainP.set([rnd() * 80 - 40, rnd() * 30, rnd() * 80 - 40], i * 3);
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainV, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0x9fc8ff, transparent: true, opacity: 0.55, fog: false }));
  rain.frustumCulled = false; scene.add(rain);

  // ---------- voiture : coque en coin, roues qui tournent et braquent, feux stop ----------
  const carG = new THREE.Group(), body = new THREE.Group(); carG.add(body); scene.add(carG);
  const carMat = new THREE.MeshLambertMaterial({ color: 0xff2030 }), dark = new THREE.MeshLambertMaterial({ color: 0x14141e }), rim = new THREE.MeshLambertMaterial({ color: 0x9a9ab0 });
  const wedge = (w, h, d, nose) => { // boîte dont l'arête avant-haut est abaissée
    const ge = new THREE.BoxGeometry(w, h, d), p = ge.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getX(i) > 0 && p.getY(i) > 0) p.setY(i, p.getY(i) - h * nose);
    ge.computeVertexNormals(); return ge;
  };
  const part = (ge, mat, x, y, z, parent = body) => { const m = new THREE.Mesh(ge, mat); m.position.set(x, y, z); parent.add(m); return m; };
  part(wedge(4.5, 0.62, 1.95, 0.62), carMat, 0, 0.62, 0); part(wedge(2.1, 0.5, 1.6, 0.75), dark, -0.5, 1.16, 0);
  box(0.4, 0.08, 2.15, carMat, -2.05, 1.5, 0, body); for (const z of [-0.85, 0.85]) box(0.1, 0.5, 0.1, dark, -2.05, 1.2, z, body);
  box(0.5, 0.25, 1.7, dark, -2.1, 0.42, 0, body); // diffuseur
  const wheelGeo = new THREE.CylinderGeometry(0.43, 0.43, 0.36, 8); wheelGeo.rotateX(Math.PI / 2);
  const wheels = [];
  for (const x of [-1.4, 1.45]) for (const z of [-0.95, 0.95]) {
    const st = new THREE.Group(); st.position.set(x, 0.43, z); carG.add(st);
    const sp = part(wheelGeo, dark, 0, 0, 0, st); box(0.72, 0.14, 0.38, rim, 0, 0, 0, sp); // jante visible pour lire la rotation
    wheels.push({ sp, st: x > 0 ? st : null });
  }
  carG.traverse(o => { o.castShadow = true; });
  const brakeMat = new THREE.MeshBasicMaterial({ color: 0x8a1020 });
  box(0.06, 0.2, 1.8, brakeMat, -2.27, 0.72, 0, body); // feux arrière, plus vifs au freinage
  for (const z of [-0.65, 0.65]) box(0.06, 0.16, 0.45, new THREE.MeshBasicMaterial({ color: 0xfff2d0 }), 2.27, 0.42, z, body); // phares
  for (const z of [-1, 1]) box(3, 0.07, 0.05, new THREE.MeshBasicMaterial({ color: 0x00f0ff }), 0, 0.34, z, body); // liserés néon de bas de caisse

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
    if (car.boost > 0) for (const sd of [-0.5, 0.5]) emit(car.x - fx * 2.4 + rx * sd, carY + 0.45, car.z - fz * 2.4 + rz * sd, car.vx * 0.7 - fx * 5 + jit(1), jit(1), car.vz * 0.7 - fz * 5 + jit(1), 0.2, 0.3, 0.8, 1, 0);
    for (let i = 0; i < PN; i++) {
      if (pL[i] <= 0) continue;
      pL[i] -= dt; const j = i * 3, f = Math.max(0, pL[i] / pM[i]);
      pV[j + 1] -= pGv[i] * dt; pP[j] += pV[j] * dt; pP[j + 1] += pV[j + 1] * dt; pP[j + 2] += pV[j + 2] * dt;
      pC[j] = pB[j] * f; pC[j + 1] = pB[j + 1] * f; pC[j + 2] = pB[j + 2] * f;
    }
    pGeo.attributes.position.needsUpdate = pGeo.attributes.color.needsUpdate = true;
    // éclairs : flash double sur le ciel, la brume et l'éclairage, puis le tonnerre
    if ((nextFlash -= dt) < 0) { nextFlash = 7 + Math.random() * 14; flashT = 0.36; if (AC && lm < 0.5) nz(AC.currentTime + 0.4, 2.4, 0.35, master, 'lowpass', 140); }
    flashT -= dt; const fl = flashT > 0 && lm < 0.5 ? ((flashT * 14 | 0) & 1 ? 1 : 0.3) : 0;
    hemi.intensity = 0.55 + 3 * fl; skyMat.color.multiplyScalar(1 + 2.5 * fl); scene.fog.color.lerp(FLASH, 0.45 * fl);
    // ville : enseignes qui clignotent, grésillent ou défilent ; écrans, hologrammes, projecteurs, trafic, balises
    signMats.forEach((m, i) => { m.color.setScalar(i % 3 === 0 ? ((now / 400 + i) & 1 ? 1 : 0.25) : i % 3 === 1 && Math.random() < 0.04 ? 0.3 : 1); if (i % 2) m.map.offset.x += dt * 0.12; });
    adMats.forEach((m, i) => { m.map.offset.x += dt * (0.2 + 0.1 * i); });
    holos.forEach((h, i) => { h.rotation.y += dt * 0.25; h.material.opacity = 0.45 + 0.2 * Math.sin(now * 0.004 + i) - (Math.random() < 0.05 ? 0.3 : 0); });
    beams.forEach((b, i) => b.rotation.set(0, Math.atan2(cam.position.x - b.position.x, cam.position.z - b.position.z), Math.sin(now * 0.0004 * (i % 3 + 1) + i) * 0.5));
    for (let i = 0; i < MV; i++) {
      let x = mvP[i * 3] + mvV[i * 2] * dt, z = mvP[i * 3 + 2] + mvV[i * 2 + 1] * dt;
      mvP[i * 3] = x < -700 ? x + 1600 : x > 900 ? x - 1600 : x; mvP[i * 3 + 2] = z < -350 ? z + 1200 : z > 850 ? z - 1200 : z;
    }
    mvGeo.attributes.position.needsUpdate = true; beaconPts.visible = (now / 700 & 1) === 1;
  }

  const ghostM = box(4.4, 0.9, 1.9, addMat(null, { color: 0x00f0ff, opacity: 0.4, polygonOffset: false }), 0, 0, 0); ghostM.visible = false; // fantôme : simple silhouette lumineuse
  // adversaires du mode course : copies de la voiture du joueur, une couleur chacune (roues fixes) ; [nom, couleur]
  const OPP = [['KENJI', '#00c8ff'], ['REI', '#ff8a00'], ['JUN', '#40ff80']];
  const opps = OPP.map(([, col]) => {
    const g = carG.clone(), m = new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 0.45 }), b = brakeMat.clone(); // un peu lumineuse : lisible de nuit et de loin
    g.traverse(o => { if (o.material === carMat) o.material = m; else if (o.material === brakeMat) o.material = b; });
    g.visible = false; g.userData.y = 0; scene.add(g); return g;
  });
  scene.traverse(o => { if (o.isInstancedMesh) o.frustumCulled = false; }); // r128 calcule le culling sur la géométrie de base, pas sur les instances

  // ---------- audio : tout est synthétisé (bande-son originale et adaptative) ----------
  let AC, ana, bsat, master, musicG, musF, padF, padG, duckG, arpIn, leadIn, acid, nbuf, t0 = 0, nextT = 0, stp = 0, musicOn = true, lastHit = 0;
  // état musical piloté par la course : mix = échangeur, inten = vitesse, driftL = glisse, drums/lead = sections, stun = choc
  let mix = 0, inten = 0, driftL = 0, drums = 0, lead = false, stun = 0, wasIn = false, wasNear = false;
  let eng, sq, scrubG, windG, gear = 0, rpm = 0.3, load = 0, spool = 0, lastGas = 0;
  const hz = m => 440 * 2 ** ((m - 69) / 12), _ = null;
  // thème : [pas, note, durée en pas] pour chacune des 8 mesures
  const LEAD = [[[0, 76, 3], [3, 76, 2], [6, 74, 2], [8, 76, 4], [12, 79, 4]], [[0, 76, 6], [8, 72, 2], [10, 74, 2], [12, 72, 4]],
    [[0, 77, 3], [3, 77, 2], [6, 76, 2], [8, 77, 4], [12, 81, 4]], [[0, 79, 6], [8, 74, 2], [10, 76, 2], [12, 74, 4]],
    [[0, 76, 3], [3, 76, 2], [6, 74, 2], [8, 76, 4], [12, 79, 4]], [[0, 76, 6], [8, 72, 2], [10, 74, 2], [12, 72, 4]],
    [[0, 77, 3], [3, 77, 2], [6, 74, 2], [8, 77, 4], [12, 82, 4]], [[0, 80, 8], [8, 83, 8]]];
  const DARK = [[57, 60, 64], [57, 60, 64], [53, 57, 60], [55, 59, 62], [57, 60, 64], [57, 60, 64], [58, 62, 65], [56, 59, 64]]; // Am Am F G | Am Am Bb E
  const JAZZ = [[62, 65, 69, 72], [59, 62, 65, 67], [60, 64, 67, 71], [57, 60, 64, 67]]; // Dm7 G7 Cmaj7 Am7
  // Radio : chaque station est un jeu de motifs pour le même séquenceur (accords, fondamentales, kick, riffs de basse en demi-tons, thème)
  const ST = [
    { name: 'NIGHT CITY FM', fq: '98.7', bpm: 126, CH: DARK, ROOT: [33, 33, 29, 31, 33, 33, 34, 28], kick: '1000100010001000', kickB: '1000100010101000', clapMin: 0,
      rifA: [0, _, 0, 0, _, _, 12, 0, _, _, 0, 3, 0, _, -2, 1], rifB: [0, _, 0, 0, _, _, 12, 0, _, 0, 7, _, 6, _, 5, 3], sat: 1, arp: 1, stab: [0, 3, 6, 11], stabAlways: 0, lead: LEAD }, // darksynth
    { name: 'PULSE 104', fq: '104.2', bpm: 122, CH: [...JAZZ, ...JAZZ], ROOT: [38, 31, 36, 33, 38, 31, 36, 33], kick: '1000100010001000', kickB: '1000100010001000', clapMin: 0.3,
      rifA: [0, _, _, 0, _, _, 12, _, 0, _, _, 12, _, 7, _, 10], rifB: [0, _, _, 0, _, _, 12, _, 0, _, 12, _, 10, _, 7, _], sat: 0, arp: 1, stab: [2, 6, 10, 14], stabAlways: 1, lead: null }, // house filtrée
    { name: 'KAIZO BREAKS', fq: '87.5', bpm: 168, CH: DARK, ROOT: [33, 33, 29, 31, 33, 33, 34, 28], kick: '1000000000100000', kickB: '1000000100100000', clapMin: 0.4,
      rifA: [0, _, _, _, _, _, _, _, _, _, 0, _, 3, _, _, _], rifB: [0, _, _, _, _, _, 7, _, _, _, 6, _, 5, _, 3, _], sat: 1, arp: 0, stab: [], stabAlways: 0, lead: LEAD }, // breakbeat
  ];
  let station = 0, S16 = 60 / ST[0].bpm / 4, dly, bclean, radioT = 0, wasBoost = false;
  function setStation(i) {
    station = (((i | 0) % ST.length) + ST.length) % ST.length; S16 = 60 / ST[station].bpm / 4; radioT = 2.5;
    try { localStorage.setItem('vpr.radio', station); } catch (e) { }
    if (!AC) return;
    const t = AC.currentTime; nz(t, 0.25, 0.25, master, 'bandpass', 2400, 0.6); // friture entre deux stations
    t0 = nextT = t + 0.3; stp = 0; dly.delayTime.value = S16 * 3;
  }
  try { setStation(+localStorage.getItem('vpr.radio') || 0); radioT = 0; } catch (e) { }
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
  function clap(t, v) { if (hitS(station === 2 ? 'sd' : 'cp', t, v * 0.9)) return; // caisse claire sur la station breakbeat, clap ailleurs
    for (let i = 0; i < 3; i++) nz(t + i * 0.012, 0.03, v * 0.6, musicG, 'bandpass', 1500, 1.2); nz(t + 0.03, 0.2, v, musicG, 'bandpass', 1500, 1.2); osc('triangle', 190, t, 0.08, v / 2, musicG); }
  function riser(t, dur) { // montée de bruit avant l'entrée de l'échangeur
    const s = AC.createBufferSource(), g = AC.createGain(), f = filt('bandpass', 400, 2, g);
    s.buffer = nbuf; s.loop = true; s.connect(f); g.connect(musicG);
    f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(7000, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.05);
    s.start(t); s.stop(t + dur + 0.1);
  }
  function crash(t) { // impact : départ, entrée et sortie de l'échangeur
    nz(t, 1.4, 0.28, musicG, 'highpass', 4500);
    const o = osc('sine', 70, t, 0.7, 0.8, musicG); o && o.frequency.exponentialRampToValueAtTime(30, t + 0.5);
  }
  const stinger = up => AC && (up ? [69, 73, 76, 81, 85] : [69, 64, 60, 57]).forEach((n, i) => osc('square', hz(n), AC.currentTime + i * 0.09, 0.5, 0.12, arpIn));
  // un pas de double-croche, joué avec les motifs de la station. Arrangement : léger sur le viaduc (riff filtré + arpège), plein dans
  // l'échangeur et sur le dernier secteur (riff ouvert, clap, charlestons, thème) ; sections A/B de 8 mesures, roulement en fin de phrase.
  function sched(s, t) {
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
    if (d && big && station === 1 && (q === 3 || q === 11)) hitS('cb', t, 0.1); // cloche de 808 sur la station house
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
    if (d && big && st.lead) for (const [p, n, len] of st.lead[b]) if (q === p) { for (const dt of [-10, 10]) osc('sawtooth', hz(n), t, S16 * len * 1.2, 0.055, leadIn, dt); if (lead) osc('triangle', hz(n + 12), t, S16 * len, 0.04, leadIn); }
    if (driftL > 0.3) osc('sawtooth', hz(ch[(q * 2) % 3] + 24), t, 0.1, 0.07 * driftL, acid); // ligne acide tant qu'on glisse
  }
  function initAudio() {
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
    t0 = nextT = AC.currentTime + 0.1;
    setInterval(() => {
      while (nextT < AC.currentTime - 0.2) { nextT += S16; stp++; } // onglet en veille : on saute au lieu de rattraper
      while (nextT < AC.currentTime + 0.12) { sched(stp++, nextT); nextT += S16; }
    }, 30);
  }
  const beep = f => AC && osc('square', f, AC.currentTime, 0.25, 0.2, master);
  // boîte et régime : calculés même sans audio, la jauge du HUD s'en sert
  function drivetrain(dt, r, gas) { // rapport et régime viennent de la physique (sim.js) ; ici on les lisse pour le son et la jauge
    const up = car.gear > gear; gear = car.gear;
    let tgt = car.rpm / CARD.red;
    if (state === 'count' && gas) tgt = 0.8 + 0.05 * Math.sin(performance.now() / 22); // rupteur sur la grille
    rpm += (tgt - rpm) * Math.min(1, dt * 14); load += ((car.shiftT > 0 ? 0 : gas) - load) * Math.min(1, dt * 12); spool += ((gas ? rpm : 0) - spool) * Math.min(1, dt * 2.5);
    return up;
  }
  function audioFrame(dt, r, sp, gas, hit, up) {
    if (state === 'pause') { for (const p of [eng.out.gain, sq.g.gain, scrubG.gain, windG.gain]) p.setTargetAtTime(0, AC.currentTime, 0.05); return; } // en pause : la radio continue, la voiture se tait
    const t = AC.currentTime, racing = state === 'race', k = (p, v, tc = 0.04) => p.setTargetAtTime(v, t, tc);
    // moteur (discret sous la musique) : coupure au passage de rapport, timbre selon la charge, turbo, pétarades au lever de pied
    if (up) osc('triangle', 80, t, 0.06, 0.07, master); // clac de boîte ; la coupure de poussée vient de la physique
    const f = rpm * CARD.red / 40; // la moitié de la fréquence d'allumage d'un 6 cylindres (3 explosions par tour) : même montée en régime, une octave plus grave
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
    const a0 = (car.idx - T.t0 + N) % N, inside = a0 < T.t1 - T.t0, near = racing && !inside && N - a0 < 60;
    if (near && !wasNear) riser(t, clamp((N - a0) * 2 / Math.max(sp, 20), 0.5, 3));
    if (inside !== wasIn && racing) crash(t);
    if (inside && !wasIn && racing) for (let i = 0; i < 6; i++) osc('square', i % 2 ? 660 : 880, t + 0.25 + i * 0.18, 0.16, 0.07, arpIn); // sirène d'alarme à l'entrée
    wasNear = near; wasIn = inside;
    drums = racing ? 1 : 0; lead = racing && !inside && car.idx >= T.t1 && car.dist > 0;
    mix += ((racing ? zone(car.idx, 50) : 0) - mix) * Math.min(1, dt * 3);
    inten += (r - inten) * Math.min(1, dt * 2); driftL += ((car.drift ? 1 : 0) - driftL) * Math.min(1, dt * 6);
    k(musF.frequency, stun > 0 ? 350 : 900 * 20 ** Math.min(1, inten * 1.4 + mix), 0.08); // la musique s'ouvre avec la vitesse ; un gros choc l'étouffe
    k(padG.gain, lerp(1, 0.6, mix), 0.1); k(padF.frequency, lerp(800, 2000, mix), 0.1);
  }

  // ---------- état de jeu ----------
  // clés « vpr5. » : la physique a été rééquilibrée, les anciens records ne sont plus comparables
  const store = { get: k => { try { return JSON.parse(localStorage.getItem('vpr5.' + k)); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem('vpr5.' + k, JSON.stringify(v)); } catch (e) { } } };
  const fmt = t => `${t / 60 | 0}'${String(t % 60 | 0).padStart(2, '0')}"${String(t * 100 % 100 | 0).padStart(2, '0')}`;
  let car = newCar(T), state = 'title', tRace = 0, best = store.get('best') || 0, count = 0, shown = 0, goT = 0, acc = 0, last = 0, cth = car.th, lm = 0, carY = S[car.idx].y, pitch = 0, result = null, manual = false;
  // secteurs (entrée et sortie de l'échangeur) et fantôme du record : [x, y, z, cap] à 20 Hz
  // mode : 'solo' (contre-la-montre à tours enchaînés) ou 'course' (3 tours contre les IA de sim.js) ; race = la course en cours, sinon null
  let mode = store.get('mode') === 'course' ? 'course' : 'solo', race = null, raceEnd = false;
  let si = 0, cur = [], bestSpl = store.get('splits'), ghost = store.get('ghost'), recG = [], splitMsg = null, lapN = 1, prev = 'race', psel = 0, ghostOn = !!store.get('ghostOn');
  const keys = {}, H = 1 / 120;

  function start() {
    if (!AC) initAudio(); AC.resume();
    race = mode === 'course' ? newRace(T) : null; raceEnd = false;
    car = race ? race.cars[0] : newCar(T); car.manual = manual; gear = 0; hist.length = 0; si = 0; cur = []; recG = []; splitMsg = null; cth = car.th; carY = S[car.idx].y; state = 'count'; count = 1.8; shown = 0; tRace = 0; acc = 0; lapN = 1; result = null;
  }
  function finish() { // tour bouclé : on l'enregistre, on affiche son temps 4 s, et le chrono repart aussitôt pour un tour lancé
    const rec = !best || tRace < best; result = { rec, diff: best ? tRace - best : 0, t: tRace, n: lapN, T: 4 };
    if (rec) { best = tRace; bestSpl = cur; ghost = recG; store.set('best', best); store.set('splits', cur); store.set('ghost', ghost); }
    stinger(rec);
    lapN++; car.dist -= N; tRace = 0; si = 0; cur = []; recG = [];
  }
  const pauseItems = () => ['REPRENDRE', 'RECOMMENCER', 'BOITE : ' + (manual ? 'MANUELLE' : 'AUTO'), 'RADIO : ' + ST[station].name, 'MUSIQUE : ' + (musicOn ? 'OUI' : 'NON'), 'FANTOME : ' + (ghostOn ? 'OUI' : 'NON'), 'QUITTER'];
  const toggleMusic = () => { musicOn = !musicOn; if (AC) musicG.gain.value = musicOn ? 1 : 0; };
  function pauseAct() {
    if (psel === 0) state = prev;
    else if (psel === 1) start();
    else if (psel === 2) { manual = !manual; car.manual = manual; }
    else if (psel === 3) setStation(station + 1);
    else if (psel === 4) toggleMusic();
    else if (psel === 5) { ghostOn = !ghostOn; store.set('ghostOn', ghostOn); }
    else { state = 'title'; race = null; car = newCar(T); cth = car.th; carY = S[car.idx].y; tRace = 0; lapN = 1; result = null; hist.length = 0; }
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
    if (state === 'title' && /^(Arrow(Left|Right)|Key[AD])$/.test(e.code)) { mode = mode === 'solo' ? 'course' : 'solo'; store.set('mode', mode); }
    if ((e.code === 'Enter' && (state === 'title' || raceEnd)) || key === 'r') start();
    if (key === 'g') { manual = !manual; car.manual = manual; car.gear = gear; }
    if (manual && (e.code === 'KeyE' || e.code === 'KeyQ')) car.gear = clamp(car.gear + (e.code === 'KeyE' ? 1 : -1), 0, 5); // physiquement A / E autour du Z en AZERTY
    if (key === 'c') setStation(station + 1);
    if (key === 'm') toggleMusic();
  });
  addEventListener('keyup', e => { keys[e.code] = 0; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = 0; }); // sinon une touche reste enfoncée après Alt-Tab
  document.addEventListener('visibilitychange', () => { if (AC) document.hidden ? AC.suspend() : AC.resume(); }); // pas de musique hachée ni de moteur figé en arrière-plan
  // e.code = position physique : KeyW/KeyA sont Z/Q sur un clavier AZERTY
  const input = () => ({
    steer: (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0),
    gas: keys.ArrowUp || keys.KeyW ? 1 : 0, brake: keys.ArrowDown || keys.KeyS ? 1 : 0, hand: !!keys.Space,
  });

  // ---------- HUD pixel (canvas 2D à la résolution du jeu) ----------
  const PS = '"Press Start 2P", monospace', JP = 'DotGothic16, sans-serif', Y = '#fcee0a', C = '#00f0ff', RD = '#ff003c';
  document.fonts.load('8px ' + PS); document.fonts.load('16px ' + JP, 'スピード');
  // texte pixel ; split = décalage rouge/cyan façon glitch
  function txt(s, x, y, size, col, align = 'left', split = 0, font = PS) {
    hg.font = size + 'px ' + font; hg.textAlign = align; hg.textBaseline = 'top'; x = Math.round(x);
    if (split) { hg.fillStyle = RD; hg.fillText(s, x - split, y); hg.fillStyle = C; hg.fillText(s, x + split, y); }
    hg.fillStyle = col; hg.fillText(s, x, y);
  }
  const panel = (x, y, w, h) => { R(hg, 'rgba(8,8,12,.82)', x, y, w, h); R(hg, Y, x, y, 2, h); R(hg, Y, x, y, w, 1); R(hg, C, x + w - 8, y + h - 1, 8, 1); };
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
    // chrono
    panel(6, 6, 132, 50); txt(race ? 'TOUR ' + car.lap + '/' + race.laps : 'TOUR ' + lapN, 12, 11, 8, C); txt('ラップ', 132, 6, 16, C, 'right', 0, JP);
    txt(fmt(tRace), 12, 24, 16, Y, 'left', 1); txt(race ? 'PLACE ' + car.pos + '/' + race.cars.length : best ? 'REC ' + fmt(best) : 'REC --', 12, 44, 8, RD);
    if (race && !raceEnd) txt(car.pos + '/' + race.cars.length, cx, 8, 16, Y, 'center', 1);
    // vitesse
    panel(HW - 126, HH - 64, 120, 58); txt('KM/H', HW - 120, HH - 59, 8, C); txt('スピード', HW - 12, HH - 64, 16, C, 'right', 0, JP);
    txt(String(sp * 3.6 | 0), HW - 10, HH - 42, 32, Y, 'right', 1);
    // jauge de puissance façon égaliseur : les colonnes s'allument avec le régime, dansent avec le son, crêtes qui retombent
    panel(6, HH - 78, 138, 72); txt(String(Math.round(rpm * CARD.red / 100) * 100), 12, HH - 73, 8, C); if (manual && rpm > 0.92 && blink) txt('SHIFT', 54, HH - 73, 8, RD); else txt(manual ? 'MANU' : 'AUTO', 54, HH - 73, 8, manual ? Y : C); // régime en tr/min txt('G' + (gear + 1), 136, HH - 73, 16, Y, 'right', 1);
    if (ana) ana.getByteFrequencyData(fft);
    for (let i = 0; i < EQN; i++) {
      const fr = (i + 0.5) / EQN, on = fr <= rpm, a = ana ? fft[1 + i] / 255 : 0.5;
      const L = clamp(on ? (0.3 + 0.7 * fr) * (0.65 + 0.35 * a) + 0.1 * load : 0.22 * a, 0, 1), rows = Math.round(L * EQR);
      peak[i] = Math.max(peak[i] - dt * 0.9, L);
      for (let j = 0; j < EQR; j++) R(hg, j >= rows ? '#1c1c2c' : !on ? '#2a4a5a' : j > 7 || fr > 0.88 ? RD : j > 4 ? Y : C, 12 + i * 6, HH - 14 - j * 4, 5, 3);
      R(hg, '#ffffff', 12 + i * 6, HH - 14 - Math.min(EQR - 1, Math.round(peak[i] * EQR)) * 4, 5, 1);
    }
    radioT -= dt; panel(HW - 126, 6, 120, 30); txt('RADIO ' + ST[station].fq, HW - 120, 11, 8, radioT > 0 && blink ? '#ffffff' : C); txt(ST[station].name, HW - 120, 23, 8, Y);
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
    if (state === 'title') {
      R(hg, 'rgba(8,8,12,.8)', 0, 0, HW, HH);
      txt('夜間タイムアタック', cx, 30, 16, C, 'center', 0, JP); txt('CONTRE-LA-MONTRE NOCTURNE', cx, 52, 8, C, 'center');
      txt('VILLE À', cx, 76, 24, Y, 'center', 2); txt('PLEIN REGIME', cx, 106, 24, Y, 'center', 2);
      txt(mode === 'solo' ? '< MODE : CONTRE-LA-MONTRE >' : '< MODE : COURSE, 3 TOURS CONTRE 3 IA >', cx, 136, 8, C, 'center');
      if (blink) tag('> ENTREE : DEMARRER <', cx, 150, Y);
      ['FLECHES OU ZQSD : PILOTER', 'ESPACE : FREIN A MAIN / GLISSE', 'G : BOITE MANUELLE (A / E : RAPPORTS)', 'C : RADIO   M : SON   ECHAP : PAUSE', 'GAUCHE / DROITE : CHANGER DE MODE'].forEach((s, i) => txt(s, cx, 172 + i * 13, 8, '#e8e8e4', 'center'));
    } else if (state === 'count' && shown) txt(String(shown), cx, 90, 64, Y, 'center', 3);
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

  function frame(now) {
    const dt = state === 'pause' ? 0 : clamp((now - last) / 1000 || 0, 0, 0.1); last = Math.max(last, now); // en pause le temps s'arrête, l'image reste
    if (state === 'count') {
      count -= dt; const k = Math.ceil(count / 0.6);
      if (count <= 0) { state = 'race'; goT = 0.8; beep(880); AC && crash(AC.currentTime); }
      else if (k !== shown) { shown = k; beep(440); }
    }
    if (goT > 0) goT -= dt;
    const keyIn = input();
    const inp = state === 'race' ? (AUTO || raceEnd ? autopilot(car, T) : keyIn) : { steer: 0, gas: 0, brake: 0, hand: false };
    let hit = 0;
    for (acc += dt; acc >= H; acc -= H) {
      // en course, sim.js fait avancer tout le monde ; inp = null : l'IA conduit la voiture du joueur (?auto, ou une fois arrivé)
      if (race && state === 'race') stepRace(race, AUTO || raceEnd ? null : inp, H); else step(car, inp, T, H);
      hit = Math.max(hit, car.hit, car.bump || 0); // shortcut: un choc entre voitures réutilise les effets du choc mur (étincelles côté mur), à séparer si ça se voit
      if (state === 'race' && !raceEnd) {
        tRace += H;
        if (race) { if (car.fin) { raceEnd = true; tRace = car.fin; car.manual = false; stinger(car.pos === 1); } }
        else if (car.dist >= N) finish();
      }
    }
    const sp = Math.hypot(car.vx, car.vz), r = Math.min(1, sp / TOP), gas = state === 'count' ? keyIn.gas : inp.gas;
    const beat = AC ? Math.max(0, (AC.currentTime - t0) / (4 * S16)) : 0, pulse = AC ? Math.exp(-(beat % 1) * 5) : 0; // battement calé sur le kick
    if (hit > 8) stun = 0.7; stun -= dt;
    const up = drivetrain(dt, r, gas);

    // voiture (suit le relief) + caméra derrière : plus basse, plus proche et plus grand-angle avec la vitesse
    const sc = S[car.idx], fx = Math.cos(car.th), fz = Math.sin(car.th);
    carY += (sc.y - carY) * Math.min(1, dt * 18); pitch += (Math.atan(sc.sl) - pitch) * Math.min(1, dt * 10);
    carG.position.set(car.x, carY, car.z); carG.rotation.set(0, -car.th, pitch); body.rotation.x = car.steer * r * 0.07;
    opps.forEach((g, i) => {
      const c = race && race.cars[i + 1]; g.visible = !!c; if (!c) return;
      const so = S[c.idx]; g.userData.y += (so.y - g.userData.y) * Math.min(1, dt * 18);
      g.position.set(c.x, g.userData.y, c.z); g.rotation.set(0, -c.th, Math.atan(so.sl));
    });
    cth += wrap(car.th - cth) * Math.min(1, dt * 6);
    const cx = Math.cos(cth), cz = Math.sin(cth), back = 8.2 - 1.4 * r;
    let px = car.x - cx * back, pz = car.z - cz * back;
    const s = S[(car.idx - 4 + N) % N], nx = -s.tz, nz = s.tx, d = (px - s.x) * nx + (pz - s.z) * nz, o = Math.abs(d) - (W - 0.8);
    if (o > 0) { px -= nx * Math.sign(d) * o; pz -= nz * Math.sign(d) * o; } // la caméra reste entre les murs
    const shake = 0.04 * r * r + (stun > 0 ? stun * 0.5 : 0);
    cam.position.set(px + (Math.random() - 0.5) * shake, s.y + 3.3 - 0.6 * r + (Math.random() - 0.5) * shake, pz);
    cam.lookAt(car.x + cx * 10, S[(car.idx + 5) % N].y + 1.4, car.z + cz * 10);
    cam.fov = 62 + 26 * r + 3 * car.slide + (car.boost > 0 ? 6 : 0); cam.updateProjectionMatrix();
    sky.position.copy(cam.position); sunDisc.position.copy(cam.position).addScaledVector(SD, 2000); sunFollow();

    // lumière : nuit néon ↔ échangeur en alarme rouge qui bat avec la musique
    lm += (zone(car.idx, 10) - lm) * Math.min(1, dt * 8);
    scene.fog.color.copy(FOG_OUT).lerp(FOG_IN, lm); scene.fog.near = lerp(60, 15, lm); scene.fog.far = lerp(800, 320, lm);
    skyMat.color.copy(WHITE).lerp(FOG_IN, lm);
    neon.position.set(car.x, carY + 1.2, car.z); neon.distance = lerp(14, 40, lm); neon.intensity = lerp(0, 0.9 + 1.2 * pulse, lm); // éteint dehors : sur la route mouillée il faisait une tache blanche fixe sous la voiture
    neon.color.setHex(lm > 0.5 ? ((beat | 0) & 1 ? 0xfcee0a : 0xff003c) : 0x00f0ff);
    carMat.emissive.setRGB(0.3 * lm, 0.01 * lm, 0.03 * lm);
    for (const m of tunMats) m.color.setScalar(0.75 + 0.5 * pulse);
    head.position.set(car.x + fx * 1.5, carY + 1.1, car.z + fz * 1.5); head.target.position.set(car.x + fx * 40, S[(car.idx + 20) % N].y, car.z + fz * 40);
    // pluie : chaque goutte recule de la vitesse de la voiture, sa traînée s'étire d'autant
    rain.visible = lm < 0.5; rain.position.set(car.x, carY, car.z);
    for (let i = 0; i < RN; i++) {
      let x = rainP[i * 3] - car.vx * dt, y = rainP[i * 3 + 1] - 55 * dt, z = rainP[i * 3 + 2] - car.vz * dt;
      x = ((x + 40) % 80 + 80) % 80 - 40; z = ((z + 40) % 80 + 80) % 80 - 40; if (y < 0) y += 30;
      rainP[i * 3] = x; rainP[i * 3 + 1] = y; rainP[i * 3 + 2] = z;
      rainV.set([x, y, z, x + car.vx * 0.035, y + 1.9, z + car.vz * 0.035], i * 6);
    }
    rainGeo.attributes.position.needsUpdate = true;

    if (state === 'race' && !race) {
      while (recG.length / 4 <= tRace * 20) recG.push(+car.x.toFixed(2), +carY.toFixed(2), +car.z.toFixed(2), +car.th.toFixed(3));
      if (si < 2 && car.dist >= [T.t0, T.t1][si]) { cur[si] = tRace; splitMsg = { i: si, t: tRace, d: bestSpl ? tRace - bestSpl[si] : null, T: 2.5 }; si++; }
    }
    const gi = tRace * 20, g0 = Math.floor(gi) * 4, gf = gi % 1;
    ghostM.visible = ghostOn && state === 'race' && !race && !!ghost && g0 + 7 < ghost.length;
    if (ghostM.visible) { ghostM.position.set(lerp(ghost[g0], ghost[g0 + 4], gf), lerp(ghost[g0 + 1], ghost[g0 + 5], gf) + 0.6, lerp(ghost[g0 + 2], ghost[g0 + 6], gf)); ghostM.rotation.y = -(ghost[g0 + 3] + wrap(ghost[g0 + 7] - ghost[g0 + 3]) * gf); }
    fxFrame(dt, now, sp, inp, hit, fx, fz);
    if (AC) audioFrame(dt, r, sp, gas, hit, up);

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
  window.__g = { frame, start, keys, get car() { return car; }, get state() { return state; }, get race() { return race; }, get t() { return tRace; }, get ac() { return AC; }, get out() { return master; }, get smp() { return Object.keys(smp); } }; // prise de test
})();
