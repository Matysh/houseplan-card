// DEV-B58-01 — the infinite canvas reached the FRAME and the drawing, but not
// the drag handlers. A device marker was clamped into the CONTENT FRAME (with
// a 0.8 % inset), a room label into the space's stored view_box — which, for
// every plan the card has ever written, is the old unit square. The owner and a
// user hit the same wall: "названия комнат и устройства не перетаскиваются
// дальше старых границ холста".
//
// Every interactive coordinate now has ONE bound: the ±5000 the backend
// enforces (docs/CANVAS.md §9). This smoke starts from an ORDINARY plan — one
// that lives inside 0..1, so the old clamps really were in the way — and drags
// each kind of thing out to 2.5 / 2.2 and beyond.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 900, height: 820 }, 1);

const out = await page.evaluate(async () => {
  const o = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const NORM_W = 1000;
  const near = (a, b, eps = 1 / 240) => Math.abs(a - b) <= eps + 1e-9;
  const onGrid = (v) => Math.abs(v * 240 - Math.round(v * 240)) < 1e-9;

  // the demo plan is an ordinary one: rooms inside the old unit square
  const b0 = c._baseVb();
  o.startsFromAnOrdinaryPlan = b0[0] + b0[2] < 1.3 * NORM_W && b0[1] + b0[3] < 1.3 * NORM_W;

  /** Turn a wanted RENDER-unit delta into the clientX/clientY a handler wants. */
  const mk = (dxu, dyu, sx = 400, sy = 400, extra = {}) => {
    const rect = sr().querySelector('.stage').getBoundingClientRect();
    const v = c._viewOr(c._baseVb());
    return new PointerEvent('pointermove', {
      clientX: sx + (dxu / v.w) * rect.width,
      clientY: sy + (dyu / v.h) * rect.height,
      bubbles: true, ...extra,
    });
  };

  // ---- (a) a DEVICE MARKER goes to 2.5 / 2.2 ---------------------------
  c._setMode('devices'); await c.updateComplete;
  const dev = c._devices.find((d) => !d.virtual);
  const p0 = c._pos(dev);
  c._drag = { id: dev.id, sx: 400, sy: 400, ox: p0.x, oy: p0.y, moved: false };
  c._pointerMove(mk(2.5 * NORM_W - p0.x, 2.2 * NORM_W - p0.y), dev);
  c._pointerUp(new PointerEvent('pointerup'), dev);
  await c.updateComplete;
  const saved = c._layout[dev.id];
  o.markerLeftTheOldCanvas = near(saved.x, 2.5) && near(saved.y, 2.2);
  o.markerIsOnTheGrid = onGrid(saved.x) && onGrid(saved.y);

  // ---- (b) it SURVIVES a rebuild ---------------------------------------
  c._drag = null;
  c._modelCache = null; c._frame = null; c._defPos = c._defaultPositions();
  c.requestUpdate(); await c.updateComplete;
  const back = c._pos(c._devices.find((d) => d.id === dev.id));
  o.markerSurvivesRebuild = near(back.x / NORM_W, 2.5) && near(back.y / NORM_W, 2.2);
  // …and the frame followed it out there instead of pretending it is elsewhere
  const b1 = c._baseVb();
  o.frameFollowedTheMarker = b1[0] + b1[2] > 2.4 * NORM_W;

  // ---- (c) a ROOM LABEL, the worse of the two (it clamped to view_box) --
  c._setMode('plan'); await c.updateComplete;
  const room = c._spaceModel(c._space).rooms.find((r) => r.name);
  const lp = c._labelPos(room, c._space);
  c._drag = { id: 'rl_' + room.id, sx: 400, sy: 400, ox: lp.x, oy: lp.y, moved: false };
  c._labelMove(mk(2.7 * NORM_W - lp.x, 2.4 * NORM_W - lp.y), room, c._space);
  c._labelUp(room);
  await c.updateComplete;
  const sl = c._layout['rl_' + room.id];
  o.labelLeftTheOldCanvas = near(sl.x, 2.7) && near(sl.y, 2.4);
  o.labelIsOnTheGrid = onGrid(sl.x) && onGrid(sl.y);
  c._drag = null;
  c.requestUpdate(); await c.updateComplete;
  const lp2 = c._labelPos(room, c._space);
  o.labelSurvivesRebuild = near(lp2.x / NORM_W, 2.7) && near(lp2.y / NORM_W, 2.4);

  // ---- (d) DECOR born far out, and moved further still -------------------
  c._setMode('decor'); await c.updateComplete;
  c._decorTool = 'rect';
  c._decorDraft = { kind: 'rect', a: [2.6 * NORM_W, 2.6 * NORM_W], b: [2.9 * NORM_W, 2.8 * NORM_W], pid: 1 };
  c._decorCommitDraft(); await c.updateComplete;
  const sh = c._decorList[c._decorList.length - 1];
  o.decorBornFarOut = near(sh.x, 2.6) && near(sh.y, 2.6);
  // the decor mover works in ABSOLUTE svg points, so the gesture is built the
  // way _decorShapeDown builds it: grab at the shape, release 0.6/0.5 away
  const atUnits = (X, Y) => {
    const rect = sr().querySelector('.stage').getBoundingClientRect();
    const v = c._viewOr(c._baseVb());
    return new PointerEvent('pointermove', {
      clientX: rect.left + ((X - v.x) / v.w) * rect.width,
      clientY: rect.top + ((Y - v.y) / v.h) * rect.height, bubbles: true,
    });
  };
  const grab = c._svgPoint(atUnits(2.6 * NORM_W, 2.6 * NORM_W));
  c._decorMove = { id: sh.id, start: grab,
    orig: JSON.parse(JSON.stringify(sh)), pid: 2, moved: false };
  c._decorMoveUpdate(atUnits(3.2 * NORM_W, 3.1 * NORM_W));
  await c.updateComplete;
  const sh2 = c._decorList.find((x) => x.id === sh.id);
  o.decorMovedFurtherOut = near(sh2.x, 3.2) && near(sh2.y, 3.1);
  c._decorMove = null;

  // ---- (e) the ONE bound that is left is the backend's ±5000 ------------
  c._setMode('devices'); await c.updateComplete;
  const dev2 = c._devices.find((d) => d.id !== dev.id && !d.virtual);
  const q0 = c._pos(dev2);
  c._drag = { id: dev2.id, sx: 400, sy: 400, ox: q0.x, oy: q0.y, moved: false };
  c._pointerMove(mk(9e9, 9e9), dev2);
  c._pointerUp(new PointerEvent('pointerup'), dev2);
  c._drag = null;
  o.garbageStillClamped = c._layout[dev2.id].x === 5000 && c._layout[dev2.id].y === 5000;

  // ---- (f) Shift cannot land between the nodes ---------------------------
  const dev3 = c._devices.find((d) => d.id !== dev.id && d.id !== dev2.id && !d.virtual);
  const r0 = c._pos(dev3);
  const halfStep = NORM_W / 240 / 2;
  c._drag = { id: dev3.id, sx: 400, sy: 400, ox: r0.x, oy: r0.y, moved: false };
  c._pointerMove(mk(2.5 * NORM_W + halfStep - r0.x, 2.5 * NORM_W - r0.y, 400, 400, { shiftKey: true }), dev3);
  c._drag = null;
  o.shiftStillSnapsToTheNodes = onGrid(c._layout[dev3.id].x);

  c._setMode('view');
  return o;
});

await finish(browser, checkAll(out));
