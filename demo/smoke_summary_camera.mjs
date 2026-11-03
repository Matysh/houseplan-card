/** #1242 Ordinary View reuses the profile camera without becoming a kiosk. */
import { launchColdView, requirePinnedBrowser, checkAll, finish } from './serve.mjs';
requirePinnedBrowser('#1242 ordinary summary camera');
const { page, browser } = await launchColdView({ width: 1280, height: 920 }, 1, [], {}, undefined, undefined,
  '/demo.html?panel-cold=1&external-screens=1', false);
const out = await page.evaluate(async () => {
  const out = {}, sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const until = async (probe, label) => {
    const end = performance.now() + 15000;
    while (performance.now() < end) { if (probe()) return; await sleep(20); }
    const c = window.__summaryCameraCard;
    throw Error('#1242 ' + label + ' ' + JSON.stringify(c && { size: [c._stageEl?.clientWidth, c._stageEl?.clientHeight],
      mode: c._mode, pending: c._screenReferencePending, fit: c._screenFitRequest, reference: c._screenReference,
      geometry: c._summary?.screenGeometry(true) }));
  };
  const hass = window.__mkHass(), initial = await hass.callWS({ type: 'houseplan/config/get' });
  initial.config.settings ||= {};
  initial.config.settings.summary_panel = { version: 1, title: 'Synthetic summary', show_on_mobile: true, blocks: [{
    id: 'b', title: 'State', visible: true, scope: { type: 'all' }, values: [{ id: 'v', label: 'Value',
      source: { type: 'entity', entity_id: 'sensor.profile_value' } }],
  }] };
  hass.states = { ...hass.states, 'sensor.profile_value': { state: '1', attributes: { friendly_name: 'Camera test' } } };
  window.__pushServerConfig(initial.config);
  const host = document.getElementById('host'); host.style.cssText = 'width:100%;height:100vh;margin:0;padding:0';
  const panel = document.createElement('houseplan-panel'); panel.hass = hass; panel.narrow = false;
  panel.panel = { component_name: 'houseplan-panel' }; panel.route = { prefix: '/houseplan', path: '' };
  history.replaceState(null, '', '/houseplan'); host.replaceChildren(panel);
  await import('/assets/houseplan-panel.js');
  await until(() => panel.shadowRoot?.querySelector('houseplan-card')?._loadOk, 'ordinary load');
  const c = panel.shadowRoot.querySelector('houseplan-card'); window.__summaryCameraCard = c;
  await until(() => !c._booting && c._continuity.state === 'steady', 'ordinary settled');
  const root = c.renderRoot, stable = () => JSON.stringify({ view: c._view, zoom: c._zoom });
  const disabledCamera = stable(); root.querySelector('[data-hp="summary-toggle"]').click();
  await until(() => root.querySelector('.summary-overlay:not([inert])'), 'summary visible');
  await sleep(250);
  out.defaultOffAndNoReference = !c._settings.center_summary && !c._usesScreenCamera && !c._screenReference;
  out.defaultOffDoesNotMoveCamera = stable() === disabledCamera;
  const open = async () => { root.querySelector('[data-hp="settings"]').click();
    await until(() => root.querySelector('#gs-center-summary'), 'setting'); };
  await open();
  const field = root.querySelector('#gs-center-summary');
  out.settingAfterVolumetricAndDefaultOff = !field.checked
    && [...root.querySelectorAll('#gs-volumetric-view,#gs-center-summary')].map(n => n.id).join(',') === 'gs-volumetric-view,gs-center-summary';
  field.click(); await c.updateComplete;
  out.draftDoesNotApply = !c._settings.center_summary && c._settingsDialog.centerSummary;
  // Discard through the normal cancel confirmation.
  root.querySelector('hp-dialog[data-kind="settings"] [data-hp="dialog-cancel"]').click();
  await until(() => root.querySelector('hp-confirm hp-dialog [data-hp="dialog-confirm"]'), 'discard confirmation');
  root.querySelector('hp-confirm hp-dialog [data-hp="dialog-confirm"]').click();
  await until(() => !c._settingsDialog, 'discard');
  out.cancelPreservesOff = !c._settings.center_summary;
  await open(); root.querySelector('#gs-center-summary').click(); await c.updateComplete;
  root.querySelector('hp-dialog[data-kind="settings"] [data-hp="dialog-confirm"]').click();
  await until(() => c._settings.center_summary === true && !c._settingsDialog && c._screenReference, 'saved setting');
  await sleep(300);
  out.saveEnablesWithoutKiosk = c._usesScreenCamera && !c._kiosk && c._externalScreen.profile === undefined;
  const centered = (panelVisible = true, fit = true) => {
    const s = c._stageEl.getBoundingClientRect(), p = root.querySelector('.summary-overlay:not([inert])')?.getBoundingClientRect();
    const side = s.width >= s.height ? 'right' : 'bottom';
    const w = panelVisible && p && side === 'right' ? p.left - s.left : s.width;
    const h = panelVisible && p && side === 'bottom' ? p.top - s.top : s.height;
    const vb = c._baseVb(), b = c._displayBase(vb), v = c._viewOr(vb), ppu = s.width / v.w;
    return (!fit || Math.abs(ppu / Math.min(w / b.w, h / b.h) - 1) < .0001)
      && Math.abs((b.x + b.w / 2 - v.x) * ppu - w / 2) < 1
      && Math.abs((b.y + b.h / 2 - v.y) * ppu - h / 2) < 1;
  };
  window.__summaryCameraCentered = centered;
  const fit = async () => { c._fitAll(); await until(() => !c._screenFitRequest && !c._cameraTransition.active, 'fit all'); await sleep(50); };
  window.__summaryCameraFit = fit;
  await fit(); out.rightSummaryFits = centered() && c._zoomBadge.percent === 100;
  out.rotationsFlat = true;
  for (const rotation of [90, 180, 270, 0]) {
    root.querySelector('[data-hp="rotate-right"]').click();
    await until(() => c._rotation === rotation && !c._rotationMotion.active, 'rotation ' + rotation);
    await fit(); out.rotationsFlat &&= centered();
  }
  const before = stable(), reference = c._screenReference;
  c.hass = { ...c.hass, states: { ...c.hass.states, 'sensor.profile_value': { state: '123456789012345678901234567890', attributes: {} } } };
  await c.updateComplete; await sleep(100);
  out.valuesDoNotMoveCamera = stable() === before && c._screenReference === reference;
  c._view = { ...c._view, x: c._view.x + 50 }; c.requestUpdate(); await c.updateComplete;
  const manual = { ...c._view }; root.querySelector('[data-hp="summary-toggle"]').click();
  await until(() => !root.querySelector('.summary-overlay:not([inert])'), 'summary hidden'); await sleep(250);
  out.hidePreservesManualCamera = ['x', 'y', 'w', 'h'].every(key => Math.abs(c._view[key] - manual[key]) < 1e-7);
  await fit(); out.hiddenPanelFitsFullStage = centered(false);
  root.querySelector('[data-hp="summary-toggle"]').click();
  await until(() => root.querySelector('.summary-overlay:not([inert])'), 'summary shown'); await sleep(250);
  await fit();
  const savedZoom = c._zoom * 1.5; c._zoomBySpace[c._space] = savedZoom; c._restoreZoom();
  await until(() => !c._screenReferencePending && !c._cameraTransition.active, 'saved zoom');
  out.restoreSavedScalarAndFreeCenter = Math.abs(c._zoom - savedZoom) < 1e-8 && centered(true, false);
  await c._requestMode('devices', false);
  await until(() => c._mode === 'devices' && !c._modeTransitionBusy, 'devices editor');
  c._view = { ...c._view, x: c._view.x + 50 }; c.requestUpdate(); await c.updateComplete;
  const editorCenter = { x: c._view.x + c._view.w / 2, y: c._view.y + c._view.h / 2 };
  await c._requestMode('view', false);
  await until(() => c._mode === 'view' && !c._modeTransitionBusy, 'return to View'); await sleep(250);
  out.editorHandoffDoesNotRefit = Math.abs(c._view.x + c._view.w / 2 - editorCenter.x) < 1e-7
    && Math.abs(c._view.y + c._view.h / 2 - editorCenter.y) < 1e-7;
  await fit();
  return out;
});
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForFunction(() => { const c = window.__summaryCameraCard;
  return c._screenReference?.size[0] === 390 && c.renderRoot.querySelector('.summary-overlay.bottom:not([inert])'); });
out.bottomSummaryFits = await page.evaluate(async () => { await window.__summaryCameraFit(); return window.__summaryCameraCentered(); });
await page.evaluate(async () => {
  const c = window.__summaryCameraCard, cfg = structuredClone(c._serverCfg); cfg.settings.volumetric_view = true;
  window.__pushServerConfig(cfg); await c._ensureIsoSceneRuntime();
});
await page.waitForFunction(() => window.__summaryCameraCard.renderRoot.querySelector('.stage.projection-iso'));
out.isometricBottomFits = await page.evaluate(async () => { await window.__summaryCameraFit(); return window.__summaryCameraCentered(); });
out.isometricRotationsFit = await page.evaluate(async () => {
  const c = window.__summaryCameraCard, sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  let result = true;
  for (let turn = 0; turn < 4; turn++) {
    c.renderRoot.querySelector('[data-hp="rotate-right"]').click();
    await sleep(350); await window.__summaryCameraFit(); result &&= window.__summaryCameraCentered();
  }
  return result;
});
await page.setViewportSize({ width: 250, height: 600 });
await page.waitForFunction(() => !window.__summaryCameraCard.renderRoot.querySelector('.summary-overlay:not([inert])'));
out.unfittedPanelReservesNoSpace = await page.evaluate(async () => { await window.__summaryCameraFit(); return window.__summaryCameraCentered(false); });
await page.setViewportSize({ width: 1280, height: 920 });
out.warmRemountKeepsManualCamera = await page.evaluate(async () => {
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const until = async probe => { const end = performance.now() + 10000;
    while (!probe()) { if (performance.now() > end) throw Error('#1242 warm remount timeout'); await sleep(20); } };
  const old = window.__summaryCameraCard;
  await until(() => old._screenReference?.size[0] === 1280);
  old._view = { ...old._view, x: old._view.x + 75 }; old.requestUpdate(); await old.updateComplete;
  await sleep(350); old._warmSnapshot();
  const view = { ...old._view }, config = { ...old._config }, hass = old.hass, parent = old.parentNode;
  old.remove();
  const next = document.createElement('houseplan-card'); next.setConfig(config); next.hass = hass; parent.appendChild(next);
  await until(() => next._loadOk && next._screenReference && !next._booting && next._continuity.state === 'steady');
  await sleep(250);
  return ['x', 'y', 'w', 'h'].every(key => Math.abs(next._view[key] - view[key]) < 1e-7);
});
checkAll(out); await finish(browser, out);
