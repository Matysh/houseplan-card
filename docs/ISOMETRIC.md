# Isometric (2.5D) View internals

Issue [#89](https://github.com/Matysh/houseplan-card/issues/89) started a
presentation-only volumetric View experiment; the normative Stage 1 contract is
`docs/specs/089-isometric-view-stage1.md`, the fixed rendering decisions are in
`docs/adr/089-isometric-stage1-renderer.md`. Since Stage 6
([#649](https://github.com/Matysh/houseplan-card/issues/649)) the 2.5D View is a
public mode, see [Stage 6](#stage-6-public-mode-tiles-sun-and-materials-649).

## Activation

One installation-wide setting, `settings.volumetric_view: boolean`, switched in
**General settings › Display › Show the plan in 2.5D** (third item after «Show
live presence on the plan»). It is stored only when `true`; missing or `false`
means Flat, which is also the rollback. The rule is one for the card, the
sidebar page and the kiosk: the View is 2.5D when the setting is on and Flat
otherwise. Editors and `houseplan-space-card` are always Flat.

Saving the setting switches the View at once, without a reload, and the view
centre is carried over through the logical plan (#583 §6.3). The lazy
`iso-scene-render` graph is loaded only while the setting is on. The fingerprint
fallback (#89) is unchanged: a failed scene falls back to Flat for that key.

On a cold dashboard load, the first visible successful frame is already 2.5D:
the existing neutral House Plan loading surface remains above the plan until
both the lazy graph and the paper-dependent floor classification are ready.
This is the same in the ordinary card and kiosk mode. A real lazy-load failure
releases that surface and uses the existing safe Flat fallback; it does not
change the saved setting. Flat View and every editor do not wait for the 2.5D
runtime. Paper colour is resolved after the DOM commit (white for a drawn plan,
the theme card background under an image plan) and the resulting light-floor
set is reused until the paper, resolved room fills or room membership changes
([#654](https://github.com/Matysh/houseplan-card/issues/654)).

There is no toggle on the card and no alpha entry: `iso` is gone from
`LABS_FLAGS`, the header `projection-toggle` and the phone-menu item
`projection` (#616) are removed, and the former per-device, per-space choice
`houseplan_card_view_v1` is no longer read (owner decision: not migrated). The
`hp_alpha` switch itself remains as a mechanism without experiments.

## Coordinate systems

- Plan points are the existing 1000-unit logical floor coordinates.
- Scene points are coordinates in the effective SVG viewBox.
- HTML devices, vacuum pucks, room labels/cards and lock markers stay
  screen-facing. Their anchors use the same `projectPlanPoint()` snapshot as the
  SVG floor.
- `clientToScenePoint()` maps a client point to the current scene; floor hit
  testing then uses `unprojectFloorPoint()`.

The current Stage 4 presentation uses a fixed orthographic affine camera:

```text
rotDeg=0, tiltDeg=20, xyScale=1, zScale=1, origin=[500,500]
wallHeight=84 scale-aware visual units
```

There is no perspective, free rotation or user tilt. Switching projections
preserves scalar zoom and converts the view centre through logical floor space.
`projectedFrame()` includes both floor corners and wall-top corners so fit/home
cannot clip the volume.

Room fit (#152) projects every final floor vertex at floor and floor-edge depth
and every selected-room boundary-wall vertex at floor and wall-top height before
building the AABB. It never projects a plan-space bounding rectangle, so a
concave room does not gain fictitious corners. The resulting camera still uses
the shared View controller; changing projection cancels the room-focus intent.

## Geometry and composition

`src/iso-projection.ts` owns pure projection math. `src/iso-walls.ts` consumes
the canonical `wallBodiesGeometry()` MultiPolygon after openings and extra
physical bodies have been resolved. It normalizes outer/hole winding, builds one
evenodd top path and at most one visible side per ring edge, then uses a stable
depth/order tie-break. Complexity is O(E) in canonical ring edges.

For connected drafts and partitions those extras already contain computed
bounded junction patches. Isometric wall tops/sides therefore use the same
seamless L/T footprint as flat full/static cards; raw per-record rectangles are
reserved for editor identity and never projected as competing wall faces.

The content fingerprint includes rooms, wall geometry/thickness, open cuts,
openings, partitions, drafts, columns, scale/grid inputs, camera, wall height and
algorithm version. It deliberately excludes `_cfgEpoch`, HA state, hover and
`show_borders`. The per-card LRU is capped at eight scenes. Pan, zoom and HA-only
updates reuse it.

Composition remains SVG-first:

1. the existing floor SVG and all its current live layers;
2. explicit visible wall sides and wall top;
3. screen-facing HTML overlays.

The floor keeps the same nodes and order for paper/backdrop, room fills/hover,
Glow/spill, sun, decor/furniture, opening symbols and vacuum path/outline. Stage
1 does not add a second light source/layer. Markers and room cards intentionally
remain above walls without geometric occlusion.

## Failure boundary

Projection/topology failures latch flat fallback for the current
`space|fingerprint`. One diagnostic is emitted without config, entity ids or URL
data. The saved iso preference is retained; an explicit iso request retries the
fingerprint, and changed geometry receives a new fingerprint. Flat rendering is
the rollback path and does not depend on the iso cache.

## Deliberate Stage 1 limits

- door, window and gate keep their current floor-plane symbol and live state;
- no vertical leaf/window panels, sill model or new window light;
- no floor-edge extrusion, shadows, photorealistic materials or marker
  occlusion;
- no volumetric editor and no volumetric `houseplan-space-card`;
- no YAML/config option or public settings surface.

Golden references are accepted only from the complete reviewed Linux artifact.
The full `large-house-isometric-v1` performance comparison is also canonical on
the exact Linux CI SHA.

## Stage 2 composition (#122)

Stage 2 evolves the same hidden `iso` experiment; it does not add a flag,
setting or public activation path. The accepted implementation contract is
`docs/specs/122-isometric-stage2.md` and the fixed composition decisions are in
`docs/adr/122-isometric-stage2-composition.md`. Its historical per-feature
lifetime was superseded by the single indefinite `hp_alpha` gate in #448; the
Stage 2 rendering contract itself is unchanged.

### One structural scene, live opening leaves

The per-card LRU remains capped at eight entries. Its Stage 2 value contains:

- canonical wall top/sides and the physical-wall contact path;
- a room/exterior floor footprint and its low visible outer faces;
- immutable opening jamb/axis bases, including type, flips and selected wall
  face;
- the shared projected frame, including wall/opening tops and the low floor
  edge.

The key includes rooms, masonry/opening geometry, flips, scale/camera, wall and
edge heights and algorithm revision. It excludes HA state, theme, hover,
day/night and filter capability. `openingAmount()` is applied only after an LRU
hit by `projectIsoOpening()`, so a contact update projects O(O) leaves without
repeating a wall or floor boolean operation.

`floorFootprintGeometry()` deliberately accepts no independent physical-body
input. The slab is the union of room floors and derived exterior masonry:
internal room boundaries and nested holes make no decorative step, detached
room components keep separate outside edges, while partitions and columns do
not enlarge it.

### Layer order and materials

All geometry roots use one scene `viewBox`. The existing floor/live nodes are
grouped under the Stage 1 affine matrix; HTML anchors still use
`projectPlanPoint()`.

```text
stage background
→ shared ambient shadow + low exterior floor edge
→ existing floor SVG (paper/image, room fills/hover, decor, Glow, sun)
→ canonical wall sides/top + inert vertical opening panels
→ existing HTML devices, labels/cards, locks and vacuum overlays
```

Wall top and side use two shared matte gradients. One shared filter supplies
only the soft exterior ambient shadow of the complete building footprint;
internal wall-contact and opening-leaf shadows are deliberately absent.
Definition count is constant per card, never per face or opening. Forced
colours use solid `Canvas`/`CanvasText` faces and omit decoration. A runtime
without the required filter paint keeps solid structure, floor edge and
vertical panels but emits no ambient shadow; this does not enter the structural
fallback latch.

### Vertical openings and display settings

`src/iso-openings.ts` mirrors the existing opening-symbol transform algebra:
door has one jamb-hinged leaf, gate has two leaves with the established
0–10° exterior-face turn, and window has two light neutral casements. A saved
`passage` keeps the same full-height masonry cut but has zero leaves/panels.
Heights are fixed presentation ratios of
`ISO_WALL_HEIGHT`; there is no schema field.
The saved opening axis and Flat symbol remain on their canonical centreline.
Derived 2.5D door/gate leaves pivot on the selected physical host face so their
prisms do not start inside masonry; windows remain centred across the reveal.
`flip_v` selects/determines the physical face and opening direction without
changing saved coordinates. Jamb/cut depth remains physical and independent of
the Flat symbol. Panels are pointer- and ARIA-inert. Existing lock badges/cards
and HA actions remain the only interactive opening surface.

- borders visible: vertical panels replace the floor-plane symbols;
- `hide_openings: true`: panels disappear, while masonry
  cuts, Glow/sun and contact/lock meaning remain;
- `show_borders: false`: Stage 2 roots are absent and the established floor
  symbols and Stage 1 projected frame return (subject to `hide_openings`),
  avoiding floating panels or an invisible Stage 2 bound that reframes them;
- Flat, editors and `houseplan-space-card` retain their old symbols and DOM.

Stage 2 adds no window beam, Glow source, sun renderer, material config,
network request or HA service path. Structural topology/projection exceptions
still use the Stage 1 latched Flat fallback. The known independent exact-SHA
view-toggle performance debt remains tracked in #124; #122 neither weakens its
budget nor treats fallback as benchmark success.

## Stage 4 visual handoff (#570)

Stage 4 refines the same hidden `iso` presentation behind `hp_alpha`; it adds no
public switch, configuration field or experiment id. Stage 3 history remains in
`docs/specs/160-isometric-stage3.md` and
`docs/adr/160-isometric-stage3-overlays.md`; the current acceptance contract is
the reviewed specification in issue #570 plus its revision-3 designer handoff.

### Camera and low screen-facing overlays

The camera is orthographic `rotDeg=0`, `tiltDeg=20`, with the same `[500,500]`
pivot and scale-aware 84-unit wall height. Floor SVG, wall/opening projection,
inverse hit mapping, invisible collision footprints and fit bounds share that
one affine authority.

Device markers, room labels/cards and opening-lock badges keep their canonical
floor anchors but render on a low plane four visual units above the floor.
Devices and lock badges in the same room whose canonical reference-fit bounds
(expanded by 12 CSS px) connect form one rigid cluster. Every member receives
the same scene-space displacement, so pairwise vectors, rows and intervals are
the affine projection of the Flat layout rather than a per-marker fan toward a
room safe point. Room labels never enter a cluster and stay below interactive
roots.

The reference-fit view, not the current live view, converts CSS safety values
into scene units. Wheel/button zoom, pinch and pan therefore transform an
already resolved scene and cannot invalidate placement. Structural changes —
stage/camera, walls, rooms, marker membership or canonical anchors — rebuild it
deterministically; viewport movement and HA-only state do not. One common
vector clears the exact wall silhouettes and already placed clusters within an
absolute 48 CSS-pixel reference-fit budget, using stable size/required-shift/
kind-id order and boundary candidates instead of scanning the displacement
disk. The correction is runtime-only and is never written to configuration.

If no completely legal common vector exists, the nearest deterministic result
keeps the cluster rigid and prioritises room ownership, then wall clearance,
then overlap with an earlier cluster. It never splits or shrinks a cluster;
residual overlap is an explicit degraded diagnostic. This supersedes the old
single-marker fallback while retaining the 48 px cap. The two full isometric
profiles keep the ordinary 150/60/75 ms resize/pan/state noise allowances
(#585, #651).
Fit probes reserve the maximum correction but do not execute live collision
search. There is no painted plate, long tether, ground dot or per-marker
shadow. The original screen-facing HTML root remains the only hit, focus,
tooltip and action target, and selection/hover cannot invalidate the placement
cache. Vacuum, Glow/spill, SUN, room fills/hover, arbitrary decor,
furniture/backdrop and every persisted coordinate remain on `z=0`.

Room names remain screen-facing and lose stroke, text shadow, drop shadow and
halo. Iso uses `#303936` on a light presentation and `#f2f0e8` on a dark one;
contrast comes from colour and the bounded position correction, never an
outline.

### Openings, occlusion and materials

Door leaves turn by `50° × openingAmount`, paired window leaves by `65° ×
openingAmount`, and gates retain their established 0–10° behaviour. The same
canonical flips/host face that drive the floor symbol determine hinges and
direction; missing, unknown or unavailable state keeps the existing static-plan
fallback. Opening geometry stays inert and lock actions stay on the existing
guarded lock badge/card.

For wall height `H`, the fixed window frame spans `0.38H..1.00H`, its sash
`0.40H..0.98H`, and clear glass `0.45H..0.93H`; frame/sash rails are `0.05H`.
Frames and sill are neutral, glass side is `#c9e4f3` and its top face is
`#e3f2fa`. Fixed and live faces remain in `buildIsoWallDepthQueue()`. The slots
belonging to one opening are resolved by physical camera depth, so raised glass
covers the rear sill and rotating door/gate prism faces retain their physical
order without reordering unrelated walls or openings. Door/gate faces use
fill differences instead of strokes; window frame/glass borders remain.

The constant material/filter set remains theme-aware and bounded. Only the
building ambient shadow remains; wall-contact and leaf shadows are omitted.
Forced colours or missing filter support remove texture and the ambient shadow, not geometry,
ownership or actions. `show_borders:false` is the exact no-volume branch: the
floor keeps the real 0°/20° affine matrix and interactive overlays return to
their floor anchors. `hide_openings` removes vertical decoration but preserves
cuts, Glow/SUN and lock semantics.

The eight-entry structural LRU fingerprints the 0°/20°/84 profile, opening
policy revision 3 and structural algorithm 5. It excludes HA state, live
opening amount, hover/selection, theme, SUN and filter capability. The lazy
`iso-scene-render` graph is still not requested with alpha off; topology,
projection or module mismatch still enters the established fingerprint-latched
Flat fallback. Linux exact-SHA goldens and performance profiles remain the
canonical release evidence.

## Stage 6: public mode, tiles, sun and materials (#649)

The visual language and the numbers come from the designer lab (sketch 07,
attachments 09–13 of #649); the lab's code, coordinates and ids are not carried
over. Lab units are converted into two bases:

- **D** — the base marker core diameter of the space (`--device-base-size`)
  already × `ISO_ICON_SCALE = 1.12`; the lab disc is 80 units.
- **H** — the 2.5D wall height (`gridVisualUnits(ISO_WALL_HEIGHT, cellCm)`); the
  lab wall is 218.8 units.

Everything below applies only to `.stage.projection-iso.mode-view`; Flat is
byte-for-byte unchanged. Side-by-side acceptance frames:
`docs/design/649-25d-stage6/ACCEPTANCE.md`.

### Raised tiles (`src/iso-tiles.ts`, `src/styles/iso-tiles.styles.ts`)

- Every marker body (core, value pill, lock core) is a rounded rectangle with
  radius `min(0.275 D, 0.3·h)`; the ring is not drawn (virtual markers too).
- A solid edge 0.1 D straight down, the body colour through
  `brightness(.7) saturate(.85)` (`brightness(.82) saturate(.8)` on a light
  floor); bodies with luma < 70 → `#5b5e5a`, white and dark bodies in the dark
  theme → `#4a4a4a`. The colours are evaluated once in TypeScript
  (`isoEdgeColor`) and emitted as a generated state table.
- Marker and lock are 1.12 × Flat; layout and collisions
  (`iso-scene-render`) use the same factor. The whole marker is lifted 0.075 D.
- **One floor-shadow layer** `.iso-tile-shadows` inside `.devlayer`, rendered
  after the markers in DOM order but with `z-index: -1` (`.devlayer` is a
  stacking context), so no shadow ever lands on a neighbour's tile. Each marker
  and lock has an inert twin (`data-shadow-of`, `aria-hidden`, no pointer
  events) painted only as its inset, blurred box-shadow. Offset, blur and
  opacity follow the theme × floor table of the ТЗ (`isoTileShadow`).
- Light or dark floor is decided per room: the room fill at its opacity over
  the plan paper, luma > 0.55 is light (`isoLightFloorRooms`). A marker belongs
  to the room of its overlay owner or, without walls, to the room under it.
- A raised room label keeps its 44 × 44 px touch floor in an invisible
  `::before`, like door locks; the label box itself is sized by its text, so
  the metrics row keeps the Flat distance from the name at every zoom (#665).
- Hover / focus-visible / selected / alert frames hug tile and edge
  (bbox + 0.075 D per side, + edge height) and float with the tile: `#0C82F0`,
  `#0C82F0`, `#F0A00C`, `#F0410C`, priority Alert > Focus > Selected > Hover.
  The body is not repainted on hover.
- `forced-colors: active` or no `filter` support: no edge and no shadow; size,
  tiles and frames stay.

### Soft sun wash (`src/iso-sun.ts`)

In 2.5D the Flat wedges of `sun_rays` are replaced by a soft wash; the gates are
the Flat ones (`sun_rays`, `north_deg`, `sun.sun`, elevation ≥ 3°, fade, no light
in editors or at night) and so are the windows (`windowLit()`). Details:
`docs/SUN.md` § 2.5D.

### Walls, openings and labels (`src/iso-materials.ts`)

- The top face is the user's `fill_colors.wall_fill.c`, opaque (the Flat opacity
  does not apply to the prism), gradient to `c × 0.93`; the side face is
  `c × 0.77 → × 0.68 @0.58 → × 0.60`. The stage carries them as
  `--iso-top-hi/lo` and `--iso-side-hi/mid/lo`.
- The theme never repaints walls, openings, the floor edge, the texture or room
  labels: the `theme-dark` and `prefers-color-scheme: dark` rules for `.iso-*`
  are gone. Room labels use the Flat label colour. The building ambient shadow
  on the card background may follow the theme.
- Furniture keeps its Flat line width: stroke px = width × the plan screen scale
  in both views (the former iso constant 1 made it thicker).
