// #718 AC1–AC6: the moon with any background, in the production bundle. With
// a static background there is no environment: the moon stands in its own
// layer `.hp-moon-sky`, the first child of the scene, under the plan by DOM
// order. The home is Moscow through `hass.config`; the clock is Playwright's
// (`page.clock`), the time zone the context's (`timezoneId`).
//
// Moscow 2026-10-21 18:00Z: the moon at 23.9°, 79 % lit; 2026-10-03 07:59Z:
// 31.5°, 53 %. AC1 and AC3 are the witnesses: red on the #661 code, where a
// static background leaves no moon at all.
import { launch, checkAll, finish } from './serve.mjs';

const MOSCOW = { latitude: 55.75, longitude: 37.62 };
const NIGHT_SUN = { azimuth: 0, elevation: -12, rising: false };
const DAY_SUN = { azimuth: 180, elevation: 40, rising: false };
const checks = {};
const report = {};
const isMoonAsset = (url) => /\/moon-runtime-[^/?]*\.js(?:\?|$)/.test(url);

async function open(contextOptions = {}) {
  const run = await launch({ width: 1000, height: 760 }, 1, [], contextOptions);
  run.moonRequests = [];
  run.page.on('request', (request) => { if (isMoonAsset(request.url())) run.moonRequests.push(request.url()); });
  return run;
}

/** A state update, as Home Assistant pushes one; `sun: null` removes `sun.sun`. */
const pushHass = (page, { config, sun } = {}) => page.evaluate(async ({ config, sun }) => {
  const card = window.__card;
  const states = { ...card.hass.states };
  if (sun === null) delete states['sun.sun'];
  else if (sun) {
    states['sun.sun'] = {
      entity_id: 'sun.sun', state: sun.elevation > 0 ? 'above_horizon' : 'below_horizon', attributes: sun,
    };
  }
  card.hass = {
    ...card.hass,
    ...(config ? { config: { ...(card.hass.config || {}), ...config } } : {}),
    states,
  };
  await card.updateComplete;
}, { config, sun });

/**
 * Another client's save: global settings merged (`null` removes a key), every
 * space's own `bg_mode` dropped, then `spaces[id]` applied to that space.
 */
const setConfig = (page, settings, spaces = {}) => page.evaluate(({ settings, spaces }) => (
  window.__hpTest.setServerConfig((cfg) => {
    cfg.settings = { ...(cfg.settings || {}), ...settings };
    for (const [key, value] of Object.entries(settings)) if (value === null) delete cfg.settings[key];
    for (const space of cfg.spaces) {
      space.settings = { ...(space.settings || {}) };
      delete space.settings.bg_mode;
      Object.assign(space.settings, spaces[space.id] || {});
    }
    return cfg;
  })), { settings, spaces });

const moonState = (page) => page.evaluate(() => {
  const root = window.__card.renderRoot;
  const stage = root.querySelector('.stage');
  const moons = root.querySelectorAll('.hp-moon');
  const moon = moons[0] || null;
  const style = moon ? getComputedStyle(moon) : null;
  const box = moon?.getBoundingClientRect();
  return {
    count: moons.length,
    on: !!moon?.classList.contains('on'),
    opacity: style ? Number(style.opacity) : null,
    k: moon?.dataset.moonK ?? null,
    parent: moon?.parentElement?.className ?? null,
    parentIsFirstChild: !!moon && moon.parentElement === stage.firstElementChild,
    sky: root.querySelectorAll('.hp-moon-sky').length,
    env: !!root.querySelector('.hp-day-cycle-env'),
    outline: !!root.querySelector('.hp-paper-outline-svg'),
    stageClasses: [...stage.classList].filter((name) => name === 'daycycle' || name.startsWith('phase-')),
    stageBg: getComputedStyle(stage).backgroundColor,
    box: box ? [box.left, box.top, box.width, box.height] : null,
    running: moon ? moon.getAnimations()
      .filter((animation) => animation instanceof CSSTransition && animation.playState === 'running').length : 0,
    pointerEvents: style?.pointerEvents ?? null,
  };
});
const settle = (page) => page.evaluate(async () => {
  await window.__card.updateComplete;
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
});
/** Soft wait: a missing moon is a named red check, not an aborted run. */
const until = (page, predicate, arg, timeout = 8000) => page.waitForFunction(predicate, arg, { timeout })
  .then(() => true, () => false);
const moonOn = () => !!window.__card.renderRoot.querySelector('.hp-moon.on');
const sameBox = (a, b) => !!a && !!b && a.every((value, index) => Math.abs(value - b[index]) <= 1);

// ─── Part A: full card, `sun.sun` from Home Assistant (AC1, AC2, AC4, AC5) ───
{
  const { page, browser, moonRequests } = await open();
  await page.clock.setFixedTime(new Date('2026-10-21T18:00:00Z'));
  await pushHass(page, { config: MOSCOW, sun: NIGHT_SUN });
  await setConfig(page, { bg_mode: 'static', moon: null });
  await settle(page);
  await page.waitForTimeout(400);
  const moonOff = await moonState(page);
  // AC2: night with the moon switched off asks for nothing.
  checks.ac2_nightMoonOffNoChunk = moonOff.count === 0 && moonRequests.length === 0;

  // AC2: switched on by day — no moon and still no request.
  await pushHass(page, { sun: DAY_SUN });
  await setConfig(page, { bg_mode: 'static', moon: true });
  await settle(page);
  await page.waitForTimeout(400);
  const day = await moonState(page);
  checks.ac2_dayNoMoonNoChunk = !day.on && moonRequests.length === 0;

  // AC2: the state update at night brings the moon.
  await pushHass(page, { sun: NIGHT_SUN });
  checks.ac2_nightPushShowsTheMoon = await until(page, moonOn);
  const first = await moonState(page);
  report.ac1 = { moonOff, first, requests: moonRequests.length };

  // AC1 (witness): one moon in its own layer, the first child of the scene.
  checks.ac1_oneMoonOnAtFullOpacity = first.count === 1 && first.on && first.opacity === 1;
  checks.ac1_parentIsTheSkyLayer = first.sky === 1 && first.parent === 'hp-moon-sky' && first.parentIsFirstChild;
  checks.ac1_noEnvironment = !first.env && !first.outline && first.stageClasses.length === 0;
  checks.ac1_backgroundUnchanged = first.stageBg === moonOff.stageBg;
  checks.ac1_moonIgnoresThePointer = first.pointerEvents === 'none';

  // AC1: the #661 probe along the disc's diameter — under the plan the moon
  // changes no pixel, in the open it does.
  const probe = await page.evaluate(() => {
    const root = window.__card.renderRoot;
    const moon = root.querySelector('.hp-moon');
    if (!moon) return { covered: null, open: null, cy: 0 };
    const box = moon.getBoundingClientRect();
    const cy = Math.round(box.top + box.height / 2);
    const disc = box.width * 0.47;
    let covered = null;
    let open = null;
    for (let x = box.left + box.width / 2 - disc * 0.9; x <= box.left + box.width / 2 + disc * 0.9; x += 2) {
      const hit = root.elementFromPoint(x, cy);
      const svg = hit?.closest('svg.plan-svg');
      if (svg && hit !== svg) covered ??= Math.round(x);
      else if (!svg || hit === svg) open ??= Math.round(x);
    }
    return { covered, open, cy };
  });
  const pixel = async (x, y) => (await page.screenshot({ clip: { x, y, width: 1, height: 1 } })).toString('base64');
  const pixels = async () => ({
    covered: probe.covered === null ? null : await pixel(probe.covered, probe.cy),
    open: probe.open === null ? null : await pixel(probe.open, probe.cy),
  });
  const shown = await pixels();
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.id = 'hp-moon-probe';
    style.textContent = '.hp-moon{visibility:hidden!important}';
    window.__card.renderRoot.appendChild(style);
  });
  const hidden = await pixels();
  await page.evaluate(() => window.__card.renderRoot.querySelector('#hp-moon-probe')?.remove());
  report.ac1.probe = probe;
  checks.ac1_planCoversPartOfTheDisc = probe.covered !== null && probe.open !== null;
  checks.ac1_noPixelChangesUnderThePlan = shown.covered !== null && shown.covered === hidden.covered;
  checks.ac1_moonPaintedWhereThePlanIsNot = shown.open !== null && shown.open !== hidden.open;

  // AC2: daytime again — the moon fades out over 2 s.
  await pushHass(page, { sun: DAY_SUN });
  await page.waitForTimeout(250);
  const fading = await moonState(page);
  await page.waitForTimeout(2050);
  const gone = await moonState(page);
  report.ac2 = { day, fading, gone };
  checks.ac2_dayFades = fading.count === 1 && !fading.on && fading.opacity > 0 && fading.opacity < 1;
  checks.ac2_dayFadesToZero = gone.count === 1 && gone.opacity === 0;

  // AC4: global "Follow the Sun", the garden has its own static background.
  await pushHass(page, { sun: NIGHT_SUN });
  await setConfig(page, { bg_mode: 'daynight', moon: true }, { garden: { bg_mode: 'static' } });
  await page.evaluate(() => window.__hpTest.switchSpace('f1'));
  await until(page, moonOn);
  await page.waitForTimeout(2200);
  const inEnv = await moonState(page);
  const tabs = [];
  for (const id of ['garden', 'f1', 'garden', 'f1']) {
    await page.evaluate((space) => window.__hpTest.switchSpace(space), id);
    await settle(page);
    tabs.push({ id, ...(await moonState(page)) });
  }
  report.ac4 = { inEnv, tabs };
  checks.ac4_startsInsideTheEnvironment = inEnv.count === 1 && inEnv.on && inEnv.parent === 'hp-day-cycle-env';
  checks.ac4_tabsKeepOneMoonInItsPlace = tabs.every((tab) => tab.count === 1 && tab.on && tab.opacity === 1
    && tab.parent === (tab.id === 'garden' ? 'hp-moon-sky' : 'hp-day-cycle-env')
    && sameBox(tab.box, inEnv.box) && tab.running === 0);

  // AC4: the background segment previewed in the open General settings.
  await page.evaluate(async () => { window.__card._openSettingsDialog(); await window.__card.updateComplete; });
  const pick = (value) => page.evaluate(async (value) => {
    const card = window.__card;
    const input = card.renderRoot.querySelector(`hp-dialog input[name="gs-bg-mode"][value="${value}"]`);
    input?.click();
    await card.updateComplete;
    return !!input;
  }, value);
  const segmentFound = await pick('static');
  await settle(page);
  const previewed = await moonState(page);
  await pick('daynight');
  await settle(page);
  const restored = await moonState(page);
  await page.evaluate(async () => {
    const dialog = window.__card.renderRoot.querySelector('hp-dialog[data-kind="settings"]');
    if (dialog) await window.__hpTest.close(dialog);
  });
  report.ac4.previewed = previewed;
  checks.ac4_segmentPreviewKeepsTheMoon = segmentFound && previewed.count === 1 && previewed.on
    && previewed.opacity === 1 && previewed.parent === 'hp-moon-sky' && sameBox(previewed.box, inEnv.box)
    && previewed.running === 0;
  checks.ac4_segmentBackKeepsTheMoon = restored.count === 1 && restored.on
    && restored.parent === 'hp-day-cycle-env' && sameBox(restored.box, inEnv.box);

  // AC5: static background, View → plan editor and back (#101 transition).
  await setConfig(page, { bg_mode: 'static', moon: true });
  await settle(page);
  checks.ac5_staticMoonBeforeTheEditor = await until(page,
    () => window.__card.renderRoot.querySelector('.hp-moon.on')?.parentElement?.className === 'hp-moon-sky');
  const sample = () => page.evaluate(() => {
    const card = window.__card;
    window.__hpSkySamples = [];
    window.__hpSkyStop = false;
    const loop = () => {
      const root = card.renderRoot;
      const sky = root.querySelector('.hp-moon-sky');
      const moon = root.querySelector('.hp-moon');
      const stage = root.querySelector('.stage');
      window.__hpSkySamples.push({
        busy: !!card._modeTransitionBusy,
        weight: Number(getComputedStyle(stage).getPropertyValue('--hp-mode-view-weight')),
        sky: sky ? Number(getComputedStyle(sky).opacity) : null,
        moon: moon ? { on: moon.classList.contains('on'), opacity: Number(getComputedStyle(moon).opacity) } : null,
      });
      if (!window.__hpSkyStop) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  const stopSampling = () => page.evaluate(() => { window.__hpSkyStop = true; return window.__hpSkySamples; });
  await sample();
  await page.evaluate(() => window.__hpTest.setMode('plan'));
  await settle(page);
  const toEditor = await stopSampling();
  const inEditor = await moonState(page);
  await sample();
  await page.evaluate(() => window.__hpTest.setMode('view'));
  await settle(page);
  const toView = await stopSampling();
  const backInView = await moonState(page);
  const between = toEditor.filter((frame) => frame.sky !== null && frame.weight > 0 && frame.weight < 1);
  const firstBack = toView.find((frame) => frame.moon);
  report.ac5 = { between: between.length, toEditor: toEditor.length, inEditor, firstBack, backInView };
  checks.ac5_skyFollowsTheViewWeight = between.length > 0
    && toEditor.every((frame) => frame.sky === null || Math.abs(frame.sky - frame.weight) <= 0.02);
  checks.ac5_noMoonInTheEditor = inEditor.count === 0 && inEditor.sky === 0;
  checks.ac5_backInViewAtOnce = !!firstBack && firstBack.moon.on && firstBack.moon.opacity === 1
    && backInView.on && backInView.opacity === 1 && backInView.parent === 'hp-moon-sky';
  await browser.close();
}

// ─── Part B: the browser clock, no `sun.sun`, UTC (AC3) ───
{
  const { page, browser, moonRequests } = await open({ timezoneId: 'UTC' });
  await page.clock.install({ time: new Date('2026-10-21T17:59:00Z') });
  await pushHass(page, { config: MOSCOW, sun: null });
  await setConfig(page, { bg_mode: 'static', moon: true });
  await settle(page);
  await page.waitForTimeout(400);
  const before = await moonState(page);
  checks.ac3_dayByTheClockNoMoonNoChunk = !before.on && moonRequests.length === 0;
  // Witness: only the card's own clock ticker can bring the moon at 18:00.
  await page.clock.runFor(90_000);
  const dusk = await until(page, moonOn);
  const evening = await moonState(page);
  checks.ac3_duskByTheClockShowsTheMoon = dusk && evening.count === 1 && evening.k === '0.79'
    && evening.parent === 'hp-moon-sky';
  await page.clock.setSystemTime(new Date('2026-10-03T07:59:00Z'));
  await page.clock.runFor(30_000);
  const dawnShown = await until(page,
    () => window.__card.renderRoot.querySelector('.hp-moon.on')?.dataset.moonK === '0.53');
  const dawn = await moonState(page);
  checks.ac3_dawnByTheClockShowsTheMoon = dawnShown && dawn.on && dawn.k === '0.53';
  await page.clock.runFor(60_000);
  const dayHides = await until(page, () => {
    const moon = window.__card.renderRoot.querySelector('.hp-moon');
    return !!moon && !moon.classList.contains('on');
  });
  checks.ac3_dayByTheClockHidesTheMoon = dayHides;
  report.ac3 = { before, evening, dawn, requests: moonRequests.length };
  await browser.close();
}

// ─── Part C: houseplan-space-card with its own static background (AC6) ───
{
  const { page, browser } = await open({ timezoneId: 'UTC' });
  await page.clock.install({ time: new Date('2026-10-21T18:00:00Z') });
  await setConfig(page, { bg_mode: 'daynight', moon: true }, { f1: { bg_mode: 'static' } });
  await page.evaluate(async ({ config, sun }) => {
    await customElements.whenDefined('houseplan-space-card');
    const full = window.__card;
    full.style.display = 'none';
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:0;top:0;width:820px';
    document.body.appendChild(host);
    const card = document.createElement('houseplan-space-card');
    card.setConfig({ type: 'custom:houseplan-space-card', space: 'f1', title: '', show_button: false });
    card.hass = {
      ...full.hass,
      config: { ...(full.hass.config || {}), ...config },
      states: { ...full.hass.states, 'sun.sun': { entity_id: 'sun.sun', state: 'below_horizon', attributes: sun } },
    };
    host.appendChild(card);
    window.__hpSpaceCard = card;
  }, { config: MOSCOW, sun: NIGHT_SUN });
  const spaceMoon = () => page.evaluate(() => {
    const card = window.__hpSpaceCard;
    const moon = card.renderRoot?.querySelector('.hp-static-stage > .hp-moon-sky > .hp-moon');
    return {
      count: card.renderRoot?.querySelectorAll('.hp-moon').length ?? 0,
      nested: !!moon,
      firstChild: !!moon && moon.parentElement === moon.parentElement.parentElement.firstElementChild,
      on: !!moon?.classList.contains('on'),
      k: moon?.dataset.moonK ?? null,
      env: !!card.renderRoot?.querySelector('.hp-day-cycle-env'),
    };
  });
  const spaceOn = () => !!window.__hpSpaceCard?.renderRoot?.querySelector('.hp-static-stage > .hp-moon-sky > .hp-moon.on');
  const nightShown = await until(page, spaceOn);
  const night = await spaceMoon();
  checks.ac6_spaceCardMoonInTheSkyLayer = nightShown && night.count === 1 && night.nested && night.firstChild
    && !night.env;
  // Stacking: with both hit-testable, the plan wins over the part of the disc it covers.
  const stacking = await page.evaluate(() => {
    const root = window.__hpSpaceCard.renderRoot;
    if (!root?.querySelector('.hp-moon')) return { plan: 0, disc: 0 };
    const style = document.createElement('style');
    style.id = 'hp-moon-hit';
    style.textContent = '.hp-static-plan-svg *,.hp-moon,.hp-moon *{pointer-events:auto!important}';
    root.appendChild(style);
    const moon = root.querySelector('.hp-moon');
    const box = moon.getBoundingClientRect();
    const r = box.width * 0.47 * 0.9;
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    let plan = 0;
    let disc = 0;
    for (let y = cy - r; y <= cy + r; y += 3) {
      for (let x = cx - r; x <= cx + r; x += 3) {
        if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
        const hit = root.elementFromPoint(x, y);
        if (hit?.closest('.hp-static-plan-svg')) plan++;
        else if (hit?.closest('.hp-moon')) disc++;
      }
    }
    style.remove();
    return { plan, disc };
  });
  report.ac6 = { night, stacking };
  checks.ac6_planCoversPartOfTheDisc = stacking.plan > 0 && stacking.disc > 0;
  const pushSpace = (sun) => page.evaluate(async (sun) => {
    const card = window.__hpSpaceCard;
    const states = { ...card.hass.states };
    if (sun) states['sun.sun'] = { entity_id: 'sun.sun', state: 'above_horizon', attributes: sun };
    else delete states['sun.sun'];
    card.hass = { ...card.hass, states };
    await card.updateComplete;
  }, sun);
  await pushSpace(DAY_SUN);
  checks.ac6_dayHidesTheMoon = await until(page,
    () => window.__hpSpaceCard.renderRoot.querySelector('.hp-moon')?.classList.contains('on') === false);
  // Without `sun.sun`: 17:59 is day by the clock; 18:00 comes without a state update.
  await page.clock.setSystemTime(new Date('2026-10-21T17:59:00Z'));
  await pushSpace(null);
  await page.waitForTimeout(300);
  const clockDay = await spaceMoon();
  await page.clock.runFor(90_000);
  const clockDusk = await until(page, spaceOn);
  report.ac6.clockDay = clockDay;
  checks.ac6_clockDuskShowsTheMoon = !clockDay.on && clockDusk;
  console.log(JSON.stringify(report, null, 1));
  checkAll(checks);
  await finish(browser, checks);
}
