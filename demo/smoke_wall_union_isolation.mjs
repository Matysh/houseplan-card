/** #278: degraded canonical components render everywhere; strict writes do not persist. */
import { readFileSync } from 'node:fs';
import { launch, checkAll, finish } from './serve.mjs';

const fixture = JSON.parse(readFileSync(
  new URL('../test/fixtures/278-wall-union-isolation.json', import.meta.url), 'utf8',
));
const { page, browser } = await launch({ width: 1000, height: 780 }, 1);

const result = await page.evaluate(async (fixtureConfig) => {
  const out = {};
  const card = window.__card;
  const root = () => card.renderRoot || card.shadowRoot;
  const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const settle = async () => { await card.updateComplete; await frame(); };
  const cfg = structuredClone(fixtureConfig);
  cfg.spaces[0].settings = {
    ...(cfg.spaces[0].settings || {}), show_borders: true, fill_mode: 'none',
  };
  card._serverCfg = cfg;
  card._layout = {};
  card._space = cfg.spaces[0].id;
  card._cfgEpoch++;
  card._modelCache = null;
  card._frame = null;
  card._wallUnionCache = null;
  card._physicalBodiesCache = null;
  card._lightBarrierCache = null;
  card._setMode('plan');
  card._tool = 'select';
  card.requestUpdate();
  await settle();

  const sourceBeforeRender = JSON.stringify(card._serverCfg.spaces[0]);
  const canonical = card._wallUnionGeometry();
  out.typedDegradedResult = canonical?.status === 'degraded-extra';
  out.planRendersBothComponents = root().querySelectorAll('.wallbody[data-component]').length === 2
    && root().querySelectorAll('.wallbody-fill[data-component]').length === 2;
  const planPaths = [...root().querySelectorAll('.wallbody[data-component]')]
    .map((path) => path.getAttribute('d')).sort();
  const model = card._spaceModel();
  const polys = model.rooms.map((room) => ({ r: room, poly: room.poly }));
  const barriers = card._lightBarriers(model, polys, card._physicalBodiesR(model));
  out.lightUsesBothComponents = barriers.masonryGeometry.length
    === canonical.components.reduce((sum, component) => sum + component.geom.length, 0)
    && barriers.occluders.length > 0;

  card._setMode('view');
  card.requestUpdate();
  await settle();
  out.viewMatchesPlan = JSON.stringify([...root().querySelectorAll('.wallbody[data-component]')]
    .map((path) => path.getAttribute('d')).sort()) === JSON.stringify(planPaths);

  await customElements.whenDefined('houseplan-space-card');
  const staticCard = document.createElement('houseplan-space-card');
  staticCard.setConfig({
    type: 'custom:houseplan-space-card', space: cfg.spaces[0].id, show_button: false,
  });
  const baseCall = card.hass.callWS.bind(card.hass);
  staticCard.hass = { ...card.hass, callWS: async (message) => {
    if (message.type === 'houseplan/config/get') return { config: structuredClone(cfg), rev: 1 };
    if (message.type === 'houseplan/layout/get') return { layout: {}, rev: 1 };
    return baseCall(message);
  } };
  document.body.appendChild(staticCard);
  const started = Date.now();
  while (staticCard.renderRoot?.querySelectorAll('.wallbody[data-component]').length !== 2
      && Date.now() - started < 6000) await new Promise((resolve) => setTimeout(resolve, 50));
  await staticCard.updateComplete;
  out.staticMatchesPlan = JSON.stringify([...staticCard.renderRoot.querySelectorAll(
    '.wallbody[data-component]',
  )].map((path) => path.getAttribute('d')).sort()) === JSON.stringify(planPaths);
  staticCard.remove();

  const labs = Object.freeze(['iso']);
  card._onLabsSnapshot({ alpha: true, active: labs, space: '' });
  window.__hpAlpha = true;
  window.__hpLabs = labs;
  card._setProjection('iso');
  card.requestUpdate();
  await settle();
  const iso = card._isoSource().build();
  out.hiddenIsoUsesBothComponents = iso.walls.length
    === canonical.components.reduce((sum, component) => sum + component.geom.length, 0)
    && !!root().querySelector('[data-hp="iso-walls"]');
  out.renderNeverWrites = JSON.stringify(card._serverCfg.spaces[0]) === sourceBeforeRender;

  let writes = 0;
  card.hass = { ...card.hass, callWS: async (message) => {
    if (message.type === 'houseplan/config/set') { writes++; return { rev: 9 }; }
    return baseCall(message);
  } };
  card._setProjection('flat');
  card._setMode('plan');
  await settle();
  card._geometryHistory.clear();
  const before = card._geometrySnapshot();
  const beforeJson = JSON.stringify(before);
  card._curSpaceCfg.walls[0].cm += 1;
  const committed = card._commitPhysicalGeometry('unsafe test', before);
  await settle();
  out.degradedPhysicalEditRejected = committed === false
    && JSON.stringify(card._geometrySnapshot()) === beforeJson;
  out.rejectedEditHasNoHistoryOrWrite = card._geometryHistory.size === 0 && writes === 0;
  out.rejectedEditHasLocalizedToast = card._toast === card._t('toast.geometry_unsafe');

  let strictChecks = 0;
  const strictCheck = card._checkSpacePhysicalGeometry.bind(card);
  card._checkSpacePhysicalGeometry = (...args) => { strictChecks++; return strictCheck(...args); };
  card._curSpaceCfg.title = 'Non geometry edit';
  card._saveConfig();
  await new Promise((resolve) => setTimeout(resolve, 700));
  out.nonGeometryEditBypassesStrictBarrier = strictChecks === 0 && writes === 1;
  card._checkSpacePhysicalGeometry = strictCheck;
  return out;
}, fixture.config);

checkAll(result);
await finish(browser, result);
