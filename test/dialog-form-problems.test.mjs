import test from 'node:test';
import assert from 'node:assert/strict';

import { generalProblems } from '../test-build/editors/general-form-state.js';
import { markerProblems } from '../test-build/editors/marker-form-state.js';
import { spaceDialogProblems } from '../test-build/editors/space-form-state.js';
import { roomProblems } from '../test-build/editors/room-form-state.js';
import { GRID_CELL_CM_MAX, GRID_CELL_CM_MIN } from '../test-build/grid-scale.js';

const fields = (problems) => problems.map(({ field, message }) => [field, message]);

const generalDraft = (glowRadiusInput, northDegInput = '') => ({
  glowRadiusInput,
  northDegInput,
});

test('#614 generalProblems validates required glow text without reviving the typed value', () => {
  const glowError = [['gs-glow-radius', 'gs.error_glow_radius']];
  assert.deepEqual(fields(generalProblems(generalDraft(''))), glowError);
  assert.deepEqual(fields(generalProblems(generalDraft('   '))), glowError);
  assert.deepEqual(fields(generalProblems(generalDraft('glow'))), glowError);
  assert.deepEqual(fields(generalProblems(generalDraft('0'))), glowError);
  assert.deepEqual(fields(generalProblems(generalDraft('-0'))), glowError);
  assert.deepEqual(fields(generalProblems(generalDraft('-1'))), glowError);
  assert.deepEqual(fields(generalProblems(generalDraft('0,01'))), []);
  assert.deepEqual(fields(generalProblems(generalDraft('25'))), []);
});

test('#614 generalProblems keeps north optional but enforces integer compass bounds', () => {
  const northError = [['gs-north', 'gs.error_north']];
  for (const raw of ['', '   ', '0', '359']) {
    assert.deepEqual(fields(generalProblems(generalDraft('25', raw))), [], raw);
  }
  for (const raw of ['north', '12,5', '-1', '360']) {
    assert.deepEqual(fields(generalProblems(generalDraft('25', raw))), northError, raw);
  }
});

const baseSpace = (patch = {}) => ({
  title: 'Ground floor',
  cellCm: 5,
  cellCmInput: '5',
  source: 'draw',
  planFile: null,
  planUrl: null,
  fillMode: 'none',
  tempMin: 18,
  tempMax: 26,
  tempMinInput: '18',
  tempMaxInput: '26',
  northDeg: null,
  northDegInput: '',
  ...patch,
});

const spaceFields = (patch = {}, imperial = false) =>
  fields(spaceDialogProblems(baseSpace(patch), 'space', imperial));

test('#614 spaceDialogProblems validates raw scale text and persisted bounds', () => {
  const scaleError = [['space-cell-cm', 'space.error_scale']];
  for (const raw of ['', '   ', 'scale', '0', String(GRID_CELL_CM_MIN - 0.01), String(GRID_CELL_CM_MAX + 1)]) {
    assert.deepEqual(spaceFields({ cellCmInput: raw }), scaleError, raw);
  }
  for (const raw of [String(GRID_CELL_CM_MIN), '1,5', String(GRID_CELL_CM_MAX)]) {
    assert.deepEqual(spaceFields({ cellCmInput: raw }), [], raw);
  }
});

test('#614 spaceDialogProblems reports each temperature input and then the range', () => {
  assert.deepEqual(spaceFields({ fillMode: 'temp', tempMinInput: '', tempMaxInput: '   ' }), [
    ['space-temp-min', 'space.error_temp_value'],
    ['space-temp-max', 'space.error_temp_value'],
  ]);
  assert.deepEqual(spaceFields({ fillMode: 'temp', tempMinInput: 'cold', tempMaxInput: '24' }), [
    ['space-temp-min', 'space.error_temp_value'],
  ]);
  assert.deepEqual(spaceFields({ fillMode: 'temp', tempMinInput: '18,5', tempMaxInput: '24,5' }), []);
  assert.deepEqual(spaceFields({ fillMode: 'temp', tempMinInput: '20', tempMaxInput: '20' }), [
    ['space-temp-max', 'space.error_temp_range'],
  ]);
  assert.deepEqual(spaceFields({ fillMode: 'temp', tempMinInput: '21', tempMaxInput: '20' }), [
    ['space-temp-max', 'space.error_temp_range'],
  ]);
});

test('#614 spaceDialogProblems validates custom north only and keeps exact bounds', () => {
  const northError = [['space-north-deg', 'space.error_north']];
  for (const raw of ['', '   ', 'north', '12,5', '-1', '360']) {
    assert.deepEqual(spaceFields({ northDeg: 0, northDegInput: raw }), northError, raw);
  }
  for (const raw of ['0', '359']) {
    assert.deepEqual(spaceFields({ northDeg: 0, northDegInput: raw }), [], raw);
  }
  assert.deepEqual(spaceFields({ northDeg: null, northDegInput: 'not used' }), []);
});

const baseMarker = (patch = {}) => ({
  binding: 'virtual',
  bindingMode: 'virtual',
  name: 'Virtual lamp',
  tapAction: 'more-info',
  tapTarget: '',
  valueBadgeTouched: false,
  valueBadgeEnabled: false,
  valueBadgeSource: null,
  ...patch,
});

test('#614 markerProblems exposes virtual name, Run target and badge source inline', () => {
  assert.deepEqual(fields(markerProblems(baseMarker({
    name: '   ',
    tapAction: 'run',
    valueBadgeTouched: true,
    valueBadgeEnabled: true,
  }))), [
    ['marker-name', 'marker.error_virtual_name'],
    ['marker-run-target', 'marker.error_run_target'],
    ['marker-value-badge-source', 'marker.error_value_badge_source'],
  ]);

  assert.deepEqual(fields(markerProblems(baseMarker({ name: 'Lamp' }))), []);
  assert.deepEqual(fields(markerProblems(baseMarker({ tapAction: 'run', tapTarget: 'script.good' }))), []);
  assert.deepEqual(fields(markerProblems(baseMarker({
    valueBadgeTouched: true,
    valueBadgeEnabled: true,
    valueBadgeSource: { entity: 'sensor.value' },
  }))), []);
  assert.deepEqual(fields(markerProblems(baseMarker({
    valueBadgeTouched: false,
    valueBadgeEnabled: true,
    valueBadgeSource: null,
  }))), []);
});

// #631 AC2: каждый код ошибки четырёх форм и пустой список — юнитом. Порядок
// ошибок — порядок полей формы: «Review N fields» ведёт к первому сверху.

test('#631 generalProblems: empty list for a valid draft, glow before north when both fail', () => {
  assert.deepEqual(fields(generalProblems(generalDraft('25', '90'))), []);
  assert.deepEqual(fields(generalProblems(generalDraft('', '400'))), [
    ['gs-glow-radius', 'gs.error_glow_radius'],
    ['gs-north', 'gs.error_north'],
  ]);
});

test('#631 spaceDialogProblems: title and plan codes, empty list for a valid draft', () => {
  assert.deepEqual(spaceFields(), []);
  assert.deepEqual(spaceFields({ title: '   ' }), [['space-title', 'space.error_title']]);
  assert.deepEqual(spaceFields({ source: 'file' }), [['space-plan', 'space.error_plan']]);
  assert.deepEqual(spaceFields({ source: 'file', planUrl: '/local/plan.png' }), []);
  assert.deepEqual(spaceFields({ source: 'file', planFile: { ext: 'png', b64: 'AA', aspect: 1, name: 'p.png' } }), []);
  // Температура проверяется только в режиме заливки «температура».
  assert.deepEqual(spaceFields({ fillMode: 'light', tempMinInput: '', tempMaxInput: 'x' }), []);
  // Сырой ввод отсутствует — судится сохранённое число.
  assert.deepEqual(spaceFields({ cellCmInput: undefined, cellCm: 5 }), []);
  assert.deepEqual(spaceFields({ fillMode: 'temp', tempMinInput: undefined, tempMaxInput: undefined }), []);
  // Префикс идентификатора поля берётся от вызывающего.
  assert.deepEqual(fields(spaceDialogProblems(baseSpace({ title: '' }), 'sd2')), [['sd2-title', 'space.error_title']]);
});

test('#631 spaceDialogProblems: all problems at once come in form order', () => {
  assert.deepEqual(spaceFields({
    title: '', cellCmInput: 'x', source: 'file', fillMode: 'temp',
    tempMinInput: '', tempMaxInput: '', northDeg: 0, northDegInput: '400',
  }), [
    ['space-title', 'space.error_title'],
    ['space-cell-cm', 'space.error_scale'],
    ['space-plan', 'space.error_plan'],
    ['space-temp-min', 'space.error_temp_value'],
    ['space-temp-max', 'space.error_temp_value'],
    ['space-north-deg', 'space.error_north'],
  ]);
});

test('#631 markerProblems: HA mode requires a real binding; all four codes come in form order', () => {
  const bindingError = [['marker-binding', 'marker.error_binding']];
  assert.deepEqual(fields(markerProblems(baseMarker({ bindingMode: 'ha', binding: '' }))), bindingError);
  assert.deepEqual(fields(markerProblems(baseMarker({ bindingMode: 'ha', binding: null }))), bindingError);
  // «virtual» в режиме HA — не привязка; имя при этом проверяется как у виртуального.
  assert.deepEqual(fields(markerProblems(baseMarker({ bindingMode: 'ha', binding: 'virtual' }))), bindingError);
  assert.deepEqual(fields(markerProblems(baseMarker({ bindingMode: 'ha', binding: 'light.kitchen', name: '' }))), []);
  assert.deepEqual(fields(markerProblems(baseMarker({
    bindingMode: 'ha', binding: 'virtual', name: '', tapAction: 'run',
    valueBadgeTouched: true, valueBadgeEnabled: true,
  }))), [
    ['marker-name', 'marker.error_virtual_name'],
    ['marker-binding', 'marker.error_binding'],
    ['marker-run-target', 'marker.error_run_target'],
    ['marker-value-badge-source', 'marker.error_value_badge_source'],
  ]);
});

test('#631 markerProblems: the Run target follows the effective tap action, not the stored one', () => {
  const runError = [['marker-run-target', 'marker.error_run_target']];
  assert.deepEqual(fields(markerProblems(baseMarker({ tapAction: 'more-info' }), 'run')), runError);
  assert.deepEqual(fields(markerProblems(baseMarker({ tapAction: 'run' }), 'toggle')), []);
  assert.deepEqual(fields(markerProblems(baseMarker({ tapAction: 'run' }))), runError);
});

const baseRoom = (patch = {}) => ({
  _nameSel: 'Kitchen', _areaSel: '', _roomEditId: 'r1', _roomTempMin: '', _roomTempMax: '', ...patch,
});
const roomFields = (patch) => fields(roomProblems(baseRoom(patch)));

test('#631 roomProblems: edit needs a name, create needs a name or an area', () => {
  const nameError = [['room-name', 'room.error_name']];
  assert.deepEqual(roomFields({}), []);
  assert.deepEqual(roomFields({ _nameSel: '   ' }), nameError);
  // В edit зона имя не заменяет.
  assert.deepEqual(roomFields({ _nameSel: '', _areaSel: 'kitchen' }), nameError);
  // В create — заменяет.
  assert.deepEqual(roomFields({ _roomEditId: null, _nameSel: '', _areaSel: 'kitchen' }), []);
  assert.deepEqual(roomFields({ _roomEditId: null, _nameSel: 'Hall', _areaSel: '' }), []);
  assert.deepEqual(roomFields({ _roomEditId: null, _nameSel: '  ', _areaSel: '' }), nameError);
});

test('#631 roomProblems: comfort bounds are numbers or empty; name comes before the range', () => {
  const rangeError = [['room-temp-min', 'room.error_temp_range']];
  for (const [min, max] of [['', ''], ['18', ''], ['', '24'], ['18,5', '24'], ['24', '18']]) {
    assert.deepEqual(roomFields({ _roomTempMin: min, _roomTempMax: max }), [], `${min}..${max}`);
  }
  for (const [min, max] of [['cold', ''], ['', 'hot'], ['18', 'x']]) {
    assert.deepEqual(roomFields({ _roomTempMin: min, _roomTempMax: max }), rangeError, `${min}..${max}`);
  }
  assert.deepEqual(roomFields({ _nameSel: '', _roomTempMin: 'x' }), [
    ['room-name', 'room.error_name'],
    ['room-temp-min', 'room.error_temp_range'],
  ]);
});
