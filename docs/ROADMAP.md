# Roadmap: a universal, flexible floor-plan component

Goal: a **proper Home Assistant component** built to HA developer-docs patterns —
not a hardcoded feature. Universal (any house, any language, any plan format),
flexible (options instead of assumptions), and measured against the official
**Integration Quality Scale** even though custom integrations are not formally graded
(see `docs/PRODUCT.md` for the market rationale).

Phases 0–6 of the original plan (server-side config, room markup editor, device
management, virtual devices, publication) are **done** — see CHANGELOG v1.3.0–v1.11.2.
This roadmap replaces them.

## Phase 7 — Quality Scale: Bronze-complete (structural correctness)

Track progress in `custom_components/houseplan/quality_scale.yaml` (done/exempt + comment).

- [x] `runtime-data`: move `hass.data[DOMAIN]` (stores, entry, write lock) to typed
  `entry.runtime_data` (`type HouseplanConfigEntry = ConfigEntry[HouseplanData]`).
  Keep WS command registration in `async_setup` (commands must survive entry reloads).
- [x] `config-entry-unloading` (Silver, do it now): real `async_unload_entry` — unregister
  update listeners via `entry.async_on_unload`; document what stays (static paths cannot
  be unregistered — exempt comment).
- [x] `test-before-setup`: verify storage is loadable/writable in `async_setup_entry`,
  raise `ConfigEntryNotReady` on failure.
- [x] `unique-config-entry`: replace the manual `_async_current_entries()` check with
  `single_config_entry: true` in manifest.
- [x] `config-flow-test-coverage` + backend tests for websocket_api (pytest-homeassistant-custom-component:
  conflict/rev, admin_only enforcement, layout point ops, upload limits).
- [x] Storage versioning: `Store(minor_version=...)` + `_async_migrate_func` skeleton **now**,
  before the config schema evolves further (Bronze-adjacent, cheap while schema is stable).
- [x] `quality_scale.yaml` with honest exempt list (no entities ⇒ entity rules N/A, no polling, no deps).

## Phase 8 — Quality Scale: Silver + selected Gold

- [ ] `test-coverage` ≥95% backend; frontend: extract remaining pure logic (view math,
  marker resolution) into `logic.ts`/`devices.ts` and cover with node:test.
- [x] `diagnostics.py`: config + layout dump with `async_redact_data` (redact names/links/PDF paths).
- [ ] `reconfiguration-flow` + richer **options flow**: admin_only, curation defaults
  (exclude domains — UI editable, replacing the hardcoded EXCLUDED_DOMAINS fallback),
  LQI thresholds, group_lights default.
- [ ] `repair-issues`: broken plan file references, orphaned layout entries, storage
  migration failures → Repairs UI instead of silent logs.
- [ ] `system_health.py`: config rev, spaces/markers count, storage sizes.
- [ ] `exception-translations` + `icon-translations` where applicable.
- [ ] Frontend resource registration: adopt the community-consensus embedded-card pattern
  end-to-end (we already do StaticPathConfig + storage-mode resource + `?v=` busting;
  add resource cleanup on removal and document YAML-mode fallback).

## Phase 9 — Universality & flexibility (product depth)

- [ ] **Areas/floors registry integration**: import HA floors as spaces, suggest area
  bindings from the registry, sync names (HA is moving this way — native Areas/Home
  dashboard; riding the registry is our moat).
- [ ] **Curation without hardcode**: icon rules (`iconFor`) become data — user-editable
  mapping (regex/domain/device_class → mdi icon) stored in config, shipping EN+RU
  defaults; drop dacha-specific patterns from code.
- [ ] **Click actions** per device/domain: toggle / more-info / navigate / custom service
  call (configurable, like standard card `tap_action`).
- [ ] **Theming**: respect light themes (currently dark-leaning), use HA theme variables
  everywhere, optional per-space background color.
- [ ] Multi-instance question: keep single-instance (one house) but support **multiple
  cards** with different default spaces (already works) — document as a decision.
- [ ] Plan formats: keep SVG/PNG/JPG/WebP; add max dimensions guidance; optional
  auto-downscale on upload.
- [ ] More locales: extract i18n dictionaries to JSON so contributors can add languages
  without touching TS.

## Phase 10 — Community & distribution

- [ ] hacs/default PR #8995 through moderation (expect drafting for fixes).
- [ ] Demo GIF/video for README (the single biggest driver of adoption for dashboard cards).
- [ ] Forum post in the Floorplan category + Reddit r/homeassistant showcase once
  the demo assets exist.
- [ ] GitHub: issue templates, discussions on, CONTRIBUTING.md (build/test in 5 minutes).
- [ ] Semantic versioning discipline; keep release notes user-facing (they show in HACS).

## Phase 11 — UX modes redesign ✅ DONE (v1.25.0–v1.28.0, see docs/UX-MODES.md)

Shipped: the three-tab interaction model (View / Plan / Devices, v1.25.0),
state-reflecting icons + value display (v1.26.0), RGB light colors + alarm pulse
(v1.27.0), sub-area rooms (v1.28.0). Remaining backlog from issue #3: music
notes for players, directional TV ripples (not planned).

## Explicit non-goals (for now)

- 3D plans (.glb) — separate market (3Dash), heavy dependencies.
- Editing the plan image itself (walls/furniture drawing à la easy-floorplan) — we
  consume existing plan images; the markup editor stays about *rooms/zones*, not drawing.
- Cloud anything. Config stays in `.storage`, local-first.
