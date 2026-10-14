/** #867 AC1–AC3/AC6–AC7: real DOM inputs, own HA diagnostics and canonical radio anchors. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { launch, checkAll, finish } from './serve.mjs';
import { installBatteryFixture } from './helpers/device-battery-fixture.mjs';

const artifacts = new URL('../artifacts/device-signal-867/', import.meta.url);
mkdirSync(artifacts, { recursive: true });
const { page, browser } = await launch({ width: 1200, height: 900 });
const out = { completed: false }, evidence = {};
const root = page.locator('#host > houseplan-card');
const dev = id => root.locator(`[data-hp="device"][data-id="${id}"]`);
const dialog = () => root.locator('hp-dialog[data-kind="marker"]');
const patchSignalMarker = patch => page.evaluate(patch => window.__hpTest.setServerConfig(cfg => ({ ...cfg,
  markers: cfg.markers.map(marker => marker.id === 'lg_sensor.living_temp' ? { ...marker, ...patch } : marker),
})), patch);
const settle = () => page.evaluate(() => window.__hpTest.settled());
const open = async () => page.evaluate(async () => {
  await window.__hpTest.setMode('devices'); await window.__hpTest.openMarkerDialog('lg_sensor.living_temp');
  await window.__hpTest.waitForWrites();
});
const close = () => page.evaluate(async () => {
  const closed = await window.__hpTest.close(undefined, { via: 'cancel' });
  closed.confirm?.querySelector('[data-hp="dialog-confirm"]')?.click();
  await window.__hpTest.settled();
});
const sample = () => page.evaluate(() => {
  const marker = window.__card.shadowRoot.querySelector('[data-hp="device"][data-id="lg_sensor.living_temp"]');
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
    window.__signal867 = { primary: c.hass.states['sensor.living_temp'], writes: [], traces: [], reject: false };
    const original = c.hass.callWS;
    c.hass = { ...c.hass, callWS: async message => {
      if (message.type === 'houseplan/config/set') {
        window.__signal867.writes.push(structuredClone(message));
        window.__signal867.traces.push(new Error('signal config/set').stack);
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
  await page.evaluate(() => window.__hpTest.setServerConfig(cfg => ({ ...cfg,
    // The battery fixture's marker id is also its physical HA device id.
    // Retire the automatic physical placement and use the editor's canonical
    // entity id. Otherwise this fixture aliases the automatic physical item,
    // and saving would also exercise an unrelated marker-id migration.
    markers: [...cfg.markers.map(marker => marker.id === 'd_temp'
      ? { ...marker, id: 'lg_sensor.living_temp', binding: 'entity:sensor.living_temp' } : marker),
    { id: 'hp867_retired_parent', binding: 'device:d_temp', removed: true, hidden: true }] })));
  await page.waitForFunction(() => window.__card.shadowRoot.querySelector('[data-id="lg_sensor.living_temp"] .lqi')?.textContent.trim() === '137');
  out.entityInheritsOwnSiblingAndExistingBattery = (await sample()).battery === 'normal';
  out.fixtureHasOneExactEntityNotAnAutomaticPhysicalAlias = await page.evaluate(() => {
    const matches = window.__card._devices.filter(device => device.id === 'lg_sensor.living_temp');
    return matches.length === 1 && matches[0].bindingKind === 'entity';
  });
  await page.evaluate(() => window.__hpTest.setServerConfig(cfg => ({ ...cfg,
    settings: { ...cfg.settings, show_device_battery: false } })));
  await reading(0);
  await page.waitForFunction(() => window.__card.shadowRoot.querySelector('[data-id="lg_sensor.living_temp"] .lqi')?.textContent.trim() === '0');
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
    && await page.evaluate(() => !window.__card._serverCfg.markers.find(m => m.id === 'lg_sensor.living_temp').hide_signal);

  await open(); await dialog().locator('#marker-hide-signal').check();
  await page.evaluate(() => { window.__signal867.reject = true; window.__signal867.writes.length = 0; window.__signal867.traces.length = 0; });
  await dialog().locator('.dialog-action-commit [data-hp="dialog-confirm"]').click();
  await page.waitForFunction(() => window.__signal867.writes.length === 1 && window.__card._markerDialog?.busy === false);
  out.refusalKeepsDraftAndAcceptedPlan = await dialog().locator('#marker-hide-signal').isChecked()
    && (await sample()).lqi === '55' && await page.evaluate(() => !window.__card._serverCfg.markers.find(m => m.id === 'lg_sensor.living_temp').hide_signal);
  await page.evaluate(() => { window.__signal867.reject = false; });
  await dialog().locator('.dialog-action-commit [data-hp="dialog-confirm"]').click();
  await dialog().waitFor({ state: 'detached' });
  out.retryWritesOnceAndHidesAcceptedLine = (await sample()).lqi === null
    && await page.evaluate(() => window.__signal867.writes.length === 2
      && window.__card._serverCfg.markers.find(m => m.id === 'lg_sensor.living_temp').hide_signal === true);
  await open();
  out.saveSurvivesReopen = await dialog().locator('#marker-hide-signal').isChecked();
  await close(); await page.evaluate(() => window.__hpTest.setMode('view'));
  await dev('lg_sensor.living_temp').hover(); await settle();
  out.localHideRetainsOrdinaryTooltip = await page.evaluate(() => window.__card.shadowRoot
    .querySelector('[data-hp-live-tip]')?.textContent.includes('LQI 55'));
  await page.mouse.move(2, 2);
  await patchSignalMarker({ value_badge: { enabled: true, source: { kind: 'derived_lqi' } } });
  out.localHideRetainsExplicitBadge = (await sample()).badge === '55' && (await sample()).lqi === null;
  await patchSignalMarker({ value_badge: { enabled: false }, hide_signal: false });

  await page.evaluate(async () => {
    await customElements.whenDefined('houseplan-space-card');
    const secondary = document.createElement('houseplan-space-card');
    secondary.setConfig({ type: 'custom:houseplan-space-card', space: 'f1', live_states: true, show_button: false });
    secondary.hass = window.__card.hass; document.body.appendChild(secondary);
  });
  await page.waitForFunction(() => document.querySelector('houseplan-space-card')?.shadowRoot?.querySelector('[data-id="lg_sensor.living_temp"] .lqi')?.textContent.trim() === '55');
  await reading(77);
  await page.waitForFunction(() => document.querySelector('houseplan-space-card')?.shadowRoot?.querySelector('[data-id="lg_sensor.living_temp"] .lqi')?.textContent.trim() === '77');
  out.spaceCardSharesSiblingUpdate = (await sample()).lqi === '77';
  await page.evaluate(() => document.querySelector('houseplan-space-card').remove());
  await page.evaluate(async () => {
    await window.__hpTest.setMode('view');
    await window.__hpTest.setVolumetricView(true);
  });
  // f1 is a background-image floor: its 2.5D device plane is real, but it has
  // no structural wall mesh. The public projection class is the correct gate.
  out.isoUsesSameReading = await root.locator('.stage.projection-iso').count() === 1
    && (await sample()).lqi === '77';
  await page.screenshot({ path: fileURLToPath(new URL('iso-reading.png', artifacts)) });
  await page.evaluate(() => window.__card.setConfig({ type: 'custom:houseplan-card', kiosk: true, cycle: 0, language: 'en' }));
  await settle(); out.kioskUsesSameReadingWithoutTopology = (await sample()).lqi === '77'
    && await root.locator('hp-zigbee-topology-overlay').count() === 0;
  await page.evaluate(() => window.__card.setConfig({ type: 'custom:houseplan-card', language: 'en' }));
  await settle(); await page.evaluate(() => window.__hpTest.setVolumetricView(false));

  out.completed = true;
} catch (error) {
  evidence.failure = await page.evaluate(() => ({ toast: window.__card._toast,
    draft: window.__card._markerDialog && { binding: window.__card._markerDialog.binding,
      hideSignal: window.__card._markerDialog.hideSignal, busy: window.__card._markerDialog.busy },
    writes: window.__signal867?.writes, traces: window.__signal867?.traces, canEdit: window.__card._canEdit,
    transport: String(window.__card.hass.callWS).slice(0, 160) }));
  console.error('signal witness failure', JSON.stringify({ ...evidence.failure,
    writes: evidence.failure.writes?.map(write => ({ expected_rev: write.expected_rev,
      marker: write.config.markers.find(marker => marker.id === 'lg_sensor.living_temp') })) }));
  throw error;
} finally {
  writeFileSync(new URL('evidence.json', artifacts), JSON.stringify({ out, evidence }, null, 2));
  checkAll(out); await finish(browser, out);
}
