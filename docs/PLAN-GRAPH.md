# Exact structural plan graph (#1167)

Model 11 completes stages 2–3 of [ADR #282](adr/282-wall-geometry-representation.md).
Each space has one `plan_graph` version 1. The room polygons, wall catalogue,
partitions and `walls[]` are generated compatibility/render projections. They
cannot replace graph identity. Thickness offsets, mitres and continuous decor
remain floating-point render geometry; stage 4 is a separate decision.

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

Opening hosts retain `{kind,id,t}` and add exact `tq:[numerator,denominator]`.
`t` is its correctly rounded numeric projection. Metadata edits preserve `tq`;
explicit moves/rehosting update it. Splitting or reversing an edge remaps the
parameter and preserves the physical opening and door-side flags.

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

## Writers and authority

TS/Python use the same exact graph contract. Editor commands name stable IDs
and explicit scope: move or detach, insert on edge/intersection, create/delete
edge or face, resize, thickness, rehost, normalization, copy or history restore.
Numeric drafts provide targets only. A changed polygon is never permission to
reconstruct a current graph. The backend independently validates the graph,
projections, hosts, physical geometry, ACL, context and expected revisions.

The first legacy write can carry `graph_change` version 1: per-space baseline
graph plus a patch of graph records by ID. The backend normalizes its OWN
accepted source, applies the explicit patch, and returns the actual accepted
config/pair. The submitted baseline is diagnostic correspondence, not server
authority. This preserves the first gesture without a hidden preliminary save
or a false TS/Python preview mismatch. Current writes use graph replacement
plus CAS; projection-only stale writers are rejected.

Ordinary history snapshots contain the graph. The first Undo baseline is the
normalized model-11 plan: Undo cancels the gesture, not the automatic migration.
Optimize/import Undo retain paired atomicity and never overwrite the original
migration backup. Copies remap node/edge/dependency IDs explicitly.

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
