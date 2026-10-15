# #909 — ordinary implementation evidence

Issue: #909. Accepted SPEC r1: body digest
`71c026a4f669d29af1bfe90922e19057a68a01b7c8e78d1ca3c26f342fb37d78`.
Implementation `eee7383794f5cf7b910a7be3ea9bb7b3093615cd`, base
`709c4573511af3004b4f73c41a4e975d7d1b3365`.

## Scope and negative boundaries

Only the unused summary attachment/slot API is removed. The exported
`SummaryRuntimeLoader`, its singleton, factory and pending-import cache,
retry URL and fingerprint validation remain. `ViewRuntimeBoundary` and
`view-runtimes.ts` have no implementation diff. All five loader tests remain:
four legacy attachment tests now exercise the live code/cache or actual
boundary, and the existing ensure/reset case is retained.

The existing first-render witness declaration pointed to the removed API.
It now points to synchronous `code.create()` in the unchanged live boundary
and its existing unit group. This is a static declaration, not an executed
mutant, caught result or new runtime behavior.

In historical SPEC-REVIEW-883-r1 only the broken relative link is repaired.
The verdict and material anchors are unchanged. No archive apply/move or
index rewrite was performed.

## Executed checks

Every named raw pair below is under `artifacts/909/` in the implementation
worktree. The `.json` receipt records command, cwd, UTC timestamps and real
exit code; `.log` retains stdout/stderr.

| Check | Actual result | Raw basename |
| --- | --- | --- |
| Baseline compile / five original loader plus six boundary tests | PASS, exit 0 | baseline-compile / baseline-loader |
| Compile changed source | PASS, exit 0 | compile |
| Loader, boundary and mutation-browser-offload units | 22/22 PASS, exit 0 | targeted |
| Static mutation registry | 1,600 definitions; five existing warnings; exit 0; executions 0 | static |
| Existing relative-link checker | zero broken links, exit 0 | links |
| Archive dry-run through v1.80.1 | move 0, keep 147; exit 0; no apply | archive-dry |
| Full gate-small --smokes --jobs=1 against base above | PASS, zero failures, 219 seconds, exit 0 | gate |
| Existing summary warm attachment native | 17 named checks PASS, exit 0 | summary-warm |
| Existing View runtime recovery native | 53 named checks PASS, exit 0 | view-recovery |

The full gate includes build/typecheck, the complete frontend unit suite,
new-any/render-layout/private-write guards, artifact integrity, bundle and
monolith budgets, unused-code checks and all nine selected native consumers:
danger_confirm_branches, dialog_help_clipping, dialog_modal_recovery,
floor_cache_reuse, ha_form_shell_parity, preloader_lifecycle, space_card_bg,
summary_dialog_scroll and warm_owners. The two additional unmodified native
consumers explicitly cover cold first render, warm replacement, distinct
instances, disconnect/reconnect, import failure and recovery.

The ordinary pre-change link checker was RED with exactly the target
SPEC-883 link (exit 1); that receipt is in the root's preceding read-only
worktree at `artifacts/909-readonly/baseline-links.*`. No runtime source,
compiled artifact or guard was temporarily changed and executed to obtain
a negative witness. The existing tests use ordinary cold/pending/rejected
inputs; no assertion was weakened. Night mutation execution: 0.

## Risk and release boundaries

Lifecycle/ownership: live boundary code is unchanged; tests cover retired
attempts and distinct host instances. Resources: one page code cache and
deduplicated imports remain. Compatibility: no public data/API or migration
changes. UX/accessibility: no markup, controls, settings or keyboard behavior
changes; existing native consumers pass. Truthfulness/failure: rejected
imports remain retryable and fingerprint checks remain. Maintenance/rollback:
the dead API has no product consumers; this bounded change can be reverted
without a data rollback, and historical review material remains auditable.

Classification is `infra` relative to v1.80.1, `User-Visible: no`; no user
release notes, milestone or new feature/performance claim. No owner field,
real-GPU acceptance, full performance benchmark, independent code-review
verdict, merge, S8 or release is claimed by this author evidence.
