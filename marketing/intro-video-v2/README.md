# Shadow Portal — launch film v2 ("Your Odoo. In their hands.")

A 20 s, 60 fps film for company buyers. One time-off request goes from the employee app to an Odoo record, a manager approves it there, and the approved status comes back to the employee. There are two independently composed cuts, 16:9 and 9:16, each exactly 1,200 frames. The v1 cut in `../intro-video/` is untouched.

## Status (28 Sep 2026)

**Done:**

- The source-of-truth check (`assumptions.md`) and `references.md`.
- Tokens (`design-tokens.json`) and a shared timeline (`timeline.json`).
- All six shots in both formats (`source/film.js`), with six style frames per aspect in `review/style-frames/`.
- Preview-size legibility sheets with the portrait critical box drawn in.
- The 2 s device proof, 3D against a flat mock-up (`review/device-proof/`): 3D kept.
- Full animatics in `review/animatic/`, plus a measured motion curve in `review/qa/`.
- The original score, mix and stems (`out/audio/`), measured at −14.1 LUFS and −1.5 dBTP.

**Rendering when this was written:** the final `out/shadow-portal-launch-v2-16x9.mp4`, then `-9x16.mp4`, from a background job. Logs are in `review/qa/render-*.log` and each export writes `review/qa/encode-<fmt>.json`.

**Still to do:**

1. QA on the encoded files:
   - first and last frame
   - shot boundaries ±2 frames
   - audio offset in the decoded MP4
   - luma range, banding and masking checks
2. Three posters per aspect (hero 196, product proof 640, end card 1100), via `--stills … --out out/posters --prefix poster`.
3. Old/new comparison sheets. The v1 frames are already extracted in `review/comparison/v1-frames/`.
4. The QA notes and scorecard.
5. **Human listening.** The sound category stays unapproved until someone listens.

## Commands (run in this folder)

```
npm install                                   # local deps only (three, puppeteer-core, sharp, opentype.js)
npm run preview                               # http://localhost:5179/source/index.html  (?format=vertical &f=… &safe &debug)
python source/soundtrack.py [--vertical]      # mix + stems + measurement report → out/audio/
node source/render.mjs [--format vertical]    # final film + lossless RGB intermediate + decode-verify
node source/render.mjs --animatic             # 1 sample/frame review cut → review/animatic/
node source/render.mjs --stills 196,640,1100 --out out/posters --prefix poster   # accumulated stills
node source/stills.mjs --fmt both --out review/wip --sheet name 60 196 300       # quick single-sample stills
python source/qa_motion.py <mp4> review/qa/motion-<name>                         # measured motion curve
```

## Audio review checklist (for a person)

Headphones, phone speaker and mono:

- **Onset:** soft, not a hit.
- **Pulse arrival:** lands on the hero at 2.5 s.
- **Interaction cues:** the tap (5.6 s), confirm (6.0 s), click (10.2 s), approval (10.4 s) and the two-note status cue (12.0 s) each read as caused by the picture.
- **Signature:** the pulse stops and the three-note signature from 16.2 s decays naturally.
- **Mix:** nothing harsh or boomy.

## Optional purchases (nothing was bought)

The route needed no paid assets. Candidates, with prices as listed in `../video-direction/SETUP-AND-ASSETS.md` on 27 Sep 2026 (not re-verified):

- **Artlist music** (plan price varies) plus a human mix pass: the most useful upgrade, since the score is unheard.
- **CGTrader generic smartphone, $3:** not needed; the original device passed the proof.
- **LS.Graphics AE mockups, $49:** not applicable to this pipeline.
- **Free but not downloaded** (downloads need owner approval): Poly Haven Studio Small 03 (CC0 HDRI) and Kenney Interface Sounds (CC0).
