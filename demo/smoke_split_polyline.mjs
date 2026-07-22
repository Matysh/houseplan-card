import { launch } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const stage = () => sr().querySelector('.stage');
  c._setMode('plan'); await c.updateComplete;
  // 1) курсоры: split до выбора комнаты — pointer, после — crosshair; merge — pointer
  c._tool = 'split'; c.requestUpdate(); await c.updateComplete;
  out.splitPickCursor = getComputedStyle(stage()).cursor === 'pointer';
  const rooms = c._spaceModel().rooms;
  const room = rooms.find((r) => r.id === 'r1');
  const center = c._roomCenter(room);
  c._splitClick(center); await c.updateComplete;
  out.roomPicked = c._splitSel?.roomId === 'r1';
  out.splitCutCursor = getComputedStyle(stage()).cursor === 'crosshair';
  c._tool = 'merge'; c._splitSel = null; c.requestUpdate(); await c.updateComplete;
  out.mergeCursor = getComputedStyle(stage()).cursor === 'pointer';
  // 2) полилинейный разрез: r1 = прямоугольник? возьмём его poly и построим Г-разрез
  c._tool = 'split'; await c.updateComplete;
  c._splitClick(center);
  const poly = (() => { const r = rooms.find((x) => x.id === 'r1');
    return r.poly ? r.poly : [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]]; })();
  // старт на середине верхней стены, промежуточная внутри, конец на правой стене
  const [A, B, C2, D] = [poly[0], poly[1], poly[2], poly[3]];
  const top = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
  const right = [(B[0] + C2[0]) / 2, (B[1] + C2[1]) / 2];
  const mid = [(top[0] + right[0]) / 2 - 20, (top[1] + right[1]) / 2 + 20];
  c._splitClick(top);
  out.firstOnWall = c._splitSel?.pts.length === 1;
  c._splitClick(mid);
  out.midAdded = c._splitSel?.pts.length === 2;
  c._splitClick(right);
  out.dialogAfterCut = !!c._pendingSplit && c._roomDialog;
  out.partsPolys = c._pendingSplit ? [c._pendingSplit.mainPoly.length, c._pendingSplit.newPoly.length] : null;
  // отмена — комната целая
  c._roomDialogCancel(); await c.updateComplete;
  out.cancelKeepsRoom = !c._pendingSplit && rooms.length === c._spaceModel().rooms.length;
  // 3) Esc: пошаговый выход
  const esc = async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await c.updateComplete; };
  c._tool = 'split'; c._splitSel = null;
  c._splitClick(center); c._splitClick(top); c._splitClick(mid); await c.updateComplete;
  await esc(); out.escDropsPoint = c._splitSel?.pts.length === 1;
  await esc(); out.escDropsFirst = c._splitSel?.pts.length === 0;
  await esc(); out.escDropsRoom = c._splitSel === null && c._tool === 'split';
  await esc(); out.escExitsTool = c._tool === 'draw';
  // merge: выбор → Esc снимает, ещё Esc — выход
  c._tool = 'merge'; c._mergeSel = 'r1'; await c.updateComplete;
  await esc(); out.escClearsMerge = c._mergeSel === null && c._tool === 'merge';
  await esc(); out.escExitsMerge = c._tool === 'draw';
  return out;
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
