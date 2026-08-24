// #276: production-bundle Preview -> Apply -> reload -> one-shot Undo for an
// exact partition which duplicates one solid shared room wall and hosts a door.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 900, height: 820 });
const out = await page.evaluate(async () => {
  const result = {};
  const card = window.__card;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const sharedX = 0.5;
  const original = {
    model_version: 7,
    spaces: [{
      id: 'coincident', title: 'Coincident', view_box: [0, 0, 1, 1], cell_cm: 5,
      rooms: [
        { id: 'left', name: 'Left', area: null,
          poly: [[0, 0], [sharedX, 0], [sharedX, 1], [0, 1]] },
        { id: 'right', name: 'Right', area: null,
          poly: [[sharedX, 0], [1, 0], [1, 1], [sharedX, 1]] },
      ],
      walls: [{
        key: '500.000000,500.000000@1.5706',
        a: [sharedX, 0], b: [sharedX, 1], cm: 20,
      }],
      partitions: [{ id: 'redundant', a: [sharedX, 0], b: [sharedX, 1], cm: 20 }],
      openings: [{
        id: 'door', type: 'door', x: 0, y: 0, angle: 0, length: 0.2,
        contact: 'binary_sensor.test_door', lock: 'lock.test_door', flip_h: true,
        host: { kind: 'partition', id: 'redundant', t: 0.5 },
      }],
    }],
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
        serverConfig = clone(message.config); serverLayout = clone(message.layout);
        return { ok: true, config_rev: 2, layout_rev: 2, can_undo: true };
      }
      if (message.type === 'houseplan/plan/optimize_undo') {
        sent.push(message.type);
        serverConfig = clone(backup.config); serverLayout = clone(backup.layout);
        backup = null;
        return { ok: true, config_rev: 3, layout_rev: 3, can_undo: false };
      }
      if (message.type === 'houseplan/config/get')
        return { config: clone(serverConfig), rev: 3, can_write: true, can_optimize_undo: !!backup };
      if (message.type === 'houseplan/layout/get')
        return { layout: clone(serverLayout), rev: 3 };
      return baseCall(message);
    },
  };

  card._serverCfg = clone(original); card._layout = {};
  card._modelCache = null; card._frame = null; card._space = 'coincident';
  card.requestUpdate(); await card.updateComplete;

  card._openAlignDialog(); await card.updateComplete;
  const preview = card._alignDialog;
  result.previewIsExact = !!preview?.changed && preview.preflight?.ok === true
    && preview.report.partitionsReconciled === 1
    && preview.report.openingsRehosted === 1
    && preview.config.spaces[0].partitions == null
    && preview.config.spaces[0].openings[0].host == null;
  result.previewDoesNotWrite = sent.length === 0
    && JSON.stringify(card._serverCfg) === JSON.stringify(original);
  result.reportRendersBothCounters = card.renderRoot.querySelectorAll('hp-dialog .alignmsg').length >= 2;

  await card._runAlignToGrid(); await card.updateComplete;
  const applied = card._serverCfg.spaces[0];
  result.applyUsesOneAtomicWrite = sent.filter((type) => type === 'houseplan/plan/optimize').length === 1;
  result.applyKeepsOpeningFields = applied.partitions == null
    && applied.openings[0].host == null
    && applied.openings[0].id === 'door'
    && applied.openings[0].contact === 'binary_sensor.test_door'
    && applied.openings[0].lock === 'lock.test_door'
    && applied.openings[0].flip_h === true
    && Math.abs(applied.openings[0].x - sharedX) < 1e-9
    && Math.abs(applied.openings[0].y - 0.5) < 1e-9;
  result.applyEnablesUndo = card._canOptimizeUndo === true;

  await card._loadFromServer(); await card.updateComplete;
  result.reloadKeepsCanonicalBody = card._serverCfg.spaces[0].partitions == null
    && card._serverCfg.spaces[0].openings[0].host == null;

  await card._undoPlanOptimization(); await card.updateComplete;
  result.undoRestoresHostedPartition = JSON.stringify(card._serverCfg.spaces[0].partitions)
      === JSON.stringify(original.spaces[0].partitions)
    && JSON.stringify(card._serverCfg.spaces[0].openings)
      === JSON.stringify(original.spaces[0].openings)
    && card._canOptimizeUndo === false;

  // Apply once more and prove the ordinary shared wall is no longer hidden
  // underneath an independent-wall blocker in the two wall tools.
  card._openAlignDialog(); await card.updateComplete;
  await card._runAlignToGrid(); await card.updateComplete;
  card._setMode('plan'); card._markup = true; card._tool = 'boundary';
  card._modelCache = null; card.requestUpdate(); await card.updateComplete;
  result.boundarySeesSharedWall = card._boundaryTargetAt([500, 500]).kind === 'shared';

  card._tool = 'wallthick';
  card._wallThickClick([500, 500]);
  result.thicknessToolSelectsCanonicalWall = !!card._wallDialog;
  card._wallDialog = { ...card._wallDialog, value: '10' };
  card._wallThickApply(false); await card.updateComplete;
  const finalSpace = card._serverCfg.spaces[0];
  result.thicknessChangesSingleBody = finalSpace.partitions == null
    && finalSpace.walls.length === 1 && finalSpace.walls[0].cm === 10
    && finalSpace.openings[0].host == null;
  return result;
});

await finish(browser, checkAll(out));
