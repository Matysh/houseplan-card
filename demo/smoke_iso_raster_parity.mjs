// #1485 AC8 compares a native-density raster with the vector at the same camera.
import { createRequire } from 'node:module';
import { check, finish } from './serve.mjs';
import { settleIsoPaint, startIsoPaintScene } from './helpers/iso-paint-scene.mjs';

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
try {
  await waitReady();
  for (const dark of [true, false]) {
    for (const light of ['off', 'on']) {
      let before = await ready();
      await setLightAndTheme(light, dark);
      await settleIsoPaint(page);
      await waitReady(before);
      for (const rotation of [0, 90, 180, 270]) {
        const baseline = PNG.sync.read(await stage.screenshot());
        await page.evaluate(() => {
          const card = window.__isoPaint;
          card._liveIsoRasterInput = () => 'wheel';
          card._liveVp(true);
        });
        await stage.locator('.hp-iso-gesture-image').waitFor({ state: 'attached' });
        const active = PNG.sync.read(await stage.screenshot());
        await page.evaluate(() => {
          const card = window.__isoPaint;
          delete card._liveIsoRasterInput;
          card._liveVp(true);
        });
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
} finally {
  await finish(browser);
}
