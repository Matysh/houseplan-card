// Unified Opening tool (#75/#76): the toolbar launcher opens the shared
// secondary tray, a type preset arms placement, and the hover preview is the
// real architectural symbol painted above the wall body. Tests are authored
// here but run only as part of the release gate.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch();
await page.evaluate(() => {
  window.__card._setMode('plan');
  return window.__card.updateComplete;
});
await page.waitForTimeout(240);
await page.evaluate(() => new Promise((resolve) =>
  requestAnimationFrame(() => requestAnimationFrame(resolve))));

const res = await page.evaluate(async () => {
  const out = {};
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const settle = async () => {
    card.requestUpdate();
    await card.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  };
  const visibleGeometrySignature = (container) => (container
    ? [container, ...container.querySelectorAll('g, line, path, rect')]
    : []).map((element) => ({
    tag: element.tagName,
    cls: element.getAttribute('class') || '',
    geometry: [
      'transform', 'd', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height',
      'stroke-dasharray', 'stroke-dashoffset', 'style',
    ]
      .map((name) => `${name}=${element.getAttribute(name) || ''}`).join('|'),
  }));
  const launcher = () => root().querySelector('[data-editor-group="opening"]');
  const choose = async (type) => {
    launcher().click();
    await settle();
    const item = root().querySelector(`[data-group-item="${type}"]`);
    item?.click();
    await settle();
    return !!item;
  };

  out.oneLauncher = root().querySelectorAll('[data-editor-group="opening"]').length === 1;
  out.oneSecondaryHost = root().querySelectorAll('.editor-secondary-host').length === 1;
  out.launcherDoesNotArm = card._tool !== 'opening' && card._openingPreset == null;
  const stageHeightBeforeMenu = root().querySelector('.stage').getBoundingClientRect().height;
  const geometryBeforeMenu = JSON.stringify(card._curSpaceCfg.openings || []);
  const epochBeforeMenu = card._cfgEpoch;
  launcher().click();
  await settle();
  out.menuHasThreeTypes = root().querySelectorAll('.editor-group-item').length === 3;
  out.launcherStillDoesNotArm = card._tool !== 'opening' && card._openingPreset == null;
  out.menuDoesNotResizeStage = Math.abs(
    root().querySelector('.stage').getBoundingClientRect().height - stageHeightBeforeMenu,
  ) < 1;
  card._editorSecondary.closeGroup(false);
  await settle();

  out.windowChoice = await choose('window');
  out.windowDefault = card._tool === 'opening'
    && card._openingPreset?.type === 'window' && card._openingPreset?.lengthCm === 120;
  out.doorChoice = await choose('door');
  out.doorDefault = card._openingPreset?.type === 'door' && card._openingPreset?.lengthCm === 90;
  out.launcherReflectsActivePreset = launcher()?.getAttribute('aria-pressed') === 'true';
  out.gateChoice = await choose('gate');
  out.gateDefault = card._openingPreset?.type === 'gate' && card._openingPreset?.lengthCm === 300;

  // Return to Door for geometry assertions.
  await choose('door');
  const room = card._spaceModel().rooms.find((item) => item.id === 'r1')
    || card._spaceModel().rooms[0];
  const poly = room.poly || [
    [room.x, room.y], [room.x + room.w, room.y],
    [room.x + room.w, room.y + room.h], [room.x, room.y + room.h],
  ];
  const wallMid = [(poly[0][0] + poly[1][0]) / 2, (poly[0][1] + poly[1][1]) / 2];

  await choose('window');
  card._cursorPt = wallMid;
  await settle();
  const windowPreview = root().querySelector('.opening-preview[data-kind="window"]');
  out.windowPreviewGeometry = windowPreview?.querySelectorAll('.op-leaf').length === 2
    && windowPreview?.querySelectorAll('.op-arc').length === 2;
  await choose('gate');
  card._cursorPt = wallMid;
  await settle();
  const gatePreview = root().querySelector('.opening-preview[data-kind="gate"]');
  out.gatePreviewGeometry = gatePreview?.querySelectorAll('.op-leaf').length === 2
    && gatePreview?.querySelectorAll('.op-arc').length === 0;
  await choose('door');
  const axisCandidate = card._resolveOpeningPlacement(wallMid);
  const target = axisCandidate?.target;
  const dx = target ? target.b[0] - target.a[0] : 1;
  const dy = target ? target.b[1] - target.a[1] : 0;
  const length = Math.hypot(dx, dy) || 1;
  const bodyOffset = (target?.physicalHalfWidth || 0) * 0.8;
  card._cursorPt = [wallMid[0] - (dy / length) * bodyOffset,
    wallMid[1] + (dx / length) * bodyOffset];
  await settle();

  const preview = root().querySelector('.opening-preview');
  const previewGeometry = visibleGeometrySignature(preview?.querySelector(':scope > g'));
  out.previewExists = !!preview;
  out.previewIsDoor = preview?.getAttribute('data-kind') === 'door';
  out.previewHasFullSymbol = !!preview?.querySelector('.op-arc')
    && !!preview?.querySelector('.op-leaf');
  out.previewHalfTransparent = preview
    ? Math.abs(Number.parseFloat(getComputedStyle(preview).opacity) - 0.5) < 0.001 : false;
  out.previewPointerInert = preview?.getAttribute('pointer-events') === 'none';
  out.previewAriaHidden = preview?.getAttribute('aria-hidden') === 'true';
  out.previewHasNoPersistentIdentity = !preview?.hasAttribute('data-id')
    && !preview?.hasAttribute('data-hp');
  out.typeChoicesDoNotMutateGeometry = card._cfgEpoch === epochBeforeMenu
    && JSON.stringify(card._curSpaceCfg.openings || []) === geometryBeforeMenu;
  const wallBody = root().querySelector('.wallbody');
  out.previewPaintedAfterWall = !wallBody || (!!preview
    && !!(wallBody.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING));

  // A click is authoritative and does not require a preceding hover event.
  const expectedClick = card._resolveOpeningPlacement(wallMid);
  const openingIdsBeforeSave = new Set((card._curSpaceCfg.openings || []).map((item) => item.id));
  card._cursorPt = null;
  card._openingHoverCandidate = null;
  card._openingClick(wallMid);
  await settle();
  out.clickWithoutHoverOpensDialog = card._openingDialog?.type === 'door'
    && card._openingDialog?.lengthCm === 90;
  out.clickDialogMatchesResolver = !!expectedClick && !!card._openingDialog
    && Math.abs(card._openingDialog.x - expectedClick.x) < 1e-6
    && Math.abs(card._openingDialog.y - expectedClick.y) < 1e-6
    && Math.abs(card._openingDialog.angle - expectedClick.angle) < 1e-6
    && card._openingDialog.flipH === expectedClick.flipH
    && card._openingDialog.flipV === expectedClick.flipV;
  out.previewGoneWhileDialogOpen = !root().querySelector('.opening-preview');

  // Save writes exactly that candidate and keeps the serial-placement preset.
  card._saveOpening();
  await settle();
  const saved = (card._curSpaceCfg.openings || []).find((item) => !openingIdsBeforeSave.has(item.id));
  out.saveMatchesResolver = !!saved && !!expectedClick
    && saved.type === expectedClick.type
    && Math.abs(saved.x * 1000 - expectedClick.x) < 1e-6
    && Math.abs(saved.y * card._spaceH - expectedClick.y) < 1e-6
    && Math.abs(saved.angle - expectedClick.angle) < 1e-6
    && Math.abs(saved.length * 1000 - expectedClick.renderedLength) < 1e-6
    && !!saved.flip_h === expectedClick.flipH
    && !!saved.flip_v === expectedClick.flipV;
  const committed = saved
    ? root().querySelector(`.opening[data-id="${saved.id}"] > g`)
    : null;
  out.previewAndCommittedShareVisibleGeometry = !!committed
    && JSON.stringify(visibleGeometrySignature(committed)) === JSON.stringify(previewGeometry);
  out.saveKeepsPreset = card._tool === 'opening' && card._openingPreset?.type === 'door';
  const savedRender = saved && card._openingsR.find((item) => item.id === saved.id);
  const savedCenter = savedRender ? [savedRender.rx, savedRender.ry] : wallMid;
  const savedRad = savedRender ? savedRender.angle * Math.PI / 180 : 0;
  const farNormal = savedRender ? Math.max(40, savedRender.rlen * 0.45) : 40;
  const radialLeakPoint = [
    savedCenter[0] - Math.sin(savedRad) * farNormal,
    savedCenter[1] + Math.cos(savedRad) * farNormal,
  ];
  out.existingOpeningHitBoxIsBounded = !!savedRender
    && card._openingAt(savedCenter)?.id === saved.id
    && card._openingAt(radialLeakPoint) == null;
  card._cursorPt = savedCenter;
  await settle();
  out.noPreviewOverExisting = !root().querySelector('.opening-preview');

  const emptyWallMid = poly.map((point, index) => {
    const next = poly[(index + 1) % poly.length];
    return [(point[0] + next[0]) / 2, (point[1] + next[1]) / 2];
  }).find((point) => !card._openingAt(point) && card._resolveOpeningPlacement(point));

  // Cancel of a new, unsaved opening keeps the selected session preset too.
  if (emptyWallMid) card._openingClick(emptyWallMid);
  await settle();
  out.cancelCreateDialogOpened = !!emptyWallMid
    && !card._openingDialog?.id && card._openingDialog?.type === 'door';
  card._openingDialog = null;
  await settle();
  out.cancelKeepsPreset = card._tool === 'opening' && card._openingPreset?.type === 'door';

  // A viewport transform invalidates the pointer-to-plan projection. The old
  // world-space preview must disappear until a fresh pointer move arrives.
  card._cursorPt = emptyWallMid || card._roomCenter(room);
  await settle();
  out.previewBeforeZoom = !!root().querySelector('.opening-preview');
  card._stepZoom(1);
  await settle();
  out.zoomClearsStalePreview = !root().querySelector('.opening-preview')
    && card._openingPreset?.type === 'door';
  card._cursorPt = card._roomCenter(room);
  await settle();
  out.noPreviewAwayFromWalls = !root().querySelector('.opening-preview');
  card._cancelPath();
  card._tool = 'draw';
  await settle();
  out.leavingToolClearsPreset = card._openingPreset == null
    && !root().querySelector('.opening-preview')
    && launcher()?.getAttribute('aria-pressed') === 'false';

  return out;
});

checkAll(res);
await finish(browser, res);
