# Background editor: decor, plan image and text labels

This document is the source of truth for the decorative layer: the Background
editor, the plan image backdrop (formerly `BACKDROP.md`) and the text label with
live Home Assistant values (formerly `LIVE-TEXT.md`). Furniture symbols keep
their own contract in `FURNITURE.md`. Sections are numbered so that code
comments can point at them (`docs/DECOR-EDITOR.md §3.2`).

## 1. Purpose and invariants

The Background editor is a visual annotation layer. Its shapes, furniture,
custom images, text and plan image never participate in rooms, wall geometry,
light routing, device state or Home Assistant actions.

| Invariant | Contract |
|---|---|
| Coordinates | Axis-aligned positions and ordinary shape dimensions are quantised to the space grid. A rotated ordinary-shape resize keeps its opposite world-space corner fixed and quantises dimensions; its derived unrotated storage origin is not post-snapped. Furniture is the explicit exception: resize is continuous, stores positive extents and projects crossing into `flip_h`/`flip_v`. |
| Physical values | Stroke and text sizes are stored in centimetres; the UI shows cm/in for small values and m/ft for object dimensions. |
| Undo | Decor and backdrop use the same named 50-command stack as plan geometry. |
| Cancel | `Esc` restores the state at the start of an active drag/draw/resize/rotate gesture. A completed gesture is reverted with Undo. |
| Selection | One click selects; drag moves; Arrow keys move the selected decor by one visible grid cell without re-running magnets; the selected object has one common transform frame; double click opens all editable properties. |
| Scale | Corner drag preserves aspect ratio. Hold `Shift` for independent axes. Furniture and custom images also have four one-axis middle handles and may cross the fixed edge to mirror. |
| Rotation | Ordinary decor uses 5° steps by default and `Shift` for free rotation. Furniture and custom images are free by default and `Shift` snaps to 45°. Lines use endpoint handles instead of a rotation handle. |
| Magnet targets | Only other decor objects and room contours: corners, edge centres, centres and edges. The image, devices and openings are excluded. |
| Context emphasis | Decor and its editing chrome stay fully opaque. Rooms, labels, devices, openings, positive-thickness walls and solid/dashed zero-thickness walls are contextual only and render at 35% opacity. The whole device presentation (core, ring, capsule, values and badges) is pointer-inert: it never hovers, opens, acts or drags, and the active Background tool receives a press through it. The Plan editor shows devices the same way, as a per-marker 35% fade because room labels share the layer there (#687, `UX-MODES.md` › Plan). |
| View composition | All decor kinds form one layer above room/data fills, room hover fill, opening-tunnel fills and Glow base. Live Glow, sun, physical walls, opening symbols, devices and room labels remain above decor. The plan image remains below it (§3.3). |
| Compatibility | Legacy `width`, text `size/scale` and `plan_scale` remain readable. New writes use `width_cm`, `size_cm` and `plan_scale_x/y`. |

## 2. Tools

| Tool | Pointer action | Live feedback | Properties |
|---|---|---|---|
| Select | Select/move any decor object; corner handles resize; upper handle rotates | common selection frame and standard move/resize/rotate cursors | double click opens geometry, angle, contour/fill colour and opacity; text also exposes its content |
| Plan backdrop | Move the image by its body; resize/rotate by the frame (§3.2) | size badge; 5° rotation step | double click opens width, height and angle |
| Line | Drag between two grid points | length, angle, magnetic alignment guides | endpoint handles; length, angle, stroke colour/opacity/thickness; Solid or Dashed style |
| Rectangle | Drag a diagonal; `Shift` makes a square | width × height and area | size, angle, contour, optional independent fill colour/opacity |
| Oval | Drag its bounding box; `Shift` makes a circle | `R` for a circle, `Rx × Ry` for an oval | bounding size, angle, contour and optional fill |
| Text | Click to open the text form (§5) | the saved label is selected immediately | content with inline HA variables, colour/opacity, physical size and angle |
| Furniture | Pick a symbol, then click its centre | wall magnet unless `Shift` is held | signed size, H/V mirror, angle and contour style; corners resize smoothly, four middle handles change one axis, rotation is free/`Shift` 45° |
| Image | Upload PNG/JPEG/WebP/SVG or pick a stored file, then click its centre (§7) | exact one-shot preview; no wall magnet | opacity, file replacement, signed size, H/V mirror and angle; the whole rotated rectangle is selectable |
| Erase | Click a decor object; text uses its whole logical bounding box, including spaces between glyphs | confirmation dialog, then atomic removal of the whole object | A miss changes nothing; Undo restores a removed object |

The editor always opens on **Select**. If the space has an image, the Plan
backdrop tool appears next to Select but is never armed implicitly.

Decor shapes are inert under a drawing tool — a new line must be able to start
exactly on the end of an old one (owner, 2026-08-04). The **Text tool has one
exception**, asked for by the owner on the same day:

| Text tool, press on… | What happens |
|---|---|
| an existing **label** | its editor opens (the same form, prefilled) |
| empty canvas | a new label is created there |
| a **non-text** shape (line, rect, ellipse) | a new label is created there; the shape stays inert |

## 3. Plan image backdrop

### 3.1. Placement model

The source image is first fitted proportionally into the square plan canvas by
`fitInSquare(plan_aspect, NORM_W)`. The optional transform is then applied:

| Field | Meaning | Default |
|---|---|---:|
| `plan_x`, `plan_y` | top-left offset from the fitted rectangle, normalised by `NORM_W` | `0` |
| `plan_scale_x`, `plan_scale_y` | independent width/height multipliers | `1` |
| `plan_angle` | rotation around the transformed rectangle centre, normalised to -180..180 | `0°` |
| `plan_scale` | legacy uniform fallback for both axes | `1` |

`planRect()` is the single reader used by the full card, static card and content
bounds. New writes remove `plan_scale`; **Оптимизировать планы** converts it
losslessly to both axis fields. Reset removes every transform field and is
itself undoable.

### 3.2. Editor behaviour

The plan image is interactive only while **Plan backdrop** is selected:

| Context | Image opacity | Frame/body interaction |
|---|---:|---|
| View, Plan editor, Device editor | 1.0 | none |
| Background editor, Select/drawing/furniture/erase | 0.5 | none; the stage remains available for pan/draw |
| Background editor, Plan backdrop | 1.0 | move, proportional/independent resize, rotate |

- body drag moves it;
- four corner handles preserve ratio by default; `Shift` allows independent axes;
- the upper handle rotates in 5° steps, or freely with `Shift`;
- double click opens numeric width, height and angle;
- `Esc` restores the transform at pointer-down;
- release creates one named command in the shared 50-step history.

Move and resulting top-left coordinates are grid-bound. Width and height are
quantised when resized or entered numerically. There is no positional modifier
that bypasses the grid.

The frame chrome — dashed outline, four corner handles, one rotate handle on a
stem — is the mechanics every decor transform frame reuses: chrome that never
takes a pointer, handles that always do, with a **hit** radius of 1.8 % of the
visible view so they stay finger-sized at any zoom. A live backdrop gesture
**freezes the view frame**: the picture is a content item, so letting a drag
grow the frame would rescale the view mid-gesture and the picture would run
away from the finger; the frame catches up on release. The backdrop transform
is part of the model fingerprint, so a drag never leaves a memoised model (and
the content frame built from it) showing the old rectangle.

### 3.3. Rendering and layer order

The image is purely decorative and never changes rooms, walls, openings,
devices, Glow or sun geometry. It is still a content item for fit/pan bounds;
for a rotated image all four rotated corners contribute to those bounds. A
rotated backdrop is hit-tested in its own local coordinate system.

Layer order, top to bottom:

```text
devices and room labels
opening symbols / positive and zero-thickness walls / late room-hover outline
sun rays
live Glow pools
decor
room hover fill / Glow-base rooms and tunnels / data room fills and tunnels
plan image
room-shaped paper
scene background
```

The paper remains room-shaped; an image without rooms does not create opaque
paper behind itself (`SUN.md` describes the paper).

### 3.4. Large images (#39)

Before any decode the picked raster is classified from its header bytes only
(`src/backdrop-probe.ts`): PNG IHDR (+colour type/tRNS for alpha), JPEG SOF,
WebP VP8/VP8L/VP8X. Thresholds live in that module as the single calibration
point: a decoded size above `WARN_DECODED_BYTES` (128 MiB ≈ 32 MP) opens a
warning dialog with the real numbers and offers an aspect-preserving reduced
copy (longest side `DOWNSCALE_TARGET_PX` = 4096; PNG with alpha stays PNG,
opaque images become JPEG q0.9, EXIF orientation honoured); a side beyond
`HARD_DIMENSION` (16384, the browser canvas cap) offers only Cancel. A failed
or timed-out decode of the reduced copy shows a toast and leaves staging clean
— the original the user declined is never uploaded silently. Unreadable
headers behave like a warning without numbers. SVG is never rasterised and
skips the probe entirely. Calibration matrix and rationale:
`docs/specs/039-large-backdrops.md`, rerun via
`demo/benchmark_backdrop_decode.mjs`.

## 4. Style and units

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

The primary toolbar always exposes the shared session-default colour and
opacity for new lines, shape outlines, text and furniture. Custom images keep
their own pixels and opacity and do not consume that colour. The same picker also
remains in the applicable drawing context tray; both surfaces read and write one
style state. Width, fill and other active-tool values stay in the context tray
over the stage rather than changing the height of the permanent editor toolbar.
Double-click properties edit an existing object without creating a second style
model: saving colour/opacity for an existing line, shape or furniture item also
becomes the visible default for the next object, as before. Shape fill remains
independent. Select actions and the furniture palette use variants of the same
overlay host, so opening them never refits the plan.

Line style is intentionally absent from the drawing toolbar. Every new and
legacy line is Solid by default. Double-click a line with **Select** to switch
that individual object between **Solid** and **Dashed**; switching back removes
the optional `line_style` key instead of persisting a redundant default.

## 5. Text labels and live values

Released in v1.59.0-rc.1. The shape:
`{kind:'text', x, y, text, color, opacity?, size_cm?, angle?}` — plus legacy
`size?`, `scale?`, `entity?`, `attr?` and `unit?` fields that older plans may
still carry. New live references are stored only inside `text`; existing linked
labels render unchanged and migrate to inline references when that conversion
is lossless. A legacy explicit `unit`, or an attribute name that cannot be
represented by the inline grammar, stays in the legacy fields when edited.

A label is the caption on the wall the plan could not say otherwise: *water
tank 68 %*, *garage 12 °C*, *watering tonight at 20:00* — free-standing text in
the user's own words that happens to contain a live number. It is **not a
second device marker** (no tap action, icon, state class or room aggregation),
**not a template engine** (no expressions, conditions, arithmetic, Jinja or
nested braces) and **not an auto-layout** (no wrapping, no shrink-to-fit).

### 5.1. Inline HA variables

`text` is both the visible copy and the complete template. It may contain any
number of HA references mixed with ordinary text and line breaks:

- `{sensor.water_tank}` — the entity state;
- `{climate.hall:current_temperature}` — one attribute;
- `Бак {sensor.water_tank}, зал {climate.hall:current_temperature}` — several
  independent values in one label.

The editor writes the colon form because the boundary between entity and
attribute is unambiguous. Hand-written `{climate.hall.current_temperature}` is
accepted too: the first two dot-separated parts form the entity id and the
rest is the attribute. Invalid brace contents stay literal, while a valid but
missing entity or attribute renders as a dash. The 200-character limit is the
limit of the saved template; each resolved value is still clipped to 60
characters.

### 5.2. Rendering rules

- The value is read live from `hass` on every render — the same source as the
  rest of the card, no polling and no subscriptions of its own. A new `hass`
  repaints the label; nothing is re-created.
- **Unavailable / unknown / missing or deleted-from-plan entity** → the value
  renders as `—` (an em dash) **and the dash carries no unit** («— °C» is not
  a reading); the rest of the template stays. A label that silently disappears
  when a sensor dies is worse than one that says "no data".
- Deletion does not rewrite the label template. Re-adding the same HA binding
  makes the saved variable live again.
- An attribute that is not on the entity, or that is a dict, renders as the
  same dash. A list attribute is joined with `, `; `0` and `false` are values,
  not absences.
- **Home Assistant formats the value; we write no formatting of our own.** We
  do not round, reformat or localise decimal separators ourselves: the state
  object goes to **HA's own formatter** (`hass.formatEntityState`, and
  `hass.formatEntityAttributeValue` for an attribute) through the single
  wrapper `hassValue()` in `src/logic.ts` — the same call HA's more-info
  makes. So the label obeys the sensor's `display_precision`, the user's
  decimal separator and the state translations (`on` → *Включено*), because
  those are the user's HA settings and the settings are the one source of
  truth. What is forbidden is duplicating that logic here, not delegating it.
  An older HA without the formatter falls back to the raw state. Imperial/
  metric is not our business either — the value and the unit come from HA
  (`STYLING-HOOKS.md` §6).
- **Units belong to Home Assistant.** State variables use HA's formatted state,
  including its unit. Attribute variables use HA's attribute formatter and do
  not inherit the entity state's unit. There is no separate unit override in
  the editor; a literal suffix can be typed immediately after the token.
- The value is clipped to `LIVE_TEXT_VALUE_MAX` (60) characters: an attribute
  that turns out to be a 4 KB string must not become the plan's wallpaper.
- Editors and kiosk render it identically; in the Background editor the
  *live* value is shown (not the raw template), so the user sees what visitors
  will see while positioning it. The read-only `houseplan-space-card` draws
  only the plan image and custom decor images (`src/space-render.ts`); lines,
  shapes, furniture and text labels — live or not — are full-card only.

### 5.3. The block: size, rotation, lines

- **`size_cm`** — the canonical physical font size, shown as centimetres or
  inches and written both by the numeric properties field and by dragging a
  corner of the selected block. Text always scales proportionally, including
  with `Shift`; changing the plan scale therefore keeps the label's physical
  size meaningful. The backend bounds it to `0.1…2000 cm`.
- **`angle`** — degrees, written by the handle above the block. The step is
  **5°**, the same step a device icon rotates in; **Shift** enables a free
  angle but never disables positional grid snapping. Rotating back to zero
  removes the field, so a straight label stores nothing.
- **Legacy size is read without a silent migration.** A stored `size` is read
  as the multiplier it used to render at — `s` = 0.7 (14 px), `m` = 1 (20 px),
  `l` = 1.5 (30 px) — so an old label comes back at exactly its old size. An
  explicit legacy `scale` wins. The first corner drag or properties save
  replaces both with the equivalent `size_cm`; **Оптимизировать планы**
  performs the same lossless conversion explicitly for the whole model. `size`
  stays in `DECOR_SCHEMA` (bounded to the three known values) precisely
  because old plans keep sending it.
- **Line breaks are the user's own.** The dialog's field is a textarea; a
  newline is stored and rendered as a newline (one `<tspan>` per line, line
  height 1.2 em). The label **never wraps by itself** — a caption that reflows
  on every state change is a caption that jumps around the plan. A
  200-character line stays one line.
- **Multi-line blocks are centred**, horizontally (the decor layer's
  `text-anchor: middle`) and vertically: the anchor `x/y` sits in the middle
  of the block, so adding a second line grows the label in both directions.
- Both gestures pivot on the **anchor** (`x`/`y`), not on a box corner, so a
  label never walks away from the point it was placed at, and a rotated block
  still scales along the same axis. The frame reuses the backdrop frame's
  mechanics and sizes (§3.2). What you **see** is a quarter of the hit radius
  (owner, 2026-08-05: «уменьшить в 4 раза») — a bead, not a button, so the
  frame stops covering the words it frames. The two are different elements:
  an invisible `.dthandle` circle at the full radius owns the gesture, a
  `.dtknob` circle at `hr / 4` owns the paint and takes no pointer. The
  clickable area is therefore unchanged; only the ink shrank — the same split
  the wall-resize handles use (`RESIZE.md`).
- The frame is measured from the rendered glyphs (`getBBox`), so it appears
  one frame after the text and follows every edit of it.

### 5.4. The dialog

- The textarea is the sole source of the label. It accepts ordinary copy,
  line breaks, and manually typed references in any order; Ctrl/⌘+Enter saves.
- «Insert HA variable» contains an entity picker. After an entity is selected,
  the second control offers its state and actual attribute names.
- Choosing the state or an attribute immediately inserts the complete token at
  the textarea's current selection/caret, then returns focus after the token.
  The user can continue typing or insert another variable, including one from
  another entity, until the 200-character field limit is reached.
- There is no unit field, single-slot hint, or separate preview. The label on
  the plan is already the live preview and uses the same text template.

### 5.5. Backend

`DECOR_SCHEMA`, text branch: `text` ≤ 200 characters, `opacity` 0…1, newlines
and inline references included; canonical `size_cm` is finite `0.1…2000`;
`angle` is optional and finite `-360…360`. Legacy `size`, `scale` (`0.15…20`)
and `entity`/`attr`/`unit` remain accepted and bounded so old saved plans
continue to validate and render. The frontend writes none of them after an
ordinary representable label has been edited. It deliberately retains them
when dropping an explicit unit or non-representable attribute would change
what the label says. Tests: `tests_backend/test_validation.py`
(`test_decor_text_live_fields`, `test_decor_text_block_scale_and_angle`).

## 6. Interaction state machine

```text
idle → draft/move/scale/rotate → release → named history command → debounced save
                          ↘ Esc → restore transaction start → idle
```

Only the active tool owns pointer events. Drawing tools can therefore start a
new line or figure exactly on top of an existing object. Select and Erase are
the general tools that target existing decor; the Text tool's exception is in
§2. The backdrop body belongs only to the Plan backdrop tool.

`Ctrl/Cmd+Z` first cancels an unfinished draft or live gesture, then walks the
shared history. `Ctrl+Shift+Z` and `Ctrl+Y` obey the same transaction boundary:
the first invocation cancels a live gesture, the next redoes. Native text-field
history wins while focus is inside an input.

With **Select** active, each Arrow key moves any selected line, shape, text,
furniture or custom image by one current grid cell along the canvas axes.
`Shift` does not accelerate this command. The move preserves any existing
off-grid remainder and deliberately bypasses decor and wall magnets, so it can
fine-tune furniture away from a wall. Each keydown is one named Undo step;
controls, dialogs and live pointer gestures keep their own Arrow behaviour.

## 7. Custom image lifecycle

The **Image** tool opens one shared catalog. Upload accepts decoded PNG, JPEG
and WebP or a strict, canonical SVG; each canonical file is limited to 2 MiB.
The dedicated store is capped at 200 files / 256 MiB and lives at
`config/houseplan/assets`. An asset id is the SHA-256 of canonical bytes, so an
identical upload reuses one file. Config records contain only `asset_id` and
the normal decor transform.

Placement is one-shot: select a file, inspect the pointer preview, click once,
then the editor returns to Select. The initial width is 100 cm; height preserves
the file ratio and is capped at 200 cm. Unlike furniture, images never magnetise
to walls. Removing or replacing an object does not remove the shared file. The
catalog can explicitly delete a file only when the backend finds no references
in any space.

Missing or hash-mismatched content fails dark in View and the static card. In
Background it becomes a bounded selectable crossed placeholder so the user can
replace it without losing position, size, rotation, mirror or layer order.
Export v2 records hashes and availability but never embeds image bytes; an
import with missing bytes requires confirmation and preserves that placeholder.

**Backend invariants.** Raster input is fully decoded and SVG passes a strict
allowlist before promotion. `houseplan/assets/resolve` takes its reference
snapshot under the config write lock, does file I/O after releasing it and reads
only the requested sidecars. Resolve and HTTP GET share one memory-only
`AssetIntegrityVerifier` per HA instance: streamed SHA-256, at most 256 digests
keyed by canonical path plus size/mtime/ctime, per-file-version single-flight
with a bounded follower wait. Both stat signatures must be a regular file, so
bytes changed mid-read never enter the cache; missing, changed, non-regular or
corrupt files fail dark. The frontend `ContentSigner` batches `<image>`
signatures. Quota counts every regular `<sha256><allowed-ext>` blob by actual
size, including blobs with absent or malformed sidecars; a sidecar without a
blob does not count, and entries vanishing mid-scan are skipped. Delete rechecks
references across every space under the config write lock and removes only the
exact sidecar and allow-listed blob names under the reference/upload locks:
never a prefix, temp file, directory or unknown extension. There is no automatic
orphan collector. Failed resolve transport calls are not cached.

## 8. Code ownership

| Concern | File |
|---|---|
| persisted decor types and custom-image transform contract | `src/editors/decor/types.ts` |
| physical style conversion, oriented boxes, resize and snapping | `src/editors/decor/geometry.ts` |
| furniture-only continuous resize, flip projection and SVG transform | `src/furniture.ts` |
| shared colour/opacity field | `src/hp-color-opacity.ts` |
| orchestration, dialogs, SVG transform frames, backdrop gestures and reset | `src/houseplan-card.ts` |
| live text: `liveText`, `liveTextReference`, `liveTextToken`, `liveTextValue`, `decorTextScale`, `decorTextLines`, `hassValue` (pure, unit-tested) | `src/logic.ts` |
| fitted/transformed backdrop rectangle and rotated bounds | `src/space-geometry.ts` |
| static-card backdrop and decor images | `src/space-render.ts` |
| large-image probe and thresholds | `src/backdrop-probe.ts` |
| accepted persisted ranges (`DECOR_SCHEMA`, backdrop transform) | `custom_components/houseplan/validation.py` |
| image validation, content identity and catalog | `custom_components/houseplan/decor_assets.py` |
| authenticated upload/list/resolve/delete | `custom_components/houseplan/http_api.py`, `custom_components/houseplan/websocket_api.py` |
| explicit legacy conversion | `src/plan-optimizer.ts` |

Smokes: `demo/smoke_decor.mjs`, `demo/smoke_decor_text.mjs`,
`demo/smoke_live_text.mjs`, `demo/smoke_backdrop.mjs`,
`demo/smoke_backdrop_guard.mjs`, `demo/smoke_bg_color.mjs`.

## 9. Edge cases

- Degenerate drafts below half a cell are discarded and do not enter history.
- Unknown furniture symbols remain stored but render nothing in an older card.
- Furniture `w/h` never become negative: signed property values and handle
  crossing are stored as positive extents plus optional boolean mirror flags.
- Select uses a path-shaped furniture target extending 10 physical centimetres
  beyond painted strokes; empty bounding-box space remains a miss.
- A rotated box contributes all four rotated corners to content bounds.
- A transparent custom image is selected by its complete rotated rectangle,
  not only opaque pixels.
- Changing `cell_cm` changes the rendered width/font size of canonical physical
  styles, as expected: it changes the scale of the whole space. Legacy
  render-unit strokes/text retain their old pixels until migration.
- External config revisions clear the session history; undo never applies a
  command to a different server revision.
