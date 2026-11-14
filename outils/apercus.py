# Aperçus du menu (diaporama quand on change de carte) : apercus/<carte>-0..3.jpg, 480 × 270, une vue par angle de caméra.
# 1. python outils/capture.py 8801, puis pour chaque carte ouvrir (ou sh outils/capture.sh <carte> "...") :
#    http://127.0.0.1:8801/outils/captures.html?carte=<carte>&pas=7&sanshud&angles=;35,9,2.5;200,24,10;;150,12,4
#    (capture n prise avec angles[n % 5] : 0 la grille de départ, 1 trois-quarts avant, 2 de haut, 3 caméra de course, 4 de côté)
# 2. python outils/apercus.py : pour chaque angle 1 à 4, une capture répartie sur le tour.
import json
from PIL import Image
for c in ['ville', 'touge', 'wangan', 'paris', 'canal', 'stade', 'givre', 'terre']:
    N = len(json.load(open(f'captures/{c}.json', encoding='utf-8'))['vues'])  # pas le nombre de fichiers : captures/ garde ceux des passes précédentes
    for j in range(1, 5):
        cand = [n for n in range(1, N) if n % 5 == j]; n = cand[min(len(cand) - 1, (j - 1) * len(cand) // 4)]
        Image.open(f'captures/{c}-{n:02d}.jpg').convert('RGB').resize((480, 270), Image.LANCZOS).save(f'apercus/{c}-{j - 1}.jpg', quality=72, optimize=True)
