# Infinite canvas — the spec (source of truth)

Status: approved by the owner 2026-08-03. Dev-branch feature, **no
release**. Scope decisions final: there is no "plan size" any more, the
canvas is conceptually unbounded, storage does not change, and the
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

## §3 Validation limits

`custom_components/houseplan/validation.py`:

| Symbol | Before | Now | What it is |
| --- | --- | --- | --- |
| `_COORD` (layout x/y) | `-4 .. 4` | `-5000 .. 5000` | coordinate |
| `_GEOM` (room x/y, poly points, opening x/y, `view_box` origin) | `-4 .. 4` | `-5000 .. 5000` | coordinate |
| `_EXTENT` (room w/h, `view_box` w/h) | `0.001 .. 4` | `0.001 .. 5000` | size — strictly positive |
| `_NORM` (decor x/y/w/h) | `-1 .. 2` | `-5000 .. 5000` | coordinate |
| opening `length` | `0.001 .. 1` | `0.001 .. 5000` | size — strictly positive |

`+/-5000` is **garbage insurance, not a frame**. At the product's own
scale (`cell_cm` = 5 by default, 240 grid cells across the unit width)
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
* every opening (door/window) end-to-end segment;
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

## §5 Zoom and pan

* **Zoom in** — unchanged, `ZOOM_MAX = 8`.
* **Zoom out** — `MIN_ZOOM = 1/3`: you can see three times the content
  frame and no further. Empty space beyond that is not information.
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
* **The lock is final, at the release too** (audit DEV-1DA1-02). The
  release used to ask `swipeTarget()` again from the raw start→end
  vector, ignoring the lock — so a *curved* gesture (a short vertical
  lead-in that locks `pan`, then a long horizontal sweep) dragged the
  plan under the finger and still landed on another storey when it
  lifted: the worst kind of surprise on a wall tablet. `_panLock ===
  'pan'` now means no floor change, whatever the overall vector ends up
  looking like; only a gesture locked as `swipe` may reach
  `swipeTarget()`, and it never pans on the way. A motionless tap locks
  nothing, so the double-tap zoom reset is untouched.
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
| static card `aspect-ratio` + `viewBox` from `space.vb` | the static card frames the square | `spaceFrame()` — same content frame as the full card |
| `validation.py` `+/-4`, `_EXTENT <= 4`, decor `-1..2`, opening `length <= 1` | the square plus slack | §3 |
| `safeViewBox` fallback `[0,0,1,1]` | a broken `view_box` means the square | kept — it is only the last-resort hint (§4) |
| `fitInSquare` (image placement) | image is centred in the square | **kept** — it defines the image's own rectangle in canvas units, which is exactly what §4 wants as a content item |
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
