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


## Observed after runs (21 October UTC)

| Event | Real workflow run | Wall | Machine seconds |
|---|---|---:|---:|
| Docs profile in initial mixed push | [39530825970](https://github.com/Matysh/houseplan-card/actions/runs/39530825970) | 22 s | 18 |
| Scripts/tooling tests only | [39532225849](https://github.com/Matysh/houseplan-card/actions/runs/39532225849) | 269 s | 289 |
| Accepted product-history replay, product profile | [39533328394](https://github.com/Matysh/houseplan-card/actions/runs/39533328394) | 270 s | 587 |
| Same replay, tooling profile | [39533328460](https://github.com/Matysh/houseplan-card/actions/runs/39533328460) | 273 s | 384 |
| Same replay, docs profile | [39533328473](https://github.com/Matysh/houseplan-card/actions/runs/39533328473) | 24 s | 19 |

The scripts-only event changed `scripts/process-resume.mjs` and its two tooling
witnesses. No product/docs workflow was started for that event; HACS/Hassfest
were skipped because no `.github` file changed. The product replay fast-forwarded
an issue branch from an accepted pre-beta commit to the unchanged published
#980 source SHA; its event included already accepted `src` changes. It introduced
no product patch. Frontend, backend and parity actually executed successfully;
all three companion profiles passed, and `evaluateCiProof(reviewLight)` returned
`green`. The temporary probe ref was removed after completion.

The initial product run [39530825965](https://github.com/Matysh/houseplan-card/actions/runs/39530825965)
was green while its same-SHA tooling companion was red. Loading both real runs
through `loadGithubProofContext` returned `failed: tooling: companion checks
absent or not green`. That Linux-only fixture failure was corrected before the
scripts-only run above. A narrower progress workflow cannot hide required failure.

[Observed run/job records](980-after-runs.json) preserve exact identities and
job-second accounting. These controlled runs measure the implemented routes;
they are not a week of post-change production traffic. The historical weekly
sample remains 70 observed runs, with 45 proven event ranges and 25 unknown.
A docs-only evidence update is the final author push; its immutable run link and
absence of product/tooling runs are recorded in the issue handoff after execution.

The final author material also incorporates accepted #982 and #983 from `dev`.
Generated product recipes include the selected-browser job while canonical full
S7 dispatch, nightly and prerelease policy retain complete requested coverage.
