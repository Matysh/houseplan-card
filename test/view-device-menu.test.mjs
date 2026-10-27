import test from 'node:test';
import assert from 'node:assert/strict';
import { ViewDeviceMenu } from '../test-build/view-device-menu.js';

const settle = async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); };
function fixture(writer = true) {
  const log = [], marker = { id: 'one', binding: 'entity:light.one' };
  let device = { id: 'one', space: 'f', name: 'Lamp', bindingKind: 'entity', bindingRef: 'light.one',
    marker, primary: 'light.one', entities: ['light.one'], hidden: false,
    bindingStatus: { kind: 'active', enabledEntityIds: ['light.one'], allEntityIds: ['light.one'] } };
  const h = { _canEdit: writer, _kiosk: false, _devicePositionBusy: false, _otherDialogsBlocked: false,
    _markers: [marker], hass: { states: { 'light.one': { state: 'on' } } }, _fullRegistryHass: {},
    ownerDocument: {}, requestUpdate() {}, _t: key => key,
    _openMoreInfo: entity => log.push(['ha', entity]),
    _openMarkerDialog: (target, view, current) => log.push(['settings', target.id, view, current()]),
    _ensureEditorRuntime: async () => true,
    _editorRuntime: { _runViewDeviceMenuAction: async (target, command, hidden, current) => log.push([command, target.id, hidden, current()]) },
  };
  const menu = new ViewDeviceMenu(h);
  const request = { target: null, x: 50, y: 60, current: () => device };
  const open = () => { menu.open(request); menu.render(); return menu.presentation.model.items; };
  return { h, menu, log, open, request, replace: value => { device = value; }, get device() { return device; } };
}
test('#1089 read-only preserves five ordered rows and refuses writer callbacks', async () => {
  const f = fixture(false), items = f.open();
  assert.deepEqual(items.map(item => item.key), ['settings', 'ha', 'info', 'visibility', 'delete']);
  assert.deepEqual(items.map(item => !!item.disabled), [true, false, false, true, true]);
  for (const i of [0, 3, 4]) items[i].invoke();
  await settle(); assert.deepEqual(f.log, []);
  items[1].invoke(); await settle(); assert.deepEqual(f.log, [['ha', 'light.one']]);
});
test('#1089 card and HA commands are separate, use a fresh target and never run tap_action', async () => {
  const f = fixture(); f.device.tapAction = 'toggle';
  const items = f.open();
  f.replace({ ...f.device, name: 'Fresh', primary: 'sensor.unrelated' });
  items[2].invoke(); await settle(); assert.equal(f.h._infoCard.name, 'Fresh'); assert.deepEqual(f.log, []);
  f.h.hass.states = {}; const next = f.open(); assert.equal(next[1].disabled, true);
  next[1].invoke(); await settle(); assert.deepEqual(f.log, []);
});
test('#1089 hidden-eye uses saved hidden, inactive HA cannot be shown, virtual retains its own card', () => {
  const f = fixture(); f.h._markers[0].hidden = true;
  assert.equal(f.open()[3].label, 'view.menu_show');
  f.replace({ ...f.device, bindingStatus: { kind: 'ha_disabled', reason: 'entity', enabledEntityIds: [], allEntityIds: [] } });
  assert.equal(f.open()[3].disabled, true);
  f.replace({ ...f.device, virtual: true, bindingKind: 'virtual', marker: { ...f.device.marker, binding: 'virtual' } });
  const items = f.open(); assert.equal(items[1].disabled, true); assert.equal(items[2].disabled, false);
});
test('#1089 accepted selection survives normal menu close, external retirement cancels held load', async () => {
  for (const retire of [false, true]) {
    const f = fixture(); let release;
    f.h._ensureEditorRuntime = () => new Promise(resolve => { release = resolve; });
    f.open()[4].invoke(); assert.equal(f.menu.menu, null);
    if (retire) f.menu.close(); release(true); await settle();
    assert.equal(f.log.length, retire ? 0 : 1);
    if (!retire) assert.deepEqual(f.log[0], ['delete', 'one', false, true]);
  }
});
test('#1089 replaced owner, removed target and revoked write permission cannot dispatch', async () => {
  const f = fixture(), old = f.open(); f.menu.close(); old[0].invoke(); await settle();
  assert.deepEqual(f.log, []);
  const current = f.open(); f.h._canEdit = false; current[4].invoke(); await settle(); assert.deepEqual(f.log, []);
  f.replace(null); current[2].invoke(); await settle(); assert.equal(f.h._infoCard, undefined);
});
test('#1089 outside close consumes only its compatibility click until fresh input', () => {
  const f = fixture(); f.open(); f.menu.presentation.model.outside({ pointerId: 8, preventDefault() {}, stopImmediatePropagation() {} });
  let swallowed = 0; const event = { pointerId: 8, preventDefault() { swallowed++; }, stopImmediatePropagation() {} };
  f.menu.closingClick(event); assert.equal(swallowed, 1);
  f.menu.closingClick(event); assert.equal(swallowed, 1);
  f.menu.closingPointer = 8; f.menu.freshInput(); f.menu.closingClick(event); assert.equal(swallowed, 1);
});
