// Screenshots for docs/SUN.md: evening wedges over the glow fill + the compass
// dial in the general settings. Usage: node demo/shot_sun.mjs <outdir>
import { launch } from './serve.mjs';
const outDir = process.argv[2] || '/tmp';
const { page, browser } = await launch({ width: 900, height: 860 }, 2);
// instant colors for the still shot: the day/night transition is tens of seconds
await page.emulateMedia({ reducedMotion: 'reduce' });

await page.evaluate(async () => {
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
  c._serverCfg.settings = {
    ...(c._serverCfg.settings || {}),
    north_deg: 0, sun_rays: true, bg_mode: 'daynight',
  };
  c._cfgRev = (c._cfgRev || 0) + 1;
  // a warm evening: the sun low in the west; the living-room light off so
  // the glow pool does not swamp the west wedge
  c.hass = { ...c.hass, states: { ...c.hass.states,
    'light.ceiling': { ...c.hass.states['light.ceiling'], state: 'off' },
    'sun.sun': {
      entity_id: 'sun.sun', state: 'above_horizon', attributes: { azimuth: 265, elevation: 3 },
    },
  } };
  c.requestUpdate();
  await c.updateComplete;
});
await page.waitForTimeout(400);
const stage = await page.evaluateHandle(() => window.__card.shadowRoot.querySelector('.stage'));
await stage.asElement().screenshot({ path: outDir + '/sun_rays.png' });

await page.evaluate(async () => {
  const c = window.__card;
  c._openSettingsDialog();
  c._settingsDialog = { ...c._settingsDialog, northDeg: 330 };
  c.requestUpdate();
  await c.updateComplete;
  c.shadowRoot.querySelector('.compass').scrollIntoView({ block: 'center' });
});
await page.waitForTimeout(200);
const dlg = await page.evaluateHandle(() => window.__card.shadowRoot.querySelector('.dialog'));
await dlg.asElement().screenshot({ path: outDir + '/sun_compass.png' });
await browser.close();
console.log('shots written to ' + outDir);
