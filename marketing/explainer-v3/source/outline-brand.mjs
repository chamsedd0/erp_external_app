// "Shadow — by Octagon9" lockup (interim: typeset from the existing mark + wordmark until Octagon9 supplies an official file).
// Keeps the canonical arch mark and the "Shadow" wordmark outlines; replaces the old "PORTAL" line with the byline,
// set in DM Sans 500 and outlined so the SVG needs no installed font.
import opentype from 'opentype.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dm = opentype.loadSync(path.join(ROOT, 'assets/fonts/DMSans_500Medium.ttf'));
const old = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/logo/wordmark-paths.json'), 'utf8'));
function textPath(font, text, x, y, size, tracking = 0) {
  let d = '', cx = x; const scale = size / font.unitsPerEm, glyphs = font.stringToGlyphs(text);
  glyphs.forEach((g, i) => { d += g.getPath(cx, y, size).toPathData(2); cx += g.advanceWidth * scale + tracking;
    if (i < glyphs.length - 1) cx += font.getKerningValue(g, glyphs[i + 1]) * scale; });
  return { d, end: cx - tracking };
}
const SIZE = 68, BASE = 366, X = 433, TRACK = 1.2;
const by = textPath(dm, 'by', X, BASE, SIZE, TRACK);
const oct = textPath(dm, 'Octagon9', by.end + SIZE * 0.3, BASE, SIZE, TRACK);
const paths = { shadow: old.shadow, by: by.d, octagon9: oct.d, bylineEnd: oct.end, baseline: BASE };
fs.writeFileSync(path.join(ROOT, 'assets/logo/wordmark-v3.json'), JSON.stringify(paths));
const src = fs.readFileSync(path.join(ROOT, 'assets/logo/shadow-portal-logo-outlined.svg'), 'utf8');
const out = src
  .replace(/<path id="wm-portal"[^>]*\/>/s, `<path id="wm-by" fill="#94A3B8" d="${by.d}"/>\n  <path id="wm-octagon9" fill="#4F8EF7" d="${oct.d}"/>`)
  .replace(/<!-- Wordmark: "PORTAL"[^>]*-->/, '<!-- Byline: "by Octagon9" (outlined from DM Sans 500, 68px) — interim lockup -->');
fs.writeFileSync(path.join(ROOT, 'assets/logo/shadow-by-octagon9-logo.svg'), out);
console.log('byline ends at x =', oct.end.toFixed(1), '| <text> left:', (out.match(/<text/g) || []).length, '| has portal:', /wm-portal/.test(out));
