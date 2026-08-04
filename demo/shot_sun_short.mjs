// Stills for the 2026-08-04 ray report: 30 % shorter shafts with SHARP sides
// that dissolve only along the ray (docs/SUN.md). The low-sun frame is the
// interesting one — the north and south windows get a nearly wall-grazing sun,
// the case that used to hang a bright kerb across the floor. Usage:
//   node demo/shot_sun_short.mjs <outdir> <prefix>
import { launch } from './serve.mjs';
const outDir = process.argv[2] || '/tmp';
const tag = process.argv[3] || 'sun_rays_short';
const { page, browser } = await launch({ width: 900, height: 860 }, 2);
await page.emulateMedia({ reducedMotion: 'reduce' }); // still shots, no 45 s sky glide

const setup = async (az, el) => {
  await page.evaluate(async ([azimuth, elevation]) => {
    const c = window.__card;
    const sp = c._serverCfg.spaces.find((s) => s.id === 'f1');
    sp.openings = [
      { id: 'wN', type: 'window', x: 0.30, y: 0.14, angle: 0, length: 0.08 },
      { id: 'wE', type: 'window', x: 0.96, y: 0.60, angle: 90, length: 0.08 },
      { id: 'wS', type: 'window', x: 0.30, y: 0.86, angle: 0, length: 0.08 },
      { id: 'wW', type: 'window', x: 0.04, y: 0.30, angle: 90, length: 0.08 },
      { id: 'wW2', type: 'window', x: 0.04, y: 0.72, angle: 90, length: 0.08 },
    ];
    sp.settings = { ...(sp.settings || {}), show_borders: true, fill_mode: 'glow' };
    c._serverCfg.settings = { ...(c._serverCfg.settings || {}),
      north_deg: 0, sun_rays: true, bg_mode: 'daynight' };
    c._cfgEpoch = (c._cfgEpoch || 0) + 1;
    c.hass = { ...c.hass, states: { ...c.hass.states,
      'light.ceiling': { ...c.hass.states['light.ceiling'], state: 'off' },
      'sun.sun': { entity_id: 'sun.sun', state: 'above_horizon',
        attributes: { azimuth, elevation } } } };
    c.requestUpdate();
    await c.updateComplete;
  }, [az, el]);
  await page.waitForTimeout(350);
};

// low sun in the west — the long shafts, the case that hit the far walls
await setup(265, 5);
let stage = await page.evaluateHandle(() => window.__card.shadowRoot.querySelector('.stage'));
await stage.asElement().screenshot({ path: `${outDir}/${tag}_low.png` });

// high southern sun — the short noon pools
await setup(180, 55);
stage = await page.evaluateHandle(() => window.__card.shadowRoot.querySelector('.stage'));
await stage.asElement().screenshot({ path: `${outDir}/${tag}_high.png` });

await browser.close();
console.log('shots written to ' + outDir);
