// #403: a rejected Area-provenance write restores deleted manual placement,
// while relocation invalidates only history commands owned by that device.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1000, height: 850 }, 1);
const res = await page.evaluate(async () => {
  const c = window.__card;
  const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
  const paint = async () => {
    c.requestUpdate();
    await c.updateComplete;
  };
  const settleRelocation = async () => {
    await c._areaRelocationWrite.catch(() => undefined);
    await wait(80);
    await paint();
  };
  const samePlacement = (left, right) => !!left && !!right
    && left.s === right.s && left.x === right.x && left.y === right.y;

  let serverConfig = structuredClone(c._serverCfg);
  let serverLayout = structuredClone(c._layout);
  let configRev = Math.max(30, Number(c._cfgRev) || 0);
  let layoutRev = Math.max(40, Number(c._layoutRev) || 0);
  const calls = [];
  let rejectConfig = null;
  let rejectRestoreId = null;
  let delayConfig = null;
  let releaseDelayedConfig = null;
  const baseCallWS = c.hass.callWS;
  c.hass = { ...c.hass, callWS: async (message) => {
    if (message.type === 'houseplan/config/get') {
      calls.push({ type: 'config/get' });
      return { config: structuredClone(serverConfig), rev: configRev, can_write: true };
    }
    if (message.type === 'houseplan/layout/get') {
      return { layout: structuredClone(serverLayout), rev: layoutRev };
    }
    if (message.type === 'houseplan/layout/delete') {
      calls.push({ type: 'layout/delete', id: message.device_id });
      delete serverLayout[message.device_id];
      return { ok: true, rev: ++layoutRev };
    }
    if (message.type === 'houseplan/layout/update') {
      const row = { type: 'layout/update', id: message.device_id };
      calls.push(row);
      if (rejectRestoreId === message.device_id) {
        rejectRestoreId = null;
        row.result = 'rejected';
        throw new Error('synthetic placement restore failure');
      }
      serverLayout[message.device_id] = structuredClone(message.pos);
      return { ok: true, rev: ++layoutRev };
    }
    if (message.type === 'houseplan/config/set') {
      const row = {
        type: 'config/set',
        snapshot: structuredClone(message.config?.settings?.marker_area_snapshot || {}),
        attention: [...(message.config?.settings?.new_device_ids || [])],
      };
      calls.push(row);
      if (rejectConfig
          && row.snapshot[rejectConfig.id]?.area === rejectConfig.area) {
        const rejection = rejectConfig;
        rejectConfig = null;
        row.result = 'rejected';
        const error = new Error('synthetic config failure');
        if (rejection.code) error.code = rejection.code;
        throw error;
      }
      if (delayConfig && row.snapshot[delayConfig.id]?.area === delayConfig.area) {
        const delayed = delayConfig;
        delayConfig = null;
        row.result = 'delayed';
        await new Promise((resolve) => { releaseDelayedConfig = resolve; });
        row.result = 'accepted';
        if (delayed.id === '') throw new Error('unreachable delayed fixture');
      }
      serverConfig = structuredClone(message.config);
      return { ok: true, rev: ++configRev };
    }
    return baseCallWS(message);
  } };
  c._serverStorage = true;
  c._serverCanWrite = true;
  c._layoutRev = layoutRev;
  c._cfgRev = configRev;

  const installScenario = async ({ id, oldArea, point }) => {
    await settleRelocation();
    window.__setRegistryArea('device', id, oldArea);
    await wait(120);
    c._serverCfg = {
      ...c._serverCfg,
      settings: {
        ...c._serverCfg.settings,
        marker_area_snapshot: {
          ...(c._serverCfg.settings.marker_area_snapshot || {}),
          [id]: { binding: `device:${id}`, area: oldArea },
        },
        new_device_ids: (c._serverCfg.settings.new_device_ids || [])
          .filter((candidate) => candidate !== id),
      },
    };
    c._layout = { ...c._layout, [id]: structuredClone(point) };
    serverConfig = structuredClone(c._serverCfg);
    serverLayout = structuredClone(c._layout);
    c._cfgContentFingerprint = '';
    c._layoutContentFingerprint = '';
    c._areaRelocationSyncKey = '';
    c._regSignature = '';
    c._maybeRebuildDevices();
    await settleRelocation();
  };
  const pushMove = (id, name, fromX, toX) => {
    const device = c._devices.find((candidate) => candidate.id === id);
    if (!device) return false;
    c._devicePositionHistory.push({
      name,
      before: { deviceId: id, spaceId: device.space,
        placement: { s: device.space, x: fromX, y: 0.31 } },
      after: { deviceId: id, spaceId: device.space,
        placement: { s: device.space, x: toX, y: 0.31 } },
    });
    return true;
  };

  const stableId = 'd_lamp';
  const relocatedId = 'd_light1';
  const original = { s: 'f1', x: 0.22, y: 0.22 };
  await installScenario({ id: relocatedId, oldArea: 'living_room', point: original });
  c._devicePositionHistory.clear();
  const historyFixtureReady = pushMove(stableId, 'Move lamp', 0.28, 0.34)
    && pushMove(relocatedId, 'Move relocating light', 0.22, 0.27);
  rejectConfig = { id: relocatedId, area: 'kitchen', code: null };
  window.__setRegistryArea('device', relocatedId, 'kitchen');
  await settleRelocation();

  const rejectedConfigIndex = calls.findIndex((row) => row.type === 'config/set'
    && row.result === 'rejected' && row.snapshot[relocatedId]?.area === 'kitchen');
  const restoreIndex = calls.findIndex((row, index) => index > rejectedConfigIndex
    && row.type === 'layout/update' && row.id === relocatedId);
  const restoredLocally = samePlacement(c._layout[relocatedId], original);
  const restoredOnServer = samePlacement(serverLayout[relocatedId], original);
  const unrelatedHistorySurvives = historyFixtureReady
    && c._devicePositionHistory.size === 1
    && c._devicePositionHistory.undoName === 'Move lamp';
  const relocatedHistoryRemoved = c._devicePositionHistory.undoName !== 'Move relocating light'
    && !c._devicePositionHistory.canRedo;

  const beforeUndoRelocated = structuredClone(c._layout[relocatedId]);
  await c._runDevicePositionHistory('undo');
  const unrelatedUndoStillWorks = c._devicePositionHistory.canRedo
    && samePlacement(c._layout[relocatedId], beforeUndoRelocated);

  // Retry with a delayed config response. Between delete and acknowledgement
  // the old point must not reappear; after release the ordinary #126 result
  // (advanced snapshot + attention) must complete.
  delayConfig = { id: relocatedId, area: 'kitchen' };
  c._regSignature = '';
  c._maybeRebuildDevices();
  for (let attempt = 0; attempt < 80 && !releaseDelayedConfig; attempt += 1) await wait(10);
  await paint();
  const movedDuringDelayedWrite = c._devices.find((device) => device.id === relocatedId);
  const stalePointSuppressedWhilePending = !!releaseDelayedConfig
    && !c._layout[relocatedId]
    && movedDuringDelayedWrite?.area === 'kitchen';
  releaseDelayedConfig?.();
  releaseDelayedConfig = null;
  await settleRelocation();
  const successfulRetry = !serverLayout[relocatedId]
    && c._serverCfg.settings.marker_area_snapshot?.[relocatedId]?.area === 'kitchen'
    && c._serverCfg.settings.new_device_ids?.includes(relocatedId);

  // The conflict branch must restore before it reloads and retries. Call
  // ordering is the durable witness even though the retry then deletes the
  // restored point again and completes normally.
  const conflictId = 'd_kettle';
  const conflictPoint = { s: 'f1', x: 0.72, y: 0.15 };
  await installScenario({ id: conflictId, oldArea: 'kitchen', point: conflictPoint });
  c._devicePositionHistory.clear();
  pushMove(stableId, 'Move lamp before conflict', 0.30, 0.36);
  const conflictStart = calls.length;
  rejectConfig = { id: conflictId, area: 'living_room', code: 'conflict' };
  window.__setRegistryArea('device', conflictId, 'living_room');
  await settleRelocation();
  const conflictRows = calls.slice(conflictStart);
  const conflictReject = conflictRows.findIndex((row) => row.type === 'config/set'
    && row.result === 'rejected' && row.snapshot[conflictId]?.area === 'living_room');
  const conflictRestore = conflictRows.findIndex((row, index) => index > conflictReject
    && row.type === 'layout/update' && row.id === conflictId);
  const conflictReload = conflictRows.findIndex((row, index) => index > conflictRestore
    && row.type === 'config/get');
  const conflictRetryDelete = conflictRows.findIndex((row, index) => index > conflictReload
    && row.type === 'layout/delete' && row.id === conflictId);
  const conflictRestoresBeforeRetry = conflictReject >= 0
    && conflictRestore > conflictReject
    && conflictReload > conflictRestore
    && conflictRetryDelete > conflictReload;
  const conflictEventuallyCompletes = !serverLayout[conflictId]
    && c._serverCfg.settings.marker_area_snapshot?.[conflictId]?.area === 'living_room'
    && c._serverCfg.settings.new_device_ids?.includes(conflictId);
  const conflictKeepsUnrelatedHistory = c._devicePositionHistory.undoName
    === 'Move lamp before conflict';

  // If even layout/update fails, the existing attention channel is persisted
  // instead of losing the manual point silently.
  const fallbackId = 'd_motion';
  const fallbackPoint = { s: 'f1', x: 0.40, y: 0.75 };
  await installScenario({ id: fallbackId, oldArea: 'living_room', point: fallbackPoint });
  rejectConfig = { id: fallbackId, area: 'kitchen', code: null };
  rejectRestoreId = fallbackId;
  window.__setRegistryArea('device', fallbackId, 'kitchen');
  await settleRelocation();
  const fallbackEl = c.renderRoot.querySelector(`.dev[data-id="${fallbackId}"]`);
  const failedRestoreLeavesAttention = !serverLayout[fallbackId]
    && c._serverCfg.settings.new_device_ids?.includes(fallbackId)
    && serverConfig.settings.new_device_ids?.includes(fallbackId)
    && c._newIds.has(fallbackId)
    && !!fallbackEl?.querySelector('.newdot');

  return {
    historyFixtureReady,
    rejectedWriteRestoresAfterDelete: rejectedConfigIndex >= 0
      && restoreIndex > rejectedConfigIndex && restoredLocally && restoredOnServer,
    unrelatedHistorySurvives,
    relocatedHistoryRemoved,
    unrelatedUndoStillWorks,
    stalePointSuppressedWhilePending,
    successfulRetry,
    conflictRestoresBeforeRetry,
    conflictEventuallyCompletes,
    conflictKeepsUnrelatedHistory,
    failedRestoreLeavesAttention,
  };
});

checkAll(res);
await finish(browser, res);
