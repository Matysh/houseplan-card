# Config compatibility registry

House Plan accepts some fields that are no longer written by the current UI.
They are not all equivalent: some preserve an old visual exactly, some are
losslessly migrated on an explicit edit, some are immediately discarded by
backend validation, and a small number still need a product decision.

The machine-readable source of truth is
`scripts/config-field-registry.mjs`. Every entry records:

- persisted path and type;
- inheritance level and default;
- whether the current UI exposes it;
- the runtime consumer (or the fact that no supported consumer was found);
- migration behaviour;
- the read-compatibility decision.

This registry initially covers the known compatibility and internal-field debt
identified by HP-DATA-01. It is not yet the complete canonical schema. The next
stage is to register all current public fields and add automated parity against
the TypeScript model and backend Voluptuous validation.

## Offline inventory

Exported JSON can be inspected without uploading it or changing it:

```bash
npm run audit:config -- path/to/houseplan-config.json
npm run audit:config -- --json path/to/houseplan-config.json > findings.json
```

The auditor accepts either the config object itself or an export wrapper with a
top-level `config` object. It reports only fields known to the registry, shows at
most three example paths in human-readable mode and always exits read-only. With
no file it prints the current registry.

## Status meanings

| Status | Meaning |
|---|---|
| `decision-required` | Preserve the field until its supported UI/runtime fate is explicitly decided |
| `deprecated-read` | Current writes use another representation; reads preserve old data/visuals |
| `migrate-on-write` | A lossless current representation is materialised during the documented write path |
| `migrate-on-settings-save` | Removed from current settings semantics and dropped only when those settings are explicitly saved |
| `drop-on-validation` | A stale client may submit it, but backend validation removes it safely |

Unknown future fields remain outside this report and continue to follow the
backend's forward-compatibility policy. Absence from the report is therefore
not permission to delete a field.

## Canonical geometry on write (#224)

Config and layout schemas canonicalize only named geometry numbers to nine
decimal places. The common storage helpers repeat the same idempotent contract
for internal writers, while the frontend adopts the exact candidate it sends.
This prevents ULP noise without changing the schema, JSON number type,
model/store version or any user-visible placement.

The operation is lossless at the product scale and intentionally narrow.
`view_box`, `cell_cm`, `plan_aspect`, physical centimetre values,
presentation settings, colours, opacity/brightness/temperature, vacuum
calibration and unknown/future numeric fields retain their exact input values.
No recursive “round every number” migration is allowed.

Existing stores remain byte-for-byte untouched on read. Their geometry becomes
canonical on the next config/layout write; Optimize Plans is the immediate bulk
path. Optimize/Import/repair Undo restores the previous semantic geometry and
unknown fields in canonical representation, not the invisible noisy IEEE-754
tail. A repeated canonical Save with the current revision is a no-op and does
not invalidate the one-deep maintenance backup.

Optimize itself returns and compares that storage-canonical config/layout pair,
not the higher-precision intermediate produced by the `1 / 240` grid formula.
Consequently the normal commit, durable pending recovery, update-event reload
and a cold read all converge on one JSON value set; feeding any of them back to
Optimize is a no-op (#248).

Wall-thickness compatibility keys use the same boundary without depending on
which side of it produced the key (#258). A `wallKey` endpoint already within
`max(pitch · 10⁻⁶, 10⁻⁹)` of a grid node is treated as that exact node before
midpoint quantisation, so `83/240` and persisted `0.345833333` identify one
stretch. Existing entries whose old midpoint key landed one grid step away are
read immediately by strict equality of their lossless `a/b` endpoint pair;
read does not rewrite config and does not broaden parent/child matching.
Explicit Optimize rewrites the compatibility key, retains `cm`, endpoints and
unknown siblings, and its next in-memory or backend storage round-trip is a
no-op. Legacy key-only records continue through the previous midpoint fallback.

Explicit Optimize also has one deliberately lossy wall-thickness repair. A
positive interval shorter than half a grid step may inherit its two equal
positive neighbours only when all three belong to one original straight room
edge and exact owners are unambiguous. One endpoint may be a room T-node: only
the interval `cm` changes, so that node and its perpendicular incident geometry
remain intact. An opening/open-span endpoint, two room topology endpoints,
unequal neighbours, a half-step-or-longer interval or conflicting owners always
block the repair. Normal read, render, Save and editor paths remain lossless;
only confirmed Optimize applies it, with the ordinary preview and server Undo
(#198, #273).

## Open-passage opening type (#157)

`space.openings[].type` additionally accepts the literal `passage`. Its
canonical record contains only `id`, `type`, `x`, `y`, `angle`, `length` and
unknown extension siblings. The door-only keys `contact`, `lock`, `invert`,
`flip_h` and `flip_v` are inapplicable; their presence is invalid even when the
value is `null` or `false`.

New/changed records and every full/space import are validated fail-closed with
`invalid_passage_fields`. An already stored broken passage may survive an
unrelated write unchanged so legacy data cannot lock the whole plan; removing
bad keys is allowed, while adding or changing one is rejected. An explicit UI
save of a passage deletes all five known keys and preserves unknown siblings.
Stale binding values remain inert at runtime and create no entity subscription.

Older v1.64.x frontends do not know the literal. Downgrade is read-only
best-effort: do not edit an open passage with an old frontend, because its
fallback may show or rewrite it as a door. Before a permanent rollback, convert
saved passages deliberately in a current version; automatic conversion is not
performed because it would invent a leaf and binding semantics.

## Independent-wall opening host (#132)

`space.openings[].host` is an optional discriminated object
`{kind:'partition', id:string, t:number}`. Its absence preserves the historical
room-wall association. When present, the referenced partition in the same
space and normalized `t` are authoritative; the legacy `x/y/angle` siblings
remain a materialized compatibility projection for older readers. Full export,
plan-only export, merge and optimization preserve the host object.

Current writes validate the reference, fit and non-overlap. They also reject a
stale writer that keeps an existing opening but silently drops its host; this
prevents a downgrade from converting it into a nearby room-wall opening. Old
frontends may display only the materialized projection, so opening or editing a
hosted opening with an old bundle is unsupported. A missing/invalid host is not
re-associated automatically: current renderers fail dark and Plan offers an
explicit rebind.

The sole host-removal exception is the explicit Optimize reconciliation from
#276/#280. The server does not trust a client counter: it independently proves
that the old partition was removed, its complete segment is either one solid
outer boundary owned by exactly one room or one solid shared boundary owned by
exactly two rooms, the replacement wall envelope is not narrower, the
materialized centre/angle and every unrelated opening field are unchanged, and
no new slot overlaps. This capability is enabled only by
`houseplan/plan/optimize`; ordinary config writes and crafted candidates keep
the fail-closed `invalid_partition_opening_host` result.

New hosted openings and direct changes to `host.id`, `host.t`, `length`, host
span or host thickness reserve a jamb at both endpoints equal to half the
actual partition thickness. This is semantic delta validation, not a schema or
migration: an unchanged legacy near-end opening, an unrelated edit and a rigid
translation of its host remain valid and are never silently clamped. Full
backup restore intentionally uses the structural zero-margin fit boundary even
without a trusted previous config, so older backups remain restorable; the next
direct geometry edit must satisfy the current jamb rule.

## Four-phase background default and transfer (#146)

The schema remains `settings.bg_mode: static | daynight` globally and per
space; absence is still accepted for older files and the runtime's final
fallback remains `static`. New semantics are materialized instead of changing
that fallback:

- new integration config uses explicit global `daynight`;
- manual and Floors/Areas space creation writes explicit per-space `daynight`;
- storage minor v1.2 migrates a missing or invalid legacy global token to
  `static` once, while preserving valid global/per-space values, unknown
  siblings, revisions, and the other stores;
- full export/import always carries an explicit global mode, with legacy
  missing mode becoming `static` before preview/apply;
- a space export copies its effective mode into the exported space; a legacy
  space import without a mode becomes `static` before merge, regardless of the
  target installation's global setting.

Import preview and apply therefore operate on the same normalized candidate.
Explicit `static` and `daynight` survive same-instance and foreign transfer.

## Additive plan-only space transfer (#167)

`houseplan/export/create` accepts `plan_only: true` only for a one-space
export. The resulting version-1 envelope adds `transfer.plan_only: true`,
contains no markers and retains only canonical `rl_<room_id>` room-label
layout. Normal full/space exports never write `plan_only: false`, so their
existing document shape and lossless compatibility remain unchanged; an
absent field still means an ordinary export.

Plan-only data is a fail-closed allowlist projection of supported geometry,
presentation and content references. Known Area, temperature/humidity,
opening and decor bindings are removed and recognized live-text references are
frozen as `—`. Import rejects a true flag on a full export, non-boolean values,
or any document whose projected config, layout, placement or content owner no
longer satisfies that privacy contract. There is no persisted config/layout
migration: the new field exists only in the portable envelope.

## Legacy device tap action

The historical marker token `tap_action: cover` remains accepted indefinitely.
It is projected in the current UI as the universal **Toggle state** action and
keeps cover-first target priority at runtime. Merely opening and saving an
unrelated marker field preserves the literal `cover` token; once the user edits
the action selector, the current canonical `toggle` token is written. The UI
never creates new `cover` values. Unknown or unavailable cover capabilities
remain a safe no-op and are never replaced by a guessed service call.

The universal `toggle` resolver uses the current HA registry as its capability
boundary. A disabled, orphaned or not-yet-verified device target is therefore
a visible/explained safe no-op; it is not silently retargeted to a sibling
entity and does not fall back to opening the info card. Entity bindings that
still have a live, enabled service target may continue to work while registry
metadata is refreshing. Persisted actions are preserved in both cases so a
temporarily unavailable binding recovers without a config rewrite.

## Independent Glow compatibility

The historical space and room token `fill_mode: glow` remains accepted on read
indefinitely. Runtime projects it into an ordinary inherited data fill plus an
enabled Glow overlay; explicit `glow_enabled` / room `glow` booleans always win.
A normal edit that replaces the legacy token writes the resolved boolean in the
same operation. Optimize Plans applies the same lossless, idempotent model-v7
migration while preserving unknown sibling settings.

## Space reference repair (model v7)

Missing `marker.space`, `marker.room_id`, `vacuum.segment_map` and layout
ownership remain readable by the permissive persisted schemas. They are never
rewritten during load or an unrelated Save. Explicit Optimize may map an
untruncated exact `space_<old>_<8 hex>` / `room_<old>_<8 hex>` import signature,
or use the production HA Area placement for an active real marker. Without a
valid target it removes the marker's missing placement but preserves its old
position for the owner-aware cleanup decision.

The same explicit Optimize candidate automatically removes layout entries only
for owners proven absent: missing room labels, removed marker tombstones, and
known devices or `lg_` entities absent from an authoritative HA registry/state
roster. A live owner in a deleted space is preserved unless the administrator
explicitly opts into removing its old position. A limited or unavailable
registry and an unknown/future layout namespace always preserve the entry;
nested vacuum mappings likewise remain stored and reported. This is a runtime
read-model decision, not a persisted migration: schemas, store/model versions
and the layout shape are unchanged. The pass is data-driven, undoable,
idempotent and runs even when `model_version` is already 7.

A one-space import uses its known id map (not a heuristic) to repair matching
orphan target references when the original space id is absent. Full restore is
unchanged. Space deletion now uses a revision-guarded config/layout transaction
and refuses active marker dependencies while another space remains; removed
tombstones keep their metadata and lose only placement fields owned by the
deleted space. Deleting the sole remaining space is the intentional exception:
all affected active and removed marker records survive with only `space` and
`room_id` cleared, preserving the empty-state contract. Older clients can read
every repaired candidate because the schemas and field shapes did not change.

Current `fill_mode` additionally accepts `custom`. Its optional color is stored
as `{c:'#RRGGBB',a:0..1}` in `space.settings.custom_fill` and, for an explicit
room override, `room.settings.custom_fill`. Missing or invalid historical data
is projected at render time through room → space → `#607d8b`/`0.18`; merely
reading it never rewrites the config. Backend writes keep the strict shared
hex/finite-alpha contract. An explicit `null` is accepted at either level and
has the same projection semantics as a missing override.

The current space editor presents `custom` as the ordinary/default room fill
instead of offering a separate `none` choice. A historical space-level `none`
is still rendered losslessly until edited, then the dialog projects it to
`custom` with the existing/default color at zero opacity and materializes that
visually equivalent choice on Save. Newly created spaces use the same
zero-opacity custom value, so the UI change does not introduce a visible floor
or remove the Glow base by default. A zero-opacity resolved fill still receives
the Glow base. `none` remains accepted by the model and exposed at room level,
where it is still required to suppress an inherited
LQI/light/temperature/custom fill for one room.

## Per-marker light role and Glow appearance

`marker.is_light` is tri-state. Missing/null means automatic device-role
discovery, `true` forces the marker's own controllable entity to be a spatial
source, and `false` suppresses that own source. External `controls` are not
suppressed: they continue to contribute to room light state and counts without
placing a Glow pool at the controller. This intentionally changes the read
semantics of hand-written legacy `is_light: false`: older frontends treated it
like Auto, while current frontends treat it as Never. The historical writer
only emitted `true` or `null`, so ordinary UI-authored configs are unaffected.

`marker.glow_color` is optional and strict: `{c:'#RRGGBB'}` fixes colour while
keeping live brightness; `{c:'#RRGGBB',bri:0.01..1}` fixes both. Missing/null
uses the live source. Invalid objects fall back atomically to live values and
never partially reach SVG. `{c,bri:null}` is accepted for compatibility,
projects like `{c}`, and is canonicalised to `{c}` by the next marker save.
Older frontends ignore this field at render time and may erase it when they
rebuild the same marker after a downgrade; this limitation cannot be repaired
retroactively.

`marker.light_entity` optionally stores the leading `light.*`/`switch.*` for an
Always source with several controllable entities. It is copied literally by
full and space transfer: entity ids are instance-specific and are never
remapped. Missing/invalid selections remain stored, produce a dialog warning
and temporarily fall back to the normal deterministic selection; merely
opening or saving another field does not erase them. Older frontends ignore the
unknown field and may erase it only if they reconstruct that marker.

`marker.toggle_entity` optionally stores the exact own `light.*`/`switch.*`
operated by Toggle. Absence/null keeps the historical single-target resolver
and external-only controls groups bit-for-bit. A present active choice is exact:
temporary missing/unavailable/secure state never retargets it to a sibling. A
choice no longer belonging to the marker remains stored, warns in the dialog
and temporarily uses the historical fallback. New/changed values are
domain-bounded by lossless delta validation; an untouched future literal can
round-trip. Full and space transfer copy the entity id literally, while a
duplicate marker virtualised during space import drops the HA-dependent field.
Older frontends ignore it and may erase it if they reconstruct the marker.
`light_entity`, `toggle_entity` and `tap_target` are independent.

`marker.controls[]` additionally accepts `marker:<marker_id>` links to forced
plan sources. Runtime and old frontends continue to filter those strings out of
HA service calls. New writes validate target existence, forced-source role,
self-reference, duplicates and cycles; an already stored broken legacy link is
allowed to round-trip so unrelated edits cannot lock the plan. Deleting or
rebinding a target removes or rewrites references atomically. A space export
remaps links whose two ends are inside the exported space and reports/drops
links leaving it; full export preserves them literally.

`marker.value_badge` is an optional explicit value satellite. Its absence is
the legacy compatibility state: the historical temperature/humidity heuristic
and global `show_temperature` gate remain in force. An explicit
`{enabled:false,...}` suppresses that heuristic; an enabled badge stores one
discriminated source and one of four stable positions. Unknown sibling keys in
the badge and source objects are preserved. New/changed records are validated,
while an untouched old broken source remains readable and round-trippable.
`derived_marker_state.ref` uses the same `marker:<id>` namespace as controls:
space transfer remaps an internal target and disables/counts a link whose
target is outside the transfer. Older clients ignore the field and may erase
it if they reconstruct the same marker after a downgrade.

## Persistent manual virtual-light state

The exact `virtual` + `is_light:true` + `tap_action:toggle` combination has a
shared operational on/off state. It is not a Marker/ServerConfig field: the
integration stores `{rev, config_rev, off[]}` under a separate versioned Store
key and exposes an optional `virtual_lights` snapshot in `houseplan/config/get`.
It is excluded from layout, full/space export, import and HA entities. Missing
Store data or a missing wire field projects to `on`.

Compatibility matrix:

| Frontend | Backend | Behaviour |
|---|---|---|
| old | new | Extra snapshot/event are ignored; the marker keeps historical #84/#94 behaviour and config remains intact |
| new | old | Missing snapshot starts `on`; an unsupported toggle command reports an error and creates no optimistic local state |
| new | new | Server snapshot is authoritative; revisioned events synchronize full and static cards |

Every current config writer reconciles the Store. Rename, move, hide and
unrelated edits preserve off bits for still-eligible stable marker ids;
binding/role/action changes, tombstones and deletion prune them. Re-entering the
triple therefore starts on. If `config_rev` skips the revision recorded by the
operational Store — for example after downgrade, an old writer or an interrupted
pair — all off bits are cleared rather than resurrected against unknown marker
lifecycle history. Older integrations safely ignore the separate Store on
downgrade.
