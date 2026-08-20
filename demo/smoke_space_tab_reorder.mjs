// Issue #220: the order of the space tabs is changed by dragging one of them.
//
// The demo fixture has two spaces, which is all the panel needs to prove the
// contract. What this smoke protects is not the animation but the three
// promises around it: the
// new order survives a save, an ordinary click still switches the space, and
// nothing of the sort exists in View, where the same tabs are a touch-first
// navigation control.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch({ width: 1100, height: 900 }, 1);
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const tabs = () => [...sr().querySelectorAll('[data-hp="space-tab"]')];
  const ids = () => tabs().map((tab) => tab.dataset.id);
  const settle = async () => {
    const started = performance.now();
    do { await new Promise((r) => requestAnimationFrame(r)); }
    while (c._modeTransitionBusy && performance.now() - started < 1500);
    await c.updateComplete;
  };

  // A save must reach the server exactly once per drop, and carry the order.
  const writes = [];
  const realWrite = c._writeConfig.bind(c);
  c._writeConfig = () => {
    writes.push((c._serverCfg.spaces || []).map((space) => space.id));
    return Promise.resolve();
  };

  const drag = async (fromId, toId, { travel = 40 } = {}) => {
    const from = tabs().find((tab) => tab.dataset.id === fromId);
    const to = tabs().find((tab) => tab.dataset.id === toId);
    const a = from.getBoundingClientRect();
    const b = to.getBoundingClientRect();
    const event = (type, x, y, target) => target.dispatchEvent(new PointerEvent(type, {
      pointerId: 7, pointerType: 'mouse', clientX: x, clientY: y, bubbles: true, composed: true,
    }));
    event('pointerdown', a.x + a.width / 2, a.y + a.height / 2, from);
    // one intermediate move on the source keeps the gesture honest: the drag
    // must begin from travel, not from merely touching a second tab
    event('pointermove', a.x + a.width / 2 + travel, a.y + a.height / 2, from);
    event('pointermove', b.x + b.width / 2, b.y + b.height / 2, to);
    event('pointerup', b.x + b.width / 2, b.y + b.height / 2, to);
    await settle();
    // The write is debounced (~500 ms). Waiting for it is the point: a smoke
    // that checks the panel and leaves proves the DOM, not the save.
    const deadline = performance.now() + 1500;
    const seen = writes.length;
    while (writes.length === seen && performance.now() < deadline) {
      await new Promise((r) => setTimeout(r, 25));
    }
  };

  await settle();
  c._mode = 'plan';
  c.requestUpdate();
  await settle();

  // A marker with neither an explicit space nor an area that names one is the
  // whole reason this feature has to be careful: today it renders in whichever
  // space sits first, so a reorder would hand it to another one. The fixture
  // has no such marker, so the smoke plants it — otherwise the guarantee would
  // be tested only as a pure function, never as applied behaviour.
  const firstBefore = c._model[0].id;
  c._serverCfg.markers = [
    ...(c._serverCfg.markers || []),
    { id: 'smoke-dangling', binding: 'virtual', name: 'dangling' },
  ];
  const dangling = () => (c._serverCfg.markers || [])
    .find((marker) => marker.id === 'smoke-dangling');
  out.plantedMarkerStartsWithoutSpace = !dangling().space;

  const before = ids();
  out.enoughTabsToReorder = before.length >= 2;
  out.reorderableInEditor = tabs()[0].hasAttribute('data-reorderable');

  // --- AC1: the drop changes the order and asks for a save -------------------
  const moved = before[before.length - 1];
  const target = before[0];
  const active = c._space;
  await drag(moved, target);
  const after = ids();
  out.tabMovedToTheFront = after[0] === moved;
  out.otherTabsKeptOrder = JSON.stringify(after.filter((id) => id !== moved))
    === JSON.stringify(before.filter((id) => id !== moved));
  out.orderReachedTheServer = writes.length >= 1;
  out.savedOrderMatchesPanel = JSON.stringify(writes[writes.length - 1])
    === JSON.stringify(after);
  out.activeSpaceUnchanged = c._space === active;
  // AC3: the order-dependent marker keeps the space it had, written down.
  out.danglingMarkerPinnedToItsOldSpace = dangling().space === firstBefore;
  out.danglingMarkerDidNotFollowTheOrder = dangling().space !== ids()[0]
    || firstBefore === ids()[0];

  // --- AC7: the positional-floor warning is said once ------------------------
  out.warnedAboutPositionalFloor = typeof c._toast === 'string' && c._toast.length > 0;
  c._toast = '';
  const second = ids();
  await drag(second[second.length - 1], second[0]);
  out.secondDropAlsoReordered = ids()[0] === second[second.length - 1];
  out.warningNotRepeated = !c._toast;

  // --- AC2: a click without travel still switches the space ------------------
  const other = ids().find((id) => id !== c._space);
  const writesBeforeClick = writes.length;
  await new Promise((r) => setTimeout(r, 700));   // let any pending debounce land
  const tab = tabs().find((t) => t.dataset.id === other);
  const rect = tab.getBoundingClientRect();
  const at = (type) => tab.dispatchEvent(new PointerEvent(type, {
    pointerId: 8, pointerType: 'mouse', composed: true,
    clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2, bubbles: true,
  }));
  at('pointerdown'); at('pointermove'); at('pointerup');
  tab.click();
  await settle();
  out.clickStillSwitchesSpace = c._space === other;
  await new Promise((r) => setTimeout(r, 700));
  out.clickDidNotReorder = writes.length === writesBeforeClick;

  // --- AC5: touch and View never start a drag -------------------------------
  const touchOrder = ids();
  const src = tabs()[tabs().length - 1];
  const dst = tabs()[0];
  const ra = src.getBoundingClientRect();
  const rb = dst.getBoundingClientRect();
  const touch = (type, x, y, target) => target.dispatchEvent(new PointerEvent(type, {
    pointerId: 9, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, composed: true,
  }));
  touch('pointerdown', ra.x + ra.width / 2, ra.y + ra.height / 2, src);
  touch('pointermove', rb.x + rb.width / 2, rb.y + rb.height / 2, dst);
  touch('pointerup', rb.x + rb.width / 2, rb.y + rb.height / 2, dst);
  await settle();
  out.touchDidNotReorder = JSON.stringify(ids()) === JSON.stringify(touchOrder);

  c._mode = 'view';
  c.requestUpdate();
  await settle();
  out.notReorderableInView = !tabs()[0].hasAttribute('data-reorderable');
  const viewOrder = ids();
  await drag(viewOrder[viewOrder.length - 1], viewOrder[0]);
  out.viewDidNotReorder = JSON.stringify(ids()) === JSON.stringify(viewOrder);

  // --- review r1 M1: the mouse is released away from the panel ---------------
  //
  // A horizontal drag that ends a few pixels below the tabs is ordinary hand
  // imprecision. Without pointer capture no tab ever sees the release, the
  // gesture stays stuck with moved:true, and the next click is swallowed by
  // _tabClick — the panel simply stops switching spaces.
  c._mode = 'plan';
  c.requestUpdate();
  await settle();
  const strayTabs = tabs();
  const strayFrom = strayTabs[strayTabs.length - 1];
  const strayRect = strayFrom.getBoundingClientRect();
  const stray = (type, x, y) => strayFrom.dispatchEvent(new PointerEvent(type, {
    pointerId: 11, pointerType: 'mouse', clientX: x, clientY: y, bubbles: true, composed: true,
  }));
  stray('pointerdown', strayRect.x + strayRect.width / 2, strayRect.y + strayRect.height / 2);
  stray('pointermove', strayRect.x + strayRect.width / 2 + 40, strayRect.y + strayRect.height / 2);
  // released far below the panel, where no tab lives
  // released on the stage, not on a tab: without pointer capture no tab
  // handler ever runs and the gesture stays stuck
  (sr().querySelector('.stage') || document.body).dispatchEvent(new PointerEvent('pointerup', {
    pointerId: 11, pointerType: 'mouse', composed: true,
    clientX: strayRect.x + 400, clientY: strayRect.y + 400, bubbles: true,
  }));
  await settle();
  out.strayReleaseEndedTheDrag = c._tabDrag === null;
  const strayTarget = ids().find((id) => id !== c._space);
  const strayNext = tabs().find((tab) => tab.dataset.id === strayTarget);
  strayNext.dispatchEvent(new PointerEvent('pointerdown', {
    pointerId: 12, pointerType: 'mouse', bubbles: true, composed: true,
  }));
  strayNext.dispatchEvent(new PointerEvent('pointerup', {
    pointerId: 12, pointerType: 'mouse', bubbles: true, composed: true,
  }));
  strayNext.click();
  await settle();
  out.panelStillSwitchesAfterStrayRelease = c._space === strayTarget;

  c._writeConfig = realWrite;
  return out;
});
checkAll(res);
await finish(browser, res);
