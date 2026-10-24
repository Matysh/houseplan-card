/** #1054: a foreign HA assigned off-DOM must not lose the full-card read intent. */
import { launchColdView, checkAll, finish, requirePinnedBrowser } from './serve.mjs';
import { installBatteryFixture } from './helpers/device-battery-fixture.mjs';

requirePinnedBrowser('detached authority');
const reports = {};
for (const scenario of ['short', 'long', 'same-object', 'ABA']) {
  const { page, browser } = await launchColdView({ width: 1200, height: 900 });
  try {
    await installBatteryFixture(page);
    reports[scenario] = await page.evaluate(async scenario => {
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
      const until = async test => {
        const end = performance.now() + 5000;
        while (!test() && performance.now() < end) await sleep(16);
        return !!test();
      };
      const card = window.__card, parent = card.parentElement, original = card.hass;
      const seed = structuredClone(card._serverCfg);
      const layout = await original.callWS({ type: 'houseplan/layout/get' });
      const attrs = { ...original.states['sensor.living_temp'].attributes };
      delete attrs.linkquality; delete attrs.lqi;
      const states = { ...original.states, 'sensor.living_temp': {
        ...original.states['sensor.living_temp'], attributes: attrs,
      } };
      const spaceHost = document.createElement('div');
      spaceHost.style.width = '600px'; document.body.append(spaceHost);
      const space = document.createElement('houseplan-space-card');
      space.setConfig({ type: 'custom:houseplan-space-card', space: 'f1', live_states: true, show_button: false });
      const signal = node => node.shadowRoot.querySelector('[data-hp="device"][data-id="d_temp"] .lqi')?.textContent.trim();
      const authority = (name, lqi) => {
        const config = structuredClone(seed);
        config.spaces = config.spaces.map(space => space.id === 'f1' ? { ...space, title: `Authority ${name}` } : space);
        const messages = { full: [], space: [] };
        const connection = { ...original.connection, subscribeMessage: async (callback, message) => {
          if (message.type !== 'houseplan/zigbee_lqi/subscribe') return original.connection.subscribeMessage(callback, message);
          callback({ kind: 'reset', session_id: name, revision: 0,
            devices: { d_temp: { lqi, available: true, provider: 'z2m', observed_at: 123, measurement_at: null } } });
          return () => {};
        } };
        const hass = role => ({ ...original, connection, states, user: { ...original.user, id: `user-${name}` },
          callWS: async message => {
            messages[role].push(structuredClone(message));
            if (message.type === 'houseplan/config/get') {
              // The actual backend projection contract: [] is FULL, not metadata.
              const selected = Array.isArray(message.fields) && message.fields.length
                ? Object.fromEntries(Object.entries(config).filter(([key]) => message.fields.includes(key))) : config;
              return { config: structuredClone(selected), rev: 1, can_write: false, zigbee_lqi_api: 1 };
            }
            if (message.type === 'houseplan/layout/get') return { ...structuredClone(layout), rev: 1 };
            return original.callWS(message);
          },
          callService: (...args) => { messages[role].push({ type: 'service', args }); return original.callService(...args); },
        });
        return { config, messages, hass };
      };
      const a = authority('A', 137), b = authority('B', 83);
      const initial = a.hass('full');
      card.hass = initial; space.hass = a.hass('space'); spaceHost.append(space);
      const out = { initialBothHostsLive: await until(() => signal(card) === '137' && signal(space) === '137') };
      const fullReads = owner => owner.messages.full.filter(message => message.type === 'houseplan/config/get'
        && !(message.fields?.length === 1 && message.fields[0] === 'model_version')).length;
      const layoutReads = owner => owner.messages.full.filter(message => message.type === 'houseplan/layout/get').length;
      const canonical = (node, owner) => (node === card ? card._serverCfg : space._snap?.config)
        ?.spaces?.find(space => space.id === 'f1')?.title === owner.config.spaces.find(space => space.id === 'f1')?.title;
      // Warm, same-context technical returns keep their accepted frame and make no full read.
      a.messages.full.length = 0;
      card.remove(); parent.append(card);
      await card.updateComplete;
      for (let i = 0; i < 6; i++) await new Promise(requestAnimationFrame);
      out.sameContextShortReturnDoesNotReload = fullReads(a) === 0 && layoutReads(a) === 0;
      card.remove();
      a.messages.full.length = 0;
      b.messages.full.length = 0;
      let target = b;
      if (scenario === 'ABA') {
        card.hass = b.hass('full'); card.hass = a.hass('full'); target = a;
      } else if (scenario === 'same-object') {
        Object.assign(initial, b.hass('full')); card.hass = initial;
      } else card.hass = b.hass('full');
      await card.updateComplete; await sleep(30);
      out.noFullReadWhileDetached = !card.isConnected && fullReads(target) === 0 && layoutReads(target) === 0;
      space.hass = target.hass('space'); await space.updateComplete;
      out.mountedSpaceControlHasCurrentAuthority = await until(() => canonical(space, target)
        && signal(space) === (target === a ? '137' : '83'));
      // Age only the existing placement tombstone, without changing the product TTL.
      const now = Date.now;
      try {
        if (scenario === 'long') Date.now = () => now() + 20_000;
        parent.append(card);
      } finally { Date.now = now; }
      out.fullAuthorityReturnsWithoutAnotherHassTick = await until(() => canonical(card, target)
        && card._loadOk && !card._read.busy);
      await card.updateComplete;
      out.oneCurrentMandatoryPair = fullReads(target) === 1 && layoutReads(target) === 1;
      out.currentPlanAndDeviceLayersReturn = card.renderRoot.querySelectorAll('.room').length === 4
        && !!card.renderRoot.querySelector('[data-hp="device"][data-id="d_temp"]');
      out.currentLiveSignalReturns = signal(card) === (target === a ? '137' : '83');
      out.oldWritePermissionDoesNotReturn = card._serverCanWrite === false;
      out.viewRecoveryDoesNotLoadEditor = !card._editorRuntime;
      out.noWritesOrRadioCommands = [...a.messages.full, ...a.messages.space, ...b.messages.full, ...b.messages.space]
        .every(message => !/\/(set|update|delete)$|zha\/devices|mqtt\/publish|^service$/.test(message.type));
      card.remove(); space.remove(); spaceHost.remove();
      return out;
    }, scenario);
    checkAll(Object.fromEntries(Object.entries(reports[scenario]).map(([key, value]) => [`${scenario}.${key}`, value])));
  } finally {
    await finish(browser);
  }
}
console.log(JSON.stringify(reports, null, 2));
