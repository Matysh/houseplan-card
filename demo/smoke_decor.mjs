import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const settleMode = async () => {
    const started = performance.now();
    do { await new Promise((resolve) => requestAnimationFrame(resolve)); }
    while (c._modeTransitionBusy && performance.now() - started < 1500);
    await c.updateComplete;
  };
  const esc = async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await c.updateComplete; };
  // 1) третья вкладка есть
  const tabs = [...sr().querySelectorAll('.modetab')];
  out.threeTabs = tabs.length === 3;
  tabs[2].click(); await settleMode();
  out.decorMode = c._mode === 'decor';
  out.decorBar = !!sr().querySelector('.editbar.decorbar');
  // #362: devices in Background are one translucent landmark layer, never
  // pointer targets. Exercise both the round core and the part of a value
  // capsule that extends outside the marker's nominal box.
  const stage = sr().querySelector('.stage');
  const devlayer = sr().querySelector('.devlayer');
  const visibleDevices = [...sr().querySelectorAll('.dev')].filter((node) => {
    const r = node.getBoundingClientRect();
    const s = stage?.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && s
      && r.left > s.left && r.right < s.right && r.top > s.top && r.bottom < s.bottom;
  });
  const inertDevice = visibleDevices.find((node) =>
    node.classList.contains('valonly') || node.querySelector('.device-shell.with-values'))
    || visibleDevices[0];
  const deviceFrame = inertDevice?.querySelector('.device-shell-frame');
  const deviceRect = inertDevice?.getBoundingClientRect();
  const frameRect = deviceFrame?.getBoundingClientRect();
  const corePoint = deviceRect
    ? { x: deviceRect.left + deviceRect.width / 2, y: deviceRect.top + deviceRect.height / 2 }
    : null;
  const capsulePoint = frameRect
    ? { x: frameRect.right - 1, y: frameRect.top + frameRect.height / 2 }
    : corePoint;
  const pointTarget = (point) => point ? sr().elementFromPoint(point.x, point.y) : null;
  const belowDevice = (point) => {
    const target = pointTarget(point);
    return !!target && !target.closest?.('.devlayer');
  };
  out.decorDeviceLayerIsTranslucent = !!devlayer
    && Math.abs(Number(getComputedStyle(devlayer).opacity) - 0.35) < 0.001;
  out.decorDeviceCoreFallsThrough = belowDevice(corePoint);
  out.decorDeviceCapsuleFallsThrough = belowDevice(capsulePoint);
  out.decorDeviceSubtreeIsPointerInert = !!inertDevice && !!deviceFrame
    && getComputedStyle(inertDevice).pointerEvents === 'none'
    && getComputedStyle(inertDevice, '::before').pointerEvents === 'none'
    && getComputedStyle(deviceFrame).pointerEvents === 'none';

  // The CSS boundary is primary; direct dispatch pins the independent handler
  // guard. A future cascade regression may make the node targetable again, but
  // Background still cannot hover, actuate or create a device-layout drag.
  let serviceCalls = 0, wsCalls = 0;
  const oldCallService = c.hass.callService;
  const oldCallWS = c.hass.callWS;
  c.hass.callService = () => { serviceCalls += 1; };
  c.hass.callWS = async () => { wsCalls += 1; return { ok: true }; };
  c._tip = null; c._infoCard = null; c._drag = null;
  inertDevice?.dispatchEvent(new PointerEvent('pointerover', {
    bubbles: true, composed: true, cancelable: true, pointerId: 360, pointerType: 'mouse', isPrimary: true,
  }));
  inertDevice?.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, composed: true, cancelable: true, pointerId: 361, pointerType: 'mouse',
    clientX: corePoint?.x || 0, clientY: corePoint?.y || 0, button: 0, isPrimary: true,
  }));
  inertDevice?.dispatchEvent(new MouseEvent('click', {
    bubbles: true, composed: true, cancelable: true, clientX: corePoint?.x || 0,
    clientY: corePoint?.y || 0, button: 0,
  }));
  out.decorDeviceHandlersFailClosed = serviceCalls === 0 && wsCalls === 0
    && c._tip === null && c._infoCard === null && c._drag === null;
  c.hass.callService = oldCallService;
  c.hass.callWS = oldCallWS;
  c._pointers.clear(); c._panStart = null; c._panLock = null;

  const dispatchToolPress = (point, pid, shiftKey = false) => {
    const target = pointTarget(point);
    target?.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, composed: true, cancelable: true, pointerId: pid,
      pointerType: 'mouse', clientX: point?.x || 0, clientY: point?.y || 0,
      button: 0, isPrimary: true, shiftKey,
    }));
    return target;
  };
  c._decorTool = 'line'; c._decorDraft = null; await c.updateComplete;
  dispatchToolPress(capsulePoint, 362);
  await c.updateComplete;
  out.lineStartsThroughDeviceCapsule = c._decorDraft?.kind === 'line';
  c._decorDraft = null;
  c._decorTool = 'rect'; await c.updateComplete;
  dispatchToolPress(corePoint, 363);
  await c.updateComplete;
  out.rectStartsThroughDeviceCore = c._decorDraft?.kind === 'rect';
  c._decorDraft = null;
  c._decorTool = 'text'; c._decorTextDialog = null; await c.updateComplete;
  dispatchToolPress(corePoint, 364);
  await c.updateComplete;
  out.textStartsThroughDeviceCore = !!c._decorTextDialog && !c._decorTextDialog.id;
  c._decorTextDialog = null;
  const decorBeforeDeviceProbe = JSON.parse(JSON.stringify(c._decorList));
  c._editorSecondary.openPalette();
  c._decorTool = 'furniture'; c._furnPalette = { symbol: 'chair', w: 45, h: 45 };
  await c.updateComplete;
  const furniturePoint = visibleDevices.map((node) => {
    const r = node.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }).find((point) => pointTarget(point)?.closest?.('.stage')) || corePoint;
  out.furnitureToolArmedThroughDeviceCore = c._decorTool === 'furniture' && c._furnPalette?.symbol === 'chair';
  out.furnitureTargetFallsThroughDeviceCore = belowDevice(furniturePoint);
  stage?.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, composed: true, cancelable: true, pointerId: 365,
    pointerType: 'mouse', clientX: furniturePoint?.x || 0, clientY: furniturePoint?.y || 0,
    button: 0, isPrimary: true, shiftKey: true,
  }));
  await c.updateComplete;
  out.furniturePlacesThroughDeviceCore = c._decorList.length === decorBeforeDeviceProbe.length + 1
    && c._decorList.some((shape) => shape.kind === 'furniture' && shape.symbol === 'chair');
  c._curSpaceCfg.decor = decorBeforeDeviceProbe;
  c._decorSel = null; c._decorTool = 'select'; c._furnPalette = null;
  c._cfgEpoch = (c._cfgEpoch || 0) + 1;
  c.requestUpdate(); await c.updateComplete;
  // #360: the shared session default is permanently available in the primary
  // toolbar, while the drawing context keeps its existing synchronized picker.
  c._decorTool = 'line'; c.requestUpdate(); await c.updateComplete;
  const picker = sr().querySelector('.editor-secondary hp-color-opacity');
  const mainPicker = () => sr().querySelector('.decorbar hp-color-opacity.decor-default-color');
  out.defaultStyleLivesInMainBarAndContextTray = !!picker && !!mainPicker();
  const toolsWithDefault = [];
  for (const tool of ['select', 'backdrop', 'line', 'rect', 'ellipse', 'text', 'furniture', 'erase']) {
    c._decorTool = tool; c.requestUpdate(); await c.updateComplete;
    toolsWithDefault.push(!!mainPicker());
  }
  out.defaultStyleVisibleForEveryDecorTool = toolsWithDefault.every(Boolean);
  c._decorTool = 'line'; c.requestUpdate(); await c.updateComplete;
  const originalDecorStyle = { ...c._decorStyle };
  const originalDecorForDefaultProbe = JSON.parse(JSON.stringify(c._decorList));
  const existingDefaultProbe = {
    id: 'dc-default-existing', kind: 'line', x1: 0.05, y1: 0.05, x2: 0.1, y2: 0.05,
    color: '#112233', opacity: 0.8, width_cm: 3,
  };
  c._curSpaceCfg.decor = [existingDefaultProbe];
  c._decorStyle = {
    ...c._decorStyle, fill: true, fillColor: '#fedcba', fillOpacity: 0.23,
  };
  c._cfgEpoch = (c._cfgEpoch || 0) + 1;
  c.requestUpdate(); await c.updateComplete;
  mainPicker().dispatchEvent(new CustomEvent('hp-color-opacity-change', {
    detail: { color: '#2468ac', opacity: 0.37 }, bubbles: true, composed: true,
  }));
  await c.updateComplete;
  const contextAfterMain = sr().querySelector('.editor-secondary hp-color-opacity');
  out.mainPickerUpdatesOneSessionDefault = c._decorStyle.color === '#2468ac'
    && c._decorStyle.opacity === 0.37
    && contextAfterMain?.color === '#2468ac' && contextAfterMain?.opacity === 0.37;
  out.mainPickerLeavesExistingObjectsUntouched =
    JSON.stringify(c._decorList[0]) === JSON.stringify(existingDefaultProbe);
  contextAfterMain.dispatchEvent(new CustomEvent('hp-color-opacity-change', {
    detail: { color: '#3579bd', opacity: 0.46 }, bubbles: true, composed: true,
  }));
  await c.updateComplete;
  out.contextPickerUpdatesMainPicker = c._decorStyle.color === '#3579bd'
    && c._decorStyle.opacity === 0.46
    && mainPicker()?.color === '#3579bd' && mainPicker()?.opacity === 0.46;

  const gDefault = c._gridPitch;
  for (const [kind, a, b] of [
    ['line', [gDefault * 2, gDefault * 2], [gDefault * 6, gDefault * 2]],
    ['rect', [gDefault * 8, gDefault * 2], [gDefault * 12, gDefault * 6]],
    ['ellipse', [gDefault * 14, gDefault * 2], [gDefault * 18, gDefault * 6]],
  ]) {
    c._decorDraft = { kind, a, b, pid: 370 };
    c._decorCommitDraft();
  }
  c._decorTool = 'text'; c._decorTextDialog = null;
  c._decorPointerDown({
    target: sr().querySelector('.stage'), preventDefault() {}, pointerType: 'mouse', button: 0, pointerId: 371,
    clientX: sr().querySelector('.stage').getBoundingClientRect().left + 12,
    clientY: sr().querySelector('.stage').getBoundingClientRect().top + 12,
  });
  const textInheritsDefault = c._decorTextDialog?.color === '#3579bd'
    && c._decorTextDialog?.opacity === 0.46;
  c._decorTextDialog = { ...c._decorTextDialog, text: 'Default probe' };
  c._decorSaveText();
  c._furnPalette = { symbol: 'chair', w: 45, h: 45 };
  c._furnPlace([gDefault * 24, gDefault * 12], true);
  await c.updateComplete;
  const createdByDefault = c._decorList.filter((shape) => shape.id !== existingDefaultProbe.id);
  out.everyNewDecorKindUsesMainDefault = textInheritsDefault
    && ['line', 'rect', 'ellipse', 'text', 'furniture'].every((kind) =>
      createdByDefault.some((shape) => shape.kind === kind
        && shape.color === '#3579bd' && shape.opacity === 0.46));
  out.mainDefaultDoesNotOverwriteShapeFill = ['rect', 'ellipse'].every((kind) => {
    const shape = createdByDefault.find((entry) => entry.kind === kind);
    return shape?.fill === true && shape?.fill_color === '#fedcba'
      && shape?.fill_opacity === 0.23;
  });
  c._curSpaceCfg.decor = originalDecorForDefaultProbe;
  c._decorStyle = originalDecorStyle;
  c._decorSel = null; c._decorTool = 'line'; c._furnPalette = null;
  c._cfgEpoch = (c._cfgEpoch || 0) + 1;
  c.requestUpdate(); await c.updateComplete;

  // The compact colour/opacity control must escape the clipped editor/dialog
  // surface through the browser top layer and remain inside the viewport.
  const popoverPicker = sr().querySelector('.editor-secondary hp-color-opacity');
  const trigger = popoverPicker?.shadowRoot?.querySelector('.trigger');
  trigger?.click();
  await popoverPicker?.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const popup = popoverPicker?.shadowRoot?.querySelector('.picker');
  const popupRect = popup?.getBoundingClientRect();
  out.colorPickerUsesTopLayer = !!popup?.matches(':popover-open');
  out.colorPickerInsideViewport = !!popupRect
    && popupRect.left >= 0 && popupRect.top >= 0
    && popupRect.right <= innerWidth && popupRect.bottom <= innerHeight;
  trigger?.click();
  await popoverPicker?.updateComplete;
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
  c._decorDraft = { kind: 'rect', a: [g, g], b: [g * 5, g], pid: 1 };
  c._decorCommitDraft();
  out.flatRectSkipped = c._decorList.length === 3;
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
  // прямоугольник показывает габарит и чистую площадь
  c._decorDraft = { kind: 'rect', a: [g * 4, g * 20], b: [g * 12, g * 26], pid: 3 };
  await c.updateComplete;
  out.rectBadgeHasSizeAndArea = txt().startsWith(fmt(g * 8) + ' × ' + fmt(g * 6) + ' · ')
    && /(?:m²|ft²)$/.test(txt());
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
  c._decorMove = null;
  const selectionTray = sr().querySelector('.editor-secondary-host.open .editor-secondary.kind-selection');
  out.selectionActionsUseContextTray = !!selectionTray
    && !!selectionTray.querySelector('ha-icon[icon="mdi:tune"]')
    && !!selectionTray.querySelector('ha-icon[icon="mdi:delete-outline"]')
    && !sr().querySelector('.decorbar .danger');
  const selectionAction = selectionTray?.querySelector('button');
  selectionAction?.focus();
  selectionAction?.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Delete', bubbles: true, composed: true, cancelable: true,
  }));
  await c.updateComplete;
  out.deleteDoesNotFallThroughContextTray = c._decorSel === 'dcprobe'
    && c._decorList.some((shape) => shape.id === 'dcprobe');
  const staleContextId = c._editorSecondaryContextId;
  let staleInvokes = 0;
  const staleInvoke = () => c._runEditorContext(staleContextId, () => { staleInvokes += 1; });
  const otherShape = c._decorList.find((shape) => shape.id !== 'dcprobe');
  c._decorSel = otherShape?.id || null;
  c._decorShapeDialog = null;
  c.requestUpdate(); await c.updateComplete;
  staleInvoke();
  out.staleContextActionIsIgnored = staleInvokes === 0 && c._decorShapeDialog === null;
  c._decorSel = 'dcprobe'; c.requestUpdate(); await c.updateComplete;
  // Double click in Select is the universal properties gesture for every
  // object, not only text. It must go through the rendered listener so this
  // also pins the event wiring, then persist the common colour/width fields.
  probe().dispatchEvent(new MouseEvent('dblclick', {
    bubbles: true, composed: true, cancelable: true, button: 0,
  }));
  await c.updateComplete;
  out.doubleClickOpensObjectDialog = c._decorShapeDialog?.id === 'dcprobe'
    && !!sr().querySelector('hp-dialog .dfill') === false;
  out.lineStyleDefaultsSolid = c._decorShapeDialog?.lineStyle === 'solid'
    && sr().querySelectorAll('input[name="decor-line-style"]').length === 2
    && !c._decorList.find((x) => x.id === 'dcprobe')?.line_style;
  const angleInput = sr().querySelector('hp-dialog input[min="-180"][max="180"]');
  if (angleInput) {
    angleInput.value = '12.3456';
    angleInput.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    await c.updateComplete;
  }
  out.angleInputKeepsWorkingPrecision = c._decorShapeDialog?.angle === '12.3456'
    && sr().querySelector('hp-dialog input[min="-180"][max="180"]')?.value === '12.3456';
  out.lineStyleAbsentFromToolbar = !sr().querySelector('.editbar input[name="decor-line-style"]');
  c._decorShapeDialog = {
    ...c._decorShapeDialog, color: '#123456', widthCm: 6.5, lineStyle: 'dashed',
  };
  c._decorSaveShape(); await c.updateComplete;
  const editedProbe = c._decorList.find((x) => x.id === 'dcprobe');
  out.objectDialogSavesStyle = editedProbe?.color === '#123456'
    && editedProbe?.width_cm === 6.5 && editedProbe?.width === undefined
    && editedProbe?.line_style === 'dashed'
    && c._decorShapeDialog === null;
  out.objectDialogRefreshesMainDefault = c._decorStyle.color === '#123456'
    && sr().querySelector('.decorbar hp-color-opacity.decor-default-color')?.color === '#123456';
  out.dashedLineRendered = !!probe()?.getAttribute('stroke-dasharray');
  c._undoGeometry(); await c.updateComplete;
  const undoSolid = !c._decorList.find((x) => x.id === 'dcprobe')?.line_style;
  c._redoGeometry(); await c.updateComplete;
  out.lineStyleUndoRedo = undoSolid
    && c._decorList.find((x) => x.id === 'dcprobe')?.line_style === 'dashed';
  // Selection handles intentionally sit above the hit proxy. Clear the frame
  // so this assertion measures the dashed line's gap, not an endpoint handle.
  c._decorSel = null; c.requestUpdate(); await c.updateComplete;
  const selectHit = sr().querySelector('.decorlayer line.dselecthit[data-id="dcprobe"]');
  const dashedPaint = probe();
  let gapPicked = null;
  if (selectHit && dashedPaint) {
    const sw = Number(dashedPaint.getAttribute('stroke-width')) || 1;
    const gapPoint = dashedPaint.getPointAtLength(Math.min(dashedPaint.getTotalLength() * 0.75, sw * 5.5));
    const screenPoint = new DOMPoint(gapPoint.x, gapPoint.y).matrixTransform(dashedPaint.getScreenCTM());
    gapPicked = sr().elementFromPoint(screenPoint.x, screenPoint.y);
  }
  out.dashedLineSelectableAcrossGaps = gapPicked === selectHit
    && selectHit?.classList.contains('dshape')
    && selectHit?.dataset.hp === 'decor'
    && selectHit?.dataset.id === 'dcprobe';
  // Erase gets a constant screen-space target around hairlines. Exercise the
  // browser's actual SVG hit-test 6 px away from a sub-pixel painted stroke;
  // dispatching directly to the proxy would only prove that its listener exists.
  c._replaceDecor('dcprobe', { width_cm: 0.1, width: undefined });
  c._decorTool = 'erase'; await c.updateComplete;
  const paintedProbe = sr().querySelector('.decorlayer line.dshape:not(.derasehit)');
  const eraseHit = sr().querySelector('.decorlayer line.derasehit');
  const matrix = paintedProbe?.getScreenCTM();
  let picked = null;
  if (paintedProbe && eraseHit && matrix) {
    const p1 = new DOMPoint(+paintedProbe.getAttribute('x1'), +paintedProbe.getAttribute('y1')).matrixTransform(matrix);
    const p2 = new DOMPoint(+paintedProbe.getAttribute('x2'), +paintedProbe.getAttribute('y2')).matrixTransform(matrix);
    const dx = p2.x - p1.x, dy = p2.y - p1.y, len = Math.hypot(dx, dy) || 1;
    picked = sr().elementFromPoint((p1.x + p2.x) / 2 - (dy / len) * 6,
      (p1.y + p2.y) / 2 + (dx / len) * 6);
  }
  out.eraseHairlineHasWideHitTarget = picked === eraseHit
    && getComputedStyle(eraseHit).strokeWidth === '16px'
    && getComputedStyle(eraseHit).pointerEvents === 'stroke';
  picked?.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, composed: true, cancelable: true, pointerId: 45, button: 0, isPrimary: true,
  }));
  await c.updateComplete;
  out.eraseWideHitOpensConfirmation = c._decorEraseConfirm?.id === 'dcprobe';
  c._decorEraseConfirm = null;
  c._decorSel = null;
  c._curSpaceCfg.decor = decorBefore;                 // сцена как была до пробы
  c._decorTool = 'select'; await c.updateComplete;
  out.decorRestored = c._decorList.length === decorBefore.length;
  // Switching modes during a live move cancels the transaction and restores
  // its start instead of leaving mutated geometry with a forgotten pointer.
  const liveShape = c._decorList[0];
  const liveBefore = JSON.parse(JSON.stringify(liveShape));
  const liveSnapshot = c._geometrySnapshot();
  c._decorMove = {
    id: liveShape.id, start: [0, 0], orig: liveBefore, pid: 99,
    moved: true, before: liveSnapshot,
  };
  c._curSpaceCfg.decor = c._decorList.map((shape) => shape.id === liveShape.id
    ? { ...shape, x: (shape.x || 0) + 0.2 }
    : shape);
  c._setMode('view'); await c.updateComplete;
  const restoredLive = c._decorList.find((shape) => shape.id === liveShape.id);
  out.modeSwitchCancelsLiveDecor = !c._decorMove
    && JSON.stringify(restoredLive) === JSON.stringify(liveBefore);
  c._setMode('decor'); await c.updateComplete;
  // 6) erase удаляет
  const n0 = c._decorList.length;
  c._decorTool = 'erase';
  c._decorShapeDown({ stopPropagation() {}, preventDefault() {}, target: null, pointerId: 1 }, c._decorList[0]);
  out.eraseAsksConfirmation = c._decorList.length === n0 && !!c._decorEraseConfirm;
  c._confirmDecorErase();
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
await page.setViewportSize({ width: 560, height: 820 });
Object.assign(res, await page.evaluate(async () => {
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  c._setMode('decor');
  await c.updateComplete;
  const tools = sr().querySelector('.decorbar .editbar-tools');
  const end = sr().querySelector('.decorbar .editbar-end');
  const picker = sr().querySelector('.decorbar hp-color-opacity.decor-default-color');
  const trigger = picker?.shadowRoot?.querySelector('.trigger');
  const toolsRect = tools?.getBoundingClientRect();
  const endRect = end?.getBoundingClientRect();
  const themeStates = [];
  for (const darkMode of [false, true]) {
    c.hass = { ...c.hass, themes: { ...(c.hass.themes || {}), darkMode } };
    await c.updateComplete;
    const rect = trigger?.getBoundingClientRect();
    themeStates.push(!!rect && rect.width === 40 && rect.height === 40
      && getComputedStyle(trigger).visibility === 'visible');
  }
  trigger?.click();
  await picker?.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const popupRect = picker?.shadowRoot?.querySelector('.picker')?.getBoundingClientRect();
  const popupInside = !!popupRect && popupRect.left >= 0 && popupRect.top >= 0
    && popupRect.right <= innerWidth && popupRect.bottom <= innerHeight;
  trigger?.click();
  await picker?.updateComplete;
  return {
    narrowToolbarKeepsToolsAndCloseApart: !!toolsRect && !!endRect
      && toolsRect.right <= endRect.left + 0.5
      && sr().querySelectorAll('.decorbar .btn.dtool').length === 8
      && !!sr().querySelector('.decorbar .barclose'),
    narrowToolbarKeepsDefaultPickerUsable: !!picker && popupInside,
    defaultPickerReadableInLightAndDark: themeStates.every(Boolean),
  };
}));
// значение плашки зафиксировано числом: 12 клеток × cell_cm 5 = 0.60 m, 0°
checkAll(res, { lineBadgeText: '0.60 m · 0°' });
await finish(browser, res);
