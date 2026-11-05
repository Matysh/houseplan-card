import test from 'node:test';
import assert from 'node:assert/strict';
import { intersection } from 'polyclip-ts';
import { roomFloorGeometry, buildRoomFloorPaint } from '../test-build/room-floor-paint.js';
import { geometryArea } from '../test-build/physical-geometry.js';
const rect = (x0, y0, x1, y1) => [[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
const seeds = () => [
  { id: 'a', geom: roomFloorGeometry(rect(0,0,45,100), []) },
  { id: 'b', geom: roomFloorGeometry(rect(55,0,100,100), []) },
];
const opening = { rx: 50, ry: 50, angle: 90 };
const tunnel = { faces: [
  { side: 1, roomId: 'a', contours: [rect(-10,0,10,5)], d: '' },
  { side: -1, roomId: 'b', contours: [rect(-10,-5,10,0)], d: '' },
] };
// Path reader is independent of the region builder: its output uses M/L/Z only.
function geometry(path) {
  const rings = path.split(/Z/i).filter(s => s.trim()).map(s => s.match(/-?\d*\.?\d+(?:e[+-]?\d+)?/ig).reduce((a,n,i,all) => {
    if (!(i % 2)) a.push([Number(n),Number(all[i+1])]); return a;
  }, []));
  for (const ring of rings) ring.push(ring[0]);
  return [rings];
}
test('#1250 each floor owns one contiguous half; no overlap or area-data mutation', () => {
  const input = seeds(), frozen = structuredClone(input);
  const result = buildRoomFloorPaint(input, [opening], [tunnel]);
  assert.equal(geometryArea(geometry(result.get('a').path)), 4600);
  assert.equal(geometryArea(geometry(result.get('b').path)), 4600);
  assert.equal(geometryArea(intersection(geometry(result.get('a').path), geometry(result.get('b').path))), 0);
  assert.deepEqual(input, frozen);
  assert.equal(geometryArea(input[0].geom), 4500);
});
test('#1250 blockers/columns and nested-room holes stay empty inside an extension', () => {
  const blockers = [roomFloorGeometry(rect(48,44,49,46), [])];
  const result = buildRoomFloorPaint(seeds(), [opening], [tunnel], blockers);
  assert.equal(geometryArea(geometry(result.get('a').path)), 4598);
  const nested = { id: 'parent', geom: roomFloorGeometry(rect(0,0,100,100), [rect(10,10,90,90)]) };
  const after = buildRoomFloorPaint([nested], [opening], [tunnel]);
  assert.equal(geometryArea(geometry(after.get('parent').path)), geometryArea(nested.geom));
  const parent = { id: 'parent', geom: roomFloorGeometry(rect(0,0,100,100), [rect(10,10,50,90)]) };
  const child = { id: 'a', geom: roomFloorGeometry(rect(10,10,45,90), []) };
  const childTunnel = { faces: tunnel.faces.map(face => ({ ...face, roomId:'a' })) };
  const nestedPaint = buildRoomFloorPaint([parent,child], [opening], [childTunnel]);
  assert.equal(geometryArea(intersection(geometry(nestedPaint.get('parent').path), geometry(nestedPaint.get('a').path))), 0);
  assert.equal(geometryArea(geometry(nestedPaint.get('parent').path)), 6700);
});
test('#1250 outer wall belongs to one room; absent/orphan tunnels add no geometry', () => {
  const outer = { faces: tunnel.faces.map(f => ({ ...f, roomId: 'a' })) };
  const result = buildRoomFloorPaint(seeds().slice(0,1), [opening], [outer]);
  assert.equal(geometryArea(geometry(result.get('a').path)), 4700);
  const absent = buildRoomFloorPaint(seeds(), [opening], [null]);
  assert.equal(absent.get('a').extended, false);
  assert.equal(geometryArea(geometry(absent.get('a').path)), 4500);
});
