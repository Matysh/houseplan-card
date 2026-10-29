// #616: состав меню шестерёнки телефонной шапки — ТЗ п.4. Порядок фиксирован,
// условия те же, что у прежних кнопок: редакторы и настройки — только с правом
// записи, «Добавить пространство» — без фиксированного пространства, сводная
// панель — только в просмотре, в киоске меню нет; 2.5D — не пункт меню (#649).
import assert from 'node:assert/strict';
import test from 'node:test';
import { HeaderMenu, headerMenuItems } from '../test-build/header-menu.js';

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

test('#919 reveal is local presentation available in every full-card mode and to read-only users', () => {
  for (const mode of ['view', 'plan', 'devices', 'decor']) {
    for (const canEdit of [true, false]) {
      let runs = 0;
      const supplied = { ...actions, toggleHidden: () => runs++ };
      const items = headerMenuItems(input({ mode, canEdit, showHidden: true, actions: supplied }));
      const eye = items.find(item => item.id === 'hidden-devices');
      assert.ok(eye);
      assert.equal(eye.pressed, true);
      assert.equal(eye.icon, 'mdi:eye-outline');
      assert.equal(eye.label, '«hidden_devices.show»');
      if (canEdit) assert.equal(items[items.indexOf(eye) - 1].id, 'support');
      if (mode === 'view') assert.equal(items[items.indexOf(eye) + 1].id, 'summary-settings');
      eye.run(); assert.equal(runs, 1);
    }
  }
  const actionsWithEye = { ...actions, toggleHidden() {} };
  assert.equal(headerMenuItems(input({ showHidden: false, actions: actionsWithEye }))
    .find(item => item.id === 'hidden-devices').icon, 'mdi:eye-off-outline');
  assert.deepEqual(headerMenuItems(input({ kiosk: true, actions: actionsWithEye })), []);
});

test('#1120 repeated active-tab reveal preserves manual scrolling without a synchronous layout read', () => {
  let width = 0, widthReads = 0, rectReads = 0;
  let active = { id: 'first', left: 120, right: 150 };
  const tab = {
    get dataset() { return { id: active.id }; },
    getBoundingClientRect() { rectReads++; return active; },
  };
  const nav = {
    scrollLeft: 0,
    get clientWidth() { widthReads++; return width; },
    querySelector() { return tab; },
    getBoundingClientRect() { rectReads++; return { left: 0, right: 100 }; },
  };
  const menu = new HeaderMenu({ renderRoot: { querySelector() { return nav; } }, requestUpdate() {} });
  menu.revealActiveTab();
  assert.equal(rectReads, 0, 'a hidden initial nav has no scroll geometry');
  width = 100;
  menu.revealActiveTab();
  assert.equal(nav.scrollLeft, 50, 'the same tab is still revealed after the hidden nav becomes measurable');
  const initialReads = [widthReads, rectReads];
  nav.scrollLeft = 17; // A manual scroll must survive ordinary hass/Save updates.
  for (let update = 0; update < 3; update++) menu.revealActiveTab();
  assert.equal(nav.scrollLeft, 17);
  assert.deepEqual([widthReads, rectReads], initialReads, 'unchanged active space must not force layout');
  active = { id: 'second', left: -20, right: 30 };
  width = 0;
  menu.revealActiveTab();
  assert.equal(nav.scrollLeft, 17, 'a hidden changed tab must wait');
  width = 100;
  menu.revealActiveTab();
  assert.equal(nav.scrollLeft, -3, 'the new id still scrolls into view once measurable');
});
