# Editor command latency — #1075

## Scope and reproducibility

Before: `f2c2b36019da464102d1c35dac5c4c61031a2e9c` (dev before this task).
After: the #1075 implementation. Both use the same synthetic fixtures and pinned
dependencies on this Windows workstation; no private HA export is committed.
The genuine baseline is materialized from Git, not simulated by disabling a
guard or executing a mutant. Task verification does not execute mutants.

Backend command:

```sh
python -m pytest tests_backend/test_ha_editor_command_latency.py -q -s
```

Run under WSL Ubuntu 24.04 with Python 3.14.7, Home Assistant 2026.10.3 and
the installed pytest HA plugin. The diagnostic also runs against the unmodified
baseline package (same interpreter/plugin, separate archived source root).
It sends authenticated native WebSocket apply/Undo through the registered
handler and real HA Store implementation; each inverse restores the complete
original configuration. It reports one cold and five warm samples per direction
and fixture. Passive observers always delegate the original call and result.

## Server results

Milliseconds; warm columns are arithmetic means of five samples. The minimal
fixture has only two independent wall sections. The second adds 25 untouched
rectangular rooms on another floor. No request changes that floor.

| Fixture / direction | ACK cold before → after | ACK warm before → after | CPU warm before → after |
|---|---:|---:|---:|
| Two sections / delete | 31.68 → 32.18 | 32.11 → 33.03 | 0.60 → 0.60 |
| Two sections / Undo | 31.65 → 32.21 | 32.67 → 33.35 | 0.71 → 0.67 |
| +25 remote rooms / delete | 93.69 → 40.46 | 96.83 → 40.55 | 64.89 → 6.61 |
| +25 remote rooms / Undo | 113.38 → 41.51 | 113.46 → 43.59 | 81.98 → 9.79 |

Warm breakdown for the remote-floor fixture:

| Phase | Delete before → after | Undo before → after |
|---|---:|---:|
| Candidate | 37.25 → 1.89 | 56.82 → 3.76 |
| Source-derived host baseline | 18.14 → 0.29 | 18.20 → 0.29 |
| Complete schema | 1.66 → 1.61 | 1.73 → 1.64 |
| Junction validation | 7.62 → 2.62 | 5.00 → 3.90 |
| Write-lock wait | <0.01 → <0.01 | <0.01 → <0.01 |
| CPU executor wait | 0.14 → 0.16 | 0.14 → 0.15 |
| Config Store call | 0.32 → 0.32 | 0.32 → 0.32 |
| Save-dependent work | 12.88 → 12.64 | 12.22 → 12.55 |
| Optimizer-snapshot maintenance | 1.91 → 1.98 | 1.97 → 1.93 |

`cpu_total` encloses candidate, model/schema, passages, source-derived host proof,
hosts and junction work. `dependent_save` subtracts the nested config Store
call from `async_save_config_state`; it includes canonicalization and Zigbee/LQI/
virtual-light lifecycle work. `resolved_read` separately measures coherent pair
resolution before validation (about 6–7 ms for the larger fixture). ACK total
includes WebSocket dispatch/serialization and reply delivery, so it is not the
sum of selected CPU phases. HA's test storage environment is not the owner's
physical disk: the Store call measurement is not an fsync or network benchmark.

Structural oracle: original materializer call accounting sees only the selected
floor for a current document (two calls for apply; three for inverse proof and
restore); asking the prepared object for its host baseline adds no materializer
call. Legacy data still takes the complete materialization path. Exact-revision
junction reuse does not skip judging the candidate or publish counts on failure.

The earlier authorized live baseline was 3863 ms for Delete and 8259 ms for its
inverse, with 9.7 ms ping. Both config and unrelated layout were restored exactly.
Those aggregate live figures lack server-phase instrumentation and are not
compared as if this workstation were the same CPU/disk/queue. No candidate was
installed on real HA. The equivalent local authenticated handler has no residual
multi-second phase, but this report does **not** claim a measured post-fix speed
on the owner's installation; release/normal use can validate that separately.

## Native furniture history

```sh
npx tsc -p tsconfig.test.json
node scripts/fix-test-build.mjs
npm run bundle:sync
node demo/smoke_editor_command_latency.mjs
```

Playwright 1.62 / pinned Chromium 151.0.7922.34 rev1234. The smoke uses the real
Furniture palette, pointer placement, toolbar Undo/Redo and native keyboard
shortcuts, not a private history method. Fixtures start with the current canonical
model; legacy migration is deliberately not confused with a decor-only edit.
There is one cold and five warm Undo/Redo pairs on a small scene and canonical
large-house (60 rooms / three floors). Each step checks the complete stored
configuration, visible SVG furniture, physical SVG and one history cursor step.
The final fresh card must paint the same physical scene and stored furniture.

On genuine baseline code all 24 structural-build assertions fail, while the
exact config/SVG/history assertions pass. On #1075 all pass: no additional
wallUnion, physicalBodies, innerContour, lightBarrier or lightPhysicalBodies
builds. Physical/mixed, stairs/transform, node/chain/reference, unknown non-decor
and legacy cases are separately refused by the fast-path unit witness.

Large-house next-frame times on baseline were 134.4/129.9 ms cold Undo/Redo and
127.8–148.3 / 128.8–145.9 ms warm. After the change the same scene's samples were
18.3–30.2 / 21.4–34.2 ms. These are diagnostic two-RAF observations, not isolated
JavaScript CPU or GPU time and not a new portable threshold. The normal ~500 ms
debounced save remains; ACK-and-settle is consequently still about 0.6 s even
when the visual/history change is already shown. The wire observer reports
until-request, wire and reply-to-settled separately; fake HA wire time is not
real network latency. No save timing or safety guard was shortened.

## Protective evidence

| Contract | Witness / ordinary red input |
|---|---|
| Menu under all Plan tools, cold entry | `smoke_wall_node_delete.mjs`: native direct/group toolbar controls; pre-fix non-Select menu absent |
| Right press cannot draw/pan/move | Same smoke: exact config/history/camera, no node handles outside Select; field, pending, stale, touch and View/kiosk refusals |
| One opening proof | `wall-node-delete-menu.test.mjs`: actual unchanged intent records one validation, not two; stale callback sends nothing |
| Current target-only proof / legacy fallback | `test_wall_node_delete.py`: original materializer accounting, exact inverse, foreign fields and ordinary malformed/forged inputs |
| Revision-bound junction reuse / durable authority | `test_ha_wall_node_delete.py`: exact/stale/missing cache inputs; original validators; real competing requests and Store failure |
| Decor-only decision | `decor-history-restore.test.mjs`: physical/unknown/legacy/mixed negative inputs leave config untouched |
| Real history/cache consumer | `smoke_editor_command_latency.mjs`: genuine baseline's 24 extra-build failures; exact config, SVG and cold reference |

Nightly mutation definitions cover these protections. Task checks only validate
registry anchors and run the ordinary witnesses; there is no task-time caught
claim and no global baseline acceptance.

Selected existing Golden checks are `geometry-decor-editor-dark` and
`furniture-placement-preview-light`, with **no** expected pixel differences.
The ledger's `visual.golden` is empty because that field grants only explicit
`change`/`new` allowances; it must not grant either for these unchanged scenes.
