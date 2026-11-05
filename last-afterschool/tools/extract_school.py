"""Cut the town / schoolyard / home-ec / rooftop sheets (1509x688, flat blue background).
Usage (from last-afterschool/):  python3 -I tools/extract_school.py   -> assets/env/<set>_<name>.png
bands: the three background strips are slices of one picture (stacked in game, top to bottom).
strips: ground textures (kept opaque). props: keyed against the sheet colour and cropped.
"""
import os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract_biomes import key, crop, SRC, OUT

SETS = {
    'town2': {'sheet': 'sheet_env_town2.jpg', 'bg': (20, 71, 128),
        'bands': [(792, 31, 1509, 116), (791, 127, 1509, 218), (792, 227, 1509, 318)],
        'strips': {'road': (9, 302, 550, 343), 'walk': (9, 356, 550, 401), 'brick': (9, 412, 550, 457)},
        'props': {'house': (806, 368, 1005, 498), 'store': (1035, 368, 1242, 498), 'school': (1262, 343, 1509, 498),
                  'smith': (806, 536, 1005, 664), 'lamp': (1022, 556, 1066, 664), 'lamp2': (1066, 552, 1114, 662),
                  'bench': (1126, 566, 1204, 607), 'tree': (1214, 530, 1270, 622), 'tree2': (1270, 530, 1322, 622),
                  'hedge': (1346, 572, 1424, 614), 'hedge2': (1426, 572, 1506, 614), 'postbox': (580, 536, 614, 588),
                  'plant': (684, 550, 722, 592), 'i_water': (40, 60, 110, 205)}},
    'yard': {'sheet': 'sheet_env_yard.jpg', 'bg': (19, 70, 127),
        'bands': [(798, 30, 1509, 117), (798, 126, 1509, 217), (798, 226, 1509, 319)],
        'strips': {'ground': (9, 301, 555, 345), 'soil': (9, 357, 555, 402), 'soilroad': (9, 413, 555, 459)},
        'props': {'wall': (810, 466, 906, 501), 'wallbroken': (932, 466, 1012, 501), 'fence': (1044, 424, 1248, 501),
                  'school': (1270, 343, 1509, 502), 'garage': (810, 572, 914, 666), 'gate': (918, 572, 1010, 666),
                  'lamp': (1028, 566, 1068, 668), 'lamp2': (1068, 566, 1106, 668), 'beams': (1232, 532, 1342, 607),
                  'beams2': (1232, 607, 1346, 668), 'lockers': (1354, 536, 1442, 612), 'lockers2': (1440, 536, 1509, 612)}},
    'homeec': {'sheet': 'sheet_env_homeec.jpg', 'bg': (17, 70, 122),
        'bands': [(810, 34, 1509, 118), (809, 127, 1509, 219), (809, 228, 1509, 321)],
        'strips': {'floor': (9, 247, 560, 291), 'wall': (9, 303, 560, 347), 'wall2': (9, 359, 560, 404), 'ceiling': (9, 417, 560, 462)},
        'props': {'lockers': (820, 386, 948, 518), 'firebox': (996, 404, 1060, 484), 'cabinet': (1072, 384, 1176, 518),
                  'fridge': (1186, 386, 1266, 516), 'counter': (820, 562, 1052, 660), 'dishrack': (1058, 596, 1142, 660),
                  'stools': (1158, 604, 1232, 664), 'i_knife': (50, 48, 150, 145), 'i_pan': (222, 48, 334, 135),
                  'i_apron': (372, 36, 466, 158), 'i_recipe': (606, 36, 716, 155)}},
    'roof': {'sheet': 'sheet_env_roof.jpg', 'bg': (18, 69, 122),
        'bands': [(1078, 27, 1509, 119), (811, 124, 1509, 219), (811, 227, 1509, 321)],   # 空は左上に文字があるので右側だけ
        'strips': {'floor': (9, 303, 565, 347), 'walkway': (9, 359, 565, 404), 'concrete': (9, 417, 565, 461)},
        'props': {'ac': (828, 380, 1054, 518), 'lockers': (1078, 380, 1260, 518), 'entrance': (1308, 346, 1448, 508),
                  'tank': (826, 540, 938, 670), 'firebox': (942, 552, 1026, 670), 'bench': (1048, 556, 1142, 608),
                  'bench2': (1144, 556, 1240, 608), 'rubble': (1378, 536, 1509, 612)}},
}

def main():
    os.makedirs(OUT, exist_ok=True)
    for name, B in SETS.items():
        a = np.asarray(Image.open(os.path.join(SRC, B['sheet'])).convert('RGB')).astype(int)
        save = lambda img, n: img.save(os.path.join(OUT, f'{name}_{n}.png'), optimize=True)
        for i, b in enumerate(B['bands']): save(Image.fromarray(crop(a, b).astype(np.uint8)), f'band{i}')
        for n, b in B['strips'].items(): save(Image.fromarray(crop(a, b).astype(np.uint8)), n)
        for n, b in B['props'].items():
            img = key(crop(a, b), B['bg']); bb = img.getbbox(); save(img.crop(bb) if bb else img, n)
        print(name, 'ok')

if __name__ == '__main__':
    main()
