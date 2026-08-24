// #223/#248/#291: explicit Optimize removes stored ULP noise once and stays a
// no-op after the lattice-aware backend write, event reload and cold reload.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 920, height: 840 });
const out = await page.evaluate(async () => {
  const result = {};
  const card = window.__card;
  const S = 1 / 240;
  const noisyFloor = [
    [[0.46666666666666673, 0.7083333333333334], [0.6125, 0.9],
      [0.4666666666666667, 1], [0.46666666666666673, 0.9]],
    [[0.1625, 0.3], [0.3458333333333333, 0],
      [0.46666666666666673, 1], [0.3458333333333333, 1]],
    [[0.7, 0], [0.8, 0], [0.8, 0.7083333333333334], [0.7, 0.7083333333333334]],
    [[0.7, 0.7083333333333335], [0.8, 0.7083333333333335], [0.8, 1], [0.7, 1]],
    [[0.85, 0], [0.9, 0], [0.9, 0.4], [0.85, 0.4]],
    [[0.85, 0.5], [0.9, 0.5], [0.9, 1], [0.85, 1]],
  ];
  const original = {
    model_version: 6,
    spaces: [{
      id: 'noisy', title: 'Noisy floor', view_box: [0, 0, 1, 1], cell_cm: 5,
      rooms: noisyFloor.map((poly, index) => ({ id: `room-${index}`, poly })),
      future: { kept: true },
    }],
    markers: [], settings: {},
  };
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const canonicalScalar = (value) => {
    const sign = value < 0 || Object.is(value, -0) ? -1 : 1;
    const result = sign * (Math.floor(Math.abs(value) * 1e9 + 0.5) / 1e9);
    return result === 0 ? 0 : result;
  };
  const canonicalCoordinate = (value) => {
    const scaled = value * 240;
    const nearest = Math.round(scaled);
    if (Math.abs(scaled - nearest) < 1e-4) return nearest / 240 || 0;
    return canonicalScalar(value);
  };
  const canonicalConfig = (source) => {
    const value = clone(source);
    for (const space of value.spaces || []) {
      for (const room of space.rooms || []) {
        if (room.poly) room.poly = room.poly.map(([x, y]) => [
          canonicalCoordinate(x), canonicalCoordinate(y),
        ]);
      }
    }
    return value;
  };
  const canonicalLayout = (source) => Object.fromEntries(Object.entries(clone(source))
    .map(([id, pos]) => [id, {
      ...pos, x: canonicalCoordinate(pos.x), y: canonicalCoordinate(pos.y),
    }]));
  const isCanonical = (value) => value === canonicalCoordinate(value);
  let serverConfig = clone(original), serverLayout = {}, backup = null;
  let configRev = 1, layoutRev = 1;
  let lastToast = '';
  const sent = [];
  const baseCall = card.hass.callWS.bind(card.hass);
  card.hass = {
    ...card.hass,
    callWS: async (message) => {
      if (message.type === 'houseplan/plan/optimize') {
        sent.push(message.type);
        backup = {
          config: canonicalConfig(serverConfig), layout: canonicalLayout(serverLayout),
        };
        serverConfig = canonicalConfig(message.config);
        serverLayout = canonicalLayout(message.layout);
        configRev++; layoutRev++;
        return { ok: true, config_rev: configRev, layout_rev: layoutRev, can_undo: true };
      }
      if (message.type === 'houseplan/plan/optimize_undo') {
        sent.push(message.type);
        serverConfig = clone(backup.config); serverLayout = clone(backup.layout);
        configRev++; layoutRev++;
        return { ok: true, config_rev: configRev, layout_rev: layoutRev, can_undo: false };
      }
      if (message.type === 'houseplan/config/get')
        return {
          config: clone(serverConfig), rev: configRev, can_write: true,
          can_optimize_undo: !!backup, undo_kind: backup ? 'optimize' : null,
        };
      if (message.type === 'houseplan/layout/get')
        return { layout: clone(serverLayout), rev: layoutRev };
      return baseCall(message);
    },
  };
  const baseToast = card._showToast.bind(card);
  card._showToast = (message) => { lastToast = message; baseToast(message); };
  card._config = { ...card._config, language: 'en' };
  card._serverCfg = clone(original); card._layout = {};
  card._modelCache = null; card._frame = null; card._space = 'noisy';
  card.requestUpdate(); await card.updateComplete;

  card._openAlignDialog(); await card.updateComplete;
  const preview = card._alignDialog;
  const previewText = card.renderRoot.querySelector('hp-dialog .body')?.textContent || '';
  result.previewOffersInvisibleCleanup = !!preview?.changed
    && preview.report.moved === 0
    && preview.report.coordsCanonicalized === 0
    && preview.report.latticeCoordinatesCanonicalized > 0
    && preview.report.maxShift === 0
    && preview.report.maxShiftCm === 0
    && preview.report.latticeMaxShiftCm > 0;
  result.previewNamesLatticeWorkAndSpace = previewText.includes(
    'Noisy coordinate values canonicalized:',
  ) && previewText.includes('maximum movement:')
    && previewText.includes('Noisy floor: coordinate values canonicalized:')
    && previewText.includes('off-grid values left unchanged: 0.');
  result.previewKeepsSubMillimetrePrecision = /maximum movement: [0-9.]+e-[0-9]+ cm/.test(
    previewText,
  );
  result.previewOffersApply = !!card.renderRoot.querySelector('hp-dialog .btn.on');
  result.previewDoesNotWrite = sent.length === 0
    && JSON.stringify(card._serverCfg) === JSON.stringify(original);

  card._alignDialog = null; await card.updateComplete;
  result.cancelDoesNotWrite = sent.length === 0
    && JSON.stringify(card._serverCfg) === JSON.stringify(original);

  card._openAlignDialog(); await card.updateComplete;
  await card._runAlignToGrid(); await card.updateComplete;
  result.applyUsesOneAtomicWrite = sent.filter((type) => type === 'houseplan/plan/optimize').length === 1;
  result.applyStoresOnlyCanonicalRoomCoordinates = card._serverCfg.spaces[0].rooms
    .every((room) => room.poly.every(([x, y]) => isCanonical(x) && isCanonical(y)));
  result.applyGeometryEqualsBackendTarget = card._serverCfg.model_version === serverConfig.model_version
    && JSON.stringify(card._serverCfg.spaces) === JSON.stringify(serverConfig.spaces);
  result.applyLayoutEqualsBackendTarget = JSON.stringify(card._layout)
    === JSON.stringify(serverLayout);
  result.applyPreservesUnknownFields = card._serverCfg.spaces[0].future?.kept === true;
  result.toastExplainsZeroMoveCleanup = lastToast.includes('0 elements moved')
    && !lastToast.includes('0 records maintained');

  await Promise.all([card._reloadConfigOnly(true), card._reloadLayoutOnly()]);
  card._openAlignDialog(); await card.updateComplete;
  result.serverEventReloadIsExactNoOp = card._alignDialog?.changed === false
    && card._alignDialog.report.latticeCoordinatesCanonicalized === 0
    && !card.renderRoot.querySelector('hp-dialog .btn.on');
  card._alignDialog = null; await card.updateComplete;

  card._serverCfg = null; card._layout = {};
  card._cfgContentFingerprint = ''; card._layoutContentFingerprint = '';
  card._loadOk = false;
  await card._loadFromServer();
  card._openAlignDialog(); await card.updateComplete;
  result.coldReloadIsExactNoOp = card._alignDialog?.changed === false
    && card._alignDialog.report.latticeCoordinatesCanonicalized === 0
    && !card.renderRoot.querySelector('hp-dialog .btn.on');
  card._alignDialog = null; await card.updateComplete;

  await card._undoPlanOptimization(); await card.updateComplete;
  result.undoUsesServerSnapshot = sent.filter((type) => type === 'houseplan/plan/optimize_undo').length === 1;
  const canonicalOriginal = canonicalConfig(original);
  result.undoRestoresCanonicalSnapshot = card._serverCfg.model_version === canonicalOriginal.model_version
    && JSON.stringify(card._serverCfg.spaces) === JSON.stringify(canonicalOriginal.spaces);
  result.undoIsOneDeep = card._canOptimizeUndo === false;
  return result;
});

await finish(browser, checkAll(out));
