/** Issue #228: exact drawing, existing faces, bounded repair and room deletion. */
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1000, height: 820 }, 1);

const out = await page.evaluate(async () => {
  const result = {};
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const update = async () => { card.requestUpdate(); await card.updateComplete; };
  const base = {
    id: 'repairs', title: 'Repairs', cell_cm: 5, view_box: [0, 0, 1, 0.7],
    rooms: [], openings: [], room_drafts: [], partitions: [], wall_columns: [],
  };
  const reset = async (patch = {}) => {
    card._serverCfg = { spaces: [{ ...clone(base), ...clone(patch) }], markers: [], settings: {} };
    card._space = 'repairs';
    card._layout = {};
    card._cfgEpoch++;
    card._modelCache = null;
    card._frame = null;
    card._path = [];
    card._activeDraftId = null;
    card._draftSegmentCms = [];
    card._wallFaceBatch = null;
    card._roomDialog = false;
    card._roomDeleteDialog = null;
    card._wallRepairDiagnostic = null;
    card._drawWallField = '20';
    card._setMode('plan');
    card._tool = 'draw';
    card._clearPlanSnapHover();
    await update();
  };
  const ring = (gap = 0) => [
    { id: 'top', a: [0.1, 0.1], b: [0.5, 0.1], cm: 20 },
    { id: 'right', a: [0.5, 0.1], b: [0.5, 0.5], cm: 20 },
    { id: 'bottom', a: [0.5, 0.5], b: [0.1, 0.5], cm: 20 },
    { id: 'left', a: [0.1, 0.5], b: [0.1, 0.1 + gap], cm: 20 },
  ];

  await reset();
  card._path = [[100, 600]];
  card._cursorPt = [200, 600];
  await update();
  result.activeSegmentShowsAxisAndNode = !!root().querySelector('.active-axis')
    && !!root().querySelector('.active-vertex');

  await reset({ partitions: [{ id: 'strict-target', a: [0.3, 0.1], b: [0.3, 0.5], cm: 20 }] });
  card._path = [[100, 200]];
  const strict = card._resolvePlanDrawPoint([303, 201], true);
  result.strictShiftUsesExactRayIntersection = strict.candidate?.kind === 'line'
    && strict.point[0] === 300 && strict.point[1] === 200;
  card._cursorPt = strict.point;
  await update();
  const exactLabelGreen = root().querySelector('.measurelabel')?.classList.contains('on45');
  card._cursorPt = [100 + Math.tan(0.1 * Math.PI / 180) * 100, 300];
  await update();
  result.angleColourMatchesActualVector = exactLabelGreen
    && !root().querySelector('.measurelabel')?.classList.contains('on45');

  await reset({ partitions: [
    { id: 'near-a', a: [0.1, 0.1], b: [0.1, 0.3], cm: 20 },
    { id: 'near-b', a: [0.106, 0.1], b: [0.106, 0.3], cm: 20 },
  ] });
  const conflict = card._resolvePlanDrawPoint([103, 100], false);
  result.closeEndpointsFailClosed = conflict.ambiguous && conflict.conflicts.length === 2;

  await reset({ partitions: ring() });
  const exactBefore = JSON.stringify(card._curSpaceCfg);
  result.existingFaceOffersRoom = card._offerExistingWallFace([300, 300])
    && card._roomDialog && card._wallFaceBatch?.candidates[0]?.existing;
  card._keepClosedAsPartitions();
  await update();
  result.keepExistingFaceIsNoop = JSON.stringify(card._curSpaceCfg) === exactBefore
    && !card._roomDialog && !card._wallFaceBatch;
  card._path = [];
  const stage = root().querySelector('.stage');
  const rect = stage.getBoundingClientRect();
  const view = card._viewOr(card._baseVb());
  const clickAt = (x, y, shiftKey = false) => new MouseEvent('click', {
    clientX: rect.left + ((x - view.x) / view.w) * rect.width,
    clientY: rect.top + ((y - view.y) / view.h) * rect.height,
    bubbles: true, shiftKey,
  });
  card._markupClick(clickAt(300, 300, true));
  result.shiftBypassesExistingFaceOffer = card._path.length === 1 && !card._roomDialog;
  card._cancelPath();

  const largeGap = card._cmToUnits(3) / 1000;
  const alternativeX = 0.1 + card._cmToUnits(1) / 1000;
  await reset({ partitions: [
    ...ring(largeGap),
    { id: 'alternative', a: [alternativeX, 0.1], b: [alternativeX, 0.08], cm: 20 },
  ] });
  card._markupClick(clickAt(300, 300));
  result.ambiguousLargeGapUsesWallsFlow = card._path.length === 1
    && !card._roomDialog && !card._wallRepairDiagnostic && !card._toast;

  await reset({
    partitions: ring(card._cmToUnits(1.2) / 1000),
    openings: [{
      id: 'hosted-gap', type: 'door', x: 0.1, y: 0.3, angle: 90, length: 0.08,
      host: { kind: 'partition', id: 'left', t: 0.5 },
    }],
  });
  const hostedBefore = JSON.stringify(card._curSpaceCfg);
  const hostedOffered = card._offerExistingWallFace([300, 300]);
  card._nameSel = 'Must not repair';
  card._saveRoom();
  await update();
  result.hostedOpeningBlocksRepair = hostedOffered
    && JSON.stringify(card._curSpaceCfg) === hostedBefore
    && !card._roomDialog && !card._wallFaceBatch
    && card._toast === card._t('toast.wall_repair_changed');

  await reset({ partitions: ring() });
  card._offerExistingWallFace([300, 300]);
  card._nameSel = 'Existing face';
  card._saveRoom();
  await update();
  result.createExistingFaceKeepsPartitions = card._curSpaceCfg.rooms.length === 1
    && card._curSpaceCfg.partitions.length === 4;
  const createdWalls = clone(card._curSpaceCfg.walls || []);

  await reset({ partitions: ring(card._cmToUnits(1.2) / 1000) });
  const leftBefore = clone(card._curSpaceCfg.partitions.find((item) => item.id === 'left'));
  const gapOffered = card._offerExistingWallFace([300, 300]);
  await update();
  result.smallGapOffersRepair = gapOffered
    && !!card._wallFaceBatch?.candidates[0]?.repair
    && !!root().querySelector('.wall-repair-preview');
  card._nameSel = 'Repaired';
  card._saveRoom();
  await update();
  const repairedLeft = card._curSpaceCfg.partitions.find((item) => item.id === 'left');
  result.repairCommitsOnlyWithRoom = leftBefore.b[1] !== repairedLeft.b[1]
    && repairedLeft.b[1] === 0.1 && card._curSpaceCfg.rooms.length === 1;

  const room = { id: 'delete-me', name: 'Delete me', area: null,
    poly: [[0.1, 0.1], [0.5, 0.1], [0.5, 0.5], [0.1, 0.5]] };
  const walls = createdWalls;
  const opening = { id: 'door', type: 'door', x: 0.3, y: 0.1, angle: 0, length: 0.08 };
  await reset({ rooms: [room], walls, openings: [opening], partitions: [] });
  card._tool = 'delroom';
  card._deleteRoomClick([300, 300]);
  await update();
  result.deleteUsesAccessibleChoiceDialog = !!card._roomDeleteDialog
    && !!root().querySelector('hp-dialog');
  card._confirmRoomDelete(true);
  await update();
  result.keepWallsMaterializesAndRehosts = card._curSpaceCfg.rooms.length === 0
    && card._curSpaceCfg.partitions?.length === 4
    && card._curSpaceCfg.openings?.[0]?.host?.kind === 'partition';

  await reset({ rooms: [room], walls, openings: [opening], partitions: [] });
  card._tool = 'delroom';
  card._deleteRoomClick([300, 300]);
  card._confirmRoomDelete(false);
  await update();
  result.deleteWallsCascadesExclusiveOpening = card._curSpaceCfg.rooms.length === 0
    && !card._curSpaceCfg.openings;

  card._setMode('view');
  await update();
  result.viewHasNoEditorRepairChrome = !root().querySelector('.wall-repair-preview')
    && !root().querySelector('.active-axis');
  return result;
});

await finish(browser, checkAll(out));
