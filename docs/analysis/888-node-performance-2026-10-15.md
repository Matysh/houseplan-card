# #888 — connected-node perf evidence, 2026-10-15

Infrastructure only. No runtime, native clock/input/paint protocol, scene,
functional oracle or budget edits. Three runs were declared before execution
and coordinated in an exclusive local window; every outcome below is retained.
No retry-until-green. The old owner acceptance of 50.6 ms is not reused.

## Historical primary failures

| Raw source | Material | Main-thread p95 / limit | Input-to-paint p95 / limit | Long task max / limit |
|---|---|---|---|---|
| [38527369787, attempt 1](https://github.com/Matysh/houseplan-card/actions/runs/38527369787/attempts/1), `smoke-logs-2` 11877167293 | `078c8bfdfe78b5aee7f59817650cbfb50e78479f` | 48.300 / 50 ms | **103.283232 / 100 ms** | 62 / 150 ms |
| [38592132431, attempt 1](https://github.com/Matysh/houseplan-card/actions/runs/38592132431/attempts/1), `smoke-logs-3` 11908423741 | `ef1aeaf6cf94f2f692654e975a4ee18c40b143a7` | **50.600 / 50 ms** | 108.320023 / 110 ms | 63 / 150 ms |

Downloaded raw SHA256, in source order:

- `a4af9ab0373ce57f7fa650a1b8d88a35821d125f4c359d24416a324aa2c92619`
- `37d1933be6d12760d09134438a17a3623f8671fa06b0e1bd0762f8bb02f42fe9`

Both reports have 300 source measurements and complete functional guards, but
different commit/bundle/budgets. They are not one fixed-material series.
The green attempt-2/38595139960 ordinary logs only name the passing smoke;
its numeric raw evidence is absent from this analysis. Green repeats do not
establish cause, erase the first red result or prove a flake.

Exact identity-derived decomposition of each historical **p95 input row**:

| Source | Source → matching native | Native dispatch | Frame scheduling | Candidate wall-time | Candidate → paint opportunity | Sum |
|---|---|---|---|---|---|---|
| 078c8bfd, gesture6/source40, superseded by42 | 34.883232 | 5.2 | 18.0 | 42.5 | 2.7 | 103.283232 ms |
| ef1aeaf6, gesture4/source42, superseded by44 | 33.720023 | 13.7 | 18.9 | 34.0 | 8.0 | 108.320023 ms |

This localizes the first failure: **103 ms is not 103 ms of geometry**. The
source was superseded, so source→matching-native includes waiting for later
input, not pure CDP transport. For the second failure the exceeded **primary
flush** p95 is 50.6 ms, a different population/row from its input p95 above.
That is a genuine recorded wall-time budget excess, not a rounding error.
CPU execution versus OS descheduling cannot be separated by these timestamps.

## Fixed local series

Coordinator grant preceded all three runs; its window ended after run3
(about40 seconds). The other agents ran no local heavy tests in this window.

Material `7e46054ef019e1bc063d2742a927b950fd14c6e6`, tree
`0a89583265a29ef303c2ea82b5903bd5a95bffbb`, non-bundle worktree clean.
Harness SHA256 `17a3e81eaa2a552a5e870dfacaa9c23b6d377ca5e61d7c29b0659c6ff0042f8b`;
fixture `7fd2b0691058e6d0c9e1721f98c1e1166e9b634648251c7c2b9a5b8ec5e061e9`;
fresh served bundle `aea4a3694e0140680ddfd37e3ceccd262392e9564b25118231ccf83cf13f50d9`.
The bundle matches the second historical product fingerprint; this does not
make their environments/harness/protocol receipts one comparable series.

Attested Playwright1.62.0, headless-shell Chromium151.0.7922.34/rev1234,
Node22.23.3. Linux x64, kernel `6.18.33.2-microsoft-standard-WSL2`, Intel Core
Ultra7 155H, 22 logical CPUs, totalMemory16,483,794,944 bytes. Local ImageOS,
ImageVersion and Actions run/attempt are null (not a hosted-runner claim).

Each unchanged 1280×1000/DPR1 fixture contains 8 rooms/30 walls/14 openings;
3 warmup and5 measured gestures, each60 distinct native inputs at16 ms with
no response/frame pacing. Eight conservative monotonic RTT probes before/after
every gesture retain source clocks and overlapping bounds. Current limits are
**55/121/150 ms**, already authorized by #898, not changed by #888.

| Retained raw | Exit / pass | Main p95 | Input p95 (300 sources) | Long task max | Flushes / validations | Source coalescing |
|---|---|---|---|---|---|---|
| `artifacts/888-series/raw-1.json` | 0 / true | 24.000 | 51.336071 | 0 | 215 /160 | 85 |
| `artifacts/888-series/raw-2.json` | 0 / true | 23.100 | 48.820905 | 0 | 224 /167 | 76 |
| `artifacts/888-series/raw-3.json` | 0 / true | 24.000 | 50.470925 | 0 | 217 /160 | 83 |

Raw SHA256 in source order:

- `c7e2dd7f87b115df9599b5558e2d0e6e303c39098440473b82b58d4c0a3ccca6`
- `91c6001a9fc5782f6c5ca2e0b27a5935a78b45cc9349a50eab92758ae565184d`
- `21914b8f94ee7c615a4b30ed7940d89d797015d4ec81e0530c0932f11eb8a10c`

The original complete raw files remain in the isolated implementation tree.
Their passports, probes, all measured inputs/samples and exact phase joins are
retained; CI also writes its full raw file to `smoke-logs` on pass or failure.
The transcript plus these digests identify this finite local series; later
CI/reviewer runs are separate proof, not additional members chosen for colour.

Load averages at start→end: run1 `[0.44,2.65,5.21]→[0.78,2.62,5.16]`, run2
`[0.78,2.62,5.16]→[1.04,2.61,5.13]`, run3 `[0.96,2.57,5.10]→[1.19,2.57,5.07]`.
Free memory at start→end in bytes: run1 `14943924224→14787153920`, run2
`14945013760→14805753856`, run3 `14856990720→14706978816`.
These are observed background conditions, not evidence of a causal culprit.

Read-only summary reports `comparable:true`, primary p95 ranges main
23.100–24.000/input48.821–51.336 ms, and **`cause:"unknown"`**. All300 phase
joins per run are observed. Frame-scheduling source-weighted p95 is
7.8/4.7/6.0 ms; candidate source-weighted p9524.0/23.2/23.7 ms. These phase p95s
must not be added or substituted for the primary per-flush population.
All existing neighbour pixel, live-owner, unchanged-preview, last-target,
one-write/history, exact Undo/Redo and invalid-final-release checks passed.

## What is and is not established

The reporting defect is fixed: a red verdict names each metric/actual/limit,
also preserving missing measurements, clock/function/page errors. No empty
failure list can be mistaken for an unexplained success by offline derivation.
Pure negative tests protect each threshold (including equality), immutable
phase identity/sums, ambiguous/missing sources and foreign/partial series;
they execute no product mutants and call no live HA/write API.

The local bounded series is stable within the stated ranges. It does **not**
identify historical CI CPU/runner cause, prove absence of CI slowdown, show
real-GPU acceptance or prove a flake. No product change is justified by missing
historical environment/green raw evidence. The new passport and phase report
make any future red CI outcome actionable without hidden retries or wider
budgets. No additional issue has been created.

Reproduce derivation without launching a benchmark:

```sh
node scripts/node-connected-diagnostics.mjs artifacts/888-series/raw-1.json artifacts/888-series/raw-2.json artifacts/888-series/raw-3.json
node scripts/node-connected-diagnostics.mjs artifacts/888-history/38527369787/smoke_wall_node_connected.raw.json artifacts/888-history/38592132431/smoke_wall_node_connected.raw.json
node --test test/node-performance-report.test.mjs test/node-input-ledger.test.mjs test/node-paint-observer.test.mjs test/node-native-input.test.mjs
```

The latter22 unit cases passed. Changed paths are B/C only; no public release
milestone or user changelog entry (ledger category `infra`).
