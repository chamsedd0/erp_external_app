"""Shadow Portal intro — original score + sound design, synthesized from scratch (no samples).

120 BPM, key of A major / F# minor. Every hit is locked to the video timeline in intro.js (T.*):
the portal pass / drop lands at 4.0 s and the logo impact at 16.0 s.

    python soundtrack.py              → soundtrack.wav           (48 kHz, 32-bit float stereo)
    python soundtrack.py --vertical   → soundtrack-vertical.wav  (same score, panning follows the 9:16 layout)
"""
import re
import sys
import numpy as np
from scipy import signal
from scipy.io import wavfile
from scipy.ndimage import maximum_filter1d
from pathlib import Path

VERT = '--vertical' in sys.argv
SR = 48000
DUR = 19.0
N = int(SR * DUR)
BEAT = 0.5
STEP = BEAT / 4
rng = np.random.default_rng(1234)

# ── the video timeline, read straight from intro.js (const T = {...}) so picture and sound never drift ──
_js = (Path(__file__).parent / 'intro.js').read_text(encoding='utf-8')
_blk = re.search(r'const T = \{(.*?)\};', _js, re.S).group(1)
T = {k: float(v) for k, v in re.findall(r'(\w+):\s*([0-9.]+)', _blk)}

# ── basics ───────────────────────────────────────────────────────────────────
NOTE = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
def m(s): return 12 * (int(s[-1]) + 1) + NOTE[s[:-1]]
def hz(n): return 440.0 * 2 ** ((n - 69) / 12)
def tt(n): return np.arange(n) / SR
def ns(sec): return max(1, int(round(sec * SR)))

def polyblep(ph, dt):
    y = np.zeros_like(ph)
    a = ph < dt
    x = ph[a] / dt[a]; y[a] = x + x - x * x - 1
    b = ph > 1 - dt
    x = (ph[b] - 1) / dt[b]; y[b] = x * x + x + x + 1
    return y
def saw(f, n, ph0=0.0):
    f = np.broadcast_to(np.asarray(f, float), (n,))
    dt = f / SR
    ph = (ph0 + np.cumsum(dt)) % 1.0
    return 2 * ph - 1 - polyblep(ph, dt)
def sine(f, n, ph0=0.0):
    f = np.broadcast_to(np.asarray(f, float), (n,))
    return np.sin(2 * np.pi * (ph0 + np.cumsum(f) / SR))
def noise(n): return rng.standard_normal(n)

def biquad(kind, f0, q=0.707, db=0.0):
    f0 = float(np.clip(f0, 15, SR * 0.47))
    w = 2 * np.pi * f0 / SR; c, s = np.cos(w), np.sin(w); al = s / (2 * q); A = 10 ** (db / 40)
    if kind == 'lp': b, a = [(1 - c) / 2, 1 - c, (1 - c) / 2], [1 + al, -2 * c, 1 - al]
    elif kind == 'hp': b, a = [(1 + c) / 2, -(1 + c), (1 + c) / 2], [1 + al, -2 * c, 1 - al]
    elif kind == 'bp': b, a = [al, 0, -al], [1 + al, -2 * c, 1 - al]
    elif kind == 'peak': b, a = [1 + al * A, -2 * c, 1 - al * A], [1 + al / A, -2 * c, 1 - al / A]
    elif kind == 'hs':
        sq = 2 * np.sqrt(A) * al
        b = [A * ((A + 1) + (A - 1) * c + sq), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - sq)]
        a = [(A + 1) - (A - 1) * c + sq, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - sq]
    elif kind == 'ls':
        sq = 2 * np.sqrt(A) * al
        b = [A * ((A + 1) - (A - 1) * c + sq), 2 * A * ((A - 1) - (A + 1) * c), A * ((A + 1) - (A - 1) * c - sq)]
        a = [(A + 1) + (A - 1) * c + sq, -2 * ((A - 1) + (A + 1) * c), (A + 1) + (A - 1) * c - sq]
    b, a = np.array(b, float), np.array(a, float)
    return b / a[0], a / a[0]
def filt(x, kind, f0, q=0.707, db=0.0):
    b, a = biquad(kind, f0, q, db); return signal.lfilter(b, a, x)
def sweep(x, kind, f, q=0.707, block=64):
    """time-varying biquad (cutoff array f, updated every block)"""
    f = np.broadcast_to(np.asarray(f, float), x.shape)
    y = np.empty_like(x); zi = np.zeros(2)
    for i in range(0, len(x), block):
        b, a = biquad(kind, f[i], q)
        y[i:i + block], zi = signal.lfilter(b, a, x[i:i + block], zi=zi)
    return y
def fades(x, a=0.002, r=0.01):
    n = len(x); ia, ir = min(n, ns(a)), min(n, ns(r))
    x = x.copy(); x[:ia] *= np.linspace(0, 1, ia); x[n - ir:] *= np.linspace(1, 0, ir); return x
def panLR(x, pan):
    """constant-power pan; pan may be an array (-1 … 1)"""
    th = (np.asarray(pan) + 1) * np.pi / 4
    return x * np.cos(th), x * np.sin(th)

class Bus:
    def __init__(self, name): self.name = name; self.L = np.zeros(N); self.R = np.zeros(N)
    def add(self, x, t0, g=1.0, pan=0.0):
        if isinstance(x, tuple): l, r = x
        else: l, r = panLR(x, pan)
        i0 = int(round(t0 * SR)); a = max(0, -i0); b = min(len(l), N - i0)
        if b <= a: return
        self.L[i0 + a:i0 + b] += g * l[a:b]; self.R[i0 + a:i0 + b] += g * r[a:b]
    def stereo(self): return np.stack([self.L, self.R])

# ── instruments ──────────────────────────────────────────────────────────────
def kick(v=1.0):
    n = ns(0.5); t = tt(n)
    f = 43 + 125 * np.exp(-t * 32) + 28 * np.exp(-t * 7)
    body = sine(f, n) * np.exp(-t * 6.8)
    click = filt(noise(n), 'hp', 2500) * np.exp(-t * 420) * 0.3
    return fades(np.tanh((body + click) * 1.7) * v, 0.0005, 0.02)
def clap(v=1.0):
    n = ns(0.45); t = tt(n); x = np.zeros(n); nz = noise(n)
    for k, off in enumerate([0, 0.009, 0.019, 0.028]):
        i = ns(off); mm = n - i
        x[i:] += nz[:mm] * np.exp(-t[:mm] * (230 if k < 3 else 13))
    return filt(filt(x, 'bp', 1250, 0.8), 'hp', 450) * v * 0.55
def hat(v=1.0, open_=False):
    n = ns(0.4 if open_ else 0.07); t = tt(n)
    x = filt(filt(noise(n), 'hp', 7200, 0.7), 'peak', 10500, 1.0, 5)
    return x * np.exp(-t * (8 if open_ else 60)) * v * 0.22
def snare(v=1.0, tone=195):
    n = ns(0.25); t = tt(n)
    nz = filt(noise(n), 'bp', 3200, 0.55) * np.exp(-t * 20)
    body = sine(tone * (1 + 0.3 * np.exp(-t * 60)), n) * np.exp(-t * 28)
    return (nz * 0.75 + body * 0.45) * v
def tom(f=90, v=1.0):
    n = ns(0.6); t = tt(n)
    return np.tanh(sine(f * (1 + 0.6 * np.exp(-t * 25)), n) * np.exp(-t * 5.5) * 1.4) * v
def pluck(f, v=1.0, bright=1.0, dur=0.3):
    n = ns(dur + 0.25); t = tt(n)
    osc = 0.55 * saw(f, n, rng.random()) + 0.45 * saw(f * 1.0065, n, rng.random()) + 0.25 * sine(f * 2, n)
    y = sweep(osc, 'lp', 380 + 5200 * bright * np.exp(-t * 16), q=1.1)
    return fades(y * np.exp(-t * 6.5) * v, 0.001, 0.05)
def bell(f, v=1.0, ratio=2.0, index=1.6, decay=0.8, dur=2.0):
    n = ns(dur); t = tt(n)
    mod = sine(f * ratio, n) * index * np.exp(-t * 4)
    car = np.sin(2 * np.pi * f * t + mod)
    return fades(car * np.exp(-t / decay) * v, 0.001, 0.2)
def blip(f, v=1.0):
    n = ns(0.3); t = tt(n)
    ff = f * (1 + 0.35 * np.exp(-t * 70))
    return fades((sine(ff, n) * np.exp(-t * 13) + 0.35 * sine(ff * 2, n) * np.exp(-t * 22)) * v, 0.001, 0.05)
def pop(f=650, v=1.0):
    n = ns(0.1); t = tt(n)
    return fades(sine(f * (0.55 + 0.9 * np.exp(-t * 55)), n) * np.exp(-t * 36) * v, 0.0005, 0.01)
def click(v=1.0):
    n = ns(0.05); t = tt(n)
    x = sine(3300, n) * np.exp(-t * 850) + 0.55 * sine(1000, n) * np.exp(-t * 170) + 0.25 * filt(noise(n), 'hp', 5000) * np.exp(-t * 1400)
    return fades(x * v, 0.0003, 0.005)
def tick(v=1.0):
    n = ns(0.012); t = tt(n)
    return fades(sine(5200, n) * np.exp(-t * 900) * v, 0.0002, 0.003)
def whoosh(dur=0.5, flo=250, fhi=5000, peak=0.55, pan0=0.0, pan1=0.0, v=1.0, q=1.1):
    n = ns(dur); u = np.linspace(0, 1, n)
    env = np.where(u < peak, (u / peak) ** 2.2, ((1 - u) / (1 - peak)) ** 1.6)
    env = np.sin(env * np.pi / 2) ** 2
    fc = flo * (fhi / flo) ** env
    x = sweep(noise(n), 'bp', fc, q=q) * 1.6 + 0.25 * sweep(noise(n), 'lp', fc * 0.4)
    x *= env * v
    return panLR(x, np.linspace(pan0, pan1, n))
def riser(dur, v=1.0):
    n = ns(dur); u = np.linspace(0, 1, n)
    env = u ** 2.4
    nz = sweep(noise(n), 'bp', 250 * (9000 / 250) ** u, q=1.6) * 1.5
    tone = sine(180 * 2 ** (u * 3.2), n) * 0.35 + sine(180 * 2 ** (u * 3.2) * 1.5, n) * 0.18
    trem = 0.75 + 0.25 * np.sin(2 * np.pi * np.cumsum(4 + 26 * u ** 2) / SR)
    x = (nz + tone) * env * trem * v
    return x, x
def rev_cymbal(dur, v=1.0):
    n = ns(dur); u = np.linspace(0, 1, n)
    x = filt(filt(noise(n), 'hp', 3500), 'peak', 8000, 0.8, 4) * u ** 3.5 * v
    return fades(x, 0.01, 0.004)
def impact(v=1.0, size=1.0):
    n = ns(3.2); t = tt(n)
    subf = 28 + 70 * np.exp(-t * 5.5)
    sub = np.tanh(sine(subf, n) * np.exp(-t * (2.0 / size)) * 1.5)
    boom = filt(noise(n), 'lp', 180) * np.exp(-t * 4.5) * 1.6
    crash = filt(noise(n), 'hp', 2800) * np.exp(-t * 1.6) * 0.22
    snap = filt(noise(n), 'bp', 1800, 0.7) * np.exp(-t * 60) * 0.9
    return fades((sub + boom + crash + snap) * v, 0.0005, 0.3)
def shutter(v=1.0):
    n = ns(0.2); t = tt(n); x = np.zeros(n)
    c1 = filt(noise(n), 'bp', 2400, 1.5) * np.exp(-t * 700)
    shh = filt(noise(n), 'bp', 5200, 0.9) * np.exp(-t * 55) * 0.45
    x += c1 + shh
    i = ns(0.075); x[i:] += (filt(noise(n), 'bp', 1900, 1.5) * np.exp(-t * 800))[:n - i] * 0.8
    return x * v
def zap(dur=0.34, up=True, v=1.0):
    n = ns(dur); u = np.linspace(0, 1, n)
    f = 380 * (2600 / 380) ** (u if up else 1 - u)
    x = np.tanh(sine(f, n) * 3) * 0.5 + sine(f * 2.01, n) * 0.2
    x *= (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * np.cumsum(np.full(n, 38.0)) / SR)))
    x = filt(x, 'lp', 6000) * np.sin(np.pi * u) ** 0.8 * v
    return x
def glitter(t0, t1, bus, density=18, v=0.2, fmin=2600, fmax=6200, seed=0):
    r = np.random.default_rng(seed)
    k = int((t1 - t0) * density)
    for _ in range(k):
        f = r.uniform(fmin, fmax)
        bus.add(bell(f, v * r.uniform(0.4, 1), ratio=2.76, index=0.6, decay=0.18, dur=0.5), r.uniform(t0, t1), pan=r.uniform(-0.8, 0.8))

def supersaw_pad(notes, t0, t1, cutoff, att=0.4, rel=1.2, detune=0.14, voices=5, bus=None, g=1.0):
    dur = t1 - t0 + rel; n = ns(dur); t = tt(n)
    L = np.zeros(n); R = np.zeros(n)
    for note in notes:
        f = hz(note)
        for k in range(voices):
            d = (k - (voices - 1) / 2) / ((voices - 1) / 2) * detune
            s = saw(f * 2 ** (d / 12), n, rng.random())
            pan = (k / (voices - 1)) * 1.6 - 0.8
            l, r = panLR(s, pan); L += l; R += r
    cut = cutoff(t) if callable(cutoff) else np.full(n, float(cutoff))
    L = sweep(L, 'lp', cut, 0.8); R = sweep(R, 'lp', cut, 0.8)
    sus = t1 - t0
    env = np.clip(t / att, 0, 1) * np.where(t < sus, 1.0, np.exp(-(t - sus) / (rel / 4)))
    scale = 1 / (len(notes) * voices) ** 0.5
    bus.add((L * env * scale, R * env * scale), t0, g)

# ── buses ────────────────────────────────────────────────────────────────────
drums, bass, pad, arp, sfx, verb_send, delay_send = (Bus(n) for n in ['drums', 'bass', 'pad', 'arp', 'sfx', 'verb', 'delay'])

# harmony: (start, end, pad voicing, bass root)
CHORDS = [
    (0.0, 4.0, ['F#3', 'C#4', 'G#4', 'A4'], 'F#1'),
    (4.0, 6.0, ['D3', 'A3', 'C#4', 'E4', 'F#4'], 'D2'),
    (6.0, 8.0, ['E3', 'B3', 'F#4', 'G#4'], 'E2'),
    (8.0, 10.0, ['F#3', 'C#4', 'E4', 'A4'], 'F#2'),
    (10.0, 12.0, ['C#3', 'G#3', 'B3', 'E4'], 'C#2'),
    (12.0, 14.0, ['D3', 'A3', 'C#4', 'E4', 'F#4'], 'D2'),
    (14.0, 15.75, ['E3', 'A3', 'B3', 'E4'], 'E2'),
    (16.0, 19.0, ['A2', 'E3', 'C#4', 'E4', 'G#4', 'B4'], 'A1'),
]
CH = [(a, b, [m(x) for x in v], m(r)) for a, b, v, r in CHORDS]

# pads — intro opens up toward the drop; main section steady; logo chord is wide and bright
a, b, v, _ = CH[0]
supersaw_pad(v, a, b, cutoff=lambda t: 300 + 2600 * np.clip(t / (b - a), 0, 1) ** 2.2, att=1.2, rel=0.25, bus=pad, g=0.5)
for a, b, v, _ in CH[1:7]:
    supersaw_pad(v, a, b, cutoff=2100 if a < 14 else (lambda t: 1900 + 3200 * np.clip(t / 1.75, 0, 1) ** 2), att=0.08, rel=0.35, bus=pad, g=0.62)
a, b, v, _ = CH[7]
supersaw_pad(v, a, b, cutoff=3400, att=0.02, rel=1.4, detune=0.18, voices=7, bus=pad, g=1.0)
supersaw_pad([x + 12 for x in v[2:]], a, b, cutoff=5200, att=0.25, rel=1.6, detune=0.1, voices=5, bus=pad, g=0.32)

# bass — sustained sub + offbeat mid-bass (house)
for a, b, v, r in CH[1:7]:
    n = ns(b - a); t = tt(n)
    subx = sine(hz(r), n) * 0.9 + sine(hz(r) * 2, n) * 0.12
    bass.add(fades(subx, 0.01, 0.03), a, 0.55)
    for s in (2, 6, 10, 14):
        ts = a + s * STEP
        if ts >= b - 0.01 or ts >= 15.75: continue
        nn = ns(0.22); tq = tt(nn)
        mb = sweep(saw(hz(r + 12), nn) + 0.5 * saw(hz(r + 12) * 1.004, nn), 'lp', 250 + 1600 * np.exp(-tq * 22), 1.3)
        bass.add(fades(mb * np.exp(-tq * 7), 0.001, 0.03), ts, 0.36)
a, b, v, r = CH[7]
n = ns(b - a); t = tt(n)
bass.add(fades((sine(hz(r), n) + 0.15 * sine(hz(r) * 2, n)) * np.exp(-t * 0.55), 0.004, 0.3), a, 0.85)

# drums — Act II groove (4.0 → 15.75), fills into the grid and the logo
for i in range(int((15.75 - 4.0) / STEP)):
    ts = 4.0 + i * STEP; s = i % 16
    if s % 4 == 0: drums.add(kick(1.0), ts, 0.82)
    if s in (4, 12): drums.add(clap(1.0), ts, 1.05); verb_send.add(clap(1.0), ts, 0.3)
    if s % 4 == 2: drums.add(hat(1.0), ts, 1.45, pan=0.18)
    elif s % 2 == 1: drums.add(hat(0.45), ts, 1.45, pan=-0.22)
    if s == 14 and i // 16 in (1, 3): drums.add(hat(0.8, True), ts, 0.8, pan=0.25)
    if s in (3, 11) and ts > 6: drums.add(pop(1900, 0.18), ts, 1.0, pan=-0.4)
# snare fill into the grid (11.5 → 12.0) and the build into the fly-out (14.5 → 15.45)
for k in range(8):
    ts = 11.5 + k * 0.0625
    drums.add(snare(0.3 + 0.6 * k / 7, 190 + k * 6), ts, 0.55, pan=(k % 2) * 0.3 - 0.15)
roll = [14.5 + 0.125 * k for k in range(4)] + [15.0 + 0.0625 * k for k in range(4)] + [15.25 + 0.03125 * k for k in range(6)]
for k, ts in enumerate(roll):
    drums.add(snare(0.3 + 0.7 * k / len(roll), 200 + 14 * k), ts, 0.6, pan=0.25 * np.sin(k))
    verb_send.add(snare(0.3, 200), ts, 0.08)
# intro tension: muted ticking 16ths + heartbeat thumps
for i in range(int(3.75 / STEP)):
    ts = i * STEP
    drums.add(hat(0.18 + 0.12 * (i % 4 == 2)), ts, 0.55 * min(1, ts / 0.8), pan=0.3 if i % 2 else -0.3)
for ts, vv in [(1.0, 1.0), (2.5, 0.8), (3.0, 1.0)]:
    drums.add(tom(68, vv), ts, 0.42); verb_send.add(tom(68, vv), ts, 0.2)

# arp — 16th plucks on chord tones (4.0 → 15.75), filter opens during the Odoo build
PAT = [0, 2, 4, 5, 3, 2, 4, 1, 0, 2, 4, 5, 6, 4, 3, 2]
for a, b, v, r in CH[1:7]:
    tones = sorted(v) + [x + 12 for x in sorted(v)]
    for s in range(16):
        ts = a + s * STEP
        if ts >= b - 0.001 or ts >= 15.7: continue
        note = tones[PAT[s] % len(tones)] + 12
        acc = 1.0 if s % 4 == 0 else 0.72 if s % 2 == 0 else 0.55
        bright = 0.55 + 0.45 * np.clip((ts - 13.9) / 1.6, 0, 1) if ts > 13.9 else 0.55
        x = pluck(hz(note), acc, bright)
        pan = 0.35 * np.sin(s * 1.3)
        arp.add(x, ts, 0.34, pan=pan); delay_send.add(x, ts, 0.12, pan=pan)

# ── sound design, frame-locked to the picture ────────────────────────────────
# Act I: inbox chaos (muffled pings), ignition, arch draw, suction run
for ts, f in [(0.18, 1318), (0.42, 1760), (0.61, 1480), (0.83, 1975)]:
    sfx.add(filt(bell(f, 0.5, ratio=2, index=1, decay=0.25, dur=0.6), 'lp', 2500), ts, 0.16, pan=rng.uniform(-0.7, 0.7))
sfx.add(bell(hz(m('F#6')), 1.0, ratio=3.01, index=2.2, decay=1.6, dur=3.5), T['dot'], 0.22)
verb_send.add(bell(hz(m('F#6')), 1.0, ratio=3.01, index=2.2, decay=1.6, dur=3.5), T['dot'], 0.35)
sfx.add(impact(0.5, 0.6), T['dot'], 0.2)
for side in (-1, 1):
    n = ns(T['drawB'] - T['drawA'] + 0.3); u = np.linspace(0, 1, n)
    tone = sweep(saw(hz(m('F#3')) * 2 ** (u * 1.0), n), 'lp', 600 + 5000 * u ** 1.5, 2.0) * np.sin(np.pi * np.clip(u * 1.15, 0, 1)) * 0.5
    sfx.add(fades(tone), T['drawA'], 0.15, pan=0.65 * side); verb_send.add(tone, T['drawA'], 0.12, pan=0.5 * side)
sfx.add(whoosh(0.7, 200, 2500, 0.8, 0, 0, 0.6), T['baseA'], 0.35)
glitter(T['dot'], T['drawB'] + 0.3, sfx, 12, 0.12, seed=3)

# paperwork card positions + doorway centre (intro.js DOCS / VP1), per format
if VERT:
    DOCS_X = [780, 300, 290, 800, 720, 540, 330, 110, 975, 640]
    DOCS_Y = [250, 330, 1270, 1190, 1570, 118, 1720, 640, 640, 1850]
    VPX, VPY = 540, 760
else:
    DOCS_X = [1500, 400, 330, 1590, 1215, 960, 700, 180, 1760, 1330]
    DOCS_Y = [215, 248, 700, 640, 925, 118, 955, 470, 430, 400]
    VPX, VPY = 960, 471
DOCS_Z = [40, -60, 70, -30, 40, -300, -20, -320, -300, -620]
order = sorted(range(10), key=lambda i: np.hypot(DOCS_X[i] - VPX, DOCS_Y[i] - VPY) + (400 if DOCS_Z[i] < -200 else 0))
def ph(pan):  # sounds that come from the phone: it sits right/left in 16:9, centred in 9:16
    return pan * 0.15 if VERT else pan
PENTA = ['F#4', 'A4', 'B4', 'C#5', 'E5', 'F#5', 'A5', 'B5', 'C#6', 'E6']
for k, di in enumerate(order):
    sA = T['suckA'] + k * T['suckGap']; sB = sA + T['suckDur']
    pan = (DOCS_X[di] - VPX) / VPX
    sfx.add(whoosh(T['suckDur'] + 0.05, 400, 3800, 0.85, pan, 0, 0.55), sA, 0.18)
    x = blip(hz(m(PENTA[k])), 1.0)
    sfx.add(x, sB, 0.2, pan=pan * 0.3); delay_send.add(x, sB, 0.15, pan=pan * 0.3); verb_send.add(x, sB, 0.12)
# headline hits
for ts, notes in [(T['hlA'], ['F#3', 'C#4', 'A4']), (T['hlB'], ['A3', 'E4', 'C#5'])]:
    for nn in notes:
        x = pluck(hz(m(nn)), 0.9, 0.8, 0.6)
        sfx.add(x, ts, 0.22); verb_send.add(x, ts, 0.3)
# riser + fly-through into the drop
sfx.add(riser(T['pass'] - 3.0, 0.9), 3.0, 0.32)
sfx.add(rev_cymbal(T['pass'] - T['flyA'], 1.0), T['flyA'], 0.32)
sfx.add(whoosh(0.62, 150, 6000, 0.92, 0, 0, 1.0, q=0.8), T['flyA'], 0.5)
sfx.add(impact(1.0, 1.2), T['pass'], 0.8); verb_send.add(impact(0.6), T['pass'], 0.35)
glitter(4.0, 4.9, sfx, 22, 0.1, seed=5)
sfx.add(whoosh(0.5, 300, 3000, 0.3, 0, 0.5, 0.5), T['phoneIn'] + 0.05, 0.28)

# Act II UI
for k in range(4): sfx.add(pop(560 + 90 * k, 0.8), 4.2 + 0.1 * k, 0.12, pan=ph(0.35))
for ts in (T['tapTO'], T['tapSubmit'], T['tapClaim']): sfx.add(click(1.0), ts - 0.01, 0.34, pan=ph(0.4 if ts < 7.9 else -0.4 if ts < 9.9 else 0.4))
sfx.add(whoosh(0.32, 900, 5000, 0.35, 0.5, -0.1, 0.5), T['pushTO'], 0.2)
for ts in (T['toFrom'], T['toTo']): sfx.add(click(0.5), ts, 0.2, pan=ph(0.4))
for k in range(4): sfx.add(tick(0.8), T['toReq'] + 0.065 * k, 0.3, pan=ph(0.4))
x = bell(hz(m('C#6')), 0.8, 2, 1.1, 0.35, 1.0); sfx.add(x, T['toToast'], 0.22, pan=ph(0.4)); verb_send.add(x, T['toToast'], 0.15)
x = bell(hz(m('E6')), 0.8, 2, 1.1, 0.45, 1.2); sfx.add(x, T['toToast'] + 0.085, 0.22, pan=ph(0.4)); verb_send.add(x, T['toToast'] + 0.085, 0.15)
if VERT:   # the phone exits left, then comes back in from the right
    sfx.add(whoosh(0.3, 250, 4500, 0.75, 0.0, -0.9, 0.9), T['whip1'], 0.45); sfx.add(whoosh(0.32, 250, 4500, 0.25, 0.9, 0.0, 0.9), T['whip1'] + 0.26, 0.45)
else:
    sfx.add(whoosh(0.55, 200, 4200, 0.45, 0.8, -0.8, 1.0), T['whip1'], 0.5)
for k in range(12): sfx.add(tick(0.7), T['exAmt'] + 0.035 * k, 0.26, pan=ph(-0.4))
sfx.add(click(0.6), T['exCat'], 0.22, pan=ph(-0.4))
sfx.add(shutter(1.0), T['exSnap'] - 0.02, 0.5, pan=ph(-0.35)); verb_send.add(shutter(0.6), T['exSnap'], 0.08)
x = bell(hz(m('C#6')), 0.8, 2, 1.1, 0.35, 1.0); sfx.add(x, T['exToast'], 0.22, pan=ph(-0.4)); verb_send.add(x, T['exToast'], 0.15)
x = bell(hz(m('E6')), 0.8, 2, 1.1, 0.45, 1.2); sfx.add(x, T['exToast'] + 0.085, 0.22, pan=ph(-0.4)); verb_send.add(x, T['exToast'] + 0.085, 0.15)
if VERT:   # exits right, comes back in from the left
    sfx.add(whoosh(0.3, 250, 4500, 0.75, 0.0, 0.9, 0.9), T['whip2'], 0.45); sfx.add(whoosh(0.32, 250, 4500, 0.25, -0.9, 0.0, 0.9), T['whip2'] + 0.26, 0.45)
else:
    sfx.add(whoosh(0.55, 200, 4200, 0.45, -0.8, 0.8, 1.0), T['whip2'], 0.5)
# signature notification chime + breakout
for k, nn in enumerate(['A5', 'C#6', 'E6']):
    x = bell(hz(m(nn)), 1.0, 2.0, 1.4, 0.7, 1.8)
    sfx.add(x, T['lockNotif'] + 0.08 * k, 0.3, pan=ph(0.35)); verb_send.add(x, T['lockNotif'] + 0.08 * k, 0.28)
# haptic buzz under the chime
_n = ns(0.36); _u = np.linspace(0, 1, _n)
_bz = np.tanh(np.sin(2 * np.pi * np.cumsum(np.full(_n, 172.0)) / SR) * 2.5) * np.sin(np.pi * np.clip(_u / 0.97, 0, 1)) ** 0.7 * (0.7 + 0.3 * np.sin(2 * np.pi * 31 * _u * 0.36))
sfx.add(filt(_bz, 'lp', 900), T['lockNotif'], 0.2, pan=ph(0.35))
sfx.add(whoosh(0.5, 300, 5000, 0.4, 0.4, -0.5, 0.8), T['breakout'], 0.38)
sfx.add(pop(420, 1.0), T['breakout'] + 0.12, 0.3, pan=ph(-0.3))
sfx.add(whoosh(0.4, 400, 7000, 0.7, -0.5, 0, 0.8), T['grid'] - 0.1, 0.35)
# feature cards burst (16ths), chips
for k in range(4):
    x = pop(700 + 120 * k, 1.0); sfx.add(x, T['cards'] + 0.125 * k, 0.28, pan=[-0.6, 0.6, -0.6, 0.6][k])
    sfx.add(whoosh(0.28, 600, 5000, 0.3, 0, [-0.7, 0.7, -0.7, 0.7][k], 0.35), T['cards'] + 0.125 * k, 0.18)
for k in range(2): sfx.add(pop(900 + 150 * k, 0.8), T['chips'] + 0.1 * k, 0.2)
# Odoo beat
sfx.add(whoosh(0.45, 300, 4000, 0.3, 0, 0, 0.8), T['odoo'], 0.34)
sfx.add(whoosh(0.5, 250, 3500, 0.45, 0.9, 0.4, 0.6), T['odoo'] + 0.1, 0.24)
sfx.add(zap(0.34, True, 1.0), T['beam1'], 0.2, pan=0.1); verb_send.add(zap(0.34, True, 0.5), T['beam1'], 0.1)
for k in range(3): sfx.add(pop(800 + 100 * k, 0.8), T['odooChips'] + 0.09 * k, 0.18)
x = bell(hz(m('E6')), 1.0, 2, 1.3, 0.6, 1.5); sfx.add(x, T['approve'], 0.28, pan=ph(0.5)); verb_send.add(x, T['approve'], 0.2)
x = bell(hz(m('A6')), 0.8, 2, 1.0, 0.6, 1.5); sfx.add(x, T['approve'] + 0.07, 0.2, pan=ph(0.5)); verb_send.add(x, T['approve'] + 0.07, 0.2)
sfx.add(zap(0.34, False, 1.0), T['beam2'], 0.2, pan=-0.1)
sfx.add(click(0.6), T['beam2'] + 0.34, 0.2, pan=ph(-0.4))
# fly-out: reverse whoosh, a breath of silence, then the logo impact
sfx.add(rev_cymbal(0.33, 1.0), T['out'], 0.3)
sfx.add(whoosh(0.34, 200, 7000, 0.7, 0, 0, 1.1, q=0.8), T['out'] + 0.02, 0.55)
sfx.add(impact(1.2, 1.6), T['end'], 0.9); verb_send.add(impact(0.9, 1.6), T['end'], 0.35)
for k, nn in enumerate(['A5', 'E6', 'A6', 'C#7']):
    x = bell(hz(m(nn)), 1.0, 2.0 if k < 2 else 3.01, 1.2, 1.6, 4.0)
    sfx.add(x, T['end'] + 0.06 * k, 0.17, pan=[-0.3, 0.3, -0.5, 0.5][k]); verb_send.add(x, T['end'] + 0.06 * k, 0.3)
glitter(T['end'], T['end'] + 1.4, sfx, 16, 0.12, seed=9)
for k in range(6): sfx.add(tick(0.5), T['end'] + 0.1 + 0.035 * k, 0.12, pan=-0.3 + 0.12 * k)
sfx.add(whoosh(0.9, 400, 3000, 0.25, -0.3, 0.3, 0.35), T['end'] + 0.3, 0.2)
sfx.add(pop(900, 0.6), T['end'] + 1.1, 0.15)
sfx.add(whoosh(1.1, 2500, 12000, 0.45, -0.7, 0.7, 0.5, q=0.7), T['shine'], 0.16)
x = bell(hz(m('E7')), 0.8, 3.01, 0.8, 0.8, 2.0); sfx.add(x, T['glint'], 0.16); verb_send.add(x, T['glint'], 0.25)
glitter(T['shine'] + 0.6, T['shine'] + 1.1, sfx, 14, 0.07, fmin=4000, fmax=8000, seed=11)

# ── mixing ───────────────────────────────────────────────────────────────────
def sidechain(times, depth=0.55, rel=0.16):
    g = np.ones(N); t = tt(ns(0.45))
    shape = 1 - depth * np.exp(-t / rel) * np.clip(t / 0.004, 0, 1) - depth * (t < 0.004) * (1 - t / 0.004)
    for ts in times:
        i = ns(ts); j = min(N, i + len(shape))
        g[i:j] = np.minimum(g[i:j], shape[:j - i])
    return g
kicks = [4.0 + k * BEAT for k in range(int((15.75 - 4.0) / BEAT))]
sc = sidechain(kicks)
for bus_, d in ((pad, 1.0), (bass, 1.0), (arp, 0.45)):
    gg = 1 - d * (1 - sc)
    bus_.L *= gg; bus_.R *= gg

def make_ir(sec=2.8, pre=0.025):
    n = ns(sec); t = tt(n)
    irs = []
    for _ in range(2):
        x = noise(n) * np.exp(-t * 6.9 / sec)
        x = x * (1 - np.clip(t / (sec * 0.7), 0, 1)) + filt(x, 'lp', 2200) * np.clip(t / (sec * 0.7), 0, 1)
        x = filt(x, 'hp', 180)
        x = np.concatenate([np.zeros(ns(pre)), x]); irs.append(x / np.sqrt(np.sum(x ** 2)))
    return irs
IR = make_ir()
# pad goes to the reverb too
verb_in_L = verb_send.L + 0.35 * pad.L + 0.25 * arp.L
verb_in_R = verb_send.R + 0.35 * pad.R + 0.25 * arp.R
wetL = signal.fftconvolve(verb_in_L, IR[0])[:N]
wetR = signal.fftconvolve(verb_in_R, IR[1])[:N]
wetL, wetR = filt(wetL, 'hs', 6000, 0.7, -4), filt(wetR, 'hs', 6000, 0.7, -4)
# ping-pong delay (dotted 8th)
dL, dR = np.zeros(N), np.zeros(N)
src = filt(filt((delay_send.L + delay_send.R) * 0.5, 'hp', 400), 'lp', 5000)
d = ns(0.375)
for k in range(1, 6):
    if d * k >= N: break
    sh = np.zeros(N); sh[d * k:] = src[:N - d * k]
    g = 0.55 * 0.5 ** (k - 1)
    if k % 2: dL += g * sh
    else: dR += g * sh

stems = {
    'drums': (drums.L, drums.R, 0.92),
    'bass': (filt(bass.L, 'hp', 32), filt(bass.R, 'hp', 32), 0.5),
    'pad': (pad.L, pad.R, 0.56),
    'arp': (arp.L, arp.R, 2.1),
    'sfx': (sfx.L, sfx.R, 1.0),
    'reverb': (wetL, wetR, 0.55),
    'delay': (dL, dR, 1.6),
}
L = np.zeros(N); R = np.zeros(N)
for k, (l, r, g) in stems.items():
    L += l * g; R += r * g
    rms = np.sqrt(np.mean((l * g) ** 2 + (r * g) ** 2) / 2)
    print(f'  {k:7s} rms {20 * np.log10(rms + 1e-12):6.1f} dBFS   peak {20 * np.log10(np.max(np.abs(np.concatenate([l, r]) * g)) + 1e-12):6.1f}')
# silence gap before the logo hit (tension), master tone shaping
gap = np.ones(N); i0, i1 = ns(15.78), ns(T['end'] - 0.004)
gap[i0:i1] = 0.06; gap[i0 - ns(0.03):i0] = np.linspace(1, 0.06, ns(0.03)); gap[i1:i1 + ns(0.002)] = np.linspace(0.06, 1, ns(0.002))[:len(gap[i1:i1 + ns(0.002)])]
L *= gap; R *= gap
L, R = filt(L, 'hp', 24), filt(R, 'hp', 24)
L, R = filt(L, 'peak', 320, 0.9, -1.5), filt(R, 'peak', 320, 0.9, -1.5)
L, R = filt(L, 'hs', 9000, 0.7, 0.5), filt(R, 'hs', 9000, 0.7, 0.5)
L, R = filt(L, 'peak', 1250, 0.8, -1.5), filt(R, 'peak', 1250, 0.8, -1.5)
L, R = filt(L, 'peak', 3600, 0.9, 1.8), filt(R, 'peak', 3600, 0.9, 1.8)

# loudness: pre-gain then look-ahead limiter (-1 dBFS ceiling)
def limiter(L, R, ceiling=10 ** (-2.2 / 20), release=0.09):
    pk = maximum_filter1d(np.maximum(np.abs(L), np.abs(R)), size=ns(0.004) * 2 + 1)
    target = np.minimum(1.0, ceiling / np.maximum(pk, 1e-9))
    g = np.empty(N); cur = 1.0; a = np.exp(-1 / (release * SR))
    for i in range(N):
        tv = target[i]
        cur = tv if tv < cur else tv + (cur - tv) * a
        g[i] = cur
    g = signal.lfilter([1 - 0.9], [1, -0.9], g)  # tiny smoothing
    g = np.minimum(g, target)
    return L * g, R * g
seg = slice(ns(4.0), ns(15.7))
rms_main = np.sqrt(np.mean((L[seg] ** 2 + R[seg] ** 2) / 2))
pre = 10 ** (-13.5 / 20) / rms_main
L, R = limiter(L * pre, R * pre)
# master fade with the picture
fo = np.ones(N); i0 = ns(T['fade'] - 0.1); fo[i0:] = np.linspace(1, 0, N - i0) ** 1.6
fi = np.clip(tt(N) / 0.3, 0, 1)
L *= fo * fi; R *= fo * fi
out = np.stack([L, R], 1)
print(f'  master peak {20 * np.log10(np.max(np.abs(out))):.2f} dBFS, rms {20 * np.log10(np.sqrt(np.mean(out ** 2))):.1f} dBFS')
_name = 'soundtrack-vertical.wav' if VERT else 'soundtrack.wav'
wavfile.write(str(Path(__file__).with_name(_name)), SR, out.astype(np.float32))
print('wrote', _name)
