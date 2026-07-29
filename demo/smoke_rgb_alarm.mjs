import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  // RGB-лампа: ceiling on + rgb_color
  c.hass = { ...c.hass, states: { ...c.hass.states,
    'light.ceiling': { entity_id: 'light.ceiling', state: 'on', attributes: { friendly_name: 'Ceiling light', rgb_color: [255, 0, 128] } } } };
  await c.updateComplete;
  // v1.52.0 (правило владельца): RGB больше НЕ красит значок — цвет лампы
  // живёт только в glow-пятне и в фолбэке цвета пульсации
  out.rgbClassGone = !sr().querySelector('.dev.rgb');
  out.litLampIsYellow = [...sr().querySelectorAll('.dev.on')].length > 0;
  // фолбэк пульсации сохраняет цвет свечения: маркер icon_ripple на лампе
  const lampDev = c._devices.find((x) => x.entities.includes('light.ceiling'));
  c._serverCfg.markers = (c._serverCfg.markers || []).filter((m) => m.id !== lampDev.id);
  c._serverCfg.markers.push({ id: lampDev.id, binding: 'device:' + lampDev.bindingRef, display: 'icon_ripple' });
  c._cfgEpoch++; c._regSignature = ''; c._maybeRebuildDevices();
  c.requestUpdate(); await c.updateComplete;
  const rippleDev = [...sr().querySelectorAll('.dev')].find((e) => (e.getAttribute('style') || '').includes('--ripple-color'));
  out.rippleKeepsLightColor = !!rippleDev && rippleDev.getAttribute('style').includes('rgb(255, 0, 128)');
  c._serverCfg.markers = c._serverCfg.markers.filter((m) => m.id !== lampDev.id);
  c._cfgEpoch++; c._regSignature = ''; c._maybeRebuildDevices(); await c.updateComplete;
  // тревога: датчик протечки on
  c.hass = { ...c.hass, states: { ...c.hass.states,
    'binary_sensor.sink_leak': { entity_id: 'binary_sensor.sink_leak', state: 'on', attributes: { friendly_name: 'Leak', device_class: 'moisture' } } } };
  await c.updateComplete;
  out.alarmCount = sr().querySelectorAll('.dev.alarm').length;
  // выключили — тревога ушла
  c.hass = { ...c.hass, states: { ...c.hass.states,
    'binary_sensor.sink_leak': { entity_id: 'binary_sensor.sink_leak', state: 'off', attributes: { friendly_name: 'Leak', device_class: 'moisture' } } } };
  await c.updateComplete;
  out.alarmCleared = sr().querySelectorAll('.dev.alarm').length === 0;
  // unavailable не тревожит
  c.hass = { ...c.hass, states: { ...c.hass.states,
    'binary_sensor.sink_leak': { entity_id: 'binary_sensor.sink_leak', state: 'unavailable', attributes: { device_class: 'moisture' } } } };
  await c.updateComplete;
  out.outageSafe = sr().querySelectorAll('.dev.alarm').length === 0;
  return out;
});
// значения зафиксированы прогоном на v1.43.1 и сверены с кодом (audit T1)
checkAll(res, {
  "alarmCount": 1,
});
await finish(browser, res);
