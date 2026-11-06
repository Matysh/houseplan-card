# #1331 — baseline and addressed witness repair

Source: https://github.com/Matysh/houseplan-card/issues/1331
Baseline: be93fa714bfb253e1232d42e1c0b4c2c369cec7e.

The original 16 failures in nine Node files were reproduced on a detached git
archive before modifying expectations. Product behavior, PNG baselines and
physical tolerances are preserved. Current source-scanning dependencies now
include their actual wildcard scopes in selection and fingerprints. An infra
metadata change has no product component fallback. The metrics ZIP fixture
creates every artifact in mkdtemp and needs no product build.

Specific updates:

- The extra card layout stage is the Area relocation rejection rollback, which
  restores the prior placement; identity/revision ownership is still exclusive.
- The backdrop purpose port has sixteen members including rotationArm. The
  existing sixteen-member ceiling stays intact.
- Iso selection through an awaited page.evaluate callback is recognized; the
  obsolete viewModeSnap field assertion is removed, retaining camera reset.
- Optimize passage validation uses the current candidate variable.
- Compatibility source hits are reclassified individually:125 additions,
  11 obsolete hits removed,746 current hits. Existing lifecycle decisions,
  field provenance and sunset policy are unchanged. Structural migration hits
  belong to wall-model-chain/zero-wall-boundaries, profile types to
  external-screen-views; current helpers/local preference state use existing
  explicit exclusion categories. A negative test now mutates a proven stable
  branch rather than assuming the first branch has stable provenance.
- Smoke guards reference the bounded current runner, not retired Validate;
  the converter-created page is registered with the shared error watcher.
-41 named mutation definitions are updated to current source locations,
  canonical graph/host barriers, captured-toast API and exact name filters.
  Compiled-helper browser witnesses include their existing test-build prep.

Four obsolete mutation definitions are retired:

| ID | Reason and retained current coverage |
|---|---|
| space-copy-always-asks-to-optimize | #1227 intentionally copies accepted geometry without any Optimize prompt; current space-copy runtime tests assert this. |
| space-copy-skips-required-optimize | #1227 removed automatic Optimize, so skipping it is the required behavior. Current accepted-copy/strict server-proof tests remain. |
| space-copy-ignores-unsafe-optimize-preflight | #1227 removed the copy-time geometry/Optimize preflight. Current source proof and atomic refusal tests remain. |
| wall-draw-full-preflight-again | Stage4 routes explicit Draw intents through the common graph transaction; the former commitWallChainSegmentGeometry alternative no longer exists. Current physical proof/candidate counter tests remain; do not recreate a superseded bypass just to mutate it. |

The surviving rejected-copy witness targets current rollback/reload and the
`rejected copy restores` case. The graph-identity witness checks both explicit
live graph intents and prepared projection barriers. All new anchors must be
unique and all oracles must fail on the intended mutant after a clean pass.
Addressed witness receipts are reported separately from any complete shard.
No full-shard or release pass is implied by the registry's static validation.