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

### 🏁 CINQ MODES DE JEU EXPLOSIFS !

- **CONTRE-LA-MONTRE** : enchaînez les tours, battez vos records… et rattrapez le **fantôme** de la médaille que vous visez : **bronze**, **argent**, puis **or** ! Un tour dont vous êtes fier ? Envoyez-le à un ami par un simple **lien de défi** : il affrontera votre fantôme.
- **GLISSE** : 2 tours pour le style. Plus ça glisse vite, de travers et longtemps, plus ça paie… et le **multiplicateur** grimpe tant que vous enchaînez sans toucher un mur !
- **COURSE** : 3 tours, 3 rivaux sans pitié. **KENJI**, **REI** et **JUN** ne vous feront aucun cadeau.
- **ÉLIMINATION** : 4 voitures, 4 tours. À chaque passage sur la ligne, **le dernier sort**. Jusqu'au duel final !
- **TOURNÉE** : toutes les cartes à la suite, des points à chaque manche, grille inversée… et un **trophée** au bout !

<p align="center"><img src="docs/depart.png" alt="La grille de départ"></p>

### 👥 À DEUX SUR LE MÊME ÉCRAN !

Un ami sur le canapé ? Passez la ligne **JOUEURS** du menu sur **2** : l'écran se coupe en deux, **joueur 1 en haut, joueur 2 en bas**, chacun sa caméra, son compteur, sa nitro… et son moteur dans les oreilles !

- **COURSE** : 3 tours, vous deux et les **deux rivaux les plus rapides** de la carte. L'aspiration de l'autre est à prendre !
- **ÉLIMINATION** : 4 voitures, 4 tours, le dernier sort. Éliminé ? Votre écran suit le meneur jusqu'au bout.
- **GLISSE EN DUEL** : 2 tours, vous deux seuls en piste, **le meilleur score gagne**. Un coup de portière casse l'enchaînement… des deux !

Sur l'**écran d'inscription**, chacun appuie sur un bouton de ce qu'il tient : **une manette chacun**, **un Joy-Con chacun** (tenu à l'horizontale), ou **le clavier partagé**, ZQSD d'un côté, flèches de l'autre. À l'arrivée : **REVANCHE** ! Rien n'est enregistré à deux, ni record ni trophée : c'est une partie de canapé.

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
| 👤 Joueurs | 1 ou 2, sur le même écran |
| 🖥️ Plateforme | Tout navigateur moderne |
| ⏱️ Chargement | Instantané |
| 💰 Prix | **GRATUIT** |

<p align="center"><b>DISPONIBLE DÈS MAINTENANT DANS TOUS LES BONS NAVIGATEURS.</b><br>
<sub>Le pilotage nocturne doit se pratiquer en toute sécurité, sur écran uniquement.</sub></p>

---

# Pour les développeurs

Jeu de course arcade en 3D pixelisée, seul ou à deux sur le même écran. Six cartes, chacune avec son tracé, sa voiture, sa radio, son décor et son interface ; la musique réagit à la course.

| Carte | Conduite | Voiture | Radio |
|---|---|---|---|
| Ville à plein régime | viaduc et échangeur de nuit, presque tout à fond | Nismo GT-R Z-tune | darksynth, house, breakbeat |
| Karasu-tōge | col de montagne : montée rapide, quatre épingles en descente | Mazda RX-7 Spirit R | eurobeat |
| Wan-9 | autoroute de baie à 270 km/h, boucle serrée, camions à doubler | Toyota Supra RZ | trance |
| Premier métro | rues de Paris à l'aube, relances entre des angles | Renault 5 Maxi Turbo | disco spatiale |
| Canal 6 | canal de Los Angeles au couchant, large et glissant | Dodge Viper GTS | g-funk |

Le menu principal choisit la carte, le nombre de joueurs, le mode et la boîte (haut / bas pour la ligne, gauche / droite pour la valeur, Entrée pour démarrer). Deux modes : **contre-la-montre** (tours lancés, record et fantôme par carte) et **course** (3 tours, départ en grille contre 3 IA, classement à l'arrivée). La ligne MODE du menu fait aussi défiler la difficulté de la course (détente, normal, chaud : `DIFF` dans `sim.js`). En contre-la-montre, chaque carte a ses médailles de temps, calculées sur le tour lancé du pilote automatique (`med` dans `cartes.js`). Changer de carte recharge la page ; on peut aussi la choisir par l'adresse : `?carte=touge`, `wangan`, `paris`, `canal`, `stade`, `givre`, `terre`, `ville`.

Tout tourne dans le navigateur, sans étape de build ni dépendance à installer.

## Lancer

- **Le plus simple** : double-cliquer sur `index.html`.
- **Avec un serveur local** (recommandé pour développer) :

```bash
python outils/capture.py 8123
```

(depuis la racine du dépôt ; ce serveur interdit le cache au navigateur. Avec `python -m http.server`, le navigateur peut garder un ancien `sim.js` à côté d'un `game.js` neuf, et la course plante à la fin du 3, 2, 1.)

puis ouvrir l'une de ces pages (le même serveur les sert toutes) :

| Application | Adresse | À quoi elle sert |
|---|---|---|
| **Le jeu** | http://localhost:8123/ | jouer ; `?carte=ville`, `touge`, `wangan`, `paris` ou `canal` pour choisir la carte |
| **Les sons** (banc d'écoute) | http://localhost:8123/ecoute.html | écouter chaque station, ambiance et bruitage seul, régler le mélange de course par famille, mesurer les niveaux |
| **La musique** (éditeur) | http://localhost:8123/editeur.html | modifier une station : mixage, timbres, accords, arrangement, motifs, basse et thème en piano-roll |

Les trois partagent le même moteur audio (`audio.js`). Les réglages de l'éditeur de musique sont enregistrés dans le navigateur : pour les entendre en course, ouvrir le jeu **à la même adresse** (même hôte, même port) que l'éditeur, puis recharger la page. « Exporter » dans l'éditeur donne le texte à conserver ou à inscrire dans `cartes.js`.

Autres pages d'outils : `manette.html` (diagnostic de la manette) et `styles.html` (planche des styles visuels).

## Commandes

| Touche | Action |
|---|---|
| Haut / bas, gauche / droite, Entrée | menu principal : carte, joueurs, mode, boîte, démarrer |
| ↑ ↓ ← → ou ZQSD | accélérer, freiner, tourner |
| Espace | frein à main (déclenche la glisse) |
| X ou N | nitro : dépense la jauge (gaz ouverts, roues au sol) |
| G | boîte automatique / manuelle |
| A / E | rapport inférieur / supérieur (en manuelle) |
| C | station de radio suivante |
| M | couper / remettre la musique |
| F | fantôme du contre-la-montre : bronze, argent, or, aucun, son propre record (au menu et en piste) |
| L | copier le lien de défi du dernier tour bouclé (contre-la-montre) |
| Échap ou P | menu pause (reprendre, recommencer, boîte, radio, musique, fantôme, lien de défi, quitter) |
| R | recommencer (en solo ; à deux : RECOMMENCER dans le menu de pause) |
| Manette | stick ou croix : volant et menus · ZR ou B : gaz · ZL ou Y : frein · A : glisse · X : nitro · clic du stick : radio · L / R : rapports · − : boîte manuelle / automatique · + : pause · B : valider |
| À deux, clavier de gauche | ZQSD : accélérer, freiner, tourner · Espace : frein à main · X : nitro · A / E : rapports · G : boîte automatique / manuelle |
| À deux, clavier de droite | ↑ ↓ ← → : accélérer, freiner, tourner · Maj droite : frein à main · la touche à gauche de Maj droite (« ! » en AZERTY, « / » en QWERTY) ou Entrée du pavé numérique : nitro · boîte automatique seulement |
| À deux, manettes et Joy-Con | les mêmes boutons qu'en solo, chacun pour sa voiture ; l'un ou l'autre met en pause, navigue dans les menus et change de station |
| À deux, écran d'inscription | une touche de son côté du clavier ou un bouton de sa manette : prendre une place · Échap ou + : la libérer (sans place : refermer) · Entrée ou B : partir, les deux places prises |
| I | à deux, au menu principal : rouvrir l'écran d'inscription pour changer de périphérique |
| Joy-Con seul, à l'horizontale | touche J une fois pour l'autoriser (Chrome ou Edge ; deux Joy-Con au plus, un par joueur) · stick : volant et menus · bouton de droite : gaz et valider · gauche : boîte manuelle / automatique · haut / bas : rapport supérieur / inférieur · SR : glisse · SL : nitro · Home ou Capture : radio · + ou − : pause |

### Nitro et aspiration

La jauge de nitro (en bas à droite) remplace l'ancien boost automatique de sortie de glisse. Elle se remplit :

- en tenant une glisse (plus elle dure et plus elle va vite, plus elle remplit) ;
- en frottant un mur sans le taper ;
- en doublant un camion au ras, sans le toucher ;
- en roulant dans l'aspiration d'un rival, en course (on y gagne aussi de la vitesse ; les rivaux en profitent autant).

X ou N la dépense : une jauge pleine pousse 3 secondes, gaz ouverts et roues au sol (rien en l'air), y compris au-delà du rupteur. Un choc franc contre un mur ou un camion la vide. Réglages : `NI` en tête de `sim.js`.

Les médailles se mesurent toujours au tour lancé du pilote automatique, qui part avec une jauge pleine et la dépense en ligne droite. La physique ayant changé, les records d'avant la V2 (clés `vpr6.*`) ne comptent plus : le menu le signale une fois.

### Fantôme des médailles

En contre-la-montre, un fantôme roule avec le joueur. La touche F (au menu ou en piste) ou la ligne « fantôme » du menu de pause choisit lequel : **bronze**, **argent**, **or**, aucun, ou son propre **record**. Le choix est gardé par carte (clé `vpr7.<carte>.fantome`) ; au premier lancement, c'est la première médaille pas encore gagnée. Le fantôme porte la couleur de sa médaille (cyan pour le record), sur la piste comme sur la minicarte.

- Un fantôme de médaille boucle son tour exactement au temps du seuil : le battre, c'est gagner la médaille. Le fantôme passe alors de lui-même à la médaille suivante, et après l'or au record du joueur.
- **Bronze et argent** : la trace du tour de référence des médailles (`tourRef` dans `sim.js` : le pilote automatique, jauge pleine), ralentie au ratio de la médaille (`etire`). Calculée au chargement de la carte.
- **Or** : le pilote automatique ne glisse pas, il ne sait pas faire un tour en or. Chaque carte a donc une trace de référence embarquée dans `traces-or.js`, ramenée au temps du seuil or. Faute de tours conduits à la main, ces traces viennent de la simulation : `node outils/traces-or.js` fait rouler un pilote qui glisse au frein à main et dépense sa nitro, balaie ses réglages et garde le meilleur tour lancé. Les neuf traces passent sous le seuil or ; huit sans toucher un mur, celle de `wangan` en en touchant un (aucun réglage essayé n'y passe sous l'or proprement). Pour remplacer une trace par un vrai tour, coller dans `traces-or.js` ce qui suit `#defi=` dans un lien de défi : c'est le même format.
- À relancer si la physique ou un tracé change : `node outils/traces-or.js` (ou `node outils/traces-or.js wangan` pour une seule carte). `test-cartes.js` échoue si une trace sort de la route ou n'est plus sous le seuil or.

Les médailles sont des temps de tour lancé : au premier tour, départ arrêté, le fantôme part devant.

### Défi par lien

Après un tour de contre-la-montre, la touche L (ou « copier le lien de défi » dans le menu de pause) copie dans le presse-papiers un lien qui porte ce tour. Celui qui l'ouvre arrive sur la bonne carte, en contre-la-montre, face au fantôme de l'expéditeur (en rose) : le menu affiche le temps à battre, chaque tour dit de combien le défi est manqué ou battu, et L renvoie un lien à son tour. Il n'y a pas de serveur : tout est dans l'adresse.

- Forme : `…/index.html#defi=<version>.<carte>.<données>`. Tout tient dans le fragment (après `#`), que le navigateur n'envoie jamais au serveur.
- Les données : le temps du tour, puis la position et le cap de la voiture cinq fois par seconde, quantifiés à 10 cm et à 1/256 de tour, écrits en différences (en différences secondes pour x et z : presque toujours un octet par valeur), avec deux octets de contrôle, le tout en base64 pour URL. Environ 27 caractères par seconde de tour : 1 100 pour un tour de 38 s, 2 600 pour le plus long tour plausible (`wangan` au temps de bronze, chiffre affiché par `test-cartes.js`). Certaines messageries coupent les liens de cette taille : un lien coupé est refusé, il ne donne jamais un fantôme faux.
- On transporte des positions, jamais des commandes : la simulation ne donne pas exactement le même résultat d'un navigateur à l'autre. Entre deux points, le fantôme est interpolé en ligne droite (moins d'un mètre d'écart à la trace d'origine).
- La version est celle de la physique (`DEFI_V` dans `sim.js`, la même que celle des clés de records `vpr7`) : à augmenter avec elle. Un lien d'une autre version, abîmé, tronqué, ou pour une carte inconnue est refusé avec un message au menu, et le jeu s'ouvre normalement.
- `defiCode(carte, temps, trace)` et `defiLit(lien)` sont des fonctions pures de `sim.js`, testées sous Node (aller-retour à la précision de quantification, liens tronqués à toute longueur, abîmés à tout caractère, d'une autre version). Le fantôme reçu n'est pas enregistré : il vit le temps de la page.

### Mode Glisse

Troisième mode du menu, sur toutes les cartes : deux tours, départ arrêté, à points.

- Une glisse rapporte, par seconde, sa vitesse × son angle de dérive (plafonné) × le multiplicateur.
- À la sortie d'une glisse d'au moins 0,8 s, ses points sont versés au score et le multiplicateur monte d'un cran (jusqu'à x5). Plus courte, elle ne rapporte rien.
- Un choc contre un mur ou un camion perd la glisse en cours et ramène le multiplicateur à x1 ; 3 secondes sans glisser aussi. Frotter un mur ne casse rien.
- Le score ne compte que si les deux tours sont bouclés dans le délai affiché sous le chrono : deux tours au temps de la médaille de bronze du contre-la-montre, plus 30 %.
- Une glisse encore en cours sur la ligne d'arrivée n'est pas comptée.

Le HUD montre le score, le multiplicateur, et au centre les points de la glisse en cours (en blanc tant qu'elle est trop courte pour compter). Record et médailles par carte (clé `vpr7.<carte>.glisse`).

Le score est tenu dans `sim.js` pour chaque voiture (`c.score`, `c.cours`, `c.mult`, réglages `GL`), à part de la physique : aucun temps au tour n'en dépend. Les seuils de médailles sont dans `game.js` (`GLM`, en points, par carte) : le pilote en glisse de `test-cartes.js`, qui ne glisse que pour aller vite, y fait à peu près le bronze. Une carte sans ligne dans `GLM` reçoit des seuils au mètre de piste, à régler après essais.

### Course à élimination

Variante de la course, au menu des modes (« ÉLIMINATION », aux trois difficultés). Il y a autant de tours que de voitures. Chaque fois que le meneur passe la ligne, à partir de la fin du tour 2, la voiture classée dernière sort : elle se range sur le côté, clignote et disparaît, sans plus gêner personne. Le premier tour est protégé, le dernier se joue à deux. Un bandeau rouge prévient le joueur tant qu'il est dernier. Le classement final est l'ordre inverse des sorties.

Dans `sim.js` : `newRace(T, tours, niveaux, élastique, { elim: true })` ; une voiture sortie porte `c.out` (le temps de sa sortie), et `raceOrder(R)` donne le classement.

### Tournée

Au menu des modes (« TOURNEE », aux trois difficultés) : toutes les cartes du jeu à la suite, dans l'ordre du menu, en courses de 3 tours contre les rivaux de chaque carte.

- Barème par manche : 10, 6, 3 et 1 points du premier au dernier.
- Après chaque manche, le classement général s'affiche, avec ce que la manche a rapporté et la place de départ de la suivante.
- La grille de départ est l'ordre inverse du classement général : le meneur part dernier. À égalité de points, le joueur est classé devant.
- Les rivaux changent de nom à chaque carte ; les points suivent leur rang dans la liste des rivaux de la carte (le premier nommé hérite des points du premier nommé de la carte d'avant), pas leur nom.
- La Tournée est sauvegardée après chaque manche close (une par difficulté). Quitter en cours de manche ne perd que cette manche : au menu, « REPRENDRE » la relance, depuis n'importe quelle carte. Une manche est close quand on quitte son tableau d'arrivée (Entrée ou Échap) ; fermer l'onglet avant, c'est la rejouer.
- Au bout de la dernière carte, finir sur le podium donne le trophée de la difficulté (or, argent, bronze), affiché au menu. Ni échelle ni rétrogradation.

La liste des manches est `CARTES` (`cartes.js`), lue telle quelle : une carte ajoutée entre dans la Tournée sans rien changer. Le calcul est une fonction pure de `sim.js`, `tournee(points, arrivée)`, qui rend les points, le classement et la grille ; `newRace` prend la grille par `{ grille }`. Dans `game.js`, voir « Tournée » : état dans `localStorage` sous `vpr7.tournee` (par difficulté : prochaine manche et points) et `vpr7.trophee`. On passe d'une carte à l'autre sans recharger la page ; la mémoire tenue d'une carte à l'autre se mesure avec `chaine()` de `outils/perf.js` (voir « Performances »).

### Écran partagé

Ligne « JOUEURS » du menu principal : à 2, l'écran est coupé en deux vues superposées (joueur 1 en haut), et les deux joueurs courent dans la même course. Le choix est gardé (clé `vpr7.joueurs`). Spec et tickets : `docs/SPEC-ECRAN-PARTAGE.md`.

- **Modes à deux** (`MODES2` dans `game.js`) : Course (3 tours, les deux joueurs et les deux rivaux les plus rapides de la carte : toujours quatre voitures), Élimination (les mêmes, 4 tours), Glisse en duel (2 tours, sans rival, le délai du solo pour chacun ; un choc entre les deux voitures casse l'enchaînement des deux). Ni contre-la-montre ni Tournée. Les deux joueurs partent sur les deux dernières places de la grille ; l'élastique des rivaux se règle sur la moyenne des deux. Le mode et la difficulté choisis à deux ont leurs propres clés (`vpr7.mode2`, `vpr7.diff2`) : revenir à un joueur rend le solo tel qu'on l'a laissé.
- **Inscription** : au premier départ, chaque périphérique qui appuie prend la première place libre (clavier de gauche, clavier de droite, manette, Joy-Con). Les places sont gardées pour la session (`PLACES`), changement de carte compris : une revanche ne redemande rien, et la touche I du menu rouvre l'écran. Une manette inscrite qui disparaît en course met en pause et rouvre l'inscription pour sa place ; n'importe quel périphérique libre peut la reprendre.
- **Dans la simulation** (`sim.js`) : `newRace(T, tours, niveaux, élastique, { humains: 2 })` met les humains en tête de la liste des voitures (0 = joueur 1, 1 = joueur 2), et `stepRace(R, entrées, H)` prend une entrée par humain ; une entrée absente fait conduire le pilote automatique (`?auto`, joueur arrivé). `{ delai }` est le temps limite de la Glisse en duel. À un humain, rien ne change : les temps de référence des tests sont les mêmes.
- **Les vues** (`VUES` dans `game.js`, une par joueur ; une seule en solo) : chaque vue porte sa caméra, sa cible de rendu, son canvas de HUD et tout l'état lissé « par caméra » (cap, tangage, roulis, secousse, fondus de nitro et de tunnel, régime affiché, tri des luminaires, gouttes de pluie, bandeaux). Chaque image, la simulation avance une fois ; puis `vueFrame` pose la caméra de chaque vue, règle lumière, brouillard et pluie pour sa voiture, dessine son HUD, la scène dans sa cible, et joue la passe finale dans sa moitié d'écran. Chaque vue garde la grille de 270 lignes du solo : le canvas en fait 540, avec un trait de 2 pixels entre les deux. `joueurs(n)` ajoute ou retire la deuxième vue ; `libere()` rend au GPU ce que chacune tient.
- **L'état par joueur** est dans sa vue : son périphérique (`vu.periph`), son entrée de l'image (`vu.inp`), « arrivé » (`vu.fini`), « éliminé, regarde le meneur » (`vu.spec` : la vue affiche ÉLIMINÉ 3 secondes, puis suit le meneur), ses compteurs du tour. La voiture du joueur est `race.cars[vu.n]`. Le score, la jauge de nitro et la boîte sont sur la voiture, dans `sim.js`, comme en solo.
- **Les écrans communs** (menu, inscription, pause, tableau d'arrivée, fin du duel de Glisse) sont dessinés une fois, par `ecrans()`, sur une couche plein écran posée par-dessus les deux vues (`COM`, `couche()`). Le décompte de départ reste dans chaque vue.
- **Le son** (`audio.js`) : moteur, boîte et pneus sont joués une fois par joueur (joueur 1 un peu à gauche, joueur 2 un peu à droite). La radio, l'ambiance, le tunnel et la pluie sont uniques, pilotés par le joueur le mieux placé encore en course.
- **Rien n'est enregistré à deux** : ni record, ni médaille, ni fantôme, ni trophée, ni Tournée, en lecture comme en écriture ; les touches F et L ne font rien. Seuls le nombre de joueurs, le mode et la difficulté à deux sont gardés. La boîte du joueur 1 est la préférence du solo ; celle du joueur 2 repart en automatique à chaque départ.
- **Par l'adresse** : `?joueurs=2` (ou `1`) passe devant la préférence du menu sans y toucher, et y reste d'une carte à l'autre. Avec `?auto`, les deux voitures sont conduites par le pilote automatique, sans inscription : c'est ce qui sert aux captures et au banc de mesure (`?perf&auto&joueurs=2`, voir « Performances »). Un lien de défi s'ouvre toujours en solo ; les styles de comparaison (`?style=`) restent à une vue.

Limites connues :

- **Joy-Con gauche** : sa table de boutons est déduite du format du rapport, pas essayée (seul un Joy-Con droit l'a été). S'il arrive inversé, lui donner sa table dans `hidLire` (`game.js`).
- **Clavier partagé** : beaucoup de claviers ne transmettent pas plus de trois ou quatre touches à la fois, selon leur position. C'est un dépannage ; deux manettes sont la bonne façon de jouer. Le clavier de droite n'a pas de boîte manuelle.
- **Menus à deux** : la couche commune est un canvas de la page posé sur celui du jeu. Elle ne passe pas par la passe finale : menu, pause et tableau d'arrivée n'ont à deux ni scanlines ni tramage.
- L'ombre portée d'une voiture sous les luminaires n'existe que dans la vue de son joueur ; la caméra libre à la souris ne tourne que la vue du joueur 1.

Le pilotage (ZQSD, A/E) est lu en position physique des touches, donc WASD et Q/E sur un clavier QWERTY. Les autres commandes sont lues par la lettre tapée.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | page, polices, icône, ordre de chargement des scripts |
| `icon.svg` | icône de l'app (favicon) |
| `docs/` | captures d'écran du README, spec de l'écran partagé (`SPEC-ECRAN-PARTAGE.md`) |
| `cartes.js` | **les cartes**, en données : tracé, largeur, adhérence, voiture, stations de radio, thème (couleurs, ciel, lumière, interface). Ajouter une carte commence ici. |
| `sim.js` | **physique**, sans aucun rendu : piste, moteur et boîte, glisse, murs, pilote automatique, course contre IA à un ou deux humains, trafic, traces des fantômes et liens de défi. Partagé entre le jeu et les tests. |
| `game.js` | rendu three.js, décor de la ville, effets, interface, commandes et périphériques, vues de l'écran partagé, boucle de jeu |
| `audio.js` | tout le son, synthétisé : trois stations de radio par carte (données `RADIO` dans `cartes.js`), chacune avec ses timbres (`PATCH`), sa batterie (`KIT`), ses effets et sa forme en sections ; musique de menu, ambiance du lieu par zones, tunnels, moteur, boîte, pneus, bruitages. Exposé au jeu par `window.SON`. |
| `editeur.html` | éditeur de musique : pour chaque station, mixage par partie, batterie et timbres, effets, accords, arrangement des sections, motifs, et basse et thème en piano-roll ; joue le vrai moteur, enregistre dans le navigateur (`vpr.musique`), le jeu reprend les réglages ; « Exporter » pour les inscrire dans `cartes.js` |
| `ecoute.html` | banc d'écoute : chaque station, ambiance et bruitage joué seul (amplifié pour l'écoute, vumètre, « tout arrêter »), le mélange de course avec un curseur par famille, et trois vérifications : auto-test des boutons, niveaux (RMS et crête) et variété des stations (corrélation des spectres), par rendu hors ligne |
| `textures.js` | **catalogue des textures** : l'aspect de chaque surface, aplat (`nom: 0xrrggbb`) ou dessin sur canvas. Ni forme, ni emplacement. |
| `formes.js` | **catalogue des formes** : la géométrie de chaque objet, forme simple ou assemblage de boîtes à zones nommées. Ni texture, ni emplacement. Un assemblage posé est fondu en une géométrie par zone ; `insts()` (decors.js) le pose en nombre, une passe de dessin par zone. |
| `decors.js` | **placement** des décors des autres cartes (forêt, baie, Paris, canal), une fonction par carte : où poser quelle forme avec quelle texture, par `h.pose`, `h.geo`, `h.mat`. Le placement de la piste et de la ville est dans `game.js`. |
| `rythme.js` | **essai indépendant** : les aplats lumineux du décor battent avec la grosse caisse de la radio. Pour le retirer, supprimer sa ligne dans `index.html` ; pour comparer, ajouter `&rythme=0` à l'adresse. |
| `traces-or.js` | trace de référence du fantôme or de chaque carte (produit par `outils/traces-or.js`) |
| `test-cartes.js` | tests de toutes les cartes |
| `propositions/` | la page de conception d'origine des cartes (historique) |
| `samples.js` | sons de batterie encodés en base64 (généré depuis `samples/`) |
| `samples/` | sons de Roland TR-808 d'origine et leur note d'auteur |
| `fonts/` | polices pixel |
| `three.min.js` | three.js r128 |
| `test.js` | tests de la physique |
| `outils/perf.js` | banc de mesure : performances à une et à deux vues, mémoire sur un enchaînement de cartes (voir « Performances ») |

`game.js` est un seul fichier découpé en sections repérées par `// ----------` : rendu et passe finale, outils des trois entités du décor (`tx`, `mat`, `geo`, `pose`), piste, ville, horizon, voiture et effets, état de jeu et commandes, interface, boucle.

## Tests

```bash
node test.js
```

Vérifie sur la ville la géométrie du circuit, un tour complet au pilote automatique, les performances de la voiture (0 à 100 km/h, vitesses de passage des rapports, rupteur), la glisse, la jauge de nitro (remplissage, poussée, choc, vol), l'aspiration, la course contre IA, le score du mode Glisse (une glisse rapide rapporte plus qu'une lente, l'enchaînement multiplie, un choc le casse, des zigzags lents ne rapportent rien) la course à élimination (personne ne sort au premier tour, classement = ordre inverse des sorties) et la Tournée (points et grille sur des classements donnés, départ sur la grille demandée), la course à deux humains (chacun suit sa propre entrée, entrée absente = pilote automatique, grille, élastique sur la moyenne des deux, arrivée de l'un sans arrêter l'autre, élimination, Glisse en duel et son délai, aspiration et chocs identiques à ceux d'un humain contre une IA), les traces des fantômes de médaille et les liens de défi (aller-retour, liens invalides refusés). Ses temps de référence sont figés : s'ils bougent, les records de la ville ne sont plus comparables.

```bash
node test-cartes.js
```

Passe chaque carte dans la physique : tracé sans recoupement, tour bouclé au pilote automatique, 0 à 100 km/h plausible, glisse au frein à main, trafic, trace or du fantôme (lisible, sur la route, sous le seuil or). Affiche longueur, temps au tour et vitesses de chaque carte.

Le rendu, le HUD, les commandes et le son de l'écran partagé ne sont pas testés automatiquement : à la main dans le navigateur, avec `?auto&joueurs=2` pour voir les deux vues sans manette.

Dans le navigateur, `?auto` fait conduire le pilote automatique (les deux voitures à deux joueurs), et `window.__g` expose l'état du jeu pour le débogage.

## Performances

`index.html?perf&auto` mesure toutes les cartes à la suite (une minute en tout) : le pilote automatique fait un tour en course contre 3 adversaires, à pas fixe, sans rien afficher, et chaque image est chronométrée. Le tableau sort dans la console et dans `localStorage['vpr.perf']`. Le banc est dans `outils/perf.js`, avec la référence que **toute carte doit tenir** (`BUDGET`) :

Pour la mémoire sur un enchaînement de cartes sans rechargement (Tournée) : `index.html?auto`, mode course, puis dans la console `(await import('./outils/perf.js')).chaine()`. Chaque carte est chargée à la suite de la précédente, deux fois toute la liste, et on relève les géométries, textures et shaders tenus par le GPU et le tas JS. Référence : les chiffres d'une carte sont les mêmes au second passage qu'au premier (relevé du 12/11/2026 sur 7 cartes et 3 passages : identiques, de 56 géométries et 45 textures au barrage à 267 et 159 sur le Wangan, 24 à 32 shaders ; tas JS entre 24 et 100 Mo sans tendance à la hausse).

| mesure | référence | ce que c'est |
|---|---|---|
| `ms` | ≤ 2 ms | temps moyen d'une image, GPU compris |
| `msMax` | ≤ 3 ms | la même chose sur la pire demi-seconde du tour |
| `cpuMax` | ≤ 8,3 ms | la pire image isolée (à-coup) : aucune ne doit dépasser une image à 120 Hz |
| `appelsMax` | ≤ 300 | passes de dessin par image, ombres comprises (le seul chiffre qui ne dépend pas de la machine) |

Les millisecondes valent pour la machine de mesure (portable à puce graphique intégrée Intel Arc 140T, image de 480 × 270) ; sur une autre, comparer les cartes entre elles et surveiller `appelsMax`. Une carte qui sort du tableau : `sectMs` et `sectAppels` disent sur quel dixième du tracé, `piresCpu` où tombent les à-coups et s'ils viennent du rendu ou du son.

**À deux vues** : `index.html?perf&auto&joueurs=2` refait la même mesure avec l'écran partagé, les deux vues dessinées à chaque image (les deux joueurs au pilote automatique, deux adversaires). Le tableau est le même, avec une colonne `vues`, et sort dans `localStorage['vpr.perf2']` sans toucher à celui du solo. La référence vaut **par vue** (`budget(2)` dans `outils/perf.js`) : deux fois les passes de dessin du solo, et un temps d'image qui reste sous une image à 120 Hz.

| mesure à deux vues | référence |
|---|---|
| `appelsMax` | ≤ 600 |
| `ms`, `msMax`, `cpuMax` | ≤ 8,3 ms |

Relevé du 13/11/2026 sur les huit cartes, pour le seul chiffre qui ne dépend pas de la machine : `appelsMax` va de 252 (Nuit Blanche) à 556 (Wan-9) à deux vues, pour 131 à 256 en solo. Les millisecondes à deux vues restent à relever sur la machine de mesure, fenêtre visible : à deux, l'image compte jusqu'à quatre fois les pixels du solo (deux vues, chacune deux fois plus large), c'est donc le temps du GPU (`ms`) qu'il faut regarder en premier. `chaine()` à deux, sur deux passages : mêmes géométries et textures au second passage qu'au premier.

Le banc écrit toujours le nombre de vues dans l'adresse (`joueurs=1` ou `2`) : la mesure du solo ne dépend pas de la préférence du menu. `chaine()` marche aussi à deux, depuis `index.html?auto&joueurs=2` (sa colonne `vues` dit ce qui a été mesuré).

Ce qui tient ces chiffres, et qu'il ne faut pas défaire :

- **Fusion du décor fixe** (`game.js`, « fusion ») : après la construction, tous les maillages immobiles d'une même matière sont fondus en un seul. Poser mille boîtes ne coûte donc qu'une passe de dessin. Ce qui bouge ou clignote par sa visibilité doit porter `userData.dyn = 1` (lui ou un parent), sinon il serait figé : `(await import('./outils/perf.js')).mobiles()` dans la console liste les oublis.
- **Préchauffage** : la première image dessine tout le décor une fois, même hors champ, pour que shaders, géométries et textures partent au GPU pendant le chargement et non au premier passage en course.
- **Changement de carte sans rechargement** (`changeCarte` dans `game.js`) : `lanceJeu` (tout `game.js`) puis `lanceRythme` sont rejoués sur la nouvelle carte, sans recharger de script ; `sim.js` ne lit aucune carte globale (`buildTrack(THREE, carte)` : la piste porte sa carte, `T.carte`, `T.car`, `T.kt`). Le renderer (donc ses shaders compilés) et le son restent. Tout ce que `game.js` branche sur la page passe par son `addEventListener` local, coupé d'un coup à l'arrêt ; un nouvel écouteur, minuteur ou élément de page doit être défait dans `fin()`, et toute ressource GPU hors de la scène libérée dans `libere()`.
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
| `sauts`, `cuv` | le relief (carte Grand Vacarme) : tremplins `[point, longueur, hauteur, fosse, profondeur]` et murs roulables `[a, b, largeur, rayon]`. Déclarer l'un ou l'autre donne à la voiture une hauteur et une gravité (`GRAV`, `DROOP`, `LAND0`, `LANDK`, `LANDX` en tête de `sim.js` : pesanteur, débattement avant de « voler », seuil et pente de la perte de vitesse à la réception). Sans eux, la carte reste à plat comme avant. |

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
- La lumière dynamique demande WebGL 2 (dérivées dans le shader) ; l'ombre portée sous les luminaires n'existe que pour la voiture du joueur (à deux : chacun la sienne, dans sa vue).

## Déployer

Le jeu est un site statique : il suffit de servir le dossier tel quel. Sur GitHub Pages, activer Pages sur la branche `main`, dossier racine. Sur l'offre gratuite, cela demande un dépôt public : relire d'abord la section suivante.

**En ligne** (choix « EN LIGNE » après l'accueil) : aucun serveur à nous. Les navigateurs se parlent en pair-à-pair (WebRTC, `peerjs.min.js`) ; ils se trouvent par le serveur public gratuit de PeerJS (0.peerjs.com), joint au code du salon. L'hôte crée le salon (code de 4 lettres, lien `?salon=CODE` copié), choisit la carte au menu et lance une Course ; il fait tourner la course pour tous (`reseau.js`). Sans relais TURN, certains réseaux stricts (4G, entreprise) ne se connectent pas. Le site doit être servi en HTTPS (GitHub Pages l'est) ou depuis `localhost`.

## Crédits et licences

- **three.js** r128, licence MIT.
- **PeerJS** 1.5.4, licence MIT.
- **Polices** Press Start 2P et DotGothic16, licence SIL Open Font.
- **Sons de TR-808** : enregistrés par Michael Fischer (Technopolis, 1994) et distribués gratuitement par leur auteur, sans licence formelle. Voir `samples/TR808.TXT`. À vérifier ou à remplacer avant toute diffusion commerciale.
- **Données des voitures** : fiche technique de la Nismo Skyline GT-R Z-tune (rapports de boîte, couple, puissance, masse). La forme de la courbe de couple, le Cx et les pertes de transmission sont des estimations. Les fiches des quatre autres voitures (Mazda RX-7 Spirit R, Toyota Supra RZ, Renault 5 Maxi Turbo, Dodge Viper GTS) sont saisies de mémoire, et les rapports de boîte de la Renault 5 sont estimés : à vérifier sur fiche constructeur.
- **Cartes** : tracés, décors et noms originaux, inspirés de lieux réels et de l'ambiance de films et de mangas, sans en reprendre les circuits, personnages ni visuels.
- **Musique** : compositions originales, synthétisées en direct.

Le code du jeu n'a pas encore de licence : à choisir avant de rendre le dépôt public.
