# ADR #282 — Wall geometry representation

- Issue: https://github.com/Matysh/houseplan-card/issues/282
- Status: accepted; Stage 1 stored identity implemented, Stages 2–3 deferred
- Date: 2026-08-24
- Related: #34 (frontend decomposition), #264 (resize controller slice),
  `docs/WALL-THICKNESS.md`, `docs/ARCHITECTURE.md`

## Context

Nine of the last ten specifications are the same class of defect: #271, #272,
#273, #275, #276, #277, #278, #279, #280, preceded by #249, #250, #253, #258 and
#261. Over thirty days the wall geometry took 23 fix commits and
`src/wall-thickness.ts` alone took 46. The ten geometry modules contain 595
mentions of a tolerance or an epsilon; `src/resize.ts` has 154 in 1017 lines,
one every seventh line. The specs rate their own risk at 9 and 10 out of 10.

Two titles show where this has arrived. #279 is "a nearly orthogonal T
junction" — a defect caused by a deviation no one can see. #278 is "a local
extra-body union failure must not blank the whole masonry" — a specification
written not to stop polygon unions from failing but to reduce the damage when
they do.

Three properties of the representation produce that stream. They are properties
of the data model, not of any algorithm, and no amount of care in the algorithms
removes them.

**A coordinate is a float in 0..1 with a step of 1/240.** A lattice node is
`k/240`, which has no exact binary representation. A round trip through storage,
a multiplication by `NORM_W` for rendering and a midpoint computation each
introduce a difference in the last bits. #258 and #279 are that. So is the
ever-recurring non-idempotence of Optimize (#248): it looks for noise it cannot
remove, because the exact value it would write does not exist.

**A wall's identity is derived rather than stored.** `wallKey` is a quantised
midpoint plus an angle bucket, joined into a string. For a wall whose length is
an odd number of steps the midpoint lands exactly on a rounding tie — measured
in #258. The worse consequence is structural: because identity is derived from
geometry, every editing operation must re-key its records
(`rekeyWallsAfterMove`). One path that forgets loses a thickness record (#253);
an import that forgets leaves a dangling reference (#244, #252).

**A wall exists in two representations at once.** A room polygon edge, and a
separate thickness record addressed by key; an independent partition is a third
form of the same thing. "Is this edge part of a contour" is therefore computed
(`edgeKinds`, `sharedSegsOf`, `atomicPolyForRoom`) rather than stored. The
junction is drawn by boolean operations over offset polygons — the most
float-sensitive construction available. #197, #249, #261, #270, #272, #275 and
#278 all live there.

The owner states the target model in one sentence: a segment with endpoints on
grid nodes and a thickness; either part of a contour or not; openings lie on it.
That is exactly the model which removes the first two properties by
construction — a deviation from vertical becomes inexpressible rather than
caught by a tolerance.

It hides one thing that matters. Thickness belongs to the edge *between two
rooms*, and at a node where three walls of different thickness meet the shape of
the junction does not follow from any one segment: the node has to be an object
in its own right. Separately, a diagonal between two lattice nodes is legal
while its offset contour has irrational vertices — integers remove identity and
topology problems, not the arithmetic of mitres.

## Decision

Change the representation in four independently shippable stages. Each stage
removes a named class of defect and is worthless as a partial migration, so each
must land whole. Only stage 0 is accepted for implementation now; stages 1 to 4
are accepted as direction, in the same sense as #34 — a target, not a mandate to
create the files up front.

### Stage 0 — a representation invariant

Measure what is actually stored: for every coordinate in the model, how far it
is from the nearest lattice node, in steps. Report three populations separately,
because they are different problems:

- **exactly on a node** — nothing to do;
- **near a node but not exact** (deviation far below a step) — this is the noise
  class, the one that produces #258 and #279, and the one Optimize claims to
  remove and cannot;
- **far from a node** — geometry the current model legitimately allows, since
  nothing forbids an off-grid vertex today.

Stage 0 fixes nothing. It converts a silent property into a measured one and
answers a question nobody can answer today: how much of a real plan is in the
noise class, and where it comes from. It also gives Optimize a convergence
criterion that can be checked instead of asserted.

Deliberately not a red gate. The shipped fixtures contain authored coordinates
such as `0.06` and `0.2875`, which are 14.4 and 69 steps from a node — legal
today. A check that fails on them would be switched off in a week.

### Stage 1 — stored identity

Give every wall segment a stable `id`. Rooms reference segment ids; thickness
lives on the segment. Re-keying stops being a thing that exists, which removes
#253, #258 and half of #248 as possible defects. The schema gains a field, old
keys stay readable, and nothing in the renderer changes. This is the largest
reduction in risk per unit of work in the whole plan, and it does not depend on
any other stage.

### Stage 2 — an integer lattice in storage

Endpoints become node indices rather than floats. Equality is exact, midpoints
are exact when kept in doubled indices, and orthogonality is a comparison rather
than a tolerance. A single migration with a report replaces Optimize's endless
attempt at the same thing. The honest cost: a `STORAGE_VERSION` change, a
migration, and matching edits to backend validation and to import/export.

### Stage 3 — one planar graph

Nodes, edges carrying thickness and kind, rooms as cycles of edges. A shared
wall becomes one object instead of two coincident polygon edges, and "part of a
contour" becomes a stored fact. This is the owner's sentence expressed as a
model.

### Stage 4 — junctions in closed form

At a node of degree n with known thicknesses, sort the rays by angle and compute
the junction outline directly. No polygon booleans, therefore no slivers, no
"retained versus discarded wedge" ambiguity and no failure mode where one union
blanks the masonry.

## Consequences

Data already off the lattice does not fix itself. What to do with a vertex
3·10⁻⁷ from a node is a product decision for the owner, not a technical one, and
stage 0 exists to size it before that decision is taken.

Diagonals keep irrational offsets. Stage 4 must be tolerant there by design
rather than by accident, and that tolerance is legitimate — unlike the tolerances
that currently stand in for exact identity.

None of this cancels an open P1. The owner's installation has to work now, so
the visible defects still get fixed on the current representation, and the
stages proceed alongside.

The process consequence is immediate and independent of the code. Nine parallel
specifications currently edit one subsystem, each rating its own risk at 9 or 10
out of 10, and they list each other as related (#277 → #276, #278; #278 → #276,
#277). That is one task cut into nine branches which will conflict on merge.
#279 has already been accepted by self-review under an owner decision, which is
the process yielding to the throughput of the defect stream. The recommendation
recorded here: admit no new specification in this subsystem except one that
fixes something visible on a live installation, and spend the freed capacity on
stages 0 and 1.
