"""Cut the heroine / monster sprites out of the concept sheets.

Usage (from worlds-end-girl/):  python3 -I tools/extract_sprites.py
Writes assets/sprites/*.png and src/sprite_data.js (frame rects + foot anchors).

Each heroine frame is a cell on a flat purple panel; we flood-fill the panel
colour from the cell edges to make it transparent, then record the foot anchor
(bottom-centre of the feet) so frames of different size line up in game.
"""
import json, os, sys
from collections import deque
import numpy as np
from PIL import Image


def save_small(img, path):
    """Save as a palette PNG (<=255 colours + transparency): ~1/3 the size, same look for pixel art."""
    img = img.convert('RGBA')
    a = np.asarray(img)
    rgb = Image.fromarray(a[:, :, :3])
    q = rgb.quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    idx = np.asarray(q).copy()
    idx[a[:, :, 3] < 128] = 255
    out = Image.fromarray(idx.astype(np.uint8), 'P')
    pal = q.getpalette()[:255 * 3] + [0, 0, 0]
    out.putpalette(pal)
    out.save(path, optimize=True, transparency=255)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'source')
OUT = os.path.join(ROOT, 'assets', 'sprites')

# Exact cell rectangles (x0, y0, x1, y1) measured on the 1024px sheets.
C4 = [(19, 173), (180, 339), (346, 507), (513, 673)]
C6 = C4 + [(682, 839), (849, 1000)]
W6 = [(19, 174), (180, 341), (347, 509), (514, 676), (682, 843), (849, 1004)]  # weapons sheet
def row(cols, y0, y1): return [(x0, y0, x1, y1) for x0, x1 in cols]

# (name, sheet, cells, top-left label box to erase (w,h) or None)
HEROINE = [
    ('idle', 'sheet_heroine_basic.jpg', row(C4, 298, 423), None),
    ('walk', 'sheet_heroine_basic.jpg', row(C4, 483, 609), None),
    ('run', 'sheet_heroine_basic.jpg', row(C6, 659, 781), None),
    ('kick', 'sheet_heroine_basic.jpg', [(19, 832, 209, 997), (217, 832, 403, 997), (408, 832, 640, 997),
                                         (647, 832, 815, 997), (828, 832, 1000, 997)], (34, 34)),
    ('swingS', 'sheet_heroine_weapons.jpg', row(W6, 298, 420), None),
    ('swingM', 'sheet_heroine_weapons.jpg', row(W6, 483, 609), None),
    # big swing: wind-up, slam (burst is a separate effect), recover
    ('swingL', 'sheet_heroine_weapons.jpg', row(W6[:3], 674, 817) + [(849, 674, 1004, 817)] + row(W6[:1], 843, 988), None),
    # big follow-up spin slash
    ('swingL2', 'sheet_heroine_weapons.jpg', row(W6[1:], 843, 988), None),
    ('burst', 'sheet_heroine_weapons.jpg', [(514, 674, 840, 817)], None),
]

def load(name):
    return np.asarray(Image.open(os.path.join(SRC, name)).convert('RGB')).astype(int)

def key_cell(a, rect, inset=3, tol=19, label=None):
    l, t, r, b = rect
    l, t, r, b = l + inset, t + inset, r - inset, b - inset
    cell = a[t:b, l:r].copy()
    h = cell.shape[0]
    if label:  # paint over the frame letter with the panel colour
        cell[:label[1], :label[0]] = np.median(cell[label[1]:label[1] + 4, :label[0]].reshape(-1, 3), axis=0)
    h, w, _ = cell.shape
    # panel colour = median of the border pixels
    border = np.concatenate([cell[0], cell[-1], cell[:, 0], cell[:, -1]])
    bg = np.median(border, axis=0)
    dist = np.abs(cell - bg).sum(axis=2)
    shadow = np.abs(cell - bg * 0.72).sum(axis=2) < 16 * 3  # baked-in drop shadow tone
    shadow[:h - 16] = False  # only near the floor line, so skirt/legs survive
    near = (dist < tol * 3) | shadow
    # flood fill from edges through "near panel colour" pixels
    seen = np.zeros((h, w), bool)
    q = deque()
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
    # also remove the soft drop shadow (darker panel tone touching the bg region)
    alpha = np.where(seen, 0, 255).astype(np.uint8)
    # erode 1px of fringe that is still close to bg
    fringe = (~seen) & (dist < tol * 4)
    nb = np.zeros_like(seen)
    nb[1:] |= seen[:-1]; nb[:-1] |= seen[1:]; nb[:, 1:] |= seen[:, :-1]; nb[:, :-1] |= seen[:, 1:]
    alpha[fringe & nb] = 0
    rgba = np.dstack([cell.astype(np.uint8), alpha])
    return Image.fromarray(rgba, 'RGBA')

def foot_anchor(img):
    a = np.asarray(img)[:, :, 3] > 0
    ys, xs = np.nonzero(a)
    if len(ys) == 0: return img.width // 2, img.height
    # rows that belong to the body: use columns with many opaque pixels to ignore wide effects
    colcount = a.sum(axis=0)
    body_cols = np.nonzero(colcount > colcount.max() * 0.45)[0]
    cx = int(np.median(body_cols)) if len(body_cols) else int(np.median(xs))
    # feet: lowest opaque row within +-25px of body centre
    sub = a[:, max(0, cx - 25):cx + 25]
    rows = np.nonzero(sub.any(axis=1))[0]
    fy = int(rows.max()) + 1 if len(rows) else img.height
    return cx, fy

def pack(name, frames):
    """Pack frames horizontally in one strip; return metadata."""
    W = sum(f.width for f in frames) + 2 * len(frames)
    H = max(f.height for f in frames)
    strip = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    meta, x = [], 0
    for f in frames:
        strip.paste(f, (x, 0))
        ax, ay = foot_anchor(f)
        meta.append({'x': x, 'y': 0, 'w': f.width, 'h': f.height, 'ax': ax, 'ay': ay})
        x += f.width + 2
    # effects can drag the body-centre estimate around; clamp outliers to the median
    med = int(np.median([m['ax'] for m in meta]))
    for m in meta:
        if abs(m['ax'] - med) > 12: m['ax'] = med
    save_small(strip, os.path.join(OUT, f'heroine_{name}.png'))
    return {'img': f'assets/sprites/heroine_{name}.png', 'frames': meta}

# --- monsters: dark navy background, flood fill from edges of each bbox -------------
MONSTERS = {
    # name: (x0, y0, x1, y1) rough boxes on sheet_monsters.png (1536x1024)
    'slime_s':   (40, 120, 140, 205),
    'slime_p':   (165, 115, 270, 205),
    'slime_l':   (315, 90, 465, 210),
    'bat':       (475, 60, 650, 160),
    'bat_big':   (655, 55, 880, 175),
    'ghost':     (895, 60, 1010, 170),
    'ghost2':    (1050, 60, 1160, 170),
    'reaper':    (1180, 50, 1340, 190),
    'skullfire': (1355, 40, 1500, 180),
    'shroom':    (25, 235, 155, 335),
    'shroom_s':  (180, 260, 270, 335),
    'shroom_l':  (320, 210, 470, 340),
    'sprout':    (495, 245, 575, 330),
    'sprout2':   (605, 210, 735, 330),
    'imp':       (815, 245, 910, 330),
    'imp_s':     (950, 255, 1030, 330),
    'beast':     (1065, 215, 1240, 340),
    'wyrmling':  (1300, 210, 1510, 340),
    'knight':    (20, 390, 155, 525),
    'knight2':   (170, 390, 300, 525),
    'knight_l':  (300, 370, 515, 530),
    'hood':      (590, 400, 710, 525),
    'reaper2':   (710, 370, 940, 530),
    'eye_wing':  (975, 400, 1120, 470),
    'eye_bat':   (1130, 380, 1330, 530),
    'eye_mech':  (1360, 400, 1515, 525),
    'golem_s':   (25, 580, 150, 725),
    'golem_m':   (180, 590, 300, 725),
    'golem':     (325, 550, 555, 730),
    'spider':    (580, 640, 690, 725),
    'spider2':   (690, 600, 870, 725),
    'wolf':      (880, 600, 1010, 725),
    'wolf_l':    (1020, 560, 1210, 725),
    'wisp':      (1235, 585, 1335, 700),
    'wisp_l':    (1370, 560, 1510, 710),
    'skeleton':  (5, 785, 190, 940),
    'skel_l':    (190, 760, 430, 945),
    'succubus':  (445, 750, 690, 975),
    'dragon':    (650, 740, 1035, 990),
    'castle':    (1035, 745, 1255, 985),
    'eldereye':  (1270, 760, 1520, 990),
}

def key_monster(a, box, tol=30):
    x0, y0, x1, y1 = box
    cell = a[y0:y1, x0:x1]
    h, w, _ = cell.shape
    lum = cell.mean(axis=2)
    bgcol = np.array([24, 24, 40])
    dist = np.abs(cell - bgcol).sum(axis=2)
    near = dist < tol * 3
    seen = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near[y, x]: seen[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if near[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not seen[ny, nx] and near[ny, nx]:
                seen[ny, nx] = True; q.append((ny, nx))
    alpha = np.where(seen, 0, 255).astype(np.uint8)
    img = Image.fromarray(np.dstack([cell.astype(np.uint8), alpha]), 'RGBA')
    bb = img.getbbox()
    return img.crop(bb) if bb else img


def close_feet(alpha_mask, rows=34, it=2):
    """足元だけ「閉じる」処理（膨張→収縮）で、背景色に近い靴の中身の抜けを埋める。"""
    m = alpha_mask.copy(); h = m.shape[0]; y0 = max(0, h - rows)
    sub = m[y0:]
    def dil(a):
        o = a.copy(); o[1:] |= a[:-1]; o[:-1] |= a[1:]; o[:, 1:] |= a[:, :-1]; o[:, :-1] |= a[:, 1:]; return o
    def ero(a):
        o = a.copy(); o[1:] &= a[:-1]; o[:-1] &= a[1:]; o[:, 1:] &= a[:, :-1]; o[:, :-1] &= a[:, 1:]; return o
    c = sub
    for _ in range(it): c = dil(c)
    for _ in range(it): c = ero(c)
    m[y0:] = c | sub
    return m

# ---------------------------------------------------------------------------
#  武器の振りモーション（sheet_weapon_motion.jpg：武器を持った全身コマ）
# ---------------------------------------------------------------------------
SWING_SHEET = 'sheet_weapon_motion.jpg'
SWING_CELLS = {
    'bat':   (272, 396, [(17, 149), (160, 292), (303, 436), (438, 562), (572, 696), (706, 829), (839, 962), (972, 1097)]),
    # 主人公が写っているコマだけ使う（椅子の破片だけ・机だけのコマは除外）
    'chair': (438, 562, [(17, 149), (160, 292), (303, 436), (438, 562)]),
    'desk':  (604, 728, [(17, 149), (160, 292), (303, 436), (438, 562)]),
}

def key_swing_cell(a, rect, inset=4, tol=60):
    """Remove the flat panel colour (edge-connected) and return a cropped RGBA frame + foot anchor."""
    l, t, r, b = rect
    cell = a[t + inset:b - inset, l + inset:r - inset].copy()
    h, w, _ = cell.shape
    bg = np.median(np.concatenate([cell[0], cell[-1], cell[:, 0], cell[:, -1]]), axis=0)
    near = np.abs(cell - bg).sum(axis=2) < tol
    shadow = np.abs(cell - bg * 0.74).sum(axis=2) < 45  # 足元の焼き込み影
    shadow[:h - 18] = False
    near |= shadow
    seen = np.zeros((h, w), bool); q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near[y, x]: seen[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if near[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not seen[ny, nx] and near[ny, nx]:
                seen[ny, nx] = True; q.append((ny, nx))
    alpha = np.where(close_feet(~seen), 255, 0).astype(np.uint8)
    img = Image.fromarray(np.dstack([cell.astype(np.uint8), alpha]), 'RGBA')
    bb = img.getbbox()
    if not bb: return img, (w // 2, h)
    img = img.crop(bb)
    # foot anchor: centre of the lowest opaque rows (the shoes), so frames line up on the ground
    arr = np.asarray(img)[:, :, 3] > 0
    low = np.nonzero(arr[-8:].any(axis=0))[0]
    ax = int(np.median(low)) if len(low) else img.width // 2
    return img, (ax, img.height)

def pack_cells(name, frames):
    """枠ごとのコマを横に並べて保存。足元＝靴の位置、左右＝枠の中央で揃える。"""
    # エフェクトが下端に届くコマがあるので、コマごとの最下行の中央値を足元にする
    foot = int(np.median([np.nonzero((np.asarray(f)[:, :, 3] > 0).sum(axis=1) >= 4)[0].max() + 1 for f in frames]))
    W = sum(f.width for f in frames) + 2 * len(frames); H = max(f.height for f in frames)
    strip = Image.new('RGBA', (W, H), (0, 0, 0, 0)); meta, x = [], 0
    for f in frames:
        strip.paste(f, (x, 0))
        meta.append({'x': x, 'y': 0, 'w': f.width, 'h': f.height, 'ax': f.width // 2, 'ay': foot})
        x += f.width + 2
    save_small(strip, os.path.join(OUT, f'{name}.png'))
    return {'img': f'assets/sprites/{name}.png', 'frames': meta}

def cut_swing(data):
    src = np.asarray(Image.open(os.path.join(SRC, SWING_SHEET)).convert('RGB')).astype(int)
    data['swing'] = {key: pack_cells(f'swing_{key}', [key_carry_cell(src, (x0, y0, x1, y1), label=(0, 0)) for x0, x1 in cols])
                     for key, (y0, y1, cols) in SWING_CELLS.items()}

# ---------------------------------------------------------------------------
#  武器を持った歩き・走り（sheet_carry_*.jpg）。待機は歩きの1コマ目を使う
# ---------------------------------------------------------------------------
_C7 = [(17, 149), (158, 290), (298, 430), (438, 570), (577, 709), (716, 848), (855, 987)]
CARRY_CELLS = {
    ('bat', 'walk'):   ('sheet_carry_bat_chair.jpg', 105, 228, [(298, 430), (438, 570), (577, 709), (716, 848), (855, 987), (994, 1125)]),
    ('bat', 'run'):    ('sheet_carry_bat_chair.jpg', 272, 395, _C7[:6]),
    ('chair', 'walk'): ('sheet_carry_bat_chair.jpg', 438, 561, _C7),
    ('chair', 'run'):  ('sheet_carry_bat_chair.jpg', 604, 727, _C7[:6]),
    ('desk', 'walk'):  ('sheet_carry_desk.jpg', 32, 155, _C7),
    ('desk', 'run'):   ('sheet_carry_desk.jpg', 198, 321, _C7[:6]),
}

def key_carry_cell(a, rect, inset=3, tol=44, label=(32, 22)):
    """Panel colour + baked drop shadow -> transparent. Keeps the full cell so the body stays put."""
    l, t, r, b = rect
    cell = a[t + inset:b - inset, l + inset:r - inset].copy()
    h, w, _ = cell.shape
    bg = np.median(np.concatenate([cell[0], cell[-1], cell[:, 0], cell[:, -1]]), axis=0)
    cell[:label[1], :label[0]] = bg  # 「W1」などのラベルを消す
    near = np.abs(cell - bg).sum(axis=2) < tol
    # 足元の焼き込み影（薄い外側）。濃い色は靴の輪郭なので残す
    shadow = np.abs(cell - bg * 0.74).sum(axis=2) < 45
    shadow[:h - 18] = False
    near |= shadow
    seen = np.zeros((h, w), bool); q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near[y, x]: seen[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if near[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not seen[ny, nx] and near[ny, nx]:
                seen[ny, nx] = True; q.append((ny, nx))
    alpha = np.where(close_feet(~seen), 255, 0).astype(np.uint8)
    return Image.fromarray(np.dstack([cell.astype(np.uint8), alpha]), 'RGBA')

def cut_carry(data):
    sheets, out = {}, {}
    for (key, mode), (sheet, y0, y1, cols) in CARRY_CELLS.items():
        a = sheets.setdefault(sheet, np.asarray(Image.open(os.path.join(SRC, sheet)).convert('RGB')).astype(int))
        out.setdefault(key, {})[mode] = pack_cells(f'carry_{key}_{mode}', [key_carry_cell(a, (x0, y0, x1, y1)) for x0, x1 in cols])
    data['carry'] = out

def main():
    os.makedirs(OUT, exist_ok=True)
    data = {'heroine': {}, 'monsters': {}, 'portraits': {}}
    sheets = {}
    # 旧シートからは「机の叩きつけ」の爆発エフェクトだけ使う（主人公は tools/extract_hero.py の新素材）
    for name, sheet, cells, label in [h for h in HEROINE if h[0] == 'burst']:
        a = sheets.setdefault(sheet, load(sheet))
        frames = [key_cell(a, rect, label=label) for rect in cells]
        data['heroine'][name] = pack(name, frames)
        print(name, [(f.width, f.height) for f in frames])

    m = load('sheet_monsters.png')
    for name, box in MONSTERS.items():
        img = key_monster(m, box)
        save_small(img, os.path.join(OUT, f'mon_{name}.png'))
        data['monsters'][name] = {'img': f'assets/sprites/mon_{name}.png', 'w': img.width, 'h': img.height}

    # expression portraits (square crops, kept opaque) from the basic sheet
    basic = Image.open(os.path.join(SRC, 'sheet_heroine_basic.jpg')).convert('RGB')
    faces = {'default': (531, 63, 635, 178), 'happy': (641, 63, 758, 178), 'worried': (764, 63, 881, 178),
             'angry': (887, 63, 1004, 178), 'sad': (764, 184, 881, 299), 'fluster': (887, 184, 1004, 299)}
    for k, box in faces.items():
        basic.crop(box).resize((96, 96), Image.LANCZOS).save(os.path.join(OUT, f'face_{k}.png'))
        data['portraits'][k] = f'assets/sprites/face_{k}.png'
    # key art for title screen
    art = basic.crop((0, 0, 320, 250))
    art.convert('RGB').quantize(colors=256, method=Image.Quantize.MEDIANCUT).save(os.path.join(OUT, 'keyart.png'), optimize=True)
    data['keyart'] = 'assets/sprites/keyart.png'

    # 主人公の新モーション（緑背景シート）とタイトル用キーアート
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import extract_hero
    print('hero scale', round(extract_hero.build(data), 3))
    import extract_friend
    extract_friend.build(data)

    with open(os.path.join(ROOT, 'src', 'sprite_data.js'), 'w') as f:
        f.write('// generated by tools/extract_sprites.py — do not edit by hand\n')
        f.write('window.SPRITE_DATA = ' + json.dumps(data, separators=(',', ':')) + ';\n')

if __name__ == '__main__':
    main()
