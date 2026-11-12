<p align="center"><img src="icon.svg" width="96" alt="icône"></p>

<h1 align="center">VILLE À PLEIN RÉGIME</h1>
<p align="center"><b>夜間タイムアタック</b> · <i>contre-la-montre nocturne</i></p>

<p align="center"><img src="docs/titre.png" alt="Écran titre"></p>

<p align="center"><b>★ ★ ★ NOUVEAU ! ★ ★ ★</b><br>
<b>LA NUIT EST À VOUS. LA VILLE AUSSI.</b></p>

---

### 🌃 Minuit. Les néons s'allument. Le compte-tours grimpe.

Prenez le volant d'une bête de 500 chevaux et lâchez-la dans les artères d'une mégalopole cyberpunk qui ne dort jamais. Pluie, gratte-ciel, enseignes en katakana : chaque virage est une carte postale, chaque ligne droite une invitation à passer la sixième.

<p align="center"><img src="docs/course-1.png" alt="En course, les adversaires dans les rétros"></p>

### 🏁 DEUX MODES DE JEU EXPLOSIFS !

- **CONTRE-LA-MONTRE** : enchaînez les tours, battez vos records… puis battez votre propre **fantôme** !
- **COURSE** : 3 tours, 3 rivaux sans pitié. **KENJI**, **REI** et **JUN** ne vous feront aucun cadeau.

<p align="center"><img src="docs/depart.png" alt="La grille de départ"></p>

### ⚙️ UNE MÉCANIQUE DE PRO

- Boîte **automatique ou manuelle** : passez vos rapports comme un vrai pilote !
- **Frein à main** et glisses contrôlées : prenez les épingles en travers !
- Physique inspirée d'une **vraie GT japonaise** : couple, rapports, aéro, tout y est !
- Frottez les murs… et regardez voler les **étincelles** !

<p align="center"><img src="docs/course-2.png" alt="233 km/h dans les rues de la ville"></p>

### 📻 3 STATIONS DE RADIO EN DIRECT

La bande-son est **composée en temps réel** et **réagit à votre conduite**. Plus vous appuyez, plus elle s'emballe ! Branchez-vous sur **NIGHT CITY FM** ou zappez d'une touche.

<p align="center"><img src="docs/arrivee.png" alt="Classement à l'arrivée"></p>

### 💾 AUCUNE INSTALLATION !

Pas de disquette, pas de CD, pas de téléchargement de 40 Go. **Un navigateur, et c'est parti.**

| | |
|---|---|
| 🎮 Genre | Course arcade |
| 👤 Joueurs | 1 |
| 🖥️ Plateforme | Tout navigateur moderne |
| ⏱️ Chargement | Instantané |
| 💰 Prix | **GRATUIT** |

<p align="center"><b>DISPONIBLE DÈS MAINTENANT DANS TOUS LES BONS NAVIGATEURS.</b><br>
<sub>Le pilotage nocturne doit se pratiquer en toute sécurité, sur écran uniquement.</sub></p>

---

# Pour les développeurs

Jeu de course arcade solo, de nuit dans une ville cyberpunk en 3D pixelisée. Un circuit, une voiture, une radio à trois stations dont la musique réagit à la course. Deux modes, à choisir sur l'écran titre : contre-la-montre à tours enchaînés (records et fantôme), ou course de 3 tours contre 3 adversaires pilotés par l'ordinateur.

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
| ← → (écran titre) | choisir le mode : contre-la-montre ou course |
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
| `index.html` | page, polices, icône, ordre de chargement des scripts |
| `icon.svg` | icône de l'app (favicon) |
| `docs/` | captures d'écran du README |
| `sim.js` | **circuit et physique**, sans aucun rendu : tracé, voiture, moteur et boîte, glisse, murs, pilote automatique, course (adversaires, chocs entre voitures, classement). Partagé entre le jeu et les tests. |
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

Vérifie la géométrie du circuit, un tour complet au pilote automatique, les performances de la voiture (0 à 100 km/h, vitesses de passage des rapports, rupteur), la glisse et le boost, puis la course : chocs entre voitures, dépassement, course complète de 3 tours et classement.

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
| `AI_LVL` | niveau de chaque adversaire du mode course (1 = tour propre du pilote automatique) |

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
| `const OPP = [` | noms et couleurs des adversaires |

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
