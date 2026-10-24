/** #1053: actual full/space Lit hosts, public detach/HA assignment/reconnect. */
import { launch, checkAll, finish, requirePinnedBrowser } from './serve.mjs';
import { installBatteryFixture } from './helpers/device-battery-fixture.mjs';

requirePinnedBrowser();
const { page, browser } = await launch({ width: 1200, height: 900 });
let out;
try {
  await installBatteryFixture(page);
  out = await page.evaluate(async () => {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const until = async test => {
      const end = performance.now() + 5000;
      while (!test() && performance.now() < end) await sleep(16);
      return !!test();
    };
    const card = window.__card, parent = card.parentElement, original = card.hass;
    // Each isolated HA connection serves this accepted document, independently
    // of the demo card's retired authority during a replacement.
    const seed = structuredClone(card._serverCfg);
    const attributes = { ...original.states['sensor.living_temp'].attributes };
    delete attributes.linkquality; delete attributes.lqi;
    const states = { ...original.states, 'sensor.living_temp': { ...original.states['sensor.living_temp'], attributes } };
    const hosts = document.createElement('div'); hosts.style.width = '600px'; document.body.append(hosts);
    const space = document.createElement('houseplan-space-card');
    space.setConfig({ type: 'custom:houseplan-space-card', space: 'f1', live_states: true, show_button: false });
    const line = node => node.shadowRoot.querySelector('[data-hp="device"][data-id="d_temp"] .lqi')?.textContent.trim();
    const metadata = message => message.type === 'houseplan/config/get' && Array.isArray(message.fields)
      && message.fields.length === 1 && message.fields[0] === 'model_version';
    const authority = (name, initial) => {
      const transport = { messages: [], callbacks: [], subscriptions: 0, releases: 0, revision: 0 };
      const emit = (callback, lqi) => callback({ kind: 'reset', session_id: name, revision: transport.revision,
        devices: { d_temp: { lqi, available: true, provider: 'z2m', observed_at: 123, measurement_at: null } } });
      transport.send = lqi => { transport.revision++; transport.callbacks.forEach(callback => emit(callback, lqi)); };
      const connection = { ...original.connection, subscribeMessage: async (callback, message) => {
        if (message.type !== 'houseplan/zigbee_lqi/subscribe') return original.connection.subscribeMessage(callback, message);
        transport.subscriptions++; transport.callbacks.push(callback); emit(callback, initial);
        return () => { transport.releases++; };
      } };
      transport.hass = { ...original, connection, states, callWS: async message => {
        transport.messages.push(structuredClone(message));
        const response = await original.callWS(message);
        if (metadata(message)) return { ...response, config: Object.fromEntries(Object.entries(seed)
          .filter(([key]) => key === 'model_version')), zigbee_lqi_api: 1 };
        return message.type === 'houseplan/config/get'
          ? { ...response, config: structuredClone(seed), zigbee_lqi_api: 1 } : response;
      } };
      return transport;
    };
    const a = authority('attached', 137), b = authority('reconnected', 0);
    card.hass = a.hass; space.hass = a.hass; hosts.append(space);
    const result = { fullAndSpaceReceiveLiveFeed: await until(() => line(card) === '137' && line(space) === '137') };
    result.mountedHostsShareOneFeed = a.subscriptions === 1;
    result.metadataOnlyCapabilityRead = a.messages.filter(metadata).length === 1;

    card.remove();
    a.send(180);
    result.mountedSpaceKeepsSharedFeed = await until(() => line(space) === '180')
      && a.subscriptions === 1 && a.releases === 0;
    parent.append(card); a.send(0);
    result.returningHostRejoinsMountedNeighbour = await until(() => line(card) === '0' && line(space) === '0')
      && a.subscriptions === 1;
    card.remove(); space.remove();
    result.lastConsumerReleasesFeed = a.releases === 1;

    parent.append(card); hosts.append(space);
    await until(() => a.subscriptions === 2);
    a.send(0);
    result.sameElementsReconnectWithoutHassTick = await until(() => line(card) === '0' && line(space) === '0');
    result.reconnectAcquiresOneSharedSession = a.subscriptions === 2
      && a.messages.filter(metadata).length === 2;
    a.callbacks[0]({ kind: 'reset', session_id: 'attached', revision: 100,
      devices: { d_temp: { lqi: 255, available: true, provider: 'z2m', observed_at: 123, measurement_at: null } } });
    await card.updateComplete; await space.updateComplete; await sleep(30);
    result.retiredCallbacksCannotReplaceReconnectedReading = line(card) === '0' && line(space) === '0';
    a.send(200);
    result.reconnectedFeedContinuesUpdating = await until(() => line(card) === '200' && line(space) === '200');
    card.remove(); space.remove();
    result.finalDetachReleasesReconnectedSession = a.releases === 2;
    // A separate boundary: a new HA authority arrives only AFTER both detach.
    // Its plan recovery is tracked separately in #1054; it must not be
    // confused with the same-context live-feed proof.
    card.hass = b.hass; await card.updateComplete; await sleep(30);
    result.fullDetachedDoesNotReadOrSubscribe = !card.isConnected
      && !b.messages.some(message => /houseplan\/(config|layout)\/get/.test(message.type)) && b.subscriptions === 0;
    space.hass = b.hass; await space.updateComplete; await sleep(30);
    result.spaceDetachedDoesNotReadOrSubscribe = !space.isConnected
      && !b.messages.some(message => /houseplan\/(config|layout)\/get/.test(message.type)) && b.subscriptions === 0;
    result.noWritesOrRadioCommands = [...a.messages, ...b.messages].every(message =>
      !/\/(set|update|delete)$|zha\/devices|mqtt\/publish/.test(message.type));
    hosts.remove(); return result;
  });
  checkAll(out);
} finally { await finish(browser, out); }
