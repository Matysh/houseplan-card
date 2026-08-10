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
- independent bodies: partitions, columns, room drafts;
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

## What the tests hold

- `test/light-visibility.test.mjs` — the sweep itself: a wall stops light, a
  doorway lets a beam through and only through, a column's shadow has the
  angular width its size dictates, an occluder out of range changes nothing, a
  source on an opaque edge is rejected, the ±π seam cannot cut a wedge from
  the fan, and a corner made by two crossing barriers is lit right up to the
  corner.
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
