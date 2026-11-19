# #1470: equivalent 2.5D paint/raster work

## Boundary

This repairs the #1451 regression within the current beta line. It does not
change the accepted camera, stored coordinates, shadows, furniture, lighting,
wall/label occlusion, native actions, Flat fallbacks, model or HA API. No raster
gesture snapshot, new cache, gesture budget, user setting or golden acceptance
was introduced.

- Each room still owns its own wall luminance mask and whole-label furniture
  opacity. Its paint allocation now covers transformed name + absolute metrics
  + touch/focus padding, rather than the whole viewport. Mask coordinates use
  that local scene box; the furniture row probe uses the original viewport
  pixel scale, alpha threshold 64 and `1-.7*coveredOpacity`.
- Furniture parts sample the same translated room-light field through their
  side/top silhouette. An isolated .8-alpha group preserves the transparent
  pattern backdrop/screen blending without a repeated light-pattern tile.
- ResizeObserver/rAF ownership follows each label. Replaced labels/viewports
  are unobserved; disconnect cancels work and clears observed references;
  reconnect observes again. There is no persistent DOM/mask cache.

## Public reproducible scene and environment

`demo/fixtures/iso-paint.mjs` contains 8 fictional rooms, 74 markers, 15 openings
and 15 volume furniture objects, names, metrics and live lighting. Nothing is
derived from the private owner fixture. Its known-device/filter/Area baselines
are pre-seeded; the mock advertises the real graph/contact API capabilities.
Only explicitly allowlisted read calls are accepted. Any writer/service call
is recorded and rejects the test. The final measurements use this clean fixture;
earlier probes with an incompletely seeded mock are diagnostic only.

WSL Ubuntu 24.04, Node 22.23.4, Playwright 1.62.0, attested Chromium headless-shell
151.0.7922.34/revision 1234, DPR 1, reduced motion. Baseline is the published
1.85.3-beta.2 product at 163fc4a94159, also present in dev f4f474cf4890. A frozen
source+bundle tree is served with the ordinary freshness guard, never a stale
bypass. The same public fixture/harness is used for base and fix. Measurements
are serialized against the other task's CPU-heavy work.

For the timed 4K case: 3840×2160, actual stage 3840×2087, zoom 2.18, the same native
45-step drag from (40,180) to (840,430). One excluded warmup, at least 3 measured
samples; if spread/median exceeds 15%, retain those samples and add 2. Compare
median duration and median per-series p95 rAF gap. These are software-renderer
measurements, not a claim of universal 60 FPS or a new owner-GPU acceptance gate.

```sh
# Freeze an already fresh source+dist tree using the same procedure as
# demo/smoke_iso_flat_parity.mjs; BASE below is that owned frozen tree.
HP_ISO_PAINT_REFERENCE="$BASE" HP_ISO_PAINT_MODES=iso,flat,no-mask \
  HP_ISO_PAINT_OUTPUT=output/1470-clean-base node demo/benchmark_iso_paint.mjs
HP_ISO_PAINT_BASELINE=output/1470-clean-base/result.json \
  HP_ISO_PAINT_OUTPUT=output/1470-clean-fix node demo/benchmark_iso_paint.mjs
# AC2: run on base, then fix with the resulting interactions.json as baseline.
HP_ISO_PAINT_WIDTH=1920 HP_ISO_PAINT_INTERACTIONS=1 \
  HP_ISO_PAINT_OUTPUT=output/1470-clean-interactions node demo/benchmark_iso_paint.mjs
# AC4: run separately against the same base and fix, never accept PNGs.
HP_ISO_PAINT_CAPTURE=1 HP_ISO_PAINT_OUTPUT=output/1470-clean-pairs \
  node demo/benchmark_iso_paint.mjs
```

## Oracles and durable regression coverage

The paired visual matrix uses whole 4K frames and each individual label crop:
two themes × four turns × Fit/2.18, plus overlapping/long labels, hover and focus.
Geometry and furniture alpha are compared separately. The existing golden
policy's channel threshold 10 and allowed differing-pixel ratio 0.0005 apply
to both the whole frame and each crop; threshold 10 is not a claim that the
largest individual channel difference is always ≤10. Small edge-rasterization
differences are quantified, not accepted as new baselines.

`test/iso-room-label-bounds.test.mjs` exercises camera/local-mask equivalence,
all turns/scales, invalid dimensions, absolute metrics and the actual light
renderer's isolated silhouette-reference output. `smoke_iso_label_bounds.mjs`
exercises real DOM/ResizeObserver, camera pan/rotation, long live text,
independent focus and uncovered-alpha negative control, zero writes, floor
retirement/return and detach/reconnect resource ownership. Existing touch,
Flat fallback, room metrics and theme contracts supplement it.

The new unit/native tests are classified product/regression/isometry/presentation.
The isometry domain selects the native witness without `areaTests`; an addressed
selection test pins that relationship. The task S6 plan retains the normal
critical core and related Ask selections; explicit area tests only add witnesses.

No separate HA E2E is needed: transport/permissions/services/persistence are
unchanged. Recorded in Matysh/houseplan-e2e#82; existing release E2E remain intact.

## First-review results (historical)

The machine-readable [evidence](1470-paint-performance.json) retains every timed
sample, content hashes, browser provenance, comparisons and scene IDs.

| 4K / 218% | Published base | Fix | Change |
| --- | ---: | ---: | ---: |
| Native drag median | 37.337 s (5 samples) | 15.536 s (5 samples) | −58.4% |
| Median series p95 rAF gap | 900 ms | 416.6 ms | −53.7% |
| Flat drag median | 1.849 s (5 samples) | 1.715 s (3 samples) | −7.2% |

ISO/Flat baseline ratio is 20.2× on this deliberately heavy live-light scene.
Removing label masks alone gives 30.419 s (3 samples), only an 18.5% gain, so
that diagnostic shortcut alone would not meet AC1. The actual fix retains masks
and lighting and passes both AC1 targets. All 8 paired 1920px Fit/218% pan,
wheel, hover and inbound HA-light cases pass AC2. The largest increases were
wheel +16.7 ms at Fit and HA-light +13.6 ms at 218%, within the agreed absolute
50 ms tolerance; no structural rebuilds occurred in these actions.

All 19 paired 4K frames pass. The 152 label entries comprise 142 visible pixel
crops and 10 offscreen geometry/alpha checks. Worst full-frame differing ratio
is 0.00001567 (130 pixels / 8.29M); worst label crop is 0.00017222, below 0.0005.
Label geometry differs by at most 1/64px, and furniture alpha matches for every
entry. The highest isolated channel delta is 72 on light-silhouette AA edges;
it is quantified under the threshold-plus-ratio policy, not described as exact
pixel identity or a new accepted appearance.

Addressed checks: 69 Node cases and 13 named native cases pass. All 9 selected
post-#1451 accepted golden scenes pass, including the fixed narrow kiosk.
The additional historical `lighting-closed-door-panel-iso-dark` stored PNG
differs by 79.9%. Its published-base actual and fixed actual, captured with the
same golden harness/options, are pixel-identical (max delta 0, ratio 0): this is
the explicitly informational, pre-#1451 oracle, not a repair regression. Its
baseline is not changed. No private plan, screenshots or raw traces are published.

## Current results after first code review

The current candidate's source hashes, samples and comparisons are in
`afterCodeReview` in the JSON evidence. The preceding section is retained
history, not evidence that the modified directive has its former content hash.

Review found that an animated camera's terminal Lit commit could remove the
camera-layer transform before the directive's next rAF. Old pixel anchors then
overrode the fresh percentage placement for one painted frame. On camera/visual
basis change the directive now synchronously releases its bounded styles and
local mask override: native percentage placement and the existing full wall
mask are correct immediately. The next rAF restores the bounded allocation.
An unchanged box signature also avoids redundant style/mask writes. This is
per-label transient state, not a new scene cache or camera owner.

The native regression explicitly enables ordinary motion and observes the first
settled animation frame, before the directive's deferred rAF. Zoom button, Fit
and room Fit all failed before the fix (maximum anchor error 1239.77 CSS px).
All three now pass with nonzero animation durations of 180/220/220 ms and
maximum error 0.0152 CSS px. The following settled frame restores all eight
bounded resources. All 17 native cases and the addressed 69 Node cases pass.

Repeated performance checks against the same frozen published base, with the
same environment and sampling rule:

| 4K / 218% | Published base | Current fix | Change |
| --- | ---: | ---: | ---: |
| Native drag median | 37.337 s (5 samples) | 14.578 s (5 samples) | −61.0% |
| Median series p95 rAF gap | 900 ms | 383.3 ms | −57.4% |
| Flat drag median | 1.849 s (5 samples) | 1.796 s (3 samples) | −2.9% |

All eight AC2 interaction comparisons pass. The largest positive difference is
Fit hover +16.95 ms (29.41 → 46.36 ms); it is within the agreed absolute 50 ms
tolerance, not claimed as a relative improvement. HA-change at 218% is now
31.21 ms versus base 34.23 ms. All 19 paired whole frames and 152 label entries
still pass; geometry/alpha agreement and threshold-plus-ratio policy are
unchanged. No visual baseline was updated. The earlier nine accepted-golden
results remain historical results; the normal after-review S6 supplies the
applicable selected checks on the final material.
