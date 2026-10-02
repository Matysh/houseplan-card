// #780 stage 4: the Devices-editor LED tool (ТЗ §4, §5) against a structural
// host — clean-click input, chain/undo/Esc order, one transaction per command,
// atomic links, conversion and the guarded LED history. Results are judged,
// not the source text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLedStripEditor } from '../test-build/led-strip-editor.js';

globalThis.window ??= { matchMedia: () => ({ matches: false }) };
globalThis.queueMicrotask ??= (fn) => Promise.resolve().then(fn);

function setup({ strips = [], markers = [], devices = [], fail = false } = {}) {
  const pushed = [];
  const toasts = [];
  const rolled = [];
  const saves = [];
  const dialogs = [];
  const space = { id: 's', vb: [0, 0, 1000, 1000], rooms: [], partitions: [], wall_columns: [], wall_segments: [], stairs: [] };
  const host = {
    hass: { states: {}, language: 'en' }, _config: { language: 'en' },
    _serverCfg: { spaces: [{ id: 's', led_strips: strips }, { id: 'other', led_strips: [] }], markers, settings: {} },
    _curSpaceCfg: {}, _space: 's', _mode: 'devices', _devices: devices, _suppressClick: false,
    _markerDialog: null, _cellCm: 5, _gridPitch: 10, _wallKeyPitch: 10, _spaceWalls: [], _openingsR: [],
    _devicePositionHistory: { push: (command) => pushed.push(command) },
    _adoption: { beginOptimistic: (base, candidate) => ({ base, candidate }), stageLocalConfig: (config) => { host._serverCfg = config; } },
    _saveConfigDebounced: { pending: () => false, cancel: () => {} },
    _regSignature: 'x',
    _spaceModel: () => space, _floorKey: () => 'k', _screenToVb: (x, y) => [x, y], _openCuts: () => [],
    _roomWallOpeningInputs: () => [], _partitionOpeningCuts: () => [],
    _rollbackOptimistic: (attempt) => { rolled.push(attempt); host._serverCfg = attempt.base; return true; },
    _maybeRebuildDevices: () => {}, _showToast: (message) => toasts.push(message), _errText: (e) => String(e?.message || e),
    requestUpdate: () => {},
    _editorRuntime: {
      _svgPoint: (ev) => [ev.clientX, ev.clientY],
      _snap: (p) => p,
      _prepareConfigCandidate: (c) => c,
      _saveConfigNow: async (attempt) => { saves.push(attempt.candidate); if (fail) throw new Error('offline'); },
      _openMarkerDialog: (d) => { dialogs.push(d); host._markerDialog = { devId: d?.id }; },
    },
  };
  const led = createLedStripEditor(host);
  return { led, host, pushed, toasts, rolled, saves, dialogs };
}

const ev = (x, y, extra = {}) => ({ clientX: x, clientY: y, pointerId: 1, button: 0, pointerType: 'mouse', detail: 1, shiftKey: false, ...extra });
const click = (led, x, y, extra = {}) => {
  led.onDown(ev(x, y, extra));
  led.onUp(ev(x, y, extra));
};
const stripsOf = (host, id = 's') => host._serverCfg.spaces.find((space) => space.id === id).led_strips;
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

test('ТЗ §4 п.2, п.6: only a clean click adds a point — drag, second finger, cancel and synthetic clicks do not', () => {
  const { led, host } = setup();
  led.open();
  click(led, 100, 100);
  assert.equal(led.chain.points.length, 1);
  // A pan: the pointer travels past the slop before release.
  led.onDown(ev(200, 100));
  led.onMove(ev(260, 100));
  led.onUp(ev(260, 100));
  assert.equal(led.chain.points.length, 1, 'pan is not a point');
  // A pinch: a second finger joins.
  led.onDown(ev(300, 100, { pointerId: 1, pointerType: 'touch' }));
  led.onDown(ev(320, 100, { pointerId: 2, pointerType: 'touch' }));
  led.onUp(ev(300, 100, { pointerId: 1, pointerType: 'touch' }));
  led.onUp(ev(320, 100, { pointerId: 2, pointerType: 'touch' }));
  assert.equal(led.chain.points.length, 1, 'pinch is not a point');
  // pointercancel ends the sequence without a point.
  led.onDown(ev(400, 100));
  led.onCancel(ev(400, 100));
  led.onUp(ev(400, 100));
  assert.equal(led.chain.points.length, 1, 'cancel is not a point');
  // The synthetic click after navigation is suppressed by the card.
  host._suppressClick = true;
  click(led, 500, 100);
  assert.equal(led.chain.points.length, 1, 'suppressed click is not a point');
  host._suppressClick = false;
  click(led, 500, 100);
  assert.equal(led.chain.points.length, 2);
  // A repeat click on the last point writes no zero segment.
  click(led, 500, 100);
  assert.equal(led.chain.points.length, 2);
});

test('ТЗ §4 п.3, п.9: Ctrl+Z removes the chain point first; Esc finishes, then leaves, then deselects', async () => {
  const { led, host, pushed } = setup();
  led.open();
  click(led, 100, 100);
  click(led, 300, 100);
  click(led, 300, 300);
  assert.equal(led.key({ key: 'z' }, true), true);
  assert.equal(led.chain.points.length, 2, 'own point, not someone else’s command');
  assert.equal(pushed.length, 0);
  assert.equal(led.key({ key: 'Escape' }, false), true);
  await settle();
  const strips = stripsOf(host);
  assert.equal(strips.length, 1, 'Esc finished the correct chain, it did not roll back');
  assert.deepEqual(strips[0].points, [[0.1, 0.1], [0.3, 0.1]]);
  assert.equal(strips[0].marker, null);
  assert.equal(led.picker, strips[0].id, 'the device picker opens after a new strip');
  assert.equal(pushed.length, 1);
  assert.equal(pushed[0].before.strip, null);
  assert.equal(led.key({ key: 'Escape' }, false), true, 'Esc closes the picker first');
  assert.equal(led.picker, null);
  assert.equal(led.key({ key: 'Escape' }, false), true);
  assert.equal(led.sel, null, 'then drops the selection');
  assert.equal(led.key({ key: 'z' }, true), false, 'without a chain Ctrl+Z is the history’s');
});

test('ТЗ §4 п.4, п.5: a click on the first point closes a ≥3-vertex chain; <2 distinct points writes nothing', async () => {
  const { led, host, saves } = setup();
  led.open();
  click(led, 100, 100);
  click(led, 300, 100);
  click(led, 300, 300);
  click(led, 102, 101);
  await settle();
  const strip = stripsOf(host)[0];
  assert.deepEqual(strip.points[0], strip.points[strip.points.length - 1], 'last stored point equals the first');
  assert.equal(strip.points.length, 4);
  led.open();
  click(led, 600, 600);
  led.close();
  await settle();
  assert.equal(stripsOf(host).length, 1, 'a one-point chain is dropped');
  assert.equal(saves.length, 1);
});

test('ТЗ §4 п.3: leaving the tool finishes an unfinished correct chain without an extra segment', async () => {
  const { led, host } = setup();
  led.open();
  click(led, 100, 100);
  led.onMove(ev(400, 400));
  click(led, 200, 100);
  led.close();
  await settle();
  assert.deepEqual(stripsOf(host)[0].points, [[0.1, 0.1], [0.2, 0.1]], 'the hover preview is not a point');
});

test('ТЗ §5: binding creates the live marker with the strip space; a taken marker is refused', async () => {
  const devices = [
    { id: 'lamp', name: 'Lamp', entities: ['light.lamp'], space: 's', bindingKind: 'device', bindingRef: 'lamp', icon: '' },
    { id: 'fan', name: 'Fan', entities: ['fan.f'], space: 's', bindingKind: 'device', bindingRef: 'fan', icon: '' },
  ];
  const { led, host, toasts } = setup({
    devices,
    strips: [{ id: 'a', points: [[0, 0], [0.1, 0]], marker: null }, { id: 'b', points: [[0, 0.2], [0.1, 0.2]], marker: 'fan' }],
    markers: [{ id: 'fan', binding: 'device:fan', space: 's' }],
  });
  await led.bind('a', 'lamp');
  const strip = stripsOf(host).find((item) => item.id === 'a');
  assert.equal(strip.marker, 'lamp');
  assert.notEqual(strip.active, false);
  assert.deepEqual(host._serverCfg.markers.find((item) => item.id === 'lamp'), { id: 'lamp', binding: 'device:lamp', space: 's' });
  await led.bind('a', 'fan');
  assert.equal(stripsOf(host).find((item) => item.id === 'a').marker, 'lamp', 'not silently taken from strip b');
  assert.equal(toasts.at(-1), 'Already bound to another LED strip');
});

test('ТЗ §5: "Show as icon" keeps the shape hidden; "Show as strip" restores the same record', async () => {
  const shape = { id: 'a', points: [[0, 0], [0.1, 0], [0.1, 0.1]], marker: 'lamp' };
  const { led, host, pushed } = setup({ strips: [shape], markers: [{ id: 'lamp', binding: 'device:lamp', space: 's' }] });
  led.select('a');
  await led.setActive('a', false);
  assert.deepEqual(stripsOf(host)[0], { ...shape, active: false });
  assert.equal(led.sel, null);
  await led.setActive('a', true);
  assert.deepEqual(stripsOf(host)[0], { ...shape, active: true }, 'points, closure and id kept exactly');
  assert.equal(pushed.length, 2, 'each representation change is one command');
});

test('ТЗ §5: drawing for an icon converts it in one write; Cancel converts nothing', async () => {
  const devices = [{ id: 'lamp', name: 'Lamp', entities: ['light.lamp'], space: 's', bindingKind: 'device', bindingRef: 'lamp', icon: '' }];
  const { led, host, saves } = setup({ devices, markers: [{ id: 'lamp', binding: 'device:lamp' }] });
  led.open('lamp');
  click(led, 100, 100);
  click(led, 300, 100);
  await led.finish();
  const strip = stripsOf(host)[0];
  assert.equal(strip.marker, 'lamp');
  assert.equal(strip.active, true);
  assert.equal(led.picker, null, 'no second device choice');
  assert.equal(host._serverCfg.markers[0].space, 's', 'the empty marker space is written');
  assert.equal(saves.length, 1);
  led.open('lamp');
  click(led, 500, 500);
  led.chain = null; led.tool = false; // the tray's Cancel
  await settle();
  assert.equal(stripsOf(host).length, 1);
});

test('ТЗ §4 п.9: a failed write rolls back and records nothing; a no-op is no command', async () => {
  const { led, host, pushed, rolled, toasts } = setup({ fail: true });
  led.open();
  click(led, 100, 100);
  click(led, 300, 100);
  await led.finish();
  assert.equal(rolled.length, 1);
  assert.equal(stripsOf(host).length, 0);
  assert.equal(pushed.length, 0);
  assert.match(toasts.at(-1), /offline/);
  const ok = setup({ strips: [{ id: 'a', points: [[0, 0], [0.1, 0]], marker: null }] });
  await ok.led.bind('a', null);
  assert.equal(ok.saves.length, 0);
  assert.equal(ok.pushed.length, 0);
});

test('ТЗ §4 п.9: history restores only its own strip record and never a newer foreign change', async () => {
  const { led, host } = setup({ strips: [{ id: 'a', points: [[0, 0], [0.1, 0]], marker: null }] });
  const before = { kind: 'led', spaceId: 's', stripId: 'a', strip: { id: 'a', points: [[0, 0], [0.1, 0]], marker: null } };
  const after = { kind: 'led', spaceId: 's', stripId: 'a', strip: { id: 'a', points: [[0, 0], [0.2, 0]], marker: null } };
  stripsOf(host)[0].points = [[0, 0], [0.2, 0]];
  assert.equal(await led.applyHistory(before, after), 'ok');
  assert.deepEqual(stripsOf(host)[0].points, [[0, 0], [0.1, 0]]);
  // Someone else changed the strip meanwhile: the redo is refused.
  stripsOf(host)[0].points = [[0, 0], [0.5, 0]];
  assert.equal(await led.applyHistory(after, before), 'stale');
  assert.deepEqual(stripsOf(host)[0].points, [[0, 0], [0.5, 0]]);
});

test('ТЗ §5: a rebinding renames the link, deletion unbinds, a bound marker cannot change space', () => {
  const { led, host, toasts } = setup({ strips: [{ id: 'a', points: [[0, 0], [0.1, 0]], marker: 'old', active: false }] });
  const candidate = JSON.parse(JSON.stringify(host._serverCfg));
  led.linkMarker(candidate, 'old', 'new');
  assert.equal(candidate.spaces[0].led_strips[0].marker, 'new');
  led.unlinkMarkers(candidate, new Set(['new']));
  assert.deepEqual(candidate.spaces[0].led_strips[0], { id: 'a', points: [[0, 0], [0.1, 0]], marker: null, active: true });
  assert.equal(led.markerMoveBlocked('old', 's'), false);
  assert.equal(led.markerMoveBlocked('old', 'other'), true);
  assert.match(toasts.at(-1), /Unbind the LED strip first/);
  assert.equal(led.markerMoveBlocked('free', 'other'), false);
});

test('ТЗ §5: "New device…" binds the pending strip in the dialog’s own write; closing the dialog forgets it', () => {
  const { led, host } = setup({ strips: [{ id: 'a', points: [[0, 0], [0.1, 0]], marker: null }] });
  led.picker = 'a';
  led.newDevice('a');
  const candidate = JSON.parse(JSON.stringify(host._serverCfg));
  candidate.markers.push({ id: 'v_1', binding: 'virtual' });
  led.linkMarker(candidate, undefined, 'v_1');
  assert.equal(candidate.spaces[0].led_strips[0].marker, 'v_1');
  assert.equal(candidate.markers[0].space, 's');
  led.newDevice('a');
  host._markerDialog = null;
  led.chrome();
  const other = JSON.parse(JSON.stringify(host._serverCfg));
  led.linkMarker(other, undefined, 'v_2');
  assert.equal(other.spaces[0].led_strips[0].marker, null, 'a cancelled "New device…" binds nothing later');
});

test('ТЗ §4 п.9: the card’s LED history branch — stale clears, failure restores the stack position', async () => {
  const { ledHistory } = await import('../test-build/led-strip-card.js');
  const calls = [];
  const card = {
    _ledEditor: { applyHistory: async () => card.result },
    _devicePositionBusy: false,
    _devicePositionHistory: { undo: () => calls.push('undo'), redo: () => calls.push('redo'), clear: () => calls.push('clear') },
    _t: (key) => key, _showToast: (message) => calls.push(message), requestUpdate: () => {},
  };
  const command = { name: 'LED strip', before: { kind: 'led' }, after: { kind: 'led' } };
  card.result = 'stale';
  await ledHistory(card, 'undo', command);
  assert.deepEqual(calls.splice(0), ['clear', 'history.device_stale']);
  card.result = 'failed';
  await ledHistory(card, 'undo', command);
  assert.deepEqual(calls.splice(0), ['redo'], 'the undone command goes back on the stack, no success toast');
  card.result = 'ok';
  await ledHistory(card, 'redo', command);
  assert.deepEqual(calls.splice(0), ['history.redone']);
  assert.equal(card._devicePositionBusy, false);
});
