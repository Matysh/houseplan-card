# Kiosk clock diagnosis — #949, 2026-10-17

Material: accepted `dev@f039a132a4178c7d9823d83c289426bf1f1b37ed`.
Environment: WSL Ubuntu/ext4; Node 22.23.3, Playwright 1.62.0,
actual Chromium headless-shell 151.0.7922.34. No product source, CSS,
duration, thresholds, workload or golden baselines were changed for diagnosis.

## Retained baseline and diagnostic outcomes

Each series was bounded in advance; none stopped at the first PASS or replaced
a failure with a successful retry. Local raw and JSON start/end/exit receipts
remain under `artifacts/949/` (not generated acceptance artifacts in Git).

| Series | Evidence names | Outcomes |
|---|---|---|
| Initial unchanged smoke | `parent-{1,2,3}` | 3 PASS |
| Fixed ten unchanged smoke processes | `unchanged-fixed10-{1..10}` | 9 PASS; #4 FAIL `idleFitsBefore90sTick` |
| Original final evaluate plus read-only state log | `original-diagnostic10-{1..10}` | 9 PASS; #10 same FAIL |
| Final-evaluate logging only on wrong zoom | `original-conditional20-{1..20}` | 19 PASS; #1 same FAIL |
| Late CDP logpoint | `original-logpoint10-{1..10}` | 10 PASS, diagnostic only |
| CDP logpoint installed before kiosk setup | `original-early-logpoint10-{1..10}` | 9 PASS; #5 same FAIL and causal stack |

Early small diagnostic variants (`diagnostic-{1,2,3}`, `diagnostic-cpu4`,
`diagnostic-cpu16`, `diagnostic-hass`) passed; their additional observations
are not acceptance proof. Two separately bounded diagnostic series
(`original-conditional20` and `original-logpoint10`) overlapped; no performance
conclusion is drawn.
The historical [red Validate](https://github.com/Matysh/houseplan-card/actions/runs/39025612074)
on `08828d21cae322f3c5d0f1483d990bd78c974595` remains red.

## Causal observation, not a replacement implementation

The CDP conditional function-call breakpoint does not pause or replace any
function. It reads only an already active `reason=fit` transition within 500ms
of the idle deadline and records the native stack/geometry/animation.

The accepted parent produced this sequence in `original-early-logpoint10-5.log`:

```text
performance.now = 61936
camera.startedAt = 61930, reason = fit, duration = 220
camera.from.zoom = 1.7254901960784315, camera.to.zoom = 1
stage = [780,792], last accepted = [780,787]
native height CSSTransition: running, currentTime = 183.334ms
ResizeObserver → _refitView → _cancelCameraTransition
FAILED (1): idleFitsBefore90sTick: expected true, got false
```

The minimal relevant scenario is initial boot → public `setConfig(kiosk:true)`
plus the existing server fixture → native Enter on room label → 300ms JS
`runFor` → `fastForward` to idle−1 → 300ms JS `runFor`. The final wrong zoom
has no camera controller state because a real resize cancelled its transition;
saved `f1:1` alone proves nothing, since it was seeded before the scenario.

The header disappears while post-boot `.stage.hpsettle` still has a native
250ms height transition. Chromium CSS time has advanced only 183.334ms when
the synthetic JS clock reports 60 seconds. Structural resize correctly owns
the viewport and cancels the camera. The test's setup, not the product's
resize policy, is wrong. An extra CDP round-trip can move the real CSS timeline
past this window, explaining why previous extra observations sometimes hid it.

## Correction and negative evidence

`waitForKioskViewport` runs before the first clock freeze. It checks completion
of native height transitions and accepted ResizeObserver/Lit geometry, not the
zoom being asserted later. The 5s timeout is bounded setup failure; the original
60s pause, 90s tick and 300ms post-deadline windows are unchanged. No animation
is disabled, no expected value is polled to green, and no product file changes.

The readiness unit rejects running and paused height animations even with
identical sampled boxes; it separately rejects pending refit/Lit, mismatched
accepted size and unusable setup. A ready fixture deliberately retains zoom
1.72549, proving readiness is independent of idle-fit success.

Registered witness `kiosk-idle-deadline-skips-fit` targets the exact deadline
callback and uses the existing injected-clock unit (60s fit before 90s tick).
It was **not executed**: PROCESS §2.7/#905 reserves mutation execution for the
nightly workflow. Static anchor readiness / ordinary PASS is not caught proof.
All original browser smoke assertion names remain; only pre-scenario readiness
is added. Full exact-material Validate is requested with `ci:full`.

## Local candidate evidence

The first corrected smoke passed (`candidate-1`). The predeclared independent
ten-process cohort `candidate-fixed10-{1..10}` then passed **10/10**, without
retries, on the same accepted product bundle. `gate-small` ran
`npm run gate:small -- --smokes` and passed (2026-10-17 18:46:40–18:49:05 UTC);
its ordinary unit suite includes the new readiness negatives.
`static-witness` ran `node scripts/mutation-gate.mjs --check` and passed with
execution=0, caught=unknown. These are local observations, not a substitute
for the requested exact-SHA full Validate or independent review.
