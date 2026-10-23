# #1035 — author acceptance evidence

Accepted specification: issue body digest
`ba980dfe4a103d82284151f10c5c490ce0e95709d032ff961f45feab93a84386`,
SPEC r2 green (High 0 / Medium 0). Owner confirmed right-click selection and
retention after order commands, nearby selected copies, and shared image assets.

## Executed acceptance

| AC | Command and observed result | Ordinary refusal / defensive witness |
|---|---|---|
| AC1 | `node demo/smoke_decor_order.mjs` → PASS: actual panel rectangles for all six kinds; RU/EN, light/dark, paired actions above Delete, narrow menu/actions without horizontal overflow. Both screenshots visually inspected. | Extreme front action is aria-disabled; its ordinary activation leaves history and config epoch unchanged. |
| AC2 | Same smoke → PASS: red/blue raster probes change from blue to red and back through actual actions; right-click selects the visible object, not the previous selection. `node --test test/decor-order.test.mjs` → 4 PASS. | Missing ID, empty/single lists and extreme reorder return the original array; geometry and sibling identities stay unchanged. |
| AC3 | Same smoke → PASS: four menu items, retained selection/properties, Escape/outside dismissal, drawing-tool dismissal without a draft, stale detached buttons after revision/space/permission/mode/disconnect changes, no View menu. | Ordinary revoked callbacks leave the actual array/history/epoch unchanged. `decor-menu-accepts-stale-revision-1035` and `decor-right-button-arms-transform-1035` registered; **not executed**, caught status unknown until nightly. |
| AC4 | Same smoke + decor-order units → PASS: all six kinds, independent IDs/values, source unchanged, one history command, shared `asset_id`, unchanged catalog size, no asset mutation. Original image remains rendered after deleting the copy. | Unit inputs cover bounds/reversed shift, invalid pitch/ID, actual object limit, exhausted nearby positions and independent nested future fields. |
| AC5 | Same smoke → PASS: order/copy/delete Undo/Redo, invalid field refusal, saved document and a new card loaded through the actual server transport. Linux HA command below → **3 passed / 229 deselected**, full/space/plan-only export → serialized preview → apply preserves order and shared image references. | Invalid width does not reorder or add history; export/import uses ordinary missing-content confirmation. ZIP document wrapping/file code is unchanged and checked by reading, not claimed as a new ZIP end-to-end execution. |
| AC6 | `node --test test/pdf-scene.test.mjs` → 27 PASS (with the order suite: 31 total); `node --test test/decor-projections.test.mjs` → 1 PASS. The executed PDF renderer emits stored primitive order; the executed static renderer emits relative image order. `node demo/smoke_decor_layer_order.mjs` → PASS, including existing raster layer probes. | Existing View composition is unchanged. Golden remains the independent `ci:golden` demand on the pushed material; the final handoff records its CI result. |

Linux HA command, in an ext4 snapshot of the current backend and test:

```sh
/home/sergey/houseplan-1002-20261021/.venv-ci/bin/python -m pytest tests_backend/test_ha_import_export.py -q -k issue_1035
```

HA 2026.8.3 / pytest-homeassistant-custom-component 0.13.357. Windows and WSL
test bytes matched SHA-256
`cf4d10c4d434f3927c8db39ebe974cc243840084746d84b61eda465d32f52718`.
No backend product file changes in this task.

Other targeted commands, all PASS on pinned Chromium 151.0.7922.34 / Playwright
1.62.0: `node demo/smoke_decor.mjs`, `smoke_properties_panel.mjs`,
`smoke_decor_images.mjs`, `smoke_furniture.mjs`, `smoke_furniture_polish.mjs`,
`smoke_device_copy.mjs` (each prefixed with `node demo/`). Existing synthetic
erase input omits `button`; the production guard now refuses positive mouse
buttons, preserving that path and real primary/touch input.

The copy smoke also arms the actual furniture and image palettes before opening the
object menu. Opening retires the older palette's global dismissal through its
existing controller, so it cannot consume the menu button's click. Copy finishes
through the normal tool lifecycle; reopening the palette and pressing the canvas
without choosing a symbol does not stamp the old furniture.

`node scripts/model-invariants.mjs --config artifacts/decor-order/config.json`
→ PASS. The new smoke writes that synthetic, actually saved config for the
invariant command. Screenshots/logs live under ignored `artifacts/decor-order/`.

## Check scope and limits

The selector reports many incidental matches through shared host symbols such
as `_mode` and `_cfgRev`. The eight executed smokes cover the changed decor
commands, native gestures, shared Properties surface, asset presentation and
existing device-menu retirement. They do not claim execution of every matching
smoke or the full release matrix. The final handoff carries `gate:small`, exact
material and CI results; the first local tooling run exposed missing generated
inventory, hook declaration, toast identity and English guide parity, all fixed
before handoff.

Six risk classes: async and authority retirement (AC3), data/bounds/volume
(AC4 and the existing limit), geometry/paint (AC2/AC6), themes and responsive
layout (AC1), mouse/keyboard/HA inputs (AC3/AC5). No new touch gesture, hot-path
sort, persistent observer or data schema. One O(n) operation per user command.
Editor-only strings use the existing lazy tools namespace. The small editor
budget increase is recorded in the issue under the owner's standing permission;
bands, absolute budgets and rejection predicates remain active.

The first pushed Golden capture exposed internal clipping of Delete in the
secondary surface. The corrected grid stacks Properties, the paired order actions
and Delete. The narrow smoke now measures all four actual button rectangles
against both the visible panel and viewport, rather than only document scroll
width. `decor-order-pair-clips-delete-1035` registers that regression for nightly;
it was not executed as a mutant during development. Final Golden acceptance must
use the corrected capture, never the clipped initial frames.
The ordinary valid width edit followed by Bring to front also completes both
operations with the first click, while invalid input still refuses the command.
The overlap fixture has three rectangles sharing the raster probe point (red,
green, blue), as AC2 requires. After Send to back the same screen point both
paints blue and opens blue's actual menu; the other objects retain their order.

Initial corrected full Linux capture: [CI 39908393076](https://github.com/Matysh/houseplan-card/actions/runs/39908393076),
source `7514b35e8427c506e99339b76a1194e1ecfadb84`, matrix 80 / Chromium
151.0.7922.34. All four changed baseline/candidate pairs were visually inspected:
`tray-medium-selection-ru`, `furniture-transform-light`,
`decor-color-popover-mobile-ru`, `decor-color-popover-desktop-en`. Only the
secondary actions behind the unchanged colour dialogs differ in the latter two.
Properties, both order actions and Delete are visible in the selected-object
surfaces. Acceptance ran through `npm run golden:accept -- --reviewed` in WSL
Linux, with exactly these four explicit `--expect-change` IDs; 216 baseline
images were preserved, with 193 byte-identical environment witnesses (floor 10).
The initial clipped capture was never accepted. Final exact-SHA full Validate
is recorded separately in the issue handoff.

Final rebase includes merged #1042 and #1043 on dev `937dd3568c988d023e2a679e5f572021b3ce6dd2`.
The baseline conflict was resolved with the complete dev set, including both
new LED off-fill frames. The earlier four-frame acceptance above is historical;
the decor frames must be recaptured/accepted from the combined current source
through the same reviewed command before the final full Validate. No composite
index or copied candidate hashes were written by hand.

The first full Validate found an obsolete action-list comparison in
`smoke_ui_polish_963_reference`: the immutable #963 prototype predates the two
intentional #1035 actions. The comparator retains exact ordered state/text/paint
equality for every original action (the public old prototype has no data-action)
and permits exactly front/back by their new hook IDs only for decor.
Both new actions must match the immutable reference's enabled neutral action or
disabled control, reached through ordinary selection/mode input in both themes.
No reference CSS/source was patched. Unrelated stale appearance smokes from the
#1037 colour relocation are tracked separately in #1042.
`node demo/smoke_ui_polish_963_reference.mjs` on genuine pinned HA frontend
20260930.4 → PASS, including all older scenes, enabled/disabled new actions in
both themes, and Save text/geometry in RU/EN/DE/FR.

`node scripts/mutation-gate.mjs --check` is a static registry check only:
execution 0, caught unknown. No mutant or temporary implementation substitution
was executed during development.
