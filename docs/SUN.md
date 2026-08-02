# Sun on the plan — the spec (source of truth)

Status: approved by the owner 2026-08-03. Dev-only for now (no release).
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
  `(azimuth, elevation, config rev, space id, weather state)`.
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
  neutral by day, a warm shift in the golden hour (elevation below
  ~10°), cooling through dusk, deep darkening at night. The PLAN
  itself dims only ~10% at night (`filter: brightness(.9)`), so the
  daytime room fills stay readable. Transitions are a CSS
  background/filter transition tens of seconds long;
  `prefers-reduced-motion` gets the current colors statically.
- The UI is a two-option selector; the color picker shows only for
  `'static'`.
- Backend validation: `In(['static', 'daynight'])` at both levels.
- `'daynight'` follows the general gate: without `north_deg` (or
  without `sun.sun`) it behaves as `'static'`.

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
  toward the sun is positive (the sun actually faces this window).

The wedge is a quadrilateral cast from the window's span along the
direction AWAY from the sun (light falls inward), clipped by the
room's polygon (`polyclip` intersection, the same dependency
`src/resize.ts` already uses). Its length is `k(elevation)` in window
lengths: ~2.5 at sunrise/sunset tapering to ~0.8 at the zenith
(`0.8 + 1.7·(1 − elevation/90)^1.6`). A linear gradient runs bright at
the window and dissolves inward; the color is warm orange while
`elevation < 10°` and neutral by day; peak opacity is modest (~0.18 —
two overlapping wedges never exceed a readable ceiling). Near the
horizon the opacity ramps in over the first ~2° so wedges never pop.

Layer order: ABOVE room fills (and the glow layer), BELOW devices and
labels (those live in the HTML `devlayer` anyway). Night
(`elevation ≤ 0`) → no wedges. Wedges work under BOTH `bg_mode`s.

## Cloud cover — `settings.weather_entity` (optional)

String entity id or null; GLOBAL settings only. When set and the
entity's state reads overcast, the wedges fade by an opacity
multiplier — ~0.25 fully overcast, 0 (gone) in rain/snow:

| states | factor |
| --- | --- |
| clear, sunny, clear-night, windy, exceptional, unset entity | 1.0 |
| partlycloudy, windy-variant | 0.7 |
| cloudy | 0.4 |
| overcast, fog | 0.25 |
| rainy, pouring, snowy, snowy-rainy, hail, lightning, lightning-rainy | 0.0 |
| unknown, unavailable | 1.0 (a dead sensor must not kill the sun) |

Backend validation: string or null.

## Edge cases and limits

- No `sun.sun` → silent feature + a hint in the settings dialog.
- `north_deg` unset everywhere → silent feature + a hint.
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
  quads + clipping, cloud factor, settings inheritance); unit-tested
  in `test/sun.test.mjs`.
- `src/houseplan-card.ts` — the memoised wedge layer, the day/night
  stage background, both settings dialogs (compass dial included).
- `src/space-render.ts` — the static card's background only.
- `custom_components/houseplan/validation.py` — the four settings at
  both levels; tests in `tests_backend/test_validation.py`.
- `demo/smoke_sun.mjs` — end-to-end behaviour against the demo rig.
