// Shadow Portal app screens, LIGHT theme — reconstructed from production-version components.
// Every builder returns a 390×844 element plus handles for the film to animate.
// Synthetic demo data only (see assumptions.md).

export const APP = {
  bg: '#F6F8FB', text: '#111827', card: '#ffffff', primary: '#2563EB', muted: '#64748B',
  info: '#3b82f6', success: '#10b981', warning: '#f59e0b', error: '#ef4444',
};
export const DEMO = {
  employee: 'Yasmine Alaoui', first: 'Yasmine', department: 'Sales',
  type: 'Paid Time Off', from: '2026-10-12', to: '2026-10-16', days: 5, balance: '18 days / 24',
  reason: 'Family trip', dashDate: 'Monday, Oct 5', clock: '9:41',
  odooFrom: '10/12/2026', odooTo: '10/16/2026', approvedAt: '10:42 AM',
};

export const icon = (n, s = 24, c = 'currentColor', w = 2) =>
  `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${window.ICONS[n]}</svg>`;
// React Native "color + 'NN'" hex-alpha suffix
export const RN = (hex, sfx) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${(parseInt(sfx, 16) / 255).toFixed(3)})`; };
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

const STATUS_ICONS = (c = '#111827') => `
  <svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="0.8" fill="${c}"/><rect x="5" y="5.5" width="3" height="6.5" rx="0.8" fill="${c}"/><rect x="10" y="3" width="3" height="9" rx="0.8" fill="${c}"/><rect x="15" y="0" width="3" height="12" rx="0.8" fill="${c}"/></svg>
  <svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 11.5 10.4 8.9a3.4 3.4 0 0 0-4.8 0z" fill="${c}"/><path d="M3.5 6.8a6.3 6.3 0 0 1 9 0l1.3-1.4a8.3 8.3 0 0 0-11.6 0z" fill="${c}"/><path d="M.9 4.1a10 10 0 0 1 14.2 0l1.3-1.4a12 12 0 0 0-16.8 0z" fill="${c}"/></svg>
  <svg width="26" height="12" viewBox="0 0 26 12"><rect x=".5" y=".5" width="22" height="11" rx="3.4" fill="none" stroke="${c}" stroke-opacity=".4"/><rect x="2" y="2" width="17" height="8" rx="2" fill="${c}"/><path d="M24 4v4a2 2 0 0 0 0-4z" fill="${c}" fill-opacity=".45"/></svg>`;

function chrome(root, { tab = null, tabbar = true } = {}) {
  root.appendChild(el('div', 'os-status', `<span>${DEMO.clock}</span><span class="icons">${STATUS_ICONS()}</span>`));
  root.appendChild(el('div', 'app-header', `<div class="search-pill">${icon('search', 18, APP.muted)}Search...</div><div class="bell">${icon('bell', 24, APP.text)}<div class="dot"></div></div>`));
  if (tabbar) {
    const tb = el('div', 'tabbar');
    for (const [k, n] of [['home', 'house'], ['plus', 'plus'], ['user', 'user']]) {
      const on = k === tab;
      tb.appendChild(el('div', 'tab', icon(n, 28, on ? APP.primary : APP.muted, on ? 3 : 2)));
    }
    root.appendChild(tb);
  }
}

// ── app/(app)/dashboard.tsx ──────────────────────────────────────────────────
export function dashboardScreen() {
  const root = el('div', 'app');
  const content = el('div', 'content');
  const W = APP.warning, I = APP.info, S = APP.success;
  content.innerHTML = `<div class="scroller dash">
    <div class="dash-head"><div><div class="dash-date">${DEMO.dashDate}</div><div class="dash-welcome">Welcome back,<br>${DEMO.first}</div></div>
      <div class="fab">${icon('plus', 24, '#fff', 3)}</div></div>
    <div class="gap16">
      <div class="acard" style="background:${RN(W, '18')}">
        <div style="position:absolute;right:-20px;top:-20px;opacity:.07;transform:rotate(15deg)">${icon('clock', 160, W, 2)}</div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
          <div class="itile" style="background:${RN(W, '30')}">${icon('clock', 20, W, 2.5)}</div>
          <div class="pill" style="background:${RN(W, '30')};color:${W}">Priority</div></div>
        <div style="font:500 15px/20px 'DM Sans';color:${W};opacity:.9;margin-bottom:4px">Pending Approval</div>
        <div style="font:700 42px/1.15 Outfit;letter-spacing:-1px;margin-bottom:16px">1 Waiting</div>
        <div class="chips">${[['0', 'Leave', I], ['1', 'Expense', S], ['1', 'IT', W], ['0', 'Maintenance', APP.error]]
          .map(([n, l, c]) => `<div class="chip" style="background:${RN(c, '28')};color:${c}"><b>${n}</b>${l}</div>`).join('')}</div>
      </div>
      <div class="acard" style="background:${RN(I, '18')}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px">
          <div class="itile" style="background:${RN(I, '30')}">${icon('plus', 20, I, 2.5)}</div>
          <div style="font:700 14px/20px 'DM Sans';color:${I};opacity:.9">Quick Actions</div></div>
        <div class="qa">${[['calendar', 'Time Off'], ['dollar-sign', 'Expense'], ['timer', 'Timesheet'], ['', 'More']]
          .map(([n, l]) => `<div class="it"><div class="tile" style="background:${RN(I, '28')}">${n ? icon(n, 22, I, 2) : `<span style="font:700 16px Outfit;color:${I}">...</span>`}</div>${l}</div>`).join('')}</div>
      </div>
      <div class="srow">
        <div class="acard" style="background:${RN(S, '18')}"><div class="itile" style="background:${RN(S, '30')};align-self:flex-start">${icon('timer', 20, S, 2.5)}</div>
          <div><div style="font:500 13px 'DM Sans';color:${S};opacity:.9;margin-bottom:2px">Timesheet</div><div style="font:700 22px Outfit">12 Entries</div><div style="font:500 13px 'DM Sans';opacity:.5;margin-top:4px">Tap to log hours</div></div></div>
        <div class="acard" style="background:${RN(W, '18')}"><div class="itile" style="background:${RN(W, '30')};align-self:flex-start">${icon('monitor', 20, W, 2.5)}</div>
          <div><div style="font:500 13px 'DM Sans';color:${W};opacity:.9;margin-bottom:2px">IT + Maintenance</div><div style="font:700 22px Outfit">1 Open</div><div style="font:500 13px 'DM Sans';opacity:.5;margin-top:4px">Active requests</div></div></div>
      </div>
    </div></div>`;
  root.appendChild(content);
  chrome(root, { tab: 'home' });
  return { root };
}

// ── new-request.tsx → renderTimeOffForm (tab bar hidden while a form is open) ───
export function timeOffScreen() {
  const root = el('div', 'app');
  const content = el('div', 'content');
  const I = APP.info;
  content.innerHTML = `<div class="scroller form">
    <div class="back">${icon('chevron-left', 20, APP.text, 2)}<span style="margin-left:4px">Back</span></div>
    <div class="ftitle">New Time Off</div><div class="fsub">Fill in the details below</div>
    <div class="flabel">Leave Type</div>
    <div class="select on" data-k="type"><span>${DEMO.type}</span>${icon('chevron-down', 18, APP.muted, 2)}</div>
    <div class="balance">Balance <b>${DEMO.balance}</b></div>
    <div class="flabel">Duration</div>
    <div class="dcard">
      <div class="l">From</div><div class="datef" data-k="from"><span>${DEMO.from}</span>${icon('calendar', 20, APP.muted, 2)}</div>
      <div class="divider"></div>
      <div class="l">To</div><div class="datef" data-k="to"><span>${DEMO.to}</span>${icon('calendar', 20, APP.muted, 2)}</div>
      <div class="req">Requested <b>≈ ${DEMO.days} days</b></div>
      <div class="hint">Excludes weekends — final duration follows your work schedule and public holidays.</div>
    </div>
    <div class="flabel">Reason (Optional)</div>
    <div class="note">${DEMO.reason}</div>
    <div class="flabel" style="margin-bottom:14px">Supporting Documents <small>(0/3)</small></div>
    <div class="attach"><div class="addtile">${icon('paperclip', 20, APP.muted, 2)}Add</div></div>
    <div class="submit" data-k="submit"><span class="lb">Submit Request</span></div>
  </div>`;
  root.appendChild(content);
  chrome(root, { tabbar: false });
  const toast = el('div', 'toast', `<div class="ic">${icon('circle-check-big', 20, APP.success, 2.5)}</div><span>Time off request submitted!</span>`);
  root.appendChild(toast);
  return {
    root, toast,
    scroller: content.querySelector('.scroller'),
    submit: content.querySelector('[data-k=submit]'),
    submitLabel: content.querySelector('[data-k=submit] .lb'),
    type: content.querySelector('[data-k=type]'),
    from: content.querySelector('[data-k=from]'),
  };
}

// ── new-request.tsx → renderHub: the six supported applications (shown after a successful submit, with the toast) ─
export function hubScreen() {
  const root = el('div', 'app');
  const content = el('div', 'content');
  const big = (k, c, i, t, s) => `<div class="hubcard" data-k="${k}" style="background:${RN(c, '18')}">
    <div style="position:absolute;right:-20px;top:-20px;opacity:.12;transform:rotate(15deg)">${icon(i, 160, c, 2)}</div>
    <div style="width:56px;height:56px;border-radius:20px;display:grid;place-items:center;background:${RN(c, '28')}">${icon(i, 28, c, 2)}</div>
    <div><div style="font:700 28px/1.2 Outfit;color:${c};margin-bottom:8px">${t}</div><div style="font:500 16px 'DM Sans';color:${APP.muted}">${s}</div></div>
    <div style="position:absolute;right:24px;bottom:24px;width:48px;height:48px;border-radius:24px;display:grid;place-items:center;background:${RN(c, '28')}">${icon('arrow-right', 24, c, 2)}</div></div>`;
  const half = (k, c, i, t, s) => `<div class="hubhalf" data-k="${k}" style="background:${RN(c, '18')}">
    <div style="position:absolute;right:-10px;top:-10px;opacity:.1">${icon(i, 100, c, 2)}</div>
    <div style="width:44px;height:44px;border-radius:16px;display:grid;place-items:center;background:${RN(c, '28')}">${icon(i, 22, c, 2)}</div>
    <div><div style="font:700 20px/1.2 Outfit;color:${c};margin-bottom:4px">${t}</div><div style="font:400 13px 'DM Sans';color:${APP.muted}">${s}</div></div></div>`;
  content.innerHTML = `<div class="scroller form hub" style="padding-top:34px">
    <div class="hubtitle"><div style="font:700 32px/1.2 Outfit">New Request</div>
      <div style="font:400 16px 'DM Sans';color:${APP.muted};margin-top:8px">What would you like to submit today?</div></div>
    ${big('timeoff', APP.info, 'clock', 'Time Off', 'Vacation, Sick Leave &amp; More')}
    ${big('expense', APP.success, 'dollar-sign', 'Expense Claim', 'Reimbursements &amp; Purchases')}
    ${big('attendance', APP.warning, 'user-check', 'Attendance', 'Fix a missed check-in or check-out')}
    <div class="hubmore">More Options</div>
    <div class="hubrow">${half('timesheet', APP.success, 'timer', 'Timesheet', 'Log your hours')}${half('helpdesk', APP.error, 'monitor', 'Helpdesk', 'Report an issue')}</div>
    <div class="hubwide" data-k="maintenance" style="background:${RN(APP.info, '18')}">
      <div style="position:absolute;right:-10px;top:-10px;opacity:.09">${icon('wrench', 100, APP.info, 2)}</div>
      <div style="display:flex;align-items:center;gap:16px">
        <div style="width:48px;height:48px;border-radius:16px;display:grid;place-items:center;background:${RN(APP.info, '28')}">${icon('wrench', 24, APP.info, 2)}</div>
        <div><div style="font:700 22px/1.2 Outfit;color:${APP.info}">Maintenance</div><div style="font:400 14px 'DM Sans';color:${APP.muted}">Equipment &amp; facility issues</div></div></div>
      <div style="width:40px;height:40px;border-radius:20px;display:grid;place-items:center;background:${RN(APP.info, '28')}">${icon('arrow-right', 20, APP.info, 2)}</div></div>
  </div>`;
  root.appendChild(content);
  chrome(root, { tab: 'plus' });
  const toast = el('div', 'toast', `<div class="ic">${icon('circle-check-big', 20, APP.success, 2.5)}</div><span>Time off request submitted!</span>`);
  root.appendChild(toast);
  const q = k => content.querySelector(`[data-k=${k}]`);
  return { root, toast, scroller: content.querySelector('.scroller'), title: content.querySelector('.hubtitle'),
    cards: { timeoff: q('timeoff'), expense: q('expense'), attendance: q('attendance'), timesheet: q('timesheet'), helpdesk: q('helpdesk'), maintenance: q('maintenance') } };
}

// ── app/(app)/notifications.tsx (Inbox) ─────────────────────────────────────────
export function inboxScreen() {
  const root = el('div', 'app');
  const content = el('div', 'content');
  const S = APP.success, E = APP.success;
  // groups are separated by the list's gap:24; the Today group only exists once it has an item
  content.innerHTML = `<div class="scroller inbox">
    <div class="inbox-head"><h1>Inbox</h1><p data-k="unread">1 unread message</p></div>
    <div data-k="todaywrap" style="overflow:hidden"><div data-k="todayin" style="padding-bottom:24px">
    <div class="group">Today</div>
    <div class="nlist" data-k="today">
      <div class="nitem unread" data-k="new">
        <div class="ic" style="background:${RN(S, '20')}">${icon('check', 20, S, 3)}</div>
        <div style="flex:1;min-width:0"><div class="tt"><b>Request Approved ✅</b><time>${DEMO.approvedAt}</time></div>
          <div class="msg">Your time off request “${DEMO.reason}” has been approved.</div></div>
      </div>
    </div></div></div>
    <div class="group">Yesterday</div>
    <div class="nlist">
      <div class="nitem read">
        <div class="ic" style="background:${RN(E, '20')}">${icon('check', 20, E, 3)}</div>
        <div style="flex:1;min-width:0"><div class="tt"><b>Expense Approved ✅</b><time>Yesterday</time></div>
          <div class="msg">Your expense “Client lunch” has been approved.</div></div>
      </div>
    </div>
  </div>`;
  root.appendChild(content);
  chrome(root, { tab: null });
  return {
    root, item: content.querySelector('[data-k=new]'), list: content.querySelector('[data-k=today]'), scroller: content.querySelector('.scroller'),
    todayWrap: content.querySelector('[data-k=todaywrap]'), todayIn: content.querySelector('[data-k=todayin]'), unread: content.querySelector('[data-k=unread]'),
  };
}

// ── app/login.tsx → Company Setup step (dark theme: zinc-950 background, white primary button) ──────
export function companySetupScreen(code = 'SP-00042') {
  const root = el('div', 'app dark');
  root.appendChild(el('div', 'os-status', `<span>${DEMO.clock}</span><span class="icons">${STATUS_ICONS('#ffffff')}</span>`));
  const c = el('div', 'setup');
  c.innerHTML = `<div class="setup-head"><div class="setup-ic">${icon('building-2', 36, '#ffffff', 2)}</div>
      <div class="setup-title">Welcome</div><div class="setup-sub">Enter your company code to get started</div></div>
    <div class="setup-form"><div><div class="setup-label">Company Code</div><div class="setup-input">${code}</div></div>
      <div class="setup-btn">Continue</div></div>`;
  root.appendChild(c);
  return { root };
}

// ── Odoo 17 hr.leave record — isolated reconstruction of the relevant fields ────
export function odooRecord() {
  const root = el('div', 'odoo');
  root.innerHTML = `
    <div class="crumb">Time Off <span style="padding:0 6px">/</span> <b>${DEMO.employee} on ${DEMO.type}: ${DEMO.days.toFixed(2)} days (${DEMO.odooFrom})</b></div>
    <div class="bar">
      <div class="btns"><span class="btn primary" data-k="approve">Approve</span><span class="btn secondary">Refuse</span></div>
      <div class="status"><span data-k="s1" class="cur">To Approve</span><span data-k="s2">Approved</span></div>
    </div>
    <div class="sheet">
      <div class="row"><div class="k">Employee</div><div class="v"><span class="avatar">YA</span>${DEMO.employee}</div></div>
      <div class="row"><div class="k">Time Off Type</div><div class="v">${DEMO.type}</div></div>
      <div class="row"><div class="k">Dates</div><div class="v">${DEMO.odooFrom}<span class="arrow">→</span>${DEMO.odooTo}</div></div>
      <div class="row"><div class="k">Duration</div><div class="v">${DEMO.days.toFixed(2)} Days</div></div>
      <div class="row"><div class="k">Description</div><div class="v">${DEMO.reason}</div></div>
    </div>`;
  return {
    root,
    approve: root.querySelector('[data-k=approve]'),
    s1: root.querySelector('[data-k=s1]'), s2: root.querySelector('[data-k=s2]'),
  };
}

export const POINTER = `<svg width="26" height="34" viewBox="0 0 26 34"><path d="M2 2 L2 27 L8.5 20.8 L13 31 L17.5 29 L13.2 19.2 L22 19 Z" fill="#111827" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/></svg>`;
