// #1089: native View menu, real writer and public HA/config inputs.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { launchColdView, check, finish, requirePinnedBrowser } from './serve.mjs';
import { installBatteryFixture, patchBatteryMarker } from './helpers/device-battery-fixture.mjs';
requirePinnedBrowser('smoke_view_device_menu');
const manifest = JSON.parse(readFileSync('dist/houseplan-assets.json'));
const editor = manifest.files.find(file => /houseplan-editor-runtime-[^/]+\.js$/.test(file.path)).path.split('/').at(-1);
const session = await launchColdView({ width: 1200, height: 900 }, 1, [], { hasTouch: true });
const { page, browser } = session, report = { fingerprint: manifest.fingerprint, pageErrors: [] };
page.on('pageerror', error => report.pageErrors.push(error.message));
const card = page.locator('houseplan-card'), menu = card.locator('[data-hp="device-context-menu"]:not([inert])');
const marker = (id = 'd_temp') => card.locator(`[data-hp="device"][data-id="${id}"]`);
const action = key => menu.locator(`[data-action="view-device-${key}"]`);
const settled = () => page.evaluate(() => window.__hpTest.settled());
const open = async (id = 'd_temp') => { await marker(id).locator('.device-core').click({ button: 'right' }); await menu.waitFor({ state: 'visible' }); await settled(); };
const writes = () => page.evaluate(() => ({ writes: structuredClone(window.__menuTest.writes), services: window.__menuTest.services.length, ha: [...window.__menuTest.ha] }));
try {
  await installBatteryFixture(page);
  await page.evaluate(() => {
    const c = window.__card, ws = c.hass.callWS, service = c.hass.callService;
    const state = window.__menuTest = { writer: true, rejectNext: false, writes: [], services: [], ha: [] };
    document.addEventListener('hass-more-info', event => state.ha.push(event.detail.entityId));
    c.hass = { ...c.hass, callWS: async message => {
      if (/\/(set|update|delete|copy|toggle)$/.test(message.type)) state.writes.push(structuredClone(message));
      if (message.type === 'houseplan/config/set' && state.rejectNext) {
        state.rejectNext = false; throw new Error('Deliberate View menu persistence refusal');
      }
      const reply = await ws(message);
      return message.type === 'houseplan/config/get' ? { ...reply, can_write: state.writer } : reply;
    }, callService: async (...args) => { state.services.push(args); return service(...args); } };
    window.__menuBase = { config: structuredClone(c._serverCfg), options: structuredClone(c._config) };
  });
  await open();
  check('five ordered commands', JSON.stringify(await menu.getByRole('menuitem').allTextContents()),
    JSON.stringify(['Device settings', 'HA more-info', 'Device card', 'Hide', 'Delete']));
  check('menu opens without settings, info, write or service', await page.evaluate(() => !window.__card._markerDialog && !window.__card._infoCard)
    && (await writes()).writes.length + (await writes()).services === 0);
  check('first menu has common styled frame', await menu.evaluate(node => getComputedStyle(node).display === 'grid'
    && getComputedStyle(node).fontSize === '12px' && getComputedStyle(node).position === 'fixed'));
  check('menu opening remains cold to editor', await page.evaluate(name => !window.__card._editorRuntime && !performance.getEntriesByType('resource').some(r => r.name.includes(name)), editor));
  await page.keyboard.press('Escape'); await menu.waitFor({ state: 'detached' });
  check('Escape restores marker focus', await marker().evaluate(node => node.getRootNode().activeElement === node));
  await open(); await action('ha').click(); await menu.waitFor({ state: 'detached' });
  check('HA entry exact own primary', (await writes()).ha.at(-1), 'sensor.living_temp');
  check('HA entry never substitutes local card or loads editor', await page.evaluate(() => !window.__card._infoCard && !window.__card._editorRuntime));
  await open(); await action('info').click(); await settled();
  check('local card exact target without service', await page.evaluate(() => window.__card._infoCard?.id), 'd_temp');
  check('information has no service or write', (await writes()).services + (await writes()).writes.length, 0);
  await page.keyboard.press('Escape'); await settled();
  await page.evaluate(async () => { window.__menuTest.writer = false; await window.__hpTest.setServerConfig(cfg => cfg); });
  await page.waitForFunction(() => !window.__card._canEdit);
  await open();
  check('read-only keeps all five with three disabled', JSON.stringify(await menu.getByRole('menuitem').evaluateAll(nodes => nodes.map(n => n.disabled))), JSON.stringify([true, false, false, true, true]));
  check('read-only reason is accessible', !!await action('settings').getAttribute('title'));
  await page.keyboard.press('Escape'); await settled();
  await page.evaluate(async () => { window.__menuTest.writer = true; await window.__hpTest.setServerConfig(cfg => cfg); });
  await page.waitForFunction(() => window.__card._canEdit);
  await open(); await action('settings').click();
  const dialog = card.locator('hp-dialog[data-kind="marker"]'); await dialog.waitFor({ state: 'visible' });
  check('settings remains View and exact target', await page.evaluate(() => window.__card._mode === 'view' && window.__card._markerDialog.devId === 'd_temp'));
  await dialog.locator('#marker-name').fill('Menu saved name');
  await dialog.locator('[data-hp="dialog-confirm"]').click(); await dialog.waitFor({ state: 'detached' });
  await page.evaluate(() => window.__hpTest.waitForWrites());
  check('settings real save durable', await page.evaluate(async () => (await window.__card.hass.callWS({ type: 'houseplan/config/get' })).config.markers.find(m => m.id === 'd_temp').name), 'Menu saved name');
  await open(); await action('delete').click();
  const confirm = card.locator('hp-dialog[data-kind="confirm"]'); await confirm.waitFor({ state: 'visible' });
  const beforeDelete = (await writes()).writes.length;
  await page.keyboard.press('Escape'); await confirm.waitFor({ state: 'detached' });
  check('cancel Delete writes nothing', (await writes()).writes.length, beforeDelete);
  await page.evaluate(() => { window.__menuTest.rejectNext = true; });
  await open(); await action('visibility').click();
  const refusal = await page.evaluate(() => window.__hpTest.waitForWrites().then(() => null, error => error.message));
  check('refused Hide observes the actual rejected writer', refusal, 'Deliberate View menu persistence refusal');
  await settled();
  check('refused Hide rolls back the visible marker and saved flag', await page.evaluate(async () => {
    const cfg = (await window.__card.hass.callWS({ type: 'houseplan/config/get' })).config;
    return !window.__menuTest.rejectNext && !cfg.markers.find(m => m.id === 'd_temp').hidden
      && !!window.__card.renderRoot.querySelector('[data-hp="device"][data-id="d_temp"]');
  }));
  await open(); await action('visibility').click(); await settled(); await page.evaluate(() => window.__hpTest.waitForWrites());
  check('Hide stores only selected marker', await page.evaluate(async () => {
    const cfg = (await window.__card.hass.callWS({ type: 'houseplan/config/get' })).config;
    return cfg.markers.find(m => m.id === 'd_temp').hidden === true && !cfg.markers.find(m => m.id === 'd_light1').hidden;
  }));
  await card.locator('[data-hp="hidden-devices"]').click(); await settled();
  await open(); check('hidden eye uses Show on plan label', await action('visibility').textContent(), 'Show on plan');
  await action('visibility').click(); await page.evaluate(() => window.__hpTest.waitForWrites()); await settled();
  check('Show updates stored flag without switching eye', await page.evaluate(async () => {
    const cfg = (await window.__card.hass.callWS({ type: 'houseplan/config/get' })).config;
    return !cfg.markers.find(m => m.id === 'd_temp').hidden
      && window.__card.renderRoot.querySelector('[data-hp="hidden-devices"]').getAttribute('aria-pressed') === 'true';
  }));
  await open();
  await page.evaluate(async () => { const c = window.__card; c.hass = { ...c.hass, states: { ...c.hass.states,
    'sensor.living_temp': { ...c.hass.states['sensor.living_temp'], state: '24' } } }; await window.__hpTest.settled(); });
  check('ordinary state tick keeps menu and current target', await menu.count(), 1);
  await page.setViewportSize({ width: 1100, height: 800 }); await settled();
  check('viewport resize repositions the common menu without retiring it', await menu.count(), 1);
  await page.keyboard.press('Escape'); await settled();
  await marker().focus(); await page.keyboard.press('Shift+F10'); await menu.waitFor({ state: 'visible' });
  check('keyboard anchor lies at marker rather than screen origin', await menu.evaluate(node => {
    const r = node.getBoundingClientRect(); return r.left > 8 && r.top > 8;
  }));
  await page.keyboard.press('Escape'); await settled();
  await open(); await action('delete').click(); await confirm.waitFor({ state: 'visible' });
  await confirm.locator('[data-hp="dialog-confirm"]').click(); await confirm.waitFor({ state: 'detached' });
  await page.evaluate(() => window.__hpTest.waitForWrites()); await settled();
  check('confirmed Delete persists plan tombstone and leaves HA registry', await page.evaluate(async () => {
    const c = window.__card, cfg = (await c.hass.callWS({ type: 'houseplan/config/get' })).config;
    return cfg.markers.some(m => m.binding === 'device:d_temp' && m.removed) && !!c.hass.devices.d_temp
      && !cfg.markers.find(m => m.id === 'd_light1').removed;
  }));
  check('all menu commands service-free', (await writes()).services, 0);
  check('no browser exceptions', report.pageErrors.length, 0);
  report.receipt = await writes();
} catch (error) { report.error = error.stack || String(error); check('all menu scenarios completed', false); }
finally { mkdirSync('artifacts/1089', { recursive: true }); writeFileSync('artifacts/1089/menu.json', JSON.stringify(report, null, 2) + '\n'); await finish(browser, report); }
