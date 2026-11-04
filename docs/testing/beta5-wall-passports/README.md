# Beta.5 wall passport reconciliation (#1290)

This is a test-oracle correction for the accepted #1282 lattice contract, not
a new geometry normalization. Product files and frozen historical inputs are
unchanged. The first beta.5 run used `d33a8e42`; this audit uses current dev
`ff650ec58838a85767e15fbb5de9193c336f9034`.

## Independent old/new comparison

The original engine was compiled from Git commit
`659440571bc388d108ec7f0200ce9c407a9ee132` into an isolated `output/` directory.
Its complete output reproduced **all 575 old passport rows exactly**, including
input fingerprint, success/refusal, ordered identity projection and canonical
full-config SHA256. The comparison used the same complete current/historical
source selection and deterministic test UUID sequence for each engine.

On accepted dev, 52 output hashes change for 46 distinct inputs. Every changed
input enters the facade before model 11. No current graph read is newly rounded.
The changes consist only of exact node coordinates/support parameters and their
derived numeric projections; no editor seam operation runs in this migration
corpus. In particular, the first `1729ae71…` → `d5f8c19b…` change is #1282's
retained lattice anchor, not #1283's Merge compaction.

The checked field differences, source fingerprints and both complete-output
hashes are preserved in [the audit](corpus-coordinate-audit.json.txt).
For all changed inputs:

- Node IDs, edge IDs/incidence, kind, thickness and opaque edge props match.
- Room IDs, ordered cycles, dependency kinds and support refs match.
- All root/space/room metadata and non-geometric fields match.
- Opening IDs, hosts including `t`/`tq`, angles, side flags and opaque metadata
  match. Four derived opening x/y fields differ only with their exact carriers.
- All 74 resulting space graphs validate, with exact current projections.
- Each changed node remains within the existing space-specific normalization
  radius. Across the 46 unique inputs, 319 node encodings change, including 273
  `q` → `l` recoveries. Maximum exact point displacement is
  `4.714045207910317e-10` normalized units; maximum physical displacement is
  `1.2e-7` cm.

Only the 52 proven `fullConfigSha256` fields are updated. All 575 source
fingerprints, row membership/order, identities, outcomes and refusal reasons
remain unchanged. The new #1285 sequence fixture is explicitly inventoried
with `configs: 0`; it contributes no input configuration.

The following frozen files are unchanged (also recorded with hashes in the
audit): the v10 physical goldens, original wall-corpus passport, and the archive
of all 229 historical inputs. No historical source or current source JSON is
rewritten by this first correction.

## D4 current node target

The historic target float `0.09583333333333333` comes from `23 * (1/240)`.
Its model-11 grid target is instead the exact coordinate `23/240`, projected as
`0.09583333333333334`. D4-persisted-3.4mm and four D5/D6 cases have literal UI
indices `[23, 144]` / `[23, 24]`.

The existing test now checks `['l', ix, iy]` and the independently computed
`index / 240` numeric projection for these integer-index targets. The three
off-grid D4-T targets keep exact literal expectations. The separate first half
of each test still compares the complete v10 result to the frozen golden;
there is no epsilon comparison, generic tolerance rounding or fixture rewrite.
ID persistence, input immutability, production physical preview and the absence
of new junction violations remain asserted. No history/Undo oracle is changed.

## Verification

`node --test test/wall-identity-corpus.test.mjs test/wall-node-move.test.mjs`:
**27/27 PASS** on the isolated current correction. Corpus guards all run:
575 immutable sources, 574 successes, one expected refusal, 574 idempotent
re-reads, 232 stored-atom/room-ID checks and 476 ordered room-cycle checks.

The separately prepared writer correction
`9effdf165bbb45f495142ea90ba15699b2b79923` was then composed on this branch.
Its change to `optimize-storage-roundtrip-current.json` is a deliberate
**current facade source correction**, separate from the 52 unchanged-input
runtime output changes above. Exactly one current corpus row now has the new
source fingerprint and full output hash; its label, identity projection,
success outcome and membership remain unchanged.

[The separate source audit](shared-current-source-audit.json.txt) records all
five q-to-l changes and derived x projections. It independently checks the
same node/carrier IDs, dependencies, cycles, materials and metadata, exact
projection consistency, the existing movement bound, and that the current
facade target is already idempotent. The original historical
`optimize-storage-roundtrip.json` is byte-identical, SHA256
`a148f394de4d063357252a0600214bb13eccb31c6a2fcbaab25fde24a370cd88`.

Both suites were rerun on the **combined data**: **27/27 PASS**, including all
575 source members and the frozen 229-input legacy check. No rows were dropped,
no rejection was converted to a success, and no tolerance assertion replaced
a full-document or exact-wire comparison.
