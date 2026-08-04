# Sunlight that reads on a light plan — the spec

Status: **approved in principle, not implemented.** Planned for the release
after v1.58.0. Owner asked for the spec first (2026-08-04); nothing in this
document is code yet. Builds on docs/SUN.md, which describes what ships today.

## The problem

Today a lit window casts a warm translucent wedge (docs/SUN.md). It reads
beautifully on a dark scene — glow fill, night, a dark theme — and almost
disappears on a light one, which is now the common case: `bg_mode: daynight`
makes a clear day **white**, and a hand-drawn plan's paper is white too.

The cause is not opacity, it is physics. Painting light means adding
luminance, and white has none left to give. Raising the alpha does not add
contrast, it only tints the paper towards beige until the whole room looks
dirty. Any fix has to take its contrast from something other than brightness.

## The model: paint the shade, not the light

On a light scene the wedges invert. The lit areas stay untouched paper; the
**rest of the room** gets a light, cool veil. Contrast now comes from the
unlit part, which has plenty of room to go darker, and the wedge becomes a
window of clean paper inside a softly shaded room.

This is how architects draw insolation on white sheets, and it stays
physically honest: a sunlit room really is brighter where the shaft lands.
It also rhymes with the mode we already have — glow paints a dark house with
pools of lamp light; this paints a light house with the shade between shafts.

Geometrically it is the same wedge polygon, used as a hole: a veil rectangle
over the room's polygon, minus the wedges (an even-odd path, or a mask). The
maths of `computeSunRays()` does not change at all — only what we do with the
result.

## Switching between the two

Automatic, by the luminance of what the wedge is drawn on (the paper under
the room, or the scene colour where a picture backdrop shows through):

- luminance below the threshold → **light model** (today's warm wedge);
- above it → **shade model** (veil with wedge-shaped holes).

The threshold sits around mid-grey; the exact value is a visual decision to be
made against real plans, dark and light themes, and the day/night palette.
Whether this is fully automatic or also offered as an explicit choice is an
open question (below).

## Two amplifiers, both models

**A rim on the wedge.** Light is invisible but its boundary is not: a hairline
warm stroke along the two side edges of the shaft, fading out with the shaft
itself. It costs one stroke, works on any background, and gives the shape a
"beam" reading even when the fill is nearly transparent. In the shade model
the same rim marks the edge of the veil hole.

**A mark on the window.** Independent of the wedges: a lit window gets a
thicker warm stroke and a short arrow along the sun direction. It answers the
question "which windows is the sun in right now" without reading the floor,
and it survives everything the wedge does not — furniture-heavy plans, room
fills, small kiosk scale, a wedge clipped to almost nothing by a narrow room.

## Colour

The veil is cool and desaturated (a blue-grey), never black: a black veil
reads as a printing defect and fights the room fills. Its opacity is small —
the target is a perceptible step, not a dimmed room; the value is to be tuned
visually, in the same order as the wedge alpha today.

The light model keeps its warm ramp near the horizon (docs/SUN.md), but should
lean on **hue rather than luminance** on medium backgrounds: an amber tint
reads as colour even where it cannot read as brightness.

## What must not break

- **Room fills.** Temperature and LQI fills carry meaning; the veil must not
  be mistaken for them, and must not shift their perceived colour more than
  marginally. The veil goes under the fills, not over.
- **The 3° threshold and the two-second fade** (docs/SUN.md) apply unchanged
  to whichever model is active. Crossing the luminance threshold — a theme
  switch, day turning to night — must cross-fade between models, never pop.
- **Cloudiness** keeps dimming the effect, in the shade model by thinning the
  veil.
- **Editors** stay neutral, as today: no sun, no day/night.
- **The static card and kiosk** must pick the same model as the full card on
  the same plan; the choice is a pure function of the background.
- **prefers-reduced-motion**: no cross-fade, switch instantly.
- **Performance**: one veil path per room per render at most, memoised on the
  same key as the wedges.

## Open questions for the owner

1. Automatic switching only, or also an explicit setting «свет / тень / авто»
   in the space dialog? (Automatic is one less knob; explicit lets someone on
   a light theme keep the warm wedges if they like them.)
2. Does the veil cover the whole room, or only the part of the room the sun
   could reach at all (the room's window-facing side)? Whole-room is simpler
   and reads as "this room is in shade"; partial is subtler.
3. Should the window mark be always on, or follow the same «Solar rays»
   toggle?

## Testing notes (for when this is built)

Unit: the model chooser is a pure function of a colour → assert the switch at
the threshold, both sides, plus junk input. The veil-with-holes geometry:
holes equal the wedges, an unlit room gets a plain veil, a room with no
exterior window gets nothing.

Browser: on a white paper plan a lit wedge is measurably lighter than its
surroundings (sample pixels inside and outside the wedge — the current
implementation would fail this, which is the point); on a dark scene nothing
changes versus today; crossing the threshold cross-fades; room fills keep
their identity; the window mark appears exactly on lit windows.
