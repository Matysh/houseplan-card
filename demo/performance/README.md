# Large-house performance gate

`benchmark_large_house.mjs` exercises the deterministic `large-house-v1`
fixture. The fixture has 60 rooms, 200 devices, 100 openings, 60 partitions,
40 columns and 500 decor objects on three floors.

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

## CI contract

The `performance` job checks out the candidate and its base SHA, builds both,
and runs them sequentially with the same Node.js 22 process family, pinned
Playwright Chromium and hosted runner. `compare.mjs` then applies two limits:

1. a relative regression allowance against the base-SHA report;
2. an absolute safety ceiling from `budgets.json`.

The tighter limit wins. The absolute values are catastrophic safety ceilings,
not normal-performance targets; the base-relative comparison catches smaller
regressions. Small fast operations receive an absolute noise
allowance so normal scheduler jitter does not become a false regression. Heap,
Long Tasks, warmed-cache growth and the expected rendered-device count are
gated separately. Long-Task maximum/count/total checks use the same
relative-plus-absolute policy as timings. Both raw reports and the comparison are always uploaded as
the `large-house-performance` artifact, and the table is written to the GitHub
job summary.

This base-vs-candidate design intentionally does not compare timings captured
on different machines or different Chromium builds. A runtime/profile mismatch
fails closed.

Before the base checkout, CI fetches the complete commit graph and verifies the
requested comparison revision. A push `github.event.before` must both exist and
remain an ancestor of the candidate; this catches the unreachable SHA left by a
force-push. An unusable revision falls back to the newest semver release tag
reachable from the candidate, excluding a tag on the candidate itself. If no
such release exists, the job fails closed instead of comparing against an
arbitrary commit.

## Private card contract

The candidate benchmark runner is also executed against the base bundle, so
every private `houseplan-card` field or method it reads is an explicit API of
the performance harness. `card-contract.mjs` lists that surface for the
large-house and Glow profiles. Each runner verifies it immediately after card
creation and fails with the exact missing names before waiting for readiness or
recording timings. Missing caches must never be converted to plausible zeroes.

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

Both Glow profiles run deterministic 1/10/30/60-pool variants at DPR 1 and
Chromium CPU throttling x4, but deliberately exercise different fixtures:

- `large-light-blend-v1` compares the isolated screen group with the previous
  normal-layer implementation on the shared frontend/backend schema fixture
  `test/fixtures/glow/additive-pools.json`;
- `large-house-glow-overlay-v1` measures simultaneous temperature fill and
  independent Glow on the existing 60-room/200-device large-house fixture,
  without changing `large-house-v1`.

```bash
npm run benchmark:glow -- --profile=large-light-blend-v1 --output=artifacts/performance/glow.json
npm run benchmark:glow -- --profile=large-house-glow-overlay-v1 --output=artifacts/performance/overlay.json
```

Reports include per-variant state-update timings, render/pool counts, Long
Tasks, screenshot time, heap and cache growth. The first CI comparison against
a base SHA that predates `glow_enabled` bootstraps only the overlay profile's
relative baseline from the candidate; its absolute ceilings still gate that
introduction. Every subsequent revision compares both profiles to the real
base SHA.

The initial absolute ceilings are intentionally conservative bootstrap limits;
they must be reviewed against the first paired Ubuntu artifacts before the
feature is promoted from beta. Same-runner relative checks remain the primary
candidate-only regression signal.
