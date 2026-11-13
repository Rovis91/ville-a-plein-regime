// Décor au rythme de la radio — ESSAI, entièrement indépendant du reste du jeu.
// Tout ce qui est lumineux en aplat dans le décor (néons, enseignes, bandes de tunnel, lanternes, vitrines) bat avec la grosse caisse de la station.
// Pas de halo ni de flou : seule la couleur des aplats monte et redescend.
// Pour le retirer : supprimer la ligne <script src="rythme.js"> de index.html (et ce fichier). Pour comparer sans rien toucher : ajouter &rythme=0 à l'adresse.
(window.lanceRythme = () => {
  const FORCE = 0.4; // 0 = rien ; 0,4 = les aplats passent de 80 % à 120 % de leur couleur
  if (!window.__g || !window.SON || /rythme=0/.test(location.search)) return;
  const mats = new Map(); // matériau → couleur d'origine
  __g.scene.traverse(o => {
    const m = o.material;
    if (!o.isMesh || !m || !m.isMeshBasicMaterial || m.transparent || m.depthWrite === false || m.side === THREE.BackSide) return; // ni ciel, ni fumée, ni traînées, ni fantôme
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    if (m.map && !o.userData.petit && o.geometry.boundingSphere.radius * Math.max(o.scale.x, o.scale.y, o.scale.z) > 60) return; // ni l'eau, ni les grands plans d'horizon (texturés) ; les liserés néon des murs, unis, restent
    mats.set(m, m.color.clone());
  });
  let k = 1;
  cancelAnimationFrame(window.__rythme); // changement de carte : lanceRythme est rejoué, l'ancienne boucle s'arrête
  const tick = () => {
    window.__rythme = requestAnimationFrame(tick);
    const but = SON.musicOn && __g.state !== 'pause' ? 1 - FORCE / 2 + FORCE * (SON.pulse || 0) : 1; // musique coupée ou pause : couleurs d'origine
    k += (but - k) * 0.5;
    for (const [m, c] of mats) m.color.copy(c).multiplyScalar(k);
  };
  window.__rythme = requestAnimationFrame(tick);
})();
