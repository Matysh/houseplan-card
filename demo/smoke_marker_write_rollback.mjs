// #442: marker Save is an immutable config transaction. A rejected semantic
// write restores the accepted View while keeping the dialog draft for Retry;
// failures after config acceptance never roll the accepted marker back.
import { launch, checkAll, finish } from './serve.mjs';

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
await finish(browser, out);
