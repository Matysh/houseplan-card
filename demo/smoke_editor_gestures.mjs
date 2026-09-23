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

// #613: persistence is a gesture terminal effect, not synchronous work in
// either pointermove path. Count only the zoom key and exercise both the plain
// stage pipeline and the capture path used when a device swallows bubbling.
Object.assign(out, await page.evaluate(async () => {
  const c = window.__card;
  const storagePrototype = Object.getPrototypeOf(localStorage);
  const originalSetItem = storagePrototype.setItem;
  let zoomWrites = 0;
  storagePrototype.setItem = function setItem(key, value) {
    if (key === 'houseplan_card_zoom_v1') zoomWrites += 1;
    return originalSetItem.call(this, key, value);
  };
  const resetPointers = () => {
    c._pointers.clear();
    c._touchContacts.clear();
    c._pinchStart = null;
    c._panStart = null;
    c._panLock = null;
    c._pinchZoomDirty = false;
    c._viewportGestureDirty = false;
  };
  const directPointer = (id, x, target = c._stageEl) => ({
    pointerId: id, pointerType: 'touch', clientX: x, clientY: 300,
    target, button: 0, isPrimary: id % 2 === 1, composedPath: () => [target],
    preventDefault() {},
  });

  try {
    c._setMode('view');
    await c.updateComplete;
    c._cancelCameraTransition(false);
    resetPointers();
    const directStart = zoomWrites;
    c._stagePointerDown(directPointer(201, 300));
    c._stagePointerDown(directPointer(202, 400));
    for (const [left, right] of [[285, 415], [270, 430], [250, 450]]) {
      c._stagePointerMove(directPointer(201, left));
      c._stagePointerMove(directPointer(202, right));
    }
    const directMoveWrites = zoomWrites - directStart;
    c._stagePointerUp(directPointer(201, 250));
    const directFirstTerminalWrites = zoomWrites - directStart;
    c._stagePointerUp(directPointer(202, 450));
    const directTotalWrites = zoomWrites - directStart;

    const stage = c._stageEl;
    const marker = c.renderRoot.querySelector('.dev[data-entity]')
      || c.renderRoot.querySelector('.dev');
    const pointer = (type, id, target, x) => target.dispatchEvent(new PointerEvent(type, {
      bubbles: true, composed: true, cancelable: true, pointerId: id,
      pointerType: 'touch', clientX: x, clientY: 300,
      button: type === 'pointerdown' ? 0 : -1,
    }));
    const captureGesture = (firstTerminal, secondTerminal, base) => {
      resetPointers();
      const start = zoomWrites;
      pointer('pointerdown', base, stage, 400);
      pointer('pointerdown', base + 1, marker, 300);
      pointer('pointermove', base, stage, 450);
      pointer('pointermove', base + 1, marker, 250);
      pointer('pointermove', base, stage, 470);
      const moveWrites = zoomWrites - start;
      pointer(firstTerminal, base + 1, marker, 250);
      const firstWrites = zoomWrites - start;
      pointer(secondTerminal, base, stage, 470);
      return { moveWrites, firstWrites, totalWrites: zoomWrites - start };
    };
    const captureTerminals = marker ? [
      captureGesture('pointerup', 'pointerup', 210),
      captureGesture('pointercancel', 'pointerup', 220),
      captureGesture('lostpointercapture', 'pointercancel', 230),
    ] : [];

    c._setMode('plan');
    await c.updateComplete;
    resetPointers();
    const editorStart = zoomWrites;
    c._stagePointerDown(directPointer(241, 300));
    c._stagePointerDown(directPointer(242, 400));
    c._stagePointerMove(directPointer(241, 250));
    c._stagePointerMove(directPointer(242, 450));
    c._stagePointerUp(directPointer(241, 250));
    c._stagePointerUp(directPointer(242, 450));
    const editorWrites = zoomWrites - editorStart;

    return {
      directPinchWritesOnlyAtFinalTerminal: directMoveWrites === 0
        && directFirstTerminalWrites === 0 && directTotalWrites === 1,
      capturedPinchWritesOnlyAtFinalTerminal: captureTerminals.length === 3
        && captureTerminals.every((entry) => entry.moveWrites === 0
          && entry.firstWrites === 0 && entry.totalWrites === 1),
      editorPinchDoesNotPersistViewZoom: editorWrites === 0,
    };
  } finally {
    storagePrototype.setItem = originalSetItem;
  }
}));

// A real device is the safety boundary: neither order of a pinch may arm the
// marker's long press, and both click and contextmenu compatibility events stay
// owned by that gesture. Exercise every terminal path because touch browsers
// disagree about pointerup/cancel/capture ordering.
Object.assign(out, await page.evaluate(async () => {
  const c = window.__card;
  c._setMode('view');
  await c.updateComplete;
  const stage = c._stageEl;
  const marker = c.renderRoot.querySelector('.dev[data-entity]')
    || c.renderRoot.querySelector('.dev');
  if (!marker) return {
    pinchZoomsFromDevice: false,
    stageThenDeviceHoldBlocked: false,
    stageThenDeviceContextMenuBlocked: false,
    pinchIntermediateClickBlocked: false,
    pinchDelayedClickBlocked: false,
    pinchTerminalVariantsBlocked: false,
    pinchCancelsDeviceLongPress: false,
    nextDeliberateDeviceTapWorks: false,
    nextDeliberateDeviceLongPressWorks: false,
    mouseContextMenuStillWorks: false,
    keyboardContextMenuStillWorks: false,
  };
  let actionCalls = 0;
  let moreInfoCalls = 0;
  let serviceCalls = 0;
  const originalClickDevice = c._clickDevice;
  const originalOpenMoreInfo = c._openMoreInfo;
  const originalCallService = c.hass.callService;
  c._clickDevice = () => { actionCalls += 1; };
  c._openMoreInfo = () => { moreInfoCalls += 1; };
  c.hass.callService = async () => { serviceCalls += 1; };
  c._infoCard = null;
  c._tapConfirm = null;
  const pointer = (type, id, target, x, pointerType = 'touch') => target.dispatchEvent(new PointerEvent(type, {
    bubbles: true, composed: true, cancelable: true, pointerId: id, pointerType,
    clientX: x, clientY: 300, button: type === 'pointerdown' ? 0 : -1,
  }));
  const compatibilityClick = () => marker.dispatchEvent(new MouseEvent('click', {
    bubbles: true, composed: true, cancelable: true,
  }));
  const compatibilityContextMenu = (pointerType = 'touch', id = 900) => {
    const event = new PointerEvent('contextmenu', {
      bubbles: true, composed: true, cancelable: true, pointerId: id,
      pointerType, clientX: 300, clientY: 300, button: 2,
    });
    marker.dispatchEvent(event);
    return event.defaultPrevented;
  };
  const noActivation = () => actionCalls === 0 && moreInfoCalls === 0
    && serviceCalls === 0 && c._infoCard === null && c._tapConfirm === null;

  // The missed #563 order: stage first, marker second. Capture has already
  // made the sequence multi-touch before the marker's pointerdown handler runs.
  c._resetZoom();
  const stageFirstZoom0 = c._zoom;
  pointer('pointerdown', 41, stage, 400);
  pointer('pointerdown', 42, marker, 300);
  await new Promise((resolve) => setTimeout(resolve, 620));
  const stageThenDeviceHoldBlocked = noActivation();
  const activeContextPrevented = compatibilityContextMenu('touch', 42);
  const stageThenDeviceContextMenuBlocked = activeContextPrevented && noActivation();
  pointer('pointermove', 41, stage, 450);
  pointer('pointermove', 42, marker, 250);
  const stageThenDeviceZooms = c._zoom > stageFirstZoom0 * 1.5;
  pointer('pointerup', 42, marker, 250);
  pointer('pointerup', 41, stage, 450);
  const postContextPrevented = compatibilityContextMenu('touch', 42);
  // An unrelated key is not evidence that a delayed touch click became an
  // intentional pointer action. Only the dedicated context-menu key may re-arm
  // the keyboard context menu after all contacts have ended.
  marker.dispatchEvent(new KeyboardEvent('keydown', {
    bubbles: true, composed: true, cancelable: true, key: 'Tab',
  }));
  compatibilityClick();
  const stageThenDevicePostContextMenuBlocked = postContextPrevented && noActivation();

  // Original #563 order: marker first, stage second. The already armed hold
  // must still be cancelled and every compatibility click must remain blocked.
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
  const pinchCancelsDeviceLongPress = noActivation();

  const terminalGesture = (firstTerminal, secondTerminal, base) => {
    pointer('pointerdown', base, marker, 300);
    pointer('pointerdown', base + 1, stage, 400);
    pointer(firstTerminal, base + 1, stage, 400); // reverse the first gesture's order
    compatibilityClick();
    compatibilityContextMenu('touch', base + 1);
    pointer(secondTerminal, base, marker, 300);
    compatibilityClick();
    compatibilityContextMenu('touch', base);
  };
  terminalGesture('pointerup', 'pointercancel', 61);
  terminalGesture('lostpointercapture', 'pointerup', 71);
  // A third marker contact is still part of the old navigation-only sequence.
  pointer('pointerdown', 75, stage, 400);
  pointer('pointerdown', 76, marker, 300);
  pointer('pointerdown', 77, marker, 320);
  pointer('pointerup', 76, marker, 300);
  pointer('pointercancel', 77, marker, 320);
  pointer('lostpointercapture', 75, stage, 400);
  compatibilityClick();
  compatibilityContextMenu('touch', 77);
  const pinchTerminalVariantsBlocked = noActivation();

  // No timeout: the pointerdown itself, not elapsed time, proves a new intent.
  pointer('pointerdown', 81, marker, 300);
  pointer('pointerup', 81, marker, 300);
  compatibilityClick();
  const nextDeliberateDeviceTapWorks = actionCalls === 1;

  // A fresh single-touch long press is not delayed or swallowed by the old
  // pinch. It opens only House Plan's local card through the existing timer.
  c._infoCard = null;
  pointer('pointerdown', 82, marker, 300);
  await new Promise((resolve) => setTimeout(resolve, 620));
  const nextDeliberateDeviceLongPressWorks = c._infoCard !== null
    && moreInfoCalls === 0 && actionCalls === 1 && serviceCalls === 0;
  pointer('pointerup', 82, marker, 300);
  c._closeInfoCard();

  // A real right click has its own mouse pointerdown, which is positive intent
  // and must not inherit the completed touch sequence's contextmenu barrier.
  pointer('pointerdown', 91, marker, 300, 'mouse');
  compatibilityContextMenu('mouse', 91);
  pointer('pointerup', 91, marker, 300, 'mouse');
  const mouseContextMenuStillWorks = moreInfoCalls === 1;

  // Shift+F10 has no pointerdown. Its keydown is equivalent positive evidence
  // once all old contacts have ended, but never while a pinch is still active.
  pointer('pointerdown', 101, marker, 300);
  pointer('pointerdown', 102, stage, 400);
  pointer('pointerup', 101, marker, 300);
  pointer('pointerup', 102, stage, 400);
  marker.dispatchEvent(new KeyboardEvent('keydown', {
    bubbles: true, composed: true, cancelable: true, key: 'F10', shiftKey: true,
  }));
  marker.dispatchEvent(new MouseEvent('contextmenu', {
    bubbles: true, composed: true, cancelable: true, button: 0,
  }));
  const keyboardContextMenuStillWorks = moreInfoCalls === 2;

  c._clickDevice = originalClickDevice;
  c._openMoreInfo = originalOpenMoreInfo;
  c.hass.callService = originalCallService;
  c._setMode('plan');
  await c.updateComplete;
  return {
    pinchZoomsFromDevice: pinchZoomsFromDevice && stageThenDeviceZooms,
    stageThenDeviceHoldBlocked,
    stageThenDeviceContextMenuBlocked: stageThenDeviceContextMenuBlocked
      && stageThenDevicePostContextMenuBlocked,
    pinchIntermediateClickBlocked,
    pinchDelayedClickBlocked,
    pinchTerminalVariantsBlocked,
    pinchCancelsDeviceLongPress,
    nextDeliberateDeviceTapWorks,
    nextDeliberateDeviceLongPressWorks,
    mouseContextMenuStillWorks,
    keyboardContextMenuStillWorks,
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
