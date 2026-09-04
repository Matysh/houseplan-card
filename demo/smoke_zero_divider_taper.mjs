/** Issue #172: a slightly angled zero-depth Split stays free of masonry. */
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
  const samePoint = (a, b, epsilon = 0.02) => (
    Math.hypot(a[0] - b[0], a[1] - b[1]) <= epsilon
  );
  const sharedEdge = (rooms) => {
    for (let ai = 0; ai < rooms[0].poly.length; ai++) {
      const a0 = rooms[0].poly[ai], a1 = rooms[0].poly[(ai + 1) % rooms[0].poly.length];
      for (let bi = 0; bi < rooms[1].poly.length; bi++) {
        const b0 = rooms[1].poly[bi], b1 = rooms[1].poly[(bi + 1) % rooms[1].poly.length];
        if (samePoint(a0, b1) && samePoint(a1, b0)) return [a0[0], a0[1], a1[0], a1[1]];
      }
    }
    return null;
  };
  const pointInRing = (point, ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if ((a[1] > point[1]) !== (b[1] > point[1])
        && point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0])
        inside = !inside;
    }
    return inside;
  };
  const pointInGeometry = (point, geometry) => (geometry || []).some((polygon) => (
    polygon?.[0] && pointInRing(point, polygon[0])
      && !polygon.slice(1).some((hole) => pointInRing(point, hole))
  ));

  const a = [0.10, 0.10], tr = [0.90, 0.10], br = [0.90, 0.80];
  const notchBottom = [0.60, 0.80], notch = [0.60, 0.40], bl = [0.10, 0.40];
  const outer = [
    entry(a, tr, 15), entry(tr, br, 15), entry(br, notchBottom, 15),
    entry(notchBottom, notch, 15), entry(notch, bl, 15), entry(bl, a, 15),
  ];
  const space = sp();
  space.settings = { ...(space.settings || {}), show_borders: true };
  space.rooms = [{
    id: 'zero-divider-source', name: 'Zero divider source', area: null,
    poly: [a, tr, br, notchBottom, notch, bl],
  }];
  space.walls = outer;
  delete space.open_spans;
  delete space.openings;
  delete space.partitions;
  delete space.room_drafts;
  delete space.wall_columns;
  c._setMode('plan');
  c._tool = 'split';
  await update();

  c._splitClick([700, 250]);
  c._splitClick([600, 400]);
  c._splitClick([900, 405]);
  out.realSplitReachedDialog = !!c._pendingSplit && !!c._roomDialog;
  c._nameSel = 'Zero divider child';
  c._commitRoom();
  await update();

  const rooms = c._spaceModel().rooms;
  const divider = rooms.length === 2 ? sharedEdge(rooms) : null;
  out.realSplitSaved = rooms.length === 2 && !c._pendingSplit;
  out.dividerFound = !!divider;
  out.anglePreserved = !!divider && Math.abs(divider[3] - divider[1]) > 1;
  out.dividerStaysZero = !!divider && c._intervalCm(divider) === 0;

  const samples = [];
  if (divider) {
    const [x0, y0, x1, y1] = divider;
    const dx = x1 - x0, dy = y1 - y0;
    const length = Math.hypot(dx, dy);
    const nx = -dy / length, ny = dx / length;
    for (const t of [0.2, 0.35, 0.5, 0.65, 0.8]) {
      for (const side of [-1, 1])
        samples.push([x0 + dx * t + nx * side * 2, y0 + dy * t + ny * side * 2]);
    }
  }
  const wall = sr().querySelector('.wallbody');
  out.planHasNoTaper = !!wall && samples.length > 0
    && samples.every((point) => !wall.isPointInFill(new DOMPoint(...point)));
  const planD = wall?.getAttribute('d') || '';
  out.planUsesCanonicalBody = !!planD && c._wallUnionGeometry()?.d === planD;

  const lightSpace = c._spaceModel();
  const lightPolys = lightSpace.rooms
    .filter((room) => Array.isArray(room.poly))
    .map((room) => ({ r: room, poly: room.poly }));
  const lightPhysical = c._physicalBodiesR(lightSpace);
  const masonry = c._lightBarriers(lightSpace, lightPolys, lightPhysical).masonryGeometry;
  out.lightHasNoTaper = samples.every((point) => !pointInGeometry(point, masonry));

  const persisted = JSON.stringify({ rooms: space.rooms, walls: space.walls });
  c._setMode('view');
  await update();
  out.planViewParity = sr().querySelector('.wallbody')?.getAttribute('d') === planD;

  const kioskBefore = c._config.kiosk;
  c._config.kiosk = true;
  await update();
  out.kioskParity = sr().querySelector('.wallbody')?.getAttribute('d') === planD;
  c._config.kiosk = kioskBefore;

  history.replaceState(null, '', `?hp_alpha=1#space=${encodeURIComponent(c._space)}`);
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
