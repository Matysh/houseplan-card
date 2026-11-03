# Findings after accepted #1228–#1238

Product base: `0c030e700`; joint diagnostic material: `0bda944e3`.
These findings are not product fixes in #1226. Existing tests remain RED where
the behavior is not proved correct. No new issue or product change is implied
by recording a candidate here.

## Confirmed: unrelated unhosted opening blocks a valid partition edit

The official legacy migration produces a current graph with a legitimate
unrelated opening that has no `host`. A current partitions edit then fails with
`plan-graph:host`: `commitGraphEditResult` passes every `before.openings` item to
graph validation, which interprets an object without an own `host` as a bare
edge reference and looks for an undefined edge. A detached opening is supported
by #1033 and is also the normal output of successful #1238 repair.

Minimal current-source expected-success reproduction:
`repros/explicit-delete-unhosted-opening.mjs`. It does not rely on rejected raw
projection mutation or a legacy writer. The original explicit-delete test stays
RED. See `node-classification.md` for code locations and command evidence.

## Confirmed: Escape can leave device drag active and release commits it

The native contacts scenario presses Escape during a genuine drag with the
device's Properties selected. After pointer release the saved position is
`.4291666667/.3791666667` instead of the starting `.28885/.3`; history advances
from one to two. `_onKey` invokes `properties.escape(e)` before its device-drag
cancel branch; Properties checks decor gestures but does not account for the
active device drag, so it consumes Escape first.

Evidence: the current native `artifacts/866/native/result.json` in the geometry
analysis checkout, `output/issue1226/resume-ui/smoke_device_contacts.log`, and
`ui-five-followup.md`. `smoke_device_contacts` remains RED. Later group-restored
failures can be cascades of this first unwanted commit; lost capture needs its
own isolated event-order proof and is not declared a separate defect here.

## Unresolved: shared-boundary Resize and thickness

The current Resize producer creates two moved horizontal segments ending at
`.45/.5`; the fixed lower room retains its whole `.1/.5 → .5/.5` edge without
an incident node at the new junction. The old six Resize checks remain RED.
Current minimal probe: `repros/current-resize-incident-node.mjs`. Do not claim
that the accepted #1231 fixture repair fixed or failed to fix this operation:
#1231 selected its named room instead of an unrelated canonical array index.
The required ownership/contact contract needs an independent positive witness.

The thickness transition separately stores coincident, oppositely directed
edges with 10cm and 0cm material; measured intervals are `[10,0,0]` rather than
`[10,0,10]`. Separate coincident material can be intentional under #1216, so this
is a retained diagnostic, not an automatically filed product bug. Details and
exact source are in `geometry-latest-followup.md`.

## Unresolved: complete Optimize target and corpus identities

The original #248 Optimize output differs from both raw exact migration and
the historical lattice-normalized model10 target. Its second pass is already a
no-op, but that alone does not justify replacing its full target. The new shared
current storage fixture tests the migration facade only; it must not be used to
accept Optimize output automatically.

All 229 historical corpus sources remain available, alongside current inputs
under separate provenance. The original complete passport is still RED; atom
and host mapping deltas are not accepted by count or nearest-edge matching.

## Safe stale contracts that were ported

- More Info: move the real pointer off prior help before the layout/selection
  sweep; never hide the help or force the picker click.
- Furniture: right-clicking an existing item selects it and opens its context;
  the empty-point primary stamp and Cancel/blur/capture guarantees stay checked.
- Compact header: direct actions may wrap under accepted #1184/#1207, while
  44px targets, real bounds and stage placement remain checked.
- Opening preview: the demo card was fixed at 780px, so viewport-only resizing
  never resized its host. The port really resizes the embedding and retains both
  the old body-paint positive and zero full-floor work throughout held input.
- Cold reload: external desktop fixture styles must be restored before using
  desktop-only zoom controls. This does not change the product camera.

## Confirmed: discovery seeding after a full import invalidates import Undo

In audit 41662157218, the genuine model10 off-wall import was accepted and
survived reload with its exact expected graph/opening. The server initially
reported `can_optimize_undo=true`, `undo_kind=import`, config/layout revisions
98/42. A newly loaded editing card then sent `houseplan/config/set` with
`expected_rev=98`; the only semantic config change was adding
`settings.filter_seeded`. The next read returned revisions 99/42 and no Undo.

This is normal discovery seeding (FILTERING.md:45,64–73), but its automatic
write consumes the full-import snapshot. Real imported plans without a saved
discovery checkpoint can therefore lose Undo without an intentional user edit.
The older genuine1.62 main control also automatically adds
`settings.marker_area_snapshot` after import (config96→97); its journey does
not assert full Undo. Both automatic-maintenance paths remain findings.
No product fix is made in #1225/#1226.

The new synthetic literal model10 control had empty settings, while its genuine
old parent seed already contains the documented discovery checkpoint. A fixture
port may inherit those existing checkpoint keys from that parent before import;
it must retain all genuine geometry, opening, metadata and full Undo assertions.
That port does not prove Undo survives automatic seeding in an unseeded plan.

## Cross-journey test isolation: full import intentionally erases vacuum history

The new model10 control fully imports a plan without the vacuum marker.
Successful full import invokes orphan-trail cleanup. VACUUM.md:663–669 explicitly
requires immediate durable deletion of a removed marker's trail; restoring or
re-adding the marker starts fresh. The test seed guard restores config/layout,
but cannot restore that erased history. A later vacuum test sees its restored
marker/calibration and no stored trail.

This is a test-isolation diagnosis from the accepted purge contract and applied
full import, not a captured empty trail/get response. The vacuum drawing and
live-history assertions remain required. A safe test arrangement must give the
trail journey its initial seed before destructive full-import journeys, or an
independently seeded lab; it must not skip/relax drawing or restore .storage.

## Confirmed: valid legacy0/22cm drafts are forced into one carrier on migration

The unchanged historical source
`478-room-draft-migration-vectors.json/accepted/input` has fingerprint
`f916903d1b0385267195278c6fcb33adfb698d537ac3bb6fd8dbbf3935082bc4`.
Frozen legacy decoding preserves four positive-length, separately identified
partitions. Two overlap exactly on [.25,0]–[.5,0] with opposite directions and
legal distinct thicknesses0/22. There are no room/host/self-crossing/resource
problems in this input. Current migration refuses `plan-graph:thickness-conflict`
because its geometric node-pair grouping elects to merge those carriers.

Accepted #478 preserves valid drafts one-for-one with their own cm; #1167 allows
independent exact node identities when an optional join is incompatible; #1216
supports coincident independent carriers and does not equate cm0 with absent
material. A separate current graph witness retains all four original carrier
IDs/endpoints/cm under independent node IDs and passes graph validation. It is
not substituted for the failed migration's output or prescribed as the final
contact topology. Do not pick max(cm), discard the zero carrier or rewrite the
original input. Product fix/clarification and TS/Python parity remain required.
Full bounded evidence: `corpus-review/two-refusals.md` and inert snapshots beside
it. No new issue/product fix was made; this case remains RED.

## Confirmed infrastructure finding: overly broad test-input identities

The reused fallback41679296259 restored the prior cache successfully but reused
zero of its539 plan steps (504PASS/33FAIL/two not-required;74m13.695s). A read-only
comparison of both actual plans/reports, the native matcher and catalog source
confirms unchanged execution-environment keys and byte-identical build/test-build
outputs. Those preparations deliberately run again because builds/ZIPs are not
restored by the process contract; their repeated execution is not a cache defect.

The unnecessary invalidation breadth is concrete:

- Changing `demo/smoke_device_more_info.mjs` matches516 steps: all512 browser
  checks, both golden groups, measurements and demo-assets. `browserInputs`
  declares `demo/**/*.mjs`, and icon scanning also includes all demo sources.
- Adding `test/fixtures/optimize-storage-roundtrip-current.json` matches all11
  Node groups because each initially declares the entire `test/fixtures/**`.
- The changed Python test invalidates its one combined backend group.

Thus an unrelated test-file edit invalidates hundreds of independently authored
browser checks even with unchanged product bytes. This is a conservative input
scope issue, not a broken restore or an environment change. Exact counts,
fingerprints and the three read-only probes are in
`reuse-scope-diagnosis.json`. A future process change can narrow declared test
closures while retaining actual shared helpers, dynamic-reader and icon-source
dependencies. No pipeline/cache code, workflow, filter or CI run is changed here;
no new issue is created for this finding.
