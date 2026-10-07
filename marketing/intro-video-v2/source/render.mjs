// Frame-accurate renderer for the v2 film, with real motion blur and accumulation depth of field.
// (Pipeline adapted from ../intro-video/render.mjs, which stays intact.)
//
// Headless Chromium seeks the composition to sub-frame times (window.__seek(frame, j, n)); the composition says how
// many samples each frame needs (window.__samples(frame): 1 on holds, up to 20 in the lens-blurred macro). Samples are
// averaged in 32-bit with dithered rounding (120° shutter by default), written as lossless segments, concatenated with
// frame-index timestamps, converted to BT.709 limited range with error-diffusion dithering (no added grain), and muxed
// with the WAV mix. Every export is decode-verified (frame count, duration, streams).
//
//   node source/render.mjs                         → out/shadow-portal-launch-v2-16x9.mp4 (+ lossless intermediate)
//   node source/render.mjs --format vertical       → out/shadow-portal-launch-v2-9x16.mp4
//   node source/render.mjs --animatic              → review/animatic/…-animatic-<fmt>.mp4 (1 sample/frame, fast)
//   node source/render.mjs --stills 150,420 --out out/posters   → fully accumulated PNG stills
//   options: --shutter 120  --workers 6  --from 0 --to 1200 (frames)  --no-audio  --encode-only  --crf 16
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME || 'C:/Users/chams/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const argv = process.argv.slice(2);
const has = k => argv.includes(k);
const opt = (k, d) => { const i = argv.indexOf(k); return i < 0 ? d : argv[i + 1]; };
const VERT = opt('--format', 'landscape') === 'vertical';
const FMT = VERT ? '9x16' : '16x9';
const ANIMATIC = has('--animatic'), ENCODE_ONLY = has('--encode-only'), FLATDEV = has('--flatdevice'), PROOF = has('--proof');
const STILLS = opt('--stills', null);
const SHUTTER = Number(opt('--shutter', 120));
const WORKERS = Number(opt('--workers', 6));
const VW = VERT ? 1080 : 1920, VH = VERT ? 1920 : 1080;
const NAME = opt('--name', ANIMATIC ? `shadow-portal-launch-v2-animatic-${FMT}` : `shadow-portal-launch-v2-${FMT}`);
const DRAFT = ANIMATIC || PROOF;           // review renders: no lossless intermediate, no QA json
const OUTDIR = path.resolve(ROOT, opt('--outdir', ANIMATIC ? 'review/animatic' : PROOF ? 'review/device-proof' : 'out'));
const SEGDIR = path.join(ROOT, 'out', 'segments', DRAFT ? NAME : FMT);
const WAV = path.join(ROOT, 'out', 'audio', `shadow-portal-launch-v2-mix-${FMT}.wav`);
const AUDIO = !has('--no-audio') && fs.existsSync(WAV);
fs.mkdirSync(SEGDIR, { recursive: true }); fs.mkdirSync(OUTDIR, { recursive: true });

const server = await startServer(0);
const url = `http://127.0.0.1:${server.address().port}/source/index.html?render${VERT ? '&format=vertical' : ''}${FLATDEV ? '&flatdevice' : ''}`;
// GPU raster + WebGL on the discrete GPU (≈2× faster captures)
const LAUNCH = { executablePath: CHROME, headless: true, args: ['--no-sandbox', '--hide-scrollbars', '--force-color-profile=srgb', '--disable-lcd-text',
  '--use-angle=d3d11', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--force_high_performance_gpu'] };
async function openPage(browser) {
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('[console]', m.text()); });
  await page.setViewport({ width: VW, height: VH, deviceScaleFactor: 1 });
  await page.goto(url); await page.waitForFunction('window.__ready === true', { timeout: 90000 });
  return page;
}

// probe: frame count and per-frame sample density
const probe = await puppeteer.launch(LAUNCH);
const pp = await openPage(probe);
const NFR = await pp.evaluate(() => window.__frames);
const F0 = Number(opt('--from', 0)), F1 = Number(opt('--to', NFR));
const FPS = await pp.evaluate(() => window.__fps);
const SAMPLES = await pp.evaluate((a, b, one) => Array.from({ length: b - a }, (_, i) => one ? 1 : window.__samples(a + i)), F0, F1, ANIMATIC);
await probe.close();
const subTimes = f => {                 // sample centres across the open shutter, centred on the frame
  const n = SAMPLES[f - F0];
  return Array.from({ length: n }, (_, j) => Math.min(NFR - 1e-4, Math.max(0, f + (n > 1 ? ((j + 0.5) / n - 0.5) * (SHUTTER / 360) : 0))));
};
const DITHER = new Float32Array(256 * 256);
{ let s = 12345; for (let i = 0; i < DITHER.length; i++) { s = (s * 1103515245 + 12345) >>> 0; DITHER[i] = (s >>> 8) / 16777216; } }
const PX = VW * VH * 3;
async function accumulate(page, f, acc, out) {
  const times = subTimes(f), n = times.length;
  acc.fill(0);
  for (let j = 0; j < n; j++) {
    await page.evaluate((v, jj, nn) => window.__seek(v, jj, nn), times[j], j, n);
    const shot = await page.screenshot({ type: 'png', optimizeForSpeed: true });
    const data = await sharp(shot).removeAlpha().raw().toBuffer();
    for (let p = 0; p < PX; p++) acc[p] += data[p];
  }
  if (n === 1) { for (let p = 0; p < PX; p++) out[p] = acc[p]; return n; }
  const inv = 1 / n, ox = (f * 71) & 255, oy = (f * 37) & 255;
  for (let y = 0, p = 0; y < VH; y++) {
    const row = ((y + oy) & 255) << 8;
    for (let x = 0; x < VW; x++) {
      const d = DITHER[row | ((x + ox) & 255)];
      out[p] = Math.min(255, (acc[p] * inv + d) | 0); p++;
      out[p] = Math.min(255, (acc[p] * inv + d) | 0); p++;
      out[p] = Math.min(255, (acc[p] * inv + d) | 0); p++;
    }
  }
  return n;
}

// ── stills mode: fully accumulated PNGs (posters, review) ────────────────
if (STILLS) {
  const dir = path.resolve(ROOT, opt('--out', 'out/posters')); fs.mkdirSync(dir, { recursive: true });
  const browser = await puppeteer.launch(LAUNCH); const page = await openPage(browser);
  const acc = new Uint32Array(PX), out = Buffer.alloc(PX);
  for (const f of STILLS.split(',').map(Number)) {
    const n = await accumulate(page, f, acc, out);
    const file = path.join(dir, `${opt('--prefix', 'still')}-${FMT}-f${String(f).padStart(4, '0')}.png`);
    await sharp(out, { raw: { width: VW, height: VH, channels: 3 } }).png().toFile(file);
    console.log(path.relative(ROOT, file), `(${n} samples)`);
  }
  await browser.close(); server.close(); process.exit(0);
}

const segName = ci => path.join(SEGDIR, `seg_${String(ci).padStart(3, '0')}.mkv`);
const started = Date.now();
if (!ENCODE_ONLY) {
  for (const f of fs.readdirSync(SEGDIR)) if (f.startsWith('seg_')) fs.unlinkSync(path.join(SEGDIR, f));
  const N = F1 - F0, total = SAMPLES.reduce((a, b) => a + b, 0);
  console.log(`render ${NAME}: frames ${F0}–${F1 - 1} (${N}) @${FPS} fps, ${total} samples (${Math.min(...SAMPLES)}–${Math.max(...SAMPLES)}/frame), shutter ${SHUTTER}°, ${WORKERS} workers`);
  const chunks = [];                     // sample-balanced chunks so heavy moments spread across workers
  for (let a = F0, f = F0, sum = 0; f < F1; f++) {
    sum += SAMPLES[f - F0];
    if (sum >= 240 || f - a + 1 >= 40 || f === F1 - 1) { chunks.push([a, f + 1]); a = f + 1; sum = 0; }
  }
  let next = 0, doneSamples = 0, doneFrames = 0;
  async function worker(k) {
    const browser = await puppeteer.launch(LAUNCH); const page = await openPage(browser);
    const acc = new Uint32Array(PX), outBuf = Buffer.alloc(PX);
    for (let ci = next++; ci < chunks.length; ci = next++) {
      const [a, b] = chunks[ci];
      const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${VW}x${VH}`, '-framerate', String(FPS), '-i', '-',
        '-c:v', 'libx264rgb', '-crf', '0', '-preset', 'ultrafast', segName(ci)], { stdio: ['pipe', 'inherit', 'inherit'] });
      const ffDone = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exit ' + c))));
      for (let f = a; f < b; f++) {
        const ns_ = await accumulate(page, f, acc, outBuf); doneSamples += ns_;
        if (!ff.stdin.write(outBuf)) await new Promise(r => ff.stdin.once('drain', r));
        doneFrames++;
      }
      ff.stdin.end(); await ffDone;
      const el = (Date.now() - started) / 1000;
      console.log(`  chunk ${ci + 1}/${chunks.length} (w${k}) frames ${doneFrames}/${N} samples ${doneSamples}/${total} ${el.toFixed(0)}s ~${(el / doneSamples * (total - doneSamples)).toFixed(0)}s left`);
    }
    await browser.close();
  }
  await Promise.all(Array.from({ length: WORKERS }, (_, k) => worker(k)));
}
server.close();

// ── encode ────────────────────────────────────────────────────────────────
const segs = fs.readdirSync(SEGDIR).filter(f => f.startsWith('seg_') && f.endsWith('.mkv')).sort().map(f => path.join(SEGDIR, f));
const list = path.join(SEGDIR, 'list.txt');
fs.writeFileSync(list, segs.map(s => `file '${s.replace(/\\/g, '/')}'`).join('\n'));
// frame-index timestamps (Matroska's 1 ms clock drifts across variable-length chunks and once cost a frame)
const PTS = `setpts=N/(${FPS}*TB)`;
const run = args => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
if (!DRAFT) {                           // lossless RGB intermediate of the whole film
  const lossless = path.join(ROOT, 'out', 'intermediate', `${NAME}-lossless-rgb.mkv`); fs.mkdirSync(path.dirname(lossless), { recursive: true });
  run(['-f', 'concat', '-safe', '0', '-i', list, '-vf', PTS, '-r', String(FPS), '-c:v', 'libx264rgb', '-crf', '0', '-preset', 'veryfast', lossless]);
  console.log('  intermediate', path.relative(ROOT, lossless), (fs.statSync(lossless).size / 1e6).toFixed(0), 'MB');
}
// RGB → BT.709 limited-range 4:2:0 with error-diffusion dither (no grain); tags written explicitly
const vf = `${PTS},zscale=matrixin=input:matrix=709:transferin=709:transfer=709:primariesin=709:primaries=709:rangein=full:range=limited:dither=error_diffusion,format=yuv420p`;
const file = path.join(OUTDIR, `${NAME}.mp4`);
const x264 = ANIMATIC ? ['-preset', 'veryfast', '-crf', '20']
  : ['-preset', 'slow', '-crf', opt('--crf', '16'), '-maxrate', '24M', '-bufsize', '48M', '-tune', 'film', '-x264-params', 'aq-mode=3:aq-strength=0.8'];
const args = ['-f', 'concat', '-safe', '0', '-i', list];
if (AUDIO) args.push('-i', WAV);
args.push('-vf', vf, '-r', String(FPS), '-c:v', 'libx264', ...x264, '-profile:v', 'high', '-level:v', '4.2', '-g', String(FPS), '-pix_fmt', 'yuv420p',
  '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv', '-movflags', '+faststart');
if (AUDIO) args.push('-map', '0:v:0', '-map', '1:a:0', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2', '-t', String((F1 - F0) / FPS));
args.push(file);
run(args);

// ── decode-verify ────────────────────────────────────────────────────────
const probeJson = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-show_entries',
  'stream=codec_type,codec_name,profile,width,height,pix_fmt,r_frame_rate,avg_frame_rate,nb_read_frames,color_range,color_space,color_transfer,color_primaries,sample_rate,channels,duration:format=duration,size,bit_rate',
  '-of', 'json', file]).toString());
const v = probeJson.streams.find(s => s.codec_type === 'video'), a = probeJson.streams.find(s => s.codec_type === 'audio');
const report = { file: path.relative(ROOT, file), video: v, audio: a || null, format: probeJson.format,
  checks: { frames_expected: F1 - F0, frames_decoded: Number(v.nb_read_frames), frames_ok: Number(v.nb_read_frames) === F1 - F0,
    size_ok: v.width === VW && v.height === VH, bt709: v.color_space === 'bt709' && v.color_transfer === 'bt709' && v.color_primaries === 'bt709', range: v.color_range } };
if (!DRAFT) {
  const qa = path.join(ROOT, 'review', 'qa'); fs.mkdirSync(qa, { recursive: true });
  fs.writeFileSync(path.join(qa, `encode-${FMT}.json`), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report.checks), `${(Number(probeJson.format.size) / 1e6).toFixed(1)} MB`, path.relative(ROOT, file));
console.log(`done in ${((Date.now() - started) / 1000).toFixed(0)}s`);
