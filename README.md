# Ville à plein régime

Jeu de course arcade solo, contre-la-montre en 3D pixelisée. Cinq cartes, chacune avec son tracé, sa voiture, sa radio, son décor et son interface ; la musique réagit à la course.

| Carte | Conduite | Voiture | Radio |
|---|---|---|---|
| Ville à plein régime | viaduc et échangeur de nuit, presque tout à fond | Nismo GT-R Z-tune | darksynth, house, breakbeat |
| Karasu-tōge | col de montagne : montée rapide, quatre épingles en descente | Mazda RX-7 Spirit R | eurobeat |
| Wan-9 | autoroute de baie à 270 km/h, boucle serrée, camions à doubler | Toyota Supra RZ | trance |
| Premier métro | rues de Paris à l'aube, relances entre des angles | Renault 5 Maxi Turbo | disco spatiale |
| Canal 6 | canal de Los Angeles au couchant, large et glissant | Dodge Viper GTS | g-funk |

Le menu principal choisit la carte, le mode et la boîte (haut / bas pour la ligne, gauche / droite pour la valeur, Entrée pour démarrer). Deux modes : **contre-la-montre** (tours lancés, record et fantôme par carte) et **course** (3 tours, départ en grille contre 3 IA, classement à l'arrivée). La ligne MODE du menu fait aussi défiler la difficulté de la course (détente, normal, chaud : `DIFF` dans `sim.js`). En contre-la-montre, chaque carte a ses médailles de temps, calculées sur le tour lancé du pilote automatique (`med` dans `cartes.js`). Changer de carte recharge la page ; on peut aussi la choisir par l'adresse : `?carte=touge`, `wangan`, `paris`, `canal`, `ville`.

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
| Haut / bas, gauche / droite, Entrée | menu principal : carte, mode, boîte, démarrer |
| ↑ ↓ ← → ou ZQSD | accélérer, freiner, tourner |
| Espace | frein à main (déclenche la glisse) |
| G | boîte automatique / manuelle |
| A / E | rapport inférieur / supérieur (en manuelle) |
| C | station de radio suivante |
| M | couper / remettre la musique |
| Échap ou P | menu pause (reprendre, recommencer, boîte, radio, musique, fantôme, quitter) |
| R | recommencer |
| Manette | stick ou croix : volant et menus · ZR ou B : gaz · ZL ou Y : frein · A : glisse · X : radio · L / R : rapports · + : pause · B : valider |
| Joy-Con seul, à l'horizontale | touche J une fois pour l'autoriser (Chrome ou Edge) · stick : volant et menus · bouton du bas : gaz et valider · gauche : frein · droite : glisse · haut : radio · SL / SR : rapports · + ou − : pause |

Le pilotage (ZQSD, A/E) est lu en position physique des touches, donc WASD et Q/E sur un clavier QWERTY. Les autres commandes sont lues par la lettre tapée.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | page, polices, ordre de chargement des scripts |
| `cartes.js` | **les cartes**, en données : tracé, largeur, adhérence, voiture, stations de radio, thème (couleurs, ciel, lumière, interface). Ajouter une carte commence ici. |
| `sim.js` | **physique**, sans aucun rendu : piste, moteur et boîte, glisse, murs, pilote automatique, course contre IA, trafic. Partagé entre le jeu et les tests. |
| `game.js` | rendu three.js, décor de la ville, effets, interface, commandes, boucle de jeu |
| `audio.js` | tout le son, synthétisé : trois stations de radio par carte (données `RADIO` dans `cartes.js`), chacune avec ses timbres (`PATCH`), sa batterie (`KIT`), ses effets et sa forme en sections ; musique de menu, ambiance du lieu par zones, tunnels, moteur, boîte, pneus, bruitages. Exposé au jeu par `window.SON`. |
| `ecoute.html` | banc d'écoute : chaque station, ambiance et bruitage joué seul (amplifié pour l'écoute, vumètre, « tout arrêter »), le mélange de course avec un curseur par famille, et trois vérifications : auto-test des boutons, niveaux (RMS et crête) et variété des stations (corrélation des spectres), par rendu hors ligne |
| `decors.js` | décors des autres cartes (forêt, baie, Paris, canal) : une fonction par carte |
| `rythme.js` | **essai indépendant** : les aplats lumineux du décor battent avec la grosse caisse de la radio. Pour le retirer, supprimer sa ligne dans `index.html` ; pour comparer, ajouter `&rythme=0` à l'adresse. |
| `test-cartes.js` | tests de toutes les cartes |
| `propositions/` | la page de conception d'origine des cartes (historique) |
| `samples.js` | sons de batterie encodés en base64 (généré depuis `samples/`) |
| `samples/` | sons de Roland TR-808 d'origine et leur note d'auteur |
| `fonts/` | polices pixel |
| `three.min.js` | three.js r128 |
| `test.js` | tests de la physique |

`game.js` est un seul fichier découpé en sections repérées par `// ----------` : rendu et passe finale, textures, piste, ville, horizon, voiture et effets, état de jeu et commandes, interface, boucle.

## Tests

```bash
node test.js
```

Vérifie sur la ville la géométrie du circuit, un tour complet au pilote automatique, les performances de la voiture (0 à 100 km/h, vitesses de passage des rapports, rupteur), la glisse, le boost et la course contre IA. Ses temps de référence sont figés : s'ils bougent, les records de la ville ne sont plus comparables.

```bash
node test-cartes.js
```

Passe chaque carte dans la physique : tracé sans recoupement, tour bouclé au pilote automatique, 0 à 100 km/h plausible, glisse au frein à main, trafic. Affiche longueur, temps au tour et vitesses de chaque carte.

Dans le navigateur, `?auto` fait conduire le pilote automatique, et `window.__g` expose l'état du jeu pour le débogage.

## Où régler quoi

Dans `cartes.js`, pour chaque carte :

| Champ | Effet |
|---|---|
| `grip` | adhérence en virage (m/s²). 44 sur la ville (arcade), 15 à 24 ailleurs (proche d'une vraie voiture en pneus de course). Plus haut : on tourne plus serré, on freine moins. |
| `W`, `sc`, `pts` | demi-largeur de route, échelle et points de contrôle `[x, z, altitude]` du tracé |
| `tun`, `chaud`, `sect` | tunnel, secteur où la musique se déchaîne, temps intermédiaires (indices de points) |
| `car` | la voiture : rapports de boîte, courbe de couple, masse, aérodynamique, motricité, silhouette |
| `radio` | les stations (`RADIO`, en tête de `cartes.js`) : tempo, batterie, timbres, couleur, progressions, motifs, thèmes, sections et forme · `amb` : les zones où l'on entend l'ambiance du lieu |
| `th` | le thème : ciel, brume, lumières, couleurs de route, style et couleurs de l'interface |
| `trafic` | nombre de camions sur la route |

Dans `sim.js` : `TOP` est la vitesse de référence pour le braquage et les effets visuels, `AI_LVL` le niveau de chaque adversaire du mode course (1 = tour propre du pilote automatique).

Dans `game.js` :

| Chercher | Effet |
|---|---|
| `function sched(` (dans `audio.js`) | le séquenceur musical et ses couches adaptatives |
| `function audioFrame(` (dans `audio.js`) | son du moteur, des pneus, du vent, et pilotage de la musique par la course |
| `NL`, `LUM_GAIN`, `LUM_PAS`, `TUN_AMB` (en tête de fichier) | lumière dynamique : nombre de luminaires calculés, force de tous les luminaires et des phares, espacement des luminaires de tunnel, lumière ambiante des tunnels |
| `QUANT`, `TRAME`, `TREMBLE` (en tête de fichier) | rendu rétro : niveaux de couleur par canal, force du tramage de Bayer, tremblement des sommets (0 = éteint) |
| `lum(` | chaque luminaire du décor : échantillon de piste, position, couleur, portée, force (aussi dans `decors.js` : `h.lum(`) |
| `const LU_F` | le calcul de lumière ajouté à tous les matériaux : luminaires, phares, ombre de la voiture, reflets |
| `post.uniforms.amt.value` | intensité du flou de vitesse |
| `c += bl *` | intensité du halo des néons |
| `cam.fov =` | grand-angle de la caméra selon la vitesse |
| `function drawHUD(` | toute l'interface et les écrans |
| `const pauseItems` | entrées du menu pause |
| `const OPP = [` | noms et couleurs des adversaires |

Les records, le fantôme et les préférences sont stockés dans le navigateur sous les clés `vpr5.*` pour la ville et `vpr5.<carte>.*` pour les autres. Quand la physique change au point de rendre les anciens temps incomparables, incrémenter ce préfixe.

Pour régénérer `samples.js` après avoir changé un son dans `samples/`, réencoder chaque fichier `.ogg` en base64 dans l'objet `window.SMP`.

## État du code

Ce qui est solide : la physique est isolée, testée, et ne dépend pas du rendu.

Dette connue, à traiter avant d'ajouter beaucoup de contenu :

- `game.js` fait environ 700 lignes dans une seule fermeture.
- La physique tourne à 120 Hz sans interpolation de l'affichage : légère saccade possible sur un écran 144 Hz.
- La ville compte plusieurs centaines d'objets dessinés séparément. Sans souci sur une machine récente, à fusionner si le jeu doit tourner sur du matériel modeste.
- L'interface est entièrement redessinée à chaque image.
- Aucun test automatique ne couvre le rendu ni le son.
- La lumière dynamique demande WebGL 2 (dérivées dans le shader) ; l'ombre portée sous les luminaires n'existe que pour la voiture du joueur.

## Déployer

Le jeu est un site statique : il suffit de servir le dossier tel quel. Sur GitHub Pages, activer Pages sur la branche `main`, dossier racine. Sur l'offre gratuite, cela demande un dépôt public : relire d'abord la section suivante.

## Crédits et licences

- **three.js** r128, licence MIT.
- **Polices** Press Start 2P et DotGothic16, licence SIL Open Font.
- **Sons de TR-808** : enregistrés par Michael Fischer (Technopolis, 1994) et distribués gratuitement par leur auteur, sans licence formelle. Voir `samples/TR808.TXT`. À vérifier ou à remplacer avant toute diffusion commerciale.
- **Données des voitures** : fiche technique de la Nismo Skyline GT-R Z-tune (rapports de boîte, couple, puissance, masse). La forme de la courbe de couple, le Cx et les pertes de transmission sont des estimations. Les fiches des quatre autres voitures (Mazda RX-7 Spirit R, Toyota Supra RZ, Renault 5 Maxi Turbo, Dodge Viper GTS) sont saisies de mémoire, et les rapports de boîte de la Renault 5 sont estimés : à vérifier sur fiche constructeur.
- **Cartes** : tracés, décors et noms originaux, inspirés de lieux réels et de l'ambiance de films et de mangas, sans en reprendre les circuits, personnages ni visuels.
- **Musique** : compositions originales, synthétisées en direct.

Le code du jeu n'a pas encore de licence : à choisir avant de rendre le dépôt public.
