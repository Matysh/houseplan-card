# Parallel paths and diagnostic coverage (#1018)

The issue body is the accepted specification. The frozen manual author audit
is `parallel-paths-1018.json`: each entry records the historical change, prior
path, current references, decision/reason and source anchors at its explicit
candidate SHA. Generate the current history table without inferring semantics:

```sh
node scripts/parallel-path-audit.mjs --sha=<40-character-SHA> --base=v1.80.1 --stable=v1.81.0,v1.82.0
```

The main list is every fix/refactor with non-i18n text src additions > 0 and
additions ≥ 3 × deletions in that range. It separates the two stable cycles
and unreleased changes. Explicit seeds include all six verified dialog
composition commits and the wall/overlay/stairs/runtime changes in the request.
The prelude's seventh dialog commit was not found; none is invented. Three
additional migration commits trace the actual General/Space/Room removal of
onOpacity callers. New commits without a recorded review stay needs-witness;
a frozen semantic decision is never silently promoted to a later candidate.

The first selected cleanup is the shared colorField/colorTile onOpacity option,
conditional callback and separate numeric input. #948 deprecated that branch;
#945/#946 removed its remaining Space/Room callers. Product forms now use
atomic hp-color-opacity-change. Check callers again after #1051 S8 before the
separate product commit. Preserve atomic color/alpha updates, percentage label,
reset, disabled, cancel/Save/reopen and the current picker itself.

Keep the general boolean operation behind proved local boundary reuse: its
inputs include cases for which the fast path returns no proof. Keep generic
isometric placement for floor/raised planes and arbitrary callers. Keep stairs
defaultStair and snapStairToStairs, which stairs-box/stairs-editor still call.
The old View card-local import/slot ownership was already removed; current
ViewRuntimeCode/Boundary, summary code caching and guarded retry states remain
distinct. Other candidates are retained or need witnesses, never removed merely
because their coverage is absent. CSS work remains #1019; config sunset #1015.

Run the complete computed diagnostic inventory from a clean checkout at an
explicit SHA (the before-cleanup run is a separate material from its later
cleanup delta):

```sh
npm ci
npx playwright install chromium
node scripts/coverage-diagnostic.mjs --sha=<40-character-SHA> --out=artifacts/diagnostic-coverage-<unique-run>
```

The same command runs in a separate read-only nightly job on the nightly
intent's pinned candidate, with 90-minute job/75-minute collection bounds,
per-case timeouts, at most four units/two smokes/one Golden process and a
512-MiB retained compressed-payload bound. Every current product unit, every
demo/smoke_*.mjs and every Golden scenario/variant comes from the existing
computed registries. Golden capture is a coverage input; it never accepts PNGs
or updates baseline indexes. Existing performance thresholds remain unchanged.

run.json/inventory.json record expected cases and every result/exit/time;
build-index.json and build/ retain final JS/maps, byte hashes, actual src and
sourcesContent hashes, product manifest and recipe. Normal and diagnostic JS
and manifest must agree byte for byte; normal output is restored independently.
Raw native Node V8 samples, inspector-captured actual compiled source and
Playwright samples are losslessly compressed per case. Source URLs are accepted
only after actual script bytes match; query retries share identity only then.

The preload starts before Node entry, wraps Chromium launch/connect and each
context/newPage, checkpoints before explicit navigation and saves before page,
context or browser close. Direct owners outside demo/serve use the same hook.
Popup/unsolicited navigation with no proved early checkpoint, missing recorder,
foreign browser/map/source/JS, crash, timeout, cancellation and a partial
inventory are incomplete with reasons. Partial positive witnesses are useful;
unobserved or invalid data stays unknown. report.json/report.md expose file/TS
function inventory and native V8 function/block ranges with unit/smoke/golden
columns. Counts are maximum observed witnesses, not summed calls or branch
semantics guessed from TS text. A zero is shown only with complete successful
inventory/provenance, and still does not authorize deletion.

This artifact is diagnostic only: no ci-proof-registry, release evidence,
mutation witness, gate or semantic PASS. Slow instrumented performance cases
remain failed/incomplete diagnostics. Nightly uploads partial artifacts even
on failure; manual runs return exit 2 when incomplete. Raw/maps remain ignored.
