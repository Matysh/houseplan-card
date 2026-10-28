# Geometry history restoration — #1100

## Contract and source

Independent SPEC r2 is GREEN (comment6472008395), body SHA256
`b77babe0ad22cf5ccc0ce324bb6ffba7b98212df740a20ec2345f5580addac20`.
The owner selected one union when raw/canonical physical fingerprint and model
version match, at most two when they differ, retaining both safety roles.

Implementation began on accepted `21fdd42d`; the measurements below compare
accepted #1098 dev `4bb5eb42626f4efe72a20744746b8b2dc820ebc0` with candidate
`4f890a94c1c21d7f7380b31b24d429222c889a6f`. Both product files remained
byte-identical through that rebase. The candidate's later uncommitted changes
were B-only fixture corrections: the timing JSON honestly records dirty=true,
while the exact production source digest and both recipe hashes are recorded.
No unaccepted #1098 source was used, and its consumer keys are not duplicated.

Physical restoration uses accepted #1099 proof/model/adoption helpers. Raw
safety precedes canonicalization; proof is local to this attempt. Current-model
adoption visits only the edited floor; legacy roots retain atomic migration.
F57's repairable negative verdict stays negative, with an empty outbound
fingerprint requiring deferred writer revalidation. The existing decor-only
API remains the first fast lane; a separate stairs/backdrop fallback retains
complete-current-carrier, guarded, unknown-field and pending-write boundaries.

## Functional and counter evidence

Before editing, unchanged accepted source showed B/C pool keys disappearing
on physical Undo and one wall union when B was shown again. Transform and valid
straight-stair movement Undo visited canonical model/adoption three times
instead of zero. UI/storage are harness boundaries; history, journal, model,
geometry preparation, wall passes and Card cache owners are production code.

The fixed-result fixture retains twelve deduplicated documents for eleven
ordinary cases / twenty-two Undo/Redo steps, comparing exact JSON, toast, save
count, cursor and command identity. Its expected outcomes were not rewritten.
All 154 previous #845 document passports and 77 file inventory entries remained
byte-equal and ordered; only this twelve-document cohort was added.

| AC | Evidence | Negative / regression boundary |
|---|---|---|
| AC1 | Real Card B/C keys retained and B costs zero unions; `smoke_floor_cache_reuse.mjs` EXIT0, including native physical Undo and fresh-card equality | Unchanged-source RED and paired benchmark foreign-pool failures; `history-restore-clears-foreign-pools-1100` registered, not executed |
| AC2 | Current-model native backdrop/stair edit, Undo/Redo: exact document, image/frame or actual outline/arrow paths, changed room-area readback, zero physical builds; both smokes EXIT0 | Identical corrected recipes on accepted4bb fail only the two zero-build assertions each, while their document/paint/area assertions pass; pending/guarded/legacy/unknown unit cases stay strict |
| AC3 | Nine physical cases observe raw/canonical fingerprint+version, ordered checks and exact union quotas; ordinary pre-v9 inequality takes two passes | Raw/canonical negative and exception inputs refuse; `history-raw-negative-ignored-1100` and `history-different-canonical-reuses-raw-verdict-1100` registered, not executed |
| AC4 | Existing refusal suite plus real deferred writer revalidation/no-send for F57; atomic foreign-floor legacy migration; native wall-chain/node/refusal smokes EXIT0 | Negative fingerprint stays empty; exceptions retain command identity; `history-negative-becomes-outbound-proof-1100` registered, not executed |
| AC5 | Original decor-only witnesses retained, new unknown/guarded/carrier cases leave config untouched | `nonphysical-history-ignores-unknown-snapshot-field-1100` registered, not executed |
| AC6 | Paired seven cold-card and seven warm apply/inverse samples for all three large-house scenarios; 84 baseline rows RED / 84 candidate rows GREEN | Exact documents and counters are normative; no timing threshold was changed or invented |
| AC7 | Targeted102/102 and adjacent133/133 PASS; post1098 integration109/109 PASS; actual-output model invariants22/22 PASS; backend224 PASS,2381 deselected | Backend source/tests unchanged by1098, so its subset result is retained; final canonical gate/hook is pending |

Commands: `node --test test/geometry-history-restore.test.mjs test/decor-history-restore.test.mjs test/geometry-history-refusal.test.mjs test/demand-space-models.test.mjs test/clean-floor.test.mjs`;
`python -m pytest tests_backend -k "wall_node or junction" -q`.
The adjacent suite covers physical commit, draft-live preflight, Resize,
adoption aliasing, node history, draft exit and body gestures.

Addressable native commands, all EXIT0 on the candidate:
`node demo/smoke_floor_cache_reuse.mjs`, `node demo/smoke_backdrop.mjs`,
`node demo/smoke_stairs.mjs`, `node demo/smoke_wall_chain_history.mjs`,
`node demo/smoke_node_history_context.mjs`, and
`node demo/smoke_geometry_history_refusal.mjs`.

The first new native probe mistakenly compared pre-migration demo data with a
canonical restore. Both accepted base and candidate failed the same four new
assertions per smoke; these setup RED logs are retained separately. The final
AC2 scenarios use real `commitWallSegmentModel` fixture construction before
recording commands/counters, retain existing legacy scenarios, and never merely
stamp model_version or relax expected0. Stair paint reads actual outline/arrow
paths and must visibly change; a nullable group transform is not its oracle.

The production invariant checker ran on twenty-two actual runtime outputs:
references, wall keys, mixed-role records, hidden obstacles and physical
geometry all have zero violations. See [raw results](1100-geometry-history-performance/invariants.json).
Reproduce after fresh test-build compilation (no fixture expectation is used):

```sh
node --input-type=module <<'JS'
import {historyCases, historyCharacterization} from './test/helpers/geometry-history-characterization.mjs';
import {checkReferences, checkWallKeys, checkMixedRoleRecords, checkHiddenObstacles,
  checkPhysicalGeometry} from './scripts/model-invariants.mjs';
let count = 0;
for (const name of historyCases) for (const step of historyCharacterization(name).steps) {
  const config = step.config;
  const failures = [...checkReferences({config}), ...checkWallKeys(config),
    ...checkMixedRoleRecords(config), ...checkHiddenObstacles(config), ...checkPhysicalGeometry(config)];
  if (failures.length) throw Error(JSON.stringify({name, direction: step.direction, failures}));
  count++;
}
console.log(`${count} actual runtime outputs: invariants PASS`);
JS
```

Six new nightly declarations and three relocated old anchors are statically
valid; mutation execution=0 and caught=unknown. Frozen outcomes remain intact.

## Paired synchronous CPU measurements

Reproduce after fresh test-build compilation in each checkout:
`node demo/benchmark_geometry_history.mjs --output=<raw.json>`.
The same script and harness bytes were overlaid onto the immutable accepted
baseline without changing any production source. Symlinked dependencies use
the same pinned lockfile and Node22.23.2. Raw evidence:
[before](1100-geometry-history-performance/before.json),
[candidate](1100-geometry-history-performance/candidate.json),
[environment](1100-geometry-history-performance/environment.json), and
[recipe hashes](1100-geometry-history-performance/recipe.sha256).

The active floor has146 rooms (147 for the valid-stair case), plus two warm
foreign one-room floors. Cold means new Card pools on A with B/C warm; module
and process-level geometry caches are not patched/reset. Warm reuses the same
history owner. Seven samples are retained for each direction/phase/scenario.
The timed boundary is synchronous `_stepGeometryHistory` with real geometry
owners and no diagnostic deep clones. UI paint, debounce, transport, fixture
construction and post-step readback are outside it. These are workstation CPU
diagnostics, not browser frame time or measured latency on the owner's HA.
Preflight/union columns count mandatory safety wall-pass calls; renderer cache
builds are observed separately by native smokes.
| Scenario | Card pools on A | Direction | Median CPU ms before → after | Preflight/union calls before → after | B union builds before → after |
|---|---|---|---:|---|---|
| thickness | cold-active-floor | undo | 1357.91 → 716.65 | 2/2 → 1/1 | 1 → 0 |
| thickness | cold-active-floor | redo | 1374.31 → 702.69 | 2/2 → 1/1 | 1 → 0 |
| thickness | warm-active-floor | undo | 1381.72 → 718.70 | 2/2 → 1/1 | 1 → 0 |
| thickness | warm-active-floor | redo | 1380.56 → 721.33 | 2/2 → 1/1 | 1 → 0 |
| transform | cold-active-floor | undo | 62.67 → 8.48 | 0/0 → 0/0 | 1 → 0 |
| transform | cold-active-floor | redo | 64.22 → 8.33 | 0/0 → 0/0 | 1 → 0 |
| transform | warm-active-floor | undo | 64.93 → 8.48 | 0/0 → 0/0 | 1 → 0 |
| transform | warm-active-floor | redo | 66.26 → 8.42 | 0/0 → 0/0 | 1 → 0 |
| stairs | cold-active-floor | undo | 66.23 → 8.65 | 0/0 → 0/0 | 1 → 0 |
| stairs | cold-active-floor | redo | 67.23 → 8.69 | 0/0 → 0/0 | 1 → 0 |
| stairs | warm-active-floor | undo | 69.08 → 8.82 | 0/0 → 0/0 | 1 → 0 |
| stairs | warm-active-floor | redo | 72.27 → 8.62 | 0/0 → 0/0 | 1 → 0 |

Baseline exited1 with84 counter violations; candidate exited0 with no counter
violations. Every output document and save count was checked outside the timed
interval. Neither limits nor fixed delays were altered. The raw data preserve
all samples; the table reports medians without dropping outliers.

## Actual Golden captures

Pinned Chromium151.0.7922.34, Linux x64, matrix104, DPR1. Both accepted-base and
candidate captures of `geometry-view-dark-fit`, `geometry-view-light-fit`,
`stairs-flat-selected-light` and `geometry-plan-editor-dark` match their indexed
PNG SHA256 exactly, with zero differing pixels and ratio0. Every before/candidate
PNG is also byte-identical. The [raw pair](1100-geometry-history-performance/golden-pair.json)
retains build fingerprints, capture provenance, indexed hashes and metrics.
Actual PNGs/full capture logs are preserved in the task's local evidence folder;
the final selected CI producer will retain its own canonical receipt/artifacts.

There was no inherited indexed RED in these four scenes. The ledger uses
schema2 `goldenChecks` only, with no change/new intent or baseline acceptance.
The previously suspected mode-tab drift was tested rather than assumed.

## Final accepted-parent integration

The final source includes accepted dev `a054526cb676f9957f1b7a7387aad860b454594a`
and all #1097 opening-join/preview changes. Its source tree is
`79c7ac94c05846faf9f35ca3e161304cb9e8754d`. Fresh compile/build/sync passed;
the seven selected integration suites passed129/129. Actual runtime history
outcomes still satisfy22/22 model-invariant checks (see
[raw final invariants](1100-geometry-history-performance/final-invariants.json)).
Backend inputs are unchanged; the earlier224 PASS subset is retained.

The new native interop in `smoke_opening_drag.mjs` performs a real physical edit,
Undo and Redo on a canonical current-model warm T-join floor. After each history
restore the next real held opening drag preserves the opening cut, solid shoulder
and filled old aperture. The production physical-body counter is0, the local
preview constructor is1, fallback is0, and all five cache families stay unchanged.
Its cold positive counter is1 before the edit/history; only passive coverage
counters are reset after history, never geometry or retained pools. Cancel leaves
the exact restored document. This tests the non-enumerable raw join metadata's
behavior through real adoption/history, not just its field name. No product fix
was needed. [Raw interop](1100-geometry-history-performance/final-opening-interop.json).
An earlier rejected writer-promise reuse was a separate harness setup failure;
a normal public reload and fresh-demo proof precede the passing independent case.
The original #1097 native cases, including refusal/camera cases, also pass.

The measured CPU pair and four before/candidate Golden captures above remain
bound to4bb/4f; the final protected CI reruns the seven scoped native smokes and
four strict Golden checks against its exact head. No global baseline is accepted.
The optimization and measured source path are unchanged; final upstream behavior
is covered by the new native interop, integration suites and actual invariants.

## Canonical resource accounting

[Raw final resource proof](1100-geometry-history-performance/final-resource.json)
uses `bundleBytes(dist)` from `scripts/monolith-metrics.mjs`: every dist file,
including the43261-byte manifest. Both complete73-asset trees verify; all569
fingerprint inputs of the frozen #1097 donor are byte-equal to accepted a054.
Before policy total is3663304; candidate3664309: measured own cost1005 bytes.
The separate JS sums are3620043/3621048; earlier JS-only observations were
preliminary and are not the policy metric. Source fingerprints, manifest and
asset-list hashes are preserved in the raw proof.

Owner-authorized resource carry changes only the bundle reference3661873 to
3662878 in the same A commit, preserving the inherited1431-byte gap and2000-byte
band (issue comment6476116909). Other caps and all timing/functional limits stay
unchanged. Initial-view gzip357939 to357938 and lazy-editor gzip378530 to378832
pass existing bundle budgets. No byte-chasing or baseline acceptance is involved.

The remaining acceptance steps are the normal protected push, exact-head CI,
parsed handoff and independent CODE/automatic S8. This report does not substitute
for their verdict. No beta or E2E test change is included; accepted E2E impact is
«не надо».
