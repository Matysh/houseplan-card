# #905 — negative-evidence instruction consistency (2026-10-15)

## Material and scope

Implementation starts from dev `1b95f78154a39b6838202234d3c017e1f2c2fb16`.
The accepted issue body remains `8601865be430…` with GREEN SPEC r1; no product
question or track change is needed. The actual prompt, PROCESS §2.7, TESTING
rule4 and common REVIEWER entry now distinguish ordinary negative inputs from
patching the executable implementation/compiled copy/guard/budget and running it.
The latter remains nightly-only even if done manually and then restored.

The motivating #903 review/run38742213383 and #901 CODE-REVIEW-901-r1 in
commit61c15789 were read, not replayed. The latter explicitly reports temporary
compiled `test-build` substitutions for AC1/AC2. Historical documents/raw/green
product verdicts remain unchanged. The separate owner-trust F003 topic is not
part of #905. No sandbox, command filter, model/permission/budget change or
mutation-executor change is introduced.

The owner batch instruction of 2026-10-15 applies: **new out-of-scope findings
go only to the root-owned batch-findings-2026-10-15.json, not new issues**;
in-scope defects are repaired here. Mutation execution is not an authored check.

## Executed ordinary checks

`node --test test/process-digests.test.mjs test/process-track.test.mjs
test/workflow-hygiene.test.mjs test/workflow-pipefail.test.mjs`

Executed 14:29:52Z–14:29:55Z in the isolated #905 worktree:
**63 tests, 63 passed, 0 failed, 0 skipped, true exit0**. Raw received
stdout/stderr and exit metadata are retained locally as
`artifacts/905/targeted-r1.log` and `targeted-r1.exit.json`.
This is a working-tree check before final integration, not proof for a future SHA.

Expanded final working-tree matrix at 14:32:49Z–14:32:52Z added
`test/review-doc-guard.test.mjs test/testing-doc.test.mjs
test/entry-cost.test.mjs test/monolith-text-anchors.test.mjs` to the same command:
**142/142 passed, 0 skipped, true exit0**, retained in
`artifacts/905/targeted-final.log` and `targeted-final.exit.json`.
It also verifies publication isolation, the existing documentation whitelist,
entry routing and the unchanged frozen monolith-reader boundary. The prompt's
existing word-ceiling test passes without increasing its limit.

| AC | Ordinary witness | Negative evidence / boundary |
|---|---|---|
| AC1 | Common text contract over PROCESS, TESTING, REVIEWER and actual prompt | Retired pure-unit/restore permission is rejected even alongside required policy; ordinary inputs and compiled-artifact prohibition are explicit |
| AC2 | Actual Review scalar rendered for spec/code × ask/show/ship | Missing common policy or an unknown expression refuses; old recipes are searched in the source, not merely hidden by one rendered branch |
| AC3 | Invalid text/declaration inputs, unchanged static registry reader, synthetic outcome taxonomy | Registration/readiness/ordinary PASS are not proof outcomes; static output says execution=0/caught=unknown; a synthetic classified receipt is not real caught evidence |

No apply/prepare/execution port is invoked by the new tests. Build/test generated
outputs and the external REVIEW_DOC remain permitted; publication still clears
both index and tree with the existing commands. Existing tests retain the prompt
word ceiling and structured verdict/route guards.

## Integration obligations

Author classification is infra relative to v1.80.1, before S7; no user milestone,
stable-user narrative, GPU/field/owner proof is claimed. The mandatory full
pre-push `gate:small`, exact candidate SHA and true push outcome will be reported
in the S7 handoff after execution. Independent automatic review/wait-verdict and
the coordinator's two-S7 limit remain mandatory. Text consistency is not physical
enforcement of arbitrary Bash behavior.
