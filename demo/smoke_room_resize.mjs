// Safe fixed-topology Resize (#277): production pointer handlers, disabled
// reasons, exact shared preview/commit, one Undo, corner clamp and zero-write
// cancellation. The smoke loads the tracked production bundle.
import { launch, check, finish } from './serve.mjs';

const { page, browser } = await launch();

const enter = async (tool = 'resize') => {
  await page.evaluate((next) => {
    const card = window.__card;
    if (!card._markup) card._setMode('plan');
    card._tool = next;
    card._rszDrag = null;
    card._rszPreview = null;
    card._rszLive = null;
    card._rszEligibilityCache = null;
    card.requestUpdate();
    return card.updateComplete;
  }, tool);
  await page.waitForTimeout(40);
};

const setRooms = async (rooms, openings = [], walls = []) => {
  await page.evaluate(({ rooms, openings, walls }) => {
    const card = window.__card;
    const space = card._serverCfg.spaces.find((candidate) => candidate.id === card._space);
    space.rooms = rooms;
    space.openings = openings;
    if (walls.length) space.walls = walls;
    else delete space.walls;
    delete space.open_spans;
    delete space.partitions;
    delete space.room_drafts;
    delete space.wall_columns;
    card._geometryHistory.clear();
    card._rszEligibilityCache = null;
    card._cfgEpoch++;
    card.requestUpdate();
    return card.updateComplete;
  }, { rooms, openings, walls });
  await page.waitForTimeout(40);
};

const settle = () => page.evaluate(() => new Promise((resolve) =>
  requestAnimationFrame(() => requestAnimationFrame(resolve))));

const screenPt = (x, y) => page.evaluate(([px, py]) => {
  const card = window.__card;
  const stage = card.renderRoot.querySelector('.stage');
  const rect = stage.getBoundingClientRect();
  const svg = stage.querySelector('svg');
  const [vx, vy, vw, vh] = svg.getAttribute('viewBox').split(' ').map(Number);
  return [rect.left + ((px - vx) / vw) * rect.width, rect.top + ((py - vy) / vh) * rect.height];
}, [x, y]);

const pointer = (type, clientX, clientY, { cx, cy, pointerId = 77 } = {}) => page.evaluate((args) => {
  const handles = [...window.__card.renderRoot.querySelectorAll('.rszhandle')];
  const target = args.cx == null ? handles.find((handle) => !handle.classList.contains('disabled'))
    : handles.find((handle) => Math.abs(Number(handle.getAttribute('cx')) - args.cx) < 1
      && Math.abs(Number(handle.getAttribute('cy')) - args.cy) < 1);
  target?.dispatchEvent(new PointerEvent(args.type, {
    bubbles: true, cancelable: true, pointerId: args.pointerId,
    clientX: args.clientX, clientY: args.clientY, pointerType: 'mouse', buttons: args.type === 'pointerup' ? 0 : 1,
  }));
  return !!target;
}, { type, clientX, clientY, cx, cy, pointerId });

const roomPoly = (id, live = false) => page.evaluate(({ id, live }) => {
  const card = window.__card;
  const space = live ? card._curSpaceCfg : card._serverCfg.spaces.find((candidate) => candidate.id === card._space);
  return space.rooms.find((room) => room.id === id)?.poly || null;
}, { id, live });

const edgeX = async (id, edge, live = false) => {
  const poly = await roomPoly(id, live);
  return ((poly[edge][0] + poly[(edge + 1) % poly.length][0]) / 2) * 1000;
};

const rect = (id, x0, y0, x1, y1) => ({
  id, name: id, area: null,
  poly: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => [x / 1000, y / 1000]),
});

// No Resize interaction leaks into another tool.
await enter('draw');
check('safe_resize.hidden_outside_tool', await page.evaluate(() =>
  window.__card.renderRoot.querySelectorAll('.rszhandle').length), 0);

// Exact shared pair: only two rooms move, preview stays out of _serverCfg,
// moving opening travels once, release writes one history command.
await setRooms([
  rect('left', 100, 100, 400, 400),
  rect('right', 400, 100, 700, 400),
  rect('third', 850, 100, 950, 400),
], [{ id: 'moving-door', type: 'door', x: 0.4, y: 0.25, angle: 90, length: 0.08 }]);
await enter();
check('safe_resize.handles_visible', await page.evaluate(() =>
  window.__card.renderRoot.querySelectorAll('.rszhandle').length), 12);
check('safe_resize.no_corner_scale', await page.evaluate(() =>
  window.__card.renderRoot.querySelectorAll('.rszcorner,.rszframe,.rszknob').length), 0);
check('safe_resize.shared_enabled_handles', await page.evaluate(() =>
  [...window.__card.renderRoot.querySelectorAll('.rszhandle')]
    .filter((handle) => Math.abs(Number(handle.getAttribute('cx')) - 400) < 1
      && handle.getAttribute('aria-disabled') === 'false').length), 2);
const [sx, sy] = await screenPt(400, 250);
const [tx] = await screenPt(450, 250);
await pointer('pointerdown', sx, sy, { cx: 400, cy: 250 });
check('safe_resize.drag_started', await page.evaluate(() => !!window.__card._rszDrag), true);
await pointer('pointermove', tx, sy);
await settle();
check('safe_resize.preview_moved', Math.abs((await edgeX('left', 1, true)) - 450) < 6, true);
check('safe_resize.preview_not_persisted', Math.abs((await edgeX('left', 1, false)) - 400) < 1e-6, true);
await pointer('pointerup', tx, sy);
await settle();
check('safe_resize.commit_left', Math.abs((await edgeX('left', 1, false)) - 450) < 6, true);
check('safe_resize.commit_right', Math.abs((await edgeX('right', 3, false)) - 450) < 6, true);
check('safe_resize.third_static', Math.abs((await edgeX('third', 1, false)) - 950) < 1e-6, true);
check('safe_resize.opening_once', await page.evaluate(() => {
  const card = window.__card;
  const space = card._serverCfg.spaces.find((candidate) => candidate.id === card._space);
  return Math.abs(space.openings.find((opening) => opening.id === 'moving-door').x - 0.45) < 0.006;
}), true);
check('safe_resize.one_undo', await page.evaluate(() => window.__card._geometryHistory.size), 1);
await page.keyboard.press('Control+z');
await settle();
check('safe_resize.undo_exact', Math.abs((await edgeX('left', 1, false)) - 400) < 1e-6, true);

// The anonymized regression topology has one long boundary owned by two
// neighbours. It is a visible, accessible disabled handle and captures no
// pointer / creates no write.
await setRooms([
  { id: 'main', name: 'main', area: null, poly: [[0, 0], [662, 0], [662, -5], [782, -5], [782, 250], [662, 250], [662, 245], [0, 245]].map(([x, y]) => [x / 1000, y / 1000]) },
  rect('a', 0, 100, 339, 245),
  rect('b', 339, 100, 662, 245),
]);
await enter();
const disabled = await page.evaluate(() => {
  const card = window.__card;
  const circles = [...card.renderRoot.querySelectorAll('.rszhandle[aria-disabled="true"]')];
  const target = circles.find((circle) => circle.getAttribute('aria-label')?.includes('part'))
    || circles[0];
  return {
    count: circles.length,
    label: target?.getAttribute('aria-label') || '',
    tab: target?.getAttribute('tabindex'),
  };
});
check('safe_resize.disabled_visible', disabled.count > 0, true);
check('safe_resize.disabled_reason', /part|част/i.test(disabled.label), true);
check('safe_resize.disabled_focusable', disabled.tab, '0');
const historyBefore = await page.evaluate(() => window.__card._geometryHistory.size);
const [dx, dy] = await screenPt(331, 245);
await pointer('pointerdown', dx, dy, { cx: 331, cy: 245, pointerId: 78 });
await settle();
check('safe_resize.disabled_no_drag', await page.evaluate(() => window.__card._rszDrag), null);
check('safe_resize.disabled_zero_write', await page.evaluate(() => window.__card._geometryHistory.size), historyBefore);

// Irregular exact pair reaches the first safe grid position before its inner
// corner; neither polygon gains or loses a vertex.
await setRooms([
  rect('left', 100, 100, 400, 400),
  { id: 'irregular', name: 'irregular', area: null, poly: [[400, 100], [700, 100], [700, 200], [650, 200], [650, 400], [400, 400]].map(([x, y]) => [x / 1000, y / 1000]) },
]);
await enter();
const [ix, iy] = await screenPt(400, 250);
const [farX] = await screenPt(720, 250);
await pointer('pointerdown', ix, iy, { cx: 400, cy: 250, pointerId: 79 });
await pointer('pointermove', farX, iy, { pointerId: 79 });
await pointer('pointerup', farX, iy, { pointerId: 79 });
await settle();
const irregular = await roomPoly('irregular');
check('safe_resize.corner_clamped', Math.abs(irregular[5][0] * 1000 - 625) < 6, true);
check('safe_resize.corner_topology', irregular.length, 6);

// Exact production preflight is fail-closed before preview/commit.
await setRooms([rect('preflight', 100, 100, 400, 400)]);
await enter();
await page.evaluate(() => {
  const card = window.__card;
  card.__resizePreflight = card._checkOptimizeGeometry;
  card._checkOptimizeGeometry = () => ({ ok: false, spaces: [] });
});
const preflightBefore = JSON.stringify(await roomPoly('preflight'));
const [px, py] = await screenPt(400, 250);
const [preflightX] = await screenPt(500, 250);
await pointer('pointerdown', px, py, { cx: 400, cy: 250, pointerId: 80 });
await pointer('pointermove', preflightX, py, { pointerId: 80 });
await pointer('pointerup', preflightX, py, { pointerId: 80 });
await settle();
await page.evaluate(() => {
  const card = window.__card;
  card._checkOptimizeGeometry = card.__resizePreflight;
  delete card.__resizePreflight;
});
check('safe_resize.preflight_no_commit', JSON.stringify(await roomPoly('preflight')), preflightBefore);
check('safe_resize.preflight_zero_write', await page.evaluate(() => window.__card._geometryHistory.size), 0);

// pointercancel follows the abort path: no persistence, history or hidden save.
await setRooms([rect('solo', 100, 100, 400, 400)]);
await enter();
const cancelBefore = JSON.stringify(await roomPoly('solo'));
const [cx, cy] = await screenPt(400, 250);
const [moveX] = await screenPt(500, 250);
await pointer('pointerdown', cx, cy, { cx: 400, cy: 250, pointerId: 81 });
await pointer('pointermove', moveX, cy, { pointerId: 81 });
await pointer('pointercancel', moveX, cy, { pointerId: 81 });
await settle();
check('safe_resize.cancel_geometry', JSON.stringify(await roomPoly('solo')), cancelBefore);
check('safe_resize.cancel_zero_write', await page.evaluate(() => window.__card._geometryHistory.size), 0);

await finish(browser, { done: true });
