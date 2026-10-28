# #1098 — stairs/LED gesture and cache evidence

Original paired-evidence product: `b15126a6` (core `95eae345`), dev
`f00d02d13737077d3d7f331f537c721bc57448f4` after #1111.
Source fingerprint: `f78b25c840bd4e801b5745431fd5fecc1f246c2af4f0352569acb8713542acc2`.
Before product: `ccc62ef113c53f6de4c97e3b09ca7c1b56be9a81`, unchanged while
ordinary regression witnesses and the benchmark were prepared. Intervening
#1102 changes backend code; #1111 changes HA intake/demand. The paired journey
has no HA tick. Timings describe the complete materials; they are not an
exclusive attribution of every millisecond to #1098.

## Method and raw data

- [Before](1098-editor-gestures-before.json), [after](1098-editor-gestures-after.json),
  [unchanged Glow profile](1098-editor-gestures-glow.json),
  [verified resource cost](1098-editor-gestures-resources.json).
- Exclusive CPU windows coordinated across the three authors; Node22.23.2,
  Playwright1.62.0, Chromium151.0.7922.34 headless-shell. Golden validates the pins;
  benchmarks use the same launcher/runtime. Viewport1440×1000, DPR1/2, seven
  independent fixture resets per DPR, 30 pointermoves per gesture.
- The shared large-house fixture has3 floors,60 rooms,147 wall segments and200
  placed devices; floor1 retains250 stairs (249 originals plus the gesture stair)
  and one unbound three-point LED. Each sample resets config before measuring;
  LED movement is30 units, beyond the snap step, and every commit changes points.
- Benchmark stairs use mounted DOM PointerEvents; LED uses native browser
  capture followed by mounted DOM PointerEvents. Separate smoke_stairs and
  smoke_led_strip_draw use30 trusted page.mouse moves and judge real capture,
  transient raw state, final canonical readback and gesture cancellation/history.
- Movement timing is the complete30-frame window; dividing by30 gives its mean
  frame window, not CPU self-time. Commit timing includes existing debounce/ACK.
  Timings are diagnostic. Counter limits AC1–AC3 decide acceptance.
- Direct paired command: node demo/benchmark_editor_gestures.mjs --samples=7
  --output=report.json (before adds --baseline solely to retain the expected RED
  report). benchmark_led_strips.mjs --editor-gestures delegates to this same runner.
- Measured after runner at b15126a6 has SHA256
  `276d49a3b86d643d296d136cd167a84c470a702acac48607bb270b7bc331aaa9`.
  Reconstruct before by renaming only result.unrelatedStairPreserved to
  result.stairsRawUnchanged: SHA256
  `ccd8bb6ca9d7cca88e054c625fcc40d70e0645f5e32c88017bf9af07ee3382ec`.
  That auxiliary expression observed an unrelated first stair, is not an AC
  oracle, and was renamed for honesty. The real dragged raw record is observed
  by unit and trusted native smoke. No measured/reset/snap/capture/commit path
  changed between the reports. Fixture SHA256 in both:
  `18dec9a53eec80837a45327bc5b2722a2530d0edc5dd7baecd01cc4bda19d71c`.
- The published runner subsequently strengthens only its post-measurement error
  boundary: reportPageErrors runs after browser.close, including late teardown
  exceptions (#404/#776). Measured loops/windows remain the immutable b15126a6
  version. No errors appeared in either retained benchmark log.

## Results (median milliseconds over seven samples)

| DPR | stairs30 before → after | stairs commit | LED30 before → after | LED commit |
| --- | --- | --- | --- | --- |
|1|5500.6 →517.2|749.0 →566.1|510.9 →510.6|266.6 →100.2|
|2|5501.3 →517.1|749.5 →565.8|510.5 →510.2|250.1 →100.1|

All14 before rows: stairs union30/bodies30/innerContour600/cleanFloor600,
fullRender30/contacts.sync30/epoch30; LED fullRender30/contacts.sync30.
Every actual LED commit built union1/bodies1/innerContour20. These are RED,
not a historical successful acceptance. A preliminary no-op LED diagnostic was
excluded; its raw output remains in the local checkpoint.

All14 after rows: both move windows union/bodies/innerContour/lightBarrier0,
fullRender0/contacts.sync0/epoch0 and livePaint30. Stair commit builds cleanFloor20
(one per each of20 rooms), and no masonry; LED commit builds no clean floor or
masonry. The one-room native area/ACK smoke separately requires exactly one
clean-floor build, changed area equal to a fresh independent card, then zero on
the identical canonical ACK. Its LED/backdrop commits retain physical/contact
builds; backdrop x/y/width/height/rotation equal the independently computed new
rectangle. AC3 concerns contact graph builds; sync calls on terminal full frames
remain visible in the raw report rather than being called zero.

The native stairs smoke isolates the existing HA roster-intake stimulus from
pointer-only counters: a held existing-row tick can cause an inherited _devices
host render. It checks that preview/raw/epoch survive and the final saved step
persists, without attributing that roster route to #1111 or claiming it vanished.
The lower live-stairs anchor remains before masonry/glow; only selection chrome
uses the common upper editor root. The native DOM-order oracle judges that path.

Unchanged benchmark_glow, large-light-blend-v1,7 samples plus one warmup:
state-update medians for1/10/30/60 pools are49.5/62.8/65.8/76.1ms. It completed
with exit0 and its existing card assertions; the script reports diagnostics and
no new pass threshold is claimed. Glow/tube expectations and all timing limits
remain unchanged.

## Correctness and visuals

53 targeted units pass, including actual stair/LED runtime inputs, final-point
flush semantics, cancel without writes, unknown-field retention, the exact
consumer projection and fresh demanded stairs/backdrop/LED values. The
stale-full-model mutant is registered only; static readiness reports execution0.
The historical live-guides mutant was reanchored to preserve the same operation;
no mutation was executed. Additional raw-href/model_version assertions pass.

Native stairs, LED draw and floor-cache smokes pass. Unchanged geometry-history
refusal, LED Glow/tube, backdrop/guard, floor-cache-reuse and selective-invalidation
smokes pass. The final selected Golden captures were inspected; all have zero
pixel differences and identical PNG bytes, with no baseline acceptance:

| Scene | SHA256 |
| --- | --- |
|stairs-flat-normal-light|d012455b060beccfec1540ec18bd80701db3f0d70c7bebfb39cfdf337f9f351a|
|stairs-flat-selected-light|da75a4538e5922a49ef2c309f58306f2793e322acd78f98a386223351b82a14c|
|led-strip-design-reference-on-light|4a7a84c6d339c3487eaeeb331b07f9966bf2845b0846060125bd7b5f6909408a|
|wall-union-isolation-view-light|cd2f1f40d8d8b4d727ab0ca1b2710eade4be4fa57beed712030be5da7320e76e|

The outer HouseplanCard model cache still refreshes on epoch/config adoption;
its backdrop fingerprint remains. DemandSpaceModels wrappers read raw stairs/bg
and memoize within one read; only its physical LRU reuses the narrower key.
Summary wrappers refresh with the observed config revision and area keys retain
stairs. plan_url, plan_aspect, structural and unknown fields remain significant.

## Resources and release

Read-only accepted #1111 donor7dd01ccb has the same complete frontend source
corpus as f00d02d1. Source fingerprints match both manifests; every asset hash
and topology was verified. JS3651091→3652678 B (+1587), hostRefs6555→6571 (+16).
The owner-authorized own cost moves rolling bases3651091/6532 to3652678/6548,
retaining the inherited23-reference gap and the2000-B/25-ref bands. Absolute
loading and timing limits are unchanged. Earlier pre-#1111 cost was+1602B;
its 15-B difference after rebase is recorded, not optimized away.

v1.82.0 stairs.write/pointerMove and LED.handleMove were read: both defects are
already in stable, hence stable-fix. Persisted commands/rights/history protocol
are unchanged. E2E verdict: не надо; the parent records the accepted task impact
in houseplan-e2e after S8. No E2E harness implementation changes here.
Final resource carry rationale: https://github.com/Matysh/houseplan-card/issues/1098#issuecomment-6468411738.

## Integration after accepted #1099

Prepared source1c1c8193cde5fd2c9e83756fc114bc465fbbe1f6 rebases on accepted
31b17bec040f25224b80f0f679378807ccfd37fc. Its own A patch is byte-identical to
published72fbec41 on f00d02d1: both binary-diff hashes are
fb96b745ba68236a31651c96e4a243cd56c83b3aea92af9c82716d0dd5bb5098.
Only inherited houseplan-editor-runtime.ts and physical-candidate-proof.ts change;
package/lock/Rollup/TypeScript recipes remain identical. The accepted helper
changes Physical/Resize commit preparation, not the two measured gesture paths.

Fresh build/test-build,53 targeted units and the three trusted native stairs/LED/
floor-cache smokes pass on this tree. Native pointer counters, canonical readback,
lower-layer order and independent area/backdrop values retain their oracles.
Mutation readiness1993definitions/execution0; no mutations executed. The original
14-row timing and four captures above retain their original materials; they are
not relabelled as captures/timings of this integration. New exact CI follows the
accepted unchanged-check API repair1114; no fake visual delta is declared.

[Fresh resource proof](1098-editor-gestures-resources-31b.json) verifies readonly
accepted donor dfc2e3b7be945a876f3e4006a5ff240d454ad7d4, whose complete frontend
corpus equals31b17bec. Source/manifest fingerprints, all asset hashes and topology
match. JS3652946→3654523 B (+1577), hostRefs6557→6573 (+16). The accepted rolling
bases3651515/6532 carry only this own cost to3653092/6548, preserving inherited
1431B/25refs and the same2000B/25ref bands. This differs from the pre1099
shared-minification cost by10B; no byte optimization or timing-limit change.
Current integration source fingerprint:
d37a475302de7198cf3d1a3f18b4e50749b6420ac510a7ff25626a64dbb6c2af.