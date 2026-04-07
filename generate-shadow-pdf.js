const fs = require('fs');
const path = require('path');

// ── HTML Content ──────────────────────────────────────────────────────────────

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Shadow — Complete Documentation</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap');

  :root {
    --navy:   #0F172A;
    --navy2:  #1E293B;
    --blue:   #2563EB;
    --blue2:  #3B82F6;
    --blue3:  #93C5FD;
    --sky:    #EFF6FF;
    --sky2:   #DBEAFE;
    --slate:  #475569;
    --muted:  #94A3B8;
    --border: #E2E8F0;
    --white:  #FFFFFF;
    --green:  #059669;
    --greenl: #D1FAE5;
    --red:    #DC2626;
    --redl:   #FEE2E2;
    --amber:  #D97706;
    --amberl: #FEF3C7;
    --purple: #7C3AED;
    --purplel:#F5F3FF;
    --body:   #F8FAFC;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Inter', -apple-system, sans-serif;
    font-size: 10pt;
    line-height: 1.6;
    color: var(--navy);
    background: var(--white);
  }

  /* ── PAGE BREAKS ── */
  .page-break { page-break-after: always; height: 0; }

  /* ── COVER PAGE ── */
  .cover {
    width: 100%;
    min-height: 100vh;
    background: linear-gradient(135deg, #0F172A 0%, #1E3A5F 50%, #0F172A 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 80px;
    position: relative;
    overflow: hidden;
  }
  .cover::before {
    content: '';
    position: absolute;
    top: -100px; right: -100px;
    width: 400px; height: 400px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(37,99,235,0.25) 0%, transparent 70%);
  }
  .cover::after {
    content: '';
    position: absolute;
    bottom: -80px; left: -80px;
    width: 350px; height: 350px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%);
  }
  .cover-logo {
    width: 90px; height: 90px;
    border-radius: 24px;
    background: linear-gradient(135deg, #2563EB, #7C3AED);
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 32px;
    box-shadow: 0 20px 60px rgba(37,99,235,0.4);
  }
  .cover-logo span { font-size: 44px; color: white; font-weight: 900; font-family: 'Inter'; }
  .cover-title {
    font-size: 72pt;
    font-weight: 900;
    color: white;
    letter-spacing: -2px;
    margin-bottom: 12px;
    text-align: center;
  }
  .cover-sub {
    font-size: 16pt;
    font-weight: 300;
    color: #93C5FD;
    margin-bottom: 40px;
    text-align: center;
  }
  .cover-divider {
    width: 80px; height: 3px;
    background: linear-gradient(90deg, #2563EB, #7C3AED);
    border-radius: 2px;
    margin: 0 auto 40px;
  }
  .cover-meta {
    font-size: 11pt;
    color: #64748B;
    text-align: center;
    margin-bottom: 60px;
  }
  .cover-pills {
    display: flex; gap: 12px; flex-wrap: wrap; justify-content: center;
    margin-bottom: 48px;
  }
  .cover-pill {
    padding: 8px 20px;
    border-radius: 100px;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.12);
    color: #CBD5E1;
    font-size: 9.5pt;
    font-weight: 500;
  }
  .cover-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    width: 100%;
    max-width: 700px;
  }
  .cover-stat {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 16px;
    padding: 20px 16px;
    text-align: center;
  }
  .cover-stat-num {
    font-size: 22pt; font-weight: 800; color: #60A5FA;
    display: block; margin-bottom: 4px;
  }
  .cover-stat-label {
    font-size: 8pt; color: #64748B; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;
  }

  /* ── CONTENT WRAPPER ── */
  .content { padding: 52px 72px; max-width: 100%; }

  /* ── SECTION HEADER BANNER ── */
  .section-banner {
    background: linear-gradient(135deg, var(--navy) 0%, #1E3A5F 100%);
    border-radius: 16px;
    padding: 32px 40px;
    margin: 0 0 36px 0;
    display: flex; align-items: center; gap: 20px;
    page-break-inside: avoid;
  }
  .section-num {
    font-size: 48pt; font-weight: 900; color: rgba(255,255,255,0.12);
    line-height: 1; flex-shrink: 0;
  }
  .section-titles { flex: 1; }
  .section-label {
    font-size: 8pt; font-weight: 600; color: #60A5FA;
    text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 4px;
  }
  .section-title { font-size: 22pt; font-weight: 800; color: white; line-height: 1.2; }
  .section-desc { font-size: 10pt; color: #94A3B8; margin-top: 6px; }

  /* ── HEADINGS ── */
  h2 {
    font-size: 14pt; font-weight: 700; color: var(--navy);
    margin: 36px 0 12px;
    padding-bottom: 8px;
    border-bottom: 2px solid var(--sky2);
    page-break-after: avoid;
  }
  h3 {
    font-size: 11pt; font-weight: 600; color: var(--blue);
    margin: 24px 0 8px;
    page-break-after: avoid;
  }

  /* ── BODY TEXT ── */
  p { margin-bottom: 10px; font-size: 10pt; color: #334155; line-height: 1.65; }

  /* ── LISTS ── */
  ul, ol { margin: 8px 0 12px 24px; }
  li { margin-bottom: 5px; font-size: 10pt; color: #334155; line-height: 1.6; }
  li::marker { color: var(--blue); font-weight: 600; }

  /* ── TABLES ── */
  .tbl-wrap { margin: 16px 0 24px; overflow: hidden; border-radius: 12px; border: 1px solid var(--border); page-break-inside: avoid; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  thead tr { background: var(--navy); }
  thead th {
    padding: 11px 14px; text-align: left;
    color: white; font-weight: 600; font-size: 8.5pt;
    text-transform: uppercase; letter-spacing: 0.5px;
    border-right: 1px solid rgba(255,255,255,0.1);
  }
  thead th:last-child { border-right: none; }
  tbody tr:nth-child(even) { background: #F8FAFC; }
  tbody tr:hover { background: #EFF6FF; }
  td { padding: 10px 14px; border-bottom: 1px solid var(--border); border-right: 1px solid var(--border); vertical-align: top; line-height: 1.5; }
  td:last-child { border-right: none; }
  tr:last-child td { border-bottom: none; }
  .td-key { font-weight: 600; color: var(--navy); white-space: nowrap; }
  .td-code { font-family: 'JetBrains Mono', monospace; font-size: 8.5pt; color: var(--purple); }
  .td-muted { color: var(--slate); font-size: 9pt; }
  .badge {
    display: inline-block; padding: 2px 8px; border-radius: 100px;
    font-size: 8pt; font-weight: 600;
  }
  .badge-yes  { background: var(--greenl); color: #065F46; }
  .badge-no   { background: #FEF9C3; color: #713F12; }
  .badge-jwt  { background: var(--sky2); color: #1D4ED8; }
  .badge-none { background: var(--amberl); color: #92400E; }
  .badge-admin{ background: var(--redl); color: #991B1B; }
  .badge-get  { background: var(--greenl); color: #065F46; }
  .badge-post { background: var(--sky2); color: #1D4ED8; }
  .badge-put  { background: #F5F3FF; color: #6D28D9; }
  .badge-del  { background: var(--redl); color: #991B1B; }

  /* ── CODE BLOCKS ── */
  .code-block {
    background: #0F172A;
    border-radius: 12px;
    padding: 20px 24px;
    margin: 12px 0 20px;
    overflow: hidden;
    page-break-inside: avoid;
    border: 1px solid #1E293B;
  }
  .code-block pre {
    font-family: 'JetBrains Mono', 'Courier New', monospace;
    font-size: 8.5pt;
    line-height: 1.7;
    color: #E2E8F0;
    white-space: pre;
  }
  .code-block .c-comment { color: #64748B; }
  .code-block .c-key { color: #7DD3FC; }
  .code-block .c-val { color: #86EFAC; }
  .code-block .c-str { color: #FCA5A5; }
  .code-block .c-cmd { color: #FDE68A; }
  .code-label {
    font-size: 8pt; font-weight: 600; color: var(--muted);
    text-transform: uppercase; letter-spacing: 1px;
    margin-bottom: 6px;
  }

  /* ── CALLOUT BOXES ── */
  .callout {
    border-radius: 12px; padding: 18px 22px; margin: 14px 0 20px;
    border-left: 4px solid;
    page-break-inside: avoid;
  }
  .callout-blue { background: var(--sky); border-color: var(--blue); }
  .callout-green { background: var(--greenl); border-color: var(--green); }
  .callout-amber { background: var(--amberl); border-color: var(--amber); }
  .callout-red   { background: var(--redl);   border-color: var(--red); }
  .callout-title { font-weight: 700; font-size: 10pt; margin-bottom: 6px; }
  .callout-blue .callout-title { color: var(--blue); }
  .callout-green .callout-title { color: var(--green); }
  .callout-amber .callout-title { color: var(--amber); }
  .callout-red .callout-title   { color: var(--red); }
  .callout p, .callout li { font-size: 9.5pt; margin-bottom: 4px; }
  .callout ul { margin: 4px 0 0 18px; }

  /* ── CHECKLIST ── */
  .checklist { list-style: none; margin: 8px 0 16px 0; padding: 0; }
  .checklist li {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 6px 0;
    border-bottom: 1px solid var(--border);
    font-size: 9.5pt;
  }
  .checklist li:last-child { border-bottom: none; }
  .checkbox {
    width: 16px; height: 16px; border-radius: 4px; flex-shrink: 0;
    border: 2px solid #CBD5E1; margin-top: 2px;
  }

  /* ── FEATURE CARDS (checklist sections) ── */
  .feature-card {
    border: 1px solid var(--border);
    border-radius: 12px;
    margin: 16px 0;
    overflow: hidden;
    page-break-inside: avoid;
  }
  .feature-card-header {
    padding: 12px 18px;
    background: linear-gradient(135deg, var(--navy) 0%, #1E3A5F 100%);
    display: flex; align-items: center; gap: 10px;
  }
  .feature-num {
    width: 26px; height: 26px; border-radius: 50%;
    background: rgba(255,255,255,0.15);
    display: flex; align-items: center; justify-content: center;
    font-size: 9pt; font-weight: 700; color: white; flex-shrink: 0;
  }
  .feature-title { font-size: 11pt; font-weight: 700; color: white; }
  .feature-body { padding: 14px 18px; }

  /* ── STEP NUMBERS ── */
  .steps { counter-reset: step; list-style: none; margin: 8px 0 16px 0; padding: 0; }
  .steps li {
    counter-increment: step;
    display: flex; gap: 14px; margin-bottom: 10px;
    align-items: flex-start;
  }
  .steps li::before {
    content: counter(step);
    min-width: 26px; height: 26px; border-radius: 50%;
    background: var(--blue); color: white;
    font-size: 9pt; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; margin-top: 1px;
  }
  .steps li span { font-size: 10pt; color: #334155; line-height: 1.6; }

  /* ── INFO GRID ── */
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 16px 0; }
  .info-card {
    border: 1px solid var(--border); border-radius: 12px;
    padding: 18px 20px; background: var(--white);
    page-break-inside: avoid;
  }
  .info-card-title { font-weight: 700; font-size: 10.5pt; color: var(--navy); margin-bottom: 8px; }
  .info-card p { font-size: 9pt; color: var(--slate); }

  /* ── TOC ── */
  .toc { margin: 0 0 32px; }
  .toc-section { margin-bottom: 8px; }
  .toc-row {
    display: flex; justify-content: space-between; align-items: baseline;
    padding: 5px 0;
    border-bottom: 1px dotted #CBD5E1;
  }
  .toc-main { font-weight: 700; font-size: 11pt; color: var(--navy); }
  .toc-sub  { font-size: 9.5pt; color: var(--slate); padding-left: 20px; }
  .toc-page { font-size: 9pt; color: var(--muted); font-weight: 500; }

  /* ── HR ── */
  hr { border: none; border-top: 2px solid var(--border); margin: 32px 0; }

  /* ── FOOTER BAR ── */
  .footer-bar {
    background: var(--navy);
    color: #64748B;
    font-size: 8.5pt;
    padding: 16px 72px;
    display: flex; justify-content: space-between; align-items: center;
  }

  /* ── PRINT ── */
  @media print {
    body { font-size: 9.5pt; }
    .cover { min-height: 100vh; }
    .page-break { page-break-after: always; }
    h2 { page-break-after: avoid; }
    h3 { page-break-after: avoid; }
    .feature-card { page-break-inside: avoid; }
    .tbl-wrap { page-break-inside: avoid; }
    .code-block { page-break-inside: avoid; }
    .callout { page-break-inside: avoid; }
  }
</style>
</head>
<body>

<!-- ══ COVER ═════════════════════════════════════════════════════════════════ -->
<div class="cover">
  <div class="cover-logo"><span>S</span></div>
  <div class="cover-title">Shadow</div>
  <div class="cover-sub">Mobile ERP Companion for Odoo</div>
  <div class="cover-divider"></div>
  <div class="cover-meta">Complete Documentation &nbsp;·&nbsp; Technical &amp; Non-Technical Reference &nbsp;·&nbsp; Version 1.0 &nbsp;·&nbsp; 2026</div>
  <div class="cover-pills">
    <div class="cover-pill">Android App (React Native)</div>
    <div class="cover-pill">Node.js + Vercel Backend</div>
    <div class="cover-pill">Odoo v15 · v16 · v17</div>
    <div class="cover-pill">Multi-Tenant SaaS</div>
    <div class="cover-pill">JWT Authentication</div>
    <div class="cover-pill">Expo Push Notifications</div>
  </div>
  <div class="cover-stats">
    <div class="cover-stat"><span class="cover-stat-num">7</span><span class="cover-stat-label">Features</span></div>
    <div class="cover-stat"><span class="cover-stat-num">27</span><span class="cover-stat-label">API Endpoints</span></div>
    <div class="cover-stat"><span class="cover-stat-num">242</span><span class="cover-stat-label">Tests Passing</span></div>
    <div class="cover-stat"><span class="cover-stat-num">∞</span><span class="cover-stat-label">Tenants</span></div>
  </div>
</div>
<div class="page-break"></div>

<!-- ══ TABLE OF CONTENTS ═══════════════════════════════════════════════════ -->
<div class="content">
  <div class="section-banner">
    <div class="section-num">TOC</div>
    <div class="section-titles">
      <div class="section-label">Navigation</div>
      <div class="section-title">Table of Contents</div>
    </div>
  </div>

  <div class="toc">
    <div class="toc-section">
      <div class="toc-row"><span class="toc-main">Section 1 — What Is Shadow?</span><span class="toc-page">3</span></div>
      <div class="toc-row"><span class="toc-sub">1.1 Who Is It For?</span><span class="toc-page">3</span></div>
      <div class="toc-row"><span class="toc-sub">1.2 What Can Employees Do?</span><span class="toc-page">3</span></div>
      <div class="toc-row"><span class="toc-sub">1.3 How Does Company Isolation Work?</span><span class="toc-page">4</span></div>
      <div class="toc-row"><span class="toc-sub">1.4 What Shadow Does NOT Do</span><span class="toc-page">4</span></div>
    </div>
    <div class="toc-section" style="margin-top:12px;">
      <div class="toc-row"><span class="toc-main">Section 2 — Architecture (Technical)</span><span class="toc-page">5</span></div>
      <div class="toc-row"><span class="toc-sub">2.1 System Overview &amp; Technology Stack</span><span class="toc-page">5</span></div>
      <div class="toc-row"><span class="toc-sub">2.2 File Structure (Backend + Frontend)</span><span class="toc-page">6</span></div>
      <div class="toc-row"><span class="toc-sub">2.3 Multi-Tenancy &amp; Odoo Compatibility</span><span class="toc-page">7</span></div>
      <div class="toc-row"><span class="toc-sub">2.4 Authentication Flow</span><span class="toc-page">8</span></div>
      <div class="toc-row"><span class="toc-sub">2.5 Environment Variables</span><span class="toc-page">8</span></div>
      <div class="toc-row"><span class="toc-sub">2.6 API Endpoints Reference</span><span class="toc-page">9</span></div>
      <div class="toc-row"><span class="toc-sub">2.7 Testing &amp; Deployment</span><span class="toc-page">11</span></div>
    </div>
    <div class="toc-section" style="margin-top:12px;">
      <div class="toc-row"><span class="toc-main">Section 3 — Installation &amp; Feature Testing Guide</span><span class="toc-page">12</span></div>
      <div class="toc-row"><span class="toc-sub">3.1 Installing the APK on Android</span><span class="toc-page">12</span></div>
      <div class="toc-row"><span class="toc-sub">3.2 First Launch &amp; Sign In</span><span class="toc-page">12</span></div>
      <div class="toc-row"><span class="toc-sub">3.3 Feature Testing Checklist (10 Features)</span><span class="toc-page">13</span></div>
      <div class="toc-row"><span class="toc-sub">3.4 Troubleshooting Common Issues</span><span class="toc-page">16</span></div>
    </div>
    <div class="toc-section" style="margin-top:12px;">
      <div class="toc-row"><span class="toc-main">Section 4 — Admin Setup Guide</span><span class="toc-page">17</span></div>
      <div class="toc-row"><span class="toc-sub">4.1 Information to Collect from the Client</span><span class="toc-page">17</span></div>
      <div class="toc-row"><span class="toc-sub">4.2 Odoo API User Permissions</span><span class="toc-page">17</span></div>
      <div class="toc-row"><span class="toc-sub">4.3 Registering the Company via Admin API</span><span class="toc-page">18</span></div>
      <div class="toc-row"><span class="toc-sub">4.4 Verifying &amp; Employee Onboarding</span><span class="toc-page">18</span></div>
      <div class="toc-row"><span class="toc-sub">4.5 Odoo PIN Setup Instructions</span><span class="toc-page">19</span></div>
    </div>
    <div class="toc-section" style="margin-top:12px;">
      <div class="toc-row"><span class="toc-main">Section 5 — Security Notes</span><span class="toc-page">20</span></div>
    </div>
  </div>
</div>
<div class="page-break"></div>

<!-- ══ SECTION 1 — WHAT IS SHADOW? ══════════════════════════════════════════ -->
<div class="content">
  <div class="section-banner">
    <div class="section-num">01</div>
    <div class="section-titles">
      <div class="section-label">Non-Technical Overview</div>
      <div class="section-title">What Is Shadow?</div>
      <div class="section-desc">A plain-language guide for business users, HR teams, and decision-makers</div>
    </div>
  </div>

  <p>Shadow is a mobile application that connects employees to their company's Odoo ERP system directly from their smartphone. Instead of logging into a web browser and navigating complex menus, employees use Shadow to submit leave requests, file expense claims, log timesheets, open IT support tickets, and report maintenance issues — all from a clean, simple interface.</p>

  <h2>1.1 &nbsp; Who Is It For?</h2>
  <p>Shadow is designed for companies already using Odoo ERP (version 15 or later). It benefits three groups:</p>

  <div class="info-grid">
    <div class="info-card">
      <div class="info-card-title">👤 &nbsp; Employees</div>
      <p>Submit requests and check their status on the go, from any location, without needing access to a computer or Odoo directly.</p>
    </div>
    <div class="info-card">
      <div class="info-card-title">🏢 &nbsp; HR Departments</div>
      <p>Reduce email volume significantly. All requests flow directly into Odoo workflows, with push notifications when they are approved or rejected.</p>
    </div>
    <div class="info-card">
      <div class="info-card-title">⚙️ &nbsp; IT Administrators</div>
      <p>Zero Odoo customisation or module installation required. Shadow communicates via Odoo's built-in standard XML-RPC API.</p>
    </div>
    <div class="info-card">
      <div class="info-card-title">💼 &nbsp; Management</div>
      <p>All approvals and workflows continue to happen inside Odoo exactly as before. Shadow does not change any existing processes.</p>
    </div>
  </div>

  <h2>1.2 &nbsp; What Can Employees Do?</h2>
  <div class="tbl-wrap">
    <table>
      <thead>
        <tr><th>Feature</th><th>What It Does</th><th>Where It Goes in Odoo</th></tr>
      </thead>
      <tbody>
        <tr><td class="td-key">Time Off Requests</td><td>Submit annual leave, sick leave, or any custom leave type configured in Odoo</td><td class="td-code">hr.leave model</td></tr>
        <tr><td class="td-key">Expense Claims</td><td>File receipts with photos, amounts, and categories. Up to 3 attachments per claim.</td><td class="td-code">hr.expense model</td></tr>
        <tr><td class="td-key">Timesheet Logging</td><td>Log hours against active projects and tasks with a description of work done</td><td class="td-code">account.analytic.line</td></tr>
        <tr><td class="td-key">IT Support Tickets</td><td>Open helpdesk tickets with subject, description, team assignment, and attachments</td><td class="td-code">helpdesk.ticket model</td></tr>
        <tr><td class="td-key">Maintenance Requests</td><td>Report equipment issues — corrective or preventive — with category and photos</td><td class="td-code">maintenance.request model</td></tr>
        <tr><td class="td-key">Push Notifications</td><td>Real-time alerts when a manager approves or rejects a request in Odoo</td><td class="td-code">Expo Push + Redis</td></tr>
        <tr><td class="td-key">Notification History</td><td>Full timeline of all approvals, rejections, and system messages</td><td class="td-code">Redis (tenant-scoped)</td></tr>
      </tbody>
    </table>
  </div>

  <h2>1.3 &nbsp; How Does Company Isolation Work?</h2>
  <p>Shadow is a <strong>multi-tenant</strong> application. Each company gets a completely isolated environment — one app installation serves unlimited companies and data never crosses between tenants. Employees identify their company by typing a short company code on first launch, then authenticate with their employee ID and a PIN.</p>

  <div class="callout callout-blue">
    <div class="callout-title">Tenant Isolation Guarantee</div>
    <ul>
      <li>Every database key includes the company's unique tenant prefix.</li>
      <li>Every login token (JWT) carries a company ID that is checked on every single API call.</li>
      <li>Each company connects to its own Odoo instance — credentials are never shared.</li>
      <li>A user from Company A cannot read, write, or even detect the existence of Company B's data.</li>
    </ul>
  </div>

  <h2>1.4 &nbsp; What Shadow Does NOT Do</h2>
  <ul>
    <li><strong>Does not replace Odoo.</strong> Approvals, accounting, payroll, and HR workflows still happen inside Odoo. Shadow is a submission interface only.</li>
    <li><strong>Does not store employee personal data.</strong> All employee information is read live from Odoo. Nothing is cached long-term.</li>
    <li><strong>Does not require Odoo customisation.</strong> It communicates via Odoo's built-in standard XML-RPC API — no modules to install.</li>
    <li><strong>Does not support Community Edition helpdesk/maintenance.</strong> Those modules are Enterprise-only. Shadow gracefully shows an "Unavailable" message if a module is missing.</li>
  </ul>
</div>
<div class="page-break"></div>

<!-- ══ SECTION 2 — ARCHITECTURE ══════════════════════════════════════════════ -->
<div class="content">
  <div class="section-banner">
    <div class="section-num">02</div>
    <div class="section-titles">
      <div class="section-label">Technical Reference</div>
      <div class="section-title">Architecture</div>
      <div class="section-desc">Stack, file structure, auth flow, API endpoints, and deployment</div>
    </div>
  </div>

  <h2>2.1 &nbsp; System Overview</h2>
  <p>Shadow consists of three layers that communicate exclusively over HTTPS:</p>
  <ul>
    <li><strong>Mobile App</strong> (React Native / Expo) — Runs natively on Android. Communicates with the backend via REST API only.</li>
    <li><strong>Backend API</strong> (Node.js / Express / Vercel Serverless) — Stateless, JWT-authenticated. Bridges the mobile app to Odoo and Redis.</li>
    <li><strong>Data Layer</strong> (Upstash Redis + Odoo XML-RPC) — Redis stores push tokens, notification history, and tenant configuration. Odoo is the authoritative source for all ERP data.</li>
  </ul>

  <h2>2.2 &nbsp; Technology Stack</h2>
  <div class="tbl-wrap">
    <table>
      <thead><tr><th>Layer</th><th>Technology</th><th>Version / Notes</th></tr></thead>
      <tbody>
        <tr><td class="td-key">Mobile Frontend</td><td>React Native + Expo Router</td><td class="td-muted">Expo SDK 54, React 19</td></tr>
        <tr><td class="td-key">Styling</td><td>NativeWind (Tailwind for RN)</td><td class="td-muted">Custom useColor hook, dark/light tokens</td></tr>
        <tr><td class="td-key">Navigation</td><td>Expo Router (file-based)</td><td class="td-muted">Tab + nested stack navigation</td></tr>
        <tr><td class="td-key">Backend Framework</td><td>Express.js on Vercel Serverless</td><td class="td-muted">Node 18+, globally deployed</td></tr>
        <tr><td class="td-key">Language</td><td>TypeScript</td><td class="td-muted">Strict mode, frontend and backend</td></tr>
        <tr><td class="td-key">Authentication</td><td>JSON Web Tokens (JWT)</td><td class="td-muted">HS256 algorithm, 30-day expiry</td></tr>
        <tr><td class="td-key">Push Notifications</td><td>Expo Push Notification Service</td><td class="td-muted">ExponentPushToken format</td></tr>
        <tr><td class="td-key">Cache / Store</td><td>Upstash Redis REST API</td><td class="td-muted">Notifications, push tokens, tenant config</td></tr>
        <tr><td class="td-key">Odoo Integration</td><td>XML-RPC via custom OdooClient</td><td class="td-muted">v15, v16, v17 compatible</td></tr>
        <tr><td class="td-key">Input Validation</td><td>Zod v4</td><td class="td-muted">All backend route inputs validated</td></tr>
        <tr><td class="td-key">Testing</td><td>Jest + ts-jest + supertest</td><td class="td-muted">157 backend + 85 frontend tests (242 total)</td></tr>
      </tbody>
    </table>
  </div>

  <h2>2.3 &nbsp; Backend File Structure</h2>
  <div class="code-block"><pre><span class="c-key">backend/src/</span>
  <span class="c-cmd">index.ts</span>              <span class="c-comment">Express app entry, route mounting, JWT middleware</span>
  <span class="c-cmd">config.ts</span>             <span class="c-comment">Env var loading — process.exit(1) if any are missing</span>
  <span class="c-key">odoo/</span>
    <span class="c-cmd">client.ts</span>           <span class="c-comment">OdooClient factory: authenticate, searchRead, createRecord, uploadAttachments</span>
  <span class="c-key">lib/</span>
    <span class="c-cmd">tenantStore.ts</span>      <span class="c-comment">CRUD for tenant configs stored in Redis</span>
    <span class="c-cmd">notificationStore.ts</span> <span class="c-comment">Notification CRUD, mark-read, tenant-scoped keys</span>
    <span class="c-cmd">pushStore.ts</span>        <span class="c-comment">Push token save/get/remove, Expo push delivery</span>
    <span class="c-cmd">requestMonitor.ts</span>   <span class="c-comment">Polls Odoo for state changes → generates notifications</span>
    <span class="c-cmd">redis.ts</span>            <span class="c-comment">Thin fetch wrapper for Upstash REST API</span>
  <span class="c-key">routes/</span>
    <span class="c-cmd">auth.ts</span>             <span class="c-comment">Login, tenant lookup, push token endpoints, admin mgmt</span>
    <span class="c-cmd">time_off.ts</span>         <span class="c-comment">Time-off CRUD + leave type field probe chain</span>
    <span class="c-cmd">expenses.ts</span>         <span class="c-comment">Expense CRUD + product lookup with fallback</span>
    <span class="c-cmd">timesheet.ts</span>        <span class="c-comment">Timesheet entries, projects, tasks</span>
    <span class="c-cmd">helpdesk.ts</span>         <span class="c-comment">Helpdesk tickets + availability check</span>
    <span class="c-cmd">maintenance.ts</span>      <span class="c-comment">Maintenance requests + availability check</span>
    <span class="c-cmd">notifications.ts</span>    <span class="c-comment">Notification fetch + mark-read endpoints</span></pre></div>

  <h2>2.4 &nbsp; Frontend File Structure</h2>
  <div class="code-block"><pre><span class="c-key">production-version/</span>
  <span class="c-key">app/</span>
    <span class="c-cmd">login.tsx</span>                  <span class="c-comment">Two-step: company code → employee ID + PIN</span>
    <span class="c-key">(app)/</span>
      <span class="c-cmd">dashboard.tsx</span>            <span class="c-comment">Home screen with quick stats and action cards</span>
      <span class="c-cmd">new-request.tsx</span>          <span class="c-comment">Hub for all 4 request types + timesheet</span>
      <span class="c-cmd">notifications.tsx</span>        <span class="c-comment">Notification list with mark-read</span>
      <span class="c-cmd">request-details.tsx</span>      <span class="c-comment">Detail view for any of the 5 request types</span>
      <span class="c-cmd">settings.tsx</span>             <span class="c-comment">Push toggle, mark-all-read, cache clear, sign-out</span>
      <span class="c-cmd">timesheet.tsx</span>            <span class="c-comment">Timesheet list and new entry creation</span>
  <span class="c-key">providers/</span>
    <span class="c-cmd">auth-context.tsx</span>           <span class="c-comment">SessionProvider: JWT state, tenant, push registration</span>
    <span class="c-cmd">toast-context.tsx</span>          <span class="c-comment">Global toast notification system</span>
  <span class="c-key">api/</span>
    <span class="c-cmd">client.ts</span>                  <span class="c-comment">All API calls, fetch wrapper, 401 auto-signout</span>
  <span class="c-cmd">constants.ts</span>               <span class="c-comment">API_URL pointing to the deployed Vercel backend</span></pre></div>

  <h2>2.5 &nbsp; Multi-Tenancy &amp; Redis Key Design</h2>
  <div class="code-block"><pre><span class="c-comment"># Every Redis key is scoped to a tenant prefix — zero shared data</span>
<span class="c-key">shadow:t:{tenantId}:tenant</span>           <span class="c-comment">Tenant config (Odoo URL, DB, credentials)</span>
<span class="c-key">shadow:t:{tenantId}:notifications</span>    <span class="c-comment">All notifications for this tenant</span>
<span class="c-key">shadow:t:{tenantId}:push:{empId}</span>     <span class="c-comment">Push token for a specific employee</span>
<span class="c-key">shadow:t:{tenantId}:req_cache:{empId}</span> <span class="c-comment">Request state cache for Odoo polling</span>

<span class="c-comment"># JWT payload (signed with JWT_SECRET)</span>
<span class="c-val">{ id: 42, name: "Alice", role: "employee", tenantId: "acmecorp" }</span></pre></div>

  <h2>2.6 &nbsp; Odoo Version Compatibility</h2>
  <div class="tbl-wrap">
    <table>
      <thead><tr><th>Scenario</th><th>Shadow's Strategy</th></tr></thead>
      <tbody>
        <tr><td class="td-key">Leave type field (v15 vs v17)</td><td>Probes <code>work_entry_type_id</code> (v17) then <code>holiday_status_id</code> (v15/v16). Result is cached per tenant to avoid repeat probes.</td></tr>
        <tr><td class="td-key">Expense total_amount_currency</td><td>Creates expense with the field first; if Odoo returns "Invalid field", silently retries without it.</td></tr>
        <tr><td class="td-key">Helpdesk module availability</td><td>Probes the <code>helpdesk.ticket</code> model. Returns <code>available: false</code> gracefully if not installed.</td></tr>
        <tr><td class="td-key">Maintenance module availability</td><td>Same probe strategy — no crash, just a friendly unavailable message shown to the user.</td></tr>
        <tr><td class="td-key">Analytic account for timesheets</td><td>Tries to fetch <code>analytic_account_id</code> from project. Silently skips if the field doesn't exist.</td></tr>
        <tr><td class="td-key">Custom fields (x_ prefix)</td><td>Pass-through — any field returned by Odoo's searchRead is included in API responses automatically.</td></tr>
      </tbody>
    </table>
  </div>

  <h2>2.7 &nbsp; Authentication Flow</h2>
  <ol class="steps">
    <li><span>User enters company code → <code>GET /auth/tenant/:slug</code> → backend reads tenant from Redis → returns company name + HR email.</span></li>
    <li><span>User enters Employee ID + PIN → <code>POST /auth/login</code> → backend fetches Odoo credentials from Redis → calls Odoo XML-RPC <code>authenticate()</code> → Odoo verifies the PIN.</span></li>
    <li><span>On success, backend signs a JWT containing <code>{ id, name, role, tenantId }</code> with a 30-day expiry and returns it.</span></li>
    <li><span>App stores JWT in AsyncStorage. All subsequent requests include the header: <code>Authorization: Bearer {jwt}</code>.</span></li>
    <li><span>If any endpoint returns HTTP 401, the app's fetch wrapper automatically calls <code>signOut()</code>, clearing the session.</span></li>
  </ol>

  <h2>2.8 &nbsp; Environment Variables (Backend)</h2>
  <div class="tbl-wrap">
    <table>
      <thead><tr><th>Variable</th><th style="width:80px;text-align:center;">Required</th><th>Description</th></tr></thead>
      <tbody>
        <tr><td class="td-code">JWT_SECRET</td><td style="text-align:center;"><span class="badge badge-yes">Yes</span></td><td>Secret for signing JWTs. Minimum 32 random characters. Never commit to source control.</td></tr>
        <tr><td class="td-code">ADMIN_SECRET</td><td style="text-align:center;"><span class="badge badge-yes">Yes</span></td><td>Header secret for all <code>/admin/*</code> routes. Keep this highly secure.</td></tr>
        <tr><td class="td-code">UPSTASH_REDIS_REST_URL</td><td style="text-align:center;"><span class="badge badge-yes">Yes</span></td><td>The REST URL of your Upstash Redis instance (e.g. <code>https://xxx.upstash.io</code>).</td></tr>
        <tr><td class="td-code">UPSTASH_REDIS_REST_TOKEN</td><td style="text-align:center;"><span class="badge badge-yes">Yes</span></td><td>REST authentication token for your Upstash Redis instance.</td></tr>
        <tr><td class="td-code">PORT</td><td style="text-align:center;"><span class="badge badge-no">No</span></td><td>Local development port. Defaults to 3000. Not used on Vercel.</td></tr>
      </tbody>
    </table>
  </div>
</div>
<div class="page-break"></div>

<!-- API ENDPOINTS -->
<div class="content">
  <h2>2.9 &nbsp; API Endpoints Reference</h2>
  <div class="tbl-wrap">
    <table>
      <thead><tr><th style="width:70px;">Method</th><th>Endpoint</th><th style="width:90px;text-align:center;">Auth</th><th>Description</th></tr></thead>
      <tbody>
        <tr><td><span class="badge badge-get">GET</span></td><td class="td-code">/auth/tenant/:slug</td><td style="text-align:center;"><span class="badge badge-none">None</span></td><td>Look up a tenant by company code</td></tr>
        <tr><td><span class="badge badge-post">POST</span></td><td class="td-code">/auth/login</td><td style="text-align:center;"><span class="badge badge-none">None</span></td><td>Login with Employee ID + PIN → returns JWT</td></tr>
        <tr><td><span class="badge badge-post">POST</span></td><td class="td-code">/auth/push-token</td><td style="text-align:center;"><span class="badge badge-jwt">JWT</span></td><td>Register an Expo push notification token</td></tr>
        <tr><td><span class="badge badge-del">DEL</span></td><td class="td-code">/auth/push-token</td><td style="text-align:center;"><span class="badge badge-jwt">JWT</span></td><td>Remove the employee's push notification token</td></tr>
        <tr><td><span class="badge badge-get">GET</span></td><td class="td-code">/admin/tenants</td><td style="text-align:center;"><span class="badge badge-admin">Admin</span></td><td>List all registered tenants</td></tr>
        <tr><td><span class="badge badge-post">POST</span></td><td class="td-code">/admin/tenants</td><td style="text-align:center;"><span class="badge badge-admin">Admin</span></td><td>Register or update a tenant configuration</td></tr>
        <tr><td><span class="badge badge-get">GET</span></td><td class="td-code">/time-off</td><td style="text-align:center;"><span class="badge badge-jwt">JWT</span></td><td>List employee's time-off requests</td></tr>
        <tr><td><span class="badge badge-get">GET</span></td><td class="td-code">/time-off/types</td><td style="text-align:center;"><span class="badge badge-jwt">JWT</span></td><td>List available leave types from Odoo</td></tr>
        <tr><td><span class="badge badge-get">GET</span></td><td class="td-code">/time-off/pending</td><td style="text-align:center;"><span class="badge badge-jwt">JWT</span></td><td>List pending (unapproved) leaves</td></tr>
        <tr><td><span class="badge badge-post">POST</span></td><td class="td-code">/time-off</td><td style="text-align:center;"><span class="badge badge-jwt">JWT</span></td><td>Submit a new time-off request</td></tr>
        <tr><td><span class="badge badge-get">GET</span></td><td class="td-code">/expenses</td><td style="text-align:center;"><span class="badge badge-jwt">JWT</span></td><td>List employee's expense claims</td></tr>
        <tr><td><span class="badge badge-get">GET</span></td><td class="td-code">/expenses/pending</td><td style="text-align:center;"><span class="badge badge-jwt">JWT</span></td><td>List draft or reported expenses</td></tr>
        <tr><td><span class="badge badge-get">GET</span></td><td class="td-code">/expenses/products</td><td style="text-align:center;"><span class="badge badge-jwt">JWT</span></td><td>List expense-able products (with template fallback)</td></tr>
        <tr><td><span class="badge badge-post">POST</span></td><td class="td-code">/expenses</td><td style="text-align:center;"><span class="badge badge-jwt">JWT</span></td><td>Create a new expense claim</td></tr>
        <tr><td><span class="badge badge-get">GET</span></td><td class="td-code">/timesheet</td><td style="text-align:center;"><span class="badge badge-jwt">JWT</span></td><td>List timesheet entries for the employee</td></tr>
        <tr><td><span class="badge badge-get">GET</span></td><td class="td-code">/timesheet/projects</td><td style="text-align:center;"><span class="badge badge-jwt">JWT</span></td><td>List all active projects</td></tr>
        <tr><td><span class="badge badge-get">GET</span></td><td class="td-code">/timesheet/tasks</td><td style="text-align:center;"><span class="badge badge-jwt">JWT</span></td><td>List tasks for a given <code>project_id</code></td></tr>
        <tr><td><span class="badge badge-post">POST</span></td><td class="td-code">/timesheet</td><td style="text-align:center;"><span class="badge badge-jwt">JWT</span></td><td>Create a new timesheet entry</td></tr>
        <tr><td><span class="badge badge-get">GET</span></td><td class="td-code">/helpdesk/teams</td><td style="text-align:center;"><span class="badge badge-jwt">JWT</span></td><td>List helpdesk teams (includes availability check)</td></tr>
        <tr><td><span class="badge badge-get">GET</span></td><td class="td-code">/helpdesk</td><td style="text-align:center;"><span class="badge badge-jwt">JWT</span></td><td>List employee's helpdesk tickets</td></tr>
        <tr><td><span class="badge badge-post">POST</span></td><td class="td-code">/helpdesk</td><td style="text-align:center;"><span class="badge badge-jwt">JWT</span></td><td>Create a new helpdesk ticket</td></tr>
        <tr><td><span class="badge badge-get">GET</span></td><td class="td-code">/maintenance/categories</td><td style="text-align:center;"><span class="badge badge-jwt">JWT</span></td><td>List maintenance equipment categories</td></tr>
        <tr><td><span class="badge badge-get">GET</span></td><td class="td-code">/maintenance</td><td style="text-align:center;"><span class="badge badge-jwt">JWT</span></td><td>List employee's maintenance requests</td></tr>
        <tr><td><span class="badge badge-post">POST</span></td><td class="td-code">/maintenance</td><td style="text-align:center;"><span class="badge badge-jwt">JWT</span></td><td>Create a new maintenance request</td></tr>
        <tr><td><span class="badge badge-get">GET</span></td><td class="td-code">/notifications</td><td style="text-align:center;"><span class="badge badge-jwt">JWT</span></td><td>Fetch notifications (triggers Odoo sync first)</td></tr>
        <tr><td><span class="badge badge-put">PUT</span></td><td class="td-code">/notifications/:id/read</td><td style="text-align:center;"><span class="badge badge-jwt">JWT</span></td><td>Mark a single notification as read</td></tr>
        <tr><td><span class="badge badge-put">PUT</span></td><td class="td-code">/notifications/read-all</td><td style="text-align:center;"><span class="badge badge-jwt">JWT</span></td><td>Mark all employee notifications as read</td></tr>
      </tbody>
    </table>
  </div>

  <h2>2.10 &nbsp; Running the Test Suite</h2>
  <h3>Backend Tests</h3>
  <div class="code-block"><pre><span class="c-comment"># Run from the backend/ directory</span>
<span class="c-cmd">npm test</span>                    <span class="c-comment">Run all 157 unit + route tests</span>
<span class="c-cmd">npm run test:coverage</span>       <span class="c-comment">Run with HTML coverage report</span>
<span class="c-cmd">npm run smoke</span>               <span class="c-comment">Full end-to-end smoke test against live backend</span>

<span class="c-comment"># Smoke test env vars:</span>
<span class="c-key">SMOKE_TENANT</span>=yourslug  <span class="c-key">SMOKE_EMP_ID</span>=1  <span class="c-key">SMOKE_PIN</span>=1234  <span class="c-key">SMOKE_ADMIN_SECRET</span>=key  npm run smoke</pre></div>

  <h3>Frontend Tests</h3>
  <div class="code-block"><pre><span class="c-comment"># Run from the production-version/ directory</span>
<span class="c-cmd">npm test</span>                    <span class="c-comment">Run all 85 API client and business logic tests</span></pre></div>

  <h2>2.11 &nbsp; Deployment</h2>
  <h3>Backend — Vercel</h3>
  <ol class="steps">
    <li><span>Connect the GitHub repository to a Vercel project.</span></li>
    <li><span>In Vercel project settings → Environment Variables, add all 4 required variables.</span></li>
    <li><span>Every push to <code>main</code> triggers an automatic global deployment.</span></li>
  </ol>
  <h3>Frontend — EAS Build (Android APK)</h3>
  <div class="code-block"><pre><span class="c-cmd">npm install -g eas-cli</span>      <span class="c-comment">Install EAS CLI globally</span>
<span class="c-cmd">eas login</span>                   <span class="c-comment">Authenticate with your Expo account</span>
<span class="c-cmd">cd production-version</span>
<span class="c-cmd">eas build --platform android --profile preview</span>      <span class="c-comment">Builds sideloadable APK</span>
<span class="c-cmd">eas build --platform android --profile production</span>   <span class="c-comment">Builds AAB for Play Store</span></pre></div>
</div>
<div class="page-break"></div>

<!-- ══ SECTION 3 — INSTALLATION & TESTING ════════════════════════════════════ -->
<div class="content">
  <div class="section-banner">
    <div class="section-num">03</div>
    <div class="section-titles">
      <div class="section-label">For Testers &amp; End Users</div>
      <div class="section-title">Installation &amp; Feature Testing Guide</div>
      <div class="section-desc">Step-by-step APK installation and a complete feature checklist for Android</div>
    </div>
  </div>

  <h2>3.1 &nbsp; Installing the APK on Android</h2>
  <div class="callout callout-blue">
    <div class="callout-title">Before You Begin</div>
    <ul>
      <li>You need an Android phone running Android 8.0 (Oreo) or later.</li>
      <li>The APK download link is provided by your Shadow administrator.</li>
      <li>Ensure you have a stable internet connection during installation.</li>
    </ul>
  </div>

  <h3>Step 1 — Enable Unknown Sources</h3>
  <ol class="steps">
    <li><span>Open the <strong>Settings</strong> app on your Android phone.</span></li>
    <li><span>Navigate to <strong>Security</strong> (or <strong>Privacy</strong> on Android 12+, or <strong>Apps</strong> on some Samsung devices).</span></li>
    <li><span>Find <strong>"Install Unknown Apps"</strong> or <strong>"Unknown Sources"</strong> and enable it.</span></li>
    <li><span>On Android 8+, you will be prompted per-app — enable it for your browser or file manager.</span></li>
  </ol>

  <h3>Step 2 — Download the APK</h3>
  <ol class="steps">
    <li><span>Open the download link in your phone's browser (Chrome or Firefox recommended).</span></li>
    <li><span>Tap the <strong>.apk</strong> file when the download completes.</span></li>
    <li><span>If warned "This type of file can harm your device," tap <strong>OK</strong> or <strong>Download anyway</strong>.</span></li>
  </ol>

  <h3>Step 3 — Install &amp; Launch</h3>
  <ol class="steps">
    <li><span>Tap the downloaded <strong>.apk</strong> file (check your notification drawer or Downloads folder).</span></li>
    <li><span>Tap <strong>Install</strong> on the Android installer screen.</span></li>
    <li><span>Wait for installation to complete (usually under 30 seconds).</span></li>
    <li><span>Tap <strong>Open</strong> to launch Shadow.</span></li>
  </ol>

  <h2>3.2 &nbsp; First Launch — Company Setup &amp; Sign In</h2>
  <div class="info-grid">
    <div class="info-card">
      <div class="info-card-title">🏢 &nbsp; Company Code Screen</div>
      <p>The first screen asks for your company code. Enter the code provided by your administrator (e.g. <strong>acmecorp</strong>) and tap <strong>Continue</strong>. Your company name will appear if the code is valid.</p>
      <div class="callout callout-amber" style="margin-top:10px;">
        <div class="callout-title">Note</div>
        <p>The code is remembered permanently. You will not need to re-enter it unless you tap "Change Company" in Settings.</p>
      </div>
    </div>
    <div class="info-card">
      <div class="info-card-title">🔐 &nbsp; Sign In Screen</div>
      <p><strong>Employee ID:</strong> Your numeric Odoo employee ID. Find it in Odoo → Employees → click your name → the number in the browser URL bar (e.g. <code>/web#id=42</code> → ID is <strong>42</strong>).</p>
      <p style="margin-top:8px;"><strong>PIN:</strong> The PIN set for you in your Odoo employee profile (HR Settings tab → PIN field).</p>
    </div>
  </div>

  <h2>3.3 &nbsp; Feature Testing Checklist</h2>
  <p>Work through each feature card in order. Each checkbox item should be confirmed before moving to the next feature.</p>

  <div class="feature-card">
    <div class="feature-card-header"><div class="feature-num">1</div><div class="feature-title">Dashboard</div></div>
    <div class="feature-body">
      <ul class="checklist">
        <li><div class="checkbox"></div><span>Dashboard loads showing your name and a summary of pending items</span></li>
        <li><div class="checkbox"></div><span>Quick-action cards are visible (New Request, Timesheet, etc.)</span></li>
        <li><div class="checkbox"></div><span>Navigation tabs appear at the bottom of the screen</span></li>
      </ul>
    </div>
  </div>

  <div class="feature-card">
    <div class="feature-card-header"><div class="feature-num">2</div><div class="feature-title">Time Off Request</div></div>
    <div class="feature-body">
      <ul class="checklist">
        <li><div class="checkbox"></div><span>Tap <strong>New Request</strong> and select <strong>Time Off</strong></span></li>
        <li><div class="checkbox"></div><span>Choose a leave type from the dropdown list</span></li>
        <li><div class="checkbox"></div><span>Select start and end dates using the date pickers</span></li>
        <li><div class="checkbox"></div><span>Optionally type a reason in the description field</span></li>
        <li><div class="checkbox"></div><span>Optionally attach a document (tap the attachment icon, up to 3 files)</span></li>
        <li><div class="checkbox"></div><span>Tap <strong>Submit</strong> — a green success toast should appear at the top</span></li>
        <li><div class="checkbox"></div><span>Open Odoo → Time Off and verify the request appears in <em>Draft/Pending</em> state</span></li>
      </ul>
    </div>
  </div>

  <div class="feature-card">
    <div class="feature-card-header"><div class="feature-num">3</div><div class="feature-title">Expense Claim</div></div>
    <div class="feature-body">
      <ul class="checklist">
        <li><div class="checkbox"></div><span>Tap <strong>New Request</strong> and select <strong>Expense Claim</strong></span></li>
        <li><div class="checkbox"></div><span>Choose an expense category/product from the dropdown</span></li>
        <li><div class="checkbox"></div><span>Enter the amount, a description, and the expense date</span></li>
        <li><div class="checkbox"></div><span>Optionally attach a receipt photo (up to 3 images)</span></li>
        <li><div class="checkbox"></div><span>Tap <strong>Submit</strong> — success toast should appear</span></li>
        <li><div class="checkbox"></div><span>Open Odoo → Expenses and verify the claim appears in <em>Draft</em> state</span></li>
      </ul>
    </div>
  </div>

  <div class="feature-card">
    <div class="feature-card-header"><div class="feature-num">4</div><div class="feature-title">Timesheet</div></div>
    <div class="feature-body">
      <ul class="checklist">
        <li><div class="checkbox"></div><span>Tap the <strong>Timesheet</strong> tab at the bottom of the screen</span></li>
        <li><div class="checkbox"></div><span>Existing entries are visible, sorted newest first</span></li>
        <li><div class="checkbox"></div><span>Tap the <strong>+</strong> button to add a new entry</span></li>
        <li><div class="checkbox"></div><span>Select a project from the dropdown; optionally select a task</span></li>
        <li><div class="checkbox"></div><span>Enter a date, number of hours (e.g. <strong>2.5</strong>), and a work description</span></li>
        <li><div class="checkbox"></div><span>Tap <strong>Save</strong> — success toast should appear</span></li>
        <li><div class="checkbox"></div><span>Open Odoo → Timesheets and verify the entry appears</span></li>
      </ul>
    </div>
  </div>

  <div class="feature-card">
    <div class="feature-card-header"><div class="feature-num">5</div><div class="feature-title">IT Support Ticket</div></div>
    <div class="feature-body">
      <ul class="checklist">
        <li><div class="checkbox"></div><span>Tap <strong>New Request</strong> and select <strong>IT Support</strong></span></li>
        <li><div class="checkbox"></div><span>If Helpdesk module not installed in Odoo: an "Unavailable" message appears — this is correct</span></li>
        <li><div class="checkbox"></div><span>If available: enter a subject (required) and optional description and team</span></li>
        <li><div class="checkbox"></div><span>Optionally attach a screenshot</span></li>
        <li><div class="checkbox"></div><span>Tap <strong>Submit</strong> — success toast should appear</span></li>
        <li><div class="checkbox"></div><span>Open Odoo → Helpdesk and verify the ticket appears in <em>New/Open</em> stage</span></li>
      </ul>
    </div>
  </div>

  <div class="feature-card">
    <div class="feature-card-header"><div class="feature-num">6</div><div class="feature-title">Maintenance Request</div></div>
    <div class="feature-body">
      <ul class="checklist">
        <li><div class="checkbox"></div><span>Tap <strong>New Request</strong> and select <strong>Maintenance</strong></span></li>
        <li><div class="checkbox"></div><span>If Maintenance module not installed: "Unavailable" message — this is expected</span></li>
        <li><div class="checkbox"></div><span>If available: enter a title (required), optional description, and category</span></li>
        <li><div class="checkbox"></div><span>Choose request type: <strong>Corrective</strong> or <strong>Preventive</strong></span></li>
        <li><div class="checkbox"></div><span>Optionally attach photos of the issue</span></li>
        <li><div class="checkbox"></div><span>Tap <strong>Submit</strong> — success toast should appear</span></li>
        <li><div class="checkbox"></div><span>Open Odoo → Maintenance and verify the request appears</span></li>
      </ul>
    </div>
  </div>

  <div class="feature-card">
    <div class="feature-card-header"><div class="feature-num">7</div><div class="feature-title">Notifications</div></div>
    <div class="feature-body">
      <ul class="checklist">
        <li><div class="checkbox"></div><span>Tap the bell icon or Notifications tab — list loads (may be empty on first use)</span></li>
        <li><div class="checkbox"></div><span>In Odoo, have a manager approve or reject one of the requests you submitted</span></li>
        <li><div class="checkbox"></div><span>Pull down to refresh in Shadow — the notification should appear within seconds</span></li>
        <li><div class="checkbox"></div><span>Tap the notification — it should mark as read and show the request detail</span></li>
      </ul>
    </div>
  </div>

  <div class="feature-card">
    <div class="feature-card-header"><div class="feature-num">8</div><div class="feature-title">Push Notifications</div></div>
    <div class="feature-body">
      <ul class="checklist">
        <li><div class="checkbox"></div><span>When signing in, tap <strong>Allow</strong> when prompted for notification permissions</span></li>
        <li><div class="checkbox"></div><span>⚠️ Push notifications require a <strong>real physical Android device</strong> — not an emulator</span></li>
        <li><div class="checkbox"></div><span>In Odoo, have a manager approve a pending request</span></li>
        <li><div class="checkbox"></div><span>Within a few minutes, a push notification appears in the Android notification drawer</span></li>
        <li><div class="checkbox"></div><span>Tapping the notification opens Shadow directly to the relevant screen</span></li>
      </ul>
    </div>
  </div>

  <div class="feature-card">
    <div class="feature-card-header"><div class="feature-num">9</div><div class="feature-title">Request Details</div></div>
    <div class="feature-body">
      <ul class="checklist">
        <li><div class="checkbox"></div><span>Tap any notification — a detail view opens for that specific request</span></li>
        <li><div class="checkbox"></div><span>Detail view shows type, status badge, dates, amounts, and full description</span></li>
        <li><div class="checkbox"></div><span>Status badge is green (Approved), red (Rejected), or orange (Pending)</span></li>
        <li><div class="checkbox"></div><span>Tap Back to return to the notification list</span></li>
      </ul>
    </div>
  </div>

  <div class="feature-card">
    <div class="feature-card-header"><div class="feature-num">10</div><div class="feature-title">Settings</div></div>
    <div class="feature-body">
      <ul class="checklist">
        <li><div class="checkbox"></div><span>Open <strong>Settings</strong> via the profile icon or bottom tab</span></li>
        <li><div class="checkbox"></div><span>Toggle <strong>Push Notifications OFF</strong> — confirm no new pushes arrive</span></li>
        <li><div class="checkbox"></div><span>Toggle <strong>Push Notifications ON</strong> — confirm push notifications resume</span></li>
        <li><div class="checkbox"></div><span>Tap <strong>Mark All as Read</strong> — all notifications should show as read</span></li>
        <li><div class="checkbox"></div><span>Tap <strong>Clear App Cache</strong> — success message should appear</span></li>
        <li><div class="checkbox"></div><span>Tap <strong>Change Company</strong> — returns to the company code entry screen</span></li>
        <li><div class="checkbox"></div><span>Re-enter company code and sign in — confirm everything still works</span></li>
        <li><div class="checkbox"></div><span>Tap <strong>Sign Out</strong> — returns to Sign In screen (company code is remembered)</span></li>
      </ul>
    </div>
  </div>

  <h2>3.4 &nbsp; Troubleshooting Common Issues</h2>
  <div class="tbl-wrap">
    <table>
      <thead><tr><th>Problem</th><th>Likely Cause</th><th>Solution</th></tr></thead>
      <tbody>
        <tr><td class="td-key">Company code not found</td><td>Code is wrong or company not yet registered</td><td>Contact the Shadow administrator. Codes are case-insensitive.</td></tr>
        <tr><td class="td-key">Login fails</td><td>Incorrect Employee ID or PIN</td><td>Check your ID in Odoo (number in the URL). Ask HR to verify your PIN.</td></tr>
        <tr><td class="td-key">No leave types showing</td><td>Odoo connection issue or no types configured</td><td>Ensure leave types are set up in Odoo → Configuration → Leave Types.</td></tr>
        <tr><td class="td-key">Helpdesk shows Unavailable</td><td>Helpdesk Enterprise module not installed</td><td>Ask your Odoo admin to install the Helpdesk module.</td></tr>
        <tr><td class="td-key">Maintenance shows Unavailable</td><td>Maintenance module not installed</td><td>Ask your Odoo admin to install the Maintenance module.</td></tr>
        <tr><td class="td-key">No push notifications</td><td>Emulator or EAS project not configured</td><td>Use a real physical device. Enable push permissions in Settings.</td></tr>
        <tr><td class="td-key">App crashes on open</td><td>Corrupted install or old Android version</td><td>Uninstall Shadow, restart phone, reinstall the APK.</td></tr>
        <tr><td class="td-key">Requests not in Odoo</td><td>Network error during submission</td><td>Check your internet connection and resubmit.</td></tr>
      </tbody>
    </table>
  </div>
</div>
<div class="page-break"></div>

<!-- ══ SECTION 4 — ADMIN SETUP ═══════════════════════════════════════════════ -->
<div class="content">
  <div class="section-banner">
    <div class="section-num">04</div>
    <div class="section-titles">
      <div class="section-label">For Shadow Administrators</div>
      <div class="section-title">Admin Setup Guide — Registering a New Company</div>
      <div class="section-desc">Everything needed to onboard a new client company onto Shadow</div>
    </div>
  </div>

  <h2>4.1 &nbsp; Information to Collect from the Client</h2>
  <p>Collect the following details before registering the company. Use a secure channel for passwords — never plain-text email.</p>
  <div class="tbl-wrap">
    <table>
      <thead><tr><th>Field</th><th>Description</th><th>Example</th></tr></thead>
      <tbody>
        <tr><td class="td-key">Company Code (slug)</td><td>Short unique identifier. Lowercase, no spaces. This is what employees type on first launch.</td><td class="td-muted">acmecorp / globaltrade</td></tr>
        <tr><td class="td-key">Company Display Name</td><td>Full company name shown in the app to employees.</td><td class="td-muted">Acme Corporation</td></tr>
        <tr><td class="td-key">HR Email Address</td><td>Email displayed to locked-out employees for PIN reset assistance.</td><td class="td-muted">hr@acmecorp.com</td></tr>
        <tr><td class="td-key">Odoo URL</td><td>Full URL of the Odoo instance including <code>https://</code>.</td><td class="td-muted">https://acmecorp.odoo.com</td></tr>
        <tr><td class="td-key">Odoo Database Name</td><td>The Odoo database name (shown on the Odoo login screen).</td><td class="td-muted">acmecorp_prod</td></tr>
        <tr><td class="td-key">Odoo API Username</td><td>Email of an Odoo user with the required permissions (see 4.2).</td><td class="td-muted">shadow@acmecorp.com</td></tr>
        <tr><td class="td-key">Odoo API Password</td><td>Password for the API user. Share via a password manager link.</td><td class="td-muted">(share securely)</td></tr>
        <tr><td class="td-key">Odoo Version</td><td>The Odoo major version the client is running.</td><td class="td-muted">15 / 16 / 17</td></tr>
      </tbody>
    </table>
  </div>

  <h2>4.2 &nbsp; Odoo API User — Required Permissions</h2>
  <div class="tbl-wrap">
    <table>
      <thead><tr><th>Odoo Model</th><th style="text-align:center;width:70px;">Read</th><th style="text-align:center;width:70px;">Write</th><th>Notes</th></tr></thead>
      <tbody>
        <tr><td class="td-code">hr.employee</td><td style="text-align:center;"><span class="badge badge-yes">Yes</span></td><td style="text-align:center;"><span class="badge badge-no">No</span></td><td>Employee lookup, company + user link</td></tr>
        <tr><td class="td-code">hr.leave + hr.leave.type</td><td style="text-align:center;"><span class="badge badge-yes">Yes</span></td><td style="text-align:center;"><span class="badge badge-yes">Yes</span></td><td>Time off requests and leave type listing</td></tr>
        <tr><td class="td-code">hr.expense</td><td style="text-align:center;"><span class="badge badge-yes">Yes</span></td><td style="text-align:center;"><span class="badge badge-yes">Yes</span></td><td>Expense claims</td></tr>
        <tr><td class="td-code">account.analytic.line</td><td style="text-align:center;"><span class="badge badge-yes">Yes</span></td><td style="text-align:center;"><span class="badge badge-yes">Yes</span></td><td>Timesheets — requires Timesheets module</td></tr>
        <tr><td class="td-code">project.project + project.task</td><td style="text-align:center;"><span class="badge badge-yes">Yes</span></td><td style="text-align:center;"><span class="badge badge-no">No</span></td><td>Project and task lists for timesheet entry</td></tr>
        <tr><td class="td-code">helpdesk.ticket + helpdesk.team</td><td style="text-align:center;"><span class="badge badge-yes">Yes</span></td><td style="text-align:center;"><span class="badge badge-yes">Yes</span></td><td>IT support — requires Enterprise Helpdesk module</td></tr>
        <tr><td class="td-code">maintenance.request + category</td><td style="text-align:center;"><span class="badge badge-yes">Yes</span></td><td style="text-align:center;"><span class="badge badge-yes">Yes</span></td><td>Maintenance requests — requires Maintenance module</td></tr>
        <tr><td class="td-code">res.users + res.partner</td><td style="text-align:center;"><span class="badge badge-yes">Yes</span></td><td style="text-align:center;"><span class="badge badge-no">No</span></td><td>Resolving employee to helpdesk partner</td></tr>
        <tr><td class="td-code">res.company + product.*</td><td style="text-align:center;"><span class="badge badge-yes">Yes</span></td><td style="text-align:center;"><span class="badge badge-no">No</span></td><td>Company currency + expense product lookup</td></tr>
        <tr><td class="td-code">ir.attachment</td><td style="text-align:center;"><span class="badge badge-yes">Yes</span></td><td style="text-align:center;"><span class="badge badge-yes">Yes</span></td><td>File and image attachments on all request types</td></tr>
      </tbody>
    </table>
  </div>

  <h2>4.3 &nbsp; Registering the Company via Admin API</h2>
  <div class="callout callout-blue">
    <div class="callout-title">API Endpoint</div>
    <p><strong>POST</strong> &nbsp; <code>https://erp-external-app.vercel.app/admin/tenants</code></p>
    <p>Header: &nbsp; <code>x-admin-secret: {your_admin_secret}</code></p>
    <p>Content-Type: &nbsp; <code>application/json</code></p>
  </div>

  <div class="code-label">Request Body</div>
  <div class="code-block"><pre>{
  <span class="c-key">"slug"</span>:      <span class="c-str">"acmecorp"</span>,
  <span class="c-key">"name"</span>:      <span class="c-str">"Acme Corporation"</span>,
  <span class="c-key">"hr_email"</span>:  <span class="c-str">"hr@acmecorp.com"</span>,
  <span class="c-key">"odoo_url"</span>:  <span class="c-str">"https://acmecorp.odoo.com"</span>,
  <span class="c-key">"odoo_db"</span>:   <span class="c-str">"acmecorp_prod"</span>,
  <span class="c-key">"odoo_user"</span>: <span class="c-str">"shadow@acmecorp.com"</span>,
  <span class="c-key">"odoo_pass"</span>: <span class="c-str">"securepassword123"</span>
}</pre></div>
  <div class="code-label">Success Response</div>
  <div class="code-block"><pre>{ <span class="c-key">"success"</span>: <span class="c-val">true</span>, <span class="c-key">"slug"</span>: <span class="c-str">"acmecorp"</span> }</pre></div>
  <div class="callout callout-amber">
    <div class="callout-title">Updating a Tenant</div>
    <p>To update an existing tenant (e.g. change Odoo password or HR email), send the same POST with the same slug. The registration is idempotent — it overwrites the existing config.</p>
  </div>

  <h2>4.4 &nbsp; Verifying the Registration</h2>
  <ol class="steps">
    <li><span>Open Shadow on an Android device.</span></li>
    <li><span>Enter the company code (e.g. <code>acmecorp</code>) — your company name should appear.</span></li>
    <li><span>Log in with a valid employee ID and PIN.</span></li>
    <li><span>Navigate to <strong>New Request → Time Off</strong> and verify the leave types load.</span></li>
    <li><span>Submit a test time-off request and confirm it appears in Odoo.</span></li>
  </ol>

  <h2>4.5 &nbsp; Employee Onboarding — What to Tell Employees</h2>
  <div class="tbl-wrap">
    <table>
      <thead><tr><th>Item</th><th>What to Tell the Employee</th></tr></thead>
      <tbody>
        <tr><td class="td-key">APK Download Link</td><td>Share the EAS build URL or the direct link to the .apk file.</td></tr>
        <tr><td class="td-key">Company Code</td><td>The slug registered in step 4.3 (e.g. <code>acmecorp</code>). Case-insensitive.</td></tr>
        <tr><td class="td-key">Employee ID</td><td>Found in Odoo → Employees → click their name → the number in the browser URL bar (e.g. <code>/web#id=42</code> → ID is <strong>42</strong>).</td></tr>
        <tr><td class="td-key">PIN</td><td>Set by the HR administrator in Odoo → employee record → HR Settings tab → PIN field.</td></tr>
      </tbody>
    </table>
  </div>

  <h2>4.6 &nbsp; Odoo PIN Setup — Step-by-Step for HR Managers</h2>
  <ol class="steps">
    <li><span>Log in to Odoo as an <strong>HR Manager</strong> or <strong>Administrator</strong>.</span></li>
    <li><span>Go to the <strong>Employees</strong> module.</span></li>
    <li><span>Click on the employee's name to open their record.</span></li>
    <li><span>Click the <strong>HR Settings</strong> tab at the top of the employee form.</span></li>
    <li><span>Find the <strong>PIN</strong> field and enter a 4–6 digit numeric PIN.</span></li>
    <li><span>Click <strong>Save</strong>. Repeat for each employee who will use Shadow.</span></li>
  </ol>
  <div class="callout callout-red">
    <div class="callout-title">Security Note</div>
    <ul>
      <li>Employees cannot change their own PIN from within Shadow — only HR managers can.</li>
      <li>If an employee is locked out, they contact HR, who updates the PIN in Odoo.</li>
      <li>There is no in-app PIN reset — this is intentional for security.</li>
    </ul>
  </div>
</div>
<div class="page-break"></div>

<!-- ══ SECTION 5 — SECURITY ═══════════════════════════════════════════════════ -->
<div class="content">
  <div class="section-banner">
    <div class="section-num">05</div>
    <div class="section-titles">
      <div class="section-label">For Administrators &amp; Security Teams</div>
      <div class="section-title">Security Notes</div>
      <div class="section-desc">How Shadow protects your data and what clients should do</div>
    </div>
  </div>

  <h2>5.1 &nbsp; Data Security</h2>
  <div class="tbl-wrap">
    <table>
      <thead><tr><th>Area</th><th>How Shadow Protects It</th></tr></thead>
      <tbody>
        <tr><td class="td-key">Transport Security</td><td>All communication between app, backend, and Redis uses HTTPS/TLS. No plain-text connections anywhere in the system.</td></tr>
        <tr><td class="td-key">JWT Storage</td><td>Tokens are stored in AsyncStorage on-device. JWTs expire after 30 days. Any 401 response automatically revokes the local session.</td></tr>
        <tr><td class="td-key">Employee PINs</td><td>PINs are never stored or logged by Shadow. They are passed directly to Odoo XML-RPC and discarded immediately after authentication succeeds or fails.</td></tr>
        <tr><td class="td-key">Odoo Credentials</td><td>Odoo URL, database, username, and password are stored in Upstash Redis with full TLS encryption. They are never in source code, app bundles, or environment variables visible to the mobile app.</td></tr>
        <tr><td class="td-key">ERP Data Storage</td><td>No ERP data (leaves, expenses, timesheets) is stored permanently in Shadow. All data is fetched live from Odoo on demand and held only in device memory.</td></tr>
        <tr><td class="td-key">Tenant Isolation</td><td>Every Redis key includes the tenantId prefix. Every JWT includes a tenantId claim verified on every API call. One tenant cannot access another's data under any circumstances.</td></tr>
        <tr><td class="td-key">Admin Endpoints</td><td>The <code>/admin/*</code> endpoints require a separate <code>x-admin-secret</code> header. A valid user JWT cannot access admin routes — they are two separate authentication mechanisms.</td></tr>
      </tbody>
    </table>
  </div>

  <h2>5.2 &nbsp; Responsible Disclosure</h2>
  <ol class="steps">
    <li><span>Contact the Shadow administrator immediately via a private, secure channel.</span></li>
    <li><span>Do not disclose the vulnerability publicly until a fix has been deployed.</span></li>
    <li><span>Provide steps to reproduce, affected endpoints, and potential impact.</span></li>
    <li><span>A fix will be acknowledged and deployed as a priority.</span></li>
  </ol>

  <h2>5.3 &nbsp; Recommendations for Clients</h2>
  <ul>
    <li>Create a <strong>dedicated Odoo API user</strong> for Shadow — do not use a personal admin account.</li>
    <li>Grant the API user <strong>only the minimum permissions</strong> listed in Section 4.2.</li>
    <li>Store the Odoo API password in a <strong>password manager</strong> before sharing it with the Shadow administrator.</li>
    <li>If the Odoo API user password changes, <strong>update the tenant registration immediately</strong> via the Admin API (Section 4.3).</li>
    <li>When an employee leaves the company, <strong>deactivate their Odoo record</strong> — this instantly blocks their access to Shadow without any extra configuration.</li>
  </ul>

  <hr/>

  <div style="text-align:center; padding: 24px 0;">
    <p style="font-size:9pt; color:#94A3B8; margin-bottom:6px;">
      <strong style="color:#475569;">Shadow v1.0</strong> &nbsp;·&nbsp; Built with Expo SDK 54 + Node.js + Odoo XML-RPC
    </p>
    <p style="font-size:9pt; color:#94A3B8;">
      Backend: 157 Tests Passing &nbsp;·&nbsp; Frontend: 85 Tests Passing &nbsp;·&nbsp; Odoo v15 · v16 · v17 &nbsp;·&nbsp; 2026
    </p>
  </div>
</div>

</body>
</html>`;

const HTML_PATH = 'C:/Users/User1/Documents/GitHub/erp_external_app/shadow-docs-temp.html';
fs.writeFileSync(HTML_PATH, html);
console.log('HTML written to: ' + HTML_PATH);
