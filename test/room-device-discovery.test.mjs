import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomDeviceDiscovery } from '../test-build/room-device-discovery.js';
import { editorWriteHarness, settle } from './helpers/editor-write-host.mjs';

const room = { space: 'f1', roomId: 'new', area: 'kitchen' };
const device = (id, patch = {}) => ({ id, space: 'f1', area: 'kitchen', ...patch });
const config = () => ({ spaces: [{ id: 'f1', rooms: [{ id: 'new', area: 'kitchen',
  poly: [[.1, .1], [.4, .1], [.4, .4], [.1, .4]] }] }], markers: [],
  settings: { known_devices: ['old'], new_device_ids: ['attention', 'same'] } });

test('#879 AC1/2/5: a Save freezes only first auto placement, preserving every old attention ID', () => {
  const cfg = config(), c = new RoomDeviceDiscovery();
  c.capture([room], [device('old')], [device('old'), device('lamp'), device('same'),
    device('lg_light.group'), device('manual', { marker: { id: 'manual' } }),
    device('virtual', { virtual: true }), device('disabled', { bindingStatus: { kind: 'ha_disabled' } }),
    device('other-floor', { space: 'f2' }), device('other-area', { area: 'bedroom' })], cfg);
  assert.deepEqual([...c.pendingIds(cfg)], ['lamp', 'same', 'lg_light.group']);
  const before = structuredClone(cfg), write = c.prepare(cfg);
  assert.deepEqual(cfg, before, 'preparing a write never acknowledges in the live config');
  assert.deepEqual(write.config.settings.known_devices, ['old', 'lamp', 'same', 'lg_light.group']);
  assert.deepEqual(write.config.settings.new_device_ids, ['attention', 'same']);
  assert.equal(c.pendingIds(cfg).has('late'), false, 'a later rebuild cannot widen the frozen set');
});

test('#879 AC3/5: missing/unbound/ambiguous rooms, Undo and authoritative replacement drop exemptions', () => {
  for (const change of [cfg => cfg.spaces[0].rooms = [],
    cfg => cfg.spaces[0].rooms[0].area = null,
    cfg => cfg.spaces.push({ id: 'other', rooms: [{ id: 'duplicate', area: 'kitchen' }] }),
    cfg => cfg.spaces[0].rooms[0].id = 'replacement']) {
    const cfg = config(), c = new RoomDeviceDiscovery();
    c.capture([room], [], [device('lamp')], cfg);
    change(cfg);
    assert.equal(c.pendingIds(cfg).size, 0);
    assert.deepEqual(c.prepare(cfg).config.settings.known_devices, ['old']);
  }
  const c = new RoomDeviceDiscovery(), cfg = config();
  c.capture([{ ...room, area: null }], [], [device('lamp')], cfg);
  assert.equal(c.pendingIds(cfg).size, 0);
});

test('#879 AC2/4/6: accepted baseline merges newer settings; a stale reply cannot consume a later Save', () => {
  const cfg = config(), c = new RoomDeviceDiscovery();
  c.capture([room], [], [device('lamp')], cfg);
  const write = c.prepare(cfg);
  cfg.settings.known_devices.push('late'); cfg.settings.new_device_ids.push('late');
  cfg.settings.show_room_tooltip = false;
  c.capture([room], [], [device('second-save')], cfg);
  c.accept(write, cfg);
  assert.deepEqual(cfg.settings.known_devices, ['old', 'late', 'lamp']);
  assert.deepEqual(cfg.settings.new_device_ids, ['attention', 'same', 'late']);
  assert.equal(cfg.settings.show_room_tooltip, false);
  assert.deepEqual([...c.pendingIds(cfg)], ['second-save']);
  c.reject(write);
  assert.deepEqual([...c.pendingIds(cfg)], ['second-save']);
});

test('#879 AC3: rejected Save leaves baseline untouched and retry works', () => {
  const cfg = config(), c = new RoomDeviceDiscovery(), before = structuredClone(cfg);
  c.capture([room], [], [device('lamp')], cfg);
  c.reject(c.prepare(cfg));
  assert.deepEqual(cfg, before);
  assert.equal(c.pendingIds(cfg).size, 0);
  c.capture([room], [], [device('lamp')], cfg);
  c.accept(c.prepare(cfg), cfg);
  assert.ok(cfg.settings.known_devices.includes('lamp'));
});

test('#879 AC1/3/4: actual serialized writer sends room + baseline together and accepts only success', async () => {
  for (const fail of [false, true]) {
    const h = editorWriteHarness({ config: config(), reject: fail ? () => new Error('offline') : null });
    h.runtime.roomDeviceDiscovery = new RoomDeviceDiscovery();
    h.runtime.roomDeviceDiscovery.capture([room], [], [device('lamp')], h.host._serverCfg);
    const writing = h.runtime._writeConfig();
    if (fail) await assert.rejects(writing, /offline/); else await writing;
    assert.equal(h.server.sets.length, 1);
    assert.equal(h.server.sets[0].spaces[0].rooms[0].id, 'new');
    assert.ok(h.server.sets[0].settings.known_devices.includes('lamp'));
    assert.equal(h.host._serverCfg.settings.known_devices.includes('lamp'), !fail);
    assert.equal(h.server.config.settings.known_devices.includes('lamp'), !fail);
    assert.equal(h.runtime.roomDeviceDiscovery.pendingIds(h.host._serverCfg).size, 0);
    assert.deepEqual(h.host._serverCfg.settings.new_device_ids, ['attention', 'same']);
  }
});

test('#879 AC6: room baseline does not bypass canonical geometry or reset unrelated failure caches', async () => {
  const cfg = config();
  cfg.spaces[0].rooms[0].poly[0][0] = .1000000004;
  const h = editorWriteHarness({ config: cfg });
  h.runtime.roomDeviceDiscovery = new RoomDeviceDiscovery();
  h.runtime.roomDeviceDiscovery.capture([room], [], [device('lamp')], h.host._serverCfg);
  await h.runtime._writeConfig();
  assert.equal(h.server.sets[0].spaces[0].rooms[0].poly[0][0], .1);
  const failed = editorWriteHarness({ config: config(), reject: () => new Error('offline') });
  failed.runtime.roomDeviceDiscovery = new RoomDeviceDiscovery();
  failed.host._newSyncKey = 'original-roster';
  failed.host._regSignature = 'original-registry';
  await assert.rejects(failed.runtime._writeConfig(), /offline/);
  assert.equal(failed.host._newSyncKey, 'original-roster');
  assert.equal(failed.host._regSignature, 'original-registry');
});

test('#879 AC2/6: delayed actual write preserves a concurrent local discovery and settings', async () => {
  const h = editorWriteHarness({ config: config() });
  h.runtime.roomDeviceDiscovery = new RoomDeviceDiscovery();
  h.runtime.roomDeviceDiscovery.capture([room], [], [device('lamp')], h.host._serverCfg);
  const send = h.host._sendConfigCandidate.bind(h.host);
  let release;
  h.host._sendConfigCandidate = candidate => new Promise(resolve => {
    release = () => resolve(send(candidate));
  });
  const writing = h.runtime._writeConfig(); await settle();
  assert.deepEqual(h.host._serverCfg.settings.known_devices, ['old']);
  h.host._serverCfg.settings.known_devices.push('late');
  h.host._serverCfg.settings.new_device_ids.push('late');
  h.host._serverCfg.settings.show_room_tooltip = false;
  release(); await writing;
  assert.deepEqual(h.host._serverCfg.settings.known_devices, ['old', 'late', 'lamp']);
  assert.deepEqual(h.host._serverCfg.settings.new_device_ids, ['attention', 'same', 'late']);
  assert.equal(h.host._serverCfg.settings.show_room_tooltip, false);
});
