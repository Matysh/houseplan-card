import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  // счётчики вызовов тяжёлой геометрии
  let pairsCalls = 0, buildCalls = 0;
  const origPairs = c._computeOpenPairs.bind(c);
  c._computeOpenPairs = (...a) => { pairsCalls++; return origPairs(...a); };
  const origBuild = c._buildModel.bind(c);
  c._buildModel = (...a) => { buildCalls++; return origBuild(...a); };
  // открыть границу, чтобы pairs было что считать
  const sp = c._curSpaceCfg;
  const r1 = sp.rooms[0], r2 = sp.rooms[1];
  r1.open_to = [r2.id]; r2.open_to = [r1.id];
  c._saveConfig(); c.requestUpdate(); await c.updateComplete;
  pairsCalls = 0; buildCalls = 0;
  // 10 «пушей состояния» от HA без изменения конфига
  for (let i = 0; i < 10; i++) {
    c.hass = { ...c.hass, states: { ...c.hass.states } };
    await c.updateComplete;
  }
  out.pairsPerRender = pairsCalls;      // должно быть 0: кэш живёт между рендерами
  out.modelBuildsPer10Renders = buildCalls;
  // правка конфига обязана инвалидировать кэш
  const before = pairsCalls;
  const r3 = sp.rooms[2] || sp.rooms[0];
  r3.open_to = [r1.id]; r1.open_to = [r2.id, r3.id];
  c._saveConfig(); c.requestUpdate(); await c.updateComplete;
  out.invalidatesOnEdit = pairsCalls > before;
  // геометрия по-прежнему правильная: пунктир на месте (нужны borders —
  // open walls follow show_borders since beta.3)
  sp.settings = { ...(sp.settings || {}), show_borders: true };
  c._saveConfig(); c.requestUpdate(); await c.updateComplete;
  out.dashesStillRendered = (c.shadowRoot || c.renderRoot).querySelectorAll('.openwall').length > 0;
  return out;
});
// значения зафиксированы прогоном на v1.43.1 и сверены с кодом (audit T1)
checkAll(res, {
  "pairsPerRender": 0,
  "modelBuildsPer10Renders": 0,
});
await finish(browser, res);
