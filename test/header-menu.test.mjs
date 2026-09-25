// #616: состав меню шестерёнки телефонной шапки — ТЗ п.4. Порядок фиксирован,
// условия те же, что у прежних кнопок: редакторы и настройки — только с правом
// записи, «Добавить пространство» — без фиксированного пространства, сводная
// панель — только в просмотре, в киоске меню нет; 2.5D — не пункт меню (#649).
import assert from 'node:assert/strict';
import test from 'node:test';
import { headerMenuItems } from '../test-build/header-menu.js';

const calls = [];
const actions = {
  setMode: (m) => calls.push(`mode:${m}`), configureSpace: () => calls.push('configure'),
  addSpace: () => calls.push('add'), settings: () => calls.push('settings'), pdf: () => calls.push('pdf'),
  support: () => calls.push('support'),
};
const summary = [{ id: 'summary-settings', label: 's', run: () => calls.push('summary-settings') },
  { id: 'summary-toggle', label: 't', pressed: false, run: () => calls.push('summary-toggle') }];
const input = (over = {}) => ({
  canEdit: true, kiosk: false, mode: 'view', hasFixedFloor: false,
  summary, t: (key) => `«${key}»`, actions, ...over,
});
const ids = (over) => headerMenuItems(input(over)).map((item) => item.id);
const ADMIN = ['mode-plan', 'mode-devices', 'mode-decor', 'space-settings', 'space-add', 'settings', 'pdf', 'support'];

test('#616 админ в просмотре: редакторы · пространство · приложение · сводная панель — в этом порядке', () => {
  assert.deepEqual(ids(), [...ADMIN, 'summary-settings', 'summary-toggle']);
});

test('#616 не-админ: только сводная панель; без неё меню пусто — кнопки нет', () => {
  assert.deepEqual(ids({ canEdit: false }), ['summary-settings', 'summary-toggle']);
  assert.deepEqual(ids({ canEdit: false, summary: [] }), []);
});

test('#616 редактор: сводной панели нет, текущий редактор отмечен', () => {
  const items = headerMenuItems(input({ mode: 'devices' }));
  assert.deepEqual(items.map((i) => i.id), ADMIN);
  assert.deepEqual(items.filter((i) => i.current).map((i) => i.id), ['mode-devices']);
});

test('#616 фиксированное пространство убирает «Добавить пространство», киоск — всё меню', () => {
  assert.ok(!ids({ hasFixedFloor: true }).includes('space-add'));
  assert.ok(ids({ hasFixedFloor: true }).includes('space-settings'));
  assert.deepEqual(ids({ kiosk: true }), []);
  assert.deepEqual(ids({ kiosk: true, canEdit: false }), []);
});

test('#649 2.5D не пункт меню: он в «Общих настройках», для всех ролей и режимов', () => {
  for (const over of [{}, { canEdit: false }, { mode: 'plan' }]) {
    assert.ok(!ids(over).includes('projection'), JSON.stringify(over));
  }
});

test('#616 каждый пункт вызывает то же действие, что прежняя кнопка', () => {
  calls.length = 0;
  for (const item of headerMenuItems(input())) item.run();
  assert.deepEqual(calls, ['mode:plan', 'mode:devices', 'mode:decor', 'configure', 'add', 'settings', 'pdf', 'support',
    'summary-settings', 'summary-toggle']);
});

test('#616 подписи — существующие ключи интерфейса', () => {
  assert.deepEqual(headerMenuItems(input({ summary: [] })).map((i) => i.label), [
    '«mode.plan»', '«mode.devices»', '«mode.decor»', '«title.configure_space»', '«title.add_space»',
    '«title.general_settings»', '«title.export_pdf»', '«support.title»',
  ]);
});
