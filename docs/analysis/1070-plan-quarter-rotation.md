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

The archived f705 prices and timing reports predate accepted #997 and are not
final matched evidence. Final price/performance compares the current candidate
with accepted #997 at `e5849080cc01e10349be1c5ec922f8bb4a428094`, using its
frozen pinned Linux artifact. The accepted artifact measures initial View
349257 B gzip, lazy editor 362639 B gzip and total raw dist 3550135 B.
Only measured own feature cost may move a rolling reference, preserving the
incoming gaps of 1709 B (initial) and 275 B (raw). The 2000 B bands, 352000 B
initial hard wall and core line cap remain unchanged. Final candidate numbers,
seven-sample comparisons after one warm-up and their evaluator results are
recorded with the published handoff; a diagnostic sample is not readiness.

Native browser input and pinned headless Chromium supply the automatic visual
and touch evidence; this is not a physical tablet/GPU claim. The editor node
adapter is a synthetic transport fixture, not execution of the HA Python
endpoint. No new backend behaviour is introduced. Golden intent covers six
new turn frames, three phone layout frames and the explicitly affected page headers; no global baseline
is accepted. Mutation definitions are registered
and checked for applicability only; execution belongs to nightly.

Final commands, artifact hashes, performance and gate results are recorded in
the issue handoff on the published material.
