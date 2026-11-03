# #1225: pinned companion material for ordinary code review

The substantive task includes `Matysh/houseplan-e2e` PR18. The ordinary reviewer
has read-only Git tools for this product repository only (`network=false`), so
this directory supplies the external sources as inert text. This is review
material, not a new mechanism, gate, workflow, certificate or test selection.
No tests/build/lint/link checks are required because of this documentation.

- External repository: https://github.com/Matysh/houseplan-e2e
- PR: https://github.com/Matysh/houseplan-e2e/pull/18
- Exact base: `115ae6f985f084696cde3f419d88d7751c4de972`
- Exact head: `a5ba81afb2b624e6b84d9b3605c63e97322efb25`
- Full original Git diff: `companion-full.patch` (including all24 changed files).
- `MANIFEST.json` maps each original path/ref to its complete text snapshot,
  original Git blob ID, SHA256 and byte count. Sources were read using Git show
  at the exact revisions; `.txt` suffixes make them inert review material.

The existing review `read_file` tool can read each tracked snapshot in this
repository at `head`, with `start`/`count` pagination (maximum500 lines). It does
not need external network access, a shell, another checkout or a test run.
The complete changed sources are available under both `companion/base/` and
`companion/head/`; newly added source paths have no base file. Relative-import
helper context is included at the revisions that use it. Additional execution,
package, contract and synthetic seed context is included under head. Unchanged
binary image pixels are not duplicated as source; their paths are ordinary
pre-existing test inputs, not altered by this change.

For example, read:

- `docs/testing/issue1225/companion/head/tests/plan-model.setup.mjs.txt`
- `docs/testing/issue1225/companion/head/tests/lib/visible-plan-target.mjs.txt`
- `docs/testing/issue1225/companion/head/tests/lib/profile-fixtures.mjs.txt`
- `docs/testing/issue1225/companion/head/tests/panel-profiles.admin.spec.mjs.txt`
- `docs/testing/issue1225/companion/head/tests/lib/backup-fixtures.mjs.txt`
- `docs/testing/issue1225/companion/head/tests/transfer-import.admin.spec.mjs.txt`
- `docs/testing/issue1225/companion/head/tests/transfer-export.admin.spec.mjs.txt`
- `docs/testing/issue1225/companion/head/tests/space-copy-lifecycle.admin.spec.mjs.txt`
- `docs/testing/issue1225/companion/head/tests/lib/exact-graph-first-space.mjs.txt`

These entry points help locate the change; they do not limit review scope. The
manifest/full diff includes the remaining changed tests, fixtures and context.
The product runner itself remains directly readable at
`process-next/lib/e2e.mjs` with its tests at `process-next/test/e2e.test.mjs`.

## Behavior and evidence boundaries

The original legacy seed still enters the current wall model through visible
native Draw, accepted commit and Undo; portable current fixtures are a separate
case and do not replace this preparation. Visible targets use public SVG CTM,
hit testing and unobscured canvas, without private product state/camera writes.

Current profiles use API2 views. The explicit v1 reader proves Cancel and inner
OK have no durable migration, Continue retains the unsaved draft, Discard drops
it, and one outer Save/ACK creates v2 and survives reload. Exact graph identity,
wire lattice, Undo/Redo, permissions and durable server oracles are retained.

The versioned transfer fixture distinguishes legal independent coincident and
exact off-grid partitions from mismatched current projections and a genuine
zero-area legacy cycle. It preserves the current repair case, genuine model10
repair, original model5 journey, full pair/revisions/Undo checks and whole room
metadata. Frozen producer data has an exact source precondition; it is not a
runtime normalization of an unexpected graph. Copy follows the accepted #1227
contract: accepted saved geometry without Optimize/preflight, while retaining
all four composition cases and checking real Optimize traffic stays zero.

Historical actual HA results and scope limits are in the snapshot
`companion/head/task-impact/houseplan-card-1225.md.txt` and its per-case JSON.
Those are author evidence, not a substitute for independent code review.
Earlier advisory on6103fce did not certify subsequent A-D/profile/Copy changes.
The final common diagnostic run41662157218 pins product0bda944e3244a142449c30c5f802c14833af8c66
and this exact companion head; it is still running when this packet is written.
Do not infer a PASS of its77 scenarios or of #1226 from this packet.
