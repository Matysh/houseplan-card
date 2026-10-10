# Wall thickness — the spec

Visual reference:
[docs/assets/wall-thickness-reference.png](assets/wall-thickness-reference.png)
(look at wall bodies only).

Owner intent: thick walls form one continuous hatched body (seamless L and T),
grow both ways from the room centreline, fills/light stay inside the inner
contour, displayed area is the clean floor, and sun wedges start at the two
corners of the globally selected inner or outer opening face.

Code: `src/wall-thickness.ts`, render in `src/houseplan-card.ts` /
`src/space-render.ts`. Sun: `src/sun.ts`. Tests: `test/wall-thickness.test.mjs`,
`demo/smoke_wall_thickness.mjs`.

## 1. Model

### Select node movement (#803)

The node graph is derived once per gesture from structural segments, including
zero-thickness walls, never opening-cut render spans. Coincident owners do not
multiply physical rays. End nodes (1–6 rays), straight breakpoints, ordinary T
and pure X are supported; complex passing junctions are refused without capture.
T slides on its finite carrier. X locks the first unambiguous carrier axis and
bends the transverse whole wall, retaining far ends. A split retains the parent
ID on the child containing the original midpoint (tie: old a); the other child's
UUID is allocated once, including on non-secure LAN HTTP origins.

Original infinite axes and exact H/V positions are screen-space magnets (12 CSS
pixels). Diagonal quantization is longitudinal, from the fixed end, never a
second x/y rounding. Foreign connections, carrier-order swaps, collapsed edges
and openings crossing the old or new bend are refused. Openings preserve width,
settings and physical distance from their fixed far end, not their old host t.
An old finite fixed endpoint contact stays legal when formerly collinear walls
become angled (#828). Proven split children inherit only their parent's existing
contacts; this grants no new crossing, overlap, connection or infinite-line contact.

The live local component includes complete changed owners and far-end physical
neighbours. It uses production boolean geometry and junction guards; unchanged
remote components never enter the geometry pointer pass. Settled affected masonry
is masked, and one frozen source body/hatch/axis/zero-line layer is painted at .35
above candidate paper/fills, below the translucent candidate (#828). It keeps
original opening cuts, never old opening symbols or active handles; unchanged
neighbours retain ordinary pixels. Source coverage survives invalid candidates,
and every transient has one live owner through full Lit/hass frames. Invalid
latest positions never commit a previous valid frame. Paper,
room fills and opening cuts use that same candidate. Pointerup flushes the queue
and allows the final frame to paint before writing the whole atomic delta.

#834 computes only the newest queued target per animation frame, retaining
the first X-axis decision across raw events. The final input is flushed before
release; cancel/revision retirement removes pending work. The same snapped
point/axis reuses both valid and invalid results without rebuilding geometry.
The source mask/opacity overrides remain installed between live frames rather
than restoring and immediately hiding the same elements again. Only changed
overrides are written; departing room-fill overrides restore opacity with
transitions disabled before returning the original transition. Full host
renders rebind replacement elements and reapply overrides to changed styles;
cancel/disposal restores all owned styles. The generic editor layer hands over
once per captured gesture, not once per pointer candidate.
A numerical failure joining the computed masonry and exterior shell gets one
canonical-coordinate retry; original room/wall coordinates never change.
Each operand must preserve each outer boundary together with its own holes,
not merely a sorted list of ring counts. The rounded operand and normalized
result must have identical boundaries modulo ring/component order, winding,
cyclic starts, exact collinear subdivisions and zero-area retraces. Collinearity
uses exact decimal arithmetic, matching the clipping library's interpretation
of Number coordinates: no epsilon or second rounding of its result. This is
identity of regularized filled polygons, not their linear wiregraphs. Split
and simultaneous merge cannot hide a hole changing owner. Strictly
separated component bounding boxes across operands must retain that certified
separation after rounding; this is not a claim of general cross-operand
topology equivalence. All existing physical guards still run, and failure of
the retry stays fail-closed.

Lazy Select clips the union of corner fans against their common bound once;
any grouped failure replays all historical per-fan operations. For successful
pre-opening canonical masonry only, room-floor subtraction drops strictly
remote holes from its clipping operand. The full outer boundary, touching or
enclosing holes and all ambiguous rings remain; the guard still computes and
judges the floor itself. Default View uses the original clipping/subtraction.
If the whole subject is proved inside one canonical outer boundary and every
other masonry component is strictly disjoint, subtraction is exactly the
intersection with that polygon's holes. Fully contained holes can be united
directly; partial overlap or a hole in the subject still requires intersection.
Any failed operation replays the complete historical subtraction. This never
uses a cached/rendered floor or omits an island component from the proof.

Centre/interval inputs are reused only inside one geometry call;
the mapped and plain exterior shells still build their own contours.
Opening slots receive one canonical union, reusable by the frozen boolean
cache; any mask/subtraction failure replays every mandatory cut. A convex fan
is skipped only when conservative half-plane predicates prove its entire
interior already belongs to masonry. Holes, concavity, self-crossing shapes
and ambiguous arithmetic cannot gain that shortcut. When all fans are proved
redundant, their clipping bound need not be built; a required bound failure is
retained, never retried into a different outcome.

Exactly axial offset lines supply their literal X/Y intersection coordinate;
evaluating that coordinate along the other line must not introduce a different
floating tail at each end of one face. Only an exactly zero direction component
qualifies: oblique lines, parallel limits and non-finite failures are unchanged.

Select may also reuse a frozen successful union/difference by replacing only
proved local boundary fragments (`wall-boundary-splice.ts`). Both old and fresh
moving operands require complete canonical-value certificates, not object
identity, vertex counts or area. The unchanged operands retain their exact
ordered values and operation. Exact horizontal/vertical subdivisions reveal
shared directed edges; there is no snapping of diagonal or near-axis edges.
One **global** rectangle covering all removed AND added fragments must be
strictly separated from every unchanged component's bounding box. Individual
edge separation is insufficient: new edges could enclose an unchanged cut.
Outside the rectangle the boundary winding difference is zero at infinity and
throughout its connected exterior; inside it the unchanged operands are empty.

Replacement further requires bijective input ring/owner correspondence,
unambiguous directed cycles, exact non-crossing of new and retained segments
and of every pair of new segments,
and the actual output containment tree. In particular, a fixed cut can split
one input component into two: retaining old output hole indices does not prove
ownership. Decimal BigInt predicates match polyclip's Number interpretation;
touching boundaries, changed nesting, missing anchors and every uncertain case
take the complete original boolean operation, including its original failure.
The edge check permits only shared endpoints, not overlaps or endpoint/interior
contacts. It proves new-edge simplicity itself rather than assuming it from
the caller's canonical-value certificate.
The exact predicate coordinate map also supplies each reconstructed ring's
shoelace sign: one positive scale preserves the sign across rings with different
decimal exponents. No floating-point area or tolerance replaces this check.
An exact endpoint equality gives zero orientation before BigInt arithmetic;
all other contacts still execute the same exact determinant.

For a fixed intersection subject, a separately certified canonical clipping
operand can change strictly outside the relevant region. The reuse signature
retains the subject's **complete** value and the sorted directed **multiset**
of clipping edges whose X maximum reaches the subject's X minimum and whose
Y interval touches its full Y interval (`wall-intersection-signature.ts`).
There is deliberately no right-hand X cutoff: distant right edges determine
enclosure. Equal signatures preserve every rightward-ray winding and boundary
contact throughout the subject rectangle; remote component/hole changes cannot
change the intersection there. Only two-operand intersections of a known full
canonical clipping value qualify, and only a successful frozen result is reused.
ULP differences, changed local holes, unregistered mutation, extra operands or
an uncertain/oversized signature take the original boolean. Reused results are
fresh copies, not aliases to cached geometry.

Canonical certificates include proved splice results and use a 256-entry /
500,000-character FIFO; frozen incremental records are separately capped at
256 entries / 500,000 characters shared by boundary and intersection records,
with at most four boundary records per exact fixed-operand group. Pointer
positions never grow or replace the frozen record table. Together with the
existing 512-entry / 2,000,000-character exact cache, all reuse remains bounded
and owned by one frozen baseline/context. It is absent from ordinary View, and
never replaces the subsequent junction, clearance, opening or release checks.
The frozen boundary record privately copies its inputs and prepares fixed
component boxes, vertex keys and exact ring signs once. Candidate subdivisions,
separation, crossings and output containment remain fresh checks; neither input
mutation nor modification of a returned result can change the prepared record.
Each live operand is fully serialized once per boolean call; only a privately
copied frozen result may retain its already-computed key. No caller array gains
an identity-based certificate.

Select-only edge grouping (#864) uses union(Q_i ∩ centre) = union(Q_i) ∩ centre
for strips not already proved covered by the current room body. Three common
boolean stages replace repeated sweeps of a growing connected floor. Failure
in strip union, common clipping or body union replays the complete historical
per-edge coverage/clipping/isolated union, including healthy later strips.
Room-ring order, mandatory facade/shell/corner/opening stages and every physical
guard remain unchanged. No precision rewrite or new candidate cache; View does
not supply the edge grouping port.

At most one successful baseline may survive an Esc retry in Select. Reuse
requires the same authoritative config object, revision and space plus the
exact complete selected-config value, including proof settings. Its config is
a private snapshot; every fresh candidate still receives geometry and physical
proof. A changed local closure, in-place config value change, failed baseline,
write/history operation, context/permission/API change, pagehide or disposal
retires this reuse. Candidate geometry and the node snapshot do not survive
cancel. No baseline construction is moved ahead of the first real candidate.

### Stable stored identity and zero walls (model v10, #282/#306/#478)

The decision record behind the stored representation — what the code calls
«ADR 282» — is `docs/adr/282-wall-geometry-representation.md`; the migration
matrix is in `CONFIG-COMPATIBILITY.md` (model v8–v10).

From model v8 every atomic room-wall interval has a stable record in
`space.wall_segments[]`. Its `id`, endpoints and `cm` are authoritative;
`rooms[].wall_ids[]` references the ordered atoms that form each contour.
`space.walls[]` remains a generated compatibility projection for older readers
and must not be used as the identity of a wall. A door, window, gate or passage
on a room wall stores a tagged `{kind:'wall', id, t}` host. Independent
partitions keep their existing stable IDs. Each accepted segment of an active
Walls chain is already an ordinary partition; only the chain ordering is
session-local.

Existing legacy plans are not rewritten on read. The model is materialised
atomically before the first structural edit, by **Optimize plans**, or when a
legacy plan is imported into a current target. Ambiguous or conflicting geometry blocks
the operation and leaves the stored plan unchanged. Ordinary settings and
presentation writes do not trigger the migration. Model v9 made `cm:0` a
public, canonical wall value; model v10 removes persisted room drafts and keeps
that value for contour atoms and independent walls.
There is no separate virtual-boundary entity or editor tool.

Every structural writer passes through the same wall-model barrier. A split
keeps the parent ID on the child containing the old midpoint (then the old first
endpoint on a tie), while the other child receives a new UUID. Merge, Resize,
room deletion, opening edits, Undo/Redo/recovery, Optimize and import/export
apply the same lineage and validation rules before one atomic persistence write.
Resize handles coalesce identity-only vertices, but the accepted contour is
projected back onto frozen stored atoms/ordered IDs before any physical proof
(#832). Consumers of changed IDs may synchronise a derived collinear seam point
on an unchanged equal-thickness run; an inactive authored corner or conflicting
incident pair is refused. This does not join another room to the Resize solver.
Initial legacy IDs are deterministic, so frontend, backend and repeated
migrations converge; only genuinely new segments get UUIDs.
Room-face acceptance settles its provisional partition lineage after coincident
carriers have been reconciled (#804). A surviving partition or residual reserves
its ID: only new room-edge hints that still claim that ID are cleared, preserving
their slots. The common model barrier allocates new room-wall IDs; fully consumed
carriers retain their usual promotion lineage. Existing room IDs and the global
duplicate-ID guard are not relaxed. Ordinary config writes still reject changes
to the kind or ID of a surviving partition-opening host; the narrowly proved
Optimize rehost capability is not granted to room creation.
`src/wall-segment-model.ts` and `custom_components/houseplan/wall_segment_model.py`
share `test/fixtures/282-wall-identity-parity.json`. Writer-bypass mutants in
`scripts/mutation-registry.mjs` guard every structural writer entrance. A `cm:0`
atom or partition keeps its structural axis and stable identity but contributes
no masonry body, floor subtraction, paper, opening tunnel or opening host; one
resolver, `src/zero-walls.ts`, applies `space.zero_wall_style` to flat, static,
2.5D and light.

Per space: `walls: [{ key, cm, a?, b? }]`. `key` remains the quantised midpoint
and direction (modulo 180°) compatibility lookup; new or rewritten entries also
carry exact endpoints `a` / `b` in normalised plan coordinates. Config always
stores centimetres. Old `{key, cm}` data remains readable and is upgraded when
the affected boundary is edited. One physical
stretch has one thickness (atomic collinear spans when neighbours overlap only
partially). For valid plan geometry, **the key is computed from lattice-stable
endpoints**, never from a storage-rounded approximation of the same node.
`wallKey` first replaces only a coordinate already within
`max(pitch · 10⁻⁶, 10⁻⁹)` of its nearest node; arbitrary off-grid geometry is
not silently snapped. It then quantises the midpoint with `Math.round`. A wall
whose length is an odd number of grid steps has its midpoint exactly on a
rounding tie, and the two representations of one vertex — the exact node
`83/240` and a stored `0.345833333` — otherwise fall on opposite sides of it.
That is how #258 lost two records whose keys had drifted by one step.

Lookup order is exact key, strict same-span `a/b` (both endpoints, either
direction, within the same storage-noise epsilon), then the legacy
midpoint/direction fallback. The exact-span step repairs an already affected
plan immediately without writing it; it never treats a containing parent as
the same stretch. Parent-to-atomic inheritance remains the separate
`exactCoveringWall()` / `cmsForPoly()` contract. Explicit Optimize rewrites the
entry to the stable key and is idempotent after the nine-decimal storage
round-trip. `scripts/model-invariants.mjs` (`checkWallKeys`, #259) independently
grades a different stored key as an observation, not a violation: valid exact
endpoints now prove that the record is resolvable even when its compatibility
key is old or unparsable. Exact endpoints make a thickness boundary independent of whichever
room topology later happens to split the same straight line. Normalisation
merges consecutive pieces only inside a maximal run of equal thickness
with the same physical ownership: one outer room or the same sorted pair of
shared rooms. A different thickness, outer/shared transition or change of
shared-room pair remains a real break. Adjacent zero atoms follow the same
role-aware compaction; the canonical current model never writes compatibility
`open_spans` or `open_to`.
`normalizeWallIntervals()` is the single implementation, shared by explicit
Optimize and the room-deletion transaction; ambiguous multi-owner geometry is a
hard breakpoint and fails closed per atom (#299).
When a maximal wall run crosses a collinear vertex belonging to another room,
its exact endpoints cover that room's shorter child side too; lookup does not
depend on the compacted run's midpoint remaining inside every room.

Degrade unmatched keys silently on write. Resize / undo / scale transform exact
endpoints and re-key all touched spans in the same transaction. A moved room
edge may cover only part of a longer exact wall entry: Resize partitions that
entry at every collinear overlap boundary, transforms only the covered atoms
from the immutable pre-drag snapshot and leaves every uncovered remainder on
its old carrier. Equivalent transforms from two owners collapse to one; a
conflicting pair fails closed by retaining the source atom. Results deduplicate
only when canonical exact endpoints **and** centimetres match — the quantised
compatibility key alone may never erase a record. Generic affine transforms
retain the historical key-only midpoint fallback and never invent a legacy
length. Production fixed-topology Resize is stricter: only one whole-edge key
with one destination can move; an affected partial or ambiguous key rejects the
candidate before preview/commit. `walls` stays in the resize snapshot. If lossless
partitioning takes a valid 500-record input above the backend limit, the
frontend keeps every result so persistence rejects the transaction atomically;
it does not truncate masonry to make the write fit.

The production fixed-topology Resize path does not use the generic affine
projection for side walls. A rigidly translated moving edge carries every
breakpoint by the same vector; a side edge that only changes length moves its
paired topology endpoint and leaves interior thickness boundaries fixed. A
continuous carrier-coverage and lattice proof runs before preview/commit. It
compares exact historical debt by record identity and endpoint identity, so an
old off-grid endpoint is not silently migrated even when its record's other end
moves, while a new or changed violation rejects the whole candidate. This is
distinct from the retained generic scale/rotation helper
used only by isolated historical pure tests.

## 2. Growth (centreline ±½)

Every thick wall grows **half outward and half inward** from the polygon edge
(outer and shared alike). Silhouette is wider than the polygon by `cm/2` on
outer walls. Paper and the content frame grow under that outer half.

The exterior silhouette is generated from the boolean union of room
centrelines and its surviving `outer` atomic intervals. A shared Split edge
therefore disappears before exterior mitres are built. When Split ends at an
existing corner, its divider is clipped to the interior side of this envelope:
the real exterior mitre/bevel and unequal arm depths stay unchanged, while any
divider thickness remains inside the facade. The same computed geometry is
used for the full/static/hidden-isometric renderers and light occlusion. The
paper and masonry paths come from one cached structural pass in flat renderers;
live HA state ticks do not repeat the boolean topology. Saved room and wall data
is not migrated or rewritten.

Every endpoint of an exterior atomic interval is materialised on a collinear
boolean-union edge before offsetting. Unequal neighbouring half-depths form a
hard butt step at that exact endpoint on both the inner and outer faces; the
larger depth is never tapered or extended over the smaller/zero interval.
Geometry tolerances are render-space distances and are converted to a local
dimensionless edge fraction before breakpoint comparison or de-duplication.
This preserves the same `0 ↔ h` and `h1 ↔ h2` transition at normalized and
production (`coordScale = 1000`) scales.

Per-room rings remain the interior-join and nested-room representation; when an
acute child ring cannot be subtracted, its atomic interval quads provide the
safe physical fallback. The full card keeps the structural result in
`_wallUnionCache`; static cards use a weak server-snapshot cache guarded by a
structural geometry fingerprint, and cursor or HA state updates never repeat the
O(N²) `physicalBodySet()` node search.

## 3. Body render

Production body is the **ring** `outset(poly, half) − inset(poly, half)` per
room, **union**ed across rooms so shared and T junctions show one continuous
body with no internal seams (as in the reference plan). The body is painted in
two layers: a solid fill from global `settings.fill_colors.wall_fill` (default
opaque white, with its own opacity) **under** the diagonal hatch whose stroke
matches the wall outline. Normally neither replaces the other. When the body is
thinner than 3 CSS px on screen, the shared full/static render policy suppresses
only the hatch so it does not collapse into noise; the solid fill remains. Mitre
joins; bevel when the mitre spike exceeds `MITRE_LIMIT × thickness`.

At a physical node with **three or more distinct incident rays**, the stricter
multi-wall rule applies (#249). Shared room ownership and reversed interval
direction do not create extra rays. One structural node map records the largest
incident half-depth `H` and the finite `(half-depth, endpoint distance)` supports
of every co-directional ray. A longer thin support never extends a shorter thick
support, and no repair may continue either one beyond its saved endpoint (#271).
Every excessive join is cut back with a straight local bevel and may not extend
beyond `R = 1.25 × H`. Inside the room union, a bounded mask replaces the legacy
ring with the complete finite ray strips, retains their overlap through `R`, and
removes only the remaining excessive pairwise wedge.
The same bounded rule applies to the exterior half-wall and paper envelope:
local ray strips are clipped to that physical envelope rather than the room
centre, so a valid T-junction cannot become a white wedge. This keeps the node
centre and every arm area-connected without allowing overlap beyond `R` or an
interior child mitre to change a concave facade. Ordinary two-ray corners retain
the exact historical `MITRE_LIMIT = 4` contract. This is computed geometry only:
saved room outlines and wall entries are not rewritten (#261).

Every excessive pairwise cut also has a finite-width corridor through its
offset-line tip into the already empty angular sector (#272). Ending the cut at
the exact intersection is not sufficient: it creates a polygon hole that SVG
renders as an enclosed white triangle even though one mathematical point
touches the exterior. The corridor is bounded by the excess beyond `R`, is
scale-relative, and is applied to room masonry, final masonry and paper. It
therefore opens the legal discarded bevel to the exterior without filling it,
moving the `R` endpoints or shaving an incident wall centreline.

Exterior connectivity alone is not sufficient (#275). At a degree-3+ node,
every finite ray that has a perpendicular partner owns its complete physical
strip through the local repair window. The effective bevel cut excludes the
union of those protected strips, then the reconstruction unions them back as a
boolean fail-safe. A pair remains physically near-orthogonal when its angular
deviation from 90° is at most `0.25°` (#279); this small drafting tolerance is
independent of `cell_cm` and does not rewrite the saved axes. Rays are
classified pair by pair: a diagonal ray in a mixed
orthogonal/diagonal node remains subject to the bounded #249 bevel unless it
has its own perpendicular partner. The non-orthogonal #249 fixture therefore
keeps its approved empty wedge. Protected strips are unioned once for the
complete node map, because neighbouring repair masks can overlap; a later node
must not erase a strip restored by an earlier one. The result is still clipped
to the canonical physical paper envelope and explicit opening slots are cut
afterwards, so no wall is extended and no real doorway is filled.

A short incident ray may end inside the bounded replacement mask, with a
different shared wall attached at that real far endpoint (#288). The node map
records that attached strip separately from the incident ray, including its
own direction, finite length and half-depth. Local reconstruction restores only
the part of this finite shared strip inside the mask. It never projects the
short ray to the global radius and never treats an unrelated outer continuation
as node-owned material. This closes the real `349 / 120 / 5`-step gaps while
preserving the finite-ray and opening contracts from #271.

`NEAR_AXIS_MAX_DEGREES` in `src/near-axis.ts` is the single `0.25°` product
constant (#290). The masonry pair classifier derives its sine tolerance from
that source; Walls authoring and explicit Optimize use the corresponding
minor/major slope. Rendering may tolerate a legacy saved slope, but new Walls
segments are exact-axis and Optimize changes legacy geometry only after its
lossy preview is confirmed.

Clean-floor consumers subtract the cached, repaired canonical room masonry from
their source room and take its outer component. The result is clipped to the
source room on fallback. Openings and independent partitions are deliberately
excluded from this shared `roomGeom`, so a door does not change the room fill
and a detached body cannot punch it. Full and Static render paths reuse the same
structural cache instead of rebuilding wall booleans once per room.

**Junction nodes (#302, owner decision #5).** A degree-3+ node closes with a
FULL mitre, like an ordinary wall intersection on a drawing — the #249 chamfer
is retired. For every pair of angularly adjacent rays `junctionNodeGeometry`
builds one additive fan: the mitre is accepted when it sits IN the sector
(forward along the rays for an ordinary pair, backward for a reflex outer
corner), within the classic `MITRE_LIMIT` and never past a ray's thick
support (#271); a reflex pair without a valid mitre closes with the plain
chord, an ordinary one with a local bevel bounded by the support, the limit
and twice the pair's depth. The node also gets the exact support quads of its
rays. All pieces are clipped by the plain-corner facade bound
(`junctionNodeBound`), so a node cannot grow new facade at a concave vertex.
`bevelMultiWallBody` survives only as a TARGETED lateral trim for nodes with a
degenerately short thick support (#271); every other node is purely additive.
The objective invariant «body ⊇ support strips ∪ fans, inside the facade
bound» is machine-checked by `junctionContractHoles` in tests and the
`smoke_junction_holes` wiring probe. Degenerate zero-area rings left by
coincident chords are dropped.

**Visual mitre limit (#309, owner decision 2026-08-25).** A mitre apex may
protrude at most `VISUAL_MITRE_LIMIT = 1.5` maximal half-depths from the node
(a square corner of equal depths peaks at ~1.41·h, so right and obtuse
corners are byte-identical); a longer apex is closed with a flat chamfer
perpendicular to the apex direction at the limit (`chamferApex`). The rule
applies to the junction fans; `MITRE_LIMIT = 4` survives only as the sanity
bound for candidate construction. At a node of three or more canonical rays the
pair patches are not built at all: a pair patch lives in the sector OPPOSITE
its pair and painted a step over the thinner strips owning that sector (the
15/15/30/30 cross of the owner report) — such nodes are closed with the same
sector fans via a local multi-wall node map inside `linearWallJoinPatches`.
The #249 machinery (`MULTI_WALL_JOIN_LIMIT = 1.25`, `multiWallBevelCutsAt`,
room-contour mitres) is untouched.

**Pair apex and butt-end trim (#310, owner decision 2026-08-25).** A node of
exactly two rays keeps the FULL mitre at any length: two walls meet in a
drawing point, the #309 chamfer does not apply there. What does get removed is
the butt-end tooth: the deeper wall's rectangular end may poke sideways past
the outer face of its thinner partner right at the node —
`pairButtEndTrimWedges` returns, per wall, the addressed wedge (outside the
partner's apex-side outer face, within 2·halfDepth of the node along the
axis) which consumers subtract from the owning body before opening cuts. This
is the SECOND addressed subtraction of the junction pipeline, next to the
lateral trim of #271; both are strictly local to their node. Two-ray nodes are
invisible to `junctionContractHoles` (the node map requires 3+ canonical
rays), so their no-holes contract is a grid probe in the unit suite: masonry
inside the node neighbourhood equals (strips ∪ patch) − wedges.

**Hatch density is physical (#230).** The pattern step is a distance on the
plan, not a count of coordinate units: `wallHatchStepUnits(cellCm)` returns
`8 × (5 / cell_cm)`, which is 9.6 cm at every grid scale and exactly the
historical 8 units at the reference `cell_cm: 5`. The stroke width follows the
same factor, so the stripe-to-gap ratio is scale-invariant too. The step is
NOT compensated for zoom — a wall that re-hatches itself as you zoom is the
defect this rule replaced — and both renderers, interactive and static, read it
from the same function. Two independent guards fall back to the solid fill: the
body thinner than `WALL_HATCH_MIN_PX = 3` on screen, and the step itself
thinner than `HATCH_MIN_STEP_PX = 2` (`wallHatchNeedsSolid`). The step is
clamped to `[0.5, 80]` units so a pathological `cell_cm` cannot degenerate the
pattern.

A variable-offset join where exactly one adjacent edge has zero depth is a
local flat cap, not a mitre. Both `inset` and `outset` retain the physical
edge's offset point followed by the untouched zero-edge vertex (or the reverse
order when entering the physical edge). This keeps a zero-depth Split free of
masonry even when it meets a thick wall at a slightly non-collinear angle;
the cap cannot stretch into a taper along the divider. Joins between two
positive depths keep the bounded mitre/bevel contract above.

Independent partition segments keep flat raw quads for editor identity,
but exact endpoint↔endpoint and endpoint↔line nodes add computed join patches
before the presentation union. Each incident ray keeps its own half-depth;
ordinary corners use the same bounded `MITRE_LIMIT = 4` rule and excessive
spikes become bevels. A degree-one endpoint receives no patch and therefore
keeps its flat cap. This topology is render-only: a T does not split or rewrite
the saved target segment. The live open-outline/rubber-band preview calls the
same primitive with saved per-segment thicknesses plus the current field value.

Openings cut the body full-depth and jambs cap the whole cut. By default the
complete visible door/window/gate group is always centred on the wall axis,
including window glass. `flip_v` changes only the direction of door/window
geometry or the gate's 10° turn; it never translates the symbol toward a wall
face.
Association uses wall direction ≈ opening angle (mod 180°), then nearest span —
never a perpendicular neighbour at a T. One atomic `OpeningWallIndex` is
authoritative for physical depth/direction, wall cut and coloured tunnel, while
the shared symbol-placement helper turns that result into the user-visible
translation. Candidates must be effectively collinear with
the opening axis (not merely parallel within one grid cell); ties use complete
opening coverage, signed distance to the inner face, smaller room area and
stable room id. The index is cached by its complete inputs — the floor, its
rooms (id and polygon), wall records, open cuts and scale, read afresh on every
call — not by the configuration epoch, so another floor's edit, a shared setting
and HA state ticks reuse it (#814). Batch tunnel geometry adds the openings'
positions and is pooled per floor (at most eight recently shown floors, LRU), so
a warm floor switch reuses it and HA state ticks change only the resolved fill
colours. Overlapping openings reserve each physical interval
once and cannot stack room-fill alpha.
"Effectively collinear" is deliberately strict: the perpendicular distance to
the candidate axis may not exceed `max(4% × grid pitch, 1e-9)`. A detached
parallel room beyond that tolerance is not an opening side; when only one real
owner remains, its fill continues through the full wall depth. Legacy openings
outside the same angle/distance contract no longer cut or offset a nearby wall
and must be re-snapped in the Plan editor.
At a zero-thickness endpoint, positive arms owned by different room contours
receive the same bounded mitre patch as arms from one contour; the junction has
one clean outer corner rather than two butt caps forming a step. The zero wall
itself remains centreline-based. View paints it before the wall body, which
masks the part inside each adjoining thick jamb; editors paint it after the
body so its full stored extent stays visible.

Computed zero-wall junction patches cross the polygon-boolean boundary only
after scale-relative sub-epsilon coordinate stabilisation. They are optional
local additions: each patch union is transactional, so an invalid, zero-area or
numerically rejected patch keeps the last valid body and does not prevent later
patches. This fallback never rounds persisted rooms, walls or open spans to the
grid and never turns a failure of the mandatory exterior/body/opening passes
into a successful result. One noisy junction therefore cannot remove otherwise
valid masonry, paper, floor faces or light barriers for the whole space (#197).
The same failure isolation covers degree-3+ repair: every node is rebuilt and
committed independently inside its bounded mask. A malformed local candidate
therefore keeps that node's previous body without reverting successful repairs
at unrelated nodes. The exterior paper uses the same `R`-bounded overlap as the
masonry; it never restarts the cut at the offset origins (#261).
Pairwise cuts cannot end in point contact: a small local connector crosses the
offset-line tip so every removed bevel sector is exterior-connected and never
an enclosed polygon hole (#272). Orthogonal finite strips are additionally
protected across the complete node map, so overlapping local masks cannot turn
that exterior-connected sector into an open notch inside a real wall (#275).

Runtime normalisation remains lossless for every positive exact thickness
interval, regardless of its length. The explicit **Optimize plans** maintenance
action has one deliberately lossy exception (#198): an isolated interval
strictly shorter than half a grid step inherits two equal collinear neighbours
when neither endpoint is a room vertex or resolved opening endpoint. End
fragments, unequal neighbours, chains of short changes and exact half-step
intervals remain untouched. Candidates come from one pre-change effective
profile, so cleanup cannot cascade; ordinary rendering and editor Save never
invoke it.

## 4. Floor, fills, light, area

- **Inner contour** = `inset(poly, half[])`.
- Room fills and glow are clipped to the inner contour (not painted into the
  wall hatch).
- The free tunnel cut by a door, window or gate continues the effective room
  fill through the wall body instead of exposing the neutral paper below the
  plan. On an outer wall the one adjacent room owns the complete depth. On a
  shared wall each room owns its half, with a hard colour change exactly on the
  wall centreline. This is a base-fill layer only: Glow and sun remain above it
  with their existing aperture, clipping, colour and opacity.
- A zero-thickness wall or orphan opening has no coloured tunnel. Mixed-thickness legacy
  spans are clipped to their actual atomic wall bodies.
- Glow leaving through a door uses the clear rectangular opening tunnel: its
  sector is the intersection of the doorway spans at the near and far inner
  faces. The two jamb returns therefore clip off-axis light. Zero-thickness
  walls cannot host openings.
- Displayed **m²** = area of the inner contour (clean floor). Wall-length
  rulers and opening anchors stay on the centreline.
- With no thickness, inner = poly (parity with pre-thickness behaviour).
- View room hover is a late plain-SVG wash plus wide/narrow accent strokes over
  the clean-floor geometry; the room information window shows the room's average
  LQI and the formatted clean-floor area. The hover deliberately uses no CSS/SVG
  filters: promoting a filtered sibling makes Chromium briefly recompose and
  brighten the isolated screen-blended Glow layer.
- Opening-tunnel faces are one simple union contour per connected physical span:
  thickness steps are vertices on the outer envelope, never touching translucent
  rectangles, and both halves use the same nonzero winding across their tiny
  centre overlap, so fractional rasterisation can neither cancel the fill into a
  seam nor stack its opacity. `render/opening-tunnels.ts` only projects these
  immutable inputs.
- A fully nested room is legal (`polyContainsPoly`): the parent's floor, data
  fill and Glow base are evenodd paths with the island rings as holes
  (`islandsOf`).

## 5. Sun

Wedges do not draw through wall bodies. The global `settings.sun_ray_origin`
selects their source face. `inner` (default and legacy fallback) translates the
full span from the centreline by `+d/2` along the receiving room's inward
normal, so both sides begin at the room-side corners. `outer` translates it by
`-d/2` and includes only the rectangular physical window tunnel before the
receiving room's inner contour; adjacent wall and exterior space stay clipped.
The nominal length and gradient begin at the selected span. `d = 0` makes both
modes identical. `hide_openings` hides the symbol only.

## 6. Tool / hooks / i18n

Plan-editor tool «Thickness»; hover whole wall; cm/in from HA; exact `0..100`
is valid for room walls and partitions, while empty/invalid input is
rejected; apply-to-room. Hooks: `data-hp="wall"`. i18n en/ru. Changing a
positive wall to `0` is rejected atomically while any opening uses it. Hit
widths and junction ambiguity are measured in CSS pixels through the live
viewBox, so a zero wall stays editable although it paints as a one-pixel line.

**Draw with thickness.** The Plan toolbar's **Walls** button carries its session
thickness field immediately on the right (default **15 cm**, or inches when HA
is imperial). Every accepted segment is immediately persisted as an ordinary
partition with the value used when it was placed. If a segment creates rooms,
consumed boundary atoms receive
their source value and unconsumed atoms become independent walls with the same
value; existing shared masonry remains authoritative. Empty / 0 leaves the new
wall at zero thickness. Live preview follows the rubber-band while drawing.
Split does
not use this field. The Thickness tool remains for later edits.

**Deleting a room.** The accessible confirmation offers two explicit physical
consequences. **Keep walls** converts only that room's exclusive positive solid
wall intervals into exact independent partitions, preserving their centimetre
thickness and rehosting openings to those partitions. Shared intervals remain;
exclusive zero-thickness edges become zero-thickness partitions. **Delete
walls** removes the
room without that conversion and cascades only openings owned by its exclusive
walls. Shared masonry, existing partitions, partition-hosted openings and their
physical thickness remain intact in both cases. The room, wall profile,
partitions and openings are one Undo/Redo and persistence transaction. The
remaining wall profile is normalised against its post-delete ownership, so an
equal thickness cannot be compacted across an outer/shared boundary or across
two different shared-room pairs.
`src/room-deletion.ts` plans the whole operation before any mutation;
confirmation is an accessible `hp-dialog`, never native `confirm()`. The same
command rewrites room references in every marker: a direct `room_id` is deleted
(remapped to the survivor for Merge) and exact values in cross-space
`vacuum.segment_map` are deleted/remapped. History snapshots only these fields,
so Undo/Redo and write rollback stay atomic with geometry while unrelated marker
and vacuum fields remain live (#477).

## 7. Out of scope

Decor-line thickness, per-side finish, auto-from-backdrop, plan-wide default.

## 8. Testing

Unit: ring closed at corners; half-out; inner area; atomic partial shared;
zero-wall T mitre; angle-aware opening; 45° wall; T-junction; detached parallel
room; nested-room tie; partially out-of-span legacy opening; overlapping
opening de-duplication; shared symbol/cut/tunnel rejection; thick-door tunnel
clipping and room-side colour ownership; whole and
atomic rekey after edge/scale, including a long exact record only partly
covered by the moved edge, key collisions and the 500-record boundary; corner Split exterior equality across
0/1/15/100 cm, unequal arms, both windings and convex/concave endpoints;
production-scale `0 ↔ 10`, `10 ↔ 20` and `1 ↔ 100` collinear transitions at
their exact endpoint; full 8-room/25-wall/3-cut virtual-junction resilience,
ULP-equivalent patch vertices, per-patch failure isolation and record-order
invariance (#197); explicit Optimize-only collapse of a sub-half-step isolated
thickness island with strict threshold and ambiguity guards (#198), including
the proven `equal → micro → equal` case beside exactly one room T-node while
opening endpoints and spans between two room topology nodes stay protected
(#273); exact `cell_cm: 5` and `cell_cm: 1` orthogonal T fixtures derived from
the two #275 owner backups, including overlapping neighbouring node masks,
mixed depth and the unchanged non-orthogonal #249 wedge;
the real `349 / 120 / 5` short-ray handoff to a 20 cm shared wall at
`cell_cm: 1/5/30`, reversed endpoints and permuted input (#288);
exact parent-run thickness inherited by atomic children across a zero-depth
neighbour, without partial-span leakage (#201/#306).
Role-aware compaction tests keep `shared(A,B)`, `outer(A)` and `shared(A,C)` as
separate records even at equal thickness, while equal neighbouring atoms within
one role still compact; the real first-floor fixture proves explicit Optimize
is invariant-free and idempotent (#299). The edit-walk real-plan seeds 1 and 3
exercise the same Optimize and Keep-walls entry points.
Browser: seamless frame; fill not in hatch; m² drops with thickness; partial
shared walls and mixed-thickness shared walls keep a visible disabled Resize
handle and cannot split or re-key their atomic records
(`demo/smoke_wall_thickness.mjs`, `demo/smoke_zero_walls.mjs`,
`demo/smoke_resize_wall_thickness.mjs`); an eligible uniformly thick exact
wall moves through the fixed-topology safe pipeline and Undo restores its
source (`demo/smoke_room_resize.mjs`);
the zero-wall preview paints above the real body; sun starts at the selected
inner/outer opening corners; nav mode restores after `can_write`; a 1 cm body uses
solid-only in both full and static cards while a 20 cm body keeps its hatch;
door/window/gate tunnels repeat outer/shared room fills without an axis seam
(`demo/smoke_opening_tunnel_fill.mjs`); corner Split keeps the same facade in
Plan/View/kiosk/static/isometric surfaces and the light barrier
(`demo/smoke_split_corner_wall.mjs`); a Split followed by all-room thickness
keeps the neighbouring zero facade clear across Plan, View, static, hidden Iso
and light masonry (`demo/smoke_wall_thickness_transition.mjs`); the complete
#197 fixture keeps the same non-empty canonical path across Plan, View, kiosk,
static, hidden Iso, paper/clean-floor and light/sun consumers while theme and HA
state ticks reuse the structural geometry
(`demo/smoke_junction_patch_resilience.mjs`); Optimize Preview/Cancel/Apply/
server Undo for guarded micro-interval cleanup
(`demo/smoke_optimize_micro_interval.mjs`); dense protected-strip sampling
through Plan, View, kiosk, Static, hidden Iso, paper/clean-floor and light
consumers (`demo/smoke_multiwall_strip_containment.mjs`); exact coincident
partition reconciliation, opening rehost, reload, one-shot Undo and resulting
Boundary/Thickness targets (`demo/smoke_optimize_coincident_partition.mjs`). The local
`scripts/wall-strip-containment.mjs` gate accepts external backups without
copying their contents into Git and checks raw, Optimize preview, applied
canonical storage and reload states.

`OptimizeDependencies` (`src/plan-optimizer.ts`) is a narrow seam: the
large-house benchmark substitutes a no-op and the unit contract counts
per-space calls; a source-ownership assertion fails if a render/pointer module
imports the reconciliation helper.

### Junction tooling (#302)

Purpose-built checks for node material: `junctionContractHoles` (the objective
«body ⊇ strips ∪ fans inside the facade bound» invariant, self-checked against
a deliberately holed fixture), the `smoke_junction_holes` wiring probe that
verifies the same contract against the rendered `d` path, sixteen close-up
golden scenes (`junction-*`) plus the owner's repro scene, and the
`junction-*` mutants in `scripts/mutation-gate.mjs`.

## 9. Independent partitions and columns

Their thickness is stored directly in centimetres: 0–100 cm for partition
segments, 1–150 cm for a column's outer side/diameter. Invalid input
blocks the commit and reports the valid range; no editor path silently clamps
it. These bodies are unioned with room-wall bodies only after door/window/gate cuts,
so an opening cannot punch a coincident independent wall. They are subtracted
from the cached clean floor, and the same body set is used by Glow and sun-ray
occlusion even when borders are hidden. The body set is cached per floor record
and grid scale and pooled like the union (at most eight recently shown floors,
#814); the editor's current entry stays `_physicalBodiesCache`. A source inside/on a physical body is
fully occluded instead of leaking around its own masonry. The same fail-dark
placement rule applies to window tunnels and exterior door/gate openings;
interior passages remain valid source positions (#92).

The canonical result is component-aware (#278). A valid room body remains the
primary component; every optional independent body and the exterior-shell merge
is added transactionally. If two individually valid operands cannot be unioned,
the latter is retained as a separate SVG/occlusion component and the result is
`degraded-extra`, so one local boolean failure cannot erase the whole floor.
Plan, View, Static, hidden Iso, paper and light use the same components, while
`roomGeom` excludes independent bodies so room area remains unchanged. This is
read-only recovery: strict Optimize and every physical-geometry edit reject a
degraded candidate and never silently delete or rewrite the offending object.
A core room-body failure is `failed-core`: it sits outside the optional-union
fallback and activates fail-dark rendering.

#834 repairs the floating-tail shell union in the historical two-room #278
fixture: it now has one complete, independently checked T-shaped component.
Tests no longer require that numerical defect to survive. Genuine unbuildable
bodies still exercise the strict refusal path, and an injected merge failure
separately verifies preservation of two individually valid components.

An opening with explicit `host:{kind:'partition',id,t}` is resolved from that
partition alone and subtracted full-depth from its raw body before the joined
presentation union. A precisely collinear room wall covering the same interval
is cut as a composite; a crossing/nearby body is not. Host move keeps `t`,
delete requires cascade confirmation, and malformed/orphan hosts remain opaque.
Opening cuts change physical masonry, not the structural wall axes used for
room-face detection (#185).

Explicit Optimize has one stricter reconciliation pass (#276/#281/#296). It
atomizes an independent wall at consecutive solid room-wall and hosted-opening
boundaries. Every positive section is proved independently: one outer owner or
exactly two shared owners with one effective thickness, and no column,
second partition or conflicting opening. Proven sections are absorbed even
when several consecutive room intervals cover the source; unproven sections
are recombined into deterministic residual partitions. Hosted openings are
materialised at the same centre/angle on a proven room wall or rebound to the
single residual that contains them. The canonical thickness is
`max(roomCm, partitionCm)`, exactly the union envelope of centred coincident
bodies. The pass is immutable, idempotent and followed by
the common whole-plan geometry preflight; rendering, Resize and ordinary Save
never perform it implicitly.

`physicalBodySet()` separates raw partition/column bodies from computed
junction patches and their joined geometry. Raw bodies remain authoritative for
hit testing, selection, drag, properties, deletion, history and furniture
magnet semantics. Flat full/static render, hidden isometric, clean floor, Glow,
sun and source placement consume the joined set through the canonical masonry
pass, so an old butt face cannot become a visible seam or a false light barrier.
Exact near-misses remain separate, an interior↔interior X crossing keeps normal
boolean-union semantics, and malformed legacy segments fall back opaque without
writing configuration.

## 10. Architectural connection overlay (Walls tool)

When **Walls** is active in the Plan editor, a derived
pointer-transparent SVG layer exposes the centre axes of completed room walls
and independent partitions. It is painted after their
physical wall bodies, but before interactive editor chrome. Columns, decor,
devices, the active wall chain and its live preview are not candidates. Door,
window, gate and intentionally open-span intervals are cut from presentation
axes; a cut boundary does not become a new endpoint.

The layer and hit resolver share one immutable geometry snapshot. Original
segment endpoints are deduplicated and drawn at a physical radius of 5 cm.
Inside a 12 CSS px hit zone, an endpoint wins over every line and grows to
10 cm. Otherwise the nearest solid line receives one 10 cm dynamic node: the
raw pointer is projected onto that line, then quantized by the grid step along
the line from its stable start. This keeps diagonal connections wall-bound even
when neither resulting coordinate is a global grid multiple. The same resolver
runs again on click, so hover is only a preview and never authoritative.

Endpoint and line candidates override the normal grid and Shift/45° result.
Outside the hit zone, the ordinary snap contract (`CANVAS.md` §9.3–9.4) is unchanged. A line connection adds only the
new segment endpoint; it does not split or rewrite the existing wall. The
current anchor is excluded to prevent zero-length segments. The static geometry
is cached by structural editor state; pointer movement changes at most the
single active candidate and never writes config, layout or storage.

A separate diagnostic projection is present throughout the Plan editor (#296),
including tools other than **Walls**. For every independent wall
segment with a positive exact collinear overlap against another wall, it keeps
that source segment's complete axis and original endpoints visible. It is
painted after every wall body and zero-thickness axis and before openings, selection
chrome and transient previews. The layer is `pointer-events:none`,
`aria-hidden`, absent from View and cached by structural revision; it neither
deduplicates source identities nor participates in the architectural snap
resolver above. The 1 CSS px non-scaling axis and physical 5 cm nodes therefore
diagnose an otherwise invisible Resize blocker without changing any hit target.

## 11. Planar wall faces

Every completed Walls segment is persisted immediately as an ordinary
`partition`; only its ordered chain membership remains in memory. On the click
path only, an immutable planar graph is built from structural room edges and
partitions both before and after the latest segment. Unlike the
presentation/snap snapshot, this
face graph ignores door/window/gate/passage cuts; zero-thickness wall axes remain
structural graph edges even though they have no masonry body.
Endpoint, T, X and
collinear-overlap junctions atomize that computed graph without rewriting any
saved wall. A deterministic half-edge walk extracts bounded faces; canonical
identity ignores winding, cyclic start and derived collinear subdivision.

Only faces added by the latest segment and containing one of its atoms are
offered. They are ordered by area and then canonical key. Existing exact or
partially overlapping rooms are excluded, nested rooms remain legal, and any
physical gap created by an `open_span` or absent wall remains a gap. A door,
window, gate or passage is a property of a wall and preserves connectivity. A clean divider across
one room reuses the Split contract: the larger side keeps the room identity,
metadata and device binding, and only the smaller side is offered.
`splitRoomPath()` is a strict partition: the two parts' areas must sum to the
original within a relative 1e-6 epsilon, otherwise the cut is rejected.

The terminal active path remains session-local while the resulting room dialogs
are open. Create/Keep-as-walls answers are buffered; Cancel/Esc discards all
answers and leaves the already persisted partitions unchanged. The final answer
revalidates the whole batch and applies accepted rooms while consuming only the
coincident partitions used by those rooms in one history/config transaction.
Graph construction never runs on pointermove, Home Assistant state updates or
ordinary rendering.

**Finishing a chain (#294, #477).** Changing Plan tool, editor or floor, `Esc`,
the tray's Reset, route/hash departure and a room-face batch whose every face
was rejected all finish an open chain through one bounded lossless finalizer
(`finalizeWallChainSpace`, `src/writer-fixed-point.ts`). It merges only the
seed-connected compatible collinear run, rehosts its openings and reconciles
only surviving positive seed partitions proven coincident with room masonry; the
cloned candidate crosses the current-model identity barrier, one local
physical/junction proof and storage canonicalization before atomic adoption.
Rejection keeps the visible chain and the original config. It adds no history
command and never sweeps unrelated legacy debt. Pan, pinch, pointer cancellation
and suppressed clicks never finish a chain or append a segment; a finished chain
is not resumed after reload or remount.

Active-chain Undo preserves the complete record of every surviving partition,
including its stable id; only a genuinely new edge receives a new identity. Each
segment history snapshot carries session-only chain seed ids: while the chain is
active the snapshot is literal and Undo removes one point; after finish,
Undo/Redo passes that seed scope through the same lossless finalizer, so hidden
collinear seams cannot return as durable Optimize debt (#477).

**Room from an existing face.** With no active chain, a Walls click queries the
smallest exact unoccupied bounded face at the raw point; boundary/snap hits and
desktop `Shift+click` still draw. Without an exact face, `src/wall-face-repair.ts`
may plan one endpoint→endpoint or endpoint→solid-line move of at most 2 physical
cm. Room vertices and endpoints of partitions that host an opening never move,
multiple valid repairs fail closed, and the immutable proposal is revalidated
against current geometry before use. Move and room are one history/config
transaction; cancelling or rejecting the room applies nothing.
