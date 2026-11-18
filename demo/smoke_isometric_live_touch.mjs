// #122/#160/#570 Stage 4: live-floor preservation, low overlays, openings and touch paths.
import { launch, checkAll, finish } from './serve.mjs';
import {commitWallSegmentModel} from '../test-build/wall-segment-model.js';
import {editGraphFixture} from './helpers/graph-fixture.mjs';

const { page, browser } = await launch(
  { width: 430, height: 820 }, 1, [], { hasTouch: true, isMobile: true },
);
// The original demo has zero-depth borders. Real masonry needs explicit
// positive physical carriers; author them through the canonical fixture gate.
const solidConfig=commitWallSegmentModel(await page.evaluate(()=>structuredClone(window.__card._serverCfg))).config;
editGraphFixture(solidConfig,'f1',{kind:'thickness',rooms:solidConfig.spaces.find(space=>space.id==='f1').rooms.map(room=>room.id),cm:15},
  draft=>{for(const wall of draft.wall_segments)wall.cm=15;});
await page.evaluate(config=>window.__hpTest.setServerConfig(()=>config),solidConfig);
const out = await page.evaluate(async () => {
  const original = window.__card;
  const root = (card) => card.renderRoot;
  const wait = (ms) => new Promise((done) => setTimeout(done, ms));
  const frame = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  const ensureIsoRuntime = async (card) => {
    if (typeof card._ensureIsoSceneRuntime !== 'function'
        || !(await card._ensureIsoSceneRuntime())) {
      throw new Error('isometric touch smoke runtime did not load');
    }
    await card.updateComplete;
    await frame();
  };
  history.replaceState(null, '', '#space=f1');
  await ensureIsoRuntime(original);
  let configSpace = original._serverCfg.spaces.find((space) => space.id === 'f1');
  configSpace.settings = {
    ...(configSpace.settings || {}), fill_mode: 'custom',
    custom_fill: { c: '#31465f', a: 0.42 }, glow_enabled: true,
    show_borders: true, show_names: true, north_deg: 0, sun_rays: true,
  };
  configSpace.rooms[0].settings = {
    ...(configSpace.rooms[0].settings || {}), fill_mode: 'none', glow: true,
  };
  configSpace.openings = [
    { id: 'iso-window', type: 'window', x: 0.28, y: 0.14, angle: 0, length: 0.12,
      contact: 'binary_sensor.window' },
    { id: 'iso-door', type: 'door', x: 0.55, y: 0.36, angle: 90, length: 0.12,
      contact: 'binary_sensor.window', lock: 'lock.front_door' },
    { id: 'iso-gate', type: 'gate', x: 0.72, y: 0.14, angle: 0, length: 0.16,
      contact: 'binary_sensor.gate', lock: 'lock.front_door' },
  ];
  configSpace.partitions = [{
    id: 'iso-live-wall', a: [0.15, 0.12], b: [0.85, 0.12], cm: 15,
  }];
  configSpace.decor = [
    { id: 'iso-line', kind: 'line', x1: 0.12, y1: 0.7, x2: 0.45, y2: 0.7,
      color: '#667788', opacity: 0.7, width_cm: 1 },
    { id: 'iso-sofa', kind: 'furniture', symbol: 'sofa', x: 0.62, y: 0.55,
      w: 0.2, h: 0.12, color: '#667788', opacity: 0.7, width_cm: 1 },
  ];
  original._serverCfg.markers = original._serverCfg.markers || [];
  original._serverCfg.markers.push({
    id: 'iso-vacuum', binding: 'device:d_mower', space: 'f1', area: 'living_room',
    vacuum: {
      source: 'camera.static_robot_map', trail_mode: 'always',
      calibration: { m1: [0.5, 0, 0, 0, 0.5, 0] },
    },
  });
  // Keep a real interactive light near the shared wall, but outside its
  // positive 15 cm body: its floor anchor must not receive a visual nudge.
  original._layout.d_light1 = { ...original._layout.d_light1, s: 'f1', x: 0.53, y: 0.22 };
  original._layout['iso-vacuum'] = { s: 'f1', x: 0.18, y: 0.78 };
  original._hoverRoom = { space: 'f1', room: original._spaceModel('f1').rooms[0] };
  original.hass = {
    ...original.hass,
    states: {
      ...original.hass.states,
      'light.floor_lamp': {
        ...original.hass.states['light.floor_lamp'], state: 'on',
      },
      'vacuum.mower': {
        ...original.hass.states['vacuum.mower'], state: 'cleaning',
      },
      'camera.static_robot_map': {
        entity_id: 'camera.static_robot_map', state: 'idle',
        attributes: {
          map_name: 'm1', vacuum_position: { x: 650, y: 700, a: 0 },
          path: [[200, 200], [420, 200], [420, 440], [650, 700]],
        },
      },
      'sun.sun': {
        entity_id: 'sun.sun', state: 'above_horizon',
        attributes: { azimuth: 0, elevation: 24 },
      },
    },
  };
  original._cfgEpoch++;
  original._regSignature = '';
  original.requestUpdate();
  await window.__hpTest.settled();
  await frame();

  const count = (selector) => root(original).querySelectorAll(selector).length;
  const identities = (selector) => [...root(original).querySelectorAll(selector)]
    .map(node => node.dataset.id).filter(Boolean).sort();
  const unique = values => [...new Set(values)];
  const decorSelector = '.decorlayer [data-hp="decor"]:not(.dselecthit):not(.dfurniturehit):not(.derasehit), [data-hp-furniture-volume]';
  const furnitureSelector = '.decorlayer .dfurn, [data-hp-furniture-volume]';
  const layers = () => ({
    rooms: count('[data-hp="room"]'),
    roomFills: count('[data-hp="room"].filled'),
    decor: unique(identities(decorSelector)).length,
    furniture: unique(identities(furnitureSelector)).length,
    decorIds: unique(identities(decorSelector)),
    furnitureIds: unique(identities(furnitureSelector)),
    decorDuplicateFree: identities(decorSelector).length === unique(identities(decorSelector)).length,
    furnitureDuplicateFree: identities(furnitureSelector).length === unique(identities(furnitureSelector)).length,
    rawDecor: count('.decorlayer [data-hp="decor"]'),
    rawFlatFurniture: count('.decorlayer .dfurn'),
    rawVolumeFurniture: count('[data-hp-furniture-volume]'),
    backdrop: count('.hp-backdrop'),
    glowBase: count('.glow-base-layer .glow-base'),
    glowSources: count('.glowlayer [data-glow-source]'),
    sun: count('.sunlayer'),
    openings: count('[data-hp="opening"]'),
    verticalOpenings: count('[data-hp="iso-openings"] .iso-opening-panel'),
    openingIds: unique(identities('[data-hp="opening"], [data-hp="iso-openings"] .iso-opening-panel')),
    devices: count('[data-hp="device"]'),
    hover: count('.room-hover-fill'),
    vacuumPucks: count('.vacpuck'),
    vacuumTrails: count('.vactrail path.core'),
  });
  const stableLayers = ({verticalOpenings,rawDecor,rawFlatFurniture,rawVolumeFurniture,...stable}) => stable;
  const flat = layers();
  const flatVacuumTrailD = root(original).querySelector('.vactrail path.core[data-vacuum-owner="iso-vacuum"]')?.getAttribute('d') || '';
  const flatSpillParts = [...root(original).querySelectorAll('.glow-pool')]
    .map((node) => node.getAttribute('data-lit-parts'));
  // #649: the General settings switch, delivered as a server config push.
  await window.__hpTest.setVolumetricView(true);
  configSpace = original._serverCfg.spaces.find((space) => space.id === 'f1');
  await ensureIsoRuntime(original);
  await window.__hpTest.settled();
  await frame();

  const before = layers();
  const beforeSpillParts = [...root(original).querySelectorAll('.glow-pool')]
    .map((node) => node.getAttribute('data-lit-parts'));
  const isoVacuumPaths = [...root(original).querySelectorAll('.vactrail path.core[data-vacuum-owner="iso-vacuum"]')];
  const isoVacuumTrailD = isoVacuumPaths[0]?.getAttribute('d') || '';
  const isoVacuumTips = count('.vactrail line.tip');
  const wallFingerprint = root(original).querySelector('[data-hp="iso-walls"]')?.dataset.fingerprint;
  const cachedGeometry = original._isoGeometryCache.get(wallFingerprint)?.geometry;
  const structuralBuildsBeforeLive = Number(root(original).querySelector('.stage')
    ?.getAttribute('data-hp-iso-structural-builds'));
  const floorLayoutBeforeLive = JSON.stringify(original._layout);
  const forbiddenWrites = [];
  const storageWrites = [];
  const nativeCallWs = original.hass.callWS.bind(original.hass);
  const nativeStorageSet = Storage.prototype.setItem;
  Storage.prototype.setItem = function instrumentedStorageSet(key, value) {
    storageWrites.push({ key: String(key), value: String(value) });
    return nativeStorageSet.call(this, key, value);
  };
  original.hass = {
    ...original.hass,
    callWS: async (message) => {
      if (/^houseplan\/(?:config|layout)\/(?:set|update|delete|save)$/.test(message?.type || ''))
        forbiddenWrites.push(structuredClone(message));
      return nativeCallWs(message);
    },
  };
  await window.__hpTest.settled();
  const light = original.hass.states['light.ceiling'];
  const openingPanelBefore = root(original)
    .querySelector('[data-hp="iso-openings"] [data-id="iso-door"][data-surface="leaf-front"]')
    ?.getAttribute('d');
  original.hass = {
    ...original.hass,
    states: {
      ...original.hass.states,
      'light.ceiling': {
        ...light, attributes: { ...light.attributes, rgb_color: [255, 64, 32] },
      },
      'binary_sensor.window': {
        ...original.hass.states['binary_sensor.window'], state: 'off',
      },
    },
  };
  await window.__hpTest.settled();
  const after = layers();
  window.__isoTouchLayerDiagnostics = {flat,before,after};
  const afterSpillParts = [...root(original).querySelectorAll('.glow-pool')]
    .map((node) => node.getAttribute('data-lit-parts'));
  const sunBefore = original.hass.states['sun.sun'];
  original.hass = {
    ...original.hass,
    states: {
      ...original.hass.states,
      'sun.sun': {
        ...sunBefore,
        attributes: { ...sunBefore.attributes, azimuth: sunBefore.attributes.azimuth + 7 },
      },
    },
  };
  await window.__hpTest.settled();
  await frame();
  const ordered = [
    root(original).querySelector('.iso-underlay-svg'),
    root(original).querySelector('.hp-backdrop'),
    root(original).querySelector('[data-hp="room"]'),
    root(original).querySelector('.decorlayer'),
    root(original).querySelector('.glowlayer'),
    root(original).querySelector('.sunlayer'),
    root(original).querySelector('.iso-shadows-svg'),
    root(original).querySelector('.iso-walls-svg'),
    root(original).querySelector('.iso-overlays-svg'),
    root(original).querySelector('.vacpuck'),
  ];
  const overlaySvg = root(original).querySelector('.iso-overlays-svg');
  const wallSvg = root(original).querySelector('.iso-walls-svg');
  const doorResolved = original._openingsR.find((opening) => opening.id === 'iso-door');
  const windowResolved = original._openingsR.find((opening) => opening.id === 'iso-window');
  // Independent #1451 oracle: accepted yaw35/elevation40, centred at500.
  // Do not derive the expected matrix from the product's projection helper.
  const yaw=(35+original._rotation)*Math.PI/180,depth=Math.sin(40*Math.PI/180);
  const a=Math.cos(yaw),b=Math.sin(yaw)*depth,c=-Math.sin(yaw),d=Math.cos(yaw)*depth;
  const isoFloorMatrix=[a,b,c,d,500-a*500-c*500,500-b*500-d*500];
  const floorTransform=root(original).querySelector('.iso-floor-scene')?.getAttribute('transform')||'';
  // SVGTransformList.consolidate() recomposes through Chromium float32 and
  // mutates the attribute. Check the actual twelve-decimal paint instruction,
  // keeping this independent oracle stricter than that DOMMatrix conversion.
  const floorMatrix=/^matrix\(([^)]+)\)$/.exec(floorTransform)?.[1].trim().split(/[,\s]+/).map(Number);
  const isoFloorUsesAcceptedCamera=floorMatrix?.length===6
    && floorMatrix.every((value,index)=>Math.abs(value-isoFloorMatrix[index])<1e-9);
  const wallHeight=140/original._cellCm*original._gridPitch;
  const openingPoint = (opening,height) => opening ? new DOMPoint(
    isoFloorMatrix[0]*opening.rx+isoFloorMatrix[2]*opening.ry+isoFloorMatrix[4],
    isoFloorMatrix[1]*opening.rx+isoFloorMatrix[3]*opening.ry+isoFloorMatrix[5]
      -height*Math.cos(40*Math.PI/180)) : null;
  const openingTopPoint=openingPoint(doorResolved,wallHeight);
  const clearDoorPoint=openingPoint(doorResolved,wallHeight*.5);
  const windowApronPoint=openingPoint(windowResolved,wallHeight*.18);
  const wallTopPathsBeforeHide = [...root(original).querySelectorAll('.iso-wall-top')]
    .map((path) => path.getAttribute('d'));
  const contains=(selector,point)=>!!point&&[...root(original).querySelectorAll(selector)]
    .some(path=>path.isPointInFill(point));
  // #1451 deliberately closes the top eight percent above a door, while
  // leaving the doorway clear below it. Windows retain solid masonry below
  // the sill; external gates never gain a floating lintel.
  const masonryContract=()=>({
    doorLintel:contains('.iso-wall-top[data-id="iso-door"][data-surface="opening-lintel-top"]',openingTopPoint),
    doorGapClear:!!clearDoorPoint&&!contains('.iso-wall-top[data-id="iso-door"],.iso-wall-side[data-id="iso-door"]',clearDoorPoint),
    windowApron:contains('[data-id="iso-window"][data-surface^="window-apron-"]',windowApronPoint),
    gateNoLintel:!root(original).querySelector('[data-id="iso-gate"][data-surface^="opening-lintel-"]'),
  });
  const masonryBefore=masonryContract();
  window.__isoTouchLayerDiagnostics.masonry={...masonryBefore,wallHeight,
    doorFace:doorResolved?.face,windowFace:windowResolved?.face,
    floorExpected:isoFloorMatrix,floorActual:floorMatrix,floorTransform,
    openingFaces:original._renderIsoScene?.openings.map(opening=>({id:opening.id,face:opening.face})),
    decorNodes:[...root(original).querySelectorAll(decorSelector)].map(node=>({id:node.dataset.id,class:node.getAttribute('class')})),
    surfaceKinds:[...root(original).querySelectorAll('[data-id="iso-door"],[data-id="iso-window"]')]
      .map(node=>node.dataset.surface).filter(Boolean)};
  const result = {
    isoOnTouch: root(original).querySelector('.stage')?.getAttribute('data-hp-iso-stage') === '4'
      && !!root(original).querySelector('[data-hp="iso-walls"]'),
    flatIsoLayerParity: JSON.stringify(stableLayers({ ...flat, openings: 0 }))
        === JSON.stringify(stableLayers(before))
      && JSON.stringify(flatSpillParts) === JSON.stringify(beforeSpillParts),
    liveLayersPresent: before.rooms > 0 && before.roomFills > 0
      && JSON.stringify(before.decorIds) === JSON.stringify(['iso-line','iso-sofa'])
      && JSON.stringify(before.furnitureIds) === JSON.stringify(['iso-sofa'])
      && before.decorDuplicateFree && before.furnitureDuplicateFree
      && before.rawFlatFurniture === 0 && before.rawVolumeFurniture === 1
      && before.backdrop > 0 && before.glowBase === 0
      && before.glowSources >= 2 && before.sun > 0 && before.openings === 0
      && before.verticalOpenings >= 5
      && JSON.stringify(before.openingIds) === JSON.stringify(['iso-door','iso-gate','iso-window'])
      && before.devices > 0 && before.hover > 0 && before.vacuumPucks > 0
      && before.vacuumTrails >= 1,
    // #1002 removes the casing; #872 still preserves all four native points,
    // both curved corners and the exact endpoint without a sampled connector.
    vacuumTrailCurved: (isoVacuumTrailD.match(/Q /g) || []).length === 2,
    nativeTrailSingleCoreAndProjectionParity: isoVacuumPaths.length === 1
      && !count('.vactrail .case') && isoVacuumTrailD === flatVacuumTrailD
      && isoVacuumTrailD.startsWith('M 100 100'),
    nativeTrailExactEndpointWithoutConnector: isoVacuumTrailD.endsWith('L 325 350')
      && isoVacuumTips === 0,
    // Pose-dependent clipping may change the number of surface paths, not
    // physical opening membership or any other live floor layer.
    liveLayersStable: JSON.stringify(stableLayers(after)) === JSON.stringify(stableLayers(before)),
    spillBarrierStable: JSON.stringify(afterSpillParts) === JSON.stringify(beforeSpillParts)
      && beforeSpillParts.length >= 2 && beforeSpillParts.every((parts) => Number(parts) > 0),
    floorToOverlayOrderPreserved: ordered.every(Boolean)
      && ordered.slice(1).every((node, index) => Boolean(
        ordered[index].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING
      )),
    overlaysStayAboveWallsWithoutDebugGrounds: !!overlaySvg && !!wallSvg
      && Boolean(wallSvg.compareDocumentPosition(overlaySvg) & Node.DOCUMENT_POSITION_FOLLOWING)
      && !root(original).querySelector(
        '.iso-overlay-ground, .iso-overlay-tether, #hp-iso-overlay-ground',
      ),
    haColorUpdatePainted: [...root(original).querySelectorAll('radialGradient stop')]
      .some((stop) => stop.getAttribute('stop-color') === '#ff4020'),
    sameWallFingerprint: root(original).querySelector('[data-hp="iso-walls"]')?.dataset.fingerprint === wallFingerprint,
    haUpdateReusesGeometry: original._isoGeometryCache.get(wallFingerprint)?.geometry === cachedGeometry,
    sunUpdateKeepsStructuralFingerprint:
      root(original).querySelector('[data-hp="iso-walls"]')?.dataset.fingerprint === wallFingerprint
      && Number(root(original).querySelector('.stage')
        ?.getAttribute('data-hp-iso-structural-builds')) === structuralBuildsBeforeLive,
    contactUpdateMovesOnlyLivePanel: !!openingPanelBefore
      && root(original).querySelector(
        '[data-hp="iso-openings"] [data-id="iso-door"][data-surface="leaf-front"]',
      )?.getAttribute('d')
        !== openingPanelBefore
      && original._isoGeometryCache.size === 1,
    oneLightModel: !root(original).querySelector('.window-light,.iso-window-light,.iso-glow,.iso-sun'),
    oldFloorSymbolsNotDuplicated: before.openings === 0,
    openingMasonryMatchesAcceptedCut: Object.values(masonryBefore).every(value=>value===true)
      && wallTopPathsBeforeHide.length > 0,
    isoFloorUsesAcceptedCamera,
  };

  configSpace.settings.hide_openings = true;
  original._cfgEpoch++;
  original.requestUpdate();
  await window.__hpTest.settled();
  // #945: a legacy hide_openings override no longer defeats visible borders.
  result.legacyOpeningFlagKeepsVisibleStructure = !!root(original).querySelector('[data-hp="iso-walls"]')
    && !!root(original).querySelector('[data-hp="iso-openings"]')
    && !root(original).querySelector('[data-hp="opening"]')
    && !!root(original).querySelector('.oplock[data-hp-iso-raised="true"]')
    && root(original).querySelectorAll('.glowlayer [data-glow-source]').length >= 2
    && JSON.stringify([...root(original).querySelectorAll('.iso-wall-top')]
      .map((path) => path.getAttribute('d'))) === JSON.stringify(wallTopPathsBeforeHide)
    && Object.values(masonryContract()).every(value=>value===true);

  configSpace.settings.hide_openings = false;
  const runtimeBeforeNoBorders = original._isoSceneRuntime;
  let hiddenTopologyRequests = 0;
  let hiddenTopologyBuilds = 0;
  original._isoSceneRuntime = {
    ...runtimeBeforeNoBorders,
    createIsoStructuralSource(input) {
      hiddenTopologyRequests++;
      const source = runtimeBeforeNoBorders.createIsoStructuralSource(input);
      return {
        ...source,
        key: `${source.key}|hidden-topology-regression`,
        build() {
          hiddenTopologyBuilds++;
          throw new Error('hidden walls must not build topology');
        },
      };
    },
  };
  configSpace.settings.show_borders = false;
  original._cfgEpoch++;
  original.requestUpdate();
  await window.__hpTest.settled();
  const noBordersFloor = root(original).querySelector('.plan-svg .iso-floor-scene');
  const noBordersDevice = root(original).querySelector('[data-hp="device"]');
  const noBordersRoom = root(original).querySelector('[data-hp="room-label"]');
  const noBordersLock = root(original).querySelector('.oplock');
  result.noBordersUsesFlatFloor = original._effectiveProjection() === 'iso'
    && root(original).querySelector('.stage')?.getAttribute('data-hp-iso-stage') === '4'
    && root(original).querySelector('.plan-svg')?.getAttribute('data-hp-live-viewbox') === 'camera'
    && !!noBordersFloor && !noBordersFloor.hasAttribute('transform')
    && root(original).querySelectorAll('[data-hp="opening"]').length === 0
    && [noBordersDevice, noBordersRoom, noBordersLock].every((node) => node
      && !node.hasAttribute('data-hp-iso-raised'));
  result.noBordersHasNoRaisedOrVolumeLayers = !root(original).querySelector('[data-hp="iso-walls"]')
    && !root(original).querySelector('[data-hp="iso-underlay"]')
    && !root(original).querySelector('[data-hp="iso-shadows"]')
    && !root(original).querySelector('[data-hp="iso-raised-overlays"]')
    && !root(original).querySelector('[data-hp="iso-overlay-grounds"]')
    && !root(original).querySelector('.iso-overlays-svg')
    && !root(original).querySelector('[data-hp-iso-raised="true"]');
  result.noBordersSkipsHiddenTopology = hiddenTopologyRequests === 0
    && hiddenTopologyBuilds === 0 && original._effectiveProjection() === 'iso';

  configSpace.settings.hide_openings = true;
  original._cfgEpoch++;
  original.requestUpdate();
  await window.__hpTest.settled();
  result.noBordersHideOpeningsKeepsOnlyFloorSemantics = original._effectiveProjection() === 'iso'
    && root(original).querySelectorAll('[data-hp="opening"]').length === 0
    && !!root(original).querySelector('.oplock:not([data-hp-iso-raised])')
    && !root(original).querySelector('[data-hp="iso-walls"]')
    && !root(original).querySelector('[data-hp="iso-raised-overlays"]')
    && hiddenTopologyRequests === 0 && hiddenTopologyBuilds === 0;

  original._isoSceneRuntime = runtimeBeforeNoBorders;
  configSpace.settings.hide_openings = false;
  configSpace.settings.show_borders = true;
  original._cfgEpoch++;
  original.requestUpdate();
  await window.__hpTest.settled();
  result.visibleBordersRestoreStage4 = !!root(original).querySelector('[data-hp="iso-openings"]')
    && !!root(original).querySelector('[data-hp-iso-raised="true"]')
    && root(original).querySelector('.stage')?.getAttribute('data-hp-iso-stage') === '4'
    && original._isoGeometryCache.size === 1;

  original._hoverRoom = null;
  original.requestUpdate();
  await window.__hpTest.settled();
  await frame();
  original._hoverRoom = { space: 'f1', room: original._spaceModel('f1').rooms[0] };
  original.requestUpdate();
  await window.__hpTest.settled();
  await frame();
  result.haAndHoverKeepStructuralCache = Number(root(original).querySelector('.stage')
    ?.getAttribute('data-hp-iso-structural-builds')) === structuralBuildsBeforeLive
    && root(original).querySelector('[data-hp="iso-walls"]')?.dataset.fingerprint === wallFingerprint
    && original._isoGeometryCache.get(wallFingerprint)?.geometry === cachedGeometry
    && original._isoGeometryCache.size === 1;
  result.runtimeLiftNeverPersists = JSON.stringify(original._layout) === floorLayoutBeforeLive
    && forbiddenWrites.length === 0 && storageWrites.length === 0
    && !!root(original).querySelector('[data-hp-iso-raised="true"][data-hp-iso-nudged="false"]')
    && !root(original).querySelector('[data-hp-iso-nudged="true"]')
    && !root(original).querySelector('.iso-overlay-tether, .iso-overlay-ground');
  Storage.prototype.setItem = nativeStorageSet;

  const fallbackCalls = [];
  original.hass = {
    ...original.hass,
    callService: async (domain, service, data) => fallbackCalls.push({ domain, service, data }),
  };
  await window.__hpTest.settled();
  const supports = CSS.supports;
  CSS.supports = () => false;
  original.requestUpdate();
  await window.__hpTest.settled();
  const fallbackRaised = root(original).querySelector('[data-hp-iso-raised="true"][data-id]');
  const fallbackId = fallbackRaised?.getAttribute('data-id');
  root(original).querySelector('[data-hp="device"][data-entity="light.ceiling"]')?.click();
  await frame();
  result.unsupportedDecorationKeepsIsoStructure = !!root(original).querySelector('[data-hp="iso-walls"]')
    && !!root(original).querySelector('[data-hp="iso-openings"]');
  result.unsupportedDecorationDropsUnsupportedEffects = !root(original).querySelector('[data-hp="iso-shadows"]')
    && root(original).querySelectorAll('[data-hp-iso-material-def]').length === 0;
  result.unsupportedDecorationKeepsFootprintInvisible = !root(original).querySelector(
    '.iso-overlay-plate, .iso-overlay-plate-texture, #hp-iso-overlay-texture',
  );
  result.unsupportedDecorationAddsNoDebugCue = !!fallbackId
    && !root(original).querySelector('.iso-overlay-tether, .iso-overlay-ground');
  result.unsupportedDecorationKeepsActions = fallbackCalls.length === 1;
  CSS.supports = supports;
  original.requestUpdate();
  await window.__hpTest.settled();

  const calls = [];
  original.hass = {
    ...original.hass,
    callService: async (domain, service, data) => calls.push({ domain, service, data }),
  };
  await window.__hpTest.settled();
  root(original).querySelector('[data-hp="device"][data-entity="light.ceiling"]')?.click();
  await frame();
  await window.__hpTest.setVolumetricView(false);
  root(original).querySelector('[data-hp="device"][data-entity="light.ceiling"]')?.click();
  await frame();
  result.flatIsoActionParity = calls.length === 2
    && JSON.stringify(calls[0]) === JSON.stringify(calls[1]);
  await window.__hpTest.setVolumetricView(true);
  configSpace = original._serverCfg.spaces.find((space) => space.id === 'f1');

  const stage = root(original).querySelector('.stage');
  const stageRect = stage.getBoundingClientRect();
  const zoomBefore = original._zoom;
  const overlaySceneSnapshot = () => [...root(original).querySelectorAll(
    '[data-hp-iso-raised="true"][data-hp-iso-visual]',
  )].map((node) => [
    node.getAttribute('data-hp-iso-overlay-kind'),
    node.getAttribute('data-hp-iso-floor'),
    node.getAttribute('data-hp-iso-visual'),
  ].join('|')).sort();
  const overlaysBeforePinch = overlaySceneSnapshot();
  const pointer = (type, id, x, y, buttons) => new PointerEvent(type, {
    bubbles: true, composed: true, pointerId: id, pointerType: 'touch',
    clientX: x, clientY: y, button: type === 'pointerdown' ? 0 : -1, buttons,
  });
  const cy = stageRect.top + stageRect.height / 2;
  stage.dispatchEvent(pointer('pointerdown', 8902, stageRect.left + 150, cy, 1));
  stage.dispatchEvent(pointer('pointerdown', 8903, stageRect.left + 270, cy, 1));
  stage.dispatchEvent(pointer('pointermove', 8902, stageRect.left + 115, cy, 1));
  stage.dispatchEvent(pointer('pointermove', 8903, stageRect.left + 305, cy, 1));
  stage.dispatchEvent(pointer('pointerup', 8902, stageRect.left + 115, cy, 0));
  stage.dispatchEvent(pointer('pointerup', 8903, stageRect.left + 305, cy, 0));
  await window.__hpTest.settled();
  await frame();
  result.touchPinchKeepsIso = original._zoom > zoomBefore
    && !!root(original).querySelector('[data-hp="iso-walls"]');
  result.touchPinchKeepsOverlayScene = overlaysBeforePinch.length >= 2
    && JSON.stringify(overlaySceneSnapshot()) === JSON.stringify(overlaysBeforePinch);

  const opening = root(original).querySelector('.iso-opening-panel[data-id="iso-door"]');
  const openingOwner = opening?.closest('[data-hp="iso-openings"]');
  opening?.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  result.touchOpeningIsSafe = !!opening
    && openingOwner?.getAttribute('pointer-events') === 'none'
    && openingOwner?.getAttribute('aria-hidden') === 'true'
    && !original._openingDialog && !original._openingInfo
    && original._mode === 'view' && calls.length === 2;

  const device = root(original).querySelector('[data-hp="device"]');
  if (device) {
    const rect = device.getBoundingClientRect();
    device.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, composed: true, pointerId: 8901, pointerType: 'touch',
      clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
      button: 0, buttons: 1,
    }));
    await wait(700);
    result.touchLongPressHitsDevice = !!original._infoCard;
    device.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, composed: true, pointerId: 8901, pointerType: 'touch',
      clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
      button: 0, buttons: 0,
    }));
    original._closeInfoCard();
  } else result.touchLongPressHitsDevice = false;

  // #649: one installation-wide switch — every space is 2.5D, no per-space choice.
  original._pickSpace('garden');
  await wait(230);
  await window.__hpTest.settled();
  const gardenIso = original._space === 'garden'
    && !!root(original).querySelector('.stage.projection-iso');
  original._pickSpace('f1');
  await wait(230);
  result.touchSpaceSwitchKeepsIso = gardenIso && original._space === 'f1'
    && !!root(original).querySelector('[data-hp="iso-walls"]');

  const ownVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState');
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  document.dispatchEvent(new Event('visibilitychange'));
  window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  await window.__hpTest.settled();
  await frame();
  const recoveryStarted = performance.now();
  while (root(original).querySelector('.recoveryoverlay')
      && performance.now() - recoveryStarted < 2000) await wait(20);
  result.backgroundForegroundKeepsIso = !!root(original).querySelector('[data-hp="iso-walls"]')
    && !root(original).querySelector('.recoveryoverlay');
  if (ownVisibilityState) Object.defineProperty(document, 'visibilityState', ownVisibilityState);
  else delete document.visibilityState;

  const host = document.getElementById('host');
  const mount = async (kiosk = false) => {
    const card = document.createElement('houseplan-card');
    card.setConfig({ type: 'custom:houseplan-card', kiosk });
    host.replaceChildren(card);
    card.hass = window.__mkHass();
    const started = performance.now();
    while ((!card._loadOk || card._booting) && performance.now() - started < 9000) await wait(30);
    await ensureIsoRuntime(card);
    // #1457: data boot and lazy runtime readiness do not publish #1454's
    // prepared floor. Native input needs the active scene, not its passive
    // preview. Do not wait for iso-walls itself: that remains the assertion.
    const active = () => card._loadOk && !card._booting && !card._bootFading
      && !card._floorPreparation?.pending && !card._floorPassive
      && !!root(card).querySelector('.stage:not([data-hp-floor-cache]) svg.plan-svg:not([data-hp-cache-preview])');
    while (!active() && performance.now() - started < 9000) await wait(30);
    result[kiosk ? 'kioskMountIsActive' : 'warmMountIsActive'] = active();
    await card.updateComplete;
    await frame();
    return card;
  };
  original.remove();
  const warm = await mount(false);
  result.warmRemountIso = !warm._booting
    && !!root(warm).querySelector('[data-hp="iso-walls"]')
    && !!root(warm).querySelector('.stage.projection-iso')
    && !root(warm).querySelector('[data-hp="projection-toggle"]');
  warm.remove();
  const kiosk = await mount(true);
  result.kioskReadsSetting = !!root(kiosk).querySelector('[data-hp="iso-walls"]');
  result.kioskHasNoToggle = !root(kiosk).querySelector('[data-hp="projection-toggle"]');
  const kioskStage = root(kiosk).querySelector('.stage');
  const kioskRect = kioskStage?.getBoundingClientRect();
  const kioskViewBefore = JSON.stringify(kiosk._view);
  if (kioskStage && kioskRect) {
    const x = kioskRect.left + kioskRect.width / 2;
    const y = kioskRect.top + kioskRect.height / 2;
    kioskStage.dispatchEvent(pointer('pointerdown', 8910, x, y, 1));
    kioskStage.dispatchEvent(pointer('pointermove', 8910, x + 48, y + 24, 1));
    kioskStage.dispatchEvent(pointer('pointerup', 8910, x + 48, y + 24, 0));
    await kiosk.updateComplete;
    await frame();
  }
  result.kioskTouchPanKeepsIso = JSON.stringify(kiosk._view) !== kioskViewBefore
    && !!root(kiosk).querySelector('[data-hp="iso-walls"]')
    && !root(kiosk).querySelector('[data-hp="projection-toggle"]');
  return result;
});

await page.setViewportSize({ width: 820, height: 430 });
out.orientationResizeKeepsIso = await page.evaluate(async () => {
  const card = document.querySelector('houseplan-card');
  window.dispatchEvent(new Event('resize'));
  await card.updateComplete;
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  const anchor = card.renderRoot.querySelector('[data-hp="device"]')?.getBoundingClientRect();
  return !!card.renderRoot.querySelector('[data-hp="iso-walls"]')
    && !!anchor && [anchor.left, anchor.top, anchor.width, anchor.height].every(Number.isFinite);
});
out.kioskSettingOffIsFlat = await page.evaluate(async () => {
  const card = document.querySelector('houseplan-card');
  // #649: the admin switches 2.5D off in General settings; the kiosk follows the push.
  const cfg = structuredClone(card._serverCfg);
  cfg.settings = { ...(cfg.settings || {}), volumetric_view: false };
  const rev = window.__pushServerConfig(cfg);
  const diagnostics = window.__kioskSettingOffDiagnostics = [];
  const snapshot = (phase) => {
    const shell = card.renderRoot.querySelector('ha-card[data-hp-state]');
    const stage = card.renderRoot.querySelector('.stage');
    diagnostics.push({ phase, targetRevision: rev, acceptedRevision: card._cfgRev,
      volumetricView: card._serverCfg?.settings?.volumetric_view ?? null,
      state: shell?.getAttribute('data-hp-state') ?? null,
      floorCache: shell?.getAttribute('data-hp-floor-cache') ?? null,
      projection: stage?.getAttribute('data-projection') ?? null,
      stageClass: stage?.getAttribute('class') ?? null });
  };
  snapshot('push-delivered');
  const started = performance.now();
  while (card._cfgRev < rev && performance.now() - started < 5000) await new Promise((done) => setTimeout(done, 30));
  await card.updateComplete;
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  snapshot('after-revision-wait');
  if (card._cfgRev < rev || card._serverCfg?.settings?.volumetric_view !== false)
    throw new Error('kiosk setting push was not adopted: ' + JSON.stringify(diagnostics));
  // Revision acknowledgement is not scene readiness: asynchronous floor work
  // can deliberately retain the previous complete ISO frame. Wait for this
  // mounted kiosk's public ready terminal, never for the desired projection.
  // The global test facade still addresses the removed original card here.
  const ready = () => {
    const shell = card.renderRoot.querySelector('ha-card[data-hp-state]');
    return shell?.getAttribute('data-hp-state') === 'ready'
      && !shell.hasAttribute('data-hp-floor-cache')
      && !!card.renderRoot.querySelector('.stage:not([data-hp-floor-cache])');
  };
  const readinessStarted = performance.now();
  while (!ready() && performance.now() - readinessStarted < 5000)
    await new Promise((done) => setTimeout(done, 30));
  snapshot(ready() ? 'ready' : 'readiness-timeout');
  if (!ready()) throw new Error('kiosk scene did not settle after setting push: ' + JSON.stringify(diagnostics));
  return !card.renderRoot.querySelector('[data-hp="iso-walls"]')
    && !card.renderRoot.querySelector('.stage.projection-iso')
    && !card.renderRoot.querySelector('[data-hp="projection-toggle"]');
});

console.log(JSON.stringify({touchLayerDiagnostics:await page.evaluate(()=>window.__isoTouchLayerDiagnostics),
  kioskSettingOffDiagnostics:await page.evaluate(()=>window.__kioskSettingOffDiagnostics)},null,2));
checkAll(out);
await finish(browser, out);
