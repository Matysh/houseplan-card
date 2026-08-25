// Issue #302: the rendered wall body of the owner's repro covers the junction
// contract — every support strip and sector fan, clipped to the facade bound.
//
// The units own the geometry rules; this smoke owns the wiring: the same
// probes that the pure pipeline must cover are checked against the actual
// `d` attribute the card renders, so a regression anywhere between the
// geometry pass and the DOM turns it red.
import { readFileSync } from 'node:fs';
import { launch, checkAll, finish } from './serve.mjs';
import {
  wallBodiesGeometry, wallIntervals, buildMultiWallNodeMap,
  junctionNodeGeometry, junctionNodeBound, MITRE_LIMIT,
} from '../test-build/wall-thickness.js';
import { GRID_PITCH, GRID_STEP_N, NORM_W } from '../test-build/space-geometry.js';

const fixture = JSON.parse(readFileSync(
  new URL('../test/fixtures/302-junction-artifacts.json', import.meta.url), 'utf8',
));
const rooms = fixture.rooms.map((room) => ({
  ...room, poly: room.poly.map(([x, y]) => [x * NORM_W, y * NORM_W]),
}));
const map = buildMultiWallNodeMap(
  wallIntervals(rooms, fixture.walls, [], GRID_STEP_N, fixture.cell_cm, GRID_PITCH, NORM_W)
    .filter((iv) => !iv.open && iv.half > 0),
  GRID_STEP_N * NORM_W * 0.04 * 4, NORM_W,
);
const bound = junctionNodeBound(
  rooms, fixture.walls, [], GRID_STEP_N, fixture.cell_cm, GRID_PITCH, NORM_W, map,
);
const corners = junctionNodeGeometry(map);
const inPolygon = (points, x, y) => {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i], [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const inGeometry = (geom, x, y) => {
  let inside = false;
  for (const poly of geom || []) for (const ring of poly || []) {
    if (inPolygon(ring, x, y)) inside = !inside;
  }
  return inside;
};
// Contract probes around every node: strip or fan, inside the facade bound.
const probes = [];
for (const node of map.nodes) {
  const radius = MITRE_LIMIT * node.halfDepth + node.halfDepth;
  const step = GRID_PITCH * 0.25;
  for (let dx = -radius; dx <= radius; dx += step) {
    for (let dy = -radius; dy <= radius; dy += step) {
      const x = node.point[0] + dx, y = node.point[1] + dy;
      const inStrip = node.rays.some((ray) => ray.supports.some((support) => {
        const rx = x - node.point[0], ry = y - node.point[1];
        const along = rx * ray.u[0] + ry * ray.u[1];
        if (along < 0 || along > support.length) return false;
        return Math.abs(rx * ray.u[1] - ry * ray.u[0]) <= support.halfDepth - step * 0.25;
      }));
      const inFan = !inStrip && corners.fans.some((fan) => inPolygon(fan, x, y));
      if (!inStrip && !inFan) continue;
      if (bound && !inGeometry(bound, x, y)) continue;
      probes.push([x, y]);
    }
  }
}
if (probes.length < 500) {
  console.error(`FAIL: contract probe set degenerated to ${probes.length} points`);
  process.exit(1);
}

const { page, browser } = await launch({ width: 1200, height: 1000 }, 1);
const res = await page.evaluate(async ({ sp, probes: probeList }) => {
  const out = {};
  const c = window.__card;
  const settle = async () => {
    for (let i = 0; i < 4; i++) await new Promise((r) => requestAnimationFrame(r));
    await c.updateComplete;
  };
  sp.id = c._space;
  c._serverCfg.spaces[c._serverCfg.spaces.findIndex((s) => s.id === c._space)] = sp;
  c._cfgEpoch++; c.requestUpdate(); await settle();
  await new Promise((r) => setTimeout(r, 600));
  const united = c._wallUnionGeometry();
  out.geometryProduced = !!united?.d;
  const path = new Path2D(united.d);
  const g = document.createElement('canvas').getContext('2d');
  const holes = probeList.filter(([x, y]) =>
    !g.isPointInPath(path, x, y, united.fillRule || 'evenodd'));
  out.probes = probeList.length;
  out.holes = holes.length;
  out.holeSample = holes.slice(0, 5).map((p) => p.map((v) => +v.toFixed(1)));
  out.rendered = !!c.shadowRoot.querySelector('.wallbody');
  return out;
}, { sp: { ...JSON.parse(readFileSync(new URL('../test/fixtures/302-junction-artifacts.json', import.meta.url), 'utf8')), rooms: fixture.rooms, title: 'Repro', view_box: [0, 0, 1, 1], settings: { show_borders: true } }, probes });
const verdict = {
  geometryProduced: res.geometryProduced,
  rendered: res.rendered,
  enoughProbes: res.probes >= 500,
  noContractHoles: res.holes === 0,
};
if (res.holes) console.error('дыры:', res.holeSample, 'из', res.holes);
checkAll(verdict);
await finish(browser, verdict);
