// #369(д)(е): the armed furniture preview follows Shift without mouse motion,
// its window listeners come and go with the palette, and only the primary
// mouse button places objects — a right-click with an armed tool is a no-op.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const out = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const stageEl = () => sr().querySelector('.stage');
  const toScreen = (x, y) => {
    const r = stageEl().getBoundingClientRect();
    const v = c._viewOr(c._baseVb());
    return [r.left + ((x - v.x) / v.w) * r.width, r.top + ((y - v.y) / v.h) * r.width * (v.h / v.w) * (r.height / (r.width * (v.h / v.w)))];
  };
  // счётчики слушателей окна
  const addReal = window.addEventListener.bind(window);
  const removeReal = window.removeEventListener.bind(window);
  let shiftAdds = 0; let shiftRemoves = 0;
  window.addEventListener = (type, fn, opts) => {
    if (type === 'keydown' || type === 'keyup') shiftAdds++;
    return addReal(type, fn, opts);
  };
  window.removeEventListener = (type, fn, opts) => {
    if (type === 'keydown' || type === 'keyup') shiftRemoves++;
    return removeReal(type, fn, opts);
  };

  // в декор-режим, инструмент «мебель», выбрать символ
  await c._requestMode('decor', false);
  await c.updateComplete;
  c._editorSecondary.openPalette?.();
  c._decorTool = 'furniture';
  c._furnPalette = null; c._furnCategory = null;
  c.requestUpdate(); await c.updateComplete;
  const pal = () => sr().querySelector('.furnpalette');
  pal()?.querySelector('.furnitem[data-category="sofa"]')?.click();
  await c.updateComplete;
  pal()?.querySelector('.furnitem[data-symbol="sofa"]')?.click();
  await c.updateComplete;
  out.symbolArmed = !!c._furnPalette;
  out.listenersAttached = shiftAdds >= 2;

  // превью от движения мыши
  const stage = stageEl();
  const rect = stage.getBoundingClientRect();
  const cx = rect.left + rect.width * 0.5;
  const cy = rect.top + rect.height * 0.55;
  stage.dispatchEvent(new PointerEvent('pointermove', {
    bubbles: true, composed: true, pointerType: 'mouse', pointerId: 7,
    clientX: cx, clientY: cy,
  }));
  await c.updateComplete;
  out.previewVisible = !!c._furnPreviewInput;
  out.previewStartsSnapped = c._furnPreviewInput?.free === false;

  // (д): Shift БЕЗ движения мыши переводит превью в free и обратно
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', bubbles: true }));
  await c.updateComplete;
  out.shiftDownGoesFree = c._furnPreviewInput?.free === true;
  window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', bubbles: true }));
  await c.updateComplete;
  out.shiftUpBacksToSnap = c._furnPreviewInput?.free === false;

  // (е): правый клик с armed-символом НЕ ставит мебель
  const beforeCount = c._decorList.length;
  stage.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, composed: true, pointerType: 'mouse', pointerId: 8,
    clientX: cx, clientY: cy, button: 2, buttons: 2,
  }));
  await c.updateComplete; await sleep(50);
  out.rightClickPlacesNothing = c._decorList.length === beforeCount
    && !!c._furnPalette;

  // левый клик — ставит (регресс)
  stage.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, composed: true, pointerType: 'mouse', pointerId: 9,
    clientX: cx, clientY: cy, button: 0, buttons: 1,
  }));
  await c.updateComplete; await sleep(50);
  out.leftClickPlaces = c._decorList.length === beforeCount + 1;

  // (д): после установки палитра погашена — слушатели сняты симметрично
  out.paletteDisarmed = !c._furnPalette;
  out.listenersDetached = shiftRemoves >= 2 && shiftRemoves === shiftAdds;

  // Shift после снятия — не трогает ничего (превью нет)
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', bubbles: true }));
  out.shiftAfterDetachIsInert = !c._furnPreviewInput;
  window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', bubbles: true }));

  // r2-H1: Escape с armed-символом тоже снимает слушатели (путь мимо place)
  c._editorSecondary.openPalette?.();
  c._decorTool = 'furniture';
  c._furnPalette = null; c._furnCategory = null;
  c.requestUpdate(); await c.updateComplete;
  pal()?.querySelector('.furnitem[data-category="sofa"]')?.click();
  await c.updateComplete;
  pal()?.querySelector('.furnitem[data-symbol="sofa"]')?.click();
  await c.updateComplete;
  const addsBeforeEscape = shiftAdds;
  out.rearmAttachesAgain = shiftAdds === shiftRemoves + 2;
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  c._onKey?.(new KeyboardEvent('keydown', { key: 'Escape' }));
  await c.updateComplete;
  out.escapeClosesPalette = !c._furnPalette && c._decorTool === 'select';
  out.escapeDetachesListeners = shiftRemoves === addsBeforeEscape;

  // #400 AC1/AC2: на мелкой мебели угловая и осевая ручки перекрываются —
  // радиус хита один и тот же (1.8 % вида), и на объекте уже, чем 4·hr, круги
  // пересекаются. Побеждает нарисованный последним. Угол обязан быть сверху:
  // боком масштабируется одна ось, углом — обе, и мелкая мебель — как раз тот
  // случай, где пропорциональное изменение нужнее всего.
  //
  // Проверяется настоящим pointerdown в геометрический угол рамки:
  // elementFromPoint через shadow root тут бесполезен (возвращает саму
  // карточку), а какой обработчик сработал — видно только по вызову.
  const handleProbe = async (size) => {
    c._setMode('decor'); await c.updateComplete;
    c._decorTool = 'select';
    c._curSpaceCfg.decor = [{ id: 'probe', kind: 'furniture', symbol: 'fridge',
      x: 0.3, y: 0.3, w: size, h: size, angle: 0, color: '#ff00ff', opacity: 1, width_cm: 8 }];
    c._cfgEpoch++; c._decorSel = 'probe';
    c._editorRuntime?._syncDecorFrame?.();
    c.requestUpdate(); await c.updateComplete; await frame();
    const box = sr().querySelector('.dtframe');
    if (!box) return { frame: false };
    const handles = [...box.querySelectorAll('.dthandle')];
    const corner = handles.find((el) => !el.classList.contains('dtrot')
      && !el.classList.contains('dtedge'));
    if (!corner) return { frame: true, corner: false };
    const r = corner.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    // Кто получит событие в этой точке: считаем нажатия на каждой ручке.
    let hitEdge = 0; let hitCorner = 0;
    const mark = (el) => {
      const isEdge = el.classList.contains('dtedge');
      const listener = () => { if (isEdge) hitEdge++; else hitCorner++; };
      el.addEventListener('pointerdown', listener, true);
      return () => el.removeEventListener('pointerdown', listener, true);
    };
    const off = handles.filter((el) => !el.classList.contains('dtrot')).map(mark);
    const top = sr().elementsFromPoint
      ? sr().elementsFromPoint(cx, cy)
      : document.elementsFromPoint(cx, cy);
    const target = top.find((el) => el.classList && el.classList.contains('dthandle'));
    if (target) {
      target.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: cx, clientY: cy, pointerId: 91, isPrimary: true, button: 0,
        bubbles: true, composed: true, cancelable: true,
      }));
    }
    off.forEach((fn) => fn());
    c._dtDrag = null;
    return { frame: true, corner: true, hitCorner, hitEdge,
      targetIsCorner: !!target && !target.classList.contains('dtedge') };
  };
  const small = await handleProbe(0.04);   // 40 см на 10-метровом плане
  const big = await handleProbe(0.16);     // 160 см
  out.smallFurnitureCornerWinsTheHit = small.targetIsCorner === true && small.hitCorner === 1
    && small.hitEdge === 0;
  out.largeFurnitureKeepsBothHandles = big.targetIsCorner === true && big.hitCorner === 1
    && big.hitEdge === 0;
  out.handleProbeDiagnostics = { small, big };
  c._curSpaceCfg.decor = [];
  c._decorSel = null;
  c._setMode('background'); await c.updateComplete;

  window.addEventListener = addReal;
  window.removeEventListener = removeReal;
  // прибрать поставленный диван
  const sp = c._curSpaceCfg;
  sp.decor = sp.decor.slice(0, beforeCount);
  c._decorSel = null;
  c.requestUpdate(); await c.updateComplete;
  return out;
});
const { handleProbeDiagnostics, ...checks } = out;
checkAll(checks);
await finish(browser, out);
