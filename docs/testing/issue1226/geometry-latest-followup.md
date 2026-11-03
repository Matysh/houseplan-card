# Remaining geometry controls on the integrated current product

Pinned material: `0bda944e3244a142449c30c5f802c14833af8c66`, including upstream dev `0c030e700` and accepted #1228–1238. `dist`, `test-build` and demo assets are exact copies of the root build for that SHA; no additional build or full audit was run here. These are addressed checks of the previously retained failures, not a release verdict.

`geometry-latest-classification-delta.json` contains one row for each of the 16 browser scripts and six Node cases. It is a delta, intentionally leaving the concurrently maintained global classifications unchanged.

## Addressed results

- Browser: 6 PASS / 10 FAIL. Four pass unchanged after upstream fixes: Optimize cleanup/context/unverified and wall-node topology. Two pass after source-only fixture ports below.
- Node Resize: 0 PASS / 6 FAIL / 0 skipped. The original tests and expected values remain unchanged.
- Each browser baseline ran once; only the two edited scripts were rerun. No former passing scripts, golden acceptance, HA journeys, or product code were changed.

Logs: `output/issue1226/geometry-latest/results.json` and matching `smoke_*.log`; the two accepted ports use `partition-openings-port.log` and `union-localized-port.log`.

## Accepted fixture ports

`smoke_partition_openings.mjs` now authors its opening reposition and short partition through the real explicit `openings`/`partitions` geometry writer. The opening supplies consistent exact `tq` as well as numeric `t`. Delete/save checks reread the adopted current space; canonical empty arrays are empty collections. The independent degraded-host witness explicitly starts without graph authority as stored legacy10, and the old room-wall read witness explicitly starts as legacy7. This preserves the original current jamb/depth/movement, atomic rejection, delete cascade, Undo/Redo, session identity, orphan rebind and uninterrupted room-axis controls. All 17 pass.

`smoke_wall_union_isolation.mjs` retains strict rejection, byte-identical rollback, zero writes/history, room rendering/parity, and proof-injection controls. Its single changed expectation identifies the current earlier nonfinite-input refusal using the exact localized `toast.wall_model_migration_blocked` plus `wall_model.reason.invalid-room`, rather than the old later generic body-build toast. All 12 pass.

## Retained storage witnesses

### Native room split, followed by thickness

`smoke_wall_thickness_transition` passes the visual/light/full/static/ISO checks but fails the original shared-storage interval check. The diagnostic adds only a readback after the same native scenario; it does not replace a producer or expected result:

```json
[
  {"id":"ge-34a37c10cdaae937","a":[0.5,0.1],"b":[0.5,0.9],"cm":10},
  {"id":"ge-43cd679d62b7efcb","a":[0.5,0.9],"b":[0.5,0.1],"cm":0}
]
```

These are distinct coincident shared-wall records with divergent thickness. `_intervalCm([500,100,500,900])` returns 0, while the original expected interval is 10. This cannot be accepted merely because the visible shell currently looks correct. Evidence: `thickness-storage-diagnostic.log` in the addressed output directory. This is not a claim that the narrower accepted #1231 named-room test repair was incomplete.

### Legacy true-split materializer and independent current resize

All three original `projectResizeStoredAtoms` cases catch `invalid-room: plan-graph:source-room-range` and return null. The non-mutating diagnostic instruments only the catch of the compiled module. Product locations: `resize-atom-projection.ts:179` calls the current model writer on a partial legacy projection, and `plan-graph.ts:788` rejects a room endpoint outside its named source carrier. Evidence: `resize-atom-causes.log`.

The retained positive legacy split, bounded remote-owner materialization, exact metadata, zero/custom thickness and opening-host-child guarantees are not automatically obsolete just because this call is no longer the normal graph11 runtime path. They have not been changed into weaker refusal assertions or routed through a fabricated authority grant.

The independent current control is committed as `repros/current-resize-incident-node.mjs`. It constructs current authority through the official producer, then executes an explicit `resize` intent for the upper pair. The upper shared boundary moves x=.5→.45. Current output creates `[.1,.5]→[.45,.5]` and `[.45,.5]→[.9,.5]` while the lower fixed room retains the whole `[.1,.5]→[.5,.5]` carrier and no incident `[.45,.5]` seam. It exits 1 on the pinned material. Evidence: `current-resize-probe.log`. The old full ownership/host guarantees therefore have not been replaced by physical-preflight-only success.

The three #292 availability cases call current Optimize directly, rather than a legacy writer. First-floor actual totals are 39 handles / 5 enabled instead of 38 / 8; actual extra reasons include invalid-geometry 7 and side-angle 2. The second-floor known shared owner handles remain disabled, and diagonal 2 / side-angle 4 remain instead of 0 / 0. Full original reason counts, per-edge status and endpoint digest remain strict (`resize-six.log`).

## Other retained failures and honest limits

The delta records every failed script without converting unresolved cases to PASS. `wall_thickness` still needs explicit current fixture authorship for its raw partition and parity-thickness mutations, plus an isolated genuine legacy key-cleanup fixture. Two `unified_wall_tool` null-model fault injections name an obsolete producer seam; the ownership/rollback contracts remain required and must be retargeted truthfully. Other face/snap/adoption failures retain their original oracles and concrete logs.

For `wall_end_align`, diagnostic readback finds the extra settled axis has a 0×0 CSS bounding box, from `[600,450]` to `[600,450.00000000000006]`; the correct live line ends at `[200,450]`. However `.active-axis` has round caps, so removing it from the visibility oracle solely by a length threshold would silently change the contract. The original one-visible-line check remains red. Evidence: `end-align-diagnostic.log`.
