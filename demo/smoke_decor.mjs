import { launch, checkAll, finish } from './serve.mjs';
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
  // seven tools (the six drawing ones + «Мебель», docs/FURNITURE.md) plus
  // «Картинка-подложка», which f1 offers because it HAS a picture
  // (docs/BACKDROP.md §2); a hand-drawn space still shows seven
  out.toolBtns = sr().querySelectorAll('.decorbar .btn.dtool').length === 8;
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
  await c.updateComplete;
  // превью рисуемой линии уже с круглыми концами (зубцы на стыках)
  const draftLine = sr().querySelector('.decorlayer line.ddraft');
  out.draftLineRound = !!draftLine
    && draftLine.getAttribute('stroke-linecap') === 'round'
    && draftLine.getAttribute('stroke-linejoin') === 'round';
  c._decorCommitDraft();
  c._decorDraft = { kind: 'ellipse', a: [g * 30, g * 30], b: [g * 40, g * 36], pid: 1 };
  c._decorCommitDraft(); await c.updateComplete;
  out.threeShapes = c._decorList.length === 3;
  // сохранённые линии рендерятся с круглыми концами: диаметр = толщине линии,
  // стык двух линий под углом — без зубца (скриншот владельца)
  await c.updateComplete;
  const lines = [...sr().querySelectorAll('.decorlayer line.dshape')];
  out.savedLineRound = lines.length > 0 && lines.every((l) =>
    l.getAttribute('stroke-linecap') === 'round' && l.getAttribute('stroke-linejoin') === 'round');
  // вырожденная фигура не сохраняется
  c._decorDraft = { kind: 'line', a: [g, g], b: [g, g], pid: 1 };
  c._decorCommitDraft();
  out.degenerateSkipped = c._decorList.length === 3;
  // 3b) живая плашка размера, пока фигуру ещё тянут (владелец 2026-08-04:
  // «в редакторе подложки у линий писать длину, как при рисовании комнат в
  // редакторе плана»). Та же .measurelabel, тот же formatLength/cell_cm.
  const label = () => sr().querySelector('.measurelabel.dmeasure');
  const txt = () => (label() ? label().textContent.trim() : null);
  const cellCm = 5;                                    // cell_cm по умолчанию
  const fmt = (px) => (((px / g) * cellCm) / 100).toFixed(2) + ' m';
  const vw = () => c._viewOr(c._baseVb());
  c._decorTool = 'line';
  c._decorDraft = { kind: 'line', a: [g * 4, g * 20], b: [g * 4, g * 20], pid: 3 };
  await c.updateComplete;
  out.noBadgeBeforeTheDrag = !label();                 // нулевая длина — молчим
  c._decorDraft = { ...c._decorDraft, b: [g * 16, g * 20] };   // 12 клеток вправо
  await c.updateComplete;
  out.lineBadgeShown = !!label();
  // 12 клеток × 5 см = 0.60 m, угол 0° — ровно то, что пишет плашка стены
  out.lineBadgeText = txt();
  out.lineBadgeMatchesGeometry = txt() === fmt(g * 12) + ' · 0°';
  // ...ровно на середине отрезка (владелец: «плашка на середине линии»)
  out.lineBadgeAtTheMiddle = !!label() && Math.abs(
    parseFloat(label().style.left) - ((g * 10 - vw().x) / vw().w) * 100) < 0.02;
  // 0° кратен 45° — плашка зелёная, как у стены на 45°
  out.badgeGreenOnAxis = !!label() && label().classList.contains('on45');
  // косой отрезок 3-4-5: длина 5 клеток, угол 53.1° — не кратен 45°
  c._decorDraft = { kind: 'line', a: [g * 4, g * 20], b: [g * 7, g * 24], pid: 3 };
  await c.updateComplete;
  out.obliqueBadge = txt() === fmt(g * 5) + ' · 53.1°';
  out.obliqueNotGreen = !!label() && !label().classList.contains('on45');
  // прямоугольник и овал: длины у них нет, есть габарит «Ш × В»
  c._decorDraft = { kind: 'rect', a: [g * 4, g * 20], b: [g * 12, g * 26], pid: 3 };
  await c.updateComplete;
  out.rectBadgeIsSize = txt() === fmt(g * 8) + ' × ' + fmt(g * 6);
  // отпустили — плашки нет
  c._decorCommitDraft(); await c.updateComplete;
  out.badgeGoneAfterRelease = !label();
  c._curSpaceCfg.decor = c._decorList.slice(0, 3);     // назад к трём фигурам
  c._decorTool = 'select';
  await c.updateComplete;
  out.stillThreeShapes = c._decorList.length === 3;
  // 4) надпись через диалог. Поля `size` в диалоге больше нет — размер задаётся
  // углами блока (см. smoke_decor_text); сохранённый старый `size` по-прежнему
  // читается как начальный масштаб.
  c._decorTextDialog = { x: 0.5, y: 0.5, text: 'Сауна', color: '#0000ff' };
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
  // 5b) инструмент рисования ВЛАДЕЕТ холстом: клик по существующей фигуре
  // начинает новую фигуру в этой точке, а не выделяет старую (владелец
  // 2026-08-04: «нельзя поставить начало линии на конец другой»).
  const stageEl = () => sr().querySelector('.stage');
  // экранные координаты точки холста (обратное _screenToVb)
  const toScreen = (x, y) => {
    const r = stageEl().getBoundingClientRect();
    const v = c._viewOr(c._baseVb());
    return { clientX: r.left + ((x - v.x) / v.w) * r.width,
      clientY: r.top + ((y - v.y) / v.h) * r.height };
  };
  const press = (el, x, y, pid) => {
    const { clientX, clientY } = toScreen(x, y);
    el.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, composed: true, cancelable: true,
      pointerId: pid, clientX, clientY, button: 0, isPrimary: true }));
  };
  // подопытная линия с известными концами
  c._decorTool = 'select'; c._decorSel = null; c._decorDraft = null; c._decorMove = null;
  const decorBefore = c._decorList.slice();
  c._curSpaceCfg.decor = [{ id: 'dcprobe', kind: 'line', x1: (g * 6) / 1000, y1: (g * 30) / 1000,
    x2: (g * 18) / 1000, y2: (g * 30) / 1000, color: '#000000', width: 3 }];
  c._cfgEpoch = (c._cfgEpoch || 0) + 1;
  c.requestUpdate(); await c.updateComplete;
  const probe = () => [...sr().querySelectorAll('.decorlayer line.dshape')]
    .find((l) => Math.abs(+l.getAttribute('x1') - g * 6) < 0.01);
  out.probeRendered = !!probe();
  // — инструмент «линия»: жмём ровно на КОНЕЦ линии
  c._decorTool = 'line'; await c.updateComplete;
  // фигура вообще перестаёт быть мишенью для указателя
  out.shapeInertUnderLineTool = getComputedStyle(probe()).pointerEvents === 'none';
  press(probe(), g * 18, g * 30, 41);
  await c.updateComplete;
  out.lineToolStartsDraft = !!c._decorDraft && c._decorDraft.kind === 'line';
  // ...и именно из этой точки (снап к концу старой линии)
  out.draftStartsAtTheEnd = !!c._decorDraft
    && Math.abs(c._decorDraft.a[0] - g * 18) < 0.51 && Math.abs(c._decorDraft.a[1] - g * 30) < 0.51;
  out.lineToolNoSelect = c._decorSel === null;
  out.lineToolNoMove = !c._decorMove;
  c._decorDraft = null; await c.updateComplete;
  // — прямоугольник и овал ведут себя так же
  for (const [tool, key] of [['rect', 'rectToolStartsDraft'], ['ellipse', 'ellipseToolStartsDraft']]) {
    c._decorTool = tool; c._decorSel = null; await c.updateComplete;
    press(probe(), g * 12, g * 30, 42);
    await c.updateComplete;
    out[key] = !!c._decorDraft && c._decorDraft.kind === tool && c._decorSel === null;
    c._decorDraft = null;
  }
  // — «текст» по ЛИНИИ открывает диалог новой надписи, а не выделяет её.
  // Инертность нетекстовых фигур под рисующими инструментами остаётся в силе;
  // единственное исключение — надпись под инструментом «текст», она открывает
  // СВОЮ форму (владелец 2026-08-04, пинится в smoke_decor_text).
  c._decorTool = 'text'; c._decorSel = null; c._decorTextDialog = null; await c.updateComplete;
  press(probe(), g * 12, g * 30, 43);
  await c.updateComplete;
  out.textToolOpensDialog = !!c._decorTextDialog && !c._decorTextDialog.id && c._decorSel === null;
  c._decorTextDialog = null;
  // — а вот в «выборе» всё по-прежнему: клик выделяет и берёт на перетаскивание
  c._decorTool = 'select'; c._decorSel = null; c._decorDraft = null; await c.updateComplete;
  out.shapeLiveUnderSelect = getComputedStyle(probe()).pointerEvents !== 'none';
  press(probe(), g * 12, g * 30, 44);
  await c.updateComplete;
  out.selectStillSelects = c._decorSel === 'dcprobe';
  out.selectStillGrabs = !!c._decorMove && c._decorMove.id === 'dcprobe';
  out.selectMakesNoDraft = !c._decorDraft;
  c._decorMove = null; c._decorSel = null;
  c._curSpaceCfg.decor = decorBefore;                 // сцена как была до пробы
  c._decorTool = 'select'; await c.updateComplete;
  out.decorRestored = c._decorList.length === decorBefore.length;
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
// значение плашки зафиксировано числом: 12 клеток × cell_cm 5 = 0.60 m, 0°
checkAll(res, { lineBadgeText: '0.60 m · 0°' });
await finish(browser, res);
