import assert from 'node:assert/strict';
import test from 'node:test';
import { completeSpaceDeletion } from '../test-build/editors/space-delete.js';
import { collectSpaceMarkerDependencies } from '../test-build/space-deletion.js';

function harness(markers = []) {
  const calls = [];
  const events = [];
  const nextConfig = { spaces: [{ id: 'f2', rooms: [] }], markers: [] };
  const configResponse = { config: nextConfig, rev: 8 };
  const layoutResponse = { layout: {}, rev: 10 };
  const host = {
    _spaceDialog: { mode: 'edit', spaceId: 'f1', busy: false, deleteBlockers: markers.length },
    _serverCfg: { spaces: [{ id: 'f1', rooms: [] }, { id: 'f2', rooms: [] }], markers },
    _layout: {}, _cfgRev: 7, _layoutRev: 9, _space: 'f1', _regSignature: 'old',
    _saveConfigDebounced: { pending: () => false, flush: () => events.push('flush-config') },
    _persistLayout: { pending: () => false, flush: () => events.push('flush-layout') },
    _writeChain: Promise.resolve(),
    updateComplete: Promise.resolve(),
    renderRoot: { querySelector: () => ({
      scrollIntoView: (options) => events.push(['scroll', options]),
      focus: (options) => events.push(['focus', options]),
    }) },
    hass: { callWS: async (message) => {
      calls.push(message);
      if (message.type === 'houseplan/space/delete') return { config_rev: 800, layout_rev: 900 };
      assert.equal(message.type, 'houseplan/layout/get');
      return layoutResponse;
    } },
    _getAuthoritativeConfig: async () => configResponse,
    _adoptAuthoritative: async (options) => {
      events.push(['adopt', options]);
      host._serverCfg = options.cfgResp.config;
      host._layout = options.layResp.layout;
      host._cfgRev = options.cfgResp.rev;
      host._layoutRev = options.layResp.rev;
      return { status: 'adopted' };
    },
    _commitSpace: (id) => { events.push(['space', id]); host._space = id; },
    _maybeRebuildDevices: () => events.push('rebuild'),
    requestUpdate: () => events.push('render'),
    _reloadConfigOnly: async (force) => events.push(['reload-config', force]),
    _reloadLayoutOnly: async () => events.push('reload-layout'),
    _showToast: (text) => events.push(['toast', text]),
    _t: (key) => key,
    _errText: (error) => error.code || error.message,
  };
  const dependencies = collectSpaceMarkerDependencies(host._serverCfg, host._layout, 'f1');
  return { host, calls, events, dependencies, configResponse, layoutResponse };
}

test('#819 shared completion keeps ordinary delete and authoritative post-write adoption', async () => {
  const { host, calls, events, dependencies, configResponse, layoutResponse } = harness();
  await completeSpaceDeletion(host, 'f1', dependencies);
  assert.deepEqual(calls, [
    { type: 'houseplan/space/delete', space_id: 'f1', expected_config_rev: 7, expected_layout_rev: 9 },
    { type: 'houseplan/layout/get' },
  ]);
  assert.deepEqual(events[0], ['adopt', {
    cfgResp: configResponse, layResp: layoutResponse, reason: 'space-delete', profile: 'post-write',
  }]);
  assert.equal(host._spaceDialog, null);
  assert.equal(host._space, 'f2');
  assert.equal(host._regSignature, '');
  assert.equal(host._cfgRev, 8, 'never adopt the delete reply revision');
  assert.equal(host._layoutRev, 10);
  assert.deepEqual(events.slice(1), [['space', 'f2'], 'rebuild', ['toast', 'toast.space_deleted']]);
});

test('#819 shared completion sends bulk flag only for the confirmed marker set', async () => {
  const { host, calls, dependencies } = harness([{ id: 'hidden', space: 'f1', hidden: true }]);
  await completeSpaceDeletion(host, 'f1', dependencies, true);
  assert.equal(calls.filter((call) => call.type === 'houseplan/space/delete').length, 1);
  assert.equal(calls[0].remove_markers, true);
  assert.equal(host._spaceDialog, null);
});

test('#819 shared completion refuses a changed marker set and reveals its current count', async () => {
  const { host, calls, events, dependencies } = harness([{ id: 'before', space: 'f1' }]);
  host._serverCfg.markers.push({ id: 'new', space: 'f1' });
  const before = structuredClone(host._serverCfg);
  await completeSpaceDeletion(host, 'f1', dependencies, true);
  assert.deepEqual(calls, []);
  assert.deepEqual(host._serverCfg, before);
  assert.equal(host._spaceDialog.deleteBlockers, 2);
  assert.equal(host._spaceDialog.busy, false);
  assert.deepEqual(events, [['scroll', { block: 'nearest' }], ['focus', { preventScroll: true }]]);
});

test('#819 shared ordinary delete still blocks active devices but not the last space', async () => {
  const blocked = harness([{ id: 'active', space: 'f1' }]);
  await completeSpaceDeletion(blocked.host, 'f1', blocked.dependencies);
  assert.deepEqual(blocked.calls, []);
  assert.equal(blocked.host._spaceDialog.deleteBlockers, 1);
  const last = harness([{ id: 'active', space: 'f1' }]);
  last.host._serverCfg.spaces.pop();
  await completeSpaceDeletion(last.host, 'f1', last.dependencies);
  assert.equal(last.calls[0].type, 'houseplan/space/delete');
  assert.equal('remove_markers' in last.calls[0], false, 'ordinary last-space deletion stays unchanged');
});

for (const [name, change] of [
  ['closed dialog', (host) => { host._spaceDialog = null; }],
  ['replacement dialog', (host) => { host._spaceDialog.spaceId = 'f2'; }],
  ['busy dialog', (host) => { host._spaceDialog.busy = true; }],
  ['create dialog', (host) => { host._spaceDialog.mode = 'create'; }],
  ['missing config', (host) => { host._serverCfg = null; }],
  ['deleted target', (host) => { host._serverCfg.spaces.shift(); }],
]) {
  test(`#819 shared completion refuses ${name}`, async () => {
    const { host, calls, events, dependencies } = harness();
    change(host);
    await completeSpaceDeletion(host, 'f1', dependencies);
    assert.deepEqual(calls, []);
    assert.deepEqual(events, []);
  });
}

test('#819 shared completion flushes and awaits pending writes before taking revisions', async () => {
  const { host, calls, events, dependencies } = harness();
  let release;
  host._writeChain = new Promise((resolve) => { release = resolve; });
  host._saveConfigDebounced.pending = () => true;
  host._persistLayout.pending = () => true;
  const deletion = completeSpaceDeletion(host, 'f1', dependencies);
  assert.deepEqual(events, ['flush-config', 'flush-layout']);
  assert.deepEqual(calls, []);
  host._cfgRev = 11;
  host._layoutRev = 12;
  release();
  await deletion;
  assert.equal(calls[0].expected_config_rev, 11);
  assert.equal(calls[0].expected_layout_rev, 12);
});

test('#819 shared completion leaves asset-wait recovery to the scheduled reload', async () => {
  const { host, calls, events, dependencies } = harness();
  host._adoptAuthoritative = async () => ({ status: 'asset-wait' });
  await completeSpaceDeletion(host, 'f1', dependencies);
  assert.equal(calls[0].type, 'houseplan/space/delete');
  assert.equal(host._spaceDialog.busy, false);
  assert.equal(host._space, 'f1');
  assert.equal(host._regSignature, 'old');
  assert.deepEqual(events, ['render']);
});

for (const code of ['conflict', 'space_in_use', 'invalid_format']) {
  test(`#819 shared completion recovers from ${code} without local deletion`, async () => {
    const { host, calls, events, dependencies } = harness([{ id: 'active', space: 'f1' }]);
    const before = structuredClone(host._serverCfg);
    host.hass.callWS = async (message) => { calls.push(message); throw { code }; };
    await completeSpaceDeletion(host, 'f1', dependencies, true);
    assert.equal(calls.length, 1);
    assert.deepEqual(host._serverCfg, before);
    assert.equal(host._spaceDialog.busy, false);
    assert.equal(host._spaceDialog.deleteBlockers, 1);
    assert.equal(host._space, 'f1');
    assert.equal(host._regSignature, 'old');
    assert.deepEqual(events.slice(0, code === 'invalid_format' ? 0 : 2),
      code === 'invalid_format' ? [] : [['reload-config', true], 'reload-layout']);
    assert.ok(events.some((event) => Array.isArray(event) && event[0] === 'focus'));
    assert.deepEqual(events.find((event) => Array.isArray(event) && event[0] === 'toast'),
      ['toast', 'toast.delete_failed']);
    assert.equal(events.includes('rebuild'), false);
  });
}
