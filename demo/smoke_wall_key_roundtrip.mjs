/** Issue #258: both persisted midpoint keys resolve one lossless T-junction. */
import { readFileSync } from 'node:fs';
import { launch, checkAll, finish } from './serve.mjs';

const fixture = JSON.parse(readFileSync(
  new URL('../test/fixtures/258-wall-key-roundtrip.json', import.meta.url), 'utf8',
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

  for (const [variant, key] of [
    ['canonical', source.canonical_key],
    ['affected', source.affected_key],
  ]) {
    const space = structuredClone(source.space);
    space.walls[0].key = key;
    const cfg = {
      ...structuredClone(card._serverCfg),
      spaces: [space],
      markers: [],
    };
    card._serverCfg = structuredClone(cfg);
    card._layout = {};
    card._space = space.id;
    card._setProjection('flat');
    card._setMode('plan');
    card._tool = 'select';
    await update(true);

    const prefix = `${variant}_`;
    const persisted = JSON.stringify(card._serverCfg.spaces[0]);
    const path = root().querySelector('[data-hp="wall"]');
    const planD = path?.getAttribute('d') || '';
    const canonical = card._wallUnionGeometry();
    const node = new DOMPoint(source.node[0] * 1000, source.node[1] * 1000);
    const verticalArm = new DOMPoint(node.x, node.y - 12);
    out[`${prefix}fixture_loaded`] = card._spaceModel()?.rooms.length === 2
      && card._spaceWalls.length === 2;
    out[`${prefix}plan_uses_canonical_path`] = !!planD && canonical?.d === planD;
    out[`${prefix}node_remains_filled`] = !!path?.isPointInFill(node);
    out[`${prefix}incident_arm_remains_filled`] = !!path?.isPointInFill(verticalArm);
    out[`${prefix}paper_remains_solid`] = !!canonical?.paperD
      && !!root().querySelector('.hp-paper');

    const model = card._spaceModel();
    const polys = model.rooms.map((room) => ({ r: room, poly: room.poly }));
    const barriers = card._lightBarriers(model, polys, card._physicalBodiesR(model));
    out[`${prefix}light_uses_same_masonry`] = barriers.masonryGeometry.flat(2).length > 0
      && barriers.occluders.length > 0 && !!barriers.fingerprint;

    card._setMode('view');
    await update(false);
    out[`${prefix}view_matches_plan`] = root().querySelector('[data-hp="wall"]')
      ?.getAttribute('d') === planD;
    card._hoverRoom = { space: space.id, room: model.rooms[0] };
    const hover = card._roomHoverPaths(model);
    out[`${prefix}clean_floor_consumer_present`] = !!hover?.fillD && !!hover.outlineD;
    card._hoverRoom = null;

    const kioskBefore = card._config.kiosk;
    card._config.kiosk = true;
    await update(false);
    out[`${prefix}kiosk_matches_plan`] = root().querySelector('[data-hp="wall"]')
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
    out[`${prefix}static_matches_plan`] = staticCard.renderRoot
      ?.querySelector('[data-hp="wall"]')?.getAttribute('d') === planD;
    staticCard.remove();

    const labs = Object.freeze(['iso']);
    card._onLabsSnapshot({ alpha: true, active: labs, space: '' });
    window.__hpAlpha = true;
    window.__hpLabs = labs;
    card._setProjection('iso');
    await update(false);
    out[`${prefix}hidden_iso_uses_masonry`] = !!root().querySelector('[data-hp="iso-walls"]')
      && card._isoSource().build().walls.flat(2).length > 0;
    out[`${prefix}render_never_writes_config`] = JSON.stringify(
      card._serverCfg.spaces[0],
    ) === persisted;
  }
  return out;
}, fixture);

checkAll(result);
await finish(browser, result);
