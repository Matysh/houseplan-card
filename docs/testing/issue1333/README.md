# #1333–#1335 — empty View, room area hint, dead Draw cleanup

Common branch: codex/1333-1335-empty-view-and-cleanup; base dev f1c9cd372946db8aa3b86c3e4224903ff6d4ad78. Primary queue entry #1333; all three use ship (unambiguous small results, direct proof and data-free rollback). No individual S4/S7 is claimed.

## Behavior

- #1333: authoritative loaded View only; exact selected-space lookup. Saved geometry, backdrop, decor, stairs, LED strips and unfiltered assigned devices/markers count, including hidden objects. Removed marker tombstones and camera bounds do not. Loading/boot/recovery/editor states do not show the prompt. Text is available to readers; the existing Plan entry is offered only to permitted writers outside kiosk. A retained button rechecks current space and permission. No new permission or backend writer.
- #1334: shared field hint below area select, in all four locales. Existing free-area list and the edited room's current selection stay unchanged.
- #1335: delete the unused segment transaction, its exclusive append-shape predicate and obsolete interface members. Preserve live finish, its physical/junction guards, shared projection/seed and current graph append. The process-v1 archive remains unchanged; living source assertions now refer to the actual append/finish owners.

## Targeted evidence

Native browser smoke: demo/smoke_view_empty_space_boundary.mjs. Real cold View and editor import, touch CTA >=44px at390px, exact Russian copy, centered state, current-space Plan transition, removal in editors, read-only/kiosk, retained-button denial after permission retirement, hidden content, last-content removal and populated-space navigation. Synthetic HA responses via the existing harness; not installed-HA proof.

Room native smoke demo/smoke_room_settings_form.mjs: PASS including persistent helper below the field, existing current area, room save guards and layouts at all existing widths. Screenshot empty-space-mobile.png is synthetic, inspected after correcting contrast with the shared empty-state overlay surface and sizing the harness host to its mobile viewport. No golden was replaced or accepted.

New boundary unit test and native smoke are classified task-release/navigation (+presentation for browser), importance boundary. Existing room form is regression/geometry+presentation and explicitly supplemented as a direct UI witness. Confirmed in catalog and task plan; the unclassified root card still causes the conservative full quick Node fallback.

## Tree shaking and budget

Before: initial View408251B gzip, panel410147B, editor chunk986583B raw/280421B gzip. Removal-only build: initial View408261B, panel410158B, editor chunk986583B raw/280426B gzip. The dead export was already tree-shaken; its removal changes source/hash names, not rendered editor length. UI candidate: View408777B, panel410674B, lazy-editor graph408245B gzip. Do not claim byte-identical compressed output or attribute the prior line growth to this task.

The old rolling ceilings already failed the dev baseline. Owner explicitly allows increases instead of byte chasing. Recenter initial View and lazy-editor reference ceilings to409000B, retaining2000B bands and the425920B absolute View resource wall. Addressed bundle budget PASS after recalibration. This is accounting, no speed improvement claim.

## Real HA E2E task impact

Required before the next beta for #1333/#1334: new empty space, server readback/live updates, space switch, hidden devices/objects, real writer/nonwriter/kiosk, Plan entry and no loading/error prompt; room area hint in create/edit with existing binding retained and save/reload. Companion handoff task-impact/1333-1335.md contains the same scope. #1335 adds no separate HA behavior; retain existing Draw/finish/history journeys. No beta or stable audit is claimed here. Shared queue S6/merge evidence is published in the issue on completion.

## S6 correction

Initial S6 20261106T143027800-ed02e7b2 completed with one failed unit: mutation-gate.test.mjs, 70/71 passing, because two active mutation definitions anchored the deleted segment function. Retire wall-draw-rejection-rollback-skipped and wall-draw-wall-artifact-discarded together with their sole dead target. Their old native guard files remain in the catalog; no production source or assertion was restored just to satisfy obsolete mutation anchors. Archived process-v1 registry remains unchanged. This is retirement of unreachable mutants, not proof of catching live mutants or a full mutation shard.

The addressed bundle-assets.test.mjs contract passed49/49 after the owner-authorized ceiling changes; it supplements the S6 plan because the catalog explicitly reports no inferred budget-mechanism reader. Subsequent finish uses the full current branch diff and that direct reader in areaTests.
