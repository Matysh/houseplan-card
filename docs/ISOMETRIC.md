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

Stage 1 uses a fixed orthographic affine camera:

```text
rotDeg=0, tiltDeg=20, xyScale=1, zScale=1, origin=[500,500]
wallHeight=64 plan units
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
→ shared contact and live leaf shadows
→ canonical wall sides/top + inert vertical opening panels
→ existing HTML devices, labels/cards, locks and vacuum overlays
```

Wall top and side use two shared matte gradients. Ambient, contact and leaf
shadows use three shared filters; definition count is constant per card, never
per face or opening. Forced colours use solid `Canvas`/`CanvasText` faces and
omit decoration. A runtime without the required filter paint keeps solid
structure, floor edge and vertical panels but emits no Stage 2 shadows; this
does not enter the structural fallback latch.

### Vertical openings and display settings

`src/iso-openings.ts` mirrors the existing opening-symbol transform algebra:
door has one jamb-hinged leaf, gate has two leaves with the established
0–10° exterior-face turn, and window has two light neutral casements. A saved
`passage` keeps the same full-height masonry cut but has zero leaves/panels and
therefore no panel or leaf shadow. Heights are fixed presentation ratios of
`ISO_WALL_HEIGHT`; there is no schema field.
The panel basis consumes the same pure visible-offset contract as Flat: default
door/window/gate panels are always centred across wall depth. `flip_v` changes
only door/window direction or the gate turn and never translates the structural
origin. Jamb/cut depth remains physical and independent of symbol placement.
Panels/shadows are pointer- and ARIA-inert. Existing lock badges/cards and HA
actions remain the only interactive opening surface.

- borders visible: vertical panels replace the floor-plane symbols;
- `hide_openings: true`: panels and leaf shadows disappear, while masonry
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

## Stage 3 spatial overlays and materials (#160)

Stage 3 evolves the same hidden `iso` presentation behind `hp_alpha`; it adds
no public switch, configuration field or separate experiment id. The normative
contract is `docs/specs/160-isometric-stage3.md` and the fixed implementation
decisions are in `docs/adr/160-isometric-stage3-overlays.md`.

### Camera, floor plane and raised plane

The current fixed camera is orthographic `rotDeg=4`, `tiltDeg=20`, with the
same `[500,500]` pivot, scale and scale-aware 64-unit wall height. The four
degree turn is part of `ISO_CAMERA`; floor SVG, point projection, inverse hit
mapping, raised plates and fit bounds therefore use one affine authority.

Device markers (including their badges), room labels/cards and opening lock
badges use a raised plane at the scale-aware wall height plus a nominal four
visual units. Vacuum puck/trail, Glow/spill, sunlight, room fills/hover,
decor/furniture/backdrop and every persisted coordinate stay on the floor
plane. Plates are floor-parallel, while glyphs, values and text remain
screen-facing on the existing HTML roots and retain their actions and minimum
touch targets.

Each raised item keeps separate immutable floor and visual anchors. A grounding
cue stays at the floor anchor. Collision is tested against cached projected wall
tops and visible sides, expanded by a four CSS-pixel gap. A deterministic inward
nudge may move only the visual anchor by at most 48 CSS pixels; its straight path
must stay inside the owning room and outside island holes, and it never writes
layout/config/storage. The owning-room resolver prefers an explicit valid owner,
otherwise the smallest strictly containing room with a stable id tie-break;
opening locks instead inherit the physical host side. Missing or ambiguous
ownership degrades to a tethered placement rather than guessing or mutating
data. A tether is always retained after nudge or near a wall and while the item
is hovered, focused or selected; an idle item in free space may omit it.

### Openings, materials and degradation

The structural cache now also carries jamb/reveal surfaces and deterministic
window frame/sill geometry. Door and gate leaves are matte finite-thickness
prisms; windows are light inserts without dark glass; passages remain an empty
full-depth cut. `openingAmount()` is still applied after a structural-cache hit,
so contact changes do not rebuild wall/floor booleans. `hide_openings` removes
panels, reveal decoration and their shadows but preserves the cut and lock
semantics.

One bounded set of shared gradients, patterns and filters provides low-amplitude
theme-aware texture and a fixed visual-light direction. Generated walls,
floor-edge surfaces, opening volume and raised plates may use it. User floor
content, room fills, Glow, sunlight, decor, glyph/text and vacuum never do.
Neither theme nor HA Sun state enters the structural fingerprint.

Forced colours and missing filter support remove texture/soft shadow nuance,
not geometry, raised ownership, tethers or actions. `show_borders: false` is
the exact no-volume branch: Stage 2/3 structural and raised roots are absent,
all overlays return to their floor anchors, and the floor still uses the real
4° affine camera. Only topology/projection failure enters the established
fingerprint-latched Flat fallback.

The structural LRU remains capped at eight. Its key includes geometry, opening
flips and fixed ratios, scale, camera, raised/opening heights and the Stage 3
algorithm revision; it excludes HA state, opening amount, theme, Sun,
interaction and capability state. Golden references and both exact-SHA
performance profiles remain Linux-CI evidence and may not accept a Flat
fallback as a successful Iso sample.

The Stage 3 renderer, opening volumes and overlay resolver form an independent
`iso-scene-render` lazy graph. With `hp_alpha` off an ordinary View does not
request that graph. Enabling the alpha loads it atomically through the same
source-fingerprint handshake and one cache-busted retry used by other lazy
runtimes; until a matching runtime is installed, the requested view remains
Flat rather than mixing builds or rendering a partial Iso scene.
