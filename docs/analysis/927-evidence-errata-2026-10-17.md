# Bounded review errata — 2026-10-17 (#927)

Additive clarification of four later reports, checked by reading on October
16–17 (Moscow). This supplements, not replaces, [#910's earlier eight-item
errata](910-evidence-errata-2026-10-15.md). Original reports, verdicts, machine
anchors and raw remain unchanged. No historical test/benchmark/native/mutant
is replayed and no accepted S8 outcome is reopened.

## #910 — seventeen phrases, and the changelog condition

The [AC2 row and later changelog sentence](https://github.com/Matysh/houseplan-card/blob/26c450e575e36c71c9513e98d849c50c3b67ba6f/docs/reviews/CODE-REVIEW-910-r1.md)
need two bounded corrections:

- The literal phrase array in [the historical `#910 AC2` test](https://github.com/Matysh/houseplan-card/blob/26c450e575e36c71c9513e98d849c50c3b67ba6f/test/process-digests.test.mjs)
  contains **17**, not 19 elements. Counted from its static syntax tree,
  without executing or changing that historical test.
- `User-Visible: yes` requires both technical changelogs in the same commit;
  `User-Visible: no` does not. The report's earlier scope paragraph already
  correctly says neither changelog changed. Its later phrase connecting `no`
  to changes in both changelogs is incorrect, not evidence of missing edits.

Neither correction changes the test's purpose or the accepted verdict.

## #909 — loading the registry is not running its validator

The [review table](https://github.com/Matysh/houseplan-card/blob/facf77a16f78676af5e44442fc8eeb6fe4765d1c/docs/reviews/CODE-REVIEW-909-r1.md)
lists `node scripts/mutation-registry.mjs --check` as a static registry check.
That [module](https://github.com/Matysh/houseplan-card/blob/facf77a16f78676af5e44442fc8eeb6fe4765d1c/scripts/mutation-registry.mjs)
exports declarations and has no CLI handler for `--check`. A successful module
load does not establish the readiness validator's result. The real command is
`node scripts/mutation-gate.mjs --check`.

The author's separate correct invocation exists: original
`artifacts/909/static.json` in `/home/matysh/hp-batch2-root-909-20261015` records
that exact command, 2026-10-15 15:38:47–15:38:48 UTC, exit 0; its unchanged log
reports 1,600 definitions and execution 0. The [public author evidence](https://github.com/Matysh/houseplan-card/blob/facf77a16f78676af5e44442fc8eeb6fe4765d1c/docs/reviews/evidence-909/ordinary.md)
and [handoff](https://github.com/Matysh/houseplan-card/issues/909#issuecomment-6198355189)
separately describe that static run. It is not the command claimed by the
reviewer, a new #927 execution, or caught-mutant evidence.

## #907 — separate the two unit files from the native cohort

The [report's table and AC3 explanation](https://github.com/Matysh/houseplan-card/blob/322674301ccbd10f80975c8b14c9eb4a617a7d03/docs/reviews/CODE-REVIEW-907-r1.md)
must distinguish **43 aggregate units** from the one space-reference file.
At [review material af6affeb](https://github.com/Matysh/houseplan-card/tree/af6affeb1a4389be1aea1c6e9fe11c895501a76a/test),
`config-write-context.test.mjs` declares 5 tests and
`space-reference-repair.test.mjs` expands to 38 (24-case matrix plus 14 other
tests): 5 + 38 = 43. This is a static declaration/loop count, not a new execution.

The author's **19 direct native scripts + 2 explicit AC scripts** were a
separate browser cohort, correctly distinguished in the [final handoff](https://github.com/Matysh/houseplan-card/issues/907#issuecomment-6198608639).
They were not part of `npm test` or that ordinary `gate:small` invocation.
The reviewer's fresh AC1/AC2 smokes described in its own table remain separate
evidence too. The browser job in [light Validate 38792427157](https://github.com/Matysh/houseplan-card/actions/runs/38792427157)
is **skipped**, despite the overall success; it is not browser execution proof.

## #911 — the wall path does match the geometry selector

The [invariants explanation](https://github.com/Matysh/houseplan-card/blob/d5ec5043688024e793e87fbc684171476733c370/docs/reviews/CODE-REVIEW-911-r1.md)
incorrectly says `wall-thickness-selection.ts` does not match `wall[-_]`.
Its `wall-` prefix matches that expression; [the selector](https://github.com/Matysh/houseplan-card/blob/d5ec5043688024e793e87fbc684171476733c370/scripts/candidate-readiness.mjs)
selects **editor + geometry**, not editor alone. The current pure selector
returns those same two profiles for the ordinary path input.

An explanation for not rerunning invariants may rely on the resolver being
read-only presentation over existing geometry, but not on that false regex
claim. This does not change review scope or order new historical gates.
[Default `release:native`](https://github.com/Matysh/houseplan-card/blob/d5ec5043688024e793e87fbc684171476733c370/scripts/candidate-native.mjs)
uses all three profiles; it is not limited to this task's selected subset.

## Verification boundary

All four current `legacy/reviews/v1.81.0/CODE-REVIEW-*-r1.md` blobs match their
immutable source blobs above byte-for-byte. The local read-only receipt
`artifacts/927/historical-facts.report.json` records those IDs, static counts
and the pure profile-selection probe. Primary comments and job metadata were
read, not rerun. This prose is a bounded editorial correction, not a new
semantic checker, fabricated execution or replacement review verdict.
