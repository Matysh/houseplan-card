# #1065: review context for the canonical call digest repair

This index accompanies [the complete authenticated issue snapshot](1065-review-context.json).
It is reading context for an independent CODE review, not a verdict, execution
permission, alternate issue body or review-policy authority. Historical comments
remain historical, including their old handoffs, refusals and accepted verdicts.

## Snapshot provenance

- Repository: `Matysh/houseplan-card`; issue [#1065](https://github.com/Matysh/houseplan-card/issues/1065).
- Authenticated REST actor: `Matysh`. Issue and all comment pages were fetched
  twice on 2026-10-25; the second observation ended at `18:31:54.736Z`.
- Fourteen comments, one page, no omissions or duplicate IDs; both captures are
  identical, and the issue was stable before and after each pagination. Each
  comment includes its ID, URL, author, creation/edit timestamps and complete body.
- Original issue body is byte-exact to the pre-repair author capture: SHA256
  `54a9f9ef09580f97513b492ce36dc287bf22112539eaad766098d4246866245d`.
  Its original scope and three required results have not been edited.
- Snapshot JSON: 53,191 UTF-8 bytes; SHA256
  `5628d9421a14ae50b2fc2651b715c8b79b0b89a9ea3ad89fa660ee8c4b97c1a1`.
  No credential-shaped content was found. Retrieval endpoints, per-body hashes,
  page lengths and both content hashes are recorded in the JSON.
- The snapshot precedes the final author handoff to avoid a source/handoff
  circularity. The final handoff and later pipeline events come from the ordinary
  review context; they are not falsely claimed to be inside this snapshot.

## Current material and evidence boundary

The implementation was frozen at `c0c7f519d4360866240cb5f588538d1ad6f0c7de`;
this context adds documentation only. Accepted base and review tools remain
`98baf6d77e28fdc0fbe53d75a715cd4b9d9ba82f`. New candidate hook/policy code
must not replace that accepted review authority before acceptance.

The reopening comment `6401171862` records the authentic #1067 witness. Four
allowed calls had digest mismatches and different visible object-key orders;
the lossy certificate does not prove equality of their hidden strings or that
order alone caused every mismatch. Four independently denied requests remain
refused. Comment `6401436006` adds the separate #1078 Grep/order witness and six
independent denials. Old partial structured GREEN responses are inadmissible.

The repair canonicalizes **only object-key order** at every JSON level. Keys,
values, types, exact strings and array order remain significant; `-0` differs
from `0`. Unsupported/non-JSON input is rejected without invoking accessors.
Current startup/hook/audit require the exact algorithm marker. The collector
keeps raw shape/order diagnostics separate from call equality; legacy data is
not re-evaluated using the new ToolSearch permission and has no CODE authority.
Builtin ToolSearch permits read-only catalog discovery only: each discovered
actual tool still requires its own decision. Shell permissions, denied-request
rules, SDK/model pins, limits, report/material binding and publication audit
remain strict. The unchanged metadata projector retains its original raw order.

## Independent review under the accepted runtime

Read every changed or risky hunk and the positive/negative fixtures. The issue
body and all captured comments can be read locally without discovering MCP tools.
This removes a reading dependency; it does **not** guarantee an admissible run:
the accepted workflow still has its own canonical publication instructions.
Do not infer the cause of any old missing-journal event or force a GREEN verdict.

For source comparison, these are separate literal read commands, never a shell
composition:

```text
git diff --no-ext-diff --no-textconv 98baf6d77e28fdc0fbe53d75a715cd4b9d9ba82f HEAD
git log --oneline 98baf6d77e28fdc0fbe53d75a715cd4b9d9ba82f..HEAD
git rev-parse HEAD
```

Existing producer evidence and compatible CI may be reused by the canonical
checks. If an independent focused test is necessary, the literal unit commands
are separate invocations:

```text
node --test test/review-call-digest.test.mjs
node --test test/review-execution-policy.test.mjs
node --test test/review-failure-diagnostics.test.mjs
```

Short checks need no optional explicit tool timeout; the ordinary runtime
deadline remains unchanged. Prefer Read/Grep/Glob for inspection. Do not request
ToolSearch under the old policy merely to read already captured discussion.
Write the complete final report to the assigned external REVIEW_DOC/FINDINGS
paths; corrections use a complete Write, not Edit. None of this expands the
accepted admission rules or overrides canonical workflow instructions.

The historical blocking spend is **1/2**, preserved. The owner exception for
#1082 does not authorize manual acceptance here. A new authentic audit refusal
requires its certificate and a stop, not an automatic retry or partial verdict.
