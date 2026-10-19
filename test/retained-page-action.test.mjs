import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {setImmediate} from 'node:timers/promises';
import {evaluateRetainedAction} from '../demo/helpers/retained-page-action.mjs';

function fixture() {
  const window = {calls:0};
  const handles = [];
  const readiness = [];
  const page = {
    async evaluateHandle(source) {
      const value = runInNewContext(source, {window, Promise});
      const handle = {
        value,
        disposed:false,
        evaluate(fn) {
          const result = fn(value);
          assert.ok(!result || typeof result.then !== 'function', 'a pending promise crossed the CDP result boundary');
          return result;
        },
        async dispose() { this.disposed = true; },
      };
      handles.push(handle);
      return handle;
    },
    async waitForFunction(predicate, holder, {timeout}) {
      const deadline = Date.now() + timeout;
      while (!predicate(holder.value)) {
        if (Date.now() >= deadline) {
          const error = new Error('fixture deadline');
          error.name = 'TimeoutError';
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 1));
      }
      const ready = {disposed:false, async dispose() {this.disposed = true;}};
      readiness.push(ready);
      return ready;
    },
  };
  return {page, window, handles, readiness};
}

test('#967 a pending action is held once until completion and its original value is returned', async () => {
  const f = fixture();
  const pending = evaluateRetainedAction(f.page, () => {
    window.calls++;
    return new Promise(resolve => {window.resolve = resolve;});
  }, 'pending');
  await setImmediate();
  assert.equal(f.window.calls, 1);
  assert.equal(f.handles.length, 1);
  assert.equal(f.handles[0].disposed, false);
  assert.ok(f.handles[0].value.promise instanceof Promise);
  f.window.resolve('finished');
  assert.equal(await pending, 'finished');
  assert.equal(f.handles[0].disposed, true);
  assert.equal(f.readiness[0].disposed, true);
});

test('#967 synchronous actions run once without an extra page task', async () => {
  const f = fixture();
  assert.equal(await evaluateRetainedAction(f.page, () => ++window.calls, 'sync'), 1);
  assert.equal(f.window.calls, 1);
  assert.equal(f.handles[0].disposed, true);
  assert.equal(f.readiness[0].disposed, true);
});

test('#967 a synchronous throw remains a failure and acquires no holder', async () => {
  const f = fixture();
  f.window.failure = new Error('opening failed');
  await assert.rejects(evaluateRetainedAction(f.page, () => {
    window.calls++;
    throw window.failure;
  }, 'throw'), error => error === f.window.failure);
  assert.equal(f.window.calls, 1);
  assert.equal(f.handles.length, 0);
});

test('#967 a rejected action is propagated unchanged and the holder is released', async () => {
  const f = fixture();
  f.window.failure = new Error('close refused');
  await assert.rejects(evaluateRetainedAction(f.page, () => {
    window.calls++;
    return Promise.reject(window.failure);
  }, 'reject'), error => error === f.window.failure);
  assert.equal(f.window.calls, 1);
  assert.equal(f.handles[0].disposed, true);
  assert.equal(f.readiness[0].disposed, true);
});

test('#967 an action that never completes fails its named deadline instead of passing or retrying', async () => {
  const f = fixture();
  await assert.rejects(evaluateRetainedAction(f.page, () => {
    window.calls++;
    return new Promise(() => {});
  }, 'room opening', 15), /room opening: action did not complete within 15 ms/);
  assert.equal(f.window.calls, 1);
  assert.equal(f.handles[0].disposed, true);
});

test('#967 invalid action/deadline fails before acquiring a browser handle', async () => {
  const f = fixture();
  await assert.rejects(evaluateRetainedAction(f.page, null, 'invalid'), TypeError);
  for (const deadline of [0, -1, NaN, Infinity]) {
    await assert.rejects(evaluateRetainedAction(f.page, () => {}, 'invalid', deadline), RangeError);
  }
  assert.equal(f.handles.length, 0);
});
