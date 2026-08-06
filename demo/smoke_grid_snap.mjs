// «Всё строго по сетке» (docs/CANVAS.md §9). Two halves:
//   1. every element placed or dragged by hand lands on a node — devices, room
//      labels, decor, room vertices, resize handles; an opening lands ON ITS
//      WALL at a whole number of steps along it; Shift is the only way out;
//   2. the explicit «Оптимизировать планы» action moves a deliberately
//      detuned plan onto the grid through one atomic config+layout commit,
//      tells the truth about how much it moves, and is idempotent.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 900, height: 820 }, 1);

const out = await page.evaluate(async () => {
  const o = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const NORM_W = 1000, GRID_N = 240;
  const PITCH = NORM_W / GRID_N;
  const onGridN = (v) => Math.abs(v * GRID_N - Math.round(v * GRID_N)) < 1e-9;
  const onGridR = (v) => Math.abs(v / PITCH - Math.round(v / PITCH)) < 1e-7;

  /** A click/pointer event at a given RENDER-unit point of the current view. */
  const at = (X, Y, type = 'pointermove', extra = {}) => {
    const rect = sr().querySelector('.stage').getBoundingClientRect();
    const v = c._viewOr(c._baseVb());
    return new PointerEvent(type, {
      clientX: rect.left + ((X - v.x) / v.w) * rect.width,
      clientY: rect.top + ((Y - v.y) / v.h) * rect.height, bubbles: true, ...extra,
    });
  };
  // an off-grid target: a third of a step past a node, in both axes
  const OFF = PITCH / 3;

  // ---- 1a) the snap itself, the one gate every gesture goes through -----
  const s1 = c._snap([100 + OFF, 200 + OFF]);
  o.snapRoundsToTheNode = onGridR(s1[0]) && onGridR(s1[1]);
  const s2 = c._snap([100 + OFF, 200 + OFF], { shiftKey: true });
  o.shiftSuspendsTheSnap = !onGridR(s2[0]);
  o.snapAlsoClampsTheGarbage = c._snap([1e12, -1e12])[0] === 5000 * NORM_W;
  // the step is NORM_W/GRID_N and nothing else — it did NOT change with the
  // infinite canvas, so no plan's nodes ever moved out from under it
  o.pitchIsTheCanvasFreeConstant = Math.abs(c._gridPitch - PITCH) < 1e-12;

  // ---- 1b) a DEVICE dropped with the mouse lands on a node --------------
  c._setMode('devices'); await c.updateComplete;
  const dev = c._devices.find((d) => !d.virtual);
  const p0 = c._pos(dev);
  const mkDelta = (dxu, dyu, extra = {}) => {
    const rect = sr().querySelector('.stage').getBoundingClientRect();
    const v = c._viewOr(c._baseVb());
    return new PointerEvent('pointermove', {
      clientX: 400 + (dxu / v.w) * rect.width, clientY: 400 + (dyu / v.h) * rect.height,
      bubbles: true, ...extra,
    });
  };
  c._drag = { id: dev.id, sx: 400, sy: 400, ox: p0.x, oy: p0.y, moved: false };
  c._pointerMove(mkDelta(137.7 - p0.x + OFF, 251.3 - p0.y + OFF), dev);
  c._drag = null;
  o.deviceLandsOnANode = onGridN(c._layout[dev.id].x) && onGridN(c._layout[dev.id].y);

  // ---- 1c) a ROOM LABEL too ---------------------------------------------
  c._setMode('plan'); await c.updateComplete;
  const room = c._spaceModel(c._space).rooms.find((r) => r.name);
  const lp = c._labelPos(room, c._space);
  c._drag = { id: 'rl_' + room.id, sx: 400, sy: 400, ox: lp.x, oy: lp.y, moved: false };
  c._labelMove(mkDelta(311.4 - lp.x + OFF, 402.9 - lp.y + OFF), room, c._space);
  c._drag = null;
  o.roomLabelLandsOnANode = onGridN(c._layout['rl_' + room.id].x)
    && onGridN(c._layout['rl_' + room.id].y);
  // …and one that has never been dragged is on a node as well
  const other = c._spaceModel(c._space).rooms.find((r) => r.name && r.id !== room.id);
  const op = c._labelPos(other, c._space);
  o.untouchedLabelIsOnANode = onGridR(op.x) && onGridR(op.y);

  // ---- 1d) DECOR: draft, text anchor, and a move ------------------------
  c._setMode('decor'); await c.updateComplete;
  c._decorTool = 'rect';
  // dispatched for real, so the handler sees a target (it looks for .dshape)
  sr().querySelector('.stage').dispatchEvent(at(300 + OFF, 300 + OFF, 'pointerdown', { pointerId: 21 }));
  o.decorDraftStartsOnANode = onGridR(c._decorDraft.a[0]) && onGridR(c._decorDraft.a[1]);
  c._decorDraft = { ...c._decorDraft, b: c._snap([420 + OFF, 380 + OFF]) };
  c._decorCommitDraft(); await c.updateComplete;
  const dsh = c._decorList[c._decorList.length - 1];
  o.decorShapeIsOnNodes = onGridN(dsh.x) && onGridN(dsh.y)
    && onGridN(dsh.x + dsh.w) && onGridN(dsh.y + dsh.h);
  c._decorTool = 'text';
  sr().querySelector('.stage').dispatchEvent(at(500 + OFF, 500 + OFF, 'pointerdown', { pointerId: 22 }));
  o.decorTextAnchorIsOnANode = onGridN(c._decorTextDialog.x) && onGridN(c._decorTextDialog.y);
  c._decorTextDialog = null;
  // a shape that is ALREADY off the grid is put on it by one drag: the mover
  // snaps the resulting anchor, not the delta (which used to preserve the drift)
  const sp = c._curSpaceCfg;
  sp.decor = [...c._decorList, { id: 'dcOff', kind: 'rect',
    x: 0.3013, y: 0.4017, w: 0.1, h: 0.05, color: '#889', width: 2 }];
  c.requestUpdate(); await c.updateComplete;
  const off = c._decorList.find((x) => x.id === 'dcOff');
  c._decorMove = { id: 'dcOff', start: c._svgPoint(at(301.3, 401.7)),
    orig: JSON.parse(JSON.stringify(off)), pid: 9, moved: false };
  c._decorMoveUpdate(at(351.3, 451.7));
  await c.updateComplete;
  const off2 = c._decorList.find((x) => x.id === 'dcOff');
  o.oneDragPutsADriftedShapeOnTheGrid = onGridN(off2.x) && onGridN(off2.y);
  c._decorMove = null;
  sp.decor = sp.decor.filter((x) => x.id !== 'dcOff' && x.id !== dsh.id);

  // ---- 1e) an OPENING is WALL-bound: on its wall, whole steps along it ---
  c._setMode('plan'); await c.updateComplete;
  c._tool = 'opening';
  const spm = c._spaceModel(c._space);
  const wall = (() => {
    for (const r of spm.rooms) {
      const poly = r.poly || null;
      if (!poly) continue;
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        if (Math.hypot(b[0] - a[0], b[1] - a[1]) > PITCH * 20) return [a, b];
      }
    }
    return null;
  })();
  o.foundAWallToTestWith = !!wall;
  if (wall) {
    const [a, b] = wall;
    const mid = [(a[0] + b[0]) / 2 + 0.37 * PITCH, (a[1] + b[1]) / 2 + 0.4];
    c._openingClick(mid);
    const d = c._openingDialog;
    o.openingPlaced = !!d;
    if (d) {
      // exactly on the wall segment…
      const t = ((d.x - a[0]) * (b[0] - a[0]) + (d.y - a[1]) * (b[1] - a[1]))
        / ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2);
      const px = a[0] + t * (b[0] - a[0]), py = a[1] + t * (b[1] - a[1]);
      o.openingSitsOnItsWall = Math.hypot(d.x - px, d.y - py) < 1e-6;
      // …and at a whole number of steps along it (or at the wall's own centre,
      // which is what the magnet is for and what the ruler shows)
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const along = t * len;
      o.openingIsQuantisedAlongTheWall =
        Math.abs(along / PITCH - Math.round(along / PITCH)) < 1e-6
        || Math.abs(along - len / 2) < 1e-6;
    }
    c._openingDialog = null;
  }

  // ---- 1f) a room VERTEX drawn by hand ----------------------------------
  c._tool = 'draw'; c._path = [];
  c._markupClick(at(220 + OFF, 220 + OFF, 'click'));
  o.roomVertexOnANode = c._path.length === 1 && onGridR(c._path[0][0]) && onGridR(c._path[0][1]);
  c._path = []; c._tool = 'draw';

  // ---- 2) «Оптимизировать планы» -----------------------------------------
  c._setMode('view'); await c.updateComplete;
  // a deliberately detuned fixture: a third of a step off, everywhere
  const D = 1 / GRID_N / 3;
  const FIX = { spaces: [{
    id: 'g1', title: 'Grid test', view_box: [0, 0, 1, 1],
    rooms: [
      { id: 'r1', name: 'A', area: 'living_room',
        poly: [[0.2 + D, 0.2], [0.5, 0.2 - D], [0.5 + D, 0.5], [0.2, 0.5]] },
      { id: 'r2', name: 'B', area: 'kitchen', x: 0.5, y: 0.2, w: 0.3 + D, h: 0.3 },
    ],
    openings: [{ id: 'o1', type: 'window', x: 0.3 + D, y: 0.2 + D / 2, angle: 0, length: 0.06 }],
    decor: [{ id: 'd1', kind: 'line', x1: 0.1 + D, y1: 0.7, x2: 0.9, y2: 0.7 - D }],
  }], markers: [], settings: {} };
  const FIXLAY = { d_light1: { s: 'g1', x: 0.3 + D, y: 0.3 }, rl_r1: { s: 'g1', x: 0.25 + D, y: 0.25 } };
  c._serverCfg = JSON.parse(JSON.stringify(FIX));
  c._layout = JSON.parse(JSON.stringify(FIXLAY));
  c._modelCache = null; c._frame = null; c._space = 'g1';
  c.requestUpdate(); await c.updateComplete;

  c._openAlignDialog();
  await c.updateComplete;
  const dlg = c._alignDialog;
  o.alignDialogOpens = !!dlg && !!sr().querySelector('.dialogwrap .alignmsg');
  o.alignCountsWhatMoves = !!dlg && dlg.report.moved > 0 && dlg.report.moved <= dlg.report.total;
  // half a step of 5 cm cells ≈ 2.5 cm; a third of a step is well under that
  o.alignPromisesASmallShift = !!dlg && dlg.cm > 0 && dlg.cm < 3;
  o.alignExplainsSafeUndo = (sr().querySelector('.dialogwrap .rhint')?.textContent || '').length > 20;

  // capture what the network is told, then run it
  const sent = [];
  const base = c.hass.callWS;
  c.hass = { ...c.hass, callWS: async (m) => { sent.push(m.type); return base(m); } };
  await c._runAlignToGrid();
  await c.updateComplete;
  o.alignDialogClosed = c._alignDialog === null;
  o.alignUsedAtomicConfigLayoutWrite = sent.filter((t) => t === 'houseplan/plan/optimize').length === 1;

  const g = c._serverCfg.spaces[0];
  o.alignedRoomPoly = g.rooms[0].poly.every((p) => onGridN(p[0]) && onGridN(p[1]));
  o.alignedRoomRect = onGridN(g.rooms[1].x) && onGridN(g.rooms[1].x + g.rooms[1].w);
  o.alignedDecor = onGridN(g.decor[0].x1) && onGridN(g.decor[0].y1)
    && onGridN(g.decor[0].x2) && onGridN(g.decor[0].y2);
  o.alignedLayout = onGridN(c._layout.d_light1.x) && onGridN(c._layout.rl_r1.x);
  // the opening stayed ON the top wall of r1 rather than being rounded off it
  const w0 = g.rooms[0].poly[0], w1 = g.rooms[0].poly[1];
  const tt = ((g.openings[0].x - w0[0]) * (w1[0] - w0[0]) + (g.openings[0].y - w0[1]) * (w1[1] - w0[1]))
    / ((w1[0] - w0[0]) ** 2 + (w1[1] - w0[1]) ** 2);
  o.alignedOpeningStaysOnItsWall = Math.hypot(
    g.openings[0].x - (w0[0] + tt * (w1[0] - w0[0])),
    g.openings[0].y - (w0[1] + tt * (w1[1] - w0[1]))) < 1e-9;

  // ---- 2b) …and the second run has nothing to do ------------------------
  c._openAlignDialog();
  await c.updateComplete;
  o.secondRunMovesNothing = c._alignDialog.report.moved === 0;
  o.secondRunOffersNoButton = !sr().querySelector('.dialogwrap .btn.on');
  c._alignDialog = null;
  await c.updateComplete;

  // ---- 2c) the promise is an UPPER BOUND, in EACH space's own scale -----
  // AUD-158B1-01: one normalised maximum converted through the first space's
  // cell size promised 2.5 cm for a vertex that moved 50 cm on the floor above.
  const MULTI = { spaces: [
    { id: 'm1', title: 'Ground', cell_cm: 5, view_box: [0, 0, 1, 1],
      rooms: [{ id: 'ma', name: 'A', area: 'living_room',
        poly: [[0.1, 0.1], [0.3, 0.1], [0.3, 0.3], [0.1, 0.3]] }] },
    { id: 'm2', title: 'Attic', cell_cm: 100, view_box: [0, 0, 1, 1],
      // the ONLY off-grid vertex on the plan, and it is on the 100 cm floor
      rooms: [{ id: 'mb', name: 'B', area: 'kitchen',
        poly: [[0.2 + 1 / GRID_N / 2, 0.2], [0.4, 0.2], [0.4, 0.4], [0.2, 0.4]] }] },
  ], markers: [], settings: {} };
  c._serverCfg = JSON.parse(JSON.stringify(MULTI));
  c._layout = {};
  c._modelCache = null; c._frame = null; c._space = 'm1';
  c.requestUpdate(); await c.updateComplete;
  c._openAlignDialog(); await c.updateComplete;
  const md = c._alignDialog;
  o.alignPromiseUsesTheOwnScaleOfEachSpace = !!md && md.cm >= 50 && md.cm < 51;
  o.alignPromiseNamesTheSpaceItBelongsTo = !!md && md.where === 'Attic'
    && (sr().querySelector('.dialogwrap .body')?.textContent || '').includes('Attic');
  c._alignDialog = null; await c.updateComplete;

  // ---- 2d) an angle-only opening fix is offerable (AUD-158B1-02) --------
  // its centre is already on the wall; only the stored angle is wrong, and the
  // batch used to report "nothing to move" while returning a different plan
  const TURN = { spaces: [{ id: 'a1', title: 'Flat', cell_cm: 5, view_box: [0, 0, 1, 1],
    rooms: [{ id: 'r1', name: 'A', area: 'living_room',
      poly: [[0.2, 0.2], [0.5, 0.2], [0.5, 0.5], [0.2, 0.5]] }],
    openings: [{ id: 'oa', type: 'window', x: 0.35, y: 0.2, angle: 90, length: 0.1 }],
  }], markers: [], settings: {} };
  c._serverCfg = JSON.parse(JSON.stringify(TURN));
  c._layout = {};
  c._modelCache = null; c._frame = null; c._space = 'a1';
  c.requestUpdate(); await c.updateComplete;
  c._openAlignDialog(); await c.updateComplete;
  const ad = c._alignDialog;
  o.angleOnlyOpeningCounts = !!ad && ad.report.moved === 1 && ad.report.rotated === 1;
  o.angleOnlyOpeningOffersTheButton = !!sr().querySelector('.dialogwrap .btn.on');
  await c._runAlignToGrid();
  await c.updateComplete;
  o.angleOnlyOpeningIsActuallyFixed = c._serverCfg.spaces[0].openings[0].angle === 0;

  return o;
});

await finish(browser, checkAll(out));
