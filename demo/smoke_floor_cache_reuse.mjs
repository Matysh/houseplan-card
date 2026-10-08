// #814: prepared floor geometry stays usable; nothing stale is ever shown.
//
// AC1  the opening wall index and the sun wedges are keyed by their inputs,
//      not by the global config epoch. A Home Assistant update, an edit of
//      another floor and a shared setting build nothing on the shown floor; a
//      window moved in place (no new epoch), a Resize commit whose WS write is
//      still held, and the rollback of that write after the server rejects it
//      each show what an independent card computes on the same config.
// AC2  physical bodies and opening tunnels are pooled per floor (≤ 8, LRU):
//      after the three floors are warm, the twelve-switch cycle builds
//      neither, judged by the #735 guard with `pooled`; a planted full pool
//      shows the evicting miss by its counter while every size stays; a
//      server push that moves a partition builds the new bodies, and they are
//      the independent card's.
// AC3  Resize measures every resized room on every accepted step against one
//      union of the unchanged bodies: one union per gesture (cancel, commit,
//      a repeated gesture, Undo, Redo, another floor), a server push mid-drag
//      ends the gesture and drops its union, the live areas are the
//      independent card's, and so is the opening wall index of every held
//      preview (AC1).
// AC7  config replacement, a mode change, disconnect/reconnect and a warm
//      remount keep no stale geometry and no unbounded pool.
//
// The independent card is the oracle: a new `houseplan-card` given the same
// config through its own `config/get`, with nothing in its caches to reuse.
// Card internals are read-only except where a line says `private-ok`; writes
// go through the harness facade, real pointer input and `card.hass`.
import { launch, checkAll, finish } from './serve.mjs';
import { fixtureWallKey } from './fixtures/wall-key.mjs';
import { floorCacheBuilds, floorCacheSnapshot, judgeSwitchCycle } from './performance/switch-cycle-guard.mjs';

const { page, browser } = await launch({ width: 1100, height: 850 });
await page.addScriptTag({
  content: `window.__hpSwitchCycleGuard = { snapshot: ${floorCacheSnapshot.toString()}, `
    + `builds: ${floorCacheBuilds.toString()}, judge: ${judgeSwitchCycle.toString()} };`,
});

/**
 * Every edge of every room once, as a real wall record of `cm`. The endpoints
 * are copies: a config read from the server never shares arrays, and the
 * in-place adoption of a commit would rewrite a room vertex through an alias.
 */
const wallsOf = (rooms, cm) => {
  const byKey = new Map();
  for (const room of rooms) {
    room.poly.forEach((a, index) => {
      const b = room.poly[(index + 1) % room.poly.length];
      const key = fixtureWallKey(a, b);
      if (!byKey.has(key)) byKey.set(key, { key, cm, a: [...a], b: [...b] });
    });
  }
  return [...byKey.values()];
};
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const f1Rooms = [
  { id: 'r1', name: 'Living room', area: 'living_room', poly: rect(0.1, 0.15, 0.5, 0.5) },
  { id: 'r2', name: 'Kitchen', area: 'kitchen', poly: rect(0.5, 0.15, 0.9, 0.5) },
  { id: 'r3', name: 'Hallway', area: 'hallway', poly: rect(0.1, 0.5, 0.5, 0.85) },
  { id: 'r4', name: 'Bedroom', area: 'bedroom', poly: rect(0.5, 0.5, 0.9, 0.85) },
];
const twoRooms = (prefix) => [
  { id: `${prefix}1`, name: `${prefix} west`, poly: rect(0.1, 0.2, 0.5, 0.8) },
  { id: `${prefix}2`, name: `${prefix} east`, poly: rect(0.5, 0.2, 0.9, 0.8) },
];
const floor = (rooms, extra) => ({ rooms, walls: wallsOf(rooms, 15), cell_cm: 5, ...extra });
// The sun stands south-east of a north-up plan: it enters the east and south windows.
const fixture = {
  f1: floor(f1Rooms, {
    partitions: [
      { id: 'f1-wall', a: [0.6, 0.62], b: [0.8, 0.62], cm: 10 },
      { id: 'f1-door-wall', a: [0.52, 0.32], b: [0.77, 0.32], cm: 10 },
    ],
    openings: [
      { id: 'f1-door', type: 'door', x: 0.5575, y: 0.32, angle: 0, length: 0.04,
        host: { kind: 'partition', id: 'f1-door-wall', t: 0.15 } },
      { id: 'f1-east', type: 'window', x: 0.9, y: 0.3, angle: 90, length: 0.06 },
      { id: 'f1-south', type: 'window', x: 0.7, y: 0.85, angle: 0, length: 0.06 },
    ],
    wall_columns: [{ id: 'f1-column', shape: 'circle', center: [0.7, 0.4], cm: 20 }],
  }),
  garden: floor(twoRooms('g'), {
    partitions: [{ id: 'garden-wall', a: [0.2, 0.5], b: [0.4, 0.5], cm: 10 }],
    openings: [{ id: 'g-east', type: 'window', x: 0.9, y: 0.5, angle: 90, length: 0.06 }],
    wall_columns: [{ id: 'garden-column', shape: 'square', center: [0.7, 0.5], cm: 20, angle: 0 }],
  }),
  loft: floor(twoRooms('l'), {
    partitions: [{ id: 'loft-wall', a: [0.6, 0.4], b: [0.8, 0.4], cm: 12 }],
    openings: [{ id: 'l-south', type: 'window', x: 0.3, y: 0.8, angle: 0, length: 0.06 }],
    wall_columns: [{ id: 'loft-column', shape: 'circle', center: [0.3, 0.4], cm: 25 }],
  }),
};

// ---- in-page helpers, shared by every part ----------------------------------
await page.evaluate(async (fixture) => {
  const card = window.__card;
  const hp = window.__hpTest;
  const frames = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  const settled = async () => { await hp.settled(); await frames(); await (window.__card.updateComplete); };
  // What a floor shows and holds: walls, areas, bodies, tunnels, index, sun.
  const look = (host = window.__card) => {
    const space = host._spaceModel();
    return {
      space: space?.id ?? null,
      walls: [...host.renderRoot.querySelectorAll('[data-hp="wall"]')]
        .map((node) => `${node.getAttribute('data-kind')}:${node.getAttribute('d')}`).join(' | '),
      areas: JSON.stringify(Object.fromEntries((space?.rooms || []).map((room) => [room.id, host._roomArea(room)]))),
      bodies: JSON.stringify(host._physicalBodiesCache?.all ?? null),
      tunnels: JSON.stringify(host._openingTunnelCache?.value ?? null),
      index: space ? JSON.stringify(host._openingWallIndexFor(space, host._openCuts()).value) : null,
      sun: JSON.stringify(host._sunRaysCache?.rays ?? null),
    };
  };
  const differs = (a, b) => Object.keys(a).filter((key) => a[key] !== b[key]);
  let oracleRev = 900000;
  /** A fresh card on `config`, shown on `spaceId` in View: what it looks like. */
  const oracle = async (config, spaceId) => {
    const rev = ++oracleRev;
    const base = window.__card.hass;
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
    // `hass` before the element connects, as Lovelace hands it over: a warm
    // slot freed long ago revalidates from the server in connectedCallback.
    fresh.hass = hass;
    host.appendChild(fresh);
    const deadline = performance.now() + 15000;
    while (performance.now() < deadline && !(fresh._loadOk && fresh._booting === false
      && fresh._cfgRev === rev && fresh._spaceModel()?.id === spaceId)) {
      await new Promise((done) => setTimeout(done, 30));
    }
    fresh.hass = { ...hass };
    await fresh.updateComplete;
    await frames();
    await fresh.updateComplete;
    const value = { ...look(fresh), ready: fresh._cfgRev === rev };
    host.remove();
    return value;
  };
  /** The shown floor against a fresh card on the card's own config. */
  const sameAsFresh = async (host = window.__card) => {
    const shown = look(host);
    const fresh = await oracle(structuredClone(host._serverCfg), shown.space);
    const { ready, ...expected } = fresh;
    return ready ? differs(shown, expected) : ['oracle not ready'];
  };
  const builds = () => ({ ...window.__card._floorCacheBuilds });
  const grew = (before, after = builds(), families = Object.keys(after)) => Object.fromEntries(
    families.map((family) => [family, after[family] - before[family]]));
  const sunState = (azimuth, elevation) => ({
    entity_id: 'sun.sun', state: 'above_horizon', attributes: { azimuth, elevation, rising: false },
  });
  /** A Home Assistant update that touches no geometry (a public `hass` assignment). */
  const haTick = async (extra = {}) => {
    const current = window.__card.hass;
    const light = current.states['light.ceiling'];
    window.__card.hass = { ...current, states: { ...current.states,
      'light.ceiling': { ...light, state: light.state === 'on' ? 'off' : 'on' }, ...extra } };
    await settled();
  };
  window.__hp814 = { look, differs, oracle, sameAsFresh, builds, grew, sunState, haTick, settled, frames };

  // ---- fixture: three floors, walls on every edge, bodies, windows, sun ------
  await hp.setServerConfig((cfg) => {
    const template = cfg.spaces.find((space) => space.id === 'garden');
    if (!cfg.spaces.some((space) => space.id === 'loft'))
      cfg.spaces.push({ ...structuredClone(template), id: 'loft', title: 'Loft' });
    for (const space of cfg.spaces) {
      const own = fixture[space.id];
      if (!own) continue;
      Object.assign(space, structuredClone(own));
      space.settings = { ...(space.settings || {}), show_borders: true };
      delete space.stairs;
      delete space.segments;
    }
    cfg.settings = { ...(cfg.settings || {}), sun_rays: true, north_deg: 0 };
    return cfg;
  });
  card.hass = { ...card.hass, states: { ...card.hass.states, 'sun.sun': sunState(135, 30) } };
  await hp.switchSpace('f1');
  await settled();
}, fixture);

// ======================= AC1: keys, not the global epoch =====================
const ac1 = await page.evaluate(async () => {
  const card = window.__card;
  const hp = window.__hpTest;
  const { look, sameAsFresh, builds, grew, haTick, settled } = window.__hp814;
  const out = {};
  const families = ['openingWallIndex', 'sunRays', 'openingTunnel', 'physicalBodies'];
  const shown = look();
  out.fixtureShowsSunWallsBodiesAndTunnels = shown.space === 'f1' && JSON.parse(shown.sun)?.length > 0
    && shown.walls.includes('union:') && JSON.parse(shown.bodies)?.length >= 3 && JSON.parse(shown.tunnels)?.length >= 2;
  out.fixtureIsTheFreshCards = await sameAsFresh();

  // A Home Assistant update, another floor's edit, a shared setting.
  let before = builds();
  const sunBefore = card._sunRaysCache;
  await haTick();
  out.haUpdateBuildsNothing = grew(before, builds(), families);
  out.haUpdateKeepsTheWedges = card._sunRaysCache === sunBefore;
  before = builds();
  const epoch = card._cfgEpoch;
  await hp.setServerConfig((cfg) => {
    cfg.spaces.find((space) => space.id === 'garden').partitions[0].b = [0.45, 0.5];
    return cfg;
  });
  out.foreignFloorPushIsANewEpoch = card._cfgEpoch > epoch;
  out.foreignFloorPushBuildsNothing = grew(before, builds(), families);
  before = builds();
  await hp.setServerConfig((cfg) => {
    cfg.settings = { ...cfg.settings, fill_colors: { ...(cfg.settings.fill_colors || {}), light_on: '#ffcc00' } };
    return cfg;
  });
  out.sharedSettingBuildsNothing = grew(before, builds(), families);
  out.stillTheFreshCards = await sameAsFresh();

  // A window moved in place, without a new epoch: the wedges follow it.
  before = builds();
  const epochInPlace = card._cfgEpoch;
  const east = card._serverCfg.spaces.find((space) => space.id === 'f1').openings.find((o) => o.id === 'f1-east');
  east.y = 0.36; // private-ok: #814 AC1 a same-object mutation, no new epoch
  card.requestUpdate();
  await settled();
  out.inPlaceMoveKeepsTheEpoch = card._cfgEpoch === epochInPlace;
  out.inPlaceMoveRebuildsTheWedgesOnce = grew(before, builds(), ['sunRays']).sunRays;
  // The wall union and the clean floors keep the #744 floor-record contract
  // (a product edit is a new epoch, see AC1 below); the index, the tunnels and
  // the wedges read their inputs on every frame.
  out.inPlaceMoveIsTheFreshCards = (await sameAsFresh()).filter((key) => key !== 'walls' && key !== 'areas');
  return out;
});

/** Real pointer drag of the Resize handle at plan point (x, y) to plan x `toX`. */
const dragHandle = async ({ x, y, toX, steps = 3, end = 'up' }) => {
  // A mode change moves the stage; plan coordinates hold only after it ends.
  await page.waitForFunction(() => !window.__card._modeTransitionBusy, null, { timeout: 15000 });
  const gesture = await page.evaluate(([x, y, toX]) => {
    const root = window.__card.renderRoot;
    const handle = [...root.querySelectorAll('.rszhandle:not(.rszcorner)')].find((node) =>
      Math.abs(Number(node.getAttribute('cx')) - x) < 0.5 && Math.abs(Number(node.getAttribute('cy')) - y) < 0.5);
    if (!handle || handle.getAttribute('aria-disabled') !== 'false') {
      return { missing: [...root.querySelectorAll('.rszhandle:not(.rszcorner)')].map((node) =>
        `${node.getAttribute('cx')},${node.getAttribute('cy')}:${node.getAttribute('aria-disabled')}`).join(' '),
      space: window.__card._space, tool: window.__card._tool,
      rooms: (window.__card._spaceModel()?.rooms || []).map((room) => `${room.id}:${JSON.stringify(room.poly)}`),
      record: JSON.stringify(window.__card._serverCfg.spaces.find((sp) => sp.id === window.__card._space)?.rooms) };
    }
    const box = handle.getBoundingClientRect();
    const ctm = root.querySelector('.plan-svg').getScreenCTM();
    const target = new DOMPoint(toX, y).matrixTransform(ctm);
    return { x: box.left + box.width / 2, y: box.top + box.height / 2, toX: target.x };
  }, [x, y, toX]);
  if (gesture.missing !== undefined) {
    // Validate prints only `diagnostic` lines and the tail of a failed smoke.
    console.log(`diagnostic resize handle ${x},${y}: ${JSON.stringify(gesture)}`);
    return false;
  }
  await page.mouse.move(gesture.x, gesture.y);
  await page.mouse.down();
  // The press must start a Resize session; otherwise say what it hit.
  const began = await page.evaluate(([px, py]) => {
    const card = window.__card;
    if (card._resize.dragging) return true;
    const hit = card.renderRoot.elementFromPoint?.(px, py) || document.elementFromPoint(px, py);
    return { hit: hit ? `${hit.tagName}.${hit.getAttribute('class') || ''}` : null, tool: card._tool,
      busy: card._modeTransitionBusy, toast: card._toast || null };
  }, [gesture.x, gesture.y]);
  if (began !== true) {
    console.log(`diagnostic resize press ${x},${y}: ${JSON.stringify(began)}`);
    await page.mouse.up();
    await page.evaluate(() => window.__hp814.settled());
    return false;
  }
  for (let step = 1; step <= steps; step++) {
    await page.mouse.move(gesture.x + ((gesture.toX - gesture.x) * step) / steps, gesture.y, { steps: 2 });
    await page.evaluate(() => window.__hp814.frames());
  }
  if (end === 'escape') await page.keyboard.press('Escape');
  if (end !== 'hold') await page.mouse.up();
  await page.evaluate(() => window.__hp814.settled());
  return true;
};

// ======================= AC2: warm floors, bounded pools =====================
const ac2 = await page.evaluate(async () => {
  const card = window.__card;
  const hp = window.__hpTest;
  const guard = window.__hpSwitchCycleGuard;
  const { look, sameAsFresh, builds, grew } = window.__hp814;
  const out = {};
  const floors = ['f1', 'garden', 'loft'];
  for (const id of floors) await hp.switchSpace(id);
  await hp.switchSpace('garden');
  const before = guard.builds(card);
  const switches = 12;
  for (let index = 0; index < switches; index++) await hp.switchSpace(floors[index % floors.length]);
  const verdict = guard.judge({ before, after: guard.builds(card), switches, pooled: true });
  out.warmCycleVerdict = verdict.failures;
  out.warmCycleBuildsNoBodiesOrTunnels = [verdict.builds.physicalBodies, verdict.builds.openingTunnel];
  const pools = () => [card._physicalBodiesPool.size, card._openingTunnelPool.size];
  out.poolsHoldTheFloorsWithinEight = pools().every((size) => size >= floors.length && size <= 8);

  // The planted state: both pools full (8), garden's entries gone, f1 most recent.
  await hp.switchSpace('garden');
  const garden = [card._physicalBodiesCache.key, card._openingTunnelCache.key];
  await hp.switchSpace('f1');
  const f1 = [card._physicalBodiesCache.key, card._openingTunnelCache.key];
  const plant = (pool, gone, kept, filler) => {
    pool.delete(gone); // private-ok: #814 AC2 planted eviction of garden's entry
    for (let index = 0; pool.size < 8; index++) pool.set(`filler-${index}`, filler(`filler-${index}`)); // private-ok: #814 AC2 fills the pool to its limit
    const entry = pool.get(kept);
    pool.delete(kept); // private-ok: #814 AC2 keeps the shown floor most recent
    pool.set(kept, entry); // private-ok: #814 AC2 keeps the shown floor most recent
  };
  plant(card._physicalBodiesPool, garden[0], f1[0],
    (key) => ({ key, partitions: [], columns: [], patches: [], all: [] }));
  plant(card._openingTunnelPool, garden[1], f1[1], (key) => ({ key, value: [] }));
  out.plantedPoolsAreFullWithoutGarden = pools().join() === '8,8'
    && !card._physicalBodiesPool.has(garden[0]) && !card._openingTunnelPool.has(garden[1]);
  const sizesBefore = guard.snapshot(card);
  const plantedBefore = guard.builds(card);
  for (let index = 0; index < 4; index++) await hp.switchSpace(index % 2 ? 'f1' : 'garden');
  const planted = guard.judge({ before: plantedBefore, after: guard.builds(card), switches: 4, pooled: true });
  out.evictingMissIsCounted = planted.failures;
  out.everySizeStays = JSON.stringify(guard.snapshot(card)) === JSON.stringify(sizesBefore);
  out.gardenIsBackInBothPools = card._physicalBodiesPool.has(garden[0]) && card._openingTunnelPool.has(garden[1]);

  // A geometry change builds the current value: a partition pushed while the loft is shown.
  await hp.switchSpace('loft');
  const loftBefore = builds();
  await hp.setServerConfig((cfg) => {
    cfg.spaces.find((space) => space.id === 'loft').partitions[0].a = [0.55, 0.45];
    return cfg;
  });
  out.movedPartitionBuildsTheLoftBodiesOnce = grew(loftBefore, builds(), ['physicalBodies']).physicalBodies;
  out.movedPartitionIsTheFreshCards = await sameAsFresh();
  out.poolsStayWithinEight = pools().every((size) => size <= 8);
  return out;
});
checkAll(ac2, {
  warmCycleVerdict: [],
  warmCycleBuildsNoBodiesOrTunnels: [0, 0],
  evictingMissIsCounted: ['physical bodies +1', 'opening tunnel +1'],
  movedPartitionBuildsTheLoftBodiesOnce: 1,
  movedPartitionIsTheFreshCards: [],
});

// ======================= AC3: one union per Resize gesture ===================
await page.evaluate(async () => {
  const card = window.__card;
  window.__hp814.unions = () => card._editorRuntime.rszBodiesUnion.builds;
  /** The live area labels of the held drag against a fresh card on its preview record. */
  window.__hp814.liveAreasAgainstFresh = async () => {
    const preview = card._resize.preview;
    if (!preview || !card._resize.dragging) return { error: 'no held preview' };
    const config = structuredClone(card._serverCfg);
    config.spaces = config.spaces.map((space) => (space.id === preview.space ? structuredClone(preview.sp) : space));
    const fresh = await window.__hp814.oracle(config, preview.space);
    const areas = JSON.parse(fresh.areas);
    const labels = (card._resize.liveLabels || []).filter((label) => label.kind === 'area');
    return { rooms: labels.length, wrong: labels.filter((label) => areas[label.roomId] !== label.text)
      .map((label) => `${label.roomId}: ${label.text} vs ${areas[label.roomId]}`), ready: fresh.ready,
      // #814 AC1: the opening wall index of the preview is the fresh card's.
      index: window.__hp814.look().index === fresh.index };
  };
  await window.__hpTest.setMode('plan');
  await window.__hpTest.switchSpace('f1');
  await window.__hpTest.setTool('resize');
});
/** One held gesture: its union count, accepted steps and live areas. */
const heldGesture = async (handle, end, during) => {
  const before = await page.evaluate(() => ({ unions: window.__hp814.unions(), epoch: window.__card._cfgEpoch }));
  const dragged = await dragHandle({ ...handle, end: 'hold' });
  if (during) await during();
  const held = await page.evaluate(async (before) => ({
    unions: window.__hp814.unions() - before.unions,
    steps: window.__card._cfgEpoch - before.epoch,
    areas: await window.__hp814.liveAreasAgainstFresh(),
  }), before);
  if (held.areas.error) console.log('diagnostic rejected Resize ' + JSON.stringify(await page.evaluate(() => ({
    toast: window.__card._toast, dragging: window.__card._resize.dragging,
    rooms: window.__card._spaceModel()?.rooms.map(room => ({ id: room.id, poly: room.poly, wall_ids: room.wall_ids })),
  }))));
  if (end === 'escape') await page.keyboard.press('Escape');
  await page.mouse.up();
  await page.evaluate(() => window.__hp814.settled());
  const cleared = await page.evaluate(() => window.__card._editorRuntime.rszBodiesUnion.last === null);
  return { dragged, ...held, cleared };
};
const f1Wall = { x: 500, y: 325, toX: 440, steps: 3 };
const gardenWall = { x: 500, y: 500, toX: 440, steps: 3 };
// Plan mode draws neither the wedges nor the tunnels: the fresh card's View does.
const planFresh = () => page.evaluate(async () => (await window.__hp814.sameAsFresh())
  .filter((key) => key !== 'sun' && key !== 'tunnels'));
const ac3 = {};
ac3.cancelledGesture = await heldGesture(f1Wall, 'escape');
await page.evaluate(async () => {
  await window.__hpTest.switchSpace('garden');
  await window.__hpTest.setTool('resize');
});
ac3.otherFloorGesture = await heldGesture(gardenWall, 'escape');
// A server push mid-drag that changes the cell size (so the bodies) ends the
// gesture and drops its union; the next gesture unites the new bodies.
ac3.serverPushMidDrag = {};
await dragHandle({ ...gardenWall, end: 'hold' });
Object.assign(ac3.serverPushMidDrag, await page.evaluate(async () => {
  const card = window.__card;
  const held = card._resize.dragging && card._editorRuntime.rszBodiesUnion.last !== null;
  await window.__hpTest.setServerConfig((cfg) => {
    cfg.spaces.find((space) => space.id === 'garden').cell_cm = 10;
    return cfg;
  });
  return { held, endsTheGesture: !card._resize.dragging, dropsTheUnion: card._editorRuntime.rszBodiesUnion.last === null };
}));
await page.mouse.up();
await page.evaluate(() => window.__hp814.settled());
ac3.gestureAfterServerPush = await heldGesture(gardenWall, 'escape');
// ---- AC1: a Resize commit whose WS write is held, then rejected --------------
// Every config write is parked in a page slot (`held`) until the smoke rejects
// or releases it. Node waits for the slot with waitForFunction, not inside one
// evaluate: a slow runner spends seconds in the debounce and the write's own
// physical recheck. No parked write is a failed check with its diagnostics.
await page.evaluate(async () => {
  const card = window.__card;
  const base = card.hass;
  const held = [];
  const holding = { ...base, callWS: (message) => (message.type !== 'houseplan/config/set' ? base.callWS(message)
    : new Promise((resolve, reject) => held.push({ resolve: () => resolve(base.callWS(message)), reject }))) };
  Object.assign(window.__hp814, { held, holding });
  card.hass = holding;
  await window.__hpTest.setMode('view');
  await window.__hpTest.switchSpace('f1');
  window.__hp814.ac1Before = window.__hp814.look();
  await window.__hpTest.setMode('plan');
  await window.__hpTest.setTool('resize');
  window.__hp814.ac1Rev = card._cfgRev;
  window.__hp814.ac1History = card._geometryHistory.size;
  window.__hp814.ac1Room = JSON.stringify(card._serverCfg.spaces.find((space) => space.id === 'f1').rooms[0].poly);
});
ac1.heldCommitDragged = await dragHandle({ x: 500, y: 325, toX: 450 });
const writeHeld = await page.waitForFunction(() => window.__hp814.held.length > 0, null, { timeout: 15000 })
  .then(() => true, () => false);
const heldState = await page.evaluate(() => {
  const card = window.__card;
  const room = JSON.stringify(card._serverCfg.spaces.find((space) => space.id === 'f1').rooms[0].poly);
  return {
    writes: window.__hp814.held.length, revUnchanged: card._cfgRev === window.__hp814.ac1Rev,
    committed: room !== window.__hp814.ac1Room, history: card._geometryHistory.size - window.__hp814.ac1History,
    writesPending: card._writesPending, debouncePending: card._saveConfigDebounced.pending(),
    hassReplaced: card.hass !== window.__hp814.holding, dragging: card._resize.dragging, toast: card._toast || null,
  };
});
ac1.theWriteIsHeld = writeHeld && heldState.writes === 1 && heldState.revUnchanged ? true : heldState;
if (ac1.theWriteIsHeld !== true) console.log(`diagnostic ac1 held write: ${JSON.stringify(heldState)}`);
if (writeHeld) {
  Object.assign(ac1, await page.evaluate(async () => {
    const { look, sameAsFresh, held } = window.__hp814;
    await window.__hpTest.setMode('view');
    const local = look();
    window.__hp814.ac1Local = local;
    const out = {
      beforeTheAckTheCommitIsShown: local.index !== window.__hp814.ac1Before.index,
      beforeTheAckItIsTheFreshCards: await sameAsFresh(),
    };
    // The server rejects the write: the card rolls the geometry back.
    held.shift().reject(Object.assign(new Error('rejected by the smoke'), { code: 'invalid' }));
    return out;
  }));
  ac1.theRejectedWriteSettles = await page.waitForFunction(() => window.__card._writesPending === 0
    && !window.__card._saveConfigDebounced.pending(), null, { timeout: 15000 }).then(() => true, () => false);
  Object.assign(ac1, await page.evaluate(async () => {
    const { look, sameAsFresh, settled } = window.__hp814;
    await settled();
    await settled();
    const restored = look();
    return {
      theRejectionRestoresTheGeometry: restored.index === window.__hp814.ac1Before.index
        && restored.sun === window.__hp814.ac1Before.sun,
      afterTheRejectionItIsTheFreshCards: await sameAsFresh(),
    };
  }));
} else {
  Object.assign(ac1, {
    beforeTheAckTheCommitIsShown: false, beforeTheAckItIsTheFreshCards: ['no held write'],
    theRejectedWriteSettles: false, theRejectionRestoresTheGeometry: false,
    afterTheRejectionItIsTheFreshCards: ['no held write'],
  });
}
// Release whatever is still parked and stop holding: the rest of the smoke writes normally.
await page.evaluate(async () => {
  const card = window.__card;
  for (const write of window.__hp814.held.splice(0)) write.resolve();
  card.hass = { ...window.__mkHass(), states: { ...card.hass.states } };
  await window.__hp814.settled();
});

checkAll(ac1, {
  fixtureIsTheFreshCards: [],
  haUpdateBuildsNothing: { openingWallIndex: 0, sunRays: 0, openingTunnel: 0, physicalBodies: 0 },
  foreignFloorPushBuildsNothing: { openingWallIndex: 0, sunRays: 0, openingTunnel: 0, physicalBodies: 0 },
  sharedSettingBuildsNothing: { openingWallIndex: 0, sunRays: 0, openingTunnel: 0, physicalBodies: 0 },
  stillTheFreshCards: [],
  inPlaceMoveRebuildsTheWedgesOnce: 1,
  inPlaceMoveIsTheFreshCards: [],
  beforeTheAckItIsTheFreshCards: [],
  afterTheRejectionItIsTheFreshCards: [],
});

await page.evaluate(async () => {
  await window.__hpTest.setMode('plan');
  await window.__hpTest.switchSpace('f1');
  await window.__hpTest.setTool('resize');
});
ac3.committedGesture = await heldGesture(f1Wall, 'up');
ac3.committedIsTheFreshCards = await planFresh();
const wallAt = (x) => page.evaluate((x) => [...window.__card.renderRoot.querySelectorAll('.rszhandle:not(.rszcorner)')]
  .some((node) => Math.abs(Number(node.getAttribute('cx')) - x) < 0.5 && Math.abs(Number(node.getAttribute('cy')) - 325) < 0.5), x);
ac3.commitMovesTheWall = !(await wallAt(500));
await page.keyboard.press('Control+z');
await page.evaluate(() => window.__hp814.settled());
ac3.undoRestoresTheWall = await wallAt(500);
ac3.undoIsTheFreshCards = await planFresh();
ac3.gestureAfterUndo = await heldGesture(f1Wall, 'escape');
await page.keyboard.press('Control+y');
await page.evaluate(() => window.__hp814.settled());
ac3.redoMovesTheWallAgain = !(await wallAt(500));
ac3.redoIsTheFreshCards = await planFresh();
const gesture = (dragged, unions, extra = {}) => ({
  dragged, unions, steps: true, areas: { rooms: 2, wrong: [], ready: true, index: true }, cleared: true, ...extra,
});
for (const name of ['cancelledGesture', 'committedGesture', 'gestureAfterUndo', 'otherFloorGesture', 'gestureAfterServerPush'])
  ac3[name] = { ...ac3[name], steps: ac3[name].steps >= 2 };
checkAll(ac3, {
  cancelledGesture: gesture(true, 1),
  committedGesture: gesture(true, 1),
  committedIsTheFreshCards: [],
  undoIsTheFreshCards: [],
  gestureAfterUndo: gesture(true, 1),
  redoIsTheFreshCards: [],
  otherFloorGesture: gesture(true, 1),
  serverPushMidDrag: { held: true, endsTheGesture: true, dropsTheUnion: true },
  gestureAfterServerPush: gesture(true, 1),
});

// ======================= AC7: lifecycle ======================================
const ac7 = await page.evaluate(async () => {
  const hp = window.__hpTest;
  const { sameAsFresh, builds, grew, settled } = window.__hp814;
  const out = {};
  const card = window.__card;
  const pools = (host = card) => [host._physicalBodiesPool.size, host._openingTunnelPool.size];
  await hp.setMode('view');
  await hp.switchSpace('f1');
  // Config replacement: a pushed f1 partition replaces the shown bodies.
  await hp.setServerConfig((cfg) => {
    cfg.spaces.find((space) => space.id === 'f1').partitions[0].b = [0.85, 0.62];
    return cfg;
  });
  out.replacementIsTheFreshCards = await sameAsFresh();
  out.replacementPoolsWithinEight = pools().every((size) => size <= 8);
  // A mode change and back: nothing rebuilt, nothing stale.
  const beforeModes = builds();
  await hp.setMode('plan');
  await hp.setMode('view');
  out.modeRoundTripBuildsNoBodiesOrTunnels = grew(beforeModes, builds(), ['physicalBodies', 'openingTunnel']);
  out.modeRoundTripIsTheFreshCards = await sameAsFresh();
  // Disconnect and reconnect: the same instance, warm and current; then a push.
  const parent = card.parentNode;
  const beforeReconnect = builds();
  card.remove();
  await settled();
  parent.appendChild(card);
  await settled();
  out.reconnectBuildsNoBodiesOrTunnels = grew(beforeReconnect, builds(), ['physicalBodies', 'openingTunnel']);
  out.reconnectIsTheFreshCards = await sameAsFresh();
  await hp.setServerConfig((cfg) => {
    cfg.spaces.find((space) => space.id === 'f1').partitions[0].a = [0.62, 0.62];
    return cfg;
  });
  out.pushAfterReconnectIsTheFreshCards = await sameAsFresh();
  out.reconnectPoolsWithinEight = pools().every((size) => size <= 8);
  // A warm remount: Lovelace replaces the element in the same slot.
  const config = { type: 'custom:houseplan-card', title: 'House Plan', icon_size: 3.4 };
  const hass = card.hass;
  const oldPools = [card._physicalBodiesPool, card._openingTunnelPool];
  card.remove();
  const next = document.createElement('houseplan-card');
  next.setConfig(config);
  next.hass = hass;
  parent.appendChild(next);
  window.__card = next;
  window.__hp814.oldPools = oldPools;
  return out;
});
// The remounted card boots on its own clock: poll it from Node.
ac7.remountBoots = await page.waitForFunction(() => {
  const card = window.__card;
  return card._loadOk && card._booting === false && !!card._spaceModel();
}, null, { timeout: 15000 }).then(() => true, () => false);
Object.assign(ac7, await page.evaluate(async () => {
  const card = window.__card;
  const { sameAsFresh, settled } = window.__hp814;
  const [bodies, tunnels] = window.__hp814.oldPools;
  await settled();
  return {
    remountHasItsOwnBoundedPools: card._physicalBodiesPool !== bodies && card._openingTunnelPool !== tunnels
      && card._physicalBodiesPool.size <= 8 && card._openingTunnelPool.size <= 8,
    remountIsTheFreshCards: await sameAsFresh(),
  };
}));
checkAll(ac7, {
  replacementIsTheFreshCards: [],
  modeRoundTripBuildsNoBodiesOrTunnels: { physicalBodies: 0, openingTunnel: 0 },
  modeRoundTripIsTheFreshCards: [],
  reconnectBuildsNoBodiesOrTunnels: { physicalBodies: 0, openingTunnel: 0 },
  reconnectIsTheFreshCards: [],
  pushAfterReconnectIsTheFreshCards: [],
  remountIsTheFreshCards: [],
});

await finish(browser, { ac1, ac2, ac3, ac7 });
