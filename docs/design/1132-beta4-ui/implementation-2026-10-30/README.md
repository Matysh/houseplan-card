# #1132 — reference versus implementation

Normative design remains the unchanged [approved package](../2026-10-30/README.md) at4defb983. This directory records implementation checks; it does not replace owner approval or accept global Golden baselines. All data is the public synthetic fixture. Product is the native bundle, with no houseplan-card CSS/prototype override. Both lab shells use only LAB-001's missing HA scrim token.

Pinned Chromium151.0.7922.34, HA frontend20260930.4, DPR1, dark/RU. Wait for continuity readiness, fonts and finite animations across shadow roots; resize width+1 and back equally on both sides so late reference CSS receives native measurement. Initial in-flight modal/loader frames were discarded, not treated as product failures.

| Scene | Viewport | Header / rows | Rotation→zoom gap | Max geometry delta |
|---|---|---|---|---|
| 01-wide | 1600×950 | 65px / 1 | 10 | 0px |
| 02-compact | 1200×850 | 65px / 1 | 10 | 0px |
| 03-wrapped | 800×850 | 119px / 2 | hidden | 0px |
| 04-three-rows | 390×844 | 183px / 3 | hidden | 0px |

| Scene | Reference | Product | Diff | Differing pixels / max channel delta |
|---|---|---|---|---|
| 01-wide | [reference](reference/01-wide.png) | [product](product/01-wide.png) | [diff](01-wide-diff.png) | 31 / 1 |
| 02-compact | [reference](reference/02-compact.png) | [product](product/02-compact.png) | [diff](02-compact-diff.png) | 70 / 1 |
| 03-wrapped | [reference](reference/03-wrapped.png) | [product](product/03-wrapped.png) | [diff](03-wrapped-diff.png) | 62 / 2 |
| 04-three-rows | [reference](reference/04-three-rows.png) | [product](product/04-three-rows.png) | [diff](04-three-rows-diff.png) | 43 / 1 |
| 05-print-dialog | [reference](reference/05-print-dialog.png) | [product](product/05-print-dialog.png) | [diff](05-print-dialog-diff.png) | 68 / 6 |
| 06-external-screen | [reference](reference/06-external-screen.png) | [product](product/06-external-screen.png) | [diff](06-external-screen-diff.png) | 6 / 1 |
| 07-markers-lqi | [reference](reference/07-markers-lqi.png) | [product](product/07-markers-lqi.png) | [diff](07-markers-lqi-diff.png) | 0 / 0 |

All seven actual/diff pairs were visually inspected. Surfaces and geometry match; tiny header icon raster differences are isolated in the provided diffs. The marker/LQI crop is pixel-identical. UI001/010/012 map to07; UI002–005/007–009 to01–04 plus live checks; UI006 to05; UI011 to06 and native kiosk/profile checks.

Native checks: smoke_ui_polish_1132 (editor→Escape→print, mouse/reduced motion, eight actual caption/readings overlap cases in Flat/2.5D and both themes), panel_header_overflow/touch, external_screens, pdf_export, svg_export, approved_ui, device_icon_design, device_preview_parity, device_offline, device_signal_topology, device_hit_capsules, header_compact_spaces, mobile_view_header, houseplan_panel, mode_transition and panel_route_kiosk. Existing unrelated behavior remains asserted. Off is still semantic; its glyph is opaque across shared surfaces.

The overlap oracle captures blank, signal-only, label-only and combined text. It requires actual text bounds intersection, real coloured signal ink and colliding label pixels, then verifies that every core signal pixel survives. Channel tolerance5 covers glyph edge rasterisation, not occlusion. See overlap/report.json and eight crops:13/13 Flat and16/16 2.5D core pixels preserved;5–11 collision pixels per case. These are synthetic browser checks, not a claim of real-HA or owner GPU acceptance.

To repeat, start the approved replay per its README on8913. Build the task and start native UI Lab on8914 using the same fixture/HA cache and a directory containing only the approved ha-dialog.css. Run node capture.mjs <output-dir> <origin> from the product checkout (Playwright dependency), once for each server, then image-diff.mjs from the checkout using output/1132-comparison/{reference,product}. Frozen comparison.json identifies the original product fingerprint; new captures are separate evidence.
