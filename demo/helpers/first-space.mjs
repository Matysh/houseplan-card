/** Synthetic HA transport; every interaction uses the real card and native DOM. */
import { assertFreshDemoBundle } from '../bundle-freshness.mjs';
export async function mountFirstSpace(page, options = {}) {
  await page.evaluate(async options => {
    const fixture = { config: { model_version: 10, spaces: [], markers: [], settings: {} }, calls: [] };
    const hass = window.__mkHass(), original = hass.callWS;
    hass.user = { id: 'first-space', name: 'First space', is_admin: options.admin !== false };
    hass.language = options.language || 'en'; hass.locale = { language: hass.language };
    hass.floors = options.floors === false ? {} : {
      ground: { floor_id: 'ground', name: 'Ground floor', level: 0 },
      upper: { floor_id: 'upper', name: 'Second floor with a longer name', level: 1 },
    };
    hass.areas = {};
    hass.callWS = async message => {
      fixture.calls.push(structuredClone(message));
      if (message.type === 'houseplan/config/get') {
        if (options.storage === false) throw new Error('Integration unavailable');
        return { config: structuredClone(fixture.config), rev: 1, can_write: options.writer !== false };
      }
      if (message.type === 'houseplan/layout/get') return { layout: {}, rev: 1 };
      return original(message);
    };
    await import('/assets/houseplan-card.js');
    const card = document.createElement('houseplan-card');
    card.setConfig({ type: 'custom:houseplan-card', kiosk: !!options.kiosk }); card.hass = hass;
    const host = document.querySelector('#host'); host.style.cssText = 'width:100%;padding:0;margin:0';
    host.replaceChildren(card);
    window.__card = card; window.firstSpaceFixture = fixture;
  }, options);
  await assertFreshDemoBundle(page);
  if (options.waitHint !== false) await page.locator('[data-hp=empty] hp-plan-converter-info a').waitFor();
}
