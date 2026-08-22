// #199: the production bundle must fail closed before the Optimize WS write,
// keep one exact-candidate preflight result, and preserve the existing green
// Preview → Apply / no-op contract.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 920, height: 840 });
const out = await page.evaluate(async () => {
  const result = {};
  const card = window.__card;
  const clone = (value) => structuredClone(value);
  const noisy = [[
    [0.10000000000000002, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9],
  ]];
  const makeSpace = (id, title) => ({
    id, title, view_box: [0, 0, 1, 1], cell_cm: 5,
    rooms: noisy.map((poly, index) => ({ id: `room-${id || index}`, poly })),
  });
  const original = {
    model_version: 6,
    spaces: [
      makeSpace('alpha', 'Alpha'),
      makeSpace('beta', ''),
      makeSpace('', ''),
      makeSpace('unsafe', '<img id="preflight-injection" src=x>'),
    ],
    markers: [], settings: {},
  };
  const originalLayout = { marker: { s: 'alpha', x: 0.2, y: 0.2 } };
  const baseCall = card.hass.callWS.bind(card.hass);
  const sent = [];
  card.hass = {
    ...card.hass,
    callWS: async (message) => {
      if (message.type === 'houseplan/plan/optimize') {
        sent.push(clone(message));
        return { ok: true, config_rev: 42, layout_rev: 24, can_undo: true };
      }
      return baseCall(message);
    },
  };
  const setCandidate = (language = 'en') => {
    card._config = { ...card._config, language };
    card._serverCfg = clone(original);
    card._layout = clone(originalLayout);
    card._cfgRev = 10;
    card._layoutRev = 11;
    card._canOptimizeUndo = false;
    card._undoKind = null;
    card._modelCache = null;
    card._frame = null;
    card._space = 'alpha';
  };
  const originalCheck = card._checkOptimizeGeometry.bind(card);
  let checks = 0;
  let forceRed = true;
  card._checkOptimizeGeometry = (config) => {
    checks++;
    const checked = originalCheck(config);
    if (!forceRed) return checked;
    const failures = checked.spaces.map((space) => ({
      ...space, status: 'failed', reason: 'wall-null',
    }));
    return { ...checked, spaces: failures, failures, ok: false };
  };

  setCandidate('en');
  const beforeRed = {
    config: clone(card._serverCfg), layout: clone(card._layout),
    configRev: card._cfgRev, layoutRev: card._layoutRev,
    canUndo: card._canOptimizeUndo, undoKind: card._undoKind,
  };
  card._openAlignDialog(); await card.updateComplete;
  const englishText = card.renderRoot.querySelector('hp-dialog .body')?.textContent || '';
  result.englishFailureNamesThreeAndCountsRest = englishText.includes(
    'Could not safely verify the geometry of the following spaces: Alpha, beta, Space 3, and 1 more.',
  );
  result.englishFailureHasExactHint = englishText.includes(
    'Plans were not changed. Update House Plan and try again. If the error persists, attach a space export to the bug report.',
  );
  result.failureTitleIsEscapedAndFourthNameHidden =
    !card.renderRoot.querySelector('#preflight-injection')
    && !englishText.includes('<img') && !englishText.includes('unsafe');
  result.failureRendersNoApply = !card.renderRoot.querySelector('hp-dialog .btn.on');
  await card._runAlignToGrid(); await card.updateComplete;
  result.redPreflightMakesZeroWrites = sent.length === 0;
  result.redPreflightPreservesAllState =
    JSON.stringify(card._serverCfg) === JSON.stringify(beforeRed.config)
    && JSON.stringify(card._layout) === JSON.stringify(beforeRed.layout)
    && card._cfgRev === beforeRed.configRev && card._layoutRev === beforeRed.layoutRev
    && card._canOptimizeUndo === beforeRed.canUndo && card._undoKind === beforeRed.undoKind;

  // A green preview whose exact candidate changes must be checked again. A
  // newly red result replaces the dialog and still cannot write.
  forceRed = false;
  setCandidate('en');
  card._openAlignDialog(); await card.updateComplete;
  const checksAfterGreenPreview = checks;
  result.greenPreviewOffersApply = !!card.renderRoot.querySelector('hp-dialog .btn.on');
  card._alignDialog.config.spaces[0].title = 'Changed after preview';
  forceRed = true;
  await card._runAlignToGrid(); await card.updateComplete;
  result.changedFingerprintRechecks = checks === checksAfterGreenPreview + 1;
  result.changedFingerprintFailsClosed = sent.length === 0
    && !card._alignDialog.preflight.ok
    && !card.renderRoot.querySelector('hp-dialog .btn.on');

  // An unchanged green candidate reuses the preview result, performs exactly
  // one existing atomic endpoint call, and keeps the existing Undo contract.
  forceRed = false;
  setCandidate('en');
  const callsBeforeGreen = sent.length;
  card._openAlignDialog(); await card.updateComplete;
  const checksBeforeApply = checks;
  const previewCandidate = clone(card._alignDialog.config);
  await card._runAlignToGrid(); await card.updateComplete;
  result.unchangedApplyDoesNotRecheck = checks === checksBeforeApply;
  result.greenApplyMakesOneAtomicWrite = sent.length === callsBeforeGreen + 1
    && JSON.stringify(sent.at(-1).config) === JSON.stringify(previewCandidate);
  result.greenApplyPreservesUndoContract = card._canOptimizeUndo === true
    && card._undoKind === 'optimize' && card._cfgRev === 42 && card._layoutRev === 24;

  // The just-written candidate is now a no-op: it skips the geometry pass and
  // retains the established message/absence of Apply.
  const checksBeforeNoOp = checks;
  card._openAlignDialog(); await card.updateComplete;
  const noOpText = card.renderRoot.querySelector('hp-dialog .body')?.textContent || '';
  result.noOpSkipsPreflight = checks === checksBeforeNoOp
    && card._alignDialog.preflight === null;
  result.noOpKeepsExistingUi = noOpText.includes(
    'All plans already use the current optimized data model.',
  ) && !card.renderRoot.querySelector('hp-dialog .btn.on');
  card._alignDialog = null; await card.updateComplete;

  // The same bounded copy and fallback/count policy is localized in Russian.
  forceRed = true;
  setCandidate('ru');
  card._openAlignDialog(); await card.updateComplete;
  const russianText = card.renderRoot.querySelector('hp-dialog .body')?.textContent || '';
  result.russianFailureHasExactCopy = russianText.includes(
    'Не удалось безопасно проверить геометрию следующих пространств: Alpha, beta, Пространство 3 и ещё 1.',
  ) && russianText.includes(
    'Планы не изменены. Обновите House Plan и повторите. Если ошибка останется, приложите экспорт пространства к отчёту об ошибке.',
  );
  card.renderRoot.querySelector('hp-dialog')?.dispatchEvent(new CustomEvent(
    'hp-close', { bubbles: true, composed: true },
  ));
  await card.updateComplete;
  result.failureCloseDoesNotWrite = card._alignDialog === null && sent.length === callsBeforeGreen + 1;
  return result;
});

await finish(browser, checkAll(out));
