// A kiosk gesture is classified ONCE, and the release obeys that decision —
// audit DEV-1DA1-02 (P2).
//
// `_stagePointerMove` locks the gesture on the first movement past 8 px
// (`_panLock`: 'swipe' only for a sufficiently horizontal inward move that
// started inside the 48 px strip of an edge with a neighbour, 'pan' otherwise).
// A pan then follows the finger. But `_stagePointerUp` used
// to ignore that lock and ask `swipeTarget()` again, from the raw start→end
// vector alone. A CURVED gesture — a small vertical lead-in that locks 'pan',
// then a long horizontal sweep — therefore panned under the finger and still
// switched the floor on release. On a wall tablet that is the worst kind of
// surprise: you watch the plan drag along and land on another storey.
//
// The lock is now final: with `_panLock === 'pan'` the floor never changes, no
// matter what the overall vector looks like. The two straight gestures keep
// their intended behaviour, and so does the motionless double tap (no movement,
// no lock — the swipe path is never even reached by it).
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const out = await page.evaluate(async () => {
  const o = {};
  const c0 = window.__card;
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
  const rect = stage.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const rightEdgeX = rect.right - 20;
  const fire = (type, id, x, y) => stage.dispatchEvent(new PointerEvent(type, {
    bubbles: true, composed: true, cancelable: true, pointerId: id,
    pointerType: 'touch', isPrimary: true, button: 0, clientX: x, clientY: y,
  }));
  o.kioskHasSeveralSpaces = k._model.length > 1;

  const home = async () => {
    k._commitSpace(k._model[0].id, true);
    const vb = k._baseVb();
    k._applyView(1, vb[0] + vb[2] / 2, vb[1] + vb[3] / 2);
    k.requestUpdate();
    await k.updateComplete;
  };
  /**
   * Play one trajectory and report what the gesture decided and what it did.
   * `pts` are the moves; the finger lifts at the last one.
   */
  const play = async (id, from, pts) => {
    await home();
    const s0 = k._space;
    const v0 = { ...k._viewOr(k._baseVb()) };
    fire('pointerdown', id, from[0], from[1]);
    let lockAfterLeadIn = null;
    let moved = false;
    pts.forEach((p, i) => {
      fire('pointermove', id, p[0], p[1]);
      if (i === 0) lockAfterLeadIn = k._panLock;
      if (Math.abs(k._viewOr(k._baseVb()).x - v0.x) > 1
        || Math.abs(k._viewOr(k._baseVb()).y - v0.y) > 1) moved = true;
    });
    const lockBeforeRelease = k._panLock;
    const last = pts[pts.length - 1];
    fire('pointerup', id, last[0], last[1]);
    await k.updateComplete;
    return { s0, s1: k._space, lockAfterLeadIn, lockBeforeRelease, moved };
  };

  // ---- 1. the auditor's curved pan: vertical lead-in, horizontal ending --
  // (500,300) → (502,312) locks 'pan' → curve left to (350,304) → release.
  // dx = -150, dy = +4: swipeTarget() would happily call that a swipe.
  const curvedPan = await play(51, [centerX, centerY], [
    [centerX + 2, centerY + 12], [centerX - 40, centerY + 10],
    [centerX - 100, centerY + 6], [centerX - 150, centerY + 4],
  ]);
  o.curvedPanLocksPan = curvedPan.lockAfterLeadIn === 'pan';
  o.curvedPanKeepsTheLock = curvedPan.lockBeforeRelease === 'pan';
  o.curvedPanActuallyPans = curvedPan.moved === true;
  o.curvedPanKeepsTheFloor = curvedPan.s1 === curvedPan.s0;
  // the same trajectory the other way round — a swipe to the right would have
  // been the previous floor, so the bug is symmetric and so is the fix
  const curvedPanRight = await play(52, [centerX, centerY], [
    [centerX + 2, centerY + 12], [centerX + 60, centerY + 8],
    [centerX + 120, centerY + 5], [centerX + 160, centerY + 4],
  ]);
  o.curvedPanRightLocksPan = curvedPanRight.lockAfterLeadIn === 'pan';
  o.curvedPanRightKeepsTheFloor = curvedPanRight.s1 === curvedPanRight.s0;
  // a long diagonal that ends up dominated by x, but started as a pan
  const diagonalPan = await play(53, [centerX, centerY], [
    [centerX - 4, centerY + 16], [centerX - 80, centerY + 40],
    [centerX - 170, centerY + 50], [centerX - 240, centerY + 52],
  ]);
  o.diagonalPanLocksPan = diagonalPan.lockAfterLeadIn === 'pan';
  o.diagonalPanKeepsTheFloor = diagonalPan.s1 === diagonalPan.s0;
  // Even when a drag starts in the active edge strip, a vertical first move
  // owns it as pan forever; a later horizontal tail cannot reclassify release.
  const edgeCurvedPan = await play(62, [rightEdgeX, centerY], [
    [rightEdgeX - 2, centerY + 14], [rightEdgeX - 80, centerY + 10],
    [rightEdgeX - 170, centerY + 5],
  ]);
  o.edgeCurvedPanLocksPan = edgeCurvedPan.lockAfterLeadIn === 'pan';
  o.edgeCurvedPanActuallyPans = edgeCurvedPan.moved === true;
  o.edgeCurvedPanKeepsTheFloor = edgeCurvedPan.s1 === edgeCurvedPan.s0;

  // ---- 2. a gesture locked as a SWIPE keeps its own semantics ------------
  // horizontal lead-in locks 'swipe'; the plan must not slide under it, even
  // when the trajectory then bends vertically and the final vector no longer
  // qualifies — the floor simply stays, and nothing pans
  const curvedSwipe = await play(54, [rightEdgeX, centerY], [
    [rightEdgeX - 60, centerY + 2], [rightEdgeX - 64, centerY + 80],
    [rightEdgeX - 55, centerY + 200],
  ]);
  o.curvedSwipeLocksSwipe = curvedSwipe.lockAfterLeadIn === 'swipe';
  o.curvedSwipeNeverPans = curvedSwipe.moved === false;
  o.curvedSwipeThatDiesChangesNothing = curvedSwipe.s1 === curvedSwipe.s0;
  // a swipe that bends but still ends as a swipe does switch the floor
  const bentSwipe = await play(55, [rightEdgeX, centerY], [
    [rightEdgeX - 60, centerY + 2], [rightEdgeX - 130, centerY + 30],
    [rightEdgeX - 180, centerY + 40],
  ]);
  o.bentSwipeLocksSwipe = bentSwipe.lockAfterLeadIn === 'swipe';
  o.bentSwipeNeverPans = bentSwipe.moved === false;
  o.bentSwipeStillSwitches = bentSwipe.s1 !== bentSwipe.s0;

  // ---- 3. the straight gestures are exactly as they were -----------------
  const straightSwipe = await play(56, [rightEdgeX, centerY], [
    [rightEdgeX - 60, centerY + 2], [rightEdgeX - 120, centerY + 5],
    [rightEdgeX - 150, centerY + 5],
  ]);
  o.straightSwipeSwitches = straightSwipe.s1 !== straightSwipe.s0;
  o.straightSwipeDoesNotPan = straightSwipe.moved === false;
  const straightPan = await play(57, [centerX, centerY - 100], [
    [centerX + 2, centerY - 40], [centerX + 4, centerY + 30],
  ]);
  o.straightPanPans = straightPan.moved === true;
  o.straightPanKeepsTheFloor = straightPan.s1 === straightPan.s0;
  const centralHorizontalPan = await play(61, [centerX, centerY], [
    [centerX - 60, centerY + 2], [centerX - 150, centerY + 5],
  ]);
  o.centralHorizontalDragPans = centralHorizontalPan.moved === true;
  o.centralHorizontalDragKeepsTheFloor = centralHorizontalPan.s1 === centralHorizontalPan.s0;

  // ---- 4. a motionless double tap still resets the zoom ------------------
  // no movement means no lock at all, so nothing above can reach this path
  await home();
  k._applyView(2);
  await k.updateComplete;
  for (const id of [58, 60]) {
    fire('pointerdown', id, centerX, centerY);
    fire('pointerup', id, centerX + 1, centerY);
  }
  const resetStarted = performance.now();
  do { await new Promise((resolve) => requestAnimationFrame(resolve)); }
  while (k._cameraTransition.active && performance.now() - resetStarted < 1000);
  await k.updateComplete;
  o.doubleTapStillResetsZoom = k._zoom === 1;
  o.doubleTapLeavesNoLock = k._panLock === null;

  // ---- 5. zoomed in there is no swipe zone, and the lock says so ---------
  k._applyView(2);
  await k.updateComplete;
  const zoomed = await (async () => {
    const s0 = k._space;
    fire('pointerdown', 59, rightEdgeX, centerY);
    fire('pointermove', 59, rightEdgeX - 60, centerY + 2);
    const lock = k._panLock;
    fire('pointermove', 59, rightEdgeX - 120, centerY + 5);
    fire('pointerup', 59, rightEdgeX - 120, centerY + 5);
    await k.updateComplete;
    return { lock, same: k._space === s0 };
  })();
  o.zoomedHorizontalLocksPan = zoomed.lock === 'pan';
  o.zoomedHorizontalKeepsTheFloor = zoomed.same;

  k.remove();
  return o;
});
checkAll(out);
await finish(browser, out);
