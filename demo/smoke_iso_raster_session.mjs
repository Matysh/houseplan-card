// #1485 exercises the slow/degraded paths with ordinary card wheel input.
import { check, finish } from './serve.mjs';
import { settleIsoPaint, startIsoPaintScene, zoomIsoPaint } from './helpers/iso-paint-scene.mjs';

const mode = process.argv[2] ?? 'underlay';
if (!['underlay', 'backdrop', 'fallback'].includes(mode)) throw Error('Choose underlay, backdrop or fallback');
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
    let sawUnderlay = false, sawRaster = false, sawVectorWrite = false, samples = 0;
    const tick = () => new Promise(resolve => requestAnimationFrame(resolve));
    let sent = 0, time = start;
    try {
      while (sent < 10 || card._cameraTransition.active) {
        while (sent < 10 && time - start >= sent * 140) { send(); sent++; }
        if (card._cameraTransition.active) {
          samples++;
          sawVectorWrite ||= svg.getAttribute('viewBox') !== firstView;
          const image = root.querySelector('.hp-iso-gesture-image');
          const underlay = root.querySelector('.hp-iso-gesture-underlay');
          sawRaster ||= !!image && scene.hasAttribute('data-hp-raster-display');
          sawUnderlay ||= !!underlay && underlay.style.clipPath.includes('evenodd');
        }
        time = await tick();
        if (time - start > 6000) throw Error('The synthetic wheel series did not settle');
      }
      return { samples, sawRaster, sawUnderlay, sawVectorWrite, cameraMoved: svg.getAttribute('viewBox') !== firstView };
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
  check('the exact frame releases the attached raster', await page.locator('houseplan-card .hp-iso-raster').count(), 0);
  check('exact SVG is visible', await page.locator('houseplan-card .iso-scene-surface[data-hp-raster-display]').count(), 0);
  console.log(JSON.stringify({ mode, ...result }));
} finally {
  await finish(browser);
}
