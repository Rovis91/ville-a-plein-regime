# Méthode pour retravailler une carte sans gaspiller de tokens

But : une session par carte, en parallèle, qui ne se marchent pas dessus et où le modèle cher ne lit jamais d'image.

## Qui fait quoi

| Étape | Qui | Entrée | Sortie |
|---|---|---|---|
| 1. Analyse de la carte | sous-agent **Sonnet** | un tour capturé toutes les 10 s | une liste écrite de constats, un par capture (ce qu'on voit, ce qui cloche, à quel échantillon de piste) |
| 2. Modélisation | l'orchestrateur (**Opus**) décide et écrit, ou confie une forme bien spécifiée à un sous-agent Sonnet | les constats + la demande de l'auteur | formes, textures, placement |
| 3. Validation des modèles | sous-agent **Sonnet** | captures aux endroits modifiés (`idx=`, `vue=`) | par objet : conforme / défaut précis |
| 4. Revalidation du circuit | sous-agent **Sonnet** | un nouveau tour toutes les 10 s + les tests | comparaison avec l'étape 1, erreurs console, temps d'image, tests |

Règles d'économie :
- **L'orchestrateur ne lit aucune image.** Seuls les sous-agents Sonnet ouvrent les captures ; ils rendent du texte, court, avec le nom du fichier et l'échantillon de piste.
- Captures en 960 × 540, JPEG. Un tour = 5 à 12 images selon la carte.
- Un sous-agent par étape, pas un par image. On lui donne la liste des fichiers et la question précise.
- On ne refait un tour complet qu'à l'étape 4 ; entre-temps on ne recapture que les endroits touchés (`idx=`).

## L'outil de capture

```bash
python outils/capture.py 8801
```

Puis ouvrir dans le navigateur intégré, sans rien faire d'autre, et attendre que le titre de l'onglet passe à « FINI » (une dizaine de secondes) :

- un tour : `http://127.0.0.1:8801/outils/captures.html?carte=wangan&pas=10`
- des endroits précis : `...captures.html?carte=wangan&idx=700,1351`
- un objet vu de près : ajouter `&vue=angle,distance,hauteur` (caméra d'inspection autour de la voiture)

Résultat dans `captures/` (ignoré par git) : `<carte>-NN.jpg` et `<carte>.json` (temps de course, échantillon de piste, vitesse, tunnel ou non pour chaque vue ; erreurs console ; temps d'image moyen ; durée du tour). Chaque session prend son propre port.

## Pour ne pas se marcher dessus

Chaque session travaille dans son worktree et n'écrit que dans son périmètre :

| Session | Formes et textures nouvelles | Placement | Autres fichiers autorisés |
|---|---|---|---|
| wangan | `formes-wangan.js`, `textures-wangan.js` | fonction `wangan` de `decors.js` | entrée `wangan` de `cartes.js`, bloc pluie de `game.js` |
| touge | `formes-touge.js`, `textures-touge.js` | fonction `touge` de `decors.js` | fonction `terrain` de `decors.js`, entrée `touge` de `cartes.js` |
| paris | `formes-paris.js`, `textures-paris.js` | fonction `paris` de `decors.js` | entrée `paris` de `cartes.js` ; `sim.js` seulement si le tracé l'exige, tests à l'appui |
| canal | `formes-canal.js`, `textures-canal.js` | fonction `canal` de `decors.js` | entrée `canal` de `cartes.js` |
| voitures | `formes-voitures.js`, `textures-voitures.js` | section « voiture » de `game.js` | — |
| départ | forme `depart` de `formes.js` | bloc « ligne et portique de départ » de `game.js` | — |

`formes.js` et `textures.js` (catalogues communs) se lisent, ne se modifient pas — sauf la session « départ » pour sa forme. Les fichiers par carte complètent les catalogues par `Object.assign(FORMES, { … })` et `Object.assign(TEXTURES, { … })`. Personne ne touche à `audio.js`.

## Terminé quand

- la demande de l'auteur est traitée point par point, ou un point est signalé non fait avec la raison ;
- l'étape 4 ne relève aucune erreur console sur la carte, `node test.js` et `node test-cartes.js` sont verts ;
- le temps d'image n'a pas dérapé par rapport à l'étape 1 (le noter avant / après) ;
- tout est committé sur la branche de la session, rien poussé ; le message final commence par les commits, puis liste ce qui a changé et ce qui n'a pas pu être vérifié (le mouvement, notamment).
