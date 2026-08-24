/** Issue #279: the exact near-orthogonal T keeps every finite incident strip. */
import { readFileSync } from 'node:fs';
import { launch, checkAll, finish } from './serve.mjs';

const fixture = JSON.parse(readFileSync(
  new URL('../test/fixtures/279-near-orthogonal-junction.json', import.meta.url), 'utf8',
));
const { page, browser } = await launch({ width: 1000, height: 760 }, 1);

const result = await page.evaluate(async (source) => {
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
  const space = {
    id: 'issue-279',
    title: 'Issue 279',
    cell_cm: source.cell_cm,
    view_box: [-1.8, 1.95, 3, 2.05],
    rooms: structuredClone(source.rooms),
    walls: structuredClone(source.walls),
    settings: { show_borders: true, fill_mode: 'none' },
  };
  card._serverCfg = {
    ...structuredClone(card._serverCfg), spaces: [space], markers: [],
  };
  card._layout = {};
  card._space = space.id;
  card._setMode('plan');
  card._tool = 'select';
  await update(true);

  const persisted = JSON.stringify(card._serverCfg.spaces[0]);
  const node = source.node.map((value) => value * 1000);
  const halfDepth = (20 / source.cell_cm) * (1000 / 240) / 2;
  const incident = source.walls.map((wall) => {
    const other = Math.hypot(wall.a[0] - source.node[0], wall.a[1] - source.node[1])
      > 1e-8 ? wall.a : wall.b;
    const dx = other[0] * 1000 - node[0];
    const dy = other[1] * 1000 - node[1];
    const length = Math.hypot(dx, dy);
    return { u: [dx / length, dy / length], length };
  });
  const missingSamples = (path) => {
    let missing = 0;
    for (const ray of incident) {
      const n = [-ray.u[1], ray.u[0]];
      for (let t = 3; t <= Math.min(100, ray.length - 3); t += 3) {
        for (let cross = -halfDepth + 3; cross <= halfDepth - 3; cross += 3) {
          const point = new DOMPoint(
            node[0] + ray.u[0] * t + n[0] * cross,
            node[1] + ray.u[1] * t + n[1] * cross,
          );
          if (!path?.isPointInFill?.(point)) missing++;
        }
      }
    }
    return missing;
  };

  const planPath = root().querySelector('[data-hp="wall"]');
  const planD = planPath?.getAttribute('d') || '';
  const out = {
    planHasCanonicalWall: !!planD,
    planKeepsEveryIncidentSample: missingSamples(planPath) === 0,
    renderNeverWritesConfig: JSON.stringify(card._serverCfg.spaces[0]) === persisted,
  };
  card._setMode('view');
  await update(false);
  const viewPath = root().querySelector('[data-hp="wall"]');
  out.viewMatchesPlan = viewPath?.getAttribute('d') === planD;
  out.viewKeepsEveryIncidentSample = missingSamples(viewPath) === 0;
  return out;
}, fixture);

checkAll(result);
await finish(browser, result);
