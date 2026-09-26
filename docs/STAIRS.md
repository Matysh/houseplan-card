# Stairs

Stairs are plan-level navigation objects. They show the physical place and
direction of an ascent on one space and can link that space to one other House
Plan space. The link is deliberately one-way: adding or editing a stair never
creates or changes anything on the target floor.

## User contract

The Plan editor has one **Stairs** group with **Straight** and **Spiral** tools.
A click places the chosen default; the object remains selected. Drag moves it,
the visible handles resize it, and the upper handle rotates it. Straight stairs
have corner and one-axis edge handles. A spiral stair remains a circle and has
one radial resize handle. Rotation is continuous; holding `Shift` snaps to the
nearest multiple of 45 degrees. `Esc` cancels an active transform or clears the
selection; Delete/Backspace removes the selected stair; the ordinary Plan
Undo/Redo history covers create, edit, transform and delete.

Double click opens properties. A straight stair stores positive length and
width; a spiral stair stores a positive radius. The dialog also selects the
rise direction, rotation and an optional target space. A target cannot be the
current space. A missing, self or deleted target leaves the stair visible and
editable but shows a repair warning and makes View activation a no-op.

In an ordinary multi-space card, a clean click/tap or keyboard activation on a
valid stair switches to the target tab and restores that floor's remembered
camera. Pan, pinch, long press, swipe and pointer cancellation do not navigate.
In a card configured with `floor`, stairs are visible but inert. The target
floor receives no automatic stair, highlight or camera centring.

## Geometry and drawing

Both variants use the same continuous transform contract as furniture: their
authored position, size and angle are not grid-quantised on save or by
**Optimize plans**. A stair near a wall snaps to the visible physical wall face;
a straight stair also becomes parallel to that face. Any straight/circular pair
of stairs can snap footprint-to-footprint. The other stair is never modified or
linked by the magnet.

Straight tread lines are perpendicular to the rise axis and start at the lower
edge every 30 cm. A remainder shorter than 30 cm stays at the upper edge.
Spiral stairs make one full turn; radial treads use the same 30 cm physical step
measured on the travel line at two thirds of the radius. Their direction is
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
  "target_space_id": "floor-2"
}
```

`kind:"spiral"` replaces `length`/`width` with `radius` and uses direction
`clockwise` or `counterclockwise`. Coordinates and sizes use the normalized
plan coordinate system; physical labels are derived through `cell_cm`.
`target_space_id` is nullable. Unknown sibling fields survive validation and
round trips for forward compatibility. Full backup/import/export, one-space
transfer, plan-only transfer, diagnostics and support packages preserve the
same records. When a complete backup removes a target space its incoming stair
links are cleared; a one-space transfer cannot invent an external target.

## Implementation boundary

- `src/stairs.ts` owns validation, drawing geometry and area-subtraction
  primitives.
- `src/stairs-view.ts` is the eager read-only boundary for symbols, guarded
  navigation and touch/pointer gesture suppression.
- `src/stairs-editor-model.ts` owns pure Plan transforms, target state and
  stair-to-stair magnet math; `src/stairs-editor.ts` owns the lazy Plan UI and
  properties.
- `src/clean-floor.ts` and `src/summary-panel-metrics.ts` consume the same
  footprint subtraction for room cards and summary totals; PDF rendering uses
  the same stair outline/tread geometry without changing the room floor paint.
- Backend schemas and transfer/support surfaces treat `stairs` as a bounded,
  additive space collection. Old configs without it remain unchanged.
