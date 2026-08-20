/** Issue #218: floating-point room noise cannot darken a whole space. */
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 900, height: 760 }, 1);

const out = await page.evaluate(async () => {
  const result = {};
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...parts) => {
    warnings.push(parts.map(String).join(' '));
    originalWarn(...parts);
  };

  const spaceId = card._space;
  const lightDevice = card._devices.find((device) => device.space === spaceId
    && device.entities.some((entityId) => entityId.startsWith('light.')));
  const lightEntity = lightDevice?.entities.find((entityId) => entityId.startsWith('light.'));
  if (!lightDevice || !lightEntity) {
    console.warn = originalWarn;
    return {
      fixtureHasLight: false,
      ulpFloorKeepsGlow: false,
      ulpNoiseNeedsNoFallback: false,
      glowBaseKeepsAllRooms: false,
      malformedRoomKeepsHealthyGlow: false,
      fallbackWarningDeduplicated: false,
      fallbackWarningIsRedacted: false,
    };
  }
  result.fixtureHasLight = true;
  const lightState = card.hass.states[lightEntity];
  card.hass = {
    ...card.hass,
    states: {
      ...card.hass.states,
      [lightEntity]: { ...lightState, state: 'on' },
    },
  };

  const resetGeometryCaches = () => {
    card._cfgEpoch++;
    card._modelCache = null;
    card._physicalBodiesCache = null;
    card._cleanFloorCache.clear();
    card._lightPhysicalBodiesCache = null;
    card._lightBarrierCache = null;
    card._renderDeviceSnapshot = null;
    card._glowClipCache.clear();
  };
  const update = async () => {
    card.requestUpdate();
    await card.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 80));
    await card.updateComplete;
  };
  const replaceRooms = async (rooms, sourcePoint) => {
    card._serverCfg = {
      ...card._serverCfg,
      spaces: card._serverCfg.spaces.map((space) => space.id !== spaceId ? space : ({
        ...space,
        rooms,
        settings: { ...(space.settings || {}), fill_mode: 'glow' },
        walls: [], openings: [], partitions: [], room_drafts: [], wall_columns: [],
      })),
    };
    card._layout = {
      ...card._layout,
      [lightDevice.id]: { s: spaceId, x: sourcePoint[0] / 1000, y: sourcePoint[1] / 1000 },
    };
    resetGeometryCaches();
    await update();
  };
  const room = (id, poly) => ({
    id, name: `Private name ${id}`, area: null,
    // The model projects config coordinates into the 1000-unit render canvas.
    poly: poly.map(([x, y]) => [x / 1000, y / 1000]),
  });

  const noisyFloor = [
    [[0.46666666666666673, 0.7083333333333334], [0.6125, 0.9],
      [0.4666666666666667, 1], [0.46666666666666673, 0.9]],
    [[0.1625, 0.3], [0.3458333333333333, 0],
      [0.46666666666666673, 1], [0.3458333333333333, 1]],
    [[0.7, 0], [0.8, 0], [0.8, 0.7083333333333334], [0.7, 0.7083333333333334]],
    [[0.7, 0.7083333333333335], [0.8, 0.7083333333333335], [0.8, 1], [0.7, 1]],
    [[0.85, 0], [0.9, 0], [0.9, 0.4], [0.85, 0.4]],
    [[0.85, 0.5], [0.9, 0.5], [0.9, 1], [0.85, 1]],
  ];
  await replaceRooms(noisyFloor.map((poly, index) => room(`ulp-${index}`, poly)), [0.36, 0.5]);
  const ulpPath = root().querySelector('clipPath[id^="hp-glowclip"] path.glow-lit');
  result.ulpFloorKeepsGlow = !!root().querySelector('.glow-pool')
    && !!ulpPath?.getAttribute('d')
    && Number(root().querySelector('.glow-pool')?.dataset.litParts) > 0;
  result.ulpNoiseNeedsNoFallback = warnings.length === 0;
  result.glowBaseKeepsAllRooms = root().querySelectorAll('.glow-base-layer .glow-base').length
    === noisyFloor.length;

  const healthy = [[3, 0], [5, 0], [5, 2], [3, 2]];
  const malformed = [[2, 1], [0, 0], [2, 2], [1, 0], [0, 2], [2, 0]];
  await replaceRooms([
    room('healthy-room', healthy),
    room('broken-room', malformed),
  ], [4, 1]);
  const fallbackPath = root().querySelector('clipPath[id^="hp-glowclip"] path.glow-lit');
  result.malformedRoomKeepsHealthyGlow = !!root().querySelector('.glow-pool')
    && !!fallbackPath?.getAttribute('d')
    && fallbackPath.getAttribute('d').includes('3 0')
    && fallbackPath.getAttribute('d').includes('5 2');

  // Force the pure calculation a second time with the same fingerprint. The
  // diagnostic must remain one record, even across sources/renders.
  card._glowClipCache.clear();
  await update();
  const fallbackWarnings = warnings.filter((line) =>
    line.startsWith('HOUSEPLAN GLOW GEOMETRY FALLBACK: #218'));
  result.fallbackWarningDeduplicated = fallbackWarnings.length === 1
    && fallbackWarnings[0].includes(`space ${spaceId}`)
    && fallbackWarnings[0].includes('room broken-room')
    && card._glowGeometryWarnings.size === 1;
  result.fallbackWarningIsRedacted = fallbackWarnings.length === 1
    && !fallbackWarnings[0].includes('Private name')
    && !fallbackWarnings[0].includes(lightEntity)
    && !fallbackWarnings[0].includes('Unable to complete')
    && !/\[\s*-?\d/.test(fallbackWarnings[0]);

  console.warn = originalWarn;
  return result;
});

await finish(browser, checkAll(out));
