"""Fit a voice-over to the picture from one file per line (a voice artist's takes or AI takes).

    python source/voice-assemble.py <folder>

<folder> holds <line id>-t<n>.<mp3|wav|m4a|flac> (or <line id>.<ext>), the ids being those of timeline.json → "voiceover"
(vo1 … vo7). For every line: each take is decoded, its silence trimmed and its level matched to the other lines; the longest
take that fits the line's window is used. A take that runs over may extend to the line's "limit" (the next picture cut), and
only past that is it sped up, by at most 10 %. Lines with no file are left silent and listed as missing.
To choose a take yourself, put a picks.json in the folder, e.g. {"vo4": "vo4-t2.mp3"}; lines not named there are chosen as above.

Writes into <folder>:
    voice-aligned.wav            one track, t = 0 is the film's first frame
    voice-aligned.windows.json   where each line actually sits (soundtrack.py ducks the music there)
    fit-report.json              every take's length, the take used, any speed change, start and end
Then:  python source/soundtrack.py --vo <folder>/voice-aligned.wav
"""
import json, re, subprocess, sys
import numpy as np
from pathlib import Path
from scipy import signal
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parent.parent
TL = json.loads((ROOT / 'timeline.json').read_text(encoding='utf-8'))
FPS, SR = TL['fps'], 48000
N = TL['durationFrames'] * SR // FPS
MAX_TEMPO = 1.10
src = Path(sys.argv[1]).resolve()

def decode(f):
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(f), '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'])
    return np.frombuffer(raw, np.float32).astype(np.float64)
def tempo(x, k):                                                  # pitch-preserving speed change
    p = subprocess.run(['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-af', f'atempo={k:.5f}', '-f', 'f32le', '-'],
                       input=x.astype(np.float32).tobytes(), capture_output=True, check=True)
    return np.frombuffer(p.stdout, np.float32).astype(np.float64)
def trim(x, rel_db=-42.0, pre=0.03, post=0.12):                   # cut the silence around the speech, keep a little air
    w, h = int(0.02 * SR), int(0.005 * SR)
    e = np.sqrt(np.convolve(x ** 2, np.ones(w) / w, mode='same'))[::h]
    on = np.where(e > max(e.max() * 10 ** (rel_db / 20), 10 ** (-60 / 20)))[0]
    a, b = on[0] * h, on[-1] * h
    y = x[max(0, a - int(pre * SR)):min(len(x), b + int(post * SR))].copy()
    fi, fo = int(0.005 * SR), int(0.03 * SR)
    y[:fi] *= np.linspace(0, 1, fi); y[-fo:] *= np.linspace(1, 0, fo)
    return y, (b - a) / SR
def tighten(y, cap=0.22, rel_db=-42.0):                           # shorten the pauses inside a line to `cap` seconds; the speech itself is untouched
    w, h = int(0.02 * SR), int(0.005 * SR)
    e = np.sqrt(np.convolve(y ** 2, np.ones(w) / w, mode='same'))[::h]
    quiet = e <= max(e.max() * 10 ** (rel_db / 20), 10 ** (-60 / 20))
    keep, i, n = np.ones(len(y), bool), 0, len(quiet)
    while i < n:
        if not quiet[i]: i += 1; continue
        j = i
        while j < n and quiet[j]: j += 1
        if i > 0 and j < n and (j - i) * h > int(cap * SR):       # an inside pause longer than the cap: drop its middle
            a = i * h + int(cap * SR) // 2; keep[a:a + (j - i) * h - int(cap * SR)] = False
        i = j
    return y[keep]
def loudness(x):                                                  # K-weighted level of the speech (BS.1770 pre-filter, 400 ms blocks, -10 LU relative gate)
    z = signal.lfilter([1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585], x)
    z = signal.lfilter([1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621], z) ** 2
    w, h = int(0.4 * SR), int(0.1 * SR)
    p = np.array([z[i:i + w].mean() for i in range(0, max(1, len(z) - w + 1), h)])
    p = p[p > p.mean() * 0.1] if len(p) > 1 else p
    return -0.691 + 10 * np.log10(p.mean() + 1e-20)

picks = json.loads((src / 'picks.json').read_text(encoding='utf-8')) if (src / 'picks.json').exists() else {}
out, report, windows = np.zeros(N), [], []
for line in TL['voiceover']:
    start, end = line['start'] / FPS, line['end'] / FPS
    limit = line.get('limit', line['end']) / FPS
    files = sorted(f for f in src.iterdir() if re.fullmatch(re.escape(line['id']) + r'(-t\d+)?\.(mp3|wav|m4a|flac)', f.name, re.I))
    if not files:
        report.append({'id': line['id'], 'text': line['text'], 'missing': True}); continue
    takes = []
    for f in files:
        y, spoken = trim(decode(f))
        takes.append({'file': f.name, 'audio': y, 'spoken_s': round(float(spoken), 3), 'clip_s': len(y) / SR, 'lufs': round(float(loudness(y)), 1)})
    fitting = [t for t in takes if t['clip_s'] <= end - start]
    use = max(fitting, key=lambda t: t['clip_s']) if fitting else min(takes, key=lambda t: t['clip_s'])
    if line['id'] in picks: use = next(t for t in takes if t['file'] == picks[line['id']])
    y, k, cut = use['audio'], 1.0, 0.0
    if len(y) / SR > limit - start:                               # past the next picture cut: first take the slack out of the pauses …
        n0 = len(y); y = tighten(y); cut = (n0 - len(y)) / SR
    if len(y) / SR > limit - start:                               # … and only then speed it up, gently
        k = min(MAX_TEMPO, (len(y) / SR) / (limit - start) * 1.004); y = tempo(y, k)
    y = y * 10 ** ((-23.0 - loudness(y)) / 20)                    # every line at the same level; the mix sets the final one
    i0 = int(round(start * SR)); y = y[:max(0, N - i0)]
    out[i0:i0 + len(y)] += y
    t1 = start + len(y) / SR
    windows.append({'id': line['id'], 'start_s': round(start, 3), 'end_s': round(t1, 3)})
    report.append({'id': line['id'], 'text': line['text'], 'takes': [{k2: t[k2] for k2 in ('file', 'spoken_s', 'lufs')} for t in takes], 'used': use['file'], 'picked_by': 'picks.json' if line['id'] in picks else 'longest take that fits',
                   'pauses_shortened_s': round(cut, 2), 'speed': round(k, 3), 'start_s': round(start, 2), 'ends_s': round(t1, 2), 'window_ends_s': round(end, 2), 'limit_s': round(limit, 2),
                   'fits': 'window' if t1 <= end + 1e-6 else 'limit' if t1 <= limit + 1e-6 else 'OVER'})

peak = np.abs(out).max()
if peak > 0: out *= 10 ** (-3 / 20) / peak
wavfile.write(src / 'voice-aligned.wav', SR, (np.clip(out, -1, 1) * 32767).astype(np.int16))
(src / 'voice-aligned.windows.json').write_text(json.dumps(windows, indent=2), encoding='utf-8')
(src / 'fit-report.json').write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
for r in report:
    if r.get('missing'): print(r['id'], 'MISSING, left silent'); continue
    print(r['id'], f"{r['used']:<12} pauses -{r['pauses_shortened_s']:.2f} s  speed x{r['speed']:.3f}  {r['start_s']:5.2f} to {r['ends_s']:5.2f} s  (window to {r['window_ends_s']:.2f}, limit {r['limit_s']:.2f})  {r['fits']}")
