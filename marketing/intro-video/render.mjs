// Frame-accurate renderer with real, adaptive motion blur.
//
// Headless Chrome seeks the composition to each sub-frame time. The composition declares how many
// sub-frames every moment needs (window.__samples: 6 for calm shots, up to ~44 for whip pans), and the
// sub-frames are averaged in 32-bit with dithered rounding (180° shutter). Chunks of frames are handed out
// to parallel workers as lossless segments, then encoded to H.264 BT.709 with the soundtrack muxed in.
//
//   node render.mjs                       → out/shadow-portal-intro.mp4 (+ -web.mp4)   1920×1080 @ 60
//   node render.mjs --format vertical     → out/shadow-portal-intro-vertical.mp4 (+ -web)  1080×1920 @ 60
//   node render.mjs --preview             → quick 30 fps check, no blur
//   node render.mjs --encode-only         → re-encode the existing segments (tweak encoder settings)
//   options: --fps 60 --sub N (fixed samples) --shutter 180 --workers 8 --dpr 1 (e.g. 1.5 = supersample)
//            --from 0 --to 19 --name file --no-audio --crf 17 --web-crf 21 --grain 2
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME || 'C:/Users/chams/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const argv = process.argv.slice(2);
const has = k => argv.includes(k);
const opt = (k, d) => { const i = argv.indexOf(k); return i < 0 ? d : argv[i + 1]; };
const PREVIEW = has('--preview'), ENCODE_ONLY = has('--encode-only');
const FPS = Number(opt('--fps', PREVIEW ? 30 : 60));
const FIXED_SUB = opt('--sub', PREVIEW ? '1' : null);
const SHUTTER = Number(opt('--shutter', 180));
const WORKERS = Number(opt('--workers', Math.max(2, Math.min(8, os.cpus().length - 4))));
const DPR = Number(opt('--dpr', 1));
const VERT = opt('--format', 'landscape') === 'vertical';
const NAME = opt('--name', (PREVIEW ? 'preview' : 'shadow-portal-intro') + (VERT ? '-vertical' : ''));
const VW = VERT ? 1080 : 1920, VH = VERT ? 1920 : 1080;
const WAV = path.join(ROOT, VERT && fs.existsSync(path.join(ROOT, 'soundtrack-vertical.wav')) ? 'soundtrack-vertical.wav' : 'soundtrack.wav');
const AUDIO = !has('--no-audio') && fs.existsSync(WAV);
const OUT = path.join(ROOT, 'out');
const SEGDIR = path.join(OUT, 'segments');
fs.mkdirSync(SEGDIR, { recursive: true });

const server = await startServer(0);
const url = `http://127.0.0.1:${server.address().port}/index.html?render${VERT ? '&format=vertical' : ''}`;
// GPU raster on the discrete GPU when there is one (≈2× faster captures; harmless elsewhere)
const LAUNCH = { executablePath: CHROME, headless: true, args: ['--no-sandbox', '--hide-scrollbars', '--force-color-profile=srgb', '--disable-lcd-text',
  '--use-angle=d3d11', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--force_high_performance_gpu'] };

// ask the composition for its duration and per-frame sample density
const probe = await puppeteer.launch(LAUNCH);
const pp = await probe.newPage();
await pp.goto(url); await pp.waitForFunction('window.__ready === true');
const DURATION = await pp.evaluate(() => window.__duration);
const T0 = Number(opt('--from', 0)), T1 = Number(opt('--to', DURATION));
const N = Math.round((T1 - T0) * FPS);
const SAMPLES = FIXED_SUB ? Array(N).fill(Number(FIXED_SUB))
  : await pp.evaluate((n, fps, t0) => Array.from({ length: n }, (_, i) => window.__samples(t0 + i / fps)), N, FPS, T0);
await probe.close();
const subTimes = i => {
  const n = SAMPLES[i], t = T0 + i / FPS;
  return Array.from({ length: n }, (_, j) => Math.min(DURATION, Math.max(0, t + (n > 1 ? ((j + 0.5) / n - 0.5) * (SHUTTER / 360) / FPS : 0))));
};

// dither tile (random rounding of the high-precision average → no banding from the accumulation)
const DITHER = new Float32Array(256 * 256);
{ let s = 12345; for (let i = 0; i < DITHER.length; i++) { s = (s * 1103515245 + 12345) >>> 0; DITHER[i] = (s >>> 8) / 16777216; } }

const segName = ci => path.join(SEGDIR, `${NAME}_${String(ci).padStart(3, '0')}.mkv`);
const started = Date.now();
if (!ENCODE_ONLY) {
  for (const f of fs.readdirSync(SEGDIR)) if (f.startsWith(NAME + '_') && f.endsWith('.mkv')) fs.unlinkSync(path.join(SEGDIR, f));
  const total = SAMPLES.reduce((a, b) => a + b, 0);
  console.log(`render ${NAME}: ${N} frames @${FPS}fps, ${total} samples (${Math.min(...SAMPLES)}–${Math.max(...SAMPLES)} per frame), ${WORKERS} workers, dpr ${DPR}`);
  // sample-balanced chunks: heavy-blur moments get short chunks so they spread across workers
  const chunks = [];
  for (let a = 0, i = 0, sum = 0; i < N; i++) {
    sum += SAMPLES[i];
    if (sum >= 360 || i - a + 1 >= 45 || i === N - 1) { chunks.push([a, i + 1]); a = i + 1; sum = 0; }
  }
  let next = 0, doneSamples = 0, doneFrames = 0;
  const PX = VW * VH * 3;
  async function worker(k) {
    const browser = await puppeteer.launch(LAUNCH);
    const page = await browser.newPage();
    page.on('pageerror', e => console.log(`[w${k}]`, e.message));
    await page.setViewport({ width: VW, height: VH, deviceScaleFactor: DPR });
    await page.goto(url); await page.waitForFunction('window.__ready === true', { timeout: 60000 });
    const acc = new Uint32Array(PX), outBuf = Buffer.alloc(PX);
    for (let ci = next++; ci < chunks.length; ci = next++) {
      const [a, b] = chunks[ci];
      const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${VW}x${VH}`, '-framerate', String(FPS), '-i', '-',
        '-c:v', 'libx264rgb', '-crf', '0', '-preset', 'ultrafast', segName(ci)], { stdio: ['pipe', 'inherit', 'inherit'] });
      const ffDone = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exit ' + c))));
      for (let i = a; i < b; i++) {
        const times = subTimes(i), n = times.length;
        acc.fill(0);
        for (const t of times) {
          await page.evaluate(v => window.__seek(v), t);
          // calm frames: lossless PNG; heavy-blur frames: JPEG (averaged away, much faster)
          const shot = await page.screenshot(n > 8 ? { type: 'jpeg', quality: 94, optimizeForSpeed: true } : { type: 'png', optimizeForSpeed: true });
          let img = sharp(shot).removeAlpha();
          if (DPR !== 1) img = img.resize(VW, VH, { kernel: 'lanczos3' });
          const data = await img.raw().toBuffer();
          for (let p = 0; p < PX; p++) acc[p] += data[p];
          doneSamples++;
        }
        if (n === 1) for (let p = 0; p < PX; p++) outBuf[p] = acc[p];
        else {
          const inv = 1 / n, ox = (i * 71) & 255, oy = (i * 37) & 255;
          for (let y = 0, p = 0; y < VH; y++) {
            const row = ((y + oy) & 255) << 8;
            for (let x = 0; x < VW; x++) {
              const d = DITHER[row | ((x + ox) & 255)];
              outBuf[p] = Math.min(255, (acc[p] * inv + d) | 0); p++;
              outBuf[p] = Math.min(255, (acc[p] * inv + d) | 0); p++;
              outBuf[p] = Math.min(255, (acc[p] * inv + d) | 0); p++;
            }
          }
        }
        if (!ff.stdin.write(outBuf)) await new Promise(r => ff.stdin.once('drain', r));
        doneFrames++;
      }
      ff.stdin.end();
      await ffDone;
      const el = (Date.now() - started) / 1000;
      console.log(`  chunk ${ci + 1}/${chunks.length} (w${k})  frames ${doneFrames}/${N}  samples ${doneSamples}/${total}  ${el.toFixed(0)}s  ~${(el / doneSamples * (total - doneSamples)).toFixed(0)}s left`);
    }
    await browser.close();
  }
  await Promise.all(Array.from({ length: WORKERS }, (_, k) => worker(k)));
}
server.close();

// ── encode: concat lossless chunks → BT.709 4:2:0 → master + web H.264, AAC soundtrack ──
const segs = fs.readdirSync(SEGDIR).filter(f => f.startsWith(NAME + '_') && f.endsWith('.mkv')).sort().map(f => path.join(SEGDIR, f));
const list = path.join(SEGDIR, `${NAME}.txt`);
fs.writeFileSync(list, segs.map(s => `file '${s.replace(/\\/g, '/')}'`).join('\n'));
const grain = Number(opt('--grain', 2));
// timestamps are rebuilt from the frame index: Matroska's 1 ms clock drifts across many variable-length chunks
const vf = `setpts=N/(${FPS}*TB),scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd,format=yuv420p${grain ? `,noise=c0s=${grain}:c0f=t` : ''}`;
function encode(file, x264) {
  const args = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list];
  if (AUDIO) args.push('-ss', String(T0), '-t', String(T1 - T0), '-i', WAV);
  args.push('-vf', vf, '-r', String(FPS), '-c:v', 'libx264', ...x264, '-profile:v', 'high', '-g', String(FPS * 2),
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart');
  if (AUDIO) args.push('-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-shortest');
  args.push(path.join(OUT, file));
  execFileSync('ffmpeg', args, { stdio: 'inherit' });
  const mb = fs.statSync(path.join(OUT, file)).size / 1e6;
  console.log(`  ${file}  ${mb.toFixed(1)} MB`);
}
if (PREVIEW) encode(`${NAME}.mp4`, ['-preset', 'veryfast', '-crf', '22']);
else {
  encode(`${NAME}.mp4`, ['-preset', 'slow', '-crf', opt('--crf', '17'), '-tune', 'film', '-x264-params', 'aq-mode=3:aq-strength=0.8']);
  encode(`${NAME}-web.mp4`, ['-preset', 'slow', '-crf', opt('--web-crf', '21'), '-maxrate', '12M', '-bufsize', '24M', '-tune', 'film', '-x264-params', 'aq-mode=3:aq-strength=0.8']);
}
console.log(`done in ${((Date.now() - started) / 1000).toFixed(0)}s`);
