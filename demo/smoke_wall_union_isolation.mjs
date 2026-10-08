/** #278/#834: repaired historical masonry renders everywhere; genuinely
 * unbuildable physical candidates still roll back without writes/history. */
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
  out.historicalUnionRepaired = canonical?.status === 'ok' && canonical.components.length === 1;
  out.planRendersCompleteMasonry = root().querySelectorAll('.wallbody[data-component]').length === 1
    && root().querySelectorAll('.wallbody-fill[data-component]').length === 1;
  const masonry = [...root().querySelectorAll('.wallbody[data-component]')];
  out.independentTMaterial = [[-1000, -200], [2000, -200], [287.5, 800]].every(point =>
    masonry.some(path => path.isPointInFill(new DOMPoint(...point))))
    && [[0, 800], [600, 800], [-1700, -200]].every(point =>
      masonry.every(path => !path.isPointInFill(new DOMPoint(...point))));
  const planPaths = [...root().querySelectorAll('.wallbody[data-component]')]
    .map((path) => path.getAttribute('d')).sort();
  const model = card._spaceModel();
  const polys = model.rooms.map((room) => ({ r: room, poly: room.poly }));
  const barriers = card._lightBarriers(model, polys, card._physicalBodiesR(model));
  out.lightUsesCompleteMasonry = barriers.masonryGeometry.length
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
  while (staticCard.renderRoot?.querySelectorAll('.wallbody[data-component]').length !== 1
      && Date.now() - started < 6000) await new Promise((resolve) => setTimeout(resolve, 50));
  await staticCard.updateComplete;
  out.staticMatchesPlan = JSON.stringify([...staticCard.renderRoot.querySelectorAll(
    '.wallbody[data-component]',
  )].map((path) => path.getAttribute('d')).sort()) === JSON.stringify(planPaths);
  staticCard.remove();
  await window.__hpHarnessProjection(card, 'iso');
  await window.__hpEnsureHarnessIsoRuntime(card);
  card.requestUpdate();
  await settle();
  const iso = card._isoSource().build();
  out.hiddenIsoUsesCompleteMasonry = iso.walls.length
    === canonical.components.reduce((sum, component) => sum + component.geom.length, 0)
    && !!root().querySelector('[data-hp="iso-walls"]');
  out.renderNeverWrites = JSON.stringify(card._serverCfg.spaces[0]) === sourceBeforeRender;

  let writes = 0;
  card.hass = { ...card.hass, callWS: async (message) => {
    if (message.type === 'houseplan/config/set') { writes++; return { rev: 9 }; }
    return baseCall(message);
  } };
  await window.__hpHarnessProjection(card, 'flat');
  card._setMode('plan');
  await settle();
  card._geometryHistory.clear();
  const before = card._geometrySnapshot();
  const beforeJson = JSON.stringify(before);
  // private-ok: a deliberate non-finite physical candidate is unavailable via
  // UI; exercise real preparation/rollback, not a mocked validation result.
  card._curSpaceCfg.wall_columns = [{ id: 'deliberately-unbuildable', shape: 'rect',
    center: [NaN, 0], cm: 30, angle: 0 }];
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
