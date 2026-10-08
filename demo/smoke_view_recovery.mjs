// #824: real attach, delayed HA and bounded paint failure, never a helper-only
// proxy. Inputs enter through HA/server events and the public element lifecycle.
import { launchColdView, checkAll, finish } from './serve.mjs';

const reports = {};
const remount = await launchColdView();
reports.remount = await remount.page.evaluate(async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const until = async (test, ms = 4000) => {
    const end = performance.now() + ms;
    while (!test() && performance.now() < end) await sleep(16);
    return !!test();
  };
  const host = document.createElement('div');
  host.style.width = '600px'; document.body.append(host);
  const el = document.createElement('houseplan-space-card');
  el.setConfig({ type: 'custom:houseplan-space-card', space: 'f1', show_button: false });
  const original = window.__mkHass();
  const calls = [];
  el.hass = { ...original, callWS: (message) => {
    calls.push(message.type); return original.callWS(message);
  }, callService: (...args) => { calls.push('service'); return original.callService(...args); } };
  host.append(el);
  const rooms = () => el.renderRoot.querySelectorAll('.room').length;
  await until(() => rooms() === 4 && el._loadedOnce);
  const baseline = rooms();
  const before = calls.filter((type) => type === 'houseplan/config/get').length;
  el.remove();
  await window.__hpTest.setServerConfig((cfg) => {
    cfg.spaces.find((space) => space.id === 'f1').rooms.pop();
  });
  await window.__hpTest.setLayout((layout) => {
    layout.d_light1 = { s: 'f1', x: 0.3, y: 0.31 };
  });
  // No hass assignment or config event to the detached instance.
  host.append(el);
  const fresh = await until(() => rooms() === 3
    && el._snap?.layout.d_light1?.x === 0.3);
  const reads = calls.filter((type) => type === 'houseplan/config/get').length - before;
  const view = el.renderRoot.querySelector('svg')?.getAttribute('viewBox');
  const frames = [];
  el.remove(); host.append(el);
  for (let i = 0; i < 12; i++) {
    await new Promise(requestAnimationFrame);
    frames.push([rooms(), el.renderRoot.querySelector('svg')?.getAttribute('viewBox')]);
  }
  const out = {
    fourRoomBaseline: baseline === 4,
    missedEventRevalidates: fresh,
    attachDoesRealServerRead: reads === 1,
    samePayloadKeepsFrame: frames.every(([n, box]) => n === 3 && box === view),
    readOnlyNoWrites: !calls.some((type) => /\/(set|update|delete)$/.test(type) || type === 'service'),
  };
  host.remove(); return out;
});
checkAll(reports.remount);
await remount.browser.close();

const late = await launchColdView();
reports.lateHass = await late.page.evaluate(async () => {
  const card = window.__card;
  const parent = card.parentElement;
  const original = card.hass;
  const calls = [];
  const ready = { ...original, callWS: (message) => {
    calls.push(message.type); return original.callWS(message);
  } };
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const frame = () => new Promise(requestAnimationFrame);
  const settled = async () => {
    const end = performance.now() + 5000;
    while ((card._loading || card._booting || card._continuity.state !== 'steady')
      && performance.now() < end) await sleep(16);
    await card.updateComplete;
  };
  await card.updateComplete;
  card.hass = ready; await card.updateComplete;
  await settled(); calls.length = 0;
  card.remove(); parent.append(card);
  for (let i = 0; i < 6; i++) await frame();
  const shortNoRead = !calls.some((type) => /houseplan\/(config|layout)\/get/.test(type));
  calls.length = 0;
  card.remove(); card.hass = undefined;
  // Only the wall clock ages the placement tombstone; product TTL is unchanged.
  const now = Date.now;
  Date.now = () => now() + 20_000;
  parent.append(card);
  Date.now = now;
  await sleep(80);
  const before = calls.filter((type) => /houseplan\/(config|layout)\/get/.test(type)).length;
  card.hass = ready;
  await card.updateComplete;
  await settled();
  const out = {
    shortReturnDoesNotReload: shortNoRead,
    noRequestBeforeHass: before === 0,
    delayedResumeReadsOnePair: calls.filter((type) => type === 'houseplan/config/get').length === 1
      && calls.filter((type) => type === 'houseplan/layout/get').length === 1,
    delayedResumeKeepsPlan: card.renderRoot.querySelectorAll('.room').length === 4,
  };
  calls.length = 0;
  card.remove(); card.hass = undefined;
  Date.now = () => now() + 20_000;
  parent.append(card); card.hass = ready; Date.now = now;
  await card.updateComplete;
  await settled();
  out.hassBeforeFirstLitUpdateCoalesces = calls.filter((type) => type === 'houseplan/config/get').length === 1
    && calls.filter((type) => type === 'houseplan/layout/get').length === 1;
  calls.length = 0;
  card.remove(); card.hass = undefined;
  Date.now = () => now() + 20_000;
  parent.append(card); Date.now = now;
  card.remove(); card.hass = ready;
  await sleep(80);
  out.detachBeforeLateHassCancelsIntent = !calls.some((type) => /houseplan\/(config|layout)\/get/.test(type));
  parent.append(card);
  const cold = document.createElement('houseplan-card');
  cold.setConfig({ type: 'custom:houseplan-card', title: 'Distinct cold placement', floor: 'f1' });
  parent.append(cold); await cold.updateComplete;
  const coldCalls = [];
  cold.hass = { ...ready, callWS: (message) => {
    coldCalls.push(message.type); return ready.callWS(message);
  } };
  await cold.updateComplete;
  for (let i = 0; i < 20; i++) await frame();
  out.coldLateHassReadsOnePair = coldCalls.filter((type) => type === 'houseplan/config/get').length === 1
    && coldCalls.filter((type) => type === 'houseplan/layout/get').length === 1;
  cold.remove();
  return out;
});
checkAll(reports.lateHass);
await late.browser.close();

const timeout = await launchColdView();
reports.timeout = await timeout.page.evaluate(async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const frame = () => new Promise(requestAnimationFrame);
  const until = async (test, ms = 4000) => {
    const end = performance.now() + ms;
    while (!test() && performance.now() < end) await sleep(1);
    return !!test();
  };
  const card = window.__card;
  await window.__hpTest.setServerConfig((cfg) => {
    const space = cfg.spaces.find((item) => item.id === 'f1');
    delete space.plan_url;
    space.cell_cm = 5;
    space.partitions = [{ id: 'recovery-wall', a: [0.15, 0.3], b: [0.85, 0.3], cm: 15 }];
    space.openings = [];
    space.settings = { ...space.settings, show_borders: true };
  });
  const host = document.createElement('div'); host.style.width = '600px'; document.body.append(host);
  const el = document.createElement('houseplan-space-card');
  el.setConfig({ type: 'custom:houseplan-space-card', space: 'f1', show_button: false });
  el.hass = card.hass; host.append(el);
  await until(() => el._continuity.hasCompleteFrame && card._continuity.hasCompleteFrame
    && card._continuity.state === 'steady');
  window.__addRegistryEntity('binary_sensor.recovery_closed', null, 'off');
  card.hass = window.__mkHass(); el.hass = card.hass;
  await card.updateComplete; await el.updateComplete; await frame();
  const entries = [['full', card], ['space', el]];
  const old = Object.fromEntries(entries.map(([name, node]) => [name, {
    fingerprint: node._continuity.frameFingerprint,
    timeouts: node._continuity.trace.filter((event) => event.event === 'paint-barrier-timeout').length,
  }]));
  const out = {
    oldProjectionDoesNotKnowNewContact: entries.every(([, node]) =>
      !node._renderDeviceSnapshot?.entityIds.includes('binary_sensor.recovery_closed')),
  };
  const cfg = structuredClone(card._serverCfg);
  cfg.spaces.find((item) => item.id === 'f1').openings.push({
    id: 'recovery-closed', type: 'door', length: 0.06,
    contact: 'binary_sensor.recovery_closed', host: { kind: 'partition', id: 'recovery-wall', t: 0.5 },
  });
  window.__pushServerConfig(cfg);
  // Invalidate physical stage readiness AFTER each real controller starts its
  // barrier. Nothing is patched in the controller or in the candidate snapshot.
  const blocked = new Map();
  await until(() => {
    for (const [name, node] of entries) {
      if (blocked.has(name) || node._continuity.state !== 'candidate-ready') continue;
      const fault = document.createElement('style');
      fault.textContent = '.stage, .hp-static-stage { display: none !important; }';
      node.renderRoot.append(fault); blocked.set(name, fault);
      out[`${name}PhysicalReadinessBlocked`] = node.renderRoot.querySelector('.stage, .hp-static-stage').clientHeight === 0;
    }
    return blocked.size === entries.length;
  });
  await until(() => entries.every(([name, node]) => node._continuity.trace.filter((event) =>
    event.event === 'paint-barrier-timeout').length > old[name].timeouts), 4000);
  for (const [name, node] of entries) {
    out[`${name}RealBarrierTimedOut`] = node._continuity.trace.some((event) => event.event === 'paint-barrier-timeout');
    out[`${name}TimeoutDoesNotCommitFrame`] = node._continuity.frameFingerprint === old[name].fingerprint;
    out[`${name}TimeoutRetainsMatchingCandidate`] = node._candidateDeviceSnapshot?.geometry === node._renderDeviceSnapshot?.geometry
      && node._candidateDeviceSnapshot?.entityIds.includes('binary_sensor.recovery_closed');
  }
  for (const fault of blocked.values()) fault.remove();
  const angles = [];
  const sample = () => {
    for (const [name, node] of entries) {
      const leaf = node.renderRoot.querySelector('[data-hp="opening"][data-id="recovery-closed"] .op-leaf');
      if (!leaf) { angles.push(`${name}:missing`); continue; }
      const transform = getComputedStyle(leaf).transform;
      const [a, b] = transform.startsWith('matrix(') ? transform.slice(7, -1).split(',').map(Number) : [1, 0];
      if (Math.round(Math.atan2(b, a) * 180 / Math.PI) !== 0) angles.push(`${name}:${transform}`);
    }
  };
  // An ordinary host update is an existing retry opportunity, not an HA tick.
  card.requestUpdate(); el.requestUpdate();
  for (let i = 0; i < 45; i++) { await frame(); sample(); }
  out.noNewDoorWithOldSnapshot = angles.length === 0;
  out.recoversWithoutHassTick = entries.every(([name, node]) => node._continuity.state === 'steady'
    && node._continuity.frameFingerprint !== old[name].fingerprint && !node._candidateDeviceSnapshot);
  host.remove(); return out;
});
checkAll(reports.timeout);
await timeout.browser.close();

const races = await launchColdView();
reports.races = await races.page.evaluate(async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const frame = () => new Promise(requestAnimationFrame);
  const until = async (test, ms = 4000) => {
    const end = performance.now() + ms;
    while (!test() && performance.now() < end) await sleep(1);
    return !!test();
  };
  const card = window.__card;
  const host = document.createElement('div'); host.style.width = '600px'; document.body.append(host);
  const el = document.createElement('houseplan-space-card');
  el.setConfig({ type: 'custom:houseplan-space-card', space: 'f1', show_button: false });
  el.hass = card.hass; host.append(el);
  await until(() => el._loadedOnce);
  const original = window.__mkHass();
  const held = [];
  const calls = [];
  const connection = () => ({ ...original.connection });
  const oldAuthority = { ...original, connection: connection(), callWS: async (message) => {
    calls.push(message.type);
    const response = await original.callWS(message);
    if (message.type !== 'houseplan/config/get') return response;
    const obsolete = structuredClone(response);
    obsolete.rev += 100;
    obsolete.config.spaces[0].rooms[0].name = 'Obsolete response';
    return new Promise((resolve) => held.push(() => resolve(obsolete)));
  } };
  card.hass = oldAuthority; el.hass = oldAuthority;
  window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  const twoReads = await until(() => held.length === 2);
  const latest = { ...original, connection: connection(), callWS: async (message) => {
    calls.push(message.type);
    const response = await original.callWS(message);
    if (message.type === 'houseplan/config/get') await sleep(50);
    return message.type === 'houseplan/config/get' ? { ...response, can_write: false } : response;
  } };
  card.hass = latest; el.hass = latest;
  await card.updateComplete; await el.updateComplete;
  for (const release of held) release();
  const names = (text) => [card._serverCfg, el._snap.config].map((cfg) =>
    cfg.spaces[0].rooms[0].name !== text);
  const replaced = [true, true];
  const sample = (target, text) => names(text).forEach((safe, index) => { target[index] &&= safe; });
  for (let i = 0; i < 20; i++) { await frame(); sample(replaced, 'Obsolete response'); }
  const replacement = {
    twoOldTransportsEntered: twoReads,
    fullRejectsReplacedConnection: replaced[0],
    spaceRejectsReplacedConnection: replaced[1],
    staleReadCannotRegrantWrite: card._serverCanWrite === false,
  };

  // Same-element detach invalidates an active read, not merely listeners.
  const pending = [];
  const detachedAuthority = { ...latest, connection: connection(), callWS: async (message) => {
    const response = await latest.callWS(message);
    if (message.type !== 'houseplan/config/get') return response;
    const obsolete = structuredClone(response);
    obsolete.rev += 200; obsolete.config.spaces[0].rooms[0].name = 'Detached response';
    return new Promise((resolve) => pending.push(() => resolve(obsolete)));
  } };
  card.hass = detachedAuthority; el.hass = detachedAuthority;
  window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  await until(() => pending.length === 2);
  const parent = card.parentElement;
  card.remove(); el.remove();
  card.hass = latest; el.hass = latest;
  parent.append(card); host.append(el);
  for (const release of pending) release();
  const detached = [true, true];
  for (let i = 0; i < 20; i++) { await frame(); sample(detached, 'Detached response'); }
  replacement.fullRejectsDetachedRead = detached[0];
  replacement.spaceRejectsDetachedRead = detached[1];

  // An explicit floor choice wins over a read captured for the previous floor.
  const navigation = [];
  const navigatingAuthority = { ...latest, connection: connection(), callWS: async (message) => {
    const response = await latest.callWS(message);
    if (message.type !== 'houseplan/config/get') return response;
    const obsolete = structuredClone(response);
    obsolete.rev += 300; obsolete.config.spaces[0].rooms[0].name = 'Navigated response';
    return new Promise((resolve) => navigation.push(() => resolve(obsolete)));
  } };
  card.hass = navigatingAuthority; el.hass = navigatingAuthority;
  window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  await until(() => navigation.length === 2);
  await window.__hpTest.switchSpace('garden');
  el.setConfig({ type: 'custom:houseplan-space-card', space: 'garden', show_button: false });
  el.hass = latest;
  for (const release of navigation) release();
  const navigated = [true, true];
  for (let i = 0; i < 20; i++) { await frame(); sample(navigated, 'Navigated response'); }
  replacement.fullNavigationWins = card._space === 'garden'
    && navigated[0];
  replacement.spaceNavigationWins = el._config.space === 'garden'
    && navigated[1];
  replacement.viewRecoveryDoesNotLoadEditor = !card._editorRuntime;
  replacement.viewRecoveryDoesNotWrite = !calls.some((type) => /\/(set|update|delete)$/.test(type));
  host.remove(); return replacement;
});
checkAll(reports.races);
await finish(races.browser, reports);
