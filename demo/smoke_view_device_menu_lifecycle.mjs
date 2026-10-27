// #1089: native commands across held module delivery and changing authority.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { launchColdView, check, finish, requirePinnedBrowser } from './serve.mjs';
import { installBatteryFixture, patchBatteryMarker } from './helpers/device-battery-fixture.mjs';
requirePinnedBrowser('smoke_view_device_menu_lifecycle');
const manifest = JSON.parse(readFileSync('dist/houseplan-assets.json'));
const chunk = manifest.files.find(f => /view-device-menu-[^/]+\.js$/.test(f.path)).path.split('/').at(-1);
const report = { fingerprint: manifest.fingerprint, cases: [], errors: [] };
const onlyRetry = process.argv.includes('--only=retry');
const marker = (page, id = 'd_temp') => page.locator(`[data-hp="device"][data-id="${id}"] .device-core`);
const menu = page => page.locator('[data-hp="device-context-menu"]:not([inert])');
const settled = page => page.evaluate(() => window.__hpTest.settled());
async function setup() {
  const session = await launchColdView({ width: 1200, height: 900 });
  const { page } = session;
  page.on('pageerror', error => report.errors.push(error.message));
  await installBatteryFixture(page);
  await page.evaluate(() => {
    const c = window.__card, ws = c.hass.callWS, service = c.hass.callService;
    window.__menuLife = { writes: [], services: [], writer: true };
    c.hass = { ...c.hass, callWS: async message => {
      if (/\/(set|update|delete|copy|toggle)$/.test(message.type)) window.__menuLife.writes.push(structuredClone(message));
      const reply = await ws(message);
      return message.type === 'houseplan/config/get' ? { ...reply, can_write: window.__menuLife.writer } : reply;
    }, callService: async (...args) => { window.__menuLife.services.push(args); return service(...args); } };
  });
  return session;
}
async function open(page, id = 'd_temp') {
  await marker(page, id).click({ button: 'right' }); await menu(page).waitFor({ state: 'visible' });
}
async function retire(page, kind) {
  if (kind === 'permission') await page.evaluate(async () => {
    window.__menuLife.writer = false; await window.__hpTest.setServerConfig(cfg => cfg);
  });
  else if (kind === 'space') await page.evaluate(() => window.__hpTest.switchSpace('garden'));
  else if (kind === 'hidden') await patchBatteryMarker(page, { hidden: true });
  else if (kind === 'rebind') await patchBatteryMarker(page, { binding: 'entity:sensor.living_temp' });
  else if (kind === 'detach') await page.evaluate(() => window.__card.remove());
  else if (kind === 'newest') await marker(page, 'd_light1').click({ button: 'right' });
  else if (kind === 'blur' || kind === 'pagehide') await page.evaluate(kind => window.dispatchEvent(new Event(kind)), kind);
  else if (kind === 'user' || kind === 'connection') await page.evaluate(kind => {
    const c = window.__card, original = c.hass;
    c.hass = { ...original, user: kind === 'user' ? { ...original.user, id: 'new-menu-user' } : original.user,
      connection: kind === 'connection' ? { ...original.connection } : original.connection };
  }, kind);
  await settled(page);
}
try {
  for (const kind of onlyRetry ? [] : ['permission', 'space', 'hidden', 'rebind', 'detach', 'newest', 'blur', 'pagehide', 'user', 'connection']) {
    const { page, browser } = await setup(); let release;
    const hold = new Promise(resolve => { release = resolve; });
    await page.route(`**/${chunk}*`, async route => { await hold; await route.fallback(); });
    try {
      const requested = page.waitForRequest(request => new URL(request.url()).pathname.endsWith(`/${chunk}`));
      await marker(page).click({ button: 'right' }); await requested;
      check(`held/${kind}:no premature menu`, await menu(page).count(), 0);
      await retire(page, kind);
      const before = await page.evaluate(() => window.__menuLife.writes.length);
      release();
      await page.waitForResponse(response => new URL(response.url()).pathname.endsWith(`/${chunk}`));
      await settled(page);
      if (kind === 'newest') {
        await menu(page).waitFor({ state: 'visible' });
        await menu(page).locator('[data-action="view-device-info"]').click(); await settled(page);
        check('held/newest:only current target', await page.evaluate(() => window.__card._infoCard?.id), 'd_light1');
      } else check(`held/${kind}:retired menu absent`, await menu(page).count(), 0);
      check(`held/${kind}:no late write or service`, await page.evaluate(n => window.__menuLife.writes.length === n
        && window.__menuLife.services.length === 0, before));
      report.cases.push(`held/${kind}`);
    } finally { release(); await browser.close(); }
  }
  for (const kind of onlyRetry ? [] : ['permission', 'rebind', 'hidden', 'user', 'space']) {
    const { page, browser } = await setup();
    try {
      await open(page); await menu(page).locator('[data-action="view-device-delete"]').click();
      const dialog = page.locator('hp-dialog[data-kind="confirm"]'); await dialog.waitFor({ state: 'visible' });
      await retire(page, kind); await page.evaluate(() => window.__hpTest.waitForWrites());
      const before = await page.evaluate(() => window.__menuLife.writes.length);
      if (await dialog.count()) await dialog.locator('[data-hp="dialog-confirm"]').click();
      await settled(page); await page.evaluate(() => window.__hpTest.waitForWrites());
      check(`confirm/${kind}:stale delete has no write`, await page.evaluate(n => window.__menuLife.writes.length === n, before));
      check(`confirm/${kind}:HA registry preserved`, await page.evaluate(() => !!window.__card.hass.devices.d_temp));
      report.cases.push(`confirm/${kind}`);
    } finally { await browser.close(); }
  }
  if (!onlyRetry) {
    const { page, browser } = await setup();
    try {
      await patchBatteryMarker(page, { tap_action: 'info' }); await open(page);
      await marker(page, 'd_light1').click(); await settled(page);
      check('outside close consumes compatibility click', await menu(page).count() === 0
        && await page.evaluate(() => !window.__card._infoCard));
      await marker(page, 'd_light1').click(); await settled(page);
      check('fresh pointer immediately works', await page.evaluate(() => window.__card._infoCard?.id), 'd_light1');
      await page.keyboard.press('Escape'); await settled(page);
      const foreign = await page.evaluate(() => Object.values(window.__card.hass.entities)
        .find(entity => entity.device_id === 'd_light1' && window.__card.hass.states[entity.entity_id])?.entity_id);
      check('strict HA fixture has a readable foreign entity', !!foreign);
      for (const target of [foreign, 'sensor.absent']) {
        await patchBatteryMarker(page, { more_info_entity: target }); await open(page);
        check(`strict HA/${target}:disabled`, await menu(page).locator('[data-action="view-device-ha"]').isDisabled());
        check(`strict HA/${target}:local card remains available`, await menu(page).locator('[data-action="view-device-info"]').isEnabled());
        await page.keyboard.press('Escape');
      }
      check('outside and invalid HA are write/service free', await page.evaluate(() => window.__menuLife.writes.length + window.__menuLife.services.length), 0);
      report.cases.push('outside-tail', 'strict-HA-negative');
    } finally { await browser.close(); }
  }
  {
    const { page, browser } = await setup(); let attempts = 0;
    await page.route(`**/${chunk}*`, route => ++attempts === 1 ? route.abort('failed') : route.fallback());
    try {
      await marker(page).click({ button: 'right' });
      const notice = page.locator('[data-hp="view-runtime-notice"]'); await notice.waitFor({ state: 'visible' });
      check('failed menu fetch exposes recoverable notice', (await notice.textContent()).includes('Device menu'));
      await notice.locator('[data-hp="view-runtime-retry"]').click(); await notice.waitFor({ state: 'detached' });
      check('retry does not revive old action', await menu(page).count(), 0);
      await open(page); check('fresh input works after real fetch retry', attempts, 2);
      report.cases.push('real-import-failure-retry');
    } finally { await browser.close(); }
  }
  check('no browser exceptions', report.errors.length, 0);
} catch (error) { report.error = error.stack || String(error); check('lifecycle scenarios completed', false); }
finally { mkdirSync('artifacts/1089', { recursive: true }); writeFileSync(`artifacts/1089/lifecycle${onlyRetry ? '-retry' : ''}.json`, JSON.stringify(report, null, 2) + '\n'); await finish(null, report); }
