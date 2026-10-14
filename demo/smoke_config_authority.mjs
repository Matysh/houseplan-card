// #890: public setConfig, accepted transport/cache, acknowledgement and foreign HA ownership.
import { launch, checkAll, finish, requirePinnedBrowser } from './serve.mjs';
requirePinnedBrowser('config authority');
const { page, browser } = await launch();
const out = await page.evaluate(async () => {
  const c = window.__card, o = {};
  const copy = (value) => JSON.parse(JSON.stringify(value));
  const pause = (ms = 30) => new Promise((resolve) => setTimeout(resolve, ms));
  await pause(650); c._saveConfigDebounced.flush(); await c._writeChain.catch(() => {});
  const base = c.hass.callWS, options = copy(c._config);
  let server = copy(c._serverCfg), rev = c._cfgRev;
  const writes = [];
  let refuse = null, heldWrite = null;
  c.hass = { ...c.hass, callWS: async (message) => {
    if (message.type === 'houseplan/config/get') {
      const response = await base(message); server = copy(response.config); rev = response.rev;
      return { ...response, can_write: true };
    }
    if (message.type === 'houseplan/config/set') {
      writes.push(copy(message));
      if (heldWrite) await heldWrite;
      if (refuse) throw Object.assign(new Error(refuse), { code: refuse });
      if (message.expected_rev !== rev) throw Object.assign(new Error('conflict'), { code: 'conflict' });
      server = copy(message.config); const response = await base(message); rev = response.rev; return response;
    }
    return base(message);
  } };
  const stale = { config: copy(server), rev, layout: copy(c._layout), layout_rev: c._layoutRev };
  const hp = window.__hpTest;
  const spaceDialog = await hp.openSpaceDialog('edit', c._serverCfg.spaces[0].id);
  await hp.input(spaceDialog.querySelector('input'), 'Accepted 890');
  [...spaceDialog.querySelectorAll('button')].find((button) => /^(Save|Сохранить)$/.test(button.textContent.trim())).click();
  await hp.waitForWrites();
  const acceptedRev = c._cfgRev;
  // Discover the actual LS_CFG key from the accepted document, never couple the oracle to a guessed name.
  const key = Object.keys(localStorage).find((key) => {
    try { const value = JSON.parse(localStorage.getItem(key)); return value?.config?.spaces && value?.rev === acceptedRev; } catch { return false; }
  });
  o.acceptedCached = !!key;
  localStorage.setItem(key, JSON.stringify(stale));
  c._geometryHistory.push({ name: '890 history', before: {}, after: {} });
  c.setConfig(options); await c.updateComplete;
  o.liveSetConfigKeepsAccepted = c._cfgRev === acceptedRev && c._serverCfg.spaces[0].title === 'Accepted 890';
  o.historyPreserved = c._geometryHistory.undoName === '890 history';
  c._serverCfg.settings.unknown_890 = 'pending'; // private-ok: #890 seed an unknown-field pending writer draft unavailable in GUI, not a UI-action oracle.
  const target = c._serverCfg.spaces.at(-1).id;
  c.setConfig({ ...options, floor: target }); await c.updateComplete;
  o.fixedFloorKeepsDraft = c._space === target && c._serverCfg.settings.unknown_890 === 'pending' && c._cfgRev === acceptedRev;
  c.setConfig({ ...options, default_floor: target }); await c.updateComplete;
  o.defaultFloorKeepsAuthority = c._space === target && c._cfgRev === acceptedRev && c._serverCfg.settings.unknown_890 === 'pending';
  await c._saveConfigNow();
  o.nextSaveUsesAcceptedRev = writes.at(-1).expected_rev === acceptedRev;
  const setItem = Storage.prototype.setItem;
  Storage.prototype.setItem = () => { throw new Error('quota'); };
  try { c._serverCfg.settings.unknown_890 = 'quota accepted'; await c._saveConfigNow(); o.cacheFailureKeepsSuccess = c._cfgRev === rev; } // private-ok: #890 isolate storage quota failure at the actual transport boundary with an unknown-field draft.
  finally { Storage.prototype.setItem = setItem; }
  c._cacheSnapshot();
  c._serverCfg.settings.unknown_890 = 'unsaved'; c._cacheSnapshot(); // private-ok: #890 seed unsent unknown-field content to test the cache boundary, no UI equivalent.
  o.cacheNeverAcceptsDraft = JSON.parse(localStorage.getItem(key)).config.settings.unknown_890 === 'quota accepted';
  // A cold cache can paint, but never authorizes a write.
  const cold = document.createElement('houseplan-card'); cold.setConfig(options);
  o.coldHintPaintsWithoutWriter = !!cold._serverCfg && !cold._loadOk && !cold._canEdit;
  let coldRejected = false; try { await cold._sendConfigCandidate(cold._serverCfg); } catch { coldRejected = true; }
  o.coldWriteRefused = coldRejected;
  await hp.setServerConfig((cfg) => { cfg.settings.new_device_ids = ['d_mower', '890-other']; return cfg; });
  server = copy(c._serverCfg); rev = c._cfgRev;
  refuse = 'unauthorized'; const beforeAck = writes.length;
  await hp.setMode('devices');
  const markerDialog = await hp.openMarkerDialog('d_mower');
  await c._writeChain.catch(() => {}); await pause(30);
  o.failedAckRestoresAttention = c._newIds.has('d_mower') && c._newIds.has('890-other');
  await pause(600);
  o.ackHasNoRetryLoop = writes.length === beforeAck + 1;
  await hp.close(markerDialog, { via: 'cancel' });
  refuse = null; await hp.openMarkerDialog('d_mower'); await c._writeChain; await pause(30);
  o.acceptedAckOnlyClearsItsId = !c._newIds.has('d_mower') && c._newIds.has('890-other');
  o.configUnauthorizedText = /permission to save|прав на сохранение/.test(c._errText({ code: 'unauthorized' }));
  o.backupUnauthorizedUnchanged = /export or import|экспорт или импорт/.test(c._editorRuntime._backupErrorText({ code: 'unauthorized' }));
  // Same-connection reconnect does not discard an independent local draft.
  c._serverCfg.settings.unknown_890 = 'same connection'; c.hass = { ...c.hass }; await c.updateComplete; // private-ok: #890 reconnect probe of independent unknown-field draft, no UI field exists.
  o.sameContextKeepsDraft = c._serverCfg.settings.unknown_890 === 'same connection';
  let releaseA; heldWrite = new Promise((resolve) => { releaseA = resolve; });
  const pendingA = c._saveConfigNow().catch((error) => error.code);
  await pause();
  const configB = copy(server); configB.spaces[0].title = 'Authority B';
  let releaseB; const waitB = new Promise((resolve) => { releaseB = resolve; });
  let bWrites = 0;
  c.hass = { ...c.hass, connection: { ...c.hass.connection }, callWS: async (message) => {
    if (message.type === 'houseplan/config/get') { await waitB; return { config: copy(configB), rev: 3, can_write: true }; }
    if (message.type === 'houseplan/layout/get') { await waitB; return { layout: {}, rev: 2 }; }
    if (message.type === 'houseplan/config/set') { bWrites++; return { rev: 4 }; }
    return base(message);
  } };
  await pause();
  o.foreignContextDropsAuthority = !c._loadOk && !c._canEdit && c._cfgRev === 0;
  releaseA(); const staleCode = await pendingA;
  o.oldReplyIsFenced = staleCode === 'context-changed' && c._cfgRev === 0 && bWrites === 0;
  releaseB();
  for (let i = 0; i < 100 && !c._loadOk; i++) await pause();
  o.bReceivesItsOwnAuthority = c._loadOk && c._cfgRev === 3 && c._serverCfg.spaces[0].title === 'Authority B';
  // AC6 order matters: B mandatory reads and its own write win before A replies.
  // Run both production writers, with an installed editor and a View-only card.
  const fastContext = async (card, label) => {
    const config = copy(card._serverCfg); config.spaces[0].title = `Fast ${label}`;
    let releaseOld, enteredOld = false;
    const oldResponse = new Promise((resolve) => { releaseOld = resolve; });
    card.hass = { ...card.hass, callWS: async (message) => {
      if (message.type === 'houseplan/config/set') { enteredOld = true; await oldResponse; return { rev: 100 }; }
      return base(message);
    } };
    const oldWrite = card._writeConfig().catch((error) => error.code); // private-ok: #890 exercise the real shared transport queue, including View metadata without loading the editor.
    for (let i = 0; i < 100 && !enteredOld; i++) await pause();
    let releaseOwn, ownEntered = false;
    const ownResponse = new Promise((resolve) => { releaseOwn = resolve; });
    const ownWrites = [];
    card.hass = { ...card.hass, connection: { ...card.hass.connection }, callWS: async (message) => {
      if (message.type === 'houseplan/config/get') return { config: copy(config), rev: 3, can_write: true };
      if (message.type === 'houseplan/layout/get') return { layout: {}, rev: 2 };
      if (message.type === 'houseplan/config/set') {
        ownWrites.push(copy(message));
        if (ownWrites.length === 1) { ownEntered = true; await ownResponse; }
        return { rev: 3 + ownWrites.length };
      }
      return base(message);
    } };
    for (let i = 0; i < 100 && !card._loadOk; i++) await pause();
    o[`${label}FastLoadBeforeOldReply`] = card._loadOk && card._cfgRev === 3
      && card._serverCfg.spaces[0].title === `Fast ${label}` && card._writesPending === 0;
    const ownWrite = card._writeConfig().catch((error) => error.code); // private-ok: #890 hold transport to observe per-context queue/count, not a GUI action oracle.
    for (let i = 0; i < 100 && !ownEntered; i++) await pause();
    o[`${label}OwnWriteBeforeOldReply`] = ownEntered && ownWrites[0]?.expected_rev === 3 && card._writesPending === 1;
    releaseOld(); const oldCode = await oldWrite;
    o[`${label}LateOldReplyKeepsOwnCounter`] = oldCode === 'context-changed' && card._writesPending === 1
      && card._cfgRev === 3 && card._serverCfg.spaces[0].title === `Fast ${label}`;
    releaseOwn(); await ownWrite;
    o[`${label}OwnWriteSettlesItsCounter`] = card._writesPending === 0 && card._cfgRev === 4;
    await card._writeConfig(); // private-ok: #890 assert expected_rev at the real View/editor writer boundary.
    o[`${label}NextWriteUsesOwnRev`] = ownWrites.at(-1).expected_rev === 4 && card._writesPending === 0;
  };
  await fastContext(c, 'editor');
  cold.hass = c.hass; document.body.append(cold);
  for (let i = 0; i < 100 && !cold._loadOk; i++) await pause();
  o.viewFixtureHasNoEditor = cold._loadOk && !cold._editorRuntime;
  await fastContext(cold, 'view');
  cold.remove();
  return o;
});
checkAll(out, Object.fromEntries(Object.keys(out).map((key) => [key, true])));
await finish(browser);
