import { launch } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  c._setMode('plan'); c._tool = 'opening'; await c.updateComplete;
  const rooms = c._spaceModel().rooms;
  const r = rooms.find((x) => x.id === 'r1');
  const poly = r.poly || [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
  const wallMid = [(poly[0][0] + poly[1][0]) / 2, (poly[0][1] + poly[1][1]) / 2];
  // 1) курсор возле стены → пунктирный призрак есть
  c._cursorPt = [wallMid[0], wallMid[1] + c._gridPitch * 0.5]; c.requestUpdate(); await c.updateComplete;
  const ghost = sr().querySelector('.opghost');
  out.ghostNearWall = !!ghost;
  if (ghost) {
    const cs = getComputedStyle(ghost);
    out.dashed = cs.strokeDasharray !== 'none' && cs.strokeDasharray !== '';
    // призрак лежит на стене (y координаты концов совпадают с y стены)
    out.onWall = Math.abs(Number(ghost.getAttribute('y1')) - poly[0][1]) < 0.5
      && Math.abs(Number(ghost.getAttribute('y2')) - poly[0][1]) < 0.5;
    // длина = 90 см в рендер-единицах
    const len = Math.hypot(ghost.getAttribute('x2') - ghost.getAttribute('x1'), ghost.getAttribute('y2') - ghost.getAttribute('y1'));
    out.len90cm = Math.abs(len - c._cmToUnits(90)) < 0.5;
  }
  // 2) курсор далеко от стен → призрака нет
  const center = c._roomCenter(r);
  c._cursorPt = center; c.requestUpdate(); await c.updateComplete;
  out.noGhostFarFromWall = !sr().querySelector('.opghost');
  // 3) в других инструментах призрака нет
  c._tool = 'draw'; c._cursorPt = [wallMid[0], wallMid[1] + 2]; c.requestUpdate(); await c.updateComplete;
  out.noGhostOtherTool = !sr().querySelector('.opghost');
  // 4) над существующим проёмом призрак не рисуется (там клик = редактирование)
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== c._space ? s : ({
    ...s, openings: [{ id: 'op9', type: 'door', x: wallMid[0] / 1000, y: wallMid[1] / (1000 / (c._curSpaceCfg.aspect || 1)) * (c._curSpaceCfg.aspect ? 1 : 1), angle: 0, length: 0.09 }] })) };
  c._tool = 'opening'; c.requestUpdate(); await c.updateComplete;
  const op = c._openingsR[0];
  c._cursorPt = [op.rx, op.ry]; c.requestUpdate(); await c.updateComplete;
  out.noGhostOverExisting = !sr().querySelector('.opghost');
  return out;
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
