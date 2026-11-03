import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { visiblePlanSegment } from '../tests/lib/visible-plan-target.mjs';

test('native setup targets remain snapped and exposed with a property panel, small canvas, pan and zoom', async t => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  for (const [width, height, zoom] of [[1280, 800, 1], [900, 650, 1.7], [640, 480, .65]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.setContent(`<style>body{margin:0}svg{position:absolute;left:20px;top:50px;width:${width - 40}px;height:${height - 70}px}
      aside{position:fixed;right:20px;top:50px;width:220px;height:${height - 70}px;background:#ccc;z-index:2}</style>
      <svg id="canvas" viewBox="${-200 / zoom} ${80 / zoom} ${1000 / zoom} ${700 / zoom}"><rect x="-3000" y="-3000" width="6000" height="6000" fill="#eef"/></svg><aside>Properties</aside>`);
    const result = await page.locator('#canvas').evaluate(visiblePlanSegment, { step: 10 });
    for (const coordinate of [result.a.x, result.a.y, result.b.x, result.b.y]) assert.ok(Number.isInteger(coordinate / 10));
    assert.ok(result.samples.every(p => p.x < width - 240), 'neither endpoint nor the segment lies under the panel');
    assert.ok(Math.hypot(result.to.x - result.from.x, result.to.y - result.from.y) >= 90);
    const cross = await page.locator('#canvas').evaluate(visiblePlanSegment, { step: 10,
      pattern: [[[0, 0], [2, 0]], [[2, 0], [2, 2]], [[1, -1], [1, 1]], [[0, 0], [-1, 0]]] });
    assert.equal(cross.segments.length, 4);
    assert.ok(cross.samples.every(p => p.x < width - 240), 'L/X endpoints and drag target also stay outside the panel');
    await page.close();
  }
});

test('an occluded canvas fails explicitly instead of clicking a panel or mutating a fixture', async t => {
  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.setContent('<svg id="canvas" width="800" height="600"></svg><aside style="position:fixed;inset:0;background:white">Dialog</aside>');
  await assert.rejects(page.locator('#canvas').evaluate(visiblePlanSegment, { step: 10 }), /No unobscured snapped segment/);
});

test('a room target cannot enclose an existing wall even when its perimeter is free', async t => {
  const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.setContent('<style>body{margin:0}svg{width:800px;height:600px}</style><svg id="canvas" viewBox="0 0 800 600"><rect width="800" height="600" fill="#eef"/></svg>');
  const square = { step: 10, pattern: [[[0,0],[1,0]],[[1,0],[1,1]],[[1,1],[0,1]],[[0,1],[0,0]]] };
  const first = await page.locator('#canvas').evaluate(visiblePlanSegment, square);
  const obstacle = { x: (first.segments[0].a.x + first.segments[0].b.x) / 2,
    y: (first.segments[0].a.y + first.segments[1].b.y) / 2 };
  await page.locator('#canvas').evaluate((svg, p) => {
    const wall = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    for (const [name, value] of Object.entries({ x: p.x - 2, y: p.y - 2, width: 4, height: 4, 'data-hp': 'wall' })) wall.setAttribute(name, String(value));
    svg.append(wall);
  }, obstacle);
  // This control confirms perimeter sampling alone would accept the same target.
  assert.deepEqual((await page.locator('#canvas').evaluate(visiblePlanSegment, square)).a, first.a);
  const clear = await page.locator('#canvas').evaluate(visiblePlanSegment, { ...square, clearInterior: true });
  assert.notDeepEqual(clear.a, first.a);
  const xs = clear.segments.flatMap(segment => [segment.a.x, segment.b.x]);
  const ys = clear.segments.flatMap(segment => [segment.a.y, segment.b.y]);
  assert.ok(obstacle.x < Math.min(...xs) - 12 || obstacle.x > Math.max(...xs) + 12
    || obstacle.y < Math.min(...ys) - 12 || obstacle.y > Math.max(...ys) + 12);
});
