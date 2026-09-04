# ADR #122 — Stage 2 isometric composition

- Issue: https://github.com/Matysh/houseplan-card/issues/122
- Status: accepted for implementation
- Date: 2026-08-14
- Normative spec: `docs/specs/122-isometric-stage2.md`, revision 1
- Predecessor: `docs/adr/089-isometric-stage1-renderer.md`
- Activation superseded by #448: Stage 2 remains hidden, now behind the single
  indefinite `hp_alpha` switch instead of the historical `iso` lifetime.

## Context

Stage 1 established one fixed affine floor projection, canonical wall volume,
screen-facing HTML anchors and a bounded structural LRU. Stage 2 must add matte
depth, an exterior floor edge, grounding shadows and vertical openings without
creating another plan/light model or making HA state rebuild topology.

The owner explicitly allowed implementation to begin with #124's known
view-toggle performance debt still open. That arbitration removes the DoR
blocker only: the unchanged exact-SHA performance budget remains a gate and
fallback may not be forced to make it green.

## Decision

### Structural/live boundary

The existing eight-entry Iso LRU becomes a structural scene cache. Each entry
contains wall faces, floor footprint/edge, immutable opening bases and one
projected frame. The fingerprint includes opening geometry and flips plus the
fixed wall/edge heights and algorithm revision. It excludes HA state and every
decorative capability.

An opening basis stores its resolved wall face, jamb hinge, closed vector,
quarter-turn vector and fixed height bounds. Rendering applies the existing
`openingAmount()` after the cache lookup. Door/window/gate live changes are
therefore O(O) vector projection and cannot invoke polygon boolean operations.

### Floor footprint

The slab source is the canonical union of rooms plus derived exterior masonry.
Independent partitions, drafts and columns remain canonical wall volume and
light occluders but are not accepted as floor-footprint input. Stage 2 projects
only outer rings down by ten plan units; holes and internal/shared boundaries
cannot become steps. Disconnected outer polygons remain disconnected.

### Composition

Four absolute SVG roots share the effective scene `viewBox`: underlay, the
existing floor scene, shadows and wall/opening volume. The old floor nodes are
not copied; they live under the same affine matrix Stage 1 used. HTML overlays
stay above every SVG root.

The stable order is ambient shadow, floor edge, current floor/live layers,
contact/leaf shadows, wall sides/top, vertical panels, then HTML overlays.
All new geometry is pointer/focus/ARIA inert.

### Material and degradation

Two shared SVG gradients distinguish matte wall top and side. Three shared
filters provide ambient/contact/leaf softness. Definitions are O(1) per card;
there are no per-face filters, raster textures, data URLs or runtime
dependencies.

Filter-paint failure removes shadows only. Forced colours also remove gradient
nuance and use solid system colours. Structural wall/opening/edge geometry and
all existing live layers remain Iso. Only a structural topology/projection
exception enters the established `space|fingerprint` Flat fallback latch.

### Opening presentation and settings

- door: one full jamb-hinged leaf, 92% of wall height;
- gate: two half leaves, 88%, preserving the existing 0–10° face-aware turn;
- window: two light inserts between 27% and 78% of wall height.

These are presentation constants, not persisted fields. With visible borders,
vertical panels replace the old floor symbols. `hide_openings` hides panels and
leaf shadows. With borders disabled, every Stage 2 root is absent and the
existing floor symbols return, so there are no floating vertical leaves. The
no-borders branch also keeps the accepted Stage 1 projected frame (floor plus
the fixed wall-height allowance): absent Stage 2 floor/opening geometry cannot
contribute invisible bounds and reframe the live floor. With borders visible,
fit includes every Stage 2 structural bound; blur capability never changes it.

## Consequences

- Flat, editors, static card, schema, storage keys, i18n, backend and HA actions
  are unchanged.
- Glow/spill and sunlight remain the only room/window light models.
- Theme, hover, filter fallback and HA-only updates do not grow the structural
  LRU.
- Fit includes structural opening/wall tops and the low floor edge, never blur.
- Golden and browser evidence must review new Iso pixels; Flat and the existing
  no-borders baseline remain unchanged.
- Stage 2 stays hidden and expires with the existing `iso` Labs entry unless a
  separate owner-reviewed rollout/graduation issue changes that contract.
