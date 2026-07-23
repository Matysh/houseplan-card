import { launch } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const g = c._gridPitch;
  const guides = () => sr().querySelectorAll('.alignline').length;
  // 1) рисование контура: курсор на одном X с вершиной комнаты → гид
  c._setMode('plan'); c._tool = 'draw'; await c.updateComplete;
  const r1 = c._spaceModel().rooms.find((r) => r.id === 'r1');
  const poly = r1.poly || [[r1.x, r1.y], [r1.x + r1.w, r1.y], [r1.x + r1.w, r1.y + r1.h], [r1.x, r1.y + r1.h]];
  const v = poly[0];
  c._path = [[v[0] + g * 10, v[1] + g * 10]];
  c._cursorPt = [v[0], v[1] + g * 20]; // тот же X, что у вершины
  c.requestUpdate(); await c.updateComplete;
  out.drawGuide = guides() >= 1;
  out.dot = sr().querySelectorAll('.aligndot').length >= 1;
  // нет выравнивания → нет гидов
  c._cursorPt = [v[0] + g * 7 + 1.7, v[1] + g * 13 + 2.3]; c.requestUpdate(); await c.updateComplete;
  out.noGuideOffAxis = guides() === 0;
  // 2) бейдж угла: 45° красит
  c._cursorPt = [c._path[0][0] + g * 5, c._path[0][1] + g * 5]; c.requestUpdate(); await c.updateComplete;
  const ml = sr().querySelector('.measurelabel');
  out.badge45 = !!ml && ml.classList.contains('on45') && ml.textContent.includes('45');
  c._cursorPt = [c._path[0][0] + g * 5, c._path[0][1] + g * 2]; c.requestUpdate(); await c.updateComplete;
  const ml2 = sr().querySelector('.measurelabel');
  out.badgeOff45 = !!ml2 && !ml2.classList.contains('on45') && ml2.textContent.includes('°');
  c._path = []; c._cursorPt = null;
  // 3) редактор устройств: drag значка в линию с другим значком
  c._setMode('devices'); await c.updateComplete;
  const devs = c._devices.filter((d) => d.space === c._space);
  const a = devs[0], b = devs[1];
  const pa = c._pos(a);
  // поставим b на тот же Y, начнём drag
  c._layout = { ...c._layout, [b.id]: { s: c._space, x: (pa.x + g * 12) / 1000, y: pa.y / (1000 / (c._curSpaceCfg.aspect || 1)) } };
  c._drag = { id: b.id, sx: 0, sy: 0, ox: 0, oy: 0, moved: true };
  c.requestUpdate(); await c.updateComplete;
  out.devGuide = guides() >= 1;
  c._drag = null; c.requestUpdate(); await c.updateComplete;
  out.devGuideGone = guides() === 0;
  // 4) подложка: рисование прямоугольника с углом на одном X с углом другой фигуры
  c._setMode('decor'); await c.updateComplete;
  c._curSpaceCfg.decor = [{ id: 'd1', kind: 'rect', x: 0.2, y: 0.2, w: 0.1, h: 0.1, color: '#ff0000', width: 3 }];
  const W = 1000, H = 1000 / (c._curSpaceCfg.aspect || 1);
  c._decorDraft = { kind: 'rect', a: [0.5 * W, 0.5 * H], b: [0.2 * W, 0.6 * H], pid: 9 }; // b.x == углу d1
  c.requestUpdate(); await c.updateComplete;
  out.decorGuide = guides() >= 1;
  c._decorDraft = null; c._curSpaceCfg.decor = []; c.requestUpdate(); await c.updateComplete;
  // 5) в Просмотре гидов не бывает
  c._setMode('view'); await c.updateComplete;
  out.noneInView = guides() === 0;
  return out;
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
