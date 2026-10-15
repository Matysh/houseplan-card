# #912 — r2 Medium correction: explicit storage recovery

Full CODE-REVIEW-912-r2 (reviewed f05e3ede/tree bf496130, comment6197495684)
was read personally. Actual status returned to S6 before any author source push.
Canonical reviewer commit5825861a was adopted by fast-forward, on unchanged
dev67c8e945. Historical reviews/handoffs and their receipts remain unchanged.

Correction be85b208 removes the historical read-error veto from `_save`.
Refresh and a saved OFF attempt actual Store I/O; a current failed write still
refuses the action before MQTT/config ACK. Successful I/O clears the startup
diagnostic. An invalid cache is still not interpreted, scanned or overwritten
at setup. Explicit recovery can replace rejected data; guides and compatibility
document this distinction. Frontend, all budgets and guards are unchanged from
the reviewed f05e3ede. Test-only follow-up360b36bc narrows the witness to actual
actions: saving an already-identical OFF config is a public no-op, not a writer
attempt, and must not be used to assert a failed durable-clear call.

Commands ran with the pinned HA harness in
`/home/matysh/hp-batch2-root-912-20261015`. Full raw output and true command,
cwd, exit and UTC intervals are in `artifacts/912/r2-*` (derived local files).

| Executed command / receipt | Actual result |
| --- | --- |
| `python -m pytest tests_backend/test_ha_zigbee_topology.py -q -k invalid_store`, `r2-recovery-before` | 10 FAIL on unchanged5825861a product: Refresh/OFF returned historical `storage_read` instead of attempting I/O. Ordinary input, not a product mutation. |
| Same ordinary witness after the correction, `r2-recovery-after` | 10 PASS; real HA reload, five invalid payload forms × two explicit actions, failed write preserves disk/config/no MQTT, then successful retry clears diagnostic, saves replacement/empty cache and survives reload. |
| First wider backend attempt, `r2-backend-full` | Genuine RED: 1499 PASS, five failing extra already-OFF/no-op expectations, one skip. This is not a passing product run. Removed the inapplicable no-op expectation in360b36bc, not an existing safety guard. |
| `python -m pytest tests_backend -q`, `r2-backend-final` | 1499 PASS /1 standard skip, trueexit0, 17:00:39.059–17:01:20.034Z (40.98s runner,39.03s pytest). Entire current backend suite rerun, not reuse. |
| `node scripts/gate-small.mjs --smokes --jobs=1 --base=67c8e9456f58e1a533b6ac570cc8716d1b9dc8a6`, `r2-gate` | trueexit0,154.37s; build19s, whole frontend units115s, guards/integrity/budgets/lint PASS; support_feedback, zigbee_topology_hover and zigbee_topology_job all PASS. No bundle cleanup until all children and the backend run had ended. The intervening360b36bc changes only the Python witness, not frontend inputs; a fresh normal push hook will also check final HEAD. |
| `node scripts/process-gate.mjs --base origin/dev --issues`, `r2-process` | trueexit0,8 commits,0 warnings before this evidence-only commit. |
| `node scripts/unused-locals-gate.mjs --json`, `r2-monolith`; `node scripts/bundle-budget.mjs`, `r2-gzip` | Both trueexit0 after the coherent gate build. No threshold change. |

The initial malformed commit-message invocation was rejected by the normal
provenance hook before committing; corrected terminal trailers were used without
bypassing it. No source substitution, mutant execution, guard/budget relaxation,
baseline change, live HA write, owner/GPU acceptance, merge or release is claimed.
The earlier backend1494 result is historical; the fresh final count is1499.
Prior native topic-filter proof is unchanged-input reuse, not a newly run smoke.

The owner separately approved total2940437 for the final combined batch
(comment6197386516). This correction does not apply it: #912 still uses exactly
2936529/265955 with the original2000 bands and all other limits unchanged.
New unrelated findings remain file-only; #866 is excluded pending design.
