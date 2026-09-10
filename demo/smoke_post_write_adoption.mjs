// #500 AC4: the four post-write adoptions — space/delete from both runtimes,
// Optimize Undo and Import apply — pass the same backdrop readiness gate as a
// reload before the structure is replaced, and take config/layout revisions
// from the re-read `config/get`/`layout/get`, never from the write reply.
// A second client changes `plan_url` between our write and the re-read; the
// card must prepare THAT backdrop first and end on the re-read revision.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch();
const out = await page.evaluate(async () => {
  const card = window.__card;
  await card._ensureOnboardingRuntime();
  const editor = card._editorRuntime;
  const onboarding = card._onboardingRuntime;
  const adoption = card._adoption;
  const result = {};

  const space = (id, title, planUrl) => ({
    id, title, plan_url: planUrl, view_box: [0, 0, 1, 1], rooms: [], wall_segments: [], partitions: [],
  });
  const freshConfig = () => ({
    model_version: 9,
    spaces: [space('alpha', 'Alpha', '/local/alpha.png'), space('beta', 'Beta', '/local/beta.png')],
    markers: [],
    settings: {},
  });

  const order = [];
  const toasts = [];
  let retries = 0;
  let assetReady = true;
  const originalPrepareImage = card._signer.prepareImage.bind(card._signer);
  card._signer.prepareImage = async (_hass, href) => { order.push(`prepare:${href}`); return assetReady; };
  card._scheduleLoadRetry = () => { retries += 1; };
  const originalAdoptResponses = adoption.adoptResponses.bind(adoption);
  adoption.adoptResponses = (...args) => { order.push('adopt'); return originalAdoptResponses(...args); };
  card._confirmDanger = async () => true;
  card._showToast = (message) => { toasts.push(message); };

  // Fake server: our write bumps both revisions; a concurrent client then
  // swaps the backdrop and bumps the config revision again before the re-read.
  let server;
  let concurrentHref = '';
  const concurrentWrite = () => {
    for (const s of server.config.spaces) s.plan_url = concurrentHref;
    server.cfgRev += 1;
  };
  const originalHass = card.hass;
  card.hass = {
    ...originalHass,
    callWS: async (message) => {
      switch (message.type) {
        case 'houseplan/space/delete': {
          server.config.spaces = server.config.spaces.filter((s) => s.id !== message.space_id);
          server.cfgRev += 1; server.layRev += 1;
          const reply = { config_rev: server.cfgRev, layout_rev: server.layRev };
          concurrentWrite();
          return reply;
        }
        case 'houseplan/plan/optimize_undo': {
          server.cfgRev += 1; server.layRev += 1;
          const reply = { config_rev: server.cfgRev, layout_rev: server.layRev };
          concurrentWrite();
          return reply;
        }
        case 'houseplan/import/apply': {
          server.cfgRev += 1; server.layRev += 1;
          const reply = { kind: 'full', config_rev: server.cfgRev, layout_rev: server.layRev, counts: { spaces: 2, rooms: 0, markers: 0 } };
          concurrentWrite();
          return reply;
        }
        case 'houseplan/config/get':
          return { config: structuredClone(server.config), rev: server.cfgRev, can_write: true };
        case 'houseplan/layout/get':
          return { layout: structuredClone(server.layout), rev: server.layRev };
        default:
          return {};
      }
    },
  };

  const reset = async (scenario) => {
    // Ревью r2 M1: отложенная запись предыдущего сценария иначе доживает до
    // следующего и флашится безусловным `if (pending) flush()` внутри
    // `_deleteSpace`; мок отвечает `{}` без `rev`, запасной путь «rev + 1»
    // двигает ревизию по ЧУЖОМУ телу, и отказная ветка выглядит принявшей.
    // Сценарии обязаны быть независимы — так же чистится smoke_danger_confirmation.
    card._saveConfigDebounced.cancel();
    card._persistLayout.cancel();
    server = { config: freshConfig(), layout: {}, cfgRev: 10, layRev: 20 };
    concurrentHref = `media-source://image/${scenario}-500`;
    adoption.restoreCached({ config: structuredClone(server.config), rev: 10, layout: {}, layout_rev: 20 });
    card._space = 'beta';
    card._spaceDialog = null;
    card._backupImportDialog = null;
    order.length = 0;
    toasts.length = 0;
    retries = 0;
    await card.updateComplete;
  };
  // Review r1 M1: a refused backdrop gate adopts nothing and skips the caller's
  // tail (no toast, no space switch, dialog released), exactly like every
  // reload path; the scheduled retry owns the rest.
  const refusedVerdict = (scenario, extra = {}) => {
    result[`${scenario}RefusedAdoptsNothing`] = card._cfgRev === 10 && card._layoutRev === 20
      && card._serverCfg.spaces.length === 2 && card._serverCfg.spaces.every((s) => s.plan_url !== concurrentHref);
    result[`${scenario}RefusedSchedulesRetry`] = retries === 1 && !order.includes('adopt');
    result[`${scenario}RefusedSkipsTail`] = toasts.length === 0 && card._space === 'beta';
    Object.assign(result, extra);
  };
  const verdict = (scenario, extra = {}) => {
    const prepared = order.indexOf(`prepare:${concurrentHref}`);
    const adopted = order.indexOf('adopt');
    result[`${scenario}PreparesConcurrentBackdropBeforeAdoption`] = prepared >= 0 && adopted > prepared;
    result[`${scenario}RevisionsFromReRead`] = card._cfgRev === server.cfgRev && card._layoutRev === server.layRev;
    result[`${scenario}AdoptsConcurrentBackdrop`] = card._serverCfg.spaces.every((s) => s.plan_url === concurrentHref);
    Object.assign(result, extra);
  };

  const spaceDialog = (spaceId) => ({
    mode: 'edit', spaceId, title: 'Beta', planUrl: null, planFile: null, source: 'draw',
    showBorders: true, showNames: true, zeroWallStyle: 'dashed', displayTouched: true,
    hideDecor: false, hideOpenings: false, roomColor: '#888888', roomOpacity: 1, bgColor: null,
    bgMode: null, northDeg: null, sunRays: null, fillMode: 'custom', customFill: null,
    glowEnabled: true, tempMin: 15, tempMax: 30, showLqi: true, cardFontScale: 1,
    labelTemp: true, labelHum: true, labelLqi: true, labelLight: true, cellCm: 5,
    busy: false, saved: [],
  });

  for (const [name, runtime] of [['onboardingDelete', onboarding], ['editorDelete', editor]]) {
    await reset(name);
    card._spaceDialog = spaceDialog('beta');
    await runtime._deleteSpace();
    // the write reply carried cfgRev 11; the concurrent client moved it to 12
    verdict(name, {
      [`${name}RevisionNotFromDeleteReply`]: card._cfgRev === 12 && server.cfgRev === 12,
      [`${name}LeavesDeletedSpace`]: card._space === 'alpha' && card._serverCfg.spaces.length === 1,
      [`${name}ClosesDialog`]: card._spaceDialog === null,
    });
  }

  await reset('optimizeUndo');
  card._canOptimizeUndo = true;
  card._undoKind = 'optimize';
  await editor._undoPlanOptimization();
  verdict('optimizeUndo', { optimizeUndoClearsUndo: card._canOptimizeUndo === false && card._undoKind === null });

  await reset('importApply');
  card._backupImportDialog = {
    filename: 'plan.json', size: 1, token: 'token-500', preview: { confirmation_required: false, counts: {} },
    expectedConfigRev: card._cfgRev, expectedLayoutRev: card._layoutRev,
    duplicatePolicy: 'skip', confirmMissing: false, busy: false, error: '',
  };
  const fixedFloor = !!card._hasFixedFloor;
  await editor._applyBackupImport();
  verdict('importApply', {
    importApplyClosesDialog: card._backupImportDialog === null,
    // today's rule, not its absence: a fixed-floor card re-selects through
    // _adoptInitialSpace, otherwise the previous space is kept
    importApplyKeepsSpaceRule: fixedFloor ? typeof card._space === 'string' && card._space.length > 0 : card._space === 'beta',
  });

  assetReady = false;
  for (const [name, runtime] of [['onboardingDelete', onboarding], ['editorDelete', editor]]) {
    await reset(`${name}-refused`);
    card._spaceDialog = spaceDialog('beta');
    await runtime._deleteSpace();
    refusedVerdict(name, { [`${name}RefusedReleasesDialog`]: card._spaceDialog?.busy === false });
  }
  await reset('optimizeUndo-refused');
  card._canOptimizeUndo = true;
  card._undoKind = 'optimize';
  await editor._undoPlanOptimization();
  refusedVerdict('optimizeUndo', { optimizeUndoRefusedKeepsUndoFlag: card._canOptimizeUndo === true && card._optimizeUndoBusy === false });
  await reset('importApply-refused');
  card._backupImportDialog = {
    filename: 'plan.json', size: 1, token: 'token-500', preview: { confirmation_required: false, counts: {} },
    expectedConfigRev: card._cfgRev, expectedLayoutRev: card._layoutRev,
    duplicatePolicy: 'skip', confirmMissing: false, busy: false, error: '',
  };
  await editor._applyBackupImport();
  refusedVerdict('importApply', { importApplyRefusedReleasesDialog: card._backupImportDialog?.busy === false });
  assetReady = true;

  card.hass = originalHass;
  card._signer.prepareImage = originalPrepareImage;
  delete card._scheduleLoadRetry;
  delete adoption.adoptResponses;
  await card.updateComplete;
  return result;
});
checkAll(out);
await finish(browser, out);
