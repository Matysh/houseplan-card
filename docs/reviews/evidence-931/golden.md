# #931 golden acceptance

Author visual acceptance of this task's declared shifts under PROCESS §3.13 / §8,
not an independent code-review verdict or an owner/GPU acceptance.

## Current joint-source acceptance (matrix 78)

The matrix77 record below is historical; its complete GitHub Validate
[39139573032](https://github.com/Matysh/houseplan-card/actions/runs/39139573032)
passed before accepted #945 landed in dev. The branch then integrated #945,
preserving all of its schema, forms and accepted baseline provenance rather
than asserting that the old receipt covered new source.

The new complete attested capture uses the clean published joint commit
`a0626bbabe2404965d47c3d26a284b2bebb70f6d`, matrix78, the same pinned browser,
and attestation `73f061aad3ad31208cec7a5ffedbbe7537286a23bbaf3d4d994b5b6109663969`.
All212 scenes were captured without errors; 121 undeclared frames are
byte-identical environment witnesses (floor10). Every one of the31 declared
#931 frames is byte-identical to the already-inspected accepted frame in
`a1b3eb52`; its visual decision therefore remains unchanged. The same exact
31-ID acceptance below replaces only those frames, retaining181 references,
including the four accepted #945 changes, without touching thresholds/fixtures.
The new baseline manifest carries this joint-source provenance. Fresh exact-SHA
GitHub validation of the baseline commit remains required before review/merge.

## Original visual decision (matrix 77)

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
