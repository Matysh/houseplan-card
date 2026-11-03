# #1226 review41705603244 — M1

Agreed. The positive `Optimize reconciles fully hidden subspans but leaves ambiguous partitions untouched` contract must not become an expected `thickness-conflict` refusal. This is the same exact-coordinate different-carrier collapse documented for the still-positive #478 corpus witness.

`CONFIG-COMPATIBILITY.md`, “Ordinary wall chains — model v10 (#478)”, preserves existing independent partitions and their cm. `PLAN-GRAPH.md`, “Wire and identity”, defines edge identity by kind/ID rather than coordinates and permits detached nodes with equal coordinates. Different thickness does not make the two individually valid source carriers malformed.

Changed only the original Node case:

- Preserve its first compatible fully-hidden-subspan journey and all three assertions.
- Require Optimize to return the current model, report zero ambiguous reconciliations, and retain both full original partition records (`redundant`, cm20; `second`, cm10), including geometry.
- Require both original IDs/cm in the authoritative graph and the complete original opening, partition host and exact `tq=[1,2]`.
- Run source immutability in `finally`, including the currently failing path. No exception is caught or accepted as success.

The product is not changed. The original case is visibly RED again; no global classification, threshold, skip, baseline, review queue or issue state was changed by this patch. Coordinator updates the original230 accounting from210/20 to209/21 separately.

## Single addressed run

Command (existing shared test-build, no build/full suite/HA):

```text
node --test --test-name-pattern="^Optimize reconciles fully hidden subspans but leaves ambiguous partitions untouched$" test/plan-optimizer.test.mjs
```

Actual: one test, zero PASS, one FAIL, zero skipped,163.7ms. `PlanGraphError: plan-graph:thickness-conflict` propagates from the ambiguous Optimize call at test line148. Reaching that call proves the unchanged compatible subspan assertions completed; the propagated PlanGraphError also shows the `finally` source-immutability assertion did not fail or replace the error. The positive model11-result assertions intentionally cannot run until the product stops refusing the valid source.

Primary local log: `/home/matysh/hp-batch2-infra905-20261015/output/issue1226-review-m1-addressed.log`. The test file before this edit was byte-identical to the root review candidate `e6fe4e046:test/plan-optimizer.test.mjs`. No repeat was run to seek green.