import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  deviceBatteryModeOf, markerBatteryFields, showDeviceBatteryOf, showMarkerBatteryOf, writeDeviceBatterySetting,
} from '../test-build/device-battery-settings.js';
import { forgetGeneralBaseline, generalDirty, rememberGeneralBaseline } from '../test-build/editors/general-form-state.js';

test('#792 AC9: only exact false disables the installation-wide battery indicator', () => {
  for (const settings of [undefined, null, {}, { show_device_battery: true },
    { show_device_battery: undefined }, { show_device_battery: null },
    { show_device_battery: 'false' }, { show_device_battery: 0 }]) {
    assert.equal(showDeviceBatteryOf(settings), true, JSON.stringify(settings));
  }
  assert.equal(showDeviceBatteryOf({ show_device_battery: false }), false);
});

test('#807 AC1: the mode resolver — absent/other all, exact false off, exact "low" low-only', () => {
  for (const settings of [undefined, null, {}, { show_device_battery: true },
    { show_device_battery: null }, { show_device_battery: 'false' }, { show_device_battery: 'LOW' },
    { show_device_battery: 'low ' }, { show_device_battery: 0 }]) {
    assert.equal(deviceBatteryModeOf(settings), 'all', JSON.stringify(settings));
  }
  assert.equal(deviceBatteryModeOf({ show_device_battery: false }), 'off');
  assert.equal(deviceBatteryModeOf({ show_device_battery: 'low' }), 'low');
  // Low-only is still "battery shown": snapshots keep collecting battery sources.
  assert.equal(showDeviceBatteryOf({ show_device_battery: 'low' }), true);
});

test('#807 AC1: saving each mode stores only what differs from the default', () => {
  const settings = { show_room_tooltip: false, future: { sentinel: 1 } };
  writeDeviceBatterySetting(settings, 'low');
  assert.deepEqual(JSON.parse(JSON.stringify(settings)), { show_room_tooltip: false, future: { sentinel: 1 }, show_device_battery: 'low' });
  writeDeviceBatterySetting(settings, 'off');
  assert.equal(settings.show_device_battery, false);
  writeDeviceBatterySetting(settings, 'all');
  assert.deepEqual(settings, { show_room_tooltip: false, future: { sentinel: 1 } });
});

test('#792 AC9: save persists false, enabling removes the key and siblings survive', () => {
  const settings = { show_device_battery: true, show_room_tooltip: false, future: { sentinel: 1 } };
  writeDeviceBatterySetting(settings, 'off');
  const reloaded = JSON.parse(JSON.stringify(settings));
  assert.deepEqual(reloaded, { show_device_battery: false, show_room_tooltip: false, future: { sentinel: 1 } });
  assert.equal(showDeviceBatteryOf(reloaded), false);
  writeDeviceBatterySetting(reloaded, 'all');
  assert.deepEqual(reloaded, { show_room_tooltip: false, future: { sentinel: 1 } });
  assert.equal(showDeviceBatteryOf(reloaded), true);
});

test('#792 AC9: the battery switch participates in ordinary draft dirty/cancel without mutating saved settings', () => {
  const host = {};
  const settings = Object.freeze({ show_device_battery: false });
  const original = { deviceBattery: deviceBatteryModeOf(settings), busy: false };
  rememberGeneralBaseline(host, original);
  assert.equal(generalDirty(host, original), false);
  const changed = { ...original, deviceBattery: 'low' };
  assert.equal(generalDirty(host, changed), true);
  assert.equal(generalDirty(host, { ...changed, busy: true }), true);
  assert.equal(generalDirty(host, { ...changed, deviceBattery: 'all' }), true);
  assert.equal(generalDirty(host, { ...changed, deviceBattery: 'off' }), false);
  forgetGeneralBaseline(host);
  const reopened = { deviceBattery: deviceBatteryModeOf(settings), busy: false };
  rememberGeneralBaseline(host, reopened);
  assert.equal(reopened.deviceBattery, 'off');
  assert.equal(generalDirty(host, reopened), false);
  assert.equal(settings.show_device_battery, false);
});

test('#792 AC9: the general battery setting has complete RU/EN/DE/FR wording', () => {
  const read = (lang) => JSON.parse(readFileSync(new URL(`../src/i18n/settings/${lang}.json`, import.meta.url), 'utf8'));
  for (const lang of ['ru', 'en', 'de', 'fr']) {
    const dictionary = read(lang);
    for (const key of ['gs.show_device_battery', 'gs.show_device_battery_hint',
      'gs.device_battery_all', 'gs.device_battery_low', 'gs.device_battery_off']) {
      assert.ok(typeof dictionary[key] === 'string' && dictionary[key].trim(), `${lang}: ${key}`);
    }
  }
  assert.equal(read('ru')['gs.show_device_battery'], 'Показывать заряд устройств');
  assert.equal(read('en')['gs.show_device_battery'], 'Show device battery status');
  assert.deepEqual(['all', 'low', 'off'].map((m) => read('ru')[`gs.device_battery_${m}`]), ['Все', 'Только низкий', 'Нет']);
  assert.deepEqual(['all', 'low', 'off'].map((m) => read('en')[`gs.device_battery_${m}`]), ['All', 'Low only', 'None']);
});

test('#806 AC2: only exact marker true hides one battery and false is stored as absence', () => {
  for (const marker of [undefined, null, {}, { hide_battery: false },
    { hide_battery: undefined }, { hide_battery: null },
    { hide_battery: 'true' }, { hide_battery: 1 }]) {
    assert.equal(showMarkerBatteryOf(marker), true, JSON.stringify(marker));
  }
  assert.equal(showMarkerBatteryOf({ hide_battery: true }), false);
  assert.deepEqual(markerBatteryFields(false), {});
  assert.deepEqual(markerBatteryFields(true), { hide_battery: true });
});

test('#806 AC3: the per-device battery opt-out has complete RU/EN/DE/FR wording', () => {
  const read = (lang) => JSON.parse(readFileSync(new URL(`../src/i18n/${lang}.json`, import.meta.url), 'utf8'));
  for (const lang of ['ru', 'en', 'de', 'fr']) {
    assert.ok(read(lang)['marker.hide_battery']?.trim(), `${lang}: marker.hide_battery`);
  }
  assert.equal(read('ru')['marker.hide_battery'], 'Скрыть отображение заряда на плане');
  assert.equal(read('en')['marker.hide_battery'], 'Hide battery status on plan');
});

test('#806 AC1/AC2: production CSS and dialog use the reviewed path', () => {
  const css = readFileSync(new URL('../src/styles/devices.styles.ts', import.meta.url), 'utf8');
  assert.match(css, /--battery-shadow-x:\s*calc\(var\(--battery-frame\) \* \.024324324324 \+ \.237837837844px\)/);
  assert.match(css, /--battery-shadow-y:\s*calc\(var\(--battery-frame\) \* \.048648648649 \+ \.875675675669px\)/);
  assert.match(css, /--battery-shadow-blur:\s*calc\(var\(--battery-frame\) \* \.051351351351 \+ \.324324324331px\)/);
  assert.match(css, /filter:\s*drop-shadow\([\s\S]*rgb\(0 0 0 \/ 75%\)\)/);

  const dialog = readFileSync(new URL('../src/editors/marker-dialog.ts', import.meta.url), 'utf8');
  assert.match(dialog, /id:\s*'marker-hide-battery'[\s\S]*title:\s*t\('marker\.hide_battery'\)[\s\S]*checked:\s*d\.hideBattery/);
});
