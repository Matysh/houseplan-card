/** #861 AC3/AC5: freeze this whole common characterization BEFORE extraction.
 * This proves existing physical gestures and rigid hosted-opening RELEASE.
 * Held opening preview is intentionally separate: the original fdc7... RED
 * remains immutable and AC11 owns its explicit RED -> GREEN delta.
 */
import assert from 'node:assert/strict';
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1280, height: 960 });
const out = {};
const settle = () => page.evaluate(() => window.__hpTest.settled());
const writesSettled = () => page.evaluate(() => window.__hpTest.waitForWrites());
const at = (x, y) => page.evaluate(([x, y]) => {
  const svg = window.__card.renderRoot.querySelector('.stage svg');
  const p = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM());
  return { x: p.x, y: p.y };
}, [x, y]);
const sample = () => page.evaluate(() => {
  const c = window.__card, root = c.renderRoot;
  // Observe painted live geometry, never the transparent physical hit target.
  const ink = root.querySelector('[data-hp-live-editor] .physical-drag');
  const box = ink?.getBoundingClientRect();
  let painted = !!ink && !!box && box.width > 0 && box.height > 0;
  for (let node = ink; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0)
      painted = false;
  }
  return { full: window.__physicalProof.full, live: c._liveEditorPaintCount,
    writes: window.__physicalProof.writes, history: c._geometryHistory.size,
    space: structuredClone(c._serverCfg.spaces.find(s => s.id === 'physical')),
    selection: root.querySelector('.physical-hit.selected')?.getAttribute('data-id'),
    path: ink?.outerHTML || null, painted,
    trustedDowns: [...window.__physicalProof.trustedDowns],
  };
});
const near = (a, b, tolerance = 1e-6) => Math.abs(a - b) <= tolerance;
const configEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

try {
  await page.evaluate(async () => {
    await window.__hpTest.setServerConfig(cfg => {
      cfg.model_version = 10;
      cfg.spaces = [{ id: 'physical', title: 'Physical gestures', cell_cm: 5,
        view_box: [0, 0, 1, 1], rooms: [], wall_segments: [],
        partitions: [
          { id: 'p_move', a: [.2, .3], b: [.55, .3], cm: 20 },
          { id: 'p_bottom', a: [.2, .65], b: [.55, .65], cm: 20 },
          { id: 'p_top', a: [.2, .65], b: [.55, .65], cm: 20 },
        ],
        wall_columns: [
          { id: 'c_rotate', shape: 'square', center: [.75, .3], cm: 100, angle: 0 },
          { id: 'c_move', shape: 'square', center: [.7, .75], cm: 60, angle: 0 },
          { id: 'c_duplicate', shape: 'square', center: [.8, .75], cm: 60, angle: 0 },
        ],
        openings: [{ id: 'p_door', type: 'door', x: .375, y: .3, angle: 0,
          length: .08, host: { kind: 'partition', id: 'p_move', t: .5 } }],
      }];
    });
    await window.__hpTest.switchSpace('physical');
    await window.__hpTest.setMode('plan');
    await window.__hpTest.setTool('select');
  });
  await page.waitForFunction(() => !window.__card.renderRoot.querySelector('.stage.mode-transition'));
  await settle(); await writesSettled(); await settle();
  await page.evaluate(async () => {
    const c = window.__card;
    window.__physicalProof = { full: 0, writes: 0, trustedDowns: [] };
    c.renderRoot.querySelector('.stage').addEventListener('pointerdown', event => {
      window.__physicalProof.trustedDowns.push({
        trusted: event.isTrusted, hp: event.target.getAttribute('data-hp'),
      });
    }, { capture: true });
    const render = c._renderBody.bind(c);
    // Diagnostic spy only: execute the real renderer and observe its calls.
    c._renderBody = function (...args) { window.__physicalProof.full++; return render(...args); }; // private-ok: count the real renderer while returning its unmodified result; never set gesture state
    const callWS = c.hass.callWS.bind(c.hass);
    c.hass = { ...c.hass, callWS: async message => {
      if (message.type === 'houseplan/config/set') window.__physicalProof.writes++;
      return callWS(message);
    } };
    await window.__hpTest.settled();
  });

  const original = await sample();
  const start = await at(275, 300), goal = await at(325, 325);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down(); await settle();
  const down = await sample();
  assert.equal(down.full - original.full, 1, 'physical down produces exactly one full render');
  assert.deepEqual(down.trustedDowns.at(-1), { trusted: true, hp: 'partition' },
    'the reference gesture enters through a trusted native partition hit');
  for (let step = 1; step <= 12; step++) {
    await page.mouse.move(start.x + (goal.x - start.x) * step / 12,
      start.y + (goal.y - start.y) * step / 12);
  }
  await settle();
  const held = await sample();
  assert.equal(held.full - down.full, 0, 'twelve held moves never full-render');
  assert.ok(held.live > down.live, 'held movement uses actual live frames');
  assert.notEqual(held.path, original.path, 'native held drag actually paints the physical body');
  assert.equal(held.painted, true, 'the changed physical path is effectively visible live ink');
  assert.ok(configEqual(held.space, original.space), 'held physical preview is not a premature config write');
  assert.equal(held.writes, original.writes, 'held preview performs no config write');
  assert.equal(held.history, original.history, 'held preview records no history');
  // Deliberately no held-opening-follow expectation in the common baseline:
  // immutable smoke_physical_body_gestures.mjs proves that old defect RED.
  await page.mouse.up(); await settle();
  const released = await sample();
  assert.equal(released.full - held.full, 1, 'physical up produces exactly one full render');
  await writesSettled();
  const moved = await sample(), partition = moved.space.partitions.find(p => p.id === 'p_move');
  const opening = moved.space.openings[0];
  out.partitionGridAndRigidOpening = near(partition.a[0], .25) && near(partition.a[1], .325)
    && near(partition.b[0], .6) && near(partition.b[1], .325)
    && near(opening.host.t, .5) && near(opening.x, .425) && near(opening.y, .325);
  out.physicalRenderRouteOneZeroOne = true;
  out.acceptedGestureOneHistoryAndWrite = moved.history === original.history + 1
    && moved.writes === original.writes + 1;

  // Ctrl+Z cancels the still-held gesture, rather than undoing the earlier step.
  const cancelStart = await at(325, 325), cancelGoal = await at(375, 350);
  await page.mouse.move(cancelStart.x, cancelStart.y); await page.mouse.down();
  await page.mouse.move(cancelGoal.x, cancelGoal.y, { steps: 6 }); await settle();
  await page.keyboard.press('Control+z'); await settle();
  await page.mouse.up(); await writesSettled();
  const cancelled = await sample();
  out.nativeUndoCancelsHeldBodyWithoutHistoryOrWrite = configEqual(cancelled.space, moved.space)
    && cancelled.history === moved.history && cancelled.writes === moved.writes;

  // Rotate through the real square-column handle, first snapped then Shift-free.
  const center = await at(750, 300);
  await page.mouse.click(center.x, center.y); await settle();
  const rotate = async (delta, shift = false) => {
    const handle = page.locator('.physical-chrome[data-kind="square-selection"] .rotate-handle');
    if (await handle.count() === 0) {
      // Native rotation can leave the body unselected after its accepted click
      // tail. Re-enter the next independent gesture by selecting it normally,
      // outside the existing 360ms double-tap window; never set selection state.
      await page.waitForTimeout(400);
      await page.mouse.click(center.x, center.y); await settle();
    }
    const rect = await handle.boundingBox(); assert.ok(rect, 'square selection has its real rotate handle');
    const p = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    const angle = delta * Math.PI / 180, dx = p.x - center.x, dy = p.y - center.y;
    if (shift) await page.keyboard.down('Shift');
    await page.mouse.move(p.x, p.y); await page.mouse.down();
    await page.mouse.move(center.x + dx * Math.cos(angle) - dy * Math.sin(angle),
      center.y + dx * Math.sin(angle) + dy * Math.cos(angle), { steps: 12 });
    await page.mouse.up();
    if (shift) await page.keyboard.up('Shift');
    await writesSettled();
    return (await sample()).space.wall_columns.find(c => c.id === 'c_rotate').angle;
  };
  out.columnRotationFiveDegreeStep = near(await rotate(12), 10, .05);
  out.columnShiftRotationIsFree = near(await rotate(7.3, true), 17.3, .1);

  // Exactly coincident bodies cycle only after the existing 380ms threshold.
  const overlap = await at(300, 650);
  await page.mouse.click(overlap.x, overlap.y); await settle();
  const first = (await sample()).selection;
  await page.waitForTimeout(420);
  await page.mouse.click(overlap.x, overlap.y); await settle();
  const second = (await sample()).selection;
  out.realOverlappingBodyCycle = ['p_top', 'p_bottom'].includes(first)
    && ['p_top', 'p_bottom'].includes(second) && first !== second;

  const beforeDuplicate = await sample(), from = await at(700, 750), to = await at(800, 750);
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 }); await page.mouse.up();
  await writesSettled();
  const duplicate = await sample();
  out.duplicateColumnRefusedWithoutWriteOrHistory = configEqual(duplicate.space, beforeDuplicate.space)
    && duplicate.history === beforeDuplicate.history && duplicate.writes === beforeDuplicate.writes;
  out.duplicateColumnExplained = await page.evaluate(() =>
    /column.*already|already.*column/i.test(window.__card.renderRoot.querySelector('.toast')?.textContent || ''));

  // Two jittered clicks below 5px remain taps and open the original properties.
  const beforeJitter = await sample(), tap = await at(325, 325);
  for (let index = 0; index < 2; index++) {
    await page.mouse.move(tap.x, tap.y); await page.mouse.down();
    await page.mouse.move(tap.x + 2, tap.y); await page.mouse.up();
    if (index === 0) await page.waitForTimeout(90);
  }
  await settle();
  out.jitterBelowFivePixelsPreservesDoubleTapDialog = await page.locator('hp-dialog[data-kind="physical"]').count() === 1;
  await page.evaluate(() => window.__hpUiCapture?.('physical-dialog', 'hp-dialog[data-kind="physical"]'));
  const afterJitter = await sample();
  out.jitterNeverWritesOrRecordsGeometry = configEqual(afterJitter.space, beforeJitter.space)
    && afterJitter.history === beforeJitter.history && afterJitter.writes === beforeJitter.writes;
  checkAll(out);
  await finish(browser);
} catch (error) {
  console.log('diagnostic physical-common-characterization', JSON.stringify({ out, sample: await sample().catch(() => null) }));
  await browser.close(); throw error;
}

