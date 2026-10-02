/**
 * #780 AC4/AC7/AC12/AC14/AC17 (ТЗ §3, §5, §7, §8, §13.1): the LED strip in
 * the View and on the static card. No LED chunk without a displayed active
 * strip (a hidden shape or an unbound strip loads nothing); an active bound
 * strip replaces the icon, paints the two-stroke stripe and — with Glow — the
 * linear field; off/unavailable have no field, unavailable is dashed; without
 * Glow the core takes the source colour. The whole length is one target: a
 * click toggles once, a touch pan calls nothing. The static card is passive
 * and computes no field with `light_pools: false`.
 */
import { launch, check, finish } from './serve.mjs';
import { installHpTestOnPage } from './helpers/hp-test.mjs';

const { page, browser } = await launch({ width: 1000, height: 820 }, 1);
const ledRequests = [];
page.on('request', (request) => { if (/led-strip-(runtime|field|editor)-/.test(request.url())) ledRequests.push(request.url().replace(/.*\//, '')); });
const evaluate = (fn, arg) => page.evaluate(fn, arg);
const settle = () => page.waitForTimeout(500);
const setStrips = (strips, settings) => evaluate(async ([strips, settings]) => {
  await window.__hpTest.setServerConfig((cfg) => {
    cfg.spaces[0].led_strips = strips;
    cfg.spaces[0].settings = { ...(cfg.spaces[0].settings || {}), ...settings };
    cfg.markers = [
      ...(cfg.markers || []).filter((m) => !['d_light1', 'd_lamp'].includes(m.id)),
      { id: 'd_light1', binding: 'device:d_light1', space: 'f1' },
      { id: 'd_lamp', binding: 'device:d_lamp', space: 'f1' },
    ];
  });
}, [strips, settings]);
const setState = (entity, state, attributes = {}) => evaluate(async ([entity, state, attributes]) => {
  const c = window.__card; const st = c.hass.states[entity];
  c.hass = { ...c.hass, states: { ...c.hass.states, [entity]: { ...st, state, attributes: { ...st.attributes, ...attributes } } } };
  await c.updateComplete;
}, [entity, state, attributes]);
const stripe = (marker) => evaluate((marker) => {
  const g = window.__card.shadowRoot.querySelector(`[data-led-strip][data-marker="${marker}"]`);
  return g ? { state: g.dataset.state, core: g.querySelector('.led-core')?.getAttribute('stroke'),
    dash: g.querySelector('.led-core')?.getAttribute('stroke-dasharray') || null } : null;
}, marker);
const field = () => evaluate(() => window.__card.shadowRoot.querySelectorAll('[data-led-field]').length);

await settle();
check('no strips: no LED chunk requested', ledRequests.length, 0);
await setStrips([{ id: 'hidden', points: [[0.12, 0.40], [0.40, 0.40]], marker: 'd_lamp', active: false },
  { id: 'loose', points: [[0.12, 0.45], [0.40, 0.45]], marker: null }], { glow_enabled: true });
await settle();
check('hidden shape and unbound strip: still no LED chunk', ledRequests.length, 0);
check('a hidden shape leaves the ordinary icon', await evaluate(() => !!window.__card.shadowRoot.querySelector('.dev[data-id="d_lamp"]')));

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
check('on with Glow: white core and a field', JSON.stringify([await stripe('d_light1'), await field() > 0]),
  JSON.stringify([{ state: 'on', core: '#FFFFFF', dash: null }, true]));

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
await settle();
check('a click on the stripe toggles once', await evaluate(() => window.__ledToggle.length), calls + 1);
void hit;
check('off: no field, white core', JSON.stringify([await stripe('d_light1'), await field()]),
  JSON.stringify([{ state: 'off', core: '#FFFFFF', dash: null }, 0]));
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
await settle();
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
const colored = await stripe('d_light1');
check('on without Glow: coloured core, no field', JSON.stringify([colored?.state, colored?.core !== '#FFFFFF', await field()]),
  JSON.stringify(['on', true, 0]));

// The static card: passive; the field only with light_pools.
await setStrips(await evaluate(() => window.__card._serverCfg.spaces[0].led_strips), { glow_enabled: true });
const staticCards = await evaluate(async () => {
  await customElements.whenDefined('houseplan-space-card');
  const host = document.createElement('div'); host.style.width = '700px'; document.body.appendChild(host);
  const make = (pools) => { const el = document.createElement('houseplan-space-card'); el.setConfig({ type: 'custom:houseplan-space-card', space: 'f1', light_pools: pools }); el.hass = window.__card.hass; host.appendChild(el); return el; };
  const plain = make(false), pools = make(true);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 40; i++) {
    await wait(50);
    if (plain.shadowRoot?.querySelector('[data-led-strip]') && pools.shadowRoot?.querySelector('[data-led-field]')) break;
  }
  const read = (el) => ({ stripe: !!el.shadowRoot?.querySelector('[data-led-strip]'),
    field: !!el.shadowRoot?.querySelector('[data-led-field]'), hit: !!el.shadowRoot?.querySelector('.led-hit') });
  return { plain: read(plain), pools: read(pools) };
});
check('static card without light_pools: passive stripe, no field', JSON.stringify(staticCards.plain), JSON.stringify({ stripe: true, field: false, hit: false }));
check('static card with light_pools: the field', JSON.stringify(staticCards.pools), JSON.stringify({ stripe: true, field: true, hit: false }));

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
