// #1031: the real General Settings owner must allow OFF -> ON -> load without reopening.
import { launch, checkAll, finish } from './serve.mjs';
import { installHpTestOnPage } from './helpers/hp-test.mjs';

const { page, browser } = await launch({ width: 1120, height: 850 });
const result = await page.evaluate(async () => {
  const card = window.__card;
  const settled = async () => { card.requestUpdate(); await window.__hpTest.settled(); };
  const root = () => card.shadowRoot || card.renderRoot;
  root().querySelector('[data-hp="settings"]').click(); await settled();
  const dialog = root().querySelector('hp-dialog[data-kind="settings"]');
  dialog.querySelector('[data-section-target="zigbee"]').click(); await settled();
  const topology = dialog.querySelector('hp-zigbee-topology-settings');
  const wasSavedOff = topology.savedEnabled === false;
  topology.shadowRoot.querySelector('.hpf-toggle input[type="checkbox"]').click(); await settled();
  const update = [...topology.shadowRoot.querySelectorAll('button')]
    .find(button => button.textContent.toLowerCase().includes('update map'));
  return {
    originalSavedOffAndDraftOn: wasSavedOff && topology.value.enabled === true,
    updateAvailableWithoutReopening: !!update && update.disabled === false,
  };
});

checkAll(result);
const results = { ...result };
const record = (name, value) => { results[name] = value; checkAll({ [name]: value }); };

// Reset the fixture through a real page reload, not private product state rewrites.
const setup = async (options = {}) => {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__card?._booting === false);
  await installHpTestOnPage(page);
  await page.evaluate(async opts => {
    const card = window.__card, original = card.hass;
    const callWS = original.callWS.bind(original);
    const subscribe = original.connection.subscribeMessage.bind(original.connection);
    const rpc = window.__enableRpc = { saves: [], starts: 0, zha: 0, events: [], fail: !!opts.fail,
      hold: opts.hold !== false, enabled: false, revision: 0, callbacks: new Set() };
    original.connection.subscribeMessage = async (callback, message) => {
      if (message.type !== 'houseplan/zigbee/subscribe') return subscribe(callback, message);
      rpc.callbacks.add(callback);
      callback({ kind: 'reset', session_id: 'enable-1031', revision: rpc.revision, topics: [] });
      return () => rpc.callbacks.delete(callback);
    };
    card.hass = { ...original, language: opts.language || 'en', locale: { ...original.locale, language: opts.language || 'en' },
      callWS: async message => {
        if (message.type === 'houseplan/config/set') {
          rpc.saves.push(structuredClone(message)); rpc.events.push('save-start');
          if (rpc.hold) await new Promise(resolve => { rpc.release = resolve; });
          if (rpc.fail) {
            rpc.events.push('save-error');
            throw Object.assign(new Error('fixture-save-refused'), { code: opts.conflict ? 'conflict' : 'fixture-error' });
          }
          const accepted = await callWS(message);
          rpc.enabled = message.config.settings.zigbee_topology?.enabled === true;
          rpc.events.push('save-ack'); return accepted;
        }
        if (message.type === 'houseplan/config/get') return { ...await callWS(message), zigbee_scan_api: 1, zigbee_maps_api: 1 };
        if (message.type === 'houseplan/zigbee/start') {
          rpc.starts++;
          if (!rpc.enabled) throw new Error('scan-before-saved-enable');
          rpc.events.push('start');
          return { kind: 'state', session_id: 'enable-1031', revision: ++rpc.revision,
            provider: { topic: message.base_topic, job_id: `enable-${rpc.starts}`, phase: 'cancelled', elapsed_ms: 0 } };
        }
        if (message.type === 'zha/devices') { rpc.zha++; rpc.events.push('read-zha'); return []; }
        return callWS(message);
      } };
    (card.shadowRoot || card.renderRoot).querySelector('[data-hp="settings"]').click(); await window.__hpTest.settled();
    const dialog = (card.shadowRoot || card.renderRoot).querySelector('hp-dialog[data-kind="settings"]');
    dialog.querySelector('[data-section-target="zigbee"]').click(); await window.__hpTest.settled();
    const topology = dialog.querySelector('hp-zigbee-topology-settings');
    topology.shadowRoot.querySelector('.hpf-toggle input[type="checkbox"]').click();
    await window.__hpTest.settled();
    // A provider absent from the synthetic HA is offered through a collapsed manual section.
    for (const details of topology.shadowRoot.querySelectorAll('details')) {
      if (details.querySelector('.scan-row, .hpf-actions') && !details.open) details.querySelector('summary').click();
    }
    await window.__hpTest.settled();
  }, options);
};
const clickAction = async (provider = 'z2m', double = false) => page.evaluate(async ({ provider, double }) => {
  const topology = (window.__card.shadowRoot || window.__card.renderRoot).querySelector('hp-zigbee-topology-settings');
  const button = [...topology.shadowRoot.querySelectorAll('button')].find(button =>
    provider === 'zha' ? button.textContent.includes('ZHA') : /update map|обновить карту/i.test(button.textContent));
  button.click(); if (double) button.click();
  await window.__hpTest.settled();
}, { provider, double });
const release = async () => {
  await page.evaluate(() => { window.__enableRpc.hold = false; window.__enableRpc.release?.(); });
  await page.waitForFunction(() => !window.__card._settingsDialog?.busy);
  await page.evaluate(() => window.__hpTest.settled());
};
const stats = () => page.evaluate(() => {
  const card = window.__card, root = card.shadowRoot || card.renderRoot;
  const dialog = root.querySelector('hp-dialog[data-kind="settings"]');
  const topology = dialog?.querySelector('hp-zigbee-topology-settings');
  const rpc = window.__enableRpc;
  return { saves: rpc.saves.length, starts: rpc.starts, zha: rpc.zha, events: rpc.events,
    open: !!dialog && !!card._settingsDialog, busy: card._settingsDialog?.busy === true,
    mainSaveDisabled: dialog?.querySelector('[data-hp="dialog-confirm"]')?.disabled,
    componentButtonsDisabled: topology ? [...topology.shadowRoot.querySelectorAll('.scan-row button')].every(b => b.disabled) : false,
    explicitSave: topology?.shadowRoot.textContent.includes('Save settings and update map'),
    explainedAllChanges: topology?.shadowRoot.textContent.includes('Saves all changes in this dialog'),
    saved: rpc.saves.at(-1), draftMoon: card._settingsDialog?.moon, savedMoon: card._serverCfg.settings.moon === true,
  };
});

await setup();
record('toggleAndRepeatedRenderDoNotSaveOrLoad', await page.evaluate(async () => {
  window.__card.requestUpdate(); await window.__hpTest.settled();
  window.__card.requestUpdate(); await window.__hpTest.settled();
  const rpc = window.__enableRpc;
  return rpc.saves.length === 0 && rpc.starts === 0 && rpc.zha === 0;
}));
await clickAction('z2m', true);
let state = await stats();
record('oneSaveWhileDoubleClickWaitsForAck', state.saves === 1 && state.starts === 0 && state.busy && state.open);
record('topologyActionsDisabledWhileSaving', state.componentButtonsDisabled);
// During optimistic Save the label may already be ordinary, but the warning was explicit before activation.
await release();
await page.waitForFunction(() => window.__enableRpc.starts === 1);
state = await stats();
record('ackPrecedesOneScanWithRevision', state.events.join(',') === 'save-start,save-ack,start'
  && Number.isInteger(state.saved.expected_rev) && state.saved.config.settings.zigbee_topology.enabled === true);
record('successfulSaveKeepsSameDialogClean', state.open && !state.busy && state.mainSaveDisabled === true);
await page.evaluate(async () => {
  const root = window.__card.shadowRoot || window.__card.renderRoot;
  root.querySelector('hp-dialog[data-kind="settings"] [data-hp="dialog-cancel"]').click();
  await window.__hpTest.settled();
});
record('cleanCloseNeedsNoDiscardConfirmation', await page.evaluate(() => !window.__card._settingsDialog
  && !(window.__card.shadowRoot || window.__card.renderRoot).querySelector('hp-confirm hp-dialog')));

await setup({ fail: true });
state = await stats();
record('compositeActionWarnsBeforeSaving', state.explicitSave && state.explainedAllChanges);
await clickAction(); await release(); state = await stats();
record('failedSaveKeepsRetryableDraftWithoutScan', state.saves === 1 && state.starts === 0
  && state.open && !state.busy && state.mainSaveDisabled === false);
await page.evaluate(() => { window.__enableRpc.fail = false; });
await clickAction(); await page.waitForFunction(() => window.__enableRpc.starts === 1);
state = await stats();
record('explicitRetrySavesThenStarts', state.saves === 2 && state.starts === 1 && state.open);

await setup({ fail: true, conflict: true }); await clickAction(); await release(); state = await stats();
record('conflictCannotStartAndLeavesRetryableDraft', state.saves === 1 && state.starts === 0 && state.zha === 0
  && state.open && !state.busy && state.mainSaveDisabled === false);

await setup(); await clickAction('zha'); await release();
await page.waitForFunction(() => window.__enableRpc.zha === 1);
state = await stats();
record('zhaUsesSaveThenReadWithoutRadioScan', state.events.join(',') === 'save-start,save-ack,read-zha' && state.starts === 0 && state.open);

await setup(); await clickAction();
await page.evaluate(async () => {
  // Inject a concurrent form event while the ACK is held, without replacing private draft state.
  (window.__card.shadowRoot || window.__card.renderRoot).querySelector('#gs-moon').click();
  await window.__hpTest.settled();
});
await release(); await page.waitForFunction(() => window.__enableRpc.starts === 1); state = await stats();
record('laterEditsSurviveKeepOpenAndRemainDirty', state.open && state.mainSaveDisabled === false && state.draftMoon !== state.savedMoon);
await clickAction(); await page.waitForFunction(() => window.__enableRpc.starts === 2); state = await stats();
record('savedOnRefreshDoesNotCommitOtherDraftFields', state.saves === 1 && state.starts === 2 && state.draftMoon !== state.savedMoon);

await setup(); await clickAction();
await page.evaluate(async () => {
  const c = window.__card, root = c.shadowRoot || c.renderRoot;
  root.querySelector('hp-dialog[data-kind="settings"] [data-hp="dialog-cancel"]').click();
  await window.__hpTest.settled();
  root.querySelector('[data-hp="settings"]').click(); await window.__hpTest.settled();
});
await release(); state = await stats();
record('closedRequestCannotStartOrCloseReplacementDialog', state.starts === 0 && state.open && !state.busy);

await setup(); await clickAction();
await page.evaluate(async () => {
  const root = window.__card.shadowRoot || window.__card.renderRoot;
  const dialog = root.querySelector('hp-dialog[data-kind="settings"]');
  dialog.querySelector('[data-section-target="display"]').click(); await window.__hpTest.settled();
  dialog.querySelector('[data-section-target="zigbee"]').click(); await window.__hpTest.settled();
});
await release(); state = await stats();
record('leavingAndReturningToSectionRetiresPendingScan', state.starts === 0 && state.saves === 1 && state.open);

await setup();
await page.evaluate(async () => {
  const field = (window.__card.shadowRoot || window.__card.renderRoot).querySelector('#gs-glow-radius');
  field.value = ''; field.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  await window.__hpTest.settled();
});
record('invalidFormCannotSaveOrStart', await page.evaluate(() => {
  const c = window.__card, topology = (c.shadowRoot || c.renderRoot).querySelector('hp-zigbee-topology-settings');
  return [...topology.shadowRoot.querySelectorAll('.scan-row button')].every(b => b.disabled)
    && window.__enableRpc.saves.length === 0 && window.__enableRpc.starts === 0;
}));

await setup({ hold: false });
await page.evaluate(async () => {
  const root = window.__card.shadowRoot || window.__card.renderRoot;
  root.querySelector('hp-dialog[data-kind="settings"] [data-hp="dialog-confirm"]').click();
  await window.__hpTest.settled();
});
await page.waitForFunction(() => !window.__card._settingsDialog);
record('ordinarySaveStillClosesWithoutScanning', (await stats()).starts === 0);

// Actual component guards for contexts changed during the save callback, independent of the owner writer.
for (const retire of ['disconnect', 'session', 'connection', 'user', 'permission', 'off']) {
  await setup();
  await page.evaluate(async kind => {
    const c = window.__card, source = (c.shadowRoot || c.renderRoot).querySelector('hp-zigbee-topology-settings');
    const el = document.createElement('hp-zigbee-topology-settings');
    el.hass = source.hass; el.value = { enabled: true, z2mBaseTopics: ['zigbee2mqtt'] }; el.savedEnabled = false;
    el.settingsSession = {}; el.canPrepareLoad = true;
    const current = window.__standalone1031 = { el, saves: 0 };
    el.prepareLoad = () => { current.saves++; return new Promise(resolve => { current.resolve = resolve; }); };
    document.body.append(el); await el.updateComplete;
    [...el.shadowRoot.querySelectorAll('button')].find(b => /update map/i.test(b.textContent)).click();
    await el.updateComplete;
    if (kind === 'disconnect') el.remove();
    if (kind === 'session') el.settingsSession = {};
    if (kind === 'connection') el.hass = { ...el.hass, connection: { ...el.hass.connection } };
    if (kind === 'user') el.hass = { ...el.hass, user: { ...el.hass.user, id: 'another-admin' } };
    if (kind === 'permission') el.hass = { ...el.hass, user: { ...el.hass.user, is_admin: false } };
    if (kind === 'off') el.value = { ...el.value, enabled: false };
    el.savedEnabled = true; await el.updateComplete;
    current.resolve(true); await window.__hpTest.settled();
  }, retire);
  record(`${retire}PreventsLateScan`, await page.evaluate(() => window.__standalone1031.saves === 1 && window.__enableRpc.starts === 0));
}

await setup();
record('standaloneWithoutCallbackRemainsSaveFirst', await page.evaluate(async () => {
  const source = (window.__card.shadowRoot || window.__card.renderRoot).querySelector('hp-zigbee-topology-settings');
  const el = document.createElement('hp-zigbee-topology-settings');
  el.hass = source.hass; el.value = { enabled: true, z2mBaseTopics: ['zigbee2mqtt'] };
  document.body.append(el); await el.updateComplete;
  return [...el.shadowRoot.querySelectorAll('button')].every(button => button.disabled)
    && el.shadowRoot.textContent.includes('Save this setting before loading');
}));

await setup();
record('nonAdminCannotInvokeSaveCallback', await page.evaluate(async () => {
  const source = (window.__card.shadowRoot || window.__card.renderRoot).querySelector('hp-zigbee-topology-settings');
  const el = document.createElement('hp-zigbee-topology-settings'); let calls = 0;
  el.hass = { ...source.hass, user: { ...source.hass.user, is_admin: false } };
  el.value = { enabled: true, z2mBaseTopics: ['zigbee2mqtt'] }; el.canPrepareLoad = true;
  el.prepareLoad = async () => { calls++; return true; };
  document.body.append(el); await el.updateComplete;
  for (const button of el.shadowRoot.querySelectorAll('button')) button.click();
  await el.updateComplete;
  return calls === 0 && [...el.shadowRoot.querySelectorAll('button')].every(button => button.disabled);
}));

// The same live component at a narrow layout, with translated action labels.
for (const language of ['en', 'ru', 'de', 'fr']) {
  for (const theme of ['light', 'dark']) {
    await setup({ language });
    const fits = await page.evaluate(async ({ language, theme }) => {
      const source = (window.__card.shadowRoot || window.__card.renderRoot).querySelector('hp-zigbee-topology-settings');
      const el = document.createElement('hp-zigbee-topology-settings');
      el.hass = source.hass; el.language = language; el.embedded = true;
      el.value = { enabled: true, z2mBaseTopics: ['zigbee2mqtt'] }; el.canPrepareLoad = true;
      el.prepareLoad = async () => false;
      el.style.cssText = `position:fixed;left:0;top:0;width:360px;z-index:999999;box-sizing:border-box;overflow:auto;
        --card-background-color:${theme === 'light' ? '#fff' : '#202126'};--primary-text-color:${theme === 'light' ? '#171735' : '#eee'};`;
      document.body.append(el); await el.updateComplete;
      for (const details of el.shadowRoot.querySelectorAll('details')) {
        if (details.querySelector('.scan-row') && !details.open) details.querySelector('summary').click();
      }
      const button = el.shadowRoot.querySelector('.scan-row button');
      const box = el.getBoundingClientRect(), action = button.getBoundingClientRect();
      const fits = action.width > 0 && !button.disabled && button.textContent.trim().length > 5 && el.scrollWidth <= el.clientWidth + 1
        && action.right <= box.right + 1 && action.left >= box.left - 1;
      el.remove();
      // Keyboard activation belongs inside the real modal focus trap, not an outside fixture.
      source.shadowRoot.querySelector('.scan-row button').focus();
      return fits;
    }, { language, theme });
    record(`${language}-${theme}-360pxActionFits`, fits);
    await page.keyboard.press('Enter');
    await page.evaluate(() => window.__hpTest.settled());
    record(`${language}-${theme}-keyboardSaveAction`, await page.evaluate(() =>
      window.__enableRpc.saves.length === 1 && window.__enableRpc.starts === 0));
  }
}

await finish(browser, results);
