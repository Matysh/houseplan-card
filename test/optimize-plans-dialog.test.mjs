// #642: диалог «Оптимизировать планы» — исполнением через test-build, а не
// текстом монолита. Сюда же переехали 11 утверждений `i18n.test.mjs` о
// разметке и тосте диалога (AC3) и гварды восьми мутантов реестра (AC4).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import ts from 'typescript';

import {
  OptimizePlansDialog, preflightDiagnostics,
} from '../test-build/optimize-plans-dialog.js';
import { formatLatticeShiftCm } from '../test-build/coordinate-canonicalization.js';
import { acquireHaRegistries, haRegistrySnapshot } from '../test-build/ha-binding-status.js';
import { subst } from '../test-build/logic.js';
import { spacePhysicalGeometryFingerprint } from '../test-build/plan-geometry-preflight.js';
import { optimizePlans } from '../test-build/plan-optimizer.js';
import { LazyOptimizePlansDialog } from '../test-build/optimize-plans-loader.js';
import { contentFingerprint } from '../test-build/visual-continuity.js';
import { sameOptimizeSource } from '../test-build/optimize-source.js';
import { OptimizeWriteFailure, optimizeFailure, optimizeFailureDiagnostics } from '../test-build/optimize-feedback.js';
import { renderOptimizeStatus } from '../test-build/optimize-status.js';
import { resolve as resolvePath } from 'node:path';
import { REPO_ROOT, VIEW_ENTRIES, staticGraph } from './helpers/editor-style-ownership.mjs';

const MODULE_SOURCE = readFileSync(new URL('../src/optimize-plans-dialog.ts', import.meta.url), 'utf8');
const BUILT_SOURCE = readFileSync(new URL('../test-build/optimize-plans-dialog.js', import.meta.url), 'utf8');
const feedback = { failure: optimizeFailure, diagnostics: optimizeFailureDiagnostics,
  isWriteFailure: error => error instanceof OptimizeWriteFailure, renderStatus: renderOptimizeStatus };

// ---------------------------------------------------------------- fixtures

const space = (id, title, x) => ({
  id, title, view_box: [0, 0, 1, 1], cell_cm: 5,
  rooms: [{ id: `${id}-room`, name: 'R', area: null, poly: [[0.1, 0.1], [x, 0.1], [x, 0.4], [0.1, 0.4]] }],
});

const report = (patch = {}) => ({
  moved: 0, total: 0, rotated: 0, maxShift: 0, maxShiftCm: 0, maxSpace: '',
  currentPositions: 0, archivedPositions: 0, currentPositionsMoved: 0, archivedPositionsMoved: 0,
  modelFrom: 10, modelTo: 10, migrated: 0, glowSpacesMigrated: 0, glowRoomsMigrated: 0,
  canonicalized: 0, wallSegmentsMigrated: 0, roomDraftsMigrated: 0, roomDraftSegmentsMigrated: 0,
  legacyZeroWallsMigrated: 0, wallsMerged: 0, spansMerged: 0, partitionsMerged: 0,
  partitionsReconciled: 0, openingsRehosted: 0, wallsStraightened: 0, wallsStraightenSkipped: 0,
  maxStraightenShiftCm: 0, maxStraightenSpace: '', coordsCanonicalized: 0,
  latticeCoordinatesCanonicalized: 0, latticeCoordinatesFar: 0, latticeMaxShift: 0,
  latticeMaxShiftCm: 0, latticeSpaces: [],
  spaceRefsRemapped: 0, roomRefsRemapped: 0, positionsRemapped: 0, markersDetached: 0,
  orphanRoomLabelsRemoved: 0, orphanDevicePositionsRemoved: 0, orphanGroupPositionsRemoved: 0,
  liveMissingPositionsRemoved: 0, nestedRefsUnresolved: 0,
  removedPositions: [], liveMissingPositions: [], unverifiedPositions: [],
  invalidPositionsEligible: [], invalidPositionsRemoved: [], invalidPositionsRetained: [],
  registryAuthoritative: true,
  ...patch,
});

const okPreflight = (config) => ({
  fingerprint: contentFingerprint(config), spaces: [], failures: [], ok: true,
});

const failedPreflight = (fingerprint = 'fp-1') => ({
  fingerprint, spaces: [], ok: false,
  failures: [
    { spaceId: 'a', displayName: 'Alpha', status: 'failed', reason: 'wall-exception', detail: 'Error' },
    { spaceId: 'b2', displayName: 'Second', status: 'failed', reason: 'floor-null' },
  ],
});

const dialogOf = (patch = {}) => {
  const config = patch.config ?? { spaces: [space('a', 'Alpha', 0.5)], markers: [], settings: {} };
  return {
    report: report(), config, layout: {}, preflight: okPreflight(config),
    cm: 0, where: '', changed: true, busy: false, removeLiveMissingPositions: false,
    removeInvalidMissingPositions: false, vacuumNames: [],
    source: {
      configRev: 1, layoutRev: 2,
      configFingerprint: contentFingerprint({ spaces: [space('a', 'Alpha', 0.5)], markers: [], settings: {} }),
      layoutFingerprint: contentFingerprint({}), ownersFingerprint: 'owners', connection: null,
    },
    ...patch,
  };
};

/** Фейковый порт: ровно члены `OptimizePlansDialogPort`, каждый считает вызовы. */
function fakePort(overrides = {}, registryRetryMs = undefined) {
  const calls = {
    commit: [], checkGeometry: [], toasts: [], requestUpdate: 0, migration: [],
    gesture: 0, reload: 0, referenceContext: [],
  };
  const state = {
    dialog: null,
    config: { spaces: [space('a', 'Alpha', 0.5)], markers: [], settings: {} },
    integration: null,
  };
  const port = {
    dialog: () => state.dialog,
    setDialog: (next) => { state.dialog = next; },
    t: (key, vars) => (vars ? `${key}${JSON.stringify(vars)}` : key),
    planHost: () => haPlanHost({}),
    config: () => state.config,
    planReady: () => true,
    canWrite: () => true,
    source: () => ({
      configRev: state.configRev ?? 1, layoutRev: state.layoutRev ?? 2,
      configFingerprint: contentFingerprint(state.config),
      layoutFingerprint: contentFingerprint(port.layout()), ownersFingerprint: state.ownersFingerprint ?? 'owners',
      connection: state.connection ?? null,
    }),
    layout: () => ({}),
    integrationVersion: () => state.integration,
    cardVersion: () => '9.9.9',
    requestUpdate: () => { calls.requestUpdate += 1; },
    showToast: (message) => { calls.toasts.push(message); },
    captureToast: () => (message) => { calls.toasts.push(message); },
    support: () => false,
    checkGeometry: (config) => { calls.checkGeometry.push(config); return okPreflight(config); },
    referenceContext: (removeLive, removeInvalid) => { calls.referenceContext.push(removeLive); return {
      removeLiveMissingPositions: removeLive, removeInvalidMissingPositions: removeInvalid,
    }; },
    present: () => undefined,
    clearGeometryGesture: () => { calls.gesture += 1; },
    commit: async (config, layout) => {
      calls.commit.push([config, layout]); state.config = config; state.layout = layout;
      state.configRev = (state.configRev ?? 1) + 1; state.layoutRev = (state.layoutRev ?? 2) + 1;
      return { config, layout, configRev: state.configRev, layoutRev: state.layoutRev, canUndo: true, canonical: true };
    },
    reloadAfterConflict: async () => { calls.reload += 1; return 'adopted'; },
    // #780: strips through walls come from the lazy LED tool; none in this fixture.
    ledNote: () => "",
    ...overrides,
  };
  return { port, calls, state, dialog: new OptimizePlansDialog(port, {
    optimize: optimizePlans, sourceMatches: sameOptimizeSource, registryRetryMs, feedback,
  }) };
}

// ------------------------------------------------------ TemplateResult helpers

const isTemplate = (value) => !!value && typeof value === 'object'
  && Array.isArray(value.strings) && Array.isArray(value.values);

/** Сплющенная разметка: строки шаблона и значения, `nothing` — пусто. */
function flatten(value) {
  if (value == null || value === false || typeof value === 'symbol' || typeof value === 'function') return '';
  if (Array.isArray(value)) return value.map(flatten).join('');
  if (isTemplate(value)) {
    return value.strings.reduce((out, part, index) => (
      out + part + (index < value.values.length ? flatten(value.values[index]) : '')
    ), '');
  }
  return String(value);
}

/** Обработчики `@event=${fn}` вместе с текстом перед ними — чтобы найти кнопку. */
function handlers(value, out = []) {
  if (Array.isArray(value)) { value.forEach((item) => handlers(item, out)); return out; }
  if (!isTemplate(value)) return out;
  value.values.forEach((item, index) => {
    const match = /@([\w-]+)=$/.exec(value.strings[index]);
    // Текст от начала тега до обработчика: по нему кнопка и находится.
    const before = value.strings.slice(0, index + 1).join('');
    const tag = before.slice(before.lastIndexOf('<'));
    if (match && typeof item === 'function') out.push({ event: match[1], before: tag, fn: item });
    else handlers(item, out);
  });
  return out;
}

const handlerFor = (template, event, marker) => handlers(template)
  .find((item) => item.event === event && (!marker || item.before.includes(marker)))?.fn;

/**
 * `navigator` в Node — геттер без сеттера, `t.mock.property` его не
 * восстанавливает. Подменяем дескриптор и возвращаем исходный сами.
 */
function withClipboard(t, clipboard) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: { clipboard }, configurable: true });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'navigator', original);
    else delete globalThis.navigator;
  });
}

// ------------------------------------------------------------- pure helpers

test('#642 preflightDiagnostics: candidate hash, reason, detail, version, fixed clock', () => {
  const candidate = { spaces: [space('a', 'Alpha', 0.6)] };
  const now = new Date('2026-09-24T10:00:00.000Z');
  const block = preflightDiagnostics(failedPreflight(), candidate, { cardVersion: '1.2.3', now });
  assert.equal(block.kind, 'houseplan-optimize-preflight');
  assert.equal(block.origin, 'runtime');
  assert.equal(block.cardVersion, '1.2.3');
  assert.equal(block.checkedAt, '2026-09-24T10:00:00.000Z');
  assert.equal(block.preflightFingerprint, 'fp-1');
  assert.deepEqual(block.failures.map((failure) => [failure.spaceId, failure.reason, failure.detail]), [
    ['a', 'wall-exception', 'Error'], ['b2', 'floor-null', null],
  ]);
  assert.equal(block.failures[0].spaceGeometryFingerprint, spacePhysicalGeometryFingerprint(candidate.spaces[0]));
  assert.equal(block.failures[1].spaceGeometryFingerprint, null, 'a space missing from the candidate has no hash');
  // Смок передаёт кандидата не всегда; блок всё равно собирается.
  assert.equal(preflightDiagnostics(failedPreflight(), undefined, { cardVersion: 'x', now }).failures[0]
    .spaceGeometryFingerprint, null);
});

// ------------------------------------------------------------------ preview

test('#1170 preview: an exception stays in the dialog rather than a circular migration toast', () => {
  const boom = new Error('wall model');
  const { dialog, calls, state } = fakePort({ referenceContext: () => { throw boom; } });
  dialog.preview(false);
  assert.deepEqual(calls.migration, []);
  assert.equal(state.dialog.phase, 'failure');
  assert.equal(state.dialog.failure.kind, 'prepare');
  assert.doesNotMatch(flatten(dialog.render()), /wall model|wall_model_migration_blocked/);
});

test('#642 preview: nothing without a plan or a saved config', () => {
  const noPlan = fakePort({ planReady: () => false });
  noPlan.dialog.open();
  assert.equal(noPlan.state.dialog, null);
  const noConfig = fakePort();
  noConfig.state.config = null;
  noConfig.dialog.open();
  assert.equal(noConfig.state.dialog, null);
  assert.deepEqual(noConfig.calls.referenceContext, []);
});

test('#642 preview: cm is rounded UP, the space is named only when there are several', () => {
  const two = fakePort();
  two.state.config = { spaces: [space('a', 'Alpha', 0.5), space('b', 'Beta', 0.50337)], markers: [], settings: {} };
  two.dialog.preview(false);
  const d = two.state.dialog;
  assert.equal(d.changed, true);
  assert.equal(d.report.maxSpace, 'b');
  assert.equal(d.cm, Math.ceil(d.report.maxShiftCm * 10) / 10);
  assert.ok(d.cm >= d.report.maxShiftCm, 'the promise is never smaller than the deed');
  assert.equal(d.where, 'Beta');
  assert.equal(d.busy, false);
  assert.equal(d.removeLiveMissingPositions, false);
  assert.deepEqual(two.calls.checkGeometry, [d.config], 'a changed candidate is preflighted');
  assert.deepEqual(two.calls.referenceContext, [false]);

  const one = fakePort();
  one.state.config = { spaces: [space('b', 'Beta', 0.50337)], markers: [], settings: {} };
  one.dialog.preview(false);
  assert.equal(one.state.dialog.where, '');
});

test('#642 toggleLivePositions re-previews with the flag flipped, only when live positions exist', () => {
  const { dialog, state, calls } = fakePort();
  state.dialog = dialogOf();
  dialog.toggleLivePositions();
  assert.deepEqual(calls.referenceContext, [], 'no live-missing positions — nothing to toggle');
  state.dialog = dialogOf({ report: report({ liveMissingPositions: [{ id: 'm', name: 'Lamp', kind: 'device', spaceId: 'a' }] }) });
  dialog.toggleLivePositions();
  assert.deepEqual(calls.referenceContext, [true]);
  assert.equal(state.dialog.removeLiveMissingPositions, true);
});

// --------------------------------------------------------------------- run

test('#1246 Optimize retains its action toast callback across an awaited failure',async()=>{
  let active='optimize',reject;const messages=[];
  const {dialog,state}=fakePort({
    captureToast:()=>{const owner=active;return message=>messages.push({owner,message});},
    commit:()=>new Promise((_,fail)=>{reject=fail;}),
  });
  state.dialog=dialogOf();
  const pending=dialog.run();await Promise.resolve();active='nested-confirm';reject(new Error('refused'));await pending;
  assert.deepEqual(messages,[{owner:'optimize',message:'gs.optimize_unknown_title'}]);
});

test('#642 open: preview never writes, and cancel closes without a write', async () => {
  const { dialog, state, calls } = fakePort();
  state.config = { spaces: [space('a', 'Alpha', 0.5), space('b', 'Beta', 0.50337)], markers: [], settings: {} };
  dialog.open();
  await Promise.resolve();
  assert.ok(state.dialog?.changed && state.dialog.preflight?.ok, 'a writable preview is open');
  assert.deepEqual(calls.commit, [], 'opening the preview must not persist anything');
  handlerFor(dialog.render(), 'click', 'data-hp="dialog-cancel"')();
  assert.equal(state.dialog, null);
  assert.deepEqual(calls.commit, []);
});

test('#642 run: red preflight is a hard write barrier', async () => {
  const { dialog, state, calls } = fakePort();
  state.dialog = dialogOf({ preflight: failedPreflight() });
  await dialog.run();
  assert.deepEqual(calls.commit, []);
  assert.equal(calls.gesture, 0);
  state.dialog = dialogOf({ changed: false });
  await dialog.run();
  state.dialog = dialogOf({ busy: true });
  await dialog.run();
  assert.deepEqual(calls.commit, [], 'unchanged or busy dialogs do not write either');
});

test('#642 run: a stale fingerprint is rechecked, and a red recheck stops the write', async () => {
  const red = failedPreflight('fresh');
  const { dialog, state, calls } = fakePort({
    checkGeometry: (config) => { calls.checkGeometry.push(config); return red; },
  });
  const warns = [];
  const original = console.warn;
  console.warn = (...args) => { warns.push(args); };
  try {
    state.dialog = dialogOf({ preflight: { ...okPreflight({}), fingerprint: 'stale' } });
    const candidate = state.dialog.config;
    await dialog.run();
    assert.deepEqual(calls.checkGeometry, [candidate]);
    assert.equal(state.dialog.preflight, red, 'the dialog now shows the fresh refusal');
    assert.deepEqual(calls.commit, []);
    assert.equal(warns.length, 1, 'the fresh refusal is dev-logged');
  } finally {
    console.warn = original;
  }
});

test('#1170 run: success writes the exact pair and retains its report without summing overlapping counters', async () => {
  const seen = [];
  const { dialog, state, calls } = fakePort({
    commit: async (config, layout) => {
      seen.push(state.dialog?.busy); calls.commit.push([config, layout]);
      state.config = config; state.layout = layout;
      state.configRev = (state.configRev ?? 1) + 1; state.layoutRev = (state.layoutRev ?? 2) + 1;
      return { config, layout, configRev: state.configRev, layoutRev: state.layoutRev, canUndo: true, canonical: true };
    },
  });
  state.dialog = dialogOf({ report: report({ moved: 2, latticeCoordinatesCanonicalized: 7, orphanRoomLabelsRemoved: 1 }) });
  const { config, layout } = state.dialog;
  await dialog.run();
  assert.equal(calls.gesture, 1);
  assert.deepEqual(seen, [true], 'busy while the write is in flight');
  assert.equal(calls.commit.length, 1);
  assert.equal(calls.commit[0][0], config);
  assert.equal(calls.commit[0][1], layout);
  assert.deepEqual(calls.checkGeometry, [], 'an unchanged fingerprint is not rechecked');
  assert.equal(state.dialog.phase, 'result');
  assert.equal(state.dialog.report.moved, 2);
  assert.equal(state.dialog.report.latticeCoordinatesCanonicalized, 7);
  assert.deepEqual(calls.toasts, ['gs.optimize_saved_title']);
});

test('#642 run: conflict reloads both stores; outdated client gets its own toast', async () => {
  const conflict = fakePort({ commit: async () => { throw new OptimizeWriteFailure({ code: 'conflict' }, 'dispatched'); } });
  conflict.state.dialog = dialogOf();
  await conflict.dialog.run();
  assert.equal(conflict.calls.reload, 1);
  assert.equal(conflict.state.dialog.busy, false, 'the dialog stays open and usable');
  assert.deepEqual(conflict.calls.toasts, ['gs.optimize_failed_title']);

  const outdated = fakePort({ commit: async () => { throw new OptimizeWriteFailure({ code: 'wall_model_client_outdated' }, 'before-dispatch'); } });
  outdated.state.dialog = dialogOf();
  await outdated.dialog.run();
  assert.equal(outdated.calls.reload, 0);
  assert.deepEqual(outdated.calls.toasts, ['gs.optimize_failed_title']);
  assert.equal(outdated.state.dialog.failure.kind, 'version');
});

// -------------------------------------------------------------- diagnostics

test('#642 copyDiagnostics hashes the candidate, not the saved config', async (t) => {
  const { dialog, state, calls } = fakePort();
  const candidate = { spaces: [space('a', 'Alpha', 0.6)], markers: [], settings: {} };
  state.config = { spaces: [space('a', 'Alpha', 0.5)], markers: [], settings: {} };
  state.dialog = dialogOf({ config: candidate, preflight: failedPreflight() });
  let copied = null;
  withClipboard(t, { writeText: async (text) => { copied = text; } });
  await dialog.copyDiagnostics();
  const block = JSON.parse(copied);
  assert.equal(block.failures[0].spaceGeometryFingerprint, spacePhysicalGeometryFingerprint(candidate.spaces[0]));
  assert.notEqual(block.failures[0].spaceGeometryFingerprint, spacePhysicalGeometryFingerprint(state.config.spaces[0]));
  assert.equal(block.cardVersion, '9.9.9');
  assert.deepEqual(calls.toasts, ['gs.preflight_copied']);
  assert.equal(dialog.clipboardFallback, null);
});

test('#642 copyDiagnostics: the inline fallback belongs to one dialog showing', async (t) => {
  const { dialog, state, calls } = fakePort();
  withClipboard(t, { writeText: async () => { throw new Error('denied'); } });
  state.dialog = dialogOf({ preflight: failedPreflight() });
  await dialog.copyDiagnostics();
  assert.match(dialog.clipboardFallback, /houseplan-optimize-preflight/);
  assert.equal(calls.requestUpdate, 1, 'the fallback is not @state — the module asks for the render');
  assert.match(flatten(dialog.render()), /<pre[^>]*>\{\n {2}"kind": "houseplan-optimize-preflight"/);
  // Закрытие настоящим обработчиком hp-close.
  handlerFor(dialog.render(), 'hp-close')();
  assert.equal(state.dialog, null);
  assert.equal(dialog.clipboardFallback, null);
  // Новый отказ — новый объект диалога — без JSON прошлого отказа.
  state.dialog = dialogOf({ preflight: failedPreflight('fp-2') });
  assert.equal(dialog.clipboardFallback, null);
  assert.doesNotMatch(flatten(dialog.render()), /<pre/);
});

test('#642 copyDiagnostics does nothing for a green or missing preflight', async (t) => {
  const { dialog, state, calls } = fakePort();
  let writes = 0;
  withClipboard(t, { writeText: async () => { writes += 1; } });
  await dialog.copyDiagnostics();
  state.dialog = dialogOf();
  await dialog.copyDiagnostics();
  assert.equal(writes, 0);
  assert.deepEqual(calls.toasts, []);
});

test('#642 reportPreflightFailure logs one structured record per distinct fingerprint', () => {
  const { dialog } = fakePort();
  const warns = [];
  const original = console.warn;
  console.warn = (...args) => { warns.push(args); };
  try {
    dialog.reportPreflightFailure(failedPreflight('fp-1'), null);
    dialog.reportPreflightFailure(failedPreflight('fp-1'), null);
    dialog.reportPreflightFailure({ ...okPreflight({}), fingerprint: 'fp-ok' }, null);
    assert.equal(warns.length, 1, 'dedup: the same fingerprint logs once, a green one never');
    assert.equal(warns[0][0], '[houseplan] optimize preflight failed');
    assert.equal(warns[0][1].kind, 'houseplan-optimize-preflight');
    assert.equal(warns[0][1].failures[0].reason, 'wall-exception');
    dialog.reportPreflightFailure(failedPreflight('fp-2'), null);
    assert.equal(warns.length, 2);
  } finally {
    console.warn = original;
  }
});

// ------------------------------------------------------------------ render

test('#642 render: changes — every counter, lattice lines and orphan report (i18n.test AC3)', () => {
  const { dialog, state } = fakePort();
  state.config = { spaces: [space('a', 'Alpha', 0.5), space('b', 'Beta', 0.5)], markers: [], settings: {} };
  const r = report({
    moved: 2, total: 9, coordsCanonicalized: 3, partitionsMerged: 5, migrated: 1, canonicalized: 4,
    wallsMerged: 6, spansMerged: 8, partitionsReconciled: 2, openingsRehosted: 1,
    legacyZeroWallsMigrated: 1, latticeCoordinatesCanonicalized: 4, latticeMaxShiftCm: 0.0123,
    latticeSpaces: [{ space: 'Alpha', canonicalized: 4, far: 1 }],
    orphanRoomLabelsRemoved: 1, orphanDevicePositionsRemoved: 2, orphanGroupPositionsRemoved: 0,
    removedPositions: [{ id: 'dev1', kind: 'device', spaceId: 'gone' }],
    wallsStraightened: 1, maxStraightenShiftCm: 1.23, maxStraightenSpace: 'b',
  });
  state.dialog = dialogOf({ report: r, cm: 1.5, where: 'Beta' });
  const text = flatten(dialog.render());
  assert.match(text, /gs\.align_count\{"n":"2","total":"9","cm":"1.5"\}/);
  assert.match(text, /gs\.align_where\{"s":"Beta"\}/);
  assert.match(text, /gs\.zero_walls_migrated\{"n":"1"\}/);
  // p — шум координат, i — независимые стены (#229): счётчики показываются, а не копятся молча.
  assert.match(text, /gs\.optimize_changes\{"m":"1","c":"4","p":"3","w":"6","s":"8","i":"5"\}/);
  assert.match(text, /gs\.optimize_coincident_partitions\{"n":"2"\}/);
  assert.match(text, /gs\.optimize_openings_rehosted\{"n":"1"\}/);
  assert.ok(text.includes(`gs.optimize_lattice_summary{"n":"4","cm":"${formatLatticeShiftCm(0.0123)}"}`));
  assert.match(text, /gs\.optimize_lattice_space\{"space":"Alpha","n":"4","far":"1"\}/);
  assert.match(text, /gs\.optimize_walls_straightened\{"n":"1","cm":"1.3"\}/);
  assert.match(text, /gs\.optimize_walls_straightened_where\{"s":"Beta"\}/);
  assert.match(text, /gs\.optimize_orphans_removed\{"total":"3","rooms":"1","devices":"2","groups":"0"\}/);
  assert.match(text, /<details class="optimize-details">/);
  assert.match(text, /gs\.align_warn/);
  assert.doesNotMatch(text, /gs\.optimize_reference_warning/);
  assert.match(text, /data-hp="dialog-confirm"/);
});

test('#642 render: failed preflight names each reason and offers no Apply', () => {
  const { dialog, state } = fakePort();
  state.dialog = dialogOf({ preflight: failedPreflight() });
  const text = flatten(dialog.render());
  assert.match(text, /gs\.align_preflight_failed\{"spaces":"Alpha, Second","more":""\}/);
  assert.match(text, /Alpha: gs\.preflight_reason_wall-exception/);
  assert.match(text, /Second: gs\.preflight_reason_floor-null/);
  assert.match(text, /gs\.preflight_copy/);
  assert.doesNotMatch(text, /data-hp="dialog-confirm"/, 'the failure state is not a dismissible warning');
  assert.doesNotMatch(text, /gs\.preflight_update_hint/);
  state.integration = '0.0.1-other';
  assert.doesNotMatch(flatten(dialog.render()), /gs\.preflight_update_hint/, 'different version strings alone do not prove incompatibility');
});

test('#642 render: nothing to do — plain «none» or «no automatic changes», never Apply', () => {
  const { dialog, state } = fakePort();
  state.dialog = dialogOf({ changed: false, preflight: null });
  let text = flatten(dialog.render());
  assert.match(text, /gs\.align_none/);
  assert.doesNotMatch(text, /data-hp="dialog-confirm"/);
  state.dialog = dialogOf({ changed: false, preflight: null, report: report({ nestedRefsUnresolved: 2 }) });
  text = flatten(dialog.render());
  assert.match(text, /gs\.optimize_no_automatic_changes/);
  assert.match(text, /gs\.optimize_vacuum_warning\{"n":"2"\}/);
});

test('#642 render: live positions — names, toggle state and the selected hint', () => {
  const { dialog, state, calls } = fakePort();
  const live = ['A', 'B', 'C', 'D'].map((name, index) => ({ id: `m${index}`, name, kind: 'device', spaceId: 'a' }));
  state.dialog = dialogOf({ report: report({ liveMissingPositions: live }) });
  let text = flatten(dialog.render());
  assert.ok(text.includes('gs.optimize_live_positions{"n":"4","names":"gs.optimize_live_names{\\"names\\":\\"A, B, C\\",\\"more\\":\\"gs.optimize_reference_more{\\\\\\"n\\\\\\":\\\\\\"1\\\\\\"}\\"}"}'));
  assert.match(text, /aria-pressed=false/);
  assert.match(text, /gs\.optimize_live_remove/);
  assert.doesNotMatch(text, /gs\.optimize_live_selected/);
  state.dialog = { ...state.dialog, removeLiveMissingPositions: true };
  text = flatten(dialog.render());
  assert.match(text, /gs\.optimize_live_positions_remove/);
  assert.match(text, /aria-pressed=true/);
  assert.match(text, /gs\.optimize_live_keep/);
  assert.match(text, /gs\.optimize_live_selected/);
  handlerFor(dialog.render(), 'click', 'optimize-cleanup')();
  assert.deepEqual(calls.referenceContext, [false], 'the toggle re-previews with the flag flipped back');
});

test('#642 render: details list at most ten items, statuses by kind, and the remainder', () => {
  const { dialog, state } = fakePort();
  const removed = Array.from({ length: 8 }, (_, index) => ({ id: `r${index}`, kind: 'room_label', spaceId: 'x' }));
  const unverified = Array.from({ length: 4 }, (_, index) => ({
    id: `u${index}`, kind: index ? 'group' : 'mystery', spaceId: 'y', reason: 'registry_unavailable',
  }));
  state.dialog = dialogOf({ report: report({
    removedPositions: removed, unverifiedPositions: unverified, registryAuthoritative: false,
  }) });
  const text = flatten(dialog.render());
  const details = text.slice(text.indexOf('<details class="optimize-details">'));
  assert.equal(details.split('<li>').length - 1, 10);
  assert.match(text, /gs\.optimize_detail_item\{"status":"gs\.optimize_detail_removed","kind":"gs\.optimize_detail_room_label","id":"r0","space":"x"\}/);
  assert.match(text, /gs\.optimize_detail_item\{"status":"gs\.optimize_detail_unverified","kind":"gs\.optimize_detail_unknown","id":"u0","space":"y"\}/);
  assert.match(text, /gs\.optimize_details_more\{"n":"2"\}/);
  // #869: the block counts every record; the registry line follows the analysis.
  assert.match(text, /gs\.optimize_unverified\{"n":"4"\}/);
  assert.match(text, /gs\.optimize_registry_limited/);
});

// ------------------------------------------------------------ AC2: the port

const parsedModule = ts.createSourceFile('optimize-plans-dialog.ts', MODULE_SOURCE, ts.ScriptTarget.Latest, true);
const portMembers = () => {
  const port = parsedModule.statements.find((statement) => ts.isInterfaceDeclaration(statement)
    && statement.name.text === 'OptimizePlansDialogPort');
  assert.ok(port, 'the module declares its own port');
  return port.members.map((member) => member.name.getText(parsedModule)).sort();
};

test('#642 AC2: the dialog port is narrow and the module never reaches the editor host', () => {
  // Импорты — и типовые тоже: `import type` стирается в сборке, поэтому
  // разбирается исходник модуля, а собранный файл проверяется отдельно.
  const specifiers = parsedModule.statements
    .filter((statement) => ts.isImportDeclaration(statement))
    .map((statement) => statement.moduleSpecifier.text);
  const host = /\/houseplan-(?:card|editor-runtime)$/;
  assert.deepEqual(specifiers.filter((specifier) => host.test(specifier)), []);
  const identifiers = new Set();
  const walk = (node) => {
    if (ts.isIdentifier(node)) identifiers.add(node.text);
    ts.forEachChild(node, walk);
  };
  walk(parsedModule);
  assert.equal(identifiers.has('HouseplanEditorHostPort'), false, 'the wide editor port is not referenced');
  assert.equal(identifiers.has('host'), false, 'no `host` field or parameter — only the narrow port');
  assert.doesNotMatch(BUILT_SOURCE, /houseplan-(?:card|editor-runtime)\.js/);

  const members = portMembers();
  // #898, решение владельца 14.10.2026: запас меньше 10 % → +10 % (20 → 22).
  assert.ok(members.length <= 22, `port has ${members.length} members`);
  const { port, dialog } = fakePort();
  assert.ok(Object.keys(port).length <= 22);
  assert.deepEqual(Object.keys(port).sort(), members, 'the fake port is exactly the declared port');
  assert.equal('host' in dialog, false);
});

// ------------------------------------------- #869: unverified position records

const dictionaryOf = (path) => JSON.parse(readFileSync(new URL(`../src/i18n/${path}`, import.meta.url), 'utf8'));
// Основной каталог карточки плюс ленивый `settings`, куда #869 положил строки
// блока: это ровно то, что видит диалог через порт загрузчика.
const RU = { ...dictionaryOf('ru.json'), ...dictionaryOf('settings/ru.json') };
const EN = { ...dictionaryOf('en.json'), ...dictionaryOf('settings/en.json') };
/** Настоящие строки словаря с той же подстановкой, что у карточки. */
const translator = (dictionary) => (key, vars) => subst(dictionary[key] ?? key, vars);
const OPAQUE = '601413c5793c698f73b8af0a0b93cac6';

const plainText = (markup) => markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
/** Текст диалога без закрытых «Подробностей». */
const mainText = (template) => {
  const markup = flatten(template);
  const details = markup.indexOf('<details class="optimize-details">');
  return plainText(details < 0 ? markup : markup.slice(0, details));
};
const detailsText = (template) => {
  const markup = flatten(template);
  return plainText(markup.slice(markup.indexOf('<details class="optimize-details">')));
};
/** Кнопки по порядку: подпись и признак `?disabled`. */
const buttons = (template) => [...flatten(template).matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)]
  .map(([, attributes, label]) => ({
    label: plainText(label), disabled: /\?disabled=true/.test(attributes), attributes,
  }));
const unverifiedBlock = (template) => {
  const markup = flatten(template);
  const start = markup.indexOf('<div class="optimize-unverified">');
  return start < 0 ? '' : markup.slice(start, markup.indexOf('<details class="optimize-details">', start));
};

/** Идемпотентная база: результат одного Optimize, второй прогон ничего не меняет. */
const optimalConfig = () => structuredClone(optimizePlans({
  spaces: [{
    id: 'home', title: 'Дом', view_box: [0, 0, 1, 1], cell_cm: 5,
    rooms: [{ id: 'r1', name: 'Кухня', area: 'kitchen', poly: [[0.1, 0.1], [0.5, 0.1], [0.5, 0.4], [0.1, 0.4]] }],
  }],
  markers: [], settings: {},
}, {}, { ownerRoster: { authoritative: true } }).config);
const ownerLayout = () => ({
  grp_detskaia_elina: { s: 'f2', x: 0.25, y: 0.25 },
  grp_detskaia_maiia: { s: 'f2', x: 0.5, y: 0.5 },
  [OPAQUE]: { s: 'smrnf8s7x', x: 0.75, y: 0.75 },
});
const roster = (authoritative, deviceIds = []) => ({
  ownerRoster: { authoritative, deviceIds, entityIds: [], names: {} },
});

/** Порт поверх настоящего optimizePlans: план, раскладка и реестр задаёт тест. */
function realPort({ dictionary = RU, config, layout, context, hass = {}, retryMs } = {}) {
  const made = fakePort({
    t: translator(dictionary),
    planHost: () => haPlanHost(hass),
    layout: () => layout,
    referenceContext: (removeLive, removeInvalid) => {
      made.calls.referenceContext.push(removeLive);
      return { ...context(), removeLiveMissingPositions: removeLive, removeInvalidMissingPositions: removeInvalid };
    },
  }, retryMs);
  made.state.config = config;
  return made;
}

/** Транспорт HA для настоящего `ha-binding-status`: ответ задаёт тест. */
function registryHass(respond) {
  const sent = [];
  return {
    sent,
    connection: { subscribeEvents: async () => () => {} },
    devices: {}, entities: {}, states: {},
    callWS: async (message) => { sent.push(message.type); return respond(message); },
  };
}
const rosterOf = (hass) => {
  const snapshot = haRegistrySnapshot(hass);
  return roster(snapshot.authoritative, Object.keys(snapshot.devices || {}));
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const refused = () => { throw Object.assign(new Error('timeout'), { code: 'timeout' }); };
const registryRows = (message) => (message.type === 'config/device_registry/list' ? [{ id: OPAQUE }] : []);

test('#869 AC1 owner example: a plain summary, why it is safe, groups by cause, Copy and Close', () => {
  for (const [lang, dictionary] of [['ru', RU], ['en', EN]]) {
    const tr = translator(dictionary);
    for (const areas of [undefined, { detskaia_elina: { area_id: 'detskaia_elina', name: 'Детская Элины' } }]) {
      const config = optimalConfig();
      const layout = ownerLayout();
      const result = optimizePlans(config, layout, roster(true));
      assert.equal(result.changed, false, lang);
      assert.equal(JSON.stringify(result.layout), JSON.stringify(layout), `${lang}: layout byte-for-byte`);

      const { dialog, state, calls } = realPort({
        dictionary, config, layout, context: () => roster(true), hass: areas ? { areas } : {},
      });
      dialog.open();
      assert.equal(state.dialog.changed, false);
      const template = dialog.render();
      const text = mainText(template);
      const label = `${lang}/${areas ? 'area' : 'no area'}`;
      assert.ok(text.startsWith(tr('gs.optimize_no_changes')), label);
      assert.equal(text.includes(tr('gs.optimize_no_automatic_changes')), false, `${label}: no «review below»`);
      assert.doesNotMatch(text, /Проверьте|Review the items/, label);
      assert.ok(text.includes(tr('gs.optimize_unverified', { n: '3' })), label);
      assert.ok(text.includes(tr('gs.optimize_unverified_safe')), label);
      const names = areas ? tr('gs.optimize_live_names', { names: 'Детская Элины', more: '' }) : '';
      assert.ok(text.includes(tr('gs.optimize_unverified_legacy', { n: '2', names })), `${label}: ${text}`);
      assert.ok(text.includes(tr('gs.optimize_unverified_unknown', { n: '1' })), label);
      assert.equal(text.includes(tr('gs.optimize_unverified_unchecked', { n: '0' })), false, label);
      assert.equal(text.includes(tr('gs.optimize_registry_limited')), false, `${label}: full registry`);
      assert.doesNotMatch(text, new RegExp(`grp_detskaia|${OPAQUE}|smrnf8s7x`), `${label}: ids only in Details`);
      assert.deepEqual(buttons(template).map((button) => button.label),
        [tr('gs.preflight_copy'), tr('gs.optimize_invalid_remove'), tr('btn.close')], label);
      assert.doesNotMatch(flatten(template), /data-hp="dialog-confirm"/);
      assert.doesNotMatch(unverifiedBlock(template), /role="alert"/, `${label}: the block is not an alert`);
      assert.deepEqual(calls.commit, []);
    }
  }
});

test('#869 AC1 summary: «no automatic changes» keeps «review below» only for live owners or the vacuum', () => {
  const { dialog, state } = fakePort();
  const unverified = [{ id: 'x', kind: 'unknown', name: '', spaceId: 'gone', reason: 'unknown_owner' }];
  state.dialog = dialogOf({ changed: false, preflight: null, report: report({ unverifiedPositions: unverified }) });
  assert.match(flatten(dialog.render()), /gs\.optimize_no_changes/);
  assert.match(flatten(dialog.render()), /btn\.close/);
  state.dialog = dialogOf({ changed: false, preflight: null, report: report({
    unverifiedPositions: unverified, nestedRefsUnresolved: 1,
  }) });
  assert.match(flatten(dialog.render()), /gs\.optimize_no_automatic_changes/);
  state.dialog = dialogOf({ changed: false, preflight: null, report: report({
    unverifiedPositions: unverified, liveMissingPositions: [{ id: 'm', kind: 'device', name: 'Lamp', spaceId: 'gone' }],
  }) });
  assert.match(flatten(dialog.render()), /gs\.optimize_no_automatic_changes/);
  state.dialog = dialogOf({ report: report({ moved: 1, total: 2, unverifiedPositions: unverified }) });
  const changed = flatten(dialog.render());
  assert.match(changed, /btn\.cancel/, 'something to apply — the footer still cancels');
  assert.match(changed, /optimize-copy/, 'the copy action follows the block, not «changed»');
});

test('#869 AC3 incomplete HA data: line and «Check again» even for unknown owners; a full reload re-runs the preview', async (t) => {
  let respond = refused;
  const hass = registryHass((message) => respond(message));
  t.after(acquireHaRegistries(hass, () => {}));
  await sleep(10);
  assert.equal(haRegistrySnapshot(hass).access, 'limited');
  const layout = { [OPAQUE]: { s: 'gone', x: 0.25, y: 0.25 } };
  const { dialog, state, calls } = realPort({
    config: optimalConfig(), layout, hass, context: () => rosterOf(hass),
  });
  dialog.open();
  const before = state.dialog;
  assert.equal(before.report.registryAuthoritative, false);
  assert.deepEqual(before.report.unverifiedPositions.map((item) => item.reason), ['unknown_owner']);
  let template = dialog.render();
  assert.ok(mainText(template).includes(RU['gs.optimize_registry_limited']));
  assert.match(unverifiedBlock(template), /<div class="optimize-registry" role="status">/);
  assert.deepEqual(buttons(template).map((button) => button.label),
    [RU['gs.optimize_retry'], RU['gs.preflight_copy'], RU['gs.optimize_invalid_remove'], RU['btn.close']]);
  assert.equal(buttons(template).find(button => /optimize-invalid-cleanup/.test(button.attributes))?.disabled,
    true, 'retained-only cleanup remains discoverable but cannot be selected');

  respond = registryRows;
  const retry = handlerFor(template, 'click', 'optimize-retry')();
  assert.equal(state.dialog.retrying, true);
  assert.equal(buttons(dialog.render())[0].disabled, true, 'the button is inactive while checking');
  await retry;
  assert.notEqual(state.dialog, before, 'a new report, built by the same preview');
  assert.equal(state.dialog.report.registryAuthoritative, true);
  assert.deepEqual(state.dialog.report.liveMissingPositions.map((item) => item.id), [OPAQUE]);
  assert.deepEqual(state.dialog.report.unverifiedPositions, []);
  template = dialog.render();
  assert.equal(buttons(template).some((button) => button.label === RU['gs.optimize_retry']), false,
    'a complete registry offers no retry');
  assert.deepEqual(calls.referenceContext, [false, false]);
  assert.deepEqual(calls.commit, []);
  assert.ok(hass.sent.every((type) => type.startsWith('config/')), 'nothing but registry reads');
});

test('#869 AC3 a refused or hung reload keeps the same report and says the data is still missing', async (t) => {
  let respond = refused;
  const hass = registryHass((message) => respond(message));
  t.after(acquireHaRegistries(hass, () => {}));
  await sleep(10);
  const { dialog, state } = realPort({
    config: optimalConfig(), layout: ownerLayout(), hass, context: () => rosterOf(hass), retryMs: 250,
  });
  assert.equal(new OptimizePlansDialog(fakePort().port, { optimize: optimizePlans, sourceMatches: sameOptimizeSource, feedback }).registryRetryMs, 10_000,
    'default wait is 10 s');
  dialog.open();
  const before = state.dialog;
  // Refused at once: no wait for the timeout.
  await handlerFor(dialog.render(), 'click', 'optimize-retry')();
  assert.equal(state.dialog.report, before.report, 'the same report');
  assert.equal(state.dialog.retryFailed, true);
  assert.equal(state.dialog.retrying, false);
  let template = dialog.render();
  assert.ok(mainText(template).includes(RU['gs.optimize_registry_still_limited']));
  assert.match(unverifiedBlock(template), new RegExp(`role="status">[\\s\\S]*${RU['gs.optimize_registry_still_limited']}`));
  assert.equal(buttons(template)[0].disabled, false, 'the button is available again');
  // Hung: bounded by the dialog's wait.
  respond = () => new Promise(() => {});
  const started = Date.now();
  await handlerFor(template, 'click', 'optimize-retry')();
  assert.ok(Date.now() - started < 2_000, 'the wait is bounded');
  assert.equal(state.dialog.report, before.report);
  assert.equal(state.dialog.retryFailed, true);
  template = dialog.render();
  assert.ok(mainText(template).includes(RU['gs.optimize_registry_still_limited']));
  assert.equal(buttons(template)[0].disabled, false);
});

test('#869 AC4 a late re-check answer after close or reopen changes nothing, and nothing writes', async (t) => {
  for (const reopen of [false, true]) {
    let respond = refused;
    const gate = [];
    const hass = registryHass((message) => respond(message));
    t.after(acquireHaRegistries(hass, () => {}));
    await sleep(10);
    const { dialog, state, calls } = realPort({
      config: optimalConfig(), layout: { [OPAQUE]: { s: 'gone', x: 0.25, y: 0.25 } },
      hass, context: () => rosterOf(hass),
    });
    dialog.open();
    respond = (message) => new Promise((resolve) => gate.push(() => resolve(registryRows(message))));
    const retry = handlerFor(dialog.render(), 'click', 'optimize-retry')();
    await sleep(120);
    assert.equal(gate.length, 2, 'both registries were asked once');
    // Esc and the scrim both arrive as hp-close.
    handlerFor(dialog.render(), 'hp-close')();
    assert.equal(state.dialog, null);
    let reopened = null;
    if (reopen) {
      dialog.open();
      reopened = state.dialog;
    }
    gate.forEach((release) => release());
    await retry;
    assert.equal(state.dialog, reopened, reopen ? 'the reopened dialog keeps its report' : 'no window appears');
    if (reopen) assert.equal(state.dialog.report.registryAuthoritative, false);
    assert.deepEqual(calls.commit, []);
    assert.ok(hass.sent.every((type) => type.startsWith('config/')));
  }
});

test('#869 AC4 while checking, Optimize and the old-positions switch are unavailable', async () => {
  const { dialog, state, calls } = fakePort();
  const live = [{ id: 'm', kind: 'device', name: 'Lamp', spaceId: 'gone' }];
  const unverified = [{ id: 'x', kind: 'unknown', name: '', spaceId: 'gone', reason: 'unknown_owner' }];
  state.dialog = dialogOf({
    retrying: true,
    report: report({ moved: 1, total: 2, liveMissingPositions: live, unverifiedPositions: unverified, registryAuthoritative: false }),
  });
  const template = dialog.render();
  const disabled = Object.fromEntries(buttons(template).map((button) => [
    /data-hp="dialog-confirm"/.test(button.attributes) ? 'apply'
      : /optimize-cleanup/.test(button.attributes) ? 'switch'
      : /optimize-retry/.test(button.attributes) ? 'retry' : button.label,
    button.disabled,
  ]));
  assert.equal(disabled.apply, true);
  assert.equal(disabled.switch, true);
  assert.equal(disabled.retry, true);
  const pending = state.dialog;
  await dialog.run();
  dialog.toggleLivePositions();
  await dialog.retryRegistry();
  assert.equal(state.dialog, pending);
  assert.deepEqual(calls.commit, []);
  assert.deepEqual(calls.referenceContext, []);
});

test('#869 AC4 Apply keeps unverified records and only snaps their coordinates', async () => {
  const layout = { grp_old: { s: 'f2', x: 0.123456, y: 0.5 } };
  const { dialog, state, calls } = realPort({
    config: optimalConfig(), layout, context: () => roster(true),
  });
  dialog.open();
  assert.equal(state.dialog.changed, true);
  assert.deepEqual(state.dialog.report.unverifiedPositions.map((item) => item.kind), ['legacy_group']);
  await dialog.run();
  assert.equal(calls.commit.length, 1);
  const written = calls.commit[0][1];
  assert.deepEqual(Object.keys(written), ['grp_old'], 'neither removed nor renamed');
  assert.equal(written.grp_old.s, 'f2');
  assert.equal(written.grp_old.y, 0.5);
  assert.notEqual(written.grp_old.x, 0.123456, 'grid snapping as for any position');
});

const twelveRecords = () => Array.from({ length: 12 }, (_, index) => (index < 5
  ? { id: `grp_area_${index}`, spaceId: 'f2', kind: 'legacy_group', name: '', reason: 'legacy_group' }
  : index < 9
    ? { id: `opaque-${index}`, spaceId: 'gone', kind: 'unknown', name: '', reason: 'unknown_owner' }
    : { id: `lg_light.secret_${index}`, spaceId: 'gone', kind: 'group', name: 'Secret lamp', reason: 'registry_unavailable' }));

test('#869 AC5 diagnostics: every record by cause, versions and registry, without names or coordinates', async (t) => {
  const { dialog, state, calls } = fakePort();
  state.integration = '1.2.3';
  state.dialog = dialogOf({ changed: false, preflight: null, report: report({
    unverifiedPositions: twelveRecords(), registryAuthoritative: false,
  }) });
  let copied = null;
  withClipboard(t, { writeText: async (text) => { copied = text; } });
  await handlerFor(dialog.render(), 'click', 'optimize-copy')();
  const block = JSON.parse(copied);
  assert.equal(block.kind, 'houseplan-optimize-unverified');
  assert.equal(block.cardVersion, '9.9.9');
  assert.equal(block.integrationVersion, '1.2.3');
  assert.ok(!Number.isNaN(Date.parse(block.checkedAt)));
  assert.deepEqual(Object.keys(block.registry).sort(), ['access', 'analysisAuthoritative', 'authoritative', 'error']);
  assert.equal(block.registry.analysisAuthoritative, false);
  assert.deepEqual(block.counts, { total: 12, legacy_group: 5, unknown_owner: 4, registry_unavailable: 3 });
  assert.equal(block.records.length, 12, 'all records, not only the ten in Details');
  assert.deepEqual(block.records[11], {
    id: 'lg_light.secret_11', spaceId: 'gone', kind: 'group', reason: 'registry_unavailable',
  });
  assert.doesNotMatch(copied, /Secret lamp|"name"|"x"|"y"|"state"|token/i);
  assert.deepEqual(calls.toasts, ['gs.preflight_copied']);
  assert.equal(dialog.clipboardFallback, null);
  assert.deepEqual(calls.commit, []);
});

test('#869 AC5 a refused clipboard shows the same text inline, selectable, without a toast', async (t) => {
  const { dialog, state, calls } = fakePort();
  state.dialog = dialogOf({ changed: false, preflight: null, report: report({ unverifiedPositions: twelveRecords() }) });
  withClipboard(t, { writeText: async () => { throw new Error('denied'); } });
  await dialog.copyDiagnostics();
  assert.deepEqual(calls.toasts, []);
  assert.match(dialog.clipboardFallback, /houseplan-optimize-unverified/);
  assert.match(unverifiedBlock(dialog.render()),
    /<details open>[\s\S]*<pre style="user-select:text;white-space:pre-wrap">\{\n {2}"kind": "houseplan-optimize-unverified"/);
});

test('#869 AC5 a geometry refusal keeps its own diagnostics and the block offers no second copy', async (t) => {
  const { dialog, state } = fakePort();
  state.dialog = dialogOf({ preflight: failedPreflight(), report: report({ unverifiedPositions: twelveRecords() }) });
  const template = dialog.render();
  assert.doesNotMatch(flatten(template), /optimize-copy/);
  assert.match(unverifiedBlock(template), /gs\.optimize_unverified\{"n":"12"\}/);
  let copied = null;
  withClipboard(t, { writeText: async (text) => { copied = text; } });
  await dialog.copyDiagnostics();
  assert.equal(JSON.parse(copied).kind, 'houseplan-optimize-preflight');
});

test('#869 AC6 Details show a known name first, then the id; legacy groups are labelled', () => {
  const tr = translator(RU);
  const { dialog, state } = fakePort({
    t: tr,
    planHost: () => haPlanHost({ areas: { detskaia_elina: { area_id: 'detskaia_elina', name: 'Детская Элины' } } }),
  });
  state.dialog = dialogOf({ changed: false, preflight: null, report: report({
    liveMissingPositions: [{ id: 'm1', kind: 'device', name: 'Торшер', spaceId: 'gone' }],
    unverifiedPositions: [
      { id: 'grp_detskaia_elina', spaceId: 'f2', kind: 'legacy_group', name: '', reason: 'legacy_group' },
      { id: 'grp_detskaia_maiia', spaceId: 'f2', kind: 'legacy_group', name: '', reason: 'legacy_group' },
      { id: OPAQUE, spaceId: 'smrnf8s7x', kind: 'unknown', name: '', reason: 'unknown_owner' },
    ],
  }) });
  const details = detailsText(dialog.render());
  const live = tr('gs.optimize_detail_live');
  const unverified = tr('gs.optimize_detail_unverified');
  const legacy = tr('gs.optimize_detail_legacy_group');
  assert.ok(details.includes(tr('gs.optimize_detail_item_named', {
    status: live, kind: tr('gs.optimize_detail_device'), name: 'Торшер', id: 'm1', space: 'gone',
  })), details);
  assert.ok(details.includes('«Торшер» (m1)'));
  assert.ok(details.includes(tr('gs.optimize_detail_item_named', {
    status: unverified, kind: legacy, name: 'Детская Элины', id: 'grp_detskaia_elina', space: 'f2',
  })));
  assert.ok(details.includes(tr('gs.optimize_detail_item', {
    status: unverified, kind: legacy, id: 'grp_detskaia_maiia', space: 'f2',
  })), 'no exact Area — the id alone, as before');
  assert.ok(details.includes(tr('gs.optimize_detail_item', {
    status: unverified, kind: tr('gs.optimize_detail_unknown'), id: OPAQUE, space: 'smrnf8s7x',
  })));
  for (const [code, dictionary] of [['ru', RU], ['en', EN]]) {
    assert.equal(Object.values(dictionary).some((value) => /проверить позиций|safely verify positions/.test(value)),
      false, `${code}: the broken summary is gone`);
  }
});

test('#869 legacy group name comes only from the HA Area with exactly that id', () => {
  const tr = translator(EN);
  const areas = {
    kids: { area_id: 'kids', name: 'Kids room' }, kids_2: { area_id: 'kids_2', name: 'Other' },
  };
  const { dialog, state } = fakePort({ t: tr, planHost: () => haPlanHost({ areas }) });
  const item = (id) => ({ id, spaceId: 'f2', kind: 'legacy_group', name: '', reason: 'legacy_group' });
  state.dialog = dialogOf({ changed: false, preflight: null, report: report({
    unverifiedPositions: [item('grp_kids'), item('grp_kid'), item('grp_constructor'), item('grp___proto__')],
  }) });
  const text = mainText(dialog.render());
  assert.ok(text.includes(tr('gs.optimize_unverified_legacy', {
    n: '4', names: tr('gs.optimize_live_names', { names: 'Kids room', more: '' }),
  })), text);
});

// ------------------------------------------- #869: the lazy Optimize chunk

const SOURCE_FILES = (dir) => readdirSync(new URL(dir, import.meta.url), { withFileTypes: true })
  .flatMap((entry) => (entry.isDirectory()
    ? SOURCE_FILES(`${dir}${entry.name}/`)
    : entry.name.endsWith('.ts') ? [`${dir}${entry.name}`] : []));

test('#869 the dialog and its helpers are reached only by a dynamic import of the loader', () => {
  const lazy = new Set(['./optimize-plans-dialog', './optimize-unverified']);
  const offenders = [];
  for (const file of SOURCE_FILES('../src/')) {
    if (/\/optimize-(?:plans-dialog|unverified)\.ts$/.test(file)) continue;
    const unit = ts.createSourceFile(file, readFileSync(new URL(file, import.meta.url), 'utf8'),
      ts.ScriptTarget.Latest, true);
    for (const statement of unit.statements) {
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
      const specifier = statement.moduleSpecifier?.text?.replace(/^\.\.\//, './');
      if (!lazy.has(specifier)) continue;
      const typeOnly = ts.isImportDeclaration(statement)
        ? statement.importClause?.isTypeOnly === true
        : statement.isTypeOnly === true;
      if (!typeOnly) offenders.push(`${file}: ${statement.getText(unit)}`);
    }
  }
  assert.deepEqual(offenders, [], 'a static import pulls the dialog back into the editor graph');
  const loader = readFileSync(new URL('../src/optimize-plans-loader.ts', import.meta.url), 'utf8');
  assert.match(loader, /import\('\.\/optimize-plans-dialog'\)/);
  // The chunk may lean only on the View graph (eager chunks). A static edge into
  // a module of the editor runtime chunk makes Rollup rename the runtime's named
  // exports, and the immutable-URL retry then reads no fingerprint (#803).
  const own = new Set(['src/optimize-plans-dialog.ts', 'src/optimize-unverified.ts']
    .map((path) => resolvePath(REPO_ROOT, path)));
  const view = staticGraph(VIEW_ENTRIES);
  const runtimeOnly = [...staticGraph(['src/optimize-plans-dialog.ts'])]
    .filter((file) => !own.has(file) && !view.has(file))
    .map((file) => file.slice(REPO_ROOT.length + 1));
  assert.deepEqual(runtimeOnly, [], 'inject it through the loader instead');
});

test('#869 the loader opens the real dialog and routes the block strings to the lazy settings dictionary', async () => {
  const { port, state, calls } = fakePort({ t: (key, vars) => `main:${key}${vars ? JSON.stringify(vars) : ''}` });
  const loader = new LazyOptimizePlansDialog(port, () => 'en');
  assert.equal(flatten(loader.render()), '', 'nothing paints before the chunk arrives');
  assert.equal(loader.clipboardFallback, null);
  state.config = { spaces: [space('a', 'Alpha', 0.5), space('b', 'Beta', 0.50337)], markers: [], settings: {} };
  const opening = loader.open();
  assert.equal(state.dialog.phase, 'loading');
  assert.match(flatten(loader.render()), /Checking plans/);
  await opening;
  assert.ok(state.dialog?.changed, 'the real preview opened');
  assert.deepEqual(calls.commit, []);
  assert.ok(state.dialog.report, 'the eager shell was replaced by the lazy report');
  state.dialog = dialogOf({ changed: false, preflight: null, report: report({
    unverifiedPositions: [{ id: 'x', kind: 'unknown', name: '', spaceId: 'gone', reason: 'unknown_owner' }],
    registryAuthoritative: false,
  }) });
  const text = flatten(loader.render());
  assert.ok(text.includes(EN['gs.optimize_retry']), 'a settings key resolves through settings');
  assert.ok(text.includes(EN['gs.optimize_no_changes']));
  assert.match(text, /main:btn\.close/, 'a card key still resolves through the card');
  assert.doesNotMatch(text, /main:gs\.optimize_(?:retry|no_changes|unverified)/);
});

test('#892 AC1: direct and lazy entry points refuse a current non-writer without a candidate or commit', async () => {
  const { dialog, port, state, calls } = fakePort({ canWrite: () => false });
  dialog.open();
  assert.equal(state.dialog, null);
  assert.deepEqual(calls.referenceContext, []);
  state.dialog = dialogOf();
  await dialog.run();
  assert.deepEqual(calls.commit, []);
  const loader = new LazyOptimizePlansDialog(port, () => 'en');
  await loader.open();
  assert.equal(loader.dialog, null, 'no lazy import just to attempt a forbidden mutation');
  assert.ok(calls.toasts.some(x => x.includes('write')));
});

test('#892 AC8: revision, deep content or proof changes reset consent and never commit a stale candidate', async () => {
  for (const change of [
    (s) => { s.configRev = 4; }, (s) => { s.layoutRev = 5; },
    (s) => { s.config.spaces[0].title = 'Changed'; },
    (s) => { s.ownersFingerprint = 'new roster'; }, (s) => { s.connection = {}; },
  ]) {
    const { dialog, state, calls } = fakePort();
    state.dialog = dialogOf({ removeInvalidMissingPositions: true });
    change(state);
    await dialog.run();
    assert.equal(calls.commit.length, 0);
    assert.equal(state.dialog.removeInvalidMissingPositions, false);
    assert.equal(state.dialog.removeLiveMissingPositions, false);
    assert.ok(calls.toasts.includes('gs.optimize_preview_changed'));
  }
});

test('#892 AC5: cleanup is preview-only, Apply writes its exact pair, post-commit report is clean', async () => {
  let layout = ownerLayout();
  const config = optimalConfig();
  const { dialog, port, state, calls } = fakePort({
    layout: () => layout,
    referenceContext: (removeLive, removeInvalid) => ({ ...roster(true),
      removeLiveMissingPositions: removeLive, removeInvalidMissingPositions: removeInvalid }),
    commit: async (cfg, lay, guard) => {
      assert.equal(guard.canWrite(), true);
      assert.equal(sameOptimizeSource(guard.source, guard.current()), true);
      calls.commit.push([cfg, lay]); state.config = cfg; layout = lay;
      state.configRev = 2; state.layoutRev = 3;
      return { config: cfg, layout: lay, configRev: 2, layoutRev: 3, canUndo: true, canonical: true };
    },
  });
  state.config = config;
  dialog.open();
  const original = JSON.stringify(layout);
  assert.equal(state.dialog.changed, false);
  assert.equal(state.dialog.report.invalidPositionsEligible.length, 3);
  dialog.toggleInvalidPositions();
  assert.equal(calls.commit.length, 0);
  assert.equal(JSON.stringify(layout), original);
  const candidate = state.dialog;
  assert.equal(candidate.report.invalidPositionsRemoved.length, 3);
  assert.match(flatten(dialog.render()), /gs.optimize_invalid_selected/);
  await dialog.run();
  assert.deepEqual(calls.commit[0], [candidate.config, candidate.layout]);
  assert.equal(state.dialog.report.invalidPositionsRemoved.length, 3, 'retain the applied delta');
  assert.equal(state.dialog.afterReport.invalidPositionsEligible.length, 0);
  assert.equal(state.dialog.phase, 'result');
  assert.equal(state.dialog.outcome, 'clean');
  assert.match(calls.toasts.at(-1), /gs.optimize_saved_title/);
  assert.equal(port.dialog(), state.dialog);
});

test('#892 AC8/9: closing a pending Apply cannot close or toast a subsequently opened dialog', async () => {
  let finish;
  const { dialog, state, calls } = fakePort({ commit: () => new Promise(r => { finish = r; }) });
  state.dialog = dialogOf();
  const pending = dialog.run();
  await Promise.resolve();
  state.dialog = dialogOf();
  const reopened = state.dialog;
  finish(); await pending;
  assert.equal(state.dialog, reopened);
  assert.equal(calls.toasts.length, 0);
});

test('#892 AC6: retained-only records keep a disabled cleanup button and an explanation', () => {
  const { dialog, state } = fakePort();
  state.dialog = dialogOf({ report: { ...report(),
    invalidPositionsRetained: [{ id: 'future', spaceId: 'gone', kind: 'unknown', name: '',
      cleanupReason: 'unknown_shape' }] } });
  const template = dialog.render();
  const action = buttons(template).find(button => /optimize-invalid-cleanup/.test(button.attributes));
  assert.ok(action);
  assert.equal(action.disabled, true);
  assert.match(flatten(template), /gs.optimize_invalid_none_safe/);
  dialog.toggleInvalidPositions();
  assert.equal(state.dialog.removeInvalidMissingPositions, false);
});

// #1170: lifecycle/outcome tests use the production controller with controlled
// optimizer/transport seams, not a second implementation of its state machine.
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; };
function readyController(post = 'clean', overrides = {}) {
  const h = fakePort(overrides); let checks = 0;
  h.state.config = optimalConfig();
  h.state.dialog = dialogOf({ config: h.state.config, source: h.port.source(), report: report({ moved: 2, total: 3 }) });
  h.dialog = new OptimizePlansDialog(h.port, { sourceMatches: sameOptimizeSource, feedback,
    optimize: (cfg, layout) => {
      checks++;
      if (post === 'throws') throw Error('private postcheck message');
      return { config: cfg, layout, changed: post === 'remaining',
        report: report(post === 'limited' ? { wallsStraightenSkipped: 1 } : {}) };
    } });
  return { ...h, checks: () => checks };
}

test('#1170 initial calculation waits for a presented busy frame and never writes', async () => {
  const frame = deferred(); let calculated = 0;
  const h = fakePort({ present: () => frame.promise });
  h.dialog = new OptimizePlansDialog(h.port, { sourceMatches: sameOptimizeSource, feedback,
    optimize: (...args) => { calculated++; return optimizePlans(...args); } });
  const opening = h.dialog.open();
  assert.equal(h.state.dialog.phase, 'checking');
  assert.match(flatten(h.dialog.render()), /gs.optimize_checking/);
  assert.equal(calculated, 0); assert.equal(h.calls.commit.length, 0);
  frame.resolve(); await opening;
  assert.equal(calculated, 1); assert.ok(h.state.dialog.report);
});

test('#1170 closing and reopening a sent Apply restores one operation, not a duplicate write', async () => {
  const gate = deferred(); let writes = 0;
  const h = readyController(); const commit = h.port.commit;
  h.port.commit = async (...args) => { writes++; await gate.promise; return commit(...args); };
  const applying = h.dialog.run(); await Promise.resolve();
  assert.equal(h.state.dialog.busy, true);
  assert.match(flatten(h.dialog.render()), /gs.optimize_close_hint/);
  handlerFor(h.dialog.render(), 'hp-close')();
  assert.equal(h.state.dialog, null);
  await h.dialog.open();
  assert.equal(h.state.dialog.phase, 'saving');
  await h.dialog.run(); assert.equal(writes, 1);
  gate.resolve(); await applying;
  assert.equal(h.state.dialog.outcome, 'clean');
  assert.equal(h.checks(), 1); assert.equal(h.calls.commit.length, 1);
  assert.match(flatten(h.dialog.render()), /gs.optimize_result_clean/);
  assert.doesNotMatch(flatten(h.dialog.render()), /data-hp="dialog-confirm"/);
});

test('#1170 success keeps only the confirmed report and a single read-only postcheck', async () => {
  for (const post of ['clean', 'limited', 'remaining', 'throws']) {
    const h = readyController(post);
    const delta = h.state.dialog.report;
    await h.dialog.run();
    assert.equal(h.state.dialog.phase, 'result', post);
    assert.equal(h.state.dialog.outcome, post === 'throws' ? 'unchecked' : post, post);
    assert.equal(h.state.dialog.report, delta, 'do not replace saved delta with a new candidate');
    assert.equal(h.checks(), 1); assert.equal(h.calls.commit.length, 1);
    assert.equal(h.calls.checkGeometry.length, 0, 'no second physical preflight after saving');
    assert.doesNotMatch(flatten(h.dialog.render()), /private postcheck/);
    await h.dialog.run(); assert.equal(h.calls.commit.length, 1, 'a result is not an Apply target');
  }
});

test('#1170 remaining changes need another explicit preview and warn about replacing Undo', async () => {
  const h = readyController('remaining'); await h.dialog.run();
  assert.match(flatten(h.dialog.render()), /gs.optimize_replaces_undo/);
  handlerFor(h.dialog.render(), 'click', 'optimize-recheck')();
  assert.equal(h.state.dialog.outcome, undefined);
  assert.equal(h.state.dialog.replacesUndo, true);
  assert.equal(h.calls.commit.length, 1);
  assert.match(flatten(h.dialog.render()), /data-hp="dialog-confirm"/);
  assert.match(flatten(h.dialog.render()), /gs.optimize_replaces_undo/);
});

test('#1170 an unknown save survives closing; failed/superseded reads never unlock the old candidate', async () => {
  for (const read of ['failed', 'superseded']) {
    const h = readyController('clean', {
      commit: async () => { throw new OptimizeWriteFailure({ code: 'commit_failed' }, 'dispatched'); },
      reloadAfterConflict: async () => read,
    });
    const candidate = h.state.dialog;
    await h.dialog.run();
    assert.equal(h.state.dialog.phase, 'unknown');
    handlerFor(h.dialog.render(), 'hp-close')(); await h.dialog.open();
    assert.equal(h.state.dialog.phase, 'unknown');
    await handlerFor(h.dialog.render(), 'click', 'optimize-refresh')();
    assert.equal(h.state.dialog.phase, 'unknown'); assert.equal(h.state.dialog.refreshFailed, true);
    h.state.dialog = candidate; await h.dialog.run();
    assert.equal(h.checks(), 0, 'no postcheck or replacement preview without synchronization');
  }
});

test('#1170 adopted synchronization releases unknown state only for a fresh preview', async () => {
  let writes = 0;
  const h = readyController('clean', {
    commit: async () => { writes++; throw new OptimizeWriteFailure({ code: 'commit_failed' }, 'dispatched'); },
    reloadAfterConflict: async () => 'adopted',
  });
  await h.dialog.run();
  await handlerFor(h.dialog.render(), 'click', 'optimize-refresh')();
  assert.ok(h.state.dialog.report); assert.equal(h.state.dialog.changed, false);
  assert.equal(writes, 1); assert.equal(h.checks(), 1);
});

test('#1170 identical context error codes are classified by dispatch evidence', async () => {
  for (const stage of ['before-dispatch', 'dispatched', 'acknowledged']) {
    const h = readyController('clean', {
      commit: async () => { throw new OptimizeWriteFailure({ code: 'context-changed' }, stage); },
      reloadAfterConflict: async () => 'failed',
    });
    await h.dialog.run();
    assert.equal(h.state.dialog.phase, stage === 'before-dispatch' ? 'failure' : stage === 'dispatched' ? 'unknown' : 'result', stage);
    if (stage === 'acknowledged') assert.equal(h.state.dialog.outcome, 'unchecked');
    if (stage === 'dispatched') assert.doesNotMatch(flatten(h.dialog.render()), /gs.optimize_not_applied/);
  }
});

test('#1170 a superseded authority cannot render or toast its old result in another dialog', async () => {
  const gate = deferred(); const h = readyController(); const commit = h.port.commit;
  h.port.commit = async (...args) => { await gate.promise; return commit(...args); };
  const pending = h.dialog.run(); await Promise.resolve();
  const foreign = dialogOf(); h.state.connection = {}; h.state.dialog = foreign;
  gate.resolve(); await pending;
  assert.equal(h.state.dialog, foreign); assert.deepEqual(h.calls.toasts, []);
});

test('#1170 a changed source during the presented postcheck frame cannot claim a clean result', async () => {
  let frames = 0;
  const h = readyController();
  h.port.present = async () => { if (++frames === 2) h.state.ownersFingerprint = 'new owners'; };
  await h.dialog.run();
  assert.equal(h.state.dialog.outcome, 'stale'); assert.equal(h.checks(), 0);
});

test('#1170 a legacy metadata-only ACK requires canonical readback before a clean result', async () => {
  for (const read of ['adopted', 'failed', 'superseded']) {
    const h = readyController(); const commit = h.port.commit;
    h.port.commit = async (...args) => ({ ...await commit(...args), canonical: false });
    h.port.reloadAfterConflict = async () => read;
    await h.dialog.run();
    assert.equal(h.state.dialog.outcome, read === 'adopted' ? 'clean' : 'unchecked', read);
    assert.equal(h.checks(), read === 'adopted' ? 1 : 0);
    assert.equal(h.calls.commit.length, 1);
  }
});

test('#1170 failure diagnostics and Help omit private exception text and preserve a busy draft', async t => {
  let message;
  const h = readyController('clean', {
    commit: async () => { throw new OptimizeWriteFailure(Error('SECRET token and coordinates'), 'dispatched'); },
    support: text => { message = text; return false; },
  });
  await h.dialog.run();
  withClipboard(t, { writeText: async () => { throw Error('clipboard unavailable'); } });
  await h.dialog.copyDiagnostics();
  assert.match(h.dialog.clipboardFallback, /houseplan-optimize/);
  assert.doesNotMatch(h.dialog.clipboardFallback, /SECRET|coordinates|token/);
  handlerFor(h.dialog.render(), 'click', 'optimize-support')();
  assert.match(message, /houseplan-optimize/); assert.doesNotMatch(message, /SECRET/);
  assert.equal(h.state.dialog.phase, 'unknown', 'a busy support draft does not consume the failure');
  h.port.support = text => { message = text; return true; };
  handlerFor(h.dialog.render(), 'click', 'optimize-support')();
  assert.equal(h.state.dialog, null, 'only successful entry closes Optimize');
});

test('#1170 no-op with retained observations cannot say the plan is completely optimized', () => {
  for (const patch of [{ wallsStraightenSkipped: 1 }, { nestedRefsUnresolved: 1 },
    { unverifiedPositions: [{ id: 'old', kind: 'unknown', spaceId: 'gone' }] },
    { liveMissingPositions: [{ id: 'live', kind: 'device', name: 'Lamp', spaceId: 'gone' }] }]) {
    const h = fakePort();
    h.state.dialog = dialogOf({ changed: false, preflight: null, report: report(patch) });
    const text = flatten(h.dialog.render());
    assert.doesNotMatch(text, /gs.optimize_result_clean|gs.optimize_clean_title/);
    assert.equal(h.calls.commit.length, 0);
  }
});
import { haPlanHost } from '../test-build/ha-plan-host.js';
