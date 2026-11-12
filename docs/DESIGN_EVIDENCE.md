# TGIQ graphics implementation and visual evidence

## Reference inspection and asset handling

- All six user-supplied archives were opened read-only, and exactly 24 PNG references were extracted by `scripts/reference-assets.py`.
- The extraction rejects absolute/traversal paths, caps file sizes, accepts only PNGs, validates images, ignores `__MACOSX` and every AppleDouble `._` entry, and writes fixed semantic filenames. The garbled em dash is decoded from CP437/UTF-8 where possible; the original archive path and normalized original name are retained.
- `references/manifest.json` records the archive, original path, normalized name, dimensions, SHA-256 digest and reference-only usage for every image.
- Every variation was visually inspected in these six contact sheets, with the full player-comparison PNG additionally inspected for logo edges and typography:
  - `references/profiles-contact.jpg`: player, manager, owner, executive.
  - `references/transfers-contact.jpg`: announcement, fee breakdown, clubs, contract.
  - `references/comparisons-contact.jpg`: player, manager, season, finances, arguments.
  - `references/statistics-contact.jpg`: player, match, finances, big number.
  - `references/timelines-contact.jpg`: player, manager, history.
  - `references/scoreboards-contact.jpg`: result, sequence, details, cup.
- These are flattened references. Their portraits, crests, text and statistics were **not** treated as independent source assets. No complete reference PNG is used by a runtime component.
- Canva connected design search located `TGIQ Clean LOGO` (`DAHajlt-CF0`); `get_design_pages` returned six 1920×1080 page thumbnails. The available connected tools did not expose a clean asset export, so no editable-logo or independent-layer claim is made.

## Logo and typography

`public/brand/tgiq-logo.png` is a tightly cropped, transparent raster of the standalone mark in `references/comparisons/player.png`. Origin crop: source pixels `(110, 57, 478, 174)`, then white/cyan foreground selection and transparent bounding-box trim. Result: **353×105 pixels**. This operation preserves the original proportions and contains no show-name tagline. It does not claim to recover editable vector artwork. Replace this file, or set the editable `Logo URL` field to a licensed replacement, when a clean master is available. Reference sheets and comparison screenshots keep the original supplied images intact.

Locally served Barlow Condensed Bold, Barlow Condensed SemiBold Italic and Barlow Regular fonts are downloaded from the official Google Fonts repository. The OFL files are stored beside the fonts. Fonts load without a third-party font request during filming. Shared CSS tokens define navy `#061328`, panel navy `#071b34`, blue `#15375e`, cyan `#00bce9`, white `#f4f7ff`, muted blue, 72px stage safe margins, spacing, radii and font families.

## Renderer and registry

`src/lib/graphics/registry.ts` defines 28 explicit variants: the 24 reference variants plus full league table, selected-position extract, numerical player leaderboard and editorial ranking. `graphicSchema` validates documents, identities, source scope, per-metric raw values/units, primary and comparison provenance, editorial fields, match events, aggregate and separate shootout score. Unknown imported template IDs are rejected.

The producer preview and clean output use the same `GraphicStage` React component. Text, metric rows, backgrounds, rules and geometric accents are live HTML/CSS/SVG. Fetching and provider normalization stay outside the components. A null graphic produces an intentionally blank stage. A missing image uses subject initials or the correctly mapped crest, never an unrelated portrait; failed images disappear cleanly.

Full-screen output is a logical **1920×1080** stage. Portrait cards occupy **552.375×982 pixels**, exactly **9:16**, positioned 72px from the selected side and 49px from the top. The rest of the stage is transparent by default; solid navy is selectable. Screenshots with black space outside the sidebar have actual alpha transparency, not black presenter footage.

Pagination is explicit: profiles 4 facts; announcement 2 fee/contract values; contract 3 values; metric comparisons 4/5 rows; statistics 4/5 metrics; timelines 4/5/6 milestones; chronological goals 7 rows; grouped scorers 5 names per side; league table 8 rows; extracts 6 rows; numerical leaderboards 8 rows; editorial ranks 6 rows. Names wrap and size proportionally, while pagination keeps dense content readable. `pageCount` uses the same visible datasets as the renderer. Long field content still needs producer review before broadcast; layout QA is evidence for the tested documents, not an assertion that arbitrary 1,200-character values will fit.

Own goals retain credited team order and an `(OG)` marker; in-match penalties use `(P)`. Scorer minutes are grouped by player and event kind. Chronological goals retain home/away order in running scores. Shootouts are a separate result, and null scores on unstarted/cancelled matches remain unavailable rather than becoming a final 0–0.

Editorial preflight requires a source URL, attribution and period/date for ownership/executive, transfer, financial, editorial arguments, timeline and editorial ranking graphics. Financial units must be explicit. `preloadGraphic` loads local fonts and the referenced images before a take, failing visibly to the producer if an image is unavailable. The existing program graphic remains the responsibility of the authoritative output controller.

## Verification

Commands run successfully:

- `npx vitest run tests/graphics.test.ts`: **9 tests passed**. Coverage includes all 28 schemas, unknown templates, missing versus zero, Unicode, raw metric/provenance round-trip, own goals and penalties, scorer grouping/running order, cup shootout separation, unstarted scores, shared ranks, dense profile/metric/table/argument/transfer/scorer/detail pagination, and financial editorial preflight.
- `npx eslint src/components/graphics src/lib/graphics tests/graphics.test.ts tests/visual/graphics-qa.tsx`: passed.
- `npx tsc --noEmit --pretty false`: passed with the assembled application at the time of the check.
- `node scripts/capture-graphics.mjs`: **28 template captures + 5 edge-case captures** at 1920×1080. The final capture reports **0 hidden-overflow or footer-boundary findings** for the checked text and content panels. `docs/screenshots/templates/capture-results.json` records the actual timestamp and result.
- `/tmp/tgiq-assets-env/bin/python scripts/compare-reference-renders.py`: generated **24 labelled side-by-side comparisons** in `docs/screenshots/comparisons/` and an overview in `docs/screenshots/graphics-overview.jpg`.

The fixture entry point is isolated in `tests/visual/graphics-qa.tsx`. Synthetic values are labelled in the screenshot footer and never imported by the Next.js application. They test layout; they are not evidence of football data accuracy. Missing-portrait behavior is intentionally exercised: actual ESPN profile/roster verification for Saka and Vinícius Júnior returned no headshot, so the application must support this state honestly. The reference portraits remain only in the left-hand reference image. These are reconstructed, reference-aligned layouts; no pixel-perfect match or recovered Canva components are claimed.

Visual QA corrected issues found during initial captures: overly large sidebar names, long table-name collisions, a dense table overflowing its footnote, four contract fields overlapping the footer, and financial units expanding comparison rows. Final screenshots exercise left/right placement, transparent and navy background, a long Unicode name, zero versus missing metrics, a null scheduled score and continuation pages. Reduced-motion settings suppress animation/transition styling. Prepared render timings are measured by the root application's workflow test separately from this isolated visual harness.

## Tablet producer and editorial UI check

An independent live-browser check used the running app at `http://localhost:3000` with a **1024×768 touch-enabled viewport**, signing in through the actual production form. It did not rotate output access, clear output, freeze/unfreeze or take a graphic live.

- The owner editor exposed ownership group, acquisition date, group role and other-club fields, plus name, role, club, source URL, attribution and reporting date.
- A transparent PNG was uploaded through the actual image control after entering origin and usage/licence metadata. This used the supplied TGIQ mark as an explicitly local-QA test file, not as a claimed owner portrait. The uploaded `/api/assets/...` reference survived saving the owner graphic to a durable episode snapshot.
- Changing from owner profile to club finances preserved the selected subject. The financial editor accepted an explicit `0`, unit, metric source and reporting period; the saved snapshot retained the string `"0"`.
- The fee-breakdown editor exposed status, initial fee, conditional add-ons, maximum fee, currency, origin/destination clubs and date. `Reported` was entered as an explicit status.
- Two graphics were saved into `LOCAL QA — tablet image and editorial verification`; the episode was archived after the check to keep fixtures separate from ordinary production material.
- The browser issued **zero program-mutation requests**, and the authoritative program remained at **version 5 throughout this check**. No output access token was changed.
- The final tablet layout had **no horizontal page overflow**. Take Live remained visible while editing lower fields, at logical viewport bounds **x=522.94, y=148, width=316.70, height=45**.

Tablet CSS now gives the browser/editor their own scroll areas, keeps Preview/Take Live/Clear sticky inside the prepared column, uses two rundown columns and ensures touch buttons and fields have 44px targets. Narrow phone layouts keep the output controls along the bottom. This check does not claim a fully offline mobile remote.

Screenshots: `docs/screenshots/tablet-initial.png` (before responsive adjustment), `tablet-editor-before-upload.png` (sticky controls while editing), `tablet-financial-preview.png` (after adjustment). Machine-readable results: `docs/screenshots/tablet-qa-results.json`.
