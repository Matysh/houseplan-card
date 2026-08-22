/** Issue #173: one Walls chain, face proposal and atomic finish/cancel. */
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1100, height: 820 }, 1);

const result = await page.evaluate(async () => {
  const out = {};
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const update = async () => { card.requestUpdate(); await card.updateComplete; };
  const space = () => card._serverCfg.spaces[0];
  const resetGeometry = async (rooms = []) => {
    const current = space();
    current.rooms = JSON.parse(JSON.stringify(rooms));
    delete current.room_drafts;
    delete current.partitions;
    delete current.walls;
    delete current.open_spans;
    card._cfgEpoch++;
    card._modelCache = null;
    card._path = [];
    card._activeDraftId = null;
    card._draftSegmentCms = [];
    card._wallFaceBatch = null;
    card._roomDialog = false;
    card._tool = 'draw';
    await update();
  };
  const draw = async (points) => {
    card._tool = 'draw';
    card._path = [[...points[0]]];
    card._activeDraftId = null;
    card._draftSegmentCms = [];
    for (let i = 1; i < points.length; i++) {
      const before = card._path.map((point) => [...point]);
      card._path = [...card._path, [...points[i]]];
      card._draftSegmentCms = [...card._draftSegmentCms, card._drawWallCm];
      card._persistActiveDraftSegment();
      card._offerWallFaces(before);
      await update();
    }
  };

  card._serverCfg = {
    spaces: [{
      id: 'walls', title: 'Walls', cell_cm: 5, view_box: [0, 0, 1, 0.7],
      rooms: [], openings: [], room_drafts: [], partitions: [], wall_columns: [],
    }],
    markers: [], settings: {},
  };
  card._space = 'walls';
  card._layout = {};
  card._cfgEpoch++;
  card._modelCache = null;
  card._setMode('plan');
  card._tool = 'draw';
  await update();

  const toolbarLabels = [...root().querySelectorAll('.planbar .editbar-tools > button, .wallsgroup > button')]
    .map((button) => (button.textContent || '').trim());
  out.oneWallsButton = toolbarLabels.filter((label) => ['Walls', 'Стены'].includes(label)).length === 1;
  out.partitionButtonRemoved = !toolbarLabels.some((label) => ['Partition', 'Перегородка'].includes(label));
  out.splitRemains = toolbarLabels.some((label) => ['Split', 'Разделить'].includes(label));

  await resetGeometry();
  await draw([[100, 100], [300, 100], [300, 250]]);
  out.openChainIsCrashSafeDraft = space().room_drafts?.length === 1
    && space().room_drafts[0].segments.length === 2;
  const cms = space().room_drafts[0].segments.map((segment) => segment.cm);
  card._activateMarkupTool('select');
  await update();
  out.toolChangeFinishesPartitions = !space().room_drafts
    && space().partitions?.length === 2
    && space().partitions.every((partition, index) => partition.cm === cms[index]);
  out.finishedChainDoesNotResume = !card._activeDraftId && card._path.length === 0;

  await resetGeometry();
  await draw([[100, 100], [300, 100], [300, 300], [100, 300], [100, 100]]);
  out.closedFaceOpensDialog = card._roomDialog && card._wallFaceBatch?.candidates.length === 1;
  out.terminalSegmentPersistedBeforeDecision = space().room_drafts?.[0]?.segments.length === 4;
  card._nameSel = 'Graph room';
  card._saveRoom();
  await update();
  out.acceptCreatesRoomAtomically = space().rooms?.length === 1
    && space().rooms[0].name === 'Graph room'
    && !space().room_drafts && !(space().partitions?.length);

  await resetGeometry();
  await draw([[500, 100], [700, 100], [700, 300], [500, 300], [500, 100]]);
  const draftBeforeCancel = JSON.stringify(space().room_drafts);
  card._roomDialogCancel();
  await update();
  out.cancelKeepsWholeTerminalDraft = !card._roomDialog && !card._wallFaceBatch
    && JSON.stringify(space().room_drafts) === draftBeforeCancel
    && card._path.length === 5;
  card._onKey(new KeyboardEvent('keydown', {
    key: 'z', code: 'KeyZ', ctrlKey: true, bubbles: true,
  }));
  await update();
  out.escapeUndoContractStillRemovesLastSegment = space().room_drafts?.[0]?.segments.length === 3
    && card._path.length === 4;

  await resetGeometry();
  await draw([[100, 450], [300, 450], [300, 650], [100, 650], [100, 450]]);
  card._onKey(new KeyboardEvent('keydown', {
    key: 'z', code: 'KeyZ', ctrlKey: true, bubbles: true,
  }));
  await update();
  out.ctrlZInQueueRemovesTerminalPoint = !card._roomDialog && !card._wallFaceBatch
    && card._path.length === 4 && space().room_drafts?.[0]?.segments.length === 3;

  await resetGeometry();
  space().partitions = [
    { id: 'top', a: [0.1, 0.1], b: [0.5, 0.1], cm: 18 },
    { id: 'right', a: [0.5, 0.1], b: [0.5, 0.3], cm: 18 },
    { id: 'bottom', a: [0.5, 0.3], b: [0.1, 0.3], cm: 18 },
    { id: 'left', a: [0.1, 0.3], b: [0.1, 0.1], cm: 18 },
  ];
  card._cfgEpoch++;
  card._modelCache = null;
  await draw([[260, 100], [260, 300]]);
  out.multiFaceTClosureOrdered = card._wallFaceBatch?.candidates.length === 2
    && card._wallFaceBatch.candidates[0].area < card._wallFaceBatch.candidates[1].area;
  card._nameSel = 'Small face';
  card._saveRoom();
  await update();
  out.firstQueueDecisionIsBuffered = card._wallFaceBatch?.index === 1
    && space().rooms.length === 0 && space().room_drafts?.length === 1;
  card._keepClosedAsPartitions();
  await update();
  out.mixedQueueAppliesOnce = space().rooms.length === 1
    && space().rooms[0].name === 'Small face'
    && !space().room_drafts && space().partitions?.length === 4;

  const parent = {
    id: 'parent', name: 'Parent', area: 'area-parent', open_to: ['neighbour'],
    settings: { name_scale: 1.2 },
    poly: [[0.1, 0.1], [0.5, 0.1], [0.5, 0.5], [0.1, 0.5]],
  };
  await resetGeometry([parent]);
  await draw([[200, 100], [200, 500]]);
  out.cleanSplitUsesOneCandidate = card._roomDialog
    && card._wallFaceBatch?.candidates.length === 1
    && !!card._wallFaceBatch.candidates[0].split;
  card._nameSel = 'Child';
  card._saveRoom();
  await update();
  const retained = space().rooms.find((room) => room.id === 'parent');
  out.cleanSplitRetainsParentMetadata = space().rooms.length === 2
    && retained?.name === 'Parent' && retained?.area === 'area-parent'
    && retained?.settings?.name_scale === 1.2;
  out.cleanSplitConsumesDivider = !(space().partitions?.length) && !space().room_drafts;
  out.wallFaceCacheIsBounded = card._wallFaceGraphCache?.length > 0
    && card._wallFaceGraphCache.length <= 4;

  return out;
});

await finish(browser, checkAll(result));
