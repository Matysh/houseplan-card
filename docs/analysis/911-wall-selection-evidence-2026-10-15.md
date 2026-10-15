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
