"""Mide ojos, pupilas, boca y nariz en las referencias con rostro (assets/source/faces/)
y los traslada a las coordenadas (metros) del cuerpo de cada monstruo. Genera js/data/faces-data.js.
Requiere haber corrido antes tools/build_assets.py.  Uso:  python3 tools/measure_faces.py"""
import json, pathlib
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = pathlib.Path(__file__).resolve().parent.parent
IDS = {'verde': 'verde-neutral', 'amarillo': 'amarillo', 'morado': 'morado', 'azul-rinon': 'azul-rinon', 'verde-antenas': 'verde-antenas',
       'naranja': 'naranja', 'turquesa': 'turquesa', 'rosa': 'rosa', 'azul-nube': 'azul-nube', 'lila': 'lila', 'rojo': 'rojo'}

import sys; sys.path.insert(0, str(ROOT / 'tools'))
from build_assets import clean
DATA = {d['id']: d for d in json.loads((ROOT / 'js/data/monsters-data.js').read_text().split('= ', 1)[1].rstrip().rstrip(';'))}
def body_mask(mid):
    _, m = clean(ROOT / f'assets/source/monsters/{mid}.png')
    ys, xs = np.where(m); return m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]

out = {}
OV = []
for mid, fname in IDS.items():
    im = np.array(Image.open(ROOT / f'assets/source/faces/{fname}.png').convert('RGBA')).astype(int)
    al, rgb = im[..., 3], im[..., :3]
    fig = ndimage.binary_fill_holes(al > 127)
    lab, n = ndimage.label(fig); fig = lab == 1 + int(np.argmax(ndimage.sum(fig, lab, range(1, n + 1))))
    ys, xs = np.where(fig); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    bw, bh = x1 - x0, y1 - y0
    # comparación de silueta con el cuerpo entregado
    bm = body_mask(mid)
    fm = Image.fromarray((fig[y0:y1, x0:x1] * 255).astype(np.uint8)).resize((bm.shape[1], bm.shape[0]))
    fm = np.array(fm) > 127
    iou = (fm & bm).sum() / (fm | bm).sum()
    meta = DATA[mid]
    oxs = [p['x'] for p in meta['outline']]; oys = [p['y'] for p in meta['outline']]
    Wm, Hm = max(oxs) - min(oxs), max(oys) - min(oys)
    cxm, cym = (max(oxs) + min(oxs)) / 2, (max(oys) + min(oys)) / 2
    kx, ky = Wm / bw, Hm / bh; k = (kx + ky) / 2
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    to_m = lambda px, py: (round(cxm + (px - cx) * kx, 3), round(cym - (py - cy) * ky, 3))
    L = rgb.mean(2)
    med = np.median(L[fig])
    inner = ndimage.binary_erosion(fig, iterations=4)
    white = inner & (rgb.min(2) > 212) & (rgb.max(2) - rgb.min(2) < 32)
    dark = inner & (L < min(70, 0.55 * med))
    wl, wn = ndimage.label(white)
    dl, dn = ndimage.label(dark)
    wsizes = np.bincount(wl.ravel())[1:] if wn else [0]
    eyes, used = [], set()
    for i in range(1, wn + 1):
        m = wl == i
        if m.sum() < 60 or m.sum() < 0.3 * max(wsizes): continue
        near = ndimage.binary_dilation(m, iterations=3)
        cands = [j for j in np.unique(dl[near]) if j and j not in used]
        pupil = None
        if cands:
            j = max(cands, key=lambda j: (dl == j).sum()); used.add(j)
            pm = dl == j; py_, px_ = np.where(pm)
            pupil = {'x': px_.mean(), 'y': py_.mean(), 'rx': (px_.max() - px_.min() + 1) / 2, 'ry': (py_.max() - py_.min() + 1) / 2}
            m = m | pm
        filled = ndimage.binary_fill_holes(ndimage.binary_closing(m, iterations=2))
        ey, ex = np.where(filled)
        e = {'mask': filled, 'x': (ex.max() + ex.min()) / 2, 'y': (ey.max() + ey.min()) / 2, 'rx': (ex.max() - ex.min() + 1) / 2, 'ry': (ey.max() - ey.min() + 1) / 2}
        if pupil: e['pupil'] = pupil
        eyes.append(e)
    others = []
    for j in range(1, dn + 1):
        if j in used: continue
        m = dl == j; dy_, dx_ = np.where(m)
        if m.sum() < 6 or not eyes: continue
        px, py = dx_.mean(), dy_.mean()
        info = {'x': px, 'y': py, 'rx': (dx_.max() - dx_.min() + 1) / 2, 'ry': (dy_.max() - dy_.min() + 1) / 2, 'fill': m.sum() / ((dx_.max() - dx_.min() + 1) * (dy_.max() - dy_.min() + 1))}
        ex0 = min(e['x'] - 1.6 * e['rx'] for e in eyes); ex1 = max(e['x'] + 1.6 * e['rx'] for e in eyes)
        ey0 = min(e['y'] - 1.2 * e['ry'] for e in eyes); ey1 = max(e['y'] + 3.6 * e['ry'] for e in eyes)
        if ex0 < px < ex1 and ey0 < py < ey1: others.append(info)
    eyes_out = []
    for e in sorted(eyes, key=lambda e: e['x']):
        x, y = to_m(e['x'], e['y'])
        p = e.get('pupil')
        pd = {'dx': round((p['x'] - e['x']) * kx, 3), 'dy': round(-(p['y'] - e['y']) * ky, 3), 'r': round((p['rx'] + p['ry']) / 2 * k, 3)} if p else {'dx': 0, 'dy': 0, 'r': round(e['rx'] * 0.5 * k, 3)}
        eyes_out.append({'x': x, 'y': y, 'rx': round(e['rx'] * k, 3), 'ry': round(e['ry'] * k, 3), 'pupil': pd})
    others.sort(key=lambda o: o['y'])
    mouth = nose = None
    if others:
        mo = others[-1]   # el más bajo es la boca
        x, y = to_m(mo['x'], mo['y'])
        mouth = {'x': x, 'y': y, 'rx': round(mo['rx'] * k, 3), 'ry': round(mo['ry'] * k, 3), 'type': 'smile' if mo['fill'] < 0.55 else 'o'}
        if len(others) > 1:
            no = others[0]; x, y = to_m(no['x'], no['y']); nose = {'x': x, 'y': y, 'r': round((no['rx'] + no['ry']) / 2 * k, 3)}
    # color de boca: oscuro tomado de la referencia
    mc = None
    if others:
        mo = others[-1]; mm = (dl > 0) & (np.abs(np.arange(dark.shape[1])[None, :] - mo['x']) < mo['rx']) & (np.abs(np.arange(dark.shape[0])[:, None] - mo['y']) < mo['ry'])
        c = rgb[mm].mean(0).astype(int); mc = '#%02x%02x%02x' % tuple(c)
    out[mid] = {'eyes': eyes_out, 'mouth': mouth, 'nose': nose, 'mouthColor': mc}
    ov = Image.fromarray(im.astype(np.uint8), 'RGBA').crop((x0 - 8, y0 - 8, x1 + 8, y1 + 8)); from PIL import ImageDraw; d = ImageDraw.Draw(ov)
    for e in eyes: d.ellipse([e['x'] - x0 + 8 - e['rx'], e['y'] - y0 + 8 - e['ry'], e['x'] - x0 + 8 + e['rx'], e['y'] - y0 + 8 + e['ry']], outline=(0, 200, 255, 255), width=2)
    for o in others: d.rectangle([o['x'] - x0 + 8 - o['rx'], o['y'] - y0 + 8 - o['ry'], o['x'] - x0 + 8 + o['rx'], o['y'] - y0 + 8 + o['ry']], outline=(255, 0, 90, 255), width=2)
    OV.append((mid, ov))
    print(f"{mid:14s} silueta IoU {iou:.2f}  ojos {len(eyes_out)}  boca {mouth['type'] if mouth else '—'}  nariz {'sí' if nose else 'no'}  color {mc}")
out['morado']['mouth']['type'] = 'smile'   # en la referencia es sonrisa; la detección lo lee como "o"
(ROOT / 'js/data/faces-data.js').write_text('// Generado por tools/measure_faces.py: ojos, pupilas, boca y nariz medidos en las referencias con rostro (metros).\nconst FACE_DATA = ' + json.dumps(out) + ';\n')

sheet = Image.new('RGBA', (6 * 220, 2 * 230), (220, 235, 250, 255)); d = ImageDraw.Draw(sheet)
for i, (mid, ov) in enumerate(OV):
    ov.thumbnail((210, 210)); x, y = (i % 6) * 220, (i // 6) * 230; sheet.alpha_composite(ov, (x, y)); d.text((x + 4, y + 214), mid, fill=(0, 0, 0, 255))
sheet.save(ROOT / 'tools/faces-check.png')   # hoja de revisión: cian = ojos, rosa = boca/nariz
