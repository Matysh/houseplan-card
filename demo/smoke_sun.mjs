// Sun on the plan (docs/SUN.md): compass gating, window wedges on all four
// walls, direction follows north_deg, night is empty, wedges clip to rooms,
// four-phase background vs static, per-space inheritance, weather independence,
// memoisation across hass ticks, editors stay clean.
import { launch, check, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch({ width: 900, height: 900 }, 1);
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const upd = async () => { c.requestUpdate(); await c.updateComplete; };
  const settleMode = async () => {
    const started = performance.now();
    while (c._modeTransitionBusy && performance.now() - started < 1800) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      await c.updateComplete;
    }
  };
  const setSun = async (azimuth, elevation) => {
    c.hass = { ...c.hass, states: { ...c.hass.states, 'sun.sun': {
      entity_id: 'sun.sun', state: elevation > 0 ? 'above_horizon' : 'below_horizon',
      attributes: { azimuth, elevation, rising: azimuth <= 180 },
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
  // DEV-B701-01: local mutations bump _cfgEpoch (what _saveConfig() does
  // synchronously). The old helper bumped _cfgRev — a server ack that the
  // production save path does NOT produce until the debounced write lands —
  // and thereby masked the stale sun-ray cache.
  const touchCfg = () => { c._cfgEpoch++; };
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

  // 1) sun present + rays enabled, but NO north_deg anywhere → no window rays
  cfg().settings = { ...(cfg().settings || {}), sun_rays: true };
  touchCfg();
  await setSun(90, 5);
  out.silentWithoutNorth = domPolys().length === 0;
  out.noBackgroundWhenStatic = !sr().querySelector('.stage.daycycle');

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

  // 8) four-phase background: daynight paints environment, static does not
  await setSun(180, 60);
  out.staticBgAtNoon = !stageStyle().includes('background:#ffffff');
  cfg().settings.bg_mode = 'daynight';
  touchCfg();
  await setSun(180, 60);
  out.daynightNoonBg = sr().querySelector('.hp-day-cycle-bg.active')?.dataset.dayCycleLayer === 'day';
  out.daynightClass = !!sr().querySelector('.stage.daycycle');
  await setSun(180, -20);
  out.daynightNightBg = sr().querySelector('.hp-day-cycle-bg.active')?.dataset.dayCycleLayer === 'night';
  out.nightPlanUnchanged = !(sr().querySelector('.zoomwrap').getAttribute('style') || '').includes('brightness(0.');
  cfg().settings.bg_mode = 'static';
  touchCfg();
  await setSun(180, -20);
  out.staticNightKeepsTheme = !sr().querySelector('.hp-day-cycle-env');
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

  // 10) legacy weather settings and live weather states no longer participate
  cfg().settings.weather_entity = 'weather.home';
  touchCfg();
  await setWeather('pouring');
  await setSun(90, 5);
  const stopRain = Number(sr().querySelector('stop')?.getAttribute('stop-opacity'));
  out.rainDoesNotHideRays = domPolys().length > 0 && Math.abs(stopRain - 0.3) < 1e-6;
  await setWeather('cloudy');
  const stopCloudy = Number(sr().querySelector('stop')?.getAttribute('stop-opacity'));
  out.cloudsDoNotDimRays = domPolys().length > 0 && Math.abs(stopCloudy - 0.3) < 1e-6;
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

  // 12) editors stay clean: no wedges, no day-cycle environment
  await setSun(90, 5);
  c._setMode('plan');
  await upd();
  await settleMode();
  out.editorNoRays = domPolys().length === 0;
  out.editorNoDaynight = !sr().querySelector('.stage.daycycle');
  c._setMode('view');
  await upd();
  await settleMode();
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
    dialogHasModeSelect: !!sr.querySelector('hp-dialog select.areasel'),
    dialogHasRaysToggle: [...sr.querySelectorAll('hp-dialog .srcrow input[type=checkbox]')].length > 0,
    dialogHasNoWeatherList: sr.querySelectorAll('#hp-weather-list option').length === 0,
    dialogNumberMatches: sr.querySelector('.suncol input[type=number]')?.value === '180',
  };
  c._settingsDialog = null;
  return out;
});
Object.assign(res, dlg);

// 14) DEV-B701-01 regression: the PRODUCTION local-save path (no touchCfg, no
// fake rev/epoch bump from the test) must move the wedge. A REAL pointer drag
// of the east window ends in _opPointerUp -> _saveConfig(); the WS write is
// debounced 500 ms, so at check time _cfgRev is still the boot revision — the
// ray must follow the window anyway, and again after the late server ack.
const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const screenPt = (x, y) => page.evaluate(([x, y]) => {
  const c = window.__card;
  const stage = c.renderRoot.querySelector('.stage');
  const r = stage.getBoundingClientRect();
  const svgEl = stage.querySelector('svg');
  const [vx, vy, vw, vh] = svgEl.getAttribute('viewBox').split(' ').map(Number);
  return [r.left + ((x - vx) / vw) * r.width, r.top + ((y - vy) / vh) * r.height];
}, [x, y]);
const rayInfo = () => page.evaluate(() => {
  const c = window.__card;
  const rays = c._sunRaysCache?.rays || [];
  const r = rays.find((q) => q.openingId === 'wE');
  return {
    ids: rays.map((q) => q.openingId).sort(),
    midY: r ? (r.a[1] + r.b[1]) / 2 : NaN,
    minX: r ? Math.min(...r.polys.flat().map((p) => p[0])) : NaN,
    rev: c._cfgRev,
    wEy: c._serverCfg.spaces.find((s) => s.id === 'f1').openings.find((o) => o.id === 'wE').y,
  };
});

// baseline: morning east sun, only wE glows, window sits at y = 600
await page.evaluate(async () => {
  const c = window.__card;
  c.hass = { ...c.hass, states: { ...c.hass.states, 'sun.sun': {
    entity_id: 'sun.sun', state: 'above_horizon', attributes: { azimuth: 90, elevation: 5 },
  } } };
  c.requestUpdate(); await c.updateComplete;
});
const base = await rayInfo();
check('b701_baseline_east_only', base.ids, ['wE']);
check('b701_baseline_mid_600', Math.abs(base.midY - 600) < 1, true);

// the real drag: enter the opening editor and pull wE down the east wall
await page.evaluate(async () => {
  const c = window.__card;
  c._setMode('plan'); c._tool = 'opening';
  c.requestUpdate(); await c.updateComplete;
});
await page.waitForTimeout(220); // stage coordinates settle with editor chrome
await settle();
const [dx, dy] = await screenPt(960, 600);
const [, dty] = await screenPt(960, 700);
await page.mouse.move(dx, dy);
await page.mouse.down();
await page.mouse.move(dx, dty, { steps: 6 });
await page.mouse.up();
await settle();

// leave the editor IMMEDIATELY — well inside the 500 ms debounce window
const after = await page.evaluate(async () => {
  const c = window.__card;
  c._setMode('view');
  c.requestUpdate(); await c.updateComplete;
  return true;
});
check('b701_left_editor', after);
const moved = await rayInfo();
check('b701_window_really_moved', Math.abs(moved.wEy * 1000 - 700) < 15, true);
check('b701_rev_still_boot', moved.rev, base.rev); // the write has NOT landed yet
check('b701_ray_follows_window', Math.abs(moved.midY - moved.wEy * 1000) < 1, true);
check('b701_ray_not_stale', Math.abs(moved.midY - 600) > 50, true);

// same defect class for ROOM geometry: r3 shrinks to a thin strip along its
// east wall through the real mutation endpoint (_saveConfig, still no ack).
// The wedge reaches ~188 units into the room (minX ~772), so the new west
// boundary at x = 900 MUST cut it — a stale clip keeps points near x = 772.
const clipped = await page.evaluate(async () => {
  const c = window.__card;
  const sp = c._serverCfg.spaces.find((s) => s.id === 'f1');
  sp.rooms.find((r) => r.id === 'r3').poly = [[0.90, 0.46], [0.96, 0.46], [0.96, 0.86], [0.90, 0.86]];
  c._saveConfig(); // the one true local-save entry point
  c.requestUpdate(); await c.updateComplete;
  return true;
});
check('b701_room_mutated', clipped);
const reclipped = await rayInfo();
check('b701_room_rev_still_boot', reclipped.rev, base.rev);
check('b701_room_reclips_ray', reclipped.minX >= 900 - 1, true);

// let the debounced write land: the ray must survive the late server ack
await page.waitForTimeout(800);
const acked = await page.evaluate(async () => {
  const c = window.__card;
  c.requestUpdate(); await c.updateComplete;
  return true;
});
check('b701_acked', acked);
const final = await rayInfo();
check('b701_write_landed', final.rev !== base.rev, true);
check('b701_ray_survives_ack', Math.abs(final.midY - final.wEy * 1000) < 1, true);

// 15) the 3° threshold + the 2 s dissolve (owner 2026-08-03). Runs LAST and in
// its own evaluate: it deliberately waits out a two-second fade, and the b701
// regression above measures a debounced config write against wall-clock time.
const thr = await page.evaluate(async () => {
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
  const domPolys = () => [...sr().querySelectorAll('.sunlayer polygon')];
  const layer = () => sr().querySelector('.sunlayer');
  const stopAlpha = () => Number(sr().querySelector('stop')?.getAttribute('stop-opacity'));

  // the old build ramped the alpha in over the first ~2°; now the layer is
  // either absent or at FULL strength, and crossing 3° fades the whole LAYER
  // (never the geometry) in or out over exactly two seconds
  await setSun(90, 10);
  out.aboveThresholdDrawn = domPolys().length > 0 && !layer().classList.contains('out');
  {
    const cs = getComputedStyle(layer());
    out.fadeInTakesTwoSeconds = cs.animationName === 'hp-sunfade-in' && cs.animationDuration === '2s';
  }
  out.fullAlphaWellAboveThreshold = Math.abs(stopAlpha() - 0.3) < 1e-6;
  await setSun(90, 3.2);
  out.fullAlphaJustAboveThreshold = Math.abs(stopAlpha() - 0.3) < 1e-6;

  // below 3°: the layer stays for exactly the dissolve, then leaves the DOM
  await setSun(90, 2);
  {
    const dying = layer();
    const cs = dying && getComputedStyle(dying);
    out.belowThresholdDissolves = !!dying && dying.classList.contains('out')
      && cs.animationName === 'hp-sunfade-out' && cs.animationDuration === '2s';
  }
  await new Promise((r) => setTimeout(r, 2300));
  await upd();
  out.belowThresholdGoneAfterFade = !layer() && domPolys().length === 0;

  // a sun that never crossed the threshold draws nothing at all — no ghost
  await setSun(90, 1);
  out.coldStartBelowThresholdEmpty = domPolys().length === 0 && !layer();
  await setSun(90, 5);
  out.backAboveThreshold = domPolys().length > 0 && !layer().classList.contains('out');
  return out;
});
Object.assign(res, thr);

await finish(browser, checkAll(res));
