# House Plan architecture

Updated: 2026-07-04 (v1.2.2). The repository = a HACS integration (category **Integration**)
that contains both the backend (`custom_components/houseplan`) and the Lovelace card (`src/` → `dist/`).

## Layout

```
houseplan-card/
├─ src/                          # card sources (TypeScript + Lit 3)
│  ├─ houseplan-card.ts          # the card: rendering, states, drag, tooltip, sticky header
│  ├─ editor.ts                  # GUI config editor (ha-form + selectors)
│  ├─ rules.ts                   # icon rules (iconFor), curation, groups, domain priority
│  └─ data/
│     ├─ house.ts                # geometry: ROOMS (rooms→area), FLOOR_VB (viewBox), names
│     └─ backgrounds.ts          # VECTOR plans (SVG base64) + FLOOR_BG_RECT (positioning)
├─ dist/houseplan-card.js        # build (rollup+terser), ~290 KB, plans embedded
├─ custom_components/houseplan/  # the HA integration
│  ├─ __init__.py                # setup: Store, WS commands, JS serving (add_extra_js_url)
│  ├─ websocket_api.py           # houseplan/layout/get|set|update
│  ├─ config_flow.py             # single entry; admin_only option (editing restricted to admins)
│  ├─ const.py                   # DOMAIN, STORAGE_KEY, VERSION, FRONTEND_URL
│  └─ frontend/houseplan-card.js # copy of dist, served as /houseplan_files/houseplan-card.js
├─ hacs.json                     # HACS manifest
└─ docs/                         # this documentation
```

## Key decisions

1. **One repository — integration + card.** The integration serves the JS
   (`async_register_static_paths`) and registers it as a **Lovelace resource** (module) —
   the frontend waits for resources before rendering, so the card also works on a cold start
   of the mobile app (unlike `add_extra_js_url`, which remains a fallback for
   YAML mode). The user does not need to add the resource manually.
2. **Icon layout lives on the server.** `helpers.storage.Store(1, "houseplan.layout")` →
   `.storage/houseplan.layout`. The card reads/writes via `hass.callWS`
   (`houseplan/layout/get|set|update`). Fallback — localStorage (when the integration is absent).
3. **No token.** Everything comes from the frontend `hass` object: `hass.states` (reactive),
   `hass.devices/entities/areas` (registries). No direct WS connections.
4. **Reactivity.** Every state change in HA leads to set hass → re-render.
   Temperatures/LQI/on-off are live by definition (verified by substituting state).

## Coordinate system

- Base space: **1489×1053** ("pixels" of the old PNG render, 1 unit = 1 px).
  All rooms, icon positions and floor viewBoxes live in it. DO NOT change without a layout migration.
- Vector plans are inserted as `<image href=svg>` into the `FLOOR_BG_RECT` rectangle:
  - f1: scale **0.647**, offset **(490, 27)** → rect [490, 27, 774.2, 949.3]
  - f2: scale **0.896**, offset **(351, 21)** → rect [351, 21, 1048.4, 961.4]
  - computed via raster correlation (cv2.matchTemplate on binarized darkness maps) of the
    SVG render against the reference PNG; accuracy ~1 px. The scripts are reproducible (docs/DEVELOPMENT.md).
- Rooms (`ROOMS`) are snapped to the inner faces of walls (semi-automatic: search for the nearest
  "dark line" along the profile + manual fine-tuning against overlay renders).

## Card data model (runtime)

`DevItem`: id (device_id), name, model, area, floor, icon, entities[], primary (the entity used for
more-info by domain priority), temp, members[] (light group), link/linkPrimary (Z2M group).

Built from the registries (`_buildDevices`), rules carried over 1-to-1 from the prototype:
- only devices with an area from the room list are shown;
- hidden: entry_type=service, integrations from EXCLUDED_DOMAINS, model=Group, scenes, bridges,
  myheat sub-devices, duplicates by "name|area";
- **a device with a `lock.*` entity always gets `mdi:lock`** (TTLock locks in the registry
  are named "Dom"/"Terrasa"/"Kladovka" [House/Terrace/Storeroom] — unrecognizable by name);
- lamps (mdi:lightbulb) with ≥2 in a room collapse into a group `mdi:lightbulb-group`
  (click → menu: the whole group + individual lamps).

## Live data

- Temperature: an entity with device_class=temperature / °C / `_temperature$` → label on the right.
- LQI (zigbee): the average over `*_linkquality` entities → label under the icon; color via
  `lqiColor()`: ≤40 red → ≥180 green (hsl gradient). The room average is shown in the room tooltip.
- Icon state classes: on (yellow), open (orange: cover/valve/lock/binary_sensor
  of problem classes), unavail (transparency).

## Sizes

`icon_size` in the config = **% of the visible plan area width** (default 2.5). Implementation:
`.stage { container-type: inline-size }` + sizes in `cqw`. Legacy px values (>8) are ignored.

## Sticky header

`.head { position: sticky; top: var(--header-height, 56px) }`; it is MANDATORY that
`ha-card { overflow: visible }` — `overflow: hidden` breaks sticky.

## Device markers (v1.6.0+)

Per-marker appearance (v1.22.0): `display: badge|ripple|icon_ripple` (+`ripple_color`,
`ripple_size`) draws presence-style pulsing rings gated by the pure `isActiveState` —
deliberately independent of the card-wide `live_states` toggle, with `unavailable` counting as
idle. `size` (icon multiplier via the `--dev-size` CSS var — value badges scale along) and
`angle` rotate/scale a single icon. Room drawing shows a live **ruler** (`segmentCm` +
`formatLength`, metres or feet+inches by `hass.config.unit_system`); the scale is per-space
`cell_cm` (default 5 cm per grid cell).


`config.markers[]`: `{id, binding:'device:<id>'|'entity:<eid>'|'virtual', space?, area?, hidden?,
name?, icon?, model?, link?, description?, pdfs:[{name,url}]}`. A hybrid: auto-discovered HA devices
appear on their own; a marker with `binding=device:<id>` overrides them (metadata/rebinding/hiding),
`entity:<eid>` — for groups/helpers, `virtual` — a manual icon without HA. The marker id = device_id /
`lg_<eid>` / `v_<rand>` (preserves the position in the layout). The binding picker excludes already-placed
references and duplicates by name|area. Manual files: `houseplan/file/set` → `/config/houseplan/files/<id>/`,
served from `/houseplan_files/files/`.

## Server-side configuration (v1.3.0+)

`.storage/houseplan.config` (Store):
```json
{ "spaces": [{ "id","title","plan_url","aspect","view_box":[4],"rooms":[{"id","name","area","x","y","w","h"}] }],
  "device_overrides": {"<device_id>": {"hidden","icon","name"}},
  "virtual_devices": [{"id","space","name","icon","x","y","note?","entity_id?"}],
  "settings": {"exclude_integrations":[],"group_lights":true} }
```
All coordinates are **normalized (0..1 of the space plan)**; the render space is
1000 × 1000/aspect. Layout v2: `{device_id: {"s": space, "x", "y"}}` (normalized).
Plan files: `<config>/houseplan/plans/<space>.<ext>` → URL `/houseplan_files/plans/…`.
If the server config is empty, the card falls back to the legacy bundle (the dacha) and shows a
"To server" migration button in edit mode. The dacha was migrated on 2026-07-04.

## Room geometry rules (v1.19–v1.21)

A **line is never an entity of its own**: walls are *derived* from room outlines
(`roomEdges`, deduped by `segKey`), so an abandoned outline leaves nothing behind and deleting
a room keeps the walls its neighbours still contribute. Rooms may not overlap
(`pointStrictlyInside` + `roomsOverlap`; being ON a shared wall is legal — real neighbouring
walls overlap collinearly rather than match exactly). **Merge/Split** use boolean geometry from
**polyclip-ts** (chosen over `polygon-clipping`, whose ESM build exports only a default while
its types declare named exports — breaking either tsc or the runtime): merge accepts a pair only
when the union collapses into one hole-free outline; split cuts wall-to-wall with a chord, the
bigger part keeps the room identity (name/area/devices).

## Markup editor (v1.4.0+)

State inside the card: `_markup` (mode), `_tool` (draw/delroom), `_path` (the current outline,
vertices on the GRID_N=240 grid). Clicks on the stage → `_svgPoint`→`_snap`. The outline is closed
= a click on the first vertex → area select (hass.areas) + name → room {poly}. Polygon rooms and
rectangles are rendered uniformly (hit-test: point-in-polygon / rect).

**A line is never an entity of its own (v1.19.0).** Nothing is persisted while you draw: an
outline you never close leaves no trace. Walls are *derived* from the room outlines by
`roomEdges(rooms)` (logic.ts) and deduped by `segKey`, so a wall shared by two rooms is emitted
once — deleting a room therefore keeps the borders its neighbours still contribute and drops the
rest, with no bookkeeping. The legacy `space.segments` array is stripped on every save (validation
still tolerates it on read; see CHANGELOG v1.19.0).

While drawing, the length of the current segment follows the cursor (`_fmtLen` → `segmentCm`/
`formatLength`): metres, or feet+inches when `hass.config.unit_system` is imperial. The scale is
per-space `cell_cm` — cm represented by one grid cell (default 5, so 240 cells ≈ 12 m).

## Doors & windows (v1.23.0+)

`space.openings[]` — plan geometry, **not** markers: an opening needs an angle, a length and a
wall, while markers are free points whose positions live in the layout store. Model:
`{id, type: door|window, x, y, angle, length, contact?, lock?, invert?, flip_h?, flip_v?}`
(normalized coords; `length` normalized by plan width). Placement snaps onto the nearest
**derived** wall via `snapToWall` (logic.ts) — the angle is normalized to [-90, 90) because two
rooms share a wall with opposite edge directions, and without that a drag across segment
boundaries flips the hinge. The opening then keeps **absolute coordinates**, so editing, merging
or deleting rooms never breaks it.

Rendering (after easy-floorplan, MIT): SVG symbol at the origin (jambs + hinged leaf + a
quarter-circle arc revealed via `stroke-dashoffset`), translated/rotated onto the wall; windows
are two casement leaves. `openingAmount` (pure) maps the contact state to 0..1: no sensor →
door drawn open / window closed (static-plan convention); `unavailable`/`unknown` freeze that
default. The lock renders as an HTML padlock badge (`.oplock`) in the device layer; a lock is
**never** toggled from the plan (TOGGLE_FORBIDDEN_DOMAINS rule). View-mode UX: hover outline,
drag along walls (continuous re-snap, saved on release), click → status card (250 ms timer),
double click → properties dialog. In markup mode the "Opening" tool handles clicks instead.

## Integration WS API

| Command | Parameters | Response |
|---|---|---|
| `houseplan/layout/get` | — | `{layout: {device_id: {x,y}}}` |
| `houseplan/layout/set` | `layout` | `{ok}` (admin_only optional) |
| `houseplan/layout/update` | `device_id`, `pos` | `{ok}` |
| `houseplan/config/get` | — | `{config, rev}` |
| `houseplan/config/set` | `config`, `expected_rev?` | `{ok, rev}` / err `conflict`; event `houseplan_config_updated` |
| `houseplan/plan/set` | `space_id`, `ext` (svg/png/jpg/webp), `data` (b64, ≤8 MB) | `{ok, url}` |
| `houseplan/file/set` | `marker_id`, `filename`, `data` (b64) | `{ok,url,name}` (legacy, WS limit) |

**File uploads go over HTTP** (not WS, which has a message-size limit): `POST /api/houseplan/upload`
(multipart: marker_id + file), HomeAssistantView, requires_auth. Served from `/houseplan_files/files/`.


## Second card: houseplan-space-card (read-only, v1.16.0)

The bundle registers **two** custom elements from one entry (`src/houseplan-card.ts`
imports `./space-card`):

- `houseplan-card` — the full interactive card.
- `houseplan-space-card` — a static, read-only schematic of ONE space for embedding.

Shared, framework-light modules keep the two views from diverging:

- `src/space-geometry.ts` — pure model/position math (`spaceModels`, `roomBounds`,
  `roomCenter`, `defaultPositions`, `markerPos`, `labelPos`; no Lit import) — unit-tested,
  mirrors the full card's private geometry.
- `src/space-render.ts` — `renderSpaceStatic()` draws the plan + configured room
  borders/names + device markers (via `buildDevices`, same curation) with NO handlers,
  NO live states, NO status/temperature fills. Uses the same CSS classes as the full card
  (the space-card imports `cardStyles`) for visual parity.
- `src/config-store.ts` — module-level `{config, rev, layout}` cache shared by all embedded
  cards (dedupes `houseplan/config/get`), seeded synchronously from the full card's
  localStorage snapshot (`houseplan_card_cfg_v1`) and invalidated on `houseplan_config_updated`.

**Static contract:** the schematic layer (`.hp-static-stage`) is `pointer-events:none`; the
footer button lives outside it and stays clickable.

**Deep-link contract:** the footer button calls `navigate(button_target + "#space=<id>")`
(default target `/plan-doma`). The full card reads `#space=<id>` on load (a valid id wins over
`default_floor`) and on `hashchange`, without blocking manual space switching; an invalid/absent
hash falls back to the default.


## Additions v1.28–v1.41 (2026-07-24)

- **Decor layer** (`space.decor[]`, v1.33): purely visual shapes
  (line/rect/ellipse/text, normalized coords, per-shape style) drawn in the
  SVG right above the background image and BELOW rooms; pointer-events only
  inside the Background editor. Validated by `DECOR_SCHEMA` (vol.Any of the
  four kinds).
- **Glow fill** (v1.35+): `fill_mode: 'glow'` paints every room with
  `fill_colors.glow_base` and renders per-source radial gradients clipped by
  a per-light `clipPath` = zone polygons + doorway sectors, each contour a
  SEPARATE clipPath child (children union; subpaths of one nonzero path
  cancel on opposite windings — field bug v1.36.3). Radius: global
  `settings.glow_radius_cm` + per-marker `glow_radius_cm`.
- **Open boundaries** (v1.37): `room.open_to: [roomId]` symmetric links;
  light zones are connected components (`openZoneOf`); shared stretches
  computed by collinear-overlap math (`sharedBoundary`) and drawn as a TRUE
  dash — both room outlines and derived wall segments are trimmed
  (`outlineWithout`/`cutSegments`).
- **Marker controls** (v1.36): `marker.controls[]` (lights/switches only)
  toggled as one HA-group-semantics service call on the marker's EXPLICIT
  tap_action=toggle; icon state/tint mirrors the targets. `primaryEntity`
  picks in tiers so domain priority beats registry `hidden` (grouped lamps).
- **Island rooms** (v1.34): full nesting is legal (`polyContainsPoly`);
  parents render as evenodd paths with holes (`islandsOf`).
- **Kiosk mode** (v1.41): a card-config flag, not a mode — `_setMode` is
  hard-blocked, header hidden, swipe/carousel handled in the stage pointer
  pipeline (`swipeTarget`), per-screen multipliers in `LS_KIOSK`.
- **Nav persistence** (v1.38.2): `LS_NAV` stores {space, mode}; hash
  deep-link > saved > default_floor; stale-cache retry after the live load.
