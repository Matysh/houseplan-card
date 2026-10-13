// #842: an editor write never deletes plan objects silently (К1–К3, AC1–AC3,
// AC6, AC7). Every scenario runs the production write path — the real runtime
// `_saveMarker` / `_saveConfig` / `_writeConfig`, a real ConfigAdoption and a
// real HpConfirmController — and judges what was sent over `config/set`, what
// the live config holds and what the person is asked.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { clone, editorWriteHarness, settle } from './helpers/editor-write-host.mjs';
import {
  DAMAGED, cleanupScenario, composition, ids, k3Body, markerSave, plan,
} from './helpers/geometry-cleanup-scenarios.mjs';
// The module under test is imported inside its own unit tests, so that every
// behavioural witness below also runs (red) against the pre-#842 build.
const cleanupModule = () => import('../test-build/geometry-cleanup.js');
import { commitPlanOptimization } from '../test-build/plan-optimize-write.js';

test('#842 R: the historical filter predicates, read-only; openings follow only a vanished partition id', async () => {
  const { findGeometryRemoval } = await cleanupModule();
  const cfg = plan();
  assert.equal(findGeometryRemoval(cfg), null, 'a valid plan has nothing to remove');
  for (const [name, damage] of Object.entries(DAMAGED)) {
    const damaged = plan();
    const counts = damage(damaged);
    const before = JSON.stringify(damaged);
    const removal = findGeometryRemoval(damaged);
    assert.deepEqual({ partitions: removal.partitions, columns: removal.columns, openings: removal.openings },
      counts, name);
    assert.equal(JSON.stringify(damaged), before, `${name}: detection never mutates`);
  }
  const duplicate = plan();
  duplicate.spaces[0].partitions.push({ ...clone(duplicate.spaces[0].partitions[0]) });
  const removal = findGeometryRemoval(duplicate);
  assert.deepEqual([removal.partitions, removal.openings], [1, 0],
    'the kept first owner of a repeated id still hosts its opening');
});

test('#842 К1: normalisation keeps unknown column fields and canonicalises shape/cm/angle only', async () => {
  const { normalizeLegacyGeometryInPlace } = await cleanupModule();
  const cfg = plan();
  cfg.spaces[0].wall_columns.push({ id: 'c-legacy', shape: 'oval', center: ['0.5', 0.2], cm: 0, angle: 135, colour: 'red' });
  cfg.spaces[0].wall_columns.push({ id: 'c-disc', shape: 'circle', center: [0.4, 0.2], cm: 500, angle: 10, tag: 1 });
  normalizeLegacyGeometryInPlace(cfg);
  const [square, round, legacy, disc] = cfg.spaces[0].wall_columns;
  assert.deepEqual(square, { id: 'c-square', shape: 'square', center: [0.7, 0.85], cm: 30, angle: 0, finish: 'brick' });
  assert.deepEqual(round, { id: 'c-round', shape: 'circle', center: [0.3, 0.85], cm: 20, label: 'pillar' });
  assert.equal(legacy.colour, 'red');
  assert.deepEqual([legacy.shape, legacy.center, legacy.cm, legacy.angle], ['square', [0.5, 0.2], 15, 45]);
  assert.equal(disc.tag, 1);
  assert.equal('angle' in disc, false, 'a circle never carries an angle the backend rejects');
  assert.equal(cfg.spaces[0].partitions[1].note, 'kept by the backend');
});

test('#842 AC1: marker Save sends every plan object with the column’s unknown field; a re-read has the same composition', async () => {
  const cfg = plan();
  const h = markerSave(cfg);
  await h.runtime._saveMarker();
  await settle();
  assert.equal(h.server.sets.length, 1, 'one config/set');
  const sent = h.server.sets[0];
  assert.deepEqual(composition(sent), composition(cfg), 'every room, opening, partition and column id is sent');
  const columns = Object.fromEntries(sent.spaces[0].wall_columns.map((column) => [column.id, column]));
  assert.equal(columns['c-square'].finish, 'brick', 'the unknown column field survives the write');
  assert.equal(columns['c-round'].label, 'pillar');
  assert.equal(sent.spaces[0].partitions[1].note, 'kept by the backend');
  assert.equal(sent.markers[0].name, 'Lamp renamed');
  await h.host._reloadConfigOnly();
  assert.deepEqual(composition(h.host._serverCfg), composition(cfg), 'a re-read has the same composition');
  assert.equal(h.host._serverCfg.spaces[0].wall_columns[0].finish, 'brick');
  assert.equal(h.host._markerDialog, null);
  assert.deepEqual(h.toasts, ['toast.marker_saved']);
  assert.equal(h.activeConfirm(), null, 'nothing to confirm on a valid plan');
});

for (const [name, damage] of Object.entries(DAMAGED)) {
  test(`#842 AC2 ${name}: marker Save is refused before config/set and asks K3 with the right numbers`, async () => {
    const cfg = plan();
    const counts = damage(cfg);
    const h = markerSave(cfg);
    const before = JSON.stringify(h.host._serverCfg);
    await h.runtime._saveMarker();
    await settle();
    assert.equal(h.server.sets.length, 0, 'config/set is not called');
    assert.equal(JSON.stringify(h.host._serverCfg), before, 'the live config is byte-for-byte the previous one');
    assert.deepEqual(h.rollbacks, [true], 'the optimistic attempt was rolled back by its own rollbackOptimistic');
    assert.equal(h.host._markerDialog?.name, 'Lamp renamed', 'the marker dialog keeps its draft');
    assert.equal(h.host._markerDialog?.busy, false);
    const k3 = h.activeConfirm()?.request;
    assert.equal(k3?.kind, 'destructive');
    assert.equal(k3?.title, 'confirm.geometry_cleanup_title');
    assert.equal(k3?.message, k3Body(counts));
    assert.equal(k3?.confirmLabel, 'btn.delete_and_save');
    assert.equal(k3?.cancelLabel, 'btn.cancel');
    assert.deepEqual(h.toasts, [], 'no generic error toast — the K3 dialog answers instead');
  });
}

test('#842 AC3: «Delete and save» removes exactly R with its openings in one write; the open dialog then saves', async () => {
  const { h, before, asked, cleaned } = await cleanupScenario();
  assert.equal(asked, k3Body({ partitions: 1, columns: 1, openings: 1 }));
  assert.equal(h.server.sets.length, 1, 'one write');
  const expected = composition(before);
  expected.partitions = expected.partitions.filter((id) => id !== 'p-lost');
  expected.openings = expected.openings.filter((id) => id !== 'o-lost');
  expected.columns = expected.columns.filter((id) => id !== 'c-far');
  assert.deepEqual(composition(cleaned), expected, 'exactly R is gone');
  const partitionIds = new Set(ids(cleaned.spaces[0].partitions));
  for (const opening of cleaned.spaces[0].openings) {
    if (opening.host?.kind === 'partition') assert.ok(partitionIds.has(opening.host.id), opening.id);
  }
  assert.equal(cleaned.markers[0].name, 'Lamp', 'the open dialog draft is not part of the cleanup write');
  assert.deepEqual(h.toasts, ['toast.geometry_cleanup_done']);
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/842-geometry-cleanup.json', import.meta.url), 'utf8'));
  assert.deepEqual(before, fixture.before, 'the backend fixture input is this scenario');
  assert.deepEqual(cleaned, fixture.cleaned, 'the backend validates exactly this frontend output');

  assert.equal(h.host._markerDialog?.busy, false);
  await h.runtime._saveMarker();
  await settle();
  assert.equal(h.server.sets.length, 2, 'the dialog’s own Save goes through');
  assert.equal(h.server.sets[1].markers[0].name, 'Lamp renamed');
  assert.equal(h.host._markerDialog, null);
});

test('#842 AC3: «Cancel» sends nothing and changes nothing; the next Save asks again', async () => {
  const cfg = plan();
  DAMAGED['degenerate partition'](cfg);
  const h = markerSave(cfg);
  const before = JSON.stringify(h.host._serverCfg);
  await h.runtime._saveMarker();
  await settle();
  h.answer(false);
  await settle();
  assert.equal(h.server.sets.length, 0);
  assert.equal(JSON.stringify(h.host._serverCfg), before);
  assert.equal(h.activeConfirm(), null);
  await h.runtime._saveMarker();
  await settle();
  assert.equal(h.server.sets.length, 0);
  assert.equal(h.activeConfirm()?.request.key, 'geometry-cleanup', 'the next write passes K2 again');
});

test('#842 К2: a repeated refusal of the same R while K3 is open opens no second dialog', async () => {
  const cfg = plan();
  DAMAGED['degenerate partition'](cfg);
  const h = markerSave(cfg);
  await h.runtime._saveMarker();
  await settle();
  const first = h.activeConfirm();
  h.runtime._saveConfig();
  h.host._saveConfigDebounced.flush();
  await settle();
  assert.equal(h.confirms.length, 1, 'one K3 request');
  assert.equal(h.activeConfirm()?.token, first.token, 'the open dialog is still the one the person sees');
  assert.equal(h.server.sets.length, 0);
});

test('#842 AC6: an explicit partition+opening delete is the operation’s own removal — no K3, one ordinary write', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const cfg = plan();
  cfg.model_version = 9;
  const h = editorWriteHarness({ config: cfg });
  Object.assign(h.host, { _path: [], _geometryHistory: { clear() {}, push() {}, size: 0 } });
  h.runtime._clearGeometryGesture = () => {};
  h.runtime._junctionBaselineCache = new WeakMap();
  // «Delete wall and openings» (`_confirmPartitionDelete`, a class-field handler
  // the smoke clicks for real): remove the partition with its hosted openings,
  // then the production physical commit (#314 barrier, history, deferred write).
  const before = h.runtime._geometrySnapshot('f1');
  const space = h.host._serverCfg.spaces[0];
  space.partitions = space.partitions.filter((partition) => partition.id !== 'p-host');
  space.openings = space.openings.filter((opening) => opening.host?.id !== 'p-host');
  assert.equal(h.runtime._commitPhysicalGeometry('history.physical_delete', before), true);
  t.mock.timers.tick(500);
  await settle();
  assert.equal(h.server.sets.length, 1);
  assert.deepEqual(ids(h.server.sets[0].spaces[0].partitions), ['p-free']);
  assert.deepEqual(ids(h.server.sets[0].spaces[0].openings), ['o-room']);
  assert.equal(h.activeConfirm(), null, 'no K3 for the operation’s own deletion');
  assert.deepEqual(h.toasts, []);
});

test('#842 AC6: Optimize flushes the pending edit normally and replaces the pair without K3', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const cfg = plan();
  const h = editorWriteHarness({ config: cfg });
  const optimized = clone(cfg);
  optimized.spaces[0].partitions = optimized.spaces[0].partitions.filter((p) => p.id !== 'p-host');
  optimized.spaces[0].openings = optimized.spaces[0].openings.filter((o) => o.id !== 'o-partition');
  const messages = [];
  Object.assign(h.host, {
    _canOptimizeUndo: false, _undoKind: null, _dirtyPos: new Set(), _sentPos: new Map(),
    _modelCache: null, _frame: null, _cacheSnapshot() {},
  });
  h.host.hass = { callWS: async (message) => { messages.push(message); return { can_undo: true, config_rev: 9, layout_rev: 2 }; } };
  h.host._serverCfg.settings.show_room_tooltip = false;
  h.runtime._saveConfig();
  await commitPlanOptimization(h.host, optimized, {});
  assert.equal(h.server.sets.length, 1, 'the pending edit was written first, normally');
  assert.equal(messages[0].type, 'houseplan/plan/optimize');
  assert.deepEqual(ids(h.host._serverCfg.spaces[0].partitions), ['p-free']);
  assert.equal(h.activeConfirm(), null);
});

test('#842 AC7: a background write refuses by itself, asks K3, and both answers behave; teardown sends nothing', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const cfg = plan();
  DAMAGED['degenerate partition'](cfg);
  const h = editorWriteHarness({ config: cfg });
  const live = () => h.host._serverCfg.spaces[0];
  // A decor gesture ends in a live mutation and the ordinary deferred write.
  live().decor = [{ id: 'd-text', kind: 'text', x: 0.5, y: 0.5, text: 'Hall' }];
  h.runtime._saveConfig();
  t.mock.timers.tick(499);
  await settle();
  assert.equal(h.activeConfirm(), null, 'nothing happens before the deferred write fires');
  t.mock.timers.tick(1);
  await settle();
  assert.equal(h.server.sets.length, 0, 'config/set is not called');
  assert.deepEqual(ids(live().decor), ['d-text'], 'the edit stays in the live config');
  assert.ok(ids(live().partitions).includes('p-zero'), 'and so does every plan object');
  assert.equal(h.activeConfirm()?.request.message, k3Body({ partitions: 1, columns: 0, openings: 0 }));
  assert.deepEqual(h.toasts, []);

  h.answer(false);
  await settle();
  assert.equal(h.server.sets.length, 0, '«Cancel» sends nothing');
  assert.deepEqual(ids(live().decor), ['d-text'], 'the edit stays local and unsent');
  live().decor.push({ id: 'd-second', kind: 'text', x: 0.6, y: 0.6, text: 'Kitchen' });
  h.runtime._saveConfig();
  t.mock.timers.tick(500);
  await settle();
  assert.equal(h.confirms.length, 2, 'the next edit asks again — no silent «saved»');

  h.answer(true);
  await settle();
  assert.equal(h.server.sets.length, 1, '«Delete and save» is one write');
  assert.deepEqual(ids(h.server.sets[0].spaces[0].decor), ['d-text', 'd-second'], 'with the edits');
  assert.ok(!ids(h.server.sets[0].spaces[0].partitions).includes('p-zero'), 'without R');
  assert.deepEqual(h.toasts, ['toast.geometry_cleanup_done']);

  // Teardown with a non-empty R: no interface to ask in, nothing sent, nothing deleted.
  live().partitions.push({ id: 'p-again', a: [0.7, 0.2], b: [0.7, 0.2], cm: 15 });
  live().decor.push({ id: 'd-third', kind: 'text', x: 0.7, y: 0.7, text: 'Bath' });
  h.runtime._saveConfig();
  h.host.isConnected = false;
  h.host._saveConfigDebounced.flush();
  await settle();
  assert.equal(h.server.sets.length, 1, 'teardown sends nothing');
  assert.equal(h.confirms.length, 2, 'and shows no dialog');
  assert.ok(ids(live().partitions).includes('p-again'));
});

// F57 (ТЗ #842, план автотестов): Undo/Redo may restore a history boundary the
// strict checker reports as `wall-degraded-extra` (`_applyGeometryState(…, true)`).
// The fingerprint registered by that exceptional restore must not stand in for a
// strict check of the outgoing candidate. The boolean merge failure is modelled
// deterministically in the checker, as test/wall-union-isolation.test.mjs does.
test('#842 F57: a boundary restored only as wall-degraded-extra is strictly checked before it can leave the card', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  // A plan already in canonical write form: preparing it changes nothing, so
  // nothing but the strict check itself can stop the restored boundary.
  const canonical = plan();
  delete canonical.spaces[0].wall_columns[0].finish;
  delete canonical.spaces[0].wall_columns[1].label;
  delete canonical.spaces[0].partitions[1].note;
  const h = editorWriteHarness({ config: canonical });
  Object.assign(h.host, { _canCommitSpace: () => true, _activeWallChainId: null });
  h.runtime._clearGeometryGesture = () => {};
  const checked = [];
  h.host._checkSpacePhysicalGeometry = (config, spaceId) => {
    const column = config.spaces.find((space) => space.id === spaceId).wall_columns
      .find((item) => item.id === 'c-square');
    const degraded = column.center[0] === 0.75;
    checked.push(degraded ? 'degraded' : 'ok');
    return degraded ? { ok: false, reason: 'wall-degraded-extra' } : { ok: true };
  };
  const boundary = h.runtime._geometrySnapshot('f1');
  boundary.wall_columns[0].center = [0.75, 0.85];
  assert.equal(h.runtime._applyGeometryState(boundary, true), true, 'Undo restores the repairable boundary locally');
  checked.length = 0;
  t.mock.timers.tick(500);
  await settle();
  assert.deepEqual(checked, ['degraded'], 'the outgoing candidate is strictly checked');
  assert.equal(h.server.sets.length, 0, 'a wall-degraded-extra candidate never leaves the card');
  assert.ok(h.toasts.includes('toast.geometry_unsafe'));
  assert.equal(h.host._serverCfg.spaces[0].wall_columns[0].center[0], 0.7, 'the last strictly checked state is back');
});
