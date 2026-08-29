# Furniture library

Status: **implemented and expanded by issue #159**. The Background editor
stores furniture as ordinary decor:

```text
{ kind: "furniture", symbol, x, y, w, h, color, opacity, width_cm, angle? }
```

The schema and saved coordinates did not change. Existing furniture therefore
keeps its position, size, rotation and styling; only 18 built-in drawings gain
the new artwork after an update.

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

- `src/furniture-plan-art.generated.ts` for the initial View graph;
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

## Rendering contract

Each object is still one `<path>` and one erase hit path. Designer artwork
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

The top edge of every drawing is BACK (`y = 0`). Placement and dragging use
the established wall magnet, absolute saved coordinates and the shared
selection/resize/rotate frame. Furniture is decor: it has no entity, state,
room aggregation, collision model or automatic binding to later wall edits.

## Compatibility and performance

No backend schema, configuration version or migration was added. The 18
replacement ids preserve their identity; the remaining old ids remain
available. Default dimensions change only for a newly picked replacement—an
already saved object's `w` and `h` are never rewritten.

Plan artwork is available in View and kiosk. Front-view menu art is imported
only after the editor runtime is requested. Touch View/kiosk support is
blocking; editor ergonomics on touch remain best effort under
`docs/TOUCH-SUPPORT.md`.
