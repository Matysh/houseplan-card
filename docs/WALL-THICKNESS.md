# Wall thickness — the spec

Status: **implemented / evolving** (post beta.4 redesign). Visual reference:
[docs/assets/wall-thickness-reference.png](assets/wall-thickness-reference.png)
(look at wall bodies only).

Owner intent: thick walls form one continuous hatched body (seamless L and T),
grow both ways from the room centreline, fills/light stay inside the inner
contour, displayed area is the clean floor, and sun wedges start at the two
room-side corners of an opening.

Code: `src/wall-thickness.ts`, render in `src/houseplan-card.ts` /
`src/space-render.ts`. Sun: `src/sun.ts`. Tests: `test/wall-thickness.test.mjs`,
`demo/smoke_wall_thickness.mjs`.

## 1. Model

Per space: `walls: [{ key, cm, a?, b? }]`. `key` remains the quantised midpoint
and direction (modulo 180°) compatibility lookup; new or rewritten entries also
carry exact endpoints `a` / `b` in normalised plan coordinates. Config always
stores centimetres. Old `{key, cm}` data remains readable and is upgraded when
the affected boundary is edited. Open boundaries refuse thickness. One physical
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
merges consecutive solid pieces only inside a maximal run of equal thickness
with the same physical ownership: one outer room or the same sorted pair of
shared rooms. A different thickness, virtual gap, outer/shared transition or
change of shared-room pair remains a real break. Likewise,
touching/overlapping `open_spans` of the same room pair are stored as one span;
pair ownership remains a hard boundary so Split can derive exact `open_to` links.
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

Independent draft/partition segments keep flat raw quads for editor identity,
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
stable room id. The index and batch tunnel geometry are cached by space,
configuration epoch and complete geometry, so HA state ticks change only the
resolved fill colours. Overlapping openings reserve each physical interval
once and cannot stack room-fill alpha.
"Effectively collinear" is deliberately strict: the perpendicular distance to
the candidate axis may not exceed `max(4% × grid pitch, 1e-9)`. A detached
parallel room beyond that tolerance is not an opening side; when only one real
owner remains, its fill continues through the full wall depth. Legacy openings
outside the same angle/distance contract no longer cut or offset a nearby wall
and must be re-snapped in the Plan editor.
At an `open_span` endpoint, real arms owned by different room contours receive
the same bounded mitre patch as arms from one contour; a virtual T therefore
has one clean outer corner rather than two butt caps forming a step.
The virtual segment itself remains centreline-based. View paints it before the
wall body, which masks the part inside each adjoining thick jamb; editors paint
it after the body so its full stored extent and live preview stay visible.

Computed virtual-wall junction patches cross the polygon-boolean boundary only
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
- A zero-thickness wall, virtual span, orphan opening or opening associated only
  with an unfinished room draft has no coloured tunnel. Mixed-thickness legacy
  spans are clipped to their actual atomic wall bodies.
- Glow leaving through a door uses the clear rectangular opening tunnel: its
  sector is the intersection of the doorway spans at the near and far inner
  faces. The two jamb returns therefore clip off-axis light; a zero-depth wall
  keeps the original centreline sector.
- Displayed **m²** = area of the inner contour (clean floor). Wall-length
  rulers and opening anchors stay on the centreline.
- With no thickness, inner = poly (parity with pre-thickness behaviour).

## 5. Sun

Wedges do not draw through wall bodies. Their full source span is translated
from the centreline by half the wall depth along the receiving room's inward
normal, so both side rays begin at the two room-side corners of the window
opening. Clip to the receiving room's inner contour. `d = 0` keeps the previous
centreline/full-span wedge. `hide_openings` hides the symbol only.

## 6. Tool / hooks / i18n

Plan-editor tool «Thickness»; hover whole wall; cm/in from HA; empty/0
clears; apply-to-room. Hooks: `data-hp="wall"`. i18n en/ru.

**Draw with thickness.** The Plan toolbar's **Walls** button carries its session
thickness field immediately on the right (default **15 cm**, or inches when HA
is imperial). Every persisted draft segment remembers the value used when it
was placed. Finishing an open chain transfers those values to the resulting
independent walls. If a segment creates rooms, consumed boundary atoms receive
their source value and unconsumed atoms become independent walls with the same
value; existing shared masonry remains authoritative. Empty / 0 leaves the new
wall thin. Live thick preview follows the rubber-band while drawing. Split does
not use this field. The Thickness tool remains for later edits.

**Deleting a room.** The accessible confirmation offers two explicit physical
consequences. **Keep walls** converts only that room's exclusive positive solid
wall intervals into exact independent partitions, preserving their centimetre
thickness and rehosting openings to those partitions. Shared intervals, virtual
gaps and zero-thickness edges are not materialised. **Delete walls** removes the
room without that conversion and cascades only openings owned by its exclusive
walls. Shared masonry, existing partitions, partition-hosted openings and their
physical thickness remain intact in both cases. The room, wall profile,
partitions and openings are one Undo/Redo and persistence transaction. The
remaining wall profile is normalised against its post-delete ownership, so an
equal thickness cannot be compacted across an outer/shared boundary or across
two different shared-room pairs.

## 7. Out of scope

Decor-line thickness, per-side finish, auto-from-backdrop, plan-wide default.

## 8. Testing

Unit: ring closed at corners; half-out; inner area; atomic partial shared;
virtual-T mitre; angle-aware opening; 45° wall; T-junction; detached parallel
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
exact parent-run thickness inherited by atomic children when
closing a virtual neighbour, without partial-span leakage (#201).
Role-aware compaction tests keep `shared(A,B)`, `outer(A)` and `shared(A,C)` as
separate records even at equal thickness, while equal neighbouring atoms within
one role still compact; the real first-floor fixture proves explicit Optimize
is invariant-free and idempotent (#299). The edit-walk real-plan seeds 1 and 3
exercise the same Optimize and Keep-walls entry points.
Browser: seamless frame; fill not in hatch; m² drops with thickness; partial
shared walls, mixed-thickness shared walls and walls containing a partial
virtual stretch keep a visible disabled Resize handle and cannot split or
re-key their atomic records (`demo/smoke_wall_thickness.mjs`,
`demo/smoke_resize_virtual_thick.mjs`,
`demo/smoke_resize_wall_thickness.mjs`); an eligible uniformly thick exact
wall moves through the fixed-topology safe pipeline and Undo restores its
source (`demo/smoke_room_resize.mjs`);
the virtual rubber band paints above the real body; sun starts at the room-side
opening corners; nav mode restores after `can_write`; a 1 cm body uses
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

### Junction tooling (#302)

Purpose-built checks for node material: `junctionContractHoles` (the objective
«body ⊇ strips ∪ fans inside the facade bound» invariant, self-checked against
a deliberately holed fixture), the `smoke_junction_holes` wiring probe that
verifies the same contract against the rendered `d` path, sixteen close-up
golden scenes (`junction-*`) plus the owner's repro scene, and the
`junction-*` mutants in `scripts/mutation-gate.mjs`.

## 9. Independent partitions, drafts and columns

Their thickness is stored directly in centimetres: 1–100 cm for draft and
partition segments, 1–150 cm for a column's outer side/diameter. Invalid input
blocks the commit and reports the valid range; no editor path silently clamps
it. These bodies are unioned with room-wall bodies only after door/window/gate cuts,
so an opening cannot punch a coincident independent wall. They are subtracted
from the cached clean floor, and the same body set is used by Glow and sun-ray
occlusion even when borders are hidden. A source inside/on a physical body is
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
exactly two shared owners with one effective thickness, and no draft, column,
second partition or conflicting opening. Proven sections are absorbed even
when several consecutive room intervals cover the source; unproven sections
are recombined into deterministic residual partitions. Hosted openings are
materialised at the same centre/angle on a proven room wall or rebound to the
single residual that contains them. The canonical thickness is
`max(roomCm, partitionCm)`, exactly the union envelope of centred coincident
bodies. A saved draft is removed only all-or-nothing when every segment has the
same complete solid proof. The pass is immutable, idempotent and followed by
the common whole-plan geometry preflight; rendering, Resize and ordinary Save
never perform it implicitly.

`physicalBodySet()` separates raw draft/partition/column bodies from computed
junction patches and their joined geometry. Raw bodies remain authoritative for
hit testing, selection, drag, properties, deletion, history and furniture
magnet semantics. Flat full/static render, hidden isometric, clean floor, Glow,
sun and source placement consume the joined set through the canonical masonry
pass, so an old butt face cannot become a visible seam or a false light barrier.
Exact near-misses remain separate, an interior↔interior X crossing keeps normal
boolean-union semantics, and malformed legacy segments fall back opaque without
writing configuration.
