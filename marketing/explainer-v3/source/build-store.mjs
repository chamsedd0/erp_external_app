// Store listing images → ../store-assets/
//   node source/build-store.mjs            all sets
//   node source/build-store.mjs --only android   (ios-6.9 | ios-6.3 | android | feature | icons)
// App Store screenshots: PNG without alpha. Google Play: 24-bit PNG (no alpha), 9:16, ≥ 1080 px. Sizes verified against
// Apple's "Screenshot specifications" and Google's "Add preview assets" pages on 2026-10-06 (see ../store-assets/README.md).
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';
import { CHROME } from './chrome.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(ROOT, '..', 'store-assets');
const only = (() => { const i = process.argv.indexOf('--only'); return i < 0 ? null : process.argv[i + 1]; })();
const SHOTS = ['hero', 'versions', 'apps', 'request', 'status'];
const SETS = [
  { id: 'ios-6.9', dir: 'ios/iphone-6.9-inch-1320x2868', w: 1320, h: 2868 },
  { id: 'ios-6.3', dir: 'ios/iphone-6.3-inch-1206x2622', w: 1206, h: 2622 },
  { id: 'android', dir: 'android/phone-1080x1920', w: 1080, h: 1920 },
];
// drop real screenshots here as <shot>.png|jpg (hero, versions, apps, request, status) and re-run: they replace the reconstructions
const CAPDIR = path.join(OUT, 'captures');
const capFor = s => ['png', 'jpg', 'jpeg'].map(e => path.join(CAPDIR, `${s}.${e}`)).find(f => fs.existsSync(f)) || null;
const server = await startServer(0);
const base = `http://127.0.0.1:${server.address().port}/source/store-shots.html`;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--force-color-profile=srgb', '--hide-scrollbars', '--disable-lcd-text'] });
async function shoot(url, w, h, file, capture = null) {
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('[console]', m.text()); });
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page.goto(url); await page.waitForFunction('window.__ready === true', { timeout: 60000 });
  let real = false;
  if (capture && fs.existsSync(capture)) {              // a real device screenshot replaces the reconstruction
    const ext = path.extname(capture).slice(1).toLowerCase().replace('jpg', 'jpeg');
    real = await page.evaluate(u => window.__useCapture(u), `data:image/${ext};base64,${fs.readFileSync(capture).toString('base64')}`);
  }
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: w, height: h } });
  await page.close();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await sharp(png).flatten({ background: '#080814' }).removeAlpha().png({ compressionLevel: 9 }).toFile(file);   // no alpha channel
  const m = await sharp(file).metadata();
  console.log(path.relative(OUT, file), `${m.width}x${m.height}`, m.hasAlpha ? 'ALPHA!' : 'no alpha', (fs.statSync(file).size / 1e6).toFixed(2) + ' MB', real ? '· REAL CAPTURE' : '· reconstruction');
}
for (const set of SETS) {
  if (only && only !== set.id) continue;
  for (const [i, s] of SHOTS.entries())
    await shoot(`${base}?shot=${s}&w=${set.w}&h=${set.h}`, set.w, set.h, path.join(OUT, set.dir, `${String(i + 1).padStart(2, '0')}-${s}.png`), capFor(s));
}
if (!only || only === 'feature') await shoot(`${base}?shot=feature&w=1024&h=500`, 1024, 500, path.join(OUT, 'android', 'feature-graphic-1024x500.png'));
if (!only || only === 'icons') {                       // icons from the app's own 1024 px icon
  const src = path.resolve(ROOT, '..', '..', 'production-version', 'assets', 'images', 'icon.png');
  const m = await sharp(src).metadata();
  fs.mkdirSync(path.join(OUT, 'icons'), { recursive: true });
  await sharp(src).resize(512, 512).png().toFile(path.join(OUT, 'icons', 'play-store-icon-512.png'));            // Play: 32-bit PNG, 512×512, ≤ 1024 KB
  await sharp(src).resize(1024, 1024).flatten({ background: '#0A0A1A' }).removeAlpha().png().toFile(path.join(OUT, 'icons', 'app-store-icon-1024-no-alpha.png'));
  console.log('icons from', path.relative(OUT, src), `${m.width}x${m.height}`, m.hasAlpha ? '(source has alpha)' : '(source has no alpha)');
}
await browser.close(); server.close();
