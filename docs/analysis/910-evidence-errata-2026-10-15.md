# Bounded evidence errata — 2026-10-15 (#910)

Additive clarification, checked by reading on 2026-10-15, not a new execution
of historical tests, benchmarks, native programs or mutants. It covers only
F-BATCH-006/008/013/015/028/032/034/040 from the owner's renamed
`batch-findings-2026-10-14_done.md`, whose SHA256 was verified as
`0609e9a507aa2fbfba1be7c8a19923da54cc336cc81d3c76926da42e87132efb`.
Historical status descriptions in that journal are not current status claims.
Original reports, verdicts, machine anchors, passports and raw stay unchanged;
no closed issue is reopened and no old green/S8 outcome is re-evaluated.

The report permalinks below use accepted `709c4573511af3004b4f73c41a4e975d7d1b3365`.
GitHub comments are primary author/publisher records, not claims that #910
re-executed their commands. The short [DEVELOPMENT checklist](../DEVELOPMENT.md#evidence-accuracy-and-historical-errata-910)
is linked from TESTING without raising its fixed line budget.

## F-BATCH-006 — uniform dirty series

The old [mixed-series test](https://github.com/Matysh/houseplan-card/blob/709c4573511af3004b4f73c41a4e975d7d1b3365/test/node-performance-report.test.mjs#L110)
changes only one receipt. A differing signature can therefore reject that input
without isolating the uniformly-dirty case. The existing
[signature guard](https://github.com/Matysh/houseplan-card/blob/709c4573511af3004b4f73c41a4e975d7d1b3365/demo/helpers/node-performance-report.mjs#L92)
already rejects dirty material. #910 adds a separate ordinary-input unit: all
three receipts are identical and dirty, with an otherwise identical clean
positive and deep-equal preservation checks for both inputs. The guard and
budgets are not changed; this is not a caught-mutant claim.

## F-BATCH-008 — #891 cancellation reached the model

The [report's blanket pre-model statement](https://github.com/Matysh/houseplan-card/blob/709c4573511af3004b4f73c41a4e975d7d1b3365/docs/reviews/CODE-REVIEW-891-r1.md#L21)
is too broad. [Run 38640250337](https://github.com/Matysh/houseplan-card/actions/runs/38640250337)
reached the model's Review step at 2026-10-14 21:28:05Z; that step was cancelled
at 21:42:13Z. The [author withdrawal](https://github.com/Matysh/houseplan-card/issues/891#issuecomment-6179109698)
and [publisher's incomplete-model notice](https://github.com/Matysh/houseplan-card/issues/891#issuecomment-6179138431)
identify the same run and the lack of a full valid verdict. This corrects
timing provenance, not the valid 0/4 blocking-cycle count or later green r1.
The wrapper run's head is not substituted for the reviewed product material.

## F-BATCH-013 — #846 has AC1–AC8, not a ninth requirement

The [accepted issue contract](https://github.com/Matysh/houseplan-card/issues/846)
contains AC1–AC8. The [report's AC9 row](https://github.com/Matysh/houseplan-card/blob/709c4573511af3004b4f73c41a4e975d7d1b3365/docs/reviews/CODE-REVIEW-846-r1.md#L69)
and [AC1–AC9 conclusion](https://github.com/Matysh/houseplan-card/blob/709c4573511af3004b4f73c41a4e975d7d1b3365/docs/reviews/CODE-REVIEW-846-r1.md#L116)
duplicate the existing AC8 lifecycle subject; they do not add an owner
requirement or establish a missing ninth test. No acceptance criterion or
historical verdict is changed by this errata.

## F-BATCH-015 — #896 reserve and final native list

The introductory [“несуществующего” mismatch](https://github.com/Matysh/houseplan-card/blob/709c4573511af3004b4f73c41a4e975d7d1b3365/docs/reviews/CODE-REVIEW-896-r1.md#L15)
was real: [commit e69eab4e](https://github.com/Matysh/houseplan-card/commit/e69eab4e1a1dc40989fe14c5014b69f5f33bb5e7)
removes the extra `> 500` reserve assertion and tests the inclusive allowed
band with the unchanged overflow guard. The report's AC5 explanation is already
correct. Its [“восемь” native reference](https://github.com/Matysh/houseplan-card/blob/709c4573511af3004b4f73c41a4e975d7d1b3365/docs/reviews/CODE-REVIEW-896-r1.md#L109)
is an earlier list, not the final author evidence. The
[final handoff](https://github.com/Matysh/houseplan-card/issues/896#issuecomment-6180769885)
names four own native scripts, four previously agreed foreign-HA consumers and
ten additional adapters: 4 own + 14 consumers. Those are author executions,
not fresh reviewer or #910 executions; no budget is raised here.

## F-BATCH-028 — #849 defensive units are not a new TypeError reproduction

The [report's AC2/AC5 explanation](https://github.com/Matysh/houseplan-card/blob/709c4573511af3004b4f73c41a4e975d7d1b3365/docs/reviews/CODE-REVIEW-849-r1.md#L195)
overstates the provenance of the old owner-reported TypeError. Accepted #846
already consumed a current confirmation before invoking its action (read
`4a4edb35800d159b417a8b12d4edac05609665d4:src/houseplan-card.ts`,
`_acceptTapConfirm`). The extracted [shared guard](https://github.com/Matysh/houseplan-card/blob/709c4573511af3004b4f73c41a4e975d7d1b3365/src/view-action-context.ts#L6)
and [four units](https://github.com/Matysh/houseplan-card/blob/709c4573511af3004b4f73c41a4e975d7d1b3365/test/view-action-context.test.mjs#L5)
prove consume-once, replacement/reentry and a deliberately thrown `Error('service refusal')`.
They do not establish a newly reproduced old product TypeError on #849's base.
The report's “not rerun npm test” prose also needs the explicit qualification
already present in the [public verdict](https://github.com/Matysh/houseplan-card/issues/849#issuecomment-6183968610):
the reviewer did run the full suite incidentally, 4715 pass / 0 fail / 1 skip.
No CI failure or new execution is inferred from the editorial ambiguity.

## F-BATCH-032 — the lost earlier #861 failure stays UNKNOWN

The [final author's diagnostic history](https://github.com/Matysh/houseplan-card/issues/861#issuecomment-6185905496)
explicitly preserves two early local full-suite failures: one identified #624
new-monolith-reader failure, and a second whose name/stack/cause were lost to
tool truncation. That second failure remains **UNKNOWN**. It is not the
separate 20-error `_resize` stub run, the candidate/static series, or the later
raw #278 source-location failure. A later full PASS proves its own material,
not the cause of this old lost failure. No reconstruction, flaky label,
historical rerun or raw rewrite is performed.

## F-BATCH-034 — #894 sum already corrected in the final handoff

The old local summary's 502 was an arithmetic error, not 100 missing checks.
The [final handoff](https://github.com/Matysh/houseplan-card/issues/894#issuecomment-6186570973)
already gives the exact list: 20+22+22+56+22+45+15+8+29+24+85+39+15 = **402**
own named checks in 13 whole scripts; 10+11+34 coupled checks give **457** in
16 scripts. This item was already corrected there; #910 does not invent extra
executions or rewrite the raw logs to reach the earlier sum.

## F-BATCH-040 — #895 measured identity and two different floors

The [report's “измеренным d28cdbee” wording](https://github.com/Matysh/houseplan-card/blob/709c4573511af3004b4f73c41a4e975d7d1b3365/docs/reviews/CODE-REVIEW-895-r1.md#L161)
must not be read as execution on a future SHA. The
[original measured-material README](../reviews/evidence-895/README.md) and
[unchanged integration supplement](../reviews/evidence-895/integration-equivalence.json)
identify actual paired B=`fcef2752bfea5ef8292dc14495ad1bc3a6fed2e9` and
R=`b6f183533dc2e51abee97bb1933f4021ccbca096` at 09:00:41–09:02:17Z.
The 413/414 input-path audit and fresh runtime establish content equivalence
to later c8a/d28/4455, not a new paired benchmark execution on those commits.
The [primary handoff](https://github.com/Matysh/houseplan-card/issues/895#issuecomment-6189657474)
already separates these identities correctly.

The [golden table's floor10 wording](https://github.com/Matysh/houseplan-card/blob/709c4573511af3004b4f73c41a4e975d7d1b3365/docs/reviews/CODE-REVIEW-895-r1.md#L98)
mixes independent measures: 205 threshold PASS with 78 nonzero differingPixels
scenes is not pixel-zero. There were 131 byte-changed frames and 74
byte-identical witnesses; floor10 is the minimum count of byte-identical
environment witnesses, not an allowed pixel-difference threshold. The same
primary handoff records this distinction; no PNG, threshold or D-accept is
changed by #910.

## Limits and handoff

Only the new #910 ordinary units and normal task gates are executed for this
change; their commands, exact candidate and raw/true-exit results belong in the
issue handoff, not in these historical records. The checklist's text/link test
is not semantic approval of this prose. Owner instruction of 2026-10-15:
**НОВЫЕ ISSUE НЕ ЗАВОДИТЬ**; new out-of-scope findings go to the coordinator's
`batch-findings-2026-10-15.json`, not to new issues. Historical mutable-program
or mutant replay, owner/real-GPU acceptance and release actions are not claimed.
