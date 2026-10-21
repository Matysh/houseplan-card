# CI path routing evidence (#980)

The before sample spans 14–20 October 2026 UTC: 513 Validate push runs, with
10 evenly spaced run IDs per day (70 sampled runs). Durations are the sum of
actual non-skipped job seconds, including failures/cancellations; they are not
billing-rounded minutes. Exact BEFORE_SHA was read from executed changes-job
logs. A native two-dot tree diff or an uncapped forward GitHub comparison
establishes 45 complete event ranges. The remaining 25 are explicitly unproven;
no commit-title proxy is used for the following path attribution.

| Current path domain | Runs | Measured before machine minutes |
|---|---:|---:|
| Docs only | 9 | 148.85 |
| Tooling, optionally with docs | 6 | 95.88 |
| Product, optionally mixed | 30 | 753.57 |
| Unproven event range | 25 | 188.62 |

[Raw immutable run identities, event bases, paths and job-seconds](980-before-week.json)
make the sample reproducible. This is a retrospective classification with the
new path policy, not an assertion that those historical runs used that policy.
After measurements must name real profile runs; a future week is not observed.
