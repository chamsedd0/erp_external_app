// Render app screens to high-resolution PNG textures for the 3D device screen.
//   node source/build-screens.mjs          → assets/screens/<name>@5x.png
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME || 'C:/Users/chams/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const SCALE = 5;
const server = await startServer(0);
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--force-color-profile=srgb', '--disable-lcd-text'] });
for (const name of (process.argv[2] || 'dashboard').split(',')) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: SCALE });
  await page.goto(`http://127.0.0.1:${server.address().port}/source/screens.html?screen=${name}`);
  await page.waitForFunction('window.__ready === true');
  const out = path.join(ROOT, 'assets', 'screens', `${name}@${SCALE}x.png`);
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 390, height: 844 } });
  console.log('wrote', path.relative(ROOT, out));
  await page.close();
}
await browser.close();
server.close();
