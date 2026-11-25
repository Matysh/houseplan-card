import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { rollup } from 'rollup';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { enforcePinnedBrowser, requirePinnedBrowser } from '../scripts/browser-attestation.mjs';

const bundle = await rollup({
  input: {
    engine: 'node_modules/three/build/three.module.js',
    viewport: 'test-build/plan-3d-viewport.js',
    world: 'test-build/plan-3d-world.js',
  },
  plugins: [nodeResolve()],
});

let browser;
try {
  const { output } = await bundle.generate({ format: 'es', entryFileNames: '[name].js' });
  const modules = new Map(output.filter(entry => entry.type === 'chunk').map(entry => ['/' + entry.fileName, entry.code]));
  browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
  if (requirePinnedBrowser()) await enforcePinnedBrowser(browser, chromium);
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.route('http://plan-3d.test/**', async route => {
    const { pathname } = new URL(route.request().url());
    if (pathname === '/') {
      await route.fulfill({ contentType: 'text/html', body: '<!doctype html><style>canvas{width:200px;height:200px}</style>' });
      return;
    }
    const javascript = modules.get(pathname);
    await route.fulfill(javascript ? { contentType: 'text/javascript', body: javascript } : { status: 404 });
  });
  await page.goto('http://plan-3d.test/');
  const evidence = await page.evaluate(async () => {
    const T = await import('http://plan-3d.test/engine.js');
    const { Plan3dViewport } = await import('http://plan-3d.test/viewport.js');
    const { Plan3dWorld } = await import('http://plan-3d.test/world.js');
    const getContext = HTMLCanvasElement.prototype.getContext;
    let contexts = 0;
    let gpu;
    HTMLCanvasElement.prototype.getContext = function (kind, ...options) {
      const context = getContext.call(this, kind, ...options);
      if (context && kind === 'webgl2') { contexts++; gpu = context; }
      return context;
    };

    const cards = Array.from({ length: 6 }, (_, index) => {
      let failures = 0;
      let paint;
      const canvas = document.createElement('canvas');
      document.body.append(canvas);
      const viewport = new Plan3dViewport(canvas, () => failures++, () => paint());
      const camera = new T.OrthographicCamera(-1, 1, 1, -1, .1, 10);
      camera.position.z = 5;
      const scene = new T.Scene();
      const marker = new T.Mesh(new T.PlaneGeometry(2, 2), new T.MeshBasicMaterial({ color: index ? 0x00ff00 : 0xff0000 }));
      marker.userData.plan3dPick = { id: 'card-' + index };
      const wall = new T.Mesh(new T.PlaneGeometry(1, 2), new T.MeshBasicMaterial({ color: 0 }));
      wall.position.set(-.5, 0, 1);
      scene.add(wall, marker);
      const painted = new Promise(resolve => { paint = resolve; viewport.present({ camera, scene }); });
      return { viewport, canvas, painted, failures: () => failures };
    });
    await Promise.all(cards.map(card => card.painted));
    const pixel = (canvas, x, y) => Array.from(canvas.getContext('2d').getImageData(x, y, 1, 1).data);
    const pixels = cards.map(card => pixel(card.canvas, 150, 100));
    const picking = cards.map(card => [card.viewport.pick(.25, .5) ?? null, card.viewport.pick(.75, .5) ?? null]);

    const world = new Plan3dWorld(document, .005);
    const input = {
      physical: { walls: [], floor: [[[[-100, -100], [100, -100], [100, 100], [-100, 100]]]], openings: [], openingSurfaces: [] },
      display: { color: '#888888', opacity: 1, wallFill: { c: '#888888', a: 1 } },
      paper: '#101010', rooms: [], panels: [], furniture: [], cellCm: 5, visualScale: 1, decorWidth: 1000, decorHeight: 1000,
    };
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;top:0;right:0';
    document.body.append(canvas);
    const camera = new T.OrthographicCamera(-100, 100, 100, -100, 1, 300);
    camera.position.y = 150;
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);
    let painted;
    const lit = new Plan3dViewport(canvas, () => { throw new Error('3D lighting view failed'); }, () => painted());
    async function lightFrame(lights) {
      world.present({ ...input, lights });
      await new Promise(resolve => { painted = resolve; lit.present({ scene: world.scene, camera }); });
      return [[102, 100], [98, 100], [124, 100], [133, 100], [122, 135]].map(([x, y]) => pixel(canvas, x, y));
    }
    const visible = ['M 0 -100 H 100 V 100 H 0 Z'];
    const lamp = { points: [[8, 0]], height: 250, radius: 25, color: '#ff0000', intensity: 1, visible };
    const led = { points: [[15, 20], [15, 50]], height: 2, radius: 10, color: '#00ff00', intensity: 1, visible };
    const frames = [await lightFrame([]), await lightFrame([lamp, led]), await lightFrame([{ ...lamp, color: '#0000ff' }, led])];
    const snapshot = await lit.snapshot({ scene: world.scene, camera }, { width: 200, height: 200 });
    if (!snapshot) throw new Error('Static WebP was not encoded');
    const bitmap = await createImageBitmap(snapshot);
    const staticSize = [bitmap.width, bitmap.height];
    bitmap.close();
    lit.dispose();
    world.dispose();

    gpu.getExtension('WEBGL_lose_context').loseContext();
    const deadline = performance.now() + 2000;
    while (cards.some(card => !card.failures()) && performance.now() < deadline)
      await new Promise(resolve => requestAnimationFrame(resolve));
    return { contexts, pixels, picking, frames, staticSize, failures: cards.map(card => card.failures()) };
  });
  assert.deepEqual(errors, []);
  assert.equal(evidence.contexts, 1);
  assert.deepEqual(evidence.picking, Array.from({ length: 6 }, (_, i) => [null, 'card-' + i]));
  assert.deepEqual(evidence.pixels, [[255, 0, 0, 255], ...Array.from({ length: 5 }, () => [0, 255, 0, 255])]);
  assert.deepEqual(evidence.failures, [1, 1, 1, 1, 1, 1]);
  assert.deepEqual(evidence.staticSize, [200, 200]);
  const [unlit, red, blue] = evidence.frames;
  assert.deepEqual(red[1], unlit[1], 'the optical mask keeps the adjacent room dark');
  assert.ok(red[2][0] > 100, 'a short radius still reaches the floor below a high lamp');
  assert.deepEqual(red[3], unlit[3], 'the saved radius bounds the floor footprint');
  assert.ok(red[4][1] > 100, 'the LED lights the floor along its path');
  assert.ok(blue[0][2] > 160 && blue[0][0] === unlit[0][0], 'changing the state recolors the lit area');
  console.log('OK: shared WebGL2 output, covered device picking, context loss, and world-space lamp/LED light');
} finally {
  await browser?.close();
  await bundle.close();
}
