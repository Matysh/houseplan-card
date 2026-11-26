/** Synthetic HA transport; every interaction uses the real card and native DOM. */
import { assertFreshDemoBundle } from '../bundle-freshness.mjs';
export async function mountFirstSpace(page, options = {}) {
  await page.evaluate(async options => {
    const key = 'houseplan-first-space-fixture';
    const saved = options.persistConfig ? JSON.parse(sessionStorage.getItem(key)) : null;
    const fixture = {
      config: saved?.config ?? { model_version: 10, spaces: [], markers: [], settings: {} },
      rev: saved?.rev ?? 1, calls: [],
    };
    const hass = window.__mkHass(), original = hass.callWS;
    hass.user = { id: 'first-space', name: 'First space', is_admin: options.admin !== false };
    hass.language = options.language || 'en'; hass.locale = { language: hass.language };
    hass.floors = options.floors === false ? {} : {
      ground: { floor_id: 'ground', name: 'Ground floor', level: 0 },
      ...(!options.singleFloor && {
        upper: { floor_id: 'upper', name: 'Second floor with a longer name', level: 1 },
      }),
    };
    hass.areas = {};
    hass.callWS = async message => {
      fixture.calls.push(structuredClone(message));
      if (message.type === 'houseplan/config/get') {
        if (options.storage === false) throw new Error('Integration unavailable');
        return { config: structuredClone(fixture.config), rev: fixture.rev, can_write: options.writer !== false };
      }
      if (options.persistConfig && message.type === 'houseplan/config/set') {
        if (fixture.holdNextWrite) {
          fixture.holdNextWrite = false;
          await new Promise(resolve => { fixture.releaseWrite = resolve; });
          delete fixture.releaseWrite;
        }
        if (message.expected_rev !== fixture.rev) throw Object.assign(new Error('Revision conflict'), { code: 'conflict' });
        fixture.config = structuredClone(message.config);
        fixture.rev++;
        sessionStorage.setItem(key, JSON.stringify({ config: fixture.config, rev: fixture.rev }));
        return { rev: fixture.rev };
      }
      if (message.type === 'houseplan/layout/get') return { layout: {}, rev: 1 };
      return original(message);
    };
    if (options.transport === false) delete hass.callWS;
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
