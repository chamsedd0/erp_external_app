# Shadow Portal — intro video

A 19-second, 60 fps marketing intro in two cuts: 16:9 (1920×1080) and 9:16 (1080×1920, for
Reels, Shorts, TikTok and Stories). It's code-driven: the picture is an HTML composition that is a
pure function of time, and the soundtrack is synthesized from the same timeline, so picture and
sound stay in sync.

**Storyboard** (120 BPM, one bar = 2 s)

| Time | Beat |
|---|---|
| 0–4 s | Floating paperwork (leave PDFs, email threads, receipts, tickets) buzzes for attention. The portal ignites, draws itself and pulls it all in. Headline: *Every request. One portal.* The camera then flies through the doorway. |
| 4 s | The drop. The phone comes out of the light onto the real dashboard: *Everything, at a glance.* |
| 6 s | Time off: tap, pick dates, "≈ 5 days", submit, toast. *Book leave in seconds.* |
| 8 s | Whip pan to expenses: amount counts up, receipt snap with camera flash, submit. *Snap the receipt. Done.* |
| 10 s | Lock-screen push with a haptic buzz. "Request Approved" breaks out of the phone. *Approved? Know instantly.* |
| 12 s | New Request hub. Timesheets, IT Helpdesk, Maintenance and Attendance burst out of the phone. EN/AR and light/dark chips. |
| 14 s | Live sync with an Odoo record: *To Approve* flips to *Approved*. *Plugs straight into Odoo.* |
| 15.5–19 s | The camera pulls back out through the portal. Logo impact and a light running across the lockup, then *Your workplace, in your pocket.* |

## Files

- `index.html`, `intro.css`, `intro.js`: the composition. The UI mirrors `production-version` (same
  dark theme, fonts, colors, copy and lucide icons). Add `?format=vertical` for the 9:16 layouts.
- `soundtrack.py`: an original score and sound design, synthesized from scratch with numpy and
  scipy. It reads its hit times from `const T` in `intro.js`.
- `render.mjs`: runs headless Chrome (on the discrete GPU if there is one) across parallel workers.
  Motion blur is real sub-frame accumulation with a 180° shutter. The composition declares its own
  sample density (`window.__samples`): 6 per frame on calm shots, up to 44 on whip pans. Output is
  H.264 BT.709 with AAC, as a master file and a lighter `-web` file.
- `stills.mjs`: renders single frames and contact sheets for review.

## Use

```bash
cd marketing/intro-video
npm install                         # puppeteer-core + sharp (local to this folder)
python soundtrack.py                # numpy + scipy → soundtrack.wav
python soundtrack.py --vertical     # same score, panned for the 9:16 layout
npm run preview                     # http://localhost:5178/  (Space = play, ←/→ = step a frame)
                                    # http://localhost:5178/?format=vertical
node render.mjs                     # out/shadow-portal-intro.mp4 + -web.mp4 (about 20 min on 8 workers)
node render.mjs --format vertical   # out/shadow-portal-intro-vertical.mp4 + -web.mp4
node render.mjs --preview           # quick 30 fps check without blur
node render.mjs --encode-only       # re-encode the last render's lossless segments (e.g. --crf 16)
node stills.mjs 4.0 10.6 16.2       # review frames; writes out/stills/sheet.png
```

Render dependencies: Chromium (set `CHROME=<path to chrome.exe>` if it isn't the Playwright build
at the default path) and ffmpeg on PATH. The end-card wordmark uses Arial Black and Arial, the same
fonts as `shadow-portal-logo.svg`, so render on a machine that has them installed (Windows and macOS
do by default).

## Editing

- **Copy**: the headlines are in `intro.js` (search for `headline(`). The call-to-action is
  `CTA_TEXT` at the top of the file.
- **Timing**: everything hangs off `const T` in `intro.js`. After changing it, re-run
  `python soundtrack.py` so the audio follows, and check `MB` (the motion-blur windows) near the
  bottom of `intro.js`.
- **Layout**: `POSE` holds the phone positions per scene. Each value has a 16:9 and a 9:16 variant
  (search for `VERT ?`).
- **Demo data** (the name Yasmine, dates, amounts) is in the pane templates in `intro.js`.
