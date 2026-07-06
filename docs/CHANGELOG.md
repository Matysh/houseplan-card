# Changelog

## v1.13.2 — 2026-07-05 (audit round 3: fixes + buildDevices test suite)
- **buildDevices finally has a direct unit-test suite** (12 tests on a fake hass):
  area filtering, curation incl. show-all, duplicate numbering, light-group folding
  and its `group_lights=false` inverse, marker claim/metadata/hidden/virtual/entity
  paths, custom icon rules + the deliberate lock override, device_class fallback,
  primary-entity priority, LQI/temperature extraction. Frontend tests: 28 → 41.
- Fix: `t()` now substitutes **every** occurrence of a placeholder (extracted as the
  pure `subst()` helper with a regression test).
- Fix: `_saveConfigNow` refreshes the local config on a rev conflict before
  rethrowing — a retry no longer hits the same conflict (the debounced path already
  did this; the immediate path did not).
- Fix: `pointercancel` on a device icon clears the long-press timer — no phantom
  info card after an aborted touch gesture.
- Repairs check moved to `repairs.py` and now **re-runs after every config save**,
  so a missing/restored plan file is reflected in the Repairs UI without a restart.
- Documented the deliberate `mdi:lock` override in `devices.ts` (wins over custom
  rules — a mislabeled lock icon is safety-relevant confusion).
- Test infra: `tsconfig.test.json` also compiles `devices.ts`/`types.ts`;
  `scripts/fix-test-build.mjs` appends `.js` to tsc's extensionless ESM imports.

## v1.13.1 — 2026-07-05 (distribution materials)
- **Demo GIF** in the README — recorded on a fully synthetic demo home (no real
  floor plans): live states, tap-to-toggle, drag, zoom, info card, space tabs.
- GitHub issue templates (bug report with diagnostics hint, feature request),
  `CONTRIBUTING.md` (5-minute setup, ground rules, architecture pointers),
  Discussions enabled.

## v1.13.0 — 2026-07-05 (universality: floors import, icon rules, tap actions)
- **Floors import wizard**: on first run, if the HA registry has floors, the card
  offers to create a space per floor — names prefilled, the (mandatory) plan image is
  requested step by step, any floor can be skipped; after the last one the room-markup
  mode opens automatically. No floors / old HA → the old single-dialog onboarding.
- **Editable icon rules**: the built-in "name pattern → MDI icon" rules are now data
  (`settings.icon_rules`) with an in-card editor (⬡ in the header): reorder, delete,
  add, live test field, invalid-regex highlighting, one-click reset to the bilingual
  (EN/RU) defaults. Fallback chain: rules → entity `device_class` → generic chip.
  Invalid user regexes are skipped safely.
- **Tap actions**: `tap_action` card option (`info` default | `more-info` | `toggle`)
  plus a per-device override in the device dialog. Safety model: a card-wide toggle
  only affects lights/switches/fans/humidifiers; covers/valves need a conscious
  per-device toggle; locks and alarm panels never toggle from the plan. A long press
  (600 ms) always opens the info card.
- **i18n dictionaries moved to JSON** (`src/i18n/{en,ru}.json`) — new languages can be
  contributed without touching TypeScript; tests enforce key and placeholder parity.
- Light-theme pass: hardcoded dark badge backgrounds replaced with theme variables.
- Tests: 28 frontend (was 15) — tap-action resolver incl. security cases, icon-rule
  compilation/overrides/device-class fallback, floors sorting, i18n parity.

## v1.12.0 — 2026-07-05 (Quality Scale: Bronze + selected Silver/Gold)
Backend brought to Integration Quality Scale patterns (custom integrations are not
formally graded; progress is tracked in `custom_components/houseplan/quality_scale.yaml`):

- **`entry.runtime_data`** (typed `HouseplanData`: both stores + the write lock) replaces
  `hass.data[DOMAIN]` for entry data; WS handlers resolve it per call and answer
  `not_ready` while no entry is loaded. New `store.py` common module.
- **test-before-setup**: storage readability is verified in `async_setup_entry`
  (`ConfigEntryNotReady` on failure). **Unloading** is supported; WS commands and
  static paths are global by design (documented).
- **`single_config_entry: true`** in the manifest replaces the manual flow check.
- **Store versioning**: stores now carry `minor_version` and a migration hook
  (`HouseplanStore._async_migrate_func`) — schema changes get a single upgrade path.
- **Diagnostics** (`diagnostics.py`): redacted dump (options, rev, per-space stats,
  markers with personal fields redacted, layout size).
- **Repairs**: a missing plan file raises a repair issue (`broken_plan`) with
  en/ru translations; issues clear automatically when resolved.
- **System health** (`system_health.py`): rev, spaces/rooms/markers/layout counters.
- **Uninstall cleanup**: `async_remove_entry` deletes our Lovelace resource entry.
- **Tests**: config flow, WS API (layout ops, rev conflict, not_ready, plan upload
  validation), HTTP upload (ok/bad ext/traversal) on `pytest-homeassistant-custom-component`
  — run in CI on Python 3.13; pure validation tests still run anywhere.
- `strings.json` added; translations updated.

## v1.11.2 — 2026-07-05 (device dialog: usable Description height)
- The Description textarea in the device edit dialog was squeezed to ~2 lines by
  the dialog body's flex column. Now `min-height: 92px`, `flex-shrink: 0`, `rows=4`;
  still resizable vertically.

## v1.11.1 — 2026-07-05 (brand images shipped inside the integration)
- Brand icon and logo (256/512, transparent background) now live in
  `custom_components/houseplan/brand/` — the native mechanism for custom
  integrations since Home Assistant 2026.3 (served via `/api/brands/...`,
  local images take priority over the brands CDN). The former root `brand/`
  directory is gone, and no home-assistant/brands PR is needed (theirs bot
  closes such PRs as obsolete).

## v1.11.0 — 2026-07-05 (full English translation + UI localization)
- **UI localization (en/ru)**: every card string moved to `src/i18n.ts` dictionaries.
  The language follows the HA user profile (`hass.locale`) automatically; a new
  `language: en|ru` card option forces it. The GUI editor got the option and its own
  localized labels. Generated device names (light group, unnamed, virtual device)
  are localized via a `loc` callback in `BuildCtx`.
- **English-only codebase**: all comments, docstrings, section banners, JSDoc, test
  names, backend WS/HTTP error messages and log lines translated to English.
  Russian remains only where it is functional or content: the `ru` i18n dictionary,
  `translations/ru.json` (config flow), `iconFor` regex patterns matching Russian
  device names (with their test fixtures), and the Russian documentation copy.
- **Docs**: README is now English-first with a full Russian copy in `README.ru.md`;
  `docs/ARCHITECTURE.md`, `DEVELOPMENT.md`, `ROADMAP.md` and the entire CHANGELOG
  history translated to English. `translations/en.json` had Russian strings — fixed.
- Removed obsolete `RELEASE_NOTES_v1.9.3.md` and `scripts_publish.sh` (publication
  is done; the repo lives at github.com/Matysh/houseplan-card).

## v1.10.0 — 2026-07-05 (audit: write races, XSS, modularity)
**Backend**
- **Write race eliminated**: all load→modify→save cycles (`layout/set|update|delete`,
  `config/set`) are serialized by a shared `asyncio.Lock` — concurrent WS calls no longer lose
  changes, and the `expected_rev` check became atomic.
- New WS command `houseplan/layout/delete` — cleans up a position when a marker is deleted
  (previously orphans accumulated in `.storage/houseplan.layout`).
- Removed the dead WS command `houseplan/file/set` — files are uploaded over HTTP only
  (`/api/houseplan/upload`), as the card already did.
- HTTP upload: the 25 MB limit is enforced WHILE reading the multipart stream (abort at the limit),
  not after reading the whole file into memory; file `stat()` moved into the executor.
- `request.app[KEY_HASS]` instead of the deprecated `request.app["hass"]` (with a fallback for older HA).

**Frontend**
- **The god-component was broken up**: `houseplan-card.ts` 3023 → ~1990 lines.
  Styles → `styles.ts`; types → `types.ts`; building devices from the HA registries
  (curation, light groups, markers, LQI/temperature) → `devices.ts` (pure functions).
- **Last-writer-wins in the layout eliminated**: `_saveMarker` writes the position pointwise
  (`layout/update`), not the whole layout (`layout/set`) — it no longer wipes positions from other
  windows (the regression class of the v1.4.4 incident). Rebinding/deletion clean up the old position.
- **XSS closed**: marker `link` and `pdfs[].url` go through `safeUrl()` (only http(s)
  and relative paths; `javascript:`/`data:` are rejected). +12 tests.
- File uploads via `hass.fetchWithAuth` (auto-refresh of an expired token),
  fallback to the raw token.
- **The dacha hardcode removed from the GUI editor**: the "default space" list is built
  from the server config (WS `config/get`), not the baked-in f1/f2/yard.
- `rules.ts`: removed the dead export `GROUP_TITLES`; the `iconFor` regexes are precompiled.
- A single `_errText()` in all error handlers (never "[object Object]").

## v1.9.3 — 2026-07-05 (audit + refactoring + tests)
- The pure functions `fitView` (viewport contain rectangle) and `declump` (icon push-apart)
  were extracted from the card into `logic.ts` — covered by unit tests (was 9 → now 14 tests).
- `_lqiFor` and `_roomLqi` now use the shared `averageLqi` (duplicate averaging removed).
- Removed dead code left after dropping the separate edit mode: the `_edit` field (written but
  never read), the methods `_renderEditbar` and `_applyXY` (never called).
- No behavior change — only structure and test coverage. Verified: tsc, build,
  14 frontend tests + 10 backend tests green, headless smoke test (render/zoom/devices/declump) clean.

## v1.9.2 — 2026-07-05 (grid twice as fine)
- The markup/snapping grid step was halved: `GRID_N` 120 → 240. Device positions and room
  outlines are NOT recomputed and do not shift: coordinates are stored as normalized fractions and snap
  to grid nodes, and the old nodes (multiples of 1/120) are an exact subset of the new ones (multiples of 1/240).
  Verified on the live layout (65 positions — all already on the new grid). Dragging now
  allows more precise positioning.

## v1.9.1 — 2026-07-05 (Zigbee signal: reading from the attribute + ZHA)
- The signal level is now taken not only from the dedicated `*_linkquality` sensor (Z2M), but also:
  from `*_lqi` sensors (ZHA), and from the `linkquality`/`lqi` ATTRIBUTE on any entity of the device.
  This covers devices whose dedicated signal sensor is disabled but the value is available in an attribute.
- NOTE: if a device's `*_linkquality` sensor is disabled (disabled_by=integration) AND the value
  is not published anywhere as an attribute — the signal cannot be shown; enable the sensor in the HA registry.

## v1.9.0 — 2026-07-05 (UX: always-on dragging, declumping, show all, responsive)
- **Icon dragging is available at all times** — the separate "edit mode" is gone (the ✥ button removed).
  Clicking an icon opens the device card (metadata editing — via the "Edit" button
  inside it), dragging works at any moment. `_pointerDown` no longer requires `_edit`.
- **Icons no longer clump together** (`_declump`): after the automatic grid layout a push-apart pass
  runs within the room so that icons do not overlap each other.
- **Positions are pinned when a room is saved**: the auto-positions of the area's devices are written
  into the layout once, so icons do not get reshuffled when the order in the HA registry changes.
- **Duplicates are numbered instead of hidden**: devices with the same "name|area" get a suffix
  (" 2", " 3"…) instead of silently disappearing.
- **The 👁 "Show all devices" button** in the header: temporarily disables curation and shows
  all devices of the area (bridges, service records, duplicates) — in case a needed one is hidden. The `show_all`
  flag in the config settings.
- **Markup continuation hint**: after saving a room a toast shows the room counter and
  suggests outlining the next one or leaving markup mode.
- **Responsive header**: the toolbar wraps and shrinks on narrow screens (media query ≤620px).

## v1.8.4 — 2026-07-04 (onboarding: required fields + user guidance)
- Initial setup brought to the target scenario: install → space dialog →
  rooms → auto device icons.
- **The background is mandatory** when creating a space: "Save" stays disabled without an uploaded
  plan (previously only the name was required — an empty space could be created).
- **The room area is mandatory**, with an explicit escape hatch: the main "Save" requires binding to an HA area;
  for decorative rooms without devices (hall, sauna) there is a separate "No area" button
  (only a name is needed). Previously saving was possible with "name OR area".
- **User guidance:** with an empty server config the space dialog opens
  automatically; after the first space is added the card enters room markup mode
  by itself with an "outline the rooms" hint. 
- When a room with an area is saved, the icons of that area's devices are auto-placed inside the outline
  (the curated set: without bridges/service records/duplicates/individual lamps from groups), and a toast shows
  how many devices were added.

## v1.8.3 — 2026-07-04 (instant start: config cache, data in the background)
- Icons and the plan appeared with a delay — the card waited for the server response (WS `config/get`
  + connection warm-up retries), and until then the space model was empty.
- A "stale-while-revalidate" cache was introduced: a snapshot of the server config + rev + layout
  is saved in `localStorage['houseplan_card_cfg_v1']`. In `setConfig` (synchronously, before
  hass arrives) it is restored — the plan and icons are drawn immediately from the cache (verified: setConfig
  populates the model in 0.2 ms without the server), while fresh data loads in the background and updates the
  card. Live states/temperatures/signal come in as hass warms up.
- The cache is refreshed after every successful load, live resync and icon position save,
  so on the next open the current snapshot is visible. When the server is unavailable the
  last known plan is shown instead of the empty onboarding.

## v1.8.2 — 2026-07-04 (vector-crisp zoom via viewBox + full-width stage)
- Zoom moved from CSS `transform: scale()` to manipulating the SVG `viewBox`. Previously the layer
  was rasterized and then scaled — everything "blurred" when zooming in. Now the browser
  redraws the vector at the target resolution: icons, room labels, lines, hatching and the
  vector background remain crisp at any scale (verified at 274%).
- The icon layer (HTML) is positioned and scaled by the same `view`, not a global
  transform — the icons are crisp and grow together with the plan.
- The stage now occupies the full viewport width (a "contain" model by the stage aspect): when
  zoomed in the content fills the width without black bars on the sides. Fully zoomed out the
  whole plan is visible (both width and height), the margins around it are filled with the card
  background, not black.
- All coordinate math (markup click `_svgPoint`, icon drag, pan, pinch) was rewritten
  in unified `view` coordinates — editing is correct at any zoom. A ResizeObserver on the stage
  recomputes the `view` when dimensions change (sidebar, rotation). Pan/zoom are constrained to `fit`.

## v1.8.1 — 2026-07-04 (fit-to-viewport + per-space zoom persistence)
- Zooming out to the full view: the lower zoom limit = 100% coincides with the fully
  visible plan. `.stage` is now constrained by the viewport height
  (`width:min(100%, calc((100dvh − 118px) × aspect))`, `max-width:100%`, centering),
  so on reset/zoom-out the whole layout is visible both in width and height without clipping.
- The zoom level is remembered per space and locally per device
  (`localStorage['houseplan_card_zoom_v1']`, `_zoomBySpace`): switching floors
  restores each floor's zoom; on return the pan is centered and constrained.
- Verified on live HA: f1→196%, f2→140%, the yard untouched — after switching around the
  values are restored; reset gives 100% and the full plan (874≤992 px in height).


## v1.8.0 — 2026-07-04 (plan zooming)
- Zoom and pan of the layout: mouse wheel (towards the cursor), two-finger pinch on a touch screen,
  one-finger background drag when zoomed in, −/reset/+ buttons in the toolbar, a zoom badge.
- Implemented via a CSS transform on `.zoomwrap` (translate+scale); the coordinate math
  (markup clicks, icon drag, tooltips) was recomputed with zoom/pan in mind — editing
  works when zoomed in too. Pan is constrained so the content always covers the stage. Zoom 100–800%.
- `.stage`: overflow hidden + touch-action none (custom gestures instead of the browser's).

## v1.7.4 — 2026-07-04 (PDF over HTTP instead of WebSocket)
- THE ROOT CAUSE of being unable to upload a PDF: the file was sent as base64 in a single WebSocket
  message, and WS has a message-size limit — a real manual (>2–3 MB) exceeded it, the connection dropped
  ("Connection lost"), which both failed the upload and closed the dialog (WS drop → reconnect
  → re-render). Confirmed by test: 1 MB over WS is fine, 3 MB → Connection lost.
- Manual files are now uploaded through the HTTP endpoint `POST /api/houseplan/upload` (multipart,
  HomeAssistantView, requires_auth, admin_only check) — like media in HA itself. Verified:
  3 MB (182 ms) and 10 MB (446 ms) upload without a hitch.
- Readable errors everywhere (`_errText`): no more "[object Object]"; clear texts for
  too_large / bad_ext / unauthorized.
- The WS command houseplan/file/set is kept for compatibility, but the frontend uses HTTP.


## v1.7.3 — 2026-07-04 (device dialog fixes)
- PDF manuals failed to upload: the manual base64 (`btoa(String.fromCharCode(...subarray))`) crashed
  on real files (RangeError when spreading large arrays), and when the dialog was closed during an
  await it threw a null access. Replaced with `FileReader.readAsDataURL` (reliable for any size);
  the results are accumulated and added only if the dialog is still open (no exceptions).
- The device/space/room edit dialog closed on an outside click and "by itself"
  (an accidental click on the background overlay, including after closing the system file picker). Removed
  background-click closing for editor dialogs — only explicit Cancel/Save/Esc.
  The info card (read-only) still closes on an outside click.
- Verified on live HA: PDFs attach; a background click and dialog data refresh do not close the dialog.

## v1.7.2 — 2026-07-04 (fix for the mobile "configuration error")
- THE CAUSE: the card was hooked up only via `add_extra_js_url` (extra_module_url), whose loading the
  frontend does NOT wait for — on a cold start of the mobile app the dashboard was drawn
  before the element was registered → "configuration error". (All working HACS cards are Lovelace resources.)
- FIX 1: the integration registers the card as a **Lovelace resource** (module) — the frontend waits for
  those before rendering. Idempotent (updates the URL on a version change, no duplicates); a fallback to
  extra_module_url for Lovelace YAML mode. `_register_lovelace_resource` in __init__.py.
- FIX 2: `_loadFromServer` retries (up to 8 attempts on hass updates) — if hass arrived before
  WS readiness, the card does not get stuck on the onboarding but waits for the config.
- Verified: the houseplan-card.js resource is registered, extra_module_url is empty (a single clean
  module), the card renders the plan on a fresh tab without the error.

## v1.7.0 — 2026-07-04 (audit + refactoring + tests)
- Removed the sample house baked into the bundle (the dacha, ~245 KB of base64 plans + ROOMS/FLOOR_*): the bundle
  went 293 KB → 83 KB. A fresh install shows the "Add a space" onboarding, not someone else's house.
- Removed the legacy→server migration code (the dacha is already on the server config) and the dead
  device_overrides/virtual_devices paths (replaced by markers[]).
- Pure logic extracted into src/logic.ts (lqiColor, snapToGrid, segKey, pointInPolygon,
  markerIdForBinding, averageLqi) — covered by unit tests (node:test, 9 tests + iconFor).
- Backend: validation/sanitizers extracted into validation.py (no HA imports) — pytest, 10 tests.
- SECURITY: a test revealed that the file/marker name sanitizer preserved leading dots
  (a directory traversal risk via ".."); leading-dot stripping added, empty → misc/file.
- Fixed real bugs previously masked by the truncated rules.ts: DOMAIN_PRIORITY was
  cut short (breaking the more-info entity selection); _defaultPositions crashed on polygon rooms
  (now bbox). tsc --noEmit added to the build and CI — strict typing passes.
- Removed the junk duplicates src/data/{editor,rules}.ts; versions synchronized (the manifest was stuck at 1.4.0).
- CI: added typecheck, frontend and backend unit tests.

## v1.6.2 — 2026-07-04
- The "Room" field in the device dialog is now for ALL icons (not only virtual ones):
  for bound ones it "overrides the placement" (by default, the device's area); changing the
  room moves the icon to its center. Stored in marker.space/area and wins over the HA area.
- An "Edit" button was added to the info card — it opens the device edit dialog.

## v1.6.0 — 2026-07-04 (Phase 3: device editor)
- The "markers" model (config.markers[]): a hybrid — auto-discovered HA devices appear by themselves, markers
  edit/rebind/augment them and describe manual/virtual icons. The marker id
  preserves the position (device→device_id, entity→lg_<eid>, virtual→v_<rand>).
- Clicking an icon: normal mode → the info card (name, model, state, link, description,
  PDF manuals, an "Open in HA" button); edit mode → the edit dialog.
- The device dialog: name, binding (a picker of all HA+Z2M devices/groups+helpers with a text
  filter, minus already-placed ones and duplicates by name|area, plus "Virtual device"), MDI icon
  (ha-icon-picker), model, link, description, manual file attachment (PDF to the server),
  room (for virtual ones), Remove/Cancel/Save.
- Toolbar: a "+" button (tooltip "Add device") — an empty dialog.
- Backend: MARKER_SCHEMA in the config; WS houseplan/file/set (files in /config/houseplan/files/,
  ≤25 MB, served from /houseplan_files/files/); the files static path registered.
- Virtual icons are now draggable and positioned like normal ones (layout by id).

## v1.6.1 — 2026-07-04
- The binding picker hides device duplicates by "name|area" (Tuya/LocalTuya), same as the dedup on the plan.

## v1.5.1 — 2026-07-04 (space management)
- A pencil icon to the right of each space name in the top toolbar + a "+" button
  (only with a server config).
- The space dialog: a "Name" field, a preview of the current background + "Upload/Replace…"
  (SVG/PNG/JPG/WebP, base64 → houseplan/plan/set, the aspect ratio is detected from the file),
  Delete / Cancel / Save buttons. Creating an empty space and deletion (together with all its
  rooms and markup, with a confirmation). Saved via config/set with a revision.

## v1.5.0 — 2026-07-04 (light groups = entities)
- Lamps replaced by group entities: HA light groups (platform=group, area from the entity registry)
  and Z2M groups (device model=Group) are rendered with the mdi:lightbulb-group icon; a click → the group's
  more-info (controlling the whole group and its members natively in HA).
- Individual lamps are hidden in rooms that have a light group (settings.group_lights=false
  brings back the per-lamp mode).
- The old visual grouping and the custom member menu were removed (code simplification).
- The positions of the old groups (grp_<area>) were migrated to the new ids (lg_<entity_id>) in the dacha layout.

## v1.4.4 — 2026-07-04 (CRITICAL fix: configuration race)
- INCIDENT: the config was saved wholesale on a last-writer-wins basis — an open client with a
  stale copy wiped other clients' edits (the first iteration of the user's markup was lost).
- Fix: optimistic locking — the config carries a `rev`; `config/set` accepts `expected_rev`
  and returns a `conflict` error on mismatch; the client re-reads the config.
- Live synchronization: `config/set` broadcasts a `houseplan_config_updated` event; all open
  cards are subscribed and re-read the config automatically (windows no longer diverge).
- Positions during drag are saved pointwise via `layout/update` (dirty set), not a full
  `layout/set` — the layout is also no longer wiped between windows.
- A config backup before deployment: .storage/houseplan.config.bak-*.

## v1.4.3 — 2026-07-04
- Device icons snap to the same grid as the markup (the icon center = a node, snapping
  on drag and on X/Y input). The existing 57 positions in the dacha DB were snapped to the nodes.

## v1.4.2 — 2026-07-04 (markup grid)
- The grid step was halved: GRID_N 60 → 120 (step 8.33 render units ≈ 0.83% of the plan width).
- Grid points are rendered ON TOP of the plan and rooms (the grid-rect was moved from below the plan
  into the top markup layer); the points are higher-contrast (r=0.14g, outline).
- Dacha data: the boundaries of all 13 rooms were snapped to grid nodes (edge snapping, shifts ≤ half a step;
  only the instance config was edited via houseplan/config/set, the code was untouched).
- Card cache: the module URL ?v= is taken from const.VERSION — when updating the frontend, bump
  const.py and restart HA, otherwise browsers keep the old module in memory cache.

## v1.4.1 — 2026-07-04 (markup UX)
- Esc / Ctrl+Z while drawing remove the last point (and its line, if it was added
  by that step; reused walls belonging to others are untouched).
- The editing panel (markup and layout editing) was moved to the top under the card header
  and pinned together with it (a shared sticky container .hdr).
- Closing the outline automatically opens the "New room" modal dialog: the display
  name, a dropdown of ONLY the free HA areas (not assigned to any room of the config),
  Save/Cancel. Cancel (or Esc) removes the closing point — the outline can be continued.
  Choosing an area with an empty name fills in the area's name.

## v1.4.0 — 2026-07-04 (Phase 2: room markup editor)
- The "Markup" mode in the card (the mdi:vector-square-edit button, only with a server config):
  a grid of points (60 nodes across the width), lines drawn by pairs of clicks with node snapping, a polyline preview.
- A closed outline (a click on the first point) activates "Save": choosing an HA area from a
  dropdown + a name; the room is saved as a polygon (poly, normalized vertices).
- Tools: Add (drawing), Erase line (a click on a line), Delete room
  (a click inside + confirm). The "wall" lines are stored in space.segments and reused by
  neighboring rooms (shared walls — via clicks on existing nodes).
- Room rendering: polygons on par with rectangles (hover, click into the area, LQI tooltip,
  the label at the centroid); in markup mode the outlines and names of all rooms are visible.
- Backend: ROOM_SCHEMA accepts poly (≥3 vertices) or x/y/w/h; SPACE_SCHEMA — segments.

## v1.3.0 — 2026-07-04 (Phase 1: server-side configuration)
- The `houseplan.config` Store: spaces (plan, aspect, view_box, rooms), device_overrides
  (hidden/icon/name), virtual_devices, settings (exclude_integrations, group_lights).
- WS: `houseplan/config/get|set`, `houseplan/plan/set` (plan file upload as base64 →
  `<config>/houseplan/plans/`, served through /houseplan_files/plans/).
- The card: a resolve model — the server config (coordinates NORMALIZED 0..1, render 1000×1000/aspect)
  or the legacy bundle (canvas 1489×1053). Layout v2: {device_id: {s, x, y}} normalized.
- The "To server" button in edit mode — a one-click migration of the legacy config (plans, rooms,
  view_box, layout). Performed at the dacha: .storage/houseplan.config + plans/f1.svg,f2.svg.
- Read-side support for device overrides and virtual devices (the management UI — phases 3–4).

## v1.2.2 — 2026-07-04
- The card toolbar (floor tabs) pins under the HA header while scrolling
  (`position: sticky; top: var(--header-height)`; ha-card overflow: visible).
- Incident: an intermediate build on the unstable mount produced a broken bundle that crashed the
  dashboard rendering; the rule "build only in /tmp + md5 control" was locked into DEVELOPMENT.md.

## v1.2.1 — 2026-07-04
- Icons no longer enlarge on hover/drag (transform: scale removed).

## v1.2.0 — 2026-07-03
- Room boundaries snapped to the walls of the vector plan.
- Zigbee LQI: the value under the icon, the room average in the tooltip, a red→green gradient,
  the show_signal option.
- `mdi:lock` for any devices with a lock.* entity (TTLock).
- The hallway switch: the device's area in the HA registry was fixed (it was in detskaia_elina).

## v1.1.0 — 2026-07-03
- Vector backgrounds (SVG from REMPLANNER), automatic scale/offset alignment via raster correlation.
- Icon size as a % of the plan width (container queries, default 2.5%).

## v1.0.1 — 2026-07-03
- fix: nested SVG fragments via lit svg`` (the background/rooms were not rendered).
- fix: the version taken from const instead of a blocking manifest.json read in the event loop.

## v1.0.0 — 2026-07-03
- First release: the Lovelace card (TS+Lit, no token, driven by hass) + the houseplan integration
  (WS layout storage, JS serving). The prototype's model carried over: curation, lamp groups,
  iconFor, temperature, more-info, area navigation, drag layout.
