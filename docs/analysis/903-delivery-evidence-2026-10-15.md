# #903 delivery evidence — 2026-10-15

Initial phase implementation: `5dbd8c65` (branch `issue/903-spec-delivery-ledger`).
The green full local gate preceded a clean rebase over the documentation-only
SPEC #911 commit `eda7fabd`; a byte comparison confirmed no implementation,
test, workflow or canonical-doc change from that rebase. CI still has to check
the exact published candidate before independent review/integration.
The pre-code decision was recorded locally in `artifacts/903/design.md`: a
versioned commit phase, retaining the schema-1 authored release classification.
No product source, stored plan, accepted image or release budget changed.

| AC | Executed evidence | Negative oracle |
|---|---|---|
| AC1 | `task-delivery-903.test.mjs` constructs real Git histories for current and legacy SPEC publishers; catalogue retains `specDeliveries` while prerelease and stable-line memberships stay empty. The existing candidate fixture in `candidate-858.test.mjs` builds read-only inputs and a ready envelope without fetching/classifying its unrelated SPEC issue. Published mixed manifests can retain ancillary SPEC trace only beside their own implementation SHA; new manifests list implementation alone. | A forged membership containing only that SPEC SHA is rejected by the actual Git verifier; repeated promotion trailers cannot confer membership or merge accounting. Foreign ancillary SHA is also rejected. |
| AC2 | A later B implementation in the same history becomes an ordinary infra entry only after a new authored classification; later repairs can reuse that implementation decision. | Missing or unchanged early placeholder fails both catalogue and merge checks. Formatting/unknown fields cannot renew the old decision. |
| AC3 | Real-history negative matrix covers unknown/duplicate phase, A/B disguised as SPEC, an unrelated C path, malformed anchors and a foreign publisher; exact earlier candidate and stale-base cases remain covered. | Each named negative throws; the earlier immutable SPEC candidate still reads after HEAD moves, while an ordinary unclassified C delivery fails. |
| AC4 | The publisher calls the same phase-message module consumed by catalogue, membership and stable-line review. Existing merge/continuation/line-review fixtures and process-digest tests run with the changed contract. | `reviewPublicationMessage` refuses an unknown stage; code-stage output carries no SPEC phase. Independent code review remains required. |

Executed on WSL Ubuntu, pinned Node v22.23.3 with independent dependencies and
build outputs in this worktree:

- `node --test test/release-ledger.test.mjs test/release-membership.test.mjs test/task-delivery-903.test.mjs test/candidate-858.test.mjs test/process-digests.test.mjs test/merge-candidate.test.mjs test/merge-continuation-882.test.mjs test/release-review.test.mjs` — **96/96 passed, exit 0**, including the final mixed-manifest compatibility follow-up.
- `npm run gate:small` — **exit 0**, 161 s on the initial phase patch; all mandatory components green. Its first exact-head push also passed the installed full gate in 220 s. The compatibility follow-up requires its own full pre-push gate; the issue handoff records that final candidate and outcome rather than applying these older results to new code.
- `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report` — **exit 0**; expected infrastructure-range warning, no class A.
- `node scripts/smoke-select.mjs --base origin/dev --head HEAD` — **exit 0**; no executable frontend diff and no browser smoke selected.
- `node scripts/release-ledger.mjs catalogue --candidate=HEAD` — **exit 0** on the actual committed history. Before implementation, the new reader also read `f819e489d9394a09588a5db4a93f393a07fd911d`: 61 implemented entries and 58 separate SPEC deliveries, including #900–#910, without premature implementation records.

Raw local logs and explicit exit metadata are in `artifacts/903/`. The first
full gate returned exit 1 with four affected consumer/fixture failures; stdout
normalization and shared phase consumers were corrected before the green final
gate. This is not a claim that a failed run was green.

Risk review: immutable SHA and old-record boundaries cover asynchronous/material
changes and data authority. Geometry, visual pixels and host input are unchanged;
browser/performance/full HA and GPU checks are not applicable. No mutant was
executed. Synthetic green proof in the candidate fixture is fixture data, not
owner acceptance or a real CI/release result.

Per the owner's explicit 2026-10-15 batch instruction, new findings must not
create issues: out-of-scope findings go to the root's single
`batch-findings-2026-10-15.json` with symptom/material/evidence/risk/disposition.
No out-of-scope finding was identified in this task. Issue labels and the
independent workflow verdict, not this report, establish S8.
