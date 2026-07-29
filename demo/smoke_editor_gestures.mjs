// На телефоне в редакторах не работали зум и навигация жестами: pointerdown
// сцены выходил сразу при _markup, так что пинч и пан не начинались вовсе.
// Рисование кликается, жесты двигаются — они совместимы; палец с движением
// панорамирует, два пальца зумируют, отпускание после жеста не рисует точку.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const out = {};

const pd = (c, id, x, y) => c._stagePointerDown({ pointerId: id, clientX: x, clientY: y, target: c._stageEl, preventDefault() {} });
const pm = (c, id, x, y) => c._stagePointerMove({ pointerId: id, clientX: x, clientY: y });
const pu = (c, id, x, y) => c._stagePointerUp({ pointerId: id, clientX: x, clientY: y });

// --- пинч-зум в редакторе плана -----------------------------------------
out.pinchZoomsInPlanEditor = await page.evaluate(() => {
  const c = window.__card;
  c._setMode('plan');
  const pd = (id, x, y) => c._stagePointerDown({ pointerId: id, clientX: x, clientY: y, target: c._stageEl, preventDefault() {} });
  const pm = (id, x, y) => c._stagePointerMove({ pointerId: id, clientX: x, clientY: y });
  const pu = (id, x, y) => c._stagePointerUp({ pointerId: id, clientX: x, clientY: y });
  c._resetZoom();
  const z0 = c._zoom;
  pd(1, 300, 300); pd(2, 400, 300);          // два пальца
  pm(1, 250, 300); pm(2, 450, 300);          // разводим
  const zoomed = c._zoom > z0 * 1.5;
  pu(1, 250, 300); pu(2, 450, 300);
  return zoomed && c._path.length === 0;
});

// --- пан одним пальцем в редакторе, точка не рисуется --------------------
out.panWorksAndDoesNotDraw = await page.evaluate(async () => {
  const c = window.__card;
  const pd = (id, x, y) => c._stagePointerDown({ pointerId: id, clientX: x, clientY: y, target: c._stageEl, preventDefault() {} });
  const pm = (id, x, y) => c._stagePointerMove({ pointerId: id, clientX: x, clientY: y });
  const pu = (id, x, y) => c._stagePointerUp({ pointerId: id, clientX: x, clientY: y });
  const st = c._stageEl;
  c._zoomAt(st.clientWidth / 2, st.clientHeight / 2, 3); // есть куда панорамировать
  const v0 = { ...c._view };
  pd(3, 300, 300);
  pm(3, 380, 340); pm(3, 420, 360);
  const panned = Math.abs(c._view.x - v0.x) > 1 || Math.abs(c._view.y - v0.y) > 1;
  const suppressed = c._suppressClick === true;
  c._markupClick({ composedPath: () => [], clientX: 420, clientY: 360 }); // синтезированный click после пана
  const noDot = c._path.length === 0;
  pu(3, 420, 360);
  await new Promise((r) => setTimeout(r, 10));
  return panned && suppressed && noDot;
});

// --- обычный клик без движения по-прежнему рисует ------------------------
out.tapStillDraws = await page.evaluate(() => {
  const c = window.__card;
  const pd = (id, x, y) => c._stagePointerDown({ pointerId: id, clientX: x, clientY: y, target: c._stageEl, preventDefault() {} });
  const pu = (id, x, y) => c._stagePointerUp({ pointerId: id, clientX: x, clientY: y });
  c._resetZoom();
  c._tool = 'draw';
  const before = c._path.length;
  pd(4, 300, 300); pu(4, 300, 300);
  const st = c._stageEl.getBoundingClientRect();
  c._markupClick({ composedPath: () => [], clientX: st.left + 200, clientY: st.top + 200 });
  const drew = c._path.length > before;
  c._path = []; c._setMode('view');
  return drew;
});

await finish(browser, checkAll(out));
