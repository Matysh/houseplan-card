// Brightness check for the wedges (owner 2026-08-03: «поярче, иногда плохо
// видны»). Two hardest cases side by side: a DAYLIGHT sun on white paper (the
// wedge colour is nearly neutral there) and a low sun over the dark glow
// canvas. Usage: node demo/shot_sun_bright.mjs <outdir> [suffix]
import { launch } from './serve.mjs';
const outDir = process.argv[2] || '/tmp';
const tag = process.argv[3] ? '_' + process.argv[3] : '';
const { page, browser } = await launch({ width: 900, height: 860 }, 2);
// the fade is a 2 s animation; reduced motion pins the layer at full opacity
await page.emulateMedia({ reducedMotion: 'reduce' });

const setup = (fill, azimuth, elevation, ceiling) => page.evaluate(async ([fill, azimuth, elevation, ceiling]) => {
  const c = window.__card;
  const sp = c._serverCfg.spaces.find((s) => s.id === 'f1');
  sp.openings = [
    { id: 'wN', type: 'window', x: 0.30, y: 0.14, angle: 0, length: 0.08 },
    { id: 'wE', type: 'window', x: 0.96, y: 0.60, angle: 90, length: 0.08 },
    { id: 'wS', type: 'window', x: 0.30, y: 0.86, angle: 0, length: 0.08 },
    { id: 'wW', type: 'window', x: 0.04, y: 0.30, angle: 90, length: 0.08 },
    { id: 'wW2', type: 'window', x: 0.04, y: 0.72, angle: 90, length: 0.08 },
  ];
  sp.settings = { ...(sp.settings || {}), show_borders: true, fill_mode: fill };
  c._serverCfg.settings = { ...(c._serverCfg.settings || {}),
    north_deg: 0, sun_rays: true, bg_mode: 'daynight' };
  c._cfgEpoch++;
  c.hass = { ...c.hass, states: { ...c.hass.states,
    'light.ceiling': { ...c.hass.states['light.ceiling'], state: ceiling },
    'sun.sun': { entity_id: 'sun.sun', state: 'above_horizon', attributes: { azimuth, elevation } } } };
  c.requestUpdate();
  await c.updateComplete;
}, [fill, azimuth, elevation, ceiling]);

const shoot = async (name) => {
  await page.waitForTimeout(400);
  const stage = await page.evaluateHandle(() => window.__card.shadowRoot.querySelector('.stage'));
  await stage.asElement().screenshot({ path: `${outDir}/${name}${tag}.png` });
};

// 1) plain daylight on white paper: neutral wedge colour, brightest canvas
await setup('none', 265, 24, 'off');
await shoot('sun_bright_paper');
// 2) a low warm sun over the dark glow canvas
await setup('glow', 265, 4, 'off');
await shoot('sun_bright_glow');
await browser.close();
console.log('shots written to ' + outDir);
