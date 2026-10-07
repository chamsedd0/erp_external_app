// Locate a Chromium to render with: $CHROME, else the newest Playwright Chromium on this machine, else Edge / Chrome.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
function find() {
  if (process.env.CHROME && fs.existsSync(process.env.CHROME)) return process.env.CHROME;
  const pw = path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright');
  if (fs.existsSync(pw)) {
    const builds = fs.readdirSync(pw).filter(d => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const b of builds) { const exe = path.join(pw, b, 'chrome-win64', 'chrome.exe'); if (fs.existsSync(exe)) return exe; }
  }
  for (const exe of ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe']) if (fs.existsSync(exe)) return exe;
  throw new Error('No Chromium found. Set the CHROME environment variable to a Chrome/Edge/Chromium executable.');
}
export const CHROME = find();
