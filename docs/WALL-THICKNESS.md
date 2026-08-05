# Wall thickness — the spec

Status: **implemented** (on `dev`). Owner's wording (2026-08-05): «в
редакторе плана появляется режим "толщина стен". В нем кликаем по стене
(стеной считаем грань одной комнаты), там поле ввода толщины в сантиметрах
или дюймах (в зависимости от настроек HA). Ввели — стена начинает
отображаться с толщиной, внутренность стены заштрихована. Толщина не должна
учитываться при расчете площади. Учти изменение отображения проемов в толстых
стенах.»

Code: `src/wall-thickness.ts`, tool + render in `src/houseplan-card.ts`,
static card in `src/space-render.ts`. Unit: `test/wall-thickness.test.mjs`.
Smoke: `demo/smoke_wall_thickness.mjs`.

Written against the code as it stands: rooms are polygons, `roomEdges()`
splits them into segments, `sharedBoundary()` finds where two rooms touch,
openings are anchored to a wall by projection (docs/RESIZE.md §, the
`openingShoulders` contract), the paper sheet follows the room contours
(docs/BACKDROP.md), and area comes from `polygonArea()` on the polygon itself.

## 1. The model: thickness belongs to a WALL, not to a room

A wall is a straight stretch of boundary. Both of the rooms that meet along it
see the same physical wall, so **one wall carries one thickness**, and it can
be entered from either side. The alternative — a thickness per room edge —
produces two parallel slabs with a hairline gap between them whenever the two
numbers differ, and asks the user a question the house does not have an answer
to («какая толщина у этой стены со стороны кухни?»).

### 1.1. Addressing a wall

The hard part. A room's vertex list is not stable: resizing inserts vertices
at T-junctions (docs/RESIZE.md), merging and splitting rewrite polygons
entirely. So an edge **index** is out, and so is a pair of endpoint
coordinates — dragging the wall moves both.

Thickness is stored per space as a list of entries keyed by a **segment key**:
the midpoint and the direction of the wall, normalised (direction taken
modulo 180°, so a wall is the same wall from either end), quantised to the
grid pitch. Lookup matches within a tolerance of half a grid step.

Why this survives what indices do not: dragging a wall in the resize tool
moves it by whole grid steps, and the entry is rewritten by the same operation
that moves the wall — resize already knows which edges it touched, so it
re-keys them in the same transaction. Inserting a T-junction vertex splits one
edge into two collinear ones; both inherit the parent's thickness, because
their midpoints both fall inside the parent's span and the direction is
unchanged.

**Degradation.** If a wall cannot be matched after an edit (a room was
redrawn, merged, or cut), the entry is **dropped silently** on the next write.
Rationale: a thickness pointing at a wall that no longer exists is invisible,
and keeping it would let a config accumulate ghosts that resurface later when
a new wall happens to land on the old key — a surprise worse than losing a
number the user can re-enter in two clicks. Never migrate a stale entry onto
"the nearest collinear wall": that is a guess about the user's intent, and a
wrong guess draws a slab where the user never asked for one.

### 1.2. Storage

Per space: `walls: [{ key, cm }]`, where `key` is the quantised segment key
and `cm` the thickness in centimetres (always centimetres in the config,
regardless of what the user typed — the unit is a display concern). Absent
list, or a wall with no entry, means exactly today's rendering: a line.
Optional everywhere, no migration.

Backend: `cm` bounded to 1…100 (a 1 cm partition and a metre-thick stone wall
are both real; outside that range it is a typo), `key` a bounded string,
list length capped like the other per-space collections.

## 2. Where the thickness goes

- **A shared wall grows symmetrically** — half into each room. Both rooms lose
  the same sliver of drawn floor, which is what a real wall does.
- **An outer wall grows inward.** Outside the house there is nothing to grow
  into: the plan's outline is where the building ends, and pushing the slab
  outwards would move the house's silhouette every time someone corrects a
  number. It also keeps the content frame (docs/CANVAS.md) stable.
- **An open boundary** (a virtual wall, an open zone) has no thickness and the
  tool refuses to set one — it is a hole in the wall by definition.

## 3. Corners

Two thick walls meeting at an angle must join without a gap and without one
overlapping the other. The slab is built as an **offset of the room contour**,
not as independent rectangles per edge: each room produces one inner contour
(its polygon inset by the local half-thickness of every edge), and the wall
body is the ring between the polygon and that inset contour. Corners then
resolve as the intersection of the two inset lines — a mitre — which is what
a mason builds and what every CAD draws.

Two guards, because mitres blow up on sharp angles:

- when the mitre length exceeds a few times the thickness (a very acute
  corner), the joint is **cut** (bevelled) instead — an infinite spike is not
  a wall;
- when neighbouring edges carry different thicknesses, the inset uses each
  edge's own offset and the corner is resolved between the two — a step, which
  is exactly what a thick wall meeting a thin partition looks like.

Verify on: an L-shaped room, an acute corner (30°), a room with one thick and
three thin walls, and an island room inside another room.

## 4. Area, and everything else, stays on the centreline

The user's rule: **thickness must not change the area.** So the polygon
remains the single source of geometric truth. Area, live dimensions during
resize, the room card's m², the wall-length rulers, device auto-layout, room
fills, the sun's wedges and their clipping, glow spilling through openings —
all keep reading the polygon exactly as they do today. Thickness is a
rendering layer on top and must not be consulted by any of them.

One deliberate exception: **the paper sheet follows the OUTER contour** of the
thick walls, not the polygon. Otherwise the scene background shows through the
body of every wall — the sheet would end at the wall's centreline while the
slab is drawn to either side of it. The paper rule from docs/BACKDROP.md
("the sheet is the room contours") is therefore restated as: *the sheet is the
rooms' contours, grown by whatever thickness their walls carry*.

## 5. Openings in a thick wall

An opening is a hole in the wall, not a mark on its centreline. In a wall with
thickness the opening's span is **cut out of the slab across its full depth**,
so the wall body is interrupted and the two rooms see through.

- **Window**: the slab is interrupted; the glass is drawn as a line across the
  full depth of the opening, in the middle of the wall body, with the jambs
  closing the slab on both sides.
- **Door**: the slab is interrupted the same way; the swing arc starts at the
  **inner face** of the wall (the side the door opens into), not at the
  centreline, because that is where the leaf is hinged.
- The opening's own anchoring is unchanged: it still lives on the wall by
  projection, and `openingShoulders` still measures along the centreline.
  Thickness changes only what is drawn.
- A wall thicker than the opening is long is refused by the same anchor logic
  that already protects openings during resize.

## 6. Hatching

The wall body is filled with a diagonal hatch (an SVG pattern), in a colour
derived from the room's border colour so it inherits the user's palette and
the day/night dimming.

The pattern's pitch is fixed in **screen** terms, not in plan units: hatching
that scales with zoom turns into a solid smear when you zoom out and into
stripes a metre wide when you zoom in. Below a threshold — when a wall is only
a few pixels wide on screen — the hatch is replaced by a **solid fill** of the
same colour: at that size a pattern is noise, and the reader only needs to see
that the wall is a body rather than a line.

## 7. The tool

A new tool «Толщина стен» in the plan editor, beside Add / Merge / Split /
Resize / Opening / Open boundary / Delete. In it:

- hovering highlights the wall under the cursor (the whole wall, both rooms'
  view of it, so it is obvious that the number applies to both);
- clicking opens a small input anchored next to the wall — one field, in
  **cm or inches by HA's unit system** (the same path the furniture library
  uses), prefilled with the wall's current thickness;
- an empty field or zero **removes** the thickness and the wall goes back to
  being a line;
- Esc closes without applying, as everywhere else.

**Apply to all walls.** Cheap and obviously wanted — a house is usually built
of two thicknesses, not twelve. The input gets a secondary action «применить
ко всем стенам комнаты»; a plan-wide default is *not* offered, because outer
and inner walls genuinely differ and a single number for the whole space would
be wrong more often than right.

## 8. Hooks and i18n

Per docs/STYLING-HOOKS.md: the wall body carries `data-hp="wall"`, `data-id`
(the segment key) and `data-kind` (`shared` | `outer`). i18n en/ru for the
tool, the field, the units and the "apply to all" action.

## 9. Deliberately not done

- **No thickness on decor lines** — decor is drawing, not construction.
- **No per-side finish** (plaster, insulation layers). One body, one hatch.
- **No automatic thickness from the backdrop image.** Reading wall widths off
  a photographed plan is image analysis, and a wrong guess is worse than a
  blank field.
- **No effect on the sun's light path.** A light shaft is still clipped by the
  room polygon, not by the wall body: the difference is a few centimetres and
  the machinery is shared with three other features.

## 10. Testing notes

Unit (pure): the offset contour (a rectangle inset by half-thickness on every
side; one thick edge among thin ones; an L-shape; an acute corner falling back
to a bevel), the segment key (same key from either end of the wall; a wall
moved by one grid step re-keys; a T-junction split inherits), degradation (a
key with no matching wall is dropped), cm↔normalised conversion through
`cell_cm`.

Backend: `cm` bounds, key length, list cap, and that a space without `walls`
still validates.

Browser (`demo/smoke_wall_thickness.mjs`): the tool exists and highlights a
wall on hover; clicking opens the input; a value draws a hatched body;
**the room's area is unchanged before and after** (read the room card's m²);
an opening in a thick wall interrupts the body across its full depth and the
door's arc starts at the inner face; a shared wall takes the thickness once
and shows it to both rooms; clearing the field restores the line; resizing the
room afterwards keeps the thickness on the moved wall; the paper sheet covers
the wall body (pixel probe at the middle of a thick wall must not be the scene
background).
