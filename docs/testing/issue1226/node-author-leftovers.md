# Bounded completion of known author-side oracle leftovers

Source product0c030e700; shared compiled output from0bda944e3. No build, full suite, HA run, product patch or generated baseline acceptance.

## #273 expected room order

Accepted #1216 explicitly defines canonical graph room-ID order as projection order. The test now sorts **expected IDs only** with the product's code-point comparator. Exact point expectations are labelled with the original main/branch IDs and their expected row table is canonicalized; the point arrays and oriented cycles themselves are unchanged. Actual output is never sorted.

The expected-order assertion runs before the former first blocker and passes. The unchanged `wallsMerged === 0` assertion remains RED with actual1. No count, breakpoint coordinate, material thickness or second-pass result was accepted. The test therefore still exposes the unresolved physical/reporting contract after its known obsolete room-order expectation is removed.

## #281 full current target

Directly migrating the old accepted model10 target retains its complete rooms/wall records/openings but gives room-derived node IDs. Actual Optimize begins from the raw source's partition-derived node authority. Silently accepting actual node IDs or dropping graph fields would lose the identity guarantee.

For this small literal fixture a complete independent target is possible:

1. The immutable old literal supplies the accepted complete target projection and opening hosts.
2. The official migration of the immutable **raw input** supplies its actual source graph authority.
3. Remove exactly the declared duplicate partition edges bottom-right,top-left,top-right. Keep all six original nodes, all seven complete room-wall graph records, room cycles and dependencies (explicitly empty).
4. Assert complete ordered room records and all full wall records by ID equal source authority. All opening fields except the intentionally changed host are exactly equal to the migrated source, including coordinates, width, orientation, service bindings and future_field.
5. Each new wall host has the exact same endpoints/cm as its named original partition and retains numeric t and rational tq. Validate the complete expected document without normalization, then compare the **whole** Optimize result. Original report counters and full second-pass idempotence remain unchanged.

No Optimize call generates the expected target. The complete changed original scenario passes. `output/issue1226/author-leftovers-281-proven-source-target.json` contains the source authority and full independently constructed target for review.

## #845 known boundary, not an unknown product bug

The original file stays immutable and its archive hash/229 input fingerprints continue to be checked. The active source selection remains572full documents, including all98 historical inputs absent/changed in today's fixtures and all474 current sources. No label/input, opaque field, current source or zero-config file was removed.

The test's expected catalogue, partition and room **tables** now follow accepted canonical code-point order. Actual output, room edge cycles, opening order and source space order are untouched. An offline comparison against the existing captured output proves this expected-only transformation explains exactly72/72 order-only deltas. Sorting opening metadata would incorrectly change six of those cases; it is explicitly excluded.

The remaining barrier is precise: the original229-outcome passport does not provide reviewed outcomes for343 separately appended current source records. Additionally31 old semantic mappings and two old-positive refusals remain unaccepted. Updating inventory counts alone cannot approve those identity/ownership outcomes. A complete new passport would need an explicit per-source/version mapping review, retaining the historical229 outcomes and independently certifying new current ones. That is a substantive separate mapping contract, not an inventory typo that an author may autoaccept. The aggregate diagnostic now names this known inventory/semantic review requirement.

The existing negative catalogue reorder/renamed ID/room-cycle/opening-host guards pass unchanged, as does the independent full229 archive/current-union integrity guard. The aggregate was not rerun merely to observe its expected RED again. No new test framework or review gate was introduced.

## Addressed evidence

- `author-leftovers-addressed.log`: two selected original scenarios; #281 PASS, #273 RED only at the unchanged count1vs0 after its new order assertion passed.
- `author-leftovers-corpus-controls.log`: negative identity/order/relink guard and full229 preservation guard,2/2PASS.
- `author-leftovers-845-order-proof.json`: offline72-row expected-table proof; no product invocation or expected-file write.
- Syntax checks for the three edited test files and `git diff --check`: PASS.

`node-author-leftovers-delta.json` updates only these three original classifications. Relative to the preceding209/21 table, #281 adds one fixed row:210fixed/20retainedRED, subject to the coordinator's separate newer results. This does not claim all retained RED are product defects.