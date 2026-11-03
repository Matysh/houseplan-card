/** #1242 Cached config + fast summary + delayed server must retain saved zoom. */
import { launchColdView, requirePinnedBrowser, checkAll, finish } from './serve.mjs';
requirePinnedBrowser('#1242 cold saved summary camera');
const { page, browser } = await launchColdView({ width: 1280, height: 920 }, 1, [], {}, undefined, undefined,
  '/demo.html?panel-cold=1&external-screens=1', false);
const out = await page.evaluate(async () => {
  const out = {}, sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const until = async (probe, label) => { const end = performance.now() + 12000;
    while (!probe()) { if (performance.now() > end) throw Error('#1242 saved camera: ' + label); await sleep(20); } };
  const hass = window.__mkHass(), call = hass.callWS.bind(hass);
  const initial = await call({ type: 'houseplan/config/get' }), layout = await call({ type: 'houseplan/layout/get' });
  initial.config.settings = { ...initial.config.settings, center_summary: true,
    summary_panel: { version: 1, title: 'Cached summary', show_on_mobile: true, blocks: [{
      id: 'b', title: 'Readout', visible: true, scope: { type: 'all' }, values: [{
        id: 'v', label: 'Clock', source: { type: 'system', key: 'datetime' } }],
    }] } };
  const rev = window.__pushServerConfig(initial.config);
  localStorage.setItem('houseplan_card_cfg_v1', JSON.stringify({ config: initial.config, rev,
    layout: layout.layout, layout_rev: layout.rev }));
  const saved = JSON.stringify(Object.fromEntries(initial.config.spaces.map(space => [space.id, 1.5])));
  localStorage.setItem('houseplan_card_zoom_v1', saved);
  const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
  let zoomWrites = 0, configReads = 0;
  Storage.prototype.getItem = function(key) { return key.startsWith('houseplan.summary-panel.v1:')
    ? JSON.stringify({ version: 1, show: true, icon_scale: 1, font_scale: 1 }) : get.call(this, key); };
  Storage.prototype.setItem = function(key, value) { if (key === 'houseplan_card_zoom_v1') zoomWrites++; return set.call(this, key, value); };
  hass.callWS = async message => { if (message.type === 'houseplan/config/get') { configReads++; await sleep(2000); } return call(message); };
  history.replaceState(null, '', '/houseplan');
  const host = document.getElementById('host'); host.style.cssText = 'width:100%;height:100vh;margin:0;padding:0';
  const panel = document.createElement('houseplan-panel'); panel.hass = hass; panel.narrow = false;
  panel.panel = { component_name: 'houseplan-panel' }; panel.route = { prefix: '/houseplan', path: '' }; host.replaceChildren(panel);
  await import('/assets/houseplan-panel.js');
  await until(() => panel.shadowRoot?.querySelector('houseplan-card')?._screenReference, 'first reference');
  const c = panel.shadowRoot.querySelector('houseplan-card');
  out.summaryReferencePrecedesServer = configReads > 0 && !c._loadOk && c._viewRuntimes.summary.state === 'ready';
  out.cachedFirstCameraKeepsSavedZoom = Math.abs(c._zoom - 1.5) < 1e-8;
  out.firstReferenceDoesNotWritePreference = zoomWrites === 0 && localStorage.getItem('houseplan_card_zoom_v1') === saved;
  await until(() => c._loadOk && !c._screenReferencePending && !c._booting && c._continuity.state === 'steady', 'server adoption');
  out.authoritativeCameraKeepsSavedZoom = Math.abs(c._zoom - 1.5) < 1e-8;
  out.serverRestoreDoesNotWritePreference = zoomWrites === 0 && localStorage.getItem('houseplan_card_zoom_v1') === saved;
  c._fitAll(); await until(() => !c._screenFitRequest && !c._cameraTransition.active, 'explicit Fit all');
  out.explicitFitStillPersists = zoomWrites > 0 && Math.abs(JSON.parse(localStorage.getItem('houseplan_card_zoom_v1'))[c._space] - c._zoom) < 1e-8;
  const beforeAuto = localStorage.getItem('houseplan_card_zoom_v1'), writesBeforeAuto = zoomWrites;
  c.renderRoot.querySelector('[data-hp="summary-toggle"]').click();
  await until(() => !c.renderRoot.querySelector('.summary-overlay:not([inert])'), 'hide summary'); await sleep(250);
  out.automaticFollowDoesNotWritePreference = zoomWrites === writesBeforeAuto && localStorage.getItem('houseplan_card_zoom_v1') === beforeAuto;
  Storage.prototype.getItem = get; Storage.prototype.setItem = set;
  return out;
});
checkAll(out); await finish(browser, out);
