"""Cut the friend (Mio) sheet (assets/source/sheet_friend.png, green screen) into sprites.
Standing poses -> assets/sprites/friend_stand.png (+ SPRITE_DATA.friend), faces -> friend_face_*.png.
Called from tools/extract_sprites.py.
"""
import os
import numpy as np
from PIL import Image
from extract_hero import key_green, label_blocks, SRC, OUT, TARGET_FIG_H, WORLD_SCALE

SHEET = 'sheet_friend.png'
# 表情パネル（左上→右下）。会話で使う名前に対応させる
FACES = [('laugh', (553, 650, 781, 873)), ('happy', (795, 650, 1022, 873)), ('surprise', (1035, 650, 1255, 873)),
         ('sulk', (553, 893, 781, 1166)), ('think', (795, 893, 1022, 1166)), ('shy', (1035, 893, 1255, 1166))]

def build(data):
    rgb = np.asarray(Image.open(os.path.join(SRC, SHEET)).convert('RGB'))
    rgba, fg = key_green(rgb)
    # 立ち姿：右上の領域（x>560, y<630）にある3人
    sub = fg[:630, 560:]
    lab, sizes = label_blocks(sub, block=2, grow=0)
    big = sorted([L for L, n in sizes.items() if n >= 1500], key=lambda L: np.nonzero(lab == L)[1].min())
    frames = []
    for L in big:
        m = np.zeros_like(fg); m[:630, 560:] = (lab == L) & sub
        ys, xs = np.nonzero(m)
        im = rgba.copy(); im[..., 3] = np.where(m, 255, 0)
        frames.append(Image.fromarray(im[ys.min():ys.max() + 1, xs.min():xs.max() + 1], 'RGBA'))
    # 主人公の待機と同じ身長にそろえる（親友は少し小柄：0.96）
    scale = TARGET_FIG_H * 0.96 / max(f.height for f in frames)
    frames = [f.resize((round(f.width * scale), round(f.height * scale)), Image.LANCZOS) for f in frames]
    W = sum(f.width for f in frames) + 2 * len(frames); H = max(f.height for f in frames)
    strip = Image.new('RGBA', (W, H)); meta, x = [], 0
    for f in frames:
        strip.paste(f, (x, H - f.height))
        a = np.asarray(f)[..., 3] > 0; xs = np.nonzero(a[int(f.height * .45):int(f.height * .6)])[1]
        meta.append({'x': x, 'y': H - f.height, 'w': f.width, 'h': f.height, 'ax': int(xs.mean()) if len(xs) else f.width // 2, 'ay': f.height})
        x += f.width + 2
    strip.save(os.path.join(OUT, 'friend_stand.png'), optimize=True)
    data['friend'] = {'stand': {'img': 'assets/sprites/friend_stand.png', 'frames': meta, 'scale': WORLD_SCALE}, 'faces': {}}
    for name, (x0, y0, x1, y1) in FACES:
        im = Image.fromarray(rgba[y0:y1, x0:x1], 'RGBA')
        s = min(im.width, im.height); im = im.crop(((im.width - s) // 2, 0, (im.width - s) // 2 + s, s)).resize((128, 128), Image.LANCZOS)
        im.save(os.path.join(OUT, f'friend_face_{name}.png'), optimize=True)
        data['friend']['faces'][name] = f'assets/sprites/friend_face_{name}.png'
    print('friend frames', [(f.width, f.height) for f in frames])
