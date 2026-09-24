# Устройства и маркеры

> Приложение к [`docs/TESTING.md`](../TESTING.md): перенесено оттуда дословно (#634).
> Индекс всех приложений — [`README.md`](README.md).

## Device icon design package (#179)

- [ ] Pure presentation tests cover lock/unlock, exact marker-only LQI bands
      `0/40/41/179/180`, unchanged room gradient, package pulse defaults,
      semantic colors and reduced motion
      [unit: `device-presentation.test.mjs`, `device-pulse.test.mjs`].
- [ ] Shared face tests cover shell/core DOM, four Double positions, a third
      legacy section, deterministic font fitting, full text and safe CSS color
      variables [unit: `device-face.test.mjs`].
- [ ] The browser renders the exact shell ratio and shadow color, Light/Dark
      cores without backdrop blur, state/LQI colors, 3.6 s presence pulse,
      unavailable no-hover, full Text/Double values, 44×44 target, View and
      Device-editor keyboard paths, and no Plan tab stop
      [auto: `smoke_device_icon_design.mjs`].
- [ ] Full plan, preview and static card preserve the same face after the DOM
      redesign; static mode, state/value and disabled-device contracts stay
      green [auto: `smoke_device_preview_parity.mjs`, `smoke_static_icon.mjs`,
      `smoke_state_value.mjs`, `smoke_disabled_device.mjs`].
- [ ] Restoring unavailable hover, shifting the LQI boundary, restoring value
      ellipsis or bypassing `_clickDevice()` makes its guard red
      [mutation: `device-unavailable-hover-restored`,
      `device-marker-lqi-low-boundary-shifted`,
      `device-long-value-ellipsis-restored`,
      `device-keyboard-bypasses-click-path`].
- [ ] Pre-beta golden reviews desktop/mobile Light/Dark states, combo states,
      Text, four Double positions, long and legacy values, LQI, reduced motion,
      sizes 32/56/96 and colored backgrounds. Full smoke/golden/performance
      remains a Linux release gate.

## Dense device-marker hit ownership (#564)

- [ ] Pure geometry covers visible capsule priority, invisible 44 px-floor
      overlap, nearest-core selection, stable exact ties, stadium corners and
      spatial-index locality [unit: `device-hit-owner.test.mjs`].
- [ ] Source contracts keep painted shells globally above transparent floors,
      route hover/click/pointer lifecycle through one semantic owner and forbid
      layout reads from the pointer-move path
      [unit: `device-hit-owner-contract.test.mjs`].
- [ ] Household J7 checks the five-marker dense column at tablet and phone
      widths: every visible centre has the same native and semantic owner, its
      click opens that marker, and a pointer sequence remains latched through
      its terminal click [auto: `smoke_household_journeys.mjs`].
- [ ] Real browser geometry covers Icon, Text, Double and untouched legacy
      faces at all four cardinal sides/directions. In every case a painted
      point overlaps only the neighbour's invisible 44 px floor and still owns
      the native hit, semantic owner and click
      [auto: `smoke_device_hit_capsules.mjs`].
- [ ] Replacing nearest-screen-core selection with first-input/DOM order makes
      both the pure geometry guard and the real rendered-face browser guard red
      [mutations: `dense-device-hit-falls-back-to-input-order`,
      `dense-device-hit-browser-skips-painted-priority`].

## Device marker polish and pointer modality (#212)

- [ ] Shared icon geometry applies one 0.9 visual factor after card/per-marker
      sizing, keeps the saved centre and 44×44 hit floor unchanged, and gives
      wide Text cores a radius equal to half their height
      [unit: `device-marker-polish-contract.test.mjs`; auto:
      `smoke_device_icon_design.mjs`].
- [ ] Only a genuinely dispatched toggle/run action produces one
      `1 → .95 → 1` feedback cycle lasting 200 ms. Info, editor, confirmation
      before acceptance, unavailable/secure/no-target and cancelled gestures do
      not; reduced motion has no scale tween
      [auto: `smoke_device_icon_design.mjs`].
- [ ] Pointer authority is isolated per card. Touch/pen and compatibility mouse
      input clear JS/CSS hover, while a later real mouse restores it only on
      fine/hover hardware; mode/space/visibility/disconnect cleanup remains
      bounded [unit: `pointer-modality.test.mjs`; auto: `smoke_feedback_v2.mjs`].
- [ ] Pre-beta visual review covers Light/Dark desktop and touch matrices for
      ordinary, Text, Double, unavailable and vacuum markers; full golden and
      performance gates remain release work.

## Device value badge (#90)

- [ ] An untouched legacy thermometer/humidity marker remains pixel-identical;
  saving another field does not materialize `value_badge`. [auto: device-presentation]
- [ ] Explicit on/off overrides the legacy temperature gate; zero, false and
  off remain visible, while missing/unknown/unavailable render a stable `—`. [auto: device-presentation]
- [ ] State, every allowlisted attribute, derived LQI and `marker:<id>` light
  state resolve identically on the full plan, static space card and preview. [auto: smoke_device_preview_parity]
- [ ] Opening the editor explicitly selects the persisted source and position,
  even when they are not the first dynamic options, without touching config. [auto: smoke_device_preview_parity]
- [ ] Right, bottom, left and top update live in the editor; bottom stacks above
  system LQI and derived LQI suppresses the duplicate system row. [auto: device-presentation]
- [ ] Browser bounding boxes stay inside `.previewstage` with a safe gap for
  all positions, a long value, scale ×3 and the maximum activity ring. [auto: smoke_device_preview_parity]
- [ ] Rebind resets the source, delete leaves a missing diagnostic reference,
  and space import remaps internal refs or disables/counts external refs. [auto: test_ha_import_export]
- [ ] `static_icon` suppresses but preserves the setting; live-state and room
  label toggles do not suppress an explicit badge. [auto: device-presentation]

> **Policy:** this checklist is updated **in the same commit** as any functional
> change (like CHANGELOG.md). For a pre-release, build the production bundle and
> run the smallest unit/smoke subset that covers its changed surfaces. Run the
> complete local frontend, backend and smoke gates only before a stable release.
> The exact-SHA GitHub Validate remains mandatory for publication. Items marked
> `[manual]` are covered by unit tests or the headless smokes in `demo/` — they still
> deserve an occasional eyeball. File every failure as a GitHub issue before fixing.

> **What `[manual]` means (since 2026-07-27).** A named check exists that FAILS
> when the behaviour breaks — in `npm test` or in the smoke suite, both of which
> run in CI on every push. Where the check lives is written next to the marker
> (`[auto: smoke_modes]`). Before this date the marker described an intention:
> the smoke suite printed values and always exited 0, so 96 markers guarded
> nothing (external audit T1/T3). If you add a checklist line marked `[manual]`,
> add the failing check in the same commit.

> **⚠ Rule: a new scrollable list inside a dialog is tested by GEOMETRY, never
> by the DOM.** Any new scrolling box or `overflow` container added to a dialog
> MUST get a smoke that measures **the container's own height and the visible
> position of its first item** (`getBoundingClientRect`, and the item's rect
> against the box's rect) — counting rendered rows, or asserting that the nodes
> exist, proves nothing. The failure mode is always the same and always
> invisible to a DOM check: a scrolling box is a flex item whose automatic
> minimum size is zero (`min-height: auto` → 0 for an `overflow` child), and a
> dialog body is a flex column with a height cap, so the box is the one child
> that can be squeezed to a sliver while every row inside it renders happily.
> It has bitten us twice already: the **target search results** in the tap
> action dialog (v1.53.1 — 26 matching automations rendered into a 1 px
> stripe; the smoke counted rows and passed) and the **«Already uploaded»**
> plan picker (dev, unreleased — rows present, box 14 px tall, same story).
> Both smokes measure heights now; write the third one that way from the start.

## HA-disabled binding gate

The source-of-truth matrix is
`docs/superpowers/specs/2026-08-08-ha-disabled-devices-design.md` §17.
`test/ha-binding-status.test.mjs` covers full/limited registry decisions and
the active-only state projection. The standalone demo exposes complete
`disabled_by` rows through both registry list WS commands plus
`window.__setRegistryDisabled(kind, id, disabledBy)` and
`window.__setRegistryAccess(mode)` for browser scenarios.

- [ ] A saved device/entity marker disappears from View, room data, Glow,
      controls, live text, openings and vacuum overlays after its registry row
      becomes disabled; config/layout remain byte-for-byte unchanged.
- [ ] Device editor → Hidden and disabled shows a labelled grey ghost. Show is
      refused, metadata/Delete/Open in HA remain available, and the ghost is
      not draggable.
- [ ] Reactivating the same ID restores its metadata/layout without a false
      new-device event; an explicitly user-hidden marker stays hidden.
- [ ] A never-seen auto device disabled before discovery appears as new only
      after its first activation.
- [ ] All disabled child entities make an otherwise active device disabled;
      one disabled auxiliary entity never suppresses active functional rows.
- [ ] If full registry WS access is denied, positive live evidence stays
      active, an unknown binding is `unverified`, and no false disabled/orphaned
      ghost or service call is produced.
- [ ] Two full cards plus a static space card share one registry fetch and one
      subscription pair per HA connection; registry events invalidate all of
      them without a reload.
- [ ] `houseplanDiagnostics()` reports only redacted registry access/age/error
      and binding-status counts; it contains no names, states or marker data.

## HA Area marker relocation (#126)

- [ ] `test/device-area-relocation.test.mjs` covers direct-binding authority,
      same/cross-space transitions, conservative legacy backfill, explicit and
      composite exclusions, rebind, malformed metadata and delete-first
      provenance.
- [ ] `test/space-geometry.test.mjs` proves both marker-position paths can
      suppress one stale saved point without changing the stored layout input.
- [ ] `demo/smoke_area_relocation.mjs` changes an authoritative registry Area
      against the production bundle, checks one serialized layout delete plus
      config/attention persistence, and proves the read-only hosted card moves
      immediately without writes.
- [ ] Area-provenance cleanup ignores the filtered display roster, preserves
      empty Device/Entity Registry namespaces, accepts exact live entity states
      as existence evidence, requests only one confirmation refresh and removes
      an orphan only after two distinct non-empty authoritative revisions.
- [ ] A rejected confirmed-cleanup config write remains retryable on the next
      rebuild; the same revision, state ticks and repeated empty frames never
      become extra confirmation or a registry reload loop.
- [ ] Backend validation and import/export tests cover the 20,000-entry bound,
      exact entry schema, same-source preservation and cross-source removal.

## Device display preview and face parity

The behaviour matrix is defined in
`docs/superpowers/specs/2026-08-08-device-display-preview-design.md` §22.
Pure source/value/presentation rules live in `test/device-presentation.test.mjs`.
`demo/smoke_device_preview_parity.mjs` compares the same live fixture across
the interactive plan, `hp-device-preview` and `houseplan-space-card`, including
semantic classes, icon/value/badges, scale variables, provider text and the
public binding-status hook.

- [ ] Every binding/display/icon/size/angle/control/temperature draft change
      updates the preview before Save; Cancel writes neither config nor layout.
- [ ] Working, open, cover, presence, short event, transition, alarm, static,
      unavailable, media-neutral, composite-Power and `live_states: false`
      explanations match the actual face.
- [ ] The local short-activity demo lasts 3.3 seconds and the continuous demo
      runs until stopped. Neither sends a service call; reduced motion uses a
      compact dot, and both reset immediately on binding change, real activity
      or alarm.
- [ ] Provider metadata is cached between dialog openings and refreshed after
      registry/config-entry changes; source integrations remain separate from
      the binding provider.
- [ ] Long provider/source/state text wraps without horizontal scroll; maximum
      marker/ripple size fits the stage and reports its preview scale.
- [ ] Derived temperature/humidity values keep the compact plan form (`22.4°`,
      `48%`), while a direct entity value continues to use HA localization and
      units.

## Device icon package parity (#211)

The independent reference subset under
`demo/srv/reference/device-icons/` comes directly from designer package 1.1.1;
it is not generated from production CSS. The package archive hash and the
owner's #219 red/green Lock/Unlock paint override are recorded in that
directory's README.

- [ ] `node demo/smoke_device_icon_design.mjs` reads the SVG colors and stroke
      widths, then compares them with fresh computed styles. It also measures
      circular core/shell geometry, the real `mdi:lightbulb-spot` painted path,
      value-pill radius and 44×44 hit area at 32/56/96 px.
- [ ] `node demo/capture_device_icon_reference.mjs` writes a two-column
      **Reference SVG / Runtime** matrix for both themes to
      `artifacts/device-icon-reference/`. Code review must inspect this artifact
      visually; a green historical golden is not proof of package parity.
- [ ] Preview/static parity and unavailable keyboard/tap behavior remain
      covered by `smoke_device_preview_parity`, `smoke_static_icon` and
      `smoke_disabled_device` after a fresh production build.

## Device marker geometry and input polish (#213)

- [ ] `node demo/smoke_device_icon_pixel_alignment.mjs` covers core bases
      24…112 CSS px in quarter-pixel steps at DPR 1/1.25/1.5/2. DOM centres,
      isolated painted centroids/support and a deliberate 1 CSS px mutant must
      distinguish browser raster parity from a persistent offset.
- [ ] `node demo/smoke_device_icon_design.mjs` keeps the effective 32/56/96
      geometry, uses the direct 0.55 MDI/core ratio and proves hover plus the
      configured action from the far value-capsule end at right/bottom/left/top.
- [ ] Opening binding/registry-less/lock-action smokes preserve the secure
      no-toggle-on-plan invariant while checking compact Light/Dark
      locked/unlocked/unknown shell/core presentation.
- [ ] `node demo/smoke_opening_entity_search.mjs` checks the real opening
      dialog: contact and lock search by friendly name/entity ID, preserved
      contact priority, visible IDs, persistent **none** option and unchanged
      `opening.contact`/`opening.lock` storage.
- [ ] Unit presentation coverage compares marker LQI colour with the shared
      continuous `lqiColor()` across former 40/41 and 179/180 boundaries; bands
      remain semantic metadata only.

## Text marker shell shape (#217)

- [ ] `node demo/smoke_device_icon_design.mjs` checks the external Text frame,
      not only its core: a long value keeps a saturating capsule radius at
      24/32/56/96/112 px, while Icon-only remains circular and Double remains a
      capsule. The runtime mutation to `border-radius: 50%` must be rejected.
- [ ] `device-text-shell-long-light` and `device-text-shell-long-dark` isolate a
      large `498 ppm` Text marker. Golden review must visibly confirm straight
      upper/lower middle sections rather than an ellipse.
- [ ] `node demo/capture_device_icon_reference.mjs` includes an additional
      96 px Text row beside the normative Light/Dark `Text Default.svg`.

## Device lock and orange foreground palette (#219)

- [ ] Closed/`locked` is green `#66D17A`; open/`unlocked` is red `#F0410C`.
      The same core/stroke palette is used by ordinary lock markers and compact
      door/gate lock badges; glyph shape remains closed/open/question.
- [ ] Every device glyph on an orange core (`on`/working and physical `open`)
      is white in Light and `#252525` in Dark. `device-icon-state-table-light`
      and `device-icon-state-table-dark` show `on` and `open` together, plus
      both lock states [unit: device-marker-polish-contract; auto:
      smoke_device_icon_design; golden: device-icon-state-table-*].
- [ ] Alarm, hover, focus, selected, unavailable, virtual, press feedback,
      pulse, hit-area and lock actions retain their existing priority and
      behaviour [unit: device presentation/polish/pointer; visual source review].

## Unified device status and pulse activity (#98)

- [ ] The Display list contains exactly Icon + state, Icon + state and activity,
      Value + state, Always static icon, in that order. Legacy
      `display: ripple` reads and saves back as `icon_ripple`
- [ ] Icon + dynamic plate shows state plate/morph but no ordinary activity
      effect; Icon + activity adds the semantic effect; Value keeps the
      state-coloured plate and hides ordinary activity; Always static icon
      keeps one neutral base icon and suppresses all state-driven visuals
- [ ] Motion/vibration/sound/contact rising edges render exactly three waves
      for about 3.3 s; initial load and recovery from unknown/unavailable do
      not fake an event; a rapid retrigger restarts it
- [ ] Occupancy/presence is one calm continuous pulse for the whole active state
- [ ] Cover/lock/valve movement continuously pulses until the travelling state ends;
      direct terminal `closed ↔ open` / `locked ↔ unlocked` without an
      intermediate state breathes for about 3.3 s
- [ ] Actual work (light/switch/fan/humidifier on, active climate action,
      vacuum cleaning, script running) is yellow and slowly
      breathes in Icon + activity; `automation = on` is merely enabled and
      remains neutral
- [ ] Every `media_player` is neutral and has no running activity for `on`,
      `idle`, `playing`, `paused` and other transport states; explicit `off`
      uses the same faded treatment as `unknown`/`unavailable`. Several
      resolved media entities fade only when none is available and powered
- [ ] Controls aggregate their targets: any working target drives both the
      yellow plate and the running effect
- [ ] Open contact/open valve are orange; unlocked lock is red and locked lock
      is green; an open cover stays neutral because its icon morph carries that
      state
- [ ] Unavailable suppresses ordinary activity. Alarm outranks all dynamic
      presentation, including when ordinary live states are off; `static_icon`
      deliberately hides alarm paint without suppressing service-call errors
- [ ] `static_icon` hides temperature/humidity/LQI, RGB, value, icon morph,
      activity and live vacuum puck/trails/room highlight on the full and static
      cards; preview still names the real HA state/source and explains the static result
- [ ] Switching a static vacuum back to a dynamic display restores applicable
      live/server trails; choosing static never deletes stored trail history
- [ ] `value_static_icon` (#588) shows the same value as `value` — including on
      the plan itself and the space card, where sources are resolved lazily
      — while state, alarm, unavailability, RGB and activity never paint
      it; no pulse, no °/%/LQI, value badge suppressed with its setting kept,
      and the live vacuum puck, trail and route warning stay hidden
      [auto: `smoke_static_icon.mjs`, golden `device-icon-state-table-*`]
- [ ] Activity colour and size (×2..×8) apply per device; alarm ignores them
- [ ] Icon size ×0.5..×3 and rotation 0..355° apply per device; the
      temp/humidity badges scale with the icon
- [ ] With OS "reduce motion" enabled, ordinary activity becomes a compact
      solid dot; alarm keeps the red plate and accessible alarm description,
      without an animated or static ring

## Climate temperature opt-in (dev)

- [ ] «Use the device's temperature sensor» (marker dialog, climate devices
      only, default OFF): current_temperature shows as the standard `.tval`
      badge and joins the room average like a thermometer; unavailable /
      missing attribute = no badge, no vote; hidden devices keep voting
      (registry-wide climate, like hidden thermometers); the tick survives
      dialog recreation [auto: smoke_climate_temp; units: test/devices.test.mjs;
      backend: tests_backend/test_validation.py (use_climate_temp)]

## Styling hooks and HA-formatted values (docs/STYLING-HOOKS.md, dev, unreleased)

- [ ] **The hooks are there and they are the config's ids**: open the plan's
      DOM (devtools → the card's shadow root) and check that a device marker
      carries `data-hp="device"`, `data-id`, `data-entity` and `data-area`; a
      room `data-hp="room"` + `data-id` + `data-area`; a door/window/gate
      `data-hp="opening"` + `data-kind`; a decor shape `data-hp="decor"` +
      `data-kind`; a visible room card `data-hp="room-label"`; a floor tab
      `data-hp="space-tab"`. The ids are the ones in your config, not DOM
      positions — they survive a reload [auto: smoke_styling_hooks]
- [ ] **Absent is absent**: a virtual marker has NO `data-entity` at all, and a
      sub-area room (no HA area) has NO `data-area` — never the string
      «undefined» [auto: smoke_styling_hooks]
- [ ] **A card-mod rule actually applies**: with card-mod installed, add
      `ha-card [data-hp="device"] .lqi { display: none; }` to the card — the
      signal badges disappear and nothing else moves. Then target one marker by
      `[data-entity="…"]` and confirm it is the only one affected [manual]
- [ ] **The static card carries the same hooks**: a `houseplan-space-card`
      has `data-hp` on its rooms, visible room labels and markers (it draws no openings
      and no decor, so those are simply absent), and it needs its OWN card-mod
      block — it is a different card with its own shadow root
      [auto: smoke_styling_hooks]
- [ ] **`ha-icon` internals stay out of reach**: a rule may style the icon HOST
      (colour, transform) but cannot reach the `<svg>` inside it. That is a
      browser rule, and it is why the hooks sit on our wrappers
      [auto: smoke_styling_hooks]

- [ ] **A value badge is formatted by HA**: set a numeric sensor's display
      precision in HA (Settings → the entity → Display precision) to 1 and put
      it on the plan as «value instead of icon». The badge shows the rounded
      number with YOUR decimal separator and the entity's unit — once, not
      twice — and matches what more-info shows [auto: smoke_value_format]
- [ ] **A live decor label is formatted by HA**: the same sensor in a text
      shape reads identically; a switch shows «Включено», not `on`; an
      attribute goes through the attribute formatter (a climate's
      `current_temperature` is a number, not the climate's state)
      [auto: smoke_value_format + unit logic.test]
- [ ] **A literal suffix stays literal**: write an attribute token followed by
      ` проц.` — the suffix is part of the text, with no hidden unit override
      and no duplicate appended by the label renderer [auto: smoke_live_text]
- [ ] **An older Home Assistant is unchanged**: on an HA without
      `formatEntityState` the badge and the label print the raw state with the
      entity's unit appended, exactly as before — nothing is blank and nothing
      throws [auto: smoke_value_format + unit logic.test]
- [ ] **The °/% plates are untouched**: the small temperature/humidity badges
      next to an icon (and the same numbers in a room card and the tooltip)
      still read «21.5°» / «48%». They are a derived reading, not an entity
      state — deliberately ours [auto: smoke_value_format]

- [ ] **The text block's handles are small but still catchable**: select a
      label in the Background editor. The four corner circles and the rotate
      handle are a quarter of their old size — beads, not buttons — and the
      dashed frame no longer hides the text. Now grab one on a TABLET with a
      finger, aiming roughly at it rather than exactly: it is caught, because
      the invisible hit circle is still the old finger-sized one. Same at any
      zoom [auto: smoke_decor_text]
