import test from 'node:test';
import assert from 'node:assert/strict';
import { hasPaintableRingArea } from '../test-build/polygon-paint.js';
import { polyclipToPathD, wallBodiesGeometry } from '../test-build/wall-thickness.js';
import { physicalBodyParts, polyclipPathD, geometryPolygonPaths } from '../test-build/physical-geometry.js';
import { buildIsoWallGeometry } from '../test-build/iso-walls.js';
import { buildPdfPage } from '../test-build/pdf/pdf-scene.js';
import { spaceModels, GRID_PITCH, GRID_STEP_N, NORM_W } from '../test-build/space-geometry.js';
import { smoothWallSeamSpace } from '../demo/fixtures/smooth-wall-seam.mjs';

const close = ring => [...ring, ring[0]];
const outer = close([[0, 0], [100, 0], [100, 100], [0, 100]]);
const needle = close([
  [-109.68680625120072, 523.3810973752643],
  [-79.1666666666665, 516.6666666666667],
  [-79.16666666666671, 516.6666666666667],
]);

test('numeric needle has no paint boundary, but real narrow and tiny holes survive', () => {
  assert.equal(hasPaintableRingArea(needle), false);
  assert.equal(hasPaintableRingArea([[0, 0], [2, 2], [4, 4]]), false);
  for (const ring of [
    close([[1, 1], [30, 1], [30, 1.00000001], [1, 1.00000001]]),
    close([[0, 0], [1e-9, 0], [0, 1e-9]]),
    close([[1e8, 1e8], [1e8 + 10, 1e8], [1e8 + 10, 1e8 + 0.001], [1e8, 1e8 + 0.001]]),
  ]) {
    assert.equal(hasPaintableRingArea(ring), true);
    assert.equal(hasPaintableRingArea([...ring].reverse()), true);
    const geom = [[outer, ring]];
    assert.equal(polyclipToPathD(geom).match(/M /g).length, 2, 'evenodd hole is preserved');
  }
});

test('wall and physical SVG projections leave the source and real boundaries unchanged', () => {
  const hole = close([[40, 40], [40, 60], [60, 60], [60, 40]]);
  const geom = [[outer, hole, needle]];
  const before = structuredClone(geom);
  assert.equal(polyclipToPathD(geom), polyclipToPathD([[outer, hole]]));
  assert.equal(polyclipPathD(geom), polyclipPathD([[outer, hole]]));
  assert.deepEqual(geometryPolygonPaths(geom), geometryPolygonPaths([[outer, hole]]));
  assert.deepEqual(geom, before, 'painting must never normalize stored or canonical rings');
  assert.match(polyclipToPathD([[outer]]), /L 100 100/, 'ordinary free boundary still paints');
});

test('exact smooth-wall union keeps its body but paints no internal needle in Flat, iso or PDF', () => {
  const rawSpace = smoothWallSeamSpace();
  const config = { model_version: 10, spaces: [rawSpace], markers: [], settings: {} };
  const before = JSON.stringify(config);
  const space = spaceModels(config)[0];
  const extras = physicalBodyParts(space, 1, GRID_PITCH, GRID_PITCH * 0.0002).all;
  const geometry = wallBodiesGeometry([], [], [], [], GRID_STEP_N, 1, GRID_PITCH, NORM_W, extras);
  assert.equal(geometry.status, 'ok');
  const geom = geometry.components.flatMap(component => component.geom);
  assert.ok(geom.some(poly => poly.length > 1), 'fixture must reach the real boolean tail');
  assert.equal(polyclipToPathD(geom).match(/M /g).length, 1);
  assert.equal(buildIsoWallGeometry(geom).edgeCount, geom[0][0].length - 1,
    'existing iso area guard already removes the tail');
  const pdf = buildPdfPage({
    config, rawSpace, space, layout: {}, options: { paper: 'A4', scale: 'auto' },
    imperial: false, cardTitle: 'Test', version: 'test',
    now: new Date('2026-10-26T00:00:00Z'), t: key => key,
  });
  const walls = pdf.commands.filter(command => command.kind === 'path' && command.hatch);
  assert.equal(walls.length, 1);
  assert.equal(walls[0].rings.length, 1, 'PDF does not stroke the numeric needle either');
  assert.equal(JSON.stringify(config), before);
});
