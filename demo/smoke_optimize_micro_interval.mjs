// #198: explicit Optimize removes only a proven isolated wall-thickness
// micro-interval. Exercise the production bundle's Preview → Apply → Undo flow.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 900, height: 820 });
const out = await page.evaluate(async () => {
  const result = {};
  const card = window.__card;
  const S = 1 / 240;
  const wallKey = (a, b) => {
    const q = (value) => Math.round(value / S) * S;
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const length = Math.hypot(dx, dy) || 1;
    dx /= length; dy /= length;
    if (dx < -1e-12 || (Math.abs(dx) <= 1e-12 && dy < 0)) { dx = -dx; dy = -dy; }
    let angle = Math.atan2(dy, dx);
    if (angle < 0) angle += Math.PI;
    const bucket = Math.round(angle * 1800) / 1800;
    return `${q((a[0] + b[0]) / 2).toFixed(6)},${q((a[1] + b[1]) / 2).toFixed(6)}@${bucket.toFixed(4)}`;
  };
  const entry = (a, b, cm) => ({ key: wallKey(a, b), a, b, cm });
  const y = 0.345833333, canonicalY = 83 / 240;
  const split = 0.8875, microEnd = split + 0.001381904;
  const original = {
    model_version: 7,
    spaces: [{
      id: 'micro', title: 'Micro wall', view_box: [0, 0, 1, 1], cell_cm: 5,
      rooms: [
        { id: 'room', name: 'Room', poly: [[0.8, y], [0.95, y], [0.95, 0.5], [0.8, 0.5]] },
        { id: 'branch', name: 'Branch', poly: [
          [0.845833333, 0.245833333], [split, 0.245833333],
          [split, y], [0.845833333, y],
        ] },
      ],
      walls: [
        entry([0.8, y], [split, y], 22),
        entry([split, y], [microEnd, y], 15),
        entry([microEnd, y], [0.95, y], 22),
      ],
    }],
    markers: [], settings: {},
  };
  const clone = (value) => JSON.parse(JSON.stringify(value));
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
  card._modelCache = null; card._frame = null; card._space = 'micro';
  card.requestUpdate(); await card.updateComplete;

  card._openAlignDialog(); await card.updateComplete;
  const preview = card._alignDialog;
  result.previewOffersChange = !!preview?.changed
    && preview.report.canonicalized === 1 && preview.report.wallsMerged === 2
    && preview.config.spaces[0].walls.length === 1
    && preview.config.spaces[0].walls[0].cm === 22;
  result.previewDoesNotWrite = sent.length === 0
    && JSON.stringify(card._serverCfg) === JSON.stringify(original);
  result.previewIsVisible = !!card.renderRoot.querySelector('hp-dialog .alignmsg');

  card._alignDialog = null; await card.updateComplete;
  result.cancelDoesNotWrite = sent.length === 0
    && JSON.stringify(card._serverCfg) === JSON.stringify(original);

  card._openAlignDialog(); await card.updateComplete;
  await card._runAlignToGrid(); await card.updateComplete;
  const appliedWalls = card._serverCfg.spaces[0].walls;
  result.applyUsesOneAtomicWrite = sent.filter((type) => type === 'houseplan/plan/optimize').length === 1;
  result.applyStoresOneUniformRun = appliedWalls.length === 1 && appliedWalls[0].cm === 22
    && JSON.stringify(appliedWalls[0].a) === JSON.stringify([0.8, canonicalY])
    && JSON.stringify(appliedWalls[0].b) === JSON.stringify([0.95, canonicalY]);
  result.applyEnablesUndo = card._canOptimizeUndo === true;

  await card._loadFromServer(); await card.updateComplete;
  const reloadedWalls = card._serverCfg.spaces[0].walls;
  result.reloadKeepsCanonicalRun = reloadedWalls.length === 1 && reloadedWalls[0].cm === 22
    && JSON.stringify(reloadedWalls[0].a) === JSON.stringify([0.8, canonicalY])
    && JSON.stringify(reloadedWalls[0].b) === JSON.stringify([0.95, canonicalY]);

  await card._undoPlanOptimization(); await card.updateComplete;
  result.undoUsesServerSnapshot = sent.filter((type) => type === 'houseplan/plan/optimize_undo').length === 1;
  result.undoRestoresExactEntries = JSON.stringify(card._serverCfg.spaces[0].walls)
    === JSON.stringify(original.spaces[0].walls);
  result.undoIsOneDeep = card._canOptimizeUndo === false;
  return result;
});

await finish(browser, checkAll(out));
