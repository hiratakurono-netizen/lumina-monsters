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
# 武器のシートは主人公が小さめに描かれているので、頭頂〜胸のリボンの長さ（待機・歩き・走り・蹴りで約106px）
# がそろうように拡大する。机はリボンが隠れるので、机を持って直立したコマの身長で合わせた値。
SIZE_FIX = {'bat': 1.06, 'chair': 1.17, 'desk': 1.05}
# 元の素材で机が縦にまっすぐ切れているコマ（机の5・6コマ目）は使わない
DROP = {'desk': (5, 6)}
SMART_SPLIT = ('hero_kick.jpg',)
TARGET_FIG_H = 264   # 待機の身長（保存サイズ）。ゲーム内では0.5倍＝132。主人公の大きさを変える時はここと config.js の HERO_SIZE を合わせる
WORLD_SCALE = 0.5
WEAPON_ANIMS = ('bat', 'chair', 'desk')
FLIP = ()                # 反転すると敵に背を向けて振る絵になるので、どのシートも元の向きのまま使う
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


def split_two(m, max_it=12):
    """Erode until the mask falls apart into two big cores, then give every pixel to the core it reaches first."""
    def ero(a):
        o = a.copy(); o[1:] &= a[:-1]; o[:-1] &= a[1:]; o[:, 1:] &= a[:, :-1]; o[:, :-1] &= a[:, 1:]; return o
    core = m.copy()
    for _ in range(max_it):
        core = ero(core)
        lab = np.zeros(core.shape, int); n = 0; sizes = []
        for y, x in zip(*np.nonzero(core)):
            if lab[y, x]: continue
            n += 1; q = deque([(y, x)]); lab[y, x] = n; cnt = 0
            while q:
                cy, cx = q.popleft(); cnt += 1
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < core.shape[0] and 0 <= nx < core.shape[1] and core[ny, nx] and not lab[ny, nx]:
                        lab[ny, nx] = n; q.append((ny, nx))
            sizes.append(cnt)
        big = [i + 1 for i, k in enumerate(sizes) if k > 0.15 * m.sum() / 2]
        if len(big) >= 2:
            big = sorted(big, key=lambda L: -sizes[L - 1])[:2]
            own = np.zeros(m.shape, int); q = deque()
            for k, L in enumerate(big, 1):
                for y, x in zip(*np.nonzero(lab == L)): own[y, x] = k; q.append((y, x))
            while q:  # grow both cores at the same speed through the original mask
                cy, cx = q.popleft()
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < m.shape[0] and 0 <= nx < m.shape[1] and m[ny, nx] and not own[ny, nx]:
                        own[ny, nx] = own[cy, cx]; q.append((ny, nx))
            return [own == 1, own == 2]
    return None


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
    # 隣のコマと触れて1つになった塊は、細い接点を削って2つの芯に分け、
    # それぞれの芯から元の形へ広げ直す（伸ばした足の靴などが隣のコマに取られない）
    while len(frames) < expect:
        c = max(frames, key=lambda c: c['n'])
        sel = c['mask'] if 'mask' in c else (np.isin(lab, c['L']) & fg)
        sub = sel[c['y0']:c['y1'], c['x0']:c['x1']]
        # 細い接点（蹴りの足先）で触れているシートだけ芯から分ける。机・椅子のように太く重なるものは縦切り
        parts = split_two(sub) if path in SMART_SPLIT else None
        if parts is not None:  # 左右の2人にきちんと分かれたか確かめる
            w = sub.shape[1]
            cx = [np.nonzero(m)[1].mean() for m in parts]
            share = [m.sum() / sub.sum() for m in parts]
            if abs(cx[0] - cx[1]) < 0.3 * w or min(share) < 0.3: parts = None
        if parts is None:  # 接点が太くて分かれない時は、縦に一番細い列で切る
            cols = sub.sum(axis=0); w = sub.shape[1]; lo, hi = int(w * 0.3), int(w * 0.7)
            cut = lo + int(np.argmin(cols[lo:hi]))
            left = sub.copy(); left[:, cut:] = False
            right = sub.copy(); right[:, :cut] = False
            parts = [left, right]
        frames.remove(c)
        for m in parts:
            full = np.zeros_like(sel); full[c['y0']:c['y1'], c['x0']:c['x1']] = m
            ys, xs = np.nonzero(full)
            # n はブロック（2x2）単位でそろえる（画素数のままだと切った塊が最大に見えて切り直される）
            frames.append(dict(c, n=int(m.sum()) // 4, mask=full, y0=ys.min(), y1=ys.max() + 1, x0=xs.min(), x1=xs.max() + 1))
    frames.sort(key=lambda c: (0 if (c['y0'] + c['y1']) / 2 < 512 else 1, c['x0']))
    if len(frames) != expect:
        raise SystemExit(f'{path}: found {len(frames)} figures, expected {expect}: {[(int(c["x0"]), int(c["y0"]), c["n"]) for c in frames]}')
    def cut(cs):
        sel = np.zeros_like(fg)
        for c in cs: sel |= c['mask'] if 'mask' in c else (np.isin(lab, c['L']) & fg)
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
        f = [im for i, im in enumerate(f) if i not in DROP.get(anim, ())]
        frames[anim] = f
        if anim == 'idle' and art: keyart = art[0]
    scale = TARGET_FIG_H / frames['idle'][0].height
    heroine = {k: v for k, v in data.get('heroine', {}).items() if k == 'burst'}
    for anim in ('idle', 'walk', 'run', 'kick', 'hurt'):
        heroine[anim] = pack(f'hero_{anim}', frames[anim], scale, use_feet=False, head_align=anim in HEAD_ALIGN)
    data['heroine'] = heroine
    data['swing'] = {k: pack(f'hero_swing_{k}', frames[k], scale * SIZE_FIX.get(k, 1), use_feet=True) for k in WEAPON_ANIMS}
    data.pop('carry', None)
    if keyart is not None:
        k = keyart.resize((round(keyart.width * 0.6), round(keyart.height * 0.6)), Image.LANCZOS)
        k.save(os.path.join(OUT, 'keyart.png'), optimize=True)
        data['keyart'] = 'assets/sprites/keyart.png'
    return scale
