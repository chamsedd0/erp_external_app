"""Measured motion check: frame-to-frame difference energy of a rendered film (not a substitute for watching it).
    python source/qa_motion.py <video.mp4> <out-prefix>
Writes <out-prefix>.json (per-frame mean |ΔY| on a 240-px-wide luma proxy, flagged spikes) and <out-prefix>.svg (curve with shot lines).
A spike that is not an intended cut is a pop; a saw-tooth pattern during a move is stutter."""
import json, subprocess, sys
import numpy as np
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
TL = json.loads((ROOT / 'timeline.json').read_text(encoding='utf-8'))
src, pre = sys.argv[1], sys.argv[2]
info = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', src]))['streams'][0]
w = 240; h = int(round(info['height'] * w / info['width'] / 2) * 2)
raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', src, '-vf', f'scale={w}:{h}:flags=area,format=gray', '-f', 'rawvideo', '-'])
F = np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.float32)
d = np.concatenate([[0.0], np.abs(np.diff(F, axis=0)).mean(axis=(1, 2))])
cuts = {s['start'] for s in TL['shots']} | {TL['events'].get('toastIn'), TL['events'].get('inboxCut')}
spikes = []
for i in range(2, len(d) - 2):
    nb = np.median(np.r_[d[i - 2:i], d[i + 1:i + 3]])
    if d[i] > 3.0 and d[i] > 2.5 * (nb + 0.3):
        spikes.append({'frame': i, 'delta': round(float(d[i]), 2), 'neighbours': round(float(nb), 2), 'intended_cut': i in cuts})
rep = {'video': src, 'frames': int(len(d)), 'mean_delta': round(float(d.mean()), 3), 'max_delta': round(float(d.max()), 2), 'argmax': int(d.argmax()), 'spikes': spikes,
       'per_frame': [round(float(x), 3) for x in d]}
Path(pre + '.json').write_text(json.dumps(rep), encoding='utf-8')
W, H, top = 1800, 360, 20; ymax = max(8.0, float(np.percentile(d, 99.5)) * 1.1)
pts = ' '.join(f'{i / (len(d) - 1) * W:.1f},{top + H - min(d[i], ymax) / ymax * H:.1f}' for i in range(len(d)))
svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H + 60}"><rect width="100%" height="100%" fill="#111"/>',
       '<style>text{font:12px Segoe UI,Arial;fill:#ddd}</style>']
for s in TL['shots']:
    x = s['start'] / (len(d) - 1) * W; svg.append(f'<line x1="{x}" x2="{x}" y1="{top}" y2="{top + H}" stroke="#fff" stroke-opacity=".35" stroke-dasharray="4 4"/><text x="{x + 4}" y="{top + 14}">shot {s["id"]}</text>')
for k, v in TL['events'].items():
    x = v / (len(d) - 1) * W; svg.append(f'<line x1="{x}" x2="{x}" y1="{top + H - 8}" y2="{top + H}" stroke="#10B981"/>')
for sp in spikes:
    x = sp['frame'] / (len(d) - 1) * W; svg.append(f'<circle cx="{x}" cy="{top + H - min(sp["delta"], ymax) / ymax * H}" r="5" fill="none" stroke="{"#10B981" if sp["intended_cut"] else "#ef4444"}" stroke-width="2"/><text x="{x + 6}" y="{top + 28}">{sp["frame"]}</text>')
svg.append(f'<polyline points="{pts}" fill="none" stroke="#89BFFF" stroke-width="1.2"/>')
for sec in range(21): svg.append(f'<text x="{min(W - 24, sec / 20 * W + 2)}" y="{top + H + 20}">{sec}s</text>')
svg.append(f'<text x="4" y="{top + H + 44}">mean |ΔY| per frame (0–{ymax:.1f} of 255), luma proxy {w}×{h}; red = spike not at an intended cut</text></svg>')
Path(pre + '.svg').write_text('\n'.join(svg), encoding='utf-8')
print(json.dumps({k: rep[k] for k in ('frames', 'mean_delta', 'max_delta', 'argmax', 'spikes')}))
