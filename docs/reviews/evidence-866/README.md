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
new baselines have complete reviewed-source capture/acceptance, recorded below.

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
| AC9 | Native 200-marker work counters + sequential seven-sample benchmark | Twenty distinct badge values share layout batches; thirty unrelated HA frames must not measure/rebuild; same-box changed text must reuse the graph; drag must not rebuild/scan all pairs. Ordinary geometry input rejects 1,000 distant walls while retaining every reachable inclined/asymmetric badge contact |
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
2. Fresh full gate and named inherited lifecycle/context/static smokes are
   executed as recorded above/below, including refreshed numerical/camera/work
   evidence after the final product change.
3. Published task branch and full attested golden capture/acceptance are done;
   exact-SHA full Validate on the baseline commit remains required.
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

Batching alone did not resolve the comparative failure: the next seven-sample
run still had count P95 11 > 8, total P95 1,830 > 1,654.9 ms and editor maximum
182 > 165 ms. A read-only CDP CPU profile of twelve warmed floor switches
(`switch-profile`) showed only three cached face measurements but 136 samples
inside `contactAtWall` and 15 at its all-wall traversal. The dominant added
CPU was exact saved-contact recognition against every floor face, not cold
layout. A conservative circumscribed-box broad phase now excludes distant
wall faces before the unchanged exact check; snap candidates include the full
9 CSS px release radius converted to world units. Ordinary unit input compares
all slopes, both sides, asymmetrical right/top badges and four zooms against
1,000 distant faces; the exact face always remains and distant faces do not.
Its registered unit witness `device-contact-near-walls-includes-entire-floor`
was not executed. Final time-budget success is not inferred from profiling.

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

## Final performance and refreshed product checks

Sequential, non-concurrent `large-house-interaction-v1`: seven measured samples
and one warmup, pinned Chromium 151.0.7922.34 / Node 22.23.3, the same current
runner and identical fixture/runtime. Base source is the unchanged
`git archive 1bdc5a1a0828bf7bc01b291136e4d3bd61a25b8e` (not a mutant), built
and run inside one helper invocation. Its archive has no `.git`, so its report
honestly records sourceSha null; `performance-base-material.json` binds the
archive SHA and its build fingerprint is
`91995cdad87404c5ca350ecfcd0b34f4c69e0343cf6e1d8ab0a2b09bfad6dcb7`.
Candidate report source is `101cd1f3c51403059b2dbf6b68d289f64337a25f`, fingerprint
`4fa969768a5af72397ecef2e6b03eb9905e55e4eb998b161e78c98fa563c2390`.

`performance-broadphase-comparison-7.report.json`: all checks PASS with the
unchanged `demo/performance/budgets-large-house-interaction.json`.

| Observed metric | Base | Candidate | Current limit |
|---|---:|---:|---:|
| Editor series median | 518.7 ms | 636.0 ms | 750 ms |
| Twelve warmed floor switches median | 433.3 ms | 483.3 ms | 683.3 ms |
| Long-task count P95 | 5 | 6 | 8 |
| Long-task total P95 | 1,273 ms | 1,366 ms | 1,654.9 ms |
| Maximum editor long task | — | 151 ms | 165 ms |
| Unrelated HA tick median | 32.7 ms | 32.7 ms | 72.7 ms |

This is a local comparative diagnostic, not a substitute for final exact-SHA
Linux CI. The final implementation also passes all 36 designer comparisons
(`final-designer`), all 68 native wall cases (`final-walls`), the full native
actions/history/cancellation/static/iso cohort (`final-contacts`), and the
expanded 200-marker work test (`final-work2`). Eighteen targeted geometry,
maintenance and frozen-reference units pass without skips (`broadphase-units`).
The new registry entry initially omitted its mandatory explanation: five
registry-dependent unit assertions consequently failed in `final-gate`.
The explanation is now present, and `final-registry` passes with execution=0;
the full `final-green-gate` rerun passed at 19:08:30–19:10:51 UTC, exit 0,
with all its build/types/units/registry/bundle/no-new-any/private-writes/layout
and monolith checks. The only later source delta from `101cd1f3` is that
explanation in registry metadata; product source/build fingerprint is unchanged.

Raw bytes 2,971,726 and host references 5,418 remain inside the approved
2,970,705+2,000 / 5,418+25 bands. Initial View 323,118 B gzip and lazy editor
264,819 B gzip pass the unchanged gzip ceilings/bands. No performance or
gzip threshold was raised to admit these results.

## Reviewed golden acceptance

The official full WSL capture completed at 19:11:25–19:15:27 UTC on clean
published source `4406d7a6c2cd4860c427c8d26cf617604b94a676`, matrix 75 / 207
frames. Its self-hashed passport is
`069dad275f156dd83b7159c37315ae38260ee898a7d9c5808b2d8db0fdfc40a6`, with
69 byte-identical environment witnesses (floor 10). All five changed and two
new final PNG hashes match the already visually inspected candidates exactly.
The official `golden:accept --reviewed --from=artifacts/golden`, with exactly
the five `--expect-change` and two `--expect-new` names above, replaced seven
frames and preserved the other 200 reviewed baseline files byte-for-byte.
This is an attested WSL source, not a claimed GitHub capture or physical GPU.

## First full GitHub Validate — RED, not review-ready

[38953677242](https://github.com/Matysh/houseplan-card/actions/runs/38953677242)
on `5ef696395ace2f3d028e474ab32f86bd9b639e91`: frontend, golden and performance
passed, but all three browser shards were red. No S7 request was made.
Complete smoke logs for all three shards are retained in `artifacts/866/ci-shard*`.

- `smoke_align_guides`: the new higher-priority contact magnet supersedes the
  old alignment proposal. This inherited layer/ordinary-axis witness now
  explicitly switches the new magnets OFF through the real toolbar and keeps
  all its original geometry, painter-ownership and frame-count assertions.
- `smoke_editor_tabs`: expected six old buttons/index 2 for inbox; the new
  seventh Magnets control is now explicitly expected, and Add/inbox are found
  through their existing semantic tool attributes.
- `smoke_editor_guides_lifecycle`: cancellation correctly left the activation
  barrier armed; a programmatic element.click() could not restore Devices from
  Plan. Restoration now makes a fresh native press. All old-pointer-tail,
  no-write/history, visible rollback and next deliberate drag checks remain;
  the diagnostic records path/mode/guard state on failure. Natural RED and
  focused PASS are retained (`guides-lifecycle-diagnostic`, `fixture-lifecycle-fixed`).
- `smoke_lazy_editor_chunk`, `smoke_editor_styles_lazy` and the import retry
  scenario: read-only CDP exception observation found `fingerprint: undefined`
  on the raw nonce URL. The new lazy optimizer statically imported shared
  leaves packed into the editor runtime, so Rollup changed its exports to
  internal aliases. Those leaves now join the existing editor-shared chunk;
  the normal raw named ABI returns and the unchanged nonce retry reaches ready.
  The build plugin additionally rejects emitted export metadata missing any
  of the three public editor ABI names. Ordinary malformed metadata tests
  exercise the refusal without executing a mutant or disabling fingerprint
  protection.
- `smoke_signal_visibility_lifecycle` also timed out waiting for the delayed
  editor install. Its focused rerun passes after the ABI correction.

The first attempted local empty-import reproduction used a stale committed
`dist` manifest after bundle cleanup and could not target the current retry
chunk; it was stopped as invalid diagnostic material. After a fresh build the
original CI line-389 retry failure was reproduced. No such invalid local run
is presented as a product regression or PASS.

All seven formerly failed smokes now execute PASS on the corrected chunk graph
(`ci-correction-smokes`, 19:49:53–19:51:21 UTC). They are actual full scenarios,
not a retry-until-green replacement for the first RED. The local
`ci-corrections-gate` passed every check except raw bundle growth: the preserved
ABI measured 2,972,742 B, 37 B outside the already approved band. No limit was
changed. The renderer no longer retains unused per-element face keys/metric
references or the entire previous input frame; only its floor identity is
needed alongside the actual scene/cache. This reduces retained state and
restores the approved range at 2,972,687 B (host references still 5,418).
Static registry readiness and the full native 200-marker/contact-action cohorts
pass on that state simplification (`compact-state-registry/work/contacts`).
A fresh full local gate and a new exact-SHA full Validate are still required;
the first full GitHub run remains RED.
