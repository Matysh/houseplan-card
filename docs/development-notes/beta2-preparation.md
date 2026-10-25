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
