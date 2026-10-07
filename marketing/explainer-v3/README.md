# Shadow by Octagon9 — vertical explainer

A 37-second vertical film (1080×1920, 60 fps) in the order the client asked for: the Odoo versions it works with, the applications it covers, then one example from request to answer. The earlier cuts in `../intro-video/` (v1) and `../intro-video-v2/` (v2) are untouched.

| File | What it is |
|---|---|
| `out/shadow-by-octagon9-explainer-9x16.mp4` | The film: H.264, Rec.709, AAC stereo 48 kHz, 14.8 MB |
| `out/shadow-by-octagon9-explainer-9x16-with-voice.mp4` | The same picture with the voice-over (ElevenLabs, voice Bella). See `VOICEOVER.md` |
| `out/voice/bella/` | The voice takes, which take each line uses (`picks.json`) and the timing report |
| `out/intermediate/…-lossless-rgb.mkv` | Lossless master (142 MB, git-ignored) |
| `out/posters/` | Four stills: opening, versions, applications, end card |
| `out/audio/` | Mix, four stems, and the ducked voice-over bed |
| `review/voiceover-scratch/SCRATCH-system-voice-preview.mp4` | The film with a Windows system voice reading the script. For judging the script only |
| `VOICEOVER.md` | The script, its timing, and how to add a real voice |
| `timeline.json` | Every frame number, on-screen line, sound cue and voice-over window |

## What happens when

| Time | Section | On screen |
|---|---|---|
| 0.0–2.6 s | Open | The phone wakes under the portal's reflection. "Your Odoo. In their hands." |
| 2.6–9.0 s | Versions | "Works with the Odoo you already run." 15, 16, 17, 18, 19 light up on the portal. "Odoo 15 to 19. No module to install." |
| 9.0–16.6 s | Applications | The app's New Request screen scrolls through its six cards. "Six everyday apps. One place." Then a tap on Time Off |
| 16.6–21.0 s | Example: the request | The form with type, balance and dates; Submit; "Time off request submitted!" |
| 21.0–26.0 s | Example: Odoo | The same request as an Odoo record; the manager clicks Approve; "To Approve" becomes "Approved" |
| 26.0–30.5 s | Example: the answer | "Request Approved" arrives in the employee's Inbox |
| 30.5–37.0 s | End card | The portal closes into the mark. "Shadow / by Octagon9 / Your Odoo. In every pocket." |

The story is complete by 30 seconds because Google Play autoplays only the first 30.

## Where it can be used

- **Google Play:** upload to YouTube (public or unlisted, ads off, not age-restricted, embedding allowed) and paste the link in the store listing. Portrait is accepted.
- **Website, LinkedIn, Reels, Shorts, sales decks:** as is.
- **Apple App Store:** not as an "app preview". Apple caps those at 30 seconds and 30 fps and requires real in-app capture. Previews are optional; the listing works without one.

## Commands

Run from this folder. Dependencies are local (`npm install`); Python needs numpy and scipy.

```bash
npm run preview        # http://localhost:5180/  scrub the film; add ?safe to see the content column
npm run stills -- --out review/wip 60 470 1320     # quick single frames
npm run animatic       # 1 sample per frame, about 3 minutes
npm run audio          # score, stems, voice-over bed, measurement report
npm run render         # the final film, about 15 minutes
python source/qa_final.py                          # checks on the encoded file → review/qa/
npm run store          # store screenshots, feature graphic, icons → ../store-assets/
```

To change the version list, the brand line, any on-screen line or any timing, edit `timeline.json`, then run `npm run audio` and `npm run render`.

## Checks on the delivered file

Measured from the encoded MP4 (`review/qa/final-…json`):

- 2,220 decoded frames, 37.000 s, 1080×1920 at 60 fps, fast-start.
- Rec.709 limited range, verified on pixels: the ink background measures Y 24.0 against 23.6 predicted, the pale studio 228.8 against 228.8.
- Audio as decoded: −14.1 LUFS integrated, true peak −1.5 dBTP, 0.0 ms offset from the mix.
- Frame-to-frame motion: the only abrupt changes are the three intended cuts.
- A last look through the encoded file at two frames per second (74 frames) found nothing out of place.
- Every headline, version number, app name and status reads at 360×640 (`review/qa/preview-size-360x640-…png`).

Not done by me: nobody has listened to the audio. I can't hear it, so it is measured only. A local speech-recognition pass on the scratch voice mix was also tried and Windows application control blocked the tool, so that check did not run. Listen once on headphones and once on a phone speaker before publishing.

## What is real and what is rebuilt

- App screens are rebuilt in HTML from the app's source with a synthetic employee (Yasmine Alaoui). They are not device captures.
- The Odoo record is a rebuilt view of the relevant fields, styled after Odoo 17. No live Odoo was read or changed.
- Behaviour comes from source: the Submit button's spring and 50 % loading state, the toast, the Inbox grouping, and Odoo's header going from Approve + Refuse to Refuse after approval.
- The phone is an original generic model.

## Open items for the client

- **"Odoo 15 to 19."** The test suite covers 15, 17, 18 and 19, and the docs name 15–17. Confirm the range to state publicly; it is `versions` in `timeline.json`.
- **The "by Octagon9" lockup** is typeset in DM Sans because no Octagon9 logo file exists in the repo. `assets/logo/shadow-by-octagon9-logo.svg` is the interim version.
- **The Attendance card** shows its subtitle running under the arrow button, because that is what the app does today on a 390-pt phone.
