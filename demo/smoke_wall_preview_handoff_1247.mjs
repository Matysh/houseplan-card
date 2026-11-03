import assert from 'node:assert/strict';
import { launch, finish } from './serve.mjs';
import { installWallDrawClickHarness, resetWallDrawClickHarness } from './wall-draw-click-harness.mjs';
import { makeWallDrawClickFixture } from './fixtures/wall-draw-click.mjs';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';

const { page, browser } = await launch({ width: 1440, height: 900 });
try {
  await installWallDrawClickHarness(page);
  for (const cm of [15, 0]) {
    await resetWallDrawClickHarness(page);
    await page.evaluate(async ({ config, cm }) => {
      const c = window.__card;
      c._serverCfg = config; c._cfgEpoch++; c._modelCache = null;
      c._drawWallField = String(cm); c.requestUpdate(); await c.updateComplete;
    }, { config: commitWallSegmentModel(makeWallDrawClickFixture()).config, cm });
    const screen = async point => page.evaluate(point => {
      const c = window.__card, rect = c.shadowRoot.querySelector('.stage').getBoundingClientRect(), v = c._viewOr(c._baseVb());
      return { x: rect.left + (point[0] - v.x) / v.w * rect.width, y: rect.top + (point[1] - v.y) / v.h * rect.height };
    }, point);
    const before = await page.evaluate(() => JSON.stringify(window.__card._serverCfg));
    const anchor = await screen([633.333333, 600]); await page.mouse.click(anchor.x, anchor.y);
    for (const point of [[733.333333, 600], [733.333333, 700], [733.333333, 600]]) {
      const a = await screen(point); await page.mouse.move(a.x, a.y);
      await page.evaluate(async () => { const c = window.__card; c.requestUpdate(); await c.updateComplete; await new Promise(requestAnimationFrame); });
      const b = await screen([point[0] + 50, point[1] + 50]); await page.mouse.move(b.x, b.y);
      await page.waitForFunction(() => {
        const r = window.__card.shadowRoot;
        return !!r.querySelector('[data-hp-live-editor] :is(.drawwall-preview,.drawwall-zero-preview)');
      });
      assert.equal(await page.evaluate(() => {
        const r = window.__card.shadowRoot;
        const old = [...r.querySelectorAll('.hp-plan-only-layer :is(.drawwall-preview,.drawwall-zero-preview,.active-axis,.active-vertex)')];
        return old.length > 0 && old.every(el => getComputedStyle(el).visibility === 'hidden')
          && [...r.querySelectorAll('.wallbodies')].some(el => getComputedStyle(el).visibility !== 'hidden');
      }), true, `thickness ${cm}: only live ink is visible after handoff`);
    }
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__card._path.length === 0);
    assert.equal(await page.evaluate(() => JSON.stringify(window.__card._serverCfg)), before, 'hover never persists extra segments');
    assert.equal(await page.locator('.drawwall-preview,.drawwall-zero-preview,.active-axis').count(), 0);
  }
} finally { await finish(browser); }
