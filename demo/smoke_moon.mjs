// #661 AC4/AC5: the moon over the "Follow the Sun" background in a real
// browser. The page clock is Playwright's (`page.clock`), the home is Moscow
// through `hass.config`, the environment phase comes from `sun.sun`; the moon
// is switched on the way another client's save arrives (`__hpTest`).
//
// Moscow 2026-10-21 (waxing, 77 %): the moon sets through 3° between 22:37Z
// (3.03°) and 22:38Z (2.90°) — 22:30Z is above, 22:45Z below.
import { launch, checkAll, finish } from './serve.mjs';

const ABOVE = new Date('2026-10-21T22:30:00Z');
const BELOW = new Date('2026-10-21T22:45:00Z');

const { page, browser } = await launch({ width: 1000, height: 760 });
await page.clock.setFixedTime(ABOVE);

/** A state update, as Home Assistant pushes one: new hass object, same card. */
const pushHass = (patch) => page.evaluate(async ({ sun, config }) => {
  const card = window.__card;
  card.hass = {
    ...card.hass,
    ...(config ? { config: { ...(card.hass.config || {}), ...config } } : {}),
    states: sun ? { ...card.hass.states, 'sun.sun': { entity_id: 'sun.sun', state: 'below_horizon', attributes: sun } } : card.hass.states,
  };
  await card.updateComplete;
}, patch);
const moonState = () => page.evaluate(() => {
  const root = window.__card.renderRoot;
  const moon = root.querySelector('.hp-moon');
  if (!moon) return null;
  const style = getComputedStyle(moon);
  return {
    on: moon.classList.contains('on'),
    opacity: Number(style.opacity),
    duration: style.transitionDuration,
    parent: moon.parentElement?.className || '',
    phase: root.querySelector('.hp-day-cycle-env')?.dataset.dayCyclePhase || null,
    count: root.querySelectorAll('.hp-moon').length,
  };
});
const waitMoon = (predicate, what) => page.waitForFunction(predicate, null, { timeout: 8000 })
  .catch(() => { throw new Error(`moon did not ${what}`); });

await pushHass({ config: { latitude: 55.75, longitude: 37.62 }, sun: { azimuth: 0, elevation: -12, rising: false } });
await page.evaluate(() => window.__hpTest.setServerConfig((cfg) => {
  cfg.settings = { ...(cfg.settings || {}), bg_mode: 'daynight', moon: true };
  for (const space of cfg.spaces) if (space.settings) delete space.settings.bg_mode;
  return cfg;
}));
await waitMoon(() => !!window.__card.renderRoot.querySelector('.hp-moon'), 'appear after the chunk loaded');
const first = await moonState();

const checks = {};
// C4: the first appearance after the chunk load is not animated.
checks.firstAppearanceIsImmediate = first?.on === true && first.opacity === 1;
checks.oneMoonInsideTheEnvironment = first?.count === 1 && first.parent === 'hp-day-cycle-env';
checks.twoSecondFade = first?.duration === '2s';

// AC4 in the browser: three 30 s ticks over an unchanged sky touch nothing.
await page.evaluate(() => {
  const moon = window.__card.renderRoot.querySelector('.hp-moon');
  window.__hpMoonMutations = 0;
  window.__hpMoonObserver = new MutationObserver((records) => { window.__hpMoonMutations += records.length; });
  window.__hpMoonObserver.observe(moon, { attributes: true, childList: true, subtree: true, characterData: true });
});
for (let tick = 0; tick < 3; tick++) await page.clock.runFor(30_000);
checks.threeQuietTicksNoRender = await page.evaluate(() => window.__hpMoonMutations) === 0;

// AC5: the ticker alone carries the moon through 3° — it fades out over 2 s.
await page.clock.setFixedTime(BELOW);
await page.clock.runFor(30_000);
await waitMoon(() => !window.__card.renderRoot.querySelector('.hp-moon')?.classList.contains('on'), 'set by the ticker');
await page.waitForTimeout(250);
const fading = await moonState();
checks.setsWithAFade = fading.on === false && fading.opacity > 0 && fading.opacity < 1;
await page.waitForTimeout(2200);
checks.setsToZero = (await moonState()).opacity === 0;
await page.evaluate(() => window.__hpMoonObserver.disconnect());

// Back above 3° on the next render (a state update): fades in to 1.
await page.clock.setFixedTime(ABOVE);
await pushHass({ sun: { azimuth: 2, elevation: -12.1, rising: false } });
await page.waitForTimeout(250);
const rising = await moonState();
checks.risesWithAFade = rising.on === true && rising.opacity > 0 && rising.opacity < 1;
await page.waitForTimeout(2200);
checks.risesToOne = (await moonState()).opacity === 1;

// C6 / owner decision 7: the plan paints over the moon. Along the disc's
// diameter, find one point where plan content is hit and one where only the
// empty scene is; then compare the painted pixel with the moon shown and
// hidden. Under the plan it must not change, in the open it must.
const probe = await page.evaluate(() => {
  const root = window.__card.renderRoot;
  const moon = root.querySelector('.hp-moon');
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
  return { covered, open, cy, pointerEvents: getComputedStyle(moon).pointerEvents };
});
/** One painted pixel, as PNG bytes (the encoder is deterministic). */
const pixel = async (x, y) => (await page.screenshot({ clip: { x, y, width: 1, height: 1 } })).toString('base64');
const withMoonHidden = async (fn) => {
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.id = 'hp-moon-probe';
    style.textContent = '.hp-moon{visibility:hidden!important}';
    window.__card.renderRoot.appendChild(style);
  });
  try { return await fn(); } finally {
    await page.evaluate(() => window.__card.renderRoot.querySelector('#hp-moon-probe')?.remove());
  }
};
const shown = {
  covered: probe.covered === null ? null : await pixel(probe.covered, probe.cy),
  open: probe.open === null ? null : await pixel(probe.open, probe.cy),
};
const hidden = await withMoonHidden(async () => ({
  covered: probe.covered === null ? null : await pixel(probe.covered, probe.cy),
  open: probe.open === null ? null : await pixel(probe.open, probe.cy),
}));
checks.planCoversPartOfTheDisc = probe.covered !== null && probe.open !== null;
checks.moonChangesNoPixelUnderThePlan = shown.covered !== null && shown.covered === hidden.covered;
checks.moonIsPaintedWhereThePlanIsNot = shown.open !== null && shown.open !== hidden.open;
checks.moonIgnoresThePointer = probe.pointerEvents === 'none';

// Daytime: the environment turns to day and the moon fades out.
await pushHass({ sun: { azimuth: 180, elevation: 40, rising: false } });
await page.waitForTimeout(2300);
const day = await moonState();
checks.dayHidesTheMoon = day?.phase === 'day' && day.on === false && day.opacity === 0;

// Reduced motion: no transition at all.
await page.emulateMedia({ reducedMotion: 'reduce' });
checks.reducedMotionNoTransition = (await moonState()).duration === '0s';

console.log(JSON.stringify({ first, fading, rising, day, probe }, null, 2));
checkAll(checks);
await finish(browser, checks);
