/** #1087: native View clicks, real form saves and observable HA dialog events. */
import { mkdir, writeFile } from 'node:fs/promises';
import { launch, checkAll, finish, requirePinnedBrowser } from './serve.mjs';
import { settingsSection } from './helpers/settings-section.mjs';
requirePinnedBrowser('device HA more-info target');
const { page, browser } = await launch({ width: 1100, height: 1000 });
const out = {};
const root = page.locator('#host > houseplan-card');
const dialog = root.locator('hp-dialog[data-kind="marker"]');
const device = () => root.locator('[data-hp="device"][data-id="d_temp"] .device-core');
const settle = () => page.evaluate(() => window.__hpTest.settled());
const target = () => dialog.locator('#marker-more-info-entity');
const picker = () => dialog.locator('[data-more-info-target] .hpf-picker');
const choose = async value => {
  if (await target().getAttribute('aria-expanded') !== 'true') await target().click();
  await picker().locator('.hpf-panel input').fill('');
  await picker().locator(`[role="option"][data-value="${value}"]`).click();
  await settle();
};
const open = async () => {
  await device().click({ button: 'right' });
  await root.locator('[data-hp="device-context-menu"]:not([inert]) [data-action="view-device-settings"]').click();
  await dialog.waitFor(); await settingsSection(dialog, 'actions'); await settle();
};
const save = async () => {
  await dialog.locator('[data-hp="dialog-confirm"]').click();
  await dialog.waitFor({ state: 'detached' }); await settle();
};
const patch = async change => {
  await page.evaluate(async change => {
    await window.__hpTest.setServerConfig(cfg => ({ ...cfg, markers: cfg.markers.map(m => m.id === 'd_temp' ? { ...m, ...change } : m) }));
  }, change); await settle();
};
const clicks = () => page.evaluate(() => window.__moreInfo1087.targets.slice());
try {
  await mkdir('demo/out/device-more-info-1087', { recursive: true });
  await page.evaluate(async () => {
    await window.__addRegistryEntity('climate.hp1087_floor', null, 'heat', 'mqtt', { device_id: 'd_temp', name: 'Floor thermostat' },
      { current_temperature: 24, temperature: 27, hvac_action: 'heating', hvac_modes: ['off', 'heat'] });
    await window.__addRegistryEntity('sensor.hp1087_aux', null, '23', 'mqtt', { device_id: 'd_temp', name: 'Floor temperature / Датчик пола — длинное имя для выбора сущности устройства' }, { device_class: 'temperature' });
    await window.__addRegistryEntity('sensor.hp1087_foreign', null, '21', 'mqtt', { device_id: 'd_light1', name: 'Foreign temperature' }, {});
    const card = window.__card;
    window.__moreInfo1087 = { targets: [], services: [] };
    card.addEventListener('hass-more-info', event => window.__moreInfo1087.targets.push(event.detail.entityId));
    const call = card.hass.callService.bind(card.hass);
    card.hass = { ...card.hass, callService: (...args) => { window.__moreInfo1087.services.push(args); return call(...args); } };
    await window.__hpTest.setServerConfig(cfg => ({ ...cfg, markers: [
      ...cfg.markers.filter(m => m.id !== 'd_temp'),
      { id: 'd_temp', binding: 'device:d_temp', icon: 'mdi:radiator', tap_action: 'more-info', display: 'value',
        value_source: { kind: 'entity_attribute', entity_id: 'climate.hp1087_floor', attribute: 'current_temperature' } },
    ] }));
    await window.__hpTest.setMode('view');
  }); await settle();
  await device().click(); await settle();
  out.autoOpensThermostat = (await clicks()).at(-1) === 'climate.hp1087_floor';
  const beforeRight = (await clicks()).length;
  await open();
  out.rightClickStillOpensSettings = await dialog.isVisible() && (await clicks()).length === beforeRight;
  out.startsClosedWithAuto = await target().getAttribute('aria-expanded') === 'false' && /Auto/.test(await target().textContent());
  const clean = await dialog.locator('[data-hp="dialog-confirm"]').isDisabled();
  await target().click(); await picker().locator('.hpf-panel input').fill('HP1087_AUX');
  out.searchIsInsideAndOwnOnly = await picker().locator('[role="option"]').count() === 2
    && await dialog.locator('input[data-field="marker-more-info-entity-filter"]').count() === 1
    && !/foreign/i.test(await picker().textContent());
  await picker().locator('.hpf-panel input').focus(); await page.keyboard.press('Escape'); await settle();
  out.escapeClosesOnlyPicker = await dialog.isVisible() && await target().getAttribute('aria-expanded') === 'false';
  out.searchDoesNotDirty = clean && await dialog.locator('[data-hp="dialog-confirm"]').isDisabled();
  await choose('sensor.hp1087_aux'); await save();
  out.manualSaved = await page.evaluate(() => window.__card._serverCfg.markers.find(m => m.id === 'd_temp').more_info_entity === 'sensor.hp1087_aux');
  await device().click(); await settle();
  out.manualTapExact = (await clicks()).at(-1) === 'sensor.hp1087_aux';
  await patch({ tap_action: 'info' });
  await device().click(); await settle();
  await root.locator('hp-dialog').getByRole('button', { name: 'Open in HA', exact: true }).click(); await settle();
  out.infoFooterUsesSameChoice = (await clicks()).at(-1) === 'sensor.hp1087_aux';
  await patch({ tap_action: 'more-info' });
  await open(); await choose('');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await root.locator('hp-confirm hp-dialog [data-hp="dialog-confirm"]').click(); await settle();
  out.cancelPreservesSelection = await page.evaluate(() => window.__card._serverCfg.markers.find(m => m.id === 'd_temp').more_info_entity === 'sensor.hp1087_aux');
  await open(); await settingsSection(dialog, 'basics');
  await dialog.locator('#marker-binding').click();
  await dialog.locator('#marker-show-entities').check();
  await dialog.locator('[data-field="marker-binding-filter"]').fill('climate.hp1087_floor');
  await dialog.locator('[role="option"][data-value="entity:climate.hp1087_floor"]').click();
  await settingsSection(dialog, 'actions'); await settle();
  out.bindingChangeResetsAuto = /Auto/.test(await target().textContent());
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await root.locator('hp-confirm hp-dialog [data-hp="dialog-confirm"]').click(); await settle();
  out.cancelBindingChangeKeepsBoth = await page.evaluate(() => {
    const marker = window.__card._serverCfg.markers.find(m => m.id === 'd_temp');
    return marker.binding === 'device:d_temp' && marker.more_info_entity === 'sensor.hp1087_aux';
  });
  for (const [width, language, dark] of [[1100, 'en', false], [1100, 'ru', true], [360, 'en', true], [360, 'ru', false]]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(({ language, dark }) => {
      const card = window.__card; card.setConfig({ ...card._config, language });
      card.hass = { ...card.hass, themes: { ...card.hass.themes, darkMode: dark } };
      const vars = dark ? { '--primary-text-color': '#e6e7eb', '--secondary-text-color': '#9aa4ad', '--card-background-color': '#202126', '--secondary-background-color': '#2b2d33', '--divider-color': '#3a3d45' }
        : { '--primary-text-color': '#202124', '--secondary-text-color': '#5f6368', '--card-background-color': '#ffffff', '--secondary-background-color': '#e7eaee', '--divider-color': '#d7d9de' };
      for (const [key, value] of Object.entries(vars)) card.style.setProperty(key, value);
    }, { language, dark }); await settle();
    await open(); await target().scrollIntoViewIfNeeded(); await target().click(); await settle();
    out[`layout${width}${language}`] = await picker().evaluate(node => {
      const panel = node.querySelector('.hpf-panel'), r = panel.getBoundingClientRect();
      const dialog = node.closest('hp-dialog'), surface = dialog.shadowRoot.querySelector('.surface').getBoundingClientRect();
      return r.width > 100 && r.left >= surface.left - 1 && r.right <= surface.right + 1
        && node.scrollWidth <= node.clientWidth + 1 && dialog.scrollWidth <= dialog.clientWidth + 1;
    });
    await dialog.locator('.surface').screenshot({ path: `demo/out/device-more-info-1087/${width}-${language}-${dark ? 'dark' : 'light'}.png` });
    await picker().locator('.hpf-panel input').focus(); await page.keyboard.press('Escape');
    await dialog.locator('[data-hp="dialog-cancel"]').last().click(); await dialog.waitFor({ state: 'detached' });
  }
  await page.evaluate(() => { const card = window.__card; card.setConfig({ ...card._config, language: 'en' }); });
  await patch({ more_info_entity: 'sensor.hp1087_foreign' });
  const count = (await clicks()).length; await device().click(); await settle();
  out.foreignRefusesNoFallback = (await clicks()).length === count && /Cannot open the selected entity/.test(await page.evaluate(() => window.__hpTest.toast()?.textContent || ''));
  await patch({ more_info_entity: 'sensor.hp1087_deleted' });
  await device().click(); await settle();
  out.deletedRefusesNoFallback = (await clicks()).length === count;
  await open(); await choose(''); await save();
  out.autoRemovesStoredOverride = await page.evaluate(() => !Object.hasOwn(window.__card._serverCfg.markers.find(m => m.id === 'd_temp'), 'more_info_entity'));
  await device().click(); await settle();
  out.autoRestored = (await clicks()).at(-1) === 'climate.hp1087_floor';
  out.noServices = await page.evaluate(() => window.__moreInfo1087.services.length === 0);
} finally {
  await writeFile('demo/out/device-more-info-1087/result.json', JSON.stringify(out, null, 2));
  checkAll(out); await finish(browser, out);
}
