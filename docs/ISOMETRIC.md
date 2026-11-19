# Isometric (2.5D) View

The current presentation integrates the accepted #1451 UI Lab handoff dated
18 November 2026. It replaces #713's vertical oblique, uncompressed floor.
The previous numeric camera and marker-placement policies are historical;
their rationale remains in the #89/#160/#570/#649/#713 ADRs and issues.

This is a deterministic presentation of the same canonical 2D plan, not a
second saved model, an interior editor or a free 3D camera.

## Activation and surfaces

The existing `settings.volumetric_view` enables the mode in ordinary View,
the Home Assistant panel and kiosk. Missing/false keeps Flat. All three
editors and the static space card remain Flat; static still has its existing
limited decor support. No URL, DOM dataset, alpha toggle or laboratory opening
amount enables the production presentation. Existing wording marking the mode
as in development remains until a separate owner decision.

With `show_borders:false`, there is no volume: floor, furniture, fitting and
hits use Flat's quarter turns. The saved preference is not cleared.
`hide_openings` hides opening paint, not its cut or optical meaning. Hidden
decor does not request the furniture-volume registry.

The canonical settings, dimensions, positions, bindings and leaf states are
read-only inputs. Turning, viewing and entering/leaving an editor do not write
config/layout or substitute the dimensions of the demonstration house.

## One camera and one inverse

`iso-projection.ts` and the pure profile in `iso-lab-camera.ts` are shared by
main and geometry worker. The module's historical name is not an opt-in.
It reads neither `document` nor `location`.

```text
saved quarter turn = 0 | 90 | 180 | 270
camera yaw        = 35 degrees + saved quarter turn
elevation         = 40 degrees above the floor
floor Y scale     = sin(40 degrees)
height projection = cos(40 degrees), vertically up the screen
origin            = [500, 500]
wall/column cut   = 140 physical centimetres, converted by the space scale
```

`ISO_WALL_HEIGHT=84` is retained only as the accepted furniture recipe's
reference-scale constant. It is not the physical wall-cut height; call
`isoDisplayWallHeight()` for that height before the usual grid conversion.

`isoPlaneMatrix()` projects every floor/height point; its inverse maps clicks
back to plan coordinates. Fit, room fit, SVG floor, volume faces, HTML device
anchors, locks, LED geometry and vacuum placement use the same effective
snapshot. `isoCameraDepth()` supplies the compatible orthographic depth.
Camera yaw is not a valid `PlanRotation` or a cache quarter-turn key.

The stored viewport belongs to the zero-quarter presentation plane. Its centre
is not already plan XY. `projection-view-camera.ts` converts that centre through
the authoritative projection/inverse when changing planes, including an
off-centre view and hidden-border transitions. Screen width is retained and
normalized zoom is read against the new frame. Active quarter turns use the
same compressed-plane camera algebra in `view-frame.ts`. Warm viewport state
records its actual plane separately from the desired preference.

A cold projection handoff cannot accept scene-unit fallback bounds as a
measured viewport. Both stage dimensions must be positive before fitting;
the existing restore/refit owner completes a hidden or not-yet-mounted stage.
A measured but still veiled interim Flat frame does not replace the saved
scalar zoom with its re-encoded physical scale. Accepted visible/warm cameras
continue to preserve their physical centre and pixels per unit.

## Physical construction and openings

The canonical wall footprint, physical junctions and opening hosts remain the
only source of geometry. `iso-walls`, `iso-openings` and `iso-scene-*` derive
cutaway surfaces without rewriting wall axes, widths or opening positions.
Windows have masonry below their sill; reveals start at the sill, the neutral
white frame reaches the cut and handles face the room. Doors and passages
have a lintel. Gates use the accepted metal sections, ribs and vertical handles.
Round columns retain a smooth projected ring.

Opening flips, host face, hinges and hardware follow the same leaf. Live
positions come from the ordinary opening resolver, including manual states,
entity availability and inversion. Unknown bound leaves keep their neutral
unknown indication rather than a fabricated open position. Supported states:

- doors: one swing leaf at up to 50 degrees, or the existing translated slide;
- gates: paired leaves up to 90 degrees, or the supported slide;
- windows: 1–4 independent leaves with side opening up to 65 degrees;
- existing `hinge:top`: the accepted 2.5D depiction tilts up to 30 degrees
  around the lower edge, rather than the former symbolic parallel translation;
- passages: no moving leaf; the architectural opening and lintel remain.

`hinge:top` is not migrated or renamed. Flat symbols, contact/cover bindings
and resolved amounts retain their existing meaning. The visual interpretation
and its older-plan witness must be noted to the owner before release.
No physical curtain/shutter model, user opening height or new opening type is
introduced. The handoff's 80 cm doors and special partial states are fixtures,
never production defaults.

Closed opaque leaves and the artificial-light boundary share the selected
physical face from #1449. Transparent/open leaves and each shade section keep
their existing optical meaning. Floor sunlight lies below furniture; furniture
adds no light source or HA service action.

## Furniture and live overlays

The 60 inert companion SVGs in the furniture pack carry accepted part heights
and profiles. One generated, fingerprinted lazy registry supplies both the
plan and the standalone developer gallery. No mesh is saved in configuration.
Width/depth, rotations and mirrors use the existing decor box; model parts use
their accepted height recipe. The Flat designer art and legacy IDs are retained.
`FURNITURE.md` describes storage, the generator and workstation links.

Faces share the accepted translucent matte/glass material and camera depth
with masonry/openings. A nearer wall occludes furniture, while the far-wall
monitor remains visible. Sunlight remains on the floor; room lighting also
affects the mounted equipment and its separately placed computer tower.

Markers stay at their saved plan anchors. The accepted floor-aligned tiles and
group shells replace the older uniform wall-top marker policy in this view.
A wall-covered device is dimmed and loses its shadow, not its action/focus
target. Solid and dashed outlines remain distinct, and one common contact
shell does not merge members' actions. Forced colours retain meaningful targets
without depending on decorative filters.

Furniture masks only the overlapping paint of a room label. The room-fit
target and Area link retain their existing mouse/keyboard policy; touch keeps
the established Area-link safety contract. The ordinary lock card and its
confirmation remain the only sanctioned lock actuation surface. Rendering,
occlusion and hover never create a service call.

## Caches and safe failure

Physical geometry and projected variants stay separate. The structural LRU
remains bounded at eight entries; variants are keyed by saved quarter turns,
not yaw. The fingerprint includes the physical source, camera/profile and
structural algorithm. Pan, zoom and ordinary HA-only changes do not rebuild
physical walls. #1454 worker snapshots/codecs preserve the same camera and
round-column bases; persistent keys also include the build identity.

The volume registry is requested only when visible volume furniture needs it.
The initial loading window/continuity waits for applicable assets but retains
its existing finite cap. A failed/mismatched registry yields the full Flat
presentation, not missing objects or an endless retry. A scene/furniture build
exception clears projected foreground, shadows and label masks in that same
first failed frame, renders all ordinary Flat decor, and leaves the next update
usable. Config/layout and the saved preference are untouched.

The existing per-source fallback latch and safe, non-private diagnostics remain.
Changed physical input or an explicit retry follows the existing lifecycle.
There is no public fault-injection flag; tests inject failures only in isolated
synthetic fixtures.

## Acceptance and limits

The original handoff is `DEV-HANDOFF-ff45c3ef.zip`, SHA-256
`25849fcbf0652186f93143844fd7255d0a905aabfdd4fb05087d428b0605fe00`.
The owner accepted comparison with its PNGs on a synthetic plan because the
separate private reference scene was not available. Record four camera turns
in light/dark themes at 1480×1080, DPR 1 and Fit. Differences in scene/browser
must not be reported as pixel-perfect equivalence. Product golden acceptance
remains separate and explicit.

Native card/panel/kiosk, off-centre projection round trips, hidden borders,
opening/shade states, safe actions, first-frame failures, gallery models and
workstation persistence/import are addressed witnesses. A laboratory
`--native` route alone is not proof of actual HA storage or ACLs.

There is no volumetric editor, free rotation, editable 3D mesh, automatic wall
binding of furniture or standalone static-card expansion. Dedicated cache
optimization and cast shadows from opening leaves remain deferred.
Testing, review, merge and releases follow `PROCESS.md`; this document adds
no new global gate or owner-GPU requirement.
