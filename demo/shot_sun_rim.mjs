// Stills for the rim (docs/SUN.md, «The rim»). Two scenes — white paper and
// the dark glow canvas — and, in each, the SAME frame at several rim peaks so
// the value can be picked by looking rather than by arguing. The alphas other
// than the shipped one are applied by rewriting the `hp-sunrim-*` stops in the
// DOM, which is why a rebuild is not needed to compare them.
//   node demo/shot_sun_rim.mjs <outdir> [alphas, default 0,0.3,0.42,0.5]
// `0` is the "before" frame: the wedge alone, with no rim at all.
import { launch } from './serve.mjs';
const outDir = process.argv[2] || '/tmp';
const ALPHAS = (process.argv[3] || '0,0.3,0.42,0.5').split(',').map(Number);
const { page, browser } = await launch({ width: 900, height: 900 }, 2);
await page.emulateMedia({ reducedMotion: 'reduce' }); // still shots, no fades

const setup = async (scene) => {
  await page.evaluate(async (sc) => {
    const c = window.__card;
    const cfg = c._serverCfg;
    const sp = cfg.spaces.find((s) => s.id === 'f1');
    sp.openings = [
      { id: 'wN', type: 'window', x: 0.30, y: 0.14, angle: 0, length: 0.08 },
      { id: 'wW', type: 'window', x: 0.04, y: 0.30, angle: 90, length: 0.08 },
      { id: 'wW2', type: 'window', x: 0.04, y: 0.72, angle: 90, length: 0.08 },
      { id: 'wE', type: 'window', x: 0.96, y: 0.60, angle: 90, length: 0.08 },
    ];
    sp.plan_url = null;             // plain paper, nothing to hide behind
    sp.settings = { ...(sp.settings || {}), fill_mode: sc === 'dark' ? 'glow' : 'none' };
    cfg.settings = { ...(cfg.settings || {}), north_deg: 0, sun_rays: true,
      bg_mode: 'static', bg_color: sc === 'dark' ? '#101720' : '#f2f2f0' };
    c._cfgEpoch++;
    c.hass = { ...c.hass, states: { ...c.hass.states,
      'light.ceiling': { ...c.hass.states['light.ceiling'], state: sc === 'dark' ? 'on' : 'off' },
      'sun.sun': { entity_id: 'sun.sun', state: 'above_horizon',
        attributes: { azimuth: 250, elevation: 35 } } } };
    c.requestUpdate();
    await c.updateComplete;
  }, scene);
  await page.waitForTimeout(300);
};

// Rescale every rim gradient to `peak`, always from the stops as BUILT — a
// scale relative to the current values would collapse to zero the moment the
// 0 frame is taken and never come back.
const setAlpha = async (peak) => {
  await page.evaluate((a) => {
    for (const g of window.__card.shadowRoot.querySelectorAll('linearGradient[id^=hp-sunrim-]')) {
      const stops = [...g.querySelectorAll('stop')];
      if (!g.__base) g.__base = stops.map((s) => Number(s.getAttribute('stop-opacity')));
      const p0 = g.__base[0] || 1;
      stops.forEach((s, i) => s.setAttribute('stop-opacity', (a * (g.__base[i] / p0)).toFixed(4)));
    }
  }, peak);
  await page.waitForTimeout(120);
};

for (const scene of ['light', 'dark']) {
  await setup(scene);
  for (const a of ALPHAS) {
    await setAlpha(a);
    const stage = await page.evaluateHandle(() => window.__card.shadowRoot.querySelector('.stage'));
    await stage.asElement().screenshot({ path: `${outDir}/rim_${scene}_${String(a).replace('.', '')}.png` });
  }
}
await browser.close();
console.log('shots written to ' + outDir);
