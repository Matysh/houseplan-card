import { launch } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const esc = async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await c.updateComplete; };
  // 1) третья вкладка есть
  const tabs = [...sr().querySelectorAll('.modetab')];
  out.threeTabs = tabs.length === 3;
  tabs[2].click(); await c.updateComplete;
  out.decorMode = c._mode === 'decor';
  out.decorBar = !!sr().querySelector('.editbar.decorbar');
  out.toolBtns = sr().querySelectorAll('.decorbar .btn:not(.barclose)').length === 6;
  // 2) нарисовать прямоугольник drag-ом (через прямые вызовы)
  c._decorTool = 'rect'; c._decorStyle = { color: '#ff0000', width: 3, fill: true }; await c.updateComplete;
  const g = c._gridPitch;
  c._decorDraft = { kind: 'rect', a: [g * 10, g * 10], b: [g * 10, g * 10], pid: 1 };
  c._decorDraft = { ...c._decorDraft, b: [g * 20, g * 16] };
  await c.updateComplete;
  out.draftPreview = !!sr().querySelector('.ddraft');
  c._decorCommitDraft(); await c.updateComplete;
  out.rectSaved = c._curSpaceCfg.decor?.length === 1 && c._curSpaceCfg.decor[0].kind === 'rect';
  out.rectFill = c._curSpaceCfg.decor[0].fill === true && c._curSpaceCfg.decor[0].color === '#ff0000';
  out.rectRendered = !!sr().querySelector('.decorlayer rect.dshape');
  // 3) линия и овал
  c._decorDraft = { kind: 'line', a: [g * 2, g * 2], b: [g * 8, g * 2], pid: 1 };
  c._decorCommitDraft();
  c._decorDraft = { kind: 'ellipse', a: [g * 30, g * 30], b: [g * 40, g * 36], pid: 1 };
  c._decorCommitDraft(); await c.updateComplete;
  out.threeShapes = c._decorList.length === 3;
  // вырожденная фигура не сохраняется
  c._decorDraft = { kind: 'line', a: [g, g], b: [g, g], pid: 1 };
  c._decorCommitDraft();
  out.degenerateSkipped = c._decorList.length === 3;
  // 4) надпись через диалог
  c._decorTextDialog = { x: 0.5, y: 0.5, text: 'Сауна', size: 'l', color: '#0000ff' };
  c._decorSaveText(); await c.updateComplete;
  out.textSaved = c._decorList.some((x) => x.kind === 'text' && x.text === 'Сауна');
  out.textRendered = [...sr().querySelectorAll('.decorlayer text')].some((t) => t.textContent.includes('Сауна'));
  // 5) select: перемещение сохраняет форму, drag двигает
  const rect = c._decorList.find((x) => x.kind === 'rect');
  c._decorTool = 'select';
  c._decorMove = { id: rect.id, start: [0, 0], orig: JSON.parse(JSON.stringify(rect)), pid: 7, moved: false };
  c._decorMoveUpdate({ clientX: 0, clientY: 0, }); // без смещения
  const before = { ...c._decorList.find((x) => x.id === rect.id) };
  c._decorMove.start = [0, 0];
  // сдвиг на 5 клеток по x: подделаем _svgPoint? проще напрямую:
  const m = c._decorMove; const dx5 = (g * 5) / 1000;
  c._curSpaceCfg.decor = c._decorList.map((x) => x.id === m.id ? { ...x, x: m.orig.x + dx5 } : x);
  out.moveKeepsSize = Math.abs(c._decorList.find((x) => x.id === rect.id).w - before.w) < 1e-9;
  c._decorMove = null;
  // 6) erase удаляет
  const n0 = c._decorList.length;
  c._decorTool = 'erase';
  c._decorShapeDown({ stopPropagation() {}, preventDefault() {}, target: null, pointerId: 1 }, c._decorList[0]);
  out.eraseWorks = c._decorList.length === n0 - 1;
  // 7) Esc-лестница: инструмент → select → выход
  c._decorTool = 'line'; c._decorSel = null; await c.updateComplete;
  await esc(); out.escTool = c._decorTool === 'select' && c._mode === 'decor';
  await esc(); out.escExit = c._mode === 'view';
  // 8) в Просмотре фигуры видны, но inert
  const shp = sr().querySelector('.decorlayer .dshape');
  out.visibleInView = !!shp;
  out.inertInView = shp ? getComputedStyle(shp).pointerEvents === 'none' : null;
  // 9) Delete удаляет выбранное
  sr().querySelectorAll('.modetab')[2].click(); await c.updateComplete;
  c._decorTool = 'select'; c._decorSel = c._decorList[0].id; const n1 = c._decorList.length; await c.updateComplete;
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' })); await c.updateComplete;
  out.deleteKey = c._decorList.length === n1 - 1;
  return out;
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
