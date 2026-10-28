/**
 * Backdrop image: move, uniform scale, and the new paper rule (docs/DECOR-EDITOR.md §3).
 *
 * The whole contract, on the demo's f1 — which IS an image plan, so every
 * assertion here lands on exactly the case that used to behave differently:
 *   • the transform frame exists in the backdrop editor and nowhere else;
 *   • dragging the body moves the picture and writes plan_x/plan_y;
 *   • a corner handle scales UNIFORMLY about the opposite corner;
 *   • live badges state the real size in metres, through cell_cm;
 *   • position and size always land on the grid, including with Shift;
 *   • the paper follows the ROOMS even here, and the picture is drawn above
 *     the paper and below the walls;
 *   • «Вписать всё» still finds a picture that has been dragged away;
 *   • the static card reads the same three fields.
 */
import { launch, check, finish } from './serve.mjs';
import { requirePinnedBrowser } from '../scripts/browser-attestation.mjs';
requirePinnedBrowser('#908 backdrop terminal input');
const { page, browser } = await launch();

const snap = await page.evaluate(() => JSON.stringify(window.__card._serverCfg));
const restore = () => page.evaluate(async (s) => {
  await window.__hpTest.waitForWrites();
  await window.__hpTest.setServerConfig(JSON.parse(s));
}, snap);

// A mode switch paints the stage and the paper with interpolated colours for
// 220 ms plus a measurement frame, driven by animation frames: under load that
// outlasts any fixed pause (#715). A mode is entered through the facade, and a
// probe belongs to the settled mode: the stage carries `mode-<mode>` and no
// longer `mode-transition`, and neither the stage nor the paper runs an
// animation of its own. One page helper for `mode()` and section 6b (#754).
await page.evaluate(() => {
  window.__backdropEnterMode = async (mode) => {
    const hp = window.__hpTest;
    const sr = () => window.__card.shadowRoot || window.__card.renderRoot;
    await hp.setMode(mode);
    const deadline = performance.now() + 5000;
    for (;;) {
      const stage = sr().querySelector('.stage');
      const paper = sr().querySelector('.stage svg .hp-paper');
      const running = [stage, paper].flatMap((node) => node?.getAnimations() ?? [])
        .filter((animation) => animation.playState === 'running');
      if (stage?.classList.contains(`mode-${mode}`) && !stage.classList.contains('mode-transition')
        && !running.length) return true;
      if (performance.now() > deadline) {
        throw new Error(`smoke_backdrop: переход в ${mode} не завершился (.stage: ${stage?.className})`);
      }
      await hp.settled();
    }
  };
});
const mode = (m) => page.evaluate((m) => window.__backdropEnterMode(m), m);
const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const q = (sel) => page.evaluate((s) => window.__card.renderRoot.querySelectorAll(s).length, sel);
const spaceCfg = () => page.evaluate(() => {
  const sp = window.__card._serverCfg.spaces.find((s) => s.id === 'f1');
  return {
    x: sp.plan_x ?? null, y: sp.plan_y ?? null,
    sx: sp.plan_scale_x ?? null, sy: sp.plan_scale_y ?? null,
    legacy: sp.plan_scale ?? null, angle: sp.plan_angle ?? null,
  };
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
const viewBox = () => page.evaluate(() =>
  window.__card.renderRoot.querySelector('.stage svg').getAttribute('viewBox'));
const contentFrame = () => page.evaluate(() => window.__card._baseVb());
const cameraSettled = async () => {
  await page.waitForFunction(() => !window.__card._cameraTransition.active, { timeout: 5000 });
  await settle();
};
const grabbing = () => page.evaluate(() =>
  window.__card.renderRoot.querySelector('.stage').classList.contains('bdgrabbing'));
// #861 pre-extraction characterization: diagnostic observers only. The spies
// delegate unchanged to the production renderer, while every gesture below is
// delivered through Chromium's actual mouse/keyboard input.
await page.evaluate(() => {
  const card = window.__card;
  const renderBody = card._renderBody.bind(card);
  let full = 0;
  card._renderBody = (...args) => { full++; return renderBody(...args); }; // private-ok: #861 diagnostic full-render counter calls the real renderer unchanged; gestures use native input.
  window.__backdropRenderCounts = () => ({ full, live: card._liveEditorPaintCount || 0 });
});
const renderCounts = () => page.evaluate(() => window.__backdropRenderCounts());
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
const tool = (t) => page.evaluate(async (t) => { await window.__hpTest.setTool(t); }, t);

await mode('decor');
await settle();
// Every Background session starts predictably on Select. The image frame is
// exclusive to its own tool and therefore cannot steal a Select/pan gesture.
check('no_frame_until_picture_tool', await q('.bdframe'), 0);
check('no_handles_until_picture_tool', await q('.bdframe .bdhandle'), 0);
check('no_picture_frame_until_picture_tool', await frameRect(), null);
check('untouched_picture_is_where_it_always_was', await imageRect(), BASE);
// …and the picture has a tool of its own, offered because f1 HAS a picture
check('the_picture_and_shapes_keep_their_tools', await page.evaluate(() =>
  [...window.__card.renderRoot.querySelectorAll('.decorbar [data-hp="tool"]')].map(button=>button.dataset.tool)),
  ['select','backdrop','shapes','text','furniture','erase']);
check('select_tool_armed_on_open', await page.evaluate(() =>
  window.__card.renderRoot.querySelector('.decorbar [data-hp="tool"].on')?.dataset.tool), 'select');
check('no_grab_cursor_under_select', await page.evaluate(() =>
  window.__card.renderRoot.querySelector('.stage').classList.contains('bdgrab')), false);
await tool('backdrop');
await settle();
check('frame_still_there_under_its_own_tool', await q('.bdframe'), 1);
check('four_corners_plus_rotate_under_picture_tool', await q('.bdframe .bdhandle'), 5);
check('frame_hugs_the_picture_under_picture_tool', await frameRect(), BASE);
check('grab_cursor_under_picture_tool', await page.evaluate(() =>
  window.__card.renderRoot.querySelector('.stage').classList.contains('bdgrab')), true);
// a drawing tool owns the drag instead — no frame competing with it
await tool('rect');
await settle();
check('no_frame_under_a_drawing_tool', await q('.bdframe'), 0);
await tool('backdrop');
await settle();

// ---------- 2) drag the body: the picture moves, the plan does not --------
const roomsBefore = await page.evaluate(() =>
  JSON.stringify(window.__card._serverCfg.spaces.find((s) => s.id === 'f1').rooms));
await page.evaluate(() => window.__hpTest.waitForWrites());
const backdropBeforeDocument = await page.evaluate(() => JSON.stringify(window.__card._serverCfg));
const backdropBeforeImage = await imageRect();
{
  const [ax, ay] = await screenPt(500, 500);
  // +102 / +52 render units: neither is a whole number of grid steps, so the
  // snap has something to do (24 steps = 100, 12 steps = 50)
  const [bx, by] = await screenPt(602, 552);
  await page.mouse.move(ax, ay);
  await settle();
  const beforeDown = await renderCounts();
  await page.mouse.down();
  await settle();
  const afterDown = await renderCounts();
  check('backdrop_body_down_one_full_render', afterDown.full - beforeDown.full, 1);
  check('backdrop_body_down_grabbing', await grabbing(), true);
  for (let step = 1; step <= 6; step++) {
    await page.mouse.move(ax + (bx - ax) * step / 12, ay + (by - ay) * step / 12);
    await settle();
  }
  const live = await badges();
  check('live_badge_while_dragging', live.length, 1);
  // the demo's cell_cm is 5 → the untouched picture is 240 cells wide, i.e.
  // 12.00 m by 9.60 m. Moving does not change the size, and the badge says so.
  check('live_badge_is_the_real_size', live[0], `${metres(BASE.w)} × ${metres(BASE.h)}`);
  check('live_badge_is_metres', live[0], '12.00 m × 9.60 m');
  for (let step = 7; step <= 12; step++) {
    await page.mouse.move(ax + (bx - ax) * step / 12, ay + (by - ay) * step / 12);
    await settle();
  }
  const afterMoves = await renderCounts();
  check('backdrop_body_twelve_moves_zero_full_renders', afterMoves.full - afterDown.full, 0);
  check('backdrop_body_twelve_moves_have_live_paint', afterMoves.live > afterDown.live, true);
  await page.mouse.up();
  await settle();
  const afterUp = await renderCounts();
  check('backdrop_body_up_one_full_render', afterUp.full - afterMoves.full, 1);
  check('backdrop_body_up_not_grabbing', await grabbing(), false);
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
  check('scale_untouched_by_a_move', near(cfg.sx, 1) && near(cfg.sy, 1), true);
  check('legacy_scale_not_written', cfg.legacy, null);
  check('size_untouched_by_a_move', [im.w, im.h], [BASE.w, BASE.h]);
  check('corner_lands_on_a_grid_node', onGrid(im.x) && onGrid(im.y), true);
  // …at the node NEAREST the finger: 102 → 100 (24 steps), 152 → 150 (36).
  // Exact, and it is meant to be — nothing may rescale the stage mid-gesture
  // (the frame is frozen during the gesture; the toolbar does not reflow),
  // or the picture would run away from the finger.
  check('landed_on_the_node_nearest_the_finger', [im.x, im.y], [100, 150]);
  check('frame_follows_the_picture', await frameRect(), im);
}
check('the_plan_geometry_never_moved', await page.evaluate(() =>
  JSON.stringify(window.__card._serverCfg.spaces.find((s) => s.id === 'f1').rooms)), roomsBefore);

// #1100: native ordinary history restores the picture and exact document without physical builds.
await page.evaluate(() => window.__hpTest.waitForWrites());
const backdropMovedDocument = await page.evaluate(() => JSON.stringify(window.__card._serverCfg));
const backdropMovedImage = await imageRect();
const historyPhysicalBuilds = () => page.evaluate(() => [window.__card._floorCacheBuilds.wallUnion, window.__card._floorCacheBuilds.physicalBodies]);
const backdropHistoryBuilds = await historyPhysicalBuilds();
for (const [direction, expectedDocument, expectedImage] of [
  ['undo', backdropBeforeDocument, backdropBeforeImage], ['redo', backdropMovedDocument, backdropMovedImage],
]) {
  await page.keyboard.press(direction === 'undo' ? 'Control+z' : 'Control+Shift+z');
  await page.evaluate(() => window.__hpTest.waitForWrites()); await settle();
  check(`backdrop_history_${direction}_exact_document`, await page.evaluate(() => JSON.stringify(window.__card._serverCfg)), expectedDocument);
  check(`backdrop_history_${direction}_image_readback`, await imageRect(), expectedImage);
  check(`backdrop_history_${direction}_frame_readback`, await frameRect(), expectedImage);
  check(`backdrop_history_${direction}_no_physical_builds`, await historyPhysicalBuilds(), backdropHistoryBuilds);
}

// ---------- 3) Shift cannot step off the grid -----------------------------
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
  check('shift_still_lands_on_the_nearest_node', [im.x, im.y], [100, 150]);
  check('shift_stays_on_the_lattice', onGrid(im.x) && onGrid(im.y), true);
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
  check('axis_scales_saved', near(cfg.sx, im.w / BASE.w, 1e-5)
    && near(cfg.sy, im.h / BASE.h, 1e-5), true);
  check('proportional_scale_keeps_axes_equal', near(cfg.sx, cfg.sy, 1e-6), true);
  check('scaled_width_is_on_the_grid', onGrid(im.x + im.w), true);
  // …and a genuine no-motion body gesture exposes the new real-size badge.
  const [cx, cy] = await screenPt(im.x + im.w / 2, im.y + im.h / 2);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await settle();
  check('badge_matches_the_new_size', (await badges())[0] ?? null,
    `${metres(im.w)} × ${metres(im.h)}`);
  await page.mouse.up();
  await settle();
}

// ---------- 5) the reset button ------------------------------------------
check('reset_button_offered_once_moved', await q('.editor-secondary .bdreset'), 1);
check('reset_button_absent_from_primary_bar', await q('.decorbar .bdreset'), 0);
await page.locator('houseplan-card').locator('.editor-secondary .bdreset').click();
await settle();
check('reset_puts_the_picture_back', await imageRect(), BASE);
check('reset_clears_the_fields', await spaceCfg(), {
  x: null, y: null, sx: null, sy: null, legacy: null, angle: null,
});
check('reset_button_gone_again', await q('.editor-secondary .bdreset'), 0);

// ---------- 5b) the SELECT tool still pans right over the picture ---------
// The body of the picture is most of the screen; claiming it outside its own
// tool would take away the one-finger pan (docs/DECOR-EDITOR.md §3.2), which is why
// moving is a tool. smoke_pan_any_zoom guards the same thing from the outside.
await tool('select');
await settle();
{
  const before = (await viewBox()).split(' ').map(Number);
  const [x, y] = await screenPt(500, 500);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 60, y + 50, { steps: 3 });
  await settle();
  const after = (await viewBox()).split(' ').map(Number);
  await page.mouse.up();
  await settle();
  check('select_tool_still_pans_over_the_picture',
    Math.abs(after[0] - before[0]) > 1 && (await spaceCfg()).x == null, true);
}

// ---------- 6) the paper is the ROOMS, and the picture sits on it ---------
await mode('view');
await settle();
const layers = await page.evaluate(() => {
  const c = window.__card;
  const m = c._spaceModel();
  const svgEl = c.renderRoot.querySelector('.stage svg');
  // Stage 2 keeps the flat floor DOM byte-for-byte equivalent but places it
  // in one transformable scene group shared with Iso. Ordering is therefore
  // measured inside the group that actually owns paper/image/rooms.
  const layerRoot = [...svgEl.children].find((node) =>
    node.querySelector?.('.hp-paperg') && node.querySelector?.('.room')) || svgEl;
  const kids = [...layerRoot.children];
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

// ---------- 6b) editors keep a WHITE sheet under the grid with a backdrop --
const editorWhite = await page.evaluate(async () => {
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  // The settled-mode wait shared with `mode()` (#715, #754).
  const enter = window.__backdropEnterMode;
  const probe = async (mode) => {
    await enter(mode);
    const stage = sr().querySelector('.stage');
    const paper = sr().querySelector('.stage svg .hp-paper');
    return {
      mode,
      stageWhite: getComputedStyle(stage).backgroundColor === 'rgb(255, 255, 255)',
      paperWhite: !paper || getComputedStyle(paper).fill === 'rgb(255, 255, 255)',
      hasBg: !!c._spaceModel().bg,
      noNoplan: !stage.classList.contains('noplan'),
    };
  };
  const plan = await probe('plan');
  const devices = await probe('devices');
  const decor = await probe('decor');
  await enter('view');
  const viewStage = sr().querySelector('.stage');
  // View with a backdrop must NOT force white — theme/card colour stays
  const viewForcedWhite = getComputedStyle(viewStage).backgroundColor === 'rgb(255, 255, 255)'
    && !viewStage.classList.contains('noplan');
  return { plan, devices, decor, viewForcedWhite, hasBg: plan.hasBg };
});
check('editors_have_backdrop', editorWhite.hasBg, true);
check('plan_editor_stage_white_with_backdrop', editorWhite.plan.stageWhite && editorWhite.plan.noNoplan, true);
check('plan_editor_paper_white_with_backdrop', editorWhite.plan.paperWhite, true);
check('devices_editor_stage_white_with_backdrop', editorWhite.devices.stageWhite, true);
check('decor_editor_stage_white_with_backdrop', editorWhite.decor.stageWhite, true);
check('view_with_backdrop_is_not_forced_white', editorWhite.viewForcedWhite, false);

// ---------- 6c) crossing the edge freezes the frame until release --------
// These witnesses precede the #861 extraction. They observe only the rendered
// SVG/config and the existing render diagnostics, never gesture-owner state.
await mode('decor');
await tool('backdrop');
await settle();
{
  const before = await viewBox();
  const bounds = await contentFrame();
  const [ax, ay] = await screenPt(500, 500);
  const [bx, by] = await screenPt(1200, 1000);
  await page.mouse.move(ax, ay);
  await page.mouse.down();
  await settle();
  const during = [await viewBox()];
  const frames = [await contentFrame()];
  for (let step = 1; step <= 12; step++) {
    await page.mouse.move(ax + (bx - ax) * step / 12, ay + (by - ay) * step / 12);
    await settle();
    during.push(await viewBox());
    frames.push(await contentFrame());
  }
  const liveImage = await page.evaluate(() => {
    const box = window.__card.renderRoot.querySelector('[data-hp-live-editor] .bdframe .bdbox');
    return { x: Number(box.getAttribute('x')), y: Number(box.getAttribute('y')),
      w: Number(box.getAttribute('width')), h: Number(box.getAttribute('height')) };
  });
  check('backdrop_edge_move_really_crosses_frozen_bounds',
    liveImage.x + liveImage.w > bounds[0] + bounds[2]
      || liveImage.y + liveImage.h > bounds[1] + bounds[3], true);
  check('backdrop_edge_move_viewbox_frozen', during.every((value) => value === before), true);
  check('backdrop_edge_move_content_frame_frozen',
    frames.every((value) => JSON.stringify(value) === JSON.stringify(bounds)), true);
  check('backdrop_edge_move_still_grabbing', await grabbing(), true);
  await page.mouse.up();
  await settle();
  const released = await contentFrame();
  check('backdrop_edge_release_frame_catches_up', JSON.stringify(released) !== JSON.stringify(bounds), true);
  check('backdrop_edge_release_frame_contains_picture',
    released[0] <= liveImage.x && released[1] <= liveImage.y
      && released[0] + released[2] >= liveImage.x + liveImage.w
      && released[1] + released[3] >= liveImage.y + liveImage.h, true);
  check('backdrop_edge_release_not_grabbing', await grabbing(), false);
}

// ---------- 6d) the real upper handle snaps by 5°, Shift stays free -------
const rotate = async (shift) => {
  await restore();
  // A new editor session returns the grown view frame to the restored plan.
  await mode('view');
  await mode('decor');
  await tool('backdrop');
  // At fit-to-plan the upper handle can be clipped by the stage. A real zoom
  // button makes the handle centre reachable, without injecting a camera.
  await page.locator('houseplan-card').locator('[data-hp="zoom-out"]').click();
  await cameraSettled();
  await settle();
  const { from, to } = await page.evaluate(() => {
    const root = window.__card.renderRoot;
    const handle = root.querySelector('.bdframe .bdhandle.dtrot');
    const image = root.querySelector('.stage svg image');
    const svg = root.querySelector('.stage svg');
    const matrix = svg.getScreenCTM();
    const at = (x, y) => new DOMPoint(x, y).matrixTransform(matrix);
    const cx = Number(image.getAttribute('x')) + Number(image.getAttribute('width')) / 2;
    const cy = Number(image.getAttribute('y')) + Number(image.getAttribute('height')) / 2;
    const x = Number(handle.getAttribute('cx')), y = Number(handle.getAttribute('cy'));
    const radians = 17 * Math.PI / 180;
    const start = at(x, y);
    const end = at(cx + (x - cx) * Math.cos(radians) - (y - cy) * Math.sin(radians),
      cy + (x - cx) * Math.sin(radians) + (y - cy) * Math.cos(radians));
    return { from: [start.x, start.y], to: [end.x, end.y] };
  });
  if (shift) await page.keyboard.down('Shift');
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.mouse.move(...to, { steps: 12 });
  await settle();
  await page.mouse.up();
  if (shift) await page.keyboard.up('Shift');
  await settle();
  return (await spaceCfg()).angle;
};
check('backdrop_rotate_handle_snaps_five_degrees', await rotate(false), 15);
const freeAngle = await rotate(true);
check('backdrop_rotate_shift_preserves_free_angle', near(freeAngle, 17, 0.1), true);
check('backdrop_rotate_shift_is_not_five_degree_snap', freeAngle % 5 !== 0, true);
await restore();
await mode('view');
await settle();

// ---------- 7) «Вписать всё» keeps a picture that was dragged away --------
await page.evaluate(async () => {
  await window.__hpTest.waitForWrites();
  await window.__hpTest.setServerConfig((cfg) => {
    const sp = cfg.spaces.find((s) => s.id === 'f1');
    sp.plan_x = 1.5; sp.plan_y = 1.5; sp.plan_scale = 0.5;
    return cfg;
  });
});
await settle();
await page.locator('houseplan-card').locator('[data-hp="zoom-fit"]').click();
await cameraSettled();
const fit = await page.evaluate(() => {
  const c = window.__card;
  const svg = c.renderRoot.querySelector('.stage svg');
  const b = svg.getAttribute('viewBox').split(' ').map(Number);
  const image = svg.querySelector('image');
  const bg = Object.fromEntries(['x', 'y', 'w', 'h'].map((key) =>
    [key, Number(image.getAttribute({ w: 'width', h: 'height' }[key] || key))]));
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
  // Paper and the exact backdrop image share one presentation plane. #1070
  // adds that plane below the SVG root; compare its real sibling paint order.
  const plane = im.parentElement;
  const kids = [...plane.children];
  const idx = (sel) => kids.findIndex((n) => n.matches(sel));
  return {
    rect: { x: a('x'), y: a('y'), w: a('width'), h: a('height') },
    papers: root.querySelectorAll('.hp-paper').length,
    imageSizedPaper: [...root.querySelectorAll('.hp-paper')].some((p) => p.tagName === 'rect'
      && Math.abs(Number(p.getAttribute('width')) - a('width')) < 1e-6),
    iPaper: idx('.hp-paperg'), iImage: kids.indexOf(im),
  };
});
check('static_card_applies_the_transform', stat.rect, { x: 1500, y: 1600, w: 500, h: 400 });
check('static_card_papers_the_rooms', stat.papers, 4);
check('static_card_has_no_picture_paper', stat.imageSizedPaper, false);
check('static_card_draws_the_picture_on_the_paper', stat.iPaper >= 0 && stat.iImage > stat.iPaper, true);

await restore();

// #908: existing ordinary backdrop scenario, now including actual browser
// cancellation and the retained terminal cursor rather than only owner fields.
await page.evaluate(() => {
  const card = window.__card, call = card.hass.callWS;
  window.__backdropWrites = [];
  card.hass.callWS = async message => {
    if (message.type === 'houseplan/config/set' || message.type === 'houseplan/layout/set')
      window.__backdropWrites.push(structuredClone(message));
    return call.call(card.hass, message);
  };
});
const terminalState = () => page.evaluate(() => {
  const c = window.__card, stage = c.renderRoot.querySelector('.stage');
  return { active: c._editorRuntime.backdropGesture.active, badge: !!c.renderRoot.querySelector('.bdmeasure'),
    grabbing: stage.classList.contains('bdgrabbing'), grab: stage.classList.contains('bdgrab'),
    // The camera owns its independent temporary outline class; compare cursor/tool classes.
    cursor: getComputedStyle(stage).cursor, classes: [...stage.classList]
      .filter(v => v !== 'bdgrabbing' && v !== 'hp-safe-daycycle-outline').sort(),
    transform: JSON.stringify(['plan_x', 'plan_y', 'plan_scale', 'plan_scale_x', 'plan_scale_y', 'plan_angle']
      .map(key => c._curSpaceCfg[key] ?? null)),
    config: JSON.stringify(c._serverCfg), layout: JSON.stringify(c._layout), history: c._geometryHistory.size,
    writes: window.__backdropWrites.length, configRev: c._cfgRev, layoutRev: c._layoutRev };
});
const cancelledState = (before, after) => !after.active && !after.badge && !after.grabbing
  && after.grab && after.cursor === 'grab' && before.config === after.config && before.layout === after.layout
  && before.history === after.history && before.writes === after.writes
  && before.configRev === after.configRev && before.layoutRev === after.layoutRev;
const startPoint = async kind => kind === 'move' ? screenPt(500, 500) : page.evaluate(kind => {
  const handle = window.__card.renderRoot.querySelector(kind === 'rotate' ? '.bdhandle.dtrot' : '.bdhandle[data-corner="1,1"]');
  const box = handle.getBoundingClientRect(); return [box.x + box.width / 2, box.y + box.height / 2];
}, kind);
const prepareCancel = async () => {
  await restore();
  if (await page.evaluate(() => window.__card._mode !== 'decor')) {
    await page.locator('[data-hp="mode-tab"][data-mode="decor"]').click();
    await page.waitForFunction(() => window.__card._mode === 'decor' && !window.__card._modeTransitionBusy);
  }
  // Native header input re-arms the compatibility-click barrier after touch.
  await page.locator('[data-hp="tool"][data-tool="backdrop"]').click();
  await page.locator('[data-hp="zoom-fit"]').click(); await cameraSettled();
  await page.locator('[data-hp="zoom-out"]').click(); await cameraSettled(); await settle();
  await page.evaluate(() => window.__hpTest.waitForWrites());
  await page.evaluate(() => {
    const stage = window.__card.renderRoot.querySelector('.stage');
    window.__backdropTerminal = { pid: null, source: null, terminals: [] };
    stage.addEventListener('pointerdown', e => {
      window.__backdropTerminal.pid = e.pointerId; window.__backdropTerminal.source = e.target;
    }, { capture: true, once: true });
    for (const type of ['pointercancel', 'lostpointercapture']) stage.addEventListener(type, e => {
      window.__backdropTerminal.terminals.push({ type: e.type, id: e.pointerId, trusted: e.isTrusted });
    }, { capture: true, once: true });
  });
};
for (const terminal of ['touchCancel', 'Escape', 'lostpointercapture']) for (const kind of ['move', 'scale', 'rotate']) {
  console.log('908-scenario', terminal, kind);
  await prepareCancel(); const before = await terminalState(), from = await startPoint(kind);
  let session;
  if (terminal === 'touchCancel') {
    session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from[0], y: from[1], id: 908 }] });
  } else { await page.mouse.move(...from); await page.mouse.down(); }
  await settle(); const begun = await terminalState(), counts = await renderCounts();
  for (let step = 1; step <= 6; step++) {
    const x = from[0] + step * 5, y = from[1] + step * 3;
    if (session) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 908 }] });
    else await page.mouse.move(x, y);
    await settle();
  }
  const moving = await terminalState(), movedCounts = await renderCounts();
  check(`908 ${terminal} ${kind} starts real owner and live cursor`, begun.active && begun.grabbing && begun.badge
    && moving.active && moving.grabbing && moving.config !== before.config);
  check(`908 ${terminal} ${kind} per-move keeps retained rendering`, movedCounts.full === counts.full && movedCounts.live > counts.live);
  if (session) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await session.detach();
  } else if (terminal === 'Escape') await page.keyboard.press('Escape');
  else await page.evaluate(() => {
    const { source, pid } = window.__backdropTerminal;
    if (!source?.hasPointerCapture(pid)) throw Error('native backdrop capture was not held');
    source.releasePointerCapture(pid);
  });
  if (terminal === 'lostpointercapture') await page.mouse.move(from[0] + 30, from[1] + 18);
  // Two completed RAFs are the bounded terminal-frame boundary; no hass tick.
  await settle(); const after = await terminalState();
  check(`908 ${terminal} ${kind} terminal cursor config layout history writes`, cancelledState(before, after));
  check(`908 ${terminal} ${kind} preserves other stage classes`, JSON.stringify(before.classes) === JSON.stringify(after.classes));
  if (terminal !== 'Escape') check(`908 ${terminal} ${kind} trusted terminal delivered`, await page.evaluate(type => {
    const probe = window.__backdropTerminal;
    return probe.terminals.some(e => e.type === (type === 'touchCancel' ? 'pointercancel' : type) && e.id === probe.pid && e.trusted);
  }, terminal));
  if (!session) {
    await page.mouse.up(); await settle();
    check(`908 ${terminal} ${kind} late physical release stays mutation free`, cancelledState(before, await terminalState()));
  }
  const again = await startPoint('move');
  await page.mouse.move(...again); await page.mouse.down(); await page.mouse.move(again[0] + 25, again[1] + 15); await settle();
  const restarted = await terminalState();
  check(`908 ${terminal} ${kind} next native drag immediately owns cursor`, restarted.active && restarted.grabbing && restarted.badge);
  await page.keyboard.press('Escape'); await page.mouse.up(); await settle();
  check(`908 ${terminal} ${kind} restarted cancel stays mutation free`, cancelledState(before, await terminalState()));
}
await prepareCancel(); const releaseBefore = await terminalState(), releaseFrom = await startPoint('move');
await page.mouse.move(...releaseFrom); await page.mouse.down(); await page.mouse.move(releaseFrom[0] + 40, releaseFrom[1] + 20);
await settle(); await page.mouse.up(); await settle(); await page.evaluate(() => window.__hpTest.waitForWrites());
const releasedState = await terminalState();
check('908 normal release retains one save and one history step', releasedState.writes === releaseBefore.writes + 1
  && releasedState.history === releaseBefore.history + 1 && !releasedState.active && !releasedState.grabbing);
await page.keyboard.press('Control+z'); await settle(); await page.evaluate(() => window.__hpTest.waitForWrites());
const undoneState = await terminalState();
check('908 native Undo restores released transform', undoneState.transform === releaseBefore.transform && undoneState.history === releaseBefore.history);
await finish(browser);
