// #900: native mouse selection/drag, measured intermediate rectangles and public input.
import { launch, check, finish } from './serve.mjs';
import { requirePinnedBrowser } from '../scripts/browser-attestation.mjs';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';
const fixture = commitWallSegmentModel({ spaces: [{ id: 'surface', title: 'Surface',
  cell_cm: 30, view_box: [0, 0, 1, 0.7], settings: { show_borders: true },
  rooms: [{ id: 'room', name: 'Room', area: null, poly: [[0.2, 0.15], [0.7, 0.15], [0.7, 0.5], [0.2, 0.5]] }],
  partitions: [] }], markers: [] }).config;
requirePinnedBrowser('#900 screen surface input');
const { page, browser } = await launch({ width: 1200, height: 920 }, 1);
const pause = () => page.waitForTimeout(250);
const nativeMode = async mode => {
  await page.locator(mode === 'view' ? '[data-hp="editor-close"]'
    : `[data-hp="mode-tab"][data-mode="${mode}"]`).filter({ visible: true }).first().click();
  await page.waitForFunction(mode => window.__card._mode === mode && !window.__card._modeTransitionBusy, mode);
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const closeRect = (a, b, dx = 0, dy = 0) => !!a && !!b
  && Math.abs(b.x - a.x - dx) <= 1 && Math.abs(b.y - a.y - dy) <= 1
  && Math.abs(b.width - a.width) <= 1 && Math.abs(b.height - a.height) <= 1;
const state = () => page.evaluate(() => {
  const c = window.__card, root = c.shadowRoot;
  const rect = root.querySelector('.wallthick-dlg')?.getBoundingClientRect();
  return { camera: { ...c._viewOr(c._baseVb()), zoom: c._zoom },
    rect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
    value: root.querySelector('.wallthick-dlg input')?.value, draft: c._wallDialog?.value,
    selection: root.getSelection()?.toString() || '', config: JSON.stringify(c._serverCfg),
    history: c._geometryHistory.size, saves: window.__surfaceSaves.length };
});
const point = (x, y) => page.evaluate(([x, y]) => {
  const svg = window.__card.shadowRoot.querySelector('svg.plan-svg');
  const p = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM()); return [p.x, p.y];
}, [x, y]);
const clickWorld = async (x, y) => { await page.mouse.click(...await point(x, y)); await pause(); };
const box = async selector => {
  const r = await page.locator(selector).boundingBox();
  if (!r) throw Error(`missing visible ${selector}`); return r;
};
const drag = async (from, dx, dy, held) => {
  await page.mouse.move(...from); await page.mouse.down();
  await page.mouse.move(from[0] + dx, from[1] + dy, { steps: 10 });
  if (held) await held();
  await page.mouse.up(); await pause();
};
await page.evaluate(async fixture => {
  const c = window.__card; window.__surfaceOriginal = structuredClone(c._serverCfg);
  window.__surfaceSaves = [];
  const call = c.hass.callWS;
  c.hass.callWS = async message => {
    if (message.type === 'houseplan/config/set') window.__surfaceSaves.push(structuredClone(message));
    return call.call(c.hass, message);
  };
  await window.__hpTest.setServerConfig(cfg => ({ ...cfg, spaces: fixture.spaces, markers: [] }));
  await window.__hpTest.setLayout({}); await window.__hpTest.setMode('plan');
  await window.__hpTest.setTool('wall-thickness');
}, fixture);
await page.waitForFunction(() => !window.__card._modeTransitionBusy);
await pause();
await clickWorld(450, 150);
const input = page.locator('.wallthick-dlg input');
await input.fill('12.5');
await input.click();
check('AC6 native input receives focus', await input.evaluate(el => el.getRootNode().activeElement === el));
let before = await state();
let r = await box('.wallthick-dlg input');
await drag([r.x + r.width - 24, r.y + r.height / 2], -r.width + 28, 0, async () => {
  const held = await state();
  check('AC1 held selection leaves camera and dialog fixed', eq(before.camera, held.camera) && closeRect(before.rect, held.rect));
});
await page.keyboard.type('9');
let after = await state();
check('AC1 native selection replaces all text', after.value, '9');
check('AC1 release leaves camera and dialog fixed', eq(before.camera, after.camera) && closeRect(before.rect, after.rect));
await input.fill('12.5');
for (const handle of ['corner', 'label']) {
  before = await state(); r = await box(handle === 'label' ? '.wallthick-dlg label' : '.wallthick-dlg');
  const from = handle === 'label' ? [r.x + r.width / 2, r.y + r.height / 2] : [r.x + 3, r.y + 3];
  await drag(from, 80, 60, async () => {
    const held = await state();
    check(`AC2 ${handle} follows held pointer 1:1`, closeRect(before.rect, held.rect, 80, 60));
    check(`AC2 ${handle} held camera config history and draft fixed`, eq(before.camera, held.camera)
      && eq(before.config, held.config) && before.history === held.history && before.saves === held.saves
      && held.value === '12.5' && held.draft === '12.5' && held.selection === '');
  });
  after = await state();
  check(`AC2 ${handle} stays on release without writes`, closeRect(before.rect, after.rect, 80, 60)
    && eq(before.camera, after.camera) && before.history === after.history && before.saves === after.saves);
}
before = await state(); r = before.rect;
await drag([r.x + 3, r.y + 3], 1, 1);
check('AC2 sub-threshold press stays still', closeRect(before.rect, (await state()).rect));
for (const terminal of ['pointercancel', 'lostpointercapture']) {
  r = await box('.wallthick-dlg'); before = await state();
  await page.locator('.wallthick-dlg').evaluate(el => el.addEventListener('pointerdown',
    event => { window.__surfacePointer = event.pointerId; }, { once: true }));
  await page.mouse.move(r.x + 3, r.y + 3); await page.mouse.down(); await page.mouse.move(r.x + 23, r.y + 23);
  const held = await state();
  await page.locator('.wallthick-dlg').evaluate((el, terminal) => {
    if (terminal === 'lostpointercapture') el.releasePointerCapture(window.__surfacePointer);
    else el.dispatchEvent(new PointerEvent(terminal, { pointerId: window.__surfacePointer, bubbles: true }));
  }, terminal);
  await page.mouse.move(r.x + 53, r.y + 53); await page.mouse.up(); await pause(); after = await state();
  check(`AC2 ${terminal} retains last position and retires owner`, closeRect(held.rect, after.rect)
    && eq(before.camera, after.camera) && before.history === after.history && before.saves === after.saves);
}
// Trusted capture must retain ownership outside the viewport; both boundaries.
for (const direction of [1, -1]) {
  r = await box('.wallthick-dlg');
  await drag([r.x + 3, r.y + 3], direction * 2000, direction * 2000);
  check(`AC3 clamp ${direction}`, await page.evaluate(() => {
    const root = window.__card.shadowRoot, d = root.querySelector('.wallthick-dlg').getBoundingClientRect();
    const s = root.querySelector('.stage').getBoundingClientRect();
    return d.left >= s.left + 7 && d.top >= s.top + 7 && d.right <= s.right - 7 && d.bottom <= s.bottom - 7;
  }));
}
await page.setViewportSize({ width: 900, height: 700 }); await pause();
check('AC3 stage resize re-clamps', await page.evaluate(() => {
  const root = window.__card.shadowRoot, d = root.querySelector('.wallthick-dlg').getBoundingClientRect();
  const s = root.querySelector('.stage').getBoundingClientRect(); return d.right <= s.right - 7 && d.bottom <= s.bottom - 7;
}));
await page.setViewportSize({ width: 1200, height: 920 }); await pause();
// Intermediate pan and settled wheel/button frames, with and without a prior dialog drag.
const cameraChecks = async name => {
  before = await state();
  const empty = await page.evaluate(() => {
    const root = window.__card.shadowRoot, s = root.querySelector('.stage').getBoundingClientRect();
    for (let y = s.bottom - 100; y > s.top + 100; y -= 40) for (let x = s.right - 200; x > s.left + 100; x -= 40) {
      const el = root.elementFromPoint(x, y);
      if (el && !el.closest('.wallthick-dlg,.editor-secondary,.dev,.roomlabel,button,hp-dialog')) return [x, y];
    }
    throw Error('no empty scene point');
  });
  await drag(empty, 120, 60, async () => {
    const held = await state(); check(`AC4 ${name} held pan keeps screen rect`, closeRect(before.rect, held.rect));
  });
  after = await state();
  check(`AC4 ${name} pan actually moves camera`, !eq(before.camera, after.camera));
  check(`AC4 ${name} pan terminal keeps screen rect`, closeRect(before.rect, after.rect));
  await page.mouse.move(...empty); await page.mouse.wheel(0, -300); await pause();
  after = await state(); check(`AC4 ${name} wheel changes camera only`, !eq(before.camera, after.camera) && closeRect(before.rect, after.rect));
  for (const selector of ['[data-hp="zoom-in"]', '[data-hp="zoom-out"]']) {
    const button = page.locator(selector);
    await button.click(); await pause();
    check(`AC4 ${name} ${selector} keeps screen rect`, closeRect(before.rect, (await state()).rect));
  }
};
await cameraChecks('moved');
await page.keyboard.press('Escape'); await pause(); await clickWorld(450, 150);
await input.fill('12.5'); await cameraChecks('initial');
for (const target of ['.wallthick-dlg input', '.wallthick-dlg']) {
  await input.focus(); before = await state(); r = await box(target);
  await page.mouse.move(r.x + 4, r.y + r.height / 2); await page.mouse.wheel(0, -300); await pause();
  after = await state(); check(`AC5 wheel ${target} keeps camera and value`, eq(before.camera, after.camera) && after.value === '12.5');
}
// Touch/pen safety: synthetic events exercise composed paths, not physical-device acceptance.
const touchSurface = async selector => page.evaluate(selector => {
  const el = window.__card.shadowRoot.querySelector(selector), r = el.getBoundingClientRect();
  const emit = (type, id, x, y, pointerType = 'touch') => el.dispatchEvent(new PointerEvent(type,
    { pointerId: id, pointerType, isPrimary: id % 2 === 1, button: 0, clientX: x, clientY: y,
      bubbles: true, composed: true, cancelable: true }));
  for (const modality of ['touch', 'pen']) {
    emit('pointerdown', 51, r.x + 10, r.y + 10, modality);
    emit('pointermove', 51, r.x + 70, r.y + 40, modality); emit('pointerup', 51, r.x + 70, r.y + 40, modality);
  }
  emit('pointerdown', 53, r.x + 20, r.y + 10); emit('pointerdown', 54, r.x + 40, r.y + 10);
  emit('pointermove', 53, r.x - 40, r.y + 10); emit('pointermove', 54, r.x + 100, r.y + 10);
  emit('pointerup', 53, r.x - 40, r.y + 10); emit('pointerup', 54, r.x + 100, r.y + 10);
}, selector);
before = await state(); await touchSurface('.wallthick-dlg input'); after = await state();
check('AC8 touch and pen on field never navigate or write', eq(before.camera, after.camera) && before.saves === after.saves);
before = await state(); r = await box('.wallthick-dlg button.on');
await drag([r.x + r.width / 2, r.y + r.height / 2], 100, 90);
after = await state(); check('AC6 button drag never moves applies or pans', closeRect(before.rect, after.rect)
  && eq(before.camera, after.camera) && before.saves === after.saves);
// Esc during capture closes without write; late move/up cannot resurrect it.
before = await state(); r = before.rect;
await page.mouse.move(r.x + 3, r.y + 3); await page.mouse.down(); await page.mouse.move(r.x + 35, r.y + 35);
await page.keyboard.press('Escape'); await page.mouse.move(r.x + 70, r.y + 70); await page.mouse.up(); await pause();
after = await state(); check('AC6 Escape retires capture without write or history', !after.rect && before.history === after.history && before.saves === after.saves);
await clickWorld(450, 150); await input.fill('12.5'); before = await state();
await input.press('Enter'); await page.evaluate(() => window.__hpTest.waitForWrites()); await pause();
after = await state(); check('AC6 Enter applies one thickness transaction', !after.rect && after.saves === before.saves + 1
  && after.history === before.history + 1 && await page.evaluate(() => window.__card._toast === window.__card._t('toast.wallthick_set')));
check('AC6 Enter wire contains entered centimetres', await page.evaluate(() =>
  window.__surfaceSaves.at(-1)?.config.spaces[0].wall_segments.some(wall => wall.cm === 12.5)));
for (const [selector, value, all] of [['.wallthick-dlg button.on', '15', false], ['.wallthick-dlg button.ghost', '18', true]]) {
  await clickWorld(450, 150); await input.fill(value); before = await state();
  await page.locator(selector).click(); await page.evaluate(() => window.__hpTest.waitForWrites()); await pause(); after = await state();
  check(`AC6 ${all ? 'apply-room' : 'checkmark'} saves one history transaction`, !after.rect
    && after.saves === before.saves + 1 && after.history === before.history + 1);
  check(`AC6 ${all ? 'apply-room' : 'checkmark'} wire has requested thickness`, await page.evaluate(({ value, all }) => {
    const walls = window.__surfaceSaves.at(-1).config.spaces[0].wall_segments;
    return all ? walls.every(w => w.cm === Number(value)) : walls.some(w => w.cm === Number(value));
  }, { value, all }));
}
// LED picker is reached by real tool/canvas input, never private picker setup.
await page.evaluate(async () => { await window.__hpTest.setMode('devices'); await window.__hpTest.setTool('led-strip'); });
await pause(); await clickWorld(300, 300); await clickWorld(400, 300);
await page.keyboard.press('Escape'); await pause();
const picker = page.locator('hp-dialog[data-kind="led-picker"]');
await picker.waitFor();
for (const selector of ['hp-dialog[data-kind="led-picker"] .title', '.led-picker', '[data-led-action="later"]']) {
  before = await state(); r = await box(selector);
  await drag([r.x + r.width / 2, r.y + r.height / 2], 80, 40);
  check(`AC7 LED pointer ${selector} cannot navigate`, eq(before.camera, (await state()).camera));
}
before = await state(); await touchSurface('hp-dialog[data-kind="led-picker"]');
check('AC8 LED touch and pen cannot navigate', eq(before.camera, (await state()).camera));
await page.click('[data-led-action="later"]');
await page.evaluate(async () => {
  await window.__hpTest.setMode('plan'); await window.__hpTest.setTool('select');
});
await page.waitForFunction(() => !window.__card._modeTransitionBusy);
before = await state();
await page.evaluate(() => {
  const el = window.__card.shadowRoot.querySelector('.stage'), s = el.getBoundingClientRect();
  const ev = (type, id, x) => el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch',
    clientX: s.left + x, clientY: s.top + 400, button: 0, bubbles: true, composed: true, isPrimary: id === 61 }));
  ev('pointerdown', 61, 600); ev('pointerdown', 62, 640); ev('pointermove', 61, 550); ev('pointermove', 62, 690);
  ev('pointerup', 61, 550); ev('pointerup', 62, 690);
});
check('AC8 empty scene pinch still zooms', (await state()).camera.zoom > before.camera.zoom);
// Future native fields inside .stage have no local event stoppers: only the
// production composed-path guards may protect them. The DOM fixture is not a
// card-state write and intentionally exercises the generic input contract.
await page.evaluate(() => {
  const el = document.createElement('input'); el.className = 'surface-fixture'; el.value = '12345';
  el.style.cssText = 'position:absolute;z-index:80;left:40px;top:80px;width:180px';
  window.__card.shadowRoot.querySelector('.stage').append(el);
});
before = await state(); r = await box('.surface-fixture');
await drag([r.x + 100, r.y + r.height / 2], -95, 0);
await page.keyboard.type('9');
check('AC9 future input selects without scene navigation', eq(before.camera, (await state()).camera)
  && await page.locator('.surface-fixture').inputValue() === '9');
await page.mouse.move(r.x + 30, r.y + r.height / 2); await page.mouse.wheel(0, -300); await pause();
check('AC9 future input wheel cannot zoom', eq(before.camera, (await state()).camera));
await page.evaluate(() => window.__card.shadowRoot.querySelector('.surface-fixture').remove());
await page.evaluate(async () => {
  await window.__hpTest.setServerConfig(window.__surfaceOriginal);
  await window.__hpTest.setMode('view');
});
await page.waitForFunction(() => !window.__card._modeTransitionBusy); await pause();
await page.evaluate(() => {
  const el = document.createElement('input'); el.className = 'surface-fixture';
  el.style.cssText = 'position:absolute;z-index:80;left:40px;top:80px;width:180px';
  window.__card.shadowRoot.querySelector('.stage').append(el);
});
before = await state();
await page.evaluate(() => {
  const root = window.__card.shadowRoot, stage = root.querySelector('.stage'), field = root.querySelector('.surface-fixture');
  const ev = (el, type, id, x) => el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch',
    clientX: x, clientY: 400, bubbles: true, composed: true, button: 0, isPrimary: id === 71 }));
  ev(stage, 'pointerdown', 71, 600); ev(field, 'pointerdown', 72, 640);
  ev(field, 'pointermove', 72, 780); ev(field, 'pointerup', 72, 780); ev(stage, 'pointerup', 71, 600);
});
check('AC8 View surface contact never becomes scene second finger', eq(before.camera, (await state()).camera));
await page.evaluate(() => window.__card.shadowRoot.querySelector('.surface-fixture').remove());
// Existing native dialogs and both editor trays retain selection and ownership.
const modalGesture = async (kind, open, withField = true) => {
  await open(); await pause();
  const dialog = page.locator(`hp-dialog[data-kind="${kind}"]`);
  await dialog.waitFor(); before = await state();
  if (withField) {
    const field = dialog.locator('input[type="text"]').first();
    const original = await field.inputValue(); await field.fill('654321'); r = await field.boundingBox();
    await drag([r.x + Math.min(r.width - 8, 120), r.y + r.height / 2], -Math.min(r.width - 12, 116), 0);
    await page.keyboard.type('9');
    check(`AC9 ${kind} native selection`, await field.inputValue(), '9');
    await field.fill(original);
  }
  r = await dialog.locator('.title').boundingBox();
  await drag([r.x + r.width / 2, r.y + r.height / 2], 80, 40);
  await page.mouse.move(r.x + 10, r.y + 10); await page.mouse.wheel(0, -300); await pause();
  check(`AC9 ${kind} modal owns drag and wheel`, eq(before.camera, (await state()).camera));
  await page.keyboard.press('Escape'); await pause();
};
await nativeMode('plan');
await modalGesture('room', () => page.evaluate(() => window.__hpTest.openRoomEdit('r1')));
await modalGesture('space', () => page.evaluate(() => window.__hpTest.openSpaceDialog('edit', window.__card._space)));
await nativeMode('devices');
await modalGesture('marker', () => page.evaluate(() => window.__hpTest.openMarkerDialog('d_light1')));
await nativeMode('view');
await page.evaluate(() => window.__hpTest.setServerConfig(cfg => {
  cfg.markers = (cfg.markers || []).filter(marker => marker.id !== 'd_light1');
  cfg.markers.push({ id: 'd_light1', binding: 'device:d_light1', space: window.__card._space, tap_action: 'info' });
  return cfg;
}));
await modalGesture('info', () => page.locator('[data-hp="device"][data-id="d_light1"]').click(), false);
for (const [mode, tool, fieldSelector] of [['plan', 'draw', '.drawwall input'], ['decor', 'line', '.editor-secondary input[type="number"]']]) {
  await nativeMode(mode); await page.evaluate(tool => window.__hpTest.setTool(tool), tool);
  await page.waitForFunction(() => !window.__card._modeTransitionBusy); await pause();
  const field = page.locator(fieldSelector).first();
  const original = await field.inputValue(); await field.fill('12.5'); r = await field.boundingBox(); before = await state();
  // These 73px controls expose a native spinner: start just after the four
  // entered glyphs, before the spinner's hit box, and finish before the text.
  await drag([r.x + 38, r.y + r.height / 2], -30, 0); await page.keyboard.type('9');
  check(`AC9 ${mode} tray native selection`, await field.inputValue(), '9');
  await field.fill(original); await page.mouse.wheel(0, -300); await pause();
  r = await box('.editor-secondary'); await drag([r.x + 3, r.y + 3], 80, 40);
  check(`AC9 ${mode} tray keeps scene fixed`, eq(before.camera, (await state()).camera));
}
await finish(browser);
