# Independent UI follow-ups on the shared current product

## Device controls: four passed, contacts retained RED

# Five addressed UI failures on current product

Product/build base: `0bda944e3244a142449c30c5f802c14833af8c66`. This source-only followup starts after `5c3b25859`; product and compiled outputs are unchanged. Root's existing `output/issue1226/resume-ui/` run supplies the baseline, which was not repeated. Only the four edited complete smoke scripts were run. Classification delta: `ui-five-classification-delta.json` — **4 PASS / 1 retained FAIL**. No live HA/full audit/product/golden changes were made.

## More Info: a real button covered by previous hover state

The original locator is already the actual `button#marker-more-info-entity`, not a wrapper. At 360px the measured button was x28–332 / y490.59375–600.59375, and the native hit at its centre was `hp-help[data-help-key="marker.more_info_help"]` because its top-layer explanatory popover was open. The screenshot shows the text surface covering the choice. Both preceding desktop layout phases succeeded. A viewport resize can move Help under the previous pointer; Playwright checks that a target receives events before moving its pointer into that target, so retrying `click()` alone never leaves that hover.

The port moves the real mouse to (0,0) and awaits the public Help trigger's expanded state becoming hidden before the next independent native picker interaction. It neither changes Help CSS/state nor uses forced clicks. The same leave operation is needed for the final narrow `choose(Auto)` interaction as well as the four layout screenshots. All original21 controls now pass, including manual exact HA target, own-only search, foreign/deleted refusal, Cancel/binding reset, Save, both widths/languages and no service calls.

Evidence in own `output/issue1226/ui-five/`: `more-info-diagnostic.log`, `more-info-360-en.png`, and complete final `more-info-port-r2.log`. The first edited run reached every layout but revealed the same hover carry-over at the later final choice; r2 centralizes native lifecycle handling. No product conclusion is inferred from a wrapper-selector assumption.

## Furniture: distinguish empty canvas from an object's context command

Accepted #1035 (`2ba92b86c`, `docs/USER-GUIDE.md`, “Single-object order and context menu”) explicitly makes right-click select the invoked object, show Properties and open its menu. The old script right-clicked the point where it had just stamped a sofa, then expected the placement palette to remain armed. Diagnostic actual state is `tool=select`, `palette=null`, menu open, selected original sofa — the accepted command, not a failed delayed stamp.

The primary-button witness now independently finds visibly empty canvas inside the real stage, verifies the native hit belongs to that stage and excludes all existing rendered decor bounding boxes. Right-click there still adds nothing and retains the armed symbol; the next deliberate left click stamps once. A separate original-object right-click verifies no new object, no history and **zero actual config/set calls**, native context selection, native Escape dismissal, then explicitly rearms for the original floor-switch case. All original press/up/pan threshold, returned-pan, cancel/capture/blur late-up and floor invariants remain. Complete final log: `furniture-port-r2.log`.

## #998: retain the actual furniture dialog and all choices

The extra sweep's SVG stroke point was selected before a second double-click press; that selection installs furniture transform hit geometry, so the second press no longer reliably belongs to the original path. The corrected entry uses a normal painted-object single click followed by the rendered `[data-action=decor-properties]` button. It does **not** replace the dialog with a weaker Properties-sidebar assertion or remove the furniture symbol field.

The full changed `smoke_dialog_picker_998.mjs` passes: **165 controls**, including furniture's original symbol select at1280/390, all disabled/value/alternate/restore/Escape/focus/bounds/radius checks, complete stored-config equality, SVG print choices, and the genuine pinned HA icon picker’s11 local browser checks. The two original privacy/network/page-error cleanup controls remain in force. Evidence: `dialog-picker-port.log`; this is the local authentic HA-wheel fixture, not an additional live HA run.

## #963: accepted intrinsic multirow header

Accepted #1184 (`4634fd74f`, `docs/UX-MODES.md`, shared-header contract) deliberately keeps direct actions in multiple rows at final narrow phase. The retired phone one-action-row/56px assertions contradict that later accepted contract. The wide1280/760 single-action-row oracle remains intact, as do every unrelated original tooltip, field, column, sidebar, language, inbox, reduced-motion and remount assertion.

At390/280 the replacements verify every direct action remains rendered, all actual buttons have44px targets inside the real header, unrelated target rectangles do not intersect, and the stage begins below the actual header and stays inside the card/viewport height with usable remaining area. The only permitted intersection is the exact one-pixel shared border between **adjacent**, same-height siblings inside `.hpf-nav-modes`/`.hpf-icon-group`, with measured `margin-inline-start:-1px`; this is the existing common UI Kit segment styling (`navigation.styles.ts:46`, `icon-action.styles.ts:26`). Larger or unrelated overlaps still fail. This explicit seam was measured by the first changed run; r2 passes the complete script. Evidence: `ui-polish-port-r2.log`, `artifacts/ui-polish-963/header-layouts.json`.

## Contacts: real Escape regression, no fixture weakening

`smoke_device_contacts.mjs` is unchanged and remains red. Root's existing baseline artifact `artifacts/866/native/result.json` shows the accepted contact position x=.28885/y=.3 with history1/write1; Undo and Redo bring writes to3 while preserving the contact. Escape during the subsequent detach drag instead persists x=.42916666666666664/y=.37916666666666665, history2/write4, and breaks the group. The first four failures are exact restore/no-write/no-history/contact, not a stale object reference.

The causal routing is visible in current source: `_onKey` calls `properties.escape(e)` at `houseplan-card.ts:3523` before the Devices drag cancellation at3607–3610. `editors/properties/editor.ts:385` excludes decor gestures but not `_deviceDrag`, so an active wide device selection consumes Escape by clearing Properties; native mouseup then commits the still-active drag. `_cancelDeviceDrag` at `houseplan-card.ts:6086` would otherwise retire capture and restore the original placement.

Later `group-restored` failures partly cascade from that first unexpected detached commit. The additional lost-capture write/history failures have not been silently reclassified as either harmless event timing or a second independently proven product defect. All10 original failures and cancellation/history guarantees remain visible; no separate new issue or product fix was created in this subtask.

---

## Editor layout: three passed, two retained RED

# Five addressed UI consumers on combined 0bda944e3

`ui-five-delta.json` updates only these five original failed smoke rows; the coordinator merges it into the complete 78-row inventory. Root's already-executed 26-case baseline was reused. This executor ran no new build, stable/HA audit, product patch or visual acceptance.

| Consumer | Addressed result | Preserved contract |
| --- | --- | --- |
| editor_tabs | full smoke PASS | Current room form's own Cancel/Discard closes its face-batch owner; a private boolean reset alone left that owner armed and legitimately blocked later navigation. Accepted #1207 UI-006 uses a 44px active segment and no empty View segment, replacing the historical 24px reservation. Exact full accessible mode labels, exact short visible labels, expanded edge hits/13px glyph, keyboard/context/undo and all other original assertions remain. |
| hide_layers | full smoke PASS | The untouched demo's selected divider has no authored thickness entry and resolves to0. A no-op0→0 does not create graph authority. The fixture now performs actual Thickness15→0, verifies a positive atom was stored and all divider IDs survive zero. Original zero paint in all four modes, border/decor/opening semantics, forms, quarter-hit beads and real background drag all pass. |
| led_strip_glow | full smoke PASS | Reload destroys the injected ordinary desktop-container style. Reapply the same ordinary embedding helper after reload; never reveal a hidden button with CSS. Full service ledger, trusted multi-contact/pinch input, static cards, colour/glow, transition deadlines, cold camera and lazy editor checks pass. |
| edit_walk | full smoke RED:11/12 walks pass | All original six raw legacy walks are retained; six current walks are additional. One known historical carrier atomizes into3 exact role pieces. Only that old carrier/prefix with identical metadata/cm and points inside its original line interval is ignored as existing debt. Other owners, moved points or changed properties remain new violations. Legacy debt1/current debt3 are explicit. Original first-floor legacy seed2 remains red. |
| floor_cache_reuse | original0bda RED retained, no duplicate run | The actual post-Undo native Resize session accepts no preview: union0/areas missing rather than union1/two areas. Geometry-safe refusal remains visible. No accepted no-op, private-camera change, weakened cache quota, discarded history or fixture demotion to legacy was introduced. |

## Edit-walk details and remaining finding

The complete candidate's `test-build` is prepared once by `process-next/catalog/prepare.mjs tests`; this smoke no longer recompiles it on every execution. Direct standalone use documents the same preparation command.

Adding model11 initialization alone made all six walks green, but changed the random legacy gesture trajectory. That result was rejected as insufficient. Final code retains the original legacy walks plus the new current ones. The final full run still reports the original exact first-floor sequence:

1. Resize room-b#0 by−3, preview stays at the last safe position.
2. Delete room-f, keep walls.
3. Resize room-b#0 by+1, preview stays at the last safe position.
4. Delete room-b, keep walls.

This introduces `partition_over_room_wall` on `ge-1750b98a8c3a7b4c` (6steps along room-d) and `ge-63da00563817c8bc` (50steps along room-a), plus `mixed_role_record` on `0.220833,0.645833@0.0000` at20cm. `KNOWN` remains empty; this is not an accepted debt. The full failing config is `artifacts/edit-walk-first-floor_seed2.json` in this checkout. The existing console path spelling differs; this is the actual saved filename.

The current typed Optimize `PlanGraphError` is handled alongside the already-supported `WallSegmentModelError`, as a refused transaction rather than a successful optimization. Every refusal explicitly checks that the input and live card's full config stay byte-identical. Untyped/unexpected exceptions still escape. This walk guards geometry safety, not the success rate of Optimize; target-conflict refusals are retained observations, not claimed repairs.

Independent read-only proof `output/issue1226/walk-debt-proof.{mjs,json}` shows the known second-floor raw carrier is exactly covered by its3 migrated pieces, with no gap/overlap and identical thickness. Neither the source fixture nor a geometry/passport baseline was changed.

## Evidence and execution boundaries

All logs are in this checkout's `output/issue1226/`; their SHA256 values are recorded in the delta JSON:

- `ui-editor-tabs-accepted-segment.log`: complete changed smoke PASS.
- `ui-hide-zero-fixture-port-r2.log`: complete changed smoke PASS. The preceding new positive-fixture assertion initially included unrelated zero atoms; it was narrowed to prove the selected positive atom, while requiring every original divider ID and final zero state.
- `ui-led-cold-host-port.log`: complete changed smoke PASS, including the original pinned-browser attestation.
- `ui-edit-walk-both-models.log`: complete changed smoke RED, exactly the original legacy first-floor seed2; additional current6 all PASS. The earlier current-only run was not accepted as equivalent legacy coverage.
- Root's `output/issue1226/resume-ui/smoke_floor_cache_reuse.log`: unchanged authoritative RED reused.
- `node --check` on all four edited smokes and `git diff --check`: PASS.

No new issue was created. Remaining product behavior is recorded here and stays red. Existing isolated keyboard-command fixtures in editor_tabs were retained; no new service/write suppression, forced click or private camera setter was added. No goldens or budgets changed.
