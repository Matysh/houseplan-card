import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  // AUD-159B6-06: the old hook `_computeOpenPairs` is gone. The observable
  // contract that still matters is the MODEL memo — a hass tick that changes
  // no geometry must not rebuild spaces (audit L1). Open-pair work is cheap
  // and may run once per paint; we only refuse a storm (>2× renders).
  let pairsCalls = 0, buildCalls = 0;
  const origPairs = c._openPairs.bind(c);
  c._openPairs = (...a) => { pairsCalls++; return origPairs(...a); };
  const origBuild = c._buildModel.bind(c);
  c._buildModel = (...a) => { buildCalls++; return origBuild(...a); };
  const sp = c._curSpaceCfg;
  const r1 = sp.rooms[0], r2 = sp.rooms[1];
  r1.open_to = [r2.id]; r2.open_to = [r1.id];
  c._saveConfig(); c.requestUpdate(); await c.updateComplete;
  pairsCalls = 0; buildCalls = 0;
  for (let i = 0; i < 10; i++) {
    c.hass = { ...c.hass, states: { ...c.hass.states } };
    await c.updateComplete;
  }
  out.pairsBounded = pairsCalls <= 20;
  out.modelBuildsPer10Renders = buildCalls;
  const before = pairsCalls;
  const r3 = sp.rooms[2] || sp.rooms[0];
  r3.open_to = [r1.id]; r1.open_to = [r2.id, r3.id];
  c._saveConfig(); c.requestUpdate(); await c.updateComplete;
  out.invalidatesOnEdit = pairsCalls > before;
  sp.settings = { ...(sp.settings || {}), show_borders: true };
  c._saveConfig(); c.requestUpdate(); await c.updateComplete;
  out.dashesStillRendered = (c.shadowRoot || c.renderRoot).querySelectorAll('.openwall').length > 0;
  return out;
});
checkAll(res, {
  modelBuildsPer10Renders: 0,
});
await finish(browser, res);
