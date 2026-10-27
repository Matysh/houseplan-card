# #1093: selective invalidation — implementation evidence

Baseline: `455535be9da51e0eef11ceccd1b9545a39875425`; current integration base: frozen #1089 `5228e2ff1fbe51ea55f324b056d9f3806246e041`, containing accepted #998/#1000/#1107. Synthetic fixtures only. The final timing matrix runs on this joint source; S7 still requires actual #1089 acceptance and an identical product/input fingerprint.
This report records measured results separately from remaining acceptance work.
Accepted backend #1096 was subsequently merged from dev
`bffa1b7cd2c9c3499c35b0288bbdeeda6091748e`; recomputed frontend fingerprint
remained exactly `21302ea54db5854db5bd85e47371a306cb02157c4d339abb37ae3d21c41b815a`.
The combined compatibility inventory has 635 exact classified matches. Two old
mutation anchors were relocated to the same full-schema canonicalization and
config/set marker-ID checks after the backend refactor; their guards and failure
semantics are unchanged, and no mutants were executed.

## Measured diagnosis

The original pinned Chromium run exercised 200 available markers, 120 painted
on floor A, 35 real contact members with two fitted face types, three v10 floors,
214 registry devices, 2890 entities and 1685 state rows (1673 synthetic + demo).
Forty trusted native saves (20 at each declared 0/320 ms transport delay) were
RED. Post-ACK p95 was 245.2/239.6 ms; client p95 324.9/305.2 ms. Every ordinary
paint save rebuilt unchanged floor/contact geometry. Raw artifacts:
`artifacts/1093/baseline-visible-bg.json` and `.log`.

The first candidate reduced pre-request p95 to 22/21.8 ms and removed repeated
floor/contact builds, but post-ACK p95 remained 242/223 ms: still RED, not accepted.
Source inspection found the exact retained paint: `HpDialog.beginExit()` runs
a 180 ms visible fade after accepted close. The oracle correctly waited for the
actual dialog DOM to leave. No elapsed animation or observed WS wait is subtracted.
Only the declared fixture delay is subtracted from total client latency.

Successful current-owner ACK now retires space/room/general dialog paint directly
through the existing `dialogPresence(..., false)` boundary. Pending, refusal,
Escape, cancel and replaced-owner paths do not acquire that exit cause. The
next form has a new session and the ordinary animation. The first corrected 40-save candidate was GREEN: pre-request p95 23.6/21.6 ms, post-ACK 46.5/38.2 ms, client 66.2/59.8 ms, maximum 71.2/60.1 ms (0/320 ms fixture delays), unchanged floor/contact counters. This is diagnostic pre-merge evidence, not the final joint-source acceptance run. Raw: `artifacts/1093/candidate-visible-bg-ack.json`.

## Dependencies and consumer audit

| Input / consumer | Old excess or existing guard | Implementation / witness |
|---|---|---|
| Space/room paint, title, known label/solar settings → floor physics | Complete settings/name record cooled physical caches | Consumer-only known-field projection; wire/history projection unchanged; unknown values remain significant; actual-function positive structural corpus |
| Canonical ACK → physical key | Empty legacy arrays and materialized draw defaults changed a physically equivalent record | Normalize only empty legacy walls/partitions, null absent plan URL/aspect and default dashed zero walls; nondefault and unknown fields still invalidate |
| Hidden floor config → scaled model | `_buildModel` scaled all floor polygons | `DemandSpaceModels` lazy metadata shells, per-instance eight-floor LRU; native three B revisions cause zero A/B builds before B show; actual latest B coordinates then displayed |
| Forced registry rebuild after paint ACK | Empty registry signature caused complete `buildDevices` | Stable roster inputs plus observed HA metadata dependencies; numeric states remain presentation inputs; YAML state existence and metadata changes fail open |
| One marker metadata change → device faces | Global roster identity/content reset every face | Per-device content dependencies; differential oracle: two projections of changed marker, retained unrelated faces and immutable old roster |
| Paint epoch/clone → live snapshot | Root config/model/epoch identity reset snapshot | Actual projection inputs; identical clone and known paint changes preserve dependent facts; room/summary/explicit-source positive controls |
| Off-floor unused states → projected render dependencies | All device faces and positions captured | Active floor faces plus transitive hidden controller/target dependency closure; positive hidden source retained |
| Hidden document / departed route → intake | `intakeHass` still built roster/light/activity after render suppressed | Cheap authority/registry/transport intake continues; derived work deferred; show replays one latest coherent update; route departure retires View boundaries |
| Hidden summary/block → metrics chunks | Pending imports/chunks outlived demand | Effective visible value demand checked before work, each next chunk and publication; hidden work abandoned, show computes current state |
| Late View import → stale connected card | Connection/user context alone did not fence departed route | Explicit active lifecycle generation, document visibility and consumer demand; leave/return retires/restarts boundary |
| Failed config → later paired command | Native refusal witness found historical rejected `_writeChain` poisons Copy before queue phase | Captured pending count separates current failure from settled historical refusal; 44 focused units and native historical Copy/Undo/Redo/Delete, Properties, pending-refusal zero-WS and fresh intent PASS |

## Current correctness evidence

The actual incremental snapshot resolver is compared with a complete fresh
capture across numeric/attribute streams, cloned and edited-in-place records,
effective battery overrides and per-marker confirmed-alert issues. Physical key
and floor-cache tests retain structural/model/current/preview positive controls.

Native `demo/smoke_selective_invalidation.mjs` checks visible/inactive paint
persisted readback, held ACK with one request and a still-open disabled form,
refusal with retained draft, equivalent external clone, three hidden structural
revisions and the latest first shown geometry. Historical refused config writes
no longer poison independent Copy/Undo/Redo/Delete or Properties saves; an
in-flight refusal still blocks the queued paired command. The old optimistic
Properties group-preview rollback boundary remains unchanged.

Nine live HA witnesses cover related numeric/attribute changes, truly unrelated
entities, a conservative same-row attribute refresh, inactive-floor latest data,
hidden-document coalescing, genuine hidden relay control of a visible lamp,
registry disable/re-enable and read-only authority retirement. Five fresh native
Save authority scenes cover Space close/reopen, Room connection/user replacement,
and General route retirement with refusal or accepted-but-lost response. All
passed on the first joint #1000 source before the final consumer-demand addition.

Confirmed alert observation continues while the document or floor is hidden;
visual timers and publication stop, and reveal consumes the already elapsed
three-second activation/recovery without restarting it. Native strict counter
comparison passes. An initial one-increment RED came from sampling before the
190ms foreground floor-slide callback retired: passive requestUpdate stack and
absence of the alert entity from current dependencies identify that independent
navigation work. The witness now waits for the actual slide state to retire
before taking its baseline; the zero-work assertion is unchanged. Neutral
value_static_icon correctly suppresses alerts, so the test explicitly uses the
supported dynamic value mode. Diagnostic attempts are retained.

Room/decor capture follows actual consumer predicates, including current space
and room drafts. Hidden local-room markers still contribute to demanded climate
aggregates; a pure actual-capture/roomClimateMap witness observes 25→29, retirement
removes the row, and tooltip reveal sees29. Hidden decor has no text fact/state
until its layer or Decor editor is shown. Four dedicated units and the existing
incremental suite pass. The native helper observes the same hidden local-room
sensor in an actual room label and reveals the latest hidden decor with the
native Decor tab; both pass without hidden face or floor builds.

The held summary-owner callback/import tests reproduced two stale-latch failures:
a disconnect/reconnect could leave the new visible aggregate pending until an
unrelated HA tick. Lifecycle retirement now releases those latches, and old
callbacks check generation before clearing any current owner's latch. Both
negative witnesses fail on the old code; the full 14-test summary runtime suite
and native summary panel pass on the rebuilt source.

The accepted #998 picker migration also exposed a stale summary smoke target:
ten hidden native selects measured 1x1, while their actual shared buttons
measured 329x44. The unchanged accepted #998 baseline failed the same two checks.
The witness now measures the real button only for that shared-picker wrapper;
the 44px and viewport assertions remain unchanged. The baseline RED and passive
size diagnostic are retained in `artifacts/1093/accepted998-summary-baseline.log`
and `summary-target-diagnostic.log`.

## Timing evidence and CI binding

The first pre-merge B matrix was GREEN: 160 native actions,20 of each
Copy/Undo/Redo/Delete at both0/320ms fixed delays. Client p95 was108/108.6,
87.7/87,90.2/80.1 and138.8/134.7ms respectively; maximum173.2ms,
long-task maximum164ms, physical floor counters unchanged. These numbers are
preserved diagnostic evidence, not the final accepted joint-source run.
Raw: `artifacts/1093/candidate-history-large.json`.

`demo/benchmark_selective_invalidation.mjs` is the shared assertion-bearing gate.
Four bounded core wrappers run visible/inactive saves and history0/history320
through existing browser_selected CI. Frontend/build-input and exact fixture/
gate changes require all four; omission of one proof or a failed core blocks S7.
The full performance_smoke recipe runs the small/large six-save profiles,
structural actions, independent cold saves and DPR2 siblings before beta.
Raw core JSON is inside the existing uploaded artifacts/browser-selected/1093
root. Full output belongs to artifacts/performance-smoke. Fixed network fixture
delay alone is subtracted; visible DOM retirement, long tasks and real geometry
remain part of the measurement. Browser and Node pins are unchanged.

## Full joint-source timing result

**PASS: 846 samples, failures=[], correctnessProbe=false, exit0.** Exact product
fingerprint `21302ea54db5854db5bd85e47371a306cb02157c4d339abb37ae3d21c41b815a`;
frozen #1089 base `5228e2ff1fbe51ea55f324b056d9f3806246e041`. The run used an
exclusive quiet window on CPU4–7, the unchanged pinned Node/Chromium, viewport
and synthetic fixture. S7 additionally requires this product to be in accepted
dev, or fresh evidence if independent #1089 review changes its inputs.

[Full raw report](1093-evidence/final-joint-timing.json),
[baseline RED](1093-evidence/baseline-visible-bg.json),
[first corrected matched-input A run](1093-evidence/candidate-visible-bg-ack.json),
[earlier B diagnostic](1093-evidence/candidate-history-large.json).
All numbers below are milliseconds. Each displayed p95/max is the greater of the
two independently measured 0/320ms cohorts, each with20 samples; cohorts are not
pooled or selectively trimmed. Large-scene paint long tasks max73ms, structural
long tasks max108ms; cold Save maxima90.6ms large/17.5ms small. The targeted DPR2
sibling has20 actions per scene and maxima111.8ms large/39.8ms small. All per-case
thresholds, trusted input, exactly-one request, persisted result and unchanged
floor-physics assertions passed. The full JSON retains raw IO phases and counters.

| Scene / operation | Pre-request p95 | ACK-to-paint p95 | Client p95 | Client max | Long-task max |
|---|---:|---:|---:|---:|---:|
| large / history-copy | 13.7 | 87.4 | 104.0 | 106.7 | 100.0 |
| large / history-delete | 27.2 | 90.9 | 123.2 | 125.0 | 108.0 |
| large / history-redo | 8.4 | 74.2 | 82.7 | 84.9 | 81.0 |
| large / history-undo | 6.3 | 73.6 | 82.0 | 86.2 | 81.0 |
| large / inactive-paint | 20.4 | 38.5 | 54.8 | 59.8 | 58.0 |
| large / room-name | 35.2 | 35.9 | 70.3 | 73.1 | 73.0 |
| large / room-paint | 33.3 | 36.3 | 68.4 | 70.1 | 71.0 |
| large / visible-bg | 21.7 | 40.4 | 62.9 | 78.6 | 63.0 |
| large / visible-color | 19.8 | 37.9 | 57.7 | 59.8 | 56.0 |
| large / visible-title | 19.9 | 39.3 | 59.6 | 60.0 | 53.0 |
| small / history-copy | 5.8 | 25.4 | 29.8 | 32.7 | 0.0 |
| small / history-delete | 10.8 | 31.5 | 41.7 | 41.9 | 0.0 |
| small / history-redo | 3.7 | 28.7 | 32.3 | 32.3 | 0.0 |
| small / history-undo | 3.7 | 26.7 | 30.1 | 30.5 | 0.0 |
| small / inactive-paint | 5.3 | 8.7 | 13.7 | 14.8 | 0.0 |
| small / room-name | 8.7 | 8.8 | 16.9 | 17.3 | 0.0 |
| small / room-paint | 9.3 | 8.9 | 17.0 | 25.2 | 0.0 |
| small / visible-bg | 5.9 | 8.7 | 13.8 | 16.9 | 0.0 |
| small / visible-color | 5.6 | 8.8 | 13.8 | 14.3 | 0.0 |
| small / visible-title | 5.1 | 9.3 | 13.7 | 13.9 | 0.0 |

## Selected visual and resource evidence

The four ledger scenes were captured with the canonical selected invocation
`node demo/golden/run.mjs --mode=capture --scenario=<exact-id>` on both the
candidate and frozen #1089 source06085343 (head81d3235156065f07ce618bc74c85bcb623e475f5).
Every candidate PNG is **byte-identical** to that joint base: flat room labels
in light/dark, isometric CO2 dark and large-house zoom250 dark. The global index
still reports inherited #1070/#997 header differences; no #1093 pixel delta or
baseline acceptance is claimed. [Hashes, full capture receipts and images](1093-evidence/golden/comparison.json).
The initially attempted targeted `verify` invocation was correctly refused by
the existing policy before capture: verify is full-matrix-only. No policy or
baseline was altered; selected captures use the same command as browser_selected.

[Measured resource comparison](1093-evidence/joint-price.json) verifies both
source fingerprints and every manifest asset. #1093 costs +3544B initial gzip,
+147B lazy editor, −36B onboarding and +13546B generated JS;47 additional host
references implement consumer/owner joins. The owner authorized these measured
increases. Each baseline carries only this task delta, preserving inherited
headroom/excess and the existing bands; absolute and timing budgets remain
unchanged. Bundle budgets and unused/monolith gates pass.

## Adjacent contracts retained

Read-only inspection found direct prior-tail waits in Space Copy, Optimize,
keyboard nudge, backup preview and Space Delete. Those entry points were not
changed speculatively: no native reproducer for them was established in this
task. Properties optimistic group preview and wall-node failed-queue recovery
have explicit existing rollback protocols and keep those protocols. The new
helper is limited to the independently witnessed paired/Properties operations;
it does not swallow a new operation failure or replace the queue.

## Acceptance matrix

Commands below run from the repository root after the pinned source build and
`node scripts/bundle-sync.mjs`. Their final joint-source outcomes are recorded
with the full timing/gate handoff; earlier diagnostic results remain separate.

| AC | Concrete witness / command | What makes it fail |
|---|---|---|
| AC1–2 | `node --test test/floor-geometry-key.test.mjs test/render-snapshot-incremental.test.mjs`; `node demo/smoke_selective_invalidation.mjs` | Display changes cool physical caches; unknown fields or absent/null/false/zero collapse; a native Save fails actual persisted readback |
| AC3 | `node demo/smoke_floor_geometry_cache.mjs`; `node demo/smoke_floor_cache_reuse.mjs` | Real wall/opening/body/in-place edits or model/current/preview mismatch retain the old result; fresh-card geometry differs |
| AC4 | `node demo/smoke_selective_invalidation.mjs`; `node --test test/demand-space-models.test.mjs test/summary-panel-runtime.test.mjs` | Hidden structural B revisions rebuild A/B early, latest B geometry is absent on native show, or a demanded all-floor aggregate omits its dependency; first show has its own browser input-to-settled-paint profile, not the paint-only timing budget |
| AC5 | `node --test test/view-runtime-boundary.test.mjs test/summary-panel-runtime.test.mjs test/marker-alert-runtime.test.mjs test/render-snapshot-consumers.test.mjs`; native selective/summary smokes | Hidden consumers schedule/chunk/publish; late old-owner import/timer blocks the new owner; a hidden local-room sensor or controller needed by a visible result is incorrectly dropped |
| AC6 | `node --test test/device-roster-state-key.test.mjs test/render-snapshot-demand.test.mjs test/render-snapshot-incremental.test.mjs`; native selective live helper | Related numeric/attribute/registry changes stay stale; unrelated entity wakes faces; effective override is lost; disable/ACL leaves an active old object |
| AC7 | Floor-cache smoke above; `node demo/smoke_visual_continuity.mjs`; `node demo/smoke_warm_owners.mjs`; config-adoption units in the product gate | Equivalent ACK/clone or unrelated floor cools geometry; in-place edits are missed; bounded caches grow past eight; one mounted card adopts another card's owner |
| AC8 | `node demo/smoke_selective_invalidation_authority.mjs`; native selective held/refused/pending cases; `node --test test/room-save-946.test.mjs test/prior-config-write.test.mjs` | Save closes before ACK, creates a duplicate, poisons a later independent command, revives/closes a replacement, or misreports accepted-but-lost server truth |
| AC9 | `node demo/smoke_device_structure_history.mjs`; `node demo/smoke_device_position_history.mjs`; shared timing history profiles | Copy→Move→Delete→Undo×3→Redo×3 changes identity/history/coherent pair, loses rollback or retries a new ambiguous operation; unchanged physical floor rebuilds. Existing backend attachment pin/GC/readback tests remain authoritative; no backend change |
| AC10 | `node demo/benchmark_selective_invalidation.mjs --profile=full --output=artifacts/performance-smoke/selective-invalidation.json`; four selected core wrappers | Original nonempty baseline is RED; all fixed-delay samples, p95/max/long-task thresholds and real build counters are asserted. Planner/proof units reject omitted mandatory core or failed execution |
| AC11 | `node demo/smoke_plan_rotation_touch.mjs`; `node demo/smoke_view_runtime_kiosk_recovery.mjs`; continuity/warm-owner smokes; native selective `--dpr=2`; four ledger Golden scenes | Genuine touch fails, stale first frame/owner survives, replaced stage stops resize observation, or visible flat/isometric/light/dark/zoom output changes beyond inherited accepted intent |

Backend attachment/history evidence reused without claiming a frontend mock is
real HA: `tests_backend/test_marker_history.py` covers pinned original bytes and
missing/expired recovery; `test_ha_marker_copy.py` covers independent copied URLs
and bytes; `test_ha_marker_history.py` covers live-file cleanup protection,
paired rollback and same-ID/lost-response replay. Existing independent backend
coverage is unchanged by this frontend task.

E2E verdict: **needed**. [The reviewed beta companion record](https://github.com/Matysh/houseplan-e2e/blob/1121adf147322c520344529bd1d8b444d30dfdf8/task-impact/houseplan-card-1093.md) records native Save ACK/error,
hidden-floor update→show and Copy/Undo scenarios. The frontend timing/core gates
remain prerequisites for S7; blocked process modernization #1091 is not a
substitute or dependency for those checks.

## Remaining gates

Actual accepted joint-source identity and full normal pre-push remain required
before S7. Selected Golden proof and release documentation are complete;
generated CI inventory is refreshed with the final source/test set.
Static mutation readiness is GREEN: 1975 definitions, 555 classified browser
witnesses; execution=0 and caught status intentionally unknown until nightly.
No result in this author report asserts S7/S8. The first full local gate exposed
four bookkeeping/witness failures: the new fixture was absent from the complete
wall-identity passport; the raw fingerprint oracle had retained canonical-empty
collections; two new compatibility comments needed explicit classification;
and the testing guide exceeded its documentation bound. Existing 134 corpus
entries remain identical, the fingerprint test retains structural negatives and
adds an explicit empty/absent positive, exact compatibility coverage is updated,
and the guide links this complete audit. All 17 focused tests then passed.
The subsequent normal pre-push full gate passed in 289 seconds with zero failed
steps. Publication remained correctly refused by the separate process gate while
the frozen #1089 commits were not yet accepted in dev; no bypass was attempted.
Mounted resize ownership: the native small-scene matrix exposed a real stale observer lease. A public HA authority reload replaced the stage without disconnecting the card; the old stage was detached, and changing actual header width to900/1300px left compact state unchanged. Source fix retires/rebinds header+viewport observers when their DOM targets change and fences queued old callbacks. Raw before/after: artifacts/1093/header-stage-red.json and header-stage-green.json. The corrected native combined smoke and full one-iteration correctness matrix pass (86 samples, no failures); this is explicitly a correctness probe, not the 20-run timing acceptance.
