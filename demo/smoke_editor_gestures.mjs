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

// A real device is the safety boundary: a delayed compatibility click from a
// completed pinch must not reach its action, while the next deliberate
// pointerdown/up/click sequence must work immediately. Exercise every terminal
// path because touch browsers disagree about pointerup/cancel/capture ordering.
Object.assign(out, await page.evaluate(async () => {
  const c = window.__card;
  c._setMode('view');
  await c.updateComplete;
  const stage = c._stageEl;
  const marker = c.renderRoot.querySelector('.dev');
  if (!marker) return {
    pinchZoomsFromDevice: false,
    pinchIntermediateClickBlocked: false,
    pinchDelayedClickBlocked: false,
    pinchTerminalVariantsBlocked: false,
    pinchCancelsDeviceLongPress: false,
    nextDeliberateDeviceTapWorks: false,
  };
  let actionCalls = 0;
  const originalClickDevice = c._clickDevice;
  c._clickDevice = () => { actionCalls += 1; };
  c._infoCard = null;
  c._tapConfirm = null;
  const pointer = (type, id, target, x) => target.dispatchEvent(new PointerEvent(type, {
    bubbles: true, composed: true, pointerId: id, pointerType: 'touch',
    clientX: x, clientY: 300,
  }));
  const compatibilityClick = () => marker.dispatchEvent(new MouseEvent('click', {
    bubbles: true, composed: true, cancelable: true,
  }));
  c._resetZoom();
  const zoom0 = c._zoom;
  pointer('pointerdown', 51, marker, 300);
  pointer('pointerdown', 52, stage, 400);
  pointer('pointermove', 51, marker, 250);
  pointer('pointermove', 52, stage, 450);
  const pinchZoomsFromDevice = c._zoom > zoom0 * 1.5;
  pointer('pointerup', 51, marker, 250);
  compatibilityClick(); // between the two releases
  const pinchIntermediateClickBlocked = actionCalls === 0;
  pointer('pointerup', 52, stage, 450);
  await new Promise((resolve) => setTimeout(resolve, 620));
  compatibilityClick(); // deliberately later than the old 500 ms window
  const pinchDelayedClickBlocked = actionCalls === 0;
  const pinchCancelsDeviceLongPress = c._infoCard === null && c._tapConfirm === null;

  const terminalGesture = (firstTerminal, secondTerminal, base) => {
    pointer('pointerdown', base, marker, 300);
    pointer('pointerdown', base + 1, stage, 400);
    pointer(firstTerminal, base + 1, stage, 400); // reverse the first gesture's order
    compatibilityClick();
    pointer(secondTerminal, base, marker, 300);
    compatibilityClick();
  };
  terminalGesture('pointerup', 'pointercancel', 61);
  terminalGesture('lostpointercapture', 'pointerup', 71);
  const pinchTerminalVariantsBlocked = actionCalls === 0;

  // No timeout: the pointerdown itself, not elapsed time, proves a new intent.
  pointer('pointerdown', 81, marker, 300);
  pointer('pointerup', 81, marker, 300);
  compatibilityClick();
  const nextDeliberateDeviceTapWorks = actionCalls === 1;
  c._clickDevice = originalClickDevice;
  c._setMode('plan');
  await c.updateComplete;
  return {
    pinchZoomsFromDevice,
    pinchIntermediateClickBlocked,
    pinchDelayedClickBlocked,
    pinchTerminalVariantsBlocked,
    pinchCancelsDeviceLongPress,
    nextDeliberateDeviceTapWorks,
  };
}));

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
