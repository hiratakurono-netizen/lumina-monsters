# 必殺技エフェクト（緑背景）の切り出し：python3 tools/extract_specials.py
# assets/source/specials/sp_<武器>.jpg → assets/fx/sp_<武器>_<番号>.png（読む順：上の段の左→右、下の段の左→右）
# 剣の3枚目（爆発）は見切れているので、単品の sp_sword_impact.jpg を使う
import numpy as np, os, json
from PIL import Image
from collections import deque
ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC, OUT = os.path.join(ROOT, 'assets/source/specials'), os.path.join(ROOT, 'assets/fx')

def key(im, lo=40, hi=None):
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    h, w, _ = a.shape
    corners = np.concatenate([a[:8, :8].reshape(-1, 3), a[:8, -8:].reshape(-1, 3), a[-8:, :8].reshape(-1, 3), a[-8:, -8:].reshape(-1, 3)])
    bg = np.median(corners, axis=0)
    gn = a[..., 1] - np.maximum(a[..., 0], a[..., 2])
    bgn = bg[1] - max(bg[0], bg[2])
    if hi is None: hi = bgn - 40
    al = np.clip(1 - (gn - lo) / (hi - lo), 0, 1)
    al[gn < lo] = 1
    # 色を背景から取り出す（半透明の所は緑を差し引く）
    A = np.maximum(al, 1e-3)[..., None]
    col = np.clip((a - (1 - A) * bg) / A, 0, 255)
    col[..., 1] = np.where(al < 0.98, np.minimum(col[..., 1], np.maximum(col[..., 0], col[..., 2]) + 30), col[..., 1])
    return np.dstack([col, al * 255]).astype(np.uint8)

def comps(rgba, dil=22, min_area=1500):
    m = rgba[..., 3] > 40
    s = 4; H, W = m.shape[0] // s, m.shape[1] // s
    g = m[:H * s, :W * s].reshape(H, s, W, s).any(axis=(1, 3))
    r = max(1, dil // s); d = g.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            d |= np.roll(np.roll(g, dy, 0), dx, 1)
    lab = np.zeros(d.shape, int); n = 0; boxes = []
    for y in range(H):
        for x in range(W):
            if d[y, x] and not lab[y, x]:
                n += 1; q = deque([(y, x)]); lab[y, x] = n; ys = []; xs = []
                while q:
                    cy, cx = q.popleft(); ys.append(cy); xs.append(cx)
                    for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                        if 0 <= ny < H and 0 <= nx < W and d[ny, nx] and not lab[ny, nx]: lab[ny, nx] = n; q.append((ny, nx))
                gm = g & (lab == n)
                if gm.sum() * s * s < min_area: continue
                yy, xx = np.nonzero(gm)
                boxes.append((xx.min() * s, yy.min() * s, (xx.max() + 1) * s, (yy.max() + 1) * s))
    return boxes

def order(boxes, h):
    rows = sorted(boxes, key=lambda b: (b[1] + b[3]) / 2)
    out, cur = [], []
    for b in rows:
        if cur and (b[1] + b[3]) / 2 - (cur[0][1] + cur[0][3]) / 2 > h * 0.25: out += sorted(cur, key=lambda b: b[0]); cur = []
        cur.append(b)
    return out + sorted(cur, key=lambda b: b[0])

def save(rgba, b, name, pad=6):
    x0, y0, x1, y1 = max(0, b[0] - pad), max(0, b[1] - pad), min(rgba.shape[1], b[2] + pad), min(rgba.shape[0], b[3] + pad)
    crop = rgba[y0:y1, x0:x1].copy()
    # 選んだ箱の外の別のかたまりが入らないよう、箱の中だけ使う（はみ出しは透明）
    Image.fromarray(crop).save(os.path.join(OUT, name))
    return [int(x1 - x0), int(y1 - y0)]

# 各コマの範囲（元画像 1408×768 の座標 x0, y0, x1, y1）。並びは「溜め → 振り → 着弾 → 余韻」
BOXES = {
  'bat':    [(200, 100, 440, 300), (470, 90, 700, 310), (740, 50, 1310, 345), (25, 385, 730, 740), (780, 425, 1330, 705)],
  'chair':  [(45, 240, 310, 530), (335, 110, 700, 660), (705, 110, 1065, 660), (1065, 140, 1395, 630)],
  'desk':   [(150, 100, 460, 295), (790, 45, 1355, 345), (20, 380, 700, 735), (810, 440, 1370, 735)],
  'dagger': [(95, 290, 265, 470), (350, 270, 705, 480), (705, 80, 1080, 690), (1090, 200, 1360, 590)],
  'sword':  [(95, 55, 480, 365), (795, 10, 1350, 375), None, (805, 405, 1335, 730)],
  'axe':    [(150, 95, 500, 345), (670, 30, 1350, 370), (25, 405, 750, 745), (780, 420, 1380, 745)],
}
info = {}
for wpn, boxes in BOXES.items():
    rgba = key(Image.open(os.path.join(SRC, f'sp_{wpn}.jpg')), lo=80 if wpn == 'desk' else 40, hi=170 if wpn == 'desk' else None)
    if wpn in ('bat', 'chair', 'sword', 'axe'):   # 暖色・紫の素材：緑がにじんだ（半透明の光が緑と混ざった）所をほどく
        src = np.asarray(Image.open(os.path.join(SRC, f'sp_{wpn}.jpg')).convert('RGB')).astype(np.float32)
        bgc = np.median(src[:8, :8].reshape(-1, 3), axis=0)
        r, g, bb = src[..., 0], src[..., 1], src[..., 2]
        greenish = g > np.maximum(r, bb) + 8
        if wpn in ('bat', 'chair'):   # 炎の光のふち（オリーブ色）も緑が混ざった色。黄色（赤が強い）は除く
            greenish |= (g > r * 0.8) & (r < 220) & (bb < 120)
        # 光の本当の色は赤（または青）が強い → その強さから透明度を見積もり、緑を差し引いて元の色に戻す
        a2 = np.clip(np.maximum(r - bgc[0], bb - bgc[2]) / (255 - min(bgc[0], bgc[2])) * 1.05, 0, 1)
        f = rgba.astype(np.float32)
        A = np.maximum(a2, 1e-3)[..., None]
        col = np.clip((src - (1 - A) * bgc) / A, 0, 255)
        col[..., 1] = np.minimum(col[..., 1], np.maximum(col[..., 0], col[..., 2]) * 0.97)
        m = greenish & (f[..., 3] > 0)
        f[m, :3] = col[m]; f[m, 3] = np.minimum(f[m, 3], a2[m] * 255)
        rgba = f.astype(np.uint8)
    sizes = []
    for i, b in enumerate(boxes):
        src = rgba
        if b is None:   # 剣の爆発（見切れていたので単品の画像から）
            src = key(Image.open(os.path.join(SRC, 'sp_sword_impact.jpg'))); b = (0, 0, src.shape[1], src.shape[0])
        part = src[b[1]:b[3], b[0]:b[2]]
        ys, xs = np.nonzero(part[..., 3] > 20)
        part = part[max(0, ys.min() - 4):ys.max() + 5, max(0, xs.min() - 4):xs.max() + 5]
        Image.fromarray(part).save(os.path.join(OUT, f'sp_{wpn}_{i}.png')); sizes.append([int(part.shape[1]), int(part.shape[0])])
    info[wpn] = sizes
print(json.dumps(info))
