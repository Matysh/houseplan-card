import test from 'node:test';
import assert from 'node:assert/strict';
import { installHpTest, SELECTORS } from '../demo/helpers/hp-test.mjs';

const defer = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

async function fixture(run) {
  const names = ['window', 'document', 'requestAnimationFrame'];
  const previous = names.map(name => Object.getOwnPropertyDescriptor(globalThis, name));
  const flags = { config: false, layout: false };
  const host = { isConnected: true, updateComplete: Promise.resolve(),
    _saveConfigDebounced: { pending: () => flags.config },
    _persistLayout: { pending: () => flags.layout },
    _writesPending: 0, _dirtyPos: new Set(), _sentPos: new Map(), _writeChain: Promise.resolve() };
  // No debounce has flush/cancel: the barrier must observe completion,
  // not manufacture idle by mutation. Pending collections stay intact.
  globalThis.window = { __card: host };
  globalThis.document = { querySelector: () => null };
  globalThis.requestAnimationFrame = callback => queueMicrotask(callback);
  installHpTest(SELECTORS);
  try { await run(host, flags, window.__hpTest); }
  finally {
    names.forEach((name, i) => previous[i]
      ? Object.defineProperty(globalThis, name, previous[i]) : delete globalThis[name]);
  }
}

test('#880 barrier observes config, pending layout and acknowledged point writes without cancelling them', async () => {
  await fixture(async (host, flags, hp) => {
    const chain = defer(); host._writeChain = chain.promise;
    host._writesPending = 1; flags.config = true; flags.layout = true;
    host._dirtyPos.add('label');
    let done = false;
    const waiting = hp.waitForWrites().then(() => { done = true; });
    await Promise.resolve(); assert.equal(done, false);
    flags.config = false; host._writesPending = 0; chain.resolve();
    host._dirtyPos.delete('label'); host._sentPos.set('label', { x: 0.2 }); flags.layout = false;
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(done, false, 'config completion is not a layout barrier');
    assert.equal(host._sentPos.size, 1, 'the unacknowledged write is still owned by the writer');
    host._sentPos.delete('label'); await waiting; assert.equal(done, true);
  });
});

test('#880 a config chain replaced during rendering is awaited, not mistaken for the old idle queue', async () => {
  await fixture(async (host, flags, hp) => {
    const late = defer(); let replacement = false, done = false;
    Object.defineProperty(host, 'updateComplete', { get() {
      if (!replacement) { replacement = true; host._writeChain = late.promise; }
      return Promise.resolve();
    }});
    const waiting = hp.waitForWrites().then(() => { done = true; });
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(replacement, true); assert.equal(done, false);
    late.resolve(); await waiting; assert.equal(done, true);
  });
});

test('#880 timeout on a pending or hanging write fails by name and retains the pending state', async () => {
  await fixture(async (host, flags, hp) => {
    flags.layout = true; host._dirtyPos.add('label');
    await assert.rejects(hp.waitForWrites({ timeoutMs: 20 }), /waitForWrites:.*layoutDebounce.*dirty/);
    assert.equal(flags.layout, true); assert.equal(host._dirtyPos.size, 1);
    flags.layout = false; host._dirtyPos.clear(); host._writeChain = defer().promise;
    await assert.rejects(hp.waitForWrites({ timeoutMs: 20 }), /waitForWrites: записи не завершились/);
    host._writeChain = Promise.resolve(); host.updateComplete = defer().promise;
    await assert.rejects(hp.waitForWrites({ timeoutMs: 20 }), /waitForWrites: записи не завершились/);
  });
});

test('#880 rejected transport, detached card and invalid timeout are not accepted as idle', async () => {
  await fixture(async (host, flags, hp) => {
    host._writeChain = Promise.reject(new Error('failed config write'));
    await assert.rejects(hp.waitForWrites(), /failed config write/);
    host._writeChain = Promise.resolve(); host.isConnected = false;
    await assert.rejects(hp.waitForWrites(), /карточка отсоединена/);
    host.isConnected = true;
    await assert.rejects(hp.waitForWrites({ timeoutMs: Infinity }), /положительным конечным/);
  });
});
