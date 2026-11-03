# #1226 — Node audit classification

Source audit: stable validation run 41598951489, product cb1431ea65055b5d327e574c4fe2d567ba0a0d52. `node-classification.json` contains **all 230 original failed testcase names**, with their original failure, current disposition, exact addressed JUnit, reason and related issue. No original failure is removed or marked skipped.

Disposition after the addressed ports: **196 fixed (194 fixture/oracle ports and 2 accepted product fixes), 10 confirmed product regressions, 23 unresolved assertions, 1 aggregate inventory passport awaiting integration**. These are original-failure counts, not a claim that all affected files are green. A consolidated run of the original affected files executed 527 tests; subsequent addressed XML files in each JSON row supersede the earlier consolidated result. Full stable audit was not rerun.

## What changed and what stayed protected

- Authored raw fixtures are model10 until an actual migration. Merely labeling polygons model11 is invalid.
- Real runtime edit/history tests use named graph intents. Prepared graph tests are stamped only after a real commitGraphEditResult and reject unscoped projection mutation.
- First legacy command records a normalized model11 baseline on **every** floor, so Undo never downgrades the root. Full outcome/toast/stack/save/command-identity history oracles remain explicit.
- Historical TS/Python compatibility snapshots remain on the supported frozen v0–v10 decoder. This was not applied to current runtime writers. Current host identity coverage includes `#1226 current graph deletion and face promotion retain the opening carrier identity`, `named partition arrangement promotes the selected face and remaps its hosted opening`, and runtime #1166 room creation/Undo/Redo.
- Exact graph preview avoids legacy Boolean materialization. Adapter tests still compare immutable baseline/proof identity on Esc retries, invalidation on every authority/input change, independent candidate proof, and failure-then-healthy retry. Zero Boolean calls are now explicit.
- Complete graph documents are compared by SHA256 of **all serialized fields and their order**; outcomes and history metadata remain ordinary assertions. This only compresses repetitive fixture storage. Generation is explicit; normal tests never accept their actual output.
- Backend schema comes from its canonical dumper; namespace registry explicitly supports external screens v1/v2. Shared picker tests read public option values, retaining the privacy filters.
- Opaque edge metadata retention and disjoint `:host` custom-property declarations follow the accepted product contracts; conflicting ordinary CSS properties remain rejected.

## Reproducing complete passports

From this checkout, with test-build present:

```sh
node test/helpers/geometry-passport-1226.mjs
node test/helpers/room-passport-1226.mjs
```

Both commands verify by default. `--write` is an explicit fixture edit, never a CI step or general permission to rebaseline. The generators verify pinned legacy source oracles and preserve the original user outcomes. A named safe-refusal diagnostic changed at the accepted current graph boundary; refusal, rollback and empty history are unchanged. The NaN acceptance defect is **not** accepted.

Full review files are local, reproducible and intentionally not committed:

| File | SHA256 of complete pretty JSON file |
| --- | --- |
| `output/issue1226/passport-generation/commit-full.json` | `3cbed5546f4a5e66e5b0a5dfc7f7a71ef44f80b222facf56caea1bf9c905e96e` |
| `output/issue1226/passport-generation/history-full.json` | `230b4575ce5f840dbdeb061653431b536a57ebe6f8cd5d2d368023ffe5339a2e` |
| `output/issue1226/1166-current-full.json` | `bff28228513a1121e74b67a4fa6a0cc7b95427f692ed8826da4914287e21f539` |

## Confirmed product findings — do not rebaseline

### 1. Unchanged Optimize erases actionable diagnostics (5 original failures)

`src/plan-optimizer.ts` end of optimizePlans resets all non-observed report fields when changed=false. It also resets `unverifiedPositions`, `invalidPositionsEligible`, `invalidPositionsRetained` and even boolean `registryAuthoritative`. Consequently a perfectly unchanged plan loses its warnings, registry retry and cleanup actions. Tests use real Optimize and real dialog, not a stale HTML selector. Tracked by #1229; this is separate from numerical fixed-point repair in #1224.

```sh
node --test --test-name-pattern='#869 AC1 owner example|#869 AC3 incomplete|#869 AC3 a refused|#869 AC4 a late|#892 AC5: cleanup' test/optimize-plans-dialog.test.mjs
```

### 2. NaN column silently accepted by physical commit (1 original failure, #1230)

`characterize('unsafe')` inserts a column with `[NaN,0]`. The current commit path clones through JSON, turns NaN into null and accepts the physical candidate/history. The old refusal/empty-history passport stays red. No product change made.

```sh
node --test --test-name-pattern='unchanged byte result and refusal: unsafe' test/commit-physical-geometry.test.mjs
```

### 3. Valid composite split with adjacent owner gets third-owner (1 original failure, #1231)

A 146-room fixture splits its first rectangular room; an adjacent room shares one outside wall. Explicit current faces intent throws `plan-graph:third-owner` while constructing the valid result. It also reproduces with the UI contract that retains the parent room ID and adds one child. The counter/identity test is not bypassed.

```sh
node --test --test-name-pattern='146-room large-house counter contract: split' test/commit-physical-geometry.test.mjs
```

### 4. Own accepted node reply rejected after intent closes — RESOLVED by #1220

On old cb1431ea shared transport returned context-changed on the same HA connection after a sent intent closed. After origin/dev 96ffe5444 this unchanged accepted-reply/adoption test passes. The separate genuinely foreign-HA rejection was updated to its earlier context-changed guard while preserving zero adoption/reload and unchanged command identity.

```sh
node --test --test-name-pattern='closing the sent intent' test/node-delete-history.test.mjs
```

### 5. Optimize numerical fixed point and ULP/role boundary (3 remaining original failures after #1224)

The simple near-axis fixed-point case now passes after #1224. The real-plan near-axis case, exact first-floor shared/outer breakpoint and six-room ULP reporting still fail. No new geometry or numerical baseline accepted. An additional multi-opening case also changes on second Optimize and is retained unresolved with #1224 linkage.

## Remaining unresolved assertions

The JSON contains each exact name and current failure. Important distinctions:

- **3 true-split legacy atom cases:** projectResizeStoredAtoms internally sends a projection draft into the new graph writer, catches graph refusal and returns null. Preparation now uses the official legacy decoder, and the coherent/stale-consumer proof passes, but enabled split/foreign owner/opening guarantees stay red.
- **3 writer seed cases:** fixture first builds graph authority, then appends raw projection carriers/openings. Needs an explicit producer port; the seed/no-seed and unsafe preservation contract must remain independently proved.
- **2 complete legacy Python captures and storage-roundtrip identity:** require separate current graph passports, not removal of graph IDs or comparison of selected geometry fields. The current #996 historical cross-language fixture remains intact and passes.
- **3 resize availability cases:** exact disabled reason/handle digests changed, and a known equivalent shared-owner handle is disabled. These are not accepted merely because the graph changed.
- **Overlap/breakpoint/unsafe outer duplicate and column blockers:** current Optimize may absorb a carrier where the original hard-stop contract required retention. Exact host/physical/opaque metadata proof is needed before changing those assertions.
- **Legacy9 explicit physical delete and foreign-floor K3:** current scope/host boundary needs investigation; the no-silent-deletion and permission/authority outcomes remain strict.
- **Reports/migration counters and legacy draft projections:** left red where an independent current graph-era physical or reporting oracle is still missing. No arbitrary count or ordering reset.

## Final aggregate step

`wall-identity-corpus.test.mjs` inventories every JSON fixture and demo export. The final package adds/changes fixtures, so `845-wall-corpus-identities.json` must be reviewed once after all sibling integrations. Do not remove sources from that inventory to get green. Root owns that last aggregate review.

Product source, release files, process state, skips and goldens were not changed by this Node work. No full stable run, no mutation run and no release was performed.

## Follow-up on origin/dev 96ffe5444 and four delegated browser smokes

Product fixes #1220–#1224 were merged locally, then test-build was rebuilt with tsc and fix-test-build. The addressed Node run `output/issue1226/post-product-1220-24.xml` executes 157 tests (20 remaining failures across those files). #1220 own-reply and the simple #290 Optimize fixed-point case now pass with their original assertions. Classification rows retain the original audit failure and add this new evidence. Both complete passport verification generators still pass without accepting new actual output.

The root product bundle was fresh for dev96ffe5444. Four source smoke files were copied from root, then run through temporary import-only runner mirrors under root `output/issue1226/`; root tracked files were not edited during execution. `browser-classification.json` records their dispositions and exact logs.

| Smoke | Result | Change / retained finding |
| --- | --- | --- |
| `smoke_optimize_coincident_partition.mjs` | 12/12 PASS | Current graph owns explicit empty `partitions: []`; every preview, host field, one atomic write, reload, Undo, second Apply and Thickness proof remains. |
| `smoke_resize_outer_reconciliation.mjs` | 8/8 PASS | Same exact empty collection correction; opening metadata and full production Resize pointer path remain. |
| `smoke_v8_draft_write.mjs` | 7/8 PASS | Real raw v9 seed is kept. Legacy drafts become graph partitions but **room_drafts remains in live and actual config/set**. Test now explicitly checks both, one migration write, graph edge count and returned idempotent prepare result. No forced current seed. |
| `smoke_draw_wall_thickness.mjs` | 11/13 PASS | Old raw `_path` assignment bypassed named graph Draw edges. Second room now uses actual `_markupClick` chain, waits for writes, then `_saveRoom`. Current runtime refuses the adjacent room with toast.geometry_unsafe; shared cm/identity assertions stay red. |

### Real legacy v9 draft retention

The literal v9 input is committed in `demo/smoke_v8_draft_write.mjs`: two old draft edges (cm21/cm22), no rooms or graph. Actual Draw clicks (500,500), (700,500) produce one wire config with model11, graph3edges and correct partition IDs/cm, **plus the original room_drafts**. Standalone full state from that runtime run:

- root `output/issue1226/v8-legacy-current-state.json` (config, server body, actual writes and current Draw path);
- root `output/issue1226/v8-node-final.log` (exact failing AC);
- root `output/issue1226/v8-node-r1.log` (original full diagnostic capture).

A pending product issue is owned by root. This test is intentionally still red until the legacy field is actually consumed on migration.

### Adjacent Draw room after graph adoption

First room has cm15 and a valid model11 graph. Set toolbar20, click the adjacent rectangular contour using production coordinates, then save its room dialog. Source partition edges carry cm20, but the room promotion is refused with toast.geometry_unsafe. First room survives, shared cm/identity cannot be established because no second room is saved. A diagnostic repetition using 240×180cm rooms also fails, excluding the original tiny dimensions as the only cause.

- root `output/issue1226/thickness-current-state.json` has complete graph, persisted cm20 partitions, room state, path, dialog/batch and toasts;
- root `output/issue1226/thickness-node-final.log` is the final strict result;
- root `output/issue1226/thickness-debug-r5.log` and `thickness-large-r6.log` retain detailed diagnostic runs.

This may share a faces/adjacent-owner root with #1231, but no equivalence is claimed without tracing the exact failing operation. The old helper-only producer would instead create cm0 new walls; neither outcome was accepted.

## Root follow-up on current named producers

The three #477writer seed cases are nowPASS: author partition edits through the graph bridge and reuse the known shared-wall endpoint IDs, as native snapping does. Equal coordinates alone never establish node identity. All8writer tests pass, including lossless unknown/column refusal and the legacy orphan full-byte check; invalid current host authoring must reject host-parameter without authority mutation.

The #478unfinished work case now independently proves complete continuous coverage for every legacy segment and30cm room-wall thickness for consumed thicker work. The exact current split/fold projection is checked too; no arbitrary count/geometry baseline accepted. The separate structural-breakpoint and column reconciliation cases remainRED. Node original230-row counts are now200fixed/30remaining.

## Current full rehost packet, independently accepted

The original280-optimize-rehost-candidate.json model10 capture remains unchanged. A separate280-optimize-rehost-current.json contains the complete current config and actual API2graph_change receipt. It starts from the real config/get appearance projection, not an unnormalised legacy-only colour fixture. The current full Node config matches this literal; independent Python HA WS accepts the packet, stores the entire config byte-structurally (including exactgraph/host/opaque fields) and performs Undo. Both original legacy packet cases remain selected:3/3backend casesPASS. The two other coincident safety/fixed-point failures stayRED. Total original Node230now201fixed/29remaining.
