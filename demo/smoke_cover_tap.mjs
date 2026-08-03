// Covers: the «Open/close» tap action + the travelling indication
// (owner's contract 2026-08-03).
//
//   closed              -> cover.open_cover
//   open / ajar         -> cover.close_cover
//   opening / closing   -> cover.stop_cover   (a tap during travel is a STOP;
//                          the next tap simply travels the other way)
//   unknown             -> cover.toggle, no morphing, no pulse
//
// The option is offered ONLY for a binding that HAS a cover entity, and never
// for the guarded classes (garage/door/gate) — for those a value smuggled into
// the config degrades to 'info', exactly like a card-wide toggle does.
// While travelling the icon breathes a soft ring (.covermove, the vacuum
// puck's 2.2s period) and the plate stays NEUTRAL — yellow means «включено».
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const out = await page.evaluate(async () => {
  const o = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const calls = [];
  const YELLOW = 'rgb(255, 212, 92)'; // --hp-on, the «включено» plate

  const gateEntity = (state, attrs) => ({
    entity_id: 'cover.gate', state,
    attributes: { friendly_name: 'Gate', ...attrs },
  });
  /** Push a cover state into hass keeping the service recorder in place. */
  const setCover = async (state, attrs = {}) => {
    c.hass = {
      ...c.hass,
      states: { ...c.hass.states, 'cover.gate': gateEntity(state, attrs) },
      callService: async (dom, svc, data) => { calls.push([dom, svc, data]); return {}; },
    };
    c.requestUpdate();
    await c.updateComplete;
  };
  /** Marker for the gate device: tap action + optional confirmation.
   *  `solo` also hides the mower, leaving exactly one badge in the Garden —
   *  the indication checks then read the cover's own plate, not a neighbour's. */
  const setMarker = async (tapAction, confirm = false, solo = false) => {
    c._serverCfg = {
      ...c._serverCfg,
      markers: [
        { id: 'm_gate', binding: 'device:d_gate', tap_action: tapAction, tap_confirm: confirm || null },
        ...(solo ? [{ id: 'm_mower', binding: 'device:d_mower', hidden: true }] : []),
      ],
    };
    c._cfgEpoch++;
    c._regSignature = '';
    c._maybeRebuildDevices();
    c.requestUpdate();
    await c.updateComplete;
  };
  const gate = () => c._devices.find((x) => x.bindingRef === 'd_gate');
  const tap = async () => { c._clickDevice({ stopPropagation() {} }, gate()); await c.updateComplete; };
  // never throw when the feature is missing: the smoke must REPORT the gap
  const lastCall = () => calls[calls.length - 1] || ['-', '-', {}];
  // the gate is the only cover in the Garden space; the plan draws no names
  // inside the badge, so the icon set of the space is the readable handle
  const devEl = () => sr().querySelector('.dev');
  const icons = () => [...sr().querySelectorAll('.dev ha-icon')].map((e) => e.getAttribute('icon'));

  // the gate lives in the Garden space — look at it, not at the ground floor
  c._setMode('view');
  c._space = 'garden';
  c.requestUpdate();
  await c.updateComplete;

  // ---- the dialog offers the option only where it makes sense ------------
  await setCover('closed', { device_class: 'curtain' });
  c._setMode('devices'); await c.updateComplete;
  const optionValues = () => [...sr().querySelectorAll('.dialog option')].map((e) => e.value);
  c._openMarkerDialog(gate()); await c.updateComplete;
  o.dialogOffersCoverForCurtain = optionValues().includes('cover');
  // …and the confirmation checkbox follows the choice, like it does for run/toggle
  const rowsBefore = sr().querySelectorAll('.dialog .srcrow').length;
  c._markerDialog = { ...c._markerDialog, tapAction: 'cover' }; await c.updateComplete;
  o.confirmCheckboxShownForCover = sr().querySelectorAll('.dialog .srcrow').length > rowsBefore;
  c._markerDialog = null; await c.updateComplete;

  // a GARAGE door never gets the option (owner: «нет, только шторы/жалюзи»)
  await setCover('closed', { device_class: 'garage' });
  c._openMarkerDialog(gate()); await c.updateComplete;
  o.dialogHidesCoverForGarage = !optionValues().includes('cover');
  c._markerDialog = null; await c.updateComplete;
  // …and neither does a device without a cover entity at all
  c._openMarkerDialog(c._devices.find((x) => x.bindingRef === 'd_mower')); await c.updateComplete;
  o.dialogHidesCoverWithoutCover = !optionValues().includes('cover');
  c._markerDialog = null; await c.updateComplete;
  c._setMode('view'); c._space = 'garden'; c.requestUpdate(); await c.updateComplete;

  // ---- the tap itself ----------------------------------------------------
  await setMarker('cover');
  await setCover('closed', { device_class: 'curtain' });
  calls.length = 0;
  await tap();
  await new Promise((r) => setTimeout(r, 10));
  o.closedOpens = JSON.stringify(lastCall()) === JSON.stringify(['cover', 'open_cover', { entity_id: 'cover.gate' }]);

  await setCover('open', { device_class: 'curtain' });
  await tap(); await new Promise((r) => setTimeout(r, 10));
  o.openCloses = lastCall()[0] === 'cover' && lastCall()[1] === 'close_cover';

  // a half-drawn curtain is still 'open' for HA — it closes
  await setCover('open', { device_class: 'curtain', current_position: 40 });
  await tap(); await new Promise((r) => setTimeout(r, 10));
  o.ajarCloses = lastCall()[1] === 'close_cover';

  await setCover('opening', { device_class: 'curtain' });
  await tap(); await new Promise((r) => setTimeout(r, 10));
  o.openingStops = lastCall()[1] === 'stop_cover';

  await setCover('closing', { device_class: 'curtain' });
  await tap(); await new Promise((r) => setTimeout(r, 10));
  o.closingStops = lastCall()[1] === 'stop_cover';

  // no readable state — a plain cover.toggle, nothing clever
  await setCover('unknown', { device_class: 'curtain' });
  await tap(); await new Promise((r) => setTimeout(r, 10));
  o.unknownToggles = lastCall()[0] === 'cover' && lastCall()[1] === 'toggle';

  // ---- the confirmation checkbox works for this action too ---------------
  await setMarker('cover', true);
  await setCover('closed', { device_class: 'curtain' });
  calls.length = 0;
  await tap();
  o.confirmAsks = !!c._tapConfirm && c._tapConfirm.text.includes('Gate');
  c._tapConfirm = null; await c.updateComplete;
  await new Promise((r) => setTimeout(r, 10));
  o.confirmCancelCallsNothing = calls.length === 0;
  await tap();
  const conf = c._tapConfirm; c._tapConfirm = null; conf?.exec?.();
  await new Promise((r) => setTimeout(r, 10));
  o.confirmOkOpens = calls.length === 1 && calls[0][1] === 'open_cover';

  // ---- a saved 'cover' on a GARAGE degrades to the info card -------------
  await setMarker('cover');
  await setCover('closed', { device_class: 'garage' });
  calls.length = 0;
  await tap();
  await new Promise((r) => setTimeout(r, 10));
  o.garageSavedCoverCallsNothing = calls.length === 0;
  o.garageSavedCoverShowsInfo = !!c._infoCard;
  c._infoCard = null; await c.updateComplete;

  // ---- the indication ----------------------------------------------------
  const afterAnim = () => {
    const el = devEl();
    if (!el) return null;
    const cs = getComputedStyle(el, '::after');
    return { name: cs.animationName, dur: cs.animationDuration };
  };
  await setMarker('cover', false, true); // the gate alone on the plan
  await setCover('opening', { device_class: 'curtain' });
  // .dev animates `background 0.15s`: lit recycles the badge node the hidden
  // mower used, so a plate colour read in the same frame is still mid-fade
  await new Promise((r) => setTimeout(r, 300));
  o.onlyTheCoverOnThePlan = sr().querySelectorAll('.dev').length === 1;
  o.pulseWhileOpening = sr().querySelectorAll('.dev.covermove').length === 1;
  const a1 = afterAnim();
  o.pulseIsBreathingRing = a1?.name === 'hp-covermove' && a1?.dur === '2.2s';
  // the plate stays NEUTRAL while travelling: yellow is reserved for «включено»
  o.movingPlateNotYellow = getComputedStyle(devEl()).backgroundColor !== YELLOW;

  await setCover('closing', { device_class: 'curtain' });
  await new Promise((r) => setTimeout(r, 300));
  o.pulseWhileClosing = sr().querySelectorAll('.dev.covermove').length === 1;
  o.closingPlateNotYellow = getComputedStyle(devEl()).backgroundColor !== YELLOW;

  await setCover('open', { device_class: 'curtain' });
  o.noPulseWhenOpen = sr().querySelectorAll('.dev.covermove').length === 0;
  o.iconMorphOpen = icons().includes('mdi:curtains') && !icons().includes('mdi:curtains-closed');
  o.openFrameStays = sr().querySelectorAll('.dev.open').length === 1;

  await setCover('closed', { device_class: 'curtain' });
  o.noPulseWhenClosed = sr().querySelectorAll('.dev.covermove').length === 0;
  o.iconMorphClosed = icons().includes('mdi:curtains-closed') && !icons().includes('mdi:curtains');

  await setCover('open', { device_class: 'shutter' });
  o.iconMorphShutterOpen = icons().includes('mdi:window-shutter-open');

  await setCover('unknown', { device_class: 'curtain' });
  o.noPulseWhenUnknown = sr().querySelectorAll('.dev.covermove').length === 0;
  o.noMorphWhenUnknown = icons().includes(gate().icon)
    && !icons().some((i) => i.startsWith('mdi:curtains'));

  return o;
});
checkAll(out);
await finish(browser, out);
