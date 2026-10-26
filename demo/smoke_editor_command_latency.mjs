// #1075: native palette placement and ordinary toolbar/keyboard history. The
// fake HA owns storage; counters are read-only observations of real caches.
import assert from 'node:assert/strict';
import { launch, check, finish, requirePinnedBrowser } from './serve.mjs';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';
import { makeLargeHouseFixture } from './fixtures/large-house.mjs';

requirePinnedBrowser();
const { page, browser } = await launch({ width: 1600, height: 1100 });
const card = page.locator('houseplan-card');
const wait = () => page.evaluate(() => window.__hpTest.waitForWrites());
const stored = () => page.evaluate(async () => (await window.__card.hass.callWS({ type: 'houseplan/config/get' })).config);
const observation = () => card.evaluate(c => ({ builds: { ...c._floorCacheBuilds }, history: c._geometryHistory.size,
  physical: [...c.renderRoot.querySelectorAll('[data-hp="wall"],.zero-walls line,.opening')]
    .map(n => [n.tagName, ...['data-id', 'd', 'points', 'x1', 'y1', 'x2', 'y2', 'transform'].map(key => n.getAttribute(key))]) }));
const withoutDecor = config => ({ ...config, spaces: config.spaces.map(({ decor: _decor, ...space }) => space) });
const command = async (direction, keyboard) => {
  await card.locator(`[data-action="geometry-${direction}"]`).evaluate((el, keyboard) => {
    window.editorCommandMeasurement = {};
    const record = () => {
      const m = window.editorCommandMeasurement; m.start = performance.now();
      requestAnimationFrame(() => requestAnimationFrame(() => { m.paint = performance.now(); }));
    };
    // Keyboard owns the same history but does not synthesize a button click.
    if (keyboard) window.addEventListener('keydown', record, { once: true, capture: true });
    else el.addEventListener('click', record, { once: true, capture: true });
  }, keyboard);
  const started = performance.now();
  if (keyboard) await page.keyboard.press(direction === 'undo' ? 'Control+z' : 'Control+Shift+z');
  else await card.locator(`[data-action="geometry-${direction}"]`).click();
  await wait();
  return { ackAndSettleMs: +(performance.now() - started).toFixed(2),
    ...await page.evaluate(() => {
      const m = window.editorCommandMeasurement;
      return { nextFrameMs: +(m.paint - m.start).toFixed(2),
        untilRequestMs: +(m.request - m.start).toFixed(2), wireMs: +(m.reply - m.request).toFixed(2),
        replyToSettledMs: +(performance.now() - m.reply).toFixed(2) };
    }) };
};
try {
  await page.addStyleTag({ content: '#host{width:100%;padding:0;margin:0}' });
  // Public fake-HA wire observer delegates every original result unchanged.
  await card.evaluate(c => {
    const wire = c.hass.callWS.bind(c.hass);
    c.hass.callWS = async message => {
      const m = message.type === 'houseplan/config/set' ? window.editorCommandMeasurement : null;
      if (m) m.request = performance.now();
      const result = await wire(message);
      if (m) m.reply = performance.now();
      return result;
    };
  });
  for (const large of [false, true]) {
    const fixture = commitWallSegmentModel(large ? makeLargeHouseFixture({ includeStairs: false }).config : await stored()).config;
    for (const space of fixture.spaces) space.decor = [];
    await page.evaluate(async fixture => {
      await window.__hpTest.setServerConfig(() => fixture);
      await window.__hpTest.switchSpace(fixture.spaces[0].id);
      await window.__hpTest.setMode('decor');
    }, fixture);
    await card.locator('[data-hp="zoom-fit"]').click();
    await card.locator('[data-hp="tool"][data-tool="furniture"]').click();
    await card.locator('[data-hp="furniture-category"]').first().click();
    await card.locator('[data-hp="furniture-item"]').first().click();
    const point = await card.evaluate(c => {
      const matrix = c.renderRoot.querySelector('.decorlayer').getScreenCTM();
      for (const [x, y] of [[.4, .3], [.2, .15], [.6, .15], [.8, .6]]) {
        const p = new DOMPoint(x * 1000, y * 1000).matrixTransform(matrix);
        const target = c.renderRoot.elementFromPoint(p.x, p.y);
        if (target?.closest('.stage') && !target.closest('.editor-secondary')) return { x: p.x, y: p.y };
      }
      throw Error('No uncovered native placement point');
    });
    await page.mouse.click(point.x, point.y); await wait();
    const placed = await stored(), spaceId = await card.evaluate(c => c._space);
    const shape = placed.spaces.find(s => s.id === spaceId).decor[0];
    assert.ok(shape?.id, 'native furniture is durably stored');
    const original = structuredClone(placed); original.spaces.find(s => s.id === spaceId).decor = [];
    const baseline = await observation(), samples = [];
    for (let sample = 0; sample < 6; sample++) {
      const undo = await command('undo', sample % 2 === 1), undone = await stored(), afterUndo = await observation();
      check(`latency.${large}.${sample}.undo.exact_config`, undone, original);
      check(`latency.${large}.${sample}.undo.no_shape`, await card.locator(`[data-hp="decor"][data-id="${shape.id}"]`).count(), 0);
      check(`latency.${large}.${sample}.undo.zero_structural_builds`, afterUndo.builds, baseline.builds);
      check(`latency.${large}.${sample}.undo.same_physical_SVG`, afterUndo.physical, baseline.physical);
      const redo = await command('redo', sample % 2 === 0), redone = await stored(), afterRedo = await observation();
      check(`latency.${large}.${sample}.redo.exact_config`, redone, placed);
      check(`latency.${large}.${sample}.redo.shape_visible`, await card.locator(`[data-hp="decor"][data-id="${shape.id}"]`).first().isVisible());
      check(`latency.${large}.${sample}.redo.zero_structural_builds`, afterRedo.builds, baseline.builds);
      check(`latency.${large}.${sample}.redo.same_physical_SVG`, afterRedo.physical, baseline.physical);
      check(`latency.${large}.${sample}.one_history_step`, [afterUndo.history, afterRedo.history], [baseline.history - 1, baseline.history]);
      check(`latency.${large}.${sample}.foreign_fields_unchanged`, withoutDecor(redone), withoutDecor(placed));
      samples.push({ phase: sample ? 'warm' : 'cold', undo, redo });
    }
    // Fresh card, same stored fixture/hass, no warm renderer/cache identities.
    await page.evaluate(async () => {
      const old = window.__card, c = document.createElement('houseplan-card');
      c.setConfig({ type: 'custom:houseplan-card', language: 'en' });
      old.replaceWith(c); window.__card = c; c.hass = old.hass;
    });
    await page.waitForFunction(() => !window.__card._booting && window.__card._loadOk);
    await page.evaluate(() => window.__hpTest.setMode('decor'));
    check(`latency.${large}.cold_reload.exact_stored_config`, await stored(), placed);
    check(`latency.${large}.cold_reload.exact_physical_SVG`, (await observation()).physical, baseline.physical);
    check(`latency.${large}.cold_reload.shape_visible`, await card.locator(`[data-hp="decor"][data-id="${shape.id}"]`).first().isVisible());
    console.log(JSON.stringify({ scene: large ? 'large-house' : 'small', samples, cacheBuilds: baseline.builds }));
  }
  await finish(browser);
} finally { await browser.close(); }
