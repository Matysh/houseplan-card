# #895 — shared light frame and precise presentation invalidation

Accepted SPEC body digest: `22931526ed7b96663a1b7bff401c1236208ce70ca970b84c13ce91a263ae2ab6`.
Initial accepted base: `a7bd08bfdffa2b2747fa711f827e302ab4690781`.
Release classification: stable-fix relative to v1.80.1, milestone 1.81.

## Contract / negative evidence

| AC | Witness | Rejects / negative probe |
|---|---|---|
| AC1 | `presentation-light-frame.test.mjs`: real 200-marker capture × 100 alternating light frames; 600 builds with two derived consumers; all independent face identities retained; one marker-state projection/capture, zero without derived values | Registered `light-frame-restores-global-array-invalidation`; restoring the graph-array key loses identities and resolves all 400 faces/tick |
| AC2 | Same test: complete capture AND unindexed canonical presentation equality for off/on/unavailable, RGB/brightness, explicit/direct/marker/missing controls, shared physical alias, passive incoming drivers, manual virtual state, legacy cycle, derived values, battery/LQI/alarm row updates | Registered `light-frame-ignores-passive-source-change`; passive source has empty stateEids and must follow a driver without its own HA row |
| AC3 | `benchmark_light_presentation.mjs`: exactly three fixed 50×50, 100-tick series per material, shared serialized S0/S1/S1b/S2 protocol, same real bootSoft/steady wait; raw tick/capture/CPU samples and material/pins/environment/fixture identities | Unknown/dirty/stale material rejected; unchanged official `led-strips-v1` counters/budgets; before/after reduction judged from exact presentation counts, never a faster empty fixture |
| AC4 | Unit: no-proof wrapper and duplicate keys cannot authorise reuse; bounded live maps and disposal; retired frame cannot affect the new capture; registry/layout/config/roster invalidation; existing #850 random-250-tick oracle | Missing proof rebuilds all; fresh replacement rows compared to canonical; reset must release frame/maps |
| AC5 | Existing native light/LED/status/hover/action witnesses and full golden matrix, unchanged images | Existing canonical pixel/semantic assertions; no image acceptance or clock/ceiling change for speed |

Mutation entries are **definitions only**. Static `--check` passed; no mutant
was executed and no caught verdict is claimed.

## Implementation boundary

`PresentationLightFrame` is one synchronous capture-local index, not an HA
cache. It snapshots source `on` separately from topology (source ownership,
key/entity, state/service identities and passive/spatial role). The reuse
window tracks consumed graph keys in the same synchronous build boundary as
its existing actual HA row reads. No row is discarded from the dependency
model: passive incoming state is an additional explicit dependency, while
real source attributes remain HA row dependencies. Unknown/ambiguous proof,
topology, config, registry, manual state, locale/theme and activity retain
the conservative complete path. Disposal forgets both dependency maps and
the frame; only the current roster's presentations are retained.

Static capture and no-snapshot space rendering share the same index/derived
choice logic. Device preview still uses the canonical full resolver and the
existing source-candidate discovery. No schema, controls, ownership, cycles,
deduplication, light geometry, LED bands, alarms or diagnostic policy changed.

## Evidence ledger

- TypeScript no-emit: PASS.
- Existing presentation + incremental capture differential: 56 PASS.
- New #895 units: 3 PASS, including 200×100 and unindexed canonical oracle.
- Mutation registry static readiness: 1519 definitions, execution 0; existing
  five warnings remain. Two new Node-only declarations; no browser growth.
- Paired browser performance: all six fixed cold samples PASS, no retries or
  discarded rows. Base `3e10b8adea6e9bb8050826bc9141a3e58bc6ae2b`, result
  `c4151b1acf26cc201dd7bd2d258c7c7deeb327fe` (same source as this later B/C
  evidence-only follow-up). All samples: bootSoft=false, booting=false,
  continuity=steady, 200 devices, 50 strips. Exact protocol/fixture/observer
  hashes and pins match. S2 builds **40000 → 200** in each pair (99.5% less),
  staleStripes=0. Tick p95 24.2/25.2/24.8 ms → 13.7/12.9/12.9 ms; capture
  wall sums 1058/1078/1051 ms → 201/196/194 ms; sampled product CPU totals
  1995/2024/2000 ms → 1113/1100/1113 ms. These are bounded observations of
  this scenario, not compositor/real-GPU acceptance or new timing budgets.
  This is a **historical independent cohort before #867 integration**, not
  exact final-source proof after that shared capture projection changes.
- B-only readiness preparation adds an explicit actual #848 live-boundary
  `ready` plus installed capture condition before observation. Each future
  receipt records both facts; the comparator rejects missing/non-ready facts
  on either material. The six historical raw receipts above remain unchanged
  and are not upgraded to this new observer or accepted by its stricter
  preparation check. No new benchmark has run at this checkpoint; final B/R
  measurement waits for accepted #848/#899 and a separate controlled window.
- Historical `c377a80e` comparator: 2 PASS; the original raw receipts passed
  that original observer/comparator with zero failures. They lack the new
  readiness observations and are not valid final-source comparison input.
- B-only readiness preparation: `node --test test/light-presentation-report.test.mjs`
  → 3 PASS, including missing/idle/loading/error and missing capture on either
  material. This is a pure synthetic-receipt check, not new runtime/performance
  proof. Missing CPU/capture rows, dirty/unsettled/mismatched material or
  <50% reduction still fail closed.
- Raw local `artifacts/895-base-perf.json`: SHA256
  `bfa79fba63339deb623fba4aad7d8158a86a9df96b3ff9b2950b4d8c47becabc`;
  `artifacts/895-result-perf.json`:
  `143de0f7c064e4d723d294352fd0b629b039d5bfd66228f94e4b909547f02a3a`;
  comparison:
  `8cfd9b679c0b4d3a33e42c310524abdadf9ca6bf546dcdb8de8a681a65979f51`.
- Native PASS: controls, linked_virtual_light, cold_view_toggle,
  device_icon_design, activity_color_settings, danger_confirm_branches,
  space_card_identity. LED strip smoke reached a separate garden-navigation
  refusal at line614; the exact same untouched smoke also fails at that same
  line on accepted base `3e10b8ad`. Earlier exact transition-event witnesses
  pass on both. Both red logs are retained; cause remains unknown and this is
  not waived or fixed by changing the fixture here. Final shared regression
  must account for it before any merge/release verdict.
- Final accepted #867 integration, full golden, mandatory pre-push/exact CI
  remain pending. This checkpoint is not a merge/release verdict.
