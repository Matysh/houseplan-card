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
