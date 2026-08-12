// Covers after issue #94: the unified «Toggle state» action + the travelling
// indication. Persisted `cover` remains a lossless legacy runtime token.
//
//   closed              -> cover.open_cover
//   open / ajar         -> cover.close_cover
//   opening / closing   -> cover.stop_cover   (a tap during travel is a STOP;
//                          the next tap simply travels the other way)
//   unknown             -> cover.toggle, no morphing, no pulse
//
// The editor never offers a separate cover option. Secure cover classes
// (garage/door/gate) resolve to a quiet no-op rather than an info-card fallback.
// With «Icon + activity», travelling breathes a soft activity ring (the
// vacuum puck's 2.2s period) and the plate stays NEUTRAL — yellow means work.
// Since 2026-08-04 the plate is neutral in EVERY cover state, the «открыто»
// frame included: open/closed is told by the icon morph alone (the full
// contract lives in smoke_cover_no_plate.mjs).
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
    // Declare the capabilities exercised below. Issue #94 intentionally
    // resolves services fail-closed, so an entity without feature metadata is
    // not a valid fixture for open / close / stop dispatch.
    attributes: { friendly_name: 'Gate', supported_features: 11, ...attrs },
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
        { id: 'm_gate', binding: 'device:d_gate', tap_action: tapAction,
          tap_confirm: confirm || null, display: 'icon_ripple' },
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

  // ---- the dialog offers one universal action -----------------------------
  await setCover('closed', { device_class: 'curtain' });
  await setMarker('cover');
  c._setMode('devices'); await c.updateComplete;
  const optionValues = () => [...sr().querySelectorAll('hp-dialog option')].map((e) => e.value);
  c._openMarkerDialog(gate()); await c.updateComplete;
  o.dialogOffersOnlyUnifiedToggle = optionValues().includes('toggle')
    && !optionValues().includes('cover');
  // Opening a legacy marker projects it to the unified selector without
  // rewriting the persisted token until the user intentionally changes it.
  o.legacyCoverProjectsToToggle = c._markerDialog?.tapAction === 'toggle'
    && c._markerDialog?.tapActionTouched === false;
  o.untouchedLegacyCoverRemainsLossless =
    c._markerTapActionFields(c._markerDialog)?.tap_action === 'cover';
  o.intentionalEditWritesUnifiedToggle = c._markerTapActionFields({
    ...c._markerDialog, tapAction: 'toggle', tapActionTouched: true,
  })?.tap_action === 'toggle';
  c._markerDialog = null; await c.updateComplete;

  // The same universal option is visible for a garage; runtime safety decides.
  await setCover('closed', { device_class: 'garage' });
  c._openMarkerDialog(gate()); await c.updateComplete;
  o.garageAlsoShowsUnifiedToggle = optionValues().includes('toggle')
    && !optionValues().includes('cover');
  c._markerDialog = null; await c.updateComplete;
  // …and neither does a device without a cover entity at all
  c._openMarkerDialog(c._devices.find((x) => x.bindingRef === 'd_mower')); await c.updateComplete;
  o.virtualAlsoShowsUnifiedToggle = optionValues().includes('toggle')
    && !optionValues().includes('cover');
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

  // ---- a saved 'cover' on a GARAGE is a secure, quiet no-op ---------------
  await setMarker('cover');
  await setCover('closed', { device_class: 'garage' });
  calls.length = 0;
  await tap();
  await new Promise((r) => setTimeout(r, 10));
  o.garageSavedCoverCallsNothing = calls.length === 0;
  o.garageSavedCoverDoesNotFallbackToInfo = !c._infoCard;
  c._infoCard = null; await c.updateComplete;

  // ---- the indication ----------------------------------------------------
  const afterAnim = () => {
    const el = devEl()?.querySelector('.device-pulse.continuous.transition i:first-child');
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { name: cs.animationName, dur: cs.animationDuration };
  };
  await setMarker('cover', false, true); // the gate alone on the plan
  await setCover('opening', { device_class: 'curtain' });
  // .dev animates `background 0.15s`: lit recycles the badge node the hidden
  // mower used, so a plate colour read in the same frame is still mid-fade
  await new Promise((r) => setTimeout(r, 300));
  o.onlyTheCoverOnThePlan = sr().querySelectorAll('.dev').length === 1;
  o.pulseWhileOpening = sr().querySelectorAll('.dev.activity-transition').length === 1;
  const a1 = afterAnim();
  o.pulseIsBreathingRing = a1?.name === 'hp-pulse-continuous' && a1?.dur === '2.4s';
  // the plate stays NEUTRAL while travelling: yellow is reserved for «включено»
  o.movingPlateNotYellow = getComputedStyle(devEl()).backgroundColor !== YELLOW;

  await setCover('closing', { device_class: 'curtain' });
  await new Promise((r) => setTimeout(r, 300));
  o.pulseWhileClosing = sr().querySelectorAll('.dev.activity-transition').length === 1;
  o.closingPlateNotYellow = getComputedStyle(devEl()).backgroundColor !== YELLOW;

  await setCover('open', { device_class: 'curtain' });
  o.noPulseWhenOpen = sr().querySelectorAll('.dev.activity-transition').length === 0;
  o.iconMorphOpen = icons().includes('mdi:curtains') && !icons().includes('mdi:curtains-closed');
  // owner 2026-08-04: never a coloured plate on a cover — not even «открыто»
  o.openWearsNoFrame = sr().querySelectorAll('.dev.open').length === 0;
  o.openPlateNotYellow = getComputedStyle(devEl()).backgroundColor !== YELLOW;

  await setCover('closed', { device_class: 'curtain' });
  o.directCloseGetsFallback = sr().querySelectorAll('.dev.activity-transition').length === 1;
  o.iconMorphClosed = icons().includes('mdi:curtains-closed') && !icons().includes('mdi:curtains');

  await setCover('open', { device_class: 'shutter' });
  o.iconMorphShutterOpen = icons().includes('mdi:window-shutter-open');

  await setCover('unknown', { device_class: 'curtain' });
  o.noPulseWhenUnknown = sr().querySelectorAll('.dev.activity-transition').length === 0;
  o.noMorphWhenUnknown = icons().includes(gate().icon)
    && !icons().some((i) => i.startsWith('mdi:curtains'));

  return o;
});
checkAll(out);
await finish(browser, out);
