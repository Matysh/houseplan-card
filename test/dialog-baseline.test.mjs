import test from 'node:test';
import assert from 'node:assert/strict';

import {
  dialogBaseline,
  dialogDirty,
  forgetDialogBaseline,
  rememberDialogBaseline,
  restoreDialogBaseline,
  restoreWarmDialogBaseline,
  stableKey,
  warmDialogBaseline,
} from '../test-build/editors/dialog-baseline.js';
import {
  forgetSpaceDialogBaseline, rememberSpaceDialogBaseline, spaceDialogDirty, spaceDialogDraftKey,
} from '../test-build/editors/space-form-state.js';
import {
  forgetGeneralBaseline, generalDirty, generalDraftKey, rememberGeneralBaseline,
} from '../test-build/editors/general-form-state.js';
import {
  MARKER_DIALOG_TRANSIENT_KEYS, forgetMarkerBaseline, markerDirty, markerDraftKey, rememberMarkerBaseline,
} from '../test-build/editors/marker-form-state.js';
import {
  forgetRoomBaseline, rememberRoomBaseline, roomDirty, roomDraftKey,
} from '../test-build/editors/room-form-state.js';

test('warm transfer preserves clean and dirty meaning on a replacement host (#614)', () => {
  const oldHost = {};
  const newHost = {};
  const original = stableKey({ name: 'Kitchen', busy: false }, new Set(['busy']));
  const changed = stableKey({ name: 'Hall', busy: false }, new Set(['busy']));

  rememberDialogBaseline(oldHost, 'space', original);
  assert.equal(dialogDirty(oldHost, 'space', original), false);
  assert.equal(dialogDirty(oldHost, 'space', changed), true);

  restoreDialogBaseline(newHost, 'space', dialogBaseline(oldHost, 'space'));
  assert.equal(dialogDirty(newHost, 'space', original), false);
  assert.equal(dialogDirty(newHost, 'space', changed), true);
});

test('baseline transfer is isolated by dialog kind and can be explicitly forgotten (#614)', () => {
  const host = {};
  rememberDialogBaseline(host, 'settings', 'settings-v1');
  rememberDialogBaseline(host, 'marker', 'marker-v1');

  assert.equal(dialogBaseline(host, 'settings'), 'settings-v1');
  assert.equal(dialogBaseline(host, 'marker'), 'marker-v1');
  forgetDialogBaseline(host, 'marker');
  assert.equal(dialogBaseline(host, 'marker'), undefined);
  assert.equal(dialogDirty(host, 'marker', 'marker-v1'), true);
  assert.equal(dialogDirty(host, 'settings', 'settings-v1'), false);
});

// #631 AC1: контракт отпечатка и снимка — юнитом, а не только браузерными смоками.
// Проверяется то, что человек видит как «Сохранить активна / нет» и вопрос при
// закрытии: одинаковый черновик не должен выглядеть изменённым, транзиентное
// поле (busy, сырой ввод, фильтр списка) — тоже.

test('#631 stableKey: top-level key order does not change the key', () => {
  const a = stableKey({ name: 'Kitchen', area: 'kitchen', fill: 'temp' });
  const b = stableKey({ fill: 'temp', name: 'Kitchen', area: 'kitchen' });
  assert.equal(a, b);
  assert.notEqual(stableKey({ name: 'Kitchen' }), stableKey({ name: 'Hall' }));
  // Лишний ключ — изменение, даже если его значение пустое.
  assert.notEqual(stableKey({ name: 'Kitchen' }), stableKey({ name: 'Kitchen', area: null }));
});

test('#631 stableKey: transient keys are ignored, all others are compared', () => {
  const transient = new Set(['busy', 'filter']);
  const clean = stableKey({ name: 'Lamp', busy: false, filter: '' }, transient);
  assert.equal(stableKey({ name: 'Lamp', busy: true, filter: 'kit' }, transient), clean);
  assert.equal(stableKey({ name: 'Lamp' }, transient), clean);
  assert.notEqual(stableKey({ name: 'Lamp 2', busy: false, filter: '' }, transient), clean);
  // Без набора транзиентных ключей сравнивается всё.
  assert.notEqual(stableKey({ name: 'Lamp', busy: true }), stableKey({ name: 'Lamp', busy: false }));
});

test('#631 stableKey: nested objects are compared as-is — values structurally, nested key order included', () => {
  // Выбранный контракт: сортируется только верхний уровень. Вложенный объект
  // сериализуется JSON.stringify как есть — равные значения в том же порядке
  // ключей дают равный отпечаток, другой порядок вложенных ключей — другой.
  // Черновики строятся из одних и тех же конструкторов, поэтому порядок
  // вложенных ключей стабилен; перестановка — это изменение, а не шум.
  const fill = { c: '#ff0000', a: 0.5 };
  assert.equal(stableKey({ customFill: fill }), stableKey({ customFill: { c: '#ff0000', a: 0.5 } }));
  assert.notEqual(stableKey({ customFill: fill }), stableKey({ customFill: { c: '#ff0000', a: 0.6 } }));
  assert.notEqual(stableKey({ customFill: fill }), stableKey({ customFill: { a: 0.5, c: '#ff0000' } }));
  assert.equal(stableKey({ list: [1, 2] }), stableKey({ list: [1, 2] }));
  assert.notEqual(stableKey({ list: [1, 2] }), stableKey({ list: [2, 1] }));
});

test('#631 dialogDirty: no baseline means dirty — Save stays available', () => {
  const host = {};
  const key = stableKey({ name: 'Kitchen' });
  for (const kind of ['space', 'settings', 'room', 'marker']) {
    assert.equal(dialogDirty(host, kind, key), true, kind);
  }
  rememberDialogBaseline(host, 'room', key);
  assert.equal(dialogDirty(host, 'room', key), false);
  // Снимок одного вида не делает чистым другой вид того же хоста.
  assert.equal(dialogDirty(host, 'marker', key), true);
  // И не переносится на другой хост.
  assert.equal(dialogDirty({}, 'room', key), true);
});

test('#631 restoreDialogBaseline(undefined) forgets; warm helpers accept only the four dialog kinds', () => {
  const host = {};
  rememberDialogBaseline(host, 'space', 'k1');
  restoreDialogBaseline(host, 'space', undefined);
  assert.equal(dialogBaseline(host, 'space'), undefined);
  assert.equal(dialogDirty(host, 'space', 'k1'), true);

  const warm = {};
  for (const kind of ['space', 'settings', 'room', 'marker']) {
    restoreWarmDialogBaseline(warm, kind, `${kind}-key`);
    assert.equal(warmDialogBaseline(warm, kind), `${kind}-key`, kind);
  }
  restoreWarmDialogBaseline(warm, 'wall', 'wall-key');
  assert.equal(warmDialogBaseline(warm, 'wall'), undefined);
  restoreWarmDialogBaseline(warm, 'marker', undefined);
  assert.equal(warmDialogBaseline(warm, 'marker'), undefined);
});

// --- транзиентные наборы четырёх диалогов ---------------------------------

const spaceDraft = (patch = {}) => ({
  mode: 'edit', spaceId: 's1', title: 'Ground floor', planUrl: null, planFile: null,
  source: 'draw', showBorders: true, showNames: true, zeroWallStyle: 'dashed',
  hideDecor: false, hideOpenings: false, roomColor: '#888888', roomOpacity: 0.2,
  bgColor: null, bgMode: null, northDeg: null, sunRays: null, fillMode: 'none',
  customFill: null, glowEnabled: true, tempMin: 18, tempMax: 26, cellCm: 5,
  ...patch,
});

test('#631 space dialog: every transient key is ignored, a real setting makes it dirty', () => {
  const host = {};
  const base = spaceDraft();
  rememberSpaceDialogBaseline(host, base);
  assert.equal(spaceDialogDirty(host, base), false);
  assert.equal(spaceDialogDirty(host, spaceDraft({ fillMode: 'temp', title: 'Ground floor' })), true);
  assert.equal(spaceDialogDirty(host, spaceDraft({ title: 'First floor' })), true);
  const transient = {
    busy: true, pickSaved: true, saved: [{ name: 'a.png' }], savedBusy: true, savedAspect: 1.5,
    cellCmInput: '5,0', tempMinInput: '', tempMaxInput: 'x', northDegInput: '12',
    cellCmTouched: true, displayTouched: true, deleteBlockers: ['r1'], copy: { busy: true },
  };
  for (const [k, v] of Object.entries(transient)) {
    assert.equal(spaceDialogDirty(host, spaceDraft({ [k]: v })), false, k);
  }
  assert.equal(spaceDialogDraftKey(spaceDraft(transient)), spaceDialogDraftKey(base));
  forgetSpaceDialogBaseline(host);
  assert.equal(spaceDialogDirty(host, base), true);
});

test('#631 space dialog: a picked plan file is compared by name, not by its bytes', () => {
  const file = (b64) => ({ ext: 'png', b64, aspect: 1.2, name: 'plan.png' });
  assert.equal(spaceDialogDraftKey(spaceDraft({ planFile: file('AAAA') })),
    spaceDialogDraftKey(spaceDraft({ planFile: file('BBBB') })));
  assert.notEqual(spaceDialogDraftKey(spaceDraft({ planFile: file('AAAA') })),
    spaceDialogDraftKey(spaceDraft({ planFile: { ...file('AAAA'), name: 'other.png' } })));
  assert.notEqual(spaceDialogDraftKey(spaceDraft({ planFile: file('AAAA') })), spaceDialogDraftKey(spaceDraft()));
});

const generalDraft = (patch = {}) => ({
  glowRadius: 25, glowRadiusInput: '25', northDeg: null, northDegInput: '', fillColors: {},
  busy: false, ...patch,
});

test('#631 general settings: busy and raw inputs are transient, stored values are not', () => {
  const host = {};
  const base = generalDraft();
  rememberGeneralBaseline(host, base);
  assert.equal(generalDirty(host, base), false);
  for (const [k, v] of Object.entries({ busy: true, glowRadiusInput: '30', northDegInput: '90' })) {
    assert.equal(generalDirty(host, generalDraft({ [k]: v })), false, k);
  }
  assert.equal(generalDirty(host, generalDraft({ glowRadius: 30 })), true);
  assert.equal(generalDirty(host, generalDraft({ northDeg: 90 })), true);
  assert.equal(generalDraftKey(generalDraft({ busy: true })), generalDraftKey(base));
  forgetGeneralBaseline(host);
  assert.equal(generalDirty(host, base), true);
});

const markerDraft = (patch = {}) => ({
  binding: 'light.kitchen', bindingMode: 'ha', name: 'Lamp', icon: 'mdi:lamp',
  tapAction: 'toggle', tapTarget: '', valueBadgeTouched: false, valueBadgeEnabled: false,
  valueBadgeSource: null, glowRadius: null, originalBinding: 'light.kitchen', ...patch,
});

test('#631 marker dialog: exactly the declared transient keys are ignored, Touched/original are not', () => {
  assert.deepEqual([...MARKER_DIALOG_TRANSIENT_KEYS].sort(), [
    'autoIcon', 'bindingFilter', 'bindingOpen', 'busy', 'controlsFilter', 'runFilter', 'tapHintAnnouncement', 'uploadId',
  ]);
  const host = {};
  const base = markerDraft();
  rememberMarkerBaseline(host, base);
  assert.equal(markerDirty(host, base), false);
  const transient = {
    bindingOpen: true, bindingFilter: 'kit', runFilter: 'scr', controlsFilter: 'x', busy: true,
    tapHintAnnouncement: 'hint', uploadId: 7, autoIcon: 'mdi:lightbulb',
  };
  for (const [k, v] of Object.entries(transient)) {
    assert.equal(markerDirty(host, markerDraft({ [k]: v })), false, k);
  }
  assert.equal(markerDirty(host, markerDraft({ valueBadgeTouched: true })), true);
  assert.equal(markerDirty(host, markerDraft({ originalBinding: 'light.hall' })), true);
  assert.equal(markerDirty(host, markerDraft({ name: 'Lamp 2' })), true);
  assert.equal(markerDraftKey(markerDraft(transient)), markerDraftKey(base));
  forgetMarkerBaseline(host);
  assert.equal(markerDirty(host, base), true);
});

const roomHost = (patch = {}) => ({
  _nameSel: 'Kitchen', _areaSel: 'kitchen', _roomFill: '', _roomCustomFill: null,
  _roomTempMin: '', _roomTempMax: '', _roomTempSrc: '', _roomHumSrc: '',
  _roomNameScale: 1, _roomLabelScale: 1, _roomEditId: 'r1', ...patch,
});

test('#631 room dialog: the key collects the ten draft fields of the host and nothing else', () => {
  const host = roomHost();
  rememberRoomBaseline(host);
  assert.equal(roomDirty(host), false);
  // Поля хоста вне черновика (id редактируемой комнаты, что угодно ещё) не входят.
  assert.equal(roomDraftKey(roomHost({ _roomEditId: 'r2', _busy: true })), roomDraftKey(roomHost()));
  const fields = {
    _nameSel: 'Hall', _areaSel: 'hall', _roomFill: 'temp', _roomCustomFill: { c: '#00ff00', a: 1 },
    _roomTempMin: '18', _roomTempMax: '24', _roomTempSrc: 'sensor.t', _roomHumSrc: 'sensor.h',
    _roomNameScale: 1.2, _roomLabelScale: 0.8,
  };
  for (const [k, v] of Object.entries(fields)) {
    host[k] = v;
    assert.equal(roomDirty(host), true, k);
    host[k] = roomHost()[k];
    assert.equal(roomDirty(host), false, `${k} restored`);
  }
  forgetRoomBaseline(host);
  assert.equal(roomDirty(host), true);
});
