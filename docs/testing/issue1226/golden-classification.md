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
