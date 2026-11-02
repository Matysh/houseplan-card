import assert from 'node:assert/strict';
import test from 'node:test';
import { StairViewRuntime } from '../test-build/stairs-view.js';
import { defaultStair } from '../test-build/stairs-editor-model.js';

const stair = (id, target, kind = 'straight') => ({
  ...defaultStair(kind), id, target_space_id: target, x: .4, y: .4,
});
const bound = (template, name) => template.values[template.strings.findIndex(s => s.trimEnd().endsWith(`${name}=`))];
const highlights = layer => layer.values[0].filter(item => item.values.some(value =>
  value?.values?.[1]?.strings?.join('').includes('data-hp="stair-arrival"')));
function fixture(backs = [stair('back', 'a'), stair('spiral', 'a', 'spiral'), stair('other', 'c')]) {
  const floors = [{ id: 'a', stairs: [stair('go', 'b')] }, { id: 'b', stairs: backs }, { id: 'c', stairs: [] }];
  const timers = new Map(); let serial = 0;
  const clock = { setTimeout(fn, ms) { timers.set(++serial, { fn, ms }); return serial; }, clearTimeout(id) { timers.delete(id); } };
  const host = { _mode: 'view', _model: floors, _space: 'a', _hasFixedFloor: false, _suppressClick: false,
    _cellCm: 5, _gridPitch: 1, _decorStyle: { color: '#aaa', opacity: 1 }, requests: 0,
    get _curSpaceCfg() { return floors.find(f => f.id === this._space); },
    _tabClick(id) { runtime.clearArrival(); this._space = id; }, requestUpdate() { this.requests++; },
    _t: key => key, _showTip() {}, _clearPointerHover() {} };
  const runtime = new StairViewRuntime(host, clock);
  const activate = (type = 'click', key = 'Enter', template = runtime.renderLayer().values[0][0]) =>
    bound(template, type === 'keydown' ? '@keydown' : '@click')({ type, key, stopPropagation() {}, preventDefault() {} });
  return { host, runtime, timers, activate, floors };
}

test('arrival highlights all and only reciprocal stairs, using their cached outline without writing data', () => {
  const f = fixture(); const before = JSON.stringify(f.floors);
  f.activate(); assert.equal(f.host._space, 'b'); assert.equal(f.timers.size, 0);
  f.runtime.updated(); assert.equal(f.timers.size, 0, 'no clock until destination layer commits');
  const layer = f.runtime.renderLayer();
  assert.equal(highlights(layer).length, 2);
  for (const item of highlights(layer)) {
    const overlay = item.values.find(value => value?.values?.[1]?.strings?.join('').includes('stair-arrival')).values[1];
    assert.equal(bound(overlay, 'points'), bound(item, 'points'), 'same real outline');
  }
  f.runtime.updated(); f.runtime.updated(); assert.equal(f.timers.size, 1);
  const timer = [...f.timers.values()][0]; assert.equal(timer.ms, 2000);
  f.runtime.clearGesture(); assert.equal(highlights(f.runtime.renderLayer()).length, 2, 'gesture cleanup preserves arrival');
  timer.fn(); assert.equal(highlights(f.runtime.renderLayer()).length, 0);
  assert.equal(JSON.stringify(f.floors), before);
});

test('no reciprocal stair or failed navigation creates no feedback or timer', () => {
  for (const backs of [[], [stair('other', 'c')]]) {
    const f = fixture(backs); f.activate(); f.runtime.renderLayer(); f.runtime.updated();
    assert.equal(f.host._space, 'b'); assert.equal(f.timers.size, 0); assert.equal(f.host.requests, 0);
  }
  const f = fixture(); f.host._tabClick = () => {}; f.activate();
  assert.equal(f.host.requests, 0); assert.equal(f.timers.size, 0);
});

test('invalid, fixed, stale and gesture-suppressed activations remain inert', () => {
  for (const change of [f => f.host._hasFixedFloor = true, f => f.host._suppressClick = true,
    f => f.host._mode = 'plan', f => f.host._space = 'c', f => f.floors.splice(1, 1),
    f => f.floors[0].stairs[0].target_space_id = 'a']) {
    const f = fixture(); const item = f.runtime.renderLayer().values[0][0]; change(f); const space = f.host._space;
    f.activate('click', '', item); assert.equal(f.host._space, space); assert.equal(f.host.requests, 0);
  }
  const f = fixture(); f.runtime.pointerDown({ pointerType: 'touch', pointerId: 1 });
  f.runtime.pointerCancel({ pointerId: 1 }); f.activate(); assert.equal(f.host._space, 'a');
  f.activate('keydown', ' '); assert.equal(f.host._space, 'b', 'keyboard remains independently usable');
});

test('departure, editor entry, disconnect and repeated arrivals clear timers and restart identity', () => {
  for (const leave of [f => f.runtime.clearArrival(), f => f.host._space = 'a', f => f.host._mode = 'decor', f => f.runtime.disconnect()]) {
    const f = fixture(); f.activate(); f.runtime.renderLayer(); f.runtime.updated(); leave(f); f.runtime.updated();
    assert.equal(f.timers.size, 0); assert.equal(highlights(f.runtime.renderLayer()).length, 0);
  }
  const f = fixture(); f.activate(); const first = f.runtime.renderLayer(); f.runtime.updated();
  const old = [...f.timers.values()][0];
  f.activate(); f.runtime.renderLayer(); f.runtime.updated(); // b -> a
  f.activate(); const second = f.runtime.renderLayer(); f.runtime.updated(); // a -> b
  const token = layer => highlights(layer)[0].values.find(v => v?.values?.[1]?.strings?.join('').includes('stair-arrival')).values[0];
  assert.notEqual(token(first), token(second)); assert.equal(f.timers.size, 1);
  old.fn(); assert.equal(highlights(f.runtime.renderLayer()).length, 2, 'stale timeout cannot end new feedback');
});
