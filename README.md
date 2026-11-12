# Ville à plein régime

Jeu de course arcade solo, contre-la-montre de nuit dans une ville cyberpunk en 3D pixelisée. Un circuit, une voiture, une radio à trois stations dont la musique réagit à la course.

Tout tourne dans le navigateur, sans étape de build ni dépendance à installer.

## Lancer

- **Le plus simple** : double-cliquer sur `index.html`.
- **Avec un serveur local** (recommandé pour développer) :

```bash
python -m http.server 8123
```

puis ouvrir http://localhost:8123/.

## Commandes

| Touche | Action |
|---|---|
| Entrée | démarrer |
| ↑ ↓ ← → ou ZQSD | accélérer, freiner, tourner |
| Espace | frein à main (déclenche la glisse) |
| G | boîte automatique / manuelle |
| A / E | rapport inférieur / supérieur (en manuelle) |
| C | station de radio suivante |
| M | couper / remettre la musique |
| Échap ou P | menu pause (reprendre, recommencer, boîte, radio, musique, fantôme, quitter) |
| R | recommencer |

Le pilotage (ZQSD, A/E) est lu en position physique des touches, donc WASD et Q/E sur un clavier QWERTY. Les autres commandes sont lues par la lettre tapée.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | page, polices, ordre de chargement des scripts |
| `sim.js` | **circuit et physique**, sans aucun rendu : tracé, voiture, moteur et boîte, glisse, murs, pilote automatique. Partagé entre le jeu et les tests. |
| `game.js` | tout le reste : rendu three.js, effets, audio, interface, commandes, boucle de jeu |
| `samples.js` | sons de batterie encodés en base64 (généré depuis `samples/`) |
| `samples/` | sons de Roland TR-808 d'origine et leur note d'auteur |
| `fonts/` | polices pixel |
| `three.min.js` | three.js r128 |
| `test.js` | tests de la physique |

`game.js` est un seul fichier découpé en sections repérées par `// ----------` : rendu et passe finale, textures, piste, ville, horizon, voiture et effets, audio, état de jeu et commandes, interface, boucle.

## Tests

```bash
node test.js
```

Vérifie la géométrie du circuit, un tour complet au pilote automatique, les performances de la voiture (0 à 100 km/h, vitesses de passage des rapports, rupteur), la glisse et le boost.

Dans le navigateur, `?auto` fait conduire le pilote automatique, et `window.__g` expose l'état du jeu pour le débogage.

## Où régler quoi

Dans `sim.js`, en haut du fichier :

| Constante | Effet |
|---|---|
| `GRIP` | adhérence en virage. Plus haut : la voiture tourne plus serré et il faut moins freiner. |
| `SC` | échelle du tracé. Plus petit : virages plus serrés, tour plus court. |
| `PTS`, `HGT` | points de contrôle et altitudes du circuit |
| `CARD` | la voiture : rapports de boîte, courbe de couple, masse, aérodynamique |
| `TOP` | vitesse de référence pour le braquage et les effets visuels |

Dans `game.js` :

| Chercher | Effet |
|---|---|
| `const ST = [` | les stations de radio : tempo, accords, motifs de batterie et de basse |
| `function sched(` | le séquenceur musical et ses couches adaptatives |
| `function audioFrame(` | son du moteur, des pneus, du vent, et pilotage de la musique par la course |
| `post.uniforms.amt.value` | intensité du flou de vitesse |
| `c += bl *` | intensité du halo des néons |
| `cam.fov =` | grand-angle de la caméra selon la vitesse |
| `function drawHUD(` | toute l'interface et les écrans |
| `const pauseItems` | entrées du menu pause |

Les records, le fantôme et les préférences sont stockés dans le navigateur sous les clés `vpr5.*`. Quand la physique change au point de rendre les anciens temps incomparables, incrémenter ce préfixe.

Pour régénérer `samples.js` après avoir changé un son dans `samples/`, réencoder chaque fichier `.ogg` en base64 dans l'objet `window.SMP`.

## État du code

Ce qui est solide : la physique est isolée, testée, et ne dépend pas du rendu.

Dette connue, à traiter avant d'ajouter beaucoup de contenu :

- `game.js` fait environ 700 lignes dans une seule fermeture. Le premier découpage utile serait de sortir l'audio dans son propre fichier.
- La physique tourne à 120 Hz sans interpolation de l'affichage : légère saccade possible sur un écran 144 Hz.
- La ville compte plusieurs centaines d'objets dessinés séparément. Sans souci sur une machine récente, à fusionner si le jeu doit tourner sur du matériel modeste.
- L'interface est entièrement redessinée à chaque image.
- Aucun test automatique ne couvre le rendu ni le son.

## Déployer

Le jeu est un site statique : il suffit de servir le dossier tel quel. Sur GitHub Pages, activer Pages sur la branche `main`, dossier racine. Sur l'offre gratuite, cela demande un dépôt public : relire d'abord la section suivante.

## Crédits et licences

- **three.js** r128, licence MIT.
- **Polices** Press Start 2P et DotGothic16, licence SIL Open Font.
- **Sons de TR-808** : enregistrés par Michael Fischer (Technopolis, 1994) et distribués gratuitement par leur auteur, sans licence formelle. Voir `samples/TR808.TXT`. À vérifier ou à remplacer avant toute diffusion commerciale.
- **Données de la voiture** : fiche technique de la Nismo Skyline GT-R Z-tune (rapports de boîte, couple, puissance, masse). La forme de la courbe de couple, le Cx et les pertes de transmission sont des estimations.
- **Musique** : compositions originales, synthétisées en direct.

Le code du jeu n'a pas encore de licence : à choisir avant de rendre le dépôt public.
