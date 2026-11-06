# #1338 — hover paint does not own menu updates

Discovered by full #1330 S6 run20261106T131447503-3b6bef64. The unchanged native
smoke_wall_node_delete failed twice in the Straight tool: its opened menu DOM
stayed inert. A fresh git archive of dev418a72a888ea5662808e0eb8236e3f40111cc1b1,
with its own test-build/Rollup/demo assets, reproduced the same failure at
native lines127/171. No #1330 product source was present in that archive.
Original logs remain in output/issue-1330/{baseline-delete,node-delete-repeat,
delete-diagnostic}.log and artifacts/1330/delete-failure.png. This confirms a
previously optional #1253 review concern; it is not a new attach regression.

## Cause and local correction

stairs.live includes a no-button hover. activeEditorGesture therefore routed
unrelated anonymous requestUpdate (including opening the node menu) into the
bounded live paint, leaving the normal host DOM inert. A real gesture now needs
both stairs.dragging and stairs.live, preserving the original selection/down
host update when a transform is not yet moving. hoverAt calls the existing
scheduleHouseplanEditor directly, so30 moves still coalesce in1 frame without
full host renders. Clear/cancel restores the ordinary host update. No new
state, writer, geometry, storage, UI mode or global gate was added.

## Verification

- The updated2 regression cases run against the old compiled dev:31 pass,
  precisely2 new failures. Current live-editor + stairs-editor-live:33/33 PASS.
- Normal build/types PASS; unchanged full smoke_wall_node_delete PASS,
  including Straight/Spiral tools, no placement/pan/history/write and its
  existing ACK/history/late-context cases.
- Full smoke_stairs PASS with previous assertions: hover/click equality,
  no writes, one visual owner after host/HA updates, leave/Escape late tails
  and navigation after hover Escape. No thresholds/baselines were relaxed.
- New cases inherit the existing editor/history/runtime file classifications;
  the common #1330 ask plan includes them and both native witnesses as
  explicit supplements to the automatic set. The final queued S6/review,
  not the addressed commands alone, owns merge readiness.

Ship was chosen before implementation under PROCESS's4 conditions: one known
local result, a direct correction, short actual negative/positive witnesses and
code-only rollback. It stays ship; the common #1330 ask packet also receives
substantive review. This is not an individual S7 claim.

Companion: extend #1253's existing stairs/editor E2E impact with node-menu
availability while hovering both stair kinds and with normal panel/history
updates. No new HA backend protocol or data model; no owner HA or release run.
