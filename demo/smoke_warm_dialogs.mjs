// DEV-B703-03: «карточка перезагружается при возврате на вкладку» — часть 2.
// Тёплый ре-маунт (v1.58.0) убрал вуаль, но не сохранял ни ПАН, ни зум
// редактора, ни открытые диалоги: Lovelace пересоздаёт элемент, состояние
// диалога живёт в экземпляре и умирает вместе с ним. Смок воспроизводит
// пересоздание (remove + create на той же странице) и требует:
//   1) вид восстановлен БИТ-В-БИТ — ни один кадр не отличается от прежнего;
//   2) открытый диалог пережил пересоздание вместе с черновиком;
//   3) осознанно закрытый (Esc) — НЕ воскресает;
//   4) подтверждение «Выровнять всё» — НЕ воскресает никогда;
//   5) воскрешение одноразовое: третий экземпляр диалога уже не видит.
// ПАДАЕТ на сборке до DEV-B703-03 (вид рецентрировался, диалоги терялись).
import { launch, check, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 820, height: 760 });

const res = await page.evaluate(async () => {
  const out = {};
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  customElements.get('houseplan-card')?._warmBootReset?.();
  localStorage.removeItem('houseplan_card_zoom_v1');
  localStorage.removeItem('houseplan_card_nav_v1');

  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;left:0;top:0;width:800px;z-index:99;background:#000';
  document.body.appendChild(wrap);
  const mk = () => {
    const c = document.createElement('houseplan-card');
    c.setConfig({ type: 'custom:houseplan-card' }); // Lovelace: setConfig ДО вставки
    c.hass = window.__mkHass();
    wrap.appendChild(c);
    return c;
  };
  const settle = async (c) => {
    const t0 = performance.now();
    while (c._booting && performance.now() - t0 < 2500) await sleep(30);
    await sleep(350);
  };
  const waitFor = async (predicate, timeout = 2500) => {
    const started = performance.now();
    while (!predicate() && performance.now() - started < timeout) await sleep(20);
    return predicate();
  };
  const rect = (c) => (c._view ? [c._view.x, c._view.y, c._view.w, c._view.h] : null);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  /** The source instance must contribute its final painted viewport to the
   * memo. Lazy editor chrome can deliver ResizeObserver after updateComplete;
   * a fixed sleep occasionally captured that intermediate box and then asked
   * the successor to preserve something the source itself would not keep. */
  const waitForStableView = async (c, quietMs = 250, timeout = 2500) => {
    const started = performance.now();
    let stableAt = started;
    let previous = '';
    while (performance.now() - started < timeout) {
      await new Promise((done) => requestAnimationFrame(done));
      const stage = (c.shadowRoot || c.renderRoot).querySelector('.stage');
      const current = JSON.stringify({
        mode: c._mode,
        busy: c._modeTransitionBusy,
        stage: stage ? [stage.clientWidth, stage.clientHeight] : null,
        zoom: c._zoom,
        view: rect(c),
      });
      if (current !== previous) { previous = current; stableAt = performance.now(); }
      if (performance.now() - stableAt >= quietMs) return true;
    }
    return false;
  };
  /** покадрово: ни один кадр после пересоздания не отличается от эталона */
  const watchView = async (c, zoom0, v0, ms = 700) => {
    const bad = [];
    const t1 = performance.now();
    await new Promise((done) => {
      const s = () => {
        if (Math.abs(c._zoom - zoom0) > 1e-6 || !same(rect(c), v0)) {
          const stage = (c.shadowRoot || c.renderRoot).querySelector('.stage');
          const chrome = (c.shadowRoot || c.renderRoot).querySelector('.editorchrome');
          bad.push({
            t: Math.round(performance.now() - t1), zoom: c._zoom, v: rect(c),
            stage: stage ? [stage.clientWidth, stage.clientHeight] : null,
            chrome: chrome ? [chrome.clientWidth, chrome.clientHeight, chrome.scrollHeight] : null,
            hdrH: c._hdrH,
            transition: [c._modeTransitionPreparing, c._modeTransitionBusy],
            memo: c._warmSlot ? [c._warmSlot.hdrH, c._warmSlot.stageH] : null,
          });
        }
        if (performance.now() - t1 < ms) requestAnimationFrame(s); else done();
      };
      requestAnimationFrame(s);
    });
    return bad.length === 0 ? true : `кадр ${bad[0].t}мс: ${JSON.stringify(bad[0])} (ждали zoom=${zoom0} view=${JSON.stringify(v0)})`;
  };

  // ================= A. просмотр: пан+зум и настройки пространства ==========
  let c = mk();
  await settle(c);
  c._applyView(2.4, 260, 720);            // зум в угол — вид точно не по центру
  c._saveZoom();
  c.requestUpdate(); await c.updateComplete;
  out.aSourceSettled = await waitForStableView(c);
  const zoomA = c._zoom, viewA = rect(c);
  out.aPanned = viewA[0] > 1 || viewA[1] > 1;      // sanity: вид действительно смещён
  await c._ensureEditorRuntime();
  c._openSpaceDialog('edit', c._space); await c.updateComplete;
  c._spaceDialog = { ...c._spaceDialog, title: 'ЧЕРНОВИК-42' }; // недосохранённая правка
  await c.updateComplete;
  out.aDialogOpenBefore = !!c._spaceDialog;

  c.remove(); await sleep(20);            // ← Lovelace выбрасывает элемент
  c = mk();                               // ← и создаёт новый
  out.aViewBitExact = await watchView(c, zoomA, viewA);
  out.aDialogSurvived = !!c._spaceDialog;
  out.aDraftSurvived = c._spaceDialog?.title === 'ЧЕРНОВИК-42';
  out.aStillSameSpaceMode = c._mode === 'view';

  // ---- воскрешение одноразовое: ещё одно пересоздание диалог не вернёт ----
  c._spaceDialog = null; await c.updateComplete;   // (осознанно закрыли)
  c.remove(); await sleep(20);
  c = mk(); await sleep(120); await c.updateComplete; await sleep(60);
  out.aNoZombieAfterClose = !c._spaceDialog;

  // ================= B. редактор устройств: зум редактора + карточка =======
  await c._requestMode('devices'); await c.updateComplete;
  await waitFor(() => !c._modeTransitionBusy);
  c._applyView(3.4, 430, 380); c.requestUpdate(); await c.updateComplete;
  out.bSourceSettled = await waitForStableView(c);
  const zoomB = c._zoom, viewB = rect(c);
  const dev = c._devices.find((d) => d.space === c._space);
  c._openMarkerDialog(dev); await c.updateComplete;
  c._markerDialog = { ...c._markerDialog, name: 'ИМЯ-ЧЕРНОВИК' };
  await c.updateComplete;
  out.bDialogOpenBefore = !!c._markerDialog;

  c.remove(); await sleep(20);
  c = mk();
  await waitFor(() => c._mode === 'devices' && !!c._markerDialog);
  await c.updateComplete;
  out.bModeRestored = c._mode === 'devices';
  out.bViewBitExact = await watchView(c, zoomB, viewB);
  out.bDialogSurvived = !!c._markerDialog;
  out.bDraftSurvived = c._markerDialog?.name === 'ИМЯ-ЧЕРНОВИК';

  // ================= C. Esc = осознанное закрытие ==========================
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await c.updateComplete; await sleep(30);
  out.cClosedByEsc = !c._markerDialog;
  c.remove(); await sleep(20);
  c = mk(); await sleep(120); await c.updateComplete; await sleep(60);
  out.cNoResurrectionAfterEsc = !c._markerDialog;

  // ================= D. «Выровнять всё» не воскресает НИКОГДА ==============
  c._setMode('view'); await c.updateComplete; await sleep(60);
  // Use the production preview instead of a partial synthetic report: report
  // fields grow with the optimizer contract and the dialog renders all of them.
  c._openAlignDialog();
  await c.updateComplete;
  out.dAlignOpenBefore = !!c._alignDialog;
  c.remove(); await sleep(20);
  c = mk(); await sleep(120); await c.updateComplete; await sleep(60);
  out.dAlignNotRevived = !c._alignDialog;

  // ================= E. реальный уход с маршрута завершает редактор =======
  await c._requestMode('devices'); await c.updateComplete; await sleep(60);
  const returnUrl = `${location.pathname}${location.search}${location.hash}`;
  const returnSpace = c._space;
  const routeDev = c._devices.find((d) => d.space === returnSpace);
  c._openMarkerDialog(routeDev); await c.updateComplete;
  history.pushState({}, '', '/__houseplan-away__');
  window.dispatchEvent(new CustomEvent('location-changed'));
  await c.updateComplete;
  out.eLiveDepartureEndsEditor = c._mode === 'view' && !c._markerDialog;
  c.remove(); await sleep(20);
  history.replaceState({}, '', returnUrl);
  c = mk(); await sleep(120); await c.updateComplete; await sleep(60);
  out.eWarmReturnKeepsOnlySpace = c._space === returnSpace
    && c._mode === 'view' && !c._markerDialog;

  c.remove(); wrap.remove();
  return out;
});
for (const [k, v] of Object.entries(res)) check(k, v);
await finish(browser, res);
