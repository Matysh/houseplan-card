// #1485: the same camera and HA state must produce the same visible frame
// during interaction and after settling, in every 3D preset. #1514 renders
// both frames through the same GPU scene.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { settleIsoPaint, startIsoPaintScene, zoomIsoPaint } from './helpers/iso-paint-scene.mjs';
import { reportPageErrors } from './serve.mjs';

const { PNG } = createRequire(import.meta.url)('playwright-core/lib/utilsBundle');
const { browser, page } = await startIsoPaintScene({
  width: 1000, height: 760,
  configureFixture({ config }) {
    config.settings.glow_enabled = true;
    config.spaces[0].settings.glow_enabled = true;
  },
});

try {
  const card = page.locator('houseplan-card');
  const canvas = card.locator('canvas[data-hp-plan-3d-ready]');
  await canvas.waitFor({ state: 'attached' });
  const frame = async () => PNG.sync.read(await canvas.screenshot());
  const difference = (a, b) => {
    assert.equal(a.width, b.width);
    assert.equal(a.height, b.height);
    let pixels = 0;
    for (let i = 0; i < a.data.length; i += 4) {
      if ([0, 1, 2].some(channel => Math.abs(a.data[i + channel] - b.data[i + channel]) > 8)) pixels++;
    }
    return pixels / (a.width * a.height);
  };
  for (const darkMode of [false, true]) {
    const control = new Map();
    for (const state of ['off', 'on']) {
      await card.evaluate((node, { darkMode, state }) => {
        const { hass } = node;
        node.hass = {
          ...hass, themes: { ...hass.themes, darkMode },
          states: Object.fromEntries(Object.entries(hass.states).map(([id, value]) => [
            id, id.startsWith('light.') ? { ...value, state } : value,
          ])),
        };
      }, { darkMode, state });
      await settleIsoPaint(page);
      const stateDiff = [];
      for (const angle of [0, 45, 90, 135, 180, 225, 270, 315]) {
        assert.equal(await card.evaluate(node => node._rotation), angle);
        const baseline = await frame();
        if (state === 'off') control.set(angle, baseline);
        else stateDiff.push(difference(baseline, control.get(angle)));
        const prepare = await card.evaluate(async node => {
          const world = node._plan3dHost.world;
          const geometry = world.structure.children[0].geometry;
          const lightCount = node._plan3dPresentation.world.lights.length;
          node._liveVp(true);
          await new Promise(resolve => requestAnimationFrame(resolve));
          return { sameGeometry: world.structure.children[0].geometry === geometry, lightCount };
        });
        assert.ok(prepare.sameGeometry, 'Repainting the camera must keep the resident wall and floor meshes');
        if (state === 'on') assert.ok(prepare.lightCount > 0, 'Enabled fixtures reach the GPU light field');
        const ratio = difference(baseline, await frame());
        assert.ok(ratio <= .005, `Movement and settled state have the same paint at ${angle}° (${ratio})`);
        await card.locator('[data-hp="rotate-right"]').click();
        await settleIsoPaint(page);
      }
      if (state === 'on') assert.ok(Math.max(...stateDiff) > .025, 'Light changes must be visible in the painted frame');
    }
  }
  await zoomIsoPaint(page, 4);
  assert.equal(await canvas.count(), 1);
  if (await reportPageErrors()) throw new Error('Uncaught browser exception in the 3D motion scene');
  console.log('OK: 32 live 3D comparisons between interaction and settled paint');
} finally {
  await browser.close();
}

// Exercise the installed integration to the light shader. The scene-level
// GPU smoke separately checks individual sun and lamp fades and occlusion.
async function solarFrame(enabled) {
  const scene = await startIsoPaintScene({
    width: 1000, height: 760,
    configureFixture({ config, states }) {
      Object.assign(config.settings, { sun_rays: enabled, north_deg: 0, bg_mode: 'solid', bg_color: '#17242e' });
      Object.assign(config.spaces[0].settings, { fill_mode: 'custom', custom_fill: { c: '#263e52', a: 1 } });
      states['sun.sun'] = { entity_id: 'sun.sun', state: 'above_horizon',
        attributes: { azimuth: 0, elevation: 28 } };
    },
  });
  try {
    const card = scene.page.locator('houseplan-card');
    const canvas = card.locator('canvas[data-hp-plan-3d-ready]');
    await canvas.waitFor({ state: 'attached' });
    await scene.page.waitForFunction(() => window.__isoPaint._plan3dHost.world.furniture.children.length > 0);
    await settleIsoPaint(scene.page);
    const solar = await card.evaluate(node => node._plan3dPresentation.world.lights.filter(light => light.sun));
    if (enabled) assert.ok(solar.some(light => light.intensity > 0 && light.visible.length > 0));
    else assert.equal(solar.length, 0);
    const frame = PNG.sync.read(await canvas.screenshot());
    if (await reportPageErrors()) throw new Error('Uncaught browser exception in the solar scene');
    return frame;
  } finally {
    await scene.browser.close();
  }
}

const daylight = await solarFrame(true);
const control = await solarFrame(false);
let litArea = 0;
for (let offset = 0; offset < daylight.data.length; offset += 4) {
  const difference = [0, 1, 2].reduce((sum, channel) => sum + daylight.data[offset + channel] - control.data[offset + channel], 0);
  if (difference >= 18) litArea++;
}
assert.ok(litArea > 1000, `Sun must illuminate a visible area of the real frame (${litArea} pixels)`);
console.log(`OK: visible sunlight on ${litArea} pixels of the production 3D scene`);
