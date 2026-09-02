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
  const kettlePoint = { s: 'f1', x: 0.72, y: 0.15 };
  c._layout = { ...c._layout, d_kettle: kettlePoint };
  c._regSignature = '';
  c._maybeRebuildDevices();
  rejectKettleRelocation = true;
  window.__setRegistryArea('device', 'd_kettle', 'living_room');
  await wait(500);
  const failedConfigRestoredAndRetryable = c._layout.d_kettle?.s === kettlePoint.s
    && c._layout.d_kettle?.x === kettlePoint.x
    && c._layout.d_kettle?.y === kettlePoint.y
    && c._serverCfg.settings.marker_area_snapshot?.d_kettle?.area === 'kitchen'
    && c._areaRelocationSyncKey === ''
    && calls.some((message) => message.type === 'houseplan/layout/update'
      && message.device_id === 'd_kettle');
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

  // Lifecycle metadata is bounded by the authoritative registry, not by
  // explicit editor cleanup alone. A disappeared device with no saved marker
  // must lose its snapshot on the next full pass.
  const orphanId = 'device-that-disappeared';
  c._serverCfg = {
    ...c._serverCfg,
    settings: {
      ...c._serverCfg.settings,
      marker_area_snapshot: {
        ...c._serverCfg.settings.marker_area_snapshot,
        [orphanId]: { binding: `device:${orphanId}`, area: 'living_room' },
      },
    },
  };
  c._regSignature = '';
  c._maybeRebuildDevices();
  await wait(450);
  const authoritativeOrphanRemoved = !c._serverCfg.settings.marker_area_snapshot?.[orphanId];

  // A separate connection whose full registry calls fail models startup or a
  // limited account. The exact same orphan evidence is not authoritative and
  // therefore must not be destructive.
  const limitedConfig = structuredClone(c._serverCfg);
  limitedConfig.settings.marker_area_snapshot[orphanId] = {
    binding: `device:${orphanId}`, area: 'living_room',
  };
  const limitedHass = window.__mkHass();
  const limitedCallWS = limitedHass.callWS;
  limitedHass.connection = {};
  limitedHass.callWS = async (message) => {
    if (message.type === 'config/device_registry/list'
        || message.type === 'config/entity_registry/list') throw new Error('synthetic limited registry');
    if (message.type === 'houseplan/config/get') {
      return { config: limitedConfig, rev: 30, can_write: true };
    }
    return limitedCallWS(message);
  };
  const limitedCard = document.createElement('houseplan-card');
  limitedCard.setConfig({ type: 'custom:houseplan-card', title: 'Limited registry' });
  limitedCard.hass = limitedHass;
  document.body.append(limitedCard);
  await wait(500);
  await paint(limitedCard);
  const nonAuthoritativeOrphanPreserved = !!limitedCard._serverCfg?.settings
    ?.marker_area_snapshot?.[orphanId];
  limitedCard.remove();

  // #419: destructive snapshot cleanup uses the raw registry roster and two
  // distinct non-empty revisions. Presentation filtering is never absence.
  const registryRow = (id) => ({
    id, name: id, area_id: 'area-without-houseplan-room', disabled_by: null,
  });
  const entityRow = {
    entity_id: 'sensor.registry_witness', device_id: null,
    platform: 'demo', disabled_by: null,
  };
  const runCleanupProbe = async ({
    snapshot, deviceFrames, liveDevices = {}, rejectFirstCleanup = false,
  }) => {
    const config = structuredClone(c._serverCfg);
    config.markers = [];
    config.settings = {
      ...config.settings,
      filter_seeded: true,
      known_devices: [],
      new_device_ids: [],
      marker_area_snapshot: structuredClone(snapshot),
    };
    const probeCalls = [];
    let deviceRegistryCalls = 0;
    let entityRegistryCalls = 0;
    let cleanupWrites = 0;
    let rejected = false;
    let rev = 100;
    const base = window.__mkHass();
    const probeHass = {
      ...base,
      connection: {
        subscribeEvents: async () => () => {},
        subscribeMessage: async () => () => {},
      },
      devices: liveDevices,
      entities: { [entityRow.entity_id]: entityRow },
      states: {},
    };
    probeHass.callWS = async (message) => {
      probeCalls.push(structuredClone(message));
      if (message.type === 'config/device_registry/list') {
        const frame = deviceFrames[Math.min(deviceRegistryCalls, deviceFrames.length - 1)];
        deviceRegistryCalls += 1;
        return structuredClone(frame);
      }
      if (message.type === 'config/entity_registry/list') {
        entityRegistryCalls += 1;
        return [structuredClone(entityRow)];
      }
      if (message.type === 'houseplan/config/get') {
        return { config, rev, can_write: true };
      }
      if (message.type === 'houseplan/layout/get') return { layout: {}, rev };
      if (message.type === 'houseplan/config/set') {
        const beforeCount = Object.keys(snapshot).length;
        const afterCount = Object.keys(
          message.config?.settings?.marker_area_snapshot || {},
        ).length;
        if (afterCount < beforeCount) {
          cleanupWrites += 1;
          if (rejectFirstCleanup && !rejected) {
            rejected = true;
            throw new Error('synthetic cleanup config failure');
          }
        }
        Object.assign(config, structuredClone(message.config));
        return { ok: true, rev: ++rev };
      }
      return { ok: true };
    };
    const card = document.createElement('houseplan-card');
    card.setConfig({ type: 'custom:houseplan-card', title: 'Area cleanup probe' });
    document.body.append(card);
    card.hass = probeHass;
    for (let attempt = 0; attempt < 20 && !card._loadedOnce; attempt += 1) await wait(100);
    await wait(550);
    if (rejectFirstCleanup) {
      card._regSignature = '';
      card._maybeRebuildDevices();
      await wait(450);
    }
    const result = {
      snapshot: structuredClone(card._serverCfg?.settings?.marker_area_snapshot || {}),
      deviceIds: card._devices.map((item) => item.id),
      deviceRegistryCalls,
      entityRegistryCalls,
      cleanupWrites,
      configWrites: probeCalls.filter((message) => message.type === 'houseplan/config/set').length,
    };
    card.remove();
    return result;
  };

  const filteredRow = registryRow('filtered-but-live');
  const transientRow = registryRow('transient-device');
  const recoveredProbe = await runCleanupProbe({
    snapshot: {
      filtered: { binding: 'device:filtered-but-live', area: 'living_room' },
      transient: { binding: 'device:transient-device', area: 'living_room' },
    },
    deviceFrames: [[filteredRow], [filteredRow, transientRow]],
    liveDevices: { [filteredRow.id]: filteredRow },
  });

  const keepRow = registryRow('still-live');
  const confirmedProbe = await runCleanupProbe({
    snapshot: {
      orphan: { binding: 'device:confirmed-orphan', area: 'living_room' },
      keep: { binding: 'device:still-live', area: 'living_room' },
    },
    deviceFrames: [[keepRow], [keepRow]],
    liveDevices: { [keepRow.id]: keepRow },
    rejectFirstCleanup: true,
  });

  const emptyProbe = await runCleanupProbe({
    snapshot: {
      orphan: { binding: 'device:empty-frame-orphan', area: 'living_room' },
    },
    deviceFrames: [[]],
    liveDevices: {},
  });

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
    failedConfigRestoredAndRetryable,
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
    authoritativeOrphanRemoved,
    nonAuthoritativeOrphanPreserved,
    filteredRosterIsNotAbsence: !recoveredProbe.deviceIds.includes('filtered-but-live')
      && !!recoveredProbe.snapshot.filtered,
    transientRosterPreserved: !!recoveredProbe.snapshot.transient,
    confirmationRefreshRunsOnce: recoveredProbe.deviceRegistryCalls === 2
      && recoveredProbe.entityRegistryCalls === 2
      && recoveredProbe.cleanupWrites === 0,
    confirmedOrphanRemovedAlone: !confirmedProbe.snapshot.orphan
      && !!confirmedProbe.snapshot.keep,
    confirmedCleanupRetriesAfterWriteFailure: confirmedProbe.cleanupWrites >= 2,
    emptyRegistryPreservesSnapshot: !!emptyProbe.snapshot.orphan
      && emptyProbe.cleanupWrites === 0,
    emptyRegistryDoesNotReloadLoop: emptyProbe.deviceRegistryCalls === 1
      && emptyProbe.entityRegistryCalls === 1,
  };
});

checkAll(res);
await finish(browser, res);
