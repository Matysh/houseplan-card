// #1472: drive the released View over the same synthetic HA config as SVG 2.5D.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { check, finish, launchColdView } from './serve.mjs';
import { clickHeaderAction } from './helpers/header-actions.mjs';

const ready = '[data-hp-real-3d][data-real-3d-ready]';
const { page, browser } = await launchColdView({ width: 1100, height: 780 }, 1,
  ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'], { reducedMotion: 'reduce' });
const layer = page.locator(ready);
const loaded = () => page.evaluate(() => performance.getEntriesByType('resource')
  .filter(item => /\/iso-view-gl-runtime-[^/]+\.js(?:$|\?)/.test(item.name)).length);
const preference = (real, legacy) => page.evaluate(async ({ real, legacy }) => {
  await window.__hpTest.setServerConfig(cfg => {
    cfg.settings = { ...cfg.settings, real_3d: real, volumetric_view: legacy };
    const space = cfg.spaces[0];
    space.settings = { ...space.settings, show_borders: true };
    if (!space.partitions?.some(wall => wall.id === 'real-3d-masonry')) {
      space.partitions = [...(space.partitions || []), { id: 'real-3d-masonry', a: [.18, .22], b: [.75, .22], cm: 15 }];
    }
    return cfg;
  });
}, { real, legacy });
async function exportSvg(flatHint) {
  await clickHeaderAction(page.locator('houseplan-card').first(), 'pdf');
  const dialog = page.locator('hp-pdf-dialog');
  await dialog.locator('[data-field="export-format"]').selectOption('svg');
  check('planar export hint corresponds to the active graphics backend', await dialog.locator('[data-hp="svg-real-3d-hint"]').count(), flatHint ? 1 : 0);
  if (flatHint) await dialog.locator('[data-field="svg-devices"]').check();
  const download = page.waitForEvent('download', { timeout: 8000 });
  await dialog.locator('[data-hp=dialog-confirm]').click();
  try {
    return readFileSync(await (await download).path(), 'utf8');
  } catch (error) {
    console.log('Export dialog:', await dialog.textContent().catch(() => ''));
    throw error;
  }
}
try {
  check('Flat starts without the Real 3D chunk or a context', await loaded(), 0);
  await preference(false, true);
  await page.locator('.plan-svg[data-projection=iso]').first().waitFor({ state: 'attached' });
  check('ordinary 2.5D also skips the Real 3D chunk', await loaded(), 0);
  await preference(true, false);
  await layer.waitFor({ state: 'attached', timeout: 12000 });
  check('WebGL loads on opt-in without requiring 2.5D', await loaded(), 1);
  const frame = await layer.evaluate(element => {
    const canvas = element.querySelector('canvas');
    const gl = canvas?.getContext('webgl2');
    const debug = gl?.getExtension('WEBGL_debug_renderer_info');
    return { width: canvas?.width, height: canvas?.height, renderer: debug && gl.getParameter(debug.UNMASKED_RENDERER_WEBGL),
      svg: element.ownerSVGElement.viewBox.baseVal.width, widthUnits: +element.getAttribute('width'),
      triangles: window.__card._real3d.renderer.info.render.triangles };
  });
  console.log('Renderer:', frame);
  check('first WebGL frame has a nonempty buffer at the current SVG viewport', !!frame.renderer
    && frame.width > 0 && frame.height > 0 && frame.svg === frame.widthUnits && frame.triangles > 0);
  check('plan devices still use native HTML', await page.locator('.devlayer [data-hp=device]').count() > 0);
  const stage = page.locator('houseplan-card .stage').first();
  const box = await stage.boundingBox();
  const before = Number(await layer.getAttribute('data-real3d-frames'));
  await page.mouse.move(box.x + box.width * .40, box.y + box.height * .45);
  await page.mouse.wheel(0, -150);
  await page.waitForFunction(n => Number(window.__card.renderRoot.querySelector('[data-real-3d-ready]')
    ?.getAttribute('data-real3d-frames')) > n, before);
  for (const rotation of [90, 180, 270, 0]) {
    await page.locator('[data-hp="rotate-right"]').first().click();
    await page.waitForFunction(turn => {
      const root = window.__card.renderRoot, node = root.querySelector('[data-real-3d-ready]');
      return node && node.ownerSVGElement.dataset.rotation === String(turn)
        && +node.getAttribute('width') === node.ownerSVGElement.viewBox.baseVal.width;
    }, rotation);
  }
  check('four rotations and live zoom retain the GPU frame and the same viewport', true);
  const beforeIdle = await layer.getAttribute('data-real3d-frames');
  await page.evaluate(() => window.__hpTest.settled());
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  check('no perpetual GPU animation loop', await layer.getAttribute('data-real3d-frames'), beforeIdle);
  const beforeExport = await page.evaluate(() => JSON.stringify({
    view: window.__card._view, settings: window.__card._serverCfg.settings,
  }));
  const flatSvg = await exportSvg(true);
  const exported = await page.evaluate(text => {
    const parsed = new DOMParser().parseFromString(text, 'image/svg+xml');
    return { flatWalls: parsed.querySelectorAll('.wallbody-fill').length, devices: parsed.querySelectorAll('.dev').length,
      isoWalls: parsed.querySelectorAll('.iso-wall-top').length, canvas: parsed.querySelectorAll('canvas').length };
  }, flatSvg);
  console.log('Flat SVG:', exported);
  check('Real 3D exports native flat geometry and devices without embedding the canvas',
    exported.flatWalls > 0 && exported.devices > 0 && !exported.isoWalls && !exported.canvas);
  check('export leaves plan, camera and the GPU frame unchanged',
    await page.evaluate(() => JSON.stringify({ view: window.__card._view, settings: window.__card._serverCfg.settings })),
    beforeExport);
  await layer.waitFor({ state: 'attached' });
  await layer.evaluate(element => {
    const extension = element.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context');
    if (!extension) throw Error('WEBGL_lose_context not available for failure injection');
    extension.loseContext();
  });
  await layer.waitFor({ state: 'detached' });
  await page.waitForFunction(() => window.__card._renderProjection === 'flat');
  assert.equal(await page.evaluate(() => window.__card._serverCfg.settings.real_3d), true);
  check('context loss falls back to Flat without clearing opt-in', true);
  await preference(false, true);
  await preference(true, true);
  await layer.waitFor({ state: 'attached', timeout: 10000 });
  await layer.evaluate(element => element.querySelector('canvas').getContext('webgl2')
    .getExtension('WEBGL_lose_context').loseContext());
  await layer.waitFor({ state: 'detached' });
  await page.waitForFunction(() => window.__card._renderProjection === 'iso');
  check('with legacy preference enabled, context loss retains SVG 2.5D', true);
  const isoSvg = await exportSvg(false);
  check('SVG after WebGL failure still exports the visible native 2.5D', isoSvg.includes('iso-wall-top') && !isoSvg.includes('<canvas'));

  await preference(false, true);
  await clickHeaderAction(page.locator('houseplan-card').first(), 'settings');
  const settings = page.locator('hp-dialog[data-kind=settings]');
  await settings.locator('button[data-section-target=plan]').click();
  const toggle = settings.locator('#gs-real-3d');
  await toggle.check();
  check('editing the new setting is an ordinary draft',
    await page.evaluate(() => !window.__card._serverCfg.settings.real_3d && !window.__card._real3d));
  await settings.locator('[slot=footer] [data-hp=dialog-cancel]').click();
  const discard = page.locator('hp-confirm hp-dialog [data-hp=dialog-confirm]');
  if (await discard.count()) await discard.click();
  await settings.waitFor({ state: 'detached' });
  check('cancel keeps the installation choices',
    await page.evaluate(() => !window.__card._serverCfg.settings.real_3d && window.__card._serverCfg.settings.volumetric_view));
  await clickHeaderAction(page.locator('houseplan-card').first(), 'settings');
  await settings.locator('button[data-section-target=plan]').click();
  await toggle.check();
  await settings.locator('[data-hp=dialog-confirm]').click();
  await layer.waitFor({ state: 'attached', timeout: 10000 });
  check('save keeps Real 3D and the 2.5D fallback independent',
    await page.evaluate(() => window.__card._serverCfg.settings.real_3d && window.__card._serverCfg.settings.volumetric_view));
  await page.locator('[data-hp="mode-tab"][data-mode="plan"]').first().click();
  await page.waitForFunction(() => window.__card._mode === 'plan'
    && !window.__card._modeTransitionBusy && !window.__card._real3d);
  await layer.waitFor({ state: 'detached' });
  check('editor View does not own a GPU context', await page.evaluate(() => window.__card._renderProjection), 'flat');
  await page.locator('[data-hp="editor-close"]').first().click();
  await layer.waitFor({ state: 'attached', timeout: 10000 });
  check('leaving the editor returns to the saved Real 3D view', true);
} finally {
  await finish(browser);
}
