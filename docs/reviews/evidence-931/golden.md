# #931 golden acceptance

Author visual acceptance of this task's declared shifts under PROCESS §3.13 / §8,
not an independent code-review verdict or an owner/GPU acceptance.

The first [CI run](https://github.com/Matysh/houseplan-card/actions/runs/39136209087)
captured all 212 scenes. All 31 differences were inspected against the old
baselines. Inspection found a real light panel in dark CSS-only themes; those
pixels were **not** accepted. Commit `8155041a3d6a0dae287222f4385b21960ff2fa12`
fixes that fallback and adds six computed-colour cases. The old signal-settings
witness now follows the native double-click entrypoint in wide editors while
retaining its 16 assertions.

The corrected complete capture used the published clean commit above in ext4 WSL,
Playwright 1.62.0 / Chromium headless-shell 151.0.7922.34 revision 1234.
Attestation: `7c809d618652cff94926b777ba17e82dc25c32688ff1fddcf721298611f14afd`.
There are 212 frames, no capture errors, and 118 byte-identical undeclared
environment witnesses (floor 10). Corrected dark frames were inspected again;
unchanged light frames retain the already-inspected output.

Only these existing scenes are declared; there are no new scenes:

- Wide empty panel, narrowed canvas and wrapping native toolbar:
  `panel-wide-plan-editor-dark-en`, `room-label-parity-plan-dark`,
  `room-label-parity-plan-light`, `geometry-plan-editor-dark`,
  `geometry-devices-editor-dark`, `geometry-decor-editor-dark`.
- Same physical geometry/preview with the narrower canvas and native guides:
  `hidden-wall-diagnostics-plan-light`, `hidden-wall-diagnostics-plan-dark`,
  `safe-resize-handles-clamp-light`, `safe-resize-handles-clamp-dark`,
  `space-tab-drop-before-light`, `space-tab-drop-after-dark`,
  `plan-snap-endpoint-light`, `plan-snap-line-gaps-dark`,
  `wall-junctions-plan-preview-light`, `wall-junctions-plan-t-dark`,
  `junction-patch-resilience-plan-dark`, `opening-placement-door-thick-wall-dark`,
  `opening-placement-passage-thick-wall-dark`,
  `opening-placement-passage-thick-wall-light`.
- Narrowed device canvas; the hidden device and lighting remain visible:
  `hidden-devices-editor-dark`.
- New persistent selection cue/handles and properties, with the native tray kept:
  `stairs-flat-selected-light`, `tray-wide-selection-en`, `tray-wide-tool-ru`,
  `furniture-transform-light`.
- Furniture library reflows in the narrower stage; its native nearest-wall
  preview follows the new camera-to-pointer geometry:
  `furniture-placement-preview-light`.
- Dialog content/controls stay unchanged; the background now contains the
  narrower plan and properties column:
  `device-inbox-desktop-en-light`, `device-inbox-desktop-ru-dark`,
  `device-dialog-desktop-en`, `device-dialog-desktop-de`,
  `toggle-entity-dialog-desktop-en`.

`npm run golden:accept -- --reviewed --from=artifacts/golden` was invoked with
exactly those 31 `--expect-change` IDs. It replaced 31 baselines and retained
181 without rewriting even sub-threshold drift. No masks, matrix definitions,
comparison thresholds, renderer fixtures or approved designer references changed.
The committed baseline manifest contains the local provenance. A fresh full
GitHub Validate must still verify the resulting commit before S7/merge.
