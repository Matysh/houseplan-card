# Room Resize — fixed-topology wall move

This document is the source of truth for the Plan editor Resize tool. The
contract was narrowed in [#277](https://github.com/Matysh/houseplan-card/issues/277)
after the former general-purpose transform corrupted wall thickness and could
make all masonry disappear.

## User contract

Resize moves one existing horizontal or vertical room wall parallel to itself.
The two adjacent walls only change length. It never adds, removes, reorders or
simplifies room vertices.

- A non-shared wall changes exactly one room.
- An exactly shared endpoint-to-endpoint wall changes exactly two rooms.
- An irregular room is allowed while that exact pairing remains true. The wall
  stops at the first corner/grid position after which the moving segment or its
  topology would change.
- A third room is always a stop; it never joins the gesture.
- The old corner scale frame, diagonal resize and partial-shared cascade are
  removed.

Every room edge keeps a visible finger-sized handle. An ineligible handle is
dimmed, focusable and marked `aria-disabled`; mouse hover/focus exposes the
localized reason and click/tap repeats it in the card toast. It captures no
pointer and creates no history or save.

## Eligibility

`resolveSafeResize()` returns either `enabled + SafeResizePlan` or one stable
reason, in this priority order:

1. `diagonal` — the moving edge is not numerically horizontal/vertical;
2. `side-angle` — either adjacent edge is not perpendicular;
3. `duplicate-physical-wall` — a partition, unfinished outline or column
   overlaps the moving wall;
4. `partial-shared` — another room owns only part of the edge;
5. `unequal-shared` — the candidate neighbour has different endpoints/length;
6. `multiple-rooms` — the operation would involve more than two rooms;
7. `thickness-conflict` — the physical profile cannot be mapped losslessly;
8. `opening-conflict` — an opening on the moving wall is hosted/ambiguous or
   does not fit;
9. `invalid-geometry` — the initial polygon fails structural checks.

The numerical epsilon only absorbs storage noise. It never snaps a visibly
angled edge into eligibility.

## Pure pipeline

The production controller reaches only four pure operations in `src/resize.ts`:

1. `resolveSafeResize(rooms, openings, roomId, edge, options)` captures the
   immutable plan: one/two room ids, exact edge indices, original endpoints,
   topology signatures and moving ordinary openings.
2. `clampSafeResize(...)` walks grid deltas contiguously from zero and stops at
   the first invalid position. It cannot jump through an opening/corner to a
   later valid position. Exact delta results are memoized per active plan and
   options, weakly held and capped at 4096 entries.
3. `applySafeResize(...)` moves exactly the two endpoint vertices in each
   planned room and translates each ordinary moving-wall opening once.
4. `validateSafeResize(...)` proves room identity/count, topology, orientation,
   simplicity, minimum clearance, exact shared endpoints, foreign-room
   relations, physical obstacles and opening jamb clearance.

Historical general-transform helpers remain only for old pure-test history.
`houseplan-card.ts` must not import or call `applyRoomScale`,
`clampRoomScale`, `shiftSharedSpans` or `simplifyPoly`.

## Stops

The closest stop in either direction wins:

- zero/too-short side edge, orientation reversal or the 30 cm room clearance;
- first irregular-room corner that would change moving-edge correspondence;
- third/foreign room, island, independent partition/draft or column;
- perpendicular side-wall opening: the moving wall axis stops at the jamb with
  half the moving wall thickness included;
- moving-wall opening that would no longer fit;
- loss of exact shared endpoints or any structural candidate failure.

The final persisted position is the last safe grid node. Eligibility probes one
grid step in both directions through the same exact validator. If neither step
is safe, the handle remains visible and focusable but is disabled with the
stable reason that blocks the move; it never starts a no-op gesture or write.

An exact independent partition over a room boundary remains a physical blocker.
The explicit **Optimize plans** action may remove that blocker first only when
the complete partition is provably identical to one solid outer wall or one
solid wall shared by exactly two rooms. Any hosted openings must be materialized
without changing their centre, angle or fields, and the backend independently
proves the complete rewrite. Resize itself never moves or ignores partitions.

## Preview and commit

The gesture owns an immutable `_geometrySnapshot()`. Every preview is rebuilt
from it; `_serverCfg` is untouched until pointerup. The overlay contains rooms,
openings, re-keyed wall thickness/open spans and byte-equivalent partitions,
drafts, columns, decor and plan transform.

The renderer consumes that exact overlay, so fills, masonry, openings, labels
and measurements show one candidate. Its production wall/floor result is cached
for the preview cfg epoch. Pointerup reuses that exact result (or computes it if
the release happened before a frame) and then re-runs the pure invariants.

Success copies the exact overlay into the real space, creates one named Undo
command and schedules one config write. There is no commit-time simplification,
wall degradation or second geometry reconstruction. Failure, Esc,
`pointercancel`, `lostpointercapture`, pinch and tool exit discard the overlay
with zero Undo entries and zero writes.

## Thickness, virtual spans and openings

`rekeyWallsAfterMove()` and `rekeyOpenSpansAfterMove()` map the immutable
snapshot to the fixed-topology candidate. Physical centimetre values and open
span count must survive; the production geometry check is fail-closed.

Ordinary openings centred on the moving wall translate by the same vector.
Their type, angle, length and compatibility fields stay unchanged. Hosted
partition openings never move with a room wall. Openings on the two side walls
stay fixed and limit the axis by `opening.length / 2 + movingWallHalfDepth`.

## Performance

- eligibility is memoized by the committed geometry snapshot;
- pointer clamp p95 budget is 16 ms and no more than 20% over the historical
  same-run edge-drag baseline (small timer-noise allowance applies);
- pointerup reads the final preview's cached production result and has a 75 ms
  p95 budget;
- cache lifetime is the active committed geometry/gesture and is bounded.

The existing large-house render benchmark remains responsible for the cost of
building the preview frame itself.

## Verification

- `test/resize.test.mjs`: eligibility, exact pair, first-corner clamp, third
  room, physical jamb, moving opening, obstacles and bounded memoization;
- `test/fixtures/resize-safe-regression.json`: minimized/anonymized private
  repro whose one long edge is owned by two neighbours;
- `test/resize-production-path.test.mjs`: old handlers unreachable, corner
  frame absent and all reasons localized;
- `demo/smoke_room_resize.mjs`: production bundle pointer handlers,
  preview/commit/Undo, disabled accessibility, real fixture topology,
  production-preflight failure and cancellation;
- `test/resize-optimize.test.mjs` and
  `demo/smoke_resize_outer_reconciliation.mjs`: an exact outer-wall partition
  blocks a zero-range handle, Optimize safely rehosts its windows and removes
  the blocker, then the same production Resize gesture changes exactly two
  rooms;
- `demo/benchmark_safe_resize.mjs`: same-run pointer and cached pointerup budgets;
- `demo/benchmark_safe_resize_render.mjs`: warm 20-room/80-handle layer p95
  and exactly one geometry snapshot per rendered frame;
- mutation gate: eligibility, third-room, topology, jamb and commit-preflight
  bypass mutants.

Targeted light/dark golden scenes cover enabled/disabled handles, opening/corner
stops and final masonry. Full golden, smoke and performance matrices run before
every beta; Linux CI is canonical for the complete HA harness.
