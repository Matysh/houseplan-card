// #1485 exercises the slow/degraded paths with ordinary card wheel input.
import { createRequire } from 'node:module';
import { check, finish } from './serve.mjs';
import { settleIsoPaint, startIsoPaintScene, zoomIsoPaint } from './helpers/iso-paint-scene.mjs';

const { PNG } = createRequire(import.meta.url)('playwright-core/lib/utilsBundle');
const mode = process.argv[2] ?? 'underlay';
if (!['underlay', 'backdrop', 'fallback', 'composition-fallback', 'light'].includes(mode))
  throw Error('Choose underlay, backdrop, fallback, composition-fallback or light');
const readyMark = 'houseplan.iso.raster.ready';
const { browser, page } = await startIsoPaintScene({
  width: 1408, height: 952, dpr: 2, reducedMotion: 'no-preference',
  configureFixture: mode === 'backdrop' ? fixture => {
    fixture.config.spaces[0].plan_url = '/assets/f1.svg?raster-session';
    fixture.config.spaces[0].plan_aspect = 1;
  } : undefined,
  initScript: mode === 'fallback' ? () => { window.createImageBitmap = undefined; }
    : mode === 'composition-fallback' ? () => {
      const supports = CSS.supports.bind(CSS);
      CSS.supports = (...args) => args[0] === 'mix-blend-mode' && args[1] === 'plus-lighter' ? false : supports(...args);
    } : undefined,
});

/** Exercise the browser's actual compositing pixels at a corner of the masks
 * collected from a live split. Matching CSS stops do not prove that neither
 * raster paints the shared pixel twice, or that translucent ink stays true. */
async function splitPixelError(sample) {
  const { left, top } = sample;
  const clip = { x:Math.floor(left)-3, y:Math.floor(top)-3, width:8, height:8 };
  const pixels = async (alpha, split) => {
    await page.evaluate(({ sample, alpha, split }) => {
      const root = window.__isoPaint.renderRoot;
      const stage = root.querySelector('.stage').getBoundingClientRect();
      let probe = root.querySelector('[data-raster-pixel-probe]');
      if (!probe) {
        probe = document.createElement('div');
        probe.dataset.rasterPixelProbe = '';
        probe.style.cssText = `position:fixed;inset:0 auto auto 0;width:${stage.width}px;height:${stage.height}px;
          background:#d6c5bd;z-index:1000;pointer-events:none`;
        const stack=document.createElement('div'); stack.className='zoomwrap';
        probe.append(stack);
        root.append(probe);
      }
      const layer = (kind, mask) => {
        const div = document.createElement('div'), canvas = document.createElement('canvas');
        div.className = 'hp-iso-raster-layer hp-iso-gesture-' + kind + '-layer';
        div.style.maskImage = mask;
        canvas.className = 'hp-iso-raster';
        canvas.width = Math.round(stage.width); canvas.height = Math.round(stage.height);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = `rgba(68,94,115,${alpha})`;
        ctx.fillRect(0,0,canvas.width,canvas.height);
        div.append(canvas); return div;
      };
      probe.firstElementChild.replaceChildren(...(split ? [layer('underlay',sample.overview),layer('image',sample.detail)]
        : [layer('image','')]));
    }, { sample, alpha, split });
    return PNG.sync.read(await page.screenshot({clip})).data;
  };
  let error=0;
  try {
    for(const alpha of [1,.55]) {
      const whole=await pixels(alpha,false), split=await pixels(alpha,true);
      if(alpha===1) check('the pixel probe paints its known opaque swatch',
        whole[0]===68 && whole[1]===94 && whole[2]===115 && whole[3]===255);
      for(let i=0;i<whole.length;i++) error=Math.max(error,Math.abs(whole[i]-split[i]));
    }
    return error;
  } finally {
    await page.evaluate(() => window.__isoPaint.renderRoot.querySelector('[data-raster-pixel-probe]')?.remove());
  }
}

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
    const slow = mode === 'underlay' || mode === 'composition-fallback';
    if (slow) {
      window.createImageBitmap = async (...args) => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return create(...args);
      };
    }
    const lightId = Object.keys(card.hass.states).find(id => id.startsWith('light.'));
    const light = lightId && card.hass.states[lightId];
    let sawUnderlay = false, sawRaster = false, sawVectorWrite = false, samples = 0;
    let splitSamples = 0, alignedSplit = true, maskSample = null;
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
          const underlay = root.querySelector('.hp-iso-gesture-underlay-layer');
          const raster = !!image && scene.hasAttribute('data-hp-raster-display');
          sawRaster ||= raster;
          rasterAfterLight ||= lightMix && !mixing && raster;
          sawUnderlay ||= !!underlay && underlay.style.maskImage.includes('linear-gradient');
          if (raster && underlay) {
            splitSamples++;
            const detail = image.parentElement;
            const edgeValues = [...detail.style.maskImage.matchAll(/(-?[\d.]+)px/g)].map(m => Number(m[1]));
            const quantized = edgeValues.every(v => {
              const px = v * devicePixelRatio;
              return Math.abs(px - Math.round(px)) < .002;
            });
            alignedSplit &&= edgeValues.length === 8 && quantized
              && detail.parentElement === underlay.parentElement
              && getComputedStyle(detail).mixBlendMode === 'plus-lighter'
              && getComputedStyle(detail).maskComposite.includes('intersect')
              && getComputedStyle(underlay).maskComposite.startsWith('subtract')
              && underlay.style.maskImage.endsWith(detail.style.maskImage);
            if (!maskSample && edgeValues.length === 8) {
              const left = edgeValues[0], top = edgeValues[4];
              if (left > 4 && top > 4) maskSample = {
                detail:detail.style.maskImage, overview:underlay.style.maskImage, left, top,
              };
            }
          }
        }
        time = await tick();
        if (time - start > 6000) throw Error('The synthetic wheel series did not settle');
      }
      const finalLight = lightId && Boolean(scene.querySelector('.glow-spot[data-glow-source="' + lightId + '"]'));
      return { samples, sawRaster, sawUnderlay, sawVectorWrite, lightMix, rasterAfterLight, splitSamples, alignedSplit, maskSample,
        finalLightMatches: finalLight === (light?.state !== 'on'),
        cameraMoved: svg.getAttribute('viewBox') !== firstView };
    } finally {
      if (slow) window.createImageBitmap = create;
    }
  }, mode);
  await settleIsoPaint(page);
  check('wheel produced active frames', result.samples > 0);
  check('wheel reached a different exact SVG view', result.cameraMoved);
  check('vector writes during wheel follow capability', result.sawVectorWrite,
    mode === 'fallback' || mode === 'composition-fallback');
  check('raster surface follows capability', result.sawRaster, mode !== 'fallback');
  if (mode === 'underlay') check('slow preparation uses a cut-out underlay', result.sawUnderlay);
  if (mode === 'underlay') check('live split shares a stage and complementary physical-pixel clips',
    result.splitSamples > 0 && result.alignedSplit);
  if (mode === 'underlay') {
    check('captured a real split corner for pixel verification', !!result.maskSample);
    if (result.maskSample) {
      result.maxSplitPixelError = await splitPixelError(result.maskSample);
      check('the split is indistinguishable from one canvas for opaque and translucent pixels',
        result.maxSplitPixelError <= 2);
    }
  }
  if (mode === 'composition-fallback') check('no split paint without additive composition', result.sawUnderlay, false);
  if (mode === 'light') {
    check('the old and new light states share the short SVG fade', result.lightMix);
    check('the raster path returns during the same gesture', result.rasterAfterLight);
    check('the exact frame contains the new light state', result.finalLightMatches);
  }
  await page.locator('houseplan-card .hp-iso-raster').first().waitFor({ state: 'detached' });
  check('the exact frame releases the attached raster', await page.locator('houseplan-card .hp-iso-raster').count(), 0);
  check('exact SVG is visible', await page.locator('houseplan-card .iso-scene-surface[data-hp-raster-display]').count(), 0);
  check('settled SVG does not retain the gesture transform hint', await page.locator(
    'houseplan-card .iso-scene-surface').evaluate(surface => {
    const style = getComputedStyle(surface);
    return style.transform === 'none' && !style.willChange.includes('transform');
  }));
  console.log(JSON.stringify({ mode, ...result }));
} finally {
  await finish(browser);
}
