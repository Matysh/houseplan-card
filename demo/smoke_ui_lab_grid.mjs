// #1081/UI-044: native pan, presented grid-edge pixels and bounded camera paint.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launch, check, finish, requirePinnedBrowser } from './serve.mjs';
const { PNG } = createRequire(import.meta.url)('playwright-core/lib/utilsBundle');
requirePinnedBrowser();
const { page, browser } = await launch({ width: 1400, height: 1000 }, 1, [], { reducedMotion: 'reduce' });
const output = resolve(process.env.HP_1081_GRID_OUTPUT || 'output/ui-lab-1081-grid');
mkdirSync(output, { recursive: true });
const results = [];
try {
  await page.evaluate(async () => {
    await window.__hpTest.setServerConfig(config => ({ ...config, markers: [], settings: { ...config.settings, bg_mode: 'static', bg_color: '#ffffff' },
      spaces: [{ id: 'grid', title: 'Grid', cell_cm: 5, view_box: [0, 0, 1, 1], rooms: [], wall_segments: [], settings: { bg_mode: 'static', bg_color: '#ffffff' } }] }));
  });
  for (const mode of ['plan', 'devices', 'decor']) {
    await page.evaluate(async mode => { await window.__hpTest.setMode(mode); }, mode);
    await page.locator('[data-hp="zoom-fit"]').click();
    await page.evaluate(async () => { await window.__card.updateComplete; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
    const stage = page.locator('houseplan-card .stage');
    const rect = await stage.boundingBox();
    const x = rect.x + rect.width * .35, y = rect.y + rect.height * .6;
    await page.mouse.move(x, y); await page.mouse.down();
    await page.mouse.move(x + rect.width * .22, y + 30, { steps: 8 });
    const geometry = await page.evaluate(() => {
      const c = window.__card, root = c.renderRoot, s = root.querySelector('.stage').getBoundingClientRect();
      const grid = [...root.querySelectorAll('rect[fill="url(#hp-grid-major)"]')].find(el => el.getBoundingClientRect().width > 0);
      const g = grid?.getBoundingClientRect();
      return { fingerprint: globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__, camera: c._view, grid: g && { left: g.left, right: g.right, top: g.top, bottom: g.bottom },
        stage: { left: s.left, right: s.right, top: s.top, bottom: s.bottom },
        covered: !!g && g.left <= s.left + 1 && g.right >= s.right - 1 && g.top <= s.top + 1 && g.bottom >= s.bottom - 1 };
    });
    const bytes = await stage.screenshot({ animations: 'disabled' });
    writeFileSync(resolve(output, `${mode}-pan.png`), bytes);
    const png = PNG.sync.read(bytes);
    let ink = 0, samples = 0;
    for (let py = Math.floor(png.height * .25); py < Math.floor(png.height * .7); py++)
      for (let px = 8; px < 55; px++) {
        const offset = (py * png.width + px) * 4;
        if ([0, 1, 2].some(k => png.data[offset + k] < 240)) ink++;
        samples++;
      }
    const result = { mode, ...geometry, edgeInk: ink, edgeSamples: samples };
    results.push(result); check(`${mode}.live_grid_covers_view`, geometry.covered, true);
    check(`${mode}.presented_edge_contains_grid`, ink > 10, true);
    await page.mouse.up();
    await page.waitForFunction(() => window.__card._pointers.size === 0 && !window.__card._suppressClick);
    await page.evaluate(async () => { await window.__card.updateComplete; await new Promise(resolve => requestAnimationFrame(resolve)); });
    await page.locator('[data-hp="zoom-in"]').click();
    await page.mouse.move(x, y); await page.mouse.down();
    for (const [dx, dy, steps] of [[-120, -25, 1], [120, 35, 20], [-80, 0, 1]]) {
      await page.mouse.move(x + dx, y + dy, { steps });
      check(`${mode}.zoomed_reversed_pan_grid`, await page.evaluate(() => {
        const root = window.__card.renderRoot, s = root.querySelector('.stage').getBoundingClientRect();
        const g = root.querySelector('[data-hp-live-grid]')?.getBoundingClientRect();
        return !!g && g.left <= s.left + 1 && g.right >= s.right - 1 && g.top <= s.top + 1 && g.bottom >= s.bottom - 1;
      }), true);
    }
    await page.mouse.up();
    await page.waitForFunction(() => window.__card._pointers.size === 0 && !window.__card._suppressClick);
    check(`${mode}.released_grid_stays_covered`, await page.locator('[data-hp-live-grid]').count() > 0, true);
  }
  await page.evaluate(() => window.__hpTest.setMode('view'));
  check('view.grid_stays_off', await page.locator('[data-hp-live-grid]').count(), 0);
  writeFileSync(resolve(output, 'receipt.json'), JSON.stringify(results, null, 2));
} finally { await finish(browser, results); }
