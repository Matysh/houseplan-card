/** #891 AC1: multi-step active Walls journal through real keys and toolbar. */
import { launch, check, finish } from './serve.mjs';
const { page, browser } = await launch({ width: 1180, height: 920 });
await page.evaluate(async () => {
  const previous = window.__card, hass = window.__mkHass(), old = hass.callWS.bind(hass);
  const cfg = { model_version: 10, spaces: [{ id: 'chain-history', title: 'Chain', cell_cm: 5,
    view_box: [0, 0, 1, 1], rooms: [], wall_segments: [], partitions: [] }], markers: [], settings: {} };
  let config = cfg, rev = 1;
  hass.callWS = async message => {
    if (message.type === 'houseplan/config/get') return { config: structuredClone(config), rev, can_write: true };
    if (message.type === 'houseplan/layout/get') return { layout: {}, rev: 1 };
    if (message.type === 'houseplan/config/set') { config = structuredClone(message.config); return { ok: true, rev: ++rev }; }
    return old(message);
  };
  const card = document.createElement('houseplan-card');
  card.setConfig({ type: 'custom:houseplan-card', language: 'en' });
  previous.remove(); document.getElementById('host').appendChild(card); window.__card = card; card.hass = hass;
});
await page.waitForFunction(() => window.__card?._booting === false && window.__card._space === 'chain-history');
await page.evaluate(async () => { await window.__hpTest.setMode('plan'); await window.__hpTest.setTool('draw'); });
await page.waitForFunction(() => !window.__card._modeTransitionBusy);
const click = async (x, y, cm) => {
  const field = page.locator('houseplan-card .drawwall input');
  await field.fill(String(cm)); await field.press('Tab');
  const point = await page.evaluate(([x, y]) => {
    const svg = window.__card.renderRoot.querySelector('svg.plan-svg'), p = svg.createSVGPoint();
    p.x = x; p.y = y; const screen = p.matrixTransform(svg.getScreenCTM()); return { x: screen.x, y: screen.y };
  }, [x, y]);
  await page.mouse.click(point.x, point.y);
  await page.evaluate(() => window.__hpTest.settled());
};
await click(300, 300, 15); await click(500, 300, 15); await click(500, 500, 25); await click(700, 500, 30);
const state = () => page.evaluate(() => {
  const c = window.__card;
  return { walls: structuredClone(c._curSpaceCfg.partitions), path: structuredClone(c._path),
    ids: [...c._activeWallChainPartitionIds], cms: [...c._wallChainSegmentCms], redo: structuredClone(c._wallChainRedo),
    active: !!c._activeWallChainId, tool: c._tool };
});
const settled = () => page.evaluate(() => window.__hpTest.settled());
const original = await state();
check('three accepted segments and distinct thickness', original.cms, [15, 25, 30]);
for (const key of ['Control+z', 'Control+z']) { await page.keyboard.press(key); await settled(); }
const undone = await state();
check('two Ctrl+Z preserve two redo points', [undone.walls.length, undone.redo.length, undone.active], [1, 2, true]);
for (const key of ['Control+Shift+z', 'Control+Shift+z']) { await page.keyboard.press(key); await settled(); }
check('two Ctrl+Shift+Z restore exact IDs/endpoints/cm and active chain', await state(), original);
await page.locator('houseplan-card [data-hp="toolbar"] ha-icon[icon="mdi:undo-variant"]').locator('xpath=..').click();
await settled(); await page.keyboard.press('Control+z'); await settled();
await page.locator('houseplan-card [data-hp="toolbar"] ha-icon[icon="mdi:redo-variant"]').locator('xpath=..').click();
await settled(); await page.keyboard.press('Control+y'); await settled();
check('toolbar plus Ctrl+Y preserve the complete journal', await state(), original);
await finish(browser);
