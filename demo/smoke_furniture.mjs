// Библиотека мебели в декор-слое (docs/FURNITURE.md, задача владельца №2):
//   1) в панели декора есть инструмент «Мебель», он открывает ПАЛИТРУ с
//      обязательными группами (мебель / техника / сантехника) и превью;
//   2) выбранный символ ставится кликом по плану в РЕАЛЬНОМ размере — через
//      cell_cm пространства, и сразу оказывается выделенным в «выбрать»;
//   3) поля ширины/глубины в палитре меняют размер ДО размещения;
//   4) мышь показывает точный полупрозрачный будущий символ без записи в
//      конфиг; touch/pen не рисуют hover и сохраняют только чистый tap;
//   5) магнит к стене: предмет прижимается к ближайшей стене и доворачивается
//      по ней; Shift временно обходит магнит, сохраняя grid snap;
//   6) у выделенного предмета расширенная рамка: угловые и четыре одноосевые
//      ручки; угол сохраняет пропорции без Shift, с Shift оси независимы;
//      поворот свободный, а Shift привязывает его к 45°;
//   7) во время растягивания угла показываются живые плашки размеров;
//   8) фигура пишется в конфиг и переживает пересборку, хуки card-mod на месте.
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
  c._decorTool = 'select'; c._decorSel = null; c._furnPalette = null; c._furnCategory = null;
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
  const openFurniture = async () => {
    if (c._decorTool !== 'furniture') {
      c._editorSecondary.openPalette();
      c._decorTool = 'furniture';
      c._furnPalette = null;
      c._furnCategory = null;
      c.requestUpdate();
      await c.updateComplete;
    }
  };
  out.paletteOpens = !!pal();
  const groups = [...(pal()?.querySelectorAll('.furngroup') || [])]
    .map((g) => g.getAttribute('data-group'));
  out.groupsArePresent = ['furniture', 'appliance', 'sanitary'].every((g) => groups.includes(g));
  out.everyGroupHasSymbols = groups.length > 0 && [...pal().querySelectorAll('.furnrow')]
    .every((r) => r.querySelectorAll('.furnitem').length > 0);
  const category = (id) => pal()?.querySelector(`.furnitem[data-category="${id}"]`);
  out.firstLevelHasNoPlanVariants = !pal()?.querySelector('.furnitem[data-symbol]');
  out.requiredCategoriesArePresent = ['sofa', 'toilet', 'washer']
    .every((id) => !!category(id));
  out.menuOnlyCategoriesStayHidden = ['computer', 'oven', 'hood', 'exercise']
    .every((id) => !category(id));
  const categoryD = category('sofa')?.querySelector('svg.furncatprev path')?.getAttribute('d') || '';
  out.categoryUsesFrontArtwork = categoryD.length > 10;
  category('sofa')?.click(); await c.updateComplete;
  out.categoryDrillsToVariants = c._furnCategory === 'sofa'
    && !!pal()?.querySelector('.furnback');
  const item = (sym) => pal()?.querySelector(`.furnitem[data-symbol="${sym}"]`);
  const pick = (sym) => { const b = item(sym); if (b) b.click(); };
  out.sofaIsInThePalette = !!item('sofa');
  out.sofaVariantsAreInThePalette = ['sofa', 'sofa_three_seat', 'sofa_corner_right']
    .every((id) => !!item(id));
  const prevD = item('sofa')?.querySelector('svg.furnprev path')?.getAttribute('d') || '';
  out.previewIsDrawn = prevD.length > 10;
  const previewEl = item('sofa')?.querySelector('svg.furnprev');
  const previewRect = previewEl?.getBoundingClientRect();
  const itemRect = item('sofa')?.getBoundingClientRect();
  out.previewStaysInsideItsButton = !!previewRect && !!itemRect
    && getComputedStyle(previewEl).position !== 'absolute'
    && previewRect.width <= 42 && previewRect.height <= 42
    && previewRect.left >= itemRect.left - 1 && previewRect.right <= itemRect.right + 1
    && previewRect.top >= itemRect.top - 1 && previewRect.bottom <= itemRect.bottom + 1;
  out.namesAreLocalised = /\S/.test(item('sofa')?.querySelector('span')?.textContent || '');

  // An unarmed explicit palette closes on the first press anywhere outside
  // the card, consumes only that press/click pair, and returns to Select.
  const outside = document.createElement('button');
  const unrelated = document.createElement('button');
  let outsideClicks = 0, unrelatedClicks = 0;
  outside.addEventListener('click', () => outsideClicks++);
  unrelated.addEventListener('click', () => unrelatedClicks++);
  document.body.append(outside, unrelated);
  outside.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, composed: true, cancelable: true, pointerId: 71, pointerType: 'mouse',
  }));
  outside.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));
  unrelated.click();
  await c.updateComplete;
  out.paletteOutsideDismissIsConsumed = c._decorTool === 'select' && !pal() && outsideClicks === 0;
  out.paletteDismissTailLeavesUnrelatedClick = unrelatedClicks === 1;
  outside.remove(); unrelated.remove();
  [...sr().querySelectorAll('.decorbar .dtool')]
    .find((b) => /мебел|furnitur/i.test(b.textContent || ''))?.click();
  await c.updateComplete;
  out.paletteReopensAfterDismiss = c._decorTool === 'furniture' && !!pal();
  category('sofa')?.click(); await c.updateComplete;

  // ================= 2. размер по умолчанию и поля =========================
  pick('sofa'); await c.updateComplete;
  out.pickArmsTheSymbol = c._furnPalette?.symbol === 'sofa';
  out.defaultSizeIsTheSymbols = c._furnPalette?.w === 180 && c._furnPalette?.h === 90;
  const wIn = () => pal()?.querySelector('input.furnw');
  const hIn = () => pal()?.querySelector('input.furnh');
  out.sizeFieldsAppear = !!wIn() && !!hIn();
  out.fieldsShowMetres = +(wIn()?.value ?? NaN) === 1.8 && +(hIn()?.value ?? NaN) === 0.9;
  out.selectedItemIsMarked = !!item('sofa')?.classList.contains('on');

  // ================= 3. точное превью без мутации ==========================
  const ghost = () => sr().querySelector('.furniture-placement-preview');
  const beforePreview = {
    decor: c._decorList.length,
    epoch: c._cfgEpoch,
    undo: c._geometryHistory.undoName,
    redo: c._geometryHistory.redoName,
  };
  ev('pointermove', stageEl(), 300, 300, { pointerType: 'mouse' });
  await c.updateComplete;
  const firstPreview = c._editorRuntime?._furniturePreviewPlacement()
    ? JSON.parse(JSON.stringify(c._editorRuntime._furniturePreviewPlacement())) : null;
  const firstTransform = ghost()?.getAttribute('transform');
  out.mouseHoverShowsRealSymbol = ghost()?.getAttribute('data-symbol') === 'sofa'
    && (ghost()?.getAttribute('d') || '').length > 20;
  out.previewIsTransientAndInert = ghost()?.getAttribute('aria-hidden') === 'true'
    && getComputedStyle(ghost()).pointerEvents === 'none'
    && near(Number(getComputedStyle(ghost()).opacity), 0.55, 1e-6);
  out.previewDoesNotMutateConfigOrHistory = c._decorList.length === beforePreview.decor
    && c._cfgEpoch === beforePreview.epoch
    && c._geometryHistory.undoName === beforePreview.undo
    && c._geometryHistory.redoName === beforePreview.redo;
  if (wIn()) {
    wIn().value = '1.85';
    wIn().dispatchEvent(new Event('input', { bubbles: true }));
  }
  await c.updateComplete;
  out.sizeUpdatesPreviewWithoutPointerMove = c._editorRuntime?._furniturePreviewPlacement()?.w > firstPreview?.w
    && ghost()?.getAttribute('transform') !== firstTransform;
  if (wIn()) {
    wIn().value = '1.8';
    wIn().dispatchEvent(new Event('input', { bubbles: true }));
  }
  await c.updateComplete;
  stageEl().dispatchEvent(new PointerEvent('pointerleave', {
    bubbles: true, composed: true, pointerId: 11, pointerType: 'mouse',
  }));
  await c.updateComplete;
  out.pointerLeaveClearsPreview = !ghost() && c._furnPreviewInput === null;

  // Unknown/stale symbols fail dark: neither an invisible ghost nor a decor
  // record is allowed. Restoring a valid selection resumes the same session.
  c._furnPalette = { symbol: 'future_unknown_symbol', w: 180, h: 90 };
  await c.updateComplete;
  ev('pointermove', stageEl(), 300, 300, { pointerType: 'mouse' });
  await c.updateComplete;
  const beforeUnknown = c._decorList.length;
  ev('pointerdown', stageEl(), 300, 300, { pointerType: 'mouse' });
  await c.updateComplete;
  out.unknownSymbolFailsDark = !ghost() && c._decorList.length === beforeUnknown
    && c._decorTool === 'furniture';
  c._furnPalette = { symbol: 'sofa', w: 180, h: 90 };
  await c.updateComplete;

  // ================= 4. размещение в реальном размере ======================
  // середина комнаты r1 (40..550 × 140..580) — до стен дальше порога магнита
  ev('pointermove', stageEl(), 300, 300, { pointerType: 'mouse' });
  await c.updateComplete;
  const committedPreview = c._editorRuntime?._furniturePreviewPlacement()
    ? JSON.parse(JSON.stringify(c._editorRuntime._furniturePreviewPlacement())) : null;
  const committedPreviewStroke = Number(ghost()?.getAttribute('stroke-width'));
  ev('pointerdown', stageEl(), 300, 300, { pointerType: 'mouse' });
  await c.updateComplete;
  const sofa = c._decorList.find((s) => s.kind === 'furniture');
  const sofaId = sofa?.id ?? null;
  const sofaNow = () => c._decorList.find((s) => s.id === sofaId) || {};
  out.placedOnClick = sofa?.symbol === 'sofa';
  out.realWidthThroughCellCm = near((sofa?.w ?? NaN) * 1000, cmToUnits(180), 1e-6);
  out.realDepthThroughCellCm = near((sofa?.h ?? NaN) * 1000, cmToUnits(90), 1e-6);
  out.centredOnTheClick = !!sofa
    && near((sofa.x + sofa.w / 2) * 1000, 300, 1e-6)
    && near((sofa.y + sofa.h / 2) * 1000, 300, 1e-6);
  out.noAngleWhenStraight = !!sofa && sofa.angle === undefined;
  out.previewAndCommitAreIdentical = !!sofa && !!committedPreview
    && ['x', 'y', 'w', 'h'].every((k) => near(sofa[k], committedPreview[k], 1e-12))
    && (sofa.angle || 0) === committedPreview.angle;
  out.previewAndCommitShareThePhysicalStroke = Number.isFinite(committedPreviewStroke)
    && near(Number(attr(sofaId, 'stroke-width')), committedPreviewStroke, 1e-9);
  out.previewClearsAfterCommit = !ghost() && c._furnPreviewInput === null;
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
  out.pathIsAtRealSize = (attr(sofaId, 'd') || '').length > 20
    && /scale\(/.test(attr(sofaId, 'transform') || '')
    && attr(sofaId, 'vector-effect') === 'non-scaling-stroke';

  // ================= 5. свой размер до размещения ==========================
  await openFurniture();
  category('toilet')?.click(); await c.updateComplete;
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

  // ================= 6. магнит к стене =====================================
  // #445: make the living-room top and shared right wall physically thick.
  // Exact endpoints are persisted in normalised config coordinates; the
  // magnet must consume their room-facing render surfaces, not their axes.
  c._curSpaceCfg.walls = [
    { key: '0.295833,0.141667@0.0000', cm: 20, a: [0.04, 0.14], b: [0.55, 0.14] },
    { key: '0.550000,0.358333@1.5706', cm: 20, a: [0.55, 0.14], b: [0.55, 0.58] },
  ];
  c._cfgEpoch++; c.requestUpdate(); await c.updateComplete;
  const wallHalf = cmToUnits(20) / 2;
  const firstSurfaceSnapshot = c._editorRuntime?._furnWalls;
  out.wallSurfaceCandidatesAreCached = !!firstSurfaceSnapshot
    && firstSurfaceSnapshot === c._editorRuntime?._furnWalls;

  await openFurniture();
  category('bed')?.click(); await c.updateComplete;
  pick('bed_double'); await c.updateComplete;
  ev('pointermove', stageEl(), 300, 140 + wallHalf, { pointerType: 'mouse' });
  await c.updateComplete;
  const thickWallPreview = c._editorRuntime?._furniturePreviewPlacement()
    ? JSON.parse(JSON.stringify(c._editorRuntime._furniturePreviewPlacement())) : null;
  ev('pointerdown', stageEl(), 300, 140 + wallHalf);
  await c.updateComplete;
  const bed = c._decorList.find((s) => s.symbol === 'bed_double');
  const depth = cmToUnits(200);
  out.wallMagnetPullsItFlat = !!bed
    && near((bed.y + bed.h / 2) * 1000, 140 + wallHalf + depth / 2, 1e-6);
  out.wallMagnetKeepsTheAngle = !!bed && (bed.angle || 0) === 0;   // стена горизонтальна
  out.wallMagnetQuantisesAlongTheWall = !!bed
    && Math.abs((bed.x + bed.w / 2) * 1000 - 300) <= PITCH + 1e-6;
  out.thickWallPreviewAndCommitAreIdentical = !!bed && !!thickWallPreview
    && ['x', 'y', 'w', 'h'].every((key) => near(bed[key], thickWallPreview[key], 1e-12))
    && (bed.angle || 0) === thickWallPreview.angle;

  // #447: the same finite outer atom also has its exterior physical face.
  // Raw intent above the wall must never be pulled through to the room side;
  // preview, commit and exact-axis drag all share that decision.
  await openFurniture();
  c._furnPalette = { symbol: 'chair', w: 50, h: 50 };
  c.requestUpdate(); await c.updateComplete;
  const exteriorIntentY = 140 - wallHalf;
  ev('pointermove', stageEl(), 300, exteriorIntentY, { pointerType: 'mouse' });
  await c.updateComplete;
  const exteriorPreview = c._editorRuntime?._furniturePreviewPlacement()
    ? JSON.parse(JSON.stringify(c._editorRuntime._furniturePreviewPlacement())) : null;
  const exteriorDepth = cmToUnits(50);
  const exteriorCentreY = 140 - wallHalf - exteriorDepth / 2;
  out.exteriorPreviewStaysOutside = !!exteriorPreview
    && near((exteriorPreview.y + exteriorPreview.h / 2) * 1000, exteriorCentreY, 1e-6)
    && Math.abs(Math.abs(exteriorPreview.angle) - 180) < 1e-6;
  ev('pointerdown', stageEl(), 300, exteriorIntentY);
  await c.updateComplete;
  const exteriorChair = c._decorList.find((shape) => shape.symbol === 'chair');
  const exteriorChairId = exteriorChair?.id ?? null;
  out.exteriorCommitMatchesPreview = !!exteriorChair && !!exteriorPreview
    && ['x', 'y', 'w', 'h'].every((key) => near(exteriorChair[key], exteriorPreview[key], 1e-12))
    && (exteriorChair.angle || 0) === exteriorPreview.angle;
  ev('pointerdown', el(exteriorChairId), 300, exteriorCentreY);
  ev('pointermove', stageEl(), 300, 140);
  await c.updateComplete;
  const exteriorAxisDrag = c._decorList.find((shape) => shape.id === exteriorChairId);
  out.exteriorExactAxisDragPreservesSide = !!exteriorAxisDrag
    && near((exteriorAxisDrag.y + exteriorAxisDrag.h / 2) * 1000, exteriorCentreY, 1e-6)
    && Math.abs(Math.abs(exteriorAxisDrag.angle || 0) - 180) < 1e-6;
  ev('pointerup', stageEl(), 300, 140);
  await c.updateComplete;

  // The regular decor snap resolves this pointer to the shared wall axis.
  // Surface-side selection must still use the raw point on the r2 side.
  await openFurniture();
  category('chair')?.click(); await c.updateComplete;
  pick('chair'); await c.updateComplete;
  const sharedIntentX = 550 + wallHalf / 2;
  ev('pointermove', stageEl(), sharedIntentX, 300, { pointerType: 'mouse' });
  await c.updateComplete;
  ev('pointerdown', stageEl(), sharedIntentX, 300);
  await c.updateComplete;
  const sharedChair = c._decorList.find((s) => s.symbol === 'chair' && s.id !== exteriorChairId);
  const chairDepth = (sharedChair?.h ?? NaN) * 1000;
  const rightSurfaceCentre = 550 + wallHalf + chairDepth / 2;
  out.sharedWallUsesRawPointerSide = !!sharedChair
    && near((sharedChair.x + sharedChair.w / 2) * 1000, rightSurfaceCentre, 1e-6);

  // Once a piece is on the r2 face, an exact-axis drag preserves that face
  // instead of resolving an arbitrary room/input-order tie.
  const sharedChairId = sharedChair?.id ?? null;
  const sharedChairY = sharedChair ? (sharedChair.y + sharedChair.h / 2) * 1000 : NaN;
  ev('pointerdown', el(sharedChairId), rightSurfaceCentre, sharedChairY);
  ev('pointermove', stageEl(), 550, sharedChairY);
  await c.updateComplete;
  const axisDraggedChair = c._decorList.find((s) => s.id === sharedChairId);
  out.exactAxisDragPreservesWallSide = !!axisDraggedChair
    && near((axisDraggedChair.x + axisDraggedChair.w / 2) * 1000, rightSurfaceCentre, 1e-6);
  ev('pointerup', stageEl(), 550, sharedChairY);
  await c.updateComplete;

  // Shift обходит магнит, но оставляет обычную привязку декора к сетке.
  await openFurniture();
  category('bed')?.click(); await c.updateComplete;
  pick('bed_single'); await c.updateComplete;
  ev('pointerdown', stageEl(), 301.7, 151.3, { shiftKey: true });
  await c.updateComplete;
  const free = c._decorList.find((s) => s.symbol === 'bed_single');
  out.shiftBypassesTheWallMagnet = !!free
    && !near((free.y + free.h / 2) * 1000, 151.3, 1e-6)
    && free.angle === undefined;

  // Coarse pointers have no hover. A cancelled/dragged/second-contact gesture
  // must not become an accidental furniture save. Keep this after the palette
  // click checks because these synthetic pointer streams deliberately have no
  // browser-generated compatibility click tail.
  await openFurniture();
  category('chair')?.click(); await c.updateComplete;
  pick('chair'); await c.updateComplete;
  const beforeTouch = c._decorList.length;
  ev('pointerdown', stageEl(), 330, 330, { pointerType: 'touch', pointerId: 21 });
  ev('pointermove', stageEl(), 350, 350, { pointerType: 'touch', pointerId: 21 });
  ev('pointerup', stageEl(), 350, 350, { pointerType: 'touch', pointerId: 21 });
  ev('pointerdown', stageEl(), 330, 330, { pointerType: 'touch', pointerId: 22 });
  ev('pointercancel', stageEl(), 330, 330, { pointerType: 'touch', pointerId: 22 });
  ev('pointerdown', stageEl(), 330, 330, { pointerType: 'touch', pointerId: 23 });
  ev('pointerdown', stageEl(), 340, 340, { pointerType: 'touch', pointerId: 24, isPrimary: false });
  ev('pointerup', stageEl(), 330, 330, { pointerType: 'touch', pointerId: 23 });
  ev('pointerup', stageEl(), 340, 340, { pointerType: 'touch', pointerId: 24, isPrimary: false });
  await c.updateComplete;
  out.touchCancelMoveAndSecondContactDoNotSave = c._decorList.length === beforeTouch
    && !ghost() && c._furnTouchPending === null;

  // …магнит работает и при ПЕРЕТАСКИВАНИИ: тянем диван к общей толстой стене
  // со стороны гостиной. BACK обязан лечь на x=550-half, а не на ось x=550.
  c._editorRuntime._clearFurniturePreview();
  c._decorTool = 'select'; c._furnPalette = null; c._furnCategory = null;
  c._decorSel = sofaId; c.requestUpdate();
  await c.updateComplete; await sleep(40); await c.updateComplete;
  ev('pointerdown', el(sofaId), 300, 300);
  out.dragStarted = !!sofaId && c._decorMove?.id === sofaId;
  ev('pointermove', stageEl(), 540, 300);
  await c.updateComplete;
  const pulled = sofaNow();
  out.dragMagnetTurnsItToTheWall = Math.abs(Math.abs(pulled.angle || 0) - 90) < 1e-6;
  out.dragMagnetPressesTheBack =
    near((pulled.x + pulled.w / 2) * 1000,
      550 - wallHalf - cmToUnits(90) / 2, 1e-6);
  ev('pointermove', stageEl(), 300, 300, { shiftKey: true });
  await c.updateComplete;
  const shiftDragGridIndex = (sofaNow().x * 1000) / PITCH;
  out.shiftDragRemainsGridBound = near(shiftDragGridIndex, Math.round(shiftDragGridIndex), 1e-6);
  ev('pointerup', stageEl(), 300, 300, { shiftKey: true });
  await c.updateComplete;

  // ================= 7. рамка, углы, плашки, поворот =======================
  // Previous movement deliberately exercised the wall magnet and may have
  // rotated the piece. Isolate the transform fixture at 0° and without flips.
  c._curSpaceCfg.decor = c._decorList.map((shape) => {
    if (shape.id !== sofaId) return shape;
    const clean = { ...shape };
    delete clean.angle; delete clean.flip_h; delete clean.flip_v;
    return clean;
  });
  c._cfgEpoch++;
  c._decorSel = sofaId; c.requestUpdate();
  await c.updateComplete; await sleep(60); await c.updateComplete;
  const frame = () => sr().querySelector('.dtframe');
  out.frameOnSelection = !!frame();
  out.furnitureFrameHasFourSideHandles = !!frame()
    && frame().classList.contains('dtfurnitureframe')
    && frame().querySelectorAll('.dthandle').length === 9
    && frame().querySelectorAll('.dtknob').length === 9
    && frame().querySelectorAll('.dthandle.dtedge').length === 4
    && !!frame().querySelector('.dtrot');
  out.sideHandlesExposeAxisCursors = [...frame().querySelectorAll('.dthandle.dtedge')]
    .every((handle) => ['ew-resize', 'ns-resize'].includes(getComputedStyle(handle).cursor));
  out.rotationHandleUsesCircularCursor = getComputedStyle(frame().querySelector('.dtrot')).cursor.includes('url(');
  const rOf = (sel) => { const e = frame()?.querySelector(sel); return e ? +e.getAttribute('r') : NaN; };
  out.handleSizeIsTheTaskOneSize = Math.abs(rOf('.dtknob') * 4 - rOf('.dthandle.dtrot'))
    / Math.max(rOf('.dthandle.dtrot'), 1e-9) < 0.05;
  out.frameBoxIsTheShapeBox = !!c._dtBox
    && near(c._dtBox.w, sofaNow().w * 1000, 1e-6)
    && near(c._dtBox.h, sofaNow().h * 1000, 1e-6);

  const visiblePath = el(sofaId);
  const hitPath = sr().querySelector(`.dfurniturehit[data-id="${sofaId}"]`);
  out.selectionHaloUsesTheRealArtworkPath = !!visiblePath && !!hitPath
    && hitPath.getAttribute('d') === visiblePath.getAttribute('d')
    && hitPath.getAttribute('transform') === visiblePath.getAttribute('transform')
    && Number(hitPath.getAttribute('stroke-width')) > Number(visiblePath.getAttribute('stroke-width'))
    && getComputedStyle(hitPath).pointerEvents === 'stroke'
    && /transparent|rgba\(0, 0, 0, 0\)/.test(getComputedStyle(hitPath).stroke);

  // Shift: independent, continuous width/depth + live plates.
  const before = { w: sofaNow().w, h: sofaNow().h };
  const b = c._dtBox || { x: 0, y: 0, w: 0, h: 0 };
  const handles = [...(frame()?.querySelectorAll('.dthandle') || [])];
  // #400: угловая ручка ищется по РОЛИ, а не по индексу в DOM. Индекс держался
  // на порядке отрисовки, а порядок — это решение о приоритете хита (углы
  // рисуются последними, чтобы выигрывать нажатие у осевых на мелкой мебели),
  // и оно имеет право меняться. Юго-восточный угол — второй `nwse`.
  const cornerHandles = handles.filter((el) => !el.classList.contains('dtrot')
    && !el.classList.contains('dtedge'));
  const se = cornerHandles[2] || stageEl();                 // SE — [1, 1, 'nwse']
  ev('pointerdown', se, b.x + b.w, b.y + b.h);
  out.cornerDragStarted = c._dtDrag?.kind === 'scale' && !!c._dtDrag?.orig;
  ev('pointermove', stageEl(), b.x + b.w + 100, b.y + b.h + 20, { shiftKey: true });
  await c.updateComplete;
  const grown = sofaNow();
  out.cornerGrowsTheWidth = grown.w > before.w && near(grown.w * 1000, b.w + 100, 1e-6);
  out.cornerGrowsTheDepthINDEPENDENTLY = grown.h > before.h
    && near(grown.h * 1000, b.h + 20, 1e-6);
  out.shiftResizeIsSubGrid = !near((grown.h * 1000) / PITCH,
    Math.round((grown.h * 1000) / PITCH), 1e-4);
  out.oppositeCornerStaysPut = near(grown.x * 1000, b.x, 1e-6) && near(grown.y * 1000, b.y, 1e-6);
  const plates = [...sr().querySelectorAll('.measurelabel.furnmeasure')];
  out.twoLivePlates = plates.length === 2;
  out.platesShowRealLengths = plates.length === 2
    && plates.every((p) => /\d/.test(p.textContent))
    && plates.some((p) => /m|м|′/.test(p.textContent));
  // Without Shift the original ratio is preserved, still without grid snap.
  ev('pointermove', stageEl(), b.x + b.w + 101.7, b.y + b.h + 21.3);
  await c.updateComplete;
  const proportional = sofaNow();
  const wCells = (proportional.w * 1000) / PITCH;
  out.defaultResizePreservesRatio = near(proportional.w / proportional.h, before.w / before.h, 1e-5);
  out.defaultResizeIsSubGrid = !near(wCells, Math.round(wCells), 1e-4);
  ev('pointerup', stageEl(), b.x + b.w + 101.7, b.y + b.h + 21.3);
  await c.updateComplete;
  out.cornerDragEnded = !c._dtDrag;
  out.noPlatesAfterTheDrag = !sr().querySelector('.measurelabel.furnmeasure');

  // A middle handle changes only one axis and keeps the opposite edge fixed.
  const edgeBefore = { ...sofaNow() };
  const eb = c._dtBox;
  const rightEdge = [...frame().querySelectorAll('.dthandle.dtedge')].find((handle) =>
    near(+handle.getAttribute('cx'), eb.x + eb.w, 1e-6));
  ev('pointerdown', rightEdge, eb.x + eb.w, eb.y + eb.h / 2);
  ev('pointermove', stageEl(), eb.x + eb.w + 13.7, eb.y + eb.h / 2);
  await c.updateComplete;
  const edgeAfter = sofaNow();
  out.edgeHandleChangesOneAxisContinuously = near(edgeAfter.h, edgeBefore.h, 1e-9)
    && near(edgeAfter.w * 1000, edgeBefore.w * 1000 + 13.7, 1e-6)
    && near(edgeAfter.x, edgeBefore.x, 1e-9) && near(edgeAfter.y, edgeBefore.y, 1e-9);
  ev('pointerup', stageEl(), eb.x + eb.w + 13.7, eb.y + eb.h / 2);
  await c.updateComplete;

  // Crossing the fixed corner toggles only the crossed axis. pointercancel
  // must restore the exact pre-gesture object and create no persisted flip.
  const crossBefore = JSON.parse(JSON.stringify(sofaNow()));
  const cb = c._dtBox;
  const crossHandles = [...frame().querySelectorAll('.dthandle')]
    .filter((el) => !el.classList.contains('dtrot') && !el.classList.contains('dtedge'));
  const crossSe = crossHandles[2];   // #400: по роли, не по позиции в DOM
  ev('pointerdown', crossSe, cb.x + cb.w, cb.y + cb.h);
  ev('pointermove', stageEl(), cb.x - 25, cb.y + cb.h + 10, { shiftKey: true });
  await c.updateComplete;
  const crossed = sofaNow();
  out.crossingTogglesOnlyHorizontalFlip = crossed.flip_h === true && !crossed.flip_v
    && crossed.w > 0 && crossed.h > 0 && near(crossed.x * 1000 + crossed.w * 1000, cb.x, 1e-6);
  ev('pointercancel', stageEl(), cb.x - 25, cb.y + cb.h + 10, { shiftKey: true });
  await c.updateComplete;
  out.crossingCancelRestoresTheObject = JSON.stringify(sofaNow()) === JSON.stringify(crossBefore);

  // Furniture rotation is free; Shift snaps to the nearest 45°.
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
  const fine = sofaNow().angle;
  out.rotationIsFreeWithoutShift = fine > 0.5 && fine < 5;
  ev('pointermove', stageEl(), cx + 100, cy + 2, { shiftKey: true });
  await c.updateComplete;
  out.shiftSnapsRotationTo45 = (sofaNow().angle || 0) === 0;
  ev('pointermove', stageEl(), cx + 100, cy + 100);
  await c.updateComplete;
  ev('pointerup', stageEl(), cx + 100, cy + 100);
  await c.updateComplete;
  out.rotationIsRendered = /rotate\(/.test(attr(sofaId, 'transform') || '');

  // ================= 8. конфиг и пересборка ================================
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
  c._decorTool = 'select';
  c._decorShapeDbl({ preventDefault() {}, stopPropagation() {} }, after);
  await c.updateComplete;
  out.objectDialogSelectsStoredSymbol = sr().querySelector(
    '.body select.namein option:checked',
  )?.value === stored.symbol;
  const sizeInputs = [...sr().querySelectorAll('hp-dialog input[type="number"][step="any"]')];
  const flipInputs = [...sr().querySelectorAll('hp-dialog .dfill input[type="checkbox"]')];
  out.furniturePropertiesExposeSignedSizesAndTwoFlips = sizeInputs.length === 2 && flipInputs.length === 2;
  if (sizeInputs[0]) {
    sizeInputs[0].value = String(-Math.abs(Number(sizeInputs[0].value)));
    sizeInputs[0].dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    await c.updateComplete;
  }
  out.negativeWidthSynchronisesHorizontalCheckbox = !!c._decorShapeDialog?.flipH
    && !!sr().querySelectorAll('hp-dialog .dfill input[type="checkbox"]')[0]?.checked;
  const currentFlipInputs = [...sr().querySelectorAll('hp-dialog .dfill input[type="checkbox"]')];
  if (currentFlipInputs[1]) {
    currentFlipInputs[1].checked = true;
    currentFlipInputs[1].dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    await c.updateComplete;
  }
  const currentSizes = [...sr().querySelectorAll('hp-dialog input[type="number"][step="any"]')];
  out.verticalCheckboxSynchronisesNegativeDepth = !!c._decorShapeDialog?.flipV
    && Number(currentSizes[1]?.value) < 0;
  if (currentSizes[0]) {
    currentSizes[0].value = '0';
    currentSizes[0].dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    await c.updateComplete;
  }
  out.zeroSizeBlocksSave = sr().querySelector('hp-dialog button.btn.primary')?.disabled === true
    && sr().querySelector('hp-dialog input[type="number"][step="any"]')?.getAttribute('aria-invalid') === 'true';
  c._decorShapeDialog = {
    ...c._decorShapeDialog,
    sizeWField: String(-Math.abs(Number(stored.w) * 1000 * CELL / PITCH / 100)),
  };
  c._decorSaveShape(); await c.updateComplete;
  const propertySaved = sofaNow();
  out.propertySavePersistsPositiveExtentsAndFlags = propertySaved.w > 0 && propertySaved.h > 0
    && propertySaved.flip_h === true && propertySaved.flip_v === true
    && c._decorShapeDialog === null;

  // ================= 9. инертность и удаление ==============================
  c._decorTool = 'furniture'; c._furnPalette = null; await c.updateComplete;
  out.inertUnderTheStamp = pe(sofaId) === 'none';
  const n0 = c._decorList.length;
  ev('pointerdown', stageEl(), 320, 320);                   // символ НЕ выбран
  await c.updateComplete;
  out.noSymbolNoStamp = c._decorList.length === n0;
  out.unarmedCanvasDismissReturnsToSelect = c._decorTool === 'select' && !pal();
  out.unarmedCanvasDismissLeavesNoClickSuppression = c._suppressClick === false;
  c._decorTool = 'erase'; await c.updateComplete;
  ev('pointerdown', el(sofaId), 300, 300);
  await c.updateComplete;
  // Eraser is intentionally two-step now; the generic decor smoke verifies
  // the dialog itself, while this furniture scenario confirms the action.
  c._confirmDecorErase();
  await c.updateComplete;
  out.eraseRemovesIt = !!sofaId && !c._decorList.some((s) => s.id === sofaId);
  // а в режиме просмотра мебель видна и не кликается
  c._setMode('view'); await c.updateComplete; await sleep(30);
  const left = c._decorList.find((s) => s.kind === 'furniture');
  out.visibleInView = !!left && !!el(left.id);
  out.inertInView = !!left && pe(left.id) === 'none';
  return out;
});

// #361: this is deliberately a pixel assertion, not another DOM-attribute
// comparison. `vector-effect=non-scaling-stroke` can make the attributes look
// perfectly consistent while Chromium paints furniture at the wrong camera
// zoom. Bright magenta isolates the fixture from the normal plan artwork.
const renderStrokeFixture = async (zoom, angle = 0, viewport = null) => {
  if (viewport) {
    await page.setViewportSize(viewport);
    await page.evaluate((width) => {
      const host = document.querySelector('#host');
      if (host instanceof HTMLElement) host.style.width = `${width}px`;
    }, Math.max(320, viewport.width - 40));
  }
  await page.evaluate(async ({ zoom, angle }) => {
    const c = window.__card;
    c._setMode('view');
    await c.updateComplete;
    for (let i = 0; i < 80 && c._modeTransitionBusy; i++)
      await new Promise((resolve) => setTimeout(resolve, 20));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    c._curSpaceCfg.decor = [
      { id: 'stroke-control', kind: 'line', x1: 0.18, y1: 0.18, x2: 0.50, y2: 0.18,
        color: '#ff00ff', opacity: 1, width_cm: 8 },
      // Designer artwork: deliberately very wide and shallow so a leaked local
      // x/y scale produces obviously different horizontal/vertical strokes.
      { id: 'stroke-designer', kind: 'furniture', symbol: 'coffee_table',
        x: 0.18, y: 0.30, w: 0.38, h: 0.09, angle,
        color: '#ff00ff', opacity: 1, width_cm: 8 },
      // Compatibility artwork: unit-box primitive, exercising the other path
      // source retained by the furniture catalogue.
      { id: 'stroke-primitive', kind: 'furniture', symbol: 'fridge',
        x: 0.62, y: 0.27, w: 0.11, h: 0.20, angle,
        color: '#ff00ff', opacity: 1, width_cm: 8 },
    ];
    c._cfgEpoch++;
    c._zoom = 1;
    c._view = null;
    c.requestUpdate();
    await c.updateComplete;
    c._applyView(zoom, 450, 350);
    c.requestUpdate();
    await c.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, { zoom, angle });

  const samples = await page.evaluate(() => {
    const root = window.__card.shadowRoot || window.__card.renderRoot;
    const sample = (id, a, b) => {
      const node = root.querySelector(`.decorlayer [data-id="${id}"]`);
      const matrix = node?.getScreenCTM?.();
      if (!node || !matrix) return null;
      const map = ([x, y]) => {
        const point = new DOMPoint(x, y).matrixTransform(matrix);
        return { x: point.x, y: point.y };
      };
      return { a: map(a), b: map(b) };
    };
    const line = root.querySelector('.decorlayer [data-id="stroke-control"]');
    const x1 = Number(line?.getAttribute('x1'));
    const x2 = Number(line?.getAttribute('x2'));
    const y = Number(line?.getAttribute('y1'));
    return {
      control: sample('stroke-control', [x1 + (x2 - x1) * 0.35, y], [x1 + (x2 - x1) * 0.65, y]),
      // coffee_table generated art: long top and right-side straight runs.
      designerH: sample('stroke-designer', [30, 3.692], [90, 3.692]),
      designerV: sample('stroke-designer', [116.16, 18], [116.16, 45]),
      // fridge compatibility art is the canonical unit rectangle.
      primitive: sample('stroke-primitive', [0.2, 0], [0.8, 0]),
    };
  });
  const png = (await page.screenshot({ type: 'png' })).toString('base64');
  return page.evaluate(async ({ png, samples }) => {
    const image = new Image();
    image.src = `data:image/png;base64,${png}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const magenta = (x, y) => {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return false;
      const i = (y * canvas.width + x) * 4;
      return pixels[i] > 150 && pixels[i + 1] < 130 && pixels[i + 2] > 150 && pixels[i + 3] > 80;
    };
    const thickness = (segment) => {
      if (!segment) return NaN;
      const dx = segment.b.x - segment.a.x;
      const dy = segment.b.y - segment.a.y;
      const length = Math.hypot(dx, dy);
      if (!(length > 8)) return NaN;
      const tx = dx / length, ty = dy / length;
      const nx = -ty, ny = tx;
      const cx = (segment.a.x + segment.b.x) / 2;
      const cy = (segment.a.y + segment.b.y) / 2;
      const widths = [];
      for (const along of [-8, -4, 0, 4, 8]) {
        const hits = [];
        for (let normal = -24; normal <= 24; normal++) {
          if (magenta(cx + tx * along + nx * normal, cy + ty * along + ny * normal))
            hits.push(normal);
        }
        if (hits.length) widths.push(hits.at(-1) - hits[0] + 1);
      }
      widths.sort((a, b) => a - b);
      return widths.length ? widths[Math.floor(widths.length / 2)] : NaN;
    };
    return Object.fromEntries(Object.entries(samples).map(([key, value]) => [key, thickness(value)]));
  }, { png, samples });
};

const z1 = await renderStrokeFixture(1);
const z2 = await renderStrokeFixture(2);
const rotated = await renderStrokeFixture(1, 30);
const rotatedZ2 = await renderStrokeFixture(2, 30);
const compact = await renderStrokeFixture(1, 0, { width: 620, height: 760 });
const finite = (...values) => values.every((value) => Number.isFinite(value) && value > 0);
const closePx = (a, b, tolerance = 2) => finite(a, b) && Math.abs(a - b) <= tolerance;
const doubles = (a, b) => finite(a, b) && b / a >= 1.6 && b / a <= 2.4;
res.rasterFixturePainted = finite(
  z1.control, z1.designerH, z1.designerV, z1.primitive,
  z2.control, z2.designerH, z2.primitive, rotated.designerH,
  rotatedZ2.designerH, compact.control, compact.designerH, compact.primitive,
);
res.furnitureFollowsPhysicalCameraZoom = doubles(z1.control, z2.control)
  && doubles(z1.designerH, z2.designerH)
  && doubles(z1.primitive, z2.primitive)
  && doubles(rotated.designerH, rotatedZ2.designerH);
res.designerAndPrimitiveMatchOrdinaryDecor = closePx(z1.designerH, z1.control)
  && closePx(z1.primitive, z1.control)
  && closePx(z2.designerH, z2.control)
  && closePx(z2.primitive, z2.control);
res.anisotropicResizeKeepsBothAxesEqual = closePx(z1.designerH, z1.designerV);
res.rotatedArtworkKeepsTheSameThickness = closePx(rotated.designerH, z1.designerH);
res.viewportResizeRecalculatesTheSharedPhysicalStroke = closePx(compact.designerH, compact.control)
  && closePx(compact.primitive, compact.control)
  && Math.abs(compact.control - z1.control) >= 1;
checkAll(res);
await finish(browser, res);
