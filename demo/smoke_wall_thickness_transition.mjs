/**
 * #150: a production-scale Split must preserve the exact 10 cm → 0 cm
 * exterior breakpoint in every consumer of canonical wall geometry.
 */
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1000, height: 850 });

const result = await page.evaluate(async () => {
  const out = {};
  const card = window.__card;
  const root = () => card.renderRoot;
  const frame = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  const settle = async () => {
    await card.updateComplete;
    while (card._modeTransitionBusy) await frame();
    await frame();
  };
  const containsPath = (path, x, y) => !!path?.isPointInFill(new DOMPoint(x, y));
  const containsD = (d, x, y) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d || '');
    path.setAttribute('fill-rule', 'evenodd');
    svg.appendChild(path);
    document.body.appendChild(svg);
    const inside = containsPath(path, x, y);
    svg.remove();
    return inside;
  };
  const pointInRing = ([x, y], ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if ((a[1] > y) !== (b[1] > y)
          && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  };
  const pointInGeometry = (point, geometry) => (geometry || []).some((polygon) =>
    polygon?.length && pointInRing(point, polygon[0])
      && !polygon.slice(1).some((hole) => pointInRing(point, hole)));

  const space = card._serverCfg.spaces.find((item) => item.id === card._space);
  space.rooms = [{
    id: 'split-source', name: 'Source', area: null,
    poly: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]],
  }];
  delete space.walls;
  delete space.openings;
  delete space.open_spans;
  delete space.partitions;
  delete space.room_drafts;
  delete space.wall_columns;
  card._cfgEpoch++;
  card._regSignature = '';
  card._setMode('plan');
  card.requestUpdate();
  await settle();

  // Exercise the real Plan handlers: select room, choose both wall endpoints,
  // confirm the child, then apply thickness to all walls of the left child.
  card._tool = 'split';
  card._splitClick([300, 300]);
  card._splitClick([500, 100]);
  card._splitClick([500, 900]);
  out.splitDialog = !!card._pendingSplit && !!card._roomDialog;
  card._nameSel = 'Right';
  card._saveRoom();
  await settle();

  const rooms = card._spaceModel().rooms;
  const left = rooms.reduce((best, room) => {
    const meanX = room.poly.reduce((sum, point) => sum + point[0], 0) / room.poly.length;
    return !best || meanX < best.meanX ? { room, meanX } : best;
  }, null)?.room;
  out.splitCommitted = rooms.length === 2 && !!left;

  card._tool = 'wallthick';
  card._wallThickClick([300, 100]);
  out.leftWallSelected = card._wallDialog?.roomId === left?.id;
  card._wallDialog = { ...card._wallDialog, value: '10' };
  card._wallThickApply(true);
  await settle();

  out.savedIntervals = card._intervalCm([100, 100, 500, 100]) === 10
    && card._intervalCm([500, 100, 900, 100]) === 0
    && card._intervalCm([500, 100, 500, 900]) === 10;
  const half = (10 / card._cellCm) * card._gridPitch / 2;
  const planPath = root().querySelector('[data-hp="wall"]');
  const planD = planPath?.getAttribute('d') || '';
  out.planFullDepth = containsPath(planPath, 300, 100 - half * 0.75)
    && containsPath(planPath, 300, 100 + half * 0.75);
  out.planZeroSideClear = !containsPath(planPath, 700, 96)
    && !containsPath(planPath, 700, 104);
  const canonical = card._wallUnionGeometry();
  out.paperZeroSideClear = !!canonical?.paperD && !containsD(canonical.paperD, 700, 96);

  card._setMode('view');
  await settle();
  const viewPath = root().querySelector('[data-hp="wall"]');
  const viewD = viewPath?.getAttribute('d') || '';
  out.viewMatchesPlan = !!planD && viewD === planD
    && !containsPath(viewPath, 700, 96) && containsPath(viewPath, 300, 96);

  const model = card._spaceModel();
  const polys = model.rooms.map((room) => ({ r: room, poly: room.poly }));
  const barriers = card._lightBarriers(model, polys, card._physicalBodiesR(model));
  out.lightUsesSteppedMasonry = pointInGeometry([300, 96], barriers.masonryGeometry)
    && !pointInGeometry([700, 96], barriers.masonryGeometry);

  await customElements.whenDefined('houseplan-space-card');
  const staticCfg = JSON.parse(JSON.stringify(card._serverCfg));
  const baseCall = card.hass.callWS.bind(card.hass);
  const staticHass = { ...card.hass, callWS: async (message) => {
    if (message.type === 'houseplan/config/get') return { config: staticCfg, rev: 1 };
    if (message.type === 'houseplan/layout/get') return { layout: card._layout || {}, rev: 1 };
    return baseCall(message);
  } };
  const staticCard = document.createElement('houseplan-space-card');
  staticCard.setConfig({ type: 'custom:houseplan-space-card', space: card._space, show_button: false });
  staticCard.hass = staticHass;
  document.body.appendChild(staticCard);
  const started = Date.now();
  while (!staticCard.renderRoot?.querySelector('[data-hp="wall"]') && Date.now() - started < 6000)
    await new Promise((done) => setTimeout(done, 60));
  await staticCard.updateComplete;
  const staticPath = staticCard.renderRoot?.querySelector('[data-hp="wall"]');
  out.staticMatchesPlan = staticPath?.getAttribute('d') === planD
    && !containsPath(staticPath, 700, 96) && containsPath(staticPath, 300, 96);
  staticCard.remove();

  const active = Object.freeze(['iso']);
  card._onLabsSnapshot({ active, space: '' });
  window.__hpLabs = active;
  card._setProjection('iso');
  await settle();
  const isoWalls = card._isoSource().build().walls;
  out.hiddenIsoMatchesCanonical = !!root().querySelector('[data-hp="iso-walls"]')
    && pointInGeometry([300, 96], isoWalls) && !pointInGeometry([700, 96], isoWalls);
  return out;
});

checkAll(result);
await finish(browser, result);
