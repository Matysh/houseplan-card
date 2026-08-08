// Always-static display contract across resolver, plan DOM, preview, static
// space card and live-vacuum overlays. The existing dynamic mode still reacts.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch();
const out = await page.evaluate(async () => {
  const card = window.__card;
  const saved = card.hass;
  const root = () => card.shadowRoot || card.renderRoot;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const update = async () => {
    card.requestUpdate();
    await card.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  };
  const domFace = (node) => node && ({
    classes: [...node.classList].filter((name) => [
      'static-icon', 'on', 'open', 'alarm', 'unavail', 'valonly',
      'activity-running', 'activity-event', 'activity-presence', 'activity-transition',
    ].includes(name)),
    icon: node.querySelector(':scope > ha-icon')?.getAttribute('icon') || '',
    satellites: node.querySelectorAll('.tval,.hval,.lqi,.valtext').length,
    scale: node.style.getPropertyValue('--dev-scale'),
    angle: node.querySelector(':scope > ha-icon')?.style.transform || '',
  });
  const show = (device, states) => {
    card.hass = {
      ...saved,
      entities: {
        ...saved.entities,
        ...Object.fromEntries(Object.keys(states).map((entity_id) => [entity_id, {
          entity_id, device_id: device.id, platform: 'demo', disabled_by: null,
        }])),
      },
      states: { ...saved.states, ...states },
    };
    const presentation = card._devicePresentation(device);
    card.hass = saved;
    return {
      classes: presentation.classes,
      icon: presentation.icon,
      status: presentation.visual.status,
      activity: presentation.activity,
      temp: presentation.tempText,
      lqi: presentation.lqiText,
      vacuumLive: presentation.vacuumLive,
    };
  };

  const smoke = {
    id: 'static-smoke', name: 'Smoke', icon: 'mdi:smoke-detector',
    entities: ['binary_sensor.static_smoke'], primary: 'binary_sensor.static_smoke',
    marker: {
      binding: 'device:static-smoke', display: 'static_icon',
      vacuum: { live: true },
    },
  };
  const relay = {
    // Reuse the harness registry entry: `_planHass` deliberately resolves
    // against the acquired HA registry, so an invented entity would correctly
    // be absent even if it were injected into `hass.states` for this frame.
    id: 'd_kettle', name: 'Relay', icon: 'mdi:toggle-switch',
    entities: ['switch.kettle'], primary: 'switch.kettle',
    marker: { binding: 'device:d_kettle', display: 'badge' },
  };
  const smokeOn = show(smoke, {
    'binary_sensor.static_smoke': {
      state: 'on', attributes: { device_class: 'smoke', linkquality: 180 },
    },
  });
  const smokeUnavailable = show(smoke, {
    'binary_sensor.static_smoke': {
      state: 'unavailable', attributes: { device_class: 'smoke', linkquality: 180 },
    },
  });
  const relayOn = show(relay, {
    'switch.kettle': { state: 'on', attributes: {} },
  });

  const markerId = 'static-vacuum';
  card._serverCfg.markers.push({
    id: markerId,
    // Rebind the registered demo mower into f1. A made-up entity would be
    // correctly absent from the authoritative HA registry and could not prove
    // that the live-vacuum renderer itself was suppressed.
    binding: 'device:d_mower',
    space: 'f1',
    area: 'living_room',
    display: 'static_icon',
    icon: 'mdi:robot-vacuum',
    size: 1.4,
    angle: 27,
    vacuum: {
      source: 'camera.static_robot_map',
      live: true,
      trail_mode: 'always',
      calibration: { m1: [0.001, 0, 0, 0.001, 0, 0] },
    },
  });
  card._layout[markerId] = { s: 'f1', x: 0.3, y: 0.3 };
  card.hass = {
    ...saved,
    states: {
      ...saved.states,
      'vacuum.mower': {
        entity_id: 'vacuum.mower', state: 'cleaning',
        attributes: { friendly_name: 'Static robot' },
      },
      'camera.static_robot_map': {
        entity_id: 'camera.static_robot_map', state: 'idle',
        attributes: {
          map_name: 'm1', vacuum_position: { x: 500, y: 500, a: 0 },
          path: [[200, 200], [350, 350], [500, 500]],
        },
      },
    },
  };
  card._regSignature = '';
  card._cfgEpoch++;
  card._setMode('view');
  await update();
  const planFace = domFace(root().querySelector(`.dev[data-id="${markerId}"]`));
  const noPlanVacuumOverlay = !root().querySelector(`.vacpuck[data-mid="${markerId}"]`)
    && !root().querySelector('.vactrail');

  card._setMode('devices');
  const staticDevice = card._devices.find((item) => item.id === markerId);
  card._openMarkerDialog(staticDevice);
  await update();
  const preview = root().querySelector('hp-device-preview');
  await preview?.updateComplete;
  const previewFace = domFace(preview?.renderRoot?.querySelector('.dev'));
  const staticPreviewHasNoDemo = !preview?.renderRoot?.querySelector('.previewdemo');

  const savedMarker = card._serverCfg.markers.find((marker) => marker.id === markerId);
  savedMarker.display = 'badge';
  card._markerDialog = null;
  card._cfgEpoch++;
  card._setMode('view');
  card.hass = { ...card.hass };
  await update();
  const dynamicNode = root().querySelector(`.dev[data-id="${markerId}"]`);
  const switchedBackToDynamic = dynamicNode?.classList.contains('on')
    && !dynamicNode?.classList.contains('static-icon');
  const dynamicVacuumOverlayRestored = !!root().querySelector(`.vacpuck[data-mid="${markerId}"]`)
    && !!root().querySelector('.vactrail');
  savedMarker.display = 'static_icon';
  card._cfgEpoch++;
  card.hass = { ...card.hass };
  await update();
  const returnedNode = root().querySelector(`.dev[data-id="${markerId}"]`);
  const returnCreatesNoActivity = returnedNode?.classList.contains('static-icon')
    && ![...returnedNode.classList].some((name) => name.startsWith('activity-'));
  const returnHidesVacuumOverlay = !root().querySelector(`.vacpuck[data-mid="${markerId}"]`)
    && !root().querySelector('.vactrail');

  await customElements.whenDefined('houseplan-space-card');
  const staticCard = document.createElement('houseplan-space-card');
  staticCard.setConfig({ type: 'custom:houseplan-space-card', space: 'f1' });
  staticCard.hass = card.hass;
  document.body.appendChild(staticCard);
  const started = Date.now();
  while (!staticCard.renderRoot?.querySelector(`.dev[data-id="${markerId}"]`)
      && Date.now() - started < 6000) {
    await wait(60);
  }
  await staticCard.updateComplete;
  const staticCardFace = domFace(staticCard.renderRoot?.querySelector(`.dev[data-id="${markerId}"]`));
  return {
    staticAlarmNeutral: smokeOn.status === 'neutral'
      && smokeOn.activity === 'none'
      && smokeOn.classes.join(' ') === 'static-icon',
    staticUnavailableSame: JSON.stringify(smokeOn) === JSON.stringify(smokeUnavailable),
    staticSuppressesVacuum: smokeOn.vacuumLive === false,
    liveSwitchStillDynamic: relayOn.status === 'working' && relayOn.classes.includes('on'),
    planPreviewStaticParity: !!planFace && !!previewFace
      && planFace.classes.includes('static-icon')
      && previewFace.classes.includes('static-icon')
      && JSON.stringify(planFace) === JSON.stringify(previewFace),
    planStaticCardParity: !!planFace && !!staticCardFace
      && planFace.classes.includes('static-icon')
      && staticCardFace.classes.includes('static-icon')
      && JSON.stringify(planFace) === JSON.stringify(staticCardFace),
    noPlanVacuumOverlay,
    staticPreviewHasNoDemo,
    switchedBackToDynamic,
    dynamicVacuumOverlayRestored,
    returnCreatesNoActivity,
    returnHidesVacuumOverlay,
  };
});

await finish(browser, checkAll(out));
