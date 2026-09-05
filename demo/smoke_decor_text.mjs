// Текстовый блок декора (правки владельца 2026-08-04):
//   1) выбора размера шрифта БОЛЬШЕ НЕТ — размер задаётся углами блока и
//      после явной правки хранится физически в `size_cm`; старый `size`
//      до этого продолжает читаться без визуальной миграции;
//   2) многострочный текст: перевод строки сохраняется и рисуется, блок
//      выравнивается по центру;
//   3) у выделенного блока есть угловые ручки (масштаб) и ручка поворота
//      (шаг 5°, Shift — мимо шага); ВИДИМЫЙ размер ручки — четверть хит-зоны
//      (правка владельца 2026-08-05 «уменьшить в 4 раза»), сама хит-зона
//      прежняя, пальцевая: 1.8 % видимого вида;
//   4) при инструменте «текст» клик по УЖЕ РАЗМЕЩЁННОЙ надписи открывает её
//      форму, а не создаёт новую; по пустому месту и по НЕтекстовой фигуре —
//      создаёт новую (нетекстовые фигуры остаются инертными, см. smoke_decor).
// ПАДАЕТ на сборке до этих правок: в диалоге ещё радиокнопки размера, перевод
// строки схлопывается в одну строку, ручек нет, а «текст» по надписи создаёт
// вторую надпись поверх первой.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const settleMode = async () => {
    const started = performance.now();
    do { await new Promise((resolve) => requestAnimationFrame(resolve)); }
    while (c._modeTransitionBusy && performance.now() - started < 1500);
    await c.updateComplete;
  };
  const settleLive = () => c._editorRuntime?._whenLiveEditorSettled() ?? c.updateComplete;
  // null-safe: на сборке ДО этих правок у надписи нет ни data-id, ни tspan —
  // смок должен показать список провалов, а не упасть с исключением
  const el = (id) => sr().querySelector(`[data-hp-live-editor] .decorlayer text.dtext[data-id="${id}"]`)
    || sr().querySelector(`.decorlayer text.dtext[data-id="${id}"]`);
  const attr = (id, name) => { const e = el(id); return e ? e.getAttribute(name) : null; };
  const tspans = (id) => { const e = el(id); return e ? [...e.querySelectorAll('tspan')] : []; };
  const stageEl = () => sr().querySelector('.stage');
  /** открыть форму существующей надписи (на старой сборке — двойным щелчком) */
  const open = (sh) => (c._decorOpenText ? c._decorOpenText(sh) : c._decorShapeDbl(sh));
  const toScreen = (x, y) => {
    const r = stageEl().getBoundingClientRect();
    const v = c._viewOr(c._baseVb());
    return { clientX: r.left + ((x - v.x) / v.w) * r.width,
      clientY: r.top + ((y - v.y) / v.h) * r.height };
  };
  const ev = (type, target, x, y, extra = {}) => {
    const { clientX, clientY } = toScreen(x, y);
    target.dispatchEvent(new PointerEvent(type, { bubbles: true, composed: true,
      cancelable: true, pointerId: 7, clientX, clientY, button: 0, isPrimary: true, ...extra }));
  };

  sr().querySelectorAll('.modetab')[2].click(); await settleMode();
  c._curSpaceCfg.decor = [];
  c._decorTool = 'select'; c._decorSel = null; await c.updateComplete;

  // ================= 1. размера шрифта в диалоге больше нет ================
  c._decorTool = 'text';
  c._decorTextDialog = { x: 0.3, y: 0.3, text: '', color: '#223344' };
  await c.updateComplete;
  out.noSizePicker = !sr().querySelector('input[name="dtsize"]');
  out.textareaNotInput = !!sr().querySelector('hp-dialog textarea.dtarea');
  c._decorTextDialog = null; await c.updateComplete;

  // старый `size` продолжает рисоваться ровно как раньше: 'l' = 30px
  c._curSpaceCfg.decor = [
    { id: 'dtl', kind: 'text', x: 0.25, y: 0.25, text: 'Старый', size: 'l', color: '#223344' },
    { id: 'dts', kind: 'text', x: 0.25, y: 0.4, text: 'Мелкий', size: 's', color: '#223344' },
    { id: 'dtm', kind: 'text', x: 0.25, y: 0.55, text: 'Обычный', color: '#223344' },
  ];
  c._cfgEpoch++; c.requestUpdate(); await c.updateComplete;
  out.legacyLarge = +attr('dtl', 'font-size') === 30;
  out.legacySmall = +attr('dts', 'font-size') === 14;
  out.noSizeIsMedium = +attr('dtm', 'font-size') === 20;

  // ================= 2. многострочный текст, по центру =====================
  c._decorTool = 'text';
  c._decorTextDialog = { x: 0.5, y: 0.5, text: '  Гараж\nпод ключ  ', color: '#223344' };
  c._decorSaveText(); await c.updateComplete;
  const multi = c._decorList.find((x) => x.text && x.text.includes('\n'));
  out.newlineStored = !!multi && multi.text === 'Гараж\nпод ключ'; // края обрезаны, середина цела
  const tsp = tspans(multi.id);
  out.twoLinesRendered = tsp.length === 2
    && tsp[0].textContent === 'Гараж' && tsp[1].textContent === 'под ключ';
  out.linesCentredHorizontally = tsp.length === 2 && !!el(multi.id)
    && getComputedStyle(el(multi.id)).textAnchor === 'middle'
    && tsp[0].getAttribute('x') === tsp[1].getAttribute('x');
  // блок центрирован и по вертикали: якорь ровно между строками
  const ay = multi.y * 1000;
  const y0 = tsp[0] ? +tsp[0].getAttribute('y') : NaN;
  const y1 = tsp[1] ? +tsp[1].getAttribute('y') : NaN;
  out.blockCentredVertically = Math.abs((y0 + y1) / 2 - ay) < 0.01 && y1 > y0;
  // длинная строка НЕ переносится сама (docs/LIVE-TEXT.md: никаких автопереносов)
  open(multi); await c.updateComplete;
  c._decorTextDialog = { ...c._decorTextDialog, text: 'x'.repeat(120) };
  c._decorSaveText(); await c.updateComplete;
  out.noAutoWrap = tspans(multi.id).length === 1;
  open(c._decorList.find((x) => x.id === multi.id)); await c.updateComplete;
  c._decorTextDialog = { ...c._decorTextDialog, text: 'Гараж\nпод ключ' };
  c._decorSaveText(); await c.updateComplete;

  // ================= 3. ручки масштаба и поворота ==========================
  c._decorTool = 'select'; c._decorSel = null; await c.updateComplete;
  out.noFrameWithoutSelection = !sr().querySelector('.dtframe');
  c._decorSel = 'dtm'; c.requestUpdate();
  await c.updateComplete; await sleep(60); await c.updateComplete;
  const frame = () => sr().querySelector('[data-hp-live-editor] .dtframe') || sr().querySelector('.dtframe');
  out.frameOnSelection = !!frame();
  out.fourCornersAndRotate = !!frame()
    && frame().querySelectorAll('.dthandle').length === 5
    && !!frame().querySelector('.dtrot');

  // --- визуал в 4 раза меньше, хит-зона прежняя (docs/LIVE-TEXT.md §3) ---
  out.fiveVisibleKnobs = frame()?.querySelectorAll('.dtknob').length === 5;
  const rOf = (sel) => { const e = frame()?.querySelector(sel); return e ? +e.getAttribute('r') : NaN; };
  const hitR = rOf('.dthandle.dtrot');
  const knobR = rOf('.dtknob');
  const vw = c._viewOr(c._baseVb());
  const expectHit = Math.max(vw.w, vw.h) * 0.018;
  out.hitRadiusUnchanged = Math.abs(hitR - expectHit) < 0.1;       // прежние 1.8 %
  out.knobIsAQuarterOfTheHit = Math.abs(knobR * 4 - hitR) / Math.max(hitR, 1e-9) < 0.05;
  out.knobTakesNoPointer = getComputedStyle(frame().querySelector('.dtknob')).pointerEvents === 'none';
  out.handleTakesThePointer = getComputedStyle(frame().querySelector('.dthandle')).pointerEvents !== 'none';
  // …и палец, попавший МИМО бусины, но внутрь прежнего круга, всё ещё берёт ручку
  const rotEl = frame().querySelector('.dtrot');
  const rcx = +rotEl.getAttribute('cx'), rcy = +rotEl.getAttribute('cy');
  const far = toScreen(rcx + hitR * 0.7, rcy);                     // > knobR, < hitR
  const hitEl = sr().elementFromPoint(far.clientX, far.clientY);
  out.fingerZoneStillCatchesTheHandle = !!hitEl?.classList?.contains?.('dthandle');
  // линия использует общую рамку, но только с двумя ручками концов
  c._curSpaceCfg.decor = [...c._decorList, { id: 'dline', kind: 'line',
    x1: 0.1, y1: 0.8, x2: 0.4, y2: 0.8, color: '#000000', width: 3 }];
  c._cfgEpoch++; c._decorSel = 'dline'; c.requestUpdate();
  await c.updateComplete; await sleep(40); await c.updateComplete;
  const lineFrame = sr().querySelector('.dtframe.dtlineframe');
  out.lineGetsEndpointFrame = !!lineFrame
    && lineFrame.querySelectorAll('.dthandle.dtendpoint').length === 2
    && !lineFrame.querySelector('.dtrot');
  c._decorSel = 'dtm'; c.requestUpdate();
  await c.updateComplete; await sleep(60); await c.updateComplete;

  // тянем угол: физический размер растёт пропорционально расстоянию от якоря
  const anchor = () => {
    const sh = c._decorList.find((x) => x.id === 'dtm');
    return [sh.x * 1000, sh.y * 1000];
  };
  const [ax, ay2] = anchor();
  const mediumSizeCm0 = c._decorTextSizeCm(c._decorList.find((x) => x.id === 'dtm'));
  const corner = frame()?.querySelector('.dthandle.dt-nwse') || stageEl();
  ev('pointerdown', corner, ax + 40, ay2);
  out.dragStarted = !!c._dtDrag && c._dtDrag.kind === 'scale';
  ev('pointermove', stageEl(), ax + 80, ay2);
  await settleLive();
  const scaled = c._decorList.find((x) => x.id === 'dtm');
  out.cornerStoresPhysicalSize = scaled.scale === undefined && scaled.size === undefined
    && Math.abs((scaled.size_cm || 0) - mediumSizeCm0 * 2) < 0.01;
  out.fontFollowsScale = +attr('dtm', 'font-size') === 40;
  ev('pointerup', stageEl(), ax + 80, ay2);
  out.dragEnded = !c._dtDrag;

  // старый `size` становится физическим `size_cm` только после явной правки
  c._decorSel = 'dtl'; c.requestUpdate();
  await c.updateComplete; await sleep(60); await c.updateComplete;
  const [lx, ly] = [c._decorList.find((x) => x.id === 'dtl').x * 1000,
    c._decorList.find((x) => x.id === 'dtl').y * 1000];
  const legacySizeCm0 = c._decorTextSizeCm(c._decorList.find((x) => x.id === 'dtl'));
  ev('pointerdown', frame()?.querySelector('.dthandle.dt-nwse') || stageEl(), lx + 50, ly);
  ev('pointermove', stageEl(), lx + 100, ly);
  await c.updateComplete;
  const grown = c._decorList.find((x) => x.id === 'dtl');
  out.legacySizeBecomesPhysical = grown.size === undefined && grown.scale === undefined
    && Math.abs((grown.size_cm || 0) - legacySizeCm0 * 2) < 0.01;
  ev('pointerup', stageEl(), lx + 100, ly);

  // ручка поворота: шаг 5°, Shift — мимо шага
  c._decorSel = 'dtm'; c.requestUpdate();
  await c.updateComplete; await sleep(60); await c.updateComplete;
  const [rx, ry] = anchor();
  const rot = frame()?.querySelector('.dthandle.dtrot') || stageEl();
  ev('pointerdown', rot, rx + 100, ry);
  out.rotateStarted = c._dtDrag?.kind === 'rotate';
  ev('pointermove', stageEl(), rx + 100, ry + 100);   // ровно 45°
  await c.updateComplete;
  out.rotates = Math.abs((c._decorList.find((x) => x.id === 'dtm').angle || 0) - 45) < 1e-6;
  ev('pointermove', stageEl(), rx + 100, ry + 2);     // ~1.1° → прилипает к 0
  await c.updateComplete;
  out.snapsTo5 = (c._decorList.find((x) => x.id === 'dtm').angle || 0) === 0;
  ev('pointermove', stageEl(), rx + 100, ry + 2, { shiftKey: true });
  await c.updateComplete;
  const free = c._decorList.find((x) => x.id === 'dtm').angle;
  out.shiftGoesFree = free > 0.5 && free < 5;   // тот же жест, но точный угол
  ev('pointerup', stageEl(), rx + 100, ry + 2);
  await c.updateComplete;
  out.rotationRendered = /rotate\(/.test(attr('dtm', 'transform') || '');
  // …а без Shift тот же 1.1° снова прилипает к нулю
  // повернули обратно в ноль — поле исчезает, фигура снова «прямая»
  ev('pointerdown', frame()?.querySelector('.dthandle.dtrot') || stageEl(), rx + 100, ry);
  ev('pointermove', stageEl(), rx + 100, ry);
  ev('pointerup', stageEl(), rx + 100, ry);
  await c.updateComplete;
  out.zeroAngleDropped = c._decorList.find((x) => x.id === 'dtm').angle === undefined;

  // ================= 4. инструмент «текст» по надписи = редактировать =======
  c._decorTool = 'text'; c._decorSel = null; c._decorTextDialog = null;
  await c.updateComplete;
  const before = c._decorList.length;
  const target = c._decorList.find((x) => x.id === 'dtm');
  out.labelIsLiveUnderTextTool = !!el('dtm') && getComputedStyle(el('dtm')).pointerEvents !== 'none';
  out.chromiumTextUsesAtomicBoundingBox = getComputedStyle(el('dtm')).pointerEvents === 'bounding-box';
  ev('pointerdown', el('dtm') || stageEl(), target.x * 1000, target.y * 1000);
  await c.updateComplete;
  out.textToolEditsTheLabel = c._decorTextDialog?.id === 'dtm'
    && c._decorTextDialog.text === target.text;
  out.textToolMakesNoSecondLabel = c._decorList.length === before;
  out.textToolDoesNotSelect = c._decorSel === null;
  c._decorTextDialog = null; await c.updateComplete;

  // по пустому месту — новая надпись
  ev('pointerdown', stageEl(), 60, 940);
  await c.updateComplete;
  out.textToolOnEmptyCreates = !!c._decorTextDialog && !c._decorTextDialog.id;
  c._decorTextDialog = null; await c.updateComplete;

  // по НЕтекстовой фигуре — тоже новая надпись: она осталась инертной
  const lineEl = sr().querySelector('.decorlayer line.dshape');
  out.lineStillInert = getComputedStyle(lineEl).pointerEvents === 'none';
  ev('pointerdown', lineEl, 250, 800);
  await c.updateComplete;
  out.textToolOnAShapeCreates = !!c._decorTextDialog && !c._decorTextDialog.id
    && c._decorSel === null;
  c._decorTextDialog = null;
  return out;
});
checkAll(res);
await finish(browser, res);
