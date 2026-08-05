/**
 * Backdrop image: move, uniform scale, and the new paper rule (docs/BACKDROP.md).
 *
 * The whole contract, on the demo's f1 — which IS an image plan, so every
 * assertion here lands on exactly the case that used to behave differently:
 *   • the transform frame exists in the backdrop editor and nowhere else;
 *   • dragging the body moves the picture and writes plan_x/plan_y;
 *   • a corner handle scales UNIFORMLY about the opposite corner;
 *   • live badges state the real size in metres, through cell_cm;
 *   • position and size land on the grid, Shift steps off it;
 *   • the paper follows the ROOMS even here, and the picture is drawn above
 *     the paper and below the walls;
 *   • «Вписать всё» still finds a picture that has been dragged away;
 *   • the static card reads the same three fields.
 */
import { launch, check, finish } from './serve.mjs';
const { page, browser } = await launch();

const snap = await page.evaluate(() => JSON.stringify(window.__card._serverCfg));
const restore = () => page.evaluate((s) => {
  const c = window.__card;
  c._serverCfg = JSON.parse(s);
  c._bdDrag = null;
  c._cfgEpoch++; c.requestUpdate();
  return c.updateComplete && true;
}, snap);

const mode = (m) => page.evaluate((m) => {
  const c = window.__card;
  c._setMode(m); c.requestUpdate();
  return c.updateComplete && true;
}, m);
const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const q = (sel) => page.evaluate((s) => window.__card.renderRoot.querySelectorAll(s).length, sel);
const spaceCfg = () => page.evaluate(() => {
  const sp = window.__card._serverCfg.spaces.find((s) => s.id === 'f1');
  return { x: sp.plan_x ?? null, y: sp.plan_y ?? null, k: sp.plan_scale ?? null };
});
/** The image rect AS RENDERED (attributes of the <image> in the stage svg). */
const imageRect = () => page.evaluate(() => {
  const im = window.__card.renderRoot.querySelector('.stage svg image');
  if (!im) return null;
  const a = (n) => Number(im.getAttribute(n));
  return { x: a('x'), y: a('y'), w: a('width'), h: a('height') };
});
const frameRect = () => page.evaluate(() => {
  const b = window.__card.renderRoot.querySelector('.bdframe .bdbox');
  if (!b) return null;
  const a = (n) => Number(b.getAttribute(n));
  return { x: a('x'), y: a('y'), w: a('width'), h: a('height') };
});
const badges = () => page.evaluate(() =>
  [...window.__card.renderRoot.querySelectorAll('.measurelabel.bdmeasure')].map((e) => e.textContent.trim()));
/** Screen position of a render-unit point (the svg viewBox fills the stage). */
const screenPt = (x, y) => page.evaluate(([x, y]) => {
  const stage = window.__card.renderRoot.querySelector('.stage');
  const r = stage.getBoundingClientRect();
  const [vx, vy, vw, vh] = stage.querySelector('svg').getAttribute('viewBox').split(' ').map(Number);
  return [r.left + ((x - vx) / vw) * r.width, r.top + ((y - vy) / vh) * r.height];
}, [x, y]);
const near = (a, b, tol = 1e-4) => Math.abs(a - b) <= tol;

// f1: plan_aspect 1.25 → the centred default is 1000×800 at (0,100)
const BASE = { x: 0, y: 100, w: 1000, h: 800 };
const PITCH = 1000 / 240;
// "on a node", allowing for the 6 decimals the normalised config keeps
// (5e-7 normalised ≈ 5e-4 render units ≈ 1e-4 of a step)
const onGrid = (v, tol = 1e-3) => Math.abs(v / PITCH - Math.round(v / PITCH)) < tol;
/** Metres a render-unit length is worth on the demo plan (cell_cm = 5). */
const metres = (u) => (((u / PITCH) * 5) / 100).toFixed(2) + ' m';

// ---------- 1) the frame lives in the backdrop editor and nowhere else -----
await mode('view');
await settle();
check('no_frame_in_view', await q('.bdframe'), 0);
await mode('plan');
await settle();
check('no_frame_in_plan', await q('.bdframe'), 0);
const tool = (t) => page.evaluate((t) => {
  const c = window.__card;
  c._decorTool = t; c._decorDraft = null; c.requestUpdate();
  return c.updateComplete && true;
}, t);

await mode('decor');
await settle();
// the frame is on screen the moment the backdrop editor opens…
check('frame_in_backdrop_editor', await q('.bdframe'), 1);
check('four_finger_handles', await q('.bdframe .bdhandle'), 4);
check('frame_hugs_the_picture', await frameRect(), BASE);
check('untouched_picture_is_where_it_always_was', await imageRect(), BASE);
// …and the picture has a tool of its own, offered because f1 HAS a picture
check('the_picture_has_a_tool', await q('.decorbar .btn.dtool'), 8);
// …which is ARMED the moment the editor opens (owner 2026-08-05: «не
// получается двигать картинку-подложку в режиме редактора подложки» — the
// frame promised a draggable picture while the promise needed a tool nobody
// had found). The editor is named after the picture; it opens on it.
check('picture_tool_armed_on_open', await page.evaluate(() => window.__card._decorTool), 'backdrop');
check('grab_cursor', await page.evaluate(() =>
  window.__card.renderRoot.querySelector('.stage').classList.contains('bdgrab')), true);
// select still exists and still leaves the body to the pan (smoke_pan_any_zoom)
await tool('select');
await settle();
check('no_grab_cursor_under_select', await page.evaluate(() =>
  window.__card.renderRoot.querySelector('.stage').classList.contains('bdgrab')), false);
await tool('backdrop');
await settle();
check('frame_still_there_under_its_own_tool', await q('.bdframe'), 1);
// a drawing tool owns the drag instead — no frame competing with it
await tool('rect');
await settle();
check('no_frame_under_a_drawing_tool', await q('.bdframe'), 0);
await tool('backdrop');
await settle();

// ---------- 2) drag the body: the picture moves, the plan does not --------
const roomsBefore = await page.evaluate(() =>
  JSON.stringify(window.__card._serverCfg.spaces.find((s) => s.id === 'f1').rooms));
{
  const [ax, ay] = await screenPt(500, 500);
  // +102 / +52 render units: neither is a whole number of grid steps, so the
  // snap has something to do (24 steps = 100, 12 steps = 50)
  const [bx, by] = await screenPt(602, 552);
  await page.mouse.move(ax, ay);
  await page.mouse.down();
  await page.mouse.move((ax + bx) / 2, (ay + by) / 2, { steps: 3 });
  await settle();
  const live = await badges();
  check('live_badge_while_dragging', live.length, 1);
  // the demo's cell_cm is 5 → the untouched picture is 240 cells wide, i.e.
  // 12.00 m by 9.60 m. Moving does not change the size, and the badge says so.
  check('live_badge_is_the_real_size', live[0], `${metres(BASE.w)} × ${metres(BASE.h)}`);
  check('live_badge_is_metres', live[0], '12.00 m × 9.60 m');
  await page.mouse.move(bx, by, { steps: 3 });
  await settle();
  await page.mouse.up();
  await settle();
}
check('badge_gone_after_release', (await badges()).length, 0);
{
  const cfg = await spaceCfg();
  const im = await imageRect();
  // the gesture asked for +102/+52 render units; the pointer arrives in whole
  // screen pixels, so the ASSERTION is the contract, not the arithmetic: the
  // corner lands on a lattice node within one step of where the finger let go
  check('plan_x_saved', near(cfg.x, im.x / 1000, 1e-6), true);
  check('plan_y_saved', near(cfg.y, (im.y - BASE.y) / 1000, 1e-6), true);
  check('scale_untouched_by_a_move', cfg.k, 1);
  check('size_untouched_by_a_move', [im.w, im.h], [BASE.w, BASE.h]);
  check('corner_lands_on_a_grid_node', onGrid(im.x) && onGrid(im.y), true);
  // …at the node NEAREST the finger: 102 → 100 (24 steps), 152 → 150 (36).
  // Exact, and it is meant to be — nothing may rescale the stage mid-gesture
  // (the frame is frozen while _bdDrag is live; the toolbar does not reflow),
  // or the picture would run away from the finger.
  check('landed_on_the_node_nearest_the_finger', [im.x, im.y], [100, 150]);
  check('frame_follows_the_picture', await frameRect(), im);
}
check('the_plan_geometry_never_moved', await page.evaluate(() =>
  JSON.stringify(window.__card._serverCfg.spaces.find((s) => s.id === 'f1').rooms)), roomsBefore);

// ---------- 3) Shift steps off the grid ----------------------------------
await restore();
await settle();
{
  const [ax, ay] = await screenPt(500, 500);
  const [bx, by] = await screenPt(602, 552);
  await page.keyboard.down('Shift');
  await page.mouse.move(ax, ay);
  await page.mouse.down();
  await page.mouse.move(bx, by, { steps: 3 });
  await settle();
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await settle();
  const im = await imageRect();
  // Shift is not "a different snap", it is NO snap: the corner is wherever the
  // finger left it, to the pixel — and a pixel is a fraction of a grid step,
  // so at least one axis is bound to sit between the nodes.
  check('shift_lands_where_the_finger_did',
    Math.abs(im.x - 102) <= 1 && Math.abs(im.y - 152) <= 1, true);
  check('shift_is_off_the_lattice', onGrid(im.x) && onGrid(im.y), false);
}

// ---------- 4) a corner handle scales UNIFORMLY about the opposite one ----
await restore();
await settle();
{
  // the bottom-right corner of the default rect is (1000, 900); pull it in to
  // (700, ...) — the top-left corner (0,100) must not budge and the ratio must
  // stay 1.25, whatever the vertical component of the gesture says
  const [ax, ay] = await screenPt(BASE.x + BASE.w, BASE.y + BASE.h);
  const [bx, by] = await screenPt(700, 600);
  await page.mouse.move(ax, ay);
  await page.mouse.down();
  await settle();
  await page.mouse.move((ax + bx) / 2, (ay + by) / 2, { steps: 3 });
  await settle();
  check('live_badge_while_scaling', (await badges()).length, 1);
  await page.mouse.move(bx, by, { steps: 3 });
  await settle();
  await page.mouse.up();
  await settle();
  const im = await imageRect();
  check('opposite_corner_stayed_put', near(im.x, BASE.x, 1e-6) && near(im.y, BASE.y, 1e-6), true);
  check('scaled_down', im.w < BASE.w, true);
  check('uniform_no_stretch', near(im.w / im.h, BASE.w / BASE.h, 1e-9), true);
  const cfg = await spaceCfg();
  check('plan_scale_saved', near(cfg.k, im.w / BASE.w, 1e-5), true);
  check('scaled_width_is_on_the_grid',
    Math.abs((im.x + im.w) / PITCH - Math.round((im.x + im.w) / PITCH)) < 1e-6, true);
  // …and the badge states the picture's REAL size through cell_cm
  check('badge_matches_the_new_size', await page.evaluate(() => {
    const c = window.__card;
    c._bdDrag = { kind: 'move', pid: 1, sx: 0, sy: 0, base: { x: 0, y: 100, w: 1000, h: 800 },
      p0: { dx: 0, dy: 0, k: 1 }, fx: 0, fy: 0, sgx: 0, sgy: 0, moved: false };
    c.requestUpdate();
    return c.updateComplete.then(() =>
      c.renderRoot.querySelector('.measurelabel.bdmeasure')?.textContent.trim() ?? null);
  }), `${metres(im.w)} × ${metres(im.h)}`);
  await page.evaluate(() => { const c = window.__card; c._bdDrag = null; c.requestUpdate(); return c.updateComplete; });
}

// ---------- 5) the reset button ------------------------------------------
check('reset_button_offered_once_moved', await q('.decorbar .bdreset'), 1);
await page.evaluate(() => { const c = window.__card; c._bdReset?.(); c.requestUpdate(); return c.updateComplete; });
await settle();
check('reset_puts_the_picture_back', await imageRect(), BASE);
check('reset_clears_the_fields', await spaceCfg(), { x: null, y: null, k: null });
check('reset_button_gone_again', await q('.decorbar .bdreset'), 0);

// ---------- 5b) the SELECT tool still pans right over the picture ---------
// The body of the picture is most of the screen; claiming it outside its own
// tool would take away the one-finger pan (docs/BACKDROP.md §2), which is why
// moving is a tool. smoke_pan_any_zoom guards the same thing from the outside.
await tool('select');
await settle();
check('select_tool_still_pans_over_the_picture', await page.evaluate(async () => {
  const c = window.__card;
  const before = { ...c._viewOr(c._baseVb()) };
  c._stagePointerDown({ pointerId: 91, clientX: 300, clientY: 300, target: c._stageEl, preventDefault() {} });
  c._stagePointerMove({ pointerId: 91, clientX: 360, clientY: 350 });
  const after = { ...c._viewOr(c._baseVb()) };
  c._stagePointerUp({ pointerId: 91, clientX: 360, clientY: 350 });
  await c.updateComplete;
  const sp = c._serverCfg.spaces.find((s) => s.id === 'f1');
  return Math.abs(after.x - before.x) > 1 && sp.plan_x == null;
}), true);

// ---------- 6) the paper is the ROOMS, and the picture sits on it ---------
await mode('view');
await settle();
const layers = await page.evaluate(() => {
  const c = window.__card;
  const m = c._spaceModel();
  const svgEl = c.renderRoot.querySelector('.stage svg');
  const kids = [...svgEl.children];
  const idx = (sel) => kids.findIndex((n) => n.matches(sel) || n.querySelector?.(sel));
  const papers = [...svgEl.querySelectorAll('.hp-paper')];
  return {
    paperShapes: papers.length,
    rooms: m.rooms.length,
    // not one paper shape the size of the picture any more
    imageSizedPaper: papers.some((p) => p.tagName === 'rect'
      && Math.abs(Number(p.getAttribute('width')) - m.bg.w) < 1e-6
      && Math.abs(Number(p.getAttribute('height')) - m.bg.h) < 1e-6),
    iPaper: idx('.hp-paper'), iImage: idx('image'), iRoom: idx('.room-outline, .room'),
  };
});
check('paper_is_one_shape_per_room', layers.paperShapes, layers.rooms);
check('no_paper_the_size_of_the_picture', layers.imageSizedPaper, false);
check('picture_is_above_the_paper', layers.iImage > layers.iPaper && layers.iPaper >= 0, true);
check('picture_is_below_the_walls', layers.iImage < layers.iRoom, true);

// ---------- 7) «Вписать всё» keeps a picture that was dragged away --------
await page.evaluate(() => {
  const c = window.__card;
  const sp = c._serverCfg.spaces.find((s) => s.id === 'f1');
  sp.plan_x = 1.5; sp.plan_y = 1.5; sp.plan_scale = 0.5;
  c._cfgEpoch++; c._frame = null; c.requestUpdate();
  return c.updateComplete;
});
await settle();
const fit = await page.evaluate(() => {
  const c = window.__card;
  c._fitAll();
  const b = c._baseVb();
  const bg = c._spaceModel().bg;
  return { b, bg };
});
check('the_frame_reaches_the_moved_picture',
  fit.b[0] <= fit.bg.x && fit.b[1] <= fit.bg.y
  && fit.b[0] + fit.b[2] >= fit.bg.x + fit.bg.w
  && fit.b[1] + fit.b[3] >= fit.bg.y + fit.bg.h, true);
check('and_the_moved_picture_is_where_the_transform_says',
  near(fit.bg.x, 1500) && near(fit.bg.y, 1600) && near(fit.bg.w, 500) && near(fit.bg.h, 400), true);

// ---------- 8) the static card reads the same three fields ---------------
const stat = await page.evaluate(async () => {
  await customElements.whenDefined('houseplan-space-card');
  const main = window.__card;
  const cfg = JSON.parse(JSON.stringify(main._serverCfg));
  const hass = { ...main.hass, callWS: async (m) => {
    if (m.type === 'houseplan/config/get') return { config: cfg, rev: 1 };
    if (m.type === 'houseplan/layout/get') return { layout: {} };
    return { ok: true };
  } };
  const host = document.createElement('div');
  document.body.appendChild(host);
  const card = document.createElement('houseplan-space-card');
  card.setConfig({ type: 'custom:houseplan-space-card', space: 'f1' });
  card.hass = hass;
  host.appendChild(card);
  const t0 = Date.now();
  while (!card.renderRoot?.querySelector('.hp-static-stage svg image') && Date.now() - t0 < 6000) {
    await new Promise((r) => setTimeout(r, 60));
  }
  await card.updateComplete;
  const root = card.renderRoot.querySelector('.hp-static-stage svg');
  const im = root.querySelector('image');
  const a = (n) => Number(im.getAttribute(n));
  const kids = [...root.children];
  const idx = (sel) => kids.findIndex((n) => n.matches(sel) || n.querySelector?.(sel));
  return {
    rect: { x: a('x'), y: a('y'), w: a('width'), h: a('height') },
    papers: root.querySelectorAll('.hp-paper').length,
    imageSizedPaper: [...root.querySelectorAll('.hp-paper')].some((p) => p.tagName === 'rect'
      && Math.abs(Number(p.getAttribute('width')) - a('width')) < 1e-6),
    iPaper: idx('.hp-paper'), iImage: idx('image'),
  };
});
check('static_card_applies_the_transform', stat.rect, { x: 1500, y: 1600, w: 500, h: 400 });
check('static_card_papers_the_rooms', stat.papers, 4);
check('static_card_has_no_picture_paper', stat.imageSizedPaper, false);
check('static_card_draws_the_picture_on_the_paper', stat.iImage > stat.iPaper, true);

await restore();
await finish(browser);
