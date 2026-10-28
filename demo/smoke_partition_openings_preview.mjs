/** #861 AC11: ordinary held-preview symptom regression, not a mutation run.
 * Mouse/keyboard positives use Playwright; cancellation is a trusted Chromium
 * CDP touchCancel on the same delivered pointer, not a touch-parity claim.
 * Frozen common characterization and the original held-RED stay unchanged.
 */
import assert from 'node:assert/strict';
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1280, height: 960 });
const out = {}, trace = [];
const hostedIds = ['held_door', 'held_window'];
const allIds = [...hostedIds, 'static_window'];
const settle = () => page.evaluate(() => window.__hpTest.settled());
const writesSettled = () => page.evaluate(() => window.__hpTest.waitForWrites());
const near = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) <= tolerance,
  `expected ${expected}, got ${actual}`);
const at = (x, y) => page.evaluate(([x, y]) => {
  const svg = window.__card.renderRoot.querySelector('.stage svg');
  const point = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM());
  return { x: point.x, y: point.y };
}, [x, y]);

const sample = () => page.evaluate((ids) => {
  const c = window.__card, root = c.renderRoot, proof = window.__partitionPreviewProof;
  const svg = root.querySelector('.stage svg'), inverse = svg.getScreenCTM().inverse();
  const effectiveOpacity = (element) => {
    let opacity = 1;
    for (let node = element; node; node = node.parentElement || node.getRootNode()?.host || null) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility !== 'visible') return 0;
      opacity *= Number(style.opacity);
    }
    return opacity;
  };
  // Only actual leaf ink counts: transparent interaction rectangles and hidden
  // settled copies cannot satisfy either the visible count or position oracle.
  const visibleInk = (leaf) => {
    const style = getComputedStyle(leaf), box = leaf.getBoundingClientRect();
    const fill = style.fill;
    return effectiveOpacity(leaf) > 0 && Number(style.fillOpacity) > 0
      && fill !== 'none' && fill !== 'transparent' && !/rgba\([^)]*,\s*0(?:\.0+)?\)$/.test(fill)
      && box.width > 0 && box.height > 0 && box.right > 0 && box.bottom > 0
      && box.left < innerWidth && box.top < innerHeight;
  };
  const openings = Object.fromEntries(ids.map((id) => {
    const copies = [...root.querySelectorAll('[data-hp="opening"]')]
      .filter((group) => group.dataset.id === id).map((group) => {
        const leaves = [...group.querySelectorAll('.op-leaf rect')];
        const ink = leaves.filter(visibleInk);
        const matrix = group.getScreenCTM();
        const screen = matrix && new DOMPoint(0, 0).matrixTransform(matrix);
        const origin = screen && screen.matrixTransform(inverse);
        const firstBox = ink[0]?.getBoundingClientRect();
        const hitStack = firstBox ? root.elementsFromPoint(firstBox.x + firstBox.width / 2,
          firstBox.y + firstBox.height / 2) : [];
        return {
          visible: ink.length > 0, live: !!group.closest('[data-hp-live-editor]'),
          origin: origin && [origin.x, origin.y],
          // The real symbol subtree excludes op-hit/selection chrome. Rigid
          // translation must not change leaf length, angle, flips or settings.
          shape: group.firstElementChild?.outerHTML || null,
          kind: group.dataset.kind, opacity: ink.length ? effectiveOpacity(ink[0]) : 0,
          // The existing live physical-body hit path may legitimately be under
          // the leaf. Only this new opening symbol must stay non-interactive.
          intercepts: hitStack.some((node) => node.closest('[data-hp="opening"]') === group
            && !!node.closest('[data-hp-live-editor]')),
          hitStack: hitStack.map((node) => ({ tag: node.tagName, class: node.getAttribute('class'),
            hp: node.getAttribute('data-hp'), id: node.getAttribute('data-id'),
            opening: node.closest('[data-hp="opening"]')?.getAttribute('data-id') || null,
            live: !!node.closest('[data-hp-live-editor]') })),
        };
      });
    return [id, { copies, visible: copies.filter((copy) => copy.visible) }];
  }));
  const body = root.querySelector('[data-hp-live-editor] .physical-drag');
  return {
    builds: { ...c._floorCacheBuilds }, pool: [...c._wallUnionPool.keys()], epoch: c._cfgEpoch,
    openingDrag: c._opDrag && { id: c._opDrag.id, moved: c._opDrag.moved },
    openingDragFallbacks: c._editorRuntime._openingDragFallbackBuilds ?? 0,
    openingCut: (() => {
      const opening = c._openingsR.find(o => o.id === 'held_window');
      const path = [...root.querySelectorAll('.hp-opening-drag-local .wallbody-fill')]
        .find(element => getComputedStyle(element).visibility === 'visible');
      return opening && path ? {centerEmpty:!path.isPointInFill(new DOMPoint(opening.rx,opening.ry)),
        shoulderSolid:path.isPointInFill(new DOMPoint(opening.rx+opening.rlen/2+1,opening.ry))} : null;
    })(),
    full: proof.full, liveFrames: c._liveEditorPaintCount, writes: proof.writes,
    acceptedWrites: proof.acceptedWrites, history: c._geometryHistory.size,
    config: structuredClone(c._serverCfg),
    space: structuredClone(c._serverCfg.spaces.find((space) => space.id === 'opening-preview')),
    openings, liveOpeningCount: root.querySelectorAll('[data-hp-live-editor] [data-hp="opening"]').length,
    body: body?.outerHTML || null, bodyVisible: !!body && effectiveOpacity(body) > 0
      && body.getBoundingClientRect().width > 0 && body.getBoundingClientRect().height > 0,
    downs: [...proof.downs], cancels: [...proof.cancels],
  };
}, allIds);

const one = (state, id) => {
  assert.equal(state.openings[id].visible.length, 1, `${id}: exactly one painted copy across the whole scene`);
  return state.openings[id].visible[0];
};
const unchangedBeforeRelease = (state, before) => {
  assert.deepEqual(state.config, before.config, 'held/cancelled preview never mutates canonical config');
  assert.equal(state.writes, before.writes, 'no config transport before accepted release');
  assert.equal(state.acceptedWrites, before.acceptedWrites, 'no backend-accepted config write before release');
  assert.equal(state.history, before.history, 'no premature history step');
};
const paintedAt = (state, baseline, dx, dy, live) => {
  for (const id of allIds) {
    const painted = one(state, id), initial = one(baseline, id), moving = hostedIds.includes(id);
    near(painted.origin[0] - initial.origin[0], moving ? dx : 0);
    near(painted.origin[1] - initial.origin[1], moving ? dy : 0);
    assert.equal(painted.shape, initial.shape, `${id}: original painted dimensions, angle and flips`);
    assert.equal(painted.kind, initial.kind);
    assert.equal(painted.live, moving && live, `${id}: only exact hosted ids belong to live preview`);
    if (moving && live) assert.equal(painted.intercepts, false, 'live symbols never capture the pointer');
  }
};
const restored = (state, before, paintedBaseline) => {
  unchangedBeforeRelease(state, before);
  paintedAt(state, paintedBaseline, 0, 0, false);
  assert.equal(state.liveOpeningCount, 0, 'terminal cleanup removes all transient opening nodes');
  assert.equal(state.body, null, 'terminal cleanup removes the live physical ghost');
};
const heldAt = (state, before, down, baseline, dx, dy) => {
  unchangedBeforeRelease(state, before);
  assert.equal(state.full, down.full, 'held movement does not full-render Lit');
  assert.ok(state.liveFrames > down.liveFrames, 'held input paints actual live frames');
  assert.equal(state.bodyVisible, true, 'the native body drag actually paints');
  paintedAt(state, baseline, dx, dy, true);
};

try {
  await page.evaluate(async () => {
    await window.__hpTest.setServerConfig((cfg) => {
      cfg.model_version = 10;
      cfg.spaces = [{ id: 'opening-preview', title: 'Hosted opening preview', cell_cm: 5,
        // No columns: omit the optional empty field, as ordinary write cleanup
        // canonicalises it. Keep the full exact Undo equality below unchanged.
        view_box: [0, 0, 1, 1], rooms: [], wall_segments: [],
        partitions: [
          { id: 'p_move', a: [.2, .3], b: [.7, .3], cm: 20 },
          { id: 'p_static', a: [.8, .55], b: [.8, .85], cm: 15 },
        ],
        openings: [
          { id: 'held_door', type: 'door', x: .325, y: .3, angle: 0, length: .08,
            contact: null, lock: null, invert: true, flip_h: true, flip_v: false,
            host: { kind: 'partition', id: 'p_move', t: .25 } },
          { id: 'held_window', type: 'window', x: .575, y: .3, angle: 0, length: .06,
            contact: null, invert: false, flip_h: false, flip_v: true,
            host: { kind: 'partition', id: 'p_move', t: .75 } },
          { id: 'static_window', type: 'window', x: .8, y: .7, angle: 90, length: .06,
            contact: null, invert: true, flip_h: true, flip_v: true,
            host: { kind: 'partition', id: 'p_static', t: .5 } },
        ],
      }];
    });
    await window.__hpTest.switchSpace('opening-preview');
    await window.__hpTest.setMode('plan');
    await window.__hpTest.setTool('select');
  });
  await page.waitForFunction(() => !window.__card.renderRoot.querySelector('.stage.mode-transition'));
  await writesSettled(); await settle();
  await page.evaluate(async () => {
    const c = window.__card;
    window.__partitionPreviewProof = { full: 0, writes: 0, acceptedWrites: 0, downs: [], cancels: [] };
    const stage = c.renderRoot.querySelector('.stage');
    for (const type of ['pointerdown', 'pointercancel']) stage.addEventListener(type, (event) => {
      const record = { pid: event.pointerId, trusted: event.isTrusted, type: event.pointerType,
        hp: event.target.getAttribute('data-hp'), id: event.target.getAttribute('data-id') };
      window.__partitionPreviewProof[type === 'pointerdown' ? 'downs' : 'cancels'].push(record);
    }, { capture: true });
    const render = c._renderBody.bind(c);
    c._renderBody = function (...args) { // private-ok: diagnostic call counter returns the real unmodified renderer result; never sets gesture state
      window.__partitionPreviewProof.full++; return render(...args);
    };
    const callWS = c.hass.callWS.bind(c.hass);
    c.hass = { ...c.hass, callWS: async (message) => {
      const write = message.type === 'houseplan/config/set';
      if (write) window.__partitionPreviewProof.writes++;
      const result = await callWS(message); // Real fixture transport/persistence is never suppressed or replaced by a fake ACK.
      if (write) window.__partitionPreviewProof.acceptedWrites++;
      return result;
    } };
    await window.__hpTest.settled();
  });
  const baseline = await sample();
  for (const id of allIds) {
    const painted = one(baseline, id);
    assert.equal(painted.live, false);
    assert.ok(painted.shape?.includes('op-leaf'), `${id}: fixture paints a real leaf`);
  }
  near(one(baseline, 'held_door').origin[0], 325);
  near(one(baseline, 'held_window').origin[0], 575);
  near(one(baseline, 'static_window').origin[0], 800);
  out.canonicalFixturePaintsDoorWindowAndStaticOther = true;

  const start = await at(250, 300), first = await at(300, 325), second = await at(325, 350);
  const beginMouse = async () => {
    await page.mouse.move(start.x, start.y); await settle();
    const before = await sample();
    await page.mouse.down(); await settle();
    const down = await sample(), input = down.downs.at(-1);
    assert.deepEqual({ trusted: input.trusted, type: input.type, hp: input.hp, id: input.id },
      { trusted: true, type: 'mouse', hp: 'partition', id: 'p_move' });
    assert.equal(down.full - before.full, 1, 'real physical down full-renders exactly once');
    return { before, down };
  };
  const mouseTargets = async (before, down, label) => {
    await page.mouse.move(first.x, first.y, { steps: 6 }); await settle();
    const firstHeld = await sample(); trace.push({ label: `${label}-first`, state: firstHeld });
    heldAt(firstHeld, before, down, baseline, 50, 25);
    await page.mouse.move(second.x, second.y, { steps: 6 }); await settle();
    const secondHeld = await sample(); trace.push({ label: `${label}-second`, state: secondHeld });
    heldAt(secondHeld, before, down, baseline, 75, 50);
    assert.notDeepEqual(one(secondHeld, 'held_door').origin, one(firstHeld, 'held_door').origin,
      'two distinct accepted snapped targets were actually painted');
    return secondHeld;
  };

  // First real gesture cancels by keyboard, then its actual pointer is released.
  const escape = await beginMouse();
  await mouseTargets(escape.before, escape.down, 'escape');
  out.twoDistinctHeldTargetsFollowExactDeltaWithOneVisibleCopy = true;
  out.staticOtherAndPaintedSettingsStayUnchanged = true;
  out.heldPreviewNeverWritesConfigOrHistory = true;
  await page.keyboard.press('Escape'); await settle();
  restored(await sample(), escape.before, baseline);
  await page.mouse.up(); await writesSettled(); await settle();
  restored(await sample(), escape.before, baseline);
  out.nativeEscapeRollsBackAndLateRealUpCannotCommit = true;

  // A second ordinary mouse gesture is accepted as one existing physical transaction.
  const accepted = await beginMouse(), held = await mouseTargets(accepted.before, accepted.down, 'release');
  await page.mouse.up(); await settle();
  const terminal = await sample();
  assert.equal(terminal.full - held.full, 1, 'real accepted up full-renders exactly once');
  await writesSettled(); await settle();
  const released = await sample(); trace.push({ label: 'released', state: released });
  paintedAt(released, baseline, 75, 50, false);
  assert.equal(released.liveOpeningCount, 0);
  assert.equal(released.body, null);
  assert.equal(released.writes, accepted.before.writes + 1);
  assert.equal(released.acceptedWrites, accepted.before.acceptedWrites + 1);
  assert.equal(released.history, accepted.before.history + 1);
  const movedPartition = released.space.partitions.find((p) => p.id === 'p_move');
  near(movedPartition.a[0], .275); near(movedPartition.a[1], .35);
  near(movedPartition.b[0], .775); near(movedPartition.b[1], .35);
  for (const id of hostedIds) {
    const old = baseline.space.openings.find((opening) => opening.id === id);
    const current = released.space.openings.find((opening) => opening.id === id);
    near(current.x, old.x + .075); near(current.y, old.y + .05);
    assert.deepEqual({ ...current, x: old.x, y: old.y }, old, `${id}: release retains every non-position setting`);
  }
  assert.deepEqual(released.space.partitions.find((p) => p.id === 'p_static'),
    baseline.space.partitions.find((p) => p.id === 'p_static'));
  assert.deepEqual(released.space.openings.find((opening) => opening.id === 'static_window'),
    baseline.space.openings.find((opening) => opening.id === 'static_window'));
  out.releaseKeepsRigidHostAndOpeningsInOneHistoryAndWrite = true;
  out.physicalRenderRouteOneZeroOne = true;

  await page.keyboard.press('Control+z'); await writesSettled(); await settle();
  const undone = await sample();
  assert.deepEqual(undone.space, baseline.space, 'one native Undo restores the entire accepted host/opening transaction');
  paintedAt(undone, baseline, 0, 0, false);
  assert.equal(undone.liveOpeningCount, 0);
  assert.equal(undone.history, baseline.history);
  out.nativeUndoRestoresTheWholeHostOpeningTransaction = true;

  // Repeat after Undo, then Ctrl+Z cancels the active preview instead of history.
  const repeated = await beginMouse();
  await mouseTargets(repeated.before, repeated.down, 'repeat-active-undo');
  await page.keyboard.press('Control+z'); await settle();
  restored(await sample(), repeated.before, baseline);
  await page.mouse.up(); await writesSettled(); await settle();
  restored(await sample(), repeated.before, baseline);
  out.repeatedDragAndActiveUndoLeaveNoGhostOrWrite = true;

  // Trusted Chromium cancellation is a bounded terminal negative: it does not
  // claim physical-device touch parity, GPU acceptance or browser persistence.
  const session = await page.context().newCDPSession(page);
  let touchHeld;
  try {
    await settle();
    const before = await sample();
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart',
      touchPoints: [{ x: start.x, y: start.y, id: 861 }] });
    await settle();
    const down = await sample(), input = down.downs.at(-1);
    assert.equal(down.downs.length, before.downs.length + 1);
    assert.deepEqual({ trusted: input.trusted, type: input.type, hp: input.hp, id: input.id },
      { trusted: true, type: 'touch', hp: 'partition', id: 'p_move' });
    assert.equal(down.full - before.full, 1);
    for (const [target, dx, dy] of [[first, 50, 25], [second, 75, 50]]) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove',
        touchPoints: [{ x: target.x, y: target.y, id: 861 }] });
      await settle();
      touchHeld = await sample(); heldAt(touchHeld, before, down, baseline, dx, dy);
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await writesSettled(); await settle();
    const cancelled = await sample(), cancel = cancelled.cancels.at(-1);
    trace.push({ label: 'trusted-cancel', state: cancelled });
    assert.equal(cancelled.cancels.length, before.cancels.length + 1);
    assert.equal(cancel.trusted, true);
    assert.equal(cancel.type, 'touch');
    assert.equal(cancel.pid, input.pid, 'browser delivered cancel belongs to the actual owner pointer');
    restored(cancelled, before, baseline);
  } finally { await session.detach(); }
  out.trustedSamePointerCancelRestoresWithoutConfigHistoryOrGhost = true;
  // #1097: move the hosted opening itself, after all frozen #861 physical
  // host-characterization checks above have completed without new expectations.
  const openingStart = await at(575, 300);
  await page.mouse.move(openingStart.x, openingStart.y); await page.mouse.down(); await settle();
  const openingDown = await sample();
  assert.equal(openingDown.openingDrag.id, 'held_window', 'trusted hit starts the actual opening owner');
  const openingBefore = openingDown.space.openings.find(o => o.id === 'held_window');
  for (let index = 1; index <= 30; index++) {
    if (index === 15 || index === 20) {
      await page.setViewportSize({width:index === 15 ? 720 : 1280,height:960});
      await settle();
    }
    const target = await at(575 + index * 50 / 30, 300);
    await page.mouse.move(target.x, target.y); await settle();
    const frame = await sample();
    unchangedBeforeRelease(frame, openingDown);
    assert.equal(frame.epoch, openingDown.epoch);
    assert.deepEqual(frame.pool, openingDown.pool);
    for (const family of ['wallUnion', 'physicalBodies', 'innerContour', 'cleanFloor', 'lightBarrier'])
      assert.equal(frame.builds[family], openingDown.builds[family], `${family}: no full-floor work per opening frame`);
    assert.equal(frame.openingDragFallbacks, openingDown.openingDragFallbacks);
    if (frame.openingDrag.moved) {
      assert.equal(frame.openingCut?.centerEmpty, true, 'the local cut follows across live and normal host paint');
      assert.equal(frame.openingCut.shoulderSolid, true);
    }
    assert.equal(one(frame, 'held_door').origin[0], one(openingDown, 'held_door').origin[0]);
  }
  const openingHeld = await sample();
  assert.equal(openingHeld.openingDrag.moved, true);
  assert.ok(openingHeld.liveFrames > openingDown.liveFrames);
  assert.ok(openingHeld.full > openingDown.full, 'real viewport changes exercised ordinary host paint during the held opening');
  near(one(openingHeld, 'held_window').origin[0], 625);
  await page.mouse.up(); await writesSettled(); await settle();
  const openingReleased = await sample();
  const changedOpening = openingReleased.space.openings.find(o => o.id === 'held_window');
  assert.deepEqual(changedOpening, { ...openingBefore, x: .625, host: { ...openingBefore.host, t: .85 } },
    'same saved position, host.t, angle and every non-position field');
  assert.equal(openingReleased.writes, openingDown.writes + 1);
  assert.equal(openingReleased.history, openingDown.history + 1);
  assert.deepEqual(openingReleased.space.partitions, openingDown.space.partitions);
  out.openingDragRecutsOnlyItsPartitionAndPreservesSavedContract = true;
  checkAll(out);
  await finish(browser);
} catch (error) {
  console.log('diagnostic partition-opening-preview', JSON.stringify({ out, trace,
    sample: await sample().catch(() => null) }));
  await browser.close(); throw error;
}
