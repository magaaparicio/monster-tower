"""Prepara los recursos de interfaz: assets/source/ui/<nombre>.png  →  assets/ui/<nombre>.webp
Recorta el contorno claro pintado en el borde, quita motas sueltas y reduce al tamaño de uso.
Uso:  python3 tools/build_ui.py"""
import pathlib
import numpy as np
from PIL import Image
from scipy import ndimage
ROOT = pathlib.Path(__file__).resolve().parent.parent
ITEMS = {'ajustes': 160, 'ayuda': 160, 'cambiar': 160, 'girar-der': 160, 'girar-izq': 160, 'pausa': 160, 'record': 160,
         'reiniciar': 160, 'soltar': 192, 'sonido-on': 160, 'sonido-off': 160, 'logo': 900, 'como-jugar': 900, 'fondo-inicio': 720}
for name, width in ITEMS.items():
    im = Image.open(ROOT / f'assets/source/ui/{name}.png').convert('RGBA')
    a = np.array(im).astype(np.float32)
    if (a[..., 3] < 255).any():
        al = a[..., 3]
        # motas sueltas fuera de la figura
        lab, n = ndimage.label(al > 10)
        if n > 1:
            sizes = ndimage.sum(al > 10, lab, range(1, n + 1))
            for i, sz in enumerate(sizes, 1):
                if sz < 200: al[lab == i] = 0
        # el anillo exterior trae un contorno claro pintado: se recorta 2 px y se vuelve a suavizar
        solid = ndimage.binary_erosion(al >= 250, iterations=2)
        soft = ndimage.gaussian_filter(solid.astype(np.float32) * 255, 0.9)
        al = np.minimum(al, soft)
        # sangrado de color hacia el borde
        idx = ndimage.distance_transform_edt(~solid, return_distances=False, return_indices=True)
        a[..., :3] = a[idx[0], idx[1], :3]
        a[..., 3] = al
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')
    if img.width > width: img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    img.save(ROOT / f'assets/ui/{name}.webp', 'WEBP', quality=80 if name == 'fondo-inicio' else 88, method=6)
    print(f'{name:13s} {img.size}')
