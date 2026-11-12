# Spec — Écran partagé à deux joueurs

État de départ vérifié le 12/11/2026 sur `main` (`b73df89`) : huit cartes, cinq modes, un seul joueur.

## Problem Statement

Le jeu se joue seul. On peut envoyer un fantôme à un ami par un lien de défi, mais on ne peut pas courir contre lui en même temps, sur le même écran. L'aspiration, la nitro, les chocs entre voitures et l'élimination n'ont de sens que contre quelqu'un : aujourd'hui ils ne servent que contre des IA. Deux personnes devant le même ordinateur, avec deux manettes ou une paire de Joy-Con, n'ont rien à faire ensemble.

## Solution

Une ligne « JOUEURS 1 / 2 » au menu principal. À deux, l'écran est coupé en deux vues superposées, une par joueur, chacune avec sa caméra, son interface et ses effets. Les deux joueurs courent dans la même course, avec deux rivaux IA pour compléter la grille de quatre voitures.

Trois modes à deux :

- **Course** : 3 tours, deux joueurs et deux rivaux.
- **Élimination** : 4 voitures, 4 tours, le dernier sort à chaque passage du meneur.
- **Glisse en duel** : 2 tours, deux joueurs seuls en piste, le meilleur score gagne.

Chaque joueur choisit son périphérique sur un écran d'inscription (« appuie sur un bouton pour rejoindre ») : une manette chacun, un Joy-Con chacun, ou le clavier partagé (ZQSD d'un côté, flèches de l'autre). Rien n'est enregistré : pas de record, pas de trophée, pas de fantôme. C'est une partie de canapé.

## User Stories

### Menu et inscription
1. En tant que joueur, je veux une ligne « JOUEURS » au menu principal, afin de passer à deux sans quitter le jeu.
2. En tant que joueur, je veux que le menu ne propose à deux que les modes jouables à deux, afin de ne pas tomber sur un mode qui ne marche pas.
3. En tant que joueur, je veux que le choix de la carte et de la difficulté reste le même qu'en solo, afin de ne rien réapprendre.
4. En tant que joueur, je veux un écran d'inscription où chacun appuie sur un bouton de son périphérique, afin que le jeu sache qui tient quoi sans réglage.
5. En tant que joueur, je veux voir sur l'écran d'inscription quel périphérique est pris par quel joueur, afin de vérifier avant de partir.
6. En tant que joueur, je veux pouvoir libérer ma place (Échap ou +) à l'inscription, afin de changer de périphérique.
7. En tant que joueur, je veux que la course ne parte que quand les deux places sont prises, afin que personne ne parte sans commandes.
8. En tant que joueur, je veux que le jeu se souvienne du nombre de joueurs choisi, afin de relancer une revanche d'une touche.
9. En tant que joueur, je veux que revenir à « 1 joueur » rende le jeu exactement comme avant, afin de ne rien perdre du solo.

### Commandes
10. En tant que joueur à la manette, je veux les mêmes boutons qu'en solo, afin de ne rien réapprendre.
11. En tant que propriétaire d'une paire de Joy-Con, je veux que chaque Joy-Con tenu à l'horizontale soit une manette, afin de jouer à deux sans autre matériel.
12. En tant que joueurs sans manette, nous voulons partager le clavier (ZQSD et flèches), afin de jouer quand même.
13. En tant que joueur au clavier partagé, je veux mon propre frein à main et ma propre nitro, afin d'avoir toute la conduite.
14. En tant que joueur, je veux que ma manette ne pilote que ma voiture, afin que l'autre ne puisse pas me gêner.
15. En tant que joueur à la manette, je veux garder le choix boîte manuelle ou automatique, afin de conduire comme en solo.
16. En tant que joueur, je veux être prévenu si ma manette se déconnecte, avec la course en pause, afin de ne pas perdre à cause d'une pile.
17. En tant que joueur, je veux reprendre ma place en rebranchant ma manette ou en appuyant sur un autre périphérique libre, afin de finir la course.

### Les deux vues
18. En tant que joueur, je veux ma propre vue avec ma caméra derrière ma voiture, afin de conduire comme en solo.
19. En tant que joueur, je veux que le joueur 1 soit en haut et le joueur 2 en bas, toujours, afin de savoir où regarder.
20. En tant que joueur, je veux un trait net entre les deux vues, afin de ne pas confondre les images.
21. En tant que joueur, je veux voir la voiture de l'autre dans ma vue, avec sa couleur et son étiquette, afin de le reconnaître.
22. En tant que joueur, je veux que le flou de vitesse, le grand-angle, la vignette de nitro et les secousses ne touchent que ma vue, afin de ne pas subir la conduite de l'autre.
23. En tant que joueur, je veux que mes phares, le brouillard de tunnel et la pluie soient justes dans ma vue, afin que le décor reste aussi beau qu'en solo.
24. En tant que joueur, je veux que le jeu reste fluide à deux, afin que la conduite garde sa précision.
25. En tant que joueur, je veux que le rendu rétro (pixels, tramage, scanlines) soit le même qu'en solo, afin que le jeu garde son allure.

### Interface de chaque joueur
26. En tant que joueur, je veux dans ma vue ma vitesse, mon rapport, mon compte-tours et ma jauge de nitro, afin de piloter.
27. En tant que joueur, je veux dans ma vue ma place, mon tour et le chrono, afin de savoir où j'en suis.
28. En tant que joueur, je veux une minicarte avec les deux joueurs de couleurs différentes, afin de voir l'écart.
29. En tant que joueur, je veux l'alerte de virage dans ma vue, afin d'anticiper comme en solo.
30. En tant que joueur, je veux les annonces de dépassement dans ma vue (« 2E ! »), afin de sentir la course.
31. En tant que joueur, je veux que le décompte de départ s'affiche dans les deux vues en même temps, afin que le départ soit juste.
32. En tant que joueur, je veux que le menu de pause couvre tout l'écran, afin qu'il soit clair que la course est arrêtée pour les deux.
33. En tant que joueur, je veux que l'un ou l'autre puisse mettre en pause et naviguer dans le menu, afin de ne pas dépendre de l'autre.

### Course
34. En tant que joueur, je veux partir sur la même grille que l'autre joueur et deux rivaux IA, afin que la piste soit vivante.
35. En tant que joueur, je veux que les deux joueurs partent côte à côte en fond de grille, afin que le départ soit équitable.
36. En tant que joueur, je veux profiter de l'aspiration de l'autre joueur et la lui offrir, afin de pouvoir revenir sur lui.
37. En tant que joueur, je veux que les chocs entre nos deux voitures suivent les mêmes règles que contre une IA, afin que le contact soit loyal.
38. En tant que joueur, je veux que l'élastique des IA ne favorise aucun des deux joueurs, afin que la course reste juste.
39. En tant que joueur arrivé le premier, je veux voir ma place dans ma vue pendant que l'autre finit, afin de savourer.
40. En tant que joueur encore en piste, je veux continuer à conduire quand l'autre a fini, afin de défendre ma place.
41. En tant que joueurs, nous voulons un tableau d'arrivée commun sur tout l'écran une fois les deux arrivés, avec les quatre voitures, les écarts et les meilleurs tours, afin de voir qui a gagné.
42. En tant que joueurs, nous voulons « REVANCHE » et « MENU » sur le tableau d'arrivée, afin d'enchaîner.

### Élimination
43. En tant que joueur, je veux le bandeau rouge « dernier » dans ma vue seulement, afin de savoir que c'est moi qui suis menacé.
44. En tant que joueur éliminé, je veux que ma vue l'annonce clairement puis suive le meneur, afin de regarder la fin plutôt qu'une voiture garée.
45. En tant que joueur encore en course, je veux que l'élimination de l'autre ne change rien à ma vue, afin de rester concentré.
46. En tant que joueurs, nous voulons que le classement final soit l'ordre inverse des sorties, comme en solo, afin que la règle soit la même.

### Glisse en duel
47. En tant que joueur, je veux affronter l'autre au score sur deux tours, afin de jouer pour le style.
48. En tant que joueur, je veux mon score, mon multiplicateur et ma glisse en cours dans ma vue, afin de savoir où j'en suis.
49. En tant que joueur, je veux voir le score de l'autre dans ma vue, afin de savoir si je mène.
50. En tant que joueur, je veux qu'un choc avec l'autre voiture casse mon enchaînement comme un mur, afin que le contact ait un prix pour les deux.
51. En tant que joueur, je veux que le délai des deux tours s'applique à chacun, afin que personne ne gagne en tournant sur place.
52. En tant que joueurs, nous voulons un écran de fin qui donne les deux scores et le vainqueur, afin de trancher.

### Son
53. En tant que joueur, je veux entendre mon moteur, afin de passer mes rapports à l'oreille.
54. En tant que joueurs, nous voulons une seule radio pour les deux, afin que la musique reste lisible.
55. En tant que joueurs, nous voulons que la musique suive le joueur le mieux placé, afin qu'elle s'emballe quand la course s'emballe.
56. En tant que joueur, je veux que l'un ou l'autre puisse changer de station, afin de se disputer la radio comme dans une vraie voiture.

### Ce qui ne change pas
57. En tant que joueur solo, je veux que mes records, médailles, fantômes, liens de défi et trophées ne soient jamais touchés par une partie à deux, afin de garder ce que j'ai gagné.
58. En tant que joueur, je veux qu'une partie à deux ne laisse aucune trace dans mes records, afin que mes temps restent ceux d'un tour seul.
59. En tant que développeur, je veux que `?auto` fasse conduire les deux voitures par le pilote automatique à deux joueurs, afin de mesurer et de capturer l'écran partagé sans manette.

## Implementation Decisions

### Simulation
- La course accepte plusieurs voitures conduites par des humains. La création de course prend le nombre d'humains (1 par défaut) : les humains occupent les premiers indices de la liste des voitures (0 = joueur 1, 1 = joueur 2), les rivaux IA suivent.
- Le pas de course prend une entrée par humain. Une entrée absente pour un humain veut dire « le pilote automatique conduit » (`?auto`, ou joueur arrivé), comme aujourd'hui pour le joueur seul. Passer une seule entrée ou aucune garde le comportement actuel : les appels et les tests existants ne changent pas.
- À deux, la grille compte deux rivaux IA (les deux plus rapides de la carte) : quatre voitures, comme en solo. L'Élimination garde donc ses quatre tours.
- Grille : les deux humains sur les deux dernières places, côte à côte en quinconce ; le joueur 1 à la place qu'il a en solo.
- Élastique des IA : la référence n'est plus « la voiture 0 » mais la moyenne des distances des humains encore en course. À un humain, c'est exactement la formule actuelle.
- Arrivée : chaque humain a sa propre fin (arrivé ou sorti). La course est finie quand toutes les voitures le sont, comme aujourd'hui.
- Glisse en duel : une course de 2 tours à deux humains et sans IA. Le score par voiture existe déjà dans la physique ; un choc entre voitures compte comme un choc pour l'enchaînement. Le délai (deux tours au temps de bronze plus 30 %) s'applique à chaque voiture : hors délai, score nul.
- Le trafic reste absent des courses, comme en solo.

### Vues et rendu
- L'état « par caméra » de la boucle de jeu devient un objet **vue** par joueur : cap lissé de la caméra, hauteur, tangage et roulis lissés, secousse, fondu de nitro, fondu de tunnel, régime et rapport affichés, tri des luminaires, gouttes de pluie, bandeaux et messages du HUD. En solo il y a une vue ; à deux, deux.
- Chaque image : la simulation avance une fois, puis pour chaque vue on pose la caméra, on règle les uniformes de lumière (phares, boîte d'ombre de la voiture de la vue, luminaires les plus proches de cette voiture, brouillard), on recentre la pluie, et on dessine la scène dans la cible de cette vue. Puis la passe finale est jouée une fois par vue, dans sa moitié d'écran.
- Découpe : deux vues superposées (joueur 1 en haut). Chaque vue garde la grille de 270 lignes du jeu et l'interface telle qu'elle est dessinée en solo ; l'écran entier fait donc 540 lignes à deux. La largeur de grille de chaque vue suit le rapport de sa moitié d'écran, dans les bornes du solo, la haute multipliée par le nombre de vues (360 à 960 en solo, 360 à 1920 à deux : une moitié d'écran est deux fois plus allongée que l'écran).
- Une cible de rendu et un canvas de HUD par vue ; le shader de la passe finale ne change pas (son centre de flou et sa vignette restent relatifs à la vue). Un trait de 2 pixels sépare les vues.
- Une couche plein écran, dessinée par-dessus les deux vues, porte ce qui est commun : inscription, pause, tableau d'arrivée, écran de fin de Glisse. Le décompte de départ reste dans chaque vue.
- La voiture du joueur 2 réutilise un modèle d'adversaire avec sa propre livrée ; son ombre portée sous les luminaires n'existe que dans sa propre vue (limite déjà connue : l'ombre ne vaut que pour la voiture de la vue).
- Les effets attachés à une voiture (étincelles, fumée, poussière de réception, feux stop, néon) sont émis pour les deux voitures humaines et visibles dans les deux vues.
- Joueur éliminé : sa vue affiche « ÉLIMINÉ » 3 secondes puis suit le meneur de la course.
- Les styles visuels de comparaison (`?style=`) ne sont pas portés à deux joueurs.
- Tout ce que l'écran partagé ajoute à la page ou au GPU (cibles, canvas, écouteurs) est défait par les mêmes chemins d'arrêt et de libération que le reste, pour que le changement de carte sans rechargement tienne.

### Commandes
- Les entrées de conduite deviennent une fonction d'un **périphérique** : clavier gauche (ZQSD, Espace, X), clavier droit (flèches, Maj droite, Entrée du pavé ou touche voisine à fixer à l'essai), manette n, Joy-Con n. En solo, le joueur garde tout le clavier et la dernière manette active, comme aujourd'hui.
- Inscription : le premier périphérique qui appuie prend la place 1, le suivant la place 2. Les places sont gardées pour la session.
- La lecture directe des Joy-Con (WebHID) accepte deux Joy-Con au lieu d'un.
- Boîte : par joueur. Manette et Joy-Con gardent leurs boutons de rapports ; le clavier gauche garde A / E ; le clavier droit est en automatique.
- Menus et pause : n'importe quel périphérique inscrit navigue ; les boutons continuent de rejouer les touches du clavier, sans menu dédoublé.
- Déconnexion d'une manette inscrite en course : pause automatique et message ; la place est reprise par le prochain périphérique libre qui appuie.

### Son
- La radio, l'ambiance et les annonces restent uniques. La musique adaptative est pilotée par l'humain le mieux placé encore en course.
- Le moteur, la boîte et les pneus sont joués une fois par joueur (joueur 1 légèrement à gauche, joueur 2 à droite). Le son prend donc la liste des voitures humaines au lieu d'une seule.
- Tunnel et pluie au son : ceux du joueur le mieux placé.

### Menu et sauvegarde
- Ligne « JOUEURS 1 / 2 » au menu principal ; le choix est gardé dans les préférences du navigateur. À deux, la ligne MODE ne fait défiler que Course, Élimination et Glisse, aux mêmes difficultés pour les deux premiers.
- À deux joueurs, rien n'est lu ni écrit dans les records, médailles, fantômes, trophées et Tournée. La touche de fantôme et le lien de défi sont inactifs.
- Le préfixe des clés de records ne change pas : la physique d'un tour seul est inchangée.

### Performances
- La référence du banc de mesure vaut **par vue** : à deux, une image compte jusqu'à deux fois les passes de dessin du solo. Le banc gagne une mesure à deux vues (`?perf&auto` à deux joueurs) ; sa référence est le double des chiffres du solo en passes de dessin, et le temps d'image doit rester sous une image à 120 Hz sur la machine de mesure.

## Testing Decisions

Un bon test vérifie ce qu'on observe de l'extérieur (positions, places, temps, scores, ordre d'arrivée) pour des entrées données, sans regarder comment la course est tenue en mémoire. Il doit rester vrai si on réécrit l'intérieur.

Une seule couture : **la course de la simulation** (création de course et pas de course), sous Node, à côté des tests de course existants (chocs entre voitures, aspiration, élimination, Tournée, grille demandée), qui servent de modèle.

À couvrir :

- Deux humains : chaque voiture suit sa propre entrée (l'un accélère, l'autre freine : seul le premier avance) ; aucune des deux n'est conduite par l'IA tant qu'elle reçoit une entrée.
- Une entrée absente pour un humain : le pilote automatique conduit cette voiture et boucle la course.
- Compatibilité : avec un seul humain, les temps de référence figés de la ville ne bougent pas (les tests existants passent sans modification).
- Grille à deux : quatre voitures, les deux humains sur les deux dernières places, sans chevauchement.
- Élastique : deux humains à égale distance de part et d'autre d'une IA ne changent pas son rythme ; un seul humain donne la formule actuelle.
- Arrivée : un humain arrivé ne termine pas la course tant que l'autre roule ; le classement final range les deux humains selon leur temps.
- Élimination à deux humains : personne ne sort au premier tour, un humain classé dernier sort au passage du meneur, classement = ordre inverse des sorties.
- Glisse en duel : deux scores indépendants ; un choc entre les deux voitures casse l'enchaînement des deux ; hors délai, score nul.
- Aspiration et chocs entre deux humains : mêmes résultats qu'entre un humain et une IA placés de la même façon.

Le rendu, le HUD, les commandes et le son ne sont pas testés automatiquement, comme dans la V2 : vérification à la main dans le navigateur (deux manettes, deux Joy-Con, clavier partagé), `?auto` à deux joueurs pour les captures, et le banc de mesure pour les performances et la mémoire sur un enchaînement de cartes.

## Out of Scope

- Tournée à deux joueurs (points, grille inversée, sauvegarde et trophée à deux) : la suite naturelle, à spécifier à part.
- Contre-la-montre à deux (les liens de défi couvrent ce besoin).
- Trois ou quatre joueurs.
- Jeu en ligne, en temps réel ou non, et classements.
- Découpe côte à côte, ou choix de la découpe par le joueur.
- Records, médailles, statistiques ou trophées propres au jeu à deux.
- Choix d'une voiture ou d'une livrée par joueur ; handicap entre joueurs.
- Trafic en course.
- Volant progressif au Joy-Con (stick en tout-ou-rien aujourd'hui) et révision du braquage.
- Écrans tactiles et mobiles.

## Further Notes

### Ordre de construction conseillé
1. Simulation à deux humains, avec ses tests (rien de visible).
2. Objet « vue » en solo : même image qu'aujourd'hui, une seule vue. C'est le gros du travail de rendu, et il se vérifie par comparaison de captures avant / après.
3. Deuxième vue, découpe de l'écran, HUD par vue.
4. Périphériques et inscription.
5. Modes à deux, écrans communs, son.
6. Mesure des performances, README.

### Tickets

Branche d'intégration : `claude/ecran-partage`. Un ticket est clos quand sa branche y est fusionnée.

| Ticket | Contenu | Bloqué par |
|---|---|---|
| T1 | Simulation : course à plusieurs humains (création, pas de course, grille, élastique, arrivée, Glisse en duel) et ses tests | — |
| T2 | Objet « vue » en solo : tout l'état par caméra, la cible de rendu et le canvas du HUD passent dans une vue ; image inchangée | — |
| T3 | Périphériques : entrées de conduite par périphérique (clavier entier, gauche, droit, manette n, Joy-Con n), deux Joy-Con en lecture directe ; solo inchangé, aucun écran | — |
| T4 | Deuxième vue : découpe haut / bas, passe finale et HUD par vue, trait de séparation, couche plein écran commune, `?auto` à deux | T1, T2 |
| T5 | Ligne JOUEURS du menu, inscription, modes à deux (Course, Élimination, Glisse en duel), écrans communs, vue du joueur éliminé, déconnexion, rien d'enregistré | T3, T4 |
| T6 | Son : moteur, boîte et pneus par joueur, radio pilotée par l'humain le mieux placé | T4 |
| T7 | Banc de mesure à deux vues, README | T5, T6 |

### Risques
- **L'état par caméra est dispersé dans la boucle de jeu.** L'étape 2 touche beaucoup de lignes ; la faire seule, sans changement visible, limite le risque.
- **Coût du rendu.** Deux vues de 270 lignes, c'est jusqu'à quatre fois les pixels du solo et deux fois les passes de dessin, ombres comprises. La marge mesurée en solo (2 ms par image) le permet sur le papier ; à mesurer tôt, à l'étape 3.
- **Lisibilité du HUD.** À 540 lignes, un pixel du jeu est deux fois plus petit à l'écran qu'en solo. Si l'interface devient trop fine sur un petit écran, le repli est de dessiner chaque vue à 135 lignes avec un HUD réduit : à trancher à l'essai, pas avant.
- **Le son du moteur est une seule voix.** Le rendre instanciable n'a pas été étudié dans le détail. Repli : un seul moteur, celui du joueur le mieux placé.
- **Deux Joy-Con.** La lecture directe n'a été essayée qu'avec un Joy-Con droit ; le gauche couché a ses boutons inversés, déduits du format du rapport et non constatés.
- **Clavier partagé.** Beaucoup de claviers ne transmettent pas plus de trois ou quatre touches à la fois selon leur position : le clavier partagé est un dépannage, pas la façon conseillée de jouer.
