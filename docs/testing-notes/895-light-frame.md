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
- Paired browser performance, native/golden and mandatory pre-push/exact CI:
  pending; this checkpoint is not a merge/release verdict.
