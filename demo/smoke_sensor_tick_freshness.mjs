/**
 * #850 AC5: a state is visible in the same render as before — through the
 * incremental render-device snapshot and the LED frame keyed by its inputs.
 *
 * With the live runtime loaded (the View's reuse window), each change below is
 * one public input (a new HA object, a click, the card config or a server
 * config push) followed by one `updateComplete`, and is checked at once, with
 * no extra frame: a plan sensor's value, a low battery that a marker reads only
 * through its device's battery sibling, LQI, an LED strip's on/off, colour
 * (stripe and field) and unavailability, a door contact that changes the light
 * scene, a manual virtual light, `icon_size`, and room Glow. The value, battery
 * and LQI ticks must be incremental captures (only the affected device is
 * resolved again): this smoke proves freshness of the reuse path, not of a
 * complete rebuild.
 */
import { launch, check, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1000, height: 820 }, 1);
const evaluate = (fn, arg) => page.evaluate(fn, arg);

await evaluate(async () => {
  const card = window.__card;
  // A battery sibling of the temperature device, read by an entity-bound
  // marker only through the battery context.
  window.__addRegistryEntity('sensor.hp_temp_battery', null, '80', 'demo', {},
    { device_class: 'battery', unit_of_measurement: '%' });
  Object.assign(card.hass.entities['sensor.hp_temp_battery'], { device_id: 'd_temp', device_class: 'battery' });
  window.__setRegistryArea('entity', 'sensor.hp_temp_battery', null);
  card.hass = window.__mkHass();
  // The manual virtual light toggles through the integration's reply, as in production.
  const virtual = { rev: 0, off: new Set() };
  const base = card.hass.callWS.bind(card.hass);
  window.__hpVirtualCalls = 0;
  window.__hpCallWS = async (message) => {
    if (message.type !== 'houseplan/virtual_light/toggle') return base(message);
    window.__hpVirtualCalls++;
    if (virtual.off.has(message.marker_id)) virtual.off.delete(message.marker_id);
    else virtual.off.add(message.marker_id);
    return { marker_id: message.marker_id, on: !virtual.off.has(message.marker_id), rev: ++virtual.rev };
  };
  card.hass = { ...card.hass, callWS: window.__hpCallWS };
  card.setConfig({ type: 'custom:houseplan-card', title: 'Freshness', icon_size: 3.4, language: 'en',
    show_signal: true, show_temperature: true });
  await window.__hpTest.setMode('view');
  await window.__hpTest.setServerConfig((cfg) => {
    const space = cfg.spaces.find((item) => item.id === 'f1');
    space.settings = { ...(space.settings || {}), glow_enabled: true };
    space.openings = [{ id: 'hp-door', type: 'door', x: 0.55, y: 0.36, angle: 90, length: 0.12,
      contact: 'binary_sensor.window' }];
    space.led_strips = [{ id: 'ceiling', marker: 'd_light1', points: [[0.62, 0.2], [0.9, 0.2], [0.9, 0.4]] }];
    cfg.settings = { ...(cfg.settings || {}), volumetric_view: false, show_device_battery: true, moon: false };
    cfg.markers = [
      ...Object.keys(card.hass.devices)
        .filter((id) => !['d_temp', 'd_light1', 'd_lamp'].includes(id))
        .map((id) => ({ id, binding: `device:${id}`, hidden: true })),
      { id: 'd_temp', binding: 'device:d_temp', space: 'f1' },
      { id: 'hp-temp-entity', binding: 'entity:sensor.living_temp', space: 'f1', display: 'badge',
        value_badge: { enabled: false } },
      { id: 'd_light1', binding: 'device:d_light1', space: 'f1' },
      { id: 'd_lamp', binding: 'device:d_lamp', space: 'f1', is_light: true },
      { id: 'hp-virtual', name: 'Virtual lamp', binding: 'virtual', is_light: true, tap_action: 'toggle',
        tap_confirm: false, space: 'f1', room_id: 'r4' },
    ];
    return cfg;
  });
  await window.__hpTest.setLayout((layout) => ({ ...layout,
    d_temp: { s: 'f1', x: 0.2, y: 0.25 }, 'hp-temp-entity': { s: 'f1', x: 0.3, y: 0.25 },
    d_light1: { s: 'f1', x: 0.75, y: 0.3 }, d_lamp: { s: 'f1', x: 0.5, y: 0.36 },
    'hp-virtual': { s: 'f1', x: 0.3, y: 0.72 },
  }));
  await window.__hpTest.settled();
});
await page.waitForFunction(() => !!window.__card._liveRt && !!window.__card.shadowRoot
  .querySelector('[data-led-strip][data-marker="d_light1"]'), null, { timeout: 15000 });
await page.waitForTimeout(400);

/** One HA tick: a new HA object with these rows, one update, nothing else. */
const tick = (rows) => evaluate(async (rows) => {
  const card = window.__card;
  const states = { ...card.hass.states };
  for (const [id, patch] of Object.entries(rows)) {
    states[id] = { ...states[id], ...patch, attributes: { ...states[id]?.attributes, ...patch.attributes } };
  }
  const before = card._liveRt.work();
  card.hass = { ...card.hass, states };
  await card.updateComplete;
  const after = card._liveRt.work();
  return { incremental: after.incremental - before.incremental, presentations: after.presentations - before.presentations };
}, rows);
const view = () => evaluate(() => {
  const root = window.__card.shadowRoot;
  const dev = (id) => root.querySelector(`[data-hp="device"][data-id="${id}"]`);
  const stripe = root.querySelector('[data-led-strip][data-marker="d_light1"]');
  const pool = root.querySelector('[data-led-field="ceiling"] .led-pool');
  const lamp = root.querySelector('.glow-spot[data-glow-source="light.floor_lamp"]');
  const lampClip = lamp ? root.querySelector(`#hp-glowclip-${lamp.dataset.glowSpot} path`) : null;
  return {
    temp: dev('d_temp')?.textContent?.replace(/\s+/g, ' ').trim() || '',
    battery: dev('hp-temp-entity')?.querySelector('.device-battery')?.dataset.state || null,
    lqi: dev('d_temp')?.querySelector('.lqi')?.textContent?.trim() || null,
    stripe: stripe ? { state: stripe.dataset.state, core: stripe.querySelector('.led-core')?.getAttribute('stroke'),
      dash: stripe.querySelector('.led-core')?.getAttribute('stroke-dasharray') || null,
      width: Number(stripe.querySelector('.led-outline')?.getAttribute('stroke-width')) } : null,
    field: pool ? { fill: pool.getAttribute('fill'),
      phase: pool.closest('[data-led-field]')?.dataset.ledPhase } : null,
    lampLit: !!lamp, lampClip: lampClip?.getAttribute('d') || null,
    barrier: window.__card._lightBarrierCache?.key || null,
    spots: root.querySelectorAll('.glow-spot:not(.is-leaving)').length,
    virtualOn: dev('hp-virtual')?.classList.contains('on') ?? null,
    door: window.__card.hass.states['binary_sensor.window']?.state,
  };
});

const start = await view();
check('setup: the marker shows the temperature', /22\.4/.test(start.temp), true);
check('setup: the LED strip is on with its field', [start.stripe?.state, !!start.field], ['on', true]);

// A plan sensor (S1): the value is new in the same render, through an incremental capture.
let work = await tick({ 'sensor.living_temp': { state: '23.7' } });
check('value: incremental capture', work.incremental, 1);
check('value: only the devices reading the row are resolved again', work.presentations <= 4, true);
check('value: the new temperature in the same render', /23\.7/.test((await view()).temp), true);

// A low battery read only through the battery context of the entity marker.
check('battery: normal before', (await view()).battery, 'normal');
work = await tick({ 'sensor.hp_temp_battery': { state: '5' } });
check('battery: incremental capture', work.incremental, 1);
check('battery: low in the same render', (await view()).battery, 'low');

// LQI (an attribute of the temperature row).
const lqiBefore = (await view()).lqi;
work = await tick({ 'sensor.living_temp': { attributes: { linkquality: 31 } } });
check('LQI: incremental capture', work.incremental, 1);
check('LQI: the new value in the same render', [(await view()).lqi, lqiBefore !== '31'], ['31', true]);

// The LED strip: off, colour, unavailable — stripe and field in the same render.
await tick({ 'light.ceiling': { state: 'off' } });
let now = await view();
check('LED off: the stripe is off in the same render', now.stripe?.state, 'off');
check('LED off: the field leaves in the same render', now.field?.phase ?? 'gone', now.field ? 'leaving' : 'gone');
await page.waitForTimeout(650);
await tick({ 'light.ceiling': { state: 'on', attributes: { rgb_color: [225, 70, 35] } } });
now = await view();
check('LED on with a colour: the core in the same render', [now.stripe?.state, now.stripe?.core], ['on', '#e14623']);
check('LED colour: the field in the same render', now.field?.fill, '#e14623');
await tick({ 'light.ceiling': { state: 'on', attributes: { rgb_color: [80, 200, 120] } } });
now = await view();
check('LED colour change: stripe and field in the same render', [now.stripe?.core, now.field?.fill], ['#50c878', '#50c878']);
await tick({ 'light.ceiling': { state: 'unavailable' } });
now = await view();
check('LED unavailable: grey dashed in the same render', [now.stripe?.state, now.stripe?.core, !!now.stripe?.dash],
  ['unavailable', '#9e9e9e', true]);
await tick({ 'light.ceiling': { state: 'on', attributes: { rgb_color: [128, 213, 255] } } });

// A door contact changes the light scene (the clip of the lamp beside it) in the same render.
await tick({ 'light.floor_lamp': { state: 'on' } });
await page.waitForTimeout(650);
const before = await view();
await tick({ 'binary_sensor.window': { state: before.door === 'on' ? 'off' : 'on' } });
const after = await view();
check('door: the lamp is lit on both sides of the tick', [before.lampLit, after.lampLit], [true, true]);
check('door: the light scene changes in the same render', after.barrier !== before.barrier, true);
check('door: the lamp clip changes in the same render', !!after.lampClip && after.lampClip !== before.lampClip, true);

// A manual virtual light toggled by its marker (the integration's reply sets it).
const virtualBefore = await view();
await evaluate(async () => {
  const card = window.__card;
  card.shadowRoot.querySelector('[data-hp="device"][data-id="hp-virtual"]').click();
  for (let i = 0; i < 20 && !window.__hpVirtualCalls; i++) await new Promise((done) => setTimeout(done, 10));
  await new Promise((done) => setTimeout(done, 0));
  await card.updateComplete;
});
const virtualAfter = await view();
check('virtual light: the toggle reached the integration once', await evaluate(() => window.__hpVirtualCalls), 1);
check('virtual light: its marker turns off in the same render', [virtualBefore.virtualOn, virtualAfter.virtualOn],
  [true, false]);
check('virtual light: its light leaves in the same render', virtualAfter.spots, virtualBefore.spots - 1);

// icon_size: the stripe thickness follows the card config in the same render.
const thin = (await view()).stripe?.width;
await evaluate(async () => {
  const card = window.__card;
  card.setConfig({ ...card._config, icon_size: 5 });
  await card.updateComplete;
});
check('icon_size: the stripe is thicker in the same render', (await view()).stripe?.width > thin, true);

// Room Glow: switching it off in the strip's room removes the field.
await evaluate(async () => {
  await window.__hpTest.setServerConfig((cfg) => {
    const room = cfg.spaces.find((item) => item.id === 'f1').rooms.find((item) => item.id === 'r2');
    room.settings = { ...(room.settings || {}), glow: false };
    return cfg;
  });
});
await page.waitForTimeout(650);
check('room Glow off: no field, the stripe keeps its light', [(await view()).field, (await view()).stripe?.state],
  [null, 'on']);

await finish(browser);
