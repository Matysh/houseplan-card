# #901 — ordinary continuation ownership evidence

The ordinary Node harness uses compiled exports and real `ConfigAdoption` /
`adoptAuthoritativeGated`, with controlled transport/backdrop promises. The
subscription test delivers the public `houseplan_trail_updated` callback. The
Undo wiring tests invoke the exported runtime's public Undo method against the
same fake host; no private production-card state, source mutation, forced ACK,
fake adoption success or mutation-execution ledger is used.

Baseline diagnostic: immutable worktree at `f819e489`, compiled with
`npx tsc --noEmit false --outDir test-build` and `node scripts/fix-test-build.mjs`.
With this checkout's test file, execute:

```sh
HP_CONTEXT_BASELINE_BUILD=/home/matysh/hp-901-baseline-20261015/test-build \
  node --test --test-name-pattern=wiring test/late-context-replies.test.mjs
```

Observed exit 1, 0/5 pass. Old public trail callbacks replace fresh trail/format
after connection replacement, A→B→A and detach. Old Undo after a same-connection
user replacement adopts config/layout at its write-reply and backdrop-await
boundaries, clears history and emits the old success. This confirms the previous
user-only structural hypothesis in the ordinary harness; it is not field evidence
of live-HA data loss or an ACL bypass.

The same five cases without `HP_CONTEXT_BASELINE_BUILD` pass on the fix. The full
`node --test test/late-context-replies.test.mjs` additionally covers Optimize and
import, each write/config-read/layout-read/adoption await, connection/user/A→B→A/
detach, old resolve/reject and terminal cleanup. A fresh new Undo stays busy until
its own success. Same-owner success uses the re-read revisions, not write-reply
revisions; a current rejection keeps the existing failure behavior. Trail tests
also cover unchanged-owner success, request replacement and current rejection.

| AC | Executed witness | Negative case that fails the oracle |
|---|---|---|
| AC1 | `#901 AC1` and `#901 wiring: public HA trail event` tests | Old-context resolve would replace the exact fresh trails/format/update count; a superseded request would overwrite latest material. Baseline: 3/3 wiring failures. |
| AC2 | `#901 AC2` matrix and public Undo wiring tests | Old success/error/finally would alter exact config/layout/revisions, history events, cache/model/frame, busy/capability or toast while fresh Undo is pending. Baseline: 2/2 user-only wiring failures. |
| AC3 | Same-owner AC2/3 tests; existing Optimize/Undo smoke; code review | Sent CAS revisions are asserted; accepted pair must use re-read revisions and all reads must retain original transport. Server ACL, CAS and Apply are outside the delta. |

Risk selection: async and HA/user/lifecycle are directly exercised; data/rights
retain existing server refusal and original transport. Geometry/visual/input
algorithms are unchanged. No new large-data traversal, cache, timer or polling is
added. Browser/GPU acceptance is not claimed by this unit/integration evidence.

Owner's explicit batch instruction of 2026-10-15 for the independent automatic
reviewer: do not create new issues for findings; fix in-scope findings here and
send out-of-scope symptom/material/evidence/risk/links to the root executor's
`batch-findings-2026-10-15.json`. #902 and #866 are outside this task.
