# House Plan architecture

Updated: 2026-07-04 (v1.2.2). The repository = a HACS integration (category **Integration**)
that contains both the backend (`custom_components/houseplan`) and the Lovelace card (`src/` → `dist/`).

## Layout

```
houseplan-card/
├─ src/                          # card sources (TypeScript + Lit 3)
│  ├─ houseplan-card.ts          # the card: rendering, states, drag, tooltip, sticky header
│  ├─ hp-dialog.ts               # shared HA/native modal shell and focus lifecycle
│  ├─ editor.ts                  # GUI config editor (ha-form + selectors)
│  ├─ rules.ts                   # icon rules (iconFor), filtering, groups, fallback order
│  └─ data/
│     ├─ house.ts                # geometry: ROOMS (rooms→area), FLOOR_VB (viewBox), names
│     └─ backgrounds.ts          # VECTOR plans (SVG base64) + FLOOR_BG_RECT (positioning)
├─ dist/houseplan-card.js        # build (rollup+terser), ~290 KB, plans embedded
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

- Temperature: an entity with device_class=temperature / °C / `_temperature$` → label on the right.
- LQI (zigbee): the average over `*_linkquality` entities → label under the icon; color via
  `lqiColor()`: ≤40 red → ≥180 green (hsl gradient). The room average is shown in the room tooltip.
  The same tooltip includes the formatted clean-floor area (inner contour for
  thick walls), and View hover gives every room an accent/brightness highlight.
- Icon state classes: on (yellow), open (orange: cover/valve/lock/binary_sensor
  of problem classes), unavail (transparency, also used by a powered-down
  media endpoint). Yellow remains on the marker in
  source-glow fill mode: a light pool is spatial information, not a replacement
  for the universal working-state plate.

## Sizes

`icon_size` in the config = **% of the visible plan area width** (default 2.5). Implementation:
`.stage { container-type: inline-size }` + sizes in `cqw`. Legacy px values (>8) are ignored.

## Sticky header

`.head { position: sticky; top: var(--header-height, 56px) }`; it is MANDATORY that
`ha-card { overflow: visible }` — `overflow: hidden` breaks sticky.

## Device markers (v1.6.0+)

Per-marker appearance: `display: badge|icon_ripple|value`. Entity semantics originate in
`src/device-visual.ts`; `src/device-presentation.ts` resolves the complete renderer-ready
projection (sources, value, icon, classes, metrics and explanation), and
`src/device-face.ts` renders that projection on the full plan, device preview and static
space card. `badge`
shows the icon/morph and status plate; `icon_ripple` additionally shows a finite event,
static presence, mechanical transition or actual-work ring; `value` replaces the icon
with the HA-formatted numeric or text value. Ambiguous/missing/unavailable sources fall
back to the icon instead of selecting an arbitrary registry row. A critical alarm is red
in every presentation. The marker dialog builds its unsaved draft through `buildDevices`,
then `hp-device-preview` shows the actual projection, integration provenance from
registry/config-entry metadata and an isolated 3.3 s activity demonstration.
Runtime baselines are seeded as soon as a rebuilt registry becomes authoritative, before
the next HA snapshot is classified; source-key changes reset any finite effect immediately.
Legacy `display: ripple` is read as `icon_ripple` and rewritten on the next config save;
the backend accepts it only for compatibility. `ripple_color` and `ripple_size` remain the
stored names for the ordinary activity effect. `size` (icon multiplier via the
`--dev-size` CSS var — value badges scale along) and `angle` rotate/scale a single icon.
Room drawing shows a live **ruler** (`segmentCm` +
`formatLength`, metres or feet+inches by `hass.config.unit_system`); the scale is per-space
`cell_cm` (default 5 cm per grid cell).


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
such as `controls` remain persisted and become active again after re-add.
Re-adding replaces the tombstone; virtual markers need no tombstone because
they have no discovery source.

## Server-side configuration (current shape, v1.51+)

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
                "name","icon","display","controls","is_light","tap_action",
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
`room_drafts` for persisted unfinished room outlines, `partitions` for
one-segment independent walls and `wall_columns` for square/circular columns.
They do not create a room or HA area and never split a room implicitly. Their
physical bodies are unioned with room walls for rendering and light occlusion,
and subtracted from clean room floor area. Openings (doors, windows and gates)
still belong only to derived room walls and never cut an independent object.

Rooms may not overlap
(`pointStrictlyInside` + `roomsOverlap`; being ON a shared wall is legal — real neighbouring
walls overlap collinearly rather than match exactly). **Merge/Split** use boolean geometry from
**polyclip-ts** (chosen over `polygon-clipping`, whose ESM build exports only a default while
its types declare named exports — breaking either tsc or the runtime): merge accepts a pair only
when the union collapses into one hole-free outline; split cuts wall-to-wall with a chord, the
bigger part keeps the room identity (name/area/devices).

## Markup editor (v1.4.0+)

State inside the card: `_markup` (mode), `_tool` (draw/partition/column/merge/split/resize/opening/
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

Every completed segment of an unfinished room contour is persisted in
`room_drafts`, including the thickness selected when that segment was placed.
Switching tools keeps it; the same editing session resumes automatically, and
after reload either endpoint can be selected to continue. Closing converts the
draft into a room, while the room dialog's secondary action converts its edges
to independent partitions. `partition` creates exactly one wall per gesture;
`column` creates a square object whose size comes from the current Thickness
field. Double click edits physical-object properties, pointer drag moves the
whole object on the grid, and Delete removes only the selected object. The
legacy root `space.segments` array is still stripped on every save.

While drawing, the length of the current segment follows the cursor (`_fmtLen` → `segmentCm`/
`formatLength`): metres, or feet+inches when `hass.config.unit_system` is imperial. The scale is
per-space `cell_cm` — cm represented by one grid cell (default 5, so 240 cells ≈ 12 m).

## Doors, windows & gates (v1.23.0+)

`space.openings[]` — plan geometry, **not** markers: an opening needs an angle, a length and a
wall, while markers are free points whose positions live in the layout store. Model:
`{id, type: door|window|gate, x, y, angle, length, contact?, lock?, invert?, flip_h?, flip_v?}`
(normalized coords; `length` normalized by plan width). Placement snaps onto the nearest
**derived** wall via `snapToWall` (logic.ts) — the angle is normalized to [-90, 90) because two
rooms share a wall with opposite edge directions, and without that a drag across segment
boundaries flips the hinge. The opening then keeps **absolute coordinates**, so editing, merging
or deleting rooms never breaks it.

Rendering (after easy-floorplan, MIT): SVG symbol at the origin (jambs + hinged leaf + a
quarter-circle arc revealed via `stroke-dashoffset`), translated/rotated onto the wall; windows
are two casement leaves. A gate has the same data/light/contact/lock semantics as a door, but
uses two half-width leaves opening only 10° toward the exterior face and no large swing arc.
Its default width in the editor is 300 cm. `openingAmount` (pure) maps the contact state to
0..1: no sensor → door/gate drawn open / window closed (static-plan convention);
`unavailable`/`unknown` freeze that default. The lock renders as an HTML padlock badge
(`.oplock`) in the device layer; a lock is
**never** toggled from the plan (TOGGLE_FORBIDDEN_DOMAINS rule). View-mode UX: hover outline,
drag along walls (continuous re-snap, saved on release), click → status card (250 ms timer),
double click → properties dialog. In markup mode the "Opening" tool handles clicks instead.

## Integration WS API

| Command | Parameters | Response |
|---|---|---|
| `houseplan/layout/get` | — | `{layout: {device_id: {x,y}}, rev}` |
| `houseplan/layout/set` | `layout`, `expected_rev?` | `{ok, rev}` / err `conflict`; event `houseplan_layout_updated` |
| `houseplan/layout/update` | `device_id`, `pos` | `{ok, rev}`; event `houseplan_layout_updated` |
| `houseplan/config/get` | — | `{config, rev}` |
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

Manual attachments upload over HTTP (streaming, transactional staging), not WS —
the old `houseplan/file/set` was removed in v1.10.0.

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
- **Glow fill** (v1.35+): `fill_mode: 'glow'` paints every room with
  `fill_colors.glow_base` and renders per-source radial gradients clipped by
  a per-light `clipPath` = zone polygons + doorway sectors, each contour a
  SEPARATE clipPath child (children union; subpaths of one nonzero path
  cancel on opposite windings — field bug v1.36.3). Radius: global
  `settings.glow_radius_cm` + per-marker `glow_radius_cm`. On a thick wall the
  doorway sector is the angular intersection of its near- and far-face clear
  spans, so the jamb returns clip the spill as a real opening tunnel.
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
  de-duplicates and filters to currently controllable lights/switches, then
  toggles them as one HA-group-semantics service call on the marker's explicit
  `tap_action=toggle`; icon state/tint mirrors those effective targets.
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
  room?)` is the only light-membership resolver. Per marker the precedence is
  `controls[]` -> the primary controllable entity when `is_light` is set ->
  automatic `light.*`. It excludes hidden markers, de-duplicates entity ids,
  and honours `marker.room_id` before an HA area. Glow, Light fill, room light
  stats, marker indication/card ordering and group toggle all consume this
  result instead of maintaining separate domain tests.
- **Island rooms** (v1.34): full nesting is legal (`polyContainsPoly`);
  parents render as evenodd paths with holes (`islandsOf`).
- **Kiosk mode** (v1.41): a card-config flag, not a mode — `_setMode` is
  hard-blocked, header hidden, swipe/carousel handled in the stage pointer
  pipeline (`swipeTarget`), per-screen multipliers in `LS_KIOSK`.
- **Nav persistence** (v1.38.2): `LS_NAV` stores {space, mode}; hash
  deep-link > saved > default_floor; stale-cache retry after the live load.


## Settings tiers (owner's principle, 2026-07-26)

Four levels: **global (config.settings) → space (space.settings) → room
(room.settings) → device (marker.*)**. Duplicated options are deliberate: the
more specific tier overrides the more general one; "unset" always means
"inherit". Resolution lives in pure helpers (`spaceDisplayOf`,
`roomFillModeOf`, `sourceValue`, `resolveTapAction`) — never inline in render.
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
