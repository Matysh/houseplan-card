// #1493. A real wheel command settles before the 200 ms raster-to-SVG fade.
import { check, finish } from './serve.mjs';
import { settleIsoPaint, startIsoPaintScene } from './helpers/iso-paint-scene.mjs';

const { browser, page } = await startIsoPaintScene({
  width: 1408, height: 952, dpr: 2, reducedMotion: 'no-preference',
  configureFixture({ config, states }) {
    Object.assign(config.settings, { sun_rays: true, north_deg: 0 });
    Object.assign(config.spaces[0].settings, { fill_mode: 'custom', custom_fill: { c: '#263e52', a: 1 } });
    states['sun.sun'] = { state: 'above_horizon', attributes: { azimuth: 0, elevation: 28 } };
  },
});

const stage = page.locator('houseplan-card .stage');
const handoff = stage.locator('.hp-iso-raster-handoff');
const marks = () => page.evaluate(() => performance.getEntriesByName('houseplan.iso.raster.handoff').length);

async function wheel(deltaY) {
  await stage.locator('.zoomwrap').evaluate((target, deltaY) => {
    const { left, top, width, height } = target.getBoundingClientRect();
    target.dispatchEvent(new WheelEvent('wheel', {
      deltaY, clientX: left + width * .71, clientY: top + height * .65,
      bubbles: true, cancelable: true, composed: true,
    }));
  }, deltaY);
}

async function frameInHandoff() {
  return handoff.evaluate(layer => {
    const card = window.__isoPaint, svg = layer.parentElement.querySelector('svg');
    const box = svg.viewBox.baseVal;
    const { x, y, w, h } = card._viewOr(card._baseVb());
    const incoming = svg.getAnimations()[0], outgoing = layer.getAnimations()[0];
    for (const animation of [incoming, outgoing]) {
      animation.pause();
      animation.currentTime = 100;
    }
    return {
      duration: outgoing.effect.getTiming().duration,
      aligned: Math.abs(box.x - x) < 1e-4 && Math.abs(box.y - y) < 1e-4 &&
        Math.abs(box.width - w) < 1e-4 && Math.abs(box.height - h) < 1e-4,
      exactAlreadyCommitted: !card._cameraTransition.active,
      noDoubleAlpha: getComputedStyle(layer).mixBlendMode === 'plus-lighter' &&
        getComputedStyle(layer.parentElement).isolation === 'isolate' &&
        Math.abs(Number(getComputedStyle(layer).opacity) + Number(getComputedStyle(svg).opacity) - 1) < .01,
      sceneHasSun: !!svg.querySelector('.iso-sunwash'),
      markerOutsideFade: !layer.parentElement.contains(card.renderRoot.querySelector('[data-hp-live-marker-clip]')),
    };
  });
}

try {
  await page.waitForFunction(() => performance.getEntriesByName('houseplan.iso.raster.ready').length > 0);
  await wheel(-80);
  const first = await frameInHandoff();
  check('handoff lasts exactly 200 ms', first.duration, 200);
  check('both endpoints use the committed camera', first.aligned && first.exactAlreadyCommitted);
  check('both layers contribute complementary opacity', first.noDoubleAlpha);
  check('window light and the independent marker surface remain present', first.sceneHasSun && first.markerOutsideFade);

  const started = await marks();
  const oldLayer = await handoff.elementHandle();
  await wheel(80);
  check('new wheel input immediately disconnects the old handoff', await oldLayer.evaluate(layer => !layer.isConnected));
  check('new wheel input keeps the camera active', await page.evaluate(() => window.__isoPaint._cameraTransition.active));
  await page.waitForFunction(count => performance.getEntriesByName('houseplan.iso.raster.handoff').length > count, started);
  await handoff.waitFor({ state: 'detached' });
  check('completed handoff releases the raster', await stage.locator('.hp-iso-raster').count(), 0);
  check('completed handoff leaves a fully visible SVG', await stage.locator('.iso-scene-surface svg').first()
    .evaluate(svg => getComputedStyle(svg).opacity), '1');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const before = await marks();
  await wheel(-80);
  await settleIsoPaint(page);
  check('reduced motion shows the exact frame directly', (await marks()) === before &&
    (await stage.locator('.hp-iso-raster').count()) === 0);
  console.log(JSON.stringify({ first, handoffs: await marks() }));
} finally {
  await finish(browser);
}
