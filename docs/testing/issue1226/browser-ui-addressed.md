# #1226: addressed browser UI remainder

Base: `f1741de10` with product source `96ffe5444`; smoke patch `a5aa896cd`.
Checkout for local evidence: `/home/matysh/hp-batch2-infra905-20261015`.

This follow-up owns exactly the 33 rows formerly marked `not-rerun` in
`browser-ui-classification.json`. The preceding 36 passing and 9 retained-red
rows are unchanged (the update script checked their complete JSON equality).
All 33 now have an addressed execution log and SHA256. **20 pass; 13 remain
red.** The complete original 78-row inventory is therefore 56 pass / 22 red /
0 unexecuted. This is addressed evidence, not a new full stable or HA audit.

## Repairs and preserved contracts

The 16-file patch changes only synthetic preparation and test observers:

- Current graph authority is adopted as a complete versioned config, rather
  than writing ignored room/wall/partition projections on a previous graph.
  Nudge observes stable named IDs rather than graph-sorted array positions.
- Canvas frame replacement uses the actual synthetic fixture store instead of
  mutating detached config/get and layout/get replies. Both main and static
  cards now consume the same server data.
- The legacy migration remains a real migration in the opening ruler test.
  Its native writer finishes before the next authored seed is published; the
  selected space is re-read after atomic replacement. Native coordinates use
  the actual SVG CTM. The remaining ruler failures are still asserted.
- First-use View context-menu styles must be absent while cold, then adopt
  exactly once after eager dialog styles on a real right click, while the
  editor remains unloaded. The old eager-menu expectation was obsolete.
- Marker no-shadow checks now judge marker transitions, alongside the existing
  marker border-transition check, rather than unrelated UI Kit button focus.
- Under accepted #1216 metadata authority, six legacy structural collections
  remain byte-equivalent on an ordinary metadata Save. Layout/decor/columns
  still require exact lattice output; source noise cannot increase. Current
  graph writers are not redirected to the legacy decoder.
- Under #1184 responsive headers, native hook selection uses actual viewport
  scrolling, a real background double click, and a normal click on an exposed
  virtual marker. Its exact ID must agree across selection, Properties and
  catalogue. Compact floor settings use the public compact hook. No runtime,
  camera, selection or property draft is seeded.
- The #963 touch witness warms a real keyboard tooltip on visible summary
  settings, then taps the visible summary toggle. Action, tooltip suppression,
  exact data preservation, horizontal fit and visible-target containment all
  remain positive requirements. The obsolete hidden desktop zoom target and
  fixed 56px header ceiling are replaced by the accepted intrinsic layout.
- #1158 permits exactly one route diagnostic: unknown-route text replaces the
  redundant unknown plus incomplete pair. Its stale/error diagnostics and
  three failing stationary-hover resize assertions remain strict.

No production files, thresholds, goldens, skips or test selections changed.
No new issue was created by this agent.

## Passing original rows

Unmodified product-fix verification: `smoke_decor_creation_selection`,
`smoke_decor`, `smoke_decor_line_click`, `smoke_decor_multiselect` (#1222), and
`smoke_zigbee_enable_refresh`.

Unmodified performance/form verification: `smoke_selective_invalidation_inactive`
(40 original samples), `smoke_settings_polish_radar_vacuum_955` (complete vacuum
and radar viewport/theme sweep), and `smoke_daycycle_raster`.

Fixture/observer ports: `smoke_canvas_surface_gestures`, `smoke_canvas_frame`,
`smoke_e2e_hooks`, `smoke_editor_nudge`, `smoke_editor_styles_lazy`,
`smoke_geometry_corpus`, `smoke_houseplan_panel`, `smoke_lattice_write_barrier`,
`smoke_marker_shadow_transitions`, `smoke_opening_preview`, `smoke_sun`, and
`smoke_ui_polish_963_touch`.

The day-cycle diagnostic originally refused a dirty working tree as designed.
The final isolated run on **clean** `a5aa896cd6f690105c85297281a789b9abe4b115`
exited 0 with `measurementValid=true`, ratio **1.028321378909411** and unchanged
ceiling **2**. Complete paired trace data is retained in
`artifacts/diagnostics/863/issue1226-clean-a5aa896cd.json`; raw log is
`output/issue1226/ui-daycycle-clean.log`. The dirty sample was never counted as
valid or used to alter a budget.

The first settings-sweep run timed out during the explicit official HA wheel
preparation, not at a passing assertion. The separately completed full run
exited 0; `output/issue1226/ui-settings-r2.log` contains every result. No help
bounds, geometry tolerance or visual baseline was accepted.

## Retained red rows

Run any row with `node demo/<name>.mjs` against the fresh product bundle.
The JSON row contains its exact local log and digest; logs are below
`output/issue1226/ui-addressed/` unless noted.

| Smoke | Current retained result | Classification / next step |
| --- | --- | --- |
| `smoke_edit_walk` | Second-floor seeds 2/3 and first-floor seed 2 violate original geometry/debt invariant; complete failing config + chain saved under `artifacts/edit-walk-*.json`. | Current edit-sequence invariant; related #1224, not accepted debt. |
| `smoke_floor_cache_reuse` | After real Undo, Resize starts but accepts no held preview: 0 unions instead of 1 and safe-refusal toast. Other cache, held-ACK and fresh-card checks pass. | Retained Resize-after-Undo repro; do not count a no-op as a gesture. |
| `smoke_geometry_cleanup_842` | Explicit partition+hosted-opening Delete writes 0 instead of 1. Malformed legacy metadata/decor path emits migration-blocked toast rather than original K3-only route. | Explicit delete needs diagnosis. The metadata refusal may follow accepted #1216; no arbitrary toast acceptance. |
| `smoke_grid_snap` | Original detuned legacy fixture is rejected by Optimize preflight; no alignment/atomic write occurs. Null-safe second-run observer keeps failure but allows later per-floor cm and angle-only checks to execute and pass. | Preserve exact geometry and fixed-point requirement; migration/repair contract requires diagnosis. |
| `smoke_hide_layers` | Real zero-thickness dialog opens, but zero-wall paint is absent in View and all three editors. Other hide/meaning/handle checks pass. | Retained zero-wall rendering/workflow repro; current selectors still exist. |
| `smoke_opening_drag` | A valid-host trusted pointer drag takes one full canonical fallback where the original local-only route requires zero. | Retained local-drag route/performance invariant; no allowance added. |
| `smoke_opening_measure` | After canonical authored setup and real migrated writer completion, existing-opening drags still paint no rulers/ticks: 21 original shoulder/centre/Shift/commit checks fail; new-opening placement runs. | Canonical fixture port exposes retained drag-ruler failure; no numeric rebaseline. |
| `smoke_orphan_space_references` | Remaining-only warning still violates no-Apply report requirement. | Confirmed Optimize report-reset #1229. |
| `smoke_room_device_discovery` | #1220 delayed ACK/persist-both now passes; multi-room Save is intercepted by stage instead of the real dialog button. | Retained native dialog lifecycle repro; no forced click. |
| `smoke_room_opening_host` | Canonical delete and two Undo/Redo physical snapshots now pass; Draw over retained enclosure still never opens room recreation dialog. | Retained current face recreation repro; full host/history oracle unchanged. |
| `smoke_view_runtime_recovery` | Real summary-root 404 then native Retry ends terminal: nonce asset exports `a,s,w`, named fingerprint is undefined. | Confirmed product loader/build export contract, described below. |
| `smoke_writer_fixed_point` | Finished Draw chain, Undo chain and Redo chain each still need Optimize work. Other reference/history/metadata checks pass. | Retained writer fixed-point #1224, not an oracle update. |
| `smoke_zigbee_tooltip_layout` | Accepted single route diagnostic passes; at 95px container all badges disappear, clearing them does not restore tip, restoration does not recover fallback. Three original assertions remain red. | Retained stationary-hover resize repro. Pointer transparency, safe text and route geometry remain strict. |

## Confirmed summary retry defect

`src/summary-runtime-loader.ts` imports the entry with a statically understood
`import('./summary-panel-runtime-entry')` on attempt 0. Rollup maps that import
to its namespace wrapper. The retry uses `@vite-ignore` with an actual nonce
asset URL and still reads `module.SUMMARY_RUNTIME_FINGERPRINT` and constructs
`module.LoadedSummaryPanelRuntime`.

The fresh built entry actually exports minified names `a`, `s`, and `w`; its
named summary namespace is wrapped as `w`. The original controlled root404 /
native Retry witness imports that real asset and records
`state:error`, `terminal:true`, `exports:['a','s','w']`, and
`fingerprint:undefined`. This is not a stale test-side module extractor.
Unwrapping a fake response or weakening retry success would hide the product
bug, so this smoke was not altered.

## Validation scope

- Pinned Chromium headless-shell 151.0.7922.34, Playwright 1.62.0; existing
  attestation and bundle fingerprint checks remain active.
- Addressed original browser smoke executions only; no full stable, golden
  acceptance or HA-instance changes.
- `node --check` on all 16 changed `.mjs` files and `git diff --check` pass.
- Existing original failure evidence is preserved in every classification row.
  A script asserted byte-equivalent JSON for all 45 rows outside this delegation.
