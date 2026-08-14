# Code review #156 — r1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/156
- **Reviewed branch:** `issue/156-full-performance`
- **Reviewed implementation:** `09143e23a6f81491a2e3ed79e20e393031514510`
- **Base:** `321d153c22dfe2087e31437720919f872d9cd47c`
- **Reviewer:** Codex, self-review by explicit owner exception
- **Decision:** owner instruction in issue comment
  https://github.com/Matysh/houseplan-card/issues/156#issuecomment-5297318210

## Verdict

**Green · exceptional self-review · High: 0 · Medium: 0 · Low: 0.**

The normal independent-review requirement is intentionally bypassed only because
the owner ordered this agent to implement, review, close #156 and finish the
release while Claude/status automation is unavailable. This document records the
actual review; it does not present the exception as ordinary process compliance.

## Scope and diff audit

The implementation changes only the two hot paths established in the issue:

1. `physicalBodyParts()` builds raw bodies and junction patches without the
   unused polygon union. `physicalBodySet()` remains the explicit union API and
   retains the existing geometry tests. Full/static runtime consumers use the
   parts-only path; the runtime cache no longer stores an unread `geometry`.
2. Plan snap static topology is guarded by immutable snapshot identity. A single
   dedicated active marker owns pointer-dependent presentation. Before the first
   click `_cursorPt` remains null and pointermove updates that marker without a
   parent Lit update; click still runs the canonical resolver from event
   coordinates. After an anchor exists, the existing reactive rubber-band path
   remains authoritative.

No performance budget, fixture, sample count, compare policy, schema, backend,
i18n, dependency or HA call path changed. Both localized changelogs are present
in the same user-visible implementation commit. Generated bundles are the direct
output of the reviewed source.

## Correctness review

- Raw body arrays and join patches are byte-for-byte structurally equal between
  the parts-only and explicit-union APIs; only eager materialization is removed.
- The active snap marker is presentation-only. Snap geometry and commit
  coordinates remain model-derived through `resolvePlanSnap()`.
- An external Lit render reconciles the marker from `_planSnapHover`; the direct
  DOM handle cannot become a second source of geometry truth.
- Endpoint and line styles remain distinguishable (`active` versus
  `active dynamic`), both keep the 10 cm radius, and inactive state removes
  candidate metadata and hides the marker.
- The shared clear path covers pointerleave, navigation, mode/tool changes and
  gesture cancellation. Existing smoke coverage for those transitions remains
  green.
- The static topology guard depends on the immutable geometry object plus the
  physical radius. Structural invalidation already replaces the geometry
  snapshot, so cached SVG cannot outlive a config/space/active-draft change.

## Verification evidence

- `npm run typecheck` — passed.
- `npm test` — **804/804 passed**.
- `npm run build` — passed.
- `node demo/smoke_plan_snap_overlay.mjs` — passed, including:
  - `initialHoverAvoidsFullCardUpdate: true`;
  - `initialHoverCyclesCandidateKinds: true`;
  - `initialHoverKeepsStaticNodeIdentity: true`.
- `npm run benchmark:large-house-plan-snap -- --samples=3 --warmups=1
  --output=.codex-perf-156-plan-snap.json` — passed locally; median
  `planSnapPointerMs=198.0`, `switchCycleMs=1878.9`.
- `npm run benchmark:large-house -- --samples=3 --warmups=1
  --output=.codex-perf-156-ordinary.json` — passed locally; median
  `spaceSwitchMs=185.9`, `switchCycleMs=1580.2`.

Local timings are diagnostic only. A green exact-SHA Linux Full Performance run
after integration remains mandatory release evidence.

## Release decision

The implementation is acceptable for integration and an additional beta under
the owner's exception. Stable publication remains blocked until the same final
SHA has green Validate and Full Performance runs and all stable release assets
pass the runbook checks.
