# #911 author evidence (not a review verdict)

Base: dev `9d6f51b5663807e0c57101cc43c4e897b7497035`, after #900 S8.
Task: accepted SPEC-REVIEW-911-r1, issue-body digest `2f014da48c75`.
Owner's batch instruction explicitly overrides new-issue creation: out-of-scope
findings go to the coordinator's batch file, never a new issue; in-scope defects
remain here. No owner/field/GPU acceptance is claimed.

## Ordinary RED and executed acceptance

Before any source edit, the initial public-opening addition to the existing
`smoke_wallthick_standalone` failed exactly two target assertions: room and
partition both opened a real dialog, but painted zero bands with the pointer
away. Existing controls still passed. Raw: external
`/home/matysh/hp911-evidence/baseline-native-red.log` + `.result.json`, exit 1.
This was the initial four-assertion opening witness, not a claimed full lifecycle
RED of the later expanded scenario.

The same existing smoke now includes 39 #911 assertions alongside its original
ten controls: real toolbar/mouse openings, focused unapplied field and neighbour
hover, held/terminal dialog movement and pan, actual camera-change controls,
wheel zoom, viewport resize, complete config/layout/history/wire equality,
Escape, tool/floor/View retirement, public Apply/Apply-room + exact wire values,
full-config Undo, kiosk and ordinary remount. `full-native-owner-green` passed
in 9.5 s. The path/width is frozen under field edits, and the one visible band's
screen rectangle follows the physical wall, not dialog/cursor coordinates.
Hidden settled DOM is allowed only while its live counterpart owns paint; this
is tested by effective opacity/visibility, not by pretending two DOM nodes are
two visible copies. An intermediate red caught precisely that missing ownership
class before it was fixed through the existing live editor mechanism.

Other executed checks (raw/result files in that same external directory):

- `selected900`: original #900 native smoke, 58 checks, PASS (33.5 s).
- `selected303`: physical hover-width and generous-hit controls, PASS.
- `selected-thickness`: existing wall-thickness suite, 31 checks, PASS.
- `selected-editor`: existing editor input suite, 18 checks, PASS.
- `units`: pure selection + grid-scale, 12 tests, PASS.
- `candidate-native-contract`: candidate floor/profile contract, 13 tests, PASS.
- `scoped-current`: selection/grid-scale/live-editor/candidate suites, 33/33
  PASS on the completed material. The earlier `scoped-final` attempt had one
  profile-floor failure while that tooling addition was incomplete; its other
  114 tests (including all 82 mutation-registry units) passed. The missing floor
  was added and the completed candidate suite rerun, not muted.
- `static-mutants`: 1606 definitions, 832 unique reads, execution 0;
  caught status unknown until nightly. Six new declarations, three browser
  guards; 375/200 is the unchanged advisory policy, not a raised limit.

The new native script floor is registered under the existing candidate editor
profile. No private dialog setup or new smoke process duplicates the scenario.
One attempted invocation of a nonexistent `smoke_live_markup_selectors.mjs`
failed at Node module lookup; it is not product evidence or a passed check.

## Protective AC and negative witness

| AC | Actual witness | What makes it red (declared, not executed mutation) |
| --- | --- | --- |
| AC1 | ordinary public-opening RED then native PASS, room + partition | `wall-selection-hidden-with-dialog` |
| AC2 | native held/terminal physical geometry, one visible painter and complete no-write snapshot | `wall-selection-not-live-owned` |
| AC3 | pure current-owner width, zero, reversed, moved, absent and foreign controls | `wall-selection-foreign-floor-accepted`, `wall-selection-stale-room-fallback`, `wall-selection-disregards-current-width` |
| AC4 | native toolbar/floor/View/remount and Apply/Undo controls | `wall-selection-ignores-tool-boundary` |

## Budget dependency: deliberately not GREEN

On the current pre-#912 base, `gate-pre912` ran the normal `npm run gate:small`
with exit 1 in 144.3 s. Build/typecheck and bundle integrity passed. Unit counts:
4934 passed, 1 skipped, 2 failed; both failures are the real lazy-editor ceiling
in `bundle-assets.test.mjs` (#593/#627), not hidden product failures.
The mandatory budget/monolith checks also refused:

- bundleBytes 2933370 vs authorized #900 centre 2931171 + unchanged band 2000:
  199 B beyond the band (1489 B over the measured accepted #900 build).
- lazy editor 266250 gzip vs current centre 263811 + unchanged band 2000:
  439 B beyond the band.
- initial View 321672 gzip; lazy LED editor 10800 gzip.
- delegates 145, port members 352, host refs 5364, port privates 102,
  harness privates 101; no dead code.

The early gate's `HEAD` was still the base while source was dirty: its diff-only
selection/no-new-any results do not substitute for final committed-material
gates. No budget, band or gate has been changed. Per coordinator, wait for actual
#912 S8 (its owner-approved ceilings), then ordinary rebase and fresh complete
measurements/gates. These numbers are not a prediction promoted to acceptance.

## Boundaries / risk pass

- Async: no new timer, observer, promise or listener; the existing live owner
  handles paint/cleanup, and session/model cache retains at most one result.
- Data/rights: editor-only, no persistence/schema/migration or permission change.
- Geometry: presentation resolves a current room span/partition; it never calls
  a geometry writer. Missing/foreign targets return null; Apply is unchanged.
- Visual: same palette, alpha and shared physical/zero width policy. No View or
  kiosk selection; no duplicated visible live/settled band.
- Volume/performance: only one chosen room profile/partition search on a changed
  opening/model/epoch, not `wallIntervals` over the whole floor per pointer move.
- Host/input: original hover and wallhot getter unchanged. No new port, input
  handler or intercept; #900 remains the gesture/dialog owner.

Stable v1.80.1 was personally read with `git show`: its `_wallThickHover` already
returns null for an open dialog. Ledger is a real `stable-fix` with RU/EN summary,
not SPEC publication accounting. Native headless proof is not field/GPU proof.
Touch editor: best effort / intentionally degraded. Physical touch/pen and an
actual HA deployment were not tested; there is no new touch route here.

## Frozen pre-dependency checkpoint

Source/test implementation commit: `55f2cc4626abc575a2ea8b2c8155a87928ee8018`,
tree `396e237c5ca3ae7941f1ad8039df758e869fa3a7`. A fresh build+sync (19.3 s),
native 49-check smoke (9.6 s), process gate (one commit, no warnings), no-new-any
(67 added source lines), private-write gate and ledger catalogue all passed.
The catalogue independently records real stable-fix membership and the earlier
SPEC trace. Current raw/gzip measurements are exactly the budget figures above.
No ordinary push was attempted while the mandatory budget gate is red.

Additional completed neighbouring checks: `committed-lazy` PASS (13.7 s),
`selected-esc` PASS, `selected-pan` PASS, `selected-floor` PASS (7.9 s) and
`selected-layers` PASS. An earlier lazy-style attempt followed `bundle:clean`
with a still-new demo copy, so its manifest named an absent old asset; this was
an author-produced incoherent test environment. Rebuilding/syncing the complete
artifact tree fixed that attempt without source, test or gate changes.

Committed `smoke-select` reports 121 direct matches, no registered additions,
four broad symbols (`_cellCm`, `_cfgEpoch`, `_gridPitch`, `_space`), and proven
diff linkage. Decision for each direct row is: RUN if it is one of
`smoke_wallthick_standalone`, `smoke_canvas_surface_gestures`,
`smoke_wallthick_hover_width`, `smoke_wall_thickness`, `smoke_editor_gestures`,
`smoke_editor_styles_lazy`, `smoke_esc_dialogs`, `smoke_pan_any_zoom`,
`smoke_space_switch_transitions`, `smoke_hide_layers` (all executed PASS);
otherwise NOT RUN in this task. The other 111 rows match only shared existing
host APIs/types (`_spaceModel`, `_tool`, `spaceId`, `cellCm`, etc.), not a changed
geometry writer, hit resolver or input handler. The ten chosen cases cover the
actual selected projection, current physical widths, retained camera frames,
lazy style ownership, Apply/Undo and teardown. Geometry, Glow, radar, opening,
resize, PDF and device writers are unchanged. This is a deliberate reduced
selection with a decision for every row, not a claim of 121 executed smokes.
The raw selection remains external `committed-selection.log`.

Only remaining refusal is the existing budget dependency. Per coordinator,
pause under `blocked` until actual #912 S8, then rebase and rerun the real final
gate on that exact combined material. No new owner question or ceiling change.

## Resumed after actual #912 S8 — fresh evidence, not relabelled history

The checkpoint and failures above remain historical. #912 reached actual S8
on accepted dev `50061947a3ee28486799a0f5300967952eac12dd`; the coordinator was
notified before the resume claim
[#6198374660](https://github.com/Matysh/houseplan-card/issues/911#issuecomment-6198374660).
An ordinary rebase preserved the frozen implementation, tests, native candidate
profile and all ten mandatory observable floors. The sole conflict was an
append in DEVELOPMENT: both accepted #912 documentation and this witness remain.

Owner approval
[#6197386516](https://github.com/Matysh/houseplan-card/issues/911#issuecomment-6197386516)
authorizes the already measured batch's exact raw centre **2940437**, not any
future growth. Separate normal budget-only commit `48664833` changes only
`bundleBytes` from 2936529 to 2940437. The band stays 2000; editor centre 265955
and its 2000 band, all other ceilings and every gate remain unchanged.

Fresh executed evidence material is
`48664833202238ee256aa5ebed61e8f9a8dfa408`, tree
`162dd6a0ff6a9095976b3ebd6cfbb147dcae9072`, based on accepted `50061947`:

- `resumed-gate`: normal `npm run gate:small`, exit 0, 205.207 s,
  2026-10-15 17:39:10–17:42:35 UTC. Build/typecheck, units, artifact integrity,
  no-new-any, layout-read/private-write checks, smoke selection, budget and
  monolith checks all passed. The success summary does not print unit counts;
  historical unit counts above are not substituted for this run.
- `resumed-metrics`: `npm run lint:unused`, exit 0: raw 2939555; delegates 145,
  port members 352, host refs 5364, port privates 102, harness privates 101;
  no dead code. `resumed-gzip`: `npm run bundle:budget`, exit 0: initial View
  322233, lazy editor 266508, LED editor 10796 gzip. Every current budget passes.
- After the completed gate, `resumed-sync` made the complete dist/demo artifact
  tree coherent. It was kept intact through every following native invocation.
- `resumed-native`: existing standalone, 49/49 PASS, 9.765 s; actual public
  openings/held/terminal/lifecycle/no-write/Apply/Undo controls, not equivalence.
  `resumed900`: existing canvas-surface gesture smoke, 58/58 PASS, 28.747 s.
- Eight further actual PASS invocations: `resumed-wallthick_hover_width` (1.784 s),
  `resumed-wall_thickness` (1.919 s), `resumed-editor_gestures` (3.392 s),
  `resumed-editor_styles_lazy` (13.616 s), `resumed-esc_dialogs` (1.577 s),
  `resumed-pan_any_zoom` (2.294 s), `resumed-space_switch_transitions` (8.041 s),
  `resumed-hide_layers` (2.678 s). Each has its own true exit 0, raw and material
  record. Together with standalone and #900 these are ten executed smokes.
- `resumed-scoped`: 33/33 selection/grid-scale/live-editor/candidate tests PASS.
  `resumed-static`: mutation registry `--check` PASS, 1613 definitions / 834
  unique reads, 375/200 advisory browser guards and five existing warnings.
  Mutation execution remains **0**, caught status **unknown**; declaration and
  static checks are not a claim of catching a mutant. `resumed-ledger`: PASS.
- `resumed-pins`: Node 22.23.3, Python 3.14.7, HA 2026.8.3, pytest HA 0.13.357,
  Playwright 1.62.0; launched Chromium headless-shell 151.0.7922.34, revision 1234.
  This is native headless implementation proof, not owner/field/real-GPU proof.

Raw/result pairs remain external `/home/matysh/hp911-evidence/resumed-*.log`
and `.result.json`. Each new result records actual HEAD/tree, command, timestamps,
true exit and raw SHA256. For example, the full gate raw SHA256 is
`f752806b694143071a0923760037b8ce08dc591252d8aeeccde50fff8181bd36`.
No old artifact or the coordinator's aggregate diagnostic tree is promoted to
proof of this resumed SHA.

Separately, `resumed-equivalence` establishes only that seven full selection,
native/profile/test files and the 24 changed runtime lines equal the frozen
delta; it is not another executed native result. Fresh `resumed-selection`
still reports 121 direct / zero registered matches and the same four broad
symbols. The per-row RUN / NOT RUN rule above is unchanged: those exact ten
smokes were freshly executed; the other 111 were deliberately not run. No
geometry/input writer, backend, Glow or View-device behaviour changed here.
No fullValidate, ci:golden, physical touch/pen or HA field acceptance is claimed.

The technical dependency refusal is resolved. This material is ready for the
ordinary final documentation commit, process check and mandatory push hook;
those later checks must be reported against their actual resulting HEAD.
Independent review and an explicit coordinator S7 slot remain required. A later
accepted dev advance requires an ordinary rebase and proportionate fresh checks,
not a retroactive claim that the 48664833 run tested that future base.
