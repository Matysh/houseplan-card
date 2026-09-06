# ADR #160 — Stage 3 isometric spatial overlays

- Issue: https://github.com/Matysh/houseplan-card/issues/160
- Status: accepted for implementation
- Date: 2026-09-05
- Normative spec: `docs/specs/160-isometric-stage3.md`
- Predecessor: `docs/adr/122-isometric-stage2-composition.md`
- Amended by: #471 (`docs/specs/471-isometric-overlay-white-plates.md`) removes
  visible raised plates while retaining their geometry as an invisible safety
  footprint.

## Context

Stage 2 deliberately rendered screen-facing device markers, room cards and
opening-lock badges above all wall volume. That preserved readability and the
existing interaction roots, but near a wall a wide marker or card could appear
to belong to the room on the other side. A global height change is not valid:
vacuum, Glow, sunlight, room fills and saved layout coordinates are physical
floor data and must remain there.

Stage 3 also needs a subtle diagonal view, more legible opening depth and
material nuance without creating another camera, hit-test model, lighting
system or per-face filter inventory. Theme and HA updates must not invalidate
structural geometry, and the existing exact-SHA performance budgets remain a
gate.

## Decision

### One rotated affine camera

The fixed orthographic camera becomes `rotDeg=4`, `tiltDeg=20`, with the
existing `[500,500]` pivot, unit XY/Z scales and nominal wall height 64. The
four-degree turn is inside `ISO_CAMERA`, not a CSS transform around a completed
scene. Floor SVG, `projectPlanPoint()`, inverse floor mapping, raised planes and
fit bounds therefore share `isoPlaneMatrix()`.

The nominal raised offset is four visual units above the wall. Wall and offset
values pass through the existing cell-scale policy together. The projected
frame includes the raised height plus opening/floor structural bounds but not
blur extents.

### Raised/floor split and interaction ownership

The complete device marker (core, badges, LQI, new/pulse), room label/card and
opening lock badge are raised. Vacuum puck/trail, Glow/spill, sunlight, room
fills/hover, backdrop, decor/furniture and every logical or persisted point
remain at `z=0`.

Each raised item has four distinct pieces:

1. an immutable logical floor point;
2. its projected floor grounding point;
3. an invisible floor-parallel safety footprint and raised visual point;
4. the existing screen-facing HTML root.

The SVG grounding and tether roots are pointer-, focus- and ARIA-inert. The
safety footprint is calculation-only and produces no SVG/HTML surface. The HTML
root moves to the same visual point and remains the single owner of hover,
focus, tooltip/dialog and click/context actions. It keeps its existing
axis-aligned minimum 44 CSS-pixel target. Zigbee topology continues reading the
rendered marker position and gains no second projector.

### Deterministic ownership and nudge

Wall proximity is tested against canonical physical-wall silhouettes cached in
the structural scene, including projected top faces and visible side quads. The
footprint is expanded by a four CSS-pixel safety gap. If it intersects, a pure
resolver searches toward a proven room-safe point for the minimum clearing
displacement, with a 48 CSS-pixel cap. The complete straight candidate path must
remain strictly inside the owner and outside island holes. The displacement is
screen-space stable and applies only to the visual point and footprint; the floor
point, config, layout, storage and export remain unchanged.

Device ownership first accepts its explicit room only when that room strictly
contains the floor point. Otherwise it chooses the smallest strictly containing
canonical room, then stable id. Room overlays use their own room. Lock badges
inherit the physical room side already selected by opening-host geometry; they
do not re-infer it from the offset badge point. Invalid wall geometry, missing
ownership, an invalid safe point, an owner boundary or an exhausted cap returns
a deterministic degraded placement with its floor point intact.

The tether remains visible after any nudge, near a wall, or while hover, focus
or selection is active. The accepted product contract permits it to disappear
for an idle item in free space. A grounding shadow is always present when
decorative filters are supported. Neither cue is a hit surface.

### Opening depth

The cached opening basis now owns the full physical face depth, two jamb
reveals, and fixed presentation thicknesses. Door/gate leaves are matte prisms
whose thickness is `0.04 * wallHeight`; the window frame member is bounded from
the nominal `0.055 * wallHeight`. Existing height ratios remain: door 92%, gate
88%, and window 27–78% of wall height. Door/gate hinge, face and flips retain
the existing symbol algebra; gate keeps its face-aware 0–10° turn.

`openingAmount()` is applied only after the structural-cache hit. Door/gate
therefore update finite-thickness live leaves without rebuilding booleans.
Windows use light inserts, frame sides/top and a sill rather than dark glass.
Passage has no panel or reveal decoration. `hide_openings` removes generated
opening volume and directional shadows but keeps the masonry cut and lock
semantics.

### Materials, light and degradation

Generated wall faces, exterior floor edge and opening surfaces may receive a
low-amplitude deterministic texture. Invisible raised footprints and user floor/backdrop, room
fills, live lighting, decor/furniture, glyphs/text and vacuum may not. One
bounded set of shared gradients, patterns and filters is emitted per card; no
definition is allocated per face, opening or marker.

Ambient/contact/opening/grounding shadows share a fixed nominal visual offset
of `[4,8]` visual units (cell-scale aware). This is presentation light only and
does not read HA Sun. Theme changes affect tokens, not structural ids or cache
keys.

Forced colours use solid system surfaces and omit material texture and soft
shadows. A runtime without filter paint does the same while retaining solid
opening geometry, invisible footprint calculations, tether and actions. These are decoration capability
paths, not reasons for Flat fallback.

### Cache, no-borders and evidence

The structural LRU stays capped at eight. Its fingerprint includes canonical
wall/opening geometry and flips, scale inputs, the 4°/20° camera, fixed
wall/floor/raised/opening dimensions and Stage 3 algorithm revision. It excludes
HA state and opening amount, theme, Sun, colors, hover/focus/selection and
filter/forced-colors capability. Live opening projection remains O(O); overlay
placement consumes cached wall silhouettes and does no per-marker union.

`show_borders:false` is an exact no-volume path. It emits no wall/opening/floor
edge or raised ground/tether roots. Markers, labels and locks return to
their `z=0` anchors but still share the real rotated floor matrix. The frame
does not include invisible raised bounds.

The scene exposes internal fail-closed evidence: effective Iso carries Stage 3
and structural-build attributes; interactive raised roots expose kind, raised
and nudged state; shared material definitions are explicitly countable. Golden
and performance harnesses must reject Flat fallback. New golden PNGs are
accepted only from an independently reviewed full Linux artifact.

The renderer and Stage 3 geometry live behind one `iso-scene-render` dynamic
boundary. Alpha-off View never requests it. Alpha activation uses an exact
source-fingerprint handshake, atomic install and one content-hashed retry;
until that succeeds the requested projection remains Flat. The bundle manifest
measures this graph separately from the initial View graph.

## Consequences

- Flat, all editors, `houseplan-space-card`, schema, storage, imports/exports,
  backend and HA action paths are unchanged.
- A marker may move visually by a bounded amount in Iso, but its floor anchor
  and all persisted data remain exact and inspectable through the tether.
- The fixed 4° camera changes every legitimate Iso baseline; it must not change
  a Flat baseline.
- Existing live floor effects remain one layer and are not textured or raised.
- Since #471, the conservative raised footprint remains in collision/nudge/fit
  calculations but is never painted as a plate or texture surface.
- Unsupported decoration loses nuance rather than silently changing projection.
- Stage 3 remains an internal `hp_alpha` capability with Flat as the default and
  immediate rollback; it is not announced in public documentation or changelog.
