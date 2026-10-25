# 1.83.0-beta.2: prerelease integration checks

Accepted source `9995a8339265754a72fdb0e566f7d3001d73305f` contains all27
release members. Canonical all-parent history since beta.1 has304 commits;
all27 open-S8 issues have implementation evidence. Historical service issue697
is excluded from supplied membership. The new #1061 and #999 CODE reviews are
green, each H0/M0 at r1. These facts do not replace final candidate readiness.

Full Validate [40154314145](https://github.com/Matysh/houseplan-card/actions/runs/40154314145)
used full=true/candidate=false/fresh=false/mutants=false on that source.
Performance, tooling, packaging, HACS and the validated reusable product families
passed. Strict documentation freshness failed before the planned canonical
docs capture/accept. The full Golden artifact contains all242 scenes, matrix89,
with verified file hashes, source40e1748c and pinned Linux Chromium151.0.7922.34.
It has22 declared NEW and2 declared CHANGE, plus13 undeclared different scenes.
The24 other nonzero, passed scenes keep their old baseline PNG/hash under the
existing tolerance;180 byte-identical witnesses remain (floor10). No thresholds
or witness floor are changed.

## Named full-smoke failures and B repairs

- Shard2/job121052486382:147/148 scripts passed; `smoke_device_settings_947`
  used an ambiguous descendant h3 selector after #999 added a nested history
  heading. Select only the original direct main heading; retain its exact text
  and every other section/help oracle.
- Shard3/job121052486458:146/147 passed; `smoke_view_hold_lifecycle` still
  expected HA MoreInfo after fresh right-click. Original #1050 AC3 requires
  current-target device settings for this eligible writer/non-kiosk fixture.
  Assert the real settings dialog/target/View and zero MoreInfo/service/light
  actuation. Preserve held-retirement negatives and explicitly reject ghost
  settings in those negatives. The cancelled first shard is not complete proof.

These are precise fixture/obsolete-contract repairs under PROCESS11.4, not
product changes or permission exceptions. Targeted AFTER execution is recorded
separately; the original failed CI remains available.

## Explicit keyboard state for the three Plan captures

`geometry-plan-editor-dark` and the two `safe-resize-handles-clamp-*` captures
inherited Chromium focus-visible history from previous scenes on a shared page.
An ordinary pinned probe on published beta.1 and current accepted product took
exactly2 pages/4 frames: both matched source pairs are byte-identical, with
unchanged geometry/persistence and zero transport calls. Native Shift+Tab/Tab
sets real Plan keyboard focus; clicking that same focused tab retains it.
The current full-CI Plan delta separates into975 focus-outline pixels and810
pre-existing summary-control pixels. Focus is not new visual intent.

The fixture now names keyboard focus for just those three IDs, with real keys,
strict initial/final active-tab, persistence, geometry and Resize-preview
oracles. It first awaits the existing public boot terminal: the invisible
`.bootveil.off` can remove its SVG/path after220ms even after `_booting=false`.
No nodes are excluded from the geometry assertion. Matrix90 records this state
definition change; all242 IDs, meaningful scenario assertions and thresholds
remain. Shared-page collateral still requires the next complete capture.

Targeted verification on `99e91d02` passed the hold lifecycle smoke and all
three Plan captures through the unchanged selected runner. Visual review found
only the pre-existing summary-control residual (810/832/808 pixels), below the
unchanged thresholds; geometry, preview and real keyboard-focus guards passed.
The second vacuum-profile hover also needed the same direct-heading selector;
the first targeted smoke failure is retained rather than reported as PASS.
On `8cfdd3410d3825221b7380b5b2a5e59d9535b957`, the unchanged runner then
executed `HP_SMOKE_CHECKS=1 node demo/smoke_device_settings_947.mjs`: PASS,
including the complete multi-width/theme/section checks and zero commands.
The passing hold leaf was
`HP_SMOKE_CHECKS=1 node demo/smoke_view_hold_lifecycle.mjs`; Golden leaves were
`node demo/golden/run.mjs --mode=capture --scenario=<id>` for the three named
IDs. These are selected observations, not complete release proof.

## Existing scene accounting from the approved contracts

The original pending ledger names22 NEW and2 CHANGE scenes. Ten existing
scenes additionally show approved behavior whose existing IDs were omitted
from that ledger. Their scope comes from the original issue decisions and
accepted source below, independently of the red screenshot. They are explicit
extra CHANGE inputs to the canonical beta-derived workflow, subject to review
of the next complete capture. No Plan-focus scene is added to those inputs.

| Existing scene | Original contract and accepted source | Bounded intended difference |
|---|---|---|
| `device-icon-state-table-light`, `device-icon-state-table-dark` | #1026 owner decision [6374075078](https://github.com/Matysh/houseplan-card/issues/1026#issuecomment-6374075078), AC3; `d7961f90e` | Confirmed own-offline fades core contents only. The ordinary unlocked shell and LQI180 retain their paint. The fixture remains unchanged. |
| `device-issues-maintenance-plan` | #1026 AC1/AC3, same accepted source | Own connection=on and Power=off mean available/neutral; the appliance shell and maintenance overlay no longer inherit whole-marker fading. |
| `device-state-source-unknown-en` | #1026 AC2/AC3; #1051 UI-026/AC5, `9a55e2e0648` | Unknown remains unknown without false offline. The existing preview explanation becomes shorter; the selected marker behind the dialog uses the approved persistent blue fill. |
| `furniture-transform-light` | #1051 UI-019; `9a55e2e0648`, `editor-secondary.styles.ts` | The existing secondary Properties tray uses width352, padding16 and two-column actions. Tiny unrelated edge differences remain subject to the original tolerance. |
| `decor-color-popover-desktop-en` | #1051 UI-019, same source | The selected Line's secondary tray behind the dialog changes; this does not declare a new color-popover design. |
| `decor-color-popover-mobile-ru` | #1051 UI-019, same source | The selected Line tray and its existing shadow affect the lower panel region. A normal runtime observation reproduced all697 significant CI-delta pixels exactly inside this local mask; separate whole-frame focus differences are excluded. |
| `space-room-color-popover-desktop-ru` | #1051 UI-025, `space-form.ts`, same source | The approved room-field order changes inside the existing dialog; the native conditional/order/save-reopen checks remain. |
| `isometric-stage3-overlays-dark`, `vacuum-trail-smoothing-dark` | #1049 initial/reconnect adoption, `e72d20456a5d0a0bdcb4bb61663a25504517dd8b`; existing `VACUUM.md` moving-puck contract | Cold generic trail adoption now ticks rebuilt devices before capture, restoring the already promised live round puck for a moving robot with valid position/calibration. Path, dock, puck template and glyph remain the existing ones. |

For the vacuum source hypothesis, one ordinary smoothing preparation on each
immutable beta.1/current build observed identical HA, camera, calibration,
telemetry, route and viewport inputs. Beta.1 had no runtime/captured moving
fact or puck; accepted source had moving=true and one puck. This is matched
endpoint evidence, not an isolated-commit replay; the isometric branch is
supported by the same source predicate and its full-CI image. Any conflicting
fresh capture reopens diagnosis rather than granting broader pixel permission.

Thus the proposed explicit scope is22 NEW plus12 CHANGE (the original2 plus
these10). Existing passed, nonzero frames keep their old baseline hashes.
No tolerance, pixel witness, capture policy or acceptance predicate changes.

## Create room followed by full Optimize (#1061)

The owner's additional request explicitly covers that sequence. An ordinary
unchanged-product probe passed all5 real-batch states through actual config/set,
durable input, full TS Optimize, five invariants, authenticated HA Optimize,
both stores/reload, second Optimize exact no-op and paired Undo (HA5/5,7.68s).
Permanent tests join the exact TS output to the exact durable HA input/output
through an explicit synthetic delta DTO, without a backend Node dependency.
Existing room fixture bytes/identities remain unchanged. The DTO adds only one
configs0 inventory row; all older corpus documents/order are retained exactly.
Fresh emission and47 targeted Node tests passed;45 targeted Python/HA tests and
Ruff passed. No product code or safety limit changed.

## Final infrastructure acceptance and evidence boundary

The second full run, `40158618236`, completed with shards 2/3 passing 148/147
scenarios. Shard 1 reached 130 successful scenarios before its 25-minute job
watchdog cancelled it; 18 remained unexecuted. This is incomplete evidence,
never 443/443 or full release PASS.

#1064 passed ordinary CODE review r1 (H0/M0) and reached actual S8 at
`0908d904c0465b72d8715e8a38027ccde76a3209`. Its finite whole-job budget is 35
minutes, with the same three partitions, 180-second child limit, 10-second kill
grace and failure/empty guards. Author-targeted tests passed75/75, the normal
hook passed with 0 failures, and all three exact-source push CI runs succeeded.
The final beta candidate still requires strict full release CI.

The published CODE report also claims a temporary edit of the canonical job
limit followed by test execution and rollback. PROCESS §2.7/#905 defines that
as mutation execution outside the permitted nightly route, rather than an
ordinary negative input. This report claim is excluded from caught/AC1
evidence; the raw execution trace was not separately verified. The ordinary
author/CI results above are independent of that claim. The separate process
finding is [#1065](https://github.com/Matysh/houseplan-card/issues/1065), with a
[corrective comment](https://github.com/Matysh/houseplan-card/issues/1064#issuecomment-6393581133)
preserving the original report and source history. This adds no release waiver.
