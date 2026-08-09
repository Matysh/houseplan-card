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

// A child control may stop pointer events before the stage sees the first
// finger. The card-level capture guard must still classify the sequence as a
// pinch and swallow WebKit's synthetic click before it reaches that control.
out.pinchCannotMisclickInteractiveChild = await page.evaluate(async () => {
  const c = window.__card;
  c._setMode('view');
  await c.updateComplete;
  const stage = c._stageEl;
  const probe = document.createElement('button');
  let clicks = 0;
  probe.addEventListener('pointerdown', (ev) => ev.stopPropagation());
  probe.addEventListener('pointermove', (ev) => ev.stopPropagation());
  probe.addEventListener('pointerup', (ev) => ev.stopPropagation());
  probe.addEventListener('click', () => clicks++);
  stage.appendChild(probe);
  const pointer = (type, id, target, x = id === 51 ? 300 : 400) => target.dispatchEvent(new PointerEvent(type, {
    bubbles: true, composed: true, pointerId: id, pointerType: 'touch',
    clientX: x, clientY: 300,
  }));
  c._resetZoom();
  const zoom0 = c._zoom;
  pointer('pointerdown', 51, probe);
  pointer('pointerdown', 52, stage);
  pointer('pointermove', 51, probe, 250);
  pointer('pointermove', 52, stage, 450);
  const pinchZoomed = c._zoom > zoom0 * 1.5;
  pointer('pointerup', 51, probe);
  pointer('pointerup', 52, stage);
  probe.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));
  const gestureClickBlocked = clicks === 0;
  await new Promise((resolve) => setTimeout(resolve, 520));
  probe.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));
  probe.remove();
  const ordinaryTapStillWorks = clicks === 1;
  c._setMode('plan');
  await c.updateComplete;
  return pinchZoomed && gestureClickBlocked && ordinaryTapStillWorks;
});

// Robot-map calibration owns the gesture surface. The card-level capture
// guard must still suppress a two-finger misclick, but must not seed or apply
// the plan's pinch zoom underneath the calibration overlay.
out.pinchDoesNotZoomBelowVacuumFit = await page.evaluate(async () => {
  const c = window.__card;
  c._setMode('view');
  await c.updateComplete;
  const stage = c._stageEl;
  const previousFit = c._vacFit;
  c._vacFit = { markerId: 'smoke', source: 'smoke', mapId: 'smoke',
    p: { ox: 0, oy: 0, k: 1, rot: 0, mir: false }, drag: null };
  c._resetZoom();
  const zoom0 = c._zoom;
  const pointer = (type, id, x) => stage.dispatchEvent(new PointerEvent(type, {
    bubbles: true, composed: true, pointerId: id, pointerType: 'touch',
    clientX: x, clientY: 300,
  }));
  pointer('pointerdown', 61, 300);
  pointer('pointerdown', 62, 400);
  pointer('pointermove', 61, 250);
  pointer('pointermove', 62, 450);
  const stayed = c._zoom === zoom0 && c._pinchStart === null && c._pointers.size === 0;
  pointer('pointerup', 61, 250);
  pointer('pointerup', 62, 450);
  c._vacFit = previousFit;
  c._setMode('plan');
  await c.updateComplete;
  return stayed;
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
