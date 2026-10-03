/**
 * #780 AC4/AC7/AC12/AC14/AC17 (ТЗ §3, §5, §7, §8, §13.1): the LED strip in
 * the View and on the static card. No LED chunk without a displayed active
 * strip (a hidden shape or an unbound strip loads nothing); an active bound
 * strip replaces the icon, paints the two-stroke stripe and — with Glow — the
 * linear field; off/unavailable have no field, unavailable is dashed; without
 * Glow the core takes the source colour. The whole length is one target: a
 * click toggles once, a touch pan calls nothing. A hidden marker or an
 * HA-disabled device loads no chunk (r1 M4); the value badge stays at the
 * anchor, passive (r1 M1). The static card is passive in all four
 * light_pools × live_states combinations (r1 M6).
 */
import { launch, check, finish } from './serve.mjs';
import { installHpTestOnPage } from './helpers/hp-test.mjs';

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
const onStripe = await stripe('d_light1');
check('on with Glow: white core and a field', JSON.stringify([onStripe?.state, onStripe?.core, onStripe?.dash, await field() > 0]),
  JSON.stringify(['on', '#FFFFFF', null, true]));

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
check('unavailable: dashed, no field', JSON.stringify([unavailable?.state, !!unavailable?.dash, await field()]),
  JSON.stringify(['unavailable', true, 0]));
await setState('light.ceiling', 'on', { rgb_color: [128, 213, 255] });
await setStrips(await evaluate(() => window.__card._serverCfg.spaces[0].led_strips), { glow_enabled: false });
await settle();
// The state update and the room setting update are deliberately separate. On
// a fast runner the first render can start the entering transition before the
// second one turns Glow off, so let that legitimate 500 ms leaving phase
// finish before asserting the stable no-Glow contract.
await page.waitForFunction(() => !window.__card.shadowRoot.querySelector('[data-led-field]'));
const colored = await stripe('d_light1');
check('on without Glow: coloured core, no field', JSON.stringify([colored?.state, colored?.core !== '#FFFFFF', await field()]),
  JSON.stringify(['on', true, 0]));

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
      state: g?.dataset.state, white: core?.getAttribute('stroke') === '#FFFFFF',
      field: !!sr.querySelector('[data-led-field]'),
      passive: !sr.querySelector('.led-hit, [data-led-strip] [role], [data-led-strip] [tabindex]'),
      badge: !!sr.querySelector('[data-led-badge="d_light1"] .value-badge'),
    };
  }
  host.remove();
  return out;
});
check('static live_states:false + light_pools:false — neutral, no field, passive', JSON.stringify(matrix['pools=false,live=false']),
  JSON.stringify({ state: 'off', white: true, field: false, passive: true, badge: true }));
check('static live_states:true + light_pools:false — source colour in the core, no field, passive', JSON.stringify(matrix['pools=false,live=true']),
  JSON.stringify({ state: 'on', white: false, field: false, passive: true, badge: true }));
check('static live_states:false + light_pools:true — neutral, no field, passive', JSON.stringify(matrix['pools=true,live=false']),
  JSON.stringify({ state: 'off', white: true, field: false, passive: true, badge: true }));
check('static live_states:true + light_pools:true — white core and the field, passive', JSON.stringify(matrix['pools=true,live=true']),
  JSON.stringify({ state: 'on', white: true, field: true, passive: true, badge: true }));
check('a click on any static stripe toggles nothing', await evaluate(() => window.__card.hass.states['light.ceiling'].state), 'on');

await evaluate(() => window.__hpTest.setMode('devices'));
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

await finish(browser);
