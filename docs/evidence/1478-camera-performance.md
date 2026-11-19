# #1478 2.5D camera and render evidence

Issue [#1478](https://github.com/Matysh/houseplan-card/issues/1478) remains in
implementation. The figures below use the fictional iso-paint fixture. The
pinned headless capture and the hardware browser are separate measurements.

## Camera and scene

The viewport now retains coverage until the current or predicted view would
expose new content, or the scale runs outside the anchor range. The SVG and
markers receive the new basis in the same camera update. Wheel idle commits
the exact camera.

Floor shadows use SVG geometry. The masonry clip and narrower wall-light
gradients reduced the fixture to 4479 elements with zero mask or
foreignObject elements on the measured intermediate candidate. Device
occlusion, room labels, routes and controls keep their individual semantics.

A Windows software trace of a 45-step pan identified 45 paints of the room
tooltip during motion. Deferring room hover reduced Layout events in the
trace from 53 to 8. Individual scene/filter layers and raster work still
appear in the trace.

## Measurements

On WSL at 1920×1080, DPR 1, Chromium 151, the frozen dev revision
e5c56c0e4 took 3.949 s in 2.5D and 0.781 s in Flat for the 45-step
800×250 px pan. An intermediate consolidated scene took 2.255 s and 0.782 s.
The 2.5D median p95 frame interval fell from 133.4 to 66.6 ms. The headless
acceptance target needs a new measurement on the completed implementation.

Chrome 158 on the physical RTX 4090 used ANGLE/D3D11 hardware composition,
at 1408×952 and DPR 2. On 882f48bea:

| Light | Pan, rAF/s | Zoom in, rAF/s | Zoom out, rAF/s |
| --- | ---: | ---: | ---: |
| Off | 117.5 | 113.2 | 106.1 |
| On | 119.5 | 113.8 | 102.0 |

The LayerTree observer counted 18–21 new drawing layers during the tested
series. Dedicated WDDM memory for the separate Chrome GPU process reached
1.83 GB. That counter covers the process. The tab memory limit remains
unverified.

Four controlled edge series on 7251e4b46 captured 140 frames at 1920 and
3840 px. No complete wall layer disappeared. Both directions reached their
nominal zoom after 14 distinct events. The final results matched fresh
exact-camera PNGs. PNG capture adds latency, and the available timing does
not establish the 300 ms exact-frame requirement.

## Checks and open acceptance

- The TypeScript build and 72 targeted Node checks passed on 882f48bea.
- Addressed isometry, touch, kiosk, offline devices and screen-camera
  browser checks passed in WSL on 7251e4b46. The light diagnostic verified
  two independently scoped SVGs, complementary opacities at 250 ms, a
  500 ms transition and a queued latest target.
- Four golden samples also differed from their saved PNGs on the frozen
  dev. Actual paired screenshots from the two builds differed on
  0.05–0.35% of pixels by more than eight levels in any RGB channel.
  The owner accepted the shown 16 pairs and the midpoint of the light fade.
  Saved baseline images were not part of that approval.
- The hardware benchmark and the controlled captures are documented in
  TESTING.md.

## Raster cache follow-up

The owner authorized the raster implementation. Scoped browser transitions
and SVG-only bitmaps were tested separately. Scoped transitions added hundreds
of drawing layers in the hardware run. The bitmap cache uses one canvas, an
SVG source with a bounded pixel count and a separate live vector surface.

Disjoint foreground cuts created unneeded polygon fragments. Keeping the
original polygon in that case and omitting already-hidden texture paths
reduced the wall SVG on `iso-paint` from 1,786,364 to 435,851 characters.
At 1408×952, DPR 2, the compact vector scene measured 101.6 rAF/s on the lit
zoom-out versus 95.6 rAF/s with the bitmap. At 3840×2160, DPR 1, the same
PC and scene measured the following with the compact scene:

| Light | Zoom in, SVG → cache | Zoom out, SVG → cache |
| --- | ---: | ---: |
| Off | 51.5 → 107.6 rAF/s | 87.1 → 97.7 rAF/s |
| On | 81.1 → 103.5 rAF/s | 62.0 → 75.0 rAF/s |

The cache is used at six million device pixels or above. In the 4K hardware
run all four long series reached their nominal zoom and made at least two
bitmap replacements. Drawing-layer creation remains over the requirement.
GPU process memory does not isolate the tab to establish its budget.

Four settled quarter turns from the accepted candidate and compact scene
were captured with the same Chromium build. Between 0.003% and 0.012% of
pixels differed by more than eight levels in at least one channel.

The controlled 4K trial with GPU enabled emitted 72 sampled frames. Both
directions received all 14 notches, all emitted changed frames contained wall
paint, and the final PNGs matched fresh exact-camera references. Zoom-in had
two bitmap replacements in one wheel session. Zoom-out split into six
sessions under software/capture load and did not prove replacement continuity.
PNG delivery after the final wheel event took approximately 840 ms in this
trial. The 251–287 ms camera commits alone cannot verify the 300 ms presented
frame budget. A separate light diagnostic held the two SVGs at 250 ms, crossed
a wheel anchor and verified equal viewBoxes and masonry on both surfaces.
It does not prove the full timed, presented frame sequence during a fade.

`demo/performance/iso-live-camera-probe.js` observes camera input and paints
on the actual plan. The owner removed RTX 2060 Max-Q acceptance from scope.
The decision covers AC7, AC8, AC17 and the laptop portions of AC15 and AC18.
The RTX 4090 and synthetic requirements still apply.

The final targeted build passed 138 Node cases. Chromium checks passed for
pan coverage, room labels, touch, projection round trips, light fade, LED
quality during wheel input and internal mode endpoints. The earlier full S6
on `b60b227ca` completed 1228 checks with 21 failures. The targeted reruns
replace individual results and do not establish a green full run for the
new candidate.

At 1408×952, DPR 2, Chrome's presented-frame trace showed the first
stage image pixel-equivalent to the fresh exact reference at 294 ms for
zoom-in and 247 ms for zoom-out. This comparison used the DevTools trace's
600 px screenshots. In a separate memory-only trace, the isolated Chrome
GPU process reported about 645 MB of compositor resources and 1022 MB
of shared images during zoom-out. These counters may count shared backing
stores across categories. They are upper bounds from the dedicated GPU
process and leave the tab's 350 MB budget unverified.

## Bounded label shadows and outstanding checks

Applying the room-label blur to each label bounded its intermediate texture.
The follow-up zoom-out trace at the same resolution recorded about 135 MB of
compositor resources and 328 MB of shared images in the isolated GPU process.
These counters overlap. They describe the process at the sampled times.
Four settled quarter-turn pairs differed by more than eight levels in at
least one RGB channel on 0.039–0.065% of pixels.

The 4K physical trace received 14 events in each direction and recorded two
bitmap replacements in each series. The controlled PNG run verified the wall
paint and matched the exact terminal PNG in both directions. Capturing at full
resolution split zoom-out into multiple sessions, so this combination covers
range and replacement separately and leaves continuous 4K capture open.

The LayerTree probe attributed most remaining allocations to HTML devices and
room captions promoted where they overlap. A stage-sized paint-containment
experiment cut the count from 21 to 2, but clipped markers outside the anchor
rectangle. Restoring the full paint reserve preserved the pixels and restored
those layer allocations. The experiment was discarded.

The grid-scale witness exposed a thin seam on a clipped door face in the
dark scene. Computing the cuts in reference-scale units fixed the pair at
both grid sizes. The existing native probe recorded zero pixels beyond two
levels of per-channel change in each theme. The kiosk and room-fit probes now
compare the screen pose so the retained SVG transform is included.

On Windows at 1920×1080, DPR 1, the 45-step pan median was 2.961 s on
`e5c56c0e4`, 0.817 s with the bounded label shadows and 0.774 s in Flat on
the same candidate. This is 3.62× faster than the pinned 2.5D baseline and
1.06× the time of Flat. The 20% baseline target remains open.

The closed-door pixel witness and the old marker-overlap witness reproduced
failures on the exact dev base. Full S6 and the compositor criteria remain
open.
