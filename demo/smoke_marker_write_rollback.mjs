// #442: marker Save is an immutable config transaction. A rejected semantic
// write restores the accepted View while keeping the dialog draft for Retry;
// failures after config acceptance never roll the accepted marker back.
import { launch, check, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch();
const out = await page.evaluate(async () => {
  const c = window.__card;
  const result = {};
  await new Promise((resolve) => setTimeout(resolve, 650));
  c._saveConfigDebounced?.flush?.();
  await c._writeChain;
  await c._areaRelocationWrite;

  c._setMode('devices');
  await c.updateComplete;
  const device = c._devices[0];
  const markerId = device.id;
  const acceptedName = c._serverCfg.markers.find((item) => item.id === markerId)?.name ?? null;
  let acceptedFingerprint = c._cfgContentFingerprint;
  c._openMarkerDialog(device);
  await c.updateComplete;
  const draftName = 'Rejected marker draft #442';
  c._markerDialog = { ...c._markerDialog, name: draftName };

  const realWS = c.hass.callWS;
  let rejectConfig = false;
  let configWrites = 0;
  let configGate = null;
  let rejectLayout = false;
  c.hass = { ...c.hass, callWS: async (message) => {
    if (message.type === 'houseplan/config/set') {
      configWrites += 1;
      const rejectThis = rejectConfig;
      if (configGate) await configGate.promise;
      if (rejectThis) throw new Error('semantic marker reject');
    }
    if (message.type === 'houseplan/layout/update' && rejectLayout)
      throw new Error('layout unavailable');
    return realWS(message);
  } };
  await c.updateComplete;

  // Queue the rejected marker attempt behind an older accepted write. Its
  // rollback guard must adopt the revision actually used after the queue wait.
  let releasePrior;
  configGate = { promise: new Promise((resolve) => { releasePrior = resolve; }) };
  const priorWrite = c._writeConfig();
  while (configWrites === 0) await new Promise((resolve) => setTimeout(resolve, 0));
  acceptedFingerprint = c._cfgContentFingerprint;
  rejectConfig = true;
  const rejectedWrite = c._saveMarker();
  releasePrior();
  await priorWrite;
  configGate = null;
  await rejectedWrite;
  await c.updateComplete;
  const rejectedMarker = c._serverCfg.markers.find((item) => item.id === markerId);
  result.rejectedConfigRestored = (rejectedMarker?.name ?? null) === acceptedName;
  result.rejectedViewRestored = c._devices.find((item) => item.id === markerId)?.name === device.name;
  result.acceptedFingerprintRestored = c._cfgContentFingerprint === acceptedFingerprint;
  result.dialogDraftPreserved = c._markerDialog?.name === draftName && c._markerDialog.busy === false;
  result.rejectHasNoSuccess = c._toast !== c._t('toast.marker_saved');
  result.oneRejectedWrite = configWrites === 2;

  rejectConfig = false;
  await c._saveMarker();
  await c.updateComplete;
  result.retryAccepted = c._serverCfg.markers.find((item) => item.id === markerId)?.name === draftName;
  result.retryClosedAndToasted = c._markerDialog === null && c._toast === c._t('toast.marker_saved');
  result.retryWroteOnce = configWrites === 3;

  // A new virtual marker has a layout side effect after config/set. Reject
  // that second phase: the already accepted config must remain authoritative.
  c._openMarkerDialog();
  const virtualName = 'Accepted before layout failure #442';
  c._markerDialog = { ...c._markerDialog, name: virtualName, binding: 'virtual' };
  rejectLayout = true;
  await c._saveMarker();
  await c.updateComplete;
  result.sideEffectFailureKeepsAcceptedConfig = c._serverCfg.markers
    .some((item) => item.name === virtualName);
  result.sideEffectFailureHasNoSuccess = c._toast !== c._t('toast.marker_saved');
  result.sideEffectFailureKeepsDraft = c._markerDialog?.name === virtualName
    && c._markerDialog.busy === false;

  c.hass = { ...c.hass, callWS: realWS };
  return result;
});

checkAll(out);

// #842 AC1/AC4 through real input: Playwright clicks the device and the
// dialog's «Save»; the stored plan arrives as a server event; `config/set` is
// observed on the HA connection object the card is given.
const ev = (fn, arg) => page.evaluate(fn, arg);
await ev(async () => {
  const c = window.__card;
  const real = c.hass.callWS;
  const state = { sets: [], reject: 0 };
  window.__842 = state;
  c.hass = { ...c.hass, callWS: async (message) => {
    if (message.type === 'houseplan/config/set') {
      state.sets.push(structuredClone(message.config));
      if (state.reject > 0) { state.reject -= 1; throw new Error('offline (#842 smoke)'); }
    }
    return real(message);
  } };
  state.composition = (cfg) => {
    const space = cfg.spaces.find((item) => item.id === 'f1');
    const ids = (list) => (list || []).map((item) => item.id).join(',');
    return { rooms: ids(space.rooms), openings: ids(space.openings), partitions: ids(space.partitions),
      columns: ids(space.wall_columns),
      finish: space.wall_columns?.find((item) => item.id === 'c-square')?.finish ?? null,
      label: space.wall_columns?.find((item) => item.id === 'c-round')?.label ?? null };
  };
  await window.__hpTest.setServerConfig((cfg) => {
    const space = cfg.spaces.find((item) => item.id === 'f1');
    delete space.segments;
    space.partitions = [
      { id: 'p-host', a: [0.1, 0.3], b: [0.3, 0.3], cm: 15 },
      { id: 'p-free', a: [0.1, 0.45], b: [0.3, 0.45], cm: 10 },
    ];
    space.wall_columns = [
      { id: 'c-square', shape: 'square', center: [0.45, 0.3], cm: 30, angle: 0, finish: 'brick' },
      { id: 'c-round', shape: 'circle', center: [0.45, 0.45], cm: 20, label: 'pillar' },
    ];
    space.openings = [
      { id: 'o-room', type: 'door', x: 0.3, y: 0.14, angle: 0, length: 0.05 },
      { id: 'o-partition', type: 'door', x: 0.2, y: 0.3, angle: 0, length: 0.05,
        host: { kind: 'partition', id: 'p-host', t: 0.5 } },
    ];
    return cfg;
  });
  await window.__hpTest.setMode('devices');
  state.sets.length = 0;
});
const markerDialog = 'hp-dialog[data-kind="marker"]';
// The #442 part above ends with its draft dialog open: close it as a person does.
if (await page.locator(markerDialog).count()) {
  await page.locator(`${markerDialog} button.btn.ghost[data-hp="dialog-cancel"]`).click();
  await page.waitForTimeout(150);
  const discard = page.locator('hp-confirm .danger-confirm-footer [data-hp="dialog-confirm"]');
  if (await discard.count()) await discard.click();
  await page.waitForFunction(() => !window.__card.shadowRoot.querySelector('hp-dialog[data-kind="marker"]'));
}
const saveDevice = async (id, name) => {
  await page.locator(`[data-hp="device"][data-id="${id}"]`).click();
  await page.locator(`${markerDialog} #marker-name`).fill(name);
  await page.locator(`${markerDialog} .dialog-action-commit [data-hp="dialog-confirm"]`).click();
};
const stored = await ev(() => window.__842.composition(window.__card._serverCfg));
await saveDevice('d_lamp', 'Lamp #842');
await page.waitForFunction(() => !window.__card.shadowRoot.querySelector('hp-dialog[data-kind="marker"]'), null, { timeout: 5000 });
const ac1 = await ev(() => ({ writes: window.__842.sets.length, sent: window.__842.composition(window.__842.sets[0]) }));
check('#842 AC1: the real Save sends one config/set with every plan object and unknown column fields', ac1,
  { writes: 1, sent: { ...stored, finish: 'brick', label: 'pillar' } });
const reread = await ev(async () => {
  await window.__hpTest.setServerConfig(window.__842.sets[0]);
  return window.__842.composition(window.__card._serverCfg);
});
check('#842 AC1: a re-read has the same composition', reread, ac1.sent);

// AC4: opening a device flagged new acknowledges it — an ordinary deferred
// write. The dialog's Save cancels it (its content travels in the candidate);
// a rejected Save must re-arm it once.
await ev(async () => {
  await window.__hpTest.setServerConfig((cfg) => {
    cfg.settings.new_device_ids = ['d_tv'];
    return cfg;
  });
  window.__842.sets.length = 0;
  window.__842.reject = 1;
});
await saveDevice('d_tv', 'TV #842');
await page.waitForTimeout(1200);
const ac4 = await ev(() => {
  const [attempt, restored] = window.__842.sets;
  const named = (cfg) => !!cfg?.markers?.some((item) => item.name === 'TV #842');
  return {
    writes: window.__842.sets.length,
    attemptIsTheSave: named(attempt) && !(attempt?.settings?.new_device_ids || []).includes('d_tv'),
    restoredCarriesTheAck: !!restored && !(restored.settings.new_device_ids || []).includes('d_tv'),
    restoredWithoutDraft: !named(restored),
    dialogKeepsDraft: window.__card.shadowRoot.querySelector('hp-dialog[data-kind="marker"] #marker-name')?.value === 'TV #842',
  };
});
check('#842 AC4 marker: a rejected Save re-arms the cancelled pending edit, written once', ac4, {
  writes: 2, attemptIsTheSave: true, restoredCarriesTheAck: true, restoredWithoutDraft: true, dialogKeepsDraft: true,
});

await finish(browser, out);
