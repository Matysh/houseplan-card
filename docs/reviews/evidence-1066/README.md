# Daycycle raster investigation — #1066

The bounded control reproduced the expensive work pattern without modifying the
renderer, input path, two-rAF wait, samples or ceiling. The camera's existing
100 ms viewBox refresh budget couples the amount of raster work to the actual
time between native moves. This identifies a concrete mechanism for the work
count difference. The exact resource/scheduler trigger of the historical CI
failure remains unobserved; the old report cannot retrospectively supply it.

## Immutable material and observations

All three new reports have clean source
`be5ce50f72fe9a0d9b8311b76ee446821491704d`, tree
`0d75dc999d569afccabd062a0b29775595cf682b`, Playwright 1.62.0,
Chromium headless-shell 151.0.7922.34/rev1234, and the same synthetic fixture.
The product paths are byte-identical to the original failing candidate
`ef4eac9c3568f7831e43d2b375552954efc8a9b3`; `index.json` names the relevant
immutable blobs. The three gzip files preserve every raw byte of the original
JSON, including all six samples, native events, geometry, raster tasks and layers.
Their compressed and uncompressed SHA-256 values are in the index.

| Profile | Daynight native input median | Outline viewBox writes, all three rounds | Daynight RasterTasks | Median paired ratio | Original guard |
|---|---:|---|---|---:|---|
| Ordinary GitHub CI | 83.3 ms | 31 / 31 / 31 | 682 / 682 / 682 | 1.214590 | PASS |
| Ordinary WSL | 66.7–66.8 ms | 31 / 31 / 31 | 682 / 682 / 682 | 1.281960 | PASS |
| WSL, one CPU + one owned competing worker | 116.7 ms | 60 / 60 / 60 | 1237 / 1237 / 1237 | 2.364578 | FAIL |
| Historical CI attempt 1 | **unknown** | **unknown** | 1219 / 1198 / 1219 | 2.414350 | FAIL |

The controlled ratios are **1.787098 / 2.364578 / 2.488242**: two pairs exceed
2.0 and the unchanged median guard fails. This is complete negative evidence,
not a retry, an accepted performance result or release authority. All other
14 existing smoke checks pass. The ordinary CI is
[40179808116](https://github.com/Matysh/houseplan-card/actions/runs/40179808116),
selected-browser job `121128814694`, artifact `12594061208`. It is task CI,
not a full release run. Local observations are author-owned WSL evidence.

## Mechanism and its limits

`src/live-viewport.ts` (`2202b4f62dcb7b1ffd1c984fa75cbed73351d73f`)
refreshes at 100 ms or a normalized shift/scale change of 0.15. Regular native
pan goes through `scheduleHouseplanViewport`, which does not force a refresh;
`commitHouseplanViewport` reconciles a full Lit frame with `force: true`.
The pointer stays held during the 60 moves. The fixture supplies a fixed sun
entity before each pan; no clock is frozen or advanced artificially.

At 66.7/83.3 ms between inputs the observed regular refreshes happen every
other step: 30 refreshes plus one reconciliation after pointer-up. At 116.7 ms,
each move crosses the time budget: 60 writes, with no additional write after
pointer-up. Across all three rounds the largest normalized position change
between written viewBoxes is below 4.8% in ordinary runs and 2.4% in the control;
scale change is zero. These are below the separate 15% spatial trigger.
The actual DOM observations, not just the configured CSS hint, establish the
different refresh counts. All runs retain 60 trusted native moves and 120 rAF
callbacks per sample. Both hosts report the same SwiftShader renderer/driver.

The work increase is not one abnormally long task. The new count difference,
1237 minus 682 = 555 tasks, matches the 1219 minus 664 difference in two of the
historical CI/local comparisons. This is a reproduced work-count signature,
not proof that the historical runner had one CPU or the same competing process.
The third historical sample had 1198 tasks and is retained without adjustment.
Historical raster grouping intervals were heuristic groups; they are **not**
retroactively called native input timestamps, frame boundaries or viewBox writes.

The counterexample demonstrates sensitivity of this fixed-step/two-rAF workload
to wall-clock camera refreshes. It does not establish a new product regression,
exonerate the original valid RED, or authorize changing the ceiling/pace.
No source, filter, timeout, rAF count or sample was patched, trimmed or discarded.

## Observation boundaries

Mutation timestamps are delivery upper bounds. Per-step snapshots retain
connected/in-root DOM identities; CDP backend-node IDs and raw layer notifications
remain available. A page user-timing marker aligns page and trace clocks.
Layer notification receipt times use Node's clock and are not frame boundaries.
RasterTask durations are elapsed spans; CPU `tts`/`tdur` are retained only when
the protocol provides them, without inferring missing CPU time.

The recorded 2.2–3.8 ms per pan is **page-callback elapsed overhead only**.
It does not measure every CDP/LayerTree/tracer effect or establish zero observer
effect. Raw work is never subtracted to compensate for instrumentation. The
historical reports lack this observation, so their missing fields stay unknown.

## Bounded protocol and reading the data

One ordinary WSL and one selected CI capture were compared on the same clean
`be5` material, then exactly one predeclared external resource control was run.
Its Node/controller and one bounded competing CPU worker inherited guest affinity
CPU 0; the JSON reports availableParallelism=1 and Cpus_allowed_list=0. The worker
imported no product code. It had a 190-second lifetime cap, was killed and reaped
by its owning shell on exit, and the smoke kept its existing 180-second timeout
and 10-second kill-after. The smoke exited 1 on the unchanged ratio guard.
There was no parameter search or further retry. A preliminary earlier `6d4`
ordinary observation remains private; metadata fixes and explicit connected-node
observation produced the final matching `be5` material before this comparison.

The complete report can be compared without rewriting it:

```sh
node scripts/daycycle-compare.mjs --summary docs/reviews/evidence-1066/ci.json.gz docs/reviews/evidence-1066/wsl.json.gz
node scripts/daycycle-compare.mjs --summary docs/reviews/evidence-1066/controlled.json.gz docs/reviews/evidence-1066/wsl.json.gz
```

Omit `--summary` for every temporal bin. Compact output is a view of all samples;
the gzip evidence remains complete. The helper never changes either original
measurement verdict. Subsequent accepted changes, including #1071, are different
material; this dossier does not claim that their performance was measured here.
