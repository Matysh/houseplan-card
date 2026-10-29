/** #876/#867: accepted global/local policy composes with own-radio diagnostics. */
import { launch, checkAll, finish } from './serve.mjs';
import { settingsSection } from './helpers/settings-section.mjs';

const { page, browser } = await launch({ width: 1200, height: 900 });
const root = page.locator('#host > houseplan-card');
const ids = ['d_temp', 'lg_sensor.living_temp'];
const out = { completed: false };
const settle = async () => {
  await page.evaluate(() => window.__hpTest.settled());
  // #1112 coalesces Static config events for200ms; the test facade settles only
  // the full card. Observe independent revision adoption before checking LQI.
  await page.waitForFunction(() => window.__signal876.mini._snap?.rev >= window.__card._cfgRev);
  await page.evaluate(() => window.__signal876.mini.updateComplete);
};
const sample = () => page.evaluate(ids => {
  const full = window.__card, mini = window.__signal876.mini;
  const rows = card => ids.map(id => card.shadowRoot.querySelector(`[data-id="${id}"] .lqi`)?.textContent.trim() ?? null);
  return { full: rows(full), mini: rows(mini),
    primarySame: full.hass.states['sensor.living_temp'] === window.__signal876.primary,
    siblingsCaptured: [full._renderDeviceSnapshot, mini._visibleDeviceSnapshot]
      .every(snapshot => snapshot?.entityIds.includes('sensor.hp876_linkquality')),
    batteryAbsent: ids.every(id => !full.shadowRoot.querySelector(`[data-id="${id}"] .device-battery`)) };
}, ids);
const policy = async row => {
  await page.mouse.move(2, 2);
  await page.evaluate(async ({ row, ids }) => {
    const full = window.__card, mini = window.__signal876.mini;
    full.setConfig({ type: 'custom:houseplan-card', show_signal: row.yaml, language: 'en' });
    mini.setConfig({ type: 'custom:houseplan-space-card', space: 'f1', show_signal: row.yaml, show_button: false });
    await window.__hpTest.setServerConfig(cfg => {
      if (row.global) delete cfg.settings.show_lqi; else cfg.settings.show_lqi = false;
      const settings = cfg.spaces.find(space => space.id === 'f1').settings;
      delete settings.show_lqi; delete settings.show_lqi_mode;
      if (row.mode !== 'inherit') { settings.show_lqi_mode = row.mode; settings.show_lqi = row.mode === 'on'; }
      for (const marker of cfg.markers) if (ids.includes(marker.id)) {
        if (row.hide) marker.hide_signal = true; else delete marker.hide_signal;
      }
      return cfg;
    });
  }, { row, ids });
  await settle();
};
const hover = async id => {
  await page.mouse.move(2, 2);
  await root.locator(`[data-hp="device"][data-id="${id}"]`).hover();
  await settle();
  return page.evaluate(() => window.__card.shadowRoot.querySelector('[data-hp-live-tip]')?.textContent || '');
};
try {
  await page.evaluate(async ids => {
    const card = window.__card;
    window.__addRegistryEntity('sensor.hp876_linkquality', null, '137', 'demo',
      { device_id: 'd_temp', entity_category: 'diagnostic' }, { unit_of_measurement: 'lqi' });
    const attributes = { ...card.hass.states['sensor.living_temp'].attributes };
    delete attributes.linkquality; delete attributes.lqi;
    card.hass = { ...card.hass, states: { ...card.hass.states,
      'sensor.living_temp': { ...card.hass.states['sensor.living_temp'], attributes } } };
    window.__signal876 = { primary: card.hass.states['sensor.living_temp'], providerReads: 0 };
    const original = card.hass.callWS;
    card.hass = { ...card.hass, callWS: async message => {
      if (message.type === 'config_entries/get') return [{ entry_id: 'hp876-zha', domain: 'zha', title: 'Fixture ZHA' }];
      if (message.type === 'zha/devices') {
        window.__signal876.providerReads++;
        return [
          { ieee: '00124b0000000001', nwk: 0, device_reg_id: 'd_light1', device_type: 'Coordinator', neighbors: [] },
          { ieee: '00124b0000000002', nwk: 2, device_reg_id: 'd_temp', device_type: 'EndDevice',
            neighbors: [{ ieee: '00124b0000000001', relationship: 'Parent', lqi: 100 }] },
        ];
      }
      return original(message);
    } };
    await window.__hpTest.setServerConfig(cfg => {
      cfg.settings.show_device_battery = false;
      cfg.settings.zigbee_topology = { enabled: true, z2m_base_topics: [] };
      cfg.spaces[0].settings = { ...cfg.spaces[0].settings, label_lqi: true };
      cfg.markers = [...cfg.markers.filter(marker => !ids.includes(marker.id)),
        { id: ids[0], binding: 'device:d_temp', space: 'f1', display: 'badge' },
        { id: ids[1], binding: 'entity:sensor.living_temp', space: 'f1', display: 'badge' }];
      return cfg;
    });
    await window.__hpTest.setLayout(layout => ({ ...layout,
      [ids[0]]: { s: 'f1', x: .28, y: .34 }, [ids[1]]: { s: 'f1', x: .46, y: .34 } }));
    await customElements.whenDefined('houseplan-space-card');
    const mini = document.createElement('houseplan-space-card');
    mini.setConfig({ type: 'custom:houseplan-space-card', space: 'f1', show_button: false });
    mini.hass = card.hass; document.body.append(mini); window.__signal876.mini = mini;
  }, ids);
  await page.waitForFunction(ids => ids.every(id => window.__signal876.mini.shadowRoot
    ?.querySelector(`[data-id="${id}"] .lqi`)?.textContent.trim() === '137'), ids);

  const cases = [
    { global: false, mode: 'inherit', yaml: true, hide: false, show: false },
    { global: true, mode: 'inherit', yaml: false, hide: false, show: false },
    { global: false, mode: 'on', yaml: false, hide: false, show: true },
    { global: true, mode: 'off', yaml: true, hide: false, show: false },
    { global: true, mode: 'inherit', yaml: true, hide: true, show: true },
    { global: true, mode: 'on', yaml: false, hide: true, show: true },
    { global: false, mode: 'inherit', yaml: true, hide: true, show: false },
    { global: false, mode: 'on', yaml: false, hide: true, show: true },
  ];
  for (const [index, row] of cases.entries()) {
    await policy(row);
    const expected = ids.map(() => row.show && !row.hide ? '137' : null), current = await sample();
    out[`matrix${index}FullAndStaticLine`] = JSON.stringify(current.full) === JSON.stringify(expected)
      && JSON.stringify(current.mini) === JSON.stringify(expected);
    for (const id of ids) out[`matrix${index}Tooltip-${id}`] = (await hover(id)).includes('LQI 137') === row.show;
  }

  // No global/system visibility gate may remove potential diagnostic siblings.
  await policy({ global: false, mode: 'inherit', yaml: true, hide: true });
  await page.evaluate(async () => {
    const card = window.__card;
    card.hass = { ...card.hass, states: { ...card.hass.states,
      'sensor.hp876_linkquality': { ...card.hass.states['sensor.hp876_linkquality'], state: '0' } } };
    window.__signal876.mini.hass = card.hass;
    await window.__hpTest.settled();
  });
  const hiddenTick = await sample();
  out.hiddenBatteryOffTickKeepsSiblingDependencies = hiddenTick.primarySame
    && hiddenTick.siblingsCaptured && hiddenTick.batteryAbsent && hiddenTick.full.every(value => value === null);
  await policy({ global: false, mode: 'on', yaml: false, hide: true });
  out.hiddenLatestZeroRemainsInTooltip = (await hover(ids[1])).includes('LQI 0');
  await policy({ global: false, mode: 'on', yaml: false, hide: false });
  out.unhideUsesLatestZeroInBothConsumers = (await sample()).full.every(value => value === '0')
    && (await sample()).mini.every(value => value === '0');

  await policy({ global: false, mode: 'inherit', yaml: true, hide: true });
  await page.evaluate(id => window.__hpTest.setServerConfig(cfg => ({ ...cfg,
    markers: cfg.markers.map(marker => marker.id === id
      ? { ...marker, value_badge: { enabled: true, source: { kind: 'derived_lqi' } } } : marker) })), ids[1]);
  await settle();
  out.explicitBadgeRemainsVisibleWhenSystemSignalIsOff = await page.evaluate(id => {
    const cards = [window.__card, window.__signal876.mini];
    return cards.every(card => card.shadowRoot.querySelector(`[data-id="${id}"] .value-badge`)?.textContent.trim() === '0'
      && !card.shadowRoot.querySelector(`[data-id="${id}"] .lqi`));
  }, ids[1]);
  await page.evaluate(id => window.__hpTest.setServerConfig(cfg => ({ ...cfg,
    markers: cfg.markers.map(marker => marker.id === id
      ? { ...marker, display: 'value', value_source: { kind: 'derived_lqi' } } : marker) })), ids[1]);
  await settle();
  out.explicitValueRemainsVisibleWhenSystemSignalIsOff = await page.evaluate(id =>
    [window.__card, window.__signal876.mini].every(card =>
      card.shadowRoot.querySelector(`[data-id="${id}"] .valtext`)?.textContent.trim() === '0'), ids[1]);
  await page.evaluate(id => window.__hpTest.setServerConfig(cfg => {
    const marker = cfg.markers.find(marker => marker.id === id);
    marker.display = 'badge'; delete marker.value_source; delete marker.value_badge;
    return cfg;
  }), ids[1]);

  // Provider reads/topology are independent of the system-line and tooltip gate.
  await root.locator('[data-hp="settings"]').click();
  await root.locator('[data-section-target="zigbee"]').click();
  await root.locator('hp-zigbee-topology-settings .hpf-actions button').first().click();
  await page.waitForFunction(() => window.__card.shadowRoot.querySelector('hp-zigbee-topology-settings')
    ?._snapshot?.states?.zha?.phase === 'ready');
  await page.evaluate(() => window.__hpTest.close(undefined, { via: 'cancel' }));
  await root.locator(`[data-hp="device"][data-id="${ids[1]}"]`).hover();
  await page.waitForFunction(() => !!window.__card.shadowRoot.querySelector('hp-zigbee-topology-overlay')
    ?.shadowRoot?.querySelector('[data-hp="zigbee-topology-line"]'));
  out.topologyRemainsAvailableWhenGlobalAndMarkerSignalAreOff = await page.evaluate(() =>
    window.__signal876.providerReads === 1
      && !window.__card.shadowRoot.querySelector('[data-id="lg_sensor.living_temp"] .lqi')
      && !window.__card.shadowRoot.querySelector('[data-hp-live-tip]')?.textContent.includes('LQI 0'));

  // A real marker Save retains the accepted global/local policy and its own flag.
  await policy({ global: false, mode: 'on', yaml: false, hide: false });
  await page.evaluate(async id => {
    await window.__hpTest.setMode('devices');
    await window.__hpTest.openMarkerDialog(id);
  }, ids[1]);
  const markerDialog = root.locator('hp-dialog[data-kind="marker"]');
  await settingsSection(markerDialog, 'appearance');
  await markerDialog.locator('#marker-hide-signal').check();
  await page.waitForFunction(() => !window.__card.shadowRoot.querySelector('hp-device-preview')?.shadowRoot?.querySelector('.lqi'));
  out.draftLocalHideDoesNotChangeAcceptedPolicy = await page.evaluate(id => {
    const card = window.__card;
    return card._serverCfg.settings.show_lqi === false
      && card._serverCfg.spaces.find(space => space.id === 'f1').settings.show_lqi_mode === 'on'
      && !card._serverCfg.markers.find(marker => marker.id === id).hide_signal
      && card.shadowRoot.querySelector(`[data-id="${id}"] .lqi`)?.textContent.trim() === '0';
  }, ids[1]);
  await markerDialog.locator('.dialog-action-commit [data-hp="dialog-confirm"]').click();
  await markerDialog.waitFor({ state: 'detached' });
  await page.evaluate(() => window.__hpTest.setMode('view'));
  await settle();
  out.savedLocalHideKeepsEffectiveTooltipAndPolicy = (await hover(ids[1])).includes('LQI 0')
    && await page.evaluate(id => {
      const cfg = window.__card._serverCfg;
      return cfg.settings.show_lqi === false && cfg.spaces.find(space => space.id === 'f1').settings.show_lqi_mode === 'on'
        && cfg.markers.find(marker => marker.id === id).hide_signal === true
        && !window.__card.shadowRoot.querySelector(`[data-id="${id}"] .lqi`)
        && !window.__signal876.mini.shadowRoot.querySelector(`[data-id="${id}"] .lqi`);
    }, ids[1]);
  await page.evaluate(() => {
    const old = window.__card, card = document.createElement('houseplan-card');
    card.setConfig({ type: 'custom:houseplan-card', language: 'en', show_signal: false });
    old.replaceWith(card); card.hass = old.hass; window.__card = card;
  });
  await page.waitForFunction(() => window.__card._loadOk && window.__card._booting === false);
  out.coldReloadKeepsLocalHideAndEffectiveTooltip = (await hover(ids[1])).includes('LQI 0')
    && await page.evaluate(id => window.__card._serverCfg.markers.find(marker => marker.id === id).hide_signal === true
      && !window.__card.shadowRoot.querySelector(`[data-id="${id}"] .lqi`), ids[1]);
  out.completed = true;
} finally {
  checkAll(out); await finish(browser, out);
}
