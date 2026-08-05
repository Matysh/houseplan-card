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

Per space: `walls: [{ key, cm }]`. Key = quantised midpoint + direction
(modulo 180°). Config always stores centimetres. Open boundaries refuse
thickness. One physical stretch has one thickness (atomic collinear spans when
neighbours overlap only partially).

Degrade unmatched keys silently on write. Resize / undo / scale re-key all
touched spans in the same transaction and keep `walls` in the resize snapshot.

## 2. Growth (centreline ±½)

Every thick wall grows **half outward and half inward** from the polygon edge
(outer and shared alike). Silhouette is wider than the polygon by `cm/2` on
outer walls. Paper and the content frame grow under that outer half.

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

Openings cut the body full-depth; jambs cap the cut; window glass mid-tunnel;
door swing from the **inner face**. Association uses wall direction ≈ opening
angle (mod 180°), then nearest span — never a perpendicular neighbour at a T.
At an `open_span` endpoint, real arms owned by different room contours receive
the same bounded mitre patch as arms from one contour; a virtual T therefore
has one clean outer corner rather than two butt caps forming a step.

## 4. Floor, fills, light, area

- **Inner contour** = `inset(poly, half[])`.
- Room fills and glow are clipped to the inner contour (not painted into the
  wall hatch).
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

Plan-editor tool «Wall thickness»; hover whole wall; cm/in from HA; empty/0
clears; apply-to-room. Hooks: `data-hp="wall"`. i18n en/ru.

**Draw with thickness.** The Draw toolbar carries a session thickness field
(default **15 cm**, or inches when HA is imperial). Closing a new room outline
writes that cm onto every new edge that does not already have one; shared
stretches that already carry a neighbour's thickness are left alone. Empty / 0
leaves the room thin. Live thick preview follows the rubber-band while drawing.
Split does not use this field. The Wall thickness tool remains for later edits.

## 7. Out of scope

Decor-line thickness, per-side finish, auto-from-backdrop, plan-wide default.

## 8. Testing

Unit: ring closed at corners; half-out; inner area; atomic partial shared;
virtual-T mitre; angle-aware opening; whole and atomic rekey after edge/scale.
Browser: seamless frame; fill not in hatch; m² drops with thickness; a partial
virtual stretch, its solid thick remainders and Undo move as one real resize;
the virtual rubber band paints above the real body; sun starts at the room-side
opening corners; nav mode restores after `can_write`; a 1 cm body uses
solid-only in both full and static cards while a 20 cm body keeps its hatch.
