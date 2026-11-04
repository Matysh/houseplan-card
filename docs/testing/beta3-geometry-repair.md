# beta.3 geometry release repair

Owner decision, 2026-11-04: accept all 31 frames in the reviewed CI41726660162
gallery and repair the 22 retained geometry failures before publishing beta.
This work is on the isolated release branch, after #1256/#1257 merged to dev.
No live owner HA or private backup is changed or committed.

## Product corrections

- Host contexts distinguish complete unbound openings from bare graph host
  references. Validation, prepared moves and host remapping use the same rule;
  missing edges, invalid parameters and inconsistent exact projections still
  refuse. The existing actual physical-delete regression now passes.
- Legacy migration only folds compatible same-thickness partition atoms.
  Independent material keeps its original IDs and cm, including zero. The
  complete #478 positive has a small independently constructed current target,
  exercised in TS and Python. A real HA harness first-write case checks storage,
  ACK/read agreement and the immutable original migration source.
- Numeric Optimize readers no longer restore the old graph over a draft.
  Named opening-run metadata is retained without re-projecting the draft.
  Shared room node targets take precedence over stale partition echoes.
  Exact affine non-lattice supports remain exact; explicit near-axis/lattice
  targets update or retire constraints as part of the deliberate Optimize.
  Later alignment and structural passes retain those already-applied graph
  operations. Numerical compaction cannot enlarge a detached graph carrier.
- Reconciliation resolves wall-hosted opening coordinates correctly, protects
  the full footprint of a neighbouring partition-hosted opening and protects
  independent overlapping material across graph seams. A fully proven span
  may split one exact named room carrier at existing source nodes before
  conversion. Without a complete named target it conservatively keeps the
  source carrier. No nearest-host reconstruction or projection authority is
  introduced.
- Newly converted wall hosts receive their final exact alignment in the first
  pass, avoiding a second Optimize solely to replace a decimal tq with its
  lattice fraction. Lattice noise is handled in the numeric draft before Align.
  Reported wall-record removal counts compare actual input/output records;
  legacy zero-span migration is counted before the source keys are consumed.
- The retained legacy atom-split path calls its legacy bounded materializer.
  Its three original tests still check fixed corners, custom/zero thickness,
  opening child hosts, remote-owner isolation and full physical/junction proof.
  Current graph Resize's separate writer is unchanged by this compatibility
  correction; the separate current-writer findings in issue1226 remain recorded.

## Independent test target ports

These changes retain positive results and strict source/host preservation;
they do not classify a failing migration as a successful refusal.

- The old #478 expected thickness-conflict refusal becomes a positive comparison
  against every source-derived migration atom and exact opening host, while the
  separate #478 complete literal target independently checks the producer.
- The opening across a structural breakpoint retains both migration children
  and the complete opening, including exact host and physical centre. Comparing
  to the old single raw projection record would omit the required graph seam.
- Column/room-side hidden-body fixtures explicitly author positive room-wall
  material. A model11 zero contour supplies no occluding masonry. The column
  case retains both the blocked and uncovered source atoms byte-for-byte; the
  room-side case still requires two reconciliations and no unproved seam merge.
  The separate zero-contour/overlapping-material case preserves its full source
  migration result and both material profiles.
- #248's historical complete literal still supplies every intended point and
  layout value. The immutable raw input supplies node/edge/cycle identity.
  The independent target replaces only the declared vertex coordinates with
  literal lattice values and validates/projects that graph. Migrating the old
  late target instead would invent coordinate-derived IDs from the result.
- The original 229-entry historical corpus and archive stay unchanged. Only
  the previously null complete-config hash for the still-positive #478 current
  row is filled, after checking the independently constructed entire target.
  All 573 source inputs, 572 successful idempotent reads and all ownership/ID
  guards remain executed before the aggregate comparison.
- The mode-reset unit shell supplies/restores ShadowRoot and HTMLElement after
  loading Lit's Node modules; actual mode/cancel/history consumers remain tested.
- A full retained-product run exposed the #1166 complete receipt hash affected
  by the intended Optimize correction. Comparison against an isolated build of
  f36cb76 checked all16 old full receipts against their former hashes. Exactly
  four Optimize rows change: public forward/reverse and cavity forward/reverse.
  The public node becomes lattice[15,67] with the same named supports and
  parameter2/3; the cavity's two y=.30000000000000004 points become exact .3,
  lattice[120,72]/[72,72], with the same carriers/cycles and parameter1/3.
  The144 complete leaf differences are only repeated copies of these declared
  points/parameters and the corresponding dependency patch. A direct independent
  literal-value test protects them and fixed-point behavior. Only those four
  current hashes are updated; all12 other hashes and the full old raw-input
  receipt remain unchanged. The runtime still proves both creation orders,
  physical validity, write counts and exact Undo/Redo before checking hashes.

## Validation boundary

Addressed Optimize/graph/availability selection: 70/70 PASS. Complete corpus:
573 immutable inputs, 572 successful rereads, one deliberate degraded refusal,
zero invariant failures. Independent new host/#478 tests: 2/2 PASS. Python graph
selection before the new witness:54/54 PASS; updated migration file:32/32 PASS.
New real HA first-write witness:1/1 PASS. Build with types:PASS.

Release-profile checks, owner-backup replay, independent review and publication
are recorded against the final candidate, not inferred from these debug runs.
An earlier diagnostic `test/*.test.mjs` glob also included retired tooling
checks and is not the release selection; the subsequent selection comes from
`discoverReleaseTests`, the same retained catalog as the release runner.

The 31 accepted PNGs retain captured CI41726660162/source f36cb76 provenance and
the explicit owner decision in baselines-index.json. No new screenshot was
generated during their acceptance. Later changes require their own comparison.
