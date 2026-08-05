# The text block — a decor label that can show an entity's state

Status: **implemented (dev, unreleased).** Code: `src/logic.ts`
(`liveText`, `liveTextReference`, `liveTextToken`, `liveTextValue`,
`decorTextScale`, `decorTextLines` — pure, unit-tested),
`src/houseplan-card.ts` (`_renderDecorLayer`,
`_renderTextFrame`, `_renderDecorTextDialog`, the `_dt*` gestures),
`custom_components/houseplan/validation.py` (`DECOR_SCHEMA`, text branch).
Smokes: `demo/smoke_live_text.mjs`, `demo/smoke_decor_text.mjs`;
`demo/smoke_decor.mjs` keeps the surrounding decor contract.

The shape: `{kind:'text', x, y, text, color, scale?, angle?}` — plus legacy
`size?`, `entity?`, `attr?`, and `unit?` fields that older plans may still
carry. New live references are stored only inside `text`; existing linked
labels render unchanged and migrate to inline references when edited.

## 1. Why a live label

The plan already answers "which lamps are on" and "how warm is the bedroom"
through icons and room fills. It cannot answer the things a house says in
words: *water tank 68 %*, *garage 12 °C*, *watering tonight at 20:00*,
*firewood left: 3 days*. Today a user who wants that puts a device marker in
"value instead of icon" mode — which gives a badge with a bare number, always
tied to a device with a position, an area and a tap action. What is missing is
the caption on the wall: free-standing text, in the user's own words, that
happens to have a live number in it.

The competing card (ha-floorplan) covers this with `text_set` and it is one of
its most used features; our decor text was one field away from it.

## 2. Inline HA variables

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
missing entity or attribute renders as a dash.

This remains substitution, not a template language: no expressions,
conditions, arithmetic, Jinja, or nested braces. The 200-character limit is
the limit of the saved template; each resolved value is still clipped to 60
characters.

### 2.1. Rendering rules

- The value is read live from `hass` on every render — the same source as the
  rest of the card, no polling and no subscriptions of its own. A new `hass`
  repaints the label; nothing is re-created.
- **Unavailable / unknown / missing entity** → the value renders as `—` (an
  em dash) **and the dash carries no unit** («— °C» is not a reading); the
  rest of the template stays. A label that silently disappears when a sensor
  dies is worse than one that says "no data": the user must see that the
  caption is alive and the sensor is not.
- An attribute that is not on the entity, or that is a dict, renders as the
  same dash. A list attribute is joined with `, `; `0` and `false` are values,
  not absences.
- **Home Assistant formats the value; we still write no formatting of our
  own.** *(Refined 2026-08-05 — the rule below is narrowed, not revoked.)* We
  do not round, do not reformat and do not localise decimal separators
  ourselves: we hand the state object to **HA's own formatter**
  (`hass.formatEntityState`, and `hass.formatEntityAttributeValue` for an
  attribute) through the single wrapper `hassValue()` in `src/logic.ts` —
  the same call HA's more-info makes. So the label obeys the sensor's
  `display_precision`, the user's decimal separator and the state
  translations (`on` → *Включено*), because those are the user's HA settings
  and the settings are the one source of truth. What is forbidden is
  duplicating that logic here, not delegating it. An older HA without the
  formatter falls back to the raw state, byte-for-byte the pre-2026-08-05
  behaviour. Imperial/metric is not our business either — the value and the
  unit come from HA (docs/STYLING-HOOKS.md §6).
- **Units belong to Home Assistant.** State variables use HA's formatted state,
  including its unit. Attribute variables use HA's attribute formatter and do
  not inherit the entity state's unit. There is no separate unit override in
  the new editor; a literal suffix can be typed immediately after the token.
- The value is clipped to `LIVE_TEXT_VALUE_MAX` (60) characters: a caption is
  a caption, and an attribute that turns out to be a 4 KB string must not
  become the plan's wallpaper.
- Editors and kiosk render it identically; in the decor editor the *live*
  value is shown (not the raw template), so the user sees what visitors will
  see while positioning it. The read-only `houseplan-space-card` does not
  render the decor layer at all — that is unchanged, and out of scope here.

## 3. The block: size, rotation, lines

The old `size: 's'|'m'|'l'` selector is **gone from the dialog**. A caption's
size is not one of three opinions; it is whatever fits the place it is put in.

- **`scale`** — a font multiplier against the base 20 px, written by dragging
  a corner of the selected block (select tool). Bounded `0.15…20` in the card
  and in the backend.
- **`angle`** — degrees, written by the handle above the block. The step is
  **5°**, the same step a device icon rotates in; **Shift** drags past it, as
  past every other snap in this card (docs/CANVAS.md §9.4). Rotating back to
  zero removes the field, so a straight label stores nothing.
- **No migration for `size`.** A stored `size` is read as the multiplier it
  used to render at — `s` = 0.7 (14 px), `m` = 1 (20 px), `l` = 1.5 (30 px) —
  so an old label comes back at exactly its old size. An explicit `scale`
  wins, and the first corner drag **replaces** `size` with the scale it meant:
  a shape never states its size twice. `size` stays in `DECOR_SCHEMA` (still
  bounded to the three known values) precisely because old plans keep sending
  it.
- **Line breaks are the user's own.** The dialog's field is a textarea; a
  newline is stored and rendered as a newline (one `<tspan>` per line, line
  height 1.2 em). The label **never wraps by itself** — a caption that reflows
  on every state change is a caption that jumps around the plan. A
  200-character line stays one line.
- **Multi-line blocks are centred**, horizontally (the decor layer's
  `text-anchor: middle`, which single-line labels already used) and
  vertically: the anchor `x/y` sits in the middle of the block, so adding a
  second line grows the label in both directions instead of pushing the first
  one up.
- Both gestures pivot on the **anchor** (`x`/`y`), not on a box corner, so a
  label never walks away from the point it was placed at, and a rotated block
  still scales along the same axis (a distance from the anchor is invariant
  under its own rotation). The frame chrome — dashed outline, four corner
  handles, one rotate handle on a stem — reuses the backdrop frame's mechanics
  and sizes: chrome that never takes a pointer, handles that always do, with
  a **hit** radius of 1.8 % of the visible view so they stay finger-sized at
  any zoom (docs/BACKDROP.md §2). What you **see** is a quarter of that
  (owner, 2026-08-05: «уменьшить в 4 раза») — a bead, not a button, so the
  frame stops covering the words it frames. The two are different elements:
  an invisible `.dthandle` circle at the full radius owns the gesture, a
  `.dtknob` circle at `hr / 4` owns the paint and takes no pointer. The
  clickable area is therefore **unchanged**; only the ink shrank. Same split
  the wall-resize handles use (docs/RESIZE.md).
- The frame is measured from the rendered glyphs (`getBBox`), so it appears
  one frame after the text and follows every edit of it.

## 4. Tools: what a click does

Decor shapes are inert under a drawing tool — a new line must be able to start
exactly on the end of an old one (owner, 2026-08-04). The **text tool has one
exception**, asked for by the owner on the same day:

| Text tool, press on… | What happens |
|---|---|
| an existing **label** | its editor opens (the same form, prefilled) |
| empty canvas | a new label is created there |
| a **non-text** shape (line, rect, ellipse) | a new label is created there; the shape stays inert |

Under the **select** tool a label is selected and dragged as before, a double
click opens its editor, and the corner/rotate handles appear.

## 5. The dialog

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

## 6. Backend

`DECOR_SCHEMA`, text branch: `text` ≤ 200 characters, newlines and inline
references included; `scale` optional, finite, `0.15…20`; `angle` optional,
finite, `-360…360`. Legacy `entity`/`attr`/`unit` remain accepted and bounded
so old saved plans continue to validate and render. The frontend writes none
of them after the label has been edited. Tests: `tests_backend/test_validation.py`
(`test_decor_text_live_fields`, `test_decor_text_block_scale_and_angle`).

## 7. What this is not

- **Not a second device marker.** No tap action, no icon, no state class, no
  participation in room aggregation (LQI, climate averages) — it is a caption,
  not a device. A user who wants an interactive thing puts a marker.
- **Not a template engine** (see §2). Multiple substitutions do not introduce
  expressions, conditions, or formatting rules.
- **Not an auto-layout.** No wrapping, no shrink-to-fit: the size is set with
  the corners and the lines with the Enter key.
