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
## Addressed sensitivity receipts

The first batch at 3d33134daf ran every clean guard successfully, then caught
36/41 mutations. Four survived and one failed in TypeScript preparation; those
are failed proofs, not passes. The full batch receipt is retained in
output/issue-1331/witness-receipt.json, with per-ID outcomes in witnesses.log.

The five addressed repairs are:

- copy-pair-skips-server-acl: also remove the current commit-history authorizer;
  leaving it in place prevented the intended unauthorized commit. Retry clean
  PASS and caught1/1 at07881c9dd0.
- optimize-reports-work-it-did-not-do: mutate the public Optimize changed result,
  not the superseded private intermediate. Retry clean PASS/caught1/1 at3761906b9b.
- plan-rotation-stale-header-observer-1070: a dedicated native observer witness
  retains the actual callback and delivers it after its lease is retired by
  public kiosk configuration. Synchronous RAF instrumentation counts work
  scheduled by that callback only. DOM reuse is valid; retired observation must
  schedule none. Current header phase/data revisions remain unchanged. Retry
  clean PASS/caught1/1 atc5444b0a35.
- writer-history-skips-finished-chain-normalization: omit the now-unreachable
  rejection check along with bypassing canonicalization, so the mutant compiles
  and reaches the real Undo/Redo oracle. Retry clean PASS/caught1/1 atc5444b0a35.
- static-opening-missing-contact-looks-active-1171: force active for a configured
  contact absent from the projected states. The door leaf always uses base paint;
  its arc is the active indicator. The native oracle compares that arc with its
  known closed tone, proves the active tone differs and retains full-plan parity.
  This covers absent entities; it does not invent new unavailable-state policy.
  Final retry clean PASS/caught1/1 at66516f17ec, recorded in witness-static-retry3.log.

These are addressed receipts at pinned revisions, not a complete nightly shard.
Successful first-batch definitions are unchanged by the five followups. The final
normal S6 uses the complete current diff and automatic catalog selection. New
native observer coverage is product/presentation with its actual card owner
linked in declared source dependencies; selection tests assert that reason.

#1332 is part of the same reviewed completion packet: document five existing DOM
hooks and retire the removed opening-tunnel hook. Its validator is unchanged;
three registered addressed witnesses passed clean and caught1/1 each. Full product
S6 is retained for the joint packet because browser/DOM-contract inputs are
product material. Companion E2E impact: houseplan-e2e main1f102b7, task-impact1331/1332.

## First complete S6 and HA isolation

Run20261106T104727609-4cd497ef completed all562steps:140passed,
418reused,4failed. All original Node baseline failures are resolved. The four
failures are HA backup archive, upload, websocket and Zigbee files, with10failed
cases. Their tracebacks show concurrent tests using the plugin's shared
site-packages/testing_config/houseplan directory while the prior autouse fixture
recursively deletes plans/files/assets before each case. Upload rename reports
ENOENT, an archive collision file vanishes and setup mkdir races deletion.

Replace that cleanup with the supported hass_config_dir fixture override: every
case gets its own tmp_path/ha-config before hass is created. No shared directory
is deleted. The config-flow module retains its more specific disk fixture.
Product file handling and all existing assertions remain unchanged. The five
addressed files (including the earlier intermittent marker-history case) pass
290/290 in19.52s. The normal second finish supplies the concurrent S6 proof;
the failed first receipt is retained rather than renamed green.
