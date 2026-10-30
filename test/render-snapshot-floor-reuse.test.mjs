import test from 'node:test';
import assert from 'node:assert/strict';
import { captureHost, oracleFixture } from './render-snapshot-fixture.mjs';
import { captureRenderDeviceSnapshot } from '../test-build/render-snapshot-capture.js';
import { RenderSnapshotReuseWindow } from '../test-build/render-snapshot-reuse.js';
import { presentationSnapshotKey } from '../test-build/render-device-snapshot.js';
import { thresholdIssues } from '../test-build/marker-alert-presentation.js';

const plain = snapshot => ({
  hass: snapshot.hass, devices: snapshot.devices, vacuumDevices: snapshot.vacuumDevices,
  positions: [...snapshot.positions], presentations: [...snapshot.presentations],
  facts: [...snapshot.facts], entityIds: snapshot.entityIds, geometry: snapshot.geometry,
});
const capture = (host, reuse, floor) => {
  host._space = floor;
  const actual = captureRenderDeviceSnapshot(host, reuse);
  assert.deepEqual(plain(actual), plain(captureRenderDeviceSnapshot(host, null)));
  return actual;
};
function scene() {
  const fixture = oracleFixture(), host = captureHost(fixture), reuse = new RenderSnapshotReuseWindow();
  host._mode = 'view';
  const floors = fixture.config.spaces.map(space => space.id);
  const snapshots = floors.map(floor => capture(host, reuse, floor));
  return { fixture, host, reuse, floors, snapshots };
}

test('#1161 twelve warm floor switches reuse faces and remain equal to complete captures', () => {
  const { host, reuse, floors, snapshots } = scene();
  const before = { ...reuse.stats };
  for (let index = 0; index < 12; index++) {
    const floor = index % floors.length;
    const snapshot = capture(host, reuse, floors[floor]);
    for (const [key, face] of snapshot.presentations)
      assert.equal(face, snapshots[floor].presentations.get(key), 'same unchanged frozen face');
  }
  assert.equal(reuse.stats.full, before.full, 'no cold capture on a warm return');
  assert.equal(reuse.stats.presentations, before.presentations, 'no redundant face resolutions');
  assert.equal(reuse.stats.incremental, before.incremental + 12, 'actual per-floor reuse counted');
});

test('#1161 a hidden floor state changes before return without mutating its held snapshot', () => {
  const { host, reuse, floors, snapshots } = scene();
  const device = host._devices.find(device => device.space === floors[0] && device.primary);
  const eid = device.primary, previous = snapshots[0].hass.states[eid]?.state;
  assert.notEqual(previous, undefined);
  host.hass = { ...host.hass, states: { ...host.hass.states,
    [eid]: { ...host.hass.states[eid], state: previous === 'on' ? 'off' : 'on' } } };
  host._hassSequence++;
  const next = capture(host, reuse, floors[0]);
  assert.notEqual(next.hass.states[eid].state, previous);
  assert.equal(snapshots[0].hass.states[eid].state, previous, 'old frame stays immutable');
  assert.notEqual(next.presentations.get(presentationSnapshotKey(device.id, false)),
    snapshots[0].presentations.get(presentationSnapshotKey(device.id, false)));
});

test('#1161 returned floors retain the complete context invalidation contract', () => {
  const changes = [
    ['locale', ({host}) => { host.hass = { ...host.hass, locale: { language: 'de' } }; }],
    ['theme', ({host}) => { host.hass = { ...host.hass, themes: { darkMode: true } }; }],
    ['connection/user', ({host}) => { host.hass = { ...host.hass, connection: {}, user: { id: 'next' } }; }],
    ['registry', ({host}) => { host.hass = { ...host.hass, entities: { ...host.hass.entities } }; host.rebuildRoster(); }],
    ['card config', ({host}) => { host._config = { ...host._config, show_temperature: false }; }],
    ['marker', ({host, floors}) => { host._devices.find(device => device.space === floors[0]).name = 'Changed'; }],
    ['layout/model authority', ({host, fixture}) => {
      const id = host._devices[0].id;
      host._layout = fixture.layout = { ...fixture.layout,
        [id]: { ...fixture.layout[id], x: fixture.layout[id].x + .1 } };
      host._cfgEpoch++;
    }],
    ['room source', ({host}) => { host._serverCfg.spaces[0].rooms[0].settings = { temp_source: 'entity:sensor.perf_12' }; }],
    ['settings', ({host}) => { host._settings.show_device_battery = false; }],
    ['manual light', ({host}) => { host._virtualLights = { rev: 5, configRev: 0, off: new Set(['perf-virtual-a']) }; }],
    ['activity', ({host, floors}) => {
      const id = host._devices.find(device => device.space === floors[0]).id;
      host._activityRt.set(id, { gen: 1, sources: '', alarmActive: false,
        flashTs: Date.now(), flashKind: 'event', expiresAt: Date.now() + 3300 });
    }],
    ['threshold issue', ({host, floors}) => {
      const id = host._devices.find(device => device.space === floors[0]).id;
      const issues = thresholdIssues([{ key: 'test/r1', identity: 'test',
        rule: { id: 'r1', type: 'threshold', entity_id: 'sensor.co2', level: 'attention', operator: 'gt', value: 1000 },
        value: 1200, comparable: true, name: 'CO2', unit: 'ppm' }], 'en');
      host._alerts = { version: 1, issuesForDevice: current => current === id ? issues : [] };
    }],
  ];
  for (const [label, change] of changes) {
    const context = scene();
    change(context); context.host._hassSequence++;
    for (const floor of context.floors) {
      assert.doesNotThrow(() => capture(context.host, context.reuse, floor), label);
    }
  }
});

test('#1161 LRU keeps eight floor owners and a ninth retires the oldest', () => {
  const fixture = oracleFixture(), original = fixture.config.spaces[0];
  for (let index = fixture.config.spaces.length; index < 9; index++) {
    const floor = structuredClone(original);
    floor.id = `reuse-floor-${index}`;
    for (const room of floor.rooms) room.area = null;
    fixture.config.spaces.push(floor);
  }
  const host = captureHost(fixture), reuse = new RenderSnapshotReuseWindow();
  host._mode = 'view';
  const floors = fixture.config.spaces.map(space => space.id);
  for (const floor of floors.slice(0, 8)) capture(host, reuse, floor);
  const before = reuse.stats.full;
  capture(host, reuse, floors[0]); // refresh first; the second is now oldest
  assert.equal(reuse.stats.full, before);
  capture(host, reuse, floors[8]);
  assert.equal(reuse.stats.full, before + 1);
  capture(host, reuse, floors[0]);
  assert.equal(reuse.stats.full, before + 1, 'recent first floor survived eviction');
  capture(host, reuse, floors[1]);
  assert.equal(reuse.stats.full, before + 2, 'evicted second floor is cold again');
});

test('#1161 reset and an unfinished capture forget every floor without erasing work counts', () => {
  const { host, reuse, floors } = scene();
  const before = { ...reuse.stats };
  reuse.reset();
  assert.deepEqual(reuse.stats, before);
  for (const floor of floors) capture(host, reuse, floor);
  assert.equal(reuse.stats.full, before.full + floors.length);
  host._space = floors[0];
  reuse.begin(host, null); // no end: its owner must not survive the next capture
  const interrupted = reuse.stats.full;
  capture(host, reuse, floors[1]);
  assert.equal(reuse.stats.full, interrupted + 1, 'other retained floor retired on interruption');
});

test('#1161 a failed begin cannot lend stale slots to the next capture', () => {
  const { host, reuse, floors } = scene();
  const original = host._config;
  host._config = { get show_temperature() { throw Error('capture failed'); } };
  host._space = floors[0];
  assert.throws(() => captureRenderDeviceSnapshot(host, reuse), /capture failed/);
  host._config = original;
  const before = reuse.stats.full;
  capture(host, reuse, floors[1]);
  assert.equal(reuse.stats.full, before + 1);
});

test('#1161 cards have independent floor ownership and undefined-floor callers keep working', () => {
  const { host, reuse, floors } = scene(), other = new RenderSnapshotReuseWindow();
  const first = capture(host, other, floors[0]);
  const before = { ...other.stats };
  reuse.reset();
  const next = capture(host, other, floors[0]);
  assert.equal(other.stats.full, before.full);
  for (const [key, face] of next.presentations) assert.equal(face, first.presentations.get(key));
  const legacy = new RenderSnapshotReuseWindow();
  capture(host, legacy, undefined);
  const legacyBefore = { ...legacy.stats };
  capture(host, legacy, undefined);
  assert.equal(legacy.stats.full, legacyBefore.full);
  assert.equal(legacy.stats.presentations, legacyBefore.presentations);
});
