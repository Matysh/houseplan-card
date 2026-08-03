// Opening drag rulers (owner 2026-08-03): while a door/window is dragged along
// a wall, a measure badge sits on EACH shoulder (wall end -> opening edge,
// along the wall), and when the opening's center hits the wall's center a
// perpendicular dashed tick appears and the center magnet-snaps (Shift opts
// out). Real pointer events; the numbers are checked against the geometry:
// r1+r2 top edges merge into one wall 40..960 (center 500), cell = 5 cm,
// grid pitch = 1000/240, so cm = units * 1.2 and the wall is 11.04 m.
import { launch, check, finish } from './serve.mjs';
const { page, browser } = await launch();

await page.evaluate(() => {
  const c = window.__card;
  const sp = c._serverCfg.spaces.find((s) => s.id === 'f1');
  // 80-unit door on r1's top wall (y = 0.14), off-center
  sp.openings = [{ id: 'op1', type: 'door', x: 0.2, y: 0.14, angle: 0, length: 0.08 }];
  c._setMode('plan'); c._tool = 'opening';
  c._cfgEpoch++; c.requestUpdate();
  return c.updateComplete && true;
});
const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
await settle();

const screenPt = (x, y) => page.evaluate(([x, y]) => {
  const c = window.__card;
  const stage = c.renderRoot.querySelector('.stage');
  const r = stage.getBoundingClientRect();
  const svg = stage.querySelector('svg');
  const [vx, vy, vw, vh] = svg.getAttribute('viewBox').split(' ').map(Number);
  return [r.left + ((x - vx) / vw) * r.width, r.top + ((y - vy) / vh) * r.height];
}, [x, y]);
const badges = () => page.evaluate(() =>
  [...window.__card.renderRoot.querySelectorAll('.measurelabel.opshoulder')].map((el) => el.textContent.trim()).sort());
const nums = async () => (await badges()).map((t) => parseFloat(t));
const tick = () => page.evaluate(() => window.__card.renderRoot.querySelectorAll('.opcentertick').length);
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// ---------- drag to an off-center spot: two live badges, no tick ----------
const [sx, sy] = await screenPt(200, 140);
const [t1x] = await screenPt(460, 140);
await page.mouse.move(sx, sy);
await page.mouse.down();
await page.mouse.move(t1x, sy, { steps: 5 });
await settle();
// center 460 -> edges 420/500; shoulders 420-40=380 u (4.56 m) and 960-500=460 u (5.52 m)
{
  const [a, b] = await nums();
  check('two_badges_visible', (await badges()).length, 2);
  check('badge_left_4_56', near(a, 4.56, 0.04));
  check('badge_right_5_52', near(b, 5.52, 0.04));
  // exact invariant, immune to pointer rounding: shoulders + opening = wall
  check('badges_sum_to_wall', near(a + b, 11.04 - 0.96, 0.021));
}
check('no_tick_off_center', await tick(), 0);

// ---------- live update on the way ----------
const [t2x] = await screenPt(360, 140);
await page.mouse.move(t2x, sy, { steps: 3 });
await settle();
// center 360 -> shoulders 320-40=280 u (3.36 m) and 960-400=560 u (6.72 m)
{
  const [a, b] = await nums();
  check('badge_left_updates_3_36', near(a, 3.36, 0.04));
  check('badge_right_updates_6_72', near(b, 6.72, 0.04));
}

// ---------- near the wall center: tick + magnet ----------
const [t3x] = await screenPt(498.7, 140);
await page.mouse.move(t3x, sy, { steps: 3 });
await settle();
check('tick_at_center', await tick(), 1);
check('magnet_snaps_center', await page.evaluate(() =>
  window.__card._curSpaceCfg.openings[0].x), 0.5);
// both shoulders equal EXACTLY after the snap: (920 - 80) / 2 = 420 u -> 5.04 m
check('badges_equal_at_center', await badges(), ['5.04 m', '5.04 m']);
// the tick is perpendicular to the wall (horizontal wall -> a vertical dash)
const geom = await page.evaluate(() => {
  const el = window.__card.renderRoot.querySelector('.opcentertick');
  if (!el) return null;
  const dashed = getComputedStyle(el).strokeDasharray;
  return { x1: +el.getAttribute('x1'), x2: +el.getAttribute('x2'),
    y1: +el.getAttribute('y1'), y2: +el.getAttribute('y2'),
    dashed: dashed !== 'none' && dashed !== '' };
});
check('tick_perpendicular_at_wall_center', !!geom
  && near(geom.x1, 500, 1e-6) && near(geom.x2, 500, 1e-6) && near(geom.y2 - geom.y1, 30, 1e-6));
check('tick_dashed', !!geom && geom.dashed);

// ---------- release: everything disappears, the snapped x is committed ----------
await page.mouse.up();
await settle();
check('badges_gone_after_drop', (await badges()).length, 0);
check('tick_gone_after_drop', await tick(), 0);
check('committed_x_center', await page.evaluate(() =>
  window.__card._serverCfg.spaces.find((s) => s.id === 'f1').openings[0].x), 0.5);

// ---------- Shift disables the magnet (badges stay) ----------
// park the opening off-center first: a drag that returns to within 3 px of its
// own starting point is filtered by the tap threshold, so the Shift approach
// must start away from the center
const [cx0] = await screenPt(500, 140);
await page.mouse.move(cx0, sy);
await page.mouse.down();
await page.mouse.move(t2x, sy, { steps: 3 });
await page.mouse.up();
await settle();
await page.keyboard.down('Shift');
await page.mouse.down();
await page.mouse.move(t3x, sy, { steps: 3 });
await settle();
check('no_tick_with_shift', await tick(), 0);
const freeX = await page.evaluate(() => window.__card._curSpaceCfg.openings[0].x);
check('no_magnet_with_shift', near(freeX, 0.4987, 0.004) && freeX !== 0.5);
check('badges_still_there_with_shift', (await badges()).length, 2);
await page.mouse.up();
await page.keyboard.up('Shift');
await settle();
check('badges_gone_final', (await badges()).length, 0);

await finish(browser, { done: true });
