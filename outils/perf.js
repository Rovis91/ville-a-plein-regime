// Banc de performance. index.html?perf&auto : mesure toutes les cartes à la suite (la page se recharge de l'une à l'autre), résultat dans localStorage 'vpr.perf' et dans la console.
// Une seule carte : index.html?carte=<id>&auto, puis dans la console : (await import('./outils/perf.js')).tour()
// Le pilote automatique fait un tour en course contre 3 IA (le cas le plus lourd), à pas fixe de 1/60 s. Chaque image est chronométrée (cpu), et chaque lot de 30 images GPU compris (ms).
// Référence à tenir sur toutes les cartes (voir README, « Performances ») : BUDGET ci-dessous.
// Écran partagé : index.html?perf&auto&joueurs=2 fait la même mesure avec les deux vues dessinées (les deux joueurs au pilote automatique, 2 IA), résultat dans 'vpr.perf2'. Sa référence : budget(2).
export const BUDGET = { appels: 300, ms: 2, msMax: 3, cpuMax: 8.3 }; // passes de dessin par image (ombres comprises) ; ms par image en moyenne ; dans le pire lot de 30 images ; ms de frame() pour la pire image (8,3 ms = 120 images/s)
// la référence vaut par vue : à n vues, n fois les passes de dessin du solo ; le temps d'image, lui, doit seulement rester sous une image à 120 Hz
export const budget = n => n > 1 ? { appels: BUDGET.appels * n, ms: BUDGET.cpuMax, msMax: BUDGET.cpuMax, cpuMax: BUDGET.cpuMax } : BUDGET;
const cede = () => new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = r; c.port2.postMessage(0); }); // un setTimeout serait bridé à 1 par seconde en arrière-plan

export async function tour({ images = 0 } = {}) {
  const g = window.__g, gl = g.renderer.getContext(), N = g.T.n, info = g.renderer.info;
  if (g.mode !== 'course') throw new Error('passer en mode course au menu');
  g.start(); info.autoReset = false;
  // rien ne va à l'écran pendant la mesure : la passe finale est dessinée dans une cible hors écran de même taille. Sinon le navigateur cale le dessin sur l'affichage
  // (8,3 ms pile à 120 Hz) et, onglet masqué, le bloque des centaines de ms : on mesurerait l'écran, pas le jeu.
  const cv = g.renderer.domElement, hors = new THREE.WebGLRenderTarget(cv.width, cv.height), cible = g.renderer.setRenderTarget.bind(g.renderer);
  // à deux vues, la passe finale de chacune va dans sa bande : la cible hors écran reprend la découpe demandée pour l'écran (three l'ignore sur une cible), sinon chaque vue repeindrait toute l'image
  const nv = g.vues.length, bande = () => { const k = g.renderer.getPixelRatio(); g.renderer.getViewport(hors.viewport).multiplyScalar(k); g.renderer.getScissor(hors.scissor).multiplyScalar(k); hors.scissorTest = g.renderer.getScissorTest(); };
  g.renderer.setRenderTarget = t => { if (!t && nv > 1) bande(); cible(t || hors); }; const px = new Uint8Array(4);
  let now = performance.now() + 1e7; const pas = 1000 / 60, LOT = 30;
  const synchro = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); // attend que le GPU ait tout dessiné ; calé sur l'écran (8,3 ms à 120 Hz), donc une fois par lot seulement
  // part du rendu (three) et du son dans chaque image, pour savoir d'où vient un à-coup
  const part = { rendu: 0, son: 0 }, chrono = (o, k, n) => { const f = o[k]; o[k] = function () { const t = performance.now(); try { return f.apply(this, arguments); } finally { part[n] += performance.now() - t; } }; return () => { o[k] = f; }; };
  const defait = [chrono(g.renderer, 'render', 'rendu'), chrono(SON, 'frame', 'son')], parts = [];
  const une = () => { info.reset(); part.rendu = part.son = 0; const t = performance.now(); g.frame(now += pas); return performance.now() - t; };
  while (g.state !== 'race') une();
  for (let i = 0; i < 120; i++) une(); // échauffement : shaders compilés, textures envoyées
  synchro();
  // cpu : temps de frame() image par image (le jeu et l'envoi des ordres de dessin) ; lot : temps réel par image sur LOT images enchaînées, GPU compris
  const cpu = [], ou = [], appels = [], tris = [], lot = [], ouLot = []; let fin = performance.now() + 12, t0 = performance.now();
  while (images ? cpu.length < images : g.car.dist < N + 20 && cpu.length < 20000) {
    cpu.push(une()); parts.push('rendu ' + part.rendu.toFixed(1) + ' son ' + part.son.toFixed(1)); ou.push(g.car.idx); appels.push(info.render.calls); tris.push(info.render.triangles);
    if (cpu.length % LOT === 0) { synchro(); lot.push((performance.now() - t0) / LOT); ouLot.push(g.car.idx); if (performance.now() > fin) { await cede(); fin = performance.now() + 12; } t0 = performance.now(); } // rend la main entre deux lots : l'onglet ne se fige pas
  }
  info.autoReset = true; g.renderer.setRenderTarget = cible; hors.dispose(); defait.forEach(f => f());
  const moy = a => a.reduce((s, v) => s + v, 0) / a.length, q = (a, p) => { const t = [...a].sort((x, y) => x - y); return +t[Math.min(t.length - 1, Math.floor(t.length * p))].toFixed(2); };
  const pires = (a, o) => a.map((v, i) => [v, i]).sort((x, y) => y[0] - x[0]).slice(0, 4).map(([v, i]) => o[i] + ':' + v.toFixed(1)); // « échantillon de piste : ms » des pires
  const sect = (a, o, k) => Array.from({ length: 10 }, (_, s) => { const l = a.filter((_, i) => Math.floor(o[i] * 10 / N) === s); return l.length ? +k(l).toFixed(1) : 0; }); // par dixième de piste : où ça coûte
  const r = { carte: g.M.id, vues: nv, images: cpu.length, ms: +moy(lot).toFixed(2), msMax: q(lot, 1), cpu: +moy(cpu).toFixed(2), cpu99: q(cpu, 0.99), cpuMax: q(cpu, 1),
    appels: Math.round(moy(appels)), appelsMax: Math.max(...appels), tris: Math.round(moy(tris)), trisMax: Math.max(...tris),
    piresLots: pires(lot, ouLot), piresCpu: cpu.map((v, i) => [v, i]).sort((x, y) => y[0] - x[0]).slice(0, 6).map(([v, i]) => ou[i] + ':' + v.toFixed(1) + ' (' + parts[i] + ')'), sectMs: sect(lot, ouLot, moy), sectAppels: sect(appels, ou, l => Math.max(...l)) };
  const B = budget(nv); r.ok = r.appelsMax <= B.appels && r.ms <= B.ms && r.msMax <= B.msMax && r.cpuMax <= B.cpuMax;
  return r;
}

export async function suite() { // lancé par ?perf : chaque carte à son tour
  const charge = Math.round(performance.now()), ids = CARTES.map(m => m.id), i = ids.indexOf(__g.M.id), Q = new URLSearchParams(location.search);
  // le nombre de vues est toujours écrit dans l'adresse : sans lui le jeu suivrait la préférence du menu, et le banc du solo tournerait à deux chez qui a joué à deux
  const n = Q.get('joueurs') === '2' ? 2 : 1, d = n > 1 ? '2' : '', K = 'vpr.perf' + d, url = id => location.pathname + '?perf&auto&joueurs=' + n + '&carte=' + id;
  if (!Q.get('carte') || !Q.get('joueurs') || __g.mode !== 'course') { localStorage.setItem('vpr7.mode' + d, '"course"'); localStorage.removeItem(K); location.href = url(ids[0]); return; }
  const tout = JSON.parse(localStorage.getItem(K) || '[]'), r = await tour(); r.chargement = charge; // chargement : ms entre l'ouverture de la page et le jeu prêt
  tout.push(r); localStorage.setItem(K, JSON.stringify(tout));
  if (i + 1 < ids.length) location.href = url(ids[i + 1]);
  else { console.table(tout.map(({ piresLots, piresCpu, sectMs, sectAppels, ...t }) => t)); window.__perf = tout; }
}

// Mémoire sur l'enchaînement des cartes sans rechargement, comme en Tournée : index.html?auto, mode course, puis dans la console : (await import('./outils/perf.js')).chaine()
// Chaque carte de la liste est chargée à la suite de la précédente (tours fois toute la liste), roule `images` images en course, puis on relève ce que le GPU tient (géométries, textures, shaders)
// et le tas JS (Chrome seulement ; lancer avec --js-flags=--expose-gc pour un relevé après ramasse-miettes). Sain : les chiffres d'une carte sont les mêmes au second passage qu'au premier.
// À deux vues : index.html?auto&joueurs=2 (le nombre de joueurs écrit dans l'adresse y reste d'une carte à l'autre) ; la colonne « vues » dit ce qui a été mesuré.
export async function chaine({ tours = 2, images = 300 } = {}) {
  if (window.__g.mode !== 'course') throw new Error('passer en mode course au menu');
  const out = []; let now = performance.now() + 1e7;
  for (let k = 1; k <= tours; k++) for (const { id } of CARTES) {
    const av = window.__g; if (av.M.id !== id) { av.carte(id); while (window.__g === av) await cede(); }
    const g = window.__g, i = g.renderer.info; g.start(); for (let n = 0; n < images; n++) { g.frame(now += 1000 / 60); if (n % 30 === 0) await cede(); } // (la première image libère la carte précédente)
    if (window.gc) window.gc();
    out.push({ tour: k, carte: id, vues: g.vues.length, geometries: i.memory.geometries, textures: i.memory.textures, shaders: i.programs.length, tasMo: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null });
  }
  console.table(out); return out;
}

// Contrôle de la fusion du décor (game.js, « fusion ») : liste ce qui bouge ou change de visibilité pendant 15 s de course parmi les maillages simples.
// Tout ce qui sort ici en dehors du ciel, de la voiture et des adversaires doit porter userData.dyn = 1 (lui ou un parent), sinon la fusion le figerait.
export function mobiles() {
  const g = window.__g, ms = []; g.scene.updateMatrixWorld(true);
  g.scene.traverse(o => { if (o.isMesh && !o.isInstancedMesh) ms.push([o, o.matrixWorld.clone(), o.visible]); });
  g.start(); let now = performance.now() + 1e7; for (let i = 0; i < 900; i++) g.frame(now += 16.7); g.scene.updateMatrixWorld(true);
  const dyn = o => { for (; o; o = o.parent) if (o.userData.dyn) return true; return false; }, top = o => { while (o.parent && o.parent !== g.scene) o = o.parent; return o; }, vus = new Map();
  for (const [o, m, v] of ms) if ((!o.matrixWorld.equals(m) || o.visible !== v) && !dyn(o)) { const k = g.scene.children.indexOf(top(o)); vus.set(k, (vus.get(k) || 0) + 1); }
  return { carte: g.M.id, maillages: ms.length, nonMarques: [...vus].map(([k, n]) => ({ enfant: k, type: g.scene.children[k].type, maillages: n })) };
}
