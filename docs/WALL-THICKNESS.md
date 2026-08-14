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
partially). Exact endpoints make a thickness boundary independent of whichever
room topology later happens to split the same straight line. Normalisation
merges consecutive solid pieces into each maximal run of equal thickness; a
different thickness or a virtual gap remains a real break. Likewise,
touching/overlapping `open_spans` of the same room pair are stored as one span;
pair ownership remains a hard boundary so Split can derive exact `open_to` links.
When a maximal wall run crosses a collinear vertex belonging to another room,
its exact endpoints cover that room's shorter child side too; lookup does not
depend on the compacted run's midpoint remaining inside every room.

Degrade unmatched keys silently on write. Resize / undo / scale transform exact
endpoints and re-key all touched spans in the same transaction; legacy entries
without endpoints keep the midpoint fallback. `walls` stays in the resize
snapshot.

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

Independent draft/partition segments keep flat raw quads for editor identity,
but exact endpoint↔endpoint and endpoint↔line nodes add computed join patches
before the presentation union. Each incident ray keeps its own half-depth;
ordinary corners use the same bounded `MITRE_LIMIT = 4` rule and excessive
spikes become bevels. A degree-one endpoint receives no patch and therefore
keeps its flat cap. This topology is render-only: a T does not split or rewrite
the saved target segment. The live open-outline/rubber-band preview calls the
same primitive with saved per-segment thicknesses plus the current field value.

Openings cut the body full-depth; jambs cap the cut; window glass mid-tunnel;
door swing from the **inner face**. Association uses wall direction ≈ opening
angle (mod 180°), then nearest span — never a perpendicular neighbour at a T.
One atomic `OpeningWallIndex` is authoritative for the symbol offset, physical
wall cut and coloured tunnel. Candidates must be effectively collinear with
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
is imperial). Closing a new room outline
writes that cm onto every new edge that does not already have one; shared
stretches that already carry a neighbour's thickness are left alone. Empty / 0
leaves the room thin. Live thick preview follows the rubber-band while drawing.
Split does not use this field. The Thickness tool remains for later edits.

## 7. Out of scope

Decor-line thickness, per-side finish, auto-from-backdrop, plan-wide default.

## 8. Testing

Unit: ring closed at corners; half-out; inner area; atomic partial shared;
virtual-T mitre; angle-aware opening; 45° wall; T-junction; detached parallel
room; nested-room tie; partially out-of-span legacy opening; overlapping
opening de-duplication; shared symbol/cut/tunnel rejection; thick-door tunnel
clipping and room-side colour ownership; whole and
atomic rekey after edge/scale; corner Split exterior equality across
0/1/15/100 cm, unequal arms, both windings and convex/concave endpoints.
Browser: seamless frame; fill not in hatch; m² drops with thickness; a partial
virtual stretch, its solid thick remainders and Undo move as one real resize;
the virtual rubber band paints above the real body; sun starts at the room-side
opening corners; nav mode restores after `can_write`; a 1 cm body uses
solid-only in both full and static cards while a 20 cm body keeps its hatch;
door/window/gate tunnels repeat outer/shared room fills without an axis seam
(`demo/smoke_opening_tunnel_fill.mjs`); corner Split keeps the same facade in
Plan/View/kiosk/static/isometric surfaces and the light barrier
(`demo/smoke_split_corner_wall.mjs`).

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

`physicalBodySet()` separates raw draft/partition/column bodies from computed
junction patches and their joined geometry. Raw bodies remain authoritative for
hit testing, selection, drag, properties, deletion, history and furniture
magnet semantics. Flat full/static render, hidden isometric, clean floor, Glow,
sun and source placement consume the joined set through the canonical masonry
pass, so an old butt face cannot become a visible seam or a false light barrier.
Exact near-misses remain separate, an interior↔interior X crossing keeps normal
boolean-union semantics, and malformed legacy segments fall back opaque without
writing configuration.
