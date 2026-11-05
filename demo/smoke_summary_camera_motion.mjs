/** #1254: native panel toggle, real camera frames and pointer projection. */
import { launchColdView, requirePinnedBrowser, checkAll, finish } from './serve.mjs';
requirePinnedBrowser('#1254 summary camera motion');
const { page, browser } = await launchColdView({ width: 1280, height: 920 }, 1, [], {}, undefined, undefined,
  '/demo.html?panel-cold=1&external-screens=1', false);
await page.evaluate(async () => {
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const until = async probe => { const end = performance.now() + 15000;
    while (!probe()) { if (performance.now() > end) throw Error('#1254 setup/transition timeout'); await sleep(5); } };
  const hass = window.__mkHass(), initial = await hass.callWS({ type: 'houseplan/config/get' });
  initial.config.settings = { ...initial.config.settings, center_summary: true,
    summary_panel: { version: 1, title: 'Synthetic summary', show_on_mobile: true, blocks: [{
      id: 'b', title: 'State', visible: true, scope: { type: 'all' }, values: [{
        id: 'v', label: 'Devices', source: { type: 'system', key: 'device_count' } }],
    }] } };
  window.__pushServerConfig(initial.config);
  history.replaceState(null, '', '/houseplan');
  const host = document.getElementById('host'); host.style.cssText = 'width:100%;height:100vh;margin:0;padding:0';
  const panel = document.createElement('houseplan-panel'); panel.hass = hass; panel.narrow = false;
  panel.panel = { component_name: 'houseplan-panel' }; panel.route = { prefix: '/houseplan', path: '' };
  host.replaceChildren(panel); await import('/assets/houseplan-panel.js');
  await until(() => panel.shadowRoot?.querySelector('houseplan-card')?._screenReference);
  const c = panel.shadowRoot.querySelector('houseplan-card');
  window.__motionCard = c; window.__motionUntil = until;
  await until(() => !c._booting && c._continuity.state === 'steady' && !c._cameraTransition.active);
  const same = (a, b) => Math.abs(a.zoom - b.zoom) < 1e-8
    && ['x', 'y', 'w', 'h'].every(k => Math.abs(a.viewBox[k] - b.viewBox[k]) < 1e-6);
  window.__motionSame = same;
  window.__motionToggle = async () => {
    const before = c._cameraState(), key = c._screenReferenceKey, samples = [];
    c.renderRoot.querySelector('[data-hp="summary-toggle"]').click();
    await until(() => c._screenReferenceKey !== key);
    let projection = true, duration = 0;
    while (c._cameraTransition.active) {
      const state = c._cameraTransition.state;
      samples.push(structuredClone(state.presented)); duration = state.duration;
      // The pointer reader must use the same world camera as the SVG scene.
      const stage = c._stageEl, r = stage.getBoundingClientRect(), x = r.width * .37, y = r.height * .41;
      const p = c._screenToVb(x, y), view = c._viewOr(c._baseVb());
      const expected = [view.x + x / r.width * view.w, view.y + y / r.height * view.h];
      // _screenToVb maps through the rendered SVG; at nonzero rotations its
      // canonical axes differ, so the ordinary unrotated path is checked here.
      if (!c._rotation && c._renderProjection === 'flat') projection &&= Math.hypot(p[0] - expected[0], p[1] - expected[1]) < 1e-5;
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
    const after = c._cameraState();
    return { smooth: samples.some(s => !same(s, before) && !same(s, after)),
      settled: same(after, c._screenReference.camera), projection, duration };
  };
});
const out = {};
for (const projection of ['flat', 'iso']) {
  await page.evaluate(async projection => {
    const c = window.__motionCard, cfg = structuredClone(c._serverCfg);
    cfg.settings.volumetric_view = projection === 'iso'; window.__pushServerConfig(cfg);
    if (projection === 'iso') await c._ensureIsoSceneRuntime();
    await window.__motionUntil(() => c._renderProjection === projection);
  }, projection);
  for (const [side, size] of [['right', { width: 1280, height: 920 }], ['bottom', { width: 390, height: 844 }]]) {
    await page.setViewportSize(size);
    await page.evaluate(async width => {
      const c = window.__motionCard;
      await window.__motionUntil(() => c._screenReference?.size[0] === width);
      c._fitAll(); await window.__motionUntil(() => !c._screenFitRequest && !c._cameraTransition.active);
    }, size.width);
    for (const rotation of [0, 90, 180, 270]) {
      await page.evaluate(async rotation => {
        const c = window.__motionCard;
        while (c._rotation !== rotation) {
          c.renderRoot.querySelector('[data-hp="rotate-right"]').click();
          await window.__motionUntil(() => !c._rotationMotion.active);
        }
        c._fitAll(); await window.__motionUntil(() => !c._screenFitRequest && !c._cameraTransition.active);
      }, rotation);
      const result = await page.evaluate(async () => {
        const c = window.__motionCard, saved = JSON.stringify(c._zoomBySpace);
        const a = await window.__motionToggle(), b = await window.__motionToggle();
        return { smooth: a.smooth && b.smooth, settled: a.settled && b.settled,
          projection: a.projection && b.projection, noSavedZoom: saved === JSON.stringify(c._zoomBySpace),
          timing: [a.duration, b.duration].sort().join(',') === '140,180' };
      });
      for (const [key, value] of Object.entries(result)) out[`${projection}_${side}_${rotation}_${key}`] = value;
    }
  }
}
Object.assign(out, await page.evaluate(async () => {
  const c = window.__motionCard, same = window.__motionSame, until = window.__motionUntil;
  const toggle = () => c.renderRoot.querySelector('[data-hp="summary-toggle"]').click();
  const original = c._cameraState(); toggle();
  await until(() => c._cameraTransition.active && !same(c._cameraState(), original));
  const first = c._cameraTransition.state, token = first.token; toggle();
  await until(() => c._cameraTransition.state?.token !== token);
  const second = c._cameraTransition.state;
  const reversalContinuesPresented = !!second && !same(second.from, first.from) && !same(second.from, first.to);
  await until(() => !c._cameraTransition.active);
  const final = c._cameraState(); await new Promise(resolve => setTimeout(resolve, 250));
  return { reversalContinuesPresented, reversalSettlesLatest: same(final, c._screenReference.camera),
    cancelledTargetCannotReturn: same(final, c._cameraState()) };
}));
await page.emulateMedia({ reducedMotion: 'reduce' });
out.reducedMotionIsAtomic = await page.evaluate(async () => {
  const c = window.__motionCard; await window.__motionUntil(() => c._reducedMotion);
  const key = c._screenReferenceKey; c.renderRoot.querySelector('[data-hp="summary-toggle"]').click();
  await window.__motionUntil(() => key !== c._screenReferenceKey);
  return !c._cameraTransition.active && window.__motionSame(c._cameraState(), c._screenReference.camera);
});
await page.emulateMedia({ reducedMotion: 'no-preference' });
await page.evaluate(async () => {
  const c = window.__motionCard; await window.__motionUntil(() => !c._reducedMotion);
  c.renderRoot.querySelector('[data-hp="summary-toggle"]').click();
  await window.__motionUntil(() => c._cameraTransition.active);
});
const stage = await page.evaluate(() => { const r = window.__motionCard._stageEl.getBoundingClientRect();
  return { x: r.x + r.width * .4, y: r.y + r.height * .4 }; });
await page.mouse.move(stage.x, stage.y); await page.mouse.wheel(0, -80);
Object.assign(out, await page.evaluate(async () => {
  const c = window.__motionCard; await window.__motionUntil(() => !c._cameraTransition.active);
  const manual = c._cameraState(), stoppedAutomatic = !c._screenCameraAutomatic;
  const key = c._screenReferenceKey; c.renderRoot.querySelector('[data-hp="summary-toggle"]').click();
  await window.__motionUntil(() => key !== c._screenReferenceKey);
  await new Promise(resolve => setTimeout(resolve, 250));
  return { wheelInterruptsAutomatic: stoppedAutomatic,
    manualCameraStaysManual: window.__motionSame(manual, c._cameraState()) };
}));
checkAll(out); await finish(browser, out);
