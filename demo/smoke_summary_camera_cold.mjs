/** #1242 Do not reveal the full-stage camera before a delayed summary reference. */
import { launchColdView, requirePinnedBrowser, checkAll, finish } from './serve.mjs';
requirePinnedBrowser('#1242 delayed ordinary summary camera');
for (const failure of [false, true]) {
const { page, browser } = await launchColdView({ width: 1280, height: 920 }, 1, [], {}, undefined, undefined,
  '/demo.html?panel-cold=1&external-screens=1', false);
let delayed = false;
await page.route('**/summary-panel-runtime-entry-*.js', async route => {
  delayed = true; await new Promise(resolve => setTimeout(resolve, 2500));
  if (failure) await route.fulfill({ status: 503, contentType: 'text/javascript', body: 'Controlled summary chunk refusal' });
  else await route.fallback();
});
const out = await page.evaluate(async failure => {
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const hass = window.__mkHass(), initial = await hass.callWS({ type: 'houseplan/config/get' });
  initial.config.settings = { ...initial.config.settings, center_summary: true,
    summary_panel: { version: 1, title: 'Delayed summary', show_on_mobile: true, blocks: [{
      id: 'b', title: 'Readout', visible: true, scope: { type: 'all' }, values: [{
        id: 'v', label: 'Clock', source: { type: 'system', key: 'datetime' } }],
    }] } };
  window.__pushServerConfig(initial.config);
  // Supply an existing user's show preference while the real runtime is cold.
  // Save/Cancel and actual preference persistence use native controls in the sibling smoke.
  const get = Storage.prototype.getItem;
  Storage.prototype.getItem = function(key) { return key.startsWith('houseplan.summary-panel.v1:')
    ? JSON.stringify({ version: 1, show: true, icon_scale: 1, font_scale: 1 }) : get.call(this, key); };
  history.replaceState(null, '', '/houseplan');
  const host = document.getElementById('host'); host.style.cssText = 'width:100%;height:100vh;margin:0;padding:0';
  const panel = document.createElement('houseplan-panel'); panel.hass = hass; panel.narrow = false;
  panel.panel = { component_name: 'houseplan-panel' }; panel.route = { prefix: '/houseplan', path: '' }; host.replaceChildren(panel);
  await import('/assets/houseplan-panel.js');
  let exposed = false, missingReferenceFrames = 0;
  const end = performance.now() + 12000;
  while (performance.now() < end) {
    const c = panel.shadowRoot?.querySelector('houseplan-card'), veil = c?.renderRoot.querySelector('.bootveil');
    if (c?._loadOk && !c._booting && !c._screenReference) {
      missingReferenceFrames++;
      exposed ||= !veil || getComputedStyle(veil).opacity === '0';
    }
    if (c?._screenReference && !c._booting && c._continuity.state === 'steady') break;
    await sleep(25);
  }
  Storage.prototype.getItem = get;
  const c = panel.shadowRoot.querySelector('houseplan-card');
  await c.updateComplete; await new Promise(resolve => requestAnimationFrame(resolve));
  const s = c._stageEl.getBoundingClientRect(), p = c.renderRoot.querySelector('.summary-overlay:not([inert])')?.getBoundingClientRect();
  const vb = c._baseVb(), b = c._displayBase(vb), v = c._viewOr(vb), ppu = s.width / v.w;
  return { observedLateReference: missingReferenceFrames > 0, neverRevealedWrongCamera: !exposed,
    finalOrdinaryReferenceReady: !!c._screenReference && !c._kiosk && c._continuity.state === 'steady',
    boundaryOutcomeMatches: c._viewRuntimes.summary.unavailable === failure,
    finalVeilReleased: !c.renderRoot.querySelector('.bootveil:not(.off)'),
    finalPlanCenteredInExpectedArea: (failure ? !p : !!p)
      && Math.abs((b.x + b.w / 2 - v.x) * ppu - (failure ? s.width : p.left - s.left) / 2) < 1 };
}, failure);
out.delayedRealSummaryChunk = delayed;
const named = Object.fromEntries(Object.entries(out).map(([name, value]) => [`${failure ? 'refused' : 'delayed'}_${name}`, value]));
checkAll(named); await finish(browser, named);
}
