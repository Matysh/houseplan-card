# Stairs

Stairs are plan-level navigation objects. They show the physical place and
direction of an ascent on one space and can link that space to one other House
Plan space. The link is deliberately one-way: adding or editing a stair never
creates or changes anything on the target floor.

## User contract

The Plan editor has one **Stairs** group with **Straight** and **Spiral** tools.
Stairs are drawn like decor shapes (#676): press on the plan, drag and release.
The dominant drag axis is the rise axis, the ascent points from the press to
the release ("draw from the bottom up"), the sizes are the drawn extents (never
below one 30 cm tread) and the angle is 0°, 90°, 180° or 270°; equal extents
prefer the horizontal. A spiral stair takes the square of the drag, anchored at
the press. A drag shorter than one grid cell is a click and places the default
size (240 × 100 cm straight, R 90 cm spiral) at the press. The new stair stays
selected and the tool remains armed; `Esc` during the drag discards the draft.

The selected stair shows the same frame as furniture in the decor editor,
painted above wall bodies: a dashed outline, four corner and four side handles
(a spiral stair has four handles on its axis tangents), a stem with the
rotation handle above the local top side. Handle hit areas are finger-sized on
screen at every zoom. The cursor over a handle follows the handle's world
direction — `ew`/`ns` when it moves along an axis, a diagonal arrow otherwise —
and the rotation handle shows the circular cursor. Drag the body to move, a
handle to resize about the opposite side or corner (sizes stop at 30 cm and a
pointer dragged past the anchor never mirrors the stair; `Shift` keeps the
proportions), and the upper handle to rotate. Resizing never changes the angle.
Rotation is continuous; holding `Shift` snaps to the nearest multiple of 45
degrees. `Esc` cancels an active transform or clears the selection;
Delete/Backspace removes the selected stair; the ordinary Plan Undo/Redo
history covers create, edit, move, resize, rotate and delete. The click a
browser synthesizes after a gesture never reaches the plan tool: it places no
copy under Stairs and keeps the selection under Select. Under any other plan
tool the frame is not rendered at all.

Double click opens properties. A straight stair stores positive length and
width; a spiral stair stores a positive radius. The fields accept 30–10000 cm
(inches when Home Assistant is imperial); a field left untouched keeps the
stored number bit for bit, and saving without changes writes nothing. The
dialog also selects the rise direction, rotation, two colour/opacity pairs
(all linework; full-footprint fill) and an optional target space. A new stair
snapshots the current main decor colour for its outline, treads, trapezoid and
arrow; its full rectangle/circle fill starts completely transparent. The
colours then belong to that stair and do not follow later default-decor changes.
For a straight stair the choices are **Up** and **Down**. They flip only the
100%/80% trapezoid; the arrow always points along the canonical local axis, so
turn the whole stair to point the arrow elsewhere.
A target cannot be the current space. A missing, self or deleted target leaves
the stair visible and editable but shows a repair warning and makes View
activation a no-op.

In View, hovering a stair with a mouse shows the card tooltip "Go to floor
<title>" when — and only when — the stair is a valid link (`active` target
state); a missing, self, deleted or fixed-floor target shows no tooltip.

In an ordinary multi-space card, a clean click/tap or keyboard activation on a
valid stair switches to the target tab and restores that floor's remembered
camera. A focused stair link draws no focus indicator — neither the browser's
ring nor an outline of its own (owner's decision, #686); it stays in the Tab
order, and Enter or Space still follow it. Pan, pinch, long press, swipe and pointer cancellation do not navigate.
In a card configured with `floor`, stairs are visible but inert. The target
floor receives no automatic stair, highlight or camera centring.

## Geometry and drawing

Both variants use the same continuous transform contract as furniture: their
authored position, size and angle are not grid-quantised on save or by
**Optimize plans**. The wall magnet works per side (#676): a side of the box
(a tangent of the circle) that is parallel to a visible physical wall face
within 5° and within six grid cells of it lands flush on that face. While
moving, the nearest such side wins and a straight stair turns by at most 5° to
become exactly parallel — a stair standing end-on to a wall snaps with its end
and keeps its angle. While resizing or drawing, only the dragged sides snap
and the angle never changes. Room faces are one-sided; the exposed faces of
partitions and columns are derived from the body's winding, so a stair
straddling a thin wall never snaps to the face hidden inside the masonry. Any
straight/circular pair of stairs can snap footprint-to-footprint. The other
stair is never modified or linked by the magnet.

The straight symbol contains a centred full-length trapezoid. Its wide base is
100% of the stair width and its narrow base is 80%, with symmetric 10% side
insets. **Up** widens toward the arrow tip; **Down** narrows toward it. Treads
end on the trapezoid sides and never enter the side strips. The full physical
length is divided into an integer number of equal intervals whose size is
closest to 30 cm (a tie chooses the larger count), so there is no remainder.
Spiral stairs similarly divide the complete travel-line circumference at two
thirds of the radius into equal sectors closest to 30 cm. Their direction is
clockwise or counter-clockwise when viewed from above. The arrow always means
physical ascent, not the direction of navigation between named tabs.

The footprint overlap is removed from clean room floor area exactly once. It
does not cut the visible floor, change room or wall geometry, create a light
occluder, affect Glow/sun/vacuum, or participate in Optimize. In 2.5D the first
version remains a flat symbol projected with the floor/decor plane; it has no
height, risers, railings or shadows.

## Persisted model

Each space may contain `stairs: []`, bounded to 250 valid records:

```json
{
  "id": "stair-main",
  "kind": "straight",
  "x": 0.42,
  "y": 0.55,
  "angle": 90,
  "length": 0.24,
  "width": 0.10,
  "direction": "forward",
  "target_space_id": "floor-2",
  "color": "#607d8b",
  "opacity": 1,
  "fill_color": "#607d8b",
  "fill_opacity": 0
}
```

`kind:"spiral"` replaces `length`/`width` with `radius` and uses direction
`clockwise` or `counterclockwise`. Coordinates and sizes use the normalized
plan coordinate system; physical labels are derived through `cell_cm`.
`target_space_id` is nullable. The four visual fields are optional for backward
compatibility. A legacy record resolves missing fields from the current main
decor colour without being rewritten; its first successful Properties save
materialises the complete visual quartet. Unknown sibling fields survive
validation and round trips for forward compatibility. Full backup/import/export,
one-space transfer, plan-only transfer, diagnostics and support packages
preserve the same records. When a complete backup removes a target space its
incoming stair
links are cleared; a one-space transfer cannot invent an external target.

## Implementation boundary

- `src/stairs.ts` owns validation, drawing geometry and area-subtraction
  primitives.
- `src/stairs-view.ts` is the eager read-only boundary for symbols, guarded
  navigation and touch/pointer gesture suppression.
- `src/stairs-editor-model.ts` keeps the eager-safe helpers the View runtime
  shares (defaults, kind conversion, target state, stair-to-stair magnet);
  `src/stairs-box.ts` owns the editor-only oriented-box transforms —
  drag-to-draw, resize about the anchor, edge magnets, handle bearings and
  cursors, dialog conversion — and is imported only by the lazy editor chunk;
  `src/stairs-editor.ts` owns the lazy Plan UI (gestures, the frame rendered
  by the card in its top overlay, properties).
- `src/clean-floor.ts` and `src/summary-panel-metrics.ts` consume the same
  footprint subtraction for room cards and summary totals; PDF rendering uses
  the same stair outline/tread geometry without changing the room floor paint.
- Backend schemas and transfer/support surfaces treat `stairs` as a bounded,
  additive space collection. Old configs without it remain unchanged.
