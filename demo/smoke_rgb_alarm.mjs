import { launch } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  // RGB-лампа: ceiling on + rgb_color
  c.hass = { ...c.hass, states: { ...c.hass.states,
    'light.ceiling': { entity_id: 'light.ceiling', state: 'on', attributes: { friendly_name: 'Ceiling light', rgb_color: [255, 0, 128] } } } };
  await c.updateComplete;
  const rgbDev = sr().querySelector('.dev.rgb');
  out.rgbClass = !!rgbDev;
  out.rgbVar = rgbDev?.getAttribute('style')?.includes('--light-color:rgb(255, 0, 128)');
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
console.log(JSON.stringify(res, null, 1));
await browser.close();
