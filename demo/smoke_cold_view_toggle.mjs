// #357: a plain View tap must work on a COLD tab that never loaded the lazy
// editor runtime (#337). The field failure (dacha, "Гостиная основной свет"):
// a real wall switch whose controls name three passive virtual lamps did
// nothing on tap — _toggleIntent was a stub delegating into the not-yet-loaded
// editor runtime and threw synchronously inside the click handler; opening any
// editor surface "healed" the tab. Every product smoke preloads the runtime
// (launch()), so only a cold-view scenario can see this class of regression.
import { launchColdView, checkAll, finish } from './serve.mjs';

const { page, browser } = await launchColdView();
const requested = [];
page.on('request', (request) => requested.push(new URL(request.url()).pathname));
let pageErrors = 0;
page.on('pageerror', (error) => { pageErrors++; console.log('EXC', error.message); });

const out = await page.evaluate(async () => {
  const card = window.__card;
  const space = card._model[0];
  const room = space.rooms.find((candidate) => candidate.id && candidate.area);
  const virtualIds = ['v_cold_1', 'v_cold_2', 'v_cold_3'];
  const controllerId = 'd_kettle'; // real switch device — the wall-switch analog
  const confirmId = 'v_cold_confirm';
  const serverConfig = structuredClone(card._serverCfg);
  // The exact field shape: passive virtual lamps owned by a real switch.
  serverConfig.markers = [...(serverConfig.markers || []),
    ...virtualIds.map((id, index) => ({
      id,
      name: `Cold main light ${index + 1}`,
      binding: 'virtual',
      is_light: true,
      tap_action: 'toggle',
      space: space.id,
      area: room.area,
      room_id: room.id,
    })),
    {
      id: confirmId,
      name: 'Cold confirmed lamp',
      binding: 'virtual',
      is_light: true,
      tap_action: 'toggle',
      tap_confirm: true,
      space: space.id,
      area: room.area,
      room_id: room.id,
    }];
  // Demo devices come straight from the registry without explicit markers —
  // persist one for the switch exactly like the marker dialog would.
  serverConfig.markers.push({
    id: controllerId,
    binding: `device:${controllerId}`,
    name: 'Cold wall switch',
    tap_action: 'toggle',
    controls: virtualIds.map((id) => `marker:${id}`),
    space: space.id,
    area: room.area,
    room_id: room.id,
  });
  const serverLayout = { ...card._layout };
  [...virtualIds, confirmId].forEach((id, index) => {
    serverLayout[id] = { s: space.id, x: 0.2 + index * 0.12, y: 0.72 };
  });
  const virtual = { rev: 0, config_rev: card._cfgRev, off: [] };
  const subscriptions = new Map();
  const serviceCalls = [];
  let toggleCalls = 0;
  const emit = (event, data) => {
    for (const listener of subscriptions.get(event) || []) listener({ data });
  };
  const baseHass = card.hass;
  const baseCallWS = baseHass.callWS.bind(baseHass);
  const makeHass = () => ({
    ...baseHass,
    states: { ...baseHass.states },
    connection: {
      ...baseHass.connection,
      subscribeEvents: async (callback, event) => {
        const listeners = subscriptions.get(event) || new Set();
        listeners.add(callback);
        subscriptions.set(event, listeners);
        return () => listeners.delete(callback);
      },
    },
    callService: async (domain, service, data) => {
      serviceCalls.push({ domain, service, data });
      // The stub HA honestly flips the switch and pushes a fresh state frame.
      const target = [].concat(data?.entity_id || [])[0];
      const current = hass.states[target]?.state;
      const next = service === 'toggle' ? (current === 'on' ? 'off' : 'on')
        : service === 'turn_on' ? 'on' : 'off';
      const fresh = makeHass();
      fresh.states[target] = { ...hass.states[target], state: next };
      hass = fresh;
      card.hass = fresh;
      await card.updateComplete;
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
        rev: card._layoutRev,
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
  });
  let hass = makeHass();
  hass.states[`switch.kettle`] = { ...hass.states['switch.kettle'], state: 'on' };
  card._unsubVirtual?.();
  card._unsubVirtual = null;
  card.hass = hass;
  await card._reloadConfigOnly(true);
  card._layout = serverLayout;
  card._regSignature = '';
  card._maybeRebuildDevices();
  card._ensureLiveSyncSubscriptions();
  await card.updateComplete;

  const waitFor = async (predicate, timeout = 6000) => {
    const started = Date.now();
    while (!predicate() && Date.now() - started < timeout) {
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    return !!predicate();
  };
  await waitFor(() => card._devices.some((device) => device.id === virtualIds[2]));
  await card.updateComplete;

  const node = (id) => card.renderRoot.querySelector(`.dev[data-id="${id}"]`);
  const isOn = (id) => card._stateClass(card._devices.find((d) => d.id === id)).includes('on');
  const allVirtualOn = () => virtualIds.every(isOn);
  const out = { runtimeColdBefore: !card._editorRuntime };

  // Passive lamps follow their controller: with the switch on they glow.
  out.initialAllOn = await waitFor(allVirtualOn);

  // One tap on the wall switch drives its own entity; all three follow off.
  node(controllerId).dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  out.controllerTapCallsSwitch = await waitFor(() => serviceCalls.length === 1
    && [].concat(serviceCalls[0].data?.entity_id || [])[0] === 'switch.kettle');
  out.controllerTapTurnsAllOff = await waitFor(() => !virtualIds.some(isOn));
  node(controllerId).dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  out.controllerTapTurnsAllOn = await waitFor(() => serviceCalls.length === 2 && allVirtualOn());

  // A tap on a controlled lamp drives the same wall switch (wired semantics).
  node(virtualIds[0]).dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  out.lampTapDrivesSwitch = await waitFor(() => serviceCalls.length === 3
    && [].concat(serviceCalls[2].data?.entity_id || [])[0] === 'switch.kettle');
  out.lampTapTurnsAllOff = await waitFor(() => !virtualIds.some(isOn));

  // An independent manual virtual lamp with tap_confirm: the dialog opens with
  // rendered state lines and the confirmation toggles it over the WS API.
  node(confirmId).dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  await card.updateComplete;
  out.confirmDialogShown = !!card._tapConfirm
    && Array.isArray(card._tapConfirm.lines) && card._tapConfirm.lines.length > 0;
  card._tapConfirm?.exec?.();
  out.confirmExecTogglesVirtual = await waitFor(() => toggleCalls === 1);
  card._tapConfirm = null;

  out.runtimeColdAfter = !card._editorRuntime;
  return out;
});

out.noEditorRuntimeRequest = requested.every((path) => !/houseplan-editor-runtime-/.test(path));
out.noPageErrors = pageErrors === 0;
checkAll(out);
await finish(browser, out);
