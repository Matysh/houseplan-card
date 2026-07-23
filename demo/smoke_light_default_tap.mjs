import { launch } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const calls = [];
  c.hass = { ...c.hass, callService: (d, s, data) => { calls.push([d, s, data.entity_id]); return Promise.resolve(); } };
  await c.updateComplete;
  c._setMode('view'); await c.updateComplete;
  // лампа (primary light) без явного действия → клик = toggle
  const lamp = c._devices.find((d) => d.primary?.startsWith('light.') && !d.tapAction);
  out.hasLamp = !!lamp;
  c._infoCard = null;
  c._clickDevice(new MouseEvent('click'), lamp);
  out.lampToggles = JSON.stringify(calls.at(-1)) === JSON.stringify(['homeassistant', 'toggle', lamp.primary]);
  // устройство с не-light primary (сенсор) → клик = инфо
  const sensorDev = c._devices.find((d) => d.primary?.startsWith('sensor.') && !d.tapAction);
  const n = calls.length;
  c._infoCard = null;
  c._clickDevice(new MouseEvent('click'), sensorDev);
  out.sensorInfo = calls.length === n && !!c._infoCard;
  c._infoCard = null;
  // явный info у лампы отключает дефолт
  const cfgm = { id: lamp.id, binding: lamp.bindingKind + ':' + lamp.bindingRef, tap_action: 'info' };
  c._serverCfg = { ...c._serverCfg, markers: [...(c._serverCfg.markers || []).filter((m) => m.id !== lamp.id), cfgm] };
  c._regSignature = ''; c._maybeRebuildDevices(); await c.updateComplete;
  const lamp2 = c._devices.find((d) => d.id === lamp.id);
  const n2 = calls.length;
  c._clickDevice(new MouseEvent('click'), lamp2);
  out.explicitInfoWins = calls.length === n2 && !!c._infoCard;
  return out;
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
