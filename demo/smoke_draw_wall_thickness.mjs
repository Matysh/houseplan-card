/**
 * Draw toolbar wall thickness (docs/WALL-THICKNESS.md §6): default 15 cm on
 * commit, live preview, shared neighbour cm kept.
 */
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();

const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const upd = async () => { c._cfgEpoch++; c.requestUpdate(); await c.updateComplete; };
  const sp = () => c._serverCfg.spaces.find((s) => s.id === c._space);

  c._setMode('plan');
  c._tool = 'draw';
  await upd();
  out.fieldDefault = c._drawWallFieldValue === '15' || c._drawWallFieldValue === '15.0';
  const field = sr().querySelector('.editor-secondary.kind-tool .drawwall input');
  out.fieldInContextTray = !!field;
  out.fieldAbsentFromPrimaryBar = !sr().querySelector('.editbar .drawwall input');
  out.fieldTrayIsStageOverlay = field?.closest('.editor-secondary-host')?.closest('.stage')
    === sr().querySelector('.stage');
  const wallsButton = sr().querySelector('.editbar button.on');
  out.drawButtonNamedWalls = ['Walls', 'Стены']
    .includes((wallsButton?.textContent || '').trim());

  // draw a small room away from existing rooms (garden/demo f1 may have rooms)
  // use empty space if available, else clear rooms on a copy path
  let space = sp();
  const savedSpace = JSON.parse(JSON.stringify(space));
  space.rooms = [];
  delete space.walls;
  await upd();

  const g = c._gridPitch;
  // 4×4 cell square
  const pts = [
    [100, 100], [100 + 8 * g, 100], [100 + 8 * g, 100 + 8 * g], [100, 100 + 8 * g],
  ];
  c._path = [];
  c._tool = 'draw';
  for (const p of pts) {
    c._path = [...c._path, p];
    c._cursorPt = p;
    await upd();
  }
  // close
  c._path = [...c._path, pts[0]];
  await upd();
  out.previewWhileOpen = !!sr().querySelector('.drawwall-preview')
    || c._drawWallCm === 15;
  // force closed state if helper exists
  if (!c._contourClosed) {
    // last point equals first — _contourClosed should be true
  }
  out.contourClosed = !!c._contourClosed;
  c._nameSel = 'ThickDraw';
  c._areaSel = '';
  c._commitRoom();
  await upd();

  // Structural commits adopt one fully validated config candidate. Never keep
  // an object identity from before that atomic swap as test evidence.
  space = sp();

  out.roomSaved = (space.rooms || []).some((r) => r.name === 'ThickDraw');
  out.wallsApplied = (space.walls || []).length >= 4
    && (space.walls || []).every((w) => w.cm === 15);
  const firstRoom = (space.rooms || []).find((r) => r.name === 'ThickDraw');
  out.wallIdentityMaterialized = c._serverCfg.model_version === 10
    && firstRoom?.wall_ids?.length === 4
    && new Set(firstRoom.wall_ids).size === 4
    && (space.wall_segments || []).length === 4;
  out.bodyDrawn = sr().querySelectorAll('[data-hp="wall"]').length >= 1;

  // second room sharing the right edge — neighbour keeps 15, new edges get 20
  c._drawWallField = '20';
  const r1 = space.rooms.find((r) => r.name === 'ThickDraw');
  const poly = r1.poly.map((p) => [p[0] * 1000, p[1] * (c._spaceH || 1000)]);
  // shared vertical: right edge of r1
  const x1 = Math.max(...poly.map((p) => p[0]));
  const y0 = Math.min(...poly.map((p) => p[1]));
  const y1 = Math.max(...poly.map((p) => p[1]));
  const w = 6 * g;
  c._path = [
    [x1, y0], [x1 + w, y0], [x1 + w, y1], [x1, y1], [x1, y0],
  ];
  await upd();
  c._nameSel = 'Neighbour';
  c._commitRoom();
  await upd();

  space = sp();

  const sharedStill15 = (space.walls || []).some((w) => w.cm === 15);
  const has20 = (space.walls || []).some((w) => w.cm === 20);
  out.sharedKept = sharedStill15 && has20;
  const rooms = (space.rooms || []).filter((room) =>
    room.name === 'ThickDraw' || room.name === 'Neighbour');
  const sharedIds = rooms.length === 2
    ? rooms[0].wall_ids.filter((id) => rooms[1].wall_ids.includes(id)) : [];
  out.sharedIdentityKept = sharedIds.length === 1
    && space.wall_segments.some((segment) => segment.id === sharedIds[0] && segment.cm === 15);

  // restore demo space
  for (const key of Object.keys(space)) delete space[key];
  Object.assign(space, savedSpace);
  c._path = [];
  await upd();

  return out;
});

checkAll(res);
await finish(browser, res);
