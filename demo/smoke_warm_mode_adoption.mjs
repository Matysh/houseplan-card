// #762: five independent witnesses against the actual card, including frames
// between permission delivery and editor chrome settling (not just the end).
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 820, height: 760 });
const res = await page.evaluate(async () => {
  const out = {};
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const root = (c) => c.shadowRoot || c.renderRoot;
  const rect = (c) => c._view && [c._view.x, c._view.y, c._view.w, c._view.h];
  const camera = (c) => ({ zoom: c._zoom, view: rect(c) });
  const points = (c) => {
    const matrix = root(c).querySelector('.plan-svg')?.getScreenCTM();
    return matrix && [[300, 300], [500, 500]].map(([x, y]) => {
      const p = new DOMPoint(x, y).matrixTransform(matrix);
      return [p.x, p.y];
    });
  };
  const wait = async (predicate, name) => {
    const end = performance.now() + 5000;
    while (!predicate() && performance.now() < end) await frame();
    if (!predicate()) throw new Error(name);
  };
  const stable = async (c) => {
    let last = '', quiet = 0;
    await wait(() => {
      const stage = root(c).querySelector('.stage');
      const value = JSON.stringify([camera(c), stage?.clientWidth, stage?.clientHeight, c._hdrH]);
      quiet = value === last && !c._modeTransitionBusy && !c._booting ? quiet + 1 : 0;
      last = value;
      return quiet >= 15;
    }, 'card camera did not settle');
  };
  const gate = () => {
    let resolve;
    const promise = new Promise((r) => { resolve = r; });
    return { promise, resolve };
  };
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;left:0;top:0;width:800px;z-index:99;background:#fff';
  document.body.appendChild(wrap);
  window.__card.remove();
  const mk = ({ permission, runtime, admin = true, writable = true, kiosk = false } = {}) => {
    const c = document.createElement('houseplan-card');
    c.setConfig({ type: 'custom:houseplan-card', ...(kiosk ? { kiosk: true } : {}) });
    const hass = window.__mkHass();
    c.hass = { ...hass, user: { ...hass.user, is_admin: admin }, callWS: async (m) => {
      if (m.type === 'houseplan/config/get' && permission) await permission.promise;
      const response = await hass.callWS(m);
      return m.type === 'houseplan/config/get' ? { ...response, can_write: writable } : response;
    } };
    if (runtime) {
      const ensure = c._ensureEditorRuntime.bind(c);
      c._ensureEditorRuntime = async () => { await runtime.promise; return ensure(); }; // private-ok: #762 delay the lazy-runtime boundary, execute the real installation afterwards
    }
    wrap.appendChild(c);
    window.__card = c;
    return c;
  };
  let c;
  const source = async () => {
    c?.remove();
    customElements.get('houseplan-card')._warmBootReset();
    localStorage.removeItem('houseplan_card_zoom_v1');
    localStorage.removeItem('houseplan_card_nav_v1');
    c = mk();
    await wait(() => !c._booting && c._loadOk, 'source boot');
    c._applyView(1.6, 290, 620); c._saveZoom(); c.requestUpdate();
    await stable(c);
    const view = camera(c);
    await window.__hpTest.setMode('devices');
    await wait(() => !c._modeTransitionBusy, 'source editor');
    c._applyView(3.4, 430, 380); c.requestUpdate();
    await stable(c);
    return { view, editor: camera(c), points: points(c) };
  };
  const remount = async (options) => {
    c.remove(); await sleep(20); c = mk(options);
    await c.updateComplete;
  };
  const watch = async (c, expected, expectedPoints, action) => {
    const bad = [];
    const pixelBad = [];
    const started = performance.now();
    let settledFrames = 0;
    action();
    do {
      await frame();
      if (JSON.stringify(camera(c)) !== JSON.stringify(expected)) bad.push(camera(c));
      const live = points(c);
      if (!live || live.some((p, i) => p.some((value, j) => Math.abs(value - expectedPoints[i][j]) > 1))) {
        pixelBad.push({ live, expected: expectedPoints, header: c._hdrH, stage: root(c).querySelector('.stage')?.clientHeight });
      }
      settledFrames = c._mode === 'devices' && !c._warmModeRequest && !c._modeTransitionBusy ? settledFrames + 1 : 0;
    } while (performance.now() - started < 5000 && (performance.now() - started < 800 || settledFrames < 5));
    if (settledFrames < 5) bad.push({ error: 'warm adoption did not settle for five frames' });
    return { camera: bad.length ? { frames: bad.length, first: bad[0], expected } : true,
      pixels: pixelBad.length ? { frames: pixelBad.length, first: pixelBad[0] } : true };
  };

  // AC1/2, without a dialog. Both install orders are intentional.
  for (const delayed of [false, true]) {
    const ref = await source();
    const permission = gate(), runtime = delayed ? gate() : null;
    await remount({ permission, runtime, admin: false });
    if (!runtime) await c._ensureEditorRuntime();
    out[`ac2-pending-${delayed}`] = c._pendingNavMode === 'devices' && !c._markerDialog;
    const watched = await watch(c, ref.editor, ref.points, () => {
      permission.resolve();
      if (runtime) setTimeout(runtime.resolve, 100);
    });
    out[`ac2-camera-${delayed}`] = watched.camera;
    out[`ac2-pixels-${delayed}`] = watched.pixels;
    await stable(c);
    out[`ac2-mode-${delayed}`] = c._mode === 'devices';
    await window.__hpTest.setMode('view'); await stable(c);
    const center = (view) => [view[0] + view[2] / 2, view[1] + view[3] / 2];
    out[`ac1-view-${delayed}`] = c._zoom === ref.view.zoom
      && center(rect(c)).every((value, i) => Math.abs(value - center(ref.view.view)[i]) < 0.001);
  }

  // AC3: observe each memo publication, not just a later already-correct pair.
  await source(); await window.__hpTest.setMode('view'); await stable(c);
  const pairs = [];
  const patch = c._warmPatch.bind(c);
  c._warmPatch = (...args) => { // private-ok: #762 observe real memo publications without replacing the layout/memo algorithm
    patch(...args);
    if (c._warmSlot) pairs.push([c._warmSlot.hdrH, c._warmSlot.stageH]);
  };
  const header = root(c).querySelector('.hdr');
  header.style.minHeight = `${header.getBoundingClientRect().height + 70}px`;
  window.dispatchEvent(new Event('resize'));
  await sleep(450); await stable(c);
  out.ac3HeightPair = pairs.length > 0 && pairs.every(([hdr, stage]) => Math.abs(hdr + stage - innerHeight) <= 1);
  out.ac3PairDiagnostic = out.ac3HeightPair || pairs;
  delete c._warmPatch; // private-ok: #762 remove the observation wrapper
  const lastPair = [c._warmSlot.hdrH, c._warmSlot.stageH];
  wrap.style.display = 'none'; window.dispatchEvent(new Event('resize')); await sleep(100);
  out.ac3ZeroSizePreservesPair = JSON.stringify([c._warmSlot.hdrH, c._warmSlot.stageH]) === JSON.stringify(lastPair);
  wrap.style.display = ''; window.dispatchEvent(new Event('resize')); await stable(c);
  c.layout = 'grid'; wrap.style.height = '600px'; c.requestUpdate();
  await c.updateComplete; await sleep(200); await stable(c);
  const gridPairs = [];
  c._warmPatch = (...args) => { // private-ok: #762 observe HA-owned dimensions through the same real publication boundary
    patch(...args);
    if (c._warmSlot) gridPairs.push([c._warmSlot.hdrH, c._warmSlot.stageH]);
  };
  root(c).querySelector('.hdr').style.minHeight = '270px';
  window.dispatchEvent(new Event('resize')); await sleep(250); await stable(c);
  out.ac3HaOwnedPair = gridPairs.length > 0 && gridPairs.every(([hdr, stage]) => Math.abs(hdr + stage - 600) <= 1);
  delete c._warmPatch; // private-ok: #762 remove the publication observer
  wrap.style.height = '';

  // AC4: grant admin after adoption; the real editor tab is available before
  // the authoritative server answer. Its click waits for the lazy runtime.
  for (const runtimeFirst of [false, true]) {
    await source();
    const permission = gate(), runtime = gate();
    await remount({ permission, runtime, admin: false });
    c.hass = { ...c.hass, user: { ...c.hass.user, is_admin: true } };
    await c.updateComplete;
    const button = root(c).querySelector('[data-hp="mode-tab"][data-mode="plan"]');
    out[`ac4-tab-present-${runtimeFirst}`] = !!button && c._pendingNavMode === 'devices';
    button?.click();
    if (runtimeFirst) { runtime.resolve(); await frame(); permission.resolve(); }
    else { permission.resolve(); await frame(); runtime.resolve(); }
    await sleep(600); await stable(c);
    out[`ac4-user-mode-${runtimeFirst}`] = c._mode === 'plan';
  }

  // AC5: real floor tab before can_write is known.
  await source();
  const permission = gate();
  await remount({ permission, admin: false });
  const other = c._model.find((sp) => sp.id !== c._space).id;
  await window.__hpTest.switchSpace(other);
  permission.resolve(); await sleep(700); await stable(c);
  out.ac5SpaceWins = c._space === other && c._mode === 'view' && !c._markerDialog;

  // AC6: immediate adoption still returns to the source View.
  const immediate = await source();
  await remount(); await wait(() => c._mode === 'devices', 'immediate mode'); await stable(c);
  out.ac6ImmediateCamera = JSON.stringify(camera(c)) === JSON.stringify(immediate.editor);
  await window.__hpTest.setMode('view'); await stable(c);
  out.ac6ImmediateView = c._zoom === immediate.view.zoom;

  await source();
  const denied = gate();
  await remount({ permission: denied, admin: false, writable: false });
  denied.resolve(); await sleep(500); await stable(c);
  out.ac6PermissionDenied = c._mode === 'view' && !c._warmModeRequest;

  const pannedRef = await source();
  const panPermission = gate();
  await remount({ permission: panPermission, admin: false });
  c._applyView(2.2, 510, 510); c.requestUpdate(); await c.updateComplete;
  panPermission.resolve(); await sleep(500); await stable(c);
  out.ac6NewCameraNotOverridden = c._zoom === 2.2 && JSON.stringify(camera(c)) !== JSON.stringify(pannedRef.editor);

  await source();
  const latePanPermission = gate(), latePanRuntime = gate();
  await remount({ permission: latePanPermission, runtime: latePanRuntime, admin: false });
  latePanPermission.resolve();
  await wait(() => c._warmModeRequest > 0, 'camera hold before runtime');
  c._applyView(2.2, 510, 510); c.requestUpdate(); await c.updateComplete;
  latePanRuntime.resolve(); await sleep(500); await stable(c);
  out.ac6PanDuringRuntimeReleasesHold = c._mode === 'devices' && c._zoom === 2.2 && !c._warmModeRequest;
  wrap.style.width = '720px'; await sleep(300); await stable(c);
  out.ac6PanDuringRuntimeAllowsResize = c._lastValidStageSize?.[0] === root(c).querySelector('.stage').clientWidth;
  wrap.style.width = '800px'; await sleep(300);

  await source();
  await remount({ kiosk: true }); await wait(() => c._loadOk, 'kiosk loaded');
  await c._requestMode('devices'); await sleep(200);
  out.ac6KioskDoesNotEnterEditor = c._mode === 'view';

  await source();
  const closePermission = gate(), closeRuntime = gate();
  await remount({ permission: closePermission, runtime: closeRuntime, admin: false });
  await c._requestMode('view');
  closePermission.resolve(); closeRuntime.resolve(); await sleep(500); await stable(c);
  out.ac6ViewCancelsPending = c._mode === 'view' && !c._pendingNavMode && !c._warmModeRequest;
  out.ac6ViewCancelsReservedHeader = !root(c).querySelector('.hdr').style.minHeight;

  await source();
  const detachRuntime = gate();
  await remount({ runtime: detachRuntime });
  const detached = c;
  detached.remove();
  detachRuntime.resolve(); await sleep(400);
  out.ac6DetachedDoesNotCommit = detached._mode === 'view' && !detached._warmModeRequest;
  c = mk(); await wait(() => !c._booting && c._loadOk, 'successor boot'); await stable(c);
  wrap.style.width = '720px';
  await sleep(400); await stable(c);
  out.ac6ResizeReleased = !c._warmModeRequest && c._lastValidStageSize?.[0] === root(c).querySelector('.stage').clientWidth;
  c.remove(); wrap.remove();
  return out;
});
// AC5 touch: a genuine browser tap, not a synthetic click or private method.
const touch = await launch({ width: 390, height: 844 }, 1, [], { hasTouch: true, isMobile: true });
const other = await touch.page.evaluate(async () => {
  const source = window.__card;
  const config = { ...source._config };
  await window.__hpTest.setMode('devices');
  await new Promise((resolve) => setTimeout(resolve, 500));
  const parent = source.parentElement;
  let release;
  const permission = new Promise((resolve) => { release = resolve; });
  source.remove();
  const c = document.createElement('houseplan-card');
  c.setConfig(config);
  const hass = window.__mkHass();
  c.hass = { ...hass, user: { ...hass.user, is_admin: false }, callWS: async (m) => {
    if (m.type === 'houseplan/config/get') await permission;
    return hass.callWS(m);
  } };
  parent.appendChild(c); window.__card = c;
  window.releaseWarmPermission = release;
  await c.updateComplete;
  if (c._pendingNavMode !== 'devices') throw new Error('touch fixture did not adopt a pending editor');
  return c._model.find((space) => space.id !== c._space).id;
});
await touch.page.locator(`houseplan-card [data-hp="space-tab"][data-id="${other}"]`).tap();
await touch.page.evaluate(() => window.releaseWarmPermission());
await touch.page.waitForFunction(() => window.__card._loadOk);
await touch.page.waitForTimeout(350);
res.ac5TouchSpaceWins = await touch.page.evaluate((other) => {
  const c = window.__card;
  return c._space === other && c._mode === 'view' && !c._pendingNavMode && !c._warmModeRequest;
}, other);
await touch.browser.close();
checkAll(res);
await finish(browser, res);
