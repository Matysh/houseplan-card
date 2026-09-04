// #152: the browser-painted room owns a clean View tap and the shared camera
// fits its exact rendered geometry. This smoke is part of the pre-beta matrix;
// the implementation cycle itself remains typecheck + unit + build.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1000, height: 800 }, 1);

const out = await page.evaluate(async () => {
  const c = window.__card;
  const root = c.shadowRoot || c.renderRoot;
  const result = {};
  const config = {
    spaces: [{
      id: 'fit-floor', title: 'Fit floor', view_box: [0, 0, 1, 1],
      settings: { show_borders: true, show_names: true },
      partitions: [{ id: 'fit-wall', a: [0.1, 0.1], b: [0.9, 0.1], cm: 15 }],
      rooms: [
        { id: 'outer', name: 'Outer', area: 'fit_outer',
          poly: [[0.05, 0.05], [0.95, 0.05], [0.95, 0.95], [0.05, 0.95]] },
        { id: 'room-a', name: 'Office', area: 'fit_office',
          poly: [[0.55, 0.15], [0.85, 0.15], [0.85, 0.45], [0.72, 0.45], [0.72, 0.35], [0.55, 0.35]] },
      ],
    }],
    markers: [], settings: { filter_seeded: true },
  };
  const server = (await c.hass.callWS({ type: 'houseplan/config/get' })).config;
  for (const key of Object.keys(server)) delete server[key];
  Object.assign(server, JSON.parse(JSON.stringify(config)));
  c._serverCfg = server;
  c._space = 'fit-floor';
  c._modelCache = null;
  c._frame = null;
  c._cfgEpoch++;
  c._mode = 'view';
  c._zoom = 1;
  c._view = null;
  c.requestUpdate();
  await c.updateComplete;

  const waitCamera = async () => {
    const started = performance.now();
    while (c._cameraTransition?.active) {
      if (performance.now() - started > 1200) throw new Error('room camera did not settle');
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    await c.updateComplete;
  };
  const pointer = (target, type, id, x = 500, y = 300, extra = {}) =>
    target.dispatchEvent(new PointerEvent(type, {
      bubbles: true, composed: true, cancelable: true, pointerId: id,
      pointerType: 'mouse', isPrimary: true, button: 0,
      buttons: type === 'pointerdown' || type === 'pointermove' ? 1 : 0,
      clientX: x, clientY: y, ...extra,
    }));
  const roomNode = () => root.querySelector('[data-hp="room"][data-id="room-a"]');
  const room = () => c._spaceModel().rooms.find((item) => item.id === 'room-a');
  const margins = () => {
    const bounds = c._roomFitBounds(room(), c._spaceModel());
    const view = c._view;
    return {
      left: (bounds.x - view.x) / view.w,
      right: (view.x + view.w - bounds.x - bounds.w) / view.w,
      top: (bounds.y - view.y) / view.h,
      bottom: (view.y + view.h - bounds.y - bounds.h) / view.h,
    };
  };

  localStorage.setItem('houseplan_card_zoom_v1', JSON.stringify({ 'fit-floor': 1 }));
  pointer(roomNode(), 'pointerdown', 15201);
  pointer(roomNode(), 'pointerup', 15201);
  const syncFrames = [];
  for (let frame = 0; frame < 3 && c._cameraTransition?.active; frame++) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await c.updateComplete;
    const activeView = c._view;
    const activeLabel = root.querySelector('.roomlabel[data-id="room-a"]');
    const activeSvg = root.querySelector('.plan-svg') || root.querySelector('.zoomwrap > svg');
    const position = c._scenePoint([c._labelPos(room(), 'fit-floor').x,
      c._labelPos(room(), 'fit-floor').y]);
    const expectedLeft = ((position[0] - activeView.x) / activeView.w) * 100;
    const expectedTop = ((position[1] - activeView.y) / activeView.h) * 100;
    const actualView = activeSvg?.getAttribute('viewBox')?.trim().split(/\s+/).map(Number) || [];
    syncFrames.push(actualView.length === 4
      && actualView.every((value, index) => Math.abs(value
        - [activeView.x, activeView.y, activeView.w, activeView.h][index]) < 1e-6)
      && Math.abs(Number.parseFloat(activeLabel.style.left) - expectedLeft) < 1e-3
      && Math.abs(Number.parseFloat(activeLabel.style.top) - expectedTop) < 1e-3);
  }
  result.svgAndHtmlShareTweenFrames = syncFrames.length > 0 && syncFrames.every(Boolean);
  await waitCamera();
  const flatMargins = margins();
  result.cleanRoomTapFits = Object.values(flatMargins).every((value) => value >= 0.099);
  result.oneFlatAxisUsesTenPercent = Math.min(...Object.values(flatMargins)) <= 0.102;
  result.roomIntentIsSessionOnly = c._roomFocus?.roomId === 'room-a'
    && JSON.parse(localStorage.getItem('houseplan_card_zoom_v1'))['fit-floor'] === 1;

  const settled = JSON.stringify(c._view);
  pointer(roomNode(), 'pointerdown', 15202);
  pointer(roomNode(), 'pointerup', 15202);
  await waitCamera();
  result.repeatedFitIsNoOp = !c._cameraTransition.active && JSON.stringify(c._view) === settled;

  const label = root.querySelector('.roomlabel[data-id="room-a"]');
  result.labelIsKeyboardAction = label?.getAttribute('role') === 'button'
    && label?.getAttribute('tabindex') === '0'
    && /Office/.test(label?.getAttribute('aria-label') || '');
  c._resetZoom(); await waitCamera();
  label.focus();
  label.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
  await waitCamera();
  result.keyboardUsesSameCommand = c._roomFocus?.roomId === 'room-a'
    && (root.activeElement === label || document.activeElement === label);

  c._resetZoom(); await waitCamera();
  c._clearRoomFocus(true);
  const currentLabel = root.querySelector('.roomlabel[data-id="room-a"]');
  const ownerProbe = document.createElement('span');
  ownerProbe.setAttribute('role', 'button');
  ownerProbe.dataset.roomFitBlock = 'smoke-action';
  currentLabel.append(ownerProbe);
  pointer(ownerProbe, 'pointerdown', 15203);
  pointer(ownerProbe, 'pointerup', 15203);
  await c.updateComplete;
  result.commonInteractiveOwnerSuppressesRoomFit = c._roomPointer === null
    && c._roomFocus === null;
  const areaLink = currentLabel.querySelector('.rlgo');
  const beforeLink = JSON.stringify(c._view);
  pointer(areaLink, 'pointerdown', 15204);
  pointer(areaLink, 'pointerup', 15204);
  await c.updateComplete;
  result.areaLinkSuppressesRoomFit = JSON.stringify(c._view) === beforeLink
    && c._roomPointer === null && c._roomFocus === null;

  pointer(roomNode(), 'pointerdown', 15205, 500, 300);
  pointer(roomNode(), 'pointermove', 15205, 520, 300);
  pointer(roomNode(), 'pointerup', 15205, 520, 300);
  await c.updateComplete;
  result.panCancelsRoomIntent = c._roomFocus === null && c._roomPointer === null;

  pointer(roomNode(), 'pointerdown', 15206, 500, 300);
  pointer(roomNode(), 'pointerup', 15206, 500, 300);
  await waitCamera();
  c.style.width = '760px';
  c._lastValidStageSize = [1000, c._stageEl.clientHeight];
  c._refitView();
  await new Promise((resolve) => setTimeout(resolve, 80));
  await c.updateComplete;
  const resizedMargins = margins();
  result.resizeRefitsAtomically = c._roomFocus?.roomId === 'room-a'
    && Object.values(resizedMargins).every((value) => value >= 0.099);

  c.style.width = '1000px';
  await new Promise((resolve) => setTimeout(resolve, 100));
  c._clearRoomFocus(true);
  c._onLabsSnapshot({ active: Object.freeze(['iso']), space: '' });
  await c.updateComplete;
  c._setProjection('iso');
  await c.updateComplete;
  pointer(roomNode(), 'pointerdown', 15207);
  pointer(roomNode(), 'pointerup', 15207);
  await waitCamera();
  const isoMargins = margins();
  result.isoUsesProjectedBounds = c._effectiveProjection() === 'iso'
    && Object.values(isoMargins).every((value) => value >= 0.099)
    && (c._zoom === 8 || Math.min(...Object.values(isoMargins)) <= 0.102);

  const kiosk = document.createElement('houseplan-card');
  kiosk.setConfig({ type: 'custom:houseplan-card', kiosk: true, cycle: 0 });
  kiosk.hass = c.hass;
  kiosk.style.cssText = 'position:fixed;inset:0;width:900px;height:700px;z-index:99';
  document.body.appendChild(kiosk);
  await new Promise((resolve) => setTimeout(resolve, 450));
  kiosk.hass = { ...c.hass };
  await kiosk.updateComplete;
  const kioskRoot = kiosk.shadowRoot || kiosk.renderRoot;
  const kioskRoom = kioskRoot.querySelector('[data-hp="room"][data-id="room-a"]');
  const kioskPointer = (target, type, id) => target.dispatchEvent(new PointerEvent(type, {
    bubbles: true, composed: true, cancelable: true, pointerId: id,
    pointerType: 'touch', isPrimary: true, button: 0,
    buttons: type === 'pointerdown' ? 1 : 0, clientX: 450, clientY: 300,
  }));
  kiosk._lastTap = 152;
  for (const id of [15208, 15209]) {
    kioskPointer(kioskRoom, 'pointerdown', id);
    kioskPointer(kioskRoom, 'pointerup', id);
    const started = performance.now();
    while (kiosk._cameraTransition.active && performance.now() - started < 1200) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }
  result.kioskRoomTapDoesNotEnterDoubleTap = kiosk._lastTap === 152
    && kiosk._roomFocus?.roomId === 'room-a';
  kiosk._clearRoomFocus(true);
  kiosk._applyView(2);
  kiosk._lastTap = Date.now() - 100;
  kioskPointer(kiosk._stageEl, 'pointerdown', 15210);
  kioskPointer(kiosk._stageEl, 'pointerup', 15210);
  const resetStarted = performance.now();
  while (kiosk._cameraTransition.active && performance.now() - resetStarted < 1200) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  result.kioskBackgroundDoubleTapStillResets = Math.abs(kiosk._zoom - 1) < 1e-9;
  kiosk.remove();

  return result;
});

await finish(browser, checkAll(out));
