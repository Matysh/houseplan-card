# #906 ordinary author evidence — 2026-10-15

This is implementation evidence, not an independent review or owner/GPU
acceptance. Issue labels remain the status authority.

## Material and toolchain

- Original product: `eda7fabd6122accc5ca32f466ab96feaba191ab7`, a detached
  baseline worktree. `git diff --exit-code -- src` returned 0. Only the test
  fixture and its compilation inclusion were added there, not product guards.
- Implementation `91ea9820`, rebased to `d826803e`. The only intervening dev
  commit is `7df147ed` (SPEC-REVIEW-912 + INDEX). `git range-diff` reports the
  implementation patch unchanged (`=`); there is no source delta from rebase.
- Node22.23.3, Python3.14.7, Playwright1.62.0, pinned Chromium151.0.7922.34 /
  headless-shell revision1234: `toolchain-pins --check` PASS.
- Baseline and fixed work-count test files have the identical SHA256
  `7ff7c550e9a0439274658a36288da35147672cfe09628a676f4a58bc8b767746`.
  The original-version run selects the compiled-overlay test; later AC2 tests
  require the new helper and are not claimed to run against the old version.

## AC witnesses and negative controls

| AC | Ordinary evidence | What makes it red |
| --- | --- | --- |
| AC1 | Compiled actual overlay render with provider nodes lacking direct deviceId; exact placements and parent route checked. Baseline: initial4 / repeated4 registry enumerations, exit1. Fixed: initial4 / repeated0, exit0. Same fixture/hash and command. | Unchanged original product fails the repeated-work assertion with `4 !== 0`. Declaration `zigbee-mapping-discards-semantic-reuse` targets that oracle. |
| AC2 |22 tests: clean same/new wrappers; isolated revision0 entity/device material changes; empty rows; access/authority/revision/error/freshness; marker binding/visibility/permission/floor; provider data/revision; same-connection user/permission changes and A→B→A. Each invalidation equals fresh exact mapping. Scalar wrapper reuse and post-render lifecycle also executed. | Referential reuse assertions and fresh-map oracle distinguish stale placement. Entity-only discovery explicitly removes the old exact child owner without changing device rows or revision. Declarations `zigbee-mapping-ignores-entity-material` and `zigbee-mapping-ignores-user-owner` name the corresponding guards. |
| AC3 | All7 selected existing native smokes PASS, including hover, screen-space resize/endpoints, room signal ownership and tooltip coexistence. No threshold, TTL, routing resolver or scan transport source changes. | Existing native assertions remain unchanged. Work-count evidence above, not an invented latency measurement. |

The compiled overlay unit executes Lit's Node-supported class/render and
post-render hook. It supplies provider/registry state, not DOM geometry or
private ACK/cache acceptance values. It observes the production mapping result;
actual browser positioning is witnessed separately by the existing native suite.

Commands (from the appropriate worktree):

```text
npx tsc -p tsconfig.test.json
node scripts/fix-test-build.mjs
node --test --test-name-pattern="compiled overlay" test/zigbee-mapping-memo.test.mjs
node --test test/zigbee-mapping-memo.test.mjs test/zigbee-topology.test.mjs test/zigbee-provider-routes.test.mjs test/zigbee-topology-runtime-routes.test.mjs test/ha-binding-status.test.mjs
```

Targeted union:95 passed,0 failed. `npm run gate:small`: exit0,142s,
all required stages green (build/typecheck, npm test, bundle integrity/budget,
source hygiene, unused/coupling and smoke selection). No budget was changed.
Local raw stdout and real process exits are paired under `artifacts/906/`
(`baseline-final`, `fixed-final`, `targeted-final`, `gate-small`). They are
not substituted with a truncated tool-output status.

## Smoke selection — every row run

`smoke-select --base origin/dev --head HEAD` selected exactly7; all returned0:

- `smoke_controls.mjs`, `smoke_device_hit_capsules.mjs`: broad DevItem matches,
  run as neighbouring controls/hit-target regression checks, not a new feature.
- `smoke_zigbee_topology_hover.mjs`: direct overlay mapping/hover consumer.
- `smoke_device_signal_settings.mjs`, `smoke_device_signal_topology.mjs`,
  `smoke_device_signal.mjs`, `smoke_zigbee_tooltip_layout.mjs`: registered
  topology consumers, including physical-radio room ownership, resize and
  neighbouring tooltip layout.

Raw+exit pairs: `native-controls`, `native-hit-capsules`, `native-hover`,
`native-signal-settings`, `native-signal-topology`, `native-signal`,
`native-tooltip`. The existing browser launcher attests the pinned browser.

## Scope, risks and remaining pipeline evidence

Async: no new requests/timers; existing provider retirement clears this
one-entry memo. Data/permissions: exact same-connection user/permission and
revision0 invalidation tested. Geometry: mapping/route result and existing
native resize endpoints unchanged. Visual: no styles, thresholds or raster
changes; native neighbour checks pass. Volume/performance: constant-size key,
no registry hash/traversal on a hit, bounded one entry, immutable collection
identity follows the existing contract. Host/input: native mouse topology and
existing pointer gates retained; no new touch surface.

`mutation-gate --check`: exit0, definitions1593, execution0, caught unknown
(nightly only),5 pre-existing registry warnings. No mutant was executed.
`process-gate --range origin/dev..HEAD --issues --report`: PASS,0warnings.
No Python, geometry invariant or new benchmark series is required by this
delta. Local golden was not run without a ci:golden label; any automatic
render-risk/golden check on the sealed review material remains a pipeline gate,
not a waived result. Independent code review/merge and beta publication are
still required; this author note does not assert S8 or a released version.

## Resumed technical return after accepted #912 — 2026-10-15

Both dependencies were observed before resuming: #912 `S8-merged` at accepted
dev `50061947a3ee28486799a0f5300967952eac12dd`, and #909 `S7-code-review`,
freeing the third active implementation slot. Resume claim: issuecomment-6198403242.
The earlier RED `artifacts/906/gate-after-900-context.*` remains historical:
raw1/194605ms, seven native PASS, old editor ceiling exceeded by 82 bytes.
It is not relabelled GREEN or reused as proof of this material.

Frozen `194aeb0b` was normally rebased onto the accepted dev. The only manual
conflict was the overlay render: keep the #906 memo over the raw topology array,
then the accepted #912 configured-topic filter, with both hover and involved
consumers reading `selected`. Pure `src/zigbee-topology.ts` and the complete
memo test are byte-identical to frozen194a (`git diff --exit-code`, raw0).
The overlay difference from it is exactly the accepted #912 topic property and
post-mapping filter/consumers; authority/user invalidation was not changed.
The three own declarations and DEVELOPMENT block remain outside the shared top
append hotspot in the original implementation commit.

One separate budget-only commit `63354a6d` adopts precisely the shared measured
batch centre `bundleBytes: 2940437`, approved in
[owner decision6197386516](https://github.com/Matysh/houseplan-card/issues/911#issuecomment-6197386516).
It changes no other value: editor265955, both2000-byte bands and all remaining
limits stay unchanged. This allowance is not a measurement of a future SHA.

Fresh executions on `63354a6d80c37faa7f1a28e1df37a8d2abc85d90`:

- `npm run gate:small -- --smokes --jobs=1`: PASS226s, true exit0/225817ms,
  17:40:55.795–17:44:41.612UTC. Build/typecheck23s, unit stage163s,
  lint6s, all hygiene/integrity/budget checks PASS. All seven selected native
  consumers above PASS (2/3/4/4/5/11/5s); bundle-sync precedes their execution.
- The five-file compiled unit command above:98/98 PASS, raw0/152ms, with
  the same22 memo cases and new accepted runtime neighbours. The actual overlay
  again reports initial4/repeated0 enumerations with exact placements/routes.
- `mutation-gate --check`: PASS/raw0/1033ms, definitions1610,
  unique-source-reads832, execution0/caught unknown, five existing warnings.
- `process-gate --issues --report`: PASS/raw0, four commits, zero warnings;
  `git diff --check origin/dev...HEAD`: raw0.
- `unused-locals-gate`: PASS/raw0/5748ms; actual fresh bundle2938435 bytes,
  delegates145 / portMembers352 / hostRefs5352 / portPrivates102 /
  harnessPrivates101. The shared2940437 centre is not raised again.

Full command stdout/stderr and true child exits are paired as
`artifacts/906/resume-{gate,scoped,static,process,unused}.*`. A later docs-only
commit records these receipts; the final ordinary push hook runs on its own
exact material and is reported in the issue handoff, not predeclared here.
The old ordinary baseline/fixed counts, raw, verdict anchors and AC table remain
unchanged. No source/compiled/manual mutant was executed, no new issue created,
no independent code verdict, owner/GPU acceptance or merge is claimed here.
