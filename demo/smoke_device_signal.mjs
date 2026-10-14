/** #867 AC1–AC4/AC7: real DOM inputs, own HA diagnostics and canonical radio anchors. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { launch, checkAll, finish } from './serve.mjs';
import { installBatteryFixture, patchBatteryMarker } from './helpers/device-battery-fixture.mjs';

const artifacts = new URL('../artifacts/device-signal-867/', import.meta.url);
mkdirSync(artifacts, { recursive: true });
const { page, browser } = await launch({ width: 1200, height: 900 });
const out = { completed: false }, evidence = {};
const root = page.locator('#host > houseplan-card');
const dev = id => root.locator(`[data-hp="device"][data-id="${id}"]`);
const dialog = () => root.locator('hp-dialog[data-kind="marker"]');
const settle = () => page.evaluate(() => window.__hpTest.settled());
const open = async () => page.evaluate(async () => {
  await window.__hpTest.setMode('devices'); await window.__hpTest.openMarkerDialog('d_temp');
});
const close = () => page.evaluate(async () => {
  const closed = await window.__hpTest.close(undefined, { via: 'cancel' });
  closed.confirm?.querySelector('[data-hp="dialog-confirm"]')?.click();
  await window.__hpTest.settled();
});
const sample = () => page.evaluate(() => {
  const marker = window.__card.shadowRoot.querySelector('[data-hp="device"][data-id="d_temp"]');
  return { lqi: marker?.querySelector('.lqi')?.textContent.trim() ?? null,
    badge: marker?.querySelector('.value-badge')?.textContent.trim() ?? null,
    battery: marker?.querySelector('.device-battery')?.dataset.state ?? null };
});
const reading = async value => {
  await page.evaluate(async value => {
    const c = window.__card;
    c.hass = { ...c.hass, states: { ...c.hass.states,
      'sensor.hp867_lqi': { ...c.hass.states['sensor.hp867_lqi'], state: String(value) } } };
    for (const card of document.querySelectorAll('houseplan-space-card')) card.hass = c.hass;
    await window.__hpTest.settled();
  }, value);
};
try {
  await installBatteryFixture(page);
  await page.evaluate(async () => {
    const c = window.__card;
    window.__addRegistryEntity('sensor.hp867_lqi', null, '137');
    Object.assign(c.hass.entities['sensor.hp867_lqi'], { device_id: 'd_temp', entity_category: 'diagnostic' });
    window.__setRegistryArea('entity', 'sensor.hp867_lqi', null);
    // This scenario isolates a sibling-only reading. The stock primary has
    // its own linkquality=154, which would correctly enter the same average.
    const attributes = { ...c.hass.states['sensor.living_temp'].attributes };
    delete attributes.linkquality; delete attributes.lqi;
    c.hass = { ...c.hass, states: { ...c.hass.states,
      'sensor.living_temp': { ...c.hass.states['sensor.living_temp'], attributes },
      'sensor.hp867_lqi': { entity_id: 'sensor.hp867_lqi', state: '137', attributes: { unit_of_measurement: 'lqi' } } } };
    window.__signal867 = { primary: c.hass.states['sensor.living_temp'], writes: [], reject: false };
    const original = c.hass.callWS;
    c.hass = { ...c.hass, callWS: async message => {
      if (message.type === 'houseplan/config/set') {
        window.__signal867.writes.push(structuredClone(message));
        if (window.__signal867.reject) throw Object.assign(new Error('fixture config refusal'), { code: 'fixture-refusal' });
      }
      if (message.type === 'zha/devices') return [
        { ieee: '00124b0000000001', nwk: 0, device_reg_id: 'd_light1', device_type: 'Coordinator', neighbors: [] },
        { ieee: '00124b0000000002', nwk: 2, device_reg_id: 'd_temp', device_type: 'EndDevice',
          neighbors: [{ ieee: '00124b0000000001', relationship: 'Parent', lqi: 100 }] },
      ];
      return original(message);
    } };
  });
  await patchBatteryMarker(page, { binding: 'entity:sensor.living_temp' });
  await page.waitForFunction(() => window.__card.shadowRoot.querySelector('[data-id="d_temp"] .lqi')?.textContent.trim() === '137');
  out.entityInheritsOwnSiblingAndExistingBattery = (await sample()).battery === 'normal';
  await page.evaluate(() => window.__hpTest.setServerConfig(cfg => ({ ...cfg,
    settings: { ...cfg.settings, show_device_battery: false } })));
  await reading(0);
  await page.waitForFunction(() => window.__card.shadowRoot.querySelector('[data-id="d_temp"] .lqi')?.textContent.trim() === '0');
  out.siblingOnlyZeroPaintsWithBatteryOff = (await sample()).battery === null
    && await page.evaluate(() => window.__card.hass.states['sensor.living_temp'] === window.__signal867.primary);
  await reading(55);

  await open();
  const checkbox = dialog().locator('#marker-hide-signal');
  out.checkboxDefaultsOffAndHasLazyHelp = !await checkbox.isChecked()
    && await dialog().locator('hp-help[data-help-key="marker.hide_signal_help"]').count() === 1;
  await checkbox.check();
  await page.waitForFunction(() => !window.__card.shadowRoot.querySelector('hp-device-preview')?.shadowRoot?.querySelector('.lqi'));
  out.draftHidesOnlyPreviewLine = (await sample()).lqi === '55';
  await close();
  await page.evaluate(() => window.__hpTest.setMode('view'));
  out.cancelKeepsAcceptedLineAndFlag = (await sample()).lqi === '55'
    && await page.evaluate(() => !window.__card._serverCfg.markers.find(m => m.id === 'd_temp').hide_signal);

  await open(); await dialog().locator('#marker-hide-signal').check();
  await page.evaluate(() => { window.__signal867.reject = true; window.__signal867.writes.length = 0; });
  await dialog().locator('.dialog-action-commit [data-hp="dialog-confirm"]').click();
  await page.waitForFunction(() => window.__signal867.writes.length === 1 && window.__card._markerDialog?.busy === false);
  out.refusalKeepsDraftAndAcceptedPlan = await dialog().locator('#marker-hide-signal').isChecked()
    && (await sample()).lqi === '55' && await page.evaluate(() => !window.__card._serverCfg.markers.find(m => m.id === 'd_temp').hide_signal);
  await page.evaluate(() => { window.__signal867.reject = false; });
  await dialog().locator('.dialog-action-commit [data-hp="dialog-confirm"]').click();
  await dialog().waitFor({ state: 'detached' });
  out.retryWritesOnceAndHidesAcceptedLine = (await sample()).lqi === null
    && await page.evaluate(() => window.__signal867.writes.length === 2
      && window.__card._serverCfg.markers.find(m => m.id === 'd_temp').hide_signal === true);
  await open();
  out.saveSurvivesReopen = await dialog().locator('#marker-hide-signal').isChecked();
  await close(); await page.evaluate(() => window.__hpTest.setMode('view'));
  await dev('d_temp').hover(); await settle();
  out.localHideRetainsOrdinaryTooltip = await page.evaluate(() => window.__card.shadowRoot
    .querySelector('[data-hp-live-tip]')?.textContent.includes('LQI 55'));
  await page.mouse.move(2, 2);
  await patchBatteryMarker(page, { value_badge: { enabled: true, source: { kind: 'derived_lqi' } } });
  out.localHideRetainsExplicitBadge = (await sample()).badge === '55' && (await sample()).lqi === null;
  await patchBatteryMarker(page, { value_badge: { enabled: false }, hide_signal: false });

  await page.evaluate(async () => {
    await customElements.whenDefined('houseplan-space-card');
    const secondary = document.createElement('houseplan-space-card');
    secondary.setConfig({ type: 'custom:houseplan-space-card', space: 'f1', live_states: true, show_button: false });
    secondary.hass = window.__card.hass; document.body.appendChild(secondary);
  });
  await page.waitForFunction(() => document.querySelector('houseplan-space-card')?.shadowRoot?.querySelector('[data-id="d_temp"] .lqi')?.textContent.trim() === '55');
  await reading(77);
  await page.waitForFunction(() => document.querySelector('houseplan-space-card')?.shadowRoot?.querySelector('[data-id="d_temp"] .lqi')?.textContent.trim() === '77');
  out.spaceCardSharesSiblingUpdate = (await sample()).lqi === '77';
  await page.evaluate(() => document.querySelector('houseplan-space-card').remove());
  await page.evaluate(() => window.__hpTest.setVolumetricView(true));
  await page.waitForFunction(() => window.__card.shadowRoot.querySelector('[data-hp="iso-walls"]'));
  out.isoUsesSameReading = (await sample()).lqi === '77';
  await page.screenshot({ path: fileURLToPath(new URL('iso-reading.png', artifacts)) });
  await page.evaluate(() => window.__card.setConfig({ type: 'custom:houseplan-card', kiosk: true, cycle: 0, language: 'en' }));
  await settle(); out.kioskUsesSameReadingWithoutTopology = (await sample()).lqi === '77'
    && await root.locator('hp-zigbee-topology-overlay').count() === 0;
  await page.evaluate(() => window.__card.setConfig({ type: 'custom:houseplan-card', language: 'en' }));
  await settle(); await page.evaluate(() => window.__hpTest.setVolumetricView(false));

  // Two entity aliases plus a device marker. Only public registry/config/layout inputs.
  await page.evaluate(async () => {
    const c = window.__card;
    window.__addRegistryEntity('switch.hp867_second', null, 'off');
    Object.assign(c.hass.entities['switch.hp867_second'], { device_id: 'd_temp' });
    window.__setRegistryArea('entity', 'switch.hp867_second', null);
    c.hass = { ...c.hass };
    await window.__hpTest.setServerConfig(cfg => ({ ...cfg,
      settings: { ...cfg.settings, zigbee_topology: { enabled: true, z2m_base_topics: [] } },
      markers: [...cfg.markers.filter(m => m.id !== 'd_temp'),
        { id: 'd_temp', binding: 'device:d_temp', space: 'f1' },
        { id: 'hp867_first', binding: 'entity:sensor.living_temp', space: 'f1' },
        { id: 'hp867_second', binding: 'entity:switch.hp867_second', space: 'f1' }] }));
    await window.__hpTest.setLayout(layout => ({ ...layout, d_temp: { s: 'f1', x: .30, y: .40 },
      hp867_first: { s: 'f1', x: .55, y: .45 }, hp867_second: { s: 'f1', x: .70, y: .60 } }));
  });
  await root.locator('[data-hp="settings"]').click();
  const settings = root.locator('hp-zigbee-topology-settings');
  await settings.locator('.provider button').first().click();
  await page.waitForFunction(() => window.__card.shadowRoot.querySelector('hp-zigbee-topology-settings')?._snapshot?.states?.zha?.phase === 'ready');
  await page.evaluate(() => window.__hpTest.close(undefined, { via: 'cancel' }));
  const geometry = async (hovered, expectedOrigin) => {
    await page.mouse.move(2, 2); await dev(hovered).hover();
    await page.waitForFunction(() => !!window.__card.shadowRoot.querySelector('hp-zigbee-topology-overlay')?.shadowRoot?.querySelector('[data-hp="zigbee-topology-line"]'));
    await settle();
    return page.evaluate(expectedOrigin => {
      const r = window.__card.shadowRoot, o = r.querySelector('hp-zigbee-topology-overlay');
      const svg = o.shadowRoot.querySelector('svg'), matrix = svg.getScreenCTM();
      const line = o.shadowRoot.querySelector('[data-hp="zigbee-topology-line"]');
      const start = new DOMPoint(Number(line.getAttribute('x1')), Number(line.getAttribute('y1'))).matrixTransform(matrix);
      const box = r.querySelector(`[data-hp="device"][data-id="${expectedOrigin}"]`).getBoundingClientRect();
      const ids = [...r.querySelectorAll('[data-hp-zigbee-topology-endpoint]')].map(x => x.dataset.id).sort();
      return { aligned: Math.hypot(start.x - box.left - box.width / 2, start.y - box.top - box.height / 2) < 1,
        ids, lines: o.shadowRoot.querySelectorAll('[data-hp="zigbee-topology-line"]').length };
    }, expectedOrigin);
  };
  evidence.deviceRepresentative = await geometry('hp867_second', 'd_temp');
  out.secondAliasUsesCanonicalDeviceAnchor = evidence.deviceRepresentative.aligned
    && evidence.deviceRepresentative.lines === 1 && !evidence.deviceRepresentative.ids.includes('hp867_second');
  await page.evaluate(() => window.__hpTest.setServerConfig(cfg => ({ ...cfg,
    markers: cfg.markers.map(m => m.id === 'd_temp' ? { ...m, hidden: true } : m) })));
  evidence.entityRepresentative = await geometry('hp867_second', 'hp867_first');
  out.hiddenDeviceFallsBackToFirstConfiguredEntity = evidence.entityRepresentative.aligned
    && !evidence.entityRepresentative.ids.includes('d_temp');
  await page.screenshot({ path: fileURLToPath(new URL('canonical-entity-anchor.png', artifacts)) });
  out.completed = true;
} catch (error) {
  evidence.failure = await page.evaluate(() => ({ toast: window.__card._toast,
    draft: window.__card._markerDialog && { binding: window.__card._markerDialog.binding,
      hideSignal: window.__card._markerDialog.hideSignal, busy: window.__card._markerDialog.busy },
    writes: window.__signal867?.writes, canEdit: window.__card._canEdit,
    transport: String(window.__card.hass.callWS).slice(0, 160) }));
  console.error('signal witness failure', JSON.stringify(evidence.failure));
  throw error;
} finally {
  writeFileSync(new URL('evidence.json', artifacts), JSON.stringify({ out, evidence }, null, 2));
  checkAll(out); await finish(browser, out);
}
