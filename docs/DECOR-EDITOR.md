# Background editor: current contract

Status: implemented in v1.60.0. This document is the source of
truth for the decorative layer. `BACKDROP.md`, `LIVE-TEXT.md` and
`FURNITURE.md` describe the specialised parts.

## Purpose and invariants

The Background editor is a visual annotation layer. Its shapes, furniture,
text and plan image never participate in rooms, wall geometry, light routing,
device state or Home Assistant actions.

| Invariant | Contract |
|---|---|
| Coordinates | Axis-aligned positions and every box dimension are quantised to the space grid. A rotated resize keeps its opposite world-space corner fixed and quantises dimensions; its derived unrotated storage origin is not post-snapped, because that would translate the entire object. `Shift` never disables dimension snapping. |
| Physical values | Stroke and text sizes are stored in centimetres; the UI shows cm/in for small values and m/ft for object dimensions. |
| Undo | Decor and backdrop use the same named 50-command stack as plan geometry. |
| Cancel | `Esc` restores the state at the start of an active drag/draw/resize/rotate gesture. A completed gesture is reverted with Undo. |
| Selection | One click selects; drag moves; the selected object has one common transform frame; double click opens all editable properties. |
| Scale | Corner drag preserves aspect ratio. Hold `Shift` for independent axes. |
| Rotation | 5° steps by default; `Shift` gives free rotation. Lines use endpoint handles instead of a rotation handle. |
| Magnet targets | Only other decor objects and room contours: corners, edge centres, centres and edges. The image, devices and openings are excluded. |
| Context emphasis | Decor and its editing chrome stay fully opaque. Rooms, labels, devices, openings, solid/thick walls and dashed virtual walls are contextual only and render at 35% opacity. |
| Compatibility | Legacy `width`, text `size/scale` and `plan_scale` remain readable. New writes use `width_cm`, `size_cm` and `plan_scale_x/y`. |

## Tools

| Tool | Pointer action | Live feedback | Properties |
|---|---|---|---|
| Select | Select/move any decor object; corner handles resize; upper handle rotates | common selection frame and standard move/resize/rotate cursors | double click opens geometry, angle, contour/fill colour and opacity; text also exposes its content |
| Plan backdrop | Move the image by its body; resize/rotate by the frame | size badge; 5° rotation step | double click opens width, height and angle |
| Line | Drag between two grid points | length, angle, magnetic alignment guides | endpoint handles; length, angle, stroke colour/opacity/thickness; Solid or Dashed style |
| Rectangle | Drag a diagonal; `Shift` makes a square | width × height and area | size, angle, contour, optional independent fill colour/opacity |
| Oval | Drag its bounding box; `Shift` makes a circle | `R` for a circle, `Rx × Ry` for an oval | bounding size, angle, contour and optional fill |
| Text | Click to open the text form | the saved label is selected immediately | content, HA variables, colour/opacity, physical size and angle |
| Furniture | Pick a symbol, then click its centre | wall magnet unless `Shift` is held | size, angle and contour style; the common frame preserves ratio unless `Shift` is held |
| Erase | Click a decor object; text uses its whole logical bounding box, including spaces between glyphs | confirmation dialog, then atomic removal of the whole object | A miss changes nothing; Undo restores a removed object |

The editor always opens on **Select**. If the space has an image, the Plan
backdrop tool appears next to Select but is never armed implicitly.

## Plan image behaviour

The plan image is interactive only while **Plan backdrop** is selected.

| Context | Image opacity | Frame/body interaction |
|---|---:|---|
| View, Plan editor, Device editor | 1.0 | none |
| Background editor, Select/drawing/furniture/erase | 0.5 | none; the stage remains available for pan/draw |
| Background editor, Plan backdrop | 1.0 | move, proportional/independent resize, rotate |

Stored transform fields:

```text
plan_x, plan_y                 top-left offset, normalised to the square canvas
plan_scale_x, plan_scale_y     independent positive multipliers
plan_angle                     degrees, normalised to -180..180
```

`plan_scale` is the legacy uniform fallback. The maintenance command converts
it losslessly to both axis fields. Reset removes every transform field.

## Style and units

New decor writes use:

```text
color, opacity, width_cm
fill, fill_color, fill_opacity       rectangles and ovals only
size_cm                              text only
line_style: dashed                   dashed lines only; absence means Solid
```

`width_cm` and text `size_cm` are independent physical styles. Resizing a
rectangle or sofa does not make its outline thicker. A legacy object with render-unit `width` stays
pixel-identical until edited or explicitly optimised; conversion is
`width_cm = width / GRID_PITCH × cell_cm`.

The toolbar values are session defaults for newly drawn objects. Colour is a
compact swatch; its popover owns both the native colour field and opacity, so
alpha controls do not consume permanent toolbar space. Double-click properties
edit an existing object without creating a second style model.

Line style is intentionally absent from the drawing toolbar. Every new and
legacy line is Solid by default. Double-click a line with **Select** to switch
that individual object between **Solid** and **Dashed**; switching back removes
the optional `line_style` key instead of persisting a redundant default.

## Interaction state machine

```text
idle → draft/move/scale/rotate → release → named history command → debounced save
                          ↘ Esc → restore transaction start → idle
```

Only the active tool owns pointer events. Drawing tools can therefore start a
new line or figure exactly on top of an existing object. Select and Erase are
the general tools that target existing decor. The deliberate exception is
Text: clicking an existing text label with Text opens that label's editor;
clicking any non-text shape still starts a new label. The backdrop body belongs
only to the Plan backdrop tool.

`Ctrl/Cmd+Z` first cancels an unfinished draft or live gesture, then walks the
shared history. `Ctrl+Shift+Z` and `Ctrl+Y` obey the same transaction boundary:
the first invocation cancels a live gesture, the next redoes. Native text-field
history wins while focus is inside an input.

## Code ownership

| Concern | File |
|---|---|
| persisted decor types and future custom-image transform contract | `src/editors/decor/types.ts` |
| physical style conversion, oriented boxes, resize and snapping | `src/editors/decor/geometry.ts` |
| shared colour/opacity field | `src/hp-color-opacity.ts` |
| orchestration, dialogs and SVG transform frames | `src/houseplan-card.ts` |
| static/full-card backdrop rendering and content bounds | `src/space-render.ts`, `src/space-geometry.ts` |
| accepted persisted ranges | `custom_components/houseplan/validation.py` |
| explicit legacy conversion | `src/plan-optimizer.ts` |

The current root card still owns orchestration. Future extraction should move
it into `src/editors/decor/decor-editor.ts` without changing the typed model or
geometry helpers.

## Deferred custom images

User-provided decorative images are not exposed yet. The typed
`DecorImageTransform` contract already matches the common selection controller
(`x/y/w/h/angle/opacity`). A future image kind must additionally define safe
upload/reference lifecycle, quotas, copy-on-write and deletion semantics before
it is added to `DecorShape`; it must not reuse the plan backdrop file lifecycle
implicitly.

## Edge cases

- Degenerate drafts below half a cell are discarded and do not enter history.
- Unknown furniture symbols remain stored but render nothing in an older card.
- A rotated box contributes all four rotated corners to content bounds.
- A rotated backdrop is hit-tested in its own local coordinate system.
- Changing `cell_cm` changes the rendered width/font size of canonical physical
  styles, as expected: it changes the scale of the whole space. Legacy
  render-unit strokes/text retain their old pixels until migration.
- External config revisions clear the session history; undo never applies a
  command to a different server revision.
