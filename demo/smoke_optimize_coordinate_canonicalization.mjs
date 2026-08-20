// #223: explicit Optimize removes stored ULP noise without claiming a visible
// move. Exercise the production bundle's Preview → Cancel → Apply → Undo flow.
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
  const isCanonical = (value) => value === Math.round(value / S) * S;
  let serverConfig = clone(original), serverLayout = {}, backup = null;
  let lastToast = '';
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
        return { config: clone(serverConfig), rev: 3, can_write: true };
      if (message.type === 'houseplan/layout/get')
        return { layout: clone(serverLayout), rev: 3 };
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
    && preview.report.coordsCanonicalized > 0
    && preview.report.maxShift === 0
    && preview.report.maxShiftCm === 0;
  result.previewNamesBothReportUnits = previewText.includes('spaces updated:')
    && previewText.includes('noisy coordinate values removed:');
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
  result.applyPreservesUnknownFields = card._serverCfg.spaces[0].future?.kept === true;
  result.toastExplainsZeroMoveCleanup = lastToast.includes('0 elements moved')
    && !lastToast.includes('0 records maintained');

  card._openAlignDialog(); await card.updateComplete;
  result.secondRunIsExactNoOp = card._alignDialog?.changed === false
    && card._alignDialog.report.coordsCanonicalized === 0
    && !card.renderRoot.querySelector('hp-dialog .btn.on');
  card._alignDialog = null; await card.updateComplete;

  await card._undoPlanOptimization(); await card.updateComplete;
  result.undoUsesServerSnapshot = sent.filter((type) => type === 'houseplan/plan/optimize_undo').length === 1;
  result.undoRestoresExactNoisyValues = JSON.stringify(card._serverCfg) === JSON.stringify(original);
  result.undoIsOneDeep = card._canOptimizeUndo === false;
  return result;
});

await finish(browser, checkAll(out));
