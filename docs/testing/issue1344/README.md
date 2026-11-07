# #1344: current handoff after code-review R1

The earlier material below is retained as historical evidence. It was returned by [code-review R1](https://github.com/Matysh/houseplan-card/issues/1344#issuecomment-6707351385), particularly because RAF proxies did not prove the actual visible start. No earlier “current acceptance” table is a claim about this revision.

On 2026-11-07 the owner accepted actual startup targets of 75ms demo/medium and 100ms large, with the first Layout reported separately from moving frames. The owner then explicitly instructed: “хватит оптимизаций, заканчивай реализацию, можно не следовать ТЗ буквально, небольшие превышения заданных лимитов не критичны. Главное - глобально поведение стало лучше.” The observed large maximum 102.674ms remains visible; it is not rounded down or claimed to meet the original two-visible-frame goal. No visual, cleanup, permissions or correctness assertion was waived.

## Changes addressing R1

Warm chrome now uses a bounded four-mode numeric geometry cache, including a first unvisited editor; inert offscreen native toolbar/header probes exist only after explicit editor installation and are removed in finally. Width, content/font semantics, config and API invalidate the cache. Quiet intent preload remains code-only. Real mode measurement is the fallback on a cache miss/failure.

Reader/kiosk and pre-editor View use a compact single SVG. Installed writer View retains the prepared z-slots, but ordinary pan promotes one floor-camera parent, not 19 SVGs. No forced promotion remains at rest. Target stage classes apply during running/hold; only preparation retains the source class. The full 220ms movement follows preparation, without consuming its duration.

The controller owns one RAF/token across both hold phases. A late to callback repeats the second phase until two observed intervals from publication have elapsed, with 1ms allowed for timestamp/callback phase jitter; the partial first RAF from start is excluded. Final View layout-cache key reads moved to the existing owned idle job, avoiding a 19–21ms forced Layout in the final commit. Cancel/retarget/atomic paths keep the same owner and cleanup.

## Current addressed observations

Source793dfcc7b696e70418efb25753be48b784a8a2d8 plus the recorded clock-jitter working diff; product changes after that source are only the 1ms scheduler tolerance and its unit case. Environment remains the same WSL/Chromium151, Balanced, 1280×800 DPR2, four samples of all seven routes per fixture. The JSON provenance includes source, working diff, collector/report/analyzer and raw trace hashes. Numbers use actual trace_id-linked presentation, not RAF counts.

| Fixture | Baseline max first presentation | Candidate max first presentation | Min presented changed frames | Max gap | Max moving style+layout | Max actual to→interactive |
|---|---:|---:|---:|---:|---:|---:|
| demo |92.335ms|69.658ms|13|20.747ms|2.110ms|34.472ms|
| medium |177.001ms|74.161ms|14|18.865ms|2.192ms|31.222ms|
| large |236.600ms|102.674ms|11|25.437ms|2.661ms|22.556ms|

All84 endpoints were presented before inert removal, with minimum positive margins2.041/2.991/3.830ms. No presentation links are missing and no Paint occurred inside the changed running frames. Startup Layout remains included in actual start, separately itemized rather than charged to an already moving frame. 44 selected Node cases, mode smoke and all28 to-vs-rest comparisons passed, including1280/390, overlapping and unavailable devices. Eight old golden images passed on864ab61; none was replaced. The canonical finish supplies the current S6 result, rather than treating the earlier f847643-step receipt as current.

Portable reports are in r1/: current native samples and actual presented analysis; baseline presented analysis; same-runner steady View primary results; package/measurement/metrics output; phase-linked memory summary and unchanged golden result. Full raw traces, input files, logs and negative experiments remain at the issue evidence root output/issue1344. Regenerate using measure.mjs and analyze-presented.mjs; raw trace input hashes are retained. Do not mistake a derived JSON for a raw trace.

## Ordinary View, package metrics and limits

The pan benchmark previously dispatched wheel during a busy/inert return from an editor. Both baseline and candidate were freshly measured by the corrected identical producer: wait for steady interactive View outside the timed window, then record its precondition. All14 measured pan preconditions were View / not busy / not inert. Seven samples plus one warmup, unchanged fixture and thresholds:

| Primary median | Baseline52610 | Candidate864ab61 |
|---|---:|---:|
| firstStableRenderMs|1070.7|1025.5|
| spaceSwitchMs|517.9|577.2|
| panZoomMs|33.2|33.4|
| stateUpdateMs|26.0|22.5|

Code-review R2 found an additional material regression in the same saved reports: writer View after editor installation has switchCycleMs550.1→1302.9ms (12 warm floor switches, about+60ms per switch); a separate earlier candidate run measured1336.2ms. Candidate minimum1268ms exceeds baseline maximum593ms. spaceSwitchMs517.9→577.2ms (+11.5%) points in the same direction even though it remains inside the existing75ms primary tolerance. These diagnostics were omitted from the earlier handoff summary; passing the seven primaries does not make this path unchanged. The likely cause is rebuilding hidden Plan/editor ink for each floor with installed writer split surfaces, but that attribution is a source-based hypothesis, not a measured profile. The owner was explicitly shown the550→1303ms cycle and about+60ms per floor switch, with the choice to fix or accept it, and answered: “Принять компромисс и завершить до S8”. This is a separate explicit acceptance after R2, not an inference from the earlier transition-target waiver. The current product code is retained.

modelReadyMs also rose763.5→868.5ms (earlier independent candidate824.3ms), while firstStableRenderMs improved as shown above. Entry parsing/size may contribute; the available evidence does not isolate a cause. These startup submetrics are not silently reclassified as a regression-free cold path.

Actual package→measurement→metrics reports all seven existing primaries comparable and within their existing tolerances. ZIP2062865→2073747B; all frontend gzip1237455→1248603B; initial View408765→417568B. The previous published stable attachment was not overwritten: a task-local current-runner remeasurement of its exact1.85.0 package is explicitly identified. These primary measurements describe864ab61 before the narrow controller/idle-key changes, not a fabricated latest-SHA rerun.

LayerTree and memory-infra at5267c5d: baseline and reader use one SVG, installed writer19 SVGs but only one floor gesture parent plus devices are promoted. Each has five content layers during wheel and three afterward, without promotion leakage. GPU-root wheel allocation baseline16023552B; writer17842176B; reader18366464B. phaseLinks maps actual dump events. GPU root is not summed again with its shared-images children. A geometric RGBA estimate is not an allocator measurement; this one software/headless capture does not establish real tablet GPU use.

Cold864ab61: local explicit readiness131.6ms without preload versus59.7ms after quiet preload; measured module/dependency/create/install calls are separately retained and are not an exhaustive additive accounting. No runtime was installed before explicit entry. WAN was not measured.

---

# #1344: mode-transition evidence

Accepted specification: issue #1344, revision 3, spec review round 3 accepted in [the review](https://github.com/Matysh/houseplan-card/issues/1344#issuecomment-6705434417). Current product source: 2b065ecc30dec8d6de8638540cffc07233df5b20. Earlier reports retain their own source SHA (6e5fccd7b1c150be1b4913e461318fa2d76b9dba). Baseline 52610e2100528c9e8af7bd36f71984e066f9b9c9 has the same product source/assets/backend/default large fixture as dev dd8c78da81f79a3b28a772971d2aa971fb2d5ce4. The measurement scripts and collector are taken from this task for both builds.

Synthetic local browser, Intel Core Ultra 7 155H, WSL Ubuntu/kernel 6.18.33.2, Windows Balanced power scheme (381b4222-f694-41f0-9685-ff5bb260df2e), Node 22.23.2, Playwright 1.62.0 / Chromium 151.0.7922.34. Formal runs: 1280×800, DPR 2, ordinary motion, 4 × 7 routes for each fixture. Medium uses the same parameterized builder with 12 rooms/60 devices/24 openings/60 partitions/40 columns/60 decor/0 stairs. No source fixture or timing threshold was reduced.

## Historical handoff (2b065ecc30; superseded by code-review R1)

The final addressed run uses the same viewport, browser, fixtures, collector and Balanced power scheme. Both natural/proxy and detailed trace runs cover all84routes. Every host snapshot before/after each fixture records no external busy WSL process; load snapshots are evidence, not a row filter.

| Fixture | Untraced min changed RAF / max gap | Max Lit wall time | First changed RAF / max wall delay | Final updates |
|---|---|---|---|---|
| demo | 13 / 25.2ms | 7.6ms | ≤2 / 38.9ms | 1 |
| medium | 13 / 27.6ms | 5.0ms | ≤2 / 42.6ms | 1 |
| large | 12 / 32.0ms | 7.4ms | ≤2 / 55.8ms | 1 |

The large untraced Lit wall maximum includes synchronous browser work/GC and therefore bounds JavaScript from above. In the instrumented trace its wall maximum is8.2ms; it is not mislabeled as pure JavaScript.

| Fixture | Min presented changed frames | Max presented gap | Max frame style+layout | Max actual to→interactive |
|---|---|---|---|---|
| demo | 13 | 21.687ms | 1.885ms | 18.643ms |
| medium | 13 | 22.815ms | 2.356ms | 4.408ms |
| large | 12 | 22.623ms | 2.897ms | 20.761ms |

All84terminal callbacks are linked to actual feedback before inert removal (minimum positive margin2.252ms); there are no missing presentation links and no Paint events inside changed running frames. These are current-source acceptance observations, not a guarantee under arbitrary host contention and not a new CI assertion. Read candidate-current-native-r2.json, candidate-current-trace-r2.json and candidate-current-trace-r2-presented-analysis.json for every row, input hashes and host records.

The before/after baseline remains the original accepted dev baseline. Medium/large common room/paper/decor/wall/Glow/marker-shell/face build counts stay zero. Demo retains10shell/face guard callbacks when its non-marker snapshot demand changes; no universal zero-callback claim is made. The guarded heavy stair/Plan geometry is reused while small input wrappers are reconciled.

The exact seven cold View file roles remain unchanged (initial-view-composition.json). On local demo/English routed assets, cold explicit readiness is88.4ms (module40ms, dependencies5.4ms, create20.5ms, install<clock resolution); after completed quiet preload explicit readiness is43.6ms (create21ms). The measured subcalls are not an exhaustive additive accounting of card readiness. Both cases have no installed runtime before explicit entry; the separate preload smoke covers real pointer/focus intent, no DOM/UI changes, pending spinner and poisoned editor/locale/Select retries. No WAN latency claim is made.

The current packaged pipeline at source2b065ecc30 is complete:7samples,1warmup,49diagnostic transition rows outside the same seven primary keys. ZIP +8,343B(0.404%), all frontend gzip +8,610B(0.696%), initial View gzip +7,185B(1.758%) are inside unchanged tolerances. Four timing comparisons remain incomparable because the benchmark runner hash changed. performance/measurement/metrics/package JSONs are preserved here; this internal package was not published.

All eight pre-existing golden scenes passed on the final product source with unchanged images and thresholds. Both canonical S6 attempts returned on test scaffolding/registry defects that have now been repaired; their earlier product regressions are documented below. The shared finish queue owns the final S6 receipt, code review and merge.

## Historical untraced diagnostic (6e5)

| Fixture | Baseline min changed RAF / max gap | Candidate min changed RAF / max gap | Baseline / candidate max Lit wall time | First changed RAF | Final updates |
|---|---|---|---|---|---|
| demo | 13 / 33.5 ms | 13 / 23.2 ms | 26.6 / 8.1 ms | ≤2 | 1 |
| medium | 9 / 31.8 ms | 14 / 25.2 ms | 71.1 / 4.9 ms | ≤2 | 1 |
| large | 6 / 80.8 ms | 12 / 32.9 ms | 84.3 / 6.4 ms | ≤2 | 1 |

First changed sample wall time maximum: 35.7/41.2/57.8 ms. RAF count alone is not compositor evidence. Lit wall time includes synchronous browser work/GC; it is not a pure-JavaScript CPU profile. All raw rows and timing provenance are retained in baseline-native-v2.json and candidate-final-v4.json. Medium/large scene build counters for paper/rooms/decor/walls/glow/device shells/faces remain zero. The diverse demo has 10 device shell/face guard evaluations when changing View consumer demand; these counters count template callbacks, not DOM replacement. Do not claim universal zero callbacks.

## Detailed trace and unresolved limits

The detailed trace uses devtools.timeline, blink.user_timing and disabled-by-default-devtools.timeline.frame, without screenshots. Each changed callback is matched to its enclosing AnimationFrame. Presentation is linked by **pid + args.id (Chromium trace_id)**, not by equality of begin/presented compositor sequence numbers. Chromium's [AnimationFrameTimingMonitor](https://chromium.googlesource.com/chromium/src/third_party/+/refs/heads/main/blink/renderer/core/frame/animation_frame_timing_monitor.cc#603) captures the trace_id for the presentation callback; its returned compositor frame may have another source/sequence.

The initial *-presented-analysis.json files are retained **incorrect sequence-joined derivations**. Corrected *-flow-presented-analysis.json results are the applicable derivations. The regression test supplies deliberately different begin/presented sequences, a same-sequence decoy, merged presentations, missing/zero feedback and an unrelated renderer's Layout. Presented timestamps are deduplicated, missing links stay explicit, and style/layout is limited to the matching renderer thread. Inputs and analyzer hashes are recorded.

Corrected v4: minimum presented changed frames12/12/11 (demo/medium/large), maximum presentation gaps36.583/23.188/27.622ms, maximum style+layout1.732/2.922/2.964ms. All84 terminal samples precede inert removal; actual to→interactive maximum18.824/20.297/14.679ms. Medium and large meet the stated bounds; demo retains a gap above34ms. Corrected v5 remains a negative observation: counts9/11/10, gaps32.821/32.081/26.941ms, large style/layout4.946ms and one terminal feedback7.064ms after inert removal. Neither proxy data nor relabeling accepts that run. The current-source run above supplies the final acceptance observations. In v4 no Paint occurred inside the346 changed running AnimationFrame intervals on large; startup/settling is not covered by that statement.

A separate forced-flush probe samples getComputedStyle(last marker).filter and stage.getBoundingClientRect after each changed controller frame:501samples, maximum2.4ms during motion and2.3ms atto. It includes API overhead and changes scheduling; it cannot replace the natural trace or prove cadence. New diagnostic runs record host-load/process snapshots without filtering rows or introducing an acceptance gate.

## Correctness witnesses

An earlier addressed run passed167Node cases. After canonical-S6 repairs,97repair cases and45controller/history/version/trace cases plus2registry assertions passed; these are separate addressed runs, not an invented aggregate or a final S6 receipt. All 28 held-to versus resting endpoint comparisons passed at 1280×800 and 390×844 (including unavailable/overlapping markers); thresholds remain maxChannelDelta=10/maxDiffRatio=0.0005. Tests cover exact original CSS text/priority/inert restoration, newer authored styles, effect reuse/disposal, no per-marker style mutations, both settling RAF phases with HA/camera/reduced-motion changes, latest contact synchronization, rapid cancellation/retargeting and quiet poisoned-locale import recovery. Full canonical S6 and substantive code review are separately owned by finish; these development runs are not their receipts.

Eight existing golden scenes passed unchanged: geometry View/Plan, panel Devices/Decor, panel flat stairs, selected stairs, hidden devices and room-label parity. No golden, assertion, geometry storage or HA instance was modified. Cold code/locale imports are tested against routed local assets; no WAN timing guarantee is claimed.

## Reproduction

Run from the candidate checkout with its pinned browser/dependencies; prepare each checkout through the ordinary build and bundle-sync commands first. Use distinct OUTPUT/LABEL values and keep the produced JSON/trace files. For before/after, pass each prepared checkout to the same candidate script (imports its current collector for both).

~~~sh
node docs/testing/issue1344/measure.mjs CHECKOUT OUTPUT LABEL
node docs/testing/issue1344/measure.mjs CHECKOUT OUTPUT LABEL --trace
node docs/testing/issue1344/analyze-presented.mjs OUTPUT LABEL
node docs/testing/issue1344/measure.mjs CHECKOUT OUTPUT FLUSH_LABEL --flush --fixture=large
~~~

The browser tests are demo/smoke_mode_transition.mjs, smoke_mode_endpoints.mjs and smoke_editor_preload.mjs plus the addressed opening/room-fill/LED/warm-adoption/isometric-floor/return-focus scenarios selected in the S6 request. Native witnesses live in test/mode-transition.test.mjs, editor-runtime-loader.test.mjs, i18n-runtime.test.mjs, i18n-lazy-namespaces.test.mjs, config-fingerprint-pass.test.mjs, light-barrier-pass.test.mjs and the other selected affected subsystem tests.

G follows the existing packaged candidate → performance benchmark → measurement → metrics path. Transition rows remain diagnostic, outside the seven primary keys and outside policy assertions. Timing comparison against an older runner hash is incomparable, not a claimed regression pass. Final pipeline report is recorded separately. No release is requested or published by this task.


## Repairs after the first canonical S6

Run 20261107T110912078-0ad42ac8 reported 12 failed units before code review. Product repairs: publish the accepted header/stage warm pair after the retained terminal (ResizeObserver may have consumed its last change while busy); restore the single public Area action/icon element; invalidate the opening layer when Plan exposes an orphan; retain the separate lazy Select graph while preparing its pure code before runtime construction. Dependency retries use the stable card-owned nonce across fresh editor namespaces.

97 addressed Node cases and the complete mutant-anchor applicability assertion passed after repairs. Five repaired browser scenarios passed: editor-command-latency, space-switch-transitions, View/editor permissions, warm-mode-adoption, Plan-device-landmarks. The preload witness additionally passes quiet Select dependency failure and all three distinct quiet/explicit-0/explicit-1 URLs. Native inert/hit tests/real Walls clicks replace the former CSS-only Plan pointer-events requirement; Background's CSS boundary remains asserted. The cold reload physical-SVG comparison now waits for transition rest and keeps exact equality. Stair assertions follow the shared guarded symbol; the hover-selector splitter preserves functional-selector commas. The docs-accept header-wording failure also reproduces on baseline; its retired wording checks were replaced by the existing explicit-intent/no-CI-only behavior. Thirteen mutation anchors were moved to the corresponding current behavior; their full mutation shard has not been run.

The numeric reports above retain their recorded pre-repair SHA. The full S6, final measurement evidence and code-review outcomes remain separate; development passes are not a completed-task claim. Extra probes using native marker opacity or retaining effects through to did not establish all bounds; retaining effects also failed the endpoint pixels and was not implemented.

The corrected analyzer accepts an optional fourth OUTPUT_LABEL to recalculate a historical input without overwriting its previous derivation. The cold decomposition is reproducible with node docs/testing/issue1344/cold-load.mjs CHECKOUT OUTPUT. For the packaged path, prepare a measurement request containing the recorded stable reference and actual host power scheme, call packageCandidate({root}) from process-next/lib/package.mjs, then run node process-next/catalog/measure.mjs REQUEST from that checkout. This does not dispatch a release.

An addressed inert/commit observation additionally records the actual stage ownership: presentation captures the Lit-prepared inert=true, clearing styles retains it, and the terminal Lit commit removes it. Its release observer saw finishPending=false/busy=false and resting inert=false (inert-commit-probe.json).
