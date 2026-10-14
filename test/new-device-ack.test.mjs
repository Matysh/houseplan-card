import test from 'node:test';
import assert from 'node:assert/strict';
import { acknowledgeNewDevice } from '../test-build/new-device-ack.js';
import { editorWriteHarness, settle } from './helpers/editor-write-host.mjs';

const config = () => ({ spaces: [{ id: 'f1', title: 'Floor', rooms: [] }], markers: [],
  settings: { new_device_ids: ['first', 'other'], known_devices: ['first', 'other'] } });
function fixture(reject = null) {
  const f = editorWriteHarness({ config: config(), rev: 6, reject });
  f.host._writeConfig = (attempt) => f.runtime._writeConfig(attempt);
  return f;
}

for (const code of ['transport', 'unauthorized']) test(`#890 AC4: ${code} restores only this ack and does not retry it`, async () => {
  const f = fixture(() => Object.assign(new Error(code), { code }));
  await acknowledgeNewDevice(f.host, 'first');
  assert.deepEqual(f.host._serverCfg.settings.new_device_ids, ['first', 'other']);
  assert.equal(f.server.sets.length, 1);
  assert.equal(f.host._saveConfigDebounced.pending(), false);
  await settle();
  assert.equal(f.server.sets.length, 1);
});

test('#890 AC4: accepted ack removes one ID, conflict reload wins', async () => {
  const accepted = fixture();
  await acknowledgeNewDevice(accepted.host, 'first');
  assert.deepEqual(accepted.server.config.settings.new_device_ids, ['other']);
  const conflict = fixture(() => Object.assign(new Error('conflict'), { code: 'conflict' }));
  conflict.server.config.settings.new_device_ids = ['other', 'server-new'];
  conflict.server.rev = 7;
  await acknowledgeNewDevice(conflict.host, 'first');
  assert.deepEqual(conflict.host._serverCfg.settings.new_device_ids, ['other', 'server-new']);
});

test('#890 AC4: late refusal preserves new local discovery and restores its own attention only', async () => {
  const f = fixture();
  let reject;
  f.host._writeConfig = () => new Promise((_, no) => { reject = no; });
  const pending = acknowledgeNewDevice(f.host, 'first');
  f.host._serverCfg.settings.new_device_ids.push('arrived');
  f.host._serverCfg.settings.unknown_future = 'keep';
  reject(new Error('offline'));
  await pending;
  assert.deepEqual(new Set(f.host._serverCfg.settings.new_device_ids), new Set(['other', 'arrived', 'first']));
  assert.equal(f.host._serverCfg.settings.unknown_future, 'keep');
});
