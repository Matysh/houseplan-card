// v1.49.x: zoom goes below the base fit, the editor does not shift the plan.
// - the stage height follows the MEASURED header, not a hard-coded 118px, so
//   entering an editor keeps the plan inside the viewport;
// - zoom < 1 centres the content instead of pinning it to a corner;
// - the content frame (default zoom) includes devices standing outside rooms.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const out = {};

// -- editor entry keeps the stage inside the viewport --------------------
const stageBox = () => page.evaluate(() => {
  const sr = window.__card.shadowRoot || window.__card.renderRoot;
  const b = sr.querySelector('.stage').getBoundingClientRect();
  return { top: Math.round(b.top), bottom: Math.round(b.bottom) };
});
const vh = await page.evaluate(() => window.innerHeight);
const inView = await stageBox();
await page.evaluate(() => window.__card._setMode('plan'));
await page.waitForTimeout(400);
const inPlan = await stageBox();
out.viewFitsViewport = inView.bottom <= vh + 2;
out.editorFitsViewport = inPlan.bottom <= vh + 2; // used to overflow by ~90px
out.editorStageShrinks = inPlan.top > inView.top && inPlan.bottom <= inView.bottom + 2;
await page.evaluate(() => window.__card._setMode('view'));
await page.waitForTimeout(300);

// -- zoom out below the base fit -----------------------------------------
out.zoomOut = await page.evaluate(() => {
  const c = window.__card;
  c._resetZoom();
  const fit = { ...c._viewOr(c._baseVb()) };
  const stage = (c.shadowRoot || c.renderRoot).querySelector('.stage');
  c._zoomAt(stage.clientWidth / 2, stage.clientHeight / 2, 0.5);
  const v = { ...c._view };
  const base = c._baseVb();
  const cx = v.x + v.w / 2, cy = v.y + v.h / 2;
  return {
    zoom: c._zoom,
    wider: v.w > fit.w * 1.9,                                   // actually zoomed out
    centredX: Math.abs(cx - (base[0] + base[2] / 2)) < 1,       // not pinned to a corner
    centredY: Math.abs(cy - (base[1] + base[3] / 2)) < 1,
  };
});
out.zoomOutWorks = out.zoomOut.zoom === 0.5 && out.zoomOut.wider
  && out.zoomOut.centredX && out.zoomOut.centredY;
delete out.zoomOut;
// docs/CANVAS.md §5: the zoom-out floor moved from a fixed 0.4 of the old
// view_box to 1/3 of the CONTENT frame — three canvases of empty plane is as
// far as it is useful to go when the canvas has no edges.
out.floorIsThird = Math.abs(await page.evaluate(() => { window.__card._resetZoom(); const c = window.__card;
  c._applyView(0.01); return c._zoom; }) - 1 / 3) < 1e-9; // clamped at the floor
await page.evaluate(() => window.__card._resetZoom());

// -- editor zoom is a working tool, not the viewing intent ----------------
// view 1.6 → devices editor 2.5 → back to view: the pre-editor viewport
// (zoom AND center) comes back; the editor keeps its own zoom while open.
out.editorZoomNotSaved = await page.evaluate(async () => {
  const c = window.__card;
  const raf2 = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const center = () => { const v = c._view; return [v.x + v.w / 2, v.y + v.h / 2]; };
  c._setMode('view');
  c._resetZoom();
  c._zoomAt(10, 10, 1.6); c._saveZoom(); // off-center on purpose
  const want = { zoom: c._zoom, c: center() };
  c._setMode('devices'); await raf2();
  c._zoomAt(10, 10, 2.5); c._saveZoom(); // off-center too: the center must not leak either
  const editorZoomFree = Math.abs(c._zoom - 2.5) < 0.01; // zooming inside stays
  c._setMode('view'); await raf2();
  const got = { zoom: c._zoom, c: center() };
  const ls = JSON.parse(localStorage.getItem('houseplan_card_zoom_v1') || '{}');
  return {
    editorZoomFree,
    zoomRestored: Math.abs(got.zoom - want.zoom) < 0.01,
    centerRestored: Math.hypot(got.c[0] - want.c[0], got.c[1] - want.c[1]) < 0.02,
    lsRestored: Math.abs((ls[c._space] || 1) - want.zoom) < 0.01,
  };
});
out.editorZoomFree = out.editorZoomNotSaved.editorZoomFree;
out.viewZoomRestored = out.editorZoomNotSaved.zoomRestored;
out.viewCenterRestored = out.editorZoomNotSaved.centerRestored;
out.viewZoomBackInLs = out.editorZoomNotSaved.lsRestored;
delete out.editorZoomNotSaved;

// -- editor entered and left without touching zoom: no jump ---------------
out.untouchedEditorNoJump = await page.evaluate(async () => {
  const c = window.__card;
  const raf2 = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  c._setMode('view');
  c._resetZoom();
  c._zoomAt(30, 30, 1.6); c._saveZoom();
  const before = { ...c._view };
  c._setMode('plan'); await raf2();
  c._setMode('view'); await raf2();
  const v = c._view;
  return Math.abs(c._zoom - 1.6) < 0.01
    && Math.abs(v.x - before.x) < 0.005 && Math.abs(v.y - before.y) < 0.005
    && Math.abs(v.w - before.w) < 0.005 && Math.abs(v.h - before.h) < 0.005;
});

// -- the view zoom still survives a space switch, per space ---------------
out.viewZoomSurvivesSpaceSwitch = await page.evaluate(async () => {
  const c = window.__card;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  c._setMode('view');
  c._resetZoom(); c._applyView(1.7); c._saveZoom();
  c._slideTo('garden', 'left'); await wait(350);
  const gardenGotOwnZoom = Math.abs(c._zoom - (JSON.parse(
    localStorage.getItem('houseplan_card_zoom_v1') || '{}').garden || 1)) < 0.01;
  c._slideTo('f1', 'right'); await wait(350);
  return gardenGotOwnZoom && Math.abs(c._zoom - 1.7) < 0.01;
});
await page.evaluate(() => window.__card._resetZoom());

// -- owner's dacha regression: editor 500% must never reach the per-space
// view store. View zoom set on BOTH floors, editor cranked to 5.0, back to
// view — and the floor tab is clicked in the SAME tick (on the tablet the
// exit re-render janks, so the click runs before the restore rAF and the
// old fix-up save was skipped). Two switches later the stale 5.0 came back.
out.editorZoomNeverInSpaceStore = await page.evaluate(async () => {
  const c = window.__card;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const raf2 = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  c._setMode('view');
  c._resetZoom(); c._zoomAt(10, 10, 1.6); c._saveZoom();      // floor 1 view zoom
  c._slideTo('garden', 'left'); await wait(350);
  c._resetZoom(); c._zoomAt(10, 10, 1.4); c._saveZoom();      // floor 2 view zoom
  c._setMode('devices'); await raf2();
  c._zoomAt(10, 10, 5.0); c._saveZoom();                      // 500% — a working tool
  const lsInEditor = JSON.parse(localStorage.getItem('houseplan_card_zoom_v1') || '{}');
  c._setMode('view');
  c._slideTo('f1', 'right'); await wait(350);                 // same tick as the exit — beats the rAF
  const firstSwitch = Math.abs(c._zoom - 1.6) < 0.01;
  c._slideTo('garden', 'left'); await wait(350);
  const secondSwitch = Math.abs(c._zoom - 1.4) < 0.01;        // used to come back as 5.0
  const ls = JSON.parse(localStorage.getItem('houseplan_card_zoom_v1') || '{}');
  c._slideTo('f1', 'right'); await wait(350); c._resetZoom(); // leave the stage as the next tests expect
  return {
    editorNotPersisted: Math.abs((lsInEditor.garden || 1) - 1.4) < 0.01,
    firstSwitch,
    secondSwitch,
    lsClean: Math.abs((ls.garden || 1) - 1.4) < 0.01 && Math.abs((ls.f1 || 1) - 1.6) < 0.01,
  };
});
out.editorZoomStaysOutOfLs = out.editorZoomNeverInSpaceStore.editorNotPersisted;
out.ownerFirstSwitchOk = out.editorZoomNeverInSpaceStore.firstSwitch;
out.ownerSecondSwitchOk = out.editorZoomNeverInSpaceStore.secondSwitch;
out.ownerLsClean = out.editorZoomNeverInSpaceStore.lsClean;
delete out.editorZoomNeverInSpaceStore;

// -- HP-1543-01: смена этажа ВНУТРИ редактора не тащит editor zoom в view --
// view-зум сохранён на обоих этажах → редактор на f1 → переключение ВКЛАДКОЙ
// на garden → editor zoom 5.0 → выход в view (остаёмся на garden): вид обязан
// вернуться к сохранённому view-зуму garden (1.4) с штатным центром
// _restoreZoom(), а не остаться на редакторских 500% (снапшот-guard по space
// отбрасывал восстановление, а текущий _zoom так и оставался редакторским).
out.crossFloorEditorExit = await page.evaluate(async () => {
  const c = window.__card;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const raf2 = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const sr = c.shadowRoot || c.renderRoot;
  c._setMode('view');
  c._resetZoom(); c._zoomAt(10, 10, 1.6); c._saveZoom();      // f1 view zoom
  c._slideTo('garden', 'left'); await wait(350);
  c._resetZoom(); c._zoomAt(10, 10, 1.4); c._saveZoom();      // garden view zoom
  c._slideTo('f1', 'right'); await wait(350);
  c._setMode('devices'); await raf2();
  // этаж меняется НАСТОЯЩЕЙ вкладкой — именно этот путь под подозрением
  const idx = c._model.findIndex((s) => s.id === 'garden');
  sr.querySelectorAll('.tabs .tab')[idx].click();
  await c.updateComplete; await raf2();
  c._zoomAt(10, 10, 5.0); c._saveZoom();                      // 500% — рабочий инструмент
  c._setMode('view'); await raf2(); await wait(60);
  const stillGarden = c._space === 'garden';
  const gotZoom = c._zoom;
  const v = c._view; const vb = c._baseVb();
  const centred = !!v && Math.abs(v.x + v.w / 2 - (vb[0] + vb[2] / 2)) < 1
    && Math.abs(v.y + v.h / 2 - (vb[1] + vb[3] / 2)) < 1;
  const ls = JSON.parse(localStorage.getItem('houseplan_card_zoom_v1') || '{}');
  const store = { ...c._zoomBySpace };
  c._slideTo('f1', 'right'); await wait(350); c._resetZoom(); // вернуть сцену следующим тестам
  return {
    stillGarden,
    viewZoomRestoredCrossFloor: Math.abs(gotZoom - 1.4) < 0.01,          // было 5.0 (HP-1543-01)
    centerRestoredCrossFloor: centred,                                   // центр как у _restoreZoom()
    storeIntactCrossFloor: Math.abs((store.garden || 1) - 1.4) < 0.01,   // _zoomBySpace не тронут
    lsIntactCrossFloor: Math.abs((ls.garden || 1) - 1.4) < 0.01
      && Math.abs((ls.f1 || 1) - 1.6) < 0.01,                            // LS_ZOOM не тронут
  };
});
out.crossFloorStillGarden = out.crossFloorEditorExit.stillGarden;
out.crossFloorViewZoomRestored = out.crossFloorEditorExit.viewZoomRestoredCrossFloor;
out.crossFloorCenterRestored = out.crossFloorEditorExit.centerRestoredCrossFloor;
out.crossFloorStoreIntact = out.crossFloorEditorExit.storeIntactCrossFloor;
out.crossFloorLsIntact = out.crossFloorEditorExit.lsIntactCrossFloor;
delete out.crossFloorEditorExit;

// -- devices outside rooms stretch the default frame ---------------------
out.devicesStretchFrame = await page.evaluate(() => {
  const c = window.__card;
  const cfg = JSON.parse(JSON.stringify(c._serverCfg));
  cfg.spaces[0].plan_url = null; cfg.spaces[0].plan_aspect = null;
  c._serverCfg = cfg; c._model = null;
  const before = c._baseVb();
  // walk one lamp far outside every room
  c._layout = { ...c._layout, d_lamp: { s: 'f1', x: 0.99, y: 0.5 } };
  const after = c._baseVb();
  return after[0] + after[2] > before[0] + before[2] + 20; // right edge follows the lamp
});

// -- a card BELOW other dashboard content still gets a stage (HP-1500-02) --
out.stageSurvivesContentAbove = await page.evaluate(async () => {
  const spacer = document.createElement('div');
  spacer.style.height = '900px';
  document.body.insertBefore(spacer, document.body.firstChild);
  window.dispatchEvent(new Event('resize'));
  await new Promise((r) => setTimeout(r, 120));
  const c = window.__card;
  const sr = c.shadowRoot || c.renderRoot;
  const h = sr.querySelector('.stage').getBoundingClientRect().height;
  spacer.remove();
  window.dispatchEvent(new Event('resize'));
  await new Promise((r) => setTimeout(r, 120));
  // the old code billed the 900px spacer as "header" and left a 0px stage
  return h > 300;
});

await finish(browser, checkAll(out));
