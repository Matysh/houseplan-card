import assert from 'node:assert/strict';
import { launchPanelCold, checkAll, finish } from './serve.mjs';
import { makeLargeHouseFixture } from './fixtures/large-house.mjs';

const out = {};
for (const projection of ['flat', 'iso']) for (const surface of ['panel', 'card', 'external']) {
    const key = `${surface}/${projection}`;
    const { page, browser } = await launchPanelCold({ width: 1280, height: 900 });
    try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.install();
    const fixture = makeLargeHouseFixture({ floors: 2, roomsPerFloor: 1, devices: 4, openings: 1,
      partitions: 0, columns: 0, stairs: 0, decor: 0 });
    await page.evaluate(async ({ fixture, projection, surface }) => {
      const host = document.getElementById('host');
      host.replaceChildren();
      const config = fixture.config;
      config.settings = { ...config.settings, volumetric_view: projection === 'iso',
        external_screens: { version: 1, next_id: 2, screens: [{ id: 1, space: null, rotation: 0,
          cycle: 0, idle: 0, summary: 'local', hidden_devices: 'local', icon_scale: null, font_scale: null }] } };
      const hass = window.__mkHass();
      const call = hass.callWS;
      const wire = { ...hass, user: { id: 'floor-deadline-test', is_admin: false }, states: fixture.states,
        callWS: async message => {
          if (message.type === 'houseplan/config/get') return {config: structuredClone(config), rev: 1, can_write: false};
          if (message.type === 'houseplan/layout/get') return {layout: structuredClone(fixture.layout), rev: 1};
          return call(message);
        } };
      history.replaceState(null, '', surface === 'external' ? '/houseplan?hpprofile=1' : '/houseplan');
      await import('/assets/houseplan-panel.js');
      await customElements.whenDefined('houseplan-panel');
      if (surface === 'card') {
        const card = document.createElement('houseplan-card');
        await customElements.whenDefined('houseplan-card');
        card.setConfig({ type: 'custom:houseplan-card' }); card.hass = wire;
        host.append(card); window.__deadlineCard = () => card;
      } else {
        const panel = document.createElement('houseplan-panel');
        panel.panel = { component_name: 'houseplan-panel' }; panel.narrow = false;
        panel.route = { prefix: '/houseplan', path: '' }; panel.hass = wire;
        host.append(panel); window.__deadlineCard = () => panel.shadowRoot?.querySelector('houseplan-card');
      }
    }, {fixture, projection, surface});
    await page.waitForFunction(({ projection, surface }) => {
      const c = window.__deadlineCard();
      return c?._loadOk && !c._booting && !c._bootFading && c._renderProjection === projection
        && c._kiosk === (surface === 'external') && c.renderRoot.querySelector('.stage .dev')
        && !c.renderRoot.querySelector('[data-hp-floor-cache]');
    }, {projection, surface});
    await page.evaluate(() => {
      const card = window.__deadlineCard(), runtime = card._floorPreparation, scheduler = runtime.scheduler;
      runtime.invalidate(); runtime.memory.clear(); scheduler.stopWorker();
      const healthy = scheduler.factory;
      scheduler.factory = () => ({ postMessage() {}, terminate() {} });
      scheduler.loadFallback = () => new Promise(resolve => { window.__finishRetiredFallback = () => resolve({
        computeFloorJob() { throw Error('retired fallback executed'); },
      }); });
      window.__enableHealthyFloorWorker = () => { scheduler.factory = healthy; };
      card.requestUpdate();
    });
    await page.waitForFunction(() => {
      const c = window.__deadlineCard();
      return c._floorHolding && c.renderRoot.querySelector('.stage[inert] .dev') && c.renderRoot.querySelector('.editorloading');
    });
    await page.clock.fastForward(15_000);
    await page.waitForFunction(() => window.__deadlineCard()._floorPreparation.supportFacts.active === 'fallback-load');
    await page.clock.fastForward(3_000);
    const error = page.locator('.floor-preparation-error');
    await error.waitFor({state:'visible'});
    assert.equal(await page.evaluate(() => {
      const c = window.__deadlineCard(), root = c.renderRoot, runtime = c._floorPreparation;
      return root.querySelector('ha-card')?.dataset.hpState === 'error'
        && !root.querySelector('.dev,.editorloading') && !root.querySelector('.stage')?.inert
        && !runtime.pending && runtime.supportFacts.last_stage === 'fallback-load'
        && runtime.supportFacts.last_result === 'timeout';
    }), true, `${key}: terminal error cannot be interactive/ready`);
    await page.evaluate(() => {
      window.__finishRetiredFallback(); window.__enableHealthyFloorWorker();
    });
    await error.getByRole('button', {name:'Try again'}).click();
    await page.waitForFunction(projection => {
      const c = window.__deadlineCard(), root = c.renderRoot;
      return c._renderProjection === projection && !!root.querySelector('.stage:not([inert]) .dev')
        && !root.querySelector('[data-hp-floor-cache],.editorloading');
    }, projection);
    out[`${key}: retained frame inert, deadline error, real-worker retry`] = true;
    checkAll(out);
    } catch (error) {
      checkAll({ [key]: false });
      throw error;
    } finally { await finish(browser, out); }
}
