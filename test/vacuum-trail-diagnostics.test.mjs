import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseVacuumTrail, diagnoseVacuumTrails } from '../test-build/vacuum-trail-diagnostics.js';
import { collectSupportDiagnostics } from '../test-build/support-diagnostics.js';
import { VacuumPathGeometryCache } from '../test-build/vacuum-path-geometry.js';
import { currentVacuumTrailFrame } from '../test-build/vacuum-trail-material.js';
import { renderVacuumPathDiagnostics } from '../test-build/editors/vacuum-path-diagnostics.js';
import { t } from '../test-build/i18n.js';

const matrix = [1, 0, 0, 0, 1, 0];
const route = { id: 'route-b', source: 'camera.b', map_id: 'Map 1', space: 'home', calibration: matrix };
const points = Array.from({ length: 12 }, (_, i) => [i * 10, i % 2 ? 10 : 0]);
function fixture() {
  const device = { id: 'robot', space: 'home', marker: { vacuum: { source: 'camera.a', map_routes: [route] } } };
  const telemetry = { pos: { x: 110, y: 10 }, path: [] };
  const runtimeSource = { source: 'camera.b', telemetry, routes: [route], resolution: { kind: 'ready', route }, unavailable: false };
  const run = { path_format: 2, map_id: 'Map 1', route_id: 'route-b', paths: [points],
    quality: { source: 'positions', reason: 'sampled', raw_points: 12, stored_points: 12 }, final_status: 'unconfirmed' };
  const host = { _devices: [device], _vacSrvTrails: { robot: { current: run } },
    _vacTrailFormat: 2, _vacRt: new Map([['robot', { moving: true, material: [points] }]]),
    _vacGeometryCache: new VacuumPathGeometryCache(), _model: [{ id: 'home' }, { id: 'other' }],
    _space: 'home', _cellCm: 1, _gridPitch: 1, _isVacDev: () => true,
    _vacRuntimeSource: () => runtimeSource,
    // Original adapter for the regression witness before #918.
    _vacSource: () => 'camera.b', _vacObservedMapId: () => 'Map 1',
    hass: { states: { 'camera.b': { attributes: { robot_position: telemetry.pos, map_name: 'Map 1' } } } },
  };
  return { host, device, run, runtimeSource, diagnose: () => diagnoseVacuumTrail(host, device) };
}

test('#918 12/12/0 distinguishes run ownership from sampled quality and final confirmation', () => {
  const f = fixture();
  delete f.run.route_id;
  const info = f.diagnose();
  assert.deepEqual([info.raw, info.stored, info.rendered], [12, 12, 0]);
  assert.equal(info.reason, 'sampled');
  assert.equal(info.final, false);
  assert.equal(info.display, 'vac.trail_display_run');
});

test('#918 diagnostic reason priority covers display mode, source, floor, run and fragments', () => {
  const cases = [
    [(f) => { f.device.marker.vacuum.trail_mode = 'never'; f.runtimeSource.resolution = { kind: 'ambiguous', routeIds: [] }; }, 'vac.trail_display_mode'],
    [(f) => { f.host._vacRt.get('robot').moving = false; }, 'vac.trail_display_stopped'],
    [(f) => { f.device.hidden = true; }, 'vac.trail_display_mode'],
    [(f) => { f.device.marker.display = 'static_icon'; }, 'vac.trail_display_mode'],
    [(f) => { f.runtimeSource.resolution = { kind: 'ambiguous', routeIds: ['a', 'b'] }; }, 'vac.route_warn_ambiguous'],
    [(f) => { f.runtimeSource.resolution = { kind: 'needs_calibration', route }; }, 'vac.route_warn_needs_calibration'],
    [(f) => { f.runtimeSource.resolution = { kind: 'missing_space', route }; }, 'vac.route_warn_missing_space'],
    [(f) => { f.runtimeSource.resolution = { kind: 'none' }; f.runtimeSource.unavailable = true; }, 'vac.source_status_unavailable'],
    [(f) => { f.runtimeSource.resolution = { kind: 'unmapped', source: 'camera.b', mapId: '1' }; }, 'vac.trail_display_route'],
    [(f) => { f.host._space = 'other'; delete f.run.route_id; }, 'vac.trail_display_space'],
    [(f) => { f.run.paths = [[[1, 1]], [[2, 2]], [[3, 3]]]; }, 'vac.trail_display_points'],
    [(f) => { f.run.paths = [[[1, 1], [1, 1], [1, 1]]]; }, 'vac.trail_display_points'],
  ];
  for (const [change, expected] of cases) {
    const f = fixture(); change(f);
    const info = f.diagnose();
    assert.equal(info.display, expected);
    assert.equal(info.rendered, 0, expected);
    assert.deepEqual([info.raw, info.stored], [12, 12], 'display guards do not rewrite recording counts');
  }
});

test('#918 valid sampled final=false and native without position have drawable current frames', () => {
  for (const native of [false, true]) {
    const f = fixture();
    if (native) { f.run.quality.source = 'native'; f.run.quality.reason = 'ok'; f.runtimeSource.telemetry = null; }
    const info = f.diagnose();
    assert.equal(info.display, 'vac.trail_display_visible');
    assert.ok(info.rendered > 0);
    assert.equal(info.final, false);
  }
});

test('#1048 retained native is distinguished from current data without changing its counters', () => {
  const f = fixture();
  Object.assign(f.run.quality, { source: 'native', reason: 'ok' });
  f.run.received_at = 100;
  const current = f.diagnose();
  assert.equal(current.display, 'vac.trail_display_visible');
  for (const reason of ['stale', 'coordinates_unverified', 'unsupported', 'run_unverified']) {
    f.run.quality.reason = reason;
    const info = f.diagnose();
    assert.equal(info.display, 'vac.trail_display_retained');
    assert.equal(info.reason, reason);
    assert.equal(info.receivedAt, 100);
    assert.deepEqual([info.raw, info.stored, info.rendered], [current.raw, current.stored, current.rendered]);
    for (const lang of ['en', 'ru', 'de', 'fr']) {
      const template = renderVacuumPathDiagnostics({ _t: (key) => t(lang, key),
        _vacTrailDiagnostics: () => info }, f.device);
      assert.ok(template.values.join(' ').includes(t(lang, 'vac.trail_display_retained')));
      assert.doesNotMatch(template.values.join(' '), /vac\./);
    }
  }
  f.run.quality.reason = 'limited';
  assert.notEqual(f.diagnose().display, 'vac.trail_display_retained');
  f.run.quality.reason = 'ok';
  f.run.received_at = 200;
  assert.equal(f.diagnose().display, 'vac.trail_display_visible');
  assert.equal(f.diagnose().receivedAt, 200);
});

test('#918 diagnostics count the actual shared current frame, including trim and roster quota', () => {
  const f = fixture();
  const args = { telemetry: f.runtimeSource.telemetry, server: f.run, local: [], serverFormat: 2,
    moving: true, matrix, cache: f.host._vacGeometryCache, cmPerUnit: 1, budget: 20000 };
  const frame = currentVacuumTrailFrame(args);
  assert.equal(f.diagnose().rendered, frame.frame.count);
  assert.equal(frame.path[0].at(-1)[0], 100, 'moving target is kept out of the static line');
  assert.ok(frame.frame.d.startsWith('M 0 0 '));
  const first = { ...f.device, id: 'first' };
  const dense = Array.from({ length: 20000 }, (_, i) => [i, i % 2 * 100]);
  f.host._devices.unshift(first);
  f.host._vacSrvTrails.first = { current: { ...f.run, paths: [dense], quality: { source: 'native' } } };
  f.host._vacRt.set('first', { moving: true });
  const exhausted = f.diagnose();
  assert.equal(exhausted.rendered, 0);
  assert.equal(exhausted.reason, 'limited');
  assert.equal(exhausted.display, 'vac.path_limited');
});

test('#918 the real diagnostic template renders the display reason in Russian and English', () => {
  const f = fixture(); delete f.run.route_id;
  for (const lang of ['ru', 'en']) {
    const result = renderVacuumPathDiagnostics({ _t: (key) => t(lang, key), _vacTrailDiagnostics: f.diagnose }, f.device);
    const text = result.values.join(' ');
    assert.ok(text.includes(t(lang, 'vac.diag_trail_display')));
    assert.ok(text.includes(t(lang, 'vac.trail_display_run')));
    assert.ok(text.includes(t(lang, 'vac.path_sampled')));
    assert.doesNotMatch(text, /vac\./);
  }
});

test('#942 batch diagnostics keep #918 counters/display priority and resolve each robot once', () => {
  const f = fixture();
  const expected = f.diagnose();
  let calls = 0;
  f.host._vacRuntimeSource = () => { calls++; return f.runtimeSource; };
  assert.deepEqual(diagnoseVacuumTrails(f.host).get('robot'), expected);
  assert.equal(calls, 1);
  f.host._vacRt.get('robot').moving = false;
  const stopped = diagnoseVacuumTrails(f.host).get('robot');
  assert.equal(stopped.display, 'vac.trail_display_stopped');
  assert.deepEqual([stopped.raw, stopped.stored, stopped.rendered], [12, 12, 0]);
});

test('#942 collector separates unavailable picker A from the #918 rendered route source B', () => {
  const f = fixture();
  Object.assign(f.device, { entities: ['vacuum.robot'], primary: 'vacuum.robot', area: null });
  Object.assign(f.runtimeSource.telemetry, { rooms: [], mapId: 'Map 1' });
  const facts = new Map([['vacuum:robot', { ...f.runtimeSource,
    runtime: { moving: true, trail: [points] }, server: f.host._vacSrvTrails.robot }]]);
  Object.assign(f.host, {
    _renderDeviceSnapshot: { devices: [f.device], hass: f.host.hass, presentations: new Map(), facts,
      geometry: 1, capturedAt: Date.now() },
    _vacSourceResolution: () => ({ entityId: 'camera.a', status: 'unavailable', candidates: [] }),
    _serverCfg: { spaces: [] }, _settings: {}, _cfgEpoch: 1, _loadOk: false,
    _cfgRev: 7, _layoutRev: 9, _mode: 'view', _effectiveProjection: () => 'flat',
    _writesPending: 0, _saveConfigDebounced: { pending: () => false }, _dirtyPos: new Set(), _sentPos: new Map(),
    _virtualLights: { rev: 0, configRev: 7, off: new Set() },
  });
  // A newer event is pending, but the accepted frame still shows B's run.
  f.host._vacSrvTrails = { robot: { current: { ...f.run, route_id: 'new-foreign-route' } } };
  f.host._vacRt = new Map([['robot', { moving: false, material: [] }]]);
  f.host._vacRuntimeSource = () => { throw new Error('collector re-resolved a newer source'); };
  const info = collectSupportDiagnostics(f.host).vacuums[0];
  assert.equal(info.source, 'camera.a');
  assert.equal(info.source_status, 'unavailable');
  assert.equal(info.effective_source, 'camera.b');
  assert.ok(info.rendered > 0);
  assert.deepEqual(info.reasons, ['drawable'], 'unavailable discovery/root is not a false render blocker');
});
