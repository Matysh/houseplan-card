// Panning at ANY zoom (owner's report 2026-08-04: «добавь возможность таскать
// план при любом масштабе, а не только при более 100%»).
//
// Until this fix `_stagePointerMove` moved the view only while `_zoom > 1`:
// the rule was inherited from the old bounded canvas, where a plan smaller
// than the scene had nowhere to go. The infinite canvas removed that edge —
// there is always somewhere to go, and an editor extending a plan outwards
// needs exactly that. So a drag on empty scene now pans at 100 %, at 50 % and
// at 800 %, in view mode and in every editor; how far you may walk is decided
// by `_clampView` (PAN_SLACK: about a screen past the content) and not by the
// zoom. The tools keep the pointer they already owned — a resize handle, a
// device badge, an opening — and the kiosk keeps its floor swipe.
import { launch, check, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const out = {};

// ---- a drag on empty scene pans, at every zoom and in every mode ---------
Object.assign(out, await page.evaluate(async () => {
  const c = window.__card;
  const o = {};
  const pd = (id, x, y) => c._stagePointerDown({ pointerId: id, clientX: x, clientY: y, target: c._stageEl, preventDefault() {} });
  const pm = (id, x, y) => c._stagePointerMove({ pointerId: id, clientX: x, clientY: y });
  const pu = (id, x, y) => c._stagePointerUp({ pointerId: id, clientX: x, clientY: y });
  let pid = 100;
  /** Drag 80x60 px across the middle of the scene; did the view follow? */
  const drag = async (zoom) => {
    // always start from the plan in the middle: the clamp is a real limit, and
    // a dozen drags in a row would otherwise walk into it
    const vb = c._baseVb();
    c._applyView(zoom, vb[0] + vb[2] / 2, vb[1] + vb[3] / 2);
    await c.updateComplete;
    const v0 = { ...c._viewOr(c._baseVb()) };
    const id = ++pid;
    pd(id, 300, 300);
    pm(id, 340, 330);
    pm(id, 380, 360);
    const v1 = { ...c._viewOr(c._baseVb()) };
    pu(id, 380, 360);
    // dragging down-right pulls the viewport up-left, and the zoom is untouched
    return Math.abs(v1.x - v0.x) > 1 && Math.abs(v1.y - v0.y) > 1
      && v1.x < v0.x && v1.y < v0.y && Math.abs(c._zoom - zoom) < 1e-9;
  };
  const inMode = async (name, setup) => {
    await setup();
    await c.updateComplete;
    o['pan_' + name + '_at100'] = await drag(1);
    o['pan_' + name + '_at50'] = await drag(0.5);
    o['pan_' + name + '_at33'] = await drag(1 / 3);
  };

  await inMode('view', async () => { c._setMode('view'); });
  for (const tool of ['draw', 'merge', 'split', 'resize', 'opening', 'openwall', 'delroom']) {
    await inMode('plan_' + tool, async () => { c._setMode('plan'); c._tool = tool; });
  }
  await inMode('devices', async () => { c._setMode('devices'); });
  await inMode('decor', async () => { c._setMode('decor'); c._decorTool = 'select'; });
  c._setMode('view');
  c._applyView(1);
  await c.updateComplete;
  return o;
}));

// ---- 400 % still pans (the behaviour that already worked) ----------------
out.panStillWorksZoomedIn = await page.evaluate(async () => {
  const c = window.__card;
  c._setMode('view'); c._applyView(4); await c.updateComplete;
  const v0 = { ...c._view };
  c._stagePointerDown({ pointerId: 7, clientX: 300, clientY: 300, target: c._stageEl, preventDefault() {} });
  c._stagePointerMove({ pointerId: 7, clientX: 380, clientY: 360 });
  const moved = Math.abs(c._view.x - v0.x) > 1;
  c._stagePointerUp({ pointerId: 7, clientX: 380, clientY: 360 });
  c._applyView(1);
  return moved;
});

// ---- the clamp: you may walk about a screen off, never further ------------
Object.assign(out, await page.evaluate(async () => {
  const c = window.__card;
  const sr = c.shadowRoot || c.renderRoot;
  const o = {};
  c._setMode('view');
  const vb = c._baseVb();
  c._applyView(1, vb[0] + vb[2] / 2, vb[1] + vb[3] / 2); // at 100 % the view IS fitView
  await c.updateComplete;
  const fit = { ...c._view };
  c._stagePointerDown({ pointerId: 8, clientX: 700, clientY: 400, target: c._stageEl, preventDefault() {} });
  c._stagePointerMove({ pointerId: 8, clientX: -40000, clientY: 400 }); // shove it into the void
  const far = { ...c._view };
  c._stagePointerUp({ pointerId: 8, clientX: -40000, clientY: 400 });
  o.panLeavesTheContent = far.x > fit.x + fit.w * 0.5;
  o.panStopsAtTheSlack = far.x <= fit.x + fit.w + 1;
  c.requestUpdate(); await c.updateComplete;
  o.homeArrowOffersTheWayBack = !!sr.querySelector('.homearrow');
  c._applyView(1, vb[0] + vb[2] / 2, vb[1] + vb[3] / 2);
  c.requestUpdate(); await c.updateComplete;
  // the same at 50 %: the screen holds more, the walk is still finite
  const fit2 = { ...c._view };
  c._applyView(0.5, vb[0] + vb[2] / 2, vb[1] + vb[3] / 2); await c.updateComplete;
  c._stagePointerDown({ pointerId: 9, clientX: 700, clientY: 400, target: c._stageEl, preventDefault() {} });
  c._stagePointerMove({ pointerId: 9, clientX: -40000, clientY: 400 });
  const far2 = { ...c._view };
  c._stagePointerUp({ pointerId: 9, clientX: -40000, clientY: 400 });
  o.panStopsAtTheSlackZoomedOut = far2.x <= fit2.x + fit2.w + 1 && far2.x > fit2.x;
  c._applyView(1, vb[0] + vb[2] / 2, vb[1] + vb[3] / 2); await c.updateComplete;
  return o;
}));

// ---- the tools still own their pointer ------------------------------------
const ev = (type, id, x, y) => ({ type, id, x, y });
Object.assign(out, await page.evaluate(async () => {
  const c = window.__card;
  const sr = c.shadowRoot || c.renderRoot;
  const o = {};
  const fire = (el, type, id, x, y) => el.dispatchEvent(new PointerEvent(type, {
    bubbles: true, composed: true, cancelable: true, pointerId: id, clientX: x, clientY: y,
  }));

  // a) resize handle: the wall moves, the view does not
  c._setMode('plan'); c._tool = 'resize'; c._applyView(1); await c.updateComplete;
  const h = sr.querySelector('.rszhandle');
  o.resizeHandlePresent = !!h;
  if (h) {
    const v0 = { ...c._viewOr(c._baseVb()) };
    const r = h.getBoundingClientRect();
    fire(h, 'pointerdown', 21, r.left + r.width / 2, r.top + r.height / 2);
    o.resizeHandleTakesThePointer = !!c._rszDrag && c._panStart === null;
    fire(h, 'pointermove', 21, r.left + r.width / 2 + 40, r.top + r.height / 2 + 40);
    const v1 = { ...c._viewOr(c._baseVb()) };
    o.resizeHandleDoesNotPan = Math.abs(v1.x - v0.x) < 0.5 && Math.abs(v1.y - v0.y) < 0.5;
    o.resizeHandleResizes = !!c._rszDrag && c._rszDrag.moved === true;
    c._rszCancelDrag?.();
    fire(h, 'pointerup', 21, r.left + r.width / 2 + 40, r.top + r.height / 2 + 40);
  }
  c._rszSel = null;

  // b) a device badge in the devices editor drags the DEVICE
  c._setMode('devices'); c._applyView(1); await c.updateComplete;
  const dev = sr.querySelector('.devlayer .dev');
  o.devicePresent = !!dev;
  if (dev) {
    const v0 = { ...c._viewOr(c._baseVb()) };
    const r = dev.getBoundingClientRect();
    fire(dev, 'pointerdown', 22, r.left + r.width / 2, r.top + r.height / 2);
    o.deviceTakesThePointer = !!c._drag && c._panStart === null;
    fire(dev, 'pointermove', 22, r.left + r.width / 2 + 40, r.top + r.height / 2 + 30);
    c._stagePointerMove({ pointerId: 22, clientX: r.left + 60, clientY: r.top + 50 });
    const v1 = { ...c._viewOr(c._baseVb()) };
    o.deviceDragDoesNotPan = Math.abs(v1.x - v0.x) < 0.5 && Math.abs(v1.y - v0.y) < 0.5;
    o.deviceActuallyMoved = !!c._drag && c._drag.moved === true;
    fire(dev, 'pointerup', 22, r.left + r.width / 2 + 40, r.top + r.height / 2 + 30);
    // _pointerUp releases _drag on the next macrotask, and _stagePointerDown
    // refuses to start a gesture while a device drag is live
    await new Promise((r2) => setTimeout(r2, 20));
    o.deviceDragReleased = c._drag === null;
    await c.updateComplete;
  }

  // c) an opening drags along its wall, the view stays put
  const cfg = JSON.parse(JSON.stringify(c._serverCfg));
  cfg.spaces[0].openings = [{ id: 'o_pan', type: 'window', x: 0.3, y: 0.14, angle: 0, length: 0.1 }];
  c._serverCfg = cfg; c._modelCache = null; c._frame = null;
  c._setMode('plan'); c._tool = 'draw'; c._applyView(1);
  c.requestUpdate(); await c.updateComplete;
  const op = sr.querySelector('.op-hit');
  o.openingPresent = !!op;
  if (op) {
    const v0 = { ...c._viewOr(c._baseVb()) };
    const r = op.getBoundingClientRect();
    fire(op, 'pointerdown', 23, r.left + r.width / 2, r.top + r.height / 2);
    o.openingTakesThePointer = !!c._opDrag && c._panStart === null;
    fire(op, 'pointermove', 23, r.left + r.width / 2 + 50, r.top + r.height / 2);
    const v1 = { ...c._viewOr(c._baseVb()) };
    o.openingDragDoesNotPan = Math.abs(v1.x - v0.x) < 0.5 && Math.abs(v1.y - v0.y) < 0.5;
    fire(op, 'pointerup', 23, r.left + r.width / 2 + 50, r.top + r.height / 2);
    await c.updateComplete;
  }

  // d) a drawing tool is still a drawing tool: two fingers pinch, they do not pan
  c._setMode('plan'); c._tool = 'draw'; c._applyView(1); await c.updateComplete;
  const z0 = c._zoom;
  c._stagePointerDown({ pointerId: 31, clientX: 300, clientY: 300, target: c._stageEl, preventDefault() {} });
  c._stagePointerDown({ pointerId: 32, clientX: 400, clientY: 300, target: c._stageEl, preventDefault() {} });
  c._stagePointerMove({ pointerId: 31, clientX: 250, clientY: 300 });
  c._stagePointerMove({ pointerId: 32, clientX: 450, clientY: 300 });
  o.pinchStillZooms = c._zoom > z0 * 1.5;
  c._stagePointerUp({ pointerId: 31, clientX: 250, clientY: 300 });
  c._stagePointerUp({ pointerId: 32, clientX: 450, clientY: 300 });
  c._path = [];
  c._setMode('view'); c._applyView(1); await c.updateComplete;
  return o;
}));

// ---- the kiosk keeps its floor swipe ---------------------------------------
Object.assign(out, await page.evaluate(async () => {
  const c0 = window.__card;
  const o = {};
  const k = document.createElement('houseplan-card');
  k.setConfig({ type: 'custom:houseplan-card', kiosk: true, cycle: 0 });
  k.hass = c0.hass;
  document.body.appendChild(k);
  k.style.cssText = 'position:fixed;left:0;top:0;width:900px;height:700px;z-index:99';
  await new Promise((r) => setTimeout(r, 500));
  k.hass = { ...c0.hass };
  await k.updateComplete;
  const sr = k.shadowRoot || k.renderRoot;
  const stage = sr.querySelector('.stage');
  const fire = (type, id, x, y) => stage.dispatchEvent(new PointerEvent(type, {
    bubbles: true, composed: true, cancelable: true, pointerId: id, clientX: x, clientY: y,
  }));
  k._applyView(1); await k.updateComplete;
  const s0 = k._space;
  const v0 = { ...k._viewOr(k._baseVb()) };
  // a REAL swipe: down, several moves, up — the moves are what used to be
  // impossible to add to smoke_kiosk without hijacking the gesture
  fire('pointerdown', 41, 600, 300);
  fire('pointermove', 41, 540, 302);
  fire('pointermove', 41, 480, 305);
  fire('pointermove', 41, 450, 305);
  const midPan = Math.abs(k._viewOr(k._baseVb()).x - v0.x);
  fire('pointerup', 41, 450, 305);
  await k.updateComplete;
  o.kioskSwipeStillSwitchesFloors = k._space !== s0;
  o.kioskHorizontalDragIsNotAPan = midPan < 1;
  // …and the plan is not left hanging half-panned after the switch
  o.kioskViewCenteredAfterSwipe = Math.abs(k._viewOr(k._baseVb()).x - v0.x) < 2000;
  // a VERTICAL drag is nobody's swipe, so it pans like everywhere else
  const s1 = k._space;
  const v1 = { ...k._viewOr(k._baseVb()) };
  fire('pointerdown', 42, 450, 200);
  fire('pointermove', 42, 452, 260);
  fire('pointermove', 42, 454, 330);
  const panned = Math.abs(k._viewOr(k._baseVb()).y - v1.y) > 1;
  fire('pointerup', 42, 454, 330);
  await k.updateComplete;
  o.kioskVerticalDragPans = panned;
  o.kioskVerticalDragKeepsFloor = k._space === s1;
  // zoomed in, a horizontal drag pans (no swipe up there — unchanged rule)
  k._applyView(2); await k.updateComplete;
  const v2 = { ...k._view };
  const s2 = k._space;
  fire('pointerdown', 43, 600, 300);
  fire('pointermove', 43, 540, 302);
  fire('pointermove', 43, 480, 305);
  const pannedZoomed = Math.abs(k._view.x - v2.x) > 1;
  fire('pointerup', 43, 480, 305);
  await k.updateComplete;
  o.kioskZoomedHorizontalPans = pannedZoomed;
  o.kioskZoomedDoesNotSwipe = k._space === s2;
  k.remove();
  return o;
}));

await finish(browser, checkAll(out));
