import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 960, height: 640 });

await page.waitForFunction(() => {
  const card = window.__card;
  const root = card?.shadowRoot || card?.renderRoot;
  return !!root?.querySelector('.summary-control');
});

const initial = await page.evaluate(async () => {
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const stageBefore = root().querySelector('.stage').getBoundingClientRect();
  const buttons = root().querySelectorAll('.summary-control button');
  buttons[1].click();
  await card.updateComplete;
  // Static containment is measured after entry. The focused #505 smoke
  // separately samples opacity/translation and retained DOM during motion.
  await new Promise((resolve) => setTimeout(resolve, 320));
  const overlay = root().querySelector('.summary-overlay');
  const stageAfter = root().querySelector('.stage').getBoundingClientRect();
  const box = overlay?.getBoundingClientRect();
  return {
    splitControl: buttons.length === 2,
    togglePersistsIntent: buttons[1].getAttribute('aria-pressed') === 'true',
    rightOnWideStage: overlay?.classList.contains('right') === true,
    overlayDoesNotResizeStage: Math.abs(stageBefore.width - stageAfter.width) < 0.5
      && Math.abs(stageBefore.height - stageAfter.height) < 0.5,
    overlayInsideStage: !!box && box.left >= stageAfter.left - 1 && box.right <= stageAfter.right + 1
      && box.top >= stageAfter.top - 1 && box.bottom <= stageAfter.bottom + 1,
    readOnlySurface: !!overlay && overlay.querySelectorAll('button, input, select, textarea').length === 0,
    hasDefaultRows: (overlay?.querySelectorAll('.summary-value').length || 0) === 3,
  };
});

// The stage respects the viewport's available height; an inline 900px height
// cannot force it beyond the viewport. Keep the viewport landscape while
// giving the deliberately narrower stage enough real height to be portrait.
await page.setViewportSize({ width: 1200, height: 1000 });
await page.evaluate(() => {
  const card = window.__card;
  const root = card.shadowRoot || card.renderRoot;
  document.querySelector('#host').style.width = '560px';
  root.querySelector('.stage').style.height = '900px';
  card._summary.resized();
});
await page.waitForFunction(() => {
  const card = window.__card;
  const root = card?.shadowRoot || card?.renderRoot;
  return root?.querySelector('.summary-overlay')?.classList.contains('bottom') === true;
});
const bottomOnTallStage = await page.evaluate(() => {
  const card = window.__card;
  const root = card.shadowRoot || card.renderRoot;
  const stage = root.querySelector('.stage').getBoundingClientRect();
  const overlay = root.querySelector('.summary-overlay').getBoundingClientRect();
  return Math.abs((overlay.left + overlay.right) / 2 - (stage.left + stage.right) / 2) < 2;
});

await page.evaluate(() => {
  const card = window.__card;
  const root = card.shadowRoot || card.renderRoot;
  document.querySelector('#host').style.width = '270px';
  root.querySelector('.stage').style.height = '500px';
  card._summary.resized();
});
await page.waitForFunction(() => {
  const card = window.__card;
  const root = card?.shadowRoot || card?.renderRoot;
  return !root?.querySelector('.summary-overlay')
    && root?.querySelector('.summary-control button:last-child')?.getAttribute('aria-pressed') === 'true';
});
const smallCardKeepsLocalIntent = await page.evaluate(() => {
  const card = window.__card;
  const root = card.shadowRoot || card.renderRoot;
  const toggle = root.querySelector('.summary-control button:last-child');
  return toggle?.title === card._summary?.['t']?.('summary.hidden_small')
    || /space|мест|Platz|espace/i.test(toggle?.title || '');
});

await page.setViewportSize({ width: 960, height: 640 });
await page.evaluate(() => {
  const card = window.__card;
  const root = card.shadowRoot || card.renderRoot;
  document.querySelector('#host').style.width = '780px';
  root.querySelector('.stage').style.height = '640px';
  card._summary.resized();
});
await page.waitForFunction(() => {
  const card = window.__card;
  const root = card?.shadowRoot || card?.renderRoot;
  return root?.querySelector('.summary-overlay.right');
});

const pickerWitnessSetup = await page.evaluate(async () => {
  const card = window.__card;
  const states = {};
  for (let index = 0; index < 10_000; index++) {
    const id = `sensor.summary_${String(index).padStart(5, '0')}`;
    states[id] = {
      entity_id: id, state: String(index),
      attributes: { friendly_name: `Summary reading ${index}` },
    };
  }
  const blocks = Array.from({ length: 10 }, (_, blockIndex) => ({
    id: `block-${blockIndex}`, title: `Block ${blockIndex}`, visible: true,
    scope: { type: 'all' },
    values: Array.from({ length: 20 }, (_, valueIndex) => {
      const index = blockIndex * 20 + valueIndex;
      return {
        id: `value-${index}`, label: `Value ${index}`,
        source: { type: 'entity', entity_id: `sensor.summary_${String(index).padStart(5, '0')}` },
      };
    }),
  }));
  card._serverCfg = {
    ...card._serverCfg,
    settings: { ...(card._serverCfg.settings || {}), summary_panel: {
      version: 1, title: 'Picker witness', show_on_mobile: true, blocks,
    } },
  };
  card._settings = card._serverCfg.settings;
  card.hass = { ...card.hass, states };
  card.requestUpdate();
  await card.updateComplete;
  card._haSummaryPanelApi = 1;
  await card._summary.openDialog();
  await card.updateComplete;
  card._summary.dialog = null;
  card.requestUpdate();
  await card.updateComplete;
  const extras = [];
  for (let index = 0; index < 2; index++) {
    const extra = document.createElement('houseplan-card');
    extra.style.display = 'none';
    extra.hass = card.hass;
    extra.setConfig({ ...(card._config || {}), type: 'custom:houseplan-card' });
    document.body.append(extra);
    for (let attempt = 0; attempt < 100 && !extra._summary; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    extra._serverCfg = structuredClone(card._serverCfg);
    extra._settings = extra._serverCfg.settings;
    extra._haSummaryPanelApi = 1;
    extra._serverCanWrite = true;
    await extra._summary.openDialog();
    extra._summary.openSource('block-0', 'value-0');
    await extra.updateComplete;
    extras.push(extra);
  }
  window.__summaryWitnessExtras = extras;
  const cards = [card, ...extras];
  return {
    cards: cards.length,
    rows: blocks.reduce((sum, block) => sum + block.values.length, 0),
    states: Object.keys(states).length,
    everyCardHasFullIndex: cards.every((entry) => entry._summary.entityIndex?.entries.length === 10_000),
    extraCardsBoundOnePicker: extras.every((entry) => {
      const root = entry.shadowRoot || entry.renderRoot;
      return root.querySelectorAll('.summary-source-picker').length === 1
        && root.querySelectorAll('.summary-source-results button').length <= 104;
    }),
  };
});

await page.evaluate(() => {
  const card = window.__card;
  const root = card.shadowRoot || card.renderRoot;
  // The standalone harness has no backend capability handshake. Backend
  // validation is covered separately; advertise the supported API here so
  // this browser witness exercises the complete shared-settings form.
  card._haSummaryPanelApi = 1;
  root.querySelector('.summary-control button:first-child').click();
});
await page.waitForFunction(() => {
  const card = window.__card;
  const root = card?.shadowRoot || card?.renderRoot;
  return !!root?.querySelector('hp-dialog .summary-editor');
});
const settings = await page.evaluate(async () => {
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const editor = root().querySelector('hp-dialog .summary-editor');
  const actionTargets = [...editor.querySelectorAll(
    "button, input:not([type='checkbox']), select, .summary-drag",
  )];
  const switchTargets = [...editor.querySelectorAll('.summary-switch')];
  const source = editor.querySelector('.summary-source');
  const closedHasNoEntityOptions = editor.querySelectorAll('option[value^="entity:"]').length === 0;
  source.click();
  await card.updateComplete;
  const picker = root().querySelector('.summary-source-picker');
  const search = picker.querySelector('[data-summary-picker-search]');
  const inputSamples = [];
  for (let index = 0; index < 23; index++) {
    const started = performance.now();
    search.value = `Summary reading ${index % 10}`;
    search.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    await card.updateComplete;
    if (index >= 3) inputSamples.push(performance.now() - started);
  }
  inputSamples.sort((a, b) => a - b);
  const inputP95 = inputSamples[Math.ceil(inputSamples.length * .95) - 1];
  search.value = 'sensor.summary_09999';
  search.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  await card.updateComplete;
  const refreshedPicker = root().querySelector('.summary-source-picker');
  const oneActivePicker = root().querySelectorAll('.summary-source-picker').length === 1;
  const exact = [...refreshedPicker.querySelectorAll('.summary-source-results button')]
    .find((button) => button.textContent.includes('sensor.summary_09999'));
  const boundedPicker = refreshedPicker.querySelectorAll('.summary-source-results button').length <= 104;
  exact?.click();
  await card.updateComplete;
  const cancel = [...root().querySelectorAll('hp-dialog [slot="footer"] button')]
    .find((button) => button.textContent.trim() === card._t('btn.cancel'));
  const samples = [];
  for (let index = 0; index < 23; index++) {
    card._summary.dialog = null;
    const started = performance.now();
    await card._summary.openDialog();
    await card.updateComplete;
    if (index >= 3) samples.push(performance.now() - started);
  }
  samples.sort((a, b) => a - b);
  const openP95 = samples[Math.ceil(samples.length * .95) - 1];
  const result = {
    editorLoadedOnDemand: !!editor,
    sharedAndLocalControls: !!editor?.querySelector('#summary-panel-title')
      && !!editor.querySelector('input[data-summary-local-show]')
      && !!editor.querySelector('input[data-summary-mobile-show]'),
    obsoleteSizeControlsAbsent: editor.querySelectorAll(
      'input[type="range"], .summary-local-sizes, .summary-sizes-title, .summary-size-reset',
    ).length === 0,
    closedRowsHaveNoEntityOptions: closedHasNoEntityOptions,
    oneActivePicker,
    pickerClosesAfterSelection: root().querySelectorAll('.summary-source-picker').length === 0,
    boundedPicker,
    fullIndexReachableByExactSearch: !!exact,
    loadedFormOpenP95Under250ms: openP95 <= 250,
    pickerInputP95Under50ms: inputP95 <= 50,
    metrics: { openP95Ms: openP95, inputP95Ms: inputP95, samples: inputSamples.length },
    editorTouchTargets: [...actionTargets, ...switchTargets].every((target) => {
      const box = target.getBoundingClientRect();
      return box.width >= 44 && box.height >= 44;
    }),
  };
  cancel?.click();
  return result;
});

await page.evaluate(() => {
  for (const extra of window.__summaryWitnessExtras || []) extra.remove();
  window.__summaryWitnessExtras = [];
});

const indexInvalidation = await page.evaluate(async () => {
  const card = window.__card;
  const runtime = card._summary;
  await runtime.openDialog();
  await card.updateComplete;
  const initial = runtime.entityIndex.rebuilds;
  card.hass = { ...card.hass, states: {
    ...card.hass.states,
    'sensor.summary_00000': { ...card.hass.states['sensor.summary_00000'], state: 'changed' },
  } };
  await card.updateComplete;
  const afterValue = runtime.entityIndex.rebuilds;
  card.hass = { ...card.hass, states: {
    ...card.hass.states,
    'sensor.summary_added': {
      entity_id: 'sensor.summary_added', state: '1', attributes: { friendly_name: 'Added' },
    },
  } };
  await card.updateComplete;
  const afterAdd = runtime.entityIndex.rebuilds;
  card.hass = { ...card.hass, states: {
    ...card.hass.states,
    'sensor.summary_00001': {
      ...card.hass.states['sensor.summary_00001'], attributes: { friendly_name: 'Renamed' },
    },
  } };
  await card.updateComplete;
  const afterRename = runtime.entityIndex.rebuilds;
  runtime.dialog = null;
  card.requestUpdate();
  return {
    stateValueDoesNotRebuildIndex: afterValue === initial,
    addRebuildsIndexOnce: afterAdd === initial + 1,
    renameRebuildsIndexOnce: afterRename === afterAdd + 1,
    counts: { initial, afterValue, afterAdd, afterRename },
  };
});

const responsiveForm = async ({ width, language, dark, canWrite, kiosk }) => {
  await page.setViewportSize({ width, height: 760 });
  return page.evaluate(async ({ language, dark, canWrite, kiosk }) => {
    const card = window.__card;
    document.documentElement.style.fontSize = '200%';
    document.documentElement.toggleAttribute('dark', dark);
    card._config = { ...card._config, language, kiosk };
    card._serverCanWrite = canWrite;
    card._summary.updated();
    await card._summary.openDialog();
    await card.updateComplete;
    const root = card.shadowRoot || card.renderRoot;
    const editor = root.querySelector('hp-dialog .summary-editor');
    const footer = root.querySelector('hp-dialog [slot="footer"]');
    const editorBox = editor.getBoundingClientRect();
    const controls = [...editor.querySelectorAll(
      'button, input:not([type="checkbox"]), select, .summary-switch, .summary-drag',
    ), ...root.querySelectorAll('hp-dialog [slot="footer"] button')];
    const result = {
      noHorizontalOverflow: editor.scrollWidth <= editor.clientWidth + 1,
      controlsInsideViewport: controls.length >= 3 && controls.every((control) => {
        const box = control.getBoundingClientRect();
        return box.left >= -1 && box.right <= innerWidth + 1 && box.width >= 44 && box.height >= 44;
      }),
      footerReachable: !!footer && footer.getBoundingClientRect().left >= -1
        && footer.getBoundingClientRect().right <= innerWidth + 1,
      editorInsideViewport: editorBox.left >= -1 && editorBox.right <= innerWidth + 1,
      localOnlyMatchesRole: canWrite && !kiosk
        ? !editor.querySelector('.summary-local-hint') : !!editor.querySelector('.summary-local-hint'),
      bounds: { left: editorBox.left, right: editorBox.right, viewport: innerWidth },
    };
    card._summary.dialog = null;
    card.requestUpdate();
    return result;
  }, { language, dark, canWrite, kiosk });
};

const responsiveAdmin = await responsiveForm({
  width: 320, language: 'ru', dark: true, canWrite: true, kiosk: false,
});
const responsiveHousehold = await responsiveForm({
  width: 390, language: 'en', dark: false, canWrite: false, kiosk: false,
});
const responsiveKiosk = await responsiveForm({
  width: 320, language: 'ru', dark: true, canWrite: true, kiosk: true,
});
await page.setViewportSize({ width: 960, height: 640 });
await page.evaluate(async () => {
  const card = window.__card;
  document.documentElement.style.fontSize = '';
  document.documentElement.removeAttribute('dark');
  card._config = { ...card._config, language: 'en', kiosk: false };
  card._serverCanWrite = true;
  card._summary.updated();
  await card.updateComplete;
});

const liveSetup = await page.evaluate(async () => {
  const card = window.__card;
  const panel = {
    version: 1, title: 'Live summary', show_on_mobile: true,
    blocks: [{ id: 'live', title: 'Sensors', visible: true, scope: { type: 'all' }, values: [
      { id: 'summary-only', label: 'Summary only',
        source: { type: 'entity', entity_id: 'sensor.summary_only' } },
    ] }],
  };
  card._serverCfg = {
    ...card._serverCfg,
    settings: { ...(card._serverCfg.settings || {}), summary_panel: panel },
  };
  card.hass = {
    ...card.hass,
    states: {
      ...card.hass.states,
      'sensor.summary_only': {
        entity_id: 'sensor.summary_only', state: '111', attributes: { unit_of_measurement: 'ppm' },
      },
    },
  };
  card.requestUpdate();
  await card.updateComplete;
  return card._renderDeviceSnapshot?.entityIds.includes('sensor.summary_only') === true;
});
await page.waitForFunction(() => {
  const card = window.__card;
  const root = card.shadowRoot || card.renderRoot;
  return [...root.querySelectorAll('.summary-value strong')]
    .some((node) => node.textContent.trim() === '111 ppm');
});

const liveState = await page.evaluate(async () => {
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const value = () => root().querySelector('.summary-overlay .summary-value strong')
    ?.textContent.trim() || '';
  await new Promise((resolve) => setTimeout(resolve, 500));
  await card.updateComplete;
  const originalUpdated = card.updated.bind(card);
  let updateCount = 0;
  card.updated = (changed) => { updateCount++; return originalUpdated(changed); };
  const modelBefore = card._model;
  const epochBefore = card._cfgEpoch;
  const layoutBefore = card._layoutRev;
  const beforeUnrelated = updateCount;

  card.hass = {
    ...card.hass,
    states: {
      ...card.hass.states,
      'sensor.unrelated_490': { entity_id: 'sensor.unrelated_490', state: 'changed', attributes: {} },
    },
  };
  await new Promise((resolve) => setTimeout(resolve, 50));
  const unrelatedRenders = updateCount - beforeUnrelated;
  const beforeRelevant = updateCount;

  card.hass = {
    ...card.hass,
    states: {
      ...card.hass.states,
      'sensor.summary_only': {
        ...card.hass.states['sensor.summary_only'], state: '222',
      },
    },
  };
  await card.updateComplete;
  const changed = value();
  const relevantRenders = updateCount - beforeRelevant;

  card.hass = {
    ...card.hass,
    states: {
      ...card.hass.states,
      'sensor.summary_only': {
        ...card.hass.states['sensor.summary_only'], state: 'unavailable', attributes: {},
      },
    },
  };
  await card.updateComplete;
  const unavailable = value();

  const missingStates = { ...card.hass.states };
  delete missingStates['sensor.summary_only'];
  card.hass = { ...card.hass, states: missingStates };
  await card.updateComplete;
  const missing = value();

  card.hass = {
    ...card.hass,
    states: {
      ...card.hass.states,
      'sensor.summary_only': {
        entity_id: 'sensor.summary_only', state: '333', attributes: { unit_of_measurement: 'ppm' },
      },
    },
  };
  await card.updateComplete;
  const recovered = value();
  card.updated = originalUpdated;
  return {
    unrelatedTickSkipped: unrelatedRenders === 0,
    relevantTickRenderedOnce: relevantRenders === 1,
    valueUpdated: changed === '222 ppm',
    unavailableUpdated: unavailable === 'unavailable',
    missingUpdated: missing === card._summary.t('summary.unavailable'),
    recoveredUpdated: recovered === '333 ppm',
    stateTicksKeepGeometry: card._model === modelBefore && card._cfgEpoch === epochBefore
      && card._layoutRev === layoutBefore,
  };
});

const recovery = await page.evaluate(async () => {
  const card = window.__card;
  const runtime = card._summary;
  const originalHass = card.hass;
  const originalCallWS = originalHass.callWS;
  const originalPrepareImage = card._signer.prepareImage.bind(card._signer);
  const originalAdoptStructuralResponses = card._adoptStructuralResponses.bind(card);
  const recoveryOrder = [];
  const concurrentBackdrop = 'media-source://image/summary-recovery-490';
  card._signer.prepareImage = async (_hass, href) => {
    recoveryOrder.push(`prepare:${href}`);
    return true;
  };
  card._adoptStructuralResponses = (...args) => {
    recoveryOrder.push('adopt');
    return originalAdoptStructuralResponses(...args);
  };
  const writes = [];
  let serverConfig = structuredClone(card._serverCfg);
  let serverRev = card._cfgRev;
  let firstWrite = true;
  let rejectConflict = false;
  card.hass = {
    ...originalHass,
    callWS: async (message) => {
      if (message.type === 'houseplan/config/set') {
        writes.push(structuredClone(message));
        if (rejectConflict) throw Object.assign(new Error('synthetic conflict'), { code: 'conflict' });
        if (firstWrite) {
          firstWrite = false;
          serverConfig = structuredClone(message.config);
          serverConfig.spaces[0] = {
            ...serverConfig.spaces[0],
            title: 'Concurrent title kept',
            plan_url: concurrentBackdrop,
          };
          serverConfig.settings = { ...serverConfig.settings, concurrent_guard_490: 'kept' };
          serverRev = message.expected_rev + 2;
          throw new Error('synthetic lost ACK');
        }
        serverConfig = structuredClone(message.config);
        serverRev++;
        return { rev: serverRev };
      }
      if (message.type === 'houseplan/config/get') return {
        config: structuredClone(serverConfig), rev: serverRev,
        can_write: true, summary_panel_api: 1,
      };
      return originalCallWS(message);
    },
  };
  await card.updateComplete;

  await runtime.openDialog();
  runtime.dialog.draft.title = 'Saved despite lost ACK';
  await runtime.saveDialog();
  const recoveredConfig = card._serverCfg;
  const recoveredRev = card._cfgRev;
  const firstClosed = runtime.dialog === null;

  await runtime.openDialog();
  runtime.dialog.draft.title = 'Second summary write';
  await runtime.saveDialog();
  const secondWrite = writes[1];

  rejectConflict = true;
  await runtime.openDialog();
  runtime.dialog.draft.title = 'Must remain a conflict';
  await runtime.saveDialog();
  const trueConflictStaysOpen = runtime.dialog?.conflict === true
    && !!runtime.dialog.error
    && card._serverCfg.settings.summary_panel.title === 'Second summary write';
  runtime.dialog = null;
  card.hass = { ...card.hass, callWS: originalCallWS };
  card._signer.prepareImage = originalPrepareImage;
  card._adoptStructuralResponses = originalAdoptStructuralResponses;
  await card.updateComplete;
  return {
    lostAckClosesAsSuccess: firstClosed,
    recoveryAdoptsWholeConfig: recoveredConfig.spaces[0].title === 'Concurrent title kept'
      && recoveredConfig.spaces[0].plan_url === concurrentBackdrop
      && recoveredConfig.settings.concurrent_guard_490 === 'kept',
    recoveryPreparesBackdropBeforeAdoption:
      recoveryOrder.indexOf(`prepare:${concurrentBackdrop}`) >= 0
      && recoveryOrder.indexOf('adopt') > recoveryOrder.indexOf(`prepare:${concurrentBackdrop}`),
    recoveryAdoptsRevision: recoveredRev === writes[0].expected_rev + 2,
    nextWriteUsesRecoveredRevision: secondWrite?.expected_rev === recoveredRev,
    nextWritePreservesConcurrentChange: secondWrite?.config?.spaces?.[0]?.title === 'Concurrent title kept'
      && secondWrite?.config?.spaces?.[0]?.plan_url === concurrentBackdrop
      && secondWrite?.config?.settings?.concurrent_guard_490 === 'kept',
    trueConflictStaysOpen,
  };
});

const { metrics: pickerMetrics, ...settingsChecks } = settings;
const witness = {
  ...initial,
  bottomOnTallStage,
  smallCardKeepsLocalIntent,
  ...settingsChecks,
  pickerWitnessHas200RowsAnd10000States:
    pickerWitnessSetup.cards === 3 && pickerWitnessSetup.rows === 200
      && pickerWitnessSetup.states === 10_000 && pickerWitnessSetup.everyCardHasFullIndex
      && pickerWitnessSetup.extraCardsBoundOnePicker,
  stateValueDoesNotRebuildIndex: indexInvalidation.stateValueDoesNotRebuildIndex,
  addRebuildsIndexOnce: indexInvalidation.addRebuildsIndexOnce,
  renameRebuildsIndexOnce: indexInvalidation.renameRebuildsIndexOnce,
  responsiveAdmin: Object.entries(responsiveAdmin).filter(([key]) => key !== 'bounds').every(([, value]) => value),
  responsiveHousehold: Object.entries(responsiveHousehold).filter(([key]) => key !== 'bounds').every(([, value]) => value),
  responsiveKiosk: Object.entries(responsiveKiosk).filter(([key]) => key !== 'bounds').every(([, value]) => value),
  summaryDependencyCaptured: liveSetup,
  ...liveState,
  ...recovery,
};
checkAll(witness);
await finish(browser, {
  ...witness,
  pickerTimings: pickerMetrics,
  pickerFixture: pickerWitnessSetup,
  indexRebuilds: indexInvalidation,
  responsive: { admin: responsiveAdmin, household: responsiveHousehold, kiosk: responsiveKiosk },
});
