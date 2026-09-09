import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import {
  confirmedSummaryPanelWriteRecovery,
  defaultSummaryPanel,
  effectiveSummaryVisible,
  normalizeSummaryDraft,
  normalizeSummaryScale,
  parseSummaryLocal,
  resolveSummaryLayout,
  summaryPanelEntityIds,
  summaryLocalKey,
  summaryPanelOf,
  validateSummaryDraft,
  visibleSummaryBlocks,
} from '../test-build/summary-panel.js';
import {
  representedHaDeviceIds,
  summaryEntityValue,
  summarySystemValue,
  totalCleanFloorAreaM2,
} from '../test-build/summary-panel-metrics.js';
import { summaryPanelDictionaries, summaryPanelText } from '../test-build/summary-panel-i18n.js';
import { stableSummaryPlacementSlot } from '../test-build/summary-panel-identity.js';
import {
  SUMMARY_ENTITY_RESULT_LIMIT,
  refreshSummaryEntityIndex,
  searchSummaryEntityIndex,
} from '../test-build/summary-panel-picker.js';

const tr = (key) => key;

test('#437 keeps the settings form lazy and every summary surface action-free', () => {
  const loaded = readFileSync(new URL('../src/summary-panel-runtime-loaded.ts', import.meta.url), 'utf8');
  const editor = readFileSync(new URL('../src/summary-panel-editor.ts', import.meta.url), 'utf8');
  const card = readFileSync(new URL('../src/houseplan-card.ts', import.meta.url), 'utf8');
  const manifest = JSON.parse(readFileSync(new URL('../dist/houseplan-assets.json', import.meta.url), 'utf8'));
  assert.match(card, /import\('\.\/summary-panel-runtime-loaded'\)/);
  assert.match(loaded, /import\('\.\/summary-panel-editor'\)/);
  assert.ok(manifest.lazyFiles.some((path) => path.includes('summary-panel-runtime-loaded-')));
  assert.ok(manifest.initialViewFiles.every((path) => !path.includes('summary-panel')));
  assert.doesNotMatch(card, /from ['"]\.\/summary-panel-editor/);
  assert.doesNotMatch(`${loaded}\n${editor}`, /callService\s*\(/);
  assert.doesNotMatch(editor, /Object\.entries\(host\.hass\?\.states/);
  assert.doesNotMatch(editor, /entities\.map\([^)]*<option/s,
    'closed value rows must not contain a full entity option list');
  assert.match(editor, /data-summary-source-owner/);
  assert.doesNotMatch(editor, /maxlength=/i, 'limits count Unicode code points, not UTF-16 units');
  // #505 measures reduced-motion behaviour and actual editor, switch and
  // footer hit areas in the summary browser smokes. Neither a media-query
  // spelling nor a CSS selector proves a Web Animations/DOM contract.
});

test('#493 entity picker searches the full index while bounding rendered rows', () => {
  const states = Object.fromEntries(Array.from({ length: 10_000 }, (_, index) => {
    const id = `sensor.item_${String(index).padStart(5, '0')}`;
    return [id, { state: String(index), attributes: { friendly_name: `Reading ${index}` } }];
  }));
  const index = refreshSummaryEntityIndex(states, null);
  assert.equal(index.entries.length, 10_000);
  assert.equal(index.rebuilds, 1);
  const broad = searchSummaryEntityIndex(index, 'Reading');
  assert.equal(broad.entries.length, SUMMARY_ENTITY_RESULT_LIMIT);
  assert.equal(broad.total, 10_000);
  assert.equal(broad.truncated, true);
  const exact = searchSummaryEntityIndex(index, 'sensor.item_09999');
  assert.deepEqual(exact.entries.map((entry) => entry.id), ['sensor.item_09999']);
});

test('#493 entity index ignores state values and rebuilds once for composition or name', () => {
  const firstStates = {
    'sensor.a': { state: '1', attributes: { friendly_name: 'Alpha' } },
    'sensor.b': { state: '2', attributes: { friendly_name: 'Beta' } },
  };
  const first = refreshSummaryEntityIndex(firstStates, null);
  const stateOnly = refreshSummaryEntityIndex({
    ...firstStates, 'sensor.a': { ...firstStates['sensor.a'], state: '3' },
  }, first);
  assert.equal(stateOnly, first);
  assert.equal(stateOnly.rebuilds, 1);
  const renamed = refreshSummaryEntityIndex({
    ...firstStates,
    'sensor.a': { state: '3', attributes: { friendly_name: 'Aleph' } },
  }, stateOnly);
  assert.notEqual(renamed, stateOnly);
  assert.equal(renamed.rebuilds, 2);
  const added = refreshSummaryEntityIndex({ ...firstStates, 'sensor.c': { state: '4', attributes: {} } }, renamed);
  assert.equal(added.rebuilds, 3);
  const { 'sensor.b': _removed, ...withoutB } = firstStates;
  const removed = refreshSummaryEntityIndex({ ...withoutB, 'sensor.c': { state: '4', attributes: {} } }, added);
  assert.equal(removed.rebuilds, 4);
});

test('#493 runtime owns same-key scales and binds async UI to lifecycle generation', () => {
  const runtime = readFileSync(new URL('../src/summary-panel-runtime-loaded.ts', import.meta.url), 'utf8');
  const card = readFileSync(new URL('../src/houseplan-card.ts', import.meta.url), 'utf8');
  assert.match(card, /!this\._summary\?\.applyLocalScaleForCurrentIdentity\(\)/);
  assert.match(card, /this\._summary\?\.leaveRoute\(\)/);
  assert.match(runtime, /lifecycleGeneration/);
  assert.match(runtime, /if \(!this\.current\(generation\)\) return;/);
  assert.match(runtime, /activeSource: \{ blockId: string; valueId: string \}/);
});

test('#437 lazy summary dictionaries have exact parity and locale fallback', () => {
  const englishKeys = Object.keys(summaryPanelDictionaries.en).sort();
  for (const code of ['ru', 'de', 'fr']) {
    assert.deepEqual(Object.keys(summaryPanelDictionaries[code]).sort(), englishKeys);
    assert.ok(Object.values(summaryPanelDictionaries[code]).every((value) => value.trim()));
  }
  assert.equal(summaryPanelText('ru-RU', 'summary.default_title'), 'Сводная информация');
  assert.equal(summaryPanelText('xx', 'summary.default_title'), 'Summary');
});

test('#437 absent config derives deterministic defaults but explicit emptiness stays empty', () => {
  const first = summaryPanelOf({}, tr);
  const second = summaryPanelOf({}, tr);
  assert.equal(first.derived, true);
  assert.deepEqual(first.config, second.config);
  const empty = { version: 1, title: 'Mine', show_on_mobile: true, blocks: [] };
  assert.deepEqual(summaryPanelOf({ summary_panel: empty }, tr), {
    config: empty, derived: false, unsupported: false,
  });
  assert.equal(defaultSummaryPanel(tr).blocks[0].values.length, 3);
  assert.equal(summaryPanelOf({ summary_panel: {
    version: 1, title: 'Broken', show_on_mobile: true, blocks: [{}],
  } }, tr).unsupported, true);
});

test('#437 layout uses the stage, equality chooses right, and fit thresholds are stable', () => {
  assert.equal(resolveSummaryLayout({ width: 800, height: 600, minimumHeight: 162 }).side, 'right');
  assert.equal(resolveSummaryLayout({ width: 600, height: 800, minimumHeight: 162 }).side, 'bottom');
  assert.equal(resolveSummaryLayout({ width: 600, height: 600, minimumHeight: 162 }).side, 'right');
  assert.equal(resolveSummaryLayout({ width: 800, height: 185, minimumHeight: 162 }).fits, false);
  assert.equal(resolveSummaryLayout({ width: 800, height: 186, minimumHeight: 162 }).fits, true);
  assert.equal(resolveSummaryLayout({
    width: 800, height: 245, controlTop: 72, minimumHeight: 162,
  }).fits, false);
  assert.equal(resolveSummaryLayout({
    width: 800, height: 246, controlTop: 72, minimumHeight: 162,
  }).fits, true);
  assert.equal(resolveSummaryLayout({
    width: 324, height: 600, safeLeft: 10, safeRight: 10, minimumHeight: 162,
  }).fits, true);
  assert.equal(resolveSummaryLayout({
    width: 323, height: 600, safeLeft: 10, safeRight: 10, minimumHeight: 162,
  }).fits, false);
});

test('#437 local show, native narrow and fit are independent gates', () => {
  const base = { view: true, localShow: true, showOnMobile: false, fits: true };
  assert.equal(effectiveSummaryVisible({ ...base, narrow: false }), true);
  assert.equal(effectiveSummaryVisible({ ...base, narrow: true }), false);
  assert.equal(effectiveSummaryVisible({ ...base, narrow: null }), false);
  assert.equal(effectiveSummaryVisible({ ...base, showOnMobile: true, narrow: null }), true);
  assert.equal(effectiveSummaryVisible({ ...base, narrow: false, fits: false }), false);
  assert.equal(effectiveSummaryVisible({ ...base, narrow: false, view: false }), false);
});

test('#437 stable ids distinguish old broken references from new broken references', () => {
  const base = {
    version: 1, title: 'Summary', show_on_mobile: true,
    blocks: [{ id: 'b1', title: 'Block', visible: true,
      scope: { type: 'space', space_id: 'gone' },
      values: [{ id: 'v1', label: 'Old', source: { type: 'entity', entity_id: 'sensor.gone' } }] }],
  };
  const warnings = validateSummaryDraft(base, base, new Set(['floor']), new Set(['sensor.live']));
  assert.deepEqual(warnings.map((p) => p.kind), ['warning', 'warning']);
  const changed = structuredClone(base);
  changed.blocks[0].title = 'Renamed';
  changed.blocks[0].values[0].label = 'Renamed';
  assert.equal(validateSummaryDraft(changed, base, new Set(['floor']), new Set(['sensor.live']))
    .some((p) => p.kind === 'error'), false);
  changed.blocks[0].values[0].source.entity_id = 'sensor.other_gone';
  assert.equal(validateSummaryDraft(changed, base, new Set(['floor']), new Set(['sensor.live']))
    .some((p) => p.kind === 'error' && p.code === 'missing_entity'), true);
});

test('#437 scope filters blocks without changing their order', () => {
  const config = { version: 1, title: 'S', show_on_mobile: true, blocks: [
    { id: 'a', title: 'A', visible: true, scope: { type: 'all' }, values: [] },
    { id: 'b', title: 'B', visible: true, scope: { type: 'space', space_id: 'f2' }, values: [] },
    { id: 'c', title: 'C', visible: false, scope: { type: 'all' }, values: [] },
  ] };
  assert.deepEqual(visibleSummaryBlocks(config, 'f2').map((b) => b.id), ['a', 'b']);
  assert.deepEqual(visibleSummaryBlocks(config, 'f1').map((b) => b.id), ['a']);
});

test('#490 summary entity dependencies are complete, bounded and schema-aware', () => {
  const config = { version: 1, title: 'S', show_on_mobile: true, blocks: [
    { id: 'visible', title: 'Visible', visible: true, scope: { type: 'all' }, values: [
      { id: 'a', label: 'A', source: { type: 'entity', entity_id: 'sensor.a' } },
      { id: 'system', label: 'Time', source: { type: 'system', key: 'datetime' } },
    ] },
    { id: 'hidden', title: 'Hidden', visible: false,
      scope: { type: 'space', space_id: 'another-floor' }, values: [
        { id: 'a-again', label: 'A again', source: { type: 'entity', entity_id: 'sensor.a' } },
        { id: 'b', label: 'B', source: { type: 'entity', entity_id: '  sensor.b  ' } },
      ] },
  ] };
  assert.deepEqual(summaryPanelEntityIds(config), ['sensor.a', 'sensor.b']);
  assert.deepEqual(summaryPanelEntityIds(null), []);
  assert.deepEqual(summaryPanelEntityIds({ ...config, version: 2 }), []);
});

test('#490 lost-ACK proof requires the exact panel, full config and revision', () => {
  const draft = defaultSummaryPanel(tr);
  draft.title = 'Saved summary';
  const authoritative = {
    spaces: [{ id: 'f1', title: 'Concurrent title' }], markers: [],
    settings: { summary_panel: structuredClone(draft), concurrent: true },
  };
  assert.deepEqual(confirmedSummaryPanelWriteRecovery({ config: authoritative, rev: 42 }, draft), {
    config: authoritative, rev: 42,
  });

  const different = structuredClone(authoritative);
  different.settings.summary_panel.title = 'Another summary';
  for (const response of [
    null,
    { config: authoritative },
    { config: authoritative, rev: 1.5 },
    { config: authoritative, rev: -1 },
    { config: null, rev: 42 },
    { config: { settings: authoritative.settings }, rev: 42 },
    { config: different, rev: 43 },
  ]) assert.equal(confirmedSummaryPanelWriteRecovery(response, draft), null);
});

test('#437 local preferences use legacy sizes once but never legacy show', () => {
  assert.deepEqual(parseSummaryLocal(null, { icon: 1.35, font: 0.8 }), {
    version: 1, show: false, icon_scale: 1.35, font_scale: 0.8,
  });
  assert.deepEqual(parseSummaryLocal({ show: true, icon_scale: 99, font_scale: 'bad' }, { font: 1.2 }), {
    version: 1, show: true, icon_scale: 3, font_scale: 1,
  });
  assert.notEqual(
    summaryLocalKey({ userId: 'u', path: '/dash', host: 'card', slot: '0' }),
    summaryLocalKey({ userId: 'u', path: '/dash', host: 'card', slot: '1' }),
  );
  assert.equal(summaryLocalKey({ userId: '', slot: '1' }), null);
  assert.equal(normalizeSummaryScale(1.234), 1.25);
});

test('#437 placement identity survives Masonry reflow and inner-card remount', () => {
  const page = { localName: 'hui-view', parentNode: null, children: [] };
  const masonry = { localName: 'hui-masonry-view', parentNode: page, children: [] };
  const firstWrapper = { localName: 'hui-card', parentNode: masonry, children: [] };
  const secondWrapper = { localName: 'hui-card', parentNode: masonry, children: [] };
  const firstCard = { localName: 'houseplan-card', parentNode: firstWrapper, children: [] };
  const secondCard = { localName: 'houseplan-card', parentNode: secondWrapper, children: [] };
  page.children = [masonry];
  masonry.children = [firstWrapper, secondWrapper];
  firstWrapper.children = [firstCard];
  secondWrapper.children = [secondCard];

  const firstSlot = stableSummaryPlacementSlot(firstCard);
  const secondSlot = stableSummaryPlacementSlot(secondCard);
  assert.notEqual(firstSlot, secondSlot, 'two logical cards need distinct preference keys');

  masonry.children = [secondWrapper, firstWrapper];
  assert.equal(stableSummaryPlacementSlot(firstCard), firstSlot, 'visual column reflow must not change the key');

  const remountedCard = { localName: 'houseplan-card', parentNode: firstWrapper, children: [] };
  firstWrapper.children = [remountedCard];
  assert.equal(stableSummaryPlacementSlot(remountedCard), firstSlot, 'native wrapper owns the key across remount');
});

test('#437 device total counts unique represented real HA device ids before visual filters', () => {
  const registry = {
    authoritative: true,
    devices: {
      d1: { id: 'd1', area_id: 'kitchen' },
      d2: { id: 'd2', area_id: null },
      d3: { id: 'd3', area_id: 'missing' },
      d4: { id: 'd4', area_id: 'kitchen' },
      d5: { id: 'd5', area_id: 'kitchen' },
    },
    entities: {
      'sensor.two': { entity_id: 'sensor.two', device_id: 'd2' },
      'sensor.standalone': { entity_id: 'sensor.standalone', device_id: null },
      'sensor.restored': { entity_id: 'sensor.restored', device_id: 'd5' },
    },
  };
  const result = representedHaDeviceIds({
    registry, areaToSpace: { kitchen: 'f1' }, spaceIds: new Set(['f1']), firstSpaceId: 'f1',
    markers: [
      { id: 'm2', binding: 'entity:sensor.two', space: 'f1', hidden: true },
      { id: 'm2-copy', binding: 'device:d2', space: 'f1' },
      { id: 'standalone', binding: 'entity:sensor.standalone', space: 'f1' },
      { id: 'orphan', binding: 'device:d3', space: 'gone' },
      { id: 'virtual', binding: 'virtual', space: 'f1' },
      { id: 'removed-area-device', binding: 'device:d4', removed: true, hidden: true },
      { id: 'removed-parent', binding: 'device:d5', removed: true, hidden: true },
      { id: 'restored-child', binding: 'entity:sensor.restored', space: 'f1' },
    ],
  });
  assert.deepEqual([...result].sort(), ['d1', 'd2', 'd5']);
  assert.equal(representedHaDeviceIds({
    ...{ registry: { ...registry, authoritative: false } }, areaToSpace: {},
    spaceIds: new Set(), firstSpaceId: '', markers: [],
  }), null);
});

test('#437 clean-floor total unions overlapping rooms before measuring', () => {
  const rooms = [
    { id: 'r1', name: 'A', poly: [[0, 0], [100, 0], [100, 100], [0, 100]] },
    { id: 'r2', name: 'B', poly: [[50, 0], [150, 0], [150, 100], [50, 100]] },
  ];
  const model = [{
    id: 'f1', title: 'Floor', cellCm: 5, vb: [0, 0, 1000, 1000], bg: null,
    rooms, wall_segments: [], partitions: [], wall_columns: [],
  }];
  const config = { spaces: [{
    id: 'f1', title: 'Floor', cell_cm: 5, view_box: [0, 0, 1, 1], rooms,
    wall_segments: [], partitions: [], wall_columns: [], openings: [], walls: [],
  }], markers: [], settings: {} };
  assert.equal(totalCleanFloorAreaM2(config, model), 2.16);
});

test('#437 labels use Unicode code points, normalize only known text, and retain extensions', () => {
  const draft = defaultSummaryPanel(tr);
  draft.title = `  ${'😀'.repeat(48)}  `;
  draft.extension = { future: true };
  draft.blocks[0].title = ' General ';
  const normalized = normalizeSummaryDraft(draft);
  assert.equal(normalized.title, '😀'.repeat(48));
  assert.equal(normalized.blocks[0].title, 'General');
  assert.deepEqual(normalized.extension, { future: true });
  assert.equal(validateSummaryDraft(normalized, null, new Set(), new Set()).some(
    (problem) => problem.path === 'title' && problem.kind === 'error',
  ), false);
  normalized.title += '😀';
  assert.equal(validateSummaryDraft(normalized, null, new Set(), new Set()).some(
    (problem) => problem.path === 'title' && problem.code === 'limit',
  ), true);
});

test('#437 entity and system sources preserve real zero and delegate HA formatting', () => {
  const state = { state: '12.345', attributes: { unit_of_measurement: '°C' } };
  const hass = {
    states: { 'sensor.room': state, 'sensor.offline': { state: 'unavailable', attributes: {} } },
    formatEntityState: (value) => value === state ? '12,3 °C' : value.state,
    config: { unit_system: { length: 'km' }, time_zone: 'UTC' },
  };
  assert.equal(summaryEntityValue(hass, 'sensor.room'), '12,3 °C');
  assert.equal(summaryEntityValue(hass, 'sensor.offline'), 'unavailable');
  assert.equal(summaryEntityValue(hass, 'sensor.gone'), null);
  assert.equal(summarySystemValue(
    { type: 'system', key: 'device_count' },
    { deviceCount: 0, areaM2: 0, now: new Date('2026-01-01T00:00:00Z') }, hass, 'en',
  ), '0');
  assert.equal(summarySystemValue(
    { type: 'system', key: 'total_area' },
    { deviceCount: 0, areaM2: 0, now: new Date('2026-01-01T00:00:00Z') }, hass, 'en',
  ), '0.0 m²');
});
