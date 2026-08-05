// An EXPLICIT «Открыть/закрыть» marker is a curtain, and a curtain is never
// painted — audit DEV-1DA1-01 (P2).
//
// `_stateClass` used to answer in this order: bound `controls` first, then any
// lit `light.*` of the device, and only then the entity the tap acts on
// (`_actEntity` → `_coverIndicator`). So the two combinations below still made
// a curtain yellow, in flat contradiction with the owner's contract («у штор
// не должно быть жёлтой подложки НИКОГДА») and with the promise that a marker
// indicates the entity its tap drives:
//
//   1. a MIXED device (a lamp that also ships a blind) told `tap_action:
//      'cover'` — the lit `light.mixed` returned 'on' before the cover branch
//      was ever reached, so the travelling blind lost its breathing ring too;
//   2. a curtain marker with a bound `controls` target that happened to be on
//      — `controls` returned 'on' first, same result.
//
// The order now starts with the explicit cover: saying «this thing is a
// curtain» in the dialog is the strongest statement the card has about what a
// marker IS, so nothing may paint over it. Everything else keeps the old
// precedence — a marker that was NOT told it is a curtain is untouched, and
// that is re-checked at the bottom.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const out = await page.evaluate(async () => {
  const o = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;

  // ---- the plate colours, resolved the way the badge resolves them -------
  const probe = (css) => {
    const d = document.createElement('div');
    d.style.cssText = `position:absolute;left:-999px;background:${css}`;
    sr().appendChild(d);
    const v = getComputedStyle(d).backgroundColor;
    d.remove();
    return v;
  };
  const YELLOW = probe('var(--hp-on)');
  const ORANGE = probe('var(--hp-open)');
  const NEUTRAL = probe('var(--hp-bg)');
  o.tokensDiffer = new Set([YELLOW, ORANGE, NEUTRAL]).size === 3;

  // =======================================================================
  // Part 1 — the class itself, straight from _stateClass, over every state
  // =======================================================================
  const withStates = (states, fn) => {
    const saved = c.hass;
    c.hass = { ...c.hass, states: { ...c.hass.states, ...states } };
    const r = fn();
    c.hass = saved;
    return r;
  };
  const st = (state, attrs = {}) => ({ state, attributes: attrs });
  /** The auditor's marker #1: primary is a LIT light, the cover is explicit. */
  const litLamp = {
    id: 'p_lamp', primary: 'light.mixed', entities: ['light.mixed', 'cover.mixed'],
    tapAction: 'cover', marker: { display: 'icon_ripple' },
  };
  /** The auditor's marker #2: a cover marker whose bound control is on. */
  const controlled = {
    id: 'p_ctrl', primary: 'cover.mixed', entities: ['cover.mixed'],
    tapAction: 'cover', marker: { id: 'p_ctrl', binding: 'device:x', controls: ['switch.control'], display: 'icon_ripple' },
  };
  const CV = { closed: '', open: '', opening: 'activity-transition', closing: 'activity-transition' };
  for (const [state, want] of Object.entries(CV)) {
    const states = {
      'light.mixed': st('on', { friendly_name: 'Bedside lamp' }),
      'switch.control': st('on', {}),
      'cover.mixed': st(state, { device_class: 'curtain' }),
    };
    o['litLamp_' + state] = withStates(states, () => c._stateClass(litLamp)) === want;
    o['controlled_' + state] = withStates(states, () => c._stateClass(controlled)) === want;
  }
  // an unreachable cover still only fades — never yellow, never orange
  o.litLampUnavailFades = withStates({
    'light.mixed': st('on', {}), 'cover.mixed': st('unavailable', {}),
  }, () => c._stateClass(litLamp)) === 'unavail';
  o.controlledUnavailFades = withStates({
    'switch.control': st('on', {}), 'cover.mixed': st('unavailable', {}),
  }, () => c._stateClass(controlled)) === 'unavail';
  // …and a selected cover with no state is unavailable, never borrowed from
  // the lit neighbour that the explicit cover action deliberately outranks.
  o.litLampNoCoverStateIsUnavailable = withStates({
    'light.mixed': st('on', {}),
  }, () => c._stateClass(litLamp)) === 'unavail';

  // ---- the OTHER side of the rule: nothing changed for the rest ----------
  // the very same mixed device WITHOUT the explicit action keeps its primary
  const plainLamp = { ...litLamp, id: 'p_plain', tapAction: null, marker: null };
  o.mixedWithoutTheOptionStaysYellow = withStates({
    'light.mixed': st('on', {}), 'cover.mixed': st('opening', { device_class: 'curtain' }),
  }, () => c._stateClass(plainLamp)) === 'on';
  o.mixedWithoutTheOptionOffIsNeutral = withStates({
    'light.mixed': st('off', {}), 'cover.mixed': st('opening', { device_class: 'curtain' }),
  }, () => c._stateClass(plainLamp)) === '';
  // a wall switch with controls and NO cover in sight still mirrors them
  const remote = {
    id: 'p_remote', primary: 'sensor.remote', entities: ['sensor.remote'], tapAction: null,
    marker: { id: 'p_remote', binding: 'device:y', controls: ['light.hall'] },
  };
  o.remoteMirrorsItsControls = withStates({ 'light.hall': st('on', {}) },
    () => c._stateClass(remote)) === 'on';
  o.remoteOffIsNeutral = withStates({ 'light.hall': st('off', {}) },
    () => c._stateClass(remote)) === '';
  // a curtain marker with controls that are OFF is still just a curtain
  o.controlledOffStillRings = withStates({
    'switch.control': st('off', {}), 'cover.mixed': st('opening', { device_class: 'curtain' }),
  }, () => c._stateClass(controlled)) === 'activity-transition';
  // an explicit «cover» marker with NO cover among its entities falls back to
  // the old order — the statement is only as strong as the entity behind it
  const noCover = {
    id: 'p_nocover', primary: 'light.mixed', entities: ['light.mixed'], tapAction: 'cover', marker: null,
  };
  o.explicitCoverWithoutACoverKeepsThePrimary = withStates({ 'light.mixed': st('on', {}) },
    () => c._stateClass(noCover)) === 'on';

  // =======================================================================
  // Part 2 — the real markers on the real plan: the PLATE, not just a class
  // =======================================================================
  const ENTS = {
    'light.mixed': { entity_id: 'light.mixed', device_id: 'd_mixed', platform: 'demo' },
    'cover.mixed': { entity_id: 'cover.mixed', device_id: 'd_mixed', platform: 'demo' },
    'cover.ctrl': { entity_id: 'cover.ctrl', device_id: 'd_ctrl', platform: 'demo' },
    'switch.control': { entity_id: 'switch.control', device_id: 'd_wall', platform: 'demo' },
  };
  const push = async (coverState) => {
    c.hass = {
      ...c.hass,
      devices: { ...c.hass.devices,
        d_mixed: { id: 'd_mixed', name: 'Bedside lamp', model: 'Lamp with a blind',
          area_id: 'bedroom', identifiers: [['demo', 'd_mixed']], entry_type: null, via_device_id: null },
        d_ctrl: { id: 'd_ctrl', name: 'Office curtain', model: 'Curtain motor',
          area_id: 'bedroom', identifiers: [['demo', 'd_ctrl']], entry_type: null, via_device_id: null },
        d_wall: { id: 'd_wall', name: 'Wall switch', model: 'Wall switch',
          area_id: 'bedroom', identifiers: [['demo', 'd_wall']], entry_type: null, via_device_id: null } },
      entities: { ...c.hass.entities, ...ENTS },
      states: { ...c.hass.states,
        'light.mixed': { entity_id: 'light.mixed', state: 'on', attributes: { friendly_name: 'Bedside lamp' } },
        'cover.mixed': { entity_id: 'cover.mixed', state: coverState, attributes: { friendly_name: 'Bedside blind', device_class: 'curtain' } },
        'cover.ctrl': { entity_id: 'cover.ctrl', state: coverState, attributes: { friendly_name: 'Office curtain', device_class: 'curtain' } },
        'switch.control': { entity_id: 'switch.control', state: 'on', attributes: { friendly_name: 'Wall switch' } },
      },
    };
    c._serverCfg = {
      ...c._serverCfg,
      markers: [
        { id: 'm_mixed', binding: 'device:d_mixed', tap_action: 'cover', display: 'icon_ripple' },
        { id: 'm_ctrl', binding: 'device:d_ctrl', tap_action: 'cover', controls: ['switch.control'], display: 'icon_ripple' },
      ],
    };
    c._cfgEpoch++;
    c._regSignature = '';
    c._maybeRebuildDevices();
    const mx = c._devices.find((x) => x.bindingRef === 'd_mixed');
    const ct = c._devices.find((x) => x.bindingRef === 'd_ctrl');
    if (mx && ct) {
      c._layout = { ...c._layout,
        [mx.id]: { s: mx.space, x: 0.94, y: 0.06 },
        [ct.id]: { s: ct.space, x: 0.06, y: 0.94 } };
    }
    c.requestUpdate();
    await c.updateComplete;
    // .dev animates `background 0.15s` — read a settled colour, not a fade
    await new Promise((r) => setTimeout(r, 300));
  };
  c._setMode('view');
  c._space = 'f1';
  c.requestUpdate();
  await c.updateComplete;
  await push('opening');

  const dev = (ref) => c._devices.find((x) => x.bindingRef === ref);
  const elOf = (d) => {
    const v = c._viewOr(c._baseVb());
    const p = c._pos(d);
    const left = ((p.x - v.x) / v.w) * 100;
    const top = ((p.y - v.y) / v.h) * 100;
    return [...sr().querySelectorAll('.devlayer .dev')].find((e) =>
      Math.abs(parseFloat(e.style.left) - left) < 0.4 && Math.abs(parseFloat(e.style.top) - top) < 0.4);
  };
  const report = (tag, ref) => {
    const d = dev(ref);
    const el = d && elOf(d);
    o[tag + 'MarkerFound'] = !!el;
    if (!el) return;
    const bg = getComputedStyle(el).backgroundColor;
    o[tag + 'PlateNeutral'] = bg === NEUTRAL;
    o[tag + 'NotYellow'] = bg !== YELLOW;
    o[tag + 'NotOrange'] = bg !== ORANGE;
    o[tag + 'NoOnClass'] = !el.classList.contains('on') && !el.classList.contains('open');
    o[tag + 'Rings'] = el.classList.contains('activity-transition');
    o[tag + 'IconIsTheCover'] = el.querySelector('ha-icon')?.getAttribute('icon') === 'mdi:curtains';
  };
  o.lampIsTrulyLit = c.hass.states['light.mixed'].state === 'on';
  o.controlIsTrulyOn = c.hass.states['switch.control'].state === 'on';
  report('litLampDom', 'd_mixed');
  report('controlledDom', 'd_ctrl');

  // …and at rest (closed) they are plain, with no ring
  await push('closed');
  const closedBg = (ref) => getComputedStyle(elOf(dev(ref))).backgroundColor;
  o.litLampClosedNeutral = closedBg('d_mixed') === NEUTRAL;
  o.controlledClosedNeutral = closedBg('d_ctrl') === NEUTRAL;
  o.litLampClosedNoRing = !elOf(dev('d_mixed')).classList.contains('activity-transition');
  return o;
});
checkAll(out);
await finish(browser, out);
