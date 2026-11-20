// #1485 exercises the slow/degraded paths with ordinary card wheel input.
import { check, finish } from './serve.mjs';
import { settleIsoPaint, startIsoPaintScene, zoomIsoPaint } from './helpers/iso-paint-scene.mjs';

const mode = process.argv[2] ?? 'underlay';
if (!['underlay', 'backdrop', 'fallback', 'light'].includes(mode)) throw Error('Choose underlay, backdrop, fallback or light');
const readyMark = 'houseplan.iso.raster.ready';
const { browser, page } = await startIsoPaintScene({
  width: 1408, height: 952, dpr: 2, reducedMotion: 'no-preference',
  configureFixture: mode === 'backdrop' ? fixture => {
    fixture.config.spaces[0].plan_url = '/assets/f1.svg?raster-session';
    fixture.config.spaces[0].plan_aspect = 1;
  } : undefined,
  createPage: async context => {
    if (mode === 'fallback') await context.addInitScript(() => { window.createImageBitmap = undefined; });
    return context.newPage();
  },
});

try {
  const before = await page.evaluate(mark => performance.getEntriesByName(mark).length, readyMark);
  await zoomIsoPaint(page, 4);
  if (mode !== 'fallback') {
    await page.waitForFunction(({ mark, before }) => performance.getEntriesByName(mark).length > before, { mark: readyMark, before });
  }
  if (mode === 'backdrop') check('the fixture renders the SVG backdrop', await page.locator(
    'houseplan-card .iso-scene-surface image.hp-backdrop').count(), 1);
  const result = await page.evaluate(async mode => {
    const card = window.__isoPaint, root = card.renderRoot;
    const scene = root.querySelector('.iso-scene-surface');
    const svg = scene.querySelector('svg');
    const firstView = svg.getAttribute('viewBox');
    const stage = scene.closest('.stage');
    const { left, top, width, height } = stage.getBoundingClientRect();
    const wheelTarget = stage.querySelector('.zoomwrap');
    const send = () => wheelTarget.dispatchEvent(new WheelEvent('wheel', {
      deltaY: 100, clientX: left + width * .88, clientY: top + height * .66,
      bubbles: true, composed: true, cancelable: true,
    }));
    const create = window.createImageBitmap;
    const start = performance.now();
    if (mode === 'underlay') {
      window.createImageBitmap = async (...args) => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return create(...args);
      };
    }
    const lightId = Object.keys(card.hass.states).find(id => id.startsWith('light.'));
    const light = lightId && card.hass.states[lightId];
    let sawUnderlay = false, sawRaster = false, sawVectorWrite = false, samples = 0;
    let lightChanged = false, lightMix = false, rasterAfterLight = false;
    let previousView = firstView;
    const tick = () => new Promise(resolve => requestAnimationFrame(resolve));
    let sent = 0, time = start;
    try {
      const steps = mode === 'light' ? 12 : 10;
      while (sent < steps || card._cameraTransition.active) {
        while (sent < steps && time - start >= sent * 140) { send(); sent++; }
        if (mode === 'light' && sent >= 3 && !lightChanged) {
          if (!light) throw Error('The paint fixture has no light');
          card.hass = { ...card.hass, states: { ...card.hass.states,
            [lightId]: { ...light, state: light.state === 'on' ? 'off' : 'on' } } };
          lightChanged = true;
          await card.updateComplete;
        }
        if (card._cameraTransition.active) {
          samples++;
          const mixing = scene.hasAttribute('data-hp-light-mixing');
          const nextView = svg.getAttribute('viewBox');
          if (!mixing) sawVectorWrite ||= nextView !== previousView;
          previousView = nextView;
          lightMix ||= mixing;
          const image = root.querySelector('.hp-iso-gesture-image');
          const underlay = root.querySelector('.hp-iso-gesture-underlay');
          const raster = !!image && scene.hasAttribute('data-hp-raster-display');
          sawRaster ||= raster;
          rasterAfterLight ||= lightMix && !mixing && raster;
          sawUnderlay ||= !!underlay && underlay.style.clipPath.includes('evenodd');
        }
        time = await tick();
        if (time - start > 6000) throw Error('The synthetic wheel series did not settle');
      }
      const finalLight = lightId && Boolean(scene.querySelector('.glow-spot[data-glow-source="' + lightId + '"]'));
      return { samples, sawRaster, sawUnderlay, sawVectorWrite, lightMix, rasterAfterLight,
        finalLightMatches: finalLight === (light?.state !== 'on'),
        cameraMoved: svg.getAttribute('viewBox') !== firstView };
    } finally {
      if (mode === 'underlay') window.createImageBitmap = create;
    }
  }, mode);
  await settleIsoPaint(page);
  check('wheel produced active frames', result.samples > 0);
  check('wheel reached a different exact SVG view', result.cameraMoved);
  check('vector writes during wheel follow capability', result.sawVectorWrite, mode === 'fallback');
  check('raster surface follows capability', result.sawRaster, mode !== 'fallback');
  if (mode === 'underlay') check('slow preparation uses a cut-out underlay', result.sawUnderlay);
  if (mode === 'light') {
    check('the old and new light states share the short SVG fade', result.lightMix);
    check('the raster path returns during the same gesture', result.rasterAfterLight);
    check('the exact frame contains the new light state', result.finalLightMatches);
  }
  check('the exact frame releases the attached raster', await page.locator('houseplan-card .hp-iso-raster').count(), 0);
  check('exact SVG is visible', await page.locator('houseplan-card .iso-scene-surface[data-hp-raster-display]').count(), 0);
  console.log(JSON.stringify({ mode, ...result }));
} finally {
  await finish(browser);
}
