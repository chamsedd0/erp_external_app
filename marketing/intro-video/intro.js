/* Shadow Portal — marketing intro. 1920×1080 · 60 fps · 19 s.
   Every pixel is a pure function of time: window.__seek(t) paints frame t (render.mjs drives it).
   Beat grid: 120 BPM (1 beat = 0.5 s); drop at 4.0 s, logo hit at 16.0 s. */
(() => {
'use strict';

const Q = new URLSearchParams(location.search);
const VERT = Q.get('format') === 'vertical';        // 9:16 cut for Reels / Shorts / TikTok / Stories
const W = VERT ? 1080 : 1920, H = VERT ? 1920 : 1080, DURATION = 19;
const CTA_TEXT = 'Coming soon to iOS & Android';
const RENDER = Q.has('render');
if (RENDER) document.body.classList.add('render');
if (Q.has('debug')) document.body.classList.add('debug');

/* ═══════════════════════ math ═══════════════════════ */
const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const lerp = (a, b, p) => a + (b - a) * p;
const inv = (a, b, x) => clamp((x - a) / (b - a));
const smooth = (a, b, x) => { const p = inv(a, b, x); return p * p * (3 - 2 * p); };
const E = {
  lin: p => p,
  inQuad: p => p * p, outQuad: p => 1 - (1 - p) * (1 - p),
  inCubic: p => p ** 3, outCubic: p => 1 - (1 - p) ** 3,
  inOutCubic: p => p < .5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2,
  inQuart: p => p ** 4, outQuart: p => 1 - (1 - p) ** 4,
  inOutQuart: p => p < .5 ? 8 * p ** 4 : 1 - (-2 * p + 2) ** 4 / 2,
  inQuint: p => p ** 5, outQuint: p => 1 - (1 - p) ** 5,
  inExpo: p => p <= 0 ? 0 : 2 ** (10 * p - 10), outExpo: p => p >= 1 ? 1 : 1 - 2 ** (-10 * p),
  inOutSine: p => -(Math.cos(Math.PI * p) - 1) / 2,
  outBack: p => { const s = 1.70158; return 1 + (s + 1) * (p - 1) ** 3 + s * (p - 1) ** 2; },
  inBack: p => { const s = 1.4; return (s + 1) * p ** 3 - s * p * p; },
};
function bez(x1, y1, x2, y2) {           // CSS cubic-bezier()
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  return p => {
    if (p <= 0) return 0; if (p >= 1) return 1;
    let t = p;
    for (let i = 0; i < 10; i++) {
      const x = ((ax * t + bx) * t + cx) * t - p, d = (3 * ax * t + 2 * bx) * t + cx;
      if (Math.abs(x) < 1e-7 || Math.abs(d) < 1e-7) break;
      t = clamp(t - x / d);
    }
    return ((ay * t + by) * t + cy) * t;
  };
}
E.snap = bez(0.75, 0, 0.12, 1);   // decisive in-out
E.swift = bez(0.25, 0.1, 0, 1);   // fast start, long settle
E.whip = bez(0.85, 0, 0.15, 1);   // whip pan
// Damped spring step response (seconds elapsed) — same physics as RN Animated.spring
function spring(dt, k = 170, c = 18) {
  if (dt <= 0) return 0;
  const w0 = Math.sqrt(k), z = c / (2 * w0);
  if (z < 1) { const wd = w0 * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w0 * dt) * (Math.cos(wd * dt) + (z * w0 / wd) * Math.sin(wd * dt)); }
  return 1 - Math.exp(-w0 * dt) * (1 + w0 * dt);
}
const P = (t, a, b, e = E.lin) => e(inv(a, b, t));
function rng(seed) { return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const f2 = v => (Math.abs(v) < 1e-4 ? 0 : v).toFixed(2);

/* ═══════════════════════ brand ═══════════════════════ */
const C = {
  info: '#3b82f6', success: '#10b981', warning: '#f59e0b', error: '#ef4444',
  indigo: '#6366F1', sky: '#0EA5E9', violet: '#8B5CF6', amber: '#F59E0B',
  blue: '#4F8EF7', blueLight: '#89BFFF', blueDeep: '#2A5FD4', base: '#3B74E0', muted: '#a1a1aa',
};
const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
const RN = (hex, sfx) => hexA(hex, parseInt(sfx, 16) / 255);     // RN "color + '18'" alpha suffix
const ico = (n, s = 24, c = 'currentColor', w = 2) =>
  `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${ICONS[n]}</svg>`;
function el(tag, cls, html, parent) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (parent) parent.appendChild(e); return e; }
const $ = (s, r = document) => r.querySelector(s);
function measure(e) { e._w = e.offsetWidth; e._h = e.offsetHeight; return e; }
function offsetIn(e, anc) { let x = 0, y = 0; while (e && e !== anc) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; } return { x, y }; }
// place an .abs element's centre at stage (x,y,z)
function place(e, o) {
  const { x = 0, y = 0, z = 0, s = 1, rx = 0, ry = 0, rz = 0, op = 1, blur = 0 } = o;
  const vis = op > 0.002;
  if (e._vis !== vis) { e.style.visibility = vis ? 'visible' : 'hidden'; e._vis = vis; }
  if (!vis) return;
  e.style.transform = `translate3d(${f2(x - e._w / 2)}px,${f2(y - e._h / 2)}px,${f2(z)}px) rotateX(${f2(rx)}deg) rotateY(${f2(ry)}deg) rotateZ(${f2(rz)}deg) scale(${s.toFixed(4)})`;
  e.style.opacity = op >= 0.999 ? '' : op.toFixed(3);
  e.style.filter = blur > 0.08 ? `blur(${blur.toFixed(2)}px)` : '';
}
function show(e, on) { if (e._vis !== on) { e.style.visibility = on ? 'visible' : 'hidden'; e._vis = on; } }
// wrappers must use display: a child with visibility:visible would still paint inside a hidden parent
function showL(e, on) { if (e._disp !== on) { e.style.display = on ? '' : 'none'; e._disp = on; } }

/* ═══════════════════════ timeline (seconds) ═══════════════════════ */
const T = {
  dot: 1.0, drawA: 1.0, drawB: 1.72, baseA: 1.3, baseB: 1.82,
  suckA: 1.36, suckGap: 0.058, suckDur: 0.56,
  hlA: 2.5, hlB: 3.0,
  flyA: 3.42, pass: 4.0,
  phoneIn: 3.92,
  dashHl: 4.42, tapTO: 5.55, pushTO: 5.72, toHl: 5.98,
  toFrom: 6.28, toTo: 6.44, toReq: 6.6, toScroll: 6.78, tapSubmit: 7.28, toToast: 7.5,
  whip1: 7.82, exHl: 7.98, exAmt: 8.3, exCat: 8.62, exScroll: 8.84, exSnap: 9.08, tapClaim: 9.4, exToast: 9.55,
  whip2: 9.82, lockNotif: 10.28, breakout: 10.55, noHl: 10.0,
  grid: 11.84, gridHl: 12.02, cards: 12.0, chips: 12.9,
  odoo: 13.84, odooHl: 14.0, beam1: 14.3, approve: 14.92, beam2: 15.0, odooChips: 14.5,
  out: 15.45, end: 16.0, shine: 17.2, glint: 17.55, fade: 18.62,
};

/* ═══════════════════════ portal geometry ═══════════════════════
   Portal units: arc centre (0,0), radius 1, legs down to LEG, threshold line ±BASE (from shadow-portal-icon.svg) */
const LEG = 270 / 228, BASE = 268 / 228, STROKE = 46 / 228, BASE_W = 32 / 228, DOT_R = 20 / 228, FOCUS_Y = 0.25;
const R0 = VERT ? 232 : 205;                    // arch radius (px) when the camera sits at distance 1
const VP1 = VERT ? { x: 540, y: 760 } : { x: 960, y: 471 };   // Act I vanishing point = doorway centre
// End-card lockup (shadow-portal-logo.svg units → stage); the vertical cut stacks the arch above the wordmark
const LS = VERT ? 1.26 : 0.92;
const LX = VERT ? (u => 540 + (u - 200) * LS) : (u => 960 + (u - 511.5) * LS);
const LY = VERT ? (v => 690 + (v - 228) * LS) : (v => 452 + (v - 237.5) * LS);
const R_END = 140 * LS;
const VP_END = { x: LX(200), y: LY(228) + FOCUS_Y * R_END };
const Z_END = -(R0 / R_END);         // camera distance that makes arch 0 exactly logo-sized
const DZ = 0.85;                     // spacing of the echo arches (tunnel)

function geo(vx, vy, R) { return { vx, vy, R, m: (u, v) => [vx + u * R, vy + (v - FOCUS_Y) * R] }; }
function pathFull(c, G) {
  const [lx, ly] = G.m(-1, LEG), [cx, cy] = G.m(0, 0), [rx, ry] = G.m(1, LEG);
  c.beginPath(); c.moveTo(lx, ly); c.lineTo(lx, cy); c.arc(cx, cy, G.R, Math.PI, 2 * Math.PI); c.lineTo(rx, ry);
}
function pathHalf(c, G, side, d1) {    // from apex, length d1 (portal units) down one side
  const q = Math.PI / 2, [cx, cy] = G.m(0, 0);
  const a1 = -q + side * Math.min(d1, q);
  c.moveTo(...G.m(0, -1));
  c.arc(cx, cy, G.R, -q, a1, side < 0);
  if (d1 > q) c.lineTo(...G.m(side, d1 - q));
}
function tipPoint(G, side, d) {
  const q = Math.PI / 2;
  if (d <= q) { const a = -q + side * d; return G.m(Math.cos(a), Math.sin(a)); }
  return G.m(side, d - q);
}

/* ═══════════════════════ DOM + canvas setup ═══════════════════════ */
const stage = $('#stage'), world = $('#world');
const bgc = $('#bg'), fxc = $('#fx');
const DPR = window.devicePixelRatio || 1;
stage.style.width = W + 'px'; stage.style.height = H + 'px';
world.style.perspectiveOrigin = `${W / 2}px ${Math.round(H * 0.482)}px`;
[bgc, fxc].forEach(c => { c.width = W * DPR; c.height = H * DPR; c.style.width = W + 'px'; c.style.height = H + 'px'; });
const g = bgc.getContext('2d'), f = fxc.getContext('2d');
const off = document.createElement('canvas'); off.width = W * DPR; off.height = H * DPR;
const o2 = off.getContext('2d');

function layer(id) { const e = el('div', 'abs p3d', null, world); e.id = id; e.style.width = W + 'px'; e.style.height = H + 'px'; e._w = W; e._h = H; return e; }
const act1 = layer('act1'), act2 = layer('act2'), endL = layer('end');

/* ═══════════════════════ headline helper ═══════════════════════ */
function headline(parent, cfg) {
  const root = el('div', 'hl' + (cfg.align === 'center' ? ' center' : ''), null, parent);
  root.style.left = cfg.x + 'px'; root.style.top = cfg.y + 'px';
  let over = null;
  if (cfg.over) {
    over = el('div', 'over', `<i></i><span class="m"><span>${cfg.over}</span></span>`, root);
    over.style.color = cfg.accent;
    if (cfg.align === 'center') over.style.justifyContent = 'center';
  }
  const lines = cfg.lines.map((txt, i) => {
    const l = el('div', 'line', txt.split(' ').map(w => `<span class="m"><span>${w}</span></span>`).join(' '), root);
    if (cfg.size) l.style.fontSize = cfg.size + 'px';
    if (cfg.lh) l.style.lineHeight = cfg.lh;
    l._alt = (cfg.alt || []).includes(i);
    return l;
  });
  const h = { root, over, lines, cfg, words: lines.map(l => [...l.querySelectorAll('.m > span')]) };
  return h;
}
function paintGradientWords(h, c1, c2) {           // one continuous gradient across each "alt" line
  h.lines.forEach((l, i) => {
    if (!l._alt) return;
    const lw = l.scrollWidth;
    const lineLeft = l.getBoundingClientRect().left;
    h.words[i].forEach(w => {
      const x = (w.getBoundingClientRect().left - lineLeft) / stageScale;
      Object.assign(w.style, {
        backgroundImage: `linear-gradient(95deg, ${c1}, ${c2})`, backgroundSize: `${lw}px 100%`,
        backgroundPosition: `${-x}px 0`, webkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
      });
    });
  });
}
// reveal words from tIn, leave from tOut
function runHeadline(h, t, tIn, tOut = 1e9, opt = {}) {
  const on = t > tIn - 0.02 && t < tOut + 0.9;
  show(h.root, on);
  if (!on) return;
  const st = opt.stagger ?? 0.055;
  if (h.over) {
    const bar = h.over.firstChild, txt = h.over.querySelector('.m > span');
    const pb = P(t, tIn, tIn + 0.55, E.outExpo) * (1 - P(t, tOut, tOut + 0.26, E.inQuad));
    bar.style.transform = `scaleX(${pb.toFixed(3)})`; bar.style.transformOrigin = h.cfg.align === 'center' ? '50% 50%' : '0 50%';
    const pi = P(t, tIn + 0.04, tIn + 0.75, E.outExpo), po = P(t, tOut, tOut + 0.26, E.inQuad);
    txt.style.transform = `translate3d(0,${f2((1 - pi) * 115 - po * 115)}%,0)`;
  }
  let k = 0;
  h.words.forEach(line => line.forEach(w => {
    const d = tIn + 0.1 + k * st, dOut = tOut + k * 0.022; k++;
    const pi = P(t, d, d + 0.95, E.outExpo), po = P(t, dOut, dOut + 0.26, E.inQuad);
    w.style.transform = `translate3d(0,${f2((1 - pi) * 108 - po * 108)}%,0) rotate(${f2((1 - pi) * 5)}deg)`;
    w.style.transformOrigin = '0 100%';
  }));
}

/* ═══════════════════════ ACT I — the paperwork ═══════════════════════ */
const DOCS = [
  { i: 'mail', c: C.info, a: 'Re: Fwd: Re: Day off Friday?', b: 'HR Team · no reply for 3 days', x: 1500, y: 215, z: 40, rz: 6, ry: -16, badge: '14' },
  { i: 'file-text', c: C.error, a: 'Leave_Request_FINAL_v3.pdf', b: 'Print · sign · scan · email', x: 400, y: 248, z: -60, rz: -7, ry: 18 },
  { i: 'receipt', c: C.warning, a: 'receipt_scan_0923.jpg', b: 'Taxi · original lost', x: 330, y: 700, z: 70, rz: 6, ry: 20 },
  { i: 'file-spreadsheet', c: C.success, a: 'Timesheet_W38_old.xlsx', b: 'Which one is the latest?', x: 1590, y: 640, z: -30, rz: -5, ry: -22 },
  { i: 'monitor', c: C.error, a: 'IT ticket #4417', b: 'Laptop won’t boot · waiting', x: 1215, y: 925, z: 40, rz: 4, ry: -10 },
  { i: 'message-square', c: C.violet, a: '“Is my leave approved yet?”', b: 'Sent Monday · seen', x: 960, y: 118, z: -300, rz: -3, ry: 0 },
  { i: 'wrench', c: C.sky, a: 'AC broken on floor 2', b: 'Sticky note on the door', x: 700, y: 955, z: -20, rz: -6, ry: 12, badge: '2' },
  { i: 'file', c: C.info, a: 'Expense_claim_form.docx', b: 'Version 7 (use this one)', x: 180, y: 470, z: -320, rz: 3, ry: 26 },
  { i: 'clock', c: C.indigo, a: 'Missed check-in — Tuesday', b: 'Email your manager', x: 1760, y: 430, z: -300, rz: -4, ry: -28 },
  { i: 'calendar', c: C.amber, a: 'Vacation_planner_2026.xlsx', b: 'Shared drive · locked by Sam', x: 1330, y: 400, z: -620, rz: 2, ry: -8 },
];
if (VERT) [[780, 250], [300, 330], [290, 1270], [800, 1190], [720, 1570], [540, 118], [330, 1720], [110, 640], [975, 640], [640, 1850]]
  .forEach(([x, y], i) => { DOCS[i].x = x; DOCS[i].y = y; });
DOCS.forEach((d, i) => {
  const e = el('div', 'abs doc', `<div class="ic" style="background:${hexA(d.c, 0.16)}">${ico(d.i, 25, d.c, 2)}</div>
    <div class="tx"><div class="t1">${d.a}</div><div class="t2">${d.b}</div></div>${d.badge ? `<div class="badge">${d.badge}</div>` : ''}`, act1);
  d.el = e;
});
const BUZZ = { 0: 0.18, 5: 0.42, 4: 0.61, 6: 0.83 };   // doc index → ping time
// absorption order: nearest first
const suckOrder = DOCS.map((d, i) => [Math.hypot(d.x - VP1.x, d.y - VP1.y) + (d.z < -200 ? 400 : 0), i]).sort((a, b) => a[0] - b[0]).map(v => v[1]);
suckOrder.forEach((di, k) => { DOCS[di].sA = T.suckA + k * T.suckGap; DOCS[di].sB = DOCS[di].sA + T.suckDur; });
const absorbTimes = DOCS.map(d => d.sB).sort((a, b) => a - b);

const hl1 = headline(act1, { lines: VERT ? ['Every request.', 'One portal.'] : ['Every request. One portal.'], x: 0, y: 0, size: VERT ? 104 : 88, align: 'center' });
hl1.root.style.width = W + 'px'; hl1.root.style.top = (VERT ? 1075 : 738) + 'px';
const hl1Words = hl1.words.flat();      // words 2,3 ("One portal.") land on the next beat, in brand gradient

function updateAct1(t) {
  const on = t < T.pass + 0.1;
  showL(act1, on);
  if (!on) return;
  DOCS.forEach((d, i) => {
    const fadeIn = P(t, 0.05 + i * 0.03, 0.55 + i * 0.03, E.outCubic);
    const drift = t * 26;
    let x = d.x + Math.sin(t * 0.7 + i) * 6, y = d.y + Math.cos(t * 0.55 + i * 2) * 5, z = d.z + drift;
    let rz = d.rz + Math.sin(t * 0.5 + i) * 1.5, ry = (d.ry || 0) + Math.sin(t * 0.4 + i * 1.3) * 3, rx = Math.cos(t * 0.45 + i) * 3;
    // notification buzz (synced with the muffled inbox pings in the soundtrack)
    const bz = BUZZ[i];
    if (bz !== undefined && t > bz) { const d = t - bz; rz += Math.exp(-d * 14) * Math.sin(d * 150) * 4.5; }
    // anticipation: nudge away from the portal when the dot ignites
    const recoil = P(t, T.dot, T.dot + 0.35, E.outCubic) * 16;
    const dx = x - VP1.x, dy = y - VP1.y, dl = Math.hypot(dx, dy) || 1;
    x += dx / dl * recoil; y += dy / dl * recoil;
    // suction — spiral into the doorway
    const p = P(t, d.sA, d.sB, E.inQuart);
    let s = 1, op = fadeIn, blur = Math.max(0, Math.abs(z + 60) / 70 - 1.2);
    if (p > 0) {
      const r0 = Math.hypot(x - VP1.x, y - VP1.y), th0 = Math.atan2(y - VP1.y, x - VP1.x);
      const r = r0 * (1 - p), th = th0 + 1.35 * p;
      x = VP1.x + Math.cos(th) * r; y = VP1.y + Math.sin(th) * r;
      z = lerp(z, -160, p); s = lerp(1, 0.06, E.inQuad(p)); rz += 140 * p; ry *= 1 - p;
      op *= 1 - P(p, 0.72, 1, E.inQuad); blur *= 1 - p;
    }
    place(d.el, { x, y, z, s, rx, ry, rz, op, blur });
  });
  // headline — in at hlA / hlB, rushes past camera during the fly-through
  runHeadline(hl1, t, T.hlA, 1e9, { stagger: 0.06 });
  // stage the second half ("One portal.") on the next beat
  hl1Words.forEach((w, k) => {
    const d = (k < 2 ? T.hlA : T.hlB) + 0.02 + (k % 2) * 0.07;
    const pi = P(t, d, d + 0.95, E.outExpo);
    w.style.transform = `translate3d(0,${f2((1 - pi) * 108)}%,0) rotate(${f2((1 - pi) * 5)}deg)`;
  });
  const pf = P(t, T.flyA, T.flyA + 0.42, E.inCubic);
  hl1.root.style.transform = `translate3d(0,${f2(pf * 220)}px,0) scale(${(1 + pf * 0.45).toFixed(4)})`;
  hl1.root.style.opacity = (1 - pf).toFixed(3);
  hl1.root.style.filter = pf > 0.02 ? `blur(${(pf * 10).toFixed(2)}px)` : '';
}

/* ═══════════════════════ ACT II — the phone ═══════════════════════ */
const phone = el('div', 'abs p3d', null, act2); phone.id = 'phone';
for (let i = 7; i >= 1; i--) { const e = el('div', 'edge', null, phone); e.style.transform = `translateZ(${-i * 1.7}px)`; e.style.filter = `brightness(${(1 - i * 0.07).toFixed(2)})`; }
const pbody = el('div', 'body', null, phone);
[[-3, 180, 34], [-3, 250, 62], [-3, 326, 62], [415, 270, 100]].forEach(([x, y, h]) => { const b = el('div', 'btn', null, phone); Object.assign(b.style, { left: x + 'px', top: y + 'px', height: h + 'px' }); });
const screen = el('div', 'screen', null, pbody);

const STATUS_ICONS = `<svg width="19" height="12" viewBox="0 0 19 12"><rect x="0" y="8" width="3.2" height="4" rx="1" fill="#fff"/><rect x="5" y="5.5" width="3.2" height="6.5" rx="1" fill="#fff"/><rect x="10" y="3" width="3.2" height="9" rx="1" fill="#fff"/><rect x="15" y="0" width="3.2" height="12" rx="1" fill="#fff"/></svg>
  <svg width="17" height="12" viewBox="0 0 17 12"><path d="M8.5 11.6 11 8.9a3.6 3.6 0 0 0-5 0z" fill="#fff"/><path d="M3.8 6.9a6.6 6.6 0 0 1 9.4 0l1.4-1.5a8.7 8.7 0 0 0-12.2 0z" fill="#fff"/><path d="M1 4.1a10.6 10.6 0 0 1 15 0L17.4 2.6a12.7 12.7 0 0 0-17.8 0z" fill="#fff" transform="translate(0 .2)"/></svg>
  <svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.8" fill="none" stroke="rgba(255,255,255,.4)"/><rect x="2" y="2" width="18" height="9" rx="2.4" fill="#fff"/><path d="M25 4.4v4.2a2.2 2.2 0 0 0 0-4.2z" fill="rgba(255,255,255,.45)"/></svg>`;

// ── shared app chrome
const appRoot = el('div', 'pane', null, screen);
const content = el('div', 'content', null, appRoot);
const header = el('div', 'app-header', `<div class="search-pill">${ico('search', 18, C.muted, 2)}Search...</div><div class="bell">${ico('bell', 24, '#fff', 2)}<div class="dot"></div></div>`, appRoot);
const tabbar = el('div', 'tabbar', `<div class="tab" data-k="home"></div><div class="tab" data-k="plus"></div><div class="tab" data-k="user"></div>`, appRoot);
const tabs = [...tabbar.children].map(tb => {
  const k = tb.dataset.k, n = k === 'home' ? 'house' : k;
  tb.innerHTML = `<span class="on" style="position:absolute">${ico(n, 28, '#fff', 3)}</span><span class="offi" style="position:absolute">${ico(n, 28, C.muted, 2)}</span>`;
  return { k, on: tb.querySelector('.on'), off: tb.querySelector('.offi') };
});

// ── Dashboard (app/(app)/dashboard.tsx)
const dashPane = el('div', 'pane', `<div class="scroll dash">
  <div class="dash-head" id="dHead">
    <div><div class="dash-date">Monday, Oct 5</div><div class="dash-welcome">Welcome back,<br>Yasmine</div></div>
    <div class="fab">${ico('plus', 24, '#18181b', 3)}</div>
  </div>
  <div class="acard" id="dPending" style="background:${RN(C.warning, '18')}">
    <div style="position:absolute;right:-20px;top:-20px;opacity:.07;transform:rotate(15deg)">${ico('clock', 160, C.warning, 2)}</div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
      <div class="itile" style="background:${RN(C.warning, '30')}">${ico('clock', 20, C.warning, 2.5)}</div>
      <div class="pill" style="background:${RN(C.warning, '30')};color:${C.warning}">Priority</div>
    </div>
    <div style="font:500 15px/20px 'DM Sans';color:${C.warning};opacity:.9;margin-bottom:4px">Pending Approval</div>
    <div class="big" style="margin-bottom:16px">3 Waiting</div>
    <div class="chips">${[['1', 'Leave', C.info], ['1', 'Expense', C.success], ['1', 'IT', C.warning], ['0', 'Maintenance', C.error]]
      .map(([n, l, c]) => `<div class="chip" style="background:${RN(c, '28')};color:${c}"><b>${n}</b>${l}</div>`).join('')}</div>
  </div>
  <div class="acard" id="dQuick" style="background:${RN(C.info, '18')}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px">
      <div class="itile" style="background:${RN(C.info, '30')}">${ico('plus', 20, C.info, 2.5)}</div>
      <div style="font:700 14px/20px 'DM Sans';color:${C.info};opacity:.9">Quick Actions</div>
    </div>
    <div class="qa">${[['calendar', 'Time Off', 'qaTO'], ['dollar-sign', 'Expense', ''], ['timer', 'Timesheet', ''], ['', 'More', '']]
      .map(([n, l, id]) => `<div class="it"><div class="tile" ${id ? `id="${id}"` : ''} style="background:${RN(C.info, '28')}">${n ? ico(n, 22, C.info, 2) : `<span style="font:700 15px Outfit;color:${C.info}">...</span>`}</div>${l}</div>`).join('')}</div>
  </div>
  <div class="srow" id="dStats">
    <div class="acard" style="background:${RN(C.success, '18')}">
      <div class="itile" style="background:${RN(C.success, '30')};align-self:flex-start">${ico('timer', 20, C.success, 2.5)}</div>
      <div><div class="lbl" style="color:${C.success};opacity:.9;margin-bottom:2px">Timesheet</div><div class="mid">12 Entries</div><div class="lbl" style="opacity:.5;margin-top:4px">Tap to log hours</div></div>
    </div>
    <div class="acard" style="background:${RN(C.warning, '18')}">
      <div class="itile" style="background:${RN(C.warning, '30')};align-self:flex-start">${ico('monitor', 20, C.warning, 2.5)}</div>
      <div><div class="lbl" style="color:${C.warning};opacity:.9;margin-bottom:2px">IT + Maintenance</div><div class="mid">2 Open</div><div class="lbl" style="opacity:.5;margin-top:4px">Active requests</div></div>
    </div>
  </div>
  <div class="recent" id="dRecent" style="margin-top:40px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><div style="font:700 20px Outfit">Recent Activities</div><div style="font:500 14px 'DM Sans'">View All</div></div>
    <div class="act"><div class="ico" style="background:${RN(C.info, '20')}">${ico('calendar', 22, C.info, 2.5)}</div><div style="flex:1"><div class="t">Annual Leave</div><div class="d">Oct 12, 2026</div></div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px"><div class="st" id="dLeaveSt" style="background:${RN(C.info, '20')};color:${C.info};position:relative"><span id="dLeaveA">To approve</span><span id="dLeaveB" style="position:absolute;inset:4px 10px;opacity:0">Approved</span></div></div></div>
    <div class="act"><div class="ico" style="background:${RN(C.success, '20')}">${ico('dollar-sign', 22, C.success, 2.5)}</div><div style="flex:1"><div class="t">Client lunch</div><div class="d">Oct 5, 2026</div></div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px"><div style="font:700 15px Outfit">$48.20</div><div class="st" style="background:${RN(C.success, '20')};color:${C.success}">Submitted</div></div></div>
    <div class="act"><div class="ico" style="background:${RN(C.success, '20')}">${ico('timer', 22, C.success, 2.5)}</div><div style="flex:1"><div class="t">Website redesign</div><div class="d">Oct 5, 2026</div></div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px"><div style="font:700 15px Outfit">7.5h</div><div class="st" style="background:${RN(C.success, '20')};color:${C.success}">Logged</div></div></div>
  </div>
</div>`, content);
const dash = { pane: dashPane, scroll: $('.scroll', dashPane), head: $('#dHead', dashPane), cards: ['#dPending', '#dQuick', '#dStats', '#dRecent'].map(s => $(s, dashPane)) };

// ── New Time Off (new-request.tsx → renderTimeOffForm)
const toPane = el('div', 'pane', `<div class="scroll form">
  <div class="back">${ico('chevron-left', 20, '#fff', 2)}Back</div>
  <div class="ftitle">New Time Off</div><div class="fsub">Fill in the details below</div>
  <div class="flabel">Leave Type</div>
  <div class="select" id="toType" style="border-color:${C.info}"><span>Annual Leave</span>${ico('chevron-down', 18, C.muted, 2)}</div>
  <div class="balance" id="toBal">Balance <b style="color:${C.info}">18 days / 24</b></div>
  <div class="flabel">Duration</div>
  <div class="dcard">
    <div class="l">From</div>
    <div class="date-f" id="toFrom"><span style="position:relative;display:block;height:20px;flex:1"><span class="ph" style="position:absolute;color:${C.muted}">Select start date</span><span class="vl" style="position:absolute">Mon, Oct 12, 2026</span></span>${ico('calendar', 20, C.muted, 2)}</div>
    <div class="divider"></div>
    <div class="l">To</div>
    <div class="date-f" id="toTo"><span style="position:relative;display:block;height:20px;flex:1"><span class="ph" style="position:absolute;color:${C.muted}">Select end date</span><span class="vl" style="position:absolute">Fri, Oct 16, 2026</span></span>${ico('calendar', 20, C.muted, 2)}</div>
    <div id="toReq"><div class="req-row">Requested <b style="color:${C.info}">≈ <span id="toDays">5</span> days</b></div>
      <div class="hint">Excludes weekends — final duration follows your work schedule and public holidays.</div></div>
  </div>
  <div class="flabel">Reason (Optional)</div>
  <div class="note">Family trip ✈</div>
  <div class="submit" id="toSubmit" style="background:${C.info};box-shadow:0 8px 16px ${hexA(C.info, .25)}"><span class="lb">Submit Request</span></div>
</div>`, content);
const to = { pane: toPane, scroll: $('.scroll', toPane), type: $('#toType', toPane), bal: $('#toBal', toPane), from: $('#toFrom', toPane), toF: $('#toTo', toPane), req: $('#toReq', toPane), days: $('#toDays', toPane), submit: $('#toSubmit', toPane) };

// ── New Expense (renderExpenseForm)
const exPane = el('div', 'pane', `<div class="scroll form">
  <div class="back">${ico('chevron-left', 20, '#fff', 2)}Back</div>
  <div class="ftitle">New Expense</div><div class="fsub">Enter the amount and details</div>
  <div class="amount-card"><div class="cap">Total Amount</div><div class="amt"><span>$</span><span id="exAmt">0.00</span></div></div>
  <div class="flabel">Category</div>
  <div class="select" id="exCat"><span style="position:relative;height:20px"><span class="ph" style="position:absolute;font-weight:400;color:${C.muted}">Select</span><span class="vl" style="position:absolute">Meals &amp; Entertainment</span></span>${ico('chevron-down', 18, C.muted, 2)}</div>
  <div class="flabel">Paid By</div>
  <div class="seg"><div style="background:${C.success};color:#fff">Employee (reimburse)</div><div>Company</div></div>
  <div class="flabel">Details</div>
  <div class="dcard"><div class="l">Description</div><div class="date-f">Client lunch — Q4 kickoff</div></div>
  <div class="flabel">Receipts <span style="letter-spacing:0">(1/3)</span></div>
  <div class="attach"><div class="att-tile" id="exReceipt"><div class="receipt"><div class="paper">CAFÉ LUMIÈRE<i></i><i style="width:70%"></i><i></i><i style="width:55%"></i><i></i>TOTAL 48.20</div><div class="fn">IMG_0923.jpg</div></div></div>
    <div class="att-tile" id="exAdd">${ico('camera', 22, C.muted, 2)}</div></div>
  <div class="submit" id="exSubmit" style="background:${C.success};box-shadow:0 8px 16px ${hexA(C.success, .25)}"><span class="lb">Submit Claim</span></div>
</div>`, content);
const ex = { pane: exPane, scroll: $('.scroll', exPane), amt: $('#exAmt', exPane), cat: $('#exCat', exPane), receipt: $('#exReceipt', exPane), submit: $('#exSubmit', exPane) };

// ── New Request hub (renderHub)
const hubCard = (c, i, t, s) => `<div style="background:${RN(c, '18')};border-radius:32px;padding:32px;overflow:hidden;min-height:200px;display:flex;flex-direction:column;justify-content:space-between;position:relative;margin-top:16px">
  <div style="position:absolute;right:-20px;top:-20px;opacity:.12;transform:rotate(15deg)">${ico(i, 160, c, 2)}</div>
  <div style="width:56px;height:56px;border-radius:20px;display:grid;place-items:center;background:${RN(c, '28')}">${ico(i, 28, c, 2)}</div>
  <div><div style="font:700 28px/1.2 Outfit;color:${c};margin-bottom:8px">${t}</div><div style="font:500 16px 'DM Sans';color:${C.muted}">${s}</div></div>
  <div style="position:absolute;right:24px;bottom:24px;width:48px;height:48px;border-radius:24px;display:grid;place-items:center;background:${RN(c, '28')}">${ico('arrow-right', 24, c, 2)}</div></div>`;
const smallCard = (c, i, t, s) => `<div style="flex:1;background:${RN(c, '18')};border-radius:28px;padding:24px;overflow:hidden;min-height:160px;display:flex;flex-direction:column;justify-content:space-between;position:relative">
  <div style="position:absolute;right:-10px;top:-10px;opacity:.1">${ico(i, 100, c, 2)}</div>
  <div style="width:44px;height:44px;border-radius:16px;display:grid;place-items:center;background:${RN(c, '28')}">${ico(i, 22, c, 2)}</div>
  <div><div style="font:700 20px/1.2 Outfit;color:${c};margin-bottom:4px">${t}</div><div style="font:400 13px 'DM Sans';color:${C.muted}">${s}</div></div></div>`;
const hubPane = el('div', 'pane', `<div class="scroll form" style="padding-top:34px">
  <div style="font:700 32px/1.2 Outfit">New Request</div><div style="font:400 16px 'DM Sans';color:${C.muted};margin-top:8px;margin-bottom:8px">What would you like to submit today?</div>
  ${hubCard(C.info, 'clock', 'Time Off', 'Vacation, Sick Leave &amp; More')}
  ${hubCard(C.success, 'dollar-sign', 'Expense Claim', 'Reimbursements &amp; Purchases')}
  ${hubCard(C.warning, 'user-check', 'Attendance', 'Fix a missed check-in or check-out')}
  <div style="font:500 14px 'DM Sans';color:${C.muted};text-transform:uppercase;letter-spacing:1px;margin:24px 4px 16px">More Options</div>
  <div style="display:flex;gap:12px">${smallCard(C.success, 'timer', 'Timesheet', 'Log your hours')}${smallCard(C.error, 'monitor', 'Helpdesk', 'Report an issue')}</div>
</div>`, content);
const hub = { pane: hubPane, scroll: $('.scroll', hubPane) };

// ── Lock screen (push notification moment)
const lockPane = el('div', 'pane', `
  <div style="position:absolute;inset:0;background:
    radial-gradient(120% 60% at 50% 105%, rgba(79,142,247,.55), rgba(42,95,212,.18) 45%, rgba(0,0,0,0) 70%),
    radial-gradient(80% 50% at 80% 0%, rgba(99,102,241,.35), rgba(0,0,0,0) 70%),
    linear-gradient(180deg, #0b0d24, #070814 60%, #0a1230)"></div>
  <svg style="position:absolute;left:75px;top:430px;opacity:.28" width="240" height="300" viewBox="-130 -130 260 320">
    <path d="M -100 170 L -100 0 A 100 100 0 0 1 100 0 L 100 170" fill="none" stroke="#89BFFF" stroke-width="3" stroke-linecap="round"/></svg>
  <div style="position:absolute;left:0;right:0;top:92px;text-align:center">
    <div style="font:600 21px 'DM Sans';color:rgba(255,255,255,.88)">Monday, October 5</div>
    <div style="font:600 108px/1 'Outfit';letter-spacing:-3px;margin-top:4px;color:rgba(255,255,255,.95)">9:41</div>
  </div>
  <div style="position:absolute;left:46px;bottom:48px;width:50px;height:50px;border-radius:25px;background:rgba(255,255,255,.14);display:grid;place-items:center">${ico('zap', 22, '#fff', 2)}</div>
  <div style="position:absolute;right:46px;bottom:48px;width:50px;height:50px;border-radius:25px;background:rgba(255,255,255,.14);display:grid;place-items:center">${ico('camera', 22, '#fff', 2)}</div>
`, screen);

// ── overlays inside the screen
const toast = el('div', 'toast', `<div class="ti" style="background:#d1fae5">${ico('circle-check-big', 20, C.success, 2.5)}</div><span class="msg">Time off request submitted!</span>`, screen);
const toastMsg = $('.msg', toast);
const status = el('div', 'statusbar', `<span class="time">9:41</span><span class="icons">${STATUS_ICONS}</span>`, screen);
el('div', 'island', null, screen);
el('div', 'home-ind', null, screen);
const glare = el('div', 'glare', null, screen);
const camFlash = el('div', null, null, screen);
Object.assign(camFlash.style, { position: 'absolute', inset: '0', background: '#fff', zIndex: 45, opacity: 0, pointerEvents: 'none' });
const tapDot = el('div', 'tap', null, screen), tapRing = el('div', 'ring', null, screen);
[tapDot, tapRing].forEach(e => Object.assign(e.style, { position: 'absolute', left: '0', top: '0' }));

// ── push notification (child of the phone, outside the screen clip, so it can break out in 3D)
const APPICON = `<svg width="40" height="40" viewBox="0 0 1024 1024"><defs><linearGradient id="aib" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="#131328"/><stop offset="1" stop-color="#080814"/></linearGradient>
  <linearGradient id="aia" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#2A5FD4"/><stop offset=".55" stop-color="#4F8EF7"/><stop offset="1" stop-color="#89BFFF"/></linearGradient></defs>
  <rect width="1024" height="1024" fill="url(#aib)"/><path d="M 284 760 L 284 490 A 228 228 0 0 1 740 490 L 740 760" fill="none" stroke="url(#aia)" stroke-width="56" stroke-linecap="round"/>
  <line x1="244" y1="760" x2="780" y2="760" stroke="#3B74E0" stroke-width="40" stroke-linecap="round"/><circle cx="512" cy="262" r="30" fill="#fff"/></svg>`;
const push = el('div', 'abs push', `<div class="appicon">${APPICON}</div><div style="flex:1;min-width:0">
  <div class="hd"><span>Shadow Portal</span><span>now</span></div>
  <div class="tt">Request Approved ${ico('circle-check-big', 17, C.success, 2.6)}</div>
  <div class="bd">Your time off request “Annual Leave” has been approved.</div></div>`, phone);

// ── headlines (Act II)
const HX = VERT ? 96 : 150, HY = VERT ? 262 : 398, HS = VERT ? 100 : undefined;
const hDash = headline(act2, { over: 'Dashboard', accent: C.blueLight, lines: ['Everything,', 'at a glance.'], alt: [1], x: HX, y: HY, size: HS });
const hTO = headline(act2, { over: 'Time off', accent: '#60a5fa', lines: ['Book leave', 'in seconds.'], alt: [1], x: HX, y: HY, size: HS });
const hEX = headline(act2, { over: 'Expenses', accent: '#34d399', lines: ['Snap the receipt.', 'Done.'], alt: [1], x: VERT ? HX : 985, y: HY, size: HS });
const hNO = headline(act2, { over: 'Push notifications', accent: '#a78bfa', lines: ['Approved?', 'Know instantly.'], alt: [1], x: HX, y: VERT ? HY : 170, size: HS });
const hGR = headline(act2, { lines: VERT ? ['Every request,', 'covered.'] : ['Every request, covered.'], size: VERT ? 100 : 76, x: 0, y: VERT ? 150 : 84, align: 'center' });
hGR.root.style.width = W + 'px';
const hOD = headline(act2, { lines: VERT ? ['Plugs straight', 'into Odoo.'] : ['Plugs straight into Odoo.'], size: VERT ? 100 : 76, x: 0, y: VERT ? 150 : 84, align: 'center', alt: [] });
hOD.root.style.width = W + 'px';

// ── feature cards (grid beat)
const FEAT = [
  { i: 'timer', c: C.success, t: 'Timesheets', s: 'Log hours by project', x: VERT ? 292 : 478, y: VERT ? 598 : 420, side: -1 },
  { i: 'monitor', c: C.error, t: 'IT Helpdesk', s: 'Tickets tracked to done', x: VERT ? 788 : 1442, y: VERT ? 598 : 420, side: 1 },
  { i: 'wrench', c: C.info, t: 'Maintenance', s: 'Report equipment issues', x: VERT ? 292 : 478, y: VERT ? 1600 : 716, side: -1 },
  { i: 'user-check', c: C.warning, t: 'Attendance', s: 'Fix a missed check-in', x: VERT ? 788 : 1442, y: VERT ? 1600 : 716, side: 1 },
];
FEAT.forEach(d => {
  d.el = el('div', 'abs fcard', `<div class="wm">${ico(d.i, 150, d.c, 2)}</div><div class="ic" style="background:${hexA(d.c, 0.16)}">${ico(d.i, 34, d.c, 2)}</div>
    <div><div class="t" style="color:${d.c}">${d.t}</div><div class="s">${d.s}</div></div>`, act2);
});
const chipsGR = [
  el('div', 'abs chip2', `${ico('languages', 22, '#a5b4fc', 2)}English &amp; <span style="font-family:'Segoe UI',Tahoma,sans-serif;font-weight:600">العربية</span>`, act2),
  el('div', 'abs chip2', `${ico('moon', 21, '#a5b4fc', 2)}Light &amp; dark mode`, act2),
];
// ── Odoo beat
const erp = el('div', 'abs erp', `<div class="bar"><div class="dots"><i></i><i></i><i></i></div>Odoo&nbsp; › &nbsp;Time Off&nbsp; › &nbsp;Requests</div>
  <div class="body">
    <div class="rec"><div><div class="nm">Annual Leave</div><div class="sub">Yasmine Alaoui · Sales</div></div>
      <div class="status"><span id="stA" style="background:${hexA(C.warning, .16)};color:${C.warning}">To Approve</span>
      <span id="stB" style="background:${hexA(C.success, .18)};color:#34d399;opacity:0">${ico('check', 17, '#34d399', 3)}Approved</span></div></div>
    <div class="grid">
      <div class="k">Dates</div><div>Oct 12 → Oct 16, 2026</div>
      <div class="k">Duration</div><div>5 days</div>
      <div class="k">Source</div><div style="display:flex;align-items:center;gap:9px"><span style="width:22px;height:22px;border-radius:6px;overflow:hidden;display:inline-block">${APPICON.replace('width="40" height="40"', 'width="22" height="22"')}</span>Shadow Portal app</div>
    </div>
  </div>`, act2);
const stA = $('#stA', erp), stB = $('#stB', erp);
const ERP_Y = 1500;   // vertical cut: the record panel sits under the phone
const chipsOD = [
  el('div', 'abs chip2', `${ico('database', 21, '#93c5fd', 2)}Odoo 15 → 18`, act2),
  el('div', 'abs chip2', `${ico('plug-zap', 21, '#93c5fd', 2)}No modules to install`, act2),
  el('div', 'abs chip2', `${ico('building-2', 21, '#93c5fd', 2)}Multi-company`, act2),
];

/* ═══════════════════════ END CARD ═══════════════════════ */
const sep = el('div', 'abs', null, endL);
Object.assign(sep.style, { width: '2px', height: `${480 * LS}px`, background: 'linear-gradient(180deg, rgba(79,142,247,0), rgba(79,142,247,.55) 35%, rgba(79,142,247,.55) 65%, rgba(79,142,247,0))' });
const wmS = el('div', 'wordmark', `<div class="wm-shadow">${'Shadow'.split('').map(ch => `<span class="m" style="padding:0;margin:0"><span>${ch}</span></span>`).join('')}</div>`, endL);
const wmP = el('div', 'wordmark', `<div class="wm-portal">${'PORTAL'.split('').map(ch => `<span>${ch}</span>`).join('')}</div>`, endL);
const tag = el('div', 'abs tagline', 'Your workplace, in your pocket.', endL);
const cta = el('div', 'abs cta', `${ico('sparkles', 20, '#89BFFF', 2)}${CTA_TEXT}`, endL);
// wordmark metrics: beside the arch (logo lockup) in 16:9, stacked under it in 9:16
const WM = VERT ? { shadow: 150, portal: 100, track: 26, shadowBase: 1082, portalBase: 1200, tag: 1335, cta: 1440 }
  : { shadow: 132 * LS, portal: 90 * LS, track: 22 * LS, shadowBase: LY(262), portalBase: LY(380), tag: 748, cta: 838 };
$('.wm-shadow', wmS).style.fontSize = `${WM.shadow}px`;
$('.wm-portal', wmP).style.fontSize = `${WM.portal}px`;
if (VERT) { tag.style.fontSize = '40px'; cta.style.fontSize = '24px'; }
const wmLetters = [...wmS.querySelectorAll('.m > span')], wpLetters = [...wmP.querySelectorAll('.wm-portal > span')];

/* ═══════════════════════ phone choreography ═══════════════════════ */
const LAYOUT = {};
function computeLayout() {
  // scroll each form so its submit button sits just above the tab bar (content top 133, tab bar 115)
  const visible = 844 - 133 - 115 - 22;
  for (const [k, form] of [['to', to], ['ex', ex]]) {
    const b = offsetIn(form.submit, form.scroll).y + form.submit.offsetHeight;
    LAYOUT[k + 'Scroll'] = Math.max(0, b - visible);
    LAYOUT[k + 'TapY'] = 133 + b - LAYOUT[k + 'Scroll'] - 28;
  }
}
const POSE = VERT ? {
  A: { x: 540, y: 1250, s: 1.12, rx: 4, ry: -9, rz: 0.8 },
  B: { x: 540, y: 1250, s: 1.12, rx: 4, ry: 9, rz: -0.8 },
  C: { x: 540, y: 1262, s: 1.1, rx: 4, ry: -6, rz: 0.6 },
  D: { x: 540, y: 1100, s: 0.74, rx: 6, ry: 0, rz: 0 },
  E: { x: 540, y: 905, s: 0.66, rx: 8, ry: 0, rz: 0 },
} : {
  A: { x: 1310, y: 556, s: 1.06, rx: 5, ry: -17, rz: 1.4 },
  B: { x: 610, y: 556, s: 1.06, rx: 5, ry: 17, rz: -1.4 },
  C: { x: 1320, y: 556, s: 1.04, rx: 4, ry: -15, rz: 1.1 },
  D: { x: 960, y: 598, s: 0.78, rx: 7, ry: 0, rz: 0 },
  E: { x: 610, y: 568, s: 0.86, rx: 4, ry: 15, rz: -1 },
};
const SWAP = VERT ? 0.28 : 0.2;   // screen content changes mid-whip (off-frame in the vertical cut)
// vertical whip: the phone leaves one side of the frame and comes back in from the other
function slidePose(a, b, t, t0, dir) {
  const u = inv(t0, t0 + 0.56, t), first = u < 0.5, base = first ? a : b;
  const off = first ? dir * 920 * E.inCubic(u * 2) : -dir * 920 * (1 - E.outCubic((u - 0.5) * 2));
  const sw = Math.sin(Math.PI * u);
  return { ...base, x: base.x + off, ry: base.ry - dir * 28 * sw, rz: base.rz + dir * 5 * sw };
}
function blend(a, b, pPos, pRot) {
  return { x: lerp(a.x, b.x, pPos), y: lerp(a.y, b.y, pPos), s: lerp(a.s, b.s, pPos), rx: lerp(a.rx, b.rx, pRot), ry: lerp(a.ry, b.ry, pRot), rz: lerp(a.rz, b.rz, pRot) };
}
function phonePose(t) {
  let p;
  if (t < T.whip1) {
    // emerge from the light: long swinging spring
    const k = spring(t - T.phoneIn, 70, 15), kr = spring(t - T.phoneIn, 38, 8.5);
    const A = POSE.A;
    p = { x: lerp(VP1.x, A.x, k), y: lerp(VP1.y + 20, A.y, k), s: lerp(0.1, A.s, k), rx: lerp(28, A.rx, kr), ry: lerp(-95, A.ry, kr), rz: lerp(-12, A.rz, kr), z: lerp(-700, 0, k) };
  } else if (t < T.whip2) {
    p = VERT ? slidePose(POSE.A, POSE.B, t, T.whip1, -1) : blend(POSE.A, POSE.B, P(t, T.whip1, T.whip1 + 0.5, E.whip), spring(t - T.whip1 - 0.05, 90, 11));
  } else if (t < T.grid) {
    p = VERT ? slidePose(POSE.B, POSE.C, t, T.whip2, 1) : blend(POSE.B, POSE.C, P(t, T.whip2, T.whip2 + 0.5, E.whip), spring(t - T.whip2 - 0.05, 90, 11));
  } else if (t < T.odoo) {
    p = blend(POSE.C, POSE.D, P(t, T.grid, T.grid + 0.55, E.snap), spring(t - T.grid, 80, 13));
    p.ry += Math.sin((t - T.grid) * 1.6) * 4 * P(t, T.grid + 0.3, T.grid + 0.9);
  } else {
    p = blend(POSE.D, POSE.E, P(t, T.odoo, T.odoo + 0.55, E.snap), spring(t - T.odoo, 80, 13));
  }
  p.z = p.z || 0;
  // haptic buzz when the push notification lands
  const hb = t - T.lockNotif;
  if (hb > 0 && hb < 0.4) { const k = Math.sin(Math.PI * Math.min(1, hb / 0.35)); p.rz += k * 1.1 * Math.sin(hb * 190); p.x += k * 2.2 * Math.sin(hb * 230); }
  // idle float
  p.y += Math.sin(t * 1.35) * 7;
  p.rx += Math.sin(t * 0.9 + 1) * 1.2;
  p.ry += Math.sin(t * 0.7) * 1.8;
  // micro "camera push" on each UI beat
  p.s *= 1 + 0.018 * Math.exp(-((t - T.pushTO - 0.15) ** 2) / 0.02) + 0.02 * Math.exp(-((t - T.tapSubmit) ** 2) / 0.01);
  return p;
}

// in-screen tap indicator
function tapAt(t, t0, x, y) {
  const on = t > t0 - 0.2 && t < t0 + 0.5;
  if (!on) return false;
  const a = P(t, t0 - 0.2, t0 - 0.05, E.outCubic) * (1 - P(t, t0 + 0.08, t0 + 0.3));
  const press = 1 - 0.18 * Math.exp(-((t - t0) ** 2) / 0.004);
  tapDot.style.transform = `translate(${x - 32}px,${y - 32}px) scale(${(lerp(0.6, 1, P(t, t0 - 0.2, t0 - 0.05, E.outBack)) * press).toFixed(3)})`;
  tapDot.style.opacity = a.toFixed(3);
  const pr = P(t, t0, t0 + 0.45, E.outCubic);
  tapRing.style.transform = `translate(${x - 32}px,${y - 32}px) scale(${(1 + pr * 1.4).toFixed(3)})`;
  tapRing.style.opacity = (t >= t0 ? 0.8 * (1 - pr) : 0).toFixed(3);
  return true;
}

const cache = {};
function updatePhone(t) {
  const on = t > T.phoneIn - 0.02 && t < T.end;
  show(phone, on);
  if (!on) return;
  const p = phonePose(t);
  phone._w = 418; phone._h = 872;
  const opIn = P(t, T.phoneIn, T.phoneIn + 0.25);
  place(phone, { ...p, op: 1 });
  phone.style.opacity = '';
  pbody.style.opacity = opIn < 1 ? opIn.toFixed(3) : '';
  pbody.style.filter = opIn < 1 ? `brightness(${lerp(3, 1, opIn).toFixed(2)})` : '';
  // glare follows rotation
  glare.style.backgroundPosition = `${(50 + p.ry * 2.2).toFixed(1)}% 0`;

  // which screen is live
  const onLock = t >= T.whip2 + SWAP && t < T.grid + 0.2;
  const onHub = t >= T.grid + 0.2 && t < T.odoo + 0.2;
  const onEx = t >= T.whip1 + SWAP && t < T.whip2 + SWAP;
  show(lockPane, onLock);
  show(appRoot, !onLock);
  show(status, true);

  // ── dashboard (3.86 – 6.1) and again in the Odoo beat
  const dashOn = (t < T.pushTO + 0.5) || t >= T.odoo + 0.2;
  const toOn = t >= T.pushTO && t < T.whip1 + SWAP;
  show(dash.pane, dashOn && !onHub && !onEx);
  show(to.pane, toOn);
  show(ex.pane, onEx);
  show(hub.pane, onHub);

  // push transition dashboard → time off
  const pp = P(t, T.pushTO, T.pushTO + 0.42, E.swift);
  if (t < T.odoo) {
    dash.pane.style.transform = `translateX(${f2(-110 * pp)}px)`;
    dash.pane.style.filter = pp > 0 ? `brightness(${(1 - 0.45 * pp).toFixed(3)})` : '';
    to.pane.style.transform = `translateX(${f2(390 * (1 - pp))}px)`;
    to.pane.style.boxShadow = pp > 0 && pp < 1 ? '-20px 0 40px rgba(0,0,0,.5)' : '';
    // dashboard entrance (mirrors the app's own Animated sequence)
    const hp = P(t, 4.02, 4.62, E.outCubic);
    dash.head.style.transform = `translateY(${f2((1 - hp) * 30)}px)`; dash.head.style.opacity = hp.toFixed(3);
    dash.cards.forEach((c, i) => {
      const k = spring(t - 4.2 - i * 0.1, 120, 13);
      c.style.transform = `translateY(${f2((1 - k) * 50)}px)`; c.style.opacity = clamp(k * 1.4).toFixed(3);
    });
    dash.scroll.style.transform = `translateY(${f2(-P(t, 4.9, 5.45, E.inOutCubic) * 36)}px)`;
  } else {
    // Odoo beat: dashboard scrolled to Recent Activities
    dash.pane.style.transform = ''; dash.pane.style.filter = '';
    dash.head.style.transform = ''; dash.head.style.opacity = '';
    dash.cards.forEach(c => { c.style.transform = ''; c.style.opacity = ''; });
    const sp = P(t, T.odoo + 0.15, T.odoo + 0.8, E.outCubic);
    dash.scroll.style.transform = `translateY(${f2(-lerp(250, 470, sp))}px)`;
    const fl = P(t, T.beam2 + 0.3, T.beam2 + 0.45);
    $('#dLeaveA').style.opacity = (1 - fl).toFixed(3); $('#dLeaveB').style.opacity = fl.toFixed(3);
    const st = $('#dLeaveSt');
    st.style.background = fl > 0.5 ? RN(C.success, '28') : RN(C.info, '20');
    st.style.color = fl > 0.5 ? C.success : C.info;
    st.style.transform = `scale(${(1 + 0.25 * Math.exp(-((t - T.beam2 - 0.4) ** 2) / 0.006)).toFixed(3)})`;
  }
  // tab bar state
  const plusActive = (t >= T.pushTO + 0.1 && t < T.whip2 + SWAP) || onHub;
  tabs.forEach(tb => { const a = tb.k === (plusActive ? 'plus' : 'home'); tb.on.style.opacity = a ? 1 : 0; tb.off.style.opacity = a ? 0 : 1; });

  // ── time off form choreography
  if (toOn) {
    const ty = spring(t - T.pushTO - 0.2, 300, 20);
    to.type.style.transform = `scale(${(0.96 + 0.04 * ty).toFixed(4)})`;
    const bp = P(t, T.pushTO + 0.3, T.pushTO + 0.6, E.outCubic);
    to.bal.style.opacity = bp.toFixed(3); to.bal.style.transform = `translateY(${f2((1 - bp) * -8)}px)`;
    [[to.from, T.toFrom], [to.toF, T.toTo]].forEach(([e, t0]) => {
      const q = P(t, t0, t0 + 0.22, E.outCubic);
      e.querySelector('.ph').style.opacity = (1 - q).toFixed(3);
      const v = e.querySelector('.vl'); v.style.opacity = q.toFixed(3); v.style.transform = `translateY(${f2((1 - q) * 8)}px)`;
      e.style.borderColor = q > 0 && q < 1 ? hexA(C.info, 0.6 * (1 - q) + 0.1) : 'rgba(255,255,255,0.06)';
    });
    const rq = P(t, T.toReq, T.toReq + 0.25, E.outCubic);
    to.req.style.opacity = rq.toFixed(3);
    to.days.textContent = String(Math.max(1, Math.round(lerp(1, 5, P(t, T.toReq, T.toReq + 0.3, E.outCubic)))));
    to.scroll.style.transform = `translateY(${f2(-P(t, T.toScroll, T.toScroll + 0.45, E.inOutCubic) * LAYOUT.toScroll)}px)`;
    const press = 1 - 0.05 * Math.exp(-((t - T.tapSubmit - 0.03) ** 2) / 0.003);
    to.submit.style.transform = `scale(${press.toFixed(4)})`;
    const loading = t > T.tapSubmit + 0.05 && t < T.toToast;
    to.submit.querySelector('.lb').textContent = loading ? 'Submitting…' : 'Submit Request';
    to.submit.style.filter = t > T.toToast ? 'saturate(.85) brightness(.9)' : '';
  }
  // ── expense form choreography
  if (onEx) {
    const a = P(t, T.exAmt, T.exAmt + 0.45, E.outCubic);
    ex.amt.textContent = (48.2 * a).toFixed(2);
    ex.amt.style.color = a > 0 ? '#fff' : C.muted;
    const q = P(t, T.exCat, T.exCat + 0.2, E.outCubic);
    ex.cat.querySelector('.ph').style.opacity = (1 - q).toFixed(3);
    ex.cat.querySelector('.vl').style.opacity = q.toFixed(3);
    ex.cat.style.borderColor = q > 0 ? C.success : 'transparent';
    ex.cat.style.transform = `scale(${(1 + 0.04 * Math.exp(-((t - T.exCat - 0.08) ** 2) / 0.004)).toFixed(4)})`;
    ex.scroll.style.transform = `translateY(${f2(-P(t, T.exScroll, T.exScroll + 0.42, E.inOutCubic) * LAYOUT.exScroll)}px)`;
    const sn = spring(t - T.exSnap, 260, 16);
    ex.receipt.style.transform = `scale(${lerp(1.5, 1, sn).toFixed(4)}) rotate(${f2((1 - sn) * -10)}deg)`;
    ex.receipt.style.opacity = clamp(sn * 2).toFixed(3);
    ex.receipt.style.boxShadow = `0 0 0 ${f2(3 * (1 - P(t, T.exSnap, T.exSnap + 0.5)))}px ${C.success}`;
    ex.receipt.firstChild.style.filter = `brightness(${(1 + 2.2 * Math.exp(-((t - T.exSnap) ** 2) / 0.003)).toFixed(3)})`;
    const press = 1 - 0.05 * Math.exp(-((t - T.tapClaim - 0.03) ** 2) / 0.003);
    ex.submit.style.transform = `scale(${press.toFixed(4)})`;

  }
  // camera flash on the receipt snap — set every frame (seeks can jump forward between render chunks)
  const cf = onEx && t > T.exSnap - 0.02 ? Math.exp(-(t - T.exSnap + 0.02) * 16) * 0.55 : 0;
  camFlash.style.opacity = cf.toFixed(3);
  if (onHub) hub.scroll.style.transform = `translateY(${f2(-P(t, T.grid + 0.5, T.odoo, E.inOutSine) * 330)}px)`;

  // toast
  let tp = 0, msg = '';
  if (t >= T.toToast && t < T.whip1 + SWAP) { tp = spring(t - T.toToast, 200, 17); msg = 'Time off request submitted!'; }
  if (t >= T.exToast && t < T.whip2 + SWAP) { tp = spring(t - T.exToast, 200, 17); msg = 'Expense claim submitted!'; }
  show(toast, tp > 0.001);
  if (tp > 0.001) { toastMsg.textContent = msg; toast.style.transform = `translateY(${f2((1 - tp) * -130)}px)`; }

  // taps
  const tapTO = cache.qaTO || (cache.qaTO = (() => { const r = offsetIn($('#qaTO'), screen); return { x: r.x + 26, y: r.y + 26 }; })());
  let tapped = tapAt(t, T.tapTO, tapTO.x, tapTO.y - 36 * P(t, 4.9, 5.45, E.inOutCubic));
  if (!tapped) tapped = tapAt(t, T.tapSubmit, 195, LAYOUT.toTapY);
  if (!tapped) tapped = tapAt(t, T.tapClaim, 195, LAYOUT.exTapY);
  show(tapDot, tapped); show(tapRing, tapped);

  // ── push notification + breakout
  const nOn = t > T.lockNotif - 0.05 && t < T.grid + 0.35;
  show(push, nOn);
  if (nOn) {
    push._w = 362; push._h = push._h || push.offsetHeight;
    const k = spring(t - T.lockNotif, 190, 17);
    // lock-screen slot (phone-local coordinates, screen inset 14px)
    const lx = 14 + 195, ly = 14 + 520;
    const b = spring(t - T.breakout, 55, 11), bs = spring(t - T.breakout, 70, 12);
    const exitP = P(t, T.grid - 0.02, T.grid + 0.3, E.inQuad);
    const BK = VERT ? { dx: 0, y: -150, z: 240, s: 1.5, ry: 6 } : { dx: -585, y: 600, z: 300, s: 1.78, ry: 19 };
    const x = lx + lerp(0, BK.dx, b), y = lerp(ly + 90 * (1 - k), BK.y, b), z = lerp(3, BK.z, b) + exitP * 900;
    const s = lerp(lerp(0.9, 1, k), BK.s, bs);
    place(push, { x, y, z, s, ry: lerp(0, BK.ry, b) + Math.sin(t * 1.2) * 2 * b, rx: lerp(0, -4, b), rz: lerp(0, -1.8, b), op: clamp(k * 3) * (1 - exitP), blur: exitP * 12 });
    push.style.boxShadow = `0 ${f2(18 + 40 * b)}px ${f2(40 + 60 * b)}px rgba(0,0,0,${(0.45 + 0.2 * b).toFixed(2)}), 0 0 ${f2(60 * b)}px ${hexA(C.violet, 0.25 * b)}`;
  }
}

function updateAct2Text(t) {
  runHeadline(hDash, t, T.dashHl, T.pushTO - 0.04);
  runHeadline(hTO, t, T.toHl, T.whip1 - 0.2);
  runHeadline(hEX, t, T.exHl, T.whip2 - 0.2);
  runHeadline(hNO, t, T.noHl + 0.1, T.grid - 0.15);
  runHeadline(hGR, t, T.gridHl, T.odoo - 0.2, { stagger: 0.05 });
  runHeadline(hOD, t, T.odooHl, T.out, { stagger: 0.05 });

  // feature cards burst out of the phone, one per 16th note
  const pp = phonePose(t);
  FEAT.forEach((d, i) => {
    const t0 = T.cards + i * 0.125;
    const on = t > t0 - 0.02 && t < T.odoo + 0.5;
    show(d.el, on);
    if (!on) return;
    d.el._w = 420; d.el._h = 150;
    const k = spring(t - t0, 120, 14), kr = spring(t - t0, 70, 10);
    const exitP = P(t, T.odoo + i * 0.03, T.odoo + 0.34 + i * 0.03, E.inCubic);
    const fx = d.x + Math.sin(t * 1.1 + i * 1.7) * 6, fy = d.y + Math.cos(t * 1.3 + i) * 7;
    const x = lerp(pp.x, fx, k) + exitP * d.side * 900, y = lerp(pp.y - 20, fy, k);
    place(d.el, { x, y, z: lerp(-120, 0, k) - exitP * 200, s: lerp(0.3, VERT ? 0.93 : 1.08, k), ry: lerp(d.side * 70, d.side * -10, kr), rx: lerp(20, 0, kr), rz: 0, op: clamp(k * 2.5) * (1 - exitP), blur: exitP * 8 });
  });
  chipsGR.forEach((c, i) => {
    const t0 = T.chips + i * 0.1, k = spring(t - t0, 160, 14), ex = P(t, T.odoo, T.odoo + 0.3, E.inCubic);
    const on = t > t0 && t < T.odoo + 0.35; show(c, on); if (!on) return;
    measure(c);
    place(c, { x: W / 2 + (i ? 1 : -1) * (c._w / 2 + 10), y: (VERT ? 1772 : 990) + (1 - k) * 60 + ex * 80, s: lerp(0.7, 1, k), op: clamp(k * 2) * (1 - ex) });
  });
  // Odoo record panel
  const eOn = t > T.odoo && t < T.end; show(erp, eOn);
  if (eOn) {
    erp._w = 560; erp._h = erp._h || erp.offsetHeight;
    const k = spring(t - T.odoo - 0.12, 110, 15), kr = spring(t - T.odoo - 0.12, 60, 10);
    if (VERT) place(erp, { x: 540, y: lerp(1950, ERP_Y, k) + Math.sin(t * 1.2) * 6, z: lerp(-300, 0, k), rx: lerp(50, 8, kr), op: clamp(k * 2) });
    else place(erp, { x: lerp(1750, 1330, k), y: 545 + Math.sin(t * 1.2) * 6, z: lerp(-300, 0, k), ry: lerp(-45, -12, kr), rx: 3, op: clamp(k * 2) });
    const fl = P(t, T.approve, T.approve + 0.16);
    stA.style.opacity = (1 - fl).toFixed(3); stB.style.opacity = fl.toFixed(3);
    stB.parentElement.style.transform = `scale(${(1 + 0.18 * Math.exp(-((t - T.approve - 0.08) ** 2) / 0.006)).toFixed(3)})`;
  }
  chipsOD.forEach((c, i) => {
    const t0 = T.odooChips + i * 0.09, k = spring(t - t0, 160, 14);
    const on = t > t0 && t < T.end; show(c, on); if (!on) return;
    measure(c);
    const widths = chipsOD.map(cc => cc._w || cc.offsetWidth), total = widths.reduce((a, b) => a + b, 0) + 24 * 2;
    let x0 = W / 2 - total / 2; for (let j = 0; j < i; j++) x0 += widths[j] + 24;
    place(c, { x: x0 + c._w / 2, y: (VERT ? 1785 : 985) + (1 - k) * 60, s: lerp(0.7, 1, k), op: clamp(k * 2) });
  });
}

// the whole Act II world shrinks into the doorway as the camera pulls back out of the portal
function updateAct2Wrapper(t) {
  const on = t > T.phoneIn - 0.05 && t < T.end + 0.02;
  showL(act2, on);
  if (!on) return;
  // follows the camera pull-back (same outQuint curve as camZ), tiny push-in first as anticipation
  const ant = Math.sin(Math.PI * P(t, T.out, T.out + 0.12)) * 0.03;
  const p = P(t, T.out + 0.1, T.end, E.outQuint);
  const vp = vpAt(t);
  const s = lerp(1, 0.1, p) + ant;
  act2.style.transformOrigin = '0 0';
  act2.style.transform = t > T.out ? `translate(${f2(vp.x)}px,${f2(vp.y)}px) scale(${s.toFixed(4)}) translate(${f2(-vp.x)}px,${f2(-vp.y)}px)` : '';
  const fade = P(p, 0.3, 0.75);
  act2.style.opacity = t > T.out ? (1 - fade).toFixed(3) : '';
  act2.style.filter = fade > 0.01 ? `brightness(${(1 + fade * 1.5).toFixed(2)}) blur(${(fade * 4).toFixed(1)}px)` : '';
}

/* ═══════════════════════ camera (tunnel depth) ═══════════════════════ */
function camZ(t) {
  if (t < T.flyA) return lerp(-1.05, -1, P(t, 0, T.flyA, E.outSine));
  if (t < T.pass) return lerp(-1, 0.02, P(t, T.flyA, T.pass, E.inQuart));
  const vPass = 1.02 * 4 / (T.pass - T.flyA);                      // velocity at the pass (continuity)
  const decel = 0.72, dz1 = vPass * decel / 3;                        // outCubic start slope = 3Δ/decel
  if (t < T.pass + decel) return 0.02 + dz1 * E.outCubic((t - T.pass) / decel);
  const zCruise = 0.02 + dz1, cruise = 0.1;
  if (t < T.out) return zCruise + cruise * (t - T.pass - decel);
  const zOut = zCruise + cruise * (T.out - T.pass - decel);
  if (t < T.out + 0.1) return zOut + 0.06 * E.outQuad((t - T.out) / 0.1);   // anticipation
  if (t < T.end) return lerp(zOut + 0.06, Z_END, E.outQuint((t - T.out - 0.1) / (T.end - T.out - 0.1)));
  return Z_END * (1 - 0.035 * P(t, T.end, DURATION, E.outSine));          // slow push on the logo
}
function vpAt(t) {
  const p = P(t, T.out, T.end - 0.05, E.inOutCubic);
  return { x: lerp(VP1.x, VP_END.x, p), y: lerp(VP1.y, VP_END.y, p) };
}

/* ═══════════════════════ background canvas ═══════════════════════ */
const MOTES = (() => { const r = rng(7); return Array.from({ length: 170 }, () => ({ x: (r() * 2 - 1) * (VERT ? 2.1 : 3.4), y: (r() * 2 - 1) * (VERT ? 3.7 : 2.1), z: r() * 9, s: 0.5 + r() * 1.3, ph: r() * 6.28, hue: r() })); })();
function drawBG(t) {
  const c = g;
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  c.globalCompositeOperation = 'source-over'; c.filter = 'none'; c.globalAlpha = 1;
  const Zc = camZ(t), vp = vpAt(t);
  const act2k = P(t, T.pass - 0.1, T.pass + 0.5) * (1 - P(t, T.out + 0.2, T.end));
  // base
  const base = c.createRadialGradient(vp.x, vp.y + 40, 0, vp.x, vp.y + 40, 1350 * Math.max(W, H) / 1920);
  base.addColorStop(0, '#0e1230'); base.addColorStop(0.45, '#080a1c'); base.addColorStop(1, '#030409');
  c.fillStyle = base; c.fillRect(0, 0, W, H);
  // aurora
  const au = 0.35 + 0.65 * act2k;
  const sx = W / 1920, sy = H / 1080, sr = Math.max(W, H) / 1920;
  [[C.blueDeep, 0.30, (380 + Math.sin(t * 0.3) * 140) * sx, (250 + Math.cos(t * 0.25) * 80) * sy, 820 * sr],
   [C.indigo, 0.20, (1560 + Math.cos(t * 0.27) * 120) * sx, (820 + Math.sin(t * 0.33) * 90) * sy, 760 * sr],
   [C.sky, 0.12, (1180 + Math.sin(t * 0.22 + 2) * 200) * sx, (180 + Math.cos(t * 0.3) * 60) * sy, 640 * sr]].forEach(([col, a, x, y, r]) => {
    const rg = c.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, hexA(col, a * au)); rg.addColorStop(1, hexA(col, 0));
    c.fillStyle = rg; c.fillRect(0, 0, W, H);
  });
  // phone rim-light + floor shadow
  if (t > T.phoneIn && t < T.end) {
    const pp = phonePose(t), k = P(t, T.phoneIn, T.phoneIn + 0.6) * (1 - P(t, T.out, T.out + 0.3));
    const rg = c.createRadialGradient(pp.x, pp.y, 0, pp.x, pp.y, 520 * pp.s);
    rg.addColorStop(0, hexA(C.blue, 0.22 * k)); rg.addColorStop(1, hexA(C.blue, 0));
    c.fillStyle = rg; c.fillRect(0, 0, W, H);
  }

  // tunnel echoes (behind the portal)
  const echoA = P(t, T.flyA + 0.2, T.pass) * 0.9 * (1 - 0.45 * P(t, T.pass + 0.4, T.pass + 1.2)) * (1 - P(t, T.end + 0.05, T.end + 0.7));
  if (echoA > 0.002) {
    for (let k = 8; k >= 1; k--) {
      const d = k * DZ - Zc;
      if (d < 0.04 || d > 9) continue;
      const s = 1 / d, G = geo(vp.x, vp.y, R0 * s);
      const a = echoA * smooth(9, 2.2, d) * smooth(0.04, 0.4, d);
      if (a < 0.003) continue;
      c.save();
      c.lineCap = 'round'; pathFull(c, G);
      c.strokeStyle = hexA(C.blue, 0.10 * a); c.lineWidth = STROKE * G.R * 2.2; c.filter = `blur(${Math.min(40, G.R * 0.12).toFixed(1)}px)`; c.stroke();
      c.filter = 'none'; c.strokeStyle = hexA(C.blueLight, 0.32 * a); c.lineWidth = Math.max(1, STROKE * G.R * 0.28); c.stroke();
      c.restore();
    }
  }

  // motes (dust in the portal light)
  c.globalCompositeOperation = 'lighter';
  const moteA = P(t, 0.1, 1.2) * (1 - 0.4 * P(t, T.end, T.end + 1));
  for (const m of MOTES) {
    let d = ((m.z - Zc) % 9 + 9) % 9;
    if (d < 0.05) continue;
    const s = 1 / d, x = vp.x + m.x * R0 * s * 1.6, y = vp.y + (m.y - FOCUS_Y) * R0 * s * 1.6;
    if (x < -50 || x > W + 50 || y < -50 || y > H + 50) continue;
    const r = Math.min(14, m.s * 1.8 * s + 0.4);
    const a = moteA * 0.5 * smooth(9, 3, d) * smooth(0.05, 0.3, d) * (0.6 + 0.4 * Math.sin(t * 2 + m.ph));
    if (a < 0.01) continue;
    const rg = c.createRadialGradient(x, y, 0, x, y, r * 2.2);
    rg.addColorStop(0, `rgba(${m.hue > 0.7 ? '200,190,255' : '160,200,255'},${a.toFixed(3)})`); rg.addColorStop(1, 'rgba(120,170,255,0)');
    c.fillStyle = rg; c.fillRect(x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
  }
  c.globalCompositeOperation = 'source-over';

  // ── the portal (arch 0)
  const d0 = -Zc;
  if (d0 > 0.03) {
    const s = 1 / d0, G = geo(vp.x, vp.y, R0 * s);
    const nAbs = absorbTimes.filter(a => t >= a).length;
    let charge = P(t, T.drawA + 0.3, T.drawB, E.outCubic) * 0.22 + nAbs * 0.055 + 0.25 * P(t, T.hlA, T.hlB + 0.2)
      + 1.1 * P(t, T.flyA, T.pass, E.inCubic);
    charge *= 1 - P(t, T.pass - 0.02, T.pass + 0.02);                             // (we are past it)
    if (t > T.out) charge = (0.9 * (1 - P(t, T.end - 0.25, T.end + 0.6, E.outCubic))) * clamp(1.25 - G.R * 1.15 / (W * 0.5)) + 0.16 + 0.05 * Math.sin(t * 2.4);
    drawPortal(c, G, {
      draw: t > T.out ? 1 : P(t, T.drawA, T.drawB, E.inOutCubic),
      base: t > T.out ? 1 : P(t, T.baseA, T.baseB, E.outCubic),
      dot: t > T.out ? 1 : spring(t - T.dot, 260, 14),
      charge, reflect: t > T.out ? 0.5 * P(t, T.end - 0.2, T.end + 0.5) : P(t, T.drawA + 0.3, T.drawB + 0.3) * (1 - P(t, T.flyA, T.flyA + 0.3)),
      alpha: 1, run: t > T.end ? P(t, T.shine, T.shine + 0.75, E.inOutSine) : 0,
    }, t);
  }
  // fade in from black
  const fin = 1 - P(t, 0, 0.45, E.outCubic);
  if (fin > 0) { c.fillStyle = `rgba(0,0,0,${fin.toFixed(3)})`; c.fillRect(0, 0, W, H); }
}

function drawPortal(c, G, o, t) {
  const R = G.R, lw = STROKE * R, half = Math.PI / 2 + LEG, d = o.draw * half;
  const [, yTop] = G.m(0, -1), [, yBot] = G.m(0, LEG);
  c.save();
  c.lineCap = 'round'; c.lineJoin = 'round';
  // interior light + bloom + floor spill
  if (o.charge > 0.001) {
    const ch = Math.min(o.charge, 1.6);
    const [bx, by] = G.m(0, LEG);
    c.globalCompositeOperation = 'lighter';
    // floor spill
    c.save();
    c.beginPath();
    const [lx] = G.m(-1, LEG), [rx] = G.m(1, LEG);
    c.moveTo(lx, by); c.lineTo(rx, by); c.lineTo(bx + (rx - bx) * 2.6, by + R * 1.9); c.lineTo(bx - (rx - bx) * 2.6, by + R * 1.9); c.closePath();
    const sg = c.createLinearGradient(0, by, 0, by + R * 1.9);
    sg.addColorStop(0, `rgba(110,160,255,${(0.34 * Math.min(ch, 1)).toFixed(3)})`); sg.addColorStop(1, 'rgba(60,110,240,0)');
    c.fillStyle = sg; c.filter = `blur(${Math.min(60, R * 0.12).toFixed(1)}px)`; c.fill();
    c.restore();
    // bloom
    pathFull(c, G); c.closePath();
    c.filter = `blur(${Math.min(140, R * 0.45).toFixed(1)}px)`;
    c.fillStyle = `rgba(79,142,247,${(0.42 * Math.min(ch, 1.2)).toFixed(3)})`; c.fill();
    c.filter = 'none';
    // interior
    const rg = c.createRadialGradient(bx, by, 0, bx, by, R * 2.4);
    rg.addColorStop(0, `rgba(200,225,255,${(0.9 * Math.min(ch, 1)).toFixed(3)})`);
    rg.addColorStop(0.35, `rgba(110,165,255,${(0.55 * Math.min(ch, 1)).toFixed(3)})`);
    rg.addColorStop(1, `rgba(42,95,212,${(0.1 * Math.min(ch, 1)).toFixed(3)})`);
    pathFull(c, G); c.closePath(); c.fillStyle = rg; c.fill();
    if (ch > 1) {                                  // over-exposure while flying through
      c.fillStyle = `rgba(225,238,255,${((ch - 1) * 1.2).toFixed(3)})`; pathFull(c, G); c.closePath(); c.fill();
    }
    c.globalCompositeOperation = 'source-over';
  }
  // floor reflection of the arch (masked with a vertical gradient on an offscreen buffer)
  if (o.reflect > 0.01 && R < 900) {
    o2.setTransform(DPR, 0, 0, DPR, 0, 0); o2.clearRect(0, 0, W, H);
    o2.save(); o2.translate(0, 2 * yBot); o2.scale(1, -1);
    o2.lineCap = 'round'; o2.strokeStyle = C.blue; o2.lineWidth = lw;
    o2.beginPath(); pathHalf(o2, G, -1, d); pathHalf(o2, G, 1, d); o2.stroke();
    o2.restore();
    o2.globalCompositeOperation = 'destination-in';
    const mg = o2.createLinearGradient(0, yBot, 0, yBot + R * 1.3);
    mg.addColorStop(0, 'rgba(0,0,0,0.30)'); mg.addColorStop(1, 'rgba(0,0,0,0)');
    o2.fillStyle = mg; o2.fillRect(0, yBot, W, R * 1.4);
    o2.globalCompositeOperation = 'source-over';
    c.globalAlpha = o.reflect * o.alpha; c.filter = 'blur(3px)'; c.drawImage(off, 0, 0, W, H); c.filter = 'none'; c.globalAlpha = 1;
  }
  if (d > 0.001) {
    const grad = c.createLinearGradient(0, yBot, 0, yTop);
    grad.addColorStop(0, C.blueDeep); grad.addColorStop(0.55, C.blue); grad.addColorStop(1, C.blueLight);
    const stroke = (w, style, a, blur) => {
      c.globalAlpha = a * o.alpha; c.lineWidth = w; c.strokeStyle = style; c.filter = blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : 'none';
      c.beginPath(); pathHalf(c, G, -1, d); pathHalf(c, G, 1, d); c.stroke();
    };
    stroke(lw * 4.2, C.blue, 0.16, Math.min(120, R * 0.34));   // wide bloom
    stroke(lw * 2.1, C.blue, 0.30, Math.min(50, R * 0.09));    // glow (icon: 98px @ .12, blur 18)
    stroke(lw, grad, 1, 0);                                    // core
    c.filter = 'none'; c.globalAlpha = 1;
    // comet heads while drawing
    if (o.draw > 0 && o.draw < 1) {
      c.globalCompositeOperation = 'lighter';
      for (const side of [-1, 1]) {
        const [x, y] = tipPoint(G, side, d), r = R * 0.42;
        const rg = c.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, 'rgba(255,255,255,0.95)'); rg.addColorStop(0.18, 'rgba(170,210,255,0.7)'); rg.addColorStop(1, 'rgba(79,142,247,0)');
        c.fillStyle = rg; c.fillRect(x - r, y - r, 2 * r, 2 * r);
      }
      c.globalCompositeOperation = 'source-over';
    }
  }
  // a light running along the stroke (logo shine)
  if (o.run > 0 && o.run < 1) {
    const L1 = LEG, L2 = LEG + Math.PI, L3 = 2 * LEG + Math.PI, head = o.run * (L3 + 0.6) - 0.3;
    const pt = u => u <= L1 ? G.m(-1, LEG - u) : u <= L2 ? G.m(Math.cos(Math.PI + u - L1), Math.sin(Math.PI + u - L1)) : G.m(1, u - L2);
    const seg = (u0, u1) => {
      u0 = clamp(u0, 0, L3); u1 = clamp(u1, 0, L3); if (u1 <= u0) return;
      c.beginPath(); c.moveTo(...pt(u0));
      if (u0 < L1) c.lineTo(...pt(Math.min(u1, L1)));
      if (u1 > L1 && u0 < L2) { const [cx, cy] = G.m(0, 0); c.arc(cx, cy, R, Math.PI + Math.max(0, u0 - L1), Math.PI + Math.min(Math.PI, u1 - L1)); }
      if (u1 > L2) c.lineTo(...pt(u1));
      c.stroke();
    };
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    for (let k = 0; k < 8; k++) {
      c.strokeStyle = `rgba(200,225,255,${(0.11 * (1 - k / 8)).toFixed(3)})`; c.lineWidth = lw * 0.9;
      seg(head - 0.07 * (k + 1), head - 0.07 * k);
    }
    c.filter = `blur(${(lw * 0.5).toFixed(1)}px)`; c.strokeStyle = 'rgba(160,205,255,0.5)'; c.lineWidth = lw * 1.8; seg(head - 0.25, head + 0.02);
    c.filter = 'none';
    if (head > 0 && head < L3) { const [x, y] = pt(head), r = lw * 2.2; const rg = c.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, 'rgba(255,255,255,0.8)'); rg.addColorStop(1, 'rgba(137,191,255,0)'); c.fillStyle = rg; c.fillRect(x - r, y - r, 2 * r, 2 * r); }
    c.restore();
  }
  // threshold line
  if (o.base > 0.001) {
    const [bx, by] = G.m(0, LEG), hw = BASE * R * o.base;
    c.globalAlpha = 0.85 * o.alpha; c.strokeStyle = C.base; c.lineWidth = BASE_W * R;
    c.beginPath(); c.moveTo(bx - hw, by); c.lineTo(bx + hw, by); c.stroke();
    c.globalAlpha = 0.2 * o.alpha; c.lineWidth = BASE_W * R * 3; c.filter = `blur(${Math.min(40, R * 0.1).toFixed(1)}px)`; c.stroke();
    c.filter = 'none'; c.globalAlpha = 1;
  }
  // apex dot
  if (o.dot > 0.001) {
    const [x, y] = G.m(0, -1), r = DOT_R * R * o.dot;
    c.globalCompositeOperation = 'lighter';
    const hg = c.createRadialGradient(x, y, 0, x, y, r * 4.5);
    hg.addColorStop(0, 'rgba(137,191,255,0.55)'); hg.addColorStop(1, 'rgba(137,191,255,0)');
    c.fillStyle = hg; c.fillRect(x - r * 4.5, y - r * 4.5, r * 9, r * 9);
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = 'rgba(255,255,255,0.97)'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  }
  c.restore();
}

/* ═══════════════════════ FX canvas (screen-blended light) ═══════════════════════ */
const STREAKS = (() => { const r = rng(21); return Array.from({ length: 110 }, () => ({ a: r() * Math.PI * 2, r: 0.15 + r() * 1.4, l: 0.3 + r() * 0.9, w: 0.6 + r() * 1.8 })); })();
function flare(c, x, y, a, len, thick = 1) {
  if (a <= 0.003) return;
  c.save(); c.translate(x, y);
  // anamorphic streak
  c.scale(len / 100, thick);
  let rg = c.createRadialGradient(0, 0, 0, 0, 0, 100);
  rg.addColorStop(0, `rgba(190,220,255,${(0.9 * a).toFixed(3)})`); rg.addColorStop(0.25, `rgba(79,142,247,${(0.35 * a).toFixed(3)})`); rg.addColorStop(1, 'rgba(40,80,200,0)');
  c.fillStyle = rg; c.fillRect(-100, -3.2, 200, 6.4);
  c.restore();
  // core glow
  const r = 26 + 60 * a;
  rg = c.createRadialGradient(x, y, 0, x, y, r);
  rg.addColorStop(0, `rgba(255,255,255,${(0.9 * a).toFixed(3)})`); rg.addColorStop(0.3, `rgba(137,191,255,${(0.45 * a).toFixed(3)})`); rg.addColorStop(1, 'rgba(79,142,247,0)');
  c.fillStyle = rg; c.fillRect(x - r, y - r, 2 * r, 2 * r);
}
function drawFX(t) {
  const c = f;
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  c.clearRect(0, 0, W, H);
  c.globalCompositeOperation = 'lighter';
  const Zc = camZ(t), vp = vpAt(t), d0 = -Zc;
  // apex flare — ignition, glints, and the final logo hit
  if (d0 > 0.05) {
    const G = geo(vp.x, vp.y, R0 / d0), [ax, ay] = G.m(0, -1);
    let a = 0, len = 0;
    const ig = t - T.dot;
    if (ig > 0 && t < T.pass) { a = Math.exp(-ig * 3.2) + 0.1 + 0.4 * P(t, T.flyA, T.pass, E.inQuad); len = 300 + 1000 * Math.exp(-ig * 2.2) * (1 - Math.exp(-ig * 14)) + 700 * P(t, T.flyA, T.pass, E.inQuad); }
    const eh = t - T.end;
    if (eh > -0.05 && t > T.out + 0.3) { const e = Math.max(0, eh); a = Math.max(a, 1.15 * Math.exp(-e * 2.4) + 0.08); len = 320 + 1300 * Math.exp(-e * 1.6) * (1 - Math.exp(-e * 12)); }
    const gl = Math.exp(-((t - T.glint) ** 2) / 0.012);
    if (gl > 0.01) { a = Math.max(a, 0.1 + 0.85 * gl); len = Math.max(len, 320 + 700 * gl); }
    flare(c, ax, ay, a, len, 1);
    // absorption pulses at the doorway
    for (const at of absorbTimes) {
      const dt = t - at; if (dt < -0.01 || dt > 0.4) continue;
      const k = Math.exp(-dt * 9), r = 70 + 180 * (1 - k);
      const rg = c.createRadialGradient(VP1.x, VP1.y, 0, VP1.x, VP1.y, r);
      rg.addColorStop(0, `rgba(200,225,255,${(0.55 * k).toFixed(3)})`); rg.addColorStop(1, 'rgba(79,142,247,0)');
      c.fillStyle = rg; c.fillRect(VP1.x - r, VP1.y - r, 2 * r, 2 * r);
    }
  }
  // warp streaks (camera speed)
  const sp = Math.max(0, (camZ(t + 1 / 120) - camZ(t - 1 / 120)) * 60);
  const warp = clamp(Math.abs(sp) / 5);
  if (warp > 0.02) {
    const dir = Math.sign(sp || 1);
    for (const s of STREAKS) {
      const r1 = s.r * 900, r2 = r1 + s.l * 900 * warp;
      const [x1, y1] = [vp.x + Math.cos(s.a) * r1, vp.y + Math.sin(s.a) * r1 * 0.75];
      const [x2, y2] = [vp.x + Math.cos(s.a) * r2, vp.y + Math.sin(s.a) * r2 * 0.75];
      const lg = c.createLinearGradient(x1, y1, x2, y2);
      lg.addColorStop(dir > 0 ? 0 : 1, 'rgba(137,191,255,0)'); lg.addColorStop(dir > 0 ? 1 : 0, `rgba(190,220,255,${(0.5 * warp).toFixed(3)})`);
      c.strokeStyle = lg; c.lineWidth = s.w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    }
  }
  // flashes: portal pass + logo impact
  const fl = 0.95 * Math.exp(-((t - T.pass) ** 2) / 0.006);
  if (fl > 0.004) { c.fillStyle = `rgba(185,212,255,${fl.toFixed(3)})`; c.fillRect(0, 0, W, H); }
  const fe = Math.exp(-((t - T.end - 0.01) ** 2) / 0.004);
  if (fe > 0.004) {
    const [cx, cy] = [LX(200), LY(88)], rg = c.createRadialGradient(cx, cy, 0, cx, cy, 1500);
    rg.addColorStop(0, `rgba(215,232,255,${(0.95 * fe).toFixed(3)})`); rg.addColorStop(0.25, `rgba(120,170,255,${(0.35 * fe).toFixed(3)})`); rg.addColorStop(1, 'rgba(60,110,240,0)');
    c.fillStyle = rg; c.fillRect(0, 0, W, H);
  }
  // logo shockwave ring
  const sw = t - T.end;
  if (sw > 0 && sw < 0.9) {
    const k = E.outCubic(sw / 0.9), [cx, cy] = [LX(200), LY(270)], r = 60 + k * 1100;
    c.strokeStyle = `rgba(137,191,255,${(0.35 * (1 - k)).toFixed(3)})`; c.lineWidth = 3 + 30 * (1 - k); c.filter = 'blur(6px)';
    c.beginPath(); c.ellipse(cx, cy, r, r * 0.92, 0, 0, Math.PI * 2); c.stroke(); c.filter = 'none';
  }
  // phone-in light burst
  const pb = Math.exp(-((t - T.phoneIn - 0.05) ** 2) / 0.01);
  if (pb > 0.01) { const rg = c.createRadialGradient(VP1.x, VP1.y, 0, VP1.x, VP1.y, 700); rg.addColorStop(0, `rgba(200,225,255,${(0.5 * pb).toFixed(3)})`); rg.addColorStop(1, 'rgba(79,142,247,0)'); c.fillStyle = rg; c.fillRect(0, 0, W, H); }
  // data beam (Odoo beat)
  drawBeam(c, t);
  // end fade
  const fo = P(t, T.fade, DURATION, E.inQuad);
  c.globalCompositeOperation = 'source-over';
  if (fo > 0) { $('#letterbox').style.opacity = fo.toFixed(3); } else $('#letterbox').style.opacity = 0;
}
function beamPath(t) {
  const pp = phonePose(t);
  if (VERT) { const y1 = pp.y + 446 * pp.s, y2 = ERP_Y - (erp._h || 330) / 2 - 4; return [540, y1, 380, lerp(y1, y2, 0.4), 700, lerp(y1, y2, 0.6), 540, y2]; }
  const x1 = pp.x + 200 * pp.s, y1 = pp.y - 40, x2 = 1330 - 285, y2 = 545;
  return [x1, y1, lerp(x1, x2, 0.35), y1 - 120, lerp(x1, x2, 0.65), y2 + 120, x2, y2];
}
function bz(p, q) { const [x1, y1, c1x, c1y, c2x, c2y, x2, y2] = p, u = 1 - q; return [u * u * u * x1 + 3 * u * u * q * c1x + 3 * u * q * q * c2x + q * q * q * x2, u * u * u * y1 + 3 * u * u * q * c1y + 3 * u * q * q * c2y + q * q * q * y2]; }
function drawBeam(c, t) {
  const a = P(t, T.odoo + 0.35, T.odoo + 0.6) * (1 - P(t, T.out, T.out + 0.2));
  if (a <= 0.003) return;
  const bp = beamPath(t);
  const grow = P(t, T.odoo + 0.35, T.beam1 + 0.1, E.outCubic);
  c.save();
  c.lineCap = 'round';
  const trace = (w, style, blur) => {
    c.strokeStyle = style; c.lineWidth = w; c.filter = blur ? `blur(${blur}px)` : 'none';
    c.beginPath(); for (let i = 0; i <= 40; i++) { const [x, y] = bz(bp, (i / 40) * grow); i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
  };
  trace(10, `rgba(79,142,247,${(0.25 * a).toFixed(3)})`, 8);
  trace(2, `rgba(160,205,255,${(0.7 * a).toFixed(3)})`, 0);
  c.filter = 'none';
  // dashes of data along the line
  for (let i = 0; i < 7; i++) {
    const q = ((t * 0.9 + i / 7) % 1) * grow, [x, y] = bz(bp, q);
    const rg = c.createRadialGradient(x, y, 0, x, y, 9); rg.addColorStop(0, `rgba(210,230,255,${(0.6 * a).toFixed(3)})`); rg.addColorStop(1, 'rgba(79,142,247,0)');
    c.fillStyle = rg; c.fillRect(x - 9, y - 9, 18, 18);
  }
  // big pulses: request → Odoo, approval → phone
  [[T.beam1, 1], [T.beam2, -1]].forEach(([t0, dir]) => {
    const q = P(t, t0, t0 + 0.34, E.inOutCubic); if (q <= 0 || q >= 1) return;
    const [x, y] = bz(bp, dir > 0 ? q : 1 - q), r = 46;
    const rg = c.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, `rgba(255,255,255,${a.toFixed(3)})`); rg.addColorStop(0.2, `rgba(137,191,255,${(0.8 * a).toFixed(3)})`); rg.addColorStop(1, 'rgba(79,142,247,0)');
    c.fillStyle = rg; c.fillRect(x - r, y - r, 2 * r, 2 * r);
  });
  c.restore();
}

/* ═══════════════════════ end card ═══════════════════════ */
function updateEnd(t) {
  const on = t > T.end - 0.05;
  showL(endL, on);
  if (!on) return;
  // separator
  const sp = P(t, T.end + 0.05, T.end + 0.6, E.outExpo);
  sep._w = 2; sep._h = 480 * LS;
  place(sep, { x: LX(385), y: LY(240), s: 1, op: VERT ? 0 : sp });
  sep.style.transform += ` scaleY(${sp.toFixed(4)})`;
  // "Shadow" rises letter by letter
  const fs = WM.shadow;
  wmS.style.left = `${VERT ? 540 - wmS.offsetWidth / 2 : LX(428) - 4}px`; wmS.style.top = `${WM.shadowBase - fs * 0.905}px`;
  wmLetters.forEach((l, i) => {
    const p = P(t, T.end + 0.1 + i * 0.035, T.end + 0.95 + i * 0.035, E.outExpo);
    l.style.transform = `translate3d(0,${f2((1 - p) * 105)}%,0)`;
  });
  // "PORTAL" tracks in
  const pp = P(t, T.end + 0.3, T.end + 1.4, E.outExpo);
  const ps = $('.wm-portal', wmP);
  const lsp = lerp(62, WM.track, pp);
  ps.style.letterSpacing = `${lsp.toFixed(2)}px`;
  wmP.style.left = `${VERT ? 540 - (wmP.offsetWidth - lsp) / 2 : LX(428) - 2}px`; wmP.style.top = `${WM.portalBase - WM.portal * 0.89}px`;
  wpLetters.forEach((l, i) => { const q = P(t, T.end + 0.3 + i * 0.05, T.end + 0.9 + i * 0.05, E.outCubic); l.style.opacity = q.toFixed(3); });
  wmP.style.filter = pp < 0.98 ? `blur(${((1 - pp) * 6).toFixed(2)}px)` : '';
  // letters catch the light as the shine passes over the wordmark
  [...wmLetters, ...wpLetters].forEach((l, i) => {
    const j = i < wmLetters.length ? i : (i - wmLetters.length) * 0.95 + 0.4;
    const gk = Math.exp(-((t - (T.shine + 0.62 + j * 0.055)) ** 2) / 0.006);
    l.style.textShadow = gk > 0.02 ? `0 0 ${(22 * gk).toFixed(1)}px rgba(137,191,255,${(0.95 * gk).toFixed(3)})` : '';
    if (i >= wmLetters.length) l.style.filter = gk > 0.02 ? `brightness(${(1 + 0.9 * gk).toFixed(3)})` : '';
  });
  // tagline + CTA
  measure(tag); measure(cta);
  const tp = P(t, T.end + 0.75, T.end + 1.6, E.outExpo);
  place(tag, { x: W / 2, y: WM.tag + (1 - tp) * 26, op: tp, blur: (1 - tp) * 6 });
  const cp = spring(t - T.end - 1.1, 150, 15);
  place(cta, { x: W / 2, y: WM.cta + (1 - cp) * 20, s: lerp(0.85, 1, cp), op: clamp(cp * 1.6) });
}

/* ═══════════════════════ seek ═══════════════════════ */
let stageScale = 1;
// handheld-style jolt on the three impacts (ignition, drop, logo hit)
function shake(t) {
  let x = 0, y = 0, r = 0;
  for (const [t0, amp] of [[T.dot, 2.5], [T.pass, 9], [T.end, 7]]) {
    const d = t - t0; if (d < 0 || d > 0.6) continue;
    const k = amp * Math.exp(-d * 8.5) * Math.min(1, d / 0.012);
    x += k * Math.sin(d * 91 + t0); y += k * 0.8 * Math.cos(d * 79 + 2 * t0); r += k * 0.035 * Math.sin(d * 67);
  }
  return Math.abs(x) + Math.abs(y) < 0.02 ? '' : `translate(${f2(x)}px,${f2(y)}px) rotate(${r.toFixed(3)}deg) scale(1.012)`;
}
function seek(t) {
  t = clamp(t, 0, DURATION);
  const sh = shake(t);
  bgc.style.transform = sh; world.style.transform = sh; fxc.style.transform = sh;
  updateAct1(t);
  updateAct2Wrapper(t);
  updatePhone(t);
  updateAct2Text(t);
  updateEnd(t);
  drawBG(t);
  drawFX(t);
  $('#dbg').textContent = t.toFixed(2) + 's';
}

/* ═══════════════════════ boot ═══════════════════════ */
async function boot() {
  const faces = ['300', '500', '600', '700', '800'].map(w => `${w} 40px Outfit`).concat(['400', '500', '600', '700'].map(w => `${w} 40px "DM Sans"`), ['900 40px "Arial Black"', '300 40px Arial']);
  await Promise.all(faces.map(fc => document.fonts.load(fc)));
  await document.fonts.ready;
  fit();
  // measure static boxes
  DOCS.forEach(d => measure(d.el));
  [...FEAT.map(d => d.el), push, erp, tag, cta, ...chipsGR, ...chipsOD].forEach(measure);
  paintGradientWords(hDash, '#b5d5ff', C.blue);
  paintGradientWords(hTO, '#93c5fd', '#3b82f6');
  paintGradientWords(hEX, '#6ee7b7', '#10b981');
  paintGradientWords(hNO, '#c4b5fd', '#8b5cf6');
  // brand gradient on "One portal." and "Odoo."
  const grad = (w, c1, c2) => Object.assign(w.style, { backgroundImage: `linear-gradient(95deg, ${c1}, ${c2})`, webkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' });
  hl1Words.slice(2).forEach(w => grad(w, '#b5d5ff', C.blue));
  grad(hOD.words.flat().at(-1), '#b5d5ff', C.blue);
  computeLayout();
  seek(0);
  window.__ready = true;
}
function fit() {
  if (RENDER) { stageScale = 1; return; }
  const vw = innerWidth, vh = innerHeight - 64;
  stageScale = Math.min(vw / W, vh / H);
  stage.style.transform = `scale(${stageScale})`;
  stage.style.margin = `${(H * stageScale - H) / 2}px ${(W * stageScale - W) / 2}px`;
}
window.addEventListener('resize', () => { fit(); });
window.__seek = seek;
// motion-blur sample density (render.mjs): calm shots need few sub-frames, whip pans need many
const MB = [[1.36, 2.48, 14], [3.38, 4.4, 28], [4.4, 4.95, 12], [5.68, 6.16, 12], [6.76, 7.26, 10], [7.8, 8.42, 44],
  [8.82, 9.3, 10], [9.8, 10.42, 44], [10.48, 11.0, 18], [11.78, 12.62, 26], [13.8, 14.55, 26], [15.4, 16.12, 36], [16.0, 17.1, 8]];
window.__samples = t => MB.reduce((n, [a, b, k]) => (t >= a && t <= b ? Math.max(n, k) : n), 6);
window.__duration = DURATION;
window.__T = T;

// preview player
if (!RENDER) {
  const btn = $('#play'), scrub = $('#scrub'), tc = $('#tc'), mute = $('#mute'), audio = $('#music');
  let playing = false, cur = Number(Q.get('t') || 0), wall0 = 0, t0 = 0, muted = false;
  const set = v => { cur = v; scrub.value = v; tc.textContent = v.toFixed(2) + ' s'; seek(v); };
  btn.onclick = () => {
    playing = !playing; btn.textContent = playing ? 'Pause' : 'Play';
    if (playing) { if (cur >= DURATION - 0.01) cur = 0; wall0 = performance.now(); t0 = cur; audio.currentTime = cur; if (!muted) audio.play().catch(() => {}); }
    else audio.pause();
  };
  mute.onclick = () => { muted = !muted; mute.textContent = muted ? 'Sound: off' : 'Sound: on'; if (muted) audio.pause(); else if (playing) { audio.currentTime = cur; audio.play().catch(() => {}); } };
  scrub.oninput = () => { set(Number(scrub.value)); if (playing) { wall0 = performance.now(); t0 = cur; audio.currentTime = cur; } };
  addEventListener('keydown', e => {
    if (e.code === 'Space') { e.preventDefault(); btn.click(); }
    if (e.code === 'ArrowRight') set(Math.min(DURATION, cur + (e.shiftKey ? 0.5 : 1 / 60)));
    if (e.code === 'ArrowLeft') set(Math.max(0, cur - (e.shiftKey ? 0.5 : 1 / 60)));
  });
  const loop = now => {
    if (playing) { const v = t0 + (now - wall0) / 1000; if (v >= DURATION) { playing = false; btn.textContent = 'Play'; audio.pause(); set(DURATION); } else set(v); }
    requestAnimationFrame(loop);
  };
  boot().then(() => { set(cur); requestAnimationFrame(loop); });
} else boot();
})();
