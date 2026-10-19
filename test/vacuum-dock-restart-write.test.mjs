import assert from 'node:assert/strict';
import test from 'node:test';
import { saveVacuumDockRestart, vacuumDockRestartPending } from '../test-build/vacuum-dock-restart-write.js';
import { ConfigWriteContext } from '../test-build/config-write-context.js';
import { selectVacuumTrail, vacuumTrailMaterial } from '../test-build/vacuum-trail-material.js';
import { installAdoption } from './helpers/adoption-host.mjs';
import { adoptCardConfigCapabilities, getAuthoritativeCardConfig } from '../test-build/version-recovery-card.js';
import { optimizePlans } from '../test-build/plan-optimizer.js';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

test('#940 capability requires an exact fresh response owned by the current HA', async () => {
  const host = { _haVacuumDockRestartApi: null, _syncVersionRecovery() {},
    hass: { callWS: async () => ({ vacuum_dock_restart_api: 1 }) } };
  await getAuthoritativeCardConfig(host, host.hass, () => false);
  assert.equal(host._haVacuumDockRestartApi, null);
  await getAuthoritativeCardConfig(host, host.hass, () => true);
  assert.equal(host._haVacuumDockRestartApi, 1);
  for (const raw of [{}, { vacuum_dock_restart_api: '1' }, { vacuum_dock_restart_api: 2 }]) {
    adoptCardConfigCapabilities(host, raw);
    assert.equal(host._haVacuumDockRestartApi, null);
  }
});

function fixture({ firstUse = false, send = async () => {} } = {}) {
  const config = { spaces: [{ id: 'floor', rooms: [] }], markers: firstUse ? [] : [{
    id: 'robot', binding: 'entity:vacuum.robot', space: 'floor', vacuum: {
      live: true, source: 'camera.map', trail_mode: 'always',
      map_routes: [{ id: 'r', source: 'camera.map', map_id: 'm', space: 'floor', future: { keep: true } }],
    } }] };
  const authority = new ConfigWriteContext();
  const sent = [], toasts = [];
  const host = { hass: { connection: {}, callWS() {}, user: { id: 'owner' } },
    _canEdit: true, _kiosk: false, _haVacuumDockRestartApi: 1, _writesPending: 0,
    _writeChain: Promise.resolve(), _regSignature: '',
    _devices: [{ id: 'robot', bindingKind: 'entity', bindingRef: 'vacuum.robot', space: 'floor' }],
    _isVacDev: device => device.bindingRef.startsWith('vacuum.'),
    _maybeRebuildDevices() {}, requestUpdate() {},
    _showToast: value => toasts.push(value), _t: (key, vars) => key + JSON.stringify(vars ?? {}),
    _errText: error => String(error?.message ?? error),
  };
  authority.observe(host.hass);
  host._configWriteGuard = pending => {
    const claim = authority.claim();
    return () => pending ? authority.owns(claim) : authority.current(claim, host.hass);
  };
  installAdoption(host, { config, configRev: 7 });
  host._sendConfigCandidate = async candidate => {
    const current = host._configWriteGuard();
    sent.push(structuredClone(candidate));
    await send(candidate);
    if (!current()) throw Object.assign(new Error('foreign context'), { code: 'context-changed' });
    host._adoption.acceptConfigWrite(candidate, { rev: host._cfgRev + 1 });
  };
  const runtime = { host, _prepareConfigCandidate: value => value };
  return { host, runtime, config, sent, toasts, authority };
}

test('#940 policy changes only after ACK, duplicate is blocked, unrelated newer edits survive', async () => {
  const gate = deferred();
  const f = fixture({ send: () => gate.promise });
  const before = structuredClone(f.config.markers[0].vacuum);
  const saved = saveVacuumDockRestart(f.runtime, 'robot', true);
  await Promise.resolve(); await Promise.resolve();
  assert.equal(f.host._serverCfg.markers[0].vacuum.new_run_after_dock, undefined);
  assert.equal(vacuumDockRestartPending(f.host, 'robot'), true);
  assert.equal(await saveVacuumDockRestart(f.runtime, 'robot', false), false);
  assert.equal(f.sent.length, 1);
  f.host._serverCfg.markers[0].name = 'newer local name';
  gate.resolve();
  assert.equal(await saved, true);
  assert.deepEqual(f.host._serverCfg.markers[0].vacuum, { ...before, new_run_after_dock: true });
  assert.equal(f.host._serverCfg.markers[0].name, 'newer local name');
  assert.equal(f.host._adoption.snapshot(null).config.markers[0].name, undefined, 'cache contains exact accepted payload, not an unsaved name');
  assert.equal(f.host._adoption.snapshot(null).config.markers[0].vacuum.new_run_after_dock, true);
  assert.equal(f.host._writesPending, 0);
  assert.equal(vacuumDockRestartPending(f.host, 'robot'), false);
  assert.equal(await saveVacuumDockRestart(f.runtime, 'robot', false), true);
  assert.equal(f.host._serverCfg.markers[0].vacuum.new_run_after_dock, false);
});

test('#940 first-use rejection leaves no synthetic marker or policy, ordinary error is shown', async () => {
  const f = fixture({ firstUse: true, send: async () => { throw new Error('denied by HA'); } });
  assert.equal(await saveVacuumDockRestart(f.runtime, 'robot', true), false);
  assert.deepEqual(f.host._serverCfg.markers, []);
  assert.equal(f.host._cfgRev, 7);
  assert.match(f.toasts[0], /toast.cfg_save_failed.*denied by HA/);
  assert.equal(f.host._writesPending, 0);
});

test('#940 first-use ACK materializes only the accepted marker and retains no read-default elsewhere', async () => {
  const f = fixture({ firstUse: true });
  assert.equal(await saveVacuumDockRestart(f.runtime, 'robot', true), true);
  assert.equal(f.host._serverCfg.markers[0].binding, 'entity:vacuum.robot');
  assert.deepEqual(f.host._serverCfg.markers[0].vacuum, { new_run_after_dock: true });
  assert.deepEqual(f.config.markers, []);
});

for (const [key, value] of [['_canEdit', false], ['_kiosk', true], ['_haVacuumDockRestartApi', null], ['_haVacuumDockRestartApi', '1']]) {
  test(`#940 unsupported/unauthorized ${key}=${value} sends nothing`, async () => {
    const f = fixture(); f.host[key] = value;
    assert.equal(await saveVacuumDockRestart(f.runtime, 'robot', true), false);
    assert.equal(f.sent.length, 0);
    assert.equal(f.host._serverCfg.markers[0].vacuum.new_run_after_dock, undefined);
  });
}

test('#940 binding replaced before dispatch or ACK cannot acquire an old-device policy', async () => {
  for (const afterDispatch of [false, true]) {
    const gate = deferred();
    const f = fixture({ send: () => gate.promise });
    const saved = saveVacuumDockRestart(f.runtime, 'robot', true);
    if (afterDispatch) { await Promise.resolve(); await Promise.resolve(); }
    f.host._devices[0].bindingRef = 'vacuum.other';
    f.host._serverCfg.markers[0].binding = 'entity:vacuum.other';
    gate.resolve();
    assert.equal(await saved, false);
    assert.equal(f.sent.length, afterDispatch ? 1 : 0);
    assert.equal(f.host._serverCfg.markers[0].vacuum.new_run_after_dock, undefined);
    assert.equal(f.toasts.length, 0);
  }
});

test('#940 foreign HA can start its own save while a late old response cannot retire its pending flag', async () => {
  const first = deferred(), second = deferred();
  let gate = first;
  const f = fixture({ send: () => gate.promise });
  const old = saveVacuumDockRestart(f.runtime, 'robot', true);
  await Promise.resolve(); await Promise.resolve();
  f.host.hass = { connection: {}, callWS() {}, user: { id: 'other' } };
  f.authority.observe(f.host.hass);
  f.host._adoption.resetContext();
  f.host._adoption.stageLocalConfig(structuredClone(f.config));
  f.host._writeChain = Promise.resolve(); f.host._writesPending = 0;
  gate = second;
  const next = saveVacuumDockRestart(f.runtime, 'robot', false);
  await Promise.resolve(); await Promise.resolve();
  first.resolve();
  assert.equal(await old, false);
  assert.equal(f.host._writesPending, 1);
  assert.equal(vacuumDockRestartPending(f.host, 'robot'), true);
  assert.equal(f.host._serverCfg.markers[0].vacuum.new_run_after_dock, undefined);
  second.resolve();
  assert.equal(await next, true);
  assert.equal(f.host._serverCfg.markers[0].vacuum.new_run_after_dock, false);
  assert.equal(f.host._writesPending, 0);
});

test('#940 empty native authority suppresses both stale integration attributes and local reserve', () => {
  const raw = { robot: { current: { path_format: 2, paths: [], points: [], revision: 'empty',
    quality: { source: 'native', reason: 'empty_integration', raw_points: 0 } } } };
  const owned = vacuumTrailMaterial(raw);
  const chosen = selectVacuumTrail({ path: [[900, 900], [999, 999]] }, owned.robot.current,
    [[[800, 800], [888, 888]]], 2);
  assert.deepEqual(chosen, { path: [], native: true, allowTip: false, source: 'native', reason: 'empty_integration' });
  assert.deepEqual(selectVacuumTrail(null, null, [], 2).path, []);
});

test('#940 Optimize preserves explicit values and never materializes absent dock policy', () => {
  for (const flag of [undefined, null, false, true]) {
    const f = fixture();
    if (flag !== undefined) f.host._serverCfg.markers[0].vacuum.new_run_after_dock = flag;
    const before = structuredClone(f.host._serverCfg);
    const optimized = optimizePlans(f.host._serverCfg, {}).config;
    assert.equal(Object.hasOwn(optimized.markers[0].vacuum, 'new_run_after_dock'), flag !== undefined);
    assert.equal(optimized.markers[0].vacuum.new_run_after_dock, flag);
    assert.deepEqual(f.host._serverCfg, before);
  }
});
