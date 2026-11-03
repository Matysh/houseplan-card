# Preserve the complete original #845 corpus

The current corpus passport is still red. No expected manifest, identity guard,
decoder or baseline was replaced by this recovery. The archive below preserves
evidence that would otherwise disappear when full fixture objects become compact
whole-document hash receipts.

`repros/845-historical-inputs.json.gz` contains all **229 original full inputs**,
their labels, full original expected passport rows, fingerprints and per-record
source provenance. Every `SHA256(JSON.stringify(input))` equals its original
manifest fingerprint; no metadata subtree or opaque ID was projected away.
The recorded recovery has zero missing or mismatched inputs.

- 131 inputs reproduce their exact historical fingerprint from source at
  `06406aa98ba72cd40a021ebbae0bb03d8aa71d3e`.
- 67 changed fixture inputs were recovered from immutable
  `fe4fde1517af322b75aff1bbc2db08fd1c574ebb`.
- 31 inputs that had become encoded receipts were recovered from immutable
  `cb1431ea65055b5d327e574c4fe2d567ba0a0d52`.

Archive SHA256:
`166699b562311b4f742f2ad563f081e0356239b89afe5168a30273a8fe078115`.
Size: 914767 raw bytes / 77020 gzip bytes. The original manifest SHA256 is
`1507c3a072c3eb42a754d5908ac17f9b51d6d9a126248cfbe6adbd626fef5317`.
`repros/845-historical-recovery.json` records the recovery counts and hashes.
Copying the archive into this evidence directory preserved its recorded SHA256.

Recovery used the original tracked manifest's label and full input fingerprint.
For unchanged labels it read the current corpus input; otherwise it loaded the
named JSON source and pointer from the immutable commits above and accepted only
a complete input whose fingerprint exactly matched. The original expected row
was copied unchanged. No current decoder output was accepted as a new expected
result. The author's reproducible recovery script and detailed deltas remain in
`output/issue1226-corpus-review/` in the analysis checkout.

## What the current inventory actually means

The broad extractor discovers 479 objects in 90 files, versus the original 229
objects in 84 files. All original files still exist. Five of the 479 objects are
typed `graph_change` receipts, whose `spaces` entries are protocol patches rather
than persisted spaces: two in `1061-align-carrier.json`, two in
`1166-room-candidates.json`, and one in `280-optimize-rehost-current.json`.
A proposed narrow extractor correction excludes exactly those five and preserves
the other 474 inputs byte-for-byte under JSON serialization. It has **not** been
applied here. The zero-config source files must stay inventoried.

Among the 198 surviving original labels, 26 match completely; 72 differ only in
table order; 67 now point to changed full inputs; 31 have unresolved semantic
identity/host/atom mapping changes; and two old positives now refuse. The two
refusals are `478-room-draft-migration-vectors.json/accepted/input` and
`842-geometry-cleanup.json/before`. These aggregate observations alone do not
establish a new product defect or prove equivalence to #1231/#1232.

## Required next port

Keep the recovered original 229 records and append genuine current sources under
separate provenance: 276 new sources and 67 changed inputs give 572 source records
in the union. Never silently reuse an old label for a new input fingerprint.

The 72 table-order candidates need explicit reviewed model11 expectations;
sorting the production output inside the permanent guard would hide its negative
reorder checks. A room's wall cycle is never an unordered set. Current graph
authority, exact second-pass idempotence and full metadata preservation remain
required. The 31 semantic deltas and two changed outcomes stay red until proven;
nearest-edge matching or automatic acceptance of generated passports is not a
substitute. A future loader must consume tracked archive bytes and verify input
fingerprints, rather than fetch Git history during CI.
