// #543: authoritative config reloads may finish in either network/asset order.
// Exercise the production bundle and the real `_reloadConfigOnly` host path;
// only transport replies and image latency are controlled by the harness.
import { launchColdView, checkAll, finish } from './serve.mjs';

const { page, browser } = await launchColdView();
const out = await page.evaluate(async () => {
  const card = window.__card;
  const clone = (value) => structuredClone(value);
  const cache = () => JSON.parse(localStorage.getItem('houseplan_card_cfg_v1') || 'null');
  const firstTitle = (config) => config?.spaces?.[0]?.title;
  const config = (title, planUrl) => {
    const next = clone(card._serverCfg);
    next.spaces[0].title = title;
    next.spaces[0].plan_url = planUrl;
    return next;
  };
  const deferred = () => {
    let resolve;
    const promise = new Promise((done) => { resolve = done; });
    return { promise, resolve };
  };

  const original = {
    get: card._getAuthoritativeConfig,
    prepareImage: card._signer.prepareImage,
    cacheSnapshot: card._cacheSnapshot,
    rebuild: card._maybeRebuildDevices,
    continuity: card._beginContinuityCandidate,
    toast: card._showToast,
    retry: card._scheduleLoadRetry,
    requestUpdate: card.requestUpdate,
  };
  const tails = {
    cache: [], rebuild: 0, continuity: 0, toast: 0, retry: 0, renders: 0,
  };
  card._cacheSnapshot = function (...args) {
    tails.cache.push({ title: firstTitle(this._serverCfg), rev: this._cfgRev });
    return original.cacheSnapshot.apply(this, args);
  };
  card._maybeRebuildDevices = function (...args) {
    tails.rebuild += 1;
    return original.rebuild.apply(this, args);
  };
  card._beginContinuityCandidate = function (...args) {
    tails.continuity += 1;
    return original.continuity.apply(this, args);
  };
  card._showToast = function (...args) {
    tails.toast += 1;
    return original.toast.apply(this, args);
  };
  card._scheduleLoadRetry = function (...args) {
    tails.retry += 1;
    return original.retry.apply(this, args);
  };
  card.requestUpdate = function (...args) {
    tails.renders += 1;
    return original.requestUpdate.apply(this, args);
  };

  const reset = async (title) => {
    const base = config(title, `/assets/${title}.svg`);
    card._getAuthoritativeConfig = async () => ({ config: base, rev: 2, can_write: true });
    card._signer.prepareImage = async () => true;
    await card._reloadConfigOnly(true);
    await card.updateComplete;
    tails.cache.length = 0;
    tails.rebuild = 0;
    tails.continuity = 0;
    tails.toast = 0;
    tails.retry = 0;
    tails.renders = 0;
  };

  const tailSnapshot = () => ({
    cache: tails.cache.length,
    rebuild: tails.rebuild,
    continuity: tails.continuity,
    toast: tails.toast,
    retry: tails.retry,
    renders: tails.renders,
    epoch: card._cfgEpoch,
  });

  // Order 1: A has its response first but remains inside prepareImage while B
  // completes. Releasing A must not produce any second adoption tail.
  await reset('race-baseline-asset');
  const olderAsset = config('race-older-asset', '/assets/race-older-asset.svg');
  const newerAsset = config('race-newer-asset', '/assets/race-newer-asset.svg');
  const assetGate = deferred();
  const assetEntered = deferred();
  let requestIndex = 0;
  card._getAuthoritativeConfig = async () => (++requestIndex === 1
    ? { config: olderAsset, rev: 3, can_write: true }
    : { config: newerAsset, rev: 4, can_write: true });
  card._signer.prepareImage = async (_hass, url) => {
    if (String(url).includes('race-older-asset')) {
      assetEntered.resolve();
      return assetGate.promise;
    }
    return true;
  };
  const olderAssetReload = card._reloadConfigOnly(false, 3);
  await assetEntered.promise;
  await card._reloadConfigOnly(false, 4);
  await card.updateComplete;
  const assetWinner = {
    title: firstTitle(card._serverCfg),
    rev: card._cfgRev,
    cache: clone(cache()),
    cacheTails: tails.cache.length,
    rebuilds: tails.rebuild,
    continuity: tails.continuity,
    renders: tails.renders,
    epoch: card._cfgEpoch,
    text: card.renderRoot.textContent,
  };
  assetGate.resolve(true);
  await olderAssetReload;
  await card.updateComplete;
  const assetFinal = {
    title: firstTitle(card._serverCfg),
    rev: card._cfgRev,
    cache: clone(cache()),
    cacheTails: tails.cache.length,
    rebuilds: tails.rebuild,
    continuity: tails.continuity,
    renders: tails.renders,
    epoch: card._cfgEpoch,
    text: card.renderRoot.textContent,
  };

  // Order 2: A waits in transport itself. B completes before A even reaches
  // the common gate; the pre-adoption host check must drop A.
  await reset('race-baseline-network');
  const olderNetwork = config('race-older-network', '/assets/race-older-network.svg');
  const newerNetwork = config('race-newer-network', '/assets/race-newer-network.svg');
  const networkGate = deferred();
  requestIndex = 0;
  card._getAuthoritativeConfig = async () => (++requestIndex === 1
    ? networkGate.promise
    : { config: newerNetwork, rev: 4, can_write: true });
  card._signer.prepareImage = async () => true;
  const olderNetworkReload = card._reloadConfigOnly(false, 3);
  await Promise.resolve();
  await card._reloadConfigOnly(false, 4);
  await card.updateComplete;
  const networkWinner = {
    title: firstTitle(card._serverCfg),
    rev: card._cfgRev,
    cacheTails: tails.cache.length,
    rebuilds: tails.rebuild,
    continuity: tails.continuity,
    renders: tails.renders,
    epoch: card._cfgEpoch,
  };
  networkGate.resolve({ config: olderNetwork, rev: 3, can_write: true });
  await olderNetworkReload;
  await card.updateComplete;
  const networkFinal = {
    title: firstTitle(card._serverCfg),
    rev: card._cfgRev,
    cacheTails: tails.cache.length,
    rebuilds: tails.rebuild,
    continuity: tails.continuity,
    renders: tails.renders,
    epoch: card._cfgEpoch,
  };

  // A local write accepted while a read is pending establishes a different
  // baseline. Even a response with the same numeric revision cannot replace
  // that body or append another cache/render tail.
  await reset('race-baseline-write');
  const olderWrite = config('race-older-write', '/assets/race-older-write.svg');
  const localWinner = config('race-local-winner', '/assets/race-local-winner.svg');
  const writeGate = deferred();
  card._getAuthoritativeConfig = async () => writeGate.promise;
  const staleAfterWrite = card._reloadConfigOnly(false, 3);
  await Promise.resolve();
  card._adoption.stageConfigCandidate(localWinner);
  card._adoption.acceptConfigWrite(localWinner, { rev: 3 });
  card._cacheSnapshot();
  card.requestUpdate();
  await card.updateComplete;
  const writeWinner = {
    title: firstTitle(card._serverCfg), rev: card._cfgRev, cache: clone(cache()),
  };
  const writeTail = tailSnapshot();
  writeGate.resolve({ config: olderWrite, rev: 3, can_write: true });
  await staleAfterWrite;
  await card.updateComplete;
  const writeFinal = {
    title: firstTitle(card._serverCfg), rev: card._cfgRev, cache: clone(cache()),
    tail: tailSnapshot(),
  };

  // Every lifecycle boundary must invalidate permanently, even when the user,
  // connection or route later appears identical again. Snapshot counters only
  // after the boundary so its own legitimate work is not attributed to A.
  const originalHass = card.hass;
  const lifecycleCase = async (name, invalidate) => {
    card.hass = originalHass;
    await card.updateComplete;
    await reset(`race-baseline-${name}`);
    const stale = config(`race-stale-${name}`, `/assets/race-stale-${name}.svg`);
    const gate = deferred();
    card._getAuthoritativeConfig = async () => gate.promise;
    const pending = card._reloadConfigOnly(false, 3);
    await Promise.resolve();
    await invalidate();
    const before = {
      title: firstTitle(card._serverCfg), rev: card._cfgRev, cache: clone(cache()),
      tail: tailSnapshot(),
    };
    gate.resolve({ config: stale, rev: 3, can_write: true });
    await pending;
    await card.updateComplete;
    const after = {
      title: firstTitle(card._serverCfg), rev: card._cfgRev, cache: clone(cache()),
      tail: tailSnapshot(),
    };
    return JSON.stringify(before) === JSON.stringify(after);
  };
  const routeInvalidated = await lifecycleCase('route', async () => {
    card._leaveCardRoute();
  });
  const userInvalidated = await lifecycleCase('user', async () => {
    card.hass = { ...originalHass, user: { ...originalHass.user, id: 'other-user' } };
    await card.updateComplete;
    card.hass = originalHass;
    await card.updateComplete;
  });
  const connectionInvalidated = await lifecycleCase('connection', async () => {
    card.hass = { ...originalHass, connection: { ...originalHass.connection } };
    await card.updateComplete;
    card.hass = originalHass;
    await card.updateComplete;
  });
  const reconnectInvalidated = await lifecycleCase('reconnect', async () => {
    const parent = card.parentNode;
    card.remove();
    await Promise.resolve();
    parent.appendChild(card);
    await card.updateComplete;
  });

  // The same element is usable in the new lifecycle after stale work was
  // discarded; lifecycle invalidation is not a permanent numeric-rev ban.
  const lifecycleWinner = config('race-lifecycle-winner', '/assets/race-lifecycle-winner.svg');
  card._getAuthoritativeConfig = async () => ({ config: lifecycleWinner, rev: 4, can_write: true });
  card._signer.prepareImage = async () => true;
  await card._reloadConfigOnly(false, 4);
  await card.updateComplete;
  const newLifecycleCanReload = firstTitle(card._serverCfg) === 'race-lifecycle-winner'
    && card._cfgRev === 4;

  // Force/restore owns a fresh generation rather than a process-lifetime
  // monotonic clock. A lower authoritative revision is valid there; ordinary
  // events then establish a new high-water from that restored baseline. The
  // pending event timer below belongs to the old generation and must expire.
  const restored = config('race-force-restored', '/assets/race-force-restored.svg');
  let deferredEventRetry = null;
  const nativeSetTimeout = window.setTimeout;
  window.setTimeout = (callback) => {
    deferredEventRetry = callback;
    return 543;
  };
  card._writesPending += 1;
  try {
    await card._reloadConfigOnly(false, 5);
  } finally {
    window.setTimeout = nativeSetTimeout;
  }
  card._getAuthoritativeConfig = async () => ({ config: restored, rev: 1, can_write: true });
  try {
    await card._reloadConfigOnly(true);
  } finally {
    card._writesPending -= 1;
  }
  await card.updateComplete;
  const forceDuringWriteAcceptedLowerRevision = firstTitle(card._serverCfg) === 'race-force-restored'
    && card._cfgRev === 1;
  let expiredRetryReads = 0;
  card._getAuthoritativeConfig = async () => {
    expiredRetryReads += 1;
    return { config: restored, rev: 1, can_write: true };
  };
  await deferredEventRetry?.();
  await Promise.resolve();
  const oldDeferredEventExpired = expiredRetryReads === 0;
  let ordinaryReads = 0;
  card._getAuthoritativeConfig = async () => {
    ordinaryReads += 1;
    return {
      config: config('race-after-restore', '/assets/race-after-restore.svg'),
      rev: 2,
      can_write: true,
    };
  };
  await card._reloadConfigOnly(false, 1);
  const restoredEchoSkipped = ordinaryReads === 0;
  await card._reloadConfigOnly(false, 2);
  await card.updateComplete;
  const restoredHigherEventAccepted = ordinaryReads === 1
    && firstTitle(card._serverCfg) === 'race-after-restore'
    && card._cfgRev === 2;

  card._getAuthoritativeConfig = original.get;
  card._signer.prepareImage = original.prepareImage;
  card._cacheSnapshot = original.cacheSnapshot;
  card._maybeRebuildDevices = original.rebuild;
  card._beginContinuityCandidate = original.continuity;
  card._showToast = original.toast;
  card._scheduleLoadRetry = original.retry;
  card.requestUpdate = original.requestUpdate;

  return {
    assetWinnerAdopted: assetWinner.title === 'race-newer-asset' && assetWinner.rev === 4,
    assetWinnerVisible: assetWinner.text.includes('race-newer-asset'),
    assetWinnerCached: firstTitle(assetWinner.cache?.config) === 'race-newer-asset'
      && assetWinner.cache?.rev === 4,
    lateAssetCannotRegress: assetFinal.title === assetWinner.title
      && assetFinal.rev === assetWinner.rev,
    lateAssetHasNoTail: assetFinal.cacheTails === assetWinner.cacheTails
      && assetFinal.rebuilds === assetWinner.rebuilds
      && assetFinal.continuity === assetWinner.continuity
      && assetFinal.renders === assetWinner.renders
      && assetFinal.epoch === assetWinner.epoch,
    lateAssetCannotRegressCache: JSON.stringify(assetFinal.cache) === JSON.stringify(assetWinner.cache),
    lateAssetNotVisible: !assetFinal.text.includes('race-older-asset'),
    networkWinnerAdopted: networkWinner.title === 'race-newer-network'
      && networkWinner.rev === 4,
    lateNetworkCannotRegress: networkFinal.title === networkWinner.title
      && networkFinal.rev === networkWinner.rev,
    lateNetworkHasNoTail: networkFinal.cacheTails === networkWinner.cacheTails
      && networkFinal.rebuilds === networkWinner.rebuilds
      && networkFinal.continuity === networkWinner.continuity
      && networkFinal.renders === networkWinner.renders
      && networkFinal.epoch === networkWinner.epoch,
    localWriteTitle: writeWinner.title,
    localWriteRev: writeWinner.rev,
    localWriteCacheTitle: firstTitle(writeWinner.cache?.config),
    localWriteCacheRev: writeWinner.cache?.rev,
    staleReadCannotReplaceLocalWrite: writeFinal.title === writeWinner.title
      && writeFinal.rev === writeWinner.rev
      && JSON.stringify(writeFinal.cache) === JSON.stringify(writeWinner.cache)
      && JSON.stringify(writeFinal.tail) === JSON.stringify(writeTail),
    routeInvalidated,
    userInvalidated,
    connectionInvalidated,
    reconnectInvalidated,
    newLifecycleCanReload,
    forceDuringWriteAcceptedLowerRevision,
    oldDeferredEventExpired,
    restoredEchoSkipped,
    restoredHigherEventAccepted,
    noStaleToastOrRetry: tails.toast === 0 && tails.retry === 0,
  };
});

checkAll(out, {
  localWriteTitle: 'race-local-winner',
  localWriteRev: 3,
  localWriteCacheTitle: 'race-local-winner',
  localWriteCacheRev: 3,
});
await finish(browser, out);
