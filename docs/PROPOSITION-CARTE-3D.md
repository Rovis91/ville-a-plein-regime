# Proposition : une carte « 3D » (sauts, wall-ride, toits de Paris)

Proposition seulement, aucun code. Lu : `sim.js` (relief, lignes 56-69, 87-95, 248-258), `cartes.js` (format, cartes `barrage`, `stade`, `paris`), `game.js` (parois, assiette, caméra), `test.js` et `test-cartes.js`.

## Ce qui existe déjà

Le relief est actif sur toute carte qui déclare `sauts` ou `cuv` (`barrage` et `stade` aujourd'hui).

- **Hauteur et gravité** : la voiture a `c.y` et `c.vy`, tombe à 9,81 m/s², vole dès qu'elle est à plus de 10 cm du sol. En vol : ni volant, ni moteur, ni frein, ni nitro. La réception coûte de la vitesse au-delà de 6 m/s d'impact, rien dans une descente.
- **Rampes** : `HGT` donne l'altitude de chaque point du tracé, la pente lance la voiture. `sauts: [[point, longueur, hauteur, fosse, profondeur]]` ajoute un tremplin, et derrière une fosse dont on ressort par 16 m de rampe.
- **Mur roulable** : `cuv: [[a, b, largeur, rayon]]` pose un quart de tube des deux côtés du plat. La vitesse y plaque la voiture, la gravité la fait redescendre quand elle ralentit. Au barrage (rayon 9 m) on monte à 7 m, pente plafonnée à 78°, et le mur est plus rapide que la corde.
- **Autour** : la caméra suit le sol, monte en vol et penche sur la paroi ; la voiture prend tangage et roulis ; deux voitures à plus de 1,5 m d'écart en hauteur ne se touchent pas ; les tests vérifient chute libre, vols comptés, voiture jamais sous le sol.

Donc sauts, rampes, gravité et wall-ride **sur des zones prévues** sont faits. Une nouvelle carte peut s'en servir sans toucher à `sim.js`.

## Ce qui manque vraiment

Le sol est une seule hauteur par endroit de la route : `y = sol(point du tracé, écart au centre)`. La vitesse reste en plan (`vx`, `vz`), la hauteur s'en déduit. Tout ce qui manque vient de là.

| Besoin | Ce qui bloque |
|---|---|
| Wall-ride sur un mur vertical (façade) | Pente plafonnée à 78° : au-delà la physique en plan devient fausse (la montée ne coûte pas de vitesse). |
| Wall-ride libre, sur n'importe quel mur | Un mur ordinaire est une ligne (`|d| = w`) qui arrête la voiture, pas une surface. Seules les zones `cuv` sont roulables, toujours des deux côtés. |
| Sauter depuis le mur | Interdit exprès (« sur une paroi on ne décolle pas »). Le haut du tube est une glissière. |
| Monter sur les toits à côté de la rue | Pas de terrasse latérale : le mur est le même quelle que soit la hauteur de la voiture. Il faut une hauteur par bande latérale et un mur qui n'arrête que ce qui est plus bas que lui. |
| Choisir entre la rue et les toits | Le tracé est une seule boucle, la progression est un indice dessus. Une fourche demande un graphe de pistes. |
| Passer au-dessus de la route, looping | Impossible avec une hauteur unique par endroit. |
| Tomber de 20 m entre deux immeubles | La fosse sort par 16 m de rampe : crédible jusqu'à 5-6 m. Plus profond, il faut une remise en piste. |
| Pilote automatique | Il reste sur le plat (`s.pl - 3,2 m`) : les rivaux ne prennent ni mur ni toit latéral. |
| Caméra | Bonne pour l'existant. À revoir pour un mur proche de la verticale et pour un toit latéral (ne pas regarder la façade). |
| Tests | Rien pour les terrasses, le décollage d'un mur, la remise en piste. Les huit cartes doivent rester identiques. |

## Trois façons de faire

**A. Nouvelle carte avec le relief actuel.** Le circuit lui-même monte sur les toits par une rampe (`HGT`), saute d'immeuble en immeuble (`sauts` avec fosse = cour ou toit plus bas, 5-6 m), prend des virages relevés (`cuv`) sur des verrières ou des murs pignons, redescend dans la rue.
- Coût : une carte dans `cartes.js`, son décor (c'est l'essentiel du travail, voir `METHODE-DECOR.md`), `camH` à régler. Zéro ligne dans `sim.js`.
- Casse : rien.
- Limites : toits obligatoires (pas de choix), pas de mur vertical, pas de saut depuis le mur, rivaux sur le plat.

**B. Étendre le relief, toujours en 2,5D.** Trois ajouts indépendants, chacun optionnel par un champ de carte :
1. terrasses latérales : `toits: [[a, b, côté, hauteur, largeur]]`, une bande à côté de la rue avec rampe d'accès, le mur n'arrête que la voiture qui est plus bas ; tomber du toit = vol normal ;
2. décoller du haut d'une paroi, et `cuv` d'un seul côté ;
3. remise en piste après une chute profonde.
- Coût : `sol()`, le test de mur et `pente()` dans `sim.js` ; maillage des bandes et caméra dans `game.js` ; nouveaux tests. Plusieurs jours, plus la carte et son décor.
- Casse : rien si les champs sont absents (à prouver : sorties de `test-cartes.js` identiques sur les huit cartes). Risque de conflit avec le réglage du braquage en cours dans `sim.js` : à faire après.
- Limites : mur vertical toujours triché, pas de passage superposé, rivaux en bas sauf travail en plus sur le pilote.

**C. Vraie 3D.** Voiture à six degrés de liberté, collision contre des surfaces quelconques : wall-ride libre, loopings, routes superposées, fourches.
- Coût : réécrire `step`, `mur`, le pilote automatique, la caméra, les chocs, le trafic, et presque tous les tests. Des semaines.
- Casse : toute la conduite est calibrée en plan (glisse, rayons, temps au tour des huit cartes) ; tout serait à re-régler.

## Recommandation

**A d'abord, sur une nouvelle carte « Toits de Paris »** qui réutilise `formes-paris.js` et `textures-paris.js` (décor moins cher) et laisse la carte `paris` intacte : elle est calibrée, avec sa place et son tunnel. On y joue, puis **B.1 et B.2 seulement si le choix rue / toit ou le saut depuis le mur manquent vraiment**. Pas de C : ce qu'il apporte en plus (looping, mur vertical libre) ne vaut pas de recalibrer le jeu.

## Questions au joueur

1. Nouvelle carte, ou extension de la carte `paris` existante ?
2. Les toits : passage obligé du circuit (A), ou voie au choix à côté de la rue (B.1) ?
3. Wall-ride sur des zones prévues (existe) ou sur n'importe quel mur ? Le virage relevé à 78° suffit-il, ou faut-il la façade verticale ?
4. Faut-il pouvoir sauter depuis le mur (B.2) ?
5. Saut raté : on ressort par une rampe en perdant du temps (actuel), ou on tombe de haut et on est remis en piste ?
6. Les rivaux doivent-ils prendre les murs et les toits, ou rester en bas ?
7. Garde-t-on « aucun contrôle en vol » ?
8. Loopings ou routes qui se croisent en hauteur : voulus ? (Seul C le permet.)
