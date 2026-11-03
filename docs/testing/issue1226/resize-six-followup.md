# Six remaining Resize Node failures

Base: `ec9b1bbc1`, current product `96ffe5444`; official `prepare.mjs tests` ran before the selection. The addressed command selected exactly six tests, with 0 PASS / 6 FAIL / 0 skipped:

```sh
node --test --test-reporter=spec --test-name-pattern='true side-wall split|true split never|local split inherits|issue 292' test/resize-atom-projection.test.mjs test/resize-availability-audit.test.mjs
```

Evidence: `output/issue1226/resize-six-current.log`, `resize-producer-diagnostic.jsonl`, `resize-availability-diagnostic.jsonl`. The earlier `resize-six-baseline.log` came from an unpatched ESM test-build and is not test evidence. No previously passing cases were rerun. Neither test file nor its expected results was changed.

## Atom split: obsolete entry point plus unsatisfied current guarantees

The three original #832 cases call `projectResizeStoredAtoms`, whose legacy true-split branch internally calls the current writer on a partial projection and catches the refusal. Normal model11 runtime instead calls `commitGraphEdit(..., {kind:'resize', rooms:[...]})` (`houseplan-editor-runtime.ts`), so changing the test entry point alone would hide the original failure without proving its guarantee.

The manual `repros/resize-split-current.mjs` constructs graph authority through the real migration API, sets thickness with explicit `thickness` intents, adds the opening through an explicit `openings` intent, then executes the same resize intent as runtime. It intentionally exits 1 on the current code:

1. Moving the upper pair's x=.5 boundary to .45 leaves the bottom-left room's whole carrier `[.1,.5]→[.5,.5]` and creates a separate coincident upper carrier `[.1,.5]→[.45,.5]`. The bottom-left cycle never receives the new `.45,.5` seam. Physical preflight alone returns true; that does not prove shared atom identity. This is consistent with the adjacent-split identity defect #1231.
2. The remote-owner `toJSON` sentinel is invoked by `graph-edit-intent.ts`'s full draft JSON clone. Removing this sentinel/reference preservation would discard the bounded-materialization guarantee, not repair a fixture. Whether the current whole-floor writer intentionally superseded this former performance contract needs an explicit decision; the case remains red.
3. The hosted opening at `[.475,.5]` retains the old full host ID instead of a split child. Its coordinate, metadata, horizontal 37cm thickness and vertical zero thickness are preserved; the failed oracle is specifically host identity after the missing structural split. This is also consistent with #1231.

## Availability: current Optimize produces the failing geometry

These three cases already use `optimizePlans` directly. Their room-to-render mapping and production `coalesceResizeRooms`/`resolveSafeResize` audit need no legacy writer escape hatch.

| Fixture | Expected handles/enabled | Current handles/enabled | Current extra reasons |
| --- | --- | --- | --- |
| first floor | 38 / 8 | 39 / 5 | invalid-geometry 7, side-angle 2 |
| second floor | 36 / 9 | 36 / 2 | invalid-geometry 10, diagonal 2, side-angle 4 |

After coalescing identity-only seams, both second-floor `room-a:2` and `room-b:2` still refer to the same physical shared carrier, with endpoints `[400,-208.33333333333334]→[400.0000001510574,1266.6666666666665]` in render units. Both are disabled with `invalid-geometry`. Therefore the missing second owner handle is not explained by a changed room ring index. The raw floor has diagonal 2 / side-angle 6; Optimize leaves diagonal 2 / side-angle 4 instead of the accepted 0 / 0. Report says one wall straightened, max shift approximately 1cm.

Canonical graph ordering can explain textual order changes in a handle passport, but it cannot justify accepting the observed disabled shared handles or residual near-axis reasons. Full old status/digest and owner-plan assertions remain unchanged. This is retained product/geometry evidence for comparison with the native-pointer witness, not an accepted replacement passport or a claim that #1224 fixed every historic near-axis fixture.
