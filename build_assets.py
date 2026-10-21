"""Procesa los monstruos: assets/source/monsters/<id>.png  →  assets/monsters/<id>.webp + js/data/monsters-data.js

- Limpia la transparencia y recorta cada figura.
- Traza el contorno desde el canal alfa (colisionador) en metros, con origen en el centro visual.
- Todos usan la misma escala (metros por píxel) para respetar los tamaños relativos.
Uso:  python3 tools/build_assets.py
"""
import json, pathlib
import numpy as np, cv2
from PIL import Image
from scipy import ndimage

ROOT = pathlib.Path(__file__).resolve().parent.parent
M_PER_PX = 2.7 / 864          # escala fijada por el verde aprobado (864 px de ancho = 2.7 m)
OUT_SCALE = 640 / 864         # resolución del sprite final
ORDER = ['verde', 'amarillo', 'morado', 'azul-rinon', 'verde-antenas', 'naranja', 'turquesa', 'rosa', 'azul-nube', 'lila', 'rojo']
LABELS = {'verde': 'Verde', 'amarillo': 'Amarillo', 'morado': 'Morado', 'azul-rinon': 'Azul riñón', 'verde-antenas': 'Verde antenas',
          'naranja': 'Naranja', 'turquesa': 'Turquesa', 'rosa': 'Rosa', 'azul-nube': 'Azul nube', 'lila': 'Lila', 'rojo': 'Rojo'}

def clean(path):
    im = np.array(Image.open(path).convert('RGBA')).astype(np.float32)
    a = im[..., 3]; a[a < 8] = 0
    mask = ndimage.binary_fill_holes(ndimage.binary_opening(a > 127, iterations=1))
    lab, n = ndimage.label(mask); sizes = ndimage.sum(mask, lab, range(1, n + 1))
    mask = lab == (1 + int(np.argmax(sizes)))
    a[ndimage.binary_erosion(mask, iterations=3)] = 255
    a[~ndimage.binary_dilation(mask, iterations=3)] = 0
    im[..., 3] = a
    ys, xs = np.where(mask); pad = 6
    x0, x1, y0, y1 = xs.min() - pad, xs.max() + 1 + pad, ys.min() - pad, ys.max() + 1 + pad
    return im[y0:y1, x0:x1], mask[y0:y1, x0:x1]

def process(mid):
    crop, cm = clean(ROOT / f'assets/source/monsters/{mid}.png'); H, W = cm.shape
    img = Image.fromarray(np.clip(crop, 0, 255).astype(np.uint8), 'RGBA')
    img.resize((round(W * OUT_SCALE), round(H * OUT_SCALE)), Image.LANCZOS).save(ROOT / f'assets/monsters/{mid}.webp', 'WEBP', quality=90, method=6)
    cnts, _ = cv2.findContours(cm.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cnts, key=cv2.contourArea)
    poly = cv2.approxPolyDP(c, 0.0018 * cv2.arcLength(c, True), True)[:, 0, :].astype(float)
    pts = [{'x': round((px - W / 2) * M_PER_PX, 4), 'y': round(-(py - H / 2) * M_PER_PX, 4)} for px, py in poly]
    print(f'{mid:14s} {W * M_PER_PX:.2f} x {H * M_PER_PX:.2f} m  vértices {len(pts)}')
    return {'id': mid, 'label': LABELS[mid], 'spriteWM': round(W * M_PER_PX, 4), 'spriteHM': round(H * M_PER_PX, 4), 'outline': pts, 'body': f'assets/monsters/{mid}.webp'}

if __name__ == '__main__':
    data = [process(m) for m in ORDER]
    (ROOT / 'js/data/monsters-data.js').write_text('// Generado por tools/build_assets.py: silueta (metros, origen en el centro visual) y ruta del sprite de cada monstruo.\nconst MONSTER_DATA = ' + json.dumps(data, ensure_ascii=False) + ';\n')
