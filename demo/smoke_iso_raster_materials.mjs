// #1486: an unrelated HA/Web Awesome custom property must not consume the
// following material declarations when the SVG image reparses its style.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { finish } from './serve.mjs';
import { startIsoPaintScene, settleIsoPaint, zoomIsoPaint } from './helpers/iso-paint-scene.mjs';

const { PNG } = createRequire(import.meta.url)('playwright-core/lib/utilsBundle');
const brokenThemeValue = '12px@layer wa-utilities{@supports (scrollbar-gutter:';
const results = [];
for (const translucent of [false, true]) {
  const sideAlpha = translucent ? .45 : 1, topAlpha = translucent ? .6 : 1;
  const { page, browser } = await startIsoPaintScene({
    width: 1920, height: 1080, dpr: 2,
    configureFixture({ config }) {
      Object.assign(config.spaces[0].settings, {
        room_color: '#481477', room_opacity: topAlpha,
        wall_fill: { c: '#246844', a: sideAlpha },
        opening_accent_3d: { c: '#a32a59', a: 1 },
      });
    },
  });
  try {
    await page.evaluate(value => {
      document.documentElement.style.setProperty('--wa-form-control-padding-inline', value);
      document.documentElement.style.setProperty('--hp-inline-fixture', '#17a2b8');
      window.__rasterMaterialSources = [];
      const create = URL.createObjectURL;
      URL.createObjectURL = function(blob) {
        if (blob.type.includes('image/svg+xml')) {
          void blob.text().then(text => window.__rasterMaterialSources.push(text));
        }
        return create.call(this, blob);
      };
    }, brokenThemeValue);
    await page.evaluate(async dark => {
      const card = window.__isoPaint;
      card.hass = { ...card.hass, themes: { darkMode: dark } };
      await card.updateComplete;
    }, translucent);
    if (translucent) {
      await page.locator('[data-hp="mode-tab"][data-mode="plan"]').click();
      await page.waitForFunction(() => window.__isoPaint._mode === 'plan' && !window.__isoPaint._modeTransitionBusy);
      await page.locator('[data-hp="editor-close"]').first().click();
      await page.waitForFunction(() => window.__isoPaint._mode === 'view' && !window.__isoPaint._modeTransitionBusy);
    }
    await zoomIsoPaint(page, 1.2);
    const stage = page.locator('houseplan-card .stage');
    const expected = await stage.evaluate(el => {
      const svg = el.querySelector('.iso-scene-surface > svg'), computed = getComputedStyle(svg);
      const broken = computed.getPropertyValue('--wa-form-control-padding-inline');
      assertThemeRoundTrip();
      function assertThemeRoundTrip() {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.style.setProperty('--wa-form-control-padding-inline', broken);
        g.style.setProperty('--hp-sentinel', '1');
        const parsed = new DOMParser().parseFromString(new XMLSerializer().serializeToString(g), 'image/svg+xml');
        if (!broken || parsed.documentElement.style.getPropertyValue('--hp-sentinel')) {
          throw Error('Negative control must reproduce the real HA token swallowing the next declaration');
        }
      }
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      for (const [name, value] of Object.entries({ x: '500', y: '500', width: '20', height: '20', fill: 'var(--hp-inline-fixture)' })) {
        rect.setAttribute(name, value);
      }
      svg.append(rect);
      // The new SVG attribute dependency must be present in the next snapshot.
      el.style.setProperty('--hp-raster-fixture-revision', '1');
      window.__isoPaint.requestUpdate();
      return Object.fromEntries([...el.style].filter(name => name.startsWith('--iso-'))
        .map(name => [name, computed.getPropertyValue(name)]));
    });
    await settleIsoPaint(page);
    const during = await stage.evaluate(async (el, zoomIn) => {
      const box = el.getBoundingClientRect(), deadline = performance.now() + 5000;
      while (performance.now() < deadline) {
        el.dispatchEvent(new WheelEvent('wheel', {
          clientX: box.x + box.width / 2, clientY: box.y + box.height / 2,
          deltaY: zoomIn ? -80 : 80, bubbles: true, cancelable: true,
        }));
        await new Promise(resolve => setTimeout(resolve, 70));
        const canvas = el.querySelector('.hp-iso-raster[data-hp-iso-raster="active"]');
        if (!canvas || !el.querySelector('.iso-scene-surface[data-hp-raster-display]')) continue;
        const copy = document.createElement('canvas');
        copy.width = canvas.width; copy.height = canvas.height;
        copy.getContext('2d').drawImage(canvas, 0, 0);
        const xml = window.__rasterMaterialSources.at(-1);
        const parsed = new DOMParser().parseFromString(xml, 'image/svg+xml');
        const style = parsed.querySelector('g.stage').style;
        return { png: copy.toDataURL(), values: Object.fromEntries([...style].map(name => [name, style.getPropertyValue(name)])) };
      }
      throw Error('The poisoned HA theme must exercise an active raster, not a vector fallback');
    }, translucent);
    for (const [name, value] of Object.entries(expected)) {
      assert.equal(during.values[name], value, 'Raster image must retain ' + name);
    }
    assert.equal(during.values['--hp-inline-fixture'], '#17a2b8', 'SVG attribute var() dependencies must be captured');
    assert.equal(during.values['--wa-form-control-padding-inline'], undefined, 'Unused HA tokens must stay outside the image');
    const pixels = PNG.sync.read(Buffer.from(during.png.split(',')[1], 'base64')).data;
    let side = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (Math.abs(pixels[i + 3] - Math.round(sideAlpha * 255)) <= 1 &&
          [36, 104, 68].every((channel, c) => Math.abs(channel - pixels[i + c]) <= 9)) side++;
    }
    assert(side > 30, 'The actual cached exterior wall must retain its colour and alpha');
    await stage.locator('.hp-iso-raster').waitFor({ state: 'detached' });
    await settleIsoPaint(page);
    assert.equal(await stage.evaluate(el => getComputedStyle(el.querySelector('.iso-wall-side-fill')).opacity), String(sideAlpha));
    assert.deepEqual(await page.evaluate(() => window.__isoPaintWrites), [], 'Paint must not write to HA');
    results.push({ translucent, sourceMaterials: Object.keys(expected).length, cachedWallPixels: side });
  } finally { await browser.close(); }
}
await finish(undefined, { rasterMaterials: results });
