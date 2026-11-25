/** #1536: a wall cut clips the device body without taking pixels from LQI. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { check, finish } from './serve.mjs';
import { startIsoPaintScene, settleIsoPaint, zoomIsoPaint } from './helpers/iso-paint-scene.mjs';
import { makeDeviceContactsFixture } from './golden/device-contacts.mjs';
import { compareInPage } from '../scripts/png-identical.mjs';

const { PNG } = createRequire(import.meta.url)('playwright-core/lib/utilsBundle');
const dir = process.env.HP_ISO_SIGNAL_OUTPUT || 'artifacts/1536';
mkdirSync(dir, { recursive: true });
const { page, browser } = await startIsoPaintScene({ configureFixture(fixture) {
  Object.assign(fixture, makeDeviceContactsFixture());
  const space = fixture.config.spaces[0];
  space.rooms = [{ id: 'signal-room', poly: [[.1,.1],[.9,.1],[.9,.52],[.1,.52]] }];
  space.walls = space.rooms[0].poly.map((a, i, poly) => ({ a, b: poly[(i+1)%4], cm: 20 }));
  space.partitions = [];
  space.settings = { ...space.settings, fill_mode: 'custom', custom_fill: { c: '#405c70', a: 1 } };
  const marker = fixture.config.markers[0];
  fixture.config.markers = [2, 3, 4].map(i => {
    const id = 'fixture-leak-' + i;
    const entity = 'binary_sensor.fixture_leak_' + i;
    fixture.devices[id] = { id, name: 'Fictional leak sensor' };
    fixture.entities[entity] = { entity_id: entity, device_id: id };
    fixture.states[entity] = { entity_id: entity, state: 'off', attributes: { device_class: 'moisture', linkquality: 255 } };
    fixture.layout[id] = { s: space.id, x: .2 + i * .1, y: .52 - (.013 + i * .005) };
    return { ...marker, id, binding: 'device:' + id, icon: 'mdi:water-alert', size: 2,
      display: 'icon', value_badge: { enabled: false } };
  });
  fixture.config.settings = { ...fixture.config.settings, volumetric_view: true, filter_seeded: true,
    known_devices: Object.keys(fixture.devices), new_device_ids: [], bg_color: '#303030' };
}});

function signalPixels(buffer, bounds) {
  const png = PNG.sync.read(buffer);
  const pixels = [];
  for (let y = Math.max(0, Math.floor(bounds.y)); y < Math.min(png.height, Math.ceil(bounds.y + bounds.height)); y++) {
    for (let x = Math.max(0, Math.floor(bounds.x)); x < Math.min(png.width, Math.ceil(bounds.x + bounds.width)); x++) {
      const offset = 4 * (y * png.width + x);
      const [r, g, b] = png.data.subarray(offset, offset + 3);
      if (g > r + 28 && g > b + 28) pixels.push(offset);
    }
  }
  return pixels;
}
const observations = [];
try {
  await page.evaluate(async () => {
    const c = window.__isoPaint;
    c.hass = { ...c.hass, themes: { darkMode: true } };
    await c.updateComplete;
  });
  for (const [view, zoom] of [['diagonal', 1], ['straight', 1], ['straight', 2.18]]) {
    if (view === 'straight' && zoom === 1) {
      await page.locator('[data-hp="rotate-left"]').first().click();
      await settleIsoPaint(page);
    }
    await zoomIsoPaint(page, zoom);
    const signals = await page.evaluate(() => {
      const card = window.__isoPaint;
      return [...card.renderRoot.querySelectorAll('.dev[data-id^="fixture-leak-"] .lqi')].map(label => {
        const marker = label.closest('.dev');
        const rect = label.getBoundingClientRect();
        return { id: marker.dataset.id, text: label.textContent.trim(), bounds: rect.toJSON(),
          native: marker.hasAttribute('data-hp-3d-native'),
          insideMask: !!label.closest('.device-occlusion-body') };
      });
    });
    const painted = await page.screenshot();
    const probe = async (depthTest, visible = true) => {
      await page.evaluate(async ({ depthTest, visible }) => {
        const host = window.__isoPaint._plan3dHost;
        const group = host.world.markers.group;
        group.visible = visible;
        group.traverse(node => {
          if (!node.isMesh) return;
          for (const material of [node.material].flat()) material.depthTest = depthTest;
        });
        host.draw();
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }, { depthTest, visible });
      return page.screenshot();
    };
    const unmasked = await probe(false);
    const reference = await probe(true, false);
    await probe(true);

    const label = `${view}/${zoom}`;
    const maskDelta = (await compareInPage(page, painted, unmasked)).differing;
    check(`${label}: wall depth still covers part of the native markers`, signals.every(row => row.native) && maskDelta > 30);
    const readings = signals.map(row => {
      const actual = signalPixels(painted, row.bounds), expected = signalPixels(reference, row.bounds);
      return { ...row, pixels: actual.length, reference: expected.length,
        intact: actual.length === expected.length && actual.every((offset, i) => offset === expected[i]) };
    });
    check(`${label}: visible 255 readings retain their pixels with body depth enabled`,
      readings.length === 3 && readings.every(row => row.text === '255' && !row.insideMask && row.intact)
        && readings.filter(row => row.pixels > 100).length >= 2);
    observations.push({ view, zoom, maskDelta, readings });
    writeFileSync(`${dir}/${view}-${zoom}.png`, painted);
  }
  await page.evaluate(async () => {
    const c = window.__isoPaint;
    c._serverCfg = { ...c._serverCfg, settings: { ...c._serverCfg.settings, volumetric_view: false } };
    await c.updateComplete;
  });
  await settleIsoPaint(page);
  check('Flat retains the same three signal readings', await page.evaluate(() => {
    const root = window.__isoPaint.renderRoot;
    const signals = [...root.querySelectorAll('.dev[data-id^="fixture-leak-"] .lqi')];
    return signals.length === 3 && signals.every(label => label.textContent.trim() === '255')
      && !root.querySelector('.device-occlusion-body') && window.__isoPaintWrites.length === 0;
  }));
  writeFileSync(`${dir}/results.json`, JSON.stringify(observations, null, 2));
} finally { await finish(browser); }
