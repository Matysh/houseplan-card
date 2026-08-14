# Light on the plan — the model (source of truth)

Status: accepted by the owner after manual testing, 2026-08-11 (#71). Replaces
the layered model of v1.61.0-beta.5 and earlier.

## Principle

**A lamp lights the floor it can see.** That is the whole model. Everything the
plan shows — a beam through a doorway, a shadow behind a column, a wall corner
cutting that beam two rooms away, light flowing across a virtual boundary —
is one computation, so those things cannot disagree with each other.

The previous model computed them separately: a clip for the source's "open
zone", a blurred sector pasted at each doorway, a mask for obstacle shadows.
Every fix to one layer broke another; a doorway could be an unlit bar between
two lit rooms, a beam could float detached from its aperture, a shadow could
dissolve into a smear, and walls belonging to a farther room cast nothing at
all. None of those states is expressible now.

## What stops light, and what does not

`_lightBarriers()` (`src/houseplan-card.ts`) builds the barrier set once per
plan geometry and shares it between every lamp in the space.

**Opaque**

- the wall bodies exactly as the plan draws them (`wallBodiesGeometry`), with
  their real thickness and mitred junctions;
- independent bodies: partitions, columns and room drafts. Exact connected
  draft/partition segments enter as one joined volume, not as raw rectangles
  whose former butt faces could become false barriers;
- the bare outline of any room edge that carries no thickness — a wall is still
  a wall when it is drawn as a line.

**Transparent**

- doorways and gates — cut through the masonry, so an opening is a real
  gap between two jamb faces and a thick wall's returns narrow the beam;
- virtual (open) boundaries, which are not walls to begin with.

**Deliberately opaque, although the plan draws an opening there**

- windows: an indoor lamp must not wash the street;
- a door with no floor behind it. An opening is transparent only where BOTH
  sides are floor; otherwise a front door glows halfway — up to the centreline,
  where the room polygon ends — and the plan shows a lit doorway to nowhere.

So the light's masonry is cut by passages only and differs on purpose from the
drawn one.

Source placement follows the same geometry, fail-dark. If the source centre is
inside an opaque wall body, a window tunnel, or an exterior door/gate opening,
the source produces no Glow at all. It does not light the indoor half of the
opening. An interior door/gate passage remains a real hole and is therefore a
valid source position. This is an intentional placement rule, not a temporary
availability state: move the source marker onto the clean room floor to make it
emit Glow again ([#92](https://github.com/Matysh/houseplan-card/issues/92)).

## From barriers to a lit region

1. **Split at crossings** (`splitAtIntersections`). The sweep casts a ray at
   every barrier ENDPOINT. Two faces that cross in their middles — normal where
   wall bodies meet at a junction — would leave that corner unsampled, and the
   fan would close it with a chord: a sliver of floor next to a corner the lamp
   plainly sees goes dark. After the split every crossing is an endpoint and the
   sweep is exact, whatever shape the geometry arrived in.
2. **Sweep** (`visibilityPolygon`, `src/light-visibility.ts`): a ray at every
   corner and just to either side of it, the nearest hit wins, and the fan is
   closed with an arc at the lamp's own radius (`GLOW_ARC_STEPS` = 96, chord
   error 0.05% of the radius).
3. **Intersect with the floor** (`intersectionPaths`): light lands on rooms, not
   on the space around the house.

The result is ONE `clipPath` for ONE `<circle>` filled with the source's radial
gradient. A shadow is simply floor that is not in that region.

## Brightness

`glowAlpha` remains the only intensity formula (docs/specs/067) and gives the
alpha **at the centre** of the pool. `GLOW_FALLOFF` then spends that alpha over
the whole radius (100/88/62/32/0 %). The old flat plateau out to 70% turned
every clipped shape into a slab of solid colour with a rim — which is exactly
how a doorway sector read in the next room. The gradient is `userSpaceOnUse`
and centred on the lamp, so attenuation depends on distance from the lamp and
on nothing else: the floor behind a door is faint because it is far.

A shadow currently keeps no light at all. This follows from "objects do not let
light through" and is the owner's standing decision; a residual term would be
one constant if a pitch-black corner next to a bright area ever needs softening.

## Penumbra

One SVG `feGaussianBlur` over the whole light layer, sized in SCREEN pixels
(`GLOW_EDGE_FEATHER_PX` = 2, so σ = 1 px) and converted to plan units with the
current zoom — an edge stays a hairline when the plan is enlarged instead of
turning into a smear. Measured: the lit→unlit border crosses 20–80% in 1.5 px
and is fully done in 3.5 px.

Do NOT reach for CSS `filter: blur()` here: Chromium applies it to an SVG group
in name only (`getComputedStyle` reports the blur; the picture changes by a
couple of hundred pixels on a whole plan). And do not blur per source — one
pass over the layer costs a fifth of one blurred mask per source.

## Caching

Barriers are keyed by a fingerprint of their own geometry, never by
`_cfgEpoch`: the epoch lags behind geometry edited in place, and a stale barrier
set is invisible — the plan simply keeps lighting through a wall that now
exists. The same fingerprint, plus position and radius, keys the per-source
region cache (`_glowClipCache`).

The masonry boolean receives room walls after passage cuts plus the cached
joined independent body set. Its outer/hole rings are the authoritative
barriers for both visibility and the fail-dark source guard. A boolean failure
falls back to the raw independent bodies as opaque obstacles; it never turns a
malformed wall transparent.

## Source, state and service identity

The geometry above consumes `resolvedLightSources()`; it never discovers light
entities on its own. Since #84/#88 a source has three deliberately separate
identities:

- `key` (`entity:*` or `marker:*`) identifies and de-duplicates the physical
  source on the plan;
- `stateEids` are the real HA entities whose states feed a stateful source;
- `serviceEids` are the real HA entities which may be sent to `callService`.

`marker:*` is configuration graph syntax, never an HA entity id. It is never
looked up in `hass.states` and never sent to a service. A stateful marker target
projects to its selected leading `light.*`/`switch.*`; a passive marker may
legitimately have empty state and service lists.

`is_light` remains tri-state. Auto keeps functional device-role discovery,
Never suppresses only the marker's own source, and Always creates one spatial
source even when the marker has no controllable HA entity. That last case is a
**passive forced source**:

- with no incoming controller link it is explicitly constant-on;
- with one or more links it is on when any active controller driver is on;
- links with no active driver make it dormant/off, not constant-on;
- its position, room, colour, brightness and radius belong to the target lamp,
  not to the switch which drives it.

There is one explicit manual-authority exception. An active marker with a
`virtual` binding, `is_light: true` (Always) and `tap_action: toggle` reads its
on/off value from the integration's revisioned operational store. Absence is
`on`. While the triple remains active, that value overrides incoming controller
OR for the marker source and therefore reaches every consumer of
`resolvedLightSources()` — Glow, room fill/counts, device presentation, preview
and both card types. Saved controls remain lossless but a tap on this exact
marker performs the operational toggle, never an HA service call. Leaving the
triple restores the normal controller rules and clears any stored off bit;
hiding alone does neither. The operational revision is part of the resolver
cache key, so an event changes the projection without an HA state tick.

The controller picker can therefore link a smart relay to a virtual marker for
a dumb physical lamp. Multiple controllers use OR. A direct entity reference
and a marker reference resolving to the same stateful source are deduplicated.
The controller still presents the aggregate working state of its targets, but
does not steal their Glow position or room statistics.

For Always devices with several own controllable entities, optional
`marker.light_entity` selects the leading state/service entity. Absence keeps
the compatibility fallback (`entity:` binding, resolved primary, then the
first controllable candidate). A stored selection which temporarily disappears
is retained and visibly warned about; runtime uses the fallback until it
returns. Capability comes from binding/registry metadata, never from a
transient `unknown`, `unavailable` or missing state snapshot.

The complete UI and runtime truth table lives in
[`DEVICE-LIGHT-SETTINGS-MATRIX.ru.md`](DEVICE-LIGHT-SETTINGS-MATRIX.ru.md).

## What the tests hold

- `test/light-visibility.test.mjs` — the sweep itself: a wall stops light, a
  doorway lets a beam through and only through, a column's shadow has the
  angular width its size dictates, an occluder out of range changes nothing, a
  source on an opaque edge is rejected, the ±π seam cannot cut a wedge from
  the fan, and a corner made by two crossing barriers is lit right up to the
  corner.
- `test/physical-geometry.test.mjs` plus
  `test/houseplan-runtime-contract.test.mjs` — the source-placement guard:
  exterior opening masonry, wall bodies, partitions and columns are fail-dark,
  while a real interior passage remains a valid source position; the rendered
  Glow path is pinned to that shared guard.
- `demo/smoke_glow.mjs` — pixels on a rendered plan: the aperture itself is lit,
  the floor behind a door is lit, the visible beam is no wider than twice the
  opening, there is no light behind a column while the floor beside it is lit,
  the lit→unlit border is at most 4 px wide, a spot has exactly one painted
  child, the light layer contains exactly one blur and no mask, and an outside
  door does not change the lit region at all.
- `demo/smoke_openwall.mjs` — a lamp lights across one virtual boundary, and
  across two in sequence, only where it can see through both.
- `test/golden-matrix.test.mjs` — the source contract: one region per source, no
  second layer of light, no barrier cache keyed by the epoch.
- Golden: `lighting-opaque-glow-two-doorways-dark` and the other `lighting-*`
  scenes, re-shot and approved 2026-08-11.

## Performance

The large cold geometry recalculation (20 rooms, 20 partitions, 14 columns,
61 sources) dropped from about 23.5 s in beta.5 to about 0.33 s in beta.6 on
the review runner — roughly 70×. The official warm `large-light-blend-v1`
path is generally level with beta.5; the 30-source sample was temporarily
slower and remains a performance watch item. During pinch/pan and the bounded
500 ms source fade, the whole-layer blur is bypassed and its parameters stay
frozen; the final screen-space feather is restored once after the transition
instead of rebuilding and evaluating the filter for every animation frame.
