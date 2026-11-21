// Addressed #1472 diagnostic: identical synthetic inputs, no golden acceptance.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { startIsoPaintScene, settleIsoPaint, zoomIsoPaint } from './helpers/iso-paint-scene.mjs';
import { reportPageErrors } from './serve.mjs';

const [referenceArg, outputArg] = process.argv.slice(2);
if (!referenceArg || !outputArg) throw Error('usage: node demo/compare-real-3d.mjs BASE_ROOT OUTPUT_DIRECTORY');
const output = resolve(outputArg), referenceRoot = resolve(referenceArg);
mkdirSync(output, { recursive: true });
const hardware = process.env.HP_REAL_3D_GPU === 'hardware';
const browserArgs = hardware ? ['--enable-gpu', '--use-angle=d3d11', '--disable-software-rasterizer']
  : ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'];
const report = { backendClass: hardware ? 'hardware' : 'software', input: 'iso-paint fixture (8 rooms, 15 openings, 15 furniture objects, 74 devices)',
  reference: '3c82c0f1801173caa5aa6a5a7cfe19445c746305', frames: [], timings: {} };
const waitReady = (page, real3d) => page.waitForFunction(real => {
  const card = window.__isoPaint;
  return !card._booting && !card._floorPreparation?.pending && (!real ||
    card.renderRoot.querySelector('[data-hp-real-3d][data-real-3d-ready]'));
}, real3d);

for (const real3d of [false, true]) {
  const mode = real3d ? 'real-3d' : '2.5d';
  const started = performance.now();
  const env = await startIsoPaintScene({ referenceRoot: real3d ? undefined : referenceRoot, browserArgs,
    configureFixture({ config }) {
      config.settings.real_3d = real3d || undefined;
      const settings = config.spaces[0].settings;
      Object.assign(settings, { show_borders: true, show_names: true, opening_accent_3d: { c: '#bdb3a9', a: .55 } });
    },
  });
  try {
    const { page } = env;
    await waitReady(page, real3d);
    const readyMs = performance.now() - started;
    const stage = page.locator('houseplan-card .stage');
    let turn = 0;
    for (const dark of [false, true]) {
      await page.evaluate(dark => { const c = window.__isoPaint; c.hass = { ...c.hass, themes: { darkMode: dark } }; }, dark);
      for (let i = 0; i < 4; i++) {
        await settleIsoPaint(page);
        await waitReady(page, real3d);
        const state = await stage.evaluate(el => {
          const canvas = el.querySelector('[data-hp-real-3d] canvas');
          const gl = canvas?.getContext('webgl2'), debug = gl?.getExtension('WEBGL_debug_renderer_info');
          const card = window.__isoPaint, plan = el.querySelector('.plan-svg');
          return { turn: Number(el.dataset.hpPlanRotation), viewBox: plan?.getAttribute('viewBox'), devices: el.querySelectorAll('.dev[data-hp=device]').length,
            openings: card._openingsR.length, triangles: card._real3d?.renderer.info.render.triangles ?? 0,
            renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null };
        });
        assert.equal(state.turn, turn);
        if (real3d) assert.ok(state.triangles > 300 && state.renderer, 'a substantive WebGL frame');
        if (real3d && hardware) assert.doesNotMatch(state.renderer, /swiftshader|llvmpipe|software/i);
        const filename = `${mode}-${dark ? 'dark' : 'light'}-${turn}.png`;
        await stage.screenshot({ path: join(output, filename), animations: 'disabled' });
        report.frames.push({ mode, theme: dark ? 'dark' : 'light', filename, ...state });
        await page.locator('[data-hp="rotate-right"]').first().click();
        turn = (turn + 90) % 360;
        await page.waitForFunction(n => window.__isoPaint._rotation === n, turn);
      }
    }
    const batches = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      await zoomIsoPaint(page, 1.55);
      const box = await stage.boundingBox(), y = box.y + box.height * .67, x = box.x + box.width * .65;
      const start = performance.now();
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x - 160, y - 55, { steps: 36 });
      await page.mouse.up();
      await settleIsoPaint(page);
      batches.push(Math.round(performance.now() - start));
    }
    report.timings[mode] = { startIncludingBrowserMs: Math.round(readyMs), pointerSeriesMs: batches, ...env.provenance };
    assert.deepEqual(await page.evaluate(() => window.__isoPaintWrites), []);
    await reportPageErrors();
  } finally {
    await env.browser.close();
  }
}
writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ frames: report.frames.length, timings: report.timings, output }, null, 2));
