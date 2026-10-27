# Config compatibility inventory (#1015)

Historical #1015 provenance: reproduced from source base `e271b91b4c4419a4650531ff929e6442ac18f67c` plus the #1015 candidate. The bounded case-insensitive query is `legacy|deprecated|compat|fallback for old` over `src/**/*.ts` and `custom_components/houseplan/**/*.py`. The historical223 matches are not the current count.

Current snapshot: **628 individually classified matching lines**, sha256:`45f4056f7d160fcb4838170e546c9d507a5b3208164eab1e2f5887b2c499b2c9`. Each exact source hit, occurrence, stable content ID and disposition is in [the machine inventory](../scripts/config-compatibility-inventory.json). Line numbers are informational; text/occurrence IDs survive unrelated line insertions. New, missing, changed or duplicate hits fail the test; no filename catchall assigns future matches.

Historical #1015 captured product trees: src `22655ecb08f00d9b1f6c8381a1a3d3c9c51487cb`; integration `0019b652824aaad42fd0e6f5372cb595e8a41dc7`. These immutable Git trees identify the original capture; ongoing completeness is checked against exact source-match IDs, so an unrelated edit does not expire unchanged matches.

Reproduce with `node scripts/config-compatibility-inventory.mjs --check`; `--scan` prints unclassified current source for deliberate review. A match can name an import or current algorithm without defining an old stored form. The table below classifies those separately; a current optional default is not a forced migration.

## Persisted branches

| Branch | Old → current | Since / until | Migration / decision |
|---|---|---|---|
| [display-ripple](../src/logic.ts) | display:ripple → display:icon_ripple | v1.59.0 ([d2bec266](https://github.com/Matysh/houseplan-card/commit/d2bec266ed2c2c01167a15c910c028cc3bfa17fa)); until **v1.59.2** | v1 display-ripple; strict schema retains old input, server stores current; **keep**: View also supports a newer frontend with an older backend; version mismatch does not gate reads. That backend cannot run the new canonical decoder. |
| [vacuum-trail](../src/vacuum.ts) | trail:boolean/null → trail_mode:never/cleaning/always | v1.54.0 ([75524d9d](https://github.com/Matysh/houseplan-card/commit/75524d9d853710dbde2672c6c0bf87e4b84e03fa)); until **v1.54.2** | v1 vacuum-trail; explicit current mode wins; false maps to never, other old values to cleaning; **keep**: View also supports a newer frontend with an older backend; version mismatch does not gate reads. That backend cannot run the new canonical decoder. |
| [plan-scale](../src/space-geometry.ts) | plan_scale uniform, per-axis overrides optional → plan_scale_x/y independent | v1.60.0 ([29fb9deb](https://github.com/Matysh/houseplan-card/commit/29fb9deb43f59f9c2477ae4b11391dc76b0efb15)); until **v1.60.3** | v1 plan-scale; canonical axes win independently, absence/null falls back to old scale; **keep**: View also supports a newer frontend with an older backend; version mismatch does not gate reads. That backend cannot run the new canonical decoder. |
| [space-glow](../src/logic.ts) | fill_mode:glow → fill_mode:none + glow_enabled | v1.61.0 ([fb382bfa](https://github.com/Matysh/houseplan-card/commit/fb382bfa11d4bf7bbd826c01ae7330757e836b90)); until **v1.63.0** | v1 space-glow; explicit boolean wins; **keep**: View also supports a newer frontend with an older backend; version mismatch does not gate reads. That backend cannot run the new canonical decoder. |
| [room-glow](../src/logic.ts) | room fill_mode:glow → inherited fill + room glow boolean | v1.61.0 ([fb382bfa](https://github.com/Matysh/houseplan-card/commit/fb382bfa11d4bf7bbd826c01ae7330757e836b90)); until **v1.63.0** | v1 room-glow; explicit boolean wins; **keep**: View also supports a newer frontend with an older backend; version mismatch does not gate reads. That backend cannot run the new canonical decoder. |
| [decor-width](../src/editors/decor/geometry.ts) | width in render units → width_cm physical | v1.60.0 ([29fb9deb](https://github.com/Matysh/houseplan-card/commit/29fb9deb43f59f9c2477ae4b11391dc76b0efb15)); until **v1.60.3** | v1 converts only exact representable 0.1..100cm; canonical positive value wins; **keep**: Legal width:30 at cell_cm:1000 renders 7200cm; canonical width_cm is limited to100. Clamping changes the drawing. Retain unrepresentable subset and older-backend reader. |
| [decor-text-size](../src/logic.ts) | size:s/m/l or scale multiplier → size_cm physical | v1.60.0 ([29fb9deb](https://github.com/Matysh/houseplan-card/commit/29fb9deb43f59f9c2477ae4b11391dc76b0efb15)); until **v1.60.3** | v1 converts exact representable 0.1..2000cm; explicit scale wins over size; **keep**: Legal scale:20 with cell_cm:1000 needs96000cm, outside size_cm2000. Keep that subset and old-backend readers; do not use Optimize clamps during a transparent read. |
| [decor-live-link](../src/logic.ts) | one entity/attr/unit + optional {} placeholder → inline {entity[:attribute]} references | keep/unproven: Inline replacement is beta-era; a full semantic replacement for explicit units/noncanonical attribute names does not exist.; until **{"kind":"keep","reason":"Inline replacement is beta-era; a full semantic replacement for explicit units/noncanonical attribute names does not exist."}** | Explicit editor/Optimize converts only representable tokens; transparent decoder retains all old links; **keep**: An explicit unit and arbitrary bounded attribute cannot be expressed by the inline grammar without changing HA formatting. No lossless total replacement; retain exact side fields. |
| [square-canvas](../custom_components/houseplan/geometry_migration.py) | aspect-based paired coordinates → square config/layout coordinates + plan_aspect | v1.49.0 ([94b29896](https://github.com/Matysh/houseplan-card/commit/94b298962a34baf8da16b15484304092bcfe191c)); until **v1.50.1** | v1 square-canvas before scalar unit conversion; resumes old geom_pending as well as new paired intent; **keep**: The versioned import/load decoder remains for skipped installations and old backups. aspect is not a working-render fallback; strict ordinary write still drops stale aspect. |
| [derived-segments](../src/geometry-cleanup.ts) | standalone per-space segments → walls derived from room contours | v1.21.1 ([65268a79](https://github.com/Matysh/houseplan-card/commit/65268a798524531d7d7ff10d1454fe5f1b27bd4f)); until **v1.21.3** | v1 derived-segments drops dead records; strict schema independently drops stale writer input; **keep**: No renderer consumes this dead collection. The strict stale-input decoder is retained; it cannot delete partitions or current wall catalogue records. |
| [zero-wall-boundaries](../src/zero-walls.ts) | open_spans/open_to virtual contours below model9 → proven cm:0 wall atoms | v1.68.0 ([a66fb7ef](https://github.com/Matysh/houseplan-card/commit/a66fb7ef53906bed33c6f92369b14e8e398be3bd)); until **v1.69.0** | Existing explicit structural write/Optimize and canonical import model chain; not silently forced on every read; **keep**: The model9 contract intentionally changes degraded opening/light behavior and may need host proof. A lossless transparent migration for every tolerated old geometry is not proven; old backend and read-only degraded plans remain supported. |
| [wall-model-chain](../src/wall-segment-model.ts) | catalogue-less rooms, old drafts, midpoint-only thickness/host evidence → models8→9→10 catalogue, partitions and proven hosts | keep/unproven: Multiple independent structural migrations; model number is not a scalar-field sunset date.; until **{"kind":"keep","reason":"Multiple independent structural migrations; model number is not a scalar-field sunset date."}** | Existing versioned structural migration on import/explicit structural write; ownership proof may refuse; **keep**: Ambiguous wall ownership and malformed-but-readable old drafts cannot be guessed on load. Keep exact current proof/read paths; canonical walls[] is also a current projection ABI. |
| [discovery-materialization](../src/devices.ts) | unseeded runtime discovery filter → filter_seeded + explicit hidden marker intents | v1.51.0 ([694e1e9a](https://github.com/Matysh/houseplan-card/commit/694e1e9a3b3c1564d0f10eae036fc59dd7d02240)); until **v1.51.2** | Existing editing-client seeding with authoritative roster; v1 removes show_all only when filter_seeded:true; **keep**: A pure decoder has no registry/provider roster and must not invent or reveal hidden devices. Unseeded forms stay until that authoritative seed; current discovery filters stay active. |
| [room-appearance](../src/room-appearance.ts) | global wall fill / coupled room caption colour → local wall_fill/name_color | keep/unproven: Replacement commit a94ad5a92105075eae18f4ae48648abe8c629f98 exists only in v1.83.0-beta.1/.2; no published stable contains it yet.; until **{"kind":"keep","reason":"Replacement commit a94ad5a92105075eae18f4ae48648abe8c629f98 exists only in v1.83.0-beta.1/.2; no published stable contains it yet."}** | Existing copy-only source projection and ordinary write/transfer materialization; defaults remain optional; **keep**: Recent additive representation plus older backend reads. Materializing absent optional defaults on every current load would violate no-op; local explicit fields remain authoritative. |
| [space-font-scale](../src/logic.ts) | card_font_scale common multiplier → independent card_name_scale/card_label_scale | v1.82.0 ([acd2e668](https://github.com/Matysh/houseplan-card/commit/acd2e6685f8e511d8ccbe3a1064d03a983d39a84)); until **{"kind":"pending","after":"v1.82.0","count":2,"remaining":2}** | Space settings Save materializes independent fields; retained old key is an explicit rollback mirror; **keep**: Absent current keys intentionally inherit old value until explicit form Save. Keep read inheritance and rollback mirror; not an orphaned decoder. |
| [vacuum-map-calibration](../src/vacuum-routes.ts) | map_id→matrix without source/space → explicit versioned map_routes | keep/unproven: A total replacement needs exact robot source/space evidence unavailable in a context-free old backup.; until **{"kind":"keep","reason":"A total replacement needs exact robot source/space evidence unavailable in a context-free old backup."}** | Existing explicit routing edit converts whole dictionary atomically after source proof; **keep**: Inventing a source or floor changes route authority. Keep old dictionary and live run adoption; provider telemetry fallbacks are a separate non-config exclusion. |
| [marker-cover-action](../src/device-toggle.ts) | tap_action:cover → UI projection toggle | keep/unproven: No semantically identical replacement for explicit historical cover-target authority.; until **{"kind":"keep","reason":"No semantically identical replacement for explicit historical cover-target authority."}** | None: preserve explicit target identity; UI projects select without rewriting untouched marker; **keep**: Rewriting cover to generic toggle can change chosen entity/service. It is still accepted guarded action data, not an expired enum alias. |
| [marker-value-presentation](../src/device-value-badge.ts) | implicit temperature/humidity source + secondary metric → explicit value_badge single source | keep/unproven: The new single badge cannot represent two old metrics without loss.; until **{"kind":"keep","reason":"The new single badge cannot represent two old metrics without loss."}** | Only a deliberate badge edit chooses a current explicit source; **keep**: A second old metric and implicit primary resolution are observable. Preserve until explicit user choice; lossless total replacement does not exist. |
| [layout-owner-repair](../src/space-reference-repair.ts) | grp_<HA-area> and old/missing space references → exact owner-derived stable space reference | keep/unproven: Unverified owner/registry-unavailable references intentionally have no guessed replacement.; until **{"kind":"keep","reason":"Unverified owner/registry-unavailable references intentionally have no guessed replacement."}** | Existing explicit owner proof/Optimize, preserving unknown entries on refusal; **keep**: A missing HA roster or ambiguous owner prevents a total migration. Current f1 hint alone is not ownership; keep refusal/proof paths. |
| [content-url](../src/logic.ts) | /houseplan_files/plans/files old URL → /api/houseplan/content authenticated URL | keep/unproven: External URLs and historical local URLs share fields; exact scoped rewrite provenance is not established.; until **{"kind":"keep","reason":"External URLs and historical local URLs share fields; exact scoped rewrite provenance is not established."}** | Existing owned local-path read projection; external URLs preserved; **keep**: Older backend static content remains supported. Blanket stored URL rewrite could change external ownership/signing; keep scoped current read adapter. |
| [card-option](../src/types.ts) | Lovelace tap_action → per-marker action | keep/unproven: External Lovelace option; House Plan server cannot rewrite another integration’s persisted card config.; until **{"kind":"keep","reason":"External Lovelace option; House Plan server cannot rewrite another integration’s persisted card config."}** | Ignored current card option; optional manual cleanup has no visual effect; **keep**: Outside server Store/import authority. Keep permissive external option; not a runtime action branch. |
| [weather-option](../custom_components/houseplan/config_migrations.py) | unused weather entity setting → sun geometry/elevation without weather entity | v1.60.2 ([2a8302f4](https://github.com/Matysh/houseplan-card/commit/2a8302f4d6af58a6f2182bc569e4003b658a1d4d)); until **v1.61.0** | v1 weather-option removes only the independently valid bounded obsolete key at load/write/import; **remove**: No runtime consumer exists since v1.60.2. V1 canonicalizes current inputs; older-backend values remain inert in this frontend. The duplicate settings write conversion is retired; strict stale-input schema remains. |
| [unused-vacuum-options](../custom_components/houseplan/validation.py) | opaque hidden vacuum options → no replacement decision | keep/unproven: No supported replacement or product retirement decision has been proven.; until **{"kind":"keep","reason":"No supported replacement or product retirement decision has been proven."}** | None: retain losslessly; **keep**: No replacement authority; unchanged options must survive backup/import/write. |

Every row has a typed since/until and provenance. Unproven means **keep**, with the missing proof stated; it is not a guessed release date. The published stable sequence is the complete111-release API snapshot captured2026-10-26, latest v1.82.0; patch releases count, betas do not. Historical since facts link immutable introducing commits. Until is derived from the actual publication sequence. The weather-option working cleanup is eligible and retired: its since/until, canonical v1 migration and absence of any frontend consumer are proven. Other reached rows retain their readers because older backends, intentionally tolerated geometry or non-equivalent representations still bypass a total canonical boundary. No row becomes eligible from age alone.

## Exact source coverage

| Source | Hits | Disposition |
|---|---:|---|
| [custom_components/houseplan/backup_transaction.py](../custom_components/houseplan/backup_transaction.py) | 1 | exclusion:transport |
| [custom_components/houseplan/const.py](../custom_components/houseplan/const.py) | 2 | exclusion:current-feature |
| [custom_components/houseplan/contact_basis.py](../custom_components/houseplan/contact_basis.py) | 2 | exclusion:current-feature |
| [custom_components/houseplan/coordinate_canonicalization.py](../custom_components/houseplan/coordinate_canonicalization.py) | 1 | branch:wall-model-chain |
| [custom_components/houseplan/frontend_assets.py](../custom_components/houseplan/frontend_assets.py) | 1 | exclusion:transport |
| [custom_components/houseplan/frontend_registration.py](../custom_components/houseplan/frontend_registration.py) | 4 | exclusion:transport |
| [custom_components/houseplan/geometry_migration.py](../custom_components/houseplan/geometry_migration.py) | 1 | branch:square-canvas |
| [custom_components/houseplan/import_export.py](../custom_components/houseplan/import_export.py) | 8 | exclusion:transport |
| [custom_components/houseplan/junction_limits.py](../custom_components/houseplan/junction_limits.py) | 3 | branch:wall-model-chain |
| [custom_components/houseplan/marker_history.py](../custom_components/houseplan/marker_history.py) | 1 | exclusion:current-feature |
| [custom_components/houseplan/marker_history_websocket.py](../custom_components/houseplan/marker_history_websocket.py) | 1 | exclusion:current-feature |
| [custom_components/houseplan/panel_registration.py](../custom_components/houseplan/panel_registration.py) | 1 | exclusion:transport |
| [custom_components/houseplan/plans.py](../custom_components/houseplan/plans.py) | 1 | exclusion:current-feature |
| [custom_components/houseplan/radar.py](../custom_components/houseplan/radar.py) | 1 | exclusion:current-feature |
| [custom_components/houseplan/radar_validation.py](../custom_components/houseplan/radar_validation.py) | 1 | exclusion:current-feature |
| [custom_components/houseplan/repairs.py](../custom_components/houseplan/repairs.py) | 2 | exclusion:current-feature |
| [custom_components/houseplan/room_appearance.py](../custom_components/houseplan/room_appearance.py) | 4 | branch:room-appearance |
| [custom_components/houseplan/store.py](../custom_components/houseplan/store.py) | 2 | exclusion:current-feature |
| [custom_components/houseplan/store.py](../custom_components/houseplan/store.py) | 2 | exclusion:transport |
| [custom_components/houseplan/support_config_projection.py](../custom_components/houseplan/support_config_projection.py) | 1 | exclusion:transport |
| [custom_components/houseplan/support_package.py](../custom_components/houseplan/support_package.py) | 1 | exclusion:transport |
| [custom_components/houseplan/support_snapshot.py](../custom_components/houseplan/support_snapshot.py) | 2 | exclusion:transport |
| [custom_components/houseplan/trails.py](../custom_components/houseplan/trails.py) | 25 | exclusion:provider-api |
| [custom_components/houseplan/vacuum_routes.py](../custom_components/houseplan/vacuum_routes.py) | 5 | branch:vacuum-map-calibration |
| [custom_components/houseplan/validation.py](../custom_components/houseplan/validation.py) | 3 | branch:decor-live-link |
| [custom_components/houseplan/validation.py](../custom_components/houseplan/validation.py) | 2 | branch:decor-text-size |
| [custom_components/houseplan/validation.py](../custom_components/houseplan/validation.py) | 2 | branch:derived-segments |
| [custom_components/houseplan/validation.py](../custom_components/houseplan/validation.py) | 1 | branch:plan-scale |
| [custom_components/houseplan/validation.py](../custom_components/houseplan/validation.py) | 15 | branch:wall-model-chain |
| [custom_components/houseplan/validation.py](../custom_components/houseplan/validation.py) | 1 | branch:weather-option |
| [custom_components/houseplan/validation.py](../custom_components/houseplan/validation.py) | 1 | branch:zero-wall-boundaries |
| [custom_components/houseplan/validation.py](../custom_components/houseplan/validation.py) | 14 | exclusion:current-feature |
| [custom_components/houseplan/wall_node_delete.py](../custom_components/houseplan/wall_node_delete.py) | 1 | branch:wall-model-chain |
| [custom_components/houseplan/wall_node_move.py](../custom_components/houseplan/wall_node_move.py) | 3 | branch:wall-model-chain |
| [custom_components/houseplan/wall_segment_model.py](../custom_components/houseplan/wall_segment_model.py) | 33 | branch:wall-model-chain |
| [custom_components/houseplan/websocket_api.py](../custom_components/houseplan/websocket_api.py) | 2 | branch:content-url |
| [custom_components/houseplan/websocket_api.py](../custom_components/houseplan/websocket_api.py) | 1 | exclusion:current-feature |
| [custom_components/houseplan/websocket_api.py](../custom_components/houseplan/websocket_api.py) | 5 | exclusion:transport |
| [src/align-grid.ts](../src/align-grid.ts) | 1 | exclusion:current-feature |
| [src/backdrop-frame-gesture.ts](../src/backdrop-frame-gesture.ts) | 2 | branch:plan-scale |
| [src/backdrop-frame-gesture.ts](../src/backdrop-frame-gesture.ts) | 1 | exclusion:current-feature |
| [src/backup-archive-client.ts](../src/backup-archive-client.ts) | 3 | exclusion:transport |
| [src/card-runtime.ts](../src/card-runtime.ts) | 1 | exclusion:current-feature |
| [src/codepoint-order.ts](../src/codepoint-order.ts) | 1 | exclusion:current-feature |
| [src/coincident-partitions.ts](../src/coincident-partitions.ts) | 3 | exclusion:current-feature |
| [src/coordinate-canonicalization.ts](../src/coordinate-canonicalization.ts) | 2 | branch:wall-model-chain |
| [src/device-contact-basis.ts](../src/device-contact-basis.ts) | 4 | exclusion:current-feature |
| [src/device-contact-geometry.ts](../src/device-contact-geometry.ts) | 1 | exclusion:current-feature |
| [src/device-contact-scene.ts](../src/device-contact-scene.ts) | 2 | exclusion:current-feature |
| [src/device-contact-write.ts](../src/device-contact-write.ts) | 1 | exclusion:current-feature |
| [src/device-face.ts](../src/device-face.ts) | 17 | branch:marker-value-presentation |
| [src/device-inbox.ts](../src/device-inbox.ts) | 1 | exclusion:current-feature |
| [src/device-marker-geometry.ts](../src/device-marker-geometry.ts) | 1 | exclusion:current-feature |
| [src/device-presentation.ts](../src/device-presentation.ts) | 2 | exclusion:current-feature |
| [src/device-toggle.ts](../src/device-toggle.ts) | 5 | branch:marker-cover-action |
| [src/device-toggle.ts](../src/device-toggle.ts) | 1 | exclusion:provider-api |
| [src/device-value-badge.ts](../src/device-value-badge.ts) | 12 | branch:marker-value-presentation |
| [src/devices.ts](../src/devices.ts) | 8 | branch:discovery-materialization |
| [src/devices.ts](../src/devices.ts) | 4 | exclusion:current-feature |
| [src/draft-live-preflight.ts](../src/draft-live-preflight.ts) | 2 | branch:wall-model-chain |
| [src/editors/decor/geometry.ts](../src/editors/decor/geometry.ts) | 6 | branch:decor-width |
| [src/editors/decor/geometry.ts](../src/editors/decor/geometry.ts) | 2 | exclusion:current-feature |
| [src/editors/decor/types.ts](../src/editors/decor/types.ts) | 1 | branch:decor-live-link |
| [src/editors/decor/types.ts](../src/editors/decor/types.ts) | 1 | branch:decor-text-size |
| [src/editors/decor/types.ts](../src/editors/decor/types.ts) | 1 | branch:decor-width |
| [src/editors/decor/types.ts](../src/editors/decor/types.ts) | 1 | exclusion:current-feature |
| [src/editors/marker-dialog.ts](../src/editors/marker-dialog.ts) | 9 | exclusion:session-state |
| [src/editors/properties/catalog.ts](../src/editors/properties/catalog.ts) | 1 | exclusion:current-feature |
| [src/editors/properties/editor.ts](../src/editors/properties/editor.ts) | 1 | exclusion:current-feature |
| [src/editors/properties/physical.ts](../src/editors/properties/physical.ts) | 3 | exclusion:current-feature |
| [src/editors/properties/strings.ts](../src/editors/properties/strings.ts) | 2 | exclusion:current-feature |
| [src/editors/properties/transforms.ts](../src/editors/properties/transforms.ts) | 2 | exclusion:current-feature |
| [src/editors/room-save.ts](../src/editors/room-save.ts) | 1 | branch:room-glow |
| [src/editors/settings-background-previews.ts](../src/editors/settings-background-previews.ts) | 1 | exclusion:current-feature |
| [src/editors/space-form.ts](../src/editors/space-form.ts) | 1 | exclusion:current-feature |
| [src/editors/vacuum-maps-section.ts](../src/editors/vacuum-maps-section.ts) | 3 | branch:vacuum-map-calibration |
| [src/furniture.ts](../src/furniture.ts) | 3 | exclusion:current-feature |
| [src/geometry-cleanup.ts](../src/geometry-cleanup.ts) | 3 | branch:wall-model-chain |
| [src/grid-scale.ts](../src/grid-scale.ts) | 2 | exclusion:current-feature |
| [src/houseplan-card.ts](../src/houseplan-card.ts) | 4 | branch:derived-segments |
| [src/houseplan-card.ts](../src/houseplan-card.ts) | 2 | branch:marker-cover-action |
| [src/houseplan-card.ts](../src/houseplan-card.ts) | 3 | branch:wall-model-chain |
| [src/houseplan-card.ts](../src/houseplan-card.ts) | 10 | exclusion:current-feature |
| [src/houseplan-card.ts](../src/houseplan-card.ts) | 5 | exclusion:session-state |
| [src/houseplan-card.ts](../src/houseplan-card.ts) | 3 | exclusion:transport |
| [src/houseplan-editor-runtime.ts](../src/houseplan-editor-runtime.ts) | 14 | branch:decor-live-link |
| [src/houseplan-editor-runtime.ts](../src/houseplan-editor-runtime.ts) | 3 | branch:decor-width |
| [src/houseplan-editor-runtime.ts](../src/houseplan-editor-runtime.ts) | 28 | branch:wall-model-chain |
| [src/houseplan-editor-runtime.ts](../src/houseplan-editor-runtime.ts) | 6 | exclusion:current-feature |
| [src/houseplan-editor-runtime.ts](../src/houseplan-editor-runtime.ts) | 1 | exclusion:session-state |
| [src/houseplan-editor-runtime.ts](../src/houseplan-editor-runtime.ts) | 11 | exclusion:transport |
| [src/hp-device-preview.ts](../src/hp-device-preview.ts) | 2 | branch:marker-value-presentation |
| [src/hp-device-preview.ts](../src/hp-device-preview.ts) | 1 | exclusion:current-feature |
| [src/initial-load.ts](../src/initial-load.ts) | 1 | branch:layout-owner-repair |
| [src/interior-window-light.ts](../src/interior-window-light.ts) | 1 | exclusion:current-feature |
| [src/iso-openings.ts](../src/iso-openings.ts) | 1 | exclusion:current-feature |
| [src/iso-scene-render.ts](../src/iso-scene-render.ts) | 2 | branch:marker-value-presentation |
| [src/iso-walls.ts](../src/iso-walls.ts) | 1 | exclusion:current-feature |
| [src/logic.ts](../src/logic.ts) | 1 | branch:content-url |
| [src/logic.ts](../src/logic.ts) | 2 | branch:decor-live-link |
| [src/logic.ts](../src/logic.ts) | 4 | branch:decor-text-size |
| [src/logic.ts](../src/logic.ts) | 2 | branch:display-ripple |
| [src/logic.ts](../src/logic.ts) | 1 | branch:marker-cover-action |
| [src/logic.ts](../src/logic.ts) | 1 | branch:room-glow |
| [src/logic.ts](../src/logic.ts) | 3 | branch:space-font-scale |
| [src/logic.ts](../src/logic.ts) | 4 | branch:space-glow |
| [src/logic.ts](../src/logic.ts) | 9 | exclusion:current-feature |
| [src/open-spans.ts](../src/open-spans.ts) | 7 | branch:zero-wall-boundaries |
| [src/opening-context.ts](../src/opening-context.ts) | 1 | exclusion:current-feature |
| [src/opening-placement.ts](../src/opening-placement.ts) | 2 | exclusion:current-feature |
| [src/optimize-plans-dialog.ts](../src/optimize-plans-dialog.ts) | 7 | branch:layout-owner-repair |
| [src/optimize-unverified.ts](../src/optimize-unverified.ts) | 5 | branch:layout-owner-repair |
| [src/partition-openings.ts](../src/partition-openings.ts) | 6 | exclusion:current-feature |
| [src/physical-body-gesture.ts](../src/physical-body-gesture.ts) | 2 | exclusion:current-feature |
| [src/physical-geometry.ts](../src/physical-geometry.ts) | 1 | exclusion:current-feature |
| [src/plan-geometry-preflight.ts](../src/plan-geometry-preflight.ts) | 3 | exclusion:current-feature |
| [src/plan-optimizer.ts](../src/plan-optimizer.ts) | 5 | branch:decor-live-link |
| [src/plan-optimizer.ts](../src/plan-optimizer.ts) | 1 | branch:decor-text-size |
| [src/plan-optimizer.ts](../src/plan-optimizer.ts) | 3 | branch:decor-width |
| [src/plan-optimizer.ts](../src/plan-optimizer.ts) | 1 | branch:room-glow |
| [src/plan-optimizer.ts](../src/plan-optimizer.ts) | 1 | branch:space-glow |
| [src/plan-optimizer.ts](../src/plan-optimizer.ts) | 17 | branch:wall-model-chain |
| [src/pointer-modality.ts](../src/pointer-modality.ts) | 1 | exclusion:session-state |
| [src/radar-editor.ts](../src/radar-editor.ts) | 1 | exclusion:current-feature |
| [src/render-device-snapshot.ts](../src/render-device-snapshot.ts) | 1 | exclusion:current-feature |
| [src/render-snapshot-capture.ts](../src/render-snapshot-capture.ts) | 1 | exclusion:transport |
| [src/resize-atom-projection.ts](../src/resize-atom-projection.ts) | 2 | exclusion:current-feature |
| [src/resize-live-preflight.ts](../src/resize-live-preflight.ts) | 1 | exclusion:current-feature |
| [src/resize.ts](../src/resize.ts) | 1 | exclusion:current-feature |
| [src/room-appearance.ts](../src/room-appearance.ts) | 7 | branch:room-appearance |
| [src/room-deletion.ts](../src/room-deletion.ts) | 1 | exclusion:current-feature |
| [src/signal-visibility.ts](../src/signal-visibility.ts) | 1 | exclusion:current-feature |
| [src/space-geometry.ts](../src/space-geometry.ts) | 1 | branch:plan-scale |
| [src/space-geometry.ts](../src/space-geometry.ts) | 5 | exclusion:current-feature |
| [src/space-model-selection.ts](../src/space-model-selection.ts) | 1 | exclusion:current-feature |
| [src/space-reference-repair.ts](../src/space-reference-repair.ts) | 6 | branch:layout-owner-repair |
| [src/space-render.ts](../src/space-render.ts) | 3 | exclusion:current-feature |
| [src/stairs.ts](../src/stairs.ts) | 1 | exclusion:current-feature |
| [src/structural-space-record.ts](../src/structural-space-record.ts) | 3 | exclusion:current-feature |
| [src/styles/devices.styles.ts](../src/styles/devices.styles.ts) | 2 | exclusion:provider-api |
| [src/summary-panel-host.ts](../src/summary-panel-host.ts) | 1 | exclusion:current-feature |
| [src/summary-panel-runtime-loaded.ts](../src/summary-panel-runtime-loaded.ts) | 5 | exclusion:session-state |
| [src/summary-panel.ts](../src/summary-panel.ts) | 3 | exclusion:session-state |
| [src/sun.ts](../src/sun.ts) | 3 | exclusion:current-feature |
| [src/support-feedback.ts](../src/support-feedback.ts) | 1 | exclusion:transport |
| [src/touch-gesture-click-guard.ts](../src/touch-gesture-click-guard.ts) | 1 | exclusion:session-state |
| [src/types.ts](../src/types.ts) | 1 | branch:card-option |
| [src/types.ts](../src/types.ts) | 1 | branch:discovery-materialization |
| [src/types.ts](../src/types.ts) | 1 | branch:display-ripple |
| [src/types.ts](../src/types.ts) | 1 | branch:marker-cover-action |
| [src/types.ts](../src/types.ts) | 1 | branch:marker-value-presentation |
| [src/types.ts](../src/types.ts) | 1 | branch:room-glow |
| [src/types.ts](../src/types.ts) | 1 | branch:vacuum-map-calibration |
| [src/types.ts](../src/types.ts) | 1 | branch:vacuum-trail |
| [src/types.ts](../src/types.ts) | 1 | branch:zero-wall-boundaries |
| [src/types.ts](../src/types.ts) | 4 | exclusion:current-feature |
| [src/vacuum-ecovacs-client.ts](../src/vacuum-ecovacs-client.ts) | 1 | exclusion:provider-api |
| [src/vacuum-route-edit.ts](../src/vacuum-route-edit.ts) | 2 | branch:vacuum-map-calibration |
| [src/vacuum-routes.ts](../src/vacuum-routes.ts) | 11 | branch:vacuum-map-calibration |
| [src/vacuum-runtime-source.ts](../src/vacuum-runtime-source.ts) | 1 | exclusion:provider-api |
| [src/vacuum-trail-material.ts](../src/vacuum-trail-material.ts) | 5 | exclusion:provider-api |
| [src/vacuum.ts](../src/vacuum.ts) | 1 | branch:vacuum-trail |
| [src/vacuum.ts](../src/vacuum.ts) | 5 | exclusion:provider-api |
| [src/wall-face-graph.ts](../src/wall-face-graph.ts) | 1 | exclusion:session-state |
| [src/wall-merge.ts](../src/wall-merge.ts) | 4 | exclusion:current-feature |
| [src/wall-node-editor.ts](../src/wall-node-editor.ts) | 2 | exclusion:current-feature |
| [src/wall-node-history.ts](../src/wall-node-history.ts) | 3 | exclusion:current-feature |
| [src/wall-node-move.ts](../src/wall-node-move.ts) | 1 | exclusion:current-feature |
| [src/wall-node-refusal.ts](../src/wall-node-refusal.ts) | 3 | exclusion:current-feature |
| [src/wall-segment-model.ts](../src/wall-segment-model.ts) | 33 | branch:wall-model-chain |
| [src/wall-thickness.ts](../src/wall-thickness.ts) | 21 | branch:wall-model-chain |
| [src/wall-tool-compat.ts](../src/wall-tool-compat.ts) | 1 | exclusion:session-state |
| [src/zero-walls.ts](../src/zero-walls.ts) | 3 | branch:zero-wall-boundaries |

## Explicit non-config/current exclusions

- **current-feature**: Current supported behavior/default, live safety/geometry proof or a canonical projection ABI; no superseded persisted representation.
- **provider-api**: HA/device/provider/API capability or telemetry compatibility, not House Plan config-form decoding.
- **session-state**: Browser localStorage, gesture/tool/UI state, session token or dialog state, outside server config/layout.
- **transport**: Existing JSON/ZIP/HTTP/error response/old-client protocol compatibility; no persisted config selector.
- **word-only**: Documentation/reference/import or descriptive compatible geometry/naming, with no old persisted branch at this hit.

Runtime-only `legacyRadarPanels` / `legacyRadar` is dialog eligibility/panel state around the still-current `markers[].radar` block. The WeakMap is never stored. Existing contact_basis.legacy, rectangle rooms, walls[] projection, optional colour/default inheritance, room-hover visibility and device/provider availability remain current supported representations. Browser kiosk/summary localStorage and old tool/gesture tokens are outside the server migration authority. Operational robot trail/cache records and HA-managed registration records are not House Plan config/layout.

## Removal boundary

The canonical fence owns implicit scalar conversion and square-frame recovery. Separate cleanup removes redundant frontend ripple write normalization and the mature inert weather setting cleanup; the versioned server decoder remains. Render readers are retained for older backends and explicit unrepresentable subsets. Strict input schemas, structural downgrade/host/CAS guards and explicit Optimize semantics remain independently enforced. No model10, Store1.2 or archive-version bump is required.
