# Author evidence for #925

Historical CI reported ENOTEMPTY during a temporary repository after-hook, not
a failed patch-set assertion. The exact writer/race cause is unknown; automatic
Git maintenance is a hypothesis. No historical suite/mutant replay or artificial
background writer was used to claim reproduction of that race.

Both ship-review fixtures now disable `maintenance.auto` and `gc.auto` in local
repository config (standalone, sandbox worktree and bare origin). Two after-hooks
share native recursive cleanup options: ten retries, 50 ms retry delay, no catch
that swallows an exhausted failure. User/global config and real repositories
are untouched; original patch-id/cherry-pick/coverage/workflow assertions remain.

## Ordinary executions

- Before: the new child-fixture contract fails at actual `git config --local
  --get maintenance.auto`, which is absent in both original fixtures. Receipt
  `artifacts/925/before`, 20:57:51–20:57:52 UTC, exit 1. This proves missing
  isolation, not the historical ENOTEMPTY cause.
- After: `node --test test/ship-review.test.mjs` — 24 passed, zero failed/skipped,
  20:58:07–20:58:10 UTC, `artifacts/925/targeted`. Real standalone commit and
  sandbox commit/push execute; after awaited child tests, both temporary roots
  no longer exist. All inherited functional assertions execute in this suite.
- Permanent cleanup failure is not forced: propagation follows the unchanged
  native `rmSync` error contract, with no suppressing catch. Bounded retry is
  configuration of that native operation, not an indefinite retry loop or a
  rewrite of test results. Full local gate belongs in the issue handoff.

No product/configuration/permissions/budget changes, release/tag/main push,
independent verdict, mutant execution or owner/GPU acceptance are claimed.
