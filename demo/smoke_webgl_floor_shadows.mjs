// Render an actual diagonal doorway shadow. A world-space line at a fixed
// rotation should have a steady sub-pixel contour even after magnification.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { launch, reportPageErrors } from './serve.mjs';
import { prepareGoldenScenario } from './golden/harness.mjs';
import { GOLDEN_SCENARIOS } from './golden/matrix.mjs';

const root = resolve(process.argv[2] ?? '.');
const output = resolve(process.argv[3] ?? 'artifacts/webgl-floor-shadows');
mkdirSync(output, { recursive: true });
const viewport = { width: 1000, height: 900 };
const base = GOLDEN_SCENARIOS.find(scene => scene.id === 'lighting-opaque-glow-two-doorways-dark');
const { page, browser } = await launch(viewport, 1, ['--force-color-profile=srgb'],
  { reducedMotion: 'reduce', colorScheme: 'dark', locale: 'en-US' }, resolve(root, 'demo/srv'), root);
try {
  await prepareGoldenScenario(page, { ...base, panelHost: true, projection: 'iso',
    extraOpenings: [], warmPixelRegion: undefined, zoom: 3.5, zoomCenter: [505, 482],
    layoutOverrides: { 'golden-light-three': { s: 'golden-lighting', x: .60, y: .54 } },
    stateOverrides: { 'light.golden_light_three': {
      state: 'on', attributes: { rgb_color: [255,196,112], brightness: 255 },
    } },
  });
  const settled = () => page.evaluate(() => new Promise(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForFunction(() => {
    const h = window.__goldenCard?._plan3dHost;
    return h?.world.light.uniforms.uHpLightCount.value === 1 && h.viewport.painted === h.viewport.frame;
  });
  await settled();
  const measure = () => page.evaluate(() => {
    const host = window.__goldenCard._plan3dHost;
    const { canvas } = host, { camera } = host.viewport.painted;
    const ctx = canvas.getContext('2d');
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const warm = (x, y) => {
      const at = (y * canvas.width + x) * 4;
      return pixels[at] - pixels[at + 2];
    };
    // The edge runs from the lamp at (600, 540) through the upper jamb
    // of the receiving face of a 25 cm wall centred on x=500. Sample a
    // stretch of that floor edge through the camera which painted it.
    const jambX = 500 - 25 / (2 * 5) * 1000 / 240, jambY = 465;
    const projectEdge = x => {
      const y = 540 + (x - 600) * (jambY - 540) / (jambX - 600);
      const point = camera.position.clone().set(x, 0, y).project(camera);
      return [(point.x + 1) * canvas.width / 2, (1 - point.y) * canvas.height / 2];
    };
    const [x0, y0] = projectEdge(366), [x1, y1] = projectEdge(450);
    const firstRow = Math.ceil(y0);
    if (!(y1 >= firstRow + 63)) throw Error('projected floor shadow does not span 64 rows');
    const edges = [];
    for (let y = firstRow; y < firstRow + 64; y++) {
      const mid = Math.round(x0 + (x1 - x0) * (y - y0) / (y1 - y0));
      const left = mid - 19, right = mid + 19;
      const high = warm(left, y), low = warm(right, y);
      if (high - low < 25) throw Error(`not a high-contrast floor shadow at y=${y}: ${high}, ${low}`);
      const level = low + (high - low) / 2;
      for (let x = left + 1; x <= right; x++) {
        const a = warm(x - 1, y), b = warm(x, y);
        if (b > level || a === b) continue;
        edges.push([x - 1 + (a - level) / (a - b), y]);
        break;
      }
    }
    const avg = axis => edges.reduce((sum, point) => sum + point[axis], 0) / edges.length;
    const x = avg(0), y = avg(1);
    const slope = edges.reduce((sum, [a,b]) => sum + (a-x)*(b-y), 0)
      / edges.reduce((sum, [,b]) => sum + (b-y)**2, 0);
    const rms = Math.sqrt(edges.reduce((sum, [a,b]) => sum + (a-x-slope*(b-y))**2, 0) / edges.length);
    return { count: edges.length, rms, slope };
  });
  const shadow = await measure();
  await page.screenshot({ path: resolve(output, 'floor-350.png') });
  const atlas = () => page.evaluate(() => {
    const { masks, wallMasks } = window.__goldenCard._plan3dHost.world.light;
    return [masks, wallMasks].map(texture => [texture.uuid, texture.version]);
  });
  const initialAtlas = await atlas();
  const max = await page.evaluate(async () => {
    const card = window.__goldenCard, { x, y, w, h } = card._viewOr(card._baseVb());
    card._applyView(8, x + .40 * w, y + .25 * h);
    card.requestUpdate();
    await card.updateComplete;
    return card._zoom;
  });
  await settled();
  await page.screenshot({ path: resolve(output, 'floor-800.png') });
  assert.equal(await reportPageErrors(), false, 'no uncaught errors while rendering the floor shadow');
  assert.deepEqual(await atlas(), initialAtlas, 'real camera zoom does not rebuild either mask texture');
  console.log(JSON.stringify({ ...shadow, max }));
  assert.equal(max, 8, 'exercise the real maximum zoom');
  assert.ok(shadow.count === 64 && shadow.rms < .5, `jagged floor contour: ${JSON.stringify(shadow)}`);
} finally { await browser.close(); }
