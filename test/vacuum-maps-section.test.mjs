// #842 К4: the «Maps and floors» route write (src/editors/vacuum-maps-section.ts)
// cancels a pending deferred config write whose content its candidate carries.
// A rolled-back rejection re-arms it once; success, an idle timer or a lost
// rollback arm nothing. The handler is the one the delete button binds.
import test from 'node:test';
import assert from 'node:assert/strict';

import { renderVacuumMapsSection } from '../test-build/editors/vacuum-maps-section.js';
import { installAdoption } from './helpers/adoption-host.mjs';

const accepted = () => ({
  spaces: [{ id: 'ground', title: 'Ground', rooms: [] }],
  markers: [{
    id: 'vac', binding: 'entity:vacuum.demo', space: 'ground',
    vacuum: { map_routes: [{ id: 'upstairs', source: 'camera.map', map_id: 'up', space: 'ground' }] },
  }],
  settings: {},
});

function fixture({ pending = true, save = async () => {}, rollback = true } = {}) {
  const toasts = [];
  const deferredWrite = Object.assign(() => { deferredWrite.armed = true; deferredWrite.arms += 1; }, {
    armed: pending, arms: 0,
    pending: () => deferredWrite.armed,
    cancel: () => { deferredWrite.armed = false; },
  });
  const host = {
    hass: { states: {} }, _config: { language: 'en' },
    _saveConfigDebounced: deferredWrite,
    _regSignature: '',
    _t: (key) => key,
    _errText: (error) => String(error?.message || error),
    _maybeRebuildDevices() {},
    _showToast: (message) => toasts.push(message),
    _vacSource: () => 'camera.map',
    _vacObservedMapId: () => 'up',
    _confirmDanger: async () => true,
    requestUpdate() {},
  };
  installAdoption(host, { config: accepted(), configRev: 3 });
  if (!rollback) {
    const adoption = host._adoption;
    adoption.rollbackOptimistic = () => false;
  }
  const runtime = { host, _saveConfigNow: save, _vacAutoCalibrate() {}, _vacStartFit() {} };
  const dev = { id: 'vac', bindingKind: 'entity', bindingRef: 'vacuum.demo', space: 'ground',
    marker: host._serverCfg.markers[0] };
  return { host, runtime, dev, toasts, deferredWrite };
}

/** The `@click` bound to the route's delete button in the rendered template. */
function deleteHandler(result) {
  const stack = [result];
  while (stack.length) {
    const node = stack.pop();
    if (Array.isArray(node)) { stack.push(...node); continue; }
    if (!node || typeof node !== 'object' || !Array.isArray(node.strings)) continue;
    const index = node.strings.findIndex((part) => part.includes('ghostbtn danger') && part.trimEnd().endsWith('@click='));
    if (index >= 0) return node.values[index];
    stack.push(...node.values);
  }
  throw new Error('route delete button not rendered');
}

async function deleteRoute(f) {
  const section = renderVacuumMapsSection(f.runtime, f.dev, { entityId: 'camera.map', status: 'ok', pinned: false, candidates: [] });
  deleteHandler(section)();
  for (let index = 0; index < 20; index++) await Promise.resolve();
}

test('#842 AC4 vacuum maps: a rejected route write rolls back and re-arms the pending edit once', async () => {
  const f = fixture({ save: async () => { throw new Error('offline'); } });
  await deleteRoute(f);
  assert.deepEqual(f.host._serverCfg, accepted(), 'the accepted routes are back');
  assert.equal(f.deferredWrite.armed, true);
  assert.equal(f.deferredWrite.arms, 1);
  assert.match(f.toasts.at(-1), /^toast\.cfg_save_failed/);
});

test('#842 AC4 vacuum maps: success, nothing pending or no rollback arm nothing', async () => {
  const saved = fixture();
  await deleteRoute(saved);
  assert.deepEqual(saved.host._serverCfg.markers[0].vacuum.map_routes, []);
  assert.equal(saved.deferredWrite.armed, false, 'the accepted write carried the pending edit');
  assert.equal(saved.deferredWrite.arms, 0);
  const idle = fixture({ pending: false, save: async () => { throw new Error('offline'); } });
  await deleteRoute(idle);
  assert.equal(idle.deferredWrite.arms, 0);
  const replaced = fixture({ rollback: false, save: async () => { throw new Error('conflict'); } });
  await deleteRoute(replaced);
  assert.equal(replaced.deferredWrite.arms, 0);
});

test('#842 К2 vacuum maps: a refusal to delete plan objects rolls back without a save-failed toast', async () => {
  const f = fixture({ save: async () => {
    throw Object.assign(new Error('saving would delete plan objects'), { code: 'geometry-cleanup-required' });
  } });
  await deleteRoute(f);
  assert.deepEqual(f.host._serverCfg, accepted());
  assert.deepEqual(f.toasts, []);
});
