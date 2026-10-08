# House Plan architecture

Kiosk hold-to-modal input (#831) transfers stage suppression to an instance-local
`TouchGestureClickGuard` modal-tail barrier before interrupting the stage. Its
owning pointer survives implicit capture loss until actual release/cancel; an
unrelated terminal cannot re-arm it. A fresh pointerdown after that boundary or
Enter/Space permits native dialog activation without a timeout. The existing
multi-touch post-gesture barrier remains independent and cannot be re-armed by
modal keyboard intent. No pointermove work or editor runtime is added.

Resize atom projection (#832) prepares frozen oriented run/vertex correspondence
in `resize-atom-projection.ts`. Solver handles remain coalesced; preview restores
the original ordered structural vertices before updating catalogue IDs. The
gesture owns one catalogue/consumer closure: only owners of changed IDs resync
their compatibility polygon. An inactive owner's same-thickness collinear
identity vertex may move on its unchanged run, never a corner or physical
thickness boundary. Both incident atoms must agree. Metadata, full physical and
junction barriers still run before paint/commit; terminal/reset drops the map.

One HACS repository (category **Integration**) ships the backend
(`custom_components/houseplan`), both Lovelace cards and the `/houseplan` panel
(`src/` → `dist/`). This document is the map: each subsystem gets a short
description and a link to its canonical document, which owns the details.

## Wall-node editing (#803)

Node movement (#803) is a lazy Select-only subsystem: `wall-node-move.ts`
freezes the structural graph, `wall-node-editor.ts` owns capture/cancel and
the isolated live roots, `wall-node-preview.ts` renders the local complete-body
closure through production masonry/inner-contour/opening functions, and
`wall-node-write.ts` serializes the dedicated server operation with existing
writers. Remote paper, fills and masonry stay in the settled DOM. #828 gives
every transient warning, guide, X prompt and active handle one live owner;
the full Lit scene owns only stationary handles. At pointerdown the already
presented production masonry/axes/zero lines are frozen once (without room
fills, opening symbols or snap handles). One .35 source layer above candidate
paper/fills and below candidate masonry clips that snapshot to changed old
arms, retaining opening cuts and ordinary unchanged neighbours. Its coverage
is gesture-local and reused while the target moves; even an unbuildable
candidate can show the source. Cancel/commit/context retirement releases it.
Old settled local geometry remains masked out so it cannot duplicate either
source or candidate. These masks do not rebuild full-floor geometry per pointer.
Preview never replaces
the authoritative config, model cache or recovery snapshot. The backend mirror
`wall_node_move.py` derives the delta and independently proves an inverse before
Undo; a separate original-interval/midpoint ledger proves the only allowed
host-ID changes before strict partition-jamb validation, without copying
authority from the candidate. `config/set` keeps its existing host protection.
The ledger read-normalises a copy of the durable legacy input before deriving
structural identities, just as the first proof does; it never migrates on hover.
Details: CANVAS.md, UX-MODES.md, WALL-THICKNESS.md and CONFIG-COMPATIBILITY.md.
Every live paint rechecks its frozen context before constructing SVG groups;
mode/floor/revision adoption retires capture and masks before the settled render.
`editor-shared` isolates shared lazy helpers so the editor entry retains its
named API on both its normal import and its opaque immutable-URL retry.
Both stable entry facades hoist any extra eager chunk imports into the same
awaited fallback boundary, before the implementation. A deleted extra chunk
therefore cannot abort the entry before its stale-update message is installed;
the manifest retains every eager dependency.
The write terminal refreshes history controls even when its own revision
adoption already retired the live preview before the command was recorded.
The frozen local baseline retains its geometry and guard carrier for one
gesture. `wall-local-boolean` keeps disconnected canonical components out of
repeated clipping sweeps; touching bounds still invoke the original boolean
library. These are exact broad-phase exclusions, not relaxed wall limits.
Snap arbitration keeps its winning axis guide but preserves an exact compatible
non-parallel H/V point instead of moving it with longitudinal quantisation.
Retired click-tail suppression checks stage ancestry and permits keyboard
clicks (`detail=0`); it cannot immobilise header/toolbar controls after a drag.

## Styles (#266)

`src/styles.ts` composes `cardStyles = [base, plan, devices, chrome, dialogs,
isoTiles]` from `src/styles/*.styles.ts`; the order is a cascade contract (the
golden set is accepted against it; `isoTiles` last so 2.5D tiles beat
equal-weight Flat marker rules, #649). `base` holds host, variables and rules
shared by two surfaces; `plan` stage ink, `devices` markers, `chrome`
toolbars/tabs/menus, `dialogs` dialogs/forms/pickers. `form-kit.styles.ts`
(#594), `editor-secondary.styles.ts` and the summary-panel sheets live outside
that aggregator. `test/styles-split.test.mjs` pins composition, no cross-file
duplicate selectors and `@media` wrappers; `scripts/dev/styles-diff.mjs` proves
a move refactor-only. Public selectors: `STYLING-HOOKS.md`. CSS only the
editor renders is not in the first frame (#805): `editor-dialogs.styles.ts` (the
editor-only rules of `dialogs`) and `editor-secondary.styles.ts` (the tray) are
adopted by the lazy editor runtime's constructor (`editor-style-adoption.ts`) into
their old cascade slots — after `dialogs` and after `cardStyles`; ownership and the
reverse ratchet live in `test/editor-dialog-styles.test.mjs`.

## Layout

```
houseplan-card/
├─ src/                                  # card sources (TypeScript + Lit 3)
│  ├─ houseplan-card.ts                  # eager full card: View shell, HA lifecycle, lazy-runtime hosts
│  ├─ houseplan-panel.ts                 # /houseplan sidebar host around one full card (#486)
│  ├─ space-card.ts · space-render.ts    # read-only houseplan-space-card and its static renderer
│  ├─ houseplan-editor-runtime.ts        # lazy Plan/Devices/Background composition root
│  ├─ houseplan-onboarding-runtime.ts    # lazy first-space/import dialogs, independent of the editor
│  ├─ iso-*.ts · pdf/ · stairs*.ts · furniture*.ts  # 2.5D, PDF export, stairs, furniture (own docs)
│  ├─ devices.ts · rules.ts              # device list from registries; icon rules and exclusions
│  ├─ ha-binding-status.ts · device-presentation*.ts  # binding authority; marker face decisions
│  ├─ space-geometry.ts · wall-*.ts · physical-geometry.ts · logic.ts · types.ts  # pure, no Lit/DOM
│  ├─ config-store.ts · config-adoption.ts · command-stack.ts  # config cache, #500 boundary, Undo
│  ├─ sun.ts · day-cycle-render.ts       # window rays, four-phase background (SUN.md)
│  ├─ vacuum*.ts · radar-*.ts · zigbee-topology*.ts · summary-panel*.ts  # live subsystems
│  ├─ hp-dialog.ts · hp-confirm.ts · danger-confirm.ts · hp-help.ts · floating-surface*.ts
│  ├─ editor-runtime-loader.ts · version-recovery*.ts · editor-secondary.ts  # lazy loader; #462; tray
│  ├─ editor.ts · space-editor.ts        # Lovelace GUI config editors of both cards
│  └─ editors/ · render/ · styles/ · i18n/  # settings dialogs, SVG projections, sheets, locales
├─ dist/                                 # two stable entries, houseplan-assets.json, hashed chunks
├─ demo/                                 # demo rig and smokes; golden/ (HP-QA-01), performance/
├─ scripts/ · .github/workflows/         # build/bundle gates, release-*.mjs; CI and release
├─ custom_components/houseplan/          # the HA integration
│  ├─ __init__.py · store.py             # setup/unload; versioned stores and per-entry runtime data
│  ├─ websocket_api.py · http_api.py · auth.py  # WS commands, uploads, the one may_write policy
│  ├─ validation.py · coordinate_canonicalization.py  # pure schema validation, write canonicalisation
│  ├─ frontend_registration.py · frontend_assets.py · panel_registration.py  # resource, chunks, panel
│  ├─ import_export.py · decor_assets.py · plans.py  # backup/import, decor images, plan blobs
│  ├─ trails.py · vacuum_routes.py · radar*.py · virtual_lights.py  # live-subsystem backends
│  ├─ config_flow.py · const.py · system_health.py · diagnostics.py · repairs.py · support_*.py
│  └─ frontend/                          # release-only snapshot of dist (#657)
└─ docs/                                 # this documentation
```

Rollup emits two stable roots, `houseplan-card.js` and `houseplan-panel.js`,
plus hashed chunks and `dist/houseplan-assets.json` (graph, sizes, SHA-256).
The panel imports the card chunk by its hashed name, never through the card's
unversioned facade: entries are served without `Cache-Control`, and a stale
facade once ran an old card against the current backend (#535). Both roots keep
the fail-loud stale-load wrapper. View loads only the initial graph; editor,
onboarding, 2.5D (#649), PDF, locale and furniture-art graphs are lazy, each
passing the exact-build fingerprint handshake (one cache-busted retry, atomic
install), and `scripts/bundle-budget.mjs` fails a build whose lazy graph is
missing or leaks into the initial graph. The backend serves only manifest-listed
chunks. Commands and gates: `DEVELOPMENT.md` › Build, › Tests, › Release.

## Key decisions

1. **One repository — integration + panel + cards.** The integration serves
   its own JS; the exact versioned module URL is the resource identity, a
   writable Lovelace resource registry is authoritative and `add_extra_js_url`
   the truthful fallback. Each `houseplan/config/get` carries the authoritative
   `integration_version`: View offers a manual reload, kiosk reloads once per
   backend target in a safe idle state, the space card has no version controller
   (`DEVELOPMENT.md` › Resource registration and version recovery (#462)). After
   migrations succeed, setup registers the public `/houseplan` panel
   (`require_admin=False`, #486): a thin app-bar host around one ordinary full
   card, fail-soft, removed on unload only by the exact owner and setup
   generation (`UX-MODES.md` › Principle; `TESTING.md` › Installation / upgrade /
   removal). In a Sections `layout="grid"` slot HA owns the height: `.stage` is
   the shrinking flex child and transitions use the measured card height, never
   `window.innerHeight`; `getGridOptions()` is full width, 10 rows, min 6 (#648).
2. **Server-side storage, no token.** `store.py` keeps `.storage/houseplan.config`,
   `houseplan.layout` (marker positions) and `houseplan.virtual_lights`;
   `trails.py` keeps `houseplan.trails`. All traffic uses the frontend `hass`
   connection (Integration WS API below); House Plan opens no socket and holds no
   token. localStorage keeps a start-up snapshot and, only if no backend ever
   answered, a local layout. Registries come from one `ha-binding-status` fetch
   and subscription pair per HA connection, shared by every card on the page;
   live rows augment an older snapshot at once and a debounced full reload
   reconciles `disabled_by` even without registry events (`FILTERING.md` ›
   Behaviour).
   Reinstallation (#820) is an admin-only HA config-flow choice, not a runtime
   cleanup action. `previous_data.py` inventories these four fixed Store files
   and `houseplan/{plans,files,assets}` read-only in the executor; only the config
   JSON is read, without calling Store or triggering migrations. Restore uses
   the unchanged setup path. Fresh, on final `user` confirmation only, renames
   the complete set to `houseplan/archive/<unique UTC timestamp>/storage/` and
   its three sibling data directories. Archives are outside active discovery,
   quotas and housekeeping and have no automatic retention cleanup. Unsafe
   links/cross-filesystem moves abort before transfer; handled errors reverse
   completed renames, without overwriting files. A failed rollback preserves
   the partial archive and logs its path; this is not a crash-atomic transaction.
   Single-entry/in-progress fences prevent moving an active installation's data.
3. **Reactivity.** Every `hass` update re-renders. Registry rebuilds also run the
   pure `device-area-relocation` resolver: pending ids override stale layout in
   full and static cards at once; the writer deletes those points before
   advancing Area provenance and restores them if the config write is rejected
   (a failed restore leaves the attention marker); only the moved device's
   Undo/Redo is invalidated; limited snapshots never infer movement
   (`CONFIG-COMPATIBILITY.md` › Marker Area provenance (#126)).
4. **One modal contract.** Card modals render through `hp-dialog`: `ha-dialog`
   if registered when the instance connects, otherwise a first-class native
   `<dialog>` for its lifetime (top layer, backdrop, reopened once if `:modal`
   was lost); a late registration never swaps an open surface, and alert
   confirmations stay native for real `alertdialog` semantics. The wrapper owns
   title, initial focus, Escape and a shadow-root-scoped restore-focus session
   (nested dialogs return to their trigger, a replacement to the first opener).
   `flex-content` forwards `flexcontent` so an inner scroller is height-bound
   (#508); the footer stays a full-width slot item; titles wrap; destructive
   actions stay left while Cancel/Save wrap right together. Dangerous actions
   use one eager `HpConfirmController` on `HouseplanCard` plus stateless
   `hp-confirm` (#32): replace-not-queue, every dismissal cancels, a token
   rejects stale decisions, callers re-resolve targets after `await`. Native
   `confirm()` is not a supported surface.
5. **Open passages are negative architecture (#157).** `type=passage` shares
   placement, wall cut and tunnels with other openings but has no leaf, binding
   or 2.5D panel; static wall fingerprints add only passage cuts, so door/window/
   gate output is unchanged (`CONFIG-COMPATIBILITY.md` › Open-passage opening
   type).
6. **One transient-surface contract (#68, #57).** `hp-dialog` keeps a scoped
   LIFO registry for help and colour-picker surfaces: Escape/toast close the top
   one first; a new one replaces the previous only inside the same dialog.
   `hp-help` and `hp-color-opacity` share `floating-surface.ts` placement and
   `floating-surface-controller.ts` (Popover top layer, dialog-owned portal
   fallback). Help is localized by the owning card and exists only when body and
   accessible label are both non-empty. Page-wide lazy runtimes — locales
   (#62, #400) and furniture artwork (#474, #593) — settle after two failed
   attempts into English / no artwork with one toast, never an inert card.
7. **One four-phase environment resolver.** `resolveDayCycle()` (`src/sun.ts`)
   and `src/day-cycle-render.ts` serve View, kiosk and the space card; plan
   content is never phase-filtered (`SUN.md` › Current four-phase background).
   The stage-sized outline root owns the triple drop-shadow and
   `will-change: filter`; its child is only the exact paper alpha silhouette,
   and the plan root gets an explicit stage-sized transform layer so Chromium
   never rediscovers it as an implicit overlap layer (#532, #582).

## Coordinate system

Plan geometry and marker positions are stored normalised on an unbounded canvas:
`0..1` = `NORM_W` (1000) render units, `±5000` validation, `1/240` lattice
(`src/canvas-constants.ts`). Source of truth: `CANVAS.md` › Principle, › Model,
› Grid precision and visual units, › Persisted coordinate canonicalisation.

## Card data model (runtime)

**Optional space model (#113).** Without authoritative spaces there is no
`SpaceModel`: `_spaceModel()` returns `undefined` and never invents one. Its
active-or-first choice serves rendering and navigation only; commands carrying a
stable space id use the exact `_spaceModelById()` and abort on a stale id before
any config, layout, file or service effect (`space-model-selection.ts`). The
first update that sees an authoritative empty `spaces` runs one cleanup (pointer
capture, gestures, draft/history, space dialogs, pending config write, back to
View); recreating a space re-arms it. Pure helpers may return empty results;
mutation entry points guard explicitly.

**`DevItem`** (`src/types.ts`) is rebuilt by `buildDevices()` (`src/devices.ts`)
from the active registry projection plus config markers: id, name, model, area,
space, icon, `entities[]` (active runtime entities only), `allEntities[]`
(metadata only), `primary` (first resolved state entity for single-target
actions; marker faces use the resolved role, `DEVICE-PRESENTATION.md`),
temp/hum, marker metadata and effective `controls`. `bindingStatus` (`active`,
`ha_disabled`, `orphaned`, `unverified`) comes only from
`resolveHaBindingStatus()`, never mutates markers, and gates every plan-level
consumer (Glow, climate, LQI, live text, openings, controls, vacuum).
Auto-discovery takes non-service devices whose HA Area is bound to a space. The
base icon is the first matching icon rule (`"<name> <model>"`) → entity
`device_class` → `mdi:chip`; a device with a `lock.*` entity is always
`mdi:lock`. Duplicate `name|area` pairs are numbered; HA light groups and Z2M
group devices become `lg_<entity>` items that fold their lamps. Hiding is
`FILTERING.md`.

## Live data

State, values, LQI and activity are resolved once per frame into one
`ResolvedDevicePresentation` (see Device markers); explicit `marker.value_source`
and `marker.value_badge` go through `src/device-value-badge.ts`. Decision table,
plate colours and LQI scale: [`DEVICE-PRESENTATION.md`](DEVICE-PRESENTATION.md).

### Presence radars (#485 Stage 1)

`marker.radar` is an optional versioned namespace saved only by the ordinary
config transaction. One backend `RadarCoordinator` per entry alone reads raw HA
states and streams clipped, ACL-filtered frames over `houseplan/radar/subscribe`;
observations, calibration samples and trails never reach config, uploads,
support reports or browser storage. Contract and code map: [`RADAR.md`](RADAR.md);
normative limits: [`specs/485-radar-presence-stage1.md`](specs/485-radar-presence-stage1.md).

### Robot vacuums

`src/vacuum-routes.ts` is the only map-to-space authority (six fail-closed
results, #162; mirrored byte-for-byte by `vacuum_routes.py`), `src/vacuum.ts`
owns telemetry normalization, path arbitration and smoothing, and `trails.py`
records runs server-side. Contract and code map: [`VACUUM.md`](VACUUM.md).

## Sizes

`icon_size` is a percentage of the plan (default 2.5; legacy px values > 8 fall
back to 2.5), converted once at the surface boundary and rendered in `cqw` inside
`.stage { container-type: inline-size }` — [`CANVAS.md`](CANVAS.md) §6.

## Sticky header

`.head` is `position: sticky; top: var(--header-height, 56px)`, so ordinary
dashboard cards keep `ha-card { overflow: visible }` (hidden overflow breaks
sticky). The bounded `panel-host` and Sections `layout="grid"` branches own their
complete height chain and clip at the external slot instead (Key decision 1).

## Device markers

`config.markers[]` records are
`{id, binding: 'device:<id>'|'entity:<eid>'|'virtual', space?, area?, hidden?, removed?, name?, icon?, …}`
plus presentation, light, control, vacuum and radar fields (`validation.py` is
authoritative). Registry devices appear on their own; a `device:` marker
overrides one, `entity:` covers groups/helpers, `virtual` is a manual icon. The
id (device id, `lg_<eid>` or `v_<rand>`) keys the layout. `hidden` is the
reversible hide flag, `removed` a never-rendered binding tombstone ([`FILTERING.md`](FILTERING.md)).

View, kiosk, the static card and the dialog preview share one pipeline:
`device-visual.ts` classifies, `device-presentation.ts` resolves sources, the pure
`device-presentation-policy.ts` owns priority, `device-pulse.ts` owns activity and
`device-face.ts` only paints. `normalizeDeviceDisplay()` is the mandatory read gate
for `display` (`badge|icon_ripple|value|static_icon|value_static_icon`; legacy
`ripple` → `icon_ripple`). The saved coordinate is the icon-core centre;
overlapping 44 px targets get one screen-space owner (`device-hit-owner.ts`),
latched for the whole pointer sequence. Rules: [`DEVICE-PRESENTATION.md`](DEVICE-PRESENTATION.md);
stored fields: [`CONFIG-COMPATIBILITY.md`](CONFIG-COMPATIBILITY.md).

`device-battery.ts` adds an independent own-device diagnostic to the same frozen
presentation. An ownership index is cached against the full HA entity registry;
values come only from active state rows. Entity-bound markers explicitly capture
their physical sensor siblings in the render snapshot, so battery-only ticks
invalidate the correct frame without changing the functional roster or actions.
The default-on shared `settings.show_device_battery` switch does not depend on
face static/live policy; exact `marker.hide_battery:true` adds a per-marker
O(1) gate before the battery resolver, while absence/false inherits the global
choice. Active LED representations omit the indicator. The
passive out-of-flow frame uses one built-in HA MDI icon at the three designer
control sizes, without separate artwork delivery. A continuously sized CSS
drop-shadow is composited on that existing icon; it adds no DOM, observer or
registry scan. Zigbee routes and captions have separate stacking levels: endpoint cores
remain above routes, captions remain above their batteries. Endpoint markers rise
above the route layer as a whole, battery included, so a route copy one level
higher is clipped to their battery frames: routes paint over batteries without
covering cores (#808). The same copy is also clipped to the value-badge frames
of the endpoints, measured in the same layout frame without padding (only the
flex gap separates a badge from its core), so lines and arrows paint over badges
too (#829). A topology snapshot is labelled stale after an hour.

Attachments are staged in `up_*`, promoted into `<config>/houseplan/files/<id>/`
on Save and served by signed `/api/houseplan/content/files/…` URLs (Integration
WS API). Custom Background images use the content-addressed
`<config>/houseplan/assets/` store (`asset_id` = SHA-256 of canonical bytes;
config never carries bytes or URLs) — [`DECOR-EDITOR.md`](DECOR-EDITOR.md) §7.

## Server-side configuration

`.storage/houseplan.config` holds `{model_version, spaces[], markers[], settings}`.
A space carries plan-image fields, `rooms[]` (with ordered `wall_ids`),
`wall_segments[]`, `partitions[]`, `wall_columns[]`, `openings[]`, `decor[]`,
`stairs[]` and `settings`. Coordinates keep the historical normalization
(`1.0` = `NORM_W` = 1000 render units) on an unbounded plane with a ±5000 guard
([`CANVAS.md`](CANVAS.md)); `plan_aspect` letterboxes the image and `plan_x/y`,
`plan_scale_x/y`, `plan_angle` transform it ([`DECOR-EDITOR.md`](DECOR-EDITOR.md) §3).
Layout v2 maps `device_id | rl_<roomId>` to `{s, x, y}`. Plan files are
copy-on-write `<config>/houseplan/plans/<space>.<token>.<ext>`, never deleted for
age ([`SCOPE.md`](SCOPE.md)). Migrations: [`CONFIG-COMPATIBILITY.md`](CONFIG-COMPATIBILITY.md).

### Persisted colour boundary

Every stored colour is exactly `#RRGGBB`: `src/color.ts` resolves it and
`validation.py::_COLOR` guards writes. Render-time resolvers re-apply a safe
default because old, imported or hand-edited stores are not migrated on read.
HA `rgb_color` is live state: three finite channels, clamped/rounded to 0–255 and
emitted only as generated `rgb(R, G, B)`. The final inline-style sink accepts
only those two forms; arbitrary CSS colour syntax would need a separate
product/security decision and must not be added to an individual sink.

## Room and independent wall geometry

Model v10 (#282, #306, #478): `wall_segments[]` is the authoritative catalog of
atomic room-wall intervals with stable ids, `rooms[].wall_ids[]` orders each
contour, and room polygons plus `walls[]` are read-compatibility projections.
Every accepted Walls-chain edge is an ordinary `partition`; `wall_columns` are
square/circular columns; neither creates or implicitly splits a room or HA area.
`cm:0` keeps a structural axis and identity without masonry; `space.zero_wall_style`
makes it dashed (transmits light) or solid (a zero-area barrier). Reads are
projection-only: a physical-geometry mutation builds a local candidate,
canonicalizes it, materialises the catalog (`src/wall-segment-model.ts` ↔
`wall_segment_model.py`, shared parity fixture), validates references and commits
one config transaction; ambiguity fails closed with no partial config, history or
revision. Model and lineage: [`WALL-THICKNESS.md`](WALL-THICKNESS.md) §1;
migrations and stale-client guard: [`CONFIG-COMPATIBILITY.md`](CONFIG-COMPATIBILITY.md)
(model v8–v10); rationale: [`adr/282-wall-geometry-representation.md`](adr/282-wall-geometry-representation.md).

The validated candidate is adopted in place only at the commit boundary (#826).
Root and id-bearing editor records retain identity; scalar arrays receive their
own shallow copy so shared point tuples cannot overwrite another owner during
recursive adoption. Values and property order match the candidate exactly;
the candidate is never mutated. This is not a full live-model clone or new
pointermove work, and array identity without an id is not a gesture guarantee.

Room-face acceptance uses `wall-face-lineage.ts` to choose provisional carriers
and settle only new-room hints against the partitions left after reconciliation
(#804). A residual keeps its identity without colliding with the promoted room
edge. The common model barrier, host validation and atomic history remain the
authorities; this helper neither allocates IDs nor writes configuration.

Rooms may not partially overlap (lying on a shared wall is legal, a fully nested
island is supported). Merge/Split use **polyclip-ts** (not `polygon-clipping`,
see [`DEVELOPMENT.md`](DEVELOPMENT.md)): Merge accepts a pair only when the union
is one hole-free outline; Split cuts wall-to-wall and the larger part keeps the
room identity (name, area, devices).

`wallBodiesGeometry()` is the single physical masonry for flat full/static
rendering, 2.5D, paper, clean floor and Glow/sun occlusion. Its exterior shell
comes from the union of room centrelines plus surviving `outer` atoms; junctions
follow the bounded mitre/bevel rules (#249, #271, #272, #275, #288, #302, #309,
#310); independent bodies join through `physicalBodySet()` while raw quads keep
editor identity. The result is a typed component set (`ok`, `degraded-extra`,
`failed-core`; #197, #278): rendering keeps every valid component, mutation
preflight rejects `degraded-extra`, `failed-core` fails dark. It is computed state
only — cached per structural geometry, never written back, never rebuilt by HA
state ticks. Contract: [`WALL-THICKNESS.md`](WALL-THICKNESS.md) §2–§4, §9–§11.

Floor-geometry caches are keyed by their inputs, never by the global config
epoch, and their keys and pools come from one module, `src/floor-geometry-key.ts`.
The wall union, physical bodies, inner contours and clean floors key by the
content of one floor record (#744, #769); the union, the bodies and the opening
tunnels keep a bounded pool of recently shown floors (eight, LRU) next to the
active entry, so a warm floor switch builds none of them (#814). The opening
wall index and the sun wedges key by every input they read (#814); an edit of
another floor or a shared setting leaves them warm. Every pool is an
instance-local memo: nothing is persisted, and a remounted card starts empty.

## Markup editor

Card state: `_mode`, `_tool` (`select|draw|column|merge|split|resize|opening|
stairs|wallthick|delroom`), session `_path` on the `GRID_N = 240` lattice
(`_snap`, `CANVAS.md` §9). Committed geometry enters the named 50-command
Undo/Redo stack shared with Background (`DECOR-EDITOR.md` §6, §9); it survives
the echo of its own writes and clears on a newer external revision. Every
physical-geometry writer crosses one fail-closed boundary (#278,
`checkSpacePhysicalGeometry()`) before history/save, rechecked at the deferred
write; presentation edits bypass it. Contracts: Walls chain, faces, room
deletion, partitions — `WALL-THICKNESS.md` §6, §9–11, `CONFIG-COMPATIBILITY.md`
(#478, #461), `TOUCH-SUPPORT.md`; Resize (#277, #300) — `RESIZE.md`; near-axis
(#290, `src/near-axis.ts`) — `CANVAS.md` §9.3. `reconcileCoincidentPartitions`
(#276/#296/#477) and `normalizeWallIntervals` (#299) run plan-wide only in
explicit Optimize, locally in chain finish/room deletion, never in render or
ordinary saves. Saves strip the legacy root `space.segments`.

### Stairs (#663)

Separate Plan entity, not decor (`STAIRS.md`). Eager `StairViewRuntime`:
symbols, tooltip, guarded navigation; lazy `StairEditorRuntime`: drawing,
transforms, magnets, properties (a plan never loads the editor graph). The root
card keeps lifecycle, shared history/persistence and stage pointer terminals;
pure model, tread/trapezoid geometry and style resolution stay in `stairs.ts`.

The optional `color`/`opacity` and `fill_color`/`fill_opacity` fields are a
snapshot owned by the stair. Missing legacy fields resolve at render/dialog
time from the current decor default but are not written until the user saves
that stair. Screen renderers consume the colour fields; PDF deliberately uses
the same geometry with its existing monochrome ink palette.

## Editor chrome and contextual controls

One stable `.editbar` per editor: `.editbar-tools` (persistent tools,
Undo/Redo) and pinned `.editbar-end` (Close); transient controls never enter
this measured row. Selection actions, tool parameters, hints, palettes and the
approved groups (Opening, Stairs) come from one `EditorSecondaryModel` in the
single light-DOM `.editor-secondary-host` inside `.stage`
(`editor-secondary.ts`): outside the `_hdrH` measurement, pointer events only
on its visible surface, empty in the Device editor (future marker quick
actions go there). Mutating actions revalidate a deterministic `contextId`;
`Delete`/`Backspace` never fall through from it. Product rule: `UX-MODES.md`.

## Doors, windows, gates & passages

`space.openings[]` is plan geometry, not markers: `{id, type:
door|window|gate|passage, x, y, angle, length, host?, contact?, lock?, invert?,
flip_h?, flip_v?}`. `host` `{kind: wall|partition, id, t}` is authoritative and
`x/y/angle` its atomically refreshed projection; an absent host is the legacy
room-wall association, and no host ever falls back to a nearest wall
(`CONFIG-COMPATIBILITY.md` › #132/#157). One `OpeningWallIndex` feeds symbol,
cut, tunnel fill, Glow and the 2.5D face (`WALL-THICKNESS.md` §3–4,
`ISOMETRIC.md`, `LIGHT.md`). The Flat symbol follows easy-floorplan (MIT).
`openingAmount()` maps contact state to 0..1 — no sensor: door/gate open,
window closed; `unknown`/`unavailable` keep that default. Contact and lock are
opening-owned exact references: candidates follow HA binding status, render
reads the frozen active-registry projection (never raw `hass`), neither
consults marker tombstones. The `.oplock` badge never toggles a lock
(`resolveToggleIntent` → no-op, `SCOPE.md`); openings are edited only in Plan.

## Integration WS API

Space deletion from the editor uses `editors/space-delete.ts`
after confirmation (#819/#826). The caller retains its confirmation copy;
the shared path re-resolves the dialog/space and confirmed marker set, flushes
pending writes, then adopts re-read config/layout rather than the delete reply.
This lazy module imports the editor host only as a type, never the editor runtime.
The card delegates to the editor; the space-settings form port supplies Delete.
Onboarding supplies only create/import controls, not a deletion port/adapter.
The TS pure mirror clears only incoming stair targets after an actual accepted
deletion, matching Python; blocked or absent targets cause no cleanup. The WS
endpoint rejects an absent target before calling its pure candidate.

`space/delete` filters explicit vacuum map routes to the deleted space inside
`_space_delete_candidate` (#822), before the existing paired commit. It keeps
other routes, root vacuum settings and the dock intact; an emptied list stays
`[]` to retain its precedence over legacy calibration. Refusals do not mutate
either Store, and there is no extra config write or schema/WS-key change.

`auth.may_write()` is the single writer policy for WS and HTTP: administrators
always write; `admin_only` (default `true` when unset) restricts writing to
them; with `admin_only: false` other users write unless they belong to
`system-read-only`. A missing entry or incomplete group data fails closed.
Reads are deliberately broader: every authenticated user receives the complete
config/layout (no per-entity projection), trails without `source` entity ids
(#626) and may toggle virtual lights. **W** = writer-only (else
`unauthorized`); runtime-backed commands answer `not_ready` before setup.

| `houseplan/…` | Parameters | Result · domain errors |
|---|---|---|
| `config/get` | `space_id?`, `fields?`, `marker_fields?` (#256; project only the document) | `{config, rev, virtual_lights:{rev,config_rev,off[]}, can_write, can_optimize_undo, undo_kind, integration_version, support_api, decor_assets_api, summary_panel_api, radar_stage1_api?}` |
| `config/set` **W** | `config`, `expected_rev` | `{ok, rev}` · `conflict`, `too_large` (2 MiB), `invalid_format`, `missing_plan`, semantic codes below |
| `layout/get` | `space_id?` | `{layout:{id:{x,y,s?}}, rev, can_optimize_undo, undo_kind}` |
| `layout/set` **W** | `layout`, `expected_rev` | `{ok, rev}` · `conflict` (external clients; the card writes points) |
| `layout/update` **W** | `device_id`, `pos` | `{ok, rev, ignored?: removed\|missing_virtual}` — a tombstoned owner's late drag is acknowledged, not stored |
| `layout/delete` **W** | `device_id` | `{ok, rev}` (`rev: null` when nothing was stored) |
| `space/delete` **W** | `space_id`, `expected_config_rev`, `expected_layout_rev`, `remove_markers?` (#819: the blocking markers go as with the device dialog's Delete, in the same pair write; ignored for the last space) | `{ok, config_rev, layout_rev, removed_layout, removed_markers}` · `space_in_use` (without `remove_markers`), `space_not_found`, `invalid_space_id` |
| `plan/optimize` **W** | `config`, `layout`, both expected revs | `{ok, config_rev, layout_rev, can_undo}` — also the server-side wall-model migration barrier |
| `plan/optimize_undo` **W** | both expected revs | restores the one-deep Optimize/full-import backup · `no_backup` after any later edit |
| `geometry/repair` **W** | `space_id`, `aspect`, `dry_run?`, `undo?`, `expected_rev?` | manual re-transform of one space's positions (HP-1500-01) with one-deep `repair_backup` · `nothing_to_repair`, `no_backup` |
| `export/create` **W** | `kind: full\|space`, `space_id?`, `plan_only?`, `card_version` | `{document, filename}` |
| `import/revalidate` **W** | `token`, `duplicate_policy?` | refreshed preview and current revisions |
| `import/apply` **W** | `token`, both expected revs, `duplicate_policy?`, `confirm_missing_content?` | paired commit; full import gets one-deep undo · `conflict`, `preview_expired`, `content_confirmation_required`, `missing_plan`, `missing_content` |
| `virtual_light/toggle` | `marker_id` | `{marker_id, on, rev}` · `not_toggleable` |
| `trail/get` / `trail/delete` **W** | — / `marker_id` | `{trails:{marker:{current,previous}}}` / `{ok, removed}` |
| `plans/list` **W** / `plans/delete` **W** | — / `name` | newest 60 `{name,url,size,modified,used_by}` + `total` / `{ok, removed}` · `in_use`, `invalid_name` |
| `plan/set` **W** | `space_id`, `ext`, `data` (base64) | `{ok, url}` — kept only for pre-#617 cards; current cards use HTTP |
| `files/migrate` **W** | `from_id`, `to_id` | `{ok, mapping, copied}` — copies, never moves or overwrites |
| `files/cleanup` **W** | `marker_id` | `{ok, removed, kept}` — removes only files the stored config does not reference |
| `assets/list` **W** / `assets/delete` **W** | — / `asset_id` | catalog with authoritative `used_by` / `{ok, removed}` · `in_use` |
| `assets/resolve` | `asset_ids[]` (≤200) | `{assets, missing}`; non-writers resolve only ids the saved config uses |
| `content/sign` | `paths[]` | `{urls}` — 24 h `authSig`, only `/api/houseplan/content/…`, first 200 paths |
| `support/*` **W**, `radar/*` | — | `SUPPORT-PRIVACY.md`, `RADAR.md` |

Semantic write codes: `invalid_config`, `invalid_passage_fields`,
`invalid_partition_opening_host`, `invalid_partition_opening_jamb_margin`,
`wall_model_client_outdated`, `wall_model_migration_blocked` (Optimize),
`junction_limit_<rule>`, `invalid_radar`, `invalid_light_entity`,
`invalid_vacuum_map_route`, `*marker_control*`, `invalid_value_badge*`; paired
writers add `commit_failed`. Events: `houseplan_config_updated`,
`houseplan_layout_updated` (`{rev}`), `houseplan_virtual_light_updated`,
`houseplan_trail_updated`.

HTTP views (`requires_auth`, same policy): `POST /api/houseplan/upload`
(marker attachment), `/plans/upload` (#617), `/assets/upload`
(`DECOR-EDITOR.md` §7), `/import/preview` and `GET
/api/houseplan/content/{kind}/{sub}/{name}` (`nosniff`; SVG only gets a
`sandbox` CSP, HP-1454-01). Only the manifest-gated bundle under
`/houseplan_files/` is public; legacy `/houseplan_files/plans|files` URLs are
still recognised in stored config but no longer served
(`CONFIG-COMPATIBILITY.md` › Legacy content URLs).

**Invariants**

- *Optimistic locking.* Each config/layout writer takes `write_lock`, resolves
  a pending pair, then checks revisions before validation, no-op detection or
  file collection. `expected_rev` may be omitted only at `rev = 0` (#340,
  #356). External writers read `rev` via `config/get`/`layout/get`, send it as
  `expected_rev`, and on `conflict` re-read and retry (#368). A canonical no-op
  keeps revision, events and the maintenance backup.
- *Paired writes* (Optimize, Optimize Undo, full import, space delete) use the
  durable `optimize_pending` intent and one-deep `optimize_backup`
  (`kind: optimize|import`) — `CONFIG-COMPATIBILITY.md` › #491. Events fire only
  after both halves are durable; Store exceptions are resolved by reloading
  and comparing exact payloads; layout-store writes go through
  `async_save_layout_state` so unknown metadata survives.
- *Validation is the server's.* Schema/semantic checks run in the executor
  under the lock; the browser never parses an import. Frontend preflight
  (`src/plan-geometry-preflight.ts`) only avoids doomed calls.
- *Files* (`SCOPE.md` › Standing rule): uploads claim a fresh name
  (`reserve_filename`, `O_EXCL`), plans are copy-on-write
  `<space>.<token>.<ext>` (a space id cannot contain `.`), and `check_quota`
  bounds bytes/files/free disk at upload. `config/set` collects, under its
  lock, only what its own commit replaced; a daily pass runs the collectors
  with the stored config on both sides and sweeps `.upload-` temporaries. A
  newly referenced internal plan must exist (`missing_plan`; import also checks
  attachments). A usable `Content-Length` is checked before streaming, the
  staged size again under `upload_lock`, which also serialises image decoding.
  Collection classifies by **owner**, not by "is it referenced" (HP-1465-01);
  nothing is deleted for being old except `up_*` staging after
  `PLAN_ORPHAN_TTL_S` (1 h), and `plans/list`/`plans/delete` make "we never
  delete" livable:

  | Case | Rule |
  |---|---|
  | Space in both, plan A → plan B (the user picked another image) | removed immediately |
  | Space in both, plan → none (detached; one click undoes it) | **kept** |
  | Space gone (the image was imported and may be nowhere else) | **kept** |
  | Space has a plan plus another file of its own (a rejected save) | **kept** — ageing these out raced the retry |
  | Marker in both, attachment dropped from its list | removed immediately |
  | Marker gone | **kept** |
  | Attachment in `up_*` (a dialog never saved) | removed after `PLAN_ORPHAN_TTL_S` |
  | Marker there, file it never listed (a rejected upload) | **kept** |
- *Import preview* streams ≤8 MiB, rejects duplicate/prototype keys,
  non-finite numbers and future model versions, and keeps the candidate in
  memory for 10 min behind a token bound to the user, candidate digest and
  both revisions (global and per-user caps). *Export* deep-copies one coherent
  pair under the lock and builds outside it.
- *Virtual-light state* lives in its own Store (`CONFIG-COMPATIBILITY.md`);
  toggles reply immediately and coalesce into one delayed durable write,
  flushed before config transitions and unload. A cached snapshot never
  authorizes an optimistic toggle.

**Client side**

- `_writeConfig()` keeps one `config/set` in flight, each carrying the previous
  reply's revision (HP-1454-03). A rejected physical transaction restores the
  earliest server-backed snapshot of every affected space and reloads (#314).
- `src/config-adoption.ts` (#500) owns config/layout body + revision +
  fingerprint. It changes only by authoritative adoption
  (`adoptAuthoritativeGated`, profiles `reload`/`post-write`), own-write
  acceptance (`acceptConfigWrite`, `acceptPairWrite`) or warm-cache restore;
  paired writers take revisions from the re-read. Local staging is limited to
  files pinned by `test/config-adoption-ownership.test.mjs`. Ordinary debounced
  editor saves remain optimistic: a rejection that is neither a revision
  conflict (which reloads) nor a physical-geometry rollback keeps the local edit
  with a failure toast until the next authoritative reload. Writers that must
  undo on rejection capture an `OptimisticAttempt`
  (`beginOptimistic`/`rollbackOptimistic`), which restores the server-backed
  body only while that failed candidate is still current (#442, #500).
- `src/config-reload-authority.ts` (#543): each reload holds a generation-scoped
  claim; a superseded one ends with no side effect.
- `src/card-read-lifecycle.ts` (#824) owns ephemeral full-read transport claims
  for both cards, independent of visual HA deduplication. Disconnect/context
  replacement/navigation fence every awaited adoption and optional tail.
  Context is observed per HA assignment before Lit coalesces A→B→A; transport
  restart waits for the current usable authority, including a temporary HA gap.
  Static attach revalidates the server; a full long return without HA defers.
  The shared continuity controller owns one bounded paint attempt. A timeout
  retains matching staged data without marking a complete frame or self-retry;
  external readiness/update can recover. Canonical: `WARM-REMOUNT.md` §5.1.
- `ContentSigner` (`src/signing.ts`) is the only signer for both cards:
  `MAX_SIGN_PATHS` (200) is shared with `const.py`; the cache is age-aware and
  pruned to live URLs; queued/in-flight are distinct, failures back off and
  in-flight entries expire after `SIGN_INFLIGHT_MS`.
- Room climate is one `roomClimateMap()` pass per hass snapshot (#317) shared
  by full and static cards; exact `entity:` placement beats its parent
  `device:` (no double vote); never call the `areaClimate()` wrapper in render.
- Load, continuity and fixed-floor rules: `WARM-REMOUNT.md` § 5.
- `warm-mode-adoption.ts` completes immediate and delayed editor adoption with
  the original View return snapshot and a request-owned refit hold. Explicit
  mode/space navigation invalidates pending work before lazy-runtime awaits;
  warm header/stage dimensions are published only after the corresponding
  render, including the card-local header offset for pending chrome (#762).
  Adoption completion lives in the lazy editor graph: it only executes after
  that runtime is ready; View retains just cancellation and camera comparison.
  The room draft payload is also built by the installed editor runtime.
  This moves existing room-state reads across the already-defined editor port;
  it adds no room state. #762 records the resulting host-reference/ported-private
  counts in the monolith baseline, without widening its tolerance bands.

## Second card: houseplan-space-card (read-only)

One bundle registers `houseplan-card` (interactive) and the read-only
`houseplan-space-card` (one space; `src/houseplan-card.ts` imports
`./space-card`). User options, `fit` and the deep link: `USER-GUIDE.md` §18,
`CANVAS.md` §4.4, `LIGHT.md` › Which surfaces render pools. Shared modules keep
the two views from diverging: `space-geometry.ts` (pure model/position math),
`space-render.ts` (`renderSpaceStatic()`: plan, rooms and markers through
`buildDevices`, `ResolvedDevicePresentation` and `renderDeviceFace`, no marker
handlers), `glow-scene.ts` (opt-in `light_pools`, per-card bounded caches) and
`config-store.ts` — one module-level `{config, rev, configFingerprint, layout,
layoutRev, layoutFingerprint}` cache and one subscription for all embedded
cards, seeded from `houseplan_card_cfg_v1` and refreshed on
`houseplan_config_updated`/`houseplan_layout_updated` without first clearing
the visible snapshot. `.hp-static-stage` and every descendant
(`*, *::before, *::after`) are `pointer-events:none`, overriding the markers'
44 px opt-in (#564, #664); only the footer button is interactive, asserted by
`demo/smoke_space_card.mjs` with `elementFromPoint`. A card with `floor`
ignores `#space=`.

## Subsystems with their own canonical documents

- **Decor, plan image, furniture, custom images** — `space.decor[]` is a purely
  visual layer with one selection/transform/history pipeline; image bytes live
  only in the asset store: [DECOR-EDITOR](DECOR-EDITOR.md), [FURNITURE](FURNITURE.md).
- **Light and Glow** — one visibility region per source (#71); Glow is an overlay
  independent of the data fill (#55): [LIGHT](LIGHT.md). Shared source entry
  scheduling is owner-local; `LightBarrierPass` shares revisions only inside
  the main card's synchronous render, never across subsequent edits (#789).
  **Room fill** —
  `resolveEffectiveRoomFill()` is the single projection for room floors,
  clean-floor holes and opening tunnels; `room_color` styles only borders and
  names; custom colour and legacy tokens (#56, #581):
  [CONFIG-COMPATIBILITY](CONFIG-COMPATIBILITY.md).
- **Device state, light membership, action** — `resolvedDeviceStateEntities`,
  `resolvedLightSources` and `src/device-toggle.ts` are the only resolvers
  (#94, #251, #318, #381): [DEVICE-PRESENTATION](DEVICE-PRESENTATION.md).
- **Zero-thickness walls, nested rooms** — `resolveZeroWalls()` feeds every
  renderer, Glow and sun (#306): [WALL-THICKNESS](WALL-THICKNESS.md). **Kiosk,
  navigation** — kiosk is a card flag, not a mode; `LS_NAV` stores only the space
  (#93, #210): [UX-MODES](UX-MODES.md).

## Camera and mode transitions (#101, #82)

The existing `STAGE_TAP_DISTANCE_PX` pan/swipe classifier cancels the owning
`KioskHoldGesture` as soon as navigation is recognized (#825). Returning to
the press origin cannot re-arm it; sub-threshold jitter is still a hold.
There is no additional threshold or timer.

Two one-token/one-RAF controllers own every animated camera change and leave
no CSS timers or WAAPI animations behind. `ModeTransitionController`
(`src/mode-transition.ts`) is the only timeline for entering, leaving and
switching editors: it interpolates measured chrome height, stage geometry,
world-space camera centre, logarithmic pixels-per-unit, stage/paper colours,
day/night brightness and presentation weights together, deriving each `viewBox`
from the current stage aspect; the stage is inert meanwhile, header tabs stay
live for a retarget. `src/viewport-transition.ts` animates discrete zoom in a
settled mode with the same easing but only `{zoom, viewBox}` (no chrome,
background, layer opacity or CSS transform) and lives in the core View bundle.
The component stays the sole camera writer; ownership boundaries and timings:
[CANVAS](CANVAS.md) › View/editor camera handoff and §5.

LED zoom quality (#789) is a separate owner-local scale-activity deadline,
not another camera writer or a source transition. Actual changes to viewport
width/height set a host attribute before live paint; 160 ms of inactivity clears
it. CSS changes only the existing LED mask bands (48 retained, 24 painted),
without a geometry rebuild or a second SVG. Camera/lifecycle cancellation
clears the deadline; static cards do not participate. Ordinary Glow's pan/fade
blur policy remains independent.

## Settings tiers (owner's principle, 2026-07-26)

Four levels: **global (`config.settings`) → space (`space.settings`) → room
(`room.settings`) → device (`marker.*`)**. Duplicated options are deliberate:
the more specific tier wins and "unset" always means "inherit". Resolution
lives in pure helpers (`spaceDisplayOf`, `roomFillModeOf`, `roomGlowOf`,
`roomTempRangeOf`, `sourceValue`, `resolveToggleIntent`), never inline in render;
each tier keeps its own dialog (General settings, space, room, marker).

## Schema as the source of truth (#33)

The Voluptuous schema in `custom_components/houseplan/validation.py` is the
single owner of the persisted config/layout shape. The generated manifest
`scripts/config-schema.json`, the enum parity test with its self-checking
allow-list, the decision registry `scripts/config-field-registry.mjs` and the
lifecycle fixtures keep every other world honest against it:
[CONFIG-COMPATIBILITY](CONFIG-COMPATIBILITY.md) › Schema manifest and parity.

## No hidden discovery knobs (#44)

Every stored key that shapes device discovery is a visible, supported setting
or does not exist. `settings.group_lights` and `settings.exclude_integrations`
live in the device catalog's Discovery-filters section and are resolved only by
`effectiveExcludedIntegrations()`: [FILTERING](FILTERING.md) › Seeding.

## Contextual Zigbee topology (#54, #457, #464)

The initial View graph holds only the fail-closed settings reader and a dynamic
overlay bridge; the overlay chunk loads only for a saved
`settings.zigbee_topology.enabled === true`, a real HA admin, full-card View and
a non-kiosk surface. General Settings loads provider transport only when an
enabled setting needs status or the admin presses a provider action.
`zigbee-topology.ts` normalises ZHA and Zigbee2MQTT into directional observations
and provider evidence (#798): Parent/reverse Child for end devices, active
destination-zero routes for routers. NWK addresses are provider-scoped; exact
registry ownership maps nodes to markers. Only unique evidence becomes an
arrow. Conflicts, cycles and unknown roles fail closed, including merged
providers; no BFS or strongest-LQI fallback remains. A known next hop need not
prove the complete chain. Mapping/resolution are memoized outside hover.
`zigbee-topology-runtime.ts` keeps a per-connection, admin-identity-scoped cache:
ZHA still reads `zha/devices` without a scan. Z2M uses the integration-owned
`zigbee_topology.py` coordinator through admin-only
`houseplan/zigbee/{subscribe,start,cancel}` WebSocket commands (#800). The
coordinator reserves one job per normalized topic before starting background
work, checks retained bridge-info and sends one correlated raw `routes:true`
MQTT request. Closing all frontend clients releases their observers, not the job.
An initial reset and per-topic state events restore running jobs and last-good
maps; session/revision and job identifiers isolate stale replies and cancels.
Map payloads are limited to 2 MiB; at most eight topic slots are held, with only
terminal slots eligible for eviction. MQTT is an optional dependency.

There is no overall scan deadline. Transport setup/publishing have 10-second
limits and retained bridge-info a 4-second limit. At 600 seconds an exact-job
cancel becomes available; it cancels HP's wait, not Z2M radio work. Matching
provider errors, invalid maps and MQTT disconnect terminate the job, release
listeners and retain last-good data as stale. Neither reconnect nor reopening
settings republishes. Integration unload/restart clears all runtime jobs/cache.
Before unload, a `closed` session event invalidates observers even when their HA
WebSocket stays connected; the next explicit scan reattaches to the new coordinator.
The frontend derives elapsed time from server elapsed plus local monotonic time,
without per-second map events or invented progress percentages. Mounted visible
settings alone tick their timer; ordinary hass updates do not resubscribe.
ZHA cache retrieval is never described as a fresh radio scan.
The pointer-transparent overlay is a child of the `.devlayer` camera, projected
once with the markers by `live-viewport.ts`; only the source and drawable
neighbour markers are promoted above it, through transient attributes the
overlay owns and clears. All routes are solid; `zigbee-topology-style.ts` owns
the independent RGB 0/red–128/yellow–255/green palette. Unknown-LQI links have
a black casing under a 2 px grey core and an outer arrow outline. The outline
is 1 px at zoom=1 and scales with the plan, including temporary camera CSS
projection, per the owner's #798 clarification. Local and remote/unplaced routes share one renderer.
Unknown/partial/stale captions never trigger network work; one expiry timer
updates age without requiring another HA event. The resolver's transient
`showIncomplete` distinguishes an unknown per-device uplink from global snapshot
`partial`: known uplinks and every matched coordinator suppress only that caption,
even if cross-provider reconciliation makes a coordinator's route unknown (#816).
Persistence and privacy:
[CONFIG-COMPATIBILITY](CONFIG-COMPATIBILITY.md).

Zigbee caption layout (#802) notifies the lazy live-hover runtime after the
overlay's DOM update and coalesced active-hover resize/scroll/camera changes.
Only the matching pointer device tooltip avoids actual text-caption rectangles
and its source marker, in screen coordinates inside stage∩viewport. A pure
candidate search finds the closest feasible full rectangle or hides the tooltip
until space returns. It does not move markers, start scans or render the card.
Keyboard tooltips retain their own path. Pointer departure/disconnect disposes
the active layout observer/frame; remote caption wrapping updates its short
arrow endpoint in the same post-render pass.

## Live viewport: a transform per frame, a `viewBox` on a budget (#531, #579)

Rewriting the SVG `viewBox` re-rasterises the whole scene, so per-frame writes
made panning crawl. `paintLiveViewport` keeps an anchor (the `viewBox` in the DOM
and when it was written) and moves scene nodes each frame with the HTML layers'
projective transform (`liveLayerProjection`, `transform-origin: 0 0`);
`needsViewBoxRefresh` rewrites the anchor only after `LIVE_VIEWBOX_REFRESH_MS`
(100 ms) or a `LIVE_VIEWBOX_REFRESH_SHIFT` (15 %) shift/scale change — module
constants, not settings. Scene nodes project from the anchor, HTML layers from
the last settled Lit frame; both land on the current view, keeping #451's
one-CSS-pixel marker contract on every frame. `.stage` stays the outer clip, but
a transformed scene SVG gets inline `overflow: visible` so rasterised content
covers the incoming edge, even with the pointer held still (#544); HTML layers
never do. The exposure is bounded by an inline `clip-path: inset(-25%)`
(`LIVE_SCENE_EXPOSURE_CLIP`) set and removed with it — beyond the 15 % refresh
threshold, but never the whole plan: unbounded, a promoted scene grew with
zoom² and at 800 % × DPR 2 exhausted GPU memory (white frames, #689). A scene
marked `data-hp-live-overflow="clip"` — the filtered day-cycle outline — is
projected but never exposed. From the first live paint to the terminal commit a scene SVG stays in
one compositor lifecycle: a refresh or Lit frame may replace its anchor but never
demote/re-promote it — HA Companion WebView shows that as a blank frame (#579).
The day-cycle paper outline joins these roots before the first camera move; the
static card uses its stage-sized form from the first frame (#582, Key decision 7).
Unchanged values are never rewritten, so idle frames stay byte-identical;
`commitHouseplanViewport` removes the transforms and forces the final `viewBox`.

## English and Russian ship whole (#400)

`en` and `ru` are synchronous dictionaries in the initial chunk; `de` and `fr`
load lazily (`src/i18n/registry.ts`), editor-only strings included. At the
decision the 38 settings-help entries of #86 cost 2 654 B gzip (0.9 % of the
initial-View budget); splitting would need a second dictionary half, a runtime
merge, an extra request and a second source for the `en.json` key type (#391).
Budget planning assumes whole dictionaries; revisit only if editor text grows by
tens of kilobytes.

## Backend quality gates (#42)

`tests_backend/requirements.txt` is the single source of backend CI dependencies;
ruff, strict mypy, the `sys.modules` guard, the coverage baseline and the
`geometry_parity` job: [TESTING](TESTING.md) › Backend quality gates.
`const.ERROR_CODES` / `ERROR_CODE_FAMILIES` are THE stable error contract: every
emitted code is registered and localized (scanner test); `invalid_passage_fields`
and `invalid_partition_opening_jamb_margin` carry structured JSON details; the
frontend renders unknown codes localized, code first, raw messages to the console.

## Summary panel boundary (#437)

`settings.summary_panel` is the only shared persistence of this read-only overlay;
`prepare_ordinary_summary_candidate()` is the common backend boundary of
`config/set` and `plan/optimize` (full import bypasses it), and
`config/get.summary_panel_api`, never cached config, grants editing. Persistence
and local keys: [CONFIG-COMPATIBILITY](CONFIG-COMPATIBILITY.md) › Summary panel namespace.
`summary-panel.ts` owns defaults, stable ids, fit predicates and local-key
encoding; `summary-panel-picker.ts` a non-DOM `entity_id + friendly_name` index
reused across state changes; `summary-panel-runtime-loaded.ts` the lazy View
controller — a screen-space, non-SVG sibling of the camera layer outside content
bounds, with one minute-aligned timer and a lifecycle generation binding dialog,
draft, picker and async work to one route/user/permission/kiosk identity.
`summary-runtime-loader.ts` shares code, never state, and attaches a warm runtime
before the first render ([#506](specs/506-startup-performance.md)).
`summary-panel-editor.ts` loads on the settings button; its revision-checked
shared write precedes the local show choice. #505 styles and the 190 ms phases
stay lazy and never move the camera; editors and the space card never load the
panel. Device totals need an authoritative registry snapshot and dedupe parent
device ids before visual filters; clean area unions canonical room floors per
space with that space's `cell_cm`.

## Private support boundary (#43)

Help & feedback is rendered by the lazy editor runtime even in View; form state
is component memory only. Report controls appear only when
`config/get.support_api` equals `SUPPORT_API_VERSION` (1); release versions are
diagnostic. `houseplan/support/preview` (`may_write`, bounded capability enums,
dialog-scoped id) loads one coherent config/layout pair under the shared write
lock and passes disposable validated copies to `support_package.py`, a strict
projection boundary: a new allowlisted object with package-local pseudonyms and
canonical sorted JSON, never raw storage redacted afterwards. Bytes, SHA-256 and
expiry stay in `HouseplanData` memory, bound to user and draft for ten minutes;
preview, download and submit use those bytes; `preview/discard` (idempotent) or a
confirmed submit consumes the token. `houseplan/support/submit` re-validates text,
resolves only an owned live token and calls `support_transport.py`: one
compile-time HTTPS URL, no redirects, bounded timeouts and response size, stable
local failure codes that never reflect the response. The relay
(`scripts/support-relay/`) deploys separately and is excluded from the HACS
artifact. Content and retention: [SUPPORT-PRIVACY](SUPPORT-PRIVACY.md).

## Mutation tooling boundaries (#558)

`scripts/mutation-gate.mjs` stays the stable CLI but is only an orchestrator and
compatibility export surface over `mutation-registry.mjs` (declarations),
`mutation-selection.mjs` (diff/guard-input selection), `mutation-evidence.mjs`
(witness fingerprints, caught ledger) and `mutation-execution.mjs` (worktree
runs); dependencies never point back to the CLI. Guard-input caching is
invocation-scoped (one resolver, one tracked-file snapshot); persisted success
exists only in the explicit caught-witness ledger. Usage: [TESTING](TESTING.md).

Node-drag browser guards declare compilation of their `test-build/` model
fixtures before the browser oracle (#830). The existing runner still separates
setup from assertion evidence; a missing compiled module is never a caught
mutant. The cheap registry test checks all `.mjs` entry files for this readiness,
including browser smokes, rather than assuming that every smoke needs only a
bundle. Product code and nightly-only mutation execution policy are unchanged.

## LED strips: lazy boundaries (#780)

`space.led_strips` belongs to the space; the link is one-way strip → marker
and the device model stays the only owner of state and services. Four modules:

| Module | Graph | Holds |
|---|---|---|
| `led-strip-gate.ts` | initial | which markers a space shows as a strip, the anchor, the page-wide loaders of both chunks |
| `led-strip-card.ts` | initial | delegation only: the Devices toolbar button, the device-dialog section, notes, the LED branch of the device history |
| `led-strip-runtime.ts` (+ `led-strip-geometry.ts`) | lazy `led` | frame, stripe, hit/focus, 2.5D, static card |
| `led-strip-field.ts` | lazy `led-field` | the linear field, loaded by the runtime only for an on strip in a Glow room |
| `led-strip-editor.ts` (+ `i18n/led`) | lazy `led-editor` | the Devices tool, tray, picker, representation switch, LED history commands |

A View without a displayed active strip, and the Devices editor without the
tool or an editable strip, load none of them. «Displayed» is decided before
`import()` (`ledVisible`): an active strip bound to a live device of the
space that is neither hidden nor HA-disabled — the stored marker is checked as
well as the built device list (r1 M4). Each chunk checks the entry
build fingerprint; a failed load is fail-dark for the strips only and retried
on the next explicit entry. Budgets: `LAZY_LED_GZIP_CEILING` and
`LAZY_LED_EDITOR_GZIP_CEILING` in `scripts/bundle-budget.mjs`.
