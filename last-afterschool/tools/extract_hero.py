"""Cut the heroine motion sheets (green screen, 1024x1024) into game sprites.

Called from tools/extract_sprites.py. Each sheet holds frames laid out in two rows
(left to right, top row first). The idle / walk sheets also hold a large key-art
illustration on the left, which is skipped (and the idle one becomes the title art).

Sprites are stored at 2x the in-game size (the game renders at 1920x1080 and
draws them at scale 0.5 in world units), so the detail of the new art survives.
"""
import os
from collections import deque
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'source')
OUT = os.path.join(ROOT, 'assets', 'sprites')

SHEETS = {  # anim name: (sheet file, expected frame count)
    'idle': ('hero_idle.jpg', 5),   # 左側に大きなイラストあり
    'walk': ('hero_walk.jpg', 5),   # 同上
    'run': ('hero_run.jpg', 8),
    'kick': ('hero_kick.jpg', 8),
    'hurt': ('hero_hurt.jpg', 7),
    'bat': ('hero_bat.jpg', 8),
    'chair': ('hero_chair.jpg', 8),
    'desk': ('hero_desk.jpg', 8),
}
TARGET_FIG_H = 300   # idle figure height in the saved sprite (= 150 world px at scale 0.5)
WORLD_SCALE = 0.5
WEAPON_ANIMS = ('bat', 'chair', 'desk')
FLIP = ('bat',)          # 元絵が左向きに振っているので右向きにそろえる
HEAD_ALIGN = ('run',)    # 空中のコマがあるので、足元ではなく頭の高さでそろえる


def key_green(rgb):
    """Green screen -> alpha, plus despill so no green fringe remains."""
    a = rgb.astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    bg = (g > r + 40) & (g > b + 40)
    out = a.copy()
    spill = (~bg) & (g > np.maximum(r, b))
    out[..., 1] = np.where(spill, np.maximum(r, b), g)
    alpha = np.where(bg, 0, 255)
    return np.dstack([out, alpha]).astype(np.uint8), ~bg


def label_blocks(fg, block=4, grow=1):
    """Connected components on a downsampled, slightly grown mask (hair strands join their figure)."""
    h, w = fg.shape
    hb, wb = h // block, w // block
    m = fg[:hb * block, :wb * block].reshape(hb, block, wb, block).any(axis=(1, 3))
    for _ in range(grow):
        g = m.copy(); g[1:] |= m[:-1]; g[:-1] |= m[1:]; g[:, 1:] |= m[:, :-1]; g[:, :-1] |= m[:, 1:]; m = g
    lab = np.zeros(m.shape, int); n = 0; sizes = {}
    for y in range(hb):
        for x in range(wb):
            if m[y, x] and not lab[y, x]:
                n += 1; q = deque([(y, x)]); lab[y, x] = n; cnt = 0
                while q:
                    cy, cx = q.popleft(); cnt += 1
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            ny, nx = cy + dy, cx + dx
                            if 0 <= ny < hb and 0 <= nx < wb and m[ny, nx] and not lab[ny, nx]:
                                lab[ny, nx] = n; q.append((ny, nx))
                sizes[n] = cnt
    full = np.kron(lab, np.ones((block, block), int))
    pad = np.zeros((h, w), int); pad[:full.shape[0], :full.shape[1]] = full
    return pad, sizes


def figures(path, expect):
    rgb = np.asarray(Image.open(os.path.join(SRC, path)).convert('RGB'))
    rgba, fg = key_green(rgb)
    lab, sizes = label_blocks(fg, block=2, grow=0)
    comps = {}
    for L, cnt in sizes.items():
        ys, xs = np.nonzero(lab == L)
        comps[L] = {'L': [L], 'n': cnt, 'y0': ys.min(), 'y1': ys.max() + 1, 'x0': xs.min(), 'x1': xs.max() + 1}
    big = [c for c in comps.values() if c['n'] >= 1500]
    # 細かい破片（髪の毛先など）は、一番近い大きな塊にくっつける
    for c in comps.values():
        if c['n'] >= 1500 or c['n'] < 6: continue
        cx, cy = (c['x0'] + c['x1']) / 2, (c['y0'] + c['y1']) / 2
        def dist(B):
            dx = max(B['x0'] - cx, 0, cx - B['x1']); dy = max(B['y0'] - cy, 0, cy - B['y1'])
            return dx * dx + dy * dy
        B = min(big, key=dist)
        if dist(B) < 60 ** 2:
            B['L'] += c['L']
            B['x0'] = min(B['x0'], c['x0']); B['x1'] = max(B['x1'], c['x1'])
            B['y0'] = min(B['y0'], c['y0']); B['y1'] = max(B['y1'], c['y1'])
    # idle / walk sheets: everything starting in the left third is the big illustration
    has_art = path in ('hero_idle.jpg', 'hero_walk.jpg')
    art = [c for c in big if has_art and c['x0'] < 300]
    frames = [c for c in big if not (has_art and c['x0'] < 300)]
    # 隣のコマと触れて1つになった塊は、縦に一番細い列で2つに切る
    while len(frames) < expect:
        c = max(frames, key=lambda c: c['n'])
        sel = np.isin(lab, c['L']) & fg
        cols = sel[:, c['x0']:c['x1']].sum(axis=0)
        w = c['x1'] - c['x0']; lo, hi = int(w * 0.3), int(w * 0.7)
        cut = c['x0'] + lo + int(np.argmin(cols[lo:hi]))
        left = dict(c, x1=cut, n=c['n'] // 2, clip=(c['x0'], cut))
        right = dict(c, x0=cut, n=c['n'] // 2, clip=(cut, c['x1']))
        frames.remove(c); frames += [left, right]
    frames.sort(key=lambda c: (0 if (c['y0'] + c['y1']) / 2 < 512 else 1, c['x0']))
    if len(frames) != expect:
        raise SystemExit(f'{path}: found {len(frames)} figures, expected {expect}: {[(int(c["x0"]), int(c["y0"]), c["n"]) for c in frames]}')
    def cut(cs):
        sel = np.isin(lab, [L for c in cs for L in c['L']]) & fg
        for c in cs:
            if 'clip' in c:
                keep = np.zeros_like(sel); keep[:, c['clip'][0]:c['clip'][1]] = True; sel &= keep
        y0 = min(c['y0'] for c in cs); y1 = max(c['y1'] for c in cs)
        x0 = min(c['x0'] for c in cs); x1 = max(c['x1'] for c in cs)
        im = rgba.copy(); im[..., 3] = np.where(sel, 255, 0)
        return Image.fromarray(im[y0:y1, x0:x1], 'RGBA')
    return [cut([c]) for c in frames], ([cut(art)] if art else [])


def body_x(img, use_feet):
    """Horizontal anchor: centre of the skirt band (or of both shoes for wide weapon stances)."""
    a = np.asarray(img)[..., 3] > 0
    h = a.shape[0]
    band = a[int(h * 0.94):] if use_feet else a[int(h * 0.45):int(h * 0.58)]
    ys, xs = np.nonzero(band)
    return float(xs.mean()) if len(xs) else img.width / 2


def pack(name, imgs, scale, use_feet, head_align=False):
    imgs = [im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS) for im in imgs]
    W = sum(im.width for im in imgs) + 2 * len(imgs); H = max(im.height for im in imgs)
    strip = Image.new('RGBA', (W, H), (0, 0, 0, 0)); meta, x = [], 0
    for im in imgs:
        strip.paste(im, (x, H - im.height))
        meta.append({'x': x, 'y': H - im.height, 'w': im.width, 'h': im.height,
                     'ax': round(body_x(im, use_feet)), 'ay': H if head_align else im.height})
        x += im.width + 2
    strip.save(os.path.join(OUT, f'{name}.png'), optimize=True)
    return {'img': f'assets/sprites/{name}.png', 'frames': meta, 'scale': WORLD_SCALE}


def build(data):
    frames, keyart = {}, None
    for anim, (sheet, n) in SHEETS.items():
        f, art = figures(sheet, n)
        if anim in FLIP: f = [im.transpose(Image.FLIP_LEFT_RIGHT) for im in f]
        frames[anim] = f
        if anim == 'idle' and art: keyart = art[0]
    scale = TARGET_FIG_H / frames['idle'][0].height
    heroine = {k: v for k, v in data.get('heroine', {}).items() if k == 'burst'}
    for anim in ('idle', 'walk', 'run', 'kick', 'hurt'):
        heroine[anim] = pack(f'hero_{anim}', frames[anim], scale, use_feet=False, head_align=anim in HEAD_ALIGN)
    data['heroine'] = heroine
    data['swing'] = {k: pack(f'hero_swing_{k}', frames[k], scale, use_feet=True) for k in WEAPON_ANIMS}
    data.pop('carry', None)
    if keyart is not None:
        k = keyart.resize((round(keyart.width * 0.6), round(keyart.height * 0.6)), Image.LANCZOS)
        k.save(os.path.join(OUT, 'keyart.png'), optimize=True)
        data['keyart'] = 'assets/sprites/keyart.png'
    return scale
