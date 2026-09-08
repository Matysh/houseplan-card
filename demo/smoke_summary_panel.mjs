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
  await new Promise((resolve) => requestAnimationFrame(resolve));
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
const settings = await page.evaluate(() => {
  const card = window.__card;
  const root = card.shadowRoot || card.renderRoot;
  const editor = root.querySelector('hp-dialog .summary-editor');
  const actionTargets = [...editor.querySelectorAll(
    "button, input:not([type='checkbox']), select, .summary-drag",
  )];
  const switchTargets = [...editor.querySelectorAll('.summary-switch')];
  const cancel = [...root.querySelectorAll('hp-dialog [slot="footer"] button')]
    .find((button) => button.textContent.trim() === card._t('btn.cancel'));
  const result = {
    editorLoadedOnDemand: !!editor,
    sharedAndLocalControls: !!editor?.querySelector('input[type="text"]')
      && editor.querySelectorAll('input[type="range"]').length === 2
      && !!editor.querySelector('input[type="checkbox"]'),
    entityPickerSeesHass: (editor?.querySelector('.summary-source')?.options.length || 0)
      > 3,
    editorTouchTargets: [...actionTargets, ...switchTargets].every((target) => {
      const box = target.getBoundingClientRect();
      return box.width >= 44 && box.height >= 44;
    }),
  };
  cancel?.click();
  return result;
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
          serverConfig.spaces[0] = { ...serverConfig.spaces[0], title: 'Concurrent title kept' };
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
  await card.updateComplete;
  return {
    lostAckClosesAsSuccess: firstClosed,
    recoveryAdoptsWholeConfig: recoveredConfig.spaces[0].title === 'Concurrent title kept'
      && recoveredConfig.settings.concurrent_guard_490 === 'kept',
    recoveryAdoptsRevision: recoveredRev === writes[0].expected_rev + 2,
    nextWriteUsesRecoveredRevision: secondWrite?.expected_rev === recoveredRev,
    nextWritePreservesConcurrentChange: secondWrite?.config?.spaces?.[0]?.title === 'Concurrent title kept'
      && secondWrite?.config?.settings?.concurrent_guard_490 === 'kept',
    trueConflictStaysOpen,
  };
});

checkAll({
  ...initial,
  bottomOnTallStage,
  smallCardKeepsLocalIntent,
  ...settings,
  summaryDependencyCaptured: liveSetup,
  ...liveState,
  ...recovery,
});
await finish(browser);
