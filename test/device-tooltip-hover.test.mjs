import test from 'node:test';
import assert from 'node:assert/strict';
import {showDevicePointerTip, showDeviceFocusTip, clearPointerHover,
  refreshDeviceTip, resetHouseplanHover} from '../test-build/live-hover.js';

const device = id => ({id, name: id, model: 'Model', entities: [],
  bindingKind: 'device', bindingRef: id, marker: {binding: `device:${id}`}});
const fixture = t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const host = {_devices: [device('a'), device('b')], _mode: 'view', _space: 'f1', isConnected: true,
    _drag: null, _deviceDrag: null, _tip: null, _hoverRoom: null,
    renderRoot: {querySelector: () => null}, _settings: {}, _config: null,
    _pointerModality: {hoverEnabled: true}, _notePointer: () => {}, _deviceHits: {hover: () => {}},
    _spaceDisplayForRender: () => ({}), _renderPlanHass: null, _fullRegistryHass: null, _t: key => key,
    _devicePresentation: () => ({haDisabled: false, valueBadge: null, lqiTipText: null,
      lqiSource: null, offline: false, powerOff: false})};
  t.after(() => resetHouseplanHover(host));
  return host;
};
const point = (x=10, y=20) => ({clientX: x, clientY: y});

test('#1409 pointer dwell uses the latest pending point and data, then holds its anchor', t => {
  const host = fixture(t);
  showDevicePointerTip(host, point(), host._devices[0]);
  t.mock.timers.tick(100);
  showDevicePointerTip(host, point(12, 24), host._devices[0]);
  t.mock.timers.tick(49); assert.equal(host._tip, null);
  host._devices[0] = {...host._devices[0], name: 'Current name'};
  t.mock.timers.tick(1);
  assert.equal(host._tip.title, 'Current name');
  assert.deepEqual([host._tip.x, host._tip.y], [12, 24]);
  showDevicePointerTip(host, point(80, 90), host._devices[0]);
  assert.deepEqual([host._tip.x, host._tip.y], [12, 24]);
  host._devices[0] = {...host._devices[0], model: 'Current model'};
  refreshDeviceTip(host);
  assert.equal(host._tip.meta, 'Current model');
  assert.deepEqual([host._tip.x, host._tip.y], [12, 24]);
});

test('#1409 a short visit or an obsolete neighbour timer cannot show a tooltip', t => {
  const host = fixture(t);
  showDevicePointerTip(host, point(), host._devices[0]);
  t.mock.timers.tick(70); clearPointerHover(host);
  t.mock.timers.tick(200); assert.equal(host._tip, null);
  showDevicePointerTip(host, point(), host._devices[0]);
  t.mock.timers.tick(75);
  showDevicePointerTip(host, point(50, 60), host._devices[1]);
  t.mock.timers.tick(75); assert.equal(host._tip, null, 'old A deadline cannot open B early');
  t.mock.timers.tick(75); assert.equal(host._tip.deviceId, 'b');
  clearPointerHover(host); t.mock.timers.tick(300); assert.equal(host._tip, null);
});

test('#1409 pending pointer ownership is fenced by its mode, space, connection, modality and binding', t => {
  const host = fixture(t);
  for (const change of [
    h => {h._mode = 'plan';}, h => {h._space = 'f2';}, h => {h.isConnected = false;},
    h => {h._pointerModality.hoverEnabled = false;}, h => {h._drag = {};}, h => {h._deviceDrag = {};},
    h => {h._devices = [];}, h => {h._devices[0] = {...h._devices[0], bindingRef: 'other'};},
  ]) {
    Object.assign(host, {_mode: 'view', _space: 'f1', isConnected: true, _drag: null,
      _deviceDrag: null, _devices: [device('a'), device('b')], _pointerModality: {hoverEnabled: true}});
    showDevicePointerTip(host, point(), host._devices[0]);
    t.mock.timers.tick(100); change(host); t.mock.timers.tick(100);
    assert.equal(host._tip, null, String(change));
  }
});

test('#1409 hard reset retires a pending lease even after returning to the same context', t => {
  const host = fixture(t);
  showDevicePointerTip(host, point(), host._devices[0]);
  t.mock.timers.tick(100); resetHouseplanHover(host);
  t.mock.timers.tick(100); assert.equal(host._tip, null);
  showDevicePointerTip(host, point(), host._devices[0]);
  t.mock.timers.tick(150); assert.equal(host._tip.deviceId, 'a');
  resetHouseplanHover(host); assert.equal(host._tip, null);
  t.mock.timers.tick(300); assert.equal(host._tip, null);
});

test('#1409 visible keyboard focus is immediate and cancels a pending pointer claim', t => {
  const host = fixture(t), target = {matches: () => true, getBoundingClientRect: () => ({right: 42, top: 18})};
  showDevicePointerTip(host, point(), host._devices[0]);
  t.mock.timers.tick(100); showDeviceFocusTip(host, target, host._devices[1]);
  assert.equal(host._tip.source, 'focus'); assert.equal(host._tip.deviceId, 'b');
  t.mock.timers.tick(300); assert.equal(host._tip.deviceId, 'b');
  clearPointerHover(host); assert.equal(host._tip.deviceId, 'b');
});
