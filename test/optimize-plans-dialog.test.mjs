// #642: диалог «Оптимизировать планы» — исполнением через test-build, а не
// текстом монолита. Сюда же переехали 11 утверждений `i18n.test.mjs` о
// разметке и тосте диалога (AC3) и гварды восьми мутантов реестра (AC4).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

import {
  OptimizePlansDialog, preflightDiagnostics, preflightVersionsDiffer,
} from '../test-build/optimize-plans-dialog.js';
import { formatLatticeShiftCm } from '../test-build/coordinate-canonicalization.js';
import { spacePhysicalGeometryFingerprint } from '../test-build/plan-geometry-preflight.js';
import { contentFingerprint } from '../test-build/visual-continuity.js';

const MODULE_SOURCE = readFileSync(new URL('../src/optimize-plans-dialog.ts', import.meta.url), 'utf8');
const BUILT_SOURCE = readFileSync(new URL('../test-build/optimize-plans-dialog.js', import.meta.url), 'utf8');

// ---------------------------------------------------------------- fixtures

const space = (id, title, x) => ({
  id, title, view_box: [0, 0, 1, 1], cell_cm: 5,
  rooms: [{ id: `${id}-room`, name: 'R', area: null, poly: [[0.1, 0.1], [x, 0.1], [x, 0.4], [0.1, 0.4]] }],
});

const report = (patch = {}) => ({
  moved: 0, total: 0, rotated: 0, maxShift: 0, maxShiftCm: 0, maxSpace: '',
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
    ...patch,
  };
};

/** Фейковый порт: ровно члены `OptimizePlansDialogPort`, каждый считает вызовы. */
function fakePort(overrides = {}) {
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
    hass: () => ({}),
    config: () => state.config,
    planReady: () => true,
    layout: () => ({}),
    integrationVersion: () => state.integration,
    cardVersion: () => '9.9.9',
    requestUpdate: () => { calls.requestUpdate += 1; },
    showToast: (message) => { calls.toasts.push(message); },
    errorText: (error) => String(error?.message ?? error),
    checkGeometry: (config) => { calls.checkGeometry.push(config); return okPreflight(config); },
    referenceContext: (removeLive) => { calls.referenceContext.push(removeLive); return { removeLiveMissingPositions: removeLive }; },
    showMigrationBlocked: (error) => { calls.migration.push(error); },
    clearGeometryGesture: () => { calls.gesture += 1; },
    commit: async (config, layout) => { calls.commit.push([config, layout]); },
    reloadAfterConflict: async () => { calls.reload += 1; },
    ...overrides,
  };
  return { port, calls, state, dialog: new OptimizePlansDialog(port) };
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

test('#642 preflightVersionsDiffer: only a known, different integration version advises an update', () => {
  assert.equal(preflightVersionsDiffer(null, '1.0.0'), false);
  assert.equal(preflightVersionsDiffer('', '1.0.0'), false);
  assert.equal(preflightVersionsDiffer('1.0.0', '1.0.0'), false);
  assert.equal(preflightVersionsDiffer('0.0.1-other', '1.0.0'), true);
});

// ------------------------------------------------------------------ preview

test('#642 preview: a failed migration reports once and opens nothing', () => {
  const boom = new Error('wall model');
  const { dialog, calls, state } = fakePort({ referenceContext: () => { throw boom; } });
  dialog.preview(false);
  assert.deepEqual(calls.migration, [boom]);
  assert.equal(state.dialog, null);
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

test('#642 run: success writes the exact pair, closes, and toasts counts including lattice cleanup', async () => {
  const seen = [];
  const { dialog, state, calls } = fakePort({
    commit: async (config, layout) => { seen.push(state.dialog?.busy); calls.commit.push([config, layout]); },
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
  assert.equal(state.dialog, null);
  assert.deepEqual(calls.toasts, ['gs.align_done{"n":"2","m":"7","r":"1"}']);
});

test('#642 run: conflict reloads both stores; outdated client gets its own toast', async () => {
  const conflict = fakePort({ commit: async () => { throw Object.assign(new Error('c'), { code: 'conflict' }); } });
  conflict.state.dialog = dialogOf();
  await conflict.dialog.run();
  assert.equal(conflict.calls.reload, 1);
  assert.equal(conflict.state.dialog.busy, false, 'the dialog stays open and usable');
  assert.deepEqual(conflict.calls.toasts, ['toast.error{"err":"c"}']);

  const outdated = fakePort({ commit: async () => { throw { code: 'wall_model_client_outdated' }; } });
  outdated.state.dialog = dialogOf();
  await outdated.dialog.run();
  assert.equal(outdated.calls.reload, 0);
  assert.deepEqual(outdated.calls.toasts, ['toast.wall_model_client_outdated']);
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
  assert.match(flatten(dialog.render()), /gs\.preflight_update_hint/);
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
  state.dialog = dialogOf({ report: report({ removedPositions: removed, unverifiedPositions: unverified }) });
  const text = flatten(dialog.render());
  assert.equal(text.split('<li>').length - 1, 10);
  assert.match(text, /gs\.optimize_detail_item\{"status":"gs\.optimize_detail_removed","kind":"gs\.optimize_detail_room_label","id":"r0","space":"x"\}/);
  assert.match(text, /gs\.optimize_detail_item\{"status":"gs\.optimize_detail_unverified","kind":"gs\.optimize_detail_unknown","id":"u0","space":"y"\}/);
  assert.match(text, /gs\.optimize_details_more\{"n":"2"\}/);
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
  assert.ok(members.length <= 20, `port has ${members.length} members`);
  const { port, dialog } = fakePort();
  assert.ok(Object.keys(port).length <= 20);
  assert.deepEqual(Object.keys(port).sort(), members, 'the fake port is exactly the declared port');
  assert.equal('host' in dialog, false);
});
