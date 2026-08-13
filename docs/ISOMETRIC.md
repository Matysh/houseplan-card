# Isometric Stage 1 internals

Issue [#89](https://github.com/Matysh/houseplan-card/issues/89) implements a
hidden, presentation-only volumetric View experiment. The normative contract is
`docs/specs/089-isometric-view-stage1.md`; the fixed rendering decisions are in
`docs/adr/089-isometric-stage1-renderer.md`.

## Activation and lifetime

The feature exists only while the `iso` entry in `src/labs.ts` is live. For the
v1.62 cycle it can be enabled with either `?hp-labs=iso` or
`#hp-labs=iso&space=<id>`. Query operations are applied first and hash operations
second. `-iso` removes this flag and `off` clears every Labs flag. A known URL
operation is persisted in `houseplan_card_labs_v1`; the URL itself is not
rewritten.

The selected presentation is stored per space in `houseplan_card_view_v1`. Flat
is always the initial default. Kiosk has no toggle but reads the saved preference.
Editors and `houseplan-space-card` are always flat.

The current registry entry is live from numeric core `1.62.0` and expires at
`1.65.0`. Thus `1.65.0-beta.1` is already expired. Malformed versions, malformed
entries and duplicate ids fail closed. Labs never gate schemas, migrations,
stores, service calls or network requests.

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

## Geometry and composition

`src/iso-projection.ts` owns pure projection math. `src/iso-walls.ts` consumes
the canonical `wallBodiesGeometry()` MultiPolygon after openings and extra
physical bodies have been resolved. It normalizes outer/hole winding, builds one
evenodd top path and at most one visible side per ring edge, then uses a stable
depth/order tie-break. Complexity is O(E) in canonical ring edges.

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
