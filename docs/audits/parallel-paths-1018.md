# Parallel paths and diagnostic coverage (#1018)

The issue body is the accepted specification. The manual author audit
is `parallel-paths-1018.json`: each entry records the historical change, prior
path, current references, decision/reason and source anchors at its explicit
candidate SHA. Generate the current history table without inferring semantics:

```sh
node scripts/parallel-path-audit.mjs --sha=<40-character-SHA> --base=v1.80.1 --stable=v1.81.0,v1.82.0
```

The [complete named disposition](parallel-paths-1018-disposition.md) is pinned
to task material `3d7d38e781684019d901dee23abf006a2e9a2a78`: 76 candidates,
73 KEEP and three historical REMOVED records for the one onOpacity subsystem.
All 19 earlier needs-witness entries now name concrete existing witnesses and
distinct current consumers/states; their saved execution outcomes retain the
separate a34f capture SHA. The final history delta includes accepted
#1051/#1046/#1054/#1004. Seven witness records now differ from frozen a34f source
and say so explicitly; their actual normal 72-test follow-up retains its
separate f8 material.

The main list is every fix/refactor with non-i18n text src additions > 0 and
additions ≥ 3 × deletions in that range. It separates the two stable cycles
and unreleased changes. Explicit seeds include all six verified dialog
composition commits and the wall/overlay/stairs/runtime changes in the request.
The prelude's seventh dialog commit was not found; none is invented. Three
additional migration commits trace the actual General/Space/Room removal of
onOpacity callers. New commits without a recorded review stay needs-witness;
a frozen semantic decision is never silently promoted to a later candidate.

The first cleanup, isolated in `f8ce07b3bc4fb8f782cfa2ae5e5c42cb8441e0d8`, removes
only the shared top-level colorField/colorTile onOpacity option, conditional
callback and numeric fallback. #948 deprecated that branch; #945/#946 removed
its remaining Space/Room callers. The fresh post-#1051 AST inspection found ten
literal calls, no legacy callback and no spread argument. The new nested
inputs.onHex/onOpacity(raw), real numeric inline field, atomic picker, percentage,
reset, disabled and cancel/Save/reopen remain. Only the removed ColorTile numeric
branch produced tile-meta/unit descendants, so its five CSS blocks/six selector
branches were retired in the same commit; generic and ColorField CSS stays.
The [first-cleanup proof](parallel-paths-1018-first-cleanup.json) records matched
clean fda→f8 source−1535B/−19lines and production editor−1077raw/−217gzip, four
unchanged normal smokes and72meaningful units. It does not transfer a34f coverage
counters onto the new source or claim final combined CI before it runs.

Keep the general boolean operation behind proved local boundary reuse: its
inputs include cases for which the fast path returns no proof. Keep generic
isometric placement for floor/raised planes and arbitrary callers. Keep stairs
defaultStair and snapStairToStairs, which stairs-box/stairs-editor still call.
The old View card-local import/slot ownership was already removed; current
ViewRuntimeCode/Boundary, summary code caching and guarded retry states remain
distinct. All other listed candidates are retained with named consumers/states;
future unreviewed candidates still need inspection, never removal merely because
coverage is absent. Broader CSS work remains #1019; config sunset #1015.

Run the complete computed diagnostic inventory from a clean checkout at an
explicit SHA (the before-cleanup run is a separate material from its later
cleanup delta):

```sh
npm ci
npx playwright install chromium
node scripts/coverage-diagnostic.mjs --sha=<40-character-SHA> --out=artifacts/diagnostic-coverage-<unique-run>
```

The same command runs in a separate read-only nightly job on the nightly
intent's pinned candidate, with 135-minute job/105-minute collection bounds
(including preparation), a reserved 15-minute always-upload step,
per-case timeouts, at most four units/two smokes/one Golden process and a
4-GiB retained compressed-payload bound and one-day artifact retention. The first
Windows run measured 364 MiB after about 420 of 980 cases, proving the initial
512-MiB bound insufficient. That run is retained as incomplete; the full repeat
uses pinned Linux/WSL Node, browser attestation and an isolated Rollup native
runtime via NODE_PATH. Product thresholds remain unchanged. The diagnostic
smoke timeout is read from the canonical validate-product runner (180 seconds),
and history subjects are read from one pinned Git log before candidate selection.
Every product unit, every
demo/smoke_*.mjs and every Golden scenario/variant comes from the existing
computed registries. Golden capture is a coverage input; it never accepts PNGs
or updates baseline indexes. Existing performance thresholds remain unchanged.

run.json/inventory.json record expected cases and every result/exit/time;
expectedPins are expectations, not confirmed runtime versions. identity records
bounded Python command/version probes for PYTHON/platform selection and the
independent literal python3 consumer. A probe is labelled probed, a failed probe
unknown; neither claims that every Python child was observed. Separately saved
process observations describe only the children actually seen on that material.
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

The actual Node preload/exit fixture is a no-browser tooling unit. Its real
Chromium page/navigation/retry/close counterpart is
`demo/smoke_coverage_recorder.mjs`, selected by the canonical changed-smoke
entry and included in the computed nightly inventory. Its pages use the common
watchPage/closed-browser error verdict. It retains every original browser assertion and attests the actual
launched browser; moving that witness does not weaken it or install Chromium
in the lightweight tooling partition. This post-capture B correction does not
change the immutable a34f inventory or its recorded outcomes.

The historical a34f run completed all 980 attempts, but its original dist maps
escaped to ../src because the TS plugin interpreted outDir-relative sources
against the original module. Its 498 valid maps proved structure/bounds only;
the original browser-to-src mapping is insufficient. The real nested Rollup/TS
fixture is red on that producer and green with explicit compiler sourceRoot.
The current index rejects an escaping source instead of silently treating it
as a dependency. The one-time `scripts/coverage-reproject-1018.mjs` supports
only that frozen recipe. It checks every captured JS/map and raw receipt, reads
the exact a34f Git blobs, checks every current AST byte, and repairs a source
binding only when its declared path relation and exact tracked path/content
agree. Only sources/sourceRoot metadata changes; mappings, offsets, names and
source contents remain equal. A fresh derived index/report names both the
capture SHA and the committed projector recipe. It executes no scenarios and
does not overwrite the original run or turn its failures/unknowns into PASS.
The [full before capture and projection](parallel-paths-1018-before.md) records
all 980 actual outcomes, the seven unsuccessful cases, 1337 unknown reasons
(1298 prior reasons plus 39 explicitly foreign-reference scripts),
exact runtime/byte receipts and bounded commands for the saved positive map.
