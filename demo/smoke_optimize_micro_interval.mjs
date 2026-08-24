// #198/#299: explicit Optimize removes only a proven isolated wall-thickness
// micro-interval without compacting across a physical wall-owner role boundary.
// Exercise the production bundle's Preview → Apply → Reload → Undo flow.
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
  const expectedRuns = [
    [0.8, 203 / 240],
    [203 / 240, 213 / 240],
    [213 / 240, 0.95],
  ];
  const hasRoleAwareCanonicalRuns = (walls) => {
    if (walls.length !== expectedRuns.length || walls.some((wall) => wall.cm !== 22)) return false;
    const runs = walls.map((wall) => {
      if (!wall.a || !wall.b || wall.a[1] !== canonicalY || wall.b[1] !== canonicalY) return null;
      return [Math.min(wall.a[0], wall.b[0]), Math.max(wall.a[0], wall.b[0])];
    }).filter(Boolean).sort((left, right) => left[0] - right[0]);
    return JSON.stringify(runs) === JSON.stringify(expectedRuns);
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
  result.previewOffersRoleAwareChange = !!preview?.changed
    && preview.report.canonicalized === 1 && preview.report.wallsMerged === 0
    && hasRoleAwareCanonicalRuns(preview.config.spaces[0].walls);
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
  result.applyStoresRoleAwareRuns = hasRoleAwareCanonicalRuns(appliedWalls);
  result.applyEnablesUndo = card._canOptimizeUndo === true;

  await card._loadFromServer(); await card.updateComplete;
  const reloadedWalls = card._serverCfg.spaces[0].walls;
  result.reloadKeepsRoleAwareRuns = hasRoleAwareCanonicalRuns(reloadedWalls);

  await card._undoPlanOptimization(); await card.updateComplete;
  result.undoUsesServerSnapshot = sent.filter((type) => type === 'houseplan/plan/optimize_undo').length === 1;
  result.undoRestoresExactEntries = JSON.stringify(card._serverCfg.spaces[0].walls)
    === JSON.stringify(original.spaces[0].walls);
  result.undoIsOneDeep = card._canOptimizeUndo === false;
  return result;
});

await finish(browser, checkAll(out));
