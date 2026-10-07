# Shadow Portal — launch film production brief

Version 1 · 27 September 2026 · Prepared against the existing repository and both exported cuts.

**Claude: this is the production brief. Make the film, including reviewable intermediate work and final exports. Read this entire document, [AUDIT.md](AUDIT.md), and [SETUP-AND-ASSETS.md](SETUP-AND-ASSETS.md) before implementation.**

## 1. The assignment

Create a 20-second marketing film for Shadow Portal in independently composed 16:9 and 9:16 editions. Aim for the clarity, product photography, editorial rhythm, and finishing discipline associated with Apple's launch films. Keep Shadow Portal's identity.

The central idea is **“Your Odoo. In their hands.”** Show a company how Shadow Portal gives its employees a clear mobile route into an existing Odoo workflow. Follow one time-off request from employee submission to its Odoo record and its later status on the employee's phone. The audience should understand the business value and remember the app after one silent viewing.

**Owner-confirmed audience: companies buying the app. Owner-confirmed asset policy: paid assets are welcome when they improve quality.** Address an Odoo-using company's HR, operations or IT decision-maker. Employee self-service is the demonstration; connected workplace requests and clearer status are the business proposition. Do not make the film sound like an unrelated consumer app. English is the working language assumption.

Select assets for quality and workflow compatibility, not only price. Present the exact model/music/template shortlist and cost before any new purchase; the owner has allowed paid options, but this brief does not set a spending limit or choose a subscription. Continue with previews and available assets while a purchase is pending.

Preferred sales CTA: **“Book a demo”**, paired with an owner-provided working destination. Until that destination and sales process are supplied, use **“Meet Shadow Portal.”** This keeps the draft complete without inventing a URL, app-store listing or launch date. Do not carry over “Coming soon to iOS & Android” as an established fact.

Priority order: understandable story → striking still compositions → credible product and materials → motion timing → sound → render quality. Rendering more samples cannot rescue weak compositions.

## 2. What to retain and what to change

Retain the portal silhouette, blue identity, existing app typography, real product vocabulary, and the useful deterministic render infrastructure. Preserve the existing video and its source as a reference.

Replace the continuous glowing tunnel, drifting particles, repeated side-by-side phone/caption layout, large tap ripples, persistent floating motion, feature grid, and synthetic data-beam spectacle. The arch should be a recognisable transition and closing mark, rather than scenery behind every shot.

Limit the story to one complete workflow. Expenses, Helpdesk, Maintenance, Attendance, languages, appearance modes, supported Odoo versions, and installation claims do not each need a scene. Their presence in the app can be visible naturally; their explanation belongs in longer demos or later films.

Use this test: if a shot could sell any unrelated SaaS app by swapping the logo, make it more specific to a Shadow Portal request, screen, state, or brand shape.

## 3. Source of truth

All paths in this brief are relative to the repository root unless specified otherwise.

| Input | Where to inspect | What it establishes |
|---|---|---|
| Existing film | `marketing/intro-video/out/shadow-portal-intro.mp4` and `shadow-portal-intro-vertical.mp4` | Baseline to beat; 19 seconds, 60 fps, 1,140 frames each |
| Existing composition | `marketing/intro-video/intro.js`, `intro.css`, `render.mjs`, `soundtrack.py`, `README.md` | Reusable scheduling, export and UI reconstruction work |
| Identity | `shadow-portal-logo.svg`, `shadow-portal-icon.svg` | Actual arch, proportions, gradient and wordmark |
| Theme | `production-version/theme/colors.ts` | Actual light and dark colors |
| Fonts | `production-version/app/_layout.tsx`; `marketing/intro-video/fonts/` | Outfit and DM Sans; bundled font files and OFL notices |
| Dashboard | `production-version/app/(app)/dashboard.tsx` | Real overview and request summaries |
| Request flow | `production-version/app/(app)/new-request.tsx` | Actual fields, actions, wording and validation |
| Attachments | `production-version/components/AttachmentPicker.tsx` | Camera/library attachment support; not evidence of OCR |
| Notifications | `production-version/app/(app)/notifications.tsx`, `production-version/providers/auth-context.tsx`, `backend/src/lib/requestMonitor.ts`, `backend/src/lib/pushStore.ts` | Notification implementation; not a measured delivery-time guarantee |
| Odoo | `production-version/api/`, `backend/src/odoo/`, relevant backend routes | Integration behavior to verify before showing it |

Inspect the current files rather than trusting this inventory forever. Use synthetic demo records consistently. Do not connect to or mutate live employee records for a marketing capture.

Prefer real app captures from a demo build. If clean, deterministic capture is unavailable, recreate only the required screens from the real components and compare them side by side. Record which footage is captured and which is reconstructed. Preserve wording, hierarchy, icon family, field order, and behaviors. Marketing magnifications may enlarge an actual UI region; they must not invent a different product.

The README inside `production-version` describes its UI starter and is not a complete Shadow Portal product specification.

## 4. Apple reference assignment

Use these primary references:

1. [Apple Event archive](https://www.apple.com/apple-events/): the September 9, 2025 product introductions and May 7, 2024 iPad event. Study how a product is established, isolated, demonstrated, and allowed to rest between changes.
2. [Introducing iPhone Air — official Apple Canada film](https://www.youtube.com/watch?v=BeoJC9Thl9I). Study material definition, silhouette, cropping, and the relation between camera movement and the attribute being communicated.
3. [Meet Liquid Glass — WWDC25](https://developer.apple.com/videos/play/wwdc2025/219/). Study optical hierarchy and how a material supports content. It is not a request to turn every surface into glass.
4. [Designing Fluid Interfaces — WWDC18](https://developer.apple.com/videos/play/wwdc2018/803/). Apply causal feedback and spatial continuity to the demonstrated UI.

Before animating, make `references.md` with three precise observations from material you actually viewed. Include URL, actual timestamp, what the reference accomplishes, and the distinct Shadow Portal interpretation. If you cannot play a reference, label it unviewed and use accessible official stills or transcripts; do not invent timestamps or claim a watch-through.

These links are reference assignments, not a claim that this brief's author performed an audiovisual review of each film. The proposed treatment below is original direction.

Transfer disciplined hierarchy, lighting, pacing and legibility. Use original imagery, animation and audio. Keep Outfit/DM Sans and the Shadow Portal logo. Do not substitute Apple's identity or make the real app appear to have an unimplemented Liquid Glass redesign.

Apple's current [design resources](https://developer.apple.com/design/resources/) are official downloadable resources with their own terms. The [mjmirza catalog](https://github.com/mjmirza/apple-design-system) is a third-party index, not an Apple-issued open-source movie-making system. There is no reason to download its entire asset collection for this film.

## 5. Locked creative treatment

**Visual idea:** a carefully lit device carries the app; a single request connects employee and company; the blue portal connects the opening and ending. Make the Odoo connection a central piece of evidence, not a compatibility footnote. The intended buyer takeaway is: “Our employees could handle these requests on mobile while the workflow stays connected to Odoo.” Do not claim measured cost savings, adoption, security certification, or zero setup without evidence.

Begin in ink-dark space with a close product detail and readable app content appearing promptly. Open into a pale studio for the demonstration. Finish in the brand's dark field. This creates three acts through light and composition, without turning every cut into a transition effect.

The device is an original, generic mobile shell: graphite frame, subtle bevel, glass screen, restrained side thickness. No Apple logo, Dynamic Island, distinctive Apple sensor arrangement, or copied hardware controls. It is a presentation vessel for a cross-platform app. Use an actual iPhone only through an appropriate alternative described in the asset guide.

Photorealism is not mandatory everywhere. Material consistency is. If the 3D test looks worse than a refined flat composition, use the flat composition until the device is credible. No plastic-looking substitute merely to satisfy a “3D” label.

## 6. Shot list — 20 seconds at 60 fps

Frame intervals are **start-inclusive, end-exclusive**. Final frames are 0–1199. Transitional motion belongs inside these intervals; do not add seconds between shots.

| Shot / frames | Time | Picture and purpose | Exact marketing copy | Motion and sound |
|---|---|---|---|---|
| 01 / 0–108 | 0.00–1.80 | A macro of the device's upper edge against ink. A shaped blue reflection suggests the portal. Reveal enough of the real dashboard to identify software by 0.60s; no long mystery prelude. | `Your Odoo.` then `In their hands.` | One controlled light/camera reveal. First text readable by 0.35s. A soft tactile onset and brief tonal lift; no explosion. |
| 02 / 108–240 | 1.80–4.00 | Pull back to one large device, almost frontal. Small brand identifier `Shadow Portal` appears. Finish with a clear, composed hero image. The blue arch becomes a simple framing device. | No new slogan. Keep the opening promise long enough to read, then retire it. | Decelerate fully by about 3.00s. Hold the product. A gentle musical arrival supports the reveal. |
| 03 / 240–480 | 4.00–8.00 | Match the screen into a large, flat crop on the pale studio background. Show time-off type/dates already selected, then the actual Submit Request action and submitted/pending result. One meaningful interaction, not accelerated form filling. | `Employee requests.` | 4.00–4.55 transition; 4.55–5.50 read; about 5.60 press; actual feedback; 6.20–7.70 result hold; exit. One dry touch and one soft confirmation. |
| 04 / 480–696 | 8.00–11.60 | Match the same synthetic request into a verified Odoo record/detail. Common title, dates and pending state establish continuity. A later approved state may follow a clear editorial cut or a verified manager action; do not imply submission automatically approves it. | `Connected to Odoo.` | 8.00–8.45 aligned record handoff; show readable proof from roughly 8.60–10.40; move to the later resolved record. No neon cable, data particles, invented dashboard, or claimed live integration test. |
| 05 / 696–948 | 11.60–15.80 | Return to the employee's view of that same request, now approved. Enlarge the actual status region. Use an authentic notification only after verifying the presentation; an in-app status view is sufficient. | `Clear status. Less chasing.` | One restrained status/notification arrival, then a generous reading hold. A small positive two-note cue. The resolved record closes the employee/company loop; no guarantee of instant delivery. |
| 06 / 948–1200 | 15.80–20.00 | The portal silhouette resolves into the actual brand mark. Wordmark, tagline, and CTA form one clean lockup. Preserve the mark's proportions. | `Shadow Portal` / `Your Odoo. In every pocket.` / `Meet Shadow Portal.` (or verified `Book a demo` + destination) | Complete arrivals by 17.00s. Hold all required text through the end. Small sonic signature at 16.20s, decay naturally. No last-second word reveals or default fade to black. |

Total main marketing text is roughly 30 words, plus the brand and essential product UI. Do not add subtitles that restate each headline.

**If Odoo access/capture is unavailable:** use a faithful isolated reconstruction of the relevant record fields in shot 04, identified as a reconstruction in the handoff. If even the relevant state/fields cannot be verified, show the app's actual submitted-request detail while retaining only a source-supported integration statement. Record the missing Odoo proof as a limitation. Continue producing a review cut; do not fabricate a live backend screen.

The new end tagline is proposed campaign copy for company buyers. Keep the existing `Your workplace, in your pocket.` as an available fallback if the owner prefers it; do not stack both taglines.

**If expenses are the desired hero feature:** replace the time-off workflow entirely with expense submission and status. Show a real attachment action with a prefilled amount. Do not add expense as another two-second detour. Camera attachment does not establish automatic receipt extraction or reimbursement.

## 7. Visual tokens

These are proposed **film tokens**, with their provenance shown. They do not change app source or claim to be Apple's numerical design rules.

| Token | Value / rule | Provenance |
|---|---|---|
| Ink stage | `#080814` | Existing brand SVG |
| Secondary dark | `#131328` | Existing brand SVG |
| Pale studio | `#F6F8FB` | Actual app light background |
| Dark-stage type | `#FFFFFF`, secondary `#CBD5E1` | White from identity; secondary is film choice |
| Light-stage type | `#111827`, secondary `#64748B` | Actual app light theme |
| Brand blue | `#4F8EF7` | Existing mark |
| Deep blue / highlight | `#2A5FD4` / `#89BFFF` | Existing arch gradient |
| Approval green | `#10B981` | Actual semantic success color; status only |
| Display family | Outfit 500 or 600; 700 sparingly | Existing family and available bundled weights |
| Supporting family | DM Sans 400 or 500 | Existing family |
| Logo | Actual source lockup; embed required fonts or outline an export copy | Keep canonical identity files intact |
| Spacing | Multiples of 8px at 1080-height landscape; optical adjustment allowed | Film production grid |
| Headline tracking | Start at `-0.025em`; inspect individual pairs | Film choice |
| Headline leading | `1.02–1.08`; maximum two lines | Film choice |
| Film panel corners | 24–32px at 1080 reference size | For annotations only; real UI keeps its own radii |
| Shadow | One broad, soft, low-opacity grounding shadow when a surface requires it | Avoid a shadow pasted under a floating device with no receiving surface |

Use blue for identity and a motivated light accent. Do not tint every shadow, every panel and every headline blue. Keep the pale section neutral enough to create real contrast with the dark opening.

Headlines at 1920×1080: start at 104–128px; support text 36–44px. At 1080×1920: start at 76–96px; support text 44–52px. Final sizes follow the composition, not blind scaling. The existing logo's own typography is exempt from the marketing type scale.

For essential on-screen UI proof, target a displayed text height equivalent to at least 12–14px at a 360px-wide vertical preview. That often means 36–42px in the 1080-wide export. Achieve this with a faithful close crop or magnified detail. Do not enlarge every label inside the actual app UI or expect viewers to read a full-screen miniature.

No per-word rainbow gradients. A restrained gradient on the arch is already part of the brand. Marketing headlines are solid-color by default. No fake scan lines, grid wallpaper, abstract particles, lens-flare streaks, constant grain or endless levitation.

## 8. Composition for each format

### 16:9 — 1920×1080

Start with 96px horizontal and 72px vertical margins. A whole-device hero can occupy about 78–88% of frame height. Use the screen-filling close-ups for actual interaction proof. Alternate macro, whole product, full UI crop, shared record, and closing lockup; do not alternate only “phone on left” and “phone on right.”

At a 640×360 playback preview, every main headline and the decisive request state must still read without pausing.

### 9:16 — 1080×1920

Compose it independently from shot 01. Working **critical-content** box: x=96–900, y=240–1500. This is a conservative starting overlay for social controls, not a universal platform specification. Recheck against the actual destination's current preview UI. Decorative hardware may extend outside this box; CTA, key text and the decisive UI state may not.

Use a larger screen detail instead of a tiny phone plus a tiny desktop record stacked beneath it. For shot 04, present the app record and Odoo record sequentially with the same title/status anchored in the same screen region. Do not force the landscape comparison into the portrait layout.

Arrange the end mark, wordmark, tagline and CTA inside the critical-content box. Keep the final CTA comfortably above the platform caption/action area. Inspect the video at 360×640 and on a real phone before calling it ready.

## 9. Motion specification

The values below are starting constraints for this film; tune by viewing rendered motion. Web UI timing advice does not impose a 300ms maximum on a cinema camera move. Conversely, a dramatic camera move does not justify sluggish button feedback.

| Motion | Starting specification |
|---|---|
| Headline arrival | 18–24 frames; 24–40px translate; opacity 0→1; `cubic-bezier(0.23, 1, 0.32, 1)` |
| Headline departure | 10–14 frames; small fade/translation; do not spend equal time ceremonially removing every word |
| Two-line relationship | 3-frame offset maximum; prefer line/group animation over repeated word cascades |
| Device reveal | 60–84 frames including a long deceleration; no positional overshoot; hold after landing |
| Product reframing | 30–54 frames; continuous path; smooth acceleration/deceleration; `cubic-bezier(0.77, 0, 0.175, 1)` as a first test |
| UI feedback | Follow the real app; target the visible press response within 6–10 frames in the staged demonstration |
| Marketing status detail | 18–24 frames; short travel, near-critical damping, no rubber-ball bounce |
| Ordinary edit | Hard cut, match cut, or 8–12-frame dissolve where meaning requires it |
| Final logo arrival | 36–60 frames; retain at least 180 frames of clean final readability |

One dominant motion per moment. During an important UI change, the device and camera should be settled. During a camera move, keep screen content stable. Retire the present sinusoidal float during reading holds.

Use anticipation only when it clarifies an action. Use overshoot only for a small, motivated feedback element. Do not give the metal phone, typography, panel and camera the same spring.

Anchor a magnified UI detail to its source position before it becomes the composition. Keep the viewer's eye near the location of the next meaningful state. If a transition obscures both states for more than a few frames, shorten it or cut.

Inspect transition boundaries at actual frame rate, at 0.25× speed, and frame by frame. Look for velocity jumps, mask seams, double images, premature opacity loss and text clipping. A script that reaches its final numbers is not sufficient evidence of good motion.

## 10. Device, camera and light

Build or obtain real geometry for moving product shots. A CSS rounded rectangle with gradient sidewalls is suitable for an animatic; it is not the default final device for this treatment.

**Default generic device brief:** approximately 0.075m wide, 0.155m tall and 0.008m deep; softly machined edges; original silhouette; neutral graphite; clean uninterrupted screen opening. Match the screen mapping to the app capture without stretching. The dimensions describe a generic object, not a particular phone model.

Use a single stable camera lens around 70–90mm full-frame equivalent for product shots. Start at 85mm. Compose with camera distance, not a changing focal length. Settle near frontal for legibility: roughly 0–12° yaw and 0–5° pitch during reading. Larger angles are allowed briefly in the initial macro, where the UI is not being read.

Light with a large rectangular softbox above/left, a narrow rear edge light, and low environment fill. Optional blue rim must have a plausible source. Reflections should describe curvature and bevels. Use [Poly Haven Studio Small 03](https://polyhaven.com/a/studio_small_03) as a lighting starting point, then shape highlights deliberately.

Suggested physical-material starting points: graphite frame metalness 1, roughness 0.22–0.35; glass IOR around 1.45–1.50, roughness 0.03–0.08. These values require adjustment for the engine, scale and exposure. Do not make the screen a blown-out lamp or cover the UI with a broad white reflection.

Use restrained depth of field on the opening detail only. Product UI proof stays sharp. Keep scene lighting and display texture color management separate enough that the app's white, blue and success green survive the render. Validate against a reference swatch in the final composite.

Start motion blur at a 120° shutter for moving geometry; compare with 180° if movement stutters. At 60 fps those correspond to approximately 1/180s and 1/120s. Hold frames should be sharp. Composite final marketing typography separately so a camera blur does not smear the message.

## 11. Audio direction

An original synthesized track is not inherently inferior to licensed music. Choose by listening, musical arc and fit. The existing score has not been audibly assessed in this brief's audit.

Default musical direction: restrained electronic pulse, tactile percussion, warm low end, sparse harmonic detail, no vocals. Use roughly 100–115 BPM as a search starting point, not an obligation to cut every shot on a two-second grid. Give the film a beginning, development and resolved ending.

Use silence and subtraction: introduce the world lightly; establish rhythm at the product reveal; reduce competing sound around the UI proof; resolve at the brand. Avoid a whoosh on every item and sub-bass on every cut.

Keep separate music, interaction SFX, transition SFX and brand-signature stems. Key cues: opening tactile onset; hero arrival; submit touch; submitted confirmation; quiet Odoo record match; later approval cue; final two/three-note signature. Synchronize each audible transient to its visible causal event.

Starting mix target for the web delivery: approximately -14 LUFS integrated, with encoded true peak no higher than -1 dBTP. This is a house delivery target, not a claim that every platform mandates that loudness. Judge perceived balance at matched playback volume. Check mono, headphones and a phone speaker. Inspect the encoded file, since lossy encoding can alter peaks.

Use the verified sources in the asset guide. A human must listen to the final track. If your tools do not expose audio perception, state that explicitly and provide a short audio review checklist. Never equate loudness measurements with listening approval.

## 12. Implementation route

Recommended approach for this repository: **Blender product shots + the existing deterministic compositor**, with Remotion available if a short proof shows it materially improves editing and review.

The current code already has useful frame seeking and export logic. A wholesale rewrite is not required for better taste. Blender supplies the geometry, materials, camera and lighting that CSS is approximating. Composite UI details and type in the existing HTML pipeline or Remotion; make the decision after a two-second test.

If Remotion is selected, install and read its official skills, use frame-driven values throughout, and verify current Three.js integration and licensing. Do not run CSS time-based animations, unsynchronized video textures or independent real-time physics inside a supposedly deterministic export. The engine should return the same frame when asked twice, regardless of render-worker order.

Create new work under `marketing/intro-video-v2/`. Keep original outputs and source intact. Do not rewrite unrelated app components, install global software or change other project environments just to make the film. Put local dependencies in the film workspace. If a dependency is unavailable, produce the animatic and style frames using available tools and identify the precise missing capability.

Suggested project organization:

```text
marketing/intro-video-v2/
  README.md
  references.md
  assets-manifest.csv
  design-tokens.json
  timeline.json
  assets/                 # model, HDRI, fonts, captures, audio
  source/                 # composition and device scene
  review/                 # style frames, animatic, scorecard, comparison
  out/                    # final exports and posters
```

Use a shared frame-based timeline for visual events and sound. Record fps=60, durationFrames=1200, all shot boundaries, UI actions, SFX events, and copy. Generate time in seconds from frame/fps. Lock all random seeds and preload assets/fonts before capture.

Use frame-index timestamps when joining rendered chunks. Preserve the existing lesson from `render.mjs`: variable-length segment timestamps must not cause a missing output frame. Verify decoded frame counts rather than relying only on nominal duration.

If Blender is used, render a numbered image sequence or appropriate lossless/intermediate passes; keep camera/frame rate aligned with the compositor. A browser glTF export will not automatically preserve Blender procedural shaders. Bake necessary maps and verify materials after import. Premultiplied/straight alpha mismatches must be resolved before final composition.

## 13. Production checkpoints

These are required working artifacts and self-review gates, not a request to stop for permission after each phase. Continue when they pass. Ask only for a genuinely missing factual input or a purchase that the owner needs to make.

1. **Repository and claim check.** Identify the real screens, demo record, supported action/state and CTA. Save a short assumptions list. Measure the old cut; inspect its decoded frames.
2. **Style frames before motion.** Produce six final-size stills for landscape and six for portrait, one per shot. At least hero, request close-up and end card must be fully art-directed with the intended device/material treatment. View them at full size and small delivery size. No placeholders in a frame marked final.
3. **Two-second device proof.** Test the actual model, UI mapping, light, motion blur, output color and render cost. Compare to a strong flat version. Fix the weak route or choose the stronger one.
4. **Full 20-second animatic.** Export every shot with actual copy, crops and approximate audio at low resolution. Verify the narrative and reading time. Avoid polishing a single gorgeous opening while the middle remains a feature slideshow.
5. **Motion pass.** Refine attention flow, holds, camera curves and causal UI responses. Remove movement that weakens comprehension. Inspect one complete pass at speed and another slowly.
6. **Sound and finish.** Use the chosen licensed/original track, listen, mix, check mono, and review the phone at target size. Only now increase expensive render settings.
7. **Final export and QA.** Render both independently composed cuts, inspect their actual encoded outputs, record the scorecard, and fix failed criteria. Do not label them finished solely because rendering completed.

Keep intermediate previews visible and explain specific improvements. Do not ask the owner to choose among ten vague aesthetics. Present one recommended direction with concrete evidence.

## 14. Acceptance scorecard

Score each category from 0–5 and multiply by weight/5. Scores are an editorial review aid, not an objective certification. Require at least 85/100, with no category below 4, after honest visual review.

| Category | Weight | Passing evidence |
|---|---:|---|
| Story and comprehension | 25 | An unfamiliar company buyer can name the app, explain its connection to Odoo, and describe the employee request/status benefit after one silent viewing |
| Composition and type | 20 | Distinct shots; clear hierarchy; essential text readable at 640×360 and 360×640 |
| Device and material craft | 15 | Convincing edges/reflections; sharp screen; no flat-card sidewall illusion or texture stretching |
| Motion and editing | 20 | Intentional holds; no unnecessary float; clean velocity and masking; transitions preserve attention |
| Sound | 10 | Human listening completed; useful dynamics; cues feel causal; mono and encoded peak checks pass |
| Product truth and finish | 10 | Screen/record continuity; no unsupported feature/availability claims; exact exports and clean frame boundaries |

Automatic rework conditions: unreadable approval state; malformed or inconsistent UI; simulated automatic approval; an unverified “instant” guarantee; unlicensed/watermarked source in final; a missing/duplicated frame caused by concatenation; a portrait cut made by blindly cropping landscape; or an inaudible/unlistened track described as fully approved.

If human listening is still pending, leave the audio category unapproved and deliver a clearly identified review cut. Do not invent a passing score to reach the threshold.

## 15. Deliverables

- Landscape: `shadow-portal-launch-v2-16x9.mp4`, 1920×1080, 60 fps, exactly 1,200 video frames / 20 seconds.
- Portrait: `shadow-portal-launch-v2-9x16.mp4`, 1080×1920, 60 fps, exactly 1,200 video frames / 20 seconds.
- H.264 playback files, yuv420p, proper Rec.709 conversion/tagging, AAC stereo at 48 kHz, fast-start enabled. Check primaries, transfer, matrix and range in the actual encoded stream. Tagging alone does not perform a color transform.
- High-quality intermediate master or preserved lossless frame sequences where practical; separate WAV mix and stems where their licenses permit delivery. Do not call a compressed delivery MP4 the sole archival master.
- Three posters per aspect: hero, product proof and end card; export from intentional settled frames.
- Editable source, asset/source/license manifest, actual preview/render commands, assumptions, known limitations and completed QA notes.
- Side-by-side old/new hero and interaction stills, plus a short note identifying the changes that improved comprehension and craft.

Decode-check the whole final file. Verify first and last frame, shot boundaries ±2 frames, frame count, duration, audio alignment at meaningful cues, clipping, banding, font fallback, text overflow, masking and portrait safe areas. Explicitly distinguish measured checks from viewed/listened checks.

This film is scoped for a website, social feed or sales presentation. An App Store Preview is a separate deliverable with its own requirements; do not assume this stylized marketing cut qualifies unchanged.

**Begin with the source-of-truth check and six-shot style frames. The standard is a coherent, legible and memorable product film, with evidence that the final export meets this brief.**
