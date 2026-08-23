/** Issue #275: exact-class orthogonal strips survive every canonical consumer. */
import { readFileSync } from 'node:fs';
import { launch, checkAll, finish } from './serve.mjs';

const fixture = JSON.parse(readFileSync(
  new URL('../test/fixtures/275-orthogonal-strip-containment.json', import.meta.url), 'utf8',
));
const { page, browser } = await launch({ width: 1100, height: 900 }, 1);

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
  const pointInRing = ([x, y], ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if ((a[1] > y) !== (b[1] > y)
          && x < ((b[0] - a[0]) * (y - a[1])) / ((b[1] - a[1]) || 1e-30) + a[0]) {
        inside = !inside;
      }
    }
    return inside;
  };
  const pointInGeometry = (point, geometry) => (geometry || []).some((polygon) =>
    polygon?.length && pointInRing(point, polygon[0])
      && !(polygon || []).slice(1).some((hole) => pointInRing(point, hole)));
  const onSegment = (point, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const length2 = dx * dx + dy * dy;
    if (!(length2 > 0)) return false;
    const t = ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length2;
    const x = a[0] + dx * t, y = a[1] + dy * t;
    return t >= -1e-7 && t <= 1 + 1e-7
      && Math.hypot(x - point[0], y - point[1]) <= 1e-4;
  };
  const stripSamples = (item) => {
    const samples = [];
    for (const storedNode of item.nodes) {
      const node = storedNode.map((value) => value * 1000);
      const incident = item.walls.filter((wall) => onSegment(storedNode, wall.a, wall.b));
      const maxHalf = Math.max(...incident.map((wall) =>
        ((wall.cm / item.cell_cm) * (1000 / 240)) / 2));
      const radius = maxHalf * 4;
      for (const wall of incident) {
        const a = wall.a.map((value) => value * 1000);
        const b = wall.b.map((value) => value * 1000);
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const u = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
        const n = [-u[1], u[0]];
        const half = ((wall.cm / item.cell_cm) * (1000 / 240)) / 2;
        const ta = (a[0] - node[0]) * u[0] + (a[1] - node[1]) * u[1];
        const tb = (b[0] - node[0]) * u[0] + (b[1] - node[1]) * u[1];
        const lo = Math.max(Math.min(ta, tb), -radius);
        const hi = Math.min(Math.max(ta, tb), radius);
        const tStep = Math.max(half / 5, 0.25);
        const sStep = Math.max(half / 5, 0.25);
        for (let t = lo + tStep / 2; t < hi - tStep / 4; t += tStep) {
          for (let s = -half + sStep / 2; s < half - sStep / 4; s += sStep) {
            samples.push([
              node[0] + u[0] * t + n[0] * s,
              node[1] + u[1] * t + n[1] * s,
            ]);
          }
        }
      }
    }
    return samples;
  };
  const svgMisses = (path, samples) => samples.filter((point) =>
    !path?.isPointInFill?.(new DOMPoint(point[0], point[1]))).length;
  const paperMisses = (samples) => {
    const paths = [...root().querySelectorAll('.hp-paper')];
    return samples.filter((point) => !paths.some((path) =>
      path.isPointInFill?.(new DOMPoint(point[0], point[1])))).length;
  };

  const makeSpace = (item) => {
    const xs = item.rooms.flatMap((room) => room.poly.map((point) => point[0]));
    const ys = item.rooms.flatMap((room) => room.poly.map((point) => point[1]));
    const pad = 0.08;
    return {
      id: `issue-275-${item.id}`,
      title: 'Issue 275',
      cell_cm: item.cell_cm,
      view_box: [
        Math.min(...xs) - pad,
        Math.min(...ys) - pad,
        Math.max(...xs) - Math.min(...xs) + pad * 2,
        Math.max(...ys) - Math.min(...ys) + pad * 2,
      ],
      rooms: structuredClone(item.rooms),
      walls: structuredClone(item.walls),
      settings: { show_borders: true, fill_mode: 'none' },
    };
  };
  // The embedded cards share one production config cache. Serve both fixtures
  // in that one immutable snapshot so the second assertion cannot accidentally
  // reuse the first space under a fake revision.
  const staticCfg = {
    ...structuredClone(card._serverCfg),
    spaces: source.cases.map(makeSpace),
    markers: [],
  };

  for (const item of source.cases) {
    const space = makeSpace(item);
    const cfg = { ...structuredClone(card._serverCfg), spaces: [space], markers: [] };
    card._serverCfg = structuredClone(cfg);
    card._layout = {};
    card._space = space.id;
    card._setMode('plan');
    card._tool = 'select';
    await update(true);

    const prefix = item.id.replaceAll('-', '_');
    const samples = stripSamples(item);
    const persisted = JSON.stringify(card._serverCfg.spaces[0]);
    const path = root().querySelector('[data-hp="wall"]');
    const canonical = card._wallUnionGeometry();
    out[`${prefix}_has_dense_semantic_samples`] = samples.length >= 300;
    out[`${prefix}_plan_has_all_strips`] = svgMisses(path, samples) === 0;
    out[`${prefix}_room_geometry_has_all_strips`] = samples.every((point) =>
      pointInGeometry(point, canonical?.roomGeom));
    out[`${prefix}_paper_has_all_strips`] = paperMisses(samples) === 0;
    out[`${prefix}_plan_uses_canonical_path`] = !!path
      && path.getAttribute('d') === canonical?.d;

    const model = card._spaceModel();
    const polys = model.rooms.map((room) => ({ r: room, poly: room.poly }));
    const barriers = card._lightBarriers(model, polys, card._physicalBodiesR(model));
    out[`${prefix}_light_has_all_strips`] = samples.every((point) =>
      pointInGeometry(point, barriers.masonryGeometry));
    const wallCache = card._wallUnionCache;
    const barrierFingerprint = barriers.fingerprint;

    card.hass = {
      ...card.hass,
      states: {
        ...card.hass.states,
        [`sensor.issue_275_${prefix}`]: {
          entity_id: `sensor.issue_275_${prefix}`, state: '1', attributes: {},
        },
      },
    };
    await update(false);
    out[`${prefix}_state_tick_reuses_wall_geometry`] = card._wallUnionCache === wallCache;
    out[`${prefix}_state_tick_reuses_light_geometry`] = card._lightBarriers(
      model, polys, card._physicalBodiesR(model),
    ).fingerprint === barrierFingerprint;

    card._setMode('view');
    await update(false);
    out[`${prefix}_view_has_all_strips`] = svgMisses(
      root().querySelector('[data-hp="wall"]'), samples,
    ) === 0;

    const kioskBefore = card._config.kiosk;
    card._config.kiosk = true;
    await update(false);
    out[`${prefix}_kiosk_has_all_strips`] = svgMisses(
      root().querySelector('[data-hp="wall"]'), samples,
    ) === 0;
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
        return { config: structuredClone(staticCfg), rev: 1 };
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
    const staticPath = staticCard.renderRoot?.querySelector('[data-hp="wall"]');
    out[`${prefix}_static_matches_plan`] = staticPath?.getAttribute('d')
      === path?.getAttribute('d');
    out[`${prefix}_static_has_all_strips`] = svgMisses(staticPath, samples) === 0;
    staticCard.remove();

    const labs = Object.freeze(['iso']);
    card._onLabsSnapshot({ active: labs, space: '' });
    window.__hpLabs = labs;
    card._setProjection('iso');
    await update(false);
    const isoWalls = card._isoSource().build().walls;
    out[`${prefix}_hidden_iso_has_all_strips`] = samples.every((point) =>
      pointInGeometry(point, isoWalls));
    card._setProjection('plan');
    out[`${prefix}_render_never_writes_config`] = JSON.stringify(
      card._serverCfg.spaces[0],
    ) === persisted;
  }
  return out;
}, fixture);

checkAll(result);
await finish(browser, result);
