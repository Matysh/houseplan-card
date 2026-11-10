// Critical persistence/authority witnesses for #1170, inherited by S6 taxonomy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { optimizeReceipt, optimizeFailure, optimizeFailureDiagnostics, OptimizeWriteFailure } from '../test-build/optimize-feedback.js';
import { commitPlanOptimization } from '../test-build/plan-optimize-write.js';
import { reloadOptimizePair } from '../test-build/optimize-reload.js';
import { LayoutWriteReload } from '../test-build/layout-write-reload.js';
import { sendHouseplanWrite, WS_DIRECT_LIMIT_BYTES } from '../test-build/large-write-transport.js';

const config = () => ({ spaces: [{ id: 'floor', title: 'Floor', rooms: [{ id: 'room', name: 'Kitchen', poly: [] }] }], markers: [], settings: {} });
const source = () => ({ configRev: 1, layoutRev: 2, configFingerprint: 'config', layoutFingerprint: 'layout', ownersFingerprint: 'owners', connection: null });
const response = () => ({ ok: true, config_rev: 2, layout_rev: 3, can_undo: true, config: config(), layout: {} });

test('#1170 metadata ACK is explicit; incomplete responses never guess revisions or missing halves', () => {
  const cfg = config();
  const full = optimizeReceipt(response(), cfg, {}, 1, 2);
  assert.equal(full.canonical, true);
  for (const field of ['ok', 'config_rev', 'layout_rev', 'can_undo']) {
    const ack = response(); delete ack[field];
    assert.throws(() => optimizeReceipt(ack, cfg, {}, 1, 2), { code: 'optimize_ack_unconfirmed' });
  }
  for (const patch of [{ config_rev: NaN }, { layout_rev: -1 }, { config_rev: .5 },
    { layout_rev: 1 }, { config_rev: 1 }, { layout_rev: 2 }, { can_undo: 'true' },
    { config: null }, { layout: [] }, { config: { spaces: 'invalid' } }])
    assert.throws(() => optimizeReceipt({ ...response(), ...patch }, cfg, {}, 1, 2), { code: 'optimize_ack_unconfirmed' });
  const legacy = response(); delete legacy.config; delete legacy.layout;
  const receipt = optimizeReceipt(legacy, cfg, {}, 1, 2);
  assert.equal(receipt.canonical, false, 'metadata proves saving, not canonical content');
  assert.equal(receipt.config, cfg);
  const half = { ...legacy, config: cfg };
  assert.throws(() => optimizeReceipt(half, cfg, {}, 1, 2), { code: 'optimize_ack_unconfirmed' });
});

test('#1170 dispatch evidence, not the code alone, distinguishes rejection from an unknown save', () => {
  for (const code of ['optimize_preview_changed', 'context-changed']) {
    assert.equal(optimizeFailure(new OptimizeWriteFailure({ code }, 'before-dispatch'), config(), 'before-dispatch').kind, 'changed');
    assert.equal(optimizeFailure(new OptimizeWriteFailure({ code }, 'dispatched'), config(), 'dispatched').kind, 'unknown');
  }
  assert.equal(optimizeFailure(new OptimizeWriteFailure({ code: 'conflict' }, 'dispatched'), config(), 'dispatched').kind, 'changed');
  assert.equal(optimizeFailure(new OptimizeWriteFailure({ code: 'invalid_format' }, 'dispatched'), config(), 'dispatched').kind, 'prepare', 'explicit server validation rejection is not an unknown save');
  assert.equal(optimizeFailure(new OptimizeWriteFailure({ code: 'commit_failed', message: 'previous plan restored' }, 'dispatched'), config(), 'dispatched').kind, 'unknown');
});

test('#1170 failure localization is a unique source match, never a raw exception message', () => {
  const cfg = config();
  const error = Object.assign(new Error('SECRET coordinates and token'), { name: 'PlanGraphError', code: 'third-owner', subject: 'room' });
  const failure = optimizeFailure(error, cfg, 'checking');
  assert.equal(failure.spaceName, 'Floor'); assert.equal(failure.roomName, 'Kitchen');
  const diagnostic = JSON.stringify(optimizeFailureDiagnostics(failure, source(), { card: '1.0', integration: '1.0' }));
  assert.match(diagnostic, /third-owner/); assert.doesNotMatch(diagnostic, /SECRET|Kitchen|coordinates|token/);
  cfg.spaces.push({ ...cfg.spaces[0], id: 'other' });
  assert.equal(optimizeFailure(error, cfg, 'checking').spaceId, undefined, 'ambiguous IDs cannot name a floor');
  error.subject = 'unknown-private-string';
  assert.equal(optimizeFailure(error, cfg, 'checking').subject, undefined);
  error.code = 'unknown-private-code';
  assert.equal(optimizeFailure(error, cfg, 'checking').code, 'unknown');
});

function writer(reply = async () => response()) {
  const calls = { writes: 0, adopts: 0, clears: 0 };
  let authority = true;
  const cfg = config();
  const host = {
    _cfgRev: 1, _layoutRev: 2, _haPlanGraphApi: 1,
    _writeChain: Promise.resolve(), _saveConfigDebounced: { pending: () => false, flush() {} },
    _configWriteGuard: () => () => authority,
    hass: { connection: {}, callWS: async message => { calls.writes++; return reply(message); } },
    _adoption: { snapshot: () => ({ config: cfg }), acceptPairWrite() { calls.adopts++; } },
    _geometryHistory: { clear() { calls.clears++; } }, _devicePositionHistory: { clear() {} },
    _cancelDeviceDrag() {}, _dirtyPos: new Set(), _sentPos: new Map(), _cfgEpoch: 0,
    _maybeRebuildDevices() {}, _cacheSnapshot() {}, requestUpdate() {},
  };
  return { host, calls, cfg, retire: () => { authority = false; } };
}

test('#1170 writer refuses incomplete ACK before adopting data or resetting history', async () => {
  const h = writer(async () => ({ ok: true, config_rev: 2, can_undo: true }));
  await assert.rejects(commitPlanOptimization(h.host, h.cfg, {}), error => {
    assert.equal(error.stage, 'dispatched'); assert.equal(error.serverRefusal, false);
    return error.code === 'optimize_ack_unconfirmed';
  });
  assert.deepEqual(h.calls, { writes: 1, adopts: 0, clears: 0 });
});

test('#1170 writer distinguishes a queued guard, post-reply authority retirement and failed local adoption', async () => {
  const before = writer(); before.retire();
  await assert.rejects(commitPlanOptimization(before.host, before.cfg, {}), e => e.stage === 'before-dispatch');
  assert.equal(before.calls.writes, 0);
  const late = writer(async () => { late.retire(); return response(); });
  await assert.rejects(commitPlanOptimization(late.host, late.cfg, {}), e => e.stage === 'dispatched' && e.code === 'context-changed');
  assert.equal(late.calls.adopts, 0);
  const adopt = writer(); adopt.host._adoption.acceptPairWrite = () => { throw Error('local build failed'); };
  await assert.rejects(commitPlanOptimization(adopt.host, adopt.cfg, {}), e => e.stage === 'acknowledged' && !!e.receipt);
  assert.equal(adopt.calls.clears, 0);
});

test('#1170 a stale successful ACK cannot overwrite a newer accepted pair', async () => {
  const h = writer(async () => { h.host._cfgRev = 9; return response(); });
  await assert.rejects(commitPlanOptimization(h.host, h.cfg, {}), e => e.stage === 'acknowledged');
  assert.equal(h.calls.adopts, 0); assert.equal(h.calls.clears, 0);
});

function reload(overrides = {}) {
  const current = source(); let adopts = 0;
  const cfgResp = { config: config(), rev: 2 }, layResp = { layout: {}, rev: 3 };
  const port = { source: () => ({ ...current }), pending: () => false,
    layoutIO: new LayoutWriteReload(() => () => true),
    hass: { callWS: async () => layResp }, read: async () => cfgResp,
    adopt: async input => { if (input.isCurrent?.() === false) return { status: 'superseded' };
      adopts++; current.configRev = 2; current.layoutRev = 3; return { status: 'adopted', spaceChanged: false }; },
    ...overrides,
  };
  return { port, current, cfgResp, layResp, adopts: () => adopts };
}

test('#1170 synchronization needs both valid server bodies and an actual gated adoption', async () => {
  const good = reload(); assert.equal(await reloadOptimizePair(good.port), 'adopted'); assert.equal(good.adopts(), 1);
  for (const overrides of [{ read: async () => { throw Error('offline'); } },
    { hass: { callWS: async () => { throw Error('layout offline'); } } },
    { hass: { callWS: async () => undefined } }, { read: async () => undefined }]) {
    const h = reload(overrides); assert.equal(await reloadOptimizePair(h.port), 'failed'); assert.equal(h.adopts(), 0);
  }
  for (const status of ['superseded', 'asset-wait']) {
    const h = reload({ adopt: async () => ({ status }) });
    assert.equal(await reloadOptimizePair(h.port), 'superseded', status);
  }
  for (const half of ['cfgResp', 'layResp']) {
    const h = reload(); h[half].rev = 0;
    assert.equal(await reloadOptimizePair(h.port), 'failed', `stale ${half} is not synchronized`);
    assert.equal(h.adopts(), 0);
  }
});

test('#1170 source changes and local overlays are not evidence of a successfully refreshed pair', async () => {
  const pending = reload({ pending: () => true });
  assert.equal(await reloadOptimizePair(pending.port), 'superseded'); assert.equal(pending.adopts(), 0);
  const raced = reload(); raced.port.read = async () => { raced.current.configRev++; return raced.cfgResp; };
  assert.equal(await reloadOptimizePair(raced.port), 'superseded'); assert.equal(raced.adopts(), 0);
});

test('#1170 transport dispatch notification excludes upload staging and fires once before the actual command', async () => {
  for (const large of [false, true]) {
    let dispatched = 0, uploads = 0;
    const hass = { callWS: async message => { assert.equal(dispatched, 1); return message.type; },
      fetchWithAuth: async () => { uploads++; assert.equal(dispatched, 0);
        return { ok: true, json: async () => ({ token: 'temporary', sha256: 'a'.repeat(64), purpose: 'houseplan/plan/optimize', expires_at: '2099-01-01T00:00:00Z' }) }; } };
    await sendHouseplanWrite(hass, { type: 'houseplan/plan/optimize', config: large ? { data: 'x'.repeat(WS_DIRECT_LIMIT_BYTES) } : {} },
      { isCurrent: () => true, onDispatch: () => { dispatched++; } });
    assert.equal(dispatched, 1); assert.equal(uploads, large ? 1 : 0);
  }
});
