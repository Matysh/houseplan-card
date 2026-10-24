# Full before diagnostic for #1018

This is diagnostic evidence for a frozen historical source, not product CI,
release evidence, mutation execution, semantic PASS or permission to delete code.
The accepted issue body remains the scope. Before counts belong only to
`a34f5806c5dbbfbe72fc6909915e35c0a67f47de`, not the later cleanup bytes.

The capture executed the complete computed inventory once in WSL Ubuntu 24.04:
332 product Node-unit invocations, 423 browser smokes and all 225 Golden
scenario/variants. All 980 unique invocations actually started. Outcomes were
973 completed, six failed, one timeout; no skipped/cancelled cases. Golden was
capture only, with no baseline acceptance. Duration was 80.24 minutes. All eight
preparation/restore steps completed and normalRestored=true, with no run-level
issues. Completed is the process status, not an assertion that every optional
backend path ran.

Node was `/home/sergey/.nvm/versions/node/v22.23.3/bin/node`, Linux x64, Rollup
4.62.2 with its isolated Linux native module via NODE_PATH. Browser recorders
retain actual Chromium attestation (Playwright 1.62.0 / Chromium revision 1234,
151.0.7922.34). The before manifest hash is
`b7b4c5f031c855114795daaab6c41040a23bf605a2082badcac8b64085c797cd`;
all 63 normal/diagnostic JS files and manifest were byte-identical and the
ordinary output was independently restored.

The retained raw material contains 5247 gzip payloads, 1,269,833,236 bytes.
Its sorted receipt-list SHA-256 is
`ea26481aa65018f9dcaca1b60d206e033ea00449995b7df6d374c0d803d92c3a`.
Raw, captured JS/maps, stdout/stderr and the original 84,406,663-byte report stay
in ignored `artifacts/coverage-before-1018-a34f-WSL`. Committed summary/map data
is a bounded review surface with exact receipts, not a replacement runtime proof.

The original map index accepted 498 structural/bounds checks but wrongly treated
all dist TS sources as non-product: the TS plugin interpreted outDir-relative
paths against the original TS module. A real nested-output Rollup/TS fixture
reproduces that error and verifies the explicit-sourceRoot producer fix. The
historical original report is preserved and its browser-to-src mapping is not
claimed sufficient.

A separate projection under projector commit
`1ff39b03faf67849356872b4a2ef0f975389bd21` checks every raw gzip and captured
JS/map hash, checks all 460 exact a34f Git src blobs against current AST bytes,
and proves 432 repaired dist source bindings by declared-path relation AND exact
tracked path/blob/content. Its other 435 compiled bindings remain verified.
Only map sources/sourceRoot metadata is changed in a new artifact directory;
source contents, names, mappings and JS/native offsets remain equal. The derived
report names the old capture SHA and the new projector SHA separately, and
executes no invocations. No data is relabelled as a fresh capture.
The derived map contains 51,357 native ranges, 10,664 TS functions and 436 src
files, with the same 30,242 actual script observations. The earlier linear
projector at f356 also completed. Every non-identity field of both full reports
is exactly equal, including all native ranges/functions/files/observations,
invocations and incompleteness reasons; the parity receipt records each hash.
Only the explicit projector SHA/recipe differs.

Coverage remains incomplete. The original report has 1298 reasons: 388 missing
actual script bytes, 495 foreign script bytes, 325 uncheckpointed navigations,
29 unfinalized recorders, 20 recorder-capacity reports, 17 unfinished pages,
17 incomplete page payloads, six failed cases and one timeout. Positive witnesses
can inform discussion. Missing ranges and failed cases are unknown; the safe-zero
candidate list is disabled, including after source-path reprojection.

The first subsystem has positive smoke and Golden witnesses for colorField and
colorTile. These witnesses show the current forms actually ran; unknown legacy
callback branches are not safe zeroes or deletion approval. Removal still needs
the separate historical/caller/atomic-contract evidence described below.

The saved review surface is `parallel-paths-1018-before.json` (all 980 statuses),
`-projection.json` (exact source/blob/map bindings), `-runtime.json` (separate
expected/probed/observed/unknown evidence) and `-parity.json` (full search-result
equivalence). `-map.json.gz` losslessly retains every source function/native
range, every retained witness reference and actual script observation in a
compact interned JSON schema. `-map-meta.json` gives the column schema, material
identity and both representation hashes: 17,578,330 plain bytes, 2,992,244 gzip
bytes, with 384,069 interned witness records. Packaging uses Node 22.23.3 zlib
gzip level 9 with the deterministic zero timestamp header. The full raw report
and this derived projection have distinct receipts; neither is current-source CI.

Read bounded output without dumping the compressed map into model context:

```sh
node scripts/coverage-audit-read.mjs
node scripts/coverage-audit-read.mjs --file=src/editors/form-kit.ts --function=colorField --limit=3
node scripts/coverage-audit-read.mjs --file=src/editors/form-kit.ts --function=colorTile --limit=3
node scripts/coverage-audit-read.mjs --file=src/editors/form-kit.ts --line=353 --limit=3
node scripts/coverage-audit-read.mjs --file=src/editors/form-kit.ts --line=396 --limit=3
```

The summary reads the metadata; a file query verifies compressed and plain
hashes, limits compressed input to 8 MiB and decoded input to 32 MiB, and emits
at most 32 KiB. Limit is 1..30; default 10. Function names and src paths are exact.
The last two queries cover the frozen legacy onOpacity numeric-input handlers;
their anonymous callbacks remain unknown. A loaded/observed outer function is
not proof that its conditional callback executed. Line numbers refer to a34f.
The historical replay command is available at the projector commit while its
AST bytes still equal a34f; after cleanup it deliberately rejects changed AST:

```sh
node scripts/coverage-reproject-1018.mjs --source=artifacts/coverage-before-1018-a34f-WSL --out=artifacts/a34f-new-projection
```

| Case at a34f | Outcome and evidence | Interpretation |
|---|---|---|
| config_authority | failed, 6146 ms; lateAEventDoesNotStartConfigOnlyReadInB=false | Root normal repro on accepted b2df also failed. Trace showed readsBeforeA=2 and readsAfterA=2: the extra DeviceSignalController capability probe preceded late A. Stale total==1 oracle fixed separately in #1052 (actual S8); old result unchanged. |
| readonly_cold_start | failed, 6747 ms; optionalFailureNoFullRetry=false | The old total configGets==1 oracle also included the required capability probe. Separate #1052 B-only correction, ordinary and target CI green; old result unchanged. |
| view_recovery | failed, 27899 ms; six lifecycle/accounting assertions false | Root ordinary distinct repro confirmed detached Lit hostUpdate could reacquire DeviceSignalController traffic. Real product lifecycle defect, separate #1053, not six stale #1052 oracles. All six old failures retained. |
| summary_first_paint | failed, 11386 ms; skeleton/value and long-task checks | Instrumented run logged values at 4085 ms and a 531 ms long task. No normal repro establishes a product defect. Existing thresholds unchanged; diagnostic failed. |
| wall_node_connected | failed, 16488 ms; functional checks passed, p95 58.9 > 55 ms | Performance-only diagnostic red without normal repro. Temporary generated properties PNG also made metadata dirty; dirty metadata is retained, and was not the failing assertion. |
| zigbee_enable_refresh | failed, 42469 ms; settings dialog null after reload | Setup failure during language/theme matrix; normal cause not established. No assertion/oracle weakened or missing combinations declared covered. |
| edit_walk | timeout, 180020 ms, SIGKILL; empty stdout/stderr | Browser navigation began but no final page payload/recorder. Its branches remain unknown, not completed. |

Windows partial `10f21e3382f5f1dbff6098c060ee33e7f6332216` is separate and incomplete:
422 attempted, 417 completed, two failed, one timeout, two cancelled, 558 not run.
Its 10906 actual scripts, 31349 ranges and 625 reasons are not a34f results.
The measured initial 512-MiB bound was insufficient; 4 GiB/105-minute collection,
135-minute job and 15-minute always-upload bounds were adopted for diagnostic
resource accounting, with no product threshold changes. The interrupted dbef
WSL preparation/restart is another partial: 25 started, 21 completed, four
cancelled, 955 not executed. The restart corrected the diagnostic smoke timeout
to the canonical runner's 180 seconds rather than an erroneous 120 seconds.

The three original Windows issues were explicitly compared in the complete WSL
capture. daycycle_raster completed with measurementValid=true, budget=true and
problems=[] in 44485 ms. device_contact_walls completed all 68 states in 147193 ms
with final OK; ordinary CI also took about 145 seconds, confirming why the wrong
120-second diagnostic bound cut off valid progress. config_authority retained
the same failure and was separately diagnosed above, not hidden by a new OS.

Expected Python 3.14 / HA 2026.8.3 pins do not attest actual execution. The old
entry recipe did not observe Python. A separate live-environment probe resolved
unset PYTHON/default python3 to `/usr/bin/python3`, Python 3.12.3. A read-only
/proc sidecar actually observed 19 matching Python processes: 13 room_opening_host,
five support_diagnostics, one vacuum_route_recovery, all `/usr/bin/python3.12`
with binary SHA-256
`e50d468e8b0adfb05733f5b87b3cff34829c4a8c1aea50c865aa8bdfe4bb150f`.
These are observations of those PIDs, not exhaustive spawn attestation.
infinite_canvas uses literal python3 independently of PYTHON and ran before the
sidecar; its stdout says voluptuous absent and backend schema check skipped.
Its optional backend validation and unobserved child runtime remain unknown.
The later bounded probe metadata is a distinct recipe delta, never retroactive
confirmation of the old entry pin.

The first cleanup may proceed only after actual #1051 S8 and a new caller check,
using historical replacement, current callers and the equivalent atomic picker
contract plus unchanged named DOM smokes. Legacy onOpacity renders separate
numeric inputs (type=number), not native HSV range sliders. Keep the readonly
opacity label and live hpf-opacity/unit classes. Final src/editor-graph size
measurements and target proof are a separate final-source delta; none of the
before counters above is attributed to that new SHA.
