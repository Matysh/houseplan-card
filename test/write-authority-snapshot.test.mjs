import test from 'node:test';
import assert from 'node:assert/strict';
import { ConfigWriteContext, captureWriteAuthority } from '../test-build/config-write-context.js';
import { sendHouseplanWrite, WS_DIRECT_LIMIT_BYTES } from '../test-build/large-write-transport.js';
import { projectGraphSpace } from '../test-build/plan-graph.js';
import { commitPlanOptimization } from '../test-build/plan-optimize-write.js';
import { nodeWriteBasis, writeWallNode } from '../test-build/wall-node-write.js';
import { persistContactPlacements } from '../test-build/device-contact-write.js';
import { LayoutWriteReload } from '../test-build/layout-write-reload.js';

globalThis.window ??= {};
window.setTimeout = setTimeout;
globalThis.location ??= { pathname: '/dashboard/home' };
const { HouseplanCard } = await import('../test-build/houseplan-card.js');
const clone = structuredClone;
const graph = () => ({ version: 1, nodes: [], edges: [], rooms: [], dependencies: [] });
const floor = id => projectGraphSpace({ id, title: id, cell_cm: 5, view_box: [0, 0, 1, 1], rooms: [] }, graph()).space;
const config = () => ({ model_version: 11, spaces: [floor('base')], markers: [], settings: {} });

function owner() {
  const context = new ConfigWriteContext();
  const host = { hass: { connection: {}, user: { id: 'owner' }, states: {}, async callWS() {} },
    _configWriteGuard() { const claim = context.claim(); return () => context.current(claim, host.hass); } };
  context.observe(host.hass);
  const replace = (mode = 'snapshot') => {
    const original = host.hass;
    host.hass = { ...original, states: { tick: { state: 'new' } },
      ...(mode === 'connection' || mode === 'aba' ? { connection: {} } : {}),
      ...(mode === 'user' ? { user: { id: 'other' } } : {}) };
    context.observe(host.hass);
    if (mode === 'aba') { host.hass = original; context.observe(original); }
  };
  return { host, context, replace };
}

test('#1220 snapshot replacement keeps authority, but connection/user/A→B→A retire it', () => {
  for (const mode of ['snapshot', 'connection', 'user', 'aba']) {
    const o = owner(), current = captureWriteAuthority(o.host);
    o.replace(mode);
    assert.equal(current(), mode === 'snapshot', mode);
  }
  const o = owner(), original = o.host.hass, current = captureWriteAuthority(o.host);
  o.host.hass = null; o.context.observe(null);
  assert.equal(current(), false, 'a disconnected host cannot dispatch');
  o.host.hass = original; o.context.observe(original);
  assert.equal(current(), true, 'temporary absence does not invent a foreign generation');
});

test('#1220 standalone ports fence connection/user without treating a new snapshot as authority', () => {
  const o = owner(); delete o.host._configWriteGuard;
  const current = captureWriteAuthority(o.host);
  o.replace(); assert.equal(current(), true);
  o.replace('user'); assert.equal(current(), false);
  const port = { hass: { async callWS() {} } }, fallback = captureWriteAuthority(port);
  port.hass = { ...port.hass }; assert.equal(fallback(), true);
  port.hass = { async callWS() {} }; assert.equal(fallback(), false);
});

for (const action of ['create-space', 'draw-wall']) for (const mode of ['snapshot', 'connection', 'user', 'aba']) {
  test(`#1220 real config writer: ${action}, ${mode} during accepted ACK`, async () => {
    const o = owner(), base = config(), candidate = clone(base);
    if (action === 'create-space') candidate.spaces.push(floor('new-space'));
    else candidate.spaces[0] = projectGraphSpace(candidate.spaces[0], { ...graph(),
      nodes: [{ id: 'a', p: ['l', '24', '24'] }, { id: 'b', p: ['l', '48', '24'] }],
      edges: [{ kind: 'partition', id: 'new-wall', from: 'a', to: 'b', cm: 15 }] }).space;
    let writes = 0, accepted = 0, saved;
    Object.assign(o.host, { _haPlanGraphApi: 1, _haGraphChangeApi: 2, _loadOk: true, _cfgRev: 1,
      _adoption: { snapshot: () => ({ config: base }), acceptConfigWrite(c, reply) { accepted++; o.host._cfgRev = reply.rev; } },
      _cacheSnapshot() {} });
    o.host.hass.callWS = async message => {
      writes++; saved = clone(message.config); o.replace(mode);
      return { ok: true, rev: 2, config: clone(saved) };
    };
    const pending = HouseplanCard.prototype._sendConfigCandidate.call(o.host, candidate);
    if (mode === 'snapshot') { await pending; assert.equal(accepted, 1); assert.equal(o.host._cfgRev, 2); }
    else { await assert.rejects(pending, { code: 'context-changed' }); assert.equal(accepted, 0); }
    assert.equal(writes, 1); assert.deepEqual(saved, candidate);
  });
}

test('#1220 all direct writer purposes accept ordinary snapshot updates', async () => {
  for (const type of ['houseplan/config/set', 'houseplan/plan/optimize', 'houseplan/plan/optimize_undo',
    'houseplan/wall/node_move', 'houseplan/wall/node_delete', 'houseplan/marker/copy',
    'houseplan/marker/history', 'houseplan/layout/set', 'houseplan/layout/update']) {
    const o = owner(); let writes = 0;
    o.host.hass.callWS = async () => { writes++; o.replace(); return { ok: true, rev: 2 }; };
    const response = await sendHouseplanWrite(o.host.hass, { type }, { isCurrent: captureWriteAuthority(o.host) });
    assert.equal(response.rev, 2); assert.equal(writes, 1, type);
  }
});

for (const mode of ['snapshot', 'connection', 'aba']) test(`#1220 upload fences ${mode} before commit`, async () => {
  const o = owner(); let uploaded = 0, writes = 0;
  o.host.hass.callWS = async () => { writes++; o.replace(); return { rev: 2 }; };
  o.host.hass.fetchWithAuth = async () => {
    uploaded++; o.replace(mode);
    return { ok: true, status: 200, async json() {
      o.replace(); return { token: 'owned-token', sha256: 'a'.repeat(64), purpose: 'houseplan/config/set',
        expires_at: new Date(Date.now() + 120000).toISOString() };
    } };
  };
  const pending = sendHouseplanWrite(o.host.hass, { type: 'houseplan/config/set', padding: 'x'.repeat(WS_DIRECT_LIMIT_BYTES) },
    { isCurrent: captureWriteAuthority(o.host) });
  if (mode === 'snapshot') { await pending; assert.equal(writes, 1); }
  else { await assert.rejects(pending, { code: 'context-changed' }); assert.equal(writes, 0); }
  assert.equal(uploaded, 1);
});

test('#1220 Optimize/space-copy pair writer accepts an own ACK after snapshot replacement', async () => {
  const o = owner(), cfg = config(); let accepted = 0;
  Object.assign(o.host, { _writeChain: Promise.resolve(), _saveConfigDebounced: { pending: () => false },
    _cfgRev: 1, _layoutRev: 1, _adoption: { snapshot: () => ({ config: cfg }), acceptPairWrite() { accepted++; } },
    _geometryHistory: { clear() {} }, _devicePositionHistory: { clear() {} }, _cancelDeviceDrag() {},
    _dirtyPos: new Set(), _sentPos: new Map(), _cfgEpoch: 0,
    _maybeRebuildDevices() {}, _cacheSnapshot() {}, requestUpdate() {} });
  o.host.hass.callWS = async () => { o.replace(); return { rev: 2, layout_rev: 2 }; };
  await commitPlanOptimization(o.host, cfg, {});
  assert.equal(accepted, 1);
});

test('#1220 node move/delete writer accepts its own late ACK without snapshot identity', async () => {
  for (const kind of ['move', 'delete']) {
    const o = owner(); let accepted = 0;
    Object.assign(o.host, { _serverCfg: config(), _cfgRev: 1, _cfgEpoch: 0, _writeChain: Promise.resolve(),
      _saveConfigDebounced: { pending: () => false }, _adoption: { adoptionEpoch: 0,
        stageConfigCandidate() {}, acceptConfigWrite() { accepted++; } },
      _cacheSnapshot() {}, async _reloadRejectedPhysicalWrite() {}, requestUpdate() {} });
    o.host.hass.callWS = async () => { o.replace(); return { rev: 2, config: clone(o.host._serverCfg) }; };
    await writeWallNode(o.host, { kind, direction: 'apply', beforeSpace: o.host._serverCfg.spaces[0], intent: {} }, nodeWriteBasis(o.host, 'base'));
    assert.equal(accepted, 1, kind);
  }
});

test('#1220 ordinary and grouped layout writers preserve accepted positions across state updates', async () => {
  for (const group of [false, true]) {
    const o = owner(), accepted = {}, pos = { s: 'base', x: .2, y: .3 };
    Object.assign(o.host, { _serverStorage: true, _loadOk: true, _layout: {}, _layoutRev: 1, _cfgRev: 1,
      _sentPos: new Map(), _layoutIO: new LayoutWriteReload(() => o.host._configWriteGuard()),
      _adoption: { snapshot: () => ({ layout: {} }), stageLocalLayout(l) { o.host._layout = l; },
        acceptLayoutPosition(id, p) { accepted[id] = p; }, refreshLayoutFingerprint() {} },
      _cacheSnapshot() {}, requestUpdate() {} });
    o.host.hass.callWS = async message => {
      if (message.type === 'houseplan/layout/get') return { layout: {}, rev: 1 };
      o.replace(); return { rev: 2 };
    };
    if (group) await persistContactPlacements(o.host, { deviceId: 'd', spaceId: 'base', placement: pos });
    else await HouseplanCard.prototype._persistDevicePlacement.call(o.host, 'd', pos);
    assert.deepEqual(accepted.d, pos); assert.equal(o.host._sentPos.size, 0);
  }
});
