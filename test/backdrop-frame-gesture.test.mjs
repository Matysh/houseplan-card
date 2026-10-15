import assert from 'node:assert/strict';
import test from 'node:test';
import { nothing } from 'lit';
import { BackdropFrameGestureRuntime } from '../test-build/backdrop-frame-gesture.js';
import { cancelHouseplanPointerMove, flushHouseplanPointerMove } from '../test-build/pointer-move-queue.js';

function setup(patch = {}) {
  const plan = { plan_url: 'test.svg', plan_aspect: 2, ...patch };
  const calls = { publish: [], records: [], saves: 0, toasts: [], invalidations: 0, formats: [] };
  const queueTarget = {};
  const before = { spaceId: 'f1', plan_transform: { ...patch } };
  const port = { queueTarget, plan: () => plan, mode: () => 'decor', tool: () => 'backdrop',
    point: e => [e.clientX, e.clientY], snap: p => p.map(x => Math.round(x / 25) * 25), gridPitch: () => 25,
    snapshot: () => before, record: (key, value) => calls.records.push([key, value]),
    save: () => calls.saves++, toast: key => calls.toasts.push(key),
    configChanged: () => calls.invalidations++, publish: phase => calls.publish.push(phase),
    formatLength: (a, b) => { calls.formats.push([a, b]); return `${Math.hypot(b[0]-a[0],b[1]-a[1])}u`; } };
  return { plan, calls, before, port, owner: new BackdropFrameGestureRuntime(port) };
}
const ev = (x, y, patch = {}) => ({ pointerId: 7, clientX: x, clientY: y,
  shiftKey: false, target: { setPointerCapture() {} }, ...patch });

test('#861 backdrop: mode/tool eligibility, defaults and legacy axis fallback remain derived', () => {
  const s = setup({ plan_scale: 1.5, plan_scale_y: 2, plan_x: .1 });
  assert.deepEqual(s.owner.base, { x: 0, y: 250, w: 1000, h: 500 });
  assert.deepEqual(s.owner.params, { dx: .1, dy: 0, sx: 1.5, sy: 2, angle: 0 });
  assert.equal(s.owner.movable, true); assert.equal(s.owner.frameActive, true);
  assert.equal(s.owner.transformed, true); assert.equal(s.owner.live, null);
  s.port.tool = () => 'select';
  assert.equal(s.owner.movable, false); assert.equal(s.owner.frameActive, false);
  assert.equal(s.owner.renderFrame({ x: 0, y: 0, w: 1000, h: 1000 }), nothing);
  s.port.mode = () => 'view'; assert.equal(s.owner.transformed, false);
});

test('#861 backdrop: move snaps final off-grid top-left, queues on the opaque card identity and saves once', () => {
  const s = setup({ plan_x: .003, plan_y: .007 });
  const original = s.owner.rect;
  assert.equal(s.owner.begin(ev(100, 300)), true);
  assert.equal(s.owner.active, true); assert.equal(s.owner.owns(7), true); assert.equal(s.owner.owns(8), false);
  assert.equal(s.owner.before, s.before);
  s.owner.move(ev(137, 332));
  assert.equal(s.plan.plan_x, .003, 'the input queue is not implicitly flushed');
  flushHouseplanPointerMove(s.port.queueTarget, 'backdrop');
  assert.equal(s.owner.rect.x, Math.round((original.x + 37) / 25) * 25);
  assert.equal(s.owner.rect.y, Math.round((original.y + 32) / 25) * 25);
  assert.equal(s.calls.saves, 0); assert.deepEqual(s.calls.records, []);
  assert.deepEqual(s.calls.publish, ['begin', 'move']);
  assert.equal(s.owner.live.text, '1000u × 500u');
  s.owner.end();
  assert.equal(s.owner.active, false); assert.equal(s.owner.live, null);
  assert.deepEqual(s.calls.records, [['history.backdrop_transform', s.before]]);
  assert.equal(s.calls.saves, 1); assert.equal(s.calls.publish.at(-1), 'end');
});

test('#861 backdrop: proportional resize and Shift independent axes keep the opposite corner', () => {
  for (const shiftKey of [false, true]) {
    const s = setup();
    s.owner.begin(ev(1000, 750), [1, 1]);
    s.owner.move(ev(1200, 1050, { shiftKey })); s.owner.end();
    assert.equal(s.owner.rect.x, 0); assert.equal(s.owner.rect.y, 250);
    if (shiftKey) assert.notEqual(s.plan.plan_scale_x, s.plan.plan_scale_y);
    else assert.equal(s.plan.plan_scale_x, s.plan.plan_scale_y);
    assert.equal(s.calls.saves, 1); assert.equal(s.calls.records.length, 1);
  }
});

test('#861 backdrop: rotation remains five-degree snapped and Shift-free', () => {
  for (const shiftKey of [false, true]) {
    const s = setup(), center = [500, 500], radius = 300, angle = 12.3 * Math.PI / 180;
    s.owner.begin(ev(center[0] + radius, center[1]), undefined, true);
    s.owner.move(ev(center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle), { shiftKey }));
    s.owner.end();
    assert.equal(s.plan.plan_angle, shiftKey ? 12.3 : 10);
    assert.equal(s.calls.saves, 1);
  }
});

test('#861 backdrop: release without a changed transform does not record or save', () => {
  const s = setup(); s.owner.begin(ev(100, 300)); s.owner.move(ev(100, 300)); s.owner.end();
  assert.deepEqual(s.calls.publish, ['begin', 'end']);
  assert.equal(s.calls.saves, 0); assert.deepEqual(s.calls.records, []);
});

test('#861 backdrop: reset removes precisely six transform fields and keeps unrelated data', () => {
  const s = setup({ plan_x: .1, plan_y: .2, plan_scale: 3, plan_scale_x: 2,
    plan_scale_y: 4, plan_angle: 15, title: 'keep' });
  s.owner.resetTransform();
  assert.deepEqual(s.plan, { plan_url: 'test.svg', plan_aspect: 2, title: 'keep' });
  assert.deepEqual(s.calls.records, [['history.backdrop_transform', s.before]]);
  assert.equal(s.calls.saves, 1); assert.deepEqual(s.calls.toasts, ['decor.backdrop_reset_done']);
  assert.equal(s.owner.transformed, false);
});

test('#861 backdrop: apply keeps precision, limits, legacy deletion and existing zero-angle representation', () => {
  const s = setup({ plan_scale: 4 });
  s.owner.apply(.123456789, .987654321, .0001, 200, 360);
  assert.deepEqual([s.plan.plan_x, s.plan.plan_y, s.plan.plan_scale_x, s.plan.plan_scale_y], [.123457, .987654, .01, 100]);
  assert.equal('plan_scale' in s.plan, false); assert.equal('plan_angle' in s.plan, false);
  assert.equal(s.calls.invalidations, 1); assert.deepEqual(s.calls.publish, ['move']);
});

test('#861 backdrop: reset is state-only, cancellation owns the card queue, and instances never share drag', async () => {
  const s = setup(), other = setup();
  s.owner.begin(ev(100, 300)); s.owner.move(ev(125, 325));
  const calls = [...s.calls.publish]; s.owner.reset();
  assert.deepEqual(s.calls.publish, calls); assert.equal(s.owner.active, false);
  assert.equal(other.owner.active, false);
  await Promise.resolve(); assert.equal(s.calls.invalidations, 0, 'queued work observes the reset state');
  s.owner.begin(ev(100, 300)); s.owner.move(ev(125, 325));
  cancelHouseplanPointerMove(s.port.queueTarget);
  await Promise.resolve(); assert.equal(s.calls.invalidations, 0, 'global card disposal cancels owner work');
  s.owner.cancel(); assert.equal(s.owner.active, false);
  assert.equal(s.calls.publish.at(-1), 'end'); assert.equal(s.calls.saves, 0);
});
