// Single-sample stills from the film (style frames, review frames, posters).
//   node source/stills.mjs [--fmt landscape|vertical|both] [--out review/style-frames] [--sheet name] [--scale 1] <frames…>
// Frames may be fractional. Files: <out>/<fmt>-f<frame>.png, plus an optional contact sheet <out>/<sheet>-<fmt>.png.
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';
import { CHROME } from './chrome.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const fmtArg = opt('--fmt', 'both'), outDir = path.resolve(ROOT, opt('--out', 'review/style-frames')), sheet = opt('--sheet', null);
const frames = args.map(Number).filter(n => Number.isFinite(n));
if (!frames.length) { console.error('no frames given'); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });

const server = await startServer(0);
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ['--no-sandbox', '--force-color-profile=srgb', '--hide-scrollbars', '--use-angle=d3d11', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--force_high_performance_gpu'],
});
const fmts = fmtArg === 'both' ? ['landscape', 'vertical'] : [fmtArg];
for (const fmt of fmts) {
  const [W, H] = fmt === 'vertical' ? [1080, 1920] : [1920, 1080];
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) console.log('[console]', m.text()); });
  page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('favicon.ico')) console.log('[http]', r.status(), r.url()); });
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${server.address().port}/source/index.html?render${fmt === 'vertical' ? '&format=vertical' : ''}`);
  await page.waitForFunction('window.__ready === true', { timeout: 60000 });
  const files = [];
  for (const f of frames) {
    await page.evaluate(v => window.__seek(v), f);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const file = path.join(outDir, `${fmt}-f${String(f).padStart(4, '0')}.png`);
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width: W, height: H } });
    files.push({ f, file });
    console.log(path.relative(ROOT, file));
  }
  await page.close();
  if (sheet) {                               // contact sheet: thumbnails with frame/time labels
    const cols = fmt === 'vertical' ? Math.min(files.length, 6) : Math.min(files.length, 3);
    const tw = fmt === 'vertical' ? 300 : 620, th = Math.round(tw * H / W), pad = 12, lab = 30;
    const rows = Math.ceil(files.length / cols), SW = cols * (tw + pad) + pad, SH = rows * (th + lab + pad) + pad;
    const comps = [];
    for (const [i, { f, file }] of files.entries()) {
      const x = pad + (i % cols) * (tw + pad), y = pad + Math.floor(i / cols) * (th + lab + pad);
      comps.push({ input: await sharp(file).resize(tw, th).png().toBuffer(), left: x, top: y + lab });
      comps.push({ input: Buffer.from(`<svg width="${tw}" height="${lab}"><text x="2" y="21" font-family="Segoe UI, Arial" font-size="17" fill="#c9d2ea">f${f} · ${(f / 60).toFixed(2)} s</text></svg>`), left: x, top: y });
    }
    const out = path.join(outDir, `${sheet}-${fmt}.png`);
    await sharp({ create: { width: SW, height: SH, channels: 3, background: '#20222c' } }).composite(comps).png().toFile(out);
    console.log('sheet', path.relative(ROOT, out));
  }
}
await browser.close(); server.close();
