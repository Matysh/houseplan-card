/** Issue #173/#478: Walls use canonical partitions and session-only chains. */
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1100, height: 820 }, 1);

const result = await page.evaluate(async () => {
  const out = {};
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const update = async () => { card.requestUpdate(); await card.updateComplete; };
  const space = () => card._serverCfg.spaces[0];
  const keyDown = async (key, init = {}) => {
    window.dispatchEvent(new KeyboardEvent('keydown', {
      key, bubbles: true, cancelable: true, ...init,
    }));
    await update();
  };
  const click = async (x, y) => {
    const stage = root().querySelector('.stage');
    const rect = stage.getBoundingClientRect();
    const view = card._viewOr(card._baseVb());
    card._markupClick(new MouseEvent('click', {
      clientX: rect.left + ((x - view.x) / view.w) * rect.width,
      clientY: rect.top + ((y - view.y) / view.h) * rect.height,
      bubbles: true, cancelable: true,
    }));
    await update();
  };
  const reset = async () => {
    card._serverCfg = {
      model_version: 10,
      spaces: [{
        id: 'walls', title: 'Walls', cell_cm: 5, view_box: [0, 0, 1, 0.7],
        rooms: [], wall_segments: [], partitions: [], openings: [], wall_columns: [],
      }],
      markers: [], settings: {},
    };
    card._space = 'walls'; card._layout = {}; card._cfgEpoch++;
    card._modelCache = null; card._frame = null; card._geometryHistory.clear();
    card._path = []; card._activeWallChainId = null;
    card._activeWallChainPartitionIds = []; card._wallChainSegmentCms = [];
    card._wallChainRedo = []; card._wallFaceBatch = null; card._roomDialog = false;
    card._toast = ''; card._setMode('plan'); card._tool = 'draw';
    await update();
  };
  const draw = async (points, cms = []) => {
    card._drawWallField = String(cms[0] ?? 15);
    await click(...points[0]);
    for (let index = 1; index < points.length; index++) {
      card._drawWallField = String(cms[index - 1] ?? 15);
      await click(...points[index]);
    }
  };

  await reset();
  const toolbarLabels = [...root().querySelectorAll(
    '.planbar .editbar-tools > button, .wallsgroup > button',
  )].map((button) => (button.textContent || '').trim());
  out.oneWallsButton = toolbarLabels.filter((label) => ['Walls', 'Стены'].includes(label)).length === 1;
  out.partitionButtonRemoved = !toolbarLabels.some((label) => ['Partition', 'Перегородка'].includes(label));
  out.splitRemains = toolbarLabels.some((label) => ['Split', 'Разделить'].includes(label));

  await draw([[100, 100], [300, 100], [300, 250]], [12, 23]);
  out.eachAcceptedSegmentIsCanonical = space().partitions.length === 2
    && JSON.stringify(space().partitions.map((item) => item.cm)) === JSON.stringify([12, 23])
    && card._activeWallChainPartitionIds.length === 2
    && !('room_drafts' in space());
  const historyBeforeFinish = card._geometryHistory.undoName;
  card._activateMarkupTool('select'); await update();
  out.toolChangeOnlyEndsSession = space().partitions.length === 2
    && card._path.length === 0 && card._activeWallChainPartitionIds.length === 0
    && card._geometryHistory.undoName === historyBeforeFinish;

  await reset();
  await draw([[100, 100], [300, 100], [300, 250]], [12, 23]);
  const beforeEscape = JSON.stringify(space().partitions);
  await keyDown('Escape');
  out.escapeKeepsAcceptedWalls = card._tool === 'draw' && card._path.length === 0
    && JSON.stringify(space().partitions) === beforeEscape;
  const afterFirstEscape = JSON.stringify(space());
  await keyDown('Escape');
  out.repeatedEscapeIsNoop = JSON.stringify(space()) === afterFirstEscape;

  await reset();
  const beforeFirstPoint = JSON.stringify(space());
  await click(200, 200); await keyDown('Escape');
  out.escapeDropsOnlyTransientFirstPoint = card._path.length === 0
    && space().partitions.length === 0 && JSON.stringify(space()) === beforeFirstPoint;

  await reset();
  await draw([[100, 450], [300, 450], [300, 650]]);
  await keyDown('z', { code: 'KeyZ', ctrlKey: true });
  out.ctrlZRemovesLastAcceptedWall = space().partitions.length === 1
    && card._path.length === 2 && card._activeWallChainPartitionIds.length === 1;

  await reset();
  await draw([[100, 100], [300, 100], [300, 300], [100, 300], [100, 100]]);
  out.closedFaceOpensDialog = card._roomDialog && card._wallFaceBatch?.candidates.length === 1
    && space().partitions.length === 4;
  card._nameSel = 'Graph room'; card._saveRoom(); await update();
  out.acceptConsumesCoincidentPartitions = space().rooms.length === 1
    && space().rooms[0].name === 'Graph room' && !space().partitions?.length
    && !('room_drafts' in space());

  await reset();
  await draw([[500, 100], [700, 100], [700, 300], [500, 300], [500, 100]]);
  const beforeCancel = JSON.stringify(space().partitions);
  card._roomDialogCancel(); await update();
  out.cancelKeepsWallsAndRestoresSession = !card._roomDialog && !card._wallFaceBatch
    && JSON.stringify(space().partitions) === beforeCancel
    && card._path.length === 5 && card._activeWallChainPartitionIds.length === 4;

  await reset();
  await draw([[100, 100], [300, 100], [300, 300], [100, 300], [100, 100]]);
  const geometryBeforeNullModel = JSON.stringify(space());
  const originalSpaceModel = card._spaceModel.bind(card);
  card._spaceModel = () => space().rooms.length ? null : originalSpaceModel();
  try {
    card._nameSel = 'Must roll back'; card._saveRoom(); await update();
  } finally {
    card._spaceModel = originalSpaceModel;
  }
  out.nullModelRollsBackWholeRoomMutation = JSON.stringify(space()) === geometryBeforeNullModel
    && space().rooms.length === 0 && card._path.length === 5
    && card._activeWallChainPartitionIds.length === 4;

  await reset();
  card._path = [[100, 100], [300, 100], [300, 300], [100, 300], [100, 100]];
  card._wallChainSegmentCms = [15, 15, 15]; card._closingWallCm = 15;
  const classicBeforeNullModel = JSON.stringify(space());
  const originalClassicSpaceModel = card._spaceModel.bind(card);
  card._spaceModel = () => space().rooms.length ? null : originalClassicSpaceModel();
  try {
    card._nameSel = 'Classic must roll back'; card._commitRoom(); await update();
  } finally {
    card._spaceModel = originalClassicSpaceModel;
  }
  out.classicNullModelRollsBackWholeRoomMutation = JSON.stringify(space()) === classicBeforeNullModel
    && space().rooms.length === 0 && card._path.length === 5;

  await reset();
  space().partitions = [{
    id: 'foreign-overlap', a: [0.05, 0.1], b: [0.2, 0.1], cm: 15,
  }, {
    id: 'foreign-unrelated', a: [0.6, 0.5], b: [0.7, 0.5], cm: 15,
  }];
  card._cfgEpoch++; card._modelCache = null;
  await draw([[100, 100], [300, 100], [300, 300], [100, 300], [100, 100]]);
  card._nameSel = 'Partial overlap'; card._saveRoom(); await update();
  const acceptedPartitions = space().partitions || [];
  const tail = acceptedPartitions.find((item) => item.id === 'foreign-overlap');
  const unrelated = acceptedPartitions.find((item) => item.id === 'foreign-unrelated');
  out.acceptSplitsOnlyCoincidentForeignInterval = acceptedPartitions.length === 2
    && JSON.stringify(tail?.a) === JSON.stringify([0.05, 0.1])
    && JSON.stringify(tail?.b) === JSON.stringify([0.1, 0.1])
    && JSON.stringify(unrelated) === JSON.stringify({
      id: 'foreign-unrelated', a: [0.6, 0.5], b: [0.7, 0.5], cm: 15,
    });
  card._openAlignDialog(); await update();
  out.acceptedRoomIsOptimizeFixedPoint = card._alignDialog?.report?.partitionsReconciled === 0
    && card._alignDialog?.changed === false;
  return out;
});

await finish(browser, checkAll(result));
