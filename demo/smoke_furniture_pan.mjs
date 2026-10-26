// #1081/UI-037: real mouse input; persisted decor/history remain unchanged on pan/cancel.
import { launch, check, finish, requirePinnedBrowser } from './serve.mjs';
requirePinnedBrowser();
const { page, browser } = await launch({ width: 1400, height: 1000 }, 1, [], { reducedMotion: 'reduce' });
const card = page.locator('houseplan-card');
const state = () => page.evaluate(() => ({ count: window.__card._decorList.length, history: window.__card._geometryHistory.size,
  tool: window.__card._decorTool, armed: !!window.__card._furnPalette, cursor: getComputedStyle(window.__card.renderRoot.querySelector('.stage')).cursor }));
const arm = async () => {
  await page.evaluate(async () => { await window.__hpTest.setTool('furniture'); });
  await card.locator('.furnitem[data-category="sofa"]').click();
  await card.locator('.furnitem[data-symbol="sofa"]').click();
  await page.waitForFunction(() => !!window.__card._furnPalette && !window.__card._suppressClick);
};
const point = async () => {
  const box = await card.locator('.stage').boundingBox();
  return { x: box.x + box.width * .32, y: box.y + box.height * .72 };
};
try {
  await page.evaluate(async () => {
    await window.__hpTest.setServerConfig(config => ({ ...config, markers: [], spaces: [
      { id: 'pan', title: 'Furniture pan', cell_cm: 5, view_box: [0, 0, 1, 1], wall_segments: [], rooms: [], decor: [] },
      { id: 'other', title: 'Other', cell_cm: 5, view_box: [0, 0, 1, 1], wall_segments: [], rooms: [], decor: [] },
    ] }));
    await window.__hpTest.setMode('decor');
  });
  await card.locator('[data-hp="zoom-fit"]').click();
  await arm(); const p = await point(), initial = await state();
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  check('furniture.press_does_not_stamp', (await state()).count, initial.count);
  await page.mouse.up(); await page.evaluate(async () => window.__hpTest.waitForWrites());
  check('furniture.click_stamps_once_on_up', (await state()).count, initial.count + 1);
  check('furniture.click_selects_result', (await state()).tool, 'select');
  await arm(); const panBefore = await state();
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  await page.mouse.move(p.x + 90, p.y + 20, { steps: 8 });
  check('furniture.pan_cursor', (await state()).cursor, 'grabbing');
  await page.mouse.move(p.x, p.y, { steps: 8 }); await page.mouse.up();
  await page.waitForFunction(() => !window.__card._suppressClick);
  check('furniture.threshold_return_adds_nothing', (await state()).count, panBefore.count);
  check('furniture.pan_adds_no_history', (await state()).history, panBefore.history);
  check('furniture.pan_retains_symbol', (await state()).armed, true);
  for (const terminal of ['cancel', 'capture', 'blur']) {
    await page.mouse.move(p.x, p.y); await page.mouse.down();
    await page.evaluate(terminal => {
      const c = window.__card, stage = c.renderRoot.querySelector('.stage'), press = c._furnTouchPending;
      if (!press) throw Error('Mouse press was not armed');
      if (terminal === 'cancel') stage.dispatchEvent(new PointerEvent('pointercancel', { pointerId: press.pid, pointerType: 'mouse', bubbles: true }));
      else if (terminal === 'capture') stage.releasePointerCapture(press.pid);
      else window.dispatchEvent(new Event('blur'));
    }, terminal);
    await page.mouse.up(); await page.evaluate(async () => window.__hpTest.waitForWrites());
    check(`furniture.${terminal}_late_up_adds_nothing`, (await state()).count, panBefore.count);
  }
  await page.mouse.click(p.x, p.y, { button: 'right' });
  check('furniture.right_button_adds_nothing', (await state()).count, panBefore.count);
  await page.mouse.click(p.x, p.y); await page.evaluate(async () => window.__hpTest.waitForWrites());
  check('furniture.next_deliberate_click_works', (await state()).count, panBefore.count + 1);
  await arm(); const count = (await state()).count;
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  await page.evaluate(async () => { await window.__hpTest.switchSpace('other'); });
  await page.mouse.up();
  check('furniture.floor_change_no_foreign_stamp', (await state()).count, 0);
  await page.evaluate(async () => { await window.__hpTest.switchSpace('pan'); });
  check('furniture.floor_change_no_original_stamp', (await state()).count, count);
} finally { await finish(browser); }
