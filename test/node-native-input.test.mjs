import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sendNodeNativeMove } from '../demo/helpers/node-native-input.mjs';

test('#834 native held-button move preserves capture protocol without injecting a timestamp', async () => {
  const point = Object.freeze({ x: 12.5, y: 40.25, eventTime: 100, nodeTime: 200 });
  const pending = Promise.resolve({ sent: true }), calls = [];
  const cdp = { send(method, params) { calls.push({ method, params }); return pending; } };
  assert.equal(sendNodeNativeMove(cdp, point), pending, 'caller retains control of independent dispatch pacing');
  assert.deepEqual(calls, [{ method: 'Input.dispatchMouseEvent', params: {
    type: 'mouseMoved', x: 12.5, y: 40.25, button: 'left', buttons: 1, pointerType: 'mouse',
  } }]);
  assert.deepEqual(point, { x: 12.5, y: 40.25, eventTime: 100, nodeTime: 200 });
});

test('#834 native input contract rejects the former omitted-button payload', () => {
  const cdp = { send(method, params) {
    assert.equal(method, 'Input.dispatchMouseEvent');
    assert.equal(params.button, 'left', 'held primary move requires both button and buttons');
    assert.equal(params.buttons, 1);
    assert.equal(Object.hasOwn(params, 'timestamp'), false, 'native monotonic receipt owns its timestamp');
  } };
  assert.throws(() => cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved', x: 10, y: 20, buttons: 1, pointerType: 'mouse',
  }), /requires both button and buttons/);
  assert.doesNotThrow(() => sendNodeNativeMove(cdp, { x: 10, y: 20 }));
});
