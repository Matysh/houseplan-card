// #645: the Plan editor room-settings capsule is a session-only draggable
// control. This production-bundle scenario proves click/drag arbitration,
// boundary/cancel behaviour, touch escalation and editor-session reset.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1280, height: 900 });

const result = await page.evaluate(async () => {
  const card = window.__card;
  const out = {};
  const update = async () => {
    card.requestUpdate();
    await card.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  };
  await window.__hpTest.setMode('plan');
  const activeSpaceId = card._space;
  await window.__hpTest.setServerConfig((cfg) => {
    const edited = cfg.spaces.find((candidate) => candidate.id === activeSpaceId);
    edited.rooms = [{
      id: 'drag-room', name: 'Drag room', area: null,
      poly: [[200, 100], [600, 100], [600, 500], [200, 500]]
        .map(([x, y]) => [x / 1000, y / 1000]),
    }, {
      id: 'other-room', name: 'Other room', area: null,
      poly: [[650, 100], [900, 100], [900, 500], [650, 500]]
        .map(([x, y]) => [x / 1000, y / 1000]),
    }];
    edited.openings = [];
    delete edited.walls;
    delete edited.open_spans;
    delete edited.partitions;
    delete edited.room_drafts;
    delete edited.wall_columns;
  });
  const space = card._serverCfg.spaces.find((candidate) => candidate.id === activeSpaceId);
  const configBaseline = JSON.stringify(card._serverCfg);
  const layoutBaseline = JSON.stringify(card._layout);

  const stage = card.renderRoot.querySelector('.stage');
  const gear = () => card.renderRoot.querySelector(
    '[data-hp="room-settings"][data-room="drag-room"]',
  );
  const screen = (x, y) => {
    const rect = stage.getBoundingClientRect();
    const svg = stage.querySelector('svg');
    const [vx, vy, vw, vh] = svg.getAttribute('viewBox').split(' ').map(Number);
    return [rect.left + ((x - vx) / vw) * rect.width, rect.top + ((y - vy) / vh) * rect.height];
  };
  const fire = (target, type, x, y, options = {}) => target.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: options.pointerId ?? 645,
    pointerType: options.pointerType ?? 'mouse', isPrimary: options.isPrimary ?? true,
    button: 0, buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
    clientX: x, clientY: y,
  }));
  const click = (target) => target.dispatchEvent(new MouseEvent('click', {
    bubbles: true, cancelable: true, detail: 1,
  }));
  const position = () => {
    const key = `${space.id}\u0000drag-room`;
    return card._editorRuntime.roomGear.positions.get(key)?.slice() || null;
  };

  const initialGearRect = gear().getBoundingClientRect();
  const sx = initialGearRect.left + initialGearRect.width / 2;
  const sy = initialGearRect.top + initialGearRect.height / 2;
  const [tx, ty] = screen(520, 300);
  fire(gear(), 'pointerdown', sx, sy);
  fire(gear(), 'pointermove', tx, ty);
  await update();
  out.dragFeedback = gear().classList.contains('dragging')
    && getComputedStyle(gear()).cursor === 'grabbing';
  const moved = position();
  out.dragUsesPlanCoordinates = !!moved && Math.abs(moved[0] - 520) < 1
    && Math.abs(moved[1] - 300) < 1;
  const movedGearHit = gear().getBoundingClientRect();
  out.freesCoveredPoint = sx < movedGearHit.left || sx > movedGearHit.right
    || sy < movedGearHit.top || sy > movedGearHit.bottom;
  out.otherRoomStaysIndependent = !card._editorRuntime.roomGear.positions.has(
    `${space.id}\u0000other-room`,
  );
  out.onlyDraggedRoomGetsTemporaryPosition = card._editorRuntime.roomGear.positions.size === 1;
  fire(gear(), 'pointerup', tx, ty);
  await update();
  click(gear());
  await update();
  out.syntheticClickSuppressed = card._roomDialog !== true;

  // A new, stationary pointer sequence is a normal click and opens settings.
  const movedGearRect = gear().getBoundingClientRect();
  const gx = movedGearRect.left + movedGearRect.width / 2;
  const gy = movedGearRect.top + movedGearRect.height / 2;
  fire(gear(), 'pointerdown', gx, gy, { pointerId: 646 });
  fire(gear(), 'pointerup', gx, gy, { pointerId: 646 });
  click(gear());
  await update();
  out.nextClickOpens = card._roomDialog === true && card._roomEditId === 'drag-room';
  card._roomDialogCancel();
  await update();

  // Zoom changes the screen position, not the saved plan point.
  const beforeZoom = position();
  card._zoomAt(stage.clientWidth / 2, stage.clientHeight / 2, 1.7);
  await update();
  out.zoomKeepsPlanPosition = JSON.stringify(position()) === JSON.stringify(beforeZoom);
  const otherSpace = card._serverCfg.spaces.find((candidate) => candidate.id !== space.id);
  card._commitSpace(otherSpace.id, true);
  await update();
  card._commitSpace(space.id, true);
  await update();
  out.spaceSwitchKeepsPlanPosition = JSON.stringify(position()) === JSON.stringify(beforeZoom);

  // pointercancel restores the position present at gesture start.
  const beforeCancel = position();
  const cancelRect = gear().getBoundingClientRect();
  const cx = cancelRect.left + cancelRect.width / 2;
  const cy = cancelRect.top + cancelRect.height / 2;
  const [cancelX, cancelY] = screen(420, 220);
  fire(gear(), 'pointerdown', cx, cy, { pointerId: 647 });
  fire(gear(), 'pointermove', cancelX, cancelY, { pointerId: 647 });
  await update();
  fire(gear(), 'pointercancel', cancelX, cancelY, { pointerId: 647 });
  await update();
  out.cancelRestoresPosition = JSON.stringify(position()) === JSON.stringify(beforeCancel);
  const lostRect = gear().getBoundingClientRect();
  const lostX = lostRect.left + lostRect.width / 2;
  const lostY = lostRect.top + lostRect.height / 2;
  fire(gear(), 'pointerdown', lostX, lostY, { pointerId: 651 });
  fire(gear(), 'pointermove', cancelX, cancelY, { pointerId: 651 });
  await update();
  fire(gear(), 'lostpointercapture', cancelX, cancelY, { pointerId: 651 });
  await update();
  out.lostCaptureRestoresPosition = JSON.stringify(position()) === JSON.stringify(beforeCancel);

  // The capsule stops on the room boundary instead of leaving it.
  const boundaryRect = gear().getBoundingClientRect();
  const bx = boundaryRect.left + boundaryRect.width / 2;
  const by = boundaryRect.top + boundaryRect.height / 2;
  const [outsideX, outsideY] = screen(800, 300);
  fire(gear(), 'pointerdown', bx, by, { pointerId: 648 });
  fire(gear(), 'pointermove', outsideX, outsideY, { pointerId: 648 });
  await update();
  const boundary = position();
  out.stopsAtBoundary = !!boundary && Math.abs(boundary[0] - 600) < 1
    && Math.abs(boundary[1] - 300) < 1;
  const [insideX, insideY] = screen(560, 300);
  fire(gear(), 'pointermove', insideX, insideY, { pointerId: 648 });
  await update();
  const returnedInside = position();
  out.resumesInsideAfterBoundary = !!returnedInside && Math.abs(returnedInside[0] - 560) < 1;
  fire(gear(), 'pointercancel', insideX, insideY, { pointerId: 648 });
  await update();

  // A second touch cancels/reverts the capsule drag and hands the sequence to
  // the viewport gesture guard rather than opening room settings.
  const touchBefore = position();
  const touchRect = gear().getBoundingClientRect();
  const touchX = touchRect.left + touchRect.width / 2;
  const touchY = touchRect.top + touchRect.height / 2;
  const [touchMoveX, touchMoveY] = screen(440, 250);
  fire(gear(), 'pointerdown', touchX, touchY, {
    pointerId: 649, pointerType: 'touch', isPrimary: true,
  });
  fire(gear(), 'pointermove', touchMoveX, touchMoveY, {
    pointerId: 649, pointerType: 'touch', isPrimary: true,
  });
  await update();
  fire(stage, 'pointerdown', touchMoveX + 50, touchMoveY + 50, {
    pointerId: 650, pointerType: 'touch', isPrimary: false,
  });
  await update();
  out.secondTouchCancels = JSON.stringify(position()) === JSON.stringify(touchBefore)
    && card._editorRuntime.roomGear.drag === null
    && card._roomGearTouchNavigation === true
    && card._roomDialog !== true;
  fire(stage, 'pointercancel', touchMoveX + 50, touchMoveY + 50, {
    pointerId: 650, pointerType: 'touch', isPrimary: false,
  });
  fire(stage, 'pointercancel', touchMoveX, touchMoveY, {
    pointerId: 649, pointerType: 'touch', isPrimary: true,
  });
  await update();
  out.dragDoesNotWriteModel = JSON.stringify(card._serverCfg) === configBaseline
    && JSON.stringify(card._layout) === layoutBaseline;

  // A geometry edit that excludes the temporary point falls back immediately
  // and removes the stale record. Removing the room also leaves no record.
  const beforeGeometry = position();
  await window.__hpTest.setServerConfig((cfg) => {
    cfg.spaces.find((candidate) => candidate.id === activeSpaceId).rooms[0].poly = [
      [150, 80], [650, 80], [650, 520], [150, 520],
    ].map(([x, y]) => [x / 1000, y / 1000]);
  });
  out.validGeometryKeepsPosition = JSON.stringify(position()) === JSON.stringify(beforeGeometry);
  await window.__hpTest.setServerConfig((cfg) => {
    cfg.spaces.find((candidate) => candidate.id === activeSpaceId).rooms[0].poly = [
      [200, 100], [450, 100], [450, 500], [200, 500],
    ].map(([x, y]) => [x / 1000, y / 1000]);
  });
  out.geometryInvalidationFallsBack = position() === null && !!gear();
  await window.__hpTest.setServerConfig((cfg) => {
    const edited = cfg.spaces.find((candidate) => candidate.id === activeSpaceId);
    edited.rooms = edited.rooms.filter((room) => room.id !== 'drag-room');
  });
  out.roomDeletionPrunesPosition = position() === null && !gear();

  // End the preceding touch sequence with a fresh mouse pointerdown, exactly
  // as the deliberate click on the editor Close button does in production.
  const close = card.renderRoot.querySelector('[data-hp="editor-close"]');
  const closeRect = close.getBoundingClientRect();
  const closeX = closeRect.left + closeRect.width / 2;
  const closeY = closeRect.top + closeRect.height / 2;
  fire(close, 'pointerdown', closeX, closeY, { pointerId: 652 });
  fire(close, 'pointerup', closeX, closeY, { pointerId: 652 });
  await window.__hpTest.setMode('view');
  out.leavingEditorResetsSession = card._editorRuntime.roomGear.positions.size === 0;
  return out;
});

checkAll(result);
await finish(browser);
