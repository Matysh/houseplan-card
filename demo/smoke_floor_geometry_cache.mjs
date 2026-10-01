// #744: the four floor-geometry caches (physical bodies, the wall union,
// inner room contours, the clean floor) are keyed by the content of ONE
// floor's record, not by the global config epoch.
//
// AC1  an edit of `f1` (a rename through the room dialog) leaves `garden`
//      warm: its first visit after the edit builds nothing. On the epoch key
//      the visit rebuilt the union (+1), every contour and clean floor (+N).
// AC2a a server push that changes walls of BOTH floors (shared walls: one
//      thickness moves the faces of two rooms) while `f1` is on screen: each
//      floor draws the walls and areas an independent card computes from
//      scratch on the same config, and they differ from the previous ones.
// AC2b a stair placed on `f1` through the stairs tool shrinks the room by its
//      footprint, as the independent card says, and `garden` keeps its clean
//      floors (the stairs editor used to clear the cache of every floor).
// AC2c a live Resize preview on `f1`: the frame follows the preview record,
//      as the independent card on that record says; cancelling restores the
//      walls and areas of the stored record. Both frames of a held drag are
//      judged: the live layer that paints the moving wall, and the settled
//      scene that replaces it whenever the host renders mid-drag (an entity
//      state change from Home Assistant, a toast expiring) and draws the
//      preview record through the floor-geometry caches.
//
// The independent card is the oracle: a new `houseplan-card` given the same
// config through its own `config/get`, with nothing in its caches to reuse.
// Card internals are read-only here; writes go through the harness facade,
// the room dialog, the stairs tool, real pointer input and the demo's Home
// Assistant stub (a service call delivers the new entity state).
import { launch, checkAll, finish } from './serve.mjs';
import { fixtureWallKey } from './fixtures/wall-key.mjs';

const { page, browser } = await launch({ width: 1100, height: 850 });

/** Every edge of every room once, as a real wall record of `cm`. */
const wallsOf = (rooms, cm, overrides = {}) => {
  const byKey = new Map();
  for (const room of rooms) {
    room.poly.forEach((a, index) => {
      const b = room.poly[(index + 1) % room.poly.length];
      const key = fixtureWallKey(a, b);
      if (!byKey.has(key)) byKey.set(key, { key, cm: overrides[key] ?? cm, a, b });
    });
  }
  return [...byKey.values()];
};
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
// On the 1/240 editor grid, every interior edge shared by exactly two rooms.
const f1Rooms = [
  { id: 'r1', name: 'Living room', area: 'living_room', poly: rect(0.1, 0.15, 0.5, 0.5) },
  { id: 'r2', name: 'Kitchen', area: 'kitchen', poly: rect(0.5, 0.15, 0.9, 0.5) },
  { id: 'r3', name: 'Hallway', area: 'hallway', poly: rect(0.1, 0.5, 0.5, 0.85) },
  { id: 'r4', name: 'Bedroom', area: 'bedroom', poly: rect(0.5, 0.5, 0.9, 0.85) },
];
const gardenRooms = [
  { id: 'g1', name: 'Garden west', area: 'garden', poly: rect(0.1, 0.2, 0.5, 0.8) },
  { id: 'g2', name: 'Garden east', poly: rect(0.5, 0.2, 0.9, 0.8) },
];
const f1Shared = fixtureWallKey([0.5, 0.15], [0.5, 0.5]);
const gardenShared = fixtureWallKey([0.5, 0.2], [0.5, 0.8]);
const fixture = {
  f1: {
    rooms: f1Rooms,
    walls: wallsOf(f1Rooms, 15),
    partitions: [{ id: 'f1-wall', a: [0.6, 0.62], b: [0.8, 0.62], cm: 10 }],
    wall_columns: [{ id: 'f1-column', shape: 'circle', center: [0.7, 0.3], cm: 20 }],
  },
  garden: {
    rooms: gardenRooms,
    walls: wallsOf(gardenRooms, 15),
    partitions: [{ id: 'garden-wall', a: [0.2, 0.5], b: [0.4, 0.5], cm: 10 }],
    wall_columns: [{ id: 'garden-column', shape: 'square', center: [0.7, 0.5], cm: 20, angle: 0 }],
  },
  // AC2a: one push thickens the shared wall of each floor.
  thick: {
    f1: wallsOf(f1Rooms, 15, { [f1Shared]: 30 }),
    garden: wallsOf(gardenRooms, 15, { [gardenShared]: 30 }),
  },
};

const res = await page.evaluate(async (fixture) => {
  const out = {};
  const diag = {};
  const card = window.__card;
  const hp = window.__hpTest;
  const root = () => card.renderRoot;
  const settled = () => hp.settled();
  const frames = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  const writesIdle = async () => {
    const busy = () => card._saveConfigDebounced.pending() || card._writesPending > 0;
    const deadline = performance.now() + 5000;
    while (busy() && performance.now() < deadline) await new Promise((done) => setTimeout(done, 16));
    await settled();
    return !busy();
  };

  // ---- what a floor shows: wall outlines and room areas ---------------------
  const wallPaths = (host = card) => [...host.renderRoot.querySelectorAll('[data-hp="wall"]')]
    .map((node) => `${node.getAttribute('data-kind')}:${node.getAttribute('d')}`).join(' | ');
  const areas = (host = card) => Object.fromEntries((host._spaceModel()?.rooms || [])
    .map((room) => [room.id, host._roomArea(room)]));
  const shown = (host = card) => ({
    space: host._spaceModel()?.id, walls: wallPaths(host), areas: areas(host),
  });
  const sameShown = (a, b) => a.space === b.space && a.walls === b.walls
    && JSON.stringify(a.areas) === JSON.stringify(b.areas);
  const sizes = () => ({
    wallUnionPool: card._wallUnionPool.size,
    innerContour: card._innerContourCache.size,
    cleanFloor: card._cleanFloorCache.size,
  });
  const gardenCleanKeys = () => [...card._cleanFloorCache.keys()].filter((key) => key.startsWith('garden|'));

  // ---- the oracle: a fresh card on the given config -------------------------
  let oracleRev = 900000;
  const oracle = async (config, spaceId) => {
    const rev = ++oracleRev;
    const base = card.hass;
    const hass = {
      ...base,
      callWS: async (message) => {
        if (message.type === 'houseplan/config/get')
          return { config: structuredClone(config), rev, can_write: false };
        if (message.type === 'houseplan/config/set') return { ok: true, rev };
        return base.callWS(message);
      },
    };
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:0;top:0;width:900px;height:700px;opacity:0;pointer-events:none';
    document.body.appendChild(host);
    const fresh = document.createElement('houseplan-card');
    fresh.setConfig({ type: 'custom:houseplan-card', floor: spaceId });
    host.appendChild(fresh);
    fresh.hass = hass;
    const deadline = performance.now() + 9000;
    while (performance.now() < deadline && !(fresh._loadOk && fresh._booting === false
      && fresh._cfgRev === rev && fresh._spaceModel()?.id === spaceId)) {
      await new Promise((done) => setTimeout(done, 30));
    }
    fresh.hass = { ...hass };
    await fresh.updateComplete;
    await frames();
    await fresh.updateComplete;
    const value = { ...shown(fresh), ready: fresh._cfgRev === rev };
    host.remove();
    return value;
  };
  window.__hp744 = { diag, shown, sameShown, oracle, settled, writesIdle };

  // ---- fixture: walls on every room edge, a partition and a column per floor -
  // The demo record still carries the legacy `segments: []`, and the first
  // write of the card canonicalises EVERY floor (`_dropLegacySegments` drops
  // it and gives a square column its `angle`): a real, one-time change of
  // garden's record. The fixture starts canonical, so the rename below is
  // the only change.
  await hp.setServerConfig((cfg) => {
    for (const space of cfg.spaces) {
      const own = fixture[space.id];
      if (!own) continue;
      Object.assign(space, structuredClone(own), { cell_cm: 5 });
      space.settings = { ...(space.settings || {}), show_borders: true };
      delete space.stairs;
      delete space.segments;
    }
    return cfg;
  });
  await hp.switchSpace('f1');
  await writesIdle();
  const f1Initial = shown();
  out.fixtureF1HasWallBodies = f1Initial.walls.includes('union:') && Object.keys(f1Initial.areas).length === 4;

  // ======================= AC1: an edit of f1 leaves garden warm ============
  await hp.switchSpace('garden');
  const gardenInitial = shown();
  out.fixtureGardenHasWallBodies = gardenInitial.space === 'garden' && gardenInitial.walls.includes('union:')
    && Object.keys(gardenInitial.areas).length === 2;
  const gardenBodiesKey = card._physicalBodiesCache?.key ?? null;
  out.fixtureGardenHasPhysicalBodies = !!gardenBodiesKey && (card._physicalBodiesR()?.length ?? 0) >= 2;
  const gardenRecord = () => JSON.stringify(card._serverCfg.spaces.find((space) => space.id === 'garden'));
  const gardenRecordBefore = gardenRecord();
  await hp.switchSpace('f1');

  await hp.setMode('plan');
  const epochBeforeRename = card._cfgEpoch;
  const dialog = await hp.openRoomEdit('r1');
  await hp.input(dialog.querySelector('#room-name'), 'Living room 744');
  dialog.querySelector('[data-hp="dialog-confirm"]')?.click();
  await settled();
  await hp.setMode('view');
  out.ac1WritesSettled = await writesIdle();
  const renamed = card._serverCfg.spaces.find((space) => space.id === 'f1')
    ?.rooms.find((room) => room.id === 'r1')?.name;
  out.ac1TheEditIsARealSave = renamed === 'Living room 744' && card._cfgEpoch > epochBeforeRename;
  out.ac1TheEditLeavesGardenRecordAlone = gardenRecord() === gardenRecordBefore;

  const beforeVisit = sizes();
  await hp.switchSpace('garden');
  const afterVisit = sizes();
  diag.ac1 = { beforeVisit, afterVisit, gardenBodiesKey, after: card._physicalBodiesCache?.key };
  out.ac1GardenVisitBuildsNoWallUnion = afterVisit.wallUnionPool - beforeVisit.wallUnionPool;
  out.ac1GardenVisitBuildsNoContour = afterVisit.innerContour - beforeVisit.innerContour;
  out.ac1GardenVisitBuildsNoCleanFloor = afterVisit.cleanFloor - beforeVisit.cleanFloor;
  out.ac1GardenKeepsItsPhysicalBodiesKey = card._physicalBodiesCache?.key === gardenBodiesKey;
  out.ac1GardenLooksTheSame = sameShown(shown(), gardenInitial);

  // ============ AC2a: a server push changes both floors while f1 is shown ====
  const gardenBefore = shown();
  await hp.switchSpace('f1');
  const f1Before = shown();
  await hp.setServerConfig((cfg) => {
    for (const space of cfg.spaces) {
      if (fixture.thick[space.id]) space.walls = structuredClone(fixture.thick[space.id]);
    }
    return cfg;
  });
  const pushed = structuredClone(card._serverCfg);
  const f1After = shown();
  await hp.switchSpace('garden');
  const gardenAfter = shown();
  const f1Oracle = await oracle(pushed, 'f1');
  const gardenOracle = await oracle(pushed, 'garden');
  diag.ac2a = { f1Before, f1After, f1Oracle, gardenBefore, gardenAfter, gardenOracle };
  out.ac2aOraclesReady = f1Oracle.ready && gardenOracle.ready;
  out.ac2aPushChangedBothFloors = f1After.walls !== f1Before.walls && gardenAfter.walls !== gardenBefore.walls
    && f1After.areas.r1 !== f1Before.areas.r1 && f1After.areas.r2 !== f1Before.areas.r2
    && gardenAfter.areas.g1 !== gardenBefore.areas.g1 && gardenAfter.areas.g2 !== gardenBefore.areas.g2;
  out.ac2aCurrentFloorEqualsAFreshCard = sameShown(f1After, f1Oracle);
  out.ac2aOtherFloorEqualsAFreshCard = sameShown(gardenAfter, gardenOracle);

  // ======== AC2b: a stair on f1 shrinks its room; garden keeps its floors =====
  const gardenKeys = gardenCleanKeys();
  out.ac2bGardenHasCleanFloors = gardenKeys.length >= 2;
  await hp.switchSpace('f1');
  await hp.setMode('plan');
  const r3 = () => card._spaceModel().rooms.find((room) => room.id === 'r3');
  const areaBeforeStair = card._roomArea(r3());
  await hp.setTool('stairs');
  const straight = root().querySelector('[data-hp="tray"] [data-group-item="straight"]');
  straight?.click();
  await settled();
  // The default straight stair (240 × 100 cm) centred well inside r3.
  const at = new DOMPoint(300, 680).matrixTransform(root().querySelector('.plan-svg').getScreenCTM());
  root().querySelector('.stage').dispatchEvent(new MouseEvent('click', {
    clientX: at.x, clientY: at.y, bubbles: true, composed: true, cancelable: true, button: 0,
  }));
  await settled();
  await writesIdle();
  const stairs = card._serverCfg.spaces.find((space) => space.id === 'f1')?.stairs || [];
  out.ac2bTheStairIsPlaced = !!straight && stairs.length === 1;
  const areaAfterStair = card._roomArea(r3());
  const stairOracle = await oracle(structuredClone(card._serverCfg), 'f1');
  const number = (text) => Number(String(text).replace(/[^\d.,-]/g, '').replace(',', '.'));
  diag.ac2b = { areaBeforeStair, areaAfterStair, oracle: stairOracle.areas.r3, gardenKeys };
  out.ac2bRoomAreaShrinks = number(areaAfterStair) < number(areaBeforeStair);
  out.ac2bRoomAreaEqualsAFreshCard = stairOracle.ready && areaAfterStair === stairOracle.areas.r3;
  out.ac2bGardenCleanFloorsKept = gardenKeys.filter((key) => !card._cleanFloorCache.has(key));

  // ======== AC2c setup: the Resize tool and the r1/r2 shared wall handle =====
  // Outer walls of this fixture are partial (their records span two rooms) and
  // stay disabled; the shared wall moves the faces of both rooms.
  // The drag starts on a quiet card. A host render ends the live layer of a
  // held drag (`updated()` commits it) and nothing repaints it until the next
  // accepted move. The rename's toast expires 3.5 s after the save; on a fast
  // runner that landed after the last move (Validate run 36875756451), and the
  // live frame below found no live layer. The settled frame is taken on
  // purpose, by a state change, after the live one.
  const toastDeadline = performance.now() + 5000;
  while (root().querySelector('[data-hp="toast"]') && performance.now() < toastDeadline)
    await new Promise((done) => setTimeout(done, 30));
  out.ac2cStartsWithoutAToast = !root().querySelector('[data-hp="toast"]');
  await settled();
  await hp.setTool('resize');
  diag.ac2cStored = shown();
  const handle = [...root().querySelectorAll('.rszhandle:not(.rszcorner)')].find((node) =>
    Math.abs(Number(node.getAttribute('cx')) - 500) < 0.5
      && Math.abs(Number(node.getAttribute('cy')) - 325) < 0.5);
  out.ac2cHandleEnabled = handle?.getAttribute('aria-disabled') === 'false';
  const box = handle?.getBoundingClientRect();
  const leftBy = new DOMPoint(450, 325).matrixTransform(root().querySelector('.plan-svg').getScreenCTM());
  out.ac2cGesture = box ? {
    x: box.left + box.width / 2, y: box.top + box.height / 2, toX: leftBy.x,
  } : null;
  return out;
}, fixture);

// ======== AC2c: hold a real drag of the shared wall 50 units into r1 ==========
const { ac2cGesture: gesture, ...checks } = res;
if (gesture) {
  await page.mouse.move(gesture.x, gesture.y);
  await page.mouse.down();
  await page.mouse.move((gesture.x + gesture.toX) / 2, gesture.y, { steps: 3 });
  await page.mouse.move(gesture.toX, gesture.y, { steps: 3 });
  Object.assign(checks, await page.evaluate(async () => {
    const card = window.__card;
    const { diag, shown, settled } = window.__hp744;
    await settled();
    const preview = card._resize.preview;
    diag.ac2cPreview = shown();
    diag.ac2cPreviewRecord = preview ? structuredClone(preview.sp) : null;
    diag.ac2cLiveAreas = (card._resize.liveLabels || []).filter((label) => label.kind === 'area')
      .map((label) => [label.roomId, label.text]);
    return { ac2cPreviewIsLive: !!preview && preview.space === 'f1' && card._resize.dragging };
  }));
  // The settled frame of the held drag: a light switched in the house renders
  // the host; the settled scene now draws the walls and areas of the preview.
  Object.assign(checks, await page.evaluate(async () => {
    const card = window.__card;
    const { diag, shown, settled } = window.__hp744;
    const record = JSON.stringify(card._resize.preview?.sp ?? null);
    await card.hass.callService('light', 'toggle', { entity_id: 'light.ceiling' });
    await settled();
    diag.ac2cSettled = shown();
    return {
      ac2cStateChangeKeepsThePreview: card._resize.dragging
        && JSON.stringify(card._resize.preview?.sp ?? null) === record,
    };
  }));
  await page.keyboard.press('Escape');
  await page.mouse.up();
  Object.assign(checks, await page.evaluate(async () => {
    const card = window.__card;
    const { diag, shown, sameShown, oracle, settled } = window.__hp744;
    await settled();
    const out = {};
    const cancelled = shown();
    out.ac2cCancelled = !card._resize.dragging && !card._resize.preview;
    out.ac2cCancelRestoresTheStoredFrame = sameShown(cancelled, diag.ac2cStored);
    const record = diag.ac2cPreviewRecord;
    if (record) {
      const config = structuredClone(card._serverCfg);
      config.spaces = config.spaces.map((space) => (space.id === 'f1' ? record : space));
      const fresh = await oracle(config, 'f1');
      diag.ac2cOracle = fresh;
      out.ac2cOracleReady = fresh.ready;
      out.ac2cPreviewMovesBothRooms = diag.ac2cPreview.areas.r1 !== diag.ac2cStored.areas.r1
        && diag.ac2cPreview.areas.r2 !== diag.ac2cStored.areas.r2;
      // The live layer draws the moving wall; its faces are where the fresh
      // card on the preview record draws them, and not where they were. Should
      // a host render still land after the last move, the settled scene draws
      // the drag instead, and its walls are judged the same way: a stale
      // (stored) union has none of the moved faces.
      const numbers = (text) => new Set((text.match(/-?\d+(?:\.\d+)?/g) || []).map(Number));
      const parts = (walls, kind) => walls.split(' | ').filter((part) => part.startsWith(`${kind}:`));
      const stored = numbers(diag.ac2cStored.walls);
      const moved = [...numbers(fresh.walls)].filter((value) => !stored.has(value));
      const live = parts(diag.ac2cPreview.walls, 'preview');
      const drawn = numbers((live.length ? live : parts(diag.ac2cPreview.walls, 'union')).join(' '));
      const missing = moved.filter((value) => !drawn.has(value));
      out.ac2cPreviewWallStandsWhereAFreshCardDrawsIt = moved.length > 0 && !missing.length;
      // The settled scene mid-drag is the fresh card's frame on the preview
      // record: the same union path, the same areas. A key that ignores the
      // preview hands it the stored union and contours.
      const union = (frame) => parts(frame?.walls || '', 'union').join(' | ');
      const settledUnion = union(diag.ac2cSettled);
      out.ac2cSettledFrameEqualsAFreshCard = !!settledUnion && settledUnion === union(fresh)
        && JSON.stringify(diag.ac2cSettled.areas) === JSON.stringify(fresh.areas);
      diag.ac2cJudged = {
        layer: live.length ? 'preview' : 'union', moved: moved.length, missing,
        settledUnion: !settledUnion ? 'none' : settledUnion === union(fresh) ? 'fresh'
          : settledUnion === union(diag.ac2cStored) ? 'stored' : 'other',
      };
      // Room areas through the cached contour, and the live labels beside the
      // moving wall, are the fresh card's numbers for the preview record.
      out.ac2cPreviewAreasEqualAFreshCard = JSON.stringify(diag.ac2cPreview.areas) === JSON.stringify(fresh.areas);
      out.ac2cLiveAreaLabelsEqualAFreshCard = diag.ac2cLiveAreas.length === 2
        && diag.ac2cLiveAreas.every(([roomId, text]) => fresh.areas[roomId] === text);
    }
    diag.ac2cCancelled = cancelled;
    return out;
  }));
  if (!checks.ac2cPreviewWallStandsWhereAFreshCardDrawsIt || !checks.ac2cSettledFrameEqualsAFreshCard) {
    // Validate prints only `diagnostic` lines and the tail of a failed smoke.
    const judged = await page.evaluate(() => window.__hp744.diag.ac2cJudged);
    console.log(`diagnostic ac2c: ${JSON.stringify(judged)}`);
  }
}

checkAll(checks, {
  ac1GardenVisitBuildsNoWallUnion: 0,
  ac1GardenVisitBuildsNoContour: 0,
  ac1GardenVisitBuildsNoCleanFloor: 0,
  ac2bGardenCleanFloorsKept: [],
});
if (process.env.HP_744_DIAG) console.log(JSON.stringify(await page.evaluate(() => window.__hp744.diag), null, 1));
await finish(browser, checks);
