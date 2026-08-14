// #107: persistent manual virtual light, shared by two full cards and one static card.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1200, height: 900 });
const result = await page.evaluate(async () => {
  const first = window.__card;
  const markerId = 'smoke_manual_virtual_light';
  const space = first._model[0];
  const room = space.rooms.find((candidate) => candidate.id && candidate.area);
  const serverConfig = structuredClone(first._serverCfg);
  serverConfig.markers = [...(serverConfig.markers || []), {
    id: markerId,
    name: 'Manual virtual lamp',
    binding: 'virtual',
    is_light: true,
    tap_action: 'toggle',
    tap_confirm: false,
    controls: ['light.ceiling'],
    space: space.id,
    area: room.area,
    room_id: room.id,
  }];
  const serverLayout = {
    ...first._layout,
    [markerId]: { s: space.id, x: 0.32, y: 0.32 },
  };
  const virtual = { rev: 0, config_rev: first._cfgRev, off: [] };
  const subscriptions = new Map();
  const serviceCalls = [];
  let toggleCalls = 0;
  const emit = (event, data) => {
    for (const listener of subscriptions.get(event) || []) listener({ data });
  };
  const baseHass = first.hass;
  const baseCallWS = baseHass.callWS.bind(baseHass);
  const connection = {
    ...baseHass.connection,
    addEventListener: baseHass.connection?.addEventListener?.bind(baseHass.connection),
    removeEventListener: baseHass.connection?.removeEventListener?.bind(baseHass.connection),
    subscribeMessage: baseHass.connection?.subscribeMessage?.bind(baseHass.connection),
    subscribeEvents: async (callback, event) => {
      const listeners = subscriptions.get(event) || new Set();
      listeners.add(callback);
      subscriptions.set(event, listeners);
      return () => listeners.delete(callback);
    },
  };
  const hass = {
    ...baseHass,
    connection,
    callService: async (domain, service, data) => {
      serviceCalls.push({ domain, service, data });
    },
    callWS: async (message) => {
      if (message.type === 'houseplan/config/get') return {
        config: serverConfig,
        rev: virtual.config_rev,
        can_write: true,
        virtual_lights: structuredClone(virtual),
      };
      if (message.type === 'houseplan/layout/get') return {
        layout: serverLayout,
        rev: first._layoutRev,
      };
      if (message.type === 'houseplan/virtual_light/toggle') {
        toggleCalls++;
        const off = new Set(virtual.off);
        if (off.has(message.marker_id)) off.delete(message.marker_id);
        else off.add(message.marker_id);
        virtual.off = [...off].sort();
        virtual.rev++;
        const reply = {
          marker_id: message.marker_id,
          on: !off.has(message.marker_id),
          rev: virtual.rev,
        };
        queueMicrotask(() => emit('houseplan_virtual_light_updated', reply));
        return reply;
      }
      return baseCallWS(message);
    },
  };

  // Reconnect the already mounted card to the fake server authority.
  first._unsubVirtual?.();
  first._unsubVirtual = null;
  first.hass = hass;
  await first._reloadConfigOnly(true);
  first._layout = serverLayout;
  first._regSignature = '';
  first._maybeRebuildDevices();
  first._ensureLiveSyncSubscriptions();
  await first.updateComplete;

  const second = document.createElement('houseplan-card');
  second.setConfig({ type: 'custom:houseplan-card', icon_size: 3.4 });
  document.body.append(second);
  second.hass = hass;

  const staticCard = document.createElement('houseplan-space-card');
  staticCard.setConfig({ type: 'custom:houseplan-space-card', space: space.id });
  document.body.append(staticCard);
  staticCard.hass = hass;

  const waitFor = async (predicate, timeout = 6000) => {
    const started = Date.now();
    while (!predicate() && Date.now() - started < timeout) {
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    return !!predicate();
  };
  await waitFor(() => second._devices?.some((device) => device.id === markerId));
  await waitFor(() => staticCard.renderRoot?.querySelector(`[data-id="${markerId}"]`));
  await second.updateComplete;
  await staticCard.updateComplete;

  const deviceOf = (card) => card._devices.find((device) => device.id === markerId);
  const on = (card) => card._stateClass(deviceOf(card)).includes('on');
  const staticOn = () => staticCard.renderRoot
    .querySelector(`[data-id="${markerId}"]`)?.classList.contains('on');
  const initialEverywhereOn = on(first) && on(second) && staticOn();

  const markerNode = first.renderRoot.querySelector(`.dev[data-id="${markerId}"]`);
  markerNode.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  await waitFor(() => virtual.rev === 1 && !on(second) && staticOn() === false);
  await first.updateComplete;
  const clickEverywhereOff = !on(first) && !on(second) && staticOn() === false;

  // A second real click returns to on; the saved outgoing control never calls HA.
  markerNode.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  await waitFor(() => virtual.rev === 2 && on(second) && staticOn() === true);
  const secondClickEverywhereOn = on(first) && on(second) && staticOn();

  const beforeTouch = toggleCalls;
  markerNode.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, composed: true, pointerType: 'touch', pointerId: 41,
    clientX: 100, clientY: 100,
  }));
  markerNode.dispatchEvent(new PointerEvent('pointerup', {
    bubbles: true, composed: true, pointerType: 'touch', pointerId: 41,
    clientX: 100, clientY: 100,
  }));
  markerNode.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  await waitFor(() => virtual.rev === 3 && !on(second) && staticOn() === false);
  const touchSingleToggle = toggleCalls === beforeTouch + 1;

  // A fresh card must paint the server's off snapshot, not wait for an event.
  const reloaded = document.createElement('houseplan-card');
  reloaded.setConfig({ type: 'custom:houseplan-card', icon_size: 3.4 });
  document.body.append(reloaded);
  reloaded.hass = hass;
  await waitFor(() => reloaded._devices?.some((device) => device.id === markerId));
  await reloaded.updateComplete;
  const reloadFirstStateOff = !on(reloaded);

  second.remove();
  staticCard.remove();
  reloaded.remove();
  return {
    initialEverywhereOn,
    clickEverywhereOff,
    secondClickEverywhereOn,
    touchSingleToggle,
    reloadFirstStateOff,
    oneServerTogglePerGesture: toggleCalls === 3,
    noHaServiceCalls: serviceCalls.length === 0,
  };
});

checkAll(result);
await finish(browser, result);
