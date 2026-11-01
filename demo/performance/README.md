# Performance fixtures and diagnostics

This directory contains synthetic workloads and measurement helpers.
When to measure and what can pause a release are defined in
[PROCESS.md](../../PROCESS.md), not by a separate CI-only policy here.
[TESTING.md](../../docs/TESTING.md) explains their place among the test families.

The new process is still prepared in this branch. These instructions do not
activate its workflows or authorize publication.

## Measurements in the prepared process

Normal tasks do not automatically measure size or timing budgets. Before beta,
the common profile records the selected size and interaction metrics, compares
them with the last stable in comparable conditions, and shows the fixed
v1.83.1 measurement as a diagnostic reference. Each stable saves a measurement
for the following beta. A missing, noisy or incomparable measurement is
reported honestly rather than converted into a confirmed regression.

The profile runs measurement after the other required work, so parallel
browser/Node/HA activity does not distort it. The adapter is
[`process-next/catalog/measure.mjs`](../../process-next/catalog/measure.mjs);
its benchmark uses `large-house-v1`, one warm-up and seven measured samples.
Comparison and reporting are in
[`process-next/lib/metrics.mjs`](../../process-next/lib/metrics.mjs).

Inspect the common profile without executing it:

```sh
node process-next/cli.mjs plan --event beta --version "1.99.0 beta 1" --request release.json
```

The release request can name the previous stable measurement and observed
machine conditions. Request fields and the execution route are described in
[DEVELOPMENT.md](../../docs/DEVELOPMENT.md). Reports are written to
`artifacts/process-next/measurement.json`, `metrics.json` and `metrics.md`.
The fixed `process-next/baselines/v1.83.1.json` is not automatically remeasured.

The short blocking metric list, percentage thresholds and absolute tolerances
live in the process canon and the prepared metrics implementation. Existing
`budgets-*.json` files describe their individual diagnostic tools; they do
not create additional gates for every task or release.

## Large-house profiles

`demo/benchmark_large_house.mjs` uses a deterministic house with 60 rooms,
200 devices, 100 openings, 60 partitions, 40 columns and 500 decor objects on
three floors. It records model readiness, first stable render, floor switch,
HA update, pan/zoom, settings opening, resize preview, navigation cycles,
Long Tasks, heap change and cache size.

| Profile | Workload |
|---|---|
| `large-house-v1` | Base View, navigation and state updates |
| `large-house-isometric-v1` | Isometric View and geometry cache |
| `isometric-stage3-dense-v1` | Dense devices near walls/corners, raised overlays and state updates |
| `large-house-isometric-backdrop-v1` | Isometric rendering with the backdrop |
| `large-house-plan-snap-v1` | Saved open outlines and 120 native pointer positions over endpoint, line and miss targets |
| `large-house-interaction-v1` | Hover, pan/zoom, editor drags and related/unrelated HA snapshots |

The interaction profile also accepts a quarter-turn `--rotation=90`,
`180` or `270`. Its geometry oracle uses the painted SVG world matrix.
Other profiles reject nonzero rotation.

Functional/structural assertions stay meaningful independently of speed:
a faster run is not correct if it changes data unexpectedly, performs an
unwanted full render, rebuilds static geometry during a warmed navigation
cycle or loses SVG/HTML alignment.

By default the runner collects seven samples after one discarded warm-up.
With such a small series, nearest-rank p95 is the observed maximum, not a
reliable estimate of a population percentile. Raw samples remain in the report.
Historical measurements made with different warm-up/fixture protocols should
not be pooled.

## Addressed local diagnostics

For an explicitly selected investigation, prepare the current product build
and demo assets, then run the profile that answers the question:

```sh
npm run build
node scripts/bundle-sync.mjs
node demo/benchmark_large_house.mjs --profile=large-house-v1 --samples=7 --warmups=1 --output=artifacts/performance/local.json
```

Change `--profile` to one of the supported profiles above. These commands
are available diagnostics, not instructions to run every profile on a task.
A valid local result is not repeated solely to obtain a GitHub result.
When comparing timings, use the same fixture, runner, toolchain, warm-up
protocol and comparable machine conditions.

`wall-draw-click-v1` exercises consecutive wall segments in a five-space
fixture. It observes local versus full physical checks, wall-artifact reuse,
history entries and queued writes. Its diagnostic commands are:

```sh
npm run benchmark:wall-draw-click -- --output=artifacts/performance/wall-draw-click.json
node demo/smoke_wall_draw_click.mjs
```

The second command also checks behavior; neither is implicitly added to all
task profiles.

## Glow, LED and sensor scenarios

The separate Glow runner measures controlled source-count and occlusion
workloads, including static card paths. Its profile names and inputs are
declared in `demo/benchmark_glow.mjs`; use the corresponding fixture and
reported profile when comparing results.

The LED runner covers initial loading, camera changes, HA updates, cached
geometry, unmount cleanup and a runtime response arriving after unmount.
It records actual emitter counts and cached paths instead of hiding visual
holes by dropping required endpoints or corners.

`sensor-tick-scenarios.mjs` separates four state-update cases:

- S0: an entity outside the plan;
- S1: a displayed-floor plan sensor;
- S1b: a sensor on another floor;
- S2: the light of a displayed LED strip.

Reports distinguish full renders, snapshot/presentation work, LED frames and
tubes, architectural light fingerprints, graph builds and resolutions. A
missing counter is unknown, not zero. These scenario labels are measurement
steps, not issue statuses.

## Reading interaction diagnostics

`resize-attribution.mjs` splits the measured resize Long Task into
preflight, other projection, publish, labels, other movement, Lit update and
remaining time. It also records `geometryMoves`, `frameRenderMs` and
`forcedStyleLayoutMs` where supported. Whole-millisecond Long Task readings
can leave approximately one millisecond of rounding error in the sum.

Extra preflight or label time points to work inside those measured calls.
Extra `otherMs` is outside them; `geometryMoves: 0` means the longest task
was not the resize step. Timing alone does not establish CPU scheduling,
garbage-collection or GPU causes. Unsupported browser instrumentation remains
`null` or a stated unsupported result.

For the connected-node gesture observer and clock alignment, see
[README-node-performance.md](../helpers/README-node-performance.md).
Keep every planned sample, including failures; do not retry until the report
turns green.

## Private card contract

A comparison harness may read both candidate and base bundles.
`card-contract.mjs` declares the private card fields and methods it uses.
Required caches must be real `Map` objects; missing state must not become a
plausible zero. Contract failures name the missing member before measurement.

`fields` are required in all supported bases. `optionalFields` need a
truthful fallback, and their declared types still apply when present.
`optionalMethodsOf` describes optional methods that are wrapped only when
available.

When renaming a consumed member, first teach the harness both names and let
that compatibility revision become a comparison base. Then change production
and keep the old reader fallback while old bases remain supported.
A harness change must not silently make the base incomparable.

## Interpreting failures

First distinguish a product defect, an invalid measurement and a confirmed
performance change. Preserve the actual failing report and explain unknowns.
Adjusting diagnostic budgets or accepting release regression is an explicit
decision, not an automatic response to a red result.

Browser mismatches require compatible environments or an honest
incomparability report. They do not justify changing visual references:
[the visual guide](../golden/README.md) describes addressed review and acceptance.

Past measurements and policy revisions remain in Git history and their
issues. This guide does not reinstate former Validate/Full Performance
release requirements or per-task hard limits.
