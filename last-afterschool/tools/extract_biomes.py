"""Cut the desert / snow / volcano environment sheets (1509x688, flat background colour).
Usage (from last-afterschool/):  python3 -I tools/extract_biomes.py
Writes assets/env/<biome>_<name>.png. Boxes are (x0, y0, x1, y1) on each sheet.
Parallax strips: the first strip (sky) is kept opaque, the others have the sheet colour removed
so they can be layered.
"""
import os
from collections import deque
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'source')
OUT = os.path.join(ROOT, 'assets', 'env')

BIOMES = {
    'desert': {
        'bg': (2, 120, 124),
        'layer_key': {0: {'tol': 22, 'step': 9}},
        'sky': [(763, 41, 1507, 157)], 'layers': [(763, 171, 1507, 288), (763, 298, 1507, 414)],
        'ground': (9, 301, 527, 342), 'oneway': (9, 408, 527, 449),
        'props': {'i_dagger': (30, 70, 130, 195), 'i_sword': (155, 50, 280, 200), 'i_axe': (296, 46, 424, 200),
                  'obelisk': (776, 486, 900, 672), 'house': (920, 490, 1100, 672), 'cactus': (1112, 472, 1184, 562),
                  'cactus2': (1186, 492, 1244, 562), 'cactus3': (1250, 522, 1288, 562), 'palm': (1296, 482, 1376, 590),
                  'palms': (1116, 592, 1204, 676), 'skull': (1208, 620, 1274, 676), 'skull2': (1276, 616, 1350, 678),
                  'block': (1382, 530, 1442, 590), 'bricks': (1372, 596, 1507, 678)},
    },
    'snow': {
        'bg': (27, 73, 142),
        'sky': [(767, 37, 1508, 122)], 'layers': [(767, 132, 1508, 219), (767, 229, 1508, 316), (767, 325, 1508, 414)],
        'ground': (9, 301, 532, 342), 'oneway': (9, 407, 532, 450),
        'props': {'i_dagger': (30, 70, 130, 185), 'i_sword': (155, 38, 302, 202), 'i_axe': (296, 42, 444, 198),
                  'tower': (764, 482, 884, 678), 'igloo': (936, 536, 1100, 674), 'tree': (1116, 482, 1204, 594),
                  'tree2': (1206, 476, 1280, 594), 'tree3': (1286, 442, 1390, 598), 'skeleton': (1116, 596, 1290, 678),
                  'ice': (1390, 530, 1450, 594), 'skull': (1450, 536, 1507, 594)},
    },
    'volcano': {
        'bg': (24, 72, 138),
        'sky': [(770, 36, 1508, 120)], 'layers': [(770, 130, 1508, 220), (770, 229, 1508, 317), (770, 326, 1508, 416)],
        'ground': (9, 302, 536, 342), 'oneway': (9, 409, 536, 452),
        'props': {'i_dagger': (26, 66, 134, 182), 'i_sword': (152, 36, 308, 202), 'i_axe': (296, 38, 448, 198),
                  'tower': (786, 482, 920, 678), 'furnace': (926, 486, 1104, 672), 'deadtree': (1120, 430, 1220, 598),
                  'deadtree2': (1218, 480, 1294, 598), 'deadtree3': (1296, 434, 1404, 598), 'lavapit': (1414, 484, 1507, 530),
                  'skeleton': (1126, 592, 1294, 678)},
    },
    'castle_out': {
        'sheet': 'sheet_env_castle_out.jpg', 'bg': (20, 70, 133),
        'layer_key': {0: {'tol': 20, 'step': 8}, 1: {'tol': 20, 'step': 8}, 2: {'sheet': True}},
        'sky': [(778, 33, 1508, 120)], 'layers': [(778, 128, 1508, 219), (778, 226, 1508, 317), (778, 325, 1508, 417)],
        'ground': (9, 300, 540, 342), 'oneway': (9, 411, 540, 454),
        'props': {'i_dagger': (28, 58, 142, 188), 'i_sword': (172, 28, 336, 202), 'i_axe': (322, 36, 478, 198),
                  'keep': (788, 484, 982, 664), 'throne': (1018, 424, 1172, 572), 'deadtree': (1206, 428, 1302, 596),
                  'deadtree2': (1306, 428, 1408, 596), 'abyss': (1432, 462, 1509, 516), 'skeleton': (1008, 598, 1200, 666),
                  'rubble': (1318, 598, 1440, 662), 'orb': (1440, 588, 1509, 666)},
    },
    'castle_in': {
        'sheet': 'sheet_env_castle_in.jpg', 'bg': (19, 68, 127), 'opaque_layers': True,   # 城内の壁は切り抜かず、1枚の絵として重ねる
        'sky': [(785, 31, 1508, 117)], 'layers': [(785, 126, 1508, 218), (785, 226, 1508, 317)],
        'ground': (9, 300, 545, 342), 'oneway': (9, 412, 545, 455),
        'props': {'i_dagger': (28, 58, 142, 188), 'i_sword': (172, 28, 336, 202), 'i_axe': (322, 36, 480, 198),
                  'candle': (798, 338, 850, 418), 'candle2': (850, 338, 898, 418), 'smallthrone': (1088, 322, 1192, 420),
                  'bonethrone': (1322, 322, 1462, 420), 'keep': (798, 484, 992, 670), 'throne': (1038, 424, 1182, 574),
                  'deadtree': (1192, 424, 1272, 562), 'deadtree2': (1270, 428, 1332, 562), 'deadtree3': (1330, 428, 1402, 562),
                  'furnace': (1412, 428, 1509, 536), 'chest': (1342, 552, 1402, 602), 'skeleton': (1012, 598, 1142, 668),
                  'rubble': (1328, 598, 1442, 670)},
    },
}

def key(a, bg, tol=70, trim=1):
    h, w, _ = a.shape
    near = np.abs(a - np.array(bg)).sum(axis=2) < tol
    seen = np.zeros((h, w), bool); q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if near[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not seen[ny, nx] and near[ny, nx]:
                seen[ny, nx] = True; q.append((ny, nx))
    # JPEG の縁のにじみ（背景色が混ざった1px）を削る
    fg = ~seen
    for _ in range(trim):
        e = fg.copy(); e[1:] &= fg[:-1]; e[:-1] &= fg[1:]; e[:, 1:] &= fg[:, :-1]; e[:, :-1] &= fg[:, 1:]
        edge = fg & ~e
        mix = np.abs(a - np.array(bg)).sum(axis=2) < tol * 2.2
        fg &= ~(edge & mix)
    img = Image.fromarray(np.dstack([a.astype(np.uint8), np.where(fg, 255, 0).astype(np.uint8)]), 'RGBA')
    return img

def crop(a, b, inset=0): return a[b[1] + inset:b[3] - inset, b[0] + inset:b[2] - inset]

def key_silhouette(a, tol=48, step=20):
    """背景の帯：列ごとに上から「その帯自身の空の色」が続く所を透明にし、山・砂丘・岩のシルエットだけ残す。
    参照色は各列の上端の色（横方向にならす）。空のグラデーションは隣の画素との差が小さい間だけ追う。"""
    h, w, _ = a.shape
    ref = np.median(a[:3], axis=0)                         # 各列の上端の色
    k = 7; pad = np.pad(ref, ((k, k), (0, 0)), mode='edge')
    ref = np.stack([np.median(pad[i:i + 2 * k + 1], axis=0) for i in range(w)])
    # 上端から「空の色に近く、隣とのつながりがなめらかな画素」を塗り広げる（列ごとに切るとトゲが出るため）
    near = np.abs(a - ref[None]).sum(axis=2) < tol * 3
    seen = np.zeros((h, w), bool); q = deque()
    for x in range(w):
        if near[0, x]: seen[0, x] = True; q.append((0, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (0, 1), (0, -1), (-1, 0)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not seen[ny, nx] and near[ny, nx] and np.abs(a[ny, nx] - a[y, x]).sum() < step * 3:
                seen[ny, nx] = True; q.append((ny, nx))
    cut = np.array([int(np.argmin(seen[:, x])) if not seen[:, x].all() else h for x in range(w)])
    # 輪郭をならす：9列の中央値（1〜2列だけ深い・浅い所を消す）
    cut = np.array([int(np.median(cut[max(0, x - 4):x + 5])) for x in range(w)])
    # 周り（左右20列）より極端に深く切れた所は、周りの高さに戻す。帯の下の方（地面）は必ず残す
    wide = np.array([int(np.median(cut[max(0, x - 20):x + 21])) for x in range(w)])
    cut = np.where(cut > wide + 10, wide, cut)
    cut = np.minimum(cut, int(h * 0.7))
    alpha = np.full((h, w), 255, np.uint8)
    for x in range(w):
        alpha[:cut[x], x] = 0
        if 0 < cut[x] < h: alpha[cut[x], x] = 150      # 境目を1画素だけ半透明にしてなじませる
    return Image.fromarray(np.dstack([a.astype(np.uint8), alpha]), 'RGBA')

def main():
    os.makedirs(OUT, exist_ok=True)
    for name, B in BIOMES.items():
        a = np.asarray(Image.open(os.path.join(SRC, B.get('sheet', f'sheet_env_{name}.jpg'))).convert('RGB')).astype(int)
        save = lambda img, n: img.save(os.path.join(OUT, f'{name}_{n}.png'), optimize=True)
        save(Image.fromarray(crop(a, B['sky'][0], 2).astype(np.uint8)), 'sky')
        for i, b in enumerate(B['layers']):
            band = crop(a, b, 2)   # シートの枠線を含めない
            kp = (B.get('layer_key') or {}).get(i, {})   # 空と地形の色が近い帯は、許容差を個別に小さくする
            if B.get('opaque_layers'): img = Image.fromarray(band.astype(np.uint8))
            elif kp.get('sheet'): img = key(band, B['bg'], tol=90, trim=1)   # 上がシートの地の色の帯（手前の飾り）
            else: img = key_silhouette(band, **{k: v for k, v in kp.items() if k in ('tol', 'step')})
            if not B.get('opaque_layers'):   # 岩や草の間に閉じ込められたシートの地の色（青）も消す
                arr = np.asarray(img.convert('RGBA')).copy(); bgd = np.abs(arr[..., :3].astype(int) - np.array(B['bg'])).sum(axis=2)
                arr[..., 3] = np.where(bgd < 90, 0, arr[..., 3]); img = Image.fromarray(arr, 'RGBA')
            al = np.asarray(img.convert('RGBA'))[..., 3]; cols = np.nonzero((al > 0).sum(axis=0) > al.shape[0] * 0.25)[0]
            if len(cols): img = img.crop((cols.min(), 0, cols.max() + 1, img.height))   # 左右の空っぽの列を落とす
            save(img, f'layer{i}')
        for n in ('ground', 'oneway'): save(Image.fromarray(crop(a, B[n], 3).astype(np.uint8)), n)
        for n, b in B['props'].items():
            img = key(crop(a, b), B['bg'], tol=95, trim=2); bb = img.getbbox(); save(img.crop(bb) if bb else img, n)
        print(name, 'ok')

if __name__ == '__main__':
    main()
