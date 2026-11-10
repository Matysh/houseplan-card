# Exact structural plan graph (#1167)

Model 11 completes stages 2–3 of [ADR #282](adr/282-wall-geometry-representation.md).
Each space has one `plan_graph` version 1. The room polygons, wall catalogue,
partitions and `walls[]` are generated compatibility/render projections. They
cannot replace graph identity. Thickness offsets, mitres and continuous decor
remain render geometry. Stage 4 (#1216) computes model-11 masonry directly from
the accepted graph; legacy readers retain their previous renderer.

## Wire and identity

`nodes` contain `{id,p}`. A point is `['l',ix,iy]` for integer indices on the
1/240 grid, or `['q',xn,xd,yn,yd]` for reduced exact normalized coordinates.
All integers are canonical decimal strings; denominators are positive. A point
representable on the grid always uses `l`. Each numerator/denominator is bounded
to 4096 bits, coordinates to ±5000. Conversion to a render double rounds the
whole ratio to nearest, ties to even; independently converting huge numerator
and denominator is invalid.

An edge is `{kind,id,from,to,cm,props?}`, with kind `wall` or `partition`.
Identity is `(kind,id)`, not a coordinate or a midpoint key. `props` preserves
supported opaque segment attributes. Room cycles contain
`{room,edges:[{kind,id,reverse}]}`. Room names, areas and settings remain on the
room object. Intentional detached nodes may have identical coordinates and
different IDs. They are not merged by current-model reads or saves.

Dependencies contain `{node,kind,refs,parameters}`. Each support ref is a pair
`{from,to}` of node IDs, not an edge ID: the support remains meaningful after
its physical edge is split. The DAG evaluates supports before dependents.
`on-edge` has one support and rational parameter; `intersection` has two.
Explicit moves/deletions must update or retire affected constraints.

Select node movement (#1303) owns only its selected node; other graph vertices
are fixed ends. A retained split-carrier constraint is reparameterized at its
unchanged exact point. A support that is no longer a connected straight run
through the dependent, including a bend at an intermediate vertex, is retired
within the same command. Already-saved broken supports are handled when that
carrier is explicitly edited; reads do not rewrite the plan. Generic graph
operations retain affine DAG propagation. The browser preview and server-owned
node writer apply the same intent, with exact Undo/Redo.

Select node merge (#1305) explicitly names source and stationary target IDs.
The target's stored exact point survives; source incident edges are rewired to
it, and direct source–target edges are removed in the same atomic command.
Room cycles lose those edges but must remain valid. Hosted openings on removed
edges refuse the command. Compatible degree-two collinear seams use existing
lossless compaction. Generic Move, Save and Optimize do not merge nearby nodes.
The server independently reconstructs the intent and proves host lineage,
junction safety and exact history.


Select dangling-end attach (#1330) preserves the source node ID and explicitly
names a receiving finite edge, reduced rational parameter and one new edge ID.
Only a degree-one source may attach; corners and existing junctions refuse.
The old edge retains original.from → source, the allocated child continues
source → original.to. Room cycles, opening parameters and fixed exact foreign
vertices survive the same atomic edit. The source becomes an on-edge dependent
of the original receiving endpoints. Each new child obeys the 20cm/material
minimum even though the global length guard measures a whole collinear run.
The optional node_move attach_edge and runtime wall_node_attach_api:1 are
separate from Merge. The server replays both directions from the accepted
source and compares the complete candidate before granting host lineage.
Generic Move, graph on-grid admission and other writers are unchanged.

Explicit numeric editor targets recognize a lattice coordinate within the
existing `1e-4`-step coordinate-noise allowance. Nudge, body translation,
axial opening movement and safe Resize add proven lattice origins/offsets as
integer indices before projecting them. Resize tests projection identity for each
ordinate separately, including expanded atoms and corner-only targets, so a
changed x cannot snap an unchanged legacy q in y (and conversely).
Unchanged axes stay unchanged; raw
source decoding, graph validation, metadata-only writes and exact dependent
intersections do not round existing `q` points. Legacy optional normalization
prefers a lattice anchor within that noise allowance and the original movement
radius; subsequent contact projection retains that accepted anchor.
New/explicitly moved openings and openings on changed graph carriers also use
the normalized graph projection for their angle, matching Optimize rather than
subtracting separately scaled render endpoints. Unrelated hosts and metadata
writes preserve their existing angle fields.

Opening hosts retain `{kind,id,t}` and add exact `tq:[numerator,denominator]`.
`t` is its correctly rounded numeric projection. Metadata edits preserve `tq`;
explicit moves/rehosting update it. Splitting or reversing an edge remaps the
parameter and preserves the physical opening and door-side flags.

Node movement retains the exact world centre on a still-collinear host. For a
rotated host, both mirrors derive the fixed-end distance policy from one
correctly rounded exact squared-length ratio and one IEEE square root, then
combine that ratio with the exact previous parameter. Language-specific hypot
rounding does not become a different persisted `tq`. A node collapse refuses an
opening whose exact centre would leave its new carrier rather than silently
projecting it to a nearby point. Numeric server intents use the same bounded
authored-grid allowance as the frontend; explicit `target_p` and stored `q`
coordinates retain their exact values.

## Automatic legacy normalization

The first structural write, import or explicit Optimize freezes the original
legacy geometry before old lattice/decimal snapping. There is no migration on
View, HA state ticks, metadata-only saves or pointer movement. Legacy scalar and
paired recovery still precede this boundary; the store and export envelope
versions do not change merely because the plan model becomes 11.

For a space with centimetres per cell `cell_cm`, the total endpoint movement is

```
R = min(1/1200000, 0.1/(240*cell_cm)) normalized units
physical_cm = normalized_distance * 240 * cell_cm
```

The bound is Euclidean from each ORIGINAL endpoint for the entire pass. It is
0.01 mm at the historical 5 cm default and never exceeds 1 mm. Chained proximity
does not expand the bound. Comparisons use exact squared distances.

Proven source ownership/hosts and T/intersection contacts have priority.
Remaining candidates are ordered by exact displacement and stable canonical
references; array order and input edge reversal do not decide identity. The
spatial index bounds candidate search. Both ends must leave a nonzero, valid
edge with valid room ownership and hosts. An inadmissible optional join chooses
the next valid candidate or an explicit independent node. A required contact
may anchor at its original owner and split/bend the supporting carrier within
every owner's original bound. There is no user approval of microscopic shifts.

The existing whole-plan Optimize may deliberately align geometry farther than
R. Its existing preview/confirmation and Undo cover that broader operation;
there is no additional micro-repair confirmation.

Coincident legacy partitions with different thickness remain independent
carriers, including a zero/positive pair. Compatible same-material atoms can
still share the existing migration mapping; differing material is not a reason
to reject an otherwise valid legacy plan.

Optimize's numerical maintenance readers use their actual draft projections,
without projecting the previous graph back over proposed changes. Opening
continuity still comes from named graph runs. In a current graph a numerical
lattice proposal cannot detach a valid dependent junction or bend its exact
support. Without a repair grant, a dependent lattice target is accepted only
when it lies exactly within every proposed support's [0,1] interval and each
support is exactly horizontal or vertical. This safe axial sliding updates the
dependency parameter; diagonal `q` junctions instead follow support evaluation,
even when their rounded coordinates would remain on the diagonal. Model 11 is
a storage format, not provenance: imported or writer-migrated plans can still
need axial alignment. A source that enters Optimize before model-11 migration
retains the former legacy literal-target policy. Approximate off-grid echoes
retain exact affine incidence. An explicit near-axis retarget grant requires
the named carrier to be near-axis in the accepted graph, rather than become so
in a numerical alignment draft. The grant names only graph nodes
whose numerical room vertices or partition endpoints that repair actually
changed, within their own space; it never applies to another component or floor.
Already-applied move/support operations
remain the baseline for subsequent structural maintenance. Room targets own
shared nodes, while numerical partition compaction cannot move detached graph
endpoints. A conversion requires a complete exact room carrier; an unsplit
contact can be split explicitly at existing named nodes. Unproved subspans
retain their source carrier. Reconciliation protects a hosted opening's full
footprint and independent overlapping material, including across graph seams.

## Writers and authority

### Node save validation (#1306)

The authenticated node-move writer (including Merge and its inverse) creates
one executor-local `graph_validation_scope`. Only successful exact JSON-value
proofs are retained. Hits bind fresh mutable graph records to detached immutable
point/adjacency facts; input mutations, non-JSON Python container types and
changed room-owner restrictions cannot borrow a proof. Projection proofs are
separate and include the complete space/context. The scope is cleared on exit;
it grants no ACL, CAS, host-lineage or Undo authority.

A verified model11 node uses incident graph vertices instead of the legacy
all-pairs intersection search for both admission and carrier sweep. Proper
crossings without a represented node remain invalid. Isolated vertices retain
the invalid-node refusal. Exact host geometry is indexed once outside the
opening loop; independent physical, graph, projection, host and limit rules stay.

Only `schema_clean_rev == stored rev` permits the existing scoped schema path
and local normalization of the target space. Cold/legacy data take the full
path. The schema-checked canonical candidate crosses the same central durable
Store barrier with `previous` and `canonical=True`; node and ordinary config
writes are the registered callers. The node writer re-stamps only after durable
success. Import/other writers and failed saves invalidate the stamp. Exact-rev
junction counts and touched spaces protect unchanged floors; visibility never
exempts potentially affected geometry in the edited floor.

The client signs the conservative local source/candidate proof inputs after
the existing closure pass. Remote floors are not serialized on each held miss;
changed foreign geometry enters the closure before reuse is considered.
Revision, authority epoch and context changes retire it; in-place local edits
recheck, and negative hits retain their specific refusal. Accepted
configuration/history still wait for ACK.

`scripts/benchmark-node-save.mjs` generates the synthetic 100/1000/5000-edge
inputs; `scripts/benchmark-node-save.py` compares sequential production CPU
stages against a pinned source root, with warm-up, raw samples, median/p95 and
accepted-content hashes. It excludes Store/network/executor/UI. Real HA tests
cover that boundary separately; native pointer smoke observes the actual
junction guard callsite through release. These diagnostics are not a new
mandatory global task gate.

### Native editor fixed point (#1285)

A model-11 plan authored from an empty space with the current editor is already
an Optimize fixed point. Completed chains and sequences of Draw (including
existing-node/on-edge contacts and diagonal T junctions), room tracing, body
translation/detach/delete, keyboard nudge, opening placement/movement,
thickness, Resize, room Merge/Delete and node deletion preserve a valid graph
and its exact projections. Optimize returns `changed:false` immediately, with
zero effect counters; it is not a deferred last stage of these gestures.
This includes a first no-op after native Resize, rather than convergence after
several Optimize passes. Genuine dependent points on diagonal supports may
remain rational `q` coordinates: the invariant never snaps them off their
supports merely to make every point a lattice point.

This includes the config/layout pair: deleting a room or an absorbed Merge room
removes its moved label, deleting a space removes its owned positions, and
deleting a marker removes its position in the same candidate. Undo restores
the corresponding positions. The orphan/remap/dead-space effect counters are
zero after these native commands (#1287).

Imported sh3d/Easy/picture-elements plans, backups
from another installation, legacy automatic migration, manually edited JSON
and writes from a stale cached client are outside it; Optimize remains their
explicit maintenance path. Positions whose owner is unverified or whose
registry is unavailable are outside the native-input invariant. They are not
deleted speculatively. A conservative Optimize no-op also does
not prove that overlapping material of different thickness or an unverified
overlap is physically sound.

`test/graph-editor-invariant.test.mjs` exercises production writers without UI
or HA from an empty current graph, never from an Optimize-prepared fixture.
It retains the three original pre-fix counterexamples and replays 210 seeded
sequences of at most twelve commands. `HP_GRAPH_SEQUENCE_SEED` reproduces a
run; a failure prints that seed and saves a reduced replay under
`output/1285-sequence-failures/`. The native room-label deletion counterexample
and `test/graph-editor-layout-invariant.test.mjs` extend this to config/layout:
another 210 seeded sequences cover moved labels, devices/tombstones, room
deletion/Merge, blocked space deletion and both permitted deletion modes.
`HP_GRAPH_LAYOUT_SEQUENCE_SEED` reproduces that paired run. All completed
prefixes are checked, so a later deletion cannot conceal earlier repair debt.
The existing geometry corpus also commits actual graph Resize targets, proves
source-material lineage and requires the first Optimize to be a no-op; it no
longer permits several repair passes over a projection-only numeric draft.
For changes to graph-edit-intent, graph-optimize, plan-optimizer and these writers,
the author selects the mechanism through the ordinary task request's `areaTests`
(`process-next/lib/catalog.mjs`), rather than a new global gate. The selection used
for #1285 is:

```json
{
"areaTests": [
  "test/graph-editor-invariant.test.mjs",
  "test/graph-editor-layout-invariant.test.mjs",
  "test/graph-dependent-optimize.test.mjs",
  "test/graph-edit-intent.test.mjs",
  "test/plan-graph-optimize.test.mjs",
  "test/geometry-corpus.test.mjs",
  "test/near-axis.test.mjs",
  "test/plan-optimizer.test.mjs"
]
}
```

Both 210-sequence tests run in the affected-node step of that request. These
files add no mandatory gate to unrelated product tasks.

### Stable identity and transport

TS/Python use the same exact graph contract. Editor commands name stable IDs
and explicit scope: move or detach, insert on edge/intersection, create/delete
edge or face, resize, thickness, rehost, normalization, copy or history restore.
Numeric drafts provide targets only. A changed polygon is never permission to
reconstruct a current graph. The backend independently validates the graph,
projections, hosts, physical geometry, ACL, context and expected revisions.

Completed detach/delete, face acceptance, room merge/deletion and thickness edits
compact only their affected degree-two collinear seams. Neighbours must have the
same kind, thickness, opaque properties and room owners. A support for another
dependency, another carrier's exact physical contact, a material breakpoint or
an opening footprint crossing the seam keeps it structural. Hosted openings on
either remaining span retain their physical positions through exact `tq` remaps;
split/conversion lineage continues to name live edges. Unrelated components are
not swept. The full opening-footprint protection is shared with Optimize so it
cannot later remove a seam deliberately retained by the editor. A live Draw
chain keeps its last named endpoint for the next click;
its existing finish performs the chain's own compaction.
When one carrier is explicitly named by the edit, it survives compaction so
Properties and physical-selection guards can still resolve the user's target.
Only ties between equally named/background carriers use the stable edge-key order.
This also covers completed edits to an existing named partition, including a
properties-only thickness change whose endpoints remain unchanged.

The first legacy write carries `graph_change` version 2: per-space
`{space_id,base_digest,patch}`. SHA256 covers UTF-8 compact tuple arrays of
codepoint-sorted nodes/edges/room cycles/dependencies; numeric thickness is
big-endian IEEE754 hex and exact points/parameters remain canonical strings.
Opaque props are excluded. Version 1 with a full diagnostic `base` remains
supported. Digest mismatch is bounded technical diagnosis, never a refusal
or a reload loop. The backend normalizes its OWN
accepted source, applies the explicit patch, and returns the actual accepted
config/pair. The submitted baseline is diagnostic correspondence, not server
authority. This preserves the first gesture without a hidden preliminary save
or a false TS/Python preview mismatch. Current writes use graph replacement
plus CAS; projection-only stale writers are rejected.

`config/get.graph_change_api:2` advertises v2. Without that literal capability
the frontend sends v1, including the former baseline, for first Save/Optimize/
Copy writes. New clients therefore remain usable with a v1-only backend; old
clients remain usable with the new backend. This transport capability is not
a persisted config grant and does not alter `plan_graph_api:1`.

Ordinary history snapshots contain the graph. The first Undo baseline is the
normalized model-11 plan: Undo cancels the gesture, not the automatic migration.
Optimize/import Undo retain paired atomicity and never overwrite the original
migration backup. Copies remap node/edge/dependency IDs explicitly.

Metadata intents refuse implicit geometry/host/projection edits instead of
silently losing them. Allowed carrier props are explicitly transferred to
canonical edge metadata. Columns/decor remain separate namespaces. Both
projections use canonical room-ID order; migration can reorder legacy JSON
`rooms[]`, including overlapping/nested room layers and hit ownership. Room
identity/bindings and user space order do not change.

## Durability, transport and privacy

Before a durable first transition, a separate immutable source store preserves
the original logical config/layout pair, revisions and model. Its reference and
digest are read back before the existing paired intent begins. Migration
metadata contains a small reference, not a repeated copy of the large source.
Existing scalar migration backup and unknown metadata siblings remain intact.
Recovery yields the old pair or the complete accepted pair; events follow
durable commit. No-op retries add no revision or second migration.

Administrators can export the source through `houseplan/export/create` with
`kind:'full', plan_graph_migration_source:true`. This does not automatically
restore an old pair over later edits. Older backends cannot read model 11;
downgrading requires an appropriate source/compatible export.

Backup reuse requires the same logical pair, revisions, model and passports.
After downgrade/legacy edits a new immutable source contains the prior reference
at `passports.previous_backup`. Admin export can select a verified ancestor by
`migration_source_sha256`; absence selects the current source. History is never
overwritten and an arbitrary store cannot be selected.

Upload records have one owner: the HA event loop. Executor work receives an
immutable bytes snapshot and an opaque identity/revision lease; hash/parse/schema
work cannot touch the manager. Identity, revision, TTL, user and write permission
are rechecked after awaits, then the token is consumed once before the domain
writer's ordinary CAS. Cancellation/replacement cannot resurrect a token.

## Direct masonry (#1216)

`direct-wall-geometry.ts` groups exact-coordinate render contacts, including
distinct node IDs, and adds virtual spans for exact endpoint-on-edge T contacts.
None of this is stored. Rational source directions determine angular order.
Finite strips and mitre/bevel/cap domains preserve the established exceptions:
multi-ray nodes use sanity 4 / visual 1.5H; two-ray independent walls retain
their full drawing-point mitre (#310). Room facade offsets keep their 4H bound
and inherited degenerate room apices end at the original vertex (#329/#339).
Exterior runs come from the exact room-centre subdivision, with shared internal
half-edges removed, so a different room cannot supply a concave facade wedge.
Thick support stops at its actual endpoint. Local trims and hosted cuts
use half-plane formulas before material combination. Foreign material remains
opaque, including a distinct exactly collinear wall behind a partition door
(owner decision 2026-11-03). The same retained domains support alternate light apertures.
The floor slab uses room-owned incidence only: an independent partition at a
facade corner cannot enlarge it. Room centres plus their complete masonry form
the paper underlay, with actual courtyard holes and no orphan triangular holes
beneath continuous material. Mixed room/independent junctions additionally require
actual room-masonry coverage for the paper facade (#1327): exact room-only
facade domains cannot leave exposed tips where full incidence chamfers masonry.
Room centres remain included; independent rays never enlarge the slab.

`wall-arrangement.ts` nodes those finite boundaries: exact-line interval sweep,
AABB candidate search, exact intersections, symbolic infinitesimal side tests
and directed boundary tracing. Computed binary64 offset vertices enter once
as exact dyadics; intersection/topology predicates never use a sample epsilon.
No polygon union/difference or legacy repair path builds model-11 masonry.
Current room inner floors classify those same exact material boundaries against
room membership (`room && !roomMasonry`). They never feed rounded masonry rings
back into polyclip: almost coincident converted vertices can break its output
ring. Empty floors remain empty, and no numeric exception is converted into an
uncut floor. Explicit proof subtraction ports keep their own unit contract.
Independent decor/area operations can still use their own polygon tools.

Readonly graph authority follows ephemeral room/partition projections. View,
Static/ISO/PDF, previews, inner contours, fit, contact, light and physical guards
share the result. Retained geometry reports its coordinate scale before a guard
uses normalized units. Geometry demand remains per floor and independent of HA
state and known presentation fields; hidden floors have no background rebuild.

The comparison tolerance in normalized units is
`tau=max(1e-12,64*Number.EPSILON*max(1,maxAbsSourceCoordinate,maxHalfDepth))`.
Area comparison allows `tau*P+4*tau*tau*V`. Scale multiplies tau, never structural
identity or movement R. There is no near-node merge, tiny-hole deletion or
successful empty result on failure. A failed direct pass refuses physical writes.

Legacy migration retries optional normalization, conservative normalization,
then pinned mandatory owner contacts and exact noding of the actual bent spans.
Every retry still starts at original source and obeys ORIGINAL Euclidean R.
The shared witnessed corpus covers required contacts near foreign crossings,
permutation/reversal, parity and the edge of R; incompatible input stays atomic.

Config is bounded to 16 MiB and portable documents to 32 MiB. Structural,
paired and history messages above 3 MiB use the common authenticated HTTP upload
(maximum 32 MiB), followed by the same WS command with a compact token/digest.
The token is purpose/owner-bound, single-use, expires after 120 seconds, and
does not grant write authority. One staged message per user and 64 MiB aggregate
are allowed. ACL/context/CAS are checked again after awaits. Stock HA's 4 MiB WS
incoming limit is not changed. ZIP expansion/object limits remain independent.

Support uses its separate 8 MiB closed protocol and matching relay schema.
Its exact geometry is pseudonymized; original IDs, opaque private props,
source backups, names and URLs are not copied into that projection.

The accepted issue contains numbered acceptance criteria. Addressed tests cover
exact round trips and source bounds, TS/Python parity, every writer class,
authoritative first-write adoption, history, token/ACL/CAS/fault recovery and
native editor actions. Performance series distinguish graph-only moves from
physical validation and full Optimize; a helper microbenchmark alone is not
evidence that the complete editor satisfies its behavior.

Room-candidate topology (#1346) excludes graph bridges only from bounded-face
walks: a dangling internal partition or a bridge between cycles cannot erase an
otherwise closed boundary. Atoms and source provenance remain intact; no wall,
opening, stored graph or exact endpoint is removed or joined. Face boundary
provenance excludes those non-cyclic edges, so Draw does not claim an old face
when adding a dead end. The derived bridge search is iterative and linear in
vertices/atoms; genuinely open perimeters remain unclosed.
