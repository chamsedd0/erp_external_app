"""Shadow Portal launch film v2 — original score and sound design, synthesized from scratch (no samples, nothing licensed).

One clock for picture and sound: everything is placed from ../timeline.json (fps, events, sfx cues, beat grid).
    python source/soundtrack.py               → out/audio/*-16x9.wav  (mix + stems: music, interaction, transition, brand)
    python source/soundtrack.py --vertical    → out/audio/*-9x16.wav  (same score; panning follows the portrait layout)
Also writes out/audio/report-<fmt>.json with MEASUREMENTS ONLY: integrated loudness (BS.1770-4 K-weighting + gating),
true peak (4× oversampled), stem levels, cue placement vs picture frames, a mono check and a phone-speaker proxy.
None of this is listening approval — a person still has to listen (see README → audio review checklist).

Direction (brief §11): restrained electronic pulse, tactile percussion, warm low end, sparse harmonic detail, no vocals.
113.87 BPM (31.615 frames per beat) — the grid is anchored so the hero arrival (frame 150) and the brand signature
(frame 972 = 16.20 s) are beats 0 and 26; the Odoo approval (624) and the status cue (719) land on beats 15 and 18.
Harmony in F: I → vi → IV → I/3 → IV → V9sus → (breath) → I. The status cue (C6 → F6) foreshadows the signature (C6 F6 A6).
Synthesis helpers adapted from ../intro-video/soundtrack.py (v1, kept intact).
"""
import json
import sys
import numpy as np
from scipy import signal
from scipy.io import wavfile
from scipy.ndimage import maximum_filter1d
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TL = json.loads((ROOT / 'timeline.json').read_text(encoding='utf-8'))
FPS, NF, EV = TL['fps'], TL['durationFrames'], TL['events']
CUE = {c['cue']: c['frame'] for c in TL['sfx']}
VERT = '--vertical' in sys.argv
FMT = '9x16' if VERT else '16x9'
SR = 48000
N = NF * SR // FPS                     # 960 000 samples = exactly 20.000 s
BEATF, B0 = TL['music']['beatFrames'], TL['music']['beat0Frame']
BEAT = BEATF / FPS
def sec(frame): return frame / FPS
def beat(n): return sec(B0 + n * BEATF)
rng = np.random.default_rng(20260928)

# ── basics ───────────────────────────────────────────────────────────────────
NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}
def m(s): return 12 * (int(s[-1]) + 1) + NOTE[s[:-1]]
def hz(n): return 440.0 * 2 ** ((n - 69) / 12)
def tt(n): return np.arange(n) / SR
def ns(s): return max(1, int(round(s * SR)))
def polyblep(ph, dt):
    y = np.zeros_like(ph)
    a = ph < dt; x = ph[a] / dt[a]; y[a] = x + x - x * x - 1
    b = ph > 1 - dt; x = (ph[b] - 1) / dt[b]; y[b] = x * x + x + x + 1
    return y
def saw(f, n, ph0=0.0):
    f = np.broadcast_to(np.asarray(f, float), (n,)); dt = f / SR
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
    elif kind in ('hs', 'ls'):
        sq = 2 * np.sqrt(A) * al; sg = 1 if kind == 'hs' else -1
        b = [A * ((A + 1) + sg * (A - 1) * c + sq), -2 * sg * A * ((A - 1) + sg * (A + 1) * c), A * ((A + 1) + sg * (A - 1) * c - sq)]
        a = [(A + 1) - sg * (A - 1) * c + sq, 2 * sg * ((A - 1) - sg * (A + 1) * c), (A + 1) - sg * (A - 1) * c - sq]
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
    th = (np.asarray(pan) + 1) * np.pi / 4     # constant power
    return x * np.cos(th), x * np.sin(th)

class Bus:
    def __init__(self): self.L = np.zeros(N); self.R = np.zeros(N)
    def add(self, x, t0, g=1.0, pan=0.0):
        l, r = x if isinstance(x, tuple) else panLR(x, pan)
        i0 = int(round(t0 * SR)); a = max(0, -i0); b = min(len(l), N - i0)
        if b > a: self.L[i0 + a:i0 + b] += g * l[a:b]; self.R[i0 + a:i0 + b] += g * r[a:b]

# ── instruments (all restrained: soft attacks, short tails, no hype) ───────
def felt_kick(v=1.0):
    n = ns(0.42); t = tt(n)
    f = 47 + 66 * np.exp(-t * 36) + 16 * np.exp(-t * 7)
    body = sine(f, n) * np.exp(-t * 8)
    knock = filt(noise(n), 'bp', 1100, 1.1) * np.exp(-t * 110) * 0.16
    return fades(np.tanh((body + knock) * 1.25) * v, 0.0008, 0.03)
def shaker(v=1.0):
    n = ns(0.1); t = tt(n)
    x = filt(filt(noise(n), 'hp', 6200), 'lp', 11500) * np.clip(t / 0.008, 0, 1) * np.exp(-t * 42)
    return x * v * 0.16
def wood(f=1050, v=1.0):
    n = ns(0.14); t = tt(n)
    x = sine(f * (1 + 0.18 * np.exp(-t * 90)), n) * np.exp(-t * 48) + 0.35 * filt(noise(n), 'bp', f * 2.3, 2.2) * np.exp(-t * 160)
    return fades(x * v, 0.0003, 0.01)
def pulse_bass(f, v=1.0, dur=0.24):
    n = ns(dur + 0.08); t = tt(n)
    x = sine(f, n) + 0.45 * sine(2 * f, n) + 0.18 * sine(3 * f, n)       # harmonics keep it audible on small speakers
    x = np.tanh(x * 1.2) * np.exp(-t * 7.5) * np.clip(t / 0.004, 0, 1)
    return fades(filt(x, 'lp', 900) * v, 0.001, 0.05)
def pad(notes, dur, cutoff, att=0.6, rel=1.0, detune=0.09, voices=3, bright=None):
    n = ns(dur + rel); t = tt(n); L = np.zeros(n); R = np.zeros(n)
    for note in notes:
        f = hz(note)
        for k in range(voices):
            d = (k - (voices - 1) / 2) / max(1, (voices - 1) / 2) * detune
            s_ = 0.7 * saw(f * 2 ** (d / 12), n, rng.random()) + 0.3 * sine(f * 2 ** (d / 12), n, rng.random())
            l, r = panLR(s_, (k / max(1, voices - 1)) * 1.2 - 0.6); L += l; R += r
    cut = cutoff(t) if callable(cutoff) else np.full(n, float(cutoff))
    L, R = sweep(L, 'lp', cut, 0.6), sweep(R, 'lp', cut, 0.6)
    env = np.clip(t / att, 0, 1) ** 1.5 * np.where(t < dur, 1.0, np.exp(-(t - dur) / (rel / 4)))
    k = 1 / (len(notes) * voices) ** 0.5
    return L * env * k, R * env * k
def keys(f, v=1.0, decay=1.4, dur=3.0):            # soft electric-piano: FM with a fast-decaying index
    n = ns(dur); t = tt(n)
    mod = sine(f, n) * (1.6 * np.exp(-t * 9) + 0.25)
    x = np.sin(2 * np.pi * f * t + mod) * np.exp(-t / decay) + 0.25 * sine(2 * f, n) * np.exp(-t / (decay * 0.4))
    return fades(x * v * np.clip(t / 0.003, 0, 1), 0.001, 0.2)
def mallet(f, v=1.0, decay=0.6, ratio=2.0, index=1.1, dur=1.6, glass=0.0):
    n = ns(dur); t = tt(n)
    mod = sine(f * ratio, n) * index * np.exp(-t * 6)
    x = np.sin(2 * np.pi * f * t + mod) * np.exp(-t / decay)
    if glass: x += glass * np.sin(2 * np.pi * f * 3.5 * t + sine(f * 7, n) * 0.4) * np.exp(-t / (decay * 0.35))
    return fades(x * v * np.clip(t / 0.0015, 0, 1), 0.0005, 0.15)
def pluck(f, v=1.0, bright=0.5, dur=0.3):
    n = ns(dur + 0.25); t = tt(n)
    osc = 0.6 * saw(f, n, rng.random()) + 0.4 * saw(f * 1.005, n, rng.random())
    y = sweep(osc, 'lp', 300 + 3200 * bright * np.exp(-t * 18), q=0.9)
    return fades(y * np.exp(-t * 7) * v, 0.001, 0.05)
def tap(v=1.0):                                     # one dry fingertip touch on glass
    n = ns(0.06); t = tt(n)
    x = 0.55 * sine(2300, n) * np.exp(-t * 520) + 0.6 * sine(190 * (1 + 0.5 * np.exp(-t * 200)), n) * np.exp(-t * 75) \
        + 0.45 * sine(900, n) * np.exp(-t * 160) + 0.35 * filt(noise(n), 'hp', 3200) * np.exp(-t * 1500)   # 900 Hz body: carries on phone speakers
    return fades(x * v, 0.0002, 0.01)
def mouse_click(v=1.0, f=4300):
    n = ns(0.03); t = tt(n)
    x = filt(noise(n), 'bp', f, 3.0) * np.exp(-t * 1300) * 1.4 + 0.7 * sine(1250, n) * np.exp(-t * 300)
    return fades(x * v, 0.0002, 0.004)
def thock(v=1.0):                                   # soft tactile onset
    n = ns(0.5); t = tt(n)
    body = sine(48 + 34 * np.exp(-t * 26), n) * np.exp(-t * 7)
    felt = filt(noise(n), 'lp', 1400) * np.exp(-t * 55) * 0.35
    return fades(np.tanh((body + felt) * 1.1) * v, 0.0006, 0.05)
def air(dur, peak=0.6, flo=300, fhi=3200, v=1.0, pan0=0.0, pan1=0.0):
    n = ns(dur); u = np.linspace(0, 1, n)
    env = np.where(u < peak, (u / peak) ** 2, ((1 - u) / (1 - peak)) ** 1.4)
    env = np.sin(env * np.pi / 2) ** 2
    x = sweep(noise(n), 'bp', flo * (fhi / flo) ** env, q=0.7) * env * v
    return panLR(x, np.linspace(pan0, pan1, n))

# ── stems (+ per-stem reverb sends so every stem stays self-contained) ─────
music, inter, trans, brand = Bus(), Bus(), Bus(), Bus()
music_v, inter_v, trans_v, brand_v, music_d, brand_d = Bus(), Bus(), Bus(), Bus(), Bus(), Bus()
P = (lambda l, p: p) if VERT else (lambda l, p: l)   # pan helper: P(landscape, portrait)

# harmony: (beat from, beat to, pad voicing, bass root or None)
CHORDS = [
    (0, 8, ['F3', 'A3', 'C4', 'E4'], 'F2'),                 # I      hero → the employee's screen
    (8, 12, ['D3', 'F3', 'A3', 'C4', 'E4'], 'D2'),          # vi     the request
    (12, 16, ['Bb2', 'D3', 'F3', 'A3', 'C4'], 'Bb1'),       # IV     the Odoo record, approval on beat 15
    (16, 20, ['A2', 'C3', 'F3', 'G3', 'E4'], 'A1'),         # I/3    the employee's status (cue on beat 18)
    (20, 23, ['Bb2', 'D3', 'F3', 'A3', 'C4'], 'Bb1'),       # IV
    (23, 25, ['C3', 'F3', 'G3', 'Bb3', 'D4'], 'C2'),        # V9sus
    (25, 26, ['C3', 'F3', 'G3', 'Bb3', 'D4'], None),        # breath: pulse stops while the portal closes
]
FINAL = ['F2', 'C3', 'A3', 'E4', 'G4']                      # I (add9) — the brand

# 01 · introduce the world lightly: one tactile onset, one tonal lift
trans.add(thock(1.0), sec(CUE['onset']), 0.9)
lift = pad([m(x) for x in ['F3', 'C4', 'E4', 'G4']], beat(0) - sec(CUE['tonal-lift']), lambda t: 380 + 1500 * np.clip(t / 2.3, 0, 1) ** 1.6, att=1.7, rel=0.6)
music.add(lift, sec(CUE['tonal-lift']), 0.9); music_v.add(lift, sec(CUE['tonal-lift']), 0.35)
x = mallet(hz(m('G5')), 0.5, decay=1.2, ratio=3.5, index=0.5, dur=2.4)          # one glint as the display wakes
music.add(x, sec(EV['displayWakeStart']) + 0.02, 0.10, pan=P(0.3, 0.0)); music_v.add(x, sec(EV['displayWakeStart']), 0.25)
trans.add(air(sec(EV['cameraLand'] - EV['cameraPullStart']) + 0.2, 0.45, 180, 1600, 0.6), sec(EV['cameraPullStart']), 0.10)   # the pull-back, felt more than heard

# 02–05 · the pulse: kick on the beat, bass 8ths, pads per chord, sparse detail
for b0, b1, voicing, root in CHORDS:
    x = pad([m(v) for v in voicing], (b1 - b0) * BEAT, 1500 if b0 < 16 else 1900, att=0.25 if b0 else 0.08, rel=0.9)
    music.add(x, beat(b0), 0.62); music_v.add(x, beat(b0), 0.3)
    if root:
        for e in range(int((b1 - b0) * 2)):
            accent = [1.0, 0.5, 0.78, 0.5][e % 4]
            music.add(pulse_bass(hz(m(root)), accent), beat(b0 + e / 2), 0.5)
x = pad([m(v) for v in FINAL], sec(NF) - beat(26), lambda t: 900 + 1600 * np.clip(t / 0.8, 0, 1), att=0.35, rel=0.5, detune=0.07)
music.add(x, beat(26), 0.72); music_v.add(x, beat(26), 0.5)
n = ns(sec(NF) - beat(26)); t = tt(n)
music.add(fades(sine(hz(m('F1')), n) * np.clip(t / 0.3, 0, 1) * np.exp(-t * 0.35), 0.01, 0.4), beat(26), 0.34)   # warm floor under the logo

for b in range(0, 25):                               # the last kick is beat 24; beat 25 breathes
    music.add(felt_kick(0.9 if b % 4 == 0 else 0.72), beat(b), 0.75)
for h in range(8, 50):                               # shaker on the off-beats from the employee scene
    bb = h / 2
    if bb >= 25 or h % 2 == 0: continue
    thin = 0.55 if 10 <= bb < 17 else 1.0             # UI proof: fewer competing transients
    music.add(shaker(thin), beat(bb), 1.0, pan=0.25)
for bb in (3.5, 7.5, 11.5, 19.5, 23.5):              # tactile punctuation at phrase ends
    music.add(wood(1050, 0.6), beat(bb), 0.35, pan=-0.3)
# arrival: a soft keys chord on beat 0 — the gentle musical arrival for the hero
for i, nn in enumerate(['F3', 'C4', 'E4', 'A4']):
    x = keys(hz(m(nn)), 0.8, 1.6, 3.2)
    music.add(x, sec(CUE['hero-arrival']) + 0.012 * i, 0.16, pan=[-0.2, 0.1, -0.1, 0.25][i]); music_v.add(x, sec(CUE['hero-arrival']), 0.12)
# development (05): a sparse plucked line on chord tones, then keys on beat 20
LINE = [('C5', 18.5), ('A4', 19.0), ('G4', 19.5), ('E5', 20.5), ('D5', 21.0), ('C5', 21.5), ('A4', 22.5), ('F5', 23.0), ('D5', 23.5), ('C5', 24.0)]
for nn, bb in LINE:
    x = pluck(hz(m(nn)), 0.7, 0.45)
    music.add(x, beat(bb), 0.13, pan=0.3 * np.sin(bb * 2.1)); music_d.add(x, beat(bb), 0.07)
for i, nn in enumerate(['D3', 'A3', 'C4', 'F4']):
    x = keys(hz(m(nn)), 0.7, 1.4, 2.6); music.add(x, beat(20) + 0.01 * i, 0.12); music_v.add(x, beat(20), 0.1)

# interaction · real actions only, each on its visible cause
inter.add(tap(1.0), sec(CUE['touch']), 1.1, pan=P(0.35, 0.1))                                   # fingertip on Submit
x = mallet(hz(m('C6')), 0.9, decay=0.55, ratio=2.0, index=0.9, dur=1.4)                           # submitted
inter.add(x, sec(CUE['confirm']), 0.30, pan=P(0.35, 0.0)); inter_v.add(x, sec(CUE['confirm']), 0.22)
inter.add(mouse_click(1.0), sec(CUE['click']), 0.95, pan=P(-0.45, -0.15))                         # manager's click…
inter.add(mouse_click(0.6, 3600), sec(EV['approveRelease']), 0.55, pan=P(-0.45, -0.15))           # …and release
x = mallet(hz(m('A5')), 0.9, decay=0.7, ratio=2.0, index=0.8, dur=1.6)                           # Approved (status bar)
inter.add(x, sec(CUE['approved']), 0.28, pan=P(0.3, 0.0)); inter_v.add(x, sec(CUE['approved']), 0.22)
for i, (nn, dt) in enumerate([('C6', 0.0), ('F6', 0.095)]):                                       # the employee's status: two notes
    x = mallet(hz(m(nn)), 0.9, decay=0.6, ratio=2.0, index=1.0, dur=1.5)
    inter.add(x, sec(CUE['status-two-note']) + dt, 0.27); inter_v.add(x, sec(CUE['status-two-note']) + dt, 0.24)

# transition · quiet air, never a whoosh per item
trans.add(air(0.62, 0.55, 260, 2600, 0.8), sec(CUE['enter-screen']), 0.12)                        # into the screen
x = wood(420, 0.8); trans.add(x, sec(CUE['record-match']), 0.22); trans_v.add(x, sec(CUE['record-match']), 0.2)   # the record appears
trans.add(air(0.35, 0.4, 400, 2200, 0.6), sec(CUE['record-match']) - 0.03, 0.07)
trans.add(air(sec(972 - EV['portalCloseStart']) + 0.08, 0.92, 220, 3800, 0.8), sec(EV['portalCloseStart']), 0.13)   # portal closes

# brand · three notes across the landing (approach at 16.20 s, apex light, wordmark), natural decay
for i, (nn, fr) in enumerate([('C6', CUE['signature']), ('F6', EV['apexLight']), ('A6', EV['wordmarkIn'] + 2)]):
    x = mallet(hz(m(nn)), 1.0, decay=1.4, ratio=2.0, index=1.0, dur=3.6, glass=0.18)
    pan = P([-0.18, 0.05, 0.2][i], 0.0)
    brand.add(x, sec(fr), 0.30 - 0.03 * i, pan=pan); brand_v.add(x, sec(fr), 0.4); brand_d.add(x, sec(fr), 0.05, pan=pan)

# ── mix: sidechain pump, reverb/delay returns per stem ────────────────────
def pump(times, depth=0.22, rel=0.14):
    g = np.ones(N); t = tt(ns(0.4))
    shape = 1 - depth * np.exp(-t / rel) * np.clip(t / 0.005, 0, 1) - depth * (t < 0.005) * (1 - t / 0.005)
    for ts in times:
        i = ns(ts); j = min(N, i + len(shape)); g[i:j] = np.minimum(g[i:j], shape[:j - i])
    return g
g = pump([beat(b) for b in range(25)])
# duck the bed ~3 dB under each interaction so the real actions read, even on a phone speaker
def duck(times, depth_db=3.0, att=0.015, hold=0.18, rel=0.3):
    d = np.ones(N); t = tt(ns(att + hold + rel)); lo = 10 ** (-depth_db / 20)
    shape = np.where(t < att, 1 - (1 - lo) * t / att, np.where(t < att + hold, lo, lo + (1 - lo) * np.clip((t - att - hold) / rel, 0, 1)))
    for ts in times:
        i = ns(ts - att); j = min(N, i + len(shape)); d[i:j] = np.minimum(d[i:j], shape[:j - i])
    return d
g *= duck([sec(CUE[c]) for c in ('touch', 'confirm', 'click', 'approved', 'status-two-note')])
music.L *= g; music.R *= g
def make_ir(sec_=1.9, pre=0.018, seed=7):
    r = np.random.default_rng(seed); n = ns(sec_); t = tt(n); irs = []
    for _ in range(2):
        x = r.standard_normal(n) * np.exp(-t * 6.9 / sec_)
        x = x * (1 - np.clip(t / (sec_ * 0.6), 0, 1)) + filt(x, 'lp', 2400) * np.clip(t / (sec_ * 0.6), 0, 1)
        x = np.concatenate([np.zeros(ns(pre)), filt(x, 'hp', 200)]); irs.append(x / np.sqrt(np.sum(x ** 2)))
    return irs
IR = make_ir()
def verb(bus):
    l = signal.fftconvolve(bus.L, IR[0])[:N]; r = signal.fftconvolve(bus.R, IR[1])[:N]
    return filt(l, 'hs', 6000, 0.7, -4), filt(r, 'hs', 6000, 0.7, -4)
def delay(bus, fb=0.42, taps=5):
    src = filt(filt((bus.L + bus.R) * 0.5, 'hp', 350), 'lp', 5200); d = ns(BEAT * 0.75)
    L, R = np.zeros(N), np.zeros(N)
    for k in range(1, taps + 1):
        if d * k >= N: break
        sh = np.zeros(N); sh[d * k:] = src[:N - d * k]
        (L if k % 2 else R)[:] += fb ** (k - 1) * 0.6 * sh
    return L, R
for bus, send, dl in ((music, music_v, music_d), (inter, inter_v, None), (trans, trans_v, None), (brand, brand_v, brand_d)):
    l, r = verb(send); bus.L += 0.5 * l; bus.R += 0.5 * r
    if dl is not None: l, r = delay(dl); bus.L += l; bus.R += r
STEMS = {'music': music, 'interaction': inter, 'transition': trans, 'brand': brand}
GAIN = {'music': 1.0, 'interaction': 1.0, 'transition': 1.0, 'brand': 1.0}
for b in STEMS.values():                                   # rumble guard on every stem
    b.L, b.R = filt(b.L, 'hp', 26), filt(b.R, 'hp', 26)

# ── loudness + true peak (measurements) ───────────────────────────────────
def k_weight(x):   # ITU-R BS.1770-4 pre-filter coefficients at 48 kHz
    x = signal.lfilter([1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585], x)
    return signal.lfilter([1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621], x)
def block_power(L, R, win=0.4, hop=0.1):
    zl, zr = k_weight(L) ** 2, k_weight(R) ** 2
    cl, cr = np.concatenate([[0], np.cumsum(zl)]), np.concatenate([[0], np.cumsum(zr)])
    w, h = ns(win), ns(hop); idx = np.arange(0, len(L) - w + 1, h)
    return ((cl[idx + w] - cl[idx]) + (cr[idx + w] - cr[idx])) / w, idx
def lufs(L, R):
    p, _ = block_power(L, R); lk = -0.691 + 10 * np.log10(p + 1e-20)
    p1 = p[lk > -70]
    if not len(p1): return -120.0
    rel = -0.691 + 10 * np.log10(np.mean(p1)) - 10
    p2 = p[(lk > -70) & (lk > rel)]
    return float(-0.691 + 10 * np.log10(np.mean(p2)))
def true_peak(L, R):
    return float(20 * np.log10(max(np.max(np.abs(signal.resample_poly(c, 4, 1))) for c in (L, R)) + 1e-12))
def tp_limit(L, R, ceiling_db, look=0.0025, release=0.12):
    c = 10 ** (ceiling_db / 20)
    pk = np.maximum(np.abs(signal.resample_poly(L, 4, 1)), np.abs(signal.resample_poly(R, 4, 1)))
    pk = pk[:len(L) * 4].reshape(-1, 4).max(axis=1)
    pk = maximum_filter1d(pk, size=2 * ns(look) + 1)
    target = np.minimum(1.0, c / np.maximum(pk, 1e-9))
    gg = np.empty_like(target); cur = 1.0; a = np.exp(-1 / (release * SR))
    for i in range(len(target)):
        tv = target[i]; cur = tv if tv < cur else tv + (cur - tv) * a; gg[i] = cur
    gg = np.minimum(signal.lfilter([0.25], [1, -0.75], gg, zi=[0.75 * gg[0]])[0], 1.0)   # soften the release ripple
    gg = np.minimum(gg, target)                                           # never above the per-sample target
    return L * gg, R * gg, gg

L = sum(b.L * GAIN[k] for k, b in STEMS.items()); R = sum(b.R * GAIN[k] for k, b in STEMS.items())
L, R = filt(L, 'peak', 300, 0.8, -1.0), filt(R, 'peak', 300, 0.8, -1.0)      # gentle master tone
L, R = filt(L, 'hs', 8500, 0.7, 0.8), filt(R, 'hs', 8500, 0.7, 0.8)
TARGET, CEIL = -14.0, -1.5
pre = 10 ** ((TARGET - lufs(L, R)) / 20)
for it in range(4):                                      # gain to target, then oversampled true-peak limiting; repeat to converge
    Lm, Rm, gcurve = tp_limit(L * pre, R * pre, CEIL)
    err = TARGET - lufs(Lm, Rm)
    if abs(err) < 0.05: break
    pre *= 10 ** (err / 20)
tail = np.ones(N); i0 = ns(18.4); tail[i0:] = np.cos(np.linspace(0, np.pi / 2, N - i0)) ** 1.2     # let the last chord finish on the frame
Lm, Rm = Lm * tail, Rm * tail
mix = np.stack([Lm, Rm], 1).astype(np.float32)

# ── report ───────────────────────────────────────────────────────────────
def onset(bus, t_exp, win=0.08, frac=0.1):
    e = np.abs(bus.L) + np.abs(bus.R); i0, i1 = ns(max(0, t_exp - win)), ns(t_exp + win)
    seg = e[i0:i1]; k = np.argmax(seg > frac * seg.max()) if seg.max() > 0 else 0
    return round(((i0 + k) / SR - t_exp) * 1000, 2)
cues = {}
for cue, bus in (('onset', trans), ('touch', inter), ('confirm', inter), ('record-match', trans), ('click', inter), ('approved', inter), ('status-two-note', inter), ('signature', brand)):
    cues[cue] = {'frame': CUE[cue], 'time_s': round(sec(CUE[cue]), 4), 'onset_offset_ms': onset(bus, sec(CUE[cue]))}
mono = (Lm + Rm) / 2
phone_bed = {}
def phone(x): return filt(filt(filt(x, 'hp', 320), 'hp', 320), 'lp', 7500)
bed = phone((music.L + music.R + trans.L + trans.R) / 2 * pre)
for cue, bus in (('touch', inter), ('confirm', inter), ('click', inter), ('approved', inter), ('status-two-note', inter), ('signature', brand)):
    c = phone((bus.L + bus.R) / 2 * pre); t0 = sec(CUE[cue]); a, b = ns(t0), ns(t0 + (0.06 if cue in ('touch', 'click') else 0.25))
    phone_bed[cue] = round(float(10 * np.log10((np.mean(c[a:b] ** 2) + 1e-20) / (np.mean(bed[a:b] ** 2) + 1e-20))), 1)
rep = {
    'format': FMT, 'sample_rate': SR, 'samples': N, 'duration_s': N / SR,
    'integrated_lufs': round(lufs(Lm, Rm), 2), 'true_peak_dbtp': round(true_peak(Lm, Rm), 2), 'limiter_gain_reduction_db': {'max': round(float(20 * np.log10(gcurve.min())), 2), 'p99': round(float(20 * np.log10(np.percentile(gcurve, 1))), 2),
                                   'share_of_time_over_1db': round(float(np.mean(gcurve < 10 ** (-1 / 20))), 4)},
    'stem_integrated_lufs_in_mix': {k: round(lufs(b.L * pre, b.R * pre), 1) for k, b in STEMS.items()},
    'mono': {'lr_correlation': round(float(np.corrcoef(Lm, Rm)[0, 1]), 3),
             'mono_minus_stereo_lufs_db': round(lufs(mono, mono) - lufs(Lm, Rm), 2)},
    'phone_speaker_proxy_cue_to_bed_db': phone_bed,
    'cue_placement': cues,
    'beat_grid': {'bpm': TL['music']['bpm'], 'beat0_frame': B0, 'beat_frames': BEATF},
    'note': 'Measurements only. Human listening (headphones, phone speaker, mono) is still required before approval.',
}
out = ROOT / 'out' / 'audio'; out.mkdir(parents=True, exist_ok=True)
wavfile.write(out / f'shadow-portal-launch-v2-mix-{FMT}.wav', SR, mix)
for k, b in STEMS.items():   # stems at mix gain, before the master limiter (they sum to the pre-limiter mix)
    wavfile.write(out / f'shadow-portal-launch-v2-stem-{k}-{FMT}.wav', SR, np.stack([b.L * pre, b.R * pre], 1).astype(np.float32))
(out / f'report-{FMT}.json').write_text(json.dumps(rep, indent=2), encoding='utf-8')
print(json.dumps(rep, indent=2))
