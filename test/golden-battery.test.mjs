import assert from 'node:assert/strict';
import test from 'node:test';
import { BATTERY_BOARD_ICONS, batteryBoardSamples, makeBatteryBoardFixture,
  BATTERY_ZIGBEE_MARKER, makeBatteryZigbeeFixture, batteryZigbeeClip,
  inspectBatteryZigbeePixels } from '../demo/golden/device-battery.mjs';
import { prepareGoldenFixture } from '../demo/golden/harness.mjs';
import { GOLDEN_SCENARIOS } from '../demo/golden/matrix.mjs';

test('#792 compact golden matrix contains all six size/theme variants and four states', () => {
  const boards = GOLDEN_SCENARIOS.filter((scenario) => scenario.batteryBoard);
  assert.equal(boards.length, 3);
  assert.deepEqual(boards.filter((scenario) => scenario.batteryBoard === 'desktop').map((scenario) => scenario.theme).sort(), ['dark', 'light']);
  for (const scenario of boards) {
    const samples = batteryBoardSamples(scenario.batteryBoard);
    assert.equal(new Set(samples.map((sample) => sample.id)).size, samples.length);
    assert.deepEqual(new Set(samples.map((sample) => sample.state)), new Set(['normal', 'warning', 'low', 'unknown']));
    assert.deepEqual(new Set(samples.filter((sample) => ['none', 'right', 'left', 'top', 'bottom'].includes(sample.arrangement))
      .map((sample) => sample.arrangement)), new Set(['none', 'right', 'left', 'top', 'bottom']));
    if (scenario.batteryBoard === 'desktop') for (const diameter of [32, 56, 96]) {
      assert.deepEqual(samples.filter((sample) => sample.diameter === diameter && sample.id.startsWith(`battery-${diameter}-`))
        .map((sample) => sample.state), ['normal', 'warning', 'low', 'unknown']);
    }
    const fixture = prepareGoldenFixture(scenario);
    assert.equal(fixture.config.spaces[0].id, scenario.space);
    assert.equal(fixture.config.markers.length, samples.length);
    assert.equal(Object.keys(fixture.devices).length, samples.length);
    for (const sample of samples) {
      const marker = fixture.config.markers.find((item) => item.id === sample.id);
      assert.equal(marker.binding, `device:${sample.id}`);
      assert.equal(marker.size, sample.diameter / 16);
      const batteryId = Object.keys(fixture.entities).find((entityId) => fixture.entities[entityId].device_id === sample.id
        && fixture.entities[entityId].original_device_class === 'battery');
      assert.ok(batteryId, sample.id);
      assert.equal(fixture.states[batteryId].attributes.device_class, 'battery');
      assert.deepEqual(fixture.layout[sample.id], { s: scenario.space, x: sample.x, y: sample.y });
    }
  }
});

test('#792 golden MDI oracle pins the four owner-approved icons independently of product code', () => {
  assert.deepEqual(BATTERY_BOARD_ICONS, {
    normal: 'mdi:battery', warning: 'mdi:battery-30',
    low: 'mdi:battery-outline', unknown: 'mdi:battery-unknown',
  });
  assert.ok(Object.isFrozen(BATTERY_BOARD_ICONS));
  for (const kind of ['desktop', 'mobile']) {
    assert.deepEqual(new Set(batteryBoardSamples(kind).map((sample) => BATTERY_BOARD_ICONS[sample.state])),
      new Set(Object.values(BATTERY_BOARD_ICONS)));
  }
});

test('#792 golden fixtures are fresh independent public config/HA data, without changing existing scenes', () => {
  const first = makeBatteryBoardFixture('desktop');
  const second = makeBatteryBoardFixture('desktop');
  first.config.markers[0].size = 100;
  assert.notEqual(first.config.markers[0].size, second.config.markers[0].size);
  assert.ok(second.config.markers.some((marker) => marker.display === 'value'));
  const legacy = second.config.markers.find((marker) => marker.use_climate_temp);
  assert.ok(legacy);
  assert.equal('value_badge' in legacy, false);
  const existing = prepareGoldenFixture(GOLDEN_SCENARIOS.find((scenario) => scenario.id === 'device-value-badge-positions-dark'));
  assert.ok(!existing.config.spaces.some((space) => space.id === 'golden-battery'));
  assert.ok(!Object.keys(existing.entities).some((entityId) => entityId.includes('battery_32_')));
  assert.throws(() => batteryBoardSamples('unlisted'), /unknown battery board/);
});

test('#792 fourth battery golden uses a real enabled ZHA parent and a focused zero-diff capture', () => {
  const scenes = GOLDEN_SCENARIOS.filter((scenario) => scenario.batteryZigbeeOverlap);
  assert.equal(scenes.length, 1);
  const [scene] = scenes;
  assert.equal(scene.id, 'device-battery-zigbee-overlap-dark');
  assert.equal(scene.mode, 'view');
  assert.equal(scene.theme, 'dark');
  assert.equal(scene.capture, 'battery-zigbee-overlap');
  assert.deepEqual(scene.threshold, { maxChannelDelta: 10, maxDiffRatio: 0 });
  const fixture = prepareGoldenFixture(scene);
  assert.equal(fixture.config.settings.zigbee_topology.enabled, true);
  assert.equal(fixture.config.settings.show_device_battery, true);
  assert.equal(fixture.config.markers.length, 1);
  assert.equal(fixture.config.markers[0].binding, `device:${BATTERY_ZIGBEE_MARKER}`);
  assert.deepEqual(fixture.layout, { [BATTERY_ZIGBEE_MARKER]: { s: scene.space, x: 0.34, y: 0.34 } });
  assert.equal(Object.keys(fixture.entities).length, 2); // Measurement and its own registry battery only.
  const batteryId = Object.keys(fixture.entities).find((id) => fixture.entities[id].original_device_class === 'battery');
  assert.equal(fixture.entities[batteryId].device_id, BATTERY_ZIGBEE_MARKER);
  assert.equal(fixture.states[batteryId].state, '80');
  const [child, parent] = fixture.zhaDevices;
  assert.equal(child.device_reg_id, BATTERY_ZIGBEE_MARKER);
  assert.deepEqual(child.neighbors, [{ ieee: parent.ieee, relationship: 'Parent', lqi: 50 }]);
  assert.deepEqual(parent.neighbors, [{ ieee: child.ieee, relationship: 'Child', lqi: 50 }]);
  assert.equal(parent.name, 'Upstairs parent relay');
  assert.equal(fixture.devices[parent.device_reg_id], undefined);
  assert.equal(fixture.layout[parent.device_reg_id], undefined);
  fixture.zhaDevices[0].neighbors[0].lqi = 255;
  assert.equal(makeBatteryZigbeeFixture().zhaDevices[0].neighbors[0].lqi, 50);
  const oldScene = GOLDEN_SCENARIOS.find((scenario) => scenario.batteryBoard);
  assert.equal(prepareGoldenFixture(oldScene).zhaDevices, undefined);
});

function pixelWitness() {
  const rect = (x, y, width, height) => ({ x, y, width, height, right: x + width, bottom: y + height });
  const probe = { core: rect(4, 16, 20, 16), battery: rect(34, 14, 16, 20), caption: rect(36, 16, 24, 16),
    overlap: { x: 36, y: 16, right: 50, bottom: 32 } };
  const image = () => ({ width: 64, height: 48, data: new Array(64 * 48 * 4).fill(32) });
  const images = { active: image(), captionHidden: image(), routesHidden: image() };
  const paint = (image, x, y, width, height, color) => {
    for (let py = y; py < y + height; py++) for (let px = x; px < x + width; px++) {
      const offset = (py * image.width + px) * 4;
      image.data.splice(offset, 4, ...color, 255);
    }
  };
  paint(images.captionHidden, 34, 14, 16, 20, [29, 194, 29]);
  paint(images.active, 28, 23, 5, 3, [220, 200, 50]);
  return { images, probe, clip: { x: 0, y: 0 }, paint };
}

test('#792 Zigbee pixel oracle proves caption-over-battery and core-over-route from controls', () => {
  const { images, probe, clip } = pixelWitness();
  assert.deepEqual(inspectBatteryZigbeePixels(images, probe, clip),
    { ink: 100, covered: 100, coreChanged: 0, exposedRoute: 15 });
});

test('#792 Zigbee pixel oracle rejects missing overlap, invisible MDI and reversed caption layer', () => {
  const missing = pixelWitness();
  missing.probe.overlap.right = missing.probe.overlap.x;
  assert.throws(() => inspectBatteryZigbeePixels(missing.images, missing.probe, missing.clip), /does not overlap/);
  const empty = pixelWitness();
  empty.images.captionHidden = structuredClone(empty.images.active);
  assert.throws(() => inspectBatteryZigbeePixels(empty.images, empty.probe, empty.clip), /real battery ink/);
  const under = pixelWitness();
  under.paint(under.images.active, 34, 14, 16, 20, [29, 194, 29]);
  assert.throws(() => inspectBatteryZigbeePixels(under.images, under.probe, under.clip), /real battery ink/);
});

test('#792 Zigbee pixel oracle rejects routes above core and an absent route control', () => {
  const above = pixelWitness();
  above.paint(above.images.active, 14, 23, 3, 3, [220, 200, 50]);
  assert.throws(() => inspectBatteryZigbeePixels(above.images, above.probe, above.clip), /route\/core paint order/);
  const absent = pixelWitness();
  absent.images.routesHidden = structuredClone(absent.images.active);
  assert.throws(() => inspectBatteryZigbeePixels(absent.images, absent.probe, absent.clip), /route\/core paint order/);
});

test('#792 Zigbee focus is fixed size, core-anchored and refuses a clipped witness', () => {
  const { probe } = pixelWitness();
  const shifted = Object.fromEntries(Object.entries(probe).map(([key, rect]) => [key, {
    ...rect, x: rect.x + 100, right: rect.right + 100, y: rect.y + 100, bottom: rect.bottom + 100,
  }]));
  assert.deepEqual(batteryZigbeeClip(shifted, { width: 1200, height: 900 }),
    { x: 88, y: 54, width: 420, height: 140 });
  assert.throws(() => batteryZigbeeClip(probe, { width: 1200, height: 900 }), /truncates/);
  shifted.caption.right = 540;
  assert.throws(() => batteryZigbeeClip(shifted, { width: 1200, height: 900 }), /truncates/);
});
