# UX redesign: three modes (approved 2026-07-21)

> Approved design for reorganizing all card interactions into three tab-like modes.
> Driven by the owner's mandate and confirmed by real user feedback
> ([issue #3](https://github.com/Matysh/houseplan-card/issues/3): *"When moving the
> map around, I sometimes move the doors/sensors around"*). This document is the
> source of truth for the implemented mode architecture and later iterations.

## Principle

A segmented control in the card header with three tabs; the active one is visually
highlighted, and edit modes add a colored frame around the stage so the mode is
obvious at a glance:

**[ 📐 Plan editor ] [ 🔧 Device editor ] [ ✏️ Background editor ]** — View has
NO tab (since v1.30.2). The Background editor (v1.33.0) manages a purely visual
decor layer (lines/rects/ovals/text in `space.decor`, drawn under the rooms,
inert everywhere outside its editor).

- **View** is the implicit default state: no editor tab is active. Navigation
  persistence remembers only the last space. Reloading the page or leaving
  House Plan for another Home Assistant route and returning always opens View
  for that space; editor mode, selection and open editor dialogs are session
  state. A purely technical same-route Lovelace remount may preserve an
  unfinished editor session so an internal DOM rebuild does not destroy work.
- Activating an editor tab highlights it and opens that editor's bottom toolbar
  (all three editors have one). The toolbar and the active tab each
  carry an **X** that closes the editor back to View; re-clicking the active tab
  does nothing; editors switch directly with a short content fade and an
  interpolation between their measured toolbar heights, including wrapped
  multi-row layouts. Toolbar height, usable plan height, zoom/centre, canvas
  background and editor-specific layers move on one short timeline, so opening
  an editor never flashes a default scale or a mixed dark/white frame. A rapid
  second choice retargets from the visible intermediate frame. Reduced-motion
  preferences apply the same final state immediately. The header X keeps its
  compact 13 px glyph but owns a hit target of at least 24 × 24 px without
  changing the tab's layout footprint.
- An editor's primary toolbar contains only persistent tools. Close is pinned
  in its own end cap. Selection actions, active-tool parameters, operation
  hints and palettes appear in one translucent context tray over the top of the
  stage, so they do not shrink/refit the plan or move Close. The tray is also
  the shared second-level surface for future explicitly approved tool groups;
  existing tools are not grouped automatically.
- All editor tabs are shown only to admins when
  `admin_only` is on.

## Input support policy

`TOUCH-SUPPORT.md` is authoritative for input parity:

- View and kiosk are fully supported touch surfaces. Essential information and
  safe actions may not depend on hover, a fine pointer or keyboard modifiers.
- Plan, Device and Background editors are desktop-first. Mouse/keyboard in a
  desktop browser is the reference editing environment.
- Editor operation on touch is best effort. A gesture or precision operation
  may be awkward, reduced or absent when correct parity is disproportionately
  expensive.
- Best effort never relaxes data integrity, permissions, destructive
  confirmations or protection against a pinch/pointer cancellation being saved
  as an unintended edit.

The presence of editor tabs on a tablet is not a promise of complete editor
support. User documentation recommends desktop for creation and maintenance.

## View — display and device interaction only

Allowed: pan/zoom (wheel, pinch, buttons), switching spaces, device tap
(info / more-info / toggle per settings), long-press → info card, opening tap →
door/lock info card (with an explicit Unlock/Lock button when a lock is bound —
the only way to operate a lock from the card; plan-icon taps never toggle locks),
room-card link icon → HA area (room taps do nothing since v1.40.1), room hover
highlight, hover tooltips (name, clean-floor area, temperature, signal).

Room, device, opening and shared-control hover is a mouse-only transient layer:
the card enables it per instance after real mouse input on fine/hover hardware,
clears it on touch/pen and on mode, space or lifecycle boundaries, and restores
it when a real mouse is used again. Keyboard focus, selection and semantic
device state do not depend on that gate. A device action that actually dispatches
briefly scales its painted shell to 95% and back over 200 ms; informational,
editor and no-op paths do not imitate a successful action.

The global `settings.show_room_tooltip` preference controls only the floating
room information window. Missing or invalid values mean enabled; exact `false`
hides the window while room highlight and every device tooltip remain active.

The admin-only **General settings → Show Zigbee links on device hover** option
is off by default. Once an admin explicitly reads cached ZHA data or updates a
configured Zigbee2MQTT map, mouse hover temporarily draws only the observed
direct links incident to that device. A linked marker in another space is
counted beside the source without drawing an inter-space line. Hover never
fetches data; touch, pen, keyboard focus, kiosk, editors and the static card do
not expose this diagnostic layer.

Removed from this mode (they move, not die):
- icon dragging ("drag anywhere", v1.9 — consciously reversed),
- room-label dragging,
- opening dragging along walls and double-click properties (v1.23.1),
- every edit button in the header (+device, 👁 show-all, ↺ reset, ⬡ rules, ⚙ general,
  per-space gear, markup toggle).

Header in View: space tabs, device count, zoom cluster. Nothing else.

## Plan — geometry and appearance of the space

- Toolbar tools: **Walls** (one continuous chain with its session wall-thickness
  field, default 15 cm — docs/WALL-THICKNESS.md §6), Delete room, Merge, Split,
  Resize, Column,
  Opening (place / drag along walls / properties), Thickness
  (docs/WALL-THICKNESS.md — click a wall, set cm/inches from HA's unit system;
  `0..100`, while empty/invalid values are rejected), Room labels (drag
  positions — labels are part of the plan).
- Space gear dialog (title, plan image / hand-drawn, scale, Display section, show_lqi),
  add space, floors import, delete space. Saving a **new** space opens this
  editor with the draw tool armed (an empty floor has nothing useful in View).
- ⚙ General settings (fill palette) lives here — it is about the plan's appearance.

- Independent partitions and columns are masonry for hit testing as well as
  area/light: room hover stops at their physical bodies just as it stops at a
  thick room wall. This does not split the room or change its HA area.
- Changing Plan tool, editor or floor finishes an open Walls chain as ordinary
  partitions. Closing one or more planar faces opens the room queue; its
  decisions are buffered and applied as one Undo/Redo transaction. Re-selecting
  Walls, Reset, pan, pinch and pointer cancellation are not finish actions.
- Opening places every existing opening type on a room wall or a finished
  independent Walls segment. A hosted opening moves with that segment; deleting
  the segment requires an explicit cascade confirmation. Its physical gap does
  not break the structural wall axis used to recognize closed rooms (#185).
- Zero thickness is part of the ordinary wall system. **Walls** may draw it and
  **Thickness** may apply it to a contour, draft or independent segment. Space
  settings choose one common dashed/solid appearance: dashed transmits Glow and
  sun; solid is a zero-area light barrier. A zero wall cannot host an opening.

### What a space may choose not to draw (2026-08-05)

Four switches in the space's Display section decide how much of the plan is
inked. All of them are **display only** — nothing is deleted, nothing changes
meaning, and each layer stays visible in the editor that owns it, because a
layer you cannot see is a layer you cannot edit.

| Setting | Off (default) | On | Always drawn in |
|---|---|---|---|
| `show_borders` — «Всегда отображать границы комнат» | in View, room borders and zero-thickness wall lines are hidden | both are drawn | room borders: Plan; zero-thickness walls: all editors |
| `show_names` — «Показывать названия» | no room name/card is drawn in View, kiosk or the static card | the HTML room card is drawn | Plan, for positioning only |
| `hide_decor` — «Скрыть декоративный слой» | decor is drawn | lines, shapes, labels and furniture are hidden | the Background editor |
| `hide_openings` — «Скрыть проёмы» | doors, windows and gates are drawn | their symbols are hidden | the Plan editor |

- **Zero-thickness walls follow `show_borders` in View.** Every editor
  deliberately shows their axes regardless of the switch: hiding geometry
  while editing a plan, device placement or its underlay makes those modes
  visually ambiguous. Their solid/dashed choice still affects light while the
  line itself is hidden.
- **`show_names: false` means no permanent fallback label.** View, kiosk,
  hidden isometric and `houseplan-space-card` all omit the room name. Plan may
  show the same HTML card temporarily so its saved position remains editable;
  returning to View hides it again. Re-enabling names restores the saved
  layout rather than creating a new one.
- **Their geometry and their presentation are separate.** Every zero wall ends
  on its saved axis node. In View a neighbouring thick body may paint over the
  line end so it visually stops at the masonry face; editors paint the full
  axis over the body for unambiguous editing.
- **`hide_openings` hides the symbol, not the opening.** Light still spills
  through it, the sun still enters at a window, a contact sensor still opens
  it, and the resize tool still anchors to it. Anything else would be a second
  meaning for one setting.
- Both hide switches store **nothing when off** (the key is omitted, as
  `bg_color` is), so a plan written before this reads back byte-for-byte.
  Backend: `show_names`, `hide_decor` and `hide_openings` are strictly `bool`
  and optional.

## Devices — placement and marker configuration

- Icon dragging (ONLY here). Click on a device opens the **edit dialog directly**
  (binding, name, icon, size/angle, display as icon / icon + activity / value,
  activity color and size, tap override,
  model/link/description/PDFs, room).
- The toolbar always keeps position-only Undo/Redo beside Close. One released
  drag is one command; cancellation, no movement and a failed write create no
  command. The independent 50-step session stack also uses `Ctrl/Cmd+Z`,
  `Ctrl/Cmd+Shift+Z` and `Ctrl+Y` and never absorbs marker configuration,
  lifecycle or Plan/Background edits.
- + add device/entity/virtual, the bottom-left "Hide" / "Show" action in an
  existing device dialog (the one hiding mechanism, docs/FILTERING.md),
  👁 "Show hidden" (local editor tool; replaced the shared show-all toggle),
  ⬡ icon rules.

## Background — the decor underlay

- Toolbar tools: Select / optional Plan backdrop / Line / Rectangle / Oval /
  Text / Furniture / Erase, plus contour colour+opacity, physical width,
  optional fill colour+opacity and shared Undo/Redo. Shapes are drag-drawn
  with grid/decor/room snap and a live preview.
- In **Select**, double click always means “edit this object”. Text opens its
  text/HA-variable form; a line, rectangle, oval or furniture symbol opens the
  complete numeric/style form, with Fill where the shape supports it. Every
  selected kind has the common move/resize/rotate controller; lines use end
  handles. The image is transformed only in its own tool and fades to 0.5
  below the other Background tools.
- **Live size badge** (owner 2026-08-04): while a LINE is being dragged out, the
  same `.measurelabel` the Plan editor puts on a wall shows «length · angle» —
  `segmentCm` over the space's `cell_cm`, metres or feet per the HA unit system,
  green on a 45° multiple. It rides the MIDDLE of the segment (a wall badge
  follows the cursor because the cursor is the wall's free end; a decor line is
  pulled out by both ends at once), updates on every move and disappears the
  moment the shape is committed. Rectangles show size and area; circles show
  `R`, and non-circular ovals `Rx × Ry`; a draft with no size shows nothing.

## Plan — independent physical objects

- **Walls** draws one continuous crash-safe chain. Newly closed planar faces
  may become rooms; changing tool/editor/floor finishes an open chain as
  independent wall objects. A click on another saved draft endpoint may join
  it, while branching from the middle of a saved draft is unsupported.
- Finished independent walls remain selectable physical objects. **Column**
  places a square column whose side is the current Thickness value. Neither an
  independent wall nor a column creates a room or HA area by itself. A closed
  independent-wall ring subtracts only its wall body from room floor.
- Door, window, gate and passage may be hosted by one finished independent wall
  segment. Drafts and columns are never opening targets. Missing hosts fail
  dark and expose a rebind action only in Plan.
- **Select** is the only mode in which these objects intercept input. It offers
  rigid grid-bound drag, double-click/tap properties, Delete, and a rotate
  handle for square columns (5° steps; Shift is free). Draft Delete removes the
  whole outline; its properties dialog separately offers segment deletion.
- Physical objects are inert in View/kiosk. `show_borders: false` hides their
  paint in View without changing area or light physics.

## Deprecations decided

1. "Drag anywhere" (v1.9) — reversed by this design.
2. Opening drag / dbl-click properties in view (v1.23.1) — moved into Plan.
3. The markup toggle button — replaced by the Plan tab.
4. Legacy localStorage mode (card without the integration) — candidate for removal
   in the next major; adds branching for a half-working scenario.

## Approved follow-up features (from issue #3, by priority)

1. State-reflecting icons (open/closed door variants etc., like core HA).
2. `display: value` — show the measurement instead of an icon.
3. Light color in the activity effect (RGB lights). *(Shipped in v1.27.0;
   superseded in v1.52.0: the colour lives in the glow spot and the activity
   fallback only, the icon tint was removed by the owner's rule.)*
4. Alarm visual (leak/smoke/doorbell): red pulse overlay.
5. Rooms as sub-areas without an HA area + manual device placement by room id.
6. Backlog (not planned): music notes for players, directional TV effects.

## Implementation iterations

- **It.1 — mode shell:** the segmented control, mode state, View-mode gating of all
  edit interactions/buttons (biggest UX win, smallest surface).
- **It.2 — Plan tab:** move markup tools + space dialogs + labels drag + openings
  editing under Plan; colored frame indicator.
- **It.3 — Devices tab:** drag + direct-edit click + filtering tools under Devices.
- **It.4+:** follow-up features 1–5 above, each its own release.


## Kiosk mode (v1.41.0)

`kiosk: true` on the card is the fourth interaction surface: the full View
experience with the header removed and editors hard-blocked (even for
admins). Swipe switches spaces at 1:1 zoom only (zoomed gestures pan;
double tap resets zoom); `cycle: N` auto-advances spaces with a 60 s pause
after any touch; a 3 s long-press on empty plan opens the per-screen size
popover (localStorage). Nav persistence never restores an editor here.
