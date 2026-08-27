// The Resize transaction audit (HP-1550-01/-03/-04, narrowed by #277):
//   01 — a debounced config write pending from a PREVIOUS edit must never carry
//        the live resize preview to the server; Esc leaves server === snapshot;
//        a normal pointerup produces exactly one write;
//   03 — pointercancel aborts the drag (no commit, no undo step, no write),
//        for the surviving wall handles; lostpointercapture after a cancel
//        must not double-fire; the removed scale corners stay absent;
//   04 — a door at the exact midpoint of a wall must not shadow the resize
//        handle: the handle wins the hit test, the wall drags WITH the door,
//        and no opening-edit drag starts in the resize tool.
import { launch, check, finish } from './serve.mjs';
const { page, browser } = await launch();

// Isolate one eligible non-shared rectangle. The demo house's x=550 boundary
// is intentionally partial-shared and therefore disabled by #277.
await page.evaluate(async () => {
  const c = window.__card;
  const poly = [[0.04, 0.14], [0.55, 0.14], [0.55, 0.58], [0.04, 0.58]];
  c._serverCfg = {
    model_version: 7,
    spaces: [{
      id: 'f1', title: 'Safe resize', view_box: [0, 0, 1, 1], cell_cm: 5,
      rooms: [{ id: 'r1', name: 'Safe resize room', area: null, poly }],
      walls: poly.map((a, index) => ({
        key: `r1-${index}`, a, b: poly[(index + 1) % poly.length], cm: 15,
      })),
      openings: [], partitions: [], room_drafts: [], wall_columns: [],
    }],
    markers: [], settings: {},
  };
  c._space = 'f1';
  c._modelCache = null; c._frame = null;
  c._cfgEpoch++; c.requestUpdate(); await c.updateComplete;
});
const snap = await page.evaluate(() => JSON.stringify(window.__card._serverCfg));
const restore = () => page.evaluate((s) => {
  const c = window.__card;
  c._serverCfg = JSON.parse(s);
  c._resize.reset();
  c._geometryHistory.clear();
  c._modelCache = null; c._frame = null;
  c._cfgEpoch++; c.requestUpdate();
  return c.updateComplete && true;
}, snap);
const enter = async (tool) => {
  const changed = await page.evaluate((t) => {
    const c = window.__card;
    const changed = !c._markup;
    if (changed) c._setMode('plan');
    c._tool = t; c._resize.selectRoom(null); c.requestUpdate();
    return Promise.resolve(c.updateComplete).then(() => changed);
  }, tool);
  if (changed) await page.waitForTimeout(220);
};
const settle = () => page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));
const screenPt = (x, y) => page.evaluate(([x, y]) => {
  const c = window.__card;
  const stage = c.renderRoot.querySelector('.stage');
  const r = stage.getBoundingClientRect();
  const svg = stage.querySelector('svg');
  const [vx, vy, vw, vh] = svg.getAttribute('viewBox').split(' ').map(Number);
  return [r.left + ((x - vx) / vw) * r.width, r.top + ((y - vy) / vh) * r.height];
}, [x, y]);
// geometry the SERVER would get (the mutable config _writeConfig reads)
const roomSrv = (id) => page.evaluate((id) => {
  const r = window.__card._serverCfg.spaces.find((s) => s.id === 'f1').rooms.find((x) => x.id === id);
  return r?.poly ? r.poly.map((p) => [p[0], p[1]]) : null;
}, id);
// geometry AS RENDERED (includes the live preview overlay when a drag is on)
const roomLive = (id) => page.evaluate((id) => {
  const r = window.__card._curSpaceCfg.rooms.find((x) => x.id === id);
  return r?.poly ? r.poly.map((p) => [p[0], p[1]]) : null;
}, id);

// spy on every config write with a deep copy taken AT CALL TIME — exactly what
// the backend would persist (a later fix of the mutable object must not hide it)
await page.evaluate(() => {
  const c = window.__card;
  window.__writes = [];
  const orig = c.hass.callWS.bind(c.hass);
  c.hass = { ...c.hass, callWS: async (m) => {
    if (m.type === 'houseplan/config/set') window.__writes.push(JSON.parse(JSON.stringify(m.config)));
    return orig(m);
  } };
  return c.updateComplete && true;
});
const writes = () => page.evaluate(() => window.__writes.length);
const writeWallAt = (i, x) => page.evaluate(([i, x]) => {
  const w = window.__writes[i];
  const r1 = w.spaces.find((s) => s.id === 'f1').rooms.find((r) => r.id === 'r1');
  return r1.poly.some((p) => Math.abs(p[0] - x) < 0.011);
}, [i, x]);

// ================= HP-1550-01: pending write vs live preview =================
await enter('resize');
await settle();
// precompute every screen point so drag 2 starts well inside the 500 ms window
const [h550x, h550y] = await screenPt(550, 360);
const [h600x] = await screenPt(600, 360);
const [h650x] = await screenPt(650, 360);
const [h700x] = await screenPt(700, 360);
// drag 1 commits r1's right wall 0.55 → 0.60: a write enters the debounce queue
await page.mouse.move(h550x, h550y);
await page.mouse.down();
await page.mouse.move(h600x, h550y, { steps: 3 });
await page.mouse.up();
// drag 2 starts IMMEDIATELY (pending save still queued): preview 0.60 → 0.70, HOLD
await page.mouse.move(h600x, h550y);
await page.mouse.down();
await page.mouse.move(h700x, h550y, { steps: 3 });
await settle();
check('01_committed_wall', Math.abs((await roomSrv('r1'))[1][0] - 0.60) < 0.011);
check('01_preview_live', Math.abs((await roomLive('r1'))[1][0] - 0.70) < 0.011);
// … the queued write fires while the handle is still held (>500 ms)
await page.waitForTimeout(800);
check('01_pending_write_fired', (await writes()) >= 1);
// Esc abandons the drag
await page.keyboard.press('Escape');
await settle();
await page.mouse.up();
await page.waitForTimeout(800); // any stray debounced write would have fired
const nw = await writes();
for (let i = 0; i < nw; i++) {
  check(`01_write_${i}_no_preview_coords`, await writeWallAt(i, 0.70), false);
  check(`01_write_${i}_has_committed`, await writeWallAt(i, 0.60), true);
}
check('01_server_geom_is_snapshot', Math.abs((await roomSrv('r1'))[1][0] - 0.60) < 1e-6);
check('01_local_geom_is_snapshot', Math.abs((await roomLive('r1'))[1][0] - 0.60) < 1e-6);
// a normal pointerup still produces EXACTLY ONE write
{
  const before = await writes();
  await page.mouse.move(h600x, h550y);
  await page.mouse.down();
  await page.mouse.move(h650x, h550y, { steps: 3 });
  await settle();
  await page.mouse.up();
  await page.waitForTimeout(800);
  check('01_single_write_per_commit', (await writes()) - before, 1);
  check('01_commit_reached_server', Math.abs((await roomSrv('r1'))[1][0] - 0.65) < 0.011);
}
await restore();

// ================= HP-1550-03: pointercancel = abort, not commit =============
await enter('resize');
await settle();
{
  const w0 = await writes();
  const [ax, ay] = await screenPt(550, 360);
  const [bx] = await screenPt(650, 360);
  await page.mouse.move(ax, ay);
  await page.mouse.down();
  await page.mouse.move(bx, ay, { steps: 3 });
  await settle();
  check('03_preview_moved', Math.abs((await roomLive('r1'))[1][0] - 0.65) < 0.011);
  // the system interrupts the stream (app switch, palm rejection)
  await page.evaluate(() => {
    const c = window.__card;
    const pid = c._resize.activePointerId;
    const el = c.renderRoot.querySelector('.rszhandle');
    el.dispatchEvent(new PointerEvent('pointercancel', { pointerId: pid, bubbles: true }));
    // the lostpointercapture that follows a cancel must not double-fire
    el.dispatchEvent(new PointerEvent('lostpointercapture', { pointerId: pid, bubbles: true }));
  });
  await settle();
  check('03_snapshot_back_live', Math.abs((await roomLive('r1'))[1][0] - 0.55) < 1e-6);
  check('03_server_untouched', Math.abs((await roomSrv('r1'))[1][0] - 0.55) < 1e-6);
  check('03_undo_empty', await page.evaluate(() => window.__card._geometryHistory.size), 0);
  check('03_drag_cleared', await page.evaluate(() => !window.__card._resize.dragging));
  await page.waitForTimeout(800);
  check('03_no_pending_write', (await writes()) - w0, 0);
  await page.mouse.up();
}
await restore();
check('03_legacy_corner_scale_absent', await page.evaluate(() =>
  !window.__card.renderRoot.querySelector('.rszcorner, .rszknob')));
await restore();

// ============ HP-1550-04: a door mid-wall must not shadow the handle =========
await enter('resize');
await page.evaluate(() => {
  const c = window.__card;
  const sp = c._serverCfg.spaces.find((s) => s.id === 'f1');
  // exactly at the midpoint of r1's right wall (y 0.14..0.58 → 0.36)
  sp.openings = [{ id: 'opm', type: 'door', x: 0.55, y: 0.36, angle: 90, length: 0.08 }];
  c._cfgEpoch++; c.requestUpdate();
  return c.updateComplete && true;
});
await settle();
{
  const [hx, hy] = await screenPt(550, 360);
  const [tx] = await screenPt(650, 360);
  // the REAL hit test: the topmost interactive element must be the handle
  const top = await page.evaluate(([x, y]) => {
    const el = window.__card.shadowRoot.elementFromPoint(x, y);
    return el ? el.getAttribute('class') || '' : '';
  }, [hx, hy]);
  check('04_handle_wins_hit_test', String(top).includes('rszhandle'));
  await page.mouse.move(hx, hy);
  await page.mouse.down();
  await page.mouse.move(tx, hy, { steps: 4 });
  await settle();
  check('04_no_opening_drag', await page.evaluate(() => !window.__card._opDrag));
  check('04_wall_drag_started', await page.evaluate(() => window.__card._resize.dragging));
  await page.mouse.up();
  await settle();
  check('04_wall_moved', Math.abs((await roomSrv('r1'))[1][0] - 0.65) < 0.011);
  const op = await page.evaluate(() => window.__card._serverCfg.spaces.find((s) => s.id === 'f1').openings[0]);
  check('04_door_travelled_with_wall', Math.abs(op.x - 0.65) < 0.011);
}
await restore();

await finish(browser, { done: true });
