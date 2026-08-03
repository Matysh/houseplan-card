// DEV-B703-02: temporary WS failures must NEVER blank a plan that was already
// shown. On the build before the fix _loadFromServer's catch nulled
// _serverCfg after 8 failed tries — the plan disappeared even though a valid
// config (the LS snapshot) was on screen. Stale-while-revalidate: the last
// valid config lives until a successful reload replaces it, and once the
// socket recovers the card revalidates QUIETLY on its own retry clock
// (willUpdate stops driving loads after 8 tries).
// planSurvivesOutage + reloadedAfterRecovery FAIL on the pre-fix build.
import { launch, check, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 820, height: 760 });

const res = await page.evaluate(async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  customElements.get('houseplan-card')?._warmBootReset?.();
  // the LS snapshot is in place (the page's main card cached it): the new
  // instance renders instantly from it — a wall tablet rejoining wifi
  out.lsCachePresent = !!localStorage.getItem('houseplan_card_cfg_v1');

  let fail = true;
  let failedCalls = 0;
  const base = window.__mkHass();
  const mkFlaky = () => ({
    ...base,
    callWS: async (m) => {
      if (fail) { failedCalls++; throw new Error('ws down'); }
      return base.callWS(m);
    },
  });
  const c = document.createElement('houseplan-card');
  c.setConfig({ type: 'custom:houseplan-card' });
  c.hass = mkFlaky();
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;left:0;top:0;width:800px;z-index:99;background:#000';
  wrap.appendChild(c);
  document.body.appendChild(wrap);
  await sleep(50);
  out.rendersFromCache = !!c._serverCfg;

  // hass keeps ticking while the socket is down — drive past the 8-try budget
  for (let i = 0; i < 12; i++) {
    c.hass = mkFlaky();
    await sleep(60);
  }
  out.wsFailedEnough = failedCalls >= 8 ? true : `only ${failedCalls} failed calls`;
  out.planSurvivesOutage = c._serverCfg ? true : '_serverCfg was cleared by the outage';
  out.stillServerMode = c._serverStorage === true;
  const sr = () => c.shadowRoot || c.renderRoot;
  const stage = sr().querySelector('.stage');
  out.roomsStillRendered = !!stage && stage.querySelectorAll('.room').length > 0;

  // ---- the socket comes back: quiet self-driven revalidation ----
  fail = false;
  const t0 = performance.now();
  while (!c._loadOk && performance.now() - t0 < 12000) await sleep(100);
  out.reloadedAfterRecovery = c._loadOk === true ? true : 'never revalidated after recovery';
  out.cfgValidAfterRecovery = !!c._serverCfg && Array.isArray(c._serverCfg.spaces)
    && c._serverCfg.spaces.length > 0;
  wrap.remove();
  return out;
});
for (const [k, v] of Object.entries(res)) check(k, v);

// ---- a LIVE instance: a failing config reload keeps the last config ----
const live = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const before = c._serverCfg;
  const origHass = c.hass;
  c.hass = { ...c.hass, callWS: async () => { throw new Error('ws down'); } };
  await c._reloadConfigOnly(true);
  out.liveReloadFailKeepsCfg = c._serverCfg === before
    ? true : 'a failed reload replaced/cleared the live config';
  c.hass = origHass;
  return out;
});
for (const [k, v] of Object.entries(live)) check(k, v);

await finish(browser, { ...res, ...live });
