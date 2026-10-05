import test from 'node:test';
import assert from 'node:assert/strict';
import { zigbeeLinkColor } from '../test-build/zigbee-topology-style.js';

test('#798 topology palette uses the whole range, including valid zero, without changing legacy LQI', async () => {
  assert.equal(zigbeeLinkColor(0), 'rgb(255, 0, 0)');
  assert.equal(zigbeeLinkColor(64), 'rgb(255, 128, 0)');
  assert.equal(zigbeeLinkColor(128), 'rgb(255, 255, 0)');
  assert.equal(zigbeeLinkColor(192), 'rgb(126, 255, 0)');
  assert.equal(zigbeeLinkColor(255), 'rgb(0, 255, 0)');
  for (const value of [undefined, NaN, Infinity, -1, 256]) assert.equal(zigbeeLinkColor(value), '#919ba5');
  const channels = (value) => zigbeeLinkColor(value).match(/\d+/g).map(Number);
  for (let value = 1; value <= 255; value++) {
    const previous = channels(value - 1);
    const current = channels(value);
    assert.ok(previous.every((channel, index) => Math.abs(channel - current[index]) <= 3));
  }
  const { lqiColor } = await import('../test-build/logic.js');
  assert.match(lqiColor(40), /hsl\(0,/);
  assert.match(lqiColor(180), /hsl\(120,/);
});
