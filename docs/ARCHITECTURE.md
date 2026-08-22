# House Plan architecture

Updated: 2026-08-19 (#113 optional space-model lifecycle). The repository = a HACS integration (category **Integration**)
that contains both the backend (`custom_components/houseplan`) and the Lovelace card (`src/` → `dist/`).

## Layout

```
houseplan-card/
├─ src/                          # card sources (TypeScript + Lit 3)
│  ├─ houseplan-card.ts          # the card: rendering, states, drag, tooltip, sticky header
│  ├─ hp-dialog.ts               # shared HA/native modal shell, focus and transient-overlay lifecycle
│  ├─ hp-help.ts                 # presentation-only, localized contextual-help surface
│  ├─ floating-surface.ts        # pure visual-viewport flip/shift geometry for dialog surfaces
│  ├─ floating-surface-controller.ts # shared Popover/fallback portal DOM lifecycle
│  ├─ editor-secondary.ts        # context tray model, groups, focus/dismiss lifecycle and stable template
│  ├─ editor-secondary.styles.ts # styles owned by the context tray/submenu surface
│  ├─ space-model-selection.ts   # active-or-first and exact optional space selectors
│  ├─ render/opening-tunnels.ts  # immutable SVG projection of resolved tunnel geometry/fills
│  ├─ editor.ts                  # GUI config editor (ha-form + selectors)
│  ├─ rules.ts                   # icon rules (iconFor), filtering, groups, fallback order
│  └─ data/
│     ├─ house.ts                # geometry: ROOMS (rooms→area), FLOOR_VB (viewBox), names
│     └─ backgrounds.ts          # VECTOR plans (SVG base64) + FLOOR_BG_RECT (positioning)
├─ dist/houseplan-card.js        # build (rollup+terser), ~290 KB, plans embedded
├─ demo/golden/                  # deterministic HP-QA-01 matrix, capture/verify/accept
├─ demo/performance/             # large-house budgets and same-runner comparison
├─ scripts/release-*.mjs         # exact-SHA publication contract and local orchestrator
├─ .github/workflows/
│  └─ publish-prerelease.yml     # draft-first one-button prerelease publication
├─ custom_components/houseplan/  # the HA integration
│  ├─ __init__.py                # setup: Store, WS commands, JS serving (add_extra_js_url)
│  ├─ trails.py                  # server-side vacuum trail recorder (state-change driven)
│  ├─ websocket_api.py           # houseplan/layout/get|set|update
│  ├─ config_flow.py             # single entry; admin_only option (editing restricted to admins)
│  ├─ const.py                   # DOMAIN, STORAGE_KEY, VERSION, FRONTEND_URL
│  └─ frontend/houseplan-card.js # copy of dist, served as /houseplan_files/houseplan-card.js
├─ hacs.json                     # HACS manifest
└─ docs/                         # this documentation
```

Rollup embeds a source fingerprint in the bundle. Performance and golden-image
tooling compares it with the current `src/` tree before recording results, so a
committed demo snapshot from an older source revision cannot produce a false
baseline.

Prerelease publication has one fail-closed contract shared by the local command
and the manual GitHub workflow. The tag version must match all six shipped
version authorities, both changelogs need a dated section, and the canonical
bilingual `docs/RELEASE-NOTES.md` must link to immutable tagged changelogs. A
public release is assembled as a draft, receives and verifies
`houseplan-card.js` plus `houseplan.zip`, and becomes visible only after the
exact candidate SHA has a green Validate. Existing release-event workflows are
kept as an independent recovery path; they enforce the same exact-SHA gate.
`Validate` contains only the candidate performance smoke so ordinary betas do
not wait for a full comparison. Every `main` promotion starts the dedicated
`performance.yml` workflow; stable release assets additionally require that
workflow to be green for the exact tagged SHA. Weekly and manual full runs keep
the same profiler available between stable promotions.

## Key decisions

1. **One repository — integration + card.** The integration serves the JS
   (`async_register_static_paths`) and registers it as a **Lovelace resource** (module) —
   the frontend waits for resources before rendering, so the card also works on a cold start
   of the mobile app (unlike `add_extra_js_url`, which remains a fallback for
   YAML mode). The user does not need to add the resource manually.
2. **Icon layout lives on the server.** `helpers.storage.Store(1, "houseplan.layout")` →
   `.storage/houseplan.layout`. The card reads/writes via `hass.callWS`
   (`houseplan/layout/get|set|update`). Fallback — localStorage (when the integration is absent).
3. **No token.** Everything comes from the frontend `hass` object and its
   authenticated connection: `hass.states` is reactive, while a module-level
   `ha-binding-status` cache obtains the complete device/entity registries via
   `hass.callWS`. There is one fetch/in-flight request and one pair of registry
   subscriptions per HA connection, shared by every full/static card on the
   page; House Plan creates no direct socket or token. Newly observed rows in
   the live frontend projection augment an older full snapshot immediately,
   and a changed projection schedules a debounced full reconciliation. This
   keeps discovery and `disabled_by` changes reactive even when a registry
   event subscription is unavailable.
4. **Reactivity.** Every state change in HA leads to set hass → re-render.
   Temperatures/LQI/on-off are live by definition (verified by substituting state).
5. **One modal contract.** Card modals render through `hp-dialog`. In Home
   Assistant it delegates surface semantics and trapping to `ha-dialog`; the
   standalone demo falls back to native `<dialog>`. The wrapper owns the title,
   initial focus, Escape close event and restore-focus session. Focus sessions
   are scoped to a card shadow root so nested dialogs return to their parent
   trigger and dialog replacement still returns to the original outside opener.
   Its footer wrapper is a full-width slot item: HA lays the footer slot out as
   flex, so flattening that wrapper would shrink action rows to their content.
   The wrapper opts HA's title-height custom property into content sizing so
   localized titles may wrap without clipping. Dialogs with destructive and
   commit actions use two explicit wrapping groups: destructive actions stay
   left, while Cancel/Save move together to a right-aligned second line when
   translated labels do not fit.
6. **Open passages are negative architecture.** `OpeningCfg.type=passage`
   shares placement, wall-cut and tunnel geometry with other openings but has
   no visible leaf, state binding or isometric panel. Backend semantic
   validation is change-aware: existing broken records remain readable, while
   new writes/imports are canonical. Static wall fingerprints include passage
   cuts only, preserving the historical output of doors/windows/gates.
7. **One transient-surface contract.** `hp-dialog` owns a scoped LIFO registry
   for explanatory/help and colour-picker surfaces. Escape and toast close the
   upper transient surface before the dialog, and a new transient surface
   replaces the previous one only inside the same dialog. `hp-help` and
   `hp-color-opacity` share the pure `floating-surface.ts` placement helper
   and `floating-surface-controller.ts` fallback/portal lifecycle,
   prefer the browser top-layer Popover API and use a real dialog-owned portal
   when that API is unavailable. Help text is localized by the owning card so
   two cards with different explicit languages remain independent. A help
   affordance exists only when both its localized body and complete accessible
   label are non-empty; the card factory and `hp-help` enforce this independently,
   so incomplete content cannot leave a dead focus target or a layout gap.
8. **One four-phase environment resolver.** `resolveDayCycle()` in `src/sun.ts`
   atomically chooses a strict real `sun.sun` sample or browser-local clock
   fallback and returns only phase/source/light tokens. `src/day-cycle-render.ts`
   owns the constant four-layer DOM and exact palette used by full View, kiosk,
   and `houseplan-space-card`; no surface copies thresholds or formulas. The
   environment is a pointer-inert sibling behind the plan. The only
   phase-dependent effect touching the SVG is a zero-offset filter on the one
   grouped `.hp-paperg` footprint; the content tree has no brightness, tint,
   opacity, or blend changes. Full and static card lifecycles arm a 30-second
   timer only during clock fallback while visible, catch up on visibility return,
   and dispose it on disconnect. Window-ray geometry remains a separate
   north-gated consumer of `sun.sun`.

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

`SpaceModel` is absent when the authoritative configuration has no spaces.
`_spaceModel()` therefore returns `SpaceModel | undefined`: it preserves the
legacy active-or-first selection for rendering and current navigation, but it
never invents a dummy space. Commands carrying a persisted or otherwise stable
space id use the exact `_spaceModelById()` selector; a stale id aborts before
config, layout, file or service side effects instead of mutating the first
space.

The first update that observes an authoritative empty `spaces` array runs one
space-bound lifecycle cleanup. It releases tracked pointer capture, cancels
pan/pinch/drag/resize/vacuum and geometry gestures, clears draft/history and
space dialogs, cancels the debounced config write and returns the card to View.
The global empty-state Create/import flows remain available. Recreating a space
re-arms cleanup so a later WS transition back to empty is handled identically.
Pure render/geometry helpers may return an empty result while the model is
absent; mutation entry points must guard explicitly.

`DevItem`: id (device_id), name, model, area, floor, icon, entities[], primary
(the first resolved state entity for actions requiring one target), temp,
members[] (light group), link/linkPrimary (Z2M group). Marker state consumes
the complete resolved role, not this single compatibility field. `entities[]`
contains active runtime entities only; `allEntities[]` is metadata-only, and
`bindingStatus` distinguishes `active`, `ha_disabled`, `orphaned` and
`unverified` without mutating persisted markers.

`resolveHaBindingStatus()` is the only authority for saved HA bindings. Full
registry data wins; a limited-permission client accepts positive live evidence
but never guesses that a missing shortened row means disabled/deleted. Every
plan-level consumer uses the active registry/state projection, so disabled
bindings cannot leak through Glow, climate, LQI, live text, openings, controls
or vacuum rendering. A bounded local runtime cache stores only the last
authoritative active/disabled decision to avoid a stale warm-remount flash; it
is not part of the server config or layout.

Built from the registries (`_buildDevices`), rules carried over 1-to-1 from the prototype:
- only devices with an area from the room list are shown;
- hidden: entry_type=service, integrations from EXCLUDED_DOMAINS, model=Group, scenes, bridges,
  myheat sub-devices, duplicates by "name|area";
- **a device with a `lock.*` entity always gets `mdi:lock`** (TTLock locks in the registry
  are named "Dom"/"Terrasa"/"Kladovka" [House/Terrace/Storeroom] — unrecognizable by name);
- lamps (mdi:lightbulb) with ≥2 in a room collapse into a group `mdi:lightbulb-group`
  (click → menu: the whole group + individual lamps).

## Live data

- Value satellite: `src/device-value-badge.ts` resolves one explicit
  `marker.value_badge` source/position, or projects the legacy automatic
  temperature/humidity label when that field is absent. The resolver owns HA
  formatting, units, unavailable state, candidate discovery and deterministic
  recommendation; renderers consume only `ResolvedDevicePresentation.valueBadge`.
- LQI (zigbee): the average over `*_linkquality` entities → label under the icon; color via
  `lqiColor()`: ≤40 red → ≥180 green (hsl gradient). The room average is shown in the room tooltip.
  The same tooltip includes the formatted clean-floor area (inner contour for
  thick walls). View hover is a late plain-SVG wash plus wide/narrow accent
  strokes over that clean-floor geometry. It deliberately uses no CSS/SVG
  filters: promoting a filtered sibling makes Chromium briefly recompose and
  brighten the isolated screen-blended Glow layer.
- Icon state classes: on (yellow), open (orange: cover/valve/lock/binary_sensor
  of problem classes), unavail (transparency, also used by a powered-down
  media endpoint). Yellow remains on the marker in
  source-glow fill mode: a light pool is spatial information, not a replacement
  for the universal working-state plate.

### Vacuum telemetry authority

`src/vacuum.ts` owns pure normalization and arbitration. Telemetry paths are
always `Pt[][]`; non-drawable segments are discarded before the 64-segment and
4000-point budgets, and the renderer emits one SVG path with independent `M`
commands. `resolveCurrentVacPath()` is the only integration → server → local
priority decision. `resolveVacSource()` is sticky for saved sources and limits
automatic selection to compatible entities on the same HA device; the card
adds registry status through the shared `resolveHaBindingStatus()` authority.

Room auto-calibration uses the same shoelace `areaCentroid()` for plan polygons
and robot outlines. Residuals are converted through resolved grid pitch and
cell centimetres; matrices above the 40 cm threshold remain proposals until an
explicit UI decision. `trails.py` owns persistent current/previous runs and a
refresh-time `(marker, source)` health state whose missing/disabled reason is
mutable and warning-deduplicated.

## Sizes

`icon_size` in the config = **% of the visible plan area width** (default 2.5).
The surface boundary resolves this legacy public unit to the current effective
device base (`2.25` for the default) before the shared face sees it; the face
does not apply a late visual factor. Implementation: `.stage {
container-type: inline-size }` + sizes in `cqw`. Legacy px values (>8) are ignored.

## Sticky header

`.head { position: sticky; top: var(--header-height, 56px) }`; it is MANDATORY that
`ha-card { overflow: visible }` — `overflow: hidden` breaks sticky.

## Device markers (v1.6.0+)

Per-marker appearance: `display: badge|icon_ripple|value|static_icon`. Entity semantics originate in
`src/device-visual.ts`; `src/device-presentation.ts` resolves the complete renderer-ready
projection (sources, value, icon, classes, metrics and explanation),
`src/device-pulse.ts` is the single pure projection from semantic activity to
`none|alarm|short|continuous`, and
`src/device-face.ts` renders one package-derived shell/core DOM on the full plan,
device preview and static space card. The saved coordinate remains the icon-core
centre; Text is shell-centred, while a Double shell extends around the anchored
core. The 101.5/80 shell/core ratio, shared shell/core centre, Light/Dark
context, full-text fitting and 44×44 core-centred interaction floor are
renderer facts rather than surface-specific DOM. A positioned shell frame owns
the complete visible capsule hit area; its event bubbles to the marker's one
action path.
`badge` shows the icon/morph and semantic core; `icon_ripple` additionally shows three finite
event waves or one continuous wave for presence, mechanical transition and actual work;
`value` replaces the icon
with the HA-formatted numeric or text value. Ambiguous/missing/unavailable sources fall
back to the icon instead of selecting an arbitrary registry row. A critical alarm is red
in every dynamic presentation. `static_icon` deliberately keeps the configured/automatic
base icon on one neutral theme-aware core: state morphing, work/open/alarm/unavailable paint,
activity, RGB, value, temperature/humidity/LQI badges and live vacuum overlays are all
suppressed. Hover/focus, taps, controls and light aggregation keep their normal behaviour.
An optional `marker.value_badge` adds a state/attribute, derived LQI or canonical
`marker:<id>` light-state section at right/bottom/left/top inside that shell.
Explicit settings override the global legacy temperature gate; explicit off
suppresses legacy output. Bottom badges stack above system LQI, and a derived
LQI badge de-duplicates that system row. `hp-device-preview` fits and centres
the complete face bounding box rather than allowing satellites to clip.
`normalizeDeviceDisplay()` is the mandatory compatibility gate for every consumer and maps
legacy `ripple` to `icon_ripple`. `markerLqiBand()` remains marker-only semantic
metadata for accessibility, while `markerLqiColor()` delegates to the shared
continuous `logic.ts::lqiColor()` red-to-green scale. The marker dialog builds
its unsaved draft through `buildDevices`,
then `hp-device-preview` shows the actual projection, integration provenance from
registry/config-entry metadata and isolated short/continuous activity demonstrations.
Runtime baselines are seeded as soon as a rebuilt registry becomes authoritative, before
the next HA snapshot is classified; source-key changes reset any finite effect immediately.
The backend accepts legacy `display: ripple` only for compatibility. `ripple_color` and `ripple_size` remain the
stored names used by every unified pulse kind (alarm keeps its safety-red colour).
Absent pulse size resolves to 1.5; explicit persisted color/size wins, followed
by live RGB and the presence-green/work-amber/transition-blue fallback.
Continuous/short/alarm durations are 3.6/3.3/2.4 seconds. Enter/Space on an
interactive marker calls the same `_clickDevice()` path as pointer activation,
so secure confirmation and Device-editor routing cannot drift.
`size` (icon multiplier via the
`--dev-size` CSS var — value badges scale along) and `angle` rotate/scale a single icon.
Room drawing shows a live **ruler** (`segmentCm` +
`formatLength`, metres or feet+inches by `hass.config.unit_system`); the scale is
per-space canonical `cell_cm`. New spaces default to 1 cm in metric HA or
2.54 cm (shown as 1 inch) in imperial HA. Missing legacy data still reads as
5 cm and is not migrated.

Legacy raw SVG constants are classified as visual units relative to the old
5 cm renderer and pass through `gridVisualScale()` / `gridVisualUnits()`.
Physical cm paths, screen-fixed chrome, plan-relative marker/label sizes and
grid geometry are deliberately excluded from that factor. Full/static roots
expose the same `--hp-cell-visual-scale`; hidden isometric heights and
user-space shadows include the factor in their structural cache inputs.


`config.markers[]`: `{id, binding:'device:<id>'|'entity:<eid>'|'virtual', space?, area?, hidden?, removed?,
name?, icon?, model?, link?, description?, pdfs:[{name,url}]}`. A hybrid: auto-discovered HA devices
appear on their own; a marker with `binding=device:<id>` overrides them (metadata/rebinding/hiding),
`entity:<eid>` — for groups/helpers, `virtual` — a manual icon without HA. The marker id = device_id /
`lg_<eid>` / `v_<rand>` (preserves the position in the layout). The binding picker excludes already-placed
references and duplicates by name|area. Manual files: transactional HTTP upload into `<config>/houseplan/files/<id>/`
(staging `up_*` folders promoted on save), served via signed
`/api/houseplan/content/files/…` urls.

`removed:true` is a binding tombstone, not a renderable marker. It claims an
HA binding against automatic discovery while intentionally exposing that same
binding to the Add picker. A device tombstone excludes all data of that device;
an entity tombstone excludes the standalone entity binding but does not mutate
the same entity out of a still-live parent device. Runtime-filtered references
such as `controls` and live text remain persisted and become active again after
re-add. Exact `opening.contact` / `opening.lock` fields are a separate
architectural-object role: their HA availability ignores marker tombstones but
still uses `resolveHaBindingStatus()` to reject disabled, orphaned or unverified
entities. Their painted state comes from the immutable active-registry frame,
not directly from live `hass`. Re-adding a marker therefore cannot duplicate or
rewrite an opening reference.
Re-adding replaces the tombstone; virtual markers need no tombstone because
they have no discovery source.

## Server-side configuration (current shape, v1.51+)

### Persisted colour boundary

Every colour stored in Houseplan config has exactly one representation:
`#RRGGBB` (case-insensitive hexadecimal digits, no whitespace or CSS
functions). `src/color.ts` owns the frontend resolver and
`custom_components/houseplan/validation.py::_COLOR` owns the write schema.
Resolvers apply a safe default again at render time because an old, imported or
manually edited store is returned without a destructive read migration.

Home Assistant `rgb_color` is live state rather than persisted user input. It
is accepted only as three finite numeric channels, clamped/rounded to 0–255 and
emitted by the application as canonical `rgb(R, G, B)`. The final inline-style
boundary accepts only stored hex or that generated form. Supporting arbitrary
CSS colour syntax would require a separate product/security decision; it must
not be added to an individual sink.

`.storage/houseplan.config` (Store):
```json
{ "spaces": [{ "id","title","plan_url","plan_aspect",
               "plan_x","plan_y","plan_scale_x","plan_scale_y","plan_angle",
               "plan_scale",   // legacy optional fallback, docs/BACKDROP.md
               "view_box":[4],
               "rooms":[{"id","name","area","poly|x/y/w/h","open_to","settings"}],
               "room_drafts":[…], "partitions":[…], "wall_columns":[…],
               "openings":[…], "decor":[…], "settings":{…} }],
  "markers": [{ "id","binding":"device:<id>|entity:<eid>|virtual","hidden","removed",
                "name","icon","display","controls","is_light","glow_color","tap_action",
                "room_id","pdfs",… }],
  "settings": { "exclude_integrations":[], "group_lights":true,
                "filter_seeded":true, "fill_colors":{…}, "icon_rules":[…],
                "known_devices":[…], "new_device_ids":[…] } }
```
All coordinates are **normalized (0..1 of the canvas)**; the canvas is always
**square** (v1.48.0), render space `NORM_W × NORM_W` (1000×1000). A space has no
proportions of its own — `plan_aspect` is the IMAGE's ratio, used to letterbox
it centred on the square; optional `plan_x/y`, independent `plan_scale_x/y`
and `plan_angle` then transform that rectangle (`planRect`, docs/BACKDROP.md).
Legacy `plan_scale` feeds both axes, and the absence of every transform field
is the centred default exactly. The schema bounds geometry to ±5000 with strictly
positive sizes (HP-1501/1502). `device_overrides`/`virtual_devices` are long
gone — markers carry everything. `marker.hidden` is the explicit reversible
"hide from plan" flag seeded once by the old filter; `marker.removed` is the
minimal delete tombstone (docs/FILTERING.md).
Layout v2: `{device_id | rl_<roomId>: {"s": space, "x", "y"}}` (normalized,
bounded ±5000). Plan files: `<config>/houseplan/plans/<space>.<token>.<ext>`
(copy-on-write, never overwritten), served via signed
`/api/houseplan/content/plans/_/<name>` urls; growth is bounded by store
quotas, nothing is ever deleted for being old (docs/SCOPE.md).

## Room and independent wall geometry

Room-boundary walls remain *derived* from room outlines (`roomEdges`, deduped by
`segKey`), so deleting a room keeps the boundaries its neighbours still
contribute. Three explicitly typed exceptions are stored per space:
`room_drafts` for crash-safe unfinished Walls chains, `partitions` for finished
independent wall segments and `wall_columns` for square/circular columns.
They do not create a room or HA area and never split a room implicitly. Their
physical bodies are unioned with room walls for rendering and light occlusion,
and subtracted from clean room floor area. A finished partition may explicitly
host a door, window, gate or passage; unfinished drafts and columns may not.

Independent linear objects have two deliberate projections. Raw flat-capped
quads preserve source identity for hit/selection/drag/properties/delete/history
and furniture magnet behaviour. `physicalBodySet()` also derives exact
endpoint↔endpoint and endpoint↔line topology, adds bounded mitre/bevel patches
without persisted nodes or segment splits, and exposes the joined geometry to
presentation and physics. Degree-one caps remain flat; an interior X crossing
is only a boolean overlap. The full card caches this structural frame by
space/config geometry, while static cards use a weak server-snapshot cache;
cursor and HA state updates do not repeat the saved O(N²) node search.

Rooms may not overlap
(`pointStrictlyInside` + `roomsOverlap`; being ON a shared wall is legal — real neighbouring
walls overlap collinearly rather than match exactly). **Merge/Split** use boolean geometry from
**polyclip-ts** (chosen over `polygon-clipping`, whose ESM build exports only a default while
its types declare named exports — breaking either tsc or the runtime): merge accepts a pair only
when the union collapses into one hole-free outline; split cuts wall-to-wall with a chord, the
bigger part keeps the room identity (name/area/devices).

`wallBodiesGeometry()` is the canonical physical masonry for flat full/static
rendering, hidden isometric projection and Glow/sun occlusion. Its exterior
shell is derived from the union of room centrelines plus the surviving `outer`
atomic intervals; internal/shared interval bodies are clipped to that union
before the shell is restored. Consequently a Split edge ending at an exterior
vertex cannot contribute a child-room mitre to the facade. Per-room rings remain
an interior join/nested-room representation, and atomic quads provide a safe
physical interval when an acute child ring cannot be subtracted. Paper and
masonry paths are emitted by that same geometry pass. Computed independent
junction patches enter through the same physical union. A partition-hosted
opening is subtracted from its explicit raw body before that union. It also
cuts a derived room wall only when the wall is exactly collinear and covers
the complete hosted interval; crossing or nearby bodies remain opaque and room
exterior authority remains intact.
Virtual-wall junction patches are computed, scale-relatively normalised below
the geometry epsilon, and unioned one at a time. Each such union is an optional
transaction: a malformed/degenerate patch retains the previous canonical body
and later patches still run. The surrounding structural pass is deliberately
outside that fallback boundary: an exception escaping the existing
exterior/body/opening/authoritative-extra passes still returns `null` and
activates the established fail-dark consumer behaviour. This distinction
prevents one cosmetic junction repair from blanking a whole plan without
masking a real structural failure (#197).
Before the exterior offset is built, each saved atomic endpoint splits its
containing collinear union edge. Offset changes are explicit butt steps at that
endpoint, including nonzero-to-zero transitions. The topology tolerance starts
in render units and is divided by the current edge length before it is compared
with or used to de-duplicate normalized `t` fractions; this keeps the result
scale-independent and prevents one interval's depth from leaking into its
neighbour.
The full card retains the
pair in `_wallUnionCache`; static cards retain it in a weak server-snapshot
cache guarded by a structural geometry fingerprint. This is computed render
state only: it never rewrites rooms or wall entries, and an HA state tick does
not rebuild topology.

### Hidden Isometric Stage 2 composition (#122)

The hidden `iso` View reuses that masonry but has one bounded structural scene,
not a second house model. `_isoGeometryCache` remains an eight-entry LRU keyed
by room/wall/opening geometry (including opening flips), scale/camera, fixed
wall/floor-edge heights and an algorithm revision. Each value holds wall faces,
the room/exterior slab edge, immutable opening jamb bases and the projected
frame. HA state, theme, hover and filter support are presentation inputs and
never enter this key.

`floorFootprintGeometry()` derives only the union of room floors and exterior
masonry; unlike wall volume, it has no independent partition/column input.
`buildIsoFloorGeometry()` emits visible low faces for outer component rings,
not internal edges or holes. `src/iso-openings.ts` stores jamb/axis topology and
applies `openingAmount()` only during live projection, keeping contact updates
out of the boolean geometry path.

Composition is shared-viewBox SVG: ambient shadow/floor edge → the existing
affine-projected floor/live scene → contact/leaf shadows → wall material and
vertical panels → existing screen-facing HTML overlays. A constant set of
gradients/filters serves every face. Unsupported decoration or forced colours
remove nuance/shadows without changing projection; only structural failure
uses the Stage 1 latched Flat fallback. Details and fixed ratios are recorded in
`docs/adr/122-isometric-stage2-composition.md`.

## Markup editor (v1.4.0+)

State inside the card: `_markup` (mode), `_tool` (draw/column/merge/split/resize/opening/
boundary/wallthick/delroom), `_path` (the current outline,
vertices on the GRID_N=240 grid). Clicks on the stage → `_svgPoint`→`_snap`. The outline is closed
= a click on the first vertex → area select (hass.areas) + name → room {poly}. Polygon rooms and
rectangles are rendered uniformly (hit-test: point-in-polygon / rect).

All committed plan-geometry mutations enter one named 50-command Undo/Redo stack. Ctrl+Z,
Ctrl+Shift+Z/Ctrl+Y and the toolbar buttons use the same stack; a new mutation after Undo drops
the redo branch. The local stack survives the server echo of its own writes, but is cleared when
a newer external config revision is adopted. Positional placement is always quantized to the plan
grid. Shift may alter a gesture's geometry (square/circle creation, independent
resize axes or free rotation), but it cannot create off-grid coordinates.

`boundary` is one contextual UI tool over the existing `open_spans` model.
Before the first click, independent physical bodies block the room boundary
below them; otherwise a dashed span wins over a solid shared boundary, and an
outer wall is rejected. A solid shared wall takes two points to open, while a
dashed canonical span is restored whole with one click. Interaction widths and
junction ambiguity are measured in CSS pixels and converted through the live
viewBox, so zoom never changes the effective target. The first point is a
transient gesture only: Esc, Undo/Redo, navigation, external config adoption,
pointer cancellation and multi-touch discard it without touching history.

Every completed Walls segment is persisted in `room_drafts`, including the
thickness selected when that segment was placed. Changing Plan tool, editor or
floor explicitly finishes an open chain by converting it to ordinary
`partitions` in one history/save transaction; re-selecting Walls is a no-op.
Pan, pinch, pointer cancellation and suppressed clicks never finish a chain or
append a segment. A finished open chain is ordinary masonry and is not resumed
as a draft. Reload recovery may resume only a still-active persisted draft.

`src/wall-face-graph.ts` derives an immutable planar graph from solid room edges
after opening cuts, partitions, inactive drafts and the active chain. A sweep
broadphase atomizes endpoint, T, X and collinear intersections; deterministic
half-edge traversal extracts bounded canonical faces. The click handler diffs
the graph before/after the latest segment and offers only newly created faces
that contain an atom of that segment, ordered by area and canonical key. Exact
or partial overlap with a room is rejected while legal nesting is preserved.
A clean single-room divider reuses `splitRoomPath`, offering only the smaller
child while the larger child retains the original room identity and metadata.

An idle Walls click also queries the smallest exact unoccupied bounded face at
the raw point; boundary/snap hits and desktop `Shift+click` remain drawing
gestures. If no exact face exists, `src/wall-face-repair.ts` may plan one
endpoint→endpoint or endpoint→solid-line move no longer than 2 physical cm.
Room vertices are never movers, multiple valid repairs fail closed, and the
immutable proposal is revalidated against current source/target geometry before
it is applied. The move and room are one history/config transaction; rejecting
or cancelling the room never applies the proposal.

Room answers are buffered in `_wallFaceBatch`. Create/Keep-as-walls advance the
queue without mutating geometry; Cancel/Esc restores the terminal draft. The
last answer revalidates every face and capacity limit, then commits all accepted
rooms, the split result and every unconsumed active atom in one Undo/Redo and
config transaction. Existing saved source geometry is never atomized or
rewritten merely because it participated in a face. `column` still creates a
physical object whose size comes from the current Thickness field. The legacy
root `space.segments` array is stripped on every save.

Room deletion is likewise planned before mutation. `src/room-deletion.ts`
classifies the selected room's atomic outer/shared/open intervals and its
unhosted openings. Keep-walls materializes only exclusive positive solid
intervals as partitions (reusing exact compatible masonry) and rehosts their
openings. Delete-walls cascades only those exclusive openings. Shared walls,
explicit partitions and partition-hosted openings survive. The selected room,
wall profile/open spans, partitions and openings commit in one named geometry
transaction through an accessible `hp-dialog`, never native `confirm()`.

While drawing, the length of the current segment follows the cursor (`_fmtLen` → `segmentCm`/
`formatLength`): metres, or feet+inches when `hass.config.unit_system` is imperial. The scale is
per-space `cell_cm` — canonical centimetres represented by one grid cell; new
spaces use 1 cm or 2.54 cm/1 inch, while missing legacy values fall back to 5 cm.

## Editor chrome and contextual controls

Every editor uses one stable primary `.editbar`. Its `.editbar-tools` contains
only persistent tools and Undo/Redo; `.editbar-end` is a separate pinned end
cap for Close. Selection, operation and tool-state changes must not insert
controls into this measured row.

Transient UI is resolved into one `EditorSecondaryModel` and rendered by the
single `.editor-secondary-host` inside `.stage`. Generic state, group
navigation, focus/animation lifecycle, outside-dismiss handling and the stable
light-DOM template live in `editor-secondary.ts`; its CSS is isolated in
`editor-secondary.styles.ts`. The root card only builds Plan/Decor models and
supplies typed product callbacks. Keeping the existing light DOM is deliberate:
layout selectors, focus queries and browser-smoke hooks remain unchanged.

The host is absolutely positioned, has pointer events only on its visible
surface and is outside the header/`_hdrH` measurement boundary. Plan selection
actions, drawing thickness and operation hints, Background selection/style
actions and the furniture palette all use this surface. The Device editor uses
the same empty host and must route future marker quick actions through it.

Every mutating secondary action captures a deterministic `contextId` and
revalidates it before invocation, so a callback from an old selection cannot
modify a newer target. `Delete`/`Backspace` do not fall through while focus is
inside any secondary surface. The same host also implements an explicit
second-level `EditorToolbarGroup` contract (launcher, one open group, keyboard
navigation, focus restoration and outside-dismiss consumption), but no current
tools are grouped without a separate product decision. The change is UI-only:
plan/config models and geometry commands are unchanged.

## Doors, windows, gates & passages (v1.23.0+)

`space.openings[]` — plan geometry, **not** markers: an opening needs an angle,
a length and one wall, while markers are free points whose positions live in
the layout store. Model:
`{id, type: door|window|gate|passage, x, y, angle, length, host?, contact?, lock?, invert?, flip_h?, flip_v?}`.
Room-wall openings omit `host` and retain the absolute-coordinate association.
An independent-wall opening stores
`host:{kind:'partition',id,t}`; the stable id and normalized position `t` are
authoritative, while `x/y/angle` are an atomically refreshed compatibility
projection. No explicit host ever falls back to a nearest wall.

Rendering (after easy-floorplan, MIT): SVG symbol at the origin (jambs + hinged leaf + a
quarter-circle arc revealed via `stroke-dashoffset`), translated/rotated onto the wall. The
visible group is always centred across wall depth on Flat, preview, Static and Iso; the shared
pure placement helper returns an exact zero translation for every type and `flip_v` value.
`flip_v` changes only door/window direction or the gate turn. Windows are two casement leaves.
A gate has the same data/light/contact/lock semantics as a door, but
uses two centred half-width leaves opening only 10° toward the selected face and no large swing arc.
Its default width in the editor is 300 cm. `openingAmount` (pure) maps the contact state to
0..1: no sensor → door/gate drawn open / window closed (static-plan convention);
`unavailable`/`unknown` freeze that default. The lock renders as a compact
package-derived shell/core HTML padlock badge (`.oplock`) in the device layer,
with theme-aware locked/unlocked/unknown states; a lock is
**never** toggled from the plan (`resolveToggleIntent` returns a secure no-op). View-mode UX: hover outline,
drag along walls (continuous re-snap, saved on release), click → status card (250 ms timer),
double click → properties dialog. In markup mode the "Opening" tool handles clicks instead.

Contact and lock are exact HA references owned by the opening, not aliases of
standalone markers. Their candidate/action path follows HA binding status while
their render path follows the frozen active-registry projection; neither path
consults marker tombstones. For that projection, the presence of an exact state
is sufficient: registry-less YAML entities have no row, while explicit
disabled/orphan rows have already been stripped together with their states.
The render helper must never receive raw live hass. Plan-level consumers keep
the tombstone policy described above.

For a wall with thickness, one `OpeningWallIndex` resolves the atomic wall
interval and adjacent room on each side of the centreline. Opening symbols,
wall cuts and room-coloured tunnel patches all consume this association; none
has a separate nearest-wall fallback. A candidate must be genuinely adjacent
to the opening axis, so a detached parallel room inside one grid cell cannot
own the far half. Full-width coverage, signed inner-face distance, room area
and stable room id form the deterministic tie order.

The full card caches that index and the batch tunnel geometry by space,
`_cfgEpoch` and complete room/wall/opening geometry. A normal HA state tick
therefore resolves only live room fill values, not `roomWallProfile` again.
The batch helper removes already-painted intervals from later overlapping
openings, preventing double alpha. A base patch beneath Glow/sun repeats the
same frame-local effective fill as the room shape. Outer openings give the one
room both halves; shared openings use a local-coordinate hard stop at `y=0`.
Virtual spans, unfinished drafts and zero-thickness walls are ignored; legacy
spans are clipped per atomic body.

The same resolved host drives placement, symbol face, full-depth partition cut,
static/hidden-isometric rendering, Glow and edit operations. Rigid host drag
keeps `t` and updates every materialized projection in one history command.
Hosted openings have two deliberate validation policies: render/read consumers
use the historical zero-margin resolver, while creation and direct geometry
edits use a strict resolver that reserves `wallCmToUnits(partition.cm) / 2` at
each endpoint. The backend repeats that physical boundary as semantic delta
validation; rigid partition translation and unrelated writes therefore keep a
legacy near-end opening losslessly, while host/position/length/span/thickness
changes opt it into the strict rule.
Deleting a host with openings requires an explicit cascade dialog; an invalid
host fails dark and is visible only as a rebind diagnostic in Plan. Structural
room-face topology deliberately keeps every valid wall axis continuous through
all opening types (#185); only `open_spans` and absent walls are connectivity
gaps.

## Integration WS API

| Command | Parameters | Response |
|---|---|---|
| `houseplan/layout/get` | — | `{layout: {device_id: {x,y}}, rev}` |
| `houseplan/layout/set` | `layout`, `expected_rev?` | `{ok, rev}` / err `conflict`; event `houseplan_layout_updated` |
| `houseplan/layout/update` | `device_id`, `pos` | `{ok, rev}`; event `houseplan_layout_updated` |
| `houseplan/config/get` | — | `{config, rev, virtual_lights:{rev,config_rev,off[]}}` (`virtual_lights` optional for rolling compatibility) |
| `houseplan/virtual_light/toggle` | `marker_id` | `{marker_id,on,rev}` / err `not_toggleable`; event `houseplan_virtual_light_updated` |
| `houseplan/trail/get` | — | `{trails: {marker: {current, previous}}}` — vacuum runs, raw robot coords |
| `houseplan/trail/delete` | `marker_id` | `{ok, removed}` — erase current/previous runs after marker deletion |
| `houseplan/config/set` | `config`, `expected_rev?` | `{ok, rev}` / err `conflict`; event `houseplan_config_updated` |
| `houseplan/plan/optimize` | `config`, `layout`, both expected revisions | crash-resumable two-store commit + one-deep backup |
| `houseplan/plan/optimize_undo` | both expected revisions | restores backup only before any later edit |
| `houseplan/plan/set` | `space_id`, `ext` (svg/png/jpg/webp), `data` (b64, ≤8 MB) | `{ok, url}` — writes `<space>.<token>.<ext>`, deletes nothing |
| `houseplan/plans/list` | — | `{plans: [{name, url, size, modified, used_by}], total}` (newest 60) |
| `houseplan/plans/delete` | `name` | `{ok, removed}` / err `in_use` |
| `houseplan/layout/delete` | `device_id` | `{ok, rev}`; event `houseplan_layout_updated` |
| `houseplan/geometry/repair` | `space_id`, `aspect`, `dry_run?`, `undo?` | preview / `{ok, rev, moved}` / `{restored}`; errs `nothing_to_repair`, `no_backup` |
| `houseplan/files/migrate` | `from_id`, `to_id` | `{mapping}` — COPY, never move |
| `houseplan/files/cleanup` | `marker_id`, `keep?` | replacement-only collection |
| `houseplan/content/sign` | `paths[]` | `{urls}` — authSig for `<image>`/`<a>` fetches |
| `houseplan/export/create` | `kind`, `space_id?`, `plan_only?`, `card_version` | consistent versioned JSON document + safe filename; plan-only is valid only for one space |
| `houseplan/import/revalidate` | preview `token`, `duplicate_policy?` | refreshed bounded preview and current expected revisions |
| `houseplan/import/apply` | token, both expected revisions, content confirmation | crash-resumable paired config/layout commit; full import gets one-deep undo |

The normal frontend reaches `houseplan/plan/optimize` only after the exact
preview candidate passes `src/plan-geometry-preflight.ts`. That pure barrier
uses the same room/open-span/ordinary+hosted-opening projection,
`physicalBodyParts`, `wallBodiesGeometry` and `floorFootprintGeometry` as the
renderer for every space. The dialog retains statuses and a config fingerprint,
not polygon output or exception text; a mismatch before Apply triggers a fresh
check. A red result means zero WS calls. Python deliberately does not duplicate
`polyclip-ts`: the endpoint remains the independent permission/schema/revision
and crash-resumable atomicity boundary, not a consumer-supplied preflight
attestation.

Manual attachments upload over HTTP (streaming, transactional staging), not WS —
the old `houseplan/file/set` was removed in v1.10.0.

Manual virtual-light state is operational data, not plan configuration. The
integration owns a separate versioned `houseplan.virtual_lights` Store whose
bounded payload contains only `{rev, config_rev, off[]}`. The existing shared
write lock serializes config reconciliation and atomic toggles. Eligibility is
always recalculated from server config; the toggle command accepts no desired
state, entity id or service. It is intentionally available to every
authenticated View user, while config writers remain governed by `may_write`.
The durable save precedes both reply and event. A config-revision gap from an
older writer clears manual off bits to the compatibility default `on`.

The first `config/get` frame carries the coherent operational snapshot. Full
cards subscribe directly to the update event; all `houseplan-space-card`
instances share the module-level config cache and one subscription. Local
storage may retain the last snapshot for continuity, but never authorizes an
optimistic toggle. The data is excluded from marker/layout schemas, portable
export/import and the HA entity registry.

Portable import preview uses authenticated
`POST /api/houseplan/import/preview`. The endpoint streams at most 8 MiB,
strictly rejects duplicate/prototype keys, non-finite numbers and future model
versions, and retains the parsed candidate only in memory for ten minutes. Its
opaque token is bound to the HA user, normalized-candidate digest and the exact
config/layout revisions. Parsed candidates are capped globally as well as per
user.

Plan-only export is a server-owned, fail-closed projection rather than a
client-side scrub. It removes every marker and all device layout, preserves
only canonical room-label placements, and copies one space through explicit
geometry/presentation allowlists. The parser recomputes that projection and
its placement manifest before showing a plan-only preview, so manually adding
a private field while keeping `transfer.plan_only: true` is rejected.

The browser never parses imported configuration. Full import and maintenance
share the `optimize_pending` crash-recovery intent and the one-deep backup slot;
the backup carries `kind: optimize|import`, while every layout-store writer
goes through `async_save_layout_state` so unrelated store metadata survives.
Apply rechecks local plan files under the write lock. A failed pair is retried
toward the target once, then gets an explicit rollback intent so a later
restart never finishes an import already reported as failed.

**If the v1.48 migration crashed halfway** (HP-1500-01): the config write
landed, the layout write did not, and both triggers are gone — markers of that
space sit in the old coordinates and nothing in the data can prove it. The
`geom_pending` intent (v1.50.0) prevents this for any future migration, but
cannot help an install that was already stranded. There is no safe automatic
answer — re-transforming a layout that is actually correct would corrupt it —
so the fix is explicit: `houseplan/geometry/repair {space_id, aspect}`
re-applies the transform to that one space's positions. `dry_run: true`
previews, the previous positions ride the same store write as a one-deep
backup, and `undo: true` restores them. Admin-gated like every other write.

**The canvas is square, the image is not** (v1.48.0). A space used to carry an
`aspect`, and coordinates were normalised against it — x by the width, y by the
height. That made every geometric question depend on a per-space number for no
benefit. Now the render space is `NORM_W × NORM_W` and a plan image is fitted
inside it by its own ratio (`fitInSquare`, shared by both renderers), which is
stored as `plan_aspect` so the layout does not jump before the file loads.
Upgrading runs `geometry_migration.migrate_config` once: it pads the old box out
to a square and re-expresses every coordinate against it — a uniform scale plus
an offset in render units, so angles and proportions are exact — and scales
`cell_cm` for tall plans, since the grid pitch is a fraction of the width.

**User content is served inert** (HP-1454-01). An uploaded SVG is the only
thing here that a browser will happily treat as a *document* rather than an
image, and it would be a document of Home Assistant's own origin. Inside the
card that never matters — `<image>` does not run scripts — but the url is
reachable directly, and uploading needs only write access, which by default
every user has. `HouseplanContentView` therefore sends a `sandbox` CSP with SVG
and only with SVG: a CSP on a PDF response can break the browser's built-in
viewer, and a raster image has no execution model to disable.

**Attachments follow the same commit-scoped lifecycle as plans** (HP-1454-02).
An upload takes a free name and never overwrites, because the bytes under an
existing name may be referenced by the stored configuration and an upload is
not part of that transaction. `reserve_filename` *claims* the name as it picks
it (`O_CREAT | O_EXCL`) — asking `exists()` and returning a string let two
uploads agree on one name and quietly overwrite each other. It also budgets the
length so the result survives the sanitiser the content view applies to the
request, since a name the view rewrites is a file written and never served.
Streaming temporaries live in the files root under `.upload-`, are removed on
every exit path of the request (including cancellation, which is a
BaseException and slips past `except Exception`), and are swept at startup and
daily. That scheduled pass also runs the two collectors with the stored
configuration as *both* sides — nothing superseded, so every referenced file is
kept and only aged unreferenced ones go. Without it, collection would only ever
happen when somebody saves, and a file uploaded into a dialog that was then
cancelled would wait for a write that may never come. A new icon has no id yet, so its
files go to a per-dialog staging folder and move to the real id once the config
write is accepted — the same copy → save → cleanup order as a rebind.
`config/set` collects what its commit superseded — that much a commit knows for
certain. *Unreferenced* is a far weaker signal, and the policy follows from one
asymmetry: **a few unnecessary megabytes can always be removed by hand; a file
we should not have removed cannot be brought back.** When the evidence is weak,
keep the file. Owner's decision, 2026-07-28, after the one-hour rule applied to
every unreferenced file destroyed two detached plans.

The classification is by **owner**, not by "is it referenced". A file leaving
the configuration looks identical whether the plan was replaced, detached, or
its space deleted — and only the first is a deletion the user asked for. Reading
`old_refs - new_refs` and calling it "superseded" deleted a plan the moment it
was detached, under documentation promising the opposite (HP-1465-01).

| Case | What it means | Rule |
|---|---|---|
| Space in both, plan A → plan B | the user picked another image | removed immediately |
| Space in both, plan → none | detached; one click undoes it | **kept** |
| Space gone | deliberate, but the image was imported and may be nowhere else | **kept** |
| Space has a plan, plus another file of its own | an upload whose save was rejected | **kept** — ageing these out raced the retry that referenced them |
| Marker in both, attachment dropped from its list | a trash button, promising nothing | removed immediately |
| Marker gone | same call as a deleted space's plan | **kept** |
| Attachment in `up_*` | a dialog that was never saved; no device owns it | `PLAN_ORPHAN_TTL_S` (1 h) |
| Marker there, file it never listed | a rejected upload | **kept**, same reason |

Nothing is deleted for being old, with one exception: a per-dialog staging
folder (`up_*`), which by construction can only hold an upload from a dialog
that was never saved. The disk therefore stays bounded by the user, not by a
timer — `houseplan/plans/list` shows every stored plan with its size and which
space uses it, and `houseplan/plans/delete` removes one on request, refusing
while a space still references it. That listing is what makes "we never delete"
livable: a detached plan is not lost, it is one click away in the space dialog.

**Config writes are serialized** (HP-1454-03). `_writeConfig()` chains onto a
single promise: one `config/set` in flight, each carrying the revision the
previous one returned. The debounce still spaces out *when* a write starts;
what it cannot do — and used to be relied on for — is keep two writes from
overlapping, which produced a self-inflicted conflict and lost the newer edit.

**Plan uploads are copy-on-write, and collection belongs to the commit**
(reviews R2-1, R3-1). The file system is not part of the config's
optimistic-locking transaction, so nothing referenced may be overwritten or
deleted before the CAS succeeds: the upload writes a new versioned name and
removes nothing. Deciding what may then go is *not* a client's call — a cleanup
request cannot be ordered against another client's commit, and a delayed one
deletes a plan that was just saved. So `config/set` collects itself, inside its
write lock, from the pair of configurations that bracket the commit
(`plans.collect_plans`): a file the commit REPLACED goes immediately, and
nothing else goes at all — see the table above; only a per-dialog staging folder
ages out. Growth is bounded at the door instead, by `plans.check_quota` on every
upload (store size, file count, free disk), because a limit that deletes is how
plans were lost twice. The `.` between id and token is load-bearing —
a space id cannot contain one, so `<space>.<token>.<ext>` can never be confused
with the files of a space whose name merely starts the same way.

**An internal plan url must exist when it is stored** (HP-1470-02). The picker
can attach a plan and then delete it, and two clients can do the same in either
order — the write lock orders the requests but says nothing about whether the
file survived. `config/set` therefore checks every `/api/houseplan/content/plans/`
url against the disk before saving, and refuses with `missing_plan`. External and
legacy urls are the user's own and are never second-guessed.
Portable import repeats the same check under its paired-write lock for both
plans and local marker PDF attachments, so content that disappears after the
preview cannot leave a newly broken reference in the restored config.

**Signed content urls are batched, aged and deduplicated** (reviews R2-2, R3-2, R4-2). `ContentSigner`
in `src/signing.ts` is the single implementation, used by both cards; the
duplicate inside houseplan-space-card signed correctly and never handed the
result to its renderer, which is the failure mode a second copy invites. `MAX_SIGN_PATHS`
(200) is a shared contract between `logic.ts` and `const.py`: the backend caps a
request there and says nothing about the rest, so the card must chunk. Cached
signatures carry the time they were issued — an aging one keeps rendering while
its replacement is fetched, an expired one is dropped rather than served (it
would 401 and raise a failed-login warning). The cache is pruned to the urls the
live config references, so it cannot grow past the cap through history alone.
Queued and in-flight are distinct states: a render happening while a request is
out must not queue the same url again, a failure backs off rather than retrying
on the next frame, and an in-flight entry expires after `SIGN_INFLIGHT_MS` so a
promise that never settles cannot block retries forever.

**Visual continuity is a frame contract, not a loading screen** (#73).
`src/visual-continuity.ts` owns one tokenised state machine shared by the full
and static cards. A complete frame remains mounted during resume, reconnect,
structural revalidation and positive-size changes; `0×0` observations never
change the viewport. Config and layout carry independent revision plus
content-fingerprint identities, so revision-only echoes preserve authoritative
objects and geometry caches while changed content cannot hide behind an equal
revision. A candidate becomes complete only after Lit settles, required signed
assets are loaded, and two animation-frame opportunities pass for the current
token. A bounded trace and the production `data-continuity-state`,
`data-continuity-token`, `data-frame-fingerprint` and conditional
`data-recovery-reason` attributes expose this contract without entity ids or
URLs.

The signed-asset runtime is authority-scoped (`hass.connection`), bounded and
shared across placements. A warm remount can therefore use an already loaded
backdrop synchronously. Refresh is stale-while-decode: the painted signed URL
stays authoritative until its replacement has loaded and decoded off-DOM.
Only when no complete/stale frame can be retained may the controller show the
localized opaque recovery overlay, after a 150 ms delay. The overlay never
steals initial focus; while visible it alone is interactive and the scene is
`inert`.

**The initial snapshot does not depend on live-sync subscriptions** (#131).
`houseplan-card` first accepts config and layout, builds the model, chooses one
exact space, caches the accepted snapshot and restores its viewport. Only then
is the mandatory load complete. Config, trail and layout event subscriptions
start together as independent best-effort enrichments: one rejected channel
does not prevent the others from subscribing, does not erase the usable
snapshot and does not schedule a full-load retry solely for that rejection.
Missing channels get another attempt on the next normal load or reconnect.

`src/initial-load.ts` is the shared authority for the exact space used by a
cached snapshot, a live snapshot and its protected-backdrop candidate. When the
card config owns a `floor` property, `resolveFixedFloor()` has absolute
authority: a string is an exact stable id and a finite non-negative integer is
a zero-based server-model index. A valid fixed value beats URL hash, warm/current
state, saved navigation, `default_floor` and first space. Invalid explicit
values fail closed instead of falling back; numeric indexes wait for the fresh
server model before the first spatial frame. A fixed instance never reads or
writes `houseplan_card_nav_v1`, and every accepted `_space` transition passes
through the same fixed-authority guard.

With no own `floor` property, the legacy cold load considers only valid ids in
this order: URL hash, saved navigation, `default_floor`, first live space. Once
an initial URL hash has been consumed, a valid same-route current selection is
preserved instead of repeatedly snapping back to that hash. The legacy field
initializer is never a cold-start choice by itself. A plan with no spaces keeps
`null` authority and does not invent an id.

**Room climate is one pass per hass snapshot** (review R2-3). `areaClimateMap()`
classifies the whole registry once and returns `Map<area, {temp, hum}>`; the
card memoizes it on `hass` identity, which Home Assistant replaces on every
state change. Per-room lookups are O(1). `areaClimate()` survives as a
single-area wrapper for tests — using it in a render reintroduces the
O(rooms × entities) cost it was extracted from.

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
  borders/names + device markers (via `buildDevices`, same filtering) with NO marker
  handlers. Current states, values, alarms, temperature/LQI badges and witnessed activity
  use the shared `ResolvedDevicePresentation` and `renderDeviceFace`; optional card settings
  can disable ordinary live dressing, temperature or signal without creating another
  semantic implementation.
- `src/config-store.ts` — module-level `{config, rev, configFingerprint, layout,
  layoutRev, layoutFingerprint}` cache shared by all embedded
  cards (dedupes `houseplan/config/get`), seeded synchronously from the full card's
  localStorage snapshot (`houseplan_card_cfg_v1`) and invalidated on
  `houseplan_config_updated` or `houseplan_layout_updated` without first
  clearing the visible static snapshot.

**Static contract:** the schematic layer (`.hp-static-stage`) is `pointer-events:none`; the
footer button lives outside it and stays clickable.

**Deep-link contract:** the footer button calls `navigate(button_target + "#space=<id>")`
(default target `/plan-doma`). An unpinned full card reads `#space=<id>` on load (a valid id wins
over `default_floor`) and on `hashchange`, without blocking manual space switching; an
invalid/absent hash falls back to the default. A card with `floor` ignores the hash and remains on
its configured space.


## Additions v1.28–v1.41 (2026-07-24)

- **Decor layer** (`space.decor[]`, v1.33; unified editor 2026-08-07): purely
  visual line/rect/ellipse/text/furniture shapes, normalised geometry and
  physical per-shape style. `src/editors/decor/types.ts` is the typed persisted
  union; `geometry.ts` owns cm↔render conversion, oriented boxes and the
  decor+room magnet; `hp-color-opacity` is the shared colour/alpha control.
  `houseplan-card.ts` still owns orchestration, but every kind uses one
  selection/transform/history pipeline. `DECOR_SCHEMA` accepts canonical
  `width_cm`, text `size_cm`, opacity/fill fields, optional per-line
  `line_style` (`solid` / `dashed`; the frontend omits the legacy solid
  default), and legacy width/text-size representations for read compatibility.
- **Plan image transform**: `planRect()` resolves the fitted image plus
  `plan_x/y`, independent `plan_scale_x/y` and `plan_angle`; legacy
  `plan_scale` feeds both axes. The image is interactive only in its own
  Background tool, rotated corners contribute to content bounds, and the
  static card uses the same model. See `DECOR-EDITOR.md` and `BACKDROP.md`.
- **Independent Glow overlay** (#55): `settings.glow_enabled` is orthogonal to
  the data `fill_mode`; room `settings.glow` is the tri-state-compatible model
  foundation for #36. Legacy `fill_mode: 'glow'` remains a permanent read
  token and projects to data fill `none` plus Glow `true` unless an explicit
  boolean wins. Normal settings/room saves materialise that projection in the
  same write; Optimize Plans performs the equivalent idempotent model-v7
  migration. Render order is paper → resolved data room/tunnel fill → conditional
  pointer-free Glow base for rooms whose resolver result is absent or fully
  transparent → radial
  pools → sun/interactive layers. A resolved data/static fill (`lqi`, `light`,
  `temp`, `custom`) never receives the dark base, so its exact color and alpha
  remain visible; a dynamic mode without usable data or a custom fill with
  zero opacity receives the base instead of exposing bright paper. Radial pools stay
  independent and continue to render. The static
  room card uses the same data/base projection, omits empty base groups, and
  deliberately has no live pools.
- **Custom room fill** (#56): `space.settings.custom_fill` is the space color
  and `room.settings.custom_fill` is an optional explicit override. The pure
  projection is room → space → `{c:'#607d8b',a:.18}` and every read crosses
  `safeStoredColor` plus finite alpha clamping. `resolveEffectiveRoomFill`
  remains the single source for room floor, clean-floor holes and thick-wall
  tunnel colors; stored `room_color` continues to control borders/names only.
- **Glow pools and additive composition** (#19, #71): every source retains its
  own radial gradient and one `clipPath` — the floor that source can see. A spot
  is a single circle, screen-blended by `mix-blend-mode: screen`; all spots
  share one isolated parent and no outer opacity. `resolveGlowAppearance` resolves the marker-owned
  live/manual colour and brightness, while `glowAlpha` is the only intensity
  formula: `paletteAlpha * .7 * (.4 + .6 * bri^(1/2.2))`. That alpha is the
  gradient's centre; `GLOW_FALLOFF` then spends it over the whole radius
  (100/88/62/32/0 %) instead of holding a plateau to 70 % — a clipped shape
  used to become a slab of solid colour with a rim. The gradient is
  `userSpaceOnUse` and centred on the lamp, so attenuation is a property of
  distance from the lamp and of nothing else.

  **Transport is one question, asked once per source: what can this lamp see?**
  The full model, its exceptions and the reasoning behind them live in
  `docs/LIGHT.md`; the summary here is the map, not the territory.
  `_lightBarriers` collects everything opaque: the wall bodies exactly as the
  plan draws them (`wallBodiesGeometry`, real thickness, mitred junctions),
  every independent body (partition, column, draft), and the bare outline of
  any edge that carries no thickness. It cuts out the exceptions: doorways
  and gates — cut through the masonry, so an opening is a real gap
  between two jamb faces and a beam is narrowed by the returns of a thick wall
  — plus virtual (open) boundaries, which are not walls at all. Windows stay
  solid, so an indoor lamp never washes the street; the light's masonry is cut
  by passages only and therefore differs on purpose from the drawn one. So does
  a door with no floor behind it: an opening is transparent only where BOTH
  sides are floor, otherwise a front door glows halfway — up to the centreline
  where the room polygon ends — and the plan shows a lit doorway to nowhere. A wall
  treated as its centreline instead (the first cut of this model) let light
  bleed half a wall deep, which showed up as a bright bar at every opening, and
  started each shadow half a wall away from the corner casting it.
  Barriers are then split at every point where they CROSS each other
  (`splitAtIntersections`): the sweep casts a ray at each endpoint, so a corner
  formed by two faces crossing in their middles — normal where wall bodies meet
  at a junction — would otherwise never be sampled, and the fan would close it
  with a chord, leaving a sliver of floor dark next to a corner the lamp plainly
  sees. `visibilityPolygon` (`src/light-visibility.ts`) then sweeps the corners
  of those segments and returns the region the lamp reaches; intersecting it
  with the room floors gives ONE clip for ONE circle. A beam through a doorway, the
  room it lands in, the shadow of a column, a wall corner cutting that beam
  two rooms away and light crossing a virtual boundary are all the same
  computation, so they cannot disagree with each other — which is what every
  earlier bug here was made of (a doorway painted as an unlit bar, a beam
  detached from its aperture, a shadow blurred into a smear, walls in a farther
  room ignored). There is no spill layer, no sector, no tunnel rectangle, no
  open-zone graph and no shadow mask left in the light path.

  Barriers are cached per space by a fingerprint of their complete geometry
  (every body point, both wall endpoints and scale inputs), never by
  `_cfgEpoch`: the epoch lags behind geometry edited in place, and a stale
  barrier set is invisible — the plan simply keeps lighting through a wall that
  now exists. The same fingerprint keys the per-source region cache. A cached per-
  `Document` raster probe verifies actual SVG screen pixels rather than trusting
  CSS syntax support; pending/unsupported/error/timeout states render with
  deterministic normal blending and a successful probe requests one update.
  Radius remains global `settings.glow_radius_cm` with optional per-marker
  `glow_radius_cm`. The shared
  light resolver marks external `controls` as non-spatial: they vote in room
  state/statistics and drive group actions but never place a pool at the
  controller. `wall-thickness.ts` and the card orchestrator continue to own all
  geometry/caches; `render/opening-tunnels.ts` only projects immutable inputs.
  Opening-tunnel faces are emitted as one simple union contour per connected
  physical span: thickness steps are vertices on the outer envelope, never
  touching translucent rectangles. The negative and positive halves use the
  same nonzero winding across their tiny centre overlap, so fractional SVG
  rasterisation cannot cancel the fill into a seam or stack its opacity.
- **Open boundaries** (v1.37, revised 2026-08): `space.open_spans` hold
  geometric virtual stretches; `room.open_to` remains the light-zone index
  derived from spans (legacy `open_to`-only configs expand to full
  `sharedBoundary` on read). Shared stretches drawn as a TRUE dash; outlines
  trimmed (`outlineWithout`/`cutSegments`). In View the dash group is painted
  before thick wall bodies, letting real jambs mask its centreline ends; in all
  editors it is painted after the bodies so saved spans and previews remain
  fully visible. Geometry mutations clip one stored
  span to **every** surviving shared segment. Adjacent pieces owned by different
  room pairs stay separate: their midpoints are the source of the corresponding
  `open_to` links after Split (`AUD-159B7-01`).
- **Marker controls** (v1.36): persisted `marker.controls[]` is a lossless,
  ordered external-target list. Opening and saving the dialog preserves
  duplicates and temporarily unknown/vendor targets, removing only the
  marker's own bound/device entities. The runtime projection separately
  de-duplicates and filters to currently controllable lights/switches. For an
  explicit `tap_action=toggle`, `resolveToggleIntent` executes the available
  subset with HA-group semantics and reports missing/disabled/unsupported refs;
  icon state/tint mirrors the effective light graph.
- **Universal device action** (#94): `src/device-toggle.ts` is the only authority
  for toggle origin, exact target, capability/security filtering, next effect
  and service command. The dialog hint, click path, confirmation re-resolution
  and cover presentation consume the same immutable result. Exact `entity:`
  bindings never retarget to siblings; persisted controls never fall back to a
  controller's own entity; secure targets are explicit no-ops. The removed UI
  action `cover` remains accepted and losslessly round-tripped as a legacy
  origin until the user deliberately changes the selector. An absent action on
  a primary `light.*` likewise stays absent on an untouched Open → Save.
  `POWER_ADAPTERS` is the explicit domain allow-list and carries per-entity HA
  feature masks where a domain-wide service is not capability proof. The
  service catalog is a second fail-closed guard. A click resolves the current
  marker by id rather than using a retained #73 visual snapshot; the snapshot
  remains valid only for read-only presentation.
  Optional `marker.toggle_entity` is an exact own `light.*`/`switch.*` override
  layered before the legacy own-role resolver. Its absence leaves legacy
  single/group membership unchanged; an active explicit choice also joins an
  explicit controls group, while stale values fall back without being erased.
  It is deliberately independent from visual `marker.light_entity`.
- **Resolved device state** (2026-08-06): HA provides states per entity, not
  one state per device. `resolvedDeviceStateEntities` therefore starts from
  uncategorised registry entities, resolves one functional role (whole-device
  domains, then semantic binary signals, then one representative switch), and aggregates
  passive readings as the final fallback. `_visualSamples` consumes the full
  result; `primaryEntity` only selects its first member where a single action
  target is required. Integration option switches can no longer make an
  otherwise healthy device working or unavailable merely by list order. For
  A switch-only device never aggregates sibling option switches: integrations
  which fail to categorise night mode, voice enhancement or child lock cannot
  paint the whole marker as working. When generic HA metadata identifies a
  dedicated Power switch in such a composite controller, `on` is a neutral
  powered lifecycle and `off` reuses the faded unavailable presentation; a
  lone relay keeps normal working-state yellow. For `climate`, a recognized
  explicit `hvac_action` is authoritative: idle remains
  neutral and heating/cooling/preheating/defrosting are working. Unknown vendor
  pseudo-actions are ignored; when no recognized action exists, a current
  non-off state advertised by `hvac_modes` (or a standard HA HVAC mode) is the
  best available enabled-mode fallback.
- **Resolved light sources** (UX-12): `resolvedLightSources(hass, devices,
  room?)` is the only light-membership resolver. `marker.is_light` is a real
  tri-state: absent/null keeps automatic role discovery, `true` adds the
  marker's own source (including a passive source without HA entities), and
  `false` suppresses only that own candidate. A resolved source separates its
  `key` from `stateEids` and `serviceEids`: `marker:*` links are graph identity,
  never fake HA entities or service targets. Optional `marker.light_entity`
  selects the leading entity of a multi-channel forced source. External entity
  and marker controls remain independent room-state votes; a target marker owns
  position/statistics while the controller presentation still mirrors its
  aggregate working state. The graph uses a content fingerprint, excludes
  hidden/disabled targets, de-duplicates aliases, and honours `marker.room_id`
  before an HA area. Glow, Light fill, room light stats, marker indication/card
  ordering and group toggle all consume this result instead of maintaining
  separate domain tests. Per-marker
  `glow_color:{c,bri?}` can override colour alone or colour plus brightness;
  strict invalid overrides fall back atomically to live source values.
- **Island rooms** (v1.34): full nesting is legal (`polyContainsPoly`);
  parents render as evenodd paths with holes (`islandsOf`).
- **Kiosk mode** (v1.41): a card-config flag, not a mode — `_setMode` is
  hard-blocked, header hidden, swipe/carousel handled in the stage pointer
  pipeline (`swipeTarget`), per-screen multipliers in `LS_KIOSK`.
- **Nav persistence** (#93, #210): `LS_NAV` stores `{space}` only for unpinned
  cards; hash deep-link > saved > `default_floor`, with stale-cache retry after
  the live load. A card with `floor` neither reads nor writes `LS_NAV`, and its
  resolved stable id or server-order index remains authoritative across hash,
  warm remount and kiosk inputs. Editor mode is transient: cold load, reload
  and return from another HA route start in View. The warm memo may carry an
  editor only across a technical remount on the same route.

## View/editor transition ownership (#101)

`src/mode-transition.ts` owns the only RAF/token timeline for entering, leaving
and switching editors. `ModeTransitionController` interpolates measured editor
chrome height, stage geometry, world-space camera centre, logarithmic screen
pixels-per-unit, stage/paper colours, day/night brightness and presentation
weights together. Every intermediate SVG viewBox is derived from the current
stage aspect, so no default-fit or letterbox frame can appear. The stage is
inert while geometry is moving; header mode tabs remain available for a rapid
retarget. Reduced motion commits the exact target atomically. Visibility loss,
space change, recovery and disconnect cancel or settle this same owner rather
than leaving CSS timers or WAAPI animations behind.


## Settings tiers (owner's principle, 2026-07-26)

Four levels: **global (config.settings) → space (space.settings) → room
(room.settings) → device (marker.*)**. Duplicated options are deliberate: the
more specific tier overrides the more general one; "unset" always means
"inherit". Resolution lives in pure helpers (`spaceDisplayOf`,
`roomFillModeOf`, `sourceValue`, `resolveToggleIntent`) — never inline in render.
The UI will later be unified around this model; until then each tier keeps its
own dialog (general settings gear / space gear / room-card gear / marker
dialog).


## Audit follow-ups (2026-07-27)

- **Content is authenticated.** `/houseplan_files/…` now serves ONLY the card
  bundle (a Lovelace resource must be public). Plans and marker files go
  through `HouseplanContentView` (`/api/houseplan/content/<plans|files>/…`,
  `requires_auth`). `contentUrl()` rewrites legacy stored URLs on read, so no
  storage migration is needed. Static paths cannot be unregistered — the old
  routes survive until the next HA restart.
- **Optimistic UI, stated explicitly (audit L7).** `_serverCfg` is mutated in
  place before a fallible save in ~22 places and there is no rollback: after a
  rejected save the UI shows the edit until the next reload. This is a
  deliberate optimistic-UI choice, not drift. Paths where it is unacceptable
  need their own rollback.
- **Split invariant.** `splitRoomPath` guarantees a partition: the two parts'
  areas sum to the original (within epsilon) or the cut is rejected.
