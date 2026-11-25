// Configured wall and opening colours survive theme changes and live 3D zoom.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { settleIsoPaint, startIsoPaintScene, zoomIsoPaint } from './helpers/iso-paint-scene.mjs';

const { PNG } = createRequire(import.meta.url)('playwright-core/lib/utilsBundle');
const opaqueCap = 'b6a1c9';
const { page, browser } = await startIsoPaintScene({
  width: 1040, height: 815,
  configureFixture({ config }) {
    Object.assign(config.spaces[0].settings, {
      room_color: '#481477', room_opacity: .4, wall_fill: { c: '#246844', a: .6 },
      opening_accent_3d: { c: '#a32a59', a: 1 },
    });
  },
});

try {
  const card = page.locator('houseplan-card');
  const stage = card.locator('.stage');
  const canvas = card.locator('canvas[data-hp-plan-3d-ready]');
  await canvas.waitFor({ state: 'attached' });
  await page.waitForFunction(() => window.__isoPaint._plan3dHost?.world.furniture.children.length > 0);
  const snapshot = () => card.evaluate(node => {
    const { structure, openings, furniture } = node._plan3dHost.world;
    const paint = group => group.children.map(mesh => ({
      vertices: mesh.geometry.getAttribute('position').count,
      material: [mesh.material].flat().map(m => ({
        colour: m.color.getHexString(), opacity: m.opacity, depthWrite: m.depthWrite,
      })),
    }));
    return { structure: paint(structure), openings: paint(openings), furniture: paint(furniture) };
  });
  const light = await snapshot();
  const wall = light.structure.find(mesh => mesh.material[0].colour === opaqueCap);
  assert.ok(wall?.vertices > 0, 'Opaque caps use the configured colour over white');
  assert.ok(wall.material.every(material => material.opacity === 1 && material.depthWrite));
  assert.notEqual(wall.material[0].colour, wall.material[1].colour);
  assert.ok(light.openings.length && light.furniture.length, '3D openings and furniture have physical meshes');
  const setTheme = async darkMode => {
    await card.evaluate((node, isDark) => {
      node.hass = { ...node.hass, themes: { ...node.hass.themes, darkMode: isDark } };
    }, darkMode);
    await settleIsoPaint(page);
  };
  await setTheme(true);
  assert.deepEqual(await snapshot(), light, 'Home Assistant theme preserves configured 3D finishes');
  await setTheme(undefined);
  await page.emulateMedia({ colorScheme: 'dark' });
  await settleIsoPaint(page);
  assert.deepEqual(await snapshot(), light, 'The browser colour scheme preserves configured 3D finishes');

  const frame = () => canvas.evaluate(node => node.toDataURL());
  const solidColour = (url, hex) => {
    const { data } = PNG.sync.read(Buffer.from(url.split(',')[1], 'base64'));
    const rgb = [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
    let count = 0;
    for (let offset = 0; offset < data.length; offset += 4) {
      if (data[offset + 3] === 255 && rgb.every((value, i) => Math.abs(data[offset + i] - value) < 4)) count++;
    }
    return count;
  };
  const initial = await frame();
  assert.ok(solidColour(initial, opaqueCap) > 30, 'The caps are painted in the real frame');

  await zoomIsoPaint(page, 1.2);
  assert.notEqual(await frame(), initial);
  const during = await stage.evaluate(async element => {
    const card = window.__isoPaint;
    const { x, y, width, height } = element.getBoundingClientRect();
    element.dispatchEvent(new WheelEvent('wheel', {
      clientX: x + width / 2, clientY: y + height / 2,
      deltaY: -80, bubbles: true, cancelable: true,
    }));
    await new Promise(resolve => requestAnimationFrame(resolve));
    return { active: card._cameraTransition.active, image: element.querySelector('canvas[data-hp-plan-3d-ready]')?.toDataURL() };
  });
  assert.ok(during.active && during.image, 'The live canvas stays mounted through wheel input');
  assert.ok(solidColour(during.image, opaqueCap) > 30, 'Opaque caps remain visible during motion');
  await settleIsoPaint(page);
  assert.ok(solidColour(await frame(), opaqueCap) > 30);
  assert.deepEqual(await snapshot(), light);
  console.log('OK: stable 3D wall, opening and furniture materials across themes and live zoom');
} finally {
  await browser.close();
}
