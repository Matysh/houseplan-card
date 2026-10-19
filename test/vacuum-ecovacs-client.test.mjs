import test from 'node:test';
import assert from 'node:assert/strict';
import { adoptEcovacsSources, projectEcovacsSources, ecovacsSourceState, ecovacsSourceAllowed, vacuumMapPreview } from '../test-build/vacuum-ecovacs-client.js';
import { loadVacuumImageFit, vacuumImageFitCurrent } from '../test-build/editors/vacuum-image-fit.js';
import { planVacuumFit } from '../test-build/vacuum-route-edit.js';
import { fitMatrix, applyAffine } from '../test-build/vacuum.js';

const stamp = '2026-10-19T10:00:00+00:00';
const context = { connection: {}, user: { id: 'reader' } };
const frame = { vacuum: 'vacuum.robot', map_id: 'floor', state_revision: stamp, position: { x: -3, y: 4 },
  bounds: [-10, -20, 100, 80], native_path: true, reason: null };
const packet = (value = frame) => ({ trail_format: 2, vacuum_source_format: 1,
  vacuum_sources: { 'image.map': value } });
const hass = () => ({ ...context, states: { 'image.map': { state: stamp, last_updated: stamp,
  attributes: { map_name: 'floor', access_token: 'local-only' } } },
  entities: { 'image.map': { platform: 'ecovacs' } } });

test('one Ecovacs image cannot lend another robot its projected geometry', () => {
  const base = { entities: { 'image.map': { platform: 'ecovacs', device_id: 'a' },
    'vacuum.robot': { platform: 'ecovacs', device_id: 'a' },
    'vacuum.other': { platform: 'ecovacs', device_id: 'b' } } };
  assert.equal(ecovacsSourceAllowed(base, 'image.map', 'vacuum.robot'), true);
  assert.equal(ecovacsSourceAllowed(base, 'image.map', 'vacuum.other'), false);
  assert.equal(ecovacsSourceAllowed(base, 'image.map', null), false);
  assert.equal(ecovacsSourceAllowed(base, 'camera.xcme', 'vacuum.other'), true);
  base.entities['image.map'].disabled_by = 'user';
  assert.equal(ecovacsSourceAllowed(base, 'image.map', 'vacuum.robot'), false);
});

test('current same-source projection changes no HA state and keeps shared SVG units', () => {
  const owner = {}, original = hass();
  adoptEcovacsSources(owner, packet(), context);
  const result = projectEcovacsSources(owner, original, context);
  assert.notEqual(result, original);
  assert.deepEqual(result.states['image.map'].attributes.vacuum_position, { x: -3, y: 4 });
  assert.deepEqual(result.states['image.map'].attributes.houseplan_map_bounds, [-10, -20, 100, 80]);
  assert.equal(original.states['image.map'].attributes.vacuum_position, undefined);
  assert.equal(ecovacsSourceState(owner, context, 'image.map').supported, true);
});

test('HA timestamps compare by instant, including Z and millisecond serialization', () => {
  const owner = {}, base = hass();
  base.states['image.map'].last_updated = '2026-10-19T10:00:00.123Z';
  adoptEcovacsSources(owner, packet({ ...frame, state_revision: '2026-10-19T10:00:00.123456+00:00' }), context);
  assert.notEqual(projectEcovacsSources(owner, base, context), base);
  base.states['image.map'].last_updated = '2026-10-19T10:00:00.124Z';
  assert.equal(projectEcovacsSources(owner, base, context), base);
});

test('old backend, connection/user replacement, stale revision and unavailable registry rows do not project', () => {
  const owner = {};
  adoptEcovacsSources(owner, packet(), context);
  for (const other of [{ connection: {}, user: context.user }, { connection: context.connection, user: { id: 'other' } }]) {
    const base = hass();
    assert.equal(projectEcovacsSources(owner, base, other), base);
    assert.equal(ecovacsSourceState(owner, other, 'image.map').supported, false);
  }
  for (const mutate of [
    h => { h.states['image.map'].last_updated = '2026-10-19T10:01:00Z'; },
    h => { h.states['image.map'].attributes.map_name = 'different'; },
    h => { h.states['image.map'].state = 'unavailable'; },
    h => { h.entities['image.map'].disabled_by = 'user'; },
    h => { h.entities['image.map'].platform = 'other'; },
    h => { delete h.states['image.map']; },
  ]) {
    const base = hass(); mutate(base);
    assert.equal(projectEcovacsSources(owner, base, context), base);
  }
  adoptEcovacsSources(owner, { trail_format: 2 }, context);
  const base = hass();
  assert.equal(projectEcovacsSources(owner, base, context), base);
});

test('malformed geometry never reaches source candidates or overwrites unrelated rows', () => {
  const owner = {};
  for (const bad of [null, {}, { ...frame, position: { x: NaN, y: 1 } },
    { ...frame, position: { x: '2', y: 1 } }, { ...frame, bounds: [0, 0, -1, 2] },
    { ...frame, state_revision: 'yesterday' }, { ...frame, native_path: 'yes' },
    { ...frame, reason: 'unsafe unknown reason' }]) {
    adoptEcovacsSources(owner, packet(bad), context);
    const base = hass();
    assert.equal(projectEcovacsSources(owner, base, context), base);
  }
  adoptEcovacsSources(owner, packet({ ...frame, position: null, native_path: true }), context);
  const base = hass();
  assert.equal(projectEcovacsSources(owner, base, context).states['image.map'].attributes.houseplan_native_path, true);
});

test('preview accepts only bounded PNG for the exact source and map, not SVG/URLs or another response', () => {
  const preview = { source: 'image.map', map_id: 'floor', revision: 'a'.repeat(64), bounds: frame.bounds,
    image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==' };
  assert.ok(vacuumMapPreview(preview, 'image.map', 'floor'));
  for (const bad of [{ ...preview, image: 'https://ha.invalid/image' },
    { ...preview, image: 'data:image/svg+xml;base64,PHN2Zz4=' },
    { ...preview, source: 'image.other' }, { ...preview, map_id: 'other' },
    { ...preview, revision: 'job' }, { ...preview, bounds: [0, 0, 1, Infinity] }]) {
    assert.equal(vacuumMapPreview(bad, 'image.map', 'floor'), null);
  }
});

test('map-only initial fit centres real bounds uniformly without the old Y mirror; stored matrix wins', () => {
  const options = { source: 'image.map', mapId: 'floor', dockSpace: 'f1', rooms: [],
    mapBounds: [-10, -20, 100, 80], viewBoxOf: () => [0, 0, 1000, 800] };
  const result = planVacuumFit('m', null, options);
  assert.ok(result);
  const matrix = fitMatrix(result.params);
  assert.deepEqual(applyAffine(matrix, 40, 20), [500, 400]);
  assert.ok(matrix[0] > 0 && matrix[4] > 0 && matrix[0] === matrix[4]);
  const saved = [2, 0, 100, 0, 2, 300];
  const reopen = planVacuumFit('m', { calibration: { floor: saved } }, options);
  assert.ok(fitMatrix(reopen.params).every((value, index) => value === saved[index]));
});

test('async preview belongs to the exact dialog, connection, user, source and map; failed load stays usable', async () => {
  const preview = { source: 'image.map', map_id: 'floor', revision: 'a'.repeat(64), bounds: frame.bounds,
    image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==' };
  const setup = () => {
    let resolve;
    const wait = new Promise(done => { resolve = done; });
    const dev = { id: 'm' }, dialog = { busy: false }, toasts = [];
    const host = { _markerDialog: dialog, hass: { ...context, callWS: () => wait }, _devices: [dev],
      _vacSource: () => 'image.map', _vacObservedMapId: () => 'floor', requestUpdate() {},
      _showToast: text => toasts.push(text), _t: text => text };
    return { runtime: { host }, resolve, dev, dialog, toasts };
  };
  for (const mutate of [
    h => { h._markerDialog = { busy: false }; },
    h => { h.hass = { ...h.hass, connection: {} }; },
    h => { h.hass = { ...h.hass, user: { id: 'other' } }; },
    h => { h._vacSource = () => 'image.other'; },
    h => { h._vacObservedMapId = () => 'other'; },
    h => { h._devices = []; },
  ]) {
    const s = setup(), pending = loadVacuumImageFit(s.runtime, s.dev, 'image.map', 'floor');
    assert.equal(s.dialog.busy, true);
    mutate(s.runtime.host); s.resolve(preview);
    assert.equal(await pending, null);
    if (s.runtime.host._markerDialog === s.dialog) assert.equal(s.dialog.busy, false);
  }
  const s = setup(), pending = loadVacuumImageFit(s.runtime, s.dev, 'image.map', 'floor');
  s.resolve(preview); const loaded = await pending; assert.deepEqual(loaded, preview);
  assert.equal(s.dialog.busy, false);
  s.runtime.host._vacFit = { markerId: 'm', source: 'image.map', mapId: 'floor', preview: loaded };
  assert.equal(vacuumImageFitCurrent(s.runtime), true);
  const originalHass = s.runtime.host.hass;
  s.runtime.host.hass = { ...originalHass, user: { id: 'other' } };
  assert.equal(vacuumImageFitCurrent(s.runtime), false);
  s.runtime.host.hass = originalHass;
  s.dev.space = 'another-floor';
  assert.equal(vacuumImageFitCurrent(s.runtime), false);
  delete s.dev.space;
  assert.equal(vacuumImageFitCurrent(s.runtime), true);
  s.runtime.host._vacObservedMapId = () => 'other';
  assert.equal(vacuumImageFitCurrent(s.runtime), false);
  const failed = setup();
  failed.runtime.host.hass.callWS = () => Promise.reject(Error('unavailable'));
  assert.equal(await loadVacuumImageFit(failed.runtime, failed.dev, 'image.map', 'floor'), null);
  assert.equal(failed.dialog.busy, false);
  assert.deepEqual(failed.toasts, ['vac.ecovacs_preview_error']);
});
