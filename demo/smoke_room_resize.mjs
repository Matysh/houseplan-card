// Room resize tool (docs/RESIZE.md): wall drag with shared walls (T-junction),
// live badges, stops (neighbour min size, opening anchor), the corner scale
// frame, Esc-cancel and one-step undo. Vertex positions are checked NUMERICALLY.
import { launch, check, finish } from './serve.mjs';
const { page, browser } = await launch();

const snap = await page.evaluate(() => JSON.stringify(window.__card._serverCfg));
const restore = () => page.evaluate((s) => {
  const c = window.__card;
  c._serverCfg = JSON.parse(s);
  c._rszSel = null; c._rszDrag = null; c._rszLive = null; c._rszUndo = [];
  c._cfgEpoch++; c.requestUpdate();
  return c.updateComplete && true;
}, snap);

const enter = (tool) => page.evaluate((t) => {
  const c = window.__card;
  if (!c._markup) c._setMode('plan');
  c._tool = t; c._rszSel = null; c.requestUpdate();
  return c.updateComplete && true;
}, tool);

const handleCount = () => page.evaluate(() => window.__card.renderRoot.querySelectorAll('.rszhandle').length);
const roomPolyN = (id) => page.evaluate((id) => {
  const r = window.__card._serverCfg.spaces.find((s) => s.id === 'f1').rooms.find((x) => x.id === id);
  return r?.poly ? r.poly.map((p) => [p[0], p[1]]) : null;
}, id);
const openingOf = (id) => page.evaluate((id) =>
  (window.__card._serverCfg.spaces.find((s) => s.id === 'f1').openings || []).find((o) => o.id === id) || null, id);
// screen position of a render-unit point (the svg viewBox fills the stage exactly)
const screenPt = (x, y) => page.evaluate(([x, y]) => {
  const c = window.__card;
  const stage = c.renderRoot.querySelector('.stage');
  const r = stage.getBoundingClientRect();
  const svg = stage.querySelector('svg');
  const [vx, vy, vw, vh] = svg.getAttribute('viewBox').split(' ').map(Number);
  return [r.left + ((x - vx) / vw) * r.width, r.top + ((y - vy) / vh) * r.height];
}, [x, y]);
const settle = () => page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));
const labels = () => page.evaluate(() =>
  [...window.__card.renderRoot.querySelectorAll('.measurelabel')].map((el) => el.textContent.trim()));
const polyClose = (name, got, want, tol = 1e-4) => {
  check(name + '.len', got?.length, want.length);
  if (got?.length !== want.length) return;
  for (let i = 0; i < want.length; i++) {
    check(`${name}[${i}]`, Math.hypot(got[i][0] - want[i][0], got[i][1] - want[i][1]) <= tol, true);
  }
};

// ---------- no handles outside the resize tool ----------
await enter('draw');
check('draw_tool_no_handles', await handleCount(), 0);
await enter('opening');
check('opening_tool_no_handles', await handleCount(), 0);

// ---------- handles appear in the resize tool ----------
await enter('resize');
await settle();
check('resize_handles_16', await handleCount(), 16); // 4 rooms × 4 walls

// ---------- wall drag: T-stack r1|r2+r3, opening rides along, live badges ----------
// opening op2 sits ON the shared wall x=0.55 → it must travel with it
await page.evaluate(() => {
  const c = window.__card;
  const sp = c._serverCfg.spaces.find((s) => s.id === 'f1');
  sp.openings = [{ id: 'op2', type: 'door', x: 0.55, y: 0.30, angle: 90, length: 0.08 }];
  c._cfgEpoch++; c.requestUpdate();
});
await settle();
const [hx, hy] = await screenPt(550, 360);           // r1 right-wall handle (mid y of 140..580)
const [tx] = await screenPt(650, 360);               // +100 render units
await page.mouse.move(hx, hy);
await page.mouse.down();
await page.mouse.move((hx + tx) / 2, hy, { steps: 4 });
await settle();
const mid = await labels();
check('drag_badges_visible', mid.length >= 6);       // 3 wall lengths + 3 areas (r1, r2, r3)
check('drag_badges_have_area', mid.filter((t) => t.includes('m²')).length >= 3);
check('drag_badges_have_len', mid.some((t) => /\d\.\d\d m$/.test(t)));
const midR1 = await roomPolyN('r1');
check('preview_moves_r1', Math.abs(midR1[1][0] - 0.6) < 0.011); // halfway ≈ 0.60 (snapped)
await page.mouse.move(tx, hy, { steps: 4 });
await settle();
const end = await labels();
check('drag_badges_change', JSON.stringify(mid) !== JSON.stringify(end));
check('area_updates_live', mid.find((t) => t.includes('m²')) !== end.find((t) => t.includes('m²')));
await page.mouse.up();
await settle();
// committed geometry: r1 grew, r2 translated, r3 became L-shaped with 6 vertices
polyClose('r1_after', await roomPolyN('r1'), [[0.04, 0.14], [0.65, 0.14], [0.65, 0.58], [0.04, 0.58]]);
polyClose('r2_after', await roomPolyN('r2'), [[0.65, 0.14], [0.96, 0.14], [0.96, 0.46], [0.65, 0.46]]);
polyClose('r3_after', await roomPolyN('r3'),
  [[0.65, 0.46], [0.96, 0.46], [0.96, 0.86], [0.55, 0.86], [0.55, 0.58], [0.65, 0.58]]);
const op2 = await openingOf('op2');
check('opening_travels', Math.abs(op2.x - 0.65) < 1e-4 && Math.abs(op2.y - 0.30) < 1e-6);

// ---------- undo: one release = one step back ----------
await page.keyboard.press('Control+z');
await settle();
polyClose('undo_r1', await roomPolyN('r1'), [[0.04, 0.14], [0.55, 0.14], [0.55, 0.58], [0.04, 0.58]]);
polyClose('undo_r2', await roomPolyN('r2'), [[0.55, 0.14], [0.96, 0.14], [0.96, 0.46], [0.55, 0.46]]);
polyClose('undo_r3', await roomPolyN('r3'), [[0.55, 0.46], [0.96, 0.46], [0.96, 0.86], [0.55, 0.86]]);
const op2b = await openingOf('op2');
check('undo_opening_back', Math.abs(op2b.x - 0.55) < 1e-9);
await restore();

// ---------- stop: the shrinking neighbour keeps ~30 cm ----------
await enter('resize');
await settle();
{
  const [ax, ay] = await screenPt(550, 360);
  const [bx] = await screenPt(1050, 360); // far past r2/r3 (right walls at 0.96)
  await page.mouse.move(ax, ay);
  await page.mouse.down();
  await page.mouse.move(bx, ay, { steps: 6 });
  await settle();
  await page.mouse.up();
  await settle();
  const r1 = await roomPolyN('r1');
  const r2 = await roomPolyN('r2');
  const width2 = (r2[1][0] - r2[0][0]) * 1000;
  check('neighbour_min_stop', Math.abs(r1[1][0] - 0.93333) < 0.005); // clamped, NOT 1.05
  check('neighbour_min_width', width2 >= 25 - 1e-6 && width2 <= 25 + 1000 / 240 + 1e-6);
}
await restore();

// ---------- stop: an opening anchors the shortening wall ----------
await enter('resize');
await settle();
{
  // a door on r1's LEFT wall (x=0.04), spans y 0.16..0.24. Dragging r1's TOP
  // wall down shortens that wall from above — it must stop at the door edge.
  // (No collinear neighbour wall can adopt this door — a real «упор».)
  await page.evaluate(() => {
    const c = window.__card;
    const sp = c._serverCfg.spaces.find((s) => s.id === 'f1');
    sp.openings = [{ id: 'op1', type: 'door', x: 0.04, y: 0.20, angle: 90, length: 0.08 }];
    c._cfgEpoch++; c.requestUpdate();
  });
  await settle();
  const [ax, ay] = await screenPt(295, 140); // r1 top-wall handle
  const [, by] = await screenPt(295, 300);   // try to push far past the door top (y=160)
  await page.mouse.move(ax, ay);
  await page.mouse.down();
  await page.mouse.move(ax, by, { steps: 5 });
  await settle();
  await page.mouse.up();
  await settle();
  const r1 = await roomPolyN('r1');
  const topY = r1[0][1] * 1000;
  check('opening_stop', topY <= 160 + 1e-6);                       // never below the door top
  check('opening_stop_close', topY >= 160 - 1000 / 240 - 1e-6);    // and clamped right at it
  const op1 = await openingOf('op1');
  check('anchored_opening_static', Math.abs(op1.y - 0.2) < 1e-9 && Math.abs(op1.x - 0.04) < 1e-9);
}
await restore();

// ---------- the scale frame: proportional, neighbours stay, stops work ----------
await enter('resize');
await page.evaluate(() => { const c = window.__card; c._rszSel = 'r4'; c.requestUpdate(); return c.updateComplete && true; });
await settle();
check('frame_corners', await page.evaluate(() => window.__card.renderRoot.querySelectorAll('.rszcorner').length), 4);
check('frame_present', await page.evaluate(() => !!window.__card.renderRoot.querySelector('.rszframe')));
{
  // shrink about the top-left corner (40,580): drag br (550,860) toward it
  const [ax, ay] = await screenPt(550, 860);
  const [bx, by] = await screenPt(448, 804); // ≈ k=0.8
  await page.mouse.move(ax, ay);
  await page.mouse.down();
  await page.mouse.move(bx, by, { steps: 5 });
  await settle();
  await page.mouse.up();
  await settle();
  const r4 = await roomPolyN('r4');
  const base = [[0.04, 0.58], [0.55, 0.58], [0.55, 0.86], [0.04, 0.86]];
  // ALL vertices scale by the SAME factor about the fixed corner (0.04, 0.58)
  const ks = base.map((b, i) => {
    const dx = b[0] - 0.04, dy = b[1] - 0.58;
    if (Math.abs(dx) > 1e-9) return (r4[i][0] - 0.04) / dx;
    if (Math.abs(dy) > 1e-9) return (r4[i][1] - 0.58) / dy;
    return null;
  }).filter((k) => k != null);
  const kAvg = ks.reduce((a, b) => a + b, 0) / ks.length;
  check('scale_shrinks', kAvg > 0.7 && kAvg < 0.9);
  check('scale_proportional', ks.every((k) => Math.abs(k - kAvg) < 1e-3));
  const ky = base.map((b, i) => (Math.abs(b[1] - 0.58) > 1e-9 ? (r4[i][1] - 0.58) / (b[1] - 0.58) : null)).filter((k) => k != null);
  check('scale_uniform_xy', ky.every((k) => Math.abs(k - kAvg) < 1e-3));
  // neighbours did NOT move (scale never drags them — docs/RESIZE.md exception)
  polyClose('scale_r1_static', await roomPolyN('r1'), [[0.04, 0.14], [0.55, 0.14], [0.55, 0.58], [0.04, 0.58]]);
  polyClose('scale_r3_static', await roomPolyN('r3'), [[0.55, 0.46], [0.96, 0.46], [0.96, 0.86], [0.55, 0.86]]);
}
await restore();
await enter('resize');
await page.evaluate(() => { const c = window.__card; c._rszSel = 'r4'; c.requestUpdate(); return c.updateComplete && true; });
await settle();
{
  // growing about the top-left corner immediately runs into r3 → the scale stops at ≈1
  const [ax, ay] = await screenPt(550, 860);
  const [bx, by] = await screenPt(805, 1000); // ≈ k=1.5
  await page.mouse.move(ax, ay);
  await page.mouse.down();
  await page.mouse.move(bx, by, { steps: 5 });
  await settle();
  await page.mouse.up();
  await settle();
  const r4 = await roomPolyN('r4');
  check('scale_neighbour_stop', Math.abs(r4[1][0] - 0.55) < 0.005 && Math.abs(r4[2][1] - 0.86) < 0.005);
  polyClose('scale_stop_r3_static', await roomPolyN('r3'), [[0.55, 0.46], [0.96, 0.46], [0.96, 0.86], [0.55, 0.86]]);
}
await restore();

// ---------- Esc cancels the current drag ----------
await enter('resize');
await settle();
{
  const [ax, ay] = await screenPt(550, 360);
  const [bx] = await screenPt(700, 360);
  await page.mouse.move(ax, ay);
  await page.mouse.down();
  await page.mouse.move(bx, ay, { steps: 4 });
  await settle();
  const midPoly = await roomPolyN('r1');
  check('esc_preview_moved', Math.abs(midPoly[1][0] - 0.70) < 0.011);
  await page.keyboard.press('Escape');
  await settle();
  polyClose('esc_restores_r1', await roomPolyN('r1'), [[0.04, 0.14], [0.55, 0.14], [0.55, 0.58], [0.04, 0.58]]);
  polyClose('esc_restores_r2', await roomPolyN('r2'), [[0.55, 0.14], [0.96, 0.14], [0.96, 0.46], [0.55, 0.46]]);
  check('esc_no_badges', (await labels()).length, 0);
  await page.mouse.up();
}
await restore();

// ---------- leaving the tool removes every handle ----------
await enter('merge');
check('merge_tool_no_handles', await handleCount(), 0);
await page.evaluate(() => { window.__card._setMode('devices'); });
await settle();
check('devices_mode_no_handles', await handleCount(), 0);

await finish(browser, { done: true });
