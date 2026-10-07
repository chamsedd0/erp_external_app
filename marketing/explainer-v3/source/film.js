// Shadow by Octagon9 — vertical explainer (1080×1920, 60 fps, 37 s). Client order: versions → supported applications → one example.
// Every frame is a pure function of the frame number: window.__seek(frame, j, n) paints it (render.mjs; j/n = motion-blur + lens sample).
// Layers, back to front: #bg (ink / pale / brand) · #scene (portal light + WebGL device) · #flat (app + Odoo panels, pointer,
// touch) · #type (headlines, brand id, version nodes) · #fx (portal close + logo mark) · #end (tagline).
import { createDevice, PHONE } from './device.js';
import * as UI from './ui.js';

const Q = new URLSearchParams(location.search);
const RENDER = Q.has('render');
document.body.classList.toggle('render', RENDER);
document.body.classList.toggle('debug', Q.has('debug'));
document.body.classList.toggle('safe', Q.has('safe'));
const W = 1080, H = 1920;
const BOX = { x0: 138, x1: 942, y0: 240, y1: 1500 };  // centred content column; essential text stays inside (store / social player overlays)
const CX = (BOX.x0 + BOX.x1) / 2;

const TL = await (await fetch('../timeline.json')).json();
const EV = TL.events, FPS = TL.fps, N = TL.durationFrames;
const COPY = Object.fromEntries(TL.copy.map(c => [c.id, c]));
const SHOT = Object.fromEntries(TL.shots.map(s => [s.name, s]));
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
  headIn: bez(0.23, 1, 0.32, 1),           // headline arrival
  reframe: bez(0.77, 0, 0.175, 1),         // product reframing
  land: bez(0.3, 0.05, 0.08, 1),           // device reveal: long deceleration, no overshoot
  out: bez(0.55, 0, 0.9, 0.5),             // departures
  scroll: bez(0.3, 0.1, 0.2, 1),           // a finger flick decelerating
  glide: bez(0.42, 0, 0.58, 1),            // a slow, steady browse
  close: bez(0.6, 0.05, 0.35, 1),          // portal close: slow while the doorway is large (its floor crosses a tall frame), long settle
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
bgInk.style.setProperty('--lx', '50%'); bgInk.style.setProperty('--ly', '60%');
const dev = await createDevice(glc, { width: W, height: H, pixelRatio: 2, texture: '../assets/screens/dashboard@5x.png' });
const tanV = Math.tan(dev.camera.fov * Math.PI / 360), aspect = W / H;
function framing(px, py, hr) {               // straight-on: phone centre at (px, py), phone height = hr × frame height
  const d = PHONE.h / (hr * 2 * tanV), nx = px / W * 2 - 1, ny = 1 - py / H * 2;
  const x = -nx * d * tanV * aspect, y = -ny * d * tanV;
  return { cam: [x, y, d], target: [x, y, 0] };
}

/* ── layout (frame px; UI scale k = frame px per app pt) ───────────────── */
const L = {
  head: 88, headX: BOX.x0, headY: 262, headYBrand: 336, brandY: 244,
  macro0: { cam: [58, 136, 268], target: [2, 62, 0], rot: [14, -31, -8] },
  macro1: { cam: [52, 126, 276], target: [1, 58, 0], rot: [12, -21, -6] },
  portalAim: { at: [4, 36], dist: 700 }, aperture: 1.6, focus: [4, 50, 4.06],
  heroPx: [540, 1212], heroH: 0.5, heroRot: [1.5, -5, 0],
  nodeAngles: [140, 115, 90, 65, 40],
  hubK: 2.35, hubX: BOX.x0, hubCardY: 548, hubMask: [468, 532], hubEndY: 1500,
  formK: 2.25, formX: BOX.x0, formSel: 530, formMask: [490, 526], submitY: 1190,
  toastK: 2.35, toastY: 690,
  odooK: 2.6, odooW: 310, odooTop: 446,
  inboxK: 2.28, inboxH1: 548,
  lockScale: 0.83, lockY: 786, tagSize: 68, tagY: 1000,
};
L.hero = { ...framing(L.heroPx[0], L.heroPx[1], L.heroH), rot: L.heroRot };
const ARCH = (() => {                       // the portal light around the landed hero; it also carries the version nodes
  const ph = L.heroH * H, pw = ph * PHONE.w / PHONE.h, [hx, hy] = L.heroPx;
  const R = pw * 0.8, cy = hy - ph / 2 - ph * 0.08 + R;
  return { hx, cy, R, base: H + 60 };
})();

/* ── headlines ─────────────────────────────────────────────────────────── */
function head(id, cls, y) {
  const c = COPY[id], h = el('div', 'head ' + cls, null, type);
  h.style.fontSize = L.head + 'px'; h.style.top = y + 'px'; h.style.left = L.headX + 'px';
  h._lines = c.lines.map(t => el('span', 'ln', t, h)); h._c = c;
  return h;
}
function runHead(h, f) {
  const ins = h._c.in, out = h._c.out;
  if (!vis(h, f >= ins[0] - 1 && f < out + 16)) return;
  h._lines.forEach((ln, i) => {
    const a = P(f, ins[i], ins[i] + 22, E.headIn), d = P(f, out + 2 * i, out + 2 * i + 12, E.out);
    ln.style.opacity = (a * (1 - d)).toFixed(3);
    ln.style.transform = `translate3d(0, ${f2((1 - a) * 32 - d * 10)}px, 0)`;
  });
}
const HEADS = [head('promise', 'dark', L.headYBrand), head('versions', 'dark', L.headYBrand), head('install', 'dark', L.headYBrand),
  head('apps', 'light', L.headY), head('request', 'light', L.headY), head('odoo', 'light', L.headY), head('status', 'light', L.headY)];

// brand identifier (shots 01–02): the mark, the name, the byline
const ICON_SVG = `<svg width="58" height="58" viewBox="0 0 400 400" style="flex:none"><defs><linearGradient id="bi" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#2A5FD4"/><stop offset=".55" stop-color="#4F8EF7"/><stop offset="1" stop-color="#89BFFF"/></linearGradient></defs>
  <path d="M 60 388 L 60 228 A 140 140 0 0 1 340 228 L 340 388" fill="none" stroke="url(#bi)" stroke-width="30" stroke-linecap="round"/>
  <line x1="38" y1="388" x2="362" y2="388" stroke="#3B74E0" stroke-width="20" stroke-linecap="round" opacity=".85"/><circle cx="200" cy="88" r="13" fill="#fff"/></svg>`;
const brandId = el('div', 'brandmark', `${ICON_SVG}<span class="bt"><span class="bn">${TL.brand.name}</span><span class="bb">${TL.brand.byline.replace(/^by /, '<i>by</i> ')}</span></span>`, type);
brandId.style.left = L.headX + 'px'; brandId.style.top = L.brandY + 'px';

/* ── the portal as a light standing behind the hero; in shot 02 it carries the Odoo versions ── */
const archLight = $('#archlight');
archLight.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>
  <linearGradient id="alg" gradientUnits="userSpaceOnUse" x1="0" x2="0"><stop offset="0" stop-color="#2A5FD4"/><stop offset=".55" stop-color="#4F8EF7"/><stop offset="1" stop-color="#89BFFF"/></linearGradient>
  <filter id="alf" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="30"/></filter></defs>
  <path id="alp1" fill="none" stroke="#4F8EF7" stroke-width="26" stroke-linecap="round" opacity="0.32" filter="url(#alf)"/>
  <path id="alp2" fill="none" stroke="url(#alg)" stroke-width="5" stroke-linecap="round"/></svg>`;
{ const { hx, cy, R, base } = ARCH, d = `M ${hx - R} ${base} L ${hx - R} ${cy} A ${R} ${R} 0 0 1 ${hx + R} ${cy} L ${hx + R} ${base}`;
  $('#alp1').setAttribute('d', d); $('#alp2').setAttribute('d', d);
  $('#alg').setAttribute('y1', base); $('#alg').setAttribute('y2', cy - R); }
// version nodes: one per supported Odoo major version, on the arch, labelled outside it
const nodes = TL.versions.map((v, i) => {
  const a = L.nodeAngles[i] * Math.PI / 180, x = ARCH.hx + ARCH.R * Math.cos(a), y = ARCH.cy - ARCH.R * Math.sin(a);
  const n = el('div', 'vnode', `<i></i><b>${v}</b>`, type);
  n.style.left = f2(x) + 'px'; n.style.top = f2(y) + 'px';
  const lb = n.querySelector('b'), r = 64;             // label pushed out along the arch normal
  lb.style.left = f2(Math.cos(a) * r) + 'px'; lb.style.top = f2(-Math.sin(a) * r) + 'px';
  n._dot = n.querySelector('i'); n._lb = lb; n._in = EV['node' + v]; n._a = a;
  return n;
});

/* ── flat UI panels (pale studio) ──────────────────────────────────────── */
const scrDash = UI.dashboardScreen(), scrForm = UI.timeOffScreen(), scrHub = UI.hubScreen(), scrHub2 = UI.hubScreen(), scrInbox = UI.inboxScreen();
const odoo = UI.odooRecord();
odoo.root.style.width = L.odooW + 'px'; odoo.root.classList.add('narrow');
const panels = {};
const blank = el('div', 'app');            // the screen's own background: content dissolves through it, never through another screen
for (const [k, e] of Object.entries({ blank, dash: scrDash.root, apps: scrHub.root, form: scrForm.root, hub: scrHub2.root, inbox: scrInbox.root, odoo: odoo.root })) {
  panels[k] = el('div', 'panel', null, flat); panels[k].appendChild(e); vis(panels[k], false);
}
panels.hub.classList.add('bare'); panels.inbox.classList.add('bare');        // the OS status bar belongs to the device, not the studio
scrForm.toast.remove(); scrHub.toast.remove();
scrHub.title.style.visibility = 'hidden';                                       // the film headline stands in for the hub's own title
const pointer = el('div', null, UI.POINTER, flat); pointer.id = 'pointer'; vis(pointer, false);
const touch = el('div', 'touch', null, flat); vis(touch, false);                // one fingertip contact, 44 pt
function place(p, k, tx, ty, a = 1) {
  if (!vis(p, a > 0.002)) return;
  p.style.transform = `translate3d(${f2(tx)}px, ${f2(ty)}px, 0) scale(${k.toFixed(5)})`;
  op(p, a);
}
// soft vertical mask in panel pt: transparent above y0, opaque from y1, optional bottom fade
function mask(p, y0, y1, b0 = 1e5, b1 = 1e5 + 1) {
  const m = `linear-gradient(to bottom, transparent ${y0.toFixed(1)}px, #000 ${y1.toFixed(1)}px, #000 ${b0.toFixed(1)}px, transparent ${b1.toFixed(1)}px)`;
  if (p._m !== m) { p.style.webkitMaskImage = m; p.style.maskImage = m; p._m = m; }
}
function touchAt(x, y, k, a, grow) {
  if (!vis(touch, a > 0.002)) return;
  touch.style.transform = `translate3d(${f2(x)}px, ${f2(y)}px, 0) scale(${(k * grow).toFixed(4)})`; op(touch, a);
}

/* ── end card: portal close → the mark, "Shadow", "by Octagon9" ─────────── */
const WM = await (await fetch('../assets/logo/wordmark-v3.json')).json();
// canonical mark (logo units): arch centre (200,228) r 140, legs to 388, base 38–362, apex dot (200,88) r 13
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
    <filter id="dglow" x="-300%" y="-300%" width="700%" height="700%"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <linearGradient id="sepg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4F8EF7" stop-opacity="0"/><stop offset=".35" stop-color="#4F8EF7" stop-opacity=".5"/><stop offset=".65" stop-color="#4F8EF7" stop-opacity=".5"/><stop offset="1" stop-color="#4F8EF7" stop-opacity="0"/></linearGradient>
  </defs>
  <g id="darkg" mask="url(#hole)"><rect width="${W}" height="${H}" fill="url(#bgg)"/></g>
  <rect id="inside" width="${W}" height="${H}" fill="url(#bgg)"/>
  <rect id="backdropr" width="${W}" height="${H}" fill="url(#backdrop)"/>
  <path id="pglowp" fill="none" stroke="#4F8EF7" stroke-linecap="round" filter="url(#pglow)"/>
  <path id="parch" fill="none" stroke="url(#pg)" stroke-linecap="round"/>
  <line id="pbase" stroke="#3B74E0" stroke-linecap="round"/>
  <circle id="pdot" fill="#FFFFFF" filter="url(#dglow)"/>
  <line id="psep" stroke="url(#sepg)" stroke-width="${(1.5 * s).toFixed(2)}"/>
  <path id="wm1" fill="#FFFFFF" d="${WM.shadow}"/><g id="wm2"><path fill="#94A3B8" d="${WM.by}"/><path fill="#4F8EF7" d="${WM.octagon9}"/></g>
</svg>`;
const holeP = $('#holep'), darkG = $('#darkg'), pArch = $('#parch'), pGlow = $('#pglowp'), pBase = $('#pbase'), pDot = $('#pdot'), pSep = $('#psep');
const pGrad = $('#pg'), backdrop = $('#backdrop'), backdropR = $('#backdropr'), inside = $('#inside'), pGlowB = $('#pglowb'), wm1 = $('#wm1'), wm2 = $('#wm2');
const tag = el('div', 'tagline', TL.brand.tagline.join('<br>'), endL);
tag.style.fontSize = L.tagSize + 'px';

/* ── measured geometry (after fonts) ───────────────────────────────────── */
const M = {};
let LOCK, SR, K0, ZS, ZA;
function measure() {
  for (const h of HEADS) {                   // keep every headline inside the critical box
    const w = Math.max(...h._lines.map(l => l.offsetWidth));
    if (w > BOX.x1 - BOX.x0) h.style.fontSize = f2(L.head * (BOX.x1 - BOX.x0) / w - 0.3) + 'px';
  }
  const r = scrForm.root;
  M.formSel = offsetIn(scrForm.type, r).y;
  M.formSubmit = offsetIn(scrForm.submit, r).y + scrForm.submit.offsetHeight / 2;
  M.submitX = offsetIn(scrForm.submit, r).x + scrForm.submit.offsetWidth / 2;
  const c = scrHub.cards, top = e => offsetIn(e, scrHub.root).y;
  M.hubCard0 = top(c.timeoff); M.hubCardH = c.timeoff.offsetHeight;
  M.hubEnd = top(c.maintenance) + c.maintenance.offsetHeight;
  M.toastY = offsetIn(scrHub2.toast, scrHub2.root).y + scrHub2.toast.offsetHeight / 2;
  M.hubFade = offsetIn(scrHub2.cards.timeoff, scrHub2.root).y + 30;
  M.odooW = odoo.root.offsetWidth;
  const ab = odoo.approve, ao = offsetIn(ab, odoo.root);
  M.approve = { x: ao.x + ab.offsetWidth * 0.42, y: ao.y + ab.offsetHeight * 0.55 };
  M.inboxH1 = offsetIn(scrInbox.root.querySelector('.inbox-head h1'), scrInbox.root).y;
  M.todayH = scrInbox.todayIn.offsetHeight;
  M.tagW = tag.offsetWidth;
  // lockup box from the artwork: mark (base line caps, arch stroke) + outlined wordmark and byline
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
  } else {                                  // pull back to the hero, then still
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
// the device → flat-UI hand-off is one push-in: a scale about a fixed point that ends on the hub framing
function zoomAt(f) {
  const sc = Math.pow(ZS, P(f, EV.enterScreenStart, EV.enterScreenEnd, E.reframe));
  return { s: sc, tx: ZA[0] * (1 - sc), ty: ZA[1] * (1 - sc) };
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

  // ── 01 open + 02 versions: the device, the portal light, the version nodes
  const z = f >= EV.enterScreenStart ? zoomAt(f) : { s: 1, tx: 0, ty: 0 };
  const sceneOn = vis(scene, f < sw + 14);
  const al = P(f, EV.archLightIn, EV.cameraLand, E.sine) * (1 - P(f, EV.enterScreenStart, EV.frontal, E.sine));
  if (vis(archLight, sceneOn && al > 0.002)) op(archLight, al);      // children must be hidden explicitly
  if (sceneOn) {
    dev.render(deviceState(f));
    scene.style.transform = z.s === 1 ? '' : `translate(${f2(z.tx)}px, ${f2(z.ty)}px) scale(${z.s.toFixed(5)})`;
    op(glc, 1 - P(f, sw, sw + 12, E.sine));
  }
  const nodesOut = P(f, COPY.install.out, COPY.install.out + 12, E.out);
  for (const n of nodes) {
    const a = spring((f - n._in) / FPS, 4.2, 0.62);                  // a small, motivated feedback element may overshoot a little
    if (!vis(n, f >= n._in && nodesOut < 0.999)) continue;
    n._dot.style.transform = `translate(-50%, -50%) scale(${clamp(a, 0, 1.3).toFixed(4)})`;
    const la = P(f, n._in + 1, n._in + 15, E.headIn);
    n._lb.style.transform = `translate(-50%, -50%) translate(${f2(Math.cos(n._a) * (la - 1) * 16)}px, ${f2(-Math.sin(n._a) * (la - 1) * 16)}px)`;
    n._lb.style.opacity = (la * (1 - nodesOut)).toFixed(3); n._dot.style.opacity = (1 - nodesOut).toFixed(3);
  }
  const bi = P(f, EV.brandIdIn, EV.brandIdIn + 22, E.headIn) * (1 - P(f, EV.brandIdOut - 12, EV.brandIdOut, E.out));
  if (vis(brandId, bi > 0.002)) { op(brandId, bi); brandId.style.transform = `translate3d(0, ${f2((1 - bi) * 20)}px, 0)`; }

  // ── 03 applications: the device's screen hands off to the app's own "New Request" hub — six cards, one scroll
  const hubTx = L.hubX - 24 * L.hubK, hubTy = L.hubCardY - M.hubCard0 * L.hubK;
  const appsOn = f >= sw && f < EV.formIn;
  if (f >= sw && f < EV.enterScreenEnd) {    // hand-off: the DOM screen sits exactly on the rendered screen, then rides the push-in
    const k = z.s * K0, tx = z.s * SR.x + z.tx, ty = z.s * SR.y + z.ty;
    place(panels.blank, k, tx, ty);
    place(panels.dash, k, tx, ty, 1 - P(f, sw, sw + 5, E.sine));       // dashboard content clears…
    place(panels.apps, k, tx, ty, P(f, sw + 5, sw + 11, E.sine));      // …then the hub arrives
  } else {
    vis(panels.blank, false); vis(panels.dash, false);
    if (appsOn) place(panels.apps, L.hubK, hubTx, hubTy); else vis(panels.apps, false);
  }
  if (appsOn) {
    const hm = y => (y - hubTy) / L.hubK;    // frame y → hub pt
    mask(panels.apps, hm(L.hubMask[0]), hm(L.hubMask[1]));
    const total = (M.hubEnd - M.hubCard0) - (L.hubEndY - L.hubCardY) / L.hubK;   // brings Maintenance up to hubEndY
    const sc = total * (P(f, EV.hubScrollStart, EV.hubScrollEnd, E.glide) - P(f, EV.hubFlickStart, EV.hubFlickEnd, E.reframe));
    scrHub.scroller.style.transform = `translate3d(0, ${f2(-sc)}px, 0)`;
    const pressed = f >= EV.tapTimeOff && f < EV.tapTimeOffRelease + 4;
    op(scrHub.cards.timeoff, pressed ? 0.9 : 1);                       // TouchableOpacity activeOpacity 0.9
    const tIn = P(f, EV.tapTimeOff - 3, EV.tapTimeOff, E.sine), tOut = P(f, EV.tapTimeOffRelease, EV.tapTimeOffRelease + 7, E.sine);
    touchAt(hubTx + 232 * L.hubK, L.hubCardY + M.hubCardH * 0.47 * L.hubK, L.hubK, f >= EV.tapTimeOff - 3 ? tIn * (1 - tOut) : 0, 0.85 + 0.15 * tIn + 0.2 * tOut);
  }

  // ── 04 the example: a time-off request. One scroll to the button, one press, the real loading state
  const formTx = L.formX - 24 * L.formK, formTy = L.formSel - M.formSel * L.formK;
  if (f >= EV.formIn && f < EV.toastIn) {
    place(panels.form, L.formK, formTx, formTy);
    const fm = y => (y - formTy) / L.formK;
    mask(panels.form, fm(L.formMask[0]), fm(L.formMask[1]));
    const scrollPt = (M.formSubmit - M.formSel) - (L.submitY - L.formSel) / L.formK;
    scrForm.scroller.style.transform = `translate3d(0, ${f2(-scrollPt * P(f, EV.formScrollStart, EV.formScrollEnd, E.scroll))}px, 0)`;
    const loading = f >= EV.submitRelease;
    scrForm.submit.style.transform = `scale(${buttonScale(f).toFixed(5)})`;
    op(scrForm.submit, loading ? 0.5 : 1);    // disabled={loading} → Button opacity × 0.5
    if (scrForm._loading !== loading) {
      scrForm._loading = loading;
      scrForm.submitLabel.innerHTML = loading ? '<span class="spinner"></span>' : 'Submit Request';
    }
    if (loading) scrForm.submitLabel.firstChild.style.transform = `rotate(${f2(((f - EV.submitRelease) * 13.5) % 360)}deg)`;
    const tIn = P(f, EV.submitPress - 3, EV.submitPress, E.sine), tOut = P(f, EV.submitRelease, EV.submitRelease + 7, E.sine);
    touchAt(formTx + (M.submitX + 104) * L.formK, L.submitY + 4 * L.formK, L.formK, f >= EV.submitPress - 3 ? tIn * (1 - tOut) : 0, 0.85 + 0.15 * tIn + 0.2 * tOut);
  } else vis(panels.form, false);
  if (f >= EV.tapTimeOffRelease + 8 && !(f >= EV.submitPress - 3 && f < EV.toastIn)) vis(touch, false);
  if (f < EV.tapTimeOff - 3) vis(touch, false);
  // result: the app returns to its hub and shows the success toast (no entry animation in toast-context.tsx)
  if (f >= EV.toastIn && f < EV.recordIn + 12) {
    const k = L.toastK;
    place(panels.hub, k, CX - 195 * k, L.toastY - M.toastY * k, 1 - P(f, EV.recordIn, EV.recordIn + 12, E.sine));
    mask(panels.hub, -2, -1, M.hubFade, M.hubFade + 150);          // keep the eye on the toast: the hub's cards recede
  } else vis(panels.hub, false);

  // ── 05 the same request as an Odoo record; the manager approves it there
  if (f >= EV.recordIn && f < EV.inboxCut) {
    const k = L.odooK, a = P(f, EV.recordIn, EV.recordIn + 12, E.sine);
    const settle = P(f, EV.recordIn, EV.recordSettled, E.headIn);
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
    const ptx = lerp(px + 330, px, pin) + away * 150, pty = lerp(py + 520, py, pin) + away * 190;
    const pa = P(f, EV.pointerIn, EV.pointerIn + 8) * (1 - P(f, EV.inboxCut - 12, EV.inboxCut));
    if (vis(pointer, f >= EV.pointerIn && pa > 0.002)) {
      const ps = k / 1.7 * (f >= EV.approvePress && f < EV.approveRelease ? 0.94 : 1);
      pointer.style.transform = `translate3d(${f2(ptx - 2)}px, ${f2(pty - 2)}px, 0) scale(${ps.toFixed(4)})`;
      op(pointer, pa);
    }
  } else { vis(panels.odoo, false); vis(pointer, false); }

  // ── 06 the employee's Inbox: the approval arrives as the Today group (notifications.tsx groups by day)
  if (f >= EV.inboxCut && f < EV.portalClosed + 4) {
    const k = L.inboxK, tx = CX - 195 * k, ty = L.inboxH1 - M.inboxH1 * k;
    let zk = k, ztx = tx, zty = ty;          // inside the closing portal the app recedes with it (farther than the doorway)
    if (f >= EV.portalCloseStart) {
      const pc = portal(f), g = Math.pow(pc.R / pc.R0, 0.62);
      zk = k * g; ztx = pc.cx + (tx - pc.cx0) * g; zty = pc.cy + (ty - pc.cy0) * g;
    }
    place(panels.inbox, zk, ztx, zty);
    mask(panels.inbox, M.inboxH1 - 30, M.inboxH1 - 6, 640, 720);
    const ins = spring((f - EV.notificationIn) / FPS, 2.6, 0.96);
    scrInbox.todayWrap.style.height = f2(M.todayH * clamp(ins, 0, 1.02)) + 'px';
    scrInbox.item.style.transform = `translate3d(0, ${f2((1 - ins) * -14)}px, 0)`;
    op(scrInbox.todayIn, P(f, EV.notificationIn + 2, EV.notificationIn + 14, E.sine));
    scrInbox.unread.textContent = f >= EV.notificationIn ? '1 unread message' : '0 unread messages';
  } else vis(panels.inbox, false);

  for (const h of HEADS) runHead(h, f);
  paintEnd(f);
  if (!RENDER) $('#dbg').textContent = `${f.toFixed(1)} · ${(f / FPS).toFixed(2)} s`;
}

// portal geometry at frame f: it first appears as a frame around the app, then closes onto the mark
function portal(f) {
  const u = P(f, EV.portalCloseStart, EV.portalClosed, E.close);
  const Rf = MARK.R * s, cxf = LX(MARK.cx), cyf = LY(MARK.cy);
  const R0 = W * 0.85, cx0 = W / 2, cy0 = R0 + 120;     // legs and floor start outside the frame
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
  op(inside, ins); vis(inside, ins > 0.002);
  // logo backdrop glow: the source SVG's objectBoundingBox radial (cx 20%, cy 48%, r 22% of 1600×480) → an ellipse
  const bx = X(320), by = Y(230.4);
  backdrop.setAttribute('cx', f2(bx)); backdrop.setAttribute('cy', f2(by)); backdrop.setAttribute('r', f2(352 * k));
  backdrop.setAttribute('gradientTransform', `translate(${f2(bx)} ${f2(by)}) scale(1 0.3) translate(${f2(-bx)} ${f2(-by)})`);
  op(backdropR, ins); vis(backdropR, ins > 0.002);
  // apex light: the sonic signature's visual partner
  const dot = P(f, EV.apexLight - 3, EV.apexLight + 9, E.headIn);
  pDot.setAttribute('cx', f2(X(MARK.cx))); pDot.setAttribute('cy', f2(Y(MARK.dotY))); pDot.setAttribute('r', f2(MARK.dotR * k * dot));
  op(pDot, 0.95 * P(f, EV.apexLight - 3, EV.apexLight + 1));
  // name, byline, tagline — then a still hold to the last frame
  vis(endL, f >= EV.taglineIn - 1);
  const wa = P(f, EV.wordmarkIn, EV.wordmarkIn + 24, E.headIn), wb = P(f, EV.bylineIn, EV.bylineIn + 24, E.headIn);
  const tr = d => `translate(${f2(LOCK.ox)} ${f2(LOCK.oy + d)}) scale(${s})`;
  wm1.setAttribute('transform', tr((1 - wa) * 26)); op(wm1, wa);
  wm2.setAttribute('transform', tr((1 - wb) * 22)); op(wm2, wb);
  const sp = P(f, EV.wordmarkIn - 4, EV.wordmarkIn + 20, E.headIn);
  pSep.setAttribute('x1', f2(LX(MARK.sep))); pSep.setAttribute('x2', f2(LX(MARK.sep)));
  pSep.setAttribute('y1', f2(LY(240 - 240 * sp))); pSep.setAttribute('y2', f2(LY(240 + 240 * sp)));
  const ta = P(f, EV.taglineIn, EV.taglineIn + 24, E.headIn);
  tag.style.transform = `translate3d(${f2(CX - M.tagW / 2)}px, ${f2(L.tagY + (1 - ta) * 28)}px, 0)`; op(tag, ta);
}

/* ── boot ──────────────────────────────────────────────────────────────── */
await Promise.all(['500 40px Outfit', '600 40px Outfit', '700 40px Outfit', '400 40px "DM Sans"', '500 40px "DM Sans"', '700 40px "DM Sans"'].map(fc => document.fonts.load(fc)));
await document.fonts.ready;
measure();
dev.aimPortal(deviceState(6), ...L.portalAim.at, L.portalAim.dist);     // the portal stands on the opening's mirror ray
// the frontal pose's projected screen: where the DOM screen must sit at the swap
dev.render(deviceState(EV.screenSwap));
SR = dev.screenRect(W, H); K0 = SR.w / 390;
{ const tx = L.hubX - 24 * L.hubK, ty = L.hubCardY - M.hubCard0 * L.hubK;
  ZS = L.hubK / K0;
  const t = [tx - SR.x * ZS, ty - SR.y * ZS];
  ZA = [t[0] / (1 - ZS), t[1] / (1 - ZS)]; }
if (!RENDER) {
  Object.assign($('#safe').style, { left: BOX.x0 + 'px', top: BOX.y0 + 'px', width: (BOX.x1 - BOX.x0) + 'px', height: (BOX.y1 - BOX.y0) + 'px' });
  const fit = () => { stage.style.transform = `scale(${Math.min(innerWidth / W, (innerHeight - 56) / H)}) translate(-50%, -50%)`; };
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
const MB = [[0, EV.cameraPullStart, 20], [EV.cameraPullStart, EV.cameraPullStart + 44, 16], [EV.cameraPullStart + 44, EV.cameraLand + 6, 12],
  [EV.node15 - 1, EV.node19 + 20, 4], [EV.enterScreenStart - 4, EV.enterScreenEnd + 4, 18],
  [EV.hubScrollStart, EV.hubScrollEnd, 6], [EV.hubFlickStart - 1, EV.hubFlickEnd + 2, 16],
  [EV.formScrollStart - 1, EV.formScrollEnd + 2, 14], [EV.submitPress, EV.submitRelease + 16, 6],
  [EV.recordIn, EV.recordSettled + 2, 6], [EV.pointerIn, EV.approveRelease + 32, 8], [EV.notificationIn, EV.notificationSettled + 4, 8],
  [EV.portalCloseStart, EV.portalClosed + 2, 20], [EV.wordmarkIn - 4, EV.lockupComplete + 2, 8]];
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
