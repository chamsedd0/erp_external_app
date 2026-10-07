import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = 'C:/Users/chams/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const server = await startServer(0);
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--force-color-profile=srgb', '--use-angle=d3d11', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--force_high_performance_gpu'] });
const page = await browser.newPage();
page.on('pageerror', e => console.log('[pageerror]', e.message));
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.text()); });
const [W, H] = (process.argv[3] || '1920x1080').split('x').map(Number);
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
await page.goto(`http://127.0.0.1:${server.address().port}/source/device-test.html?w=${W}&h=${H}`);
await page.waitForFunction('window.__ready === true', { timeout: 30000 });
const poses = JSON.parse(process.argv[2]);
let i = 0;
for (const s of poses) {
  await page.evaluate(v => window.__show(v), s);
  const f = path.join(ROOT, 'review', 'wip', `dev${i++}.png`);
  await page.screenshot({ path: f });
  console.log(path.relative(ROOT, f));
}
await browser.close(); server.close();
