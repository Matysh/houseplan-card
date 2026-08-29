# Large-house performance gate

`benchmark_large_house.mjs` exercises the deterministic `large-house-v1`
fixture. The fixture has 60 rooms, 200 devices, 100 openings, 60 partitions,
40 columns and 500 decor objects on three floors.

Issue #89 adds `large-house-isometric-v1` through the same runner. Because the
product flag expires at 1.65.0, the runner injects an explicit test-only Labs
snapshot, selects iso per fixture space, measures the View toggle and records
the capped `isoGeometry` cache. A comparison SHA predating #89 remains flat
while reporting the same profile. The dedicated
`budgets-large-house-isometric.json` applies the reviewed 20% relative allowance
plus absolute noise/ceiling checks. Only the exact-SHA Linux workflow is gate
evidence; a local report is diagnostic.

Issue #137 adds `large-house-plan-snap-v1` without changing the meaning or
budgets of the original profile. The same 60-room/60-partition fixture gains
six saved open outlines, renders the Plan snap overlay, and sends 120 real
pointer moves across endpoint, line and miss targets. Candidate bundles fail
inside the runner if the static DOM or geometry cache grows, more than one
active node appears, endpoint/line paths are not both exercised, or config and
websocket traffic change. Its dedicated budget retains every original timing,
heap and cache ceiling and adds the measured pointer series plus a one-entry
snap-geometry cache cap. Exact-SHA Linux output is the only gate evidence.

The runner records seven measured samples after one discarded warm-up. With
this intentionally small CI sample, the nearest-rank `p95` is the observed
maximum; reports keep the conventional field name but should be read as a
high-tail guard rather than a population estimate:

- model readiness and first stable render;
- space switch, HA state update, pan/zoom and opening the settings dialog;
- a shared-wall room-resize preview which is cancelled before persistence;
- a twelve-switch navigation cycle;
- Long Tasks for every measured window;
- heap growth after four additional navigation rounds with forced GC;
- hot-cache size and growth after the same warmed cycles.

Every report is tied to the source fingerprint embedded by Rollup. A stale
bundle is a hard failure.

## CI contracts

Ordinary pushes, pull requests and prereleases use the blocking
`performance_smoke` job in `validate.yml`. It builds only the candidate and
measures the heaviest 60-source `large-house-glow-overlay-v1` state after one
warm-up, with three recorded samples. `compare.mjs --absolute-only` enforces the
reviewed hard timing, Long Task, heap, cache and rendered-device ceilings from
`budgets-glow-smoke.json`; it deliberately makes no noisy base-relative claim.
This is a catastrophic-regression guard, not a performance trend detector.

The dedicated `performance.yml` workflow is the full comparison. It runs on
every `main` promotion, weekly and on manual dispatch for an important beta or
performance-sensitive change. It checks out the candidate and its base SHA,
builds both, and runs them sequentially with the same Node.js 22 process
family, pinned Playwright Chromium and hosted runner. `compare.mjs` then
applies two limits:

1. a relative regression allowance against the base-SHA report;
2. an absolute safety ceiling from `budgets.json`.

The tighter limit wins. The absolute values are catastrophic safety ceilings,
not normal-performance targets; the base-relative comparison catches smaller
regressions. Small fast operations receive an absolute noise
allowance so normal scheduler jitter does not become a false regression. Heap,
Long Tasks, warmed-cache growth and the expected rendered-device count are
gated separately. Long-Task maximum/count/total checks use the same
relative-plus-absolute policy as timings. Each independent profile pair runs in
parallel with the other pairs, but its base and candidate remain sequential on
one runner. Its raw reports and comparison are uploaded as
`full-performance-<profile>`, and the table is written to that GitHub job
summary. Stable release assets require both exact-SHA
`Validate` and exact-SHA `Full Performance`; prereleases require only
`Validate`.

This base-vs-candidate design intentionally does not compare timings captured
on different machines or different Chromium builds. A runtime/profile mismatch
fails closed.

Before the base checkout, CI fetches the complete commit graph and verifies the
requested comparison revision. A `main` push uses `github.event.before`, which
must both exist and remain an ancestor of the candidate; this catches the
unreachable SHA left by a force-push. A manual run may name an explicit tag,
branch or SHA, while an empty manual input and the weekly run use the candidate
parent. An unusable requested revision falls back with a warning to the direct
parent, then to the newest reachable semver release. If no safe comparison
exists, the job fails closed instead of comparing against an arbitrary commit.

## Private card contract

The candidate benchmark runner is also executed against the base bundle, so
every private `houseplan-card` field or method it reads is an explicit API of
the performance harness. `card-contract.mjs` lists that surface for the
large-house and Glow profiles. Each runner verifies it immediately after card
creation and fails with the exact missing names or invalid runtime types before
waiting for readiness or recording timings. Required caches must be real
`Map` instances and must never be converted from missing/invalid values to
plausible zeroes.

`fields` are required in every supported comparison base. `optionalFields` are
newer members whose absence has an explicit safe fallback in the runner; if an
optional member exists, its declared `fieldTypes` contract still applies. Add a
new safely degradable field to `optionalFields` until every supported base has
it, then promote it to `fields`. A member without a truthful fallback must be
introduced through a compatibility revision before the benchmark consumes it.

Rename a consumed private member in two revisions:

1. teach the contract and every reader to understand both the old and proposed
   name while production still exposes the old name; land that compatibility
   revision so it can become a comparison base;
2. rename the production member and prefer the new name while retaining the
   old reader fallback. Remove the fallback only after all supported comparison
   bases expose the new member.

This sequencing keeps the current harness capable of profiling both source
trees. A one-step rename that merely edits the candidate reader is forbidden:
it would make the same runner incompatible with its base bundle.

## Local diagnostics

Build and copy a fresh demo bundle first, then run:

```bash
npm run benchmark:large-house -- --samples=7 --warmups=1 --output=artifacts/performance/local.json
npm run benchmark:large-house-plan-snap -- --samples=7 --warmups=1 --output=artifacts/performance/plan-snap-local.json
```

A local report is diagnostic only; it cannot replace the CI comparison.

To reproduce the comparison against another checkout using one harness and one
browser installation:

```bash
npm run benchmark:large-house -- --target-root=../base --samples=7 --output=artifacts/performance/baseline.json
npm run benchmark:large-house -- --target-root=. --samples=7 --output=artifacts/performance/candidate.json
npm run benchmark:compare
```

## Changing budgets

Budget changes require an explicit review of recent CI artifacts and a written
rationale in the change. Do not loosen a threshold merely to make a single red
run pass. A new fixture profile gets a new profile id instead of silently
changing the meaning of `large-house-v1`.

The `cleanFloor` entry ceiling is 160: the reviewed fixture currently warms
120 deterministic room/physical-body entries, and the extra 40 slots allow a
legitimate fixture extension without weakening the separate zero-growth gate.

## Glow profiles

The full-card Glow profiles run deterministic 1/10/30/60-pool variants at DPR
1 and Chromium CPU throttling x4, but deliberately exercise different fixtures:

- `large-light-blend-v1` compares the isolated screen group with the previous
  normal-layer implementation on the shared frontend/backend schema fixture
  `test/fixtures/glow/additive-pools.json`;
- `large-house-glow-overlay-v1` measures simultaneous temperature fill and
  independent Glow on the existing 60-room/200-device large-house fixture,
  without changing `large-house-v1`.

The same runner also owns the two static-card profiles introduced with #374:

- `large-space-card-default-v1` proves that the default-off card keeps the
  historical no-visibility-work path and a zero-entry Glow cache;
- `large-space-card-glow-v1` measures the explicit `light_pools:true` path on
  one large static space, including HA ticks, heap/cache growth and capture.

```bash
npm run benchmark:glow -- --profile=large-light-blend-v1 --output=artifacts/performance/glow.json
npm run benchmark:glow -- --profile=large-house-glow-overlay-v1 --output=artifacts/performance/overlay.json
npm run benchmark:glow -- --profile=large-space-card-default-v1 --output=artifacts/performance/space-default.json
npm run benchmark:glow -- --profile=large-space-card-glow-v1 --output=artifacts/performance/space-glow.json
npm run benchmark:glow -- --profile=large-house-glow-overlay-v1 --variants=60 --samples=3 --warmups=1 --output=artifacts/performance-smoke/candidate.json
npm run benchmark:compare -- --absolute-only --budgets=demo/performance/budgets-glow-smoke.json --candidate=artifacts/performance-smoke/candidate.json --output=artifacts/performance-smoke/comparison.json
npm run benchmark:glow -- --profile=large-space-card-glow-v1 --variants=60 --samples=3 --warmups=1 --output=artifacts/performance-smoke/space-candidate.json
npm run benchmark:compare -- --absolute-only --budgets=demo/performance/budgets-space-glow-smoke.json --candidate=artifacts/performance-smoke/space-candidate.json --output=artifacts/performance-smoke/space-comparison.json
```

Reports include per-variant state-update timings, render/pool counts, Long
Tasks, screenshot time, heap and cache growth. The first CI comparison against
a base SHA that predates `glow_enabled` bootstraps only the overlay profile's
relative baseline from the candidate; its absolute ceilings still gate that
introduction. Every subsequent revision compares both profiles to the real
base SHA.

The initial absolute ceilings are intentionally conservative bootstrap limits;
they must be reviewed against the first paired Ubuntu artifacts before the
feature is promoted from beta. Same-runner relative checks in the full workflow
remain the primary regression signal; the candidate-only smoke only guards
against catastrophic failures.
