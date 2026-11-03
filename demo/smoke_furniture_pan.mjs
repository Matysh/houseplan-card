import { prepareDesktopControls } from './helpers/desktop-controls.mjs';
// #1081/UI-037: real mouse input; persisted decor/history remain unchanged on pan/cancel.
import { launch, check, finish, requirePinnedBrowser } from './serve.mjs';
requirePinnedBrowser();
const { page, browser } = await launch({ width: 2000, height: 1000 }, 1, [], { reducedMotion: 'reduce' });
await prepareDesktopControls(page);
const card = page.locator('houseplan-card');
const state = () => page.evaluate(() => ({ count: window.__card._decorList.length, history: window.__card._geometryHistory.size,
  writes: window.__furnitureConfigWrites,
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
    const card=window.__card, call=card.hass.callWS.bind(card.hass);
    window.__furnitureConfigWrites=0;
    card.hass={...card.hass,callWS:async message=>{
      if(message.type==='houseplan/config/set')window.__furnitureConfigWrites++;
      return call(message);
    }};
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
  // An existing object's right-click now intentionally selects it and opens
  // the context menu (#1035). Keep the primary-button placement witness on
  // actual empty canvas, independently verified against rendered object bounds.
  const empty = await card.locator('.stage').evaluate(stage => {
    const root = stage.getRootNode(), b = stage.getBoundingClientRect();
    const shapes = [...stage.querySelectorAll('[data-hp="decor"]')].map(n => n.getBoundingClientRect());
    for (const fx of [.6, .45, .25]) for (const fy of [.8, .6, .4]) {
      const x = b.x + b.width * fx, y = b.y + b.height * fy;
      const hit = root.elementFromPoint(x, y);
      if (hit?.closest('.stage') === stage && !shapes.some(r => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom))
        return { x, y };
    }
    throw Error('No visibly empty canvas point for the primary-button witness');
  });
  await page.mouse.click(empty.x, empty.y, { button: 'right' });
  check('furniture.right_button_adds_nothing', (await state()).count, panBefore.count);
  check('furniture.empty_right_button_retains_symbol', (await state()).armed, true);
  await page.mouse.click(empty.x, empty.y); await page.evaluate(async () => window.__hpTest.waitForWrites());
  check('furniture.next_deliberate_click_works', (await state()).count, panBefore.count + 1);
  await arm(); const contextBefore = await state();
  await page.mouse.click(p.x, p.y, { button: 'right' });
  await page.evaluate(async () => window.__hpTest.waitForWrites());
  check('furniture.object_right_button_adds_nothing', (await state()).count, contextBefore.count);
  check('furniture.object_right_button_adds_no_history', (await state()).history, contextBefore.history);
  check('furniture.object_right_button_adds_no_write', (await state()).writes, contextBefore.writes);
  check('furniture.object_right_button_selects', (await state()).tool, 'select');
  await card.locator('[data-hp="decor-context-menu"]').waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await card.locator('[data-hp="decor-context-menu"]').waitFor({ state: 'hidden' });
  await arm(); const count = (await state()).count;
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  await page.evaluate(async () => { await window.__hpTest.switchSpace('other'); });
  await page.mouse.up();
  check('furniture.floor_change_no_foreign_stamp', (await state()).count, 0);
  await page.evaluate(async () => { await window.__hpTest.switchSpace('pan'); });
  check('furniture.floor_change_no_original_stamp', (await state()).count, count);
} finally { await finish(browser); }
