// #663: straight and spiral stairs are plan-editor objects, clean View links
// between spaces, and flat floor content in 2.5D. #676: the editing layer is
// drag-to-draw, an overlay frame with bearing-aware cursors, edge magnets and
// a dialog that keeps untouched sizes; View hover announces the target floor.
// Exercise only public DOM hooks and the harness facade for writes; card
// internals are read-only oracles.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1100, height: 850 });
const out = await page.evaluate(async () => {
  const card = window.__card;
  const hp = window.__hpTest;
  const root = () => card.renderRoot;
  const settled = () => hp.settled();
  const settleCamera = async () => {
    for (let guard = 0; card._cameraTransition?.active && guard < 90; guard++)
      await new Promise((resolve) => requestAnimationFrame(resolve));
    await settled();
  };
  const spaceCfg = (id) => card._serverCfg.spaces.find((space) => space.id === id);
  const stairs = (id = 'f1') => spaceCfg(id)?.stairs || [];
  const stairNode = (id) => root().querySelector(`[data-hp="stair"][data-id="${id}"]`);
  const frame = () => root().querySelector('[data-hp="stair-frame"]');
  const handleAt = (index) => frame()?.querySelectorAll('.hp-stair-resize')[index];
  const handlePoint = (node) => [Number(node?.getAttribute('cx')), Number(node?.getAttribute('cy'))];
  const selectStair = async (id) => {
    stairNode(id)?.querySelector('.hp-stair-hit')?.dispatchEvent(
      new MouseEvent('click', { bubbles: true, composed: true }),
    );
    await settled();
  };
  // The browser synthesizes a click on the pressed element after every
  // pointerup; a gesture witness must send that click too (#676 К6).
  const clickOn = (node) => node?.dispatchEvent(new MouseEvent('click', {
    bubbles: true, composed: true, cancelable: true,
  }));
  const dragStage = async (from, to, id, extra = {}) => {
    pointer(stage(), 'pointerdown', from, id, extra);
    pointer(stage(), 'pointermove', [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2], id, extra);
    pointer(stage(), 'pointermove', to, id, extra);
    pointer(stage(), 'pointerup', to, id, extra);
    clickOn(stage());
    await settled();
  };
  const planSvg = () => root().querySelector('.plan-svg');
  const stage = () => root().querySelector('.stage');
  const screen = ([x, y]) => {
    const point = new DOMPoint(x, y).matrixTransform(planSvg().getScreenCTM());
    return { clientX: point.x, clientY: point.y };
  };
  const clickPlan = async (point) => {
    stage().dispatchEvent(new MouseEvent('click', {
      ...screen(point), bubbles: true, composed: true, cancelable: true, button: 0,
    }));
    await settled();
  };
  const pointer = (target, type, point, id, extra = {}) => target.dispatchEvent(new PointerEvent(type, {
    ...screen(point), bubbles: true, composed: true, cancelable: true,
    pointerId: id, pointerType: extra.pointerType || 'mouse',
    button: type === 'pointerdown' ? 0 : -1, isPrimary: extra.isPrimary ?? true,
    shiftKey: !!extra.shiftKey,
  }));
  const chooseStair = async (kind) => {
    await hp.setTool('stairs');
    const item = root().querySelector(`[data-hp="tray"] [data-group-item="${kind}"]`);
    item?.click();
    await settled();
    return !!item;
  };
  const setDialogSelect = (select, value) => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  };
  const openStairDialog = async (id) => {
    stairNode(id)?.dispatchEvent(new MouseEvent('dblclick', {
      bubbles: true, composed: true, cancelable: true,
    }));
    await settled();
    return root().querySelector('[data-hp="dialog"][data-kind="stairs"]');
  };
  const saveDialog = async (dialog) => {
    dialog?.querySelector('.dialog-action-footer .btn.on')?.click();
    await settled();
  };
  const activeSpace = () => root().querySelector('[data-hp="space-tab"][aria-current="page"]')
    ?.getAttribute('data-id');
  const closeTo = (a, b, tolerance = 1e-5) => Math.abs(a - b) <= tolerance;
  const axisAngleDistance = (angle) => {
    const normalized = ((angle % 180) + 180) % 180;
    return Math.min(normalized, 180 - normalized);
  };
  const result = {};

  await hp.setServerConfig((config) => {
    for (const space of config.spaces) delete space.stairs;
    const first = config.spaces.find((space) => space.id === 'f1');
    // Keep the scale explicit: this witness must prove a 20 cm physical face,
    // not inherit whichever default a fixture migration happens to exercise.
    first.cell_cm = 5;
    // The partition sits well away from the r1/r4 room boundary (y = 0.58):
    // the #676 magnet measures from the stair's own side, and the nearest
    // parallel face wins, so the fixture must not put two faces within reach.
    first.partitions = [...(first.partitions || []), {
      id: 'stair-smoke-wall', a: [0.15, 0.65], b: [0.85, 0.65], cm: 20,
    }];
    return config;
  });
  await hp.switchSpace('f1');
  await hp.setMode('plan');

  result.straightToolExists = await chooseStair('straight');
  // A default stair centred at 680 has its upper side at 638.3: 20 units below
  // the partition's lower face (658.3), within the 25-unit reach but not flush
  // (#676 К3 measures from the side). The exposed side of the body is the only
  // candidate: the face hidden inside the masonry never pulls the stair up.
  await clickPlan([400, 680]);
  const straight = stairs().find((stair) => stair.kind === 'straight');
  result.straightCreatedOnlyOnCurrentFloor = !!straight && stairs('garden').length === 0;
  result.wallMagnetUsesPhysicalFace = !!straight
    && closeTo(straight.y * 1000 - 650, straight.width * 500 + (20 / 5) * (1000 / 240) / 2, 0.01)
    && closeTo(axisAngleDistance(straight.angle), 0);

  result.spiralToolExists = await chooseStair('spiral');
  await clickPlan([580, straight.y * 1000]);
  const spiral = stairs().find((stair) => stair.kind === 'spiral');
  result.spiralCreated = !!spiral && stairs().length === 2;
  result.stairMagnetTouchesOtherFootprint = !!straight && !!spiral
    && closeTo(Math.abs(spiral.x - straight.x) * 1000,
      (straight.length / 2 + spiral.radius) * 1000, 0.5);
  result.renderedTypesAndDirections = !!root().querySelector(
    '[data-hp="stair"][data-kind="straight"] .hp-stair-arrow',
  ) && !!root().querySelector('[data-hp="stair"][data-kind="spiral"] .hp-stair-arrow');

  // Drag-to-draw (#676 AC1): a press-drag-release on the stage draws the
  // straight stair at the drawn size with the ascent along the drag; the
  // draft is visible while the pointer is down; a spiral takes the square.
  await chooseStair('straight');
  const drawnBefore = stairs().length;
  // Room r1 spans x 40–550, y 140–580: every drawn side stays farther than
  // the magnet reach from its walls, so the drawn size is exactly the drag.
  pointer(stage(), 'pointerdown', [200, 300], 6650);
  pointer(stage(), 'pointermove', [260, 280], 6650);
  await settled();
  result.draftIsVisibleWhileDrawing = !!root().querySelector('.hp-stair.draft')
    && !!frame() && stairs().length === drawnBefore;
  pointer(stage(), 'pointermove', [200 + 150, 300 - 50], 6650);
  pointer(stage(), 'pointerup', [200 + 150, 300 - 50], 6650);
  clickOn(stage());
  await settled();
  const drawn = stairs().filter((stair) => stair.kind === 'straight').pop();
  result.dragDrawsTheDrawnSize = stairs().length === drawnBefore + 1 && !!drawn
    && closeTo(drawn.length * 1000, 150, 0.01) && closeTo(drawn.width * 1000, 50, 0.01)
    && drawn.angle === 0 && drawn.direction === 'forward'
    && closeTo(drawn.x * 1000, 275, 0.01) && closeTo(drawn.y * 1000, 275, 0.01)
    && !root().querySelector('.hp-stair.draft');
  await dragStage([300, 500], [320, 300], 6651);
  const drawnUp = stairs().filter((stair) => stair.kind === 'straight').pop();
  result.dragUpwardRisesUpward = !!drawnUp && drawnUp.angle === 270
    && closeTo(drawnUp.length * 1000, 200, 0.01)
    && closeTo(drawnUp.width * 1000, (30 / 5) * (1000 / 240), 0.01);
  await chooseStair('spiral');
  await dragStage([700, 300], [760, 340], 6652);
  const drawnRound = stairs().filter((stair) => stair.kind === 'spiral').pop();
  result.dragDrawsTheSpiralSquare = !!drawnRound && closeTo(drawnRound.radius * 1000, 30, 0.01)
    && closeTo(drawnRound.x * 1000, 730, 0.01) && closeTo(drawnRound.y * 1000, 330, 0.01);
  // The stairs drawn here are not part of the rest of the scenario.
  await hp.setServerConfig((config) => {
    const first = config.spaces.find((space) => space.id === 'f1');
    first.stairs = first.stairs.filter((stair) => ![drawn?.id, drawnUp?.id, drawnRound?.id].includes(stair.id));
    return config;
  });
  await hp.switchSpace('f1');
  await hp.setMode('plan');
  await chooseStair('straight');

  // Select and move the straight stair through its actual hit target.
  const start = { x: straight.x, y: straight.y };
  const straightHit = stairNode(straight.id)?.querySelector('.hp-stair-hit');
  straightHit?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  await settled();
  pointer(straightHit, 'pointerdown', [start.x * 1000, start.y * 1000], 6631);
  pointer(stage(), 'pointermove', [start.x * 1000 - 180, start.y * 1000 - 170], 6631);
  pointer(stage(), 'pointerup', [start.x * 1000 - 180, start.y * 1000 - 170], 6631);
  await settled();
  const moved = stairs().find((stair) => stair.id === straight.id);
  result.moveUsesContinuousTransform = !!moved
    && (!closeTo(moved.x, start.x) || !closeTo(moved.y, start.y));
  window.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'z', code: 'KeyZ', ctrlKey: true, bubbles: true, cancelable: true,
  }));
  await settled();
  const undone = stairs().find((stair) => stair.id === straight.id);
  window.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'z', code: 'KeyZ', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true,
  }));
  await settled();
  const redone = stairs().find((stair) => stair.id === straight.id);
  result.moveUndoRedo = !!undone && !!redone
    && closeTo(undone.x, start.x) && closeTo(undone.y, start.y)
    && closeTo(redone.x, moved.x) && closeTo(redone.y, moved.y);

  // Resize and Shift-rotate through the visible handles of the overlay frame.
  // The Stairs tool is still armed: the click after the gesture must not
  // place another stair (#676 AC6), and the angle must survive (AC11).
  await selectStair(straight.id);
  const stairsBeforeResize = stairs().length;
  const beforeResize = stairs().find((stair) => stair.id === straight.id);
  result.frameHasEightHandlesAndRotation = frame()?.querySelectorAll('.hp-stair-resize').length === 8
    && !!frame()?.querySelector('.hp-stair-rotate');
  const resize = handleAt(0); // (-1, -1) corner
  const resizePoint = handlePoint(resize);
  pointer(resize, 'pointerdown', resizePoint, 6632);
  pointer(stage(), 'pointermove', [resizePoint[0] - 35, resizePoint[1] - 25], 6632);
  pointer(stage(), 'pointerup', [resizePoint[0] - 35, resizePoint[1] - 25], 6632);
  clickOn(resize);
  await settled();
  const resized = stairs().find((stair) => stair.id === straight.id);
  result.resizeIsContinuous = !!beforeResize && !!resized
    && (!closeTo(beforeResize.length, resized.length) || !closeTo(beforeResize.width, resized.width));
  result.resizeUnderStairsToolAddsNoStair = stairs().length === stairsBeforeResize
    && !!root().querySelector('.hp-stair.selected');
  result.cornerResizeKeepsAngle = !!resized && closeTo(resized.angle, beforeResize.angle, 1e-9);
  const side = handleAt(5); // (1, 0) side
  const sidePoint = handlePoint(side);
  pointer(side, 'pointerdown', sidePoint, 6645);
  pointer(stage(), 'pointermove', [sidePoint[0] + 30, sidePoint[1] + 6], 6645);
  pointer(stage(), 'pointerup', [sidePoint[0] + 30, sidePoint[1] + 6], 6645);
  clickOn(side);
  await settled();
  const sideResized = stairs().find((stair) => stair.id === straight.id);
  result.sideResizeMovesOneDimension = !!sideResized && sideResized.length > resized.length
    && closeTo(sideResized.width, resized.width, 1e-9)
    && closeTo(sideResized.angle, resized.angle, 1e-9);
  const rotate = frame()?.querySelector('.hp-stair-rotate');
  const rotatePoint = handlePoint(rotate);
  pointer(rotate, 'pointerdown', rotatePoint, 6633);
  pointer(stage(), 'pointermove', [rotatePoint[0] + 47, rotatePoint[1] + 19], 6633, { shiftKey: true });
  pointer(stage(), 'pointerup', [rotatePoint[0] + 47, rotatePoint[1] + 19], 6633, { shiftKey: true });
  clickOn(rotate);
  await settled();
  const rotated = stairs().find((stair) => stair.id === straight.id);
  result.shiftRotationSnaps45 = !!rotated && closeTo(rotated.angle / 45, Math.round(rotated.angle / 45));
  result.rotateUnderStairsToolAddsNoStair = stairs().length === stairsBeforeResize;

  // Cursors follow the world bearing of each handle (#676 AC4): the stair is
  // now rotated by 45°, so a side handle points diagonally and a corner
  // handle points along an axis; the rotation handle keeps the circular cursor.
  const cursorOf = (node) => getComputedStyle(node).cursor;
  const sideCursor = cursorOf(handleAt(5));
  const cornerCursor = cursorOf(handleAt(2));
  result.cursorsFollowHandleBearing = rotated.angle % 90 === 45
    ? /nwse-resize|nesw-resize/.test(sideCursor) && /ns-resize|ew-resize/.test(cornerCursor)
    : /ns-resize|ew-resize/.test(sideCursor) && /nwse-resize|nesw-resize/.test(cornerCursor);
  result.rotationHandleHasCircularCursor = /url\(/.test(cursorOf(frame().querySelector('.hp-stair-rotate')));

  // The frame paints above wall bodies and its hit radius is constant on screen (#676 AC7).
  const wallBodies = root().querySelector('.wallbodies');
  result.frameAboveWallBodies = !!wallBodies && !!frame()
    && !!(wallBodies.compareDocumentPosition(frame()) & Node.DOCUMENT_POSITION_FOLLOWING);
  const screenRadius = () => {
    const ctm = planSvg().getScreenCTM();
    return Number(handleAt(0)?.getAttribute('r')) * Math.hypot(ctm.a, ctm.b);
  };
  const radiusAtOne = screenRadius();
  root().querySelector('[data-hp="zoom-in"]')?.click();
  root().querySelector('[data-hp="zoom-in"]')?.click();
  await settleCamera();
  const radiusZoomed = screenRadius();
  root().querySelector('[data-hp="zoom-fit"]')?.click();
  await settleCamera();
  result.handleRadiusConstantOnScreen = radiusAtOne > 0
    && Math.abs(radiusAtOne - radiusZoomed) <= 1;

  // Under «Select» a handle gesture keeps the selection (#676 AC6).
  await hp.setTool('select');
  await selectStair(straight.id);
  const selectHandle = handleAt(6);
  const selectPoint = handlePoint(selectHandle);
  pointer(selectHandle, 'pointerdown', selectPoint, 6646);
  pointer(stage(), 'pointermove', [selectPoint[0] + 10, selectPoint[1] + 12], 6646);
  pointer(stage(), 'pointerup', [selectPoint[0] + 10, selectPoint[1] + 12], 6646);
  clickOn(selectHandle);
  await settled();
  result.resizeUnderSelectKeepsSelection = !!root().querySelector('.hp-stair.selected') && !!frame();

  // Under «Walls» the frame is gone and a former handle position is plain
  // canvas (#676 AC12); back under «Select» the frame returns.
  const formerHandle = handlePoint(handleAt(6));
  await hp.setTool('draw');
  result.frameGoneUnderWallsTool = !frame();
  const pathBefore = card._path.length;
  await clickPlan(formerHandle);
  result.wallsToolClickIsAWallPoint = card._path.length === pathBefore + 1;
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await settled();
  await hp.setTool('select');
  await selectStair(straight.id);
  result.frameReturnsUnderSelect = !!frame();
  await hp.setTool('stairs');

  // Saving the properties dialog untouched changes nothing (#676 AC5):
  // sizes above one metre survive and no history entry is written.
  const untouched = JSON.stringify(stairs().find((stair) => stair.id === straight.id));
  const historyBefore = card._geometryHistory.size;
  let dialog = await openStairDialog(straight.id);
  const fieldsShown = [...dialog.querySelectorAll('input[type="number"]')].map((input) => input.value);
  await saveDialog(dialog);
  result.untouchedDialogSaveKeepsSizes = JSON.stringify(stairs().find((stair) => stair.id === straight.id)) === untouched
    && Number(fieldsShown[0]) > 100;
  result.untouchedDialogSaveWritesNoHistory = card._geometryHistory.size === historyBefore;

  // Properties switch kind without changing identity, then switch it back and link Garden.
  dialog = await openStairDialog(straight.id);
  const selects = dialog ? [...dialog.querySelectorAll('select')] : [];
  if (selects[0]) setDialogSelect(selects[0], 'spiral');
  await saveDialog(dialog);
  const converted = stairs().find((stair) => stair.id === straight.id);
  dialog = await openStairDialog(straight.id);
  const restoredSelects = dialog ? [...dialog.querySelectorAll('select')] : [];
  if (restoredSelects[0]) setDialogSelect(restoredSelects[0], 'straight');
  if (restoredSelects[1]) setDialogSelect(restoredSelects[1], 'garden');
  await saveDialog(dialog);
  const linked = stairs().find((stair) => stair.id === straight.id);
  result.kindSwitchKeepsIdentityAndLink = converted?.kind === 'spiral'
    && linked?.kind === 'straight' && linked.target_space_id === 'garden';

  await hp.setMode('view');
  let linkedNode = stairNode(straight.id);
  result.validLinkIsAccessible = linkedNode?.getAttribute('role') === 'link'
    && linkedNode?.getAttribute('data-target-state') === 'active';

  // Hover on a link announces the target floor; every other target state
  // stays silent (#676 AC8). The mouse pointer type enables hover.
  const hoverCenter = [linked.x * 1000, linked.y * 1000];
  const hoverTip = async (node, expectTip) => {
    card._tip = null;
    pointer(node, 'pointermove', hoverCenter, 6660);
    await settled();
    const shown = card._tip?.title ?? null;
    node?.dispatchEvent(new PointerEvent('pointerleave', { pointerId: 6660, pointerType: 'mouse' }));
    await settled();
    return expectTip ? shown === expectTip && card._tip === null : shown === null;
  };
  result.activeLinkHoverShowsTargetFloor = await hoverTip(linkedNode, 'Go to floor Garden');
  const withTarget = async (target) => {
    await hp.setServerConfig((config) => {
      config.spaces.find((space) => space.id === 'f1').stairs
        .find((stair) => stair.id === linked.id).target_space_id = target;
      return config;
    });
    await hp.switchSpace('f1');
    return stairNode(linked.id);
  };
  result.missingTargetHoverIsSilent = await hoverTip(await withTarget(null), null)
    && stairNode(linked.id)?.getAttribute('data-target-state') === 'missing';
  result.selfTargetHoverIsSilent = await hoverTip(await withTarget('f1'), null)
    && stairNode(linked.id)?.getAttribute('data-target-state') === 'self';
  result.deletedTargetHoverIsSilent = await hoverTip(await withTarget('no-such-space'), null)
    && stairNode(linked.id)?.getAttribute('data-target-state') === 'deleted';
  await withTarget('garden');
  card.setConfig({ type: 'custom:houseplan-card', title: 'House Plan', icon_size: 3.4, floor: 'f1' });
  await settled();
  result.fixedFloorHoverIsSilent = await hoverTip(stairNode(linked.id), null)
    && stairNode(linked.id)?.getAttribute('data-target-state') === 'fixed';
  card.setConfig({ type: 'custom:houseplan-card', title: 'House Plan', icon_size: 3.4 });
  await settled();
  await hp.switchSpace('f1');
  await hp.setMode('view');
  linkedNode = stairNode(straight.id);

  // A pan ending on the stair owns its compatibility click and cannot navigate.
  const linkedCenter = [linked.x * 1000, linked.y * 1000];
  pointer(linkedNode, 'pointerdown', linkedCenter, 6634, { pointerType: 'touch' });
  pointer(stage(), 'pointermove', [linkedCenter[0] + 60, linkedCenter[1] + 20], 6634, { pointerType: 'touch' });
  pointer(stage(), 'pointerup', [linkedCenter[0] + 60, linkedCenter[1] + 20], 6634, { pointerType: 'touch' });
  linkedNode?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));
  result.panClickSuppressed = activeSpace() === 'f1';
  await new Promise((resolve) => setTimeout(resolve, 0));
  pointer(linkedNode, 'pointerdown', linkedCenter, 6635, { pointerType: 'touch' });
  pointer(stage(), 'pointermove', [linkedCenter[0] + 35, linkedCenter[1] + 45], 6635, { pointerType: 'touch' });
  pointer(stage(), 'pointercancel', [linkedCenter[0] + 35, linkedCenter[1] + 45], 6635, { pointerType: 'touch' });
  linkedNode?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));
  result.pointerCancelClickSuppressed = activeSpace() === 'f1';
  await new Promise((resolve) => setTimeout(resolve, 0));

  // Cancellation without any movement must also disarm the compatibility
  // click; it cannot rely on the pan path having set _suppressClick.
  pointer(stairNode(straight.id)?.querySelector('.hp-stair-hit'),
    'pointerdown', linkedCenter, 6642, { pointerType: 'touch' });
  pointer(stage(), 'pointercancel', linkedCenter, 6642, { pointerType: 'touch' });
  stairNode(straight.id)?.querySelector('.hp-stair-hit')?.dispatchEvent(
    new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }),
  );
  result.cancelledTapClickSuppressed = activeSpace() === 'f1';

  // A motionless long press is still a gesture, not a floor-link activation.
  pointer(stairNode(straight.id)?.querySelector('.hp-stair-hit'),
    'pointerdown', linkedCenter, 6636, { pointerType: 'touch' });
  await new Promise((resolve) => setTimeout(resolve, 650));
  pointer(stage(), 'pointerup', linkedCenter, 6636, { pointerType: 'touch' });
  stairNode(straight.id)?.dispatchEvent(new MouseEvent('click', {
    bubbles: true, composed: true, cancelable: true,
  }));
  result.longPressClickSuppressed = activeSpace() === 'f1';
  await new Promise((resolve) => setTimeout(resolve, 0));

  // The shared multi-touch barrier owns delayed compatibility clicks even
  // when the first finger started on this interactive child.
  pointer(stairNode(straight.id)?.querySelector('.hp-stair-hit'),
    'pointerdown', linkedCenter, 6637, { pointerType: 'touch' });
  pointer(stage(), 'pointerdown', [linkedCenter[0] + 80, linkedCenter[1] + 30], 6638, {
    pointerType: 'touch', isPrimary: false,
  });
  pointer(stage(), 'pointermove', [linkedCenter[0] + 110, linkedCenter[1] + 45], 6638, {
    pointerType: 'touch', isPrimary: false,
  });
  pointer(stage(), 'pointerup', [linkedCenter[0] + 110, linkedCenter[1] + 45], 6638, {
    pointerType: 'touch', isPrimary: false,
  });
  pointer(stage(), 'pointerup', linkedCenter, 6637, { pointerType: 'touch' });
  stairNode(straight.id)?.dispatchEvent(new MouseEvent('click', {
    bubbles: true, composed: true, cancelable: true,
  }));
  result.pinchClickSuppressed = activeSpace() === 'f1';
  // A new pointer sequence is the shared guard's explicit re-arm signal.
  pointer(stage(), 'pointerdown', [40, 40], 6640);
  pointer(stage(), 'pointerup', [40, 40], 6640);

  // Store a user view on Garden through public controls, return, then navigate by stair.
  await hp.switchSpace('garden');
  root().querySelector('[data-hp="zoom-in"]')?.click();
  await settleCamera();
  const remembered = planSvg().getAttribute('viewBox');
  await hp.switchSpace('f1');
  const cleanNode = stairNode(straight.id);
  pointer(cleanNode?.querySelector('.hp-stair-hit'), 'pointerdown', linkedCenter, 6639);
  pointer(stage(), 'pointerup', linkedCenter, 6639);
  cleanNode?.querySelector('.hp-stair-hit')?.dispatchEvent(new MouseEvent('click', {
    bubbles: true, composed: true, cancelable: true,
  }));
  await settleCamera();
  result.cleanClickNavigatesAndRestoresView = activeSpace() === 'garden'
    && planSvg().getAttribute('viewBox') === remembered;
  result.targetFloorGetsNoAutomaticStair = !root().querySelector('[data-hp="stair"]')
    && stairs('garden').length === 0;

  // The circular variant uses the same real hit surface and navigation path.
  await hp.setServerConfig((config) => {
    config.spaces.find((space) => space.id === 'f1').stairs
      .find((stair) => stair.id === spiral.id).target_space_id = 'garden';
    return config;
  });
  await hp.switchSpace('f1');
  const spiralNode = stairNode(spiral.id);
  const spiralCenter = [spiral.x * 1000, spiral.y * 1000];
  pointer(spiralNode?.querySelector('.hp-stair-hit'), 'pointerdown', spiralCenter, 6641);
  pointer(stage(), 'pointerup', spiralCenter, 6641);
  spiralNode?.querySelector('.hp-stair-hit')?.dispatchEvent(new MouseEvent('click', {
    bubbles: true, composed: true, cancelable: true,
  }));
  await settleCamera();
  result.spiralCleanClickNavigates = activeSpace() === 'garden';

  // Missing/self/deleted targets remain visible, repairable and inert.
  await hp.setServerConfig((config) => {
    const source = config.spaces.find((space) => space.id === 'f1');
    source.stairs.find((stair) => stair.id === linked.id).target_space_id = null;
    return config;
  });
  await hp.switchSpace('f1');
  let broken = stairNode(straight.id);
  broken?.querySelector('.hp-stair-hit')?.dispatchEvent(
    new MouseEvent('click', { bubbles: true, composed: true }),
  );
  result.missingTargetIsVisibleAndInert = activeSpace() === 'f1'
    && broken?.getAttribute('data-target-state') === 'missing'
    && broken?.getAttribute('role') === 'img';
  await hp.setServerConfig((config) => {
    config.spaces.find((space) => space.id === 'f1').stairs
      .find((stair) => stair.id === linked.id).target_space_id = 'f1';
    return config;
  });
  broken = stairNode(straight.id);
  broken?.querySelector('.hp-stair-hit')?.dispatchEvent(
    new MouseEvent('click', { bubbles: true, composed: true }),
  );
  result.selfTargetIsVisibleAndInert = activeSpace() === 'f1'
    && broken?.getAttribute('data-target-state') === 'self'
    && broken?.getAttribute('role') === 'img';
  await hp.setServerConfig((config) => {
    config.spaces.find((space) => space.id === 'f1').stairs
      .find((stair) => stair.id === linked.id).target_space_id = '__deleted__';
    return config;
  });
  broken = stairNode(straight.id);
  broken?.querySelector('.hp-stair-hit')?.dispatchEvent(
    new MouseEvent('click', { bubbles: true, composed: true }),
  );
  await settled();
  result.deletedTargetIsVisibleAndInert = activeSpace() === 'f1'
    && broken?.getAttribute('data-target-state') === 'deleted'
    && broken?.getAttribute('role') === 'img';
  await hp.setMode('plan');
  dialog = await openStairDialog(straight.id);
  result.brokenTargetHasRepairWarning = !!dialog?.querySelector('.hint.warn')
    && [...dialog.querySelectorAll('option')].every((option) => option.value !== '__deleted__');
  await hp.close(dialog, { via: 'cancel' });
  result.dialogCancelCloses = !root().querySelector('[data-hp="dialog"][data-kind="stairs"]');

  // A fixed-floor card keeps the same object visible but never presents a link.
  card.setConfig({ type: 'custom:houseplan-card', title: 'House Plan', icon_size: 3.4, floor: 'f1' });
  await settled();
  await hp.setMode('view');
  const fixed = stairNode(straight.id);
  fixed?.querySelector('.hp-stair-hit')?.dispatchEvent(
    new MouseEvent('click', { bubbles: true, composed: true }),
  );
  await settled();
  result.fixedFloorIsVisibleAndInert = activeSpace() === 'f1'
    && fixed?.getAttribute('data-target-state') === 'fixed'
    && fixed?.getAttribute('role') === 'img';

  // Restore a valid link and prove that the same flat symbol/hit target is
  // projected with the floor in 2.5D and still performs its View action.
  card.setConfig({ type: 'custom:houseplan-card', title: 'House Plan', icon_size: 3.4 });
  await hp.setServerConfig((config) => {
    const source = config.spaces.find((space) => space.id === 'f1');
    source.stairs.find((stair) => stair.id === linked.id).target_space_id = 'garden';
    return config;
  });
  await hp.switchSpace('f1');
  await hp.setVolumetricView(true);
  const isoStair = stairNode(straight.id);
  result.flatIsoSymbolSharesFloorProjection = stage().classList.contains('projection-iso')
    && !!isoStair?.closest('.iso-floor-scene')
    && !!isoStair?.querySelector('.hp-stair-hit');
  isoStair?.querySelector('.hp-stair-hit')?.dispatchEvent(
    new MouseEvent('click', { bubbles: true, composed: true }),
  );
  await settled();
  result.isoHitTargetNavigates = activeSpace() === 'garden';

  return result;
});

checkAll(out);
await finish(browser, out);
