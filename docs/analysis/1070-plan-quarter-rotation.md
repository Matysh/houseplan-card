# #1070 — quarter-turn presentation evidence

Author evidence; independent CODE review remains the CI authority.

The implementation uses one exact table-based presentation frame. Camera state,
space/layout data, physical booleans and canonical sunlight polygons are not
rotated in storage. 2.5D projects a different side from the same physical source;
SVG plane transforms and HTML anchor percentages share `view-frame.ts`.

## Acceptance witnesses

| AC | Witness |
| --- | --- |
| AC1 | `smoke_plan_rotation`: native header buttons, View/editor orientation, no WS writes or revision changes, kiosk absence; animated View→Plan→View→Decor→View rAF trace with nonzero pan/zoom. |
| AC2 | Exact quarter matrices/composition units; native +90/−90 and four-turn byte-identical stage PNGs and unchanged canonical camera numbers. |
| AC3 | Native SVG/HTML anchor agreement, default/custom icon angles, right badge; six new Golden scenes include decor text, room metrics, sunlight and a lock opening. |
| AC4 | Nonempty canonical sunlight polygons remain byte-identical while turning; solver inputs/cache keys are unchanged. Existing sun units and smoke provide the ordinary neighbour. |
| AC5 | Real reload, another space, separate browser and a cold browser with denied Storage; pure preference tests include malformed/denied input. |
| AC6 | Both actual Lovelace editor schemas and error DOM, HA-form event string→numeric config boundary, kiosk precedence and invalid config fallback; pure validation/priority tests. |
| AC7 | `smoke_plan_rotation_editors`: real native mouse wall/node/decor coordinates match at 0/90°. Device delta differs by less than 0.0002 normalised (native subpixel quantisation), and both save the intended point. Native ArrowRight moves right on screen. |
| AC8 | Native pan/wheel world anchor and turned fit; Chromium touch pan/pinch in View90 and kiosk270. Screen directions and held world point are observed in painted DOM. |
| AC9 | Four distinct camera-facing physical edges in unit and four new 2.5D Golden angles. The zero-side geometry object is reused after four turns. |
| AC10 | Static DOM/effective preference smoke; complete PDF page direction, fit and horizontal captions unit, plus pure raster/text/Bezier transform tests and ordinary PDF export smoke. |
| AC11 | Actual floor/sun/body and ISO structural build counters are unchanged by turning; unit physical source is built once for all four views. |
| AC12 | `smoke_plan_rotation_mobile` checks ordinary/reduced-motion 320 px editor round trips and rapid native menu retargeting. `verify_plan_rotation_mobile_1070` repeats layout at 320/359/360/390/480 px with official pinned HA components, 0/8 px dashboard gutters and the accepted #997 floor dropdown; all five rotation/zoom targets, floor and gear are at least 44 px, the existing editor close is 24 px, native centres hit, and no content is clipped or scrolls horizontally. View stays one row of at most 56 px after every editor close. |

The animated-mode author audit found and corrected one coordinate-boundary
mistake before handoff: the mode controller must read `_cameraView`, never the
presentation `_viewOr`. The rAF envelope trace now covers that boundary. The
combined accepted base includes #1080, #1081 and #997; grid coverage remains on its original
100 ms/15% viewport refresh budget, in inverse-rotated plan coordinates.

## Native HA height and input boundary

The official HA toolbar can have a fractional height (212.3125 px in the
320 px fixture). Camera fitting consumes the stage's integer `clientHeight`.
`modeStageHeight` rounds the predicted target to that same basis before fitting;
otherwise the reverse transition can save a slightly different camera after
the browser rounds the final height. The pure fractional-height test covers
both directions. The native HA witness samples header + toolbar + stage in
every animation frame, then checks the exact saved canonical camera and the
same painted world point after View returns. It covers all three editors in
ordinary and reduced motion with nonzero native zoom and pan.

Viewing the light phone frames also exposed an inherited white close glyph:
the desktop active-tab colour still applied after the phone hid the highlight.
That colour now applies only from 481 px; phones retain the normal muted
palette and the existing 24 px target. The canonical Golden runner decodes the
actual 320/360 px PNG and requires at least four glyph pixels with contrast
of three against its painted background. The current light frames have 13
such pixels, with maximum contrast 3.47; colour-token names alone are not proof.

The native harness declares an external 56 px HA toolbar, the real card's 1 px
borders and 0/8 px dashboard gutters. The narrowest content width is 302 px
inside a 304 px card at a 320 px viewport. Seven 44 px View targets fit through
six common 1 px border strokes; their contents and native hit centres remain
separate. These measured bounds are not inferred from `innerWidth`. Below
360 px only editors may use two rows. At 360–480 px editors keep one row;
at 481 px and above the existing desktop wrapping remains.

## Loading and evidence boundaries

The two rotation toolbar labels remain in the eager language catalog. Only
21 GUI-only Lovelace labels move into the existing lazy settings catalog.
`smoke_lovelace_editor_locale_1070` checks both actual editor schemas in all
four languages, cold readiness, pending saves and the complete English error
fallback. Its HA-form fixture verifies the public schema/computeLabel/value
event contract, not native HA widget painting. Cold ordinary View, read-only
and kiosk must not request the settings dictionary.

## Historical comparison boundary

The actual f705 zero-angle comparison has byte-identical ISO stage PNGs and
zero differing decoded pixels throughout the flat stage (y≥118, 1000×900
page). Its4264 changed page pixels are confined to the header's intentional
two new controls. Page-scene intent records that shared header delta; scene
geometry at zero receives no pixel-change allowance. The demo icon inventory
is regenerated with the stock generator so the new MDI controls are painted.

The archived f705 prices and timing reports predate accepted #997. The complete
timing series below compares frozen `55ead817d` with accepted #997 at
`e5849080cc01e10349be1c5ec922f8bb4a428094`; #1088 changes none of its product or
benchmark/common-harness inputs.

The final whole-build price uses accepted #1015's pinned Linux artifact,
verified byte hashes and exact fingerprint against immutable `e2541d6c0` source.
The subsequent `fd62` #1090 change is backend-only. Accepted #1015 removes only
the retired ripple-display loop and weather cleanup on General-settings save
from the frontend. The large-house fixture has no ripple display and its
settings measurement only opens/closes the dialog; benchmark/common harness
and the quarter-turn implementation are unchanged. No further timed replay is
claimed for this rebase; ordinary exact-material CI remains required.

| Graph | Accepted base | Candidate | Own delta |
| --- | ---: | ---: | ---: |
| initial View gzip | 349257 | 351345 | +2088 |
| lazy editor gzip | 362610 | 363545 | +935 |
| onboarding gzip | 39950 | 40150 | +200 |
| raw dist | 3550038 | 3564627 | +14589 |

The candidate fingerprint is `90aeb135`; the verified base is `370afdc5`.
Its core has 16 additional lines. The initial rolling reference carries exactly
+2088 to 349636, the editor reference +935 to 361726, and the raw reference
+14589 to 3564449. This preserves the incoming accepted-base gaps of 1709 B
(initial), 1819 B (editor) and 178 B (raw). The onboarding reference, 2000 B
bands, 352000 B initial hard wall and core line cap remain unchanged. The
measured initial hard-wall reserve is 655 B. A sum of task deltas does not prove
the eventual graph with #1000; that actual combined graph must be measured.

## Preserved matched performance series

The first complete pinned Linux author series ran on frozen `55ead817d`,
fingerprint `5610671c`, with the candidate runner and seven measured samples
after one warm-up on each side. All five runner processes exited zero and kept
their structural/native-coordinate assertions. Stock JSON budget evaluation:

| Comparison | Result |
| --- | --- |
| interaction base0 → candidate0 | RED, ten Long Task limits |
| interaction base0 → candidate90 | GREEN |
| isometric base0 → candidate0 | GREEN |

The zero-angle failure is preserved. Candidate sample 0 has first stable render
5077 ms, space switch 2687 ms, resize 1058 ms and hover 582 ms; its load Long Task
is 3637 ms. The other six candidate rows have first stable render 2736–2824 ms,
hover 199–216 ms and no pan Long Task. The base has its own broad spike in
sample 3: resize 2093 ms, hover 501 ms and total Long Tasks 9555 ms. Its maximum
Long Task count is 38 against the absolute limit of 18. The candidate median
first render is 2773.7 ms versus base 2837.6 ms, but its p95 is still RED.
No host, GC or external-process cause is proved by these rows alone.

The coordinator requested one bounded base0/candidate0 replay with OS telemetry
after other heavy gates end, with the same 7+1 samples, fixtures, windows and
thresholds. Both original spikes and all rows remain in the ignored artifacts.
The single bounded replay completed all 7+1 rows on both sides, with the stock
evaluator GREEN and no threshold change. Candidate first stable render is
median 2816.4 ms / p95 2838 ms; Long Tasks are max 1005 ms, p95 count 14 and
p95 total 2729 ms. It does not replace the first RED series.

The replay's telemetry observed unequal host load: Linux base CPU median 20%
/ p95 96.08%, candidate median 13.72% / p95 15.49%; Windows p95 is 91.67% /
36.49%. One external Node PID's cwd was read as the separate
`hp-1078-sun-transparency-20261025` checkout; no external process was changed.
Observer wall cost was recorded at 1 Hz (Linux median 2.77/2.09 ms per sample,
Windows 35.37/29.26 ms). The base again exceeded some absolute limits. This is
not evidence of a speed-up or proof of the first series' cause. All original and
replay rows, host telemetry, observer cost and stdout receipt times are retained.
No further replay is planned. Normative exact-SHA CI remains required; local
author results do not substitute for the independent CI verdict.

A separate read-only sensitivity compares candidate p95 with the independent
fastest observed baseline value for each metric, using the published numeric
predicates unchanged. Those minima may come from different rows; this is not a
stock gate, an additional AC or a replacement report. All zero-angle time p95
checks pass that stricter reference; its aggregate Long Task count/total exceed
11/2576.6 at 14/2729. At 90°, the diagnostic also exceeds the model-ready bound
by 18.15 ms, resize by 61.2 ms, and the aggregate Long Task min-reference bounds.
ISO passes the sensitivity. These extrema do not establish a code regression;
all original rows and the independent stock outcomes remain available.

On that frozen timing fingerprint, the named own browser commands completed:
`verify_plan_rotation_mobile_1070` (82 native HA states / 12 transitions),
`smoke_plan_rotation`, `smoke_plan_rotation_editors`,
`smoke_plan_rotation_touch`, `smoke_plan_rotation_mobile` and
`smoke_lovelace_editor_locale_1070` all PASS. The editor fixture's compiled
canonical node owner was rebuilt first. Static mutation applicability is PASS
for 1949 definitions, with execution 0; caught status remains unknown/nightly.

Native browser input and pinned headless Chromium supply the automatic visual
and touch evidence; this is not a physical tablet/GPU claim. The editor node
adapter is a synthetic transport fixture, not execution of the HA Python
endpoint. No new backend behaviour is introduced. Golden intent covers six
new turn frames, three phone layout frames and the explicitly affected page headers; no global baseline
is accepted. Mutation definitions are registered
and checked for applicability only; execution belongs to nightly.

Final commands, artifact hashes, performance and gate results are recorded in
the issue handoff on the published material.
