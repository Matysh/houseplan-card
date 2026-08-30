import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
  const settle = async () => {
    const started = performance.now();
    do { await new Promise((resolve) => requestAnimationFrame(resolve)); }
    while (c._modeTransitionBusy && performance.now() - started < 1500);
    await c.updateComplete;
  };
  const idle = async () => {
    const started = performance.now();
    while (c._devicePositionBusy && performance.now() - started < 1500) await wait(10);
    await c.updateComplete;
  };

  [...sr().querySelectorAll('.modetab')][1].click();
  await settle();
  const deviceNode = () => sr().querySelector('.dev:not(.ha-disabled)');
  let node = deviceNode();
  const deviceId = node?.getAttribute('data-id');
  const device = c._devices.find((candidate) => candidate.id === deviceId);
  if (!node || !device) return { fixtureReady: false };
  out.fixtureReady = true;

  const originalCallWs = c.hass.callWS;
  let revision = 20;
  let serverLayout = structuredClone(c._layout);
  const writes = [];
  let failNextUpdate = false;
  let failNextDelete = false;
  c.hass = { ...c.hass, callWS: async (message) => {
    if (message.type === 'houseplan/layout/get') {
      return { layout: structuredClone(serverLayout), rev: revision };
    }
    if (message.type === 'houseplan/layout/update') {
      if (failNextUpdate) { failNextUpdate = false; throw new Error('update refused'); }
      writes.push({ type: 'update', id: message.device_id, pos: structuredClone(message.pos) });
      serverLayout = { ...serverLayout, [message.device_id]: structuredClone(message.pos) };
      return { rev: ++revision };
    }
    if (message.type === 'houseplan/layout/delete') {
      if (failNextDelete) { failNextDelete = false; throw new Error('delete refused'); }
      writes.push({ type: 'delete', id: message.device_id });
      delete serverLayout[message.device_id];
      return { rev: ++revision };
    }
    return originalCallWs(message);
  } };
  c._serverStorage = true;
  c._layoutRev = revision;

  const fire = (target, type, x, y, pointerId = 74) => target.dispatchEvent(new PointerEvent(type, {
    pointerId, pointerType: 'mouse', button: 0, buttons: type === 'pointerup' ? 0 : 1,
    clientX: x, clientY: y, bubbles: true, composed: true, cancelable: true,
  }));
  const drag = async ({ dx = 80, cancel = false, cancelType = 'pointercancel', moves = 10, pointerId = 74 } = {}) => {
    node = deviceNode();
    const rect = node.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    fire(node, 'pointerdown', x, y, pointerId);
    for (let index = 1; index <= moves; index++) {
      fire(node, 'pointermove', x + dx * index / moves, y, pointerId);
    }
    const writesBeforeEnd = writes.length;
    fire(node, cancel ? cancelType : 'pointerup', x + dx, y, pointerId);
    await idle();
    return writesBeforeEnd;
  };
  const beginPreview = (dx, pointerId) => {
    node = deviceNode();
    const rect = node.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    fire(node, 'pointerdown', x, y, pointerId);
    fire(node, 'pointermove', x + dx, y, pointerId);
    return { node, x, y };
  };

  const explicit = c._devicePlacementForCanvas(device, c._pos(device).x, c._pos(device).y);
  c._layout = { ...c._layout, [deviceId]: { ...explicit, k: 0, future: 'kept' } };
  serverLayout = structuredClone(c._layout);
  c._layoutContentFingerprint = '';
  c._devicePositionHistory.clear();
  c.requestUpdate();
  await c.updateComplete;

  const writesBeforeRelease = await drag();
  out.previewDoesNotPersist = writesBeforeRelease === 0;
  out.oneDragOneWrite = writes.length === 1 && writes[0].type === 'update';
  out.oneDragOneCommand = c._devicePositionHistory.size === 1;
  out.futureFieldsSurviveDrag = c._layout[deviceId].k === 0
    && c._layout[deviceId].future === 'kept';
  out.undoEnabled = !sr().querySelector('[data-device-position-history="undo"]').disabled;
  // #397 AC1: after a write the local copy IS what went over the wire.
  out.localCopyEqualsTheWire = writes.length > 0
    && JSON.stringify(c._layout[deviceId]) === JSON.stringify({
      ...c._layout[deviceId], ...writes[writes.length - 1].pos,
    })
    && JSON.stringify(serverLayout[deviceId]) === JSON.stringify(writes[writes.length - 1].pos);

  const afterDrag = structuredClone(c._layout[deviceId]);
  sr().querySelector('[data-device-position-history="undo"]').click();
  await idle();
  // #397: the card now keeps what it sent — the canonical position — so a
  // restored placement may differ from the raw `explicit` by the lattice snap
  // (< 1e-9 of the plan, invisible). The equality is therefore stated to that
  // precision, and the snap itself is pinned separately below: a real logical
  // drift would exceed it by orders of magnitude.
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  out.undoRestoresExactStart = near(c._layout[deviceId].x, explicit.x)
    && near(c._layout[deviceId].y, explicit.y)
    && c._layout[deviceId].k === 0
    && c._devicePositionHistory.canRedo;
  sr().querySelector('[data-device-position-history="redo"]').click();
  await idle();
  out.redoRestoresExactEnd = JSON.stringify(c._layout[deviceId]) === JSON.stringify(afterDrag);
  window.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'z', code: 'KeyZ', ctrlKey: true, bubbles: true, composed: true, cancelable: true,
  }));
  await idle();
  out.keyboardUndoWorks = c._devicePositionHistory.canRedo
    && near(c._layout[deviceId].x, explicit.x) && near(c._layout[deviceId].y, explicit.y);
  window.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'z', code: 'KeyZ', ctrlKey: true, shiftKey: true,
    bubbles: true, composed: true, cancelable: true,
  }));
  await idle();
  out.keyboardRedoWorks = JSON.stringify(c._layout[deviceId]) === JSON.stringify(afterDrag);

  // Escape and an Undo request during preview abort only the uncommitted drag.
  const beforeEscape = structuredClone(c._layout[deviceId]);
  const writesBeforeEscape = writes.length;
  beginPreview(95, 741);
  window.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Escape', code: 'Escape', bubbles: true, composed: true, cancelable: true,
  }));
  await c.updateComplete;
  out.escapeAbortsWithoutWrite = JSON.stringify(c._layout[deviceId]) === JSON.stringify(beforeEscape)
    && writes.length === writesBeforeEscape && c._deviceDrag === null;
  const historySizeBeforePreviewUndo = c._devicePositionHistory.size;
  beginPreview(105, 742);
  sr().querySelector('[data-device-position-history="undo"]').click();
  await c.updateComplete;
  out.undoDuringDragOnlyAborts = JSON.stringify(c._layout[deviceId]) === JSON.stringify(beforeEscape)
    && writes.length === writesBeforeEscape
    && c._devicePositionHistory.size === historySizeBeforePreviewUndo
    && c._deviceDrag === null;

  // Leaving the editor is another abort boundary; re-enter for the remaining cases.
  beginPreview(115, 743);
  [...sr().querySelectorAll('.modetab')][0].click();
  await settle();
  out.modeSwitchAbortsWithoutWrite = JSON.stringify(c._layout[deviceId]) === JSON.stringify(beforeEscape)
    && writes.length === writesBeforeEscape && c._deviceDrag === null;
  [...sr().querySelectorAll('.modetab')][1].click();
  await settle();

  // A no-op after Undo must not destroy the redo branch.
  sr().querySelector('[data-device-position-history="undo"]').click();
  await idle();
  const redoName = c._devicePositionHistory.redoName;
  const writesBeforeNoop = writes.length;
  await drag({ dx: 0, moves: 0, pointerId: 75 });
  out.noopKeepsRedo = c._devicePositionHistory.redoName === redoName
    && writes.length === writesBeforeNoop;
  sr().querySelector('[data-device-position-history="redo"]').click();
  await idle();

  // Cancellation restores the raw before-state and performs no final write.
  const beforeCancel = structuredClone(c._layout[deviceId]);
  const writesBeforeCancel = writes.length;
  await drag({ dx: 120, cancel: true, pointerId: 76 });
  out.cancelRestoresWithoutWrite = JSON.stringify(c._layout[deviceId]) === JSON.stringify(beforeCancel)
    && writes.length === writesBeforeCancel;
  await drag({ dx: 120, cancel: true, cancelType: 'lostpointercapture', pointerId: 761 });
  out.lostCaptureRestoresWithoutWrite = JSON.stringify(c._layout[deviceId]) === JSON.stringify(beforeCancel)
    && writes.length === writesBeforeCancel;

  // A second pointer invalidates the first single-pointer transaction.
  node = deviceNode();
  let rect = node.getBoundingClientRect();
  let x = rect.left + rect.width / 2;
  let y = rect.top + rect.height / 2;
  fire(node, 'pointerdown', x, y, 762);
  fire(node, 'pointermove', x + 100, y, 762);
  fire(node, 'pointerdown', x, y, 763);
  await c.updateComplete;
  out.secondPointerAbortsWithoutWrite = JSON.stringify(c._layout[deviceId]) === JSON.stringify(beforeCancel)
    && writes.length === writesBeforeCancel && c._deviceDrag === null;

  // An auto-positioned marker round-trips through delete/update.
  c._devicePositionHistory.clear();
  delete c._layout[deviceId];
  delete serverLayout[deviceId];
  c.requestUpdate();
  await c.updateComplete;
  await drag({ dx: 90, pointerId: 77 });
  const autoAfter = structuredClone(c._layout[deviceId]);
  const beforeAutoUndo = writes.length;
  sr().querySelector('[data-device-position-history="undo"]').click();
  await idle();
  out.autoUndoDeletesExplicitPlacement = !(deviceId in c._layout)
    && writes[beforeAutoUndo]?.type === 'delete';
  sr().querySelector('[data-device-position-history="redo"]').click();
  await idle();
  out.autoRedoRestoresPlacement = JSON.stringify(c._layout[deviceId]) === JSON.stringify(autoAfter)
    && writes.at(-1)?.type === 'update';

  // Failed final update never enters history; failed Undo restores stack direction.
  c._devicePositionHistory.clear();
  const beforeFailedDrag = structuredClone(c._layout[deviceId]);
  failNextUpdate = true;
  await drag({ dx: 110, pointerId: 78 });
  out.failedDragRollsBack = JSON.stringify(c._layout[deviceId]) === JSON.stringify(beforeFailedDrag)
    && !c._devicePositionHistory.canUndo;
  delete c._layout[deviceId];
  delete serverLayout[deviceId];
  c.requestUpdate();
  await c.updateComplete;
  await drag({ dx: 100, pointerId: 79 });
  const beforeFailedDelete = structuredClone(c._layout[deviceId]);
  failNextDelete = true;
  sr().querySelector('[data-device-position-history="undo"]').click();
  await idle();
  out.failedUndoRestoresStackDirection = JSON.stringify(c._layout[deviceId])
      === JSON.stringify(beforeFailedDelete)
    && c._devicePositionHistory.canUndo && !c._devicePositionHistory.canRedo;

  // Native text history stays native even with an available command.
  const input = document.createElement('input');
  sr().append(input);
  const sizeBeforeInput = c._devicePositionHistory.size;
  input.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'z', code: 'KeyZ', ctrlKey: true, bubbles: true, composed: true, cancelable: true,
  }));
  await wait();
  out.nativeInputHistoryNotIntercepted = c._devicePositionHistory.size === sizeBeforeInput;
  input.remove();

  // Same-content reload is an own/reconnect echo; different content is remote
  // authority. #397: the server snapshot is NOT copied from the card here — it
  // already holds what actually went over the wire (the fake WS above stores
  // `message.pos`). The former `serverLayout = structuredClone(c._layout)`
  // erased by hand the very divergence this check exists to catch: the wire
  // carries the canonical position while `_layout` kept the raw one, so the
  // card mistook its own echo for a remote edit and cleared the stack. With
  // the assignment gone the check reddens on the unfixed code.
  const ownEchoServerPos = structuredClone(serverLayout[deviceId]);
  const ownEchoLocalPos = structuredClone(c._layout[deviceId]);
  await c._reloadLayoutOnly();
  out.sameContentReloadKeepsHistory = c._devicePositionHistory.canUndo;
  // The point of the check is only meaningful if the two sides were equal to
  // begin with: pin that explicitly instead of assuming it.
  out.ownEchoMatchesWhatWentOverTheWire =
    JSON.stringify(ownEchoServerPos) === JSON.stringify(ownEchoLocalPos);
  serverLayout = {
    ...serverLayout,
    [deviceId]: { ...serverLayout[deviceId], x: serverLayout[deviceId].x + 0.01 },
  };
  await c._reloadLayoutOnly();
  out.remoteContentClearsHistory = !c._devicePositionHistory.canUndo
    && !c._devicePositionHistory.canRedo;

  // #397 AC5b: the echo of a DELETE must not clear the stack either — the
  // delete branch removes a key instead of replacing a value, so proving the
  // update branch says nothing about it.
  const echoProbe = c._devices.find((candidate) => candidate.id !== deviceId
    && candidate.bindingStatus?.kind !== 'ha_disabled');
  if (echoProbe) {
    c._layout = { ...c._layout, [echoProbe.id]: { s: echoProbe.space, x: 0.42, y: 0.42 } };
    await c._persistDevicePlacement(echoProbe.id, { s: echoProbe.space, x: 0.42, y: 0.42 });
    c._devicePositionHistory.push({
      name: 'echo probe move',
      before: { deviceId: echoProbe.id, spaceId: echoProbe.space, placement: null },
      after: { deviceId: echoProbe.id, spaceId: echoProbe.space,
        placement: { s: echoProbe.space, x: 0.42, y: 0.42 } },
    });
    await c._persistDevicePlacement(echoProbe.id, null);
    await c._reloadLayoutOnly();
    out.deleteEchoKeepsHistory = c._devicePositionHistory.canUndo
      && c._layout[echoProbe.id] === undefined;

    // #397 AC7: while a write is in flight the card is the authority — a
    // server answer holding the OLD position must not win the merge.
    const inFlightPos = { s: echoProbe.space, x: 0.63, y: 0.21 };
    serverLayout = { ...serverLayout, [echoProbe.id]: { s: echoProbe.space, x: 0.1, y: 0.1 } };
    c._sentPos.set(echoProbe.id, structuredClone(inFlightPos));
    c._layout = { ...c._layout, [echoProbe.id]: structuredClone(inFlightPos) };
    await c._reloadLayoutOnly();
    out.inFlightPositionWinsTheMerge =
      JSON.stringify(c._layout[echoProbe.id]) === JSON.stringify(inFlightPos);
    c._sentPos.delete(echoProbe.id);
  } else {
    out.deleteEchoKeepsHistory = null;
    out.inFlightPositionWinsTheMerge = null;
  }

  // A valid command owns its original space and makes the result visible there.
  const otherDevice = c._devices.find((candidate) => candidate.space !== device.space
    && candidate.bindingStatus?.kind !== 'ha_disabled');
  if (otherDevice) {
    const otherBefore = { s: otherDevice.space, x: 0.55, y: 0.55 };
    const otherAfter = { s: otherDevice.space, x: 0.6, y: 0.55 };
    c._layout = { ...c._layout, [otherDevice.id]: structuredClone(otherAfter) };
    serverLayout = structuredClone(c._layout);
    c._layoutContentFingerprint = '';
    c._devicePositionHistory.push({
      name: 'other-space move',
      before: { deviceId: otherDevice.id, spaceId: otherDevice.space, placement: otherBefore },
      after: { deviceId: otherDevice.id, spaceId: otherDevice.space, placement: otherAfter },
    });
    c.requestUpdate();
    await c.updateComplete;
    sr().querySelector('[data-device-position-history="undo"]').click();
    await idle();
    await settle();
    const observedOther = c._layout[otherDevice.id];
    out.otherSpaceUndoIsVisible = c._space === otherDevice.space
      && observedOther?.s === otherBefore.s
      && observedOther?.x === otherBefore.x
      && observedOther?.y === otherBefore.y;
    c._commitSpace(device.space);
    await settle();
  } else {
    out.otherSpaceUndoIsVisible = false;
  }

  // Stale commands fail closed instead of recreating a deleted/rebound/disabled marker.
  const staleCommand = (id, spaceId) => ({
    name: 'stale move',
    before: { deviceId: id, spaceId, placement: { s: spaceId, x: 0.4, y: 0.4 } },
    after: { deviceId: id, spaceId, placement: { s: spaceId, x: 0.45, y: 0.4 } },
  });
  const writesBeforeStale = writes.length;
  c._devicePositionHistory.clear();
  c._devicePositionHistory.push(staleCommand('removed-device', device.space));
  c.requestUpdate();
  await c.updateComplete;
  sr().querySelector('[data-device-position-history="undo"]').click();
  await c.updateComplete;
  out.deletedDeviceCommandFailsClosed = !c._devicePositionHistory.canUndo
    && !c._devicePositionHistory.canRedo && writes.length === writesBeforeStale;

  c._devicePositionHistory.push(staleCommand(device.id, 'garden'));
  c.requestUpdate();
  await c.updateComplete;
  sr().querySelector('[data-device-position-history="undo"]').click();
  await c.updateComplete;
  out.reboundDeviceCommandFailsClosed = !c._devicePositionHistory.canUndo
    && !c._devicePositionHistory.canRedo && writes.length === writesBeforeStale;

  const devicesBeforeDisable = c._devices;
  c._devices = devicesBeforeDisable.map((candidate) => candidate.id === device.id
    ? { ...candidate, bindingStatus: { kind: 'ha_disabled' } } : candidate);
  c._devicePositionHistory.push(staleCommand(device.id, device.space));
  c.requestUpdate();
  await c.updateComplete;
  sr().querySelector('[data-device-position-history="undo"]').click();
  await c.updateComplete;
  out.disabledDeviceCommandFailsClosed = !c._devicePositionHistory.canUndo
    && !c._devicePositionHistory.canRedo && writes.length === writesBeforeStale;
  c._devices = devicesBeforeDisable;

  return out;
});

checkAll(res, {});
await finish(browser, res);
