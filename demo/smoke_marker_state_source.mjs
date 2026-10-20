/** #977: use actual form controls, accepted fake backend and live HA ticks. */
import { mkdir } from 'node:fs/promises';
import { launch, checkAll, finish, requirePinnedBrowser } from './serve.mjs';
import { settingsSection } from './helpers/settings-section.mjs';
requirePinnedBrowser('icon state source form and preview');
const { page, browser } = await launch({ width: 1280, height: 1100 });
const out = {};
const root = page.locator('#host > houseplan-card');
const dialog = root.locator('hp-dialog[data-kind="marker"]');
const settle = () => page.evaluate(() => window.__hpTest.settled());
const open = async () => {
  await page.evaluate(async () => { const c = window.__card; c._setMode('devices'); c._openMarkerDialog(c._devices.find(d => d.id === 'd_light1')); await c.updateComplete; });
  await settingsSection(dialog, 'appearance'); await settle();
};
const explanation = () => dialog.locator('hp-device-preview').locator('[data-state-source-explanation]').textContent();
const state = async value => {
  await page.evaluate(value => { const c = window.__card; const id = 'binary_sensor.hp977_work';
    c.hass = { ...c.hass, states: { ...c.hass.states, [id]: { ...c.hass.states[id], state: value } } };
    if (window.__mini977) window.__mini977.hass = c.hass;
  }, value); await settle();
};
try {
  await page.evaluate(async () => {
    window.__addRegistryEntity('binary_sensor.hp977_work', null, 'off', 'demo', { device_id: 'd_light1', entity_category: 'diagnostic', name: 'Actual work' }, { device_class: 'running' });
    window.__addRegistryEntity('binary_sensor.hp977_foreign', null, 'on', 'demo', { device_id: 'd_temp', name: 'Actual work' }, { device_class: 'running' });
    await window.__hpTest.setServerConfig(cfg => { cfg.markers = cfg.markers.filter(m => m.id !== 'd_light1');
      cfg.markers.push({ id: 'd_light1', binding: 'device:d_light1', display: 'icon_ripple', ripple_color: '#1234ab' }); return cfg; });
  });
  await open();
  out.sourceAfterDisplay = await dialog.locator('#marker-display').evaluate(node =>
    !!node.closest('.hpf-field')?.nextElementSibling?.matches('[data-state-source]'));
  out.ownOnly = await dialog.locator('#marker-state-source option').evaluateAll(nodes =>
    nodes.some(n => n.value === 'binary_sensor.hp977_work') && !nodes.some(n => n.value === 'binary_sensor.hp977_foreign'));
  await dialog.locator('#marker-state-source').selectOption('binary_sensor.hp977_work'); await settle();
  out.standardInactive = /Icon inactive.*off/i.test(await explanation());
  await state('on');
  out.liveActive = /Icon active.*on/i.test(await explanation());
  await dialog.locator('#marker-state-source-mode').selectOption('states');
  await dialog.getByRole('button', { name: 'Add state', exact: true }).click();
  await dialog.locator('#marker-state-source-states input').fill('washing'); await settle();
  out.exactNonmatch = /Icon inactive/.test(await explanation());
  await state('washing'); out.exactMatch = /Icon active/.test(await explanation());
  await mkdir('demo/out/marker-state-source-977', { recursive: true });
  await page.screenshot({ path: 'demo/out/marker-state-source-977/manual-en.png' });
  // Persist via the actual form button; fake backend acceptance is observable.
  await dialog.locator('[data-hp="dialog-confirm"]').click();
  await page.waitForFunction(() => !window.__card._markerDialog);
  out.saved = await page.evaluate(() => {
    const m = window.__card._serverCfg.markers.find(m => m.id === 'd_light1');
    return m.state_source.entity_id === 'binary_sensor.hp977_work' && m.state_source.active_states.join() === 'washing' && m.ripple_color === '#1234ab';
  });
  await page.evaluate(async () => {
    const c = window.__card; c._setMode('view');
    await customElements.whenDefined('houseplan-space-card');
    const mini = document.createElement('houseplan-space-card'); mini.setConfig({ type: 'custom:houseplan-space-card', space: 'f1', show_button: false });
    mini.hass = c.hass; document.body.append(mini); window.__mini977 = mini;
  }); await settle();
  await page.waitForFunction(() => window.__mini977?.renderRoot?.querySelector('[data-id="d_light1"].on'));
  out.planStaticParity = await page.evaluate(() => [window.__card, window.__mini977].every(c => c.renderRoot.querySelector('[data-id="d_light1"].on')));
  await state('unknown');
  out.unknownNoFallback = await page.evaluate(() => [window.__card, window.__mini977].every(c => !c.renderRoot.querySelector('[data-id="d_light1"].on')));
  await open(); out.unknownExplained = /Activity unknown/.test(await explanation());
  await page.evaluate(() => window.__card.setConfig({ ...window.__card._config, language: 'ru' })); await settle();
  await page.waitForFunction(() => window.__card.renderRoot.querySelector('label[for="marker-state-source"]')?.textContent === 'Источник состояния значка');
  out.ruExplained = /Активность неизвестна/.test(await explanation());
  await page.screenshot({ path: 'demo/out/marker-state-source-977/unknown-ru.png' });
  // Editing a sibling setting/Cancel must not reset accepted custom state.
  await dialog.locator('#marker-state-source').selectOption(''); await settle();
  await dialog.locator('[data-hp="dialog-confirm"]').click();
  await page.waitForFunction(() => !window.__card._markerDialog);
  out.autoClears = await page.evaluate(() => !Object.hasOwn(window.__card._serverCfg.markers.find(m => m.id === 'd_light1'), 'state_source'));
  out.completed = true;
} finally { checkAll(out); await finish(browser, out); }
