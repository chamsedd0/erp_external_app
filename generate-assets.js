const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');

const OUT = 'production-version/assets/images';

// ── SVG helpers ──────────────────────────────────────────────────────────────

// The portal arch icon mark (scalable, accepts offset & scale)
// Arch: pillars from bottom up to the arc, arc is a semicircle over the top.
// Canvas coords assume 1024x1024 design space.
function portalMark(opts = {}) {
    const {
        cx = 512,          // horizontal center
        cy = 490,          // vertical center of the arch midpoint
        r  = 228,          // radius of the semicircle
        strokeW = 46,      // main stroke width
        pillarH = 270,     // how far the vertical pillars extend below the arc join
        lineW = 32,        // base threshold line width
        lineOverhang = 40, // how much the base line sticks out past each pillar
    } = opts;

    const leftX  = cx - r;
    const rightX = cx + r;
    const arcY   = cy;          // y where the arc meets the pillars
    const topY   = cy - r;     // apex of the arch
    const botY   = cy + pillarH; // bottom of pillars

    // Arch path: left pillar up → semicircle over → right pillar down
    const archPath = `M ${leftX} ${botY} L ${leftX} ${arcY} A ${r} ${r} 0 0 1 ${rightX} ${arcY} L ${rightX} ${botY}`;
    // Base threshold line
    const lineX1 = leftX - lineOverhang;
    const lineX2 = rightX + lineOverhang;

    // Apex dot position
    const apexX = cx;
    const apexY = topY;

    return { archPath, lineX1, lineX2, botY, apexX, apexY, strokeW, lineW };
}

// ── ICON SVG (1024×1024, solid dark background) ───────────────────────────────
function buildIconSVG() {
    const size = 1024;
    const m = portalMark();

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    <!-- Dark navy background gradient -->
    <linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0%" stop-color="#131328"/>
      <stop offset="100%" stop-color="#080814"/>
    </linearGradient>

    <!-- Blue arch stroke gradient (bottom to top = dark to light) -->
    <linearGradient id="archGrad" x1="0" y1="1" x2="0" y2="0" gradientUnits="objectBoundingBox">
      <stop offset="0%" stop-color="#2A5FD4"/>
      <stop offset="55%" stop-color="#4F8EF7"/>
      <stop offset="100%" stop-color="#89BFFF"/>
    </linearGradient>

    <!-- Radial backdrop glow behind the portal -->
    <radialGradient id="backdropGlow" cx="50%" cy="44%" r="38%">
      <stop offset="0%" stop-color="#3A72E8" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#3A72E8" stop-opacity="0"/>
    </radialGradient>

    <!-- Outer glow filter for the arch -->
    <filter id="archGlow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="18" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <!-- Soft glow for the apex dot -->
    <filter id="dotGlow" x="-200%" y="-200%" width="500%" height="500%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- ── Background ── -->
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  <rect width="${size}" height="${size}" fill="url(#backdropGlow)"/>

  <!-- ── Arch outer glow (wide, faint) ── -->
  <path d="${m.archPath}"
        fill="none"
        stroke="#4F8EF7"
        stroke-width="${m.strokeW + 52}"
        stroke-linecap="round"
        opacity="0.12"
        filter="url(#archGlow)"/>

  <!-- ── Base threshold line glow ── -->
  <line x1="${m.lineX1}" y1="${m.botY}" x2="${m.lineX2}" y2="${m.botY}"
        stroke="#4F8EF7" stroke-width="${m.lineW + 24}" stroke-linecap="round"
        opacity="0.12"/>

  <!-- ── Arch main stroke ── -->
  <path d="${m.archPath}"
        fill="none"
        stroke="url(#archGrad)"
        stroke-width="${m.strokeW}"
        stroke-linecap="round"/>

  <!-- ── Base threshold line (solid: bbox gradients degenerate on h-lines) ── -->
  <line x1="${m.lineX1}" y1="${m.botY}" x2="${m.lineX2}" y2="${m.botY}"
        stroke="#3B74E0"
        stroke-width="${m.lineW}"
        stroke-linecap="round"
        opacity="0.85"/>

  <!-- ── Apex glow halo ── -->
  <circle cx="${m.apexX}" cy="${m.apexY}" r="52" fill="#89BFFF" opacity="0.25" filter="url(#dotGlow)"/>

  <!-- ── Apex bright dot ── -->
  <circle cx="${m.apexX}" cy="${m.apexY}" r="20" fill="#FFFFFF" opacity="0.95" filter="url(#dotGlow)"/>
</svg>`;
}

// ── ADAPTIVE ICON FOREGROUND SVG (1024×1024, transparent background) ─────────
// The mark must fit within the "safe zone" = inner 66% = roughly 340px inset on each side
// So the mark goes from ~340 to ~684 in each axis (344×344 working area)
function buildFgSVG() {
    const size = 1024;
    // Scale the mark to fit safe zone (66% of 1024 = 675px square, centered)
    const m = portalMark({
        cx: 512,
        cy: 475,
        r: 168,
        strokeW: 36,
        pillarH: 200,
        lineW: 24,
        lineOverhang: 30,
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    <linearGradient id="archGradFg" x1="0" y1="1" x2="0" y2="0" gradientUnits="objectBoundingBox">
      <stop offset="0%" stop-color="#2A5FD4"/>
      <stop offset="55%" stop-color="#4F8EF7"/>
      <stop offset="100%" stop-color="#89BFFF"/>
    </linearGradient>
    <filter id="dotGlowFg" x="-200%" y="-200%" width="500%" height="500%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- transparent background — no rect -->

  <!-- Arch -->
  <path d="${m.archPath}"
        fill="none"
        stroke="url(#archGradFg)"
        stroke-width="${m.strokeW}"
        stroke-linecap="round"/>

  <!-- Base line (solid: bbox gradients degenerate on h-lines) -->
  <line x1="${m.lineX1}" y1="${m.botY}" x2="${m.lineX2}" y2="${m.botY}"
        stroke="#3B74E0"
        stroke-width="${m.lineW}"
        stroke-linecap="round"
        opacity="0.85"/>

  <!-- Apex dot -->
  <circle cx="${m.apexX}" cy="${m.apexY}" r="14" fill="#FFFFFF" opacity="0.95" filter="url(#dotGlowFg)"/>
</svg>`;
}

// ── MONOCHROME / NOTIFICATION SVG (white-only mark, transparent bg) ──────────
// Android tints these itself: only the alpha channel matters, so the mark must
// be solid white with no gradients or glows.
function buildWhiteMarkSVG(markOpts) {
    const size = 1024;
    const m = portalMark(markOpts);

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <path d="${m.archPath}" fill="none" stroke="#FFFFFF" stroke-width="${m.strokeW}" stroke-linecap="round"/>
  <line x1="${m.lineX1}" y1="${m.botY}" x2="${m.lineX2}" y2="${m.botY}"
        stroke="#FFFFFF" stroke-width="${m.lineW}" stroke-linecap="round"/>
  <circle cx="${m.apexX}" cy="${m.apexY}" r="20" fill="#FFFFFF"/>
</svg>`;
}

// Monochrome adaptive icon: same safe-zone framing as the color foreground
const MONO_MARK = { cx: 512, cy: 475, r: 168, strokeW: 36, pillarH: 200, lineW: 24, lineOverhang: 30 };
// Notification small icon: bolder strokes so it survives 24dp status-bar sizes
const NOTIF_MARK = { cx: 512, cy: 470, r: 230, strokeW: 84, pillarH: 250, lineW: 64, lineOverhang: 40 };

// ── LOGO SVG (wordmark + icon mark, wide format, for marketing) ──────────────
function buildLogoSVG() {
    // Wide banner: 1600×480
    const W = 1600;
    const H = 480;

    // Icon mark on the left, centered vertically
    const m = portalMark({
        cx: 200,
        cy: 228,
        r: 140,
        strokeW: 30,
        pillarH: 160,
        lineW: 20,
        lineOverhang: 22,
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <!-- Background -->
    <linearGradient id="logoBg" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0%" stop-color="#131328"/>
      <stop offset="100%" stop-color="#080814"/>
    </linearGradient>

    <!-- Arch gradient -->
    <linearGradient id="archGradL" x1="0" y1="1" x2="0" y2="0" gradientUnits="objectBoundingBox">
      <stop offset="0%" stop-color="#2A5FD4"/>
      <stop offset="55%" stop-color="#4F8EF7"/>
      <stop offset="100%" stop-color="#89BFFF"/>
    </linearGradient>

    <!-- Glow -->
    <filter id="archGlowL" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="dotGlowL" x="-200%" y="-200%" width="500%" height="500%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>

    <!-- Separator gradient -->
    <linearGradient id="sep" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#4F8EF7" stop-opacity="0"/>
      <stop offset="35%" stop-color="#4F8EF7" stop-opacity="0.5"/>
      <stop offset="65%" stop-color="#4F8EF7" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#4F8EF7" stop-opacity="0"/>
    </linearGradient>

    <!-- Backdrop glow behind icon -->
    <radialGradient id="iconBackdrop" cx="20%" cy="48%" r="22%">
      <stop offset="0%" stop-color="#3A72E8" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#3A72E8" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="url(#logoBg)"/>
  <rect width="${W}" height="${H}" fill="url(#iconBackdrop)"/>

  <!-- Icon mark area (left side) -->
  <!-- Arch glow -->
  <path d="${m.archPath}" fill="none" stroke="#4F8EF7"
        stroke-width="${m.strokeW + 34}" stroke-linecap="round"
        opacity="0.12" filter="url(#archGlowL)"/>

  <!-- Arch -->
  <path d="${m.archPath}" fill="none" stroke="url(#archGradL)"
        stroke-width="${m.strokeW}" stroke-linecap="round"/>

  <!-- Base line (solid: bbox gradients degenerate on h-lines) -->
  <line x1="${m.lineX1}" y1="${m.botY}" x2="${m.lineX2}" y2="${m.botY}"
        stroke="#3B74E0" stroke-width="${m.lineW}" stroke-linecap="round" opacity="0.85"/>

  <!-- Apex dot -->
  <circle cx="${m.apexX}" cy="${m.apexY}" r="13" fill="#FFFFFF" opacity="0.95" filter="url(#dotGlowL)"/>

  <!-- Separator line -->
  <line x1="385" y1="0" x2="385" y2="${H}" stroke="url(#sep)" stroke-width="1.5"/>

  <!-- Wordmark: "Shadow" -->
  <text x="428" y="262"
        font-family="Arial Black, Arial, sans-serif"
        font-weight="900"
        font-size="132"
        fill="#FFFFFF"
        letter-spacing="-2">Shadow</text>

  <!-- Wordmark: "Portal" in blue -->
  <text x="428" y="380"
        font-family="Arial, sans-serif"
        font-weight="300"
        font-size="90"
        fill="#4F8EF7"
        letter-spacing="22">PORTAL</text>
</svg>`;
}

// ── Render SVG → PNG ──────────────────────────────────────────────────────────
function render(svgStr, outFile, width, height) {
    const resvg = new Resvg(svgStr, {
        fitTo: { mode: 'width', value: width },
        font: { loadSystemFonts: true },
    });
    const png = resvg.render().asPng();
    fs.writeFileSync(outFile, png);
    console.log(`Written: ${outFile}  (${(png.length / 1024).toFixed(1)} KB)`);
}

// ── Generate all assets ───────────────────────────────────────────────────────
fs.mkdirSync(OUT, { recursive: true });

// 1. App icon — 1024×1024 with dark background
render(buildIconSVG(), path.join(OUT, 'icon.png'), 1024, 1024);

// 2. Adaptive icon foreground — 1024×1024 transparent
//    (splash.png kept as the expo-splash-screen image source too)
render(buildFgSVG(), path.join(OUT, 'adaptive-icon.png'), 1024, 1024);
render(buildFgSVG(), path.join(OUT, 'splash.png'), 1024, 1024);

// 3. Monochrome adaptive icon (Android 13+ themed icons) — white only
render(buildWhiteMarkSVG(MONO_MARK), path.join(OUT, 'monochrome-icon.png'), 1024, 1024);

// 4. Notification small icon — 96×96 white glyph on transparency
render(buildWhiteMarkSVG(NOTIF_MARK), path.join(OUT, 'notification-icon.png'), 96, 96);

// 5. Logo — 1600×480 for marketing / docs
render(buildLogoSVG(), 'Shadow-Portal-Logo.png', 1600, 480);

// 4. Also save SVG sources for future editing
fs.writeFileSync('shadow-portal-icon.svg', buildIconSVG());
fs.writeFileSync('shadow-portal-logo.svg', buildLogoSVG());
console.log('Written: shadow-portal-icon.svg');
console.log('Written: shadow-portal-logo.svg');
console.log('\nDone! Expo asset files replaced.');
