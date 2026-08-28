// Issues #220/#243: space tabs reorder through the browser's real mouse input.
// Positive drag assertions must never dispatch pointermove at a chosen target:
// pointer capture is the mechanism under test and owns event delivery.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1100, height: 900 }, 1);
const out = {};

const settle = async () => page.evaluate(async () => {
  const c = window.__card;
  const started = performance.now();
  do { await new Promise((done) => requestAnimationFrame(done)); }
  while (c._modeTransitionBusy && performance.now() - started < 1500);
  await c.updateComplete;
});

const ids = () => page.evaluate(() => [...window.__card.renderRoot
  .querySelectorAll('[data-hp="space-tab"]')].map((tab) => tab.dataset.id));

const tabPoint = (id) => page.evaluate((tabId) => {
  const tab = [...window.__card.renderRoot.querySelectorAll('[data-hp="space-tab"]')]
    .find((item) => item.dataset.id === tabId);
  if (!tab) throw new Error(`space tab missing: ${tabId}`);
  const rect = tab.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}, id);

const writeCount = () => page.evaluate(() => window.__tabReorderWrites.length);
const insetX = (shadow) => Number(shadow.match(
  /([+-]?\d+(?:\.\d+)?)px\s+0px\s+0px\s+0px\s+inset/,
)?.[1] || 0);
const waitForWrites = async (count) => page.waitForFunction(
  (expected) => window.__tabReorderWrites.length >= expected, count, { timeout: 1800 },
);

const holdDrag = async (fromId, toId) => {
  const from = await tabPoint(fromId);
  const to = await tabPoint(toId);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await settle();
  return page.evaluate(({ fromId: sourceId, toId: targetId }) => {
    const c = window.__card;
    const tabs = [...c.renderRoot.querySelectorAll('[data-hp="space-tab"]')];
    const source = tabs.find((tab) => tab.dataset.id === sourceId);
    const target = tabs.find((tab) => tab.dataset.id === targetId);
    const style = target ? getComputedStyle(target) : null;
    return {
      drag: c._tabDrag ? { ...c._tabDrag } : null,
      sourceClass: source?.className || '',
      targetClass: target?.className || '',
      targetShadow: style?.boxShadow || '',
      trustedMoveSeen: window.__tabReorderTrustedMove === true,
    };
  }, { fromId, toId });
};

const releaseDrag = async (expectedWrites) => {
  await page.mouse.up();
  await waitForWrites(expectedWrites);
  await settle();
};

const setup = await page.evaluate(async () => {
  const c = window.__card;
  c._mode = 'plan';
  c.requestUpdate();
  await c.updateComplete;
  // The directional contract needs a source that can travel across both
  // sides. The demo fixture has two spaces, so add a third in-memory space to
  // the card and its write model without changing the shared demo fixture.
  if (!c._model.some((space) => space.id === 'smoke-third')) {
    const modelSpace = structuredClone(c._model.at(-1));
    modelSpace.id = 'smoke-third';
    modelSpace.title = 'Smoke third';
    const configSpace = structuredClone(c._serverCfg.spaces.at(-1));
    configSpace.id = modelSpace.id;
    configSpace.title = modelSpace.title;
    c._model = [...c._model, modelSpace];
    c._serverCfg.spaces = [...c._serverCfg.spaces, configSpace];
  }
  const firstBefore = c._model[0].id;
  c._space = firstBefore;
  c._serverCfg.markers = [
    ...(c._serverCfg.markers || []).filter((marker) => marker.id !== 'smoke-dangling'),
    { id: 'smoke-dangling', binding: 'virtual', name: 'dangling' },
  ];
  window.__tabReorderWrites = [];
  window.__tabReorderOriginalWrite = c._writeConfig.bind(c);
  c._writeConfig = () => {
    window.__tabReorderWrites.push((c._serverCfg.spaces || []).map((space) => space.id));
    return Promise.resolve();
  };
  window.__tabReorderTrustedMove = false;
  c.renderRoot.querySelector('.tabs')?.addEventListener('pointermove', (event) => {
    if (event.buttons && event.isTrusted) window.__tabReorderTrustedMove = true;
  }, { capture: true });
  c.requestUpdate();
  await c.updateComplete;
  return {
    firstBefore,
    markerHasNoSpace: !c._serverCfg.markers.find((marker) => marker.id === 'smoke-dangling')?.space,
    reorderable: c.renderRoot.querySelector('[data-hp="space-tab"]')
      ?.hasAttribute('data-reorderable') === true,
  };
});

out.plantedMarkerStartsWithoutSpace = setup.markerHasNoSpace;
out.reorderableInEditor = setup.reorderable;
const initial = await ids();
out.enoughTabsToReorder = initial.length >= 3;

// AC1/AC2: same tab moves left and then right through trusted browser input.
const moved = initial.at(-1);
const leftTarget = initial[0];
const activeBefore = await page.evaluate(() => window.__card._space);
const beforeHold = await holdDrag(moved, leftTarget);
out.realMouseEventsAreTrusted = beforeHold.trustedMoveSeen;
out.captureKeptButTargetResolved = beforeHold.drag?.targetId === leftTarget
  && beforeHold.drag?.id === moved;
out.leftDropUsesBeforeSide = beforeHold.drag?.placement === 'before'
  && beforeHold.targetClass.includes('drop-before')
  && !beforeHold.targetClass.includes('drop-after');
out.heldTabShowsDragging = beforeHold.sourceClass.includes('dragging');
out.beforeDividerHasPositiveInset = insetX(beforeHold.targetShadow) > 0;
await releaseDrag(1);
const afterLeft = await ids();
out.realMouseMovedTabLeft = afterLeft[0] === moved;
out.firstDropWroteOnce = await writeCount() === 1;
out.savedLeftOrderMatchesPanel = await page.evaluate(() => {
  const panel = [...window.__card.renderRoot.querySelectorAll('[data-hp="space-tab"]')]
    .map((tab) => tab.dataset.id);
  return JSON.stringify(window.__tabReorderWrites[0]) === JSON.stringify(panel);
});
out.activeSpaceUnchanged = await page.evaluate((active) => window.__card._space === active, activeBefore);
out.danglingMarkerPinnedToItsOldSpace = await page.evaluate(
  (first) => window.__card._serverCfg.markers
    .find((marker) => marker.id === 'smoke-dangling')?.space === first,
  setup.firstBefore,
);
out.warnedAboutPositionalFloor = await page.evaluate(() => typeof window.__card._toast === 'string'
  && window.__card._toast.length > 0);

await page.evaluate(() => { window.__card._toast = ''; });
const rightTarget = afterLeft.at(-1);
const afterHold = await holdDrag(moved, rightTarget);
out.rightDropUsesAfterSide = afterHold.drag?.placement === 'after'
  && afterHold.targetClass.includes('drop-after')
  && !afterHold.targetClass.includes('drop-before');
out.afterDividerHasNegativeInset = insetX(afterHold.targetShadow) < 0;
await releaseDrag(2);
const afterRight = await ids();
out.sameTabMovedRight = afterRight.at(-1) === moved;
out.secondDropWroteOnce = await writeCount() === 2;
out.warningNotRepeated = await page.evaluate(() => !window.__card._toast);

// AC3: below-threshold movement remains a click and cannot save config.
const currentActive = await page.evaluate(() => window.__card._space);
const smallTarget = (await ids()).find((id) => id !== currentActive);
const smallPoint = await tabPoint(smallTarget);
const writesBeforeSmall = await writeCount();
await page.mouse.move(smallPoint.x, smallPoint.y);
await page.mouse.down();
await page.mouse.move(smallPoint.x + 2, smallPoint.y);
const smallState = await page.evaluate(() => window.__card._tabDrag && !window.__card._tabDrag.moved);
await page.mouse.up();
await settle();
await page.waitForTimeout(550);
out.subThresholdStayedClick = smallState;
out.subThresholdDidNotWrite = await writeCount() === writesBeforeSmall;
out.clickStillSwitchesSpace = await page.evaluate((id) => window.__card._space === id, smallTarget);

// AC4: a previously valid target is cleared outside tabs; release cancels.
const outsideIds = await ids();
const outsideFrom = outsideIds.at(-1);
const outsideTarget = outsideIds[0];
const writesBeforeOutside = await writeCount();
await holdDrag(outsideFrom, outsideTarget);
const stagePoint = await page.evaluate(() => {
  const rect = window.__card.renderRoot.querySelector('.stage').getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + Math.min(rect.height / 2, 300) };
});
await page.mouse.move(stagePoint.x, stagePoint.y, { steps: 3 });
await settle();
out.outsideClearsDropTarget = await page.evaluate(() => window.__card._tabDrag?.moved === true
  && window.__card._tabDrag.targetId === null
  && window.__card._tabDrag.placement === null
  && !window.__card.renderRoot.querySelector('.drop-before, .drop-after'));
await page.mouse.up();
await settle();
await page.waitForTimeout(550);
out.outsideReleaseEndedDrag = await page.evaluate(() => window.__card._tabDrag === null);
out.outsideReleaseDidNotWrite = await writeCount() === writesBeforeOutside;

// Exercise the window-level release fallback independently. Real mouse input
// normally grants pointer capture, which would route pointerup back to the
// source tab and let a missing window listener pass this regression.
const fallbackIds = await ids();
const writesBeforeFallback = await writeCount();
await holdDrag(fallbackIds.at(-1), fallbackIds[0]);
out.outsideFallbackReleasedCapture = await page.evaluate(() => {
  const c = window.__card;
  const drag = c._tabDrag;
  const source = [...c.renderRoot.querySelectorAll('[data-hp="space-tab"]')]
    .find((tab) => tab.dataset.id === drag?.id);
  if (!source || !drag || !source.hasPointerCapture(drag.pointerId)) return false;
  source.releasePointerCapture(drag.pointerId);
  return !source.hasPointerCapture(drag.pointerId);
});
await page.mouse.move(stagePoint.x, stagePoint.y, { steps: 3 });
await page.mouse.up();
await settle();
await page.waitForTimeout(550);
out.outsideFallbackReleaseEndedDrag = await page.evaluate(() => window.__card._tabDrag === null);
out.outsideFallbackReleaseDidNotWrite = await writeCount() === writesBeforeFallback;

const activeBeforeRecovery = await page.evaluate(() => window.__card._space);
const recoveryTarget = (await ids()).find((id) => id !== activeBeforeRecovery);
const recoveryPoint = await tabPoint(recoveryTarget);
await page.mouse.click(recoveryPoint.x, recoveryPoint.y);
await settle();
out.nextClickWorksAfterOutsideRelease = await page.evaluate(
  (id) => window.__card._space === id, recoveryTarget,
);

// Navigation cannot leave a window-level drag listener behind.
const modeIds = await ids();
const writesBeforeModeChange = await writeCount();
await holdDrag(modeIds.at(-1), modeIds[0]);
await page.evaluate(() => window.__card._setMode('devices', false));
await settle();
out.modeChangeEndsDrag = await page.evaluate(() => window.__card._tabDrag === null);
await page.mouse.up();
await settle();
out.modeChangeDidNotWrite = await writeCount() === writesBeforeModeChange;
await page.evaluate(() => window.__card._setMode('plan', false));
await settle();

// AC5: pointercancel is an explicit cancellation, never a drop.
const cancelIds = await ids();
const cancelFrom = cancelIds.at(-1);
const cancelTarget = cancelIds[0];
const writesBeforeCancel = await writeCount();
await holdDrag(cancelFrom, cancelTarget);
await page.evaluate(() => {
  const c = window.__card;
  const drag = c._tabDrag;
  const source = [...c.renderRoot.querySelectorAll('[data-hp="space-tab"]')]
    .find((tab) => tab.dataset.id === drag?.id);
  source?.dispatchEvent(new PointerEvent('pointercancel', {
    pointerId: drag?.pointerId || 1, pointerType: 'mouse', bubbles: true, composed: true,
  }));
});
await page.mouse.up();
await settle();
await page.waitForTimeout(550);
out.pointerCancelEndedDrag = await page.evaluate(() => window.__card._tabDrag === null);
out.pointerCancelDidNotWrite = await writeCount() === writesBeforeCancel;

// Regression from #220 review: detached cards release listeners and never save.
const detachIds = await ids();
const detachFrom = detachIds.at(-1);
const detachTarget = detachIds[0];
const writesBeforeDetach = await writeCount();
await holdDrag(detachFrom, detachTarget);
out.dragWasActiveBeforeDetach = await page.evaluate(() => window.__card._tabDrag?.moved === true);
await page.evaluate(() => {
  const c = window.__card;
  window.__tabReorderParent = c.parentNode;
  window.__tabReorderNext = c.nextSibling;
  c.remove();
});
out.detachEndedTheDrag = await page.evaluate(() => window.__card._tabDrag === null);
await page.mouse.up();
await page.waitForTimeout(550);
out.detachedCardDidNotWrite = await writeCount() === writesBeforeDetach;
await page.evaluate(async () => {
  window.__tabReorderParent.insertBefore(window.__card, window.__tabReorderNext);
  await window.__card.updateComplete;
});
out.orderSurvivedDetach = JSON.stringify(await ids()) === JSON.stringify(detachIds);

// AC6: negative boundaries stay negative. Synthetic touch is intentional here:
// the assertion is the pointerType guard, not browser mouse delivery.
const touchBefore = await ids();
await page.evaluate(() => {
  const c = window.__card;
  const tabs = [...c.renderRoot.querySelectorAll('[data-hp="space-tab"]')];
  const source = tabs.at(-1);
  const target = tabs[0];
  const a = source.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const fire = (type, x, y, node) => node.dispatchEvent(new PointerEvent(type, {
    pointerId: 91, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, composed: true,
  }));
  fire('pointerdown', a.x + a.width / 2, a.y + a.height / 2, source);
  fire('pointermove', b.x + b.width / 2, b.y + b.height / 2, target);
  fire('pointerup', b.x + b.width / 2, b.y + b.height / 2, target);
});
await settle();
out.touchDidNotReorder = JSON.stringify(await ids()) === JSON.stringify(touchBefore);

await page.evaluate(async () => {
  const c = window.__card;
  c._mode = 'view';
  c.requestUpdate();
  await c.updateComplete;
});
out.notReorderableInView = await page.evaluate(() => !window.__card.renderRoot
  .querySelector('[data-hp="space-tab"]')?.hasAttribute('data-reorderable'));
const viewBefore = await ids();
const viewFromPoint = await tabPoint(viewBefore.at(-1));
const viewTargetPoint = await tabPoint(viewBefore[0]);
await page.mouse.move(viewFromPoint.x, viewFromPoint.y);
await page.mouse.down();
await page.mouse.move(viewTargetPoint.x, viewTargetPoint.y, { steps: 4 });
await page.mouse.up();
await settle();
out.viewDidNotReorder = JSON.stringify(await ids()) === JSON.stringify(viewBefore);

await page.evaluate(async () => {
  const c = window.__card;
  c._mode = 'plan';
  c._config = { ...c._config, floor: c._model[0].id };
  c.requestUpdate();
  await c.updateComplete;
});
out.fixedFloorNotReorderable = await page.evaluate(() => !window.__card.renderRoot
  .querySelector('[data-hp="space-tab"]')?.hasAttribute('data-reorderable'));
await page.evaluate(async () => {
  const c = window.__card;
  const { floor: _floor, ...rest } = c._config;
  c._config = rest;
  c._mode = 'plan';
  c._writeConfig = window.__tabReorderOriginalWrite;
  c.requestUpdate();
  await c.updateComplete;
});

checkAll(out);
await finish(browser, out);
