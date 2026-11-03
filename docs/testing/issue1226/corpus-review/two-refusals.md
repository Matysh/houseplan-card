# #1226: two original corpus positives that current migration refuses

Read-only diagnosis on product`0c030e700`, using the exact compiled output for combined`0bda944e3244a142449c30c5f802c14833af8c66`. Scope is exactly two archived inputs. No product, corpus manifest, baseline or expected result was changed. No build, HA run or full corpus was performed.

## Source provenance

Both full inputs come from tracked `docs/testing/issue1226/repros/845-historical-inputs.json.gz` (229 preserved records). Archive SHA256 is`166699b562311b4f742f2ad563f081e0356239b89afe5168a30273a8fe078115`. Each selected `SHA256(JSON.stringify(input))` was checked against the original record before executing either decoder; both source objects remain unchanged afterwards.

| Label | Exact original fingerprint | Original provenance |
|---|---|---|
| `test/fixtures/478-room-draft-migration-vectors.json/accepted/input` | `f916903d1b0385267195278c6fcb33adfb698d537ac3bb6fd8dbbf3935082bc4` | `06406aa98ba72cd40a021ebbae0bb03d8aa71d3e` |
| `test/fixtures/842-geometry-cleanup.json/before` | `4eb5e4223a68a989384ab07fb99dd47961d14eca31461137a517e10fd7230807` | `06406aa98ba72cd40a021ebbae0bb03d8aa71d3e` |

`comparison.json` contains the copied original passport rows, frozen compatibility-decoder results and actual current refusal reasons. It is diagnostic evidence, not a replacement expected passport. The only targeted comparison executed `decodeLegacyWallSegmentModel` and current`commitWallSegmentModel` for these two exact records.

## #842 before: intentionally degraded legacy input, accepted current refusal

The old compatibility decoder accepts this source as model10; the current graph migration refuses `invalid-room: plan-graph:zero-length`. The precise witness is the stored partition`p-lost`: both endpoints are`[0.6,0.3]`, so its squared length is exactly0, not a tiny rounding residue. Opening`o-lost` explicitly names that degenerate partition as host. Independently, column`c-far` has center`[6000,0.5]`, outside the existing ±5000 storage/canvas bound.

This is exactly what the fixture's provenance says it tests: the degraded **before** of the #842 destructive cleanup prompt, not a clean ordinary structural-write candidate. The source includes the expected prompt counts partitions1/columns1/openings1 and a separate`cleaned` document.

Accepted boundaries:

- `src/geometry-cleanup.ts:1–25` documents #842 K1–K3: derive the removal set, refuse an ordinary write without mutating or sending it, and ask explicit destructive consent. Removal also includes openings hosted by a deleted partition. `findGeometryRemoval` explicitly identifies zero-length/out-of-range records; known degraded stores remain readable.
- [#1167](https://github.com/Matysh/houseplan-card/issues/1167), behaviour1/8 and `docs/PLAN-GRAPH.md` require nonzero edges and distinguish genuine damaged geometry from microscopic normalization.
- `src/plan-graph.ts:725–728` rejects the exact zero-length source before graph construction; graph validation independently rejects zero-length edges at100–102.

**Classification:** the former generic passport positive only established compatibility-decoder acceptance. It was never evidence that this damaged source was safe as a graph11 structural write. The current refusal is justified and does not silently lose stored records. Preserve the old full input/read-compatibility witness and #842 explicit-confirmation/cancel/no-write/metadata tests. A future reviewed corpus port should distinguish the clean source from this deliberate pre-cleanup refusal; this analysis does not modify its old expected outcome or claim that the whole cleanup UI journey currently passes.

## #478 accepted/input: legitimate carrier identities, current migration finding

Actual current refusal is `invalid-room: plan-graph:thickness-conflict`. It is **not** a numeric-string parsing failure, null draft-ID failure, self-crossing room, host ambiguity or microscopic source displacement.

The frozen legacy decoder converts all3 drafts and retains4 partitions exactly:

| Carrier | From → to | cm |
|---|---|---|
| Existing`wall-d2ypm2qxakxh3ptdvgvl` | `[2,0]→[3,0]` |10|
| Converted`wall-gsjue66gcixcalb47qwf` | `[0,0]→[0.25,0]` |15|
| Converted collision suffix`wall-d2ypm2qxakxh3ptdvgvl-2` | `[0.25,0]→[0.5,0]` |0|
| Converted reverse`wall-xejmlatjgvgeaamf63jw` | `[0.5,0]→[0.25,0]` |22|

Every edge has positive length and legal finite thickness. Coordinates are exact lattice values. No rooms, hosts, proper crossings, out-of-bounds data, metadata conflict or resource excess exists. The overlap is two independently identified ordinary partition carriers with different roles: **zero thickness is an explicit boundary, not absent/unknown22cm**. Their opposite authored directions and deterministic IDs are deliberate old fixture witnesses.

Accepted contracts checked:

1. [#478](https://github.com/Matysh/houseplan-card/issues/478) and `CONFIG-COMPATIBILITY.md:935–970` require valid draft edges to become ordinary partitions one-for-one, preserving individual cm values; existing partitions are not merged and ID collisions receive deterministic suffixes. The first draft's numeric strings are legal legacy inputs handled by that decoder.
2. [#1167](https://github.com/Matysh/houseplan-card/issues/1167), accepted migration algorithm6, permits separate exact node identities when an optional join is incompatible; behaviour9 preserves thickness. Current `PLAN-GRAPH.md:19–26` explicitly allows equal coordinates with separate IDs. A forced merge is not mandated merely by coordinate coincidence.
3. [#1216](https://github.com/Matysh/houseplan-card/issues/1216), exact constructionA, supports contacts with independent IDs and applies cm0 as no material while retaining each positive edge's material. It does not authorize changing the stored0/22 pair into a single maximum-thickness edge or dropping the zero carrier.

### Concrete representability witness

`478-independent-identity-witness.json` preserves all4 decoded carrier IDs, endpoints and cm values, supplies exact lattice endpoints under independent node identities, and calls the current graph validator: `ok:true`, `issues:[]`,4edges/8nodes. This is a finite witness that the current representation can carry the source without displacement or thickness loss. It is deliberately labelled **not an expected migration result**; its constructed node IDs are not substituted for the actual migration's failed output, and it does not prescribe the complete final contact topology. The accepted renderer handles physical same-coordinate contacts without overwriting graph identity.

### Actual current failure mechanism

The raw draft conversion itself completes. `migrateGraphSpace` then groups chosen edges by `gkey = kind + unordered(node pair)` (`plan-graph.ts:1084–1094`). `existing` is selected by compatible props, before thickness; because both overlapping partitions have empty compatible props, they are treated as one edge. The next line refuses when cm0 differs from cm22. The retries at1194–1197 repeat the same exact-coordinate collapse even with optional microjoins disabled. The `compatible` node selection at827–832 guards against collapsing the two ends of **one** source edge but does not distinguish this different-carrier thickness/role conflict.

**Classification:** retain this case RED as a current legacy-migration finding. The old supported draft/carrier contract and a valid current representation exist; it cannot be labelled corrupt solely because the current migration elects to merge the carriers. Do not choose max(cm), equate0 with absent thickness, delete a carrier, rewrite the historical input or automatically accept a new passport. A product fix/accepted clarification would need to preserve distinct source authority and legal contact semantics with exact original-bound proof and TS/Python parity. No product fix or new issue was created here.

## Files and execution boundary

Own absolute directory: `/home/matysh/hp-batch2-infra-20261015/output/issue1226/historical-two/`.

- `compare.mjs`, `comparison.json`: exact archived two-input cross-decoder comparison.
- `witness478.mjs`, `478-independent-identity-witness.json`: bounded current representability check for the same #478 source only.
- This report: no live state, manifest changes or generated-output acceptance.
