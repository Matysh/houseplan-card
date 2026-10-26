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

The animated-mode author audit found and corrected one coordinate-boundary
mistake before handoff: the mode controller must read `_cameraView`, never the
presentation `_viewOr`. The rAF envelope trace now covers that boundary. The
combined base includes #1080 and #1081; grid coverage remains on its original
100 ms/15% viewport refresh budget, in inverse-rotated plan coordinates.

## Boundaries

The actual f705 zero-angle comparison has byte-identical ISO stage PNGs and
zero differing decoded pixels throughout the flat stage (y≥118, 1000×900
page). Its4264 changed page pixels are confined to the header's intentional
two new controls. Page-scene intent records that shared header delta; scene
geometry at zero receives no pixel-change allowance. The demo icon inventory
is regenerated with the stock generator so the new MDI controls are painted.

Matched pinned Linux source builds against f705 measure initial View
347958→350329 B gzip (+2371), lazy editor356892→357557 (+665), total raw
dist3523268→3534372 (+11104). ISO fit orchestration is lazy and presentation
reads cached stage sizes. The initial rolling reference carries only +2371
(346593→348964), preserving the inherited1365-B gap; raw dist carries the
exact +11104 feature cost with its inherited zero gap. Other monolith metrics,
the2000-B bands and352000-B hard wall remain unchanged. The current hard-wall
reserve is1671 B; this is measured feature cost, not a loading-speed claim.

Native browser input and pinned headless Chromium supply the automatic visual
and touch evidence; this is not a physical tablet/GPU claim. The editor node
adapter is a synthetic transport fixture, not execution of the HA Python
endpoint. No new backend behaviour is introduced. Golden intent covers six
new turn frames plus the explicitly affected page headers; no global baseline
is accepted. Mutation definitions are registered
and checked for applicability only; execution belongs to nightly.

Final commands, artifact hashes, performance and gate results are recorded in
the issue handoff on the published material.
