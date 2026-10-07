// Review sheets at delivery-preview size: 16:9 frames at 640×360 and 9:16 frames at 360×640 (1:1 pixels, no upscaling),
// the portrait ones with the working critical-content box (x 96–900, y 240–1500 at 1080×1920) drawn over them.
//   node source/review-sheets.mjs <dir> <prefix> <frames…>
import sharp from 'sharp';
import path from 'node:path';
const [dir, prefix, ...frames] = process.argv.slice(2);
const lab = (w, t) => Buffer.from(`<svg width="${w}" height="26"><text x="4" y="19" font-family="Segoe UI, Arial" font-size="15" fill="#c9d2ea">${t}</text></svg>`);
for (const fmt of ['16x9', '9x16']) {
  const [tw, th, cols] = fmt === '16x9' ? [640, 360, 3] : [360, 640, 6];
  const pad = 10, rows = Math.ceil(frames.length / cols), W = cols * (tw + pad) + pad, H = rows * (th + 26 + pad) + pad;
  const comps = [];
  for (const [i, f] of frames.entries()) {
    const x = pad + (i % cols) * (tw + pad), y = pad + Math.floor(i / cols) * (th + 26 + pad);
    let img = sharp(path.join(dir, `${prefix}-${fmt}-f${String(f).padStart(4, '0')}.png`)).resize(tw, th, { kernel: 'lanczos3' });
    if (fmt === '9x16') {
      const k = tw / 1080, box = `<svg width="${tw}" height="${th}"><rect x="${96 * k}" y="${240 * k}" width="${804 * k}" height="${1260 * k}" fill="none" stroke="#ff2bd6" stroke-width="1.5" stroke-dasharray="5 4"/></svg>`;
      img = sharp(await img.png().toBuffer()).composite([{ input: Buffer.from(box) }]);
    }
    comps.push({ input: await img.png().toBuffer(), left: x, top: y + 26 }, { input: lab(tw, `f${f} · ${(f / 60).toFixed(2)} s · ${fmt} at ${tw}×${th}`), left: x, top: y });
  }
  const out = path.join(dir, `sheet-${prefix}-${fmt}-preview-size.png`);
  await sharp({ create: { width: W, height: H, channels: 3, background: '#20222c' } }).composite(comps).png().toFile(out);
  console.log(out);
}
