/** Issues #132/#185/#186: hosted-opening lifecycle, continuity and jamb margin. */
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 960, height: 820 }, 1);

const out = await page.evaluate(async () => {
  const result = {};
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const update = async () => { card.requestUpdate(); await card.updateComplete; };
  const pointIn = (point, body) => {
    let inside = false;
    for (let i = 0, j = body.length - 1; i < body.length; j = i++) {
      const a = body[i], b = body[j];
      if (((a[1] > point[1]) !== (b[1] > point[1]))
          && point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / ((b[1] - a[1]) || 1e-12) + a[0])
        inside = !inside;
    }
    return inside;
  };

  card._serverCfg = {
    spaces: [{
      id: 'partition-openings', title: 'Partition openings', cell_cm: 5,
      view_box: [0, 0, 1, 1],
      rooms: [{
        id: 'room', name: 'Room', area: null,
        poly: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]],
      }],
      partitions: [{ id: 'host', a: [0.25, 0.5], b: [0.75, 0.5], cm: 15 }],
    }],
    markers: [], settings: {},
  };
  card._layout = {};
  card._space = 'partition-openings';
  card._modelCache = null;
  card._cfgEpoch++;
  let writes = 0;
  card._saveConfig = () => {
    writes++;
    card._cfgEpoch++;
    card._modelCache = null;
    card._physicalBodiesCache = null;
    card._planSnapGeometryCache = null;
    card.requestUpdate();
  };
  card._setMode('plan');
  card._activateOpeningPlacement('door');
  await update();

  const centre = [500, 500];
  const candidate = card._resolveOpeningPlacement(centre);
  result.partitionCandidateCarriesStableHost = candidate?.host?.kind === 'partition'
    && candidate.host.id === 'host' && Math.abs(candidate.host.t - 0.5) < 1e-9;
  card._openingClick(centre);
  card._saveOpening();
  await update();
  let space = card._curSpaceCfg;
  const saved = space.openings?.[0];
  result.saveMaterializesHostAndCompatibilityGeometry = saved?.host?.id === 'host'
    && Math.abs(saved.host.t - 0.5) < 1e-9
    && Math.abs(saved.x - 0.5) < 1e-9
    && Math.abs(saved.y - 0.5) < 1e-9
    && !!root().querySelector(`[data-hp="opening"][data-id="${saved.id}"]`);

  const endpointCandidate = card._resolveOpeningPlacement([250, 500]);
  const endpointJamb = endpointCandidate?.target?.physicalHalfWidth || 0;
  const endpointX = 250 + (endpointCandidate?.renderedLength || 0) / 2 + endpointJamb;
  result.placementClampsToHalfThicknessJamb = !!endpointCandidate
    && Math.abs(endpointCandidate.x - endpointX) < 1e-6
    && Math.abs(endpointCandidate.host.t - (endpointX - 250) / 500) < 1e-9
    && !!endpointCandidate.measure.labels[0].text;

  const originalSvgPoint = card._svgPoint;
  card._opDrag = {
    id: saved.id, moved: false, sx: 0, sy: 0, dirty: false,
    before: card._geometrySnapshot(),
  };
  card._svgPoint = () => [250, 500];
  card._opPointerMove(new PointerEvent('pointermove', {
    pointerId: 186, clientX: 20, clientY: 0, bubbles: true,
  }), saved);
  card._svgPoint = originalSvgPoint;
  card._opPointerUp(new PointerEvent('pointerup', { pointerId: 186, bubbles: true }), saved);
  await update();
  result.directDragStopsAtSameJambBoundary = Math.abs(saved.host.t - (endpointX - 250) / 500) < 1e-9
    && Math.abs(saved.x - endpointX / 1000) < 1e-9;

  card._editOpening(card._openingsR.find((opening) => opening.id === saved.id));
  card._openingDialog = { ...card._openingDialog, lengthCm: 600, lengthTouched: true };
  const beforeRejectedDialog = JSON.stringify(space.openings);
  const writesBeforeRejectedDialog = writes;
  const historyBeforeRejectedDialog = card._geometryHistory.size;
  await update();
  const dialogGuidance = root().querySelector('.habindingbanner')?.textContent || '';
  result.dialogShowsJambSpecificGuidance = dialogGuidance.includes('Leave at least')
    || dialogGuidance.includes('Оставьте');
  card._saveOpening();
  result.invalidLengthWritesNeitherConfigNorHistory = JSON.stringify(space.openings)
      === beforeRejectedDialog
    && writes === writesBeforeRejectedDialog
    && card._geometryHistory.size === historyBeforeRejectedDialog;
  card._openingDialog = null;

  saved.host.t = 0.5;
  saved.x = 0.5;
  saved.y = 0.5;
  card._saveConfig();
  space.partitions.push({ id: 'short', a: [0.2, 0.7], b: [0.27, 0.7], cm: 15 });
  card._cfgEpoch++;
  card._modelCache = null;
  card._openingPlacementIntervalsCache = null;
  const previousToast = card._showToast;
  let jambToast = '';
  card._showToast = (message) => { jambToast = message; };
  const shortPoint = [235, 700];
  const shortCandidate = card._resolveOpeningPlacement(shortPoint);
  card._openingClick(shortPoint);
  card._showToast = previousToast;
  result.tooShortPartitionHasNoPreviewAndExplainsWhy = shortCandidate === null
    && (jambToast.includes('Leave at least') || jambToast.includes('Оставьте'));
  space.partitions = space.partitions.filter((partition) => partition.id !== 'short');
  card._cfgEpoch++;
  card._modelCache = null;
  card._openingPlacementIntervalsCache = null;

  card._physicalBodiesCache = null;
  const bodies = card._physicalBodiesR();
  result.hostBodyHasFullDepthOpeningGap = !bodies.some((body) => pointIn(centre, body));

  const base = card._spaceModel().partitions.find((partition) => partition.id === 'host');
  card._physicalDrag = {
    pid: 132, kind: 'partition', id: 'host', start: [...base.a],
    startClient: [0, 0], before: card._geometrySnapshot(), moved: true,
    base: JSON.parse(JSON.stringify(base)), delta: [50, 25],
  };
  card._physicalUp(new PointerEvent('pointerup', { pointerId: 132, bubbles: true }));
  await update();
  space = card._curSpaceCfg;
  const movedOpening = space.openings?.[0];
  result.rigidHostMoveKeepsTAndMovesProjectionAtomically = !!movedOpening
    && Math.abs(movedOpening.host.t - 0.5) < 1e-9
    && Math.abs(movedOpening.x - 0.55) < 1e-9
    && Math.abs(movedOpening.y - 0.525) < 1e-9;

  card._physicalSel = { kind: 'partition', id: 'host' };
  card._deletePhysicalSelection();
  await update();
  result.deleteRequiresAccessibleListDialog = !!card._partitionDeleteDialog
    && root().querySelectorAll('hp-dialog li').length === 1
    && !!space.partitions?.length && !!space.openings?.length;
  card._partitionDeleteDialog = null;
  await update();
  result.deleteCancelIsMutationFree = !!space.partitions?.length && !!space.openings?.length;
  card._physicalSel = { kind: 'partition', id: 'host' };
  card._deletePhysicalSelection();
  card._confirmPartitionDelete();
  await update();
  result.deleteConfirmCascadesHostAndOpening = !space.partitions && !space.openings;
  card._undoGeometry();
  await update();
  space = card._curSpaceCfg;
  result.deleteUndoRestoresHostAndOpening = space.partitions?.[0]?.id === 'host'
    && space.openings?.[0]?.host?.id === 'host';
  card._redoGeometry();
  await update();
  space = card._curSpaceCfg;
  result.deleteRedoCascadesAgain = !space.partitions && !space.openings;

  space.partitions = [{ id: 'replacement', a: [0.3, 0.6], b: [0.7, 0.6], cm: 15 }];
  space.openings = [{
    id: 'orphan', type: 'door', x: 0.5, y: 0.6, angle: 0, length: 0.1,
    host: { kind: 'partition', id: 'missing', t: 0.5 },
  }];
  card._saveConfig();
  await update();
  card._editOpening(card._openingsR[0]);
  card._rebindPartitionOpening();
  result.orphanRebindSessionKeepsOriginalIdentity = card._openingRebindId === 'orphan';
  card._openingClick([500, 600]);
  card._saveOpening();
  await update();
  result.orphanRebindReplacesHostWithoutDuplicate = space.openings.length === 1
    && space.openings[0].id === 'orphan'
    && space.openings[0].host?.id === 'replacement';

  // Production-bundle regression for #185: a legacy room-wall opening does
  // not cut the structural segment consumed by #173 room-face detection.
  space.rooms = [{
    id: 'room', name: 'Room', area: null,
    poly: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]],
  }];
  delete space.partitions;
  space.openings = [{
    id: 'legacy-door', type: 'door', x: 0.5, y: 0.1, angle: 0, length: 0.2,
  }];
  card._saveConfig();
  await update();
  const structural = card._planStructuralGeometrySnapshot().value;
  result.openingKeepsRoomFaceAxisContinuous = structural.segments.some((segment) =>
    segment.sourceKind === 'room'
    && Math.min(segment.a[0], segment.b[0]) <= 100 + 1e-6
    && Math.max(segment.a[0], segment.b[0]) >= 900 - 1e-6
    && Math.abs(segment.a[1] - 100) < 1e-6
    && Math.abs(segment.b[1] - 100) < 1e-6);

  return result;
});

await finish(browser, checkAll(out));
