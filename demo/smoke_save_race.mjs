import { launch } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sent = [];
  // перехват WS: config/set логируем, config/get отдаёт "серверную" копию БЕЗ локальной правки
  const server = { cfg: JSON.parse(JSON.stringify(c._serverCfg)), rev: c._cfgRev };
  c.hass = { ...c.hass, callWS: async (msg) => {
    if (msg.type === 'houseplan/config/set') {
      sent.push(JSON.parse(JSON.stringify(msg.config)));
      server.cfg = JSON.parse(JSON.stringify(msg.config));
      server.rev = (msg.expected_rev ?? server.rev) + 1;
      return { rev: server.rev };
    }
    if (msg.type === 'houseplan/config/get') return { config: JSON.parse(JSON.stringify(server.cfg)), rev: server.rev };
    return {};
  } };
  await c.updateComplete;
  // локальная правка (как разметка комнаты) + дебаунс
  const sp = c._curSpaceCfg;
  sp.rooms.push({ id: 'race_room', name: 'RACE', area: null, poly: [[0.8, 0.8], [0.9, 0.8], [0.9, 0.9], [0.8, 0.9]] });
  c._saveConfig();
  out.pending = c._saveConfigDebounced.pending();
  // через 100 мс приходит событие о чужой ревизии — раньше это стирало правку
  c._cfgRev = server.rev; // симулируем: наша ревизия отстала
  await c._reloadConfigOnly();
  await new Promise((r) => setTimeout(r, 900));
  // правка обязана уцелеть и уйти на сервер
  out.editSent = sent.some((cf) => cf.spaces.some((s) => s.rooms?.some((r) => r.id === 'race_room')));
  out.editInMemory = c._serverCfg.spaces.some((s) => s.rooms?.some((r) => r.id === 'race_room'));
  out.serverHasIt = server.cfg.spaces.some((s) => s.rooms?.some((r) => r.id === 'race_room'));
  return out;
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
