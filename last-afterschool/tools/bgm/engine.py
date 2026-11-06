# =====================================================================
#  BGM の合成エンジン（numpy だけ。外部の音源は使わない）
#  ・楽器：ウェーブテーブル（帯域制限つき）＋FFT フィルター、FM、加算合成、ドラムはノイズと正弦波から
#  ・ミックス：楽器ごとの音量・定位、キックに合わせたサイドチェイン、リバーブ（畳み込み）、ディレイ
#  ・ループ：曲の最後から出たリバーブ・ディレイの余韻を曲の頭に足して、つなぎ目なしで回る
# =====================================================================
import numpy as np, re

SR = 44100
rng = np.random.default_rng(7)

# ---------------- 音名 ----------------
NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def midi(name):
    m = re.match(r'([A-G])([#b]?)(-?\d)', name)
    n = NOTE[m.group(1)] + (1 if m.group(2) == '#' else -1 if m.group(2) == 'b' else 0)
    return 12 * (int(m.group(3)) + 1) + n
def hz(m): return 440.0 * 2 ** ((m - 69) / 12)

QUAL = {'': [0, 4, 7], 'm': [0, 3, 7], '7': [0, 4, 7, 10], 'maj7': [0, 4, 7, 11], 'm7': [0, 3, 7, 10], 'dim': [0, 3, 6],
        'sus4': [0, 5, 7], 'sus2': [0, 2, 7], 'add9': [0, 4, 7, 14], 'madd9': [0, 3, 7, 14], 'aug': [0, 4, 8], 'm7b5': [0, 3, 6, 10]}
def chord(sym, octave=3):
    """'Em' → (根音の midi, 構成音の半音リスト)。'C/E' の分数コードはベースだけ変える"""
    base = None
    if '/' in sym: sym, b = sym.split('/'); base = b
    m = re.match(r'([A-G][#b]?)(.*)', sym)
    root = midi(m.group(1) + str(octave))
    iv = QUAL[m.group(2)]
    bass = midi(base + str(octave)) if base else root
    if bass > root: bass -= 12
    return root, iv, bass

def parse_line(s):
    """'E5:2 G5:2 -:4' → [(midi or None, 16分の長さ)]"""
    out = []
    for tok in s.replace('|', ' ').split():
        n, d = tok.split(':')
        out.append((None if n == '-' else midi(n), float(d)))
    return out

# ---------------- 基本の部品 ----------------
def t_axis(n): return np.arange(n) / SR
def env_adsr(n, a=0.005, d=0.1, s=0.7, r=0.1, hold=None):
    """n サンプル（リリース込み）。hold＝鍵を押している長さ（秒）"""
    hold = n / SR - r if hold is None else hold
    t = t_axis(n)
    e = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    rel = t > hold
    if rel.any():
        lv = e[min(int(hold * SR), n - 1)]
        e[rel] = lv * np.exp(-(t[rel] - hold) / max(r / 4, 1e-4))
    return e

_tables = {}
def table(kind, nh):
    key = (kind, nh)
    if key in _tables: return _tables[key]
    x = np.arange(4096) / 4096
    k = np.arange(1, nh + 1)[:, None]
    if kind == 'saw': w = (np.sin(2 * np.pi * k * x) / k).sum(0)
    elif kind == 'square': w = (np.sin(2 * np.pi * k * x) / k * (k % 2 == 1)).sum(0)
    elif kind == 'tri': w = (np.sin(2 * np.pi * k * x) / k ** 2 * (k % 2 == 1) * ((-1) ** ((k - 1) // 2))).sum(0)
    else: w = np.sin(2 * np.pi * x) + 0 * k[0]
    w = w / np.abs(w).max()
    _tables[key] = w.astype(np.float32)
    return _tables[key]

def osc(kind, f, n, phase0=None):
    """帯域制限つきの発振器。f は数値か、サンプルごとの周波数の配列"""
    f = np.broadcast_to(np.asarray(f, dtype=np.float64), (n,))
    nh = int(max(1, min(200, 17000 / max(30, f.max()))))
    tb = table(kind, nh if kind != 'sine' else 1)
    ph = np.cumsum(f / SR) + (rng.random() if phase0 is None else phase0)
    idx = (ph % 1.0) * 4096
    i0 = idx.astype(np.int64) % 4096; fr = idx - np.floor(idx)
    return tb[i0] * (1 - fr) + tb[(i0 + 1) % 4096] * fr

def lp(x, fc, order=2, hp_fc=None, peaks=None):
    """FFT のフィルター（位相のずれなし）。peaks＝[(中心Hz, 幅Hz, 倍率)] のフォルマント"""
    n = len(x); N = 1 << (n - 1).bit_length()
    X = np.fft.rfft(x, N); f = np.fft.rfftfreq(N, 1 / SR)
    H = 1 / np.sqrt(1 + (f / max(fc, 10)) ** (2 * order))
    if hp_fc: H = H * (1 / np.sqrt(1 + (hp_fc / np.maximum(f, 1)) ** 4))
    if peaks:
        for c, w, g in peaks: H = H * (1 + (g - 1) * np.exp(-((f - c) / w) ** 2))
    return np.fft.irfft(X * H, N)[:n]

def sweep(x, env, fc_lo, fc_hi, order=2):
    """フィルターが開いて閉じる音：暗い音と明るい音をエンベロープで混ぜる（軽い近似）"""
    lo = lp(x, fc_lo, order); hi = lp(x, fc_hi, order)
    return lo + (hi - lo) * env

def vib(f, n, rate=5.5, depth=0.25, delay=0.15):
    t = t_axis(n)
    k = np.clip((t - delay) / 0.3, 0, 1)
    return f * 2 ** (depth / 12 * k * np.sin(2 * np.pi * rate * t))

# ---------------- 楽器（1音＝モノラルの配列） ----------------
def inst_piano(m, dur, vel):
    f = hz(m); n = int((dur + 1.4) * SR); t = t_axis(n)
    out = np.zeros(n)
    for k in range(1, 11):
        fk = f * k * (1 + 0.0004 * k * k)
        if fk > 16000: break
        dec = 0.9 + 3.5 * k / (1 + f / 400) ** 0.3
        out += np.sin(2 * np.pi * fk * t + rng.random() * 6) * (1 / k ** 1.25) * np.exp(-t * dec * (0.6 + f / 900))
    out *= env_adsr(n, 0.002, 0.3, 1, 0.35, hold=dur + 0.25)
    ham = lp(rng.standard_normal(int(0.02 * SR)) * np.exp(-np.arange(int(0.02 * SR)) / 150), 3000)
    out[:len(ham)] += ham * 0.15
    return out * vel * 0.5

def inst_epiano(m, dur, vel):
    f = hz(m); n = int((dur + 0.9) * SR); t = t_axis(n)
    I = 1.6 * np.exp(-t * 6) + 0.2
    out = np.sin(2 * np.pi * f * t + I * np.sin(2 * np.pi * f * t)) + 0.25 * np.sin(2 * np.pi * f * 14 * t) * np.exp(-t * 40)
    return out * env_adsr(n, 0.002, 0.8, 0.5, 0.25, hold=dur) * vel * 0.4

def inst_bell(m, dur, vel):
    f = hz(m); n = int((dur + 1.6) * SR); t = t_axis(n)
    out = np.sin(2 * np.pi * f * t + 2.2 * np.exp(-t * 3) * np.sin(2 * np.pi * f * 3.5 * t))
    out += 0.35 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t * 4) + 0.2 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 9)
    return out * np.exp(-t * 1.6) * env_adsr(n, 0.001, 1, 1, 0.4, hold=dur + 0.8) * vel * 0.35

def inst_pluck(m, dur, vel, bright=5000, decay=6.0, kind='saw'):
    f = hz(m); n = int((dur + 0.35) * SR); t = t_axis(n)
    x = osc(kind, f, n) * 0.6 + osc(kind, f * 1.004, n) * 0.4
    e = np.exp(-t * decay * 1.6)
    x = sweep(x, e, 500 + f, bright)
    return x * np.exp(-t * decay * 0.55) * env_adsr(n, 0.002, 1, 1, 0.12, hold=dur) * vel * 0.45

def inst_oud(m, dur, vel):
    f = hz(m); n = int((dur + 0.4) * SR); t = t_axis(n)
    ff = f * (1 + 0.012 * np.exp(-t * 30))
    x = osc('saw', ff, n) + 0.3 * osc('square', ff * 2, n)
    x = sweep(x, np.exp(-t * 14), 700, 6500)
    return x * np.exp(-t * 5) * env_adsr(n, 0.001, 1, 1, 0.1, hold=dur) * vel * 0.42

def inst_harpsi(m, dur, vel):
    f = hz(m); n = int((dur + 0.5) * SR); t = t_axis(n)
    x = osc('square', f, n) * 0.5 + osc('saw', f * 2.001, n) * 0.3
    x = lp(x, 7000, hp_fc=300)
    return x * np.exp(-t * 4.5) * env_adsr(n, 0.001, 1, 1, 0.12, hold=dur) * vel * 0.35

def inst_lead(m, dur, vel, detune=0.12, cutoff=6500, vibd=0.22):
    f = hz(m); n = int((dur + 0.25) * SR)
    fv = vib(f, n, depth=vibd)
    x = sum(osc('saw', fv * 2 ** (d / 12), n) for d in (-detune, 0, detune)) / 3
    x += 0.35 * osc('square', fv / 2, n)
    x = lp(x, cutoff, 2)
    return x * env_adsr(n, 0.006, 0.15, 0.8, 0.18, hold=dur) * vel * 0.38

def inst_flute(m, dur, vel):
    f = hz(m); n = int((dur + 0.25) * SR)
    fv = vib(f, n, rate=5.2, depth=0.3, delay=0.2)
    x = osc('sine', fv, n) + 0.18 * osc('sine', fv * 2, n) + 0.06 * osc('sine', fv * 3, n)
    br = lp(rng.standard_normal(n), 3000, hp_fc=1200) * 0.06
    return (x + br) * env_adsr(n, 0.05, 0.2, 0.85, 0.2, hold=dur) * vel * 0.45

def inst_supersaw(m, dur, vel, cutoff=7000, attack=0.008, voices=7, spread=0.32, rel=0.3):
    """戻り値はステレオ (n, 2)"""
    f = hz(m); n = int((dur + rel) * SR)
    L = np.zeros(n); Rr = np.zeros(n)
    for i in range(voices):
        d = spread * (i / (voices - 1) * 2 - 1)
        v = osc('saw', f * 2 ** (d / 12), n)
        p = i / (voices - 1)
        L += v * (1 - p * 0.8); Rr += v * (0.2 + p * 0.8)
    e = env_adsr(n, attack, 0.3, 0.85, rel, hold=dur)
    L = lp(L, cutoff) * e; Rr = lp(Rr, cutoff) * e
    return np.stack([L, Rr], 1) * vel * 0.14

def inst_organ(m, dur, vel):
    f = hz(m); n = int((dur + 0.15) * SR); t = t_axis(n)
    x = np.zeros(n)
    for r, a in ((0.5, 0.6), (1, 1), (1.5, 0.45), (2, 0.6), (3, 0.3), (4, 0.3), (6, 0.12)):
        if f * r < 15000: x += a * np.sin(2 * np.pi * f * r * t + rng.random() * 6)
    x *= 1 + 0.12 * np.sin(2 * np.pi * 6.2 * t)
    return x * env_adsr(n, 0.01, 0.05, 1, 0.08, hold=dur) * vel * 0.16

def inst_choir(m, dur, vel):
    f = hz(m); n = int((dur + 0.5) * SR)
    x = sum(osc('saw', vib(f * 2 ** (d / 12), n, rate=4.8 + d, depth=0.15, delay=0.05), n) for d in (-0.1, 0.05, 0.12))
    x = lp(x, 4000, peaks=[(650, 180, 6), (1100, 220, 4), (2600, 400, 2.5)], hp_fc=200)
    return x * env_adsr(n, 0.35, 0.3, 0.9, 0.45, hold=dur) * vel * 0.05

def inst_brass(m, dur, vel):
    f = hz(m); n = int((dur + 0.2) * SR); t = t_axis(n)
    x = sum(osc('saw', f * 2 ** (d / 12), n) for d in (-0.06, 0.06)) / 2
    e = np.clip(t / 0.08, 0, 1) * 0.8 + 0.2
    x = sweep(x, e, 600, 4200)
    return x * env_adsr(n, 0.03, 0.2, 0.8, 0.15, hold=dur) * vel * 0.32

def inst_bass(m, dur, vel, cutoff=900, drive=0.0, sub=0.6):
    f = hz(m); n = int((dur + 0.06) * SR); t = t_axis(n)
    x = osc('saw', f, n) * 0.6 + osc('square', f * 1.003, n) * 0.25
    x = sweep(x, np.exp(-t * 9), cutoff * 0.45, cutoff * 2.2)
    x += sub * osc('sine', f, n)
    if drive: x = np.tanh(x * (1 + drive * 4)) / np.tanh(1 + drive * 4)
    return x * env_adsr(n, 0.003, 0.2, 0.85, 0.05, hold=dur) * vel * 0.5

def inst_reese(m, dur, vel):
    f = hz(m); n = int((dur + 0.08) * SR)
    x = osc('saw', f * 2 ** (-0.18 / 12), n) + osc('saw', f * 2 ** (0.18 / 12), n)
    x = lp(x, 700) + 0.7 * osc('sine', f, n)
    x = np.tanh(x * 2.2) * 0.7
    return x * env_adsr(n, 0.004, 0.2, 0.9, 0.06, hold=dur) * vel * 0.55

# ---------------- ドラム ----------------
def dr_kick(vel=1, punch=1.0):
    n = int(0.45 * SR); t = t_axis(n)
    f = 46 + 120 * np.exp(-t * 28) * punch + 60 * np.exp(-t * 180)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6.5)
    x[:300] += lp(rng.standard_normal(300), 6000) * np.exp(-np.arange(300) / 40) * 0.5
    return np.tanh(x * 1.6) * vel * 0.9
def dr_snare(vel=1, tone=190):
    n = int(0.35 * SR); t = t_axis(n)
    body = np.sin(2 * np.pi * tone * t * (1 + 0.3 * np.exp(-t * 40))) * np.exp(-t * 22)
    nz = lp(rng.standard_normal(n), 9000, hp_fc=900) * np.exp(-t * 13)
    return (body * 0.55 + nz * 0.8) * vel * 0.6
def dr_clap(vel=1):
    n = int(0.3 * SR); t = t_axis(n)
    nz = lp(rng.standard_normal(n), 3500, hp_fc=900, order=1)
    e = sum(np.exp(-np.maximum(t - d, 0) * 90) * (t >= d) for d in (0, 0.011, 0.022)) + 0.5 * np.exp(-t * 14)
    return nz * e * vel * 0.4
def dr_hat(vel=1, open_=False):
    n = int((0.32 if open_ else 0.06) * SR); t = t_axis(n)
    x = lp(rng.standard_normal(n), 16000, hp_fc=7500)
    return x * np.exp(-t * (9 if open_ else 70)) * vel * 0.32
def dr_crash(vel=1):
    n = int(2.2 * SR); t = t_axis(n)
    return lp(rng.standard_normal(n), 14000, hp_fc=3500) * np.exp(-t * 2.2) * vel * 0.26
def dr_tom(vel=1, f0=120):
    n = int(0.5 * SR); t = t_axis(n)
    f = f0 * (1 + 0.5 * np.exp(-t * 18))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) * vel * 0.7
def dr_shaker(vel=1):
    n = int(0.09 * SR); t = t_axis(n)
    return lp(rng.standard_normal(n), 12000, hp_fc=5000) * np.sin(np.pi * np.clip(t / 0.09, 0, 1)) * vel * 0.18
def dr_rim(vel=1):
    n = int(0.08 * SR); t = t_axis(n)
    return (np.sin(2 * np.pi * 1700 * t) * 0.6 + lp(rng.standard_normal(n), 8000, hp_fc=2000) * 0.4) * np.exp(-t * 60) * vel * 0.35
def dr_dum(vel=1): return dr_tom(vel * 1.1, 85)
def dr_tek(vel=1):
    n = int(0.12 * SR); t = t_axis(n)
    return (np.sin(2 * np.pi * 520 * t) * np.exp(-t * 50) + lp(rng.standard_normal(n), 9000, hp_fc=2500) * np.exp(-t * 45) * 0.6) * vel * 0.4
def dr_riser(sec, vel=1):
    n = int(sec * SR); t = t_axis(n)
    x = rng.standard_normal(n)
    out = np.zeros(n); seg = 2048
    for i in range(0, n, seg):   # だんだん明るく大きく
        k = i / n
        out[i:i + seg] = lp(x[i:i + seg], 800 + 9000 * k ** 2, order=1, hp_fc=300)
    return out * (t / sec) ** 2 * vel * 0.25

# ---------------- 曲の器 ----------------
class Song:
    def __init__(self, bpm, bars, tail=3.5):
        self.bpm = bpm; self.bars = bars
        self.s16 = 60 / bpm / 4
        self.L = int(round(bars * 16 * self.s16 * SR))
        self.N = self.L + int(tail * SR)
        self.bus = {}       # 名前 → ステレオ
        self.cfg = {}       # 名前 → { rev, delay, duck }
        self.kicks = []

    def at(self, bar, step=0): return int(round((bar * 16 + step) * self.s16 * SR))

    # 楽器の種類ごとの基準の音量（低音が強くなりすぎず、主旋律がはっきり聞こえるバランス）
    LEVEL = {'kick': 0.62, 'bass': 0.62, 'lead': 1.8, 'saw': 1.35, 'arp': 1.7, 'hats': 1.7, 'snare': 1.15, 'pad': 1.15, 'bell': 1.7,
             'glock': 1.7, 'choir': 1.3, 'brass': 1.35, 'organ': 1.1, 'harp': 1.5, 'oud': 1.5, 'pluck': 1.5, 'ep': 1.3, 'piano': 1.45,
             'str': 1.2, 'ac': 1.3, 'drone': 0.8, 'perc': 1.3, 'fx': 1.0}
    def stem(self, name, rev=0.15, delay=0.0, duck=0.0, gain=1.0):
        if name not in self.bus:
            self.bus[name] = np.zeros((self.N, 2)); self.cfg[name] = dict(rev=rev, delay=delay, duck=duck, gain=gain * self.LEVEL.get(name, 1.0))
        return self.bus[name]

    def put(self, name, pos, x, pan=0.0, gain=1.0):
        b = self.bus[name]
        if pos >= self.N: return
        if x.ndim == 1:
            l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
            x = np.stack([x * l, x * r], 1) * 1.414
        x = x[:self.N - pos]
        b[pos:pos + len(x)] += x * gain

    # ---- 書き込みの助け ----
    def line(self, name, bar, notes, fn, pan=0.0, gain=1.0, transpose=0, legato=0.95):
        step = 0
        for m, d in notes:
            if m is not None:
                self.put(name, self.at(bar, step), fn(m + transpose, d * self.s16 * legato, gain), pan)
            step += d
        return step

    def drums(self, bar, pats, kit, gain=1.0):
        """pats＝{'k': 'x...x...', 's': ...}（16文字。x＝強、o＝弱）。kit＝{記号: (関数, 定位, ステム)}"""
        for key, p in pats.items():
            fn, pan, stem = kit[key]
            for i, c in enumerate(p):
                if c in 'xo':
                    v = (1.0 if c == 'x' else 0.55) * gain * (1 + 0.04 * rng.standard_normal())
                    self.put(stem, self.at(bar, i), fn(v), pan)
                    if key == 'k': self.kicks.append(self.at(bar, i))

    # ---- 仕上げ ----
    def mix(self, master_gain=1.0):
        N = self.N
        # サイドチェイン（キックで他の音を少し下げる＝うねり）
        sc = np.ones(N)
        t = np.arange(int(0.3 * SR)) / SR
        dip = np.exp(-t / 0.11)
        for p in self.kicks:
            e = min(N, p + len(dip)); sc[p:e] = np.minimum(sc[p:e], 1 - dip[:e - p])
        out = np.zeros((N, 2)); rev_in = np.zeros((N, 2)); dly_in = np.zeros((N, 2))
        for k, b in self.bus.items():
            c = self.cfg[k]
            g = (1 - c['duck'] * (1 - sc))[:, None] * c['gain']
            x = b * g
            out += x; rev_in += x * c['rev']; dly_in += x * c['delay']
        # ディレイ（付点8分のピンポン）
        d = int(3 * self.s16 * SR); fb = 0.38
        dl = np.zeros((N, 2)); src = dly_in.copy()
        for i in range(1, 7):
            sh = d * i
            if sh >= N: break
            amp = fb ** (i - 1) * 0.55
            ch = (i % 2)
            seg = lp(src[:N - sh, 0] + src[:N - sh, 1], 5500 - 600 * i, hp_fc=250)
            dl[sh:, ch] += seg * amp
        out += dl; rev_in += dl * 0.4
        # リバーブ（ステレオの減衰ノイズとの畳み込み）
        rt = 2.2; ir_n = int(rt * SR); tt = np.arange(ir_n) / SR
        rv = np.zeros((N, 2))
        for ch in range(2):
            ir = rng.standard_normal(ir_n) * np.exp(-tt * 6.9 / rt)
            ir = lp(ir, 6500, hp_fc=180); ir[:int(0.012 * SR)] = 0
            ir /= np.sqrt((ir ** 2).sum())
            M = 1 << (N + ir_n).bit_length()
            rv[:, ch] = np.fft.irfft(np.fft.rfft(rev_in[:, ch], M) * np.fft.rfft(ir, M), M)[:N]
        out += rv * 0.9
        # ループ：はみ出した余韻を頭に足す
        L = self.L; tail = out[L:]
        out = out[:L].copy(); out[:len(tail)] += tail[:L]
        # マスター：低域の掃除 → 軽いコンプ → 音圧 → ソフトクリップ
        # マスターEQ：28Hz 以下を切り、300Hz あたりのこもりを少し下げ、3kHz から上を少し明るく
        n = len(out); M = 1 << (n - 1).bit_length(); f = np.fft.rfftfreq(M, 1 / SR)
        H = (1 / np.sqrt(1 + (28 / np.maximum(f, 1)) ** 4)) * (1 - 0.22 * np.exp(-((np.log2(np.maximum(f, 1) / 300)) / 0.7) ** 2)) \
            * (1 + 0.45 / (1 + np.exp(-(f - 3500) / 1200))) / np.sqrt(1 + (f / 19000) ** 2)
        for ch in range(2): out[:, ch] = np.fft.irfft(np.fft.rfft(out[:, ch], M) * H, M)[:n]
        blk = 1024; nb = len(out) // blk + 1
        pad = np.zeros((nb * blk, 2)); pad[:len(out)] = out
        rms = np.sqrt((pad.reshape(nb, blk, 2) ** 2).mean(axis=(1, 2)) + 1e-9)
        thr = np.percentile(rms, 70)
        gr = np.where(rms > thr, (thr / rms) ** 0.35, 1.0)
        gr = np.convolve(gr, np.ones(5) / 5, mode='same')
        gcurve = np.interp(np.arange(len(out)), np.arange(nb) * blk + blk / 2, gr)
        out *= gcurve[:, None]
        rms_all = np.sqrt((out ** 2).mean())
        out *= (10 ** (-12.5 / 20)) / rms_all * master_gain
        out = np.tanh(out * 1.15) / np.tanh(1.15)
        out *= 0.97 / max(1e-6, np.abs(out).max())
        return out
