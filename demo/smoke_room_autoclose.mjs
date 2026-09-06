/** Issue #138: a new room may close along one existing continuous solid wall interval. */
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 900, height: 820 }, 1);

const out = await page.evaluate(async () => {
  const result = {};
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const update = async () => { card.requestUpdate(); await card.updateComplete; };
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const baseSpace = {
    id: 'autoclose', title: 'Autoclose', cell_cm: 5, view_box: [0, 0, 1, 0.7],
    rooms: [{
      id: 'existing', name: 'Existing', area: null,
      poly: [[0.1, 0.1], [0.5, 0.1], [0.5, 0.5], [0.1, 0.5]],
    }],
    walls: [{
      key: '0.500000,0.300000@1.5708',
      a: [0.5, 0.1], b: [0.5, 0.5], cm: 40,
    }],
  };
  const reset = async (spacePatch = {}) => {
    card._serverCfg = { spaces: [{ ...clone(baseSpace), ...clone(spacePatch) }], markers: [], settings: {} };
    card._layout = {};
    card._space = 'autoclose';
    card._modelCache = null;
    card._frame = null;
    card._cfgEpoch++;
    card._planSnapGeometryCache = null;
    card._path = [];
    card._activeWallChainId = null;
    card._activeWallChainPartitionIds = [];
    card._wallChainSegmentCms = [];
    card._wallChainRedo = [];
    card._closingWallCm = null;
    card._roomDialog = false;
    card._wallFaceBatch = null;
    card._roomEditId = null;
    card._pendingSplit = null;
    card._toast = '';
    card._drawWallField = '15';
    card._setMode('plan');
    card._tool = 'draw';
    card._clearPlanSnapHover();
    await update();
  };

  await reset();
  const stage = root().querySelector('.stage');
  const eventAt = (x, y, extra = {}) => {
    const rect = stage.getBoundingClientRect();
    const view = card._viewOr(card._baseVb());
    return new MouseEvent('click', {
      clientX: rect.left + ((x - view.x) / view.w) * rect.width,
      clientY: rect.top + ((y - view.y) / view.h) * rect.height,
      bubbles: true,
      ...extra,
    });
  };
  const click = async (x, y, extra = {}) => {
    card._markupClick(eventAt(x, y, extra));
    await update();
  };
  const close = (a, b, epsilon = 1e-5) => Math.abs(a - b) <= epsilon;
  const currentChain = () => card._activeWallChainPartitionIds
    .map((id) => card._curSpaceCfg.partitions?.find((partition) => partition.id === id))
    .filter(Boolean);

  // r1 regression guard: two points on the common wall are still only an open line.
  await click(500, 100);
  await click(500, 500);
  result.secondCommonWallPointStaysOpen = card._path.length === 2
    && !card._roomDialog && !card._toast
    && currentChain().length === 1;

  // Endpoint-to-endpoint auto-close after the new room has enough vertices.
  await reset();
  await click(500, 100);
  await click(800, 100);
  await click(800, 500);
  await click(500, 500);
  const successfulChain = clone(currentChain());
  result.endpointAutoCloseOpensDialog = card._roomDialog
    && card._wallFaceBatch?.candidates.length === 1
    && card._path.length === 4
    && close(card._path.at(-1)[0], 500)
    && close(card._path.at(-1)[1], 500);
  result.terminalSegmentPersistsBeforeDialog = successfulChain.length === 3
    && close(successfulChain.at(-1).b[0], 0.5)
    && close(successfulChain.at(-1).b[1], 0.5)
    && successfulChain.every((segment) => close(segment.cm, 15));
  result.roomIsNotCommittedBeforeSave = card._curSpaceCfg.rooms.length === 1;

  card._roomDialogCancel();
  await update();
  result.cancelKeepsTerminalOpenChain = !card._roomDialog
    && card._path.length === 4
    && !card._contourClosed
    && JSON.stringify(currentChain()) === JSON.stringify(successfulChain)
    && close(card._path.at(-1)[0], 500) && close(card._path.at(-1)[1], 500);

  // Save promotes the same draft, keeps the existing shared thickness and creates no partition.
  await reset();
  await click(500, 100);
  await click(800, 100);
  await click(800, 500);
  await click(500, 500);
  card._nameSel = 'Adjacent';
  card._saveRoom();
  await update();
  const sharedWall = (card._curSpaceCfg.walls || []).find((wall) => wall.cm === 40
    && wall.a && wall.b
    && close(wall.a[0], 0.5) && close(wall.b[0], 0.5)
    && close(Math.min(wall.a[1], wall.b[1]), 0.1)
    && close(Math.max(wall.a[1], wall.b[1]), 0.5));
  result.savePromotesChainWithoutPartition = card._curSpaceCfg.rooms.length === 2
    && card._curSpaceCfg.rooms.some((room) => room.name === 'Adjacent')
    && !('room_drafts' in card._curSpaceCfg)
    && !card._curSpaceCfg.partitions?.length
    && card._path.length === 0;
  result.sharedWallKeepsNeighbourThickness = !!sharedWall
    && (card._curSpaceCfg.walls || []).filter((wall) => wall.cm === 15).length >= 3;

  // #185: an architectural opening cuts masonry, not the structural wall axis.
  await reset({ openings: [{
    id: 'door', type: 'door', x: 0.5, y: 0.3, angle: 90, length: 0.1,
  }] });
  await click(500, 100);
  await click(800, 100);
  await click(800, 500);
  await click(500, 500);
  result.openingKeepsStructuralAutoClose = card._roomDialog
    && card._wallFaceBatch?.candidates.length === 1
    && card._path.length === 4
    && currentChain().length === 3;

  // #173: a proper X is a derived graph node. The two bounded faces are
  // offered, while the terminal draft remains the only persisted mutation.
  await reset();
  await click(500, 100);
  await click(400, 300);
  await click(700, 300);
  await click(500, 500);
  result.xIntersectionOffersFacesWithoutPartialRooms = card._roomDialog
    && card._wallFaceBatch?.candidates.length === 2
    && card._path.length === 4
    && currentChain().length === 3
    && card._curSpaceCfg.rooms.length === 1;

  return result;
});

await finish(browser, checkAll(out));
