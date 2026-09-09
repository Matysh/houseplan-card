# #505 — author evidence and visual comparison

Issue: [#505](https://github.com/Matysh/houseplan-card/issues/505).
Spec: [505-summary-panel-design-parity.md](../../specs/505-summary-panel-design-parity.md).
This is implementation evidence, **not** the independent S7 verdict.

## Reproduce the paired visual check

After `npm ci` and `npm run bundle:sync`:

```sh
node demo/capture_summary_panel_505.mjs --probe-only
node demo/capture_summary_panel_505.mjs --output artifacts/summary-panel-505
```

The [fixture instructions](../../../demo/helpers/README-ha-dialog-505.md) explain
the pinned official HA wheel, isolated loopback server, cache integrity and
optional offline wheel. No production HA instance is accessed. The genuine
`hp-dialog → ha-dialog → wa-dialog → dialog` chain is exercised; only the HA
app's private loader is exposed, not a replacement dialog implementation.

Author run on Windows/Chromium, product commit `05778a47` (pre-rebase
`a038149c`, recorded in the original capture):
source fingerprint `23ed457d01a2622aae7bb6937116f20f0044b8216b723388ed3dcf85dacd4a1e`.
Rebase onto dev `2e387ac1` preserved identical frontend source and bundle bytes;
both unrelated #495 and #505 changelog entries were retained. `gate:small` was
rerun successfully after the rebase.
The full capture completed all five paired panel contexts and native/real-HA
settings in desktop, 320/390px, light/dark and enlarged-text cases. Every settings
surface/editor/footer had no horizontal overflow and a visible footer; no page
errors, external requests or WebSockets occurred. The separate authentic probe
measured small=320, medium=580, inherited medium=920, mobile=390 fullscreen.
The product's **first opening** was 920px in both native and genuine HA.

Long German source fields were additionally re-captured using `--only` for
the `edge-*-text-200-long-de*` scenarios after replacing an incorrect assumption
about scroll ownership in the capture. Real HA scrolls its shadow `.body`,
native scrolls `.summary-editor`. The report records both scroll owners and
the actual visible band between header and footer; the source name and entity
ID were visually inspected in the corrected start/end frames. Product code
was not changed for this capture correction.

These are diagnostic frames, not canonical golden/docs baselines. The main
matrix and corrected source frames were personally inspected, including
desktop light/dark, bottom portrait, kiosk, mobile View, native/HA settings,
and enlarged German text. The portable command produces the same comparisons
for the independent reviewer. A completed capture alone is not visual approval.

## Comparison result and bounded adaptations

| Surface | Result |
|---|---|
| Header/kiosk control | Designer outline gear on the left, sidebar on the right; only the right half is active. Normal control is last in View actions, kiosk control floats above the panel. |
| Panel | Separate header, muted scroller, white/theme block cards, header dividers and left-label/right-bold-value rows. Compact content height, 12px radius and stage insets; right/bottom anchoring preserved. |
| Settings | General/Blocks cards, block count, grip/arrows/name/eye header, scope row, label/source/remove value rows, dashed add actions and separate destructive block footer match the composition. |
| Responsive form | Wide 920px shell instead of the reference's 780px accommodates readable text and 44px controls. Narrow fields stack. HA retains its own fullscreen rule and close-button placement; native keeps its normal modal close position. |
| Themes and text | HA theme colors replace hard-coded cyan/white. Text is larger than the miniature reference and follows root font size; HA's 14px root yields a 19.25px title, native 16px root yields 22px. At root32px the title is 44px and wraps without clipping. |
| Data and actions | Real HA-formatted values, stable source picker, permissions and shared/local ownership retained. Save stays visible but disabled when unchanged, unlike the demo's omitted Save. No size controls in this dialog; stored scales preserved. |

The 800×500 effective-viewport scenario is a layout proxy for 200% zoom, **not
an actual browser-zoom claim**. Separate root32px scenarios exercise enlarged
text. Different fake HA chrome, background plan and empty non-summary glyph
stubs are outside comparison scope. No pixel-identical rendering is claimed.

## Executed gates

- `npm run gate:small` — PASS: frontend units, typecheck/build, no-new-any,
  bundle parity and budget. The initial View graph is 298558B gzip, only 1B
  above the pre-task build; all added summary shell CSS is lazy. No budget or
  baseline was increased.
- `node demo/smoke_summary_panel.mjs` — PASS, retaining live values, lost-ACK,
  source identity, 10k-entity/200-row/multi-card scenarios.
- `node demo/smoke_summary_panel_polish.mjs` — PASS, actual frame sampling,
  lifecycle boundaries, native geometry and persisted-setting combinations.
- `node demo/smoke_kiosk.mjs`, `node demo/smoke_houseplan_panel.mjs`,
  `node demo/smoke_dialog_footer_width.mjs`, `node demo/smoke_nav_persist.mjs`,
  `node demo/smoke_lazy_editor_chunk.mjs`, `node demo/smoke_warm_dialogs.mjs`
  — PASS for neighbouring View/navigation/dialog contracts.
- `node scripts/check-docs.mjs --screenshots=warn` — PASS with the expected
  stale canonical screenshot warning. Strict capture/acceptance belongs to
  the beta candidate; no Windows baseline acceptance was performed.
- `git diff --check`, `node scripts/check-inputs.mjs --coverage`,
  `node scripts/mutation-gate.mjs --check` — PASS.

The broader smoke-select list includes unrelated symbols reached through the
large card renderer. Geometry, drawing, light, PDF, backend and public models
are unchanged; their full release suites and performance/golden captures were
not rerun for this task. This is not a release-quality assertion for a beta.

## AC and failure witnesses

All registered witnesses below were run with
`node scripts/mutation-gate.mjs --id=<id>` on the implementation commit:
each clean guard passed, each mutated guard failed, and the runner reported
`поймано 1 из 1` with exit0. No stale-bundle bypass was used.

| AC | Evidence | What detects a regression |
|---|---|---|
| AC1–2 | Focused smoke geometry/content + paired visual inspection above | Direct actual DOM/bounds/glyph/value comparisons; these are presentation AC, not guards. |
| AC3 | Focused smoke samples opacity, 18px offset, 190ms duration, one retained inert node, reversal and removal | `summary-hide-unmounts-before-animation` is caught. |
| AC4 | `test/summary-panel-presentation.test.mjs` plus focused browser lifecycle matrix | `summary-animation-stale-completion-unguarded`, `summary-animation-reset-keeps-presentation`, `summary-animation-ignores-reduced-motion` are caught. Actual browser checks include backgrounding, resize, eligibility, editors and identity changes. |
| AC5 | Native width/actual-control bounds smoke plus authentic HA measured and inspected frames | `summary-dialog-loses-wide-shell` is caught; it removes wide from the real form rather than changing a test fixture. |
| AC6 | Existing/focused summary smokes and paired settings frames | Actual CRUD/reorder/visibility/source/confirmation results and direct layout comparison. |
| AC7 | Summary runtime units and focused persisted-storage comparisons, admin and local-only | Read-through confirms existing scale load/save authority is untouched; the existing `summary-local-scale-authority-disabled` witness remains applicable (not rerun here). |
| AC8 | All local/mobile pairs through Save/Cancel/X/Escape/reopen/reload; unchanged and busy form | `summary-mobile-ignores-local-off` is caught by real disabled/focus/reopen/reload assertions; prior checkbox value remains saved. |
| AC9 | Existing summary runtime units + source picker/live/lost-ACK smoke | Existing #493 guard mechanisms read as unchanged; their registered witnesses remain applicable. This task does not claim a fresh negative run of every unchanged backend/permission guard. |
| AC10 | Four locales, narrow geometry, actual targets, keyboard, camera identity; theme/large-text frames | Actual bounds/focus/value comparisons and frame inspection. |
| AC11 | Gates/docs above; code scope inspection | No new eager implementation except header call order; stored schema and backend untouched. |

Rollback is a revert and normal bundle rebuild. Nothing needs data migration.
Independent review and pipeline merge remain required before S8; publication
and issue closure belong to a later release request.
