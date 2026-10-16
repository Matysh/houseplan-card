# Author evidence for #924

This is a harness repair, not a product change or independent review. The old
CI failure named only `gridUsesContainerOwnedInlineHeight: false`; historical
transition flags and actual browser identity were absent. Its exact cause is
not retrospectively established by a later PASS or this new ordinary scenario.

## Reproduction and correction

An ordinary real Plan transition is started through `__hpTest.setMode` before
Sections setup samples its steady layout. On the unchanged three-RAF settle
reader, the new `setupDuringTransitionWaitsForSteadyLayout` check is false;
all fourteen inherited checks stay true. `artifacts/924/before.{log,json}`:
20:52:27–20:52:34 UTC, exit 1. No product code/compiled implementation, guard
assertion or timeout was patched/removed to obtain that failure.

After waiting for independent `_modeTransitionBusy` to clear (including its
preparing phase), the same whole smoke passes all fifteen checks, including
the original strict `stageStyle === 'auto'` assertion. Existing per-mode
transition-frame assertions are still sampled while transitions run, before
the steady wait. Header/stage sum, overflow, rows, languages, camera, hit
coordinates and bounded resize storm checks remain unchanged.

`env HP_SMOKE_CHECKS=1 node demo/smoke_sections_resize.mjs` — exit 0,
20:53:43–20:53:50 UTC, `artifacts/924/targeted.{log,json}`. Pinned browser
attestation is now required; actual browser/version is printed by the smoke.
No live HA or device writes, golden acceptance, historical replay, mutant run,
budget/timeout increase, arbitrary assertion retry or owner/GPU claim.

## Protective evidence and diagnostics

| Contract | Execution | Rejecting case / boundary |
|---|---|---|
| Independent readiness | Same active-transition setup now ends idle and fills the slot | Ordinary setup during a real transition failed the new steady-layout assertion on the original reader; readiness never polls `auto` or other assertion values |
| Existing geometry checks | All fourteen original check names remain, plus one | Existing strict inline-style/height/overflow/camera/transition assertions are retained; no value is coerced or failure filtered |
| Actionable failure data | Actual pinned browser, rectangle scalars, inline height, mode, phase, busy/preparing and timing recorded | Read in code: at most 48 samples; 6000 ms wait bound throws with snapshots rather than accepting an unready state; browser closes on evaluate failure. A timeout was not forced in this run |

This proves a legal timing path sufficient to produce the symptom, not that
the old job necessarily took it. Full local gate results are in the handoff.
