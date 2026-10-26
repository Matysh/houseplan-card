# #1081 — accepted UI Lab implementation evidence

The paired PNGs show the immutable accepted reference on the **left** and the
product implementation on the **right**, each in a fresh browser context. These
are new public synthetic scenes, not the owner's original private screenshots.
No accepted JS adapter or CSS override was loaded into the candidate. Both use
the same accepted `reference-theme.css`, HA frontend 20260930.4, Russian locale,
viewport, DPR 1, and pinned Playwright 1.62.0 / Chromium 151.0.7922.34 rev1234.

Reference commit: `e6a4edc8902b1954d5bd4949f8043896f1543ed5`, portable package
`docs/ui-lab-reference/2026-10-25-beta2`; `verify-package.mjs` verified its
22 package files / 14 byte-identical accepted sources. Product fingerprints and
the zero page-error lists are recorded per scene in `reference-pairs.json`.
Desktop viewport is 1440×1000. Confirmation also has 390×844 light/dark pairs.
The paired-capture product source tree is
`src@b1592b3632503642e9e5393bdcc55fe4eff6b81e`, unchanged in final implementation
commit `04f31c95ece917ffff0c69555b20fbb5a75d8486`. Subsequent fixture/matrix and
documentation changes explain the build fingerprint change; the product
`src` tree is byte-identical.
Native screenshots omit the cursor, so cursor contracts use computed-style and
drag assertions rather than a claim about pixels.

| Accepted point / source under `accepted/overrides/` | Product owner | Observable evidence |
| --- | --- | --- |
| UI-032 `decor-selection-frames.mjs` | `editors/properties/selection.ts` reuses singleton painter | `group-*-pair.png`; group/text unit cases; `smoke_decor_multiselect` |
| UI-034/035 `color-picker-motion.mjs` | `hp-color-opacity.ts` | `picker-*-pair.png`; `smoke_picker_motion` native/fallback timing, inert exit, reopen, Tab, disable/detach, reduced motion; existing shared-consumer smokes |
| UI-036 `space-dialog.mjs`, `houseplan-card.css` | shared draft, `space-plan-list.ts`, `space-form.ts` | `space-*-pair.png`; session race/failure unit and form smoke |
| UI-037 `furniture-placement-pan.mjs` | existing stage camera + furniture press owner | native `smoke_furniture_pan`: click/up, irreversible threshold, pan/return, cancel, capture loss, blur, right button, floor change, next click; shared preview integration below |
| UI-039 `device-context-actions.mjs` | `DeviceCopyEditor`, existing visibility writer/delete path | `menu-*-pair.png`; real menu/hide/show smoke; eligibility matrix and HA hidden-source copy tests |
| UI-040 `confirmation-kit.mjs` | shared `HpConfirm`, settings kit | `confirm-*-pair.png`; light/dark/narrow golden; cancel/stale-target guards remain existing confirmation protocol |
| UI-041 `hidden-device-status.mjs` | `device-face.ts` | `hidden-*-pair.png`; one-dot priority unit and persisted hide/show smoke |
| UI-042 supersedes UI-033, `houseplan-card.css` | existing tabs/reorder owner | mode cursor smoke; existing real space-tab drag regression |
| UI-043 `device-context-actions.mjs` | existing inbox, shared toolbar eye retained | `catalog-*-pair.png`; hidden-device toggle smoke checks absence of old duplicate and persistence of header control |
| UI-044 `editor-grid-coverage.mjs` | bounded live-grid rect, existing live camera | grid receipts and paired performance samples below; all three modes, fast/slow reversal, zoom/release, View grid absent |
| UI-045 `space-dialog.mjs`, `houseplan-card.css` | shared space notice + settings kit | `blocker-*-pair.png`; square banner, action on its own line / 12px gap, no deletion without confirmation; narrow wrapped-text golden |

The accepted sources are a visual contract, not shipped runtime adapters. The
candidate deletes the former group-outline painter and duplicate catalog label,
help and CSS. All placements, history, async ownership and writes stay in their
product owners. #1020 onboarding is a separate task. #1080 owns preview cleanup
in `live-editor.ts`; this task does not duplicate that cleanup.

## UI-037 + UI-038 integration

Pinned WSL production build of temporary combined commit
`50456362a3cd86cef68d800c6d93309ae60707a2` = #1080 at `0a4984dec` + this
task's first product commit `783c889d54d6ec9c89988d14b76fb3df2df1eeaa` passed
both `node demo/smoke_furniture_pan.mjs` and
`node demo/smoke_decor_preview_ownership.mjs`: real native pan/cancel/capture
loss/blur/right button/floor switching and a single presented ghost. No other
task's code was copied into this task branch. The combined checkout existed
only to test the actual interaction before either task's automated merge.

## UI-044 witness and performance

`grid-before.json` is the unchanged earlier production build (fingerprint
`c69c46ea1e6b3996fcc8730294b777adcf9249c6dbc4306a782ebc5353a8d7a4`). Native
pan exposed white edges: all six coverage/pixel assertions were RED, edge ink
zero. `grid-after.json` records the same public empty scene with all six PASS;
edge ink is measured away from stage borders. The later expanded smoke adds
zoom, fast/slow reversal, release and View/no-grid checks. This is a historical
source witness, not a temporary mutation of the candidate or its limits.

Reproduce measurements with `node demo/benchmark_ui_lab_grid.mjs
--baseline=<historical-source-tree-with-matching-bundle>`. The full raw per-frame
arrays and CDP duration/heap/layer observations are in
`grid-performance-samples.json`, with no removed outliers. Six alternating
before/after pairs use the identical blank scene, 1400×1000, zoom 800%, DPR1/2
(three pairs each), native mouse path and fresh contexts. Trace hashes are in
`trace-hashes.json`; full traces remain local diagnostic outputs.

| Median of three samples | Before DPR1 | After DPR1 | Before DPR2 | After DPR2 |
| --- | ---: | ---: | ---: | ---: |
| frame p95, ms | 16.8 | 16.7 | 16.8 | 16.7 |
| task, ms | 149.080 | 145.197 | 162.186 | 151.755 |
| script, ms | 30.700 | 29.892 | 34.017 | 31.512 |
| paint, ms | 12.014 | 12.047 | 12.275 | 13.063 |
| geometric max layer area, px² | 1411200 | 1444950 | 1411200 | 1444950 |
| painted layer count | 5 | 5 | 5 | 5 |

No measured frame/task regression appeared. Paint is not free: DPR2's median
rose about 0.8ms over the whole ~1.3s trace, with overlapping before/after ranges
(11.502–21.8 / 12.556–13.175ms). Geometric layer area rose 2.4%, inside the
existing 25% bounded exposure; this CDP metric is **not actual GPU allocation**.
Heap medians stayed around 8.28MB. The existing refresh throttle and all
performance predicates remain unchanged. This paired local result complements
the ordinary unchanged interaction budgets; it does not claim universal
performance equivalence on every browser/GPU.

## Protective contracts

| AC | Proof | What rejects the negative case |
| --- | --- | --- |
| AC1 | singleton/group structural render and native move | extra-frame count and unequal per-kind frame oracle |
| AC2 | shared picker native/fallback browser lifecycle | `picker-exit-remains-interactive-1081` registered, **not executed**; ordinary disabled/detached/reopen inputs |
| AC3 | async session tests + real form | late old-session response, failed/empty list, current edits retained |
| AC4 | native click/pan/cancellation smoke | `furniture-release-ignores-pan-1081` registered, **not executed**; unchanged implementation gets cancel/blur/wrong-floor inputs |
| AC5 | eligibility matrix + real HA copy | disabled/removed/missing/unknown binding cannot become an active HA source; hidden active copy becomes a visible virtual record |
| AC6 | cancel/target guards and narrow frames | cancel leaves record; existing stale confirmation owner prevents late deletion |
| AC7 | presentation matrix | hidden+new must produce one grey dot, never two |
| AC8/9 | real UI cursor/toggle regressions | View pointer, duplicate catalog control absent, server visibility unchanged by local eye |
| AC10 | historical RED → candidate PASS | `grid-loses-incoming-pixels-1081` registered, **not executed**; presented edge pixels and coverage |
| AC11 | raw paired samples and ordinary budgets | unchanged budget failures reject excessive cost; no thresholds relaxed |
| AC12 | notice geometry and real saved config | opening blocker does not remove a space/device; explicit confirmation remains mandatory |
| AC13 | immutable package + separate paired scenes | accepted source adapters never enter candidate; joint #1080 proof; existing touch/rights smokes |

`mutation-gate.mjs --check` is static readiness only: execution=0,
caught=unknown (nightly only). No mutants were executed.
