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
  Visual approval and applicable baseline updates remain pending.
- The RTX 2060 Max-Q trace and the rendering-layer/resource criteria remain
  open. The hardware benchmark and the controlled captures are documented
  in TESTING.md.
