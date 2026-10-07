# #815 — battery input witness, 2026-10-07

## Observed failure and evidence limits

The [nightly run](https://github.com/Matysh/houseplan-card/actions/runs/37581891450)
on `dev@20b69d872c0f`, shard 10/job 112663343407, reported:

- clean `node demo/smoke_device_battery.mjs`: green at 06:34:06.515 UTC;
- `battery-passive-frame-intercepts-pointer`: survived at 06:40:16.533 UTC.

That registry entry changes only the battery wrapper's `pointer-events: none`
to `auto`. The static space card independently forces `pointer-events: none`
on its whole subtree, so its computed-style assertion cannot witness this
mutation on the interactive card. The old main-card witness sampled one point,
checked absence of a dialog and measured a touch pan, but did not explicitly
assert the main wrapper's computed passivity or prove which trusted input
reached the scene. A later successful pan alone is not proof of initial target
ownership, and absence of a dialog alone is not proof of working input.

The exact reason the old main-card point check stayed green is **not proven**:
the nightly reporter discards stdout/stderr for a surviving guard. Read-only
inspection found no swallowed false in `checkAll`/`finish`, extra main-card CSS
override, missing bundle input or source difference in the relevant smoke/CSS
between the failed material and the implementation base `fd950549`.

On the clean current bundle, the old smoke passed all 54 checks. Its desktop
sample was `(535.617, 424.531)` in a 1200×900 viewport; mobile sample
`(333.617, 328.031)` in 430×820. Both hit the room surface. These baseline
observations do not reproduce the mutant or establish its runtime geometry.

## Fix and acceptance

The existing smoke now checks the interactive card separately in Flat,
2.5D and mobile layout. It reads computed pointer-events for both wrapper and
HA icon, requires a visible nonzero frame outside the old shell, and briefly
hides the battery through the public config fixture to prove that the sample
does not belong to a pre-existing device hit target (including the 44 px floor).
After restoring the setting it checks that the frame did not move.

Capture-phase observers record actual `pointerdown` events and their composed
paths. Exactly one trusted event of the requested mouse/touch modality must
arrive through the actual scene stage without a battery or device in its path.
A pure predicate test rejects empty, ambiguous, synthetic, wrong-modality,
off-scene (including chrome/dialog) and intercepted observations.
The original click/no-dialog and pan/displacement checks remain. A positive
control then clicks the re-measured device core and waits for its info dialog,
so an inert scene cannot satisfy the negative activation checks.

| AC | Evidence | Negative witness |
|---|---|---|
| AC1 | `HP_SMOKE_CHECKS=1 node demo/smoke_device_battery.mjs`: main-card runtime CSS/visibility/hidden-frame controls, Flat + 2.5D + mobile. | Existing `battery-passive-frame-intercepts-pointer` now directly violates main-wrapper computed passivity. Execution/capture is reserved for the nightly run, not claimed locally. |
| AC2 | Same smoke: actual mouse/touch composedPath, no info from the battery, pan >15px and core→info positive control. | `node --test test/battery-input-witness.test.mjs`: empty, duplicate, synthetic, pen and battery/device-owned records all return false. Missing browser delivery or a disabled scene fails the smoke. |
| AC3 | `gate:small`, `mutation-gate --check`, diff review and clean worktree before push; exact SHA/results in the issue handoff. | No product CSS/TS, registry patch, skip, threshold, baseline, budget or CI policy change. The existing mutant remains unchanged. |

Targeted clean results in Ubuntu/WSL, Node 22.23.2 and lockfile Playwright
Chromium: predicate test 1/1; battery smoke 63/63 named checks true, exit 0.
The nine added assertions supplement, rather than replace, the original 54.
The mandatory full local gate is recorded against the final material in the
handoff. No actual mutants were executed: PROCESS §2.7 leaves their capture
to the nightly full run. This change does not certify that a future nightly
run has already passed, and the issue is not closed before release.

## Risk boundaries

Async/input: observe delivered trusted events and wait for settled UI/positive
dialog. Geometry: measured frame and public hide/restore control, no production
geometry change. Data/permissions: synthetic demo config only, original battery
mode restored in `finally`; no Home Assistant instance touched. Visual/perf:
no product render, numeric budget or golden change; the extra work exists only
in the smoke. Host: desktop mouse and mobile trusted CDP touch, not synthetic
DOM pointer events. A failed browser assertion still reaches the existing
`finish()` error/teardown path.
