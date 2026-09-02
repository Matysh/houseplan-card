# Filtering: hide versus delete

Agreed with the owner 2026-07-29. This document is the source of truth for the
mechanism; the code follows it.

HA registry deactivation is a separate runtime condition. Its full contract is
specified in `docs/superpowers/specs/2026-08-08-ha-disabled-devices-design.md`.

## Principle

Whether a device is on the plan is an EXPLICIT, per-device fact. The
bottom-left actions have deliberately different meanings: Hide/Show is a
reversible presentation flag, while Delete removes the plan object and every
plan-level contribution. The old on-the-fly filtering algorithm survives only
as the SEEDER of initial hidden flags.

## Data model

- `marker.hidden: true` — hidden from the plan. For an auto device without a
  marker, hiding creates a stub marker (this mechanism predates this spec).
- `marker.hidden: false` (marker present) — explicitly VISIBLE: the seeder
  never touches a device that has any marker, so unhiding must KEEP the stub
  marker. That is the re-seed protection.
- `marker.removed: true` — a minimal binding tombstone. It is not a marker and
  is never built, rendered, shown as a ghost or aggregated. It exists only so
  automatic discovery cannot immediately recreate the deleted device. The
  same binding remains available in Add; saving it again replaces the
  tombstone and starts with a fresh position.
- A `device:D` tombstone also exposes D's active child entities in Add when
  **Show entities** is enabled. Saving one `entity:X` keeps the parent
  tombstone and restores only X: the live exact entity binding overrides the
  tombstone for X, while D and every sibling without its own live marker stay
  deleted. Adding D later is still an explicit exact re-add and may coexist
  with X under the rule below.
- A live `entity:X` marker owns X inside its automatic parent `device:D`. A
  residual auto-device contains only active, HA-visible siblings not owned by
  other entity markers and disappears when that set is empty. A user-hidden
  live marker still owns X; an entity tombstone does not. An explicit
  `device:D` remains complete and may intentionally coexist with explicit
  entity markers.
- No marker — never evaluated by the seeder yet, or a plain physical device.
- `bindingStatus: ha_disabled` is runtime-only. It is derived from Home
  Assistant's device/entity registries and is never written into a marker or
  confused with `marker.hidden`.
- `settings.filter_seeded: true` — this config has been materialised.
- `settings.show_all` — removed (deleted during materialisation). The old
  toggle was shared config state; the new one is a local editor tool.

## Seeding

"Non-physical" = the old filter rules: excluded integration domains, model
"Group", scene-like models, bridges, myheat children, and individual lamp
devices in an area covered by a light group (when group folding is on).

The seeder runs on the editing client (write permission required) whenever
devices rebuild, and creates `hidden: true` stub markers for non-physical
devices in BOUND areas that have NO marker. It is idempotent: marked devices
are never revisited. It fires on:

1. first load of a config without `filter_seeded` (materialises the current
   behaviour; nothing changes visually, the flags become real and editable);
2. an area newly bound to the plan;
3. a new device appearing in a bound area — non-physical ones are hidden
   silently (no red dot); physical ones keep the red-dot flow.

Entity-marker ownership uses the same residual projection here as in the
renderer. The seeder never turns an automatic parent with an empty or
HA-hidden-only residual into a persistent hidden `device:D` stub.

Until a config is seeded (`filter_seeded` absent), `buildDevices` applies the
LEGACY runtime filter, so a read-only client on an old config sees exactly
the old behaviour until an editing client materialises it.

## Behaviour

| State | Renders | Devices catalog | Room/light/climate data | Add/re-add action |
|---|---:|---:|---:|---:|
| visible marker/device | yes | — | yes | no duplicate |
| `hidden: true` | no | ghost | LQI/climate yes, visible light no | no duplicate |
| HA `disabled_by != null` (device/entity/all children) | no | disabled ghost | no | no |
| registry access limited, binding unverified | no, no false ghost | support status only | no | no |
| `removed: true` | no | no | no | yes |

- Hidden devices ARE built (flagged `hidden`), but not rendered in any mode,
  except the device editor with "Show hidden devices" on — there they render
  ghosted (translucent, dashed) and clicking opens the dialog, where the
  bottom-left "Show" action restores it after saving.
- The Device editor exposes one lifecycle catalog built by the pure
  `device-inbox.ts` projection. Exact bindings stay in one user-intent category
  (`on_plan`, `available`, `hidden`, `readd`); HA disabled/orphaned/unverified
  is an independent operational status and never silently moves a row.
- **Show hidden on plan** in that catalog is LOCAL, ephemeral state of the
  current editor session. A disabled ghost is grey and explicitly labelled;
  it cannot be dragged or shown until the binding is activated in HA. Its
  dialog still permits metadata edits, Open in HA and Delete. Opening,
  searching, filtering and Find are read-only.
- Room LQI counts hidden devices (owner's decision).
- A direct device/entity marker without an explicit House Plan room follows an
  authoritative HA Area change. A saved drag position is discarded only after
  the target Area resolves to exactly one room; explicit placement, virtual
  markers and automatic composite light groups never enter this lifecycle.
  The move reuses `new_device_ids`, while limited registry access makes no
  placement or metadata decision. Lifecycle cleanup is also independent of
  this display roster: filtered or unmapped devices remain alive when their
  exact binding exists in the full registry, a relevant empty namespace is
  never destructive, and a missing binding needs two distinct non-empty
  authoritative revisions before its Area provenance is removed.
- Hidden devices are NOT content for the CONTENT FRAME (docs/CANVAS.md §4,
  audit DEV-2C947-01). The frame is presentation: an object the plan does not
  draw may not decide what the plan opens on. Hiding a marker that had once
  been dragged into the yard used to leave the visible house a dot in the
  corner of a frame 112x too wide — on the full card and on
  `houseplan-space-card` alike. They keep their place in the auto-grid roster
  (so a visible neighbour does not move when one is hidden) and in every
  aggregation listed here; only the frame stops seeing them, ghosts in the
  device editor included — reaching a ghost is the pan slack's job (§5).
- Light fill and glow do NOT count hidden devices — an invisible device casts
  no visible light (owner's decision). Room climate is registry-wide and
  unaffected, as before.
- Hide/Show is also available from the lifecycle catalog; the bottom-left
  "Hide" / "Show" action remains in the dialog of every
  existing device kind, virtual included; changing it is applied by "Save".
- "Delete" appears beside Hide/Show for every existing marker. It asks for
  confirmation and commits immediately. HA device/entity markers leave only
  the tombstone above; virtual markers are removed outright.
- Deleting a generated light-group binding also removes that group from the
  plan's light-source set. On a legacy unseeded config its formerly folded
  member lamps may consequently appear as ordinary devices. This is deliberate
  delete semantics, not restoration of a hidden group.
- Deletion removes the marker layout, pending activity state, attachments and
  saved vacuum trails. A late drag from a stale browser tab is ignored by the
  server while the tombstone exists.
- A deleted **device binding** is excluded from room LQI, light-source
  resolution, room light statistics/fill/Glow, registry-wide climate averages
  and explicit room sources, except for an exact child entity restored as a
  live marker as described above. That exception is exact: it restores X's
  normal marker-level state and aggregates, never the parent or its siblings.
  An **entity binding** tombstone suppresses that standalone plan object; it
  does not remove the same entity from the data of a still-live parent HA
  device. Tombstones are binding-scoped, not mutations of the HA registry.
- Exact `opening.contact` and `opening.lock` references are independent of a
  standalone plan marker: deleting that marker does not remove the entity from
  the opening picker and does not stop the saved opening from following its HA
  state. The tombstone still suppresses every marker-level contribution and is
  not removed or rewritten by choosing the entity in an opening.
- References in live text and another marker's persisted `controls` are
  retained but become inactive (`—` or no control action respectively).
  Adding the binding again restores those references without reconstructing
  configuration or performing an unrelated Save first.
- The same inactive rule applies while a saved binding is HA-disabled. The
  marker, room metrics, Glow/light fill, registry-wide climate, live text,
  openings, controls, vacuum puck and trails all ignore it. Reactivation of the
  same registry ID restores the existing metadata and layout; a prior explicit
  `hidden: true` remains hidden.
- Full entity/device registries are fetched and subscribed once per HA
  connection and shared by every full/static House Plan card on the page.
  Non-admin clients which cannot read them use positive current registry/state
  evidence only. Unknown absence is `unverified`, never guessed to be disabled
  or deleted. The last authoritative disabled result is cached separately from
  config to prevent a stale warm-boot flash.
- Duplicate names are still numbered, light groups still fold — those are
  aggregation, not hiding.

## What a marker SHOWS

A marker's live indication — status plate, state-morphed icon and semantic
activity — is derived by one resolver from one effective source set. Action
selection is separate but shares `resolveToggleIntent` whenever the effective
action is Toggle state; `_actEntity` is legacy terminology and is not an
independent target resolver. Presentation source precedence is:

`display: static_icon` is the deliberate presentation exception to the matrix
below. The resolver still retains source metadata for preview diagnostics, but
the rendered marker always uses its base icon on a neutral dark plate: no state
morph, work/open/alarm/unavailable paint, activity, RGB, value or satellite
temperature/humidity/LQI badge. Live vacuum puck/trail/room-highlight overlays
are also suppressed. This changes presentation only: hover/focus, service-call
feedback, controls, Glow and room light aggregation keep using the real device.
Hidden, removed or HA-disabled lifecycle rules still outrank display mode.

1. the resolved **cover** when `resolveToggleIntent` selected cover semantics.
   This includes current explicit `toggle` and losslessly-read legacy
   `tap_action: 'cover'`; the same exact entity drives open/close/stop and icon
   morph/activity. It wins over EVERYTHING below;
2. the marker's **resolved light sources** (`resolvedLightSources`): external
   `controls` plus its own primary controllable entity when `is_light: true`
   (an `entity:*` marker's bound entity and a `device:*` marker's child entities
   are excluded from the external list); `is_light: false` suppresses that own
   candidate, while missing/null discovers automatic `light.*` only when `light` is the
   device's resolved functional role. An auxiliary LED/display light on a
   media player or appliance does not turn the whole marker into a lamp. This
   exact set feeds Light fill, room light stats, marker feedback and group
   toggle. Glow additionally requires a spatial source: an external control
   never places a pool at the controller, while a real lamp marker or explicit
   `is_light: true` marker does. When both name the same entity, the physical marker
   owns its one Glow position regardless of registry order;

   A pre-v1.60 marker that lists its own `switch.*` in `controls` is ignored as
   a self-reference; it is not interpreted as `is_light`. Marker Save removes
   it, and Optimize Plans can remove the directly identifiable `entity:*` case.
   The dialog preserves the ordered raw list of genuine external controls,
   including duplicates and temporarily unknown targets; runtime consumers
   separately de-duplicate and keep only currently controllable entities.
3. otherwise the device's **resolved state role**
   (`resolvedDeviceStateEntities`): functional device domains first, then
   semantic binary signals, then one representative switch, then passive
   readings together. A switch-only device does not aggregate sibling feature
   toggles into its working state; this covers integrations which expose power,
   modes and options as uncategorised peer switches. If HA metadata identifies
   a dedicated Power entity in that composite controller, Power=on is neutral
   and Power=off uses the existing faded unavailable style. A lone relay is
   unchanged and remains yellow while on.
   `primaryEntity` is only the first entity of this same set for actions which
   require one target; it no longer defines marker availability by itself.

For `climate.*`, a recognized real `hvac_action`/equivalent action remains
authoritative: `idle` stays neutral even while the selected mode is `heat`,
while `heating`, `cooling`, `preheating` and `defrosting` are working. Unknown
vendor mode-like values in action attributes are ignored instead of suppressing
the normal enabled-mode fallback. If the integration exposes no recognized
action, the current non-off state is matched against HA's `hvac_modes` (plus the
standard modes) and used as the best available enabled/working approximation.

The original cover-first rule was added 2026-08-04 on the owner's report: his Aqara «Roller shade
driver E1» curtains ship the `cover.*` hidden by the integration and a visible
`switch.*_reverse_direction`, so `primaryEntity` picked the service switch —
the plan showed no ring while a curtain travelled, no `curtains` /
`curtains-closed` morph, and a yellow «включено» plate whenever the
reverse-direction option happened to be on. Issue #94 moves target selection
from the former `coverEntityOf` branch into the shared action resolver; the
indication still follows exactly the entity the tap would drive.

**Why the cover is FIRST and not third** (audit DEV-1DA1-01, fixed the same
day). It went in below `controls` and the lit light at first, and that left
the contract below («у штор не должно быть жёлтой подложки НИКОГДА») with two
holes big enough to walk through: a mixed device — a lamp that also ships a
blind — using the former explicit «Открыть/закрыть» action went yellow off its own lit `light.*`, and a
curtain marker with a bound wall switch went yellow off `controls`. In both
the early `return 'on'` never reached the cover branch, so the travelling
curtain also lost its breathing ring, and in glow fill (where the renderer
strips `on` from a shining source) it was left with no indicator at all —
while the tap still drove the cover. A rule that «шторы никогда не жёлтые»
cannot have exceptions decided by the neighbours in the entity list.

**Why it hangs on the resolved action target and not merely on “the device has
a cover”.** A mixed device may be a lamp with an auxiliary blind. The universal
action resolver first honours explicit controls, then an exact entity binding,
then the device's resolved functional role. Presentation adopts cover semantics
only when that same result selected the cover, so the option, hint, service call
and state shown cannot disagree. A no-target or unsupported result falls through
to ordinary light/device-role presentation and never invents a service target.

### A media player is powered, not "working" (owner 2026-08-07)

The resolved role stays `media_player.*` for every TV, receiver, speaker and
soundbar; no model/name exception is involved. Its HA transport states
(`on`, `idle`, `playing`, `paused`, `standby`, etc.) all produce a neutral
marker with no running effect. Explicit `off` deliberately reuses the existing
`.dev.unavail` faded presentation used by `unknown` / `unavailable`; it does
not add another visual status. When a marker resolves several media entities,
it fades only if none is currently available and powered.

The media role also outranks auxiliary `light.*`/`switch.*` entities belonging
to the same physical device. Status LEDs, display illumination and vendor
options therefore neither paint the media marker nor enter room light
aggregates automatically. Explicit marker `controls` or `is_light` remains the
user override for a real light source.

### A cover is never painted (owner 2026-08-04)

«У штор не должно быть жёлтой подложки НИКОГДА, индикация открыто/закрыто за
счёт морфинга иконки.» For the `cover` domain — and for the cover selected by
the universal toggle resolver, rule 1 above — the visual resolver returns
no working/open plate in any state:

| cover state | plate | pulse | icon |
|---|---|---|---|
| `closed` | neutral | — | closed glyph |
| `open`, ajar (`open` + position) | neutral | — | open glyph |
| `opening`, `closing` | neutral | continuous pulse in Icon + state and activity | open glyph |
| `unknown` / no state | neutral | — | base icon, no morph |
| `unavailable` | neutral, faded (`.unavail`) | — | base icon |

Until this the domain shared one branch with `valve` and wore `.dev.open` —
an orange FILLED badge (`--hp-open`), not a mere border — while open or
opening. The open/closed story is now told by the icon alone (`stateIcon` /
`COVER_ICONS`), so the morph has to be exhaustive: every device class maps
its two states to two DIFFERENT glyphs, and a cover with no `device_class` at
all (z2m ships plenty) morphs within the family of its own base icon —
`mdi:roller-shade` (what the name rule «штор|curtain|blind|shade» hands out),
`mdi:garage-variant`, `mdi:blinds-horizontal`, `mdi:door`. The one place a
hand-picked icon is not final: a cover whose custom icon IS one of those pair
members morphs inside that pair — never traded for another family — because
otherwise choosing an icon would silently switch the marker's only indicator
off.

WHAT KEEPS THE FRAME. `.dev.open` is untouched everywhere else: door / window
/ garage_door / opening binary sensors, an unlocked `lock`, and `valve`. A
valve is deliberately left out of the owner's rule — no icon pair morphs for
it, so the frame is the only thing it has to say «открыт» with. If the owner
ever wants the two domains to read alike, a valve needs an icon pair first.
