# ADR #570 — Stage 4 isometric visual handoff (historical record)

- Issue: https://github.com/Matysh/houseplan-card/issues/570
- Status: implemented; superseded in activation by #649 (2.5D is a public View
  mode behind `settings.volumetric_view`, `hp_alpha` no longer gates it)
- Predecessors: `docs/adr/089-isometric-stage1-renderer.md`,
  `docs/adr/122-isometric-stage2-composition.md`,
  `docs/adr/160-isometric-stage3-overlays.md`
- Normative material at the time: the reviewed specification in issue #570 plus
  its revision-3 designer handoff
- Provenance: the sections below were written in `docs/ISOMETRIC.md` while
  2.5D was a hidden `hp_alpha` experiment and moved here unchanged by #679 (the
  current contract lives in `ISOMETRIC.md` without stage framing)

## Stage 2 composition (#122) — as documented before #679

> Historical: written while 2.5D was a hidden `hp_alpha` experiment. Since #649
> it is public; activation is described in [Activation](#activation).

Stage 2 evolves the same hidden `iso` experiment; it does not add a flag,
setting or public activation path. The accepted implementation contract is
`docs/specs/122-isometric-stage2.md` and the fixed composition decisions are in
`docs/adr/122-isometric-stage2-composition.md`. Its historical per-feature
lifetime was superseded by the single indefinite `hp_alpha` gate in #448; the
Stage 2 rendering contract itself is unchanged.

### One structural scene, live opening leaves

The per-card LRU remains capped at eight entries. Its Stage 2 value contains:

- canonical wall top/sides and the physical-wall contact path;
- a room/exterior floor footprint and its low visible outer faces;
- immutable opening jamb/axis bases, including type, flips and selected wall
  face;
- the shared projected frame, including wall/opening tops and the low floor
  edge.

The key includes rooms, masonry/opening geometry, flips, scale/camera, wall and
edge heights and algorithm revision. It excludes HA state, theme, hover,
day/night and filter capability. `openingAmount()` is applied only after an LRU
hit by `projectIsoOpening()`, so a contact update projects O(O) leaves without
repeating a wall or floor boolean operation.

`floorFootprintGeometry()` deliberately accepts no independent physical-body
input. The slab is the union of room floors and derived exterior masonry:
internal room boundaries and nested holes make no decorative step, detached
room components keep separate outside edges, while partitions and columns do
not enlarge it.

### Layer order and materials

All geometry roots use one scene `viewBox`. The existing floor/live nodes are
grouped under the Stage 1 affine matrix; HTML anchors still use
`projectPlanPoint()`.

```text
stage background
→ shared ambient shadow + low exterior floor edge
→ existing floor SVG (paper/image, room fills/hover, decor, Glow, sun)
→ canonical wall sides/top + inert vertical opening panels
→ existing HTML devices, labels/cards, locks and vacuum overlays
```

Wall top and side use two shared matte gradients. One shared filter supplies
only the soft exterior ambient shadow of the complete building footprint;
internal wall-contact and opening-leaf shadows are deliberately absent.
Definition count is constant per card, never per face or opening. Forced
colours use solid `Canvas`/`CanvasText` faces and omit decoration. A runtime
without the required filter paint keeps solid structure, floor edge and
vertical panels but emits no ambient shadow; this does not enter the structural
fallback latch.

### Vertical openings and display settings

`src/iso-openings.ts` mirrors the existing opening-symbol transform algebra:
door has one jamb-hinged leaf, gate has two leaves with the established
0–10° exterior-face turn, and window has two light neutral casements. A saved
`passage` keeps the same full-height masonry cut but has zero leaves/panels.
Heights are fixed presentation ratios of
`ISO_WALL_HEIGHT`; there is no schema field.
The saved opening axis and Flat symbol remain on their canonical centreline.
Derived 2.5D door/gate leaves pivot on the selected physical host face so their
prisms do not start inside masonry; windows remain centred across the reveal.
`flip_v` selects/determines the physical face and opening direction without
changing saved coordinates. Jamb/cut depth remains physical and independent of
the Flat symbol. Panels are pointer- and ARIA-inert. Existing lock badges/cards
and HA actions remain the only interactive opening surface.

- borders visible: vertical panels replace the floor-plane symbols;
- `hide_openings: true`: panels disappear, while masonry
  cuts, Glow/sun and contact/lock meaning remain;
- `show_borders: false`: Stage 2 roots are absent and the established floor
  symbols and Stage 1 projected frame return (subject to `hide_openings`),
  avoiding floating panels or an invisible Stage 2 bound that reframes them;
- Flat, editors and `houseplan-space-card` retain their old symbols and DOM.

Stage 2 adds no window beam, Glow source, sun renderer, material config,
network request or HA service path. Structural topology/projection exceptions
still use the Stage 1 latched Flat fallback. The known independent exact-SHA
view-toggle performance debt remains tracked in #124; #122 neither weakens its
budget nor treats fallback as benchmark success.

## Stage 4 visual handoff (#570) — as documented before #679

> Historical: written while 2.5D was a hidden `hp_alpha` experiment. Since #649
> it is public; activation is described in [Activation](#activation).

Stage 4 refines the same hidden `iso` presentation behind `hp_alpha`; it adds no
public switch, configuration field or experiment id. Stage 3 history remains in
`docs/specs/160-isometric-stage3.md` and
`docs/adr/160-isometric-stage3-overlays.md`; the current acceptance contract is
the reviewed specification in issue #570 plus its revision-3 designer handoff.

### Camera and low screen-facing overlays

The camera is orthographic `rotDeg=0`, `tiltDeg=20`, with the same `[500,500]`
pivot and scale-aware 84-unit wall height. Floor SVG, wall/opening projection,
inverse hit mapping, invisible collision footprints and fit bounds share that
one affine authority.

Device markers, room labels/cards and opening-lock badges keep their canonical
floor anchors but render on a low plane four visual units above the floor.
Devices and lock badges in the same room whose canonical reference-fit bounds
(expanded by 12 CSS px) connect form one rigid cluster. Every member receives
the same scene-space displacement, so pairwise vectors, rows and intervals are
the affine projection of the Flat layout rather than a per-marker fan toward a
room safe point. Room labels never enter a cluster and stay below interactive
roots.

The reference-fit view, not the current live view, converts CSS safety values
into scene units. Wheel/button zoom, pinch and pan therefore transform an
already resolved scene and cannot invalidate placement. Structural changes —
stage/camera, walls, rooms, marker membership or canonical anchors — rebuild it
deterministically; viewport movement and HA-only state do not. One common
vector clears the exact wall silhouettes and already placed clusters within an
absolute 48 CSS-pixel reference-fit budget, using stable size/required-shift/
kind-id order and boundary candidates instead of scanning the displacement
disk. The correction is runtime-only and is never written to configuration.

If no completely legal common vector exists, the nearest deterministic result
keeps the cluster rigid and prioritises room ownership, then wall clearance,
then overlap with an earlier cluster. It never splits or shrinks a cluster;
residual overlap is an explicit degraded diagnostic. This supersedes the old
single-marker fallback while retaining the 48 px cap. The two full isometric
profiles keep the ordinary 150/60/75 ms resize/pan/state noise allowances
(#585, #651).
Fit probes reserve the maximum correction but do not execute live collision
search. There is no painted plate, long tether, ground dot or per-marker
shadow. The original screen-facing HTML root remains the only hit, focus,
tooltip and action target, and selection/hover cannot invalidate the placement
cache. Vacuum, Glow/spill, SUN, room fills/hover, arbitrary decor,
furniture/backdrop, stairs and every persisted coordinate remain on `z=0`.

Room names remain screen-facing and lose stroke, text shadow, drop shadow and
halo. Iso uses `#303936` on a light presentation and `#f2f0e8` on a dark one;
contrast comes from colour and the bounded position correction, never an
outline.

### Openings, occlusion and materials

Door leaves turn by `50° × openingAmount`, paired window leaves by `65° ×
openingAmount`, and gates retain their established 0–10° behaviour. The same
canonical flips/host face that drive the floor symbol determine hinges and
direction; missing, unknown or unavailable state keeps the existing static-plan
fallback. Opening geometry stays inert and lock actions stay on the existing
guarded lock badge/card.

For wall height `H`, the fixed window frame spans `0.38H..1.00H`, its sash
`0.40H..0.98H`, and clear glass `0.45H..0.93H`; frame/sash rails are `0.05H`.
Frames and sill are neutral, glass side is `#c9e4f3` and its top face is
`#e3f2fa`. Fixed and live faces remain in `buildIsoWallDepthQueue()`. The slots
belonging to one opening are resolved by physical camera depth, so raised glass
covers the rear sill and rotating door/gate prism faces retain their physical
order without reordering unrelated walls or openings. Door/gate faces use
fill differences instead of strokes; window frame/glass borders remain.

The constant material/filter set remains theme-aware and bounded. Only the
building ambient shadow remains; wall-contact and leaf shadows are omitted.
Forced colours or missing filter support remove texture and the ambient shadow, not geometry,
ownership or actions. `show_borders:false` is the exact no-volume branch: the
floor keeps the real 0°/20° affine matrix and interactive overlays return to
their floor anchors. `hide_openings` removes vertical decoration but preserves
cuts, Glow/SUN and lock semantics.

The eight-entry structural LRU fingerprints the 0°/20°/84 profile, opening
policy revision 3 and structural algorithm 5. It excludes HA state, live
opening amount, hover/selection, theme, SUN and filter capability. The lazy
`iso-scene-render` graph is still not requested with alpha off; topology,
projection or module mismatch still enters the established fingerprint-latched
Flat fallback. Linux exact-SHA goldens and performance profiles remain the
canonical release evidence.

