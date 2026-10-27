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
| AC12 | `smoke_plan_rotation_mobile` checks ordinary/reduced-motion 320 px editor round trips and rapid native menu retargeting. `scripts/dev/verify-plan-rotation-mobile-1070.mjs` repeats layout at 320/359/360/390/480 px with official pinned HA components, 0/8 px dashboard gutters and the accepted #997 floor dropdown; all five rotation/zoom targets, floor and gear are at least 44 px, the existing editor close is 24 px, native centres hit, and no content is clipped or scrolls horizontally. View stays one row of at most 56 px after every editor close. |

The animated-mode author audit found and corrected one coordinate-boundary
mistake before handoff: the mode controller must read `_cameraView`, never the
presentation `_viewOr`. The rAF envelope trace now covers that boundary. The
combined accepted base includes #1080, #1081 and #997; grid coverage remains on its original
100 ms/15% viewport refresh budget, in inverse-rotated plan coordinates.

## Joined verification on accepted #1092 before lifecycle correction

The final rebase keeps #1092's removal of the decorative outline SVG, its
CSS-content-width header measurement and the actual compact-picker readiness
helper. Both SVG conflicts were resolved by keeping the accepted deletion and
the primary quarter-turn presentation planes. UI-042 uses one accepted wide-host
setup plus measured header/two-tab readiness; both compact branches and all
original cursor oracles remain. No #1092-specific process exception is applied.

All of the following executed on fingerprint `7ee5e787` and actual base `d9d0d812`:

- Official pinned native HA:82 layout states and12 camera transitions PASS.
  This is a fresh joint author capture after the header/helper changes.
- All five own rotation/editor/touch/mobile/locale smokes PASS, including live
  physical floor/sun/body counter equality across four orientations.
- Backdrop, UI-1081 and vacuum-camera neighbours PASS. The accepted outline-
  removal ordinary guard passes, so the retired SVG is not resurrected.
- All nine own Golden scenes and the repaired retained-path scene PASS. The
  current320px light editor, Flat90 and ISO270 frames were viewed; no baseline
  was accepted or new capture made solely for those inspections.
- Flat and ISO zero-angle stages match the new accepted d9 artifact exactly:
  PNG bytes identical and zero decoded pixel delta across984×773 px, with
 2015/1884 distinct base colours.
- Static applicability1957 definitions/544 browser witnesses/1080 source reads
  PASS, execution0 and caught unknown/nightly. Generated inventories are current.

The dedicated baseline was built once and frozen after source fingerprint,
manifest topology and every asset SHA passed. Current raw/AST deltas are above.
Earlier7b/0d3 results below are historical. The following lifecycle correction
refreshes native/header and direct counter observations on its new source; the
7ee Golden/render results remain explicitly attributed to that earlier input. Final ordinary gate/CI are linked in the issue
handoff, followed by independent CODE review; these author checks are not a
review verdict.

## Current header measurement lifecycle correction

Ordinary exact-f031 CI40514259428 passed60/61 smokes and all122 Golden cases
on7ee, including all nine rotation scenes and the cache-counter smoke. One LED
smoke exposed a real header lifecycle leak: an already queued ResizeObserver or
window-resize rAF ran after disconnect, measured detached zero rects and wrote
`_hdrH`. The raw stack identifies that header closure. The resulting detached
Lit render also recreated ordinary Glow entry state before reconnect, which
then had no opacity transitionrun/end. Neither assertion nor deadline changed.

The header closure now checks its concrete observer lease, connected state and
stage identity before measuring or publishing delayed widget-readiness/warm
memo work. The observer is assigned before its first measurement. No height
formula, one-pixel rule, Glow owner, CSS transition or test observer was changed.
The unchanged complete LED smoke passes47.8s, including disconnected[0,0] and
all main/static reconnect run/end events with the original500/750ms contract.

An additional ignored author probe forwards native RO/rAF callbacks unchanged
and remounts the same DOM element after a real header-width observation. Its
old native frame is delivered while connected on the SAME stage after observer
generation3 has been replaced by6. The wide two-tab header never republishes the
old compact width. This exercises the reason an isConnected-only fence would
be insufficient; it adds no public test API or private product-state write.

On current fingerprint658770cd, fresh pinned native HA proof passes82 layout
states and12 camera transitions; mobile round trips and the direct rotation
cache-counter smoke also pass. The new320px editor and360px View PNGs were
visually checked. Earlier7ee native files remain in a separate preserved author
snapshot. All122 earlier CI PNG hashes were checked and six contact sheets
viewed; their passing Golden status does not make the overall RED CI green.
No manual nine-scene recapture or new performance benchmark was run. The next
ordinary exact-material CI is required before independent CODE handoff.

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

The final mobile check also caught a real settled stacking defect. While
animation opacity created a toolbar context, all menu centres hit correctly;
at opacity1 the later `.editbar-end` and header popup both had z-index2, so
four menu centres belonged to the toolbar. The header now owns a positioned
z-index3 context above that sibling. Before/after rectangles for the header,
menu wrapper, popup, toolbar and end bar are identical; the popup offset parent
remains `.header-menu-wrap`, and viewport/scroll width remains390 px.
The guard retains native input, records a trusted `mode-decor` pointerdown
while the controller is busy, and separately proves all nine menu hits after
settling before native navigation and camera restoration. The first RED and
its diagnostic receipts remain preserved; no timeout or animation was relaxed.

## Loading and evidence boundaries

The two rotation toolbar labels remain in the eager language catalog. Only
21 GUI-only Lovelace labels move into the existing lazy settings catalog.
`smoke_lovelace_editor_locale_1070` checks both actual editor schemas in all
four languages, cold readiness, pending saves and the complete English error
fallback. Its HA-form fixture verifies the public schema/computeLabel/value
event contract, not native HA widget painting. Cold ordinary View, read-only
and kiosk must not request the settings dictionary.

## Current matched resource cost and owner decision

The accepted integration base is #1092 at `d9d0d812`. Its source/capture inputs
match the reviewed6cc material; only review/SPEC documents differ. A dedicated
immutable checkout was built once with Linux Node22.23.2 and locked packages.
Its fingerprint `c890e4a0`, manifest topology and every asset SHA were verified.
The candidate fingerprint is `658770cd`, including the merged shared helper.

| Metric | Verified accepted d9 artifact | Candidate | Own delta |
| --- | ---: | ---: | ---: |
| initial View gzip | 349536 | 351632 | +2096 |
| lazy editor gzip | 363437 | 364380 | +943 |
| onboarding gzip | 40156 | 40339 | +183 |
| raw dist | 3557327 | 3571911 | +14584 |
| core source lines (trimmed) | 13361 | 13381 |  +20 |

Rolling references carry only measured own cost: initial349824→351920,
editor363457→364400, raw3559585→3574169. Incoming gaps remain -288, -20 and
-2258 B respectively; the inherited raw shrink is retained, not silently
recentered. All2000 B bands remain. The host port has374 actual members against
reference372 in the accepted base. Four useful presentation ports add
`_framePercent`, `_planScreenDelta`, `_rotation` and `_planVisibleRect`:
378 actual against376 reference preserves gap2 and band5. Other static
references and the onboarding reference are unchanged; unused violations are0.

Before accepted #1092, a separate build-only diagnostic combined rotation8b
with immutable alertsbddb4938 on accepted #1087:352517 B initial gzip and13381
core lines. It was not an accepted or published combination. The owner
explicitly approved resource-limit increases and stopping byte optimization
([decision](https://github.com/Matysh/houseplan-card/issues/1070#issuecomment-6440488253)).
The existing #898 ten-percent rule moves the absolute View wall352000→387200
and its reference320000→352000, and the core cap13327→14660 with unchanged
50-line band (effective14710). Current own headroom is35568 B. Other core caps,
performance/security/deadline thresholds and independent review authority stay
unchanged. No cold seam was implemented. #1000 measures its actual accepted
combination after the #1070 merge; summed feature deltas never replace it.

## Historical pixel and timing boundary

The earlier f705 zero-angle comparison has byte-identical ISO stage PNGs and
zero differing decoded flat-stage pixels; page differences are confined to
the two intentional header controls. The demo icon inventory is regenerated
with the stock generator. The current accepted-base flat/ISO stage comparison
is recorded separately; zero-angle scene geometry gets no change allowance.

The complete timing series below belongs to frozen `55ead817d` / fingerprint `5610671c`
against accepted #997 e5849080. It is historical author evidence, not a timing
claim for current `7b533356`. Through the pre-#1092 checkpoint, benchmark, common launch and helper inputs
were byte-identical across those accepted changes. Product inputs are not:
accepted #1015 removes the retired ripple loop and General-save weather cleanup;
accepted #1087 adds the more-info target resolver and dialog fields/locales.
The stock large-house measurements do not invoke that new target action, but
its startup bytes are present in the new graph. This limits reuse of old
absolute timings. No fresh timings are asserted after those rebases; ordinary
exact-material CI remains mandatory. The resource-limit and unused-import
changes add no new runtime behavior. All original RED/GREEN rows remain.

## Earlier verification before accepted #1092

The accepted #1022 merge `51fde59d` changes none of the frontend/capture/build
inputs from verified `4c2ac36a0`. Rebase input equivalence was checked before
reusing the fresh artifact `7b533356` above. On that source fingerprint:

- Native pinned HA:82 layout states and12 camera transitions PASS, including
  actual accepted floor dropdown and320/359/360/390/480 px boundaries.
- Mobile smoke:12 ordinary/reduced-motion camera legs, trusted native retarget
  while busy, nine terminal menu hits and final camera restoration PASS.
- Both GUI forms:8 cold locale cases and6 pending/fallback cases PASS; ordinary
  View, read-only and kiosk make zero settings-dictionary requests.
- All9 own Golden semantic scenes PASS at matrix101. The320/360 px light phone
  and90/270-degree ISO frames were viewed. No global baseline was accepted.
- Accepted-base zero-angle Flat and ISO stages are PNG-byte-identical, with
  zero differing decoded pixels across984×773 px;2015/1884 distinct base
  colours rule out an empty-stage comparison.
- Static mutation applicability:1961 definitions,546 browser witnesses and
 1081 unique source reads PASS; execution0 and caught status unknown/nightly.

The earlier source-regex tests were corrected from `t` to their real existing
`settingsT` owner without changing keys, choices, defaults or label checks.
The actual unused ISO import was removed. All59 targeted policy/source units
PASS. The first old-reference test RED, mobile stacking RED and diagnostic
seed timing RED are retained with the successful bounded repairs. These are
author verification results; final automatic gate and exact-material CI are
reported in the issue handoff. The first full automatic pre-push passed the
product group and failed two tooling assertions for the single unregistered
optional native HA verification tool. It is now explicitly classified as an
externally cached author invocation alongside the existing #609/#870 tools;
ordinary CI mobile smoke/Golden ownership remains intact. All28 existing
check-inputs tests and the strict CLI coverage check pass after that repair. No physical tablet/GPU result is claimed.

## Observer repair after ordinary CI

The first ordinary push CI on d37523f09/fingerprint7b533356 passed61/65 smoke
and121/122 Golden cases; CODE review had not started. All nine own scenes and
the direct rotation cache-counter smoke passed. The four failed observers
were repaired without changing product source, deadlines or baseline images:
Static paper/backdrop order now uses their exact common SVG presentation plane;
current vacuum paths stay direct children of the explicit rotation frame,
separate from previous paths; UI-042 receives an actual1200px fixture host and
waits for two wide tabs, retaining every grab/pointer assertion.

That observer-repair checkpoint retained exactly `dbbdbbb0bc1a44617a6116c7c1376012dca7189f`.
Build configuration and deterministic fixtures also match d375. Native HA
verification imports the UI-lab server, browser attestation, bundle freshness
and hp-test helper, with no Golden-harness import. Its82/12 author proof remains
on7b, with unchanged reachable product inputs; it is not called a fresh0d3
capture. The common Golden harness changed two readiness selectors, so the
conservative full build/capture fingerprint was0d3a1df9 at that checkpoint. That19-commit local
ask rebase onto docs-only7af retained product source. The old published d375
material, failed CI report/artifact12733048625 and full logs remain preserved.

On the new fingerprint, exactly three complete ordinary smokes passed:
`smoke_backdrop`28.3s, `smoke_ui_lab_1081`5.7s and `smoke_vacuum_camera`17.3s.
The targeted `vacuum-retained-path-diagnostics-dark` capture passed3.3s with
all shape/style/retained-diagnostics oracles intact. New exact-material ordinary
CI remains required. Measured fingerprint salt changes are recorded once,
without byte optimization or another benchmark series.

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
`scripts/dev/verify-plan-rotation-mobile-1070.mjs` (82 native HA states / 12 transitions),
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


## Large CI proof input transport

The exact7644a48ce ordinary push ran all61 selected smokes (including the
unchanged LED lifecycle case) and122 Golden scenes successfully on runtime
fingerprint658770cd. All122 PNG hashes were checked and six contact sheets
viewed. Browser artifact12742328687 has archive digest
`sha256:6ef15945c82f3dd0e116034e87653e49a69d05bf1d2898fef674454dc95e355b`.
The overall product run40520416859 still failed: its final proof job122256860941
could not start bash because NEEDS_JSON contained224618 UTF-8 bytes, above the
Linux131072-byte individual argument/environment limit. Minification would
still be223963 bytes. The largest leaves were the complete134215-byte task
receipt and72735-byte browser plan; neither may be truncated or omitted.

The canonical proof step now uses GitHub's custom-shell temporary-file contract:
`node scripts/ci-proof.mjs --emit=... --needs-file={0}` reads the JSON run body
as data. The runner writes that body to its own file; no shell, heredoc, native
action input or JavaScript source interpolates the JSON. See
[GitHub's custom-shell contract](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#custom-shell).
The optional file reader is shared with the fast emitter and leaves the old
environment path available only when no file source is selected. Missing,
corrupt or empty files, blank/missing paths, duplicate options and mixed
sources fail closed without fallback or a replacement proof. Schema, jobs,
identity, correlation, environments, validators and outcome rules are unchanged.

The trusted CI generator remains byte-for-byte unchanged. Only canonical
validate and its generated product profile select the file transport; the
small tooling workflow retains its supported legacy environment invocation.
Real cold fast-producer CLI tests cover the same shared optional file reader
and require identical typed output. This avoids changing the trusted generator
before its own acceptance or weakening compatibleCiGenerators.

The targeted suite passes100 tests: real producer file input larger than the
observed224618-byte failure, full payload equality, literal newline/Unicode/
quotes/$()/backticks remaining inert, invalid inputs refusing, and existing
failed/foreign proof checks. The original small environment CLI test remains.
The header lease fence also has one registered browser witness,
`plan-rotation-stale-header-observer-1070`, bound to the existing LED smoke.
Static readiness passes1958 definitions/545 browser guards/1080 unique source
reads; execution0, caught unknown/nightly. The200 guideline is unchanged.
This is author verification, not a manually assembled GREEN CI or CODE verdict.


The optional native-HA author utility now lives at the genuine existing local
utility route `scripts/dev/verify-plan-rotation-mobile-1070.mjs` (class B).
The former demo entry is removed, not aliased, and its one-off NOT_AN_INPUT
addition is removed: check-inputs and the complete trusted generator closure
match accepted dev again. Existing `scripts/dev/**` ownership already describes
these local utilities; no exclusion or fake CI consumer is introduced.
Only four import specifiers change, resolving to exactly the same files; all
driver statements and validators are unchanged. The original helper source,
SHA256, executed command and82/12 native receipt are preserved separately.
This utility remains a distinct author-native AC12 witness for the complete
five-width/gutter matrix, not a claim that the ordinary320px smoke duplicates
it or that CI executes external HA-cache proof. No extra capture is performed.
