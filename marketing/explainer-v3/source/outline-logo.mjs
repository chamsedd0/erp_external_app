// Outlined export copy of shadow-portal-logo.svg: the wordmark text becomes vector paths so the lockup
// renders identically without Arial Black / Arial installed. Metrics copied from the source SVG.
import opentype from 'opentype.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const black = opentype.loadSync('C:/Windows/Fonts/ariblk.ttf');
const regular = opentype.loadSync('C:/Windows/Fonts/arial.ttf');
function textPath(font, text, x, y, size, tracking) {
  let d = '', cx = x;
  const scale = size / font.unitsPerEm;
  const glyphs = font.stringToGlyphs(text);
  glyphs.forEach((g, i) => {
    d += g.getPath(cx, y, size).toPathData(2);
    cx += g.advanceWidth * scale + tracking;
    if (i < glyphs.length - 1) cx += font.getKerningValue(g, glyphs[i + 1]) * scale;
  });
  return d;
}
const shadow = textPath(black, 'Shadow', 428, 262, 132, -2);
const portal = textPath(regular, 'PORTAL', 428, 380, 90, 22);
const src = fs.readFileSync(path.join(ROOT, 'assets/logo/shadow-portal-logo.svg'), 'utf8');
const out = src
  .replace(/<text[^>]*>Shadow<\/text>/s, `<path id="wm-shadow" fill="#FFFFFF" d="${shadow}"/>`)
  .replace(/<text[^>]*>PORTAL<\/text>/s, `<path id="wm-portal" fill="#4F8EF7" d="${portal}"/>`)
  .replace(/<!-- Wordmark: "Shadow" -->/, '<!-- Wordmark: "Shadow" (outlined from Arial Black 132px, tracking -2) -->')
  .replace(/<!-- Wordmark: "Portal" in blue -->/, '<!-- Wordmark: "PORTAL" (outlined from Arial 90px, tracking 22) -->');
fs.writeFileSync(path.join(ROOT, 'assets/logo/shadow-portal-logo-outlined.svg'), out);
fs.writeFileSync(path.join(ROOT, 'assets/logo/wordmark-paths.json'), JSON.stringify({ shadow, portal }));
console.log('outlined:', out.length, 'bytes; <text> left:', (out.match(/<text/g) || []).length);
