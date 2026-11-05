# #1295 — isolate strict timing from competing runner steps

The published beta.5 stable audit failed four strict browser timing profiles.
No product optimization or budget increase is justified by that observation alone:
the shared runner scheduled independent browser/Node work concurrently.

## Controlled evidence

Product source in all old-runtime experiments: a4dd940c1190ee62581c187fa500db3c73f66d1c.
The first addressed serial diagnostic [41955192150](https://github.com/Matysh/houseplan-card/actions/runs/41955192150)
passed all4profiles, but used EPYC9V45 rather than the original audit's EPYC9V74.
That run alone does not establish a cause across hardware models.

The paired probe [41956366937](https://github.com/Matysh/houseplan-card/actions/runs/41956366937)
ran jobs2 then jobs1 on the same runner, EPYC9V74 /4vCPU, Ubuntu24 image20261101.360.1,
Chromium unchanged, node22.23.4, same clean product material. Each profile really
ran in both phases; only successful preparation/core/startup was reused in the
second phase. Each selective case contains20samples; native connected-node has
3warmup +5measured gestures and300 input-to-paint samples.

| Series (client ms unless stated) | Parallel median/p95/max long task | Serial median/p95/max long task |
|---|---|---|
| history-copy,0ms|132.6/188.9/195|112.0/119.9/146|
| history-undo,0ms|115.6/141.0/151|97.2/108.1/115|
| history-redo,0ms|111.7/140.3/136|91.1/102.8/101|
| history-delete,0ms|123.1/170.4/173|111.4/118.8/116|
| inactive,0ms|75.2/105.7/104|55.7/61.7/71|
| inactive,320ms|65.3/91.3/73|53.1/56.9/0|
| visible,0ms|85.4/114.7/124|56.3/68.5/70|
| visible,320ms|53.5/66.3/0|54.5/58.3/0|
| connected main-thread median/p95|35.0/51.7|30.9/40.8|
| connected input-to-paint median/p95|66.9/99.4|54.3/80.6|

Parallel visible FAIL: long task124>117ms. Serial all4PASS with identical budgets.
The diagnostic workflow succeeds after retaining both reports; its green job is
not a claim that the parallel phase passed. Complete raw JSON and both reports
are in its process-next-result artifact under artifacts/process-next/1295-paired.
Fixed phase order and no host-wide isolation limit causal precision: this
confirms runner contention as a material measurement confounder, not that every
original failed sample has one proven cause or that performance never regresses.

## Chosen change

A boolean exclusive step drains already running steps before it starts and keeps
later ready work from overtaking while it waits or runs. Unready exclusive steps
still await their prerequisites. Only these4profiles are marked; ordinary work
retains configured parallelism. Failure still blocks only required descendants,
then independent work continues; classification/timeouts/budgets are unchanged.
Scheduling mode is part of receipt identity; a parallel receipt cannot stand in
for an exclusive result. Changes to runner/storage invalidate old cache receipts.

Deterministic runner tests cover drain, no overtaking, resumed parallelism on
success/failure, blocked descendants, unmet prerequisites, flag validation and
reuse identity. Planner tests assert exactly4marked in task and full stable plans.
CI upload retains their existing raw JSON paths on success/failure; no new test
program or runtime hook is introduced. Workflow and canonical template match.

This is an infrastructure correction, not a full repeated stable certification.
The original failed audit remains failed; addressed runs and S6 are separate.
## End-to-end isolation alone is insufficient

CI [41957439627](https://github.com/Matysh/houseplan-card/actions/runs/41957439627)
actually used the permanent exclusive scheduler at ordinary jobs2 on clean source
6f8241aa3beaad5d3e6821e152ab2adda74f0b62. All four measured steps ran without
another plan step, but EPYC7763 /4vCPU, image20261026.354.1 was slower:
history-copy long task205>200ms, connected mainThread p95 57.2>55ms. Inactive and
visible passed; correctness completed. This FAIL is retained, not retried away.
It invalidates any claim that runner isolation guarantees the absolute ceilings.

PROCESS.md, section Sizes/performance, explicitly says other microbenchmarks do
not block publication; only confirmed comparable relative release metrics use
the listed publication thresholds. These four old absolute ceilings cannot be
used as machine-independent release gates. No stable reference is available here.
Therefore the shared catalog explicitly invokes these four scripts with
`--diagnostic-timing`. Threshold numbers and strict standalone/offline verdicts
stay unchanged; no CPU scaling or generous new ceiling is introduced.

Only numeric budget excess becomes diagnostic. Empty/malformed observations,
wrong sample count, native/single-write/persistence proof, functional assertions,
geometry/history/cache counters, input/clock validity, page errors and incomplete
work still fail the executed check. Raw connected `pass` remains the strict
historical budget verdict; `executionPass`, `timingDiagnostic` and `timingStatus`
separately explain execution. A historical red report is never rewritten as green.
Selective reports retain budgetFailures separately from required failures.

Regression tests contrast a complete slow series with missing, invalid, untrusted,
unpersisted and duplicate-write series, functional/clock errors and incomplete
checks. The release relative-metrics algorithm and its blocking behavior are
untouched. The task now includes smoke code and uses product S6 plus selected
runner/catalog/fallback and verdict tests; it is no longer infrastructure-only.