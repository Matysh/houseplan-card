// «Открыть/закрыть» on a curtain whose cover entity used to lose to an option
// switch in registry/domain order.
// (owner's report 2026-08-04: «в настройках "открыть\закрыть", а по нажатию
// по-прежнему инфо-карточка»).
//
// The device below is his, entity for entity: an Aqara «Roller shade driver
// E1» ships the `cover.*` HIDDEN by the integration and a perfectly visible
// `switch.*_reverse_direction` beside it. The shared role resolver must pick
// the real cover for status, while the explicit tap action decides whether a
// click controls it. A mixed lamp+cover still stays a lamp unless the owner
// explicitly selects the cover action.
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
    // a MIXED device: a lamp that also happens to ship a cover. Its primary is
    // meaningfully the light, and nothing below may take that away from it.
    'light.mixed': { entity_id: 'light.mixed', device_id: 'd_mixed', platform: 'demo' },
    'cover.mixed': { entity_id: 'cover.mixed', device_id: 'd_mixed', platform: 'demo' },
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
          area_id: 'bedroom', identifiers: [['demo', 'd_curtain']], entry_type: null, via_device_id: null },
        d_mixed: { id: 'd_mixed', name: 'Bedside lamp', model: 'Lamp with a blind',
          area_id: 'bedroom', identifiers: [['demo', 'd_mixed']], entry_type: null, via_device_id: null } },
      entities: { ...c.hass.entities, ...ENTS },
      states: { ...c.hass.states,
        'cover.office_curtain': coverState(state, attrs),
        'sensor.office_curtain_battery': { entity_id: 'sensor.office_curtain_battery', state: '84', attributes: { device_class: 'battery', unit_of_measurement: '%' } },
        'switch.office_curtain_reverse': { entity_id: 'switch.office_curtain_reverse', state: 'off', attributes: { friendly_name: 'Reverse direction' } },
        'sensor.office_curtain_motor_state': { entity_id: 'sensor.office_curtain_motor_state', state: 'stopped', attributes: {} },
        'light.mixed': { entity_id: 'light.mixed', state: 'on', attributes: { friendly_name: 'Bedside lamp' } },
        'cover.mixed': { entity_id: 'cover.mixed', state: 'opening', attributes: { friendly_name: 'Bedside blind', device_class: 'curtain' } },
      },
      callService: async (dom, svc, data) => { calls.push([dom, svc, data]); return {}; },
    };
    c._regSignature = '';
    c._maybeRebuildDevices();
    // park both extra markers in their own corners: the DOM assertions below
    // find a marker by its position, and the auto grid would sit them on top
    // of the demo house's own bedroom devices
    const cu = c._devices.find((x) => x.bindingRef === 'd_curtain');
    const mx = c._devices.find((x) => x.bindingRef === 'd_mixed');
    if (cu && mx) {
      c._layout = { ...c._layout,
        [cu.id]: { s: cu.space, x: 0.06, y: 0.94 },
        [mx.id]: { s: mx.space, x: 0.94, y: 0.06 } };
    }
    c.requestUpdate();
    await c.updateComplete;
  };

  await push('closed', { device_class: 'curtain' });
  const curtain = () => c._devices.find((x) => x.bindingRef === 'd_curtain');
  const mixed = () => c._devices.find((x) => x.bindingRef === 'd_mixed');
  o.deviceIsOnThePlan = !!curtain();
  // Registry order and visibility no longer let an option switch outrank the
  // actual functional entity.
  o.primaryIsTheCover = curtain()?.primary === 'cover.office_curtain';
  o.coverIsAmongTheEntities = (curtain()?.entities || []).includes('cover.office_curtain');

  // ---- the dialog offers the action and SAVES it -------------------------
  c._setMode('devices'); await c.updateComplete;
  c._openMarkerDialog(curtain()); await c.updateComplete;
  const optionValues = () => [...sr().querySelectorAll('.dialog option')].map((e) => e.value);
  o.dialogOffersCover = optionValues().includes('cover');
  c._markerDialog = { ...c._markerDialog, tapAction: 'cover', display: 'icon_ripple' };
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

  // ---- and the marker SHOWS that cover, not the service switch -----------
  // Owner, 2026-08-04: «нет ни дышащего кольца во время хода, ни рамки
  // "открыто", ни морфинга иконки». (The «открыто» frame itself was retired
  // for covers later the same day — the marker still had to start speaking for
  // the cover, which is what this section pins.) Same cause, same helper:
  // _stateClass and
  // the icon morph read d.primary, so the plan reported the state of
  // `switch.*_reverse_direction`. The rule (docs/FILTERING.md «What a marker
  // SHOWS»): the marker indicates the entity its tap ACTS ON — the cover
  // exactly when the owner has explicitly chosen «Открыть/закрыть».
  const devEl = (dev) => {
    const v = c._viewOr(c._baseVb());
    const p = c._pos(dev);
    const left = ((p.x - v.x) / v.w) * 100;
    const top = ((p.y - v.y) / v.h) * 100;
    return [...sr().querySelectorAll('.devlayer .dev')].find((e) =>
      Math.abs(parseFloat(e.style.left) - left) < 0.4 && Math.abs(parseFloat(e.style.top) - top) < 0.4);
  };
  const clsOf = (dev) => [...(devEl(dev)?.classList || [])];
  const iconOf = (dev) => devEl(dev)?.querySelector('ha-icon')?.getAttribute('icon') || '';
  const setSwitch = async (state) => {
    c.hass = { ...c.hass, states: { ...c.hass.states,
      'switch.office_curtain_reverse': { entity_id: 'switch.office_curtain_reverse', state, attributes: {} } } };
    c.requestUpdate(); await c.updateComplete;
  };

  await push('closed', { device_class: 'curtain' });
  o.markerIsOnScreen = !!devEl(curtain());
  o.closedIsNeitherOpenNorMoving =
    !clsOf(curtain()).includes('open') && !clsOf(curtain()).includes('activity-transition');
  o.closedIconIsClosedCurtains = iconOf(curtain()) === 'mdi:curtains-closed';

  await push('open', { device_class: 'curtain' });
  // the plate is neutral in every cover state since 2026-08-04 — the morph is
  // the whole open/closed story (smoke_cover_no_plate.mjs)
  o.openWearsNoColouredPlate =
    !clsOf(curtain()).includes('open') && !clsOf(curtain()).includes('on');
  o.openIconIsOpenCurtains = iconOf(curtain()) === 'mdi:curtains';

  await push('opening', { device_class: 'curtain' });
  o.travellingBreathes = clsOf(curtain()).includes('activity-transition');
  await push('closing', { device_class: 'curtain' });
  o.closingBreathesToo = clsOf(curtain()).includes('activity-transition');
  o.stateClassIsTheSameStory = c._stateClass(curtain()).includes('activity-transition');

  // the service switch never speaks for the marker again: reverse-direction
  // ON used to paint the curtain yellow («включено») while it stood still
  await push('closed', { device_class: 'curtain' });
  await setSwitch('on');
  o.reverseSwitchNeverLightsTheMarker = !clsOf(curtain()).includes('on');

  // Status and action are independent: taking the explicit action away keeps
  // the resolved cover status, but a click returns to the ordinary info path.
  const savedMarker = (c._serverCfg.markers || []).find((m) => m.binding === 'device:d_curtain');
  savedMarker.tap_action = 'info';
  await push('opening', { device_class: 'curtain' });
  await setSwitch('on');
  o.withoutTheActionResolvedCoverSpeaks = clsOf(curtain()).includes('activity-transition')
    && !clsOf(curtain()).includes('on');
  savedMarker.tap_action = 'cover';
  await push('closed', { device_class: 'curtain' });
  await setSwitch('off');
  o.actionBackMeansCoverBack = iconOf(curtain()) === 'mdi:curtains-closed';

  // ---- the auditor's own probe: BOTH entities visible ---------------------
  // The same rule must hold when BOTH entities are visible.
  ENTS['cover.office_curtain'] = { ...ENTS['cover.office_curtain'], hidden: false };
  await push('closed', { device_class: 'curtain' });
  await setSwitch('off');
  o.visibleCoverIsThePrimary = curtain()?.primary === 'cover.office_curtain';
  calls.length = 0;
  await tap();
  o.visibleCoverOpensOnTap = JSON.stringify(calls[calls.length - 1] || [])
    === JSON.stringify(['cover', 'open_cover', { entity_id: 'cover.office_curtain' }]);
  o.visibleCoverAlsoIndicates = iconOf(curtain()) === 'mdi:curtains-closed';
  o.noInfoCardForTheVisibleCover = !c._infoCard;

  // ---- a MIXED device is not hijacked ------------------------------------
  // A lit lamp that also owns a cover keeps the lamp: no explicit «Open/close»
  // on this marker, so nothing changes for it — and even if there were one,
  // a shining light still wins the yellow plate (the glow and the badge may
  // never disagree, owner's principle 2026-07-29).
  o.mixedPrimaryIsTheLight = mixed()?.primary === 'light.mixed';
  o.mixedCoverIsTravelling = c.hass.states['cover.mixed'].state === 'opening';
  o.mixedStaysALitLamp = clsOf(mixed()).includes('on') && !clsOf(mixed()).includes('activity-transition');
  // its icon is the device's own auto icon, NOT the cover's open/closed pair
  o.mixedIconIsNotMorphedByTheCover =
    iconOf(mixed()) === mixed()?.icon && !iconOf(mixed()).includes('curtains');

  return o;
});
checkAll(out);
await finish(browser, out);
