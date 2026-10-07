/** #817 AC1–AC3: the charge line of the main device tooltip. Real mouse hover and
 * keyboard focus, Flat and 2.5D, a numeric and a binary #792 source. The plan
 * indicator settings (None, Low only, per-device hiding) must not remove the line;
 * a non-battery device, an invalid value and a disabled source must not get one.
 * Public inputs only: HA states/registry and the server config of the #792 fixture.
 */
import { launch, check, checkAll, finish } from './serve.mjs';
import { installBatteryFixture, patchBatteryMarker, setBatteryState } from './helpers/device-battery-fixture.mjs';

const { page, browser } = await launch({ width: 1200, height: 900 });
const out = {};
const evidence = {};
const root = page.locator('#host > houseplan-card');
const marker = (id) => root.locator(`[data-hp="device"][data-id="${id}"]`);
const settle = () => page.evaluate(() => window.__hpTest.settled());
const setSetting = (value) => page.evaluate((value) => window.__hpTest.setServerConfig((cfg) => ({ ...cfg,
  settings: { ...cfg.settings, show_device_battery: value },
})), value);
const indicator = (id) => page.evaluate((id) => !!window.__card.shadowRoot
  .querySelector(`[data-hp="device"][data-id="${id}"] .device-battery`), id);
// Keep the RAF-backed facade promise rooted in the page and wait from
// Playwright (smoke_zigbee_tooltip_layout): CDP can collect a pending evaluate.
const setVolumetricView = async (on) => {
  await page.evaluate((on) => {
    const probe = { done: false, error: null };
    window.__batteryTipProjection = probe;
    window.__hpTest.setVolumetricView(on).then(() => { probe.done = true; }, (error) => {
      probe.error = String(error?.stack || error);
      probe.done = true;
    });
  }, on);
  await page.waitForFunction(() => window.__batteryTipProjection?.done, null, { polling: 25, timeout: 15000 });
  const error = await page.evaluate(() => window.__batteryTipProjection.error);
  await page.evaluate(() => { delete window.__batteryTipProjection; });
  if (error) throw new Error(`projection switch failed: ${error}`);
  await settle();
};
// What a person sees: the visible tooltip's rows, each on its own line.
const sample = () => page.evaluate(() => {
  const tip = window.__card.shadowRoot.querySelector('[data-hp-live-tip]');
  const box = tip?.getBoundingClientRect();
  const visible = !!tip && !tip.hidden && box.width > 0 && box.height > 0
    && getComputedStyle(tip).visibility !== 'hidden';
  const nodes = visible ? [...tip.children] : [];
  const rects = nodes.map((node) => node.getBoundingClientRect());
  return {
    visible,
    rows: nodes.map((node) => node.textContent),
    separateLines: rects.every((rect, index) => rect.height > 0
      && (index === 0 || rect.top >= rects[index - 1].bottom - 0.5)),
  };
});
const pointerTip = async (id) => {
  await page.mouse.move(2, 2);
  await settle();
  const box = await marker(id).boundingBox();
  if (!box) throw new Error(`missing marker ${id}`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await settle();
  const value = await sample();
  await page.mouse.move(2, 2);
  await settle();
  return value;
};
const focusTip = async (id) => {
  await page.mouse.move(2, 2);
  await page.keyboard.press('Tab');
  await marker(id).focus();
  await settle();
  const focused = await marker(id).evaluate((element) => element.matches(':focus-visible'));
  const value = await sample();
  await marker(id).evaluate((element) => element.blur());
  await settle();
  return { ...value, visible: value.visible && focused };
};
const both = async (id) => ({ pointer: await pointerTip(id), focus: await focusTip(id) });
// AC1/AC3: the base rows are unchanged and the charge is one extra last row.
const hasLine = (tips, base, expected) => ['pointer', 'focus'].every((source) => {
  const tip = tips[source];
  return tip.visible && tip.separateLines && tip.rows.length === base.length + 1
    && JSON.stringify(tip.rows.slice(0, -1)) === JSON.stringify(base) && tip.rows.at(-1) === expected;
});
const noLine = (tips, base) => ['pointer', 'focus'].every((source) => tips[source].visible
  && JSON.stringify(tips[source].rows) === JSON.stringify(base));

try {
  await installBatteryFixture(page);
  // A marker of d_light1's own binary battery entity (#792: such a marker shows
  // that exact source, not the device's numeric sibling).
  await page.evaluate(async () => {
    const card = window.__card;
    const id = 'binary_sensor.hp_light_low';
    window.__addRegistryEntity(id, null, 'off');
    Object.assign(card.hass.entities[id], { device_id: 'd_light1', device_class: 'battery' });
    card.hass = { ...card.hass, states: { ...card.hass.states,
      [id]: { entity_id: id, state: 'off', attributes: { device_class: 'battery' } },
    } };
    window.__setRegistryArea('entity', id, null);
    await window.__hpTest.setServerConfig((cfg) => ({ ...cfg, markers: [...cfg.markers,
      { id: 'battery_low', binding: `entity:${id}`, space: 'f1', display: 'badge', value_badge: { enabled: false } },
    ] }));
    await window.__hpTest.setLayout((layout) => ({ ...layout, battery_low: { s: 'f1', x: 0.55, y: 0.3 } }));
    await window.__hpTest.settled();
  });
  await page.waitForFunction(() => window.__card.shadowRoot
    .querySelector('[data-hp="device"][data-id="battery_low"] .device-battery[data-state="normal"]'));

  for (const iso of [false, true]) {
    const view = iso ? 'iso' : 'flat';
    await setVolumetricView(iso);
    out[`${view}_projectionApplied`] = await page.evaluate(() => window.__card.shadowRoot
      .querySelector('.stage').classList.contains('projection-iso')) === iso;

    // The rows without a charge line are the AC3 reference for this view.
    await setBatteryState(page, 'unavailable');
    const invalid = await both('d_temp');
    const base = invalid.pointer.rows;
    evidence[`${view}_base`] = base;
    out[`${view}_unavailableHasNoLine`] = base.length > 0 && base[0].length > 0
      && noLine(invalid, base) && !base.some((row) => /battery/i.test(row));
    await setBatteryState(page, 'abc');
    out[`${view}_nonNumericHasNoLine`] = noLine(await both('d_temp'), base);

    await setBatteryState(page, '80');
    const numeric = await both('d_temp');
    evidence[`${view}_numeric`] = numeric;
    out[`${view}_numericLine`] = hasLine(numeric, base, 'Battery 80%');
    await setBatteryState(page, '37.6');
    out[`${view}_numericRounded`] = hasLine(await both('d_temp'), base, 'Battery 38%');
    await setBatteryState(page, '80');

    for (const [name, apply, restore] of [
      ['settingNone', () => setSetting(false), () => setSetting(true)],
      ['settingLowOnly', () => setSetting('low'), () => setSetting(true)],
      ['localHide', () => patchBatteryMarker(page, { hide_battery: true }),
        () => patchBatteryMarker(page, { hide_battery: false })],
    ]) {
      await apply();
      await settle();
      const hidden = !(await indicator('d_temp'));
      out[`${view}_${name}KeepsLine`] = hidden && hasLine(await both('d_temp'), base, 'Battery 80%');
      await restore();
      await settle();
    }
    out[`${view}_indicatorRestored`] = await indicator('d_temp');

    // The selected source disabled in HA: no line, and no fallback to the 5 % sibling.
    await page.evaluate(() => window.__setRegistryDisabled('entity', 'sensor.aaa_hp_battery', 'user'));
    await page.waitForFunction(() => window.__card.shadowRoot
      .querySelector('[data-id="d_temp"] .device-battery')?.dataset.state === 'unknown');
    out[`${view}_disabledSourceHasNoLine`] = noLine(await both('d_temp'), base);
    await page.evaluate(() => window.__setRegistryDisabled('entity', 'sensor.aaa_hp_battery', null));
    await page.waitForFunction(() => window.__card.shadowRoot
      .querySelector('[data-id="d_temp"] .device-battery')?.dataset.state === 'normal');

    await setBatteryState(page, 'unavailable', 'binary_sensor.hp_light_low');
    const binaryBase = (await pointerTip('battery_low')).rows;
    await setBatteryState(page, 'off', 'binary_sensor.hp_light_low');
    out[`${view}_binaryNormalLine`] = hasLine(await both('battery_low'), binaryBase, 'Battery normal');
    await setBatteryState(page, 'on', 'binary_sensor.hp_light_low');
    out[`${view}_binaryLowLine`] = hasLine(await both('battery_low'), binaryBase, 'Low battery');
    await setBatteryState(page, 'off', 'binary_sensor.hp_light_low');

    const plain = await both('d_leak');
    evidence[`${view}_nonBattery`] = plain;
    out[`${view}_nonBatteryHasNoLine`] = ['pointer', 'focus'].every((source) => plain[source].visible
      && plain[source].rows.length > 0 && !plain[source].rows.some((row) => /battery/i.test(row)));
  }
  await setVolumetricView(false);

  // The owner's wording in Russian, through the card's language option.
  await page.evaluate(async () => {
    window.__card.setConfig({ type: 'custom:houseplan-card', title: 'Battery witness', icon_size: 5, language: 'ru' });
    await window.__hpTest.settled();
  });
  await page.waitForFunction(() => window.__card.shadowRoot.querySelector('[data-hp="device"][data-id="d_temp"]'));
  out.russianNumeric = (await pointerTip('d_temp')).rows.at(-1) === 'Заряд 80%';
  await setBatteryState(page, 'on', 'binary_sensor.hp_light_low');
  out.russianBinaryLow = (await focusTip('battery_low')).rows.at(-1) === 'Низкий уровень батареи';
  await setBatteryState(page, 'off', 'binary_sensor.hp_light_low');
  out.russianBinaryNormal = (await pointerTip('battery_low')).rows.at(-1) === 'Заряд в норме';
  checkAll(out);
} catch (error) {
  check('batteryTooltipSmokeCompleted', false);
  out.error = String(error?.stack || error);
}
if (Object.values(out).some((value) => value !== true)) console.log(JSON.stringify(evidence, null, 1));
await finish(browser, out);
