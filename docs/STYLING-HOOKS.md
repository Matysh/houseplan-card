# Styling hooks — the selectors card-mod may rely on

Code: `src/houseplan-card.ts`
(`_renderDevice`, `_renderRoomLabel`, `_renderOpenings`, `_renderDecorLayer`,
the room shapes in `render()`, the space tabs in the header),
`src/space-render.ts` (the static `houseplan-space-card`).
Smoke: `demo/smoke_styling_hooks.mjs`.

This document is a **contract**, not a feature. It names the handful of
attributes and classes that the card promises not to rename, so that a user
who has already installed [card-mod](https://github.com/thomasloven/lovelace-card-mod)
can write a rule against the plan and keep it working across our releases.

---

## §1 The philosophy — we do not sell CSS

The card has no "custom CSS" field, no theme editor, no style templates, and
this document does not introduce any. **We are not building a styling layer,
and we do not support user CSS.**

What we are doing is narrower and cheaper: we stop *getting in the way* of a
user who already runs card-mod. Their CSS pierces our shadow root on its own;
all they were missing was something stable to aim at. Until now the plan had
meaningful class names but almost no identifiers — five `data-` attributes in
the whole source, every one of them an internal implementation detail
(`data-corner` on a drag handle, `data-mid` on a vacuum trail). A rule like
"make the icon of *this* sensor bigger" had to be written against
`:nth-child(7)` and broke the next time a device was added.

The distinction from **ha-floorplan** matters and is deliberate. There, CSS
is a *required part of the product*: you configure the floorplan by writing
stylesheets and templates, so every user is a stylesheet author and every
release is a chance to break one. That is where their 138-post
"my styles no longer apply" thread comes from. Here, the plan is configured
by clicking, the card ships finished, and CSS is something a **power user**
may add **on their own responsibility** — the way a person may add a browser
userstyle to any web page.

Consequences, stated plainly:

- We promise the names in §3 and the test hooks in §7 are **stable**. If we ever have to change one, it
  is a breaking change and it goes in the changelog.
- We promise nothing about **anything not in §3** — internal classes, DOM
  nesting, element order, the presence of a wrapper `<div>`, the internals of
  Home Assistant's own components.
- We do not review, debug or support user CSS, and "card-mod rule stopped
  working" is not a bug report we can act on unless it names a §3 selector.
- We will not add hooks on request one by one. §3 covers the objects the plan
  *is* — devices, rooms, openings, decor, labels, floors. That is the whole
  model; there is nothing else on the plan to aim at.

---

## §2 The model — one attribute answers "what is this"

Every object the plan draws now carries the same identity:

| Attribute | Meaning |
| --- | --- |
| `data-hp` | **what kind of object** this is — the one attribute to branch on |
| `data-id` | the object's **own id** in the stored config, stable across restarts |
| `data-kind` | the sub-type, where a kind has one (`door`/`window`/`gate`, `line`/`rect`/…) |
| `data-entity` | the entity the object **presents**, where it presents one |
| `data-area` | the Home Assistant **area id**, where the object belongs to one |

`data-hp` is the anchor: `[data-hp="device"]` selects every device marker on
the plan and nothing else, regardless of which layer, mode or element type it
happens to be rendered as today. It is deliberately one attribute rather than
a class, so it can never collide with a state class (`.on`, `.sel`, `.ghost`)
and so `querySelectorAll('[data-hp]')` enumerates the whole contract.

**Absent is absent.** An attribute is *not rendered at all* when the object
has no such value: a virtual marker with no entity has no `data-entity`, a
room outside any HA area has no `data-area`, and a room drawn before ids
existed has no `data-id`. There is never a `data-area="undefined"` and never
an empty string — `[data-area]` means "this one has an area".

**Ids are the config's, not the DOM's.** `data-id` is the id stored in
`houseplan.config` (marker id, room id, opening id, decor shape id). It
survives reloads, re-mounts and re-orderings; it changes only when the object
is deleted and drawn again. A device that is auto-discovered and has no
marker of its own uses the same synthetic id the card uses for it internally.

---

## §3 The table — element → attributes → class

Everything in this table is **public API**.

| Object | Element | `data-hp` | Other attributes | Public class |
| --- | --- | --- | --- | --- |
| Device marker | `div` (HTML, marker layer) | `device` | `data-id` = marker/device id, `data-entity` = primary entity id, `data-area` = area id, `data-binding-status` = `active` \| `ha-disabled` \| `orphaned` \| `unverified`, `data-disabled-reason` = `device` \| `entity` \| `all-entities` when applicable | `.dev` |
| Room shape | `polygon` / `rect` / `path` (SVG) | `room` | `data-id` = room id, `data-area` = area id | `.room` |
| Room card (name + metrics) | `div` (HTML, marker layer) | `room-label` | `data-id` = room id, `data-area` | `.roomlabel` |
| Door / window / gate | `g` (SVG) | `opening` | `data-id` = opening id, `data-kind` = `door` \| `window` \| `gate` | `.opening` |
| Coloured tunnel inside a thick opening | `path` / `g` (SVG) | `opening-tunnel` | `data-id` = opening id, `data-kind` = `door` \| `window` \| `gate` | `.opening-tunnel` |
| Wall body (thickness) | `path` (SVG) | `wall` | `data-id` = segment key, `data-kind` = `shared` \| `outer` | `.wallbody` |
| Independent partition | `path` (SVG editor hit target) | `partition` | `data-id` = partition id, `data-kind` = `partition` | `.physical-hit` |
| Wall column | `path` / `circle` (SVG editor hit target) | `wall-column` | `data-id` = column id, `data-kind` = `square` \| `circle` | `.physical-hit` |
| Stair | `g` (SVG) | `stair` | `data-id` = stair id, `data-kind` = `straight` \| `spiral`, `data-target-state` = `active` \| `missing` \| `self` \| `deleted` \| `fixed` | `.hp-stair` |
| Decor shape | `line` / `rect` / `ellipse` / `text` (SVG) | `decor` | `data-id` = shape id, `data-kind` = `line` \| `rect` \| `ellipse` \| `text` | `.dshape` (`.dtext` on text); persisted colour/alpha are inline SVG attributes and therefore win over weak CSS selectors |
| Furniture | `path` (SVG) | `decor` | `data-id` = shape id, `data-kind` = `furniture`, `data-symbol` = the symbol id (`sofa`, `toilet`, …) | `.dshape .dfurn` |
| Floor / space tab | `button` (HTML, header) | `space-tab` | `data-id` = space id | `.tab` |

`data-symbol` is the furniture library's own vocabulary (docs/FURNITURE.md
§3): the ids in that table are public and stable, and new ones are only ever
added. It is what lets one rule colour a whole category:

```css
ha-card [data-kind="furniture"][data-symbol="bathtub"],
ha-card [data-kind="furniture"][data-symbol="toilet"] { stroke: #4fc3f7; }
```

### 3.1 Public classes inside a device marker

The marker's own children are part of the contract too — they are what a rule
usually wants:

| Class | What it is |
| --- | --- |
| `.dev` | the marker box itself |
| `.dev ha-icon` | the icon (a Home Assistant element — see §5) |
| `.valtext` | the value badge of a "value instead of icon" marker |
| `.tval` | the small temperature plate next to the icon |
| `.hval` | the small humidity plate |
| `.lqi` | the Zigbee signal badge |
| `.ripple` | the presence-ripple rings |
| `.newdot` | the "new device" dot |

Inside a room card: `.rlname` (the name) and `.rlmetrics` / `.rlm` (the
metric row and one metric in it).

**Breaking hook change in #203.** The former SVG fallback
`text.rlabel[data-hp="room-label"]` has been removed. A space with
`show_names: false` now emits no permanent room-label element at all, as the
setting promises. Target the HTML room-card hook
`[data-hp="room-label"].roomlabel` when room names are enabled. Plan editor
temporarily renders the same HTML card so it can still be positioned.

### 3.2 Public state classes

These are set on `.dev` and describe **live state**, so a rule may key off
them:

`.on`, `.off`, `.unavail`, `.alarm`, `.ghost` (hidden device shown in the
device editor), `.virtual` (a marker with no entity), `.valonly` (value
instead of icon), `.static-icon` (the always-static display mode), `.noicon`,
`.sel` (selected in an editor).

Unified device activity is exposed by one descendant `.device-pulse` with
exactly one kind class: `.alarm`, `.short` or `.continuous`. Semantic reason is
available as `.reason-alarm`, `.reason-event`, `.reason-presence`,
`.reason-transition` or `.reason-running`. Reduced-motion ordinary activity is
the compact `.activity-dot`; no static ring is emitted. The legacy
`.activity-ring` descendant class remains a beta compatibility alias only and
must not be used by new integrations.

The full plan and `houseplan-space-card` emit the same binding-status data
attributes. A forced-hidden HA-disabled marker is absent from ordinary View;
the attributes are visible on its service ghost in the Device editor.

On a room shape: `.filled` (a fill mode is painting it), `.styled`,
`.overlay` / `.yard` (drawn over a picture / on bare canvas).

A room shape keeps its transparency in `fill-opacity` / `stroke-opacity`,
never in the colour: every state is an opaque colour plus an opacity, and paint
that is off has the opacity `0` (#746). A rule that recolours a room therefore
sets the opacity together with `fill` / `stroke`. The values themselves are
generated (§3.3).

### 3.3 Explicitly NOT the contract

These exist in the DOM and **will** change without notice. Do not build on
them:

- **Boot and transition classes** — `.hpboot`, `.hpsettle`,
  `.mode-transition`, `.editorchrome.transitioning`, and the four-phase
  `.daycycle` / `.phase-*` environment classes. Their
  whole job is to be replaced.
- **Editor chrome and previews** — `.dtframe`, `.dthandle`, `.dtknob`,
  `.dtbox`, `.dtstem`, `.bdhandle`, `.rszhandle`, `.rszicon`, `.rszframe`,
  `.ddraft`, `.vacfithandle`, the align guides, the markup layer (apart from
  the physical-object identity attributes explicitly listed in §3),
  `data-corner`, `data-mid`. These are the drawing tools' own furniture; they
  are redesigned whenever an editor is.
- **Layout wrappers** — `.stage`, `.zoomwrap`, `.devlayer`, `.decorlayer`,
  `.measurelayer` and their nesting. The layers are how we composite; they
  are not where the objects live.
- **Dialog classes and nesting** — `.dialog`, `.menuwrap`, `.entrow`,
  `.inforow` and friends. Dialog markup follows the dialog's design, and the
  design changes. Only the sparse semantic test hooks in §7 are stable.
- **Everything generated** — CSS custom properties starting with `--hp-`,
  `--room-*`, `--dev-*`, `--ripple-*`, `--rl-*` are set inline by the
  renderer. Reading them is fine; overriding them may fight the renderer,
  which writes them again on the next `hass`.

---

## §4 Examples

Real card-mod configuration, on the card that carries the plan. (card-mod is
a separate community integration — install it first; we do not ship it.)

**Hide every Zigbee signal badge.**

```yaml
type: custom:houseplan-card
card_mod:
  style: |
    ha-card [data-hp="device"] .lqi { display: none; }
```

**Make one specific marker twice the size** — the front door lock, named by
its entity, so it keeps working after the device is renamed or moved:

```yaml
card_mod:
  style: |
    ha-card [data-hp="device"][data-entity="lock.front_door"] {
      --dev-scale: 2;
      z-index: 5;
    }
```

**Recolour the room captions of one floor**, and make the kitchen's stand
out — by area, which is the name Home Assistant knows it by:

```yaml
card_mod:
  style: |
    ha-card [data-hp="room-label"] { font-weight: 700; letter-spacing: .02em; }
    ha-card [data-hp="room-label"][data-area="kitchen"] { color: #c62828; }
```

**Dim every window, keep the doors bright** — openings by kind:

```yaml
card_mod:
  style: |
    ha-card [data-hp="opening"][data-kind="window"] { opacity: .45; }
```

The supported Solid / Dashed choice for a decor line lives in its properties
dialog. For a custom dash pattern beyond those two product styles, card-mod can
still target one line by its shape id from the config:

```yaml
card_mod:
  style: |
    ha-card [data-hp="decor"][data-kind="line"][data-id="dc_17"] {
      stroke-dasharray: 12 8;
    }
```

> **Disclaimer.** card-mod is not ours: we do not ship it, do not support it,
> and do not answer for what your CSS does to the card. The examples above are
> illustrations of the selectors, not supported configuration. If a rule
> misbehaves, remove it first and then decide whether there is a card bug
> underneath.

---

## §5 Limits — where a selector cannot reach

**The card's own shadow root is fine.** Everything in §3 is rendered by the
card into its single Lit shadow root, including all dialogs and menus — we
never portal a dialog to `document.body`. card-mod's shadow piercing reaches
all of it.

**Home Assistant's own elements are not.** `ha-icon`, `ha-switch`,
`ha-slider`, `ha-card` are separate custom elements with shadow roots of
their own, and a descendant selector stops at their boundary. You can style
the **host** — `.dev ha-icon { color: … ; transform: … }` works, because the
icon inherits `color` and the host takes the transform — but you cannot reach
the `<svg>` inside `ha-icon`. That is a browser rule, not our choice, and it
is why we put the hooks on *our* wrappers rather than expecting a rule to
target the icon element itself.

**`houseplan-space-card` is a different card.** The read-only space card is
its own custom element with its own shadow root, so it needs its own card-mod
block. It carries the same `data-hp` attributes for the objects it draws:
rooms, room labels, device markers, openings (`data-hp="opening"` with
`data-id`/`data-kind`, class `.static-opening`) and decor images
(`data-hp="decor"`, class `.dimage`). Vector decor shapes and furniture are not
drawn there, so their hooks simply are not there.

**The kiosk header is visually absent.** The full header is hidden by CSS in
kiosk mode, but most of its existing children remain in the DOM. A selector
can therefore still match hidden `space-tab` and zoom elements. Actions which
the renderer already omits, such as `space-add`, remain absent; test code must
not confuse a DOM match with visibility or permission.

**One rule, both modes.** Editors add classes to the same elements rather than
re-rendering different ones, so a rule written against the View mode also
applies while the user is editing. If that is not wanted, scope it: the stage
carries `mode-view` / `mode-plan` / `mode-devices` / `mode-decor`, and those
four names are part of the contract for exactly this purpose.

---

## §6 Values are formatted by Home Assistant

A styling contract is about *how* a value looks; this section is about *what*
the value is, because the two questions arrive together — "why does my sensor
show `22.4` here and `22,4 °C` everywhere else in HA".

Wherever the card prints **one entity's state or attribute**, it now asks
Home Assistant to format it: `hass.formatEntityState(stateObj)` for a state,
`hass.formatEntityAttributeValue(stateObj, attr)` for an attribute. That is
the same call HA's own more-info and entities card make, so the number obeys
the entity's `display_precision`, the user's decimal separator, and the state
translations (`on` → *Включено*). One wrapper owns it — `hassValue()` in
`src/logic.ts` — and every printing site goes through it:

| Where | What it prints |
| --- | --- |
| Value badge (`display: value`) | the acting entity's state |
| Decor live text (docs/DECOR-EDITOR.md §5) | the linked entity's state or attribute |
| Device info card | the primary state and every listed entity |

**Fallbacks are silent.** An older Home Assistant without
`formatEntityState` gets exactly today's behaviour — the raw state, with the
entity's `unit_of_measurement` appended by us. The same is true of
`formatEntityAttributeValue`, which is newer still. Nothing throws, nothing
is blank; the wrapper reports which path it took so the caller knows whether
a unit is already in the string.

**The unit appears exactly once.** HA's formatter normally appends the
entity's own unit itself — so blindly adding ours would double it, and blindly
trusting it would drop the unit wherever it does not. One rule survives both:
strip the entity's own `unit_of_measurement` if it is already the tail (exact
trailing match, nothing else in the text is touched), then append the unit
that is actually wanted — the user's explicit one on a decor label, the
entity's own otherwise. A value with no unit at all — a translated state
(«Включено») — never grows a suffix. `valueWithUnit()` in `src/logic.ts`.

**The °/% plates keep their own form.** The small temperature and humidity
plates next to an icon (`.tval`, `.hval`), the same numbers in a room card
(`.rlm`) and in the tooltip are **not** an entity state readout: they are a
derived reading — an average over every sensor of the area, or a climate
device's `current_temperature` attribute — rendered as a fixed compact glyph
(`21.5°`, `48%`) so a plan full of them reads as one instrument panel. There
is no single entity whose `display_precision` applies to an average, and a
formatter would put `°C` into a badge the size of a fingernail. They stay
ours, deliberately (owner's call, 2026-08-05).

---

## §7 Test hooks — stable selectors for external E2E

The object hooks in §3 are also suitable for tests, but a real Home Assistant
browser test needs a few controls and state boundaries which are not objects on
the plan. Those selectors are declared here. They are deliberately sparse:
their purpose is to let a test express user intent without reading private
fields or depending on layout classes.

The machine-readable authority is
[`data-hp-contract.json`](data-hp-contract.json). It records each value, the
element types on which it can occur, its first version and whether its audience
is styling, testing or both. An external test suite should validate its
selectors against that file before driving the UI.

### 7.1 Compatibility promise

- A public `data-hp` value, `data-hp-state`/`data-hp-mode` value, documented
  `data-kind`, or documented `data-tool` is not renamed or removed silently.
- A necessary incompatible change is announced in both changelogs and keeps a
  compatible transition for one following **stable** release.
- Adding a new value is compatible and does not change `schemaVersion`.
- The JSON `schemaVersion` changes only when the JSON structure itself becomes
  incompatible.
- Presence follows the product. If permission, mode or state means that an
  existing control is not rendered, its hook is absent too. No hidden testing
  duplicate is created.
- These attributes do not grant permission and are not product logic. Removing
  one in DevTools or card-mod must not change how the card behaves.

### 7.2 Root state

On every rendered `houseplan-card` root `ha-card`:

| Attribute | Values | Meaning |
| --- | --- | --- |
| `data-hp-state` | `booting` \| `ready` | The existing visual boot barrier is active, or the card has crossed it. An empty configured plan can be ready. |
| `data-hp-mode` | `view` \| `plan` \| `devices` \| `decor` | The current public mode. `devices` intentionally matches the existing `mode-devices` and `data-editor-navigation="devices"` contracts. |

The compact `houseplan-space-card` has its own lifecycle and does not expose
these full-card attributes.

### 7.3 Header and empty state

| Selector | Existing element |
| --- | --- |
| `[data-hp="settings"]` | General settings button |
| `[data-hp="pdf"]` | PDF export button |
| `[data-hp="support"]` | Help and feedback button |
| `[data-hp="zoom-in"]`, `[data-hp="zoom-out"]`, `[data-hp="zoom-fit"]` | Existing camera buttons |
| `[data-hp="space-add"]` | Add-space button, when permitted |
| `[data-hp="space-settings"][data-id="…"]` | Settings gear for one space |
| `[data-hp="empty"]` | Existing empty, fixed-floor loading or fixed-floor error surface |
| `[data-hp="create-space"]` | First-space action, only for a user already allowed to see it |
| `[data-hp="import-backup"]` | Empty-screen JSON backup action, writer-only and not in House Plan kiosk |
| `[data-hp="toast"][data-kind="message"]` | Current transient message |

Zoom controls remain in the DOM inside the CSS-hidden kiosk header, exactly as
before. `space-add` keeps its stricter existing rule and is not rendered in
kiosk mode.

### 7.3a Phone header menu (#616)

At a window width of 480 px or less the header is one row: space tabs, zoom
and a gear `[data-hp="header-menu"]` (44 × 44, `aria-haspopup`,
`aria-expanded`). Everything the row drops — editor tabs, space settings, add
space, general settings, PDF, help and the summary-panel pair (the projection
item is gone since #649) — is a `[data-hp="header-menu-item"][data-id="…"]` button of
its menu (`#hp-header-menu`, `role="group"`), each at least 44 px high; the
vocabulary of `data-id` is in the JSON inventory. While the menu is open a
transparent `[data-hp="header-menu-scrim"]` swallows the tap that dismisses it.
Above 480 px the gear is in the DOM but hidden, and the ordinary buttons are
unchanged. Kiosk renders neither.

### 7.4 Editors

Each active editor exposes one primary
`[data-hp="toolbar"][data-kind="plan|device|decor"]`. Tool and command launchers
use `[data-hp="tool"][data-tool="…"]`; the complete `data-tool` vocabulary is
in the JSON inventory. The toolbar X and the header X (its own slot after the mode tabs, #647) use
`[data-hp="editor-close"]` while retaining `data-editor-navigation="view"`.

The three editor mode tabs are `[data-hp="mode-tab"][data-mode="plan|devices|decor"]`
(#629) and keep `data-editor-navigation`. Like the tabs themselves, the hook is
present only for a user allowed to edit. Nothing in the card's styles selects
it; its audience is `test`.

The one visible secondary/context surface uses `[data-hp="tray"]`. Its
`data-kind` is the stable launcher id when a grouped launcher owns it and the
broad secondary kind otherwise. A closed placeholder does not carry the hook.

Undo/Redo, colour pickers and Save/Cancel controls inside a tray are not tools
and are not assigned `data-tool`.

### 7.5 Dialogs

Every `hp-dialog` host is `[data-hp="dialog"][data-kind="…"]`. `data-kind` is a
broad user workflow rather than a private method name; the complete initial
vocabulary is in the JSON inventory. A workflow may reuse the same kind across
several steps.

An existing principal action which accepts the current dialog result uses
`[data-hp="dialog-confirm"]`. An existing Cancel/Close action which dismisses
without accepting uses `[data-hp="dialog-cancel"]`. Alternate accepted outcomes
may produce more than one confirm button. A step which has no such visible
button does not gain a synthetic one. The native fallback X is a cancel hook;
Home Assistant's own close control stays inside HA's private shadow root.

### 7.6 Sidebar panel

Inside `houseplan-panel`'s own shadow root, `[data-hp="panel-menu"]` opens the HA
menu and `[data-hp="panel-title"]` identifies the visible House Plan title.
The rest of the panel shell remains private.

### 7.7 Internal diagnostics are not public API

The repository also uses `data-hp` for screenshot and diagnostic probes. The
JSON `internalPrefixes` and `internalExactValues` fields allow the source gate
to distinguish them from omissions, but do **not** make them stable. Current
families include `iso-*`, `zigbee-topology-*`, `resize-*`, `plan-snap-*` and
`hidden-wall-*`. Do not use them from card-mod or an external E2E repository.

`room-draft` is listed separately as retired metadata: #478 removed the object
type itself by making every unfinished chain ordinary partitions. There is no
current DOM state in which that legacy hook can appear; new tests use
`partition`.

### 7.8 E2E scene and form identities (#1011)

The additional hooks below have audience `test` and `since: 1.83.0`. They add
attributes to existing elements, without changing layout, actions, permission
gates or saved data. Their complete elements/enums/identity metadata live in
`data-hp-contract.json`. Existing hooks and internal prefixes remain intact.

| Selector | Identity and meaning |
|---|---|
| `stage[data-grid-step]` | Actual plan SVG, its current viewBox/CTM and base snap pitch in SVG units; grid origin is (0,0). Use Flat projection for floor-coordinate clicks. |
| `wall-node-layer[data-state]`, `wall-node[data-node]` | Existing node layer state and interactive node key; not the decorative outer circle. |
| `room-resize[data-room][data-edge]` | Interactive hit circle, room id and current polygon edge index. Read its existing `aria-disabled`. |
| `device[data-selected]` | Existing editor selection, as `true`/`false`. |
| `device[data-hp-device-contact]` | Contact contour present, including contact with a wall. This alone does not establish a device group. |
| `device[data-hp-device-component]`, `device-contact-contour[data-component][data-grouped]` | Group owner marker id on all members and the owner's existing contour; `data-grouped=true` means at least two devices. |
| `device-history[data-action]` | Position undo/redo, preserving the old history attribute. |
| `device-catalog-row[data-id]`, `device-catalog-select[data-id]`, `device-catalog-select-all` | HA inbox row key or virtual marker id, and actual selection checkboxes. |
| `vacuum-trail`, `vacuum-trail-segment[data-entity][data-kind]`, `vacuum-puck[data-entity]` | Shared trail SVG, each current/previous/tip result's vacuum entity and the visible robot puck. Container presence alone does not identify one vacuum. |
| `vacuum-calibration`, `vacuum-calibration-action[data-action]`, `vacuum-calibration-step[data-step]` | Existing manual fit bar, rotate/mirror/save/cancel and existing manual overlay. No wizard steps are invented. |
| `backdrop`, `decor[data-kind][data-id]` | Existing backdrop image and every rendered decor branch, including passive image/furniture paths and erase hit shapes. Several SVG elements may identify one object. |
| `furniture-category[data-id]`, `furniture-item[data-id]` | Existing canonical category and symbol buttons. |
| `image-upload[data-kind]` | Existing backdrop/decor file input; attachment PDFs are not image uploads. |
| `glow-layer`, `glow-pool[data-entity]` | Existing glow layer and source entity. A pool can remain through its existing fade-out; wait for settle before asserting absence. This is DOM presence, not pixel quality. |
| `summary-panel`, `summary-settings`, `summary-toggle`, `summary-metric[data-id]` | Existing panel, desktop/kiosk controls and configured value id. Phone controls retain `header-menu-item`. |
| `space-tab[data-space]`, `space-delete` | Space id (old `data-id` retained) and the existing deletion action/confirmation. |
| `toast[data-id]` | Known i18n key, or `message` for composed/unkeyed text; no reverse lookup by translated text. Ownership/routing retains the key, replacement updates it. |
| `settings-section[data-kind][data-section]` | Desktop settings navigation; mobile select uses `field[data-field="settings-section"]`. Hidden panes remain mounted. |
| `field[data-field]`, `field-option[data-field][data-value]`, `action[data-action]` | Actual form control, option and secondary command. Repeated commands/options also identify their subject with `data-value`. |

Scope fields to their owning dialog, Properties panel or custom component.
Native controls use their existing semantic id/name (`gs-*`, `space-*`, `room-*`,
`marker-*`, `support-*`); Properties uses `properties-<field.key>`. The four PDF
checkboxes are `pdf-dimensions`, `pdf-decor`, `pdf-roomNames`, `pdf-backdrop`.
Radio/options use their stable value, not translated labels. Radar target slots
can additionally carry `data-slot`. A field hook does not expose private HA
component internals.

Id-less shared controls receive test identity without a new DOM id:
`radar-swap-axes[data-slot]`, `radar-angle-clockwise`,
`properties-variable-entity` (and its `-filter`), and `<north-field>-dial`.
Form coverage includes buttons and checks identity at primitive call sites,
including imported aliases, rather than trusting the shared template alone.
Text links expose semantic actions such as `review-fields` and
`open-general-settings[data-value=<section>]`; LED commands use `led-*` and
the LED picker uses `field-option[data-field="led-device"][data-value=<id>]`.

Colour hosts identify their owner: `gs-fill-<palette key>`, `gs-wall-fill`,
`gs-bg-color`, `gs-glow-color`, `space-border-color`, `space-fill-color`,
`space-bg-color`, `room-fill-color`, `marker-glow-color`,
`marker-activity-color`, `decor-color`. Inside that host, existing controls use
`colour-open`, `colour-sv`, `colour-hex`, `colour-hue`, `colour-saturation`,
`colour-brightness`, `colour-opacity`, `colour-none`; the two opacity controls
are distinguished by `data-value=range|number`. Confirmation is the existing
`action[data-action="colour-confirm"]`.

The current decor model has line/rect/ellipse/text/furniture/image. The `path`
kind is reserved by the expanded enum, not a new persisted shape type; existing
furniture SVG paths identify `furniture`. The added tool enum also declares
existing opening/stair variants, `device-magnets` and `led-strip`.

`schemaVersion: 1`, compatible additions and the one-stable-version removal
policy remain unchanged. New per-hook `attributeMetadata` is additive and can
be ignored by old readers. It documents open identities without replacing the
old closed `attributes` arrays. The local test facade is not shipped. External
E2E syncs the inventory from the installed product ref before contract lint
and updates its kind collector for the new hook families (#1010).

Toast identity follows the actual key through direct/helper translations,
conditional keys, single-key junction/Resize labels and toast ports. No translated-text reverse lookup is used.
`test/toast-identity-source.test.mjs` checks senders and forwarding adapters;
the inbox and history smokes observe ids after real operations/refusals.
