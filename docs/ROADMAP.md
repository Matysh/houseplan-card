# Roadmap: from a "dacha map" to a publishable universal integration

Goal: publish to HACS (first as a custom repository, then a PR into default) a universal
"interactive house plan" integration: custom plans per space, manual room markup,
semi-automatic device placement, hiding/renaming/changing icons, virtual
devices. No hardcoding of a specific house in the code.

## Principles (locked in)
- We write a proper full component following HA dev docs patterns, not a hardcoded feature.
- All data of a specific house is **instance configuration** (server-side Store),
  not code/bundle. The current dacha data will become the first migrated instance.
- Document everything immediately in docs/ (session context gets lost).
- Storage versioning (Store minor_version + async_migrate) from day one.

## Phase 0 — Publication hygiene (quick, no new features)
- [x] hacs.json, manifest with the required keys, custom_components/* structure
- [x] CI: hacs/action + hassfest (workflow validate.yml) — added, verify on GitHub
- [x] brand/icon.png
- [ ] Public GitHub repository: description, topics, issues on; first Release v1.2.x
- [ ] README EN (primary) + README.ru.md; screenshots/GIF (mandatory for the HACS storefront)
- [ ] Replace codeowners/documentation/issue_tracker with real URLs after the repo is created

## Phase 1 — Server-side config (decoupling from the dacha) ← ✅ DONE in v1.3.0 (except removing the bundle data — kept as a fallback until phase 2)
New store `houseplan.config` (Store v1):
```json
{ "spaces": [ { "id": "f1", "title": "1st floor", "plan": {"media_id": "...", "type": "svg"},
    "view_box": [x,y,w,h], "rooms": [{"id","name","area_id","x","y","w","h"}] } ],
  "device_overrides": { "<device_id>": {"hidden":bool,"icon":str,"name":str} },
  "virtual_devices": [ {"id","space","name","icon","x","y","note"?, "entity_id"?} ],
  "settings": {"exclude_integrations": [...], "group_lights": bool, ...} }
```
- WS API v2: `houseplan/config/get|set`, `houseplan/plan/upload` (plan file → 
  `<config>/houseplan/` via the process executor, served through a static path), layout as today.
- The card: when a server config exists it uses it; the dacha bundle data becomes a
  **fallback example** and is then removed (a migration script will push it into the Store).
- Coordinate units: normalized (0..1 of the plan) for new configs — independence from the
  source resolution; the dacha migration will convert 1489×1053 → normalized.

## Phase 2 — Markup editor in the card ← ✅ CORE DONE in v1.4.0 (remaining: plan upload from the UI, view_box editing, editing existing rooms)
- A "Setup" mode (separate from drag layout): drawing/resizing room rectangles
  on top of the plan, binding to an area (ha-area-picker selector), viewBox (frame) editing.
- Later: polygonal rooms (SVG path), plan rotations.
- Plan upload from the UI (file upload → WS) + picking existing media.

## Phase 3 — Device management ← ✅ DONE in v1.6.x (hiding, icon, name, model, link, description, PDF, rebinding, "+", virtual)
- A device panel in setup mode: a list of unplaced devices (with filters), drag from the panel
  onto the plan; auto-layout "grid over the room" by button.
- Per-device overrides: hide, custom icon (ha-icon-picker), custom name. Stored in config.
- Configurable curation: integration/domain exclusions in the options flow instead of hardcode.

## Phase 4 — Virtual devices ← ✅ basics in v1.6.x (CRUD of virtual markers in the shared dialog; further note/icon polish as needed)
- CRUD of virtual markers (name, icon, coordinates, note; optionally a link to an
  entity/URL): septic tank, valve, a meter without a sensor, etc. Rendered like normal icons,
  click → a card with the note or more-info of the bound entity.

## Phase 5 — UX/feature polish
- Configurable click actions: toggle for lights/outlets, long-press → more-info.
- Live-indication tuning (theme-aware colors, badges), light theme.
- Tooltips on touch devices (long-press), accessibility (keyboard, aria).
- LQI option: "bad signal" threshold, hiding the labels on non-zigbee instances.

## Phase 6 — Quality and publication
- Tests: pytest (config_flow, websocket_api, Store migrations) + hassfest/hacs action in CI;
  frontend: vitest for rules/geometry utilities.
- Typing: strict TS interfaces for hass (custom-card-helpers or our own), mypy for python.
- Translations for integration+card: en + ru (translations/, card string localization).
- Quality scale bronze → silver checklist; PR into hacs/default; optionally a PR into
  home-assistant/brands (the brand/ in the repo suffices for now).

## Open questions
- Publication name: "House Plan Card"? the `houseplan` domain is not taken in HACS default — verify.
- MIT license (package.json is already MIT) — add a LICENSE file.
- Plan formats: SVG preferred (vector, size), PNG support is mandatory.
