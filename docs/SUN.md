# Sun on the plan — the spec (source of truth)

Status: approved by the owner 2026-08-03. Shipped in v1.56.0.
Scope decisions final: the compass lives in the GENERAL settings with a
per-space override, the feature is silent until `north_deg` is set
anywhere, wedges ship for the FULL card only in v1, and mutual shading
of the building's wings is explicitly NOT computed.

## Principle

The plan learns where north is, and from that single number plus HA's
own `sun.sun` the card knows where the sun stands relative to every
wall. Two visuals follow: the stage background can breathe with the
day (day → golden hour → dusk → night), and windows on exterior walls
cast soft wedges of light into their rooms. Everything is display
only — no entities are created, no services are called.

## Data

- Source: the `sun.sun` entity (`attributes.azimuth` 0–360, 0 = north,
  clockwise; `attributes.elevation` in degrees, negative below the
  horizon). No `sun.sun` in the install → the whole feature stays
  silent and the settings dialog says why.
- Sun attributes update rarely (~30–120 s). Sun geometry is recomputed
  ONLY when (azimuth, elevation) or the config change — never on every
  `hass` tick. The wedge layer memoises on
  `(azimuth, elevation, config rev, space id)`.
- Angle on the plan: `plan_angle = azimuth − north_deg` (normalised to
  0–360). With `north_deg = 0` the top of the canvas is north; the
  direction TOWARD the sun on the canvas is
  `(sin(plan_angle), −cos(plan_angle))` (y grows downward).

## Compass — `settings.north_deg`

- Integer 0–359, degrees clockwise from "up on the canvas" to true
  north. Lives in the GENERAL settings (⚙) as a circular dial: drag
  the «N» arrow around the ring, 1° steps, 15° with Shift held; a
  plain number input sits next to it for accessibility and precision.
- Per-space override in the space settings (empty = inherit), the same
  pattern as `show_lqi` / `fill_mode`.
- While `north_deg` is null at BOTH levels the whole sun feature is
  inert: static background, no wedges, nothing computed. The settings
  dialogs show a hint.
- Backend validation: integer in 0–359 at both levels.

## Plan background — `settings.bg_mode: 'static' | 'daynight'`

- Global default in the general settings, per-space override (null =
  inherit). Default `'static'`.
- `'static'` — the existing `bg_color` behaviour, color picker and
  all. Nothing changes for existing installs.
- `'daynight'` — the stage background follows the sun's elevation:
  WHITE at full day (the brightest moment of the day is white — owner,
  2026-08-03), a warm bright shift in the golden hour (elevation below
  ~10°), cooling through dusk, deep darkening at night. The scale
  (piecewise-linear between stops, `BG_STOPS` in `src/sun.ts`):

  | elevation | color | phase |
  | --- | --- | --- |
  | −90°…−12° | `#070c14` | deep night |
  | −4° | `#131a28` | dusk cools down |
  | 0° | `#4a3527` | warm band right at the horizon |
  | +10° | `#e8ddcf` | morning light — warm and bright |
  | +30°…+90° | `#ffffff` | plain day, white |
 The PLAN
  itself dims only ~10% at night (`filter: brightness(.9)`), so the
  daytime room fills stay readable. Transitions are a CSS
  background/filter transition tens of seconds long;
  `prefers-reduced-motion` gets the current colors statically.
- **Glide, but never lag behind reality** (owner 2026-08-04: «цвет фона
  не меняется сам с течением времени суток, только после
  обновления страницы»). The sky colour and the plan dimming are
  delivered by a 45 s CSS transition, and a CSS transition only advances
  while the card is being PAINTED. A card that was not painting — a
  background tab, another dashboard view, a sleeping wall tablet, an
  editor session — comes back holding a stale sky and then crawls toward
  the truth 45 s at a time; a page reload, by contrast, paints the right
  colour outright, because a freshly mounted element has nothing to
  transition FROM. So the card measures the gap: HA refreshes `sun.sun`
  every ~4 minutes by day, i.e. ≤1° per update, and anything from
  `SKY_SNAP_DEG` = 3° up therefore means "we were not watching". Such a
  step is applied with `transition: none` for a single frame
  (`.stage.daynight.skysnap`, released on the next
  `requestAnimationFrame`); everything smaller keeps the 45 s breathing.
  `visibilitychange → visible` arms the catch-up outright.
- The elevation the sky is computed from is rounded to 0.1°
  (`skyElevation()`) — finer than the eye can tell across a 45 s glide,
  and it keeps `dayPhase` (and the style attribute lit has to commit)
  from churning on every `hass` tick. The wedge GEOMETRY keeps its own,
  coarser memo: the two have deliberately different granularity — the
  sky is cheap, the polygon clipping is not.
- The UI is a two-option selector; the color picker shows only for
  `'static'`.
- Backend validation: `In(['static', 'daynight'])` at both levels.
- `'daynight'` follows the general gate: without `north_deg` (or
  without `sun.sun`) it behaves as `'static'`.
- **The scene background never bleeds through the plan** (owner,
  2026-08-03). In BOTH modes the background — `bg_color` or the
  daynight sky — is visible only AROUND the plan: opaque `.hp-paper`
  shapes sit under everything the plan draws. An image plan papers the
  backdrop image rect (the canvas IS the paper); a hand-drawn plan
  papers the ROOM CONTOURS — one shape per room in exactly the room's
  own geometry (fill only, no stroke), never their bounding box, so
  the background reaches the exterior walls of an L-shaped house and
  fills the gaps between detached buildings (an empty drawn space has
  no paper). Open (virtual) boundaries do not affect the paper; a live
  resize preview moves it together with the rooms. Its colour is the
  pre-bg_color canvas — white for hand-drawn plans, the theme card
  background under an image. The night dimming above is the
  `brightness` filter on the zoomwrap ONLY; the paper's alpha never
  changes. Applies to view/kiosk/editors and the static space-card
  alike (smoke_bg_color).

## Window light wedges — `settings.sun_rays`

Boolean, global + per-space (null = inherit), default OFF.

For every opening of type «window» sitting on an EXTERIOR wall — a
wall stretch with no other room on its outer side, decided by probing
the existing room geometry just off both sides of the window; windows
on interior walls do not participate, and open (virtual) boundaries
never qualify because both sides are rooms — the card draws a wedge
when BOTH hold:

- the sun is above the horizon (`elevation > 0`), and
- the dot product of the wall's outward normal with the direction
  toward the sun — the cosine of the angle of incidence — is above
  `RAY_MIN_COS` = 0.05, i.e. the sun faces this window AND clears the
  plane of its wall by ~2.9° (~87.1° of incidence). Below that there is
  nothing to paint: glass reflects almost all of it, and the shaft's
  perpendicular depth (`len · cos`, see «Dissolving») would be thinner
  than the wall it came through.

The wedge is a PARALLELOGRAM: the window's full **room-side span**, from
one inner corner of the opening to the other, extruded by the same
length along the direction AWAY from the sun (light falls inward), so
its far edge is parallel to the wall, clipped by the receiving room's
**inner contour** when wall thickness is set (`inset` of the polygon by
half the wall thickness — see `docs/WALL-THICKNESS.md`); otherwise by
the room polygon (`polyclip` intersection). With wall depth `d`, the
source span is translated from the wall centreline by `d/2` along the
inward normal. Thus both crisp side edges begin exactly at the two inner
corners of the opening at every incidence angle (`d = 0` keeps the
previous centreline/full-span geometry). Its length
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

### Dissolving — along the ray only (owner 2026-08-04)

Two rounds with the owner on the same day:

1. «Проверить, чтобы они всегда плавно рассеивались (сейчас есть
   ощущение, что они упираются во что-то невидимое)» — the wedge was
   ending on a visible line;
2. «С лучами солнца ты сделал фигню — не надо размывать их боковые
   грани» — the first answer to (1) was a Gaussian blur over the whole
   wedge, which feathered the SIDES too. Wrong: a shaft of sunlight
   through a window has crisp sides. Only its reach fades.

So the falloff is one-dimensional: **along the ray, from the room-side opening
inward, and nothing else.** Three invariants have to hold at once:

1. the whole room-side opening is at peak alpha — light does not start out
   half-dark at one end of the window;
2. every ray fades over the same distance, its own `len`;
3. the wedge's far edge lies exactly on an iso-alpha line, so the shaft
   dies of its gradient and never of its own outline (that visible
   straight «bright kerb» hanging in mid-floor).

**The axis of the fade is the wall's INWARD NORMAL, not the ray.**
The light is a bundle of PARALLEL rays, so the distance a point has
travelled from the room-side source span is `depth / cos`, where `depth`
is its perpendicular distance from that span and `cos = dir·normal` is fixed
for the whole wedge. That is an affine function of the point, and its
level sets are straight lines PARALLEL TO THE WALL. A linear gradient
whose axis is the normal therefore describes the travelled distance
exactly:

- `x1,y1` = the middle of the room-side window span (any point of that span —
  they all have depth 0);
- `x2,y2` = that point plus `normal · len · cos` — `SunRay.depth`, the
  perpendicular depth a ray reaches after running the full `len`;
- a point `source + dir·u` lands on offset `u / len`, whichever ray it
  rode in on.

Hence: the inner opening span is all at offset 0 (invariant 1), the alpha at any
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
  the inner opening corners and travel inward with the ray — `a → a+dir·len`
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
  differ: `RIM_MAX_ALPHA` = 0.42 at the inner opening, tuned on the demo rig
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

- No `sun.sun` → silent feature + a hint in the settings dialog.
- `north_deg` unset everywhere → silent feature + a hint.
- Any weather state, including rain and snow → no effect on rays.
- `prefers-reduced-motion` → no transitions; colors and wedges render
  statically for the current sun position.
- Kiosk mode → works (same view path).
- Static `houseplan-space-card` → the background honours the effective
  `bg_mode`/color; wedges are v1 FULL-CARD ONLY (documented limit).
- Editors (plan/devices/decor) → no wedges and no day/night: the
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
- `src/houseplan-card.ts` — the memoised wedge layer, the day/night
  stage background, both settings dialogs (compass dial included).
- `src/space-render.ts` — the static card's background only.
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
- `demo/smoke_sun_live_bg.mjs` — the sky follows `sun.sun` on a plain
  `hass` tick with no reload, asserted on the COMPUTED background of the
  stage; small steps still glide, big ones catch up at once.
- `demo/shot_sun_short.mjs` — stills at a low and a high sun
  (`node demo/shot_sun_short.mjs <outdir> <prefix>`).
- `demo/shot_sun_rim.mjs` — the rim on white paper and on the dark glow
  canvas, the same frame at several rim peaks (0 = before), which is how
  `RIM_MAX_ALPHA` was chosen: `node demo/shot_sun_rim.mjs <outdir>
  [0,0.3,0.42,0.5]`.
