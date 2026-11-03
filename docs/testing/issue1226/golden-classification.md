# Golden audit classification #1226

All267original failures are individually recorded in golden-classification.json:9preparation errors,139dimension changes,119same-size pixel differences. Original run41598951489 and original SHA/crop data remain immutable.

## Preparation repairs

The9former no-frame scenes now have addressed capture evidence. Capture success is not visual acceptance: generated PNGs can and do remain different. No baseline, threshold, skip or matrix member was removed. Source capabilities, joined header corners, native wide-tab layout and accessible SVG targets are the actual repaired contracts.

## Unresolved visual differences

The258differences are not classified as automatically acceptable. #1207changed the Sections/grid header and stage layout after baseline capture; this is a candidate common cause, not proof that every camera/fit change is correct. Same-size changes require semantic/pixel inspection too. A separate current cameraReady discrepancy is retained in the browser geometry classification. No blanket acceptance is performed.

Original crop delta histogram (width×height pixels):

```json
{
  "0×54": 129,
  "0×108": 1,
  "7×7": 2,
  "0×13": 3,
  "0×86": 3,
  "0×32": 1
}
```

Original files are in the process-next-result artifact of https://github.com/Matysh/houseplan-card/actions/runs/41598951489 . See the row-specific actual/baseline SHA256 and report paths; CI absolute paths are preserved as original evidence, not claimed to be current local paths.

Final full stable validation waits for confirmed product blockers and agreed visual intent. Regenerated captures are review material only.

## Read-only review package from resumed audit 41662157218

A local comparison gallery is prepared at
`output/issue1226/golden-review-41662157218/index.html` in the author's Windows
workspace. It contains all **267 differing current scenes**, with complete
baseline/actual PNGs copied alongside it. SHA256 verification matched all
534 source images against the saved report. `manifest.json` retains each scene,
source path, host, dimensions, pixel figures and both hashes. No capture/test,
threshold change or baseline acceptance was performed to create this package.

This current set contains 245 Lovelace and 22 panel scenes; 141 pairs change
image dimensions. These are current-run observations, separate from the
original 139 dimension changes and nine no-frame failures above.

A manually viewed example requiring a camera-intent explanation is
`panel-wide-plan-editor-dark-en`: both images are 1280×800 with the same header
and editor chrome. The actual image shows 108% camera scale, a larger floor
projection and a partly clipped lower outer notch; the baseline shows the
complete lower outline. This is an observed image difference, not a proved
product diagnosis: capture setup, settled camera intent and the accepted fit
contract still need to explain it. The saved runtime reports stage920×682.
CANVAS.md:138–157 and UX-MODES.md:108–112 explicitly require preserving
world centre and screen pixels-per-unit on editor entry, rebasing the relative
zoom against the new Fit and allowing stage clipping (#1207). The already
passing View frame visually retains approximately the same outer-wall screen
width as the actual Plan frame, unlike the smaller historical Plan baseline.
This is consistent with the accepted handoff, not evidence of a new camera
defect. Exact scene acceptance still requires the explicit review below;
neither changed header height nor a changed zoom badge alone proves a bug.

PROCESS.md requires explicit owner acceptance of listed frames after review.
The gallery is review material only, and no such acceptance has been inferred.
