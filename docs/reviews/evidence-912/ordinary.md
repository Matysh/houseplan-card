# #912 — ordinary implementation evidence

Accepted contract: SPEC-REVIEW-912-r1, body digest
`cc7b0e742ffa10286fad8065696571b52f549fa3b091fee850f46af9e686bd62`.
Owner chose delete-on-accepted-Refresh (1б), not keep-on-error. Owner subsequently
approved exactly total `2936529` and lazy-editor gzip `265955`, with the two
existing `2000`-byte bands and all other limits unchanged
([approval](https://github.com/Matysh/houseplan-card/issues/912#issuecomment-6194871293)).

## Material and reproduction

Product commit `8e7972e64053907652aca054acc209358a614e06`, budget-only commit
`d1d6bd4a7568763461b96b0d6515a71cbd9340c5`, based on accepted dev
`cef40de27615e4db63536f41b20db361ad406bb0`. The rebase preserved #908's appended
development/registry blocks and #903/#904's canonical process surfaces. The
central config writer uses one async callback containing the one Store write;
the existing coordinate-write guard is unchanged.

Commands ran in `/home/matysh/hp-batch2-root-912-20261015`, with the repository's
pinned Node/Python/HA/Chromium environment. Raw logs and JSON metadata are under
`artifacts/912/` (local derived files, not bundled product). Each cited run has
its real exit status, command, cwd and start/end time from the evidence runner.
Empty utility-module invocations are **not** checks or evidence.

| Criterion | Actual ordinary observation |
| --- | --- |
| AC1 persistence | The test `issue_912_success_survives_real_entry_reload_without_radio_scan` ran before implementation, failed after real entry reload because the map was absent (`baseline-reload-valid`, exit1). After implementation it passes in the full HA suite. The restored map is stale, retains its original timestamp, and starts no radio request. No mutated product was used for this baseline. |
| AC2 Refresh/OFF | Real HA Store tests inspect exact durable map contents after accepted Refresh, failed/cancelled replacement, reload, delayed old callbacks and successful replacement. Clear finishes before MQTT/publish; failed clear refuses the action and saved-OFF ACK. Another client's saved OFF clears every topic and fences delayed writers. Draft setting changes do not perform that durable clear. |
| AC3 bounded recovery | HA tests cover eight successful-map slots without eviction, removed/re-added topic preservation, malformed/future/foreign cache payloads, original-time validation, existing payload/node/link/subscription limits and disabled operation. Setup restores only after interrupted config-pair recovery, not from a half-recovered setting. |
| AC4 trust/privacy | Existing actual-admin, user/connection/session and MQTT-response tests remain in the full backend suite. Only validated raw maps and original obtained-at times enter the dedicated entry-scoped private Store: no persistent job/session/transaction/timer, no plan/layout/export schema extension. ZHA remains memory-only. |
| AC5 frontend adoption | `unit-target-resumed`: 68/68 compiled tests PASS for runtime routes, provider routes, topology and config-write error mapping. Authoritative absent-result loading/error clears browser routes; restored feed is stale; old backends require update capability rather than a legacy bypass; ZHA's previous route contract stays. |
| AC6 mounted UI | `gate-resumed` executes existing support-feedback, topology-hover and extended topology-job consumers against production bundles. The job smoke's 24 checks include stale original-time restore without scan, actual keyboard Refresh, immediate old-route removal, failed replacement not restoring it, new success, another client's saved OFF, OFF→ON and permission loss. `native-topic-filter-resumed` separately passes configured-topic hide/re-add and existing ZHA/tooltip geometry cases (11.1s). Browser fixtures prove UI/feed adoption, not disk persistence; the HA tests above prove the latter. |
| AC7 copy/docs | EN/RU messages and DE/FR namespace/main parity are supplied. Architecture, compatibility, user guides, status/development and both technical changelogs replace memory-only/keep-on-error claims. Release ledger marks the new stable-user capability `major`, relative to v1.80.1; the canonical #903 reader accepts the entry with RU/EN summaries. |

## Executed gates

- `python -m pytest tests_backend -q`: **1494 passed, 1 skipped**, 38.46s test
  time / 39.6s runner time, exit0, `backend-resumed`.
- `node scripts/gate-small.mjs --smokes --jobs=1 --base=origin/dev`: exit0,
  193.3s, **0 failures**, `gate-resumed`. Build/typecheck, all frontend units,
  no-new-any, no private smoke writes, render-layout guard, selected-smoke
  discovery, bundle-policy, gzip budgets, unused/monolith metrics and all three
  selected native smokes pass. Units consumed 148s; no result is inferred merely
  from a successful build.
- `node --test test/coordinate-write-barrier-guard.test.mjs`: exit0,
  `central-writer-guard`; no inventory relaxation.
- Four scoped compiled suites: **68/68**, exit0, `unit-target-resumed`.
- `node scripts/unused-locals-gate.mjs --json`: exit0,
  `monolith-gate-resumed`: delegates145, portMembers352, hostRefs5352,
  portPrivates102, harnessPrivates101, total2931061 bytes. Gzip budgets exit0,
  `gzip-budgets-resumed`: initial321628, lazy editor264412 bytes gzip; every
  other limit passes. These standalone facts are not passed off as the larger
  combined diagnostic that justified the owner's exact ceilings.
- `node scripts/process-gate.mjs --base origin/dev --issues`: exit0,
  0 warnings, `process-resumed`.
- `node scripts/mutation-gate.mjs --check`: exit0,
  `mutation-cli-static-resumed`: **1596 definitions**, five existing warnings,
  **execution=0**, caught=unknown. The three new definitions are declarations
  for nightly execution, not locally executed witnesses.

The first full local gate was genuinely red: it detected two textual central
Store-write sites and the then-unapproved size. Its artifact phase is not usable
as evidence because the author mistakenly cleaned D before that run ended.
The writer is now a single callback, the ceilings have explicit owner approval,
and the entire gate was rerun cleanly above with no concurrent artifact cleanup.
The initial wrong plain-pytest invocation failed environment collection and is
not the baseline; only `baseline-reload-valid` supplies that actual product RED.

## Risks and boundaries

1. **Performance/bounds:** no periodic scan or resume; only validated bounded
   raw maps persist, good-map capacity refuses replacement by unrelated topics.
   Store size is bounded before loading; no deep frontend global cache added.
2. **Context/races:** one coordinator lock serializes durable clear, saved OFF
   and late result persistence; closed/session/job identity and enabled fences
   reject obsolete results. Shutdown drains accepted persistence before exit.
3. **Authority/privacy:** dedicated entry-scoped Store, actual-admin public API,
   no credentials/operational jobs in records and no layout/export migration.
4. **Storage failure/recovery:** unreadable/foreign/future records fail closed
   without an empty overwrite. HA's own corrupt-file backup behavior is
   documented. Failed clear cannot report success or start a new scan; failed
   result save can show live data only with an explicit unsaved warning.
5. **UX/accessibility/locales:** keyboard Update remains real native input;
   original timestamp/stale/pending/unsaved states are distinct. Saved OFF is
   different from closing a draft dialog. Config failure after a successful
   map clear may already leave that map empty, and documentation says so.
6. **Rollback/verification scope:** older clients ignore the new capability;
   older backend needs update rather than unsafe fallback. Real HA tests and
   pinned headless-native runs are implementation evidence, **not** owner field
   or real-GPU acceptance. No manual self-review, merge, S8 or release is claimed.

No new issue was opened. Out-of-scope findings belong only to the batch file
under the owner's current instruction; #866 remains excluded pending design.
