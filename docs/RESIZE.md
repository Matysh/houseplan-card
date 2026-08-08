# Room resize — the spec (source of truth)

Status: approved by the owner 2026-08-01. Dev-branch feature, **no
release**. Scope decisions final: a dedicated tool mode, wall-drag with
shared walls always moving together, a corner-scale frame for the
selected room, live numbers (wall lengths + room areas), grid snap,
Esc-cancel, one drag = one undo step.

## Principle

Until now room geometry could only be changed by split/merge or by
redrawing the outline — there was no vertex or wall dragging at all
(the `.rlhandle` corners belong to the room LABEL card, not to the
room). Resize adds exactly two mechanisms, both living ONLY inside a
dedicated Plan-editor tool «Изменение размера комнат» (`_tool ===
'resize'`). In every other tool the plan looks and behaves exactly as
before — no handles, no new hit areas.

## Mechanism A — wall drag

- Every visible room shows a small handle at the midpoint of every
  wall (handles for all rooms at once — owner's UX pick). The visible
  glyph is a compact icon — a wall segment with two arrows pointing
  perpendicular to it (the directions the wall drags), rotated to the
  wall's orientation; accent ink over a `--hp-bg` halo. It is half the
  size of the old circle, but the HIT area is an invisible circle of
  the original finger-sized radius (derived from `view.w` like
  `.vacfithandle`), so touch targets did not shrink. Cursor: `grab`,
  `grabbing` while dragging.
- Dragging a handle moves the wall along its outward normal; **both
  ends of the edge translate together** (the wall stays parallel to
  itself; adjacent walls stretch/shrink). Works for any polygon
  (L-shaped included) and for legacy `x/y/w/h` rectangles — those are
  converted through `roomPoly` and are **saved back as `poly`**.
- The moved wall position snaps to the drawing grid (`snapToGrid`,
  same pitch as the draw tool).
- **Handles own the hit test** (HP-1550-04): inside the resize tool
  openings are not editable — their transparent hit area is inert
  (`pointer-events: none`) and the resize layer renders above the
  openings, so a door sitting exactly at the midpoint of a wall can
  never shadow that wall's handle. A drag of such a wall carries the
  door along through the normal anchor pipeline; clicking over a door
  falls through to room picking. Every other Plan tool keeps the
  openings interactive exactly as before.

## Shared walls — ALWAYS together

If a stretch of the dragged wall coincides with a neighbour's boundary
(collinear overlap with an epsilon, the `sharedBoundary` notion), the
coinciding stretches of the neighbour move synchronously: your room
grows — the neighbour shrinks. Gaps and overlaps cannot appear by
construction.

Partial contact (T-junctions): only the coinciding stretch of the
neighbour moves. Where the stretch ends inside a neighbour wall, new
vertices are inserted into the neighbour outline, which may legally
become L-shaped. All of this is shown as a live preview during the
drag. On commit collinear leftovers are simplified away
(`simplifyPoly`), so geometry stays clean.

## Stops (the wall stops dead)

1. **Minimum size** — neither the own room nor a shrinking neighbour
   may get thinner than ~30 cm (`MIN_ROOM_CM`, expressed in canvas
   units through `cell_cm`). The measure is orientation-independent
   (HP-1550-02): for a wall drag it is the smallest perpendicular
   distance from the moved stretch to any part of the room boundary
   inside the band the stretch sweeps along its normal — vertices and
   crossing walls count whether parallel or not (a triangle's apex, a
   slanted obstacle), while collinear remainders and the step corners
   a T-junction inserts at the very ends of the stretch do not. For
   the scale frame it is the TRUE minimum width of the outline
   (rotating calipers over the convex hull) scaled by `k` — the
   axis-aligned bbox is never consulted, so rotation cannot hide the
   short side. Rooms that are ALREADY thinner keep their clearance
   (the drag may improve it, never worsen it).
2. **Self-intersection** — a wall never passes through the opposite
   side; the outline must stay a simple polygon with its orientation
   and a positive area.
3. **Foreign rooms** — a growing wall stops when it would overlap a
   room that is not a shared-wall neighbour (`roomsOverlap`; touching
   walls are legal, crossing is not).
4. **Island rooms** — islands inside the room (`islandsOf`) must stay
   fully inside; a wall shrinking onto an island stops.
5. **Openings are anchors** — a door/window/gate ON the moving stretch
   travels with the wall (its `openings[].x/y` centre is shifted, the
   angle is unchanged). A wall that carries openings cannot get too
   short for them: every opening previously sitting on a wall of an
   affected room must still fit fully on some wall afterwards — for
   the own room AND for the neighbour.

## Mechanism B — the scale frame

- In the resize tool a click inside a room SELECTS it: a dashed
  bounding frame with 4 corner handles appears.
- Dragging a corner scales ALL vertices proportionally (uniform
  similarity) about the opposite bbox corner — the same maths family
  as the vacuum fit panel (`reanchorFit`), only without rotation.
- The same stops apply (minimum size, foreign overlap, islands,
  openings; self-intersection is impossible under a similarity).
- **The one exception to «shared walls always together»:** a scale
  breaks collinear coincidence (walls move apart at an angle-preserving
  ratio, not along a normal), so neighbours are NOT dragged along.
  Growing into a neighbour simply stops the scale (the neighbour is a
  wall to hit); shrinking away from a neighbour legally opens a gap.
- Openings exclusive to the scaled room follow the transform
  (position scales, physical length does not); openings on a wall
  shared with an unchanged neighbour stay with the neighbour's wall.

## Live numbers

While a handle is being dragged:

- length badges (`.measurelabel` style, `segmentCm`/`formatLength`,
  metric or imperial per the HA unit system) on the dragged wall and
  its two adjacent walls;
- the room area in m² (`polygonArea` × scale²) at the room centre,
  live; when a shared wall is dragged — the areas of BOTH rooms
  (owner picked «стены + площадь»);
- Esc cancels the current drag and puts the original geometry back;
- releasing the handle (pointerup) commits: one write through the
  standard debounced `_saveConfig` path;
- `pointercancel` / `lostpointercapture` (the system interrupted the
  stream: app switch, palm rejection) takes the CANCEL path, never the
  commit path — snapshot geometry back, no undo step, no write
  (HP-1550-03).

## Preview vs commit (HP-1550-01)

The live drag preview never touches the shared `_serverCfg`: it lives
in a separate overlay (`_rszPreview`) that `_curSpaceCfg`/`_renderCfg`
substitute into every render. Config writes are serialized and read
`_serverCfg` at the moment they run (HP-1454-03), so a debounced write
still queued from a previous edit can fire mid-drag — with the overlay
it carries only committed geometry. The overlay moves into the real
config exactly once, on pointerup; a cancel (Esc, pointercancel) just
drops the overlay, leaving nothing to restore and nothing to write.

## Undo

One operation (handle release that changed something) = one undo step.
Resize uses the same named 50-command Undo/Redo stack as every other
committed plan-geometry operation. Its snapshot includes rooms, openings,
wall thickness intervals and virtual boundary spans, so one Ctrl+Z/⌘Z
restores the entire transaction. Ctrl+Shift+Z/Ctrl+Y reapplies it.

## Out of scope / invariants

- Device positions are not touched; the room settings button (pole of
  inaccessibility) recomputes itself from the new outline.
- Saving goes through the standard config path (`houseplan/config/set`
  with `expected_rev`); backend validation already covers polygons
  (`_GEOM` ±4, `MAX_POLY_POINTS` 500) — inserted neighbour vertices are
  just polygon points, openings keep their schema, nothing new to
  validate server-side.
- Touch: handles are finger-sized, use pointer capture and swallow
  `pointerdown`, so the stage pan/pinch never fights a handle drag.
- The label-card corners (`.rlhandle`, `_rlResizeDown`) are untouched.

## Geometry home

All pure geometry lives in `src/resize.ts` (edge normals, edge move,
shared-span search and vertex insertion, all stops — including the
orientation-independent `minSpanClearance` band measure and the
`minPolyWidth` calipers width — the scale clamp, area formatting)
under node:test units in `test/resize.test.mjs`;
`src/houseplan-card.ts` only wires pointers, the preview overlay,
badges and undo.
