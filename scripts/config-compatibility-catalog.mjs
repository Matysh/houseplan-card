// #1015. Decisions about persisted representations, not a second task backlog.
import published from './config-published-releases.json' with { type: 'json' };
export function publishedStableSequence(releases) {
  return releases.filter((item) => !item.isDraft && !item.isPrerelease && /^v\d+\.\d+\.\d+$/.test(item.tagName))
    .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt)).map((item) => item.tagName);
}
export const PUBLISHED_STABLES = Object.freeze(publishedStableSequence(published.releases));
export function sunsetUntil(since, sequence = PUBLISHED_STABLES) {
  if (since.kind !== 'stable') return { kind: 'keep', reason: since.reason };
  const index = sequence.indexOf(since.release);
  if (index < 0) throw new Error(`Unpublished since release: ${since.release}`);
  return index + 2 < sequence.length
    ? { kind: 'stable', release: sequence[index + 2], after: since.release, count: 2 }
    : { kind: 'pending', after: since.release, count: 2, remaining: index + 3 - sequence.length };
}
const oldBackend = 'View also supports a newer frontend with an older backend; version mismatch does not gate reads. That backend cannot run the new canonical decoder.';
const unknown = (reason) => ({ kind: 'unproven', reason });
const stable = (commit, release) => ({ kind: 'stable', commit, release });
const source = (path, symbol) => ({ path, symbol });
const contractProofs = {
  'wall-model-chain': ['tests_backend/test_wall_segment_model.py', 'test/wall-segment-model.test.mjs'],
  'zero-wall-boundaries': ['tests_backend/test_wall_segment_model.py', 'test/wall-segment-model.test.mjs'],
  'room-appearance': ['tests_backend/test_ha_import_export.py', 'test/room-appearance.test.mjs'],
  'space-font-scale': ['tests_backend/test_validation.py', 'test/device-battery-settings.test.mjs'],
  'vacuum-map-calibration': ['tests_backend/test_vacuum_routes.py', 'test/vacuum-routes.test.mjs'],
  'marker-cover-action': ['tests_backend/test_validation.py', 'test/device-toggle.test.mjs'],
  'marker-value-presentation': ['test/device-face.test.mjs', 'test/logic.test.mjs'],
  'layout-owner-repair': ['test/space-reference-repair.test.mjs'],
  'content-url': ['test/logic.test.mjs', 'tests_backend/test_ha_import_export.py'],
  'card-option': ['test/config-audit.test.mjs'],
  'unused-vacuum-options': ['tests_backend/test_validation.py', 'test/config-audit.test.mjs'],
};
const extraSelectors = {
  'wall-model-chain': [{ path: ['model_version'], test: 'absent-or-below', value: 10 }],
  'space-font-scale': [{ path: ['spaces', '*', 'settings', 'card_font_scale'], test: 'present' }],
  'vacuum-map-calibration': [{ path: ['markers', '*', 'vacuum', 'calibration'], test: 'present' }],
  'marker-cover-action': [{ path: ['markers', '*', 'tap_action'], equals: 'cover' }],
  'marker-value-presentation': [{ path: ['markers', '*', 'value_badge'], test: 'absent-or-null' }],
  'layout-owner-repair': [{ root: 'layout', path: ['*', 's'], test: 'unverified owner/space or grp_<HA-area> key' }],
  'content-url': [{ path: ['spaces', '*', 'plan_url'], test: 'old owned static URL' },
    { path: ['markers', '*', 'pdfs', '*', 'url'], test: 'old owned static URL' }],
};
const record = (id, fields, oldForm, newForm, anchors, since, migration, reason, retire = false) => ({
  id, fields, selectors: [...fields.map((field) => ({ registry: field })), ...(extraSelectors[id] || [])],
  oldForm, newForm, anchors, since, until: sunsetUntil(since),
  provenance: since.kind === 'stable' ? { commit: since.commit, firstStable: since.release }
    : { kind: 'unproven', reason: since.reason },
  migration, proof: contractProofs[id] || ['tests_backend/test_config_migrations.py', 'tests_backend/test_ha_config_migrations.py'],
  decision: { kind: retire ? 'remove' : 'keep', reason },
  allInputsCanonical: retire,
});

export const COMPATIBILITY_BRANCHES = Object.freeze([
  record('display-ripple', ['markers[].display=ripple'], 'display:ripple', 'display:icon_ripple',
    [source('src/logic.ts', 'normalizeDeviceDisplay'), source('src/geometry-cleanup.ts', 'normalizeLegacyGeometryInPlace'),
      source('custom_components/houseplan/config_migrations.py', '_scalars_v1')],
    stable('d2bec266ed2c2c01167a15c910c028cc3bfa17fa', 'v1.59.0'), 'v1 display-ripple; strict schema retains old input, server stores current', oldBackend),
  record('vacuum-trail', ['markers[].vacuum.trail'], 'trail:boolean|null', 'trail_mode:never|cleaning|always',
    [source('src/vacuum.ts', 'vacTrailMode'), source('custom_components/houseplan/config_migrations.py', '_scalars_v1')],
    stable('75524d9d853710dbde2672c6c0bf87e4b84e03fa', 'v1.54.0'), 'v1 vacuum-trail; explicit current mode wins; false maps to never, other old values to cleaning', oldBackend),
  record('plan-scale', ['spaces[].plan_scale'], 'plan_scale uniform, per-axis overrides optional', 'plan_scale_x/y independent',
    [source('src/space-geometry.ts', 'planRect'), source('src/backdrop-frame-gesture.ts', 'baseScale'),
      source('custom_components/houseplan/config_migrations.py', '_scalars_v1')],
    stable('29fb9deb43f59f9c2477ae4b11391dc76b0efb15', 'v1.60.0'), 'v1 plan-scale; canonical axes win independently, absence/null falls back to old scale', oldBackend),
  record('space-glow', ['spaces[].settings.fill_mode=glow'], 'fill_mode:glow', 'fill_mode:none + glow_enabled',
    [source('src/logic.ts', 'spaceDisplayOf'), source('custom_components/houseplan/config_migrations.py', '_scalars_v1')],
    stable('fb382bfa11d4bf7bbd826c01ae7330757e836b90', 'v1.61.0'), 'v1 space-glow; explicit boolean wins', oldBackend),
  record('room-glow', ['spaces[].rooms[].settings.fill_mode=glow'], 'room fill_mode:glow', 'inherited fill + room glow boolean',
    [source('src/logic.ts', 'roomGlowOf'), source('custom_components/houseplan/config_migrations.py', '_scalars_v1')],
    stable('fb382bfa11d4bf7bbd826c01ae7330757e836b90', 'v1.61.0'), 'v1 room-glow; explicit boolean wins', oldBackend),
  record('decor-width', ['spaces[].decor[].width'], 'width in render units', 'width_cm physical',
    [source('src/editors/decor/geometry.ts', 'decorStrokeCm/decorStrokeUnits'), source('src/plan-optimizer.ts', 'migrateLosslessly'),
      source('custom_components/houseplan/config_migrations.py', '_scalars_v1')],
    stable('29fb9deb43f59f9c2477ae4b11391dc76b0efb15', 'v1.60.0'),
    'v1 converts only exact representable 0.1..100cm; canonical positive value wins',
    'Legal width:30 at cell_cm:1000 renders 7200cm; canonical width_cm is limited to100. Clamping changes the drawing. Retain unrepresentable subset and older-backend reader.'),
  record('decor-text-size', ['spaces[].decor[text].size', 'spaces[].decor[text].scale'], 'size:s|m|l or scale multiplier', 'size_cm physical',
    [source('src/logic.ts', 'decorTextScale'), source('src/plan-optimizer.ts', 'migrateLosslessly'),
      source('custom_components/houseplan/config_migrations.py', '_scalars_v1')],
    stable('29fb9deb43f59f9c2477ae4b11391dc76b0efb15', 'v1.60.0'),
    'v1 converts exact representable 0.1..2000cm; explicit scale wins over size',
    'Legal scale:20 with cell_cm:1000 needs96000cm, outside size_cm2000. Keep that subset and old-backend readers; do not use Optimize clamps during a transparent read.'),
  record('decor-live-link', ['spaces[].decor[text].entity', 'spaces[].decor[text].attr', 'spaces[].decor[text].unit'],
    'one entity/attr/unit + optional {} placeholder', 'inline {entity[:attribute]} references',
    [source('src/logic.ts', 'liveText'), source('src/houseplan-editor-runtime.ts', '_decorTextDialog'),
      source('src/plan-optimizer.ts', 'migrateLosslessly')],
    unknown('Inline replacement is beta-era; a full semantic replacement for explicit units/noncanonical attribute names does not exist.'),
    'Explicit editor/Optimize converts only representable tokens; transparent decoder retains all old links',
    'An explicit unit and arbitrary bounded attribute cannot be expressed by the inline grammar without changing HA formatting. No lossless total replacement; retain exact side fields.'),
  record('square-canvas', ['spaces[].aspect'], 'aspect-based paired coordinates', 'square config/layout coordinates + plan_aspect',
    [source('custom_components/houseplan/geometry_migration.py', 'migrate_config/migrate_layout'),
      source('custom_components/houseplan/config_migrations.py', 'migrate_pair')],
    stable('94b298962a34baf8da16b15484304092bcfe191c', 'v1.49.0'),
    'v1 square-canvas before scalar unit conversion; resumes old geom_pending as well as new paired intent',
    'The versioned import/load decoder remains for skipped installations and old backups. aspect is not a working-render fallback; strict ordinary write still drops stale aspect.'),
  record('derived-segments', ['spaces[].segments'], 'standalone per-space segments', 'walls derived from room contours',
    [source('src/geometry-cleanup.ts', 'normalizeLegacyGeometryInPlace'), source('custom_components/houseplan/validation.py', 'SPACE_SCHEMA'),
      source('custom_components/houseplan/config_migrations.py', '_scalars_v1')],
    stable('65268a798524531d7d7ff10d1454fe5f1b27bd4f', 'v1.21.1'),
    'v1 derived-segments drops dead records; strict schema independently drops stale writer input',
    'No renderer consumes this dead collection. The strict stale-input decoder is retained; it cannot delete partitions or current wall catalogue records.'),
  record('zero-wall-boundaries', ['spaces[].open_spans', 'spaces[].rooms[].open_to'], 'open_spans/open_to virtual contours below model9', 'proven cm:0 wall atoms',
    [source('src/zero-walls.ts', 'legacyZeroContourLines'), source('src/open-spans.ts', 'expandLegacyOpenSpans'),
      source('src/wall-segment-model.ts', 'commitWallSegmentModelInPlace'), source('custom_components/houseplan/wall_segment_model.py', 'commit_wall_segment_model')],
    stable('a66fb7ef53906bed33c6f92369b14e8e398be3bd', 'v1.68.0'),
    'Existing explicit structural write/Optimize and canonical import model chain; not silently forced on every read',
    'The model9 contract intentionally changes degraded opening/light behavior and may need host proof. A lossless transparent migration for every tolerated old geometry is not proven; old backend and read-only degraded plans remain supported.'),
  record('wall-model-chain', [], 'catalogue-less rooms, old drafts, midpoint-only thickness/host evidence', 'models8→9→10 catalogue, partitions and proven hosts',
    [source('src/wall-segment-model.ts', 'commitWallSegmentModelInPlace'), source('src/wall-thickness.ts', 'exactCoveringWall'),
      source('custom_components/houseplan/wall_segment_model.py', 'commit_wall_segment_model'), source('custom_components/houseplan/validation.py', 'validate_wall_model_transition')],
    unknown('Multiple independent structural migrations; model number is not a scalar-field sunset date.'),
    'Existing versioned structural migration on import/explicit structural write; ownership proof may refuse',
    'Ambiguous wall ownership and malformed-but-readable old drafts cannot be guessed on load. Keep exact current proof/read paths; canonical walls[] is also a current projection ABI.'),
  record('discovery-materialization', ['settings.show_all'], 'unseeded runtime discovery filter', 'filter_seeded + explicit hidden marker intents',
    [source('src/devices.ts', 'seedHiddenBindings/buildDevices'), source('custom_components/houseplan/config_migrations.py', '_scalars_v1')],
    stable('694e1e9a3b3c1564d0f10eae036fc59dd7d02240', 'v1.51.0'),
    'Existing editing-client seeding with authoritative roster; v1 removes show_all only when filter_seeded:true',
    'A pure decoder has no registry/provider roster and must not invent or reveal hidden devices. Unseeded forms stay until that authoritative seed; current discovery filters stay active.'),
  record('room-appearance', ['settings.fill_colors.wall_fill'], 'global wall fill / coupled room caption colour', 'local wall_fill/name_color',
    [source('src/room-appearance.ts', 'spaceAppearanceOf'), source('custom_components/houseplan/room_appearance.py', 'normalize_room_appearance')],
    unknown('Replacement commit a94ad5a92105075eae18f4ae48648abe8c629f98 exists only in v1.83.0-beta.1/.2; no published stable contains it yet.'),
    'Existing copy-only source projection and ordinary write/transfer materialization; defaults remain optional',
    'Recent additive representation plus older backend reads. Materializing absent optional defaults on every current load would violate no-op; local explicit fields remain authoritative.'),
  record('space-font-scale', ['spaces[].settings.card_font_scale'], 'card_font_scale common multiplier', 'independent card_name_scale/card_label_scale',
    [source('src/logic.ts', 'spaceDisplayOf'), source('custom_components/houseplan/validation.py', 'SPACE_DISPLAY_SCHEMA'), source('src/editors/space-dialog-draft.ts', 'spaceDialogSettings')],
    stable('acd2e6685f8e511d8ccbe3a1064d03a983d39a84', 'v1.82.0'),
    'Space settings Save materializes independent fields; retained old key is an explicit rollback mirror',
    'Absent current keys intentionally inherit old value until explicit form Save. Keep read inheritance and rollback mirror; not an orphaned decoder.'),
  record('vacuum-map-calibration', ['markers[].vacuum.calibration'], 'map_id→matrix without source/space', 'explicit versioned map_routes',
    [source('src/vacuum-routes.ts', 'effectiveRoutes'), source('src/vacuum-route-edit.ts', 'convertLegacyRoutes'),
      source('custom_components/houseplan/vacuum_routes.py', 'effective_routes')],
    unknown('A total replacement needs exact robot source/space evidence unavailable in a context-free old backup.'),
    'Existing explicit routing edit converts whole dictionary atomically after source proof',
    'Inventing a source or floor changes route authority. Keep old dictionary and live run adoption; provider telemetry fallbacks are a separate non-config exclusion.'),
  record('marker-cover-action', ['markers[].tap_action=cover'], 'tap_action:cover', 'UI projection toggle',
    [source('src/device-toggle.ts', 'resolveToggle/legacy-cover'), source('src/logic.ts', 'TAP_ACTIONS')],
    unknown('No semantically identical replacement for explicit historical cover-target authority.'),
    'None: preserve explicit target identity; UI projects select without rewriting untouched marker',
    'Rewriting cover to generic toggle can change chosen entity/service. It is still accepted guarded action data, not an expired enum alias.'),
  record('marker-value-presentation', ['markers[].use_climate_temp'], 'implicit temperature/humidity source + secondary metric', 'explicit value_badge single source',
    [source('src/device-value-badge.ts', 'legacySource'), source('src/device-face.ts', 'legacySupplementalMetrics')],
    unknown('The new single badge cannot represent two old metrics without loss.'),
    'Only a deliberate badge edit chooses a current explicit source',
    'A second old metric and implicit primary resolution are observable. Preserve until explicit user choice; lossless total replacement does not exist.'),
  record('layout-owner-repair', [], 'grp_<HA-area> and old/missing space references', 'exact owner-derived stable space reference',
    [source('src/space-reference-repair.ts', 'repairSpaceReferences'), source('src/initial-load.ts', 'resolveInitialSpace')],
    unknown('Unverified owner/registry-unavailable references intentionally have no guessed replacement.'),
    'Existing explicit owner proof/Optimize, preserving unknown entries on refusal',
    'A missing HA roster or ambiguous owner prevents a total migration. Current f1 hint alone is not ownership; keep refusal/proof paths.'),
  record('content-url', [], '/houseplan_files/plans|files old URL', '/api/houseplan/content authenticated URL',
    [source('src/logic.ts', 'contentUrl'), source('custom_components/houseplan/websocket_api.py', 'ws_content_sign')],
    unknown('External URLs and historical local URLs share fields; exact scoped rewrite provenance is not established.'),
    'Existing owned local-path read projection; external URLs preserved',
    'Older backend static content remains supported. Blanket stored URL rewrite could change external ownership/signing; keep scoped current read adapter.'),
  record('card-option', ['card.tap_action'], 'Lovelace tap_action', 'per-marker action',
    [source('src/types.ts', 'CardConfig')],
    unknown('External Lovelace option; House Plan server cannot rewrite another integration’s persisted card config.'),
    'Ignored current card option; optional manual cleanup has no visual effect',
    'Outside server Store/import authority. Keep permissive external option; not a runtime action branch.'),
  record('weather-option', ['settings.weather_entity'], 'unused weather entity setting', 'sun geometry/elevation without weather entity',
    [source('custom_components/houseplan/config_migrations.py', '_scalars_v1'),
      source('src/houseplan-editor-runtime.ts', '_saveSettingsDialog'), source('custom_components/houseplan/validation.py', 'CONFIG_SCHEMA')],
    stable('2a8302f4d6af58a6f2182bc569e4003b658a1d4d', 'v1.60.2'),
    'v1 weather-option removes only the independently valid bounded obsolete key at load/write/import',
    'No runtime consumer exists since v1.60.2. V1 canonicalizes current inputs; older-backend values remain inert in this frontend. The duplicate settings write conversion is retired; strict stale-input schema remains.', true),
  record('unused-vacuum-options', ['markers[].vacuum.room_highlight', 'markers[].vacuum.segment_map'],
    'opaque hidden vacuum options', 'no replacement decision', [source('custom_components/houseplan/validation.py', 'MARKER_SCHEMA')],
    unknown('No supported replacement or product retirement decision has been proven.'),
    'None: retain losslessly', 'No replacement authority; unchanged options must survive backup/import/write.'),
]);

export const COMPATIBILITY_EXCLUSIONS = Object.freeze({
  'current-feature': 'Current supported behavior/default, live safety/geometry proof or a canonical projection ABI; no superseded persisted representation.',
  'provider-api': 'HA/device/provider/API capability or telemetry compatibility, not House Plan config-form decoding.',
  'session-state': 'Browser localStorage, gesture/tool/UI state, session token or dialog state, outside server config/layout.',
  'transport': 'Existing JSON/ZIP/HTTP/error response/old-client protocol compatibility; no persisted config selector.',
  'word-only': 'Documentation/reference/import or descriptive compatible geometry/naming, with no old persisted branch at this hit.',
});

export function fieldLifecycle(entry) {
  const branch = COMPATIBILITY_BRANCHES.find((item) => item.fields.includes(entry.id));
  if (branch) return { branch: branch.id, since: branch.since, until: branch.until, provenance: branch.provenance };
  if (entry.status !== 'current') throw new Error(`Unclassified compatibility field: ${entry.id}`);
  const reason = 'Current supported representation/default; no superseding form or sunset applies.';
  return { since: { kind: 'not-applicable', reason }, until: { kind: 'not-applicable', reason },
    provenance: { kind: 'current', source: entry.enforcedBy || entry.runtime } };
}
