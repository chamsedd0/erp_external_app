"""Assemble the scratch voice-over guide track (timing check only — a synthetic system voice, NOT for publishing).

    powershell -NoProfile -ExecutionPolicy Bypass -File source/scratch-voice.ps1 -Rate 2     # speaks each line
    python source/scratch-voice.py                                                           # aligns them to the picture

Each review/voiceover-scratch/<id>.wav is trimmed and placed at its "start" frame from timeline.json → "voiceover".
Writes review/voiceover-scratch/scratch-voice-aligned.wav (one take, t = 0 = first frame) and a fit report.
A real voice take delivered the same way (one WAV aligned to the film start) drops into:  python source/soundtrack.py --vo <file>
"""
import json
import numpy as np
from scipy.io import wavfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TL = json.loads((ROOT / 'timeline.json').read_text(encoding='utf-8'))
FPS, SR = TL['fps'], 48000
N = TL['durationFrames'] * SR // FPS
out = np.zeros(N)
d = ROOT / 'review' / 'voiceover-scratch'
report = []
for line in TL['voiceover']:
    sr, x = wavfile.read(d / f"{line['id']}.wav")
    assert sr == SR, 'scratch-voice.ps1 writes 48 kHz mono'
    x = x.astype(np.float64) / 32768
    idx = np.where(np.abs(x) > 0.02 * np.abs(x).max())[0]
    x = x[max(0, idx[0] - 480):idx[-1] + 2400]                     # keep 10 ms before, 50 ms after
    i0 = line['start'] * SR // FPS
    out[i0:i0 + len(x)] += x[:max(0, N - i0)]
    spoken, window = len(x) / SR, (line['end'] - line['start']) / FPS
    report.append({'id': line['id'], 'start_s': round(line['start'] / FPS, 2), 'window_s': round(window, 2), 'spoken_s': round(spoken, 2), 'fits': bool(spoken <= window), 'text': line['text']})
wavfile.write(d / 'scratch-voice-aligned.wav', SR, (np.clip(out, -1, 1) * 32767).astype(np.int16))
(d / 'fit-report.json').write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
for r in report: print(r['id'], f"at {r['start_s']:5.2f}s  window {r['window_s']:.2f}s  spoken {r['spoken_s']:.2f}s", 'fits' if r['fits'] else 'OVER')
