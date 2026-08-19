/** Issue #187: Glow source fallback uses light-policy bodies when boolean masonry fails. */
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 900, height: 760 }, 1);

const out = await page.evaluate(async () => {
  const result = {};
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const update = async () => {
    card.requestUpdate();
    await card.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 60));
    await card.updateComplete;
  };
  const pointIn = (point, body) => {
    let inside = false;
    for (let i = 0, j = body.length - 1; i < body.length; j = i++) {
      const a = body[i], b = body[j];
      if (((a[1] > point[1]) !== (b[1] > point[1]))
          && point[0] < ((b[0] - a[0]) * (point[1] - a[1]))
            / ((b[1] - a[1]) || 1e-12) + a[0]) inside = !inside;
    }
    return inside;
  };

  const spaceId = card._space;
  const lightDevice = card._devices.find((device) => device.space === spaceId
    && device.entities.some((entityId) => entityId.startsWith('light.')));
  const sourceEid = lightDevice?.entities.find((entityId) => entityId.startsWith('light.'));
  if (!lightDevice || !sourceEid) return {
    fixtureHasLightSource: false,
    windowFallbackBodyIsOpaque: false,
    windowSourceSuppressedOnBooleanFailure: false,
    interiorPassageRemainsTransparent: false,
  };
  result.fixtureHasLightSource = true;

  const centre = [500, 500];
  const opening = (type) => ({
    id: 'hosted-opening', type, x: 0.5, y: 0.5, angle: 0, length: 0.12,
    host: { kind: 'partition', id: 'host', t: 0.5 },
  });
  const currentState = card.hass.states[sourceEid];
  card.hass = {
    ...card.hass,
    states: {
      ...card.hass.states,
      [sourceEid]: { ...currentState, state: 'on' },
    },
  };
  card._layout = {
    ...card._layout,
    [lightDevice.id]: { s: spaceId, x: 0.5, y: 0.5 },
  };
  const replaceSpace = (type) => {
    card._serverCfg = {
      ...card._serverCfg,
      spaces: card._serverCfg.spaces.map((space) => space.id !== spaceId ? space : ({
        ...space,
        rooms: [{
          id: 'glow-room', name: 'Glow room', area: null,
          poly: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]],
        }],
        settings: { ...(space.settings || {}), fill_mode: 'glow' },
        partitions: [{ id: 'host', a: [0.25, 0.5], b: [0.75, 0.5], cm: 15 }],
        openings: [opening(type)],
        room_drafts: [], wall_columns: [],
      })),
    };
    card._cfgEpoch++;
    card._modelCache = null;
    card._physicalBodiesCache = null;
    card._lightPhysicalBodiesCache = null;
    card._lightBarrierCache = null;
    card._renderDeviceSnapshot = null;
    card._glowClipCache.clear();
  };

  // Simulate wallBodiesGeometry() returning null after a clipping exception.
  // The remainder of the real _lightBarriers path still computes the exact
  // light-policy body set, then only its boolean geometry is made unavailable.
  const realLightBarriers = card._lightBarriers.bind(card);
  card._lightBarriers = (...args) => {
    const barriers = realLightBarriers(...args);
    if (result.windowFallbackBodyIsOpaque === undefined) {
      result.windowFallbackBodyIsOpaque = barriers.opaqueBodies
        .some((body) => pointIn(centre, body));
    }
    return { ...barriers, masonryGeometry: [] };
  };

  replaceSpace('window');
  await update();
  const selector = `[data-glow-source="${CSS.escape(sourceEid)}"] .glow-pool`;
  result.windowSourceSuppressedOnBooleanFailure = !root().querySelector(selector);

  replaceSpace('passage');
  await update();
  result.interiorPassageRemainsTransparent = !!root().querySelector(selector);

  return result;
});

await finish(browser, checkAll(out));
