/** Issue #123: a Split ending at a room vertex must not reshape the facade. */
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch();

const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const sp = () => c._serverCfg.spaces.find((space) => space.id === c._space);
  const pitch = 1 / 240;
  const wallKey = (a, b) => {
    const q = (value) => Math.round(value / pitch) * pitch;
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const length = Math.hypot(dx, dy) || 1;
    dx /= length; dy /= length;
    if (dx < -1e-12 || (Math.abs(dx) <= 1e-12 && dy < 0)) { dx = -dx; dy = -dy; }
    let angle = Math.atan2(dy, dx);
    if (angle < 0) angle += Math.PI;
    angle = Math.round(angle * 1800) / 1800;
    return `${q((a[0] + b[0]) / 2).toFixed(6)},${q((a[1] + b[1]) / 2).toFixed(6)}@${angle.toFixed(4)}`;
  };
  const entry = (a, b, cm) => ({ key: wallKey(a, b), a: [...a], b: [...b], cm });
  const update = async () => {
    c._cfgEpoch++;
    c._wallUnionCache = null;
    c._lightBarrierCache = null;
    c.requestUpdate();
    await c.updateComplete;
  };
  const bbox = (element) => {
    const box = element?.getBBox?.();
    return box ? [box.x, box.y, box.width, box.height] : null;
  };
  const sameBox = (a, b, epsilon = 0.01) => !!a && !!b
    && a.every((value, index) => Math.abs(value - b[index]) <= epsilon);

  const a = [0.10, 0.10], tr = [0.90, 0.10], b = [0.90, 0.50];
  const br = [0.90, 0.90], bl = [0.10, 0.90];
  const original = { id: 'corner-source', name: 'Corner source', area: null, poly: [a, tr, br, bl] };
  const outerBefore = [
    entry(a, tr, 15), entry(tr, br, 15), entry(br, bl, 15), entry(bl, a, 15),
  ];
  const outerAfter = [
    entry(a, tr, 15), entry(tr, b, 15), entry(b, br, 15),
    entry(br, bl, 15), entry(bl, a, 15),
  ];
  const splitRooms = [
    { id: 'corner-source', name: 'Corner source', area: null, poly: [a, tr, b] },
    { id: 'corner-fresh', name: 'Corner fresh', area: null, poly: [b, br, bl, a] },
  ];

  const space = sp();
  space.settings = { ...(space.settings || {}), show_borders: true };
  space.rooms = [structuredClone(original)];
  space.walls = structuredClone(outerBefore);
  delete space.open_spans;
  delete space.openings;
  delete space.partitions;
  delete space.room_drafts;
  delete space.wall_columns;
  c._setMode('plan');
  await update();
  const beforeWall = bbox(sr().querySelector('.wallbody'));
  const beforePaper = bbox(sr().querySelector('.hp-paperg'));
  out.beforeDrawn = !!beforeWall && !!beforePaper;

  space.rooms = structuredClone(splitRooms);
  const pathByThickness = {};
  for (const cm of [0, 15, 100]) {
    space.walls = [
      ...structuredClone(outerAfter),
      ...(cm ? [entry(a, b, cm)] : []),
    ];
    await update();
    const wall = sr().querySelector('.wallbody');
    const paper = sr().querySelector('.hp-paperg');
    out[`wall${cm}KeepsFacade`] = sameBox(bbox(wall), beforeWall);
    out[`paper${cm}KeepsFacade`] = sameBox(bbox(paper), beforePaper);
    pathByThickness[cm] = wall?.getAttribute('d') || '';
  }
  out.dividerChangesInterior = pathByThickness[15] !== pathByThickness[100]
    && pathByThickness[0] !== pathByThickness[15];

  const persisted = JSON.stringify({ rooms: space.rooms, walls: space.walls });
  const planD = sr().querySelector('.wallbody')?.getAttribute('d') || '';
  const lightSpace = c._spaceModel();
  const lightPolys = lightSpace.rooms
    .filter((room) => Array.isArray(room.poly))
    .map((room) => ({ r: room, poly: room.poly }));
  const lightPhysical = c._physicalBodiesR(lightSpace);
  const lightGeom = c._lightBarriers(lightSpace, lightPolys, lightPhysical).masonryGeometry;
  const lightPoints = lightGeom.flat(2);
  const lightBox = lightPoints.length ? [
    Math.min(...lightPoints.map((point) => point[0])),
    Math.min(...lightPoints.map((point) => point[1])),
    Math.max(...lightPoints.map((point) => point[0])) - Math.min(...lightPoints.map((point) => point[0])),
    Math.max(...lightPoints.map((point) => point[1])) - Math.min(...lightPoints.map((point) => point[1])),
  ] : null;
  out.lightUsesFacade = sameBox(lightBox, beforeWall);

  c._setMode('view');
  await update();
  const viewD = sr().querySelector('.wallbody')?.getAttribute('d') || '';
  out.planViewParity = !!planD && viewD === planD;

  const kioskBefore = c._config.kiosk;
  c._config.kiosk = true;
  await update();
  out.kioskParity = sr().querySelector('.wallbody')?.getAttribute('d') === planD;
  c._config.kiosk = kioskBefore;

  history.replaceState(null, '', `?hp-labs=iso#space=${encodeURIComponent(c._space)}`);
  dispatchEvent(new HashChangeEvent('hashchange'));
  await c.updateComplete;
  c._setProjection('iso');
  await update();
  out.isoUsesCanonicalBody = !!sr().querySelector('.iso-walls .iso-wall-top')
    && c._isoSource().build().walls.flat(2).length > 0;
  c._setProjection('flat');
  await update();

  await customElements.whenDefined('houseplan-space-card');
  const cfg = structuredClone(c._serverCfg);
  const baseCall = c.hass.callWS.bind(c.hass);
  const staticCard = document.createElement('houseplan-space-card');
  staticCard.setConfig({ type: 'custom:houseplan-space-card', space: c._space, show_button: false });
  staticCard.hass = { ...c.hass, callWS: async (message) => {
    if (message.type === 'houseplan/config/get') return { config: cfg, rev: 1 };
    if (message.type === 'houseplan/layout/get') return { layout: c._layout || {}, rev: 1 };
    return baseCall(message);
  } };
  document.body.appendChild(staticCard);
  const started = Date.now();
  while (!staticCard.renderRoot?.querySelector('.wallbody') && Date.now() - started < 6000)
    await new Promise((resolve) => setTimeout(resolve, 60));
  await staticCard.updateComplete;
  out.staticParity = staticCard.renderRoot?.querySelector('.wallbody')?.getAttribute('d') === planD;
  staticCard.remove();

  out.renderDoesNotRewriteConfig = JSON.stringify({ rooms: space.rooms, walls: space.walls }) === persisted;
  return out;
});

checkAll(res);
await finish(browser, res);
