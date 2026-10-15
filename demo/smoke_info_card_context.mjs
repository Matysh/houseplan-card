// #849 AC2: a real info-card confirmation may not cross HA authority, even
// when floor/marker/entity ids are identical. No action/private state seeding.
// Setup/fresh acceptance use actual mouse input; retained DOM .click() is an
// explicitly synthetic late-listener delivery, not claimed as a trusted click.
import { launchColdView, check, finish } from './serve.mjs';

const out = {};
for (const kind of ['connection', 'user']) for (const timing of ['accepted', 'immediate']) {
  const prefix = `${kind}/${timing}`;
  const { page, browser } = await launchColdView({ width: 1000, height: 850 });
  try {
    await page.evaluate(async () => {
      const card = window.__card;
      window.__849ContextCalls = { a: [], b: [] };
      card.hass = { ...card.hass, callService: (...args) => {
        window.__849ContextCalls.a.push(structuredClone(args)); return Promise.resolve();
      } };
      await window.__hpTest.setServerConfig(cfg => {
        cfg.markers = (cfg.markers || []).filter(marker => marker.id !== 'd_light1');
        cfg.markers.push({ id: 'd_light1', binding: 'device:d_light1', space: 'f1',
          tap_action: 'toggle', tap_confirm: true });
        return cfg;
      });
    });
    const info = page.locator('hp-dialog[data-kind="info"]');
    const row = () => info.locator('.entrow').filter({ hasText: 'Ceiling light' }).locator('button');
    const accept = () => page.locator('hp-dialog[data-kind="confirm"] [data-hp="dialog-confirm"]');
    const openInfo = async () => {
      await page.locator('[data-hp="device"][data-id="d_light1"]').hover();
      await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
      await info.waitFor();
    };
    await openInfo(); await row().click(); await accept().waitFor();
    await page.evaluate(() => {
      window.__849ContextRetainedAccept = window.__card.renderRoot
        .querySelector('hp-dialog[data-kind="confirm"] [data-hp="dialog-confirm"]');
    });
    await page.evaluate(async ({ kind, timing }) => {
      const { createFixtureStore } = await import('/fixture-state.js');
      const card = window.__card, original = card.hass;
      const config = structuredClone(card._serverCfg);
      config.spaces.find(space => space.id === 'f1').title = `Accepted foreign ${kind}`;
      const listeners = new Map();
      const server = createFixtureStore(config, card._layout, (event, rev) => {
        for (const callback of listeners.get(event) || []) callback({ event_type: event, data: { rev } });
      });
      const connection = kind === 'connection' ? {
        subscribeEvents: async (callback, event) => {
          if (!listeners.has(event)) listeners.set(event, new Set());
          listeners.get(event).add(callback);
          return () => listeners.get(event).delete(callback);
        }, subscribeMessage: async () => () => {},
      } : original.connection;
      window.__849ContextBReads = [];
      card.hass = { ...original, connection,
        user: kind === 'user' ? { ...original.user, id: `${original.user.id}-foreign` } : original.user,
        callWS: async message => {
          window.__849ContextBReads.push(message.type);
          if (message.type === 'config/device_registry/list') return Object.values(original.devices);
          if (message.type === 'config/entity_registry/list') return Object.values(original.entities);
          if (message.type === 'config_entries/get') return [{ entry_id: 'ce_demo', domain: 'demo', title: 'Synthetic Home' }];
          return server.handle(message) ?? { ok: true };
        },
        callService: (...args) => {
          window.__849ContextCalls.b.push(structuredClone(args)); return Promise.resolve();
        },
      };
      // The old DOM listener can still be delivered in the same HA frame,
      // before Lit has had a chance to clear the outgoing canonical surface.
      if (timing === 'immediate') window.__849ContextRetainedAccept.click();
      await window.__hpTest.settled();
      // A normal subsequent HA state frame, not a private requestUpdate shim.
      card.hass = { ...card.hass };
    }, { kind, timing });
    await page.waitForFunction(kind => {
      const card = window.__card;
      return card._loadOk && card._cfgRev === 1 && card._layoutRev === 1
        && card._serverCfg?.spaces?.find(space => space.id === 'f1')?.title === `Accepted foreign ${kind}`;
    }, kind);
    check(`${prefix}:foreignContextReallyAcceptedItsOwnPair`, await page.evaluate(() =>
      window.__849ContextBReads.includes('houseplan/config/get')
        && window.__849ContextBReads.includes('houseplan/layout/get')));
    await page.evaluate(() => window.__849ContextRetainedAccept.click());
    await page.evaluate(() => window.__hpTest.settled());
    const stale = await page.evaluate(() => structuredClone(window.__849ContextCalls));
    out[`${prefix}:stale`] = stale;
    check(`${prefix}:oldConfirmCallsNeitherAuthority`, stale, { a: [], b: [] });

    // Positive control: the new authority still permits its own deliberate act.
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    await openInfo(); await row().click(); await accept().click();
    await page.evaluate(() => window.__hpTest.settled());
    const current = await page.evaluate(() => structuredClone(window.__849ContextCalls));
    out[`${prefix}:current`] = current;
    check(`${prefix}:freshCurrentConfirmActsExactlyOnce`, current,
      { a: [], b: [['light', 'turn_off', { entity_id: 'light.ceiling' }]] });
  } finally { await browser.close(); }
}

// An explicitly selected controls entity remains the target when only its HA
// registry parent changes. That metadata is not a replacement of the entity id.
{
  const { page, browser } = await launchColdView({ width: 1000, height: 850 });
  try {
    await page.evaluate(async () => {
      const card = window.__card;
      window.__849ExternalCalls = [];
      card.hass = { ...card.hass,
        entities: { ...card.hass.entities, 'switch.external': {
          entity_id: 'switch.external', device_id: 'd_tv', platform: 'demo', disabled_by: null } },
        states: { ...card.hass.states, 'switch.external': { entity_id: 'switch.external', state: 'off',
          attributes: { friendly_name: 'External relay' } } },
        callService: (...args) => {
          window.__849ExternalCalls.push(structuredClone(args)); return Promise.resolve();
        },
      };
      await window.__hpTest.setServerConfig(cfg => {
        cfg.markers = (cfg.markers || []).filter(marker => marker.id !== 'd_light1');
        cfg.markers.push({ id: 'd_light1', binding: 'device:d_light1', space: 'f1',
          tap_action: 'toggle', tap_confirm: true, controls: ['switch.external'] });
        return cfg;
      });
    });
    await page.locator('[data-hp="device"][data-id="d_light1"]').hover();
    await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
    const row = page.locator('hp-dialog[data-kind="info"] .entrow')
      .filter({ hasText: 'External relay' }).locator('button');
    await row.click();
    const accept = page.locator('hp-dialog[data-kind="confirm"] [data-hp="dialog-confirm"]');
    await accept.waitFor();
    await page.evaluate(async () => {
      const card = window.__card;
      card.hass = { ...card.hass, entities: { ...card.hass.entities,
        'switch.external': { ...card.hass.entities['switch.external'], device_id: 'd_kettle' } } };
      await window.__hpTest.settled();
    });
    check('external:registryParentReallyChanged', await page.evaluate(() =>
      window.__card.hass.entities['switch.external'].device_id), 'd_kettle');
    check('external:explicitRowAndConfirmationRemainCurrent',
      await row.isVisible() && await accept.isVisible());
    await accept.click();
    await page.evaluate(() => window.__hpTest.settled());
    const calls = await page.evaluate(() => structuredClone(window.__849ExternalCalls));
    out.external = calls;
    check('external:parentMetadataCannotRedirectOrCancelExactEntity', calls,
      [['switch', 'turn_on', { entity_id: 'switch.external' }]]);
  } finally { await browser.close(); }
}
await finish(null, out);
