# Save long-task investigation — #1153

Prepared evidence for [#1153](https://github.com/Matysh/houseplan-card/issues/1153), planned for milestone **1.84**. The owner accepted a paint long-task limit of **117 ms** for **1.83.0-beta.5** on 2026-10-30 and deferred investigation/optimization. No product optimization is implemented by this package. All other performance limits remain unchanged.

## Evidence boundary

The local capture uses a synthetic large plan and 15 native Save interactions (five each for room name, room paint and visible background). It is an instrumented diagnostic, not a normative benchmark PASS, real Home Assistant or GPU acceptance, or proof of a CI root cause. Aggregate CPU self-time includes only matched input-to-paint windows, rather than the entire trace. Device contact synchronization and recursive content hashing appear among the hot paths; their causal contribution to CI needs a controlled comparison.

Captured product source: `ce403073fa4bc25f40020b83a1021a7c8ad887bb`. Bundle/capture fingerprint: `789ce83e327e9db7c4ec5cff0ea24a37d0c51c12ee057d991cac50bb50b2ff5b`. Local Node **22.23.2**, CI Node **22.23.4**; Chromium **151.0.7922.34**, Playwright **1.62.0**. Do not treat different environments as a controlled comparison.

## Files

- [provenance.json](provenance.json): file lengths, SHA-256 digests, capture environment and CI artifact identities.
- [matched-input-summary.json](matched-input-summary.json): the 15 matched windows and bounded CPU self-time summary.
- `profile.cpuprofile.gz`, `trace.json.gz`, `samples.json.gz`: losslessly compressed original local captures; use `gzip -dk <file>` outside the tracked package before opening them in DevTools.
- `producer-original.mjs.txt`: unchanged original diagnostic producer, retained for provenance.
- [replay.mjs](replay.mjs): same producer with repository-relative imports and a separate output directory. Syntax checked; the relocated copy has not been executed as a fresh benchmark.
- `ci-performance-41037177543.zip`: original failed performance artifact, 846 measurements, four paint long tasks of 111, 102, 117 and 113 ms against the former 100-ms cap. [CI run](https://github.com/Matysh/houseplan-card/actions/runs/41037177543), artifact `12969371997`, SHA-256 `b9c55a3c1cddb98bffe69c150762907dbcb51084f69098da28ef4592577d549b`.
- `ci-performance-41031395367.zip`: older passing performance artifact; overall CI failed elsewhere. [CI run](https://github.com/Matysh/houseplan-card/actions/runs/41031395367), artifact `12965549751`, SHA-256 `5abc768b7ceeb4bf01dcdac8ba8b1addfa3bcc2d5c7dfe9d81e21884d36fb416`. This is context, not evidence that the later failure is flaky.

Historical CI outcomes and original artifacts remain unchanged. The current beta is validated separately against the approved 117-ms limit.

## Replay for the follow-up

Use the repository's pinned Node/browser dependencies. From a clean source checkout at the intended revision, prepare the demo bundle with `npm run build` and `node scripts/bundle-sync.mjs`, then run:

```sh
node docs/analysis/save-long-tasks-2026-10-30/replay.mjs
```

The output is written to `artifacts/save-long-tasks-1153/` and records the actual replay HEAD and browser. A replay at another revision is new evidence and must not be labelled as the original capture. Profiling overhead makes these timings unsuitable as a replacement for the normative selective-invalidation benchmark.

Next investigate Save-time CPU cost on a matched environment, prove whether contact synchronization/content hashing explains the long task, and compare a narrow optimization without changing physical validation, history, saved data, or the View startup budgets. See #1153 for the task scope and relationship to #1093/#1133. No further investigation belongs to beta.5.
