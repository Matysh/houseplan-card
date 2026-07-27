import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const devIcon = (id) => {
    const idx = c._devices.filter((x) => x.space === c._space).findIndex((x) => x.id === id);
    const el = sr().querySelectorAll('.dev')[idx];
    return el?.querySelector('ha-icon')?.getAttribute('icon');
  };
  // 1) state-иконки: замок locked → mdi:lock; unlocked → lock-open-variant
  out.lockLocked = devIcon('d_lock');
  c.hass = { ...c.hass, states: { ...c.hass.states, 'lock.front_door': { ...c.hass.states['lock.front_door'], state: 'unlocked' } } };
  await c.updateComplete;
  out.lockUnlocked = devIcon('d_lock');
  // окно: on → window-open
  out.windowOpen = devIcon('d_window');
  c.hass = { ...c.hass, states: { ...c.hass.states, 'binary_sensor.window': { ...c.hass.states['binary_sensor.window'], state: 'off' } } };
  await c.updateComplete;
  out.windowClosed = devIcon('d_window');
  // лампа on → lightbulb-on
  out.bulbOn = devIcon('d_light1');
  // 2) display:value у термометра
  c._serverCfg = { ...c._serverCfg, markers: [{ id: 'd_temp', binding: 'device:d_temp', display: 'value' }] };
  c._regSignature = ''; c._maybeRebuildDevices(); c.requestUpdate(); await c.updateComplete;
  const vd = [...sr().querySelectorAll('.dev.valonly')];
  out.valonly = vd.length;
  out.valText = vd[0]?.querySelector('.valtext')?.textContent.trim();
  out.noSmallBadge = !vd[0]?.querySelector('.tval');
  return out;
});
// значения зафиксированы прогоном на v1.43.1 и сверены с кодом (audit T1)
checkAll(res, {
  "lockLocked": "mdi:lock",
  "lockUnlocked": "mdi:lock-open-variant",
  "windowOpen": "mdi:window-open",
  "windowClosed": "mdi:window-closed",
  "bulbOn": "mdi:lightbulb-on",
  "valonly": 1,
  "valText": "22.4°",
});
await finish(browser, res);
