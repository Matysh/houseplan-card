import {installScenePaintProbe} from './helpers/scene-paint-probe.mjs';
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
await installScenePaintProbe(page);
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const grid = () => !!sr().querySelector('rect[fill="url(#hp-grid)"]');
  // Просмотр: сетки нет
  out.noGridInView = !grid();
  // все три редактора: сетка есть
  c._setMode('plan'); await c.updateComplete; out.gridInPlan = grid();
  c._setMode('devices'); await c.updateComplete; out.gridInDevices = grid();
  c._setMode('decor'); await c.updateComplete; out.gridInDecor = grid();
  await new Promise((r) => setTimeout(r, 250)); // transition .room 0.12s
  // decor: комнаты и устройства полупрозрачны
  const room = [...sr().querySelectorAll('.room')].find(el=>window.__hpSceneOpacity(el)>0);
  out.roomFaded = room ? window.__hpSceneOpacity(room) < 0.5 : null;
  const dl = sr().querySelector('.devlayer');
  out.devsFaded = dl ? Number(getComputedStyle(dl).opacity) < 0.5 : null;
  // а декор-слой — нет
  c._curSpaceCfg.decor = [{ id: 'd1', kind: 'line', x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.1, color: '#ff0000', width: 3 }];
  c.requestUpdate(); await c.updateComplete;
  const shp = sr().querySelector('.decorlayer .dshape');
  out.decorNotFaded = shp ? Number(getComputedStyle(shp).opacity) > 0.9 : null;
  // в других редакторах прозрачности нет
  c._setMode('devices'); await c.updateComplete;
  await new Promise((r) => setTimeout(r, 250));
  const room2 = [...sr().querySelectorAll('.room')].find(el=>window.__hpSceneOpacity(el)>0);
  out.notFadedInDevices = room2 ? window.__hpSceneOpacity(room2) > 0.9 : null;
  c._setMode('view'); await c.updateComplete;
  await new Promise((r) => setTimeout(r, 250));
  const room3 = [...sr().querySelectorAll('.room')].find(el=>window.__hpSceneOpacity(el)>0);
  out.notFadedInView = room3 ? window.__hpSceneOpacity(room3) > 0.9 : null;
  return out;
});
checkAll(res);
await finish(browser, res);
