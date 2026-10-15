# #904 — handoff freshness evidence (2026-10-15)

## Scope and contract

The shared syntactic parser accepts a first meaningful `Сделано:` field or
standalone `## Сделано` heading, with the same colon/heading grammar for all six
required fields. Quotes, fenced/indented code and ordinary leading reviewer prose
do not introduce a handoff. Selection is not comment-author authorization.

Collection examines every API page, orders recognizable candidates by updated
timestamp and then numeric id, and keeps an incomplete newest candidate as the
refusal target. Missing/conflicting provenance fails closed. Preflight v2 binds
the selected comment id, URL, created/updated timestamps and raw-text SHA256 to
the existing material identity. A canonical snapshot crosses the sealed prepare
packet and is compared with a fresh selection before model use.

No runtime files, user-visible behavior, track downgrade, semantic approval,
review budget, verdict schema or merge authority are changed. The release ledger
is `infra` relative to v1.80.1. The owner batch instruction of 2026-10-15 applies:
new out-of-scope findings go only to the root-owned batch findings file, not new
issues; no mutation tests are executed. The authored checks below are ordinary
positive/negative fixture tests, not production mutations or owner/GPU proof.

## Executed checks

`node --test test/review-preflight.test.mjs test/review-result-gate.test.mjs
test/pipeline-outcomes-897.test.mjs test/workflow-hygiene.test.mjs
test/workflow-pipefail.test.mjs test/process-digests.test.mjs`

Executed in this task's isolated WSL worktree from 13:38:01Z to 13:38:04Z:
**49 tests, 49 passed, 0 failed, 0 skipped, exit 0**. Raw combined stdout/stderr
and child exit metadata are retained locally in
`artifacts/904/targeted-final.log` and
`artifacts/904/targeted-final.exit.json`; the display tail is not the evidence
source. This was the pre-rebase working-tree check, not a future-HEAD claim.

The tests cover both handoff formats in either order, heading-only history,
incomplete newest comments, absent handoffs, quoted/fenced examples, ordinary
reviewer prose, unsorted multi-page responses, tie-breaking, edits to older
comments, duplicate/conflicting snapshots and all provenance fields. The existing
SHA/tree/body/track/active-request and `semanticApproval:false` guards remain
covered. No login-based identity rule is added.

The workflow fixture executes the actual prepare, sealed packet verification and
fresh pre-model shell steps with a local Git repository and fake GitHub API. An
unchanged snapshot passes; edited text/timestamps and substituted-but-rehashed
packet metadata refuse before a model call. No real issue comments, workflow
runs or status labels are modified by these tests.

## Remaining integration gate

The mandatory pre-push hook must run the complete `gate:small` on the eventual
candidate after rebasing onto current dev. Its actual command, candidate SHA,
raw log/exit metadata and outcome will be recorded in the S7 handoff. No full-gate
or independent-review result is claimed by this document before it executes.
