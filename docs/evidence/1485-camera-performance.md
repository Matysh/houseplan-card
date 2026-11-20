# #1485 2.5D camera evidence

The comparisons use the synthetic iso-paint floor. The frozen comparison
build is b6676f11. The initial hardware input measurements used 289fec9b3,
after the #1486 material fix and the change to marker coverage. Frame
intervals come from requestAnimationFrame. A commit time from this probe
estimates presentation timing.

## RTX 4090, 120 Hz

Visible Yandex Browser with ANGLE D3D11 hardware composition. Browser
viewport 1408×952, stage 1393×879, DPR 2. The same fixture and input schedule
were used for both builds.

| Series | Baseline frames/s | Candidate frames/s | Baseline frames >50 ms | Candidate frames >50 ms | Candidate settles by rAF, ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| 8 in, 8 out | 70.4 | 110.6 | 7 | 0 | 249 |
| 12 in | 92.5 | 111.0 | 3 | 0 | 274 |
| 12 out | 55.5 | 108.7 | 5 | 0 | 274 |

During 12 in the longest interval below half native linear density was
25.1 ms. The four new frames were published at densities 0.88–0.89. There
were two replacements during 12 out, both at density 0.99. Each series
made one exact commit.

## Software Chromium and edge input

The uninstrumented runs used the pinned Chromium 151 headless shell in
WSL, with affinity to two logical CPUs on different cores. The last
candidate measurements were on 289fec9b3. Values are total time of frames
over 50 ms, in milliseconds.

| Viewport | Build | 8 in, 8 out | 12 in | 12 out |
| --- | --- | ---: | ---: | ---: |
| 1920×1080, DPR 1 | b6676f11 | 1317 | 1250 | 1500 |
| 1920×1080, DPR 1 | candidate | 384 | 250 | 267 |
| 1408×952, DPR 2 | b6676f11 | 1400 | 1000 | 1566 |
| 1408×952, DPR 2 | candidate | 200 | 0 | 267 |

The 10% targets were exceeded in the alternating series at both sizes and
in 12 in at 1920×1080. Exact-commit estimates for 12 in reached 313 ms and
324 ms respectively. There were two commits in the DPR 2 alternating
series when the software input stalled.

Separate traces on the preceding candidate attributed zero raster tasks to
the vector scene inside all six gestures. Each trace recorded one final
SVG viewBox change, one Lit commit, and at least two raster replacements
in both monotonic series. These trace runs used ordinary CPU affinity.

The controlled 1920 and 3840 px edge captures emitted 90 and 72 sampled
frames respectively. All had wall paint. Each direction reached its
nominal target in the captures, and the settled images matched their
exact-camera PNGs. PNG capture introduces additional inter-step and
presentation delays. Timing-only 4K runs observed input coalescing and
split camera sessions, including during zoom-out on the hardware browser.
The owner accepted the delivered result with the disclosed software and
4K deviations.

## Visual and behavioral checks

The owner accepted 14 pairs of gesture and exact frames from the RTX 4090.
The optional capture tool holds a bitmap at a known scale while collecting
the corresponding exact frame at the same camera. The output uses the
synthetic plan and contains no HA installation data.

The numeric comparison uses mean absolute RGB-channel error, in levels
from 0 to 255, over the 2786×1758 stage. Sigma is in device pixels. It is
calibrated against the accepted pairings and uses the same limit for both
themes. The composite during zoom-out contains two different densities.
A single Gaussian is only a reference for that composition.

| Scale relative to source | Overview exposed | σ | Maximum error |
| ---: | --- | ---: | ---: |
| 1.5× | no | 0.50 | 1.10 |
| 2× | no | 1.00 | 1.42 |
| 3× | no | 3.00 | 1.38 |
| 4× | no | 6.00 | 1.55 |
| 1/1.5 | yes | 0.25 | 1.60 |
| 1/2 | yes | 0.25 | 1.76 |
| 1/3 | yes | 0.25 | 2.75 |

The browser parity test compares the native-density raster with the exact
frame for four rotations, two themes, and light on/off. The observed
fraction above eight levels was below 0.04% in all 16 pairs. Separate
browser runs exercised the delayed overview, external image backdrop,
light transitions during a gesture, and the vector fallback. The #1486
materials smoke exercised the live raster with HA theme tokens.

The backdrop smoke uses the image from the large-house backdrop profile on
iso-paint. The full large-house performance matrix and GPU tab memory
remain unmeasured here. The pixel ceilings are covered by the planner
tests. The captured gallery and the browser smoke use separate hardware
and software paths.


## Direct input after code review

The paired check uses the same fixture, device scale, and GPU as the wheel
benchmark. The camera starts at 3×. It receives a held mouse drag across 32%
of the stage and a two-contact pinch of 1.57×, both through Chromium input
rather than a camera method. Each gesture has a 2.5 s input schedule.
The captured stage during the held drag was byte-identical across the first
pair. Both builds wrote zero scene view boxes while fingers or mouse were
down. They painted the exact end pose and released the temporary surfaces.

| Gesture | Pair order | Baseline rAF/s | Candidate rAF/s | Baseline frames >50 ms | Candidate frames >50 ms |
| --- | --- | ---: | ---: | ---: | ---: |
| Drag | Baseline first | 14.8 | 13.7 | 20 | 20 |
| Drag | Candidate first | 17.1 | 13.9 | 21 | 21 |
| Pinch | Baseline first | 120.0 | 120.0 | 0 | 0 |
| Pinch | Candidate first | 120.0 | 118.8 | 0 | 0 |

The staged mouse series takes just 22 or 23 delivered moves on both builds.
The driver awaits each move and skips expired ticks. These rates are specific
to that input profile, so they cannot be directly compared to the scripted
54.5 rAF/s panorama on the owner's live plan. The measured drag rAF rate
was lower for the candidate in these pairs, while long-frame counts matched
and the longest interval fell from 167/158 ms to 158/150 ms. Neither gesture
used a low-resolution underlay or an extra blur pass within the vector reserve.
The pinned headless smoke also passed, with zero vector view-box changes and
the exact end pose verified for both gestures.

Wheel was remeasured on the reviewed correction. The three series reached
110.1, 110.4 and 107.4 rAF/s, with zero frames over 50 ms. Each wrote one
exact camera, observed at 249, 274 and 274 ms after the last input by rAF.
The longest stretch below half density was 25.1 ms in the twelve-step
zoom-in.
