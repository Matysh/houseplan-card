// #126: authoritative HA Area changes supersede stale layout on the full card
// and on the read-only hosted space card before persistence can help it.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1000, height: 850 }, 1);
const res = await page.evaluate(async () => {
  const c = window.__card;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const paint = async (card = c) => {
    card.requestUpdate();
    await card.updateComplete;
  };
  const calls = [];
  let rejectKettleRelocation = false;
  const hass = window.__mkHass();
  const callWS = hass.callWS;
  hass.callWS = async (message) => {
    calls.push(structuredClone(message));
    if (rejectKettleRelocation && message.type === 'houseplan/config/set'
        && message.config?.settings?.marker_area_snapshot?.d_kettle?.area === 'living_room') {
      rejectKettleRelocation = false;
      throw new Error('synthetic config failure');
    }
    return callWS(message);
  };
  c.hass = hass;
  await paint();

  c._serverCfg = {
    ...c._serverCfg,
    settings: {
      ...c._serverCfg.settings,
      marker_area_snapshot: {
        ...(c._serverCfg.settings.marker_area_snapshot || {}),
        d_light1: { binding: 'device:d_light1', area: 'living_room' },
      },
      new_device_ids: [],
    },
  };
  c._layout = { ...c._layout, d_light1: { s: 'f1', x: 0.22, y: 0.22 } };
  c._regSignature = '';
  c._maybeRebuildDevices();
  await paint();
  const oldLeft = Number.parseFloat(
    c.renderRoot.querySelector('.dev[data-id="d_light1"]')?.style.left || '0',
  );

  window.__setRegistryArea('device', 'd_light1', 'kitchen');
  await wait(450);
  await paint();
  const moved = c._devices.find((device) => device.id === 'd_light1');
  const movedEl = c.renderRoot.querySelector('.dev[data-id="d_light1"]');
  const newLeft = Number.parseFloat(movedEl?.style.left || '0');
  const firstDeleteCount = calls.filter(
    (message) => message.type === 'houseplan/layout/delete' && message.device_id === 'd_light1',
  ).length;
  const firstAttentionShown = c._serverCfg.settings.new_device_ids?.includes('d_light1')
    && !!movedEl?.querySelector('.newdot');

  // An identical authoritative callback must not start another persistence loop.
  window.__setRegistryArea('device', 'd_light1', 'kitchen');
  await wait(300);
  const secondDeleteCount = calls.filter(
    (message) => message.type === 'houseplan/layout/delete' && message.device_id === 'd_light1',
  ).length;

  // A dialog opened before another Area transition may show the effective
  // room, but saving an unrelated field must not persist that stale display as
  // an explicit House Plan override.
  c._serverCfg = {
    ...c._serverCfg,
    settings: {
      ...c._serverCfg.settings,
      marker_area_snapshot: {
        ...c._serverCfg.settings.marker_area_snapshot,
        d_lamp: { binding: 'device:d_lamp', area: 'living_room' },
      },
    },
  };
  c._layout = { ...c._layout, d_lamp: { s: 'f1', x: 0.42, y: 0.5 } };
  c._regSignature = '';
  c._maybeRebuildDevices();
  c._setMode('devices');
  c._openMarkerDialog(c._devices.find((device) => device.id === 'd_lamp'));
  await paint();
  window.__setRegistryArea('device', 'd_lamp', 'kitchen');
  await wait(450);
  const roomDraftRefreshed = c._markerDialog?.room === 'f1#kitchen'
    && c._markerDialog?.roomTouched === false;
  c._markerDialog = { ...c._markerDialog, name: 'Floor lamp renamed' };
  await c._saveMarker();
  const savedLamp = c._serverCfg.markers.find((marker) => marker.id === 'd_lamp');
  c._setMode('view');
  await paint();

  // Delete is committed before provenance. A rejected config write restores
  // the old local snapshot and the next authoritative pass retries safely.
  c._serverCfg = {
    ...c._serverCfg,
    settings: {
      ...c._serverCfg.settings,
      marker_area_snapshot: {
        ...c._serverCfg.settings.marker_area_snapshot,
        d_kettle: { binding: 'device:d_kettle', area: 'kitchen' },
      },
    },
  };
  c._layout = { ...c._layout, d_kettle: { s: 'f1', x: 0.72, y: 0.15 } };
  c._regSignature = '';
  c._maybeRebuildDevices();
  rejectKettleRelocation = true;
  window.__setRegistryArea('device', 'd_kettle', 'living_room');
  await wait(500);
  const failedConfigRetryable = !c._layout.d_kettle
    && c._serverCfg.settings.marker_area_snapshot?.d_kettle?.area === 'kitchen'
    && c._areaRelocationSyncKey === '';
  window.__setRegistryArea('device', 'd_kettle', 'living_room');
  await wait(500);
  await paint();
  const configRetrySucceeded = c._serverCfg.settings.marker_area_snapshot?.d_kettle?.area
    === 'living_room' && c._serverCfg.settings.new_device_ids?.includes('d_kettle');

  // Cross-space registry movement uses the same production coordinator: the
  // old Garden point is deleted and the device joins the f1 autogrid.
  c._serverCfg = {
    ...c._serverCfg,
    settings: {
      ...c._serverCfg.settings,
      marker_area_snapshot: {
        ...c._serverCfg.settings.marker_area_snapshot,
        d_gate: { binding: 'device:d_gate', area: 'garden' },
      },
    },
  };
  c._layout = { ...c._layout, d_gate: { s: 'garden', x: 0.73, y: 0.22 } };
  c._regSignature = '';
  c._maybeRebuildDevices();
  window.__setRegistryArea('device', 'd_gate', 'living_room');
  await wait(450);
  await paint();
  const crossSpaceDevice = c._devices.find((device) => device.id === 'd_gate');
  const crossSpaceDeleteCount = calls.filter(
    (message) => message.type === 'houseplan/layout/delete' && message.device_id === 'd_gate',
  ).length;

  // An explicitly persisted entity binding follows its own registry Area,
  // independently of a device marker.
  window.__setRegistryArea('entity', 'sun.sun', 'living_room');
  c._serverCfg = {
    ...c._serverCfg,
    markers: [
      ...c._serverCfg.markers.filter((marker) => marker.id !== 'entity_sun'),
      { id: 'entity_sun', binding: 'entity:sun.sun' },
    ],
    settings: {
      ...c._serverCfg.settings,
      marker_area_snapshot: {
        ...c._serverCfg.settings.marker_area_snapshot,
        entity_sun: { binding: 'entity:sun.sun', area: 'living_room' },
      },
    },
  };
  c._layout = { ...c._layout, entity_sun: { s: 'f1', x: 0.20, y: 0.30 } };
  c._regSignature = '';
  c._maybeRebuildDevices();
  window.__setRegistryArea('entity', 'sun.sun', 'kitchen');
  await wait(450);
  await paint();
  const entityDevice = c._devices.find((device) => device.id === 'entity_sun');

  // A user-owned room override remains authoritative when HA changes Area.
  c._serverCfg = {
    ...c._serverCfg,
    markers: [
      ...c._serverCfg.markers.filter((marker) => marker.id !== 'd_tv'),
      { id: 'd_tv', binding: 'device:d_tv', space: 'f1', area: 'living_room' },
    ],
    settings: {
      ...c._serverCfg.settings,
      marker_area_snapshot: {
        ...c._serverCfg.settings.marker_area_snapshot,
        d_tv: { binding: 'device:d_tv', area: 'living_room' },
      },
    },
  };
  const explicitPoint = { s: 'f1', x: 0.13, y: 0.50 };
  c._layout = { ...c._layout, d_tv: explicitPoint };
  c._regSignature = '';
  c._maybeRebuildDevices();
  const explicitDeletesBefore = calls.filter(
    (message) => message.type === 'houseplan/layout/delete' && message.device_id === 'd_tv',
  ).length;
  window.__setRegistryArea('device', 'd_tv', 'kitchen');
  await wait(350);
  await paint();
  const explicitDevice = c._devices.find((device) => device.id === 'd_tv');
  const explicitDeletesAfter = calls.filter(
    (message) => message.type === 'houseplan/layout/delete' && message.device_id === 'd_tv',
  ).length;

  // A markerless light group is a composite, not a direct entity marker. Its
  // Area may change, but #126 must not discard its saved point or flag it.
  window.__addRegistryEntity('light.area_group', 'living_room', 'on', 'group');
  await wait(150);
  c._regSignature = '';
  c._maybeRebuildDevices();
  await paint();
  const compositeId = 'lg_light.area_group';
  const compositePoint = { s: 'f1', x: 0.30, y: 0.40 };
  c._layout = { ...c._layout, [compositeId]: compositePoint };
  c._serverCfg = {
    ...c._serverCfg,
    settings: {
      ...c._serverCfg.settings,
      marker_area_snapshot: {
        ...c._serverCfg.settings.marker_area_snapshot,
        [compositeId]: { binding: 'entity:light.area_group', area: 'living_room' },
      },
    },
  };
  const compositeDeletesBefore = calls.filter(
    (message) => message.type === 'houseplan/layout/delete' && message.device_id === compositeId,
  ).length;
  const compositeAttentionBefore = c._newIds.has(compositeId);
  window.__setRegistryArea('entity', 'light.area_group', 'kitchen');
  await wait(350);
  await paint();
  const compositeDevice = c._devices.find((device) => device.id === compositeId);
  const compositeDeletesAfter = calls.filter(
    (message) => message.type === 'houseplan/layout/delete' && message.device_id === compositeId,
  ).length;

  // Cold-start legacy backfill: the first authoritative build sees a saved
  // point strictly inside the old Area room but no provenance. It must run
  // through the real card startup and preserve delete-before-config ordering.
  const coldConfig = structuredClone(c._serverCfg);
  coldConfig.settings.marker_area_snapshot = {
    ...coldConfig.settings.marker_area_snapshot,
  };
  delete coldConfig.settings.marker_area_snapshot.d_motion;
  coldConfig.settings.new_device_ids = (coldConfig.settings.new_device_ids || [])
    .filter((id) => id !== 'd_motion');
  const coldLayout = { ...c._layout, d_motion: { s: 'f1', x: 0.40, y: 0.75 } };
  window.__setRegistryArea('device', 'd_motion', 'kitchen');
  await wait(100);
  const coldCalls = [];
  let coldRev = 40;
  const coldHass = window.__mkHass();
  const coldBaseCallWS = coldHass.callWS;
  coldHass.callWS = async (message) => {
    coldCalls.push(structuredClone(message));
    if (message.type === 'houseplan/config/get') {
      return { config: coldConfig, rev: coldRev, can_write: true };
    }
    if (message.type === 'houseplan/layout/get') {
      return { layout: coldLayout, rev: coldRev };
    }
    if (message.type === 'houseplan/layout/delete') {
      delete coldLayout[message.device_id];
      return { ok: true, rev: ++coldRev };
    }
    if (message.type === 'houseplan/config/set') {
      Object.assign(coldConfig, structuredClone(message.config));
      return { ok: true, rev: ++coldRev };
    }
    return coldBaseCallWS(message);
  };
  const coldCard = document.createElement('houseplan-card');
  coldCard.setConfig({ type: 'custom:houseplan-card', title: 'Cold Area backfill' });
  document.body.append(coldCard);
  coldCard.hass = coldHass;
  for (let attempt = 0; attempt < 20 && !coldCard._loadedOnce; attempt += 1) await wait(100);
  await wait(450);
  await paint(coldCard);
  const coldDeleteIndex = coldCalls.findIndex(
    (message) => message.type === 'houseplan/layout/delete' && message.device_id === 'd_motion',
  );
  const coldConfigIndex = coldCalls.findIndex(
    (message) => message.type === 'houseplan/config/set'
      && message.config?.settings?.marker_area_snapshot?.d_motion?.area === 'kitchen',
  );
  const coldDevice = coldCard._devices.find((device) => device.id === 'd_motion');
  const coldStartBackfilled = coldDevice?.area === 'kitchen'
    && !coldCard._layout.d_motion
    && coldCard._serverCfg.settings.marker_area_snapshot?.d_motion?.area === 'kitchen'
    && coldCard._serverCfg.settings.new_device_ids?.includes('d_motion')
    && coldDeleteIndex >= 0 && coldConfigIndex > coldDeleteIndex;
  coldCard.remove();

  // A separate read-only card receives an old snapshot/layout but the already
  // authoritative new registry Area. It must be truthful without any writes.
  const staticConfig = structuredClone(c._serverCfg);
  staticConfig.settings.marker_area_snapshot.d_leak = {
    binding: 'device:d_leak', area: 'living_room',
  };
  staticConfig.settings.new_device_ids = [];
  const staticLayout = { ...c._layout, d_leak: { s: 'f1', x: 0.22, y: 0.22 } };
  const staticCalls = [];
  const staticHass = window.__mkHass();
  const staticCallWS = staticHass.callWS;
  staticHass.callWS = async (message) => {
    staticCalls.push(structuredClone(message));
    if (message.type === 'houseplan/config/get') {
      return { config: staticConfig, rev: 20, can_write: false };
    }
    if (message.type === 'houseplan/layout/get') return { layout: staticLayout, rev: 20 };
    return staticCallWS(message);
  };
  const staticCard = document.createElement('houseplan-space-card');
  staticCard.setConfig({ type: 'custom:houseplan-space-card', space: 'f1' });
  staticCard.hass = staticHass;
  document.body.append(staticCard);
  await wait(500);
  await paint(staticCard);
  const staticEl = staticCard.renderRoot.querySelector('.dev[data-id="d_leak"]');
  const staticLeft = Number.parseFloat(staticEl?.style.left || '0');

  return {
    movedToRegistryArea: moved?.area === 'kitchen' && moved?.space === 'f1',
    staleLayoutDeleted: !c._layout.d_light1,
    provenanceAdvanced: c._serverCfg.settings.marker_area_snapshot?.d_light1?.area === 'kitchen',
    attentionShown: firstAttentionShown,
    autoGridReplacedOldPoint: oldLeft < 40 && newLeft > 50,
    deleteFirstAndOnce: firstDeleteCount === 1 && secondDeleteCount === 1,
    configWritten: calls.some((message) => message.type === 'houseplan/config/set'),
    roomDraftRefreshed,
    noStaleExplicitOverride: !!savedLamp
      && savedLamp.area === undefined && savedLamp.room_id === undefined,
    failedConfigRetryable,
    configRetrySucceeded,
    crossSpaceRelocated: crossSpaceDevice?.space === 'f1'
      && crossSpaceDevice?.area === 'living_room'
      && !c._layout.d_gate
      && c._serverCfg.settings.marker_area_snapshot?.d_gate?.area === 'living_room'
      && crossSpaceDeleteCount === 1,
    standaloneEntityRelocated: entityDevice?.bindingKind === 'entity'
      && entityDevice?.bindingRef === 'sun.sun'
      && entityDevice?.area === 'kitchen'
      && !c._layout.entity_sun
      && c._serverCfg.settings.marker_area_snapshot?.entity_sun?.area === 'kitchen',
    explicitOverrideExcluded: explicitDevice?.area === 'living_room'
      && c._layout.d_tv?.s === explicitPoint.s
      && c._layout.d_tv?.x === explicitPoint.x
      && c._layout.d_tv?.y === explicitPoint.y
      && explicitDeletesAfter === explicitDeletesBefore,
    compositeGroupExcluded: compositeDevice?.marker == null
      && compositeDevice?.area === 'kitchen'
      && c._layout[compositeId]?.x === compositePoint.x
      && c._layout[compositeId]?.y === compositePoint.y
      && compositeDeletesAfter === compositeDeletesBefore
      && c._newIds.has(compositeId) === compositeAttentionBefore
      && !c._areaRelocationIds.has(compositeId),
    coldStartBackfilled,
    staticReadOnlyProjection: staticCard._areaRelocationIds.has('d_leak')
      && staticLeft > 50 && !!staticEl?.querySelector('.newdot'),
    staticMadeNoWrites: !staticCalls.some((message) =>
      message.type === 'houseplan/config/set'
        || ['houseplan/layout/set', 'houseplan/layout/update', 'houseplan/layout/delete']
          .includes(message.type)),
  };
});

checkAll(res);
await finish(browser, res);
