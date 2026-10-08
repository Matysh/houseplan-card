import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installNodePaintObserver } from '../demo/helpers/node-paint-observer.mjs';

function clock() {
  let time = 0, next = 0;
  const queued = new Map(), cancelled = [];
  const view = {
    performance: { now: () => time },
    requestAnimationFrame(callback) { assert.equal(this, view); const id = ++next; queued.set(id, callback); return id; },
    cancelAnimationFrame(id) { assert.equal(this, view); cancelled.push(id); queued.delete(id); },
    frame() { time += 16; const batch = [...queued.values()]; queued.clear(); for (const callback of batch) callback.call(view, time); },
  };
  return { view, queued, cancelled };
}

test('#834 paint observer: RAF producer uses the next post-paint frame, retains two-frame diagnostic', () => {
  const { view } = clock(), observer = installNodePaintObserver(view);
  let result;
  view.requestAnimationFrame(function (time) {
    assert.equal(this, view); assert.equal(time, 16);
    observer.measure(value => { result = value; });
  });
  view.frame(); view.frame(); assert.equal(result, undefined, 'raw two-frame observation has not completed');
  view.frame();
  assert.deepEqual(result, { producerWasRaf: true, firstRaf: 32, paintOpportunity: 32, twoRafOpportunity: 48 });
});

test('#834 negative control: task/microtask first RAF is NOT proof of a paint', async () => {
  const { view } = clock(), observer = installNodePaintObserver(view);
  let result;
  await Promise.resolve(); // deliberately outside a rendering callback
  observer.measure(value => { result = value; });
  view.frame(); assert.equal(result, undefined, 'single-RAF universal shortcut would report too early');
  view.frame();
  assert.deepEqual(result, { producerWasRaf: false, firstRaf: 16, paintOpportunity: 32, twoRafOpportunity: 32 });
  assert.notEqual(result.paintOpportunity, result.firstRaf);
});

test('#834 observer preserves native request IDs, cancel and original callback exceptions', () => {
  const { view, queued, cancelled } = clock(), originalRaf = view.requestAnimationFrame;
  const originalCancel = view.cancelAnimationFrame, observer = installNodePaintObserver(view);
  const id = view.requestAnimationFrame(() => assert.fail('cancelled native callback'));
  assert.equal(id, 1); view.cancelAnimationFrame(id); view.frame();
  assert.equal(view.cancelAnimationFrame, originalCancel); assert.deepEqual(cancelled, [1]);
  view.requestAnimationFrame(() => { throw new Error('producer failure'); });
  assert.throws(() => view.frame(), /producer failure/);
  let result; observer.measure(value => { result = value; }); view.frame(); view.frame();
  assert.equal(result.producerWasRaf, false, 'exception must not leak a fictitious RAF phase');
  observer.restore(); assert.equal(view.requestAnimationFrame, originalRaf); assert.equal(queued.size, 0);
});

test('#834 cancelling either observer phase leaves no late callback', () => {
  for (const afterFirst of [false, true]) {
    const { view, queued } = clock(), observer = installNodePaintObserver(view);
    const cancel = observer.measure(() => assert.fail('cancelled diagnostic'));
    if (afterFirst) view.frame();
    cancel(); view.frame(); view.frame(); assert.equal(queued.size, 0);
  }
});
