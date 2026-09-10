import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createConfigAdoption,
  adoptAuthoritativeGated,
  adoptStructuralResponses,
} from '../test-build/config-adoption.js';
import { contentFingerprint } from '../test-build/visual-continuity.js';
import { virtualLightSnapshot } from '../test-build/virtual-light-state.js';

// #500 — one owner for config/layout identity. These tests pin the transition
// table the host used to implement inline (`_adoptStructuralResponses`,
// `_cacheSnapshot`, `_sendConfigCandidate`, `rollbackOptimistic`) so the
// extraction is provably behaviour-neutral (AC3, AC5, AC6) and the invariants
// I2/I4 have a red witness.

const cfg = (title, extra = {}) => ({ spaces: [{ id: 'f1', title }], settings: {}, ...extra });
const cloneOf = (value) => JSON.parse(JSON.stringify(value));

/** A host stub recording every side effect the adoption may trigger, in order. */
function hostStub(adoption, overrides = {}) {
  const calls = [];
  const rec = (name) => (...args) => { calls.push(name); return overrides[name]?.(...args); };
  const host = {
    hass: { id: 'hass' },
    _adoption: adoption,
    _space: 'f1',
    _model: [],
    _virtualLights: virtualLightSnapshot(null),
    _capturedSnapshotVirtual: 'kept',
    _geometryHistory: { clear: rec('geometryHistory.clear') },
    _devicePositionHistory: { clear: rec('devicePositionHistory.clear') },
    _pendingPhysicalWrites: { clear: rec('pendingPhysicalWrites.clear') },
    _canOptimizeUndo: false,
    _undoKind: null,
    _serverCanWrite: null,
    _regSignature: 'sig',
    _continuity: {
      hasCompleteFrame: true,
      state: 'steady',
      note: (event, detail) => { calls.push(`note:${event}`); host.notes.push([event, detail]); },
    },
    notes: [],
    _signer: { prepareImage: async (_hass, url) => { calls.push(`prepareImage:${url}`); return overrides.assetReady ?? true; } },
    _cancelDeviceDrag: rec('cancelDeviceDrag'),
    _clearRoomFocus: rec('clearRoomFocus'),
    _cancelCameraTransition: rec('cancelCameraTransition'),
    _clearGeometryGesture: rec('clearGeometryGesture'),
    _seedDecorStyle: rec('seedDecorStyle'),
    _adoptConfigCapabilities: rec('adoptConfigCapabilities'),
    _candidateBackdrop: (config) => config?.spaces?.[0]?.bg?.href || 'no-backdrop',
    _scheduleLoadRetry: rec('scheduleLoadRetry'),
    _beginContinuityCandidate: (reason) => { calls.push(`continuity:${reason}`); return 1; },
    _syncDecorAssets: async () => { calls.push('syncDecorAssets'); },
    _adoptInitialSpace: rec('adoptInitialSpace'),
    _resumePendingNavMode: rec('resumePendingNavMode'),
    _cacheSnapshot: rec('cacheSnapshot'),
    calls,
  };
  return host;
}

const adoptedWith = (config, rev = 1) => {
  const adoption = createConfigAdoption();
  adoptStructuralResponses(hostStub(adoption), { config, rev }, { layout: {}, rev: 0 });
  return adoption;
};

// --- AC3: transition table of the former _adoptStructuralResponses ---------

test('AC3: an identical payload is an echo — body reference, histories and epoch state stay, only the revision moves', () => {
  const body = cfg('Ground floor');
  const adoption = adoptedWith(body, 3);
  const host = hostStub(adoption);
  const echo = cloneOf(body);
  const result = adoptStructuralResponses(host, { config: echo, rev: 4 }, { layout: {}, rev: 2 });
  assert.deepEqual(result, { configChanged: false, layoutChanged: false });
  assert.equal(adoption.config, body, 'the echo must not replace the reactive root');
  assert.equal(adoption.configRev, 4);
  assert.equal(adoption.layoutRev, 2);
  assert.ok(!host.calls.includes('geometryHistory.clear'), 'echo keeps local undo');
  assert.ok(!host.calls.includes('cancelCameraTransition'));
  assert.ok(!host.notes.some(([event]) => event === 'config-candidate'));
});

test('AC3: a different config replaces the body, retires baseline-bound state in the host order, and notes the candidate', () => {
  const adoption = adoptedWith(cfg('Ground floor'), 3);
  const host = hostStub(adoption);
  const next = cfg('Renamed');
  const result = adoptStructuralResponses(host, { config: next, rev: 5, can_write: true, can_optimize_undo: true, undo_kind: 'optimize' });
  assert.deepEqual(result, { configChanged: true, layoutChanged: false });
  assert.equal(adoption.config, next, 'the adopted body is the response object itself (I4)');
  assert.equal(adoption.configRev, 5);
  assert.equal(adoption.configFingerprint, contentFingerprint(next));
  assert.deepEqual(host.calls.slice(0, 7), [
    'geometryHistory.clear', 'devicePositionHistory.clear', 'cancelDeviceDrag',
    'pendingPhysicalWrites.clear', 'clearRoomFocus', 'cancelCameraTransition', 'clearGeometryGesture',
  ]);
  assert.ok(host.calls.indexOf('seedDecorStyle') > host.calls.indexOf('clearGeometryGesture'));
  assert.equal(host._serverCanWrite, true);
  assert.equal(host._canOptimizeUndo, true);
  assert.equal(host._undoKind, 'optimize');
  assert.deepEqual(host.notes.at(-1), ['config-candidate', { configRev: 5 }]);
});

test('AC3: the very first adoption does not clear a geometry gesture that never existed', () => {
  const adoption = createConfigAdoption();
  const host = hostStub(adoption);
  adoptStructuralResponses(host, { config: cfg('First'), rev: 1 });
  assert.ok(!host.calls.includes('clearGeometryGesture'));
  assert.ok(host.calls.includes('geometryHistory.clear'));
});

test('AC3: layout-only change retires drag/camera state and notes the layout candidate; config side is untouched', () => {
  const adoption = adoptedWith(cfg('Ground floor'), 3);
  const host = hostStub(adoption);
  const layout = { dev1: { s: 'f1', x: 0.5, y: 0.5 } };
  const result = adoptStructuralResponses(host, { config: cloneOf(adoption.config), rev: 3 }, { layout, rev: 9 });
  assert.deepEqual(result, { configChanged: false, layoutChanged: true });
  assert.equal(adoption.layout, layout);
  assert.equal(adoption.layoutRev, 9);
  assert.equal(adoption.layoutFingerprint, contentFingerprint(layout));
  assert.deepEqual(host.calls.filter((c) => !c.startsWith('note') && c !== 'adoptConfigCapabilities'),
    ['cancelCameraTransition', 'devicePositionHistory.clear', 'cancelDeviceDrag']);
  assert.deepEqual(host.notes, [['layout-candidate', { layoutRev: 9 }]]);
});

test('AC3: a response without rev keeps the previous revision; an absent layout response leaves layout identity alone', () => {
  const adoption = adoptedWith(cfg('Ground floor'), 3);
  adoptStructuralResponses(hostStub(adoption), { config: cfg('Other') }, { layout: { a: {} }, rev: 4 });
  assert.equal(adoption.configRev, 3);
  assert.equal(adoption.layoutRev, 4);
  adoptStructuralResponses(hostStub(adoption), { config: cfg('Third'), rev: 8 });
  assert.equal(adoption.configRev, 8);
  assert.equal(adoption.layoutRev, 4, 'no layout response → layout identity untouched');
  assert.deepEqual(adoption.layout, { a: {} });
});

test('AC3: virtual lights are adopted with the response revision and only replaced when they differ', () => {
  const adoption = adoptedWith(cfg('Ground floor'), 3);
  const host = hostStub(adoption);
  adoptStructuralResponses(host, {
    config: cloneOf(adoption.config), rev: 4,
    virtual_lights: { rev: 1, config_rev: 4, off: ['vl.one'] },
  });
  assert.deepEqual([...host._virtualLights.off], ['vl.one']);
  assert.equal(host._capturedSnapshotVirtual, '', 'a changed set invalidates the captured render snapshot');
  const before = host._virtualLights;
  host._capturedSnapshotVirtual = 'kept';
  adoptStructuralResponses(host, {
    config: cloneOf(adoption.config), rev: 4,
    virtual_lights: { rev: 1, config_rev: 4, off: ['vl.one'] },
  });
  assert.equal(host._capturedSnapshotVirtual, 'kept', 'an identical set is not a change');
  assert.equal(host._virtualLights, before, 'identical wire state keeps the snapshot object');
});

// --- §6.3: the gated sequence -----------------------------------------------

test('gated adoption: unchanged structure skips the backdrop gate and continuity, adopts, and runs the reload tail', async () => {
  const adoption = adoptedWith(cfg('Ground floor'), 3);
  const host = hostStub(adoption);
  const result = await adoptAuthoritativeGated(host, {
    cfgResp: { config: cloneOf(adoption.config), rev: 4 }, reason: 'config-reload', profile: 'reload',
  });
  assert.deepEqual(result, { status: 'adopted', spaceChanged: false });
  assert.ok(!host.calls.some((c) => c.startsWith('prepareImage')));
  assert.ok(!host.calls.some((c) => c.startsWith('continuity:')));
  assert.deepEqual(host.calls.slice(-4), ['syncDecorAssets', 'adoptInitialSpace', 'resumePendingNavMode', 'cacheSnapshot']);
});

test('gated adoption: a changed structure prepares the candidate backdrop, starts the continuity candidate, then adopts (#490 M1 order)', async () => {
  const adoption = adoptedWith(cfg('Ground floor'), 3);
  const host = hostStub(adoption);
  let beforeAdoptSeen = null;
  const next = cfg('New', {});
  next.spaces[0].bg = { href: '/local/new-plan.svg' };
  const result = await adoptAuthoritativeGated(host, {
    cfgResp: { config: next, rev: 4 }, reason: 'summary-recovery', profile: 'reload',
    beforeAdopt: () => { beforeAdoptSeen = adoption.config; },
  });
  assert.equal(result.status, 'adopted');
  const order = host.calls;
  assert.ok(order.indexOf('prepareImage:/local/new-plan.svg') < order.indexOf('continuity:summary-recovery'));
  assert.ok(order.indexOf('continuity:summary-recovery') < order.indexOf('geometryHistory.clear'));
  assert.notEqual(beforeAdoptSeen, next, 'beforeAdopt runs after the gate, before adoption');
  assert.equal(adoption.config, next);
});

test('gated adoption: a bounded asset failure adopts nothing, notes the failure and schedules a retry', async () => {
  const adoption = adoptedWith(cfg('Ground floor'), 3);
  const host = hostStub(adoption, { assetReady: false });
  const before = adoption.config;
  const result = await adoptAuthoritativeGated(host, {
    cfgResp: { config: cfg('New'), rev: 4 }, reason: 'structural-response', profile: 'reload',
    beforeAdopt: () => assert.fail('beforeAdopt must not run when the gate refuses'),
  });
  assert.deepEqual(result, { status: 'asset-wait' });
  assert.equal(adoption.config, before);
  assert.equal(adoption.configRev, 3, 'the revision is not taken without its body');
  assert.ok(host.calls.includes('note:asset-failed'));
  assert.ok(host.calls.includes('scheduleLoadRetry'));
  assert.ok(!host.calls.includes('cacheSnapshot'));
});

test('gated adoption: the continuity candidate needs a complete steady frame', async () => {
  const adoption = adoptedWith(cfg('Ground floor'), 3);
  const host = hostStub(adoption);
  host._continuity.state = 'candidate';
  await adoptAuthoritativeGated(host, { cfgResp: { config: cfg('New'), rev: 4 }, reason: 'config-reload', profile: 'reload' });
  assert.ok(!host.calls.some((c) => c.startsWith('continuity:')));
});

test('post-write profile ends at adoption: no reload tail, the caller keeps its own (§6.3, r3)', async () => {
  const adoption = adoptedWith(cfg('Ground floor'), 3);
  const host = hostStub(adoption);
  const result = await adoptAuthoritativeGated(host, {
    cfgResp: { config: cfg('After import'), rev: 7 }, layResp: { layout: { d: {} }, rev: 2 },
    reason: 'import-apply', profile: 'post-write',
  });
  assert.equal(result.status, 'adopted');
  for (const tail of ['syncDecorAssets', 'adoptInitialSpace', 'resumePendingNavMode', 'cacheSnapshot']) {
    assert.ok(!host.calls.includes(tail), `${tail} belongs to the caller on post-write paths`);
  }
  assert.ok(host.calls.some((c) => c.startsWith('prepareImage')), 'the gate itself applies to post-write paths (AC4)');
  assert.equal(adoption.configRev, 7);
  assert.equal(adoption.layoutRev, 2);
});

test('post-write profile: a refused gate adopts nothing and reports asset-wait, so the caller can skip its tail (AC4, review r1 M1)', async () => {
  const adoption = adoptedWith(cfg('Ground floor'), 3);
  const host = hostStub(adoption, { assetReady: false });
  const body = adoption.config;
  const result = await adoptAuthoritativeGated(host, {
    cfgResp: { config: cfg('Deleted on server'), rev: 4 }, layResp: { layout: { d: {} }, rev: 1 },
    reason: 'space-delete', profile: 'post-write',
  });
  assert.deepEqual(result, { status: 'asset-wait' });
  assert.equal(adoption.config, body);
  assert.equal(adoption.configRev, 3);
  assert.equal(adoption.layoutRev, 0);
  assert.ok(host.calls.includes('note:asset-failed') && host.calls.includes('scheduleLoadRetry'));
  assert.ok(!host.calls.includes('geometryHistory.clear'));
});

test('I2: a revision is never taken from a response other than the one carrying the adopted body', async () => {
  const adoption = adoptedWith(cfg('Ground floor'), 3);
  const host = hostStub(adoption);
  // A delete reply says config_rev 5, but a concurrent client already moved
  // the config to rev 6 before our re-read: the re-read wins, whole.
  const deleteReply = { config_rev: 5, layout_rev: 1 };
  await adoptAuthoritativeGated(host, {
    cfgResp: { config: cfg('Concurrently renamed'), rev: 6 }, layResp: { layout: {}, rev: 2 },
    reason: 'space-delete', profile: 'post-write',
  });
  assert.equal(adoption.configRev, 6);
  assert.equal(adoption.layoutRev, 2);
  assert.notEqual(adoption.configRev, deleteReply.config_rev);
  assert.equal(typeof adoption.acceptPairWrite, 'function');
});

// --- our own writes -----------------------------------------------------------

test('stageConfigCandidate replaces the root only when canonicalization changed content (#224 H1) and pins the accepted fingerprint', () => {
  const adoption = adoptedWith(cfg('Ground floor'), 3);
  const live = adoption.config;
  const same = cloneOf(live);
  adoption.stageConfigCandidate(same);
  assert.equal(adoption.config, live, 'equal content keeps the reactive root');
  const changed = cfg('Canonical');
  adoption.stageConfigCandidate(changed);
  assert.equal(adoption.config, changed);
  assert.equal(adoption.configFingerprint, contentFingerprint(changed));
});

test('acceptConfigWrite takes the reply revision for the sent candidate; without rev it keeps the historical +1 guess (§15 п.3)', () => {
  const adoption = adoptedWith(cfg('Ground floor'), 3);
  const candidate = cfg('Sent');
  adoption.acceptConfigWrite(candidate, { rev: 10 });
  assert.equal(adoption.configRev, 10);
  assert.equal(adoption.configFingerprint, contentFingerprint(candidate));
  adoption.acceptConfigWrite(candidate, {});
  assert.equal(adoption.configRev, 11);
  adoption.acceptConfigWrite(candidate, undefined);
  assert.equal(adoption.configRev, 12);
});

test('acceptPairWrite lands both bodies with both revisions; missing revisions fall back to +1 each', () => {
  const adoption = adoptedWith(cfg('Ground floor'), 3);
  const config = cfg('Optimized');
  const layout = { d: { s: 'f1', x: 0.1, y: 0.2 } };
  adoption.acceptPairWrite(config, layout, { config_rev: 4, layout_rev: 9 });
  assert.equal(adoption.config, config);
  assert.equal(adoption.layout, layout);
  assert.equal(adoption.configRev, 4);
  assert.equal(adoption.layoutRev, 9);
  assert.equal(adoption.configFingerprint, contentFingerprint(config));
  assert.equal(adoption.layoutFingerprint, contentFingerprint(layout));
  adoption.acceptPairWrite(config, layout, { config_rev: 'x' });
  assert.equal(adoption.configRev, 5);
  assert.equal(adoption.layoutRev, 10);
});

test('layout: merged re-read keeps the reference on equal content; own replies move the revision monotonically', () => {
  const adoption = adoptedWith(cfg('Ground floor'), 3);
  const layout = { d: { s: 'f1', x: 0.1, y: 0.2 } };
  adoption.stageLocalLayout(layout);
  let replaced = 0;
  assert.equal(adoption.adoptMergedLayout(cloneOf(layout), { rev: 5 }, () => { replaced += 1; }), false);
  assert.equal(adoption.layout, layout);
  assert.equal(adoption.layoutRev, 5);
  assert.equal(replaced, 0);
  const other = { d: { s: 'f1', x: 0.3, y: 0.2 } };
  assert.equal(adoption.adoptMergedLayout(other, { rev: 6 }, () => { replaced += 1; }), true);
  assert.equal(adoption.layout, other);
  assert.equal(replaced, 1);
  adoption.noteLayoutRevision(4);
  assert.equal(adoption.layoutRev, 6, 'an older own reply is not a step back');
  adoption.noteLayoutRevision(8);
  assert.equal(adoption.layoutRev, 8);
  adoption.noteLayoutRevision('9');
  assert.equal(adoption.layoutRev, 8);
});

// --- reactive contract: a replaced body is a host event ------------------------

test('a replaced body reference notifies the host with the field name and previous value; echoes and identity-only changes do not', () => {
  const events = [];
  const adoption = createConfigAdoption((field, previous) => events.push([field, previous]));
  const first = cfg('First');
  adoptStructuralResponses(hostStub(adoption), { config: first, rev: 1 }, { layout: { d: {} }, rev: 0 });
  assert.deepEqual(events.map(([f]) => f), ['_serverCfg', '_layout'], 'first adoption replaces both bodies');
  assert.equal(events[0][1], null);
  events.length = 0;
  adoptStructuralResponses(hostStub(adoption), { config: cloneOf(first), rev: 2 }, { layout: { d: {} }, rev: 3 });
  assert.deepEqual(events, [], 'an echo moves revisions only — no reactive event, no epoch bump (#500)');
  adoption.acceptConfigWrite(first, { rev: 3 });
  adoption.refreshConfigFingerprint();
  adoption.noteLayoutRevision(9);
  assert.deepEqual(events, [], 'identity-only changes are not body events');
  const second = cfg('Second');
  adoption.stageLocalConfig(second);
  assert.deepEqual(events, [['_serverCfg', first]]);
  adoption.stageLocalConfig(second);
  assert.equal(events.length, 1, 'same reference again is not a replacement');
  const attempt = adoption.beginOptimistic(second, cfg('Draft'));
  adoption.stageLocalConfig(attempt.attempted);
  adoption.rollbackOptimistic(attempt);
  assert.deepEqual(events.slice(1).map(([f]) => f), ['_serverCfg', '_serverCfg'], 'staging and rollback both replace the body');
  events.length = 0;
  adoption.acceptPairWrite(cfg('Pair'), { d: {} }, { config_rev: 5, layout_rev: 6 });
  assert.deepEqual(events.map(([f]) => f), ['_serverCfg', '_layout']);
  events.length = 0;
  adoption.adoptMergedLayout(cloneOf(adoption.layout), { rev: 7 });
  assert.deepEqual(events, [], 'equal merged layout keeps the reference');
  adoption.adoptMergedLayout({ e: {} }, { rev: 8 });
  assert.deepEqual(events.map(([f]) => f), ['_layout']);
});

// --- AC5: warm cache round-trip ----------------------------------------------

test('AC5: snapshot → restoreCached reproduces the identity exactly with the persisted LS_CFG keys', () => {
  const adoption = adoptedWith(cfg('Ground floor'), 3);
  adoption.adoptMergedLayout({ d: { s: 'f1', x: 0.1, y: 0.2 } }, { rev: 7 });
  const snapshot = adoption.snapshot({ rev: 0, config_rev: 3, off: [] });
  assert.deepEqual(Object.keys(snapshot).sort(), [
    'config', 'config_fingerprint', 'layout', 'layout_fingerprint', 'layout_rev', 'rev', 'virtual_lights',
  ]);
  const restored = createConfigAdoption();
  assert.equal(restored.restoreCached(JSON.parse(JSON.stringify(snapshot))), true);
  assert.deepEqual(restored.config, adoption.config);
  assert.equal(restored.configRev, 3);
  assert.equal(restored.configFingerprint, adoption.configFingerprint);
  assert.deepEqual(restored.layout, adoption.layout);
  assert.equal(restored.layoutRev, 7);
  assert.equal(restored.layoutFingerprint, adoption.layoutFingerprint);
});

test('AC5: a cache written before fingerprints existed restores with recomputed fingerprints; garbage is refused', () => {
  const adoption = createConfigAdoption();
  const config = cfg('Old cache');
  assert.equal(adoption.restoreCached({ config, rev: 2, layout: { d: {} }, layout_rev: 1 }), true);
  assert.equal(adoption.configFingerprint, contentFingerprint(config));
  assert.equal(adoption.layoutFingerprint, contentFingerprint({ d: {} }));
  const empty = createConfigAdoption();
  assert.equal(empty.restoreCached(null), false);
  assert.equal(empty.restoreCached({ config: { spaces: 'nope' } }), false);
  assert.equal(empty.config, null);
});

test('snapshot re-pairs fingerprints with bodies mutated in place before the debounced write', () => {
  const adoption = adoptedWith(cfg('Ground floor'), 3);
  adoption.config.spaces[0].title = 'Mutated in place';
  assert.notEqual(adoption.configFingerprint, contentFingerprint(adoption.config));
  const snapshot = adoption.snapshot(null);
  assert.equal(snapshot.config_fingerprint, contentFingerprint(adoption.config));
  assert.equal(adoption.configFingerprint, snapshot.config_fingerprint);
  assert.equal(createConfigAdoption().snapshot(null), null);
});

// --- AC6: optimistic writes (#314/#439/#442) --------------------------------

test('AC6: a rejected optimistic write restores only its own candidate (#439)', () => {
  const adoption = adoptedWith(cfg('Ground floor'), 7);
  const previous = adoption.config;
  const attempted = cfg('Draft');
  const attempt = adoption.beginOptimistic(previous, attempted);
  assert.equal(attempt.revision, 7);
  assert.equal(attempt.previousFingerprint, adoption.configFingerprint);
  adoption.stageLocalConfig(attempted);
  assert.equal(adoption.rollbackOptimistic(attempt), true);
  assert.deepEqual(adoption.config, previous);
  assert.notEqual(adoption.config, previous, 'the rollback snapshot is isolated from later mutations');
  assert.equal(adoption.configFingerprint, attempt.previousFingerprint);
  assert.equal(adoption.configRev, 7, 'a rollback never touches the revision');
});

test('AC6: a conflict reload or a newer mutation wins over a rejected candidate (#439)', () => {
  const adoption = adoptedWith(cfg('Server before'), 3);
  const attempt = adoption.beginOptimistic(adoption.config, cfg('Draft'));
  adoptStructuralResponses(hostStub(adoption), { config: cfg('Server after'), rev: 4 });
  const authoritative = adoption.config;
  assert.equal(adoption.rollbackOptimistic(attempt), false, 'a newer revision wins');
  assert.equal(adoption.config, authoritative);
  const same = createConfigAdoption();
  same.restoreCached({ config: cfg('Server before'), rev: 3 });
  const attempt2 = same.beginOptimistic(same.config, cfg('Draft'));
  same.stageLocalConfig(cfg('Newer local edit'));
  assert.equal(same.rollbackOptimistic(attempt2), false, 'different content on the same revision wins');
  assert.equal(same.config.spaces[0].title, 'Newer local edit');
});

test('AC6: an attempt from an older revision cannot roll back the same content accepted at a newer one (#442 AC2)', () => {
  const adoption = adoptedWith(cfg('Server before'), 3);
  const attempted = cfg('Draft');
  const attempt = adoption.beginOptimistic(adoption.config, attempted);
  adoption.stageLocalConfig(attempted);
  // the queued write for the very same body was accepted meanwhile
  adoption.acceptConfigWrite(attempted, { rev: 4 });
  assert.equal(contentFingerprint(adoption.config), attempt.attemptedFingerprint, 'content is identical — only the revision differs');
  assert.equal(adoption.rollbackOptimistic(attempt), false, 'the revision guard alone must refuse');
  assert.equal(adoption.config, attempted);
  assert.equal(adoption.configRev, 4);
});

test('AC6: newer in-place content on the attempted root also wins (#442)', () => {
  const adoption = adoptedWith(cfg('Server before'), 3);
  const attempted = cfg('Draft');
  const attempt = adoption.beginOptimistic(adoption.config, attempted);
  adoption.stageLocalConfig(attempted);
  attempted.settings.newer = true;
  assert.equal(adoption.rollbackOptimistic(attempt), false);
  assert.equal(adoption.config, attempted);
});
