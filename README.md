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
- **Nitro** : une jauge à remplir en prenant des risques, à dépenser où vous voulez
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

Jeu de course arcade solo, contre-la-montre en 3D pixelisée. Six cartes, chacune avec son tracé, sa voiture, sa radio, son décor et son interface ; la musique réagit à la course.

| Carte | Conduite | Voiture | Radio |
|---|---|---|---|
| Ville à plein régime | viaduc et échangeur de nuit, presque tout à fond | Nismo GT-R Z-tune | darksynth, house, breakbeat |
| Karasu-tōge | col de montagne : montée rapide, quatre épingles en descente | Mazda RX-7 Spirit R | eurobeat |
| Wan-9 | autoroute de baie à 270 km/h, boucle serrée, camions à doubler | Toyota Supra RZ | trance |
| Premier métro | rues de Paris à l'aube, relances entre des angles | Renault 5 Maxi Turbo | disco spatiale |
| Canal 6 | canal de Los Angeles au couchant, large et glissant | Dodge Viper GTS | g-funk |

Le menu principal choisit la carte, le mode et la boîte (haut / bas pour la ligne, gauche / droite pour la valeur, Entrée pour démarrer). Deux modes : **contre-la-montre** (tours lancés, record et fantôme par carte) et **course** (3 tours, départ en grille contre 3 IA, classement à l'arrivée). La ligne MODE du menu fait aussi défiler la difficulté de la course (détente, normal, chaud : `DIFF` dans `sim.js`). En contre-la-montre, chaque carte a ses médailles de temps, calculées sur le tour lancé du pilote automatique (`med` dans `cartes.js`). Changer de carte recharge la page ; on peut aussi la choisir par l'adresse : `?carte=touge`, `wangan`, `paris`, `canal`, `barrage`, `ville`.

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
| X ou N | nitro : dépense la jauge (gaz ouverts, roues au sol) |
| G | boîte automatique / manuelle |
| A / E | rapport inférieur / supérieur (en manuelle) |
| C | station de radio suivante |
| M | couper / remettre la musique |
| Échap ou P | menu pause (reprendre, recommencer, boîte, radio, musique, fantôme, quitter) |
| R | recommencer |
| Manette | stick ou croix : volant et menus · ZR ou B : gaz · ZL ou Y : frein · A : glisse · X : nitro · clic du stick : radio · L / R : rapports · − : boîte manuelle / automatique · + : pause · B : valider |
| Joy-Con seul, à l'horizontale | touche J une fois pour l'autoriser (Chrome ou Edge) · stick : volant et menus · bouton de droite : gaz et valider · gauche : boîte manuelle / automatique · haut / bas : rapport supérieur / inférieur · SR : glisse · SL : nitro · clic du stick : radio · + ou − : pause |

### Nitro et aspiration

La jauge de nitro (en bas à droite) remplace l'ancien boost automatique de sortie de glisse. Elle se remplit :

- en tenant une glisse (plus elle dure et plus elle va vite, plus elle remplit) ;
- en frottant un mur sans le taper ;
- en doublant un camion au ras, sans le toucher ;
- en roulant dans l'aspiration d'un rival, en course (on y gagne aussi de la vitesse ; les rivaux en profitent autant).

X ou N la dépense : une jauge pleine pousse 3 secondes, gaz ouverts et roues au sol (rien en l'air), y compris au-delà du rupteur. Un choc franc contre un mur ou un camion la vide. Réglages : `NI` en tête de `sim.js`.

Les médailles se mesurent toujours au tour lancé du pilote automatique, qui part avec une jauge pleine et la dépense en ligne droite. La physique ayant changé, les records d'avant la V2 (clés `vpr6.*`) ne comptent plus : le menu le signale une fois.

Le pilotage (ZQSD, A/E) est lu en position physique des touches, donc WASD et Q/E sur un clavier QWERTY. Les autres commandes sont lues par la lettre tapée.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | page, polices, icône, ordre de chargement des scripts |
| `icon.svg` | icône de l'app (favicon) |
| `docs/` | captures d'écran du README |
| `cartes.js` | **les cartes**, en données : tracé, largeur, adhérence, voiture, stations de radio, thème (couleurs, ciel, lumière, interface). Ajouter une carte commence ici. |
| `sim.js` | **physique**, sans aucun rendu : piste, moteur et boîte, glisse, murs, pilote automatique, course contre IA, trafic. Partagé entre le jeu et les tests. |
| `game.js` | rendu three.js, décor de la ville, effets, interface, commandes, boucle de jeu |
| `audio.js` | tout le son, synthétisé : trois stations de radio par carte (données `RADIO` dans `cartes.js`), chacune avec ses timbres (`PATCH`), sa batterie (`KIT`), ses effets et sa forme en sections ; musique de menu, ambiance du lieu par zones, tunnels, moteur, boîte, pneus, bruitages. Exposé au jeu par `window.SON`. |
| `ecoute.html` | banc d'écoute : chaque station, ambiance et bruitage joué seul (amplifié pour l'écoute, vumètre, « tout arrêter »), le mélange de course avec un curseur par famille, et trois vérifications : auto-test des boutons, niveaux (RMS et crête) et variété des stations (corrélation des spectres), par rendu hors ligne |
| `textures.js` | **catalogue des textures** : l'aspect de chaque surface, aplat (`nom: 0xrrggbb`) ou dessin sur canvas. Ni forme, ni emplacement. |
| `formes.js` | **catalogue des formes** : la géométrie de chaque objet, forme simple ou assemblage de boîtes à zones nommées. Ni texture, ni emplacement. Un assemblage posé est fondu en une géométrie par zone ; `insts()` (decors.js) le pose en nombre, une passe de dessin par zone. |
| `decors.js` | **placement** des décors des autres cartes (forêt, baie, Paris, canal), une fonction par carte : où poser quelle forme avec quelle texture, par `h.pose`, `h.geo`, `h.mat`. Le placement de la piste et de la ville est dans `game.js`. |
| `rythme.js` | **essai indépendant** : les aplats lumineux du décor battent avec la grosse caisse de la radio. Pour le retirer, supprimer sa ligne dans `index.html` ; pour comparer, ajouter `&rythme=0` à l'adresse. |
| `test-cartes.js` | tests de toutes les cartes |
| `propositions/` | la page de conception d'origine des cartes (historique) |
| `samples.js` | sons de batterie encodés en base64 (généré depuis `samples/`) |
| `samples/` | sons de Roland TR-808 d'origine et leur note d'auteur |
| `fonts/` | polices pixel |
| `three.min.js` | three.js r128 |
| `test.js` | tests de la physique |

`game.js` est un seul fichier découpé en sections repérées par `// ----------` : rendu et passe finale, outils des trois entités du décor (`tx`, `mat`, `geo`, `pose`), piste, ville, horizon, voiture et effets, état de jeu et commandes, interface, boucle.

## Tests

```bash
node test.js
```

Vérifie sur la ville la géométrie du circuit, un tour complet au pilote automatique, les performances de la voiture (0 à 100 km/h, vitesses de passage des rapports, rupteur), la glisse, la jauge de nitro (remplissage, poussée, choc, vol), l'aspiration et la course contre IA. Ses temps de référence sont figés : s'ils bougent, les records de la ville ne sont plus comparables.

```bash
node test-cartes.js
```

Passe chaque carte dans la physique : tracé sans recoupement, tour bouclé au pilote automatique, 0 à 100 km/h plausible, glisse au frein à main, trafic. Affiche longueur, temps au tour et vitesses de chaque carte.

Dans le navigateur, `?auto` fait conduire le pilote automatique, et `window.__g` expose l'état du jeu pour le débogage.

## Performances

`index.html?perf&auto` mesure toutes les cartes à la suite (une minute en tout) : le pilote automatique fait un tour en course contre 3 adversaires, à pas fixe, sans rien afficher, et chaque image est chronométrée. Le tableau sort dans la console et dans `localStorage['vpr.perf']`. Le banc est dans `outils/perf.js`, avec la référence que **toute carte doit tenir** (`BUDGET`) :

| mesure | référence | ce que c'est |
|---|---|---|
| `ms` | ≤ 2 ms | temps moyen d'une image, GPU compris |
| `msMax` | ≤ 3 ms | la même chose sur la pire demi-seconde du tour |
| `cpuMax` | ≤ 8,3 ms | la pire image isolée (à-coup) : aucune ne doit dépasser une image à 120 Hz |
| `appelsMax` | ≤ 300 | passes de dessin par image, ombres comprises (le seul chiffre qui ne dépend pas de la machine) |

Les millisecondes valent pour la machine de mesure (portable à puce graphique intégrée Intel Arc 140T, image de 480 × 270) ; sur une autre, comparer les cartes entre elles et surveiller `appelsMax`. Une carte qui sort du tableau : `sectMs` et `sectAppels` disent sur quel dixième du tracé, `piresCpu` où tombent les à-coups et s'ils viennent du rendu ou du son.

Ce qui tient ces chiffres, et qu'il ne faut pas défaire :

- **Fusion du décor fixe** (`game.js`, « fusion ») : après la construction, tous les maillages immobiles d'une même matière sont fondus en un seul. Poser mille boîtes ne coûte donc qu'une passe de dessin. Ce qui bouge ou clignote par sa visibilité doit porter `userData.dyn = 1` (lui ou un parent), sinon il serait figé : `(await import('./outils/perf.js')).mobiles()` dans la console liste les oublis.
- **Préchauffage** : la première image dessine tout le décor une fois, même hors champ, pour que shaders, géométries et textures partent au GPU pendant le chargement et non au premier passage en course.
- **Changement de carte sans rechargement** (`changeCarte` dans `game.js`) : `sim.js`, `game.js` et `rythme.js` sont rejoués, le renderer (donc ses shaders compilés) et le son restent. Tout ce que `game.js` branche sur la page passe par son `addEventListener` local, coupé d'un coup à l'arrêt ; un nouvel écouteur, minuteur ou élément de page doit être défait dans `fin()`, et toute ressource GPU hors de la scène libérée dans `libere()`.
- Pas de tableau créé à chaque image dans les boucles par goutte ou par particule (le ramasse-miettes fait des à-coups).

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
| `th.pluie` | `1` = pluie partout ; ou des zones `[point a, point b, force]` (1 = pluie normale ; au-delà, averse : plus de gouttes, traînées plus longues ; Wan-9 : averse de force 3 sur le port, rien avant la sortie du pont), coupée en tunnel. Calculée une fois par `buildTrack` (`T.pluie`, lue par le dessin et le son) |
| Surfaces | `SURF` en tête de `sim.js` : un jeu de coefficients par surface (`sec`, `mouille`, `glace`, `neige`, `terre`) : `vir` lacet perdu en courbe, `frein` et `trac` freinage et motricité, `colle` retard de la vitesse sur le nez (la voiture chasse), `vaq`/`aq`/`aqc` aquaplaning, `roul` frein de roulement, `gl` glisse qui part plus tôt. `buildTrack` en tire `T.surf[i]`, le jeu de coefficients de chaque échantillon (fondu aux bords des zones). Le pilote auto et les IA lisent la même table (virages, freinage) |
| `surf` | surface de la route : `{ fond: 'neige', zones: [[point a, point b, 'glace', force], …] }` (`fond` partout, zones par-dessus, fondues sur 20 m ; `force` de 0 à 1, 1 par défaut). Aucune des six cartes n'en déclare ; `test-cartes.js` l'essaie sur une copie du touge |
| Pluie sur la conduite | une averse est la surface `mouille` dosée par `(force − 1) / 2`, nulle en tunnel : la force 1 (la ville) ne change rien. Aquaplaning au-delà de 230 − 40·m km/h. Wan-9 : +6 % au tour |
| Pluie au son | `pluieFrame` d'`audio.js`, famille « pluie » (bouton « Pluie » d'`ecoute.html`) : rideau étouffé par la carrosserie, qui suit la force (`T.pluie`) et la vitesse, coupé en tunnel ; gerbe grave en aquaplaning (`car.aq`) |
| `trafic` | nombre de camions sur la route |
| `sauts`, `cuv` | le relief (carte Roche-Sourde) : tremplins `[point, longueur, hauteur, fosse, profondeur]` et murs roulables `[a, b, largeur, rayon]`. Déclarer l'un ou l'autre donne à la voiture une hauteur et une gravité (`GRAV`, `DROOP`, `LAND0`, `LANDK`, `LANDX` en tête de `sim.js` : pesanteur, débattement avant de « voler », seuil et pente de la perte de vitesse à la réception). Sans eux, la carte reste à plat comme avant. |

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

Les records, le fantôme et les préférences sont stockés dans le navigateur sous les clés `vpr7.*` pour la ville et `vpr7.<carte>.*` pour les autres. Quand la physique change au point de rendre les anciens temps incomparables, incrémenter ce préfixe.

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
