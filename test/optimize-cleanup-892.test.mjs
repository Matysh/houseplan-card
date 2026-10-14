import test from 'node:test';
import assert from 'node:assert/strict';
import { repairSpaceReferences } from '../test-build/space-reference-repair.js';
import { optimizePlans } from '../test-build/plan-optimizer.js';
import { commitPlanOptimization } from '../test-build/plan-optimize-write.js';
import { contentFingerprint } from '../test-build/visual-continuity.js';
import { sameOptimizeSource } from '../test-build/optimize-source.js';

const dead = '601413c5793c698f73b8af0a0b93cac6';
const live = '601413c5793c698f73b8af0a0b93cac7';
const config = () => ({ model_version: 10, spaces: [{ id: 'floor', title: 'Floor', cell_cm: 5,
  view_box: [0, 0, 1, 1], rooms: [{ id: 'room', name: 'Room', poly: [[0,0],[1,0],[1,1],[0,1]] }],
}], markers: [{ id: 'hidden', hidden: true, binding: 'device:hidden' }], settings: {} });
const position = (extra = {}) => ({ s: 'deleted', x: 0.25, y: 0.5, ...extra });
const context = (authoritative, remove = false) => ({ invalidCleanupSupported: true,
  removeInvalidMissingPositions: remove,
  ownerRoster: { authoritative, deviceIds: [live], entityIds: ['light.state_only'] },
});

test('#892 AC5/6: default is read-only; whole unused record including k is eligible, live/hidden/future stay', () => {
  const layout = { grp_old: position({ k: 1.7 }), [dead]: position({ k: 2 }),
    [live]: position(), hidden: position(), rl_room: position({ k: 1.4 }),
    'light.state_only': position(), future_widget: position(),
    grp_extended: position({ future: true }), grp_bad: { s: 'deleted', x: null, y: 0.5 },
    grp_current: { s: 'floor', x: 0.25, y: 0.5, k: 0.7 } };
  const before = JSON.stringify(layout);
  const preview = repairSpaceReferences(config(), layout, context(true));
  assert.equal(JSON.stringify(preview.layout), before);
  assert.deepEqual(preview.report.invalidPositionsEligible.map(x => x.id), ['grp_old', dead]);
  const applied = repairSpaceReferences(config(), layout, context(true, true));
  assert.deepEqual(applied.report.invalidPositionsRemoved.map(x => x.id), ['grp_old', dead]);
  for (const id of Object.keys(layout)) {
    if (id === 'grp_old' || id === dead) assert.equal(applied.layout[id], undefined);
    else assert.deepEqual(applied.layout[id], layout[id], id);
  }
  assert.equal(applied.layout.rl_room.k, 1.4, 'live room scale is independent of stale space');
  assert.equal(applied.report.orphanDevicePositionsRemoved, 0, 'new count is not a fabricated device orphan');
  assert.equal(JSON.stringify(layout), before, 'the source was not mutated');
  assert.equal(repairSpaceReferences(applied.config, applied.layout, context(true, true)).changed, false);
});

test('#892 AC6: obsolete groups need no full registry, opaque HA ids do; future model/shape fail closed', () => {
  const layout = { grp_old: position(), [dead]: position() };
  const limited = repairSpaceReferences(config(), layout, context(false, true));
  assert.equal(limited.layout.grp_old, undefined);
  assert.deepEqual(limited.layout[dead], layout[dead]);
  assert.equal(limited.report.invalidPositionsRetained[0].cleanupReason, 'registry_unavailable');
  const future = repairSpaceReferences({ ...config(), model_version: 11 }, layout,
    { ...context(true, true), invalidCleanupSupported: false });
  assert.deepEqual(future.layout, layout);
  assert.equal(future.report.invalidPositionsEligible.length, 0);
});

test('#892 AC7: exact import lineage is repaired before cleanup and its k preserved', () => {
  const cfg = config(); cfg.spaces[0].id = 'space_floor_1234abcd';
  const layout = { grp_old: { s: 'floor', x: 0.25, y: 0.5, k: 1.8 } };
  const result = repairSpaceReferences(cfg, layout, context(true, true));
  assert.deepEqual(result.layout.grp_old, { ...layout.grp_old, s: 'space_floor_1234abcd' });
  assert.equal(result.report.invalidPositionsRemoved.length, 0);
});

test('#892 AC3/5: final optimizer separates missing-floor motion and rebuilds an idempotent cleanup candidate', () => {
  const cfg = config();
  const layout = { grp_old: position({ x: 0.251 }), [live]: position({ x: 0.251 }),
    hidden: { s: 'floor', x: 0.251, y: 0.5 } };
  const ordinary = optimizePlans(cfg, layout, context(true));
  assert.equal(ordinary.report.currentPositions, 1);
  assert.equal(ordinary.report.archivedPositions, 2);
  assert.equal(ordinary.report.currentPositionsMoved, 1);
  assert.equal(ordinary.report.archivedPositionsMoved, 2);
  assert.ok(ordinary.report.maxShiftCm >= 0);
  const cleaned = optimizePlans(ordinary.config, ordinary.layout, context(true, true));
  assert.equal(cleaned.layout.grp_old, undefined);
  assert.equal(cleaned.report.invalidPositionsRemoved.length, 1);
  const cleanReport = optimizePlans(cleaned.config, cleaned.layout, context(true));
  assert.equal(cleanReport.report.invalidPositionsEligible.length, 0);
  assert.equal(cleanReport.changed, false);
});

function writeHarness() {
  const cfg = config(), layout = { grp_old: position() }, messages = [], adoptions = [];
  const source = { configRev: 7, layoutRev: 9, configFingerprint: contentFingerprint(cfg),
    layoutFingerprint: contentFingerprint(layout), ownersFingerprint: 'registry-1', connection: {} };
  const current = { ...source }; let allowed = true, flush = () => {};
  const host = { _saveConfigDebounced: { pending: () => true, flush: () => flush() },
    _writeChain: Promise.resolve(), _cfgRev: 7, _layoutRev: 9,
    hass: { callWS: async (message) => { messages.push(message); return { config_rev: 8, layout_rev: 10, can_undo: true }; } },
    _adoption: { acceptPairWrite: (...args) => adoptions.push(args) },
    _geometryHistory: { clear() {} }, _devicePositionHistory: { clear() {} }, _cancelDeviceDrag() {},
    _dirtyPos: new Set(), _sentPos: new Map(), _maybeRebuildDevices() {}, _cacheSnapshot() {}, requestUpdate() {},
  };
  const guard = { source, current: () => current, canWrite: () => allowed };
  return { cfg, layout, host, source, current, guard, messages, adoptions,
    disallow: () => { allowed = false; }, setFlush: (next) => { flush = next; } };
}

test('#892 AC8: frozen source covers both revisions, content, owner proof and HA connection', async () => {
  for (const field of ['configRev','layoutRev','configFingerprint','layoutFingerprint','ownersFingerprint','connection']) {
    const h = writeHarness();
    h.setFlush(() => { h.current[field] = field === 'connection' ? {} : 'changed'; });
    await assert.rejects(commitPlanOptimization(h.host, h.cfg, h.layout, h.guard), { code: 'optimize_preview_changed' });
    assert.equal(h.messages.length, 0, field);
    assert.equal(h.adoptions.length, 0, field);
    assert.equal(sameOptimizeSource(h.source, h.current), false);
  }
});

test('#892 AC1/8: revoked permission after queued writes sends nothing; exact accepted pair keeps paired undo', async () => {
  const denied = writeHarness(); denied.setFlush(denied.disallow);
  await assert.rejects(commitPlanOptimization(denied.host, denied.cfg, denied.layout, denied.guard), { code: 'optimize_preview_changed' });
  assert.equal(denied.messages.length, 0);
  const h = writeHarness();
  await commitPlanOptimization(h.host, h.cfg, h.layout, h.guard);
  assert.equal(h.messages.length, 1);
  assert.equal(h.messages[0].expected_config_rev, 7);
  assert.equal(h.messages[0].expected_layout_rev, 9);
  assert.deepEqual(h.adoptions[0], [h.cfg, h.layout, { config_rev: 8, layout_rev: 10, can_undo: true }]);
  assert.equal(h.host._canOptimizeUndo, true);
  assert.equal(h.host._undoKind, 'optimize');
});

test('#892 AC8: an old-connection reply is never adopted into a new HA', async () => {
  const h = writeHarness(); let resolve;
  h.host.hass.callWS = () => new Promise((r) => { resolve = r; });
  const pending = commitPlanOptimization(h.host, h.cfg, h.layout, h.guard);
  await Promise.resolve(); h.current.connection = {};
  resolve({ config_rev: 8, layout_rev: 10 });
  await assert.rejects(pending, { code: 'optimize_preview_changed' });
  assert.equal(h.adoptions.length, 0);
});
