# Start here — Claude setup, assets and handoff

Prepared 27 September 2026. The owner wants to persuade **companies buying Shadow Portal**, and allows **paid assets when they improve quality**. This guide recommends sources; no paid asset has been bought, downloaded, or import-tested as part of this handoff.

## 1. What to give Claude

Open Claude Code in this repository. Give it all three files:

1. `marketing/video-direction/CLAUDE-PRODUCTION-BRIEF.md` — the assignment, six-shot treatment and production specification.
2. `marketing/video-direction/AUDIT.md` — evidence-based reasons for changing the existing film.
3. This file — setup, asset selection, and practical workflow.

The main brief is the source of direction. Skills support execution; they do not replace the brief, choose a new visual identity, or prove the movie has been watched.

### Paste this message

```text
Read marketing/video-direction/CLAUDE-PRODUCTION-BRIEF.md,
marketing/video-direction/AUDIT.md, and
marketing/video-direction/SETUP-AND-ASSETS.md in full.

Make the revised Shadow Portal marketing film described there, for companies
buying the app. Paid assets are acceptable when they improve quality; show me
specific purchase choices and prices before buying. Preserve the existing cut.

Use the app and brand sources in this repository. Follow the six-shot treatment
and its visual/motion tokens. Start with six composed style frames for each
aspect ratio, then a complete animatic, then finish the motion and sound.
Continue through your review checkpoints without asking me to approve routine
implementation choices. Show the actual previews and fix the problems you find.

Aim for Apple's product-film craft: clear hierarchy, precise product lighting,
causal motion, strong editing and moments of stillness. Keep Shadow Portal's
identity and truthful product behavior. The Odoo connection is central to the
sales argument. A high render resolution alone does not meet the brief.

Use available tools honestly. If you cannot view a video or hear audio, say so
and leave that review pending. Deliver both final aspect ratios, editable
source, asset records, posters and QA evidence as specified in the brief.
```

When available, provide a real demo-booking destination and a synthetic Odoo demo account/capture. Claude can complete style frames and the animatic before either exists. The default end card remains “Meet Shadow Portal” until a working sales CTA is known.

## 2. The skills worth installing

### Remotion's official skills — useful if the composition uses Remotion

Maintained by the makers of Remotion. Covers frame-driven animation, audio, assets, rendering and related workflows. The [official installation guide](https://www.remotion.dev/docs/ai/skills) supports Claude Code. The [directory listing](https://www.skills.sh/remotion-dev/skills/remotion-best-practices) showed about 547.8K installs and 4.7K repository stars when checked; popularity is a supporting signal, not a quality guarantee.

From the repository root:

```powershell
npx skills add remotion-dev/skills --agent claude-code
```

Choose project scope and the relevant video skills in the installer. Include `remotion-best-practices` and the applicable create, markup, render, studio and docs skills. Let the installer use the current repository layout rather than manually copying one file whose companion references may be missing.

If you want only the umbrella skill initially:

```powershell
npx skills add remotion-dev/skills --skill remotion-best-practices --agent claude-code
```

Check for referenced companion skills if the installed version expects them. The official package changes over time.

### Anthropic's frontend-design — optional for composed HTML/React frames

Useful for type, composition and deliberate visual choices in the current browser-based pipeline. It is not a cinematography, 3D lighting or soundtrack skill. Its guidance must defer to the fixed Shadow Portal brief. The [listing](https://www.skills.sh/anthropics/skills/frontend-design) showed about 928.7K installs and 178.5K repository stars when checked; I also inspected the [upstream skill](https://raw.githubusercontent.com/anthropics/skills/main/skills/frontend-design/SKILL.md).

```powershell
npx skills add anthropics/skills --skill frontend-design --agent claude-code
```

Verify the project installation:

```powershell
npx skills list --agent claude-code
```

Claude Code's [skill documentation](https://code.claude.com/docs/en/skills) describes project skills under `.claude/skills/`. If installation succeeds but the skill is not visible, start a fresh Claude Code session in this repository and inspect its skill menu. For Windows systems where symlinks fail, the [Skills CLI](https://github.com/vercel-labs/skills) supports `--copy`.

These are **Claude Code** instructions. Ordinary Claude chat and Cowork have different skill-loading surfaces. For a regular chat, attach the three Markdown files and use that product's supported skill settings; do not expect a local terminal installation to appear there automatically.

### Apple principles and motion direction

Use the official Apple links in the brief as references. There is no verified official “Apple cinematic motion designer” skill in this shortlist. The local Apple-design guide used during this audit concerns interface behavior, not film production. Its spring and spatial-continuity ideas are useful; its interactive timing rules should not control every camera shot.

The custom production brief supplies the missing director role. Keep it in context during style-frame review, animatic review and finishing. Additional generic design skills are optional and can introduce conflicting styles.

## 3. Recommended production route on this Windows workspace

**Most control:** Blender for the moving generic device and lighting; the existing HTML compositor for type, UI crops, editing and export. Claude can drive Blender through scripts if Blender and its command-line interface are installed. A new browser-control plugin is not required for that route. Get Blender from its [official download page](https://www.blender.org/download/).

**Optional composition upgrade:** Remotion gives a React-based timeline, preview and render workflow, with [Three.js integration](https://www.remotion.dev/docs/three). Choose it after a short test, not because a library promises better taste. Review [Remotion's current license](https://www.remotion.dev/license) for the company using it; it is not safe to assume every commercial team is covered by free use.

**Faster device-shot route:** [Rotato Web](https://app.rotato.app/) runs in a browser, including Windows. Test a representative screen-video import and export before subscribing. Its native desktop app is for Mac; do not buy a Mac-only template bundle expecting it to run locally on Windows. Check which generic models and export formats are available in the web product; do not assume parity with the Mac version.

**After Effects route:** sensible if you already have an operator or an editable AE workflow. A purchased template can shorten device-shot production, but its predetermined camera move must fit the storyboard. It is not a drop-in replacement for a GLB model in the code compositor.

No exact render duration is promised. Benchmark the two-second device test at the selected resolution, quality and GPU before estimating the full film.

## 4. Phone models and mockups — exact places to obtain them

The entries below are a verified source shortlist. Listings and sample descriptions were inspected; the files have not been downloaded or tested in this project. Prices and availability can change.

| Source | What to obtain | Fit for this film | Caveat / next step |
|---|---|---|---|
| [CGTrader — Generic Smartphone, nwambejosh](https://www.cgtrader.com/3d-models/electronics/phone/smartphone-cc1fca88-7c8b-40d5-8553-c0a37605dfe1) | Editable model; listing advertises GLB/glTF, FBX, OBJ and 4K PBR textures; listed at $3 when checked | First inexpensive candidate for the Blender/3D test | Inspect the actual silhouette, screen mesh, UVs and normals. “Generic” in a title does not prove an original hardware design or perfect production quality. |
| [Rotato — generic device collection](https://rotato.app/generic), including [Generic Phone](https://rotato.app/phone/generic-phone) | Ready device scene with image/video screen replacement | A practical paid shortcut to polished device plates | Generic collection pages describe the Mac workflow. Verify the chosen model in Rotato Web before a Windows purchase. Export a plate; do not assume editable mesh export. |
| [Blendkit — iPhone 16 Plus by Fiq KM](https://www.blendkit.com/asset-gallery-detail/d67d6a81-2117-45b2-ae06-2d5a30d9083c/) | Free-listed Blender model; approximately 13,350 polygons; royalty-free asset license shown | Concrete free hardware-model reference and technical test candidate | A recognizable Apple model has separate brand-use considerations below. Refit the screen to its actual aspect; don't stretch a capture. |
| [Blendkit — iPhone 16 Pro procedural model by Ilyas Nugraha](https://www.blendkit.com/asset-gallery-detail/c807f02c-61b1-4122-a908-cd42543bc915/) | Full Plan asset; procedural materials; approximately 48,609 polygons | More detailed Blender candidate if a recognizable device is appropriate for the chosen use | Procedural materials may need baking for GLB. The listing's quality rating is not a render test. |
| [LS.Graphics — iPhone 15 Pro Looped Animated Mockups](https://www.ls.graphics/products/iphone-15-pro-looped-animated-mockups) | Eight preanimated After Effects scenes, advertised at 60 fps; listed at $49 when checked | Fast option for an AE-based workflow | Fixed/preanimated shots, not a general 3D mesh. The page gives inconsistent resolution figures, so verify the actual project specification before buying. |
| [Apple Design Resources — Product Bezels](https://developer.apple.com/design/resources/#product-bezels) | Official Photoshop/PNG device artwork | Accurate **static** framing and reference proportions | Not an unrestricted spinning 3D model; follow Apple's usage rules. |

**My recommendation:** first test the generic model with custom studio lighting. If its geometry or screen mapping fails at close range, commission a simple original generic device or choose a better editable generic model. Spend the effort on one credible shell and use it consistently. A famous-looking phone cannot compensate for tiny UI or weak timing.

### What a usable model must contain

Ask for `.blend` for Blender, or `.glb`/`.gltf` with all texture files for a browser renderer. FBX/OBJ can work with conversion. A `.max`-only file is a poor fit unless the required conversion software is available. A PNG/PSD mockup cannot provide arbitrary camera angles or correct moving reflections.

Required model qualities: separate screen material, clean UVs, coherent real-world scale, smooth bevels, stable normals, editable materials, predictable pivot, modest geometry, and no baked-in watermark or unwanted logos. Prefer screen, glass and frame as separate objects/material slots. Confirm that the closest planned camera view holds up before committing to the asset.

For the screen: determine the exact active display aspect ratio, capture/reconstruct at that aspect, map to the display once, clip correctly around its corners, and check a square calibration grid before using the real UI. Render a neutral white/gray/blue test to check color and reflection handling.

### A practical Apple asset distinction

Apple's [marketing guidelines](https://developer.apple.com/app-store/marketing/guidelines/) restrict modifying/animating its supplied product images and list simulated Apple products among unauthorized marketing uses. They separately discuss custom photography/video. A third-party model's royalty-free license does not itself grant Apple's brand permissions. For this freely choreographed cross-platform film, an original generic shell is the default. Use supplied Apple bezels as permitted static artwork, or follow the applicable guidance for authentic device footage. This sourcing constraint is why the main brief does not tell Claude to spin an official Apple PNG.

## 5. Lighting, fonts, sound and UI sources

| Need | Exact source | Use |
|---|---|---|
| Studio lighting environment | [Poly Haven — Studio Small 03](https://polyhaven.com/a/studio_small_03) | CC0 HDRI. Start with a 2K/4K HDR or EXR, use as environment/reflection fill, add controlled area lights. Keep the visible background separate. |
| Existing type | `marketing/intro-video/fonts/` | Outfit and DM Sans already exist, with OFL notices. Reuse them rather than replacing the brand with SF Pro. |
| Existing icons | `marketing/intro-video/icons.js` and actual app components | Keep the app's icon family and stroke language. Avoid mixing arbitrary SF Symbols into reconstructed app UI. |
| Logo | Repository-root `shadow-portal-logo.svg` and `shadow-portal-icon.svg` | Extract/use the actual vector mark; create an outlined export copy when font portability requires it. |
| Screens | Demo build of `production-version/` | Consistent synthetic employee/request data, no real employee information. Capture real UI before considering reconstruction. |
| Paid music and effects | [Artlist Music](https://artlist.io/royalty-free-music), [license details](https://artlist.io/help-center/privacy-terms/artlist-license) | Shortlist three instrumental tracks with a clean 20s edit, sparse pulse, editable ending, and space for SFX. Choose a plan covering company/client use and paid promotion; save the asset certificate. |
| Free tactile UI sounds | [Kenney — Interface Sounds](https://kenney.nl/assets/interface-sounds) | CC0 pack. Audition restrained clicks/confirmations; process and mix them to fit the film. This is a source, not a recommendation to use game-like bleeps everywhere. |
| Larger free effects library | [Sonniss GameAudioGDC archive](https://sonniss.com/gameaudiogdc/) | Commercial-use effects per bundle terms. Download the relevant portion and keep its license. Avoid a huge library download merely to find one whoosh. |

For Artlist, paid/promoted and client uses differ from a personal social plan, and publication timing can matter to continuing coverage. Check the selected plan and project circumstances on the linked current license page. Do not reuse a track just because it is audible in an Apple film.

Do not use AI-generated UI text as final app footage. Generated art can explore lighting or backgrounds, but production UI needs reliable text and stable geometry. If the receipt variant is made later, use a clean fictional receipt photo with consistent visible information.

### Where paid spending helps most

1. A model or artist pass that solves believable edges, screen mapping and reflections.
2. A track with a strong short-form structure, plus a deliberate listening/mix pass.
3. A motion designer's critique of the complete animatic and final timing, if the owner wants an additional human pass.

The known $3 model and $49 AE template are alternative candidates, not a required shopping basket. Subscription and commission costs are not fixed here. Claude should recommend a selected route and its actual current cost rather than collecting overlapping tools.

## 6. Asset handoff procedure

Put selected assets under `marketing/intro-video-v2/assets/`, grouped into `model/`, `lighting/`, `fonts/`, `screens/`, and `audio/`. The brief author has not created or populated that production folder.

For each source record: local filename, creator, source URL, acquisition date, license/receipt location, allowed project use, dependencies and whether it passed the import/render test. Use `assets-manifest.csv` as specified in the main brief. Keep vendor source files local where redistribution is restricted; finished renders and project handoff must respect their terms.

Ask Claude to report a simple asset readiness result: model imports, screen maps correctly, colors match, sound is licensed, and the two-second proof looks good. A screenshot of an asset's store listing is not that test.

## 7. How to judge the first delivery

Review the **style frames first**. Ask whether each would work as a polished still advertisement and whether the actual app state is readable. If not, repair composition before adding animation.

Then watch the complete animatic once with sound off. You should understand that Shadow Portal connects employee requests to the company's Odoo workflow. You should not have to read a features list to infer the value.

Finally listen at normal volume and watch the actual encoded cuts on a phone. Check the opening, approval state and final CTA. Give concrete feedback such as “the status is too small,” “the second shot never settles,” or “the music overpowers the tap.” The production brief's scorecard makes this review repeatable.

The current audited cut remains in `marketing/intro-video/out/`. Nothing in this handoff requires overwriting it or discarding its useful render work.
