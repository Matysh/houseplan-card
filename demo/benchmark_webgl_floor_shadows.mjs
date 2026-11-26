/** Compare the same settled WebGL camera sequence on two built checkouts:
 * node demo/benchmark_webgl_floor_shadows.mjs BASE CANDIDATE
 */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { launch, reportPageErrors } from './serve.mjs';
import { prepareGoldenScenario } from './golden/harness.mjs';
import { GOLDEN_SCENARIOS } from './golden/matrix.mjs';

const roots = process.argv.slice(2).map(path => resolve(path));
if (!roots.length) roots.push(resolve('.'));
const viewport = { width: 1000, height: 900 };
const oneSource = {
  ...GOLDEN_SCENARIOS.find(item => item.id === 'lighting-opaque-glow-two-doorways-dark'),
  panelHost: true, projection: 'iso', extraOpenings: [], warmPixelRegion: undefined,
  layoutOverrides: { 'golden-light-three': { s: 'golden-lighting', x: .60, y: .54 } },
  stateOverrides: { 'light.golden_light_three': {
    state: 'on', attributes: { rgb_color: [255,196,112], brightness: 255 },
  } },
};
const manySources = {
  id: 'webgl-floor-shadows-large', fixture: 'large', space: 'perf-floor-1', mode: 'view',
  panelHost: true, projection: 'iso', showNames: false, fillMode: 'custom', glowEnabled: true,
  sunRays: false, theme: 'dark', viewport,
};
for (const scenario of [oneSource, manySources]) {
  // Alternate run order to reduce warmup and thermal bias.
  for (const root of [...roots, ...roots.slice().reverse()]) {
    const { page, browser } = await launch(viewport, 1,
      ['--force-color-profile=srgb'], { reducedMotion: 'reduce', colorScheme: 'dark', locale: 'en-US' },
      resolve(root, 'demo/srv'), root);
    try {
      const shaderErrors = [];
      page.on('console', message => {
        if (message.type() === 'error' && /shader|WebGLProgram/i.test(message.text()))
          shaderErrors.push(message.text());
      });
      await prepareGoldenScenario(page, scenario);
      const result = await page.evaluate(async () => {
        const card = window.__goldenCard;
        const host = card._plan3dHost, { viewport, world } = host;
        const { frame } = host, { output } = viewport, { light } = world;
        const gl = output.renderer.getContext();
        const extension = gl.getExtension('WEBGL_debug_renderer_info');
        const adapter = extension && gl.getParameter(extension.UNMASKED_RENDERER_WEBGL);
        const size = viewport.pixelSize();
        const camera = frame.camera.clone();
        const template = frame.camera.projectionMatrix.clone();
        const memory = () => [light.masks, light.wallMasks].reduce((bytes, tex) =>
          bytes + (tex.image.data?.byteLength ?? tex.image.width * tex.image.height * 4), 0);
        const versions = () => [light.masks.version, light.wallMasks.version];
        const quantile = (rows, q) => rows.slice().sort((a, b) => a - b)[Math.ceil(rows.length * q) - 1];
        const draw = i => {
          const zoom = 1 + (i % 12) * 2.5 / 11;
          camera.projectionMatrix.copy(template);
          const e = camera.projectionMatrix.elements;
          for (const col of [0, 4, 8, 12]) { e[col] *= zoom; e[col + 1] *= zoom; }
          e[12] += Math.sin(i * .45) * .18; e[13] += Math.cos(i * .45) * .15;
          const start = performance.now();
          output.draw({ ...frame, camera }, viewport.context, size);
          // Force consumption of the canvas backing store, including the GPU
          // rather than only capturing the time to enqueue draw commands.
          viewport.context.getImageData(0, 0, 1, 1);
          return performance.now() - start;
        };
        for (let i = 0; i < 12; i++) draw(i);
        const before = versions(), samples = Array.from({ length: 36 }, (_, i) => draw(i));
        const after = versions();
        return { adapter, size, lights: light.uniforms.uHpLightCount.value,
          rooms: host.presentation.world.rooms.length,
          bytes: memory(), samples, median: quantile(samples, .5), p95: quantile(samples, .95),
          maskUpdates: after.map((version, i) => version - before[i]) };
      });
      assert.equal(await reportPageErrors(), false, 'the measured browser run has no uncaught errors');
      assert.deepEqual(shaderErrors, [], 'WebGL shader must really render before timing it');
      assert.ok(result.lights >= (scenario === manySources ? 4 : 1), 'case has too few active lights');
      assert.deepEqual(result.maskUpdates, [0, 0], 'camera-only sequence must not rebuild masks');
      console.log(JSON.stringify({ root, scenario: scenario.id, ...result }));
    } finally { await browser.close(); }
  }
}
