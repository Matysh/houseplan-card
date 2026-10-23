# #1003 implementation evidence

This is an execution record, not a second spec. The canonical spec and its
owner decisions remain in issue #1003. Product material is the commits through
29f45c464; the final test-only addition drives a physically tight group through
the real marker-size dialog. No production code or frozen reference is patched
by these tests. Logs and synthetic screenshots are in ignored artifacts/1003/.

## Commands and environment

- Node 22.23.3, pinned Chromium headless shell 151.0.7922.34/rev1234, Windows.
  Browser scripts run as `node demo/<script>.mjs`; the selection table below
  names each exact script. All marked PASS were executed and exited 0.
- `node --test test/device-contact-1003.test.mjs test/device-contact-write.test.mjs
  test/device-contact-card.test.mjs`: targeted new geometry/write/live-frame
  tests pass; dependent contact/history units pass as well.
- `ruff check custom_components/houseplan/contact_basis.py
  custom_components/houseplan/import_export.py
  custom_components/houseplan/websocket_api.py
  tests_backend/test_contact_basis.py tests_backend/test_ha_device_contacts.py`:
  PASS.
- WSL Ubuntu-24.04, actual HA environment Python 3.14.7:
  `/home/sergey/houseplan-card/.venv/bin/python -m pytest
  tests_backend/test_contact_basis.py tests_backend/test_ha_device_contacts.py
  tests_backend/test_ha_marker_copy.py -q`: **46 passed**.
  Runs against this mounted task checkout, not the unrelated WSL checkout.
- Same interpreter, `-m mypy --cache-dir /tmp/houseplan-1003-mypy` with the
  six configured packages const, projection, coordinate_canonicalization,
  frontend_asset_manifest, junction_limits and contact_basis: **success, 6 files**.
- `node scripts/model-invariants.mjs --config demo/fixtures/backup-archive-v1.json`:
  PASS. Calling it without the required config only prints usage, not evidence.
- `node scripts/mutation-gate.mjs --check`: static registry check PASS,
  1797 definitions / 476 browser guards at this material. **No mutants executed;
  caught status unknown.** Five registry warnings are not a caught verdict.
- The enabled pre-push ran `npm run gate:small` at e594c183c: **232 seconds,
  0 failures**, including product and tooling units. An earlier run caught an
  obsolete mutation anchor and a one-line root budget overrun; both were fixed
  at 29f45c464 without increasing a ceiling. Exact-SHA Linux CI and golden
  acceptance results belong in the canonical handoff comment.

## AC and negative witnesses

Each smoke name below expands to `node demo/<name>.mjs`. Unit commands use the
unchanged compiled test-build. Negative inputs are normal inputs to the real
implementation; they are not temporary source edits.

| AC | Executed evidence / observable oracle | Negative witness |
| --- | --- | --- |
| 1 | device-contact-1003 units; smoke_device_contact_corners: 18 native releases (0/±30°, 2 sizes/thicknesses, 3 approaches), saved exact coordinates and 2 finite faces. smoke_device_contact_walls exercises openings and masonry. | Unit short finite faces refuse a corner; existing opening/masonry collision negatives. |
| 2 | snap/contact units plus smoke_device_contacts, smoke_device_contact_walls and smoke_device_contact_zoom: exact release target, repeated join, native zoom, no stored slack. | Same two markers at old loose spacing are recognised only by explicit legacy policy; precise policy refuses them. Alt/magnets-off and repeated join are actual native gestures. |
| 3 | smoke_device_contacts, corners and composition: actual SVG stroke dash, virtual → mixed → physical → mixed → virtual. | Physical participant prevents dashed mixed outline; deleting the last physical participant restores dash. Registered contact-virtual-dash-lost-1003: not executed. |
| 4 | smoke_device_contact_designer: 36 comparisons against the unchanged frozen synthetic r3 renderer across 12 scenes and 3 sizes. Finite wall-owned reference portions are excluded intentionally; free boundary remains ≤1 CSS px, core centres checked separately. Golden review is separate. | L void stays empty; true unequal protrusion survives. Contact/contour units reject off-shell hits. No personal fixture is published. |
| 5 | smoke_device_contact_reflow: real canonical entity markers, 23.1 → 123.1 → negative → unavailable → short; DOM/core registration, stable authored data, no history/write, actual size Save/Cancel, cold remount. | Unit stale basis identity is ignored. Repeated growth/shrink returns to the identical reference; future/invalid metadata stays inert. |
| 6 | unit free/wall-anchor reflow plus corners/reflow/hit_capsules/drag_bounds; unchanged unrelated markers and binding checked in unit/HA fixtures. | Occupied neighbour/masonry fixtures reject intersecting solutions; changed non-anchor cannot move an unrelated component. |
| 7 | Unit impossible-width fallback plus smoke_device_contact_reflow tight masonry case: actual size 3 Save accepted, contact breaks, marker bounds outside masonry; size 1.2 restores the same points/contact. | Same unit obstacle forbids a fictitious join and proves deterministic repeat/shrink; browser asserts single-member component while too large. |
| 8 | Contour clipping units plus walls/corners/contacts smokes: open stroke path, dash, retained closed hit, native guide line without captions. | Finite segment, free end and L void cases distinguish omitted wall-owned ink from omitted free ink; Alt/cancellation preserves line lifecycle. |
| 9 | smoke_device_contact_reflow: DPR1/2/3, 390 px touch, native pinch .83, landscape/portrait, actual late FontFace; smoke_device_contact_zoom light/dark, View/editor, fractional zoom and registration/thickness. | Historical baseline witness recorded in issue; new late-font counter requires actual extra measurement. Registered contact-late-font-invalidation-lost-1003: not executed. |
| 10 | Native contact, hit_capsules, reflow mobile tap and live_drag use the actual mounted marker nodes, closed individual targets and production effective positions. | Empty L void is not a target; contact-effective-point-not-painted-1003 registered, not executed. Live drag proves the same captured DOM child survives HA width refresh. |
| 11 | 9 writer tests, HA pair tests, contacts cancellation/Undo/Redo and 6 pageshow/ACK order cases; guides lifecycle compares whole layout after cancellation. live_drag asserts 0 writes until release and one terminal write/history entry. | Stale cfg/layout revision, permission refusal, persistence failure and affected-member conflict change neither half. Lost ACK reconciles without replay. Native Escape/pointercancel/lost capture/window blur do not commit. Backend CAS and live-value mutants registered, not executed. |
| 12 | TS/Python metadata fixtures and browser explicit movement: named component only, no cold bulk rewrite, lossless unknown siblings, canonical identity equality. | Unsupported backend receives no pair extension; changed invalid v1 rejected, unchanged legacy/future blocks preserved. Huge integer (10**1000) and >64-diameter box rejected without overflow/unbounded indexing. |
| 13 | Real HA full/space JSON/ZIP transfer and space-copy tests; contact-maintenance units and optimize_context/cleanup, device_copy, area_relocation_safety smokes. | Only valid matching basis space IDs remap; stale/future blocks remain opaque. Deleted/moved wall hosts are not exemptions; other floors and unknown fields remain unchanged. |
| 14 | contacts, modes, isometric_live_touch, space_card/identity, led_strip_glow, editor_frame; full golden includes public consumers and 2.5D. | Flat/Iso mode switch keeps individual Iso markers; editor_frame requires exactly 2 resize edges/areas/leaders, not duplicated layers. Marker preview does not inherit global component state. |
| 15 | 200-marker unit counters and smoke_device_contact_work: no frame/zoom index rebuild or per-pointer measurement, bounded fallback/cache, incremental native 60-sample drag and decor-only reuse. | An unrelated HA source leaves measurements/index counters unchanged; same-metric changed text is actually painted. Hard core/bundle bands unchanged; measured cost documented in DEVELOPMENT.md. |

## Visual acceptance and limits

The frozen owner UI Lab r3 remains unchanged. No real HA writes, historical plan
migration, arbitrary virtual-value feature or 2.5D grouping is introduced.
A virtual marker has no own sensor reading: the live-value/reflow witness uses
real entity-bound markers, not an artificial virtual temperature source.
The older geometry/work fixtures with artificial virtual badges are geometry
stress data only, not a new product promise.

Native Windows golden is diagnostic, not an accepted baseline. Initial Linux
run 39931576025 exposed two duplicate resize-layer failures and three battery
pixel failures. The renderer now avoids a root rerender for contour-only paint;
the battery calibration fixture cold-remounts before measurement rather than
turning calibration into a live resize of an existing group. Pixel oracles and
their thresholds are unchanged. Run 39935339661 then reported 218 PASS / 2
intended contour differences / 0 errors. That older artifact is not accepted
for later product source. The final complete Linux artifact of run
[39939441946](https://github.com/Matysh/houseplan-card/actions/runs/39939441946)
captures e594c183c with fingerprint
51f4ec1df33b88827a9ab720772700ffaa07bed8141792eaf5c6b655ca5165ba:
218 passed, only device-contacts-designer-light/dark different, no errors.
Both actual images and the contour diff were inspected: dashed virtual shells,
free edges, real protrusions, L voids and wall hatching remain; only the intended
contour policy changes. Their PNG hashes match the previously inspected captures
(light 0c42f812913a2b8278ac15a4c829717713e36d6667d16006ded7b7c6480a9f86,
dark d7a5e244b622a247f95dbb4a2f8daa188818dd3df16474796925309ea9ec26c5).
Acceptance uses the complete artifact in Linux with exactly those two declared
changes, keeps the other 218 references and records 191 byte-identical witnesses
(floor 10). No witness bypass or foreign-platform override is used.

Headless touch/pinch/orientation and real computed SVG/DOM geometry do not prove
every mobile GPU's rasterisation. No owner GPU approval is required. Legacy
groups without a durable basis can capture the current face once, not recover
a historical size absent from the document. New/materialised bases survive cold
reload. Fallback search is deterministic and bounded, not an optimal global
packing solver. No claim that this change makes initial loading faster.

### Final integration with #1035

While the accepted-baseline CI ran, #1035 merged into dev a5be21b84. The ask
branch was rebased before S7. No product conflict required a code rewrite;
the inventory retains both tasks' IDs and its counts are regenerated from the
actual list (1800 total definitions / 479 browser guards). Focused anchor and
inventory tests pass. Cost is remeasured and recorded in DEVELOPMENT.md and
issue comment 6363231248; existing bands are unchanged. Accepted PNGs from both
tasks are retained: conflict resolution keeps the #1003 acceptance provenance
and the already accepted #1035 scenario hashes, not invented image hashes or a
claim that the older capture contained the newly merged product. The integrated
tree must pass its own complete Linux capture before S7.

The new decor_order and 13 critical contact/geometry/owner scripts are rerun
against a fresh integrated bundle; the earlier 39-script evidence is not
represented as a full post-rebase run of unrelated workflows. Final CI and
execution results are linked in the canonical handoff.
The post-rebase pre-push caught one further integration cost: root13219 lines
versus reference13166 +50 (3 lines over). Under the owner's standing permission
for small expensive-to-remove growth, its reference is explicitly13219 and
the50-line band is unchanged, with the reason recorded in DEVELOPMENT.md and
the issue. No product code is compressed or unrelated refactor introduced.

## smoke-select decision record

Command: `node scripts/smoke-select.mjs --base origin/dev --head HEAD --json`.
Base dev 7b00292ec; executable product range through 29f45c464.
The initial output selects 138 direct plus 7 registered scripts, union **145**,
out of 419 available. After rebasing on dev a5be21b84 (#1035), it selects 139
direct + 7 registered, union **146**, out of 420: the new decor_order is executed
as well. Every selected row has a decision below. Specific added witnesses
also run: smoke_device_contact_editor_frame (not selected by static reachability).
All logs named here use synthetic fixtures; this is not a claim of a full
419-script pre-release run. Shared private revision/loading names are broad
matches, not evidence that 145 feature workflows changed.

| Script | Matched symbols/files | Decision and reason |
| --- | --- | --- |
| smoke_active_chain_ink.mjs | NORM_W | Not run: shared key/normalised-unit symbol match; wall model, CAD tool and import paths of this scenario are unchanged. Finite masonry/corner/opening negatives, wall_key_roundtrip and golden matrix exercise the changed consumer. |
| smoke_align_guides.mjs | _deviceDrag, _livePos, _pos | Executed: PASS (command below; fixture call/DOM/geometry assertions, not a source-name oracle). |
| smoke_area_relocation_safety.mjs | _cfgRev, _layoutRev, _serverStorage, spaceId | Executed: PASS (command below; fixture call/DOM/geometry assertions, not a source-name oracle). |
| smoke_audit_1490.mjs | _cfgRev | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_backdrop_guard.mjs | spaceId | Not run: common space identity symbol only; no implementation change to this feature. Cross-space/CAS isolation covered by HA transfer tests, area_relocation_safety, config_authority and layout_sync. |
| smoke_backdrop.mjs | _cfgRev, _layoutRev | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_backup_archive.mjs | _loadOk | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_bg_color.mjs | Owner, _cfgRev | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_build_identity.mjs | _loadOk | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_cold_view_toggle.mjs | _cfgRev, _layoutRev | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_cold_view_vacuum.mjs | _cfgRev | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_config_authority.mjs | _cacheSnapshot, _cfgRev, _layoutRev, _loadOk, _sendConfigCandidate | Executed: PASS (command below; fixture call/DOM/geometry assertions, not a source-name oracle). |
| smoke_config_reload_race.mjs | _adoption, _cacheSnapshot, _cfgRev | Executed: PASS (command below; fixture call/DOM/geometry assertions, not a source-name oracle). |
| smoke_config_writer.mjs | _cfgRev | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_controls.mjs | DevItem | Not run: common device/render owner symbol. Its specific feature contract is unchanged; effective coordinates and hit ownership are exercised by contacts/reflow/live_drag/hit_capsules, ordinary gestures by modes and history, Flat/Iso consumers by space_card/isometric_live_touch plus full golden. |
| smoke_cover_no_plate.mjs | _pos | Not run: common device/render owner symbol. Its specific feature contract is unchanged; effective coordinates and hit ownership are exercised by contacts/reflow/live_drag/hit_capsules, ordinary gestures by modes and history, Flat/Iso consumers by space_card/isometric_live_touch plus full golden. |
| smoke_cover_not_primary.mjs | Owner | Not run: common device/render owner symbol. Its specific feature contract is unchanged; effective coordinates and hit ownership are exercised by contacts/reflow/live_drag/hit_capsules, ordinary gestures by modes and history, Flat/Iso consumers by space_card/isometric_live_touch plus full golden. |
| smoke_cover_plate_precedence.mjs | _pos | Not run: common device/render owner symbol. Its specific feature contract is unchanged; effective coordinates and hit ownership are exercised by contacts/reflow/live_drag/hit_capsules, ordinary gestures by modes and history, Flat/Iso consumers by space_card/isometric_live_touch plus full golden. |
| smoke_danger_confirm_branches.mjs | _loadOk | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_danger_confirmation.mjs | spaceId | Not run: common space identity symbol only; no implementation change to this feature. Cross-space/CAS isolation covered by HA transfer tests, area_relocation_safety, config_authority and layout_sync. |
| smoke_daycycle_layer_budget.mjs | _cfgRev | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_daycycle_raster.mjs | _cfgRev | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_decor_default_persist.mjs | _cfgRev | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_decor_layer_order.mjs | wallKey | Not run: shared key/normalised-unit symbol match; wall model, CAD tool and import paths of this scenario are unchanged. Finite masonry/corner/opening negatives, wall_key_roundtrip and golden matrix exercise the changed consumer. |
| smoke_decor_order.mjs | _loadOk | Executed after the #1035 rebase: actual overlapping-object hit order and new property-panel actions; PASS. |
| smoke_device_contact_composition.mjs | _deviceContacts | Executed: PASS (command below; fixture call/DOM/geometry assertions, not a source-name oracle). |
| smoke_device_contact_corners.mjs | _deviceContacts | Executed: PASS (command below; fixture call/DOM/geometry assertions, not a source-name oracle). |
| smoke_device_contact_designer.mjs | _deviceContacts | Executed: PASS (command below; fixture call/DOM/geometry assertions, not a source-name oracle). |
| smoke_device_contact_live_drag.mjs | _deviceContacts, _deviceDrag | Executed: PASS (command below; fixture call/DOM/geometry assertions, not a source-name oracle). |
| smoke_device_contact_reflow.mjs | _deviceContacts, _loadOk | Executed: PASS (command below; fixture call/DOM/geometry assertions, not a source-name oracle). |
| smoke_device_contact_walls.mjs | _deviceContacts, _deviceDrag | Executed: PASS (command below; fixture call/DOM/geometry assertions, not a source-name oracle). |
| smoke_device_contact_work.mjs | _deviceContacts | Executed: PASS (command below; fixture call/DOM/geometry assertions, not a source-name oracle). |
| smoke_device_contact_zoom.mjs | _deviceContacts | Executed: PASS (command below; fixture call/DOM/geometry assertions, not a source-name oracle). |
| smoke_device_contacts.mjs | _deviceContacts, _deviceDrag, _loadOk | Executed: PASS (command below; fixture call/DOM/geometry assertions, not a source-name oracle). |
| smoke_device_copy.mjs | _deviceDrag, _loadOk | Executed: PASS (command below; fixture call/DOM/geometry assertions, not a source-name oracle). |
| smoke_device_equal_spacing.mjs | _deviceDrag, _livePos, _loadOk, _pos | Executed: PASS (command below; fixture call/DOM/geometry assertions, not a source-name oracle). |
| smoke_device_hit_capsules.mjs | DevItem | Executed: PASS (command below; fixture call/DOM/geometry assertions, not a source-name oracle). |
| smoke_device_icon_design.mjs | Owner | Not run: common device/render owner symbol. Its specific feature contract is unchanged; effective coordinates and hit ownership are exercised by contacts/reflow/live_drag/hit_capsules, ordinary gestures by modes and history, Flat/Iso consumers by space_card/isometric_live_touch plus full golden. |
| smoke_device_inbox_batch.mjs | _cfgRev, _layoutRev | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_device_inbox.mjs | _cfgRev, _layoutRev | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_device_position_history.mjs | _cfgRev, _deviceDrag, _layoutRev, _persistDevicePlacement, _pos, _sentPos, _serverStorage, spaceId | Executed: PASS (command below; fixture call/DOM/geometry assertions, not a source-name oracle). |
| smoke_device_signal_topology.mjs | _loadOk | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_dialog_footer_width.mjs | _serverStorage | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_dialog_segments_i18n.mjs | toolsT | Executed: PASS (command below; fixture call/DOM/geometry assertions, not a source-name oracle). |
| smoke_dialog_zombie.mjs | _cfgRev | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_discovery_filters.mjs | _cfgRev | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_drag_bounds.mjs | NORM_W, _deviceDrag, _pos, spaceId | Executed: PASS (command below; fixture call/DOM/geometry assertions, not a source-name oracle). |
| smoke_e2e_hooks.mjs | spaceId | Not run: common space identity symbol only; no implementation change to this feature. Cross-space/CAS isolation covered by HA transfer tests, area_relocation_safety, config_authority and layout_sync. |
| smoke_e2e_primitive_fields.mjs | src/device-contact-render.ts | Executed: PASS (command below; fixture call/DOM/geometry assertions, not a source-name oracle). |
| smoke_edge_cases.mjs | _pos | Not run: common device/render owner symbol. Its specific feature contract is unchanged; effective coordinates and hit ownership are exercised by contacts/reflow/live_drag/hit_capsules, ordinary gestures by modes and history, Flat/Iso consumers by space_card/isometric_live_touch plus full golden. |
| smoke_editor_guides_lifecycle.mjs | _deviceContacts, _deviceDrag, _pos, _renderDevices, canonicalizePosition | Executed: PASS (command below; fixture call/DOM/geometry assertions, not a source-name oracle). |
| smoke_empty_backup_import.mjs | _cfgRev, _loadOk | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_fixed_floor.mjs | _loadOk | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_fixture_contract.mjs | _loadOk | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_floor_cache_reuse.mjs | _cfgRev, _loadOk, spaceId | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_floor_geometry_cache.mjs | _cfgRev, _loadOk, spaceId | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_glow_blending.mjs | _loadOk | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_glow_fail_dark.mjs | spaceId | Not run: common space identity symbol only; no implementation change to this feature. Cross-space/CAS isolation covered by HA transfer tests, area_relocation_safety, config_authority and layout_sync. |
| smoke_glow_geometry_resilience.mjs | spaceId | Not run: common space identity symbol only; no implementation change to this feature. Cross-space/CAS isolation covered by HA transfer tests, area_relocation_safety, config_authority and layout_sync. |
| smoke_glow.mjs | _pos, spaceId, wallKey | Executed: PASS (command below; fixture call/DOM/geometry assertions, not a source-name oracle). |
| smoke_grid_snap.mjs | NORM_W, _pos | Not run: shared key/normalised-unit symbol match; wall model, CAD tool and import paths of this scenario are unchanged. Finite masonry/corner/opening negatives, wall_key_roundtrip and golden matrix exercise the changed consumer. |
| smoke_hidden_device_toggle.mjs | _renderDevices | Not run: common device/render owner symbol. Its specific feature contract is unchanged; effective coordinates and hit ownership are exercised by contacts/reflow/live_drag/hit_capsules, ordinary gestures by modes and history, Flat/Iso consumers by space_card/isometric_live_touch plus full golden. |
| smoke_houseplan_panel.mjs | _loadOk | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_infinite_canvas.mjs | NORM_W | Not run: shared key/normalised-unit symbol match; wall model, CAD tool and import paths of this scenario are unchanged. Finite masonry/corner/opening negatives, wall_key_roundtrip and golden matrix exercise the changed consumer. |
| smoke_info_card_context.mjs | _cfgRev, _layoutRev, _loadOk | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_iso_flat_parity.mjs | _loadOk | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_isometric_live_touch.mjs | _cfgRev, _loadOk | Executed: PASS (command below; fixture call/DOM/geometry assertions, not a source-name oracle). |
| smoke_junction_holes.mjs | NORM_W | Not run: shared key/normalised-unit symbol match; wall model, CAD tool and import paths of this scenario are unchanged. Finite masonry/corner/opening negatives, wall_key_roundtrip and golden matrix exercise the changed consumer. |
| smoke_junction_limits.mjs | NORM_W | Not run: shared key/normalised-unit symbol match; wall model, CAD tool and import paths of this scenario are unchanged. Finite masonry/corner/opening negatives, wall_key_roundtrip and golden matrix exercise the changed consumer. |
| smoke_kiosk_viewport_recovery.mjs | _loadOk | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_lattice_write_barrier.mjs | _cfgRev, _serverStorage | Executed: PASS (command below; fixture call/DOM/geometry assertions, not a source-name oracle). |
| smoke_layout_fixture_barrier.mjs | _sentPos | Not run: no independent changed contract in this scenario; named shared owner is covered by the selected contact, configuration and mode witnesses. Full smoke fleet remains a pre-release gate, not claimed here. |
| smoke_layout_sync.mjs | _layoutRev, _sentPos, _serverStorage | Executed: PASS (command below; fixture call/DOM/geometry assertions, not a source-name oracle). |
| smoke_lazy_admin_locale.mjs | toolsT | Executed: PASS (command below; fixture call/DOM/geometry assertions, not a source-name oracle). |
| smoke_led_strip_glow.mjs | _loadOk, renderSpaceStatic | Executed: PASS (command below; fixture call/DOM/geometry assertions, not a source-name oracle). |
| smoke_light_badges.mjs | _pos | Not run: common device/render owner symbol. Its specific feature contract is unchanged; effective coordinates and hit ownership are exercised by contacts/reflow/live_drag/hit_capsules, ordinary gestures by modes and history, Flat/Iso consumers by space_card/isometric_live_touch plus full golden. |
| smoke_linked_virtual_light.mjs | _cfgRev, _deviceDrag, _layoutRev, spaceId | Executed: PASS (command below; fixture call/DOM/geometry assertions, not a source-name oracle). |
| smoke_merge_split.mjs | wallKey | Not run: shared key/normalised-unit symbol match; wall model, CAD tool and import paths of this scenario are unchanged. Finite masonry/corner/opening negatives, wall_key_roundtrip and golden matrix exercise the changed consumer. |
| smoke_modes.mjs | _deviceDrag, _pos | Executed: PASS (command below; fixture call/DOM/geometry assertions, not a source-name oracle). |
| smoke_node_history_context.mjs | _cfgRev | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_open_passage.mjs | wallKey | Not run: shared key/normalised-unit symbol match; wall model, CAD tool and import paths of this scenario are unchanged. Finite masonry/corner/opening negatives, wall_key_roundtrip and golden matrix exercise the changed consumer. |
| smoke_opening_preview.mjs | wallKey | Not run: shared key/normalised-unit symbol match; wall model, CAD tool and import paths of this scenario are unchanged. Finite masonry/corner/opening negatives, wall_key_roundtrip and golden matrix exercise the changed consumer. |
| smoke_opening_tunnel_fill.mjs | wallKey | Not run: shared key/normalised-unit symbol match; wall model, CAD tool and import paths of this scenario are unchanged. Finite masonry/corner/opening negatives, wall_key_roundtrip and golden matrix exercise the changed consumer. |
| smoke_optimize_cleanup.mjs | _cfgRev, _layoutRev, _pos | Executed: PASS (command below; fixture call/DOM/geometry assertions, not a source-name oracle). |
| smoke_optimize_context.mjs | _cfgRev, _layoutRev, _loadOk | Executed: PASS (command below; fixture call/DOM/geometry assertions, not a source-name oracle). |
| smoke_optimize_coordinate_canonicalization.mjs | _loadOk | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_optimize_geometry_preflight.mjs | _cfgRev, _layoutRev | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_optimize_micro_interval.mjs | wallKey | Not run: shared key/normalised-unit symbol match; wall model, CAD tool and import paths of this scenario are unchanged. Finite masonry/corner/opening negatives, wall_key_roundtrip and golden matrix exercise the changed consumer. |
| smoke_orphan_space_references.mjs | _cfgRev, _layoutRev, _serverStorage, spaceId | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_pageshow_layout_ack.mjs | LayoutWriteReload | Executed: PASS (command below; fixture call/DOM/geometry assertions, not a source-name oracle). |
| smoke_pan_any_zoom.mjs | _deviceDrag | Not run: common device/render owner symbol. Its specific feature contract is unchanged; effective coordinates and hit ownership are exercised by contacts/reflow/live_drag/hit_capsules, ordinary gestures by modes and history, Flat/Iso consumers by space_card/isometric_live_touch plus full golden. |
| smoke_plan_device_landmarks.mjs | _deviceDrag | Not run: common device/render owner symbol. Its specific feature contract is unchanged; effective coordinates and hit ownership are exercised by contacts/reflow/live_drag/hit_capsules, ordinary gestures by modes and history, Flat/Iso consumers by space_card/isometric_live_touch plus full golden. |
| smoke_plan_upload_race.mjs | spaceId | Not run: common space identity symbol only; no implementation change to this feature. Cross-space/CAS isolation covered by HA transfer tests, area_relocation_safety, config_authority and layout_sync. |
| smoke_plan_upload_reject.mjs | spaceId | Not run: common space identity symbol only; no implementation change to this feature. Cross-space/CAS isolation covered by HA transfer tests, area_relocation_safety, config_authority and layout_sync. |
| smoke_portable_recovery.mjs | _loadOk | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_post_write_adoption.mjs | _adoption, _cfgRev, _layoutRev, spaceId | Executed: PASS (command below; fixture call/DOM/geometry assertions, not a source-name oracle). |
| smoke_preflight_diagnostics.mjs | spaceId | Not run: common space identity symbol only; no implementation change to this feature. Cross-space/CAS isolation covered by HA transfer tests, area_relocation_safety, config_authority and layout_sync. |
| smoke_properties_panel.mjs | _loadOk | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_readonly_cold_start.mjs | _loadOk | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_render_parity.mjs | Owner | Not run: common device/render owner symbol. Its specific feature contract is unchanged; effective coordinates and hit ownership are exercised by contacts/reflow/live_drag/hit_capsules, ordinary gestures by modes and history, Flat/Iso consumers by space_card/isometric_live_touch plus full golden. |
| smoke_room_co2.mjs | _deviceDrag | Not run: common device/render owner symbol. Its specific feature contract is unchanged; effective coordinates and hit ownership are exercised by contacts/reflow/live_drag/hit_capsules, ordinary gestures by modes and history, Flat/Iso consumers by space_card/isometric_live_touch plus full golden. |
| smoke_room_device_discovery.mjs | _cfgRev, _loadOk | Executed: PASS (command below; fixture call/DOM/geometry assertions, not a source-name oracle). |
| smoke_room_fit.mjs | spaceId | Not run: common space identity symbol only; no implementation change to this feature. Cross-space/CAS isolation covered by HA transfer tests, area_relocation_safety, config_authority and layout_sync. |
| smoke_room_opening_host.mjs | _cfgRev | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_room_tooltip_toggle.mjs | _cfgRev | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_save_race.mjs | _cfgRev | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_signal_visibility_device_policy.mjs | _loadOk | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_space_battery_policy.mjs | src/space-card.ts | Executed: PASS (command below; fixture call/DOM/geometry assertions, not a source-name oracle). |
| smoke_space_card_identity.mjs | renderSpaceStatic | Executed: PASS (command below; fixture call/DOM/geometry assertions, not a source-name oracle). |
| smoke_space_card.mjs | spaceId | Executed: PASS (command below; fixture call/DOM/geometry assertions, not a source-name oracle). |
| smoke_space_create_display_defaults.mjs | _cfgRev | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_space_delete_with_devices.mjs | _adoption, _cfgRev, _layoutRev, spaceId | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_space_switch_transitions.mjs | _renderDevices | Not run: common device/render owner symbol. Its specific feature contract is unchanged; effective coordinates and hit ownership are exercised by contacts/reflow/live_drag/hit_capsules, ordinary gestures by modes and history, Flat/Iso consumers by space_card/isometric_live_touch plus full golden. |
| smoke_split_corner_wall.mjs | wallKey | Not run: shared key/normalised-unit symbol match; wall model, CAD tool and import paths of this scenario are unchanged. Finite masonry/corner/opening negatives, wall_key_roundtrip and golden matrix exercise the changed consumer. |
| smoke_static_icon.mjs | _devicePresentation | Not run: common device/render owner symbol. Its specific feature contract is unchanged; effective coordinates and hit ownership are exercised by contacts/reflow/live_drag/hit_capsules, ordinary gestures by modes and history, Flat/Iso consumers by space_card/isometric_live_touch plus full golden. |
| smoke_summary_dialog_scroll.mjs | _sendConfigCandidate | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_summary_first_paint.mjs | _sendConfigCandidate | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_summary_panel_polish.mjs | _cfgRev, _sendConfigCandidate | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_summary_panel.mjs | _adoption, _cfgRev, _layoutRev, _loadOk | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_summary_warm_attach.mjs | _loadOk | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_sun_soft.mjs | Owner | Not run: common device/render owner symbol. Its specific feature contract is unchanged; effective coordinates and hit ownership are exercised by contacts/reflow/live_drag/hit_capsules, ordinary gestures by modes and history, Flat/Iso consumers by space_card/isometric_live_touch plus full golden. |
| smoke_sun.mjs | _cfgRev | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_support_diagnostics.mjs | _loadOk | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_test_facade.mjs | _cfgRev, _layoutRev | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_v8_draft_write.mjs | _cfgRev | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_vacuum_dock_restart.mjs | _loadOk | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_version_recovery.mjs | _cfgRev, _layoutRev, _loadOk, _serverStorage | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_view_edit_permissions.mjs | _loadOk | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_view_entry_recovery.mjs | _layoutRev | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_view_runtime_dirty_reload.mjs | _loadOk | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_view_runtime_kiosk_recovery.mjs | _loadOk | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_view_runtime_recovery.mjs | _cfgRev, _loadOk | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_virtual_light_toggle.mjs | _cfgRev, _layoutRev | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_wall_face_lineage.mjs | _cfgRev | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_wall_face_room_split.mjs | _cfgRev | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_wall_key_roundtrip.mjs | wallKey | Executed: PASS (command below; fixture call/DOM/geometry assertions, not a source-name oracle). |
| smoke_wall_node_move.mjs | _cfgRev | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_wall_node_topology.mjs | _cfgRev, _loadOk | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_wallthick_standalone.mjs | NORM_W | Not run: shared key/normalised-unit symbol match; wall model, CAD tool and import paths of this scenario are unchanged. Finite masonry/corner/opening negatives, wall_key_roundtrip and golden matrix exercise the changed consumer. |
| smoke_warm_dialogs.mjs | _loadOk | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_warm_mode_adoption.mjs | _loadOk | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_wireless_controller_parity.mjs | _devicePresentation | Not run: common device/render owner symbol. Its specific feature contract is unchanged; effective coordinates and hit ownership are exercised by contacts/reflow/live_drag/hit_capsules, ordinary gestures by modes and history, Flat/Iso consumers by space_card/isometric_live_touch plus full golden. |
| smoke_ws_resilience.mjs | _loadOk, _serverStorage | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_zero_divider_taper.mjs | wallKey | Not run: shared key/normalised-unit symbol match; wall model, CAD tool and import paths of this scenario are unchanged. Finite masonry/corner/opening negatives, wall_key_roundtrip and golden matrix exercise the changed consumer. |
| smoke_zigbee_incomplete_reasons.mjs | _loadOk | Not run: common config/revision/loading owner match, not a changed workflow here. Pair/CAS/ACL exercised by contact writer units, HA harness and config_authority/post_write_adoption/pageshow/layout_sync smokes; this separate feature flow is unchanged. |
| smoke_zigbee_topology_hover.mjs | Owner | Not run: common device/render owner symbol. Its specific feature contract is unchanged; effective coordinates and hit ownership are exercised by contacts/reflow/live_drag/hit_capsules, ordinary gestures by modes and history, Flat/Iso consumers by space_card/isometric_live_touch plus full golden. |
