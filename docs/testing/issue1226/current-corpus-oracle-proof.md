# #845 current corpus oracle port for #1226

This is a review candidate for the current model11 identity oracle, not a product fix or a golden acceptance. The old229 input archive and passport remain byte-identical. The original #478 positive remains positive in the new passport, so its current refusal remains RED. #842 is an intentionally damaged input and retains an explicit `invalid-room` outcome.

## Scope and provenance

- Product source: `0c030e700`; shared compiled candidate: `0bda944e3`. Backend pin compares642 product/Python source files exactly.
- Selection: all573 complete historical/current inputs from91 inventoried files; no dropped source, receipt reclassification, truncated input, or actual table sorting.
- Each of the571 verified accepted rows additionally pins `fullConfigSha256`: SHA256 of the complete persisted config with ONLY object key order canonicalized. Array order, numbers, graph, opaque fields and all metadata remain intact. The #478 row has an explicit null hash pending an independently verified current positive target; it cannot become PASS merely by starting to accept the input. #842 is typed refusal without a config hash. The existing negative control now also deletes opaque metadata at unchanged IDs, reorders arrays and alters numeric precision; all are detected. Object key reordering alone has the same hash.
The new `test/fixtures/845-wall-corpus-current-identities.json` is separate from immutable `845-wall-corpus-identities.json`. Both passport files are explicitly excluded from source discovery so the inventory cannot recursively include its own oracle.
- Backend's single saved dual-runtime batch accepted571 and declined478/842 in both languages, with all source inputs immutable. All571 graph arrays are exactly equal.568 entire configs are equal at the raw migration entrypoint. For the other3, the existing official Python Store postcanonicalizer applied to SAVED configs yields full equality with TS; raw48 scalar differences remain in the primary evidence. This proves the composed migration facade, not whole HA behavior.
- Supplemental graph mappings were missing from that dataset. Only362 nontrivial legacy rows needed maps;340 unique input SHA256s were replayed, checking complete result config equality with the already-saved result and source immutability.71 current rows and138 direct legacy rows were not replayed. This was missing correspondence evidence, not a repeated product suite.

## Independent source ledger

The tracked `repros/845-verify-current-source-proof.py` checker reads saved raw inputs, configs and captured mappings. Run it with the full independent dataset directory, proof-package path and a fresh output directory; it performs no migrations. It does not invoke migration or Optimize and does not identify carriers by nearest geometry. It independently constructs authored carriers/room sides, decodes exact rationals, and checks:

| Proof | Checks | Result |
|---|---:|---|
| Complete source space-ID multiset |571|PASS|
| Current full input config unchanged (71 docs /81 graphs)|71 /81|PASS|
| Legacy room/opening ID multisets |612 each|PASS|
| Raw source set / complete resulting edge coverage |612 each|PASS|
| Source carriers / ordered mapped child intervals |3300 /3969|PASS|
| Original source-to-child endpoints inside squared Euclidean R |3969|PASS|
| Source opaque fields / complete merged opaque union |3969 /3919|PASS|
| Canonical source-owner ID lineage |3919|PASS|
| Ordered oriented room cycles reconstructed per room ID |561|PASS|
| Hosted opening exact source parameter |232|PASS|
| Authoritative partition / model9+ catalogue width |3257|PASS|
| Legacy source/default/overlay width |712|PASS|

`R = min(1/1200000, 0.1/(240*cell_cm))`, applied to ORIGINAL source coordinates. Fraction arithmetic is exact. A microscopic interval may collapse only when both original ends resolve to the SAME exact output node and both original ends are inside R:549 internal/leading gaps and15 tails satisfy that stronger condition. This explains omitted zero-length intervals without silently permitting a gap, stretching R along a chain, or claiming an exact uncollapsed parameter partition.

Source ownership uses mapping edges, not closest walls. Every target edge is covered; its complete opaque metadata equals the union of all actual mapped source owners. Its ID retains the minimum canonical source owner's base ID or deterministic split namespace; aliases from compatible overlap are documented ownership, not presumed loss of a persisted ID. Room table order can be canonical while each oriented cycle remains exact.

For legacy widths,691 child widths independently agree with the frozen legacy reader's covering carrier from the saved229 outputs plus7 narrow additional successful reads.21 equal explicit raw widths:20 are the courtyard fixture whose old reader refuses duplicate geometric IDs, and one other explicit source. All712 also have raw source/covering overlay provenance. The eighth additional old-reader probe is the courtyard refusal, recorded honestly; it is not treated as an accepted old output. Model9+ and partition authoritative widths remain strict.

Nonstructural config/space/room/opening metadata is exact outside the documented projection/scalar contract. The complete65 exceptions are retained in the package:18 obsolete `open_spans` projections removed by `projectGraphSpace` (`src/plan-graph.ts:233`),20 scalar-nine-decimal values and27 lattice-noise/scalar values from the explicit field allow-list (`src/coordinate-canonicalization.ts:348`). No unknown or opaque field is normalized away. LED points follow the scalar-only contract at the end of that function. One opening length is an existing scalar-nine-decimal conversion; authoritative raw width/opaque assertions are not deleted.

## Old contract and remaining RED

Backend already evaluated the frozen v0-v10 reader against every original full input:229/229 complete passport rows plus84-source inventory match the original passport exactly, without sorting the old oracle. The permanent compatibility test now encodes that comparison separately. Current model11 sources never use that decoder.

The current573 passport contains572 expected successful identities and one justified negative (#842). Its #478 identity comes from the unchanged old positive: four original draft-derived carrier IDs in canonical EXPECTED table order. The actual still refuses #478. No actual refusal is accepted merely to get green; the other571 accepted outcomes are supported by the independent evidence above.

The existing current guard still executes ALL source immutability, successful byte-idempotence, stored-atom ID multisets, complete room-ID multisets and oriented room cycles before comparing the complete passport. Negative controls still reject catalogue reordering, renamed IDs, room/opening relinks and unregistered membership. No child-test accounting inflation, skip, product change, or full-suite run is introduced.

## Evidence

Tracked bounded proof package: `repros/845-current-oracle-proof.json.gz` (SHA256 `87e90f1883a4ec91aa9e685d73543839c59bc534f07d705e3c3f018bad806f97`). Contains all573 provenance fingerprints, supplemental correspondence, per-document/check ledger, complete65 metadata exceptions,712 width witnesses and primary evidence hashes. Compressed size122117 bytes.

Primary independent datasets (local review artifacts):

- `/home/matysh/hp-batch2-infra-20261015/output/issue1226/corpus573-independent/`: full inputs, full TS/Python configs, exact parity, source pin and composed post-step.
- `/home/matysh/hp-batch2-infra-20261015/output/issue1226/legacy229-compatibility/`: original frozen outputs, exact passport comparison and provenance.
- `/home/matysh/hp-batch2-infra905-20261015/output/issue1226-corpus-proof/`: `verify-ownership.py`, `verify-frozen-widths.py`, `verify-metadata.py`, exact row details, supplemental capture and preparation script. These proof scripts only compare saved data; `capture-maps.mjs` and `capture-width-legacy.mjs` are the explicitly scoped supplemental producers.

This evidence supports ordinary independent review of the authored oracle. It does not claim unrelated20 original Node RED cases or HA have passed.
## Addressed validation

`node --test --test-name-pattern="corpus guard rejects" test/wall-identity-corpus.test.mjs` —1test PASS,0FAIL,0skip,131.5ms; validates existing identity damage plus new metadata/hash controls. Main573/frozen229 production calls were not repeated: primary saved results and backend exact229 proof are preserved; the final common candidate run can execute both permanent guards. Syntax/diff checks pass. No full product suite, build or HA rerun.
Saved-result comparison of the prepared573rowpassport:571full hashes exact, one explicit pending #478 full target, and exactly one remaining outcome difference (#478); no model calls.
