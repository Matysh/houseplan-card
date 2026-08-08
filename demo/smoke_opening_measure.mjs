// Opening drag rulers (owner 2026-08-03): while a door/window/gate is dragged along
// a wall, a measure badge sits on EACH shoulder (wall end -> opening edge,
// along the wall), and when the opening's center hits the wall's center a
// perpendicular dashed tick appears and the center magnet-snaps (Shift cannot
// opt out). The wall is ONE room's edge (owner: "only the wall of one room") —
// r2's collinear top edge never merges into r1's, so the ruler runs 40..550
// (center 295), not the old merged 40..960. Real pointer events; the numbers
// are checked against the geometry: cell = 5 cm, grid pitch = 1000/240, so
// cm = units * 1.2 and r1's top wall (510 u) is 6.12 m.
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
await page.waitForTimeout(220); // editor chrome transition changes stage coordinates
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
// center 460 -> edges 420/500; shoulders measured on r1's OWN edge 40..550:
// 420-40=380 u (4.56 m) and 550-500=50 u (0.60 m) — the old merged build
// showed 960-500=460 u (5.52 m) on the right
{
  const [a, b] = await nums();
  check('two_badges_visible', (await badges()).length, 2);
  check('badge_right_0_60', near(a, 0.6, 0.04));
  check('badge_left_4_56', near(b, 4.56, 0.04));
  // exact invariant, immune to pointer rounding: shoulders + opening = wall
  check('badges_sum_to_wall', near(a + b, 6.12 - 0.96, 0.021));
}
check('no_tick_off_center', await tick(), 0);

// ---------- live update on the way ----------
const [t2x] = await screenPt(360, 140);
await page.mouse.move(t2x, sy, { steps: 3 });
await settle();
// center 360 -> shoulders 320-40=280 u (3.36 m) and 550-400=150 u (1.80 m)
{
  const [a, b] = await nums();
  check('badge_right_updates_1_80', near(a, 1.8, 0.04));
  check('badge_left_updates_3_36', near(b, 3.36, 0.04));
}

// ---------- near the OWN edge center (40+550)/2 = 295: tick + magnet ----------
const [t3x] = await screenPt(293.7, 140);
await page.mouse.move(t3x, sy, { steps: 3 });
await settle();
check('tick_at_center', await tick(), 1);
check('magnet_snaps_center', near(await page.evaluate(() =>
  window.__card._curSpaceCfg.openings[0].x), 0.295, 1e-6));
// both shoulders equal after the snap: (510 - 80) / 2 = 215 u -> 2.58 m
check('badges_equal_at_center', await badges(), ['2.58 m', '2.58 m']);
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
  && near(geom.x1, 295, 1e-6) && near(geom.x2, 295, 1e-6) && near(geom.y2 - geom.y1, 30, 1e-6));
check('tick_dashed', !!geom && geom.dashed);

// ---------- release: everything disappears, the snapped x is committed ----------
await page.mouse.up();
await settle();
check('badges_gone_after_drop', (await badges()).length, 0);
check('tick_gone_after_drop', await tick(), 0);
check('committed_x_center', near(await page.evaluate(() =>
  window.__card._serverCfg.spaces.find((s) => s.id === 'f1').openings[0].x), 0.295, 1e-6));

// ---------- Shift cannot disable the magnet (badges stay) ----
// park the opening off-center first: a drag that returns to within 3 px of its
// own starting point is filtered by the tap threshold, so the Shift approach
// must start away from the center
const [cx0] = await screenPt(295, 140);
await page.mouse.move(cx0, sy);
await page.mouse.down();
await page.mouse.move(t2x, sy, { steps: 3 });
await page.mouse.up();
await settle();
await page.keyboard.down('Shift');
await page.mouse.down();
await page.mouse.move(t3x, sy, { steps: 3 });
await settle();
check('tick_with_shift', await tick(), 1);
const freeX = await page.evaluate(() => window.__card._curSpaceCfg.openings[0].x);
check('magnet_with_shift', near(freeX, 0.295, 1e-6));
check('badges_still_there_with_shift', (await badges()).length, 2);
await page.mouse.up();
await page.keyboard.up('Shift');
await settle();
check('badges_gone_final', (await badges()).length, 0);

// ---------- opening on a SHARED wall of two rooms: the own room's edge ----------
// staggered fragments on the boundary x=550: r1's right edge 140..460 (its
// room is made the short one), r2's left edge 140..580. The snap resolves to
// r1's edge (nearest, first in roomEdges order on the tie), so the shoulders
// and the center come from 140..460 — the old build measured the merged
// 140..580 union
await page.evaluate(() => {
  const c = window.__card;
  const sp = c._serverCfg.spaces.find((s) => s.id === 'f1');
  sp.rooms = [
    { id: 'r1', name: 'Living room', poly: [[0.04, 0.14], [0.55, 0.14], [0.55, 0.46], [0.04, 0.46]] },
    { id: 'r2', name: 'Kitchen', poly: [[0.55, 0.14], [0.96, 0.14], [0.96, 0.58], [0.55, 0.58]] },
  ];
  sp.openings = [{ id: 'op1', type: 'door', x: 0.55, y: 0.3, angle: 90, length: 0.08 }];
  c._cfgEpoch++; c.requestUpdate();
  return c.updateComplete && true;
});
await settle();
const [vx0, vy0] = await screenPt(550, 300);
const [, vy1] = await screenPt(550, 360);
await page.mouse.move(vx0, vy0);
await page.mouse.down();
await page.mouse.move(vx0, vy1, { steps: 3 });
await settle();
// center 360 -> edges 320/400; r1's edge 140..460: 320-140=180 u (2.16 m) and
// 460-400=60 u (0.72 m); the merged build showed 580-400=180 u (2.16 m) below
{
  const [a, b] = await nums();
  check('shared_wall_two_badges', (await badges()).length, 2);
  check('shared_wall_bottom_0_72', near(a, 0.72, 0.04));
  check('shared_wall_top_2_16', near(b, 2.16, 0.04));
}
check('shared_wall_no_tick_off_center', await tick(), 0);
await page.mouse.up();
await settle();
// approach the OWN edge center (140+460)/2 = 300 — NOT the merged 360
const [, vy2] = await screenPt(550, 301.3);
await page.mouse.move(vx0, vy1);
await page.mouse.down();
await page.mouse.move(vx0, vy2, { steps: 3 });
await settle();
check('shared_wall_tick_at_own_center', await tick(), 1);
check('shared_wall_magnet_y_0_3', near(await page.evaluate(() =>
  window.__card._curSpaceCfg.openings[0].y), 0.3, 1e-6));
// equal shoulders on the own edge: (320 - 80) / 2 = 120 u -> 1.44 m
check('shared_wall_badges_equal', await badges(), ['1.44 m', '1.44 m']);
await page.mouse.up();
await settle();

// ---------- PLACING a new opening: the same rulers (owner 2026-08-03) -------
// Moving along a wall with the Opening tool must show exactly what dragging an
// existing opening shows: a badge on each shoulder of the WOULD-BE opening, a
// perpendicular tick + magnet at the wall centre, Shift opting out — and the
// whole lot vanishing the moment the opening is placed. Default length is
// 90 cm = 75 units, so the shoulders are measured from the edges c +- 37.5.
await page.evaluate(() => {
  const c = window.__card;
  const sp = c._serverCfg.spaces.find((s) => s.id === 'f1');
  sp.rooms = [
    { id: 'r1', name: 'Living room', poly: [[0.04, 0.14], [0.55, 0.14], [0.55, 0.58], [0.04, 0.58]] },
    { id: 'r2', name: 'Kitchen', poly: [[0.55, 0.14], [0.96, 0.14], [0.96, 0.46], [0.55, 0.46]] },
  ];
  sp.openings = [];
  c._setMode('plan'); c._tool = 'opening';
  c._cfgEpoch++; c.requestUpdate();
  return c.updateComplete && true;
});
await settle();
const ghosts = () => page.evaluate(() => window.__card.renderRoot.querySelectorAll('.opghost').length);

// hover off-centre on r1's top wall (own edge 40..550, y = 140)
{
  const [hx, hy] = await screenPt(460, 141);
  await page.mouse.move(hx, hy, { steps: 3 });
  await settle();
  check('place_ghost_shown', await ghosts(), 1);
  check('place_two_badges', (await badges()).length, 2);
  // edges 422.5 / 497.5 -> 382.5 u (4.59 m) left, 52.5 u (0.63 m) right
  const [a, b] = await nums();
  check('place_badge_right_0_63', near(a, 0.63, 0.05));
  check('place_badge_left_4_59', near(b, 4.59, 0.05));
  check('place_no_tick_off_center', await tick(), 0);
}

// live update on the way — the badges follow the cursor
{
  const [hx, hy] = await screenPt(200, 141);
  await page.mouse.move(hx, hy, { steps: 3 });
  await settle();
  // edges 162.5 / 237.5 -> 122.5 u (1.47 m) left, 312.5 u (3.75 m) right
  const [a, b] = await nums();
  check('place_badge_updates_1_47', near(a, 1.47, 0.05));
  check('place_badge_updates_3_75', near(b, 3.75, 0.05));
}

// near the wall centre (40+550)/2 = 295: tick appears and the magnet bites
{
  const [hx, hy] = await screenPt(293.7, 141);
  await page.mouse.move(hx, hy, { steps: 3 });
  await settle();
  check('place_tick_at_center', await tick(), 1);
  // equal shoulders after the magnet: (510 - 75) / 2 = 217.5 u -> 2.61 m
  check('place_badges_equal_at_center', await badges(), ['2.61 m', '2.61 m']);
  const g = await page.evaluate(() => {
    const el = window.__card.renderRoot.querySelector('.opcentertick');
    return el && { x1: +el.getAttribute('x1'), x2: +el.getAttribute('x2'),
      y1: +el.getAttribute('y1'), y2: +el.getAttribute('y2') };
  });
  check('place_tick_perpendicular', !!g && near(g.x1, 295, 1e-6) && near(g.x2, 295, 1e-6)
    && near(g.y2 - g.y1, 30, 1e-6));
  // the ghost itself already sits on the magnetised centre
  const gh = await page.evaluate(() => {
    const el = window.__card.renderRoot.querySelector('.opghost');
    return el && (+el.getAttribute('x1') + +el.getAttribute('x2')) / 2;
  });
  check('place_ghost_magnetised', near(gh, 295, 1e-6));
}

// Shift cannot opt out of the magnet, the badges stay
{
  await page.keyboard.down('Shift');
  const [hx, hy] = await screenPt(293.7, 141);
  await page.mouse.move(hx, hy, { steps: 3 });
  await settle();
  check('place_tick_with_shift', await tick(), 1);
  check('place_badges_with_shift', (await badges()).length, 2);
  const gh = await page.evaluate(() => {
    const el = window.__card.renderRoot.querySelector('.opghost');
    return el && (+el.getAttribute('x1') + +el.getAttribute('x2')) / 2;
  });
  check('place_ghost_magnetised_with_shift', near(gh, 295, 1e-6));
  await page.keyboard.up('Shift');
}

// the click places it AT THE MAGNET and clears every hint
{
  const [hx, hy] = await screenPt(293.7, 141);
  await page.mouse.move(hx, hy, { steps: 3 });
  await settle();
  await page.mouse.click(hx, hy);
  await settle();
  check('place_dialog_opened', await page.evaluate(() => !!window.__card._openingDialog), true);
  check('place_dialog_x_magnetised', near(await page.evaluate(() => window.__card._openingDialog.x), 295, 1e-6));
  check('place_badges_gone', (await badges()).length, 0);
  check('place_tick_gone', await tick(), 0);
  check('place_ghost_gone', await ghosts(), 0);
  // …and confirming the dialog writes the opening at the magnetised point
  await page.evaluate(() => { const c = window.__card; c._saveOpening(); return c.updateComplete && true; });
  await settle();
  check('place_committed_x_center', near(await page.evaluate(() =>
    window.__card._serverCfg.spaces.find((s) => s.id === 'f1').openings[0].x), 0.295, 1e-6));
}

await finish(browser, { done: true });
