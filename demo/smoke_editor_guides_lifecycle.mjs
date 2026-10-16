// #893: native editor input, public HA/config/layout fixture doors only.
// Private fields are observations, never assignments; capture/lifecycle delivery
// is labelled separately from a real browser background/navigation event.
import assert from 'node:assert/strict';
import { launch, check, finish } from './serve.mjs';
import { canonicalizePosition } from '../test-build/coordinate-canonicalization.js';

const { page, browser } = await launch({ width: 1180, height: 920 });
try {
  await page.evaluate(async () => {
    await window.__hpTest.setServerConfig(cfg => {
      cfg.settings.filter_seeded = true;
      const overrides = [
        { id: 'd_temp', binding: 'device:d_temp', space: 'f1', hidden: true },
        { id: 'd_tv', binding: 'device:d_tv', removed: true },
        { id: 'd_bedlight', binding: 'device:d_bedlight', space: 'f2' },
        { id: 'v_other_floor', binding: 'virtual', space: 'guide-other-floor', name: 'Other floor', icon: 'mdi:lamp' },
      ];
      cfg.markers = [...(cfg.markers || []).filter(m => !overrides.some(o => o.id === m.id)), ...overrides];
      cfg.spaces[0].led_strips = [{ id: 'reference-led', marker: 'd_light1', points: [[0.12, 0.3], [0.4, 0.3]] }];
      cfg.spaces.push({ id: 'guide-other-floor', title: 'Other floor', view_box: [0, 0, 1, 1],
        rooms: [{ id: 'other-room', name: 'Other room', area: null,
          poly: [[0.1, 0.1], [0.6, 0.1], [0.6, 0.6], [0.1, 0.6]] }], openings: [], partitions: [] });
    });
    window.__setRegistryDisabled('device', 'd_kettle', 'user');
    window.__card.hass = window.__mkHass();
    await window.__hpTest.setMode('devices');
    await window.__hpTest.setLayout(layout => {
      const next = { ...layout };
      for (const [i, d] of window.__card._devices.filter(d => d.space === 'f1').entries()) {
        next[d.id] = { s: 'f1', x: (24 + i * 12) / 240, y: (32 + i * 11) / 240 };
      }
      return next;
    });
    await window.__hpTest.settled();
  });
  await page.waitForTimeout(400);
  const marker = id => page.locator(`houseplan-card`).locator(`[data-hp="device"][data-id="${id}"]`);
  const start = await marker('d_lamp').boundingBox();
  assert.ok(start, 'native draggable fixture marker is painted');
  const sx = start.x + start.width / 2, sy = start.y + start.height / 2;
  await page.mouse.move(sx, sy); await page.mouse.down();
  await page.mouse.move(sx + 30, sy + 23, { steps: 3 });
  await page.waitForTimeout(80);
  const roster = await page.evaluate(() => {
    const c = window.__card, root = c.renderRoot;
    const icons = [...root.querySelectorAll('[data-hp="device"]')]
      .filter(n => !n.classList.contains('ghost') && !n.classList.contains('ha-disabled'))
      .map(n => n.dataset.id).filter(id => id !== c._deviceDrag?.id);
    const key = p => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;
    const expected = icons.map(id => { const p = c._pos(c._renderDevices.find(d => d.id === id)); return key([p.x, p.y]); }).sort();
    return { actual: c._editorRuntime._alignCandidates().map(key).sort(), expected,
      icons, dragging: c._deviceDrag?.id, disabled: !!root.querySelector('[data-id="d_kettle"]'),
      hidden: !!root.querySelector('[data-id="d_temp"]'), removed: !!root.querySelector('[data-id="d_tv"]'),
      ledIcon: !!root.querySelector('[data-hp="device"][data-id="d_light1"]'),
      led: !!root.querySelector('[data-led-strip="reference-led"]'),
      otherFloor: c._devices.find(d => d.id === 'v_other_floor')?.space,
      otherFloorIcon: !!root.querySelector('[data-hp="device"][data-id="v_other_floor"]') };
  });
  check('native drag starts on the requested icon', roster.dragging, 'd_lamp');
  check('guide anchors equal actual painted draggable icons, excluding the moving marker', roster.actual, roster.expected);
  check('fixture has no hidden/disabled/deleted/active LED icon anchors',
    [roster.hidden, roster.disabled, roster.removed, roster.ledIcon, roster.led], [false, false, false, false, true]);
  check('a real marker on another existing floor is not a painted reference',
    [roster.otherFloor, roster.otherFloorIcon], ['guide-other-floor', false]);
  await page.keyboard.press('Escape'); await page.mouse.up();
  const hiddenAxis = await page.evaluate(() => {
    const c = window.__card, p = c._pos(c._devices.find(d => d.id === 'd_temp'));
    const svg = c.renderRoot.querySelector('svg.plan-svg'), q = svg.createSVGPoint();
    q.x = p.x; q.y = 700;
    const at = q.matrixTransform(svg.getScreenCTM());
    return { x: at.x, y: at.y, axis: p.x };
  });
  const clean = await marker('d_lamp').boundingBox();
  await page.mouse.move(clean.x + clean.width / 2, clean.y + clean.height / 2);
  await page.mouse.down(); await page.mouse.move(hiddenAxis.x, hiddenAxis.y, { steps: 4 });
  await page.waitForTimeout(80);
  check('a hidden point cannot draw an alignment guide', await page.evaluate(axis => {
    return [...window.__card.renderRoot.querySelectorAll('.alignline')].filter(n => {
      if (n.closest('.hp-editor-only-layer')?.style.opacity === '0') return false;
      return Math.abs(+n.getAttribute('x1') - axis) < 1e-6 && Math.abs(+n.getAttribute('x2') - axis) < 1e-6;
    }).length;
  }, hiddenAxis.axis), 0);
  await page.keyboard.press('Escape'); await page.mouse.up();
  await page.evaluate(async () => {
    await window.__hpTest.setServerConfig(cfg => { cfg.spaces[0].led_strips[0].active = false; });
    await window.__hpTest.settled();
  });
  check('switching LED back to icon restores the real painted reference', await marker('d_light1').count(), 1);
  const restored = await page.evaluate(() => {
    const c = window.__card, p = c._pos(c._renderDevices.find(d => d.id === 'd_light1'));
    return c._editorRuntime._alignCandidates().some(q => Math.hypot(q[0] - p.x, q[1] - p.y) < 1e-6);
  });
  check('the restored icon immediately participates in guides', restored);
  await page.evaluate(() => {
    const c = window.__card, oldWS = c.hass.callWS.bind(c.hass), oldService = c.hass.callService.bind(c.hass);
    window.__guideWrites = []; window.__guideServices = []; window.__guideDelay = false;
    c.hass = { ...c.hass, callWS: async message => {
      if (message.type === 'houseplan/layout/update') {
        window.__guideWrites.push(structuredClone(message));
        if (window.__guideDelay) await new Promise(resolve => { window.__guideAccept = resolve; });
      }
      return oldWS(message);
    }, callService: (...args) => { window.__guideServices.push(args); return oldService(...args); } };
  });
  const observation = () => page.evaluate(() => {
    const c = window.__card;
    const node = c.renderRoot.querySelector('[data-hp="device"][data-id="d_lamp"]');
    const p = c._pos(c._devices.find(d => d.id === 'd_lamp')), view = c._view;
    return { layout: structuredClone(c._layout), history: c._devicePositionHistory.size,
      writes: window.__guideWrites.length, services: window.__guideServices.length,
      drag: c._deviceDrag?.id ?? null, dialog: !!c._markerDialog,
      paintedMatches: !!node && Math.abs(parseFloat(node.style.left) - (p.x - view.x) / view.w * 100) < 1e-3
        && Math.abs(parseFloat(node.style.top) - (p.y - view.y) / view.h * 100) < 1e-3,
      guides: [...c.renderRoot.querySelectorAll('.alignguides, .spacingguides')].filter(n => {
        const layer = n.closest('.hp-editor-only-layer'); return !layer || layer.style.opacity !== '0';
      }).length };
  });
  // Retiring a previously painted live frame is different from cancelling a
  // still-queued first move. Exercise both; no private product handler runs.
  const paintedBefore = await observation();
  const paintedBox = await marker('d_lamp').boundingBox();
  const guideAt = await page.evaluate(() => {
    const c = window.__card, ref = c._editorRuntime._alignCandidates()[0];
    const svg = c.renderRoot.querySelector('svg.plan-svg'), p = svg.createSVGPoint();
    p.x = ref[0]; p.y = 700;
    const at = p.matrixTransform(svg.getScreenCTM()); return { x: at.x, y: at.y };
  });
  await page.mouse.move(paintedBox.x + paintedBox.width / 2, paintedBox.y + paintedBox.height / 2);
  await page.mouse.down(); await page.mouse.move(guideAt.x, guideAt.y, { steps: 4 });
  await page.waitForTimeout(80);
  assert.ok((await observation()).guides > 0, 'a live guide frame really exists before background retirement');
  const paintedPointerId = await page.evaluate(() => window.__card._deviceDrag?.pointerId);
  assert.equal(typeof paintedPointerId, 'number', 'the native painted drag has a physical pointer owner');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.mouse.up(); await page.waitForTimeout(80);
  const paintedAfter = await observation();
  assert.deepEqual(paintedAfter.layout, paintedBefore.layout, 'already painted preview restores its complete before snapshot');
  check('background retirement clears painted guide/RAF without a write or history step',
    [paintedAfter.guides, paintedAfter.drag, paintedAfter.paintedMatches, paintedAfter.writes - paintedBefore.writes,
      paintedAfter.history - paintedBefore.history], [0, null, true, 0, 0]);
  await marker('d_lamp').press('Enter');
  await page.waitForFunction(() => !!window.__card._markerDialog);
  check('the first deliberate keyboard activation after cancellation opens settings', (await observation()).dialog);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.__card._markerDialog);
  await page.evaluate(() => window.__hpTest.settled());
  await page.waitForTimeout(200); // the ordinary dialog exit animation still owns its backdrop
  // The real Enter positive above clears the shared activation barrier. It
  // does not revive the cancelled physical pointer: deliver that late click
  // explicitly, without pretending it is a trusted new browser activation.
  // A compatibility MouseEvent after the deliberate Enter is no longer a
  // stale-tail contract, so this isolated negative has a pointer id only.
  const beforeLatePointer = await observation();
  const latePointerGuards = await page.evaluate(() => {
    const c = window.__card;
    return [c._touchClickGuard.clickBlocked, c._suppressClick, c._deviceDrag !== null, c._holdFired];
  });
  check('late-pointer negative is not masked by shared click, drag or hold suppression',
    latePointerGuards, [false, false, false, false]);
  const latePointerTrusted = await page.evaluate(pointerId => {
    const node = window.__card.renderRoot.querySelector('[data-hp="device"][data-id="d_lamp"]');
    const box = node.getBoundingClientRect();
    const event = new PointerEvent('click', { pointerId, pointerType: 'mouse', button: 0,
      clientX: box.x + box.width / 2, clientY: box.y + box.height / 2, bubbles: true, composed: true });
    node.dispatchEvent(event);
    return event.isTrusted;
  }, paintedPointerId);
  await page.waitForTimeout(80);
  const afterLatePointer = await observation();
  assert.deepEqual(afterLatePointer.layout, beforeLatePointer.layout,
    'the retired pointer cannot change the complete layout after a deliberate keyboard action');
  check('synthetic late old-pointer click stays inert after the real Enter/close positive',
    [latePointerTrusted, afterLatePointer.dialog, afterLatePointer.guides, afterLatePointer.drag,
      afterLatePointer.paintedMatches, afterLatePointer.writes - beforeLatePointer.writes,
      afterLatePointer.history - beforeLatePointer.history, afterLatePointer.services - beforeLatePointer.services],
    [false, false, 0, null, true, 0, 0, 0]);
  for (const lifecycle of ['hidden', 'pagehide']) {
    const before = await observation(), box = await marker('d_lamp').boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y); await page.mouse.down();
    // Chromium may flush the pointer calculation between target and ancestor
    // listeners. The trusted move still has an unpainted live RAF at the host:
    // observe that actual boundary instead of claiming a pending microtask.
    await page.evaluate(kind => {
      const c = window.__card;
      const painted = c._liveEditorPaintCount;
      c.addEventListener('pointermove', event => {
        window.__guideQueued = { trusted: event.isTrusted, pointerId: event.pointerId,
          moved: c._deviceDrag?.moved === true, unpainted: c._liveEditorPaintCount === painted,
          source: c._deviceDrag?.source };
        if (kind === 'hidden') {
          Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
          document.dispatchEvent(new Event('visibilitychange'));
        } else window.dispatchEvent(new PageTransitionEvent('pagehide'));
      }, { once: true });
    }, lifecycle);
    await page.mouse.move(x + 45, y + 35); await page.waitForTimeout(80);
    assert.ok(await page.evaluate(() => !!window.__guideQueued), `${lifecycle}: native marker move reached the queued-live-frame observer`);
    const retirement = await page.evaluate(kind => {
      const queued = window.__guideQueued;
      const captured = queued.source?.hasPointerCapture?.(queued.pointerId) ?? false;
      if (kind === 'hidden') { delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')); }
      else window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
      return { trusted: queued.trusted, moved: queued.moved, unpainted: queued.unpainted,
        pointerId: queued.pointerId, captured };
    }, lifecycle);
    await page.mouse.up();
    await page.evaluate(pointerId => {
      const c = window.__card, node = c.renderRoot.querySelector('[data-hp="device"][data-id="d_lamp"]');
      for (const type of ['pointermove', 'pointerup', 'click']) node.dispatchEvent(new PointerEvent(type, {
        pointerId, pointerType: 'mouse', button: 0, clientX: 350, clientY: 350, bubbles: true, composed: true,
      }));
      node.dispatchEvent(new MouseEvent('click', { detail: 1, bubbles: true, composed: true }));
    }, retirement.pointerId);
    await page.waitForTimeout(80);
    const after = await observation();
    check(`${lifecycle}: trusted moved preview has not painted its queued frame before cancellation`,
      [retirement.trusted, retirement.moved, retirement.unpainted], [true, true, true]);
    assert.deepEqual(after.layout, before.layout, `${lifecycle}: every stored coordinate and sibling survives cancellation unchanged`);
    check(`${lifecycle}: cancelled capture, guides and old tail cannot write/history/act/open settings`,
      [retirement.captured, after.drag, after.guides, after.paintedMatches, after.writes - before.writes,
        after.history - before.history, after.services - before.services, after.dialog], [false, null, 0, true, 0, 0, 0, false]);
    const fresh = await marker('d_lamp').boundingBox();
    await page.mouse.move(fresh.x + fresh.width / 2, fresh.y + fresh.height / 2); await page.mouse.down();
    await page.mouse.move(fresh.x + fresh.width / 2 + 48, fresh.y + fresh.height / 2 + 30, { steps: 4 });
    await page.waitForTimeout(60);
    const preview = await page.evaluate(() => structuredClone(window.__card._layout.d_lamp));
    await page.mouse.up();
    await page.waitForFunction(() => !window.__card._devicePositionBusy);
    const accepted = await observation();
    check(`${lifecycle}: first new deliberate drag writes one command and one exact snapped preview`,
      [accepted.writes - before.writes, accepted.history - before.history], [1, 1]);
    assert.deepEqual(accepted.layout.d_lamp, canonicalizePosition(preview),
      'the existing storage write barrier removes only representation tails');
  }
  for (const path of ['editor', 'space', 'disconnect']) {
    const before = await observation(), box = await marker('d_lamp').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 42, box.y + box.height / 2 + 27, { steps: 4 });
    await page.waitForTimeout(60);
    const oldId = await page.evaluate(() => window.__card._deviceDrag?.pointerId);
    assert.equal(typeof oldId, 'number', `${path}: native unfinished drag is really owned`);
    await page.evaluate(async path => {
      if (path === 'editor') await window.__hpTest.setMode('plan');
      else if (path === 'space') {
        const c = window.__card;
        c.addEventListener('click', () => {
          // Observe the navigation handler synchronously, before Lit removes
          // the old icon and implicit capture loss could mask missing teardown.
          window.__guideSpaceRetirement = { space: c._space, drag: c._deviceDrag?.id ?? null };
        }, { once: true });
        await window.__hpTest.switchSpace('garden');
      }
      else window.__card.remove();
    }, path);
    if (path === 'space') assert.deepEqual(await page.evaluate(() => window.__guideSpaceRetirement),
      { space: 'garden', drag: null }, 'space: navigation synchronously retires the held drag before DOM removal');
    if (path === 'disconnect') assert.equal((await observation()).paintedMatches, true,
      'disconnect: disposed card synchronously restores the already painted marker, before reconnect/render');
    await page.mouse.up();
    if (path === 'space') {
      await page.waitForFunction(() => !window.__card._slide);
      // A deliberate new press, not a compatibility click from the retired
      // drag, owns return navigation through the shared activation guard.
      await page.locator('houseplan-card').locator('[data-hp="space-tab"][data-id="f1"]').click();
      await page.waitForFunction(() => window.__card._space === 'f1' && !window.__card._slide);
    }
    await page.evaluate(async path => {
      if (path === 'disconnect') {
        document.getElementById('host').appendChild(window.__card);
        await window.__hpTest.settled();
      }
    }, path);
    // A cancelled physical gesture deliberately arms the activation barrier.
    // Restore the editor with a fresh native press, not element.click() while
    // the test is asserting that the stale pointer tail remains suppressed.
    if (await page.evaluate(() => window.__card._mode !== 'devices')) {
      await page.locator('houseplan-card [data-hp="mode-tab"][data-mode="devices"]').click().catch(async error => {
      console.log('diagnostic guide lifecycle before mode restore', await page.evaluate(path => {
        const c=window.__card;
        return {path,mode:c._mode,busy:c._modeTransitionBusy,drag:c._deviceDrag?.id,
          guard:c._touchClickGuard.clickBlocked,suppress:c._suppressClick,continuity:c._continuity.state};
      },path));
      throw error;
      });
    }
    await page.waitForFunction(() => !window.__card._modeTransitionBusy && !window.__card._loading);
    await page.evaluate(() => window.__hpTest.settled());
    await page.evaluate(pointerId => {
      const n = window.__card.renderRoot.querySelector('[data-hp="device"][data-id="d_lamp"]');
      for (const type of ['pointermove', 'pointerup', 'click']) n.dispatchEvent(new PointerEvent(type, {
        pointerId, pointerType: 'mouse', button: 0, clientX: 450, clientY: 450, bubbles: true, composed: true,
      }));
      n.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    }, oldId);
    await page.waitForTimeout(80);
    const after = await observation();
    assert.deepEqual(after.layout, before.layout, `${path}: complete layout survives abandoned preview`);
    check(`${path}: retired tail is inert and the visible marker restored`,
      [after.drag, after.guides, after.paintedMatches, after.dialog, after.writes - before.writes,
        after.history - before.history, after.services - before.services], [null, 0, true, false, 0, 0, 0]);
    const fresh = await marker('d_lamp').boundingBox();
    await page.mouse.move(fresh.x + fresh.width / 2, fresh.y + fresh.height / 2); await page.mouse.down();
    await page.mouse.move(fresh.x + fresh.width / 2 + 35, fresh.y + fresh.height / 2 + 24, { steps: 4 });
    await page.mouse.up();
    await page.waitForFunction(() => !window.__card._devicePositionBusy);
    const accepted = await observation();
    check(`${path}: the very next deliberate drag commits exactly once`,
      [accepted.writes - before.writes, accepted.history - before.history], [1, 1]);
  }
  // A release has already transferred ownership to the serial writer. Hiding
  // the page cannot roll back that pending accepted placement or its history.
  const beforePending = await observation(), pendingBox = await marker('d_lamp').boundingBox();
  await page.evaluate(() => { window.__guideDelay = true; });
  await page.mouse.move(pendingBox.x + pendingBox.width / 2, pendingBox.y + pendingBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(pendingBox.x + pendingBox.width / 2 + 38, pendingBox.y + pendingBox.height / 2 + 25, { steps: 4 });
  await page.waitForTimeout(60);
  const pendingPreview = await page.evaluate(() => structuredClone(window.__card._layout.d_lamp));
  await page.mouse.up();
  await page.waitForFunction(() => typeof window.__guideAccept === 'function');
  await page.evaluate(() => { window.dispatchEvent(new PageTransitionEvent('pagehide')); });
  check('released pending write has no unfinished drag to retire', (await observation()).drag, null);
  await page.evaluate(() => { window.__guideDelay = false; window.__guideAccept(); });
  await page.waitForFunction(() => !window.__card._devicePositionBusy);
  const afterPending = await observation();
  assert.deepEqual(afterPending.layout.d_lamp, canonicalizePosition(pendingPreview),
    'pagehide after release retains the canonically accepted placement');
  check('pagehide after release retains exactly one accepted command/write',
    [afterPending.writes - beforePending.writes, afterPending.history - beforePending.history], [1, 1]);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await page.waitForFunction(() => !window.__card._loading);
  await page.evaluate(() => window.__hpTest.settled());
  const resumedPending = await observation();
  assert.deepEqual(resumedPending.layout, afterPending.layout,
    'ACK-before-pageshow ordering retains the accepted full layout after resume');
  check('ACK-before-pageshow ordering retains its accepted history after resume',
    resumedPending.history, afterPending.history);
  await finish(browser, { roster, retiredPointer: { id: paintedPointerId, sharedGuards: latePointerGuards,
    lateDeliveryTrusted: latePointerTrusted, dialogOpened: afterLatePointer.dialog } });
} finally {
  await browser.close();
}
