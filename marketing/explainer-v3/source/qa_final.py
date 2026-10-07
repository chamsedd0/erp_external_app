"""QA on the encoded film — measurements only, written to review/qa/.
    python source/qa_final.py [out/shadow-by-octagon9-explainer-9x16.mp4]
Checks: container/streams (ffprobe, decoded frame count), faststart, BT.709 limited-range conversion (flat patches against
the values predicted for the brand colours), out-of-range luma share, audio loudness and true peak as decoded from the AAC,
audio offset against the WAV mix (cross-correlation), plus two contact sheets to LOOK at: the frames around every cut,
and key frames at 360x640 (phone preview size)."""
import json, subprocess, sys
import numpy as np
from pathlib import Path
from scipy.io import wavfile
from scipy import signal

ROOT = Path(__file__).resolve().parent.parent
TL = json.loads((ROOT / 'timeline.json').read_text(encoding='utf-8'))
EV, FPS, NF = TL['events'], TL['fps'], TL['durationFrames']
src = (Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'out' / 'shadow-by-octagon9-explainer-9x16.mp4').resolve()
qa = ROOT / 'review' / 'qa'; qa.mkdir(parents=True, exist_ok=True)
rep = {'file': str(src.relative_to(ROOT))}

p = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-count_frames', '-show_entries',
    'stream=codec_type,codec_name,profile,level,width,height,pix_fmt,r_frame_rate,nb_read_frames,color_range,color_space,color_transfer,color_primaries,sample_rate,channels,duration:format=duration,size,bit_rate', '-of', 'json', str(src)]))
v = next(s for s in p['streams'] if s['codec_type'] == 'video'); a = next((s for s in p['streams'] if s['codec_type'] == 'audio'), None)
rep['video'] = v; rep['audio'] = a; rep['format'] = p['format']
raw = src.read_bytes(); moov, mdat = raw.find(b'moov'), raw.find(b'mdat')
rep['checks'] = {
    'frames': f"{v['nb_read_frames']} decoded / {NF} expected", 'frames_ok': int(v['nb_read_frames']) == NF,
    'duration_s': float(p['format']['duration']), 'duration_ok': abs(float(p['format']['duration']) - NF / FPS) < 0.02,
    'size_ok': (v['width'], v['height']) == (1080, 1920), 'fps': v['r_frame_rate'],
    'h264_yuv420p': v['codec_name'] == 'h264' and v['pix_fmt'] == 'yuv420p',
    'bt709_tags': [v.get('color_primaries'), v.get('color_transfer'), v.get('color_space'), v.get('color_range')],
    'faststart': 0 < moov < mdat,
    'audio': None if not a else f"{a['codec_name']} {a['sample_rate']} Hz {a['channels']} ch",
}

# luma: flat patches + out-of-range share (decode every 6th frame at full size)
w, h = 1080, 1920
# the stored Y plane itself (asking ffmpeg for 'gray' would expand limited range to full and hide a wrong conversion)
ydat = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(src), '-map', '0:v', '-vf', "select='not(mod(n\\,6))'", '-vsync', '0', '-f', 'rawvideo', '-pix_fmt', 'yuv420p', '-'])
fsz = w * h * 3 // 2
Y = np.frombuffer(ydat, np.uint8).reshape(-1, fsz)[:, :w * h].reshape(-1, h, w)
def patch(frame, y0, x0): q = Y[frame // 6, y0:y0 + 40, x0:x0 + 40]; return round(float(q.mean()), 1)
def predict(hexcol):
    r, g, b = [int(hexcol[i:i + 2], 16) / 255 for i in (1, 3, 5)]; return round(16 + 219 * (0.2126 * r + 0.7152 * g + 0.0722 * b), 1)
rep['luma'] = {
    'ink_corner_frame_0': {'measured': patch(0, 20, 20), 'predicted_for_#080814': predict('#080814')},
    'pale_studio_frame_1700': {'measured': patch(1700, 1840, 20), 'predicted_for_#F6F8FB': predict('#F6F8FB')},
    'share_below_16_pct': round(float((Y < 16).mean() * 100), 4), 'share_above_235_pct': round(float((Y > 235).mean() * 100), 4),
}

# audio as decoded from the AAC: loudness, true peak, offset against the WAV mix
if a:
    e = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(src), '-map', '0:a', '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    tail = e[e.rfind('Summary:'):]
    grab = lambda key: next((ln.split(':')[1].strip() for ln in tail.splitlines() if ln.strip().startswith(key)), None)
    pcm = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(src), '-map', '0:a', '-ac', '1', '-ar', '48000', '-f', 's16le', '-'])
    dec = np.frombuffer(pcm, np.int16).astype(np.float64) / 32768
    mixname = sys.argv[2] if len(sys.argv) > 2 else 'out/audio/shadow-explainer-mix.wav'
    sr, mix = wavfile.read(ROOT / mixname); mix = mix.mean(axis=1)
    n = min(len(dec), len(mix), 48000 * 12); seg = slice(48000 * 2, n)             # 10 s window after the opening
    c = signal.correlate(dec[seg], mix[seg], mode='full', method='fft'); lag = int(np.argmax(c)) - (n - 48000 * 2 - 1)
    rep['audio_decoded'] = {'integrated': grab('I:'), 'true_peak': grab('Peak:'), 'offset_vs_wav_ms': round(lag / 48, 2), 'samples': int(len(dec)), 'expected_samples': NF * 48000 // FPS}

(qa / f'final-{src.stem}.json').write_text(json.dumps(rep, indent=2), encoding='utf-8')
print(json.dumps({k: rep[k] for k in ('checks', 'luma') if k in rep}, indent=1)); print(json.dumps(rep.get('audio_decoded'), indent=1))

# contact sheets to look at
def sheet(frames, tw, th, cols, out, label=True):
    sel = '+'.join('eq(n\\,%d)' % f for f in frames)
    draw = (",drawtext=fontfile='C\\:/Windows/Fonts/segoeui.ttf':text='%{frame_num}':start_number=0:x=6:y=4:fontsize=15:fontcolor=white:box=1:boxcolor=black@0.55" if label else '')
    rows = -(-len(frames) // cols)
    vf = f"select='{sel}'{draw},scale={tw}:{th},tile={cols}x{rows}:padding=6:margin=6:color=0x1b1d25"
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(src), '-vf', vf, '-vsync', '0', '-frames:v', '1', str(out)], check=True)
cuts = [0, EV['screenSwap'], EV['formIn'], EV['toastIn'], EV['recordIn'], EV['inboxCut'], EV['portalCloseStart'], NF - 3]
bf = sorted({min(NF - 1, max(0, c + d)) for c in cuts for d in (-2, -1, 0, 1, 2)})
sheet(bf, 216, 384, 8, qa / f'boundaries-{src.stem}.png')
key = [60, 196, 400, 470, 700, 860, 1060, 1200, 1340, 1500, 1700, 2100]
sheet(key, 360, 640, 6, qa / f'preview-size-360x640-{src.stem}.png', label=False)
print('sheets written:', len(bf), 'boundary frames;', len(key), 'key frames at 360x640')
