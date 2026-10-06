import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { showDeviceBatteryOf, writeDeviceBatterySetting } from '../test-build/device-battery-settings.js';
import { forgetGeneralBaseline, generalDirty, rememberGeneralBaseline } from '../test-build/editors/general-form-state.js';

test('#792 AC9: only exact false disables the installation-wide battery indicator', () => {
  for (const settings of [undefined, null, {}, { show_device_battery: true },
    { show_device_battery: undefined }, { show_device_battery: null },
    { show_device_battery: 'false' }, { show_device_battery: 0 }]) {
    assert.equal(showDeviceBatteryOf(settings), true, JSON.stringify(settings));
  }
  assert.equal(showDeviceBatteryOf({ show_device_battery: false }), false);
});

test('#792 AC9: save persists false, enabling removes the key and siblings survive', () => {
  const settings = { show_device_battery: true, show_room_tooltip: false, future: { sentinel: 1 } };
  writeDeviceBatterySetting(settings, false);
  const reloaded = JSON.parse(JSON.stringify(settings));
  assert.deepEqual(reloaded, { show_device_battery: false, show_room_tooltip: false, future: { sentinel: 1 } });
  assert.equal(showDeviceBatteryOf(reloaded), false);
  writeDeviceBatterySetting(reloaded, true);
  assert.deepEqual(reloaded, { show_room_tooltip: false, future: { sentinel: 1 } });
  assert.equal(showDeviceBatteryOf(reloaded), true);
});

test('#792 AC9: the battery switch participates in ordinary draft dirty/cancel without mutating saved settings', () => {
  const host = {};
  const settings = Object.freeze({ show_device_battery: false });
  const original = { showDeviceBattery: showDeviceBatteryOf(settings), busy: false };
  rememberGeneralBaseline(host, original);
  assert.equal(generalDirty(host, original), false);
  const changed = { ...original, showDeviceBattery: true };
  assert.equal(generalDirty(host, changed), true);
  assert.equal(generalDirty(host, { ...changed, busy: true }), true);
  assert.equal(generalDirty(host, { ...changed, showDeviceBattery: false }), false);
  forgetGeneralBaseline(host);
  const reopened = { showDeviceBattery: showDeviceBatteryOf(settings), busy: false };
  rememberGeneralBaseline(host, reopened);
  assert.equal(reopened.showDeviceBattery, false);
  assert.equal(generalDirty(host, reopened), false);
  assert.equal(settings.show_device_battery, false);
});

test('#792 AC9: the general battery setting has complete RU/EN/DE/FR wording', () => {
  const read = (lang) => JSON.parse(readFileSync(new URL(`../src/i18n/settings/${lang}.json`, import.meta.url), 'utf8'));
  for (const lang of ['ru', 'en', 'de', 'fr']) {
    const dictionary = read(lang);
    for (const key of ['gs.show_device_battery', 'gs.show_device_battery_hint']) {
      assert.ok(typeof dictionary[key] === 'string' && dictionary[key].trim(), `${lang}: ${key}`);
    }
  }
  assert.equal(read('ru')['gs.show_device_battery'], 'Показывать заряд устройств');
  assert.equal(read('en')['gs.show_device_battery'], 'Show device battery status');
});
