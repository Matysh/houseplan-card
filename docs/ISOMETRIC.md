# Hidden Isometric View internals

Issue [#89](https://github.com/Matysh/houseplan-card/issues/89) implements a
hidden, presentation-only volumetric View experiment. The normative contract is
`docs/specs/089-isometric-view-stage1.md`; the fixed rendering decisions are in
`docs/adr/089-isometric-stage1-renderer.md`.

## Activation

The feature belongs to the single hidden alpha set in `src/labs.ts`. Enable all
experiments in the current build with either `?hp_alpha=1` or
`#hp_alpha=1&space=<id>`; disable them with `hp_alpha=0`. Query operations are
applied first, hash operations second, and the last exact `1`/`0` wins. A known
operation is persisted as that exact string in `houseplan_card_alpha_v1`; the
URL itself is not rewritten. Unknown values fail closed for the current
resolution and do not overwrite storage.

The selected presentation is stored per space in `houseplan_card_view_v1`. Flat
is always the initial default. Kiosk has no toggle but reads the saved preference.
Editors and `houseplan-space-card` are always flat.

The switch has no version expiry and enables the complete capability set known
to the installed build. The legacy `hp-labs` URL and
`houseplan_card_labs_v1` storage are not read or migrated, so former testers
must enable `hp_alpha` once. Malformed registry entries and duplicate ids fail
closed. Alpha never gates schemas, migrations, plan stores, service calls or
network requests.

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
floor anchors but render on a low plane four visual units above the floor. Each
first clears wall silhouettes. A second deterministic group pass separates the
complete screen-space footprints of devices and lock badges from one another
within one absolute 48 CSS-pixel budget, using a bounded spatial index and
stable kind/id tie-break; it never writes the correction back to configuration.
The live pass enumerates one-pixel lattice candidates only at critical edges
and intersections of the forbidden screen-space roots it actually encounters;
it does not scan the area of the displacement disk or depend on a coarse grid.
Room, wall-silhouette and radius checks remain exact final filters, so a legal
slit narrower than four CSS pixels is still found without weakening masonry or
ownership safety. The two full isometric profiles therefore use the ordinary
150/60/75 ms resize/pan/state noise allowances again (#585).
Room labels do not enter that mutual pass and stay below interactive roots. If
the owning room truly has no legal placement, the least-overlapping result is
kept as an explicit degraded diagnostic without hiding or shrinking an item.
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
