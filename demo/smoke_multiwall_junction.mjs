/** Issue #249: one bounded degree-3 junction across every canonical consumer. */
import { readFileSync } from 'node:fs';
import { launch, checkAll, finish } from './serve.mjs';

const fixture = JSON.parse(readFileSync(
  new URL('../test/fixtures/249-multiwall-junction.json', import.meta.url), 'utf8',
));
const { page, browser } = await launch({ width: 1000, height: 860 }, 1);

const result = await page.evaluate(async (source) => {
  const out = {};
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const frame = () => new Promise((done) =>
    requestAnimationFrame(() => requestAnimationFrame(done)));
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

  const space = {
    id: 'issue-249',
    title: 'Issue 249',
    cell_cm: source.cell_cm,
    view_box: [0.27, 0.07, 0.2, 0.21],
    rooms: structuredClone(source.rooms),
    walls: structuredClone(source.walls),
    settings: { show_borders: true, fill_mode: 'none' },
  };
  const cfg = {
    ...structuredClone(card._serverCfg),
    spaces: [space],
    markers: [],
  };
  card._serverCfg = structuredClone(cfg);
  card._layout = {};
  card._space = space.id;
  card._setMode('plan');
  card._tool = 'select';
  await update(true);

  const persisted = JSON.stringify(card._serverCfg.spaces[0]);
  const path = root().querySelector('[data-hp="wall"]');
  const planD = path?.getAttribute('d') || '';
  const canonical = card._wallUnionGeometry();
  const node = new DOMPoint(source.node[0] * 1000, source.node[1] * 1000);
  // Midpoint between the approved bevel and the old 1.80×H mitre.
  const discardedWedge = new DOMPoint(330.0011713041353, 146.99331561935776);
  out.fixtureLoaded = card._spaceModel()?.rooms.length === 2
    && card._spaceWalls.length === 7;
  out.planUsesCanonicalPath = !!planD && canonical?.d === planD;
  out.nodeRemainsFilled = !!path?.isPointInFill(node);
  out.excessWedgeIsEmpty = path && !path.isPointInFill(discardedWedge);
  out.paperRemainsSolid = !!canonical?.paperD
    && !!root().querySelector('.hp-paper');

  const model = card._spaceModel();
  const polys = model.rooms.map((room) => ({ r: room, poly: room.poly }));
  const barriers = card._lightBarriers(model, polys, card._physicalBodiesR(model));
  out.lightUsesSameMasonry = barriers.masonryGeometry.flat(2).length > 0
    && barriers.occluders.length > 0
    && !!barriers.fingerprint;
  const barrierFingerprint = barriers.fingerprint;
  const wallCache = card._wallUnionCache;

  card.hass = {
    ...card.hass,
    themes: { ...(card.hass.themes || {}), darkMode: !card.hass.themes?.darkMode },
    states: {
      ...card.hass.states,
      'sensor.issue_249_tick': {
        entity_id: 'sensor.issue_249_tick', state: '1', attributes: {},
      },
    },
  };
  await update(false);
  out.stateTickKeepsPath = root().querySelector('[data-hp="wall"]')
    ?.getAttribute('d') === planD;
  out.stateTickReusesWallGeometry = card._wallUnionCache === wallCache;
  out.stateTickReusesLightGeometry = card._lightBarriers(
    model, polys, card._physicalBodiesR(model),
  ).fingerprint === barrierFingerprint;

  card._setMode('view');
  await update(false);
  out.viewMatchesPlan = root().querySelector('[data-hp="wall"]')
    ?.getAttribute('d') === planD;
  card._hoverRoom = { space: space.id, room: model.rooms[0] };
  const hover = card._roomHoverPaths(model);
  out.cleanFloorConsumerIsPresent = !!hover?.fillD && !!hover.outlineD;
  card._hoverRoom = null;

  const kioskBefore = card._config.kiosk;
  card._config.kiosk = true;
  await update(false);
  out.kioskMatchesPlan = root().querySelector('[data-hp="wall"]')
    ?.getAttribute('d') === planD;
  card._config.kiosk = kioskBefore;
  await update(false);

  await customElements.whenDefined('houseplan-space-card');
  const staticCard = document.createElement('houseplan-space-card');
  const baseCall = card.hass.callWS.bind(card.hass);
  staticCard.setConfig({
    type: 'custom:houseplan-space-card', space: space.id, show_button: false,
  });
  staticCard.hass = { ...card.hass, callWS: async (message) => {
    if (message.type === 'houseplan/config/get') {
      return { config: structuredClone(cfg), rev: 1 };
    }
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
  staticCard.remove();

  const labs = Object.freeze(['iso']);
  card._onLabsSnapshot({ active: labs, space: '' });
  window.__hpLabs = labs;
  card._setProjection('iso');
  await update(false);
  out.hiddenIsoUsesMasonry = !!root().querySelector('[data-hp="iso-walls"]')
    && card._isoSource().build().walls.flat(2).length > 0;
  out.renderNeverWritesConfig = JSON.stringify(card._serverCfg.spaces[0]) === persisted;
  return out;
}, fixture);

checkAll(result);
await finish(browser, result);
