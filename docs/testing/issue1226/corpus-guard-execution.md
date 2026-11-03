# Reachable #845 corpus invariants before the known passport RED

Root review found a real author error: complete passport comparison preceded the read-only/idempotence/stored-identity loop. Known inventory differences therefore prevented those invariants from executing. This change moves only execution and accounting; no expected passport/input is accepted or replaced.

Every selected full source is now attempted before final passport comparison. The small failure collector continues to later inputs and later checks after a typed decline or failed invariant. A typed refusal is recorded as `ok:false,reason`; it is never counted as a successful migration. Both successful and refused inputs reach source immutability. Every successful migration reaches full serialized idempotence and a separate immutability check of that current result after re-reading it.

Stored atom ID multisets are checked without sorting actual output. Each room's complete ordered wall-ID cycle is matched by its stable room ID, rather than comparing room tables positionally. Canonical room-table reordering therefore cannot erase an oriented cycle guarantee. Membership and semantic passport comparison runs last.

## Actual addressed execution

Source product0c030e700/shared compiled0bda; no rebuild, product suite or HA run. Root supplied its one additional already-tracked `optimize-storage-roundtrip-current.json`, SHA256 `21bcd91a45e8b0fb3e5a13c798c4a27bde8a3ae139543a69271f2778c4360c0b`. It was used solely to match root's current573/91 input set and is not included in this patch.

| Reached invariant | Count |
| --- | ---: |
| Full selected inputs |573|
| Original input immutability, including declines |573|
| Successful migrations |571|
| Typed declines |2|
| Unexpected migration exceptions |0|
| Complete byte idempotence |571|
| Read-only current-result rereads |571|
| Applicable stored atom ID sets |230|
| Complete ordered room cycles, matched by room ID |473|
| Failed executable invariant checks |0|

The original corpus test still fails its final known inventory/semantic passport comparison. Final JUnit correctly contains **one original testcase and one failure**, with the counters above in diagnostics: `output/issue1226/corpus-reachable-guards-final.xml`. Exit status1 is intentional RED; it is not a passing aggregate.

An initial implementation used nested node:test subtests. It reached the same573 inputs, but Node's JUnit omitted the failing parent element and emitted573 child passes plus a fail1 comment. That accounting was rejected. Final code uses a small in-case collector, retaining the single original testcase and its structural failure. The initial `corpus-reachable-guards.xml` is diagnostic history only and must not be reused as all-PASS evidence.

The atom check retains multiset counts (including duplicates) using ID-frequency maps. A subsequent read-only source-data scan confirms all230 applicable stored source catalogues have unique IDs, so this strengthens the set comparison without changing any result in the executed corpus. It made no product migration calls. Coverage assertions additionally require573 immutable inputs and571 immutable successful rereads, matching the captured counters; no additional full corpus run was made for these bookkeeping assertions.

## Declines remain explicit, separately explained

- `test/fixtures/842-geometry-cleanup.json/before`: `ok:false, reason:invalid-room`. The independent backend review explains this refusal as justified by its source validity; the old positive passport is not silently restored.
- `test/fixtures/478-room-draft-migration-vectors.json/accepted/input`: `ok:false, reason:invalid-room`. The independent backend investigation retains this as a finding/unresolved old-positive transition. It is not accepted as successful migration.

Both false outcomes occur explicitly in the final passport diff, and both sources passed immutability. Original229 archived sources, all current full inputs, expected-only table ordering, source inventory, all opaque input bytes and the existing negative catalogue/order/ID/room/opening guards remain selected. No baseline acceptance, pruning, skip or actual sorting was introduced.
## Root integration: preserve the complete room collection

Root review found that matching old cycles by room ID must also reject extra
or duplicate current rooms. The integrated guard therefore checks the complete
room-ID frequency map before comparing each ordered cycle. This ignores only
the accepted canonical table order; cardinality, multiplicity and every cycle
remain strict. The counter for these complete room-ID checks must equal the
stored-atom space counter.

One addressed rerun after this meaningful extra assertion uses the existing
shared compiled0c product, not a rebuild or another full product/HA suite:
`node --test --test-reporter=junit --test-name-pattern=complete.persisted.fixture/demo.corpus test/wall-identity-corpus.test.mjs`.
Exit1 is expected and retained for the unaccepted passport. The actual XML is
`output/issue1226/corpus-guard-root-roomids.xml`: exactly one testcase and one
failure, whose reason is the explicit current inventory/semantic passport gap.

Reached:573 inputs/read-only source checks;571 successful migrations and two
typed declines;571 byte-idempotence and successful-re-read immutability checks;
230 complete stored-atom multisets;230 complete room-ID multisets;473 ordered
room cycles;zero invariant failures or unexpected exceptions. The final passport
comparison still fails. These counts are executed invariant checks, not a claim
that declined migrations succeeded or all573 semantic outputs are approved.
