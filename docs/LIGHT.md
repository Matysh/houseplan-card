# Light on the plan — the model (source of truth)

Status: accepted by the owner after manual testing, 2026-08-11 (#71). Replaces
the layered model of v1.61.0-beta.5 and earlier.

## Principle

**A lamp lights the floor it can see.** That is the whole model. Everything the
plan shows — a beam through a doorway, a shadow behind a column, a wall corner
cutting that beam two rooms away, light flowing across a dashed zero wall —
is one computation, so those things cannot disagree with each other.

The previous model computed them separately: a clip for the source's "open
zone", a blurred sector pasted at each doorway, a mask for obstacle shadows.
Every fix to one layer broke another; a doorway could be an unlit bar between
two lit rooms, a beam could float detached from its aperture, a shadow could
dissolve into a smear, and walls belonging to a farther room cast nothing at
all. None of those states is expressible now.

## What stops light, and what does not

`_lightBarriers()` (`src/houseplan-card.ts`) builds the barrier set once per
plan geometry and relevant opening-state signature, then shares it between
every lamp in the space.

**Opaque**

- the wall bodies exactly as the plan draws them (`wallBodiesGeometry`), with
  their real thickness and mitred junctions;
- independent bodies: partitions and columns. Exact connected partition
  segments enter as one joined volume, not as raw rectangles
  whose former butt faces could become false barriers;
- every zero-thickness wall when its space uses the **Solid** style. It enters
  the sweep as its exact axis, a zero-area barrier rather than fake masonry.

**Transparent**

- doorways and gates to floor on both sides, but only by their resolved opening
  amount. An unbound opening is fully transparent, a bound closed one is opaque,
  and a positional cover cuts a centre-aligned fraction of the full aperture;
- saved `passage` openings — always cut through the masonry, so an opening is a
  real gap between two jamb faces and a thick wall's returns narrow the beam;
- every zero-thickness wall when its space uses the **Dashed** style.

The setting is intentionally one semantic switch, not just paint. Missing or
unknown `zero_wall_style` means `dashed`; `solid` blocks Glow and sunlight.
It applies equally to room-contour atoms and independent partitions.
`resolveZeroWalls()` supplies both the lines and barrier set,
so renderers and light cannot disagree. The deprecated `open_spans/open_to`
input is only a v8 read projection and migrates to ordinary `cm:0` atoms.

**Deliberately opaque, although the plan draws an opening there**

- windows: an indoor lamp must not wash the street;
- a door, gate or `passage` with no floor behind it. An opening is transparent only where BOTH
  sides are floor; otherwise a front door glows halfway — up to the centreline,
  where the room polygon ends — and the plan shows a lit doorway to nowhere.

The classifier is an explicit `door | gate | passage` allowlist. Door and gate
state is resolved by the same `openingAmount()` used for their visible symbol:
binary contacts yield zero or full aperture, finite `current_position` yields
`clamp(position / 100)`, and `invert` mirrors a known amount. Missing,
disabled, `unknown` or `unavailable` contacts preserve the static-plan fallback
of a fully open door/gate rather than manufacturing a closure. Any unknown
future opening type remains opaque until its physical semantics are reviewed;
it never inherits transparency merely by not being a window.

So the light's masonry is cut by passages only and differs on purpose from the
drawn one.

The rule is identical for a passage hosted by a finished independent wall.
Only its explicit partition body (plus an exactly collinear covering room wall)
is cut. Windows remain opaque to indoor Glow, one-sided door/gate/passage cuts
remain opaque, and an invalid host fails dark. A window hosted by an independent
wall never becomes a sunlight source; sunlight still belongs to exterior room
windows.

Source placement follows the same geometry, fail-dark. If the source centre is
inside an opaque wall body, a window tunnel, or an exterior door/gate opening,
the source produces no Glow at all. It does not light the indoor half of the
opening. An interior door/gate/saved-passage opening remains a real hole and is therefore a
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

Room and fan coordinates cross the polygon-boolean boundary through a
`1e-6` render-unit numeric grid. This removes sub-pixel arithmetic tails
without rewriting saved plan geometry. If the combined floor still cannot be
processed, clipping retries room by room: a failed room stays dark, every
healthy room keeps its visible light, and the card emits one redacted warning
per space-geometry revision and room. Returning the un-clipped visibility fan
is never a fallback ([#218](https://github.com/Matysh/houseplan-card/issues/218)).

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

The formula is `paletteAlpha × 0.7 × (0.4 + 0.6 × bri^(1/2.2))`
(`GLOW_SCALE_MAX`, `GLOW_MIN_FRAC`, `GLOW_GAMMA`); `resolveGlowAppearance()`
supplies the marker-owned live or manual colour and brightness, and the radius
is `settings.glow_radius_cm` unless the marker sets `glow_radius_cm`. Sources add
up (#19): each circle keeps its own gradient and clip, and all circles share one
isolated parent with no outer opacity and `mix-blend-mode: screen`. Screen
blending is enabled only after a cached per-`Document` raster probe
(`src/glow-blend.ts`) proves real SVG pixels; pending, unsupported, error and
timeout states render normal blending, and a successful probe requests one
update.

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

Barriers are keyed by their geometry fingerprint plus a compact, sorted
signature of bound interior door/gate opening amounts (quantised to the
0.05 grid of `OPENING_LIGHT_AMOUNT_QUANTUM`, #366 — a moving cover steps the
light in 5% increments instead of forcing a recompute per percent), never by
`_cfgEpoch`:
the epoch lags behind geometry edited in place, and a stale barrier set is
invisible — the plan simply keeps lighting through a wall or closed door that
now exists. Unrelated HA updates preserve the signature and hit the bounded
barrier cache. The combined fingerprint, plus source position and radius, keys
the per-source region cache (`_glowClipCache`).
Top-level LED-strip source data is excluded from this architectural fingerprint:
editing an emitter does not change masonry. The full card, static card and
accepted resize artifacts use the same tag; every other raw field, scale and
bound opening state retains its invalidation semantics. LED shape/radius keys
still invalidate the strip's own field.

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

There is one explicit manual mode. An active marker with a `virtual` binding,
`is_light: true` (Always) and `tap_action: toggle` reads its on/off value from
the integration's revisioned operational store only while it has no valid
incoming controller link. Absence is `on`; a tap performs the operational
toggle, never an HA service call. Saved outgoing controls remain lossless and
do not override that unlinked manual state.

With one or more incoming links, the same exact marker enters linked mode.
Incoming controller drivers become the sole state authority for every consumer
of `resolvedLightSources()` — Glow, room fill/counts, device presentation,
preview and both card types. Tapping the source sends one ordinary HA group
operation to the deduplicated union of all incoming drivers; tapping a
controller still operates only that controller's effective driver group. No
operational toggle or optimistic visual flip occurs. Adding a link preserves
the stored manual bit, and removing the final link exposes that exact value
again. The operational revision remains part of the resolver cache key, but it
cannot change a linked source without a driver-state change.

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

The complete UI and runtime truth table is the next section.

## Device light settings: role × source × mode (#84, #88)

Legend: **A** — «Auto» found the device's own spatial source; **S** — the
device has its own controllable `light.*`/`switch.*` able to report state and
take a service call; **Source** — the device takes part in Glow, the «Light»
fill, the room card and room statistics; **Live** — the «From source» colour
mode is available; **Manual** — manual colour and manual brightness are
available; **R** — the local Glow radius is available. `Auto → fixed` — the
stored mode is not rewritten, but UI and runtime give a passive source the safe
fallback: the shared colour at 100 % brightness.

The combination `A = yes, S = no` is listed for completeness of the contract
and for mutation tests; the resolver cannot reach it (an automatically found
source always has a real `light.*`). The other 27 rows are reachable.

| # | Role | A | S | Stored mode | Source | Passive | Live | Manual | R | Effective mode |
|---:|---|:---:|:---:|---|:---:|:---:|:---:|:---:|:---:|---|
| 1 | Auto | no | no | From source | no | no | no | no | no | From source, disabled |
| 2 | Auto | no | no | Set colour | no | no | no | no | no | Set colour, disabled |
| 3 | Auto | no | no | Colour and brightness | no | no | no | no | no | Colour and brightness, disabled |
| 4 | Auto | no | yes | From source | no | no | no | no | no | From source, disabled |
| 5 | Auto | no | yes | Set colour | no | no | no | no | no | Set colour, disabled |
| 6 | Auto | no | yes | Colour and brightness | no | no | no | no | no | Colour and brightness, disabled |
| 7 | Auto | yes | no | From source | yes | yes | no | yes | yes | Auto → fixed (theoretical) |
| 8 | Auto | yes | no | Set colour | yes | yes | no | yes | yes | Set colour (theoretical) |
| 9 | Auto | yes | no | Colour and brightness | yes | yes | no | yes | yes | Colour and brightness (theoretical) |
| 10 | Auto | yes | yes | From source | yes | no | yes | yes | yes | From source |
| 11 | Auto | yes | yes | Set colour | yes | no | yes | yes | yes | Set colour |
| 12 | Auto | yes | yes | Colour and brightness | yes | no | yes | yes | yes | Colour and brightness |
| 13 | Always | no | no | From source | yes | yes | no | yes | yes | Auto → fixed |
| 14 | Always | no | no | Set colour | yes | yes | no | yes | yes | Set colour |
| 15 | Always | no | no | Colour and brightness | yes | yes | no | yes | yes | Colour and brightness |
| 16 | Always | no | yes | From source | yes | no | yes | yes | yes | From source |
| 17 | Always | no | yes | Set colour | yes | no | yes | yes | yes | Set colour |
| 18 | Always | no | yes | Colour and brightness | yes | no | yes | yes | yes | Colour and brightness |
| 19 | Always | yes | no | From source | yes | yes | no | yes | yes | Auto → fixed (theoretical) |
| 20 | Always | yes | no | Set colour | yes | yes | no | yes | yes | Set colour (theoretical) |
| 21 | Always | yes | no | Colour and brightness | yes | yes | no | yes | yes | Colour and brightness (theoretical) |
| 22 | Always | yes | yes | From source | yes | no | yes | yes | yes | From source |
| 23 | Always | yes | yes | Set colour | yes | no | yes | yes | yes | Set colour |
| 24 | Always | yes | yes | Colour and brightness | yes | no | yes | yes | yes | Colour and brightness |
| 25 | Never | no | no | From source | no | no | no | no | no | From source, disabled |
| 26 | Never | no | no | Set colour | no | no | no | no | no | Set colour, disabled |
| 27 | Never | no | no | Colour and brightness | no | no | no | no | no | Colour and brightness, disabled |
| 28 | Never | no | yes | From source | no | no | no | no | no | From source, disabled |
| 29 | Never | no | yes | Set colour | no | no | no | no | no | Set colour, disabled |
| 30 | Never | no | yes | Colour and brightness | no | no | no | no | no | Colour and brightness, disabled |
| 31 | Never | yes | no | From source | no | no | no | no | no | From source, disabled (theoretical) |
| 32 | Never | yes | no | Set colour | no | no | no | no | no | Set colour, disabled (theoretical) |
| 33 | Never | yes | no | Colour and brightness | no | no | no | no | no | Colour and brightness, disabled (theoretical) |
| 34 | Never | yes | yes | From source | no | no | no | no | no | From source, disabled |
| 35 | Never | yes | yes | Set colour | no | no | no | no | no | Set colour, disabled |
| 36 | Never | yes | yes | Colour and brightness | no | no | no | no | no | Colour and brightness, disabled |

A manual colour on a stateful source keeps the live brightness; «Colour and
brightness» fixes both. A passive source has no live brightness, so «Set
colour» means 100 % and «Colour and brightness» uses the stored value.

### Leading entity (#88)

| Role | Own controllable entities | Stored `light_entity` | UI and runtime |
|---|---:|---|---|
| Auto / Never | any number | any value | Selector hidden; the field is kept unchanged but does not affect the current role |
| Always | 0 | absent | Passive source, selector hidden |
| Always | 1 | absent | The only entity is chosen automatically, selector hidden |
| Always | 2+ | absent | Selector shown; fallback `binding → primary → first controllable` |
| Always | 1+ | valid value | The chosen entity provides state and the service target |
| Always | any number | entity disappeared | Warning; temporary fallback, the stored reference is not erased |

The choice does not depend on the current `on/off/unavailable`: capability
comes from the binding and the HA registry, live state is handled separately.

### «Controls other light sources» links (#84)

| Target in `controls` | Target state | Controller's service call | Glow and statistics |
|---|---|---|---|
| `light.*` / `switch.*` | The entity's actual state; a group — `any(on)` | Real entity ids only | A real separate marker owns the position; otherwise the target takes part without a separate pool at the controller |
| `marker:<id>` stateful | The target's leading entity state | The target's leading entity, deduplicated | Position, room, colour and radius belong to the marker target |
| `marker:<id>` passive, one controller | Its real targets, otherwise its own leading entity | `marker:*` itself is never sent to HA | The passive lamp follows the controller and shines at its own position |
| Passive, several controllers | OR of all active driver entities | Per action — only its real targets | One source and one room vote, no duplicates |
| Exact `virtual` + «Always» + Toggle, links present | OR of all active driver entities; the manual bit temporarily abstains | Controller click — its group; lamp click — deduplicated union of all its drivers | HA state alone drives Glow, fill, statistics and both markers |
| Exact `virtual` + «Always» + Toggle, no links | Operational Store #107; no record = `on` | Lamp click changes only the operational state, no HA service | Manual state is shared by full/static cards and survives a restart |
| Passive without stored links, not the exact mode of #107 | Always `on` | No own call | Constant Glow and `1 of 1` |
| Links present, but every driver is hidden/disabled/removed | `off` / dormant | No call on a broken target | The link is kept, no pool |
| Direct entity + `marker:` on the same stateful source | One effective state | One service target | One source and one vote |
| Target moved from «Always» to «Auto without source»/«Never» | Dormant | No marker service | The link is kept and revives on return to «Always» |
| Target hidden or HA-disabled | Dormant | No marker service | Not drawn, no effect on the room |
| Target removed from the plan | The reference is removed atomically | No | The device can be added again |
| Broken legacy ref | Ignored with a diagnostic | No | Open → Save does not destroy the reference |
| Self-link / new cycle | Forbidden | — | The UI does not offer it, the backend rejects the write/import |

Links are allowed across rooms and spaces of one plan. Exporting a single
space remaps internal `marker:` references together with marker ids and drops
external ones with a warning in the preview.

### Independent display switches

| Setting | Effect on the light model |
|---|---|
| «Icon + state» | The device shell shows its resolved working state; Glow follows the matrix above |
| «Icon + state and activity» | Additionally a short or constant ripple; the light source does not change |
| «Value + state» | Changes only the marker content; the light source does not change |
| «Always static icon» | Blocks the dynamics of the icon/shell itself but does not cancel separately configured Glow, «Light» fill and room statistics |
| Glow off for the space | Pools are not drawn, but the source, the room state and the «Light» fill are still computed |
| Marker hidden / HA-disabled | The marker and its own source take no part in the plan regardless of other settings |

What holds this section: all 36 rows of the first table —
`test/devices.test.mjs`, «issues 84/88: exhaustive 36-case light settings
matrix is internally consistent»; the leading-entity choice, stale fallback,
passive OR, dormant links, alias dedupe, lifecycle and the ban on sending
`marker:*` to HA — the neighbouring unit tests of the same file; the context
selector, passive gating and plan-source picker — browser smokes; new links,
cycles and cross-space transfer — `tests_backend/`.

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
- `test/logic.test.mjs` and `test/physical-geometry.test.mjs` — the shared
  opening amount, stable state signature and centre-preserving partial cut for
  contour and independent walls.
- `demo/smoke_glow.mjs` — pixels on a rendered plan: the aperture itself is lit,
  the floor behind a door is lit, the visible beam is no wider than twice the
  opening, there is no light behind a column while the floor beside it is lit,
  the lit→unlit border is at most 4 px wide, a spot has exactly one painted
  child, the light layer contains exactly one blur and no mask, and an outside
  door does not change the lit region at all.
- `demo/smoke_zero_walls.mjs` — dashed zero walls transmit Glow while the same
  axes in solid mode stop it; changing the style invalidates the cached region.
- `test/golden-matrix.test.mjs` — the source contract: one region per source, no
  second layer of light, no barrier cache keyed by the epoch.
- Golden: `lighting-opaque-glow-two-doorways-dark` and the other `lighting-*`
  scenes, re-shot and approved 2026-08-11.

## Glow over the data fill (#55)

Glow is an overlay, not a fill mode: space `settings.glow_enabled` and room
`settings.glow` (`null` inherits) are independent of the data `fill_mode`; the
legacy `fill_mode: 'glow'` projection is in `CONFIG-COMPATIBILITY.md`. Floor
order is paper → resolved data room/tunnel fill → Glow base → decor
(`DECOR-EDITOR.md` §3.3) → radial pools → sun and interactive layers. The dark,
pointer-free Glow base is painted only for rooms whose fill resolver returned
nothing or a fully transparent colour: explicit `none`, a zero-opacity
`custom`, a dynamic mode without usable data. A resolved `lqi`, `light`, `temp`
or `custom` fill never receives it, so its exact colour and alpha stay visible.
Pools render independently of the base; the static card uses the same data/base
projection and omits empty base groups.

## Which surfaces render pools

The full `houseplan-card` always renders pools for rooms where Glow is enabled.
`houseplan-space-card` uses the same canonical source projection, barrier scene,
visibility clip and SVG pool renderer when its public `light_pools: true` option
is enabled. It remains off by default: in that path the static card builds no
barrier/visibility geometry, starts no Glow transition timers and paints only
the shared room/data/base projection.

The opt-in remains fully static — `.hp-static-stage` and the Glow layer have
`pointer-events:none`. It is independent from the card's `live_states` marker
dressing. Separate `large-space-card-default-v1` and
`large-space-card-glow-v1` profiles protect the cheap default and the bounded
opt-in path alongside the full-plan profiles.

## Performance

The large cold geometry recalculation (20 rooms, 20 partitions, 14 columns,
61 sources) dropped from about 23.5 s in beta.5 to about 0.33 s in beta.6 on
the review runner — roughly 70×. The official warm `large-light-blend-v1`
path is generally level with beta.5; the 30-source sample was temporarily
slower and remains a performance watch item. During pinch/pan and the bounded
500 ms source fade, the whole-layer blur is bypassed and its parameters stay
frozen; the final screen-space feather is restored once after the transition
instead of rebuilding and evaluating the filter for every animation frame.

## LED strips: a linear source (#780)

A marker shown as an LED strip is one source whose emitter is the whole
polyline (`space.led_strips`, ТЗ #780). It never also paints a round pool from
its anchor. Colour, brightness, role and availability come from the same
`resolveGlowCandidates` / `resolveGlowAppearance` path as every other source;
only the geometry differs:

- **Radius.** 30 cm by default, independent of `settings.glow_radius_cm`; the
  marker's personal `glow_radius_cm` wins.
- **Field.** One continuous stroked path with round free ends: 48 grey
  luminance bands of the shared `GLOW_FALLOFF` in one mask, so corners and the
  closing of a loop neither seam nor double the brightness. Intensity and the 500 ms fade
  are the shared `glowAlpha` / `GLOW_FADE_MS`.
- **Zoom quality (#789).** Only while the main card's actual scale changes,
  the same mask paints 24 bands at the midpoints of the same falloff. All
  48 DOM paths, their widths, visibility/floor clips, source colour and alpha
  remain intact; light is never hidden. After 160 ms without a scale change,
  the original 48-band paint returns without a new fade. A stationary pinch
  restores quality even while contacts are held. Pure pan, a clamped no-op,
  structural resize and View/editor transitions do not activate it; the
  static card always uses full quality. Space/mode/projection/adoption,
  document hiding and disconnect reset the owner-local state. HA changes
  during zoom remain authoritative when full quality returns.
- **Scheduling.** Sources first seen by one synchronous render share one
  entering-frame callback per owner/runtime, not one complete update per
  source (#789). A microtask seals the batch so a later rAF cannot bring a
  newly inserted source into an earlier entry frame. Forget/disconnect cancels
  empty batches; identity checks reject late callbacks. Normal 500 ms fade and
  reduced-motion behavior remain shared with ordinary Glow.
- **Render-local scene reuse.** The main card shares a resolved barrier scene
  between its Glow/LED consumers within one synchronous `render()` only
  (`LightBarrierPass`). `finally` clears the memo even on early return or error.
  The next render, callbacks and handlers still resolve the content-based
  revision; this is not a cross-frame cache keyed only by object identity.
- **Owner teardown.** Main and static cards release LED state when their next
  space has no visible strips, not only when another field renders. The static
  card also releases it on disconnect, space change or disabling light pools;
  switching off live states releases the field while retaining the neutral tube.
  Both lazy runtime and field readiness callbacks check the actual owner's
  connection before requesting an update. Reconnect creates a fresh lifecycle.
- **Visibility.** Classify and sample the full polyline at radius/4 or finer,
  retaining every actual vertex and both ends; never thin a short final run
  or an acute corner. The continuous field is clipped to the union of the
  emitters' visibility fans (the shared `visibilityPolygon` over the same
  barrier scene as pools), then once to the floor. Groups of five fans are
  retained as compact positive-winding paths and rendered as one SVG clip
  child with explicit `clip-rule=nonzero` (several compound clip children
  caused Chromium raster holes despite correct geometric membership);
  discs and blocked fans have the same winding, so overlap adds visibility
  instead of cutting holes. An unobstructed emitter uses
  an exact SVG disc; a blocked fan keeps hard obstacle edges and exact circular
  arcs between them. Before the sweep, barriers are clipped to the emitter's
  radius: exact wall–circle intersections become angular events, not a chord
  cutting away visible floor between two coarse rays. Windows,
  columns,
  thick walls and Solid zero walls block; doors/gates pass by their actual
  opening; Dashed zero walls are transparent. Emitters on a thick face sit
  `epsilonGeom` (0.001 cm) outward into free floor; a part buried in a body
  emits nothing; a strip entirely inside a wall has no field.
- **Wall openings and corners.** A door, gate or passage remains optically
  open, but an internal gap between two collinear pieces of the same wall face
  inherits their free-side normal. The visible stripe and its emitters
  therefore stay on one straight line through the opening. At a genuine turn,
  safely intersecting shifted sides use that bounded intersection as their
  single miter; a free side contributes its unshifted axis to the same join.
  Numeric endpoint tails are not gaps; redundant collinear subdivisions are
  removed only from the derived visible path before offsetting, never from
  the saved points. Unsafe acute angles retain the short connector. A stored
  four-corner loop stays four-cornered without steps or protruding hooks;
  a genuinely tilted side stays tilted (#787, #788).
- **Core.** An on strip uses the same resolved source colour as its field,
  whether effective Glow (space `glow_enabled` + room `glow`) is on or off.
  RGB, colour temperature and manual colour changes update both through the
  shared light resolver; field brightness does not change core opacity.
  Without Glow there is no field. Off: white core, no field.
  Unavailable/unknown: dashed grey stripe, no field — the link is kept.
- **Surfaces.** The full card renders field and stripe in the View; the
  Devices editor shows active strips (unbound ones as grey dashes);
  Plan/Background show a passive translucent stripe. `houseplan-space-card`
  draws the passive stripe always and the field only with `light_pools: true`
  — with the option off no barrier, visibility or timer is created; with
  `live_states: false` the stripe is neutral and has no field (all four
  combinations are one browser matrix in `smoke_led_strip_glow`).
- **Room.** The Glow room of a strip is the explicit valid `room_id` of its
  marker, otherwise the room of the half-length anchor (`stripRoom`).
- **Laziness.** The stripe/hit/2.5D code (`led-strip-runtime`) and the field
  (`led-strip-field`) are separate lazy chunks; the initial graph holds only
  the presence check and the loader (`led-strip-gate`). Caches are bounded per
  space (50 shapes and 50 visibility entries) and released on space change
  and on disconnect; a chunk that lands after disconnect applies nothing.
  The `led-strips-v1` maximum-load witness bounds the compact representation
  to 2500 cached path batches and 4 Mi cached characters (at most 8 MiB UTF-16,
  excluding the joined Lit/DOM clip string), with unchanged timing and 64 MiB
  warm-cycle heap-growth budgets (not a total browser-memory bound).
  The actual fan count remains a separate honest
  diagnostic. The former 2500-fan acceptance bound depended on dropping
  required vertices/endpoints and was incompatible with the 50×50-point
  contract; compaction now reduces object/DOM overhead, not geometric detail.
  The physical tube/hit path is reused across camera updates with exact point,
  face-context and thickness invalidation; old frame/disconnect entries are
  evicted. Before exact emitter-circle clipping, a conservative strip-wide
  bounding box excludes only barriers that cannot reach any emitter disc.
  This broad phase preserves the exact visibility path strings and all sources.

`smoke_led_strip_field` compares rasterised production-field pixels with an
independent distance/falloff oracle across three radii, both path directions
and three raster densities: free ends, acute/reflected turns, decimal loops,
self-crossings and an opaque wall. Unit tests pin joins, circle events and
doorway emitter normals. The original household export is checked locally,
not stored as a public fixture.
