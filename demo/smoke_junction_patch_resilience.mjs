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
  const svgContains = (element, point = retainedWedgeProbe) =>
    !!element?.isPointInFill?.(new DOMPoint(point[0], point[1]));
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
  out.paperRetainsMeasuredWedge = [...root().querySelectorAll('.hp-paper')]
    .some((paper) => svgContains(paper));

  const model = card._spaceModel();
  const polys = model.rooms.map((room) => ({ r: room, poly: room.poly }));
  const barriers = card._lightBarriers(model, polys, card._physicalBodiesR(model));
  out.lightAndSunKeepCanonicalMasonry = barriers.masonryGeometry.flat(2).length > 0
    && barriers.occluders.length > 0
    && !!barriers.fingerprint;
  out.lightAndSunRetainMeasuredWedge = geometryContains(barriers.masonryGeometry);
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
  card._hoverRoom = { space: spaceFixture.id, room: model.rooms[0] };
  const hoverFloor = card._roomHoverPaths(model);
  out.cleanFloorConsumerStaysNonEmpty = !!hoverFloor?.fillD && !!hoverFloor.outlineD;
  out.cleanFloorExcludesMeasuredWedge = model.rooms.every((room) => {
    card._hoverRoom = { space: spaceFixture.id, room };
    const floor = card._roomHoverPaths(model);
    if (!floor?.fillD) return true;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', floor.fillD);
    path.setAttribute('fill-rule', 'evenodd');
    return !svgContains(path);
  });
  card._hoverRoom = null;

  const kioskBefore = card._config.kiosk;
  card._config.kiosk = true;
  await update(false);
  out.kioskMatchesPlan = root().querySelector('[data-hp="wall"]')?.getAttribute('d') === planD;
  out.kioskRetainsMeasuredWedge = svgContains(root().querySelector('[data-hp="wall"]'));
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

  out.renderNeverWritesConfig = JSON.stringify(card._serverCfg.spaces[0]) === sourceBefore;
  return out;
}, fixture);

checkAll(result);
await finish(browser, result);
