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
  out.menuHasFourTypes = root().querySelectorAll('.editor-group-item').length === 4;
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
  out.passageChoice = await choose('passage');
  out.passageDefault = card._openingPreset?.type === 'passage'
    && card._openingPreset?.lengthCm === 90;
  out.launcherReflectsActivePreset = launcher()?.getAttribute('aria-pressed') === 'true';
  out.gateChoice = await choose('gate');
  out.gateDefault = card._openingPreset?.type === 'gate' && card._openingPreset?.lengthCm === 300;

  // Return to Door for geometry assertions.
  await choose('door');
  out.typeChoicesDoNotMutateGeometry = card._cfgEpoch === epochBeforeMenu
    && JSON.stringify(card._curSpaceCfg.openings || []) === geometryBeforeMenu;
  // The tracked demo document predates explicit wall identity. Give the room
  // under test real 15 cm carriers: #306 deliberately forbids placing an
  // opening on a bodyless cm:0 wall.
  const storedRoom = card._curSpaceCfg.rooms.find((item) => item.id === 'r1')
    || card._curSpaceCfg.rooms[0];
  const storedPoly = storedRoom.poly || [
    [storedRoom.x, storedRoom.y], [storedRoom.x + storedRoom.w, storedRoom.y],
    [storedRoom.x + storedRoom.w, storedRoom.y + storedRoom.h],
    [storedRoom.x, storedRoom.y + storedRoom.h],
  ];
  const wallKey = (a, b) => {
    const pitch = 1 / 240;
    const q = (value) => Math.round(value / pitch) * pitch;
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const length = Math.hypot(dx, dy) || 1;
    dx /= length; dy /= length;
    if (dx < -1e-12 || (Math.abs(dx) <= 1e-12 && dy < 0)) { dx = -dx; dy = -dy; }
    let angle = Math.atan2(dy, dx);
    if (angle < 0) angle += Math.PI;
    angle = Math.round(angle * 1800) / 1800;
    return `${q((a[0] + b[0]) / 2).toFixed(6)},${q((a[1] + b[1]) / 2).toFixed(6)}@${angle.toFixed(4)}`;
  };
  card._curSpaceCfg.walls = storedPoly.map((a, index) => {
    const b = storedPoly[(index + 1) % storedPoly.length];
    return { key: wallKey(a, b), cm: 15, a: [...a], b: [...b] };
  });
  card._cfgEpoch++;
  await settle();
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
  await choose('passage');
  card._cursorPt = wallMid;
  await settle();
  const passagePreview = root().querySelector('.opening-preview[data-kind="passage"]');
  const passageCandidate = card._resolveOpeningPlacement(wallMid);
  const passageCut = passagePreview?.querySelector('.passage-preview-cut');
  const passageBoundaries = [...(passagePreview?.querySelectorAll('.passage-preview-boundary') || [])];
  const passageHalfLength = (passageCandidate?.renderedLength || 0) / 2;
  const passageHalfDepth = passageCandidate?.target?.physicalHalfWidth || 0;
  const passageBoundaryHalf = passageHalfDepth + card._gridPitch * 0.18;
  const near = (value, expected) => Math.abs(Number.parseFloat(value) - expected) < 1e-6;
  out.passagePreviewGeometry = !!passagePreview && !!passageCandidate && !!passageCut
    && passageBoundaries.length === 2
    && near(passageCut.getAttribute('x'), -passageHalfLength)
    && near(passageCut.getAttribute('y'), -passageHalfDepth)
    && near(passageCut.getAttribute('width'), passageCandidate.renderedLength)
    && near(passageCut.getAttribute('height'), passageHalfDepth * 2)
    && passageBoundaries.every((boundary, index) => {
      const x = index === 0 ? -passageHalfLength : passageHalfLength;
      return near(boundary.getAttribute('x1'), x) && near(boundary.getAttribute('x2'), x)
        && near(boundary.getAttribute('y1'), -passageBoundaryHalf)
        && near(boundary.getAttribute('y2'), passageBoundaryHalf);
    });
  const wallFill = root().querySelector('.wallbody-fill');
  const passageDot = root().querySelector('.opening-preview-dot');
  const passagePreviewStyle = passagePreview ? getComputedStyle(passagePreview) : null;
  const passageCutStyle = passageCut ? getComputedStyle(passageCut) : null;
  const wallFillStyle = wallFill ? getComputedStyle(wallFill) : null;
  const passageDotStyle = passageDot ? getComputedStyle(passageDot) : null;
  const inheritedWallFill = passageCutStyle?.getPropertyValue('--wall-fill').trim() || '';
  out._passagePreviewThemeDiagnostics = {
    opacity: passagePreviewStyle?.opacity,
    fillOpacity: passageCutStyle?.fillOpacity,
    cutFill: passageCutStyle?.fill,
    wallFill: wallFillStyle?.fill,
    inheritedWallFill,
    configuredWallFill: card._fillColors.wall_fill.c,
    boundaryStrokes: passageBoundaries.map((boundary) => getComputedStyle(boundary).stroke),
    dotFill: passageDotStyle?.fill,
  };
  out.passagePreviewTheme = !!passagePreview && !!passageCut
    && Math.abs(Number.parseFloat(passagePreviewStyle.opacity) - 1) < 0.001
    && Math.abs(Number.parseFloat(passageCutStyle.fillOpacity) - 0.35) < 0.001
    && inheritedWallFill.toLowerCase() === card._fillColors.wall_fill.c.toLowerCase()
    && passageCutStyle.fill !== 'none'
    && passageBoundaries.every((boundary) => getComputedStyle(boundary).stroke
      === passageDotStyle.fill);
  out.passagePreviewInert = passagePreview?.getAttribute('aria-hidden') === 'true'
    && passagePreview?.getAttribute('pointer-events') === 'none'
    && passageCut?.getAttribute('pointer-events') === 'none'
    && passageBoundaries.every((boundary) => boundary.getAttribute('pointer-events') === 'none');
  out.passagePreviewKeepsRulers = root().querySelectorAll('.measurelabel.opshoulder').length === 2
    && !!root().querySelector('.opcentertick');
  out.passagePreviewHasNoCommittedSymbolParts = !!passagePreview
    && passagePreview.querySelectorAll('.op-leaf,.op-arc,.op-glass').length === 0;
  out.otherPreviewHasNoPassageGeometry = windowPreview
    ?.querySelectorAll('.passage-preview-cut,.passage-preview-boundary').length === 0;
  // Passage click and save use the same candidate, but the committed opening
  // keeps only the canonical masonry cut and never the transient overlay.
  const passageWallMid = [
    (poly[2][0] + poly[3][0]) / 2,
    (poly[2][1] + poly[3][1]) / 2,
  ];
  card._cursorPt = passageWallMid;
  await settle();
  const passageSaveCandidate = card._resolveOpeningPlacement(passageWallMid);
  const passageIdsBeforeSave = new Set((card._curSpaceCfg.openings || []).map((item) => item.id));
  card._openingClick(passageWallMid);
  await settle();
  out.passageDialogMatchesPreview = !!passageSaveCandidate && card._openingDialog?.type === 'passage'
    && near(card._openingDialog.x, passageSaveCandidate.x)
    && near(card._openingDialog.y, passageSaveCandidate.y)
    && near(card._openingDialog.angle, passageSaveCandidate.angle)
    && card._openingDialog.lengthCm === passageSaveCandidate.lengthCm
    && !root().querySelector('.opening-preview');
  card._saveOpening();
  await settle();
  const savedPassage = (card._curSpaceCfg.openings || [])
    .find((item) => !passageIdsBeforeSave.has(item.id));
  const committedPassage = savedPassage
    ? root().querySelector(`.opening[data-id="${savedPassage.id}"]`)
    : null;
  out.passageSaveMatchesCandidate = !!savedPassage && !!passageSaveCandidate
    && savedPassage.type === 'passage'
    && near(savedPassage.x * 1000, passageSaveCandidate.x)
    && near(savedPassage.y * card._spaceH, passageSaveCandidate.y)
    && near(savedPassage.angle, passageSaveCandidate.angle)
    && near(savedPassage.length * 1000, passageSaveCandidate.renderedLength);
  out.committedPassageHasNoPreviewSymbol = !!committedPassage
    && committedPassage.querySelectorAll(
      '.passage-preview-cut,.passage-preview-boundary,.op-leaf,.op-arc,.op-glass',
    ).length === 0;
  await choose('gate');
  card._cursorPt = wallMid;
  await settle();
  const gatePreview = root().querySelector('.opening-preview[data-kind="gate"]');
  out.gatePreviewGeometry = gatePreview?.querySelectorAll('.op-leaf').length === 2
    && gatePreview?.querySelectorAll('.op-arc').length === 0
    && gatePreview?.querySelectorAll('.passage-preview-cut,.passage-preview-boundary').length === 0;
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

  // #132: saved independent wall segments are first-class opening hosts.
  const bodyCentre = card._roomCenter(room);
  const bodyX = bodyCentre[0] / 1000;
  const bodyY = bodyCentre[1] / card._spaceH;
  card._curSpaceCfg.partitions = [{
    id: 'opening-smoke-partition', a: [bodyX - 0.05, bodyY], b: [bodyX + 0.05, bodyY], cm: 20,
  }];
  card._cfgEpoch++;
  card._openingPlacementIntervalsCache = null;
  card._cursorPt = bodyCentre;
  await settle();
  const partitionCandidate = card._resolveOpeningPlacement(bodyCentre);
  out.partitionIsOpeningTarget = !!root().querySelector('.opening-preview')
    && partitionCandidate?.host?.kind === 'partition'
    && partitionCandidate.host.id === 'opening-smoke-partition';
  card._curSpaceCfg.partitions = [];
  card._curSpaceCfg.wall_columns = [{
    id: 'opening-smoke-column', shape: 'square', cm: 30, center: [bodyX, bodyY], angle: 0,
  }];
  card._cfgEpoch++;
  card._openingPlacementIntervalsCache = null;
  await settle();
  out.columnIsNotOpeningTarget = !root().querySelector('.opening-preview')
    && card._resolveOpeningPlacement(bodyCentre) == null;
  card._cancelPath();
  card._tool = 'draw';
  await settle();
  out.leavingToolClearsPreset = card._openingPreset == null
    && !root().querySelector('.opening-preview')
    && launcher()?.getAttribute('aria-pressed') === 'false';

  return out;
});

if (!res.passagePreviewTheme)
  console.error('passagePreviewTheme diagnostics:', res._passagePreviewThemeDiagnostics);
delete res._passagePreviewThemeDiagnostics;
checkAll(res);
await finish(browser, res);
