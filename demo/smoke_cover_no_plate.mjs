// A cover NEVER wears a coloured plate (owner's contract 2026-08-04):
// «у штор не должно быть жёлтой подложки никогда, индикация открыто/закрыто
// за счёт морфинга иконки».
//
// Before this the domain shared one branch with `valve`: 'open'/'opening' put
// the orange «открыто» frame on the badge (.dev.open — a FILLED orange plate,
// --hp-open #ff9f43, not just a border), and the travelling states carried it
// underneath the breathing ring. Now a cover returns no plate class at all:
//
//   closed / open / ajar   -> neutral plate, the ICON tells the state
//   opening / closing      -> neutral plate + the .covermove ring (kept, the
//                             owner approved it 2026-08-03)
//
// The frame itself is NOT gone: door/window binary sensors and locks still
// wear it, and a valve keeps it too (nothing morphs its icon). Those are
// re-checked at the bottom, or «no yellow for curtains» would quietly cost
// the whole house its «открыто» indication.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const out = await page.evaluate(async () => {
  const o = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;

  // --- colour probes: resolve the tokens the same way the badge does ------
  const probe = (css) => {
    const d = document.createElement('div');
    d.style.cssText = `position:absolute;left:-999px;background:${css}`;
    sr().appendChild(d);
    const v = getComputedStyle(d).backgroundColor;
    d.remove();
    return v;
  };
  const YELLOW = probe('var(--hp-on)');     // «включено»
  const ORANGE = probe('var(--hp-open)');   // «открыто» frame
  const NEUTRAL = probe('var(--hp-bg)');    // the plain badge
  o.tokensDiffer = new Set([YELLOW, ORANGE, NEUTRAL]).size === 3;
  o.yellowIsTheYellow = YELLOW === 'rgb(255, 212, 92)';
  o.orangeIsTheOpenFrame = ORANGE === 'rgb(255, 159, 67)';

  // --- the gate marker, alone in the Garden, told it IS the curtain -------
  const setMarker = async () => {
    c._serverCfg = {
      ...c._serverCfg,
      markers: [
        { id: 'm_gate', binding: 'device:d_gate', tap_action: 'cover' },
        { id: 'm_mower', binding: 'device:d_mower', hidden: true },
      ],
    };
    c._cfgEpoch++;
    c._regSignature = '';
    c._maybeRebuildDevices();
    c.requestUpdate();
    await c.updateComplete;
  };
  const setCover = async (state, attrs = {}) => {
    c.hass = { ...c.hass, states: { ...c.hass.states,
      'cover.gate': { entity_id: 'cover.gate', state, attributes: { friendly_name: 'Gate', ...attrs } } } };
    c.requestUpdate();
    await c.updateComplete;
    // .dev animates `background 0.15s` — a colour read in the same frame is
    // still mid-fade and would pass on a plate that ends up orange
    await new Promise((r) => setTimeout(r, 300));
  };
  c._setMode('view');
  c._space = 'garden';
  c.requestUpdate();
  await c.updateComplete;
  await setMarker();
  await setCover('closed', { device_class: 'curtain' });

  const devEl = () => sr().querySelector('.devlayer .dev');
  const cls = () => [...(devEl()?.classList || [])];
  const plate = () => getComputedStyle(devEl()).backgroundColor;
  const icon = () => devEl()?.querySelector('ha-icon')?.getAttribute('icon') || '';
  o.onlyTheCoverOnThePlan = sr().querySelectorAll('.devlayer .dev').length === 1;

  /** One state: the plate must be the neutral one, and nothing else. */
  const plateIsNeutral = (tag) => {
    o[tag + 'PlateNeutral'] = plate() === NEUTRAL;
    o[tag + 'NotYellow'] = plate() !== YELLOW;
    o[tag + 'NotOrange'] = plate() !== ORANGE;
    o[tag + 'NoPlateClass'] = !cls().includes('on') && !cls().includes('open');
  };

  plateIsNeutral('closed');
  o.closedNoRing = !cls().includes('covermove');
  o.closedIconClosed = icon() === 'mdi:curtains-closed';

  await setCover('open', { device_class: 'curtain' });
  plateIsNeutral('open');
  o.openNoRing = !cls().includes('covermove');
  o.openIconOpen = icon() === 'mdi:curtains';

  // ajar: HA reports a positioned curtain as plain 'open' — it reads as OPEN
  await setCover('open', { device_class: 'curtain', current_position: 40 });
  plateIsNeutral('ajar');
  o.ajarIconOpen = icon() === 'mdi:curtains';

  await setCover('opening', { device_class: 'curtain' });
  plateIsNeutral('opening');
  o.openingRings = cls().includes('covermove');
  o.openingRingIsTheBreathingOne = (() => {
    const cs = getComputedStyle(devEl(), '::after');
    return cs.animationName === 'hp-covermove' && cs.animationDuration === '2.2s';
  })();

  await setCover('closing', { device_class: 'curtain' });
  plateIsNeutral('closing');
  o.closingRings = cls().includes('covermove');

  // --- the morph covers every class, both ways ---------------------------
  const morph = async (dc, closedIcon, openIcon) => {
    await setCover('closed', dc ? { device_class: dc } : {});
    const a = icon();
    await setCover('open', dc ? { device_class: dc } : {});
    const b = icon();
    return a === closedIcon && b === openIcon && a !== b;
  };
  o.morphBlind = await morph('blind', 'mdi:blinds', 'mdi:blinds-open');
  o.morphShade = await morph('shade', 'mdi:blinds', 'mdi:blinds-open');
  o.morphShutter = await morph('shutter', 'mdi:window-shutter', 'mdi:window-shutter-open');
  o.morphCurtain = await morph('curtain', 'mdi:curtains-closed', 'mdi:curtains');
  o.morphWindow = await morph('window', 'mdi:window-closed', 'mdi:window-open');
  o.morphAwning = await morph('awning', 'mdi:awning-outline', 'mdi:awning');
  o.morphDoor = await morph('door', 'mdi:door-closed', 'mdi:door-open');
  o.morphGarage = await morph('garage', 'mdi:garage', 'mdi:garage-open');
  o.morphGate = await morph('gate', 'mdi:gate', 'mdi:gate-open');
  o.morphDamper = await morph('damper', 'mdi:circle-slice-8', 'mdi:circle-outline');
  // no device_class at all (z2m ships plenty): the gate's auto icon is the
  // one the name rule «ворота|garage|gate» hands out, and it morphs too
  o.gateAutoIcon = c._devices.find((x) => x.bindingRef === 'd_gate')?.icon === 'mdi:garage-variant';
  o.morphNoClass = await morph('', 'mdi:garage-variant', 'mdi:garage-open-variant');
  // …and an unreadable state morphs nothing, plate still neutral
  await setCover('unknown', { device_class: 'curtain' });
  plateIsNeutral('unknown');
  o.unknownNoMorph = icon() === 'mdi:garage-variant';
  o.unknownNoRing = !cls().includes('covermove');

  // --- NOT touched: the «открыто» frame elsewhere ------------------------
  // the demo house has a lock and a window sensor on the ground floor
  c._space = 'f1';
  c.requestUpdate();
  await c.updateComplete;
  const elOf = (dev) => {
    const v = c._viewOr(c._baseVb());
    const p = c._pos(dev);
    const left = ((p.x - v.x) / v.w) * 100;
    const top = ((p.y - v.y) / v.h) * 100;
    return [...sr().querySelectorAll('.devlayer .dev')].find((e) =>
      Math.abs(parseFloat(e.style.left) - left) < 0.4 && Math.abs(parseFloat(e.style.top) - top) < 0.4);
  };
  const dev = (ref) => c._devices.find((x) => x.bindingRef === ref);
  c.hass = { ...c.hass, states: { ...c.hass.states,
    'lock.front_door': { entity_id: 'lock.front_door', state: 'unlocked', attributes: { friendly_name: 'Front door' } },
    'binary_sensor.window': { entity_id: 'binary_sensor.window', state: 'on', attributes: { friendly_name: 'Window', device_class: 'window' } } } };
  c.requestUpdate();
  await c.updateComplete;
  await new Promise((r) => setTimeout(r, 300));
  const lockEl = elOf(dev('d_lock'));
  const winEl = elOf(dev('d_window'));
  o.lockMarkerFound = !!lockEl;
  o.windowMarkerFound = !!winEl;
  o.unlockedLockKeepsTheFrame = !!lockEl && lockEl.classList.contains('open')
    && getComputedStyle(lockEl).backgroundColor === ORANGE;
  o.openWindowKeepsTheFrame = !!winEl && winEl.classList.contains('open')
    && getComputedStyle(winEl).backgroundColor === ORANGE;
  // …and a locked lock is neutral again, so the frame still MEANS something
  c.hass = { ...c.hass, states: { ...c.hass.states,
    'lock.front_door': { entity_id: 'lock.front_door', state: 'locked', attributes: { friendly_name: 'Front door' } } } };
  c.requestUpdate();
  await c.updateComplete;
  await new Promise((r) => setTimeout(r, 300));
  o.lockedLockIsNeutral = getComputedStyle(elOf(dev('d_lock'))).backgroundColor === NEUTRAL;

  // a VALVE keeps the frame too: nothing morphs its icon, so the frame is the
  // only thing it has to say «открыт» with (deliberately left alone)
  const valve = { id: 'v', primary: 'valve.water', entities: ['valve.water'], marker: null };
  const clsOfState = (d, states) => {
    const saved = c.hass;
    c.hass = { ...c.hass, states: { ...c.hass.states, ...states } };
    const r = c._stateClass(d);
    c.hass = saved;
    return r;
  };
  o.valveOpenKeepsTheFrame = clsOfState(valve, { 'valve.water': { state: 'open', attributes: {} } }) === 'open';
  o.valveClosedIsNeutral = clsOfState(valve, { 'valve.water': { state: 'closed', attributes: {} } }) === '';
  // and the cover's own class string, straight from the source
  const cover = { id: 'k', primary: 'cover.blind', entities: ['cover.blind'], marker: null };
  o.coverOpenClassIsEmpty = clsOfState(cover, { 'cover.blind': { state: 'open', attributes: { device_class: 'blind' } } }) === '';
  o.coverOpeningClassIsRingOnly = clsOfState(cover, { 'cover.blind': { state: 'opening', attributes: { device_class: 'blind' } } }) === 'covermove';
  o.coverClosingClassIsRingOnly = clsOfState(cover, { 'cover.blind': { state: 'closing', attributes: { device_class: 'blind' } } }) === 'covermove';
  o.coverUnavailableStillFades = clsOfState(cover, { 'cover.blind': { state: 'unavailable', attributes: {} } }) === 'unavail';
  return o;
});
checkAll(out);
await finish(browser, out);
