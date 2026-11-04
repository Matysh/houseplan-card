# Historical geometry passports after #1282 and #1283

The #1287 final S6 exposed two stale exact passports after integrating the accepted
#1282 authored-coordinate migration and #1283 merge seam cleanup. No history
product code was changed to accommodate these expectations.

- `1166-room-candidates.json` remains byte-identical. Synthetic current graph
  inputs are now read from that complete historical receipt, rather than rerunning
  the updated migration during fixture construction. Its twelve synthetic rows
  retain their existing complete-document hashes.
- Only the four public legacy-input rows in `1166-room-graph-passports.json` change.
  #1282 encodes authored anchors as exact lattice points; dependency rational
  parameters are recalculated. With Optimize, the first inherited intersection
  becomes the accepted lattice point `[15,67]` and its on-edge ratio becomes `2/3`.
  The test compares all identities, graph references, thicknesses, room metadata,
  and other fields against the complete old receipt. Numeric coordinate changes
  are bounded by `1e-12` without Optimize, or `.0002` normalized units with Optimize;
  dependency ratios by `.001` with Optimize. Full serialized hashes still cover
  every field after this independent semantic check. Native writes, physical
  validation, and exact Undo/Redo remain exercised for both contour orders.
- Only Merge's after-edit and Redo hashes change in
  `1100-history-characterization.json`: `21efe746…` becomes `68257b89…`.
  #1283 removes two collinear boundary seams, leaving four graph nodes and four
  10 cm edges around the same rectangle. An independent assertion checks the
  surviving `left` room, its literal polygon, material, foreign floors, and exact
  Redo. Undo's full-document hash and all history metadata remain unchanged.

The fixture origin metadata continues to identify the historical corpus, rather
than claiming that the updated expected outputs were produced at its old SHA.
