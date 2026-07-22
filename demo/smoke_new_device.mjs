import { launch } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  // 1) первый запуск: базлайн засеян молча, точек нет
  out.baselineSeeded = Array.isArray(c._serverCfg.settings.known_devices) && c._serverCfg.settings.known_devices.length > 0;
  out.noDotsOnFirstRun = sr().querySelectorAll('.newdot').length === 0;
  // 2) в HA появилось новое устройство
  const h = { ...c.hass };
  h.devices = { ...h.devices, d_new: { id: 'd_new', name: 'Brand new plug', model: 'Smart Plug', area_id: 'kitchen', identifiers: [['demo', 'd_new']] } };
  h.entities = { ...h.entities, 'switch.newplug': { entity_id: 'switch.newplug', device_id: 'd_new', platform: 'demo' } };
  h.states = { ...h.states, 'switch.newplug': { state: 'off', attributes: { friendly_name: 'Brand new plug' } } };
  c.hass = h; await c.updateComplete; c.requestUpdate(); await c.updateComplete;
  out.flagged = c._serverCfg.settings.new_device_ids?.includes('d_new');
  out.dotShown = sr().querySelectorAll('.newdot').length === 1;
  // 3) существующие не флагуются
  out.onlyOne = (c._serverCfg.settings.new_device_ids || []).length === 1;
  // 4) открытие редактора снимает флаг
  const dev = c._devices.find((d) => d.id === 'd_new');
  c._setMode('devices');
  c._openMarkerDialog(dev); await c.updateComplete;
  c._markerDialog = null; c._setMode('view'); await c.updateComplete;
  out.ackCleared = !(c._serverCfg.settings.new_device_ids || []).includes('d_new');
  out.dotGone = sr().querySelectorAll('.newdot').length === 0;
  // 5) known растёт, повторно не флагуется
  out.stillKnown = c._serverCfg.settings.known_devices.includes('d_new');
  return out;
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
