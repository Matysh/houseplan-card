// #911 ordinary public Thickness opening; reused by the existing standalone smoke.
import { check } from './serve.mjs';
import { requirePinnedBrowser } from '../scripts/browser-attestation.mjs';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';

const fixture = commitWallSegmentModel({ model_version: 10, spaces: [{ id: 'selection', title: 'Selection',
  cell_cm: 30, view_box: [0, 0, 1, 0.7], settings: { show_borders: true },
  rooms: [{ id: 'room', name: 'Room', area: null,
    poly: [[0.2, 0.15], [0.7, 0.15], [0.7, 0.5], [0.2, 0.5]] }],
  walls: [{ key: '', a: [.2, .15], b: [.7, .15], cm: 15 }],
  partitions: [{ id: 'partition', a: [0.2, 0.6], b: [0.7, 0.6], cm: 20 }] },
  { id: 'other', title: 'Other', rooms: [], cell_cm: 30 }], markers: [] }).config;

export async function wallthickSelectionScenario(page) {
  requirePinnedBrowser('#911 wall selection');
  const original = await page.evaluate(() => structuredClone(window.__card._serverCfg));
  const originalLayout = await page.evaluate(() => structuredClone(window.__card._layout));
  const settle = async () => {
    await page.evaluate(() => window.__hpTest.settled());
    await page.waitForFunction(() => !window.__card._modeTransitionBusy);
  };
  const point = (x, y) => page.evaluate(([x, y]) => {
    const svg = window.__card.shadowRoot.querySelector('svg.plan-svg');
    const p = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM()); return [p.x, p.y];
  }, [x, y]);
  const opening = async (x, y) => {
    await page.locator('[data-hp="zoom-fit"]').filter({ visible: true }).click(); await settle();
    await page.locator('[data-hp="tool"][data-tool="wall-thickness"]').filter({ visible: true }).click();
    await page.mouse.click(...await point(x, y)); await settle();
  };
  await page.evaluate(async fixture => {
    window.__selectionBands = () => [...window.__card.shadowRoot.querySelectorAll('.wallthick-hover')].filter(p => {
      for (let el = p; el instanceof Element; el = el.parentElement) {
        const style = getComputedStyle(el);
        if (style.opacity === '0' || style.visibility === 'hidden' || style.display === 'none') return false;
      }
      return true;
    });
    window.__selectionSaves = [];
    const hass = window.__card.hass, call = hass.callWS;
    window.__selectionCallWS = call;
    hass.callWS = async message => {
      if (message.type === 'houseplan/config/set' || message.type === 'houseplan/layout/set')
        window.__selectionSaves.push(structuredClone(message));
      return call.call(hass, message);
    };
    await window.__hpTest.setServerConfig(cfg => ({ ...cfg, model_version: fixture.model_version, spaces: fixture.spaces, markers: [] }));
    await window.__hpTest.setLayout({}); await window.__hpTest.setMode('plan');
  }, fixture);
  await settle();
  const state = () => page.evaluate(() => {
    const c = window.__card;
    return { config: JSON.stringify(c._serverCfg), layout: JSON.stringify(c._layout),
      history: c._geometryHistory.size, saves: window.__selectionSaves.length };
  });
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const camera = () => page.evaluate(() => ({ ...window.__card._viewOr(window.__card._baseVb()) }));
  const bandAt = (x, y) => page.evaluate(([x, y]) => {
    const root = window.__card.shadowRoot, bands = window.__selectionBands();
    if (bands.length !== 1) return false;
    const p = bands[0], r = p.getBoundingClientRect();
    const expected = new DOMPoint(x, y).matrixTransform(root.querySelector('svg.plan-svg').getScreenCTM());
    return p.getAttribute('d') === window.__selectionD && p.isPointInFill(new DOMPoint(x, y)) && getComputedStyle(p).pointerEvents === 'none'
      && Number(getComputedStyle(p).fillOpacity) > 0 && r.width > 0 && r.height > 0
      && Math.abs(r.x + r.width / 2 - expected.x) < 1
      && Math.abs(r.y + r.height / 2 - expected.y) < 1;
  }, [x, y]);
  const emptyPoint = () => page.evaluate(() => {
    const root = window.__card.shadowRoot, s = root.querySelector('.stage').getBoundingClientRect();
    for (let y = s.bottom - 70; y > s.top + 80; y -= 35) for (let x = s.right - 100; x > s.left + 100; x -= 35) {
      const el = root.elementFromPoint(x, y);
      if (el && !el.closest('.wallthick-dlg,.editor-secondary,.dev,.roomlabel,button,hp-dialog')) return [x, y];
    }
    throw Error('no empty scene point');
  });
  const drag = async (start, dx, dy, held) => {
    await page.mouse.move(...start); await page.mouse.down();
    await page.mouse.move(start[0] + dx, start[1] + dy, { steps: 8 });
    await held(); await page.mouse.up(); await settle();
  };
  for (const [kind, x, y] of [['room', 450, 150], ['partition', 450, 600]]) {
    await opening(x, y);
    await page.mouse.move(...await point(900, 650)); await settle();
    const result = await page.evaluate(([x, y]) => {
      const c = window.__card, root = c.shadowRoot;
      const bands = window.__selectionBands();
      window.__selectionD = bands[0]?.getAttribute('d');
      return { dialog: !!root.querySelector('.wallthick-dlg'), bands: bands.length,
        targetFilled: bands.length === 1 && bands[0].isPointInFill(new DOMPoint(x, y)),
        path: bands[0]?.getAttribute('d') ?? null };
    }, [x, y]);
    console.log('selection public opening', kind, JSON.stringify(result));
    check(`911 AC1 ${kind} public click opens dialog`, result.dialog);
    check(`911 AC1 ${kind} target band persists away from pointer`, result.bands === 1 && result.targetFilled);
    const before = await state();
    const input = page.locator('.wallthick-dlg [data-hp="field"][data-field="wall-thickness"]');
    check(`1011 ${kind} existing wall has one thickness field`, await input.count(), 1);
    check(`1011 ${kind} thickness is not object opacity`, await page.locator('.wallthick-dlg [data-field="object-opacity"]').count(), 0);
    await input.fill('88'); await input.focus(); await settle();
    await page.mouse.move(...await point(200, 350)); await settle();
    check(`911 AC1 ${kind} input draft and neighbour hover retain current physical target`, await bandAt(x, y)
      && await page.evaluate(() => !window.__card.shadowRoot.querySelector('.stage').classList.contains('wallhot')));
    const rect = await page.locator('.wallthick-dlg').boundingBox();
    const dx = kind === 'partition' ? -45 : 45, dy = kind === 'partition' ? -25 : 25;
    await drag([rect.x + 3, rect.y + 3], dx, dy, async () =>
      check(`911 AC2 ${kind} held dialog drag retains one physical band`, await bandAt(x, y)));
    check(`911 AC2 ${kind} terminal dialog drag retains one physical band`, await bandAt(x, y));
    const moved = await page.locator('.wallthick-dlg').boundingBox();
    check(`911 AC2 ${kind} dialog really moved`, Math.abs(moved.x - rect.x - dx) < 1 && Math.abs(moved.y - rect.y - dy) < 1);
    const panBefore = await camera();
    await drag(await emptyPoint(), -45, -30, async () =>
      check(`911 AC2 ${kind} held pan follows physical wall`, await bandAt(x, y)));
    check(`911 AC2 ${kind} terminal pan follows physical wall`, await bandAt(x, y));
    check(`911 AC2 ${kind} pan really moved camera`, !same(panBefore, await camera()));
    const zoomBefore = await camera();
    await page.mouse.move(...await emptyPoint()); await page.mouse.wheel(0, -120);
    await page.waitForTimeout(250); await settle();
    check(`911 AC2 ${kind} zoom follows physical wall`, await bandAt(x, y));
    check(`911 AC2 ${kind} zoom really changed camera`, !same(zoomBefore, await camera()));
    await page.setViewportSize({ width: 1000, height: 850 }); await settle();
    check(`911 AC2 ${kind} resize follows physical wall`, await bandAt(x, y));
    check(`911 AC2 ${kind} complete config layout history and wire unchanged`, same(before, await state()));
    await page.keyboard.press('Escape'); await settle();
    check(`911 AC4 ${kind} Escape clears selected indication`, await page.locator('.wallthick-selected').count(), 0);
    await page.setViewportSize({ width: 900, height: 800 }); await settle();
  }
  await opening(450, 150);
  await page.locator('[data-hp="tool"][data-tool="select"]').filter({ visible: true }).click(); await settle();
  check('911 AC4 tool switch clears selected indication', await page.locator('.wallthick-selected').count(), 0);
  await opening(450, 150);
  await page.locator('[data-hp="space-tab"][data-id="other"]').filter({ visible: true }).click(); await settle();
  check('911 AC4 floor switch clears selected indication', await page.locator('.wallthick-selected').count(), 0);
  await page.locator('[data-hp="space-tab"][data-id="selection"]').filter({ visible: true }).click(); await settle();
  await opening(450, 150);
  await page.locator('[data-hp="editor-close"]').filter({ visible: true }).first().click(); await settle();
  check('911 AC4 View has no selected indication', await page.locator('.wallthick-selected').count(), 0);
  await page.evaluate(() => window.__hpTest.setMode('plan')); await settle();
  for (const [kind, x, y, selector] of [['partition', 450, 600, '.wallthick-dlg button.on'],
    ['room', 450, 150, '.wallthick-dlg button.ghost']]) {
    await opening(x, y); const before = await state();
    await page.locator('.wallthick-dlg [data-hp="field"][data-field="wall-thickness"]').fill('27');
    await page.locator(selector).click(); await page.evaluate(() => window.__hpTest.waitForWrites()); await settle();
    const after = await state();
    check(`911 AC4 ${kind} Apply clears selection with one config/history transaction`,
      await page.locator('.wallthick-selected').count() === 0 && after.saves === before.saves + 1
      && after.history === before.history + 1);
    check(`911 AC4 ${kind} actual wire contains requested centimetres`, await page.evaluate(kind => {
      const sp = window.__selectionSaves.at(-1).config.spaces.find(s => s.id === 'selection');
      return kind === 'partition' ? sp.partitions.find(p => p.id === 'partition').cm === 27
        : sp.wall_segments.every(w => w.cm === 27);
    }, kind));
    await page.keyboard.press('Control+z'); await page.evaluate(() => window.__hpTest.waitForWrites()); await settle();
    check(`911 AC4 ${kind} Undo restores full source config`, (await state()).config, before.config);
  }
  await opening(450, 150);
  for (const kiosk of [true, false]) {
    await page.evaluate(kiosk => {
      const previous = window.__card, hass = previous.hass;
      const card = document.createElement('houseplan-card');
      card.setConfig({ type: 'custom:houseplan-card', language: 'en', kiosk });
      previous.remove(); document.getElementById('host').appendChild(card);
      window.__card = card; card.hass = hass;
    }, kiosk);
    await page.waitForFunction(() => window.__card._booting === false); await settle();
    check(`911 AC4 remount kiosk=${kiosk} cannot revive selected wall`, await page.locator('.wallthick-selected').count(), 0);
  }
  await page.evaluate(async original => {
    await window.__hpTest.setMode('view');
    window.__card.hass.callWS = window.__selectionCallWS;
    await window.__hpTest.setServerConfig(() => original);
  }, original);
  await page.evaluate(layout => window.__hpTest.setLayout(layout), originalLayout);
  // The older part of this smoke assumes launch(..., 1)'s loaded editor.
  // Re-enter through its real control after the remount instead of racing the lazy import.
  await page.evaluate(() => window.__hpTest.setMode('plan'));
  await settle();
}
