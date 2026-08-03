// «Открыть/закрыть» on a curtain whose cover entity is NOT the primary one
// (owner's report 2026-08-04: «в настройках "открыть\закрыть", а по нажатию
// по-прежнему инфо-карточка»).
//
// The device below is his, entity for entity: an Aqara «Roller shade driver
// E1» ships the `cover.*` HIDDEN by the integration and a perfectly visible
// `switch.*_reverse_direction` beside it. `primaryEntity` ranks visible above
// hidden and `switch` above `cover`, so the marker's primary was the service
// switch — the tap then resolved on the domain `switch` and the action the
// user had explicitly chosen degraded to the info card, while the dialog kept
// OFFERING the action, because that check already looked at every entity of
// the device. The tap now finds the cover the same way the climate
// temperature finds the thermostat: among all of them.
//
// End to end: the action is chosen in the dialog and SAVED through the normal
// path, and the click is done on the marker the card rebuilt from that config.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const out = await page.evaluate(async () => {
  const o = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const calls = [];

  // ---- the owner's curtain driver, joined to the demo house --------------
  const ENTS = {
    // hidden by the integration — exactly as z2m ships it
    'cover.office_curtain': { entity_id: 'cover.office_curtain', device_id: 'd_curtain', platform: 'demo', hidden: true },
    'sensor.office_curtain_battery': { entity_id: 'sensor.office_curtain_battery', device_id: 'd_curtain', platform: 'demo', entity_category: 'diagnostic' },
    'switch.office_curtain_reverse': { entity_id: 'switch.office_curtain_reverse', device_id: 'd_curtain', platform: 'demo' },
    'sensor.office_curtain_motor_state': { entity_id: 'sensor.office_curtain_motor_state', device_id: 'd_curtain', platform: 'demo' },
  };
  const coverState = (state, attrs = {}) => ({
    entity_id: 'cover.office_curtain', state,
    attributes: { friendly_name: 'Office curtain', ...attrs },
  });
  const push = async (state, attrs = {}) => {
    c.hass = {
      ...c.hass,
      devices: { ...c.hass.devices,
        d_curtain: { id: 'd_curtain', name: 'Office curtain', model: 'Roller shade driver E1',
          area_id: 'bedroom', identifiers: [['demo', 'd_curtain']], entry_type: null, via_device_id: null } },
      entities: { ...c.hass.entities, ...ENTS },
      states: { ...c.hass.states,
        'cover.office_curtain': coverState(state, attrs),
        'sensor.office_curtain_battery': { entity_id: 'sensor.office_curtain_battery', state: '84', attributes: { device_class: 'battery', unit_of_measurement: '%' } },
        'switch.office_curtain_reverse': { entity_id: 'switch.office_curtain_reverse', state: 'off', attributes: { friendly_name: 'Reverse direction' } },
        'sensor.office_curtain_motor_state': { entity_id: 'sensor.office_curtain_motor_state', state: 'stopped', attributes: {} },
      },
      callService: async (dom, svc, data) => { calls.push([dom, svc, data]); return {}; },
    };
    c._regSignature = '';
    c._maybeRebuildDevices();
    c.requestUpdate();
    await c.updateComplete;
  };

  await push('closed', { device_class: 'curtain' });
  const curtain = () => c._devices.find((x) => x.bindingRef === 'd_curtain');
  o.deviceIsOnThePlan = !!curtain();
  // the premise of the whole report: the cover is NOT the primary entity
  o.primaryIsNotTheCover = curtain()?.primary === 'switch.office_curtain_reverse';
  o.coverIsAmongTheEntities = (curtain()?.entities || []).includes('cover.office_curtain');

  // ---- the dialog offers the action and SAVES it -------------------------
  c._setMode('devices'); await c.updateComplete;
  c._openMarkerDialog(curtain()); await c.updateComplete;
  const optionValues = () => [...sr().querySelectorAll('.dialog option')].map((e) => e.value);
  o.dialogOffersCover = optionValues().includes('cover');
  c._markerDialog = { ...c._markerDialog, tapAction: 'cover' };
  await c.updateComplete;
  await c._saveMarker();
  await c.updateComplete;
  const saved = (c._serverCfg.markers || []).find((m) => m.binding === 'device:d_curtain');
  o.markerSaved = saved?.tap_action === 'cover';

  // ---- and the tap on THAT marker opens the curtain -----------------------
  c._setMode('view'); c._regSignature = ''; c._maybeRebuildDevices();
  c.requestUpdate(); await c.updateComplete;
  const tap = async () => {
    c._clickDevice({ stopPropagation() {} }, curtain());
    await c.updateComplete;
    await new Promise((r) => setTimeout(r, 10));
  };
  o.tapActionSurvivedTheRebuild = curtain()?.tapAction === 'cover';
  calls.length = 0;
  await tap();
  o.closedOpensTheCover = JSON.stringify(calls[calls.length - 1] || [])
    === JSON.stringify(['cover', 'open_cover', { entity_id: 'cover.office_curtain' }]);
  o.noInfoCard = !c._infoCard;
  c._infoCard = null;

  await push('open', { device_class: 'curtain' });
  calls.length = 0;
  await tap();
  o.openClosesTheCover = JSON.stringify(calls[calls.length - 1] || [])
    === JSON.stringify(['cover', 'close_cover', { entity_id: 'cover.office_curtain' }]);

  await push('opening', { device_class: 'curtain' });
  calls.length = 0;
  await tap();
  o.travellingStops = (calls[calls.length - 1] || [])[1] === 'stop_cover';

  // the service switch, which used to be the whole story, is never touched
  o.serviceSwitchNeverCalled = !calls.some((x) => String(x[2]?.entity_id).startsWith('switch.'));

  // ---- the guarded classes still degrade, read off the COVER --------------
  await push('closed', { device_class: 'garage' });
  calls.length = 0;
  await tap();
  o.garageCallsNothing = calls.length === 0;
  o.garageShowsInfo = !!c._infoCard;
  c._infoCard = null; await c.updateComplete;
  c._setMode('devices'); await c.updateComplete;
  c._openMarkerDialog(curtain()); await c.updateComplete;
  o.dialogHidesCoverForGarage = !optionValues().includes('cover');
  c._markerDialog = null;
  c._setMode('view'); await c.updateComplete;

  return o;
});
checkAll(out);
await finish(browser, out);
