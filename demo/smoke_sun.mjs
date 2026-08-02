// Sun on the plan (docs/SUN.md): compass gating, window wedges on all four
// walls, direction follows north_deg, night is empty, wedges clip to rooms,
// day/night background vs static, per-space inheritance, cloud fading,
// memoisation across hass ticks, editors stay clean.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch({ width: 900, height: 900 }, 1);
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const upd = async () => { c.requestUpdate(); await c.updateComplete; };
  const setSun = async (azimuth, elevation) => {
    c.hass = { ...c.hass, states: { ...c.hass.states, 'sun.sun': {
      entity_id: 'sun.sun', state: elevation > 0 ? 'above_horizon' : 'below_horizon',
      attributes: { azimuth, elevation },
    } } };
    await upd();
  };
  const setWeather = async (state) => {
    c.hass = { ...c.hass, states: { ...c.hass.states, 'weather.home': {
      entity_id: 'weather.home', state, attributes: {},
    } } };
    await upd();
  };
  const cfg = () => c._serverCfg;
  const touchCfg = () => { c._cfgRev = (c._cfgRev || 0) + 1; };
  const litIds = () => (c._sunRaysCache?.rays || []).map((r) => r.openingId).sort();
  const domPolys = () => [...sr().querySelectorAll('.sunlayer polygon')];
  const stageStyle = () => sr().querySelector('.stage').getAttribute('style') || '';

  // ---- the test plan: windows on all four OUTER walls + one interior ----
  const sp = cfg().spaces.find((s) => s.id === 'f1');
  sp.openings = [
    { id: 'wN', type: 'window', x: 0.30, y: 0.14, angle: 0, length: 0.08 },  // top of r1
    { id: 'wE', type: 'window', x: 0.96, y: 0.60, angle: 90, length: 0.08 }, // right of r3
    { id: 'wS', type: 'window', x: 0.30, y: 0.86, angle: 0, length: 0.08 },  // bottom of r4
    { id: 'wW', type: 'window', x: 0.04, y: 0.30, angle: 90, length: 0.08 }, // left of r1
    { id: 'wI', type: 'window', x: 0.55, y: 0.30, angle: 90, length: 0.08 }, // r1|r2 wall
    { id: 'dS', type: 'door', x: 0.20, y: 0.86, angle: 0, length: 0.1 },     // doors never glow
  ];
  touchCfg();

  // 1) sun present + rays enabled, but NO north_deg anywhere → dead silence
  cfg().settings = { ...(cfg().settings || {}), sun_rays: true };
  touchCfg();
  await setSun(90, 5);
  out.silentWithoutNorth = domPolys().length === 0;
  out.noDaynightWithoutNorth = !sr().querySelector('.stage.daynight');

  // 2) compass set → morning east sun lights ONLY the east window
  cfg().settings.north_deg = 0;
  touchCfg();
  await setSun(90, 5);
  out.morningEast = JSON.stringify(litIds()) === '["wE"]';
  out.morningDomDrawn = domPolys().length > 0;

  // 3) noon south → only the south window, wedge shorter than the morning one
  const eastLen = c._sunRaysCache?.rays?.[0]?.len ?? 0;
  await setSun(180, 60);
  out.noonSouth = JSON.stringify(litIds()) === '["wS"]';
  out.noonShorter = (c._sunRaysCache?.rays?.[0]?.len ?? 1e9) < eastLen;

  // 4) evening west → only the west window; wedge stays inside its room r1
  await setSun(270, 4);
  out.eveningWest = JSON.stringify(litIds()) === '["wW"]';
  const ray = c._sunRaysCache?.rays?.[0] || { polys: [] };
  out.wedgeClippedToRoom = ray.polys.length > 0 && ray.polys.every((poly) => poly.every(([x, y]) =>
    x >= 40 - 0.5 && x <= 550 + 0.5 && y >= 140 - 0.5 && y <= 580 + 0.5));

  // 5) night → nothing
  await setSun(90, -10);
  out.nightEmpty = domPolys().length === 0;

  // 6) rotated compass: the same morning east sun now lights the NORTH window
  cfg().settings.north_deg = 90;
  touchCfg();
  await setSun(90, 5);
  out.rotatedCompass = JSON.stringify(litIds()) === '["wN"]';
  cfg().settings.north_deg = 0;
  touchCfg();

  // 7) memoisation: an unrelated hass tick must NOT recompute the wedges
  await setSun(90, 5);
  const cacheBefore = c._sunRaysCache;
  c.hass = { ...c.hass, states: { ...c.hass.states } }; // plain tick, sun unchanged
  await upd();
  out.memoSurvivesTick = c._sunRaysCache === cacheBefore;
  await setSun(91, 5);
  out.memoFollowsSun = c._sunRaysCache !== cacheBefore;

  // 8) day/night background: daynight breathes, static does not
  await setSun(180, 60);
  out.staticBgAtNoon = !stageStyle().includes('background:#5a6673');
  cfg().settings.bg_mode = 'daynight';
  touchCfg();
  await setSun(180, 60);
  out.daynightNoonBg = stageStyle().includes('background:#5a6673');
  out.daynightClass = !!sr().querySelector('.stage.daynight');
  await setSun(180, -20);
  out.daynightNightBg = stageStyle().includes('background:#070c14');
  out.nightPlanDimmed = (sr().querySelector('.zoomwrap').getAttribute('style') || '').includes('brightness(0.900');
  cfg().settings.bg_mode = 'static';
  touchCfg();
  await setSun(180, -20);
  out.staticNightKeepsTheme = !stageStyle().includes('background:#070c14');
  delete cfg().settings.bg_mode;
  touchCfg();

  // 9) per-space inheritance: the space override wins over the global flag
  sp.settings = { ...(sp.settings || {}), sun_rays: false };
  touchCfg();
  await setSun(90, 5);
  out.spaceOverridesOff = domPolys().length === 0;
  delete sp.settings.sun_rays;
  // and a per-space compass override redirects the light
  sp.settings.north_deg = 90;
  touchCfg();
  await setSun(90, 5);
  out.spaceNorthOverride = JSON.stringify(litIds()) === '["wN"]';
  delete sp.settings.north_deg;
  touchCfg();

  // 10) clouds: rain kills the wedges, cloudy only fades them
  cfg().settings.weather_entity = 'weather.home';
  touchCfg();
  await setWeather('pouring');
  await setSun(90, 5);
  out.rainKillsRays = domPolys().length === 0;
  await setWeather('cloudy');
  const stopCloudy = Number(sr().querySelector('.sunlayer ~ * stop, defs stop')?.getAttribute('stop-opacity')
    || sr().querySelector('stop')?.getAttribute('stop-opacity'));
  out.cloudyFades = domPolys().length > 0 && Math.abs(stopCloudy - 0.18 * 0.4) < 1e-6;
  await setWeather('sunny');
  const stopClear = Number(sr().querySelector('stop')?.getAttribute('stop-opacity'));
  out.clearFullAlpha = Math.abs(stopClear - 0.18) < 1e-6;
  delete cfg().settings.weather_entity;
  touchCfg();

  // 11) feature off: without the flag nothing is drawn even with sun+north
  delete cfg().settings.sun_rays;
  touchCfg();
  await setSun(90, 5);
  out.offDrawsNothing = domPolys().length === 0;
  cfg().settings.sun_rays = true;
  cfg().settings.bg_mode = 'daynight';
  touchCfg();

  // 12) editors stay clean: no wedges, no day/night canvas
  await setSun(90, 5);
  c._setMode('plan');
  await upd();
  out.editorNoRays = domPolys().length === 0;
  out.editorNoDaynight = !sr().querySelector('.stage.daynight');
  c._setMode('view');
  await upd();
  out.viewRaysBack = domPolys().length > 0;

  return out;
});

// 13) the general-settings dialog: a REAL drag on the compass dial sets degrees
await page.evaluate(async () => {
  const c = window.__card;
  c._openSettingsDialog();
  c.requestUpdate();
  await c.updateComplete;
  c.shadowRoot.querySelector('.compass').scrollIntoView({ block: 'center' });
});
const box = await page.evaluate(() => {
  const r = window.__card.shadowRoot.querySelector('.compass').getBoundingClientRect();
  return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
});
await page.mouse.move(box.cx + 45, box.cy); // on the ring, due right = 90°
await page.mouse.down();
await page.mouse.move(box.cx, box.cy + 45); // drag on to due down = 180°
await page.mouse.up();
const dlg = await page.evaluate(() => {
  const c = window.__card;
  const sr = c.shadowRoot;
  const out = {
    compassDragSets180: c._settingsDialog?.northDeg === 180,
    dialogHasModeSelect: !!sr.querySelector('.dialog select.areasel'),
    dialogHasRaysToggle: [...sr.querySelectorAll('.dialog .srcrow input[type=checkbox]')].length > 0,
    dialogHasWeatherList: sr.querySelectorAll('#hp-weather-list option').length > 0,
    dialogNumberMatches: sr.querySelector('.suncol input[type=number]')?.value === '180',
  };
  c._settingsDialog = null;
  return out;
});
Object.assign(res, dlg);
await finish(browser, checkAll(res));
