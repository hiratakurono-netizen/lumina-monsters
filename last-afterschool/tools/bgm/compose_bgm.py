# BGM を作る：python3 tools/bgm/compose_bgm.py [曲名 ...]（省略で全曲）→ assets/bgm/<曲名>.mp3
import sys, os, time, wave, subprocess
from multiprocessing import Pool
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from songs import SONGS
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'bgm')

def render(name):
    t0 = time.time()
    S = SONGS[name](); x = S.mix()
    wav = f'/tmp/bgm_{name}.wav'
    with wave.open(wav, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(44100)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype('<i2').tobytes())
    mp3 = os.path.join(OUT, f'{name}.mp3')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '128k', mp3], check=True)
    os.remove(wav)
    return f'{name}: {len(x) / 44100:.1f}s, {os.path.getsize(mp3) // 1024}KB, {time.time() - t0:.0f}s'

if __name__ == '__main__':
    names = sys.argv[1:] or list(SONGS)
    with Pool(4) as p:
        for r in p.imap_unordered(render, names): print(r, flush=True)
