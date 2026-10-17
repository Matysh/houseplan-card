/** #867 AC4/AC7: public registry/plan inputs and trusted mouse canonical-anchor matrix. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { launch, checkAll, finish } from './serve.mjs';

const artifacts = new URL('../artifacts/device-signal-topology-867/', import.meta.url);
mkdirSync(artifacts, { recursive: true });
const { page, browser } = await launch({ width: 1200, height: 900 });
const out = { completed: false }, evidence = {};
const root = page.locator('#host > houseplan-card');
const dev = id => root.locator(`[data-hp="device"][data-id="${id}"]`);
const settle = () => page.evaluate(() => window.__hpTest.settled());
const readZha = async () => {
  await root.locator('[data-hp="settings"]').click();
  await root.locator('[data-section-target="zigbee"]').click();
  const settings = root.locator('hp-zigbee-topology-settings');
  await settings.locator('.hpf-actions button').first().click();
  await page.waitForFunction(() => window.__card.shadowRoot.querySelector('hp-zigbee-topology-settings')
    ?._snapshot?.states?.zha?.phase === 'ready');
  await page.evaluate(() => window.__hpTest.close(undefined, { via: 'cancel' }));
};
const changeMarkers = patch => page.evaluate(async patch => {
  await window.__hpTest.setServerConfig(cfg => ({ ...cfg,
    markers: cfg.markers.map(marker => patch[marker.id] ? { ...marker, ...patch[marker.id] } : marker) }));
}, patch);
const geometry = async (hovered, expectedOrigin) => {
  await page.mouse.move(2, 2); await dev(hovered).hover();
  await page.waitForFunction(() => !!window.__card.shadowRoot.querySelector('hp-zigbee-topology-overlay')
    ?.shadowRoot?.querySelector('[data-hp="zigbee-topology-line"]'));
  await settle();
  return page.evaluate(expectedOrigin => {
    const r = window.__card.shadowRoot, overlay = r.querySelector('hp-zigbee-topology-overlay');
    const svg = overlay.shadowRoot.querySelector('svg'), matrix = svg.getScreenCTM();
    const line = overlay.shadowRoot.querySelector('[data-hp="zigbee-topology-line"]');
    const start = new DOMPoint(Number(line.getAttribute('x1')), Number(line.getAttribute('y1'))).matrixTransform(matrix);
    const box = r.querySelector(`[data-hp="device"][data-id="${expectedOrigin}"]`).getBoundingClientRect();
    const ids = [...r.querySelectorAll('[data-hp-zigbee-topology-endpoint]')].map(node => node.dataset.id).sort();
    return { aligned: Math.hypot(start.x - box.left - box.width / 2, start.y - box.top - box.height / 2) < 1,
      ids, lines: overlay.shadowRoot.querySelectorAll('[data-hp="zigbee-topology-line"]').length,
      text: overlay.shadowRoot.textContent };
  }, expectedOrigin);
};
try {
  await page.evaluate(async () => {
    const card = window.__card;
    window.__addRegistryEntity('switch.hp867_second', null, 'off', 'demo', { device_id: 'd_temp' });
    window.__topology867 = { ambiguous: false };
    const original = card.hass.callWS;
    card.hass = { ...card.hass, callWS: async message => message.type === 'config_entries/get'
      ? [{ entry_id: 'hp867-zha', domain: 'zha', title: 'Fixture ZHA' }] : message.type === 'zha/devices' ? [
      { ieee: '00124b0000000001', nwk: 0, device_reg_id: 'd_light1', device_type: 'Coordinator', neighbors: [] },
      { ieee: '00124b0000000002', nwk: 2,
        ...(window.__topology867.ambiguous ? {} : { device_reg_id: 'd_temp' }), device_type: 'Router',
        routes: [{ dest_nwk: 0, next_hop: 0, route_status: 'Active' }],
        neighbors: [{ ieee: '00124b0000000001', relationship: 'Parent', lqi: 100 }] },
      { ieee: '00124b0000000003', nwk: 3, device_reg_id: 'd_lamp', device_type: 'EndDevice',
        neighbors: [{ ieee: '00124b0000000002', relationship: 'Parent', lqi: 80 }] },
    ] : original(message) };
    await window.__hpTest.setServerConfig(cfg => ({ ...cfg,
      settings: { ...cfg.settings, zigbee_topology: { enabled: true, z2m_base_topics: [] } },
      markers: [...cfg.markers.filter(marker => marker.id !== 'd_temp'),
        { id: 'd_temp', binding: 'device:d_temp', space: 'f1' },
        { id: 'hp867_first', binding: 'entity:sensor.living_temp', space: 'f1' },
        { id: 'hp867_second', binding: 'entity:switch.hp867_second', space: 'f1' }] }));
    await window.__hpTest.setLayout(layout => ({ ...layout, d_temp: { s: 'f1', x: .30, y: .40 },
      hp867_first: { s: 'f1', x: .55, y: .45 }, hp867_second: { s: 'f1', x: .70, y: .60 } }));
    await window.__hpTest.waitForWrites();
  });
  await dev('hp867_second').hover(); await settle();
  out.emptyProviderHoverDoesNotContinuouslyUpdate = await page.evaluate(async () => {
    const overlay = window.__card.shadowRoot.querySelector('hp-zigbee-topology-overlay');
    await overlay.updateComplete;
    let prior = overlay.updateComplete, updates = 0;
    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      const current = overlay.updateComplete;
      if (current !== prior) { updates++; prior = current; }
    }
    return updates <= 2 && !overlay.shadowRoot.querySelector('line');
  });
  await readZha();
  evidence.deviceRepresentative = await geometry('hp867_second', 'd_temp');
  out.secondAliasUsesCanonicalDeviceAnchor = evidence.deviceRepresentative.aligned
    && evidence.deviceRepresentative.lines === 2 && !evidence.deviceRepresentative.ids.includes('hp867_second');
  await changeMarkers({ d_temp: { hidden: true } });
  evidence.entityRepresentative = await geometry('hp867_second', 'hp867_first');
  out.hiddenDeviceFallsBackToFirstConfiguredEntity = evidence.entityRepresentative.aligned
    && !evidence.entityRepresentative.ids.includes('d_temp');
  await page.evaluate(() => window.__hpTest.setServerConfig(cfg => ({ ...cfg,
    markers: [...cfg.markers.filter(marker => !['hp867_first', 'hp867_second'].includes(marker.id)),
      cfg.markers.find(marker => marker.id === 'hp867_second'),
      cfg.markers.find(marker => marker.id === 'hp867_first')] })));
  evidence.reordered = await geometry('hp867_first', 'hp867_second');
  out.configuredReorderChangesCanonicalAnchor = evidence.reordered.aligned;
  // Re-apply the same accepted server body to prove HA frame identity does not pick a different alias.
  await page.evaluate(async () => { const c = window.__card; c.hass = { ...c.hass }; await window.__hpTest.settled(); });
  evidence.nextFrame = await geometry('hp867_first', 'hp867_second');
  out.haFrameKeepsConfiguredAnchor = evidence.nextFrame.aligned;
  await page.screenshot({ path: fileURLToPath(new URL('canonical-entity-anchor.png', artifacts)) });
  await page.evaluate(() => {
    const old = window.__card, card = document.createElement('houseplan-card');
    card.setConfig({ type: 'custom:houseplan-card', language: 'en' });
    old.replaceWith(card); card.hass = old.hass; window.__card = card;
  });
  await page.waitForFunction(() => window.__card._loadOk && window.__card._booting === false);
  await readZha();
  evidence.remounted = await geometry('hp867_first', 'hp867_second');
  out.coldRemountKeepsConfiguredAnchor = evidence.remounted.aligned;
  await changeMarkers({ d_temp: { hidden: false, space: 'garden', area: 'garden', room_id: 'g1' } });
  await page.evaluate(() => window.__hpTest.setLayout(layout => ({ ...layout,
    d_temp: { ...layout.d_temp, s: 'garden' } })));
  await page.mouse.move(2, 2); await dev('hp867_first').hover();
  await page.waitForFunction(() => !!window.__card.shadowRoot.querySelector('hp-zigbee-topology-overlay')
    ?.shadowRoot?.querySelector('[data-hp="zigbee-topology-parent-bubble"][data-kind="remote-space"]'));
  evidence.remote = await page.evaluate(() => {
    const r = window.__card.shadowRoot, overlay = r.querySelector('hp-zigbee-topology-overlay');
    return { text: overlay.shadowRoot.textContent, title: window.__card._serverCfg.spaces.find(space => space.id === 'garden').title,
      lines: overlay.shadowRoot.querySelectorAll('[data-hp="zigbee-topology-line"]').length,
      endpoints: r.querySelectorAll('[data-hp-zigbee-topology-endpoint]').length };
  });
  out.remoteRepresentativeHasNamedBubbleWithoutCrossFloorLine = evidence.remote.lines === 0
    && evidence.remote.endpoints === 0 && evidence.remote.text.includes(evidence.remote.title);
  await changeMarkers({ d_temp: { hidden: true }, hp867_first: { hidden: true }, hp867_second: { hidden: true } });
  await page.mouse.move(2, 2); await dev('d_lamp').hover();
  await page.waitForFunction(() => !!window.__card.shadowRoot.querySelector('hp-zigbee-topology-overlay')
    ?.shadowRoot?.querySelector('[data-hp="zigbee-topology-parent-bubble"][data-kind="unplaced-device"]'));
  evidence.unplaced = await page.evaluate(() => {
    const overlay = window.__card.shadowRoot.querySelector('hp-zigbee-topology-overlay');
    return { text: overlay.shadowRoot.textContent, name: window.__card.hass.devices.d_temp.name,
      lines: overlay.shadowRoot.querySelectorAll('[data-hp="zigbee-topology-line"]').length,
      parentLines: overlay.shadowRoot.querySelectorAll('[data-hp="zigbee-topology-parent-line"]').length,
      endpoints: [...window.__card.shadowRoot.querySelectorAll('[data-hp-zigbee-topology-endpoint]')]
        .map(node => node.dataset.id).sort() };
  });
  out.noRepresentativeExplainsNamedUnplacedDevice = evidence.unplaced.lines === 0 && evidence.unplaced.parentLines === 1
    && JSON.stringify(evidence.unplaced.endpoints) === JSON.stringify(['d_lamp'])
    && evidence.unplaced.text.includes(evidence.unplaced.name) && /not on the plan/i.test(evidence.unplaced.text);
  await changeMarkers({ hp867_first: { hidden: false }, hp867_second: { hidden: false } });
  await page.evaluate(() => {
    const row = window.__card.hass.devices.d_temp;
    window.__addRegistryDevice('d_temp', row.name, row.model, row.area_id,
      { ...row, identifiers: [['zha', '00124b0000000002']] });
    window.__addRegistryDevice('hp867_ambiguous', 'Ambiguous radio', 'Radio', null,
      { identifiers: [['zha', '00124b0000000002']] });
    window.__topology867.ambiguous = true;
    window.__card.hass = { ...window.__card.hass };
  });
  await readZha();
  await page.mouse.move(2, 2); await dev('hp867_first').hover(); await settle();
  out.ambiguousPhysicalRegistryNeverGuessesAnAnchor = await page.evaluate(() => {
    const r = window.__card.shadowRoot, overlay = r.querySelector('hp-zigbee-topology-overlay');
    return !!overlay && overlay.getAttribute('data-tooltip-owner') === 'hp867_first'
      && !overlay.shadowRoot.querySelector('[data-hp="zigbee-topology-line"]')
      && r.querySelectorAll('[data-hp-zigbee-topology-endpoint]').length === 0;
  });
  out.completed = true;
} finally {
  writeFileSync(new URL('evidence.json', artifacts), JSON.stringify({ out, evidence }, null, 2));
  checkAll(out); await finish(browser, out);
}
