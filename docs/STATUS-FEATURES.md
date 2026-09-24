# Feature surface and milestones

> Moved verbatim from `docs/STATUS.md` by #634 so that the session entry
> route stays small (`node scripts/entry-cost.mjs`). The documentation policy
> of `STATUS.md` applies here unchanged: a user-visible feature gets its
> bullet in the same commit as the behaviour.

## Current feature surface (since the 2026-07-17 snapshot)

- **Configurable summary overlay** (#437, merged into `dev`): a two-part
  View control opens one adaptive form or toggles a browser-local preference.
  Shared ordered blocks can show readable HA entity states and three system
  values; local icon/text scaling applies to ordinary and kiosk View without
  changing editor geometry. The overlay is a screen-space layer on the right
  or bottom, respects native HA mobile mode, and temporarily hides in a small
  card. Shared saves remain revision-checked; read-only and kiosk users receive
  only the local controls.
  #505 aligns its split control, compact overlay and wide settings dialog with
  the designer reference. Both entry and exit animate; size controls are absent
  from this form without changing saved scales, and mobile visibility is
  disabled under draft local-off. The GitHub issue is the source of workflow
  status; `docs/design/505-summary-panel/` holds the reference and visual evidence
  instructions, not a separate backlog.
- **Presence radars (#485 Stage 1, merged into `dev`):** an optional marker-owned,
  change-aware v1 configuration binds exact HA sources for recognized ESPHome
  LD2450 or explicit Cartesian, polar, range, zone-state and presence-only
  profiles. The backend owns freshness, pairing, projection, room clipping,
  ACL-filtered bounded frames and teardown. The lazy device editor owns source
  inspection and physical two-point setup; View receives only normalized live
  frames. Raw observations, calibration samples and the short target trail are
  session-only and excluded from config, exports and support data.

- **Primary sidebar panel + optional cards** (#486): the integration registers
  `/houseplan` for every signed-in user after backend initialization. Its own HA
  app bar wraps the same `houseplan-card`, so spaces, permissions, actions and
  editor lifecycle stay shared; only the duplicated product title and outer
  dashboard-card chrome are removed. Failure to register the panel is isolated
  and reported in System Health. The optional full dashboard card requests full
  width in Sections by default; explicit HA sizing remains authoritative.
- **Three editors + View**: Plan / Devices / Background (decor layer v1.33) as
  tabs with an X to close; View is the default; only the last space persists,
  while reload/return from another HA route always starts in View (#93).
  **Kiosk mode** (v1.41.0): `kiosk: true` — no
  header/editors, swipe between spaces, double-tap zoom reset, `cycle: N`
  carousel, per-screen size multipliers in localStorage. Discrete wheel,
  button, fit/home and kiosk-reset camera commands use one short retargetable
  transition; direct pan/pinch and reduced motion remain immediate (#82).
- **Independent Glow overlay** (#55/#19, refined locally by #61/#65–#67): dark-room
  base is used only when the effective fill resolver returns `null`, including
  dynamic modes without usable data; resolved LQI/light/temp/custom colors keep
  their exact alpha while per-source pools remain visible. Pools use
  additive screen blending only after a cached real-pixel browser probe and
  otherwise fall back to normal composition; legacy `fill_mode: glow` remains
  losslessly readable/migratable. Marker roles are Auto/Always/Never; colour
  can remain live, be overridden with live brightness, or be fixed together
  with brightness. One perceptual alpha resolver gives every source the alpha at
  the centre of its pool; `GLOW_FALLOFF` then spends it over the whole radius.
  Per-source radius, doorway sight lines and transitive open boundaries remain —
  all three now fall out of the visibility region instead of separate layers.
- **Custom room fill** (#56, space UX refined locally by #64): the space dialog
  uses persistent user color/opacity as its ordinary first/default fill instead
  of a redundant None option; a room keeps None as an explicit inherited-fill
  suppression. Effective inheritance is room → space → safe documented default;
  room reset restores space inheritance, and full/static renderers share the
  same projection.
- **Universal device toggle** (#94, v1.62.0-beta.3): one `Toggle state` option is visible
  for every marker and resolves the exact binding, functional device role or
  explicitly configured controls. Hint, click, confirmation and cover
  presentation share one result; partial groups call only the shown available
  subset, stale controls never fall back, secure targets are no-op, and legacy
  `cover`/absent light defaults round-trip losslessly. **Lights toggle by
  default** (v1.39); other devices still default to the House Plan card.
- **Contextual Zigbee topology** (#54, refined by #457 and #464 on current dev): an
  opt-in admin-only mouse hover shows direct neighbours without scanning. A
  deterministic per-provider uplink tree now adds arrows towards the
  coordinator while keeping non-route neighbour lines; a short bubble names a
  remote space or explains that the next device/coordinator is not on the plan.
  Active topology is above room names and unrelated markers, exact local
  endpoints remain above it, and unknown-LQI dashes have a dark contrast
  casing. Touch, kiosk, editors and the static card remain unchanged.
- **Plan geometry**: polyline split (v1.32), island rooms w/ evenodd holes
  (v1.34), smart guides + 45° angle badge (v1.40), opening hover preview.
  Openings support doors, windows and compact wide gates; gates retain door
  contact/lock/Glow semantics but use two leaves opening only 10° outwards.
- **Canonical wall model** (#282, #306, #478, current dev): Walls and Thickness
  accept `0..100 cm` for contour and independent segments. Model v10
  migrates legacy virtual spans into stable `cm:0` atoms; a per-space
  dashed/solid selector controls both line style and Glow/sun transmission.
  It also converts persisted unfinished contours to ordinary partitions; new
  wall-chain segments are partitions from the first accepted click and chain
  state is session-only. A finished chain losslessly merges/reconciles its own
  seed component and finished-chain Undo/Redo restores the same fixed point;
  room Delete/Merge owns direct and vacuum room-reference cleanup (#477).
  Zero walls have no body, area or opening host, and
  there is no Boundary tool.
- **Rooms**: room cards with metrics (temp/hum/lqi/light "1 of 3") and
  proportional resize (v1.31); link icon to the HA area (v1.40.1, room taps
  removed). **New-device red dot** (v1.29), lock action button (v1.30).
- **Dialog UX**: binding radios + entities checkbox + search dropdown
  (v1.38.0); tap actions simplified to Device card / more-info / Toggle,
  right-click → more-info (v1.38.1); Esc closes every dialog (v1.30.4).
  Since #607, rejecting the real HA close button after an unsaved-changes
  prompt explicitly reconciles the nested modal before reopening it; the same
  Device, Room, Space or General-settings draft remains interactive. #609 keeps
  every shared settings form on the reviewed 560 px canvas and single HA-owned
  scroller in the authentic Home Assistant branch; at 480 px and below the
  form is edge-to-edge fullscreen, while generic dialogs retain their previous
  sizing.
- **Room settings, tier 3** (v1.42.0): per-room fill/temp-source/label sizes;
  the settings button sits at the room's VISUAL centre (inscribed circle +
  centroid pull), icon-derived size, zooms with the plan (v1.51.0).
- **Files & plans** (v1.44–v1.50): signed content urls with sandbox CSP,
  copy-on-write plan files, "already uploaded" picker + explicit delete
  (v1.47.0), store quotas instead of any age-based deletion (v1.49.0),
  nothing is ever deleted on an inference (docs/SCOPE.md rule).
- **Square canvas** (v1.48.0) with a crash-safe two-store migration
  (geom_pending, v1.50.0) and an explicit geometry/repair command (v1.50.1);
  content-fit default zoom with devices as content, zoom out to 0.4×,
  measured stage height (v1.49–v1.50.2).
- **Explicit hide flags** (v1.51.0, docs/FILTERING.md): per-device
  `marker.hidden` seeded once from the old filter and controlled by the
  bottom-left "Hide" / "Show" action in the device dialog; local
  "Show hidden" ghosts; hidden counts toward room LQI on both cards, casts
  no light (v1.51.1).
- **True plan deletion** (v1.60.0-beta.1, 2026-08-07): confirmed Delete beside Hide/Show;
  a minimal `marker.removed` tombstone prevents auto-rediscovery but exposes
  the binding to Add. Deleted devices are absent from every plan aggregate and
  linked marker presentation; layout/files/trails are cleaned and stale layout
  writes are rejected. Exact contact/lock references owned by architectural
  openings remain active without restoring the standalone marker; live text
  and other marker controls retain the older re-add-to-reactivate contract.
- **Yellow = working right now** (v1.51.0): climate uses `hvac_action` when
  available and falls back to a current advertised non-off HVAC mode only when
  the integration omits the action; service switches can no longer become
  primary, and glow pool and icon share one condition. Editor gestures on touch
  (pinch/pan) landed the same release.
- **Unified device status/activity** (v1.59.0-beta.10; pulse pipeline #98 local): four display
  modes (Icon + state / Icon + state and activity / Value + state / Always static icon),
  one semantic resolver for yellow
  actual work, orange open/unlocked, unavailable and always-red alarms;
  activity projects to three finite waves for a short event or one continuous
  pulse for presence, mechanical travel and running. Always-static deliberately suppresses every state-driven visual,
  satellite badge and live vacuum overlay while leaving hover, actions, Glow and
  controls intact. Legacy Ripple-only migrates to Icon + activity on the next save.
- **Passive media lifecycle** (v1.60.0-beta.1): every `media_player`,
  regardless of model, stays neutral while powered or playing and fades to
  the existing unavailable appearance on explicit `off`; transport playback
  is no longer classified as yellow actual work and no new visual state is
  introduced.
- **Unified Background editor** (v1.60.0-beta.1): typed decor model,
  physical cm/in strokes and text size, independent contour/fill opacity, decor+room smart
  magnet, common selection/resize/rotate frame for every decor kind, numeric
  geometry properties, and shared 50-command Undo/Redo. The plan image now has
  an exclusive tool, 0.5 editor de-emphasis elsewhere, independent axes,
  rotation, numeric properties and rotated content bounds. Legacy `width` and
  `plan_scale` remain read-compatible and migrate only through explicit plan
  optimisation. Furniture properties also expose the symbol itself. See
  `DECOR-EDITOR.md`.
- **v1.59.0-rc.1** (2026-08-06): whole-plan lossless optimization with an
  atomic config+layout commit and safe undo; the yellow actual-work plate is
  retained alongside source glow; all Background objects have Select-mode
  double-click properties; View hover highlights every room and reports its
  clean-floor area. Audit fixes add eager activity baselines/source resets,
  lossless legacy live-text editing, exact wall-fragment endpoints/compaction,
  editor-visible virtual walls and prerelease-discovery reporting in CI.
- **v1.59.0-rc.2** (2026-08-06): Plan actions have one meaning each; Room
  outline names the closed-contour tool; one named 50-command Undo/Redo stack
  covers committed plan geometry; positional placement is always grid-bound.
  Glow and toast overlays no longer steal room/tool pointers, View hover covers
  shared thick walls, device Hide/Show is explicit, the static no-op aspect
  field is gone, and the new user guide/product audit replaces archived docs.
- **v1.59.0** (2026-08-06): The stable 1.59 line includes all beta/RC work.
  Room hover follows clean-floor wall faces, including nested contours and
  projected opening gaps. Thick-wall rendering unions each room's own wall
  ring, so one room's floor cannot erase another room's wall or leave white
  slivers at complex crossings.
- **v1.59.1** (2026-08-06): device markers resolve a semantic entity role
  instead of trusting registry order; one light-source resolver now drives
  Glow, Light fill, room statistics, marker feedback and controls. Glow uses
  0.7 opacity. Current dev keeps external `controls` non-spatial: they still
  drive group state, but only a real lamp marker or explicit `is_light` marker
  can place a Glow pool. Compacted real walls retain their correct inner face
  and body at real/virtual T-junctions.
- **v1.59.2** (2026-08-07): every modal uses the shared `hp-dialog` shell,
  backed by Home Assistant's `ha-dialog` with a native demo fallback. Titles,
  modal semantics, initial focus, focus trapping, Escape and restore focus are
  consistent across all editors, nested dialogs and dialog replacement flows.

## Recent milestones (details in CHANGELOG.md)

- **v1.10.0** — audit & refactor: asyncio.Lock around all store writes (race fix, atomic
  `expected_rev`), point `layout/update` instead of full `layout/set` (anti last-writer-wins),
  new `layout/delete`, `safeUrl()` XSS guard, `fetchWithAuth`, KEY_HASS, streaming upload cap,
  card split into modules (`styles.ts` / `types.ts` / `devices.ts`), dynamic spaces in the GUI
  editor, dead code removed.
- **v1.11.0** — full English translation + en/ru UI localization.
- **v1.11.1** — brand images inside the integration; CI fully green for the first time.
- **v1.11.2** — Description textarea fix in the device dialog.
- **v1.12.0** — Quality Scale conformance: runtime_data, test-before-setup, unloading,
  single_config_entry, Store migrations hook, diagnostics, repairs, system health,
  uninstall cleanup, HA-harness tests in CI, quality_scale.yaml.
- **v1.13.0** — universality: floors-import wizard, editable icon rules (+device_class
  fallback), tap actions with a security model, i18n dictionaries in JSON, light-theme pass.
- **v1.13.1** — distribution: synthetic-home demo GIF in the README, issue templates,
  CONTRIBUTING.md, Discussions. Forum/Reddit drafts are in the user folder
  (`posts_drafts.md`) awaiting manual posting.
- **v1.13.2** — audit round 3: buildDevices unit-test suite, multi-placeholder t(),
  conflict resync in _saveConfigNow, pointercancel long-press fix, repairs re-check
  on config save (repairs.py).
- **v1.13.3** — privacy: legacy real-house assets/ removed; README screenshots synthetic.
- **v1.14.0** — per-space display settings (borders/names/color/opacity/fills),
  draggable room labels, hand-drawn spaces (no image required), demo/ harness in-repo,
  docs/TESTING.md manual checklist (update with every functional change!).
- **v1.15.0** — temperature room fill (blue/green/yellow) with editable comfort bounds.
- **v1.15.1** — display-settings UX: radio fill selector, inline compact bounds
  (with the Number('')→0 bound-collapse bug fixed), avg room temp in the tooltip,
  darken-on-hover, wider space dialog.
- **v1.15.2** — fix: average room temperature (fill + tooltip) counted non-thermometers
  (fridges/TRVs/chip `*_device_temperature`/diagnostic); now thermometer/air-monitor only.
- **v1.15.3** — fix: device icon badge sat 1 px off its anchor (content-box + 1 px
  border); `box-sizing: border-box` centres it exactly on the device point.
- **v1.15.4** — fix: real `ha-icon` (block + big line-height) put the glyph ~1.8 px low;
  `.dev ha-icon` is now a zero-line-height flex box. Reverted v1.15.3 border-box (shrank the
  badge). Verified live. Demo stub made faithful so the smoke guards it.
- **v1.15.5** — fix: room hover was always grey; legacy overlay/yard hover rules scoped
  with `:not(.styled)` so filled rooms darken their fill, unfilled ones grey.
- **v1.15.6** — room hover also reveals the border (stroke colour kept, hidden via
  opacity) even when borders are off.
- **v1.16.0** — NEW read-only `houseplan-space-card` (static single-space schematic,
  pointer-events:none, deep-link button) + `#space=<id>` deep-link in the full card; shared
  space-geometry/space-render + module-level config cache (config-store).
- **v1.16.1** — space-card renders room fills as configured on the full card (snapshot),
  no longer omitted; +shared areaLqi().
- **v1.17.x** — entity markers get auto icon/temp (issue #1); correct resource URL documented
  (issue #2); humidity badge (gated on device_class, not the icon).
- **v1.18.x** — live ruler while drawing rooms (metres / feet+inches) + per-space scale
  `cell_cm`; visibility fix (the badge lived in the markup-hidden devlayer).
- **v1.19.0** — a line is never an entity of its own: walls derived from room outlines
  (`roomEdges`), unfinished contours persist nothing, Erase tool removed, `space.segments`
  stripped on save.
- **v1.20.0** — rooms may not overlap (strictly-inside clicks refused, overlapping contours
  refused at close; shared walls stay legal).
- **v1.21.x** — merge & split rooms (boolean geometry via polyclip-ts; merge = union collapses
  to one hole-free outline; split = wall-to-wall chord, bigger part keeps identity) + UX fixes.
- **v1.22.0** — presence ripples (badge/ripple/icon_ripple + colour/size, `isActiveState`),
  per-device icon size/rotation (`--dev-size`), one-click HACS badge. NOTE: sources were lost
  in a sandbox reset after deploy and restored from conversation patches — push immediately
  after building, never wait for verification.
- **v1.23.0** — doors & windows: "Opening" markup tool (snap onto derived walls, absolute
  coords), length in real cm, contact sensor + lock, animated leaf/arc, padlock badge, status
  card; lock never toggled from the plan.
- **v1.23.1** — openings UX: hover outline + grab cursor, drag along walls (angle normalized
  to [-90,90) so the hinge never flips), click=status / double-click=properties, thicker hit
  strip. Release v1.23.1 published on GitHub (covers v1.22.0–v1.23.1).
