import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch(
  { width: 390, height: 760 }, 1, [], { hasTouch: true, isMobile: true },
);
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  c._setMode('view'); await c.updateComplete;
  out.touchHardwareHasNoFineHover = !matchMedia(
    '(any-hover: hover) and (any-pointer: fine)',
  ).matches;
  c._tip = { x: 1, y: 1, title: 'stale', meta: 'stale' };
  c._hoverRoom = { space: c._space, room: c._curSpaceCfg.rooms[0] };
  c._notePointer(new PointerEvent('pointerdown', {
    pointerType: 'touch', pointerId: 9, clientX: 100, clientY: 100,
  }));
  await c.updateComplete;
  out.touchClearsAllTransientHover = !c._tip && !c._hoverRoom
    && !c.hasAttribute('data-pointer-hover');
  c._showTip(new PointerEvent('pointermove', {
    pointerType: 'touch', pointerId: 9, clientX: 100, clientY: 100,
  }), 'Room', 'meta');
  out.noTipOnTouch = !c._tip;
  c._notePointer(new PointerEvent('pointermove', {
    pointerType: 'mouse', clientX: 110, clientY: 110,
  }));
  out.touchOnlyHardwareRejectsMouseHover = !c.hasAttribute('data-pointer-hover');
  out.nestedHoverGateIsOff = [...c.renderRoot.querySelectorAll(
    'hp-dialog, hp-help, hp-color-opacity',
  )].every((node) => !node.hasAttribute('data-pointer-hover'));

  const marker = c.renderRoot.querySelector('.dev[data-id="d_light1"]');
  const shell = marker?.querySelector('.device-shell');
  const originalCallService = c.hass.callService;
  let dispatches = 0;
  c.hass.callService = async () => { dispatches++; };
  marker?.dispatchEvent(new PointerEvent('pointerdown', {
    pointerType: 'touch', pointerId: 10, bubbles: true, composed: true,
  }));
  marker?.dispatchEvent(new PointerEvent('pointerup', {
    pointerType: 'touch', pointerId: 10, bubbles: true, composed: true,
  }));
  marker?.click();
  await Promise.resolve();
  const touchFeedback = shell?.getAnimations().find((animation) =>
    animation.effect?.getTiming().duration === 200);
  out.touchDispatchGetsFeedback = dispatches === 1
    && touchFeedback?.effect?.getKeyframes?.().some((frame) => frame.scale === '0.95');
  c._cancelDevicePressFeedback();
  c.hass.callService = originalCallService;
  return out;
});
checkAll(res);
await finish(browser, res);
