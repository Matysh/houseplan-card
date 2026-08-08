// Always-static display contract: one neutral face across live states, while
// the existing dynamic display keeps reacting. Run only in the prerelease gate.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch();
const out = await page.evaluate(() => {
  const card = window.__card;
  const saved = card.hass;
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
  return {
    staticAlarmNeutral: smokeOn.status === 'neutral'
      && smokeOn.activity === 'none'
      && smokeOn.classes.join(' ') === 'static-icon',
    staticUnavailableSame: JSON.stringify(smokeOn) === JSON.stringify(smokeUnavailable),
    staticSuppressesVacuum: smokeOn.vacuumLive === false,
    liveSwitchStillDynamic: relayOn.status === 'working' && relayOn.classes.includes('on'),
  };
});

await finish(browser, checkAll(out));
