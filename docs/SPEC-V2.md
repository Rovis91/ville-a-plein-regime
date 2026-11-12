# Spec V2 — Ville à plein régime

État de départ vérifié le 12/11/2026 : `main` a une carte et est en retard de 111 commits sur `claude/perf`, qui contient les six cartes, la pluie physique, le trafic, les médailles, la difficulté et **le relief (hauteur, gravité, sauts, murs roulables)**. La V2 part de `claude/perf`.

## Problem Statement

Le jeu se conduit bien mais on en fait vite le tour. Le boost de sortie de glisse se déclenche tout seul, donc il n'y a aucune décision à prendre. En course, le peloton s'étire et il ne se passe plus rien après le premier tour. Il n'y a que deux modes, aucun enchaînement de cartes, et rien pour se mesurer à un ami. Les six cartes sont toutes sur bitume : aucune ne change vraiment la façon de conduire, et une seule utilise le relief.

## Solution

Une V2 en deux volets.

**Cinq mécaniques**

1. **Nitro et aspiration.** Une jauge au HUD remplace le boost automatique. Elle se remplit en glissant, en frôlant un mur ou un camion, et en roulant dans l'aspiration d'un rival. Le joueur la déclenche avec une touche.
2. **Mode Glisse.** Un troisième mode à points, sur deux tours, avec multiplicateur d'enchaînement.
3. **Fantôme des médailles et défi par lien.** En contre-la-montre, le fantôme de la médaille visée roule devant le joueur. Un lien permet d'envoyer son propre fantôme à un ami.
4. **Tournée.** Toutes les cartes à la suite, avec un barème de points et un trophée.
5. **Course à élimination.** À chaque passage de ligne, le dernier sort.

**Trois cartes** (noms de travail)

- **Givre** : route de montagne gelée, plaques de glace et neige tassée. On conduit en anticipant, tout se joue sur le transfert de charge.
- **Terre** : spéciale de rallye sur terre battue, étroite, bosselée, avec des sauts de crête. La voiture glisse en permanence.
- **Stade** : arène couverte, gros tremplins, virages relevés en quart de tube, foule et projecteurs. Dessin original, dans l'esprit des circuits de stade à sauts.

## User Stories

### Nitro et aspiration
1. En tant que joueur, je veux voir une jauge de nitro au HUD, afin de savoir ce que j'ai en réserve.
2. En tant que joueur, je veux que tenir une glisse remplisse la jauge, afin que le risque pris soit récompensé.
3. En tant que joueur, je veux que frôler un mur sans le taper remplisse la jauge, afin d'être poussé à serrer les trajectoires.
4. En tant que joueur, je veux que frôler un camion du trafic remplisse la jauge, afin que le trafic devienne une occasion et pas seulement un obstacle.
5. En tant que joueur, je veux que rouler juste derrière un rival me donne de la vitesse et de la nitro, afin de pouvoir revenir sur lui et le doubler.
6. En tant que joueur, je veux déclencher la nitro avec une touche (clavier et manette), afin de choisir où je la dépense.
7. En tant que joueur, je veux qu'un choc franc contre un mur me fasse perdre de la nitro, afin que la jauge ait un prix.
8. En tant que joueur, je veux un retour visuel et sonore quand la nitro part, afin de sentir l'accélération.
9. En tant que joueur, je veux que les rivaux profitent aussi de l'aspiration, afin que la course reste groupée jusqu'au dernier tour.
10. En tant que joueur, je veux que les médailles restent difficiles avec la nitro, afin qu'elles gardent leur valeur.
11. En tant que joueur, je veux être prévenu que mes anciens records ne comptent plus, afin de ne pas croire à un bug.

### Mode Glisse
12. En tant que joueur, je veux choisir « Glisse » dans le menu des modes, afin de jouer pour le style plutôt que pour le chrono.
13. En tant que joueur, je veux marquer des points en proportion de la vitesse, de l'angle et de la durée de ma glisse, afin que les belles glisses rapportent plus que les zigzags lents.
14. En tant que joueur, je veux un multiplicateur qui monte quand j'enchaîne les glisses, afin d'avoir envie de lier les virages.
15. En tant que joueur, je veux que toucher un mur casse mon enchaînement, afin que la prise de risque ait un prix.
16. En tant que joueur, je veux voir mon score, mon multiplicateur et les points de la glisse en cours, afin de savoir où j'en suis.
17. En tant que joueur, je veux un record de score et des médailles par carte, afin d'avoir un objectif.
18. En tant que joueur, je veux que mon score ne compte que si je boucle les deux tours dans un temps raisonnable, afin que personne ne gagne en tournant sur place.

### Fantôme des médailles et défi par lien
19. En tant que joueur, je veux choisir la médaille que je vise en contre-la-montre, afin de voir son fantôme rouler.
20. En tant que joueur, je veux que le fantôme soit teinté bronze, argent ou or, afin de le reconnaître d'un coup d'œil.
21. En tant que joueur, je veux que le fantôme passe à la médaille suivante quand j'en bats une, afin d'avoir toujours quelqu'un devant moi.
22. En tant que joueur, je veux garder le choix de courir contre mon propre meilleur tour, afin de ne rien perdre de ce qui existe.
23. En tant que joueur, je veux copier un lien de défi après un tour, afin de l'envoyer à un ami.
24. En tant qu'ami qui reçoit un lien, je veux arriver directement sur la bonne carte face au fantôme de l'expéditeur, afin de jouer sans rien régler.
25. En tant qu'ami qui reçoit un lien, je veux voir le temps à battre et savoir si je l'ai battu, afin de pouvoir répondre par un lien à mon tour.
26. En tant que joueur, je veux un message clair si un lien est abîmé ou vient d'une ancienne version, afin de ne pas rester devant un écran vide.

### Tournée
27. En tant que joueur, je veux lancer une Tournée qui enchaîne toutes les cartes, afin d'avoir une partie longue avec un enjeu.
28. En tant que joueur, je veux marquer des points selon ma place à chaque manche, afin qu'une mauvaise manche ne ruine pas tout.
29. En tant que joueur, je veux voir le classement général entre deux manches, afin de savoir ce qu'il me faut à la suivante.
30. En tant que joueur, je veux partir sur une grille inversée par rapport au classement général, afin que le meneur ait à remonter.
31. En tant que joueur, je veux pouvoir quitter et reprendre ma Tournée plus tard, afin de ne pas devoir tout faire d'une traite.
32. En tant que joueur, je veux un trophée par difficulté affiché au menu, afin de garder une trace de mes victoires.
33. En tant que joueur, je veux retrouver les rivaux propres à chaque carte, afin que chaque manche ait son caractère.

### Course à élimination
34. En tant que joueur, je veux une variante « Élimination » du mode course, afin de jouer une course plus tendue.
35. En tant que joueur, je veux être prévenu clairement quand je suis dernier, afin de savoir que je dois doubler avant la ligne.
36. En tant que joueur, je veux que le premier tour soit protégé, afin de ne pas sauter alors que je pars dernier.
37. En tant que joueur, je veux voir la voiture éliminée se ranger, afin de comprendre ce qui vient de se passer.
38. En tant que joueur, je veux un duel final à deux, afin que la course se termine sur un vrai face-à-face.

### Nouvelles cartes
39. En tant que joueur, je veux une carte Givre où la voiture tient mal et tarde à répondre, afin d'apprendre une conduite d'anticipation.
40. En tant que joueur, je veux distinguer à l'œil la glace vive de la neige tassée, afin de choisir ma trajectoire.
41. En tant que joueur, je veux une carte Terre où la voiture glisse facilement et se rattrape bien, afin de conduire en travers d'un bout à l'autre.
42. En tant que joueur, je veux des sauts de crête et de la poussière sur la carte Terre, afin de retrouver l'ambiance d'une spéciale de rallye.
43. En tant que joueur, je veux une carte Stade avec de gros tremplins et des virages relevés, afin d'avoir une carte spectaculaire et aérienne.
44. En tant que joueur, je veux qu'un saut raté me coûte du temps sans me bloquer, afin de ne jamais devoir recommencer la course.
45. En tant que joueur, je veux que chaque nouvelle carte ait sa voiture, sa radio, ses rivaux et ses médailles, afin qu'elle soit au niveau des six premières.
46. En tant que joueur, je veux que les nouvelles cartes marchent dans tous les modes, afin de ne pas avoir de carte de seconde zone.
47. En tant que joueur, je veux que le jeu reste fluide sur les nouvelles cartes, afin que les sauts et la neige ne coûtent pas d'images.

## Implementation Decisions

### Socle
- **Fusionner `claude/perf` dans `main` avant tout.** `main` a du travail non commité (musique sortie du jeu, éditeur) et il existe une branche d'éditeur de musique : les concilier pendant cette fusion.
- **Une seule remise à zéro des records.** La nitro et les surfaces changent la physique. Elles sont livrées ensemble et la clé de stockage des records change une fois. Aucune autre étape de la V2 ne touche à la physique des cartes existantes.

### Nitro et aspiration
- La jauge est un état de la voiture dans la simulation. Elle remplace le boost automatique : la glisse tenue remplit la jauge au lieu de donner un boost à la sortie.
- Sources de remplissage : glisse tenue (durée et vitesse), frôlement d'un mur (le contact qui gratte sans perte de vitesse existe déjà), frôlement d'un camion, aspiration.
- L'aspiration est calculée dans la simulation de course : cône derrière une voiture, traînée réduite et jauge qui monte. Elle vaut pour toutes les voitures, IA comprises.
- La commande d'entrée gagne un champ « nitro ». Pas de nitro en l'air (moteur déjà coupé en vol).
- Le pilote automatique dépense sa nitro en ligne droite. Les seuils de médailles étant des ratios de son tour, ils se recalent d'eux-mêmes.
- Un choc franc vide la jauge. Jauge continue, pas de crans (tranché : le plus simple à lire et à coder).

### Surfaces (glace, terre)
- Généraliser les zones de pluie en **zones de surface**. Une carte déclare des tronçons avec un type (mouillé, glace, neige, terre) ; chaque type est un jeu de coefficients du modèle existant (lacet, freinage, motricité, retard du nez). Pas de second mécanisme.
- Glace : très peu de lacet et de freinage, nez très en retard. Neige tassée : entre le sec et la glace.
- Terre : motricité réduite, glisse qui se déclenche plus tôt et se rattrape mieux, léger frein de roulement.
- Le pilote automatique lit déjà l'adhérence locale pour ses vitesses de virage : il passe par la même table.

### Cartes
- Chaque carte suit le format des six existantes : tracé avec altitudes, largeur, adhérence, secteurs, voiture, radio, rivaux, médailles, thème, formes et textures propres. Suivre la méthode de décor du dépôt.
- **Stade : aucun nouveau système de gravité.** La carte déclare ses tremplins (avec fosses) et ses murs roulables avec les champs que Roche-Sourde utilise déjà. Tracé sans croisement (voir Hors périmètre).
- Terre : sauts de crête par les mêmes tremplins, en version basse et longue.
- Givre : pas de relief actif. Tronçons de glace vive aux endroits à l'ombre, neige tassée ailleurs.
- Particules : la neige et la poussière réutilisent le système de pluie et d'étincelles.

### Mode Glisse
- Le score se calcule dans la simulation, à partir de l'angle de dérive, de la vitesse et de la durée, hors de la physique : il ne change aucun temps au tour.
- Points par seconde = vitesse × angle (plafonné) × multiplicateur. Le multiplicateur monte à chaque glisse validée et retombe à 1 au choc contre un mur ou après quelques secondes sans glisse.
- Score valide seulement si les deux tours sont bouclés sous le temps bronze du contre-la-montre multiplié par une marge.
- Ouvert sur toutes les cartes. Les seuils de médailles sont fixés à la main par carte après essais.

### Fantôme des médailles
- Le fantôme existant est une suite de positions à cadence fixe : on garde ce format.
- Bronze et argent : trace du pilote automatique ralentie au ratio de la médaille. Or : une trace de référence enregistrée par carte et embarquée dans les données de la carte, car le pilote automatique ne glisse pas.
- Les traces sont régénérées une fois la physique figée.

### Défi par lien
- Le lien porte dans son fragment (après `#`, donc jamais envoyé à un serveur) : version, carte, temps, positions quantifiées à 5 Hz, compressées et encodées en base64 pour URL.
- On transporte des positions, pas des commandes : la simulation ne donne pas exactement le même résultat d'un navigateur à l'autre.
- Un lien d'une autre version de la physique est refusé avec un message.

### Tournée
- Une Tournée est une liste ordonnée de courses de 3 tours sur toutes les cartes. Barème 10 / 6 / 3 / 1.
- État sauvegardé entre deux manches (manche en cours, points, difficulté) dans le stockage local.
- Grille de départ : ordre inverse du classement général.
- Rivaux locaux de chaque carte conservés ; les points sont attribués par position sur la grille, pas par nom. Pas d'échelle ni de rétrogradation.
- Utilise le changement de carte sans rechargement déjà présent.

### Élimination
- Variante de la course : à chaque passage de ligne du meneur à partir de la fin du tour 2, la voiture classée dernière est retirée. Nombre de tours = nombre de voitures.
- La voiture éliminée continue au ralenti hors trajectoire puis disparaît ; elle ne gêne plus.

## Testing Decisions

- **Un seul point de test : l'interface publique de la simulation**, exécutée sous Node, comme aujourd'hui. On y fait rouler des voitures et on vérifie ce qu'on observe (temps, positions, classement, jauge, score), jamais les variables internes.
- **Cartes** : le test existant fait passer chaque carte dans la vraie physique (tracé valide, tour bouclé au pilote automatique sans taper, un vol par tremplin, aucune réception dure). Les trois nouvelles cartes y passent sans rien ajouter.
- **Nitro** : une glisse tenue remplit la jauge ; la déclencher fait gagner du temps sur une ligne droite ; un choc la vide ; pas d'effet en l'air.
- **Aspiration** : deux voitures identiques en ligne, celle de derrière rattrape ; à côté, non.
- **Surfaces** : sur glace, la distance de freinage et le rayon de virage à vitesse donnée sont nettement plus grands que sur le sec ; le pilote automatique boucle quand même sans taper.
- **Glisse** : une glisse rapide rapporte plus qu'une lente ; un choc remet le multiplicateur à 1 ; des zigzags à basse vitesse rapportent presque rien.
- **Élimination** : à 4 voitures, le classement final est l'ordre inverse des éliminations ; personne ne sort au premier tour.
- **Tournée** : fonction pure de calcul des points et de la grille, testée sur des classements donnés.
- **Lien de défi** : encoder puis décoder rend la même trace à la précision de quantification ; un lien tronqué ou d'une autre version est refusé sans erreur.
- **Non-régression** : les tests de la ville (mécanique, murs, boîte, chocs) restent verts ; seuls ceux qui vérifient le boost automatique sont réécrits pour la jauge.
- Le rendu, le HUD et le son ne sont pas testés automatiquement : vérification à la main dans le navigateur et avec le banc de mesure de performances existant.

## Out of Scope

- Multijoueur en temps réel et classements en ligne (aucun serveur).
- Conditions par carte et météo par tour, défi du jour, carnet de pilote : repoussés à une V2.1.
- Sens inverse, éditeur de circuit jouable, événements du monde par carte.
- Pistes qui se croisent en pont ou en huit : le format de tracé et ses tests supposent une piste qui ne se recoupe pas en plan.
- Monter sur les toits à Paris.
- Révision du braquage des véhicules existants (listée dans les tâches à faire) : à traiter à part, mais **avant** la remise à zéro des records si on veut n'en faire qu'une.

## Further Notes

### Calendrier

Durées en jours de travail, à titre d'ordre de grandeur. Les cartes peuvent avancer en parallèle dans des branches séparées, comme les précédentes.

| Étape | Contenu | Durée | Dépend de |
|---|---|---|---|
| 0 | Fusion de `claude/perf` dans `main`, reprise du travail en cours sur la musique | 0,5 | — |
| 1 | Nitro et aspiration | 2 | 0 |
| 2 | Surfaces glace et terre dans la simulation | 1 | 0 |
| — | **Physique figée, records remis à zéro** | — | 1, 2 |
| 3 | Course à élimination | 0,5 | 1 |
| 4 | Mode Glisse | 1,5 | 1 |
| 5 | Carte Stade | 2,5 | 0 |
| 6 | Carte Givre | 2,5 | 2 |
| 7 | Carte Terre | 2,5 | 2 |
| 8 | Fantôme des médailles (traces or des 9 cartes) | 1 | physique figée, 5 à 7 |
| 9 | Tournée | 1,5 | 5 à 7 |
| 10 | Défi par lien | 1 | 8 |

Total : environ 17 jours. Les étapes 5 à 7 sont indépendantes entre elles et de 3 et 4.

### Risques
- **Stade** : c'est la carte la plus chère en décor (gradins, foule, structure couverte) et celle où les performances sont le plus à surveiller.
- **Nitro et sauts** : arriver trop vite sur un tremplin peut faire rater la réception. À régler sur Roche-Sourde et Stade.
- **Glace** : une adhérence trop basse rend la carte pénible plutôt que technique. Régler d'abord sur une copie du touge avant de dessiner la carte.
- **Lien de défi** : environ 2,5 Ko, certaines messageries le tronquent.
- **Enchaînement de 9 cartes** en Tournée : mémoire à mesurer avec le banc existant.
