// #1130: real settings inputs, live registry samples, full/ISO/static consumers.
import { launch, checkAll, finish, requirePinnedBrowser } from './serve.mjs';
requirePinnedBrowser('smoke_signal_low_only');
const { page, browser } = await launch({ width: 1280, height: 900 });
const root = page.locator('#host > houseplan-card');
const dev = root.locator('[data-hp="device"][data-id="low-radio"]');
const out = {};
const settle = () => page.evaluate(() => window.__hpTest.settled());
const text = () => dev.locator('.lqi').count().then(async count => count ? (await dev.locator('.lqi').textContent()).trim() : null);
const reading = async value => {
  await page.evaluate(async value => {
    const c = window.__card;
    c.hass = { ...c.hass, states: { ...c.hass.states,
      'sensor.low_radio_lqi': { entity_id: 'sensor.low_radio_lqi', state: String(value), attributes: { unit_of_measurement: 'lqi' } } } };
    for (const card of document.querySelectorAll('houseplan-space-card')) card.hass = c.hass;
    await window.__hpTest.settled();
  }, value);
};
const patchSpace = mode => page.evaluate(mode => window.__hpTest.setServerConfig(c => ({ ...c,
  spaces: c.spaces.map(s => s.id === 'f1' ? { ...s, settings: { ...s.settings, show_lqi_mode: mode } } : s),
})), mode);
try {
  await page.evaluate(async () => {
    const c = window.__card, area = c.hass.devices.d_temp.area_id;
    c.setConfig({ type: 'custom:houseplan-card', language: 'en' });
    window.__addRegistryDevice('low-radio', 'Low radio', 'Synthetic', area);
    window.__addRegistryEntity('sensor.low_radio_lqi', area, '50', 'demo', { device_id: 'low-radio' }, { unit_of_measurement: 'lqi' });
    await window.__hpTest.setServerConfig(cfg => ({ ...cfg,
      spaces: cfg.spaces.map(s => s.id === 'f1' ? { ...s, settings: { ...s.settings, show_lqi_mode: 'inherit', show_lqi: true } } : s),
      settings: { ...cfg.settings, show_lqi: true, show_device_battery: false, volumetric_view: false },
      markers: [...cfg.markers, { id: 'low-radio', binding: 'device:low-radio', space: 'f1', display: 'badge', value_badge: { enabled: false } }],
    }));
    await window.__hpTest.setLayout(l => ({ ...l, 'low-radio': { s: 'f1', x: .4, y: .4 } }));
  });
  await reading(50);
  out.legacyTrueShowsNumber = await text() === '50';
  await root.locator('[data-hp="settings"]').click();
  const general = root.locator('hp-dialog[data-kind="settings"]');
  await general.locator('#gs-show-lqi').selectOption('low');
  await general.locator('[data-hp="dialog-confirm"]').click();
  await page.waitForFunction(() => !window.__card.shadowRoot.querySelector('hp-dialog[data-kind="settings"]'));
  await settle();
  out.actualSettingsSaveLow = await page.evaluate(() => window.__card._serverCfg.settings.show_lqi === 'low');
  for (const [value, expected] of [[49, '49'], [50, '50'], [51, null], [0, '0'], ['unknown', null], ['unavailable', null]]) {
    await reading(value); out[`live-${value}`] = await text() === expected;
  }
  await page.evaluate(async () => {
    await customElements.whenDefined('houseplan-space-card');
    const c = document.createElement('houseplan-space-card');
    c.setConfig({ type: 'custom:houseplan-space-card', space: 'f1', live_states: true, show_button: false });
    c.hass = window.__card.hass; document.body.append(c);
  });
  const staticLine = page.locator('houseplan-space-card [data-id="low-radio"] .lqi');
  await reading(50); await staticLine.waitFor(); out.staticAt50 = (await staticLine.textContent()).trim() === '50';
  await reading(51); out.staticAt51 = await staticLine.count() === 0;
  await page.evaluate(() => window.__hpTest.setVolumetricView(true));
  await reading(50); out.isoAt50 = await text() === '50';
  await reading(51); out.isoAt51 = await text() === null;
  await page.evaluate(async () => {
    await window.__hpTest.setMode('devices'); await window.__hpTest.openMarkerDialog('low-radio');
    window.__card.shadowRoot.querySelector('[data-section-target="appearance"]').click();
    await window.__hpTest.settled();
  });
  const preview = root.locator('hp-device-preview .lqi');
  await reading(50); await preview.waitFor(); out.previewAt50 = (await preview.textContent()).trim() === '50';
  await reading(51); out.previewAt51 = await preview.count() === 0;
  await page.evaluate(async () => {
    const closed = await window.__hpTest.close(undefined, { via: 'cancel' });
    closed.confirm?.querySelector('[data-hp="dialog-confirm"]')?.click();
    await window.__hpTest.setMode('view');
  });
  await patchSpace('on'); out.localAlwaysOverridesLow = await text() === '51';
  await page.evaluate(() => window.__card.setConfig({ type: 'custom:houseplan-card', show_signal: false })); await settle();
  out.localAlwaysOverridesYaml = await text() === '51';
  await patchSpace('inherit'); out.yamlFalseWhileInherit = await text() === null;
  await patchSpace('low'); await reading(50); out.localLowOverridesYaml = await text() === '50';
  await page.evaluate(() => window.__hpTest.setServerConfig(c => ({ ...c,
    markers: c.markers.map(m => m.id === 'low-radio' ? { ...m, hide_signal: true } : m),
  })));
  out.localDeviceHideWins = await text() === null;
  // Space dialog roundtrip through the real four-option selector.
  await page.evaluate(() => window.__hpTest.openSpaceDialog('edit', 'f1'));
  const space = root.locator('hp-dialog[data-kind="space"]');
  await space.locator('[data-section-target="room-cards"]').click();
  const select = space.locator('select[name$="-show-lqi"]');
  out.spaceHasFourChoices = await select.locator('option').count() === 4 && await select.inputValue() === 'low';
  await select.selectOption('off'); await space.locator('[data-hp="dialog-confirm"]').click();
  await page.waitForFunction(() => !window.__card.shadowRoot.querySelector('hp-dialog[data-kind="space"]'));
  out.actualSpaceSave = await page.evaluate(() => window.__card._serverCfg.spaces.find(s => s.id === 'f1').settings.show_lqi_mode === 'off');
  await page.evaluate(() => document.querySelector('houseplan-space-card').remove());
  checkAll(out);
} finally { await finish(browser, out); }
