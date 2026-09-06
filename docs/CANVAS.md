# Infinite canvas — the spec (source of truth)

Status: approved by the owner 2026-08-03, **shipped in v1.57.0**.
Scope decisions final: there is no "plan size" any more, the canvas
is conceptually unbounded, storage does not change, and the
opening view is always derived from what is actually drawn.

## The problem it closes

Several users drew plans that ran past the edge of the grid and then
could not place devices outside it. The only workaround was to redraw
the whole plan. The card behaved as if the normalised unit square
(`0..1`, rendered as `NORM_W x NORM_W = 1000 x 1000` units) were a
sheet of paper with edges. It is not a sheet of paper — it is just the
coordinate system.

## Principle

1. **Coordinates keep their meaning.** Rooms, openings, decor and
   device positions are still stored normalised. `1.0` is still the
   same distance it always was; `cell_cm` still ties a grid cell to
   real centimetres. **No data migration.** An existing plan opens as
   before — including the size of the markers (§6).
2. **`0..1` is not a boundary, it is an origin.** Any finite
   coordinate is legal. `2.7` simply means "2.7 canvas widths to the
   right of the origin".
3. **Nothing in the product may say "you cannot go past the edge".**
   No clamp on drawing, dragging, decor or device placement stops at
   a rectangle.
4. **What is stored is only where something is drawn.** There is no
   stored extent to keep in sync.

### Grid precision and visual units

`cell_cm` is canonical centimetres per grid cell. New metric spaces use 1 cm;
new imperial spaces store 2.54 cm and present it as 1 inch. The historical
5 cm value remains the read fallback for missing or invalid legacy data, not a
creation default, and existing spaces are never migrated merely by opening
settings.

A finer grid changes precision only. Raw SVG constants inherited from the
historical 5 cm renderer are **visual units** and use
`gridVisualScale(cell_cm) = 5 / cell_cm`. Physical sizes already converted from
centimetres, screen-fixed strokes/handles, plan-relative icon sizes and the
grid pitch must not receive that factor again. Full, static and hidden
isometric renderers share this classification.

### Persisted coordinate canonicalisation

Every current config/layout write removes IEEE-754 representation tails from
the explicit persisted-coordinate allow-list. A value less than `1e-4` of one
grid step from a `1/240` node becomes the exact same `k / 240` double in Python
and TypeScript. A farther off-grid or diagonal value stays where the editor put
it and receives only the existing nine-decimal storage canonicalisation.
Negative zero becomes positive zero.

The lattice allow-list covers room outlines/extents, exact wall endpoints,
opening `x/y`, decor origins/sizes/endpoints, drafts, partitions, columns, open
spans and layout `x/y`. Angles, opening length/host `t`, decor scale and
backdrop transforms retain the nine-decimal scalar contract. The traversal
deliberately excludes `cell_cm`, `plan_aspect`, `view_box`,
physical centimetre fields, colours/opacities/live values, presentation scales
and vacuum affine calibration. Unknown/future numeric fields round-trip
unchanged.

Schema validation is the public door; the common config/layout storage helpers
repeat the same idempotent operation for internal import, maintenance and
startup-recovery writers. A canonical read/write echo is a no-op: optimistic
locking is still checked, but the revision, update event and maintenance Undo
snapshot do not move. Existing stores are not rewritten on read; Optimize Plans
remains the explicit bulk-cleanup path.

## Model

| Concept | Before | Now |
| --- | --- | --- |
| Canvas | square `0..1`, rendered `0..1000` | unbounded plane, same units |
| `space.view_box` | the frame; everything was clamped into it | an OPTIONAL hint for the very first frame; used only when there is nothing to frame |
| "fit" rectangle | `view_box` (or the content bbox in view mode) | always the **content frame** (§4) |
| Zoom out floor | `ZOOM_MIN = 0.4` (fraction of `view_box`) | 3x the content frame (`MIN_ZOOM = 1/3`) |
| Pan bounds | content must cover the scene, and only above 100% zoom | content frame + one screen of slack in each direction, at any zoom |
| Icon size | % of `view_box`, i.e. grew with zoom | % of `iconUnit` — still grows with zoom (§6) |
| Validation range | `+/-4` | `+/-5000` (§3) |

### Render frame vs. view

* **Frame** (`_baseVb()` / `spaceFrame()`) — the rectangle that "fit to
  screen" fits and that zoom `1` means. It is recomputed from content,
  never stored.
* **View** (`_view`) — the SVG `viewBox` actually painted. It is in
  absolute render units, so recomputing the frame never teleports the
  plan; it only changes what zoom `100 %` means and where panning
  stops.

### View/editor camera handoff

Entering or leaving an editor does not clear `_view` and wait for a later fit.
The current view is expressed as a world-space centre plus screen
pixels-per-unit. `ModeTransitionController` interpolates that representation
together with the measured stage width/height, and derives a correctly
aspect-matched viewBox on every frame. The editor may use its own working zoom,
but View restores the saved same-space centre and zoom on exit; editor zoom is
never written to View persistence. A zero-sized or reduced-motion path commits
the exact target atomically without exposing a default-fit frame.

## §3 Validation limits

`custom_components/houseplan/validation.py`:

| Symbol | Before | Now | What it is |
| --- | --- | --- | --- |
| `_COORD` (layout x/y) | `-4 .. 4` | `-5000 .. 5000` | coordinate |
| `_GEOM` (room x/y, poly points, opening x/y, `view_box` origin) | `-4 .. 4` | `-5000 .. 5000` | coordinate |
| `_EXTENT` (room w/h, `view_box` w/h) | `0.001 .. 4` | `0.001 .. 5000` | size — strictly positive |
| `_NORM` (decor x/y/w/h) | `-1 .. 2` | `-5000 .. 5000` | coordinate |
| opening `length` | `0.001 .. 1` | `0.001 .. 5000` | size — strictly positive |

`+/-5000` is **garbage insurance, not a frame**. At the historical compatibility
scale (`cell_cm` = 5, 240 grid cells across the unit width)
one canvas width is ~12 m, so `5000` is ~60 km of plan — unreachable
in a home, while still stopping a stored `1e100` from making the plan
invisible for every client (the failure HP-1500-03 / HP-1501-01
closed). Sizes stay strictly positive because SVG divides by them and
`viewBox="0 0 0 0"` paints nothing (HP-1502-01).

## §4 The content frame

`contentFrame(items, opts)` in `src/space-geometry.ts` — pure, unit
tested. Input is a list of **items**, one per drawn/placed object:

* every room (its own bounding box — polygon or legacy rect);
* the backdrop image rectangle, when the space has one;
* every opening (door/window/gate) end-to-end segment;
* every decor shape;
* every device the layout actually places in this space **and that the card
  actually draws** — a HIDDEN device (docs/FILTERING.md) is not content: the
  frame is presentation, and an object nobody can see must not decide what the
  plan opens on. It keeps its auto-grid cell and every aggregation it feeds;
  it simply is not an item here. Ghosts in the device editor are not items
  either — reaching them is §5's job, not the opening view's.

Output:

```ts
{ core: Rect | null, all: Rect | null, outliers: number }
```

* `core` — bbox of the **main mass**, padded. This is the opening view.
* `all` — bbox of **everything**, padded. This is what "show the far
  objects" fits.
* `outliers` — how many items were left out of `core`.

Both rectangles are padded by `pad` (default `0.05`) of the longer
side, and degenerate axes are inflated (see §4.2).

For a space with a **backdrop image** the image rectangle is one of the
items, so the image still sets the extent — cropping to the rooms would
hide the parts of the picture nobody has outlined yet (owner, point 2).

Fallback order when there are no items at all: the stored `view_box`
(the "hint"), then the legacy unit square. This is the only place
`view_box` is still read for framing.

### §4.1 Outlier rejection

An object standing an order of magnitude further away than the rest
must not decide the opening view, but must still be reachable. The
criterion is deliberately rank-based (medians/percentiles), so a single
absurd value cannot move it:

1. Items whose coordinates fall outside the sane range
   (`+/-CANVAS_LIMIT`, i.e. the same `+/-5000` the backend accepts) are
   dropped outright — that is corruption, not content.
2. With fewer than `MIN_VOTERS = 4` items no outlier is declared:
   with two objects there is no majority to be far from.
3. `m` = component-wise **median** of the item centres.
4. `d_i` = Chebyshev distance `max(|x_i-m_x|, |y_i-m_y|)` from `m`.
5. `spread` = the **75th percentile** of `d`, floored at
   `MIN_SPREAD = 0.05 * NORM_W` (50 render units, about a small room),
   so a tightly clustered plan does not call its own neighbour an
   outlier.
6. Item `i` is an outlier iff `d_i > OUTLIER_K * spread`, with
   `OUTLIER_K = 10` — literally "an order of magnitude further than
   the bulk".
7. **Majority veto**: if more than a third of the items came out as
   outliers, this is not a plan with strays — it is a spread-out plan.
   No outliers are declared and `core = all`.

When `outliers > 0` the card shows an unobtrusive inline hint (no
modal) — "there are objects far from the plan" with a **Show** action
that fits `all`.

Whatever the vote rejects is rejected **everywhere the plan is measured**,
not only in the viewBox: §6's `iconUnit` runs the same vote over the rooms.
One notion of "the plan", or a stray the frame had just thrown out came back
as icons ninety times too big (audit DEV-2C947-03).

### §4.3 The frame in an editor

Inside an editor the frame only ever **grows** (`unionRect` with the previous
one): it bounds pan and defines what zoom 1 means, and a frame that shrank the
instant a room was deleted would move the ground under a live gesture.

That union belongs to the editor session and to nothing else. The memo key
carries the growth flag, so leaving for View recomputes the frame from the
content instead of inheriting the union — otherwise a room dragged five
canvases away in the Plan editor kept View framing the empty ground it had
left behind, until some unrelated model change happened to invalidate the memo
(audit DEV-2C947-02).

### §4.2 Degenerate frames

An SVG `viewBox` with a zero axis paints nothing, so a frame still has
a floor:

* an axis shorter than `DEGENERATE = 0.03 * NORM_W` is grown to
  `FLOOR = 0.2 * NORM_W`, centred on itself.

That covers "one lone marker" and "a collinear row of markers". A real
thin shape (a 100-unit corridor) is well above the threshold and keeps
its tight frame. This is the only survivor of the old safety props —
the `-25 % .. 125 %` envelope that used to reject far content is gone,
replaced by §4.1 (the envelope WAS the bug: content past the old square
was silently excluded from the frame).

### §4.4 Static-card house frame

The full `houseplan-card` and the default `houseplan-space-card` continue to
use the canonical content frame above. A static card may explicitly select
`fit: house`. That second frame is structural and static-card-only:

* every sane room and (when visible) complete door/window/gate symbol
  envelope participates; positive/zero walls, independent walls and
  columns participate only while `show_borders` renders them (#384 — hidden
  architecture must not widen the tight frame, mirroring the `hide_openings`
  guard for symbols);
* every structural item is kept — the outlier vote cannot discard a detached
  but valid wing;
* there is no intentional outer padding, but analytic bounds include the
  painted half-strokes and the complete state-independent opening motion;
* backdrop, decor, room labels, devices, badges, Glow and sunlight do not vote.

Excluded auxiliary objects are not hidden; they stay in the same coordinate
system and may be clipped outside the structural frame. With no sane structural
item, the operation falls back atomically to the ordinary content frame. The
shared degenerate-axis floor still applies, so a line-only structure cannot
produce a zero-sized SVG `viewBox`.

## §5 Zoom and pan

* **Zoom in** — unchanged, `ZOOM_MAX = 8`.
* **Zoom out** — `MIN_ZOOM = 1/3`: you can see three times the content
  frame and no further. Empty space beyond that is not information.
* **Discrete camera motion** (#82) — wheel, `−`/`+`, Fit all, the home arrow
  and the free-background double-click/tap in View or kiosk interpolate the
  existing exact camera target for
  160–220 ms with `cubic-bezier(0.2, 0.7, 0.2, 1)`. Zoom is logarithmic and
  the world centre is linear; the final frame is the same clamped `viewBox`
  the immediate path used before #82. Rapid wheel input retargets one RAF from
  the camera actually on screen, accumulates from its pending target and keeps
  the current pointer anchor. It never queues transitions or uses a CSS scale.
  Pinch and pan remain direct 1:1 gestures. Pointerdown freezes the presented
  camera; mode, space, projection, resize, structural adoption, hidden state
  and disconnect cancel or settle it before taking ownership. Reduced motion
  always commits the exact target immediately. View persists only the settled
  target once; editor camera remains session-only.
* **Pan** — available at **every zoom**, in view mode and in every
  editor, and bounded by the content frame inflated by
  `PAN_SLACK = 1.0` of `max(view, frame)` on each side. You can walk
  off the plan (there is no edge), but not into infinity.
  Until 2026-08-04 a drag moved the view only while `zoom > 1`: on the
  old bounded canvas a plan smaller than the scene genuinely had
  nowhere to go, so the gate was harmless. With no edge left it was
  simply a missing feature, and the owner reported it as one
  («таскать план при любом масштабе»). The zoom no longer takes part
  in the decision — `_clampView` alone says how far you may walk.
* **Who owns the pointer.** A drag pans only when it starts on empty
  scene: the room-resize handles, device badges, openings, room labels
  and the decor shapes take the pointer first (`_stagePointerDown`
  bails out on them), and a drawing tool that consumes the press —
  decor line/rect/ellipse/text — bails out too. Two fingers are always
  a pinch, never a pan. On a **kiosk** screen at swipe zoom (`≤ 1`,
  more than one space) a *horizontal* drag belongs to the floor swipe:
  the gesture is classified once, on the first movement past 8 px, and
  keeps that role until the finger lifts (`_panLock`), so the plan
  never slides under a swipe and a vertical drag still pans.
* **Room fit (#152).** A clean primary click/tap on the browser-painted room
  target fits that room's final floor plus its visible boundary wall body into
  the middle 80% of the stage. Devices, openings/actions and the HA Area link
  keep their own gesture; the non-interactive room-label surface maps to the
  same room id. The action uses the existing camera transition controller and
  does not write the per-space zoom preference. Its session-only room intent
  is reapplied atomically on a stable stage resize, then cleared by manual
  camera input, Fit all/home, mode/space/projection changes, structural
  adoption, hidden state or disconnect. In kiosk, room-owned taps never enter
  the free-background double-tap sequence.
* **Free-background fit (#449).** Two clean primary clicks/taps within 350 ms
  on the stage background invoke the same Fit all command in View and kiosk.
  Room, device, vacuum, opening, link and control paths disarm the sequence;
  so do pan, pinch, swipe, long press, cancellation, editor/mode/space/projection
  changes and lifecycle adoption. The new recognizer adds no timer or render on
  the first tap. Mouse, touch and pen sequences are separate; editors do not
  expose this shortcut.
* **The lock is final, at the release too** (audit DEV-1DA1-02). The
  release used to ask `swipeTarget()` again from the raw start→end
  vector, ignoring the lock — so a *curved* gesture (a short vertical
  lead-in that locks `pan`, then a long horizontal sweep) dragged the
  plan under the finger and still landed on another storey when it
  lifted: the worst kind of surprise on a wall tablet. `_panLock ===
  'pan'` now means no floor change, whatever the overall vector ends up
  looking like; only a gesture locked as `swipe` may reach
  `swipeTarget()`, and it never pans on the way. A motionless tap locks
  nothing, so a clean free-background double-tap remains available.
* **"Home is that way" arrow** — when the content frame is entirely
  outside the current view, a small pointer appears at the view edge
  in the frame's direction. Clicking it fits the content. Cheap
  insurance against getting lost in the empty plane.

## §6 Icon size — a percentage of the plan

**Unchanged behaviour** — an icon scales with the plan, exactly as it
always did. (A first cut of the infinite canvas made it a fixed
percentage of the viewport; the owner looked at it on 2026-08-03 and
asked for the original back. The history is kept here because the
reasoning for the *numerator* below is the whole point.)

Before the infinite canvas:

```
--icon-size: iconPct * vb.w / view.w   (cqw)
```

Now (`iconCqw()` in `src/space-geometry.ts`, pure and unit tested):

```
--icon-size: iconPct * iconUnit(space) * kioskScale / view.w   (cqw)
```

Read it in render units: a marker always occupies
`iconPct/100 * iconUnit` **render units** of the plan, whatever the
frame and whatever the zoom. Dividing by the width of the visible view
turns that into the percentage of the container `cqw` means. Zoom in
2x and the marker is 2x bigger, together with the walls it sits on.

**Why the numerator changed.** `vb.w` was the stored `view_box`, and
`view_box` is not a frame any more (§4). Keeping a fixed `NORM_W`
there would have been worse than wrong: on a plan drawn 2 canvases
wide the frame is ~2.2 canvases, so every marker would come out 2.2x
smaller than on an ordinary plan — and 55x smaller on a plan 50
canvases out, i.e. an invisible dot. `iconUnit(space) =
max(NORM_W, mainMassOfTheRooms)` — the extent of the rooms **after the same
outlier vote §4.1 applies to the frame** (rooms only, so the full card and the
static card cannot drift apart), and it is:

* **exactly `NORM_W` for every plan that fits the old square**, and the
  editor has only ever stored `view_box: [0,0,1,1]`, so `iconUnit ===
  vb.w` there and the rendered pixel size is bit-identical to the
  pre-canvas card (verified against the v1.56.0 bundle at a fixed view:
  `3.400 / 3.091 / 6.182 / 12.364 cqw`, i.e. `28.52 / 26.11 / 50.22 /
  98.44 px`, both bundles);
* **proportional to an outsized plan**, so a runaway plan gets markers
  of the same apparent size as an ordinary one.

Everything else is untouched: the per-device multiplier `marker.size`
and the kiosk icon/font scales still feed `--dev-size`, and every
satellite (badges, LQI chips, presence rings, ripples) still derives
from `--dev-size`. The full card and the static
`houseplan-space-card` call the same `iconCqw()` — the static card has
no zoom, but its frame is the content now, so a bare `iconPct` would
have made its markers shrink as the frame tightened.

**Auto-placement spacing** (`defaultPositions` -> `declump`) is measured
in render units and uses the same `iconUnit`, so the icon's footprint
and the distance markers are pushed apart by can never drift apart — and
the outlier vote reaches the spacing through the very same call.

## §7 Adaptive grid

The drawing grid is a dot pattern at `pitch = NORM_W / GRID_N`. On a
plan several canvases wide, zoomed out, the dots merged into a grey
wash. `gridLevels(pitch, pxPerUnit, minPx)` (pure, unit tested) picks:

* `fine` — the smallest multiplier from `1, 2, 5, 10, 20, 50, 100,
  200, 500, 1000` whose on-screen step is at least `minPx` (7 px);
  finer dots are simply not drawn;
* `coarse` — the next multiplier that is at least `5 x fine`, drawn
  bigger/darker, so the eye keeps a scale reference (the usual CAD
  every-5th/10th-line convention);
* `null` when even the coarsest step would be sub-pixel — then there
  is no grid at all rather than a grey fog.

The grid rectangle also follows the **view**, not the old `view_box`,
so it is there wherever you pan.

The dots are a **hint, not content** (owner 2026-08-04): at full strength
they argued with the plan on white paper. `.griddot` is `opacity: 0.35`,
`.griddot.major` `opacity: 0.5` (styles.ts) — both muted, the CAD
hierarchy kept, coarse nodes still denser than fine ones. The grid lives
in the editors only; View never draws it (`smoke_grid_fade`).

## §8 Toolbar

The middle button of the zoom control was "Reset zoom" (`_resetZoom`,
disabled at zoom 1). It **is** the fit-everything action, so it was
re-labelled rather than duplicated: `title.zoom_fit` — "Fit all" /
«Вписать всё», icon unchanged (`mdi:fit-to-page-outline`), and it is no
longer disabled at zoom 1 (at zoom 1 off-centre it still has work to
do). It fits `core` — the same rectangle the plan opens with. Far
objects are reached through the outlier hint's **Show** action, which
fits `all`.

## §9 Drag limits and the snap contract (dev, DEV-B58)

### 9.1 One bound, and it is the backend's

v1.57.0 freed the FRAME and the DRAWING, but not the drag handlers. Two
of them still clamped, and the owner and a user hit both:

| Handler | Old clamp | Effect |
| --- | --- | --- |
| `_pointerMove` (device marker) | `_baseVb()` ± a 0.8 % inset — the CONTENT FRAME | a marker could never be dragged past the outline of what was already drawn, so a plan could not be extended by putting a device where the next room was going to be |
| `_labelMove` (room label) | `_spaceModel().vb` — the space's STORED `view_box` | worse: that is `[0,0,1,1]` for every plan the card has ever written, i.e. literally the old square. A room drawn at 2.5 had a name that could not reach its own room |
| `_decorCommitDraft` / decor text anchor | *none at all* | asymmetric with `_decorMoveUpdate`, which did clamp — a draft could be born outside the range the mover then refused to leave |

The rule now: **an editor gesture has exactly one bound, `±CANVAS_LIMIT`
(±5000 normalised, ±`SANE_LIMIT` in render units), and it is the same
number `validation.py` enforces.** It is a garbage limit — insurance
against a stored `1e100` — and never a frame. `clampCanvasR` /
`clampCanvasN` (`space-geometry.ts`) are the only two functions that may
impose it, and `_snap()` applies `clampCanvasR` on the way out, so every
gesture that goes through the snap is bounded by construction.

Room drawing, split, resize and opening placement had no clamp before
and still have none of their own — they inherit it from `_snap()` /
`clampCanvasN` at the write.

### 9.2 The grid step never changed

`_gridPitch = NORM_W / GRID_N = 1000 / 240`. Both constants; neither
depends on the content frame, the view, the zoom, `view_box`, or
`cell_cm`. `git log -S` confirms neither has been touched since v1.4.0
(the one historical change, `GRID_N` 120 → 240, halved the step, so the
old nodes stayed a subset of the new ones and every position was
preserved).

**So the infinite canvas did NOT move any existing element off the
grid.** `gridLevels()` (§7) chooses which multiples of that pitch are
still legible at the current zoom — it changes what is DRAWN, never what
is SNAPPED TO. An element that looks off-grid is off-grid because it was
placed by something that never snapped, not because the lattice moved.

### 9.3 What snaps, and to what

Two kinds of element, because a door rounded to a grid node while its
wall runs diagonally is broken geometry, not a tidy plan:

**GRID-BOUND — rounded to the nearest node:**

| Element | Where |
| --- | --- |
| the backdrop picture: move (its top-left corner) and proportional/independent corner scale | `_bdMove` → `_snap` / `snapToGrid` (docs/BACKDROP.md) |
| room vertices (draw tool) | `_markupClick` → `_snap` |
| split tool's interior vertices | `_splitClick` → `_snap` |
| fixed-topology room-wall resize | `_rszMove` → `_snap`; the last safe node before a corner/opening/third room wins |
| decor draft endpoints, text anchor | `_decorPointerDown` / `_stagePointerMove` → `_snap` |
| decor move | `_decorMoveUpdate` → `_snap` of the resulting ANCHOR |
| device markers | `_savePos` |
| room labels | `_labelMove` → `_savePos` |
| auto-placed markers (`defaultPositions`), the `spaceCenter` fallback, an undragged room label | `snapPt` |

**WALL-BOUND — projected onto the wall, then the offset ALONG the wall
quantised to the same step, measured from the wall's first corner:**

| Element | Where |
| --- | --- |
| openings, placed and dragged | `snapToWall(..., { step, length })` |
| split tool's points ON a wall | `snapPointAlongPoly` |

The Walls tool adds one architectural resolver before the free grid fallback.
Within a 12 CSS-pixel hit zone, exact endpoints win over wall axes. Two distinct
endpoints that are less than the live 8 CSS-pixel distinguishability threshold
apart produce an explicit ambiguous result: the segment is not committed and
the user is asked to zoom. Exact coincident endpoints are still one node. The
active thick rubber-band always paints its centreline and final node above the
body; an active snap marker replaces, rather than duplicates, that final node.

After architectural snapping, a Walls segment within `0.25°` of a horizontal
or vertical axis is made exact by moving only its free endpoint (#290). Hover,
the active marker and click consume that same point. A nearby saved endpoint
which would require the forbidden one-step slope therefore loses snap
ownership instead of being joined invisibly. Shift-selected 45° rays and true
diagonals outside the shared tolerance are unchanged.

On an axis-aligned wall whose corners are on the grid — every wall the
editor itself draws — the two rules give the same point. An opening is
also kept inside its wall by half its own length.

Three things were fixed here besides the new coverage:

* `_decorMoveUpdate` used to snap the **delta**, which preserves any
  off-grid offset the shape already had for ever, one step at a time.
  It snaps the resulting anchor now, so one drag is enough.
* `defaultPositions` / `labelPos` / the `spaceCenter` fallback placed
  auto elements at centroids, which are not nodes for an odd-sized or
  polygonal room. These were the most likely source of "some elements
  are between the points" on an untouched plan.
* `snapToGrid` and `snapR` now return a value that is already on a node
  **bit-identical**. The round trip through a non-dyadic pitch
  (1000/240) otherwise turns an exact `500` into `500.00000000000006`,
  and "is this on the grid?" starts answering no.

### 9.4 Shift

There is no free-position mode. `Shift` never suspends coordinate
snapping. For a Walls segment with an anchor it selects the nearest 45° ray:
an endpoint is accepted only when it lies on that ray, and a wall-axis hit is
the exact forward ray/solid-segment intersection inside the pointer hit zone.
An incompatible ordinary snap is ignored; only then does the nearest grid node
on the ray become the fallback. The green angle badge uses the actual vector
(horizontal, vertical or `|dx| = |dy|`), so 89.9°/90.1° are not advertised as
exact. For other tools Shift modifies only the current gesture: square/circle creation,
independent ordinary-decor resize axes, free ordinary-decor/backdrop rotation,
the compass step, or bypassing the furniture wall magnet while the ordinary
decor/room/grid magnet remains active. Furniture resize is the explicit
exception to positional quantisation: it is continuous in both modes, with
Shift selecting independent axes, while Shift on its rotation handle snaps to
45°. Furniture placement and movement remain grid-bound.

### 9.5 «Оптимизировать планы» — explicit whole-plan maintenance

Existing and imported plans may still hold coordinates between the
nodes. New editor operations cannot create more. General settings contain
a **Plan maintenance** group whose action previews and then repairs old
data through all current passes: model upgrades, mandatory grid
alignment, exact open-span canonicalisation and wall-interval compaction.
Unlike live snapping, the explicit maintenance pass also replaces a stored
coordinate which is only one or several ULPs away from its node with the exact
computed node. That has no visible displacement but removes topology noise at
its persisted source.

Why an action rather than a silent migration:

1. It moves the user's data without asking. A house plan is a drawing;
   the card has no mandate to redraw it on a version bump.
2. A silent migration is unattributable. When a room looks 3 cm wrong
   the owner cannot tell whether the card did it or they did.
3. An update that touches stored geometry cannot be rolled back by
   downgrading the card. The explicit action has a one-deep snapshot and
   can also simply not be pressed.

`optimizePlans(config, layout)` (`src/plan-optimizer.ts`) is the pure
orchestrator. It converts legacy fields with an exact mapping, projects
`open_spans` (or the `open_to` fallback) into stable zero-thickness wall atoms,
calls the grid projection, rekeys exact wall endpoints onto moved rooms,
compacts consecutive atoms only when thickness and physical ownership both
match, and stamps `model_version`. Outer/shared transitions and changes of
shared-room pair remain exact breakpoints even at equal thickness. Unknown
fields are preserved and every pass is idempotent.

The explicit pass also repairs pre-existing near-axis room walls, saved wall
chains and independent walls after ordinary grid alignment (#290). Coincident
room-owner copies count as one physical wall and move as one endpoint
equivalence class. The preview reports the unique count, maximum physical
movement and unsafe skipped candidates; only Confirm writes, and Undo restores
the prior geometry. Exact axes and true diagonals are not candidates.

The optimizer deliberately does **not** alter backdrop calibration or saved
view boxes, deduplicate markers, or delete files. It may delete an unattached
layout entry only after classifying its owner against current rooms, marker
tombstones and an authoritative HA device/entity roster. Proven-absent room
labels, devices and group markers are cleaned; live owners are preserved unless
the administrator explicitly opts into removing their old positions, and an
incomplete registry or unknown namespace always fails closed. The cleanup is
part of the pure candidate, Undo and idempotence contract. File collection
remains the backend's reference-aware scheduled job.

`alignAllToGrid(spaces, layout)` (`src/align-grid.ts`) is pure: it
copies its input, never mutates it, and returns the new spaces, the new
layout and the report. The dialog therefore measures and commits the
**same object** — the numbers it promises cannot differ from what it
does. The resulting config+layout pair is sent to
`houseplan/plan/optimize`; the backend persists a durable intent before
either store changes, commits both revisions, and retains one snapshot.
`houseplan/plan/optimize_undo` restores it only while neither revision
has changed since the optimization. A crash between store writes is
completed from the intent on the next integration setup.

The grid pass deliberately excludes the complete transform of `furniture` and
uploaded `image` decor. Their position, size and rotation are continuously
authored values (#383), so changing even one of those fields would make
Optimize create debt from a normal editor operation. Other decor kinds and
storage-level numeric canonicalization keep their existing grid contract
(#477).

The pair returned by `optimizePlans` passes the same lattice-aware boundary as
the storage writers **before** visible Align and before `changed` is computed.
This boundary is required because the normalized grid step `1 / 240` has no
finite decimal representation: an exact node and a nine-decimal JSON echo may
be visually identical but not `===`. Update-event reload and a cold read
therefore receive exactly the pair retained by the preview, and a second run
cannot manufacture fresh coordinate noise (#248, #291).

Model v8 adds a second, identity-preserving stage at this write boundary
(#282). `materializeWallSegmentModel()` atomizes canonical room contours into
`wall_segments[]`, keeps the deterministic parent ID on one split child, emits
UUIDs only for genuinely new v8 atoms, and refreshes `rooms[].wall_ids[]`,
draft IDs and tagged opening hosts together. The historical `walls[]` entries
are regenerated from this catalog as a compatibility view. Reading or fitting
the canvas never runs this migration; only physical edits, Optimize and a
v7-to-v8 import may materialise it. Failure keeps the previous view, history
and persisted revision intact.

Guarantees are covered by `test/align-grid.test.mjs` and the orchestration/
idempotence case in `test/plan-optimizer.test.mjs`:

* every grid-bound element ends on a node; a rect's FAR corner too (a
  snapped *size* on an off-grid origin leaves the other side between
  the nodes);
* an opening ends on its wall, at whole steps along it, inside it, and
  **with the wall's own angle** — the angle is written, so it is part of
  the diff (AUD-158B1-02: an opening already on its wall with a wrong
  angle used to be returned changed inside `changed: false`, which made
  it unfixable);
* a stray opening with no wall within 6 steps is left exactly where it
  is rather than teleported;
* **idempotent across storage**: a second run in memory, after the lattice-aware
  writer round-trip, after update-event reload or after a cold read reports
  `moved: 0`, `changed: false`, and `latticeCoordinatesCanonicalized: 0`, and returns
  objects deep-equal to the first persisted result;
* the report is an **upper bound**, not a sample (AUD-158B1-01).

Before a changed preview can expose Apply, `checkOptimizeGeometry(config)`
(`src/plan-geometry-preflight.ts`) runs the exact candidate through the shared
production input projection and canonical wall/floor boolean builders for every
space. `failed-core`, `degraded-extra` or an exception is a structural failure;
an empty successful geometry and an empty/image-only space are not. One failure
blocks the whole operation and the endpoint is not called. The dialog retains
only bounded statuses plus `contentFingerprint(candidate.config)`: unchanged
Apply reuses that result, while a changed fingerprint is checked again and
fails closed.
This frontend barrier does not replace backend permission, schema, revision or
crash-recovery checks and is not a security attestation from an untrusted
client.

The same projection has a one-space transaction entry point for ordinary
physical edits (#278). Room/wall/open-span/opening/partition/column
candidates are validated before entering Undo or the save queue. A physical
fingerprint is rechecked immediately before the deferred config write; failure
restores the saved geometry and produces no WebSocket call. Presentation-only
edits deliberately do not invoke this barrier, so a legacy degraded plan can
still be renamed, exported and inspected.

### The report is a promise

The confirmation is the decision gate in front of a geometry rewrite, so
`maxShift`/`maxShiftCm` must never be smaller than what the run does:

* displacement is measured on the geometry **actually written back** —
  all FOUR corners of a rect, minimum-size correction included. The two
  corners nobody used to measure are exactly the two that can be worst:
  they carry the X error of one side together with the Y error of the
  other, which is √2 of either;
* an opening is measured on its **ends**, flip-invariantly, so turning
  it in place costs what it really costs and a 180° rewrite costs
  nothing;
* the maximum is accumulated in **centimetres**, each space through its
  own `cell_cm`, and the report names the space it belongs to. One
  normalised maximum converted through the *first* space's cell size
  promised 2.5 cm for a vertex that moved 50 cm on a 100 cm floor;
* the dialog rounds the last tenth **up** and, on a multi-space plan,
  says which space the maximum is in; openings corrected in angle alone
  are counted on a line of their own.

`latticeCoordinatesCanonicalized` counts individual near-node coordinate
components actually rewritten by the storage boundary. Its maximum is measured
in each value's own `cell_cm`, displayed with three significant digits and kept
separate from visible `moved/maxShift*`. Only touched spaces receive a detail
line; each line also states how many authored off-grid components were observed
and left unchanged. Layout values without a named space contribute only to the
summary. The older `coordsCanonicalized` remains an internal Align counter and
does not absorb this storage-only work.

One undo is available until the next config or layout edit. It restores
the stored snapshot; re-running optimization itself is never treated as
undo because a grid projection is not invertible.

## Every place that assumed the unit square


| Place | Assumption | Decision |
| --- | --- | --- |
| `contentBounds` envelope `-25 %..125 %` | content outside the square does not count | **removed** — replaced by §4.1 outlier rejection |
| `_baseVb()` `if (mode !== 'view') return m.vb` | editors need the whole square to have room to draw | **removed** — the content frame plus §5 pan slack and 3x zoom-out gives more room than the square ever did |
| `_baseVb()` `if (m.bg) return m.vb` | image plans frame on the square | image rect is now just one content item (§4) |
| `--icon-size` scaled by `vb.w / view.w` | the canvas is what an icon is a fraction OF | numerator becomes `iconUnit()`; the icon still scales with the plan (§6) |
| `defaultPositions` `minDist` from `NORM_W` | one canvas = one plan | `iconUnit()` (§6) |
| `markerPos` / `_pos` fallback = `view_box` centre | a device with no position belongs in the middle of the square | `spaceCenter()` — the middle of the content |
| grid `<rect>` over `vb` | the grid ends with the square | rect follows the view (§7) |
| grid pitch fixed | fine at 1 canvas wide | `gridLevels()` (§7) |
| `_clampView` pinned content over the scene | you cannot pan past the edge | §5 pan slack |
| `_stagePointerMove` panned only while `zoom > 1` | below 100% the content already covered the scene, so a drag had nowhere to go | **removed** — §5, panning at every zoom |
| `ZOOM_MIN = 0.4` | fraction of the square | `MIN_ZOOM = 1/3` of the content frame (§5) |
| `_decorMoveUpdate` clamp `-0.25 .. 1.25` | decor may hang a quarter past the edge | clamp widened to the sane range (`+/-CANVAS_LIMIT`) — corruption insurance, not a frame |
| `_pointerMove` clamp to `_baseVb()`, `_labelMove` clamp to `view_box` | a marker/label belongs inside the canvas | **removed** — §9.1; missed in v1.57.0 and reported by the owner |
| static card `aspect-ratio` + `viewBox` from `space.vb` | the static card frames the square | `spaceFrame()` — same content frame as the full card |
| `validation.py` `+/-4`, `_EXTENT <= 4`, decor `-1..2`, opening `length <= 1` | the square plus slack | §3 |
| `safeViewBox` fallback `[0,0,1,1]` | a broken `view_box` means the square | kept — it is only the last-resort hint (§4) |
| `fitInSquare` (image placement) | image is centred in the square | **kept** — it defines the image's own rectangle in canvas units, which is exactly what §4 wants as a content item. It is only the DEFAULT placement: `planRect()` adds `plan_x/y`, per-axis scale and angle on top (with legacy `plan_scale` as fallback), and the transformed corners are what §4 counts (docs/BACKDROP.md) |
| image plan papers the image rect | the picture IS the sheet | **removed** in v1.58.0 — the opaque paper is the room contours in every case, and the picture is drawn on top of it (docs/BACKDROP.md §3) |
| `_spaceH` / `_decorH` = `NORM_W` | the canvas is square | **kept** — this is the coordinate system's aspect, not a frame |
| `_gridPitch = NORM_W / GRID_N` | grid pitch is tied to the canvas unit | **kept** — the pitch is the real-world cell (`cell_cm`), it must not change with the plan's size |
| sun wedges / glow radii / resize maths | all in render units, relative to their own geometry | **unaffected** — verified: no `NORM_W`-relative constants |

## What is deliberately NOT done

* No new stored field. The frame is derived every time; there is
  nothing to migrate, nothing to keep in sync, nothing to corrupt.
* `view_box` is still WRITTEN as `[0,0,1,1]` on space creation and is
  still required by the schema — removing a required field is a
  breaking storage change for old clients and buys nothing.
* The outlier hint has no "hide this object" action. Deciding what to
  do with a stray marker is the device editor's job.

## Independent wall geometry

`partitions[].a/b` and `wall_columns[].center` use the
same normalized-X coordinate convention as `room.poly`; both axes are divided
by `NORM_W`. Every interactive write passes through the global grid snap and
the ±`CANVAS_LIMIT` guard. Rigid partition drag clamps one shared delta against
both endpoints, so it cannot deform the segment or let its far endpoint cross
the backend boundary. Hit areas and drag thresholds are expressed in CSS
pixels, therefore selection remains usable at every zoom.

## Architectural connection overlay

When **Walls** is active in the Plan editor, a derived
pointer-transparent SVG layer exposes the centre axes of completed room walls
and independent partitions. It is painted after their
physical wall bodies, but before interactive editor chrome. Columns, decor,
devices, the active wall chain and its live preview are not candidates. Door,
window, gate and intentionally open-span intervals are cut from presentation
axes; a cut boundary does not become a new endpoint.

The layer and hit resolver share one immutable geometry snapshot. Original
segment endpoints are deduplicated and drawn at a physical radius of 5 cm.
Inside a 12 CSS px hit zone, an endpoint wins over every line and grows to
10 cm. Otherwise the nearest solid line receives one 10 cm dynamic node: the
raw pointer is projected onto that line, then quantized by the grid step along
the line from its stable start. This keeps diagonal connections wall-bound even
when neither resulting coordinate is a global grid multiple. The same resolver
runs again on click, so hover is only a preview and never authoritative.

Endpoint and line candidates override the normal grid and Shift/45° result.
Outside the hit zone, §9.3–9.4 remain unchanged. A line connection adds only the
new segment endpoint; it does not split or rewrite the existing wall. The
current anchor is excluded to prevent zero-length segments. The static geometry
is cached by structural editor state; pointer movement changes at most the
single active candidate and never writes config, layout or storage.

A separate diagnostic projection is present throughout the Plan editor (#296),
including tools other than **Walls**. For every independent wall
segment with a positive exact collinear overlap against another wall, it keeps
that source segment's complete axis and original endpoints visible. It is
painted after every wall body and zero-thickness axis and before openings, selection
chrome and transient previews. The layer is `pointer-events:none`,
`aria-hidden`, absent from View and cached by structural revision; it neither
deduplicates source identities nor participates in the architectural snap
resolver above. The 1 CSS px non-scaling axis and physical 5 cm nodes therefore
diagnose an otherwise invisible Resize blocker without changing any hit target.

## Planar wall faces

Every completed Walls segment is persisted immediately as an ordinary
`partition`; only its ordered chain membership remains in memory. On the click
path only, an immutable planar graph is built from structural room edges and
partitions both before and after the latest segment. Unlike the
presentation/snap snapshot, this
face graph ignores door/window/gate/passage cuts; zero-thickness wall axes remain
structural graph edges even though they have no masonry body.
Endpoint, T, X and
collinear-overlap junctions atomize that computed graph without rewriting any
saved wall. A deterministic half-edge walk extracts bounded faces; canonical
identity ignores winding, cyclic start and derived collinear subdivision.

Only faces added by the latest segment and containing one of its atoms are
offered. They are ordered by area and then canonical key. Existing exact or
partially overlapping rooms are excluded, nested rooms remain legal, and any
physical gap created by an `open_span` or absent wall remains a gap. A door,
window, gate or passage is a property of a wall and preserves connectivity. A clean divider across
one room reuses the Split contract: the larger side keeps the room identity,
metadata and device binding, and only the smaller side is offered.

The terminal active path remains session-local while the resulting room dialogs
are open. Create/Keep-as-walls answers are buffered; Cancel/Esc discards all
answers and leaves the already persisted partitions unchanged. The final answer
revalidates the whole batch and applies accepted rooms while consuming only the
coincident partitions used by those rooms in one history/config transaction.
Graph construction never runs on pointermove, Home Assistant state updates or
ordinary rendering.
