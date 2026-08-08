/**
 * Regression: resize a shared wall whose middle is virtual and whose solid
 * remainders carry thickness. The live overlay, commit and Undo must move one
 * geometry transaction. Virtual drawing paints above the real wall body in
 * editors, but below it in View so thick-wall jambs mask the dash ends.
 */
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();

const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const sp = () => c._serverCfg.spaces.find((s) => s.id === c._space);
  const upd = async () => { c._cfgEpoch++; c.requestUpdate(); await c.updateComplete; };

  sp().settings = { ...(sp().settings || {}), show_borders: true };
  delete sp().walls;
  delete sp().open_spans;
  delete sp().openings;
  for (const r of sp().rooms || []) delete r.open_to;

  c._setMode('plan');
  c._tool = 'wallthick';
  await upd();
  c._wallThickClick([550, 250]);
  await upd();
  if (c._wallDialog) {
    c._wallDialog = { ...c._wallDialog, value: '20' };
    c._wallThickApply(false);
  }
  await upd();
  out.realBodyReady = !!sr().querySelector('.wallbodies');

  // The two-click rubber band used to be below .wallbodies and disappeared
  // exactly where it crossed the real T receiver.
  c._tool = 'boundary';
  c._boundaryClick([550, 200]);
  c._cursorPt = [550, 300];
  await upd();
  const bodyGroup = sr().querySelector('.wallbodies');
  const virtualGroup = sr().querySelector('.openwalls');
  out.virtualPreviewDrawn = !!sr().querySelector('.openwall-preview');
  out.virtualPreviewAboveReal = !!bodyGroup && !!virtualGroup
    && !!(bodyGroup.compareDocumentPosition(virtualGroup) & Node.DOCUMENT_POSITION_FOLLOWING);

  c._boundaryClick([550, 300]);
  c._cursorPt = null;
  await upd();
  out.partialSpanCreated = (sp().open_spans || []).length === 1;
  const editorBody = sr().querySelector('.wallbodies');
  const editorVirtual = sr().querySelector('.openwalls');
  out.savedVirtualAboveRealInEditor = !!editorBody && !!editorVirtual
    && !!(editorBody.compareDocumentPosition(editorVirtual) & Node.DOCUMENT_POSITION_FOLLOWING);
  c._setMode('view');
  await upd();
  const viewBody = sr().querySelector('.wallbodies');
  const viewVirtual = sr().querySelector('.openwalls');
  out.savedVirtualBelowRealInView = !!viewBody && !!viewVirtual
    && !!(viewVirtual.compareDocumentPosition(viewBody) & Node.DOCUMENT_POSITION_FOLLOWING);
  c._setMode('decor');
  await upd();
  const decorBody = sr().querySelector('.wallbodies');
  const decorVirtual = sr().querySelector('.openwalls');
  out.realWallsFadeBehindDecor = !!decorBody
    && getComputedStyle(decorBody).opacity === '0.35';
  out.virtualWallsFadeBehindDecor = !!decorVirtual
    && getComputedStyle(decorVirtual).opacity === '0.35';
  c._setMode('plan');
  await upd();
  out.atomicThicknessBefore = c._intervalCm([550, 145, 550, 195]) === 20
    && c._intervalCm([550, 205, 550, 295]) === 0
    && c._intervalCm([550, 305, 550, 455]) === 20;

  const before = JSON.stringify({
    rooms: sp().rooms,
    walls: sp().walls,
    open_spans: sp().open_spans,
  });
  c._tool = 'resize';
  await upd();
  const stage = () => sr().querySelector('.stage');
  const toScreen = (x, y) => {
    const r = stage().getBoundingClientRect();
    const v = c._viewOr(c._baseVb());
    return {
      clientX: r.left + ((x - v.x) / v.w) * r.width,
      clientY: r.top + ((y - v.y) / v.h) * r.height,
    };
  };
  const pev = (type, target, x, y) => {
    const { clientX, clientY } = toScreen(x, y);
    target.dispatchEvent(new PointerEvent(type, {
      bubbles: true, composed: true, cancelable: true,
      pointerId: 77, clientX, clientY, button: 0, isPrimary: true,
    }));
  };
  const handle = [...sr().querySelectorAll('.rszhandle:not(.rszcorner)')].find((h) => {
    const x = +h.getAttribute('cx'), y = +h.getAttribute('cy');
    return Math.abs(x - 550) < c._gridPitch * 2 && y > 140 && y < 460;
  });
  out.resizeHandleFound = !!handle;
  if (handle) {
    const x = +handle.getAttribute('cx');
    const y = +handle.getAttribute('cy');
    const step = c._gridPitch;
    pev('pointerdown', handle, x, y);
    pev('pointermove', handle, x + step, y);
    await c.updateComplete;
    const liveCut = c._openCuts()[0];
    const liveX = liveCut?.[0];
    out.liveSpanMoves = Number.isFinite(liveX) && Math.abs(liveX - (550 + step)) < 0.1;
    out.liveThicknessStays = c._intervalCm([liveX, 145, liveX, 195]) === 20
      && c._intervalCm([liveX, 205, liveX, 295]) === 0
      && c._intervalCm([liveX, 305, liveX, 455]) === 20;
    out.liveBodyStays = !!sr().querySelector('.wallbodies');

    pev('pointerup', handle, x + step, y);
    await upd();
    const finalCut = c._openCuts()[0];
    const finalX = finalCut?.[0];
    out.commitSpanMoves = Number.isFinite(finalX) && Math.abs(finalX - (550 + step)) < 0.1;
    out.commitThicknessStays = c._intervalCm([finalX, 145, finalX, 195]) === 20
      && c._intervalCm([finalX, 205, finalX, 295]) === 0
      && c._intervalCm([finalX, 305, finalX, 455]) === 20;
    out.commitKeepsAtomicKeys = (sp().walls || []).filter((w) => w.cm === 20).length >= 2;

    c._undoGeometry();
    await upd();
    out.undoRestoresAll = JSON.stringify({
      rooms: sp().rooms,
      walls: sp().walls,
      open_spans: sp().open_spans,
    }) === before;
  }

  // Canonical storage: legacy/transactional fragments on one room pair become
  // one selectable span, and closing it restores the uniformly thick parent
  // wall instead of leaving atomic debris in `walls`.
  const restoredCut = c._openCuts()[0];
  if (restoredCut) {
    const mx = (restoredCut[0] + restoredCut[2]) / 2;
    const my = (restoredCut[1] + restoredCut[3]) / 2;
    c._persistOpenCuts([
      [restoredCut[0], restoredCut[1], mx, my],
      [mx, my, restoredCut[2], restoredCut[3]],
    ]);
    await upd();
    out.adjacentSpansPersistAsOne = (sp().open_spans || []).length === 1
      && c._openCuts().length === 1;
    c._closeOpenSpan(c._openCuts()[0]);
    await upd();
    out.closeRejoinsUniformWall = !sp().open_spans
      && (sp().walls || []).length === 1
      && c._intervalCm(restoredCut) === 20;
  } else {
    out.adjacentSpansPersistAsOne = false;
    out.closeRejoinsUniformWall = false;
  }

  // The screenshot topology: the two real arms belong to different room
  // contours and only meet at the endpoint of B↔C's virtual boundary. Their
  // per-room butt caps must be completed into one clean outer mitre.
  sp().rooms = [
    { id: 'ta', name: 'A', poly: [[0.1, 0.1], [0.5, 0.1], [0.5, 0.5], [0.1, 0.5]] },
    { id: 'tb', name: 'B', poly: [[0.5, 0.5], [0.9, 0.5], [0.9, 0.9], [0.5, 0.9]] },
    { id: 'tc', name: 'C', poly: [[0.5, 0.1], [0.9, 0.1], [0.9, 0.5], [0.5, 0.5]] },
  ];
  delete sp().walls;
  delete sp().open_spans;
  c._tool = 'wallthick';
  await upd();
  for (const p of [[300, 500], [500, 700]]) {
    c._wallThickClick(p);
    await upd();
    if (c._wallDialog) {
      c._wallDialog = { ...c._wallDialog, value: '20' };
      c._wallThickApply(false);
      await upd();
    }
  }
  sp().open_spans = [{ a: [0.5, 0.5], b: [0.9, 0.5] }];
  sp().rooms.find((r) => r.id === 'tb').open_to = ['tc'];
  sp().rooms.find((r) => r.id === 'tc').open_to = ['tb'];
  await upd();
  const tPath = sr().querySelector('.wallbody')?.getAttribute('d') || '';
  const values = (tPath.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  const half = (20 / c._cellCm) * c._gridPitch / 2;
  out.virtualTJunctionMitred = values.some((x, i) => i % 2 === 0
    && Math.abs(x - (500 + half)) < 1e-6
    && Math.abs(values[i + 1] - (500 - half)) < 1e-6);
  return out;
});

checkAll(res);
await finish(browser, res);
