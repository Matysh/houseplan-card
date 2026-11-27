import assert from 'node:assert/strict';
import { startIsoPaintScene, settleIsoPaint } from './helpers/iso-paint-scene.mjs';
import { reportPageErrors } from './serve.mjs';

const assetId = '3'.repeat(64);
const url = '/api/houseplan/content/assets/_/' + assetId + '.png';
const cardWidth = 1050, cardHeight = 800;
const { page, browser } = await startIsoPaintScene({ width: cardWidth, height: cardHeight,
  referenceRoot: process.env.HP_DECOR_DETAIL_REFERENCE,
  initScript: () => {
    const asset = document.createElement('canvas');
    asset.width = asset.height = 1024;
    const cx = asset.getContext('2d');
    // Diagonal edges, transparent margins and fine (4 texel) contrasting bars.
    cx.fillStyle = '#2f2'; cx.beginPath();
    cx.moveTo(72, 224); cx.lineTo(224, 72); cx.lineTo(528, 72); cx.lineTo(528, 224); cx.closePath(); cx.fill();
    for (let x = 128; x < 896; x += 4) {
      cx.fillStyle = x % 8 ? '#e040f0' : '#00e030';
      cx.fillRect(x, 320, 4, 384);
    }
    window.__isoPaintAssetUrls = { ['/api/houseplan/content/assets/_/' + '3'.repeat(64) + '.png']: asset.toDataURL() };
  },
  configureFixture(fixture) {
    const space = fixture.config.spaces[0];
    Object.assign(space, { view_box: [0, 0, 1, 1], cell_cm: 5,
      rooms: [{ id: 'image-room', name: 'Image room', poly: [[.08,.08],[.92,.08],[.92,.92],[.08,.92]] }],
      openings: [], partitions: [], led_strips: [],
      settings: { ...space.settings, show_names: false, glow_enabled: false, sun_rays: false },
      decor: [
        { id: 'fine-image', kind: 'image', asset_id: assetId, x: .41, y: .41, w: .18, h: .18, opacity: .82, angle: 27 },
        { id: 'overlap', kind: 'rect', x: .44, y: .415, w: .05, h: .085, fill: true,
          color: '#ed211b', fill_color: '#ed211b', fill_opacity: 1, opacity: 1, width_cm: 1 },
      ] });
    fixture.decorAssets = [{ asset_id: assetId, name: 'fine.png', mime: 'image/png', width: 1024, height: 1024, bytes: 1, url }];
    fixture.devices = {}; fixture.entities = {}; fixture.states = {};
    fixture.config.markers = []; fixture.layout = {};
  },
});

const zoom = async scale => {
  await page.evaluate(async scale => {
    const card = window.__isoPaint;
    const vector = card._plan3dHost.frame.camera.position.clone().set(500, 0, 500).project(card._plan3dHost.frame.camera);
    const view = card._plan3dHost.crop;
    card._applyView(scale, view.x + (vector.x + 1) * view.w / 2, view.y + (1 - vector.y) * view.h / 2);
    card.requestUpdate(); await card.updateComplete;
  }, scale);
  await settleIsoPaint(page);
};
const inspect = () => page.evaluate(() => {
  const card = window.__isoPaint, host = card._plan3dHost, { world, canvas } = host;
  const { camera } = host.viewport.painted;
  const context = canvas.getContext('2d');
  const turn = 27 * Math.PI / 180, cs = Math.cos(turn), sn = Math.sin(turn);
  function pixel(x, z) {
    const screen = camera.position.clone().set(x, 0, z).project(camera);
    return Array.from(context.getImageData(Math.floor((screen.x + 1) * canvas.width / 2),
      Math.floor((1 - screen.y) * canvas.height / 2), 1, 1).data);
  }
  function chart(x, y) {
    const dx = (x / 1024 - .5) * 180, dz = (y / 1024 - .5) * 180;
    return pixel(500 + dx * cs - dz * sn, 500 + dx * sn + dz * cs);
  }
  let contrast = 0, samples = 0;
  for (let x = 320; x <= 704; x += 8) {
    const green = chart(x + 2, 512), purple = chart(x + 6, 512);
    contrast += green[1] - purple[1]; samples++;
  }
  return { contrast: contrast / samples, overlap: pixel(463, 463), corner: chart(500, 289),
    base: world.floorInkTexture?.uuid, detail: world.floorDetail?.texture.uuid, area: world.floorDetail?.area,
    planes: world.floorInk.children.length, rotation: card._rotation, zoom: card._zoom };
});

async function compareAtMaximumZoom() {
  // Compare the same zoom and camera against the full-floor fallback; delaying
  // the optional refinement is the real behaviour during a camera gesture.
  const initial = await page.evaluate(() => {
    const world = window.__isoPaint._plan3dHost.world;
    window.__scheduleDetail = world.scheduleFloorDetail;
    world.scheduleFloorDetail = () => {};
    return world.floorInkTexture.uuid;
  });
  await zoom(8);
  const loose = await inspect();
  await page.evaluate(() => {
    const card = window.__isoPaint;
    card._plan3dHost.world.scheduleFloorDetail = window.__scheduleDetail ?? (() => {});
    card._plan3dHost.draw(true);
  });
  await page.waitForFunction(() => !!window.__isoPaint._plan3dHost.world.floorDetail,
    null, { timeout: 5000 });
  await settleIsoPaint(page);
  const crisp = await inspect();
  assert.ok(crisp.detail && crisp.planes > 1, JSON.stringify({ loose, crisp }));
  assert.ok(crisp.area.width <= 2048 && crisp.area.height <= 2048);
  assert.equal(loose.base, initial);
  assert.equal(crisp.base, initial, 'sharpening must not replace or hide the complete floor');
  assert.ok(crisp.contrast > 23 && crisp.contrast > loose.contrast + 16, JSON.stringify({ loose, crisp }));
  assert.ok(crisp.overlap[0] > crisp.overlap[1] + 30, JSON.stringify(crisp.overlap));
  assert.ok(loose.corner[3] > 0 && crisp.corner.every((channel, index) => Math.abs(channel - loose.corner[index]) <= 2),
    'transparent margins must not receive a second layer of paint: ' + JSON.stringify({ loose, crisp }));
  await page.evaluate(() => window.__isoPaint._plan3dHost.draw(true));
  await settleIsoPaint(page);
  assert.equal((await inspect()).detail, crisp.detail, 'an unchanged camera must reuse the same detail texture');
  return { loose, crisp };
}

try {
  await page.waitForFunction(() => window.__isoPaint._plan3dHost?.world.floorInkTexture?.image?.naturalWidth > 0);
  await settleIsoPaint(page);
  const first = await compareAtMaximumZoom();
  await zoom(1);
  await page.waitForFunction(() => !window.__isoPaint._plan3dHost.world.floorDetail);
  const previous = first.crisp.rotation;
  await page.locator('houseplan-card [data-hp="rotate-right"]').click();
  await page.waitForFunction(angle => window.__isoPaint._rotation !== angle, previous);
  await settleIsoPaint(page);
  const second = await compareAtMaximumZoom();
  assert.equal(Math.abs(first.crisp.rotation - second.crisp.rotation) % 90, 45);
  assert.deepEqual(await page.evaluate(() => window.__isoPaintWrites), []);
  assert.equal(await reportPageErrors(), false);
  console.log('3D decor real pixels:', JSON.stringify({ first, second }));
} finally {
  await browser.close();
}
