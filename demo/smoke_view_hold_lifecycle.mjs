// #847: trusted mouse/CDP touch drive View; lifecycle emulation is named, not
// represented as real Android/background/bfcache delivery. Card fields are read
// only. Services are observed via the fixture light state, not a replaced hass wrapper.
import assert from 'node:assert/strict';
import { launchColdView, reportPageErrors } from './serve.mjs';

const out = {};
const DEVICE = 'houseplan-card .dev[data-id="d_light1"]';
const INFO = 'houseplan-card hp-dialog[data-kind="info"]';
const wait = (page, ms = 750) => page.waitForTimeout(ms);
const point = async (locator) => {
  const box = await locator.boundingBox();
  assert.ok(box, 'target has a browser-painted box');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};
const state = (page) => page.evaluate(() => {
  const c = window.__card;
  return {
    light: c.hass.states['light.ceiling'].state, info: c._infoCard?.id ?? null,
    fired: c._holdFired, owner: c._viewHold.pointerId, pointers: c._pointers.size,
    contacts: c._touchContacts.size, view: JSON.stringify(c._view),
    more: window.__holdMoreInfo, space: c._space,
  };
});
const sameInert = async (page, before, name, ms = 750) => {
  await wait(page, ms);
  const after = await state(page);
  assert.equal(after.info, null, `${name}: no device card`);
  assert.equal(after.fired, false, `${name}: no fired hold`);
  assert.equal(after.light, before.light, `${name}: no service`);
  assert.equal(after.more, before.more, `${name}: no more-info`);
  out[name] = true;
};
const events = (page) => page.evaluate(() => window.__holdEvents);
const currentTouch = async (page) => (await events(page)).filter((e) =>
  e.type === 'pointerdown' && e.pointerType === 'touch').at(-1).pointerId;
const dispatchTail = (page, type = 'click') => page.locator(DEVICE).evaluate((node, kind) => {
  node.dispatchEvent(new MouseEvent(kind, { bubbles: true, composed: true, cancelable: true }));
}, type);
const touch = (cdp, type, points = []) => cdp.send('Input.dispatchTouchEvent', {
  type, touchPoints: points.map((p) => ({ ...p, radiusX: 1, radiusY: 1 })),
});
const begin = async () => {
  const session = await launchColdView({ width: 1000, height: 820 }, 1, [], { hasTouch: true });
  await session.page.evaluate(() => {
    window.__holdEvents = [];
    window.__holdMoreInfo = 0;
    window.addEventListener('hass-more-info', () => ++window.__holdMoreInfo);
    for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'lostpointercapture']) {
      window.addEventListener(type, (event) => {
        if (event.composedPath().includes(window.__card)) window.__holdEvents.push({
          type, pointerId: event.pointerId, pointerType: event.pointerType, trusted: event.isTrusted,
        });
      }, true);
    }
  });
  const cdp = await session.page.context().newCDPSession(session.page);
  return { ...session, cdp };
};
const closeInfo = async (page) => {
  await page.keyboard.press('Escape');
  await page.locator(INFO).waitFor({ state: 'detached' });
};
const releaseCapture = async (page, pointerId) => {
  const native = await page.locator(DEVICE).evaluate((node, id) => {
    if (!node.hasPointerCapture(id)) return false;
    node.releasePointerCapture(id); return true;
  }, pointerId);
  if (!native) await page.locator(DEVICE).dispatchEvent('lostpointercapture', {
    pointerId, pointerType: 'touch', bubbles: true, composed: true,
  });
  return native ? 'releasePointerCapture' : 'dispatched lostpointercapture';
};
const blur = (page) => page.evaluate(async () => {
  let received = false;
  window.addEventListener('blur', () => { received = true; }, { once: true });
  const frame = document.createElement('iframe');
  frame.id = 'view-hold-blur'; frame.srcdoc = '<input>';
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:30px;height:30px';
  const loaded = new Promise((resolve) => { frame.onload = resolve; });
  document.body.append(frame); await loaded;
  frame.contentWindow.focus(); await new Promise((resolve) => setTimeout(resolve, 30));
  return received;
});
const refocus = (page) => page.evaluate(() => {
  document.getElementById('view-hold-blur')?.remove(); window.focus();
});
const hide = (page, kind) => page.evaluate((mode) => {
  if (mode === 'hidden') {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  } else window.dispatchEvent(new PageTransitionEvent('pagehide'));
}, kind);
const show = (page, kind) => page.evaluate((mode) => {
  if (mode === 'hidden') {
    delete document.visibilityState;
    document.dispatchEvent(new Event('visibilitychange'));
  } else window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
}, kind);

// AC1/AC2: OS cancellation, owner-specific capture loss, and a new pan whose
// coordinates must not be cleared later by a retired callback.
{
  const { page, browser, cdp } = await begin();
  try {
    const p = await point(page.locator(DEVICE)), before = await state(page);
    await touch(cdp, 'touchStart', [{ ...p, id: 1 }]); await wait(page, 180);
    await touch(cdp, 'touchCancel');
    const stage = await point(page.locator('houseplan-card .stage'));
    stage.x += 250; stage.y += 220;
    await touch(cdp, 'touchStart', [{ ...stage, id: 2 }]);
    await wait(page, 650);
    const held = await state(page);
    assert.equal(held.pointers, 1, 'retired hold did not clear new gesture');
    await touch(cdp, 'touchMove', [{ x: stage.x + 40, y: stage.y, id: 2 }]);
    await wait(page, 80);
    assert.notEqual((await state(page)).view, held.view, 'new pan moves the plan');
    await touch(cdp, 'touchEnd');
    await sameInert(page, before, 'cancelThenFreshPan');
    // Foreign terminal cannot retire a stationary trusted hold.
    const next = await point(page.locator(DEVICE));
    await page.mouse.move(next.x, next.y); await page.mouse.down();
    await page.locator(DEVICE).dispatchEvent('pointercancel', { pointerId: 99999, pointerType: 'mouse' });
    await page.locator(INFO).waitFor({ state: 'attached', timeout: 1600 });
    await page.mouse.up(); await closeInfo(page);
    out.foreignTerminalKeepsHold = true;
    const single = await point(page.locator(DEVICE)), singleBefore = await state(page);
    await touch(cdp, 'touchStart', [{ ...single, id: 30 }]);
    out.singleLossDelivery = await releaseCapture(page, await currentTouch(page));
    await touch(cdp, 'touchMove', [{ ...single, id: 30 }]); await wait(page, 700);
    await touch(cdp, 'touchEnd'); await dispatchTail(page); await dispatchTail(page, 'contextmenu');
    await sameInert(page, singleBefore, 'singleLostCaptureHasInertTail', 50);
    // F84: capture is lost while the first physical contact is still down.
    const q = await point(page.locator(DEVICE)), fresh = await state(page);
    await touch(cdp, 'touchStart', [{ ...q, id: 3 }]);
    out.captureLossDelivery = await releaseCapture(page, await currentTouch(page));
    await touch(cdp, 'touchMove', [{ ...q, id: 3 }]);
    await touch(cdp, 'touchStart', [{ ...q, id: 3 }, { x: q.x + 70, y: q.y, id: 4 }]);
    await wait(page, 700);
    await touch(cdp, 'touchEnd'); await dispatchTail(page); await dispatchTail(page, 'contextmenu');
    await sameInert(page, fresh, 'lostCaptureSecondTouchIsNavigation');
    const light = (await state(page)).light;
    await page.touchscreen.tap(q.x, q.y); await wait(page, 150);
    assert.notEqual((await state(page)).light, light, 'fresh touch works after the whole sequence');
    out.freshTapAfterLostCapture = true;
    const remount = await point(page.locator(DEVICE)), remountBefore = await state(page);
    await touch(cdp, 'touchStart', [{ ...remount, id: 31 }]); await wait(page, 100);
    await page.evaluate(() => {
      window.__holdParent = window.__card.parentElement; window.__card.remove();
    });
    await touch(cdp, 'touchEnd'); await wait(page, 700);
    assert.equal((await state(page)).owner, null, 'detached instance has no hold owner');
    await page.evaluate(() => window.__holdParent.append(window.__card)); await wait(page, 100);
    await dispatchTail(page); await dispatchTail(page, 'contextmenu');
    await sameInert(page, remountBefore, 'detachedViewHoldAndTailRetired', 40);
    await page.locator(DEVICE).click(); await wait(page, 100);
    assert.notEqual((await state(page)).light, remountBefore.light, 'first fresh click after remount works');
    if (await reportPageErrors()) throw new Error('uncaught card error');
  } finally { await browser.close(); }
}

// AC3/AC5: real mouse release just outside the marker, and real blur with both
// short/long mouse and touch presses. No fake service-count wrapper is used.
{
  const { page, browser, cdp } = await begin();
  try {
    const edge = await page.locator(DEVICE).evaluate((node) => {
      const root = node.getRootNode(), box = node.getBoundingClientRect();
      // The 44px invisible target floor can extend beyond the visible icon box.
      for (let x = box.left - 30; x < box.right + 30; x += 0.5) {
        const y = box.y + box.height / 2;
        const hit = root.elementFromPoint(x, y), next = root.elementFromPoint(x + 3, y);
        if (hit?.closest('.dev') === node && next?.closest('.stage') && !next.closest('.dev')) {
          return { x, y, endX: x + 3 };
        }
      }
      return null;
    });
    assert.ok(edge, 'fixture provides a <4px release outside the marker');
    const before = await state(page);
    await page.mouse.move(edge.x, edge.y); await page.mouse.down();
    await page.mouse.move(edge.endX, edge.y); await page.mouse.up();
    await sameInert(page, before, 'mouseReleaseOnPlanCancelsHold');
    for (const type of ['mouse', 'touch']) for (const duration of [100, 900]) {
      const p = await point(page.locator(DEVICE)), initial = await state(page);
      if (type === 'mouse') { await page.mouse.move(p.x, p.y); await page.mouse.down(); }
      else await touch(cdp, 'touchStart', [{ ...p, id: duration }]);
      await wait(page, 70); assert.equal(await blur(page), true, 'iframe produced actual window blur');
      await wait(page, duration);
      if (type === 'mouse') await page.mouse.up(); else await touch(cdp, 'touchEnd');
      await refocus(page); await dispatchTail(page); await dispatchTail(page, 'contextmenu');
      await sameInert(page, initial, `${type}Blur${duration}Inert`, 80);
      await page.locator(DEVICE).click(); await wait(page, 100);
      assert.notEqual((await state(page)).light, initial.light, 'fresh mouse click works immediately');
      await page.locator(DEVICE).focus(); await page.keyboard.press('Enter'); await wait(page, 100);
      assert.equal((await state(page)).light, initial.light, 'fresh Enter toggles back');
    }
    if (await reportPageErrors()) throw new Error('uncaught card error');
  } finally { await browser.close(); }
}

// AC4/AC6: explicit emulation of hidden and dispatched pagehide/pageshow, with
// deliberately missing pointer terminals. Late old tails must stay inert.
{
  const { page, browser, cdp } = await begin();
  try {
    for (const kind of ['hidden', 'pagehide']) for (const count of [1, 2]) {
      const initial = await state(page);
      await page.locator(DEVICE).evaluate((node, n) => {
        for (let id = 100; id < 100 + n; ++id) node.dispatchEvent(new PointerEvent('pointerdown', {
          bubbles: true, composed: true, pointerId: id, pointerType: 'touch',
          isPrimary: id === 100, button: 0, buttons: 1,
        }));
      }, count);
      await hide(page, kind);
      // Duplicate hidden+pagehide is one retirement, not a reset/re-arm.
      if (kind === 'hidden') await hide(page, 'pagehide');
      await wait(page, 650); await show(page, kind); await wait(page, 100);
      await dispatchTail(page); await dispatchTail(page, 'contextmenu');
      await sameInert(page, initial, `${kind}Missing${count}Terminals`, 40);
      assert.equal((await state(page)).contacts, 0);
      const p = await point(page.locator(DEVICE));
      await page.touchscreen.tap(p.x, p.y); await wait(page, 120);
      assert.notEqual((await state(page)).light, initial.light, 'first trusted touch after return works');
      await page.locator(DEVICE).dispatchEvent('pointerup', { pointerId: 100, pointerType: 'touch' });
      assert.equal((await state(page)).contacts, 0, 'late old terminal cannot restore a contact');
      out[`${kind}FirstFreshTap`] = true;
    }
    // M1: stay physically down beyond 600 ms after navigating. Mouse has no
    // implicit capture, so DOM-removal loss/up cannot mask navigation teardown.
    // Touch retains original D6 without claiming its terminal delivery is absent.
    for (const route of ['hash', 'facade']) for (const modality of ['mouse', 'touch']) {
      const initial = await state(page), p = await point(page.locator(DEVICE));
      if (modality === 'touch') await touch(cdp, 'touchStart', [{ ...p, id: 5 }]);
      else { await page.mouse.move(p.x, p.y); await page.mouse.down(); }
      await wait(page, 100);
      const held = (await events(page)).filter(e => e.type === 'pointerdown' && e.pointerType === modality).at(-1);
      assert.ok(held?.trusted, `${route}/${modality}: trusted contact starts the pending hold`);
      assert.equal((await state(page)).owner, held.pointerId,
        `${route}/${modality}: this still-down contact really owns the pending hold before navigation`);
      const terminalStart = (await events(page)).length;
      if (route === 'hash') await page.evaluate(() => { location.hash = '#space=garden'; });
      else await page.evaluate(() => window.__hpTest.switchSpace('garden'));
      await page.waitForFunction(() => window.__card._space === 'garden');
      assert.equal((await state(page)).owner, null,
        `${route}/${modality}: actual navigation tears down the owner immediately, not just at timer expiry`);
      out[`${route}${modality}SpaceRetiresOwnerImmediately`] = true;
      await sameInert(page, initial, `${route}${modality}SpaceRetiresStillDownHold`, 750);
      assert.equal((await state(page)).owner, null, 'navigation retires the timer before physical release');
      if (modality === 'mouse') {
        assert.equal((await events(page)).slice(terminalStart).some(e => e.pointerId === held.pointerId
          && ['pointerup', 'pointercancel', 'lostpointercapture'].includes(e.type)), false,
        'mouse navigation has no independent terminal cancelling the hold');
        await page.mouse.up();
      } else await touch(cdp, 'touchEnd');
      await sameInert(page, initial, `${route}${modality}OldReleaseStaysInert`, 40);
      if (route === 'hash') await page.evaluate(() => { location.hash = '#space=f1'; });
      else await page.evaluate(() => window.__hpTest.switchSpace('f1'));
      await page.waitForFunction(() => window.__card._space === 'f1');
      const fresh = await point(page.locator(DEVICE));
      await page.touchscreen.tap(fresh.x, fresh.y); await wait(page, 120);
      assert.notEqual((await state(page)).light, initial.light, 'first fresh native tap after space return works');
      out[`${route}${modality}SpaceFirstFreshTap`] = true;
    }
    // A real cancelled contact followed by actual blur cannot resurrect a timer.
    const initial = await state(page), p = await point(page.locator(DEVICE));
    await touch(cdp, 'touchStart', [{ ...p, id: 6 }]); await touch(cdp, 'touchCancel');
    assert.equal(await blur(page), true); await refocus(page);
    await sameInert(page, initial, 'cancelThenBlurRetiresHold');
    if (await reportPageErrors()) throw new Error('uncaught card error');
  } finally { await browser.close(); }
}

// AC8/AC9/F010: positive trusted hold, stale context menus, real desktop/keyboard
// context-menu controls, and a normal room-name tap with implicit capture loss.
{
  const { page, browser, cdp } = await begin();
  try {
    const initial = await state(page), p = await point(page.locator(DEVICE));
    await cdp.send('Input.synthesizeTapGesture', {
      x: p.x, y: p.y, duration: 850, gestureSourceType: 'touch',
    });
    await page.locator(INFO).waitFor({ state: 'attached', timeout: 1600 });
    await dispatchTail(page, 'contextmenu'); await wait(page, 80);
    assert.equal((await state(page)).more, initial.more, 'touch hold did not open more-info over its card');
    await closeInfo(page); out.cleanTrustedTouchHold = true;
    const q = await point(page.locator(DEVICE));
    await page.mouse.move(q.x, q.y); await page.mouse.down();
    await page.locator(INFO).waitFor({ state: 'attached', timeout: 1600 });
    await page.mouse.up(); await closeInfo(page); out.cleanTrustedMouseHold = true;
    const count = (await state(page)).more;
    await page.locator(DEVICE).click({ button: 'right' }); await wait(page, 80);
    assert.equal((await state(page)).more, count + 1);
    await page.locator(DEVICE).focus(); await page.keyboard.press('Shift+F10'); await wait(page, 80);
    assert.equal((await state(page)).more, count + 2);
    out.freshDesktopContextIntents = true;
    // Pure touch pan has an inert contextmenu tail, then a clean touch tap works.
    const panBefore = await state(page);
    await touch(cdp, 'touchStart', [{ ...q, id: 7 }]);
    await touch(cdp, 'touchMove', [{ x: q.x + 50, y: q.y + 20, id: 7 }]);
    await touch(cdp, 'touchEnd'); await dispatchTail(page, 'contextmenu');
    await sameInert(page, panBefore, 'panContextMenuTailInert', 80);
    await page.evaluate(() => window.__hpTest.setServerConfig((cfg) => {
      cfg.spaces.find((space) => space.id === 'f1').settings = { show_names: true };
    }));
    const label = page.locator('houseplan-card .roomlabel[data-id="r1"] .rlname');
    const roomPoint = await point(label);
    await page.touchscreen.tap(roomPoint.x, roomPoint.y); await wait(page, 850);
    assert.equal(await page.evaluate(() => window.__card._roomFocus?.roomId), 'r1',
      'accepted native room-name up survives its implicit lostpointercapture');
    assert.ok((await events(page)).some((event) => event.type === 'lostpointercapture' && event.trusted));
    out.trustedRoomNameTapSurvivesImplicitLoss = true;
    if (await reportPageErrors()) throw new Error('uncaught card error');
  } finally { await browser.close(); }
}

// AC7: live HA sun sample, disposal during the existing 2s layer fade, remount.
{
  const { page, browser } = await begin();
  try {
    await page.evaluate(() => window.__hpTest.setServerConfig((cfg) => {
      cfg.settings = { ...cfg.settings, sun_rays: true, north_deg: 0 };
      cfg.spaces.find((space) => space.id === 'f1').openings = [
        { id: 'hold-sun-window', type: 'window', x: 0.96, y: 0.6, angle: 90, length: 0.08 },
      ];
    }));
    const sun = (elevation) => page.evaluate(async (value) => {
      const c = window.__card;
      c.hass = { ...c.hass, states: { ...c.hass.states, 'sun.sun': {
        entity_id: 'sun.sun', state: 'above_horizon', attributes: { azimuth: 90, elevation: value },
      } } };
      await c.updateComplete;
    }, elevation);
    await sun(20); assert.equal(await page.evaluate(() => window.__card._sunShown), true);
    await sun(2); assert.ok(await page.evaluate(() => window.__card._sunOutTimer));
    await page.evaluate(() => window.__card.remove());
    assert.equal(await page.evaluate(() => window.__card._sunOutTimer), 0);
    await wait(page, 2200);
    assert.equal(await page.evaluate(() => window.__card._sunShown), false);
    await page.evaluate(() => document.body.append(window.__card)); await wait(page, 150);
    assert.equal(await page.evaluate(() => window.__card._sunShown), false);
    await sun(20); assert.equal(await page.evaluate(() => window.__card._sunShown), true);
    out.sunFadeDisposesAndRemounts = true;
    if (await reportPageErrors()) throw new Error('uncaught card error');
  } finally { await browser.close(); }
}
console.log(JSON.stringify({ ok: true, ...out }));
