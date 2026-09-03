// #441: adding a second vacuum map is a UI draft, never an invalid route with
// `space: ''`. The same smoke covers both add entry points and rejected saves.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();

const out = await page.evaluate(async () => {
  const c = window.__card;
  const o = {};
  const sr = () => c.shadowRoot || c.renderRoot;
  const waitFor = async (read, timeout = 2000) => {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const value = read();
      if (value) return value;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return null;
  };

  await new Promise((resolve) => setTimeout(resolve, 650));
  c._saveConfigDebounced?.flush?.();
  await c._writeChain;

  const originalCallWS = c.hass.callWS;
  c.hass = {
    ...c.hass,
    entities: {
      ...c.hass.entities,
      'camera.mower_map': {
        entity_id: 'camera.mower_map', device_id: 'd_mower', platform: 'demo', disabled_by: null,
      },
      'camera.mower_upstairs': {
        entity_id: 'camera.mower_upstairs', device_id: 'd_mower', platform: 'demo', disabled_by: null,
      },
    },
    states: {
      ...c.hass.states,
      'camera.mower_map': {
        state: 'idle', attributes: {
          friendly_name: 'Main map', map_name: 'm1', vacuum_position: { x: 1, y: 2 },
        },
      },
      'camera.mower_upstairs': {
        state: 'idle', attributes: {
          friendly_name: 'Upstairs map', map_name: 'm2', vacuum_position: { x: 1, y: 2 },
        },
      },
    },
  };
  c._serverCfg.markers = [{
    id: 'd_mower', binding: 'device:d_mower', space: 'garden', area: 'garden',
    vacuum: { source: 'camera.mower_map', map_routes: [] },
  }];
  c._regSignature = '';
  c._maybeRebuildDevices();
  c._setMode('devices');
  await c.updateComplete;
  c._openMarkerDialog(c._devices.find((device) => device.id === 'd_mower'));
  await c.updateComplete;

  const routes = () => c._serverCfg.markers.find((marker) => marker.id === 'd_mower')
    ?.vacuum?.map_routes || [];
  const addCurrent = () => sr().querySelector('.vacroute-add-current');
  const pending = () => sr().querySelector('.vacroute.pending');

  // The first route is a draft too, but its only safe default is the dock floor.
  addCurrent()?.click();
  await c.updateComplete;
  o.firstRoutePreselectsDock = pending()?.querySelector('.vacroute-draft-space')?.value === 'garden';
  o.firstDraftDoesNotWrite = routes().length === 0;
  pending()?.querySelector('button.ghostbtn')?.click();
  await c.updateComplete;

  // Start with one accepted route, then exercise the separate-source entry.
  c._serverCfg.markers[0].vacuum.map_routes = [{
    id: 'r1', source: 'camera.mower_map', map_id: 'm1', space: 'garden', calibration: null,
  }];
  c._regSignature = '';
  c._maybeRebuildDevices();
  c.requestUpdate();
  await c.updateComplete;
  const sourceDetails = sr().querySelector('details.vacroute-sources');
  if (sourceDetails) sourceDetails.open = true;
  await c.updateComplete;
  [...(sourceDetails?.querySelectorAll('button.vacsource') || [])]
    .find((button) => button.textContent.includes('camera.mower_upstairs'))?.click();
  await c.updateComplete;
  o.separateSourceStartsBlank = pending()?.querySelector('.vacroute-draft-space')?.value === '';
  o.blankDraftCannotSave = pending()?.querySelector('.vacroute-draft-save')?.disabled === true;
  o.separateSourceDoesNotWrite = routes().length === 1;
  pending()?.querySelector('button.ghostbtn')?.click();
  await c.updateComplete;
  o.cancelLeavesAcceptedRoutes = !pending() && routes().length === 1;

  // The same source reports another map. Confirm once against a rejecting
  // backend, then retry successfully without reopening the dialog.
  c.hass = { ...c.hass, states: { ...c.hass.states,
    'camera.mower_map': {
      state: 'idle', attributes: {
        friendly_name: 'Main map', map_name: 'm2', vacuum_position: { x: 1, y: 2 },
      },
    },
  } };
  c._regSignature = '';
  c._maybeRebuildDevices();
  c.requestUpdate();
  await c.updateComplete;
  addCurrent()?.click();
  await c.updateComplete;
  o.secondCurrentStartsBlank = pending()?.querySelector('.vacroute-draft-space')?.value === '';
  const select = pending()?.querySelector('.vacroute-draft-space');
  if (select) {
    select.value = 'f1';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }
  await c.updateComplete;
  o.validFloorEnablesSave = pending()?.querySelector('.vacroute-draft-save')?.disabled === false;

  const writes = [];
  let rejectNext = true;
  c.hass = { ...c.hass, callWS: async (message) => {
    if (message.type === 'houseplan/config/set') {
      writes.push(message);
      if (rejectNext) {
        rejectNext = false;
        throw new Error('synthetic route rejection');
      }
    }
    return originalCallWS(message);
  } };
  pending()?.querySelector('.vacroute-draft-save')?.click();
  await waitFor(() => writes.length === 1 && pending()?.querySelector('.vacroute-draft-save')?.disabled === false);
  o.rejectionRestoresAcceptedMarker = routes().length === 1 && routes()[0].id === 'r1';
  o.rejectionKeepsEditorUsable = !!pending()
    && pending().querySelector('.vacroute-draft-space')?.value === 'f1';
  o.rejectedPayloadWasValid = writes[0]?.config?.markers
    ?.find((marker) => marker.id === 'd_mower')?.vacuum?.map_routes
    ?.every((route) => !!route.space) === true;

  pending()?.querySelector('.vacroute-draft-save')?.click();
  await waitFor(() => routes().length === 2 && !pending());
  const added = routes().find((route) => route.map_id === 'm2');
  o.retryAddsExactlyOneRoute = routes().length === 2;
  o.retryKeepsExactIdentity = added?.source === 'camera.mower_map'
    && added?.space === 'f1' && added?.calibration === null;
  o.noEmptySpaceEverSubmitted = writes.every((write) => write.config.markers
    .find((marker) => marker.id === 'd_mower').vacuum.map_routes
    .every((route) => !!route.space));

  c.hass = { ...c.hass, callWS: originalCallWS };
  return o;
});

checkAll(out);
await finish(browser, out);
