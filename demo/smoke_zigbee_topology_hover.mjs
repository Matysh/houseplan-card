import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch();
const result = await page.evaluate(async () => {
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const wait = (predicate, timeout = 3000) => new Promise((resolve, reject) => {
    const started = performance.now();
    const tick = () => {
      if (predicate()) return resolve();
      if (performance.now() - started > timeout) return reject(new Error('topology smoke timeout'));
      setTimeout(tick, 20);
    };
    tick();
  });
  const mouse = (type, relatedTarget = null) => new PointerEvent(type, {
    pointerType: 'mouse', bubbles: true, composed: true, clientX: 200, clientY: 200, relatedTarget,
  });
  const out = {};

  await card.updateComplete;
  out.defaultOff = !root().querySelector('hp-zigbee-topology-overlay');
  out.offHasNoLazyChunk = !performance.getEntriesByType('resource')
    .some((entry) => /zigbee-topology-runtime|hp-zigbee-topology-overlay/.test(entry.name));

  let zhaCalls = 0;
  const originalHass = card.hass;
  card.hass = { ...originalHass, callWS: async (message) => {
    if (message.type !== 'zha/devices') return originalHass.callWS(message);
    zhaCalls++;
    return [
      { ieee: '00124b0000000001', device_reg_id: 'd_light1', neighbors: [
        { ieee: '00124b0000000002', lqi: 180 },
        { ieee: '00124b0000000003', lqi: 80 },
      ] },
      { ieee: '00124b0000000002', device_reg_id: 'd_lamp', neighbors: [] },
      { ieee: '00124b0000000003', device_reg_id: 'd_mower', neighbors: [] },
      { ieee: '00124b0000000004', device_reg_id: 'd_temp', neighbors: [
        { ieee: '00124b0000000005', lqi: 20 },
      ] },
      { ieee: '00124b0000000005', device_reg_id: 'd_tv', neighbors: [] },
    ];
  } };
  await card._ensureEditorRuntime();
  card._openSettingsDialog();
  await card.updateComplete;
  let settings = root().querySelector('hp-zigbee-topology-settings');
  await wait(() => !!settings?.shadowRoot);
  settings._emit({ enabled: true, z2mBaseTopics: [] });
  await card.updateComplete;
  await card._saveSettingsDialog();
  await card.updateComplete;
  await wait(() => !!root().querySelector('hp-zigbee-topology-overlay'));
  out.settingPersists = card._serverCfg.settings.zigbee_topology?.enabled === true;
  out.enableDoesNotFetch = zhaCalls === 0;

  card._openSettingsDialog();
  await card.updateComplete;
  settings = root().querySelector('hp-zigbee-topology-settings');
  await wait(() => !!settings?.shadowRoot?.querySelector('button'));
  await settings._readZha();
  await wait(() => settings._snapshot?.states?.zha?.phase === 'ready');
  out.explicitZhaRead = zhaCalls === 1;
  card._settingsDialog = null;
  card.requestUpdate();
  await card.updateComplete;

  const source = root().querySelector('.dev[data-id="d_light1"]');
  source.dispatchEvent(mouse('pointerover'));
  await wait(() => root().querySelector('hp-zigbee-topology-overlay')?.shadowRoot
    ?.querySelector('[data-hp="zigbee-topology-lines"]'));
  const overlay = root().querySelector('hp-zigbee-topology-overlay');
  out.incidentOnly = overlay.shadowRoot.querySelectorAll('line').length === 1
    && overlay.shadowRoot.querySelectorAll('[data-hp="zigbee-topology-neighbor"]').length === 1;
  out.crossSpaceCount = overlay.shadowRoot.querySelector('[data-hp="zigbee-topology-remote"]')
    ?.textContent.trim() === '+1 in other spaces';
  out.pointerTransparent = getComputedStyle(overlay).pointerEvents === 'none'
    && getComputedStyle(overlay.shadowRoot.querySelector('[data-hp="zigbee-topology-remote"]')).pointerEvents === 'none';

  source.dispatchEvent(mouse('pointerout', root().querySelector('.stage')));
  await card.updateComplete;
  out.leaveClears = !overlay.shadowRoot.querySelector('line');
  source.dispatchEvent(mouse('pointerover'));
  await wait(() => overlay.shadowRoot.querySelector('line'));
  root().querySelector('.stage').dispatchEvent(new PointerEvent('pointermove', {
    pointerType: 'touch', bubbles: true, composed: true, pointerId: 7,
  }));
  await wait(() => !overlay.shadowRoot.querySelector('line'));
  out.touchClears = !overlay.shadowRoot.querySelector('line');

  card._setMode('plan');
  await card.updateComplete;
  out.editorHasNoOverlay = !root().querySelector('hp-zigbee-topology-overlay');
  card._setMode('view');
  card.hass = { ...card.hass, user: { ...card.hass.user, is_admin: false } };
  await card.updateComplete;
  out.nonAdminHasNoOverlay = !root().querySelector('hp-zigbee-topology-overlay') && zhaCalls === 1;
  return out;
});

checkAll(result);
await finish(browser, result);
