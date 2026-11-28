import assert from 'node:assert/strict';
import { startIsoPaintScene } from './helpers/iso-paint-scene.mjs';
import { reportPageErrors } from './serve.mjs';

let releaseCatalogue;
const catalogueGate = new Promise(resolve => { releaseCatalogue = resolve; });
let sawCatalogue = false;
const scene = startIsoPaintScene({
  width: 1080, height: 800,
  referenceRoot: process.env.HP_FURNITURE_INK_REFERENCE,
  async beforeFixture(page) {
    await page.route(/\/furniture-volume\.generated[^/]*\.js(?:\?|$)/, async route => {
      sawCatalogue = true;
      await catalogueGate;
      await route.fallback();
    });
    // Keep the production import pending until the card can start its
    // independent floor capture. Always release the route on failure.
    const gate = (async () => {
      try {
        await page.waitForFunction(() => {
          const world = window.__isoPaint?._plan3dHost?.world;
          return world?.floorInkLoading || world?.floorInkTexture;
        }, null, { timeout: 4000 });
      } finally {
        releaseCatalogue();
      }
    })();
    void gate.catch(() => {});
  },
  configureFixture(fixture) {
    const space = fixture.config.spaces[0];
    Object.assign(space, {
      view_box: [0, 0, 1, 1], cell_cm: 5,
      rooms: [{ id: 'ink-room', name: 'Ink room', poly: [[.08,.08],[.92,.08],[.92,.92],[.08,.92]] }],
      openings: [], partitions: [], led_strips: [],
      settings: { ...space.settings, show_names: false, glow_enabled: false, sun_rays: false },
      decor: [
        { id: 'ink-sofa', kind: 'furniture', symbol: 'sofa', x: .68, y: .66, w: .18, h: .13,
          color: '#ff0033', opacity: 1, width_cm: 2 },
        { id: 'ink-line', kind: 'line', x: .18, y: .34, x2: .5, y2: .34,
          color: '#ff0033', opacity: 1, width_cm: 2 },
      ],
    });
    fixture.devices = {}; fixture.entities = {}; fixture.states = {};
    fixture.config.markers = []; fixture.layout = {};
  },
});

const { browser, page } = await scene;
try {
  assert.ok(sawCatalogue, 'the WebGL furniture catalogue must be loaded during this fixture');
  await page.waitForFunction(() => {
    const host = window.__isoPaint?._plan3dHost, world = host?.world;
    return host?.viewport.painted && world?.floorInkTexture?.image?.naturalWidth > 0
      && world.furniture.children.some(mesh => mesh.name.startsWith('furniture:ink-sofa:'));
  }, null, { timeout: 10000 });
  const evidence = await page.evaluate(() => {
    const host = window.__isoPaint._plan3dHost, { world } = host;
    const { image } = world.floorInkTexture, { bounds } = host.presentation.world.floorInk;
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let sofaInk = 0, otherInk = 0;
    for (let y = 0, offset = 0; y < canvas.height; y++) {
      const planY = bounds.y + y * bounds.h / canvas.height;
      for (let x = 0; x < canvas.width; x++, offset += 4) {
        if (data[offset] < 180 || data[offset + 1] > 70 || data[offset + 2] > 110 || data[offset + 3] < 128) continue;
        const planX = bounds.x + x * bounds.w / canvas.width;
        if (planX > 570 && planX < 885 && planY > 575 && planY < 810) sofaInk++;
        else otherInk++;
      }
    }
    return { sofaInk, otherInk, meshCount: world.furniture.children.filter(mesh =>
      mesh.name.startsWith('furniture:ink-sofa:')).length };
  });
  console.log('Cold WebGL furniture and floor texture:', JSON.stringify(evidence));
  assert.ok(evidence.meshCount > 1 && evidence.otherInk > 50, 'actual sofa geometry and independent floor strokes must survive');
  assert.equal(evidence.sofaInk, 0, 'the sofa must not also be baked into the floor texture');
  assert.deepEqual(await page.evaluate(() => window.__isoPaintWrites), []);
  assert.equal(await reportPageErrors(), false);
} finally {
  releaseCatalogue();
  await browser.close();
}
