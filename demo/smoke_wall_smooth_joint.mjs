/** #1076: inspect the painted stroke, not just union area or path counts. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch, finish, requirePinnedBrowser } from './serve.mjs';
import { installHpTestOnPage } from './helpers/hp-test.mjs';
import { smoothWallSeamSpace } from './fixtures/smooth-wall-seam.mjs';

requirePinnedBrowser('smoke_wall_smooth_joint');
const dir = new URL('../artifacts/wall-smooth-joint/', import.meta.url);
mkdirSync(dir, { recursive: true });
const { page, browser } = await launch({ width: 1500, height: 1200 }, Number(process.env.HP_JOINT_DPR || 1));
const evidence = { oldSource: '4b65ba2e1', oldInteriorStroke: true, checks: [] };
try {
  const seed = async () => {
    await page.evaluate(async space => {
      await window.__hpTest.setServerConfig(cfg => ({ ...cfg, spaces: [space], markers: [],
        settings: { ...cfg.settings, filter_seeded: true } }));
      await window.__hpTest.setLayout(() => ({}));
      await window.__hpTest.setMode('view');
      await window.__hpTest.settled();
    }, smoothWallSeamSpace());
    await page.locator('houseplan-card [data-hp="zoom-fit"]').click();
    await page.evaluate(() => window.__hpTest.settled());
  };
  const stored = () => page.evaluate(() => JSON.stringify({
    config: window.__card._serverCfg, layout: window.__card._layout,
    configRev: window.__card._cfgRev, layoutRev: window.__card._layoutRev,
  }));
  const inspect = async name => {
    const state = await page.evaluate(() => {
      const root = window.__card.renderRoot;
      const paths = [...root.querySelectorAll('.wallbody[data-component]')];
      const sample = new DOMPoint((-109.68680625120072 - 79.16666666666667) / 2,
        (523.3810973752643 + 516.6666666666667) / 2);
      const freeCap = new DOMPoint(-100, 141.66666666666666);
      const outside = new DOMPoint(-160, 141.66666666666666);
      const matrix = paths[0]?.getScreenCTM();
      const point = matrix && sample.matrixTransform(matrix);
      return {
        paths: paths.length,
        interiorStroke: paths.some(path => path.isPointInStroke(sample)),
        solid: paths.some(path => path.isPointInFill(sample)),
        freeCap: paths.some(path => path.isPointInStroke(freeCap)),
        outside: paths.some(path => path.isPointInFill(outside)),
        screen: point && { x: point.x, y: point.y }, dpr: devicePixelRatio,
      };
    });
    assert.ok(state.paths > 0, `${name}: real wall paths exist`);
    assert.equal(state.interiorStroke, false, `${name}: no internal painted seam`);
    assert.equal(state.solid, true, `${name}: wall remains solid`);
    assert.equal(state.freeCap, true, `${name}: genuine free cap still paints`);
    assert.equal(state.outside, false, `${name}: no extra masonry`);
    evidence.checks.push({ name, ...state });
    return state;
  };
  await seed();
  const before = await stored();
  const beforeGeometry = JSON.parse(before);
  const fit = await inspect('view-fit');
  await page.screenshot({ path: new URL('view-fit.png', dir).pathname });
  await page.mouse.move(fit.screen.x, fit.screen.y);
  await page.mouse.wheel(0, -480);
  await page.evaluate(() => window.__hpTest.settled());
  await inspect('view-zoom');
  await page.screenshot({ path: new URL('view-zoom.png', dir).pathname });
  await page.mouse.move(500, 700);
  await page.mouse.down();
  await page.mouse.move(590, 750, { steps: 8 });
  await page.mouse.up();
  await page.evaluate(() => window.__hpTest.settled());
  await inspect('view-pan');
  await page.evaluate(() => window.__hpTest.setMode('plan'));
  await inspect('editor');
  await page.evaluate(() => window.__hpTest.setMode('view'));
  assert.equal(await stored(), before, 'view/editor/zoom/pan do not write plan or revisions');
  await page.evaluate(async () => { await window.__hpTest.setVolumetricView(true); });
  await page.waitForFunction(() => window.__card.renderRoot.querySelector('.iso-wall-top'));
  const iso = await page.evaluate(() => [...window.__card.renderRoot.querySelectorAll('.iso-wall-top')]
    .map(path => path.getAttribute('d')));
  assert.ok(iso.length > 0);
  assert.ok(iso.every(d => (d.match(/M /g) || []).length === 1), 'iso has no numeric hole');
  await page.screenshot({ path: new URL('iso.png', dir).pathname });
  await page.evaluate(() => window.__hpTest.setVolumetricView(false));
  const afterIso = JSON.parse(await stored());
  // The explicit global 2.5D preference command writes its own setting/revision.
  // Rendering that choice must still leave every plan record and layout intact.
  assert.deepEqual(afterIso.config.spaces, beforeGeometry.config.spaces);
  assert.deepEqual(afterIso.config.markers, beforeGeometry.config.markers);
  assert.deepEqual(afterIso.layout, beforeGeometry.layout);
  assert.equal(afterIso.layoutRev, beforeGeometry.layoutRev);
  await page.reload();
  await page.waitForFunction(() => window.__card?._model?.length > 0 && !window.__card._booting);
  await installHpTestOnPage(page);
  await seed();
  await inspect('reloaded-same-config');
  evidence.completed = true;
  console.log(JSON.stringify(evidence));
} finally {
  writeFileSync(new URL('evidence.json', dir), JSON.stringify(evidence, null, 2));
  await finish(browser);
}
