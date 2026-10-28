# Geometry history restoration — #1100

## Contract and source

SPEC r2 was accepted independently in comment6472008395, body SHA256
`b77babe0ad22cf5ccc0ce324bb6ffba7b98212df740a20ec2345f5580addac20`.
The owner selected one union when raw/canonical physical fingerprint and model
version match, at most two when they differ, retaining both safety roles.
The implementation starts from accepted dev `21fdd42d5d80c24f2e225aff904082e8a237a312`.
The original characterization came from unmodified `0543e579`; it was repeated
on accepted `31b17bec` before implementation: three expected RED and eleven
exact-outcome PASS. These old results are not implementation acceptance.

Current-model restore uses the accepted #1099 candidate proof and scoped
model/adoption helpers. Raw safety stays before canonicalization. The existing
decor-only API remains the first fast lane; a separate nonphysical fallback
retains current-model, complete-carrier, guarded, unknown-field and pending-write
boundaries. Negative F57 repair remains negative, with an empty outbound
fingerprint requiring the existing deferred writer to revalidate.

## Addressed evidence

Before editing, real Card getters/setters and producers showed B/C pool keys
disappearing after physical Undo; switching B rebuilt a union. Real transform
and valid straight-stair movement Undo visited canonical model/adoption three
times instead of zero. The harness substitutes UI/storage only; canonical
model, history stack, physical journal, geometry preparation and wall passes
remain production owners. A thickness-catalog-only no-op and initial invalid
stair setup were excluded from normative witnesses and retained externally.

`test/fixtures/1100-history-characterization.json` preserves twelve deduplicated
full documents for eleven ordinary scenarios / twenty-two Undo/Redo steps.
The assertions compare exact JSON, toast, save count, cursor and command
identity; expected results were not rewritten for the optimization. Existing
#845 passports (154 documents / 77 files at this base) remained byte-equal;
only this new twelve-document cohort was added with explicit membership.

| AC | Evidence | Negative / regression boundary |
|---|---|---|
| AC1 | Production-path unit retains real B/C pool keys and B costs zero unions; native smoke prepared | Original unchanged source RED; `history-restore-clears-foreign-pools-1100` registered, not executed |
| AC2 | Real transform/stair Undo and Redo have zero model getter visits, preflight and union calls; native readback prepared | Guarded/pending/legacy/unknown inputs remain strict; `nonphysical-history-takes-model-path-1100` registered, not executed |
| AC3 | Nine physical cases record raw/canonical fingerprint+version, actual ordered checks and union counts; pre-v9 inequality exercises two passes | Raw/canonical negative and exception inputs refuse; `history-raw-negative-ignored-1100` and `history-different-canonical-reuses-raw-verdict-1100` registered, not executed |
| AC4 | Existing refusal suite and real deferred writer reject negative F57 outbound candidate without sending; legacy root migrates atomically | F57 never gains a positive fingerprint; `history-negative-becomes-outbound-proof-1100` registered, not executed |
| AC5 | Existing decor-only witnesses retained; new unknown/guarded/carrier inputs leave config untouched | `nonphysical-history-ignores-unknown-snapshot-field-1100` registered, not executed |
| AC6 | Seven cold-card / seven warm apply/inverse benchmark prepared; measurement pending | Timing is diagnostic; exact documents and counters are normative |
| AC7 | Backend subset: 224 passed, 2381 deselected; gate:small pending | No expectation, backend, geometry algorithm or timing-limit changes |

Initial targeted validation: 102/102 PASS in the history/decor/refusal files;
adjacent commit, draft, Resize, alias, node-history, draft-exit and body-gesture
files: 133/133 PASS. Static mutation readiness: 2003 definitions, execution=0,
caught=unknown (nightly only). Three existing anchors and the structural
identity source witness follow the new helper call; their behavioral refusal
and identity contracts remain unchanged. No mutant was executed.

## Remaining task validation

This is an implementation checkpoint, not the S7 handoff. Native/performance
checks await accepted #1098 and a fresh rebase: #1100 does not change consumer
keys or use unaccepted source. The complete gate, exact selected Golden,
native smoke results, paired measurements and final source identity will be
recorded before S7. No visual delta or task baseline acceptance is requested.
