/** Issue #141: joined independent walls share one production geometry surface. */
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1000, height: 860 }, 1);

const out = await page.evaluate(async () => {
  const result = {};
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const update = async () => {
    card._cfgEpoch++;
    card._modelCache = null;
    card._frame = null;
    card._wallUnionCache = null;
    card._lightBarrierCache = null;
    card.requestUpdate();
    await card.updateComplete;
  };
  const entry = (a, b, cm) => ({
    // The smoke needs an exact persisted span; the renderer resolves the key
    // from these endpoints before it falls back to the legacy bucket.
    key: `smoke-${a.join('-')}-${b.join('-')}`, a: [...a], b: [...b], cm,
  });
  const a = [0.05, 0.05], tr = [0.95, 0.05], br = [0.95, 0.95], bl = [0.05, 0.95];
  const cfg = {
    spaces: [{
      id: 'junctions', title: 'Junctions', cell_cm: 5, view_box: [0, 0, 1, 1],
      rooms: [{ id: 'room', name: 'Room', area: null, poly: [a, tr, br, bl] }],
      walls: [entry(a, tr, 0), entry(tr, br, 0), entry(br, bl, 0), entry(bl, a, 0)],
      partitions: [
        { id: 'l-horizontal', a: [0.10, 0.30], b: [0.40, 0.30], cm: 10 },
        { id: 'l-vertical', a: [0.40, 0.30], b: [0.40, 0.60], cm: 20 },
        { id: 'oblique-a', a: [0.58, 0.22], b: [0.76, 0.38], cm: 22 },
        { id: 'oblique-b', a: [0.76, 0.38], b: [0.62, 0.53], cm: 12 },
        { id: 't-through', a: [0.18, 0.70], b: [0.78, 0.70], cm: 24 },
        { id: 't-branch', a: [0.50, 0.54], b: [0.50, 0.70], cm: 16 },
        { id: 'room-branch', a: [0.30, 0.82], b: [0.30, 0.95], cm: 18 },
      ],
      room_drafts: [{
        id: 'saved-draft', points: [[0.12, 0.56], [0.28, 0.56], [0.28, 0.64]],
        segments: [{ cm: 12 }, { cm: 18 }],
      }],
      wall_columns: [],
    }],
    markers: [], settings: {},
  };
  card._serverCfg = structuredClone(cfg);
  card._layout = {};
  card._space = 'junctions';
  card._setMode('plan');
  card._tool = 'select';
  await update();

  const sourceBefore = JSON.stringify(card._serverCfg.spaces[0]);
  const space = card._spaceModel();
  const bodies = card._physicalBodiesR(space);
  const raw = card._rawPhysicalBodiesR(space);
  const frame = card._physicalBodiesCache;
  result.computedPatchesExist = frame?.patches.length >= 4 && bodies.length > raw.length;
  result.rawIdentityCountStaysPerSegment = raw.length === 9
    && card._curSpaceCfg.partitions.length === 7
    && card._curSpaceCfg.room_drafts[0].segments.length === 2;

  const wallBody = root().querySelector('.wallbody');
  const missingCorner = new DOMPoint(404, 298);
  result.savedRightAngleToothIsFilled = !!wallBody?.isPointInFill(missingCorner);
  const planD = wallBody?.getAttribute('d') || '';

  const insideRing = (point, ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a0 = ring[i], b0 = ring[j];
      const crosses = ((a0[1] > point[1]) !== (b0[1] > point[1]))
        && point[0] < ((b0[0] - a0[0]) * (point[1] - a0[1]))
          / ((b0[1] - a0[1]) || 1e-12) + a0[0];
      if (crosses) inside = !inside;
    }
    return inside;
  };
  const insideGeometry = (point, geometry) => (geometry || []).some((polygon) =>
    polygon?.length && insideRing(point, polygon[0])
      && !polygon.slice(1).some((hole) => insideRing(point, hole)));
  const room = space.rooms[0];
  const clean = card._cleanFloor(room, room.poly, space);
  result.cleanFloorUsesJoinedCorner = !insideGeometry([404, 298], clean.geom);
  const light = card._lightBarriers(
    space, [{ r: room, poly: room.poly }], card._physicalBodiesR(space),
  );
  result.lightUsesJoinedCorner = insideGeometry([404, 298], light.masonryGeometry);

  card._tool = 'draw';
  card._activeDraftId = null;
  card._path = [[120, 780], [380, 780]];
  card._draftSegmentCms = [12];
  card._drawWallField = '24';
  card._cursorPt = [380, 600];
  await update();
  const liveD = root().querySelector('.drawwall-preview')?.getAttribute('d') || '';
  card._path = [[120, 780], [380, 780], [380, 600]];
  card._draftSegmentCms = [12, 24];
  card._cursorPt = null;
  await update();
  const committedPreviewD = root().querySelector('.drawwall-preview')?.getAttribute('d') || '';
  result.rubberBandAndCommittedPreviewMatch = !!liveD && committedPreviewD === liveD;

  card._path = [[500, 540]];
  card._draftSegmentCms = [];
  card._drawWallField = '20';
  card._cursorPt = [500, 700];
  await update();
  result.lineTargetGetsLocalJoinPatch = root().querySelectorAll('.drawwall-preview').length === 2;
  result.previewDoesNotWriteOrSplitTarget = JSON.stringify(card._serverCfg.spaces[0]) === sourceBefore;

  card._cursorPt = null;
  card._path = [];
  card._tool = 'select';
  card._setMode('view');
  await update();
  result.planViewParity = !!planD && root().querySelector('.wallbody')?.getAttribute('d') === planD;

  history.replaceState(null, '', '?hp_alpha=1#space=junctions');
  dispatchEvent(new HashChangeEvent('hashchange'));
  await card.updateComplete;
  card._setProjection('iso');
  await update();
  result.isoUsesJoinedFootprint = !!root().querySelector('.iso-walls .iso-wall-top')
    && card._isoSource().build().walls.flat(2).length > 0;
  card._setProjection('flat');
  await update();

  await customElements.whenDefined('houseplan-space-card');
  const staticCard = document.createElement('houseplan-space-card');
  const baseCall = card.hass.callWS.bind(card.hass);
  staticCard.setConfig({ type: 'custom:houseplan-space-card', space: 'junctions', show_button: false });
  staticCard.hass = { ...card.hass, callWS: async (message) => {
    if (message.type === 'houseplan/config/get') return { config: structuredClone(cfg), rev: 1 };
    if (message.type === 'houseplan/layout/get') return { layout: {}, rev: 1 };
    return baseCall(message);
  } };
  document.body.appendChild(staticCard);
  const started = Date.now();
  while (!staticCard.renderRoot?.querySelector('.wallbody') && Date.now() - started < 6000)
    await new Promise((resolve) => setTimeout(resolve, 60));
  await staticCard.updateComplete;
  result.staticUsesSameJoinedPath = staticCard.renderRoot
    ?.querySelector('.wallbody')?.getAttribute('d') === planD;
  staticCard.remove();

  result.renderNeverRewritesConfig = JSON.stringify(card._serverCfg.spaces[0]) === sourceBefore;
  return result;
});

await finish(browser, checkAll(out));
