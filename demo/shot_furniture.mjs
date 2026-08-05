// Скриншоты библиотеки мебели: палитра и расставленная мебель на плане.
import { launch } from './serve.mjs';
const OUT = process.env.HP_SHOT_DIR || '/tmp';
const { page, browser } = await launch({ width: 900, height: 900 }, 2);

await page.evaluate(async () => {
  const c = window.__card;
  const sr = c.shadowRoot || c.renderRoot;
  sr.querySelectorAll('.modetab')[2].click();
  await c.updateComplete;
  c._curSpaceCfg.decor = [];
  c._decorTool = 'furniture';
  c._cfgEpoch++; c.requestUpdate();
  await c.updateComplete;
  sr.querySelector('.furnitem[data-symbol="sofa"]').click();
  await c.updateComplete;
});
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/furniture_palette.png` });

await page.evaluate(async () => {
  const c = window.__card;
  const P = 1000 / 240;
  const cm = (v) => (v / 5) * P / 1000;                 // cm -> normalised
  const put = (id, symbol, w, h, cx, cy, angle) => ({
    id, kind: 'furniture', symbol,
    x: cx / 1000 - cm(w) / 2, y: cy / 1000 - cm(h) / 2,
    w: cm(w), h: cm(h), color: '#8d6e63', width: 3,
    ...(angle ? { angle } : {}),
  });
  // r1 living 40..550 x 140..580 | r2 kitchen 550..960 x 140..460
  // r3 bedroom 550..960 x 460..860 | r4 hall 40..550 x 580..860
  c._curSpaceCfg.decor = [
    put('f1', 'sofa', 220, 90, 250, 140 + 37.5),
    put('f2', 'coffee_table', 110, 60, 250, 300),
    put('f3', 'tv', 120, 30, 250, 570),
    put('f4', 'armchair', 90, 85, 90, 340, 90),
    put('f5', 'table_dining', 140, 80, 700, 300),
    put('f6', 'chair', 45, 45, 700, 240),
    put('f7', 'chair', 45, 45, 700, 360, 180),
    put('f8', 'fridge', 60, 65, 590, 140 + 27, 0),
    put('f9', 'stove', 60, 60, 670, 140 + 25),
    put('f10', 'kitchen_sink', 80, 60, 760, 140 + 25),
    put('f11', 'dishwasher', 60, 60, 840, 140 + 25),
    put('f12', 'bed_double', 160, 200, 700, 460 + 42),
    put('f13', 'nightstand', 45, 40, 620, 470),
    put('f14', 'nightstand', 45, 40, 780, 470),
    put('f15', 'wardrobe', 100, 60, 910, 700, 90),
    put('f16', 'washer', 60, 60, 120, 860 - 25, 180),
    put('f17', 'toilet', 40, 70, 220, 860 - 29, 180),
    put('f18', 'bathtub', 170, 75, 400, 860 - 31, 180),
    put('f19', 'plant', 40, 40, 500, 620),
    put('f20', 'shower', 90, 90, 490, 700),
  ];
  c._decorTool = 'select';
  c._decorSel = 'f1';
  c._cfgEpoch++; c.requestUpdate();
  await c.updateComplete;
});
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/furniture_plan.png` });
await browser.close();
console.log('shots written to', OUT);
