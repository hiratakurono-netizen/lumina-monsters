"""Cut the environment sheet (assets/source/sheet_env_grass.png) into game assets.

The props sit on a soft purple gradient, not a flat colour. We flood-fill from the
edges of each box, stepping only across *smooth* colour changes, so the fill runs
through the gradient and stops at the dark outlines of the art.
Opaque panels (the parallax background, the ground strips) are cropped as they are.
Usage (from last-afterschool/):  python3 -I tools/extract_env.py
"""
import os
from collections import deque
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'source', 'sheet_env_grass.png')
OUT = os.path.join(ROOT, 'assets', 'env')

PROPS = {   # name: (x0, y0, x1, y1) on the 1536x1024 sheet
    'store': (776, 536, 970, 676), 'school': (994, 524, 1184, 676), 'bench': (1196, 588, 1284, 676),
    'lamp': (1400, 520, 1444, 680), 'vending': (1448, 562, 1526, 680),
    # 'tree' は根元の影がきれいに抜けないので使わない
    'bush': (934, 826, 1022, 900), 'bush2': (876, 920, 962, 994),
    'flowers': (966, 926, 1064, 994), 'pole': (1078, 772, 1116, 994),
    'i_chair_pipe': (40, 80, 166, 246), 'i_bat_mop': (196, 66, 276, 254), 'i_bat_metal': (326, 66, 424, 254),
}
PANELS = {  # opaque crops
    'bg_grass': (484, 52, 1512, 470), 'ground_grass': (18, 532, 626, 596), 'ground_road': (18, 598, 626, 646),
    'city': (1152, 778, 1512, 984),
}

def key_smooth(a, step=18, leaf=False):
    h, w, _ = a.shape
    seen = np.zeros((h, w), bool); q = deque()
    for x in range(w):
        for y in (0, h - 1): seen[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if not seen[y, x]: seen[y, x] = True; q.append((y, x))
    # 背景は紫系（青 ≥ 緑）。葉っぱなど緑寄りの色は背景として扱わない
    # 背景として越えてよい色。植物は周りの背景が緑がかっているので「青 ≥ 緑」で判定、
    # それ以外は「緑が赤より強くない」で判定（ブラシの柄など暖色の背景も越えられる）
    purple = ((a[..., 2] >= a[..., 1] + 4) if leaf else (a[..., 1] <= a[..., 0] + 6)) & (a.sum(axis=2) > 90)
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not seen[ny, nx] and np.abs(a[ny, nx] - a[y, x]).sum() < step and purple[ny, nx]:
                seen[ny, nx] = True; q.append((ny, nx))
    alpha = np.where(seen, 0, 255).astype(np.uint8)
    img = Image.fromarray(np.dstack([a.astype(np.uint8), alpha]), 'RGBA')
    # keep only the biggest connected blobs (drop stray specks left in the gradient)
    bb = img.getbbox()
    return img.crop(bb) if bb else img

def key_leaf(a, tol=40):
    """植物用：背景のグラデーションを左右の端の色から行ごとに推定し、それと違う所を残す。"""
    h, w, _ = a.shape
    L = np.median(a[:, :3], axis=1); R = np.median(a[:, -3:], axis=1)
    t = np.linspace(0, 1, w)[None, :, None]
    bg = L[:, None, :] * (1 - t) + R[:, None, :] * t
    fg = np.abs(a - bg).sum(axis=2) > tol
    # 1px の穴や点を整える
    # 植物はおおむね丸い形なので、各行の一番左〜一番右の前景の間を埋める
    g = np.zeros((h, w), bool)
    for y in range(h):
        xs = np.nonzero(fg[y])[0]
        if len(xs) >= 3: g[y, xs.min():xs.max() + 1] = True
    # 縦方向にも同じように埋め、両方で前景の所だけ残す（横に伸びるノイズを消す）
    gc = np.zeros((h, w), bool)
    for x in range(w):
        ys = np.nonzero(fg[:, x])[0]
        if len(ys) >= 3: gc[ys.min():ys.max() + 1, x] = True
    g &= gc
    img = Image.fromarray(np.dstack([a.astype(np.uint8), np.where(g, 255, 0).astype(np.uint8)]), 'RGBA')
    bb = img.getbbox()
    return img.crop(bb) if bb else img

def main():
    os.makedirs(OUT, exist_ok=True)
    sheet = np.asarray(Image.open(SRC).convert('RGB')).astype(int)
    for n, (x0, y0, x1, y1) in PANELS.items():
        Image.fromarray(sheet[y0:y1, x0:x1].astype(np.uint8)).save(os.path.join(OUT, n + '.png'), optimize=True)
    for n, (x0, y0, x1, y1) in PROPS.items():
        img = key_leaf(sheet[y0:y1, x0:x1]) if n in ('tree', 'bush', 'bush2') else key_smooth(sheet[y0:y1, x0:x1], leaf=n == 'flowers')
        img.save(os.path.join(OUT, n + '.png'), optimize=True)
        print(n, img.size)

if __name__ == '__main__':
    main()
