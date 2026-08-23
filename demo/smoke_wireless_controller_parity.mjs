// #274: a wireless controller whose event is `unknown` still has live
// battery/LQI/update siblings. A deleted standalone marker for its display
// source used to constrain the saved plan roster but disappear from
// deviceFromMarkerDraft(), so plan and preview classified the same marker
// differently and controllerAvailability() was skipped on the saved face.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch();
const out = await page.evaluate(async () => {
  const result = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const room = c._spaceModel().rooms.find((item) => item.id && item.area);
  const deviceId = 'issue-274-wireless';
  const markerId = 'issue-274-marker';
  const tombstoneId = 'issue-274-target-tombstone';
  const target = 'light.floor_lamp';
  const own = [
    'event.issue_274_action',
    'sensor.issue_274_battery',
    'sensor.issue_274_linkquality',
    'update.issue_274',
  ];
  const marker = {
    id: markerId,
    binding: `device:${deviceId}`,
    name: 'Issue 274 wireless switch',
    icon: 'mdi:light-switch',
    tap_action: 'toggle',
    controls: [target],
    space: c._space,
    area: room.area,
  };
  const tombstone = {
    id: tombstoneId,
    binding: `entity:${target}`,
    removed: true,
    hidden: true,
  };

  c.hass = {
    ...c.hass,
    devices: {
      ...c.hass.devices,
      [deviceId]: {
        id: deviceId,
        name: 'Issue 274 wireless switch',
        model: 'Wireless switch',
        area_id: room.area,
        identifiers: [['demo', deviceId]],
        entry_type: null,
        via_device_id: null,
      },
    },
    entities: {
      ...c.hass.entities,
      [own[0]]: { entity_id: own[0], device_id: deviceId, platform: 'demo' },
      [own[1]]: {
        entity_id: own[1], device_id: deviceId, platform: 'demo',
        entity_category: 'diagnostic',
      },
      [own[2]]: {
        entity_id: own[2], device_id: deviceId, platform: 'demo',
        entity_category: 'diagnostic',
      },
      [own[3]]: {
        entity_id: own[3], device_id: deviceId, platform: 'demo',
        entity_category: 'config',
      },
    },
    states: {
      ...c.hass.states,
      [own[0]]: { entity_id: own[0], state: 'unknown', attributes: {} },
      [own[1]]: {
        entity_id: own[1], state: '100',
        attributes: { device_class: 'battery', unit_of_measurement: '%' },
      },
      [own[2]]: {
        entity_id: own[2], state: '164',
        attributes: { unit_of_measurement: 'lqi' },
      },
      [own[3]]: { entity_id: own[3], state: 'off', attributes: {} },
      [target]: { ...c.hass.states[target], state: 'off' },
    },
  };
  c._serverCfg = {
    ...c._serverCfg,
    markers: [
      ...(c._serverCfg.markers || []).filter((item) =>
        ![markerId, tombstoneId].includes(item.id)),
      marker,
      tombstone,
    ],
  };
  c._layout = {
    ...c._layout,
    [markerId]: { s: c._space, x: 0.5, y: 0.5 },
  };
  c._regSignature = '';
  c._maybeRebuildDevices();
  c.requestUpdate();
  await c.updateComplete;

  const controller = () => c._devices.find((item) => item.id === markerId);
  result.savedControllerBuilt = !!controller();
  result.savedRosterHasAllSiblings = JSON.stringify(controller()?.entities) === JSON.stringify(own);
  result.deletedStandaloneTargetIsRuntimeFiltered = controller()?.controls?.length === 0;

  c._setMode('view');
  await c.updateComplete;
  const savedPresentation = c._devicePresentation(controller(), true);
  const planElement = sr().querySelector(`.dev[data-id="${markerId}"]`);
  result.planAvailableNeutral = savedPresentation.visual.availability === 'available'
    && savedPresentation.visual.status === 'neutral'
    && !savedPresentation.classes.includes('unavail');
  result.planKeepsLiveLqi = savedPresentation.lqiText === '164'
    && planElement?.textContent?.includes('164');
  result.planDomAgrees = planElement?.getAttribute('data-state') === 'neutral'
    && !planElement?.classList.contains('unavail');

  c._setMode('devices');
  await c.updateComplete;
  c._openMarkerDialog(controller());
  await c.updateComplete;
  const previewDevice = c._markerPreviewDevice(c._markerDialog);
  const preview = sr().querySelector('hp-device-preview');
  await preview?.updateComplete;
  result.previewHonoursFullMarkerRoster = previewDevice?.controls?.length === 0;
  result.previewMatchesPlan = preview?.presentation?.sourceKind === savedPresentation.sourceKind
    && JSON.stringify(preview?.presentation?.visual) === JSON.stringify(savedPresentation.visual)
    && JSON.stringify(preview?.presentation?.classes) === JSON.stringify(savedPresentation.classes)
    && preview?.presentation?.lqiText === savedPresentation.lqiText;
  result.previewTextIsNotUnavailable = !preview?.shadowRoot?.textContent?.includes('Unavailable');

  // Remove only the standalone marker tombstone: the configured group is now
  // active again, and both surfaces must follow its working state together.
  c._serverCfg = {
    ...c._serverCfg,
    markers: c._serverCfg.markers.filter((item) => item.id !== tombstoneId),
  };
  c.hass = {
    ...c.hass,
    states: { ...c.hass.states, [target]: { ...c.hass.states[target], state: 'on' } },
  };
  c._regSignature = '';
  c._maybeRebuildDevices();
  c.requestUpdate();
  await c.updateComplete;
  const activePresentation = c._devicePresentation(controller(), true, true);
  const activePreviewDevice = c._markerPreviewDevice(c._markerDialog);
  const activePreview = sr().querySelector('hp-device-preview');
  await activePreview?.updateComplete;
  result.activeTargetRestoredOnBothRosters = JSON.stringify(controller()?.controls) === JSON.stringify([target])
    && JSON.stringify(activePreviewDevice?.controls) === JSON.stringify([target]);
  result.activeTargetWorksOnBothSurfaces = activePresentation.visual.status === 'working'
    && activePreview?.presentation?.visual?.status === 'working';

  return result;
});

checkAll(out);
await finish(browser, out);
