# Save accepted-cache cost — #1153

This is a bounded follow-up to the preserved [2026-10-30 investigation](../save-long-tasks-2026-10-30/README.md). Historical CI failures and the owner's beta.5 decision are unchanged. All fixtures are synthetic.

## Evidence boundary

Baseline source: `de1043f3a3b45c3aa30016a7181cf227ff352713`; bundle fingerprint `b7275456516c49886ec7c620f0c93ae69f21c0a35e7c5106b9802bf12ab3210a`. Node22.23.2, Chromium151.0.7922.34/rev1234, Playwright1.62.0, Ubuntu WSL. Raw records include actual CPU/kernel/load. These local results do not establish the cause of the old CI failures, prove a normative timing PASS, or represent actual HA/GPU acceptance.

The original helper owns native input→single config write→accepted rendered DOM→persisted value. No input/paint boundary, first sample or fixture was removed. `cold` in the measurement means the first Save of a case in each fresh browser round, not first application load. Instrumented CPU, inclusive method timings and unprofiled native series are separate measurements.

## Baseline findings

15 profiled Saves: fingerprint descendants208.0ms sampled CPU, remaining contact-sync descendants203.8ms, other637.5ms, only within trace-anchor matched input→paint windows. Categories are disjoint; sampling is not wall-time. `bounded-costs.json` includes all windows, source ranges and top25 other self-time frames (program101.5ms, toggleAttribute35.0ms, further DOM/Lit/geometry work), not an unexplained total alone.

A separate inclusive probe observed contacts.sync208.4ms/30calls, stageConfigCandidate58.1ms/15, acceptConfigWrite71.5ms/15, nested rememberAccepted41.6ms/15. StructuredClone measured16.7ms total,8.8ms within accepted-cache. Nested method totals overlap and must not be summed. Thus removing clones is neither justified nor safe.

Unprofiled control: 3 fresh browser rounds×3cases×5Saves=45 samples. First/warm client medians (ms): room-name89.5/69.7; room-paint73.4/68.7; visible-bg63.9/57.8. Actual gate maxLongTask first/warm (ms):100/85,76/79,63/61 respectively. The separate direct production acceptConfigWrite benchmark performs one100call warmup, then5×100 evolving full candidates; baseline median1.75292558ms/call. Each call still hashes, deep-clones the accepted snapshot and captures the revision.

## Chosen change and limits

`acceptConfigWrite` already computes a fresh candidate fingerprint. It now supplies that exact value to the private cache helper in the same synchronous call; no await or external callback intervenes. It does not trust an earlier stage fingerprint. Every subsequent acceptance hashes again, even for the same mutated object. Other cache-helper callers retain their old hash calculation because their replacement callbacks have not been proven mutation-free. Config/layout deep copies, matching revisions, optimistic refusal/rollback/CAS/history and serialized writes remain unchanged.

No contact DOM/metric invalidation is skipped. Canonicalization makes a candidate clone, so an identity fast path at stage would not prove a normal Save benefit. Broader stage/layout fingerprint reuse from review improvements remains outside this narrow change.

The addressed selective-invalidation benchmark retains its existing117ms paint/200ms history bounds. The local three-case/DPR1 subset (baseline max100ms) and one eliminated hash do not justify lowering the old full CI matrix to100ms, whose historical observed values reached117ms. Only the obsolete beta.5-only comment is clarified; no threshold is changed or exceeded result waived. The current release runner and last-stable comparison remain defined by root PROCESS. A full old Validate or846-case repeat is not added.

## Reproduce

From the intended immutable source, install the pinned dependencies without retired hooks and prepare the product/demo and test modules. Run from repository root:

```sh
node docs/analysis/save-long-tasks-2026-11-02/measure.mjs baseline
node docs/analysis/save-long-tasks-2026-11-02/profile.mjs
node docs/analysis/save-long-tasks-2026-11-02/analyze.mjs
node docs/analysis/save-long-tasks-2026-11-02/probe.mjs
```

`measure.mjs <simple-label>` writes its full source/environment/manifest/native samples and direct acceptance series below ignored artifacts/save-cost-1153-LABEL. It does not assert a new global timing budget. `profile` and `probe` write separate ignored folders. Analyze a profile only with its matching served bundle, identified by the saved manifest; gzip originals may be extracted outside this tracked package. Profile/probe results are diagnostic and are not wall-time comparisons with the unprofiled series.

`provenance.json` binds archived bytes and raw lengths/hashes. The original profile/trace, samples, bounded attribution, separate method samples/costs and unprofiled baseline are retained. The same procedure completed on immutable product commit `5f53abd26033c87718b355291c26616c511edc4e`; `candidate-measurement.json` and `comparison.json` retain all results. This measurement is research evidence, not a claim that task S6 or the full CI matrix has passed.

## Before / after result

The production acceptance micro median is 1.752926→1.364488ms/call (-22.16%). Baseline series1.729–1.893ms and candidate1.196–1.407ms do not overlap. Environment versions/CPU/kernel match; only src/config-adoption.ts changed among product/fixture/helper/toolchain inputs. No old staged hash, clone or authority check was removed.

| Native Save | Before first / warm median ms | After first / warm median ms | Before maxLongTask first / warm | After maxLongTask first / warm |
| --- | --- | --- | --- | --- |
| Room name |89.5 /69.7|85.3 /69.9|100 /85|104 /77|
| Room paint |73.4 /68.7|68.1 /67.1|76 /79|69 /80|
| Visible background |63.9 /57.8|64.5 /56.6|63 /61|64 /60|

All45native saves on each source were single-write/persisted and retained the helper's geometry/contact/model invariants. The direct accepted subpath improved; total Save differences are small and mixed. In particular, first maxLongTask increased100→104ms despite a lower name median. That raw outlier is retained, and no universal whole-Save speedup or CI causality is claimed. The existing117ms addressed bound is not raised; returning100ms is unsupported even by this candidate subset. These data do not turn the historical full CI failures into passes.
