// Опция «Использовать датчик температуры устройства» (marker.use_climate_temp):
// климат-устройства (кондиционеры, термостаты) знают температуру комнаты
// (attributes.current_temperature). По умолчанию ВЫКЛ — ни плашки, ни вклада
// в среднюю. Включена через диалог (реальный клик по чекбоксу): плашка .tval
// у значка + голос в средней комнаты (термометр 20 + климат 23.5 → 21.75,
// т.е. 21.8 по сетке карточки 0.1°). Unavailable-климат не ломает ничего.
import { launch, check, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const out = {};

// --- впрыскиваем климат-устройства в демо-hass ---------------------------
await page.evaluate(() => {
  const c = window.__card;
  const h = window.__mkHass();
  const inject = (hass) => ({
    ...hass,
    devices: {
      ...hass.devices,
      d_ac: { id: 'd_ac', name: 'Air conditioner', model: 'AC-12', area_id: 'living_room', identifiers: [['demo', 'd_ac']], entry_type: null, via_device_id: null },
      d_trv: { id: 'd_trv', name: 'Radiator valve', model: 'TRV-1', area_id: 'bedroom', identifiers: [['demo', 'd_trv']], entry_type: null, via_device_id: null },
    },
    entities: {
      ...hass.entities,
      'climate.ac': { entity_id: 'climate.ac', device_id: 'd_ac', platform: 'demo' },
      'climate.trv': { entity_id: 'climate.trv', device_id: 'd_trv', platform: 'demo' },
    },
    states: {
      ...hass.states,
      // термометр гостиной — ровно 20, чтобы средняя с климатом была детерминированной
      'sensor.living_temp': { ...hass.states['sensor.living_temp'], state: '20' },
      'climate.ac': { entity_id: 'climate.ac', state: 'cool', attributes: { friendly_name: 'Air conditioner', current_temperature: 23.5, temperature: 24 } },
      // мёртвый климат: state unavailable, атрибутов нет
      'climate.trv': { entity_id: 'climate.trv', state: 'unavailable', attributes: { friendly_name: 'Radiator valve' } },
    },
  });
  window.__injectClimate = () => { c.hass = inject(window.__mkHass()); };
  window.__injectClimate();
  c._regSignature = '';
  c._maybeRebuildDevices();
  c.requestUpdate();
});
await page.waitForFunction(() => window.__card._devices.some((d) => d.entities?.includes('climate.ac')));

// --- без опции: ни плашки, ни вклада в среднюю ---------------------------
Object.assign(out, await page.evaluate(async () => {
  const o = {};
  const c = window.__card;
  await c.updateComplete;
  const ac = c._devices.find((d) => d.entities?.includes('climate.ac'));
  o.acBuilt = !!ac;
  o.noBadgeByDefault = c._liveTemp(ac) === null;
  o.avgWithoutOption = c._climate().get('living_room')?.temp; // === 20
  return o;
}), { avgWithoutOption: 20 });

// --- диалог: чекбокс есть у климат-устройства, нет у обычного, клик мышью --
Object.assign(out, await page.evaluate(async () => {
  const o = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  // у обычного термометра чекбокса нет
  const th = c._devices.find((d) => d.entities?.includes('sensor.living_temp'));
  c._openMarkerDialog(th); await c.updateComplete;
  o.noCheckboxForThermometer = !sr().querySelector('.dialog .climrow');
  c._markerDialog = null; await c.updateComplete;
  // у кондиционера — есть и по умолчанию снят
  const ac = c._devices.find((d) => d.entities?.includes('climate.ac'));
  c._openMarkerDialog(ac); await c.updateComplete;
  const row = sr().querySelector('.dialog .climrow input');
  o.checkboxForClimate = !!row;
  o.uncheckedByDefault = !!row && !row.checked;
  if (row) row.scrollIntoView({ block: 'center' });
  return o;
}));

// реальный клик по чекбоксу — координатами, через весь стек событий
const box = await page.evaluate(() => {
  const c = window.__card;
  const sr = c.shadowRoot || c.renderRoot;
  const r = sr.querySelector('.dialog .climrow input')?.getBoundingClientRect();
  return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
});
check('checkboxClickable', !!box);
if (box) await page.mouse.click(box.x, box.y);
Object.assign(out, await page.evaluate(async () => {
  const o = {};
  const c = window.__card;
  await c.updateComplete;
  o.clickTicksState = c._markerDialog?.useClimateTemp === true;
  await c._saveMarker(); await c.updateComplete;
  const m = (c._serverCfg.markers || []).find((x) => x.binding === 'device:d_ac');
  o.savedInMarker = m?.use_climate_temp === true;
  return o;
}));

// --- с опцией: плашка «23.5°», средняя пересчиталась ----------------------
Object.assign(out, await page.evaluate(async () => {
  const o = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  await c.updateComplete;
  const ac = c._devices.find((d) => d.entities?.includes('climate.ac'));
  o.liveTempFromClimate = c._liveTemp(ac); // === 23.5
  const badges = [...sr().querySelectorAll('.dev .tval')].map((el) => el.textContent.trim());
  o.badgeVisible = badges.includes('23.5°');
  // средняя гостиной: (20 + 23.5) / 2 = 21.75 → 21.8 по сетке карточки (0.1°)
  o.avgWithOption = c._climate().get('living_room')?.temp;
  // и на КАРТОЧКЕ КОМНАТЫ: включаем метрику температуры и читаем текст
  const sp = c._serverCfg.spaces.find((s) => s.id === 'f1');
  sp.settings = { ...(sp.settings || {}), label_temp: true, show_names: true };
  c.requestUpdate(); await c.updateComplete;
  const labels = [...sr().querySelectorAll('.roomlabel .rlm')].map((el) => el.textContent.trim());
  o.roomCardShowsAvg = labels.some((t) => t.includes('21.8°'));
  return o;
}), { liveTempFromClimate: 23.5, avgWithOption: 21.8 });

// --- unavailable-климат: опция включена, но ни плашки, ни вклада ----------
Object.assign(out, await page.evaluate(async () => {
  const o = {};
  const c = window.__card;
  c._serverCfg.markers = [...c._serverCfg.markers,
    { id: 'd_trv', binding: 'device:d_trv', use_climate_temp: true, hidden: false }];
  c._cfgEpoch++; c._regSignature = '';
  c._maybeRebuildDevices(); c.requestUpdate(); await c.updateComplete;
  const trv = c._devices.find((d) => d.entities?.includes('climate.trv'));
  o.unavailNoBadge = !!trv && c._liveTemp(trv) === null;
  o.unavailNoVote = c._climate().get('bedroom')?.temp ?? null; // в спальне нет термометров
  // а гостиная как была 21.8
  o.avgStillCorrect = c._climate().get('living_room')?.temp;
  return o;
}), { unavailNoVote: null, avgStillCorrect: 21.8 });

// --- чекбокс переживает пересоздание диалога ------------------------------
Object.assign(out, await page.evaluate(async () => {
  const o = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const ac = c._devices.find((d) => d.entities?.includes('climate.ac'));
  c._openMarkerDialog(ac); await c.updateComplete;
  o.survivesReopen = c._markerDialog?.useClimateTemp === true;
  o.checkboxChecked = sr().querySelector('.dialog .climrow input')?.checked === true;
  c._markerDialog = null;
  return o;
}));

checkAll(out, { avgWithoutOption: 20, liveTempFromClimate: 23.5, avgWithOption: 21.8, unavailNoVote: null, avgStillCorrect: 21.8 });
await finish(browser, out);
