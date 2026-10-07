// Render individual frames + a contact sheet for review.
//   node stills.mjs 0.5 1.2 4.0            → out/stills/t0.50.png … + out/stills/sheet.png
//   node stills.mjs --range 0 19 0.5       → every 0.5 s
//   options: --cols 4  --w 480  --name sheet  --full (also keep full-size PNGs, default on)
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME || 'C:/Users/chams/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); if (i < 0) return d; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const VERT = opt('--format', 'landscape') === 'vertical';
const cols = Number(opt('--cols', VERT ? 6 : 4)), tw = Number(opt('--w', VERT ? 300 : 480)), name = opt('--name', 'sheet');
let times = [];
const ri = argv.indexOf('--range');
if (ri >= 0) { const [a, b, s] = argv.slice(ri + 1, ri + 4).map(Number); for (let t = a; t <= b + 1e-9; t += s) times.push(+t.toFixed(4)); argv.splice(ri, 4); }
times.push(...argv.map(Number).filter(n => !Number.isNaN(n)));

const outDir = path.join(ROOT, 'out', 'stills');
fs.mkdirSync(outDir, { recursive: true });
const server = await startServer(0);
const port = server.address().port;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--hide-scrollbars', '--force-color-profile=srgb', '--disable-lcd-text', '--use-angle=d3d11', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--force_high_performance_gpu'] });
const page = await browser.newPage();
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warn') console.log('[page]', m.text()); });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.setViewport({ width: VERT ? 1080 : 1920, height: VERT ? 1920 : 1080, deviceScaleFactor: 1 });
await page.goto(`http://127.0.0.1:${port}/index.html?render&debug${VERT ? '&format=vertical' : ''}`, { waitUntil: 'load' });
await page.waitForFunction('window.__ready === true', { timeout: 30000 });
const files = [];
for (const t of times) {
  await page.evaluate(v => window.__seek(v), t);
  const file = path.join(outDir, `${VERT ? 'v' : 't'}${t.toFixed(2)}.png`);
  await page.screenshot({ path: file, type: 'png' });
  files.push(file);
}
await browser.close();
server.close();
if (files.length > 1) {
  // contact sheet via ffmpeg (concat list → scale → tile)
  const list = path.join(outDir, 'list.txt');
  fs.writeFileSync(list, files.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n'));
  const rows = Math.ceil(files.length / cols);
  const sheet = path.join(outDir, `${name}.png`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', `scale=${tw}:-1:flags=lanczos,tile=${cols}x${rows}:padding=4:color=0x333333`, '-frames:v', '1', sheet]);
  console.log('sheet:', sheet);
}
console.log(files.map(f => path.basename(f)).join(' '));
