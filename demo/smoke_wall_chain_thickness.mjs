/** Issue #234/#478: every accepted wall keeps the toolbar thickness at its click. */
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 900, height: 760 });

const result = await page.evaluate(async () => {
  const out = {};
  const card = window.__card;
  const update = async () => { card.requestUpdate(); await card.updateComplete; };
  card._serverCfg = {
    model_version: 10,
    spaces: [{
      id: 'thickness', title: 'Thickness', cell_cm: 5,
      view_box: [0, 0, 1, 0.75], rooms: [], wall_segments: [],
      partitions: [], openings: [], wall_columns: [],
    }],
    markers: [], settings: {},
  };
  card._space = 'thickness'; card._layout = {}; card._cfgEpoch++;
  card._modelCache = null; card._frame = null; card._geometryHistory.clear();
  card._setMode('plan'); card._tool = 'draw';
  card._path = []; card._activeWallChainId = null;
  card._activeWallChainPartitionIds = []; card._wallChainSegmentCms = [];
  await update();

  const stage = (card.shadowRoot || card.renderRoot).querySelector('.stage');
  const click = async (x, y) => {
    const rect = stage.getBoundingClientRect();
    const view = card._viewOr(card._baseVb());
    card._markupClick(new MouseEvent('click', {
      clientX: rect.left + ((x - view.x) / view.w) * rect.width,
      clientY: rect.top + ((y - view.y) / view.h) * rect.height,
      bubbles: true,
    }));
    await update();
  };

  await click(100, 100);
  card._drawWallField = '30'; await click(300, 100);
  card._drawWallField = '25'; await click(300, 300);
  card._drawWallField = '30'; await click(500, 300);

  const partitions = card._curSpaceCfg.partitions || [];
  out.threeSegmentsPersistImmediately = partitions.length === 3
    && card._activeWallChainPartitionIds.length === 3 && card._path.length === 4;
  out.eachClickKeepsItsThickness = JSON.stringify(partitions.map((item) => item.cm))
    === JSON.stringify([30, 25, 30]);
  out.sessionVectorMatchesPersistedWalls = JSON.stringify(card._wallChainSegmentCms)
    === JSON.stringify([30, 25, 30]);
  out.noLegacyDraftCarrier = !('room_drafts' in card._curSpaceCfg);

  card._activateMarkupTool('wallthick'); await update();
  const hits = [[200, 100], [300, 200], [400, 300]]
    .map((point) => card._wallThickHit(point)?.cm);
  out.thicknessToolReadsStoredValues = JSON.stringify(hits) === JSON.stringify([30, 25, 30]);
  out.toolChangeOnlyEndsSession = card._path.length === 0
    && card._activeWallChainPartitionIds.length === 0
    && card._curSpaceCfg.partitions.length === 3;
  return out;
});

await finish(browser, checkAll(result));
