// #290: production Walls/Optimize path for the tracked 316x1 shared wall.
import { readFileSync } from 'node:fs';
import { launch, checkAll, finish } from './serve.mjs';

const space = JSON.parse(readFileSync(
  new URL('../test/fixtures/279-near-orthogonal-junction.json', import.meta.url), 'utf8',
));
const { page, browser } = await launch({ width: 980, height: 900 });

const out = await page.evaluate(async (sourceSpace) => {
  const result = {};
  const card = window.__card;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const original = {
    model_version: 7,
    spaces: [{ id: 'near-axis', title: 'Near axis', view_box: [-2, 2, 3.2, 2], ...sourceSpace }],
    markers: [], settings: {},
  };
  let serverConfig = clone(original), serverLayout = {}, backup = null;
  const sent = [];
  const baseCall = card.hass.callWS.bind(card.hass);
  card.hass = {
    ...card.hass,
    callWS: async (message) => {
      if (message.type === 'houseplan/plan/optimize') {
        sent.push(message.type);
        backup = { config: clone(serverConfig), layout: clone(serverLayout) };
        serverConfig = clone(message.config);
        serverLayout = clone(message.layout);
        return { ok: true, config_rev: 2, layout_rev: 2, can_undo: true };
      }
      if (message.type === 'houseplan/plan/optimize_undo') {
        sent.push(message.type);
        serverConfig = clone(backup.config);
        serverLayout = clone(backup.layout);
        return { ok: true, config_rev: 3, layout_rev: 3, can_undo: false };
      }
      if (message.type === 'houseplan/config/get') {
        return { config: clone(serverConfig), rev: 3, can_write: true, can_optimize_undo: !!backup };
      }
      if (message.type === 'houseplan/layout/get') return { layout: clone(serverLayout), rev: 3 };
      return baseCall(message);
    },
  };
  card._serverCfg = clone(original);
  card._layout = {};
  card._space = 'near-axis';
  card._modelCache = null;
  card._frame = null;
  card.requestUpdate();
  await card.updateComplete;

  card._openAlignDialog();
  await card.updateComplete;
  const preview = card._alignDialog;
  const dialogText = card.renderRoot.querySelector('hp-dialog')?.textContent || '';
  result.previewCountsPhysicalWallOnce = preview?.report.wallsStraightened === 1
    && preview.report.wallsStraightenSkipped === 0
    && Math.abs(preview.report.maxStraightenShiftCm - 1) < 1e-6;
  result.previewUsesProductionPreflight = preview?.preflight?.ok === true;
  result.previewNamesLossyRepair = dialogText.includes(card._t('gs.optimize_walls_straightened', {
    n: '1', cm: '1',
  }));
  result.previewDoesNotWrite = sent.length === 0
    && JSON.stringify(card._serverCfg) === JSON.stringify(original);

  card._alignDialog = null;
  await card.updateComplete;
  result.cancelDoesNotWrite = sent.length === 0;

  card._openAlignDialog();
  await card.updateComplete;
  await card._runAlignToGrid();
  await card.updateComplete;
  const north = card._serverCfg.spaces[0].rooms.find((room) => room.id === 'north-west');
  const south = card._serverCfg.spaces[0].rooms.find((room) => room.id === 'south-west');
  result.applyUsesOneAtomicWrite = sent.filter((type) => type === 'houseplan/plan/optimize').length === 1;
  const samePoint = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  result.applyMovesBothOwnersToExactAxis = north.poly[1][1] === north.poly[2][1]
    && south.poly.some((point) => samePoint(point, north.poly[1]))
    && south.poly.some((point) => samePoint(point, north.poly[2]));
  result.applyRekeysWall = card._serverCfg.spaces[0].walls.some((wall) => (
    wall.a[1] === wall.b[1] && wall.key.endsWith('@0.0000')
  ));

  await card._loadFromServer();
  await card.updateComplete;
  card._openAlignDialog();
  await card.updateComplete;
  result.reloadIsIdempotent = card._alignDialog.report.wallsStraightened === 0;
  card._alignDialog = null;

  await card._undoPlanOptimization();
  await card.updateComplete;
  result.undoRestoresExactGeometry = JSON.stringify(card._serverCfg.spaces)
    === JSON.stringify(original.spaces);
  result.undoServerSnapshotIsByteExact = JSON.stringify(serverConfig) === JSON.stringify(original);
  result.undoIsOneDeep = card._canOptimizeUndo === false;
  return result;
}, space);

await finish(browser, checkAll(out));
