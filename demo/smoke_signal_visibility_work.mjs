// #876 AC7: observable work counts, not a wall-time benchmark or relaxed budget.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const out = await page.evaluate(async () => {
  const card = window.__card, hp = window.__hpTest;
  const spaces = Array.from({ length: 50 }, (_, i) => ({
    id: `signal-floor-${i}`, title: `Signal floor ${i}`, view_box: [0, 0, 1, 1],
    plan_url: null, cell_cm: 5,
    rooms: [{ id: `room-${i}`, name: `Room ${i}`, area: `signal-area-${i}`,
      poly: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]] }],
    settings: { show_borders: true, show_names: true, glow_enabled: false },
  }));
  const markers = [];
  for (let i = 0; i < 200; i++) {
    const floor = i % 50, deviceId = `signal-device-${i}`, entityId = `sensor.signal_${i}`;
    window.__addRegistryDevice(deviceId, `Signal device ${i}`, 'Synthetic', `signal-area-${floor}`);
    window.__addRegistryEntity(entityId, `signal-area-${floor}`, '0', 'demo', { device_id: deviceId }, { linkquality: 150 });
    markers.push({ id: deviceId, binding: `device:${deviceId}`, space: spaces[floor].id,
      room_id: `room-${floor}`, display: 'badge' });
  }
  await hp.setServerConfig({ spaces, markers, settings: {} });
  await hp.switchSpace(spaces[0].id);
  await hp.settled();
  const original = card.hass.callWS;
  let registryFetches = 0, serviceCalls = 0;
  const originalService = card.hass.callService;
  card.hass = { ...card.hass, callWS: async message => {
    if (message.type.startsWith('config/') && message.type.includes('registry')) registryFetches++;
    return original(message);
  }, callService: (...args) => { serviceCalls++; return originalService(...args); } };
  await hp.settled();
  registryFetches = 0;
  const before = { ...card._floorCacheBuilds };
  const onCount = card.shadowRoot.querySelectorAll('.dev .lqi').length;
  const visible = [];
  for (const on of [false, true, false, true]) {
    await hp.setServerConfig(cfg => {
      if (on) delete cfg.settings.show_lqi; else cfg.settings.show_lqi = false;
      return cfg;
    });
    visible.push(card.shadowRoot.querySelectorAll('.dev .lqi').length);
  }
  const after = { ...card._floorCacheBuilds };
  return {
    checks: {
      completeFixture: card._serverCfg.spaces.length === 50 && card._serverCfg.markers.length === 200,
      countsActuallyToggle: onCount === 4 && JSON.stringify(visible) === '[0,4,0,4]',
      noRegistryFetch: registryFetches === 0,
      noServiceDispatch: serviceCalls === 0,
      noGeometryBuild: Object.keys(before).every(key => before[key] === after[key]),
    },
    observed: { spaces: 50, markers: 200, registryFetches, serviceCalls, before, after, visible },
  };
});
checkAll(out.checks);
await finish(browser, out);
