# #1225: pinned companion material for ordinary code review

The substantive task includes `Matysh/houseplan-e2e` PR18. The ordinary reviewer
has read-only Git tools for this product repository only (`network=false`), so
this directory supplies the external sources as inert text. This is review
material, not a new mechanism, gate, workflow, certificate or test selection.
No tests/build/lint/link checks are required because of this documentation.

- External repository: https://github.com/Matysh/houseplan-e2e
- PR: https://github.com/Matysh/houseplan-e2e/pull/18
- Exact base: `115ae6f985f084696cde3f419d88d7751c4de972`
- Exact head: `827fb417858e10e2362092e26960f7c8ae4c5ac0`
- Full original Git diff: `companion-full.patch` (including all27 changed files).
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
The third common audit41662157218 used product0bda944e/companiona5ba81a:
77 executed =73 passed,3 failed,1 timed out; no skips, setups10/10 passed.
`HA-41662157218.json.txt` preserves the translated primary counts and per-case
result paths. This is author-readable evidence, not a replacement for code review.

The four remaining fixtures were corrected after that run, without removing
oracles: Copy explicitly proves a loaded roomless copy with all four real
zero-wall endpoints plus whole-space reload durability; only the oversized
negative uses a bounded, uniquely correlated public CDP Network observer of the
same real POST/status/body (no routing, repeat, mock or raw request in receipts);
the literal10 input inherits only the historical discovery checkpoint from its
original parent while preserving geometry/opaque/opening/Undo assertions; and
the immutable vacuum trail journey runs before destructive full imports using
the existing single-worker filename order, with a real trail/get precondition.

Additional current source entry points:

- `companion/head/tests/lib/preview-observer.mjs.txt`
- `companion/head/tests/00-vacuum-trail.admin.spec.mjs.txt`
- `companion/head/.github/workflows/e2e.yml.txt`

The last file adds only the missing pinned Chromium prerequisite before the
existing browser-dependent unit tests; no new workflow or gate is introduced.
A real unseeded-backup/background-write Undo invalidation was observed separately
and recorded in the integrator's findings file; these fixture changes do not
claim to fix it. The current literal10 checkpoint preserves filter_seeded; the
ordinary foreign-transfer rule still clears known_devices/new_device_ids.

Current common diagnostic41679296259 pins product1f3a0f343f881ef59446c664baace3df8e72a635
and this exact companion827fb417858e10e2362092e26960f7c8ae4c5ac0. It is running
when this packet is refreshed. Do not infer a PASS of its77 scenarios or of#1226.