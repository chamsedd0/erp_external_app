# Shadow Portal — why the current film stops short

Reviewed 27 September 2026. Audience clarified by the owner: **companies buying the app**. Paid assets are acceptable when they improve the result.

The existing film has a recognizable identity and capable export engineering. Its main limitation is editorial: the product is presented as a rapid tour of features, with almost the same visual treatment for every benefit. A more convincing sales film needs a clearer business proposition, a continuous example, deliberate changes of scale, and more time for important states to register.

## What was actually reviewed

I inspected decoded images across the landscape export at 0.25-second intervals, the portrait export at one-second intervals, the composition/render/audio source, and relevant app/backend files. Contact sheets are in `evidence/`. I decoded the complete landscape file while measuring audio. Both exports report 1,140 video frames at 60 fps; the landscape decode also completed with 1,140 frames. Landscape is 1920×1080; portrait is 1080×1920; both are 19 seconds.

This was a sampled visual sequence and code review, **not an audiovisual watch-through**. I could not listen to the soundtrack. Perceptual judgments about its melody, timbre or emotional effect remain open. I did not independently repeat the previous assistant's two-hit sync test or inspect every frame.

Measured landscape audio: approximately -12.4 LUFS integrated, 2.8 LU loudness range, and about -1.5 dBFS in FFmpeg's true-peak summary. Those values do not establish whether the music is good or whether it feels synchronized. A short film's loudness-range figure alone is not grounds to reject its dynamics.

## Findings

| Before | After | Why |
|---|---|---|
| **0–4s:** ten small paperwork/message elements, an arch drawing itself, a portal traversal; app reveal starts at about 3.92s. `intro.js:91`, `intro.js:209`. | Show identifiable app content within roughly 0.6s and establish the buyer promise immediately. Keep one portal gesture. | About 21% of the film passes before the app reveal. The opening asks a buyer to wait for relevance. |
| **4–12s:** dashboard, leave, expenses, then notifications, with a new headline and state roughly every two seconds. `intro.js:97`. | Follow one employee request into Odoo and back to the employee's updated status. | A connected example explains business value more persuasively than four abbreviated demonstrations. |
| **4–10s:** phone and large two-line headline share essentially the same framing; the sides swap. `intro.js:519`. | Alternate macro, whole-device hero, full UI detail, matched Odoo record, and final lockup. | Changing composition and scale creates a visual argument. Side-swapping creates movement with limited new meaning. |
| **Product shots:** a 418×872 CSS phone, gradient body/edge and flat glare layer. `intro.css:79`, `intro.css:94`. | Real geometry or an intentionally flat graphic treatment; shaped reflections and a stable screen plane. | The current device lacks the material and edge behavior of a carefully lit product shot. More blur samples do not add geometry or lighting. |
| **6–8s:** fields fill, days count, content scrolls, tap appears, toast arrives. The toast starts at 7.50s and the next whip at 7.82s. `intro.js:98`. | Start from a meaningful prepared state; show one submit action; hold the result for well over a second. | There are only about 0.32s before the next transition starts. Viewers can notice activity without understanding the outcome. |
| **8–10s:** amount counts from zero, category changes, form scrolls, camera flash, receipt arrives, submit, toast. The toast-to-whip interval is about 0.27s. `intro.js:99`, `intro.js:674`. | In a separate expense-led variant, use a plausible already-entered amount and one attachment/submission action. | A form value counting up is decorative and can confuse how the product works. The receipt is too small to be the visual proof. |
| **Throughout the middle:** repeated tunnel outlines, dark blue glows, particles and drift surround dark UI. `intro.js:817`, `intro.js:1033`. | A quiet pale studio for proof, bounded by ink-dark brand shots; clean contrast and one controlled accent. | The continuous atmosphere makes separate scenes feel alike and pulls attention away from the interface. Blue itself is part of the brand and should remain. |
| **Phone reading holds:** perpetual Y/X/Y-rotation sine movement plus extra scale pulses. `intro.js:565`. | Let the device stop when a buyer needs to read. Move to explain the next thing. | Rest is a designed part of motion. Constant movement weakens the difference between important action and decoration. |
| **10–12s:** an approval banner breaks out of the lock screen under “Know instantly.” `intro.js:100`, `intro.js:717`. | Show an authentic later status/notification, with a readable cropped detail and measured wording. | Push support exists, but code inspection does not prove delivery latency. An editorial cut should also avoid implying automatic approval. |
| **12–14s:** four external feature cards, a phone showing more modules, plus language and appearance chips. `intro.js:746`. | Spend that attention on the request's connection to the company's system. Leave secondary capabilities to another asset. | Multiple competing reading targets overload a short scene, especially in portrait. |
| **14–15.5s:** Odoo finally becomes explicit, via a small record and light beam, with more compatibility chips below. `intro.js:101`, `intro.js:762`. | Name Odoo in the opening buyer proposition; give an actual related record a meaningful readable shot. | For companies buying the app, this is part of the reason to care, not a late compatibility footnote. |
| **Portrait:** whole phone is reduced further in feature/integration scenes; Odoo record and tiny chips sit below it. `intro.js:519`. | Replace the landscape comparison with sequential full-width details; keep important text clear of social controls. | This is already a separate layout, which is good, but its hierarchy still carries too much content into the smaller viewing area. |
| **16–19s:** brand lockup is recognizable; tagline/CTA are comparatively small while flares and light sweeps continue. `intro.css:246`, `intro.js:1172`. | Settle the logo, enlarge the relevant sales message/CTA, and hold a complete lockup for the final three seconds. | The buyer needs a clear final thought and action. An unverified release announcement is not a sales destination. |

File/line citations above refer to the reviewed `marketing/intro-video/` source. They identify implementation evidence; visual judgments come from the exported frame sequences.

## Verdict by impact

### Highest impact: story, hierarchy and buyer relevance

The first redesign should change the edit and narrative, not just the device. The buyer should see “employee action → connected Odoo record → clear employee status.” The current film says “we have many modules,” which is useful information but an unfocused 19-second argument.

The first four seconds and final three seconds consume about 37% of the running time. That leaves only twelve seconds for the dashboard, forms, notifications, four extra modules and integration. Stronger work chooses what deserves a whole shot and lets the rest go.

### Next: simplification, timing and physical consistency

Keep the identifiable arch but reduce its screen time. Give UI proof a stable camera. Vary the shot size, not just the phone's X position. Replace generic glow with controlled light that describes the product. These changes create a more premium impression because the viewer can tell what matters.

The headline masks are not inherently broken; the partial letters in transition samples are often intentional masked entrances/exits. The issue is how often the same reveal is repeated and how much reading time remains afterward. Do not report intentional transition frames as clipping bugs without checking the surrounding frames.

### Engineering and verification

Retain the deterministic time-driven composition, bundled app fonts, seeded randomness, sub-frame motion blur, and frame-index timestamp reconstruction. The render script already contains the repair for the earlier variable-chunk frame-loss issue. The new brief requires rechecking the actual exports rather than assuming the old bug remains.

There is no evidence here that moving from 60 fps to another rate or adding more render workers would improve the art direction. A Remotion rewrite is optional infrastructure, not the creative fix. A low-resolution complete animatic has more decision value than another expensive render of unchanged compositions.

### Audio and accessibility limits

I cannot fairly call the existing score cheap, bad or unprofessional without hearing it. Its original synthesis is not itself a defect. Require listening and a deliberate music/SFX edit in the next pass. The film should also make sense muted and at small size. Interactive UI rules about hover, gesture interruptibility and reduced-motion settings should not be misapplied to a fixed encoded movie; any embedded autoplay player needs its own appropriate controls and accessibility behavior.

**Decision: Block approval at the requested premium launch-film standard; retain the existing cut as a useful baseline.** This is an editorial judgment against the requested quality bar, not a claim that the current export is unusable or technically broken.

## What the replacement brief adds

`CLAUDE-PRODUCTION-BRIEF.md` supplies a company-buyer proposition, one continuous example, six shots with exact frame boundaries, original campaign copy, brand-derived tokens, two-format composition rules, a material/lighting specification, controlled motion values, audio direction, workflow choices, staged review artifacts, and measurable completion criteria.

`SETUP-AND-ASSETS.md` supplies Claude setup commands, a focused skills shortlist, exact asset pages, format compatibility notes, a purchase strategy, and a ready-to-paste kickoff message.

## Evidence map

- [Landscape opening](evidence/landscape-sequence-01.jpg): 0.00–4.75s, 0.25s steps.
- [Landscape workflow](evidence/landscape-sequence-02.jpg): 5.00–9.75s, 0.25s steps.
- [Landscape notifications/features](evidence/landscape-sequence-03.jpg): 10.00–14.75s, 0.25s steps.
- [Landscape integration/ending](evidence/landscape-sequence-04.jpg): 15.00–18.75s, 0.25s steps; final four cells unused.
- [Portrait opening/workflow](evidence/vertical-sequence-01.jpg): 0.00–9.00s, one-second steps.
- [Portrait notifications/ending](evidence/vertical-sequence-02.jpg): 10.00–18.00s, one-second steps; final cell unused.

These are review thumbnails. Judge fine UI detail from the original MP4 at full output resolution as well as realistic small playback sizes.
