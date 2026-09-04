// A kiosk gesture is classified ONCE, and the release obeys that decision —
// audit DEV-1DA1-02 (P2).
//
// `_stagePointerMove` locks the gesture on the first movement past 8 px
// (`_panLock`: 'swipe' if it is horizontal enough inside the swipe zone, 'pan'
// otherwise) and the plan then follows the finger. But `_stagePointerUp` used
// to ignore that lock and ask `swipeTarget()` again, from the raw start→end
// vector alone. A CURVED gesture — a small vertical lead-in that locks 'pan',
// then a long horizontal sweep — therefore panned under the finger and still
// switched the floor on release. On a wall tablet that is the worst kind of
// surprise: you watch the plan drag along and land on another storey.
//
// The lock is now final: with `_panLock === 'pan'` the floor never changes, no
// matter what the overall vector looks like. The two straight gestures keep
// their old behaviour, and so does the motionless double tap (no movement,
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
  const fire = (type, id, x, y) => stage.dispatchEvent(new PointerEvent(type, {
    bubbles: true, composed: true, cancelable: true, pointerId: id,
    pointerType: 'touch', isPrimary: true, button: 0, clientX: x, clientY: y,
  }));
  o.kioskHasSeveralSpaces = k._model.length > 1;

  const home = async () => {
    const vb = k._baseVb();
    k._applyView(1, vb[0] + vb[2] / 2, vb[1] + vb[3] / 2);
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
  const curvedPan = await play(51, [500, 300], [[502, 312], [460, 310], [400, 306], [350, 304]]);
  o.curvedPanLocksPan = curvedPan.lockAfterLeadIn === 'pan';
  o.curvedPanKeepsTheLock = curvedPan.lockBeforeRelease === 'pan';
  o.curvedPanActuallyPans = curvedPan.moved === true;
  o.curvedPanKeepsTheFloor = curvedPan.s1 === curvedPan.s0;
  // the same trajectory the other way round — a swipe to the right would have
  // been the previous floor, so the bug is symmetric and so is the fix
  const curvedPanRight = await play(52, [400, 300], [[402, 312], [460, 308], [520, 305], [560, 304]]);
  o.curvedPanRightLocksPan = curvedPanRight.lockAfterLeadIn === 'pan';
  o.curvedPanRightKeepsTheFloor = curvedPanRight.s1 === curvedPanRight.s0;
  // a long diagonal that ends up dominated by x, but started as a pan
  const diagonalPan = await play(53, [500, 300], [[496, 316], [420, 340], [330, 350], [260, 352]]);
  o.diagonalPanLocksPan = diagonalPan.lockAfterLeadIn === 'pan';
  o.diagonalPanKeepsTheFloor = diagonalPan.s1 === diagonalPan.s0;

  // ---- 2. a gesture locked as a SWIPE keeps its own semantics ------------
  // horizontal lead-in locks 'swipe'; the plan must not slide under it, even
  // when the trajectory then bends vertically and the final vector no longer
  // qualifies — the floor simply stays, and nothing pans
  const curvedSwipe = await play(54, [600, 300], [[540, 302], [536, 380], [545, 500]]);
  o.curvedSwipeLocksSwipe = curvedSwipe.lockAfterLeadIn === 'swipe';
  o.curvedSwipeNeverPans = curvedSwipe.moved === false;
  o.curvedSwipeThatDiesChangesNothing = curvedSwipe.s1 === curvedSwipe.s0;
  // a swipe that bends but still ends as a swipe does switch the floor
  const bentSwipe = await play(55, [600, 300], [[540, 302], [470, 330], [420, 340]]);
  o.bentSwipeLocksSwipe = bentSwipe.lockAfterLeadIn === 'swipe';
  o.bentSwipeNeverPans = bentSwipe.moved === false;
  o.bentSwipeStillSwitches = bentSwipe.s1 !== bentSwipe.s0;

  // ---- 3. the straight gestures are exactly as they were -----------------
  const straightSwipe = await play(56, [600, 300], [[540, 302], [480, 305], [450, 305]]);
  o.straightSwipeSwitches = straightSwipe.s1 !== straightSwipe.s0;
  o.straightSwipeDoesNotPan = straightSwipe.moved === false;
  const straightPan = await play(57, [450, 200], [[452, 260], [454, 330]]);
  o.straightPanPans = straightPan.moved === true;
  o.straightPanKeepsTheFloor = straightPan.s1 === straightPan.s0;

  // ---- 4. a motionless double tap still resets the zoom ------------------
  // no movement means no lock at all, so nothing above can reach this path
  await home();
  k._applyView(2);
  await k.updateComplete;
  for (const id of [58, 60]) {
    fire('pointerdown', id, 500, 300);
    fire('pointerup', id, 501, 300);
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
    fire('pointerdown', 59, 600, 300);
    fire('pointermove', 59, 540, 302);
    const lock = k._panLock;
    fire('pointermove', 59, 480, 305);
    fire('pointerup', 59, 480, 305);
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
