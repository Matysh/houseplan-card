// Three stills of the daynight scale (noon/sunset/night) for the white-day review.
import { launch } from './serve.mjs';
const outDir = process.argv[2] || '/tmp';
const { page, browser } = await launch({ width: 700, height: 700 }, 1);
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.evaluate(async () => {
  const c = window.__card;
  const sp = c._serverCfg.spaces.find((s) => s.id === 'f1');
  sp.openings = [
    { id: 'wN', type: 'window', x: 0.30, y: 0.14, angle: 0, length: 0.08 },
    { id: 'wE', type: 'window', x: 0.96, y: 0.60, angle: 90, length: 0.08 },
    { id: 'wW', type: 'window', x: 0.04, y: 0.30, angle: 90, length: 0.08 },
  ];
  sp.plan_url = ''; // hand-drawn plan: white paper — the risky case for a white day
  sp.settings = { ...(sp.settings || {}), show_borders: true, fill_mode: 'glow' };
  c._serverCfg.settings = { ...(c._serverCfg.settings || {}), north_deg: 0, sun_rays: true, bg_mode: 'daynight' };
  c._cfgRev = (c._cfgRev || 0) + 1;
});
const shot = async (az, el, name) => {
  await page.evaluate(async ([az, el]) => {
    const c = window.__card;
    c.hass = { ...c.hass, states: { ...c.hass.states, 'sun.sun': {
      entity_id: 'sun.sun', state: el > 0 ? 'above_horizon' : 'below_horizon',
      attributes: { azimuth: az, elevation: el },
    } } };
    c.requestUpdate(); await c.updateComplete;
  }, [az, el]);
  await page.waitForTimeout(300);
  const stage = await page.evaluateHandle(() => window.__card.shadowRoot.querySelector('.stage'));
  await stage.asElement().screenshot({ path: `${outDir}/${name}.png` });
};
await shot(180, 60, 'dn_noon');
await shot(265, 3, 'dn_sunset');
await shot(0, -20, 'dn_night');
await browser.close();
console.log('shots done');
