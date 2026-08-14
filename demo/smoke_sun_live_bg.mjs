// Four-phase Sun background (#146): plain hass ticks update one constant
// environment tree, never dim the plan, and clock fallback owns a visible-only
// 30-second lifecycle. Window rays retain their separate north/sun gates.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch({ width: 900, height: 900 }, 1);

const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const cfg = c._serverCfg;
  cfg.settings = { ...(cfg.settings || {}), bg_mode: 'daynight', sun_rays: true };
  cfg.spaces.find((space) => space.id === 'f1').openings = [
    { id: 'wS', type: 'window', x: 0.30, y: 0.86, angle: 0, length: 0.08 },
  ];
  c._cfgEpoch++;

  // No external requestUpdate: production advances through the hass setter.
  const setSun = async (azimuth, elevation, rising) => {
    c.hass = { ...c.hass, states: { ...c.hass.states, 'sun.sun': {
      entity_id: 'sun.sun', state: elevation > 0 ? 'above_horizon' : 'below_horizon',
      attributes: { azimuth, elevation, rising },
    } } };
    await c.updateComplete;
  };
  const stage = () => sr().querySelector('.stage');
  const env = () => sr().querySelector('.hp-day-cycle-env');
  const active = () => sr().querySelector('.hp-day-cycle-bg.active');
  const zoomStyle = () => sr().querySelector('.zoomwrap').getAttribute('style') || '';
  const rayCount = () => sr().querySelectorAll('.sunlayer polygon').length;

  // Background needs neither compass nor window-ray geometry.
  delete cfg.settings.north_deg;
  await setSun(90, -2, true);
  out.dawnOnPlainTick = stage().classList.contains('phase-dawn')
    && env()?.dataset.dayCycleSource === 'sun'
    && active()?.dataset.dayCycleLayer === 'dawn';
  out.constantFourLayers = sr().querySelectorAll('.hp-day-cycle-bg').length === 4;
  out.backgroundIndependentOfNorth = !!stage().classList.contains('daycycle');
  out.raysStillNeedNorth = rayCount() === 0;

  cfg.settings.north_deg = 0;
  c._cfgEpoch++;
  await setSun(180, 40, false);
  out.dayOnPlainTick = stage().classList.contains('phase-day')
    && active()?.getAttribute('style').includes('#dce9ef');
  out.dayRays = rayCount() > 0;
  out.dayPlanUnfiltered = !zoomStyle().includes('brightness(0.');

  await setSun(180, 0, false);
  out.duskOnPlainTick = stage().classList.contains('phase-dusk')
    && active()?.dataset.dayCycleLayer === 'dusk';
  await setSun(180, -6, false);
  out.exactMinusSixIsNight = stage().classList.contains('phase-night');
  out.nightLightHidden = env()?.style.getPropertyValue('--hp-day-cycle-sun-opacity') === '0.000';
  out.nightPlanUnfiltered = !zoomStyle().includes('brightness(0.');
  out.nightNoRays = rayCount() === 0;

  await setSun(180, 6, true);
  out.exactPlusSixIsDay = stage().classList.contains('phase-day');
  out.phaseTransitionIs1100ms = getComputedStyle(active()).transitionDuration === '1.1s';

  // One invalid required field switches the whole environment atomically to
  // browser-local time and arms the fallback timer only while visible.
  await setSun(180, 6, undefined);
  out.invalidSampleUsesClock = env()?.dataset.dayCycleSource === 'clock';
  out.clockTimerArmed = c._dayCycleTimer !== 0;

  const ownVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState');
  const room = c._spaceModel().rooms[0];
  c._hoverRoom = { space: c._space, room };
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
  out.hiddenStopsClock = c._dayCycleTimer === 0;
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  document.dispatchEvent(new Event('visibilitychange'));
  await c.updateComplete;
  out.visibleRestartsClock = c._dayCycleTimer !== 0;
  out.visibilityKeepsHover = c._hoverRoom?.room === room;
  if (ownVisibilityState) Object.defineProperty(document, 'visibilityState', ownVisibilityState);
  else delete document.visibilityState;

  return out;
});
await finish(browser, checkAll(res));
