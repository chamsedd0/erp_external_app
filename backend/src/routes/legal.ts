import { Router } from 'express';

// Public legal pages required by the App Store and Google Play.
// These URLs are referenced from the app's Settings screen and from both
// store consoles (privacy policy URL, Play account-deletion URL) — do not
// change the paths without updating those listings.

const router = Router();

const LAST_UPDATED = '22 July 2026';

function page(title: string, body: string): string {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — Shadow Portal</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
         max-width: 720px; margin: 0 auto; padding: 32px 20px 64px; line-height: 1.6;
         color: #1a1a2e; background: #fff; }
  @media (prefers-color-scheme: dark) { body { color: #e8e8f0; background: #0a0a1a; } }
  h1 { font-size: 1.8rem; margin-bottom: 4px; }
  h2 { font-size: 1.2rem; margin-top: 32px; }
  .updated { color: #888; font-size: 0.9rem; margin-bottom: 24px; }
  table { border-collapse: collapse; width: 100%; font-size: 0.95rem; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #8884; vertical-align: top; }
  a { color: #4F8EF7; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

const privacyBody = `
<h1>Privacy Policy</h1>
<p class="updated">Last updated: ${LAST_UPDATED}</p>

<p>Shadow Portal is a mobile employee self-service portal that connects to your employer's
ERP (Odoo) system. Your employer subscribes to Shadow Portal and remains the controller of
your employment data; Shadow Portal processes data on your employer's behalf to provide the
app's features (time off, expenses, helpdesk, maintenance, attendance, timesheets and
notifications).</p>

<h2>Data we process</h2>
<table>
<tr><th>Data</th><th>Purpose</th><th>Where it lives</th></tr>
<tr><td>Employee ID, name, department, job title</td><td>Sign-in and displaying your profile</td><td>Your employer's Odoo; a copy in your session token</td></tr>
<tr><td>Work email address</td><td>Account activation (one-time code) and sign-in</td><td>Shadow Portal servers (hashed index) and your employer's Odoo</td></tr>
<tr><td>PIN</td><td>Sign-in</td><td>Stored only as a salted PBKDF2 hash on Shadow Portal servers — never in plain text</td></tr>
<tr><td>Requests you submit (time off, expenses, tickets) and photo attachments</td><td>Delivering them to your employer's ERP</td><td>Your employer's Odoo</td></tr>
<tr><td>Push notification token</td><td>Sending you status notifications</td><td>Shadow Portal servers (Expo push service)</td></tr>
<tr><td>Notification history</td><td>Showing your in-app notification list</td><td>Shadow Portal servers</td></tr>
</table>

<h2>What we don't do</h2>
<p>Shadow Portal contains no advertising, no analytics or tracking SDKs, and does not sell
or share your data with third parties. Data is only exchanged between your device, Shadow
Portal's servers, and your employer's own ERP system. All traffic is encrypted in transit
(HTTPS).</p>

<h2>Retention</h2>
<p>App-side data (credential, push token, notification history, request cache) is kept while
your account is active and deleted when you delete your account. Records inside your
employer's ERP (submitted requests, employment data) are retained under your employer's own
policies.</p>

<h2>Deleting your account</h2>
<p>You can delete your Shadow Portal account at any time from
<strong>Settings &rarr; Delete Account</strong> in the app, or by following the steps at
<a href="/legal/delete-account">/legal/delete-account</a>. Deletion removes everything Shadow
Portal stores about you; your underlying employment record is managed by your employer.</p>

<h2>Contact</h2>
<p>For privacy questions or requests, contact your employer's HR department (shown in the
app) or email <a href="mailto:lhouijchams@gmail.com">lhouijchams@gmail.com</a>.</p>
`;

const termsBody = `
<h1>Terms of Service</h1>
<p class="updated">Last updated: ${LAST_UPDATED}</p>

<h2>1. The service</h2>
<p>Shadow Portal is a mobile employee self-service portal provided to companies that
subscribe to the service. Your right to use the app comes from your employer's
subscription; access requires an invitation or activation issued through your employer.</p>

<h2>2. Your account</h2>
<p>You are responsible for keeping your PIN confidential. Your employer controls which
employees may use the app and may revoke access at any time. You may delete your account
at any time from Settings.</p>

<h2>3. Acceptable use</h2>
<p>Use the app only for legitimate workplace requests. Do not attempt to access other
employees' data, disrupt the service, or reverse-engineer the app.</p>

<h2>4. Data</h2>
<p>Requests submitted through the app are delivered to your employer's ERP system and are
subject to your employer's workplace policies. See the
<a href="/legal/privacy">Privacy Policy</a> for details on data handling.</p>

<h2>5. Availability and liability</h2>
<p>The service is provided "as is" without warranties of uninterrupted availability. To the
maximum extent permitted by law, Shadow Portal is not liable for indirect or consequential
damages arising from use of the app. Nothing in these terms affects your statutory rights
as an employee, which are governed by your employment relationship with your employer.</p>

<h2>6. Changes</h2>
<p>We may update these terms; material changes will be reflected on this page with a new
"last updated" date. Continued use after changes constitutes acceptance.</p>

<h2>Contact</h2>
<p>Questions about these terms: <a href="mailto:lhouijchams@gmail.com">lhouijchams@gmail.com</a>.</p>
`;

const deleteAccountBody = `
<h1>Delete Your Account</h1>
<p class="updated">Last updated: ${LAST_UPDATED}</p>

<p>You can delete your Shadow Portal account and its data at any time.</p>

<h2>From the app (immediate)</h2>
<ol>
<li>Open Shadow Portal and sign in.</li>
<li>Go to <strong>Settings</strong>.</li>
<li>Tap <strong>Delete Account</strong> and confirm.</li>
</ol>
<p>This immediately and permanently deletes everything Shadow Portal stores about you:
your sign-in credential (PIN), work-email index, push notification token, device
registration, cached request data, and notification history. You will need a new
invitation from your employer to use the app again.</p>

<h2>Without the app (email request)</h2>
<p>If you can no longer access the app, email
<a href="mailto:lhouijchams@gmail.com?subject=Shadow%20Portal%20account%20deletion%20request">lhouijchams@gmail.com</a>
from your work email address with the subject "Account deletion request", including your
company name and employee ID. Deletion requests are processed within 30 days.</p>

<h2>What is not deleted</h2>
<p>Your employment record and any requests already delivered to your employer's ERP system
belong to your employer and are governed by their retention policies — contact your HR
department for those. Shadow Portal itself retains nothing about you after deletion.</p>
`;

router.get('/privacy', (_req, res) => {
    res.type('html').send(page('Privacy Policy', privacyBody));
});

router.get('/terms', (_req, res) => {
    res.type('html').send(page('Terms of Service', termsBody));
});

router.get('/delete-account', (_req, res) => {
    res.type('html').send(page('Delete Your Account', deleteAccountBody));
});

export const legalRouter = router;
