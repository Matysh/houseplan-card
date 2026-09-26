// #663: straight and spiral stairs are plan-editor objects, clean View links
// between spaces, and flat floor content in 2.5D. Exercise only public DOM
// hooks and the harness facade for writes; card internals are read-only oracles.
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
  const result = {};

  await hp.setServerConfig((config) => {
    for (const space of config.spaces) delete space.stairs;
    const first = config.spaces.find((space) => space.id === 'f1');
    // Keep the scale explicit: this witness must prove a 20 cm physical face,
    // not inherit whichever default a fixture migration happens to exercise.
    first.cell_cm = 5;
    first.partitions = [...(first.partitions || []), {
      id: 'stair-smoke-wall', a: [0.15, 0.60], b: [0.85, 0.60], cm: 20,
    }];
    return config;
  });
  await hp.switchSpace('f1');
  await hp.setMode('plan');

  result.straightToolExists = await chooseStair('straight');
  // 625 is within the wall magnet's reach but is not itself the flush centre
  // (658.33...). The previous 650 accidentally passed even without a snap.
  await clickPlan([400, 625]);
  const straight = stairs().find((stair) => stair.kind === 'straight');
  result.straightCreatedOnlyOnCurrentFloor = !!straight && stairs('garden').length === 0;
  result.wallMagnetUsesPhysicalFace = !!straight
    && closeTo(Math.abs(straight.y * 1000 - 600), straight.width * 500 + (20 / 5) * (1000 / 240) / 2, 2)
    && closeTo(((straight.angle % 180) + 180) % 180, 0);

  result.spiralToolExists = await chooseStair('spiral');
  await clickPlan([580, 650]);
  const spiral = stairs().find((stair) => stair.kind === 'spiral');
  result.spiralCreated = !!spiral && stairs().length === 2;
  result.stairMagnetTouchesOtherFootprint = !!straight && !!spiral
    && closeTo(Math.abs(spiral.x - straight.x) * 1000,
      (straight.length / 2 + spiral.radius) * 1000, 0.5);
  result.renderedTypesAndDirections = !!root().querySelector(
    '[data-hp="stair"][data-kind="straight"] .hp-stair-arrow',
  ) && !!root().querySelector('[data-hp="stair"][data-kind="spiral"] .hp-stair-arrow');

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

  // Resize and Shift-rotate through the visible handles.
  stairNode(straight.id)?.querySelector('.hp-stair-hit')?.dispatchEvent(
    new MouseEvent('click', { bubbles: true, composed: true }),
  );
  await settled();
  const beforeResize = stairs().find((stair) => stair.id === straight.id);
  const resize = stairNode(straight.id)?.querySelector('.hp-stair-resize');
  const resizePoint = [Number(resize?.getAttribute('cx')), Number(resize?.getAttribute('cy'))];
  pointer(resize, 'pointerdown', resizePoint, 6632);
  pointer(stage(), 'pointermove', [resizePoint[0] - 35, resizePoint[1] - 25], 6632);
  pointer(stage(), 'pointerup', [resizePoint[0] - 35, resizePoint[1] - 25], 6632);
  await settled();
  const resized = stairs().find((stair) => stair.id === straight.id);
  result.resizeIsContinuous = !!beforeResize && !!resized
    && (!closeTo(beforeResize.length, resized.length) || !closeTo(beforeResize.width, resized.width));
  const rotate = stairNode(straight.id)?.querySelector('.hp-stair-rotate');
  const rotatePoint = [Number(rotate?.getAttribute('cx')), Number(rotate?.getAttribute('cy'))];
  pointer(rotate, 'pointerdown', rotatePoint, 6633);
  pointer(stage(), 'pointermove', [rotatePoint[0] + 47, rotatePoint[1] + 19], 6633, { shiftKey: true });
  pointer(stage(), 'pointerup', [rotatePoint[0] + 47, rotatePoint[1] + 19], 6633, { shiftKey: true });
  await settled();
  const rotated = stairs().find((stair) => stair.id === straight.id);
  result.shiftRotationSnaps45 = !!rotated && closeTo(rotated.angle / 45, Math.round(rotated.angle / 45));

  // Properties switch kind without changing identity, then switch it back and link Garden.
  let dialog = await openStairDialog(straight.id);
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
  const linkedNode = stairNode(straight.id);
  result.validLinkIsAccessible = linkedNode?.getAttribute('role') === 'link'
    && linkedNode?.getAttribute('data-target-state') === 'active';

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
