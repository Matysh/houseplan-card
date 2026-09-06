/** Issue #177/#478: overlap guards operate on canonical wall partitions. */
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1100, height: 820 }, 1);

const result = await page.evaluate(async () => {
  const out = {};
  const card = window.__card;
  const update = async () => { card.requestUpdate(); await card.updateComplete; };
  const ring = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const closed = (points) => [...points, [...points[0]]];
  const roomAt = (name, points) => ({
    id: `r-${name}`, name,
    poly: points.map((point) => [point[0] / 1000, point[1] / 1000]),
  });
  const space = () => card._serverCfg.spaces[0];
  const reset = async (rooms = []) => {
    card._serverCfg = {
      spaces: [{
        id: 'overlap', title: 'Overlap', cell_cm: 5, view_box: [0, 0, 1, 0.7],
        rooms: structuredClone(rooms), openings: [], partitions: [], wall_columns: [],
      }],
      markers: [], settings: {},
    };
    card._space = 'overlap'; card._layout = {}; card._cfgEpoch++;
    card._modelCache = null; card._frame = null; card._geometryHistory.clear();
    card._path = []; card._activeWallChainId = null;
    card._activeWallChainPartitionIds = []; card._wallChainSegmentCms = [];
    card._wallFaceBatch = null; card._roomDialog = false;
    card._setMode('plan'); card._tool = 'draw'; await update();
  };
  const click = async (x, y) => {
    const stage = (card.shadowRoot || card.renderRoot).querySelector('.stage');
    const rect = stage.getBoundingClientRect();
    const view = card._viewOr(card._baseVb());
    card._markupClick(new MouseEvent('click', {
      clientX: rect.left + ((x - view.x) / view.w) * rect.width,
      clientY: rect.top + ((y - view.y) / view.h) * rect.height,
      bubbles: true,
    }));
    await update();
  };
  const draw = async (points) => {
    for (const point of points) await click(point[0], point[1]);
  };

  const base = ring(200, 200, 400, 400);
  await reset([roomAt('base', base)]);
  await draw(closed(base));
  out.duplicateOffersNothing = !card._wallFaceBatch && !card._roomDialog;
  out.duplicateKeepsOneRoom = space().rooms.length === 1;

  await reset([roomAt('base', base)]);
  const roomShape = () => (space().rooms || []).map(({ wall_ids: _wallIds, ...room }) => room);
  const configBefore = JSON.stringify(roomShape());
  const drawnRing = ring(300, 300, 500, 500);
  await draw(closed(drawnRing));
  const offered = card._wallFaceBatch?.candidates || [];
  out.partialOverlapDecomposesIntoFaces = offered.length === 3;
  out.partialOverlapNeverOffersDrawnRing = offered.length > 0
    && offered.every((candidate) => candidate.area < 40000 - 1);
  out.partialOverlapFacesSumToUnion = Math.abs(
    offered.reduce((sum, candidate) => sum + candidate.area, 0) - 70000,
  ) < 1;
  out.partialOverlapKeepsRoomsUntilDecision = JSON.stringify(roomShape()) === configBefore;

  await reset([roomAt('outer', ring(100, 100, 600, 600))]);
  await draw(closed(ring(200, 200, 300, 300)));
  out.innerNestingIsOffered = card._wallFaceBatch?.candidates.length === 1;
  card._nameSel = 'Island'; card._saveRoom(); await update();
  out.innerNestingCreatesIslandRoom = space().rooms.length === 2
    && space().rooms.some((room) => room.name === 'Island');

  await reset([roomAt('inner', ring(300, 300, 400, 400))]);
  await draw(closed(ring(150, 150, 600, 600)));
  out.outerNestingIsOffered = card._wallFaceBatch?.candidates.length === 1;
  card._nameSel = 'Around'; card._saveRoom(); await update();
  out.outerNestingCreatesRoom = space().rooms.length === 2
    && space().rooms.some((room) => room.name === 'Around');

  await reset([roomAt('base', base)]);
  const clash = ring(300, 300, 500, 500);
  card._wallFaceBatch = {
    candidates: [{ key: 'manual', area: 1, ring: clash }],
    index: 0,
    decisions: [{ candidate: { key: 'manual', area: 1, ring: clash }, create: true }],
    activePath: closed(clash), activeCms: [15, 15, 15, 15], activePartitionIds: [],
  };
  const roomsBeforeGuard = space().rooms.length;
  card._applyWallFaceBatch(); await update();
  out.applyGuardRejectsOverlap = space().rooms.length === roomsBeforeGuard;
  out.applyGuardClosesBatch = !card._wallFaceBatch;
  return out;
});

checkAll(result);
await finish(browser, result);
