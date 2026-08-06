# Sunlight that reads on a light plan — the rejected model

Status: **REJECTED by the owner on 2026-08-04.** The model below was
approved in principle a few hours earlier and never became code. The owner
cancelled it in favour of one line out of it — the rim — which IS
implemented and specified in [`docs/SUN.md`](../../docs/SUN.md), section «The rim».

This file is kept for one reason: the analysis of *why* a wedge of light
cannot read on white paper is correct, it is what the rim answers, and it
is the first thing anyone will have to re-derive the next time somebody
proposes «просто сделай лучи поярче».

## The problem (this part still holds)

Today a lit window casts a warm translucent wedge ([`docs/SUN.md`](../../docs/SUN.md)). It reads
beautifully on a dark scene — glow fill, night, a dark theme — and almost
disappears on a light one, which is now the common case: `bg_mode: daynight`
makes a clear day **white**, and a hand-drawn plan's paper is white too.

The cause is not opacity, it is physics. Painting light means adding
luminance, and white has none left to give. Raising the alpha does not add
contrast, it only tints the paper towards beige until the whole room looks
dirty. Any fix has to take its contrast from something other than
brightness.

## What was proposed: paint the shade, not the light

On a light scene the wedges would invert. The lit areas stay untouched
paper; the **rest of the room** gets a light, cool veil, so the contrast
comes from the unlit part, which has plenty of room to go darker, and the
wedge becomes a window of clean paper inside a softly shaded room. This is
how architects draw insolation on white sheets, and it is physically
honest: a sunlit room really is brighter where the shaft lands.

Geometrically it is the same wedge polygon used as a hole — a veil over the
room's polygon, minus the wedges (even-odd, or a mask). `computeSunRays()`
would not change at all; only what we do with the result. Around it the
spec needed: a luminance threshold to choose the model automatically, a
cross-fade whenever that threshold is crossed (theme switch, day turning to
night), a rule keeping the veil *under* the room fills so temperature and
LQI colours keep their identity, and an open question about offering
«свет / тень / авто» explicitly.

**Why the owner dropped it.** It is a second rendering model for one
feature: two code paths, an automatic chooser that must be a pure function
of a background nobody controls, a cross-fade between them, and a veil that
has to coexist with the meaning-carrying room fills without being mistaken
for one — all to solve a problem that a single hairline solves.

The spec's other amplifier — a mark on the lit window itself (a thicker
warm stroke plus a short arrow along the sun direction, answering «в какие
окна сейчас светит солнце» without reading the floor) — was not rejected on
its merits. It is simply out of scope; this paragraph is where the idea
stays written down.

## What was implemented instead (2026-08-04)

A **rim**: a 1 px black hairline along the two SIDE edges of the wedge,
fading to zero on exactly the same gradient axis, the same curve and the
same 85 % threshold as the fill, clipped by the room like the wedge itself,
and living inside the same layer — so the 3° threshold, the two-second
fade, cloud cover and the editors govern it for free.

Light is invisible on white paper; its boundary is not. A boundary costs
one stroke, works on any background, and needs no second model, no
luminance threshold and no cross-fade.

Full contract and the tuned peak opacity: **[`docs/SUN.md`](../../docs/SUN.md), «The rim»**.
Implementation: `rayRimEdges()`, `rimStops()`, `rimPeakAlpha()` and
`RIM_MAX_ALPHA` in `src/sun.ts`, plus the `hp-sunrim-N` gradient in
`src/houseplan-card.ts`. Browser proof, including the pixel probe showing
the wedge's side is measurably darker than the paper beside it:
`demo/smoke_sun_rim.mjs`.
