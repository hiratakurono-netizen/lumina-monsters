# =====================================================================
#  曲データ（さいごの放課後 BGM）
#  どの曲も「イントロ → A → B（サビ）→ A'」の形で、最後から頭へ自然につながるように書いている
# =====================================================================
from engine import *

# ---------------- 共通のアレンジ部品 ----------------
def voicing(sym, lo=55, hi=74):
    root, iv, bass = chord(sym, 3)
    notes = sorted({((root + i - lo) % 12) + lo for i in iv})
    return [n if n <= hi else n - 12 for n in notes], bass

def pad(S, stem, bar, sym, bars, fn, gain=1.0, lo=55, hi=74, oct_=0):
    notes, _ = voicing(sym, lo, hi)
    for m in notes:
        S.put(stem, S.at(bar), fn(m + oct_, bars * 16 * S.s16, gain))

def arp(S, stem, bar, sym, pat, fn, gain=1.0, base=60, step=1, bars=1, pan=0.0):
    """pat：和音の何番目か（0,1,2,3…、4以上は1オクターブ上）を16分ごとに。'.' は休み"""
    notes, _ = voicing(sym, base, base + 11)
    seq = notes + [n + 12 for n in notes] + [n + 24 for n in notes]
    for b in range(bars):
        for i, c in enumerate(pat):
            if c == '.': continue
            k = int(c, 16)
            S.put(stem, S.at(bar + b, i), fn(seq[min(k, len(seq) - 1)], S.s16 * step * 0.9, gain), pan)

def bass(S, stem, bar, sym, pat, fn, gain=1.0, octave=2, bars=1):
    """pat：R＝根音、O＝1オクターブ上、5＝5度、3＝3度、7＝7度、b＝ひとつ下の音へ、'-'＝のばす、'.'＝休み"""
    root, iv, b0 = chord(sym, octave)
    for b in range(bars):
        i = 0
        while i < 16:
            c = pat[i]
            if c in '.-': i += 1; continue
            L = 1
            while i + L < 16 and pat[i + L] == '-': L += 1
            m = {'R': b0, 'O': b0 + 12, '5': root + 7, '3': root + iv[1], '7': root + (iv[3] if len(iv) > 3 else 10), 'b': b0 - 2}[c]
            S.put(stem, S.at(bar + b, i), fn(m, L * S.s16 * 0.92, gain))
            i += L

def stabs(S, stem, bar, sym, pat, fn, gain=1.0, lo=60, hi=79):
    notes, _ = voicing(sym, lo, hi)
    for i, c in enumerate(pat):
        if c in 'xo':
            L = 1
            while i + L < 16 and pat[i + L] == '-': L += 1
            for m in notes: S.put(stem, S.at(bar, i), fn(m, L * S.s16 * 0.85, gain * (1 if c == 'x' else 0.6)))

def kit(S):
    S.stem('kick', rev=0.02, duck=0); S.stem('snare', rev=0.2); S.stem('hats', rev=0.06); S.stem('perc', rev=0.15); S.stem('fx', rev=0.35)
    return {'k': (dr_kick, 0, 'kick'), 's': (dr_snare, 0, 'snare'), 'c': (dr_clap, 0.05, 'snare'), 'h': (dr_hat, 0.3, 'hats'),
            'o': (lambda v: dr_hat(v, True), 0.3, 'hats'), 'r': (dr_rim, -0.2, 'perc'), 'z': (dr_shaker, -0.35, 'perc'),
            't': (lambda v: dr_tom(v, 150), -0.3, 'perc'), 'T': (lambda v: dr_tom(v, 95), 0.3, 'perc'),
            'd': (dr_dum, -0.1, 'perc'), 'e': (dr_tek, 0.25, 'perc')}

def crash(S, bar, v=1.0): S.put('fx', S.at(bar), dr_crash(v), 0.15)
def riser(S, bar_end, bars=2, v=1.0): S.put('fx', S.at(bar_end - bars), dr_riser(bars * 16 * S.s16, v), 0)
def fill(S, bar, K, kind='snare'):
    pats = {'snare': {'s': '....x.x.xxxxxxxx'}, 'tom': {'t': 'x.x.x...', 'T': '........x.x.xxxx'}}[kind]
    S.drums(bar, pats, K, 0.8)

# =====================================================================
#  1. sorrow（タイトル・物語の大事な場面）D minor 78bpm
#     ピアノのアルペジオから、弦とベルの主旋律、最後に柔らかいビートで広がる
# =====================================================================
def song_sorrow():
    S = Song(78, 28, tail=5); K = kit(S)
    S.stem('piano', rev=0.35, delay=0.08); S.stem('pad', rev=0.4, duck=0.2); S.stem('bell', rev=0.45, delay=0.25); S.stem('str', rev=0.4, duck=0.15); S.stem('bass', rev=0.05, duck=0.3); S.stem('lead', rev=0.4, delay=0.2)
    A = ['Bbmaj7', 'C', 'Am7', 'Dm', 'Gm7', 'Am7', 'Bbmaj7', 'Csus4']
    B = ['F', 'C/E', 'Dm', 'Bb', 'Gm', 'C', 'F', 'A7']
    prog = A[:4] + A + B + A
    melA = 'D5:6 C5:2 D5:4 F5:4 | E5:8 G5:4 E5:4 | C5:6 D5:2 E5:4 A4:4 | D5:12 -:4 | Bb4:4 D5:4 G5:6 F5:2 | E5:4 C5:4 E5:4 A5:4 | F5:6 E5:2 D5:4 C5:4 | E5:16'
    melB = 'A5:6 G5:2 F5:4 C6:4 | G5:8 E5:4 C5:4 | F5:6 E5:2 D5:4 A5:4 | Bb5:8 A5:4 F5:4 | G5:6 A5:2 Bb5:4 D6:4 | C6:6 Bb5:2 A5:4 G5:4 | A5:12 G5:4 | E5:8 C#5:8'
    for b, c in enumerate(prog):
        arp(S, 'piano', b, c, '0124' * 4 if b < 4 else '01242124' * 2, inst_piano, 0.55 if b < 4 else 0.45, base=55)
        if b >= 4: pad(S, 'pad', b, c, 1, lambda m, d, g: inst_supersaw(m, d, g, cutoff=2200, attack=0.5, rel=0.8), 0.7)
        if b >= 12: pad(S, 'str', b, c, 1, lambda m, d, g: inst_supersaw(m, d, g, cutoff=3800, attack=0.3, voices=5, spread=0.18, rel=0.6), 0.6, lo=62, hi=81)
        if b >= 4: bass(S, 'bass', b, c, 'R-------5---R---', lambda m, d, g: inst_bass(m, d, g, cutoff=500, sub=0.9), 0.6)
        if b >= 20:
            S.drums(b, {'k': 'x.......x.x.....', 's': '........x.......', 'h': '..x...x...x...x.', 'z': 'oooooooooooooooo'}, K, 0.7)
    S.line('bell', 4, parse_line(melA), inst_bell, 0, 0.9)
    S.line('lead', 12, parse_line(melB), inst_flute, 0, 0.8)
    S.line('bell', 12, parse_line(melB), inst_bell, 0, 0.35, transpose=12)
    S.line('lead', 20, parse_line(melA), lambda m, d, g: inst_lead(m, d, g, cutoff=3500, vibd=0.18), 0, 0.7)
    S.line('bell', 20, parse_line(melA), inst_bell, 0, 0.5, transpose=12)
    crash(S, 12, 0.5); crash(S, 20, 0.7); riser(S, 12, 2, 0.5); riser(S, 20, 2, 0.6)
    return S

# =====================================================================
#  2. morning（町・いつもの日常）F major 100bpm
# =====================================================================
def song_morning():
    S = Song(100, 28); K = kit(S)
    S.stem('ep', rev=0.25, duck=0.25); S.stem('glock', rev=0.3, delay=0.2); S.stem('bass', rev=0.03, duck=0.35); S.stem('pad', rev=0.35, duck=0.3); S.stem('pluck', rev=0.2, delay=0.15)
    A = ['F', 'C', 'Dm', 'Bb'] * 2
    B = ['Gm7', 'C', 'F/A', 'Bb', 'Gm7', 'C7', 'F', 'F']
    prog = A[:4] + A + B + A
    melA = 'C5:3 D5:1 F5:4 A5:4 G5:4 | G5:3 F5:1 E5:4 C5:8 | D5:3 E5:1 F5:4 A5:4 C6:4 | Bb5:6 A5:2 G5:8 | C5:3 D5:1 F5:4 A5:4 G5:4 | G5:3 A5:1 Bb5:4 C6:8 | A5:3 G5:1 F5:4 E5:4 D5:4 | F5:16'
    melB = 'Bb5:4 A5:4 G5:4 F5:4 | E5:6 F5:2 G5:8 | A5:4 C6:4 A5:4 F5:4 | D6:8 C6:4 Bb5:4 | Bb5:4 A5:4 G5:4 D5:4 | E5:4 G5:4 Bb5:4 E5:4 | F5:16 | -:8 C5:2 D5:2 E5:4'
    for b, c in enumerate(prog):
        stabs(S, 'ep', b, c, '..x-..x-..x-..x-' if b >= 4 else 'x-------x-------', inst_epiano, 0.8, lo=57, hi=74)
        if b >= 4: bass(S, 'bass', b, c, 'R--.R-.5R--.O-.5', lambda m, d, g: inst_bass(m, d, g, cutoff=700, sub=0.7), 0.7)
        if b >= 12: pad(S, 'pad', b, c, 1, lambda m, d, g: inst_supersaw(m, d, g, cutoff=2600, attack=0.25, voices=5, spread=0.2), 0.45)
        if b >= 4:
            S.drums(b, {'k': 'x.....x...x.....', 'r': '....x.......x...', 'h': 'x.xox.x.x.xox.xo'.replace('o', 'x'), 'z': '..o...o...o...o.'}, K, 0.65 if b < 12 else 0.8)
            if b >= 12: S.drums(b, {'c': '....x.......x...'}, K, 0.6)
        if 12 <= b < 20: arp(S, 'pluck', b, c, '0.2.4.2.0.2.4.21', lambda m, d, g: inst_pluck(m, d, g, bright=4200, decay=7), 0.4, base=67, pan=-0.3)
    S.line('glock', 4, parse_line(melA), inst_bell, 0.15, 0.9)
    S.line('glock', 12, parse_line(melB), inst_bell, 0.15, 1.0)
    S.line('pluck', 12, parse_line(melB), lambda m, d, g: inst_pluck(m, d, g, bright=3500, decay=4), 0.3, 0.5, transpose=-12)
    S.line('glock', 20, parse_line(melA), inst_bell, 0.15, 0.9)
    S.line('pluck', 20, parse_line(melA), lambda m, d, g: inst_flute(m, d, g), -0.2, 0.55)
    crash(S, 4, 0.4); crash(S, 12, 0.6); crash(S, 20, 0.5)
    return S

# =====================================================================
#  3. battle（プロローグの戦い・ふつうの戦闘）E minor 150bpm
# =====================================================================
def song_battle():
    S = Song(150, 36); K = kit(S)
    S.stem('bass', rev=0.02, duck=0.55); S.stem('saw', rev=0.25, duck=0.5); S.stem('arp', rev=0.2, delay=0.25, duck=0.4); S.stem('lead', rev=0.25, delay=0.22); S.stem('pad', rev=0.35, duck=0.6)
    A = ['Em', 'C', 'G', 'D', 'Em', 'C', 'G', 'B7']
    B = ['C', 'D', 'Bm', 'Em', 'Am', 'D', 'G', 'B7']
    prog = ['Em', 'C', 'G', 'D'] + A + B + A + B
    melA = 'E5:2 E5:2 G5:2 B5:4 A5:2 G5:2 F#5:2 | E5:4 G5:4 C6:4 B5:4 | D6:2 B5:2 G5:4 D5:4 G5:2 A5:2 | F#5:8 A5:4 D6:4 | E5:2 E5:2 G5:2 B5:4 A5:2 G5:2 F#5:2 | E5:4 G5:4 C6:4 E6:4 | D6:2 C6:2 B5:4 G5:4 B5:4 | D#6:8 B5:4 F#5:4'
    melB = 'E5:4 G5:4 C6:6 B5:2 | A5:4 F#5:4 D6:8 | D6:4 B5:2 A5:2 F#5:4 B5:4 | G5:12 E5:4 | A5:4 C6:4 E6:6 D6:2 | C6:4 A5:4 F#5:8 | G5:4 B5:4 D6:4 G6:4 | F#6:8 D#6:8'
    sawlead = lambda m, d, g: inst_lead(m, d, g, detune=0.14, cutoff=7000)
    for b, c in enumerate(prog):
        intro, drop = b < 4, b >= 28
        arp(S, 'arp', b, c, '0124' * 4 if not drop else '01240124' * 2, lambda m, d, g: inst_pluck(m, d, g, bright=6000, decay=8), 0.32, base=64, pan=0.25)
        if not intro: bass(S, 'bass', b, c, 'R.ORR.ORR.ORR.OR' if b < 20 else 'RORORORORORORORO', lambda m, d, g: inst_bass(m, d, g, cutoff=1100, drive=0.3), 0.75)
        if b >= 12: stabs(S, 'saw', b, c, 'x--.x--.x-.x--x.' if b < 20 or b >= 28 else 'x-------x-------', lambda m, d, g: inst_supersaw(m, d, g, cutoff=6500), 0.6)
        if 20 <= b < 28: pad(S, 'pad', b, c, 1, lambda m, d, g: inst_supersaw(m, d, g, cutoff=3000, attack=0.15), 0.5)
        if intro:
            S.drums(b, {'k': 'x...x...x...x...', 'h': '..x...x...x...x.'} if b >= 2 else {'h': '..x...x...x...x.'}, K, 0.7)
        else:
            S.drums(b, {'k': 'x...x...x...x...', 's': '....x.......x...', 'h': '..x...x...x...x.', 'z': 'oooooooooooooooo'}, K, 0.9)
            if b >= 12: S.drums(b, {'h': 'o.o.o.o.o.o.o.o.', 'c': '....x.......x..o'}, K, 0.7)
        if b % 8 == 3 and b > 3: fill(S, b, K)
    riser(S, 4, 2, 0.8); crash(S, 4); crash(S, 12); riser(S, 12, 2); crash(S, 20); crash(S, 28); riser(S, 28, 4, 1.0)
    S.line('lead', 4, parse_line(melA), sawlead, 0, 0.85)
    S.line('lead', 12, parse_line(melB), sawlead, 0, 0.9)
    S.line('lead', 20, parse_line(melA), sawlead, 0, 0.7, transpose=12)
    S.line('lead', 20, parse_line(melA), inst_bell, 0.2, 0.4, transpose=12)
    S.line('lead', 28, parse_line(melB), sawlead, 0, 0.95, transpose=12)
    S.line('lead', 28, parse_line(melB), sawlead, 0, 0.5)
    return S

# =====================================================================
#  4. boss（ボス戦）C minor 168bpm：うねるベース、合唱、ブラス
# =====================================================================
def song_boss():
    S = Song(168, 40); K = kit(S)
    S.stem('bass', rev=0.02, duck=0.6); S.stem('saw', rev=0.2, duck=0.5); S.stem('choir', rev=0.45, duck=0.35); S.stem('brass', rev=0.25, duck=0.4); S.stem('lead', rev=0.2, delay=0.2); S.stem('arp', rev=0.15, delay=0.2, duck=0.4)
    A = ['Cm', 'Ab', 'Fm', 'G', 'Cm', 'Ab', 'Bb', 'G']
    B = ['Ab', 'Bb', 'Gm', 'Cm', 'Fm', 'G', 'Ab', 'G']
    prog = ['Cm'] * 4 + A + B + A + B + ['Cm', 'Ab', 'Fm', 'G']
    melA = 'C5:2 C5:2 Eb5:2 G5:2 C6:4 Bb5:2 G5:2 | Ab5:4 G5:2 F5:2 Eb5:4 C5:4 | F5:2 Ab5:2 C6:2 F6:2 Eb6:4 D6:2 C6:2 | B5:8 G5:4 D5:4 | C5:2 C5:2 Eb5:2 G5:2 C6:4 Bb5:2 G5:2 | Ab5:4 C6:4 Eb6:4 F6:4 | D6:2 Bb5:2 F5:4 D6:4 F6:4 | G6:8 F6:2 Eb6:2 D6:2 B5:2'
    melB = 'Eb6:6 D6:2 C6:4 Ab5:4 | F6:6 Eb6:2 D6:4 Bb5:4 | D6:4 Bb5:4 G5:4 D6:4 | Eb6:8 G6:8 | F6:4 Eb6:4 C6:4 Ab5:4 | G5:4 B5:4 D6:4 F6:4 | Eb6:4 C6:4 Ab5:4 Eb6:4 | D6:8 B5:8'
    lead = lambda m, d, g: inst_lead(m, d, g, detune=0.16, cutoff=7500, vibd=0.3)
    for b, c in enumerate(prog):
        intro = b < 4
        bass(S, 'bass', b, c, 'R-.RR-.RR-.RR.RO' if not intro else 'R---------------', inst_reese, 0.75 if not intro else 0.6)
        if intro: S.drums(b, {'T': 'x.....x.....x...', 't': '............x.x.'} if b >= 2 else {'T': 'x.......x.......'}, K, 0.9)
        else:
            S.drums(b, {'k': 'x..x..x.x..x..x.', 's': '....x.......x...', 'h': 'xxxxxxxxxxxxxxxx', 'o': '..o...o...o...o.'}, K, 0.9)
            stabs(S, 'saw', b, c, 'x..x..x.x..x..x.', lambda m, d, g: inst_supersaw(m, d, g, cutoff=5000), 0.5)
        if b >= 12: pad(S, 'choir', b, c, 1, inst_choir, 1.0, lo=60, hi=79)
        if 12 <= b < 20 or b >= 28: stabs(S, 'brass', b, c, 'x-..x-..x---x-x-', inst_brass, 0.5, lo=55, hi=72)
        arp(S, 'arp', b, c, '0120' * 4, lambda m, d, g: inst_pluck(m, d, g, bright=5000, decay=9, kind='square'), 0.25, base=72, pan=-0.3)
        if b % 8 == 3 and b > 3: fill(S, b, K, 'tom')
    for b in (4, 12, 20, 28, 36): crash(S, b)
    riser(S, 4, 2); riser(S, 20, 2)
    S.line('lead', 4, parse_line(melA), lead, 0, 0.8)
    S.line('lead', 12, parse_line(melB), lead, 0, 0.85)
    S.line('lead', 20, parse_line(melA), lead, 0, 0.8, transpose=12)
    S.line('lead', 20, parse_line(melA), inst_brass, 0, 0.5)
    S.line('lead', 28, parse_line(melB), lead, 0, 0.9)
    S.line('lead', 28, parse_line(melB), inst_choir, 0, 1.6, transpose=-12)
    return S

# =====================================================================
#  5. grassland（草原）G major 132bpm：冒険の始まり。笛とキラキラしたアルペジオ
# =====================================================================
def song_grassland():
    S = Song(132, 28); K = kit(S)
    S.stem('bass', rev=0.03, duck=0.45); S.stem('pad', rev=0.35, duck=0.45); S.stem('arp', rev=0.2, delay=0.25, duck=0.3); S.stem('lead', rev=0.3, delay=0.18); S.stem('ac', rev=0.2, duck=0.3)
    A = ['G', 'D', 'Em', 'C', 'G', 'D', 'C', 'D']
    B = ['Em', 'C', 'G', 'D', 'Em', 'C', 'Am', 'D']
    prog = ['G', 'D', 'Em', 'C'] + A + B + A
    melA = 'D5:4 G5:4 B5:6 A5:2 | A5:4 F#5:4 D5:8 | E5:4 G5:4 B5:4 E6:4 | D6:6 C6:2 B5:4 G5:4 | D5:4 G5:4 B5:6 D6:2 | C6:4 B5:4 A5:8 | G5:4 E5:4 C6:4 E6:4 | D6:12 -:4'
    melB = 'B5:4 E6:4 D6:4 B5:4 | C6:4 G5:4 E5:8 | D5:4 G5:4 B5:4 D6:4 | F#6:8 E6:4 D6:4 | B5:4 E6:4 G6:4 E6:4 | C6:4 E6:4 G6:8 | A5:4 C6:4 E6:4 A6:4 | F#6:8 D6:8'
    for b, c in enumerate(prog):
        arp(S, 'arp', b, c, '0124' * 4, lambda m, d, g: inst_pluck(m, d, g, bright=5500, decay=7), 0.3, base=67, pan=0.3)
        stabs(S, 'ac', b, c, 'x.x.x-x.x.x.x-x.' if b >= 4 else 'x-------x-------', lambda m, d, g: inst_pluck(m, d, g, bright=3000, decay=5, kind='tri'), 0.45, lo=55, hi=71)
        if b >= 4: bass(S, 'bass', b, c, 'R..R..R.R..5..O.', lambda m, d, g: inst_bass(m, d, g, cutoff=800), 0.7)
        if b >= 12: pad(S, 'pad', b, c, 1, lambda m, d, g: inst_supersaw(m, d, g, cutoff=3500, attack=0.1), 0.45)
        if b >= 4: S.drums(b, {'k': 'x.....x.x.......', 's': '....x.......x...', 'h': '..x...x...x...x.', 'z': 'o.o.o.o.o.o.o.o.'}, K, 0.8)
        if b >= 12: S.drums(b, {'k': 'x...x...x...x...', 'o': '..o...o...o...o.', 'c': '....x.......x...'}, K, 0.8)
        if 12 <= b < 20: stabs(S, 'ac', b, c, 'x..x..x...x..x..', lambda m, d, g: inst_supersaw(m, d, g, cutoff=5000), 0.45)
        if b % 8 == 3 and b > 3: fill(S, b, K)
    crash(S, 4); crash(S, 12); crash(S, 20); riser(S, 12, 2, 0.6)
    S.line('lead', 4, parse_line(melA), inst_flute, 0, 0.9)
    S.line('lead', 12, parse_line(melB), lambda m, d, g: inst_lead(m, d, g, cutoff=5500), 0, 1.0)
    S.line('lead', 12, parse_line(melB), inst_flute, -0.15, 0.6, transpose=-12)
    S.line('lead', 12, parse_line(melB), inst_bell, 0.2, 0.45, transpose=12)
    S.line('lead', 20, parse_line(melA), inst_flute, 0, 0.9)
    S.line('lead', 20, parse_line(melA), inst_bell, 0.2, 0.35, transpose=12)
    return S

# =====================================================================
#  6. desert（砂漠）D フリジアン・ドミナント 116bpm：ウードのリフ、ダルブッカ、笛
# =====================================================================
def song_desert():
    S = Song(116, 28); K = kit(S)
    S.stem('oud', rev=0.2, delay=0.12); S.stem('drone', rev=0.3, duck=0.3); S.stem('bass', rev=0.03, duck=0.4); S.stem('lead', rev=0.35, delay=0.22); S.stem('pad', rev=0.4, duck=0.4)
    A = ['D', 'Eb', 'D', 'C', 'Bb', 'C', 'Eb', 'D']
    prog = ['D'] * 4 + A + A + A
    riff = 'D5:2 Eb5:2 F#5:2 G5:2 A5:4 G5:2 F#5:2 | G5:2 F#5:2 Eb5:2 D5:2 Eb5:8 | D5:2 Eb5:2 F#5:2 G5:2 A5:2 Bb5:2 A5:2 G5:2 | F#5:2 G5:2 F#5:2 Eb5:2 D5:8'
    mel = 'A5:6 Bb5:2 A5:4 G5:4 | F#5:4 G5:4 Eb5:8 | D5:4 F#5:4 A5:4 C6:4 | Bb5:6 A5:2 G5:8 | G5:4 A5:4 Bb5:6 C6:2 | D6:4 C6:4 Bb5:4 A5:4 | G5:4 F#5:4 Eb5:4 F#5:4 | D5:16'
    for b, c in enumerate(prog):
        S.put('drone', S.at(b), inst_supersaw(midi('D3'), 16 * S.s16, 0.35, cutoff=1200, attack=0.2, voices=5, spread=0.1))
        if b >= 4: bass(S, 'bass', b, c, 'R.....R.R.....5.', lambda m, d, g: inst_bass(m, d, g, cutoff=600, sub=0.9), 0.75)
        S.drums(b, {'d': 'x.....x...x.....', 'e': '...x.x...x.xx..x', 'z': 'oooooooooooooooo'} if b >= 2 else {'e': '...x.x...x.xx..x'}, K, 0.8)
        if b >= 12: S.drums(b, {'k': 'x.......x.......', 'c': '....x.......x...', 'h': '..x...x...x...x.'}, K, 0.75)
        if b >= 12: pad(S, 'pad', b, c, 1, lambda m, d, g: inst_supersaw(m, d, g, cutoff=2800, attack=0.2), 0.45)
    for b in (0, 4, 8, 12, 16, 20, 24):
        S.line('oud', b, parse_line(riff), inst_oud, -0.25, 0.7 if b < 12 else 0.55, transpose=-12)
    S.line('lead', 4, parse_line(mel), inst_flute, 0.1, 0.9)
    S.line('lead', 12, parse_line(mel), lambda m, d, g: inst_lead(m, d, g, cutoff=5000, vibd=0.35), 0.1, 1.0, transpose=12)
    S.line('lead', 12, parse_line(mel), inst_flute, -0.1, 0.7)
    S.line('lead', 20, parse_line(mel), inst_flute, 0.1, 0.8, transpose=12)
    S.line('lead', 20, parse_line(mel), inst_oud, -0.3, 0.45)
    crash(S, 12, 0.6); crash(S, 20, 0.7); riser(S, 12, 2, 0.5)
    return S

# =====================================================================
#  7. snow（雪原）B minor 126bpm：ハーフタイムのビート、ベルと氷のようなアルペジオ
# =====================================================================
def song_snow():
    S = Song(126, 28, tail=4.5); K = kit(S)
    S.stem('pad', rev=0.5, duck=0.35); S.stem('bell', rev=0.5, delay=0.3); S.stem('arp', rev=0.35, delay=0.3, duck=0.25); S.stem('bass', rev=0.03, duck=0.4); S.stem('lead', rev=0.4, delay=0.25)
    A = ['Bm', 'G', 'D', 'A', 'Bm', 'G', 'Em', 'F#']
    B = ['G', 'A', 'F#m', 'Bm', 'Em', 'F#m', 'G', 'F#']
    prog = ['Bm', 'G', 'D', 'A'] + A + B + A
    melA = 'F#5:4 B5:4 C#6:4 D6:4 | B5:8 G5:4 D5:4 | A5:4 D6:4 F#6:4 E6:4 | C#6:8 A5:8 | F#5:4 B5:4 C#6:4 D6:4 | E6:8 D6:4 B5:4 | G5:4 B5:4 E6:4 D6:4 | C#6:8 A#5:8'
    melB = 'D6:4 B5:4 G5:4 B5:4 | C#6:4 A5:4 E5:4 A5:4 | F#6:6 E6:2 C#6:4 A5:4 | B5:16 | G5:4 B5:4 E6:4 G6:4 | F#6:4 C#6:4 A5:4 F#5:4 | G5:4 B5:4 D6:4 E6:4 | C#6:8 A#5:8'
    for b, c in enumerate(prog):
        pad(S, 'pad', b, c, 1, lambda m, d, g: inst_supersaw(m, d, g, cutoff=2400, attack=0.4, rel=0.9), 0.6)
        arp(S, 'arp', b, c, '0.4.2.6.1.5.2.4.', inst_bell, 0.35, base=71, pan=-0.35)
        if b >= 4:
            bass(S, 'bass', b, c, 'R-------R---5---', lambda m, d, g: inst_bass(m, d, g, cutoff=450, sub=1.0), 0.75)
            S.drums(b, {'k': 'x.........x.....', 's': '........x.......', 'h': 'x.x.x.x.x.x.x.x.', 'z': '.o.o.o.o.o.o.o.o'}, K, 0.75)
        if b >= 12: S.drums(b, {'h': '..o...o...o...o.', 'k': '......x.....x...', 'c': '........x.......'}, K, 0.7)
        if 12 <= b < 20: stabs(S, 'arp', b, c, 'x.....x.....x...', lambda m, d, g: inst_supersaw(m, d, g, cutoff=4000, attack=0.02), 0.35)
    crash(S, 4, 0.5); crash(S, 12, 0.6); crash(S, 20, 0.6); riser(S, 12, 2, 0.5)
    S.line('bell', 4, parse_line(melA), inst_bell, 0.15, 1.0)
    S.line('lead', 12, parse_line(melB), lambda m, d, g: inst_lead(m, d, g, cutoff=4500, vibd=0.2), 0, 1.0)
    S.line('bell', 12, parse_line(melB), inst_bell, 0.2, 0.7, transpose=12)
    S.line('bell', 20, parse_line(melA), inst_bell, 0.15, 0.9)
    S.line('lead', 20, parse_line(melA), inst_flute, -0.1, 0.6)
    return S

# =====================================================================
#  8. volcano（火山）F# minor 156bpm：時間に追われる焦り。歪んだベースと速いアルペジオ
# =====================================================================
def song_volcano():
    S = Song(156, 32); K = kit(S)
    S.stem('bass', rev=0.02, duck=0.55); S.stem('arp', rev=0.15, delay=0.2, duck=0.4); S.stem('saw', rev=0.2, duck=0.5); S.stem('lead', rev=0.2, delay=0.2); S.stem('brass', rev=0.25, duck=0.35)
    A = ['F#m', 'D', 'E', 'C#', 'F#m', 'D', 'Bm', 'C#']
    B = ['D', 'E', 'C#m', 'F#m', 'Bm', 'C#m', 'D', 'C#']
    prog = ['F#m', 'F#m', 'D', 'C#'] + A + B + A + ['D', 'E', 'C#', 'C#']
    melA = 'F#5:2 A5:2 C#6:2 F#6:2 E6:4 C#6:4 | D6:4 A5:4 F#5:8 | E5:2 G#5:2 B5:2 E6:2 D6:4 B5:4 | C#6:8 G#5:4 F5:4 | F#5:2 A5:2 C#6:2 F#6:2 G#6:4 A6:4 | F#6:4 D6:4 A5:8 | B5:2 D6:2 F#6:2 B6:2 A6:4 F#6:4 | G#6:8 F6:8'
    melB = 'A5:4 F#5:4 D6:4 A5:4 | B5:4 G#5:4 E6:4 B5:4 | C#6:4 E6:4 G#6:4 E6:4 | F#6:12 C#6:4 | D6:4 B5:4 F#6:4 D6:4 | E6:4 C#6:4 G#6:4 E6:4 | F#6:4 D6:4 A6:4 F#6:4 | G#6:8 F6:8'
    lead = lambda m, d, g: inst_lead(m, d, g, detune=0.15, cutoff=6500, vibd=0.25)
    for b, c in enumerate(prog):
        intro = b < 4
        arp(S, 'arp', b, c, '0124210401242104', lambda m, d, g: inst_pluck(m, d, g, bright=7000, decay=10, kind='square'), 0.28, base=66, pan=0.3)
        bass(S, 'bass', b, c, 'RRORRRORRRORRROR' if not intro else 'R-R-R-R-R-R-R-R-', lambda m, d, g: inst_bass(m, d, g, cutoff=1300, drive=0.6, sub=0.4), 0.7)
        if not intro:
            S.drums(b, {'k': 'x...x...x...x...', 's': '....x.......x...', 'h': 'x.x.x.x.x.x.x.x.', 'o': '..o...o...o...o.', 't': '..............x.'}, K, 0.9)
            stabs(S, 'saw', b, c, 'x.x..x.x..x.x.x.', lambda m, d, g: inst_supersaw(m, d, g, cutoff=5500), 0.5)
        else: S.drums(b, {'T': 'x..x..x.x..x..x.', 'h': 'xxxxxxxxxxxxxxxx'}, K, 0.7)
        if 12 <= b < 20: stabs(S, 'brass', b, c, 'x-------x---x---', inst_brass, 0.5, lo=57, hi=73)
        if b % 8 == 3 and b > 3: fill(S, b, K, 'tom')
    for b in (4, 12, 20, 28): crash(S, b)
    riser(S, 4, 2); riser(S, 12, 2)
    S.line('lead', 4, parse_line(melA), lead, 0, 0.85)
    S.line('lead', 12, parse_line(melB), lead, 0, 0.9)
    S.line('lead', 12, parse_line(melB), inst_brass, 0.2, 0.4, transpose=-12)
    S.line('lead', 20, parse_line(melA), lead, 0, 0.8)
    S.line('lead', 20, parse_line(melA), inst_bell, 0.25, 0.3, transpose=12)
    return S

# =====================================================================
#  9. castle（魔王城）A harmonic minor 138bpm：オルガン、チェンバロ、合唱
# =====================================================================
def song_castle():
    S = Song(138, 28, tail=4); K = kit(S)
    S.stem('organ', rev=0.45, duck=0.3); S.stem('harp', rev=0.3, delay=0.15, duck=0.25); S.stem('choir', rev=0.5, duck=0.3); S.stem('bass', rev=0.03, duck=0.45); S.stem('lead', rev=0.35, delay=0.2); S.stem('saw', rev=0.2, duck=0.5)
    A = ['Am', 'F', 'Dm', 'E', 'Am', 'F', 'Dm', 'E']
    B = ['Dm', 'Am', 'E', 'Am', 'F', 'Dm', 'Bdim', 'E']
    prog = ['Am', 'Am', 'Dm', 'E'] + A + B + A
    melA = 'A5:4 C6:4 E6:6 D6:2 | C6:4 A5:4 F5:8 | D5:4 F5:4 A5:4 D6:4 | B5:8 G#5:8 | A5:4 C6:4 E6:4 A6:4 | G#6:4 F6:4 E6:4 C6:4 | D6:4 F6:4 E6:4 D6:4 | B5:8 E6:8'
    melB = 'F6:6 E6:2 D6:4 A5:4 | E6:6 D6:2 C6:4 A5:4 | B5:4 G#5:4 E5:4 G#5:4 | A5:16 | C6:4 F6:4 A6:4 F6:4 | D6:4 F6:4 A6:4 D6:4 | F6:4 D6:4 B5:4 G#5:4 | B5:8 E6:8'
    for b, c in enumerate(prog):
        pad(S, 'organ', b, c, 1, inst_organ, 1.0, lo=57, hi=76)
        arp(S, 'harp', b, c, '0124012401240124' if b >= 4 else '0.1.2.4.2.1.0.1.', inst_harpsi, 0.4, base=69, pan=0.3)
        if b >= 4:
            bass(S, 'bass', b, c, 'R.RRR.RRR.RRR.5O', lambda m, d, g: inst_bass(m, d, g, cutoff=900, drive=0.25), 0.7)
            S.drums(b, {'k': 'x..x..x...x..x..', 's': '....x.......x...', 'h': 'x.x.x.x.x.x.x.x.', 'o': '...........o....'}, K, 0.85)
        if b >= 12: pad(S, 'choir', b, c, 1, inst_choir, 1.1, lo=60, hi=79)
        if b >= 20: stabs(S, 'saw', b, c, 'x..x..x.x..x..x.', lambda m, d, g: inst_supersaw(m, d, g, cutoff=4500), 0.4)
        if b % 8 == 3 and b > 3: fill(S, b, K, 'tom')
    crash(S, 4); crash(S, 12); crash(S, 20); riser(S, 12, 2, 0.6)
    S.line('lead', 4, parse_line(melA), lambda m, d, g: inst_lead(m, d, g, cutoff=5000, vibd=0.28), 0, 0.75)
    S.line('lead', 12, parse_line(melB), inst_choir, 0, 2.2, transpose=-12)
    S.line('lead', 12, parse_line(melB), inst_bell, 0.2, 0.35)
    S.line('lead', 20, parse_line(melA), lambda m, d, g: inst_lead(m, d, g, cutoff=6000, vibd=0.3), 0, 0.85)
    S.line('lead', 20, parse_line(melA), inst_organ, 0, 1.0, transpose=-12)
    return S

# =====================================================================
# 10. maou（魔王戦）D minor 176bpm：合唱・オルガン・スーパーソウの総力戦
# =====================================================================
def song_maou():
    S = Song(176, 40, tail=4); K = kit(S)
    S.stem('bass', rev=0.02, duck=0.6); S.stem('organ', rev=0.4, duck=0.35); S.stem('choir', rev=0.5, duck=0.3); S.stem('saw', rev=0.2, duck=0.55); S.stem('lead', rev=0.25, delay=0.18); S.stem('arp', rev=0.15, delay=0.2, duck=0.45); S.stem('brass', rev=0.3, duck=0.35)
    A = ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'C', 'A']
    B = ['Gm', 'A', 'Dm', 'Bb', 'Gm', 'Eb', 'A', 'A']
    prog = ['Dm', 'Dm', 'Eb', 'A'] + A + B + A + B + ['Dm', 'Bb', 'Eb', 'A']
    melA = 'D6:2 A5:2 D6:2 F6:2 E6:4 D6:2 C#6:2 | D6:4 Bb5:4 F5:4 Bb5:4 | G5:2 Bb5:2 D6:2 G6:2 F6:4 E6:2 D6:2 | C#6:8 E6:4 A6:4 | D6:2 A5:2 D6:2 F6:2 A6:4 G6:2 F6:2 | G6:4 F6:4 D6:4 Bb5:4 | C6:2 E6:2 G6:2 C7:2 Bb6:4 G6:4 | A6:8 C#6:8'
    melB = 'Bb6:6 A6:2 G6:4 D6:4 | C#6:6 E6:2 A6:8 | F6:4 D6:4 A5:4 D6:4 | F6:8 Bb6:8 | G6:4 Bb6:4 D7:4 Bb6:4 | Bb6:4 G6:4 Eb6:4 G6:4 | A6:4 E6:4 C#6:4 E6:4 | A6:8 C#7:8'
    lead = lambda m, d, g: inst_lead(m, d, g, detune=0.18, cutoff=8000, vibd=0.3)
    for b, c in enumerate(prog):
        intro = b < 4
        pad(S, 'organ', b, c, 1, inst_organ, 1.0, lo=50, hi=69)
        bass(S, 'bass', b, c, 'RRRRRRRRRRRRRRRO' if not intro else 'R-------R-------', inst_reese, 0.7)
        if intro: S.drums(b, {'T': 'x...x...x...x.x.', 't': '..........x.x.xx'} if b >= 2 else {'T': 'x.......x.......'}, K, 0.9)
        else:
            S.drums(b, {'k': 'x.xxx.xxx.xxx.xx' if 12 <= b < 20 or b >= 28 else 'x...x...x...x...', 's': '....x.......x...', 'h': 'xxxxxxxxxxxxxxxx', 'o': '..o...o...o...o.'}, K, 0.9)
            stabs(S, 'saw', b, c, 'x.x.x.x.x.x.x.x.', lambda m, d, g: inst_supersaw(m, d, g, cutoff=5500), 0.45)
            arp(S, 'arp', b, c, '0124520401245204', lambda m, d, g: inst_pluck(m, d, g, bright=7000, decay=10), 0.25, base=74, pan=-0.3)
        if b >= 12: pad(S, 'choir', b, c, 1, inst_choir, 1.3, lo=62, hi=81)
        if 12 <= b < 20 or b >= 28: stabs(S, 'brass', b, c, 'x--.x--.x---x---', inst_brass, 0.5, lo=55, hi=72)
        if b % 8 == 3 and b > 3: fill(S, b, K, 'tom')
    for b in (4, 12, 20, 28, 36): crash(S, b)
    riser(S, 4, 2); riser(S, 12, 2); riser(S, 28, 2)
    S.line('lead', 4, parse_line(melA), lead, 0, 0.8, transpose=-12)
    S.line('lead', 12, parse_line(melB), lead, 0, 0.85, transpose=-12)
    S.line('lead', 12, parse_line(melB), inst_choir, 0, 1.8, transpose=-24)
    S.line('lead', 20, parse_line(melA), lead, 0, 0.85)
    S.line('lead', 20, parse_line(melA), inst_brass, 0, 0.45, transpose=-12)
    S.line('lead', 28, parse_line(melB), lead, 0, 0.9)
    S.line('lead', 28, parse_line(melB), inst_choir, 0, 1.8, transpose=-12)
    return S

SONGS = {
    'sorrow': song_sorrow, 'morning': song_morning, 'battle': song_battle, 'boss': song_boss,
    'grassland': song_grassland, 'desert': song_desert, 'snow': song_snow, 'volcano': song_volcano,
    'castle': song_castle, 'maou': song_maou,
}
