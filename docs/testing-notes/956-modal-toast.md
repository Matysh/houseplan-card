# #956 — modal notice evidence

Author implementation checkpoint, 2026-10-19. Not a code-review verdict or S8.
Product base: `1231b21231d3c31a228226d4441a977e7565ddb3` (dev after #961).
Product implementation: `987eea86`; subsequent changes only stabilize browser
test observation of HA's public closing phase and the announcement frame.

## Executed evidence

- Before product edits, `node demo/smoke_modal_toast_956.mjs` on the unchanged
  base failed **only** lettering paint: 3/191 reference glyph pixels matched;
  draft/accepted-config preservation and explicit retry passed. Actual,
  reference and ink PNGs were inspected: Cancel, not the error, occupied the
  actual crop. Local artifacts: `artifacts/956/before-ha-*.png`.
- The final contrast oracle still rejects those original pixels: 18/191
  (9.42%) match, below 92%. This is a comparison of saved images, not a mutant
  execution. A pure ordinary negative case also rejects blank text/reference.
- `node demo/smoke_modal_toast_956.mjs --matrix` — PASS, 16 cases / 96 assertions:
  Room/General/Space/Device ×390×820/1280×900 ×light/dark. Genuine HA frontend
  20260729.7; rejected public Save, actual lettering, localized writer error,
  draft/accepted config, unchanged outer/header/footer and one deliberate retry.
  All glyph ratios 1.0. Actual and ink images were visually inspected.
- `node demo/smoke_modal_toast_956.mjs --lifecycle` — PASS, genuine HA parent /
  native confirmation, one accessible AX alert, live-region text events,
  unchanged message rerouting, Keep/input, new identical error, root notice,
  old deadline isolation, expiry and detach. The parent HA physical close is
  observed before Keep/reopen; the test does not claim to test an immediate
  Keep during the parent's exit animation.
- `node demo/smoke_modal_toast_956.mjs --native --lifecycle` — PASS, same
  assertions on the native fallback, including root/child pixel paint.
- `node --test test/toast-presentation.test.mjs` — PASS, 3 units: message
  replacement, routing/announcement, stale pending frame, detach, two independent
  card roots and a nested component root. No second browser/card instance is
  claimed for the pure two-root test.
- `node --test test/toast-paint-oracle.test.mjs` — PASS, covered letters and an
  empty reference fail the ordinary negative-input oracle.
- `node demo/smoke_dialog_modal_recovery.mjs`,
  `node demo/smoke_dialog_help_clipping.mjs`,
  `node demo/smoke_color_picker_consumers.mjs`,
  `node demo/smoke_readonly_cold_start.mjs`,
  `node demo/smoke_empty_backup_import.mjs`,
  `node demo/smoke_config_writer.mjs`,
  `node demo/smoke_marker_write_rollback.mjs`,
  `node demo/smoke_kiosk_scale_no_editor.mjs`,
  `node demo/smoke_sections_resize.mjs`,
  `node demo/smoke_styling_hooks.mjs` — all PASS. The styling-hook witness now
  awaits the announcement frame and no longer writes `_toast` directly.
- `npm run gate:small` — 154s, **FAIL only bundleBytes ratchet**. Build/typecheck,
  full Node units (124s), no-new-any/private-writes, render-layout-read, bundle
  integrity and all gzip budgets PASS. Raw dist: **3,219,838 B**; base3,217,625
  +band2,000 allows3,219,625: excess **213 B**. Baseline not raised without owner
  approval. Initial View325,041 B gzip and lazy editor316,872 B gzip pass.
- `node scripts/mutation-gate.mjs --check` — PASS, 1699 definitions, execution0,
  caught unknown. Browser inventory420/200 warns as designed. Both new witnesses
  were registered, **not executed**.

## Protective AC: what makes the witness red

| AC | Evidence | Negative witness |
|---|---|---|
| AC1 | Genuine/native lettering pixels; actual/reference/ink PNGs | Original unmodified dev red; `modal-toast-below-top-layer-956` registered, not executed |
| AC2 | 16 public Save refusal/retry cases | Ordinary synthetic `unknown_error`; accepted config must stay unchanged until the second, explicit Save |
| AC3 | Lifecycle smoke and controller units | Disconnected owner, removal, pending replacement/clear, foreign root ordinary inputs |
| AC4 | Genuine AX tree and live-region mutation log; keyboard input | `modal-toast-reannounces-on-route-956` registered, not executed; routing must remove alert/live semantics before moving existing text |
| AC5 | Root/expiry/detach smoke, two-root unit, empty/readonly/kiosk/help/color regressions | Retired pending frame and read-only/refused writer ordinary negative cases |
| AC6 | Full units, transport/rollback regressions and unchanged writer source | Existing refusal/rights guards; size exception remains pending, not a PASS |

## Check selection and limits

`classifyRisk(git diff origin/dev..HEAD)` reports visual.ui=true,
visual.render=false; one perf signal is the bounded announcement RAF. No plan
render, pointermove, model geometry, backend, schema, service or locale changes.
Golden is not requested for this UI-only surface; the 16 genuine-HA layout
cases are its visual proof. Immutable designer/golden references stay unchanged.

`smoke-select` reports74 candidates. `_frame` is a homonym of unrelated geometry
frames; those wall/resize/junction/camera/optimizer smokes do not exercise this
controller. `_toast` readbacks alone do not establish changed writer semantics;
the config/marker rollback, empty-install, readonly, kiosk, styling hooks and
actual modal failures above are the targeted common-boundary regressions.
`baseStyles`' registered Sections witness passed. The new presenter/style link
selects `smoke_modal_toast_956.mjs` explicitly. No full geometry, Python, physical
device/GPU or manual screen-reader execution is claimed.

Stable classification is `stable-fix`: both root `_showToast` and z-index120
already exist in tag v1.81.0. No release, relay deployment, issue closing or
manual merge is part of this task. Next: resolve the raw-size baseline decision,
fresh gate/process metadata, one push/handoff and independent S7 review.
