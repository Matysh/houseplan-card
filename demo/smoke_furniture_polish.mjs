// #369(д)(е): the armed furniture preview follows Shift without mouse motion,
// its window listeners come and go with the palette, and only the primary
// mouse button places objects — a right-click with an armed tool is a no-op.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const out = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
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

  window.addEventListener = addReal;
  window.removeEventListener = removeReal;
  // прибрать поставленный диван
  const sp = c._curSpaceCfg;
  sp.decor = sp.decor.slice(0, beforeCount);
  c._decorSel = null;
  c.requestUpdate(); await c.updateComplete;
  return out;
});
checkAll(out);
await finish(browser, out);
