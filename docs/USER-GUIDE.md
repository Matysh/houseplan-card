# House Plan — complete user guide

Current for **v1.64.0**. This guide describes the interface implemented by the
current source. [Русская версия](USER-GUIDE.ru.md).

House Plan installs two Lovelace cards together:

- `custom:houseplan-card` — the live plan, editors, state and actions;
- `custom:houseplan-space-card` — an inert rendering of one space with a link
  to the full plan.

Configuration, uploaded files and shared positions stay inside Home Assistant.
House Plan does not use a House Plan cloud service.

> **Input support.** View and kiosk are supported on phones, tablets and wall
> touch panels. Create and maintain a plan on a desktop browser with a mouse
> and keyboard. Touch editing is best effort: an operation may be awkward,
> limited or absent, but it must not corrupt data or trigger an accidental
> Home Assistant action. The authority is [TOUCH-SUPPORT.md](TOUCH-SUPPORT.md).

## Contents

1. [Data model and terms](#1-data-model-and-terms)
2. [Installation and access](#2-installation-and-access)
3. [Adding a card](#3-adding-a-card)
4. [Quick start](#4-quick-start)
5. [Interface modes](#5-interface-modes)
6. [Navigation, zoom and input](#6-navigation-zoom-and-input)
7. [Spaces](#7-spaces)
8. [Rooms and walls](#8-rooms-and-walls)
9. [Doors, windows, gates and locks](#9-doors-windows-gates-and-locks)
10. [Devices](#10-devices)
11. [Tap actions](#11-tap-actions)
12. [Device visual states](#12-device-visual-states)
13. [Room fills and light](#13-room-fills-and-light)
14. [Background editor](#14-background-editor)
15. [Sun background and window rays](#15-sun-background-and-window-rays)
16. [Robot vacuums](#16-robot-vacuums)
17. [Kiosk](#17-kiosk)
18. [Static space card](#18-static-space-card)
19. [Plan maintenance](#19-plan-maintenance)
20. [Storage, multiple cards and backups](#20-storage-multiple-cards-and-backups)
21. [Current limitations](#21-current-limitations)
22. [Troubleshooting](#22-troubleshooting)

<!-- docs-section: model -->

## 1. Data model and terms

Settings form a hierarchy. Global settings provide defaults; a space may
override them; a room may override its space; a marker may override its room.

| Level | Meaning | Stored data |
|---|---|---|
| Card | One dashboard instance | Initial space, language, icon size, value/LQI display, live state, kiosk and cycle |
| Global settings | Defaults for all spaces | Fill palette, background, Glow radius, north, sun, weather and icon rules |
| Space | Floor, yard, garage or building | Plan image, scale, rooms, walls, openings, decor and display settings |
| Room | A closed outline | Name, optional HA area, temperature/humidity source and local fill |
| Wall | A side of a room outline | Optional physical thickness and virtual spans on a shared boundary |
| Opening | Door, window or gate on a wall | Size, orientation, contact and optional lock |
| Marker | A device shown on the plan | HA binding, room, action, presentation, light role and attachments |
| Background item | Visual context | Line, shape, text, furniture or plan-image transform |

A room is the spatial unit that owns area and an optional HA area. A partition
or column affects the physical rendering and light but does not create a room.

<!-- docs-section: installation -->

## 2. Installation and access

### Requirements

| Component | Requirement |
|---|---|
| Home Assistant | 2024.6.0 or newer |
| Installation | Any installation that supports custom integrations |
| Browser | Web Components, SVG and Pointer Events |
| Editing permission | Administrators by default |

### HACS

1. Add `https://github.com/Matysh/houseplan-card` to HACS as a custom
   **Integration** repository.
2. Install House Plan and restart Home Assistant.
3. Open **Settings → Devices & services → Add integration → House Plan**.
4. Keep “administrators only” enabled unless other users must edit the plan.

The integration registers its Lovelace resource. With YAML-managed resources,
add:

```yaml
resources:
  - url: /houseplan_files/houseplan-card.js
    type: module
```

Do not use `/custom_components/houseplan/frontend/houseplan-card.js`; it is an
on-disk path, not the JavaScript URL served by Home Assistant.

### Manual installation

Copy the release folder to `config/custom_components/houseplan`, restart Home
Assistant, add the integration, then add the resource above only if Lovelace
resources are YAML-managed.

### Permissions

Every signed-in user can view the plan. Home Assistant permissions still govern
device service calls. With the default integration option, only administrators
can edit configuration or upload files. Plan optimization and its undo always
require an administrator.

## 3. Adding a card

Minimal configuration:

```yaml
type: custom:houseplan-card
title: House plan
```

| Field | Default | Purpose |
|---|---:|---|
| `title` | empty | Card title |
| `default_floor` | first/last opened | Initial/fallback space for an unpinned card |
| `floor` | not pinned | Keep this card on one stable space ID or zero-based YAML index |
| `language` | HA language | `auto`, `ru` or `en` |
| `icon_size` | `2.5` | Base marker size, 1–6% of plan width |
| `show_temperature` | `true` | Compact temperature and humidity values |
| `live_states` | `true` | Work/open/unavailable presentation and activity; alarms remain visible |
| `show_signal` | `true` | Base LQI display, overridable by a space |
| `kiosk` | `false` | Full plan without editors or header |
| `cycle` | `0` | Kiosk auto-cycle interval in seconds; `0` disables it |

The legacy card-level `tap_action` is ignored. Each marker owns its action.

<!-- docs-section: first-run -->

## 4. Quick start

Use this order for a first working room:

1. Add a space with **+**, or import Home Assistant floors.
2. Upload SVG/PNG/JPG/WebP, reuse an uploaded plan, or choose no image.
3. Set the real size of a grid cell. It controls wall, opening, furniture and
   area measurements.
4. In Plan choose **Walls**, draw the boundary, then click its first point to
   close the first room face.
5. Name the room and bind it to an HA area, or use **No area**.
6. Add wall thickness and openings if needed.
7. In Device, position auto-discovered markers and choose their actions.
8. In Background, align the plan image and add labels, lines or furniture.
9. Return to View and confirm live values and actions.

![Creating the first space with synthetic data](images/03-space-create.png)

![Closing a new wall chain on its first point](images/04-room-contour-close.png)

Do all plan creation on desktop. Phone, tablet and wall-panel View remain full
product surfaces after setup.

<!-- docs-section: modes -->

## 5. Interface modes

View is the state with no editor open. Close the active editor to return to it.

| Mode | Devices | Geometry | Background/openings |
|---|---|---|---|
| View | Live and actionable | Read-only; room hover shows summary | Visible according to space settings |
| Plan | Hidden | Rooms, walls, columns and openings editable | Openings always visible |
| Device | Draggable; click opens settings | Read-only background | Read-only background |
| Background | Dimmed and inert | Dimmed | Background objects editable |
| Kiosk | Actionable as in View | Read-only | Read-only; no editors |
| Static card | Not live or interactive | Render only | Render only |

Each editor has a stable primary toolbar. Tool parameters and selected-object
actions appear in a context tray over the top of the canvas. On a narrow screen
the tray scrolls horizontally instead of shrinking the plan.

Where an editor offers a color sample, one click opens the House Plan color
picker. Hue, saturation, brightness, an exact HEX value and opacity (when the
setting supports it) are available together; there is no second browser color
dialog. The Hue track shows the full colour spectrum at a glance, with a
contrasting ring keeping its slider visible. Changes remain a draft until the
owning properties dialog is saved.

This is the same control everywhere: decor and custom fills, the global
light/temperature/LQI/Glow/wall palettes, global and per-space backgrounds,
room colour, marker Glow and the device activity ripple. Settings that already
have opacity show it in the picker; colour-only settings do not acquire one.
**Default** and **Inherited** background actions remain beside the colour
sample and do not save the displayed fallback unless a colour is changed.

<!-- docs-section: input -->

## 6. Navigation, zoom and input

The canvas grows with actual content. **Fit all** frames rooms and any distant
objects; each space keeps its local View viewport.

| Scenario | Mouse | Touch View | Touch editors | Keyboard |
|---|---|---|---|---|
| Zoom and pan | Wheel; drag empty space; `−`/`+` | Pinch; drag; double-tap resets kiosk | Available but precision is not guaranteed | — |
| Change space | Click a tab | Tap; kiosk swipe at 1:1 | Tap a tab | — |
| Device | Click/double-click per mode | Tap; safe actions equal desktop | Drag/properties are best effort | `Esc` closes the top surface |
| Draw or precise drag | Full contract | Not applicable | Best effort; use desktop for Resize and exact nodes | `Shift` changes magnet/angle; `Esc` cancels the operation |
| Editor history | Undo/Redo controls | Not applicable | Controls may work; no gesture guarantee | `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, `Ctrl+Y` |
| Kiosk sizing | — | Hold empty space for 3 seconds | — | — |

At zoom above 1:1 a horizontal kiosk gesture pans instead of changing space.
Any manual kiosk operation pauses auto-cycle for 60 seconds.

### Cancel and undo

- `Esc` cancels an unfinished path, current drag/resize/rotation, or the top
  dialog without undoing an already committed action.
- `Ctrl/Cmd+Z` undoes an editor command; redo is `Ctrl/Cmd+Shift+Z` or `Ctrl+Y`.
- Undo/Redo stores up to 50 named commands for Plan and Background.

<!-- docs-section: spaces -->

## 7. Spaces

A space may represent a floor, garden, garage or separate structure. It stores
its image, grid scale, geometry, Background layer and display overrides.

### Plan source

- upload SVG, PNG, JPG or WebP;
- select a previously uploaded plan;
- choose no image and draw the geometry by hand.

The plan image keeps its proportions initially. Background can later move,
scale or rotate it. Detaching a plan never deletes its server file; deletion
requires an explicit user action.

### Tab order

Space tabs follow the order in which the spaces were created, and that order can
be changed: in any editor mode, grab a tab with the mouse and drag it to a new
position. The new order is saved immediately and applies everywhere — the tabs,
the kiosk swipe between floors and the carousel arrows.

Dragging works **with a mouse and in the editors only**. In ordinary View and on
touch screens a tab still does one thing: it switches the space. There it is the
primary way to navigate, and a gesture must not compete with a plain tap. Order
is changed on a computer, like the rest of the plan work.

If a card anywhere pins its floor **by number** (`floor: 0`), remember that the
number means a position: after a reorder such a card shows a different floor.
The card warns about this once. Pin the floor by space id instead of a number to
avoid it entirely.

### Display settings

A space can show/hide room borders, names, LQI, Background and openings. It can
override fill mode, Glow, day-cycle background, north, sun rays, room-card font
scale and which room metrics are visible.

Room cards are positioned and scaled on the plan. View renders only the metrics
enabled for that space.

![Room card with temperature, LQI and light state](images/08-room-card.png)

<!-- docs-section: plan-tools -->

## 8. Rooms and walls

### Create a room

Select **Walls** and draw one continuous chain. Every completed segment is
crash-safe. Changing tool, editor or floor finishes an open chain as ordinary
independent walls. When the latest segment creates bounded endpoint/T/X faces,
House Plan offers them from smallest to largest. Save creates that room, Keep
as walls rejects only that candidate, and Cancel restores the whole draft with
no partial rooms.

Existing segment endpoints and lines appear above walls while drawing. An
endpoint grows when the next click will join it. A point on a line shows where
the click will create a valid junction.

### Plan tools at a glance

| Tool | Result | Room area | Light and shadow | Main limit |
|---|---|---|---|---|
| Walls | Continuous wall chain; offers rooms when it closes faces and finishes open chains as independent walls | Only a confirmed room has area | Physical segments block light; openings pass it | Partial room overlap is rejected; there is no separate Partition drawing tool |
| Column | Square or circular support | Does not change area | Blocks light inside its shape | One shape/size/rotation; not a wall or room |
| Boundary | Virtual span of a shared wall | Geometry and area stay unchanged | Light passes; no physical wall is painted | Only a shared boundary between adjacent rooms |
| Opening | Door, window or gate | Does not change area | Door/gate passage follows state; window may cast sun | Must fit completely on a suitable wall segment |

Other operations edit existing geometry:

| Operation | Result |
|---|---|
| Merge | Joins adjacent rooms; a dialog chooses the surviving identity, name and area |
| Split | Cuts a room from one wall to another; the larger part keeps the original room |
| Resize | Moves a wall with shared geometry or scales a room by corner handles. Live labels report **inner** dimensions — the clear distance between wall faces, the number a tape measure gives — and the room area |
| Thickness | Changes one physical span or every wall of a room |
| Delete room | Deletes only the selected room after confirmation |

![Selected partition and its Plan context tray](images/05-plan-context-tray.png)

Wall thickness is stored in real units. A room may have different thicknesses
on different spans. Open wall branches and T-junctions are allowed; shared
geometry remains joined without painted end caps.

### HA area binding

One HA area may be bound to one room. The binding drives automatic device
placement, room LQI, light and aggregate climate. A room without an area may
still contain manually assigned devices and explicit measurement sources.

## 9. Doors, windows, gates and locks

Choose Opening, select door/window/open passage/gate, and click a wall. Defaults
are 90 cm, 120 cm, 90 cm and 300 cm. The complete opening must fit on the wall.
Before the click, door, window and gate show their translucent architectural
symbol. An open passage instead shows the exact future wall cut as a translucent
wall-coloured segment with an orange boundary mark at each end. Its depth follows
the real wall thickness; after saving it has no standalone symbol.

The placement preview also draws a thin dimension line from each jamb to the
physical inner end of the wall. On a wall shared by two rooms, four values are
shown — two along each room's inner face — because their usable boundaries can
differ. On a finished independent wall, each value stops at the nearest
physical face of a connected wall; where no such face exists, it keeps the
distance to the independent wall's own endpoint. These richer dimensions apply
only before a new opening is placed; dragging an existing opening retains its
two established end-distance badges.

On a finished independent wall, a new or directly edited opening must leave a
jamb at each endpoint equal to at least half that wall's real thickness. The
same limit applies to placement, drag, rebind and length edits. Existing
near-end openings remain visible and are not moved until their geometry is
edited.

An opening may bind a contact; doors and gates may also bind a lock. View paints
the moving leaf and state. A lock badge is green when locked and red when
unlocked. A plan tap never toggles a lock. The opening
card provides a labelled
lock/unlock control, with confirmation before unlocking.

Openings may slide along joined wall corners. A double click in Plan opens
properties. Thick walls keep visible jambs and align the symbol to the correct
face.

<!-- docs-section: devices -->

## 10. Devices

House Plan reads Home Assistant device, entity and area registries. A device in
a bound HA area receives an automatic marker. Service-only records, bridges and
other non-spatial records are filtered; a light group may replace its members.
Newly discovered devices get a red dot until first opened in Device.

### Bindings

| Binding | Use |
|---|---|
| HA device | Uses its related entities and resolves a primary function |
| HA entity | Exact entity binding after enabling “Show entities” |
| Virtual device | Label/icon/description only, with no live active state |

The same binding cannot be used by two markers.

When an exact HA entity belongs to a device, placing that entity gives its
channel to the entity marker. The automatic parent marker, if needed, contains
only the remaining active, HA-visible and unplaced entities; it disappears
when that residual is empty. HA-hidden siblings alone do not keep an automatic
parent on the plan. To show both the exact entity and the complete device,
place `entity:X` and `device:D` explicitly — two explicit markers are treated
as an intentional configuration. Deleting an entity marker returns the entity
to automatic parent discovery; its binding tombstone does not remove registry
data from the live HA device.

### Device editor

- drag a marker to save its server-side position;
- click it to edit name, binding, room, tap action and presentation;
- **Add** creates a virtual marker or picks a binding manually;
- **Hidden and disabled** reveals user-hidden and HA-disabled records only in
  the editor;
- **Icon rules** edits the first-match regular-expression list.

The dialog shows binding provenance, exact next tap result, skipped targets and
a live presentation preview. A saved missing source is shown as missing rather
than silently replaced.

![Device editor with binding provenance and the exact action result](images/06-device-editor.png)

![Live preview of the selected device presentation](images/06-device-display-preview.png)

Hidden markers keep configuration and may still contribute to area aggregates.
An HA-disabled binding is excluded from rendering, state, actions, light and
aggregates until the same ID becomes active again.

## 11. Tap actions

| Gesture | View | Device editor |
|---|---|---|
| Short click/tap | Configured action | Open marker settings |
| Hold 600 ms | House Plan device card | No device control |
| Right click | Native HA more-info for the primary entity | Browser/editor context |

| Action | Behaviour | Safety |
|---|---|---|
| Device card | House Plan card with entities, model, description, links and files | No state change |
| HA more-info | Native dialog for the exact primary entity | No state change |
| Toggle state | Toggles the exact binding, supported device function or configured light-source group | Locks, alarm panels and protective garage/door/gate targets are no-op; confirmation is optional |
| Run | Runs an automation, script or scene | Explicit target; confirmation is optional |

When confirmation is enabled for **Toggle state**, the dialog shows the current
state and the exact expected result (`On`, `Off`, `Open`, `Closed` or `Stopped`).
A group shows the active/total count and lists unavailable targets separately;
the result describes only the targets that will receive the command. The text
is a snapshot, but Confirm re-resolves the live state and direction. If the
target set changed while the dialog was open, House Plan cancels the action and
asks you to try again.

A light defaults to Toggle; other devices default to the House Plan card. An
unsupported Toggle remains a visible no-op and is never changed into another
action behind the user's back.

When a device-bound marker has two or more own `light.*`/`switch.*` entities,
**Entity to toggle** appears below Toggle. It selects the exact own channel and
updates the target hint before Save. **Automatic** keeps the previous binding /
functional-role rules. A missing saved entity stays configured, shows a
warning and temporarily falls back; returning the same entity restores the
choice. This setting is independent from **Leading light entity**. With an
explicit external controls group, an explicitly selected own entity joins the
group; without a selection existing groups remain external-only.

![House Plan device card with state and safe actions](images/09-device-info.png)

<!-- docs-section: visual-states -->

## 12. Device visual states

Presentation uses one shared outer shell around three independent layers:
stable core, icon or value, and optional activity pulse. Visual priority is
**alarm → keyboard focus → selected → hover → semantic state → neutral**.

| State | Meaning | Examples |
|---|---|---|
| Red alarm | Critical condition, even with live states disabled | Smoke, gas, CO, leak, tamper/problem/safety, triggered alarm |
| Yellow | Device is doing its main job | Light/switch/fan on, active climate, vacuum cleaning, known appliance work |
| Red lock | Lock is unsecured | Unlocked/open lock |
| Green lock | Lock is secured | Locked lock |
| Orange | Physically open | Door/window contact, opening valve |
| Faded | Data unavailable | All relevant entities unknown, unavailable or absent |
| Neutral | No alarm, work or open condition | Off, closed, idle, standby, docked |

For a composite appliance with a dedicated Power switch, Power=`on` alone
remains neutral. If Home Assistant also exposes a strict lifecycle entity such
as Status/Run state/Job state, active values (`start`, `running`, `washing`,
`rinse`, and similar work states) make the marker yellow; idle, paused and
terminal values remove it. Power=`off` or unavailable still fades the marker
even if the lifecycle value is stale. Mode, Program, Stage and remaining time
are not treated as independent proof of work, and an ordinary lone relay keeps
its existing yellow-on behaviour.

Activity may be a finite three-wave event, persistent presence, a travelling
transition, or persistent work. Continuous motion uses a 3.6 s cycle (green
presence, amber work, blue neutral transition), a short event lasts 3.3 s, and
the two-wave red alarm cycles in 2.4 s. Explicit saved pulse color/size remains
authoritative; the package size default is 1.5 diameters. `prefers-reduced-motion`
replaces ordinary motion with a compact colored indicator while the static red
alarm remains clear.

The four display choices are icon + state; icon + state + activity; value +
state; and always-static icon. A separate value badge can show an entity state,
useful attribute, average LQI or linked light state on any side of the marker.
Text and adjacent values are sections of the same shell. They shrink to a
readable floor and then expand the shell; they are never ellipsized.
The complete visible value capsule is one hover and action target: clicking or
tapping its value section runs exactly the same configured action and safety
checks as the icon core.

Virtual devices use the ordinary neutral/hover background with a dashed outer
circle. An HA-less virtual device does not invent unavailable or activity;
a linked virtual light may still follow its real controller. Unavailable keeps the ordinary
presentation with the standard icon opacity reduction, no visual hover and no
motion; its existing click/tap still opens information or settings. Marker LQI
uses the same continuous red-to-green scale as before the package update; the
room fill gradient and the displayed number are unchanged.

Interactive View/kiosk and Device-editor markers have at least a 44×44 CSS px
target. Enter and Space reuse the exact current click and confirmation path;
Plan, Background, preview and the read-only static card add no tab stop.

## 13. Room fills and light

Space fill modes include user colour, temperature comfort range and LQI. Room
settings may override the space. Glow is independent from the base fill.

A light source may come from automatic classification, an explicit Always
role, or a controlled source group. Walls, partitions and columns occlude Glow;
open passages transmit it. When a configured light source disappears or loses
its valid binding, its contribution is removed instead of keeping stale light.

Overlapping Glow pools add brightness and colour where browser SVG blending is
supported; otherwise House Plan uses a safe normal blend without changing the
saved setting.

<!-- docs-section: background -->

## 14. Background editor

The authoritative technical interaction contract is
[DECOR-EDITOR.md](DECOR-EDITOR.md).

| Tool | Create | Edit |
|---|---|---|
| Select | Select an item | Move, scale, rotate; double click properties; Delete/Backspace removes |
| Backdrop | Available when a plan image exists | Move, corner-scale, rotate; double click numeric size/angle |
| Line | Drag endpoints | Colour/opacity, physical thickness and solid/dashed style |
| Rectangle | Drag diagonal; Shift makes a square | Stroke plus independent fill, size and angle |
| Oval | Drag bounds; Shift makes a circle | Stroke plus independent fill, radii and angle |
| Text | Click to open dialog | Multiline text, HA tokens, colour, physical size and angle |
| Furniture | Pick symbol, then click | Symbol, size, colour, outline and wall magnet |
| Erase | Click an item | Confirmed deletion, undoable |

Creation and transform snap to the grid plus nearby room/background anchors.
The plan image is interactive only with Backdrop selected. Undo/Redo shares the
50-command editor history.

![Selected line in the Background editor](images/07-background-editor.png)

Live text accepts `{sensor.entity}` and
`{climate.entity:current_temperature}` tokens. Missing, unavailable or complex
object values render as `—`; long values are shortened.

## 15. Sun background and window rays

These are independent features. **Follow the sun** changes the background from
day through golden hour to night and can fall back to browser time. Window rays
require `sun.sun`, a configured north direction and suitable exterior windows.
Weather cloud cover may reduce ray intensity.

For window rays, point the compass N arrow toward the place where true north
actually lies on the drawing. The value is the literal clockwise direction
from canvas-up to north, not an opposite correction for a rotated plan. If you
previously mirrored the compass to compensate for the old ray-direction bug,
return it to the real north after updating.

Rays remain visual only: they do not change Home Assistant state. Walls and
physical obstacles clip them; changing north or window geometry recalculates
the result.

## 16. Robot vacuums

The dock marker stays at its saved location while a live puck and path follow a
supported map source. Calibration maps source coordinates to plan coordinates.
Automatic room-name matching is a starting point; manual drag/stretch corrects
it. A diagnostic source picker reports missing or incompatible sources instead
of silently rebinding.

Multiple maps are represented as distinct sources/calibrations. A vacuum is
shown only in the space whose saved mapping currently matches the active map;
the dock remains in its configured space. See [VACUUM.md](VACUUM.md) for the
source dialect and calibration contract.

## 17. Kiosk

Set `kiosk: true` on a card in a Panel view. Editors and the ordinary header are
removed. Pinch/drag navigate, double-tap resets, and a 1:1 horizontal swipe
changes space. Holding empty space for three seconds opens per-display icon and
text sizing. `cycle` enables automatic space changes; interaction pauses it for
60 seconds.

## 18. Static space card

`custom:houseplan-space-card` renders one configured space without live states,
hover, drag, more-info or actions. A footer button opens the full plan. Use it
for compact dashboard navigation, not for home control.

```yaml
type: custom:houseplan-space-card
space: ground
```

## 19. Plan maintenance

Optimization compacts old off-grid geometry and unused layout records while
preserving rooms, bindings and supported settings. It does not delete plan
images or attachments merely because nothing currently references them.

Optimization creates one server-side undo point. Any later edit makes that undo
stale, so create a Home Assistant backup before a large maintenance operation.

<!-- docs-section: multiple-cards -->

## 20. Storage, multiple cards and backups

### Portable JSON backup

**Global settings → Backup and transfer** exports either the complete House
Plan model or the current space. Import first shows a server-side preview with
type, versions, object counts, source and content-link state; nothing is written
until confirmation.

A full import replaces the model and creates one undo point. A space import
assigns new internal IDs and adds the copy without replacing global settings.
Internal uploaded files are not embedded in JSON; an import to another HA
instance must explicitly detach those links.

For **Current space**, enable **Plan only** to transfer the architectural
template without devices or Home Assistant bindings. It keeps rooms, walls,
openings, decor, backdrop transforms and manually positioned room labels at
their chosen scale, but removes real and virtual markers, device positions,
Area assignments,
temperature/humidity sources and opening contacts/locks. Live values in text
labels become `—`; surrounding static text stays intact. The import preview
marks this file as plan-only and adds it through the normal space-import flow.

Plan-only is not full anonymisation: space and room names, static text, file
names, exact coordinates and external URLs remain in the JSON. Internal plan
files are still referenced rather than embedded and may need to be detached on
another Home Assistant instance.

### Storage locations

| Data | Location |
|---|---|
| Spaces, geometry, Background and marker settings | HA storage `houseplan.config` |
| Marker and room-card positions | HA storage `houseplan.layout` |
| Plan files | `config/houseplan/plans` |
| Marker attachments | `config/houseplan/files` |
| Vacuum path | Separate House Plan HA storage |
| Cache, viewport and kiosk scale | That browser's `localStorage` |

### Several cards and clients

Use `floor` when separate card instances must stay on separate spaces. A stable
space ID is recommended:

```yaml
type: custom:houseplan-card
floor: ground
kiosk: true
cycle: 0
```

YAML also accepts an unquoted zero-based numeric index such as `floor: 1`.
Indexes follow the current server space order, so reordering spaces may change
which one is shown. A quoted value such as `floor: "1"` is a literal space ID.

A pinned card shows only its assigned space. It ignores the browser's shared
last-space record, `#space=` links, other floor tabs, swipe and kiosk cycling,
and it does not overwrite the shared last-space record. If the configured ID
or index is invalid, the card shows a configuration error instead of choosing
another space. Remove `floor` to restore normal navigation.

Unpinned `custom:houseplan-card` instances may still use different
`default_floor` values. That option is only the initial/fallback choice; the
last selected space, a valid `#space=` link or normal navigation may replace it.

- configuration, rooms, Background and device layout are shared server data;
- `floor` is a permanent per-card navigation authority, while `default_floor`
  is only an initial/fallback choice for an unpinned card;
- current mode, selected space, zoom/pan and kiosk sizing are local;
- WebSocket broadcasts saved changes and revision checks reject a stale write;
- avoid editing the same object in two browsers: the second save may need a
  refresh and manual reapplication.

### Files and quotas

Plan files accept SVG/PNG/JPG/WebP up to 8 MB, with a 200-file/256-MB total.
Marker attachments accept PDF/PNG/JPG/WebP/TXT up to 50 MB, with a
1000-file/1-GB total and 50 links per marker. Writes are also refused below
512 MB free disk space. Detached files remain until explicitly deleted.

<!-- docs-section: limits -->

## 21. Current limitations

| Limitation | Practical effect |
|---|---|
| Rooms must be closed | An open path is walls, not a room with area |
| One HA area per room | To split one HA area visually, assign devices manually |
| Boundary requires adjacent rooms | It cannot open an exterior wall or branch from empty space |
| Editors are desktop-first | Touch editing may be awkward, limited or absent |
| Room details use hover in View | A touch-only user may need an editor or another visible metric |
| Sun has no exterior 3D model | It cannot know shadows from trees, awnings or neighbouring structures |
| Icon rules use regular expressions | First matching rule wins and invalid expressions are rejected |

Storage guards allow up to 50 spaces, 400 rooms per space, 2,000 markers, 500
openings, 1,000 Background items, 500 wall records and 500 virtual spans per
space. The configuration package is limited to 2 MB.

<!-- docs-section: diagnostics -->

## 22. Troubleshooting

### Card does not load

| Symptom | Check |
|---|---|
| `Custom element doesn't exist: houseplan-card` | Integration loaded; resource is `/houseplan_files/houseplan-card.js` with type `module`; hard-refresh |
| MIME `text/plain` | Replace `/custom_components/...` with `/houseplan_files/...` |
| Integration missing | Folder is exactly `custom_components/houseplan`; restart HA; inspect import errors |

### Devices or values are missing

- confirm the room's HA-area binding and the device/entity registry area;
- open Device → Hidden and disabled;
- verify the selected source still exists and is available;
- remember that a virtual marker has no active state;
- inspect the dialog's exact target and skipped-target explanation.

### Geometry looks wrong

- confirm grid cell size before judging physical dimensions;
- use Fit all to include distant objects;
- check wall thickness and whether a shared span is a virtual Boundary;
- use desktop for precise nodes, Split and Resize.

### Vacuum does not move

- confirm the active map source and map identity;
- check calibration anchors and current source availability;
- verify that the active map is assigned to this space;
- open source diagnostics instead of deleting/recreating the marker.

When reporting a problem, include House Plan version, HA version, browser,
console/server errors and reproducible steps. Replace private entity IDs and
plans with synthetic equivalents.
