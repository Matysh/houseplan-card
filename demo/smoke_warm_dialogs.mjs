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
  const rect = (c) => (c._view ? [c._view.x, c._view.y, c._view.w, c._view.h] : null);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  /** покадрово: ни один кадр после пересоздания не отличается от эталона */
  const watchView = async (c, zoom0, v0, ms = 700) => {
    const bad = [];
    const t1 = performance.now();
    await new Promise((done) => {
      const s = () => {
        if (Math.abs(c._zoom - zoom0) > 1e-6 || !same(rect(c), v0)) {
          bad.push({ t: Math.round(performance.now() - t1), zoom: c._zoom, v: rect(c) });
        }
        if (performance.now() - t1 < ms) requestAnimationFrame(s); else done();
      };
      requestAnimationFrame(s);
    });
    return bad.length === 0 ? true : `кадр ${bad[0].t}мс: zoom=${bad[0].zoom} view=${JSON.stringify(bad[0].v)} (ждали ${zoom0} / ${JSON.stringify(v0)})`;
  };

  // ================= A. просмотр: пан+зум и настройки пространства ==========
  let c = mk();
  await settle(c);
  c._applyView(2.4, 260, 720);            // зум в угол — вид точно не по центру
  c._saveZoom();
  c.requestUpdate(); await c.updateComplete; await sleep(100);
  const zoomA = c._zoom, viewA = rect(c);
  out.aPanned = viewA[0] > 1 || viewA[1] > 1;      // sanity: вид действительно смещён
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
  c._setMode('devices'); await c.updateComplete; await sleep(120);
  c._applyView(3.4, 430, 380); c.requestUpdate(); await c.updateComplete; await sleep(100);
  const zoomB = c._zoom, viewB = rect(c);
  const dev = c._devices.find((d) => d.space === c._space);
  c._openMarkerDialog(dev); await c.updateComplete;
  c._markerDialog = { ...c._markerDialog, name: 'ИМЯ-ЧЕРНОВИК' };
  await c.updateComplete;
  out.bDialogOpenBefore = !!c._markerDialog;

  c.remove(); await sleep(20);
  c = mk();
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
  c._alignDialog = { report: { moved: 3, maxShiftCm: 2, maxSpace: c._space }, spaces: [], layout: {}, cm: 2, where: '', busy: false };
  await c.updateComplete;
  out.dAlignOpenBefore = !!c._alignDialog;
  c.remove(); await sleep(20);
  c = mk(); await sleep(120); await c.updateComplete; await sleep(60);
  out.dAlignNotRevived = !c._alignDialog;

  // ================= E. реальный уход с маршрута завершает редактор =======
  c._setMode('devices'); await c.updateComplete; await sleep(60);
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
