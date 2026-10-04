/**
 * #780 AC4/AC7/AC12/AC14/AC17 (ТЗ §3, §5, §7, §8, §13.1): the LED strip in
 * the View and on the static card. No LED chunk without a displayed active
 * strip (a hidden shape or an unbound strip loads nothing); an active bound
 * strip replaces the icon, paints the two-stroke stripe and — with Glow — the
 * linear field; off/unavailable have no field, unavailable is dashed. The on
 * core takes the source colour with or without Glow. The whole length is one target: a
 * click toggles once, a touch pan calls nothing. A hidden marker or an
 * HA-disabled device loads no chunk (r1 M4); the value badge stays at the
 * anchor, passive (r1 M1). The static card is passive in all four
 * light_pools × live_states combinations (r1 M6).
 */
import { launch, check, finish } from './serve.mjs';
import { installHpTestOnPage } from './helpers/hp-test.mjs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const { page, browser } = await launch({ width: 1000, height: 820 }, 1);
const ledRequests = [];
page.on('request', (request) => { if (/led-strip-(runtime|field|editor)-/.test(request.url())) ledRequests.push(request.url().replace(/.*\//, '')); });
const evaluate = (fn, arg) => page.evaluate(fn, arg);
const settle = () => page.waitForTimeout(500);
const setStrips = (strips, settings, extra = {}) => evaluate(async ([strips, settings, extra]) => {
  await window.__hpTest.setServerConfig((cfg) => {
    cfg.spaces[0].led_strips = strips;
    cfg.spaces[0].settings = { ...(cfg.spaces[0].settings || {}), ...settings };
    cfg.markers = [
      ...(cfg.markers || []).filter((m) => !['d_light1', 'd_lamp'].includes(m.id)),
      { id: 'd_light1', binding: 'device:d_light1', space: 'f1', ...(extra.d_light1 || {}) },
      { id: 'd_lamp', binding: 'device:d_lamp', space: 'f1', ...(extra.d_lamp || {}) },
    ];
  });
}, [strips, settings, extra]);
const registryDisabled = (by) => evaluate(async (by) => {
  window.__setRegistryDisabled('device', 'd_light1', by);
  window.__card.hass = window.__mkHass();
  await new Promise((resolve) => setTimeout(resolve, 250));
  await window.__card.updateComplete;
}, by);
const setState = (entity, state, attributes = {}) => evaluate(async ([entity, state, attributes]) => {
  const c = window.__card; const st = c.hass.states[entity];
  c.hass = { ...c.hass, states: { ...c.hass.states, [entity]: { ...st, state, attributes: { ...st.attributes, ...attributes } } } };
  await c.updateComplete;
}, [entity, state, attributes]);
const stripe = (marker) => evaluate((marker) => {
  const g = window.__card.shadowRoot.querySelector(`[data-led-strip][data-marker="${marker}"]`);
  return g ? { state: g.dataset.state, core: g.querySelector('.led-core')?.getAttribute('stroke'),
    dash: g.querySelector('.led-core')?.getAttribute('stroke-dasharray') || null,
    outlineWidth: Number(g.querySelector('.led-outline')?.getAttribute('stroke-width')),
    coreWidth: Number(g.querySelector('.led-core')?.getAttribute('stroke-width')) } : null;
}, marker);
const field = () => evaluate(() => window.__card.shadowRoot.querySelectorAll('[data-led-field]').length);
const painted = () => evaluate(() => {
  const root = window.__card.shadowRoot;
  const core = root.querySelector('[data-marker="d_light1"] .led-core');
  const pool = root.querySelector('[data-led-field="ceiling"] .led-pool');
  return { core: core?.getAttribute('stroke'), field: pool?.getAttribute('fill'),
    coreOpacity: core ? getComputedStyle(core).strokeOpacity : null,
    fieldOpacity: Number(pool?.getAttribute('fill-opacity')),
    geometry: ['.led-outline', '.led-core', '.led-hit'].map(selector => {
      const path = root.querySelector(`[data-marker="d_light1"] ${selector}`);
      return [path?.getAttribute('d'), path?.getAttribute('stroke-width')];
    }) };
});

await settle();
check('no strips: no LED chunk requested', ledRequests.length, 0);
await setStrips([{ id: 'hidden', points: [[0.12, 0.40], [0.40, 0.40]], marker: 'd_lamp', active: false },
  { id: 'loose', points: [[0.12, 0.45], [0.40, 0.45]], marker: null }], { glow_enabled: true });
await settle();
check('hidden shape and unbound strip: still no LED chunk', ledRequests.length, 0);
check('a hidden shape leaves the ordinary icon', await evaluate(() => !!window.__card.shadowRoot.querySelector('.dev[data-id="d_lamp"]')));
// r1 M4 (ТЗ §13.1): visibility is decided before import() — an active strip of
// a hidden marker or of an HA-disabled device loads no LED chunk at all.
const ceilingStrip = [{ id: 'ceiling', points: [[0.12, 0.30], [0.40, 0.30], [0.40, 0.45]], marker: 'd_light1' }];
await setStrips(ceilingStrip, { glow_enabled: true }, { d_light1: { hidden: true } });
await settle();
check('a hidden marker: its active strip loads no LED chunk', ledRequests.length, 0);
check('a hidden marker: no stripe, no badge, no icon', await evaluate(() => {
  const root = window.__card.shadowRoot;
  return !root.querySelector('[data-led-strip], [data-led-badge], .dev[data-id="d_light1"]');
}));
await registryDisabled('user');
await setStrips(ceilingStrip, { glow_enabled: true });
await settle();
check('an HA-disabled device: its active strip loads no LED chunk', ledRequests.length, 0);
await registryDisabled(null);

await setStrips([{ id: 'ceiling', points: [[0.12, 0.30], [0.40, 0.30], [0.40, 0.45]], marker: 'd_light1' },
  { id: 'loose', points: [[0.12, 0.45], [0.30, 0.45]], marker: null }], { glow_enabled: true });
await settle();
check('a displayed active strip loads the runtime', ledRequests.some((url) => url.startsWith('led-strip-runtime-')));
check('the editor chunk is not loaded in the View', ledRequests.some((url) => url.startsWith('led-strip-editor-')), false);
check('the icon is replaced by the strip', await evaluate(() => !window.__card.shadowRoot.querySelector('.dev[data-id="d_light1"]')));
check('unbound strip is absent from the View', await evaluate(() => window.__card.shadowRoot.querySelectorAll('[data-led-strip]').length), 1);
check('no round pool at the anchor: the strip is the source', await evaluate(() =>
  !window.__card.shadowRoot.querySelector('[data-glow-source="light.ceiling"]')));
check('no auto-slot reserved for the strip’s marker', await evaluate(() => !('d_light1' in (window.__card._defPos || {}))));
await setState('light.ceiling', 'on', { rgb_color: [128, 213, 255], brightness: 64 });
await settle();
const onStripe = await stripe('d_light1');
check('on with Glow: source-coloured core and a field', [onStripe?.state, onStripe?.core, onStripe?.dash, await field() > 0],
  ['on', '#80d5ff', null, true]);
const firstPaint = await painted();
check('#790: rendered core and field share the resolved RGB colour', [firstPaint.core, firstPaint.field], ['#80d5ff', '#80d5ff']);
await setState('light.ceiling', 'on', { rgb_color: [225, 70, 35] });
await settle();
const rgbPaint = await painted();
check('#790: HA RGB update changes the existing core and field', [rgbPaint.core, rgbPaint.field], ['#e14623', '#e14623']);
check('#790: a colour update changes no outline, core or hit geometry', rgbPaint.geometry, firstPaint.geometry);
await setState('light.ceiling', 'on', { rgb_color: null, color_temp_kelvin: 3000 });
await settle();
const warmPaint = await painted();
check('#790: colour temperature uses the same resolved field colour', warmPaint.core === warmPaint.field
  && warmPaint.core !== '#FFFFFF' && warmPaint.core !== rgbPaint.core);
await setStrips(ceilingStrip, { glow_enabled: true }, { d_light1: { glow_color: { c: '#d837a6', bri: 0.2 } } });
await settle();
const manualPaint = await painted();
check('#790: saved manual colour updates core and field', [manualPaint.core, manualPaint.field], ['#d837a6', '#d837a6']);
check('#790: field brightness never becomes core opacity', manualPaint.coreOpacity === '1' && manualPaint.fieldOpacity < 1);
check('#790: manual colour changes no physical geometry', manualPaint.geometry, firstPaint.geometry);

// AC3: the same public HA/config path in both themes, Flat/2.5D and on/off.
// Optional local review captures are not golden baselines or release files.
const captureDir = process.env.HP_LED_COLOR_SCREENSHOTS;
if (captureDir) await mkdir(captureDir, { recursive: true });
await setStrips(ceilingStrip, { glow_enabled: true });
for (const dark of [false, true]) for (const iso of [false, true]) {
  await evaluate(async dark => {
    const card = window.__card;
    card.hass = { ...card.hass, themes: { ...(card.hass.themes || {}), darkMode: dark } };
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    await window.__hpTest.settled();
  }, dark);
  await evaluate(iso => window.__hpTest.setVolumetricView(iso), iso);
  let onGeometry;
  for (const state of ['on', 'off']) {
    await setState('light.ceiling', state, { rgb_color: [128, 213, 255] });
    await page.waitForTimeout(600);
    const actual = await painted();
    const label = `#790: ${dark ? 'dark' : 'light'}, ${iso ? '2.5D' : 'Flat'}, ${state}`;
    check(`${label}: core colour`, actual.core, state === 'on' ? '#80d5ff' : '#FFFFFF');
    if (state === 'on') onGeometry = actual.geometry;
    else check(`${label}: geometry stays unchanged`, actual.geometry, onGeometry);
    if (captureDir) {
      const box = await page.locator('[data-led-strip="ceiling"] .led-outline').boundingBox();
      const x = Math.max(0, box.x - 30), y = Math.max(0, box.y - 30);
      await page.screenshot({ path: join(captureDir, `${dark ? 'dark' : 'light'}-${iso ? 'iso' : 'flat'}-${state}.png`),
        clip: { x, y, width: Math.min(1000 - x, box.width + 60), height: Math.min(820 - y, box.height + 60) } });
    }
  }
}
await evaluate(async () => {
  const card = window.__card;
  card.hass = { ...card.hass, themes: { ...(card.hass.themes || {}), darkMode: false } };
  document.documentElement.style.colorScheme = 'light';
  await window.__hpTest.setVolumetricView(false);
});
await setState('light.ceiling', 'on', { rgb_color: [128, 213, 255] });
await settle();

// r1 M1 (ТЗ §5): the strip keeps the device's value badge, passive, at the
// half-length anchor — the icon core, pulse and slot stay suppressed.
const badgeAt = (root) => evaluate((root) => {
  const host = root === 'card' ? window.__card : document.querySelector('houseplan-space-card');
  const sr = host.shadowRoot;
  const badge = sr.querySelector('[data-led-badge="d_light1"]');
  if (!badge) return null;
  const core = badge.querySelector('.device-core').getBoundingClientRect();
  const value = badge.querySelector('.value-badge');
  const style = getComputedStyle(badge);
  return { text: value?.textContent?.trim() || '', x: core.x + core.width / 2, y: core.y + core.height / 2,
    passive: style.pointerEvents === 'none' && badge.getAttribute('aria-hidden') === 'true',
    coreHidden: getComputedStyle(badge.querySelector('.device-core')).visibility === 'hidden',
    icon: !!badge.querySelector('ha-icon, .device-pulse, .activity-dot') };
}, root);
const midpoint = () => evaluate(() => {
  const el = window.__card.shadowRoot.querySelector('.led-hit');
  const p = el.getPointAtLength(el.getTotalLength() / 2), m = el.getScreenCTM();
  return [p.x * m.a + m.e, p.y * m.d + m.f];
});
check('no configured badge: no badge element', await badgeAt('card'), null);
await setStrips(ceilingStrip, { glow_enabled: true }, { d_light1: { display: 'badge', value_badge: {
  enabled: true, source: { kind: 'entity_state', entity_id: 'sensor.living_temp' }, position: 'right' } } });
await settle();
{
  const badge = await badgeAt('card');
  const [mx, my] = await midpoint();
  check('the value badge stays with the strip', !!badge?.text);
  check('the badge sits at the half-length anchor', !!badge && Math.hypot(badge.x - mx, badge.y - my) < 3,
    true);
  check('the badge is passive, without the icon core or pulse',
    JSON.stringify(badge && [badge.passive, badge.coreHidden, badge.icon]), JSON.stringify([true, true, false]));
}

// One target over the whole length: a click toggles exactly once.
const calls = await evaluate(async () => {
  const c = window.__card; const log = [];
  const service = c.hass.callService;
  window.__ledToggle = log;
  c.hass = { ...c.hass, callService: async (d, s, data) => { log.push(`${d}.${s}:${data?.entity_id}`); return service(d, s, data); } };
  await c.updateComplete;
  return log.length;
});
const hit = await evaluate(() => { const r = window.__card.shadowRoot.querySelector('.led-hit').getBoundingClientRect(); return [r.x + r.width * 0.25, r.y + 2]; });
const box = await evaluate(() => { const p = window.__card.shadowRoot.querySelector('.led-hit'); const len = p.getTotalLength(); const pt = p.getPointAtLength(len * 0.3); const m = p.getScreenCTM(); return [pt.x * m.a + m.e, pt.y * m.d + m.f]; });
await page.mouse.click(box[0], box[1]);
await page.waitForFunction(() => window.__card.hass.states['light.ceiling'].state === 'off');
check('a click on the stripe toggles once', await evaluate(() => window.__ledToggle.length), calls + 1);
check('turning off keeps the field for the fade', await evaluate(() =>
  window.__card.shadowRoot.querySelector('[data-led-field]')?.getAttribute('data-led-phase')), 'leaving');
check('a pointer click leaves no selection outline', await evaluate(() => {
  const root = window.__card.shadowRoot;
  const target = root.querySelector('.led-hit');
  return !target.matches(':focus-visible')
    && getComputedStyle(root.querySelector('.led-focus')).stroke === 'rgba(0, 0, 0, 0)';
}), true);
await page.waitForTimeout(600);
void hit;
const offStripe = await stripe('d_light1');
check('off: no field, white core', JSON.stringify([offStripe?.state, offStripe?.core, offStripe?.dash, await field()]),
  JSON.stringify(['off', '#FFFFFF', null, 0]));
check('#785: switching does not change the physical stripe thickness',
  JSON.stringify([offStripe?.outlineWidth, offStripe?.coreWidth]),
  JSON.stringify([onStripe?.outlineWidth, onStripe?.coreWidth]));
// A pan along the stripe calls nothing; the next clean click works at once.
const along = (k) => evaluate((k) => {
  const el = window.__card.shadowRoot.querySelector('.led-hit');
  const p = el.getPointAtLength(el.getTotalLength() * k), m = el.getScreenCTM();
  return [p.x * m.a + m.e, p.y * m.d + m.f];
}, k);
{
  const [x0, y0] = await along(0.3), [x1, y1] = await along(0.45);
  await page.mouse.move(x0, y0); await page.mouse.down();
  await page.mouse.move(x1, y1, { steps: 8 }); await page.mouse.up();
}
await settle();
const ceiling = () => evaluate(() => window.__card.hass.states['light.ceiling'].state);
check('a pan along the stripe calls no service', await ceiling(), 'off');
{
  const [x, y] = await along(0.6);
  await page.mouse.click(x, y);
}
await page.waitForFunction(() => window.__card.hass.states['light.ceiling'].state === 'on');
const fadeInOpacity = await evaluate(() => Number(getComputedStyle(
  window.__card.shadowRoot.querySelector('[data-led-field]'),
).opacity));
check('turning on starts below full opacity', fadeInOpacity < 0.95, true);
await page.waitForTimeout(600);
check('turning on reaches full opacity smoothly', await evaluate(() => Number(getComputedStyle(
  window.__card.shadowRoot.querySelector('[data-led-field]'),
).opacity) > 0.99), true);
check('the next clean click works at once', await ceiling(), 'on');
{
  const [x, y] = await along(0.6);
  await page.mouse.click(x, y);
}
await settle();
await setState('light.ceiling', 'unavailable');
await settle();
const unavailable = await stripe('d_light1');
check('unavailable: dashed grey, no field', [unavailable?.state, unavailable?.core, !!unavailable?.dash, await field()],
  ['unavailable', '#9e9e9e', true, 0]);
await setState('light.ceiling', 'unknown');
await settle();
const unknown = await stripe('d_light1');
check('#790: unknown keeps the grey dashed unavailable presentation',
  [unknown?.state, unknown?.core, !!unknown?.dash, await field()], ['unavailable', '#9e9e9e', true, 0]);
await setState('light.ceiling', 'on', { rgb_color: [128, 213, 255] });
await setStrips(await evaluate(() => window.__card._serverCfg.spaces[0].led_strips), { glow_enabled: false });
await settle();
// The state update and the room setting update are deliberately separate. On
// a fast runner the first render can start the entering transition before the
// second one turns Glow off, so let that legitimate 500 ms leaving phase
// finish before asserting the stable no-Glow contract.
await page.waitForFunction(() => !window.__card.shadowRoot.querySelector('[data-led-field]'));
const colored = await stripe('d_light1');
check('on without Glow: source-coloured core, no field', [colored?.state, colored?.core, await field()],
  ['on', '#80d5ff', 0]);
await evaluate(async () => {
  await window.__hpTest.setServerConfig(cfg => {
    cfg.spaces[0].settings.glow_enabled = true;
    const room = cfg.spaces[0].rooms.find(room => room.id === 'r1');
    room.settings = { ...(room.settings || {}), glow: false };
  });
});
await settle();
check('#790: room Glow override changes no live core colour',
  [(await stripe('d_light1'))?.core, await field()], ['#80d5ff', 0]);
await evaluate(async () => {
  await window.__hpTest.setServerConfig(cfg => {
    cfg.spaces[0].rooms.find(room => room.id === 'r1').settings.glow = null;
  });
});

// The static card (ТЗ §8, AC14, r1 M6): the full light_pools × live_states
// matrix. Passive in all four: no hit path, no focus, a click calls nothing.
// live_states:false — a neutral stripe, no field; light_pools:false — no
// field, the core carries the source colour when the state is live.
await setStrips(await evaluate(() => window.__card._serverCfg.spaces[0].led_strips), { glow_enabled: true },
  { d_light1: { display: 'badge', value_badge: {
    enabled: true, source: { kind: 'entity_state', entity_id: 'sensor.living_temp' }, position: 'right' } } });
const matrix = await evaluate(async () => {
  await customElements.whenDefined('houseplan-space-card');
  const host = document.createElement('div'); host.style.width = '700px'; document.body.appendChild(host);
  const cards = {};
  for (const pools of [false, true]) for (const live of [false, true]) {
    const el = document.createElement('houseplan-space-card');
    el.setConfig({ type: 'custom:houseplan-space-card', space: 'f1', light_pools: pools, live_states: live });
    el.hass = window.__card.hass; host.appendChild(el);
    cards[`pools=${pools},live=${live}`] = el;
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 60; i++) {
    await wait(50);
    if (Object.values(cards).every((el) => el.shadowRoot?.querySelector('[data-led-strip]'))
      && cards['pools=true,live=true'].shadowRoot.querySelector('[data-led-field]')) break;
  }
  await wait(300);
  const out = {};
  for (const [key, el] of Object.entries(cards)) {
    const sr = el.shadowRoot;
    const g = sr.querySelector('[data-led-strip]');
    const core = g?.querySelector('.led-core');
    const box = core?.getBoundingClientRect();
    if (box) {
      const target = sr.elementFromPoint?.(box.x + box.width / 2, box.y + box.height / 2);
      target?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    }
    out[key] = {
      state: g?.dataset.state, core: core?.getAttribute('stroke'),
      field: !!sr.querySelector('[data-led-field]'),
      passive: !sr.querySelector('.led-hit, [data-led-strip] [role], [data-led-strip] [tabindex]'),
      badge: !!sr.querySelector('[data-led-badge="d_light1"] .value-badge'),
    };
  }
  host.remove();
  return out;
});
check('static live_states:false + light_pools:false — neutral, no field, passive', JSON.stringify(matrix['pools=false,live=false']),
  JSON.stringify({ state: 'off', core: '#FFFFFF', field: false, passive: true, badge: true }));
check('static live_states:true + light_pools:false — source colour in the core, no field, passive', JSON.stringify(matrix['pools=false,live=true']),
  JSON.stringify({ state: 'on', core: '#80d5ff', field: false, passive: true, badge: true }));
check('static live_states:false + light_pools:true — neutral, no field, passive', JSON.stringify(matrix['pools=true,live=false']),
  JSON.stringify({ state: 'off', core: '#FFFFFF', field: false, passive: true, badge: true }));
check('static live_states:true + light_pools:true — source colour and the field, passive', JSON.stringify(matrix['pools=true,live=true']),
  JSON.stringify({ state: 'on', core: '#80d5ff', field: true, passive: true, badge: true }));
check('a click on any static stripe toggles nothing', await evaluate(() => window.__card.hass.states['light.ceiling'].state), 'on');

// #789 AC2: real transition events, not merely the declared CSS duration.
// Do not read computed style/layout between insertion and its entering rAF:
// that flush can manufacture the initial opacity and hide a lost fade.
await page.emulateMedia({ reducedMotion: 'no-preference' });
await evaluate(async () => {
  const main = window.__card;
  const host = document.createElement('div');
  host.style.width = '700px'; document.body.appendChild(host);
  const stat = document.createElement('houseplan-space-card');
  stat.setConfig({ type: 'custom:houseplan-space-card', space: 'f1', light_pools: true, live_states: true });
  stat.hass = main.hass; host.appendChild(stat);
  await stat.updateComplete;
  const proof = window.__ledFadeProof = {
    cards: [main, stat], host, savedHass: main.hass, log: [], listeners: [],
    selectors: ['[data-led-field="ceiling"]', '[data-glow-source="light.floor_lamp"]'],
    parent: main.parentNode, next: main.nextSibling, updates: [0, 0], late: [], descriptors: [],
  };
  proof.nodes = () => proof.cards.map(card => proof.selectors.map(selector => card.shadowRoot.querySelector(selector)));
  proof.set = async state => {
    const states = { ...main.hass.states };
    for (const eid of ['light.ceiling', 'light.floor_lamp']) states[eid] = { ...states[eid], state };
    const hass = { ...main.hass, states };
    for (const card of proof.cards) card.hass = hass;
    await Promise.all(proof.cards.map(card => card.updateComplete));
  };
  for (const [cardIndex, card] of proof.cards.entries()) {
    const listener = event => {
      if (event.propertyName !== 'opacity') return;
      const kind = proof.selectors.findIndex(selector => event.target.matches(selector));
      if (kind >= 0) proof.log.push({ card: cardIndex, kind, event: event.type, elapsed: event.elapsedTime });
    };
    for (const name of ['transitionrun', 'transitionend']) card.shadowRoot.addEventListener(name, listener);
    proof.listeners.push(listener);
  }
  await proof.set('off');
});
try {
  await page.waitForFunction(() => window.__ledFadeProof.cards.every(card =>
    card.shadowRoot.querySelector('[data-led-strip]')));
  await page.waitForTimeout(650);
  check('#789: both kinds start absent on both surfaces', await evaluate(() =>
    window.__ledFadeProof.nodes().every(nodes => nodes.every(node => !node))), true);
  const fadeSet = state => evaluate(async state => {
    const proof = window.__ledFadeProof; proof.log = []; await proof.set(state);
  }, state);
  const fadeSnapshot = () => evaluate(() => {
    const proof = window.__ledFadeProof;
    return { log: proof.log, nodes: proof.nodes().map(nodes => nodes.map(node => node ? {
      opacity: Number(getComputedStyle(node).opacity), leaving: node.classList.contains('is-leaving'),
      entering: node.classList.contains('is-entering'),
    } : null)) };
  });
  const checkFadeEvents = (phase, result, cards = [0, 1], kinds = [0, 1]) => {
    for (const card of cards) for (const kind of kinds) {
      const events = result.log.filter(event => event.card === card && event.kind === kind);
      const label = `#789: ${card ? 'static' : 'main'} ${kind ? 'ordinary' : 'LED'} ${phase}`;
      check(`${label} actually starts an opacity transition`, events.some(event => event.event === 'transitionrun'), true);
      check(`${label} completes the unchanged 500 ms transition`, events.some(event =>
        event.event === 'transitionend' && Math.abs(event.elapsed - 0.5) < 0.01), true);
    }
  };
  await fadeSet('on');
  await page.waitForTimeout(750);
  const fadeOn = await fadeSnapshot();
  checkFadeEvents('on', fadeOn);
  check('#789: all four fields finish on at full opacity', fadeOn.nodes.every(nodes =>
    nodes.every(node => node?.opacity === 1 && !node.leaving)), true);
  // Observe the real bundled call graph, without wrapping private methods or
  // inferring render-pass wiring from source text. Coverage is not timing data.
  const coverageSession = await page.context().newCDPSession(page);
  try {
    await coverageSession.send('Profiler.enable');
    await coverageSession.send('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
    for (const pass of [1, 2]) {
      await coverageSession.send('Profiler.takePreciseCoverage');
      await evaluate(async () => {
        const card = window.__card;
        card.requestUpdate();
        for (let attempt = 0; attempt < 10; attempt++) {
          const complete = await card.updateComplete;
          if (complete !== false && !card.isUpdatePending) return;
        }
        throw new Error('#789: observed main render did not settle');
      });
      const result = await coverageSession.send('Profiler.takePreciseCoverage');
      const functions = result.result.flatMap(script => script.functions);
      const calls = name => functions.filter(fn => fn.functionName === name)
        .reduce((sum, fn) => sum + (fn.ranges[0]?.count || 0), 0);
      const counts = { render: calls('_renderLightPass'), reads: calls('_lightBarriers'), builds: calls('_resolveLightBarriers') };
      check(`#789: observed main render pass ${pass} executes`, counts.render > 0, true);
      check(`#789: Glow and LED share barrier reads in pass ${pass}`, counts.reads >= 2 * counts.render, true);
      check(`#789: pass ${pass} resolves barriers exactly once per render, never across renders`, counts.builds, counts.render);
      console.log('#789 render-pass coverage', JSON.stringify({ pass, ...counts }));
    }
  } finally {
    await coverageSession.send('Profiler.stopPreciseCoverage');
    await coverageSession.send('Profiler.disable');
    await coverageSession.detach();
  }
  await fadeSet('off');
  check('#789: normal off retains all four nodes for their fade', await evaluate(() =>
    window.__ledFadeProof.nodes().every(nodes => nodes.every(node => node?.classList.contains('is-leaving')))), true);
  await page.waitForTimeout(750);
  const fadeOff = await fadeSnapshot();
  checkFadeEvents('off', fadeOff);
  check('#789: normal off removes all four fields after fading', fadeOff.nodes.every(nodes => nodes.every(node => !node)), true);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await fadeSet('on');
  await page.waitForTimeout(200);
  const reducedOn = await fadeSnapshot();
  check('#789: reduced motion shows LED and ordinary immediately on both surfaces', reducedOn.nodes.every(nodes =>
    nodes.every(node => node?.opacity === 1)), true);
  check('#789: reduced on starts no CSS opacity animation', reducedOn.log.length, 0);
  await fadeSet('off');
  await page.waitForTimeout(200);
  const reducedOff = await fadeSnapshot();
  check('#789: reduced off is immediately dark on both surfaces', reducedOff.nodes.every(nodes =>
    nodes.every(node => node?.opacity === 0)), true);
  check('#789: reduced off starts no CSS opacity animation', reducedOff.log.length, 0);
  await page.waitForTimeout(450);
  check('#789: reduced off still removes every field', await evaluate(() =>
    window.__ledFadeProof.nodes().every(nodes => nodes.every(node => !node))), true);

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await fadeSet('on');
  await page.waitForTimeout(750);
  await evaluate(() => { window.__ledFadeProof.savedNodes = window.__ledFadeProof.nodes(); });
  await fadeSet('off');
  await page.waitForTimeout(100);
  await fadeSet('on');
  await page.waitForTimeout(750); // beyond the cancelled off timer as well as the returning fade
  check('#789: rapid off/on retains every DOM node beyond the stale fade deadline', await evaluate(() => {
    const proof = window.__ledFadeProof;
    return proof.nodes().every((nodes, card) => nodes.every((node, kind) => node
      && node === proof.savedNodes[card][kind] && !node.classList.contains('is-leaving')
      && Number(getComputedStyle(node).opacity) === 1));
  }), true);

  await fadeSet('off');
  await page.waitForTimeout(650);
  await evaluate(async () => {
    // Both Lit commits finish in microtasks, before a browser entering-frame.
    await window.__ledFadeProof.set('on'); await window.__ledFadeProof.set('off');
  });
  await page.waitForTimeout(650);
  check('#789: off before the entry frame cannot resurrect a field', await evaluate(() =>
    window.__ledFadeProof.nodes().every(nodes => nodes.every(node => !node))), true);

  await evaluate(async () => {
    const proof = window.__ledFadeProof;
    await proof.set('on');
    // Lit's updated() can enqueue a header/summary follow-up. Drain only its
    // microtasks before observing disconnect: entry rAFs must still be pending.
    const drainUpdates = async phase => {
      for (let attempt = 0; attempt < 10; attempt++) {
        const complete = await Promise.all(proof.cards.map(card => card.updateComplete));
        if (complete.every(result => result !== false) && proof.cards.every(card => !card.isUpdatePending)) return;
      }
      throw new Error(`#789: pending Lit microtasks did not settle ${phase} disconnect`);
    };
    await drainUpdates('before');
    if (!proof.nodes().every(nodes => nodes.every(node => node?.classList.contains('is-entering')))) {
      throw new Error('#789: disconnect witness must precede every entering frame');
    }
    for (const [index, card] of proof.cards.entries()) {
      proof.descriptors[index] = Object.getOwnPropertyDescriptor(card, 'requestUpdate');
      const original = card.requestUpdate;
      card.requestUpdate = function (...args) {
        proof.updates[index]++;
        if (!this.isConnected) proof.late.push({ card: index, stack: new Error().stack });
        return original.apply(this, args);
      };
    }
    // Disconnect in this microtask, with entry rAFs/feather timers still pending.
    for (const card of proof.cards) card.remove();
    // Teardown itself mutates reactive header/summary state. Finish that same
    // microtask chain before measuring late callbacks; no rAF/timer can run yet.
    await drainUpdates('after');
    proof.updates = [0, 0];
    proof.late = [];
  });
  await page.waitForTimeout(750);
  check('#789: disconnected main/static owners receive no late transition updates', await evaluate(() =>
    window.__ledFadeProof.updates), [0, 0]);
  const late = await evaluate(() => window.__ledFadeProof.late);
  if (late.length) console.log('#789 late update diagnostic', JSON.stringify(late, null, 2));
  await evaluate(async () => {
    const proof = window.__ledFadeProof; proof.log = [];
    proof.parent.insertBefore(proof.cards[0], proof.next?.parentNode === proof.parent ? proof.next : null);
    proof.host.appendChild(proof.cards[1]);
    await Promise.all(proof.cards.map(card => card.updateComplete));
  });
  await page.waitForTimeout(750);
  const reconnected = await fadeSnapshot();
  checkFadeEvents('reconnected', reconnected);
  check('#789: reconnect starts clean lifecycles and returns all four fields', reconnected.nodes.every(nodes =>
    nodes.every(node => node?.opacity === 1 && !node.leaving)), true);
  for (const exit of [
    { label: 'disabled pools', config: { space: 'f1', light_pools: false } },
    { label: 'another space', config: { space: 'garden', light_pools: true } },
  ]) {
    await fadeSet('off');
    await page.waitForTimeout(650);
    await evaluate(async config => {
      const proof = window.__ledFadeProof;
      await proof.set('on');
      if (!proof.nodes()[1].every(node => node?.classList.contains('is-entering'))) {
        throw new Error('#789: config exit must precede the static entering frame');
      }
      proof.cards[1].setConfig({ type: 'custom:houseplan-space-card', live_states: true, ...config });
      await proof.cards[1].updateComplete;
    }, exit.config);
    await page.waitForTimeout(750);
    check(`#789: ${exit.label} removes previous static fields beyond their old callbacks`, await evaluate(() =>
      window.__ledFadeProof.nodes()[1].every(node => !node)), true);
    await evaluate(async () => {
      const proof = window.__ledFadeProof; proof.log = [];
      proof.cards[1].setConfig({ type: 'custom:houseplan-space-card', space: 'f1', light_pools: true, live_states: true });
      await proof.cards[1].updateComplete;
    });
    await page.waitForTimeout(750);
    const returned = await fadeSnapshot();
    checkFadeEvents(`return from ${exit.label}`, returned, [1]);
    check(`#789: return from ${exit.label} starts fresh static fields`, returned.nodes[1].every(node =>
      node?.opacity === 1 && !node.leaving), true);
  }
  await fadeSet('off');
  await page.waitForTimeout(650);
  await evaluate(async () => {
    const proof = window.__ledFadeProof;
    await proof.set('on');
    if (!proof.nodes()[0].every(node => node?.classList.contains('is-entering'))) {
      throw new Error('#789: main navigation must start before the entering frame');
    }
    await window.__hpTest.switchSpace('garden');
  });
  await page.waitForTimeout(750);
  check('#789: main LED-to-empty navigation removes both former sources beyond stale callbacks', await evaluate(() =>
    window.__ledFadeProof.nodes()[0].every(node => !node)), true);
  await evaluate(async () => {
    window.__ledFadeProof.log = [];
    await window.__hpTest.switchSpace('f1');
  });
  await page.waitForTimeout(750);
  const mainReturned = await fadeSnapshot();
  checkFadeEvents('return from LED-free space', mainReturned, [0], [0]);
  // Main ordinary Glow has retained its per-space appearance without replay on
  // navigation since before #789. Preserve that UX; only LED starts a fresh
  // lifecycle here. The real on/off fade assertions above still cover both.
  check('#789: main navigation back restores the LED field at full opacity',
    mainReturned.nodes[0][0]?.opacity === 1 && !mainReturned.nodes[0][0].leaving, true);
  const retainedOrdinary = mainReturned.nodes[0][1];
  check('#789: main navigation preserves steady ordinary Glow without replay',
    retainedOrdinary?.opacity === 1 && !retainedOrdinary.entering && !retainedOrdinary.leaving, true);

  // Keep the same mounted static card while its server-side space vanishes.
  // This exercises renderSpaceStatic's !space exit, not setConfig/disconnect.
  await fadeSet('off');
  await page.waitForTimeout(650);
  await evaluate(async () => {
    const proof = window.__ledFadeProof;
    await proof.set('on');
    if (!proof.nodes()[1].every(node => node?.classList.contains('is-entering'))) {
      throw new Error('#789: server removal must start before the static entering frame');
    }
    await window.__hpTest.setServerConfig(cfg => {
      proof.savedConfig = structuredClone(cfg);
      cfg.spaces = cfg.spaces.filter(space => space.id !== 'f1');
      cfg.markers = (cfg.markers || []).filter(marker => marker.space !== 'f1');
    });
  });
  await page.waitForFunction(() => !window.__ledFadeProof.cards[1].shadowRoot.querySelector('[data-led-strip]'));
  await page.waitForTimeout(750);
  check('#789: a missing server space clears both fields without disconnecting the static card', await evaluate(() => {
    const proof = window.__ledFadeProof;
    return proof.cards[1].isConnected && proof.nodes()[1].every(node => !node);
  }), true);
  await evaluate(async () => {
    const proof = window.__ledFadeProof; proof.log = [];
    await window.__hpTest.setServerConfig(proof.savedConfig);
    delete proof.savedConfig;
  });
  await page.waitForTimeout(750);
  const restoredSpace = await fadeSnapshot();
  checkFadeEvents('restored server space', restoredSpace, [1]);
  check('#789: restoring a server space starts fresh static LED and ordinary fields', restoredSpace.nodes[1].every(node =>
    node?.opacity === 1 && !node.leaving), true);
  await evaluate(() => window.__hpTest.switchSpace('f1'));
  await page.waitForTimeout(750);
} finally {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await evaluate(async () => {
    const proof = window.__ledFadeProof;
    if (proof.savedConfig) {
      await window.__hpTest.setServerConfig(proof.savedConfig);
      delete proof.savedConfig;
    }
    for (const [index, card] of proof.cards.entries()) {
      for (const name of ['transitionrun', 'transitionend']) card.shadowRoot.removeEventListener(name, proof.listeners[index]);
      if (index < proof.descriptors.length) {
        if (proof.descriptors[index]) Object.defineProperty(card, 'requestUpdate', proof.descriptors[index]);
        else delete card.requestUpdate;
      }
    }
    const main = proof.cards[0];
    if (!main.isConnected) proof.parent.insertBefore(main, proof.next?.parentNode === proof.parent ? proof.next : null);
    main.hass = proof.savedHass;
    proof.cards[1].remove(); proof.host.remove();
    delete window.__ledFadeProof;
    await main.updateComplete;
  });
  await page.waitForFunction(() => window.__card.shadowRoot.querySelector('[data-led-strip]'));
  await settle();
}

for (const mode of ['plan', 'decor']) {
  await evaluate(mode => window.__hpTest.setMode(mode), mode);
  check(`#790: ${mode} keeps the coloured core passive and translucent`, await evaluate(() => {
    const root = window.__card.shadowRoot;
    return [root.querySelector('[data-marker="d_light1"] .led-core')?.getAttribute('stroke'),
      root.querySelector('.led-passive')?.getAttribute('opacity'), !!root.querySelector('.led-hit')];
  }), ['#80d5ff', '0.45', false]);
}
await evaluate(() => window.__hpTest.setMode('devices'));
check('#790: Devices retains the live core colour', (await stripe('d_light1'))?.core, '#80d5ff');
await setStrips([...ceilingStrip, { id: 'loose', points: [[0.12, 0.45], [0.30, 0.45]], marker: null }],
  { glow_enabled: true });
check('#790: unbound Devices strip keeps its grey dashed presentation', await evaluate(() => {
  const path = window.__card.shadowRoot.querySelector('[data-led-unbound="loose"]');
  return [path?.getAttribute('stroke'), !!path?.getAttribute('stroke-dasharray')];
}), ['#8a8a8a', true]);
await page.locator('.led-select-hit[data-led-select="ceiling"]').dispatchEvent('click');
await page.waitForTimeout(100);
await page.click('[data-led-action="settings"]');
await page.waitForTimeout(100);
const radiusFocus = await evaluate(() => {
  const input = window.__card.shadowRoot.querySelector('#marker-glow-radius');
  const unit = input?.closest('.hpf-unit');
  input?.focus();
  return input && unit ? {
    input: getComputedStyle(input).outlineStyle,
    wrapper: getComputedStyle(unit).outlineStyle,
  } : null;
});
check('the Glow radius has one wrapper focus outline', JSON.stringify(radiusFocus),
  JSON.stringify({ input: 'none', wrapper: 'solid' }));

// The device dialog offers «Show as LED strip» before the tool is loaded:
// a static section (no dialog shift), the press loads the tool and starts
// drawing for this same marker after the dialog's own close path.
// A fresh page without strips: entering the Devices editor alone loads nothing.
await page.reload();
await page.waitForFunction(() => window.__card?._loadOk);
await installHpTestOnPage(page);
ledRequests.length = 0;
const before = 0;
await evaluate(async () => { await window.__hpTest.setMode('devices'); await window.__hpTest.openMarkerDialog('d_tv'); });
await page.waitForTimeout(200);
check('static «Show as LED strip» without the tool chunk', await evaluate(() =>
  !!window.__card.shadowRoot.querySelector('[data-led-representation="icon"] [data-led-action="show-strip"]')),
  true);
check('the dialog alone loads no LED tool', ledRequests.filter((name) => name.startsWith('led-strip-editor-')).length, before);
await page.click('[data-led-representation] [data-led-action="show-strip"]');
await page.waitForTimeout(600);
check('the press loads the tool and draws for the same marker', await evaluate(() => {
  const led = window.__card._ledEditor;
  return !!led?.tool && led.chain?.convert === 'd_tv' && !window.__card._markerDialog;
}));

// A fresh document makes both lazy imports genuinely cold. Hold each network
// response, disconnect its requesting static card, then let the actual module
// finish loading: no private runtime hooks or synthetic callback.
await evaluate(() => localStorage.clear()); // isolated demo browser storage only
ledRequests.length = 0;
await page.reload();
await page.waitForFunction(() => window.__card?._loadOk);
await installHpTestOnPage(page);
await evaluate(async () => {
  window.__card.setConfig({ type: 'custom:houseplan-card', floor: 'garden' });
  await window.__card.updateComplete;
});
await setStrips(ceilingStrip, { glow_enabled: true });
check('#789: fixed non-LED main card leaves both LED imports cold', ledRequests.filter(url =>
  /^led-strip-(runtime|field)-/.test(url)).length, 0);
for (const kind of ['runtime', 'field']) {
  let releaseImport;
  const barrier = new Promise(resolve => { releaseImport = resolve; });
  const pattern = new RegExp(`/led-strip-${kind}-[^/]+\\.js(?:\\?.*)?$`);
  const holdImport = async route => { await barrier; await route.fallback(); };
  await page.route(pattern, holdImport);
  try {
    const requested = page.waitForRequest(pattern);
    await evaluate(async () => {
      const card = document.createElement('houseplan-space-card');
      card.setConfig({ type: 'custom:houseplan-space-card', space: 'f1', light_pools: true, live_states: true });
      card.hass = window.__card.hass;
      document.body.appendChild(card);
      window.__ledColdProof = { card, updates: 0, original: card.requestUpdate };
      await card.updateComplete;
    });
    await requested;
    check(`#789: cold static ${kind} import has not painted its content yet`, await evaluate(kind =>
      !window.__ledColdProof.card.shadowRoot.querySelector(kind === 'runtime' ? '[data-led-strip]' : '[data-led-field]'), kind), true);
    await evaluate(async () => {
      const proof = window.__ledColdProof, card = proof.card;
      card.remove();
      let settled = false;
      for (let attempt = 0; attempt < 10; attempt++) {
        const complete = await card.updateComplete;
        if (complete !== false && !card.isUpdatePending) { settled = true; break; }
      }
      if (!settled) throw new Error('#789: cold static teardown did not settle');
      card.requestUpdate = function (...args) { proof.updates++; return proof.original.apply(this, args); };
    });
    const arrived = page.waitForResponse(pattern);
    releaseImport();
    await (await arrived).finished();
    await page.waitForTimeout(750);
    check(`#789: a cold ${kind} arriving after static disconnect requests no update`, await evaluate(() =>
      window.__ledColdProof.updates), 0);
  } finally {
    releaseImport();
    await page.unroute(pattern, holdImport);
    await evaluate(() => {
      const proof = window.__ledColdProof;
      if (proof) { delete proof.card.requestUpdate; proof.card.remove(); delete window.__ledColdProof; }
    });
  }
}

await finish(browser);
