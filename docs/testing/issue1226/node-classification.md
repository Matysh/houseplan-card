# #1226 — Node audit classification

Source audit: stable validation run 41598951489, product cb1431ea65055b5d327e574c4fe2d567ba0a0d52. `node-classification.json` contains **all 230 original failed testcase names**, with their original failure, current disposition, exact addressed JUnit, reason and related issue. No original failure is removed or marked skipped.

Disposition after the addressed ports: **194 fixed stale fixtures/oracles, 12 confirmed product regressions, 23 unresolved assertions, 1 aggregate inventory passport awaiting integration**. These are original-failure counts, not a claim that all affected files are green. A consolidated run of the original affected files executed 527 tests; subsequent addressed XML files in each JSON row supersede the earlier consolidated result. Full stable audit was not rerun.

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

`src/plan-optimizer.ts` end of optimizePlans resets all non-observed report fields when changed=false. It also resets `unverifiedPositions`, `invalidPositionsEligible`, `invalidPositionsRetained` and even boolean `registryAuthoritative`. Consequently a perfectly unchanged plan loses its warnings, registry retry and cleanup actions. Tests use real Optimize and real dialog, not a stale HTML selector. Related to #1224, but the diagnostic scope is wider than numerical fixed-point repair; root will decide its routing.

```sh
node --test --test-name-pattern='#869 AC1 owner example|#869 AC3 incomplete|#869 AC3 a refused|#869 AC4 a late|#892 AC5: cleanup' test/optimize-plans-dialog.test.mjs
```

### 2. NaN column silently accepted by physical commit (1 original failure)

`characterize('unsafe')` inserts a column with `[NaN,0]`. The current commit path clones through JSON, turns NaN into null and accepts the physical candidate/history. The old refusal/empty-history passport stays red. No product change made.

```sh
node --test --test-name-pattern='unchanged byte result and refusal: unsafe' test/commit-physical-geometry.test.mjs
```

### 3. Valid composite split with adjacent owner gets third-owner (1 original failure)

A 146-room fixture splits its first rectangular room; an adjacent room shares one outside wall. Explicit current faces intent throws `plan-graph:third-owner` while constructing the valid result. It also reproduces with the UI contract that retains the parent room ID and adds one child. The counter/identity test is not bypassed.

```sh
node --test --test-name-pattern='146-room large-house counter contract: split' test/commit-physical-geometry.test.mjs
```

### 4. Own accepted node reply rejected after intent closes (1 original failure, #1220)

Shared transport returns context-changed on the same HA connection after a sent intent closes. Keep the accepted-reply/adoption oracle. The separate genuinely foreign-HA rejection was updated to its earlier context-changed guard while preserving zero adoption/reload and unchanged command identity.

```sh
node --test --test-name-pattern='closing the sent intent' test/node-delete-history.test.mjs
```

### 5. Optimize numerical fixed point and ULP/role boundary (4 original failures, #1224)

The two near-axis cases, exact first-floor shared/outer breakpoint and six-room ULP reporting still fail. No new geometry or numerical baseline accepted. An additional multi-opening case also changes on second Optimize and is retained unresolved with #1224 linkage.

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
