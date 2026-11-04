"""Bundle the whole game into ONE self-contained HTML file (code + images + music inlined).

Usage (from last-afterschool/):  python3 -I tools/build_single.py [out.html]
Useful for testing on devices / hosts where a multi-file page can't be served.
"""
import base64, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'dist', 'last-afterschool.html')
html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()

MIME = {'.png': 'image/png', '.mp3': 'audio/mpeg'}
assets = {}
config = open(os.path.join(ROOT, 'src', 'config.js'), encoding='utf-8').read()
used_mon = set(re.findall(r"spr: '(\w+)'", config)) | {'wyrmling'}
for d in ('assets/sprites', 'assets/bgm'):
    for f in sorted(os.listdir(os.path.join(ROOT, d))):
        ext = os.path.splitext(f)[1]
        if f.startswith('mon_') and f[4:-4] not in used_mon:
            continue  # unused monster sprites are left out
        if ext in MIME:
            data = open(os.path.join(ROOT, d, f), 'rb').read()
            assets[f'{d}/{f}'] = f'data:{MIME[ext]};base64,' + base64.b64encode(data).decode()

def inline(m):
    src = open(os.path.join(ROOT, m.group(1)), encoding='utf-8').read()
    return '<script>\n' + src.replace('</script', '<\\/script') + '\n</script>'

body = re.sub(r'<script src="([^"]+)"></script>', inline, html)
asset_js = '<script>window.ASSET_MAP = ' + json.dumps(assets) + ';</script>\n'
body = body.replace('<script>', asset_js + '<script>', 1)
os.makedirs(os.path.dirname(out), exist_ok=True)
open(out, 'w', encoding='utf-8').write(body)
print(out, f'{os.path.getsize(out) / 1e6:.1f} MB')
