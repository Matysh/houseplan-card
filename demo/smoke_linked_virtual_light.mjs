// #174: a manual-eligible virtual lamp becomes a real, HA-owned light while
// another marker controls it. State, actions and touch gestures must all use
// the same incoming controller drivers; unlink restores the dormant #107 bit.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1200, height: 900 });
const result = await page.evaluate(async () => {
  const card = window.__card;
  const sourceId = 'linked_virtual_lamp';
  const controllerId = 'linked_wall_relay';
  const driverId = 'switch.kettle';
  const spaceId = 'f1';
  const roomId = 'r2';
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const frame = () => new Promise((resolve) => requestAnimationFrame(
    () => requestAnimationFrame(resolve),
  ));
  const until = async (predicate, timeout = 6000) => {
    const started = performance.now();
    while (!predicate()) {
      if (performance.now() - started > timeout) throw new Error('linked-light smoke timed out');
      await wait(25);
    }
  };

  const serverConfig = structuredClone(card._serverCfg);
  const floor = serverConfig.spaces.find((space) => space.id === spaceId);
  floor.settings = {
    ...(floor.settings || {}),
    show_names: true,
    fill_mode: 'light',
    glow_enabled: true,
    label_light: true,
  };
  serverConfig.markers = [...(serverConfig.markers || []), {
    id: controllerId,
    name: 'Linked wall relay',
    binding: 'device:d_kettle',
    tap_action: 'toggle',
    tap_confirm: false,
    controls: [`marker:${sourceId}`],
    space: spaceId,
    area: 'kitchen',
    room_id: roomId,
  }, {
    id: sourceId,
    name: 'Linked virtual lamp',
    binding: 'virtual',
    is_light: true,
    tap_action: 'toggle',
    tap_confirm: false,
    space: spaceId,
    area: 'kitchen',
    room_id: roomId,
  }];
  const serverLayout = {
    ...card._layout,
    [controllerId]: { s: spaceId, x: 0.64, y: 0.28 },
    [sourceId]: { s: spaceId, x: 0.82, y: 0.28 },
  };
  const virtual = {
    rev: 4,
    config_rev: card._cfgRev,
    off: [sourceId],
  };
  const serviceCalls = [];
  let operationalToggleCalls = 0;
  const baseHass = card.hass;
  const baseCallWS = baseHass.callWS.bind(baseHass);
  let testHass;
  const callWS = async (message) => {
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
      operationalToggleCalls++;
      const off = new Set(virtual.off);
      if (off.has(message.marker_id)) off.delete(message.marker_id);
      else off.add(message.marker_id);
      virtual.off = [...off].sort();
      virtual.rev++;
      return {
        marker_id: message.marker_id,
        on: !off.has(message.marker_id),
        rev: virtual.rev,
      };
    }
    return baseCallWS(message);
  };
  testHass = {
    ...baseHass,
    states: {
      ...baseHass.states,
      [driverId]: { ...baseHass.states[driverId], state: 'on' },
    },
    callService: async (domain, service, data) => {
      serviceCalls.push({ domain, service, data: structuredClone(data) });
    },
    callWS,
  };

  card._unsubVirtual?.();
  card._unsubVirtual = null;
  card.hass = testHass;
  await card._reloadConfigOnly(true);
  card._layout = serverLayout;
  card._space = spaceId;
  card._regSignature = '';
  card._maybeRebuildDevices();
  card._setMode('view');
  await until(() => card._devices.some((device) => device.id === sourceId)
    && card._devices.some((device) => device.id === controllerId));
  await card.updateComplete;
  await frame();

  const item = (id) => card._devices.find((device) => device.id === id);
  const node = (id) => card.renderRoot.querySelector(`.dev[data-id="${id}"]`);
  const isOn = (id) => card._stateClass(item(id)).includes('on');
  const roomVisual = () => {
    const fill = card._resolvedRoomFills(
      card._spaceModel(), card._spaceDisplayForRender(),
    ).byId.get(roomId);
    const label = card.renderRoot.querySelector(`.roomlabel[data-id="${roomId}"] .rlm`);
    return {
      fill: fill?.color || null,
      labelExists: !!label,
      labelLit: !!label?.classList.contains('lit'),
      labelText: label?.textContent?.trim() || '',
      glow: card._glowRenderedSources.has(`${spaceId}|${sourceId}`),
    };
  };
  const setDriver = async (state) => {
    testHass = {
      ...testHass,
      states: {
        ...testHass.states,
        [driverId]: { ...testHass.states[driverId], state },
      },
      callService: testHass.callService,
      callWS,
    };
    card.hass = testHass;
    await card.updateComplete;
    await frame();
    try {
      await until(() => isOn(sourceId) === (state === 'on'));
    } catch (error) {
      throw new Error(`linked driver state did not settle: ${JSON.stringify({
        expected: state,
        live: card.hass?.states?.[driverId]?.state,
        rendered: card._renderPlanHass?.states?.[driverId]?.state,
        sourceClass: card._stateClass(item(sourceId)),
        controllerClass: card._stateClass(item(controllerId)),
        continuity: card._continuity?.state,
      })}`, { cause: error });
    }
  };
  const click = async (id) => {
    node(id).dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    await wait(0);
  };
  const targetsOf = (call) => {
    const value = call?.data?.entity_id;
    return Array.isArray(value) ? value : value ? [value] : [];
  };

  const initial = roomVisual();
  const displayHasLightFill = card._spaceDisplayForRender().fill === 'light';
  const displayHasLightLabel = card._spaceDisplayForRender().labelLight === true;
  const initialSourceOn = isOn(sourceId);
  const initialControllerOn = isOn(controllerId);
  const linkedManualOffFollowsDriver = isOn(sourceId) && isOn(controllerId)
    && initial.glow && initial.labelLit && !!initial.fill;

  // Source click issues a real HA command. Resolving that promise is not an
  // optimistic state change: every visual waits for the next HA snapshot.
  await click(sourceId);
  const sourceCall = serviceCalls.at(-1);
  const sourceCallsRelay = sourceCall?.service === 'turn_off'
    && JSON.stringify(targetsOf(sourceCall)) === JSON.stringify([driverId]);
  const noOptimisticVisual = isOn(sourceId) && roomVisual().glow;
  await setDriver('off');
  await wait(560); // Glow keeps its DOM node for the deliberate fade-out.
  await card.updateComplete;
  const off = roomVisual();
  const offSource = !isOn(sourceId);
  const offController = !isOn(controllerId);
  const offTickUpdatesAll = !isOn(sourceId) && !isOn(controllerId)
    && !off.glow && !off.labelLit && off.labelText !== initial.labelText
    && off.fill !== initial.fill;

  await click(controllerId);
  const controllerCall = serviceCalls.at(-1);
  const controllerCallsRelay = controllerCall?.service === 'turn_on'
    && JSON.stringify(targetsOf(controllerCall)) === JSON.stringify([driverId]);
  await setDriver('on');
  const relit = roomVisual();
  const relitSource = isOn(sourceId);
  const relitController = isOn(controllerId);
  const controllerTickUpdatesAll = relitSource && relitController
    && relit.glow && relit.labelLit;

  const beforeAutomation = serviceCalls.length;
  await setDriver('off');
  const externalStateUpdateWorks = serviceCalls.length === beforeAutomation
    && !isOn(sourceId) && !isOn(controllerId) && !roomVisual().labelLit;

  // One short touch tap is one service call and still waits for HA state.
  const sourceNode = node(sourceId);
  const rect = sourceNode.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const pointer = (type, id, target, px = x, py = y, buttons = 0) => target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      composed: true,
      pointerId: id,
      pointerType: 'touch',
      clientX: px,
      clientY: py,
      button: type === 'pointerdown' ? 0 : -1,
      buttons,
    }),
  );
  const beforeTap = serviceCalls.length;
  pointer('pointerdown', 17401, sourceNode, x, y, 1);
  pointer('pointerup', 17401, sourceNode, x, y, 0);
  sourceNode.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  await wait(0);
  const touchTapCallsOnce = serviceCalls.length === beforeTap + 1
    && serviceCalls.at(-1)?.service === 'turn_on' && !isOn(sourceId);

  // Long-press opens the existing card; its synthetic click is swallowed.
  const beforeLongPress = serviceCalls.length;
  pointer('pointerdown', 17402, sourceNode, x, y, 1);
  await wait(680);
  const longPressOpenedInfo = !!card._infoCard;
  pointer('pointerup', 17402, sourceNode, x, y, 0);
  sourceNode.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  const longPressNoService = serviceCalls.length === beforeLongPress;
  card._closeInfoCard();

  const beforeCancel = serviceCalls.length;
  pointer('pointerdown', 17403, sourceNode, x, y, 1);
  pointer('pointercancel', 17403, sourceNode, x, y, 0);
  const pointerCancelNoService = serviceCalls.length === beforeCancel && !isOn(sourceId);

  // A moved one-finger gesture and a two-finger sequence both suppress the
  // immediately following synthetic click on the marker.
  const beforePan = serviceCalls.length;
  pointer('pointerdown', 17404, sourceNode, x, y, 1);
  pointer('pointermove', 17404, sourceNode, x + 70, y + 45, 1);
  pointer('pointerup', 17404, sourceNode, x + 70, y + 45, 0);
  sourceNode.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  const panNoService = serviceCalls.length === beforePan;
  await wait(20);

  const beforePinch = serviceCalls.length;
  const stage = card._stageEl;
  pointer('pointerdown', 17405, sourceNode, x, y, 1);
  pointer('pointerdown', 17406, stage, x + 100, y, 1);
  pointer('pointermove', 17405, sourceNode, x - 35, y, 1);
  pointer('pointermove', 17406, stage, x + 135, y, 1);
  pointer('pointerup', 17405, sourceNode, x - 35, y, 0);
  pointer('pointerup', 17406, stage, x + 135, y, 0);
  sourceNode.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  const pinchNoService = serviceCalls.length === beforePinch;
  await wait(520);

  // Removing the last relation exposes the preserved manual off-bit. The
  // same lamp then returns to #107 and uses operational WS, not HA service.
  const controllerCfg = serverConfig.markers.find((marker) => marker.id === controllerId);
  controllerCfg.controls = [];
  await card._reloadConfigOnly(true);
  card._layout = serverLayout;
  card._regSignature = '';
  card._maybeRebuildDevices();
  await card.updateComplete;
  await until(() => !isOn(sourceId));
  const unlinkRestoresManualOff = !isOn(sourceId) && virtual.off.includes(sourceId);
  const beforeManualService = serviceCalls.length;
  await click(sourceId);
  await until(() => isOn(sourceId));
  const manualToggleRestored = operationalToggleCalls === 1
    && serviceCalls.length === beforeManualService && !virtual.off.includes(sourceId);

  return {
    linkedManualOffFollowsDriver,
    initialSourceOn,
    initialControllerOn,
    initialGlow: initial.glow,
    initialRoomLabelLit: initial.labelLit,
    initialRoomLabelExists: initial.labelExists,
    initialRoomFill: !!initial.fill,
    displayHasLightFill,
    displayHasLightLabel,
    sourceCallsRelay,
    noOptimisticVisual,
    offTickUpdatesAll,
    offSource,
    offController,
    offGlowGone: !off.glow,
    offRoomLabel: !off.labelLit,
    offRoomFillChanged: off.fill !== initial.fill,
    controllerCallsRelay,
    controllerTickUpdatesAll,
    relitSource,
    relitController,
    relitGlow: relit.glow,
    relitRoomLabel: relit.labelLit,
    externalStateUpdateWorks,
    touchTapCallsOnce,
    longPressOpenedInfo,
    longPressNoService,
    pointerCancelNoService,
    panNoService,
    pinchNoService,
    noOperationalToggleWhileLinked: operationalToggleCalls === 1,
    unlinkRestoresManualOff,
    manualToggleRestored,
  };
});

checkAll(result);
await finish(browser, result);
