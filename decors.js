// Décors des cartes autres que la ville (qui reste dans game.js). Chaque décor est une fonction DECORS[id](h) appelée une fois au chargement.
// h = outils de game.js : THREE, scene, T/S/N/W (piste), tex, R, box, ribbon, rnd, across, zone, temps (horloge du trafic)...
// Elle construit le décor autour du tracé et peut renvoyer une fonction tick(dt, now) pour ce qui bouge. Tout est en boîtes et textures procédurales.
(function () {
  // Pose une liste d'objets identiques en une seule passe de dessin. Élément : [x, y, z, rotationY, échelleX, échelleY, échelleZ].
  function inst(h, geo, mat, list) {
    const m = new h.THREE.InstancedMesh(geo, mat, Math.max(1, list.length)), d = new h.THREE.Object3D();
    list.forEach((p, i) => { d.position.set(p[0], p[1], p[2]); d.rotation.set(0, p[3] || 0, 0); d.scale.set(p[4] || 1, p[5] || p[4] || 1, p[6] || p[4] || 1); d.updateMatrix(); m.setMatrixAt(i, d.matrix); });
    m.count = list.length; m.frustumCulled = false; h.scene.add(m); return m;
  }
  const near = (h, x, z) => { let b = 0, bd = 1e18; h.S.forEach((s, i) => { const d = (s.x - x) ** 2 + (s.z - z) ** 2; if (d < bd) { bd = d; b = i; } }); return b; };
  const lambert = (h, color, o) => new h.THREE.MeshLambertMaterial(Object.assign({ color, flatShading: true }, o));
  const basic = (h, color, o) => new h.THREE.MeshBasicMaterial(Object.assign({ color }, o));
  const bruit = (h, fond, grains) => h.tex(64, 64, g => { h.R(g, fond, 0, 0, 64, 64); for (const c of grains) for (let i = 0; i < 160; i++) h.R(g, c, h.rnd() * 64 | 0, h.rnd() * 64 | 0, 1 + (h.rnd() * 2 | 0), 1); });

  // Terrain : un champ de hauteur qui passe par la route. Chaque sommet prend l'altitude des portions de route voisines (moyenne pondérée par
  // la distance) : la route se retrouve posée sur une pente, les lacets empilés deviennent des terrasses, un canal se creuse entre deux voies.
  // o = { pas, marge, mat, loin, chute (au-delà de `loin` mètres de la route, le sol descend de `chute` m par mètre), creux(x, z) }
  // Renvoie hAt(x, z) = altitude du sol et dAt(x, z) = distance à la route, pour y poser le décor.
  function terrain(h, o) {
    const { THREE, S, N, W } = h, pas = o.pas;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const s of S) { x0 = Math.min(x0, s.x); x1 = Math.max(x1, s.x); z0 = Math.min(z0, s.z); z1 = Math.max(z1, s.z); }
    x0 -= o.marge; z0 -= o.marge; x1 += o.marge; z1 += o.marge;
    const nx = Math.ceil((x1 - x0) / pas) + 1, nz = Math.ceil((z1 - z0) / pas) + 1, Y = new Float32Array(nx * nz), D = new Float32Array(nx * nz), sub = S.filter((s, i) => i % 3 === 0);
    const pos = new Float32Array(nx * nz * 3), uv = new Float32Array(nx * nz * 2), idx = [];
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
      const x = x0 + ix * pas, z = z0 + iz * pas, k = iz * nx + ix; let sw = 0, sy = 0, dm = 1e18;
      for (const s of sub) { const d2 = (s.x - x) ** 2 + (s.z - z) ** 2, w = 1 / ((d2 + 100) * (d2 + 100)); sw += w; sy += w * s.y; if (d2 < dm) dm = d2; }
      const d = Math.sqrt(dm); let y = sy / sw - 0.5;
      if (d < W + 1) y -= 1.5; // sous la chaussée : on creuse, la route et ses murets cachent le raccord
      if (o.loin && d > o.loin) y -= (d - o.loin) * o.chute;
      if (o.creux) y -= o.creux(x, z);
      Y[k] = y; D[k] = d; pos.set([x, y, z], k * 3); uv.set([x / 10, z / 10], k * 2);
      if (ix < nx - 1 && iz < nz - 1) idx.push(k, k + nx, k + 1, k + 1, k + nx, k + nx + 1);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, o.mat); mesh.receiveShadow = true; h.scene.add(mesh);
    const lire = A => (x, z) => { // interpolation bilinéaire dans la grille
      const fx = Math.max(0, Math.min(nx - 1.001, (x - x0) / pas)), fz = Math.max(0, Math.min(nz - 1.001, (z - z0) / pas)), ix = fx | 0, iz = fz | 0, a = fx - ix, b = fz - iz, k = iz * nx + ix;
      return (A[k] * (1 - a) + A[k + 1] * a) * (1 - b) + (A[k + nx] * (1 - a) + A[k + nx + 1] * a) * b;
    };
    return { hAt: lire(Y), dAt: lire(D), box: [x0, z0, x1, z1] };
  }
  // un point au bord de la route : échantillon i, côté sd (-1 gauche, 1 droite), à `off` mètres de l'axe
  const bord = (s, sd, off) => [s.x - s.tz * sd * off, s.z + s.tx * sd * off];

  window.DECORS = {
    // ---------- Karasu-tōge : forêt de cèdres, glissières à catadioptres, distributeur allumé au sommet, ville au fond de la vallée ----------
    touge(h) {
      const { THREE, S, N, W, rnd } = h;
      const sol = bruit(h, '#0c1a14', ['#12261e', '#081410', '#16302a']);
      const g = terrain(h, { pas: 14, marge: 320, loin: 150, chute: 0.45, mat: new THREE.MeshLambertMaterial({ map: sol }) });
      // cèdres : une rangée serrée le long de la route (le tunnel d'arbres), puis la forêt
      const arbres = [];
      for (let i = 0; i < N; i += 3) for (const sd of [-1, 1]) {
        const [x, z] = bord(S[i], sd, W + 4.5 + rnd() * 7);
        if (g.dAt(x, z) > W + 3.5) arbres.push([x, g.hAt(x, z) + 6, z, rnd() * 6, 0.8 + rnd() * 0.7]);
      }
      for (let k = 0; k < 2600; k++) {
        const x = g.box[0] + rnd() * (g.box[2] - g.box[0]), z = g.box[1] + rnd() * (g.box[3] - g.box[1]), d = g.dAt(x, z);
        if (d > W + 6 && d < 230) arbres.push([x, g.hAt(x, z) + 6, z, rnd() * 6, 0.9 + rnd() * 0.9]);
      }
      inst(h, new THREE.ConeGeometry(3.6, 15, 5), lambert(h, 0x12281f), arbres);
      // catadioptres orange sur les glissières : le seul balisage, comme sur une vraie route de col
      const cata = [];
      for (let i = 0; i < N; i += 6) for (const sd of [-1, 1]) { const [x, z] = bord(S[i], sd, W + 0.15); cata.push([x, S[i].y + 0.85, z]); }
      inst(h, new THREE.BoxGeometry(0.18, 0.3, 0.18), basic(h, 0xff8c1a), cata);
      // distributeur de boissons au sommet : la seule lumière artificielle de la montagne
      const top = S.reduce((a, s, i) => s.y > S[a].y ? i : a, 0), s = S[top], [vx, vz] = bord(s, -1, W + 2.6);
      const face = h.tex(16, 32, c => { h.R(c, '#e8f8ff', 0, 0, 16, 32); for (let y = 3; y < 20; y += 5) for (let x = 2; x < 14; x += 3) h.R(c, ['#ff2a3a', '#ff8c1a', '#2a7aff', '#1f8f5a'][(x + y) % 4], x, y, 2, 3); h.R(c, '#101418', 2, 24, 12, 5); });
      const dist = h.box(1.3, 2.3, 1, basic(h, 0xffffff, { map: face }), vx, g.hAt(vx, vz) + 1.6, vz); dist.rotation.y = h.across(s);
      const lum = new THREE.PointLight(0x9ff0ff, 1.6, 34); lum.position.set(vx, s.y + 3, vz); h.scene.add(lum);
      // la ville, tout en bas : un semis de points chauds hors brouillard
      const P = [];
      for (let i = 0; i < 900; i++) { const a = rnd() * 6.283, r = 500 + rnd() * rnd() * 1500; P.push(-500 + Math.cos(a) * r * 1.3, -190 - rnd() * 30, 200 + Math.sin(a) * r); }
      const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      const pts = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xffc070, size: 1.5, sizeAttenuation: false, fog: false })); pts.frustumCulled = false; h.scene.add(pts);
      return null;
    },

    // ---------- Wan-9 : viaduc sur la baie, lampadaires au sodium, panneaux verts, pont à haubans, port, grande roue, camions ----------
    wangan(h) {
      const { THREE, S, N, W, rnd, T } = h;
      h.box(14000, 1, 14000, basic(h, 0xffffff, { map: (t => { t.repeat.set(400, 400); return t; })(bruit(h, '#071824', ['#0f3b4a', '#0a2836', '#3a2c18'])) }), 1200, -3.5, 300);
      // lampadaires : un tous les 40 m, des deux côtés ; leur défilement régulier donne la vitesse sans aucun flou
      const mats = [], tetes = [], flaques = [];
      for (let i = 0; i < N; i += 20) {
        if (h.zone(i, 0) === 1) continue;
        const s = S[i], ry = h.across(s);
        for (const sd of [-1, 1]) { const [x, z] = bord(s, sd, W + 0.8), [tx, tz] = bord(s, sd, W - 0.7); mats.push([x, s.y + 5, z, ry]); tetes.push([tx, s.y + 10, tz, ry]); }
        flaques.push([s.x, s.y + 0.06, s.z, ry]);
      }
      inst(h, new THREE.BoxGeometry(0.3, 10, 0.3), lambert(h, 0x4a4e56), mats);
      inst(h, new THREE.BoxGeometry(3.2, 0.25, 0.7), basic(h, 0xffb85a), tetes);
      const halo = h.tex(16, 16, g => { for (let r = 8; r > 0; r -= 2) { g.fillStyle = `rgb(${200 - r * 22},${110 - r * 12},${40 - r * 4})`; g.fillRect(8 - r, 8 - r, 2 * r, 2 * r); } });
      const fg = new THREE.PlaneGeometry(2 * W - 1, 16); fg.rotateX(-Math.PI / 2); inst(h, fg, h.addMat(halo, { opacity: 0.55 }), flaques);
      // panneaux d'autoroute verts, suspendus
      const pan = ['湾岸線 ↑', '港湾 PORT', '出口 EXIT →', '都心 CENTER', '空港 AIRPORT'].map(t => basic(h, 0xffffff, { map: h.tex(64, 24, g => { h.R(g, '#0e5a38', 0, 0, 64, 24); g.strokeStyle = '#f4f1e0'; g.strokeRect(1.5, 1.5, 61, 21); g.fillStyle = '#f4f1e0'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 32, 13, 56); }) }));
      const gris = lambert(h, 0x5a5e66);
      for (let i = 150, k = 0; i < N; i += 280) {
        if (h.zone(i, 30) > 0) continue;
        const s = S[i], gr = new THREE.Group(); gr.position.set(s.x, s.y, s.z); gr.rotation.y = h.across(s); h.scene.add(gr);
        h.box(2 * W + 3, 0.5, 0.5, gris, 0, 10.2, 0, gr); for (const sd of [-1, 1]) { h.box(0.6, 10.5, 0.6, gris, sd * (W + 1.2), 5.2, 0, gr); h.box(6.4, 2.6, 0.3, pan[k++ % pan.length], sd * 3.6, 8.4, 0, gr); }
      }
      // pont à haubans sur la ligne de baie : deux pylônes en H, câbles tirés jusqu'au tablier
      const blanc = lambert(h, 0xc9ced6), fils = [], balises = [];
      for (const [px, pz] of [[1650, -15], [2150, 40]]) {
        const i0 = near(h, px, pz), s = S[i0], gr = new THREE.Group(); gr.position.set(s.x, s.y, s.z); gr.rotation.y = h.across(s); h.scene.add(gr);
        for (const sd of [-1, 1]) {
          h.box(3, 84, 3, blanc, sd * (W + 3.5), 8, 0, gr); const [ax, az] = bord(s, sd, W + 3.5); balises.push(ax, s.y + 51, az);
          for (let j = 8; j <= 64; j += 8) for (const dir of [-1, 1]) { const q = S[(i0 + dir * j + N) % N], [bx, bz] = bord(q, sd, W + 1); fils.push(ax, s.y + 48 - j * 0.2, az, bx, q.y + 1.4, bz); }
        }
        h.box(2 * W + 10, 3, 3, blanc, 0, 46, 0, gr);
      }
      const fgm = new THREE.BufferGeometry(); fgm.setAttribute('position', new THREE.Float32BufferAttribute(fils, 3)); h.scene.add(new THREE.LineSegments(fgm, new THREE.LineBasicMaterial({ color: 0xc9ced6 })));
      // port : quai, conteneurs empilés, grues ; puis la ville au loin
      h.box(2200, 2, 340, lambert(h, 0x1a1c22), 1400, -3, 960);
      const cols = [0xb8442c, 0x2c6ab8, 0xc9a02c, 0x3a8a5a], piles = cols.map(() => []);
      for (let gx = 420; gx < 2400; gx += 34) for (let gz = 830; gz < 1090; gz += 9) { if (rnd() < 0.45) continue; for (let k = (rnd() * 4 | 0); k >= 0; k--) piles[rnd() * 4 | 0].push([gx + rnd() * 2, -0.7 + k * 2.6, gz, 0]); }
      piles.forEach((l, i) => inst(h, new THREE.BoxGeometry(12, 2.6, 2.5), lambert(h, cols[i]), l));
      const rouge = lambert(h, 0xc8442c);
      for (const cx of [700, 1200, 1700, 2200]) {
        for (const sx of [-12, 12]) for (const sz of [0, 26]) h.box(2, 46, 2, rouge, cx + sx, 21, 800 + sz);
        h.box(4, 4, 96, rouge, cx, 45, 790); h.box(8, 6, 8, blanc, cx, 50, 812); balises.push(cx, 49, 743);
      }
      const loin = basic(h, 0xffffff, { fog: false, map: h.tex(32, 64, g => { h.R(g, '#0a1020', 0, 0, 32, 64); for (let i = 0; i < 90; i++) h.R(g, ['#ffb85a', '#f4f1e0', '#ffd27a'][i % 3], rnd() * 32 | 0, rnd() * 64 | 0, 1, 1); }) });
      for (let i = 0; i < 70; i++) { const a = -0.5 - rnd() * 2.6, r = 1900 + rnd() * 900, hh = 90 + rnd() * rnd() * 420, w = 60 + rnd() * 110; h.box(w, hh, w, loin, 1200 + Math.cos(a) * r * 1.4, hh / 2 - 3, 300 + Math.sin(a) * r); }
      const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(balises, 3));
      const bp = new THREE.Points(bg, new THREE.PointsMaterial({ color: 0xff2030, size: 2, sizeAttenuation: false, fog: false })); bp.frustumCulled = false; h.scene.add(bp);
      // grande roue : un anneau de points de couleur, qui tourne lentement
      const rp = [], rc = [];
      for (let i = 0; i < 48; i++) { const a = i / 48 * 6.283; rp.push(Math.cos(a) * 70, Math.sin(a) * 70, 0); rc.push(...[[1, 0.3, 0.6], [0.3, 0.9, 1], [1, 0.9, 0.3]][i % 3]); if (i % 6 === 0) for (let r = 10; r < 70; r += 12) { rp.push(Math.cos(a) * r, Math.sin(a) * r, 0); rc.push(1, 1, 1); } }
      const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3)); rg.setAttribute('color', new THREE.Float32BufferAttribute(rc, 3));
      const roue = new THREE.Points(rg, new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true, fog: false })); roue.position.set(60, 76, 1040); roue.frustumCulled = false; h.scene.add(roue);
      // camions : la remorque, la cabine et les feux arrière suivent le trafic de sim.js
      const nt = h.M.trafic, d = new THREE.Object3D();
      const rem = new THREE.InstancedMesh(new THREE.BoxGeometry(8, 3.1, 2.5), lambert(h, 0xb8bcc4), nt), cab = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 2.6, 2.4), lambert(h, 0x2c6ab8), nt), feux = new THREE.InstancedMesh(new THREE.BoxGeometry(0.15, 0.5, 2.3), basic(h, 0xff2030), nt);
      for (const m of [rem, cab, feux]) { m.frustumCulled = false; h.scene.add(m); }
      return (dt, now) => {
        roue.rotation.z = now * 0.00012; bp.visible = (now / 700 & 1) === 1;
        const vis = h.temps() >= 0; rem.visible = cab.visible = feux.visible = vis; if (!vis) return; // pas de camions en mode course
        trafic(T, h.temps()).forEach((k, i) => {
          const fx = Math.cos(k.th), fz = Math.sin(k.th);
          d.rotation.set(0, -k.th, 0);
          d.position.set(k.x - fx * 1.2, k.y + 2.15, k.z - fz * 1.2); d.updateMatrix(); rem.setMatrixAt(i, d.matrix);
          d.position.set(k.x + fx * 4.1, k.y + 1.9, k.z + fz * 4.1); d.updateMatrix(); cab.setMatrixAt(i, d.matrix);
          d.position.set(k.x - fx * 5.25, k.y + 1.2, k.z - fz * 5.25); d.updateMatrix(); feux.setMatrixAt(i, d.matrix);
        });
        rem.instanceMatrix.needsUpdate = cab.instanceMatrix.needsUpdate = feux.instanceMatrix.needsUpdate = true;
      };
    },

    // ---------- Premier métro : immeubles de pierre alignés sur la rue, réverbères encore allumés, arche sur la place, dôme blanc sur la butte, Seine ----------
    paris(h) {
      const { THREE, S, N, W, rnd } = h, quai = (x, z) => z > 262 && x > -170 && x < 1060; // côté fleuve des quais
      const g = terrain(h, { pas: 16, marge: 320, mat: new THREE.MeshLambertMaterial({ map: bruit(h, '#6e6a66', ['#7a7672', '#625e5a']) }), creux: (x, z) => quai(x, z) ? Math.min(9, (z - 262) * 0.5) : 0 });
      h.box(1500, 1, 700, basic(h, 0xffffff, { map: (t => { t.repeat.set(40, 20); return t; })(bruit(h, '#1e3a3a', ['#2a4a48', '#c08a7a', '#16302e'])) }), 450, -11, 640); // la Seine, qui prend le rose du ciel
      // façade : rez-de-chaussée à stores rouges, cinq étages de fenêtres, balcons filants aux 2e et 5e, toit de zinc
      const facade = p => h.tex(64, 64, c => {
        h.R(c, p, 0, 0, 64, 64); h.R(c, '#5d6b82', 0, 0, 64, 9); for (let x = 5; x < 64; x += 16) h.R(c, '#3a4658', x, 3, 5, 5);
        for (let f = 0; f < 5; f++) for (let x = 4; x < 64; x += 8) h.R(c, rnd() < 0.12 ? '#ffd05a' : '#3a4048', x, 12 + f * 8, 4, 6);
        h.R(c, '#2a2a30', 0, 19, 64, 1); h.R(c, '#2a2a30', 0, 43, 64, 1);
        h.R(c, '#2a2622', 0, 53, 64, 11); for (let x = 2; x < 64; x += 16) h.R(c, x % 32 ? '#c8102e' : '#1d4a3a', x, 52, 12, 3);
      });
      const fm = ['#d9c9a8', '#cfc0a0', '#e0d4b8'].map(p => new THREE.MeshLambertMaterial({ map: facade(p) })), lots = fm.map(() => []);
      for (let i = 0; i < N; i += 8) for (const sd of [-1, 1]) { // un immeuble tous les 16 m de chaque côté, sauf sur la trémie, côté fleuve, et là où une autre rue passe
        if (h.zone(i, 14) > 0) continue;
        const s = S[i], [x, z] = bord(s, sd, W + 9.5);
        if (quai(x, z) || g.dAt(x, z) < W + 8.5) continue;
        const H = 20 + (rnd() * 3 | 0) * 2; lots[rnd() * 3 | 0].push([x, g.hAt(x, z) + H / 2 - 3, z, h.across(s), 17, H + 6, 14]);
      }
      for (let k = 0; k < 420; k++) { // et la ville derrière : des toits à perte de vue
        const x = g.box[0] + rnd() * (g.box[2] - g.box[0]), z = g.box[1] + rnd() * (g.box[3] - g.box[1]), d = g.dAt(x, z);
        if (d > 42 && !quai(x, z - 30)) { const H = 18 + rnd() * 8; lots[k % 3].push([x, g.hAt(x, z) + H / 2 - 3, z, (rnd() * 4 | 0) * 1.5708 + rnd() * 0.3, 16 + rnd() * 14, H + 6, 14 + rnd() * 10]); }
      }
      lots.forEach((l, i) => inst(h, new THREE.BoxGeometry(1, 1, 1), fm[i], l));
      // réverbères, allumés jusqu'au lever du jour ; platanes le long du fleuve
      const mats = [], lant = [], troncs = [], houp = [];
      for (let i = 0; i < N; i += 10) {
        if (h.zone(i, 6) > 0) continue;
        const s = S[i], sd = (i / 10) & 1 ? 1 : -1, [x, z] = bord(s, sd, W + 0.9); mats.push([x, s.y + 3.4, z]); lant.push([x, s.y + 7, z]);
        const [rx, rz] = bord(s, -1, W + 2.4); if (quai(rx, rz + 14) && i % 20 === 0) { troncs.push([rx, s.y + 2.5, rz]); houp.push([rx, s.y + 7.5, rz, rnd() * 6, 1, 0.9, 1]); }
      }
      inst(h, new THREE.BoxGeometry(0.25, 7, 0.25), lambert(h, 0x1e3a2a), mats); inst(h, new THREE.BoxGeometry(0.7, 0.8, 0.7), basic(h, 0xffd05a), lant);
      inst(h, new THREE.BoxGeometry(0.5, 5, 0.5), lambert(h, 0x4a3a2a), troncs); inst(h, new THREE.IcosahedronGeometry(3.4, 0), lambert(h, 0x4a6a3a), houp);
      // l'arche au centre de la place ; le dôme blanc en haut de la butte
      const pierre = lambert(h, 0xd9c9a8), y0 = g.hAt(450, 0);
      for (const sx of [-14, 14]) h.box(12, 36, 16, pierre, 450 + sx, y0 + 18, 0); h.box(40, 14, 16, pierre, 450, y0 + 43, 0);
      const craie = lambert(h, 0xf4f0e8), yb = g.hAt(935, -598);
      h.box(40, 24, 30, craie, 935, yb + 12, -598); h.box(9, 46, 9, craie, 935, yb + 23, -620);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(13, 8, 5, 0, 6.283, 0, 1.6), craie); dome.position.set(935, yb + 24, -596); dome.scale.y = 1.5; h.scene.add(dome);
      for (const sx of [-15, 15]) { const d2 = new THREE.Mesh(new THREE.SphereGeometry(5, 6, 4, 0, 6.283, 0, 1.6), craie); d2.position.set(935 + sx, yb + 24, -588); d2.scale.y = 1.5; h.scene.add(d2); }
      return null;
    },

    // ---------- Canal 6 : lit de béton, berges, ponts qui enjambent, pylônes, palmiers, wagons, silhouette du centre-ville à contre-jour ----------
    canal(h) {
      const { THREE, S, N, W, rnd } = h;
      const dalle = h.tex(64, 64, c => { h.R(c, '#b0a592', 0, 0, 64, 64); for (let i = 0; i < 200; i++) h.R(c, i % 2 ? '#b8ad9a' : '#a69b88', rnd() * 64 | 0, rnd() * 64 | 0, 2, 1); h.R(c, '#8a8074', 0, 0, 64, 1); h.R(c, '#8a8074', 0, 0, 1, 64); });
      const g = terrain(h, { pas: 16, marge: 340, mat: new THREE.MeshLambertMaterial({ map: dalle }) });
      // ponts : un tablier droit du nord au sud, par-dessus le canal et la berge ; piles posées là où il n'y a pas de route
      const beton = lambert(h, 0xa89e90);
      for (const bx of [500, 1000, 1500]) {
        h.box(16, 3, 640, beton, bx, 17.5, 110); for (const sx of [-8.5, 8.5]) h.box(1, 2, 640, beton, bx + sx, 20, 110);
        for (let z = -200; z <= 420; z += 34) if (g.dAt(bx, z) > W + 7) { const y = g.hAt(bx, z); h.box(6, 17 - y, 6, beton, bx, (16 + y) / 2, z); }
        for (const z of [-60, 110, 280]) for (const a of [-0.42, 0.42]) { const arc = h.box(2, 3, 96, beton, bx, 30, z + (a > 0 ? 42 : -42)); arc.rotation.x = a; } // arcs en V au-dessus du tablier
      }
      // ligne à haute tension sur la rive nord ; palmiers et wagons sur la berge sud
      const pyl = [], bras = [], fils = [], troncs = [], palmes = [], wagons = [[], [], []];
      for (let x = -400; x <= 2100; x += 190) { const z = -230, y = g.hAt(x, z); pyl.push([x, y + 24, z]); bras.push([x, y + 44, z]); if (x > -400) for (const o of [-7, 7]) fils.push(x - 190, g.hAt(x - 190, z) + 44, z + o, x, y + 44, z + o); }
      inst(h, new THREE.BoxGeometry(1.6, 48, 1.6), lambert(h, 0x3a2c3a), pyl); inst(h, new THREE.BoxGeometry(1, 1, 16), lambert(h, 0x3a2c3a), bras);
      const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fils, 3)); h.scene.add(new THREE.LineSegments(fg, new THREE.LineBasicMaterial({ color: 0x2a1c2a })));
      for (let i = 0; i < N; i += 11) for (const sd of [-1, 1]) {
        const s = S[i], [x, z] = bord(s, sd, W + 6 + rnd() * 4);
        if (g.dAt(x, z) < W + 5 || s.y < 0) continue; // seulement sur la berge, pas dans le lit
        const y = g.hAt(x, z), ht = 11 + rnd() * 6; troncs.push([x, y + ht / 2, z, 0, 1, ht, 1]); palmes.push([x, y + ht, z, rnd() * 6, 1, 0.45, 1]);
        if (sd > 0 && i % 22 === 0) { const [wx, wz] = bord(s, 1, W + 22); if (g.dAt(wx, wz) > W + 18) wagons[rnd() * 3 | 0].push([wx, g.hAt(wx, wz) + 2.4, wz, h.across(s) + 1.5708]); }
      }
      inst(h, new THREE.BoxGeometry(0.55, 1, 0.55), lambert(h, 0x2a1c20), troncs); inst(h, new THREE.IcosahedronGeometry(4, 0), lambert(h, 0x1a2418), palmes);
      [0x8a3a2a, 0x5a4a3a, 0x3a4a5a].forEach((c, i) => inst(h, new THREE.BoxGeometry(17, 4.2, 3.2), lambert(h, c), wagons[i]));
      // entrepôts bas autour, puis les tours du centre-ville à l'ouest, à contre-jour devant le soleil
      const hangar = lambert(h, 0x8a7a6a), hl = [];
      for (let k = 0; k < 260; k++) { const x = g.box[0] + rnd() * (g.box[2] - g.box[0]), z = g.box[1] + rnd() * (g.box[3] - g.box[1]); if (g.dAt(x, z) > 70) hl.push([x, g.hAt(x, z) + 3, z, (rnd() * 2 | 0) * 1.5708, 30 + rnd() * 40, 9 + rnd() * 6, 22 + rnd() * 20]); }
      inst(h, new THREE.BoxGeometry(1, 1, 1), hangar, hl);
      const tours = basic(h, 0xffffff, { fog: false, map: h.tex(32, 64, c => { h.R(c, '#2a1c3a', 0, 0, 32, 64); for (let i = 0; i < 40; i++) h.R(c, '#ffc04a', rnd() * 32 | 0, rnd() * 64 | 0, 1, 1); }) });
      for (let i = 0; i < 34; i++) { const hh = 120 + rnd() * rnd() * 380, w = 50 + rnd() * 70; h.box(w, hh, w, tours, -2300 + rnd() * 900, hh / 2, -500 + rnd() * 1300); }
      return null;
    },
  };
})();
