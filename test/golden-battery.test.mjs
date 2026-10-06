import assert from 'node:assert/strict';
import test from 'node:test';
import { BATTERY_BOARD_ICONS, batteryBoardSamples, makeBatteryBoardFixture } from '../demo/golden/device-battery.mjs';
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
