# #1344: mode-transition evidence

Accepted specification: issue #1344, revision 3, spec review round 3 accepted in [the review](https://github.com/Matysh/houseplan-card/issues/1344#issuecomment-6705434417). Product source for these reports: 6e5fccd7b1c150be1b4913e461318fa2d76b9dba. Baseline 52610e2100528c9e8af7bd36f71984e066f9b9c9 has the same product source/assets/backend/default large fixture as dev dd8c78da81f79a3b28a772971d2aa971fb2d5ce4. The measurement scripts and collector are taken from this task for both builds.

Synthetic local browser, Intel Core Ultra 7 155H, WSL Ubuntu/kernel 6.18.33.2, Windows Balanced power scheme (381b4222-f694-41f0-9685-ff5bb260df2e), Node 22.23.2, Playwright 1.62.0 / Chromium 151.0.7922.34. Formal runs: 1280×800, DPR 2, ordinary motion, 4 × 7 routes for each fixture. Medium uses the same parameterized builder with 12 rooms/60 devices/24 openings/60 partitions/40 columns/60 decor/0 stairs. No source fixture or timing threshold was reduced.

## Untraced diagnostic

| Fixture | Baseline min changed RAF / max gap | Candidate min changed RAF / max gap | Baseline / candidate max Lit wall time | First changed RAF | Final updates |
|---|---|---|---|---|---|
| demo | 13 / 33.5 ms | 13 / 23.2 ms | 26.6 / 8.1 ms | ≤2 | 1 |
| medium | 9 / 31.8 ms | 14 / 25.2 ms | 71.1 / 4.9 ms | ≤2 | 1 |
| large | 6 / 80.8 ms | 12 / 32.9 ms | 84.3 / 6.4 ms | ≤2 | 1 |

First changed sample wall time maximum: 35.7/41.2/57.8 ms. RAF count alone is not compositor evidence. Lit wall time includes synchronous browser work/GC; it is not a pure-JavaScript CPU profile. All raw rows and timing provenance are retained in baseline-native-v2.json and candidate-final-v4.json. Medium/large scene build counters for paper/rooms/decor/walls/glow/device shells/faces remain zero. The diverse demo has 10 device shell/face guard evaluations when changing View consumer demand; these counters count template callbacks, not DOM replacement. Do not claim universal zero callbacks.

## Detailed trace and unresolved limits

The detailed trace uses devtools.timeline, blink.user_timing and disabled-by-default-devtools.timeline.frame, without screenshots. Each changed callback is matched to its enclosing AnimationFrame. Presentation is linked by **pid + args.id (Chromium trace_id)**, not by equality of begin/presented compositor sequence numbers. Chromium's [AnimationFrameTimingMonitor](https://chromium.googlesource.com/chromium/src/third_party/+/refs/heads/main/blink/renderer/core/frame/animation_frame_timing_monitor.cc#603) captures the trace_id for the presentation callback; its returned compositor frame may have another source/sequence.

The initial *-presented-analysis.json files are retained **incorrect sequence-joined derivations**. Corrected *-flow-presented-analysis.json results are the applicable derivations. The regression test supplies deliberately different begin/presented sequences, a same-sequence decoy, merged presentations, missing/zero feedback and an unrelated renderer's Layout. Presented timestamps are deduplicated, missing links stay explicit, and style/layout is limited to the matching renderer thread. Inputs and analyzer hashes are recorded.

Corrected v4: minimum presented changed frames12/12/11 (demo/medium/large), maximum presentation gaps36.583/23.188/27.622ms, maximum style+layout1.732/2.922/2.964ms. All84 terminal samples precede inert removal; actual to→interactive maximum18.824/20.297/14.679ms. Medium and large meet the stated bounds; demo retains a gap above34ms. Corrected v5 remains a negative observation: counts9/11/10, gaps32.821/32.081/26.941ms, large style/layout4.946ms and one terminal feedback7.064ms after inert removal. Neither proxy data nor relabeling accepts that run. Current-source measurements remain necessary. In v4 no Paint occurred inside the346 changed running AnimationFrame intervals on large; startup/settling is not covered by that statement.

A separate forced-flush probe samples getComputedStyle(last marker).filter and stage.getBoundingClientRect after each changed controller frame:501samples, maximum2.4ms during motion and2.3ms atto. It includes API overhead and changes scheduling; it cannot replace the natural trace or prove cadence. New diagnostic runs record host-load/process snapshots without filtering rows or introducing an acceptance gate.

## Correctness witnesses

167 addressed Node cases passed after the final product change. All 28 held-to versus resting endpoint comparisons passed at 1280×800 and 390×844 (including unavailable/overlapping markers); thresholds remain maxChannelDelta=10/maxDiffRatio=0.0005. Tests cover exact original CSS text/priority/inert restoration, newer authored styles, effect reuse/disposal, no per-marker style mutations, both settling RAF phases with HA/camera/reduced-motion changes, latest contact synchronization, rapid cancellation/retargeting and quiet poisoned-locale import recovery. Full canonical S6 and substantive code review are separately owned by finish; these development runs are not their receipts.

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

Final G pipeline completed at source cb5f9bce82: 49 diagnostic rows, seven unchanged primary keys. ZIP +6,015 B (0.292%), all frontend gzip +6,297 B (0.509%), initial View gzip +7,123 B (1.743%), each within existing tolerances. All four timing comparisons are incomparable because the runner hash changed. See pipeline-measurement.json, pipeline-package.json and pipeline-metrics.md/json; this is an internal package, not publication. selection.json records 642 selected S6 steps and the explicit full-fast-Node fallback for the unclassified host/runtime and addressed diagnostic scripts; no missing unit is silently counted as a pass.

## Repairs after the first canonical S6

Run 20261107T110912078-0ad42ac8 reported 12 failed units before code review. Product repairs: publish the accepted header/stage warm pair after the retained terminal (ResizeObserver may have consumed its last change while busy); restore the single public Area action/icon element; invalidate the opening layer when Plan exposes an orphan; retain the separate lazy Select graph while preparing its pure code before runtime construction. Dependency retries use the stable card-owned nonce across fresh editor namespaces.

97 addressed Node cases and the complete mutant-anchor applicability assertion passed after repairs. Five repaired browser scenarios passed: editor-command-latency, space-switch-transitions, View/editor permissions, warm-mode-adoption, Plan-device-landmarks. The preload witness additionally passes quiet Select dependency failure and all three distinct quiet/explicit-0/explicit-1 URLs. Native inert/hit tests/real Walls clicks replace the former CSS-only Plan pointer-events requirement; Background's CSS boundary remains asserted. The cold reload physical-SVG comparison now waits for transition rest and keeps exact equality. Stair assertions follow the shared guarded symbol; the hover-selector splitter preserves functional-selector commas. The docs-accept header-wording failure also reproduces on baseline; its retired wording checks were replaced by the existing explicit-intent/no-CI-only behavior. Thirteen mutation anchors were moved to the corresponding current behavior; their full mutation shard has not been run.

The numeric reports above retain their recorded pre-repair SHA. The full S6, final measurement evidence and code-review outcomes remain separate; development passes are not a completed-task claim. Extra probes using native marker opacity or retaining effects through to did not establish all bounds; retaining effects also failed the endpoint pixels and was not implemented.
