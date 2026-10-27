# View device menu #1089 — implementation evidence

SPEC r1 GREEN: `e6a4a5658d26c4231ed6c1b77ff88fd5b053d71d57f01f429655a7a4aefd966c`, issue comment 6443383278. This is implementation proof, not an approved global Golden baseline.

## Final joint source and executed proof

Accepted #998/#1000 base `592c2a5ce85348542e12cf4feddc3a86f08d52dd`; accepted documentation-only #1107 merged at `1c3f917bfd7a2e3a3c015dd864c4a7ae08e74532`. Final product fingerprint `06085343dcf1c54549164daed071b89c03a8be59f216cdf569896f41839c84f2` and manifest SHA256 `9cfb08fdca35f7df4dd043e4784ea04d92d7b63292fc09371c8757cd6ed96da1`. The source fingerprint and all 73 manifest asset hashes were verified after the documentation merge. Subsequent changes in this packet are documentation only, including correcting the paint-category inventory count to its 93 listed IDs (550 total).

`final-accepted-joint/` contains actual Linux Chromium 151.0.7922.34 / Playwright 1.62.0 output for:

- `node demo/smoke_view_device_menu.mjs` — PASS, real menu, information, Settings Save, Hide/Show, confirmed/declined Delete, read-only and refused-writer rollback.
- `node demo/smoke_dialog_picker_998.mjs` — PASS, 158-control runtime inventory and all 11 genuine pinned HA 20260930.4 checks.
- `node demo/smoke_dialog_modal_recovery.mjs` — PASS, shared native-modal recovery and alerts/HA coexistence.
- `node demo/smoke_marker_alerts.mjs` — PASS, accepted alert constructor remains functional.
- Four selected `demo/golden/run.mjs --only=<id> --capture-only` frames: writer dark, reader light/RU, isometric edge, hidden/RU. Each report has the final fingerprint, styled menu, fits=true, horizontalOverflow=false and exact expected rows/disabled states. `missing-baseline` is expected for these newly registered scenes; no global baselines were accepted or changed.

All four final PNG SHA256 values exactly match the earlier visually inspected implementation captures (writer dfde3220, reader 254a13ed, edge 0eccb3b1, hidden 3ba0a32a; complete hashes are in each JSON). The actual edge fixture positions the menu above its anchor. The common EditorContextMenu provides the existing row dimensions, separators, typography and colors; no separate View visual design was invented.

## Retained unchanged behavior proof

`retained-accepted-alerts/` preserves actual logs from accepted-#1000 joint source fingerprint `025886a302408a9ce369bf019e576f00496009dfaef992c8d5c55f41efa8830a` at `1ac5d763ae0c94ba32b9329a5ba1f6aaabf1b9b7` (the fingerprint, rather than this short context label, identifies the built source). These are explicitly earlier evidence, not recaptured final-source runs: lifecycle held-import/confirmation/outside/failed-fetch cases, complete Settings/HA more-info regressions, native hold cancellation and alert View behavior. Their unchanged menu/hold/current-target implementation remains in the final tree; the affected common forms and alerts were re-executed above after #998. Targeted units passed 108/108 in this phase. Final normal pre-push and selected CI results are recorded in the issue handoff, not inferred from this historical run.

`1089-final-static-witnesses.log` records the three #1089 witness definitions passing static readiness against the final source, execution=0 and caught=unknown. Mutants were not executed during development.

## Measured cost and limits

`1089-final-price.json` compares verified complete dist trees with the frozen accepted #998 source (555 fingerprint input files identical to accepted dev, all 71 base assets verified). Candidate deltas: initial gzip +707 B, lazy editor +1098 B, onboarding +9 B, full managed bundle +10971 B, hostRefs +15. Full managed bytes include the manifest, not only summed JS files. Final candidate: 352904 / 375012 / 44655 gzip B, 3630487 managed B, 6479 hostRefs.

Owner authorized budget increases rather than byte shaving. Rationale [6455534939](https://github.com/Matysh/houseplan-card/issues/1089#issuecomment-6455534939): lazy editor ceiling increases by the measured +1098 B to 373073, preserving the inherited 1939 B over-reference and existing 2000 B band. Monolith reference adds only the measured own host delta, preserving inherited debt, and records full raw bytes. Prior finite core reference rationale is [6453203632](https://github.com/Matysh/houseplan-card/issues/1089#issuecomment-6453203632). No timing, initial-view, onboarding or absolute limits changed. `1089-final-budget.log` passes.

## AC and negative witnesses

| AC | Executed witness | Negative input / registered breakage |
|---|---|---|
| 1 | smoke_view_device_menu: exact five rows; native context, keyboard anchor, no opening side effect | No menu-open service/write; view-menu-info-opens-wrong-target-1089 registered only |
| 2 | smoke_view_device_menu real Settings Save; smoke_device_settings_action complete regression | Read-only three disabled, held Settings authority tests; view-settings-retired-intent-accepted registered only |
| 3 | smoke_device_more_info complete real form/event regression; lifecycle strict readable foreign/missing menu rows | Foreign/missing disabled with local Card still enabled; more-info-tap-opens-measurement-1087 registered only |
| 4 | smoke_view_device_menu local Card exact ID and zero wire calls; unit current roster | Virtual has disabled HA but enabled local Card in unit; wrong-target menu witness registered only |
| 5 | smoke_view_device_menu real Hide and hidden-eye Show read back through config/get | Other marker and eye unchanged; inactive HA cannot Show in View owner unit |
| 6 | smoke_view_device_menu Cancel and actual confirmed Delete; lifecycle five stale confirmations | Cancel no write, permission/rebind/hidden/user/space changes no stale delete, HA registry survives |
| 7 | lifecycle held View import: permission, space, hidden, rebind, detach, newer owner, blur, pagehide, user, connection | view-menu-forgets-generation-1089 registered only; stable state ticks preserve menu |
| 8 | basic native Escape and Shift+F10, actual resize; lifecycle native outside/fresh click; Golden edge | view-menu-outside-click-leaks-1089 registered only; real edge fixture places above anchor |
| 9 | smoke_device_settings_action kiosk/touch matrix; smoke_view_hold_lifecycle native touch/mouse/cancel/pan/pagehide | Existing touch-pinch-contextmenu-guard-removed and view-pan-context-tail-unowned; negative tail additionally forbids leaked menu |
| 10 | resource oracle cold menu/HA/Card no editor; lifecycle actual aborted module fetch, Retry and fresh intent | Failed import visible and old intent not revived; no new polling/rAF; measured price separately |
| 11 | Four selected actual PNGs plus shared stylesheet adoption/runtime units | Fits/overflow/disabled/hidden native assertions; global baselines untouched |
| 12 | RU/EN guide/changelog, subsystem docs and major ledger1089; locale/build/gate | Backend untouched; shared EditorContextMenu and same stylesheet adopted once |


