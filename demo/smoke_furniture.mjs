// Библиотека мебели в декор-слое (docs/FURNITURE.md, задача владельца №2):
//   1) в панели декора есть инструмент «Мебель», он открывает ПАЛИТРУ с
//      обязательными группами (мебель / техника / сантехника) и превью;
//   2) выбранный символ ставится кликом по плану в РЕАЛЬНОМ размере — через
//      cell_cm пространства, и сразу оказывается выделенным в «выбрать»;
//   3) поля ширины/глубины в палитре меняют размер ДО размещения;
//   4) магнит к стене: предмет прижимается к ближайшей стене и доворачивается
//      по ней; Shift не отключает обязательную привязку (docs/CANVAS.md §9.4);
//   5) у выделенного предмета та же рамка, что у текстового блока, — угловые
//      ручки (НЕзависимые ширина и глубина) и ручка поворота с шагом 5°;
//   6) во время растягивания угла показываются живые плашки размеров;
//   7) фигура пишется в конфиг и переживает пересборку, хуки card-mod на месте.
// ПАДАЕТ на сборке до этой задачи: инструмента «Мебель» нет, палитры нет,
// kind:'furniture' не рисуется, магнита и плашек не существует. Смок при этом
// null-safe — он показывает СПИСОК провалов, а не одно исключение.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const stageEl = () => sr().querySelector('.stage');
  const el = (id) => (id ? sr().querySelector(`.decorlayer [data-id="${id}"]`) : null);
  const attr = (id, n) => { const e = el(id); return e ? e.getAttribute(n) : null; };
  const toScreen = (x, y) => {
    const r = stageEl().getBoundingClientRect();
    const v = c._viewOr(c._baseVb());
    return { clientX: r.left + ((x - v.x) / v.w) * r.width,
      clientY: r.top + ((y - v.y) / v.h) * r.height };
  };
  const ev = (type, target, x, y, extra = {}) => {
    // null-safe: на сборке ДО этой задачи фигуры нет вовсе, а значит нет и
    // её координат — жест просто не происходит, и смок печатает список
    // провалов вместо одного исключения
    if (!target || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const { clientX, clientY } = toScreen(x, y);
    target.dispatchEvent(new PointerEvent(type, { bubbles: true, composed: true,
      cancelable: true, pointerId: 11, clientX, clientY, button: 0, isPrimary: true, ...extra }));
  };
  const PITCH = 1000 / 240;           // GRID_PITCH — одна клетка сетки
  const CELL = 5;                     // cell_cm демо-пространства (по умолчанию)
  const cmToUnits = (cm) => (cm / CELL) * PITCH;
  const near = (a, b, tol) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;
  const pe = (id) => { const e = el(id); return e ? getComputedStyle(e).pointerEvents : null; };

  sr().querySelectorAll('.modetab')[2].click(); await c.updateComplete;
  c._curSpaceCfg.decor = [];
  c._decorTool = 'select'; c._decorSel = null; c._furnPalette = null;
  c._cfgEpoch++; c.requestUpdate(); await c.updateComplete;
  out.cellCmIsFive = c._cellCm === CELL;

  // ================= 1. инструмент и палитра ==============================
  const toolBtn = [...sr().querySelectorAll('.decorbar .dtool')]
    .find((b) => /мебел|furnitur/i.test(b.textContent || ''));
  out.furnitureToolInTheBar = !!toolBtn;
  out.noPaletteBeforeTheTool = !sr().querySelector('.furnpalette');
  if (toolBtn) toolBtn.click();
  await c.updateComplete;
  out.toolIsSelected = c._decorTool === 'furniture';
  const pal = () => sr().querySelector('.furnpalette');
  out.paletteOpens = !!pal();
  const groups = [...(pal()?.querySelectorAll('.furngroup') || [])]
    .map((g) => g.getAttribute('data-group'));
  out.groupsArePresent = ['furniture', 'appliance', 'sanitary'].every((g) => groups.includes(g));
  out.everyGroupHasSymbols = groups.length > 0 && [...pal().querySelectorAll('.furnrow')]
    .every((r) => r.querySelectorAll('.furnitem').length > 0);
  const item = (sym) => pal()?.querySelector(`.furnitem[data-symbol="${sym}"]`);
  const pick = (sym) => { const b = item(sym); if (b) b.click(); };
  out.sofaIsInThePalette = !!item('sofa');
  out.toiletIsInThePalette = !!item('toilet');
  out.washerIsInThePalette = !!item('washer');
  const prevD = item('sofa')?.querySelector('svg.furnprev path')?.getAttribute('d') || '';
  out.previewIsDrawn = prevD.length > 10;
  out.namesAreLocalised = /\S/.test(item('sofa')?.querySelector('span')?.textContent || '');

  // ================= 2. размер по умолчанию и поля =========================
  pick('sofa'); await c.updateComplete;
  out.pickArmsTheSymbol = c._furnPalette?.symbol === 'sofa';
  out.defaultSizeIsTheSymbols = c._furnPalette?.w === 220 && c._furnPalette?.h === 90;
  const wIn = () => pal()?.querySelector('input.furnw');
  const hIn = () => pal()?.querySelector('input.furnh');
  out.sizeFieldsAppear = !!wIn() && !!hIn();
  out.fieldsShowMetres = +(wIn()?.value ?? NaN) === 2.2 && +(hIn()?.value ?? NaN) === 0.9;
  out.selectedItemIsMarked = !!item('sofa')?.classList.contains('on');

  // ================= 3. размещение в реальном размере ======================
  // середина комнаты r1 (40..550 × 140..580) — до стен дальше порога магнита
  ev('pointerdown', stageEl(), 300, 300);
  await c.updateComplete;
  const sofa = c._decorList.find((s) => s.kind === 'furniture');
  const sofaId = sofa?.id ?? null;
  const sofaNow = () => c._decorList.find((s) => s.id === sofaId) || {};
  out.placedOnClick = sofa?.symbol === 'sofa';
  out.realWidthThroughCellCm = near((sofa?.w ?? NaN) * 1000, cmToUnits(220), 1e-6);
  out.realDepthThroughCellCm = near((sofa?.h ?? NaN) * 1000, cmToUnits(90), 1e-6);
  out.centredOnTheClick = !!sofa
    && near((sofa.x + sofa.w / 2) * 1000, 300, 1e-6)
    && near((sofa.y + sofa.h / 2) * 1000, 300, 1e-6);
  out.noAngleWhenStraight = !!sofa && sofa.angle === undefined;
  out.selectedRightAway = !!sofaId && c._decorSel === sofaId;
  out.toolWentBackToSelect = c._decorTool === 'select';
  out.paletteDisarmed = c._furnPalette === null;
  // …и она НАРИСОВАНА, со всеми хуками card-mod (docs/STYLING-HOOKS.md §3)
  out.rendered = el(sofaId)?.tagName?.toLowerCase() === 'path';
  out.hookHp = attr(sofaId, 'data-hp') === 'decor';
  out.hookKind = attr(sofaId, 'data-kind') === 'furniture';
  out.hookSymbol = attr(sofaId, 'data-symbol') === 'sofa';
  out.strokedNotFilled = attr(sofaId, 'fill') === 'none'
    && attr(sofaId, 'stroke') === c._decorStyle.color;
  out.pathIsAtRealSize = /^M0 0H183\.333V75H0Z/.test(attr(sofaId, 'd') || '');

  // ================= 4. свой размер до размещения ==========================
  c._decorTool = 'furniture'; await c.updateComplete;
  pick('toilet'); await c.updateComplete;
  if (wIn()) {
    wIn().value = '0.5';
    wIn().dispatchEvent(new Event('input', { bubbles: true }));
  }
  await c.updateComplete;
  out.fieldEditsTheArmedSize = Math.abs((c._furnPalette?.w ?? 0) - 50) < 1e-6;
  ev('pointerdown', stageEl(), 300, 400);
  await c.updateComplete;
  const wc = c._decorList.find((s) => s.symbol === 'toilet');
  out.typedSizeIsUsed = near((wc?.w ?? NaN) * 1000, cmToUnits(50), 1e-6)
    && near((wc?.h ?? NaN) * 1000, cmToUnits(70), 1e-6);

  // ================= 5. магнит к стене =====================================
  c._decorTool = 'furniture'; await c.updateComplete;
  pick('bed_double'); await c.updateComplete;
  ev('pointerdown', stageEl(), 300, 150);           // 10 единиц от стены y=140
  await c.updateComplete;
  const bed = c._decorList.find((s) => s.symbol === 'bed_double');
  const depth = cmToUnits(200);
  out.wallMagnetPullsItFlat = !!bed
    && near((bed.y + bed.h / 2) * 1000, 140 + depth / 2, 1e-6);
  out.wallMagnetKeepsTheAngle = !!bed && (bed.angle || 0) === 0;   // стена горизонтальна
  out.wallMagnetQuantisesAlongTheWall = !!bed
    && Math.abs((bed.x + bed.w / 2) * 1000 - 300) <= PITCH + 1e-6;

  // …Shift больше не отключает магнит
  c._decorTool = 'furniture'; await c.updateComplete;
  pick('bed_single'); await c.updateComplete;
  ev('pointerdown', stageEl(), 301.7, 151.3, { shiftKey: true });
  await c.updateComplete;
  const free = c._decorList.find((s) => s.symbol === 'bed_single');
  out.shiftKeepsTheMagnet = !!free
    && !near((free.y + free.h / 2) * 1000, 151.3, 1e-6)
    && free.angle === undefined;

  // …магнит работает и при ПЕРЕТАСКИВАНИИ: тянем диван к левой стене (x=40)
  c._decorTool = 'select'; c._decorSel = sofaId; c.requestUpdate();
  await c.updateComplete; await sleep(40); await c.updateComplete;
  ev('pointerdown', el(sofaId), 300, 300);
  out.dragStarted = !!sofaId && c._decorMove?.id === sofaId;
  ev('pointermove', stageEl(), 55, 300);            // 15 единиц от стены x=40
  await c.updateComplete;
  const pulled = sofaNow();
  out.dragMagnetTurnsItToTheWall = Math.abs(Math.abs(pulled.angle || 0) - 90) < 1e-6;
  out.dragMagnetPressesTheBack =
    near((pulled.x + pulled.w / 2) * 1000, 40 + cmToUnits(90) / 2, 1e-6);
  ev('pointermove', stageEl(), 300, 300, { shiftKey: true });
  await c.updateComplete;
  const shiftDragGridIndex = (sofaNow().x * 1000) / PITCH;
  out.shiftDragRemainsGridBound = near(shiftDragGridIndex, Math.round(shiftDragGridIndex), 1e-6);
  ev('pointerup', stageEl(), 300, 300, { shiftKey: true });
  await c.updateComplete;

  // ================= 6. рамка, углы, плашки, поворот =======================
  c._decorSel = sofaId; c.requestUpdate();
  await c.updateComplete; await sleep(60); await c.updateComplete;
  const frame = () => sr().querySelector('.dtframe');
  out.frameOnSelection = !!frame();
  out.sameFrameAsTheTextBlock = !!frame()
    && frame().querySelectorAll('.dthandle').length === 5
    && frame().querySelectorAll('.dtknob').length === 5
    && !!frame().querySelector('.dtrot');
  const rOf = (sel) => { const e = frame()?.querySelector(sel); return e ? +e.getAttribute('r') : NaN; };
  out.handleSizeIsTheTaskOneSize = Math.abs(rOf('.dtknob') * 4 - rOf('.dthandle.dtrot'))
    / Math.max(rOf('.dthandle.dtrot'), 1e-9) < 0.05;
  out.frameBoxIsTheShapeBox = !!c._dtBox
    && near(c._dtBox.w, sofaNow().w * 1000, 1e-6)
    && near(c._dtBox.h, sofaNow().h * 1000, 1e-6);

  // угол: НЕзависимые ширина и глубина + живые плашки
  const before = { w: sofaNow().w, h: sofaNow().h };
  const b = c._dtBox || { x: 0, y: 0, w: 0, h: 0 };
  const handles = [...(frame()?.querySelectorAll('.dthandle') || [])];
  const se = handles[3] || stageEl();                       // SE — четвёртый угол
  ev('pointerdown', se, b.x + b.w, b.y + b.h);
  out.cornerDragStarted = c._dtDrag?.kind === 'scale' && !!c._dtDrag?.orig;
  ev('pointermove', stageEl(), b.x + b.w + 100, b.y + b.h + 20, { shiftKey: true });
  await c.updateComplete;
  const grown = sofaNow();
  out.cornerGrowsTheWidth = grown.w > before.w && near(grown.w * 1000, b.w + 100, 1e-6);
  out.cornerGrowsTheDepthINDEPENDENTLY = grown.h > before.h
    && near(((grown.h * 1000) / PITCH) % 1, 0, 1e-6);
  out.oppositeCornerStaysPut = near(grown.x * 1000, b.x, 1e-6) && near(grown.y * 1000, b.y, 1e-6);
  const plates = [...sr().querySelectorAll('.measurelabel.furnmeasure')];
  out.twoLivePlates = plates.length === 2;
  out.platesShowRealLengths = plates.length === 2
    && plates.every((p) => /\d/.test(p.textContent))
    && plates.some((p) => /m|м|′/.test(p.textContent));
  // …и без Shift размер прилипает к сетке
  ev('pointermove', stageEl(), b.x + b.w + 101.7, b.y + b.h + 21.3);
  await c.updateComplete;
  const snapped = sofaNow();
  const wCells = (snapped.w * 1000) / PITCH;
  const hCells = (snapped.h * 1000) / PITCH;
  // Normalised config is rounded to six decimals, so a mathematical cell 27
  // may read back as 26.9999999. Compare with the nearest integer, not `% 1`.
  out.sizeSnapsToTheGrid = near(wCells, Math.round(wCells), 1e-4)
    && near(hCells, Math.round(hCells), 1e-4);
  ev('pointerup', stageEl(), b.x + b.w + 101.7, b.y + b.h + 21.3);
  await c.updateComplete;
  out.cornerDragEnded = !c._dtDrag;
  out.noPlatesAfterTheDrag = !sr().querySelector('.measurelabel.furnmeasure');

  // поворот: шаг 5°, Shift мимо шага — та же механика, что у текста
  await sleep(40); await c.updateComplete;
  const cx = (sofaNow().x + sofaNow().w / 2) * 1000;
  const cy = (sofaNow().y + sofaNow().h / 2) * 1000;
  const piv = c._dtPivot ? c._dtPivot(sofaNow()) : [NaN, NaN];
  out.rotatesAboutTheCENTRE = near(piv[0], cx, 1e-6) && near(piv[1], cy, 1e-6);
  ev('pointerdown', frame()?.querySelector('.dthandle.dtrot'), cx + 100, cy);
  out.rotateStarted = c._dtDrag?.kind === 'rotate';
  ev('pointermove', stageEl(), cx + 100, cy + 100);        // ровно 45°
  await c.updateComplete;
  out.rotates45 = near(sofaNow().angle || 0, 45, 1e-6);
  ev('pointermove', stageEl(), cx + 100, cy + 2);          // ~1.1° → липнет к 0
  await c.updateComplete;
  out.snapsTo5 = (sofaNow().angle || 0) === 0;
  ev('pointermove', stageEl(), cx + 100, cy + 2, { shiftKey: true });
  await c.updateComplete;
  const fine = sofaNow().angle;
  out.shiftGoesPastTheStep = fine > 0.5 && fine < 5;
  ev('pointerup', stageEl(), cx + 100, cy + 2, { shiftKey: true });
  await c.updateComplete;
  out.rotationIsRendered = /rotate\(/.test(attr(sofaId, 'transform') || '');

  // ================= 7. конфиг и пересборка ================================
  const stored = JSON.parse(JSON.stringify(sofaNow()));
  out.storedShapeIsComplete = stored.kind === 'furniture' && typeof stored.symbol === 'string'
    && ['x', 'y', 'w', 'h'].every((k) => Number.isFinite(stored[k]));
  c.hass = { ...c.hass };                                   // полная пересборка
  c._cfgEpoch++; c.requestUpdate();
  await c.updateComplete; await sleep(40); await c.updateComplete;
  const after = sofaNow();
  out.survivesARebuild = after.symbol === stored.symbol
    && near(after.w, stored.w, 1e-12) && near(after.h, stored.h, 1e-12)
    && near(after.x, stored.x, 1e-12) && near(after.y, stored.y, 1e-12);
  out.stillRenderedAfterRebuild = !!el(sofaId);

  // ================= 8. инертность и удаление ==============================
  c._decorTool = 'furniture'; c._furnPalette = null; await c.updateComplete;
  out.inertUnderTheStamp = pe(sofaId) === 'none';
  const n0 = c._decorList.length;
  ev('pointerdown', stageEl(), 320, 320);                   // символ НЕ выбран
  await c.updateComplete;
  out.noSymbolNoStamp = c._decorList.length === n0;
  c._decorTool = 'erase'; await c.updateComplete;
  ev('pointerdown', el(sofaId), 300, 300);
  await c.updateComplete;
  out.eraseRemovesIt = !!sofaId && !c._decorList.some((s) => s.id === sofaId);
  // а в режиме просмотра мебель видна и не кликается
  c._setMode('view'); await c.updateComplete; await sleep(30);
  const left = c._decorList.find((s) => s.kind === 'furniture');
  out.visibleInView = !!left && !!el(left.id);
  out.inertInView = !!left && pe(left.id) === 'none';
  return out;
});
checkAll(res);
await finish(browser, res);
