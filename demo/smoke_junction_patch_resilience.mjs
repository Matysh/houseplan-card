/** Issue #197: one noisy virtual-junction patch never blanks canonical masonry. */
import { readFileSync } from 'node:fs';
import { launch, checkAll, finish } from './serve.mjs';

const fixture = JSON.parse(readFileSync(
  new URL('../test/fixtures/197-junction-patch.json', import.meta.url), 'utf8',
));
const { page, browser } = await launch({ width: 1000, height: 860 }, 1);

const result = await page.evaluate(async (spaceFixture) => {
  const out = {};
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const retainedWedgeProbe = [895.5, 556];
  const finiteRayOutsideProbe = [0.420833333 * 1000, 0.37625 * card._spaceH];
  const finiteRayDoorApproachProbe = [0.92 * 1000, 0.348 * card._spaceH];
  const finiteDoorSlotProbe = [0.95 * 1000, 0.345833333 * card._spaceH];
  const svgContains = (element, point = retainedWedgeProbe) =>
    !!element?.isPointInFill?.(new DOMPoint(point[0], point[1]));
  const pathDataContains = (d, point) => {
    const svgRoot = root().querySelector('svg');
    if (!svgRoot || !d) return false;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill-rule', 'evenodd');
    path.setAttribute('visibility', 'hidden');
    svgRoot.append(path);
    const contains = svgContains(path, point);
    path.remove();
    return contains;
  };
  const ringContains = (ring, point) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if (((a[1] > point[1]) !== (b[1] > point[1]))
          && point[0] < ((b[0] - a[0]) * (point[1] - a[1]))
            / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  };
  const geometryContains = (geometry, point = retainedWedgeProbe) =>
    (geometry || []).some((polygon) => ringContains(polygon[0] || [], point)
      && !(polygon.slice(1) || []).some((hole) => ringContains(hole, point)));
  const frame = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  const settle = async () => {
    await card.updateComplete;
    while (card._modeTransitionBusy) await frame();
    await frame();
  };
  const update = async (structural = false) => {
    if (structural) {
      card._cfgEpoch++;
      card._modelCache = null;
      card._frame = null;
      card._wallUnionCache = null;
      card._physicalBodiesCache = null;
      card._lightBarrierCache = null;
      card._isoGeometryCache.clear();
    }
    card.requestUpdate();
    await settle();
  };

  const cfg = {
    ...structuredClone(card._serverCfg),
    spaces: [{
      ...structuredClone(spaceFixture),
      view_box: [0, 0, 1, 1],
      settings: {
        ...(spaceFixture.settings || {}),
        show_borders: true,
        fill_mode: 'none',
      },
    }],
    markers: [],
  };
  card._serverCfg = structuredClone(cfg);
  card._layout = {};
  card._space = spaceFixture.id;
  card._setMode('plan');
  card._tool = 'select';
  await update(true);

  const sourceBefore = JSON.stringify(card._serverCfg.spaces[0]);
  out.fixtureSpaceSelected = card._spaceModel()?.id === spaceFixture.id;
  out.fixtureShapeLoaded = card._spaceModel()?.rooms.length === 8
    && card._spaceWalls.length === 25
    && card._openCuts().length === 3;
  out.planModeSettled = card._mode === 'plan';
  const planPath = root().querySelector('[data-hp="wall"]');
  const planD = planPath?.getAttribute('d') || '';
  const canonical = card._wallUnionGeometry();
  out.planKeepsMasonry = !!planD && !!planPath && canonical?.d === planD;
  out.paperKeepsFootprint = !!canonical?.paperD && !!root().querySelector('.hp-paper');
  out.planRetainsMeasuredWedge = svgContains(planPath);
  out.planStopsAtFiniteRayEndpoint = !svgContains(planPath, finiteRayOutsideProbe);
  out.planStopsAtLateralFiniteRayProbe = !svgContains(planPath, finiteRayDoorApproachProbe);
  out.paperRetainsMeasuredWedge = [...root().querySelectorAll('.hp-paper')]
    .some((paper) => svgContains(paper));

  const model = card._spaceModel();
  const polys = model.rooms.map((room) => ({ r: room, poly: room.poly }));
  const barriers = card._lightBarriers(model, polys, card._physicalBodiesR(model));
  out.lightAndSunKeepCanonicalMasonry = barriers.masonryGeometry.flat(2).length > 0
    && barriers.occluders.length > 0
    && !!barriers.fingerprint;
  out.lightAndSunRetainMeasuredWedge = geometryContains(barriers.masonryGeometry);
  out.lightAndSunStopAtFiniteRayEndpoint = !geometryContains(
    barriers.masonryGeometry, finiteRayOutsideProbe,
  );
  out.lightAndSunStopAtLateralFiniteRayProbe = !geometryContains(
    barriers.masonryGeometry, finiteRayDoorApproachProbe,
  );
  const barrierFingerprint = barriers.fingerprint;
  const cacheBeforeState = card._wallUnionCache;

  card.hass = {
    ...card.hass,
    themes: { ...(card.hass.themes || {}), darkMode: !card.hass.themes?.darkMode },
    states: {
      ...card.hass.states,
      'sensor.issue_197_tick': {
        entity_id: 'sensor.issue_197_tick', state: '1', attributes: {},
      },
    },
  };
  await update(false);
  out.themeAndStateKeepPath = root().querySelector('[data-hp="wall"]')?.getAttribute('d') === planD;
  out.stateTickReusesGeometry = card._wallUnionCache === cacheBeforeState;
  out.stateTickKeepsBarrierFingerprint = card._lightBarriers(
    model, polys, card._physicalBodiesR(model),
  ).fingerprint === barrierFingerprint;

  card._setMode('view');
  await update(false);
  out.viewMatchesPlan = root().querySelector('[data-hp="wall"]')?.getAttribute('d') === planD;
  out.viewRetainsMeasuredWedge = svgContains(root().querySelector('[data-hp="wall"]'));
  out.viewStopsAtFiniteRayEndpoint = !svgContains(
    root().querySelector('[data-hp="wall"]'), finiteRayOutsideProbe,
  );
  out.viewStopsAtLateralFiniteRayProbe = !svgContains(
    root().querySelector('[data-hp="wall"]'), finiteRayDoorApproachProbe,
  );
  card._hoverRoom = { space: spaceFixture.id, room: model.rooms[0] };
  const hoverFloor = card._roomHoverPaths(model);
  out.cleanFloorConsumerStaysNonEmpty = !!hoverFloor?.fillD && !!hoverFloor.outlineD;
  out.cleanFloorExcludesMeasuredWedge = model.rooms.every((room) => {
    card._hoverRoom = { space: spaceFixture.id, room };
    const floor = card._roomHoverPaths(model);
    if (!floor?.fillD) return true;
    return !pathDataContains(floor.fillD, retainedWedgeProbe);
  });
  out.cleanFloorOwnsAreaAfterFiniteEndpoint = model.rooms.some((room) => {
    card._hoverRoom = { space: spaceFixture.id, room };
    const floor = card._roomHoverPaths(model);
    if (!floor?.fillD) return false;
    return pathDataContains(floor.fillD, finiteRayOutsideProbe);
  });
  out.cleanFloorOwnsFiniteDoorApproach = model.rooms.some((room) => {
    card._hoverRoom = { space: spaceFixture.id, room };
    const floor = card._roomHoverPaths(model);
    return !!floor?.fillD && pathDataContains(floor.fillD, finiteRayDoorApproachProbe);
  });
  card._hoverRoom = null;

  const kioskBefore = card._config.kiosk;
  card._config.kiosk = true;
  await update(false);
  out.kioskMatchesPlan = root().querySelector('[data-hp="wall"]')?.getAttribute('d') === planD;
  out.kioskRetainsMeasuredWedge = svgContains(root().querySelector('[data-hp="wall"]'));
  out.kioskStopsAtFiniteRayEndpoint = !svgContains(
    root().querySelector('[data-hp="wall"]'), finiteRayOutsideProbe,
  );
  out.kioskStopsAtLateralFiniteRayProbe = !svgContains(
    root().querySelector('[data-hp="wall"]'), finiteRayDoorApproachProbe,
  );
  card._config.kiosk = kioskBefore;
  await update(false);

  await customElements.whenDefined('houseplan-space-card');
  const staticCard = document.createElement('houseplan-space-card');
  const baseCall = card.hass.callWS.bind(card.hass);
  staticCard.setConfig({
    type: 'custom:houseplan-space-card', space: spaceFixture.id, show_button: false,
  });
  staticCard.hass = { ...card.hass, callWS: async (message) => {
    if (message.type === 'houseplan/config/get') return { config: structuredClone(cfg), rev: 1 };
    if (message.type === 'houseplan/layout/get') return { layout: {}, rev: 1 };
    return baseCall(message);
  } };
  document.body.appendChild(staticCard);
  const started = Date.now();
  while (!staticCard.renderRoot?.querySelector('[data-hp="wall"]')
    && Date.now() - started < 6000) {
    await new Promise((done) => setTimeout(done, 60));
  }
  await staticCard.updateComplete;
  out.staticMatchesPlan = staticCard.renderRoot
    ?.querySelector('[data-hp="wall"]')?.getAttribute('d') === planD;
  out.staticRetainsMeasuredWedge = svgContains(
    staticCard.renderRoot?.querySelector('[data-hp="wall"]'),
  );
  out.staticStopsAtFiniteRayEndpoint = !svgContains(
    staticCard.renderRoot?.querySelector('[data-hp="wall"]'), finiteRayOutsideProbe,
  );
  out.staticStopsAtLateralFiniteRayProbe = !svgContains(
    staticCard.renderRoot?.querySelector('[data-hp="wall"]'), finiteRayDoorApproachProbe,
  );
  staticCard.remove();

  const labs = Object.freeze(['iso']);
  card._onLabsSnapshot({ active: labs, space: '' });
  window.__hpLabs = labs;
  card._setProjection('iso');
  await update(false);
  const isoWalls = card._isoSource().build().walls;
  out.hiddenIsoKeepsMasonry = !!root().querySelector('[data-hp="iso-walls"]')
    && isoWalls.flat(2).length > 0;
  out.hiddenIsoRetainsMeasuredWedge = geometryContains(isoWalls);
  out.hiddenIsoStopsAtFiniteRayEndpoint = !geometryContains(
    isoWalls, finiteRayOutsideProbe,
  );
  out.hiddenIsoStopsAtLateralFiniteRayProbe = !geometryContains(
    isoWalls, finiteRayDoorApproachProbe,
  );
  out.renderNeverWritesConfig = JSON.stringify(card._serverCfg.spaces[0]) === sourceBefore;

  // AC4: add an actual door only after the all-surface structural parity pass,
  // so the static-card comparison above remains about one identical model.
  // The door begins after the lateral phantom probe: final masonry must cut
  // its slot, while the light barrier must still be empty before that slot.
  const openingCfg = structuredClone(cfg);
  openingCfg.spaces[0].openings = [{
    id: 'finite-door', type: 'door', x: 0.95, y: 0.345833333,
    angle: 0, length: 0.025,
  }];
  card._serverCfg = openingCfg;
  card._setProjection('flat');
  card._setMode('plan');
  await update(true);
  const openingSource = JSON.stringify(card._serverCfg.spaces[0]);
  const openingPlanPath = root().querySelector('[data-hp="wall"]');
  out.nearDoorPlanStopsAtFiniteRay = !svgContains(
    openingPlanPath, finiteRayDoorApproachProbe,
  );
  out.nearDoorPlanKeepsSlotEmpty = !svgContains(openingPlanPath, finiteDoorSlotProbe);
  out.nearDoorPlanKeepsSymbol = !!root().querySelector('.opening[data-id="finite-door"]');
  const openingModel = card._spaceModel();
  const openingPolys = openingModel.rooms.map((room) => ({ r: room, poly: room.poly }));
  const openingBarriers = card._lightBarriers(openingModel, openingPolys);
  out.nearDoorLightStopsAtFiniteRay = !geometryContains(
    openingBarriers.masonryGeometry, finiteRayDoorApproachProbe,
  );
  card._setMode('view');
  await update(false);
  out.nearDoorViewKeepsSlotEmpty = !svgContains(
    root().querySelector('[data-hp="wall"]'), finiteDoorSlotProbe,
  );
  out.nearDoorViewKeepsSymbol = !!root().querySelector('.opening[data-id="finite-door"]');
  out.nearDoorRenderNeverWritesConfig = JSON.stringify(card._serverCfg.spaces[0]) === openingSource;
  return out;
}, fixture);

checkAll(result);
await finish(browser, result);
