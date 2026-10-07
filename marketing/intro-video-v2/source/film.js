// Shadow Portal launch film v2 — "Your Odoo. In their hands."
// 20 s · 60 fps · 1,200 frames. Every frame is a pure function of the frame number:
// window.__seek(frame) paints it (render.mjs drives this; fractional frames are motion-blur sub-samples).
// Layers, back to front: #bg (ink / pale / brand) · #scene (portal light + WebGL device) · #flat (app + Odoo
// panels, pointer) · #type (headlines) · #fx (portal close + logo mark) · #end (tagline, CTA).
import { createDevice, PHONE } from './device.js';
import * as UI from './ui.js';

const Q = new URLSearchParams(location.search);
const VERT = Q.get('format') === 'vertical';
const RENDER = Q.has('render');
document.body.classList.toggle('render', RENDER);
document.body.classList.toggle('debug', Q.has('debug'));
document.body.classList.toggle('safe', Q.has('safe'));
const W = VERT ? 1080 : 1920, H = VERT ? 1920 : 1080;
const CX = VERT ? 498 : 960;                 // centre of the portrait critical-content box (x 96–900)

const TL = await (await fetch('../timeline.json')).json();
const EV = TL.events, FPS = TL.fps, N = TL.durationFrames;
const COPY = Object.fromEntries(TL.copy.map(c => [c.id, c]));
const SHOT = Object.fromEntries(TL.shots.map(s => [s.id, s]));
let LENS = null;                             // this sample's pupil position (unit disk), set by __seek; null = pinhole

/* ── math ──────────────────────────────────────────────────────────────── */
const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const lerp = (a, b, p) => a + (b - a) * p;
const mixv = (a, b, p) => a.map((v, i) => lerp(v, b[i], p));
function bez(x1, y1, x2, y2) {             // CSS cubic-bezier timing function
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  return p => { if (p <= 0) return 0; if (p >= 1) return 1; let t = p;
    for (let i = 0; i < 16; i++) { const x = ((ax * t + bx) * t + cx) * t - p, d = (3 * ax * t + 2 * bx) * t + cx; if (Math.abs(x) < 1e-7 || Math.abs(d) < 1e-7) break; t = clamp(t - x / d); }
    return ((ay * t + by) * t + cy) * t; };
}
const E = {
  headIn: bez(0.23, 1, 0.32, 1),           // brief: headline arrival
  reframe: bez(0.77, 0, 0.175, 1),         // brief: product reframing
  land: bez(0.3, 0.05, 0.08, 1),           // device reveal: long deceleration, no overshoot
  out: bez(0.55, 0, 0.9, 0.5),             // departures
  scroll: bez(0.3, 0.1, 0.2, 1),           // a finger flick decelerating
  close: bez(0.4, 0, 0.12, 1),             // portal close: gentle start, long settle
  sine: p => -(Math.cos(Math.PI * p) - 1) / 2,
};
const P = (f, a, b, e) => { const p = clamp((f - a) / (b - a)); return e ? e(p) : p; };
// damped-spring step response (f0 Hz, damping ratio z; z ≈ 1 = near-critical, no bounce)
function spring(t, f0, z) { if (t <= 0) return 0; const w = 2 * Math.PI * f0;
  if (z >= 1) return 1 - Math.exp(-w * t) * (1 + w * t);
  const wd = w * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t)); }
// components/ui/button.tsx: pressIn → withSpring(1.05, {damping 15, stiffness 400, mass 0.5});
// pressOut → withSpring(1, {damping 20, stiffness 400, mass 0.8}), velocity carried over. Integrated exactly per sample.
function buttonScale(f) {
  if (f <= EV.submitPress) return 1;
  const T = (f - EV.submitPress) / FPS, Tr = (EV.submitRelease - EV.submitPress) / FPS, dt = 1 / 2400;
  let x = 1, v = 0;
  for (let t = 0; t < T - 1e-9; t += dt) {
    const h = Math.min(dt, T - t), [to, k, c, m] = t < Tr ? [1.05, 400, 15, 0.5] : [1, 400, 20, 0.8];
    v += ((-k * (x - to) - c * v) / m) * h; x += v * h;
  }
  return x;
}
const f2 = v => (Math.abs(v) < 5e-3 ? 0 : v).toFixed(2);
const $ = (s, r = document) => r.querySelector(s);
function el(tag, cls, html, parent) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (parent) parent.appendChild(e); return e; }
function offsetIn(e, anc) { let x = 0, y = 0; while (e && e !== anc) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; } return { x, y }; }
const vis = (e, on) => { if (e._v !== on) { e.style.visibility = on ? 'visible' : 'hidden'; e._v = on; } return on; };
const op = (e, a) => { e.style.opacity = a >= 0.999 ? '' : a.toFixed(3); };

/* ── stage ─────────────────────────────────────────────────────────────── */
const stage = $('#stage');
for (const e of [stage, $('#scene'), $('#gl'), $('#archlight')]) { e.style.width = W + 'px'; e.style.height = H + 'px'; }
const bg = $('#bg'), scene = $('#scene'), glc = $('#gl'), flat = $('#flat'), type = $('#type'), endL = $('#end'), fx = $('#fx');
const bgInk = el('div', 'ink', null, bg), bgPale = el('div', 'pale', null, bg), bgBrand = el('div', 'brand', null, bg);
bgInk.style.setProperty('--lx', VERT ? '50%' : '64%'); bgInk.style.setProperty('--ly', VERT ? '58%' : '50%');
const dev = await createDevice(glc, { width: W, height: H, pixelRatio: 2, texture: '../assets/screens/dashboard@5x.png' });
const tanV = Math.tan(dev.camera.fov * Math.PI / 360), aspect = W / H;

// straight-on framing: phone centre at frame point (px, py), phone height = hr × frame height
function framing(px, py, hr) {
  const d = PHONE.h / (hr * 2 * tanV), nx = px / W * 2 - 1, ny = 1 - py / H * 2;
  const x = -nx * d * tanV * aspect, y = -ny * d * tanV;
  return { cam: [x, y, d], target: [x, y, 0] };
}

/* ── layout per format (frame px; UI scale k = frame px per app pt) ─────── */
const L = VERT ? {
  head: 88, headX: 96, headY: 262,
  promiseY: 262, brandY: 488,
  macro0: { cam: [58, 136, 268], target: [2, 62, 0], rot: [14, -31, -8] },
  macro1: { cam: [52, 126, 276], target: [1, 58, 0], rot: [12, -21, -6] },
  portalAim: { at: [4, 36], dist: 700 }, aperture: 1.6, focus: [4, 50, 4.06],
  heroPx: [540, 1170], heroH: 0.56, heroRot: [1.5, -5, 0],
  formK: 2.25, formX: 96, formSel: 530, formMask: [490, 526], submitY: 1190,
  toastK: 2.35, toastX: CX, toastY: 690,
  odooK: 2.6, odooW: 310, odooTop: 520,
  inboxK: 2.28, inboxH1: 548,
  lockScale: 0.8, lockY: 718, tagSize: 64, tagY: 916, ctaSize: 46, ctaY: 1092, tagLines: ['Your Odoo.', 'In every pocket.'],
} : {
  head: 112, headX: 96, headY: 96,
  promiseY: 410, brandY: 700,
  macro0: { cam: [118, 150, 262], target: [-34, 50, 0], rot: [13, -33, -8] },
  macro1: { cam: [110, 138, 268], target: [-30, 44, 0], rot: [11, -22, -6] },
  portalAim: { at: [-2, 50], dist: 1200 }, aperture: 1.6, focus: [2, 56, 4.06],
  heroPx: [1262, 540], heroH: 0.84, heroRot: [1.5, -6, 0],
  formK: 2.3, formX: 960, formSel: 104, formMask: [58, 100], submitY: 830,
  toastK: 2.5, toastX: 1353, toastY: 430,
  odooK: 2.3, odooW: 700, odooTop: 236,
  inboxK: 2.4, inboxH1: 262,
  lockScale: 0.9, lockY: 440, tagSize: 60, tagY: 648, ctaSize: 40, ctaY: 744, tagLines: ['Your Odoo. In every pocket.'],
};
L.hero = { ...framing(L.heroPx[0], L.heroPx[1], L.heroH), rot: L.heroRot };

/* ── headlines ─────────────────────────────────────────────────────────── */
function head(lines, cls, x, y, size, align = 'left') {
  const h = el('div', 'head ' + cls, null, type);
  h.style.fontSize = size + 'px'; h.style.top = y + 'px';
  if (align === 'center') { h.style.left = '0px'; h.style.width = W + 'px'; h.style.textAlign = 'center'; }
  else h.style.left = x + 'px';
  h._lines = lines.map(t => el('span', 'ln', t, h));
  return h;
}
// ins/outs: frame per line (≤3-frame offsets inside a two-line group; the opening promise is two beats)
function runHead(h, f, ins, outs) {
  if (!vis(h, f >= ins[0] - 1 && f < outs[outs.length - 1] + 14)) return;
  h._lines.forEach((ln, i) => {
    const a = P(f, ins[i], ins[i] + 22, E.headIn), d = P(f, outs[i], outs[i] + 12, E.out);
    ln.style.opacity = (a * (1 - d)).toFixed(3);
    ln.style.transform = `translate3d(0, ${f2((1 - a) * 32 - d * 10)}px, 0)`;
  });
}
const hPromise = head([COPY.promise1.text, COPY.promise2.text], 'dark', L.headX, L.promiseY, L.head);
const hEmployee = head(['Employee', 'requests.'], 'light', L.headX, VERT ? L.headY : 410, L.head);
const hOdoo = head(VERT ? ['Connected', 'to Odoo.'] : ['Connected to Odoo.'], 'light', L.headX, VERT ? L.headY : 80, L.head);   // x aligned to the record after measure()
const hStatus = VERT ? head(['Clear status.', 'Less chasing.'], 'light', L.headX, L.headY, L.head)
  : head(['Clear status. Less chasing.'], 'light', 0, 88, L.head, 'center');

// small brand identifier (shot 02): the real mark + name
const ICON_SVG = `<svg width="46" height="46" viewBox="0 0 400 400" style="flex:none"><defs><linearGradient id="bi" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#2A5FD4"/><stop offset=".55" stop-color="#4F8EF7"/><stop offset="1" stop-color="#89BFFF"/></linearGradient></defs>
  <path d="M 60 388 L 60 228 A 140 140 0 0 1 340 228 L 340 388" fill="none" stroke="url(#bi)" stroke-width="30" stroke-linecap="round"/>
  <line x1="38" y1="388" x2="362" y2="388" stroke="#3B74E0" stroke-width="20" stroke-linecap="round" opacity=".85"/><circle cx="200" cy="88" r="13" fill="#fff"/></svg>`;
const brandId = el('div', 'brandmark', `${ICON_SVG}<span>Shadow Portal</span>`, type);
brandId.style.left = L.headX + 'px'; brandId.style.top = L.brandY + 'px';
brandId.style.fontSize = (VERT ? 44 : 36) + 'px';                           // support-text scale per format
if (VERT) { const i = brandId.querySelector('svg'); i.setAttribute('width', 56); i.setAttribute('height', 56); }

/* ── the portal as a real light standing behind the hero (shot 02) ─────── */
const archLight = $('#archlight');
archLight.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>
  <linearGradient id="alg" gradientUnits="userSpaceOnUse" x1="0" x2="0"><stop offset="0" stop-color="#2A5FD4"/><stop offset=".55" stop-color="#4F8EF7"/><stop offset="1" stop-color="#89BFFF"/></linearGradient>
  <filter id="alf" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${VERT ? 30 : 26}"/></filter></defs>
  <path id="alp1" fill="none" stroke="#4F8EF7" stroke-width="26" stroke-linecap="round" opacity="0.32" filter="url(#alf)"/>
  <path id="alp2" fill="none" stroke="url(#alg)" stroke-width="5" stroke-linecap="round"/></svg>`;
{ // arch around the landed hero: radius from the phone width, apex a little above the device, legs to a floor line below it
  const ph = L.heroH * H, pw = ph * PHONE.w / PHONE.h, [hx, hy] = L.heroPx;
  const R = pw * (VERT ? 0.8 : 0.95), cy = hy - ph / 2 - ph * 0.08 + R, base = H + 60;          // legs run out of frame
  const d = `M ${hx - R} ${base} L ${hx - R} ${cy} A ${R} ${R} 0 0 1 ${hx + R} ${cy} L ${hx + R} ${base}`;
  $('#alp1').setAttribute('d', d); $('#alp2').setAttribute('d', d);
  $('#alg').setAttribute('y1', base); $('#alg').setAttribute('y2', cy - R);
}

/* ── flat UI panels (pale studio) ──────────────────────────────────────── */
const scrDash = UI.dashboardScreen(), scrForm = UI.timeOffScreen(), scrHub = UI.hubScreen(), scrInbox = UI.inboxScreen();
const odoo = UI.odooRecord();
odoo.root.style.width = L.odooW + 'px';
if (VERT) odoo.root.classList.add('narrow');
const panels = {};
const blank = el('div', 'app');            // the screen's own background: content dissolves through it, never through another screen
for (const [k, e] of Object.entries({ blank, dash: scrDash.root, form: scrForm.root, hub: scrHub.root, inbox: scrInbox.root, odoo: odoo.root })) {
  panels[k] = el('div', 'panel', null, flat); panels[k].appendChild(e); vis(panels[k], false);
}
panels.hub.classList.add('bare'); panels.inbox.classList.add('bare');        // the OS status bar belongs to the device, not the studio
scrForm.toast.remove();
const pointer = el('div', null, UI.POINTER, flat); pointer.id = 'pointer'; vis(pointer, false);
const touch = el('div', 'touch', null, flat); vis(touch, false);                // one fingertip contact, 44 pt
function place(p, k, tx, ty, a = 1) {
  if (!vis(p, a > 0.002)) return;
  p.style.transform = `translate3d(${f2(tx)}px, ${f2(ty)}px, 0) scale(${k.toFixed(5)})`;
  op(p, a);
}
// soft vertical mask in panel pt: transparent above y0, opaque from y1 (strength a), optional bottom fade
function mask(p, a, y0, y1, b0 = 1e5, b1 = 1e5 + 1) {
  const m = a <= 0.001 ? '' : `linear-gradient(to bottom, rgba(0,0,0,${(1 - a).toFixed(3)}) ${y0.toFixed(1)}px, #000 ${y1.toFixed(1)}px, #000 ${b0.toFixed(1)}px, rgba(0,0,0,${(1 - a).toFixed(3)}) ${b1.toFixed(1)}px)`;
  if (p._m !== m) { p.style.webkitMaskImage = m; p.style.maskImage = m; p._m = m; }
}

/* ── end card: portal close → the real mark, outlined wordmark ─────────── */
const WM = await (await fetch('../assets/logo/wordmark-paths.json')).json();
// canonical mark (shadow-portal-logo.svg units): arch centre (200,228) r 140, legs to 388, base 38–362, apex dot (200,88) r 13
const MARK = { cx: 200, cy: 228, R: 140, base: 388, baseL: 38, baseR: 362, arch: 30, baseW: 20, dotY: 88, dotR: 13, sep: 385 };
const s = L.lockScale;
const BRAND_BG = (() => {                   // CSS linear-gradient(162deg, #131328, #080814) as SVG user-space endpoints
  const a = 162 * Math.PI / 180, dx = Math.sin(a), dy = -Math.cos(a), len = Math.abs(W * dx) + Math.abs(H * dy);
  return [W / 2 - dx * len / 2, H / 2 - dy * len / 2, W / 2 + dx * len / 2, H / 2 + dy * len / 2];
})();
fx.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <mask id="hole" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/><path id="holep" fill="#000"/></mask>
    <linearGradient id="bgg" gradientUnits="userSpaceOnUse" x1="${BRAND_BG[0]}" y1="${BRAND_BG[1]}" x2="${BRAND_BG[2]}" y2="${BRAND_BG[3]}"><stop offset="0" stop-color="#131328"/><stop offset="1" stop-color="#080814"/></linearGradient>
    <linearGradient id="pg" gradientUnits="userSpaceOnUse" x1="0" x2="0"><stop offset="0" stop-color="#2A5FD4"/><stop offset=".55" stop-color="#4F8EF7"/><stop offset="1" stop-color="#89BFFF"/></linearGradient>
    <radialGradient id="backdrop" gradientUnits="userSpaceOnUse" r="1"><stop offset="0" stop-color="#3A72E8" stop-opacity="0.16"/><stop offset="1" stop-color="#3A72E8" stop-opacity="0"/></radialGradient>
    <filter id="pglow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur id="pglowb" stdDeviation="12"/></filter>
    <filter id="dglow" x="-300%" y="-300%" width="700%" height="700%"><feGaussianBlur id="dglowb" stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <linearGradient id="sepg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4F8EF7" stop-opacity="0"/><stop offset=".35" stop-color="#4F8EF7" stop-opacity=".5"/><stop offset=".65" stop-color="#4F8EF7" stop-opacity=".5"/><stop offset="1" stop-color="#4F8EF7" stop-opacity="0"/></linearGradient>
  </defs>
  <g id="darkg" mask="url(#hole)"><rect id="darkfield" width="${W}" height="${H}" fill="url(#bgg)"/></g>
  <rect id="inside" width="${W}" height="${H}" fill="url(#bgg)"/>
  <rect id="backdropr" width="${W}" height="${H}" fill="url(#backdrop)"/>
  <path id="pglowp" fill="none" stroke="#4F8EF7" stroke-linecap="round" filter="url(#pglow)"/>
  <path id="parch" fill="none" stroke="url(#pg)" stroke-linecap="round"/>
  <line id="pbase" stroke="#3B74E0" stroke-linecap="round"/>
  <circle id="pdot" fill="#FFFFFF" opacity="0.95" filter="url(#dglow)"/>
  <line id="psep" stroke="url(#sepg)" stroke-width="${(1.5 * s).toFixed(2)}"/>
  <path id="wm1" fill="#FFFFFF" d="${WM.shadow}"/><path id="wm2" fill="#4F8EF7" d="${WM.portal}"/>
</svg>`;
const holeP = $('#holep'), darkG = $('#darkg'), pArch = $('#parch'), pGlow = $('#pglowp'), pBase = $('#pbase'), pDot = $('#pdot'), pSep = $('#psep');
const pGrad = $('#pg'), backdrop = $('#backdrop'), backdropR = $('#backdropr'), inside = $('#inside'), pGlowB = $('#pglowb'), wm1 = $('#wm1'), wm2 = $('#wm2');
const tag = el('div', 'tagline', L.tagLines.join('<br>'), endL);
tag.style.fontSize = L.tagSize + 'px';
const cta = el('div', 'cta', COPY.cta.text, endL);
cta.style.fontSize = L.ctaSize + 'px';

/* ── measured geometry (after fonts) ───────────────────────────────────── */
const M = {};
let LOCK, SR, K0, ZS, ZA;
function measure() {
  const r = scrForm.root;
  M.formSel = offsetIn(scrForm.type, r).y;
  M.formSubmit = offsetIn(scrForm.submit, r).y + scrForm.submit.offsetHeight / 2;
  M.submitX = offsetIn(scrForm.submit, r).x + scrForm.submit.offsetWidth / 2;
  M.toastY = offsetIn(scrHub.toast, scrHub.root).y + scrHub.toast.offsetHeight / 2;
  M.hubFade = offsetIn(scrHub.root.querySelector('.hubcard'), scrHub.root).y + 30;
  M.odooW = odoo.root.offsetWidth;
  const ab = odoo.approve, ao = offsetIn(ab, odoo.root);
  M.approve = { x: ao.x + ab.offsetWidth * 0.42, y: ao.y + ab.offsetHeight * 0.55 };
  M.inboxH1 = offsetIn(scrInbox.root.querySelector('.inbox-head h1'), scrInbox.root).y;
  M.todayH = scrInbox.todayIn.offsetHeight;
  M.tagW = tag.offsetWidth; M.ctaW = cta.offsetWidth;
  if (!VERT) hOdoo.style.left = (CX - M.odooW * L.odooK / 2 + 20 * L.odooK - 4) + 'px';   // flush with the record's text column
  // lockup box from the real artwork: mark (base line caps, arch stroke) + outlined wordmark
  const b1 = wm1.getBBox(), b2 = wm2.getBBox();
  const box = { x0: MARK.baseL - MARK.baseW / 2, x1: Math.max(b1.x + b1.width, b2.x + b2.width), y0: MARK.cy - MARK.R - MARK.arch / 2, y1: MARK.base + MARK.baseW / 2 };
  LOCK = { box, ox: CX - (box.x0 + box.x1) / 2 * s, oy: L.lockY - (box.y0 + box.y1) / 2 * s };   // frame = o + u·s
}
const LX = u => LOCK.ox + u * s, LY = v => LOCK.oy + v * s;

/* ── the device ────────────────────────────────────────────────────────── */
function deviceState(f) {
  const A = L.macro0, B = L.macro1, Hr = L.hero;
  let cam, target, rot;
  if (f < EV.cameraPullStart) {             // 01: one slow, controlled reveal along the upper edge
    const u = f / EV.cameraPullStart;
    cam = mixv(A.cam, B.cam, u); target = mixv(A.target, B.target, u); rot = mixv(A.rot, B.rot, u);
  } else {                                  // 02: pull back to the hero, landed by 3.0 s, then still
    const u = P(f, EV.cameraPullStart, EV.cameraLand, E.land);
    cam = mixv(B.cam, Hr.cam, u); target = mixv(B.target, Hr.target, u); rot = mixv(B.rot, Hr.rot, u);
    rot = mixv(rot, [0, 0, 0], P(f, EV.enterScreenStart, EV.frontal, E.sine));   // square up to the viewer before the hand-off
  }
  const hero = P(f, EV.cameraPullStart + 20, EV.cameraLand), off = 1 - P(f, EV.enterScreenStart, EV.frontal, E.sine);
  const wake = P(f, EV.displayWakeStart, EV.displayWakeEnd, bez(0.45, 0.05, 0.3, 1));
  // restrained depth of field on the opening detail only: focused on the header, the far body falls soft; gone by the hero
  const aperture = L.aperture * (1 - P(f, EV.cameraPullStart, EV.cameraPullStart + 36, E.sine));
  return {
    cam, target, rot, lens: LENS, aperture, focus: L.focus,
    // the portal reads in the dark glass; once the display is lit, keep the reflection from washing over the UI
    reflect: lerp(1.25 * (0.05 + 0.95 * Math.pow(1 - wake, 1.7)), 0.55, hero) * off,
    scrim: 0.7 * hero,
    rim: 7 * P(f, EV.archLightIn, EV.cameraLand, E.sine) * off,
    screen: wake,                            // the display wakes under the portal's reflection (eased in: no first-frame pop)
  };
}
// the device → flat-UI hand-off is one push-in: a scale about a fixed point that ends on the form framing
function zoomAt(f) {
  const sc = Math.pow(ZS, P(f, EV.enterScreenStart, EV.enterScreenEnd, E.reframe));
  return { s: sc, tx: ZA[0] * (1 - sc), ty: ZA[1] * (1 - sc) };
}

/* ── device proof only (?flatdevice): the same path drawn as a flat mock-up, for the 3D-vs-flat comparison ── */
const FLATDEV = Q.has('flatdevice');
let flatPhone = null;
function paintFlatDevice(f, on) {
  if (!flatPhone) {
    flatPhone = el('div', 'flatphone', `<img src="../assets/screens/dashboard@5x.png">`, scene);
    glc.style.visibility = 'hidden';
  }
  if (!vis(flatPhone, on)) return;
  dev.render(deviceState(f));                         // only to project the screen; the canvas stays hidden
  const r = dev.screenRect(W, H), bez_ = r.w * 0.045;
  Object.assign(flatPhone.style, { left: f2(r.x - bez_) + 'px', top: f2(r.y - bez_) + 'px', width: f2(r.w + 2 * bez_) + 'px', height: f2(r.h + 2 * bez_) + 'px',
    padding: f2(bez_) + 'px', borderRadius: f2(r.w * 0.16) + 'px' });
  flatPhone.firstChild.style.borderRadius = f2(r.w * 0.108) + 'px';
  const wake = P(f, EV.displayWakeStart, EV.displayWakeEnd, bez(0.45, 0.05, 0.3, 1));
  flatPhone.firstChild.style.opacity = wake.toFixed(3);
}

/* ── paint ─────────────────────────────────────────────────────────────── */
function paint(f) {
  f = clamp(f, 0, N - 1e-6);
  const sw = EV.screenSwap;

  // stage tone: ink → pale at the hand-off; brand field handled by the portal close
  op(bgPale, P(f, sw, sw + 16, E.sine));
  vis(bgPale, f >= sw && f < EV.portalClosed);
  vis(bgBrand, f >= EV.portalClosed);
  vis(flat, f < EV.portalClosed);

  // ── device (01, 02, hand-off)
  const z = f >= EV.enterScreenStart ? zoomAt(f) : { s: 1, tx: 0, ty: 0 };
  const sceneOn = vis(scene, f < sw + 14);
  if (FLATDEV) paintFlatDevice(f, sceneOn);
  const al = P(f, EV.archLightIn, EV.cameraLand, E.sine) * (1 - P(f, EV.enterScreenStart, EV.frontal, E.sine));
  if (vis(archLight, sceneOn && al > 0.002)) op(archLight, al);      // children must be hidden explicitly
  if (sceneOn) {
    dev.render(deviceState(f));
    scene.style.transform = z.s === 1 ? '' : `translate(${f2(z.tx)}px, ${f2(z.ty)}px) scale(${z.s.toFixed(5)})`;
    op(glc, 1 - P(f, sw, sw + 12, E.sine));
  }

  // ── 03 employee request
  // hand-off: the DOM screen sits exactly on the rendered screen, then rides the same push-in
  const formTx = L.formX - 24 * L.formK, formTy = L.formSel - M.formSel * L.formK;
  if (f >= sw && f < EV.enterScreenEnd) {
    const k = z.s * K0, tx = z.s * SR.x + z.tx, ty = z.s * SR.y + z.ty;
    place(panels.blank, k, tx, ty);
    place(panels.dash, k, tx, ty, 1 - P(f, sw, sw + 5, E.sine));       // dashboard content clears…
    place(panels.form, k, tx, ty, P(f, sw + 5, sw + 11, E.sine));      // …then the New Time Off content arrives
  } else {
    vis(panels.blank, false); vis(panels.dash, false);
    if (f >= EV.enterScreenEnd && f < EV.toastIn) place(panels.form, L.formK, formTx, formTy); else vis(panels.form, false);
  }
  const fm = (y) => (y - formTy) / L.formK;  // frame y → form pt
  mask(panels.form, 1, fm(L.formMask[0]), fm(L.formMask[1]));
  // one scroll to the button, one press, the real loading state
  const scrollPt = (M.formSubmit - M.formSel) - (L.submitY - L.formSel) / L.formK;
  scrForm.scroller.style.transform = `translate3d(0, ${f2(-scrollPt * P(f, EV.formScrollStart, EV.formScrollEnd, E.scroll))}px, 0)`;
  const loading = f >= EV.submitRelease && f < EV.toastIn;
  scrForm.submit.style.transform = `scale(${buttonScale(f).toFixed(5)})`;
  op(scrForm.submit, loading ? 0.5 : 1);    // disabled={loading} → Button opacity × 0.5
  if (scrForm._loading !== loading) {
    scrForm._loading = loading;
    scrForm.submitLabel.innerHTML = loading ? '<span class="spinner"></span>' : 'Submit Request';
  }
  if (loading) scrForm.submitLabel.firstChild.style.transform = `rotate(${f2(((f - EV.submitRelease) * 13.5) % 360)}deg)`;
  const tIn = P(f, EV.submitPress - 3, EV.submitPress, E.sine), tOut = P(f, EV.submitRelease, EV.submitRelease + 7, E.sine);
  if (vis(touch, f >= EV.submitPress - 3 && tOut < 0.999 && f < EV.toastIn)) {
    const k = L.formK, tx = formTx + (M.submitX + 104) * k, ty = L.submitY + 4 * k, sc = k * (0.85 + 0.15 * tIn + 0.2 * tOut);
    touch.style.transform = `translate3d(${f2(tx)}px, ${f2(ty)}px, 0) scale(${sc.toFixed(4)})`;
    op(touch, tIn * (1 - tOut));
  }

  // result: the app returns to its hub and shows the success toast (no entry animation in toast-context.tsx)
  if (f >= EV.toastIn && f < SHOT['04'].start + 12) {
    const k = L.toastK, out = P(f, SHOT['04'].start, SHOT['04'].start + 12, E.sine);
    place(panels.hub, k, L.toastX - 195 * k, L.toastY - M.toastY * k, 1 - out);
    mask(panels.hub, 1, -2, -1, M.hubFade, M.hubFade + 150);       // keep the eye on the toast: the hub's cards recede
  } else vis(panels.hub, false);

  // ── 04 the same request as an Odoo record; the manager approves it there
  if (f >= SHOT['04'].start && f < SHOT['05'].start) {
    const k = L.odooK, a = P(f, SHOT['04'].start, SHOT['04'].start + 12, E.sine);
    const settle = P(f, SHOT['04'].start, EV.recordHandoffEnd, E.headIn);
    const tx = CX - M.odooW * k / 2, ty = L.odooTop + (1 - settle) * 28;
    place(panels.odoo, k, tx, ty, a);
    const appr = f >= EV.approvedState;
    odoo.s1.classList.toggle('cur', !appr); odoo.s2.classList.toggle('cur', appr);
    odoo.approve.style.display = appr ? 'none' : '';      // Odoo re-renders the header: Approve leaves, Refuse stays
    odoo.approve.classList.toggle('down', f >= EV.approvePress && f < EV.approveRelease);
    // pointer: in from lower right, onto Approve, click, then away
    const pin = P(f, EV.pointerIn, EV.pointerOnApprove, bez(0.25, 0, 0.15, 1));
    const px = tx + M.approve.x * k, py = L.odooTop + M.approve.y * k;
    const away = P(f, EV.approveRelease, EV.approveRelease + 26, bez(0.2, 0.6, 0.35, 1));
    const ptx = lerp(px + (VERT ? 330 : 520), px, pin) + away * (VERT ? 150 : 240);
    const pty = lerp(py + (VERT ? 520 : 330), py, pin) + away * (VERT ? 190 : 130);
    const pa = P(f, EV.pointerIn, EV.pointerIn + 8) * (1 - P(f, SHOT['05'].start - 12, SHOT['05'].start));
    if (vis(pointer, f >= EV.pointerIn && pa > 0.002)) {
      const ps = k / 1.7 * (f >= EV.approvePress && f < EV.approveRelease ? 0.94 : 1);
      pointer.style.transform = `translate3d(${f2(ptx - 2)}px, ${f2(pty - 2)}px, 0) scale(${ps.toFixed(4)})`;
      op(pointer, pa);
    }
  } else { vis(panels.odoo, false); vis(pointer, false); }

  // ── 05 the employee's Inbox: the approval arrives as the Today group (notifications.tsx groups by day)
  if (f >= SHOT['05'].start && f < EV.portalClosed + 4) {
    const k = L.inboxK, tx = CX - 195 * k, ty = L.inboxH1 - M.inboxH1 * k;
    // inside the closing portal the app recedes with it (farther than the doorway, so it shrinks less)
    let zk = k, ztx = tx, zty = ty;
    if (f >= EV.portalCloseStart) {
      const pc = portal(f), g = Math.pow(pc.R / pc.R0, 0.62);
      zk = k * g; ztx = pc.cx + (tx - pc.cx0) * g; zty = pc.cy + (ty - pc.cy0) * g;
    }
    place(panels.inbox, zk, ztx, zty);
    mask(panels.inbox, 1, M.inboxH1 - 30, M.inboxH1 - 6, 640, 720);
    const ins = spring((f - EV.notificationIn) / FPS, 2.6, 0.96);
    scrInbox.todayWrap.style.height = f2(M.todayH * clamp(ins, 0, 1.02)) + 'px';
    scrInbox.item.style.transform = `translate3d(0, ${f2((1 - ins) * -14)}px, 0)`;
    op(scrInbox.todayIn, P(f, EV.notificationIn + 2, EV.notificationIn + 14, E.sine));
    scrInbox.unread.textContent = f >= EV.notificationIn ? '1 unread message' : '0 unread messages';
  } else vis(panels.inbox, false);

  // ── headlines
  runHead(hPromise, f, [COPY.promise1.in, COPY.promise2.in], [COPY.promise1.out, COPY.promise2.out]);
  runHead(hEmployee, f, [COPY.employee.in, COPY.employee.in + 3], [COPY.employee.out, COPY.employee.out + 2]);
  runHead(hOdoo, f, VERT ? [COPY.odoo.in, COPY.odoo.in + 3] : [COPY.odoo.in], VERT ? [COPY.odoo.out, COPY.odoo.out + 2] : [COPY.odoo.out]);
  runHead(hStatus, f, VERT ? [COPY.status.in, COPY.status.in + 3] : [COPY.status.in], VERT ? [COPY.status.out, COPY.status.out + 2] : [COPY.status.out]);
  const bi = P(f, COPY.brand.in, COPY.brand.in + 22, E.headIn) * (1 - P(f, COPY.brand.out - 12, COPY.brand.out, E.out));
  if (vis(brandId, bi > 0.002)) { op(brandId, bi); brandId.style.transform = `translate3d(0, ${f2((1 - bi) * 24)}px, 0)`; }

  paintEnd(f);
  if (!RENDER) $('#dbg').textContent = `${f.toFixed(1)} · ${(f / FPS).toFixed(2)} s`;
}

// portal geometry at frame f: an arch (with its floor line) that starts larger than the frame and lands on the mark
function portal(f) {
  // the portal first appears as a frame around the app (arch as wide as the picture, apex just under the top edge),
  // then closes onto the mark — so its dark field grows from the corners instead of sweeping across in a few frames
  const u = P(f, EV.portalCloseStart, EV.portalClosed, E.close);
  const Rf = MARK.R * s, cxf = LX(MARK.cx), cyf = LY(MARK.cy);
  const R0 = VERT ? W * 0.85 : W / 2, cx0 = W / 2, cy0 = R0 + (VERT ? 120 : 44);   // portrait: legs and floor start outside the frame
  const R = R0 * Math.pow(Rf / R0, u);
  const q = (R - Rf) / (R0 - Rf);                      // 1 → 0, linear in size: keeps the centre path steady
  // k: frame px per mark unit for geometry; ks: for stroke widths, which stay slimmer while the portal is large
  return { u, R, R0, Rf, cx: lerp(cxf, cx0, q), cy: lerp(cyf, cy0, q), cx0, cy0, k: R / MARK.R, ks: s * Math.pow(R / Rf, 0.35) };
}
function paintEnd(f) {
  if (!vis(fx, f >= EV.portalCloseStart)) { vis(endL, false); return; }
  const pc = portal(f), k = pc.k;                      // k: frame px per mark unit (= s when landed)
  const X = u => pc.cx + (u - MARK.cx) * k, Y = v => pc.cy + (v - MARK.cy) * k;
  const archD = `M ${f2(X(60))} ${f2(Y(MARK.base))} L ${f2(X(60))} ${f2(Y(MARK.cy))} A ${f2(pc.R)} ${f2(pc.R)} 0 0 1 ${f2(X(340))} ${f2(Y(MARK.cy))} L ${f2(X(340))} ${f2(Y(MARK.base))}`;
  holeP.setAttribute('d', archD + ' Z');
  const appear = P(f, EV.portalCloseStart, EV.portalCloseStart + 8, E.sine);        // the frame fades in, then closes
  op(darkG, appear); op(pArch, appear); op(pGlow, 0.12 * appear); op(pBase, 0.85 * appear);
  pArch.setAttribute('d', archD); pArch.setAttribute('stroke-width', f2(MARK.arch * pc.ks));
  pGlow.setAttribute('d', archD); pGlow.setAttribute('stroke-width', f2(64 * pc.ks)); pGlowB.setAttribute('stdDeviation', f2(12 * pc.ks));
  pGrad.setAttribute('y1', f2(Y(MARK.base))); pGrad.setAttribute('y2', f2(Y(MARK.cy - MARK.R)));
  pBase.setAttribute('x1', f2(X(MARK.baseL))); pBase.setAttribute('x2', f2(X(MARK.baseR)));
  pBase.setAttribute('y1', f2(Y(MARK.base))); pBase.setAttribute('y2', f2(Y(MARK.base))); pBase.setAttribute('stroke-width', f2(MARK.baseW * pc.ks));
  // inside the doorway the pale world dims with one overlay, so app and studio darken together
  const ins = P(f, EV.portalInside, EV.portalClosed, E.sine);
  op(inside, ins); vis(inside, ins > 0.002); vis(flat, f < EV.portalClosed); vis(bgPale, f < EV.portalClosed);
  // logo backdrop glow: the source SVG's objectBoundingBox radial (cx 20%, cy 48%, r 22% of 1600×480) → an ellipse
  const bx = X(320), by = Y(230.4);
  backdrop.setAttribute('cx', f2(bx)); backdrop.setAttribute('cy', f2(by)); backdrop.setAttribute('r', f2(352 * k));
  backdrop.setAttribute('gradientTransform', `translate(${f2(bx)} ${f2(by)}) scale(1 0.3) translate(${f2(-bx)} ${f2(-by)})`);
  op(backdropR, ins); vis(backdropR, ins > 0.002);
  // apex light: the sonic signature's visual partner
  const dot = P(f, EV.apexLight - 3, EV.apexLight + 9, E.headIn);
  pDot.setAttribute('cx', f2(X(MARK.cx))); pDot.setAttribute('cy', f2(Y(MARK.dotY))); pDot.setAttribute('r', f2(MARK.dotR * k * dot));
  op(pDot, 0.95 * P(f, EV.apexLight - 3, EV.apexLight + 1));
  // wordmark + separator, then tagline and CTA — all complete by 17.0 s, then a still hold
  vis(endL, f >= EV.wordmarkIn - 1);
  const wa = P(f, EV.wordmarkIn, EV.wordmarkIn + 24, E.headIn), wb = P(f, EV.wordmarkIn + 3, EV.wordmarkIn + 27, E.headIn);
  const tr = d => `translate(${f2(LOCK.ox)} ${f2(LOCK.oy + d)}) scale(${s})`;
  wm1.setAttribute('transform', tr((1 - wa) * 26)); op(wm1, wa);
  wm2.setAttribute('transform', tr((1 - wb) * 26)); op(wm2, wb);
  const sp = P(f, EV.wordmarkIn - 4, EV.wordmarkIn + 20, E.headIn);
  pSep.setAttribute('x1', f2(LX(MARK.sep))); pSep.setAttribute('x2', f2(LX(MARK.sep)));
  pSep.setAttribute('y1', f2(LY(240 - 240 * sp))); pSep.setAttribute('y2', f2(LY(240 + 240 * sp)));
  const ta = P(f, COPY.tagline.in, COPY.tagline.in + 22, E.headIn), ca = P(f, COPY.cta.in, COPY.cta.in + 22, E.headIn);
  tag.style.transform = `translate3d(${f2(CX - M.tagW / 2)}px, ${f2(L.tagY + (1 - ta) * 28)}px, 0)`; op(tag, ta);
  cta.style.transform = `translate3d(${f2(CX - M.ctaW / 2)}px, ${f2(L.ctaY + (1 - ca) * 28)}px, 0)`; op(cta, ca);
}

/* ── boot ──────────────────────────────────────────────────────────────── */
await Promise.all(['500 40px Outfit', '600 40px Outfit', '700 40px Outfit', '400 40px "DM Sans"', '500 40px "DM Sans"', '700 40px "DM Sans"'].map(fc => document.fonts.load(fc)));
await document.fonts.ready;
measure();
dev.aimPortal(deviceState(6), ...L.portalAim.at, L.portalAim.dist);     // the portal stands on the opening's mirror ray
// the frontal pose's projected screen: where the DOM screen must sit at the swap
dev.render(deviceState(EV.screenSwap));
SR = dev.screenRect(W, H); K0 = SR.w / 390;
{ const formTx = L.formX - 24 * L.formK, formTy = L.formSel - M.formSel * L.formK;
  ZS = L.formK / K0;
  const t = [formTx - SR.x * ZS, formTy - SR.y * ZS];
  ZA = [t[0] / (1 - ZS), t[1] / (1 - ZS)]; }
if (!RENDER) {
  const sf = $('#safe');
  Object.assign(sf.style, VERT ? { left: '96px', top: '240px', width: '804px', height: '1260px' } : { left: '96px', top: '72px', width: '1728px', height: '936px' });
  const fit = () => { stage.style.transform = `scale(${Math.min(innerWidth / W, (innerHeight - 56) / H)})`; };
  fit(); addEventListener('resize', fit);
}
// __seek(frame, j, n): sample j of n inside this frame (render.mjs). The lens pupil walks a Vogel disk, rotated per frame.
window.__seek = (f, j = 0, n = 1) => {
  if (n > 1) { const r = Math.sqrt((j + 0.5) / n), a = j * 2.399963 + Math.floor(f) * 1.618; LENS = [r * Math.cos(a), r * Math.sin(a)]; }
  else LENS = null;
  paint(f);
};
window.__frames = N; window.__fps = FPS; window.__size = [W, H];
// motion-blur sample density (render.mjs): holds stay sharp; camera moves and fast UI motion get more samples
const MB = [[0, 108, 20], [108, 150, 16], [150, 186, 12], [236, 280, 18], [EV.formScrollStart - 1, EV.formScrollEnd + 2, 14], [EV.submitPress, EV.submitRelease + 16, 6],
  [480, 510, 6], [EV.pointerIn, EV.approveRelease + 32, 8], [EV.notificationIn, EV.notificationSettled + 4, 8], [EV.portalCloseStart, EV.portalClosed + 2, 20],
  [EV.wordmarkIn - 4, EV.lockupComplete + 2, 8]];
window.__samples = f => MB.reduce((n, [a, b, k]) => (f >= a && f < b ? Math.max(n, k) : n), 1);
paint(Number(Q.get('f') || 0));
window.__ready = true;

// preview player: frame-accurate scrub + real-time play
if (!RENDER) {
  const play = $('#play'), scrub = $('#scrub'), tc = $('#tc');
  scrub.max = N - 1;
  let playing = false, cur = Number(Q.get('f') || 0), t0 = 0, f0 = 0;
  const set = v => { cur = v; scrub.value = v; tc.textContent = `frame ${Math.floor(v)} · ${(v / FPS).toFixed(2)} s`; paint(v); };
  play.onclick = () => { playing = !playing; play.textContent = playing ? 'Pause' : 'Play'; if (playing) { if (cur >= N - 1) cur = 0; t0 = performance.now(); f0 = cur; } };
  scrub.oninput = () => { set(Number(scrub.value)); if (playing) { t0 = performance.now(); f0 = cur; } };
  addEventListener('keydown', e => {
    if (e.code === 'Space') { e.preventDefault(); play.click(); }
    if (e.code === 'ArrowRight') set(Math.min(N - 1, Math.floor(cur) + (e.shiftKey ? 30 : 1)));
    if (e.code === 'ArrowLeft') set(Math.max(0, Math.ceil(cur) - (e.shiftKey ? 30 : 1)));
  });
  const loop = now => { if (playing) { const v = f0 + (now - t0) / 1000 * FPS; if (v >= N - 1) { playing = false; play.textContent = 'Play'; set(N - 1); } else set(v); } requestAnimationFrame(loop); };
  set(cur); requestAnimationFrame(loop);
}
