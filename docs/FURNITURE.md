# Furniture library

Status: **implemented and expanded by issues #159 and #383**. The Background editor
stores furniture as ordinary decor:

```text
{ kind: "furniture", symbol, x, y, w, h, color, opacity, width_cm, angle?, flip_h?, flip_v? }
```

`w` and `h` are always positive physical extents. Optional boolean `flip_h`
and `flip_v` mirror the drawing inside that unchanged box; absent flags are
the original orientation. Existing furniture therefore keeps its position,
size, rotation, orientation and styling after an update.

## Library and source

The public library contains **56** top-view symbols:

- 44 designer symbols from `assets/furniture/houseplan-0.3.0/svg/plan`;
- 12 retained built-ins: refrigerator, dishwasher, washer, dryer, air
  conditioner, water heater, shower, sink, stairs, fireplace, plant and rug.

The designer pack also contains 33 front-view category illustrations in
`svg/menu`. Four of them (`computer`, `oven`, `hood`, `exercise`) currently
have no top-view symbol and are intentionally hidden instead of opening an
empty category.

`pack.json` is the source of truth for stable ids, categories, names,
default centimetre dimensions and SVG paths. Run:

```powershell
npm run furniture:generate
npm run furniture:check
```

The generator validates a deliberately small, inert SVG subset and produces:

- `src/furniture-plan-catalog.generated.ts` — ids, groups, categories and
  default sizes; the only part of the pack in the initial View graph;
- `src/furniture-plan-art.generated.ts` — the 44 top-view drawings, a lazy
  chunk (#474) loaded by `src/furniture-art-runtime.ts` when a plan draws a
  designer piece and imported statically by the editor;
- `src/furniture-menu-art.generated.ts` for the lazy editor graph only.

Generated files are never edited manually. The 77 drawings were created by
Sergey Matyunin (`Matysh`) and granted to the project under its MIT License in
[issue #159](https://github.com/Matysh/houseplan-card/issues/159#issuecomment-5454085168).
No separate attribution is required in the interface.

## Palette interaction

Furniture is a two-level non-modal palette in the editor context tray:

1. The first level shows front-view **categories**, grouped as Furniture,
   Appliances, Plumbing and Other.
2. Every category opens a second level, including categories that have only
   one variant.
3. The second level shows the real top-view drawings. Back returns to the
   category list and clears any armed symbol.
4. Picking a variant arms one placement and reveals editable Width and Depth
   in the Home Assistant length unit. With a mouse, moving over the plan shows
   the real top-view symbol at its exact future size, wall magnet, rotation and
   canvas clamp. Editing Width or Depth updates that ghost immediately without
   requiring another pointer move.
5. Clicking the plan places exactly the previewed object and returns to Select.
   Shift keeps the established free-placement behaviour. The ghost is a
   transient, 55%-opaque rendering aid: it is never saved and never enters
   Undo history.
6. Pointer leave, Escape, palette/tool/editor/space changes and remount clear
   the ghost. Unknown or stale symbol ids show and save nothing.

Touch and pen do not emulate hover or show a placement ghost. Their best-effort
editor path saves one object only after a clean tap; movement, pointer cancel
or a second contact cancels that pending stamp so pinch/cancel cannot create
furniture accidentally. View and kiosk touch guarantees remain unchanged.

The properties dialog remains a flat native select, grouped by category. Its
optgroup label includes both the parent group and category because HTML selects
cannot nest optgroups.

## Transform interaction

Selected furniture has four corner and four middle-edge resize handles. Corner
resize is continuous and preserves the original aspect ratio; `Shift` lets
width and depth change independently. A middle handle changes only its local
axis, including on a rotated object. Dragging any handle across the fixed
opposite edge keeps the gesture alive and mirrors the corresponding axis.

Rotation is continuous normally and snaps to the nearest multiple of 45° while
`Shift` is held. The rotation handle uses a circular-arrow cursor. These rules
are furniture-only: other decor and the backdrop keep their existing grid and
modifier contracts.

Properties show signed width/depth. A negative width is horizontal mirror and
a negative depth is vertical mirror; the two adjacent checkboxes are the same
state expressed explicitly. Save stores the absolute extents plus optional
flags. Zero is not a valid saved dimension.

## Rendering contract

Each object is still one visible `<path>` and one erase hit path. In Select,
an additional invisible path follows the same artwork and extends the target
10 physical centimetres beyond each visible stroke edge; empty areas of the
bounding box remain non-interactive. Designer artwork
keeps its native SVG `viewBox`; the renderer applies the user's stored width
and depth with a non-uniform transform. `vector-effect="non-scaling-stroke"`
rejects only that local width/depth distortion in the visible result; the
renderer separately applies the outer plan viewBox scale to the stroke width.
Consequently:

- resizing changes the physical object box without distorting line weight;
- camera zoom changes the visible line weight exactly like other physical
  decor with the same `width_cm`;
- the user's decor colour, opacity and physical line width remain authoritative;
- `data-hp="decor"`, `data-kind="furniture"`, `data-id` and `data-symbol`
  remain stable for card-mod;
- an id unknown to an older card remains valid data and simply renders
  nothing instead of breaking the plan.

The top edge of every drawing is BACK (`y = 0`). Placement and dragging put
BACK on a **physical surface** of a wall, including the local atomic
half-thickness; the invisible centreline is not the contact surface. An outer
wall exposes both its room-facing and exterior surfaces, so raw pointer intent
keeps furniture inside or outside instead of pulling it through the masonry.
On a shared wall the raw pointer side selects the room. A new placement exactly
on an outer-wall axis defaults inside, while an exact-axis drag keeps the
piece's current side. The magnet reach is measured from the selected physical
surface. `Shift` keeps free placement and bypasses the wall magnet. Preview,
commit and drag share the same surface resolver. Furniture is decor:
it has no entity, state, room aggregation, collision model or automatic
binding to later wall edits, and already saved coordinates are never migrated.

## Compatibility and performance

The backend schema additively accepts optional boolean furniture `flip_h` and
`flip_v`; no configuration version or migration is needed. The 18 replacement
ids preserve their identity; the remaining old ids remain available. Default
dimensions change only for a newly picked replacement—an already saved
object's `w` and `h` are never rewritten.

Plan artwork is available in View and kiosk: a plan with designer furniture
requests the artwork chunk once per page before its first frame, and the
first-open veil waits for it; a plan without furniture never requests it.
If the chunk cannot be loaded, designer pieces render as unknown symbols —
nothing — until the page reloads, and a toast says so once; the 12 retained
primitive symbols draw regardless. Front-view menu art is imported
only after the editor runtime is requested. Touch View/kiosk support is
blocking; editor ergonomics on touch remain best effort under
`docs/TOUCH-SUPPORT.md`.
