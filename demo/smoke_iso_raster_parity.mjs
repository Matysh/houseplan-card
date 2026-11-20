// #1485 AC8 compares a native-density raster with the vector at the same camera.
import { createRequire } from 'node:module';
import { check, finish } from './serve.mjs';
import { settleIsoPaint, startIsoPaintScene, zoomIsoPaint } from './helpers/iso-paint-scene.mjs';

const { PNG } = createRequire(import.meta.url)('playwright-core/lib/utilsBundle');
const { browser, page } = await startIsoPaintScene({ width: 1408, height: 952, dpr: 2 });
const card = page.locator('houseplan-card');
const stage = card.locator('.stage');
const ready = () => page.evaluate(() => performance.getEntriesByName('houseplan.iso.raster.ready').length);
async function waitReady(count = 0) {
  await page.waitForFunction(count => performance.getEntriesByName('houseplan.iso.raster.ready').length > count, count);
}
async function setLightAndTheme(light, darkMode) {
  await page.evaluate(async ({light,darkMode}) => {
    const card = window.__isoPaint;
    card.hass = { ...card.hass, themes: { ...card.hass.themes, darkMode },
      states: Object.fromEntries(Object.entries(card.hass.states).map(([id, state]) =>
        [id, id.startsWith('light.') ? { ...state, state: light } : state])) };
    await card.updateComplete;
  }, { light, darkMode });
}
const screenshot = async stage => PNG.sync.read(await stage.screenshot());
async function imageAtSameCamera(page, stage) {
  await page.evaluate(() => {
    const card = window.__isoPaint;
    card._liveIsoRasterInput = () => 'wheel';
    card._liveVp(true);
  });
  try {
    await stage.locator('.hp-iso-gesture-image').waitFor({ state: 'attached' });
    return await screenshot(stage);
  } finally {
    await page.evaluate(() => {
      const card = window.__isoPaint;
      delete card._liveIsoRasterInput;
      card._liveVp(true);
    });
  }
}

try {
  await waitReady();
  for (const dark of [true, false]) {
    for (const light of ['off', 'on']) {
      let before = await ready();
      await setLightAndTheme(light, dark);
      await settleIsoPaint(page);
      await waitReady(before);
      for (const rotation of [0, 90, 180, 270]) {
        const baseline = await screenshot(stage);
        const active = await imageAtSameCamera(page, stage);
        let different = 0;
        for (let i = 0; i < baseline.data.length; i += 4) {
          for (let c = 0; c < 4; c++) {
            if (Math.abs(baseline.data[i+c] - active.data[i+c]) <= 8) continue;
            different++;
            break;
          }
        }
        const ratio = different / (baseline.width * baseline.height);
        check('native pixel parity ' + [dark ? 'dark' : 'light', light, rotation].join('/'), ratio <= .005);
        console.log(JSON.stringify({ dark, light, rotation, different, ratio }));
        before = await ready();
        await card.locator('[data-hp="rotate-right"]').click();
        await settleIsoPaint(page);
        await waitReady(before);
      }
    }
  }

  await checkWindowLight();
} finally {
  await finish(browser);
}

async function captureWindowLight(enabled) {
  const { browser, page } = await startIsoPaintScene({
    width: 1408, height: 952, dpr: 2, reducedMotion: 'no-preference',
    configureFixture({ config, states }) {
      Object.assign(config.settings, { sun_rays: enabled, north_deg: 0, bg_mode: 'solid', bg_color: '#17242e' });
      Object.assign(config.spaces[0].settings, { fill_mode: 'custom', custom_fill: { c: '#263e52', a: 1 } });
      states['sun.sun'] = { entity_id: 'sun.sun', state: 'above_horizon',
        attributes: { azimuth: 0, elevation: 28 } };
    },
  });
  try {
    const stage = page.locator('houseplan-card .stage');
    await page.waitForFunction(enabled => {
      const sun = window.__isoPaint.renderRoot.querySelector('.iso-sunwash');
      return (!enabled || sun && getComputedStyle(sun).opacity === '1')
        && performance.getEntriesByName('houseplan.iso.raster.ready').length > 0;
    }, enabled);
    const frames = [await screenshot(stage), await imageAtSameCamera(page, stage)];
    if (enabled) await checkLargeZoomSettles(page, stage);
    return frames;
  } finally {
    await browser.close();
  }
}

async function checkWindowLight() {
  // #1489. The control differs only in the sun wash. Comparing the
  // whole frame can miss even a fully invisible patch of daylight.
  const [daylight, daylightRaster] = await captureWindowLight(true);
  const [dark, darkRaster] = await captureWindowLight(false);
  let mask = 0, litPixels = 0, vectorLight = 0, rasterLight = 0;
  const rgb = (image, i) => image.data[i] + image.data[i + 1] + image.data[i + 2];
  for (let i = 0; i < daylight.data.length; i += 4) {
    const light = rgb(daylight, i) - rgb(dark, i);
    if (light < 18) continue;
    mask++;
    vectorLight += light;
    const cached = rgb(daylightRaster, i) - rgb(darkRaster, i);
    rasterLight += Math.max(0, cached);
    if (cached >= light * .5) litPixels++;
  }
  check('fixture has visible window light', mask > 1000);
  check('active bitmap preserves window light', rasterLight >= vectorLight * .85 && rasterLight <= vectorLight * 1.15);
  check('bitmap lights the same area', litPixels >= mask * .85);
  console.log(JSON.stringify({ mask, litPixels, vectorLight, rasterLight }));
}

async function checkLargeZoomSettles(page, stage) {
  await zoomIsoPaint(page, 2);
  const { x, y, width, height } = await stage.boundingBox();
  await page.mouse.move(x + width * .63, y + height * .6);
  for (const notches of [7, -5, 7]) {
    for (let i = 0; i < Math.abs(notches); i++) {
      await page.mouse.wheel(0, notches > 0 ? -80 : 80);
      await new Promise(resolve => setTimeout(resolve, 74));
    }
    await settleIsoPaint(page);
  }
  const exact = await stage.locator('.iso-scene-surface').evaluate(surface => {
    const card = window.__isoPaint, style = getComputedStyle(surface);
    const { x, y, w, h } = card._viewOr(card._baseVb());
    const box = surface.querySelector('svg').viewBox.baseVal;
    return card._zoom >= 5 && style.transform === 'none' && style.willChange === 'opacity' &&
      Math.abs(box.x - x) < 1e-4 && Math.abs(box.y - y) < 1e-4 &&
      Math.abs(box.width - w) < 1e-4 && Math.abs(box.height - h) < 1e-4;
  });
  check('a large zoom round trip restores the exact SVG without the scaling hint', exact);
  await stage.locator('.hp-iso-raster').first().waitFor({ state: 'detached' });
  check('a settled large zoom shows no bitmap', await stage.locator('.hp-iso-raster').count(), 0);
}
