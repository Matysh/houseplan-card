/** #1029: public authenticated feed → normal card/space/preview DOM, without HA LQI. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { launch, checkAll, finish, requirePinnedBrowser } from './serve.mjs';
import { installBatteryFixture, patchBatteryMarker } from './helpers/device-battery-fixture.mjs';

const output = new URL('../artifacts/direct-zigbee-lqi-1029/', import.meta.url);
mkdirSync(output, { recursive: true });
requirePinnedBrowser();
const { page, browser } = await launch({ width: 1200, height: 900 });
const out = { completed: false };
const root = page.locator('#host > houseplan-card');
const line = root.locator('[data-hp="device"][data-id="d_temp"] .lqi');
const paint = () => line.evaluate(node => { const r = node.getBoundingClientRect(), s = getComputedStyle(node); return {
  x:r.x,y:r.y,width:r.width,height:r.height,color:s.color,font:s.font,transform:s.transform,opacity:s.opacity,
}; });
const feed = async (lqi, available = true) => {
  await page.evaluate(({ lqi, available }) => {
    const f = window.__lqi1029;
    f.callback({ kind: 'reset', session_id: 'runtime-1029', revision: ++f.revision,
      devices: lqi === null ? {} : { d_temp: { lqi, available, provider: 'z2m', observed_at: 123, measurement_at: null } } });
  }, { lqi, available });
  await page.evaluate(() => window.__hpTest.settled());
};
try {
  await installBatteryFixture(page);
  await page.evaluate(async () => {
    const c = window.__card, attributes = { ...c.hass.states['sensor.living_temp'].attributes, linkquality: 137 };
    c.hass = { ...c.hass, states: { ...c.hass.states,
      'sensor.living_temp': { ...c.hass.states['sensor.living_temp'], attributes } } };
    await window.__hpTest.settled();
  });
  await line.filter({ hasText: '137' }).waitFor();
  await page.evaluate(async () => {
    const c = window.__card, original = c.hass.callWS;
    const attributes = { ...c.hass.states['sensor.living_temp'].attributes };
    delete attributes.linkquality; delete attributes.lqi;
    const states = { ...c.hass.states, 'sensor.living_temp': { ...c.hass.states['sensor.living_temp'], attributes } };
    const f = window.__lqi1029 = { callback: null, revision: 0, subscriptions: 0, releases: 0, commands: [], states };
    const connection = { ...c.hass.connection, subscribeMessage: async (callback, message) => {
      if (message.type !== 'houseplan/zigbee_lqi/subscribe') return c.hass.connection.subscribeMessage(callback, message);
      f.callback = callback; f.subscriptions++;
      callback({ kind: 'reset', session_id: 'runtime-1029', revision: 0, devices: {} });
      return () => { f.releases++; };
    } };
    c.hass = { ...c.hass, connection, states, callWS: async message => {
      f.commands.push(message.type);
      const response = await original(message);
      return message.type === 'houseplan/config/get' ? { ...response, zigbee_lqi_api: 1 } : response;
    } };
    await window.__hpTest.settled();
  });
  await page.waitForFunction(() => typeof window.__lqi1029.callback === 'function');
  out.coldStartWaitsWithoutDiagnosticEntity = await line.count() === 0;
  await feed(137); await line.filter({ hasText: '137' }).waitFor();
  const directPixels = await line.screenshot({ animations: 'disabled' });
  const directPaint = await paint();
  writeFileSync(new URL('direct.png', output), directPixels);
  await page.evaluate(async () => {
    const c = window.__card;
    c.hass = { ...c.hass, states: { ...c.hass.states, 'sensor.living_temp': {
      ...c.hass.states['sensor.living_temp'], attributes: { ...c.hass.states['sensor.living_temp'].attributes, linkquality:137 },
    } } };
    await window.__hpTest.settled();
  });
  await feed(null); await line.filter({ hasText: '137' }).waitFor();
  const haPixels = await line.screenshot({ animations: 'disabled' });
  writeFileSync(new URL('ha.png', output), haPixels);
  assert.deepEqual(await paint(), directPaint, 'same reading keeps colour, geometry and typography');
  assert.deepEqual(directPixels, haPixels, 'direct/HA equal LQI uses pixel-identical text and colour');
  out.flatSamePixelsAsHa = true;
  await page.evaluate(async () => {
    const c = window.__card, attributes = { ...c.hass.states['sensor.living_temp'].attributes };
    delete attributes.linkquality; delete attributes.lqi;
    c.hass = { ...c.hass, states: { ...c.hass.states, 'sensor.living_temp': { ...c.hass.states['sensor.living_temp'], attributes } } };
    window.__lqi1029.states = c.hass.states;
    await window.__hpTest.settled();
  });
  await feed(137);
  out.feedUpdatesWithoutStatesTick = await page.evaluate(() => window.__card.hass.states === window.__lqi1029.states);
  await page.evaluate(() => {
    const f = window.__lqi1029;
    f.callback({kind:'reset',session_id:'runtime-1029',revision:++f.revision,
      devices:{d_temp:{lqi:137,available:true,provider:'zha',observed_at:123,measurement_at:null}}});
  });
  await page.evaluate(() => window.__hpTest.settled());
  out.zhaUsesSamePresentation = await line.textContent() === '137';
  await page.evaluate(async () => {
    await customElements.whenDefined('houseplan-space-card');
    const secondary = document.createElement('houseplan-space-card');
    secondary.setConfig({ type: 'custom:houseplan-space-card', space: 'f1', live_states: true, show_button: false });
    secondary.hass = window.__card.hass; document.body.appendChild(secondary);
  });
  await page.waitForFunction(() => document.querySelector('houseplan-space-card')?.shadowRoot?.querySelector('[data-id="d_temp"] .lqi')?.textContent.trim() === '137');
  await feed(0);
  await page.waitForFunction(() => document.querySelector('houseplan-space-card')?.shadowRoot?.querySelector('[data-id="d_temp"] .lqi')?.textContent.trim() === '0');
  out.staticCardAndRealZeroShareOneFeed = await line.textContent() === '0'
    && await page.evaluate(() => window.__lqi1029.subscriptions === 1);
  await page.evaluate(() => document.querySelector('houseplan-space-card').remove());
  await feed(180);
  await page.evaluate(async () => {
    await window.__hpTest.setMode('devices'); await window.__hpTest.openMarkerDialog('d_temp');
    window.__card.shadowRoot.querySelector('[data-section-target="appearance"]').click();
    await window.__hpTest.settled();
  });
  await page.waitForFunction(() => window.__card.shadowRoot.querySelector('hp-device-preview')?.shadowRoot?.querySelector('.lqi')?.textContent.trim() === '180');
  await feed(40);
  await page.waitForFunction(() => window.__card.shadowRoot.querySelector('hp-device-preview')?.shadowRoot?.querySelector('.lqi')?.textContent.trim() === '40');
  out.previewUsesCurrentFeed = true;
  await page.evaluate(async () => { await window.__hpTest.close(undefined, { via: 'cancel' }); await window.__hpTest.setMode('view'); });
  await patchBatteryMarker(page, { value_badge: { enabled: true, source: { kind: 'derived_lqi' } } });
  await page.waitForFunction(() => window.__card.shadowRoot.querySelector('[data-id="d_temp"] .value-badge')?.textContent.trim() === '40');
  out.explicitLqiSuppressesDuplicateLine = await line.count() === 0;
  await feed(137, false);
  out.lastKnownRetainsDerivedValue = await root.locator('[data-id="d_temp"] .value-badge').textContent() === '137';
  await patchBatteryMarker(page, { value_badge: { enabled: false } });
  await feed(137);
  await page.evaluate(async () => { await window.__hpTest.setVolumetricView(true); });
  await line.filter({ hasText: '137' }).waitFor();
  out.isoUsesSameDirectReading = await root.locator('.stage.projection-iso').count() === 1;
  const isoDirectPixels = await line.screenshot({ animations: 'disabled' }), isoPaint = await paint();
  await page.evaluate(async () => {
    const c = window.__card;
    c.hass = { ...c.hass, states: { ...c.hass.states, 'sensor.living_temp': {
      ...c.hass.states['sensor.living_temp'], attributes: { ...c.hass.states['sensor.living_temp'].attributes, linkquality:137 },
    } } };
    await window.__hpTest.settled();
  });
  await feed(null);
  assert.deepEqual(await paint(), isoPaint);
  assert.deepEqual(await line.screenshot({ animations: 'disabled' }), isoDirectPixels);
  out.isoSamePixelsAsHa = true;
  await page.screenshot({ path: fileURLToPath(new URL('iso.png', output)) });
  await page.evaluate(() => window.__card.setConfig({ type: 'custom:houseplan-card', kiosk: true, cycle: 0, language: 'en' }));
  await feed(180);
  out.kioskKeepsDirectReading = await line.textContent() === '180';
  out.noRadioCommands = await page.evaluate(() => !window.__lqi1029.commands.some(type => /zha\/devices|mqtt\/publish|zigbee\/start/.test(type)));
  await page.evaluate(async () => {
    await customElements.whenDefined('hp-zigbee-topology-settings');
    const form = document.createElement('hp-zigbee-topology-settings');
    form.hass = window.__card.hass; form.value = { enabled:false, z2mBaseTopics:['custom/network'] };
    form.dataset.test = 'lqi-topics-off'; form.embedded = true;
    document.body.appendChild(form); await form.updateComplete;
  });
  const topics = page.locator('hp-zigbee-topology-settings[data-test="lqi-topics-off"]');
  out.topicFieldAvailableWithoutLines = await topics.locator('[data-field="z2m-topics"]').isEnabled()
    && await topics.locator('[data-field="z2m-topics"]').inputValue() === 'custom/network';
  await topics.evaluate(element => element.remove());
  out.completed = true;
} finally {
  writeFileSync(new URL('evidence.json', output), JSON.stringify(out, null, 2));
  checkAll(out); await finish(browser, out);
}
