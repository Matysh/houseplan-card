import test from 'node:test';
import assert from 'node:assert/strict';
import { DecorLineDrawing, decorLineEnd } from '../test-build/editors/decor/line-drawing.js';

function fixture() {
  const state = { context: 'floor-a', authority: true, blocked: false, preview: null, commands: [] };
  const events = new EventTarget();
  const drawing = new DecorLineDrawing({
    context: () => state.context, blocked: () => state.blocked,
    current: () => () => state.authority,
    point: event => [event.clientX, event.clientY], pitch: () => 10,
    snap: raw => raw.map(n => Math.round(n / 10) * 10),
    preview: (a, b) => { state.preview = a ? { a, b } : null; },
    commit: (a, b, before, after) => state.commands.push({ a, b, before, after }),
    queue: run => run(), cancelQueue() {}, events,
  });
  const event = (x, y, id = 1) => ({ clientX: x, clientY: y, pointerId: id,
    button: 0, pointerType: 'mouse', shiftKey: false });
  const click = (x, y) => { const e = event(x, y); drawing.pointerDown(e); drawing.pointerUp(e); drawing.click(e, false); };
  return { state, drawing, event, click, events };
}

test('clicks accept independent segments; up, hover and short points cannot write', () => {
  const f = fixture();
  f.click(10, 10); f.drawing.pointerMove(f.event(40, 20));
  assert.equal(f.state.commands.length, 0); assert.deepEqual(f.state.preview.b, [40, 20]);
  f.click(10, 10); assert.equal(f.state.commands.length, 0);
  f.click(40, 20); f.click(80, 60);
  assert.deepEqual(f.state.commands.map(c => [c.a, c.b]), [[[10, 10], [40, 20]], [[40, 20], [80, 60]]]);
  assert.deepEqual(f.drawing.snapshot.anchor, [80, 60]); f.drawing.reset();
});

test('Shift retains exact rays across octants and rejects incompatible magnets', () => {
  for (const [raw, expected] of [ [[45, 12], [50, 10]], [[42, 35], [40, 40]],
    [[12, 45], [10, 50]], [[-25, 40], [-20, 40]], [[-40, -20], [-30, -30]],
    [[40, -30], [50, -30]] ]) {
    const end = decorLineEnd([10, 10], raw, 10, true, [raw[0] + 2, raw[1] + 1]);
    assert.deepEqual(end, expected);
  }
  assert.deepEqual(decorLineEnd([10, 10], [45, 35], 10, true, [45, 45]), [45, 45]);
  assert.deepEqual(decorLineEnd([10, 10], [45, 35], 10, false, [47, 36]), [47, 36]);
});

test('drag, second pointer, cancel, lost contact and synthetic clicks retain anchor without writes', () => {
  const f = fixture(); f.click(10, 10);
  const a = f.event(40, 20), b = f.event(50, 20, 2);
  f.drawing.pointerDown(a); f.drawing.pointerMove(f.event(55, 20));
  f.drawing.pointerUp(a); f.drawing.click(a, false);
  f.drawing.pointerDown(a); f.drawing.pointerDown(b);
  f.drawing.pointerUp(b); f.drawing.pointerUp(a); f.drawing.click(a, false);
  f.drawing.pointerDown(a); f.drawing.cancel(a); f.drawing.pointerUp(a); f.drawing.click(a, false);
  f.drawing.click(a, false);
  assert.equal(f.state.commands.length, 0); assert.deepEqual(f.drawing.snapshot.anchor, [10, 10]);
  f.click(40, 20); assert.equal(f.state.commands.length, 1); f.drawing.reset();
});

test('modifier without pointer movement updates preview; reset retires listeners and stale contact', () => {
  const f = fixture(); f.click(10, 10); f.drawing.pointerMove(f.event(42, 25));
  const shift = type => { const e = new Event(type); Object.assign(e, { key: 'Shift' }); f.events.dispatchEvent(e); };
  shift('keydown'); assert.deepEqual(f.state.preview.b, [30, 30]);
  shift('keyup'); assert.deepEqual(f.state.preview.b, [40, 30]);
  f.drawing.pointerDown(f.event(50, 20)); f.drawing.reset();
  f.drawing.pointerUp(f.event(50, 20)); f.drawing.click(f.event(50, 20), false);
  shift('keydown'); assert.equal(f.state.preview, null); assert.equal(f.state.commands.length, 0);
});

test('only the active session can restore its common-history cursor; foreign context retires it', () => {
  const f = fixture(); f.click(10, 10); f.click(40, 20);
  const { before, after } = f.state.commands[0], token = f.drawing.snapshot.token;
  f.drawing.reset(); f.drawing.restore(before, token); assert.deepEqual(f.drawing.snapshot.anchor, [10, 10]);
  f.drawing.reset(); f.drawing.restore(after, token); assert.deepEqual(f.drawing.snapshot.anchor, [40, 20]);
  f.drawing.reset(); f.drawing.restore(after, undefined); assert.equal(f.drawing.active, false);
  f.click(20, 20); f.state.context = 'floor-b'; f.drawing.sync();
  assert.equal(f.drawing.active, false); assert.equal(f.state.preview, null);
  f.state.blocked = true; f.click(50, 20); assert.equal(f.state.commands.length, 1);
});

test('authority loss and page interruption retire the chain and a delayed click', () => {
  const f=fixture();f.click(10,10);const e=f.event(40,20);
  f.drawing.pointerDown(e);f.state.authority=false;f.drawing.pointerUp(e);f.drawing.click(e,false);
  assert.equal(f.state.commands.length,0);assert.equal(f.drawing.active,false);
  f.state.authority=true;f.click(10,10);f.events.dispatchEvent(new Event('pagehide'));
  assert.equal(f.drawing.active,false);assert.equal(f.state.preview,null);
});
