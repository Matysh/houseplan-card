# #866 author evidence — 16 October 2026

This is an author handoff, not an independent review or an S8 declaration.
Base: `1bdc5a1a0828bf7bc01b291136e4d3bd61a25b8e` (origin/dev).
Accepted specification: issue comment `6218320949`, body SHA256
`dde691787346fa9595a3a9bd33775b915f033b9886ff2f782c1f8e26e6ce24c3`.

## Designer comparison (AC1)

[Frozen designer archive](https://github.com/user-attachments/files/33533153/issue-866-snapping-handoff-2026-10-16.zip)
SHA256: `d03cf880dbfc4482eac38d51b3f5b386c88e94204baa3a1390bcb93a2e59482b`.
Four original renderer/style files are pinned byte-for-byte by
`test/device-contact-designer.test.mjs`. Reference glyph records are the three
required records, not a replacement production renderer.

Run `npm run bundle:sync`, then `node demo/smoke_device_contact_designer.mjs`.
The command produces paired `SCENE-SIZE-reference.png` and
`SCENE-SIZE-production.png`, `comparison.json` and `material.json` in
`artifacts/866/designer`. All twelve arrangements × 32/56/96 reference pixels
passed numerical contour/core comparisons, glyph paint and visible-frame guards.
The author inspected the paired contact sheet, not only the PASS strings.

| Frozen example / production filename stem | Maximum boundary error over 32/56/96 | Visual conclusion |
|---|---:|---|
| Near wall / `wall-near` | 0.725 px | Free circle unchanged, no invented attachment |
| Left contact / `wall-left` | <0.001 px | Closed flush side, two square contact corners |
| Top contact / `wall-top` | <0.001 px | Flat upper edge; original circular core |
| Right contact / `wall-right` | 0.011 px | Symmetric right contact, no masonry overlap |
| Double at wall / `wall-double` | 0.116 px | Whole badge included, upright readable content |
| Wall row / `wall-row` | <0.001 px | Single shared contour, no internal seams |
| Row / `row` | 0.727 px | Correct pitch, no cumulative drift |
| Column / `column` | 0.709 px | Continuous narrow silhouette, separate cores |
| L / `l-shape` | 0.999 px | Empty inner corner preserved; no group rectangle |
| 2×5 / `grid` | 0.440 px | One outer contour, small-member convex radius |
| Badge link / `badge` | 0.720 px | Badge and core share outline, not actions |
| Detachment / `detach` | 0.719 px | Connected pair plus unchanged free circle |

Core error was ≤0.023 CSS px. The known free shell 101.5/80 versus reference
103/80 empty-field difference is retained; D never receives an extra 80/103
shrink in product code. The synthetic fixture registers one whole scene by its
core centres, without per-member fitting. Product MDI glyphs and existing wall
paint are not replaced with the prototype's demonstration artwork.
The ordinary golden matrix now includes both-theme twelve-case boards; its
new baselines still require complete reviewed-source capture/acceptance.

## Executed ordinary evidence

- `smoke_device_contacts`: native mouse/touch/keyboard target ownership, one
  point write and one Undo/Redo, Alt press/release, RU/EN visible join guide,
  toggle independence, detach/Esc, pointercancel, actual capture release, blur,
  refused-write rollback, exact future siblings, cold accepted-pair remount,
  native Optimize preview, passive static parity and Flat↔iso round trip: PASS.
- `smoke_device_contact_walls`: all 68 cases PASS — 35/50/100/200% actual
  editor zoom; both sides of H/V and ±30/45/75°; four badge sides at 45°;
  6/9 px hysteresis, exact one-point drop and upright manual 37° icon angle.
- `smoke_device_contact_work`: 200 actual markers with rows, badges and a wall;
  30 unrelated HA frames caused zero face remeasure/index rebuild. Drag used
  incremental local moves, not an all-plan pair scan; cancellation restored all
  200 positions. PASS.
- Inherited `smoke_device_equal_spacing`, `smoke_device_hit_capsules` and
  `smoke_device_position_history`: executed PASS, not inferred from source.
- Backend coordinate canonicalization suites: 10 passed, no skips. Includes
  existing schema + real saved-layout-state canonicalization of the shared fixture.
- After correcting matrix metadata, two moved registry anchors, new corpus
  inventory membership, explicit callback types and the core line count:
  199 targeted ordinary units passed, no skips. Static mutation registry check
  passed with execution=0; caught evidence remains unknown/nightly-only.
- The initial full gate was red: new explicit any, core growth, matrix metadata,
  two stale registry anchors/corpus inventory and two monolith limits. The
  addressed failures were rerun as above. Full `gate:small` passed on
  `31e384449a47` at 18:35:05–18:37:23 UTC (5,075 units passed, one existing
  skip); light Validate [38948944582](https://github.com/Matysh/houseplan-card/actions/runs/38948944582)
  also passed. Later batching changes require their fresh gate below.

Raw commands, UTC start/end, exit status and logs live under `artifacts/866`.
Performance reports use `.report.json` separately from wrapper receipts; early
same-name outputs were overwritten by receipts and are not comparison evidence.
The before/after diagnostic uses the same current runner and historical base
source, seven measured samples and one warmup; exact-SHA Linux CI remains the
performance gate. Do not promote concurrent or dirty exploratory runs to proof.

## Remaining before S7

### Protective AC negative evidence

Ordinary inputs below run against unchanged production helpers or the mounted
bundle, not substituted implementations. No mutation is claimed caught.

| AC | Positive witness | Negative witness / what the assertion rejects |
|---|---|---|
| AC1 | 36 frozen comparisons + both-theme golden boards | Pinned original-file hashes; missing glyph/clipped-stage guards and native zero old-frame opacity reject empty/hidden/duplicate production paint |
| AC2 | Native 68-case wall matrix | `device-contact` short face/invalid normal/masonry intersection; maintenance suite door/window/passage holes reject a target across an opening |
| AC3 | Row/column/L/grid units + native detach | Diagonal/bbox-only proximity cannot join; extraction of the middle of ten produces separate components and unchanged neighbours |
| AC4 | Native Alt/toggle plus independent spacing smoke | Bypass yields no contact; resolver rejects outside release radii; reversed candidate arrays yield the same result |
| AC5 | Native own mouse/touch/Enter + inherited capsules | Unit overlapping 44px floors choose the painted member; the empty L corner is not a group target |
| AC6 | Native one point write + Undo/Redo | Esc/cancel/capture loss/blur/refused write restore the exact before/group and do not add history; blur was naturally red before its fix |
| AC7 | Real canonicalizer/backend save + native cold mount/Optimize preview | Removed/moved host receives no exemption; unrelated/outlier/foreign-floor points remain subject to maintenance |
| AC8 | Static parity and Flat↔iso native checks | Iso must have no Flat contour/contact attributes and must retain old tile shadows; static hit paths must stay passive |
| AC9 | Native 200-marker work counters | Thirty unrelated HA frames must not measure/rebuild; changed text reconciled through public options with an unchanged box must reuse the graph; drag must not rebuild the full index or scan all pairs |
| AC10 | Native RU/EN guide text and canonical docs | No actionable toggle in View; guide disappears after release/cancel/Alt; layout keys stay only existing x/y/s |

Commands: `node --test test/device-contact*.test.mjs` after the ordinary test
compile; `node demo/smoke_device_contacts.mjs`,
`node demo/smoke_device_contact_walls.mjs`,
`node demo/smoke_device_contact_work.mjs`,
`node demo/smoke_device_contact_designer.mjs`,
`node demo/smoke_device_equal_spacing.mjs`,
`node demo/smoke_device_hit_capsules.mjs`.

1. Owner approved the two requested monolith ceilings in the current chat:
   raw bundle 2,970,705 and host references 5,418 (answer: “Разрешаю”). The old
   2,000/25 bands and all gzip/absolute budgets remain unchanged. No broader
   budget or product-scope exception is inferred.
2. Fresh full gate and named inherited lifecycle/context/static smokes on the
   final material; refresh numerical/camera/work evidence after source changes.
3. Publish the unblocked task branch, full attested golden capture, inspect and
   accept only explained changed/new frames, then exact-SHA Validate.
4. Independent S7 review and pipeline merge to S8; author must not merge dev.

The native 200-marker, designer and wall checks are headless pinned-browser
observations, not physical GPU/owner field acceptance. No schema migration,
shape choice, group action, group drag, release/tag or main push is included.

Registered expensive witnesses (static check only, not executed):
`device-contact-rebuilds-identical-value-geometry`,
`device-contact-rounds-exact-drop-to-grid`,
`device-contact-window-blur-keeps-preview`,
`device-contact-retains-individual-frame-seams`. The ordinary immediate-frame
assertion found the old frame's inherited 200ms opacity transition: contact now
retires that frame without fading underneath the new contour. Free frames keep
their original transitions.

The expanded 200-marker case first failed on `sameMetricValueNoIndexBuild`
with actual visible 27% and index builds 7→8 (`same-metric-before-fix-r4`). The
fixed ordinary run passes while preserving group ink. Earlier r2/r3 probes timed
out waiting for the HA-only virtual source repaint; they are not contact-index
regression evidence. The final test explicitly reconciles the new value through
the unchanged public card-options entry and does not claim HA classifier proof.

## Cold-face layout batching

The seven-sample sequential comparison against the unchanged historical base
was naturally red at `31e384449a47`: long-task count P95 10 > 8, total P95
1,685 > 1,654.9 ms and editor maximum 178 > 165 ms. Timings for pan/HA were
green. Cold distinct faces interleaved a DOM insertion, rectangle reads and
removal, forcing layout for each value. The renderer now inserts all distinct
probes, reads them, then removes them as one batch. Metrics remain bounded to
256 cached faces; the temporary result retains all faces even above that limit.
The expanded ordinary 200-marker case has twenty distinct badge values and
passes the measured-faces-to-batches check. The additional registered witness
`device-contact-measures-cold-faces-separately` is static-only, never executed.
Fresh final performance/visual/gate results are still required before handoff.

The full 207-frame capture on the earlier source correctly refused acceptance
until all toolbar consequences were declared. Five old/new frame pairs were
inspected: `geometry-devices-editor-dark`, `device-dialog-desktop-en` and
`toggle-entity-dialog-desktop-en` differ only at the new Magnets button behind
the dialog. In `device-inbox-narrow-ru-dark` and
`device-help-popover-light-ru`, the extra button wraps the narrow toolbar and
changes the plan viewport behind the unchanged dialog/popover. The two new
`device-contacts-designer-light/dark` boards contain all twelve complete cases
with 32 real glyphs and seven joined groups. Only these five changes and two
new frames are intended for the final attested acceptance; no other baseline
may be updated.
