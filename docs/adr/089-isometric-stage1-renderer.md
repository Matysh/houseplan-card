# ADR #89 — Stage 1 volumetric renderer

- Issue: https://github.com/Matysh/houseplan-card/issues/89
- Status: accepted for Stage 1 implementation
- Date: 2026-08-13
- Normative spec: `docs/specs/089-isometric-view-stage1.md`, revision 3

## Context

House Plan already has one SVG scene with live room fills, Glow/spill, sunlight,
backdrop/decor, furniture, opening symbols and vacuum trails, plus screen-facing
HTML devices and room cards. Stage 1 must add low wall volume behind a Labs flag
without creating a second rendering model or changing HA actions, configuration
or service paths.

Two spikes were evaluated against the existing scene composition:

1. CSS `perspective`/`preserve-3d` around `.zoomwrap` would put the existing
   `brightness()` filter, SVG blur and `mix-blend-mode: screen` into a 3D
   compositing context. It also requires a second approximate formula for HTML
   overlays.
2. One affine floor projection plus explicit SVG wall faces keeps the current
   live nodes and native hit targets, while pure functions can project the HTML
   anchors with the identical camera.

The second spike wins. It is deterministic, has no new runtime dependency and
can fail back to the untouched flat path.

## Decision

### Camera and coordinate systems

- Projection is orthographic with `rotDeg = 0` and `tiltDeg = 20`.
- Pivot is the fixed plan point `[500, 500]` (`NORM_W / 2`), never content or
  viewport centre.
- `xyScale = 1`; floor Y is multiplied by `cos(20°)` around the pivot.
- Logical wall height is `64` plan units and `zScale = 1`. Height therefore
  moves a top point upward by `64 * sin(20°) ≈ 21.9` scene units: visibly low,
  inside the 18–22° family approved by the owner.
- `projectPlanPoint` and `unprojectFloorPoint` are the sole plan/scene
  conversion. Client coordinates continue through the existing SVG viewBox.
- `projectedFrame` includes the floor frame at `z = 0` and the same corners at
  wall height. Pan, fit and zoom use this frame in the volumetric view.

The floor transform is the SVG affine matrix equivalent of
`projectPlanPoint(p, 0)`. Existing SVG floor/live nodes are grouped under this
one matrix. Screen-facing HTML overlays project their logical anchors through
the same pure function before conversion to percentages.

### Wall geometry and draw order

- Source geometry is `wallBodiesGeometry(...).geom`, including canonical room
  wall rings, joined junctions, full-height opening cuts, independent
  partitions, room drafts and columns.
- Rings are normalized by signed area. Every ring edge is visited once, so the
  side-face count is O(E).
- With the fixed camera, a side is visible when its outward plan normal faces
  the camera. Hole normals are reversed relative to outer rings. Jamb edges are
  ordinary ring edges and therefore produce the two expected vertical faces
  at a full-height opening.
- Visible side quads are ordered by projected floor depth and a stable
  polygon/ring/edge index. The top uses the complete projected MultiPolygon
  with `fill-rule: evenodd`; there is no strip or floor cap through an opening.
- Stage 1 order is: transformed floor/live SVG → visible wall sides → wall top
  → screen-facing HTML overlays. Markers and room cards deliberately remain
  above walls and receive no geometric occlusion.

### Appearance

- Light theme: top `#f3f3f1`, side `#a8acae`, outline `#d7d9d8`.
- Dark theme: top `#596166`, side `#3f474c`, outline `#747d82`.
- The current room-selected wall colour is not reused for volumetric material;
  it remains part of flat/editor rendering. No shadows, floor edges, vertical
  doors/windows or new window-light layer are added in Stage 1.

### View state, Labs and fallback

- `houseplan_card_labs_v1` owns the reusable flag set; `iso` is valid from
  `1.62.0` and expires at numeric core `1.65.0`.
- `houseplan_card_view_v1` stores only `flat|iso` per space. Flat remains the
  default even while Labs is enabled.
- Switching preserves scalar zoom and logical floor centre. Editors always use
  flat projection; returning to View restores the preferred projection.
- Warm state records projection and logical centre. A raw viewBox is adopted
  only when projection and active Labs contract still match.
- Geometry/render exceptions latch flat fallback for the current
  `(space, fingerprint)`. Preference is retained; explicit retry or a new
  fingerprint clears the latch.

### Browser and composition result

The selected SVG-only composition uses standard affine transforms, paths,
`fill-rule: evenodd`, existing filters/clips and existing screen blend. Chromium,
Firefox and WebKit all implement these primitives without a CSS 3D flattening
boundary. Browser validation remains mandatory through the Stage 1 smoke and
golden matrix; a browser-specific failure uses the same latched flat fallback.

## Consequences

- Flat rendering takes no Labs geometry path and retains its current DOM.
- HA-only updates reuse the content-fingerprinted wall geometry.
- `houseplan-space-card`, schemas, backend, imports/exports and service actions
  are unchanged.
- Stage 2 may replace material tokens or add vertical opening elements, but it
  must not replace this shared projection contract without a new decision.

