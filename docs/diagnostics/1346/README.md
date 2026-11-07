# #1346 — closed room contour with a dangling partition

## Report diagnosis (2026-11-07)

Source: private support report `hpr-c07b164fc6`, card/integration 1.85.0,
Home Assistant 2026.11.0, model11. Config/layout valid; client snapshot matched.
Package SHA-256: `192567c05ac2290893170ca5453ac6eaccb4c9c2aa4c284ffcb3c7d7a714ba78`.
The private package, geometry and contacts are not included here.

The first space has 1 room, 4 wall edges and 11 partition edges. Its large
outside boundary is closed. An internal partition with a door stops 10.04 cm
short of the left wall axis. The 40 cm wall body hides the axis gap visually.
The internal line is a dead end; it does not open the outside boundary.

The production half-edge face walk follows that bridge into the dead end and
back, revisits the attachment vertex, and discards the entire walk. Originally:
2 bounded faces / 1 free candidate. Removing only this partition from a LOCAL
source array yields 3 / 2. Attaching it on a LOCAL copy using the released
#1330 operation yields 4 / 3, with a valid physical check and identical TS/Python
results; that workaround changes the user's intended geometry and is not the fix.

## Independent synthetic reproduction

[1346-room-face-spurs.json](../../../test/fixtures/1346-room-face-spurs.json)
contains only invented data: four square sides and an inward dangling edge.
Before the fix the square has one face; adding the inward edge hides it.
The native fixture is an independent model11-convertible room with a dead end.
No private report geometry is used by tests or screenshots.

Before-change run: `node --test --test-name-pattern="#1346" test/wall-face-graph.test.mjs`:
5 new cases, 3 FAIL / 2 PASS. The original TAP is retained in local
`artifacts/1346/before.tap`. Failing contracts cover one internal dead end,
a branching tree, and a bridge between nested cycles. The true-gap negative
and long connected-tree control already passed.

## Fix and unchanged ownership

An iterative O(V+E) bridge search runs over already atomized undirected axes.
Bridges participate in no simple cycle and are excluded only from face walks.
The returned atoms/source owners, stored graph, walls, doors, room records,
coordinates and writer contracts remain intact. Boundary source provenance
excludes the bridge, so a newly drawn dead end cannot claim an old room.
Existing ambiguity/exact-point checks and the no-repeated-vertices guard remain.

Replay of the untouched original sources through the fixed production helper:
3 bounded faces / 2 free candidates (previously 2 / 1); inputs unchanged.
The private replay JSON/log remain local. This is helper evidence, not an HA write.

## Regression coverage

- Internal dead end, inward fork and outward tree; stable area/hit/identity
  under reordered/reversed sources; derived atoms and input records retained.
- Two cycles joined by a bridge, nested cycles, occupied neighbour, real gap.
- A connected 12,000-edge tree uses no recursive JS call stack.
- Existing native `smoke_room_face_select.mjs`: real Select hover/click,
  dialog Cancel without changes, room creation preserving the internal wall,
  exact Undo/Redo, and an open-boundary negative. It uses the normal demo
  transport; real HA persistence is not claimed.

S6 is selected by the shared runner; results/review are published on
[issue #1346](https://github.com/Matysh/houseplan-card/issues/1346).
The `wall-face-graph` file inherits geometry classification and static import
links; the native witness is an explicit areaTests addition. No full stable,
golden acceptance, user-HA modification or release is implied.

E2E impact: **needed before the next beta** — extend the real HA geometry
journey with this case, preserved opening, ACK, exact history and reload.
Recorded in [companion task-impact/1346.md](https://github.com/Matysh/houseplan-e2e/blob/main/task-impact/1346.md).