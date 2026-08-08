// Ревью R2-3: климат комнат считался отдельным обходом реестра на каждую
// комнату и каждую величину — 60 комнат × 2000 сущностей съедали кадр на
// перечитывании метаданных, которые не менялись. Карта строится один раз на
// снимок hass; при этом новые состояния датчиков обязаны попадать в неё сразу.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;

  // считаем обходы реестра через ownKeys — именно его дёргает Object.entries
  let scans = 0;
  const wrap = (h) => {
    const ents = h.entities;
    const traced = new Proxy(ents, { ownKeys(t) { scans++; return Reflect.ownKeys(t); } });
    return { ...h, entities: traced };
  };
  const fresh = () => wrap(window.__mkHass());

  // включаем и заливку по температуре, и подписи — два потребителя климата
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== 'f1' ? s : {
    ...s, settings: { ...(s.settings || {}), show_names: true, fill_mode: 'temp', label_temp: true, label_hum: true },
  })};
  c._cfgEpoch++;
  c.hass = fresh(); await c.updateComplete;

  scans = 0;
  c.hass = fresh(); await c.updateComplete;
  const fewRooms = scans;

  // повторные рендеры на том же снимке hass реестр не трогают
  scans = 0;
  c.requestUpdate(); await c.updateComplete;
  c.requestUpdate(); await c.updateComplete;
  out.scansOnRerender = scans;

  // главный инвариант: обходов НЕ становится больше от числа комнат
  const f1 = c._serverCfg.spaces.find((s) => s.id === 'f1');
  const extra = [];
  for (let i = 0; i < 40; i++) {
    extra.push({ id: 'gen' + i, name: 'R' + i, area: 'living_room',
      poly: [[0.01, 0.01], [0.02, 0.01], [0.02, 0.02], [0.01, 0.02]] });
  }
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) =>
    s.id !== 'f1' ? s : { ...s, rooms: [...s.rooms, ...extra] }) };
  c._cfgEpoch++;
  c.hass = fresh(); await c.updateComplete;
  scans = 0;
  c.hass = fresh(); await c.updateComplete;
  out.roomCount = c._spaceModel('f1').rooms.length;
  out.scansSameWith44Rooms = scans === fewRooms;
  out.scansPerUpdate = scans;

  // при этом новое состояние датчика обязано быть видно, а не взято из кэша
  out.tempBefore = c._climate().get('living_room')?.temp;
  const h = fresh();
  h.states = { ...h.states, 'sensor.living_temp': { ...h.states['sensor.living_temp'], state: '33.3' } };
  c.hass = h; await c.updateComplete;
  out.tempAfter = c._climate().get('living_room')?.temp;
  out.climateIsMap = c._climate() instanceof Map;
  return out;
});
// зафиксировано прогоном на v1.45.0 и сверено с кодом.
// scansPerUpdate = 1: active-registry projection is shared by the climate map
// and buildDevices. Важно
// не само число, а что оно не растёт вместе с числом комнат.
checkAll(res, {
  scansOnRerender: 0,
  roomCount: 44,
  scansSameWith44Rooms: true,
  scansPerUpdate: 1,
  tempBefore: 22.4,
  tempAfter: 33.3,
  climateIsMap: true,
});
await finish(browser);
