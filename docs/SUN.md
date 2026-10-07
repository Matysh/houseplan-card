# Sun on the plan — the spec (source of truth)

Status: window rays approved 2026-08-03 and shipped in v1.56.0; the
four-phase background was replaced by the owner-approved #146 contract in
2026-08. The current background contract below supersedes the retained legacy
notes explicitly marked as historical.
Scope decisions final: the compass lives in the GENERAL settings with a
per-space override, the feature is silent until `north_deg` is set
anywhere, wedges ship for the FULL card only in v1, and mutual shading
of the building's wings is explicitly NOT computed.

## Principle

Two independent display-only visuals use solar data. The four-phase stage
background follows a valid `sun.sun` sample or browser-local clock fallback and
does not need a compass. Window rays use `sun.sun` plus the plan's north to cast
soft wedges from exterior windows. Neither creates entities nor calls services.

## Data

- Real source: the `sun.sun` entity (`attributes.azimuth` 0–360, 0 = north,
  clockwise; `attributes.elevation` in degrees, negative below the
  horizon; boolean `attributes.rising`). Missing/invalid data sends the
  background to local-clock fallback; window rays stay off and the settings
  dialog says why.
- `sun.sun` is consumed from the live HA state machine. It is valid for
  this core/runtime entity to have no Entity Registry row; registry
  projection must preserve its live state while still excluding rows
  that are explicitly disabled.
- Sun attributes update rarely (~30–120 s). Sun geometry is recomputed
  ONLY when (azimuth, elevation) or one of its geometric inputs change —
  never on every `hass` tick. The wedge layer memoises on every input
  (`sunGeometryKey`, `src/floor-geometry-key.ts`, #814): the opening wall
  index key (floor, rooms, walls, open cuts, scale), the physical bodies key
  of the floor record, the exterior windows, azimuth, elevation, north, the
  ray origin and the zero walls; the 2.5D wash adds the cell size and the lit
  floors. Not the config revision (it moves only after the WS ack,
  DEV-B701-01) and not the global config epoch: an own edit moves the key
  synchronously, an edit of another floor or of a shared setting does not.
- Angle on the plan: `plan_angle = north_deg + azimuth` (normalised to
  0–360). Both bearings increase clockwise: `north_deg` is the literal
  direction of true north on the canvas, and `azimuth` is the clockwise
  bearing from that north. With `north_deg = 0` the top of the canvas is north; the
  direction TOWARD the sun on the canvas is
  `(sin(plan_angle), −cos(plan_angle))` (y grows downward).
- `planSunAngle()` is the only source of the sun direction on the plan.
  Rendering and contrast consumers must not repeat the composition or add a
  second mirror/sign correction.

## Compass — `settings.north_deg`

- Integer 0–359, degrees clockwise from "up on the canvas" to true
  north. Lives in the GENERAL settings (⚙) as a circular dial: drag
  the «N» arrow around the ring, 1° steps, 15° with Shift held; a
  plain number input sits next to it for accessibility and precision.
- The arrow is literal: point N toward the place where true north lies on the
  drawing. It is not an instruction to enter how far the plan was rotated in
  the opposite direction.
- Per-space override in the space settings (empty = inherit), the same
  pattern as `show_lqi` / `fill_mode`.
- While `north_deg` is null at BOTH levels window rays are inert and the
  settings dialogs show a hint. The four-phase background remains active.
- Backend validation: integer in 0–359 at both levels.

## Current four-phase background — `settings.bg_mode: 'static' | 'daynight'`

The public setting remains a two-value selector. `static` uses `bg_color`.
`daynight` paints a decorative environment behind the unchanged plan:
`dawn`, `day`, `dusk`, or `night`.

- A valid real sample is atomic: finite `sun.sun` azimuth and elevation plus a
  boolean `rising`. Elevation `<= -6°` is night, `>= +6°` is day, and the band
  between them is dawn while rising or dusk while falling. Invalid or missing
  required data switches the whole resolver to browser-local clock time; real
  and fallback fields are never mixed.
- Clock fallback uses dawn 05:00–08:00, day 08:00–18:00, dusk 18:00–21:00,
  and night otherwise. A visible card checks it every 30 seconds, catches up on
  `pageshow`/visibility return, pauses while hidden, and removes the timer on
  disconnect.
- The soft decorative light follows real azimuth/elevation, or the fixed
  05:00→13:00→21:00 fallback arc. It has zero visible opacity at night.
- Four constant environment layers cross-fade for exactly 1100 ms with
  `cubic-bezier(.22,.61,.36,1)`. Reduced motion disables the transition.
- The zero-offset outline starts on the grouped paper footprint, preserving the
  historical single-SVG alpha composition exactly. On the first pan or pinch,
  the card instance switches to an exact pointer-inert copy in a sibling SVG
  behind the visible plan. The filter and `will-change: filter` then belong to
  that stage-sized root, while the inner `.hp-paperg` becomes unfiltered: a
  1 cm/grid-point plan may span more than 4096 local SVG units without moving a
  coordinate-sized filter layer. The sibling follows the same live viewport as
  the visible plan for that and every later gesture. Without its own promoted
  layer every repaint of the plan re-ran
  three blur passes over the whole sheet. Measured in headless
  Chromium (CDP tracing, summed `RasterTask`) on a demo-stand pan, that cost
  about fifteen times the rasterization of a static background; the owner's
  Firefox profile that opened #532 showed the same cause as 23 MB of texture
  uploads per frame and about nine frames per second, without a comparable
  ratio of its own. A static background creates no outline sibling and carries
  neither the filter nor the hint. The non-interactive static space card uses
  the same stage-sized day-cycle outline from its first frame because it has no
  camera gesture that could activate a fallback later (#582).
- The sibling stays stage-sized at every zoom (#689). The full card clips it to
  its own box (`.stage .hp-paper-outline-svg { overflow: hidden }`) and marks it
  `data-hp-live-overflow="clip"`, so a gesture never exposes it either: a filter
  layer precedes any `clip-path`, and an open outline spanned the whole paper
  at the current zoom — 12.8× the stage at ~460 % and hundreds of MB at 800 % ×
  DPR 2, which made navigation flash white. Its glow may be missing on an
  incoming edge for at most one budgeted `viewBox` refresh. The visible scene
  keeps the explicit layer #582 requires, but through `will-change: opacity`:
  a `will-change: transform` hint froze its raster scale, so after zooming from
  100 % to 800 % the plan showed the stretched 100 % raster while a page opened
  at 800 % was sharp. Both were verified by the owner in Chrome 152;
  `demo/smoke_daycycle_zoom_layers.mjs` measures the layers and the hint.
- Only the environment and the zero-offset alpha-aware outline outside the
  grouped plan-paper footprint change. The plan, paper, floors, room fills,
  Glow/spill, devices, labels, decor/backdrop, vacuum, hover, and window rays
  are never dimmed, tinted, faded, blended, or otherwise phase-filtered.
- Full View, kiosk, and `houseplan-space-card` share the same pure resolver,
  palette, outline, and clock lifecycle. Plan/Devices/Decor editors remain
  static.
- The background is independent of `north_deg`. North remains required only
  for direction-dependent window rays.
- **The scene background never bleeds through the plan** (owner, 2026-08-03).
  In both modes the background — `bg_color` or the day-cycle environment — is
  visible only AROUND the plan: opaque `.hp-paper` shapes sit under everything
  the plan draws. The paper is the ROOM CONTOURS in every case — one shape per
  room in exactly the room's own geometry (fill only, no stroke), never their
  bounding box, so the background reaches the exterior walls of an L-shaped
  house and fills the gaps between detached buildings; an empty drawn space
  has no paper, and a plan image does not paper its own rectangle (it is drawn
  on top of the room paper, `DECOR-EDITOR.md` §3.3). Open (virtual)
  boundaries do not affect the paper; a live resize preview moves it together
  with the rooms. Its colour is the pre-`bg_color` canvas — white for
  hand-drawn plans, the theme card background under an image — and its alpha
  never changes. Applies to view/kiosk/editors and the static space card alike
  (`demo/smoke_bg_color.mjs`).

New installations materialize global `daynight`; every manually or
Floors/Areas-created space materializes its own `daynight`. The storage v1.2
migration materializes a missing/invalid legacy global token as `static`, so an
upgrade cannot change an existing plan's appearance. Full and per-space
export/import likewise materialize compatibility modes; a per-space export
carries its effective mode and a legacy space import without one becomes
`static` before merge. Runtime's last-resort missing-token fallback remains
`static`.

The exact palette, positioning formulas, migration matrix, lifecycle, and
acceptance criteria are in `docs/specs/146-four-phase-sun-background.md`.

## Window light wedges — `settings.sun_rays`

Boolean, global + per-space (null = inherit), default OFF.

For every opening of type «window» sitting on an EXTERIOR wall — a
wall stretch with no other room on its outer side, decided by probing
the existing room geometry just off both sides of the window; windows
on interior walls do not participate, windows explicitly hosted by independent
partitions do not participate, and a zero-thickness wall cannot host an
opening — the card draws a wedge
when BOTH hold:

- the sun is above the horizon (`elevation > 0`), and
- the dot product of the wall's outward normal with the direction
  toward the sun — the cosine of the angle of incidence — is above
  `RAY_MIN_COS` = 0.05, i.e. the sun faces this window AND clears the
  plane of its wall by ~2.9° (~87.1° of incidence). Below that there is
  nothing to paint: glass reflects almost all of it, and the shaft's
  perpendicular depth (`len · cos`, see «Dissolving») would be thinner
  than the wall it came through.

The wedge is a PARALLELOGRAM. The global `settings.sun_ray_origin` enum selects
its full source span: `inner` starts at the two room-side corners (the default
and the exact pre-#577 behaviour), while `outer` starts at the two exterior
corners. Missing or unknown values resolve to `inner`; this setting has no
per-space override. The selected span is extruded by the same
length along the direction AWAY from the sun (light falls inward), so
its far edge is parallel to the wall, clipped by the receiving room's
**inner contour** when wall thickness is set (`inset` of the polygon by
half the wall thickness — see `docs/WALL-THICKNESS.md`); otherwise by
the room polygon (`polyclip` intersection). In `outer`, the clip also includes
only the physical rectangular window tunnel between the exterior span and the
clean-floor contour. At oblique incidence, only parallel trajectories which
cross both the exterior and interior spans continue onto the room floor, so
the jamb cuts the visible width instead of letting light pass through the wall
body. The surrounding wall body and outside facade remain occluders. With wall
depth `d`, `inner` translates the source from the
centreline by `+d/2` along the inward normal and `outer` by `-d/2`. Thus the
full source span begins exactly at the selected two corners (`d = 0` makes both
modes identical); in `outer`, a jamb can replace one or both continuing room
edges with a new crisp boundary at the inner face. The nominal length and
gradient start at the selected span rather than adding the wall depth to the old reach.
Its length
is `k(elevation)` in window lengths: ~1.75 at sunrise/sunset tapering to ~0.56 at the zenith
(`0.56 + 1.19·(1 − elevation/90)^1.6` — the v1.56 curve
`0.8 + 1.7·(1 − elevation/90)^1.6` times `RAY_LENGTH_K` = 0.7, owner
2026-08-04: «лучи от солнца сделать короче на 30%»; scaling the whole
curve keeps the "a low sun reaches much further" shape intact). The
color is warm orange while `elevation < 10°` and neutral by day; peak
opacity is `RAY_MAX_ALPHA` = 0.30 (owner 2026-08-03: «лучи поярче,
иногда плохо видны» — raised from 0.18; two overlapping wedges
still stay under a readable ceiling on white paper and on the dark glow
canvas alike).

After room clipping, physical bodies and zero-thickness wall policy cast the
same directional shadows as Glow barriers. A **Dashed** zero wall is absent
from sun occluders; a **Solid** zero wall extrudes its exact axis along the ray
direction and clips the wedge without inventing wall area. The choice is
space-wide, remains active when `show_borders:false` hides the line, and is part
of the sun-geometry cache key.

### Dissolving — along the ray only (owner 2026-08-04)

Two rounds with the owner on the same day:

1. «Проверить, чтобы они всегда плавно рассеивались (сейчас есть
   ощущение, что они упираются во что-то невидимое)» — the wedge was
   ending on a visible line;
2. «С лучами солнца ты сделал фигню — не надо размывать их боковые
   грани» — the first answer to (1) was a Gaussian blur over the whole
   wedge, which feathered the SIDES too. Wrong: a shaft of sunlight
   through a window has crisp sides. Only its reach fades.

So the falloff is one-dimensional: **along the ray, from the selected opening
inward, and nothing else.** Three invariants have to hold at once:

1. the whole selected opening span is at peak alpha — light does not start out
   half-dark at one end of the window;
2. every ray fades over the same distance, its own `len`;
3. the wedge's far edge lies exactly on an iso-alpha line, so the shaft
   dies of its gradient and never of its own outline (that visible
   straight «bright kerb» hanging in mid-floor).

**The axis of the fade is the wall's INWARD NORMAL, not the ray.**
The light is a bundle of PARALLEL rays, so the distance a point has
travelled from the selected source span is `depth / cos`, where `depth`
is its perpendicular distance from that span and `cos = dir·normal` is fixed
for the whole wedge. That is an affine function of the point, and its
level sets are straight lines PARALLEL TO THE WALL. A linear gradient
whose axis is the normal therefore describes the travelled distance
exactly:

- `x1,y1` = the middle of the selected window span (any point of that span —
  they all have depth 0);
- `x2,y2` = that point plus `normal · len · cos` — `SunRay.depth`, the
  perpendicular depth a ray reaches after running the full `len`;
- a point `source + dir·u` lands on offset `u / len`, whichever ray it
  rode in on.

Hence: the selected opening span is all at offset 0 (invariant 1), the alpha at any
point is a function of how far its own ray has run (invariant 2), and
the parallelogram's far edge — parallel to the wall — IS the gradient's
last iso-alpha line (invariant 3). The «30 % shorter» reach is then a
fact about every SIDE of every wedge, at any sun angle.

The stops (`rayStops()`) ease out to **zero at `RAY_FADE_END` = 85 %**
of the axis: `1 → .86 → .60 → .32 → .10 → 0`. The last 15 % of every
wedge is guaranteed empty, so a shaft that ends in mid-air has nothing
left to draw an edge with.

> **DEV-EB173-01 (fixed).** The previous attempt kept the gradient along
> `dir` from the span's midpoint and bent the GEOMETRY to match,
> extruding the two ends of the window by different amounts so both far
> corners projected onto the same point of that axis. It bought
> invariant 3 with the other two: at a grazing sun the ends of the glass
> themselves sat at offsets ±0.879 — one of them fully transparent
> before the shaft even started — and the two sides came out 5.41 and
> 84.19 long (ratio 15.6), the long one 31 % LONGER than the pre-cut 64
> rather than 30 % shorter. One linear gradient along the ray cannot
> satisfy all three; along the normal it satisfies all three by
> construction.

- the two SIDES carry no falloff at all, on purpose. They are hard
  lines, because that is what light through a window looks like. There
  is **no filter, no `feGaussianBlur`, no `clip-path`** anywhere in the
  sun layer — the polygons arrive from `computeSunRays()` already
  intersected with the room, so a wall stops the light by geometry;
- where the room outline does cut a still-lit shaft (the opposite wall,
  the inner corner of an L, an OPEN boundary) the edge stays crisp:
  that is light landing on a wall, and blurring it was the mistake.

Clipping by the room is unchanged; only the visible edge changed.

### The rim — a hairline along the sides (owner 2026-08-04)

The fill above is honest and nearly invisible on a light plan. Painting
light means ADDING luminance, and white paper has none left to give:
raising `RAY_MAX_ALPHA` does not buy contrast, it only tints the room
beige. That rejected analysis is archived in legacy/docs/SUN-CONTRAST.md, whose «shade
instead of light» answer the owner **rejected** on 2026-08-04 in favour
of its cheap half, verbatim: «тонкая (1px) чёрная граница по бокам
светящегося сектора, которая также плавно уходит в ноль вместе с самим
градиентом». Light is invisible on paper; its BOUNDARY is not.

The contract:

- **Two side edges only.** The rim runs along the two edges that leave
  the selected opening corners and travel inward with the ray — `a → a+dir·len`
  and `b → b+dir·len`. Never the source edge `a-b` (that is the source,
  not a boundary) and never the far edge (there is nothing left to
  outline there — the fill is already at zero, see below).
- **One screen pixel at any zoom**: `stroke-width="1"` plus
  `vector-effect="non-scaling-stroke"`, so the hairline is a hairline on
  a phone, on a 4K kiosk and at any zoom level of the infinite canvas.
- **Black**, and it dies exactly with the fill. A second gradient
  `hp-sunrim-N` is emitted next to `hp-sun-N` with **the same
  `x1,y1,x2,y2`** (the wall's inward normal, `depth` long) and **the same
  normalised curve** — `rimStops()` returns `rayStops()` by identity, not
  by copy, so the two can never drift apart. Only the colour and the peak
  differ: `RIM_MAX_ALPHA` = 0.42 at the selected opening, tuned on the demo rig
  against both extremes (below ~0.3 the line vanishes on paper at kiosk
  scale, above ~0.5 it reads as an ink contour over the dark glow
  canvas). Zero from `RAY_FADE_END` = 85 % on, like the fill.
- **Clipped by the room like the wedge**, and for free: `rayRimEdges()`
  cuts the sides out of the ALREADY clipped polygons — a boundary segment
  belongs to a side iff both of its ends lie on that side's line —
  merging collinear pieces so an unclipped wedge yields exactly two
  lines. No `clip-path` enters the sun layer, and light still cannot
  cross a wall.
- **The same life as the wedge.** The rim lives inside the same
  `<g class="sunlayer">`, so the 3° threshold, the 2 s layer fade,
  `prefers-reduced-motion`, night, the editors and the memo key all apply
  to it without a line of extra logic.

### The 3° threshold and the 2-second fade

Wedge opacity does NOT depend on elevation any more — the old ramp-in
over the first ~2° is gone. The contract (owner 2026-08-03) is a hard
threshold:

- `elevation < 3°` → NO rays at all;
- `elevation ≥ 3°` → rays at full strength (`rayPeakAlpha`).

Crossing the threshold is animated, but on the LAYER, never on the
geometry: the `<g class="sunlayer">` fades in with `hp-sunfade-in` and
out with `hp-sunfade-out`, both exactly 2 s (`RAY_FADE_MS` in
`src/sun.ts` must stay in sync with `styles.ts`). To let the fade-out
play at all, the card keeps the layer mounted with `.out` for those two
seconds and only then drops it. `prefers-reduced-motion: reduce` skips
the animation entirely — the rays are simply there or simply gone.

Everything else that removes wedges — leaving view mode, switching the
feature off or night (`elevation ≤ 0`) — is instant: those are not
threshold crossings, and a wedge lingering while you enter the editor
would just be a bug.

Layer order: ABOVE room fills (and the glow layer), BELOW devices and
labels (those live in the HTML `devlayer` anyway). Night
(`elevation ≤ 0`) → no wedges. Wedges work under BOTH `bg_mode`s.

## 2.5D: the soft sun wash (#649)

In the 2.5D View (General settings › Display › Show the plan in 2.5D) the Flat
wedges above give way to a soft wash along the real sun (`src/iso-sun.ts`). Flat
and its wedges are unchanged. Everything that gates the wedges gates the wash:
`sun_rays` (global or per space), `north_deg`, `sun.sun`, elevation ≥ 3° with the
2-second fade, nothing in editors or at night, and the same windows
(`windowLit()`: an exterior window not on a partition facing the sun).

H is the 2.5D wall height; the lab (sketch 07) numbers are converted into it.

- **Base** — the two inner corners of the opening on the inner wall face
  (`openingInnerFaceOffsetFromIndex`, as in Flat).
- **Length along the window normal** —
  `L = H · min(4.16, max(0.98, 1.865 · (0.55 + 1.4 · (1 − e/90)^1.6)))`, e the
  elevation in degrees: a low sun throws a long beam.
- **Shape** — the parallelogram `a0, a1, a1 + s, a0 + s`,
  `s = n·L + t·L·(dir·t)/(dir·n)`, clipped by the room's inner outline and the
  Flat occluders; the fill is blurred by 0.064 H, the sides are not blurred
  separately.
- **Gradient** along the normal, opacity × 1 (there is no brightness setting;
  the lab default 72 % is the constant): dark floor `#ffe9b4` .62 → `#fff0cb`
  .38 @.3 → `#fff6e0` .12 @.65 → `#fff8e8` 0; light floor `#e2b95e` .46 →
  `#e9c97e` .30 @.3 → `#f0dcaa` .10 @.65 → `#f4e6c4` 0.
- **Streaks — light floor only**: two lines 0.018 H inside the sides, 0.018 H
  wide, 85 % of s long, `#ecc46a` .8 → `#f1d48f` .35 @.55 → `#f7e6bf` 0.
- **Sill** — a line along the inner face over the opening width, 0.073 H thick,
  `#efd493` (light floor) or `#fff3cf`, opacity .6, blur 0.023 H.
- **Light floor** — the window room's fill at its opacity over the plan paper,
  luma > 0.55.

The wash lives where the Flat `.sunlayer` lives (floor group, above room fills
and Glow) as `.sunlayer.iso-sunwash`, one `.iso-sunbeam[data-opening]` per lit
window. Witness: `demo/smoke_iso_sun.mjs`.

## Moon — `settings.moon` (#661, any background since #718)

At dawn, dusk and night, with any background, the moon in its current phase
stands in the top-left corner of the scene: a thin crescent, a half, a full
disc. General settings › Sun and Moon › «Moon over the plan at dusk and night»
switches it for the whole installation; there is no per-space moon switch.

**When it is shown** — all at once, otherwise there is no moon:

- `settings.moon === true` (global; absent, `false` or anything else is off);
- the day-cycle phase is `dawn`, `dusk` or `night`: `resolveDayCycle(hass,
  now)`, whatever the background — with a valid `sun.sun` (`dayCycleSunOf`:
  finite azimuth and elevation, boolean `rising`) day is elevation ≥ 6°
  (exactly 6° is day), otherwise the browser-local clock, day 08:00–18:00. The
  effective `bg_mode` of the space is not a condition (#718 K1);
- the topocentric altitude is ≥ 3° (`MOON_ELEVATION_MIN = RAY_ELEVATION_MIN`);
- the illuminated fraction is ≥ 3 % (`MOON_MIN_ILLUMINATION`, about ±1.5 days
  around new moon);
- a View surface: View, kiosk, panel or `houseplan-space-card` (editors, the
  PDF export and the space dialog preview have no moon);
- `hass.config.latitude/longitude` are finite numbers.

**Where the numbers come from.** Home Assistant publishes no moon altitude
(`sun.sun` is the sun; the optional Moon integration gives eight phase names
without altitude, illumination or hemisphere). The card computes both from the
home coordinates and the browser clock (`src/moon.ts`): the short Meeus series
as in SunCalc, the topocentric parallax `h − π·cos h` with
`π = asin(6378.14 / distance)`, no refraction; the illuminated fraction
`k = (1 + cos i) / 2` from the Sun–Moon elongation. Against JPL Horizons
(airless) on twelve points in Moscow and Sydney, October 2026: altitude within
1.39°, illumination within 1.77 percentage points (`test/moon.test.mjs`, the
table and the query parameters are in the test).

**Phase.** One designer image of the full moon (`assets/moon/houseplan-1.0.0`,
art by JB) under an SVG mask. The lit side is **always the left one**, in both
hemispheres; waning runs the waxing states backwards (owner 2026-09-29). The
lit region is the left half of the box plus or minus the terminator
half-ellipse `R × R·|2k − 1|` (bulging into the dark side when `k > 0.5`); the
half's outer arc runs along the box, never along the limb, so the disc keeps
the art's own anti-aliased edge. The mask is a `<mask>`, not a `clipPath`
(Chrome with GPU rasterisation draws clip edges jagged). The terminator is
feathered by a Gaussian blur inside the mask (5 units of 512, about 2 px at
200 px), except for a full disc (`k ≥ 0.995`). The phase is continuous in `k`,
quantised to 0.01 only so the element changes when the fingerprint does. The
dark side is the same art at 8 % opacity.

**Place, size, layer.** Fixed top-left corner, box `min(200px, 25cqmin)` of the
scene, inset 5 % of the box; it does not move with pan or zoom and never takes
the pointer. Over "Follow the Sun" it is the last child of `.hp-day-cycle-env`:
above the phase gradients and the sun glow, below the plan paper, rooms,
devices, labels and UI. A plan that fills the scene covers the moon partly or
entirely — that is the environment's norm, like the sun glow (owner
decision 7).

**Static background (#718 K3).** No environment is created — no
`.hp-day-cycle-env`, no `daycycle`/`phase-*` classes, no
`.hp-paper-outline-svg`; the scene keeps the chosen colour or the theme's. The
same `.hp-moon` element stands in its own layer `<div class="hp-moon-sky"
aria-hidden="true">`, the first child of `.stage` (full card) or
`.hp-static-stage` (space card) — where the environment would be. The layer is
the whole scene (`position:absolute; inset:0; overflow:hidden;
pointer-events:none; container-type:size`), so the box and place are the same;
it has no `z-index`, `filter` or `will-change` and lies under the plan by DOM
order (`.zoomwrap` and the space card's plan are `z-index:1`). The layer's
`opacity` is the View weight of the #101 transition, as the environment's;
editors have neither. Switching between `daynight` and `static` (a space tab,
the background segment previewed in the open dialog, a config push) moves the
element to its new parent in the same render, in its final state, on the same
box — no flicker. The chunk renders and styles the layer; until it is here
there is no layer.

**Movement.** Opacity only, 2 s on the background curve (`RAY_FADE_MS`),
none under `prefers-reduced-motion`: rising through 3°, setting through it,
the new-moon threshold and the day phase all fade; the first appearance after
a page or chunk load does not. The element is recomputed on every render of the
environment and by its own 30 s ticker (the moon rises at most 0.25°/min);
the ticker keeps the last rendered inputs, and an equal fingerprint
(`visible | k`) costs no render. A card that renders without a moon, leaves the
page or is hidden drops or pauses its ticker.

With a static background the phase for the moon comes from the same
`resolveDayCycle` (`moonSkyState` in `src/moon-gate.ts`), computed only while
the moon is on and the surface is View. With `sun.sun` it follows the Home
Assistant state updates the cards already re-render on. Without it the card
keeps its 30 s clock ticker (`_syncDayCycleClock`, both cards) and re-renders
only when the phase changes (`dayCycleClock`: the environment is compared by
its whole fingerprint, the moon's sky by its phase), so the moon leaves at
08:00 and comes at 18:00 without a state update. The moon switched off or an
editor: no phase, no ticker.

**Weight.** Astronomy, art (≈ 9 KB gzip), template, the static-background
layer and the status function are one lazy chunk, `moon-runtime-*`, loaded
when the moon is switched on on a View surface and it is not daytime — with any
background — and when General settings open (for the status line, by day and
with the moon off too). One load per page through the gate's loader
(`withMoon`): a chunk of another build is never installed, a failed load is
retried at most every 30 s, and every caller meanwhile waits for the same load.
The initial View graph carries only the gate (`src/moon-gate.ts`); the editor
graph only the status line and its strings (`src/editors/moon-status.ts`) —
`src/moon.ts` is in neither (`scripts/bundle-budget.mjs` refuses an overlap of
the moon graph with the initial or the editor graph). One element, no CSS
filter and no `will-change`: the composited layer count does not change, with
either background (`demo/smoke_daycycle_layer_budget.mjs`).

**Status line (#718 K7).** Under the switch in General settings a second
caption line, inside `aria-describedby`, no `aria-live`, anchored
`data-moon-status="shown|no_home|day_sun|day_clock|low|new"`: «Now: shown (24°
above the horizon, 79% lit).» or «Now: not shown (reason).», the first reason
that holds — no home coordinates; day (by `sun.sun` with its elevation, or by
the clock); the moon below 3°; under 3 % lit. It is judged once per opening on
a snapshot taken when the dialog opens (`now`, `hass.config`, `sun.sun`), as
if the switch were on — the moon no longer depends on the background, so one
status serves the installation; the switch, «Reset» and the background segment
do not change it. `moonStatus` in `src/moon.ts` decides «shown» with the same
`moonShownAt` as the element (AC10 checks the equivalence every hour of a
month), rounds to whole numbers and keeps a hidden reason's number below its
threshold (2.6° reads «2°»). The status lives beside the draft, never in it:
the line arriving leaves «Save» disabled. While the chunk loads, or when it
failed, there is no line; a closed opening's result is dropped. A warm revive
of the dialog (the card replaced, `docs/WARM-REMOUNT.md`) is an opening too:
its own snapshot, asked through the lazy editor runtime once it is there;
nothing is carried over from the replaced card (#731). The line
belongs to the browser the dialog is open in — a wall tablet with another
clock or time zone may differ.

**Limits (documented, not bugs).**

- Position accuracy ≈ 1°: the moment of crossing 3° may differ from ephemerides
  by a few minutes.
- The terminator is not tilted by the parallactic angle, and the lit side does
  not follow the hemisphere (owner decision): the crescent is "vertical".
- Earthshine is not modelled; the dark side is an 8 % silhouette for legibility.
- The moon does not follow its azimuth — fixed corner of the scene.
- One art for every background (owner decision, #718): on a mid-grey custom
  colour the disc has less contrast than on white or at night.
- A dense layout (plan filling the screen) shows only the part of the disc in
  the margins.
- Coordinates come from Home Assistant: an installation that kept the default
  home location gets someone else's moon, as it gets someone else's `sun.sun`.
- A wrong tablet clock gives a wrong phase and moment — the same class as the
  background's clock fallback.

## Weather independence and legacy `weather_entity`

Weather never changes the window rays. Once the feature, compass,
geometry and solar elevation allow a wedge, it is painted at full
strength regardless of any `weather.*` state. This keeps the plan a
stable geometric visualisation instead of making sunlight disappear
because of a provider-specific weather classification.

`settings.weather_entity` was used by older versions. It is no longer
shown or read by the frontend. Backend validation continues to accept
the old string/null field so existing stored configs remain loadable;
saving General settings removes it.

## Edge cases and limits

- No valid `sun.sun` sample → the background follows browser-local time;
  window rays stay off and the settings dialog explains the fallback.
- `north_deg` unset everywhere → the background still works; window rays stay
  off and the settings dialog shows the compass hint.
- Any weather state, including rain and snow → no effect on rays.
- `prefers-reduced-motion` → no transitions; colors and wedges render
  statically for the current sun position.
- Kiosk mode → works (same view path).
- Static `houseplan-space-card` → the background honours the effective
  four-phase `bg_mode`/color and fallback lifecycle; wedges are FULL-CARD ONLY.
- Editors (plan/devices/decor) → no wedges and no four-phase environment: the
  editor canvases render exactly as before.
- Mutual shading of the building's own wings (an L-shaped house
  shadowing its inner corner) is NOT computed — a lit window casts its
  wedge even when another wing geometrically blocks the sun. Accepted
  v1 limit.
- Wedges of windows on all four wall orientations are unit-tested,
  including the 359→0 azimuth wrap.

## Files

- `src/sun.ts` — pure logic (angles, day phase, exterior walls, wedge
  quads + clipping, the rim edges and its stops, settings
  inheritance); unit-tested in `test/sun.test.mjs`.
- `src/day-cycle-render.ts` — the shared constant environment layers and
  plan-outline variables for full and static cards.
- `src/moon.ts`, `src/moon-runtime.ts`, `src/moon-gate.ts`,
  `src/moon-art.generated.ts` — the moon (#661, #718): pure astronomy, mask and
  status, the lazy chunk with the element, the static-background layer and the
  ticker, the initial-graph gate with the page-wide loader, the generated art
  (`node scripts/generate-moon-assets.mjs` from `assets/moon/houseplan-1.0.0`);
  `src/editors/moon-status.ts` — the General settings line. Unit-tested in
  `test/moon.test.mjs` and `test/moon-settings.test.mjs`, end-to-end in
  `demo/smoke_moon.mjs`, `demo/smoke_moon_static.mjs` and
  `demo/smoke_moon_status.mjs`.
- `src/houseplan-card.ts` — the memoised wedge layer, four-phase background
  lifecycle, and both settings dialogs (compass dial included).
- `src/space-render.ts` / `src/space-card.ts` — static-card environment and
  visible-only clock lifecycle.
- `custom_components/houseplan/validation.py` — the three active sun
  settings plus the accepted legacy global weather field; tests in
  `tests_backend/test_validation.py`.
- `demo/smoke_sun.mjs` — end-to-end behaviour against the demo rig.
- `demo/smoke_sun_soft.mjs` — the −30 % reach and the "dissolves along
  the ray only" contract: the gradient axis is the wall normal and is
  `len · cos` long, an offset is exactly how far a ray has run, the
  stops die at 85 %, the sides are sharp (no filter on the wedge, no
  `feGaussianBlur` at all), and at an oblique sun nothing is drawn past
  the end of the gradient — the kerb cannot come back. It re-runs the
  DEV-EB173-01 grazing repro end to end (west window 80, elevation 90,
  azimuth 190): equal sides of the nominal length, peak alpha at BOTH
  ends of the source span, and no wedge at all below `RAY_MIN_COS`.
- `demo/smoke_sun_rim.mjs` — the rim: exactly two lines per wedge, on the
  two SIDE edges (their coordinates checked against the wedge's own
  vertices), `url(#hp-sunrim-N)` with BLACK stops on the same axis and
  the same offsets as the fill, monotone and dead at 85 %,
  `vector-effect: non-scaling-stroke` at width 1, gone below 3° and in an
  editor, unaffected by legacy weather settings — and a pixel probe on
  WHITE paper proving the side of the wedge is measurably darker than the paper on either hand
  (the point of the whole change).
- `demo/smoke_sun_live_bg.mjs` — phases follow real samples on plain `hass`
  ticks, the plan remains unfiltered, compass independence and atomic clock
  fallback are preserved, and the fallback timer follows visibility.
- `demo/golden/matrix.mjs` — deterministic dawn/day/dusk/night visual scenes.
- `demo/shot_sun_short.mjs` — stills at a low and a high sun
  (`node demo/shot_sun_short.mjs <outdir> <prefix>`).
- `demo/shot_sun_rim.mjs` — the rim on white paper and on the dark glow
  canvas, the same frame at several rim peaks (0 = before), which is how
  `RIM_MAX_ALPHA` was chosen: `node demo/shot_sun_rim.mjs <outdir>
  [0,0.3,0.42,0.5]`.
