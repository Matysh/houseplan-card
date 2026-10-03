# Large-house performance gate

`benchmark_large_house.mjs` exercises the deterministic `large-house-v1`
fixture. The fixture has 60 rooms, 200 devices, 100 openings, 60 partitions,
40 columns and 500 decor objects on three floors.

Issue #89 adds `large-house-isometric-v1` through the same runner. The runner
enables the current candidate through the real `hp_alpha=1` URL/storage
contract, selects iso per fixture space, measures the View toggle and records
the capped `isoGeometry` cache. A compatibility-only snapshot keeps comparison
bundles from before #448 measurable without restoring a legacy user-facing
activation path; a comparison SHA predating #89 remains flat while reporting
the same profile. The dedicated
`budgets-large-house-isometric.json` applies the reviewed 20% relative allowance
plus absolute noise/ceiling checks. Only the exact-SHA Linux workflow is gate
evidence; a local report is diagnostic.

Issue #160 keeps that historical profile and budget unchanged, then adds the
separate `isometric-stage3-dense-v1` profile. Its derived performance-only
fixture puts all 200 devices close to walls or corners and adds deterministic
value, LQI and new-device badges plus contact/lock-bound door, window and gate
examples. The base invocation explicitly allows a Stage 2 renderer so an older
`dev` SHA remains measurable; the candidate invocation fails closed unless it
reports effective Iso, the Stage 3 revision, all required raised overlay kinds,
no nudged overlay root (since #713 every raised tile is lifted by the one shared
wall-top rise, so a nudge means the #651 placement search came back), a bounded
shared material-definition set and zero structural rebuilds during HA, opening
and hover/focus updates. The two extra
timing windows use limits no softer than the historical HA-update budget. This
does not change the fixture, measured windows or budget of
`large-house-isometric-v1`, which remains the #124 regression witness.

Issue #137 adds `large-house-plan-snap-v1` without changing the meaning or
budgets of the original profile. The same 60-room/60-partition fixture gains
six saved open outlines, renders the Plan snap overlay, and sends 120 real
pointer moves across endpoint, line and miss targets. Candidate bundles fail
inside the runner if the static DOM or geometry cache grows, more than one
active node appears, endpoint/line paths are not both exercised, or config and
websocket traffic change. Its dedicated budget retains every original timing,
heap and cache ceiling and adds the measured pointer series plus a one-entry
snap-geometry cache cap. Exact-SHA Linux output is the only gate evidence.

Issue #451 adds `large-house-interaction-v1`. It dispatches 120 real
device/room/free-background hover moves, four 20-move pans, pinch/wheel camera input, three editor
drag series and 30 unrelated HA snapshots. It also injects relevant snapshots
inside and outside a gesture and counts heavy `_renderBody()` passes plus full
marker-binding diagnostic scans. Current bundles fail inside the runner unless
hover, editor moves and unrelated ticks perform zero full renders, a relevant
tick is deferred during pan, each terminal event reconciles at most one full
frame, the heavy wall DOM remains identical, and the projected HTML device
layer stays within one CSS pixel of its SVG scene position. Older comparison
bundles still produce timing baselines; structural assertions become mandatory
only when the target source contains the live viewport implementation. Its
dedicated budget preserves every existing large-house ceiling and adds the
individual interaction timing gates.

Structural assertions are evaluated independently of timing budgets: a fast
run still fails when an interaction performs an unexpected full render or
changes the heavy scene DOM.

The runner records seven measured samples after one discarded warm-up. With
this intentionally small CI sample, the nearest-rank `p95` is the observed
maximum; reports keep the conventional field name but should be read as a
high-tail guard rather than a population estimate:

- model readiness and first stable render;
- space switch, HA state update, pan/zoom and opening the settings dialog;
- a shared-wall room-resize preview which is cancelled before persistence;
- a twelve-switch navigation cycle; since #735 every fixture floor is visited
  once before its window, and a floor build inside the window (any grown hot
  cache or a 2.5D structural build) fails the sample;
- Long Tasks for every measured window;
- heap growth after four additional navigation rounds with forced GC;
- hot-cache size and growth after the same warmed cycles.

Issue #735 moved the first visit to each floor out of the navigation cycle.
Every sample mounts a new card that had seen only floors 1 and 2, so the cycle
used to pay one cold floor-3 build inside its window (in
`large-house-interaction-v1` also a floor-1 rebuild, because the editor series
moves the config epoch that keys the clean-floor cache). That single step was
about half of `switchCycleMs` and hid the warmed switches the metric is
meant to describe; a cold floor visit stays measured by `spaceSwitchMs`. The
change is a level step, not a regression or a speed-up of the card: base and
candidate are still measured by the candidate runner in the same run, so the
comparison is unaffected, but absolute `switchCycleMs` history and the
profile's Long Task sums before and after #735 are not comparable. Local
diagnostics showed the median falling by roughly 1.6–2.8 times (for example
`large-house-v1` about 2.0 s to 0.9 s); the exact-SHA Full Performance medians
on both sides of the change are recorded in #735. Budgets and `hardMaxMs` did
not change in #735; #747 then brought the `switchCycleMs` ceilings down to the
warmed level (see "CI contracts" below).

Issue #743 adds `large-house-isometric-backdrop-v1`, the 2.5D twin of
`large-house-isometric-v1` with a loaded plan picture on every floor. Before it
no Full Performance profile walked the backdrop (`imagePlan`) path, so the
double render of #739 K1 — every warm floor switch cleared the ready paper,
inserted the first-frame veil, probed the card background and asked for a
second full update — was invisible to CI both by time and structurally; a
temporary probe found it. The runner derives the fixture as it does for
plan-snap: `large-house-v1` plus `plan_url: '/assets/f1.svg?<space id>'` and
`plan_aspect: 1` on each floor. One shipped picture (in `demo/srv/assets` since
v1.14.0, so every base has it) under a URL of its own per floor decodes once per
floor; it covers the whole plan square and the room geometry is unchanged.
`demo/fixtures/**` and the bundle fingerprint stay as they are, and the report's
fixture counts gain `backdrops: 3`. A sample fails unless its first stable frame
has the backdrop `<image>` in the stage SVG (`docs/TESTING.md` rule 3). The
profile runs every window of the historical isometric profile; after the
`switchCycle` window and its #735 guard, before forced GC and outside every
timed and Long Task window, a structural probe makes six warm switches round the
floors and counts the `performUpdate` passes of each, from the pick until
`updateComplete` resolves `true`. Counting has to run to that quiescence: the K1
second pass starts after the first `updateComplete` has resolved, in the same
task, so a count taken right after the first `await` reads one pass on both
sides. Late updates after the frame are not counted. Each row reports
`floorSwitchPasses: { supported, perSwitch }`, and `evaluate.mjs` rejects a
candidate unless every element is 1 (`candidate: a warm 2.5D floor switch with a
backdrop took <n> update passes`, #739 AC2 and `docs/ISOMETRIC.md`). The base is
reported, not judged: bases before #739, v1.78.0 among them, take two passes.
`budgets-large-house-isometric-backdrop.json` is a copy of the historical
isometric budget that differs only in `profile`, so the twin shares every
ceiling (as #160 does); the historical profile keeps its meaning as the #124
witness. The profile runs in Full Performance only, not in the Validate smoke.

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

Two more profiles join the smoke only when the diff touches their code path
(#473, classified by `scripts/classify-changes.mjs`): `large-house-isometric-v1`
for `src/iso-*` and `large-house-interaction-v1` for `src/live-*`,
`src/render-*`, `houseplan-render-lifecycle.ts` and `houseplan-card.ts`. Both
run `--samples=3 --warmups=1` against `budgets-isometric-smoke.json` and
`budgets-interaction-smoke.json`, whose ceilings are the `hardMaxMs` values of
the full profiles. The set of profiles is part of the `performance_smoke`
reuse key, so a glow-only success never stands in for a run that needed the
isometric profile.

The interaction profile keeps strict per-series, Long Task, heap, cache and
structural limits. Its aggregate `interactionSeriesMs` ceiling is 3300 ms:
enough headroom for the observed hosted-runner baseline (up to 3122.6 ms), but
still below the known failed pre-optimization result (3501.5 ms). This aggregate
is a catastrophic guard; the full workflow's base-relative comparison remains
the detector for smaller regressions.

Its `firstStableRenderMs` ceiling is 3400 ms (#692). The full workflow's
7-sample median on the hosted runner was about 2790 ms across the 1.77 line
(2769.0 on 09-21, 2838.2 on 09-23, 2777.3 and 2801.7 on `c392ad3a`) and about
2920 ms at v1.78.0 (`7d4d75bd`: 2925.0, 2925.2 as the base). Two runs of that
one SHA differed by 7.5 % (3144.8 vs 2925.0), so the former 3000 ms ceiling
sat 2.7 % above the level and failed on noise — the 3-sample smoke of #689
read 3002.4 ms. 3400 ms is +16 % over the 1.78 level and +8 % over the worst
run in the series; the base-relative comparison of the full workflow is
unchanged and remains the detector for smaller regressions. The +4.5 % step
between 1.77 and 1.78.0 is not attributed here.

The isometric `spaceSwitchMs` ceiling is 2200 ms, shared by the smoke, the full
isometric profile and its Stage 3 dense twin (#675). The metric is one cold
floor switch that builds the second floor's 2.5D geometry, so it grows with
every 2.5D stage, and the original 1800 ms from #89 stage 1 had become the level
itself. The hosted-runner smoke median rose from 1500 ms (2026-09-09 to 09-12,
12 runs) to 1668 ms (09-19 to 09-25, 6 runs) and 1798 ms after #649 (9 runs, σ
42 ms, maximum 1867.7 ms). The median inside a run is already stable (re-run
attempts of one SHA differ by 0.4 %), separate runs of one SHA differ by up to
5.5 %, and the level itself moved by 20 %: more samples would not change the
verdict, so the ceiling is the lever. 2200 ms leaves 17.8 % over that maximum
and stays below the only real isometric regression of the window, 2719.6 ms
(#583 before its lattice fix, 2026-09-16); doubling today's level fails by a
wide margin. Occasional hosted runners are about a quarter faster, which a
ceiling does not mind. Smaller growth stays the job of the full workflow's
base-relative comparison.

The `switchCycleMs` ceilings are 950 ms for the flat family (`budgets.json`,
plan-snap, interaction and the interaction smoke) and 1550 ms for the 2.5D
family (both isometric profiles and the isometric smoke), one number per family
(#747). Since #735 the metric is the warmed twelve-switch cycle, and the former
7000 and 8000 ms sat 7.6–10.2 times above the #735 medians. The series is every
Full Performance run after #735, both sides with 7 samples — the base is
measured by the candidate runner, so it is warm too: 36821241343 (#735, base
`76558bf2`), 36838891001 (#740), 36838952536 (#742) and 36839009721 (#739), the
last three against `dev` `7ff2b5ae`. Flat medians span 666.9–812.7 ms (maximum:
`large-house-v1`, the base of 36838891001). 2.5D medians span 766.5–1333.9 ms;
the maximum is `isometric-stage3-dense-v1` in 36838952536, whose base on the
same runner read 1249.7 ms against 849.9–982.4 ms in the other runs — runner
noise of 27–47 %, which the series is meant to contain. Each ceiling is the
first multiple of 50 ms at or above 1.15 × that maximum and no higher than 1.2 ×
(the #692 band, which #675 also falls into): +16.9 % and +16.2 %. Doubling the
level fails by a wide margin. The price of one number per family is wider
headroom for the faster profiles (`large-house-isometric-v1`, maximum 1135.7 ms,
gets +36 %); it keeps the plan-snap and interaction contracts of "every original
ceiling" and the dense twin equal to the historical profile. Smaller growth
stays the job of the full workflow's base-relative comparison (unchanged: 0.35
flat, 0.2 2.5D, 250 ms noise allowance), and a floor built inside the window
already fails the sample through the #735 structural guard, not through time. No
3-sample `performance_smoke` median is in the series yet: those profiles join
Validate only on a `src/**` diff, so the first beta candidate after #747 is
their check.

The 2.5D View toggle (`viewToggleMs`) is reported by the isometric profiles but
budgeted by none of them (#720, owner decision in #694 on 2026-09-30). Switching
Flat ↔ 2.5D is a one-off General settings change, not something View or kiosk
does in use. Since #649 the runner also measures different operations across
the comparison: a full config reload with `volumetric_view` for the candidate,
a per-device projection flip for bundles before #649 (v1.77.0: 73.8 ms against
195.7 ms for v1.79.0-beta.1, run 36742783749). The 2.5D scene build stays gated
by `modelReadyMs`, `firstStableRenderMs` and `spaceSwitchMs`, a UI freeze by
`longTask.maxSingleMs`.

The dedicated `performance.yml` workflow is the full comparison. It runs on
every `main` promotion, weekly and on manual dispatch for an important beta or
performance-sensitive change. It checks out the candidate and its base SHA,
builds both, and runs them sequentially with the same Node.js 22 process
family, pinned Playwright Chromium and hosted runner. `compare.mjs` then
applies two limits:

1. a relative regression allowance against the base-SHA report;
2. an absolute safety ceiling from `budgets.json`.

Which base SHA the relative half compares against is decided by
`scripts/performance-baseline.mjs`, not by the workflow's shell (#587). A
**stable** release candidate — its head commit carries a `Release:` trailer
without a prerelease suffix — is compared against the **previous stable tag**;
everything else keeps the old base (`push before`, the candidate parent, or the
`comparison_ref` a manual dispatch names). The reason is the order the stable
gate imposes: the candidate must be on `main` before this workflow can run on
its exact SHA, so the *next* commit of the same line would otherwise take the
first one as its base and compare the line with itself — a red gate would be
cleared by any follow-up commit. The negative cases of that decision (no tag,
a tag sitting on HEAD, a base that is no longer an ancestor) cannot be exercised
from YAML, so they live in `test/performance-baseline.test.mjs` with an injected
git; the mutant `stable-candidate-compares-against-itself` puts the old
behaviour back and must be caught.

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
`Validate`. The gate (`scripts/release-gate.mjs`, #511) judges by the latest
non-cancelled run on the SHA: a re-run or a manual comparison against another
baseline refreshes the verdict, and a cancelled twin is invisible.

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

### Wall draw terminal clicks

`wall-draw-click-v1` (#461) loads the production bundle with five spaces. The
edited space contains 12 rooms, 48 positive-thickness wall atoms and four saved
open drafts, then places seven consecutive Walls segments after warm-up. A
second variant doubles remote, non-interacting room geometry. The runner fails
structurally unless every intermediate click performs zero full-space physical
checks, exactly one local physical check, reuses its wall artifact in the
junction proof, adds one history entry and queues one full-config write. The
chain finish must independently return to the full-space barrier.

The canonical Linux ceilings are 150 ms median and 250 ms maximum for the seven
base clicks; the remote median may not exceed `base × 1.5 + 20 ms`. Counters are
the primary verdict, so a fast machine cannot hide a route back through the
generic barrier. Run against a freshly synchronized bundle:

```bash
npm run benchmark:wall-draw-click -- --output=artifacts/performance-smoke/wall-draw-click.json
node demo/smoke_wall_draw_click.mjs
```

Build and copy a fresh demo bundle first, then run:

```bash
npm run benchmark:large-house -- --samples=7 --warmups=1 --output=artifacts/performance/local.json
npm run benchmark:large-house-isometric -- --samples=7 --warmups=1 --output=artifacts/performance/isometric-local.json
npm run benchmark:large-house-isometric-backdrop -- --samples=7 --warmups=1 --output=artifacts/performance/isometric-backdrop-local.json
npm run benchmark:isometric-stage3-dense -- --samples=7 --warmups=1 --output=artifacts/performance/isometric-stage3-local.json
npm run benchmark:large-house-plan-snap -- --samples=7 --warmups=1 --output=artifacts/performance/plan-snap-local.json
npm run benchmark:large-house-interaction -- --samples=7 --warmups=1 --output=artifacts/performance/interaction-local.json
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

`large-house-isometric-v1` and its Stage 3 dense twin carry
`countNoiseAllowance: 5` (the other profiles keep 3). Owner decision 2026-09-09, #507: since v1.73.0-beta.1 the
isometric renderer lives in the lazy `iso-scene-render` chunk (#160 Stage 3),
so the single v1.72.0 boot task is split into two around that import. The
load-phase work is unchanged — timings, `longTask.totalP95Ms` and
`longTask.maxSingleMs` keep their unchanged ratios and still catch real
growth — but `longTask.countP95` counts the split as +2 tasks and, with
runner jitter, sat at 16 → 20 against a 19.2 limit on the v1.73.0 stable
comparison. The allowance widens the count check alone to 16 → 21 for that
baseline; it is not a licence for more work per task.

The same two isometric profiles carry a widened **gesture** allowance:
`resizePreviewMs` 450 ms, `panZoomMs` 150 ms and `stateUpdateMs` 120 ms, held
identical on both profiles because the #160 contract requires the Stage 3 dense
twin to share every common ceiling with `large-house-isometric-v1`. Owner decision 2026-09-16, #585: the Full Performance run
of the v1.76.0 stable candidate against v1.75.0 (run 35097102695) measured
resizePreview 603 → 981 ms and panZoom 91 → 205 ms in the hidden 2.5D view.
The step is real and understood — #583 gives that view more geometry, and the
overlay-collision search still costs about twice what it did before #583, even
after the coarse-lattice speed-up. Absolute ceilings did not move (panZoom 205
against 600, resize 981 against 2200) and every user-visible profile stayed
green. The lever is milliseconds, not the ratio: it absorbs one level shift and
still gates growth from the new level. #585 rewrites the search to enumerate
obstacle boundaries instead of scanning the 48 px disc; when it lands, these
allowances go back to 150/60/75.

The `cleanFloor` entry ceiling is 100: the reviewed fixture warms exactly 100
deterministic room/physical-body entries. An extra 20 means that one complete
floor was invalidated and rebuilt, so fixture extensions must recalibrate this
ceiling explicitly instead of receiving silent cache headroom.

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

## `led-strips-v1` (#780)

`demo/benchmark_led_strips.mjs` (`npm run benchmark:led-strips -- --size=…`)
measures the LED strips on the `large-house-v1` fixture: on every floor 10 or 50
existing devices become lights shown as strips that are on — `10x5` (10 strips
× 5 points) or `50x50` — without adding a device or an icon
(`performance/led-strips-fixture.mjs`); `none` is the same build and plan
without strips. Glow on, strip radius 30 cm, viewport 1440×1000, DPR 1,
reduced motion; every sample is cold (a new browser and card), seven samples
after one warm-up. The runner fails on its own against
`budgets-led-strips.json` — the ТЗ table, median and p95: `firstStableRenderMs`
3400/5000, `warmSpaceReadyMs` 1500, `stateUpdateMs` 1000/1500, `panZoomMs` 500,
the longest pan/zoom Long Task 150 ms — of the interaction profile's camera
scenario and of a 100-step series, one wheel step per frame — retained heap
after 20 A→B→C→A cycles 64 MiB — and on exact counters: zero field geometry
recomputes over 100 unrelated HA ticks, 100 camera steps and a colour-only
change; the three caches of the shown space (`ledStats` of the runtime chunk)
— shapes ≤ 50, visibility ≤ 50, retained per-emitter fans ≤ 2500 — identical
after every cycle; after disconnect 0 retained entries and 0 live LED
timers/frames/observers (tracked by creation stack in the page); one extra
cold run holds the runtime response, removes the card meanwhile and requires
that the landed chunk renders, caches and schedules nothing for it; the LED
chunks loaded with strips and none without them, never the editor chunk in
the View. A runner with a short step limit may collect the samples in parts
(`--warmup-only`, `--samples=N --no-late-import`) and judge them with
`--merge=…` — the same cold samples, the same gates, the minimum of seven
samples after one warm-up enforced on the merged set. Base predates the
strips, so there is no relative comparison; the zero-LED View remains judged
by the relative `large-house-interaction-v1` profile. Exact-SHA Linux output
of the full performance workflow (`led-strips` matrix entry) is the gate
evidence; a local report is diagnostic.
